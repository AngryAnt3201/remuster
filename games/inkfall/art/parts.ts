// Inkfall's materials and the parts its cast shares. A figure is three kinds of mark: solid ink (armour, hair, hats:
// the dark silhouette), pale wash (cloth, skin, wood) and one flat area of the side's colour.
import { Model, frameAt, mat, norm, team, type Material, type V3 } from "../../../artkit/toon3d";
import { humanoid, type HumanoidOpts, type HumanoidRig, type Pose } from "../../../artkit/rig";

const INKHEX = "#1d1a17";
/** A wash of ink: 0 is the faintest grey the paper look gives, 1 is solid black. */
const ink = (k: number, o: Partial<Material> = {}) => mat(INKHEX, { emit: k, ...o });

export const P = {
  // ---- ink, from solid to faint
  ink: ink(1), inkDk: ink(0.82), inkMid: ink(0.5), wash: ink(0.22), washLt: ink(0),
  // ---- paper and cloth
  white: mat("#fffaf0", { emit: 1 }), paper: mat("#f4ecd8", { emit: 0.8 }), cloth: mat("#cfc6b2", { emit: 0.7 }), clothDk: mat("#8f887a", { emit: 0.8 }),
  skin: mat("#ecd2ac", { emit: 0.85 }), skinDk: mat("#c9a57a", { emit: 0.8 }), oni: mat("#8c8478", { emit: 0.9 }),
  // ---- tea-stain washes: straw, wood, rope, clay
  straw: mat("#d9bf82", { emit: 0.85 }), strawDk: mat("#b0945a", { emit: 0.85 }), wood: mat("#a38a66", { emit: 0.8 }), woodDk: mat("#6e5c44", { emit: 0.9 }),
  clay: mat("#9a7a5c", { emit: 0.85 }), rope: mat("#e3d3a4", { emit: 0.9 }), bone: mat("#efe7d2", { emit: 0.9 }),
  stone: mat("#a8a398", { emit: 0.85 }), stoneDk: mat("#6c675f", { emit: 0.9 }), moss: mat("#8a9a78", { emit: 0.8 }),
  steel: mat("#d6d6d0", { emit: 0.9 }), bronze: mat("#8f7a52", { emit: 0.9 }),
  green: mat("#6f9468", { emit: 0.9 }), greenDk: mat("#3f6247", { emit: 0.95 }), horse: mat("#5a534a", { emit: 0.9 }), horseLt: mat("#b3ab9c", { emit: 0.85 }),
  // ---- the side's colour: always flat
  team: team("main", { emit: 1 }), teamDk: team("dark", { emit: 1 }), teamLt: team("light", { emit: 1 }),
  /** Master rank: a part in the side's light colour, never outlined. */
  glory: team("light", { emit: 1, ink: false }),
  // ---- marks that are not things: never outlined
  slash: ink(1, { ink: false }), splat: ink(0.9, { ink: false }), mist: mat("#8f8a80", { emit: 0.8, ink: false, alpha: 0.55 }),
  spark: mat("#fffaf0", { emit: 1, ink: false }), flame: mat("#e2482b", { emit: 1, ink: false }), ember: mat("#f0a23c", { emit: 1, ink: false }),
  lampLit: mat("#f6d98a", { emit: 1 }), ghost: mat("#7fd0a0", { emit: 1, ink: false }), ghostLamp: mat("#7fd0a0", { emit: 1 }),
  heal: mat("#7fb890", { emit: 1, ink: false }), frost: mat("#bfe0e6", { emit: 1, ink: false }), frostDk: mat("#7fb2c2", { emit: 1, ink: false }),
  water: mat("#5f8fa6", { emit: 1, ink: false }), foam: mat("#fffaf0", { emit: 1, ink: false }), zap: mat("#1d1a17", { emit: 1, ink: false }),
  petal: mat("#f2b8ae", { emit: 1, ink: false }),
};

export const HEAD = 0.2;
/** The humanoid with Inkfall's defaults: pale skin and cloth, ink-black legs. */
export function guy(m: Model, p: Pose, o: Partial<HumanoidOpts>): HumanoidRig {
  return humanoid(m, p, { skin: P.skin, torso: P.cloth, legs: P.inkDk, boots: P.ink, head: HEAD, ...o });
}
/** Trim by rank: ink, steel, bronze, bronze. */
export const trim = (tier: number): Material => (tier >= 3 ? P.bronze : tier === 2 ? P.steel : P.inkMid);
/** Blade by rank: steel, then the side's light colour at master rank. */
export const blade = (tier: number): Material => (tier >= 4 ? P.teamLt : P.steel);

/** The rank mark: 2 a small paper tag on the back, 3 two, 4 a halo ring of the side's light colour over the head. */
export function rank(m: Model, h: HumanoidRig, p: Pose, z = 0.34) {
  const t = p.tier;
  if (t >= 2) m.at(h.back, () => m.decal(0.02, () => { for (let i = 0; i < Math.min(2, t - 1); i++) m.box([0.03, (i - (t >= 3 ? 0.5 : 0)) * 0.1, 0.02], [0.02, 0.07, 0.16], P.white); }));
  if (t >= 4) m.at(h.head, () => m.torus([0, 0, z + 0.02 * Math.sin(p.i * 1.05)], [0, 0, 1], 0.2, 0.022, P.glory));
}

// ------------------------------------------------------------------------------------------------ headgear (head frame, radius r)
/** A conical straw hat: the widest, flattest silhouette in the cast. */
export function strawHat(m: Model, r: number, col: Material = P.straw, w = 1.9, h = 0.85, band: Material | null = null) {
  m.group(() => m.cone([0, 0, r * 0.35], [0, 0, r * (0.35 + h)], r * w, col, { segs: 14 }));
  if (band) m.decal(0.02, () => m.cylinder([0, 0, r * 0.36], [0, 0, r * 0.52], r * w * 1.0, band, r * w * 0.82, { segs: 14 }));
}
/** A deep basket hat that hides the whole head. */
export function basketHat(m: Model, r: number, col: Material = P.straw) {
  m.group(() => { m.cylinder([0, 0, -r * 0.7], [0, 0, r * 0.9], r * 1.2, col, r * 1.05, { segs: 12 }); m.ellipsoid([0, 0, r * 0.9], [r * 1.05, r * 1.05, r * 0.4], col, { segs: 12 }); });
  m.decal(0.03, () => m.box([r * 1.1, 0, r * 0.1], [r * 0.2, r * 1.2, r * 0.22], P.ink));
}
/** Black hair with a topknot. */
export function topknot(m: Model, r: number, col: Material = P.ink) {
  m.group(() => { m.ellipsoid([-r * 0.18, 0, r * 0.22], [r * 1.04, r * 1.06, r * 0.95], col, { segs: 10 }); m.capsule([-r * 0.3, 0, r * 1.0], [-r * 0.5, 0, r * 1.5], r * 0.2, col, r * 0.26, { segs: 6 }); });
}
/** Long black hair down the back. */
export function longHair(m: Model, r: number, col: Material = P.ink, len = 2.2) {
  m.group(() => { m.ellipsoid([-r * 0.2, 0, r * 0.2], [r * 1.05, r * 1.08, r * 0.98], col, { segs: 10 }); m.capsule([-r * 0.75, 0, r * 0.1], [-r * 1.0, 0, -r * len], r * 0.5, col, r * 0.22, { segs: 8 }); });
}
/** A headband with trailing tails. */
export function headband(m: Model, r: number, p: Pose, col: Material = P.team) {
  m.decal(0.02, () => m.cylinder([0, 0, r * 0.22], [0, 0, r * 0.6], r * 1.05, col, r * 0.94, { segs: 12 }));
  const w = p.wave(r * 0.3, 1);
  m.group(() => { for (const s of [1, -1]) m.poly([[-r * 0.95, s * r * 0.1, r * 0.45], [-r * 2.1, s * r * 0.5 + w, r * 0.7], [-r * 2.0, s * r * 0.3 + w, r * 0.2]], col); });
}
/** A hood: the head wrapped, the face in shadow. */
export function hood(m: Model, r: number, col: Material, point = 0.4) {
  m.group(() => {
    m.ellipsoid([-r * 0.12, 0, r * 0.1], [r * 1.14, r * 1.16, r * 1.14], col, { segs: 10 });
    if (point) m.cone([-r * 0.5, 0, r * 0.7], [-r * (0.9 + point), 0, r * (1.0 + point)], r * 0.55, col, { segs: 6 });
  });
}
/** A war helmet: a black bowl, a flared neck guard, a crest in front. */
export function helmet(m: Model, r: number, o: { bowl?: Material; crest?: Material | null; horns?: Material | null; guard?: Material } = {}) {
  const bowl = o.bowl ?? P.ink;
  m.group(() => {
    m.ellipsoid([0, 0, r * 0.2], [r * 1.1, r * 1.1, r * 0.95], bowl, { segs: 12 });
    m.cylinder([-r * 0.25, 0, -r * 0.35], [-r * 0.1, 0, r * 0.25], r * 1.75, o.guard ?? bowl, r * 1.1, { segs: 12 });
  });
  if (o.crest) m.decal(0.03, () => m.group(() => { for (const s of [1, -1]) m.tube([[r * 0.85, 0, r * 0.5], [r * 0.9, s * r * 0.7, r * 1.1], [r * 0.75, s * r * 1.15, r * 1.9]], [r * 0.2, r * 0.16, r * 0.04], o.crest!, { segs: 5 }); }));
  if (o.horns) for (const s of [1, -1]) m.tube([[0, s * r * 0.8, r * 0.6], [0, s * r * 1.5, r * 0.9], [0.02, s * r * 1.75, r * 1.7]], [r * 0.28, r * 0.22, r * 0.04], o.horns, { segs: 6 });
}
/** A tall black court hat. */
export function courtHat(m: Model, r: number, col: Material = P.ink, h = 2.1) {
  m.group(() => {
    m.ellipsoid([0, 0, r * 0.3], [r * 1.02, r * 1.02, r * 0.8], col, { segs: 10 });
    m.tube([[-r * 0.1, 0, r * 0.7], [-r * 0.3, 0, r * (0.7 + h * 0.6)], [-r * 0.9, 0, r * (0.7 + h)]], [r * 0.62, r * 0.5, r * 0.3], col, { segs: 6 });
  });
}
/** A fox mask on the front of the head, with two tall ears. */
export function foxMask(m: Model, r: number, col: Material = P.white, mark: Material = P.team) {
  m.decal(0.02, () => m.group(() => {
    m.ellipsoid([r * 0.45, 0, -r * 0.05], [r * 0.75, r * 0.85, r * 0.8], col, { segs: 10 });
    m.cone([r * 0.9, 0, -r * 0.2], [r * 1.5, 0, -r * 0.4], r * 0.38, col, { segs: 6 });
  }));
  for (const s of [1, -1]) m.cone([r * 0.1, s * r * 0.6, r * 0.6], [r * 0.05, s * r * 0.85, r * 1.75], r * 0.38, col, { segs: 5 });
  m.decal(0.05, () => m.group(() => {
    for (const s of [1, -1]) { m.ellipsoid([r * 1.0, s * r * 0.36, r * 0.12], [r * 0.08, r * 0.2, r * 0.07], P.ink, { segs: 6 }); m.box([r * 0.92, s * r * 0.62, -r * 0.25], [r * 0.05, r * 0.22, r * 0.09], mark); }
    m.sphere([r * 1.5, 0, -r * 0.4], r * 0.1, P.ink, { segs: 6 });
  }));
}

// ------------------------------------------------------------------------------------------------ clothes
/** A robe from the hips to the ankles. */
export const robe = (m: Model, h: HumanoidRig, col: Material, flare = 0.25, len = 0.2) => m.at(h.hips, () => m.cylinder([0, 0, 0.12], [-0.01, 0, -len], 0.16, col, flare, { segs: 12 }));
/** Wide pleated trousers or a short skirt. */
export const skirt = (m: Model, h: HumanoidRig, col: Material = P.team, flare = 0.22, len = 0.08) => m.at(h.hips, () => m.cylinder([0, 0, 0.1], [0, 0, -len], 0.155, col, flare, { segs: 12 }));
/** A wide sash round the waist in the side's colour, knotted at the back with two tails. */
export function sash(m: Model, h: HumanoidRig, p: Pose, col: Material = P.team, bulk = 1) {
  m.at(h.hips, () => {
    m.decal(0.02, () => m.cylinder([0, 0, 0.04], [0, 0, 0.16], 0.165 * bulk, col, 0.17 * bulk, { segs: 12 }));
    const w = p.wave(0.02, 1);
    m.group(() => { for (const s of [1, -1]) m.poly([[-0.15 * bulk, s * 0.02, 0.12], [-0.3 * bulk, s * 0.09 + w, -0.02], [-0.27 * bulk, s * 0.02 + w, -0.1]], col); });
  });
}
/** A cape or cloak down the back. */
export function cape(m: Model, h: HumanoidRig, p: Pose, col: Material = P.team, len = 0.42, w = 0.2) {
  const sw = p.is("walk") ? 0.08 + 0.03 * p.wave(1, 2) : 0.03 + 0.01 * p.wave(1);
  m.at(h.back, () => m.poly([[0.0, -w * 0.6, 0.1], [0.0, w * 0.6, 0.1], [0.06 + sw, w, 0.1 - len], [0.06 + sw, -w, 0.1 - len]], col));
}
/** A tall narrow banner on a pole strapped to the back: the side's colour high above the head. */
export function backBanner(m: Model, h: HumanoidRig, p: Pose, tall = 0.62, w = 0.17, col: Material = P.team) {
  const sw = p.wave(0.015, 1);
  m.at(h.back, () => {
    m.cylinder([0.03, 0, -0.1], [0.03, 0, tall], 0.012, P.ink, 0.012, { segs: 5 });
    m.cylinder([0.03, 0, tall], [0.03, w, tall], 0.01, P.ink, 0.01, { segs: 4 });
    m.poly([[0.03, 0, tall], [0.03, w, tall], [0.03 + sw, w, tall - 0.42], [0.03 + sw, 0, tall - 0.42]], col);
    m.decal(0.02, () => m.poly([[0.031, w * 0.25, tall - 0.12], [0.031, w * 0.75, tall - 0.12], [0.031 + sw * 0.5, w * 0.75, tall - 0.2], [0.031 + sw * 0.5, w * 0.25, tall - 0.2]], P.white));
  });
}
/** Shoulder plates of lacquered armour. */
export function shoulders(m: Model, h: HumanoidRig, col: Material = P.ink, bulk = 1, size = 1) {
  m.at(h.chest, () => { for (const s of [1, -1]) m.box([0, s * 0.215 * bulk, 0.11], [0.2 * size, 0.13 * size, 0.09 * size], col); });
}
/** A straw raincoat: a shaggy cone from the shoulders. */
export function strawCoat(m: Model, h: HumanoidRig, col: Material = P.straw) {
  m.at(h.chest, () => m.group(() => { m.cylinder([-0.01, 0, 0.16], [-0.02, 0, -0.14], 0.14, col, 0.29, { segs: 12 }); m.cylinder([-0.02, 0, -0.1], [-0.02, 0, -0.24], 0.25, col, 0.33, { segs: 12 }); }));
}

// ------------------------------------------------------------------------------------------------ weapons (along +x from the grip)
/** A long curved sword. */
export function sword(m: Model, len: number, bl: Material = P.steel, guard: Material = P.bronze, w = 0.04) {
  m.tube([[0.04, 0, 0], [len * 0.55, 0, 0.012], [len, 0, 0.05]], [w * 0.5, w * 0.5, w * 0.2], bl, { segs: 4 });
  m.group(() => { m.cylinder([0.02, 0, 0], [0.04, 0, 0], 0.045, guard, 0.045, { segs: 8 }); m.cylinder([-0.11, 0, 0], [0.02, 0, 0], 0.02, P.ink, 0.02, { segs: 5 }); });
}
export function dagger(m: Model, len: number, bl: Material = P.steel) {
  m.cone([0.02, 0, 0], [len, 0, 0], 0.03, bl, { segs: 4 });
  m.cylinder([-0.06, 0, 0], [0.02, 0, 0], 0.02, P.ink, 0.02, { segs: 5 });
}
/** A spear: a long dark shaft, a leaf blade, a tassel in the side's colour under it. */
export function spear(m: Model, back: number, front: number, tip: Material = P.steel, r = 0.016, tassel: Material | null = P.team) {
  m.cylinder([-back, 0, 0], [front, 0, 0], r, P.woodDk, r, { segs: 5 });
  m.group(() => { m.cone([front, 0, 0], [front + 0.2, 0, 0], 0.045, tip, { segs: 4 }); m.cone([front + 0.02, 0, 0], [front - 0.04, 0, 0], 0.045, tip, { segs: 4 }); });
  if (tassel) m.sphere([front - 0.07, 0, -0.02], 0.045, tassel, { segs: 6 });
}
/** A studded iron club. */
export function club(m: Model, len: number, col: Material = P.ink, fat = 0.085) {
  m.group(() => { m.cylinder([-0.1, 0, 0], [len * 0.4, 0, 0], 0.025, col, 0.035, { segs: 6 }); m.capsule([len * 0.4, 0, 0], [len, 0, 0], fat * 0.7, col, fat, { segs: 8 }); });
  m.group(() => { for (let i = 0; i < 6; i++) { const a = i * 2.2, x = len * (0.5 + 0.09 * i); m.cone([x, Math.cos(a) * fat * 0.8, Math.sin(a) * fat * 0.8], [x, Math.cos(a) * fat * 1.5, Math.sin(a) * fat * 1.5], 0.022, P.steel, { segs: 4 }); } });
}
/** A wooden mallet. */
export function mallet(m: Model, len: number, head: Material = P.wood, size = 0.1) {
  m.cylinder([-0.1, 0, 0], [len, 0, 0], 0.02, P.woodDk, 0.02, { segs: 5 });
  m.cylinder([len, 0, -size], [len, 0, size], size * 0.62, head, size * 0.62, { segs: 8 });
}
/** A staff standing along +z from the hand. */
export function staff(m: Model, down: number, up: number, col: Material = P.woodDk, r = 0.018) {
  m.cylinder([0, 0, -down], [0, 0, up], r, col, r, { segs: 5 });
}
/** A tall asymmetric bow held upright: the stave curves forward (+x), the string runs behind. */
export function bow(m: Model, size: number, pull: number, col: Material = P.ink, arrow: Material | null = P.woodDk) {
  m.tube([[-0.02, 0, -size * 0.7], [0.1, 0, -size * 0.35], [0.14, 0, 0.05], [0.1, 0, size * 0.75], [-0.04, 0, size * 1.25]], 0.018, col, { segs: 5 });
  m.tube([[-0.02, 0, -size * 0.7], [-0.02 - pull, 0, 0], [-0.04, 0, size * 1.25]], 0.005, P.inkMid, { segs: 3 });
  if (arrow) m.group(() => { m.cylinder([-0.02 - pull, 0, 0], [0.3 - pull, 0, 0], 0.009, arrow, 0.009, { segs: 4 }); m.cone([0.3 - pull, 0, 0], [0.38 - pull, 0, 0], 0.024, P.steel, { segs: 4 }); });
}
/** A round folding fan standing in the x-z plane from the grip. */
export function fan(m: Model, size: number, col: Material = P.team, rim: Material = P.ink) {
  m.cylinder([-0.06, 0, 0], [0.06, 0, 0], 0.014, rim, 0.014, { segs: 4 });
  const pts: V3[] = [[0.04, 0, 0]];
  for (let i = 0; i <= 6; i++) { const a = (-65 + i * (130 / 6)) * Math.PI / 180; pts.push([0.04 + Math.cos(a) * size, 0, Math.sin(a) * size]); }
  m.poly(pts, col);
}
/** A round clay bomb pot with a fuse (centre at the origin). */
export function bombPot(m: Model, r: number, lit: Material | null = P.flame, shell: Material = P.ink) {
  m.sphere([0, 0, 0], r, shell, { segs: 10 });
  m.decal(0.02, () => m.torus([0, 0, r * 0.1], [0, 0, 1], r * 0.98, r * 0.09, P.rope, { segs: 10 }));
  m.cylinder([0, 0, r * 0.9], [0, 0, r * 1.25], r * 0.3, P.clay, r * 0.24, { segs: 6 });
  if (lit) m.group(() => { m.sphere([0, 0, r * 1.5], r * 0.3, lit, { segs: 5 }); m.sphere([0.02, 0, r * 1.85], r * 0.16, P.ember, { segs: 4 }); });
}
/** A paper lantern (centre at the origin): ribs, a lit paper drum, black caps. */
export function lantern(m: Model, r: number, lit: Material = P.lampLit, band: Material | null = P.team) {
  m.ellipsoid([0, 0, 0], [r, r, r * 1.2], lit, { segs: 10 });
  m.group(() => { m.cylinder([0, 0, r * 1.0], [0, 0, r * 1.25], r * 0.55, P.ink, r * 0.55, { segs: 8 }); m.cylinder([0, 0, -r * 1.25], [0, 0, -r * 1.0], r * 0.55, P.ink, r * 0.55, { segs: 8 }); });
  if (band) m.decal(0.02, () => m.cylinder([0, 0, -r * 0.3], [0, 0, r * 0.3], r * 1.02, band, r * 1.02, { segs: 10 }));
}
/** A standing plank shield facing +x (centre at the origin): a board in the side's colour, black battens, a brush ring. */
export function plankShield(m: Model, w: number, h: number, face: Material = P.team, rim: Material = P.ink, mark: Material = P.white) {
  m.box([0, 0, 0], [0.05, w, h], rim);
  m.decal(0.012, () => { m.box([0.03, 0, 0], [0.012, w - 0.06, h - 0.06], face); m.box([-0.03, 0, 0], [0.012, w - 0.06, h - 0.06], face); });
  m.decal(0.02, () => m.group(() => { for (const z of [-h * 0.3, h * 0.3]) m.box([0.036, 0, z], [0.012, w, 0.035], rim); }));
  m.decal(0.03, () => m.torus([0.04, 0, 0], [1, 0, 0], w * 0.2, 0.022, mark, { segs: 10 }));
}

// ------------------------------------------------------------------------------------------------ marks
/** A brush slash: a tapered arc of solid ink about body point c, radius r, from a0 to a1 degrees (0 ahead, 90 right). */
export function slashArc(m: Model, h: HumanoidRig, c: V3, r: number, a0: number, a1: number, dz = 0, col: Material = P.slash, fat = 0.05) {
  const pts: V3[] = [], rad: number[] = [], n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    pts.push(h.pt([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + dz * (t - 0.5)]));
    rad.push((0.006 + fat * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25)), 0.8)) * h.size);
  }
  m.tube(pts, rad, col, { segs: 5 });
}
/** An ink splat: a blot with flung drops (a strike landing, a shot leaving). */
export function splat(m: Model, at: V3, size: number, col: Material = P.splat, seed = 1) {
  m.group(() => {
    m.sphere(at, size * 0.55, col, { segs: 7 });
    for (let i = 0; i < 6; i++) {
      const a = seed * 1.7 + i * 1.05, e = 0.6 * Math.sin(seed + i * 2.3), d = size * (0.9 + 0.5 * ((i * 7 + seed) % 3) / 2);
      const q: V3 = [at[0] + Math.cos(a) * Math.cos(e) * d, at[1] + Math.sin(a) * Math.cos(e) * d, at[2] + Math.sin(e) * d];
      m.capsule([at[0] + (q[0] - at[0]) * 0.45, at[1] + (q[1] - at[1]) * 0.45, at[2] + (q[2] - at[2]) * 0.45], q, size * 0.16, col, size * 0.06, { segs: 4 });
    }
  });
}
/** A puff of wash: mist, dust, smoke. */
export function puff(m: Model, at: V3, size: number, k = 0, col: Material = P.mist, seed = 1) {
  m.group(() => {
    for (let i = 0; i < 3; i++) {
      const a = seed * 2.4 + i * 2.1, s = size * (0.9 - 0.2 * i) * (1 - 0.35 * k);
      m.sphere([at[0] + Math.cos(a) * size * 0.5 * (0.5 + k), at[1] + Math.sin(a) * size * 0.5 * (0.5 + k), at[2] + i * size * 0.4 * (0.4 + k)], s * 0.6, col, { segs: 6 });
    }
  });
}
/** A jagged stroke from a to b (lightning as a dry brush line). */
export function zigzag(m: Model, a: V3, b: V3, amp: number, col: Material = P.zap, r = 0.016, n = 5) {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, s = i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * amp; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + s * 0.5, a[2] + (b[2] - a[2]) * t + s]); }
  m.tube(pts, pts.map((_, i) => r * (1.3 - 0.9 * (i / n))), col, { segs: 4 });
}
/** A scatter of petals or flecks round a point. */
export function flecks(m: Model, at: V3, spread: number, n: number, size: number, col: Material = P.petal, seed = 1) {
  m.group(() => { for (let i = 0; i < n; i++) { const a = seed + i * 2.4, d = spread * (0.4 + 0.6 * ((i * 5) % 4) / 3); m.ellipsoid([at[0] + Math.cos(a) * d, at[1] + Math.sin(a) * d, at[2] + Math.sin(a * 1.7) * spread * 0.6], [size, size * 0.6, size * 0.35], col, { segs: 5 }); } });
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
export const along = (at: V3, dir: V3) => frameAt(at, dir);
export const UP: V3 = [0, 0, 1];
