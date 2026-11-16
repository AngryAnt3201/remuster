// Dustline's keeps: each side's headquarters is a false-front hall on a boardwalk deck: a shingled roof and a striped
// porch in the side's colour, a great star on the facade, a water tower out back and the colours on a pole. As the
// commander's health drains boards blow out, the roof burns through, the facade snaps, and at the end there is only
// lumber on the deck.
import type { KeepArt } from "../../../artkit/keep";
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { GOLD, P, puff, star } from "./parts";
import { S } from "./scenery";

interface Skin { wall: Material; front: Material; trim: Material; deck: Material; glow: Material; roof?: Material; star?: Material }
const SKINS: Record<string, Skin> = {
  default: { wall: S.pine, front: S.pineLt, trim: S.pineDk, deck: S.pineDk, glow: S.lit },
  frost: { wall: mat("#b9c9d6"), front: mat("#e6eef4"), trim: mat("#6f8aa0"), deck: mat("#5d7388"), glow: P.frost, roof: S.snow, star: P.steel },
  ember: { wall: mat("#5a4038"), front: mat("#7a4a3a"), trim: mat("#2c2226"), deck: mat("#2c2226"), glow: P.fire, star: P.copper },
  gilded: { wall: S.white, front: S.white, trim: GOLD, deck: mat("#8a6a34"), glow: S.lit, star: GOLD },
  shadow: { wall: mat("#4a3d63"), front: mat("#5d4d7a"), trim: mat("#2a2238"), deck: mat("#2a2238"), glow: P.ghost, star: mat("#c9b8ff", { metal: 0.8 }) },
  blossom: { wall: mat("#f3dccb"), front: mat("#fbeee4"), trim: mat("#b8627f"), deck: mat("#a8798a"), glow: mat("#ffd0e0", { emit: 1, glow: 0.8, ink: false }), star: mat("#ffe08a", { metal: 0.8 }) },
};
const HOLE = mat("#22140e", { shade: 0.2 });
const CHAR = mat("#3a2a22");

export const KEEPS: KeepArt = {
  anchors: {
    gate: [1.0, 0, 0.3], top: [0.45, 0, 2.05], pole: [0.45, 0, 2.66],
    fires: [[-0.25, 0, 1.45], [0.6, 0.55, 0.9], [-0.5, -0.6, 1.0], [0.9, -0.3, 0.4]],
    smoke: [[-0.25, 0, 1.2], [0.4, 0.6, 0.6], [0.5, -0.6, 0.7]],
  },
  skinTeams: {
    frost: { main: "#9fd8f0", dark: "#4f8fb4", light: "#eafaff" }, ember: { main: "#ff7a3d", dark: "#a8331f", light: "#ffd0a0" },
    gilded: { main: "#f6f1e6", dark: "#c9b58a", light: "#ffffff" }, shadow: { main: "#7a5cc8", dark: "#3d2c6e", light: "#c9b8ff" },
    blossom: { main: "#f6a3c2", dark: "#b8627f", light: "#ffe0ec" },
  },
  build(m, k) {
    const sk = SKINS[k.skin ?? "default"] ?? SKINS.default, d = k.damage, roof = sk.roof ?? P.team, badge = k.boss ? GOLD : sk.star ?? P.brass;
    // ---- the deck
    m.cylinder([0, 0, 0], [0, 0, 0.14], 1.22, sk.deck, 1.18, { segs: 8 });
    m.decal(0.01, () => m.cylinder([0, 0, 0.05], [0, 0, 0.11], 1.21, P.team, 1.2, { segs: 8 }));
    m.decal(0.012, () => m.group(() => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; m.sphere([Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0.08], 0.04, P.brass, { segs: 6 }); } }));
    if (d >= 4) return rubble(m, sk, badge);
    const hh = 1.0, y2 = 0.76, x0 = -0.82, x1 = 0.46; // the hall: eaves height, half width, back and front
    // ---- the hall
    m.box([(x0 + x1) / 2, 0, 0.14 + hh / 2], [x1 - x0, y2 * 2, hh], sk.wall);
    m.decal(0.01, () => m.group(() => { for (let z = 0.34; z < 1.1; z += 0.2) for (const s of [1, -1]) m.box([(x0 + x1) / 2, s * (y2 + 0.002), z], [x1 - x0, 0.01, 0.02], sk.trim); }));
    const holes: [number, number, number][] = [[-0.5, 0.5, 0.2], [-0.1, 0.9, 0.16], [0.2, 0.55, 0.14], [-0.6, 0.95, 0.15]];
    m.decal(0.03, () => { holes.slice(0, d === 1 ? 2 : d >= 2 ? 4 : 0).forEach(([x, z, r], i) => m.ellipsoid([x, (i % 2 ? 1 : -1) * (y2 + 0.005), z], [r, 0.02, r * 0.8], HOLE, { segs: 7 })); });
    // ---- the roof: shingles in the side's colour, then burning through, then gone
    if (d <= 1) {
      m.with(() => { m.move((x0 + x1) / 2, 0, 0.14 + hh).rotZ(90); m.extrude([[-y2 - 0.08, 0], [y2 + 0.08, 0], [0, 0.48]], x1 - x0 + 0.1, roof); });
      m.decal(0.012, () => m.group(() => { for (const s of [1, -1]) for (const t of [0.3, 0.62]) m.box([(x0 + x1) / 2, s * (y2 + 0.08) * (1 - t), 0.14 + hh + 0.48 * t + 0.012], [x1 - x0 + 0.1, 0.03, 0.02], P.teamDk); }));
      if (d === 1) m.decal(0.03, () => m.ellipsoid([-0.3, 0.36, 0.14 + hh + 0.27], [0.2, 0.16, 0.1], HOLE, { segs: 7 }));
      m.box([-0.55, -0.3, 0.14 + hh + 0.5], [0.2, 0.2, 0.5], S.stoneDk);
    } else {
      m.decal(0.01, () => m.box([(x0 + x1) / 2, 0, 0.14 + hh - 0.02], [x1 - x0 - 0.1, y2 * 2 - 0.1, 0.02], HOLE));
      m.group(() => { for (let i = 0; i < 5; i++) m.with(() => { m.move(x0 + 0.15 + i * 0.26, (i % 2 ? 1 : -1) * 0.2, 0.14 + hh + 0.06).rotZ(25 * (i % 3) - 20).rotY(12 * (i % 2 ? 1 : -1)); m.box([0, 0, 0], [0.07, 1.3, 0.07], CHAR); }); });
      if (d === 2) { m.decal(0.03, () => m.group(() => { m.sphere([-0.1, 0.1, 0.14 + hh], 0.22, P.fire, { segs: 8 }); m.sphere([-0.45, -0.2, 0.14 + hh], 0.16, P.fireHot, { segs: 8 }); m.sphere([0.15, -0.3, 0.14 + hh], 0.13, P.fire, { segs: 6 }); })); m.with(() => { m.move((x0 + x1) / 2, 0, 0.14 + hh).rotZ(90); m.extrude([[-y2 - 0.08, 0], [-y2 * 0.4, 0], [-y2 * 0.55, 0.26]], x1 - x0 + 0.1, roof); }); }
    }
    // ---- the facade: tall and stepped, the star, the sign; snapped off when ruined
    const fh = d >= 3 ? 1.05 : 1.85;
    m.box([x1 + 0.05, 0, 0.14 + fh / 2], [0.1, y2 * 2 + 0.12, fh], sk.front);
    if (d < 3) {
      m.box([x1 + 0.05, 0, 0.14 + fh + 0.14], [0.1, y2 * 1.1, 0.28], sk.front);
      m.box([x1 + 0.07, 0, 0.14 + fh + 0.31], [0.18, y2 * 1.1 + 0.1, 0.07], sk.trim);
      m.box([x1 + 0.07, 0, 0.14 + fh + 0.02], [0.16, y2 * 2 + 0.2, 0.06], sk.trim);
      m.decal(0.02, () => m.box([x1 + 0.105, 0, 1.52], [0.02, y2 * 1.5, 0.5], d >= 2 ? CHAR : P.teamFlat));
      m.decal(0.04, () => m.with(() => { m.move(x1 + 0.12, d >= 2 ? 0.05 : 0, 1.53).rotZ(90).rotY(d >= 2 ? 16 : 0); star(m, k.boss ? 0.27 : 0.23, badge, 0.03); }));
      if (k.boss) m.decal(0.03, () => m.group(() => { for (const s of [1, -1]) m.with(() => { m.move(x1 + 0.12, s * 0.5, 1.53).rotZ(90); star(m, 0.09, GOLD, 0.02); }); }));
    } else {
      m.group(() => { for (let i = 0; i < 6; i++) m.cone([x1 + 0.05, -y2 + 0.13 + i * 0.28, 0.14 + fh - 0.02], [x1 + 0.05, -y2 + 0.1 + i * 0.28, 0.14 + fh + 0.12 + 0.14 * ((i * 5) % 3)], 0.12, sk.front, { segs: 4 }); });
    }
    m.decal(0.02, () => m.group(() => {
      m.box([x1 + 0.105, 0, 0.5], [0.02, 0.36, 0.7], d >= 3 ? HOLE : S.door);
      for (const s of [1, -1]) m.box([x1 + 0.105, s * 0.5, 0.62], [0.02, 0.3, 0.36], d >= 3 || (d >= 1 && s > 0) ? HOLE : sk.glow);
    }));
    m.decal(0.03, () => m.group(() => { for (const s of [1, -1]) m.box([x1 + 0.11, s * 0.085, 0.56], [0.012, 0.14, 0.3], sk.trim); }));
    // ---- the porch: stripes in the side's colour on four posts
    const posts = d >= 3 ? [0.72] : d >= 2 ? [-0.72, 0.24, 0.72] : [-0.72, -0.24, 0.24, 0.72];
    m.group(() => { for (const y of posts) m.cylinder([1.0, y, 0.14], [1.0, y, 1.0], 0.035, sk.trim, 0.035, { segs: 5 }); });
    const ya = d >= 3 ? 0.2 : d >= 2 ? -0.3 : -0.8;
    m.poly([[x1 + 0.1, ya, 1.16], [1.08, ya, 1.0], [1.08, 0.8, 1.0], [x1 + 0.1, 0.8, 1.16]], P.team);
    m.decal(0.012, () => m.group(() => { for (let y = -0.8 + 0.2; y < 0.8; y += 0.4) if (y >= ya) m.poly([[x1 + 0.1, y, 1.163], [1.08, y, 1.003], [1.08, Math.min(0.8, y + 0.2), 1.003], [x1 + 0.1, Math.min(0.8, y + 0.2), 1.163]], S.canvas); }));
    if (d >= 2 && d < 4) m.with(() => { m.move(0.95, -0.6, 0.2).rotZ(30).rotY(70); m.box([0, 0, 0], [0.7, 0.4, 0.03], P.team); });
    // ---- the water tower out back: straight, then leaning, then down
    const lean = [0, 7, 20][d] ?? 0;
    if (d <= 2) m.with(() => {
      m.move(-0.72, 0.62, 0.14).rotY(-lean).rotX(lean * 0.5);
      m.group(() => { for (const [x, y] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) m.cylinder([x * 0.24, y * 0.24, 0], [x * 0.2, y * 0.2, 1.0], 0.035, sk.trim, 0.03, { segs: 4 }); });
      m.cylinder([0, 0, 0.95], [0, 0, 1.45], 0.3, sk.wall, 0.32, { segs: 10 });
      m.decal(0.012, () => m.cylinder([0, 0, 1.1], [0, 0, 1.3], 0.312, P.team, 0.318, { segs: 10 }));
      for (const z of [1.02, 1.36]) m.cylinder([0, 0, z], [0, 0, z + 0.04], 0.322, S.iron, 0.325, { segs: 10 });
      m.cone([0, 0, 1.45], [0, 0, 1.68], 0.36, sk.roof ?? S.shingleDk, { segs: 10 });
      if (k.boss) m.sphere([0, 0, 1.7], 0.07, GOLD, { segs: 6 });
    });
    else m.with(() => { m.move(-0.5, 0.95, 0.34).rotX(84).rotZ(20); m.cylinder([0, 0, 0], [0, 0, 0.55], 0.3, sk.wall, 0.32, { segs: 10 }); m.cylinder([0, 0, 0.2], [0, 0, 0.24], 0.325, S.iron, 0.325, { segs: 10 }); });
    // ---- the colours
    if (d <= 1) {
      m.cylinder([x1 + 0.05, 0, 0.14 + fh + 0.3], [x1 + 0.05, 0, 2.64], 0.025, S.pineDk, 0.02, { segs: 5 });
      m.sphere([x1 + 0.05, 0, 2.66], 0.045, GOLD, { segs: 6 });
      const fl = d === 1 ? 0.45 : 0.72;
      m.poly([[x1 + 0.05, 0, 2.62], [x1 + 0.05, -fl, 2.58], [x1 + 0.05, -fl * 0.72, 2.43], [x1 + 0.05, -fl, 2.28], [x1 + 0.05, 0, 2.24]], k.boss ? P.black : P.teamFlat);
      if (k.boss) m.decal(0.02, () => m.with(() => { m.move(x1 + 0.06, -0.26, 2.43).rotZ(90); star(m, 0.1, GOLD, 0.01); }));
    }
    if (k.boss && d <= 2) for (const s of [1, -1]) m.with(() => { m.move(x1 + 0.05, s * 0.72, 0.14 + fh + 0.06); m.cone([0, 0, 0], [0, 0, 0.3], 0.09, GOLD, { segs: 6 }); });
    // ---- furniture on the deck
    if (d <= 2) m.with(() => { m.move(0.85, -1.0, 0.14); m.lathe([[0.13, 0], [0.16, 0.12], [0.16, 0.28], [0.13, 0.4], [0, 0.4]], S.pine, { smooth: true, segs: 10 }); m.cylinder([0, 0, 0.1], [0, 0, 0.14], 0.165, S.iron, 0.165, { segs: 10 }); });
    if (d === 1) puff(m, [0.3, 0.5, 1.3], 0.1, 0.4, P.smokeDk, 3);
    if (d >= 3) m.group(() => { for (const [x, y, s, r] of [[0.95, 0.5, 0.5, 20], [1.0, -0.5, 0.42, 50], [0.3, -1.0, 0.5, 10], [-0.95, -0.3, 0.44, 70]]) m.with(() => { m.move(x, y, 0.18).rotZ(r); m.box([0, 0, 0], [s * 1.6, 0.1, 0.05], sk.front); }); });
  },
};

/** What is left: lumber on the deck, the star face down in it. */
function rubble(m: Model, sk: Skin, badge: Material) {
  m.box([-0.2, 0, 0.3], [1.1, 1.3, 0.34], sk.wall);
  m.decal(0.01, () => m.box([-0.2, 0, 0.47], [0.95, 1.15, 0.02], HOLE));
  m.group(() => { for (let i = 0; i < 7; i++) m.cone([-0.72 + i * 0.17, (i % 2 ? 0.62 : -0.62), 0.44], [-0.74 + i * 0.17, (i % 2 ? 0.64 : -0.64), 0.56 + 0.14 * ((i * 3) % 3)], 0.11, sk.wall, { segs: 4 }); });
  const planks: [number, number, number, number, Material][] = [[0.4, 0.2, 1.3, 30, sk.front], [-0.1, -0.2, 1.4, 70, CHAR], [0.85, 0.45, 1.0, 15, sk.front], [0.8, -0.5, 1.1, 55, sk.trim], [-0.8, 0.5, 0.9, 40, CHAR], [0.2, 0.9, 0.9, 80, sk.front], [-0.5, -0.85, 1.0, 25, sk.trim], [0.5, -0.1, 1.2, 110, P.team]];
  m.group(() => { planks.forEach(([x, y, l, r, c], i) => m.with(() => { m.move(x, y, 0.2 + (Math.hypot(x, y) < 0.7 ? 0.36 : 0.02) + i * 0.012).rotZ(r).rotY(8 * ((i % 3) - 1)); m.box([0, 0, 0], [l, 0.12, 0.05], c); })); });
  m.with(() => { m.move(0.75, 0.1, 0.3).rotY(62).rotZ(20); star(m, 0.24, badge, 0.03); });
  m.with(() => { m.move(-0.45, 0.95, 0.34).rotX(84).rotZ(20); m.cylinder([0, 0, 0], [0, 0, 0.5], 0.3, sk.wall, 0.32, { segs: 10 }); });
  m.with(() => { m.move(0.9, -0.75, 0.22).rotY(18); m.box([0, 0, 0], [0.7, 0.4, 0.03], P.team); });
}
