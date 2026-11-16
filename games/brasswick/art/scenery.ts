// Brasswick's street furniture and skyline: the models arenas, keeps, maps and key art are dressed with.
import { Model, mat, type Material, type V3 } from "../../../artkit/toon3d";
import { P, boiler, gear, puff, stack } from "./parts";

export const S = {
  brick: mat("#9a5a48"), brickDk: mat("#6e3f36"), brickLt: mat("#b8755c"),
  stone: mat("#a79b8c"), stoneDk: mat("#7a7068"), stoneLt: mat("#c9bda9"),
  slate: mat("#4d5563"), slateDk: mat("#363c48"), tile: mat("#7f4a3c"),
  plank: mat("#8a6242"), plankDk: mat("#5f422d"),
  canvas: mat("#d9cdb2"), verdigris: mat("#5fae98", { metal: 0.4 }),
  window: mat("#ffd98a", { emit: 1, glow: 0.5 }), windowOff: mat("#3a4656", { metal: 0.6 }),
  snow: mat("#f2f6fb"), ice: mat("#bfe6f5", { metal: 0.8 }), coal: mat("#2a2a30"),
  water: mat("#4e7f8f", { metal: 0.7 }), molten: mat("#ffb347", { emit: 1, glow: 0.8 }),
  marble: mat("#e9e2d6"), carpet: mat("#b03a35"), foliage: mat("#5d8f52"), foliageDk: mat("#3f6d44"),
};

/** A gas lamp post: iron column, a lantern of gaslight on top (or on an arm reaching `arm` units along +x). */
export function lampPost(m: Model, h = 1.5, arm = 0, lit: Material = P.lamp) {
  m.cylinder([0, 0, 0], [0, 0, 0.14], 0.11, P.ironDk, 0.07, { segs: 8 });
  m.cylinder([0, 0, 0.1], [0, 0, h], 0.04, P.ironDk, 0.03, { segs: 6 });
  const top: V3 = [arm, 0, h];
  if (arm) m.tube([[0, 0, h - 0.1], [arm * 0.5, 0, h + 0.06], [arm, 0, h]], 0.025, P.ironDk, { segs: 5 });
  m.group(() => { m.cylinder(top, [top[0], 0, h + 0.05], 0.1, P.brassDk, 0.08, { segs: 8 }); m.cone([top[0], 0, h + 0.3], [top[0], 0, h + 0.44], 0.13, P.ironDk, { segs: 8 }); });
  m.cylinder([top[0], 0, h + 0.05], [top[0], 0, h + 0.3], 0.075, lit, 0.11, { segs: 8 });
}
/** A brick building: body w (along x) by d (along y) by h, a pitched or flat roof, chimneys, rows of windows.
 *  Its front faces +y... in model terms, the face at +x is the front; turn it with the item's yaw. */
export function house(m: Model, o: { w: number; d: number; h: number; wall?: Material; roof?: Material; flat?: boolean; lit?: number; chimneys?: number; trim?: Material; seed?: number }) {
  const { w, d, h } = o, wall = o.wall ?? S.brick, roof = o.roof ?? S.slate, seed = o.seed ?? 1;
  m.box([0, 0, h / 2], [d, w, h], wall);
  m.box([0, 0, 0.08], [d + 0.06, w + 0.06, 0.16], S.stoneDk);
  if (o.flat) { m.box([0, 0, h + 0.05], [d + 0.12, w + 0.12, 0.1], o.trim ?? S.stone); }
  else {
    // ridge along the building's width
    const rh = Math.min(d * 0.45, 0.9);
    m.with(() => { m.move(0, 0, h).rotZ(90); m.extrude([[-d / 2 - 0.08, 0], [d / 2 + 0.08, 0], [0, rh]].map(([x, z]) => [x, z] as [number, number]), w + 0.12, roof); });
  }
  // windows on the front (+x) and the two ends
  const rows = Math.max(1, Math.floor(h / 0.75)), cols = Math.max(1, Math.floor(w / 0.7));
  m.decal(0.02, () => m.group(() => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = ((c * 7 + r * 13 + seed * 5) % 10) / 10 < (o.lit ?? 0.5);
      m.box([d / 2 + 0.005, -w / 2 + (c + 0.5) * (w / cols), 0.42 + r * 0.72], [0.03, 0.26, 0.38], on ? S.window : S.windowOff);
    }
  }));
  m.decal(0.03, () => m.group(() => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) m.box([d / 2 + 0.01, -w / 2 + (c + 0.5) * (w / cols), 0.21 + r * 0.72], [0.05, 0.34, 0.05], o.trim ?? S.stone); }));
  for (let i = 0; i < (o.chimneys ?? 1); i++) m.with(() => {
    m.move(-d * 0.15, -w * 0.3 + i * w * 0.55, h + (o.flat ? 0.1 : 0.2));
    m.box([0, 0, 0.3], [0.26, 0.26, 0.6], S.brickDk);
    m.cylinder([0, 0, 0.6], [0, 0, 0.78], 0.07, P.ironDk, 0.08, { segs: 6 });
  });
}
/** A tall brick factory chimney with a banded top, smoking. */
export function smokestack(m: Model, h = 4, r = 0.34, smoke = true, col: Material = S.brick) {
  m.cylinder([0, 0, 0], [0, 0, h], r, col, r * 0.62, { segs: 10 });
  m.cylinder([0, 0, 0], [0, 0, 0.3], r * 1.15, S.stoneDk, r * 1.1, { segs: 10 });
  m.cylinder([0, 0, h - 0.3], [0, 0, h], r * 0.72, S.brickDk, r * 0.7, { segs: 10 });
  m.cylinder([0, 0, h * 0.62], [0, 0, h * 0.62 + 0.12], r * 0.82, S.stone, r * 0.8, { segs: 10 });
  if (smoke) for (let i = 0; i < 3; i++) puff(m, [0.12 * i, 0, h + 0.25 + i * 0.4], 0.3 + i * 0.12, 0.5, P.smoke, i + 2);
}
/** A low wall segment along y (length len), with a coping. */
export function wallSeg(m: Model, len: number, h = 0.32, col: Material = S.brick, cap: Material = S.stone) {
  m.box([0, 0, h / 2], [0.22, len, h], col);
  m.box([0, 0, h + 0.03], [0.3, len + 0.02, 0.07], cap);
}
/** Iron railings along y: posts with finials and two rails. */
export function railing(m: Model, len: number, h = 0.42, col: Material = P.ironDk, tip: Material = P.brass) {
  const n = Math.max(2, Math.round(len / 0.3));
  m.group(() => {
    for (let i = 0; i <= n; i++) { const y = -len / 2 + (i / n) * len; m.cylinder([0, y, 0], [0, y, h], 0.022, col, 0.022, { segs: 5 }); }
    for (const z of [h * 0.3, h * 0.82]) m.box([0, 0, z], [0.03, len, 0.035], col);
  });
  m.group(() => { for (let i = 0; i <= n; i += 2) { const y = -len / 2 + (i / n) * len; m.cone([0, y, h], [0, y, h + 0.1], 0.035, tip, { segs: 5 }); } });
}
/** A stone or iron gate pillar with a lamp on top. */
export function pillar(m: Model, h = 0.9, col: Material = S.stone, lit: Material | null = P.lamp) {
  m.box([0, 0, h / 2], [0.4, 0.4, h], col);
  m.box([0, 0, h + 0.04], [0.5, 0.5, 0.08], S.stoneDk);
  m.box([0, 0, 0.07], [0.5, 0.5, 0.14], S.stoneDk);
  if (lit) { m.cylinder([0, 0, h + 0.08], [0, 0, h + 0.3], 0.1, lit, 0.13, { segs: 8 }); m.cone([0, 0, h + 0.3], [0, 0, h + 0.42], 0.15, P.ironDk, { segs: 8 }); }
}
/** A run of fat pipe along y at height z, on brackets, with flanges. */
export function pipeRun(m: Model, len: number, z = 0.5, r = 0.14, col: Material = P.copper) {
  m.cylinder([0, -len / 2, z], [0, len / 2, z], r, col, r, { segs: 10 });
  m.group(() => { for (let y = -len / 2 + 0.3; y < len / 2; y += 1.1) m.cylinder([0, y - 0.04, z], [0, y + 0.04, z], r * 1.25, P.brass, r * 1.25, { segs: 10 }); });
  m.group(() => { for (let y = -len / 2 + 0.6; y < len / 2; y += 1.4) m.box([0, y, z / 2], [0.08, 0.08, z], P.ironDk); });
}
/** A gasometer: a wide riveted drum inside a ring of iron columns. */
export function gasometer(m: Model, r = 1.6, h = 2.2, col: Material = S.verdigris) {
  m.cylinder([0, 0, 0], [0, 0, h * 0.7], r, col, r, { segs: 16 });
  m.ellipsoid([0, 0, h * 0.7], [r, r, r * 0.22], col, { segs: 16 });
  for (const z of [h * 0.2, h * 0.45]) m.cylinder([0, 0, z], [0, 0, z + 0.07], r * 1.02, P.ironDk, r * 1.02, { segs: 16 });
  m.group(() => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; m.cylinder([Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12, 0], [Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12, h], 0.06, P.ironDk, 0.06, { segs: 5 }); } m.torus([0, 0, h], [0, 0, 1], r * 1.12, 0.05, P.ironDk, { segs: 20 }); });
}
/** A wooden crate (size s) with iron corners. */
export function crate(m: Model, s = 0.5, col: Material = S.plank) {
  m.box([0, 0, s / 2], [s, s, s], col);
  m.decal(0.01, () => m.group(() => { for (const z of [0.06, s - 0.06]) m.box([0, 0, z], [s + 0.02, s + 0.02, 0.07], S.plankDk); }));
}
/** A barrel standing on end. */
export function barrel(m: Model, r = 0.24, h = 0.6, col: Material = S.plank, hoop: Material = P.ironDk) {
  m.lathe([[r * 0.8, 0], [r, h * 0.3], [r, h * 0.7], [r * 0.8, h], [0, h]], col, { smooth: true, segs: 12 });
  for (const z of [h * 0.22, h * 0.78]) m.cylinder([0, 0, z - 0.025], [0, 0, z + 0.025], r * 0.98, hoop, r * 0.98, { segs: 12 });
}
/** A goods wagon on rails, running along y. */
export function wagon(m: Model, col: Material = P.team, load: Material | null = S.coal) {
  m.box([0, 0, 0.42], [0.9, 1.6, 0.5], col);
  m.box([0, 0, 0.2], [0.8, 1.7, 0.1], P.ironDk);
  if (load) m.ellipsoid([0, 0, 0.66], [0.38, 0.72, 0.2], load);
  m.group(() => { for (const y of [-0.5, 0.5]) for (const x of [-0.42, 0.42]) m.cylinder([x - 0.04, y, 0.14], [x + 0.04, y, 0.14], 0.15, P.ironDk, 0.15, { segs: 10 }); });
}
/** A dockside crane: a slewing cab on a tower with a jib and a hook. */
export function crane(m: Model, h = 3, jib = 2.4) {
  m.group(() => { for (const [x, y] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) m.cylinder([x, y, 0], [x * 0.5, y * 0.5, h], 0.06, P.ironDk, 0.05, { segs: 5 }); for (let z = 0.5; z < h; z += 0.7) m.box([0, 0, z], [0.5, 0.5, 0.05], P.ironDk); });
  m.box([0, 0, h + 0.25], [0.7, 0.6, 0.5], S.plank);
  m.decal(0.02, () => m.box([0.36, 0, h + 0.3], [0.02, 0.36, 0.22], S.window));
  m.tube([[0.2, 0, h + 0.4], [jib, 0, h + 1.1]], 0.07, P.ironDk, { segs: 6 });
  m.tube([[-0.2, 0, h + 0.9], [jib, 0, h + 1.1]], 0.025, P.iron, { segs: 4 });
  m.box([-0.3, 0, h + 0.7], [0.1, 0.1, 0.5], P.ironDk);
  m.tube([[jib, 0, h + 1.1], [jib, 0, h - 0.3]], 0.018, P.iron, { segs: 4 });
  m.tube([[jib, 0, h - 0.3], [jib + 0.1, 0, h - 0.45], [jib, 0, h - 0.55]], 0.03, P.brass, { segs: 5 });
}
/** A clock tower: square shaft, four faces, a spire. */
export function clockTower(m: Model, h = 5, w = 1.3) {
  m.box([0, 0, h / 2], [w, w, h], S.stone);
  m.box([0, 0, 0.15], [w + 0.2, w + 0.2, 0.3], S.stoneDk);
  m.box([0, 0, h - 0.95], [w + 0.14, w + 0.14, 0.1], S.stoneDk);
  m.box([0, 0, h + 0.05], [w + 0.2, w + 0.2, 0.12], S.stoneDk);
  m.decal(0.03, () => { for (const [dx, dy, rz] of [[1, 0, 0], [0, 1, 90], [-1, 0, 180], [0, -1, 270]]) m.with(() => { m.move(dx * w * 0.5, dy * w * 0.5, h - 0.45).rotZ(rz); m.cylinder([0, 0, 0], [0.03, 0, 0], w * 0.38, P.brass, w * 0.38, { segs: 14 }); m.decal(0.02, () => { m.cylinder([0.03, 0, 0], [0.04, 0, 0], w * 0.31, S.window, w * 0.31, { segs: 14 }); m.box([0.05, 0, w * 0.1], [0.02, 0.04, w * 0.24], P.soot); m.box([0.05, w * 0.07, 0.0], [0.02, w * 0.18, 0.04], P.soot); }); }); });
  m.decal(0.02, () => m.group(() => { for (let z = 0.6; z < h - 1.3; z += 0.8) m.box([w / 2 + 0.005, 0, z], [0.03, 0.22, 0.4], S.windowOff); }));
  m.cone([0, 0, h + 0.1], [0, 0, h + 1.5], w * 0.62, S.slate, { segs: 4 });
  m.sphere([0, 0, h + 1.55], 0.1, P.brass);
}
/** An airship: an envelope along x with fins, a gondola slung under it. Its origin is under the gondola, `alt` up. */
export function airship(m: Model, len = 4, alt = 3, env: Material = S.canvas, band: Material = P.team) {
  m.with(() => {
    m.move(0, 0, alt + len * 0.2);
    m.ellipsoid([0, 0, 0], [len / 2, len * 0.17, len * 0.17], env, { segs: 16 });
    m.decal(0.03, () => { for (const x of [-len * 0.22, 0, len * 0.22]) m.torus([x, 0, 0], [1, 0, 0], len * 0.17 * Math.sqrt(1 - (x / (len / 2)) ** 2) * 1.0, 0.035, band, { segs: 16 }); });
    for (const [y, z] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) m.with(() => { m.move(-len * 0.42, y * len * 0.1, z * len * 0.1); if (y) m.rotX(90); m.extrude([[0, 0], [-len * 0.16, z || y ? (z + Math.abs(y)) * len * 0.15 : 0], [-len * 0.22, (z + Math.abs(y)) * len * 0.15], [-len * 0.16, 0]], 0.04, band); });
    m.box([0.1, 0, -len * 0.2], [len * 0.3, len * 0.09, len * 0.07], S.plank);
    m.decal(0.02, () => m.box([0.1, len * 0.046, -len * 0.19], [len * 0.22, 0.02, len * 0.03], S.window));
    m.group(() => { for (const x of [-len * 0.1, len * 0.12, 0.3]) m.cylinder([x, 0, -len * 0.17], [x, 0, -len * 0.14], 0.02, P.ironDk, 0.02, { segs: 4 }); });
    m.with(() => { m.move(-len * 0.08, 0, -len * 0.2); m.rotZ(90); m.box([0, 0.02, 0], [0.5, 0.03, 0.08], P.woodDk); });
  });
}
/** A heap (coal, slag, snow, rubble). */
export const heap = (m: Model, r = 0.6, h = 0.4, col: Material = S.coal) => m.group(() => { m.ellipsoid([0, 0, 0], [r, r, h], col, { segs: 10 }); m.ellipsoid([r * 0.4, r * 0.3, 0], [r * 0.5, r * 0.5, h * 0.6], col, { segs: 8 }); });
/** A furnace: a brick kiln with a glowing mouth and a stub stack. */
export function furnace(m: Model, s = 1) {
  m.with(() => {
    m.scale(s);
    m.cylinder([0, 0, 0], [0, 0, 1.3], 0.8, S.brickDk, 0.6, { segs: 10 });
    m.ellipsoid([0, 0, 1.3], [0.6, 0.6, 0.3], S.brick, { segs: 10 });
    m.decal(0.03, () => m.with(() => { m.move(0.7, 0, 0.4); m.cylinder([0, 0, 0], [0.08, 0, 0], 0.3, P.ironDk, 0.3, { segs: 10 }); m.decal(0.02, () => m.cylinder([0.08, 0, 0], [0.09, 0, 0], 0.22, S.molten, 0.22, { segs: 10 })); }));
    m.with(() => { m.move(-0.2, 0, 1.5); stack(m, 0.16, 0.9); puff(m, [0, 0, 1.2], 0.26, 0.5, P.smoke, 3); });
    for (const z of [0.5, 1.0]) m.cylinder([0, 0, z], [0, 0, z + 0.08], 0.82 - z * 0.14, P.ironDk, 0.8 - z * 0.14, { segs: 10 });
  });
}
/** A great cog standing on edge (axis along x): scenery for the engine halls. */
export function bigGear(m: Model, r = 1.2, col: Material = P.brassDk, spin = 0) {
  m.with(() => { m.move(0, 0, r * 0.9).rotZ(90); gear(m, r, r * 0.16, col, 12, spin, P.ironDk); });
}
/** A steam tank on legs. */
export function tank(m: Model, r = 0.5, h = 1.2, col: Material = P.copper) {
  m.group(() => { for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.78; m.cylinder([Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, 0], [Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, 0.4], 0.05, P.ironDk, 0.05, { segs: 5 }); } });
  m.with(() => { m.move(0, 0, 0.35); boiler(m, r, h, col, P.brass); });
}
/** A market awning on poles reaching over +x: striped canvas. */
export function awning(m: Model, len = 1.6, reach = 0.9, col: Material = P.team) {
  m.group(() => { for (const y of [-len / 2, len / 2]) m.cylinder([reach, y, 0], [reach, y, 0.9], 0.03, P.woodDk, 0.03, { segs: 5 }); });
  m.poly([[0, -len / 2, 1.25], [reach + 0.1, -len / 2, 0.9], [reach + 0.1, len / 2, 0.9], [0, len / 2, 1.25]], col);
  m.decal(0.02, () => { for (let i = 0; i < 3; i++) { const y0 = -len / 2 + (i * 2 + 0.5) * (len / 6); m.poly([[0, y0, 1.252], [reach + 0.1, y0, 0.902], [reach + 0.1, y0 + len / 6, 0.902], [0, y0 + len / 6, 1.252]], S.canvas); } });
}
/** A snow-capped or plain bollard. */
export function bollard(m: Model, h = 0.5, col: Material = P.ironDk, cap: Material = P.brass) {
  m.cylinder([0, 0, 0], [0, 0, h], 0.12, col, 0.09, { segs: 8 });
  m.sphere([0, 0, h], 0.11, cap, { segs: 8 });
}
/** A street tree in a tub: round clipped crown. */
export function tree(m: Model, h = 1.4, col: Material = S.foliage) {
  m.cylinder([0, 0, 0], [0, 0, 0.25], 0.26, S.plankDk, 0.3, { segs: 8 });
  m.cylinder([0, 0, 0.2], [0, 0, h * 0.6], 0.06, P.woodDk, 0.05, { segs: 6 });
  m.group(() => { m.sphere([0, 0, h * 0.75], h * 0.36, col, { segs: 10 }); m.sphere([0.15, 0.1, h * 0.95], h * 0.24, col, { segs: 8 }); });
}
