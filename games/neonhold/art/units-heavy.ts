// Neonhold's hardware: emplacements, bugs, the mech, and the things people ride.
import { crawler, flyer, gripAim, humanoid, quadruped, structure, type Pose, type UnitDef } from "../../../artkit/rig";
import { Model, norm, type V3 } from "../../../artkit/toon3d";
import { P, arcBolt, core, crew, flash, halo, helm, pads, puff, shaft, trim, wheel } from "./parts";
import { pistol } from "./units-crew";

/** Prox Mine: a hex puck with prongs and one lamp that blinks. It jumps when it goes. */
export const mine: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0, collapse: 0.6 });
    const jump = p.mix(0, 0.16, { wind: -0.02 });
    m.at(s.base, () => {
      m.move(0, 0, jump);
      m.cylinder([0, 0, 0], [0, 0, 0.07], 0.2 + 0.008 * t, P.armorDk, 0.18, { segs: 6 });
      m.decal(0.01, () => m.cylinder([0, 0, 0.07], [0, 0, 0.085], 0.15 + 0.008 * t, P.team, 0.15, { segs: 6 }));
      const n = 6;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; m.cone([Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.05], [Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0.12 + 0.01 * t], 0.026, trim(Math.max(2, t)), { segs: 5 }); }
      const on = p.is("idle") ? p.i % 3 === 0 : true;
      m.sphere([0, 0, 0.12], 0.05, on ? (t >= 4 ? P.aether : P.red) : P.dead, { segs: 8 });
      if (p.hit) { m.sphere([0, 0, 0.1], 0.3, P.plasma, { segs: 10 }); m.sphere([0, 0, 0.12], 0.19, P.hot, { segs: 8 }); }
    });
  },
};

/** Railgun: two long rails on a turntable, capacitors at the breech. The slug goes through a whole line. */
export const ballista: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.1 });
    m.at(s.base, () => {
      m.cylinder([0, 0, 0], [0, 0, 0.07], 0.36, P.armorDk, 0.33, { segs: 8 });
      m.decal(0.01, () => m.cylinder([0, 0, 0.07], [0, 0, 0.09], 0.3, P.team, 0.3, { segs: 8 }));
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; m.tube([[Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.03], [Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.3]], 0.03, P.steel, { segs: 6 }); }
      m.cylinder([0, 0, 0.26], [0, 0, 0.34], 0.1, trim(t), 0.1, { segs: 10 });
    });
    m.at(s.top, () => {
      m.move(0, 0, 0.4).rotY(-8 + p.mix(0, 0, { wind: -6 }));
      const L = 0.56 + 0.03 * t, charge = p.blend < 0 ? -p.blend : 0;
      m.box([-0.12, 0, 0], [0.3, 0.2, 0.17], P.armorDk);
      m.decal(0.02, () => m.box([-0.12, 0, 0.087], [0.22, 0.12, 0.01], P.team));
      for (const sd of [1, -1]) m.box([L / 2, sd * 0.055, 0], [L, 0.035, 0.07], t >= 3 ? P.gold : P.chrome);
      m.decal(0.01, () => m.box([L / 2, 0, 0], [L - 0.04, 0.07, 0.02], charge > 0.5 || p.hit ? P.arc : t >= 4 ? P.aether : P.magenta));
      for (const sd of [1, -1]) m.cylinder([-0.2, sd * 0.13, -0.02], [-0.02, sd * 0.13, -0.02], 0.045, P.violet, 0.045, { segs: 8 });
      if (t >= 2) m.box([0.0, 0, 0.12], [0.16, 0.04, 0.05], P.black);
      if (!p.after && !(p.is("death") && p.i > 1)) m.cone([L - 0.04, 0, 0], [L + 0.14, 0, 0], 0.035, P.white, { segs: 6 });
      if (charge > 0.5) arcBolt(m, [0.1, 0.05, 0.04], [L - 0.1, -0.05, 0.04], 0.008, p.i);
      if (p.hit) flash(m, [L + 0.03, 0, 0], 0.11, P.arc);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.3], 0.15, p.dead, P.smoke, 3);
  },
};

/** Thumper: a fat mortar tube pointing at the sky, ringed with light. Shells stacked beside it. */
export const bombard: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.05 });
    m.at(s.base, () => {
      m.cylinder([0, 0, 0], [0, 0, 0.1], 0.38, P.armorDk, 0.35, { segs: 8 });
      m.decal(0.01, () => m.cylinder([0, 0, 0.1], [0, 0, 0.12], 0.33, P.team, 0.33, { segs: 8 }));
      for (const sd of [1, -1]) m.box([-0.02, sd * 0.22, 0.22], [0.2, 0.05, 0.26], trim(Math.max(1, t)));
      m.group(() => { for (const [x, y] of [[0.26, 0.2], [0.3, 0.08], [0.2, 0.28]].slice(0, 1 + Math.min(2, t - 1))) { m.cylinder([x, y, 0.1], [x, y, 0.2], 0.05, P.steel, 0.05, { segs: 8 }); m.sphere([x, y, 0.2], 0.05, t >= 4 ? P.aether : P.laser, { segs: 8 }); } });
    });
    m.at(s.top, () => {
      m.move(-0.02, 0, 0.22).rotY(-58 + p.mix(0, 0, { wind: 5 }));
      const L = (0.36 + 0.025 * t) * (p.hit ? 0.88 : 1), r = 0.16 + 0.006 * t;
      m.group(() => { m.sphere([0, 0, 0], r * 1.08, P.armorDk); m.cylinder([0, 0, 0], [L, 0, 0], r, P.armor, r * 0.94, { segs: 12 }); });
      for (const k of [0.3, 0.62, 0.94]) m.decal(0.01, () => m.cylinder([L * k - 0.02, 0, 0], [L * k + 0.02, 0, 0], r * 1.03, k > 0.9 ? trim(Math.max(2, t)) : k > 0.5 ? P.team : P.magenta, r * 1.01, { segs: 12 }));
      m.decal(0.01, () => m.cylinder([L - 0.01, 0, 0], [L + 0.005, 0, 0], r * 0.72, p.blend < 0 ? P.plasma : P.dead, r * 0.72, { segs: 12 }));
      if (t >= 4) m.torus([L * 0.46, 0, 0], [1, 0, 0], r * 1.1, 0.02, P.aether, { segs: 12 });
      if (p.hit) flash(m, [L + 0.02, 0, 0], 0.15);
      if (p.after) puff(m, [L + 0.22 + (p.hit ? 0 : 0.1), 0, 0], 0.15, p.hit ? 0.2 : 0.7, P.smoke, 2);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.3], 0.16, p.dead, P.smoke, 3);
  },
};

/** Sentry: the Rigger's field gun. A little twin-barrel on a tripod with one red eye. */
export const turret: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const s = structure(m, p, { recoil: 0.04 });
    m.at(s.base, () => {
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 1; m.tube([[Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.02], [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.26]], 0.024, P.steel, { segs: 6 }); }
      m.cylinder([0, 0, 0.24], [0, 0, 0.3], 0.07, P.armorDk, 0.07, { segs: 8 });
    });
    m.at(s.top, () => {
      m.move(0, 0, 0.35);
      m.box([-0.02, 0, 0], [0.22, 0.16, 0.13], P.team);
      for (const sd of [1, -1]) m.cylinder([0.06, sd * 0.045, 0], [0.32, sd * 0.045, 0], 0.022, P.chrome, 0.022, { segs: 6 });
      m.decal(0.02, () => m.sphere([0.09, 0, 0.05], 0.035, p.is("death") && p.i > 2 ? P.dead : P.red, { segs: 6 }));
      m.box([-0.06, 0, 0.1], [0.1, 0.1, 0.07], P.armorDk);
      if (p.hit) flash(m, [0.34, (p.i % 2 ? 1 : -1) * 0.045, 0], 0.06);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.25], 0.1, p.dead, P.smoke, 3);
  },
};

/** Bitbug: a palm-sized spider drone: a dark dome, a team shell, one red eye. */
export const mite: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = crawler(m, p, { height: 0.12, length: 0.13, width: 0.085, leg: P.steel, legR: 0.02, stride: 0.17 });
    m.at(c.body, () => {
      m.ellipsoid([0, 0, 0.02], [0.13, 0.1, 0.075], P.armorDk);
      m.decal(0.01, () => m.ellipsoid([-0.03, 0, 0.04], [0.085, 0.085, 0.065], P.team));
      m.decal(0.02, () => m.sphere([0.115, 0, 0.03], 0.035, p.is("death") && p.i > 2 ? P.dead : P.red, { segs: 6 }));
      m.cylinder([-0.06, 0, 0.08], [-0.1, 0, 0.2], 0.008, P.chrome, 0.006, { segs: 4 });
      for (const s of [1, -1]) m.cone([0.11, s * 0.04, -0.01], [0.19 + 0.03 * Math.max(0, p.blend), s * 0.02, -0.03], 0.018, P.chrome, { segs: 5 });
    });
  },
};

/** Hubbug: the big spider drone: a relay dish on its back, a team carapace, twin red eyes. */
export const queen: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = crawler(m, p, { height: 0.2, length: 0.22, width: 0.12, legs: 4, leg: P.steel, foot: P.chrome, legR: 0.028, stride: 0.28, splay: 2.3 });
    m.at(c.body, () => {
      m.group(() => { m.ellipsoid([-0.12, 0, 0.06], [0.2, 0.16, 0.13], P.armorDk); m.sphere([0.12, 0, 0.02], 0.11, P.armor); });
      m.decal(0.01, () => m.ellipsoid([-0.12, 0, 0.1], [0.15, 0.14, 0.1], P.team));
      m.decal(0.02, () => { for (const s of [1, -1]) m.sphere([0.21, s * 0.05, 0.05], 0.035, p.is("death") && p.i > 2 ? P.dead : P.red, { segs: 6 }); });
      m.with(() => { m.move(-0.14, 0, 0.19); m.cylinder([0, 0, 0], [0, 0, 0.1], 0.015, P.chrome, 0.015, { segs: 5 }); m.move(0, 0, 0.12).rotY(-30).rotZ(p.i * 30); m.cone([0, 0, 0.02], [0, 0, -0.05], 0.1, P.chrome, { segs: 10 }); m.sphere([0, 0, 0.05], 0.025, P.magenta, { segs: 5 }); });
      for (const s of [1, -1]) m.tube([[0.2, s * 0.06, -0.02], [0.3, s * 0.08, -0.03], [0.34 + 0.04 * Math.max(0, p.blend), s * 0.03, -0.07]], [0.025, 0.02, 0.006], P.chrome, { segs: 5 });
    });
  },
};

/** Twin Rig: a loader mech bolted together from two halves, a seam of team light between them. The slow giant. */
function rig(m: Model, p: Pose, size: number, tier: number, half = false) {
  const R = p.mix<V3>([0.06, 0.32, 0.2], [0.36, 0.16, 0.12], { wind: [0.0, 0.27, 0.8] });
  const L = p.mix<V3>([0.06, -0.32, 0.2], [0.36, -0.16, 0.12], { wind: [0.0, -0.27, 0.8] });
  const h = humanoid(m, p, { size, bulk: 1.25, leg: half ? 1.15 : 1.5, weight: "heavy", skin: P.armorDk, torso: P.armor, legs: P.armorDk, boots: P.black, arms: P.armorDk, hands: P.black, handR: R, handL: half ? undefined : L, noHead: true, noTorso: true, noFace: true, lunge: 0.7, stride: 0.34, lean: 3 });
  m.at(h.hips, () => m.box([0, 0, 0], [0.2, 0.3, 0.12], P.black));
  m.at(h.chest, () => {
    // two half-hulls and the seam between them
    for (const s of half ? [1] : [1, -1]) {
      m.box([0, s * 0.125, 0.06], [0.34, 0.2, 0.38], P.armor);
      m.decal(0.015, () => m.box([0.02, s * 0.13, 0.2], [0.26, 0.16, 0.1], P.team));
      m.box([-0.02, s * 0.3, 0.2], [0.26, 0.17, 0.17], P.team); // shoulder block
      m.decal(0.02, () => m.box([-0.02, s * 0.3, 0.29], [0.18, 0.1, 0.012], trim(Math.max(2, tier))));
      if (tier >= 2) m.decal(0.02, () => m.box([0.172, s * 0.125, -0.04], [0.01, 0.14, 0.05], trim(tier)));
      if (tier >= 3 && !half) m.cylinder([-0.14, s * 0.15, 0.24], [-0.16, s * 0.15, 0.46 + 0.03 * tier], 0.04, P.black, 0.045, { segs: 8 });
    }
    m.decal(0.01, () => m.box([0, half ? 0.02 : 0, 0.06], [0.35, 0.035, 0.39], p.is("death") && p.i > 2 ? P.dead : tier >= 4 ? P.aether : P.teamGlow));
    if (half) m.decal(0.02, () => m.group(() => { for (let i = 0; i < 3; i++) m.cone([0.1 - i * 0.1, 0.0, 0.1 - i * 0.05], [0.12 - i * 0.1, -0.1, 0.16 - i * 0.07], 0.03, P.chrome, { segs: 4 }); }));
    // the cab: a canopy of glass over the seam
    m.ellipsoid([0.1, half ? 0.1 : 0, 0.27], [0.13, half ? 0.09 : 0.12, 0.1], P.glass, { segs: 10 });
    m.decal(0.03, () => m.box([0.225, half ? 0.1 : 0, 0.26], [0.02, half ? 0.1 : 0.16, 0.035], p.is("death") && p.i > 2 ? P.dead : tier >= 4 ? P.aether : P.lamp));
  });
  // great block fists
  for (const ph of half ? [h.pR] : [h.pR, h.pL]) m.box(ph, [0.2 * size, 0.2 * size, 0.2 * size], tier >= 3 && !half ? P.gold : P.steel);
  if (p.hit) for (const ph of half ? [h.pR] : [h.pR, h.pL]) puff(m, [ph[0] + 0.05, ph[1], 0.05], 0.07 * size, 0.3, P.hot, 2);
}
export const golem: UnitDef = { weight: "heavy", build: (m, p) => rig(m, p, 1.3, p.tier) };
/** Half Rig: one half of a fallen Twin Rig, still walking: one arm, a torn seam. */
export const golemling: UnitDef = { weight: "heavy", build: (m, p) => rig(m, p, 0.95, 1, true) };

/** Ramrider: an armoured rider on a heavy bike, a shock lance levelled for the charge. */
export const lancer: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier, Rw = 0.17;
    const q = quadruped(m, p, { noLegs: true, legs: P.steel, hooves: P.steel, height: 0.27, stride: 0.62, weight: "heavy" });
    const spin = p.is("walk") ? -q.spin * (0.62 / (2 * Math.PI * Rw)) : 0;
    m.at(q.body, () => {
      for (const x of [0.3, -0.3]) m.with(() => { m.move(x, 0, Rw - 0.27).rotY(spin); wheel(m, Rw, 0.11, core(t)); });
      m.box([0, 0, -0.02], [0.5, 0.13, 0.14], P.armorDk);
      m.ellipsoid([0.06, 0, 0.08], [0.2, 0.1, 0.08], P.team);
      m.extrude([[0.18, -0.06], [0.44, -0.02], [0.4, 0.14], [0.24, 0.2]], 0.2, P.team);
      m.decal(0.03, () => m.box([0.435, 0, 0.05], [0.02, 0.12, 0.05], p.is("death") && p.i > 2 ? P.dead : P.lamp));
      m.tube([[0.28, -0.16, 0.2], [0.26, 0, 0.17], [0.28, 0.16, 0.2]], 0.014, trim(Math.max(1, t)), { segs: 5 });
      for (const s of [1, -1]) { m.cylinder([-0.1, s * 0.09, -0.04], [-0.4, s * 0.1, 0.0], 0.03, trim(Math.max(2, t)), 0.035, { segs: 6 }); if (p.is("walk") || p.blend > 0) m.cone([-0.4, s * 0.1, 0.0], [-0.52, s * 0.1, 0.01], 0.03, P.plasma, { segs: 5 }); }
      if (t >= 3) m.box([-0.3, 0, 0.1], [0.14, 0.2, 0.08], P.armorDk);
    });
    m.at(q.saddle, () => {
      m.move(-0.06, 0, -0.02);
      const R = p.mix<V3>([0.1, 0.2, 0.36], [0.3, 0.16, 0.36], { wind: [-0.02, 0.22, 0.4] });
      const h = crew(m, p, { seated: true, size: 0.86, torso: P.armor, arms: P.team, legs: P.armorDk, handR: R, handL: [0.24, -0.1, 0.32], lunge: 0 });
      m.at(h.chest, () => { pads(m, trim(Math.max(2, t)), 0.07); m.decal(0.02, () => m.box([-0.14, 0, 0.03], [0.05, 0.22, 0.2], P.team)); });
      m.at(h.head, () => { helm(m, 0.19, P.armor, core(t), P.team); halo(m, p, 0.19, 0.5); });
      m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.5], [1, -0.06, 0.02], { wind: [1, 0, 0.3] }))), () => {
        const L = 0.8 + 0.05 * t;
        shaft(m, 0.3, L, 0.02, P.steel);
        m.cone([L, 0, 0], [L + 0.2, 0, 0], 0.04, t >= 4 ? P.aether : P.teamLt, { segs: 6 });
        m.cone([0.02, 0, 0], [0.16, 0, 0], 0.07, trim(Math.max(2, t)), { segs: 8 });
        m.decal(0.01, () => m.box([L - 0.14, 0, 0], [0.2, 0.05, 0.05], P.team));
        if (p.hit) { arcBolt(m, [L + 0.2, 0, 0], [L + 0.5, 0.1, 0.06], 0.016, 3); arcBolt(m, [L + 0.2, 0, 0], [L + 0.45, -0.12, -0.04], 0.012, 5); }
      });
    });
  },
};

/** Skimmer: a hoverbike rider with a machine pistol. Circles the fight on a cushion of team light. */
export const outrider: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { noLegs: true, legs: P.steel, hooves: P.steel, height: 0.3, stride: 0.58, weight: "mid", lunge: 0.3 });
    const hover = p.is("death") ? -0.2 * p.dead : 0.02 * p.wave(1, 1);
    m.at(q.body, () => {
      m.move(0, 0, hover);
      m.group(() => { m.ellipsoid([0, 0, 0], [0.36, 0.1, 0.075], P.armorDk); m.cone([0.3, 0, 0], [0.4, 0, -0.01], 0.07, trim(Math.max(2, t)), { segs: 8 }); });
      m.decal(0.015, () => m.ellipsoid([0.06, 0, 0.03], [0.24, 0.085, 0.055], P.team));
      // lift pads: discs of team light under the hull
      for (const x of [0.22, -0.22]) { m.cylinder([x, 0, -0.07], [x, 0, -0.1], 0.1, P.black, 0.12, { segs: 10 }); if (!(p.is("death") && p.i > 2)) m.decal(0.02, () => m.cylinder([x, 0, -0.1], [x, 0, -0.105], 0.095, t >= 4 ? P.aether : P.teamGlow, 0.095, { segs: 10 })); }
      m.extrude([[-0.2, 0.0], [-0.44, 0.06], [-0.48, 0.16], [-0.36, 0.04]], 0.014, P.team);
      for (const s of [1, -1]) m.poly([[-0.1, s * 0.09, 0], [-0.34, s * 0.26, 0.02], [-0.4, s * 0.24, 0.02], [-0.3, s * 0.08, 0]], P.team);
      m.tube([[0.22, -0.15, 0.14], [0.2, 0, 0.1], [0.22, 0.15, 0.14]], 0.014, P.chrome, { segs: 5 });
      if (p.is("walk")) m.cone([-0.36, 0, 0], [-0.52, 0, 0], 0.04, P.plasma, { segs: 5 });
      if (t >= 3) m.box([-0.24, 0, 0.07], [0.12, 0.12, 0.06], P.armorDk);
    });
    m.at(q.saddle, () => {
      m.move(-0.08, 0, hover - 0.06);
      const Rh = p.mix<V3>([0.12, 0.16, 0.36], [0.16, 0.14, 0.46], { wind: [0.06, 0.16, 0.44] });
      const Lh = p.mix<V3>([0.26, -0.1, 0.36], [0.34, -0.02, 0.5], { wind: [0.24, -0.04, 0.52] });
      const h = crew(m, p, { seated: true, size: 0.84, torso: P.team, arms: P.team, legs: P.suit, handR: Rh, handL: Lh, recoil: 0.03, lunge: 0 });
      m.at(h.head, () => {
        helm(m, 0.19, P.armor, core(t));
        m.capsule([-0.12, 0, -0.02], [-0.34, 0.04 * p.wave(1, 2), 0.04 + 0.03 * p.wave(1, 2, 0.3)], 0.04, P.teamLt, 0.02, { segs: 6 });
        halo(m, p, 0.19, 0.44);
      });
      m.at(gripAim(h.pR, h.pL), () => { pistol(m, t, 0.3); if (p.hit) flash(m, [0.36, 0, 0.02], 0.06); });
    });
  },
};

/** Jetlance: a jet-pack trooper on wings of hard light, a lance held low. Drops on the back line like a shell. */
export const griffin: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.2, lunge: 1.3 });
    m.at(f.body, () => {
      m.rotY(22);
      m.move(0, 0, -0.34);
      const R = p.mix<V3>([0.16, 0.2, 0.4], [0.3, 0.16, 0.36], { wind: [0.0, 0.22, 0.46] });
      const h = crew(m, p, { seated: true, size: 1.05, bulk: 1.1, torso: P.armor, arms: P.team, legs: P.team, handR: R, handL: [0.14, -0.24, 0.36], lunge: 0 });
      m.at(h.chest, () => { pads(m, trim(Math.max(2, t)), 0.085, 1.1); m.decal(0.02, () => m.torus([0, 0, -0.06], [0, 0, 1], 0.185, 0.03, P.team, { segs: 12 })); });
      m.at(h.head, () => { helm(m, 0.19, P.armor, core(t), P.team); halo(m, p, 0.19, 0.5); });
      m.at(h.back, () => {
        for (const s of [1, -1]) m.with(() => {
          m.move(0.06, s * 0.11, -0.12);
          m.group(() => { m.cylinder([0, 0, 0], [0, 0, 0.3 + 0.02 * t], 0.085, P.armorDk, 0.085, { segs: 10 }); m.sphere([0, 0, 0.3 + 0.02 * t], 0.085, P.armorDk, { segs: 10 }); });
          m.decal(0.01, () => m.cylinder([0, 0, 0.12], [0, 0, 0.18], 0.088, trim(Math.max(2, t)), 0.088, { segs: 10 }));
          const fl = 0.16 + 0.07 * Math.abs(f.flap) + (p.blend > 0 ? 0.12 : 0);
          if (!(p.is("death") && p.i > 1)) { m.cone([0, 0, 0], [0, 0, -0.04 - fl], 0.065, P.plasma, { segs: 7 }); m.cone([0, 0, 0], [0, 0, -0.03 - fl * 0.55], 0.035, P.hot, { segs: 6 }); }
          // a wing of hard light
          m.with(() => { m.move(0.0, s * 0.08, 0.22).rotX(-s * (14 + 16 * f.flap)); const sp = 0.52 + 0.04 * t; m.poly([[0.1, 0, 0], [0.14, s * sp * 0.6, 0.02], [0.02, s * sp, 0.03], [-0.2, s * sp * 0.85, 0], [-0.3, s * sp * 0.4, -0.02], [-0.16, 0, -0.02]], P.holo); m.tube([[0.1, 0, 0.006], [0.14, s * sp * 0.6, 0.026], [0.02, s * sp, 0.036]], 0.018, t >= 4 ? P.aether : P.teamLt, { segs: 5 }); });
        });
      });
      m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.3], [1, 0, -0.5], { wind: [0.7, 0, 0.7] }))), () => {
        const L = 0.62 + 0.04 * t;
        shaft(m, 0.24, L, 0.02, P.steel);
        m.cone([L, 0, 0], [L + 0.18, 0, 0], 0.04, t >= 4 ? P.aether : P.teamLt, { segs: 6 });
        m.cone([0.02, 0, 0], [0.14, 0, 0], 0.06, trim(Math.max(2, t)), { segs: 8 });
        if (p.hit) flash(m, [L + 0.18, 0, 0], 0.07, P.arc);
      });
      if (p.is("death")) puff(m, [-0.2, 0, 0.5], 0.12, p.dead, P.smoke, 4);
    });
  },
};
