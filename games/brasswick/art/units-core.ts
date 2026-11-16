// Brasswick units, first set: the four that proved the kit (a rifleman, a clockwork giant, a foundry, an ornithopter).
import { flyer, gripAim, humanoid, structure, type Pose, type UnitDef } from "../../../artkit/rig";
import { Model, type V3 } from "../../../artkit/toon3d";
import { GOLD, P, arcBolt, boiler, core, dial, flash, flatCap, gear, goggles, moustache, porthole, puff, rivets, stack, topHat, trim, vent } from "./parts";

/** A long steam-rifle along +x from the trigger hand: stock, brass barrel, a pressure bulb under it. */
export function rifle(m: Model, tier: number, len = 0.52) {
  m.group(() => {
    m.box([-0.07, 0, -0.02], [0.2, 0.05, 0.075], P.wood);
    m.box([0.08, 0, 0], [0.16, 0.055, 0.06], P.ironDk);
  });
  m.cylinder([0.1, 0, 0.012], [len, 0, 0.012], 0.027, tier >= 3 ? P.brass : P.steel, 0.023, { segs: 8 });
  m.cylinder([len - 0.05, 0, 0.012], [len, 0, 0.012], 0.036, trim(Math.max(2, tier)), 0.036, { segs: 8 });
  m.sphere([0.13, 0, -0.045], 0.042, tier >= 2 ? P.copper : P.brassDk, { segs: 8 });
  if (tier >= 3) m.cylinder([0.05, 0, 0.05], [0.2, 0, 0.05], 0.018, P.brass, 0.022, { segs: 8 }); // scope
  if (tier >= 4) m.sphere([0.13, 0, -0.045], 0.03, P.aether, { segs: 8 });
}

/** Ranger: a rifleman in a long team coat and flat cap. Keeps his distance; the rifle is the silhouette. */
export const ranger: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.06, 0.13, 0.33], [0.04, 0.1, 0.47], { wind: [0.02, 0.12, 0.44] });
    const L = p.mix<V3>([0.25, -0.05, 0.4], [0.3, 0.0, 0.485], { wind: [0.2, -0.02, 0.56] });
    const h = humanoid(m, p, { weight: "light", bulk: 0.92, skin: P.skin, torso: P.team, legs: P.wool, boots: P.leatherDk, hands: P.leather, handR: R, handL: L, lunge: 0, recoil: 0.035, swingR: 0.3, swingL: 0.3 });
    // coat skirt and a bandolier
    m.at(h.hips, () => m.cylinder([0, 0, 0.1], [-0.01, 0, -0.07], 0.15, P.team, 0.19));
    m.at(h.chest, () => {
      m.decal(0.02, () => m.torus([0, 0, 0.02], [0.5, 0.75, 0.6], 0.165, 0.028, P.leather, { segs: 14 }));
      if (t >= 2) m.sphere([-0.02, 0.17, 0.13], 0.07, trim(t)), m.sphere([-0.02, -0.17, 0.13], 0.07, trim(t));
    });
    if (t >= 3) m.at(h.back, () => { boiler(m, 0.06, 0.16, P.copper, P.brass); if (t >= 4) m.sphere([0, 0, 0.2], 0.05, P.aether); });
    m.at(h.head, () => {
      if (t >= 3) topHat(m, 0.19, 0.17, P.soot, P.teamDk); else flatCap(m, 0.19, t === 2 ? P.leatherDk : P.wool);
      goggles(m, 0.19, core(t), trim(Math.max(2, t)), t >= 3 ? 0 : 1);
    });
    m.at(gripAim(h.pR, h.pL), () => {
      rifle(m, t, 0.5 + 0.03 * t);
      if (p.hit) flash(m, [0.56 + 0.03 * t, 0, 0.012], 0.075);
      if (p.after) puff(m, [0.62 + 0.03 * t + (p.hit ? 0 : 0.06), 0, 0.05], 0.06, p.hit ? 0.2 : 0.7);
    });
  },
};

/** Stone Colossus: a clockwork automaton, a walking boiler on piston legs with a wind-up key. The slow giant. */
function automaton(m: Model, p: Pose, size: number, tier: number, small = false) {
  const bodyM = small ? P.brassDk : P.copper;
  const R = p.mix<V3>([0.06, 0.3, 0.2], [0.36, 0.15, 0.12], { wind: [0.0, 0.25, 0.8] });
  const L = p.mix<V3>([0.06, -0.3, 0.2], [0.36, -0.15, 0.12], { wind: [0.0, -0.25, 0.8] });
  const h = humanoid(m, p, { size, bulk: 1.25, leg: small ? 1.15 : 1.5, weight: "heavy", skin: P.iron, torso: bodyM, legs: P.ironDk, boots: P.iron, arms: P.ironDk, hands: P.iron, handR: R, handL: L, noHead: true, noTorso: true, lunge: 0.7, stride: 0.34, lean: 3 });
  m.at(h.hips, () => m.cylinder([0, 0, -0.05], [0, 0, 0.05], 0.14, P.ironDk, 0.17));
  m.at(h.chest, () => {
    // the boiler: a tall riveted drum with a domed top
    m.group(() => {
      m.cylinder([0, 0, -0.12], [0, 0, 0.2], 0.19, bodyM, 0.215);
      m.ellipsoid([0, 0, 0.2], [0.215, 0.215, 0.1], bodyM);
    });
    m.cylinder([0, 0, -0.09], [0, 0, -0.03], 0.2, trim(tier), 0.205);
    m.cylinder([0, 0, 0.1], [0, 0, 0.19], 0.225, P.team, 0.225);
    // furnace grate in the belly, glowing
    m.with(() => { m.move(0.185, 0, 0.03); porthole(m, 0.08, tier >= 4 ? P.aether : P.fire); });
    if (tier >= 2) rivets(m, [-0.5, -0.25, 0.25, 0.5].map((a) => [0.215 * Math.cos(a * 2), 0.215 * Math.sin(a * 2), 0.06] as V3), 0.018);
    // shoulders
    for (const s of [1, -1]) m.sphere([0, s * 0.215, 0.13], small ? 0.085 : 0.1, P.team);
    // the wind-up key turns as it walks
    if (!small) m.with(() => {
      m.move(-0.2, 0, 0.06);
      m.cylinder([0, 0, 0], [-0.1, 0, 0], 0.025, P.ironDk);
      m.move(-0.1, 0, 0).rotX(p.is("death") ? 20 : p.t * 180 + p.i * 30);
      m.group(() => { m.torus([-0.01, 0, 0.065], [1, 0, 0], 0.055, 0.022, P.brass, { segs: 10 }); m.torus([-0.01, 0, -0.065], [1, 0, 0], 0.055, 0.022, P.brass, { segs: 10 }); });
    });
    if (!small) m.with(() => { m.move(-0.09, 0.11, 0.24); stack(m, 0.045, 0.16 + 0.03 * tier, P.ironDk, trim(tier)); if (!p.is("death")) vent(m, p, [0, 0, 0.24 + 0.03 * tier], 0.06, P.smoke); });
    if (tier >= 3 && !small) m.with(() => { m.move(-0.09, -0.11, 0.24); stack(m, 0.04, 0.16, P.ironDk, trim(tier)); });
  });
  m.at(h.head, () => {
    m.move(0.03, 0, 0.0);
    m.group(() => { m.cylinder([0, 0, -0.07], [0, 0, 0.05], 0.125, P.iron, 0.115); m.ellipsoid([0, 0, 0.05], [0.115, 0.115, 0.08], P.iron); });
    m.decal(0.03, () => m.box([0.11, 0, 0.0], [0.03, 0.16, 0.05], p.is("death") && p.i > 2 ? P.soot : tier >= 4 ? P.aether : P.lamp));
    if (tier >= 2) m.cylinder([0, 0, -0.075], [0, 0, -0.045], 0.14, trim(tier), 0.14);
    if (tier >= 3) m.cone([0, 0, 0.11], [0, 0, 0.24], 0.045, trim(tier));
  });
  // great riveted fists
  for (const ph of [h.pR, h.pL]) m.sphere(ph, (small ? 0.1 : 0.12) * size, tier >= 3 && !small ? P.brass : P.iron);
  if (p.hit) for (const ph of [h.pR, h.pL]) puff(m, [ph[0] + 0.05, ph[1], 0.05], 0.07 * size, 0.3, P.steam, 2);
}
export const golem: UnitDef = { weight: "heavy", build: (m, p) => automaton(m, p, 1.3, p.tier) };
/** Shardling: half of a fallen automaton, still walking: smaller, brass-dull, no key or stack. */
export const golemling: UnitDef = { weight: "heavy", build: (m, p) => automaton(m, p, 0.95, 1, true) };

/** Hive: a drone foundry. A squat furnace with a smoking stack and a hatch that coughs out clockwork mites. */
export const hive: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.02 });
    m.at(s.base, () => {
      // brick base and iron skirt
      m.cylinder([0, 0, 0], [0, 0, 0.1], 0.4, P.ironDk, 0.38, { segs: 8 });
      m.group(() => {
        m.cylinder([0, 0, 0.08], [0, 0, 0.4], 0.33, P.copperDk, 0.27, { segs: 10 });
        m.ellipsoid([0, 0, 0.4], [0.27, 0.27, 0.16], P.copper);
      });
      m.cylinder([0, 0, 0.2], [0, 0, 0.26], 0.325, trim(t), 0.31, { segs: 10 });
      // the hatch: glows, and gapes on the spawn
      const open = p.mix(0, 1, { wind: 0.3 });
      m.with(() => {
        m.move(0.3, 0, 0.17);
        m.cylinder([-0.05, 0, 0], [0.03, 0, 0], 0.13, P.iron, 0.13, { segs: 10 });
        m.decal(0.03, () => m.cylinder([0.03, 0, 0], [0.04, 0, 0], 0.095, t >= 4 ? P.aether : P.fire, 0.095, { segs: 10 }));
        m.with(() => { m.move(0.045, 0.1, 0).rotZ(-100 * open); m.cylinder([0, -0.1, 0], [0.025, -0.1, 0], 0.105, P.ironDk, 0.105, { segs: 10 }); });
      });
      // team plate and a turning gear on the flank
      for (const sd of [1, -1]) m.with(() => {
        m.move(-0.04, sd * 0.31, 0.3).rotZ(sd * 8);
        gear(m, 0.11 + 0.01 * t, 0.04, t >= 3 ? P.brass : P.brassDk, 8, (p.is("death") ? 0 : p.i * 15) * sd);
      });
      m.decal(0.02, () => m.cylinder([0, 0, 0.3], [0, 0, 0.37], 0.305, P.team, 0.275, { segs: 10 }));
      if (t >= 2) m.with(() => { m.move(0.18, 0.2, 0.42); m.rotZ(48); dial(m, 0.06, p.i * 40); });
      if (t >= 3) m.with(() => { m.move(-0.2, -0.12, 0.42); stack(m, 0.05, 0.26, P.ironDk, trim(t)); vent(m, p, [0, 0, 0.3], 0.06, P.smoke, 0.5); });
    });
    m.at(s.top, () => {
      m.move(-0.06, 0.08, 0.46);
      stack(m, 0.085, 0.3 + 0.04 * t, P.ironDk, trim(t));
      if (t >= 4) m.torus([0, 0, 0.2], [0, 0, 1], 0.1, 0.022, P.aether);
      if (!p.is("death")) vent(m, p, [0, 0, 0.36 + 0.04 * t], 0.09, P.smoke);
      if (p.after) puff(m, [0, 0, 0.42 + 0.04 * t], 0.13, p.hit ? 0.2 : 0.7, P.smoke, 3);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0.05, 0.02, 0.3], 0.16, p.dead, P.smoke, 5);
  },
};

/** Harrier: a one-man ornithopter. Canvas wings in team colour beat over a brass hull; it only ever dives. */
export const harrier: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.24 });
    m.at(f.body, () => {
      // hull: a brass gondola with a keel
      m.group(() => {
        m.ellipsoid([0, 0, 0], [0.25, 0.115, 0.1], t >= 3 ? P.brass : P.copper);
        m.cone([0.2, 0, 0], [0.37, 0, 0.01], 0.06, trim(Math.max(2, t)), { segs: 8 });
      });
      m.decal(0.02, () => m.ellipsoid([0.02, 0, 0.02], [0.2, 0.118, 0.045], P.team));
      // pilot: head, goggles, scarf streaming back
      m.with(() => {
        m.move(0.0, 0, 0.14);
        m.sphere([0, 0, 0], 0.105, P.skin);
        m.ellipsoid([-0.01, 0, 0.035], [0.11, 0.11, 0.085], P.leatherDk);
        goggles(m, 0.105, core(t), P.brass, 0);
        m.capsule([-0.07, 0, -0.06], [-0.22, 0.03 * p.wave(1, 2), -0.03 + 0.03 * p.wave(1, 2, 0.3)], 0.035, P.white, 0.02, { segs: 6 });
      });
      // tail fin and prop
      m.with(() => { m.move(-0.25, 0, 0.02); m.extrude([[0, 0], [-0.16, 0.14], [-0.2, 0.14], [-0.14, -0.02]], 0.02, P.team); });
      m.with(() => { m.move(-0.3, 0, -0.02).rotX(f.spin * 3); m.group(() => { m.box([0, 0, 0], [0.02, 0.2, 0.035], P.woodDk); m.box([0, 0, 0], [0.02, 0.035, 0.2], P.woodDk); }); });
      // wings: two ribs and canvas, beating
      const ang = 12 + 34 * f.flap;
      for (const s of [1, -1]) m.with(() => {
        m.move(0.03, s * 0.09, 0.05).rotX(-s * ang);
        const tip = 0.5 + 0.03 * t;
        m.group(() => {
          m.poly([[0.13, 0, 0], [0.16, s * tip * 0.55, 0.01], [0.05, s * tip, 0], [-0.13, s * tip * 0.8, 0], [-0.17, s * tip * 0.4, 0], [-0.1, 0, 0]], P.team);
        });
        m.tube([[0.12, 0, 0.005], [0.15, s * tip * 0.55, 0.015], [0.05, s * tip, 0.005]], 0.016, trim(Math.max(2, t)), { segs: 5 });
        m.decal(0.01, () => m.tube([[-0.02, 0, 0.004], [-0.13, s * tip * 0.8, 0.004]], 0.009, P.teamDk, { segs: 4 }));
        if (t >= 4) m.sphere([0.05, s * tip, 0.005], 0.03, P.aether);
      });
      if (t >= 2) for (const s of [1, -1]) m.cylinder([-0.12, s * 0.1, -0.03], [-0.26, s * 0.1, -0.03], 0.03, P.ironDk, 0.035, { segs: 8 });
      if (t >= 4) m.sphere([-0.28, 0.1, -0.03], 0.03, P.aether), m.sphere([-0.28, -0.1, -0.03], 0.03, P.aether);
      // talon hooks under the hull for the dive
      const drop = p.mix(0, 1, { wind: 0.3 });
      for (const s of [1, -1]) m.tube([[0.1, s * 0.05, -0.08], [0.16, s * 0.06, -0.12 - 0.05 * drop], [0.23 + 0.04 * drop, s * 0.06, -0.1 - 0.08 * drop]], [0.02, 0.016, 0.006], P.steel, { segs: 5 });
      if (p.is("death")) puff(m, [-0.2, 0, 0.1], 0.1, p.dead, P.smoke, 4);
    });
    void arcBolt; void moustache; void GOLD;
  },
};
