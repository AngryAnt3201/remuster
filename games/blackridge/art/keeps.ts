// Blackridge's command posts: a poured-concrete bunker inside a ring of earth-filled barriers, a blast door under
// a slab canopy, an operations cabin on the roof with the side's recognition panel, a dish and a tall radio mast
// flying the side's pennant. As the post takes fire it scorches and cracks, loses its dish, burns, loses the cabin,
// and ends as broken slabs with the mast lying across them.
import type { KeepArt, KeepBuild } from "../../../artkit/keep";
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { P } from "./parts";

interface Skin { wall: Material; dark: Material; cabin: Material; bag: Material; lit: Material }
const SKINS: Record<string, Skin> = {
  default: { wall: mat("#8f928c"), dark: mat("#5f625e"), cabin: mat("#59604f", { metal: 0.2 }), bag: mat("#8a8163"), lit: mat("#ffd9a0", { emit: 1 }) },
  frost: { wall: mat("#c9d0d2"), dark: mat("#8a9498"), cabin: mat("#aab4b8", { metal: 0.2 }), bag: mat("#d6dcde"), lit: mat("#d6f2ff", { emit: 1 }) },
  ember: { wall: mat("#7a6a5c"), dark: mat("#4a3c34"), cabin: mat("#6e4a36", { metal: 0.3 }), bag: mat("#75604a"), lit: mat("#ff9a4a", { emit: 1 }) },
  gilded: { wall: mat("#b3a37c"), dark: mat("#7d7052"), cabin: mat("#9a8650", { metal: 0.5 }), bag: mat("#b8a878"), lit: mat("#fff0b8", { emit: 1 }) },
  shadow: { wall: mat("#3d4144"), dark: mat("#232628"), cabin: mat("#2c3033", { metal: 0.4 }), bag: mat("#33373a"), lit: mat("#b0a0ff", { emit: 1 }) },
  blossom: { wall: mat("#a89a94"), dark: mat("#6e625e"), cabin: mat("#7c6a66", { metal: 0.2 }), bag: mat("#b0a096"), lit: mat("#ffd6c8", { emit: 1 }) },
};
const HOLE = mat("#0e0f10", { shade: 0 }), SOOT = mat("#1c1c1b", { shade: 0.5 });

function baskets(m: Model, sk: Skin, rubble: boolean) {
  // earth-filled barrier baskets round three sides, open at the front for the door
  const q: [number, number][] = [];
  for (let i = -3; i <= 3; i++) { q.push([-1.05, i * 0.33]); if (i > -3 && i < 3) continue; }
  for (let i = -2; i <= 3; i++) { q.push([i * 0.34 - 0.03, 1.05]); q.push([i * 0.34 - 0.03, -1.05]); }
  q.forEach(([x, y], i) => { if (rubble && i % 3 === 0) return; m.group(() => m.box([x, y, 0.15], [0.3, 0.3, rubble ? 0.18 : 0.3], i % 2 ? sk.bag : P.coyoteDk)); m.decal(0.01, () => m.box([x, y, 0.302], [0.24, 0.24, 0.006], P.wood)); });
}
function mast(m: Model, top: number, lit: Material) {
  m.group(() => { m.cylinder([-0.45, 0.35, 0.9], [-0.45, 0.35, top], 0.025, P.gun, 0.014, { segs: 6 }); for (const z of [1.5, 1.9]) m.box([-0.45, 0.35, z], [0.03, 0.26, 0.02], P.gun); });
  m.poly([[-0.45, 0.36, top - 0.04], [-0.45, 0.82, top - 0.12], [-0.45, 0.36, top - 0.36]], P.team);
  m.poly([[-0.45, 0.36, top - 0.04], [-0.12, 0.66, top - 0.12], [-0.45, 0.36, top - 0.36]], P.team);
  m.sphere([-0.45, 0.35, top + 0.02], 0.03, lit, { segs: 6 });
}

export const KEEPS: KeepArt = {
  anchors: {
    gate: [1.0, 0, 0.3], top: [-0.1, 0, 1.55], pole: [-0.45, 0.35, 2.55],
    fires: [[-0.1, 0, 1.35], [0.5, 0.5, 0.85], [0.5, -0.5, 0.85], [0.9, 0.15, 0.4]],
    smoke: [[-0.1, 0, 1.3], [0.4, 0.5, 0.8], [0.4, -0.5, 0.8]],
  },
  skinTeams: {
    frost: { main: "#7fc4dc", dark: "#3f7f96", light: "#e6f8ff" }, ember: { main: "#e0622a", dark: "#8a3210", light: "#ffc79a" },
    gilded: { main: "#d6b040", dark: "#8a6c1c", light: "#fff0b8" }, shadow: { main: "#7a6cff", dark: "#3a3290", light: "#cfc8ff" },
    blossom: { main: "#e88a9a", dark: "#a04a5e", light: "#ffe0e6" },
  },
  build(m: Model, k: KeepBuild) {
    const sk = SKINS[k.skin ?? "default"] ?? SKINS.default, d = k.damage;
    baskets(m, sk, d >= 4);
    if (d >= 4) {
      // broken slabs, bent rebar, the mast down across the heap
      const bits: [number, number, number, number][] = [[0, 0, 0.3, 0.7], [0.45, 0.3, 0.26, 0.5], [-0.4, -0.35, 0.28, 0.56], [0.3, -0.5, 0.22, 0.44], [-0.45, 0.45, 0.24, 0.46], [0.75, -0.05, 0.16, 0.34], [-0.75, 0, 0.18, 0.36], [0.1, 0.75, 0.16, 0.34]];
      bits.forEach(([x, y, z, s], i) => m.with(() => { m.move(x, y, z).rotZ(i * 37).rotY(i % 2 ? 16 : -12); m.box([0, 0, 0], [s, s * 1.2, s * 0.4], i % 3 === 0 ? sk.wall : i % 3 === 1 ? sk.dark : SOOT); }));
      for (let i = 0; i < 5; i++) m.tube([[Math.cos(i * 1.3) * 0.5, Math.sin(i * 1.3) * 0.5, 0.3], [Math.cos(i * 1.3) * 0.6, Math.sin(i * 1.3) * 0.55, 0.6], [Math.cos(i * 1.3) * 0.75, Math.sin(i * 1.3) * 0.5, 0.66]], 0.012, P.rust, { segs: 4 });
      m.with(() => { m.move(-0.2, 0.1, 0.55).rotY(78).rotZ(28); m.cylinder([0, 0, -0.6], [0, 0, 0.9], 0.022, P.gun, 0.014, { segs: 5 }); m.poly([[0, 0.02, 0.86], [0, 0.42, 0.8], [0.02, 0.02, 0.56]], P.team); });
      m.with(() => { m.move(0.35, -0.45, 0.42).rotZ(20).rotY(-10); m.box([0, 0, 0], [0.5, 0.36, 0.03], P.team); });
      return;
    }
    // ---- the bunker: a battered concrete block with firing slits, the side's stripe under its roof line
    m.group(() => { m.extrude([[-0.82, 0], [0.82, 0], [0.74, 0.72], [-0.74, 0.72]], 1.56, sk.wall); m.box([0, 0, 0.76], [1.62, 1.7, 0.1], sk.dark); });
    m.decal(0.014, () => { for (const s of [1, -1]) m.box([0, s * 0.781, 0.62], [1.3, 0.008, 0.07], P.team); m.box([0.762, 0, 0.62], [0.008, 1.4, 0.07], P.team); });
    m.decal(0.016, () => { for (const y of [-0.5, 0.5]) m.box([0.78, y, 0.44], [0.01, 0.34, 0.07], HOLE); for (const s of [1, -1]) for (const x of [-0.35, 0.3]) m.box([x, s * 0.785, 0.44], [0.3, 0.01, 0.07], HOLE); });
    // ---- the blast door under a slab canopy
    m.group(() => { m.box([0.9, 0, 0.56], [0.36, 0.64, 0.07], sk.dark); for (const s of [1, -1]) m.box([1.02, s * 0.29, 0.27], [0.08, 0.06, 0.54], sk.dark); });
    m.decal(0.02, () => m.box([0.81, 0, 0.26], [0.01, 0.46, 0.5], d >= 3 ? HOLE : P.steelDk));
    if (d < 3) m.decal(0.03, () => { m.box([0.815, 0, 0.3], [0.01, 0.46, 0.08], P.hazard); m.box([0.82, 0.12, 0.2], [0.01, 0.05, 0.05], sk.lit); });
    // ---- the roof: operations cabin, recognition panel, dish, mast
    let z = 0.81;
    if (d >= 3) {
      m.group(() => { for (let i = 0; i < 8; i++) { const a = i * 0.8; m.box([Math.cos(a) * 0.4 - 0.1, Math.sin(a) * 0.4, z + 0.06 + 0.06 * (i % 3)], [0.1, 0.1, 0.14 + 0.12 * (i % 3)], SOOT); } });
      m.decal(0.02, () => m.box([-0.1, 0, z + 0.006], [0.9, 0.9, 0.01], HOLE));
    } else {
      const ch = k.boss ? 0.62 : 0.46, cw = k.boss ? 1.0 : 0.9;
      m.group(() => { m.box([-0.1, 0, z + ch / 2], [cw, cw, ch], sk.cabin); m.box([-0.1, 0, z + ch + 0.03], [cw + 0.1, cw + 0.1, 0.06], sk.dark); });
      m.decal(0.016, () => { m.box([-0.1 + cw / 2 + 0.002, 0, z + ch * 0.62], [0.008, cw * 0.8, ch * 0.3], d >= 2 ? HOLE : sk.lit); for (const s of [1, -1]) m.box([-0.1, s * (cw / 2 + 0.002), z + ch * 0.62], [cw * 0.7, 0.008, ch * 0.3], d >= 2 ? HOLE : P.glass); });
      z += ch + 0.06;
      m.decal(0.016, () => m.box([-0.02, -0.12, z + 0.004], [cw * 0.6, cw * 0.5, 0.008], P.team));
      if (k.boss) {
        m.group(() => { m.box([-0.2, 0, z + 0.14], [0.5, 0.5, 0.28], sk.cabin); m.sphere([-0.2, 0, z + 0.4], 0.24, sk.wall, { segs: 12 }); });
        m.decal(0.016, () => m.cylinder([-0.2, 0, z + 0.3], [-0.2, 0, z + 0.34], 0.245, P.team, 0.24, { segs: 12 }));
        m.cylinder([0.25, -0.35, z], [0.25, -0.35, z + 0.7], 0.018, P.gun, 0.01, { segs: 5 });
        m.sphere([0.25, -0.35, z + 0.72], 0.03, P.warn, { segs: 6 });
      }
      if (d <= 1) m.with(() => { m.move(0.18, -0.3, z).rotY(-40); m.cylinder([0, 0, 0], [0, 0, 0.14], 0.02, P.gun, 0.02, { segs: 5 }); m.cone([0, 0, 0.3], [0, 0, 0.14], 0.2, P.steel, { segs: 12 }); m.capsule([0, 0, 0.16], [0, 0, 0.36], 0.008, P.gun, 0.008, { segs: 4 }); });
      if (d >= 2) m.decal(0.02, () => m.box([-0.2, 0.2, z + 0.008], [0.36, 0.3, 0.01], HOLE));
    }
    if (d <= 2) mast(m, d <= 1 ? 2.55 : 2.0, d === 0 ? P.warn : P.red);
    // ---- scorch and cracks
    if (d >= 1) m.decal(0.03, () => m.group(() => {
      const marks: [number, number, number, number][] = [[0.5, 0.5, 0.03, 0.34], [0.44, 0.4, 0.2, 0.03], [-0.56, 0.36, 0.03, 0.3], ...(d >= 2 ? [[-0.3, 0.5, 0.4, 0.16], [0.2, 0.26, 0.26, 0.16], [0.62, 0.56, 0.2, 0.14]] as [number, number, number, number][] : [])];
      for (const [y, zz, w, h] of marks) m.box([0.8 - zz * 0.11, y, zz], [0.012, w, h], SOOT);
      for (const s of [1, -1]) m.box([0.2 * s, s * 0.79, 0.3], [0.5, 0.012, 0.3 + 0.1 * d], SOOT);
    }));
    if (d >= 3) m.group(() => { for (const [x, y, s] of [[1.2, 0.5, 0.2], [1.25, -0.45, 0.16], [1.15, 0.75, 0.12]]) m.box([x, y, s / 2], [s, s * 1.2, s], sk.dark); });
  },
};
