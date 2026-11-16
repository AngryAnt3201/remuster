// Brasswick's palette and the parts its units share: hats, goggles, boilers, pipes, gears, steam, gaslight.
import { Model, gearOutline, mat, ringOutline, team, type Material, type V3 } from "../../../artkit/toon3d";
import type { Pose } from "../../../artkit/rig";

/** The city's materials. Team colour goes on coats, sashes and painted plate; brass and soot are shared. */
export const P = {
  brass: mat("#e0a83f", { metal: 0.8 }),
  brassDk: mat("#a56f24", { metal: 0.5 }),
  copper: mat("#cf7440", { metal: 0.7 }),
  copperDk: mat("#8f4526", { metal: 0.4 }),
  iron: mat("#69707e", { metal: 0.45 }),
  ironDk: mat("#3b404b", { metal: 0.3 }),
  steel: mat("#cfd6de", { metal: 0.85 }),
  soot: mat("#2c2729"),
  leather: mat("#8d5833"),
  leatherDk: mat("#5a3620"),
  cloth: mat("#eadcc0"),
  clothDk: mat("#a8946e"),
  wool: mat("#4a4652"),
  wood: mat("#80573a"),
  woodDk: mat("#553823"),
  skin: mat("#f1c49c"),
  skinDk: mat("#c98f68"),
  hair: mat("#5b3b28"),
  white: mat("#f6f1e6"),
  red: mat("#c9412f"),
  glass: mat("#9fe3ea", { metal: 1, shade: 0.4 }),
  /** Gaslight: lamps, furnace mouths, fuses. */
  lamp: mat("#ffd27a", { emit: 1, glow: 0.9, ink: false }),
  fire: mat("#ff8a3c", { emit: 1, glow: 0.8, ink: false }),
  fireHot: mat("#fff0b8", { emit: 1, glow: 0.6, ink: false }),
  /** Tesla blue: coils, arcs, charged glass. */
  arc: mat("#bfeaff", { emit: 1, glow: 1, ink: false }),
  arcCore: mat("#ffffff", { emit: 1, glow: 0.5, ink: false }),
  frost: mat("#d9f4ff", { emit: 0.6, glow: 0.5 }),
  venom: mat("#9be36a", { emit: 0.7, glow: 0.6 }),
  steam: mat("#f7f3ea", { emit: 0.85, ink: false, alpha: 0.82, shade: 0.5 }),
  smoke: mat("#5d575c", { emit: 0.5, ink: false, alpha: 0.8, shade: 0.5 }),
  // team colour
  team: team("main"),
  teamDk: team("dark"),
  teamLt: team("light"),
  /** Ascended: team-coloured aether that glows. */
  aether: team("light", { emit: 0.9, glow: 1 }),
  aetherInk: team("light", { emit: 0.8, glow: 0.8, ink: false }),
};

/** Trim metal by rank: iron, brass, polished brass, then gold that the Ascended light catches. */
export const trim = (tier: number): Material => (tier >= 4 ? GOLD : tier === 3 ? P.brass : tier === 2 ? P.brassDk : P.iron);
export const GOLD = mat("#ffd45e", { metal: 1 });
/** The glowing part on Ascended units, plain lamp glass below that. */
export const core = (tier: number, lower: Material = P.glass): Material => (tier >= 4 ? P.aether : lower);

/** A top hat on a head of radius r (call inside the head frame). */
export function topHat(m: Model, r: number, h = 0.2, body: Material = P.soot, band: Material = P.team, tilt = -6) {
  m.with(() => {
    m.move(-r * 0.05, 0, r * 0.62).rotY(tilt);
    m.group(() => {
      m.cylinder([0, 0, 0], [0, 0, r * 0.1], r * 1.22, body);
      m.cylinder([0, 0, r * 0.08], [0, 0, h], r * 0.74, body, r * 0.8);
    });
    m.cylinder([0, 0, r * 0.1], [0, 0, r * 0.3], r * 0.77, band);
  });
}
/** A bowler: round crown, curled brim. */
export function bowler(m: Model, r: number, body: Material = P.soot, band: Material = P.team) {
  m.with(() => {
    m.move(-r * 0.05, 0, r * 0.55).rotY(-6);
    m.group(() => {
      m.cylinder([0, 0, 0], [0, 0, r * 0.1], r * 1.2, body);
      m.ellipsoid([0, 0, r * 0.12], [r * 0.82, r * 0.82, r * 0.7], body);
    });
    m.cylinder([0, 0, r * 0.1], [0, 0, r * 0.26], r * 0.86, band);
  });
}
/** A flat cap with a peak. */
export function flatCap(m: Model, r: number, body: Material = P.wool) {
  m.with(() => {
    m.move(-r * 0.08, 0, r * 0.66).rotY(10);
    m.group(() => {
      m.ellipsoid([0, 0, 0], [r * 0.92, r * 0.95, r * 0.36], body);
      m.ellipsoid([r * 0.72, 0, -r * 0.1], [r * 0.5, r * 0.62, r * 0.1], body);
    });
  });
}
/** A riveted helmet dome with a brim (stovepipe plume optional by the builder). */
export function helmet(m: Model, r: number, body: Material, brim: Material = body) {
  m.with(() => {
    m.move(0, 0, r * 0.18);
    m.group(() => {
      m.ellipsoid([0, 0, 0.0], [r * 1.1, r * 1.1, r * 1.0], body);
    });
    m.cylinder([0, 0, -r * 0.05], [0, 0, r * 0.1], r * 1.2, brim);
  });
}
/** Brass goggles: on the eyes (`up` = 0) or pushed up on the brow (`up` = 1). Call inside the head frame. */
export function goggles(m: Model, r: number, lens: Material = P.glass, rim: Material = P.brass, up = 0) {
  m.with(() => {
    m.rotY(-up * 38);
    m.group(() => { m.torus([0, 0, r * 0.08], [0, 0, 1], r * 1.0, r * 0.07, P.leatherDk, { segs: 14 }); });
    for (const s of [1, -1]) {
      m.cylinder([r * 0.78, s * r * 0.4, r * 0.08], [r * 1.06, s * r * 0.44, r * 0.08], r * 0.3, rim, r * 0.27, { segs: 10 });
      m.decal(0.03, () => m.cylinder([r * 1.04, s * r * 0.44, r * 0.08], [r * 1.085, s * r * 0.445, r * 0.08], r * 0.2, lens, r * 0.2, { segs: 10 }));
    }
  });
}
/** A moustache: the Brasswick gentleman's badge. */
export function moustache(m: Model, r: number, col: Material = P.hair) {
  m.decal(0.02, () => m.group(() => {
    for (const s of [1, -1]) m.capsule([r * 0.93, s * r * 0.05, -r * 0.3], [r * 0.82, s * r * 0.46, -r * 0.38], r * 0.11, col, r * 0.05, { segs: 6 });
  }));
}
/** A flat gear in the local x-z plane (axis along y), turned by `spin` degrees. */
export function gear(m: Model, r: number, thick: number, col: Material, teeth = 8, spin = 0, hub: Material | null = P.ironDk) {
  m.extrude(gearOutline(teeth, r * 0.78, r, spin * (Math.PI / 180)), thick, col);
  if (hub) m.cylinder([0, -thick * 0.7, 0], [0, thick * 0.7, 0], r * 0.3, hub, r * 0.3, { segs: 8 });
}
/** A boiler tank standing on z: riveted bands, a domed top. Centre of its base at the origin. */
export function boiler(m: Model, r: number, h: number, body: Material = P.copper, band: Material = P.brass) {
  m.group(() => {
    m.cylinder([0, 0, 0], [0, 0, h], r, body);
    m.ellipsoid([0, 0, h], [r, r, r * 0.55], body);
  });
  m.cylinder([0, 0, h * 0.18], [0, 0, h * 0.3], r * 1.06, band);
  m.cylinder([0, 0, h * 0.78], [0, 0, h * 0.9], r * 1.06, band);
}
/** A chimney stack along +z with a flared lip. */
export function stack(m: Model, r: number, h: number, col: Material = P.ironDk, lip: Material = P.brass) {
  m.cylinder([0, 0, 0], [0, 0, h], r, col, r * 0.85);
  m.cylinder([0, 0, h * 0.86], [0, 0, h], r * 1.15, lip, r * 1.15);
}
/** A puff of steam or smoke: a little cluster of soft balls. `k` 0..1 grows and thins it as it ages. */
export function puff(m: Model, at: V3, size: number, k = 0, col: Material = P.steam, seed = 1) {
  const n = 3;
  m.group(() => {
    for (let i = 0; i < n; i++) {
      const a = seed * 2.4 + i * 2.1, s = size * (0.55 + 0.2 * ((i * 7 + seed) % 3)) * (0.7 + 0.6 * k);
      m.sphere([at[0] + Math.cos(a) * size * 0.45 * (0.6 + k), at[1] + Math.sin(a) * size * 0.45 * (0.6 + k), at[2] + i * size * 0.32 * (0.5 + k)], s, col, { segs: 8 });
    }
  });
}
/** Steam drifting up from a vent through an idle or walk loop: each puff rises, swells and is gone as the loop turns. */
export function vent(m: Model, p: Pose, at: V3, size = 0.06, col: Material = P.steam, phase = 0) {
  if (p.anim === "death" && p.i > 2) return;
  const k = (((p.i / p.n + phase) % 1) + 1) % 1;
  puff(m, [at[0] - 0.03 * k, at[1], at[2] + 0.14 * k], size * (0.6 + 0.7 * k) * (k > 0.8 ? (1 - k) * 5 : 1), k, col, Math.round(phase * 7) + 1);
}
/** A muzzle flash: a hot star with a ring of spikes, pointing along local +x. */
export function flash(m: Model, at: V3, size: number, col: Material = P.fire, hot: Material = P.fireHot) {
  m.with(() => {
    m.move(at[0], at[1], at[2]);
    m.group(() => {
      m.cone([0, 0, 0], [size * 2.1, 0, 0], size * 0.55, col, { segs: 8 });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; m.cone([0, 0, 0], [size * 0.5, Math.cos(a) * size * 1.25, Math.sin(a) * size * 1.25], size * 0.3, col, { segs: 6 }); }
    });
    m.decal(0.05, () => m.sphere([size * 0.25, 0, 0], size * 0.5, hot, { segs: 8 }));
  });
}
/** A jagged electric arc between two points. */
export function arcBolt(m: Model, a: V3, b: V3, r: number, seed = 1, col: Material = P.arc) {
  const n = 5, pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = i === 0 || i === n ? 0 : 1;
    const o1 = Math.sin(seed * 12.9 + i * 78.2) * 0.5, o2 = Math.sin(seed * 39.3 + i * 11.1) * 0.5;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    pts.push([a[0] + (b[0] - a[0]) * t + j * o1 * len * 0.2, a[1] + (b[1] - a[1]) * t + j * o2 * len * 0.2, a[2] + (b[2] - a[2]) * t + j * o1 * len * 0.18]);
  }
  m.tube(pts, r, col, { segs: 5 });
}
/** A row of rivets along a path. */
export function rivets(m: Model, pts: V3[], r = 0.014, col: Material = P.brass) {
  m.decal(0.01, () => m.group(() => { for (const p of pts) m.sphere(p, r, col, { segs: 6 }); }));
}
/** A gaslight lantern hanging from the origin: cage, glowing glass. */
export function lantern(m: Model, size: number, glow: Material = P.lamp, cage: Material = P.brassDk) {
  m.group(() => {
    m.cylinder([0, 0, 0], [0, 0, -size * 0.25], size * 0.5, cage, size * 0.62, { segs: 8 });
    m.cylinder([0, 0, -size * 1.25], [0, 0, -size * 1.45], size * 0.6, cage, size * 0.45, { segs: 8 });
  });
  m.cylinder([0, 0, -size * 0.25], [0, 0, -size * 1.25], size * 0.5, glow, size * 0.5, { segs: 8 });
}
/** A pressure dial: brass ring, white face, a needle. On a surface facing local +x. */
export function dial(m: Model, r: number, needle = 30) {
  m.cylinder([0, 0, 0], [r * 0.3, 0, 0], r, P.brass, r, { segs: 10 });
  m.decal(0.02, () => {
    m.cylinder([r * 0.3, 0, 0], [r * 0.34, 0, 0], r * 0.76, P.white, r * 0.76, { segs: 10 });
    m.with(() => { m.move(r * 0.36, 0, 0).rotX(needle); m.box([0, 0, r * 0.3], [r * 0.05, r * 0.12, r * 0.6], P.red); });
  });
}
/** A round window ring. */
export const porthole = (m: Model, r: number, glass: Material = P.lamp) => {
  m.cylinder([0, 0, 0], [r * 0.3, 0, 0], r, P.brass, r, { segs: 10 });
  m.decal(0.02, () => m.cylinder([r * 0.3, 0, 0], [r * 0.36, 0, 0], r * 0.7, glass, r * 0.7, { segs: 10 }));
};
export { ringOutline };
