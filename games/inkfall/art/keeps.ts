// Inkfall's halls: a clan's stronghold as a brush painter would put it down. A battered stone plinth, a plaster
// storey with black timbers, and two (three for a boss) curved tiled roofs in the side's colour, which is what you
// see from above; a gate curtain with the clan's ring, a tall banner. As the clan head's strength drains the walls
// crack and stain, roof corners fall, the upper storey burns out to stubs, and at the end there is a heap of stones
// with the banner lying across it.
import type { KeepArt, KeepBuild } from "../../../artkit/keep";
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { P } from "./parts";
import { S, roof } from "./scenery";

interface Skin { wall: Material; stone: Material; stoneDk: Material; lit: Material; trim: Material }
const SKINS: Record<string, Skin> = {
  default: { wall: S.plaster, stone: S.stone, stoneDk: S.stoneDk, lit: mat("#f1d894", { emit: 1 }), trim: P.bronze },
  frost: { wall: mat("#fffdf6", { emit: 1 }), stone: mat("#c9d3d6", { emit: 0.9 }), stoneDk: mat("#8f9da3", { emit: 0.9 }), lit: mat("#dff3f5", { emit: 1 }), trim: P.steel },
  ember: { wall: mat("#d6cbb4", { emit: 0.9 }), stone: mat("#8c857a", { emit: 0.9 }), stoneDk: mat("#55504a", { emit: 0.95 }), lit: mat("#f0a23c", { emit: 1 }), trim: P.ink },
  gilded: { wall: mat("#f6edd2", { emit: 1 }), stone: mat("#cdbb8a", { emit: 0.9 }), stoneDk: mat("#9c8554", { emit: 0.9 }), lit: mat("#fff3c4", { emit: 1 }), trim: mat("#b8963a", { emit: 1 }) },
  shadow: { wall: mat("#5c5850", { emit: 0.95 }), stone: mat("#3b3833", { emit: 1 }), stoneDk: mat("#1d1a17", { emit: 1 }), lit: mat("#b9a8d6", { emit: 1 }), trim: P.steel },
  blossom: { wall: mat("#fbeee6", { emit: 1 }), stone: mat("#d9c7bd", { emit: 0.9 }), stoneDk: mat("#a8938a", { emit: 0.9 }), lit: mat("#fff0e0", { emit: 1 }), trim: P.bronze },
};
const HOLE = mat("#1d1a17", { emit: 1 });
const SOOT = mat("#1d1a17", { emit: 0.7 });
const R2 = Math.SQRT2;

/** A square storey: plaster walls with black posts and a rail on the front and side faces. */
function storey(m: Model, z: number, half: number, h: number, sk: Skin, lit: Material | null) {
  m.box([0, 0, z + h / 2], [half * 2, half * 2, h], sk.wall);
  m.decal(0.02, () => m.group(() => {
    for (const y of [-half * 0.97, -half * 0.33, half * 0.33, half * 0.97]) m.box([half + 0.005, y, z + h / 2], [0.02, 0.05, h], S.timber);
    m.box([half + 0.005, 0, z + h * 0.86], [0.02, half * 2, 0.05], S.timber);
    for (const x of [-half * 0.9, 0, half * 0.9]) for (const sd of [1, -1]) m.box([x, sd * (half + 0.005), z + h / 2], [0.05, 0.02, h], S.timber);
  }));
  if (lit) m.decal(0.03, () => { for (const y of [-half * 0.65, half * 0.65]) m.box([half + 0.01, y, z + h * 0.45], [0.02, half * 0.36, h * 0.42], lit); });
}
/** Jagged burnt stubs where a storey stood. */
function stubs(m: Model, z: number, half: number) {
  m.group(() => { for (let i = 0; i < 7; i++) { const a = i * 0.9, x = Math.cos(a) * half * 0.8, y = Math.sin(a) * half * 0.8; m.box([x, y, z + 0.08 + 0.07 * (i % 3)], [0.09, 0.09, 0.16 + 0.14 * (i % 3)], SOOT); } });
  m.decal(0.02, () => m.box([0, 0, z + 0.01], [half * 1.7, half * 1.7, 0.02], HOLE));
}
function rubble(m: Model, sk: Skin) {
  const bits: [number, number, number, number][] = [[0, 0, 0.5, 0.5], [0.45, 0.3, 0.42, 0.36], [-0.4, -0.35, 0.44, 0.4], [0.3, -0.5, 0.4, 0.3], [-0.5, 0.45, 0.4, 0.3], [0.75, -0.05, 0.36, 0.24], [-0.8, 0.0, 0.36, 0.24], [0.1, 0.75, 0.36, 0.26], [0.0, -0.8, 0.36, 0.22]];
  bits.forEach(([x, y, z, s], i) => m.with(() => { m.move(x, y, z).rotZ(i * 37).rotY(i % 2 ? 14 : -10); m.box([0, 0, 0], [s, s * 1.2, s * 0.7], i % 3 === 0 ? sk.wall : i % 3 === 1 ? sk.stone : SOOT); }));
  m.with(() => { m.move(0.3, -0.5, 0.52).rotZ(20); m.box([0, 0, 0], [0.5, 0.36, 0.06], P.team); });
  // the banner lies across the heap
  m.with(() => { m.move(-0.1, 0.1, 0.72).rotY(72).rotZ(30); m.cylinder([0, 0, -0.5], [0, 0, 0.7], 0.025, S.timber, 0.025, { segs: 4 }); m.poly([[0, 0.02, 0.68], [0, 0.34, 0.68], [0.02, 0.34, 0.0], [0.02, 0.02, 0.0]], P.team); });
}

export const KEEPS: KeepArt = {
  anchors: {
    gate: [1.12, 0, 0.35], top: [0, 0, 1.9], pole: [-0.2, 0, 2.62],
    fires: [[0, 0, 1.6], [0.6, 0.6, 1.0], [0.6, -0.6, 1.0], [1.0, 0.2, 0.5]],
    smoke: [[0, 0, 1.5], [0.5, 0.6, 0.9], [0.5, -0.6, 0.9]],
  },
  skinTeams: {
    frost: { main: "#6fa3b8", dark: "#3f6f86", light: "#e6f6f8" }, ember: { main: "#c8452a", dark: "#7a2414", light: "#ffc79a" },
    gilded: { main: "#b8963a", dark: "#7d6220", light: "#fff0b8" }, shadow: { main: "#2a2622", dark: "#12100e", light: "#b9a8d6" },
    blossom: { main: "#d98a8a", dark: "#a55a5e", light: "#ffe6de" },
  },
  build(m: Model, k: KeepBuild) {
    const sk = SKINS[k.skin ?? "default"] ?? SKINS.default, d = k.damage;
    // ---- the plinth: battered stone, a band of the side's colour along its top edge
    m.with(() => { m.rotZ(45); m.group(() => m.lathe([[1.22 * R2, 0], [1.02 * R2, 0.38], [0, 0.38]], sk.stone, { segs: 4 })); m.decal(0.015, () => m.lathe([[1.06 * R2, 0.3], [1.022 * R2, 0.385]], P.team, { segs: 4 })); });
    m.decal(0.03, () => m.group(() => { for (const [y, z, w] of [[-0.6, 0.12, 0.3], [0.5, 0.2, 0.26], [0.75, 0.08, 0.2], [-0.2, 0.26, 0.24]]) m.box([1.14 - z * 0.52, y, z], [0.02, w, 0.02], sk.stoneDk); }));
    if (d >= 4) return rubble(m, sk);
    // ---- the gate: a black porch on the front of the plinth, a curtain in the side's colour with the clan ring
    m.box([1.04, 0, 0.3], [0.3, 0.74, 0.6], S.timber);
    m.decal(0.03, () => m.box([1.2, 0, 0.26], [0.02, 0.54, 0.44], d >= 3 ? HOLE : P.team));
    if (d < 3) m.decal(0.05, () => m.torus([1.21, 0, 0.28], [1, 0, 0], 0.11, 0.022, P.white, { segs: 10 }));
    m.group(() => m.extrude([[0.86, 0.6], [1.06, 0.76], [1.26, 0.6]], 0.9, P.team));
    // ---- the first storey and its roof
    storey(m, 0.38, 0.8, 0.46, sk, d >= 2 ? HOLE : sk.lit);
    roof(m, 0.84, 1.08, 0.3, P.team, P.teamDk, d >= 1 ? SOOT : S.tile);
    // ---- the upper storeys
    let z = 1.04;
    if (d >= 3) stubs(m, z, 0.5);
    else {
      storey(m, z, 0.48, 0.5, sk, d >= 2 ? HOLE : sk.lit);
      z += 0.5;
      if (k.boss && d <= 1) {
        roof(m, z, 0.7, 0.2, P.team, P.teamDk, S.tile);
        z += 0.14;
        storey(m, z, 0.32, 0.3, sk, sk.lit);
        z += 0.3;
      }
      const half = k.boss && d <= 1 ? 0.48 : 0.66;
      if (d <= 1) {
        roof(m, z, half, 0.4, P.team, P.teamDk, S.tile);
        // ridge finials: two upswept fish tails (bronze; taller and doubled on a boss hall)
        m.group(() => { for (const sd of [1, -1]) m.tube([[0, sd * 0.05, z + 0.38], [0, sd * 0.16, z + 0.5], [0, sd * 0.12, z + (k.boss ? 0.7 : 0.62)]], [0.045, 0.035, 0.008], sk.trim, { segs: 5 }); });
      } else {
        // the roof has fallen in: a charred rim and a black hole
        m.with(() => { m.rotZ(45); m.group(() => m.lathe([[half * R2 * 1.05, z], [half * R2 * 0.7, z + 0.1]], SOOT, { segs: 4 })); });
        m.decal(0.02, () => m.box([0, 0, z + 0.06], [half * 1.3, half * 1.3, 0.02], HOLE));
      }
    }
    // ---- the banner on its pole behind the tower
    if (d <= 2) {
      const top = d <= 1 ? 2.62 : 2.1;
      m.cylinder([-0.2, 0, 1.0], [-0.2, 0, top], 0.022, S.timber, 0.02, { segs: 4 });
      m.cylinder([-0.2, 0, top - 0.02], [-0.2, 0.34, top - 0.02], 0.016, S.timber, 0.016, { segs: 4 });
      m.poly([[-0.2, 0.03, top - 0.03], [-0.2, 0.34, top - 0.03], [-0.19, 0.34, top - 0.62], [-0.19, 0.03, top - 0.62]], P.team);
      m.decal(0.02, () => m.torus([-0.19, 0.185, top - 0.2], [1, 0, 0], 0.08, 0.018, P.white, { segs: 10 }));
    }
    // ---- cracks and soot
    if (d >= 1) m.decal(0.04, () => m.group(() => { for (const [y, zz, w, h] of [[0.5, 0.62, 0.03, 0.3], [0.44, 0.52, 0.14, 0.03], [-0.56, 0.5, 0.03, 0.22], ...(d >= 2 ? [[-0.3, 0.68, 0.34, 0.1], [0.2, 0.46, 0.2, 0.1], [0.62, 0.74, 0.2, 0.08]] : [])]) m.box([0.812, y, zz], [0.02, w, h], d >= 2 ? SOOT : HOLE); }));
    if (d >= 3) m.group(() => { for (const [x, y, s] of [[1.25, 0.5, 0.2], [1.3, -0.45, 0.16], [1.2, 0.75, 0.12]]) m.box([x, y, s / 2], [s, s * 1.2, s], sk.stoneDk); });
  },
};
