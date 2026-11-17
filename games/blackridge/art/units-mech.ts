// Blackridge's armour, aircraft, emplacements and robots.
import { crawler, flyer, structure, type Pose, type UnitDef } from "../../../artkit/rig";
import { Model, type Material, type V3 } from "../../../artkit/toon3d";
import { vehicle } from "./body";
import { P, antenna, burn, flash, helmet, puff, ring, track, trooper, wheel } from "./parts";

// ------------------------------------------------------------------------------------------------ armour
/** A tank facing +x, built at scale 1 for a hull about 1.1 long: tracks, a sloped hull, a turret with a long gun
 *  that slides back on `kick`. `crewed` gives it hatches, stowage and a commander's sight. */
function tank(m: Model, p: Pose, o: { spin: number; kick: number; wreck: number; crewed: boolean; hull: Material; dark: Material }) {
  const t = p.tier, w = o.wreck;
  for (const s of [1, -1]) track(m, [0, s * 0.27, 0.11], 1.06, 0.21, 0.15, o.spin);
  m.group(() => {
    m.extrude([[-0.53, 0.1], [0.45, 0.1], [0.57, 0.2], [0.4, 0.31], [-0.52, 0.31]], 0.42, o.hull);
    for (const s of [1, -1]) m.box([0, s * 0.27, 0.225], [1.08, 0.17, 0.02], o.dark);
    m.box([-0.46, 0, 0.33], [0.14, 0.4, 0.07], o.dark);
  });
  // side skirts with the side's stripe
  for (const s of [1, -1]) { m.box([0.02, s * 0.352, 0.16], [0.86, 0.012, 0.13], o.dark); m.decal(0.01, () => m.box([-0.12, s * 0.36, 0.17], [0.3, 0.012, 0.06], P.team)); }
  if (t >= 2) for (const s of [1, -1]) m.decal(0.012, () => { for (const x of [-0.38, 0.2, 0.36]) m.box([x, s * 0.362, 0.16], [0.1, 0.012, 0.1], P.armorLt); });
  // turret: knocked askew when the tank is a wreck
  m.with(() => {
    m.move(-0.03 - 0.03 * w, 0.03 * w, 0.31 + 0.02 * w).rotZ(24 * w).rotX(7 * w);
    m.group(() => {
      m.extrude([[-0.3, 0], [0.2, 0], [0.31, 0.07], [0.19, 0.16], [-0.28, 0.16]], 0.4, o.hull);
      m.box([-0.33, 0, 0.08], [0.1, 0.34, 0.11], o.dark);
    });
    m.decal(0.012, () => m.box([-0.1, 0, 0.165], [0.22, 0.28, 0.01], P.team));
    if (t >= 4) m.decal(0.02, () => m.box([-0.1, 0, 0.168], [0.24, 0.03, 0.012], P.teamGlow));
    if (o.crewed) m.group(() => { m.cylinder([0.02, 0.1, 0.16], [0.02, 0.1, 0.2], 0.07, o.dark, 0.06, { segs: 10 }); m.box([0.1, -0.1, 0.19], [0.07, 0.07, 0.06], P.black); });
    else m.group(() => { m.box([0.05, 0, 0.2], [0.09, 0.09, 0.08], P.black); m.decal(0.01, () => m.sphere([0.1, 0, 0.2], 0.022, t >= 4 ? P.teamGlow : P.warn, { segs: 6 })); });
    if (t >= 3) antenna(m, [-0.26, -0.15, 0.16], 0.42, p.wave(0.02, 1), P.team);
    // the gun
    const k = o.kick * 0.09;
    m.group(() => {
      m.cylinder([0.2 - k, 0, 0.08], [0.4 - k, 0, 0.08], 0.06, o.dark, 0.045, { segs: 10 });
      m.cylinder([0.38 - k, 0, 0.08], [0.98 - k, 0, 0.08], 0.034 + 0.002 * t, P.gunLt, 0.03 + 0.002 * t, { segs: 10 });
      m.cylinder([0.9 - k, 0, 0.08], [1.0 - k, 0, 0.08], 0.047, P.gun, 0.047, { segs: 10 });
    });
    if (p.hit) flash(m, [1.0, 0, 0.08], 2.1);
    if (p.after && !p.hit) puff(m, [1.12, 0, 0.1], 0.09, P.smokeLt);
  });
  burn(m, [-0.1, 0, 0.42], w, 1.5);
}

/** Mammoth: the heavy tank. The biggest body on the field; it leaves two tankettes behind when it is knocked out. */
export const golem: UnitDef = {
  weight: "heavy",
  build(m, p) {
    ring(m, p, 0.64);
    const v = vehicle(p, { stride: 0.9, lunge: 0.5, recoil: 0.03, weight: "heavy" });
    m.at(v.body, () => {
      tank(m, p, { ...v, crewed: true, hull: P.hull, dark: P.hullDk });
      m.group(() => { for (const y of [-0.12, 0.12]) m.box([-0.47, y, 0.4], [0.12, 0.16, 0.07], P.tarp); });
    });
  },
};
/** Tankette: a small uncrewed tank, half a fallen Mammoth. */
export const golemling: UnitDef = {
  weight: "heavy",
  build(m, p) {
    ring(m, p, 0.4);
    const v = vehicle(p, { stride: 0.6, lunge: 0.5, recoil: 0.03, size: 0.6, weight: "heavy" });
    m.at(v.body, () => tank(m, p, { ...v, crewed: false, hull: P.armor, dark: P.armorDk }));
  },
};

/** Ramcar: an armoured car behind a steel ram plough that drives straight through a line. */
export const lancer: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.42);
    const v = vehicle(p, { stride: 0.8, lunge: 1.1 });
    m.at(v.body, () => {
      for (const x of [0.24, -0.26]) for (const s of [1, -1]) wheel(m, [x, s * 0.2, 0.105], 0.105, 0.075, v.spin, s);
      m.group(() => {
        m.extrude([[-0.42, 0.1], [0.36, 0.1], [0.4, 0.22], [0.2, 0.26], [0.08, 0.4], [-0.36, 0.4], [-0.42, 0.3]], 0.34, P.hull);
        for (const s of [1, -1]) m.box([-0.02, s * 0.2, 0.2], [0.74, 0.06, 0.03], P.hullDk);
      });
      m.decal(0.012, () => { m.box([-0.14, 0, 0.405], [0.34, 0.26, 0.01], P.team); for (const s of [1, -1]) m.box([-0.12, s * 0.172, 0.3], [0.3, 0.01, 0.06], P.team); m.box([0.135, 0, 0.33], [0.012, 0.28, 0.08], P.glass); });
      // the ram: a V plough in bare steel with hazard chevrons
      const k = p.mix(0, 0.06, { wind: -0.02 });
      m.group(() => { for (const s of [1, -1]) m.poly([[0.62 + k, 0, 0.06], [0.62 + k, 0, 0.34], [0.4 + k, s * 0.3, 0.3], [0.4 + k, s * 0.3, 0.06]], t >= 3 ? P.steel : P.steelDk); m.box([0.45 + k, 0, 0.18], [0.14, 0.08, 0.06], P.gun); });
      m.decal(0.015, () => { for (const s of [1, -1]) for (const q of [0.3, 0.62]) m.poly([[0.62 + k - 0.22 * q, s * 0.3 * q, 0.14], [0.62 + k - 0.22 * q, s * 0.3 * q, 0.26], [0.62 + k - 0.22 * (q + 0.14), s * 0.3 * (q + 0.14), 0.26], [0.62 + k - 0.22 * (q + 0.14), s * 0.3 * (q + 0.14), 0.14]], t >= 4 ? P.teamGlow : P.hazard); });
      if (t >= 2) m.group(() => { m.box([-0.2, 0, 0.44], [0.1, 0.1, 0.06], P.black); m.cylinder([-0.16, 0, 0.45], [0.02, 0, 0.47], 0.012, P.gun, 0.012, { segs: 6 }); });
      if (p.hit) for (const s of [1, -1]) puff(m, [0.6, s * 0.2, 0.08], 0.07, P.dust);
      burn(m, [-0.1, 0, 0.42], v.wreck, 1.2);
    });
  },
};

/** Scout Car: a fast open buggy, a gunner on the roll bar. Circles and shoots. */
export const outrider: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.38);
    const v = vehicle(p, { stride: 0.9, recoil: 0.012 });
    m.at(v.body, () => {
      for (const x of [0.25, -0.24]) for (const s of [1, -1]) wheel(m, [x, s * 0.19, 0.1], 0.1, 0.065, v.spin, s);
      m.group(() => {
        m.extrude([[-0.36, 0.1], [0.34, 0.1], [0.38, 0.17], [0.16, 0.24], [-0.36, 0.22]], 0.26, P.coyoteDk);
        m.box([0.26, 0, 0.2], [0.18, 0.24, 0.04], P.coyote);
      });
      m.decal(0.012, () => m.box([0.26, 0, 0.222], [0.14, 0.2, 0.008], P.team));
      // roll cage
      for (const s of [1, -1]) m.tube([[0.12, s * 0.13, 0.22], [0.02, s * 0.13, 0.5], [-0.26, s * 0.13, 0.5], [-0.34, s * 0.13, 0.22]], 0.012, P.gun, { segs: 5 });
      m.capsule([-0.1, -0.13, 0.5], [-0.1, 0.13, 0.5], 0.012, P.gun, 0.012, { segs: 5 });
      m.decal(0.01, () => m.box([-0.14, 0, 0.512], [0.2, 0.22, 0.008], P.team));
      if (v.wreck < 0.4) m.with(() => {
        m.move(-0.16, 0, 0.14);
        const h = trooper(m, p, { seated: true, size: 0.9, handR: [0.2, 0.06, 0.74], handL: [0.24, -0.06, 0.74], torso: P.coyote, legs: P.olive });
        m.at(h.head, () => helmet(m, P.coyoteDk, { visor: true }));
      });
      // the pintle gun over the cage
      m.with(() => {
        m.move(0.0, 0, 0.56).rotY(-v.kick * 6);
        m.group(() => { m.box([0.02, 0, 0], [0.2, 0.04, 0.05], P.gun); m.cylinder([0.1, 0, 0.005], [0.42 + 0.02 * t, 0, 0.005], 0.012, P.gunLt, 0.012, { segs: 6 }); m.box([0.0, 0.05, -0.02], [0.08, 0.06, 0.07], P.armorDk); });
        m.capsule([0, 0, -0.07], [0, 0, -0.02], 0.014, P.gun, 0.014, { segs: 5 });
        if (t >= 3) m.box([0.1, 0, 0.0], [0.012, 0.16, 0.12], P.armorDk);
        if (t >= 4) m.decal(0.01, () => m.box([0.02, 0, 0.028], [0.16, 0.03, 0.008], P.teamGlow));
        if (p.hit) flash(m, [0.44, 0, 0.005], 1.1);
      });
      burn(m, [0, 0, 0.3], v.wreck, 1.1);
    });
  },
};

/** Demo Bot: a small tracked robot carrying a charge far too big for it, a red light blinking. */
export const keg: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.24);
    const v = vehicle(p, { stride: 0.42, lunge: 1 });
    m.at(v.body, () => {
      for (const s of [1, -1]) track(m, [0, s * 0.1, 0.05], 0.34, 0.1, 0.06, v.spin * 2);
      m.box([0, 0, 0.09], [0.26, 0.15, 0.05], P.armorDk);
      m.group(() => { for (const y of [-0.045, 0.045]) m.cylinder([-0.1, y, 0.2], [0.1, y, 0.2], 0.075 + 0.006 * t, P.hazard, 0.075 + 0.006 * t, { segs: 10 }); });
      m.decal(0.01, () => { for (const x of [-0.05, 0.05]) m.box([x, 0, 0.21], [0.03, 0.2, 0.15], P.black); m.box([0, 0, 0.285 + 0.006 * t], [0.12, 0.1, 0.01], P.team); });
      const on = p.i % 2 === 0 || p.is("attack");
      m.sphere([0.0, 0, 0.32 + 0.006 * t], 0.028, on ? (t >= 4 ? P.teamGlow : P.warn) : P.red, { segs: 6 });
      antenna(m, [-0.12, 0.05, 0.12], 0.3, p.wave(0.02, 2));
      if (p.hit) { m.sphere([0, 0, 0.2], 0.3, P.flash, { segs: 8 }); m.sphere([0, 0, 0.2], 0.17, P.flashHot, { segs: 8 }); }
    });
  },
};

// ------------------------------------------------------------------------------------------------ aircraft
/** Gunship: an attack helicopter. Heavy, armoured, a chin cannon; it dives and the blast stuns. */
export const griffin: UnitDef = {
  weight: "heavy", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.26, lunge: 0.8 });
    ring(m, p, 0.3);
    m.at(f.body, () => {
      m.group(() => {
        m.ellipsoid([0.06, 0, 0], [0.33, 0.095, 0.115], P.armor, { segs: 12 });
        m.capsule([-0.18, 0, 0.03], [-0.68, 0, 0.09], 0.055, P.armor, 0.022, { segs: 8 });
        m.ellipsoid([0, 0, 0.11], [0.17, 0.085, 0.06], P.armorDk, { segs: 10 });
        m.poly([[-0.56, 0, 0.08], [-0.74, 0, 0.26], [-0.66, 0, 0.26], [-0.62, 0, 0.09]], P.armor);
        for (const s of [1, -1]) m.box([-0.02, s * 0.17, -0.02], [0.13, 0.2, 0.022], P.armorDk);
      });
      m.decal(0.012, () => m.ellipsoid([0.24, 0, 0.045], [0.13, 0.07, 0.07], P.glass, { segs: 10 }));
      m.decal(0.014, () => { m.cylinder([-0.36, 0, 0.055], [-0.48, 0, 0.07], 0.043, P.team, 0.035, { segs: 8 }); m.box([-0.02, 0, 0.172], [0.2, 0.1, 0.008], P.team); for (const s of [1, -1]) m.box([-0.02, s * 0.25, -0.005], [0.12, 0.05, 0.01], P.team); });
      for (const s of [1, -1]) {
        m.cylinder([-0.09, s * 0.22, -0.055], [0.07, s * 0.22, -0.055], 0.032 + 0.003 * t, P.gun, 0.032 + 0.003 * t, { segs: 8 });
        m.tube([[0.16, s * 0.08, -0.1], [0.12, s * 0.1, -0.17], [-0.14, s * 0.1, -0.17], [-0.16, s * 0.08, -0.1]], 0.01, P.gun, { segs: 4 });
        if (t >= 3) m.cylinder([-0.07, s * 0.14, -0.05], [0.05, s * 0.14, -0.05], 0.018, P.steelDk, 0.018, { segs: 6 });
      }
      m.group(() => { m.sphere([0.3, 0, -0.085], 0.035, P.gun, { segs: 6 }); m.cylinder([0.3, 0, -0.095], [0.5, 0, -0.105], 0.011, P.gunLt, 0.011, { segs: 5 }); });
      if (p.hit) flash(m, [0.5, 0, -0.105], 1.2);
      if (t >= 4) m.decal(0.02, () => m.box([-0.02, 0, 0.176], [0.22, 0.02, 0.008], P.teamGlow));
      // rotors: a faint disc and blades caught mid-turn
      m.cylinder([0, 0, 0.16], [0, 0, 0.215], 0.018, P.gun, 0.018, { segs: 6 });
      m.with(() => { m.move(0, 0, 0.222).rotZ(f.spin * 1.7); for (const a of [0, 90]) m.with(() => { m.rotZ(a); m.box([0, 0, 0], [1.1, 0.03, 0.006], P.rotor); }); });
      m.with(() => { m.move(-0.7, 0.03, 0.2).rotY(f.spin * 3); m.box([0, 0, 0], [0.2, 0.006, 0.025], P.rotor); m.box([0, 0, 0], [0.025, 0.006, 0.2], P.rotor); });
      burn(m, [-0.05, 0, 0.14], p.dead, 1.2);
    });
  },
};

/** Kite: a strike drone, long straight wings in the side's colour, a pusher prop. Dives on its target. */
export const harrier: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.22 });
    ring(m, p, 0.26);
    m.at(f.body, () => {
      m.rotX(4 * f.flap);
      m.group(() => {
        m.ellipsoid([0.04, 0, 0], [0.25, 0.045, 0.05], P.grey, { segs: 10 });
        m.ellipsoid([0.2, 0, 0.012], [0.09, 0.05, 0.055], P.greyDk, { segs: 8 });
        for (const s of [1, -1]) m.poly([[-0.2, 0, 0.01], [-0.3, s * 0.13, 0.11], [-0.24, s * 0.13, 0.11], [-0.14, 0, 0.01]], P.grey);
      });
      const span = 0.52 + 0.02 * t;
      for (const s of [1, -1]) {
        m.poly([[0.08, s * 0.03, 0.02], [0.04, s * span, 0.035], [-0.04, s * span, 0.035], [-0.08, s * 0.03, 0.02]], P.grey);
        m.decal(0.012, () => m.poly([[0.06, s * span * 0.42, 0.03], [0.04, s * span, 0.04], [-0.04, s * span, 0.04], [-0.06, s * span * 0.42, 0.03]], P.team));
        if (t >= 2) m.capsule([-0.03, s * span * 0.3, -0.005], [0.08, s * span * 0.3, -0.005], 0.014, P.steelDk, 0.008, { segs: 5 });
        if (t >= 4) m.decal(0.02, () => m.sphere([0, s * span, 0.04], 0.02, P.teamGlow, { segs: 5 }));
      }
      m.sphere([0.27, 0, -0.03], 0.028, P.glass, { segs: 6 });
      if (p.hit) flash(m, [0.3, 0, -0.03], 0.9);
      burn(m, [-0.05, 0, 0.03], p.dead, 0.8);
    });
  },
};

// ------------------------------------------------------------------------------------------------ emplacements
function sandbags(m: Model, rad: number, a0: number, a1: number, rows: number) {
  m.group(() => {
    for (let k = 0; k < rows; k++) {
      const n = Math.round(((a1 - a0) / 360) * 6.283 * rad / 0.15);
      for (let i = 0; i < n; i++) {
        const a = (a0 + ((i + (k % 2) * 0.5) / n) * (a1 - a0)) / 57.3;
        m.with(() => { m.move(Math.cos(a) * rad, Math.sin(a) * rad, 0.04 + k * 0.07).rotZ(a * 57.3 + 90); m.ellipsoid([0, 0, 0], [0.085, 0.05, 0.042], k % 2 ? P.sandbag : P.coyote, { segs: 7 }); });
      }
    }
  });
}

/** Mortar: a fat tube pointing at the sky on a baseplate, in a horseshoe of sandbags. */
export const bombard: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.05, collapse: 0.7 });
    ring(m, p, 0.46);
    m.at(s.base, () => {
      sandbags(m, 0.36, -125, 125, t >= 3 ? 3 : 2);
      m.cylinder([-0.02, 0, 0], [-0.02, 0, 0.03], 0.17, P.gun, 0.15, { segs: 12 });
      m.group(() => { m.box([-0.24, 0.2, 0.06], [0.2, 0.13, 0.12], P.crate); for (const y of [0.17, 0.23]) m.cone([-0.24, y, 0.12], [-0.24, y, 0.24], 0.03, P.steelDk, { segs: 6 }); });
      m.decal(0.01, () => m.box([-0.24, 0.2, 0.123], [0.2, 0.04, 0.006], P.team));
    });
    m.at(s.top, () => {
      const rr = 0.058 + 0.005 * t, tip: V3 = [0.23, 0, 0.66 + 0.02 * t];
      m.cylinder([-0.03, 0, 0.04], tip, rr * 1.1, P.armorDk, rr, { segs: 12 });
      m.decal(0.01, () => m.cylinder([0.07, 0, 0.3], [0.11, 0, 0.4], rr * 1.12, t >= 4 ? P.teamGlow : P.team, rr * 1.1, { segs: 12 }));
      m.decal(0.012, () => m.disc(tip, [0.35, 0, 0.94], rr * 0.8, P.night, { segs: 10 }));
      for (const y of [1, -1]) m.capsule([0.15, 0, 0.47], [0.3, y * 0.17, 0.0], 0.012, P.gun, 0.01, { segs: 5 });
      m.box([0.12, 0.08, 0.42], [0.05, 0.04, 0.07], P.black);
      if (p.hit) m.with(() => { m.move(tip[0], tip[1], tip[2]).rotY(-70); flash(m, [0.02, 0, 0], 1.7); });
      if (p.after) puff(m, [tip[0] + 0.08, 0, tip[2] + 0.2 + (p.hit ? 0 : 0.14)], 0.1, P.smokeLt);
    });
    burn(m, [0, 0, 0.2], p.dead, 1.1);
  },
};

/** AT Gun: a long-barrelled gun on a split trail behind a shield. One round goes through a whole line. */
export const ballista: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.09, collapse: 0.6 });
    ring(m, p, 0.46);
    m.at(s.base, () => {
      for (const y of [1, -1]) { m.capsule([-0.02, y * 0.08, 0.12], [-0.5, y * 0.3, 0.03], 0.022, P.armorDk, 0.018, { segs: 6 }); m.box([-0.5, y * 0.3, 0.02], [0.08, 0.1, 0.03], P.gun); wheel(m, [0.02, y * 0.26, 0.1], 0.1, 0.05, 0, y); }
      m.box([0, 0, 0.12], [0.1, 0.46, 0.04], P.armorDk);
    });
    m.at(s.top, () => {
      const L = 0.86 + 0.04 * t;
      m.group(() => {
        m.box([-0.08, 0, 0.21], [0.3, 0.09, 0.09], P.armorDk);
        m.cylinder([0.05, 0, 0.215], [L, 0, 0.225], 0.03, P.gunLt, 0.022, { segs: 8 });
        m.box([L, 0, 0.225], [0.09, 0.07, 0.045], P.gun);
        m.cylinder([-0.02, 0, 0.27], [0.24, 0, 0.27], 0.02, P.steelDk, 0.02, { segs: 6 });
      });
      // the gun shield, with the side's panel
      m.group(() => { for (const y of [1, -1]) m.poly([[0.1, y * 0.04, 0.1], [0.1, y * 0.04, 0.46], [0.02, y * 0.34, 0.4], [0.02, y * 0.34, 0.12]], P.armor); });
      m.decal(0.012, () => { for (const y of [1, -1]) m.poly([[0.085, y * 0.1, 0.2], [0.085, y * 0.1, 0.36], [0.035, y * 0.29, 0.34], [0.035, y * 0.29, 0.21]], t >= 4 ? P.teamGlow : P.team); });
      if (t >= 2) m.box([-0.02, -0.09, 0.3], [0.1, 0.03, 0.05], P.black);
      if (t >= 3) m.group(() => { for (const y of [1, -1]) m.box([0.03, y * 0.36, 0.26], [0.012, 0.05, 0.3], P.armorLt); });
      if (p.hit) flash(m, [L + 0.05, 0, 0.225], 1.8);
      if (p.after && !p.hit) puff(m, [L + 0.16, 0, 0.25], 0.08, P.smokeLt);
    });
    burn(m, [0, 0, 0.25], p.dead, 1);
  },
};

/** Drone Bay: a launch container. The roll door runs up on the "attack" and a crawler comes out. */
export const hive: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0, collapse: 0.5 });
    ring(m, p, 0.5);
    const open = p.is("attack") ? Math.max(0, Math.min(1, p.blend)) : 0;
    m.at(s.top, () => {
      const L = 0.74, W = 0.5, H = 0.44 + 0.02 * t;
      m.group(() => {
        m.box([-0.02, 0, 0.02], [L, W, 0.04], P.armorDk);
        m.box([-0.02, 0, H], [L, W, 0.03], P.armor);
        m.box([-L / 2, 0, H / 2], [0.03, W, H], P.armor);
        for (const y of [1, -1]) m.box([-0.02, y * (W / 2 - 0.012), H / 2], [L, 0.024, H], P.armor);
      });
      // corrugation and the side's stripe along both walls, the recognition panel on the roof
      for (const y of [1, -1]) m.decal(0.008, () => { for (let i = 0; i < 7; i++) m.box([-0.32 + i * 0.1, y * (W / 2 + 0.002), H / 2], [0.03, 0.006, H * 0.86], P.armorDk); m.box([-0.02, y * (W / 2 + 0.004), H * 0.72], [L * 0.9, 0.006, 0.07], P.team); });
      m.decal(0.012, () => m.box([-0.06, 0, H + 0.017], [0.5, 0.14, 0.006], t >= 4 ? P.teamGlow : P.team));
      // the mouth: dark inside, an amber lamp, a roll door that lifts
      m.box([L / 2 - 0.06, 0, H / 2], [0.02, W - 0.06, H - 0.06], P.night);
      const dh = (H - 0.05) * (1 - open * 0.85);
      m.decal(0.01, () => m.box([L / 2 - 0.03, 0, H - 0.02 - dh / 2], [0.016, W - 0.06, dh], P.steelDk));
      m.decal(0.02, () => m.sphere([L / 2 - 0.02, 0, H - 0.035], 0.022, open > 0.2 ? P.amber : P.hazard, { segs: 6 }));
      m.poly([[L / 2 - 0.03, -0.2, 0.04], [L / 2 + 0.14, -0.2, 0], [L / 2 + 0.14, 0.2, 0], [L / 2 - 0.03, 0.2, 0.04]], P.steelDk);
      if (t >= 2) m.group(() => { m.cylinder([-0.26, 0.14, H], [-0.26, 0.14, H + 0.06], 0.07, P.grey, 0.02, { segs: 10 }); });
      if (t >= 3) antenna(m, [-0.3, -0.18, H], 0.4, p.wave(0.015, 1), P.team);
    });
    burn(m, [0, 0, 0.4], p.dead, 1.3);
  },
};

/** Sentry: the Engineer's small tripod gun. */
export const turret: UnitDef = {
  weight: "light", fixed: true,
  build(m, p) {
    const s = structure(m, p, { recoil: 0.04 });
    ring(m, p, 0.24);
    m.at(s.base, () => { for (let i = 0; i < 3; i++) { const a = i * 2.094 + 1.05; m.capsule([0, 0, 0.3], [Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.01], 0.014, P.gun, 0.011, { segs: 5 }); } });
    m.at(s.top, () => {
      m.group(() => { m.box([0.02, 0, 0.34], [0.2, 0.07, 0.08], P.armorDk); m.cylinder([0.1, 0, 0.345], [0.42, 0, 0.345], 0.014, P.gunLt, 0.014, { segs: 6 }); m.box([-0.02, 0.07, 0.31], [0.1, 0.07, 0.09], P.crate); });
      m.decal(0.01, () => { m.box([0.02, 0, 0.383], [0.14, 0.06, 0.006], P.team); m.sphere([0.12, 0, 0.395], 0.016, P.warn, { segs: 5 }); });
      if (p.hit) flash(m, [0.42, 0, 0.345], 0.9);
    });
    burn(m, [0, 0, 0.3], p.dead, 0.6);
  },
};

/** Prox Mine: a low disc with prongs and a light that blinks. The "attack" is the blast. */
export const mine: UnitDef = {
  weight: "light", fixed: true,
  build(m, p) {
    const t = p.tier, on = p.is("idle") ? p.i % 3 === 0 : true;
    ring(m, p, 0.2);
    if (p.hit || (p.after && p.is("attack"))) { m.sphere([0, 0, 0.12], p.hit ? 0.34 : 0.24, P.flash, { segs: 8 }); m.sphere([0, 0, 0.12], p.hit ? 0.2 : 0.1, P.flashHot, { segs: 8 }); puff(m, [0.1, 0.05, 0.3], 0.14, P.smoke); return; }
    if (p.dead > 0.5) return;
    m.group(() => { m.cylinder([0, 0, 0], [0, 0, 0.05], 0.15 + 0.008 * t, P.armorDk, 0.13 + 0.008 * t, { segs: 14 }); m.cylinder([0, 0, 0.05], [0, 0, 0.075], 0.07, P.gun, 0.06, { segs: 10 }); });
    m.decal(0.01, () => m.torus([0, 0, 0.052], [0, 0, 1], 0.105, 0.012, P.team, { segs: 14 }));
    for (let i = 0; i < 3 + t; i++) { const a = (i / (3 + t)) * 6.283; m.capsule([Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.04], [Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.1], 0.008, P.steel, 0.006, { segs: 4 }); }
    m.sphere([0, 0, 0.085], 0.022, on ? (t >= 4 ? P.teamGlow : P.warn) : P.red, { segs: 6 });
  },
};

// ------------------------------------------------------------------------------------------------ crawlers
function bot(m: Model, p: Pose, o: { size: number; legs: number; jaws: boolean }) {
  const c = crawler(m, p, { size: o.size, legs: o.legs, leg: P.gun, foot: P.steelDk, height: 0.12, length: 0.15, width: 0.085, legR: 0.016, stride: 0.2 });
  m.at(c.body, () => {
    m.group(() => { m.box([0, 0, 0.01], [0.3, 0.15, 0.07], P.armorDk); m.box([0.12, 0, 0.03], [0.1, 0.11, 0.07], P.armor); });
    m.decal(0.01, () => { m.box([-0.04, 0, 0.047], [0.16, 0.11, 0.006], P.team); m.sphere([0.175, 0, 0.035], 0.02, P.warn, { segs: 5 }); });
    if (o.jaws) {
      const g = p.mix(18, -4, { wind: 34 });
      for (const s of [1, -1]) m.with(() => { m.move(0.16, s * 0.05, 0).rotZ(s * g); m.extrude([[0, -0.012], [0.16, -0.006], [0.19, 0.0], [0.16, 0.012], [0, 0.014]], 0.012, P.steel); });
      m.group(() => { m.cylinder([-0.06, 0, 0.05], [-0.06, 0, 0.1], 0.05, P.armor, 0.04, { segs: 8 }); });
      antenna(m, [-0.12, 0, 0.05], 0.18, p.wave(0.015, 2));
    }
    if (p.hit) m.sphere([0.26, 0, 0.02], 0.035, P.flashHot, { segs: 5 });
  });
}
/** Skitter: the Drone Bay's small crawler. */
export const mite: UnitDef = { weight: "light", build(m, p) { ring(m, p, 0.15); bot(m, p, { size: 0.62, legs: 3, jaws: false }); } };
/** Mauler: the Drone Bay's big crawler, with cutting jaws. */
export const queen: UnitDef = { weight: "mid", build(m, p) { ring(m, p, 0.22); bot(m, p, { size: 1, legs: 4, jaws: true }); } };
