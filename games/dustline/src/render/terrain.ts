// Dustline's Arena terrain. The base renderer builds every block from a box, a roof and a surface detail; a frontier
// town needs shapes it cannot describe, so this wraps it: buildings become false-front stores (a shed behind a tall
// painted facade with a sign and a striped porch), towers become water towers on legs, barricades are stacked hay
// bales, cover is barrels and crates, and adobe walls get their roof beams. Fences, log jams, water, marks, rubble,
// events and the health bars are the base game's. Colours come from ../game/terrain.ts.
import { W } from "@engine/core/defs";
import { breakable, type Block, type BlockState } from "@engine/core/terrain";
import { TerrainLayer as Base } from "@base/render/terrain";
import type { Camera, Drawable } from "@base/render/camera";
import { TERRAIN, type LookStyle } from "../game/terrain";

type Ctx = CanvasRenderingContext2D;
type P3 = [number, number, number];
/** The base layer's private parts this file reuses. */
interface Inner {
  hitAt: Map<number, number>;
  state(b: Block, live?: readonly BlockState[]): { alive: boolean; frac: number };
  block(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, y0: number, y1: number, h: number, last: boolean, flash: number, frac: number, slice: number): void;
  bar(ctx: Ctx, cam: Camera, b: Block, h: number, frac: number): void;
}
const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const styleOf = (b: Block): LookStyle => TERRAIN.looks[b.look ?? ""] ?? TERRAIN.looks[b.kind] ?? TERRAIN.looks.wall;
const SLICE = 0.9;

export class TerrainLayer extends Base {
  drawables(ctx: Ctx, cam: Camera, time: number, live?: readonly BlockState[]): Drawable[] {
    const self = this as unknown as Inner, out: Drawable[] = [];
    for (const b of this.blocks) {
      if (b.kind === "water") continue;
      const { alive, frac } = self.state(b, live);
      if (!alive) continue;
      const st = styleOf(b), look = b.look ?? b.kind;
      const hitT = self.hitAt.get(b.id);
      const flash = hitT !== undefined ? Math.max(0, 1 - (time - hitT) / 0.14) : 0;
      const h = st.h * (breakable(b.kind) ? 0.7 + 0.3 * frac : 1);
      const y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
      const pen = () => { ctx.save(); ctx.lineJoin = "round"; ctx.lineWidth = Math.max(1, cam.scaleAt(y1) * 0.035); ctx.strokeStyle = TERRAIN.ink; };
      if (b.kind === "building" && look !== "tower") out.push({ y: y1 - 0.02, layer: 1, draw: () => { pen(); store(ctx, cam, b, st, flash, look === "hall"); ctx.restore(); } });
      else if (look === "tower") out.push({ y: y1 - 0.02, layer: 1, draw: () => { pen(); waterTower(ctx, cam, b, st, flash); ctx.restore(); } });
      else if (look === "barricade") for (const d of bales(ctx, cam, b, st, h, flash, frac)) out.push({ y: d.y, layer: 1, draw: () => { pen(); d.draw(); ctx.restore(); } });
      else if (look === "crates" || (b.kind === "cover" && look !== "fence")) for (const d of barrels(ctx, cam, b, st, h, flash)) out.push({ y: d.y, layer: 1, draw: () => { pen(); d.draw(); ctx.restore(); } });
      else {
        const n = Math.max(1, Math.round(b.h / SLICE));
        for (let i = 0; i < n; i++) {
          const a = y0 + (b.h * i) / n, c = y0 + (b.h * (i + 1)) / n, last = i === n - 1;
          out.push({ y: c - 0.02, layer: 1, draw: () => { self.block(ctx, cam, b, st, a, c, h, last, flash, frac, i); if (b.kind === "wall") { pen(); adobeTrim(ctx, cam, b, st, a, c, h, last); ctx.restore(); } } });
        }
      }
      if (breakable(b.kind) && frac < 0.999) out.push({ y: y1 - 0.01, layer: 1, draw: () => self.bar(ctx, cam, b, h, frac) });
    }
    return out;
  }
}

// ---------------------------------------------------------------- projected shapes
function poly(ctx: Ctx, cam: Camera, pts: P3[]) {
  ctx.beginPath();
  pts.forEach((p, i) => { const s = cam.project(p[0], p[1], p[2]); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
  ctx.closePath();
}
function paint(ctx: Ctx, fill: string, flash = 0, stroke = true) {
  ctx.fillStyle = fill; ctx.fill();
  if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.55})`; ctx.fill(); }
  if (stroke) ctx.stroke();
}
function seg(ctx: Ctx, cam: Camera, a: P3, b: P3, alpha = 1) {
  const p = cam.project(...a), q = cam.project(...b);
  ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.globalAlpha = 1;
}
/** A box: the side face toward the board's centre line, the face toward the player, the top. */
function box(ctx: Ctx, cam: Camera, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, c: { top: string; front: string; side: string }, flash: number) {
  if (x1 < W / 2) { poly(ctx, cam, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]); paint(ctx, c.side, flash); }
  else if (x0 > W / 2) { poly(ctx, cam, [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]); paint(ctx, c.side, flash); }
  poly(ctx, cam, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]); paint(ctx, c.front, flash);
  poly(ctx, cam, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]); paint(ctx, c.top, flash);
}
const rect = (ctx: Ctx, cam: Camera, xa: number, xb: number, y: number, za: number, zb: number) => poly(ctx, cam, [[xa, y, za], [xb, y, za], [xb, y, zb], [xa, y, zb]]);

/** A false-front store: a plank shed with a shingled roof behind a tall flat facade, a sign, a striped porch. */
function store(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, flash: number, grand: boolean) {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2, lw = ctx.lineWidth;
  const e = st.h * 0.78, F = st.h + (grand ? 0.62 : 0.46), ov = 0.05, dark = st.roofDark ?? st.side, lit = st.roofLit ?? st.top;
  const paintCol = st.paint ?? st.trim, sign = st.sign ?? st.top;
  // the shed and its roof, which leans down toward the back
  box(ctx, cam, x0, y0, x1, y1 - 0.04, 0, e, { top: lit, front: st.front, side: st.side }, flash);
  poly(ctx, cam, [[x0 - ov, y0 - ov, e - 0.12], [x1 + ov, y0 - ov, e - 0.12], [x1 + ov, y1, e + 0.1], [x0 - ov, y1, e + 0.1]]); paint(ctx, lit, flash);
  ctx.save(); ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.75, lw * 0.7);
  for (const t of [0.3, 0.62]) seg(ctx, cam, [x0 - ov, y0 + (y1 - y0) * t, e - 0.12 + 0.22 * t], [x1 + ov, y0 + (y1 - y0) * t, e - 0.12 + 0.22 * t], 0.7);
  ctx.restore();
  // the facade
  const fa = x0 - ov, fb = x1 + ov, cw = b.w * (grand ? 0.5 : 0.56);
  ctx.beginPath();
  const outline: P3[] = [[fa, y1, 0], [fb, y1, 0], [fb, y1, F], [b.x + cw / 2, y1, F], [b.x + cw / 2, y1, F + 0.2], [b.x - cw / 2, y1, F + 0.2], [b.x - cw / 2, y1, F], [fa, y1, F]];
  poly(ctx, cam, outline); paint(ctx, st.front, flash);
  // plank seams
  ctx.save(); ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(0.6, lw * 0.5);
  for (let z = 0.2; z < F - 0.02; z += 0.2) seg(ctx, cam, [fa, y1, z], [fb, y1, z], 0.28);
  ctx.restore();
  // cornices
  ctx.save(); ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(2.5, cam.scaleAt(y1) * 0.085);
  seg(ctx, cam, [b.x - cw / 2 - 0.04, y1, F + 0.2], [b.x + cw / 2 + 0.04, y1, F + 0.2]);
  ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(1.5, cam.scaleAt(y1) * 0.05);
  seg(ctx, cam, [b.x - cw / 2 - 0.04, y1, F + 0.2], [b.x + cw / 2 + 0.04, y1, F + 0.2]);
  ctx.restore();
  // the sign: a painted board with a row of woodtype
  const sw = Math.min(b.w * 0.8, b.w - 0.12), sz0 = F - 0.36, sz1 = F - 0.08;
  rect(ctx, cam, b.x - sw / 2, b.x + sw / 2, y1, sz0, sz1); paint(ctx, sign, flash);
  ctx.save(); ctx.strokeStyle = TERRAIN.ink; ctx.lineCap = "butt"; ctx.lineWidth = Math.max(1.5, cam.scaleAt(y1) * 0.07);
  const n = Math.max(3, Math.round(sw / 0.16));
  for (let i = 0; i < n; i++) { if (hash(i, b.id) < 0.18) continue; const x = b.x - sw / 2 + ((i + 0.5) / n) * sw; seg(ctx, cam, [x, y1, sz0 + 0.07], [x, y1, sz1 - 0.07 - 0.04 * hash(b.id, i)], 0.85); }
  ctx.restore();
  // door and windows under the porch
  const dw = Math.min(0.3, b.w * 0.22);
  rect(ctx, cam, b.x - dw / 2, b.x + dw / 2, y1, 0, 0.5); paint(ctx, st.trim, 0);
  if (b.w > 1.1) for (const s of [-1, 1]) { const wx = b.x + s * b.w * 0.3, ww = Math.min(0.26, b.w * 0.16); rect(ctx, cam, wx - ww / 2, wx + ww / 2, y1, 0.2, 0.48); paint(ctx, st.glow ?? st.top, 0); }
  if (grand) for (const s of [-1, 0, 1]) { const wx = b.x + s * b.w * 0.3, ww = Math.min(0.22, b.w * 0.13); rect(ctx, cam, wx - ww / 2, wx + ww / 2, y1, 0.86, 1.1); paint(ctx, st.glow ?? st.top, 0); }
  // the porch: posts, then the awning in stripes
  const az = 0.72, ay = y1 + 0.3, posts = Math.max(2, Math.round(b.w / 0.7));
  ctx.save(); ctx.lineCap = "round";
  for (let i = 0; i <= posts; i++) { const x = fa + 0.04 + (i / posts) * (fb - fa - 0.08); ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(2.5, cam.scaleAt(ay) * 0.075); seg(ctx, cam, [x, ay - 0.03, 0], [x, ay - 0.03, az - 0.12]); ctx.strokeStyle = st.side; ctx.lineWidth = Math.max(1.2, cam.scaleAt(ay) * 0.04); seg(ctx, cam, [x, ay - 0.03, 0], [x, ay - 0.03, az - 0.12]); }
  ctx.restore();
  const stripes = Math.max(4, Math.round((fb - fa) / 0.22));
  for (let i = 0; i < stripes; i++) { const xa = fa + (i / stripes) * (fb - fa), xb = fa + ((i + 1) / stripes) * (fb - fa); poly(ctx, cam, [[xa, y1, az], [xb, y1, az], [xb, ay, az - 0.12], [xa, ay, az - 0.12]]); paint(ctx, i % 2 ? sign : paintCol, flash, false); }
  poly(ctx, cam, [[fa, y1, az], [fb, y1, az], [fb, ay, az - 0.12], [fa, ay, az - 0.12]]); ctx.stroke();
}

/** A water tower: four braced legs, a banded plank tank, a shingled cap, a spout toward the middle of the board. */
function waterTower(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, flash: number) {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2, lw = ctx.lineWidth;
  const leg = st.h * 0.42, top = st.h * 0.82, in0 = 0.06, k = 0.8;
  const legs: [number, number][] = [[x0 + in0, y0 + in0], [x1 - in0, y0 + in0], [x0 + in0, y1 - in0], [x1 - in0, y1 - in0]];
  const stroke2 = (a: P3, c: P3, w: number, col: string) => { ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(2.5, cam.scaleAt(y1) * (w + 0.04)); seg(ctx, cam, a, c); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.2, cam.scaleAt(y1) * w); seg(ctx, cam, a, c); };
  ctx.save(); ctx.lineCap = "round";
  legs.forEach(([x, y], i) => stroke2([x, y, 0], [b.x + (x - b.x) * k, b.y + (y - b.y) * k, leg], 0.07, i < 2 ? st.side : st.front));
  stroke2([legs[2][0], legs[2][1], 0.12], [b.x + (legs[3][0] - b.x) * k, legs[3][1], leg - 0.06], 0.035, st.side);
  stroke2([legs[3][0], legs[3][1], 0.12], [b.x + (legs[2][0] - b.x) * k, legs[2][1], leg - 0.06], 0.035, st.side);
  ctx.restore();
  ctx.lineWidth = lw; ctx.strokeStyle = TERRAIN.ink;
  // the deck and the tank
  box(ctx, cam, x0, y0, x1, y1, leg - 0.06, leg, { top: st.side, front: st.side, side: st.side }, flash);
  const tx0 = x0 + 0.05, tx1 = x1 - 0.05, ty0 = y0 + 0.05, ty1 = y1 - 0.05;
  box(ctx, cam, tx0, ty0, tx1, ty1, leg, top, st, flash);
  ctx.save(); ctx.strokeStyle = st.side; ctx.lineWidth = Math.max(0.6, lw * 0.5);
  const staves = Math.max(3, Math.round((tx1 - tx0) / 0.16));
  for (let i = 1; i < staves; i++) seg(ctx, cam, [tx0 + ((tx1 - tx0) * i) / staves, ty1, leg], [tx0 + ((tx1 - tx0) * i) / staves, ty1, top], 0.5);
  ctx.restore();
  rect(ctx, cam, tx0, tx1, ty1, leg + (top - leg) * 0.36, leg + (top - leg) * 0.64); paint(ctx, st.paint ?? st.trim, flash, false);
  ctx.save(); ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(1.5, cam.scaleAt(y1) * 0.05);
  for (const t of [0.18, 0.82]) seg(ctx, cam, [tx0, ty1, leg + (top - leg) * t], [tx1, ty1, leg + (top - leg) * t]);
  ctx.restore();
  // the cap
  const o = 0.07, apex: P3 = [b.x, b.y, top + Math.max(b.w, b.h) * 0.6], lit = st.roofLit ?? st.top, dark = st.roofDark ?? st.side;
  const face = (a: P3, c: P3, fill: string) => { poly(ctx, cam, [a, c, apex]); paint(ctx, fill, flash); };
  face([x0 - o, y0 - o, top], [x1 + o, y0 - o, top], dark);
  if (b.x < W / 2) { face([x0 - o, y0 - o, top], [x0 - o, y1 + o, top], dark); face([x1 + o, y0 - o, top], [x1 + o, y1 + o, top], dark); }
  else { face([x1 + o, y0 - o, top], [x1 + o, y1 + o, top], dark); face([x0 - o, y0 - o, top], [x0 - o, y1 + o, top], lit); }
  face([x0 - o, y1 + o, top], [x1 + o, y1 + o, top], lit);
  // the spout
  const s = b.x < W / 2 ? 1 : -1, sx = s > 0 ? tx1 : tx0;
  ctx.save(); ctx.lineCap = "round"; stroke2([sx, b.y, leg + 0.1], [sx + s * 0.34, b.y, leg - 0.28], 0.05, st.trim); ctx.restore();
}

/** Hay bales stacked along the block's long side: a second course while the barricade is still mostly whole. */
function bales(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, h: number, flash: number, frac: number): Drawable[] {
  const x0 = b.x - b.w / 2, y0 = b.y - b.h / 2, alongX = b.w >= b.h, len = alongX ? b.w : b.h;
  const n = Math.max(1, Math.round(len / 0.62)), bl = len / n, g = 0.025, out: Drawable[] = [];
  const bale = (xa: number, ya: number, xb: number, yb: number, z0: number, z1: number, id: number) => {
    box(ctx, cam, xa, ya, xb, yb, z0, z1, st, flash);
    ctx.save(); ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(0.75, cam.scaleAt(yb) * 0.03);
    // twine twice round, a few stray straws
    const across = xb - xa >= yb - ya;
    for (const t of [0.3, 0.7]) {
      if (across) { const x = xa + (xb - xa) * t; seg(ctx, cam, [x, ya, z1], [x, yb, z1], 0.8); seg(ctx, cam, [x, yb, z1], [x, yb, z0], 0.8); }
      else { const y = ya + (yb - ya) * t; seg(ctx, cam, [xa, y, z1], [xb, y, z1], 0.8); }
    }
    ctx.strokeStyle = st.side;
    for (let i = 0; i < 3; i++) { const x = xa + (xb - xa) * (0.15 + 0.7 * hash(id, i)), z = z0 + (z1 - z0) * (0.2 + 0.6 * hash(i, id)); seg(ctx, cam, [x, yb, z], [x + 0.08, yb, z + 0.02], 0.7); }
    ctx.restore();
  };
  const z1 = Math.min(h, 0.46), second = frac > 0.55;
  for (let i = 0; i < n; i++) {
    const a = i * bl + g, c = (i + 1) * bl - g;
    const xa = alongX ? x0 + a : x0, xb = alongX ? x0 + c : x0 + b.w, ya = alongX ? y0 : y0 + a, yb = alongX ? y0 + b.h : y0 + c;
    // draw the bale nearest the board's centre line last along a row, so side faces overlap correctly
    const order = alongX ? -Math.abs((xa + xb) / 2 - W / 2) * 0.001 : 0;
    out.push({ y: yb - 0.02 + order, layer: 1, draw: () => bale(xa, ya, xb, yb, 0, z1, b.id * 7 + i) });
    if (second && i < n - 1 + (n === 1 ? 1 : 0) && hash(b.id, i + 3) > 0.25) {
      const sh = bl * 0.5, ins = 0.05;
      const ua = alongX ? xa + sh : xa + ins, ub = alongX ? xb + sh : xb - ins, va = alongX ? ya + ins : ya + sh, vb = alongX ? yb - ins : yb + sh;
      if (n === 1) out.push({ y: yb - 0.015, layer: 1, draw: () => bale(xa + ins * 2, ya + ins, xb - ins * 2, yb - ins, z1, z1 + 0.36, b.id * 11 + i) });
      else out.push({ y: (alongX ? yb : vb) - 0.015 + order, layer: 1, draw: () => bale(ua, va, ub, vb, z1, z1 + 0.4, b.id * 11 + i) });
    }
  }
  return out;
}

/** Barrels on end, with the odd crate among them. */
function barrels(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, h: number, flash: number): Drawable[] {
  const x0 = b.x - b.w / 2, y0 = b.y - b.h / 2, cols = Math.max(1, Math.round(b.w / 0.46)), rows = Math.max(1, Math.round(b.h / 0.46));
  const cw = b.w / cols, ch = b.h / rows, out: Drawable[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = x0 + (c + 0.5) * cw, cy = y0 + (r + 0.5) * ch, k = hash(c + b.id * 3, r), rad = Math.min(cw, ch) * 0.46, hh = h * (0.85 + k * 0.4);
    const order = -Math.abs(cx - W / 2) * 0.001;
    if (k > 0.72) out.push({ y: cy + ch / 2 - 0.02 + order, layer: 1, draw: () => {
      box(ctx, cam, cx - cw / 2 + 0.03, cy - ch / 2 + 0.03, cx + cw / 2 - 0.03, cy + ch / 2 - 0.03, 0, hh * 0.9, { top: st.top, front: "#c79a62", side: "#a87a44" }, flash);
      ctx.save(); ctx.strokeStyle = "#7a5630"; ctx.lineWidth = Math.max(0.75, cam.scaleAt(cy) * 0.025);
      seg(ctx, cam, [cx - cw / 2 + 0.03, cy + ch / 2 - 0.03, 0], [cx + cw / 2 - 0.03, cy + ch / 2 - 0.03, hh * 0.9], 0.7); seg(ctx, cam, [cx + cw / 2 - 0.03, cy + ch / 2 - 0.03, 0], [cx - cw / 2 + 0.03, cy + ch / 2 - 0.03, hh * 0.9], 0.7);
      ctx.restore();
    } });
    else out.push({ y: cy + rad - 0.02 + order, layer: 1, draw: () => barrel(ctx, cam, cx, cy, rad, hh, st, flash, k > 0.36) });
  }
  return out;
}
function barrel(ctx: Ctx, cam: Camera, x: number, y: number, r: number, h: number, st: LookStyle, flash: number, lidOff: boolean) {
  // the body: a bulging silhouette between the ground circle and the top circle
  const ring = (z: number, k: number, a0: number, a1: number, first: boolean) => { for (let i = 0; i <= 12; i++) { const a = a0 + ((a1 - a0) * i) / 12, p = cam.project(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k, z); first && i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); } };
  ctx.beginPath(); ring(0, 0.84, Math.PI, 0, true);
  for (const [z, k] of [[h * 0.3, 1], [h * 0.7, 1], [h, 0.84]]) { const p = cam.project(x + r * k, y, z); ctx.lineTo(p.x, p.y); }
  ring(h, 0.84, 0, -Math.PI, false);
  for (const [z, k] of [[h * 0.7, 1], [h * 0.3, 1]]) { const p = cam.project(x - r * k, y, z); ctx.lineTo(p.x, p.y); }
  ctx.closePath(); paint(ctx, st.front, flash);
  // staves, hoops
  ctx.save(); ctx.strokeStyle = st.side; ctx.lineWidth = Math.max(0.6, ctx.lineWidth * 0.5);
  for (const a of [0.5, 1.05, 1.57, 2.1, 2.64]) seg(ctx, cam, [x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, 0.02], [x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, h - 0.02], 0.55);
  ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(1.5, cam.scaleAt(y) * 0.045);
  for (const z of [h * 0.24, h * 0.76]) { ctx.beginPath(); ring(z, 0.98, Math.PI, 0, true); ctx.stroke(); }
  ctx.restore();
  // the top: a lid, or the dark inside of an open barrel
  ctx.beginPath(); ring(h, 0.84, 0, Math.PI * 2, true); ctx.closePath(); paint(ctx, st.top, flash);
  if (lidOff) { ctx.beginPath(); ring(h - 0.02, 0.66, 0, Math.PI * 2, true); ctx.closePath(); paint(ctx, "#5f3d20", 0, false); }
}

/** Adobe: a lighter rounded lip along the top and roof beams poking out of the face toward the player. */
function adobeTrim(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, y0: number, y1: number, h: number, last: boolean) {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2;
  ctx.save();
  ctx.strokeStyle = "rgba(255,246,220,0.55)"; ctx.lineWidth = Math.max(1, cam.scaleAt(y1) * 0.04);
  seg(ctx, cam, [x0 + 0.03, y0, h], [x0 + 0.03, y1, h]); seg(ctx, cam, [x1 - 0.03, y0, h], [x1 - 0.03, y1, h]);
  if (last) {
    const n = Math.max(1, Math.round(b.w / 0.5));
    for (let i = 0; i < n; i++) {
      const p = cam.project(x0 + ((i + 0.5) / n) * b.w, y1, h - 0.17), r = Math.max(1.5, p.s * 0.05);
      ctx.beginPath(); ctx.arc(p.x, p.y + r * 0.5, r * 1.1, 0, 6.3); ctx.fillStyle = "rgba(60,30,14,0.35)"; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.fillStyle = st.trim; ctx.fill(); ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(0.75, p.s * 0.02); ctx.stroke();
    }
    // weathering: a crack and a patch where the plaster has gone
    ctx.strokeStyle = st.trim; ctx.lineWidth = Math.max(0.75, cam.scaleAt(y1) * 0.02);
    const cx = x0 + b.w * (0.25 + 0.5 * hash(b.id, 2));
    seg(ctx, cam, [cx, y1, h * 0.55], [cx + 0.06, y1, h * 0.3], 0.6); seg(ctx, cam, [cx + 0.06, y1, h * 0.3], [cx + 0.01, y1, h * 0.08], 0.6);
  }
  ctx.restore();
}
