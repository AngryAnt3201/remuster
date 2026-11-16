// Pixelkeep's keeps: a brick castle sixteen pixels wide. A square keep with battlements between two round corner
// turrets, pointed roofs and a flag in the side's colour, a gate with a team door. As the commander's health drains
// the merlons go, a turret loses its roof, the keep is cut down to a stump, and at the end there is a heap of bricks.
import type { KeepArt, KeepBuild } from "../../../artkit/keep";
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { P } from "./parts";

interface Skin { wall: Material; dk: Material; cap: Material; lit: Material }
const SKINS: Record<string, Skin> = {
  default: { wall: mat("#bfbfbf"), dk: mat("#808080"), cap: mat("#ffffff"), lit: mat("#ffff40", { emit: 1 }) },
  frost: { wall: mat("#bfffff"), dk: mat("#80bfff"), cap: mat("#ffffff"), lit: mat("#ffffff", { emit: 1 }) },
  ember: { wall: mat("#804040"), dk: mat("#402020"), cap: mat("#404040"), lit: mat("#ff8000", { emit: 1 }) },
  gilded: { wall: mat("#ffffbf"), dk: mat("#ffbf40"), cap: mat("#ffbf00", { metal: 0.6 }), lit: mat("#ffffff", { emit: 1 }) },
  shadow: { wall: mat("#404080"), dk: mat("#202040"), cap: mat("#8040bf"), lit: mat("#40ff80", { emit: 1 }) },
  blossom: { wall: mat("#ffbfbf"), dk: mat("#ff80bf"), cap: mat("#ffffff"), lit: mat("#ffff80", { emit: 1 }) },
};
const HOLE = mat("#202028", { shade: 0.2 });
const CHAR = mat("#404040");

/** A ring of merlons round a square top. `skip` leaves gaps (damage). */
function merlons(m: Model, x: number, y: number, z: number, half: number, col: Material, skip: (i: number) => boolean = () => false) {
  let i = 0;
  m.group(() => {
    for (const sx of [-1, 0, 1]) for (const sy of [-1, 0, 1]) { if (!sx && !sy) continue; if (!skip(i++)) m.box([x + sx * half, y + sy * half, z + 0.09], [0.2, 0.2, 0.18], col); }
  });
}
/** A corner turret: a round drum, a ring, a pointed roof. `cut` 0 whole, 1 roofless, 2 half height. */
function turret(m: Model, x: number, y: number, h: number, sk: Skin, roof: Material, cut: number) {
  const hh = cut >= 2 ? h * 0.55 : h;
  m.cylinder([x, y, 0.1], [x, y, hh], 0.3, sk.wall, 0.3, { segs: 8 });
  m.decal(0.02, () => m.box([x + 0.29, y, hh * 0.62], [0.03, 0.1, 0.2], cut ? HOLE : sk.lit));
  if (cut >= 2) { m.group(() => { for (let i = 0; i < 5; i++) { const a = i * 1.26; m.box([x + Math.cos(a) * 0.2, y + Math.sin(a) * 0.2, hh + 0.04 + 0.05 * (i % 2)], [0.16, 0.16, 0.14 + 0.1 * (i % 2)], sk.dk); } }); return; }
  m.cylinder([x, y, hh], [x, y, hh + 0.12], 0.36, sk.dk, 0.36, { segs: 8 });
  if (!cut) m.cone([x, y, hh + 0.12], [x, y, hh + 0.72], 0.38, roof, { segs: 8 });
  else m.decal(0.02, () => m.cylinder([x, y, hh + 0.12], [x, y, hh + 0.13], 0.26, HOLE, 0.26, { segs: 8 }));
}
function rubble(m: Model, sk: Skin) {
  const bits: [number, number, number, number][] = [[0, 0, 0.3, 0.5], [0.45, 0.3, 0.2, 0.36], [-0.4, -0.35, 0.22, 0.4], [0.3, -0.5, 0.16, 0.3], [-0.5, 0.45, 0.16, 0.3], [0.75, -0.05, 0.12, 0.24], [-0.8, 0.0, 0.12, 0.24], [0.1, 0.75, 0.12, 0.26], [0.0, -0.8, 0.1, 0.22]];
  bits.forEach(([x, y, z, s], i) => m.with(() => { m.move(x, y, z).rotZ(i * 37).rotY(i % 2 ? 14 : -10); m.box([0, 0, 0], [s, s * 1.2, s * 0.8], i % 3 ? sk.wall : sk.dk); }));
  m.with(() => { m.move(0.1, 0.1, 0.5).rotY(28); m.cylinder([0, 0, 0], [0, 0, 0.7], 0.03, P.woodDk, 0.03, { segs: 4 }); m.poly([[0, 0, 0.7], [0, 0.32, 0.6], [0, 0, 0.46]], P.teamFlat); });
  m.decal(0.02, () => { for (const [x, y] of [[0.2, 0.2], [-0.3, 0.1]]) m.box([x, y, 0.56], [0.14, 0.14, 0.05], CHAR); });
}

export const KEEPS: KeepArt = {
  anchors: {
    gate: [0.95, 0, 0.3], top: [-0.1, 0, 1.75], pole: [-0.1, 0, 2.62],
    fires: [[-0.1, 0, 1.5], [0.5, 0.7, 1.0], [0.5, -0.7, 1.1], [0.8, 0.2, 0.5]],
    smoke: [[-0.1, 0, 1.3], [0.5, 0.7, 0.8], [0.5, -0.7, 0.8]],
  },
  skinTeams: {
    frost: { main: "#80ffff", dark: "#4080bf", light: "#ffffff" }, ember: { main: "#ff8000", dark: "#bf0000", light: "#ffff80" },
    gilded: { main: "#ffffff", dark: "#bfbf80", light: "#ffffbf" }, shadow: { main: "#8040bf", dark: "#400080", light: "#ff80ff" },
    blossom: { main: "#ff80bf", dark: "#bf4080", light: "#ffffff" },
  },
  build(m: Model, k: KeepBuild) {
    const sk = SKINS[k.skin ?? "default"] ?? SKINS.default, d = k.damage, roof = P.team;
    // ---- a stepped base in the side's colour
    m.box([0, 0, 0.05], [2.3, 2.3, 0.1], sk.dk);
    m.decal(0.01, () => m.box([0, 0, 0.07], [2.34, 2.0, 0.06], P.teamFlat));
    if (d >= 4) return rubble(m, sk);
    // ---- the curtain wall and the gatehouse front
    const wh = 0.74;
    m.box([0.1, 0, 0.1 + wh / 2], [1.5, 1.7, wh], sk.wall);
    m.decal(0.015, () => m.group(() => { for (const z of [0.34, 0.58]) m.box([0.855, 0, z], [0.02, 1.7, 0.045], sk.dk); for (const [y, z] of [[-0.5, 0.46], [0.5, 0.46], [0, 0.7], [-0.25, 0.22], [0.62, 0.22]]) m.box([0.855, y, z], [0.02, 0.045, 0.2], sk.dk); }));
    merlons(m, 0.1, 0, 0.1 + wh, 0.72, sk.wall, (i) => d >= 1 && i % 3 === 1 || d >= 3 && i % 2 === 0);
    // the gate: a dark arch, a team door, a gold knocker
    m.decal(0.03, () => m.box([0.86, 0, 0.36], [0.03, 0.56, 0.56], HOLE));
    m.decal(0.04, () => m.box([0.87, 0, 0.33], [0.03, 0.44, 0.46], d >= 3 ? CHAR : P.teamFlat));
    m.decal(0.05, () => m.box([0.88, 0, 0.36], [0.03, 0.1, 0.1], k.boss ? P.red : P.gold));
    // ---- the great tower
    const th = d >= 3 ? 0.95 : 1.62 + (k.boss ? 0.14 : 0);
    m.box([-0.1, 0, 0.1 + th / 2], [0.92, 0.92, th], sk.wall);
    m.decal(0.015, () => m.group(() => { for (let z = 0.95; z < th - 0.1; z += 0.26) m.box([0.365, 0, z], [0.02, 0.92, 0.045], sk.dk); }));
    if (d < 3) {
      m.decal(0.03, () => m.box([0.37, 0, 1.25], [0.03, 0.2, 0.3], d >= 2 ? HOLE : sk.lit));
      if (k.boss) m.decal(0.035, () => { for (const y of [-0.28, 0.28]) m.box([0.37, y, 1.3], [0.03, 0.12, 0.16], P.fire); });
      m.box([-0.1, 0, 0.1 + th + 0.05], [1.1, 1.1, 0.1], sk.dk);
      merlons(m, -0.1, 0, 0.1 + th + 0.1, 0.45, sk.cap, (i) => d >= 1 && i === 2 || d >= 2 && i % 3 === 0);
      if (d <= 1) m.cone([-0.1, 0, 0.1 + th + 0.1], [-0.1, 0, 0.1 + th + 0.62], 0.4, roof, { segs: 4 });
      else m.decal(0.02, () => m.box([-0.1, 0, 0.1 + th + 0.11], [0.7, 0.7, 0.02], HOLE));
      if (k.boss && d <= 1) m.group(() => { for (const [x, y] of [[0.36, 0.36], [0.36, -0.36], [-0.56, 0.36], [-0.56, -0.36]]) m.cone([x, y, 0.1 + th + 0.28], [x, y, 0.1 + th + 0.56], 0.09, P.gold, { segs: 4 }); });
      // the flag
      if (d <= 2) {
        const z0 = 0.1 + th + (d <= 1 ? 0.6 : 0.1), z1 = Math.min(2.62, z0 + 0.5);
        m.cylinder([-0.1, 0, z0 - 0.1], [-0.1, 0, z1], 0.025, P.woodDk, 0.025, { segs: 4 });
        m.poly([[-0.1, 0, z1], [-0.1, 0.4, z1 - 0.1], [-0.1, 0, z1 - 0.24]], P.teamFlat);
      }
    } else {
      m.group(() => { for (let i = 0; i < 6; i++) m.box([-0.1 + ((i % 3) - 1) * 0.3, (i < 3 ? 1 : -1) * 0.3, 0.1 + th + 0.05 + 0.08 * ((i * 5) % 3)], [0.26, 0.26, 0.16 + 0.14 * ((i * 5) % 3)], sk.dk); });
      m.decal(0.02, () => m.box([0.37, 0.1, 0.8], [0.03, 0.3, 0.2], HOLE));
    }
    // ---- cracks and scorch marks
    if (d >= 1) m.decal(0.035, () => m.group(() => { for (const [y, z, w, h] of [[0.5, 0.56, 0.05, 0.3], [0.56, 0.42, 0.14, 0.05], [-0.56, 0.3, 0.05, 0.26], ...(d >= 2 ? [[-0.4, 0.64, 0.3, 0.14], [0.3, 0.2, 0.2, 0.12]] : [])]) m.box([0.87, y, z], [0.02, w, h], HOLE); }));
    // ---- the corner turrets
    turret(m, 0.72, 0.78, 1.05, sk, roof, d >= 3 ? 2 : d >= 2 ? 1 : 0);
    turret(m, 0.72, -0.78, 1.05, sk, roof, d >= 3 ? 2 : d >= 1 ? 1 : 0);
    if (d >= 3) m.group(() => { for (const [x, y, s] of [[1.0, 0.3, 0.2], [1.05, -0.35, 0.16], [0.95, 0.0, 0.12]]) m.box([x, y, 0.1 + s / 2], [s, s * 1.2, s], sk.dk); });
  },
};
