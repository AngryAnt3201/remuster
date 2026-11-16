// Brasswick's keeps: boiler-fortresses. A riveted copper drum on an iron plinth under a team-coloured dome, a furnace
// gate, a clock, four lamp turrets and a great stack. As the commander's health drains the plates blow out, the dome
// caves in over the fire, and at the end there is only scrap on the plinth.
import type { KeepArt } from "../../../artkit/keep";
import { Model, mat, type Material, type V3 } from "../../../artkit/toon3d";
import { GOLD, P, gear, puff, stack } from "./parts";
import { S } from "./scenery";

interface Skin { drum: Material; band: Material; plinth: Material; glow: Material; cap?: Material }
const SKINS: Record<string, Skin> = {
  default: { drum: P.copper, band: P.brass, plinth: P.ironDk, glow: P.lamp },
  frost: { drum: P.steel, band: mat("#8fb8d8", { metal: 0.7 }), plinth: mat("#5d7388"), glow: P.frost, cap: S.snow },
  ember: { drum: P.ironDk, band: P.copper, plinth: mat("#2c2226"), glow: P.fire },
  gilded: { drum: GOLD, band: P.white, plinth: mat("#8a6a34"), glow: P.lamp },
  shadow: { drum: mat("#4a3d63", { metal: 0.4 }), band: mat("#8f7ad0", { metal: 0.6 }), plinth: mat("#2a2238"), glow: P.venom },
  blossom: { drum: mat("#f3dccb"), band: mat("#e89ab5", { metal: 0.4 }), plinth: mat("#a8798a"), glow: mat("#ffd0e0", { emit: 1, glow: 0.8, ink: false }) },
};
const HOLE = mat("#241a1c", { shade: 0.2 });

export const KEEPS: KeepArt = {
  anchors: {
    gate: [0.95, 0, 0.2], top: [0, 0, 1.55], pole: [0, 0, 2.62],
    fires: [[0, 0, 1.45], [0.5, 0.6, 0.5], [0.3, -0.85, 0.9], [0.8, -0.3, 0.35]],
    smoke: [[0, 0, 0.9], [0.4, 0.7, 0.4], [0.5, -0.6, 0.55]],
  },
  skinTeams: {
    frost: { main: "#9fd8f0", dark: "#4f8fb4", light: "#eafaff" }, ember: { main: "#ff7a3d", dark: "#a8331f", light: "#ffd0a0" },
    gilded: { main: "#f6f1e6", dark: "#c9b58a", light: "#ffffff" }, shadow: { main: "#7a5cc8", dark: "#3d2c6e", light: "#c9b8ff" },
    blossom: { main: "#f6a3c2", dark: "#b8627f", light: "#ffe0ec" },
  },
  build(m, k) {
    const sk = SKINS[k.skin ?? "default"] ?? SKINS.default, d = k.damage;
    // ---- plinth
    m.cylinder([0, 0, 0], [0, 0, 0.2], 1.2, sk.plinth, 1.14, { segs: 8 });
    m.cylinder([0, 0, 0.18], [0, 0, 0.26], 1.1, P.team, 1.06, { segs: 8 });
    m.decal(0.01, () => m.group(() => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; m.sphere([Math.cos(a) * 1.16, Math.sin(a) * 1.16, 0.1], 0.045, sk.band, { segs: 6 }); } }));
    if (d >= 4) return rubble(m, sk, k.boss);
    // ---- the drum
    const top = d >= 3 ? 0.78 : 1.25;
    m.cylinder([0, 0, 0.24], [0, 0, top], 0.74, sk.drum, 0.7, { segs: 16 });
    for (const z of [0.42, 0.9].filter((z) => z < top - 0.1)) m.cylinder([0, 0, z], [0, 0, z + 0.09], 0.755 - (z - 0.24) * 0.04, sk.band, 0.75 - (z - 0.24) * 0.04, { segs: 16 });
    m.decal(0.015, () => m.group(() => { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; m.sphere([Math.cos(a) * 0.745, Math.sin(a) * 0.745, 0.66], 0.03, sk.band, { segs: 6 }); } }));
    // blown-out plates
    const holes: [number, number, number][] = [[0.6, 0.62, 0.17], [-0.9, 1.0, 0.14], [1.6, 0.5, 0.13], [-0.3, 0.95, 0.12], [2.4, 0.75, 0.15]];
    m.decal(0.03, () => { for (const [a, z, r] of holes.slice(0, d === 1 ? 2 : d === 2 ? 4 : d >= 3 ? 5 : 0)) if (z < top) m.ellipsoid([Math.cos(a) * 0.72, Math.sin(a) * 0.72, z], [r * 0.5, r, r * 1.1], HOLE, { segs: 8 }); });
    // ---- gate: a furnace door in a brass frame
    m.with(() => {
      m.move(0.66, 0, 0.24);
      m.box([0.1, 0, 0.2], [0.26, 0.5, 0.4], P.ironDk);
      m.cylinder([-0.03, 0, 0.4], [0.23, 0, 0.4], 0.25, P.ironDk, 0.25, { segs: 12 });
      m.decal(0.03, () => { m.box([0.235, 0, 0.18], [0.02, 0.34, 0.36], d >= 3 ? HOLE : sk.glow); m.cylinder([0.225, 0, 0.36], [0.245, 0, 0.36], 0.17, d >= 3 ? HOLE : sk.glow, 0.17, { segs: 12 }); });
      m.decal(0.05, () => m.group(() => { for (const y of [-0.085, 0, 0.085]) m.box([0.25, y, 0.25], [0.02, 0.03, 0.5], P.ironDk); }));
      m.torus([0.24, 0, 0.36], [1, 0, 0], 0.25, 0.035, sk.band, { segs: 14 });
    });
    // ---- the clock over the gate
    if (d < 3) m.with(() => {
      m.move(0.71, 0, 1.02);
      m.cylinder([0, 0, 0], [0.06, 0, 0], 0.2, sk.band, 0.2, { segs: 14 });
      m.decal(0.03, () => { m.cylinder([0.06, 0, 0], [0.07, 0, 0], 0.155, d >= 2 ? HOLE : P.white, 0.155, { segs: 14 }); if (d < 2) { m.box([0.08, 0, 0.05], [0.02, 0.025, 0.12], P.soot); m.box([0.08, 0.04, 0], [0.02, 0.09, 0.025], P.soot); } });
    });
    // ---- four lamp turrets
    [[0.78, 0.78], [0.78, -0.78], [-0.78, 0.78], [-0.78, -0.78]].forEach(([x, y], i) => m.with(() => {
      m.move(x, y, 0.2);
      const broken = d >= 2 && i % 2 === 0 || d >= 3 && i !== 3;
      m.cylinder([0, 0, 0], [0, 0, broken ? 0.42 : 0.72], 0.2, sk.drum, 0.18, { segs: 10 });
      m.cylinder([0, 0, 0.3], [0, 0, 0.38], 0.205, sk.band, 0.205, { segs: 10 });
      if (broken) { m.decal(0.02, () => m.cylinder([0, 0, 0.42], [0, 0, 0.43], 0.15, HOLE, 0.15, { segs: 10 })); return; }
      m.cylinder([0, 0, 0.72], [0, 0, 0.86], 0.14, d >= 1 && i === 1 ? HOLE : sk.glow, 0.16, { segs: 10 });
      m.cone([0, 0, 0.86], [0, 0, 1.12], 0.24, sk.cap ?? P.team, { segs: 10 });
      m.sphere([0, 0, 1.13], 0.05, sk.band, { segs: 6 });
    }));
    // ---- pipes round the back
    m.tube([[-0.5, 0.56, 0.3], [-0.6, 0.66, 0.9], [-0.4, 0.5, 1.2]], 0.06, P.brassDk, { segs: 6 });
    m.tube([[-0.5, -0.56, 0.3], [-0.6, -0.66, 0.7], [-0.44, -0.52, 1.0]], 0.06, P.brassDk, { segs: 6 });
    // ---- roof
    if (d <= 1) {
      m.ellipsoid([0, 0, 1.25], [0.78, 0.78, 0.4], sk.cap ?? P.team, { segs: 16 });
      m.cylinder([0, 0, 1.22], [0, 0, 1.31], 0.8, sk.band, 0.77, { segs: 16 });
      m.decal(0.02, () => m.group(() => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; m.tube([[Math.cos(a) * 0.76, Math.sin(a) * 0.76, 1.3], [Math.cos(a) * 0.55, Math.sin(a) * 0.55, 1.53], [Math.cos(a) * 0.12, Math.sin(a) * 0.12, 1.65]], 0.02, P.teamDk, { segs: 4 }); } }));
      if (k.boss) m.with(() => { m.move(0, 0, 1.36).rotX(90); gear(m, 0.95, 0.09, GOLD, 16, 0, null); });
      m.cylinder([0, 0, 1.6], [0, 0, 1.72], 0.16, sk.band, 0.12, { segs: 10 });
      // the colours on a pole
      m.cylinder([0, 0, 1.7], [0, 0, 2.6], 0.03, P.woodDk, 0.025, { segs: 6 });
      m.sphere([0, 0, 2.62], 0.06, GOLD, { segs: 8 });
      const fl = d === 1 ? 0.3 : 0.5;
      m.poly([[0, 0, 2.55], [0, -fl, 2.47], [0, -fl * 0.7, 2.36], [0, -fl, 2.24], [0, 0, 2.2]], k.boss ? P.red : P.team);
      if (k.boss) m.cone([0, 0, 1.7], [0, 0, 2.05], 0.12, GOLD, { segs: 8 });
    } else {
      // caved in: a jagged rim round the fire (or the cold dark)
      m.group(() => { for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, h = 0.1 + 0.2 * ((i * 5) % 4) / 3; m.cone([Math.cos(a) * 0.68, Math.sin(a) * 0.68, top - 0.02], [Math.cos(a) * 0.72, Math.sin(a) * 0.72, top + h], 0.16, d >= 3 ? sk.drum : sk.cap ?? P.team, { segs: 5 }); } });
      m.decal(0.01, () => m.cylinder([0, 0, top - 0.04], [0, 0, top - 0.02], 0.62, HOLE, 0.62, { segs: 14 }));
      if (d === 2) m.decal(0.03, () => m.group(() => { m.sphere([0.1, 0.1, top - 0.02], 0.2, P.fire, { segs: 8 }); m.sphere([-0.2, -0.15, top - 0.02], 0.15, P.fireHot, { segs: 8 }); m.sphere([0.2, -0.3, top - 0.03], 0.12, P.fire, { segs: 6 }); }));
      m.group(() => { m.box([-0.2, 0.1, top + 0.02], [0.7, 0.07, 0.07], P.ironDk); m.with(() => { m.move(0.1, -0.2, top + 0.02).rotZ(60); m.box([0, 0, 0], [0.6, 0.07, 0.07], P.ironDk); }); });
    }
    // ---- the great stack: straight, then leaning, then down
    const lean = [0, 9, 24][d] ?? 0;
    if (d <= 2) m.with(() => {
      m.move(-0.42, 0.5, top - 0.25).rotY(-lean).rotX(lean * 0.4);
      stack(m, 0.17, 1.25, P.ironDk, sk.band);
      m.cylinder([0, 0, 0.6], [0, 0, 0.72], 0.175, P.team, 0.165, { segs: 10 });
      if (k.boss) m.with(() => { m.move(0.0, -1.0, 0); stack(m, 0.14, 1.1, P.ironDk, GOLD); });
      if (d <= 1) puff(m, [0.05, 0, 1.4], 0.14, 0.4, d ? P.steam : P.smoke, 2);
    });
    else m.with(() => { m.move(-0.35, 0.95, 0.42).rotY(86); stack(m, 0.17, 0.9, P.ironDk, sk.band); });
    if (d === 1) { puff(m, [0.72, 0.5, 0.7], 0.1, 0.4, P.steam, 3); }
    if (d >= 3) m.group(() => { for (const [x, y, s, r] of [[0.9, 0.5, 0.2, 20], [0.95, -0.55, 0.16, 50], [0.3, -0.98, 0.2, 10], [-0.9, -0.3, 0.18, 70]]) m.with(() => { m.move(x, y, 0.26 + s / 2).rotZ(r); m.box([0, 0, 0], [s * 1.6, s, s], sk.drum); }); });
  },
};

/** What is left: scrap on the plinth. */
function rubble(m: Model, sk: Skin, boss: boolean) {
  m.cylinder([0, 0, 0.24], [0, 0, 0.5], 0.74, sk.drum, 0.72, { segs: 16 });
  m.group(() => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; m.cone([Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0.48], [Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.58 + 0.14 * ((i * 3) % 3)], 0.15, sk.drum, { segs: 5 }); } });
  m.decal(0.01, () => m.cylinder([0, 0, 0.47], [0, 0, 0.49], 0.6, HOLE, 0.6, { segs: 14 }));
  const bits: [number, number, number, number, Material][] = [[0.3, 0.2, 0.26, 30, sk.drum], [-0.2, -0.3, 0.3, 70, sk.band], [0.9, 0.4, 0.2, 15, sk.drum], [0.85, -0.5, 0.22, 55, P.ironDk], [-0.85, 0.5, 0.2, 40, sk.drum], [0.1, 0.95, 0.18, 80, sk.band], [-0.6, -0.8, 0.22, 25, P.ironDk]];
  m.group(() => { for (const [x, y, s, r, c] of bits) m.with(() => { m.move(x, y, (Math.hypot(x, y) < 0.6 ? 0.5 : 0.26) + s * 0.4).rotZ(r).rotY(r * 0.4); m.box([0, 0, 0], [s * 1.7, s * 1.1, s * 0.5], c); }); });
  m.with(() => { m.move(-0.3, -0.92, 0.42).rotY(86); stack(m, 0.17, 0.9, P.ironDk, sk.band); });
  m.with(() => { m.move(-0.1, 0.1, 0.56).rotY(70).rotZ(40); gear(m, 0.4, 0.09, boss ? GOLD : sk.band, 10); });
  m.with(() => { m.move(0.7, 0.75, 0.2).rotY(20); m.cone([0, 0, 0], [0.1, 0, 0.3], 0.24, sk.cap ?? P.team, { segs: 10 }); });
}
void ({} as V3);
