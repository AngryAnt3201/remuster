// Pixelkeep's palette and the chunky parts its cast shares. Sprites are about 30 art pixels tall, so everything
// here is oversized and simple: big heads, fat weapons, flat colours on the five-level console palette.
import { Model, frameAt, mat, norm, team, type Material, type V3 } from "../../../artkit/toon3d";
import { humanoid, type HumanoidOpts, type HumanoidRig, type Pose } from "../../../artkit/rig";

/** Materials: every channel on 00 40 80 bf ff. Team colour goes on tunics, shields, wings, robes and flags. */
export const P = {
  skin: mat("#ffbf80"), skinDk: mat("#bf8040"), ogre: mat("#40bf40"), ogreDk: mat("#008000"),
  white: mat("#ffffff"), cream: mat("#ffffbf"), grey: mat("#bfbfbf"), greyDk: mat("#808080"),
  black: mat("#202028"), dark: mat("#404040"), night: mat("#202060"),
  steel: mat("#bfbfff", { metal: 0.5 }), iron: mat("#8080bf", { metal: 0.35 }), ironDk: mat("#404080", { metal: 0.2 }),
  gold: mat("#ffbf00", { metal: 0.6 }), goldDk: mat("#bf8000"), copper: mat("#ff8040", { metal: 0.4 }),
  wood: mat("#bf8040"), woodDk: mat("#804000"), woodLt: mat("#ffbf80"), leather: mat("#804020"),
  red: mat("#ff4040"), redDk: mat("#bf0000"), orange: mat("#ff8000"), yellow: mat("#ffff40"),
  green: mat("#40bf40"), greenDk: mat("#008000"), leaf: mat("#80ff40"), moss: mat("#408000"),
  purple: mat("#8040bf"), purpleDk: mat("#400080"), pink: mat("#ff80bf"),
  ice: mat("#80ffff"), iceDk: mat("#40bfff"), sea: mat("#00bf80"), seaDk: mat("#008080"),
  bone: mat("#ffffbf"), boneDk: mat("#bfbf80"), straw: mat("#ffbf40"), sack: mat("#bf8040"),
  stone: mat("#bfbfbf"), stoneDk: mat("#808080"), stoneLt: mat("#ffffff"), brick: mat("#bf4040"), brickDk: mat("#802020"),
  horse: mat("#bf8040"), horseDk: mat("#804000"), wolf: mat("#bfbfbf"), wolfDk: mat("#808080"),
  drake: mat("#40bf40"), drakeDk: mat("#008040"), bat: mat("#404080"),
  // light: unlit, never outlined
  fire: mat("#ff8000", { emit: 1, ink: false }), fireHot: mat("#ffff80", { emit: 1, ink: false }),
  lamp: mat("#ffff40", { emit: 1 }), spark: mat("#ffffff", { emit: 1, ink: false }),
  zap: mat("#ffff40", { emit: 1, ink: false }), frost: mat("#ffffff", { emit: 1, ink: false }), frostBlue: mat("#80ffff", { emit: 1, ink: false }),
  ghost: mat("#40ff80", { emit: 1, ink: false }), ghostLamp: mat("#40ff80", { emit: 1 }),
  heal: mat("#80ff40", { emit: 1, ink: false }), water: mat("#40bfff", { emit: 1, ink: false }), foam: mat("#ffffff", { emit: 1, ink: false }),
  smoke: mat("#ffffff", { emit: 1, ink: false }), smokeDk: mat("#808080", { emit: 1, ink: false }),
  slash: mat("#ffffff", { emit: 1, ink: false }),
  // team colour
  team: team("main"), teamDk: team("dark"), teamLt: team("light"),
  /** Team paint on upright faces (shields, doors, flags): barely darkened by shadow. */
  teamFlat: team("main", { shade: 0.25 }),
  /** Max level: a part that burns in the team's light colour. */
  glory: team("light", { emit: 1 }), gloryInk: team("light", { emit: 1, ink: false }),
};

/** Trim by rank: iron, steel, gold, gold. */
export const trim = (tier: number): Material => (tier >= 3 ? P.gold : tier === 2 ? P.steel : P.iron);
/** Blade by rank: steel, steel, steel, team light. */
export const blade = (tier: number): Material => (tier >= 4 ? P.glory : P.steel);

/** The humanoid with Pixelkeep's proportions: a big head on a small body. */
export function guy(m: Model, p: Pose, o: Partial<HumanoidOpts>): HumanoidRig {
  return humanoid(m, p, { skin: P.skin, torso: P.team, legs: P.dark, boots: P.black, head: 0.215, ...o });
}
export const HEAD = 0.215;

/** The rank mark over a head (head frame): 2 a steel stud, 3 a gold crest, 4 a turning gem of team light. */
export function rank(m: Model, p: Pose, z = 0.3) {
  const t = p.tier;
  if (t === 2) m.box([0, 0, z], [0.07, 0.07, 0.07], P.steel);
  else if (t === 3) m.group(() => { m.box([0, 0, z], [0.09, 0.09, 0.08], P.gold); m.box([0, 0, z + 0.08], [0.05, 0.05, 0.08], P.gold); });
  else if (t >= 4) m.with(() => {
    m.move(0, 0, z + 0.12 + 0.015 * Math.sin(p.i * 1.05)).rotZ(p.i * 30);
    m.group(() => { m.cone([0, 0, 0], [0, 0, 0.1], 0.075, P.glory, { segs: 4 }); m.cone([0, 0, 0], [0, 0, -0.1], 0.075, P.glory, { segs: 4 }); });
  });
}

// ------------------------------------------------------------------------------------------------ headgear (head frame, radius r)
/** A knight's helm: a dome with a dark eye slit; `plume` stands a crest on top. */
export function helm(m: Model, r: number, col: Material = P.steel, o: { plume?: Material | null; horns?: Material | null; brim?: boolean | Material; crest?: Material | null } = {}) {
  m.group(() => {
    m.ellipsoid([0, 0, r * 0.12], [r * 1.08, r * 1.08, r * 1.0], col, { segs: 10 });
    if (o.brim === true) m.cylinder([0, 0, r * 0.05], [0, 0, r * 0.18], r * 1.5, col, r * 1.1, { segs: 10 });
  });
  if (o.brim && o.brim !== true) m.cylinder([0, 0, r * 0.05], [0, 0, r * 0.2], r * 1.55, o.brim, r * 1.1, { segs: 10 });
  if (o.crest) m.decal(0.03, () => m.box([-r * 0.1, 0, r * 0.95], [r * 1.7, r * 0.5, r * 0.5], o.crest!));
  m.decal(0.03, () => m.box([r * 0.95, 0, 0], [r * 0.3, r * 1.3, r * 0.32], P.black));
  if (o.plume) m.group(() => { m.box([-r * 0.1, 0, r * 1.25], [r * 1.1, r * 0.3, r * 0.5], o.plume!); m.box([-r * 0.75, 0, r * 0.85], [r * 0.4, r * 0.3, r * 0.6], o.plume!); });
  if (o.horns) for (const s of [1, -1]) m.tube([[0, s * r * 0.9, r * 0.5], [0, s * r * 1.5, r * 0.8], [0, s * r * 1.6, r * 1.5]], [r * 0.3, r * 0.26, r * 0.08], o.horns, { segs: 5 });
}
/** A hood: the head wrapped, the face in shadow. */
export function hood(m: Model, r: number, col: Material, point = 0.5) {
  m.group(() => {
    m.ellipsoid([-r * 0.12, 0, r * 0.1], [r * 1.12, r * 1.14, r * 1.12], col, { segs: 10 });
    if (point) m.cone([-r * 0.5, 0, r * 0.7], [-r * (0.9 + point), 0, r * (1.0 + point)], r * 0.55, col, { segs: 6 });
  });
}
/** A wizard's hat: a wide brim and a tall bent cone. */
export function wizHat(m: Model, r: number, col: Material, band: Material = P.gold, h = 2.2) {
  m.with(() => {
    m.move(0, 0, r * 0.45).rotY(-8);
    m.group(() => {
      m.cylinder([0, 0, 0], [0, 0, r * 0.14], r * 1.75, col, r * 1.7, { segs: 10 });
      m.cone([0, 0, r * 0.1], [-r * 0.5, 0, r * h], r * 0.95, col, { segs: 8 });
    });
    m.cylinder([0, 0, r * 0.14], [0, 0, r * 0.42], r * 0.99, band, r * 0.88, { segs: 8 });
  });
}
/** A headband with trailing tails. */
export function headband(m: Model, r: number, col: Material = P.team) {
  m.decal(0.02, () => m.cylinder([0, 0, r * 0.25], [0, 0, r * 0.6], r * 1.04, col, r * 0.92, { segs: 10 }));
  m.group(() => { for (const s of [1, -1]) m.box([-r * 1.25, s * r * 0.25, r * 0.3], [r * 0.6, r * 0.22, r * 0.22], col); });
}
/** A full beard. */
export function beard(m: Model, r: number, col: Material = P.white, len = 1) {
  m.decal(0.015, () => m.group(() => { m.ellipsoid([r * 0.5, 0, -r * 0.55], [r * 0.62, r * 0.8, r * 0.5 * len], col, { segs: 8 }); m.cone([r * 0.65, 0, -r * 0.8], [r * 0.72, 0, -r * (0.9 + len * 0.7)], r * 0.45, col, { segs: 5 }); }));
}

// ------------------------------------------------------------------------------------------------ clothes
/** A robe from the hips to the ankles. */
export const robe = (m: Model, h: HumanoidRig, col: Material, flare = 0.24, len = 0.2) => m.at(h.hips, () => m.cylinder([0, 0, 0.12], [-0.01, 0, -len], 0.16, col, flare, { segs: 10 }));
/** A short tunic skirt. */
export const tunic = (m: Model, h: HumanoidRig, col: Material = P.team, flare = 0.2) => m.at(h.hips, () => m.cylinder([0, 0, 0.1], [0, 0, -0.05], 0.15, col, flare, { segs: 10 }));
/** A cape down the back. */
export function cape(m: Model, h: HumanoidRig, p: Pose, col: Material = P.team, len = 0.42, w = 0.2) {
  const sw = p.is("walk") ? 0.08 + 0.03 * p.wave(1, 2) : 0.03 + 0.01 * p.wave(1);
  m.at(h.back, () => m.poly([[0.0, -w * 0.6, 0.1], [0.0, w * 0.6, 0.1], [0.06 + sw, w, 0.1 - len], [0.06 + sw, -w, 0.1 - len]], col));
}
/** A belt with a square buckle. */
export function belt(m: Model, h: HumanoidRig, col: Material = P.leather, buckle: Material = P.gold, bulk = 1) {
  m.at(h.hips, () => { m.decal(0.02, () => m.cylinder([0, 0, 0.06], [0, 0, 0.12], 0.16 * bulk, col, 0.16 * bulk, { segs: 10 })); m.decal(0.04, () => m.box([0.15 * bulk, 0, 0.09], [0.03, 0.08, 0.08], buckle)); });
}

// ------------------------------------------------------------------------------------------------ weapons (along +x from the grip)
export function sword(m: Model, len: number, bl: Material = P.steel, guard: Material = P.gold, w = 0.05) {
  m.box([len / 2 + 0.03, 0, 0], [len, 0.025, w], bl);
  m.group(() => { m.box([0.025, 0, 0], [0.04, 0.035, w * 2.6], guard); m.box([-0.04, 0, 0], [0.1, 0.03, 0.035], P.leather); });
}
export function dagger(m: Model, len: number, bl: Material = P.steel) {
  m.box([len / 2 + 0.02, 0, 0], [len, 0.022, 0.045], bl);
  m.box([-0.02, 0, 0], [0.06, 0.03, 0.06], P.black);
}
/** An axe: a shaft with a big crescent head at the far end (blade towards -z when swung down). */
export function axe(m: Model, len: number, head: Material = P.steel, size = 0.2, double = false) {
  m.cylinder([-0.12, 0, 0], [len, 0, 0], 0.022, P.wood, 0.022, { segs: 5 });
  m.extrude([[len - size * 0.55, 0], [len - size * 0.9, -size], [len + size * 0.35, -size], [len + size * 0.05, 0]], 0.03, head);
  if (double) m.extrude([[len - size * 0.55, 0], [len - size * 0.9, size], [len + size * 0.35, size], [len + size * 0.05, 0]], 0.03, head);
}
/** A hammer: a shaft and a block head. */
export function hammer(m: Model, len: number, head: Material = P.iron, size = 0.11) {
  m.cylinder([-0.1, 0, 0], [len, 0, 0], 0.022, P.wood, 0.022, { segs: 5 });
  m.box([len, 0, 0], [size, size * 0.9, size * 1.9], head);
}
/** A spear or pike: a long shaft and a leaf point. */
export function spear(m: Model, back: number, front: number, tip: Material = P.steel, r = 0.018) {
  m.cylinder([-back, 0, 0], [front, 0, 0], r, P.wood, r, { segs: 5 });
  m.cone([front, 0, 0], [front + 0.16, 0, 0], 0.045, tip, { segs: 4 });
}
/** A staff standing along +z from the hand: a shaft from -down to +up. Draw the head yourself at [0, 0, up]. */
export function staff(m: Model, down: number, up: number, col: Material = P.wood, r = 0.022) {
  m.cylinder([0, 0, -down], [0, 0, up], r, col, r, { segs: 5 });
}
/** A bow held upright in the hand that grips it: the stave curves forward (+x), the string runs behind. */
export function bow(m: Model, size: number, pull: number, col: Material = P.wood, arrow: Material | null = P.cream) {
  m.tube([[-0.02, 0, -size], [0.09, 0, -size * 0.55], [0.13, 0, 0], [0.09, 0, size * 0.55], [-0.02, 0, size]], 0.022, col, { segs: 5 });
  m.tube([[-0.02, 0, -size], [-0.02 - pull, 0, 0], [-0.02, 0, size]], 0.007, P.white, { segs: 3 });
  if (arrow) m.group(() => { m.cylinder([-0.02 - pull, 0, 0], [0.26 - pull, 0, 0], 0.012, arrow, 0.012, { segs: 4 }); m.cone([0.26 - pull, 0, 0], [0.34 - pull, 0, 0], 0.03, P.steel, { segs: 4 }); });
}
/** A round black bomb with a fuse (centre at the origin). */
export function bomb(m: Model, r: number, lit: Material | null = P.fire, shell: Material = P.black) {
  m.sphere([0, 0, 0], r, shell, { segs: 10 });
  m.decal(0.03, () => m.box([r * 0.35, -r * 0.35, r * 0.45], [r * 0.3, r * 0.3, r * 0.3], P.white));
  m.cylinder([0, 0, r * 0.9], [0, 0, r * 1.25], r * 0.28, P.greyDk, r * 0.28, { segs: 5 });
  if (lit) m.group(() => { m.box([0, 0, r * 1.5], [r * 0.5, r * 0.5, r * 0.5], lit); m.box([0, 0, r * 1.85], [r * 0.25, r * 0.25, r * 0.3], P.fireHot); });
}
/** A kite shield facing +x (centre at the origin): steel rim, team face, an emblem block. */
export function shield(m: Model, w: number, h: number, rim: Material = P.steel, face: Material = P.teamFlat, boss: Material = P.gold) {
  m.box([0, 0, 0], [0.05, w, h], rim);
  m.decal(0.01, () => { m.box([0.03, 0, 0], [0.012, w - 0.07, h - 0.07], face); m.box([-0.03, 0, 0], [0.012, w - 0.07, h - 0.07], face); });
  m.decal(0.02, () => m.box([0.04, 0, 0], [0.012, w * 0.3, h * 0.3], boss));
}

// ------------------------------------------------------------------------------------------------ effects
/** A chunky slash: an arc of white blocks about body point c, radius r, from a0 to a1 degrees (0 ahead, 90 right). */
export function slashArc(m: Model, h: HumanoidRig, c: V3, r: number, a0: number, a1: number, dz = 0, col: Material = P.slash) {
  const pts: V3[] = [], rad: number[] = [], n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    pts.push(h.pt([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + dz * (t - 0.5)]));
    rad.push(0.012 + 0.045 * Math.sin(Math.PI * t) * h.size);
  }
  m.tube(pts, rad, col, { segs: 4 });
}
/** A blocky burst: a hot square with four arms (a muzzle flash, an impact, a spark). */
export function flash(m: Model, at: V3, size: number, col: Material = P.fire, hot: Material = P.fireHot) {
  m.with(() => {
    m.move(at[0], at[1], at[2]);
    m.group(() => {
      m.box([size * 0.6, 0, 0], [size * 2.2, size * 0.7, size * 0.7], col);
      m.box([size * 0.2, 0, 0], [size * 0.7, size * 2.2, size * 0.7], col);
      m.box([size * 0.2, 0, 0], [size * 0.7, size * 0.7, size * 2.2], col);
    });
    m.decal(0.06, () => m.box([size * 0.3, 0, 0], [size, size, size], hot));
  });
}
/** A puff of smoke or dust: three blocks that spread as k goes 0..1. */
export function puff(m: Model, at: V3, size: number, k = 0, col: Material = P.smoke, seed = 1) {
  m.group(() => {
    for (let i = 0; i < 3; i++) {
      const a = seed * 2.4 + i * 2.1, s = size * (0.9 - 0.2 * i) * (1 - 0.35 * k);
      m.box([at[0] + Math.cos(a) * size * 0.5 * (0.5 + k), at[1] + Math.sin(a) * size * 0.5 * (0.5 + k), at[2] + i * size * 0.4 * (0.4 + k)], [s, s, s], col);
    }
  });
}
/** A zigzag bolt from a to b. */
export function zigzag(m: Model, a: V3, b: V3, amp: number, col: Material = P.zap, r = 0.022, n = 5) {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, s = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * amp; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + s * 0.5, a[2] + (b[2] - a[2]) * t + s]); }
  m.tube(pts, r, col, { segs: 4 });
}
/** A four-point sparkle. */
export function sparkle(m: Model, at: V3, s: number, col: Material = P.spark) {
  m.group(() => { m.box(at, [s * 3, s, s], col); m.box(at, [s, s * 3, s], col); m.box(at, [s, s, s * 3], col); });
}
/** A pixel heart standing in the x-z plane (thin along y... seen from the side), centred on `at`. */
export function heart(m: Model, at: V3, s: number, col: Material = P.heal) {
  m.with(() => { m.move(at[0], at[1], at[2]); m.group(() => { m.box([0, 0, 0], [s, s * 2.6, s * 1.6], col); m.box([0, s * 0.75, s * 0.9], [s, s * 1.1, s], col); m.box([0, -s * 0.75, s * 0.9], [s, s * 1.1, s], col); m.box([0, 0, -s * 1.1], [s, s * 1.3, s], col); }); });
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
/** A frame at a point whose +x runs along a direction (for staffs held upright: pass [0, 0, 1] and draw along x). */
export const along = (at: V3, dir: V3) => frameAt(at, dir);
export const UP: V3 = [0, 0, 1];
