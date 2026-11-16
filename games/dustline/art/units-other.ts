// Dustline's riders, beasts, guns and traps: everything that is not simply a person on two legs.
import { crawler, flyer, gripAim, humanoid, quadruped, structure, type Pose, type QuadRig, type UnitDef } from "../../../artkit/rig";
import { Model, mat, norm, type Material, type V3 } from "../../../artkit/toon3d";
import { GOLD, P, core, flash, halo, kepi, neckerchief, pricklyPear, puff, rifle, serape, sombrero, star, stetson, trim, trim2, wheel, wisp } from "./parts";

// ------------------------------------------------------------------------------------------------ horses
/** A horse on the quadruped rig: barrel, arched neck, long head, mane and tail, a saddle blanket in team colour. */
function horse(m: Model, p: Pose, q: QuadRig, coat: Material, dark: Material, tier: number, blaze: Material | null = null) {
  m.at(q.body, () => {
    m.group(() => { m.ellipsoid([0, 0, 0], [0.31, 0.15, 0.16], coat); m.sphere([0.2, 0, 0.02], 0.165, coat); m.sphere([-0.2, 0, 0.02], 0.17, coat); });
    m.decal(0.012, () => m.ellipsoid([-0.02, 0, 0.04], [0.15, 0.16, 0.135], P.team));
    m.decal(0.02, () => m.ellipsoid([-0.02, 0, 0.1], [0.1, 0.11, 0.08], P.hideDk));
    if (tier >= 2) m.decal(0.024, () => m.torus([-0.02, 0, 0.04], [1, 0, 0], 0.158, 0.012, trim(tier), { segs: 12 }));
    const nod = p.is("walk") ? 5 * Math.sin(p.t * Math.PI * 4) : p.mix(0, -10, { wind: 14 });
    m.with(() => {
      m.move(0.25, 0, 0.07).rotY(-54 + nod);
      m.capsule([0, 0, 0], [0.27, 0, 0], 0.095, coat, 0.065, { segs: 10 });
      m.decal(0.012, () => m.group(() => { for (let i = 0; i < 5; i++) m.sphere([0.03 + i * 0.055, 0, 0.075 - i * 0.004], 0.045, dark, { segs: 6 }); }));
      m.move(0.28, 0, 0).rotY(72);
      m.group(() => { m.ellipsoid([0.06, 0, 0], [0.135, 0.07, 0.075], coat); m.ellipsoid([0.16, 0, -0.012], [0.062, 0.055, 0.052], blaze ?? dark); });
      if (blaze) m.decal(0.012, () => m.ellipsoid([0.07, 0, 0.05], [0.1, 0.03, 0.035], blaze, { segs: 6 }));
      m.decal(0.02, () => { for (const s of [1, -1]) m.sphere([0.05, s * 0.062, 0.03], 0.02, P.black, { segs: 5 }); });
      for (const s of [1, -1]) m.cone([-0.03, s * 0.04, 0.05], [-0.06, s * 0.055, 0.14], 0.028, coat, { segs: 5 });
      m.decal(0.015, () => m.torus([0.1, 0, 0], [1, 0, 0.2], 0.072, 0.008, P.hideDk, { segs: 10 }));
      if (p.is("walk") || p.hit) puff(m, [0.22, 0, -0.03], 0.03, 0.3, P.dust, p.i);
    });
    const sw = 0.03 * p.wave(1, 2);
    m.tube([[-0.31, 0, 0.06], [-0.4, sw, 0.02], [-0.44, sw * 2, -0.16]], [0.04, 0.05, 0.02], dark, { segs: 6 });
  });
}

/** Trooper: a cavalryman on a bay horse, guidon lance levelled. Goes through a line and comes round again. */
export const lancer: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { size: 1.0, height: 0.4, length: 0.27, width: 0.13, legs: P.horse, hooves: P.black, legR: 0.043, stride: 0.62 });
    horse(m, p, q, P.horse, P.horseDk, t, P.cream);
    m.at(q.saddle, () => {
      const R = p.mix<V3>([0.1, 0.2, 0.36], [0.3, 0.16, 0.36], { wind: [-0.02, 0.22, 0.4] });
      const h = humanoid(m, p, { seated: true, size: 0.86, skin: P.skin, torso: P.team, arms: P.team, legs: P.denim, boots: P.black, hands: P.rawhide, handR: R, handL: [0.2, -0.08, 0.3], lunge: 0 });
      m.at(h.chest, () => { neckerchief(m, P.straw); m.decal(0.02, () => m.torus([0, 0, 0.02], [0.5, -0.75, 0.6], 0.168, 0.026, P.white, { segs: 14 })); for (const s of [1, -1]) if (t >= 2) m.ellipsoid([-0.01, s * 0.18, 0.135], [0.06, 0.065, 0.04], trim(t)); });
      m.at(h.head, () => { stetson(m, 0.19, P.rawhide, P.team, { brim: 1.5, h: 1.0, tilt: -3 }); if (t >= 3) m.decal(0.02, () => m.with(() => { m.move(0.15, 0, 0.2).rotZ(90); star(m, 0.05, GOLD, 0.012); })); halo(m, p, 0.5); });
      m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.5], [1, -0.06, 0.02], { wind: [1, 0, 0.3] }))), () => {
        const L = 0.8 + 0.05 * t;
        m.cylinder([-0.3, 0, 0], [L, 0, 0], 0.02, P.woodLt, 0.015, { segs: 6 });
        m.cone([L, 0, 0], [L + 0.17, 0, 0], 0.038, t >= 4 ? P.glory : P.steel, { segs: 6 });
        m.decal(0.01, () => m.extrude([[L - 0.02, -0.01], [L - 0.02, -0.16], [L - 0.14, -0.1], [L - 0.26, -0.16], [L - 0.26, -0.01]], 0.01, P.team));
        m.decal(0.016, () => m.extrude([[L - 0.02, -0.01], [L - 0.02, -0.085], [L - 0.26, -0.085], [L - 0.26, -0.01]], 0.012, P.white));
        if (p.hit) m.cone([L + 0.5, 0, 0], [L - 0.1, 0, 0], 0.07, P.dust, { segs: 6 });
      });
    });
  },
};

/** Pistolero: a sombrero and a serape on a fast palomino. Rides rings round its prey and never stops shooting. */
export const outrider: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { size: 0.92, weight: "mid", height: 0.38, length: 0.26, width: 0.12, legs: P.palomino, hooves: P.hideDk, legR: 0.04, stride: 0.6, lunge: 0.3 });
    horse(m, p, q, P.palomino, P.cream, t);
    m.at(q.saddle, () => {
      const Rh = p.mix<V3>([0.12, 0.16, 0.36], [0.16, 0.14, 0.46], { wind: [0.06, 0.16, 0.44] });
      const Lh = p.mix<V3>([0.26, -0.1, 0.36], [0.34, -0.02, 0.5], { wind: [0.24, -0.04, 0.52] });
      const h = humanoid(m, p, { seated: true, size: 0.86, skin: P.skinTan, torso: P.canvas, arms: P.canvas, legs: P.hideDk, boots: P.black, hands: P.hide, handR: Rh, handL: Lh, recoil: 0.03, lunge: 0 });
      serape(m, h, P.team, t >= 3 ? GOLD : P.teamDk, 0.95, 0.2);
      m.at(h.head, () => { sombrero(m, 0.19, t >= 3 ? P.black : P.straw, t >= 3 ? GOLD : P.team, 2.0 + 0.04 * t); halo(m, p, 0.5); });
      m.at(gripAim(h.pR, h.pL), () => {
        rifle(m, t, 0.4);
        if (p.hit) flash(m, [0.43, 0, 0.014], 0.065);
        if (p.after) puff(m, [0.5 + (p.hit ? 0 : 0.06), 0, 0.05], 0.06, p.hit ? 0.2 : 0.7);
      });
    });
  },
};

// ------------------------------------------------------------------------------------------------ birds
/** A feathered wing in the frame of its root: `s` is the side, `span` its reach, `finger` the flight feathers. */
function wing(m: Model, s: number, span: number, top: Material, tips: Material, lead: Material) {
  m.group(() => m.poly([[0.15, 0, 0], [0.2, s * span * 0.5, 0.012], [0.1, s * span * 0.84, 0.006], [-0.06, s * span * 0.8, 0], [-0.24, s * span * 0.5, 0], [-0.2, 0, 0]], top));
  m.group(() => { for (let i = 0; i < 5; i++) { const a = i / 4; m.poly([[0.11 - a * 0.13, s * span * (0.8 - a * 0.1), 0.004], [0.14 - a * 0.2, s * span * (1.06 - a * 0.16), 0.004], [0.06 - a * 0.19, s * span * (1.0 - a * 0.2), 0.004], [0.03 - a * 0.14, s * span * (0.78 - a * 0.12), 0.004]], tips); } });
  m.tube([[0.13, 0, 0.006], [0.18, s * span * 0.5, 0.018], [0.11, s * span * 0.84, 0.012]], [0.024, 0.02, 0.012], lead, { segs: 5 });
}

/** Buzzard: a vulture in team feathers. It waits overhead, then drops on whatever the line left behind. */
export const harrier: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.24 });
    m.at(f.body, () => {
      m.group(() => { m.ellipsoid([0, 0, 0], [0.21, 0.105, 0.095], P.featherDk); m.sphere([0.12, 0, 0.02], 0.1, P.featherDk); });
      // a white ruff, a bald red head on a crooked neck, a hooked beak
      m.torus([0.17, 0, 0.05], [1, 0, 0.5], 0.075, 0.035, P.white, { segs: 10 });
      const droop = p.mix(0, 0.06, { wind: -0.03 });
      m.group(() => { m.tube([[0.17, 0, 0.06], [0.25, 0, 0.11 - droop], [0.31, 0, 0.07 - droop]], [0.04, 0.035, 0.04], P.red, { segs: 6 }); m.sphere([0.32, 0, 0.07 - droop], 0.058, P.red, { segs: 8 }); });
      m.tube([[0.35, 0, 0.07 - droop], [0.41, 0, 0.06 - droop], [0.425, 0, 0.02 - droop]], [0.03, 0.022, 0.006], t >= 3 ? trim(t) : P.beak, { segs: 5 });
      m.decal(0.02, () => { for (const s of [1, -1]) m.sphere([0.345, s * 0.04, 0.09 - droop], 0.014, P.black, { segs: 4 }); });
      if (t >= 2) m.decal(0.01, () => m.torus([0.2, 0, 0.065], [1, 0, 0.4], 0.062, 0.02, P.team, { segs: 8 }));
      // tail fan
      m.poly([[-0.17, 0.06, 0.01], [-0.38, 0.13, 0.0], [-0.42, 0, 0.0], [-0.38, -0.13, 0.0], [-0.17, -0.06, 0.01]], P.featherDk);
      m.decal(0.01, () => m.poly([[-0.3, 0.1, 0.004], [-0.38, 0.13, 0.004], [-0.42, 0, 0.004], [-0.38, -0.13, 0.004], [-0.3, -0.1, 0.004]], P.teamDk));
      // the wings: the team's colour, dark fingers
      const ang = 10 + 34 * f.flap, span = 0.52 + 0.03 * t;
      for (const s of [1, -1]) m.with(() => {
        m.move(0.04, s * 0.08, 0.05).rotX(-s * ang);
        wing(m, s, span, P.team, P.featherDk, t >= 3 ? trim(t) : P.teamDk);
        m.decal(0.01, () => m.poly([[0.0, s * span * 0.12, 0.004], [0.03, s * span * 0.74, 0.004], [-0.06, s * span * 0.76, 0.004], [-0.12, s * span * 0.14, 0.004]], P.teamLt));
        if (t >= 4) m.sphere([0.11, s * span * 0.84, 0.012], 0.03, P.glory, { segs: 6 });
      });
      // talons drop for the dive
      const drop = p.mix(0, 1, { wind: 0.3 });
      for (const s of [1, -1]) m.tube([[0.04, s * 0.05, -0.07], [0.1, s * 0.06, -0.12 - 0.06 * drop], [0.18 + 0.05 * drop, s * 0.06, -0.1 - 0.09 * drop]], [0.02, 0.016, 0.006], P.beak, { segs: 5 });
      if (p.is("death")) m.group(() => { for (let i = 0; i < 3; i++) m.poly([[-0.1 - i * 0.1, 0.1 * (i - 1), 0.1 + 0.1 * i * p.dead], [-0.16 - i * 0.1, 0.1 * (i - 1) + 0.03, 0.12 + 0.1 * i * p.dead], [-0.12 - i * 0.1, 0.1 * (i - 1) + 0.05, 0.08 + 0.1 * i * p.dead]], P.featherDk); });
    });
  },
};

/** War Eagle: a lancer on a great eagle. Heavy for a flier; it lands on the back line like a dropped safe. */
export const griffin: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.22, lunge: 1.3 });
    m.at(f.body, () => {
      m.group(() => { m.ellipsoid([0, 0, 0], [0.3, 0.14, 0.125], P.feather); m.sphere([0.2, 0, 0.03], 0.125, P.feather); });
      m.group(() => { m.sphere([0.33, 0, 0.09], 0.1, P.white); m.ellipsoid([0.26, 0, 0.05], [0.1, 0.105, 0.09], P.white); });
      m.tube([[0.4, 0, 0.1], [0.48, 0, 0.08], [0.5, 0, 0.025]], [0.045, 0.035, 0.008], t >= 4 ? GOLD : P.beak, { segs: 6 });
      m.decal(0.02, () => { for (const s of [1, -1]) { m.sphere([0.385, s * 0.07, 0.115], 0.02, P.black, { segs: 5 }); m.box([0.375, s * 0.075, 0.14], [0.07, 0.02, 0.016], P.feltDk); } });
      m.poly([[-0.24, 0.08, 0.01], [-0.5, 0.17, 0], [-0.56, 0, 0], [-0.5, -0.17, 0], [-0.24, -0.08, 0.01]], P.white);
      const ang = 8 + 30 * f.flap, span = 0.66 + 0.035 * t;
      for (const s of [1, -1]) m.with(() => {
        m.move(0.06, s * 0.1, 0.06).rotX(-s * ang);
        m.scale(1.25, 1, 1);
        wing(m, s, span, P.feather, P.featherDk, t >= 3 ? trim(t) : P.featherDk);
        m.decal(0.01, () => m.poly([[0.1, s * span * 0.1, 0.004], [0.13, s * span * 0.66, 0.004], [-0.04, s * span * 0.7, 0.004], [-0.1, s * span * 0.12, 0.004]], P.team));
        if (t >= 4) m.sphere([0.11, s * span * 0.84, 0.012], 0.035, P.glory, { segs: 6 });
      });
      for (const s of [1, -1]) m.tube([[0.08, s * 0.07, -0.09], [0.16, s * 0.08, -0.16 - 0.05 * p.mix(0, 1)], [0.26, s * 0.08, -0.14 - 0.08 * p.mix(0, 1)]], [0.028, 0.022, 0.008], P.beak, { segs: 5 });
      // the rider
      m.with(() => {
        m.move(-0.04, 0, 0.1);
        const R = p.mix<V3>([0.16, 0.2, 0.4], [0.3, 0.16, 0.34], { wind: [0.0, 0.22, 0.46] });
        const h = humanoid(m, p, { seated: true, size: 0.8, skin: P.skin, torso: P.team, arms: P.team, legs: P.hideDk, boots: P.black, hands: P.rawhide, handR: R, handL: [0.2, -0.1, 0.3], lunge: 0 });
        m.at(h.chest, () => neckerchief(m, P.white));
        m.at(h.head, () => { kepi(m, 0.19, P.teamDk, trim2(t)); m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) m.sphere([0.165, s * 0.075, 0.03], 0.045, P.glass, { segs: 6 }); })); m.capsule([-0.12, 0, -0.04], [-0.34, 0.04 * p.wave(1, 2), 0.02 + 0.03 * p.wave(1, 2, 0.3)], 0.04, P.white, 0.02, { segs: 6 }); halo(m, p, 0.44); });
        m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.25], [1, 0, -0.55], { wind: [0.7, 0, 0.7] }))), () => {
          const L = 0.62 + 0.04 * t;
          m.cylinder([-0.24, 0, 0], [L, 0, 0], 0.02, P.woodLt, 0.016, { segs: 6 });
          m.cone([L, 0, 0], [L + 0.17, 0, 0], 0.04, t >= 4 ? P.glory : P.steel, { segs: 6 });
          m.decal(0.01, () => m.extrude([[L - 0.02, -0.01], [L - 0.02, -0.13], [L - 0.2, -0.08], [L - 0.18, -0.01]], 0.01, P.team));
          if (p.hit) flash(m, [L + 0.18, 0, 0], 0.07, P.lamp, P.fireHot);
        });
      });
      if (p.is("death")) m.group(() => { for (let i = 0; i < 4; i++) m.poly([[-0.1 - i * 0.1, 0.12 * (i - 1.5), 0.14 + 0.12 * i * p.dead], [-0.18 - i * 0.1, 0.12 * (i - 1.5) + 0.03, 0.17 + 0.12 * i * p.dead], [-0.13 - i * 0.1, 0.12 * (i - 1.5) + 0.06, 0.11 + 0.12 * i * p.dead]], i % 2 ? P.white : P.feather); });
    });
  },
};

// ------------------------------------------------------------------------------------------------ the Hoodoo
const STRATA = mat("#a34f33"), SEAM = mat("#3a1c14", { shade: 0.2 });
/** Hoodoo: a walking stack of red mesa rock. Two slabs with a seam between; when it falls, each slab gets up. */
function hoodoo(m: Model, p: Pose, size: number, tier: number, small = false) {
  const R = p.mix<V3>([0.06, 0.3, 0.2], [0.36, 0.15, 0.12], { wind: [0.0, 0.25, 0.8] });
  const L = p.mix<V3>([0.06, -0.3, 0.2], [0.36, -0.15, 0.12], { wind: [0.0, -0.25, 0.8] });
  const h = humanoid(m, p, { size, bulk: 1.25, leg: small ? 1.1 : 1.45, weight: "heavy", skin: P.rock, torso: P.rock, legs: P.rockDk, boots: P.rock, arms: P.rockDk, hands: P.rock, handR: R, handL: L, noHead: true, noTorso: true, lunge: 0.7, stride: 0.34, lean: 3 });
  // the lower slab
  if (!small) m.at(h.hips, () => {
    m.cylinder([0, 0, -0.07], [0, 0, 0.1], 0.2, P.rockDk, 0.235, { segs: 7 });
    m.decal(0.006, () => m.cylinder([0, 0, 0.0], [0, 0, 0.035], 0.215, STRATA, 0.222, { segs: 7 }));
  });
  m.at(h.chest, () => {
    if (!small) m.decal(0.004, () => m.cylinder([0, 0, -0.08], [0, 0, -0.04], 0.19, SEAM, 0.19, { segs: 7 }));
    // the upper slab and its cap rock
    m.with(() => { m.rotZ(25); m.cylinder([0, 0, -0.05], [0, 0, 0.2], small ? 0.19 : 0.215, small ? P.rockDk : P.rock, small ? 0.21 : 0.235, { segs: 7 }); });
    m.decal(0.006, () => m.with(() => { m.rotZ(25); m.cylinder([0, 0, 0.02], [0, 0, 0.05], 0.222, STRATA, 0.225, { segs: 7 }); }));
    m.with(() => { m.rotZ(8); m.cylinder([0, 0, 0.19], [0, 0, 0.27], small ? 0.2 : 0.265, P.rockLt, small ? 0.17 : 0.225, { segs: 7 }); });
    // a saddle blanket slung over one shoulder: the side it fights for
    m.decal(0.01, () => m.with(() => { m.rotZ(25); m.cylinder([0, 0, 0.085], [0, 0, 0.17], small ? 0.213 : 0.236, P.team, small ? 0.217 : 0.24, { segs: 7 }); }));
    m.decal(0.016, () => m.with(() => { m.rotZ(25); m.cylinder([0, 0, 0.115], [0, 0, 0.14], small ? 0.216 : 0.24, tier >= 3 ? trim(tier) : P.teamDk, small ? 0.217 : 0.241, { segs: 7 }); }));
    for (const s of [1, -1]) m.sphere([0, s * 0.225, 0.12], small ? 0.08 : 0.1, P.rockDk, { segs: 6 });
    if (tier >= 3 && !small) m.with(() => { m.move(-0.06, 0.2, 0.24).rotZ(40); pricklyPear(m, 0.16, P.cactus, tier >= 4 ? P.glory : P.bloom); });
  });
  m.at(h.head, () => {
    m.move(0.02, 0, small ? -0.05 : 0.02);
    m.ellipsoid([0, 0, 0], small ? [0.11, 0.12, 0.09] : [0.125, 0.135, 0.11], P.rockLt, { segs: 7 });
    const eye = p.is("death") && p.i > 2 ? SEAM : tier >= 4 ? P.glory : P.lamp;
    m.decal(0.03, () => { for (const s of [1, -1]) m.ellipsoid([0.105, s * 0.05, 0.01], [0.02, 0.03, 0.022], eye, { segs: 5 }); });
    if (tier >= 2 && !small) m.with(() => { m.move(0, 0, 0.035); stetson(m, 0.12, P.hide, P.team); });
    if (!small) m.with(() => { m.move(0, 0, -0.1); halo(m, p, 0.5); });
  });
  for (const ph of [h.pR, h.pL]) m.sphere(ph, (small ? 0.1 : 0.125) * size, tier >= 3 && !small ? P.rockLt : P.rock, { segs: 6 });
  if (p.hit) for (const ph of [h.pR, h.pL]) puff(m, [ph[0] + 0.05, ph[1], 0.05], 0.08 * size, 0.3, P.dust, 2);
}
export const golem: UnitDef = { weight: "heavy", build: (m, p) => hoodoo(m, p, 1.3, p.tier) };
/** Rubble: one slab of a fallen Hoodoo, still walking. */
export const golemling: UnitDef = { weight: "heavy", build: (m, p) => hoodoo(m, p, 0.95, 1, true) };

// ------------------------------------------------------------------------------------------------ emplacements
/** Powder Trap: a ring of dynamite half-buried under a barrel lid, one fuse spitting. It jumps when it goes. */
export const mine: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0, collapse: 0.6 });
    const jump = p.mix(0, 0.16, { wind: -0.02 });
    m.at(s.base, () => {
      m.move(0, 0, jump);
      m.group(() => { m.cylinder([0, 0, 0], [0, 0, 0.06], 0.2 + 0.008 * t, P.woodDk, 0.19, { segs: 12 }); m.ellipsoid([0, 0, 0.06], [0.17, 0.17, 0.05], P.team); });
      m.decal(0.01, () => m.cylinder([0, 0, 0.03], [0, 0, 0.065], 0.197 + 0.008 * t, P.team, 0.186, { segs: 12 }));
      m.decal(0.02, () => m.torus([0, 0, 0.075], [0, 0, 1], 0.12, 0.014, t >= 3 ? trim(t) : P.ironDk, { segs: 12 }));
      const n = 5 + t;
      m.group(() => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; m.cylinder([Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.05], [Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.14 + 0.01 * t], 0.03, P.red, 0.026, { segs: 6 }); } });
      m.group(() => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; m.cone([Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0.14 + 0.01 * t], [Math.cos(a) * 0.29, Math.sin(a) * 0.29, 0.17 + 0.01 * t], 0.022, P.canvas, { segs: 5 }); } });
      const on = p.is("idle") ? p.i % 3 === 0 : true;
      m.cylinder([0, 0, 0.08], [0, 0, 0.13], 0.02, P.feltDk, 0.014, { segs: 5 });
      m.sphere([0, 0, 0.15], on ? 0.045 : 0.028, on ? (t >= 4 ? P.glory : P.fire) : P.ember, { segs: 8 });
      if (p.hit) { m.sphere([0, 0, 0.1], 0.3, P.fire, { segs: 10 }); m.sphere([0, 0, 0.12], 0.19, P.fireHot, { segs: 8 }); }
    });
  },
};

/** Buffalo Gun: a wall-gun as long as a wagon tongue, on a pair of wagon wheels. One slug goes through a whole line. */
export const ballista: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.1 });
    m.at(s.base, () => {
      for (const sd of [1, -1]) m.with(() => { m.move(0.02, sd * 0.3, 0.2); wheel(m, 0.2, 0, P.woodDk, P.woodLt, 8, t >= 3 ? trim(t) : P.ironDk); });
      m.cylinder([0.02, -0.3, 0.2], [0.02, 0.3, 0.2], 0.03, P.ironDk, 0.03, { segs: 6 });
      m.group(() => { m.box([-0.2, 0, 0.13], [0.5, 0.09, 0.07], P.wood); m.box([-0.42, 0, 0.06], [0.1, 0.16, 0.08], P.woodDk); });
      // the gun shield: the team's paint and a star
      m.with(() => {
        m.move(0.14, 0, 0.3).rotY(-10);
        m.box([0, 0, 0.02], [0.03, 0.44, 0.26 + 0.01 * t], P.ironDk);
        m.decal(0.01, () => m.box([0.018, 0, 0.02], [0.01, 0.38, 0.2 + 0.01 * t], P.teamFlat));
        m.decal(0.02, () => { for (const y of [-0.13, 0.13]) m.with(() => { m.move(0.026, y, 0.02).rotZ(90); star(m, 0.05, t >= 4 ? P.glory : trim2(t), 0.012); }); });
      });
    });
    m.at(s.top, () => {
      m.move(0, 0, 0.36).rotY(-7 + p.mix(0, 0, { wind: -5 }));
      const L = 0.62 + 0.03 * t;
      m.group(() => { m.extrude([[-0.42, -0.09], [-0.42, 0.01], [-0.14, 0.04], [0.06, 0.04], [0.06, -0.04], [-0.14, -0.05]], 0.07, P.woodDk); });
      m.cylinder([-0.02, 0, 0.005], [L, 0, 0.005], 0.042, t >= 3 ? P.brassDk : P.ironDk, 0.034, { segs: 8 });
      for (const x of [0.06, L * 0.5, L - 0.04]) m.cylinder([x, 0, 0.005], [x + 0.035, 0, 0.005], 0.05, trim2(t), 0.048, { segs: 8 });
      m.box([-0.06, 0, 0.055], [0.1, 0.03, 0.04], P.ironDk);
      m.cylinder([0.0, 0, 0.07], [0.22, 0, 0.07], 0.018, t >= 2 ? P.brass : P.ironDk, 0.022, { segs: 6 });
      if (!p.after && !(p.is("death") && p.i > 1)) m.cone([L - 0.01, 0, 0.005], [L + 0.13, 0, 0.005], 0.03, t >= 4 ? P.glory : P.brass, { segs: 6 });
      if (p.hit) flash(m, [L + 0.03, 0, 0.005], 0.11);
      if (p.after) puff(m, [L + 0.14 + (p.hit ? 0 : 0.08), 0, 0.07], 0.11, p.hit ? 0.2 : 0.7, P.smoke, 1);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.3], 0.15, p.dead, P.smokeDk, 3);
  },
};

/** Thumper: a stubby siege mortar on a timber sled, balls stacked beside it. Huge reach, blind up close. */
export const bombard: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.05 });
    m.at(s.base, () => {
      m.group(() => { for (const y of [-0.24, 0.24]) m.with(() => { m.move(0, y, 0); m.extrude([[-0.38, 0], [0.36, 0], [0.42, 0.12], [-0.38, 0.12]], 0.1, P.woodDk); }); });
      m.box([0, 0, 0.11], [0.6, 0.5, 0.06], P.wood);
      m.decal(0.01, () => m.box([0.301, 0, 0.11], [0.01, 0.46, 0.05], P.team));
      m.decal(0.01, () => m.box([0, 0, 0.142], [0.56, 0.46, 0.005], P.team));
      for (const sd of [1, -1]) m.box([-0.02, sd * 0.2, 0.22], [0.2, 0.06, 0.2], t >= 3 ? trim(t) : P.ironDk);
      m.group(() => { for (const [x, y, z] of [[0.1, -0.37, 0.058], [0.215, -0.37, 0.058], [0.16, -0.29, 0.058], [0.16, -0.34, 0.14]].slice(0, 1 + Math.min(3, t))) m.sphere([x, y, z], 0.058, t >= 4 && z > 0.1 ? P.glory : P.ironDk, { segs: 8 }); });
    });
    m.at(s.top, () => {
      m.move(-0.02, 0, 0.25).rotY(-58 + p.mix(0, 0, { wind: 5 }));
      const L = 0.33 + 0.025 * t, r = 0.165 + 0.006 * t, squash = p.hit ? 0.88 : 1;
      m.group(() => { m.sphere([0, 0, 0], r * 1.08, P.ironDk); m.cylinder([0, 0, 0], [L * squash, 0, 0], r, t >= 3 ? P.brassDk : P.iron, r * 0.94, { segs: 12 }); });
      m.cylinder([L * squash - 0.06, 0, 0], [L * squash, 0, 0], r * 1.08, trim2(t), r * 1.08, { segs: 12 });
      m.cylinder([0.07, 0, 0], [0.12, 0, 0], r * 1.08, trim2(t), r * 1.06, { segs: 12 });
      m.decal(0.012, () => m.cylinder([0.14, 0, 0], [0.2, 0, 0], r * 1.01, P.team, r * 0.99, { segs: 12 }));
      m.decal(0.01, () => m.cylinder([L * squash - 0.01, 0, 0], [L * squash + 0.005, 0, 0], r * 0.72, P.black, r * 0.72, { segs: 12 }));
      m.sphere([-r * 1.05, 0, 0], 0.04, trim2(t), { segs: 6 });
      if (t >= 4) m.torus([L * 0.62, 0, 0], [1, 0, 0], r * 1.0, 0.02, P.glory);
      if (p.hit) flash(m, [L + 0.02, 0, 0], 0.15);
      if (p.after) puff(m, [L + 0.2 + (p.hit ? 0 : 0.1), 0, 0], 0.17, p.hit ? 0.2 : 0.7, P.smoke, 2);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.3], 0.16, p.dead, P.smokeDk, 3);
  },
};

/** Gatling: the Gunsmith's crank gun. A bundle of barrels on a tripod, a hopper of shot on top. */
export const turret: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const s = structure(m, p, { recoil: 0.04 });
    m.at(s.base, () => {
      m.group(() => { for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 1; m.tube([[Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0.02], [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.27]], 0.024, P.woodDk, { segs: 6 }); } });
      m.cylinder([0, 0, 0.25], [0, 0, 0.31], 0.065, P.brassDk, 0.065, { segs: 8 });
    });
    m.at(s.top, () => {
      m.move(0, 0, 0.35);
      m.group(() => { m.cylinder([-0.14, 0, 0], [0.06, 0, 0], 0.075, P.brass, 0.075, { segs: 10 }); });
      m.decal(0.01, () => m.cylinder([-0.09, 0, 0], [-0.01, 0, 0], 0.078, P.team, 0.078, { segs: 10 }));
      m.with(() => { m.rotX(p.i * 60); m.group(() => { for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; m.cylinder([0.06, Math.cos(a) * 0.04, Math.sin(a) * 0.04], [0.33, Math.cos(a) * 0.04, Math.sin(a) * 0.04], 0.016, P.ironDk, 0.016, { segs: 5 }); } }); for (const x of [0.16, 0.31]) m.cylinder([x, 0, 0], [x + 0.025, 0, 0], 0.062, P.brass, 0.062, { segs: 10 }); });
      m.box([-0.04, 0, 0.12], [0.07, 0.07, 0.13], P.team);
      m.with(() => { m.move(-0.1, 0.09, 0).rotY(p.i * 60); m.cylinder([0, 0, 0], [0, 0.05, 0], 0.012, P.ironDk, 0.012, { segs: 4 }); m.cylinder([0, 0.05, 0], [0, 0.05, 0.06], 0.012, P.ironDk, 0.012, { segs: 4 }); m.sphere([0, 0.05, 0.06], 0.022, P.wood, { segs: 5 }); });
      if (p.hit) flash(m, [0.36, 0, 0], 0.07);
      if (p.after) puff(m, [0.42, 0, 0.04], 0.05, p.hit ? 0.2 : 0.7, P.smoke, 1);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.25], 0.1, p.dead, P.smokeDk, 3);
  },
};

/** Scorpion Den: a burrow under a heap of red rock, shored with mine timber. The plank hatch bangs open and out they come. */
export const hive: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.02 });
    m.at(s.base, () => {
      m.group(() => {
        m.ellipsoid([-0.04, 0, 0.0], [0.4, 0.4, 0.34], P.rock, { segs: 9 });
        m.ellipsoid([-0.16, 0.2, 0.06], [0.22, 0.2, 0.3], P.rockDk, { segs: 7 });
        m.ellipsoid([-0.12, -0.22, 0.04], [0.24, 0.19, 0.26], P.rockDk, { segs: 7 });
        m.ellipsoid([-0.08, 0.02, 0.3], [0.22, 0.24, 0.16], P.rockLt, { segs: 7 });
      });
      m.decal(0.01, () => m.ellipsoid([-0.04, 0, 0.14], [0.385, 0.385, 0.03], mat("#a34f33"), { segs: 9 }));
      // the mouth: timber frame, the dark, the hatch that swings open on the spawn
      const open = p.mix(0, 1, { wind: 0.3 });
      m.with(() => {
        m.move(0.3, 0, 0);
        m.group(() => { for (const y of [-0.15, 0.15]) m.box([0.0, y, 0.15], [0.07, 0.05, 0.3], P.woodDk); m.box([0, 0, 0.32], [0.08, 0.4, 0.06], P.woodDk); });
        m.decal(0.02, () => m.box([0.02, 0, 0.145], [0.02, 0.25, 0.29], mat("#1c1210", { shade: 0.1 })));
        if (!(p.is("death") && p.i > 2)) m.decal(0.03, () => { for (const y of [-0.05, 0.05]) m.sphere([0.03, y, 0.1 + 0.04 * open], 0.02, t >= 4 ? P.glory : P.ember, { segs: 5 }); });
        m.with(() => { m.move(0.05, 0.13, 0).rotZ(-105 * open); m.box([0.0, -0.125, 0.15], [0.025, 0.24, 0.27], P.teamFlat); m.decal(0.012, () => m.group(() => { for (const z of [0.06, 0.24]) m.box([0.014, -0.125, z], [0.01, 0.24, 0.035], t >= 3 ? trim(t) : P.ironDk); m.box([0.014, -0.045, 0.15], [0.008, 0.012, 0.25], P.teamDk); m.box([0.014, -0.2, 0.15], [0.008, 0.012, 0.25], P.teamDk); })); });
        m.poly([[-0.04, -0.26, 0.4], [0.2, -0.3, 0.3], [0.2, 0.3, 0.3], [-0.04, 0.26, 0.4]], P.team);
        m.decal(0.01, () => m.group(() => { for (const y of [-0.15, 0.05]) m.poly([[-0.04, y * 0.9, 0.402], [0.2, y, 0.302], [0.2, y + 0.1, 0.302], [-0.04, y * 0.9 + 0.09, 0.402]], P.canvas); }));
        if (t >= 3) m.decal(0.03, () => m.group(() => { m.ellipsoid([0.045, 0, 0.36], [0.03, 0.06, 0.05], P.bone, { segs: 6 }); for (const sd of [1, -1]) m.tube([[0.045, sd * 0.05, 0.38], [0.05, sd * 0.13, 0.4], [0.05, sd * 0.16, 0.45]], [0.016, 0.012, 0.004], P.bone, { segs: 4 }); }));
      });
      if (t >= 2) m.with(() => { m.move(0.1, -0.3, 0.0); pricklyPear(m, 0.16); });
    });
    m.at(s.top, () => {
      // a pennant on a crooked stick, and the den's own cactus
      m.cylinder([-0.14, 0.08, 0.36], [-0.17, 0.1, 0.72 + 0.04 * t], 0.016, P.woodDk, 0.012, { segs: 5 });
      const w = 0.03 * p.wave(1);
      m.poly([[-0.17, 0.1, 0.74 + 0.04 * t], [-0.17, 0.1, 0.5 + 0.04 * t], [-0.3, 0.32 + w, 0.56 + 0.04 * t], [-0.36, 0.5 + w, 0.64 + 0.04 * t]], P.teamFlat);
      if (t >= 4) m.sphere([-0.17, 0.1, 0.74 + 0.04 * t], 0.035, P.glory, { segs: 6 });
      if (p.after) puff(m, [0.4, 0, 0.12], 0.1, p.hit ? 0.2 : 0.7, P.dust, 3);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0.05, 0.02, 0.3], 0.16, p.dead, P.dust, 5);
  },
};

// ------------------------------------------------------------------------------------------------ scorpions
/** A scorpion's raised tail and pincers on a crawler body frame. */
function scorpionParts(m: Model, p: Pose, len: number, shell: Material, sting: Material) {
  const strike = Math.max(0, p.blend), curl = p.is("death") ? 0.3 : 1;
  m.tube([[-len * 0.8, 0, 0.02], [-len * 1.5, 0, len * 0.5 * curl], [-len * 1.2, 0, len * 1.3 * curl], [-len * 0.3 + len * 0.8 * strike, 0, len * (1.5 - 0.5 * strike) * curl]], [len * 0.3, len * 0.26, len * 0.2, len * 0.16], shell, { segs: 6 });
  m.cone([-len * 0.3 + len * 0.8 * strike, 0, len * (1.5 - 0.5 * strike) * curl], [len * 0.25 + len * 1.0 * strike, 0, len * (1.25 - 0.6 * strike) * curl], len * 0.17, sting, { segs: 5 });
  for (const s of [1, -1]) m.group(() => {
    m.tube([[len * 0.75, s * len * 0.35, 0], [len * 1.3, s * len * 0.75, 0.01], [len * (1.7 + 0.3 * strike), s * len * 0.5, 0.01]], [len * 0.14, len * 0.13, len * 0.2], shell, { segs: 5 });
    m.cone([len * (1.7 + 0.3 * strike), s * len * 0.5, 0.01], [len * (2.2 + 0.3 * strike), s * len * 0.34, 0.01], len * 0.15, shell, { segs: 4 });
  });
}
/** Scorpling: a sand scorpion the size of a boot. */
export const mite: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = crawler(m, p, { height: 0.09, length: 0.12, width: 0.075, leg: P.hideDk, legR: 0.017, stride: 0.17 });
    m.at(c.body, () => {
      m.ellipsoid([0, 0, 0.01], [0.13, 0.085, 0.06], P.hideLt);
      m.decal(0.01, () => m.ellipsoid([-0.02, 0, 0.035], [0.09, 0.07, 0.045], P.team));
      m.decal(0.02, () => { for (const s of [1, -1]) m.sphere([0.11, s * 0.03, 0.035], 0.015, P.black, { segs: 4 }); });
      scorpionParts(m, p, 0.1, P.hideLt, P.red);
    });
  },
};
/** Scorpion Queen: black, banded in the side's colour, a sting that glows. */
export const queen: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = crawler(m, p, { height: 0.15, length: 0.2, width: 0.115, legs: 4, leg: P.black, foot: P.hideDk, legR: 0.026, stride: 0.28, splay: 2.2 });
    m.at(c.body, () => {
      m.group(() => { m.ellipsoid([-0.03, 0, 0.03], [0.22, 0.15, 0.1], P.black); m.sphere([0.16, 0, 0.02], 0.09, P.black); });
      m.decal(0.012, () => m.group(() => { for (const x of [-0.16, -0.06, 0.04]) m.torus([x, 0, 0.03], [1, 0, 0], 0.118 - Math.abs(x + 0.06) * 0.25, 0.022, P.team, { segs: 10 }); }));
      m.decal(0.02, () => { for (const s of [1, -1]) m.sphere([0.235, s * 0.04, 0.05], 0.022, p.is("death") && p.i > 2 ? P.feltDk : P.fire, { segs: 5 }); });
      scorpionParts(m, p, 0.16, P.black, P.ember);
      m.cone([0.02, 0, 0.12], [0.0, 0, 0.2], 0.03, GOLD, { segs: 5 });
    });
  },
};
void core; void wisp;
