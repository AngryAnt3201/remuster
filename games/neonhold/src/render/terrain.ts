// Neonhold's Arena terrain (shadows base/src/render/terrain.ts; same class, same events, same layers). The base
// file draws masonry, gabled houses and crates; a neon city needs shapes it cannot describe, so the upright blocks
// are redrawn here: see-through hard-light barriers between emitter posts, flat-roofed kiosks under a lit sign and
// awning, server racks with status rows and a beacon mast, corrugated containers and vending machines. Every block
// is a dark body with a tube of light along its top edges. Colours still come from ../game/terrain.ts.
//
// Layers: water, gate and bridge marks, rubble and contact shadows go on the ground (under every unit); upright
// blocks are handed to the board as drawables and depth-sort with units by ground row. Long blocks are cut into
// slices so a unit beside a wall is hidden by the stretch in front of it and drawn over the stretch behind.
import { W } from "@engine/core/defs";
import type { BattleEvent } from "@engine/core/battle";
import { breakable, type Block, type BlockState } from "@engine/core/terrain";
import type { ArenaMark } from "@engine/core/arena";
import type { Camera, Drawable } from "@base/render/camera";
import type { Fx } from "@base/render/fx";
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
    if (st.detail === "house") { this.kiosk(ctx, cam, b, st, h, flash, lw); ctx.restore(); return; }
    if (st.roof === "cone") { this.rack(ctx, cam, b, st, h, flash, lw); ctx.restore(); return; }
    if (st.roof === "crenel") { this.hardlight(ctx, cam, b, st, y0, y1, h, last, flash, slice, lw); ctx.restore(); return; }
    const wallH = h;
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
    ctx.restore();
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
      if (k > 0.58 && cw > 0.4) {
        // a vending machine: a tall dark cabinet with a lit front
        const vh = h * 1.7, i = cw * 0.1;
        box(ctx, cam, a + i, y0 + g, d - i, y1 - g, 0, vh, DARK, true, flash);
        poly(ctx, cam, [[a + i + 0.05, y1 - g, vh * 0.3], [d - i - 0.05, y1 - g, vh * 0.3], [d - i - 0.05, y1 - g, vh * 0.9], [a + i + 0.05, y1 - g, vh * 0.9]]);
        const lamp = VEND[Math.floor(hash(b.id, c + 5) * VEND.length) % VEND.length] ?? st.trim;
        ctx.fillStyle = flash ? "#fff" : lamp; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
        ctx.save(); ctx.strokeStyle = DARK.front; ctx.lineWidth = Math.max(0.75, cam.scaleAt(y1) * 0.02);
        for (const t of [0.5, 0.7]) line(ctx, cam, [a + i + 0.05, y1 - g, vh * t], [d - i - 0.05, y1 - g, vh * t], 0.8);
        ctx.restore();
        tube(ctx, cam, [[a + i, y1 - g, vh], [d - i, y1 - g, vh]], lamp, cam.scaleAt(y1) * 0.03, false);
        continue;
      }
      box(ctx, cam, a, y0 + g, d, y1 - g, 0, ch, st, true, flash);
      ctx.save(); ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(0.75, cam.scaleAt(y1) * 0.02);
      // corrugated sides, a door bar
      const ribs = Math.max(3, Math.round((d - a) / 0.1));
      for (let r = 1; r < ribs; r++) line(ctx, cam, [a + ((d - a) * r) / ribs, y1 - g, ch * 0.08], [a + ((d - a) * r) / ribs, y1 - g, ch * 0.92], 0.4);
      line(ctx, cam, [a, y1 - g, ch * 0.5], [d, y1 - g, ch * 0.5], 0.9);
      ctx.restore();
      tube(ctx, cam, [[a, y0 + g, ch], [d, y0 + g, ch], [d, y1 - g, ch], [a, y1 - g, ch]], st.trim, cam.scaleAt(y1) * 0.022);
    }
  }

  // ------------------------------------------------------------ neon blocks
  /** A hard-light barrier: a low dark kerb, emitter posts, and a see-through sheet of light between them. */
  private hardlight(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, y0: number, y1: number, h: number, last: boolean, flash: number, slice: number, lw: number) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, k = 0.1, pw = Math.min(0.13, b.w * 0.3);
    const post = (x: number, y: number) => {
      box(ctx, cam, x - pw / 2, y - pw / 2, x + pw / 2, y + pw / 2, 0, h + 0.1, DARK, true, flash);
      const p = cam.project(x, y, h + 0.12); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, p.s * 0.05), 0, 6.3); ctx.fillStyle = st.trim; ctx.fill();
    };
    box(ctx, cam, x0, y0, x1, y1, 0, k, DARK, last, flash);
    if (slice === 0) { post(x0 + pw / 2, y0 + pw / 2); post(x1 - pw / 2, y0 + pw / 2); }
    const face = (pts: P3[], fill: string, a: number) => { poly(ctx, cam, pts); ctx.globalAlpha = a; ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1; if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.55})`; ctx.fill(); } };
    if (x1 < W / 2) face([[x1, y0, k], [x1, y1, k], [x1, y1, h], [x1, y0, h]], st.side, 0.6);
    else if (x0 > W / 2) face([[x0, y0, k], [x0, y1, k], [x0, y1, h], [x0, y0, h]], st.side, 0.6);
    if (last) {
      face([[x0, y1, k], [x1, y1, k], [x1, y1, h], [x0, y1, h]], st.front, 0.55);
      // scan lines across the sheet
      ctx.save(); ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(0.75, lw * 0.5);
      const rows = Math.max(3, Math.round((h - k) / 0.17));
      for (let r = 1; r < rows; r++) line(ctx, cam, [x0, y1, k + ((h - k) * r) / rows], [x1, y1, k + ((h - k) * r) / rows], 0.38);
      ctx.restore();
    }
    face([[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], st.top, 0.5);
    // the bright top edges: the two long sides always, the ends only where the wall ends
    const along = b.w >= b.h;
    if (along) { tube(ctx, cam, [[x0, y0, h], [x1, y0, h]], st.trim, lw, false); if (last) tube(ctx, cam, [[x0, y1, h], [x1, y1, h]], st.trim, lw, false); }
    else { tube(ctx, cam, [[x0, y0, h], [x0, y1, h]], st.trim, lw, false); tube(ctx, cam, [[x1, y0, h], [x1, y1, h]], st.trim, lw, false); if (last) tube(ctx, cam, [[x0, y1, h], [x1, y1, h]], st.trim, lw, false); }
    if (last) { post(x0 + pw / 2, y1 - pw / 2); post(x1 - pw / 2, y1 - pw / 2); }
  }

  /** A kiosk (or, taller, the server hall): a dark flat-roofed box with a lit hatch, an awning and a sign on the roof. */
  private kiosk(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, h: number, flash: number, lw: number) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
    const lit = st.roofLit ?? st.trim, dark = st.roofDark ?? st.side, glow = st.glow ?? st.top, hall = h > 1.1;
    box(ctx, cam, x0, y0, x1, y1, 0, h, st, true, flash);
    const rect = (xa: number, xb: number, za: number, zb: number, fill: string, a = 1) => { poly(ctx, cam, [[xa, y1, za], [xb, y1, za], [xb, y1, zb], [xa, y1, zb]]); ctx.globalAlpha = a; ctx.fillStyle = flash ? "#fff" : fill; ctx.fill(); ctx.globalAlpha = 1; };
    const m = Math.min(0.16, b.w * 0.12);
    if (hall) {
      // rows of cold windows
      const cols = Math.max(2, Math.round((b.w - 2 * m) / 0.34)), cw = (b.w - 2 * m) / cols;
      for (const [za, zb] of [[h * 0.2, h * 0.38], [h * 0.5, h * 0.68]]) for (let c = 0; c < cols; c++) rect(x0 + m + c * cw + cw * 0.14, x0 + m + (c + 1) * cw - cw * 0.14, za, zb, hash(c + b.id, za) > 0.3 ? glow : st.trim, 0.9);
    } else {
      // the service hatch and a counter
      rect(x0 + m, x1 - m, h * 0.26, h * 0.74, glow, 0.95);
      rect(x0 + m * 0.6, x1 - m * 0.6, h * 0.18, h * 0.26, st.trim);
    }
    // a strip of light down the visible side wall
    const sx = b.x < W / 2 ? x1 : x0;
    if (x1 < W / 2 || x0 > W / 2) { ctx.save(); ctx.strokeStyle = lit; ctx.lineWidth = Math.max(1, lw); line(ctx, cam, [sx, b.y, h * 0.15], [sx, b.y, h * 0.8], 0.8); ctx.restore(); }
    // roof: edge tube, a vent, the sign standing on the front edge
    tube(ctx, cam, [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], st.trim, lw);
    const v = Math.min(0.3, b.w * 0.2, b.h * 0.25);
    box(ctx, cam, b.x - v, b.y - v * 0.8, b.x + v, b.y + v * 0.5, h, h + 0.12, DARK, true, flash);
    const sw = Math.min(b.w * 0.42, 0.9), sh = hall ? 0.4 : 0.3;
    box(ctx, cam, b.x - sw, y1 - 0.1, b.x + sw, y1, h, h + sh, { ...st, top: lit, front: lit, side: dark }, true, flash);
    tube(ctx, cam, [[b.x - sw, y1, h], [b.x + sw, y1, h], [b.x + sw, y1, h + sh], [b.x - sw, y1, h + sh]], "#ffffff", lw * 0.8);
    // the awning over the hatch
    if (!hall) {
      poly(ctx, cam, [[x0, y1, h * 0.96], [x1, y1, h * 0.96], [x1, y1 + 0.13, h * 0.84], [x0, y1 + 0.13, h * 0.84]]);
      ctx.fillStyle = dark; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      tube(ctx, cam, [[x0, y1 + 0.13, h * 0.84], [x1, y1 + 0.13, h * 0.84]], lit, lw, false);
    }
  }

  /** A server tower: a tall rack with rows of status lights and a beacon mast. */
  private rack(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, h: number, flash: number, lw: number) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
    const lit = st.roofLit ?? st.trim, glow = st.glow ?? st.top;
    box(ctx, cam, x0, y0, x1, y1, 0, h, st, true, flash);
    const rows = Math.max(4, Math.round(h / 0.2)), cols = Math.max(3, Math.round(b.w / 0.16)), m = 0.07, cw = (b.w - 2 * m) / cols;
    for (let r = 1; r < rows; r++) {
      const za = (h * r) / rows - 0.035, zb = za + 0.07;
      for (let c = 0; c < cols; c++) {
        const k = hash(c + r * 7, b.id);
        if (k < 0.3) continue;
        poly(ctx, cam, [[x0 + m + c * cw + cw * 0.15, y1, za], [x0 + m + (c + 1) * cw - cw * 0.15, y1, za], [x0 + m + (c + 1) * cw - cw * 0.15, y1, zb], [x0 + m + c * cw + cw * 0.15, y1, zb]]);
        ctx.fillStyle = flash ? "#fff" : k > 0.86 ? glow : k > 0.6 ? lit : st.trim; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    const sx = b.x < W / 2 ? x1 : x0;
    if (x1 < W / 2 || x0 > W / 2) { ctx.save(); ctx.strokeStyle = lit; ctx.lineWidth = Math.max(1, lw); for (const t of [0.3, 0.7]) line(ctx, cam, [sx, y0 + (y1 - y0) * t, h * 0.08], [sx, y0 + (y1 - y0) * t, h * 0.92], 0.7); ctx.restore(); }
    tube(ctx, cam, [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], lit, lw);
    // the mast and its beacon
    const top = h + Math.max(b.w, b.h) * 0.7;
    ctx.save(); ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(1, lw * 1.2); line(ctx, cam, [b.x, b.y, h], [b.x, b.y, top]); ctx.restore();
    const p = cam.project(b.x, b.y, top), r = Math.max(2, p.s * 0.07);
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, 6.3); ctx.fillStyle = glow; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.fillStyle = glow; ctx.fill();
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
/** The dark chassis every machine, post and kerb is made of. */
const DARK: LookStyle = { h: 0, top: "#34315f", front: "#1c1a3d", side: "#131129", trim: "#8a5cff" };
/** Vending machine fronts. */
const VEND = ["#ff6fe6", "#7f9bff", "#ffe84a"];
/** A tube of light along a path: a wide soft stroke under a thin bright one (cheaper than a canvas shadow). */
function tube(ctx: Ctx, cam: Camera, pts: P3[], color: string, lw: number, closed = true) {
  ctx.save();
  ctx.beginPath();
  pts.forEach((p, i) => { const s = cam.project(p[0], p[1], p[2]); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
  if (closed) ctx.closePath();
  ctx.strokeStyle = color; ctx.lineCap = "round";
  ctx.globalAlpha = 0.22; ctx.lineWidth = Math.max(3, lw * 4.5); ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineWidth = Math.max(1, lw * 1.15); ctx.stroke();
  ctx.restore();
}
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
