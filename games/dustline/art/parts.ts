// Dustline's palette and the parts its cast shares: hats, bandanas, serapes, dusters, guns, dynamite, dust and smoke.
import { Model, mat, team, type Material, type V3 } from "../../../artkit/toon3d";
import type { HumanoidRig, Pose } from "../../../artkit/rig";

/** The frontier's materials. Team colour goes on serapes, coats, hat bands, shields, flags; hide and iron are shared. */
export const P = {
  hide: mat("#a8703f"), hideDk: mat("#6a4023"), hideLt: mat("#cf9a5e"), rawhide: mat("#e0c08a"),
  felt: mat("#5a4636"), feltDk: mat("#33261d"), black: mat("#2b2422"), straw: mat("#e6c665"), strawDk: mat("#b8943f"),
  denim: mat("#4a5d7c"), denimDk: mat("#33415a"), canvas: mat("#e6d7b2"), canvasDk: mat("#b09a6e"), white: mat("#f5efe0"),
  burlap: mat("#b59a66"), wool: mat("#7a6a58"), red: mat("#c23a2c"), redDk: mat("#8a2018"), fur: mat("#eef0ee"), furDk: mat("#b9c2c8"),
  wood: mat("#9a6a3c"), woodDk: mat("#5f3d20"), woodLt: mat("#c79a5e"), board: mat("#b88a55"),
  iron: mat("#6f7480", { metal: 0.45 }), ironDk: mat("#3c3f48", { metal: 0.3 }), steel: mat("#d5dbe2", { metal: 0.85 }),
  tin: mat("#b9c2cc", { metal: 0.7 }), brass: mat("#e0a93c", { metal: 0.8 }), brassDk: mat("#a87428", { metal: 0.5 }), copper: mat("#c9703c", { metal: 0.7 }),
  skin: mat("#eebd92"), skinDk: mat("#c48a62"), skinTan: mat("#d9a070"), hair: mat("#4f3222"), hairGrey: mat("#d9d4c8"), hairRed: mat("#b8572c"),
  bone: mat("#efe6cc"), boneDk: mat("#b9ad8c"),
  rock: mat("#c2623e"), rockDk: mat("#8f4029"), rockLt: mat("#e09a62"), sand: mat("#dcb87e"),
  cactus: mat("#5f9b4c"), cactusDk: mat("#3c7238"), bloom: mat("#f06a8c"),
  horse: mat("#8a5230"), horseDk: mat("#55301c"), palomino: mat("#e3b871"), cream: mat("#f3e6c4"),
  feather: mat("#5b4433"), featherDk: mat("#33261e"), beak: mat("#f0b83a"),
  glass: mat("#a9e2e0", { metal: 1, shade: 0.4 }), bottle: mat("#7fd08a", { metal: 0.9, shade: 0.4 }),
  water: mat("#7fd0f2", { emit: 0.6, ink: false, alpha: 0.9, metal: 0.6 }), barrelBlue: mat("#4e8fb0"),
  ice: mat("#cfeefc", { metal: 0.8, shade: 0.5 }), frost: mat("#e3f6ff", { emit: 0.6, glow: 0.4 }),
  /** Fire and powder: fuses, muzzle flashes, lanterns. */
  fire: mat("#ff8a2e", { emit: 1, glow: 0.8, ink: false }), fireHot: mat("#fff2b4", { emit: 1, glow: 0.5, ink: false }),
  lamp: mat("#ffd36e", { emit: 1, glow: 0.9, ink: false }), ember: mat("#ff5a2a", { emit: 1, ink: false }),
  spark: mat("#fff6d0", { emit: 1, ink: false }),
  arc: mat("#c8ecff", { emit: 1, glow: 1, ink: false }), arcCore: mat("#ffffff", { emit: 1, glow: 0.5, ink: false }),
  ghost: mat("#9cf28a", { emit: 0.9, glow: 0.7, ink: false }), ghostDim: mat("#6fcf6a", { emit: 0.7, glow: 0.4 }),
  mist: mat("#b9f5c0", { emit: 0.9, ink: false, alpha: 0.8, glow: 0.4 }),
  smoke: mat("#efe6d6", { emit: 0.85, ink: false, alpha: 0.82, shade: 0.5 }), smokeDk: mat("#6a5f58", { emit: 0.5, ink: false, alpha: 0.8, shade: 0.5 }),
  dust: mat("#e0c497", { emit: 0.6, ink: false, alpha: 0.75, shade: 0.4 }),
  slash: mat("#fffbe8", { emit: 1, ink: false, alpha: 0.92 }),
  // team colour
  team: team("main"), teamDk: team("dark"), teamLt: team("light"),
  /** Team paint on upright faces (doors, shields, flags): barely darkened by shadow, so it stays the side's colour. */
  teamFlat: team("main", { shade: 0.3 }),
  /** Ascended: a part that burns in the team's light colour. */
  glory: team("light", { emit: 0.9, glow: 1 }), gloryInk: team("light", { emit: 0.9, glow: 0.8, ink: false }),
  gloryFlat: { color: "#ffffff", team: "light" as const, emit: 1 } as Material,
};
export const GOLD = mat("#ffd45e", { metal: 1 });

/** Trim by rank: iron, tin, brass, gold. */
export const trim = (tier: number): Material => (tier >= 4 ? GOLD : tier === 3 ? P.brass : tier === 2 ? P.tin : P.iron);
/** Trim that is never plain iron (buckles, muzzle bands). */
export const trim2 = (tier: number): Material => trim(Math.max(2, tier));
/** The lit part on Ascended units; `lower` below that. */
export const core = (tier: number, lower: Material = P.lamp): Material => (tier >= 4 ? P.glory : lower);

/** A five-pointed star outline in the x-z plane (for m.extrude). */
export function starOutline(r: number, inner = 0.45, phase = Math.PI / 2): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const a = phase + (i / 10) * Math.PI * 2, rr = i % 2 ? r * inner : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return pts;
}
/** A sheriff's star standing in the local x-z plane (thin along y). */
export function star(m: Model, r: number, col: Material = P.brass, thick = 0.015) { m.extrude(starOutline(r), thick, col); }
/** A badge on a surface that faces local +x (a chest, a door, a hat front). */
export function badge(m: Model, at: V3, r: number, col: Material = P.brass) {
  m.decal(0.03, () => m.with(() => { m.move(at[0], at[1], at[2]).rotZ(90); star(m, r, col, 0.012); }));
}
/** The Ascended mark: a star of team light turning slowly over the hat. Call inside the head frame. */
export function halo(m: Model, p: Pose, z = 0.5, r = 0.09) {
  if (p.tier < 4) return;
  m.with(() => { m.move(0, 0, z + 0.012 * Math.sin(p.i * 1.1)).rotZ(90 + p.i * 12); star(m, r, P.gloryFlat, 0.02); });
}

// ------------------------------------------------------------------------------------------------ hats (head frame, head radius r)
/** A stetson: a wide brim that curls up at the sides, a pinched crown, a band (the team's, usually). */
export function stetson(m: Model, r: number, body: Material = P.hide, band: Material = P.team, o: { brim?: number; h?: number; tilt?: number } = {}) {
  const b = (o.brim ?? 1.5) * r, h = (o.h ?? 0.95) * r;
  m.with(() => {
    m.move(-r * 0.04, 0, r * 0.5).rotY(o.tilt ?? -7);
    m.group(() => {
      m.cylinder([0, 0, 0], [0, 0, r * 0.09], b * 0.94, body, b, { segs: 14 });
      for (const s of [1, -1]) m.capsule([-b * 0.55, s * b * 0.88, r * 0.12], [b * 0.55, s * b * 0.88, r * 0.12], r * 0.11, body, r * 0.11, { segs: 6 });
      m.cylinder([0, 0, r * 0.06], [0, 0, h], r * 0.82, body, r * 0.66, { segs: 12 });
      m.ellipsoid([0, 0, h], [r * 0.66, r * 0.5, r * 0.14], body, { segs: 10 });
    });
    m.cylinder([0, 0, r * 0.09], [0, 0, r * 0.5], r * 0.86, band, r * 0.775, { segs: 12 });
    m.decal(0.004, () => m.torus([0, 0, r * 0.1], [0, 0, 1], b * 0.97, r * 0.08, band, { segs: 18 }));
  });
}
/** A sombrero: a very wide dished brim and a tall cone crown. */
export function sombrero(m: Model, r: number, body: Material = P.straw, band: Material = P.team, wide = 2.1) {
  m.with(() => {
    m.move(-r * 0.04, 0, r * 0.5).rotY(-6);
    m.group(() => {
      m.lathe([[r * 0.7, 0], [r * wide * 0.85, r * 0.02], [r * wide, r * 0.2], [r * wide * 0.96, r * 0.24], [r * wide * 0.8, r * 0.1], [r * 0.7, r * 0.1]], body, { segs: 16 });
      m.cylinder([0, 0, r * 0.06], [0, 0, r * 0.95], r * 0.74, body, r * 0.36, { segs: 12 });
      m.sphere([0, 0, r * 0.95], r * 0.36, body, { segs: 8 });
    });
    m.cylinder([0, 0, r * 0.1], [0, 0, r * 0.5], r * 0.78, band, r * 0.6, { segs: 12 });
    m.decal(0.01, () => m.torus([0, 0, r * 0.215], [0, 0, 1], r * wide * 0.97, r * 0.05, band, { segs: 18 }));
  });
}
/** A flat-brimmed, flat-crowned gambler's hat. */
export function flatHat(m: Model, r: number, body: Material = P.black, band: Material = P.team, brim = 1.55) {
  m.with(() => {
    m.move(-r * 0.04, 0, r * 0.55).rotY(-5);
    m.group(() => { m.cylinder([0, 0, 0], [0, 0, r * 0.08], r * brim, body, r * brim, { segs: 14 }); m.cylinder([0, 0, r * 0.06], [0, 0, r * 0.62], r * 0.8, body, r * 0.78, { segs: 12 }); });
    m.cylinder([0, 0, r * 0.08], [0, 0, r * 0.42], r * 0.84, band, r * 0.825, { segs: 12 });
    m.decal(0.004, () => m.torus([0, 0, r * 0.06], [0, 0, 1], r * brim * 0.98, r * 0.075, band, { segs: 18 }));
  });
}
/** A derby (bowler): round crown, short curled brim. */
export function derby(m: Model, r: number, body: Material = P.feltDk, band: Material = P.team) {
  m.with(() => {
    m.move(-r * 0.05, 0, r * 0.55).rotY(-6);
    m.group(() => { m.cylinder([0, 0, 0], [0, 0, r * 0.1], r * 1.18, body, r * 1.26, { segs: 12 }); m.ellipsoid([0, 0, r * 0.12], [r * 0.82, r * 0.82, r * 0.72], body); });
    m.cylinder([0, 0, r * 0.1], [0, 0, r * 0.4], r * 0.87, band, r * 0.84, { segs: 12 });
    m.decal(0.004, () => m.torus([0, 0, r * 0.1], [0, 0, 1], r * 1.24, r * 0.075, band, { segs: 16 }));
  });
}
/** A tall stovepipe hat. */
export function stovepipe(m: Model, r: number, h: number, body: Material = P.black, band: Material = P.team, stripes: Material | null = null) {
  m.with(() => {
    m.move(-r * 0.05, 0, r * 0.6).rotY(-6);
    m.group(() => { m.cylinder([0, 0, 0], [0, 0, r * 0.09], r * 1.3, body, r * 1.3, { segs: 12 }); m.cylinder([0, 0, r * 0.07], [0, 0, h], r * 0.74, body, r * 0.82, { segs: 12 }); });
    m.cylinder([0, 0, r * 0.09], [0, 0, r * 0.42], r * 0.775, band, r * 0.785, { segs: 12 });
    m.decal(0.004, () => m.torus([0, 0, r * 0.08], [0, 0, 1], r * 1.28, r * 0.07, band, { segs: 16 }));
    if (stripes) m.decal(0.006, () => m.group(() => { for (let z = r * 0.5; z < h - r * 0.1; z += r * 0.42) m.cylinder([0, 0, z], [0, 0, z + r * 0.2], r * (0.745 + 0.08 * (z / h)), stripes, r * (0.745 + 0.08 * ((z + r * 0.2) / h)), { segs: 12 }); }));
  });
}
/** A cavalry kepi: a short forage cap with a flat tilted top and a peak. */
export function kepi(m: Model, r: number, body: Material = P.team, band: Material = P.brass) {
  m.with(() => {
    m.move(-r * 0.02, 0, r * 0.52).rotY(8);
    m.group(() => { m.cylinder([0, 0, 0], [r * 0.12, 0, r * 0.6], r * 0.92, body, r * 0.8, { segs: 12 }); m.ellipsoid([r * 0.85, 0, -r * 0.02], [r * 0.5, r * 0.62, r * 0.08], P.black); });
    m.cylinder([0, 0, 0], [r * 0.03, 0, r * 0.16], r * 0.95, band, r * 0.93, { segs: 12 });
  });
}
/** A straw farm hat: a floppy wide brim and a low round crown. */
export function strawHat(m: Model, r: number, band: Material = P.team, wide = 1.75) {
  m.with(() => {
    m.move(-r * 0.04, 0, r * 0.52).rotY(-5);
    m.group(() => { m.cylinder([0, 0, r * 0.06], [0, 0, 0], r * wide * 0.92, P.straw, r * wide, { segs: 14 }); m.ellipsoid([0, 0, r * 0.1], [r * 0.82, r * 0.82, r * 0.6], P.straw); });
    m.cylinder([0, 0, r * 0.08], [0, 0, r * 0.4], r * 0.87, band, r * 0.83, { segs: 12 });
    m.decal(0.004, () => m.torus([0, 0, r * 0.04], [0, 0, 1], r * wide * 0.98, r * 0.075, band, { segs: 18 }));
    m.decal(0.006, () => m.torus([0, 0, r * 0.03], [0, 0, 1], r * wide * 0.72, r * 0.03, P.strawDk, { segs: 16 }));
  });
}
/** A bandana over the nose and mouth, knotted behind. */
export function mask(m: Model, r: number, col: Material = P.team) {
  m.decal(0.015, () => m.group(() => { m.ellipsoid([r * 0.3, 0, -r * 0.42], [r * 0.8, r * 0.9, r * 0.52], col, { segs: 10 }); }));
  m.cone([-r * 0.85, 0, -r * 0.3], [-r * 1.35, r * 0.2, -r * 0.6], r * 0.2, col, { segs: 5 });
}
/** A neckerchief knotted at the throat (chest frame). */
export function neckerchief(m: Model, col: Material = P.team, bulk = 1) {
  m.decal(0.02, () => m.group(() => { m.torus([0, 0, 0.165], [0, 0, 1], 0.1 * bulk, 0.04, col, { segs: 10 }); m.cone([0.1 * bulk, 0, 0.17], [0.15 * bulk, 0, 0.03], 0.07, col, { segs: 5 }); }));
}
/** A moustache (head frame). */
export function moustache(m: Model, r: number, col: Material = P.hair, droop = 0.38) {
  m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) m.capsule([r * 0.93, s * r * 0.05, -r * 0.3], [r * 0.8, s * r * 0.5, -r * droop], r * 0.12, col, r * 0.05, { segs: 6 }); }));
}
/** A full beard (head frame). */
export function beard(m: Model, r: number, col: Material = P.hairGrey, len = 0.9) {
  m.decal(0.012, () => m.group(() => { m.ellipsoid([r * 0.45, 0, -r * 0.55], [r * 0.62, r * 0.78, r * len * 0.6], col, { segs: 10 }); m.cone([r * 0.62, 0, -r * 0.8], [r * 0.7, 0, -r * (0.9 + len * 0.6)], r * 0.42, col, { segs: 6 }); }));
}

// ------------------------------------------------------------------------------------------------ clothes (need the rig)
/** A serape (poncho) over the shoulders: a flared blanket with a stripe near the hem. */
export function serape(m: Model, h: HumanoidRig, col: Material = P.team, stripe: Material | null = P.teamDk, bulk = 1, len = 0.2) {
  m.at(h.chest, () => {
    m.group(() => m.cylinder([0, 0, 0.17], [0, 0, 0.17 - len], 0.1 * bulk, col, 0.265 * bulk, { segs: 12 }));
    if (stripe) m.decal(0.012, () => { m.torus([0, 0, 0.17 - len * 0.72], [0, 0, 1], 0.225 * bulk, 0.02, stripe, { segs: 14 }); m.torus([0, 0, 0.17 - len * 0.45], [0, 0, 1], 0.17 * bulk, 0.012, P.canvas, { segs: 14 }); });
  });
}
/** A coat skirt hanging from the hips: short for a jacket, long for a duster. */
export const skirt = (m: Model, h: HumanoidRig, col: Material, len = 0.07, flare = 0.19) => m.at(h.hips, () => m.cylinder([0, 0, 0.1], [-0.015, 0, -len], 0.15, col, flare, { segs: 12 }));
/** A gun belt with a holster on the right hip (hips frame). */
export function gunbelt(m: Model, h: HumanoidRig, tier: number, bulk = 1) {
  m.at(h.hips, () => {
    m.decal(0.02, () => m.torus([0, 0, 0.07], [0.12, 0, 1], 0.155 * bulk, 0.026, P.hideDk, { segs: 12 }));
    m.decal(0.03, () => m.box([0.15 * bulk, 0, 0.07], [0.02, 0.06, 0.05], trim2(tier)));
    m.box([0, 0.17 * bulk, 0.0], [0.07, 0.04, 0.13], P.hideDk);
  });
}
/** A bandolier across the chest. */
export function bandolier(m: Model, h: HumanoidRig, col: Material = P.hideDk, side = 1) {
  m.at(h.chest, () => m.decal(0.02, () => m.torus([0, 0, 0.02], [0.5, side * 0.75, 0.6], 0.168, 0.027, col, { segs: 14 })));
}
/** Braces (suspenders) over the shoulders. */
export function braces(m: Model, h: HumanoidRig, col: Material = P.hideDk, bulk = 1) {
  m.at(h.chest, () => m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) m.torus([0, s * 0.085 * bulk, 0.02], [0, 1, 0.12 * s], 0.155, 0.02, col, { segs: 12 }); })));
}

// ------------------------------------------------------------------------------------------------ guns, powder, smoke
/** A lever rifle along +x from the trigger hand. */
export function rifle(m: Model, tier: number, len = 0.52) {
  m.group(() => { m.extrude([[-0.19, -0.05], [-0.19, 0.02], [-0.02, 0.03], [0.14, 0.03], [0.14, -0.03], [-0.02, -0.03]], 0.045, P.wood); });
  m.box([0.1, 0, 0.005], [0.12, 0.05, 0.06], tier >= 3 ? P.brass : P.ironDk);
  m.cylinder([0.14, 0, 0.014], [len, 0, 0.014], 0.024, P.ironDk, 0.02, { segs: 8 });
  m.cylinder([0.14, 0, -0.018], [len * 0.72, 0, -0.018], 0.018, P.wood, 0.016, { segs: 6 });
  m.cylinder([len - 0.04, 0, 0.014], [len, 0, 0.014], 0.03, trim2(tier), 0.03, { segs: 8 });
  if (tier >= 3) m.cylinder([0.06, 0, 0.055], [0.24, 0, 0.055], 0.017, P.brass, 0.02, { segs: 8 });
  if (tier >= 4) m.sphere([0.1, 0, 0.005], 0.035, P.glory, { segs: 8 });
}
/** A revolver along +x. */
export function revolver(m: Model, tier: number, len = 0.2) {
  m.group(() => { m.box([-0.02, 0, -0.035], [0.04, 0.035, 0.08], P.woodDk); m.cylinder([0, 0, 0.01], [0.07, 0, 0.01], 0.033, tier >= 3 ? P.brass : P.steel, 0.033, { segs: 8 }); });
  m.cylinder([0.06, 0, 0.015], [len, 0, 0.015], 0.017, tier >= 4 ? GOLD : P.steel, 0.015, { segs: 6 });
}
/** A bundle of dynamite along +z with a fuse: `lit` puts a spark on it. */
export function dynamite(m: Model, len = 0.16, r = 0.026, lit: Material | null = P.fire, n = 3) {
  m.group(() => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const o = n === 1 ? 0 : r * 1.05; m.cylinder([Math.cos(a) * o, Math.sin(a) * o, -len / 2], [Math.cos(a) * o, Math.sin(a) * o, len / 2], r, P.red, r, { segs: 6 }); } });
  m.decal(0.006, () => m.cylinder([0, 0, -len * 0.12], [0, 0, len * 0.12], r * (n === 1 ? 1.08 : 2.2), P.canvas, r * (n === 1 ? 1.08 : 2.2), { segs: 8 }));
  m.tube([[0, 0, len / 2], [0.015, 0.01, len / 2 + 0.04], [0.035, 0, len / 2 + 0.07]], 0.008, P.feltDk, { segs: 4 });
  if (lit) { m.sphere([0.035, 0, len / 2 + 0.075], 0.026, lit, { segs: 6 }); m.decal(0.03, () => m.sphere([0.035, 0, len / 2 + 0.075], 0.013, P.spark, { segs: 5 })); }
}
/** A powder keg standing on z (base at origin). */
export function powderKeg(m: Model, r: number, h: number, body: Material = P.red, hoop: Material = P.ironDk) {
  m.lathe([[r * 0.8, 0], [r, h * 0.3], [r, h * 0.7], [r * 0.8, h], [0, h]], body, { smooth: true, segs: 12 });
  for (const z of [h * 0.2, h * 0.8]) m.cylinder([0, 0, z - h * 0.04], [0, 0, z + h * 0.04], r * 0.97, hoop, r * 0.97, { segs: 12 });
}
/** A muzzle flash: a hot star with a ring of spikes, pointing along local +x. */
export function flash(m: Model, at: V3, size: number, col: Material = P.fire, hot: Material = P.fireHot) {
  m.with(() => {
    m.move(at[0], at[1], at[2]);
    m.group(() => {
      m.cone([0, 0, 0], [size * 2.3, 0, 0], size * 0.55, col, { segs: 8 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; m.cone([0, 0, 0], [size * 0.55, Math.cos(a) * size * 1.3, Math.sin(a) * size * 1.3], size * 0.28, col, { segs: 5 }); }
    });
    m.decal(0.05, () => m.sphere([size * 0.25, 0, 0], size * 0.5, hot, { segs: 8 }));
  });
}
/** A puff of gunsmoke or dust: a cluster of soft balls. `k` 0..1 grows and thins it as it ages. */
export function puff(m: Model, at: V3, size: number, k = 0, col: Material = P.smoke, seed = 1) {
  m.group(() => {
    for (let i = 0; i < 3; i++) {
      const a = seed * 2.4 + i * 2.1, s = size * (0.55 + 0.2 * ((i * 7 + seed) % 3)) * (0.7 + 0.6 * k);
      m.sphere([at[0] + Math.cos(a) * size * 0.45 * (0.6 + k), at[1] + Math.sin(a) * size * 0.45 * (0.6 + k), at[2] + i * size * 0.32 * (0.5 + k)], s, col, { segs: 8 });
    }
  });
}
/** Smoke drifting up through an idle or walk loop (a chimney, a pipe, a campfire). */
export function wisp(m: Model, p: Pose, at: V3, size = 0.05, col: Material = P.smoke, phase = 0) {
  if (p.anim === "death" && p.i > 2) return;
  const k = (((p.i / p.n + phase) % 1) + 1) % 1;
  puff(m, [at[0] - 0.03 * k, at[1], at[2] + 0.14 * k], size * (0.6 + 0.7 * k) * (k > 0.8 ? (1 - k) * 5 : 1), k, col, Math.round(phase * 7) + 1);
}
/** A jagged electric arc between two points. */
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
/** A spoked wagon wheel in the x-z plane (axis along y), turned by `spin` degrees. */
export function wheel(m: Model, r: number, spin = 0, rim: Material = P.woodDk, spoke: Material = P.wood, n = 8, tyre: Material | null = P.ironDk) {
  m.torus([0, 0, 0], [0, 1, 0], r, r * 0.1, rim, { segs: 16 });
  if (tyre) m.decal(0.004, () => m.torus([0, 0, 0], [0, 1, 0], r * 1.06, r * 0.045, tyre, { segs: 16 }));
  m.group(() => {
    for (let i = 0; i < n / 2; i++) { const a = ((spin + (i * 360) / n) * Math.PI) / 180; m.cylinder([Math.cos(a) * r, 0, Math.sin(a) * r], [-Math.cos(a) * r, 0, -Math.sin(a) * r], r * 0.05, spoke, r * 0.05, { segs: 5 }); }
    m.cylinder([0, -r * 0.14, 0], [0, r * 0.14, 0], r * 0.2, P.ironDk, r * 0.2, { segs: 8 });
  });
}
/** A saguaro: a ribbed column with one or two raised arms. Base at the origin. */
export function saguaro(m: Model, h: number, r = h * 0.14, arms = 2, col: Material = P.cactus, flower: Material | null = null) {
  m.group(() => {
    m.capsule([0, 0, 0], [0, 0, h - r], r, col, r * 0.92, { segs: 8 });
    const arm = (s: number, z: number, len: number) => m.tube([[0, s * r * 0.6, z], [0, s * (r + h * 0.2), z + h * 0.02], [0, s * (r + h * 0.22), z + len]], [r * 0.6, r * 0.62, r * 0.55], col, { segs: 6 });
    if (arms >= 1) arm(1, h * 0.42, h * 0.32);
    if (arms >= 2) arm(-1, h * 0.3, h * 0.24);
  });
  if (flower) m.sphere([0, 0, h + r * 0.1], r * 0.5, flower, { segs: 6 });
}
/** A prickly-pear pad cluster: something low and spiny. */
export function pricklyPear(m: Model, s: number, col: Material = P.cactus, flower: Material | null = P.bloom) {
  m.group(() => { m.ellipsoid([0, 0, s * 0.5], [s * 0.16, s * 0.42, s * 0.5], col, { segs: 8 }); m.ellipsoid([0, s * 0.4, s * 1.0], [s * 0.13, s * 0.3, s * 0.36], col, { segs: 8 }); m.ellipsoid([0, -s * 0.42, s * 0.85], [s * 0.12, s * 0.26, s * 0.3], col, { segs: 8 }); });
  if (flower) { m.sphere([0, s * 0.5, s * 1.36], s * 0.1, flower, { segs: 5 }); m.sphere([0, -s * 0.5, s * 1.14], s * 0.09, flower, { segs: 5 }); }
}
