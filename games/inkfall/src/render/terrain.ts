// Inkfall's Arena buildings. The base renderer builds every block from game/terrain.ts and draws a plain gable or a
// pyramid on the roofed ones; that file cannot ask for a timber frame, an upswept ridge or a second roof. So the two
// roof painters of the base TerrainLayer are replaced here (everything else is the base class, untouched):
//   gable  a plaster wall with black posts and a rail, paper windows, and a deep roof with a heavy ink ridge that
//          turns up at both ends; thatch is flecked with short strokes, tile is ruled in courses
//   cone   a pagoda: a wide lower roof, a short second storey, a steep upper roof and a spire
import { W } from "@engine/core/defs";
import type { Block } from "@engine/core/terrain";
import type { Camera } from "@base/render/camera";
import { TerrainLayer } from "@base/render/terrain";
import { TERRAIN, type LookStyle } from "../game/terrain";

export * from "@base/render/terrain";

type Ctx = CanvasRenderingContext2D;
type P3 = [number, number, number];
const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

function poly(ctx: Ctx, cam: Camera, pts: P3[]) {
  ctx.beginPath();
  pts.forEach((p, i) => { const s = cam.project(p[0], p[1], p[2]); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
  ctx.closePath();
}
function line(ctx: Ctx, cam: Camera, a: P3, b: P3, alpha = 1) {
  const p = cam.project(...a), q = cam.project(...b);
  ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.globalAlpha = 1;
}
const lerp3 = (a: P3, b: P3, t: number): P3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Is this roof thatch (a warm colour) rather than tile (a grey)? */
const isThatch = (hex: string) => { const r = parseInt(hex.slice(1, 3), 16), b = parseInt(hex.slice(5, 7), 16); return r - b > 40; };

/** The timber frame on a wall face that looks at the player: posts, a rail under the eaves, a door and paper windows. */
function frame(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, e: number, lw: number) {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y1 = b.y + b.h / 2;
  ctx.save();
  ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(1, lw * 1.25);
  const n = Math.max(2, Math.round(b.w / 0.5));
  for (let i = 0; i <= n; i++) { const x = x0 + (b.w * i) / n; line(ctx, cam, [x, y1, 0], [x, y1, e]); }
  line(ctx, cam, [x0, y1, e * 0.62], [x1, y1, e * 0.62], 0.9);
  if (st.detail === "house") {
    const dw = Math.min(0.3, b.w * 0.2);
    poly(ctx, cam, [[b.x - dw / 2, y1, 0], [b.x + dw / 2, y1, 0], [b.x + dw / 2, y1, e * 0.62], [b.x - dw / 2, y1, e * 0.62]]);
    ctx.fillStyle = TERRAIN.ink; ctx.fill();
    if (b.w > 1.1) for (const s of [-1, 1]) {
      const wx = b.x + s * b.w * 0.3, ww = Math.min(0.26, b.w * 0.14);
      poly(ctx, cam, [[wx - ww / 2, y1, e * 0.2], [wx + ww / 2, y1, e * 0.2], [wx + ww / 2, y1, e * 0.58], [wx - ww / 2, y1, e * 0.58]]);
      ctx.fillStyle = st.glow ?? st.top; ctx.fill(); ctx.lineWidth = Math.max(0.75, lw * 0.7); ctx.stroke();
      line(ctx, cam, [wx, y1, e * 0.2], [wx, y1, e * 0.58], 0.8); line(ctx, cam, [wx - ww / 2, y1, e * 0.39], [wx + ww / 2, y1, e * 0.39], 0.8);
    }
  }
  ctx.restore();
}
/** Courses of tile or flecks of thatch over a slope given by its four corners (eave left, eave right, ridge right, ridge left). */
function cover(ctx: Ctx, cam: Camera, q: [P3, P3, P3, P3], thatch: boolean, color: string, lw: number, seed: number) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineCap = "round";
  if (thatch) {
    ctx.lineWidth = Math.max(0.75, lw * 0.6);
    const n = Math.round(14 + 10 * Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]));
    for (let i = 0; i < n; i++) {
      const u = hash(i, seed), v = 0.08 + 0.8 * hash(seed, i + 3);
      const a = lerp3(lerp3(q[0], q[1], u), lerp3(q[3], q[2], u), v), c = lerp3(lerp3(q[0], q[1], u), lerp3(q[3], q[2], u), Math.max(0, v - 0.14));
      line(ctx, cam, a, c, 0.5);
    }
  } else {
    ctx.lineWidth = Math.max(0.75, lw * 0.65);
    for (const t of [0.25, 0.5, 0.75]) line(ctx, cam, lerp3(q[0], q[3], t), lerp3(q[1], q[2], t), 0.6);
    const n = Math.max(3, Math.round(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) / 0.2));
    for (let i = 1; i < n; i++) line(ctx, cam, lerp3(q[0], q[1], i / n), lerp3(q[3], q[2], i / n), 0.28);
  }
  ctx.restore();
}
/** A heavy ridge from a to c that sweeps up at both ends. */
function ridgeLine(ctx: Ctx, cam: Camera, a: P3, c: P3, lw: number, up = 0.14) {
  const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1, ex = (dx / l) * 0.14, ey = (dy / l) * 0.14;
  const pts: P3[] = [[a[0] - ex, a[1] - ey, a[2] + up], a, c, [c[0] + ex, c[1] + ey, c[2] + up]];
  ctx.save();
  ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(2, lw * 2.6); ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); pts.forEach((p, i) => { const s = cam.project(...p); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }); ctx.stroke();
  ctx.restore();
}

interface Patched { gable(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, e: number, h: number, flash: number, lw: number): void; cone(ctx: Ctx, cam: Camera, b: Block, st: LookStyle, e: number, flash: number, lw: number): void }
const proto = TerrainLayer.prototype as unknown as Patched;

proto.gable = function (ctx, cam, b, st, e, h, flash, lw) {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
  const o = 0.16, ridge = e + Math.max(0.36, h * 0.6), lit = st.roofLit ?? st.top, dark = st.roofDark ?? st.side, thatch = isThatch(lit);
  const face = (pts: P3[], fill: string) => { poly(ctx, cam, pts); ctx.fillStyle = fill; ctx.fill(); if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.55})`; ctx.fill(); } ctx.stroke(); };
  ctx.lineWidth = lw; ctx.strokeStyle = TERRAIN.ink;
  frame(ctx, cam, b, st, e, lw);
  if (b.w >= b.h) {
    // the ridge runs across: far slope, the gable end on the visible side, then the near slope
    face([[x0 - o, y0 - o, e], [x1 + o, y0 - o, e], [x1 + o * 0.4, b.y, ridge], [x0 - o * 0.4, b.y, ridge]], dark);
    const sx = b.x < W / 2 ? x1 : x0;
    face([[sx, y0, e], [sx, y1, e], [sx, b.y, ridge - 0.04]], st.side);
    const near: [P3, P3, P3, P3] = [[x0 - o, y1 + o, e - 0.07], [x1 + o, y1 + o, e - 0.07], [x1 + o * 0.4, b.y, ridge], [x0 - o * 0.4, b.y, ridge]];
    face(near, lit);
    cover(ctx, cam, near, thatch, dark, lw, b.id);
    ridgeLine(ctx, cam, [x0 - o * 0.4, b.y, ridge], [x1 + o * 0.4, b.y, ridge], lw);
  } else {
    // the ridge runs toward the player: the gable end faces front, the slopes fall left and right
    face([[x0, y1, e], [x1, y1, e], [b.x, y1, ridge - 0.04]], st.front);
    const L: [P3, P3, P3, P3] = [[x0 - o, y0 - o, e - 0.07], [x0 - o, y1 + o, e - 0.07], [b.x, y1 + o * 0.4, ridge], [b.x, y0 - o * 0.4, ridge]];
    const R: [P3, P3, P3, P3] = [[x1 + o, y1 + o, e - 0.07], [x1 + o, y0 - o, e - 0.07], [b.x, y0 - o * 0.4, ridge], [b.x, y1 + o * 0.4, ridge]];
    const leftFirst = b.x >= W / 2;
    if (leftFirst) { face(R, dark); face(L, lit); cover(ctx, cam, L, thatch, dark, lw, b.id); } else { face(L, lit); cover(ctx, cam, L, thatch, dark, lw, b.id); face(R, dark); }
    ridgeLine(ctx, cam, [b.x, y0 - o * 0.4, ridge], [b.x, y1 + o * 0.4, ridge], lw);
  }
};

proto.cone = function (ctx, cam, b, st, e, flash, lw) {
  const lit = st.roofLit ?? st.top, dark = st.roofDark ?? st.side, half = Math.max(b.w, b.h) / 2;
  ctx.lineWidth = lw; ctx.strokeStyle = TERRAIN.ink;
  frame(ctx, cam, b, st, e, lw);
  const face = (pts: P3[], fill: string) => { poly(ctx, cam, pts); ctx.fillStyle = fill; ctx.fill(); if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.55})`; ctx.fill(); } ctx.stroke(); };
  /** One hipped roof: eave half-width `a` at height z0, top half-width `c` at z1 (0 = a point). Corners turn up. */
  const roof = (a: number, z0: number, c: number, z1: number, seed: number) => {
    const E = (sx: number, sy: number): P3 => [b.x + sx * a, b.y + sy * a, z0], T = (sx: number, sy: number): P3 => [b.x + sx * c, b.y + sy * c, z1];
    face([E(-1, -1), E(1, -1), T(1, -1), T(-1, -1)], dark);
    const sd = b.x < W / 2 ? 1 : -1;
    face([E(-sd, -1), E(-sd, 1), T(-sd, 1), T(-sd, -1)], dark);
    face([E(sd, -1), E(sd, 1), T(sd, 1), T(sd, -1)], sd > 0 ? dark : lit);
    const near: [P3, P3, P3, P3] = [E(-1, 1), E(1, 1), T(1, 1), T(-1, 1)];
    face(near, lit);
    cover(ctx, cam, near, false, dark, lw, seed);
    // upswept corners: a short heavy stroke off each near corner
    ctx.save(); ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(1.5, lw * 2); ctx.lineCap = "round";
    for (const sx of [-1, 1]) line(ctx, cam, lerp3(T(sx, 1), E(sx, 1), 0.7), [b.x + sx * (a + 0.1), b.y + a + 0.06, z0 + 0.14]);
    ctx.restore();
  };
  const z1 = e + half * 0.32;
  roof(half + 0.2, e - 0.04, half * 0.5, z1, b.id);
  // the second storey
  const s = half * 0.5, z2 = z1 + 0.3;
  face([[b.x - s, b.y + s, z1], [b.x + s, b.y + s, z1], [b.x + s, b.y + s, z2], [b.x - s, b.y + s, z2]], st.front);
  const sx = b.x < W / 2 ? 1 : -1;
  face([[b.x + sx * s, b.y - s, z1], [b.x + sx * s, b.y + s, z1], [b.x + sx * s, b.y + s, z2], [b.x + sx * s, b.y - s, z2]], st.side);
  if (st.glow) { poly(ctx, cam, [[b.x - 0.06, b.y + s, z1 + 0.06], [b.x + 0.06, b.y + s, z1 + 0.06], [b.x + 0.06, b.y + s, z2 - 0.06], [b.x - 0.06, b.y + s, z2 - 0.06]]); ctx.fillStyle = st.glow; ctx.fill(); ctx.stroke(); }
  roof(s + 0.18, z2 - 0.03, 0.02, z2 + half * 0.7, b.id + 7);
  // the spire
  ctx.save(); ctx.strokeStyle = TERRAIN.ink; ctx.lineWidth = Math.max(1.5, lw * 1.8); ctx.lineCap = "round";
  line(ctx, cam, [b.x, b.y, z2 + half * 0.7], [b.x, b.y, z2 + half * 0.7 + 0.34]);
  ctx.restore();
};
