// Tile-map scenery: the round trees, brick walls, huts and rocks that stand around Pixelkeep's battlefields, on its
// maps and in its key art. Simple solids: they are rendered small and cut to fat pixels.
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { P } from "./parts";

export const S = {
  leaf: mat("#40bf40"), leafDk: mat("#008000"), leafLt: mat("#80ff40"), pine: mat("#008040"), pineDk: mat("#004040"),
  autumn: mat("#ff8000"), autumnDk: mat("#bf4000"), dead: mat("#804040"), swamp: mat("#408040"), swampDk: mat("#004040"),
  trunk: mat("#804000"), trunkLt: mat("#bf8040"), sand: mat("#ffbf80"), sandDk: mat("#bf8040"),
  snow: mat("#ffffff"), snowDk: mat("#80bfff"), ice: mat("#80ffff"),
  brick: mat("#bf4040"), brickDk: mat("#802020"), stone: mat("#bfbfbf"), stoneDk: mat("#808080"), slate: mat("#404080"),
  dark: mat("#402060"), darkDk: mat("#200040"), darkLt: mat("#8040bf"),
  cave: mat("#804040"), caveDk: mat("#402020"), lava: mat("#ff8000", { emit: 1 }), lavaHot: mat("#ffff40", { emit: 1 }),
  crystal: mat("#ff80ff", { emit: 0.6 }), crystalBlue: mat("#80ffff", { emit: 0.6 }),
  cloud: mat("#ffffff", { shade: 0.5 }), cloudDk: mat("#bfffff"), marble: mat("#ffffbf"), marbleDk: mat("#bfbf80"),
  roofRed: mat("#ff4040"), roofBlue: mat("#4080ff"), plaster: mat("#ffffbf"), door: mat("#804000"), window: mat("#ffff40", { emit: 1 }),
  water: mat("#4080ff"), cactus: mat("#40bf40"), flower: mat("#ff80bf"), gold: mat("#ffbf00"),
};

/** A round tree: a trunk and one fat ball of leaves with a lighter cap. */
export function tree(m: Model, s = 1, leaf: Material = S.leaf, lt: Material | null = S.leafLt, trunk: Material = S.trunk) {
  m.cylinder([0, 0, 0], [0, 0, 0.6 * s], 0.13 * s, trunk, 0.11 * s, { segs: 6 });
  m.group(() => { m.sphere([0, 0, 1.0 * s], 0.58 * s, leaf, { segs: 8 }); m.sphere([0.3 * s, 0.25 * s, 0.75 * s], 0.34 * s, leaf, { segs: 6 }); m.sphere([-0.32 * s, -0.2 * s, 0.8 * s], 0.34 * s, leaf, { segs: 6 }); });
  if (lt) m.decal(0.05, () => m.sphere([-0.14 * s, 0.1 * s, 1.3 * s], 0.24 * s, lt, { segs: 6 }));
}
/** A pine: a trunk and three stacked cones. */
export function pine(m: Model, s = 1, leaf: Material = S.pine, cap: Material | null = null) {
  m.cylinder([0, 0, 0], [0, 0, 0.4 * s], 0.1 * s, S.trunk, 0.1 * s, { segs: 5 });
  for (let i = 0; i < 3; i++) m.cone([0, 0, (0.3 + i * 0.42) * s], [0, 0, (1.0 + i * 0.42) * s], (0.56 - i * 0.12) * s, leaf, { segs: 6 });
  if (cap) m.cone([0, 0, 1.5 * s], [0, 0, 1.86 * s], 0.2 * s, cap, { segs: 6 });
}
/** A palm: a bent trunk and four drooping fronds. */
export function palm(m: Model, s = 1) {
  m.tube([[0, 0, 0], [0.1 * s, 0, 0.6 * s], [0.3 * s, 0, 1.2 * s]], [0.1 * s, 0.08 * s, 0.07 * s], S.trunkLt, { segs: 5 });
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; m.tube([[0.3 * s, 0, 1.2 * s], [(0.3 + Math.cos(a) * 0.4) * s, Math.sin(a) * 0.4 * s, 1.3 * s], [(0.3 + Math.cos(a) * 0.75) * s, Math.sin(a) * 0.75 * s, 1.0 * s]], [0.08 * s, 0.1 * s, 0.03 * s], S.leaf, { segs: 4 }); }
}
/** A cactus with two arms. */
export function cactus(m: Model, s = 1) {
  m.group(() => {
    m.capsule([0, 0, 0], [0, 0, 1.0 * s], 0.18 * s, S.cactus, 0.18 * s, { segs: 6 });
    m.tube([[0, 0.1 * s, 0.5 * s], [0, 0.42 * s, 0.5 * s], [0, 0.42 * s, 0.8 * s]], 0.11 * s, S.cactus, { segs: 5 });
    m.tube([[0, -0.1 * s, 0.36 * s], [0, -0.4 * s, 0.36 * s], [0, -0.4 * s, 0.62 * s]], 0.11 * s, S.cactus, { segs: 5 });
  });
  m.sphere([0, 0, 1.18 * s], 0.09 * s, S.flower, { segs: 4 });
}
/** A bare dead tree. */
export function deadTree(m: Model, s = 1, col: Material = S.dead) {
  m.group(() => {
    m.cylinder([0, 0, 0], [0, 0, 0.9 * s], 0.13 * s, col, 0.08 * s, { segs: 5 });
    m.tube([[0, 0, 0.6 * s], [0, 0.35 * s, 0.95 * s], [0, 0.3 * s, 1.3 * s]], 0.06 * s, col, { segs: 4 });
    m.tube([[0, 0, 0.75 * s], [0, -0.3 * s, 1.05 * s], [0, -0.5 * s, 1.1 * s]], 0.06 * s, col, { segs: 4 });
    m.tube([[0, 0, 0.9 * s], [0.05 * s, 0.05 * s, 1.4 * s]], 0.05 * s, col, { segs: 4 });
  });
}
/** A round bush. */
export function bush(m: Model, s = 1, leaf: Material = S.leaf, berry: Material | null = null) {
  m.group(() => { m.sphere([0, 0, 0.28 * s], 0.4 * s, leaf, { segs: 7 }); m.sphere([0, 0.34 * s, 0.2 * s], 0.28 * s, leaf, { segs: 6 }); m.sphere([0, -0.34 * s, 0.2 * s], 0.28 * s, leaf, { segs: 6 }); });
  if (berry) for (const [x, y, z] of [[0.3, 0.1, 0.4], [0.25, -0.25, 0.3], [0.1, 0.36, 0.34]]) m.sphere([x * s, y * s, z * s], 0.07 * s, berry, { segs: 4 });
}
/** A boulder: two squashed blocks. */
export function rock(m: Model, s = 1, col: Material = S.stone, dk: Material = S.stoneDk) {
  m.group(() => { m.ellipsoid([0, 0, 0.3 * s], [0.6 * s, 0.7 * s, 0.5 * s], col, { segs: 6 }); m.ellipsoid([0.2 * s, -0.5 * s, 0.18 * s], [0.4 * s, 0.4 * s, 0.3 * s], dk, { segs: 5 }); });
}
/** A cluster of crystals. */
export function crystal(m: Model, s = 1, col: Material = S.crystal) {
  for (const [x, y, h, r, tilt] of [[0, 0, 1.2, 0.28, 0], [0.1, 0.4, 0.8, 0.2, 18], [0.1, -0.38, 0.7, 0.2, -20]]) m.with(() => { m.move(x * s, y * s, 0).rotX(-tilt); m.cylinder([0, 0, 0], [0, 0, h * s * 0.7], r * s, col, r * s, { segs: 5 }); m.cone([0, 0, h * s * 0.7], [0, 0, h * s], r * s, col, { segs: 5 }); });
}
/** A mushroom: a pale stem and a spotted cap. */
export function mushroom(m: Model, s = 1, cap: Material = S.roofRed) {
  m.cylinder([0, 0, 0], [0, 0, 0.5 * s], 0.16 * s, S.plaster, 0.13 * s, { segs: 6 });
  m.ellipsoid([0, 0, 0.6 * s], [0.5 * s, 0.5 * s, 0.32 * s], cap, { segs: 8 });
  m.decal(0.04, () => { for (const [x, y, z] of [[0.2, 0.2, 0.84], [0.3, -0.2, 0.74], [-0.1, 0, 0.9]]) m.sphere([x * s, y * s, z * s], 0.09 * s, S.snow, { segs: 4 }); });
}
/** A brick tower with battlements and a pointed roof. */
export function tower(m: Model, s = 1, wall: Material = S.brick, dk: Material = S.brickDk, roof: Material | null = S.roofBlue, lit: Material = S.window) {
  m.box([0, 0, 0.9 * s], [1.0 * s, 1.0 * s, 1.8 * s], wall);
  m.decal(0.02, () => { for (const z of [0.4, 0.9, 1.4]) m.box([0.5 * s, 0, z * s], [0.02, 1.0 * s, 0.06 * s], dk); });
  m.decal(0.03, () => m.box([0.5 * s, 0, 1.15 * s], [0.03, 0.22 * s, 0.34 * s], lit));
  m.group(() => { m.box([0, 0, 1.86 * s], [1.2 * s, 1.2 * s, 0.14 * s], wall); for (const [x, y] of [[0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5], [0.5, 0], [0, 0.5], [0, -0.5]]) m.box([x * s, y * s, 2.03 * s], [0.22 * s, 0.22 * s, 0.2 * s], wall); });
  if (roof) m.cone([0, 0, 1.93 * s], [0, 0, 2.8 * s], 0.5 * s, roof, { segs: 4 });
}
/** A length of battlemented wall running along y. */
export function wall(m: Model, len: number, s = 1, col: Material = S.brick, dk: Material = S.brickDk) {
  m.box([0, 0, 0.45 * s], [0.5 * s, len, 0.9 * s], col);
  m.decal(0.02, () => { for (const z of [0.3, 0.6]) m.box([0.25 * s, 0, z * s], [0.02, len, 0.05 * s], dk); });
  m.group(() => { for (let y = -len / 2 + 0.2; y < len / 2; y += 0.5) m.box([0, y, 1.0 * s], [0.5 * s, 0.26, 0.2 * s], col); });
}
/** A hut: plaster walls, a steep roof, a door and a lit window. */
export function hut(m: Model, s = 1, roof: Material = S.roofRed, wallCol: Material = S.plaster) {
  m.box([0, 0, 0.35 * s], [0.9 * s, 1.1 * s, 0.7 * s], wallCol);
  m.extrude([[-0.6 * s, 0.66 * s], [0, 1.3 * s], [0.6 * s, 0.66 * s]], 1.3 * s, roof);
  m.decal(0.03, () => { m.box([0.45 * s, -0.22 * s, 0.24 * s], [0.03, 0.26 * s, 0.48 * s], S.door); m.box([0.45 * s, 0.26 * s, 0.4 * s], [0.03, 0.22 * s, 0.22 * s], S.window); });
}
/** A pillar with a cap (marble for the clouds, dark stone for the dungeon). `fire` puts a flame on top. */
export function pillar(m: Model, s = 1, col: Material = S.marble, dk: Material = S.marbleDk, fire: Material | null = null) {
  m.box([0, 0, 0.1 * s], [0.6 * s, 0.6 * s, 0.2 * s], dk);
  m.cylinder([0, 0, 0.2 * s], [0, 0, 1.4 * s], 0.2 * s, col, 0.2 * s, { segs: 6 });
  m.box([0, 0, 1.48 * s], [0.56 * s, 0.56 * s, 0.16 * s], dk);
  if (fire) m.group(() => { m.box([0, 0, 1.7 * s], [0.3 * s, 0.3 * s, 0.3 * s], fire); m.box([0, 0, 1.95 * s], [0.16 * s, 0.16 * s, 0.2 * s], S.lavaHot); });
}
/** A snowman. */
export function snowman(m: Model, s = 1) {
  m.group(() => { m.sphere([0, 0, 0.36 * s], 0.42 * s, S.snow, { segs: 7 }); m.sphere([0, 0, 0.95 * s], 0.3 * s, S.snow, { segs: 7 }); });
  m.cone([0.26 * s, 0, 0.95 * s], [0.5 * s, 0, 0.92 * s], 0.06 * s, S.autumn, { segs: 4 });
  m.box([0, 0, 1.3 * s], [0.3 * s, 0.3 * s, 0.24 * s], P.black);
}
/** A puffy cloud bank sitting on the ground (the sky world's hedges). */
export function cloudBank(m: Model, s = 1) {
  m.group(() => { m.sphere([0, 0, 0.3 * s], 0.5 * s, S.cloud, { segs: 7 }); m.sphere([0, 0.5 * s, 0.22 * s], 0.36 * s, S.cloud, { segs: 6 }); m.sphere([0, -0.5 * s, 0.22 * s], 0.38 * s, S.cloud, { segs: 6 }); });
}
/** A wooden crate. */
export function crate(m: Model, s = 1) {
  m.box([0, 0, 0.4 * s], [0.8 * s, 0.8 * s, 0.8 * s], S.trunkLt);
  m.decal(0.02, () => { for (const z of [0.06, 0.74]) m.box([0.4 * s, 0, z * s], [0.02, 0.8 * s, 0.1 * s], S.trunk); for (const y of [-0.35, 0.35]) m.box([0.4 * s, y * s, 0.4 * s], [0.02, 0.1 * s, 0.8 * s], S.trunk); });
}
/** A stack of two barrels. */
export function barrel(m: Model, s = 1) {
  m.cylinder([0, 0, 0], [0, 0, 0.9 * s], 0.4 * s, S.trunkLt, 0.4 * s, { segs: 8 });
  m.decal(0.02, () => { for (const z of [0.15, 0.75]) m.cylinder([0, 0, z * s - 0.04], [0, 0, z * s + 0.04], 0.41 * s, S.stoneDk, 0.41 * s, { segs: 8 }); });
}
