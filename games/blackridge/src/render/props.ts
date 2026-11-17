// Blackridge's set. The base kit builds a village (houses, a chapel, a mill, stalls, carts, haystacks); a war zone
// needs other shapes on the same footprints: blast walls under razor wire, earth-filled barrier baskets, block houses
// with flat roofs, hangars, a checkpoint with a boom, a guard tower on legs, a comms mast with a blinking light, a
// radar that turns, shipping containers, steel hedgehogs, concrete barriers, oil drums, a burnt-out truck, camo nets.
// Every builder here replaces the base builder for the same look; the rest of the renderer is the base game's.
import { Mesh, type Face, type P3 } from "@base/render/kit3d";
import { BUILDERS, HEIGHT, tree as baseTree, type Rc } from "@base/render/props";
import { H, W } from "@engine/core/defs";
import type { WorldStyle } from "../game/terrain";

export * from "@base/render/props";

type Rnd = () => number;
type Builder = (m: Mesh, r: Rc, S: WorldStyle, rnd: Rnd, look: string) => void | ((t: number) => Face[]);
type Side = "x0" | "x1" | "y0" | "y1";
const rc = (x: number, y: number, w: number, d: number): Rc => ({ x0: x - w / 2, y0: y - d / 2, x1: x + w / 2, y1: y + d / 2, cx: x, cy: y, w, d });
const OUT: Record<Side, P3> = { x0: [-1, 0, 0], x1: [1, 0, 0], y0: [0, -1, 0], y1: [0, 1, 0] };
const SIDES: Side[] = ["x0", "x1", "y0", "y1"];
const lenOf = (r: Rc, s: Side) => (s === "y0" || s === "y1" ? r.w : r.d);
const frontOf = (r: Rc): Side => (r.w >= r.d ? (r.cy <= H / 2 ? "y1" : "y0") : r.cx <= W / 2 ? "x1" : "x0");
function onSide(r: Rc, s: Side, t: number, z: number): P3 {
  if (s === "y0") return [r.x0 + r.w * t, r.y0, z];
  if (s === "y1") return [r.x0 + r.w * t, r.y1, z];
  if (s === "x0") return [r.x0, r.y0 + r.d * t, z];
  return [r.x1, r.y0 + r.d * t, z];
}
function onWall(m: Mesh, r: Rc, s: Side, t: number, w: number, z0: number, h: number, c: string, o: Partial<Face> = {}) {
  const dt = w / 2 / lenOf(r, s);
  m.decal(onSide(r, s, t - dt, z0), onSide(r, s, t + dt, z0), h, c, OUT[s], o);
}
const hOf = (S: WorldStyle, look: string, d: number) => S.looks?.[look]?.h ?? d;

const HAZ = "#c79a1e", DARK = "#1a1c1d", RUST = "#6e4a36", STEEL = "#8f979c", GLASS = "#1e2a30", WARN = "#ff3a2a", SOOT = "#161616";
const CONT = ["#6e4a36", "#3d5568", "#59604a", "#7a6a3c", "#5a2f2a", "#4a5357"];

/** Razor wire along a line at height z: crossed slivers of bright steel. */
function wire(m: Mesh, a: P3, b: P3, z: number, rad = 0.09) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(L / 0.16)), dx = (b[0] - a[0]) / n, dy = (b[1] - a[1]) / n, px = -dy / (L / n) * rad, py = dx / (L / n) * rad;
  for (let i = 0; i < n; i++) {
    const x = a[0] + dx * i, y = a[1] + dy * i, s = i % 2 ? 1 : -1;
    m.panel([[x + px * s, y + py * s, z], [x + dx + px * -s, y + dy + py * -s, z + rad * 2], [x + dx + px * -s, y + dy + py * -s, z + rad * 2 - 0.025], [x + px * s, y + py * s, z - 0.025]], STEEL, { ink: false, flat: true });
    m.panel([[x + px * -s, y + py * -s, z + rad * 2], [x + dx + px * s, y + dy + py * s, z], [x + dx + px * s, y + dy + py * s, z - 0.025], [x + px * -s, y + py * -s, z + rad * 2 - 0.025]], "#6d757a", { ink: false, flat: true });
  }
}
/** A steel beam between two points (a thin three-sided bar). */
function beam(m: Mesh, a: P3, b: P3, t: number, c: string) {
  m.panel([[a[0] - t, a[1], a[2]], [a[0] + t, a[1], a[2]], [b[0] + t, b[1], b[2]], [b[0] - t, b[1], b[2]]], c);
  m.panel([[a[0], a[1] - t, a[2]], [a[0], a[1] + t, a[2]], [b[0], b[1] + t, b[2]], [b[0], b[1] - t, b[2]]], c);
}
/** Scorch up a wall from the ground. */
function scorch(m: Mesh, r: Rc, s: Side, t: number, w: number, h: number) { onWall(m, r, s, t, w, 0, h, SOOT, { ink: false, alpha: 0.45, flat: true, bias: 0.1 }); onWall(m, r, s, t, w * 0.5, 0, h * 1.35, SOOT, { ink: false, alpha: 0.35, flat: true, bias: 0.11 }); }

// ------------------------------------------------------------------------------------------------ walls
const blastWall: Builder = (m, r, S, _r, look) => {
  const h = hOf(S, look, 1.05), c = S.looks?.[look]?.wall ?? S.mat.stone, ax = r.w >= r.d, L = ax ? r.w : r.d, n = Math.max(1, Math.round(L / 0.5)), th = Math.min(ax ? r.d : r.w, 0.3);
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, g = 0.012;
    const q = ax ? rc(r.x0 + r.w * (a + b) / 2, r.cy, r.w / n - g, r.d) : rc(r.cx, r.y0 + r.d * (a + b) / 2, r.w, r.d / n - g);
    const s = ax ? rc(q.cx, q.cy, q.w, th * 0.55) : rc(q.cx, q.cy, th * 0.55, q.d);
    m.box(q.x0, q.y0, 0, q.x1, q.y1, 0.14, S.mat.stoneDark);
    m.box(s.x0, s.y0, 0.14, s.x1, s.y1, h - (i % 3 === 1 ? 0.04 : 0), c, S.mat.stoneDark);
  }
  wire(m, ax ? [r.x0, r.cy, 0] : [r.cx, r.y0, 0], ax ? [r.x1, r.cy, 0] : [r.cx, r.y1, 0], h + 0.02);
};
const baskets: Builder = (m, r, S, rnd, look) => {
  const h = hOf(S, look, 0.9), ax = r.w >= r.d, L = ax ? r.w : r.d, n = Math.max(1, Math.round(L / 0.55));
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, g = 0.02, hh = h * (0.92 + rnd() * 0.08);
    const q = ax ? rc(r.x0 + r.w * (a + b) / 2, r.cy, r.w / n - g, r.d - g) : rc(r.cx, r.y0 + r.d * (a + b) / 2, r.w - g, r.d / n - g);
    m.box(q.x0, q.y0, 0, q.x1, q.y1, hh, S.mat.sack, S.mat.rock);
    for (const s of SIDES) { onWall(m, q, s, 0.5, lenOf(q, s) * 0.98, hh - 0.05, 0.05, S.mat.metal, { ink: false }); onWall(m, q, s, 0.5, lenOf(q, s) * 0.98, 0, 0.04, S.mat.metal, { ink: false }); onWall(m, q, s, 0.04, 0.03, 0, hh, S.mat.metal, { ink: false }); onWall(m, q, s, 0.96, 0.03, 0, hh, S.mat.metal, { ink: false }); }
  }
};
const netFence: Builder = (m, r, S, _r, look) => {
  const h = hOf(S, look, 0.8), ax = r.w >= r.d, L = ax ? r.w : r.d, n = Math.max(2, Math.round(L / 0.6));
  const at = (t: number): [number, number] => (ax ? [r.x0 + 0.03 + (r.w - 0.06) * t, r.cy] : [r.cx, r.y0 + 0.03 + (r.d - 0.06) * t]);
  for (let i = 0; i <= n; i++) { const [x, y] = at(i / n); m.box(x - 0.025, y - 0.025, 0, x + 0.025, y + 0.025, h, S.mat.metal); }
  for (let i = 0; i < n; i++) { const [x0, y0] = at(i / n), [x1, y1] = at((i + 1) / n); m.panel([[x0, y0, 0.04], [x1, y1, 0.04], [x1, y1, h - 0.04 - (i % 2) * 0.06], [x0, y0, h - 0.04]], i % 2 ? S.mat.cloth : S.mat.foliage2, { ink: false, alpha: 0.9 }); }
  wire(m, [...at(0), 0] as P3, [...at(1), 0] as P3, h, 0.06);
};
const chainLink: Builder = (m, r, S, _r, look) => {
  const h = hOf(S, look, 0.55), ax = r.w >= r.d, L = ax ? r.w : r.d, n = Math.max(2, Math.round(L / 0.5));
  const at = (t: number): [number, number] => (ax ? [r.x0 + 0.03 + (r.w - 0.06) * t, r.cy] : [r.cx, r.y0 + 0.03 + (r.d - 0.06) * t]);
  for (let i = 0; i <= n; i++) { const [x, y] = at(i / n); m.box(x - 0.02, y - 0.02, 0, x + 0.02, y + 0.02, h, S.mat.metal); }
  const [x0, y0] = at(0), [x1, y1] = at(1);
  m.panel([[x0, y0, 0.03], [x1, y1, 0.03], [x1, y1, h - 0.03], [x0, y0, h - 0.03]], "#aab2b6", { ink: false, alpha: 0.28, flat: true });
  m.panel([[x0, y0, h - 0.04], [x1, y1, h - 0.04], [x1, y1, h - 0.015], [x0, y0, h - 0.015]], STEEL, { ink: false, flat: true });
};
const jersey: Builder = (m, r, S, _r, look) => {
  const h = hOf(S, look, 0.5), ax = r.w >= r.d, L = ax ? r.w : r.d, n = Math.max(1, Math.round(L / 0.7)), th = Math.min(ax ? r.d : r.w, 0.34);
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, g = 0.025;
    const q = ax ? rc(r.x0 + r.w * (a + b) / 2, r.cy, r.w / n - g, th) : rc(r.cx, r.y0 + r.d * (a + b) / 2, th, r.d / n - g);
    const s = ax ? rc(q.cx, q.cy, q.w, th * 0.42) : rc(q.cx, q.cy, th * 0.42, q.d);
    m.box(q.x0, q.y0, 0, q.x1, q.y1, h * 0.3, S.mat.stone);
    m.box(s.x0, s.y0, h * 0.3, s.x1, s.y1, h, S.mat.stone, S.mat.stoneDark);
    if (i % 2 === 0) for (const sd of (ax ? ["y0", "y1"] : ["x0", "x1"]) as Side[]) onWall(m, s, sd, 0.5, lenOf(s, sd) * 0.6, h * 0.55, h * 0.22, HAZ, { ink: false });
  }
};

// ------------------------------------------------------------------------------------------------ buildings
/** A concrete or brick block with a flat roof behind a parapet: dark windows (a few lit), a steel door, roof plant. */
function block(m: Mesh, r: Rc, S: WorldStyle, rnd: Rnd, o: { h: number; wall: string; roofC: string; door?: number; storeys?: number }) {
  const { h } = o, f = frontOf(r), M = S.mat;
  m.box(r.x0, r.y0, 0, r.x1, r.y1, h, o.wall, o.roofC);
  m.box(r.x0 - 0.02, r.y0 - 0.02, 0, r.x1 + 0.02, r.y1 + 0.02, 0.09, M.stoneDark);
  // parapet
  const p = 0.07;
  m.box(r.x0, r.y0, h, r.x1, r.y0 + p, h + 0.1, o.wall, M.stoneDark); m.box(r.x0, r.y1 - p, h, r.x1, r.y1, h + 0.1, o.wall, M.stoneDark);
  m.box(r.x0, r.y0 + p, h, r.x0 + p, r.y1 - p, h + 0.1, o.wall, M.stoneDark); m.box(r.x1 - p, r.y0 + p, h, r.x1, r.y1 - p, h + 0.1, o.wall, M.stoneDark);
  const dw = o.door ?? 0.26, dt = lenOf(r, f) > 1.2 ? 0.5 : 0.36;
  onWall(m, r, f, dt, dw, 0, Math.min(h * 0.6, 0.48), M.door);
  onWall(m, r, f, dt, dw + 0.06, Math.min(h * 0.6, 0.48), 0.03, M.metal, { ink: false });
  const st = o.storeys ?? 1;
  for (const s of SIDES) {
    const n = Math.max(1, Math.round(lenOf(r, s) / 0.7));
    for (let k = 0; k < st; k++) for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, z = h * (st === 1 ? 0.48 : 0.26 + (0.5 * k)), lit = rnd() < 0.14;
      if (k === 0 && s === f && Math.abs(t - dt) * lenOf(r, s) < dw / 2 + 0.2) continue;
      if (rnd() < 0.1) continue;
      onWall(m, r, s, t, 0.2, z, 0.15, lit ? M.glow : GLASS, { flat: true, ink: false });
      onWall(m, r, s, t, 0.24, z - 0.025, 0.025, M.stoneDark, { ink: false });
    }
    if (rnd() < 0.4) scorch(m, r, s, 0.2 + rnd() * 0.6, 0.3 + rnd() * 0.3, h * (0.4 + rnd() * 0.4));
  }
  // roof plant: an air handler, a tank or a hatch
  const k = rnd(), x = r.cx + (rnd() - 0.5) * r.w * 0.4, y = r.cy + (rnd() - 0.5) * r.d * 0.4, s = Math.min(r.w, r.d) * 0.16;
  if (k < 0.45) { m.box(x - s, y - s * 0.8, h, x + s, y + s * 0.8, h + s * 1.1, M.metal, M.stoneDark); }
  else if (k < 0.75) m.prism(x, y, h, h + s * 1.8, s * 0.8, 7, M.metal, s * 0.8, M.stoneDark);
  else m.box(x - s * 0.7, y - s * 0.7, h, x + s * 0.7, y + s * 0.7, h + 0.07, M.door);
}
const house: Builder = (m, r, S, rnd, look) => { const L = S.looks?.[look] ?? {}; block(m, r, S, rnd, { h: L.h ?? 1.1, wall: L.wall ?? (rnd() > 0.5 ? S.mat.plaster : S.mat.plaster2), roofC: L.roofC ?? S.mat.roof }); };
const hall: Builder = (m, r, S, rnd, look) => { const L = S.looks?.[look] ?? {}; block(m, r, S, rnd, { h: L.h ?? 1.6, wall: L.wall ?? S.mat.stone, roofC: L.roofC ?? S.mat.roof2, door: 0.4, storeys: 2 }); };
/** A hangar: corrugated walls under a barrel roof, a tall sliding door standing half open. */
const hangar: Builder = (m, r, S, _r, look) => {
  const L = S.looks?.[look] ?? {}, h = (L.h ?? 1.5) * 0.55, ax = r.w >= r.d, f = frontOf(r), M = S.mat, wall = L.wall ?? M.metal, roofC = L.roofC ?? M.roof;
  m.box(r.x0, r.y0, 0, r.x1, r.y1, h, wall);
  const n = 6, hw = (ax ? r.d : r.w) / 2 + 0.04, rise = hw * 0.75, e0 = ax ? r.x0 - 0.04 : r.y0 - 0.04, e1 = ax ? r.x1 + 0.04 : r.y1 + 0.04, mid: P3 = [r.cx, r.cy, h];
  const pt = (a: number, e: number): P3 => { const o = Math.cos(a) * hw, z = h + Math.sin(a) * rise; return ax ? [e, r.cy + o, z] : [r.cx + o, e, z]; };
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI, b = ((i + 1) / n) * Math.PI; m.face([pt(a, e0), pt(a, e1), pt(b, e1), pt(b, e0)], roofC, mid); }
  for (const e of [e0, e1]) m.face(Array.from({ length: n + 1 }, (_, i) => pt((i / n) * Math.PI, e)), wall, mid);
  const fl = lenOf(r, f);
  onWall(m, r, f, 0.5, fl * 0.62, 0, h * 0.92, DARK, { flat: true });
  onWall(m, r, f, 0.3, fl * 0.26, 0, h * 0.92, M.stoneDark, { bias: 0.1 });
  onWall(m, r, f, 0.5, fl * 0.7, h * 0.92, 0.05, HAZ, { ink: false });
};
/** A checkpoint booth with a striped boom across the way in. */
const checkpoint: Builder = (m, r, S, rnd, look) => {
  const L = S.looks?.[look] ?? {}, h = L.h ?? 0.9, f = frontOf(r), M = S.mat, o = OUT[f];
  block(m, r, S, rnd, { h, wall: L.wall ?? M.plaster2, roofC: L.roofC ?? M.roof, door: 0.24 });
  m.box(r.x0 - 0.12, r.y0 - 0.12, h + 0.1, r.x1 + 0.12, r.y1 + 0.12, h + 0.16, M.roof2);
  const a = onSide(r, f, 0.15, 0.36), len = Math.min(1.0, lenOf(r, f) * 0.9), dir: P3 = f === "y0" || f === "y1" ? [1, 0, 0] : [0, 1, 0];
  const p0: P3 = [a[0] + o[0] * 0.14, a[1] + o[1] * 0.14, 0];
  m.box(p0[0] - 0.04, p0[1] - 0.04, 0, p0[0] + 0.04, p0[1] + 0.04, 0.42, M.metal);
  for (let i = 0; i < 6; i++) { const t0 = (i / 6) * len, t1 = ((i + 1) / 6) * len; m.panel([[p0[0] + dir[0] * t0, p0[1] + dir[1] * t0, 0.36], [p0[0] + dir[0] * t1, p0[1] + dir[1] * t1, 0.36], [p0[0] + dir[0] * t1, p0[1] + dir[1] * t1, 0.42], [p0[0] + dir[0] * t0, p0[1] + dir[1] * t0, 0.42]], i % 2 ? "#d9d4c4" : "#b8342a", { ink: false }); }
};
/** A guard tower: a plated cabin on four legs, a searchlight on the rail. */
const guardTower: Builder = (m, r, S, _r, look) => {
  const L = S.looks?.[look] ?? {}, h = L.h ?? 2.4, M = S.mat, i = Math.min(r.w, r.d) * 0.1, z0 = h * 0.56, z1 = h * 0.84, f = frontOf(r);
  const q = rc(r.cx, r.cy, r.w - 2 * i, r.d - 2 * i);
  for (const [x, y] of [[q.x0, q.y0], [q.x1, q.y0], [q.x0, q.y1], [q.x1, q.y1]]) m.box(x - 0.04, y - 0.04, 0, x + 0.04, y + 0.04, z0, M.metal);
  for (const s of SIDES) { const a = onSide(q, s, 0, 0.05), b = onSide(q, s, 1, 0.05); m.panel([a, [a[0], a[1], 0.12], [b[0], b[1], z0], [b[0], b[1], z0 - 0.07]], M.metal, { ink: false }); m.panel([b, [b[0], b[1], 0.12], [a[0], a[1], z0], [a[0], a[1], z0 - 0.07]], M.metal, { ink: false }); }
  m.box(r.x0, r.y0, z0, r.x1, r.y1, z0 + 0.06, M.timberDark);
  m.box(r.x0, r.y0, z0 + 0.06, r.x1, r.y1, z0 + (z1 - z0) * 0.55, L.wall ?? M.stone, M.timberDark);
  for (const [x, y] of [[r.x0 + 0.03, r.y0 + 0.03], [r.x1 - 0.03, r.y0 + 0.03], [r.x0 + 0.03, r.y1 - 0.03], [r.x1 - 0.03, r.y1 - 0.03]]) m.box(x - 0.03, y - 0.03, z0 + (z1 - z0) * 0.55, x + 0.03, y + 0.03, z1, M.metal);
  m.box(r.x0 - 0.08, r.y0 - 0.08, z1, r.x1 + 0.08, r.y1 + 0.08, z1 + 0.07, L.roofC ?? M.roof);
  for (const s of SIDES) onWall(m, r, s, 0.5, lenOf(r, s) * 0.8, z0 + 0.1, 0.1, M.sack, { ink: false });
  const lp = onSide(r, f, 0.5, z0 + (z1 - z0) * 0.62), o = OUT[f];
  m.box(lp[0] - 0.07, lp[1] - 0.07, lp[2], lp[0] + 0.07, lp[1] + 0.07, lp[2] + 0.13, DARK);
  m.decal([lp[0] - Math.abs(o[1]) * 0.06 + o[0] * 0.07, lp[1] - Math.abs(o[0]) * 0.06 + o[1] * 0.07, lp[2] + 0.015], [lp[0] + Math.abs(o[1]) * 0.06 + o[0] * 0.07, lp[1] + Math.abs(o[0]) * 0.06 + o[1] * 0.07, lp[2] + 0.015], 0.1, M.glow, o, { flat: true, ink: false });
};
/** A lattice mast from z0 to z1 at (x, y): tapering legs, braces, antennas; returns its blinking light. */
function lattice(m: Mesh, x: number, y: number, z0: number, z1: number, w: number, S: WorldStyle): (t: number) => Face[] {
  const M = S.mat, n = 5;
  for (let k = 0; k < n; k++) {
    const a = z0 + ((z1 - z0) * k) / n, b = z0 + ((z1 - z0) * (k + 1)) / n, wa = w * (1 - (0.75 * k) / n), wb = w * (1 - (0.75 * (k + 1)) / n);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) beam(m, [x + sx * wa, y + sy * wa, a], [x + sx * wb, y + sy * wb, b], 0.018, M.metal);
    for (const s of [-1, 1]) { m.panel([[x - wa, y + s * wa, a], [x - wa, y + s * wa, a + 0.03], [x + wb, y + s * wb, b], [x + wb, y + s * wb, b - 0.03]], M.metal, { ink: false }); m.panel([[x + s * wa, y - wa, a], [x + s * wa, y - wa, a + 0.03], [x + s * wb, y + wb, b], [x + s * wb, y + wb, b - 0.03]], M.metal, { ink: false }); }
  }
  for (const [dz, s] of [[0.62, 1], [0.78, -1]]) { const z = z0 + (z1 - z0) * dz; m.prism(x + s * 0.12, y, z, z + 0.05, 0.1, 8, "#c9cdc8", 0.1, "#9aa0a2", 0, { ink: false }); }
  m.box(x - 0.012, y - 0.012, z1, x + 0.012, y + 0.012, z1 + 0.3, M.metal);
  return (t) => { const a = new Mesh(); if (Math.sin(t * 3.2 + x) > 0.2) a.prism(x, y, z1 + 0.3, z1 + 0.37, 0.035, 5, WARN, 0.02, WARN, 0, { flat: true, ink: false }); return a.faces; };
}
/** A comms relay: an equipment bunker with a tall lattice mast, dishes and a red light. */
const relay: Builder = (m, r, S, rnd, look) => {
  const L = S.looks?.[look] ?? {}, ax = r.w >= r.d, t = Math.min(r.w, r.d) * 0.7, hh = (L.h ?? 1.0) * 0.8;
  const hut = ax ? rc(r.cx + t / 2, r.cy, r.w - t, r.d) : rc(r.cx, r.cy + t / 2, r.w, r.d - t), st = ax ? rc(r.x0 + t / 2, r.cy, t, Math.min(r.d, t)) : rc(r.cx, r.y0 + t / 2, Math.min(r.w, t), t);
  block(m, hut, S, rnd, { h: hh, wall: L.wall ?? S.mat.stone, roofC: S.mat.roof2, door: 0.26 });
  m.box(st.x0, st.y0, 0, st.x1, st.y1, 0.12, S.mat.stoneDark);
  return lattice(m, st.cx, st.cy, 0.12, 2.5, Math.min(st.w, st.d) * 0.42, S);
};
/** A radar station: a round concrete drum with a dish that turns. */
const radar: Builder = (m, r, S, _r, look) => {
  const L = S.looks?.[look] ?? {}, h = (L.h ?? 1.7) * 0.6, rad = Math.min(r.w, r.d) / 2, M = S.mat;
  m.prism(r.cx, r.cy, 0, h, rad, 10, L.wall ?? M.stone, rad * 0.86, M.stoneDark);
  m.prism(r.cx, r.cy, h, h + 0.26, rad * 0.3, 6, M.metal, rad * 0.2);
  onWall(m, rc(r.cx, r.cy, rad * 1.4, rad * 1.9), frontOf(r), 0.5, 0.26, 0, 0.46, M.door);
  const z = h + 0.26;
  return (t) => {
    const a = new Mesh(), g = t * 0.8, c = Math.cos(g), s = Math.sin(g), R = Math.max(0.5, rad * 1.05);
    const p = (u: number, v: number, o: number): P3 => [r.cx + c * u - s * o, r.cy + s * u + c * o, z + v];
    a.panel([p(-R, 0.02, 0.1), p(R, 0.02, 0.1), p(R * 0.86, 0.62, 0.34), p(-R * 0.86, 0.62, 0.34)], "#b9bfbc", { bias: 0.2 });
    a.panel([p(-R * 0.86, 0.62, 0.34), p(R * 0.86, 0.62, 0.34), p(R * 0.86, 0.66, 0.3), p(-R * 0.86, 0.66, 0.3)], M.metal, { bias: 0.25, ink: false });
    a.panel([p(-0.03, 0, 0), p(0.03, 0, 0), p(0.03, 0.4, 0.24), p(-0.03, 0.4, 0.24)], M.metal, { ink: false });
    return a.faces;
  };
};
/** A vehicle checkpoint gate: two concrete piers, a gantry with hazard paint, blast walls each side. */
const gate: Builder = (m, r, S, _r, look) => {
  const L = S.looks?.[look] ?? {}, h = L.h ?? 1.3, c = L.wall ?? S.mat.stone, ax = r.w >= r.d, t = Math.min((ax ? r.w : r.d) * 0.28, 0.55), M = S.mat;
  const A = ax ? rc(r.x0 + t / 2, r.cy, t, r.d) : rc(r.cx, r.y0 + t / 2, r.w, t), B = ax ? rc(r.x1 - t / 2, r.cy, t, r.d) : rc(r.cx, r.y1 - t / 2, r.w, t);
  for (const q of [A, B]) { m.box(q.x0, q.y0, 0, q.x1, q.y1, h, c, M.stoneDark); for (const s of SIDES) onWall(m, q, s, 0.5, lenOf(q, s), 0.1, 0.12, HAZ, { ink: false }); }
  const G = ax ? rc(r.cx, r.cy, r.w - 2 * t + 0.1, r.d * 0.5) : rc(r.cx, r.cy, r.w * 0.5, r.d - 2 * t + 0.1);
  m.box(G.x0, G.y0, h * 0.82, G.x1, G.y1, h, M.metal, M.roof);
  for (const s of (ax ? ["y0", "y1"] : ["x0", "x1"]) as Side[]) { onWall(m, G, s, 0.5, lenOf(G, s) * 0.9, h * 0.86, h * 0.08, HAZ, { ink: false }); onWall(m, G, s, 0.2, 0.07, h * 0.74, 0.07, M.glow, { flat: true, ink: false }); onWall(m, G, s, 0.8, 0.07, h * 0.74, 0.07, WARN, { flat: true, ink: false }); }
};

// ------------------------------------------------------------------------------------------------ cover and clutter
/** Rubble: tilted slabs of broken concrete and a thicket of rebar. */
const rubble: Builder = (m, r, S, rnd, look) => {
  const h = hOf(S, look, 0.8), n = Math.max(2, Math.round((r.w * r.d) / 0.3)), M = S.mat;
  m.box(r.x0 + r.w * 0.06, r.y0 + r.d * 0.06, 0, r.x1 - r.w * 0.06, r.y1 - r.d * 0.06, h * 0.22, M.rock, M.stoneDark);
  for (let i = 0; i < n + 2; i++) {
    const x = r.x0 + r.w * (0.2 + rnd() * 0.6), y = r.y0 + r.d * (0.2 + rnd() * 0.6), rad = Math.min(r.w, r.d) * (0.2 + rnd() * 0.2), z = h * (0.3 + rnd() * 0.6);
    m.prism(x, y, 0, z, Math.min(rad, x - r.x0, r.x1 - x, y - r.y0, r.y1 - y), 4, i % 2 ? M.stone : M.rock, rad * (0.3 + rnd() * 0.4), M.stoneDark, rnd() * 3);
    if (i % 2) beam(m, [x, y, z * 0.6], [x + (rnd() - 0.5) * 0.3, y + (rnd() - 0.5) * 0.3, z + 0.25 + rnd() * 0.2], 0.012, RUST);
  }
};
/** A fuel tank on a bund. */
const tank: Builder = (m, r, S) => {
  const rad = Math.min(r.w, r.d) / 2, M = S.mat;
  m.prism(r.cx, r.cy, 0, 0.1, rad, 10, M.stoneDark);
  m.prism(r.cx, r.cy, 0.1, 0.78, rad * 0.8, 10, M.metal, rad * 0.8, M.roof);
  m.prism(r.cx, r.cy, 0.4, 0.5, rad * 0.815, 10, HAZ, rad * 0.815, HAZ, undefined, { ink: false });
  m.prism(r.cx, r.cy, 0.78, 0.86, rad * 0.2, 6, M.stoneDark);
};
/** Dragon's teeth: a cluster of concrete pyramids. */
const teeth: Builder = (m, r, S) => {
  const nx = Math.max(1, Math.round(r.w / 0.42)), ny = Math.max(1, Math.round(r.d / 0.42)), s = Math.min(r.w / nx, r.d / ny) * 0.42;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = r.x0 + (i + 0.5) * (r.w / nx), y = r.y0 + (j + 0.5) * (r.d / ny); m.prism(x, y, 0, 0.14, s * 1.25, 4, S.mat.stoneDark, s * 1.25, S.mat.stoneDark, Math.PI / 4); m.prism(x, y, 0.14, 0.14 + s * 2.6, s, 4, S.mat.stone, s * 0.3, S.mat.stoneDark, Math.PI / 4); }
};
/** Steel hedgehogs: three crossed girders each. */
const hedgehogs: Builder = (m, r, S, rnd, look) => {
  const h = hOf(S, look, 0.55), ax = r.w >= r.d, n = Math.max(1, Math.round((ax ? r.w : r.d) / 0.55));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = ax ? r.x0 + r.w * t : r.cx, y = ax ? r.cy : r.y0 + r.d * t, k = h * 0.55, tw = rnd() * 3;
    for (let j = 0; j < 3; j++) { const a = tw + (j * Math.PI * 2) / 3, dx = Math.cos(a) * k, dy = Math.sin(a) * k; beam(m, [x - dx, y - dy, 0.02], [x + dx * 0.6, y + dy * 0.6, h], 0.035, j % 2 ? RUST : S.mat.metal); }
  }
};
/** Shipping containers on big footprints (some stacked), ammo crates on small ones. */
const containers: Builder = (m, r, S, rnd, look) => {
  const ax = r.w >= r.d, L = ax ? r.w : r.d, wd = ax ? r.d : r.w;
  if (wd < 0.55 || L < 0.9) {
    const h = hOf(S, look, 0.5), n = Math.max(1, Math.round(L / 0.45));
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, g = 0.02, hh = h * (0.6 + rnd() * 0.4), q = ax ? rc(r.x0 + r.w * (a + b) / 2, r.cy, r.w / n - g, r.d - g) : rc(r.cx, r.y0 + r.d * (a + b) / 2, r.w - g, r.d / n - g), c = i % 2 ? "#59604a" : "#4a5039";
      m.box(q.x0, q.y0, 0, q.x1, q.y1, hh, c, "#646b52");
      for (const s of SIDES) { onWall(m, q, s, 0.5, lenOf(q, s) * 0.96, hh * 0.72, hh * 0.08, DARK, { ink: false }); onWall(m, q, s, 0.5, 0.1, hh * 0.3, hh * 0.2, HAZ, { ink: false }); }
      if (rnd() > 0.5) { const k = Math.min(q.w, q.d) * 0.32; m.box(q.cx - k, q.cy - k, hh, q.cx + k, q.cy + k, hh + k * 1.3, "#6b5a44", "#7a6a52"); }
    }
    return;
  }
  const n = Math.max(1, Math.round(wd / 0.62)), ch = 0.62;
  for (let i = 0; i < n; i++) {
    const a = i / n, b = (i + 1) / n, g = 0.03, q = ax ? rc(r.cx, r.y0 + r.d * (a + b) / 2, r.w - g, r.d / n - g) : rc(r.x0 + r.w * (a + b) / 2, r.cy, r.w / n - g, r.d - g);
    const levels = rnd() < 0.35 ? 2 : 1;
    for (let k = 0; k < levels; k++) {
      const c = CONT[Math.floor(rnd() * CONT.length)], z = k * ch, sh = k ? 0.06 : 0, qq = ax ? rc(q.cx + sh, q.cy, q.w - 0.1 * k, q.d) : rc(q.cx, q.cy + sh, q.w, q.d - 0.1 * k);
      m.box(qq.x0, qq.y0, z, qq.x1, qq.y1, z + ch, c);
      for (const s of (ax ? ["y0", "y1"] : ["x0", "x1"]) as Side[]) { const nn = Math.round(lenOf(qq, s) / 0.14); for (let j = 0; j < nn; j++) onWall(m, qq, s, (j + 0.5) / nn, 0.035, z + 0.05, ch - 0.1, DARK, { ink: false, alpha: 0.35, flat: true }); }
      for (const s of (ax ? ["x0", "x1"] : ["y0", "y1"]) as Side[]) { onWall(m, qq, s, 0.5, 0.02, z + 0.04, ch - 0.08, DARK, { ink: false }); for (const t of [0.3, 0.7]) onWall(m, qq, s, t, 0.02, z + 0.1, ch - 0.2, STEEL, { ink: false }); }
    }
  }
};
const drums: Builder = (m, r, _S, rnd) => {
  const rad = Math.min(0.19, Math.min(r.w, r.d) / 2), nx = Math.max(1, Math.floor(r.w / (rad * 2))), ny = Math.max(1, Math.floor(r.d / (rad * 2)));
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x = r.x0 + (i + 0.5) * (r.w / nx), y = r.y0 + (j + 0.5) * (r.d / ny), hh = 0.44 + rnd() * 0.06, c = ["#6e4a36", "#4a5357", "#59604a", "#5a2f2a"][Math.floor(rnd() * 4)];
    m.prism(x, y, 0, hh, rad * 0.92, 8, c, rad * 0.92, DARK);
    m.prism(x, y, hh * 0.55, hh * 0.7, rad * 0.95, 8, HAZ, rad * 0.95, HAZ, undefined, { ink: false });
  }
};
/** Stacks of tyres. */
const tyres: Builder = (m, r) => {
  const rad = Math.min(r.w, r.d) / 2, n = Math.max(1, Math.round(Math.max(r.w, r.d) / (rad * 2))), ax = r.w >= r.d;
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = ax ? r.x0 + r.w * t : r.cx, y = ax ? r.cy : r.y0 + r.d * t; for (let k = 0; k < 4; k++) m.prism(x + (k % 2) * 0.02, y, k * 0.15, k * 0.15 + 0.14, rad * 0.9, 9, "#1e1f21", rad * 0.9, k === 3 ? "#0c0c0d" : "#1e1f21"); }
};
/** A camouflage net over stores. */
const netTent: Builder = (m, r, S, rnd) => {
  const M = S.mat, h = 0.8, ax = r.w >= r.d;
  m.box(r.x0 + 0.08, r.y0 + 0.08, 0, r.x1 - 0.08, r.y1 - 0.08, 0.26, "#59604a", "#646b52");
  if (rnd() > 0.4) m.box(r.cx - 0.12, r.cy - 0.12, 0.26, r.cx + 0.12, r.cy + 0.12, 0.44, "#6b5a44");
  for (const [x, y] of [[r.x0 + 0.03, r.y0 + 0.03], [r.x1 - 0.03, r.y0 + 0.03], [r.x0 + 0.03, r.y1 - 0.03], [r.x1 - 0.03, r.y1 - 0.03]]) m.box(x - 0.02, y - 0.02, 0, x + 0.02, y + 0.02, h * 0.8, M.metal);
  m.gable(r.x0 - 0.1, r.y0 - 0.1, r.x1 + 0.1, r.y1 + 0.1, h * 0.8, 0.24, M.cloth, ax ? "x" : "y", M.foliage2, { ink: false, two: true });
};
/** A burnt-out truck (a cab and a flatbed) or, on small footprints, a car. */
const truck: Builder = (m, r, _S, rnd, look) => {
  const ax = r.w >= r.d, big = look === "wagon", z0 = 0.16, i = 0.05, body = "#4a3a30", L = ax ? r.w : r.d, flip = rnd() > 0.5;
  const part = (a: number, b: number, zt: number, c: string, top = c) => { const lo = flip ? 1 - b : a, hi = flip ? 1 - a : b; if (ax) m.box(r.x0 + i + (L - 2 * i) * lo, r.y0 + i, z0, r.x0 + i + (L - 2 * i) * hi, r.y1 - i, zt, c, top); else m.box(r.x0 + i, r.y0 + i + (L - 2 * i) * lo, z0, r.x1 - i, r.y0 + i + (L - 2 * i) * hi, zt, c, top); };
  part(0, 1, z0 + 0.1, DARK);
  part(0, 0.3, big ? 0.72 : 0.5, body, SOOT); part(0.3, 0.36, 0.4, DARK); part(0.36, 1, big ? 0.46 : 0.36, RUST, SOOT);
  const wr = big ? 0.19 : 0.15;
  for (const u of [0.18, 0.8]) for (const s of [0, 1]) {
    const x = ax ? r.x0 + r.w * u : (s ? r.x1 - 0.03 : r.x0 + 0.03), y = ax ? (s ? r.y1 - 0.03 : r.y0 + 0.03) : r.y0 + r.d * u;
    m.panel(Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return (ax ? [x + Math.cos(a) * wr, y, wr + Math.sin(a) * wr] : [x, y + Math.cos(a) * wr, wr + Math.sin(a) * wr]) as P3; }), "#111213", { bias: 0.1 });
  }
};

// ------------------------------------------------------------------------------------------------ trees, lamps
/** What stands where the base game plants a tree: a dead tree, a utility pole or a burnt stump. */
export function tree(m: Mesh, x: number, y: number, s: number, S: WorldStyle, rnd: Rnd, kind = S.tree) {
  if (kind !== "dead") return baseTree(m, x, y, s, S, rnd, kind);
  const k = rnd();
  if (k < 0.5) return baseTree(m, x, y, s, S, rnd, kind);
  if (k < 0.8) {
    m.prism(x, y, 0, 1.5 * s, 0.035 * s, 5, S.mat.trunk, 0.028 * s);
    const a = rnd() * Math.PI, dx = Math.cos(a) * 0.3 * s, dy = Math.sin(a) * 0.3 * s;
    for (const z of [1.3, 1.42]) m.panel([[x - dx, y - dy, z * s], [x + dx, y + dy, z * s], [x + dx, y + dy, z * s + 0.035], [x - dx, y - dy, z * s + 0.035]], S.mat.trunk, { ink: false });
  } else { m.prism(x, y, 0, 0.32 * s, 0.09 * s, 5, SOOT, 0.05 * s, SOOT); m.prism(x + 0.1 * s, y, 0, 0.12 * s, 0.05 * s, 4, SOOT, 0.02 * s); }
}
/** A floodlight mast. */
export function lamp(m: Mesh, x: number, y: number, S: WorldStyle) {
  m.prism(x, y, 0, 1.25, 0.03, 5, S.mat.metal, 0.022);
  m.box(x - 0.12, y - 0.05, 1.25, x + 0.12, y + 0.05, 1.36, DARK);
  m.panel([[x - 0.1, y + 0.052, 1.27], [x + 0.1, y + 0.052, 1.27], [x + 0.1, y + 0.052, 1.34], [x - 0.1, y + 0.052, 1.34]], S.mat.glow, { flat: true, ink: false, bias: 0.2 });
}

/** The scenery ring round the battlefield uses the same block houses and rubble. */
export function sceneryHouse(m: Mesh, x: number, y: number, w: number, d: number, S: WorldStyle, rnd: Rnd) { house(m, rc(x, y, w, d), S, rnd, "house"); }
export function sceneryRock(m: Mesh, x: number, y: number, s: number, S: WorldStyle, rnd: Rnd) { rubble(m, rc(x, y, s, s * 0.8), S, rnd, "rock"); }

Object.assign(BUILDERS, {
  wall: blastWall, palisade: baskets, "hedge-wall": netFence,
  building: house, house, hall, tower: guardTower, barn: hangar, shop: checkpoint, chapel: relay, mill: radar, gatehouse: gate, rock: rubble, well: tank, statue: teeth,
  barricade: hedgehogs, logs: jersey, wagon: truck, cart: truck,
  cover: containers, crates: containers, fence: chainLink, barrels: drums, haystack: tyres, stall: netTent, fountain: tank,
} satisfies Record<string, Builder>);
Object.assign(HEIGHT, { wall: 1.2, palisade: 0.9, "hedge-wall": 0.85, house: 1.25, building: 1.25, hall: 1.75, tower: 2.5, barn: 1.5, shop: 1.1, chapel: 2.9, mill: 1.9, gatehouse: 1.35, rock: 0.9, well: 0.9, statue: 0.7, barricade: 0.55, logs: 0.5, wagon: 0.75, cart: 0.55, crates: 0.7, cover: 0.7, fence: 0.55, barrels: 0.5, haystack: 0.6, stall: 0.9, fountain: 0.9 });
