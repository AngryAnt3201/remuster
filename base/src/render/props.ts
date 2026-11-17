// The set: every building, wall, piece of cover, tree and prop a level is made of, built as real geometry (kit3d.ts)
// from the game's materials (../game/terrain.ts). One builder per `look` (engine/core/arena.ts lists them); a look
// this file doesn't know falls back on its block kind. A game that wants a new shape shadows this file, imports the
// original as @base/render/props and adds to BUILDERS.
import { H, W } from "@engine/core/defs";
import type { Block } from "@engine/core/terrain";
import type { ArenaMark } from "@engine/core/arena";
import { Mesh, type Face, type P3 } from "./kit3d";
import { TERRAIN, type Roof, type WorldStyle } from "../game/terrain";

export interface Rc { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number; w: number; d: number; }
export interface Built { mesh: Mesh; /** moving parts, rebuilt every frame */ anim?: (t: number) => Face[]; h: number; }
type Rnd = () => number;
type Builder = (m: Mesh, r: Rc, S: WorldStyle, rnd: Rnd, look: string) => void | ((t: number) => Face[]);
type Side = "x0" | "x1" | "y0" | "y1";

export const rcOf = (b: { x: number; y: number; w: number; h: number }): Rc => ({ x0: b.x - b.w / 2, y0: b.y - b.h / 2, x1: b.x + b.w / 2, y1: b.y + b.h / 2, cx: b.x, cy: b.y, w: b.w, d: b.h });
export function seeded(seed: number): Rnd { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const lookOf = (S: WorldStyle, look: string) => S.looks?.[look] ?? {};

/** The side of a footprint that faces the middle of the board (where its door goes). */
function frontOf(r: Rc): Side {
  if (r.w >= r.d) return r.cy <= H / 2 ? "y1" : "y0";
  return r.cx <= W / 2 ? "x1" : "x0";
}
/** A point along a side (t 0..1) at height z, and the side's outward normal. */
function onSide(r: Rc, s: Side, t: number, z: number): P3 {
  if (s === "y0") return [r.x0 + r.w * t, r.y0, z];
  if (s === "y1") return [r.x0 + r.w * t, r.y1, z];
  if (s === "x0") return [r.x0, r.y0 + r.d * t, z];
  return [r.x1, r.y0 + r.d * t, z];
}
const OUT: Record<Side, P3> = { x0: [-1, 0, 0], x1: [1, 0, 0], y0: [0, -1, 0], y1: [0, 1, 0] };
const lenOf = (r: Rc, s: Side) => (s === "y0" || s === "y1" ? r.w : r.d);
/** A decal on a side: centred at fraction t, `w` wide, from z0 up `h`. */
function onWall(m: Mesh, r: Rc, s: Side, t: number, w: number, z0: number, h: number, c: string, o: Partial<Face> = {}) {
  const L = lenOf(r, s), dt = w / 2 / L;
  m.decal(onSide(r, s, t - dt, z0), onSide(r, s, t + dt, z0), h, c, OUT[s], o);
}

function roofOn(m: Mesh, r: Rc, z: number, kind: Roof, c: string, S: WorldStyle, ov = 0.08, steep = 1) {
  const x0 = r.x0 - ov, y0 = r.y0 - ov, x1 = r.x1 + ov, y1 = r.y1 + ov, half = Math.min(r.w, r.d) / 2;
  if (kind === "gable") m.gable(x0, y0, x1, y1, z, half * 0.95 * steep, c, r.w >= r.d ? "x" : "y", S.mat.plaster2);
  else if (kind === "hip") m.hip(x0, y0, x1, y1, z, half * 0.85 * steep, c);
  else if (kind === "flat") {
    m.box(x0, y0, z, x1, y1, z + 0.09, c);
    m.box(r.cx - r.w * 0.22, r.cy - r.d * 0.22, z + 0.09, r.cx + r.w * 0.12, r.cy + r.d * 0.12, z + 0.26, S.mat.stoneDark, c);
  } else if (kind === "dome") {
    const R = half + ov * 0.5;
    m.prism(r.cx, r.cy, z, z + 0.07, R * 1.05, 8, S.mat.stoneDark);
    m.prism(r.cx, r.cy, z + 0.07, z + R * 0.5, R, 8, c, R * 0.78); m.prism(r.cx, r.cy, z + R * 0.5, z + R * 0.85, R * 0.78, 8, c, R * 0.36);
    m.prism(r.cx, r.cy, z + R * 0.85, z + R * 1.2, R * 0.1, 5, S.mat.metal, 0);
  } else if (kind === "pagoda") {
    m.hip(x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.1, z, half * 0.3, c, 0.5);
    m.box(r.cx - r.w * 0.27, r.cy - r.d * 0.27, z + half * 0.3, r.cx + r.w * 0.27, r.cy + r.d * 0.27, z + half * 0.3 + 0.2, S.mat.plaster);
    m.hip(r.cx - r.w * 0.36, r.cy - r.d * 0.36, r.cx + r.w * 0.36, r.cy + r.d * 0.36, z + half * 0.3 + 0.2, half * 0.5, c);
  } else { // barrel: a half-pipe along the long side
    const n = 5, alongX = r.w >= r.d, hw = (alongX ? r.d : r.w) / 2 + ov, rise = hw * 0.8;
    const pt = (a: number, end: number): P3 => { const o = Math.cos(a) * hw, zz = z + Math.sin(a) * rise; return alongX ? [end, r.cy + o, zz] : [r.cx + o, end, zz]; };
    const e0 = alongX ? x0 : y0, e1 = alongX ? x1 : y1, mid: P3 = [r.cx, r.cy, z];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI, b = ((i + 1) / n) * Math.PI; m.face([pt(a, e0), pt(a, e1), pt(b, e1), pt(b, e0)], c, mid); }
    for (const e of [e0, e1]) m.face(Array.from({ length: n + 1 }, (_, i) => pt((i / n) * Math.PI, e)), S.mat.metal, mid);
  }
}

/** A house body with a door, lit windows and a roof. */
function houseLike(m: Mesh, r: Rc, S: WorldStyle, rnd: Rnd, o: { h: number; wall: string; roof: Roof; roofC: string; door?: number; chimney?: boolean; steep?: number; beams?: boolean }) {
  const { h } = o, f = frontOf(r);
  m.box(r.x0, r.y0, 0, r.x1, r.y1, h, o.wall);
  m.box(r.x0 - 0.02, r.y0 - 0.02, 0, r.x1 + 0.02, r.y1 + 0.02, 0.1, S.mat.stoneDark); // footing
  const dw = o.door ?? 0.26, L = lenOf(r, f), dt = L > 1.2 ? 0.5 : 0.36;
  onWall(m, r, f, dt, dw, 0, Math.min(h * 0.62, 0.5), S.mat.door);
  const win = (s: Side, t: number) => { onWall(m, r, s, t, 0.2, h * 0.42, 0.2, S.mat.timberDark, { ink: false }); onWall(m, r, s, t, 0.14, h * 0.42 + 0.03, 0.14, S.mat.glow, { flat: true, ink: false, bias: 0.12 }); };
  for (const s of ["x0", "x1", "y0", "y1"] as Side[]) {
    const n = Math.max(1, Math.round(lenOf(r, s) / 0.75));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; if (s === f && Math.abs(t - dt) * lenOf(r, s) < dw / 2 + 0.2) continue; win(s, t); }
  }
  if (o.beams) for (const s of ["x0", "x1", "y0", "y1"] as Side[]) onWall(m, r, s, 0.5, lenOf(r, s), h * 0.86, 0.06, S.mat.timberDark, { ink: false });
  roofOn(m, r, h, o.roof, o.roofC, S, 0.09, o.steep ?? 1);
  if (o.chimney && (o.roof === "gable" || o.roof === "hip")) {
    const x = r.cx + (rnd() - 0.5) * r.w * 0.4, y = r.cy + (rnd() - 0.5) * r.d * 0.3;
    m.box(x - 0.08, y - 0.08, h, x + 0.08, y + 0.08, h + Math.min(r.w, r.d) * 0.5 + 0.12, S.mat.stoneDark);
  }
}

/** Crenellations along the top of a box. */
function crenels(m: Mesh, r: Rc, z: number, c: string, size = 0.2) {
  const along = (x: boolean, fixed0: number, fixed1: number, a0: number, a1: number) => {
    const n = Math.max(2, Math.round((a1 - a0) / (size * 2)));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.25) / n) * (a1 - a0), b = a + ((a1 - a0) / n) * 0.5;
      if (x) m.box(a, fixed0, z, b, fixed1, z + size * 0.8, c); else m.box(fixed0, a, z, fixed1, b, z + size * 0.8, c);
    }
  };
  if (r.w >= r.d) along(true, r.y0, r.y1, r.x0, r.x1); else along(false, r.x0, r.x1, r.y0, r.y1);
}

// ------------------------------------------------------------------------------------------------ trees, lamps
export function tree(m: Mesh, x: number, y: number, s: number, S: WorldStyle, rnd: Rnd, kind = S.tree) {
  const M = S.mat, f = rnd() > 0.5 ? M.foliage : M.foliage2;
  if (kind === "round" || kind === "blossom") {
    const c = kind === "blossom" ? (rnd() > 0.35 ? M.foliage2 : M.foliage) : f;
    m.prism(x, y, 0, 0.5 * s, 0.07 * s, 5, M.trunk, 0.05 * s);
    m.blob(x, y, 0.82 * s, 0.42 * s, c, 6, 0.9, { ink: false });
    m.blob(x + 0.2 * s * (rnd() - 0.5), y + 0.2 * s * (rnd() - 0.5), 1.18 * s, 0.3 * s, c, 5, 0.9, { ink: false });
  } else if (kind === "pine") {
    m.prism(x, y, 0, 0.3 * s, 0.06 * s, 5, M.trunk);
    for (let i = 0; i < 3; i++) m.prism(x, y, (0.25 + i * 0.36) * s, (0.25 + i * 0.36 + 0.55) * s, (0.4 - i * 0.1) * s, 6, f, 0, f, i * 0.4);
  } else if (kind === "palm") {
    const lean = (rnd() - 0.5) * 0.3;
    for (let i = 0; i < 4; i++) m.prism(x + lean * i * 0.25 * s, y, i * 0.32 * s, (i + 1) * 0.32 * s, 0.06 * s, 5, M.trunk, 0.05 * s);
    const tx = x + lean * s, tz = 1.28 * s;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + rnd(), dx = Math.cos(a), dy = Math.sin(a); m.panel([[tx, y, tz], [tx + dx * 0.35 * s - dy * 0.1 * s, y + dy * 0.35 * s + dx * 0.1 * s, tz + 0.08 * s], [tx + dx * 0.7 * s, y + dy * 0.7 * s, tz - 0.22 * s], [tx + dx * 0.35 * s + dy * 0.1 * s, y + dy * 0.35 * s - dx * 0.1 * s, tz + 0.08 * s]], f, { ink: false }); }
  } else if (kind === "cactus") {
    m.prism(x, y, 0, 0.95 * s, 0.11 * s, 6, f, 0.09 * s);
    const a = rnd() * Math.PI, dx = Math.cos(a) * 0.24 * s, dy = Math.sin(a) * 0.24 * s;
    m.box(x + dx - 0.05 * s, y + dy - 0.05 * s, 0.38 * s, x + dx + 0.05 * s, y + dy + 0.05 * s, 0.75 * s, f); m.box(Math.min(x, x + dx), Math.min(y, y + dy) - 0.04 * s, 0.38 * s, Math.max(x, x + dx), Math.max(y, y + dy) + 0.04 * s, 0.47 * s, f);
    m.box(x - dx - 0.05 * s, y - dy - 0.05 * s, 0.5 * s, x - dx + 0.05 * s, y - dy + 0.05 * s, 0.82 * s, f);
  } else if (kind === "dead") {
    m.prism(x, y, 0, 0.8 * s, 0.07 * s, 5, M.trunk, 0.03 * s);
    for (let i = 0; i < 3; i++) { const a = rnd() * Math.PI * 2, z = (0.4 + i * 0.15) * s, dx = Math.cos(a) * 0.3 * s, dy = Math.sin(a) * 0.3 * s; m.panel([[x, y, z], [x + dx, y + dy, z + 0.25 * s], [x + dx * 0.9, y + dy * 0.9, z + 0.31 * s], [x, y, z + 0.07 * s]], M.trunk); }
  } else if (kind === "pylon") {
    m.prism(x, y, 0, 1.5 * s, 0.05 * s, 4, M.metal);
    const a = rnd() > 0.5;
    m.box(x - (a ? 0.3 : 0.04) * s, y - (a ? 0.04 : 0.3) * s, 0.9 * s, x + (a ? 0.3 : 0.04) * s, y + (a ? 0.04 : 0.3) * s, 1.4 * s, rnd() > 0.5 ? M.glow : M.cloth, undefined, { flat: true });
  } else { // bamboo
    for (let i = 0; i < 4; i++) {
      const bx = x + (rnd() - 0.5) * 0.3 * s, by = y + (rnd() - 0.5) * 0.3 * s, hh = (1.1 + rnd() * 0.5) * s;
      m.prism(bx, by, 0, hh, 0.028 * s, 4, M.foliage2);
      m.panel([[bx, by, hh * 0.8], [bx + 0.22 * s, by + 0.05, hh * 0.92], [bx + 0.05, by + 0.2 * s, hh * 1.02]], f, { ink: false });
    }
  }
}
export function lamp(m: Mesh, x: number, y: number, S: WorldStyle) {
  const M = S.mat;
  if (S.lamp === "brazier") { m.prism(x, y, 0, 0.42, 0.05, 4, M.metal); m.prism(x, y, 0.42, 0.55, 0.08, 6, M.metal, 0.15); m.prism(x, y, 0.55, 0.8, 0.11, 5, M.glow, 0, M.glow, 0, { flat: true, ink: false }); }
  else if (S.lamp === "neon") { m.prism(x, y, 0, 1.1, 0.035, 4, M.metal); m.box(x - 0.16, y - 0.03, 1.02, x + 0.16, y + 0.03, 1.1, M.glow, undefined, { flat: true }); }
  else if (S.lamp === "lantern") { m.prism(x, y, 0, 0.7, 0.03, 4, M.timberDark); m.box(x - 0.09, y - 0.09, 0.7, x + 0.09, y + 0.09, 0.9, M.glow, M.roof, { flat: true }); m.hip(x - 0.14, y - 0.14, x + 0.14, y + 0.14, 0.9, 0.1, M.roof); }
  else { m.prism(x, y, 0, 0.85, 0.035, 5, M.metal); m.prism(x, y, 0.85, 1.0, 0.08, 5, M.glow, 0.06, M.metal, 0, { flat: true }); m.prism(x, y, 1.0, 1.07, 0.1, 5, M.metal, 0); }
}
/** A banner on a pole: the cloth ripples. */
function banner(m: Mesh, x: number, y: number, S: WorldStyle, c = S.mat.cloth): (t: number) => Face[] {
  m.prism(x, y, 0, 1.5, 0.03, 4, S.mat.timberDark);
  return (t) => {
    const a = new Mesh(), n = 4;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, w = (u: number) => Math.sin(t * 3 + u * 5 + x) * 0.07 * u;
      a.panel([[x + u0 * 0.6, y + w(u0), 1.45], [x + u1 * 0.6, y + w(u1), 1.45 - u1 * 0.05], [x + u1 * 0.6, y + w(u1), 1.0 + u1 * 0.08], [x + u0 * 0.6, y + w(u0), 0.98]], i % 2 ? S.mat.cloth2 : c, { ink: false });
    }
    return a.faces;
  };
}

// ------------------------------------------------------------------------------------------------ builders
const wallB: Builder = (m, r, S, _r, look) => {
  const h = lookOf(S, look).h ?? 0.95, c = lookOf(S, look).wall ?? S.mat.stone;
  m.box(r.x0, r.y0, 0, r.x1, r.y1, h, c, S.mat.stoneDark);
  crenels(m, r, h, c);
};
const palisade: Builder = (m, r, S, _r, look) => {
  const h = lookOf(S, look).h ?? 0.9, c = lookOf(S, look).wall ?? S.mat.timber, alongX = r.w >= r.d;
  const n = Math.max(2, Math.round((alongX ? r.w : r.d) / 0.22));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, hh = h * (0.9 + 0.1 * ((i * 7) % 3) / 2);
    const x0 = alongX ? r.x0 + r.w * t0 : r.cx - 0.1, x1 = alongX ? r.x0 + r.w * t1 : r.cx + 0.1, y0 = alongX ? r.cy - 0.1 : r.y0 + r.d * t0, y1 = alongX ? r.cy + 0.1 : r.y0 + r.d * t1;
    m.box(x0, y0, 0, x1, y1, hh, i % 2 ? c : S.mat.timberDark);
    m.hip(x0, y0, x1, y1, hh, 0.14, c);
  }
};
const hedgeWall: Builder = (m, r, S, _r, look) => {
  const h = lookOf(S, look).h ?? 0.75, c = S.mat.foliage2, i = 0.06;
  m.box(r.x0, r.y0, 0, r.x1, r.y1, h * 0.8, c, c, { ink: false });
  m.hip(r.x0, r.y0, r.x1, r.y1, h * 0.8, h * 0.2, S.mat.foliage, 0.6, { ink: false });
  void i;
};
const house: Builder = (m, r, S, rnd, look) => {
  const L = lookOf(S, look);
  houseLike(m, r, S, rnd, { h: L.h ?? 0.85, wall: L.wall ?? (rnd() > 0.5 ? S.mat.plaster : S.mat.plaster2), roof: L.roof ?? S.roof, roofC: L.roofC ?? S.mat.roof, chimney: true, beams: true });
};
const hall: Builder = (m, r, S, rnd, look) => {
  const L = lookOf(S, look);
  houseLike(m, r, S, rnd, { h: L.h ?? 1.15, wall: L.wall ?? S.mat.plaster, roof: L.roof ?? S.roof, roofC: L.roofC ?? S.mat.roof2, door: 0.4, steep: 1.1, beams: true });
};
const barn: Builder = (m, r, S, rnd, look) => {
  const L = lookOf(S, look);
  houseLike(m, r, S, rnd, { h: L.h ?? 0.95, wall: L.wall ?? S.mat.timber, roof: L.roof ?? (S.roof === "gable" ? "gable" : S.roof), roofC: L.roofC ?? S.mat.thatch, door: 0.5, steep: 1.15 });
};
const shop: Builder = (m, r, S, rnd, look) => {
  const L = lookOf(S, look), h = L.h ?? 0.9, f = frontOf(r);
  houseLike(m, r, S, rnd, { h, wall: L.wall ?? S.mat.plaster2, roof: L.roof ?? "flat", roofC: L.roofC ?? S.mat.stoneDark, door: 0.3 });
  // an awning over the door
  const a = onSide(r, f, 0.12, h * 0.72), b = onSide(r, f, 0.88, h * 0.72), o = OUT[f], k = 0.32;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const p = (t: number, out: number, z: number): P3 => [a[0] + (b[0] - a[0]) * t + o[0] * out, a[1] + (b[1] - a[1]) * t + o[1] * out, z];
    m.panel([p(i / n, 0.02, h * 0.72), p((i + 1) / n, 0.02, h * 0.72), p((i + 1) / n, k, h * 0.55), p(i / n, k, h * 0.55)], i % 2 ? S.mat.cloth2 : S.mat.cloth);
  }
};
const tower: Builder = (m, r, S, _r, look) => {
  const L = lookOf(S, look), h = L.h ?? 2.0, c = L.wall ?? S.mat.stone, f = frontOf(r);
  const i = Math.min(r.w, r.d) * 0.06;
  m.box(r.x0 + i, r.y0 + i, 0, r.x1 - i, r.y1 - i, h * 0.8, c);
  m.box(r.x0, r.y0, h * 0.8, r.x1, r.y1, h, c, S.mat.stoneDark);
  onWall(m, r, f, 0.5, 0.24, 0, 0.44, S.mat.door);
  for (const s of ["x0", "x1", "y0", "y1"] as Side[]) onWall(m, { ...r, x0: r.x0 + i, x1: r.x1 - i, y0: r.y0 + i, y1: r.y1 - i, w: r.w - 2 * i, d: r.d - 2 * i }, s, 0.5, 0.1, h * 0.5, 0.2, S.mat.glow, { flat: true, ink: false });
  const kind = L.roof ?? (S.roof === "gable" ? "hip" : S.roof);
  if (kind === "flat") crenels(m, r, h, c, 0.16); else roofOn(m, r, h, kind, L.roofC ?? S.mat.roof2, S, 0.07, 1.7);
};
const chapel: Builder = (m, r, S, rnd, look) => {
  const L = lookOf(S, look), alongX = r.w >= r.d, f = frontOf(r);
  // nave, with a steeple at the end away from the door side's left
  const t = Math.min(r.w, r.d) * 0.7;
  const nave: Rc = alongX ? rcOf({ x: r.cx + t / 2, y: r.cy, w: r.w - t, h: r.d }) : rcOf({ x: r.cx, y: r.cy + t / 2, w: r.w, h: r.d - t });
  const st: Rc = alongX ? rcOf({ x: r.x0 + t / 2, y: r.cy, w: t, h: Math.min(r.d, t) }) : rcOf({ x: r.cx, y: r.y0 + t / 2, w: Math.min(r.w, t), h: t });
  houseLike(m, nave, S, rnd, { h: L.h ?? 1.0, wall: L.wall ?? S.mat.stone, roof: L.roof ?? S.roof, roofC: L.roofC ?? S.mat.roof2, door: 0.34, steep: 1.25 });
  const hh = (L.h ?? 1.0) * 1.75;
  m.box(st.x0, st.y0, 0, st.x1, st.y1, hh, L.wall ?? S.mat.stone);
  onWall(m, st, f, 0.5, 0.14, hh * 0.62, 0.26, S.mat.glow, { flat: true, ink: false });
  m.hip(st.x0 - 0.05, st.y0 - 0.05, st.x1 + 0.05, st.y1 + 0.05, hh, t * 1.1, L.roofC ?? S.mat.roof2);
};
const mill: Builder = (m, r, S, _r, look) => {
  const L = lookOf(S, look), h = L.h ?? 1.7, rad = Math.min(r.w, r.d) / 2, f = frontOf(r), o = OUT[f];
  m.prism(r.cx, r.cy, 0, h, rad, 8, L.wall ?? S.mat.plaster, rad * 0.68);
  m.prism(r.cx, r.cy, h, h + rad * 0.9, rad * 0.78, 8, L.roofC ?? S.mat.roof, 0);
  const hub: P3 = [r.cx + o[0] * rad * 0.82, r.cy + o[1] * rad * 0.82, h * 0.86];
  m.box(hub[0] - 0.05, hub[1] - 0.05, hub[2] - 0.05, hub[0] + 0.05, hub[1] + 0.05, hub[2] + 0.05, S.mat.timberDark);
  const ax: P3 = [-o[1], o[0], 0]; // across the face
  return (t) => {
    const a = new Mesh(), R = Math.max(0.75, rad * 1.5);
    for (let i = 0; i < 4; i++) {
      const g = t * 0.9 + (i * Math.PI) / 2, cu = Math.cos(g), su = Math.sin(g), cv = Math.cos(g + 0.22), sv = Math.sin(g + 0.22);
      const p = (k: number, c: number, s: number): P3 => [hub[0] + ax[0] * c * k + o[0] * 0.06, hub[1] + ax[1] * c * k + o[1] * 0.06, hub[2] + s * k];
      a.panel([p(0.12 * R, cu, su), p(R, cu, su), p(R, cv, sv), p(0.2 * R, cv, sv)], i % 2 ? S.mat.cloth2 : S.mat.sack, { bias: 0.3 });
    }
    return a.faces;
  };
};
const gatehouse: Builder = (m, r, S, _r, look) => {
  const L = lookOf(S, look), h = L.h ?? 1.3, c = L.wall ?? S.mat.stone, alongX = r.w >= r.d, t = Math.min(alongX ? r.w * 0.3 : r.d * 0.3, 0.6);
  const A: Rc = alongX ? rcOf({ x: r.x0 + t / 2, y: r.cy, w: t, h: r.d }) : rcOf({ x: r.cx, y: r.y0 + t / 2, w: r.w, h: t });
  const B: Rc = alongX ? rcOf({ x: r.x1 - t / 2, y: r.cy, w: t, h: r.d }) : rcOf({ x: r.cx, y: r.y1 - t / 2, w: r.w, h: t });
  for (const q of [A, B]) { m.box(q.x0, q.y0, 0, q.x1, q.y1, h * 1.25, c, S.mat.stoneDark); crenels(m, q, h * 1.25, c, 0.14); }
  if (alongX) m.box(r.x0 + t, r.y0 + r.d * 0.15, 0, r.x1 - t, r.y1 - r.d * 0.15, h, c, S.mat.stoneDark); else m.box(r.x0 + r.w * 0.15, r.y0 + t, 0, r.x1 - r.w * 0.15, r.y1 - t, h, c, S.mat.stoneDark);
  const mid: Rc = alongX ? rcOf({ x: r.cx, y: r.cy, w: r.w - 2 * t, h: r.d * 0.7 }) : rcOf({ x: r.cx, y: r.cy, w: r.w * 0.7, h: r.d - 2 * t });
  for (const s of (alongX ? ["y0", "y1"] : ["x0", "x1"]) as Side[]) { onWall(m, mid, s, 0.5, Math.min(0.5, lenOf(mid, s) * 0.7), 0, h * 0.62, S.mat.door); onWall(m, mid, s, 0.5, 0.3, h * 0.72, 0.2, S.mat.cloth, { ink: false }); }
};
const ruin: Builder = (m, r, S, rnd, look) => {
  const h = lookOf(S, look).h ?? 1.0, c = S.mat.stone, t = 0.16;
  // broken walls round the footprint, an open floor inside
  const seg = (x0: number, y0: number, x1: number, y1: number) => {
    const alongX = x1 - x0 > y1 - y0, n = Math.max(2, Math.round((alongX ? x1 - x0 : y1 - y0) / 0.4));
    for (let i = 0; i < n; i++) {
      const hh = h * (0.35 + rnd() * 0.75);
      if (rnd() < 0.18) continue;
      if (alongX) m.box(x0 + ((x1 - x0) * i) / n, y0, 0, x0 + ((x1 - x0) * (i + 1)) / n, y1, hh, i % 2 ? c : S.mat.stoneDark); else m.box(x0, y0 + ((y1 - y0) * i) / n, 0, x1, y0 + ((y1 - y0) * (i + 1)) / n, hh, i % 2 ? c : S.mat.stoneDark);
    }
  };
  m.box(r.x0, r.y0, 0, r.x1, r.y1, 0.06, S.mat.stoneDark);
  seg(r.x0, r.y0, r.x1, r.y0 + t); seg(r.x0, r.y1 - t, r.x1, r.y1); seg(r.x0, r.y0 + t, r.x0 + t, r.y1 - t); seg(r.x1 - t, r.y0 + t, r.x1, r.y1 - t);
};
const rock: Builder = (m, r, S, rnd, look) => {
  const h = lookOf(S, look).h ?? 0.9, c = S.mat.rock, n = Math.max(1, Math.round((r.w * r.d) / 0.5));
  m.box(r.x0 + r.w * 0.08, r.y0 + r.d * 0.08, 0, r.x1 - r.w * 0.08, r.y1 - r.d * 0.08, h * 0.3, c);
  for (let i = 0; i < n + 1; i++) {
    const x = r.x0 + r.w * (0.25 + rnd() * 0.5), y = r.y0 + r.d * (0.25 + rnd() * 0.5), rad = Math.min(r.w, r.d) * (0.28 + rnd() * 0.2);
    m.prism(x, y, 0, h * (0.5 + rnd() * 0.3), Math.min(rad, Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y)), 5, c, rad * 0.45, S.mat.stone, rnd() * 3);
    m.prism(x, y, h * 0.6, h * (0.9 + rnd() * 0.5), rad * 0.45, 5, c, rad * 0.12, S.mat.stone, rnd() * 3);
  }
};
const well: Builder = (m, r, S) => {
  const rad = Math.min(r.w, r.d) / 2, M = S.mat;
  m.prism(r.cx, r.cy, 0, 0.32, rad * 0.9, 8, M.stone, rad * 0.9, M.stoneDark);
  m.prism(r.cx, r.cy, 0.3, 0.33, rad * 0.62, 8, S.water.deep, rad * 0.62, S.water.deep, undefined, { flat: true, ink: false });
  for (const s of [-1, 1]) m.box(r.cx + s * rad * 0.75 - 0.03, r.cy - 0.03, 0.32, r.cx + s * rad * 0.75 + 0.03, r.cy + 0.03, 0.85, M.timberDark);
  m.gable(r.cx - rad, r.cy - rad * 0.7, r.cx + rad, r.cy + rad * 0.7, 0.85, 0.25, M.roof, "x", M.timber);
};
const statue: Builder = (m, r, S) => {
  const rad = Math.min(r.w, r.d) / 2, M = S.mat;
  m.box(r.x0 + r.w * 0.08, r.y0 + r.d * 0.08, 0, r.x1 - r.w * 0.08, r.y1 - r.d * 0.08, 0.14, M.stoneDark);
  m.box(r.cx - rad * 0.6, r.cy - rad * 0.6, 0.14, r.cx + rad * 0.6, r.cy + rad * 0.6, 0.55, M.stone);
  m.prism(r.cx, r.cy, 0.55, 1.05, rad * 0.3, 6, M.metal, rad * 0.22);
  m.blob(r.cx, r.cy, 1.17, rad * 0.24, M.metal, 5);
  m.panel([[r.cx + rad * 0.25, r.cy, 0.75], [r.cx + rad * 0.3, r.cy, 1.55], [r.cx + rad * 0.36, r.cy, 1.55], [r.cx + rad * 0.34, r.cy, 0.75]], M.metal);
};
const barricade: Builder = (m, r, S, _r, look) => {
  const h = lookOf(S, look).h ?? 0.55, M = S.mat, alongX = r.w >= r.d, n = Math.max(2, Math.round((alongX ? r.w : r.d) / 0.3));
  if (alongX) m.box(r.x0, r.cy - 0.07, 0.12, r.x1, r.cy + 0.07, 0.26, M.timber); else m.box(r.cx - 0.07, r.y0, 0.12, r.cx + 0.07, r.y1, 0.26, M.timber);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = alongX ? r.x0 + r.w * t : r.cx, y = alongX ? r.cy : r.y0 + r.d * t, k = alongX ? [0, 1] : [1, 0];
    for (const s of [-1, 1]) m.panel([[x - 0.04, y - 0.04, 0], [x + 0.04, y + 0.04, 0], [x + k[0] * s * 0.3 + 0.02, y + k[1] * s * 0.3 + 0.02, h], [x + k[0] * s * 0.3 - 0.02, y + k[1] * s * 0.3 - 0.02, h]].map((p) => p as P3), i % 2 ? M.timber : M.timberDark);
  }
};
const logs: Builder = (m, r, S, _r, look) => {
  const h = lookOf(S, look).h ?? 0.5, M = S.mat, alongX = r.w >= r.d, rad = h * 0.32, wide = (alongX ? r.d : r.w) / 2;
  const log = (off: number, z: number) => {
    const n = 6, e0 = alongX ? r.x0 : r.y0, e1 = alongX ? r.x1 : r.y1;
    const pt = (a: number, e: number): P3 => alongX ? [e, r.cy + off + Math.cos(a) * rad, z + Math.sin(a) * rad] : [r.cx + off + Math.cos(a) * rad, e, z + Math.sin(a) * rad];
    const mid: P3 = alongX ? [r.cx, r.cy + off, z] : [r.cx + off, r.cy, z];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2; m.face([pt(a, e0), pt(a, e1), pt(b, e1), pt(b, e0)], M.timber, mid, { ink: [false, true, false, true] }); }
    for (const e of [e0, e1]) m.face(Array.from({ length: n }, (_, i) => pt((i / n) * Math.PI * 2, e)), M.sack, mid);
  };
  const k = Math.max(1, Math.floor(wide / rad));
  for (let i = 0; i < k; i++) log((i - (k - 1) / 2) * rad * 1.9, rad);
  for (let i = 0; i < k - 1; i++) log((i - (k - 2) / 2) * rad * 1.9, rad * 2.6);
};
/** A cart or wagon: a bed on wheels. */
const wagon: Builder = (m, r, S, _r, look) => {
  const M = S.mat, alongX = r.w >= r.d, big = look === "wagon", z0 = 0.2, z1 = big ? 0.6 : 0.45;
  const i = 0.06;
  m.box(r.x0 + i, r.y0 + i, z0, r.x1 - i, r.y1 - i, z0 + 0.08, M.timberDark);
  m.box(r.x0 + i, r.y0 + i, z0 + 0.08, r.x1 - i, r.y1 - i, z1, M.timber, M.hay);
  const wr = 0.2;
  for (const u of [0.22, 0.78]) for (const s of [0, 1]) {
    const x = alongX ? r.x0 + r.w * u : (s ? r.x1 - 0.03 : r.x0 + 0.03), y = alongX ? (s ? r.y1 - 0.03 : r.y0 + 0.03) : r.y0 + r.d * u;
    const pts: P3[] = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return (alongX ? [x + Math.cos(a) * wr, y, wr + Math.sin(a) * wr] : [x, y + Math.cos(a) * wr, wr + Math.sin(a) * wr]) as P3; });
    m.panel(pts, M.timberDark, { bias: 0.1 });
  }
  if (big) { const c = rcOf({ x: r.cx, y: r.cy, w: r.w - 0.2, h: r.d - 0.2 }); roofOn(m, c, z1, "barrel", M.cloth2, S, 0, 1); }
};
const crates: Builder = (m, r, S, rnd, look) => {
  const h = lookOf(S, look).h ?? 0.55, M = S.mat, alongX = r.w >= r.d, L = alongX ? r.w : r.d, n = Math.max(1, Math.round(L / 0.5));
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, g = 0.02, hh = h * (0.7 + rnd() * 0.3);
    const q: Rc = alongX ? rcOf({ x: r.x0 + r.w * (a + b) / 2, y: r.cy, w: r.w / n - g, h: r.d - g }) : rcOf({ x: r.cx, y: r.y0 + r.d * (a + b) / 2, w: r.w - g, h: r.d / n - g });
    m.box(q.x0, q.y0, 0, q.x1, q.y1, hh, i % 2 ? M.timber : M.sack, M.timber);
    for (const s of ["x0", "x1", "y0", "y1"] as Side[]) onWall(m, q, s, 0.5, lenOf(q, s) * 0.9, hh * 0.42, hh * 0.14, M.timberDark, { ink: false });
    if (rnd() > 0.5) { const k = Math.min(q.w, q.d) * 0.3; m.box(q.cx - k, q.cy - k, hh, q.cx + k, q.cy + k, hh + k * 1.6, M.timber, M.sack); }
  }
};
const fence: Builder = (m, r, S, _r, look) => {
  const h = lookOf(S, look).h ?? 0.45, M = S.mat, alongX = r.w >= r.d, L = alongX ? r.w : r.d, n = Math.max(2, Math.round(L / 0.45));
  for (let i = 0; i <= n; i++) { const t = i / n, x = alongX ? r.x0 + 0.04 + (r.w - 0.08) * t : r.cx, y = alongX ? r.cy : r.y0 + 0.04 + (r.d - 0.08) * t; m.box(x - 0.04, y - 0.04, 0, x + 0.04, y + 0.04, h, M.timberDark); }
  for (const z of [h * 0.45, h * 0.8]) { if (alongX) m.box(r.x0, r.cy - 0.025, z - 0.035, r.x1, r.cy + 0.025, z + 0.035, M.timber); else m.box(r.cx - 0.025, r.y0, z - 0.035, r.cx + 0.025, r.y1, z + 0.035, M.timber); }
};
const sandbags: Builder = (m, r, S, _r, look) => {
  const h = lookOf(S, look).h ?? 0.45, M = S.mat, alongX = r.w >= r.d, L = alongX ? r.w : r.d, n = Math.max(2, Math.round(L / 0.36));
  for (let row = 0; row < 2; row++) for (let i = 0; i < n - row; i++) {
    const t0 = (i + row * 0.5) / n, t1 = (i + 1 + row * 0.5) / n, z = row * h * 0.45, g = 0.015, k = row * 0.05;
    if (alongX) m.box(r.x0 + r.w * t0 + g, r.y0 + k, z, r.x0 + r.w * t1 - g, r.y1 - k, z + h * 0.5, (i + row) % 2 ? M.sack : S.mat.plaster2);
    else m.box(r.x0 + k, r.y0 + r.d * t0 + g, z, r.x1 - k, r.y0 + r.d * t1 - g, z + h * 0.5, (i + row) % 2 ? M.sack : S.mat.plaster2);
  }
};
const barrels: Builder = (m, r, S, rnd) => {
  const M = S.mat, rad = Math.min(0.2, Math.min(r.w, r.d) / 2), nx = Math.max(1, Math.floor(r.w / (rad * 2))), ny = Math.max(1, Math.floor(r.d / (rad * 2)));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x = r.x0 + (i + 0.5) * (r.w / nx), y = r.y0 + (j + 0.5) * (r.d / ny), hh = 0.42 + rnd() * 0.1;
    m.prism(x, y, 0, hh, rad * 0.92, 7, M.timber, rad * 0.92, M.timberDark);
    m.prism(x, y, hh * 0.3, hh * 0.38, rad * 0.97, 7, M.metal, rad * 0.97, M.metal, undefined, { ink: false });
  }
};
const haystack: Builder = (m, r, S) => {
  const rad = Math.min(r.w, r.d) / 2, n = Math.max(1, Math.round(Math.max(r.w, r.d) / (rad * 2))), alongX = r.w >= r.d;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = alongX ? r.x0 + r.w * t : r.cx, y = alongX ? r.cy : r.y0 + r.d * t;
    m.prism(x, y, 0, 0.36, rad * 0.95, 7, S.mat.hay, rad * 0.8); m.prism(x, y, 0.36, 0.62, rad * 0.8, 7, S.mat.hay, rad * 0.2, S.mat.thatch);
  }
};
const stall: Builder = (m, r, S, rnd) => {
  const M = S.mat, h = 0.78, alongX = r.w >= r.d;
  m.box(r.x0 + 0.04, r.y0 + 0.04, 0, r.x1 - 0.04, r.y1 - 0.04, 0.3, M.timber, M.sack);
  for (const [x, y] of [[r.x0 + 0.04, r.y0 + 0.04], [r.x1 - 0.04, r.y0 + 0.04], [r.x0 + 0.04, r.y1 - 0.04], [r.x1 - 0.04, r.y1 - 0.04]]) m.box(x - 0.025, y - 0.025, 0.3, x + 0.025, y + 0.025, h, M.timberDark);
  const n = Math.max(2, Math.round((alongX ? r.w : r.d) / 0.3)), c = rnd() > 0.5 ? M.cloth : M.roof2;
  for (let i = 0; i < n; i++) {
    const q: Rc = alongX ? rcOf({ x: r.x0 + r.w * (i + 0.5) / n, y: r.cy, w: r.w / n, h: r.d + 0.16 }) : rcOf({ x: r.cx, y: r.y0 + r.d * (i + 0.5) / n, w: r.w + 0.16, h: r.d / n });
    m.gable(q.x0, q.y0, q.x1, q.y1, h, 0.18, i % 2 ? M.cloth2 : c, alongX ? "x" : "y", i % 2 ? M.cloth2 : c, { ink: false });
  }
  for (let i = 0; i < 3; i++) m.blob(r.x0 + r.w * (0.25 + i * 0.25), r.y0 + r.d * (0.3 + rnd() * 0.4), 0.34, 0.07, [M.cloth, M.hay, M.foliage][i], 4, 1, { ink: false });
};
const fountain: Builder = (m, r, S) => {
  const rad = Math.min(r.w, r.d) / 2, M = S.mat;
  m.prism(r.cx, r.cy, 0, 0.22, rad, 10, M.stone, rad, M.stoneDark);
  m.prism(r.cx, r.cy, 0.2, 0.23, rad * 0.82, 10, S.water.shallow, rad * 0.82, S.water.shallow, undefined, { flat: true, ink: false });
  m.prism(r.cx, r.cy, 0.2, 0.6, rad * 0.16, 6, M.stone); m.prism(r.cx, r.cy, 0.6, 0.68, rad * 0.4, 8, M.stone, rad * 0.46, S.water.shallow);
  return (t) => { const a = new Mesh(); a.prism(r.cx, r.cy, 0.68, 0.86 + Math.sin(t * 5) * 0.05, rad * 0.07, 4, "#e9f7ff", 0.01, "#e9f7ff", t, { flat: true, ink: false, alpha: 0.85 }); return a.faces; };
};
/** An orchard: fruit trees in rows (the brush under them is drawn by the terrain layer). */
const orchard: Builder = (m, r, S, rnd) => {
  const nx = Math.max(1, Math.round(r.w / 0.95)), ny = Math.max(1, Math.round(r.d / 0.95));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) tree(m, r.x0 + (i + 0.5) * (r.w / nx) + (rnd() - 0.5) * 0.15, r.y0 + (j + 0.5) * (r.d / ny) + (rnd() - 0.5) * 0.15, 0.62, S, rnd, S.tree === "pylon" || S.tree === "cactus" || S.tree === "dead" ? S.tree : "blossom");
};

export const BUILDERS: Record<string, Builder> = {
  wall: wallB, palisade, "hedge-wall": hedgeWall,
  building: house, house, hall, tower, barn, shop, chapel, mill, gatehouse, ruin, rock, well, statue,
  barricade, logs, wagon,
  cover: crates, crates, fence, sandbags, barrels, haystack, stall, cart: wagon,
  fountain, orchard,
};
/** Rough height of a look (for shadows and for fading what stands in front of a unit). */
export const HEIGHT: Record<string, number> = { wall: 0.95, palisade: 0.9, "hedge-wall": 0.75, house: 1.3, building: 1.3, hall: 1.8, tower: 2.6, barn: 1.5, shop: 1.0, chapel: 2.2, mill: 2.4, gatehouse: 1.6, ruin: 1.0, rock: 1.1, well: 1.1, statue: 1.5, barricade: 0.55, logs: 0.5, wagon: 0.9, crates: 0.6, cover: 0.6, fence: 0.45, sandbags: 0.45, barrels: 0.5, haystack: 0.62, stall: 0.95, cart: 0.5, fountain: 0.8, orchard: 1.0 };

/** The geometry of a block, or null for the kinds drawn on the ground (water, roads, brush). */
export function buildBlock(b: Block, S: WorldStyle = TERRAIN): Built | null {
  const look = b.look ?? b.kind;
  const fn = BUILDERS[look] ?? (b.kind === "water" || (b.kind as string) === "road" || (b.kind as string) === "brush" ? undefined : BUILDERS[b.kind]);
  if (!fn) return null;
  const m = new Mesh(), anim = fn(m, rcOf(b), S, seeded(b.id * 31 + Math.round(b.x * 7 + b.y * 13)), look) || undefined;
  return { mesh: m, anim, h: HEIGHT[look] ?? HEIGHT[b.kind] ?? 0.8 };
}
/** A decoration mark that stands up (tree, lamp, banner, signpost); gates, bridges and doors are ground paint. */
export function buildMark(k: ArenaMark, i: number, S: WorldStyle = TERRAIN): Built | null {
  const m = new Mesh(), rnd = seeded(i * 97 + 5), look = k.look as string;
  let anim: Built["anim"];
  if (look === "tree") tree(m, k.x, k.y, 0.9 + rnd() * 0.35, S, rnd);
  else if (look === "lamp") lamp(m, k.x, k.y, S);
  else if (look === "banner") anim = banner(m, k.x, k.y, S);
  else if (look === "signpost") { m.prism(k.x, k.y, 0, 0.7, 0.035, 4, S.mat.timberDark); m.box(k.x - 0.2, k.y - 0.02, 0.5, k.x + 0.16, k.y + 0.02, 0.64, S.mat.timber); }
  else return null;
  return { mesh: m, anim, h: 1.2 };
}
/** A house for the scenery ring around the battlefield. */
export function sceneryHouse(m: Mesh, x: number, y: number, w: number, d: number, S: WorldStyle, rnd: Rnd) { house(m, rcOf({ x, y, w, h: d }), S, rnd, "house"); }
export function sceneryRock(m: Mesh, x: number, y: number, s: number, S: WorldStyle, rnd: Rnd) { rock(m, rcOf({ x, y, w: s, h: s * 0.8 }), S, rnd, "rock"); }
