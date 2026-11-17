// Cindermaw's strongholds: a gate bunker. A squat armoured block with hazard-striped blast doors, four pylons with
// a light each, and a reactor tower whose core burns in the side's colour under a horned iron skull. As health
// drains the plates fall off, pylons snap, the core goes dark, the tower is cut down, and at the end it is scrap.
import type { KeepArt, KeepBuild } from "../../../artkit/keep";
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { P, horns, skull } from "./parts";

interface Skin { wall: Material; dk: Material; cap: Material }
const SKINS: Record<string, Skin> = {
  default: { wall: P.iron, dk: P.ironDk, cap: P.armor },
  frost: { wall: P.ice, dk: P.iceDk, cap: P.white },
  ember: { wall: P.rust, dk: mat("#3a1c10"), cap: P.tankRed },
  gilded: { wall: P.brass, dk: mat("#6a4a1c", { metal: 0.4 }), cap: P.steel },
  shadow: { wall: P.charLt, dk: P.char, cap: P.gut },
  blossom: { wall: P.bone, dk: P.boneDk, cap: P.pale },
};
const HOLE = mat("#0c0806", { shade: 0.2 });

function pylon(m: Model, x: number, y: number, h: number, sk: Skin, cut: number, lit: boolean) {
  const hh = cut >= 2 ? h * 0.45 : h;
  m.box([x, y, hh / 2 + 0.1], [0.34, 0.34, hh], sk.dk);
  m.decal(0.02, () => m.box([x, y, 0.22], [0.36, 0.36, 0.1], P.hazard));
  if (cut >= 2) { m.with(() => { m.move(x + 0.25, y, 0.2).rotY(70); m.box([0, 0, 0], [0.3, 0.3, 0.5], sk.dk); }); return; }
  m.box([x, y, hh + 0.16], [0.44, 0.44, 0.12], sk.wall);
  if (!cut) m.box([x, y, hh + 0.3], [0.22, 0.22, 0.2], lit ? P.visor : HOLE);
}
function scrap(m: Model, sk: Skin) {
  const bits: [number, number, number, number][] = [[0, 0, 0.3, 0.6], [0.5, 0.3, 0.2, 0.4], [-0.45, -0.35, 0.22, 0.44], [0.3, -0.55, 0.16, 0.34], [-0.55, 0.45, 0.16, 0.34], [0.8, -0.05, 0.12, 0.26], [-0.85, 0.0, 0.12, 0.26], [0.1, 0.8, 0.12, 0.28]];
  bits.forEach(([x, y, z, s], i) => m.with(() => { m.move(x, y, z).rotZ(i * 37).rotY(i % 2 ? 18 : -12); m.box([0, 0, 0], [s, s * 1.3, s * 0.7], i % 3 ? sk.wall : sk.dk); }));
  m.with(() => { m.move(0.2, 0.1, 0.55).rotY(-30); skull(m, 0.26, HOLE, sk.wall); });
  m.with(() => { m.move(-0.2, 0.3, 0.4).rotY(34); m.cylinder([0, 0, 0], [0, 0, 0.8], 0.03, P.ironDk, 0.03, { segs: 4 }); m.poly([[0, 0, 0.8], [0, 0.34, 0.7], [0, 0, 0.54]], P.teamFlat); });
}

export const KEEPS: KeepArt = {
  anchors: {
    gate: [0.95, 0, 0.3], top: [-0.1, 0, 1.7], pole: [-0.1, 0, 2.6],
    fires: [[-0.1, 0, 1.4], [0.6, 0.75, 0.9], [0.6, -0.75, 0.9], [0.85, 0.2, 0.5]],
    smoke: [[-0.1, 0, 1.3], [0.6, 0.75, 0.8], [0.6, -0.75, 0.8]],
  },
  skinTeams: {
    frost: { main: "#9adcf0", dark: "#3a86ac", light: "#ffffff" }, ember: { main: "#ff7a1c", dark: "#8a1c12", light: "#ffe070" },
    gilded: { main: "#ffe070", dark: "#c08a40", light: "#ffffff" }, shadow: { main: "#b040b0", dark: "#6a1c6a", light: "#e0a0ff" },
    blossom: { main: "#ff9ab0", dark: "#b04a6a", light: "#ffffff" },
  },
  build(m: Model, k: KeepBuild) {
    const sk = SKINS[k.skin ?? "default"] ?? SKINS.default, d = k.damage;
    // ---- the bed: a bolted plate with a ring in the side's colour
    m.box([0, 0, 0.05], [2.36, 2.36, 0.1], sk.dk);
    m.decal(0.01, () => { for (const s of [1, -1]) { m.box([s * 1.1, 0, 0.07], [0.2, 2.4, 0.08], P.teamFlat); m.box([0, s * 1.1, 0.07], [2.4, 0.2, 0.08], P.teamFlat); } });
    if (d >= 4) return scrap(m, sk);
    // ---- the bunker block, with armour plates in the side's colour on its shoulders
    const wh = 0.7;
    m.box([0.1, 0, 0.1 + wh / 2], [1.5, 1.74, wh], sk.wall);
    m.decal(0.015, () => { for (const y of [-0.58, 0, 0.58]) m.box([0.855, y, 0.2], [0.02, 0.5, 0.09], sk.dk); for (const y of [-0.87, 0.87]) for (const x of [-0.3, 0.2, 0.7]) m.box([x, y, 0.5], [0.3, 0.02, 0.4], sk.dk); });
    for (const [s, gone] of [[1, d >= 2], [-1, d >= 3]] as [number, boolean][]) if (!gone) m.with(() => { m.move(0.2, s * 0.62, 0.1 + wh + 0.04).rotX(s * 12); m.box([0, 0, 0], [1.2, 0.5, 0.1], P.team); });
    else m.decal(0.02, () => m.box([0.2, s * 0.6, 0.1 + wh + 0.01], [0.9, 0.4, 0.02], HOLE));
    // the blast doors: hazard frame, side-colour doors, a skull boss
    m.decal(0.03, () => m.box([0.86, 0, 0.36], [0.03, 0.7, 0.56], P.hazard));
    m.decal(0.035, () => { for (const y of [-0.26, -0.09, 0.09, 0.26]) m.box([0.862, y, 0.62], [0.03, 0.08, 0.05], P.black); });
    m.decal(0.04, () => m.box([0.87, 0, 0.32], [0.03, 0.56, 0.46], d >= 3 ? HOLE : P.teamFlat));
    m.decal(0.05, () => m.box([0.875, 0, 0.32], [0.03, 0.03, 0.46], P.black));
    if (d >= 1) m.decal(0.045, () => { for (const [y, z, w, h] of [[0.5, 0.5, 0.05, 0.3], [0.56, 0.4, 0.16, 0.05], [-0.6, 0.3, 0.05, 0.26], ...(d >= 2 ? [[-0.42, 0.6, 0.3, 0.14], [0.3, 0.16, 0.24, 0.1]] : [])]) m.box([0.87, y, z], [0.02, w, h], HOLE); });
    // ---- the reactor tower
    const th = d >= 3 ? 0.9 : 1.5 + (k.boss ? 0.14 : 0);
    m.cylinder([-0.1, 0, 0.1], [-0.1, 0, 0.1 + th], 0.5, sk.wall, 0.44, { segs: 8 });
    for (let z = 0.95; z < th; z += 0.28) m.torus([-0.1, 0, z], [0, 0, 1], 0.47, 0.035, sk.dk);
    if (d < 3) {
      // the core window and the skull over it
      m.decal(0.03, () => m.box([0.36, 0, 1.12], [0.03, 0.3, 0.34], d >= 2 ? HOLE : P.visor));
      m.decal(0.04, () => { for (const y of [-0.08, 0.08]) m.box([0.37, y, 1.12], [0.03, 0.03, 0.34], sk.dk); });
      m.cylinder([-0.1, 0, 0.1 + th], [-0.1, 0, 0.22 + th], 0.56, sk.cap, 0.56, { segs: 8 });
      if (d <= 1) {
        m.with(() => { m.move(-0.02, 0, 0.5 + th); skull(m, 0.3, d >= 1 ? P.redLamp : P.visor, k.boss ? P.brass : sk.cap); horns(m, 0.3, k.boss ? P.bone : sk.dk, k.boss ? 1.1 : 0.6, 0.2, 0.34); });
        if (k.boss) for (const a of [0.8, 2.4, 3.9, 5.5]) m.cone([-0.1 + Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.2 + th], [-0.1 + Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.6 + th], 0.07, P.bone, { segs: 4 });
      } else m.decal(0.02, () => m.cylinder([-0.1, 0, 0.22 + th], [-0.1, 0, 0.23 + th], 0.4, HOLE, 0.4, { segs: 8 }));
      // the mast and its pennant
      if (d <= 2) {
        const z0 = 0.2 + th, z1 = Math.min(2.6, z0 + (d <= 1 ? 0.95 : 0.5));
        m.cylinder([-0.42, 0, z0], [-0.42, 0, z1], 0.022, P.ironDk, 0.022, { segs: 4 });
        m.poly([[-0.42, 0, z1], [-0.42, 0.42, z1 - 0.1], [-0.42, 0, z1 - 0.26]], P.teamFlat);
      }
    } else {
      m.group(() => { for (let i = 0; i < 6; i++) { const a = i * 1.05; m.box([-0.1 + Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.1 + th + 0.04 + 0.07 * ((i * 5) % 3)], [0.26, 0.26, 0.16 + 0.14 * ((i * 5) % 3)], sk.dk); } });
      m.decal(0.02, () => m.box([0.37, 0.1, 0.8], [0.03, 0.3, 0.2], HOLE));
    }
    // ---- the pylons
    pylon(m, 0.72, 0.84, 0.95, sk, d >= 3 ? 2 : d >= 2 ? 1 : 0, true);
    pylon(m, 0.72, -0.84, 0.95, sk, d >= 3 ? 2 : d >= 1 ? 1 : 0, true);
    pylon(m, -0.78, 0.84, 0.8, sk, d >= 2 ? 2 : 0, true);
    pylon(m, -0.78, -0.84, 0.8, sk, d >= 3 ? 2 : 0, true);
    if (d >= 3) m.group(() => { for (const [x, y, s] of [[1.0, 0.3, 0.2], [1.05, -0.35, 0.16], [0.95, 0.0, 0.12]]) m.box([x, y, 0.1 + s / 2], [s, s * 1.2, s], sk.dk); });
  },
};
