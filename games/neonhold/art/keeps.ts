// Neonhold's keeps: crew towers. A dark block of lit windows on a hex podium, four light pylons, a gate of light,
// a hard-light crown ring and the crew's pennant on the mast. As the commander's health drains the windows go out
// floor by floor, the crown falls, the top burns and shears off, and at the end there is a stump in its own rubble.
import type { KeepArt } from "../../../artkit/keep";
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { P, puff } from "./parts";
import { S } from "./scenery";

interface Skin { wall: Material; block: Material; plinth: Material; win: Material; trim: Material }
const SKINS: Record<string, Skin> = {
  default: { wall: S.wall, block: S.wallDk, plinth: S.dark, win: S.winWarm, trim: S.chrome },
  frost: { wall: mat("#8fb0e8", { emit: 0.25 }), block: mat("#6a8ac8"), plinth: mat("#3a4a7a"), win: S.ice, trim: S.chrome },
  ember: { wall: mat("#7a3a5a"), block: mat("#5a2a48"), plinth: mat("#3a1a30"), win: S.yel, trim: S.gold },
  gilded: { wall: mat("#c9b070", { emit: 0.3 }), block: mat("#a08848", { emit: 0.2 }), plinth: mat("#5a4a2a"), win: S.white, trim: S.gold },
  shadow: { wall: mat("#4a3a8a"), block: mat("#34286a"), plinth: mat("#1e1840"), win: S.vi, trim: mat("#b9a0ff", { emit: 0.5 }) },
  blossom: { wall: mat("#e8a8d0", { emit: 0.3 }), block: mat("#c080b0", { emit: 0.2 }), plinth: mat("#6a3a60"), win: S.white, trim: S.chrome },
};
const HOLE = mat("#14122e", { shade: 0.2 });
const OUT = mat("#26244e");

export const KEEPS: KeepArt = {
  anchors: {
    gate: [0.95, 0, 0.2], top: [0, 0, 1.6], pole: [0, 0, 2.62],
    fires: [[0, 0, 1.5], [0.5, 0.6, 0.5], [0.3, -0.8, 0.9], [0.8, -0.3, 0.35]],
    smoke: [[0, 0, 0.9], [0.4, 0.7, 0.4], [0.5, -0.6, 0.55]],
  },
  skinTeams: {
    frost: { main: "#bfe6ff", dark: "#5f8fd0", light: "#f2fbff" }, ember: { main: "#ff9a2e", dark: "#b0461a", light: "#ffe0a0" },
    gilded: { main: "#ffe27a", dark: "#b8902e", light: "#fff6d0" }, shadow: { main: "#9a6bff", dark: "#4a2ea0", light: "#d6c4ff" },
    blossom: { main: "#ff7ad0", dark: "#b0408a", light: "#ffd0ee" },
  },
  build(m, k) {
    const sk = SKINS[k.skin ?? "default"] ?? SKINS.default, d = k.damage;
    // ---- podium: a hex slab with a ring of team light
    m.cylinder([0, 0, 0], [0, 0, 0.2], 1.22, sk.plinth, 1.16, { segs: 6 });
    m.decal(0.01, () => m.cylinder([0, 0, 0.2], [0, 0, 0.215], 1.08, P.team, 1.08, { segs: 6 }));
    m.decal(0.02, () => m.cylinder([0, 0, 0.215], [0, 0, 0.225], 0.96, sk.plinth, 0.96, { segs: 6 }));
    if (d >= 4) return rubble(m, sk, k.boss);
    // ---- the tower
    const W = 1.26, D = 1.1, top = d >= 3 ? 0.95 : 1.5, z0 = 0.22;
    m.box([0, 0, z0 + (top - z0) / 2], [D, W, top - z0], sk.wall);
    // windows: lit floor by floor, fewer as it takes damage
    const rows = d >= 3 ? 3 : 5, lit = [1, 0.7, 0.4, 0.15][d] ?? 0;
    m.decal(0.03, () => m.group(() => {
      for (let i = 0; i < rows; i++) {
        const z = 0.74 + i * 0.185;
        if (z > top - 0.1) continue;
        for (let j = 0; j < 5; j++) { const on = ((i * 7 + j * 3) % 10) / 10 < lit; if (Math.abs(j - 2) < 1 && i < 1) continue; m.box([D / 2, -W / 2 + (W * (j + 0.5)) / 5, z], [0.02, 0.15, 0.09], on ? sk.win : OUT); }
        for (const s of [1, -1]) for (let j = 0; j < 4; j++) { const on = ((i * 5 + j * 7 + (s > 0 ? 3 : 0)) % 10) / 10 < lit; m.box([-D / 2 + (D * (j + 0.5)) / 4, s * W / 2, z], [0.16, 0.02, 0.09], on ? sk.win : OUT); }
      }
    }));
    // team light: corner tubes and a band under the roof
    for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) m.box([x * D / 2, y * W / 2, z0 + (top - z0) / 2], [0.05, 0.05, top - z0], d >= 3 ? P.teamDk : P.teamGlow);
    if (d < 3) m.decal(0.02, () => m.box([0, 0, top - 0.08], [D + 0.03, W + 0.03, 0.07], P.team));
    // blown-out panels
    const holes: [number, number, number][] = [[0.3, 0.9, 0.16], [-0.42, 1.2, 0.14], [0.1, 0.62, 0.12], [-0.2, 0.86, 0.15]];
    m.decal(0.04, () => { for (const [y, z, r] of holes.slice(0, d === 1 ? 1 : d === 2 ? 3 : d >= 3 ? 4 : 0)) if (z < top - 0.1) m.ellipsoid([D / 2, y, z], [0.03, r, r * 0.9], HOLE, { segs: 7 }); });
    // ---- the gate: a doorway of light in a heavy frame
    m.with(() => {
      m.move(D / 2, 0, 0.22);
      m.box([0.1, 0, 0.22], [0.24, 0.56, 0.44], sk.block);
      m.decal(0.03, () => m.box([0.225, 0, 0.19], [0.02, 0.36, 0.36], d >= 3 ? HOLE : P.teamGlow));
      m.decal(0.05, () => m.group(() => { for (const y of [-0.09, 0.09]) m.box([0.24, y, 0.19], [0.02, 0.025, 0.36], sk.block); }));
      m.box([0.12, 0, 0.47], [0.3, 0.66, 0.06], sk.trim);
    });
    // ---- four light pylons
    [[0.8, 0.82], [0.8, -0.82], [-0.8, 0.82], [-0.8, -0.82]].forEach(([x, y], i) => m.with(() => {
      m.move(x, y, 0.2);
      const broken = (d >= 2 && i % 2 === 0) || (d >= 3 && i !== 3);
      m.box([0, 0, (broken ? 0.4 : 0.74) / 2], [0.3, 0.3, broken ? 0.4 : 0.74], sk.block);
      m.decal(0.02, () => m.box([0, 0, 0.3], [0.31, 0.31, 0.05], sk.trim));
      if (broken) { m.decal(0.02, () => m.box([0, 0, 0.405], [0.22, 0.22, 0.01], HOLE)); return; }
      m.box([0, 0, 0.86], [0.2, 0.2, 0.24], d >= 1 && i === 1 ? OUT : P.teamGlow);
      m.box([0, 0, 1.0], [0.3, 0.3, 0.05], sk.block);
    }));
    // ---- roof
    if (d <= 1) {
      m.box([-0.05, 0, top + 0.16], [0.74, 0.9, 0.32], sk.block);
      m.decal(0.03, () => m.group(() => { for (let j = 0; j < 4; j++) m.box([0.32, -0.3 + j * 0.2, top + 0.17], [0.02, 0.11, 0.12], sk.win); }));
      // the crown: a ring of hard light round the top
      m.with(() => { m.move(0, 0, top + 0.2).rotX(d === 1 ? 9 : 0); m.torus([0, 0, 0], [0, 0, 1], 0.86, 0.045, P.teamGlow, { segs: 22 }); if (k.boss) m.torus([0, 0, 0.16], [0, 0, 1], 0.98, 0.035, S.gold, { segs: 22 }); });
      if (k.boss) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5; m.cone([Math.cos(a) * 0.98, Math.sin(a) * 0.98, top + 0.36], [Math.cos(a) * 1.02, Math.sin(a) * 1.02, top + 0.62], 0.07, S.gold, { segs: 5 }); }
      // mast and pennant
      m.cylinder([0, 0, top + 0.3], [0, 0, 2.6], 0.03, sk.trim, 0.022, { segs: 6 });
      m.sphere([0, 0, 2.62], 0.06, k.boss ? S.red : P.aether, { segs: 8 });
      const fl = d === 1 ? 0.32 : 0.52;
      m.poly([[0, 0, 2.55], [0, -fl, 2.48], [0, -fl * 0.72, 2.37], [0, -fl, 2.26], [0, 0, 2.2]], P.holo);
      m.box([0.18, 0.3, top + 0.4], [0.12, 0.12, 0.16], sk.trim);
      if (k.boss) m.box([-0.05, 0, top + 0.37], [0.5, 0.6, 0.1], S.gold);
    } else {
      // sheared off: a jagged edge round the fire (or the cold dark)
      m.group(() => { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, hgt = 0.1 + 0.22 * ((i * 5) % 4) / 3, rx = Math.cos(a) * D * 0.46, ry = Math.sin(a) * W * 0.46; m.cone([rx, ry, top - 0.02], [rx * 1.04, ry * 1.04, top + hgt], 0.15, sk.wall, { segs: 4 }); } });
      m.decal(0.01, () => m.box([0, 0, top - 0.02], [D * 0.86, W * 0.86, 0.02], HOLE));
      if (d === 2) m.decal(0.03, () => m.group(() => { m.sphere([0.1, 0.1, top], 0.2, P.plasma, { segs: 8 }); m.sphere([-0.2, -0.15, top], 0.15, P.laser, { segs: 8 }); m.sphere([0.2, -0.3, top - 0.01], 0.12, P.plasma, { segs: 6 }); }));
      // the crown, fallen across the roof
      m.with(() => { m.move(0.1, -0.2, top + 0.1).rotX(38).rotY(12); m.torus([0, 0, 0], [0, 0, 1], 0.8, 0.045, d >= 3 ? P.teamDk : P.team, { segs: 18 }); });
      if (d === 2) m.with(() => { m.move(-0.3, 0.2, top).rotY(-24); m.cylinder([0, 0, 0], [0, 0, 0.9], 0.03, sk.trim, 0.022, { segs: 6 }); m.poly([[0, 0, 0.86], [0, -0.3, 0.8], [0, 0, 0.6]], P.holo); });
    }
    if (d === 1) puff(m, [0.6, 0.45, 0.8], 0.1, 0.4, P.smoke, 3);
    if (d >= 3) m.group(() => { for (const [x, y, s, r] of [[0.95, 0.4, 0.22, 20], [0.9, -0.5, 0.18, 50], [0.2, -1.0, 0.2, 10], [-0.9, -0.2, 0.18, 70]]) m.with(() => { m.move(x, y, 0.22 + s / 2).rotZ(r); m.box([0, 0, 0], [s * 1.6, s, s], sk.wall); }); });
  },
};

/** What is left: a stump, slabs of wall, the crown in pieces, one window still lit. */
function rubble(m: Model, sk: Skin, boss: boolean) {
  m.box([0, 0, 0.4], [1.1, 1.26, 0.36], sk.wall);
  m.group(() => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; m.cone([Math.cos(a) * 0.5, Math.sin(a) * 0.56, 0.56], [Math.cos(a) * 0.54, Math.sin(a) * 0.6, 0.68 + 0.14 * ((i * 3) % 3)], 0.16, sk.wall, { segs: 4 }); } });
  m.decal(0.01, () => m.box([0, 0, 0.585], [0.9, 1.05, 0.02], HOLE));
  m.decal(0.03, () => m.box([0.55, 0.3, 0.42], [0.02, 0.15, 0.09], sk.win));
  const bits: [number, number, number, number, Material][] = [[0.3, 0.2, 0.26, 30, sk.wall], [-0.2, -0.3, 0.3, 70, sk.block], [0.95, 0.4, 0.2, 15, sk.wall], [0.9, -0.5, 0.22, 55, sk.block], [-0.9, 0.5, 0.2, 40, sk.wall], [0.1, 1.0, 0.18, 80, sk.block], [-0.6, -0.85, 0.22, 25, sk.wall]];
  m.group(() => { for (const [x, y, s, r, c] of bits) m.with(() => { m.move(x, y, (Math.hypot(x, y) < 0.6 ? 0.6 : 0.24) + s * 0.4).rotZ(r).rotY(r * 0.4); m.box([0, 0, 0], [s * 1.7, s * 1.1, s * 0.5], c); }); });
  m.with(() => { m.move(-0.2, 0.1, 0.66).rotX(70).rotY(20); m.torus([0, 0, 0], [0, 0, 1], 0.5, 0.045, boss ? S.gold : P.teamDk, { segs: 14 }); });
  m.with(() => { m.move(-0.3, -0.95, 0.3).rotY(84); m.cylinder([0, 0, 0], [0, 0, 0.9], 0.03, sk.trim, 0.022, { segs: 6 }); });
}
