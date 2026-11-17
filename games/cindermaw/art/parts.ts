// Cindermaw's materials and the parts its cast shares. Bodies are neutral (gunmetal, khaki, ash hide, bone, char)
// so that the only saturated green or red on a figure is its side: visor, shoulder plates, helmet stripe, wings,
// eyes. Proportions are real (small heads), there is no ink, and every effect is an unlit hot shape.
import { Model, mat, norm, team, type Material, type V3 } from "../../../artkit/toon3d";
import { humanoid, type HumanoidOpts, type HumanoidRig, type Pose } from "../../../artkit/rig";

export const P = {
  // marines and machines
  armor: mat("#7a7466", { metal: 0.25 }), armorDk: mat("#3c3a34", { metal: 0.15 }), fatigue: mat("#4a4438"), khaki: mat("#8f7a5c"),
  iron: mat("#6e757c", { metal: 0.5 }), ironDk: mat("#32363a", { metal: 0.35 }), steel: mat("#b4bcc2", { metal: 0.75 }), brass: mat("#c89038", { metal: 0.65 }),
  black: mat("#14110e"), rubber: mat("#24201c"), rust: mat("#7a4420", { metal: 0.2 }), hazard: mat("#e0b020"), white: mat("#e6dec8"), whiteDk: mat("#a89e88"),
  coat: mat("#2c2a30"), cloth: mat("#4a3830"), leather: mat("#5a3a22"), tankRed: mat("#8a2a14", { metal: 0.3 }),
  // hellspawn
  hide: mat("#86705e"), hideDk: mat("#4a3a30"), hideLt: mat("#b09a80"), char: mat("#2a2420"), charLt: mat("#4a403a"), pale: mat("#c8b8a0"),
  bone: mat("#e0d2ac"), boneDk: mat("#927c58"), gut: mat("#6a4a5a"), fungus: mat("#7a3a7a"), fungusLt: mat("#c8b060"), tooth: mat("#f0e8d0"),
  ice: mat("#9adcf0", { metal: 0.4 }), iceDk: mat("#3a86ac", { metal: 0.3 }),
  // light: unlit
  fire: mat("#ff7a1c", { emit: 1, ink: false }), fireHot: mat("#ffe070", { emit: 1, ink: false }), fireRed: mat("#e03a10", { emit: 1, ink: false }),
  spark: mat("#ffffff", { emit: 1, ink: false }), zap: mat("#bfe8ff", { emit: 1, ink: false }), frost: mat("#e8fbff", { emit: 1, ink: false }),
  ghost: mat("#6affc0", { emit: 1, ink: false }), heal: mat("#6affb0", { emit: 1, ink: false }), lamp: mat("#ffe070", { emit: 1 }),
  spore: mat("#d8c040", { emit: 1, ink: false, alpha: 0.85 }), smoke: mat("#8a8078", { emit: 1, ink: false, alpha: 0.8 }), smokeDk: mat("#3a3430", { emit: 1, ink: false, alpha: 0.85 }),
  redLamp: mat("#ff3a20", { emit: 1 }), off: mat("#3a0c08"),
  // the side
  team: team("main"), teamDk: team("dark"), teamLt: team("light"),
  /** Team paint on upright faces (shields, banners, plates): barely darkened by shadow. */
  teamFlat: team("main", { shade: 0.25 }),
  /** A surface that burns in the side's colour: visors, eyes. */
  visor: team("main", { emit: 1 }),
  /** Hellforged: burns in the side's light colour. */
  glory: team("light", { emit: 1 }), gloryInk: team("light", { emit: 1, ink: false }),
};
export const R = 0.135;
export const UP: V3 = [0, 0, 1];

/** Trim by rank: iron, steel, brass, brass. */
export const trim = (tier: number): Material => (tier >= 3 ? P.brass : tier === 2 ? P.steel : P.iron);
/** Blade by rank: steel until Hellforged, then the side's light. */
export const blade = (tier: number, base: Material = P.steel): Material => (tier >= 4 ? P.glory : base);

/** A marine: gunmetal and khaki plate over fatigues. The builder adds helmet, pads and kit. */
export function trooper(m: Model, p: Pose, o: Partial<HumanoidOpts>): HumanoidRig {
  return humanoid(m, p, { skin: P.armorDk, torso: P.armor, arms: P.fatigue, legs: P.fatigue, boots: P.black, hands: P.black, head: R, noFace: true, ...o });
}
/** A hellspawn body: ash hide, bare. */
export function fiend(m: Model, p: Pose, o: Partial<HumanoidOpts>): HumanoidRig {
  return humanoid(m, p, { skin: P.hide, torso: P.hide, arms: P.hide, legs: P.hideDk, boots: P.hideDk, hands: P.hideDk, head: R, noFace: true, ...o });
}

/** The rank mark over a head (head frame): 2 a steel spike, 3 a brass double spike, 4 a flame of the side's light. */
export function rank(m: Model, p: Pose, z = R * 1.3) {
  const t = p.tier;
  if (t === 2) m.cone([0, 0, z - 0.02], [0, 0, z + 0.1], 0.035, P.steel, { segs: 4 });
  else if (t === 3) for (const s of [1, -1]) m.cone([0, s * 0.045, z - 0.02], [0, s * 0.07, z + 0.12], 0.035, P.brass, { segs: 4 });
  else if (t >= 4) m.group(() => {
    const k = 1 + 0.25 * Math.sin(p.i * 2.1);
    m.cone([0, 0, z], [-0.03, 0, z + 0.2 * k], 0.07, P.gloryInk, { segs: 5 });
    for (const s of [1, -1]) m.cone([0, s * 0.06, z], [-0.02, s * 0.1, z + 0.11 * k], 0.04, P.gloryInk, { segs: 4 });
  });
}

// ------------------------------------------------------------------------------------------------ heads (head frame)
/** A combat helmet: a shell, a visor band burning in the side's colour, and a broad side-colour stripe over the top. */
export function helmet(m: Model, r: number, shell: Material = P.armor, o: { visor?: Material | null; stripe?: Material | null; brim?: boolean; lamp?: boolean; fin?: Material | null } = {}) {
  m.group(() => {
    m.ellipsoid([-r * 0.05, 0, r * 0.1], [r * 1.16, r * 1.1, r * 1.05], shell, { segs: 10 });
    if (o.brim) m.cylinder([0, 0, r * 0.02], [0, 0, r * 0.16], r * 1.55, shell, r * 1.2, { segs: 10 });
  });
  if (o.visor !== null) m.decal(0.03, () => m.box([r * 0.95, 0, -r * 0.05], [r * 0.34, r * 1.5, r * 0.42], o.visor ?? P.visor));
  if (o.stripe !== null) m.decal(0.03, () => m.box([-r * 0.1, 0, r * 1.02], [r * 1.9, r * 0.75, r * 0.24], o.stripe ?? P.team));
  if (o.fin) m.extrude([[-r * 1.1, r * 0.9], [r * 0.6, r * 1.05], [r * 0.2, r * 1.8], [-r * 1.3, r * 1.6]], r * 0.22, o.fin);
  if (o.lamp) m.decal(0.05, () => m.box([r * 0.95, 0, r * 0.7], [r * 0.3, r * 0.5, r * 0.4], P.lamp));
}
/** A bare skull: cranium, jaw, two burning sockets. */
export function skull(m: Model, r: number, eye: Material = P.visor, bone: Material = P.bone) {
  m.group(() => {
    m.ellipsoid([-r * 0.08, 0, r * 0.15], [r * 1.1, r * 1.0, r * 1.0], bone, { segs: 10 });
    m.box([r * 0.45, 0, -r * 0.7], [r * 0.8, r * 1.1, r * 0.6], bone);
  });
  m.decal(0.04, () => { for (const s of [1, -1]) m.box([r * 0.95, s * r * 0.42, r * 0.1], [r * 0.3, r * 0.5, r * 0.46], eye); });
  m.decal(0.05, () => m.box([r * 0.9, 0, -r * 0.75], [r * 0.2, r * 0.9, r * 0.16], P.black));
}
/** Two horns sweeping up and out (and back by `back`). */
export function horns(m: Model, r: number, col: Material = P.bone, len = 1, back = 0.3, w = 0.3) {
  for (const s of [1, -1]) m.tube([[0, s * r * 0.8, r * 0.5], [-r * back * 0.5, s * r * (1.3 + 0.3 * len), r * (0.8 + 0.3 * len)], [-r * back * len, s * r * (1.3 + 0.5 * len), r * (1.0 + 1.3 * len)]], [r * w, r * w * 0.8, r * 0.05], col, { segs: 5 });
}
/** A hellspawn's face on its own head: a heavy brow and two burning eyes. */
export function eyes(m: Model, r: number, eye: Material = P.visor, brow: Material | null = P.hideDk) {
  if (brow) m.decal(0.02, () => m.box([r * 0.82, 0, r * 0.38], [r * 0.4, r * 1.6, r * 0.3], brow));
  m.decal(0.05, () => { for (const s of [1, -1]) m.box([r * 0.97, s * r * 0.42, r * 0.08], [r * 0.24, r * 0.44, r * 0.3], eye); });
}

// ------------------------------------------------------------------------------------------------ kit (on the rig)
/** Shoulder plates in the side's colour: the biggest thing the camera sees of a marine. */
export function pads(m: Model, h: HumanoidRig, col: Material = P.team, k = 1, bulk = 1) {
  m.at(h.chest, () => { for (const s of [1, -1]) m.with(() => { m.move(0, s * 0.22 * bulk, 0.17).rotX(s * 24); m.box([0, 0, 0], [0.17 * k, 0.15 * k, 0.06 * k], col); }); });
}
/** A backpack with a side-colour lid. */
export function pack(m: Model, h: HumanoidRig, col: Material = P.armorDk, lid: Material | null = P.team, s = 1) {
  m.at(h.back, () => { m.box([0.07 * s, 0, 0.0], [0.13 * s, 0.26 * s, 0.3 * s], col); if (lid) m.box([0.07 * s, 0, 0.17 * s], [0.15 * s, 0.28 * s, 0.06 * s], lid); });
}
/** Upright tanks on the back. */
export function tanks(m: Model, h: HumanoidRig, col: Material, n = 2, cap: Material = P.iron, r = 0.075) {
  m.at(h.back, () => { for (let i = 0; i < n; i++) { const y = (i - (n - 1) / 2) * r * 2.1; m.cylinder([0.09, y, -0.16], [0.09, y, 0.2], r, col, r, { segs: 8 }); m.sphere([0.09, y, 0.2], r, cap, { segs: 6 }); } });
}
/** A cape or coat tail down the back. */
export function cape(m: Model, h: HumanoidRig, p: Pose, col: Material = P.teamFlat, len = 0.46, w = 0.2) {
  const sw = p.is("walk") ? 0.1 + 0.04 * p.wave(1, 2) : 0.04 + 0.012 * p.wave(1);
  m.at(h.back, () => m.poly([[0.0, -w * 0.7, 0.14], [0.0, w * 0.7, 0.14], [0.07 + sw, w, 0.12 - len], [0.07 + sw, -w, 0.12 - len]], col));
}
/** A robe from the hips to the ankles. */
export const robe = (m: Model, h: HumanoidRig, col: Material, flare = 0.24, len = 0.22) => m.at(h.hips, () => m.cylinder([0, 0, 0.12], [-0.01, 0, -len], 0.15, col, flare, { segs: 10 }));

// ------------------------------------------------------------------------------------------------ weapons (along +x from the grip)
/** A long gun: receiver, barrel, stock, magazine. */
export function gun(m: Model, len: number, o: { body?: Material; barrel?: Material; fat?: number; mag?: boolean; stock?: boolean } = {}) {
  const f = o.fat ?? 1;
  m.group(() => {
    m.box([0.1, 0, 0], [0.3, 0.05 * f, 0.075 * f], o.body ?? P.ironDk);
    if (o.stock !== false) m.box([-0.11, 0, -0.02], [0.16, 0.04, 0.07], o.body ?? P.ironDk);
    if (o.mag !== false) m.box([0.1, 0, -0.07], [0.06, 0.035, 0.1], P.black);
  });
  m.cylinder([0.22, 0, 0.01], [len, 0, 0.01], 0.02 * f, o.barrel ?? P.iron, 0.02 * f, { segs: 5 });
}
/** A heavy cleaver: a haft and a slab blade (edge towards -z). */
export function cleaver(m: Model, len: number, bl: Material = P.iron, size = 0.2) {
  m.cylinder([-0.12, 0, 0], [len * 0.5, 0, 0], 0.025, P.boneDk, 0.025, { segs: 5 });
  m.extrude([[len * 0.4, 0.03], [len, 0.04], [len + size * 0.2, -size * 0.5], [len - size * 0.1, -size], [len * 0.45, -size * 0.85]], 0.03, bl);
}
/** A long curved bone blade. */
export function boneBlade(m: Model, len: number, col: Material = P.bone) {
  m.extrude([[0, 0.025], [len * 0.6, 0.05], [len, 0.14], [len * 0.7, -0.01], [0, -0.025]], 0.022, col);
}
/** A straight sword. */
export function sword(m: Model, len: number, bl: Material = P.steel, guard: Material = P.iron, w = 0.05) {
  m.box([len / 2 + 0.03, 0, 0], [len, 0.022, w], bl);
  m.group(() => { m.box([0.025, 0, 0], [0.04, 0.035, w * 2.8], guard); m.box([-0.05, 0, 0], [0.12, 0.03, 0.035], P.black); });
}
/** A pike: a long shaft, a barbed head. */
export function pike(m: Model, back: number, front: number, tip: Material = P.steel, r = 0.016, shaft: Material = P.ironDk) {
  m.cylinder([-back, 0, 0], [front, 0, 0], r, shaft, r, { segs: 5 });
  m.cone([front, 0, 0], [front + 0.2, 0, 0], 0.04, tip, { segs: 4 });
  for (const s of [1, -1]) m.cone([front + 0.02, 0, s * 0.02], [front - 0.08, 0, s * 0.08], 0.022, tip, { segs: 4 });
}
/** A staff standing along +z from the hand. */
export function staff(m: Model, down: number, up: number, col: Material = P.boneDk, r = 0.02) {
  m.cylinder([0, 0, -down], [0, 0, up], r, col, r, { segs: 5 });
}
/** A slab shield facing +x (centre at the origin): iron frame, side-colour face, a hazard chevron and a view slit. */
export function slab(m: Model, w: number, h: number, rim: Material = P.iron, face: Material = P.teamFlat, mark: Material = P.hazard) {
  m.box([0, 0, 0], [0.06, w, h], rim);
  m.decal(0.01, () => { m.box([0.035, 0, 0], [0.012, w - 0.08, h - 0.08], face); m.box([-0.035, 0, 0], [0.012, w - 0.08, h - 0.08], face); });
  m.decal(0.02, () => { m.box([0.042, 0, h * 0.3], [0.012, w * 0.5, h * 0.09], P.black); m.box([0.042, 0, -h * 0.34], [0.012, w - 0.08, h * 0.1], mark); });
}

// ------------------------------------------------------------------------------------------------ effects
/** A muzzle flash or burst at a point, opening along +x. */
export function flash(m: Model, at: V3, size: number, col: Material = P.fire, hot: Material = P.fireHot) {
  m.with(() => {
    m.move(at[0], at[1], at[2]);
    m.group(() => {
      m.cone([0, 0, 0], [size * 3, 0, 0], size * 0.8, col, { segs: 6 });
      for (const [y, z] of [[1, 0.6], [-1, 0.6], [0.7, -0.9], [-0.7, -0.9]]) m.cone([0, 0, 0], [size * 1.3, y * size * 1.3, z * size * 1.3], size * 0.45, col, { segs: 4 });
    });
    m.decal(0.06, () => m.sphere([size * 0.5, 0, 0], size * 0.6, hot, { segs: 6 }));
  });
}
/** A blast: a hot ball in a ragged ring. */
export function burst(m: Model, at: V3, size: number, col: Material = P.fire, hot: Material = P.fireHot, n = 7) {
  m.group(() => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.3; m.cone([at[0], at[1], at[2]], [at[0] + Math.cos(a) * size * 1.9, at[1] + Math.sin(a) * size * 1.9, at[2] + size * (0.4 + 0.5 * (i % 2))], size * 0.55, col, { segs: 4 }); } });
  m.decal(0.05, () => m.sphere(at, size * 0.85, hot, { segs: 8 }));
}
/** A slash: an arc about body point c, radius r, from a0 to a1 degrees (0 ahead, 90 right). */
export function slashArc(m: Model, h: HumanoidRig, c: V3, r: number, a0: number, a1: number, dz = 0, col: Material = P.spark) {
  const pts: V3[] = [], rad: number[] = [], n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    pts.push(h.pt([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + dz * (t - 0.5)]));
    rad.push(0.008 + 0.04 * Math.sin(Math.PI * t) * h.size);
  }
  m.tube(pts, rad, col, { segs: 4 });
}
/** Smoke or dust: three balls that spread as k goes 0..1. */
export function puff(m: Model, at: V3, size: number, k = 0, col: Material = P.smoke, seed = 1) {
  m.group(() => {
    for (let i = 0; i < 3; i++) {
      const a = seed * 2.4 + i * 2.1, s = size * (0.6 - 0.12 * i) * (1 - 0.3 * k);
      m.sphere([at[0] + Math.cos(a) * size * 0.5 * (0.5 + k), at[1] + Math.sin(a) * size * 0.5 * (0.5 + k), at[2] + i * size * 0.4 * (0.4 + k)], s, col, { segs: 6 });
    }
  });
}
/** A forked bolt from a to b. */
export function zigzag(m: Model, a: V3, b: V3, amp: number, col: Material = P.zap, r = 0.018, n = 6) {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, s = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * amp; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + s * 0.6, a[2] + (b[2] - a[2]) * t + s]); }
  m.tube(pts, r, col, { segs: 4 });
}
/** A cross of light (a spark, a glint, a heal mark when `plus`). */
export function glint(m: Model, at: V3, s: number, col: Material = P.spark) {
  m.group(() => { m.box(at, [s * 3.2, s, s], col); m.box(at, [s, s * 3.2, s], col); m.box(at, [s, s, s * 3.2], col); });
}

// ------------------------------------------------------------------------------------------------ poses
/** A long gun held across the body: rear (right) hand and fore (left) hand; hang the gun on gripAim(h.pR, h.pL). */
export function gunHands(p: Pose, lift = 0): { R: V3; L: V3 } {
  return {
    R: p.mix<V3>([0.06, 0.13, 0.34 + lift], [0.04, 0.1, 0.46 + lift], { wind: [0.02, 0.12, 0.44 + lift], cast: [0.06, 0.13, 0.34 + lift] }),
    L: p.mix<V3>([0.26, -0.05, 0.4 + lift], [0.3, 0, 0.48 + lift], { wind: [0.22, -0.02, 0.5 + lift], cast: [0.26, -0.05, 0.4 + lift] }),
  };
}
/** Overhead chop with the right hand: where the hand is and where the weapon points. */
export function chop(p: Pose): { hand: V3; aim: V3 } {
  return {
    hand: p.mix<V3>([0.14, 0.22, 0.38], [0.32, 0.08, 0.3], { wind: [-0.04, 0.24, 0.7] }),
    aim: norm(p.mix<V3>([0.45, 0.1, 1], [1, -0.25, -0.3], { wind: [-0.5, 0.15, 1] })),
  };
}
/** Straight thrust with the right hand. */
export function thrust(p: Pose, reach = 0.34): { hand: V3; aim: V3 } {
  return {
    hand: p.mix<V3>([0.12, 0.22, 0.38], [reach, 0.1, 0.42], { wind: [-0.08, 0.22, 0.44] }),
    aim: norm(p.mix<V3>([1, 0, 0.35], [1, -0.05, 0], { wind: [1, 0.05, 0.12] })),
  };
}
/** A hand holding a pole upright: rest, a jab on the blow, raised on a cast. */
export const poleHand = (p: Pose): V3 => p.mix<V3>([0.2, 0.2, 0.42], [0.32, 0.14, 0.52], { wind: [0.06, 0.24, 0.6], cast: [0.16, 0.2, 0.72], castWind: [0.1, 0.22, 0.4] });
export const offHand = (p: Pose): V3 => p.mix<V3>([0.12, -0.2, 0.36], [0.3, -0.12, 0.5], { wind: [0.0, -0.24, 0.4], cast: [0.14, -0.22, 0.68], castWind: [0.1, -0.2, 0.36] });
