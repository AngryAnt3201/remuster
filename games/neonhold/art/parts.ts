// Neonhold's materials and the parts its units share: visors, hoods, light strips, hard-light panels, plasma, arcs.
// The neon look draws every part as a dark fill with an edge in the part's own colour, so a material's colour is
// mostly the colour of its outline. Team parts are emissive (lit fills): they carry the side, and they are what
// makes a unit read on a dark street.
import { humanoid, type HumanoidOpts, type HumanoidRig, type Pose } from "../../../artkit/rig";
import { Model, mat, norm, team, type Material, type V3 } from "../../../artkit/toon3d";

export const P = {
  // chassis: indigo plate and undersuit (dark fill, periwinkle edge)
  armor: mat("#8f94ff", { emit: 0.42 }),
  armorDk: mat("#6a70e0", { emit: 0.26 }),
  suit: mat("#6a70c8", { emit: 0.16 }),
  suitDk: mat("#5055b0", { emit: 0.1 }),
  black: mat("#40407a"),
  chrome: mat("#dfe6ff", { emit: 0.42 }),
  steel: mat("#a9b4e8", { emit: 0.2 }),
  gold: mat("#ffd14a", { emit: 0.6 }),
  white: mat("#f2f6ff", { emit: 0.72 }),
  whiteDk: mat("#b9c4e6", { emit: 0.5 }),
  skin: mat("#f0b592", { emit: 0.55 }),
  violet: mat("#a777ff", { emit: 0.4 }),
  magenta: mat("#ff46dc", { emit: 0.5 }),
  green: mat("#52e08a", { emit: 0.45 }),
  ice: mat("#cfe4ff", { emit: 0.55 }),
  glass: mat("#b9a8ff", { emit: 0.5, alpha: 0.6 }),
  // lights (never orange or cyan: those belong to the teams)
  lamp: mat("#fff1b0", { emit: 1, glow: 0.8, ink: false }),
  hot: mat("#ffffff", { emit: 1, glow: 0.6, ink: false }),
  plasma: mat("#ff5ce6", { emit: 1, glow: 1, ink: false }),
  laser: mat("#fff36b", { emit: 1, glow: 0.9, ink: false }),
  arc: mat("#d9c8ff", { emit: 1, glow: 1, ink: false }),
  heal: mat("#5dffa0", { emit: 1, glow: 0.9, ink: false }),
  toxic: mat("#9dff4a", { emit: 0.95, glow: 0.6 }),
  frost: mat("#e6f3ff", { emit: 1, glow: 0.6, ink: false }),
  red: mat("#ff2e5b", { emit: 1, glow: 0.7, ink: false }),
  smoke: mat("#7a7ab0", { emit: 0.45, ink: false, alpha: 0.6 }),
  dead: mat("#2a2a52"),
  // team colour: always lit
  team: team("main", { emit: 0.66 }),
  teamDk: team("dark", { emit: 0.6 }),
  teamLt: team("light", { emit: 1 }),
  /** A team light: visors, strips, blades. */
  teamGlow: team("main", { emit: 1, glow: 0.4 }),
  /** Hard light: shields, holo-banners, wings of light. */
  holo: team("main", { emit: 0.85, alpha: 0.62, glow: 0.35 }),
  holoLt: team("light", { emit: 1, alpha: 0.5, glow: 0.3, ink: false }),
  /** Ascended: team-light that throws a halo. */
  aether: team("light", { emit: 1, glow: 0.55 }),
};

/** Trim by rank: steel, chrome, gold, gold. */
export const trim = (tier: number): Material => (tier >= 3 ? P.gold : tier === 2 ? P.chrome : P.steel);
/** The glowing core on Ascended units, a plainer light below that. */
export const core = (tier: number, lower: Material = P.teamGlow): Material => (tier >= 4 ? P.aether : lower);

/** The humanoid with Neonhold's defaults: an armoured body with no face (a visor does that job). */
export function crew(m: Model, p: Pose, o: Partial<HumanoidOpts>): HumanoidRig {
  return humanoid(m, p, { skin: P.suitDk, torso: P.armor, legs: P.suit, boots: P.black, hands: P.black, noFace: true, ...o });
}

/** A glowing visor band across the front of a head of radius r (call inside the head frame). */
export function visor(m: Model, r: number, col: Material = P.teamGlow, h = 0.2, z = 0.04) {
  m.ellipsoid([r * 0.36, 0, r * z], [r * 0.74, r * 0.88, r * h], col, { segs: 12 });
}
/** Two slit eyes. */
export function eyes(m: Model, r: number, col: Material = P.teamGlow) {
  m.decal(0.03, () => m.group(() => { for (const s of [1, -1]) m.ellipsoid([r * 0.9, s * r * 0.38, r * 0.04], [r * 0.12, r * 0.2, r * 0.09], col, { segs: 8 }); }));
}
/** A hard-shell helmet over the head, with a visor and a light bar over the crown (heads are seen from above:
 *  the bar is what says "helmet", and it carries the side). */
export function helm(m: Model, r: number, shell: Material = P.armor, vis: Material | null = P.teamGlow, crest: Material | null = null, bar: Material | null = P.teamLt) {
  m.ellipsoid([-r * 0.04, 0, r * 0.12], [r * 1.1, r * 1.08, r * 1.02], shell);
  if (vis) visor(m, r * 1.1, vis, 0.3, 0.1);
  if (bar) m.decal(0.03, () => m.ellipsoid([-r * 0.1, 0, r * 0.62], [r * 0.9, r * 0.2, r * 0.56], bar, { segs: 10 }));
  if (crest) m.extrude([[-r * 0.9, r * 0.7], [r * 0.5, r * 1.02], [r * 0.2, r * 1.5], [-r * 1.05, r * 1.25]], r * 0.16, crest);
}
/** A hood: pulled forward over the brow, pointed at the back. */
export function hood(m: Model, r: number, cloth: Material = P.suitDk, vis: Material | null = P.teamGlow) {
  m.group(() => {
    m.ellipsoid([-r * 0.1, 0, r * 0.14], [r * 1.14, r * 1.1, r * 1.08], cloth);
    m.cone([-r * 0.5, 0, r * 0.55], [-r * 1.5, 0, r * 0.2], r * 0.62, cloth, { segs: 8 });
  });
  if (vis) eyes(m, r * 1.08, vis);
}
/** A flat-topped cap or hard hat with a peak. */
export function cap(m: Model, r: number, body: Material, peak: Material = body) {
  m.group(() => {
    m.ellipsoid([-r * 0.05, 0, r * 0.5], [r * 1.02, r * 1.02, r * 0.55], body);
    m.ellipsoid([r * 0.75, 0, r * 0.38], [r * 0.5, r * 0.7, r * 0.1], peak);
  });
}
/** A line of light between two points. */
export const strip = (m: Model, a: V3, b: V3, r = 0.014, col: Material = P.teamGlow) => m.cylinder(a, b, r, col, r, { segs: 5 });
/** A shoulder plate each side of the chest (call inside the chest frame). */
export function pads(m: Model, col: Material, r = 0.085, bulk = 1) {
  for (const s of [1, -1]) m.ellipsoid([0, s * 0.19 * bulk, 0.13], [r, r * 1.1, r * 0.72], col, { segs: 10 });
}
/** A power pack on the back (call inside the back frame): a box with a lit cell. */
export function pack(m: Model, w = 0.2, h = 0.22, col: Material = P.armorDk, cell: Material | null = P.teamGlow) {
  m.box([0.05, 0, 0], [0.1, w, h], col);
  if (cell) m.decal(0.02, () => m.box([0.105, 0, 0.02], [0.02, w * 0.5, h * 0.4], cell));
}
/** A coat skirt hanging from the hips. */
export const skirt = (m: Model, h: HumanoidRig, col: Material, len = 0.07, flare = 0.19) => m.at(h.hips, () => m.cylinder([0, 0, 0.1], [-0.01, 0, -len], 0.15, col, flare));
/** The Ascended mark: a ring of team light turning over the head (call inside the head frame). */
export function halo(m: Model, p: Pose, r = 0.19, z = 0.38) {
  if (p.tier < 4) return;
  m.with(() => { m.move(0, 0, z).rotZ(p.i * 20); m.torus([0, 0, 0], [0.15, 0, 1], r * 0.74, 0.022, P.teamLt, { segs: 14 }); });
}
/** A muzzle flash: a star of plasma pointing along local +x. */
export function flash(m: Model, at: V3, size: number, col: Material = P.plasma, hotM: Material = P.hot) {
  m.with(() => {
    m.move(at[0], at[1], at[2]);
    m.group(() => {
      m.cone([0, 0, 0], [size * 2.4, 0, 0], size * 0.5, col, { segs: 6 });
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.6; m.cone([0, 0, 0], [size * 0.4, Math.cos(a) * size * 1.3, Math.sin(a) * size * 1.3], size * 0.26, col, { segs: 5 }); }
    });
    m.decal(0.05, () => m.sphere([size * 0.2, 0, 0], size * 0.45, hotM, { segs: 6 }));
  });
}
/** A jagged arc of electricity between two points. */
export function arcBolt(m: Model, a: V3, b: V3, r: number, seed = 1, col: Material = P.arc) {
  const n = 5, pts: V3[] = [];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = i === 0 || i === n ? 0 : 1;
    const o1 = Math.sin(seed * 12.9 + i * 78.2) * 0.5, o2 = Math.sin(seed * 39.3 + i * 11.1) * 0.5;
    pts.push([a[0] + (b[0] - a[0]) * t + j * o1 * len * 0.2, a[1] + (b[1] - a[1]) * t + j * o2 * len * 0.2, a[2] + (b[2] - a[2]) * t + j * o1 * len * 0.18]);
  }
  m.tube(pts, r, col, { segs: 5 });
}
/** A burst: a few soft balls (smoke, coolant, sparks). `k` 0..1 grows and thins it. */
export function puff(m: Model, at: V3, size: number, k = 0, col: Material = P.smoke, seed = 1) {
  m.group(() => {
    for (let i = 0; i < 3; i++) {
      const a = seed * 2.4 + i * 2.1, s = size * (0.55 + 0.2 * ((i * 7 + seed) % 3)) * (0.7 + 0.6 * k);
      m.sphere([at[0] + Math.cos(a) * size * 0.45 * (0.6 + k), at[1] + Math.sin(a) * size * 0.45 * (0.6 + k), at[2] + i * size * 0.32 * (0.5 + k)], s, col, { segs: 7 });
    }
  });
}
/** A crescent of light where a blade passed: an arc of radius r about body point c, from a0 to a1 degrees (0 = ahead,
 *  90 = the body's right). */
export function slashArc(m: Model, h: HumanoidRig, c: V3, r: number, a0: number, a1: number, dz = 0, col: Material = P.hot) {
  const pts: V3[] = [], rad: number[] = [], n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    pts.push(h.pt([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + dz * (t - 0.5)]));
    rad.push(0.008 + 0.034 * Math.sin(Math.PI * t) * h.size);
  }
  m.tube(pts, rad, col, { segs: 5 });
}
/** Overhead chop with the right hand: where the hand is and where the weapon points. */
export function chop(p: Pose): { hand: V3; aim: V3 } {
  return {
    hand: p.mix<V3>([0.14, 0.2, 0.38], [0.32, 0.08, 0.3], { wind: [-0.04, 0.24, 0.68] }),
    aim: norm(p.mix<V3>([0.45, 0.1, 1], [1, -0.25, -0.3], { wind: [-0.5, 0.15, 1] })),
  };
}
/** Straight thrust with the right hand. */
export function thrust(p: Pose, reach = 0.34): { hand: V3; aim: V3 } {
  return {
    hand: p.mix<V3>([0.12, 0.2, 0.38], [reach, 0.1, 0.42], { wind: [-0.08, 0.22, 0.44] }),
    aim: norm(p.mix<V3>([1, 0, 0.35], [1, -0.05, 0], { wind: [1, 0.05, 0.12] })),
  };
}
/** A light blade along +x from the grip: a dark spine with a glowing edge. */
export function blade(m: Model, len: number, edge: Material = P.teamGlow, guard: Material = P.chrome, w = 0.02) {
  m.extrude([[0.04, -w], [len * 0.8, -w], [len, 0.012], [len * 0.75, w * 1.3], [0.04, w]], 0.012, edge);
  m.group(() => { m.box([0.03, 0, 0], [0.024, 0.07, 0.055], guard); m.capsule([-0.07, 0, 0], [0.02, 0, 0], 0.019, P.black, 0.019, { segs: 6 }); });
}
/** A long shaft along +x from the grip, from -back to +front. */
export const shaft = (m: Model, back: number, front: number, r = 0.016, col: Material = P.steel) => m.cylinder([-back, 0, 0], [front, 0, 0], r, col, r, { segs: 6 });
/** A wheel in the x-z plane (axis along y): a dark tyre with a lit hub ring. */
export function wheel(m: Model, r: number, w: number, hub: Material = P.teamGlow, tyre: Material = P.black) {
  m.cylinder([0, -w / 2, 0], [0, w / 2, 0], r, tyre, r, { segs: 14 });
  for (const s of [1, -1]) m.decal(0.01, () => m.torus([0, s * w * 0.52, 0], [0, 1, 0], r * 0.62, r * 0.09, hub, { segs: 14 }));
}
