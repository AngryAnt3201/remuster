// Arena terrain: walls, buildings, barricades, cover and water (engine/core/terrain.ts), drawn as solid shapes
// through the board's 3/4 camera. Everything is built from projected quads, so it sits exactly on the sim's
// rectangles at every screen size. Colours and shapes come from the game's ../game/terrain.ts.
//
// Layers: water, gate and bridge marks, rubble and contact shadows go on the ground (under every unit); upright
// blocks are handed to the board as drawables and depth-sort with units by ground row. Long blocks are cut into
// slices so a unit beside a wall is hidden by the stretch in front of it and drawn over the stretch behind.
import { W } from "@engine/core/defs";
import type { BattleEvent } from "@engine/core/battle";
import { breakable, type Block, type BlockState } from "@engine/core/terrain";
import type { ArenaMark } from "@engine/core/arena";
import type { Camera, Drawable } from "./camera";
import type { Fx } from "./fx";
import { TERRAIN, type LookStyle } from "../game/terrain";

type Ctx = CanvasRenderingContext2D;
type P3 = [number, number, number];
interface Env { sound?: (n: string, g?: number) => void; kick?: (k: number) => void; }

const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const styleOf = (b: Block): LookStyle => TERRAIN.looks[b.look ?? ""] ?? TERRAIN.looks[b.kind] ?? TERRAIN.looks.wall;
const SLICE = 0.9;

export class TerrainLayer {
  blocks: Block[] = [];
  marks: ArenaMark[] = [];
  /** Block id -> board time of its last hit / the time it broke. */
  private hitAt = new Map<number, number>();
  private brokeAt = new Map<number, number>();

  set(blocks: Block[] | undefined, marks: ArenaMark[] | undefined) {
    this.blocks = blocks ?? []; this.marks = marks ?? [];
    this.hitAt.clear(); this.brokeAt.clear();
  }
  get any() { return this.blocks.length > 0; }

  /** A new battle starts with every block standing again. */
  reset() { this.hitAt.clear(); this.brokeAt.clear(); }

  // ------------------------------------------------------------ events
  onEvent(e: BattleEvent, fx: Fx, time: number, env: Env) {
    if (e.t === "blockhit") {
      this.hitAt.set(e.id, time);
      const b = this.blocks.find((k) => k.id === e.id);
      fx.burst(e.x, e.y, 4, { color: b ? styleOf(b).front : TERRAIN.rubble, speed: 1.6, size: 0.07, max: 0.5, kind: "chunk", z: 0.3 });
      env.sound?.("hit", 0.5);
    } else if (e.t === "blockbreak") {
      this.brokeAt.set(e.id, time);
      const b = this.blocks.find((k) => k.id === e.id);
      const st = b ? styleOf(b) : undefined;
      const n = Math.max(1, Math.round((e.w * e.h) / 0.5));
      for (let i = 0; i < n; i++) {
        const x = e.x + (hash(e.id, i) - 0.5) * e.w, y = e.y + (hash(i, e.id) - 0.5) * e.h;
        fx.burst(x, y, 5, { color: i % 2 ? st?.front ?? TERRAIN.rubble : st?.top ?? TERRAIN.rubble, speed: 2.6, size: 0.1, max: 0.8, kind: "chunk", z: 0.35 });
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
    for (const b of this.blocks) if (b.kind === "water") this.water(ctx, cam, b, time);
    for (const m of this.marks) this.mark(ctx, cam, m);
    for (const b of this.blocks) {
      if (b.kind === "water") continue;
      const { alive } = this.state(b, live);
      if (!alive) { this.rubble(ctx, cam, b); continue; }
      // contact shadow: the footprint pushed away from the light (down-right)
      const h = styleOf(b).h, k = Math.min(0.55, h * 0.3);
      quad(ctx, cam, [b.x - b.w / 2, b.y - b.h / 2, 0], [b.x + b.w / 2 + k, b.y - b.h / 2 + k * 0.3, 0],
        [b.x + b.w / 2 + k, b.y + b.h / 2 + k * 0.55, 0], [b.x - b.w / 2, b.y + b.h / 2 + k * 0.55, 0]);
      ctx.fillStyle = "rgba(10,12,20,0.28)"; ctx.fill();
    }
    ctx.restore();
  }

  private water(ctx: Ctx, cam: Camera, b: Block, time: number) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
    const r = Math.min(0.35, b.w / 2, b.h / 2), wt = TERRAIN.water;
    const path = (grow: number) => {
      // rounded rectangle on the ground; edges that run off the board stay square
      const pts: [number, number][] = [];
      const corner = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 5; i++) { const a = a0 + (i / 5) * Math.PI / 2; pts.push([cx + Math.cos(a) * (r + grow), cy + Math.sin(a) * (r + grow)]); } };
      corner(x1 - r, y1 - r, 0); corner(x0 + r, y1 - r, Math.PI / 2); corner(x0 + r, y0 + r, Math.PI); corner(x1 - r, y0 + r, Math.PI * 1.5);
      ctx.beginPath();
      pts.forEach(([x, y], i) => { const p = cam.project(Math.max(-0.2, Math.min(W + 0.2, x)), y, 0); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.closePath();
    };
    path(0.09); ctx.fillStyle = wt.bank; ctx.fill();
    path(0);
    const a = cam.project(b.x, y0), c = cam.project(b.x, y1);
    const g = ctx.createLinearGradient(0, a.y, 0, c.y);
    g.addColorStop(0, wt.shallow); g.addColorStop(1, wt.deep);
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
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
    path(0); ctx.strokeStyle = wt.foam; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1, a.s * 0.03); ctx.stroke(); ctx.globalAlpha = 1;
  }

  private mark(ctx: Ctx, cam: Camera, m: ArenaMark) {
    const x0 = m.x - m.w / 2, x1 = m.x + m.w / 2, y0 = m.y - m.h / 2, y1 = m.y + m.h / 2;
    if (m.look === "gate") {
      quad(ctx, cam, [x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]);
      ctx.fillStyle = TERRAIN.gate; ctx.fill();
      return;
    }
    const br = TERRAIN.bridge;
    quad(ctx, cam, [x0, y0, 0.03], [x1, y0, 0.03], [x1, y1, 0.03], [x0, y1, 0.03]);
    ctx.fillStyle = br.deck; ctx.fill();
    ctx.strokeStyle = br.plank; ctx.lineWidth = Math.max(1, cam.scaleAt(m.y) * 0.03);
    // planks run across the way you walk (the bridge's short side spans the water)
    const alongY = m.h >= m.w, len = alongY ? m.h : m.w, n = Math.max(2, Math.round(len / 0.28));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p = alongY ? cam.project(x0, y0 + t * m.h, 0.03) : cam.project(x0 + t * m.w, y0, 0.03);
      const q = alongY ? cam.project(x1, y0 + t * m.h, 0.03) : cam.project(x0 + t * m.w, y1, 0.03);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    ctx.strokeStyle = br.rail; ctx.lineWidth = Math.max(1.5, cam.scaleAt(m.y) * 0.07);
    for (const s of [0, 1]) {
      const p = alongY ? cam.project(s ? x1 : x0, y0, 0.03) : cam.project(x0, s ? y1 : y0, 0.03);
      const q = alongY ? cam.project(s ? x1 : x0, y1, 0.03) : cam.project(x1, s ? y1 : y0, 0.03);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
  }

  private rubble(ctx: Ctx, cam: Camera, b: Block) {
    const n = Math.max(4, Math.round(b.w * b.h * 9)), st = styleOf(b);
    for (let i = 0; i < n; i++) {
      const x = b.x + (hash(i, b.id) - 0.5) * b.w * 1.1, y = b.y + (hash(b.id, i + 9) - 0.5) * b.h * 1.1;
      const r = 0.05 + hash(i, 11) * 0.09;
      ctx.fillStyle = i % 3 ? TERRAIN.rubble : st.side;
      ctx.globalAlpha = 0.8; ctx.beginPath(); cam.groundPath(ctx, x, y, r); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ upright layer
  /** The blocks as depth-sorted drawables. `live` is Battle.blocks during a battle (omit while deploying). */
  drawables(ctx: Ctx, cam: Camera, time: number, live?: readonly BlockState[]): Drawable[] {
    const out: Drawable[] = [];
    for (const b of this.blocks) {
      if (b.kind === "water") continue;
      const { alive, frac } = this.state(b, live);
      if (!alive) continue;
      const st = styleOf(b);
      const hitT = this.hitAt.get(b.id);
      const flash = hitT !== undefined ? Math.max(0, 1 - (time - hitT) / 0.14) : 0;
      // a hit barricade shudders and sags as it wears down
      const h = st.h * (breakable(b.kind) ? 0.7 + 0.3 * frac : 1);
      const roofed = st.roof === "gable" || st.roof === "cone";
      const y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
      const n = roofed ? 1 : Math.max(1, Math.round(b.h / SLICE));
      for (let i = 0; i < n; i++) {
        const a = y0 + (b.h * i) / n, c = y0 + (b.h * (i + 1)) / n, last = i === n - 1;
        out.push({ y: c - 0.02, layer: 1, draw: () => this.block(ctx, cam, b, st, a, c, h, last, flash, frac, i) });
      }
      if (breakable(b.kind) && frac < 0.999) out.push({ y: y1 - 0.01, layer: 1, draw: () => this.bar(ctx, cam, b, h, frac) });
    }
    return out;
  }

  private block(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, y0: number, y1: number, h: number, last: boolean, flash: number, frac: number, slice: number) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
    ctx.save();
    ctx.lineJoin = "round";
    const lw = Math.max(1, cam.scaleAt(y1) * 0.035);
    ctx.lineWidth = lw; ctx.strokeStyle = TERRAIN.ink;
    if (st.detail === "rail") { this.fence(ctx, cam, b, st, y0, y1, h, last, flash); ctx.restore(); return; }
    if (st.detail === "crate") { this.crates(ctx, cam, b, st, y0, y1, h, flash, slice); ctx.restore(); return; }
    const wallH = st.roof === "gable" ? h * 0.62 : h;
    box(ctx, cam, x0, y0, x1, y1, 0, wallH, st, last, flash);
    // ---- surface detail
    ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(0.75, lw * 0.6);
    if (st.detail === "brick" && last) {
      const rows = Math.max(2, Math.round(wallH / 0.24));
      for (let r = 1; r < rows; r++) line(ctx, cam, [x0, y1, (wallH * r) / rows], [x1, y1, (wallH * r) / rows], 0.45);
      for (let r = 0; r < rows; r++) {
        const cols = Math.max(1, Math.round(b.w / 0.45));
        for (let c = 0; c < cols; c++) { const x = x0 + ((c + (r % 2 ? 0.5 : 0)) / cols) * b.w; if (x > x0 + 0.05 && x < x1 - 0.05) line(ctx, cam, [x, y1, (wallH * r) / rows], [x, y1, (wallH * (r + 1)) / rows], 0.3); }
      }
    }
    if (st.detail === "log") {
      const alongX = b.w >= b.h, n = Math.max(2, Math.round((alongX ? y1 - y0 : b.w) / 0.22));
      for (let i = 1; i < n; i++) {
        if (alongX) line(ctx, cam, [x0, y0 + ((y1 - y0) * i) / n, wallH], [x1, y0 + ((y1 - y0) * i) / n, wallH], 0.6);
        else line(ctx, cam, [x0 + (b.w * i) / n, y0, wallH], [x0 + (b.w * i) / n, y1, wallH], 0.6);
      }
      if (last && !alongX) for (let i = 0; i < n; i++) { const p = cam.project(x0 + (b.w * (i + 0.5)) / n, y1, wallH * 0.5); ctx.beginPath(); ctx.arc(p.x, p.y, p.s * Math.min(0.1, wallH * 0.3), 0, 6.3); ctx.fillStyle = st.top; ctx.fill(); ctx.stroke(); }
    }
    if (st.detail === "stake") {
      // sharpened stakes leaning toward the enemy of whoever stands behind: just upright spikes along the long axis
      const alongX = b.w >= b.h, len = alongX ? b.w : y1 - y0, n = Math.max(2, Math.round(len / 0.26));
      ctx.lineWidth = lw; ctx.strokeStyle = TERRAIN.ink;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, lean = (hash(i, b.id) - 0.5) * 0.12;
        const cx = alongX ? x0 + t * b.w : b.x, cy = alongX ? (y0 + y1) / 2 : y0 + t * (y1 - y0);
        if (alongX && !last) continue;
        const d = 0.07, top = wallH + 0.34 * (0.8 + hash(b.id, i) * 0.4);
        poly(ctx, cam, [[cx - d, cy, wallH * 0.6], [cx + d, cy, wallH * 0.6], [cx + lean, cy, top]]);
        ctx.fillStyle = i % 2 ? st.top : st.front; ctx.fill(); ctx.stroke();
      }
      if (frac < 0.6) { ctx.strokeStyle = TERRAIN.ink; crack(ctx, cam, x0, x1, y1, wallH, b.id); }
    }
    // ---- roofs
    if (st.roof === "crenel") {
      // a darker walkway inset on top, with merlons along the two long edges
      const inset = Math.min(0.14, b.w * 0.25, (y1 - y0) * 0.25);
      if (b.w > 0.5 && y1 - y0 > 0.3) { poly(ctx, cam, [[x0 + inset, y0 + (slice ? 0 : inset), wallH], [x1 - inset, y0 + (slice ? 0 : inset), wallH], [x1 - inset, y1 - (last ? inset : 0), wallH], [x0 + inset, y1 - (last ? inset : 0), wallH]]); ctx.fillStyle = st.side; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1; }
      if (last && b.w >= 0.6) {
        const n = Math.max(2, Math.round(b.w / 0.42)), mw = (b.w / n) * 0.55;
        ctx.lineWidth = lw; ctx.strokeStyle = TERRAIN.ink;
        for (let i = 0; i < n; i++) { const cx = x0 + ((i + 0.5) / n) * b.w; box(ctx, cam, cx - mw / 2, y1 - 0.12, cx + mw / 2, y1, wallH, wallH + 0.16, st, true, flash); }
      }
    }
    if (st.roof === "gable") this.gable(ctx, cam, b, st, wallH, h, flash, lw);
    if (st.roof === "cone") this.cone(ctx, cam, b, st, wallH, flash, lw);
    ctx.restore();
  }

  private gable(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, e: number, h: number, flash: number, lw: number) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
    const o = 0.1, ridge = e + Math.max(0.35, h * 0.55), lit = st.roofLit ?? st.top, dark = st.roofDark ?? st.side;
    const face = (pts: P3[], fill: string) => { poly(ctx, cam, pts); ctx.fillStyle = fill; ctx.fill(); if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.55})`; ctx.fill(); } ctx.stroke(); };
    ctx.lineWidth = lw; ctx.strokeStyle = TERRAIN.ink;
    // house details on the front wall first (the eaves overlap them)
    if (st.detail === "house") {
      const dw = Math.min(0.3, b.w * 0.2);
      poly(ctx, cam, [[b.x - dw / 2, y1, 0], [b.x + dw / 2, y1, 0], [b.x + dw / 2, y1, e * 0.72], [b.x - dw / 2, y1, e * 0.72]]);
      ctx.fillStyle = st.trim; ctx.fill();
      if (b.w > 1.1) for (const s of [-1, 1]) {
        const wx = b.x + s * b.w * 0.3, ww = Math.min(0.22, b.w * 0.12);
        poly(ctx, cam, [[wx - ww / 2, y1, e * 0.38], [wx + ww / 2, y1, e * 0.38], [wx + ww / 2, y1, e * 0.74], [wx - ww / 2, y1, e * 0.74]]);
        ctx.fillStyle = st.glow ?? st.top; ctx.fill(); ctx.stroke();
      }
    }
    if (b.w >= b.h) {
      // ridge runs across: far slope, then the gable end on the visible side, then the near slope
      face([[x0 - o, y0 - o, e], [x1 + o, y0 - o, e], [x1 + o, b.y, ridge], [x0 - o, b.y, ridge]], dark);
      const sx = b.x < W / 2 ? x1 : x0;
      face([[sx, y0, e], [sx, y1, e], [sx, b.y, ridge - 0.04]], st.side);
      face([[x0 - o, b.y, ridge], [x1 + o, b.y, ridge], [x1 + o, y1 + o, e - 0.05], [x0 - o, y1 + o, e - 0.05]], lit);
      // shingle rows and a bright ridge so the slope reads as a roof, not a slab
      ctx.save(); ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.75, lw * 0.7);
      for (const t of [0.36, 0.7]) line(ctx, cam, [x0 - o, b.y + (y1 + o - b.y) * t, ridge + (e - 0.05 - ridge) * t], [x1 + o, b.y + (y1 + o - b.y) * t, ridge + (e - 0.05 - ridge) * t], 0.55);
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = Math.max(1, lw); line(ctx, cam, [x0 - o, b.y, ridge], [x1 + o, b.y, ridge]);
      ctx.restore();
    } else {
      // ridge runs toward the player: the gable end faces front, slopes fall left and right
      face([[x0, y1, e], [x1, y1, e], [b.x, y1, ridge - 0.04]], st.front);
      const leftFirst = b.x >= W / 2;
      const L: P3[] = [[x0 - o, y0 - o, e - 0.05], [b.x, y0 - o, ridge], [b.x, y1 + o, ridge], [x0 - o, y1 + o, e - 0.05]];
      const R: P3[] = [[x1 + o, y0 - o, e - 0.05], [b.x, y0 - o, ridge], [b.x, y1 + o, ridge], [x1 + o, y1 + o, e - 0.05]];
      if (leftFirst) { face(R, dark); face(L, lit); } else { face(L, lit); face(R, dark); }
    }
  }

  private cone(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, e: number, flash: number, lw: number) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2, o = 0.08;
    const apex: P3 = [b.x, b.y, e + Math.max(b.w, b.h) * 0.75], lit = st.roofLit ?? st.top, dark = st.roofDark ?? st.side;
    ctx.lineWidth = lw; ctx.strokeStyle = TERRAIN.ink;
    // an arrow slit that glows
    if (st.glow) { poly(ctx, cam, [[b.x - 0.06, y1, e * 0.5], [b.x + 0.06, y1, e * 0.5], [b.x + 0.06, y1, e * 0.72], [b.x - 0.06, y1, e * 0.72]]); ctx.fillStyle = st.glow; ctx.fill(); ctx.stroke(); }
    const face = (a: P3, c: P3, fill: string) => { poly(ctx, cam, [a, c, apex]); ctx.fillStyle = fill; ctx.fill(); if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.55})`; ctx.fill(); } ctx.stroke(); };
    face([x0 - o, y0 - o, e], [x1 + o, y0 - o, e], dark);
    if (b.x < W / 2) face([x0 - o, y0 - o, e], [x0 - o, y1 + o, e], dark); else face([x1 + o, y0 - o, e], [x1 + o, y1 + o, e], dark);
    if (b.x < W / 2) face([x1 + o, y0 - o, e], [x1 + o, y1 + o, e], st.roofDark ?? st.side); else face([x0 - o, y0 - o, e], [x0 - o, y1 + o, e], lit);
    face([x0 - o, y1 + o, e], [x1 + o, y1 + o, e], lit);
  }

  private fence(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, y0: number, y1: number, h: number, last: boolean, flash: number) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, alongX = b.w >= b.h;
    const pw = 0.09;
    const post = (x: number, y: number) => box(ctx, cam, x - pw / 2, y - pw / 2, x + pw / 2, y + pw / 2, 0, h, st, true, flash);
    const rail = (a: P3, c: P3) => { const p = cam.project(...a), q = cam.project(...c); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
    const rails = (a: [number, number], c: [number, number]) => {
      for (const z of [h * 0.38, h * 0.78]) {
        ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(2.5, cam.scaleAt(y1) * 0.1); rail([a[0], a[1], z], [c[0], c[1], z]);
        ctx.strokeStyle = flash ? "#fff" : st.front; ctx.lineWidth = Math.max(1.5, cam.scaleAt(y1) * 0.06); rail([a[0], a[1], z], [c[0], c[1], z]);
      }
      ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(1, cam.scaleAt(y1) * 0.035);
    };
    if (alongX) {
      if (!last) return;
      const n = Math.max(1, Math.round(b.w / 0.55));
      rails([x0, b.y], [x1, b.y]);
      for (let i = 0; i <= n; i++) post(x0 + (b.w * i) / n, b.y);
    } else {
      rails([b.x, y0], [b.x, y1]);
      post(b.x, y0 + pw / 2); if (last) post(b.x, y1 - pw / 2);
    }
  }

  private crates(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, y0: number, y1: number, h: number, flash: number, slice: number) {
    const x0 = b.x - b.w / 2, cols = Math.max(1, Math.round(b.w / 0.55)), cw = b.w / cols, g = 0.03;
    // nearest column to the board's centre line last, so side faces overlap correctly
    const order = [...Array(cols).keys()].sort((a, c) => Math.abs(x0 + (c + 0.5) * cw - W / 2) - Math.abs(x0 + (a + 0.5) * cw - W / 2));
    for (const c of order) {
      const k = hash(c + b.id * 3, slice), ch = h * (0.8 + k * 0.45);
      const a = x0 + c * cw + g, d = x0 + (c + 1) * cw - g;
      box(ctx, cam, a, y0 + g, d, y1 - g, 0, ch, st, true, flash);
      ctx.save(); ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(0.75, cam.scaleAt(y1) * 0.025);
      line(ctx, cam, [a, y1 - g, 0], [d, y1 - g, ch], 0.7); line(ctx, cam, [d, y1 - g, 0], [a, y1 - g, ch], 0.7);
      const i = Math.min(0.08, cw * 0.18);
      poly(ctx, cam, [[a + i, y0 + g + i, ch], [d - i, y0 + g + i, ch], [d - i, y1 - g - i, ch], [a + i, y1 - g - i, ch]]); ctx.globalAlpha = 0.6; ctx.stroke();
      ctx.restore();
      // a second, smaller crate on some stacks
      if (k > 0.62 && cw > 0.4) { const s = cw * 0.2; box(ctx, cam, a + s, y0 + g + s * 0.6, d - s, y1 - g - s * 0.6, ch, ch + h * 0.6, st, true, flash); }
    }
  }

  private bar(ctx: Ctx, cam: Camera, b: Block, h: number, frac: number) {
    const p = cam.project(b.x, b.y, h + 0.45), w = Math.max(18, p.s * Math.min(1.1, Math.max(b.w, 0.7))), hh = Math.max(3, p.s * 0.09);
    ctx.save();
    ctx.fillStyle = "rgba(10,12,20,0.7)"; ctx.fillRect(p.x - w / 2 - 1, p.y - hh / 2 - 1, w + 2, hh + 2);
    ctx.fillStyle = frac > 0.5 ? "#e7d9b0" : frac > 0.25 ? "#f0a94a" : "#e3573f";
    ctx.fillRect(p.x - w / 2, p.y - hh / 2, w * frac, hh);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- projected shapes
function poly(ctx: Ctx, cam: Camera, pts: P3[]) {
  ctx.beginPath();
  pts.forEach((p, i) => { const s = cam.project(p[0], p[1], p[2]); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
  ctx.closePath();
}
const quad = (ctx: Ctx, cam: Camera, a: P3, b: P3, c: P3, d: P3) => poly(ctx, cam, [a, b, c, d]);
function line(ctx: Ctx, cam: Camera, a: P3, b: P3, alpha = 1) {
  const p = cam.project(...a), q = cam.project(...b);
  ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.globalAlpha = 1;
}
/** A box from its footprint and z range: the side face toward the board's centre line, the face toward the player
 *  (only when `front`: a slice in the middle of a long wall has none) and the top. */
function box(ctx: Ctx, cam: Camera, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, st: LookStyle, front: boolean, flash: number) {
  const fill = (c: string) => { ctx.fillStyle = c; ctx.fill(); if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.55})`; ctx.fill(); } ctx.stroke(); };
  if (x1 < W / 2) { quad(ctx, cam, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]); fill(st.side); }
  else if (x0 > W / 2) { quad(ctx, cam, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]); fill(st.side); }
  if (front) { quad(ctx, cam, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]); fill(st.front); }
  quad(ctx, cam, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); fill(st.top);
}
function crack(ctx: Ctx, cam: Camera, x0: number, x1: number, y: number, h: number, seed: number) {
  ctx.beginPath();
  const cx = x0 + (x1 - x0) * (0.3 + hash(seed, 1) * 0.4);
  for (let i = 0; i <= 4; i++) { const p = cam.project(cx + (hash(seed, i + 2) - 0.5) * 0.18, y, h * (1 - i / 4)); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
  ctx.stroke();
}
