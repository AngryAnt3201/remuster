// Dustline's town and country: the models arenas, keeps, maps and key art are dressed with. Fronts face +x; turn
// them with the scene item's yaw.
import { Model, mat, type Material, type V3 } from "../../../artkit/toon3d";
import { P, puff, saguaro, star, wheel } from "./parts";

export const S = {
  pine: mat("#c49a62"), pineDk: mat("#9a6e3e"), pineLt: mat("#dcb983"), grey: mat("#a39683"), greyDk: mat("#7a6c5c"),
  barn: mat("#a8402e"), barnDk: mat("#7a2a1e"), sage: mat("#8fa58a"), ochre: mat("#d9a441"), cream: mat("#efe2c0"), teal: mat("#5f9a96"),
  white: mat("#f4eee0"), adobe: mat("#d9a070"), adobeDk: mat("#b87c50"), adobeLt: mat("#ecc396"), plaster: mat("#f3ead6"),
  shingle: mat("#7a5a40"), shingleDk: mat("#553c2a"), tin: mat("#9aa3a8", { metal: 0.6 }), tile: mat("#c2553a"), tileDk: mat("#94382a"),
  window: mat("#2e3440", { metal: 0.6 }), lit: mat("#ffd98a", { emit: 1, glow: 0.5 }), door: mat("#5f3d20"),
  log: mat("#8a623e"), logDk: mat("#5f4028"), snow: mat("#f4f8fc"), ice: mat("#bfe6f5", { metal: 0.8 }),
  rock: mat("#c9683f"), rockDk: mat("#9a4630"), rockLt: mat("#e3a06a"), stone: mat("#a89c8c"), stoneDk: mat("#7b7066"),
  hay: mat("#e2c25a"), hayDk: mat("#b8963a"), canvas: mat("#eadfc2"), rope: mat("#d9c08a"), coal: mat("#2c2a2e"), oil: mat("#1f1c22", { metal: 0.7 }),
  leaf: mat("#8fae58"), leafDk: mat("#5f8a48"), pineTree: mat("#3f6e4c"), pineTreeDk: mat("#2c5440"), moss: mat("#9db88a"), palm: mat("#5fa05a"),
  water: mat("#5f9fb8", { metal: 0.7 }), swamp: mat("#4a6e58", { metal: 0.6 }), gold: mat("#ffd45e", { metal: 1 }), iron: mat("#3c3f48", { metal: 0.3 }),
  sign: mat("#f0e2b8"), signInk: mat("#3a2414"),
};

/** A false-front store: a plain shed behind a tall flat facade with a cornice and a sign, a porch roof on posts and
 *  a boardwalk. `w` runs along y, `d` back along -x, `h` is the shed's eaves. */
export function falseFront(m: Model, o: { w: number; d?: number; h?: number; wall?: Material; front?: Material; trim?: Material; awning?: Material | null; lit?: boolean; seed?: number; storeys?: number; sign?: boolean }) {
  const w = o.w, d = o.d ?? 2, h = o.h ?? 1.5, wall = o.wall ?? S.pine, front = o.front ?? wall, trim = o.trim ?? S.pineDk, seed = o.seed ?? 1, st = o.storeys ?? 1;
  const fh = h + 0.55 + 0.1 * (seed % 3), step = seed % 2 === 0;
  m.box([-d / 2, 0, h / 2], [d, w, h], wall);
  m.with(() => { m.move(-d / 2, 0, h).rotZ(90); m.extrude([[-w / 2 - 0.06, 0], [w / 2 + 0.06, 0], [0, 0.45]], d + 0.1, S.shingle); });
  // the facade
  m.box([0.04, 0, fh / 2], [0.1, w + 0.08, fh], front);
  if (step) m.box([0.04, 0, fh + 0.14], [0.1, w * 0.56, 0.28], front);
  m.box([0.06, 0, (step ? fh + 0.28 : fh) + 0.04], [0.18, (step ? w * 0.56 : w + 0.08) + 0.1, 0.08], trim);
  if (step) m.box([0.06, 0, fh + 0.03], [0.16, w + 0.16, 0.06], trim);
  if (o.sign !== false) m.decal(0.02, () => { m.box([0.095, 0, fh - 0.26], [0.02, w * 0.74, 0.3], S.sign); m.decal(0.01, () => m.group(() => { for (let i = 0; i < 5; i++) m.box([0.11, -w * 0.28 + i * w * 0.14, fh - 0.26], [0.01, w * 0.085, 0.12 + 0.04 * ((i + seed) % 2)], S.signInk); })); });
  // door and windows
  m.decal(0.02, () => m.group(() => {
    m.box([0.095, 0, 0.42], [0.02, 0.36, 0.72], S.door);
    for (const s of [1, -1]) if (w > 1.5) m.box([0.095, s * w * 0.3, 0.55], [0.02, 0.34, 0.42], o.lit ? S.lit : S.window);
    for (let k = 1; k < st; k++) for (const s of [1, 0, -1]) if (w > 1.5 || s === 0) m.box([0.095, s * w * 0.3, 0.55 + k * 0.85], [0.02, 0.28, 0.4], o.lit && (s + k + seed) % 2 ? S.lit : S.window);
  }));
  m.decal(0.03, () => m.group(() => { for (const s of [1, -1]) m.box([0.1, s * 0.09, 0.5], [0.012, 0.15, 0.3], trim); }));
  // porch
  if (o.awning !== null) {
    const ah = st > 1 ? 1.2 : 1.05;
    m.poly([[0.08, -w / 2, ah + 0.14], [0.8, -w / 2, ah], [0.8, w / 2, ah], [0.08, w / 2, ah + 0.14]], o.awning ?? S.shingleDk);
    m.group(() => { for (let y = -w / 2 + 0.06; y <= w / 2; y += (w - 0.12) / Math.max(1, Math.round(w / 1.1))) m.cylinder([0.74, y, 0.1], [0.74, y, ah], 0.035, trim, 0.035, { segs: 5 }); });
  }
  m.box([0.45, 0, 0.05], [0.9, w + 0.1, 0.1], S.pineDk);
}
/** An adobe house: thick walls, a parapet, roof beams poking out of the front, a ladder. */
export function adobe(m: Model, o: { w: number; d?: number; h?: number; wall?: Material; seed?: number; lit?: boolean; tile?: boolean }) {
  const w = o.w, d = o.d ?? 1.8, h = o.h ?? 1.3, wall = o.wall ?? S.adobe, seed = o.seed ?? 1;
  m.box([-d / 2, 0, h / 2], [d, w, h], wall);
  if (o.tile) m.with(() => { m.move(-d / 2, 0, h).rotZ(90); m.extrude([[-w / 2 - 0.1, 0], [w / 2 + 0.1, 0], [0, 0.4]], d + 0.16, S.tile); });
  else { m.box([-d / 2, 0, h + 0.07], [d + 0.06, w + 0.06, 0.14], wall); m.decal(0.01, () => m.box([-d / 2, 0, h + 0.145], [d - 0.2, w - 0.2, 0.01], S.adobeDk)); }
  m.group(() => { for (let y = -w / 2 + 0.25; y < w / 2 - 0.1; y += 0.42) m.cylinder([-0.1, y, h - 0.16], [0.16, y, h - 0.16], 0.05, S.logDk, 0.05, { segs: 6 }); });
  m.decal(0.02, () => m.group(() => { m.box([0.005, (seed % 2 ? 0.25 : -0.25) * w, 0.4], [0.02, 0.34, 0.7], S.door); m.box([0.005, (seed % 2 ? -0.22 : 0.22) * w, 0.62], [0.02, 0.3, 0.3], o.lit ? S.lit : S.window); }));
  if (seed % 3 === 0) m.group(() => { for (const y of [-0.12, 0.12]) m.cylinder([0.2, w * 0.4 + y, 0], [0.04, w * 0.4 + y, h + 0.2], 0.022, S.pineDk, 0.022, { segs: 4 }); for (let z = 0.25; z < h; z += 0.25) m.box([0.2 - z * 0.12, w * 0.4, z], [0.03, 0.26, 0.03], S.pineDk); });
}
/** A water tower: a banded tank on four braced legs under a conical roof, a spout. */
export function waterTower(m: Model, h = 2.6, r = 0.75, band: Material = P.team) {
  const z0 = h * 0.52;
  m.group(() => { for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) m.cylinder([x * r * 0.85, y * r * 0.85, 0], [x * r * 0.6, y * r * 0.6, z0], 0.06, S.pineDk, 0.05, { segs: 5 }); for (const [a, b] of [[1, -1], [-1, 1]]) for (const sx of [1, -1]) { m.tube([[sx * r * 0.8, a * r * 0.8, 0.2], [sx * r * 0.62, b * r * 0.62, z0 - 0.1]], 0.025, S.pineDk, { segs: 4 }); m.tube([[a * r * 0.8, sx * r * 0.8, 0.2], [b * r * 0.62, sx * r * 0.62, z0 - 0.1]], 0.025, S.pineDk, { segs: 4 }); } });
  m.cylinder([0, 0, z0 - 0.06], [0, 0, z0], r * 1.05, S.pineDk, r * 1.05, { segs: 12 });
  m.cylinder([0, 0, z0], [0, 0, h], r * 0.94, S.pine, r, { segs: 12 });
  for (const z of [z0 + (h - z0) * 0.22, z0 + (h - z0) * 0.72]) m.cylinder([0, 0, z], [0, 0, z + 0.07], r * 0.99, S.iron, r * 1.0, { segs: 12 });
  m.decal(0.012, () => m.cylinder([0, 0, z0 + (h - z0) * 0.38], [0, 0, z0 + (h - z0) * 0.6], r * 0.975, band, r * 0.99, { segs: 12 }));
  m.cone([0, 0, h], [0, 0, h + r * 0.55], r * 1.1, S.shingleDk, { segs: 12 });
  m.sphere([0, 0, h + r * 0.56], 0.07, S.iron, { segs: 6 });
  m.tube([[r * 0.9, 0, z0 + 0.15], [r * 1.5, 0, z0 - 0.1], [r * 1.7, 0, z0 - 0.5]], 0.05, S.iron, { segs: 5 });
}
/** A ranch windmill: a lattice tower, a fan of blades, a tail vane. */
export function windmill(m: Model, h = 3) {
  m.group(() => { for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) m.cylinder([x * 0.42, y * 0.42, 0], [x * 0.1, y * 0.1, h], 0.035, S.pineDk, 0.03, { segs: 4 }); for (let z = 0.5; z < h; z += 0.7) { const k = 0.42 - (0.32 * z) / h; m.box([0, 0, z], [k * 2, k * 2, 0.04], S.pineDk); } });
  m.with(() => { m.move(0.14, 0, h + 0.05); m.group(() => { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; m.poly([[0, Math.cos(a) * 0.14, Math.sin(a) * 0.14], [0.02, Math.cos(a - 0.14) * 0.62, Math.sin(a - 0.14) * 0.62], [0.02, Math.cos(a + 0.14) * 0.62, Math.sin(a + 0.14) * 0.62]], S.tin); } }); m.sphere([0, 0, 0], 0.08, S.iron, { segs: 6 }); });
  m.poly([[-0.1, 0, h + 0.05], [-0.7, 0, h + 0.25], [-0.9, 0, h + 0.05], [-0.7, 0, h - 0.15]], P.team);
}
/** A barrel standing on end. */
export function barrel(m: Model, r = 0.24, h = 0.6, col: Material = S.pine, hoop: Material = S.iron) {
  m.lathe([[r * 0.8, 0], [r, h * 0.3], [r, h * 0.7], [r * 0.8, h], [0, h]], col, { smooth: true, segs: 12 });
  for (const z of [h * 0.22, h * 0.78]) m.cylinder([0, 0, z - 0.025], [0, 0, z + 0.025], r * 0.98, hoop, r * 0.98, { segs: 12 });
}
/** A crate (size s) with battens. */
export function crate(m: Model, s = 0.5, col: Material = S.pine) {
  m.box([0, 0, s / 2], [s, s, s], col);
  m.decal(0.01, () => m.group(() => { for (const z of [0.06, s - 0.06]) m.box([0, 0, z], [s + 0.02, s + 0.02, 0.07], S.pineDk); }));
}
/** A hay bale lying along y, tied twice. */
export function hayBale(m: Model, w = 1, h = 0.5, d = 0.55) {
  m.box([0, 0, h / 2], [d, w, h], S.hay);
  m.decal(0.01, () => m.group(() => { for (const y of [-w * 0.25, w * 0.25]) m.box([0, y, h / 2], [d + 0.02, 0.04, h + 0.02], S.hayDk); }));
}
/** A water trough along y. */
export function trough(m: Model, len = 1.2) {
  m.box([0, 0, 0.2], [0.42, len, 0.3], S.pineDk);
  m.decal(0.02, () => m.box([0, 0, 0.352], [0.32, len - 0.1, 0.01], S.water));
  m.group(() => { for (const y of [-len * 0.4, len * 0.4]) m.box([0, y, 0.06], [0.5, 0.08, 0.12], S.pineDk); });
}
/** A post-and-rail fence along y (length len). */
export function fence(m: Model, len: number, h = 0.5, col: Material = S.pine) {
  const n = Math.max(1, Math.round(len / 0.7));
  m.group(() => { for (let i = 0; i <= n; i++) m.box([0, -len / 2 + (i / n) * len, h / 2], [0.07, 0.07, h + 0.06], col); });
  m.group(() => { for (const z of [h * 0.45, h * 0.9]) m.box([0, 0, z], [0.04, len, 0.06], col); });
}
/** A hitching rail along y. */
export function hitch(m: Model, len = 1.2) {
  m.group(() => { for (const y of [-len / 2, len / 2]) m.cylinder([0, y, 0], [0, y, 0.5], 0.04, S.pineDk, 0.04, { segs: 5 }); m.cylinder([0, -len / 2 - 0.08, 0.46], [0, len / 2 + 0.08, 0.46], 0.035, S.pineDk, 0.035, { segs: 5 }); });
}
/** A covered wagon running along y. */
export function wagon(m: Model, cover: Material | null = S.canvas, body: Material = S.pineDk) {
  m.box([0, 0, 0.45], [0.7, 1.4, 0.3], body);
  for (const y of [-0.45, 0.45]) for (const x of [-0.4, 0.4]) m.with(() => { m.move(x, y, 0.28).rotZ(90); wheel(m, 0.28, 20, S.pineDk, S.pine, 8); });
  if (cover) m.with(() => { m.move(0, 0, 0.6).rotZ(90); m.extrude([[-0.38, 0], [-0.36, 0.4], [-0.2, 0.62], [0.2, 0.62], [0.36, 0.4], [0.38, 0]], 1.3, cover); });
  m.cylinder([0, 0.7, 0.42], [0, 1.5, 0.3], 0.03, S.pineDk, 0.03, { segs: 4 });
}
/** A mesa: stacked slabs of red rock with a flat top. */
export function mesa(m: Model, w = 4, d = 3, h = 3, seed = 1) {
  const n = 3;
  for (let i = 0; i < n; i++) {
    const k = 1 - i * 0.16, z0 = (h * i) / n, z1 = (h * (i + 1)) / n;
    m.with(() => { m.rotZ(seed * 37 + i * 22); m.scale(1, d / w, 1); m.cylinder([0, 0, z0], [0, 0, z1], (w / 2) * k, i % 2 ? S.rock : S.rockDk, (w / 2) * (k - 0.07), { segs: 7 }); });
  }
  m.decal(0.01, () => m.with(() => { m.rotZ(seed * 37 + (n - 1) * 22); m.scale(1, d / w, 1); m.cylinder([0, 0, h - 0.02], [0, 0, h + 0.02], (w / 2) * (1 - (n - 1) * 0.16 - 0.09), S.rockLt, (w / 2) * (1 - (n - 1) * 0.16 - 0.1), { segs: 7 }); }));
}
/** A hoodoo spire: a thin stack with a cap rock. */
export function spire(m: Model, h = 2.4, r = 0.4) {
  m.group(() => { m.cylinder([0, 0, 0], [0, 0, h * 0.5], r, S.rockDk, r * 0.6, { segs: 6 }); m.cylinder([0, 0, h * 0.5], [0, 0, h * 0.86], r * 0.62, S.rock, r * 0.45, { segs: 6 }); });
  m.cylinder([0, 0, h * 0.84], [0, 0, h], r * 0.8, S.rockLt, r * 0.6, { segs: 6 });
}
/** A boulder or a heap. */
export const boulder = (m: Model, r = 0.6, h = 0.45, col: Material = S.rock) => m.group(() => { m.ellipsoid([0, 0, 0], [r, r, h], col, { segs: 7 }); m.ellipsoid([r * 0.45, r * 0.3, 0], [r * 0.5, r * 0.5, h * 0.6], col, { segs: 6 }); });
/** A pine: stacked cones, snow on the boughs if `snow`. */
export function pine(m: Model, h = 2.4, snow = false) {
  m.cylinder([0, 0, 0], [0, 0, h * 0.3], h * 0.05, S.logDk, h * 0.04, { segs: 5 });
  for (let i = 0; i < 3; i++) { const z = h * (0.18 + i * 0.25), r = h * (0.3 - i * 0.07); m.cone([0, 0, z], [0, 0, z + h * 0.36], r, i % 2 ? S.pineTree : S.pineTreeDk, { segs: 8 }); if (snow) m.decal(0.01, () => m.cone([0, 0, z + h * 0.14], [0, 0, z + h * 0.365], r * 0.62, S.snow, { segs: 8 })); }
}
/** A cottonwood: a trunk and a broad round crown. */
export function cottonwood(m: Model, h = 2.2, col: Material = S.leaf, col2: Material = S.leafDk) {
  m.cylinder([0, 0, 0], [0, 0, h * 0.55], h * 0.07, S.logDk, h * 0.05, { segs: 6 });
  m.group(() => { m.sphere([0, 0, h * 0.72], h * 0.36, col, { segs: 9 }); m.sphere([h * 0.2, h * 0.12, h * 0.6], h * 0.24, col2, { segs: 8 }); m.sphere([-h * 0.16, -h * 0.18, h * 0.66], h * 0.26, col, { segs: 8 }); });
}
/** A cypress hung with moss, standing in water. */
export function cypress(m: Model, h = 3) {
  m.cylinder([0, 0, 0], [0, 0, h * 0.7], h * 0.11, S.logDk, h * 0.04, { segs: 7 });
  m.group(() => { m.ellipsoid([0, 0, h * 0.78], [h * 0.34, h * 0.34, h * 0.2], S.pineTreeDk, { segs: 9 }); m.ellipsoid([h * 0.14, -h * 0.1, h * 0.9], [h * 0.2, h * 0.2, h * 0.12], S.pineTree, { segs: 8 }); });
  m.group(() => { for (let i = 0; i < 5; i++) { const a = i * 1.3; m.cone([Math.cos(a) * h * 0.24, Math.sin(a) * h * 0.24, h * 0.72], [Math.cos(a) * h * 0.25, Math.sin(a) * h * 0.25, h * 0.42], h * 0.035, S.moss, { segs: 4 }); } });
}
/** A palm. */
export function palm(m: Model, h = 2.6) {
  m.tube([[0, 0, 0], [0.1, 0, h * 0.5], [0.0, 0, h]], [h * 0.05, h * 0.04, h * 0.035], S.log, { segs: 6 });
  m.group(() => { for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; m.poly([[0, 0, h], [Math.cos(a - 0.2) * h * 0.22, Math.sin(a - 0.2) * h * 0.22, h + h * 0.08], [Math.cos(a) * h * 0.42, Math.sin(a) * h * 0.42, h - h * 0.1], [Math.cos(a + 0.2) * h * 0.22, Math.sin(a + 0.2) * h * 0.22, h + h * 0.08]], i % 2 ? S.palm : S.leafDk); } });
}
/** A wooden oil derrick with a walking beam at its foot. */
export function derrick(m: Model, h = 4) {
  m.group(() => { for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) m.cylinder([x * 0.6, y * 0.6, 0], [x * 0.12, y * 0.12, h], 0.05, S.pineDk, 0.04, { segs: 4 }); for (let z = 0.6; z < h; z += 0.8) { const k = 0.6 - (0.48 * z) / h; m.box([0, 0, z], [k * 2, k * 2, 0.05], S.pineDk); m.tube([[k, k, z], [-k * 0.8, k * 0.8, z + 0.8]], 0.022, S.pineDk, { segs: 4 }); m.tube([[k, -k, z], [k * 0.8, k * 0.8, z + 0.8]], 0.022, S.pineDk, { segs: 4 }); } });
  m.box([0, 0, h + 0.06], [0.4, 0.4, 0.12], S.pineDk);
  m.box([0.9, 0, 0.3], [0.5, 0.6, 0.6], S.grey);
  m.cylinder([0, 0, 0], [0, 0, 0.3], 0.14, S.iron, 0.14, { segs: 6 });
}
/** A locomotive running along y (its nose at +y): boiler, cab, diamond stack, cowcatcher. */
export function locomotive(m: Model, cab: Material = P.team) {
  m.box([0, -0.2, 0.3], [0.9, 2.6, 0.2], S.iron);
  m.with(() => { m.move(0, 0.2, 0.85).rotZ(90); m.cylinder([-0.6, 0, 0], [1.0, 0, 0], 0.42, S.iron, 0.42, { segs: 12 }); m.cylinder([0.98, 0, 0], [1.06, 0, 0], 0.45, P.brass, 0.4, { segs: 12 }); for (const x of [-0.2, 0.4]) m.cylinder([x, 0, 0], [x + 0.08, 0, 0], 0.445, P.brass, 0.445, { segs: 12 }); });
  m.box([0, -1.0, 1.05], [1.0, 0.9, 1.1], cab);
  m.box([0, -1.0, 1.65], [1.15, 1.1, 0.1], S.shingleDk);
  m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) m.box([s * 0.505, -1.0, 1.2], [0.02, 0.5, 0.4], S.window); }));
  m.group(() => { m.cylinder([0, 0.9, 1.25], [0, 0.9, 1.6], 0.12, S.iron, 0.12, { segs: 8 }); m.cylinder([0, 0.9, 1.6], [0, 0.9, 2.0], 0.14, S.iron, 0.3, { segs: 8 }); });
  m.sphere([0, 0.3, 1.32], 0.16, P.brass, { segs: 8 });
  m.extrude([[-0.45, 0.4], [0.45, 0.4], [0.45, 0.2], [0, 0], [-0.45, 0.2]].map(([x, z]) => [x, z] as [number, number]), 0.1, S.iron);
  m.with(() => { m.move(0, 1.5, 0.05).rotZ(90); m.extrude([[0, 0], [0.5, 0], [0, 0.45]], 0.9, S.barn); });
  for (const y of [-0.9, -0.1, 0.7]) for (const x of [-0.48, 0.48]) m.with(() => { m.move(x, y, y < -0.5 ? 0.36 : 0.3).rotZ(90); wheel(m, y < -0.5 ? 0.36 : 0.3, 10, S.barn, S.barn, 8, S.iron); });
  puff(m, [0, 0.8, 2.4], 0.4, 0.5, P.smokeDk, 2);
}
/** A boxcar along y. */
export function boxcar(m: Model, col: Material = S.barn) {
  m.box([0, 0, 0.9], [0.95, 2.2, 1.0], col);
  m.box([0, 0, 1.44], [1.05, 2.3, 0.1], S.shingleDk);
  m.box([0, 0, 0.36], [0.85, 2.3, 0.1], S.iron);
  m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) m.box([s * 0.48, 0, 0.9], [0.02, 0.7, 0.86], S.pineDk); }));
  for (const y of [-0.7, 0.7]) for (const x of [-0.46, 0.46]) m.with(() => { m.move(x, y, 0.2).rotZ(90); wheel(m, 0.2, 0, S.iron, S.iron, 6, null); });
}
/** A run of stockade along y: pointed logs. */
export function stockade(m: Model, len: number, h = 1.1) {
  const n = Math.round(len / 0.22);
  m.group(() => { for (let i = 0; i < n; i++) { const y = -len / 2 + (i + 0.5) * (len / n), hh = h + 0.08 * ((i * 7) % 3); m.cylinder([0, y, 0], [0, y, hh], 0.11, i % 2 ? S.log : S.logDk, 0.11, { segs: 5 }); m.cone([0, y, hh], [0, y, hh + 0.2], 0.11, i % 2 ? S.log : S.logDk, { segs: 5 }); } });
  m.box([0.1, 0, h * 0.6], [0.06, len, 0.08], S.logDk);
}
/** A log blockhouse on stilts with an overhanging top floor and a flag. */
export function blockhouse(m: Model, h = 2.6) {
  m.box([0, 0, h * 0.3], [1.3, 1.3, h * 0.6], S.log);
  m.box([0, 0, h * 0.78], [1.7, 1.7, h * 0.36], S.logDk);
  m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) { m.box([0.855, s * 0.4, h * 0.8], [0.02, 0.26, 0.12], S.window); m.box([s * 0.4, 0.855, h * 0.8], [0.26, 0.02, 0.12], S.window); } }));
  m.cone([0, 0, h * 0.96], [0, 0, h * 1.3], 1.3, S.shingleDk, { segs: 4 });
  m.cylinder([0, 0, h * 1.28], [0, 0, h * 1.75], 0.03, S.pineDk, 0.03, { segs: 4 });
  m.poly([[0, 0, h * 1.75], [0, 0, h * 1.55], [0.5, 0, h * 1.6], [0.5, 0, h * 1.74]], P.team);
}
/** A mission bell wall: white plaster, an arch with a bell, a tiled cap. */
export function belfry(m: Model, h = 3.2, w = 1.6) {
  m.box([0, 0, h * 0.35], [0.8, w, h * 0.7], S.plaster);
  m.box([0, 0, h * 0.85], [0.7, w * 0.8, h * 0.32], S.plaster);
  m.with(() => { m.move(0, 0, h).rotZ(90); m.extrude([[-w * 0.46, 0], [w * 0.46, 0], [0, 0.4]], 0.9, S.tile); });
  m.decal(0.02, () => m.group(() => { m.box([0.355, 0, h * 0.84], [0.02, w * 0.36, h * 0.22], S.window); m.cylinder([0.355, 0, h * 0.95], [0.375, 0, h * 0.95], w * 0.18, S.window, w * 0.18, { segs: 10 }); m.box([0.405, 0, 0.45], [0.02, 0.5, 0.86], S.door); }));
  m.decal(0.04, () => m.group(() => { m.cone([0.37, 0, h * 0.78], [0.37, 0, h * 0.94], w * 0.12, P.brass, { segs: 8 }); }));
}
/** A paddle steamer along y. */
export function riverboat(m: Model) {
  m.extrude([[-3, 0.5], [2.6, 0.5], [3.4, 0.35], [2.8, 0], [-3, 0]].map(([x, z]) => [x, z] as [number, number]), 1.7, S.white), m.rotZ(0);
  m.box([-0.3, 0, 0.9], [4.6, 1.4, 0.7], S.plaster);
  m.box([-0.5, 0, 1.55], [3.6, 1.2, 0.6], S.plaster);
  m.box([-0.3, 0, 1.27], [4.8, 1.6, 0.06], S.barn);
  m.box([-0.5, 0, 1.88], [3.8, 1.4, 0.06], S.barn);
  m.decal(0.02, () => m.group(() => { for (let x = -2.2; x < 1.8; x += 0.5) for (const s of [1, -1]) { m.box([x, s * 0.705, 0.95], [0.26, 0.02, 0.36], S.lit); if (x > -2 && x < 1) m.box([x, s * 0.605, 1.58], [0.24, 0.02, 0.3], S.lit); } }));
  for (const y of [-0.3, 0.3]) { m.cylinder([1.2, y, 1.9], [1.2, y, 3.1], 0.12, S.iron, 0.12, { segs: 8 }); m.cylinder([1.2, y, 3.0], [1.2, y, 3.2], 0.17, S.barn, 0.2, { segs: 8 }); }
  m.with(() => { m.move(-3.1, 0, 0.6); m.cylinder([0, -0.8, 0], [0, 0.8, 0], 0.7, S.barn, 0.7, { segs: 10 }); });
  m.box([0.9, 0, 2.2], [0.8, 0.8, 0.5], S.plaster);
}
/** A telegraph pole with a crossarm and insulators; `arm` reaches over +x. */
export function telegraph(m: Model, h = 2.2) {
  m.cylinder([0, 0, 0], [0, 0, h], 0.055, S.logDk, 0.04, { segs: 6 });
  m.box([0, 0, h - 0.25], [0.07, 0.8, 0.07], S.logDk);
  m.group(() => { for (const y of [-0.34, -0.12, 0.12, 0.34]) m.cylinder([0, y, h - 0.2], [0, y, h - 0.1], 0.03, P.glass, 0.025, { segs: 5 }); });
}
/** A lantern on a post, hung from an arm reaching `arm` along +x. */
export function lanternPost(m: Model, h = 1.5, arm = 0.4, lit: Material = P.lamp) {
  m.cylinder([0, 0, 0], [0, 0, h], 0.045, S.pineDk, 0.04, { segs: 5 });
  if (arm) m.box([arm / 2, 0, h - 0.06], [arm + 0.06, 0.05, 0.05], S.pineDk);
  m.group(() => { m.cylinder([arm, 0, h - 0.1], [arm, 0, h - 0.14], 0.05, S.iron, 0.07, { segs: 6 }); m.cylinder([arm, 0, h - 0.34], [arm, 0, h - 0.38], 0.07, S.iron, 0.05, { segs: 6 }); });
  m.cylinder([arm, 0, h - 0.14], [arm, 0, h - 0.34], 0.06, lit, 0.06, { segs: 6 });
}
/** A canvas ridge tent along y. */
export function tent(m: Model, w = 1.2, col: Material = S.canvas) {
  m.with(() => { m.rotZ(90); m.extrude([[-0.6, 0], [0.6, 0], [0, 0.8]], w, col); });
  m.decal(0.02, () => m.poly([[0.0, w / 2 + 0.01, 0.0], [0.18, w / 2 + 0.01, 0.0], [0, w / 2 + 0.01, 0.6]], S.signInk));
}
/** A cow skull lying on the ground. */
export function skull(m: Model, s = 0.3) {
  m.group(() => { m.ellipsoid([0, 0, s * 0.3], [s * 0.6, s * 0.4, s * 0.3], P.bone, { segs: 7 }); m.ellipsoid([s * 0.55, 0, s * 0.2], [s * 0.4, s * 0.22, s * 0.2], P.bone, { segs: 6 }); for (const sd of [1, -1]) m.tube([[-s * 0.1, sd * s * 0.3, s * 0.4], [-s * 0.2, sd * s * 0.9, s * 0.5], [-s * 0.1, sd * s * 1.1, s * 0.9]], [s * 0.1, s * 0.08, s * 0.02], P.bone, { segs: 4 }); });
}
/** A tall saguaro for the scenery (re-exported with scenery defaults). */
export const cactus = (m: Model, h = 1.6, arms = 2) => saguaro(m, h, h * 0.13, arms);
/** A star on a board: the town's sign. Faces +x. */
export function starSign(m: Model, r = 0.4, col: Material = P.brass) { m.with(() => { m.rotZ(90); star(m, r, col, 0.05); }); }
export type { V3 };
