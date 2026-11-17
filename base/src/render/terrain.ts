// The level: walls, buildings, barricades, cover, water, roads and brush (engine/core/terrain.ts) and the standing
// decoration marks, drawn as real geometry (props.ts, kit3d.ts) through the board camera from whatever side it is
// looking. Colours and shapes come from the game's ../game/terrain.ts.
//
// Layers: water, roads, plazas, gate and bridge paint, rubble and cast shadows go on the ground (under every unit);
// everything that stands up is handed to the board as drawables and depth-sorts with the units. Long blocks are cut
// into cells (kit3d slice) so a unit beside a wall is hidden by the stretch in front of it and drawn over the rest.
import { H, W } from "@engine/core/defs";
import type { BattleEvent } from "@engine/core/battle";
import { breakable, type Block, type BlockState } from "@engine/core/terrain";
import type { ArenaMark } from "@engine/core/arena";
import type { Camera, Drawable } from "./camera";
import type { Fx } from "./fx";
import { drawFaces, groundPoly, slice, type Face, type KitLook, type P3, type Piece } from "./kit3d";
import { HEIGHT, buildBlock, buildMark, seeded } from "./props";
import { TERRAIN } from "../game/terrain";
import { texture } from "./textures";

type Ctx = CanvasRenderingContext2D;
interface Env { sound?: (n: string, g?: number) => void; kick?: (k: number) => void; }

const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const flat = (b: Block) => b.kind === "water" && b.look !== "fountain" || (b.kind as string) === "road" || ((b.kind as string) === "brush" && b.look !== "orchard");
/** The colour a block's chips and dust fly off in. */
function matOf(b: Block): string {
  const M = TERRAIN.mat, l = b.look ?? b.kind;
  if (b.kind === "wall" || l === "tower" || l === "gatehouse" || l === "ruin" || l === "well" || l === "statue") return M.stone;
  if (b.kind === "building") return M.plaster;
  if (l === "sandbags") return M.sack;
  if (l === "haystack") return M.hay;
  return M.timber;
}
/** The kit's shading set-up from the game's style. */
export function kitLook(): KitLook {
  const l = TERRAIN.light, n = Math.hypot(l[0], l[1], l[2]) || 1;
  let tex: Map<string, HTMLCanvasElement> | undefined;
  if (TERRAIN.tex && typeof document !== "undefined") {
    tex = new Map();
    for (const [m, t] of Object.entries(TERRAIN.tex)) if (t) tex.set(TERRAIN.mat[m as keyof typeof TERRAIN.mat], texture(t));
    // per-look wall colours carry their material's texture too: walls are stone, houses plaster
    for (const [look, o] of Object.entries(TERRAIN.looks ?? {})) if (o.wall && !tex.has(o.wall)) { const t = TERRAIN.tex[look === "wall" || look === "tower" || look === "gatehouse" ? "stone" : "plaster"]; if (t) tex.set(o.wall, texture(t)); }
    for (const [, o] of Object.entries(TERRAIN.looks ?? {})) if (o.roofC && !tex.has(o.roofC) && TERRAIN.tex.roof) tex.set(o.roofC, texture(TERRAIN.tex.roof));
  }
  return { ink: TERRAIN.ink, inkW: TERRAIN.inkW, light: [l[0] / n, l[1] / n, l[2] / n], dark: TERRAIN.dark, tint: TERRAIN.tint, bands: TERRAIN.bands, tex, texK: TERRAIN.texK, texSize: TERRAIN.texSize, ao: TERRAIN.ao };
}
interface Standing { id: number; block?: Block; pieces: Piece[]; anim?: (t: number) => Face[]; ax: number; ay: number; h: number; }
interface Tuft { x: number; y: number; h: number; ph: number; kind: number; }

export class TerrainLayer {
  blocks: Block[] = [];
  marks: ArenaMark[] = [];
  /** Block id -> board time of its last hit / the time it broke. */
  private hitAt = new Map<number, number>();
  private brokeAt = new Map<number, number>();
  private standing: Standing[] = [];
  private tufts: Tuft[] = [];
  private look = kitLook();

  set(blocks: Block[] | undefined, marks: ArenaMark[] | undefined) {
    this.blocks = blocks ?? []; this.marks = marks ?? [];
    this.hitAt.clear(); this.brokeAt.clear();
    this.look = kitLook();
    this.standing = []; this.tufts = [];
    for (const b of this.blocks) {
      if ((b.kind as string) === "brush") this.plant(b);
      if (flat(b)) continue;
      const built = buildBlock(b);
      if (!built) continue;
      this.standing.push({ id: b.id, block: b, pieces: slice(built.mesh.faces, b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2), anim: built.anim, ax: b.x, ay: b.y, h: built.h });
    }
    this.marks.forEach((k, i) => {
      const built = buildMark(k, i);
      if (built) this.standing.push({ id: -1 - i, pieces: [{ x: k.x, y: k.y, faces: built.mesh.faces }], anim: built.anim, ax: k.x, ay: k.y, h: built.h });
    });
  }
  get any() { return this.blocks.length > 0; }

  /** A new battle starts with every block standing again. */
  reset() { this.hitAt.clear(); this.brokeAt.clear(); }

  /** Tall grass, reeds or crop over a brush block: clumps that sway and sort with the units standing in them. */
  private plant(b: Block) {
    const rnd = seeded(b.id * 53 + 7), look = b.look ?? "brush";
    const kind = look === "reeds" ? 1 : look === "cornfield" ? 2 : look === "orchard" ? 3 : 0;
    const per = kind === 2 ? 9 : kind === 3 ? 3 : 7, n = Math.max(3, Math.round(b.w * b.h * per));
    for (let i = 0; i < n; i++) {
      // rows for crops, scatter for the rest
      const x = kind === 2 ? b.x - b.w / 2 + ((i % Math.max(2, Math.round(b.w * 3))) + 0.5) / Math.max(2, Math.round(b.w * 3)) * b.w : b.x + (rnd() - 0.5) * (b.w - 0.1);
      const y = b.y + (rnd() - 0.5) * (b.h - 0.1);
      this.tufts.push({ x, y, h: (kind === 2 ? 0.62 : kind === 1 ? 0.6 : kind === 3 ? 0.22 : 0.42) * (0.75 + rnd() * 0.5), ph: rnd() * 6.3, kind });
    }
  }

  // ------------------------------------------------------------ events
  onEvent(e: BattleEvent, fx: Fx, time: number, env: Env) {
    if (e.t === "blockhit") {
      this.hitAt.set(e.id, time);
      const b = this.blocks.find((k) => k.id === e.id);
      fx.burst(e.x, e.y, 4, { color: b ? matOf(b) : TERRAIN.rubble, speed: 1.6, size: 0.07, max: 0.5, kind: "chunk", z: 0.3 });
      env.sound?.("hit", 0.5);
    } else if (e.t === "blockbreak") {
      this.brokeAt.set(e.id, time);
      const b = this.blocks.find((k) => k.id === e.id);
      const st = b ? matOf(b) : undefined;
      const n = Math.max(1, Math.round((e.w * e.h) / 0.5));
      for (let i = 0; i < n; i++) {
        const x = e.x + (hash(e.id, i) - 0.5) * e.w, y = e.y + (hash(i, e.id) - 0.5) * e.h;
        fx.burst(x, y, 5, { color: i % 2 ? st ?? TERRAIN.rubble : st ?? TERRAIN.rubble, speed: 2.6, size: 0.1, max: 0.8, kind: "chunk", z: 0.35 });
        fx.burst(x, y, 3, { color: TERRAIN.dust, speed: 0.9, size: 0.22, max: 0.9, kind: "smoke", gravity: -0.6, z: 0.2 });
      }
      fx.ring(e.x, e.y, 0.2, Math.max(e.w, e.h) * 0.9, 0.35, TERRAIN.dust, 0.08);
      fx.shake = Math.max(fx.shake, 0.5);
      env.sound?.("crumble", 0.9); env.kick?.(2);
    } else if (e.t === "ricochet") {
      fx.burst(e.x, e.y, 5, { color: TERRAIN.spark, speed: 2.2, size: 0.04, max: 0.25, kind: "spark", z: 0.5 });
      env.sound?.("clank", 0.35);
    } else if (e.t === "crash") {
      fx.burst(e.x, e.y, 8, { color: TERRAIN.dust, speed: 1.8, size: 0.14, max: 0.6, kind: "smoke", gravity: -0.4, z: 0.3, dir: e.a + Math.PI, spread: 1.8 });
      fx.burst(e.x, e.y, 6, { color: TERRAIN.spark, speed: 2.4, size: 0.05, max: 0.3, kind: "spark", z: 0.5 });
      fx.shake = Math.max(fx.shake, 0.35);
      env.sound?.("slam", 0.7); env.kick?.(1);
    }
  }

  // ------------------------------------------------------------ ground layer
  private state(b: Block, live?: readonly BlockState[]) {
    const s = live?.find((k) => k.id === b.id);
    return { alive: s ? s.alive : true, frac: s && s.maxHp > 0 ? Math.max(0, s.hp / s.maxHp) : 1 };
  }

  ground(ctx: Ctx, cam: Camera, time: number, live?: readonly BlockState[]) {
    if (!this.any && !this.marks.length) return;
    ctx.save();
    this.roads(ctx, cam);
    for (const b of this.blocks) if ((b.kind as string) === "brush") this.bed(ctx, cam, b);
    for (const b of this.blocks) if (b.kind === "water" && b.look !== "fountain") this.water(ctx, cam, b, time);
    for (const m of this.marks) this.mark(ctx, cam, m);
    // cast shadows: the footprint pushed away from the sun by the height of what stands on it
    const l = this.look.light, sx = -l[0] / Math.max(0.3, l[2]), sy = -l[1] / Math.max(0.3, l[2]);
    ctx.fillStyle = TERRAIN.shadow;
    for (const s of this.standing) {
      const b = s.block;
      if (b && !this.state(b, live).alive) { this.rubble(ctx, cam, b); ctx.fillStyle = TERRAIN.shadow; continue; }
      const k = Math.min(1.1, s.h * 0.55), w = b ? b.w / 2 : 0.25, d = b ? b.h / 2 : 0.25;
      const x0 = s.ax - w, x1 = s.ax + w, y0 = s.ay - d, y1 = s.ay + d, ox = sx * k, oy = sy * k;
      const hull = ox >= 0 && oy >= 0 ? [[x0, y0], [x1, y0], [x1 + ox, y0 + oy], [x1 + ox, y1 + oy], [x0 + ox, y1 + oy], [x0, y1]]
        : ox < 0 && oy < 0 ? [[x1, y1], [x0, y1], [x0 + ox, y1 + oy], [x0 + ox, y0 + oy], [x1 + ox, y0 + oy], [x1, y0]]
        : ox >= 0 ? [[x0, y1], [x0, y0], [x1, y0], [x1 + ox, y0 + oy], [x1 + ox, y1 + oy], [x0 + ox, y1 + oy]]
        : [[x1, y0], [x1, y1], [x0, y1], [x0 + ox, y1 + oy], [x0 + ox, y0 + oy], [x1 + ox, y0 + oy]];
      groundPoly(ctx, cam, hull as [number, number][]); ctx.fill();
    }
    ctx.restore();
  }

  /** Roads, plazas and bridge decks: painted as one surface (edges first, then the fill, so neighbours join up). */
  private roads(ctx: Ctx, cam: Camera) {
    const rs = this.blocks.filter((b) => (b.kind as string) === "road");
    if (!rs.length) return;
    const rd = TERRAIN.road, rect = (b: Block, g: number): [number, number][] => [[b.x - b.w / 2 - g, b.y - b.h / 2 - g], [b.x + b.w / 2 + g, b.y - b.h / 2 - g], [b.x + b.w / 2 + g, b.y + b.h / 2 + g], [b.x - b.w / 2 - g, b.y + b.h / 2 + g]];
    const deck = (b: Block) => b.look === "bridge-deck";
    ctx.fillStyle = rd.edge;
    for (const b of rs) if (!deck(b)) { groundPoly(ctx, cam, rect(b, 0.07)); ctx.fill(); }
    for (const b of rs) if (!deck(b)) { groundPoly(ctx, cam, rect(b, 0)); ctx.fillStyle = b.look === "plaza" ? TERRAIN.plaza : rd.fill; ctx.fill(); }
    // surface: cobbles, ruts, planks or lane dashes
    ctx.strokeStyle = rd.mark; ctx.fillStyle = rd.mark; ctx.lineCap = "round";
    for (const b of rs) {
      if (deck(b)) { this.mark(ctx, cam, { look: "bridge", x: b.x, y: b.y, w: b.w, h: b.h } as ArenaMark); ctx.strokeStyle = rd.mark; ctx.fillStyle = rd.mark; continue; }
      const alongY = b.h >= b.w, s = cam.scaleAt(b.y, 0, b.x);
      ctx.lineWidth = Math.max(1, s * 0.03);
      if (rd.kind === "cobble" || b.look === "plaza") {
        const n = Math.round(b.w * b.h * 7);
        for (let i = 0; i < n; i++) { const x = b.x + (hash(i, b.id) - 0.5) * (b.w - 0.15), y = b.y + (hash(b.id, i + 3) - 0.5) * (b.h - 0.15); ctx.beginPath(); cam.groundPath(ctx, x, y, 0.045 + hash(i, 9) * 0.03); ctx.fill(); }
      } else if (rd.kind === "lane") {
        const L = alongY ? b.h : b.w, n = Math.max(1, Math.round(L / 0.7));
        for (let i = 0; i < n; i++) { const t0 = (i + 0.25) / n, t1 = (i + 0.75) / n; const p = alongY ? cam.project(b.x, b.y - b.h / 2 + t0 * b.h) : cam.project(b.x - b.w / 2 + t0 * b.w, b.y), q = alongY ? cam.project(b.x, b.y - b.h / 2 + t1 * b.h) : cam.project(b.x - b.w / 2 + t1 * b.w, b.y); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      } else {
        // ruts or plank joints along the way you walk
        for (const o of rd.kind === "plank" ? [-0.3, -0.1, 0.1, 0.3] : [-0.22, 0.22]) {
          const w = (alongY ? b.w : b.h) * o;
          groundPoly(ctx, cam, alongY ? [[b.x + w, b.y - b.h / 2], [b.x + w, b.y + b.h / 2]] : [[b.x - b.w / 2, b.y + w], [b.x + b.w / 2, b.y + w]]);
          ctx.stroke();
        }
      }
    }
  }

  /** The ground under brush: a darker bed so the patch reads as a place even before its blades are drawn. */
  private bed(ctx: Ctx, cam: Camera, b: Block) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2, r = Math.min(0.3, b.w / 2, b.h / 2);
    const pts: [number, number][] = [];
    const corner = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 3; i++) { const a = a0 + (i / 3) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    corner(x1 - r, y1 - r, 0); corner(x0 + r, y1 - r, Math.PI / 2); corner(x0 + r, y0 + r, Math.PI); corner(x1 - r, y0 + r, Math.PI * 1.5);
    groundPoly(ctx, cam, pts);
    ctx.globalAlpha = 0.55; ctx.fillStyle = b.look === "cornfield" ? TERRAIN.brush.crop : TERRAIN.brush.b; ctx.fill(); ctx.globalAlpha = 1;
  }

  private water(ctx: Ctx, cam: Camera, b: Block, time: number) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
    const r = Math.min(0.35, b.w / 2, b.h / 2), wt = TERRAIN.water;
    const path = (grow: number) => {
      // rounded rectangle on the ground; edges that run off the board carry on to the rim of the world
      const pts: [number, number][] = [];
      const corner = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 5; i++) { const a = a0 + (i / 5) * Math.PI / 2; pts.push([cx + Math.cos(a) * (r + grow), cy + Math.sin(a) * (r + grow)]); } };
      corner(x1 - r, y1 - r, 0); corner(x0 + r, y1 - r, Math.PI / 2); corner(x0 + r, y0 + r, Math.PI); corner(x1 - r, y0 + r, Math.PI * 1.5);
      const run = (x: number) => (x0 <= 0.01 && x < b.x ? x - 4 : x1 >= W - 0.01 && x > b.x ? x + 4 : x);
      groundPoly(ctx, cam, pts.map(([x, y]) => [run(x), y] as [number, number]));
    };
    path(0.09); ctx.fillStyle = wt.bank; ctx.fill();
    path(0);
    ctx.fillStyle = wt.shallow; ctx.fill();
    ctx.save(); ctx.clip();
    path(-0.18); ctx.fillStyle = wt.deep; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
    // ripples: short bright dashes drifting across
    ctx.strokeStyle = wt.foam; ctx.lineCap = "round";
    const n = Math.max(3, Math.round(b.w * b.h * 2.2));
    for (let i = 0; i < n; i++) {
      const ph = (time * (0.12 + hash(i, b.id) * 0.1) + hash(b.id, i)) % 1;
      const y = y0 + hash(i, 7 + b.id) * b.h, x = x0 + ((hash(i, 3) + ph) % 1) * b.w, len = 0.18 + hash(i, 5) * 0.25;
      const p = cam.project(x, y), q = cam.project(x + len, y);
      ctx.globalAlpha = 0.5 * Math.sin(ph * Math.PI);
      ctx.lineWidth = Math.max(1, p.s * 0.035);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    ctx.restore();
    path(0); ctx.strokeStyle = wt.foam; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1, cam.scaleAt(b.y, 0, b.x) * 0.03); ctx.stroke(); ctx.globalAlpha = 1;
  }

  private mark(ctx: Ctx, cam: Camera, m: ArenaMark) {
    const x0 = m.x - m.w / 2, x1 = m.x + m.w / 2, y0 = m.y - m.h / 2, y1 = m.y + m.h / 2;
    const look = m.look as string;
    if (look === "gate" || look === "door") {
      groundPoly(ctx, cam, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
      ctx.fillStyle = TERRAIN.plaza; ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
      return;
    }
    if (look !== "bridge") return;
    const br = TERRAIN.bridge, z = 0.04, s = cam.scaleAt(m.y, 0, m.x);
    groundPoly(ctx, cam, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z);
    ctx.fillStyle = br.deck; ctx.fill();
    ctx.strokeStyle = br.plank; ctx.lineWidth = Math.max(1, s * 0.03);
    // planks run across the way you walk (the bridge's short side spans the water)
    const alongY = m.h >= m.w, len = alongY ? m.h : m.w, n = Math.max(2, Math.round(len / 0.28));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p = alongY ? cam.project(x0, y0 + t * m.h, z) : cam.project(x0 + t * m.w, y0, z);
      const q = alongY ? cam.project(x1, y0 + t * m.h, z) : cam.project(x0 + t * m.w, y1, z);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    ctx.strokeStyle = br.rail; ctx.lineWidth = Math.max(1.5, s * 0.07);
    for (const k of [0, 1]) {
      const p = alongY ? cam.project(k ? x1 : x0, y0, z) : cam.project(x0, k ? y1 : y0, z);
      const q = alongY ? cam.project(k ? x1 : x0, y1, z) : cam.project(x1, k ? y1 : y0, z);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
  }

  private rubble(ctx: Ctx, cam: Camera, b: Block) {
    const n = Math.max(4, Math.round(b.w * b.h * 9)), st = matOf(b);
    for (let i = 0; i < n; i++) {
      const x = b.x + (hash(i, b.id) - 0.5) * b.w * 1.1, y = b.y + (hash(b.id, i + 9) - 0.5) * b.h * 1.1;
      const r = 0.05 + hash(i, 11) * 0.09;
      ctx.fillStyle = i % 3 ? TERRAIN.rubble : st;
      ctx.globalAlpha = 0.8; ctx.beginPath(); cam.groundPath(ctx, x, y, r); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ upright layer
  /** Everything that stands up, as depth-sorted drawables. `live` is Battle.blocks during a battle (omit while
   *  deploying). */
  drawables(ctx: Ctx, cam: Camera, time: number, live?: readonly BlockState[]): Drawable[] {
    const out: Drawable[] = [], look = this.look;
    for (const s of this.standing) {
      const b = s.block;
      let flash = 0, sag = 1;
      if (b) {
        const { alive, frac } = this.state(b, live);
        if (!alive) continue;
        const hitT = this.hitAt.get(b.id);
        flash = hitT !== undefined ? Math.max(0, 1 - (time - hitT) / 0.14) * 0.6 : 0;
        if (breakable(b.kind)) sag = 0.72 + 0.28 * frac; // it sags as it wears down
      }
      s.pieces.forEach((pc, i) => out.push({ x: pc.x, y: pc.y, layer: 1, draw: () => {
        let faces: readonly Face[] = pc.faces;
        if (sag < 0.999) faces = pc.faces.map((f) => ({ ...f, p: f.p.map((q) => [q[0], q[1], q[2] * sag] as P3) }));
        drawFaces(ctx, cam, faces, look, { flash });
        if (i === 0 && s.anim) drawFaces(ctx, cam, s.anim(time), look, { flash });
      } }));
    }
    for (const t of this.tufts) out.push({ x: t.x, y: t.y + 0.05, layer: 1, draw: () => this.tuft(ctx, cam, t, time) });
    return out;
  }

  private tuft(ctx: Ctx, cam: Camera, t: Tuft, time: number) {
    const B = TERRAIN.brush, sway = Math.sin(time * 1.7 + t.ph) * 0.06 * t.h * 2, base = cam.project(t.x, t.y, 0), s = base.s;
    const blade = (dx: number, lean: number, h: number, c: string, w: number) => {
      const tip = cam.project(t.x + dx + lean + sway, t.y, h);
      const bx = base.x + dx * s;
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(bx - w * s, base.y); ctx.lineTo(tip.x, tip.y); ctx.lineTo(bx + w * s, base.y); ctx.closePath(); ctx.fill();
      return tip;
    };
    if (t.kind === 2) { // crop: a stalk with a head
      const tip = blade(0, 0.02, t.h, B.b, 0.035); blade(-0.05, -0.1, t.h * 0.6, B.a, 0.03); blade(0.05, 0.1, t.h * 0.7, B.a, 0.03);
      ctx.fillStyle = B.crop; ctx.beginPath(); ctx.ellipse(tip.x, tip.y, s * 0.035, s * 0.09, 0, 0, Math.PI * 2); ctx.fill();
    } else if (t.kind === 1) { // reeds
      for (const [dx, k] of [[-0.07, 0.85], [0, 1], [0.08, 0.75]] as const) {
        const tip = blade(dx, dx * 0.6, t.h * k, B.b, 0.018);
        ctx.fillStyle = TERRAIN.mat.trunk; ctx.beginPath(); ctx.ellipse(tip.x, tip.y + s * 0.05, s * 0.022, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else { blade(-0.1, -0.12, t.h * 0.75, B.b, 0.05); blade(0.09, 0.13, t.h * 0.8, B.b, 0.05); blade(0, 0.01, t.h, B.a, 0.055); blade(0.03, 0.06, t.h * 0.55, B.tip, 0.03); }
  }
}
void H; void HEIGHT;
