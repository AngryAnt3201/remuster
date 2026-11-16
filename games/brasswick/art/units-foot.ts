// Brasswick's foot soldiers: every unit that walks on two legs. Each is the humanoid rig plus the hat, the tool and
// the pack that make its job readable from above: the silhouette says what it does, the coat says whose it is.
import { humanoid, type HumanoidOpts, type HumanoidRig, type Pose, type UnitDef } from "../../../artkit/rig";
import { Model, frameAt, mat, norm, type Material, type V3 } from "../../../artkit/toon3d";
import { GOLD, P, arcBolt, boiler, bowler, core, dial, flash, flatCap, gear, goggles, helmet, lantern, moustache, puff, stack, topHat, trim, vent } from "./parts";

/** The Ascended ring: lit, but crisp (no halo), so it stays readable and cheap in every frame. */
const HALO = { color: "#ffffff", team: "light" as const, emit: 1 };
const PLUM = mat("#54486a");
const SLASH = mat("#fffbe8", { emit: 1, ink: false, alpha: 0.92 });
const WATER = mat("#7fd4f2", { emit: 0.6, ink: false, alpha: 0.9, metal: 0.6 });
const MIST = mat("#b9f5c0", { emit: 0.9, ink: false, alpha: 0.8, glow: 0.4 });

/** The humanoid with Brasswick's defaults: team coat, wool trousers, dark boots. */
function gent(m: Model, p: Pose, o: Partial<HumanoidOpts>): HumanoidRig {
  return humanoid(m, p, { skin: P.skin, torso: P.team, legs: P.wool, boots: P.leatherDk, ...o });
}
/** The Ascended mark: a ring of glowing aether turning over the head. Call inside the head frame. */
function halo(m: Model, p: Pose, r = 0.19, z = 0.36) {
  if (p.tier < 4) return;
  m.with(() => { m.move(0, 0, z).rotZ(p.i * 20); m.torus([0, 0, 0], [0.15, 0, 1], r * 0.72, 0.022, HALO, { segs: 14 }); });
}
/** A coat skirt hanging from the hips. */
const skirt = (m: Model, h: HumanoidRig, col: Material, len = 0.07, flare = 0.19) => m.at(h.hips, () => m.cylinder([0, 0, 0.1], [-0.01, 0, -len], 0.15, col, flare));
/** Epaulettes in the rank's metal. */
function epaulettes(m: Model, h: HumanoidRig, tier: number, r = 0.065) {
  if (tier < 2) return;
  m.at(h.chest, () => { for (const s of [1, -1]) m.ellipsoid([-0.01, s * 0.18, 0.135], [r, r * 1.05, r * 0.6], trim(tier)); });
}
/** A crescent of light where a blade passed: an arc of radius r about body point c, from a0 to a1 degrees (0 = ahead,
 *  90 = the body's right). */
function slashArc(m: Model, h: HumanoidRig, c: V3, r: number, a0: number, a1: number, dz = 0, col: Material = SLASH) {
  const pts: V3[] = [], rad: number[] = [], n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    pts.push(h.pt([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + dz * (t - 0.5)]));
    rad.push(0.008 + 0.034 * Math.sin(Math.PI * t) * h.size);
  }
  m.tube(pts, rad, col, { segs: 5 });
}
/** Overhead chop with the right hand: where the hand is and where the weapon points. */
function chop(p: Pose): { hand: V3; aim: V3 } {
  return {
    hand: p.mix<V3>([0.14, 0.2, 0.38], [0.32, 0.08, 0.3], { wind: [-0.04, 0.24, 0.68] }),
    aim: norm(p.mix<V3>([0.45, 0.1, 1], [1, -0.25, -0.3], { wind: [-0.5, 0.15, 1] })),
  };
}
/** Straight thrust with the right hand. */
function thrust(p: Pose, reach = 0.34): { hand: V3; aim: V3 } {
  return {
    hand: p.mix<V3>([0.12, 0.2, 0.38], [reach, 0.1, 0.42], { wind: [-0.08, 0.22, 0.44] }),
    aim: norm(p.mix<V3>([1, 0, 0.35], [1, -0.05, 0], { wind: [1, 0.05, 0.12] })),
  };
}
/** A sabre along +x from the grip. */
function sabre(m: Model, len: number, blade: Material = P.steel, guard: Material = P.brass) {
  m.extrude([[0.04, -0.018], [len * 0.7, -0.02], [len, 0.03], [len * 0.7, 0.026], [0.04, 0.018]], 0.014, blade);
  m.group(() => { m.box([0.03, 0, 0], [0.025, 0.09, 0.06], guard); m.capsule([-0.06, 0, 0], [0.02, 0, 0], 0.02, P.leatherDk, 0.02, { segs: 6 }); });
}
/** A long shaft along +x from the grip, from -back to +front. */
const shaft = (m: Model, back: number, front: number, r = 0.016, col: Material = P.wood) => m.cylinder([-back, 0, 0], [front, 0, 0], r, col, r, { segs: 6 });

// ------------------------------------------------------------------------------------------------ melee
/** Blade Trio: three street sabreurs in bowlers. Light, quick, always in a pack. */
export const blades: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const h = gent(m, p, { weight: "light", bulk: 0.9, size: 0.94, handR: c.hand, twist: 28, torso: P.team, arms: P.cloth, hands: P.skin });
    m.at(h.chest, () => m.decal(0.02, () => m.torus([0, 0, -0.06], [0, 0, 1], 0.165, 0.03, P.leatherDk, { segs: 12 })));
    epaulettes(m, h, t, 0.05);
    m.at(h.head, () => { bowler(m, 0.19, t >= 3 ? P.leatherDk : P.soot, P.team); if (t >= 2) goggles(m, 0.19, core(t), trim(t), 1); if (t >= 3) moustache(m, 0.19); halo(m, p); });
    m.at(h.aim("R", c.aim), () => sabre(m, 0.36 + 0.02 * t, t >= 4 ? GOLD : P.steel, trim(Math.max(2, t))));
    if (p.hit) slashArc(m, h, [0.05, 0, 0.36], 0.42, 70, -45, -0.25);
  },
};

/** Duelist: a cane-sword gentleman, top hat and half cape. Parries, then runs you through. */
export const duelist: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, th = thrust(p, 0.38);
    const parry = p.is("cast");
    const hand = parry ? p.mix<V3>([0.12, 0.2, 0.38], [0.24, 0.02, 0.56], { castWind: [0.1, 0.24, 0.4] }) : th.hand;
    const aim = parry ? norm(p.mix<V3>([1, 0, 0.35], [0.1, -0.9, 0.5], { castWind: [1, 0.2, 0.3] })) : th.aim;
    const h = gent(m, p, { weight: "light", bulk: 0.88, handR: hand, handL: p.mix<V3>([-0.04, -0.24, 0.34], [-0.14, -0.26, 0.42]), torso: P.soot, arms: P.soot, legs: P.wool, lunge: parry ? 0 : 1.2 });
    m.at(h.chest, () => {
      m.decal(0.02, () => m.ellipsoid([0.1, 0, 0.02], [0.06, 0.09, 0.13], P.white)); // shirt front
      // half cape off the left shoulder, in team colour
      m.extrude([[-0.02, 0.16], [-0.2, 0.1], [-0.26 - 0.03 * p.wave(1, 1), -0.2], [-0.08, -0.22]], 0.3, P.team);
    });
    epaulettes(m, h, t, 0.05);
    m.at(h.head, () => { topHat(m, 0.19, 0.2 + 0.02 * t, P.soot, P.team); moustache(m, 0.19); if (t >= 3) goggles(m, 0.19, core(t), GOLD, 0); halo(m, p, 0.19, 0.5); });
    m.at(h.aim("R", aim), () => {
      m.cylinder([0.03, 0, 0], [0.5 + 0.03 * t, 0, 0], 0.014, t >= 4 ? GOLD : P.steel, 0.005, { segs: 6 });
      m.group(() => { m.sphere([0.02, 0, 0], 0.04, trim(Math.max(2, t)), { segs: 8 }); m.capsule([-0.07, 0, 0], [0, 0, 0], 0.018, P.soot, 0.018, { segs: 6 }); });
    });
    if (p.hit && !parry) m.at(h.aim("R", aim), () => m.cone([0.3, 0, 0], [0.85, 0, 0], 0.03, SLASH, { segs: 6 }));
    if (p.hit && parry) m.at(h.aim("R", aim), () => flash(m, [0.3, 0, 0], 0.07, SLASH, SLASH));
  },
};

/** Ravager: a furnace-masked brute with a steam buzz-saw for an arm. Hunts the biggest thing on the field. */
export const ravager: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const h = gent(m, p, { weight: "heavy", bulk: 1.28, size: 1.06, handR: c.hand, handL: p.mix<V3>([0.12, -0.26, 0.34], [0.2, -0.2, 0.4], { wind: [0.0, -0.28, 0.5] }), twist: 30, torso: P.leather, arms: P.skinDk, skin: P.skinDk, legs: P.ironDk, boots: P.iron, hands: P.ironDk });
    m.at(h.chest, () => {
      m.decal(0.02, () => { m.torus([0, 0, 0.0], [0.55, 0.8, 0.5], 0.21, 0.035, P.team, { segs: 14 }); m.torus([0, 0, 0.0], [0.55, -0.8, 0.5], 0.21, 0.035, P.team, { segs: 14 }); });
      m.with(() => { m.move(-0.19, 0, 0.0); boiler(m, 0.085, 0.2, P.copper, trim(t)); m.move(0, 0, 0.25); stack(m, 0.035, 0.12, P.ironDk, trim(t)); vent(m, p, [0, 0, 0.16], 0.055, P.smoke); });
      for (const s of [1, -1]) m.sphere([0, s * 0.215, 0.13], 0.085, s > 0 ? P.iron : P.team);
    });
    m.at(h.head, () => {
      // riveted furnace mask: slit eyes glowing
      m.group(() => m.cylinder([0.0, 0, -0.14], [0.02, 0, 0.1], 0.2, P.iron, 0.19, { segs: 10 }));
      m.decal(0.03, () => { for (const s of [1, -1]) m.box([0.19, s * 0.075, 0.0], [0.03, 0.07, 0.035], t >= 4 ? P.aether : P.fire); m.box([0.195, 0, -0.09], [0.02, 0.14, 0.02], P.soot); });
      if (t >= 2) for (const s of [1, -1]) m.cone([0, s * 0.17, 0.08], [0, s * 0.3, 0.2], 0.045, trim(t), { segs: 6 });
      if (t >= 3) m.extrude([[-0.12, 0.1], [0.1, 0.1], [0.06, 0.24], [-0.02, 0.19], [-0.1, 0.25]], 0.03, P.team);
      halo(m, p, 0.2, 0.4);
    });
    // the saw: an arm-mounted disc that spins
    m.at(h.aim("R", c.aim), () => {
      m.box([0.1, 0, 0], [0.22, 0.07, 0.07], P.ironDk);
      m.with(() => { m.move(0.3, 0, 0).rotY(p.i * 37 + (p.is("attack") ? 20 : 0)); gear(m, 0.17 + 0.01 * t, 0.025, t >= 4 ? GOLD : P.steel, 12, 0, trim(Math.max(2, t))); });
    });
    if (p.hit) { slashArc(m, h, [0.1, 0, 0.3], 0.46, 60, -50, -0.2); m.at(h.aim("R", c.aim), () => flash(m, [0.42, 0, 0], 0.06)); }
  },
};

/** Lionheart: the marshal. Plumed shako, greatcoat, brass arm, a sabre as long as he is. Rallies as he kills. */
export const lion: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), rally = p.is("cast");
    const hand = rally ? p.mix<V3>([0.14, 0.2, 0.38], [0.1, 0.2, 0.86], { castWind: [0.16, 0.2, 0.3] }) : c.hand;
    const aim = rally ? norm(p.mix<V3>([0.45, 0.1, 1], [0.1, 0, 1], { castWind: [1, 0, 0] })) : c.aim;
    const h = gent(m, p, { weight: "heavy", bulk: 1.18, size: 1.12, handR: hand, handL: p.mix<V3>([0.1, -0.24, 0.34], [0.02, -0.28, 0.42], { cast: [0.16, -0.2, 0.6] }), twist: rally ? 0 : 26, torso: P.team, arms: P.team, hands: P.brass, legs: P.white, boots: P.soot });
    skirt(m, h, P.teamDk, 0.12, 0.23);
    m.at(h.chest, () => {
      m.decal(0.02, () => { for (const z of [0.09, 0.02, -0.05]) for (const s of [1, -1]) m.sphere([0.135, s * 0.05, z], 0.02, GOLD, { segs: 6 }); m.torus([0, 0, -0.08], [0, 0, 1], 0.19, 0.03, P.white, { segs: 12 }); });
      for (const s of [1, -1]) { m.ellipsoid([-0.01, s * 0.2, 0.14], [0.085, 0.095, 0.05], GOLD); if (t >= 2) m.cylinder([-0.01, s * 0.2, 0.13], [-0.01, s * 0.2, 0.07], 0.095, GOLD, 0.1, { segs: 10 }); }
      // cloak down the back
      m.extrude([[-0.13, 0.17], [-0.17, 0.0], [-0.22 - 0.02 * p.wave(1), -0.3], [-0.12, -0.3]], 0.36, t >= 3 ? P.red : P.teamDk);
    });
    m.at(h.head, () => {
      m.group(() => { m.cylinder([0, 0, 0.06], [0, 0, 0.3], 0.16, P.soot, 0.18); m.cylinder([0.08, 0, 0.07], [0.2, 0, 0.05], 0.12, P.soot, 0.1, { segs: 8 }); });
      m.cylinder([0, 0, 0.07], [0, 0, 0.13], 0.17, GOLD, 0.172);
      m.decal(0.02, () => m.sphere([0.16, 0, 0.2], 0.045, GOLD, { segs: 8 }));
      m.capsule([0.05, 0, 0.3], [0.0, 0, 0.5 + 0.03 * t], 0.05, t >= 4 ? P.aether : P.red, 0.07 + 0.01 * t, { segs: 8 });
      moustache(m, 0.19, P.white); if (t >= 3) goggles(m, 0.19, core(t), GOLD, 0);
    });
    m.at(h.aim("R", aim), () => sabre(m, 0.5 + 0.03 * t, t >= 4 ? P.aether : P.steel, GOLD));
    if (p.hit && !rally) slashArc(m, h, [0.05, 0, 0.36], 0.56, 75, -50, -0.3);
    if (rally && p.after) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + p.i; m.sphere(h.pt([0.1 + 0.3 * Math.cos(a), 0.3 * Math.sin(a), 0.95]), 0.03, P.lamp, { segs: 6 }); }
  },
};

// ------------------------------------------------------------------------------------------------ tanks
/** Bulwark: a stoker behind a boiler door. The shield is the unit: wide, riveted, team-painted, always in front. */
export const bulwark: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const sh = p.mix<V3>([0.24, -0.1, 0.36], [0.3, -0.06, 0.38], { wind: [0.2, -0.14, 0.36] });
    const h = gent(m, p, { weight: "heavy", bulk: 1.3, size: 1.1, handR: c.hand, handL: sh, twist: 14, lunge: 0.6, torso: P.iron, arms: P.ironDk, legs: P.ironDk, boots: P.iron, hands: P.leatherDk });
    m.at(h.chest, () => { for (const s of [1, -1]) m.sphere([0, s * 0.22, 0.13], 0.1, P.team); m.cylinder([0, 0, -0.1], [0, 0, -0.04], 0.2, trim(t), 0.2); });
    m.at(h.head, () => {
      helmet(m, 0.19, P.iron, trim(t));
      m.decal(0.03, () => m.box([0.2, 0, 0.02], [0.03, 0.2, 0.035], P.soot));
      m.with(() => { m.move(-0.05, 0, 0.3); stack(m, 0.045, 0.1 + 0.03 * t, P.ironDk, trim(t)); vent(m, p, [0, 0, 0.16 + 0.03 * t], 0.05, P.steam); });
      halo(m, p, 0.2, 0.3);
    });
    // the boiler-door shield, facing forward
    m.at(frameAt(h.pL, h.dir([1, -0.12, 0])), () => {
      const r = 0.3 + 0.012 * t;
      m.move(0.04, 0, 0.0);
      m.cylinder([0, 0, 0], [0.05, 0, 0], r, P.ironDk, r, { segs: 12 });
      m.decal(0.01, () => m.cylinder([0.05, 0, 0], [0.065, 0, 0], r * 0.84, P.team, r * 0.84, { segs: 12 }));
      m.decal(0.02, () => { m.cylinder([0.06, 0, 0], [0.09, 0, 0], r * 0.3, trim(Math.max(2, t)), r * 0.24, { segs: 10 }); m.box([0.07, 0, 0], [0.012, r * 1.7, 0.035], t >= 3 ? trim(t) : P.teamDk); });
      m.decal(0.03, () => m.group(() => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; m.sphere([0.055, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92], 0.022, P.brass, { segs: 6 }); } }));
      if (t >= 4) m.decal(0.04, () => m.sphere([0.085, 0, 0], r * 0.16, P.aether, { segs: 8 }));
    });
    // a stoker's shovel-mace
    m.at(h.aim("R", c.aim), () => { shaft(m, 0.06, 0.3, 0.02, P.woodDk); m.sphere([0.32, 0, 0], 0.075, trim(Math.max(2, t)), { segs: 8 }); });
    if (p.hit) puff(m, h.pt([0.45, 0.05, 0.1]), 0.07, 0.3, P.steam, 2);
  },
};

/** Pikeman: a constable with a shock-pike twice his height. Braces it against a charge. */
export const pikeman: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, th = thrust(p, 0.34), brace = p.is("cast");
    const hand = brace ? p.mix<V3>([0.12, 0.2, 0.38], [0.06, 0.16, 0.22], { castWind: [0.1, 0.2, 0.42] }) : th.hand;
    const aim = brace ? norm(p.mix<V3>([1, 0, 0.35], [1, -0.05, 0.42], { castWind: [1, 0, 0.3] })) : th.aim;
    const h = gent(m, p, { weight: "mid", bulk: 1.05, handR: hand, handL: [hand[0] + aim[0] * 0.26, hand[1] - 0.16, hand[2] + aim[2] * 0.26 + 0.01], torso: P.team, arms: P.team, legs: P.soot, boots: P.soot, lunge: brace ? -0.5 : 0.9 });
    skirt(m, h, P.team, 0.05, 0.18);
    m.at(h.chest, () => m.decal(0.02, () => { m.torus([0, 0, -0.07], [0, 0, 1], 0.185, 0.028, P.soot, { segs: 12 }); for (const z of [0.1, 0.03]) m.sphere([0.14, 0, z], 0.02, trim(Math.max(2, t)), { segs: 6 }); }));
    epaulettes(m, h, t);
    m.at(h.head, () => {
      // custodian helmet: tall dome, badge, spike
      m.group(() => { m.ellipsoid([-0.01, 0, 0.12], [0.185, 0.185, 0.24], P.soot); m.cylinder([0, 0, 0.04], [0, 0, 0.07], 0.215, P.soot, 0.2); });
      m.decal(0.02, () => m.sphere([0.165, 0, 0.14], 0.045, trim(Math.max(2, t)), { segs: 8 }));
      m.cone([-0.01, 0, 0.33], [-0.01, 0, 0.43], 0.03, trim(Math.max(2, t)), { segs: 6 });
      moustache(m, 0.19); halo(m, p, 0.19, 0.5);
    });
    m.at(h.aim("R", aim), () => {
      const L = 0.82 + 0.04 * t;
      shaft(m, 0.22, L, 0.017, P.woodDk);
      m.cone([L, 0, 0], [L + 0.17, 0, 0], 0.04, t >= 4 ? P.aether : P.steel, { segs: 6 });
      m.cylinder([L - 0.05, 0, 0], [L, 0, 0], 0.035, trim(Math.max(2, t)), 0.035, { segs: 8 });
      m.extrude([[L - 0.02, 0], [L + 0.06, 0.1], [L + 0.1, 0.02]], 0.014, P.steel);
      if (t >= 3) m.decal(0.01, () => m.extrude([[L - 0.12, -0.01], [L - 0.12, -0.13], [L - 0.22, -0.1], [L - 0.2, -0.01]], 0.01, P.team));
      if (p.hit) flash(m, [L + 0.16, 0, 0], 0.06, P.arc, P.arcCore);
    });
  },
};

/** Hookwarden: a dock diver in a brass helmet with a harpoon winch. Reels the back line into the front. */
export const hook: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.2, 0.14, 0.36], [0.32, 0.1, 0.44], { wind: [0.06, 0.18, 0.5], cast: [0.34, 0.1, 0.46], castWind: [0.0, 0.2, 0.5] });
    const aim = norm(p.mix<V3>([1, 0, 0.1], [1, 0, 0.0], { wind: [1, 0, 0.5], castWind: [1, 0, 0.6] }));
    const h = gent(m, p, { weight: "heavy", bulk: 1.3, size: 1.1, handR: R, handL: [R[0] + 0.12, R[1] - 0.2, R[2] - 0.04], torso: P.leather, arms: P.leather, legs: P.leatherDk, boots: P.iron, hands: P.ironDk, noHead: true, lunge: 0.5, recoil: 0.03 });
    m.at(h.chest, () => {
      m.cylinder([0, 0, 0.1], [0, 0, 0.19], 0.2, P.brass, 0.17); // collar
      m.decal(0.02, () => m.torus([0, 0, -0.06], [0, 0, 1], 0.2, 0.035, P.team, { segs: 12 }));
      for (const s of [1, -1]) m.sphere([0, s * 0.22, 0.12], 0.09, P.team);
      m.with(() => { m.move(-0.2, 0, -0.02); m.rotY(-90); m.cylinder([0, -0.09, 0], [0, 0.09, 0], 0.11, P.ironDk, 0.11, { segs: 10 }); m.cylinder([0, -0.07, 0], [0, 0.07, 0], 0.125, P.wood, 0.125, { segs: 10 }); }); // winch drum
    });
    m.at(h.head, () => {
      m.sphere([0, 0, 0.0], 0.215, t >= 3 ? P.brass : P.copper);
      m.with(() => { m.move(0.17, 0, 0.0); m.cylinder([0, 0, 0], [0.06, 0, 0], 0.11, P.brassDk, 0.11, { segs: 10 }); m.decal(0.02, () => m.cylinder([0.06, 0, 0], [0.07, 0, 0], 0.08, t >= 4 ? P.aether : P.glass, 0.08, { segs: 10 })); });
      for (const s of [1, -1]) m.with(() => { m.move(0.02, s * 0.19, 0.02); m.cylinder([0, 0, 0], [0, s * 0.04, 0], 0.07, P.brassDk, 0.07, { segs: 8 }); });
      m.cylinder([0, 0, 0.19], [0, 0, 0.25], 0.06, trim(Math.max(2, t)), 0.06, { segs: 8 });
      halo(m, p, 0.21, 0.36);
    });
    m.at(h.aim("R", aim), () => {
      m.box([0.1, 0, 0], [0.3, 0.09, 0.09], P.ironDk);
      m.cylinder([0.2, 0, 0], [0.42, 0, 0], 0.045, trim(Math.max(2, t)), 0.05, { segs: 8 });
      const out = p.anim === "cast" ? Math.max(0, p.blend) * 0.3 : p.anim === "attack" ? Math.max(0, p.blend) * 0.12 : 0;
      // the hook, and its chain when it flies
      if (out > 0.02) m.tube([[0.42, 0, 0], [0.44 + out, 0, 0]], 0.014, P.iron, { segs: 5 });
      m.with(() => { m.move(0.44 + out, 0, 0); m.tube([[0, 0, 0], [0.1, 0, 0], [0.16, 0, 0.05], [0.14, 0, 0.11], [0.07, 0, 0.1]], [0.02, 0.02, 0.018, 0.014, 0.005], P.steel, { segs: 6 }); m.tube([[0.1, 0, 0], [0.16, 0, -0.05], [0.14, 0, -0.11], [0.07, 0, -0.1]], [0.02, 0.018, 0.014, 0.005], P.steel, { segs: 6 }); });
      if (p.hit) puff(m, [0.4, 0, 0.08], 0.07, 0.2, P.steam, 1);
    });
  },
};

// ------------------------------------------------------------------------------------------------ ranged, artillery
/** Grenadier: a stout bombardier with a satchel of round bombs, one always in the throwing hand, fuse lit. */
export const grenadier: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.1, 0.24, 0.4], [0.3, 0.14, 0.7], { wind: [-0.14, 0.26, 0.56] });
    const h = gent(m, p, { weight: "mid", bulk: 1.15, handR: R, twist: 24, lunge: 0.5, torso: P.team, arms: P.team, legs: P.leatherDk });
    skirt(m, h, P.teamDk, 0.04, 0.2);
    m.at(h.chest, () => {
      m.decal(0.02, () => m.torus([0, 0, 0.0], [0.5, -0.8, 0.55], 0.185, 0.03, P.leather, { segs: 14 }));
      m.with(() => { m.move(-0.02, -0.21, -0.1); m.ellipsoid([0, 0, 0], [0.12, 0.08, 0.1], P.leather); for (const [x, z] of [[0.04, 0.09], [-0.05, 0.08]]) m.sphere([x, 0, z], 0.05, P.ironDk, { segs: 8 }); });
    });
    epaulettes(m, h, t);
    m.at(h.head, () => {
      // a mitre-cap with a brass plate
      m.group(() => { m.ellipsoid([-0.02, 0, 0.14], [0.17, 0.18, 0.2], P.teamDk); });
      m.decal(0.02, () => m.extrude([[0.12, 0.02], [0.17, 0.02], [0.13, 0.3 + 0.02 * t], [0.09, 0.3 + 0.02 * t]], 0.2, trim(Math.max(2, t))));
      moustache(m, 0.19); if (t >= 3) goggles(m, 0.19, core(t), trim(t), 1); halo(m, p, 0.19, 0.48);
    });
    if (!p.after) {
      m.group(() => m.sphere(h.pR, 0.075 + 0.005 * t, t >= 3 ? P.brassDk : P.ironDk, { segs: 10 }));
      m.sphere([h.pR[0], h.pR[1], h.pR[2] + 0.1], 0.028, t >= 4 ? P.aetherInk : P.fire, { segs: 6 });
    } else puff(m, h.pt([0.36, 0.14, 0.78]), 0.05, 0.3, P.smoke, 1);
  },
};

/** Tidecaller: a fire-brigade hoseman. Brass helmet, a water tank on his back, and a hose that knocks ranks flat. */
export const tide: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.14, 0.14, 0.34], [0.2, 0.12, 0.42], { wind: [0.06, 0.14, 0.4] });
    const L = p.mix<V3>([0.3, -0.06, 0.38], [0.36, -0.02, 0.44], { wind: [0.24, -0.06, 0.5] });
    const h = gent(m, p, { weight: "mid", bulk: 1.1, handR: R, handL: L, lunge: 0, recoil: 0.05, torso: P.team, arms: P.team, legs: P.soot, boots: P.soot });
    skirt(m, h, P.team, 0.08, 0.2);
    m.at(h.chest, () => m.decal(0.02, () => m.torus([0, 0, -0.07], [0, 0, 1], 0.19, 0.03, P.leatherDk, { segs: 12 })));
    m.at(h.back, () => { m.move(0.04, 0, -0.12); boiler(m, 0.11 + 0.005 * t, 0.26, t >= 4 ? P.aether : P.glass, trim(Math.max(2, t))); m.with(() => { m.move(0.1, 0, 0.16).rotZ(0); dial(m, 0.045, 30 + p.i * 20); }); });
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([0, 0, 0.1], [0.2, 0.2, 0.17], P.brass); m.cylinder([-0.04, 0, 0.03], [-0.04, 0, 0.06], 0.27, P.brass, 0.24, { segs: 12 }); });
      m.extrude([[-0.16, 0.14], [0.14, 0.14], [0.1, 0.3 + 0.02 * t], [-0.12, 0.26]], 0.035, t >= 3 ? P.red : P.brassDk);
      moustache(m, 0.19, P.hair); halo(m, p, 0.2, 0.46);
    });
    const d = norm([L[0] - R[0], L[1] - R[1], L[2] - R[2]]);
    m.at(frameAt(h.pR, h.dir(d)), () => {
      m.cylinder([-0.04, 0, 0], [0.3, 0, 0], 0.04, P.leatherDk, 0.035, { segs: 8 });
      m.cylinder([0.3, 0, 0], [0.44, 0, 0], 0.035, trim(Math.max(2, t)), 0.055, { segs: 8 });
      m.tube([[-0.04, 0, 0], [-0.14, 0.02, -0.08], [-0.24, -0.06, -0.02]], 0.03, P.leatherDk, { segs: 6 });
      if (p.after) { const k = p.hit ? 1 : 0.6; m.group(() => { m.cone([0.44, 0, 0], [0.44 + 0.5 * k, 0, 0], 0.03, WATER, { segs: 8 }); m.cylinder([0.5, 0, 0], [0.5 + 0.42 * k, 0, 0.02], 0.05 * k, WATER, 0.11 * k, { segs: 8 }); m.sphere([0.95 * k + 0.02, 0, 0.02], 0.12 * k, WATER, { segs: 8 }); }); }
    });
  },
};

// ------------------------------------------------------------------------------------------------ casters
/** Stormcaller: a tesla-coil engineer. The coil on her back crackles; rubber gauntlets throw the arc. */
export const storm: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.14, 0.22, 0.4], [0.36, 0.12, 0.56], { wind: [0.0, 0.26, 0.74] });
    const L = p.mix<V3>([0.14, -0.22, 0.4], [0.36, -0.12, 0.56], { wind: [0.0, -0.26, 0.74] });
    const h = gent(m, p, { weight: "mid", handR: R, handL: L, lunge: 0.3, torso: P.team, arms: P.team, hands: P.soot, legs: P.wool });
    skirt(m, h, P.leather, 0.1, 0.21);
    m.at(h.chest, () => m.decal(0.02, () => m.ellipsoid([0.1, 0, -0.06], [0.05, 0.1, 0.1], P.leather))); // apron
    m.at(h.back, () => {
      m.move(0.03, 0, -0.1);
      m.cylinder([0, 0, 0], [0, 0, 0.12], 0.09, P.wood, 0.09, { segs: 8 });
      // the coil: stacked copper rings up to a ball
      const H = 0.62 + 0.04 * t;
      m.cylinder([0, 0, 0.12], [0, 0, H], 0.035, P.ironDk, 0.03, { segs: 6 });
      m.group(() => { for (let i = 0; i < 6; i++) m.torus([0, 0, 0.18 + (i * (H - 0.24)) / 6], [0, 0, 1], 0.1 - i * 0.008, 0.028, P.copper, { segs: 10 }); });
      m.sphere([0, 0, H + 0.07], 0.1 + 0.008 * t, t >= 4 ? P.aether : P.steel, { segs: 10 });
      if (!p.is("death")) arcBolt(m, [0, 0, H + 0.07], [0.17 * Math.cos(p.i * 2.3), 0.17 * Math.sin(p.i * 2.3), H + 0.24], 0.014, p.i + 1);
      if (p.blend < -0.5 || p.hit) arcBolt(m, [0, 0, H + 0.07], [0.22, 0.12, H + 0.0], 0.018, p.i + 4);
    });
    m.at(h.head, () => {
      m.ellipsoid([-0.03, 0, 0.06], [0.2, 0.2, 0.17], P.hair);
      m.sphere([-0.2, 0, 0.1], 0.09, P.hair, { segs: 8 });
      goggles(m, 0.19, t >= 4 ? P.aether : P.arc, trim(Math.max(2, t)), 0);
      halo(m, p, 0.19, 0.5);
    });
    if (p.blend < -0.3) arcBolt(m, h.pR, h.pL, 0.015, p.i + 2);
    if (p.hit) { for (const ph of [h.pR, h.pL]) arcBolt(m, ph, h.pt([0.75, 0, 0.5]), 0.022, 7 + ph[1]); m.sphere(h.pt([0.75, 0, 0.5]), 0.07, P.arcCore, { segs: 8 }); }
  },
};

/** Rimecaller: a cold-works engineer. Frosted coolant tank, a lance that sprays freezing vapour. */
export const rime: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.1, 0.16, 0.34], [0.14, 0.14, 0.44], { wind: [0.04, 0.16, 0.42] });
    const L = p.mix<V3>([0.28, -0.04, 0.4], [0.36, -0.02, 0.48], { wind: [0.22, -0.04, 0.52] });
    const h = gent(m, p, { weight: "mid", handR: R, handL: L, lunge: 0, recoil: 0.03, torso: P.white, arms: P.team, hands: P.white, legs: P.team, boots: P.white });
    skirt(m, h, P.white, 0.12, 0.2);
    m.at(h.chest, () => m.decal(0.02, () => m.torus([0, 0, -0.07], [0, 0, 1], 0.188, 0.03, P.team, { segs: 12 })));
    m.at(h.back, () => { m.move(0.04, 0, -0.1); boiler(m, 0.1, 0.24 + 0.02 * t, P.steel, trim(Math.max(2, t))); m.sphere([0, 0, 0.32 + 0.02 * t], 0.06, t >= 4 ? P.aether : P.frost, { segs: 8 }); vent(m, p, [0, 0, 0.36], 0.05, P.frost); });
    m.at(h.head, () => {
      // fur-lined hood, frosted goggles
      m.group(() => { m.ellipsoid([-0.03, 0, 0.03], [0.215, 0.215, 0.21], P.white); });
      m.decal(0.01, () => m.torus([0.1, 0, 0.0], [1, 0, 0.1], 0.17, 0.045, P.cloth, { segs: 12 }));
      goggles(m, 0.19, t >= 4 ? P.aether : P.frost, trim(Math.max(2, t)), 0);
      halo(m, p, 0.2, 0.44);
    });
    const d = norm([L[0] - R[0], L[1] - R[1], L[2] - R[2]]);
    m.at(frameAt(h.pR, h.dir(d)), () => {
      shaft(m, 0.06, 0.4, 0.022, P.iron);
      m.cone([0.52, 0, 0], [0.38, 0, 0], 0.06, t >= 3 ? P.brass : P.steel, { segs: 8 });
      m.tube([[0.0, 0, 0], [-0.1, 0, -0.08], [-0.2, -0.06, 0.0]], 0.022, P.leatherDk, { segs: 6 });
      if (p.after) { const k = p.hit ? 1 : 0.6; m.group(() => { for (let i = 0; i < 4; i++) m.cone([0.54 + i * 0.03, 0.05 * Math.sin(i * 2), 0.05 * Math.cos(i * 2)], [0.78 + i * 0.06 * k, 0.16 * Math.sin(i * 2) * k, 0.14 * Math.cos(i * 2) * k], 0.03, P.frost, { segs: 5 }); m.sphere([0.56, 0, 0], 0.07 * k, P.arcCore, { segs: 8 }); }); }
    });
  },
};

/** Thornweaver: a hothouse botanist. A glass dome of creeper on her back and a seed-gun that sows it. */
export const thorn: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, LEAF = mat("#5fae4a"), LEAFD = mat("#3a7d3a");
    const R = p.mix<V3>([0.12, 0.16, 0.34], [0.16, 0.14, 0.5], { wind: [0.04, 0.18, 0.42] });
    const L = p.mix<V3>([0.3, -0.04, 0.4], [0.34, -0.02, 0.62], { wind: [0.24, -0.04, 0.5] });
    const h = gent(m, p, { weight: "mid", bulk: 0.95, handR: R, handL: L, lunge: 0, recoil: 0.03, torso: P.team, arms: P.team, hands: P.leather, legs: P.leatherDk });
    skirt(m, h, P.leather, 0.1, 0.21);
    m.at(h.back, () => {
      m.move(0.04, 0, -0.1);
      m.cylinder([0, 0, 0], [0, 0, 0.08], 0.12, trim(Math.max(2, t)), 0.12, { segs: 10 });
      m.sphere([0, 0, 0.17], 0.13 + 0.008 * t, mat("#c9f2e4", { alpha: 0.55, metal: 1, shade: 0.3 }), { segs: 12 });
      m.decal(0.05, () => m.group(() => { m.sphere([0.0, 0, 0.16], 0.08, LEAF, { segs: 8 }); m.sphere([0.03, 0.05, 0.22], 0.05, LEAFD, { segs: 6 }); m.sphere([0.0, -0.05, 0.12], 0.05, t >= 4 ? P.aether : mat("#e2507a"), { segs: 6 }); }));
    });
    m.at(h.head, () => {
      // wide straw sun hat with a team ribbon
      m.group(() => { m.cylinder([-0.02, 0, 0.1], [-0.02, 0, 0.12], 0.3 + 0.01 * t, P.clothDk, 0.28, { segs: 14 }); m.ellipsoid([-0.02, 0, 0.13], [0.16, 0.16, 0.11], P.clothDk); });
      m.cylinder([-0.02, 0, 0.12], [-0.02, 0, 0.19], 0.175, P.team, 0.165, { segs: 12 });
      if (t >= 2) m.sphere([0.1, 0.1, 0.17], 0.045, mat("#e2507a"), { segs: 6 });
      if (t >= 3) goggles(m, 0.19, core(t), trim(t), 0);
      halo(m, p, 0.2, 0.36);
    });
    const d = norm([L[0] - R[0], L[1] - R[1], L[2] - R[2]]);
    m.at(frameAt(h.pR, h.dir(d)), () => {
      m.cylinder([-0.05, 0, 0], [0.36, 0, 0], 0.03, P.brassDk, 0.03, { segs: 8 });
      m.cone([0.46, 0, 0], [0.34, 0, 0], 0.065, trim(Math.max(2, t)), { segs: 8 });
      m.sphere([0.08, 0, 0.06], 0.055, LEAF, { segs: 8 });
      if (p.hit) m.group(() => { for (let i = 0; i < 4; i++) m.sphere([0.52 + i * 0.07, 0.04 * Math.sin(i * 3), 0.03 * Math.cos(i * 2)], 0.03, LEAFD, { segs: 6 }); });
      if (p.after) puff(m, [0.5, 0, 0.04], 0.05, p.hit ? 0.2 : 0.7, P.steam, 2);
    });
  },
};

// ------------------------------------------------------------------------------------------------ support
/** Medic: a field apothecary. White coat, tonic tank, and a brass atomiser that mends whoever it mists. */
export const medic: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.18, 0.38], [0.34, 0.1, 0.52], { wind: [0.06, 0.22, 0.5], cast: [0.3, 0.1, 0.66], castWind: [0.04, 0.22, 0.44] });
    const h = gent(m, p, { weight: "mid", bulk: 0.95, handR: R, lunge: 0.2, torso: P.white, arms: P.team, legs: P.team, boots: P.leatherDk });
    skirt(m, h, P.white, 0.13, 0.21);
    m.at(h.chest, () => {
      m.decal(0.02, () => m.torus([0, 0, 0.0], [0.5, 0.8, 0.55], 0.175, 0.04, P.team, { segs: 14 }));
      m.with(() => { m.move(0.0, -0.2, -0.1); m.box([0, 0, 0], [0.16, 0.08, 0.13], P.leather); m.decal(0.02, () => m.box([0, -0.045, 0], [0.07, 0.01, 0.07], P.team)); });
    });
    m.at(h.back, () => { m.move(0.03, 0, -0.08); boiler(m, 0.075, 0.2, t >= 4 ? P.aether : P.venom, trim(Math.max(2, t))); });
    m.at(h.head, () => {
      bowler(m, 0.19, P.white, P.team);
      // a round head-mirror on the brow
      m.with(() => { m.move(0.15, 0.06, 0.13).rotY(-25); m.cylinder([0, 0, 0], [0.02, 0, 0], 0.07, t >= 3 ? P.brass : P.steel, 0.07, { segs: 10 }); });
      if (t >= 2) moustache(m, 0.19, P.white);
      halo(m, p, 0.19, 0.44);
    });
    const aim = norm(p.mix<V3>([1, 0, 0.5], [1, 0, 0.15], { cast: [0.6, 0, 1] }));
    m.at(h.aim("R", aim), () => {
      m.cylinder([-0.03, 0, 0], [0.2, 0, 0], 0.035, trim(Math.max(2, t)), 0.035, { segs: 8 });
      m.sphere([-0.05, 0, 0], 0.05, P.red, { segs: 8 });
      m.cone([0.3, 0, 0], [0.18, 0, 0], 0.03, P.brass, { segs: 6 });
      if (p.after) puff(m, [0.42 + (p.hit ? 0 : 0.08), 0, 0], 0.09, p.hit ? 0.3 : 0.8, MIST, 2);
    });
  },
};

/** Standard Bearer: a bandmaster with the company colours on a tall brass pole. Everyone near steps quicker. */
export const banner: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.2, 0.34], [0.3, 0.14, 0.4], { wind: [0.1, 0.22, 0.4], cast: [0.14, 0.2, 0.56], castWind: [0.16, 0.2, 0.3] });
    const tilt = p.mix(0, 38, { wind: -10, cast: -4, castWind: 8 });
    const h = gent(m, p, { weight: "mid", handR: R, lunge: 0.5, torso: P.team, arms: P.team, legs: P.white, boots: P.soot });
    m.at(h.chest, () => m.decal(0.02, () => { for (const z of [0.1, 0.04, -0.02]) m.box([0.135, 0, z], [0.02, 0.2, 0.022], GOLD); m.torus([0, 0, -0.08], [0, 0, 1], 0.185, 0.028, P.white, { segs: 12 }); }));
    epaulettes(m, h, Math.max(2, t), 0.07);
    m.at(h.head, () => {
      // a tall busby with a plume
      m.group(() => m.cylinder([-0.01, 0, 0.06], [-0.01, 0, 0.32], 0.18, P.soot, 0.2));
      m.cylinder([-0.01, 0, 0.07], [-0.01, 0, 0.11], 0.186, GOLD, 0.188);
      m.capsule([0.1, 0, 0.3], [0.08, 0, 0.44 + 0.02 * t], 0.04, P.white, 0.055, { segs: 6 });
      moustache(m, 0.19);
    });
    m.at(frameAt(h.pR, h.dir([Math.sin((tilt * Math.PI) / 180), 0, Math.cos((tilt * Math.PI) / 180)]), h.dir([-1, 0, 0])), () => {
      // +x runs up the pole
      const L = 0.86 + 0.05 * t;
      shaft(m, 0.34, L, 0.02, t >= 2 ? P.brass : P.wood);
      m.sphere([L + 0.03, 0, 0], 0.05, t >= 4 ? P.aether : GOLD, { segs: 8 });
      if (t >= 3) gear(m, 0.09, 0.02, GOLD, 8, p.i * 12, null), m.move(0, 0, 0);
      // the colours: a swallowtail that ripples
      const w = (k: number) => 0.03 * Math.sin(p.t * Math.PI * 2 + k * 2.4) * k;
      const fl = 0.34 + 0.03 * t;
      m.poly([[L - 0.02, 0, 0.02], [L - 0.02, w(0.5), 0.02 + fl * 0.5], [L - 0.04, w(1), 0.02 + fl], [L - 0.17, w(0.8), 0.02 + fl * 0.76], [L - 0.3, w(1), 0.02 + fl], [L - 0.32, w(0.5), 0.02 + fl * 0.5], [L - 0.32, 0, 0.02]], P.team);
      m.decal(0.015, () => m.poly([[L - 0.12, 0.002, 0.04], [L - 0.12, w(0.6) + 0.002, 0.02 + fl * 0.62], [L - 0.22, w(0.6) + 0.002, 0.02 + fl * 0.62], [L - 0.22, 0.002, 0.04]], t >= 3 ? GOLD : P.teamLt));
    });
    if (p.is("cast") && p.after) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + p.i * 0.5; m.sphere(h.pt([0.34 * Math.cos(a), 0.34 * Math.sin(a), 0.12]), 0.03, P.lamp, { segs: 6 }); }
  },
};

/** Lamplighter: an old lamplighter with his long pole and a caged gaslight on the end. Its light shields friends. */
export const lamp: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.2, 0.34], [0.3, 0.14, 0.42], { wind: [0.04, 0.22, 0.5], cast: [0.16, 0.2, 0.62], castWind: [0.14, 0.2, 0.3] });
    const tilt = p.mix(14, 62, { wind: -12, cast: 0, castWind: 20 });
    const h = gent(m, p, { weight: "mid", bulk: 0.95, handR: R, lunge: 0.4, torso: P.wool, arms: P.wool, legs: P.leatherDk, boots: P.soot });
    skirt(m, h, P.wool, 0.14, 0.2);
    m.at(h.chest, () => { m.decal(0.01, () => m.torus([0.0, 0, 0.14], [0, 0, 1], 0.14, 0.05, P.team, { segs: 12 })); m.capsule([-0.1, 0.06, 0.1], [-0.2, 0.08 + 0.02 * p.wave(1), -0.1], 0.04, P.team, 0.03, { segs: 6 }); }); // scarf
    m.at(h.head, () => { flatCap(m, 0.19, t >= 3 ? P.leatherDk : P.wool); moustache(m, 0.19, P.white); if (t >= 2) goggles(m, 0.19, core(t, P.lamp), trim(t), 1); halo(m, p, 0.19, 0.4); });
    m.at(frameAt(h.pR, h.dir([Math.sin((tilt * Math.PI) / 180), 0, Math.cos((tilt * Math.PI) / 180)]), h.dir([-1, 0, 0])), () => {
      const L = 0.72 + 0.05 * t;
      shaft(m, 0.3, L, 0.016, P.woodDk);
      m.tube([[L, 0, 0], [L + 0.06, 0, -0.03], [L + 0.07, 0, -0.1]], 0.012, P.brassDk, { segs: 5 });
      m.with(() => { m.move(L + 0.07, 0, -0.1).rotY(90 - tilt); lantern(m, 0.085 + 0.008 * t, t >= 4 ? P.aether : P.lamp, trim(Math.max(2, t))); });
    });
    if (p.is("cast") && p.after) m.torus(h.pt([0.16, 0.2, 0.95]), [0, 0, 1], p.hit ? 0.2 : 0.32, 0.02, P.lamp, { segs: 14 });
  },
};

/** Tinker: a mechanic in welding goggles with a wrench as big as her arm. Bolts turrets together; mends machines. */
export const tinker: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), build = p.is("cast");
    const hand = build ? p.mix<V3>([0.14, 0.2, 0.38], [0.34, 0.1, 0.16], { castWind: [0.0, 0.24, 0.66] }) : c.hand;
    const aim = build ? norm(p.mix<V3>([0.45, 0.1, 1], [1, 0, -0.7], { castWind: [-0.4, 0.1, 1] })) : c.aim;
    const h = gent(m, p, { weight: "mid", bulk: 0.98, handR: hand, twist: 20, torso: P.leather, arms: P.team, legs: P.team, hands: P.leatherDk });
    m.at(h.chest, () => {
      m.decal(0.02, () => { m.torus([0, 0, -0.07], [0, 0, 1], 0.185, 0.035, P.leatherDk, { segs: 12 }); for (const y of [0.1, -0.1]) m.box([0.11, y, -0.1], [0.05, 0.05, 0.08], P.iron); });
    });
    m.at(h.back, () => { m.move(0.03, 0, -0.08); m.box([0, 0, 0.1], [0.12, 0.24, 0.2], P.woodDk); m.with(() => { m.move(0.0, 0.06, 0.22).rotZ(90); gear(m, 0.08, 0.03, trim(Math.max(2, t)), 8, p.i * 15); }); m.cylinder([0, -0.07, 0.2], [0, -0.07, 0.32 + 0.02 * t], 0.02, P.steel, 0.02, { segs: 6 }); });
    m.at(h.head, () => {
      m.ellipsoid([-0.03, 0, 0.07], [0.2, 0.2, 0.16], mat("#c8553a")); // red hair in a kerchief
      m.decal(0.01, () => m.torus([0, 0, 0.1], [0.1, 0, 1], 0.185, 0.04, P.team, { segs: 12 }));
      goggles(m, 0.19, t >= 4 ? P.aether : P.soot, trim(Math.max(2, t)), build || p.is("attack") ? 0 : 1);
      halo(m, p, 0.19, 0.4);
    });
    m.at(h.aim("R", aim), () => {
      shaft(m, 0.06, 0.3, 0.024, t >= 3 ? P.brass : P.iron);
      m.extrude([[0.28, -0.05], [0.4, -0.085], [0.42, -0.035], [0.34, -0.012], [0.34, 0.012], [0.42, 0.035], [0.4, 0.085], [0.28, 0.05]], 0.035, t >= 4 ? GOLD : P.steel);
      if (p.hit) flash(m, [0.42, 0, 0], 0.055, P.lamp, P.fireHot);
    });
  },
};

// ------------------------------------------------------------------------------------------------ flankers
/** Shade: a smog-cloaked cutthroat. Gas mask with glowing lenses, two long knives, a cloak the colour of soot. */
export const shade: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, CLOAK = mat("#3a3344");
    const R = p.mix<V3>([0.12, 0.22, 0.36], [0.36, 0.06, 0.4], { wind: [-0.08, 0.26, 0.52] });
    const L = p.mix<V3>([0.12, -0.22, 0.36], [0.3, -0.04, 0.46], { wind: [-0.04, -0.26, 0.44] });
    const h = gent(m, p, { weight: "light", bulk: 0.88, handR: R, handL: L, twist: 22, lunge: 1.3, torso: CLOAK, arms: CLOAK, legs: P.soot, boots: P.soot, hands: P.soot, lean: 16 });
    m.at(h.chest, () => {
      // the cloak: a ragged cone off the shoulders, team lining at the hem
      m.group(() => m.cylinder([-0.03, 0, 0.14], [-0.1 - 0.02 * p.wave(1), 0, -0.26], 0.16, CLOAK, 0.26, { segs: 10 }));
      m.decal(0.01, () => m.cylinder([-0.09, 0, -0.2], [-0.1 - 0.02 * p.wave(1), 0, -0.26], 0.25, P.team, 0.265, { segs: 10 }));
      if (t >= 2) m.decal(0.03, () => m.sphere([0.1, 0, 0.12], 0.04, trim(t), { segs: 6 }));
    });
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([-0.03, 0, 0.02], [0.215, 0.21, 0.22], CLOAK); m.cone([-0.1, 0, 0.14], [-0.26, 0, 0.26], 0.1, CLOAK, { segs: 8 }); });
      m.decal(0.02, () => m.ellipsoid([0.12, 0, -0.02], [0.1, 0.14, 0.13], P.leatherDk));
      m.decal(0.04, () => { for (const s of [1, -1]) m.sphere([0.185, s * 0.075, 0.02], 0.045, t >= 4 ? P.aether : P.venom, { segs: 8 }); m.cylinder([0.18, 0, -0.08], [0.25, 0, -0.1], 0.045, P.ironDk, 0.05, { segs: 8 }); });
      halo(m, p, 0.2, 0.42);
    });
    for (const [hd, s] of [["R", 1], ["L", -1]] as ["R" | "L", number][]) m.at(h.aim(hd, norm(p.mix<V3>([0.6, 0, 0.8], [1, -s * 0.2, -0.1], { wind: [-0.3, 0, 1] }))), () => {
      m.extrude([[0.03, -0.02], [0.22 + 0.015 * t, -0.012], [0.28 + 0.015 * t, 0.01], [0.03, 0.022]], 0.012, t >= 4 ? P.aether : P.steel);
      m.box([0.02, 0, 0], [0.02, 0.06, 0.05], trim(Math.max(2, t)));
    });
    if (p.hit) { slashArc(m, h, [0.1, 0, 0.4], 0.36, 60, -30, -0.15); slashArc(m, h, [0.1, 0, 0.44], 0.32, -60, 20, 0.1); }
    if (p.is("death") && p.i >= 2) puff(m, [-0.1, 0, 0.12], 0.14, p.dead, P.smoke, 3);
  },
};

/** Sapper: a tunneller. Miner's helmet with a lamp, a steam drill for a right arm, and a spoil pack. */
export const sapper: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, th = thrust(p, 0.3);
    const h = gent(m, p, { weight: "light", bulk: 1.05, handR: th.hand, handL: [th.hand[0] + 0.1, th.hand[1] - 0.2, th.hand[2] - 0.04], torso: P.leather, arms: P.team, legs: P.team, boots: P.iron, hands: P.leatherDk, lunge: 1.1 });
    m.at(h.chest, () => m.decal(0.02, () => { m.torus([0, 0, 0.0], [0.5, 0.8, 0.55], 0.18, 0.028, P.leatherDk, { segs: 14 }); m.torus([0, 0, 0.0], [0.5, -0.8, 0.55], 0.18, 0.028, P.leatherDk, { segs: 14 }); }));
    m.at(h.back, () => { m.move(0.03, 0, -0.06); boiler(m, 0.085, 0.18, P.copper, trim(Math.max(2, t))); vent(m, p, [0, 0, 0.26], 0.05, P.steam); });
    m.at(h.head, () => {
      helmet(m, 0.19, t >= 3 ? P.brass : P.clothDk, trim(Math.max(2, t)));
      m.with(() => { m.move(0.17, 0, 0.14); m.cylinder([0, 0, 0], [0.06, 0, 0], 0.06, P.brassDk, 0.065, { segs: 8 }); m.decal(0.02, () => m.sphere([0.06, 0, 0], 0.048, t >= 4 ? P.aether : P.lamp, { segs: 8 })); });
      goggles(m, 0.19, P.soot, P.brassDk, 0);
      halo(m, p, 0.2, 0.4);
    });
    m.at(h.aim("R", th.aim), () => {
      m.cylinder([-0.06, 0, 0], [0.14, 0, 0], 0.07, P.ironDk, 0.075, { segs: 10 });
      m.cylinder([0.14, 0, 0], [0.18, 0, 0], 0.085, trim(Math.max(2, t)), 0.085, { segs: 10 });
      // the bit: a fluted cone that turns
      m.with(() => { m.move(0.18, 0, 0).rotX(p.i * 50); m.cone([0, 0, 0], [0.3 + 0.02 * t, 0, 0], 0.08, t >= 4 ? GOLD : P.steel, { segs: 7 }); m.decal(0.004, () => m.tube([[0.02, 0.07, 0], [0.1, 0, 0.055], [0.18, -0.035, 0], [0.26, 0, 0.012]], 0.012, P.ironDk, { segs: 4 })); });
      if (p.hit) flash(m, [0.46, 0, 0], 0.06, P.lamp, P.fireHot);
    });
    if (p.is("walk")) m.group(() => { for (let i = 0; i < 2; i++) m.sphere([-0.2 - 0.06 * i, 0.1 * Math.sin(p.i * 2.2 + i), 0.03 + 0.03 * i], 0.035, P.clothDk, { segs: 6 }); });
  },
};

/** Kegrunner: a wild-eyed runner hugging a ticking boiler-bomb, fuse fizzing. Runs in and goes up. */
export const keg: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const lift = p.mix(0, 0.18, { wind: -0.04 });
    const h = gent(m, p, { weight: "light", bulk: 0.9, handR: [0.2, 0.17, 0.62 + lift], handL: [0.2, -0.17, 0.62 + lift], torso: P.team, arms: P.cloth, legs: P.leatherDk, lean: 18, lunge: 1.2 });
    m.at(h.head, () => { m.ellipsoid([-0.04, 0, 0.08], [0.18, 0.19, 0.14], P.hair); goggles(m, 0.19, core(t), trim(Math.max(2, t)), 0); m.decal(0.02, () => m.ellipsoid([0.17, 0, -0.08], [0.03, 0.07, 0.035], P.soot, { segs: 6 })); });
    // the bomb, held high: a banded boiler with a dial and a fuse
    m.with(() => {
      m.move(h.pt([0.14, 0, 0.74 + lift])[0], h.pt([0.14, 0, 0.74 + lift])[1], h.pt([0.14, 0, 0.74 + lift])[2]);
      m.scale(h.size);
      m.rotY(90 + 8 * p.wave(1, 2));
      const r = 0.17 + 0.012 * t;
      m.group(() => { m.cylinder([0, 0, -0.16], [0, 0, 0.16], r, t >= 3 ? P.copper : P.red); m.ellipsoid([0, 0, 0.16], [r, r, 0.07], t >= 3 ? P.copper : P.red); m.ellipsoid([0, 0, -0.16], [r, r, 0.07], t >= 3 ? P.copper : P.red); });
      for (const z of [-0.1, 0.1]) m.cylinder([0, 0, z - 0.025], [0, 0, z + 0.025], r * 1.05, trim(Math.max(2, t)), r * 1.05);
      m.with(() => { m.move(-r, 0, 0).rotZ(180); dial(m, 0.06, p.i * 55); });
      m.tube([[0, 0, 0.22], [0.03, 0, 0.28], [0.0, 0.02, 0.33]], 0.012, P.clothDk, { segs: 5 });
      m.sphere([0.0, 0.02, 0.35], 0.035 + 0.01 * (p.i % 2), t >= 4 ? P.aetherInk : P.fire, { segs: 6 });
      if (t >= 4) m.torus([0, 0, 0], [0, 0, 1], r * 1.07, 0.02, P.aether);
    });
    if (p.hit) { m.sphere(h.pt([0.2, 0, 0.5]), 0.3, P.fire, { segs: 10 }); m.sphere(h.pt([0.2, 0, 0.5]), 0.18, P.fireHot, { segs: 8 }); }
  },
};

/** Trickster: a music-hall conjurer. Opera cape, tall hat, a fan of cards; where he was a moment ago is a dummy. */
export const trickster: UnitDef = {
  weight: "light", cast: true,
  build(m, p) { conjurer(m, p, false); },
};
function conjurer(m: Model, p: Pose, dummy: boolean) {
  const t = p.tier, PURPLE = mat("#5b3a78");
  const R = dummy ? ([0.16, 0.22, 0.4] as V3) : p.mix<V3>([0.16, 0.22, 0.4], [0.36, 0.06, 0.46], { wind: [-0.06, 0.26, 0.6], cast: [0.1, 0.3, 0.74], castWind: [0.1, 0.1, 0.36] });
  const L = dummy ? ([0.1, -0.24, 0.36] as V3) : p.mix<V3>([0.1, -0.24, 0.36], [0.0, -0.28, 0.44], { cast: [0.1, -0.3, 0.74], castWind: [0.1, -0.1, 0.36] });
  const body = dummy ? P.clothDk : P.soot;
  const h = gent(m, p, { weight: "light", bulk: 0.9, handR: R, handL: L, twist: dummy ? 0 : 24, torso: body, arms: body, legs: dummy ? P.clothDk : P.wool, boots: dummy ? P.woodDk : P.soot, skin: dummy ? P.cloth : P.skin, hands: dummy ? P.cloth : P.white, noFace: dummy, lunge: dummy ? 0 : 1 });
  m.at(h.chest, () => {
    if (!dummy) m.decal(0.02, () => m.ellipsoid([0.1, 0, 0.02], [0.06, 0.08, 0.13], P.white));
    // the cape: team outside, purple lining; the dummy wears a painted sack
    m.extrude([[-0.02, 0.17], [-0.2, 0.1], [-0.3 - 0.03 * p.wave(1), -0.24], [-0.1, -0.26]], 0.42, dummy ? P.teamDk : P.team);
    if (!dummy) m.decal(0.01, () => m.torus([0.0, 0, 0.15], [0, 0, 1], 0.15, 0.045, PURPLE, { segs: 12 }));
  });
  m.at(h.head, () => {
    topHat(m, 0.19, 0.24 + 0.02 * t, dummy ? P.leatherDk : P.soot, dummy ? P.clothDk : PURPLE, dummy ? -14 : -6);
    if (dummy) m.decal(0.02, () => { for (const s of [1, -1]) m.box([0.17, s * 0.075, 0.02], [0.02, 0.02, 0.07], P.soot); m.box([0.17, 0, -0.07], [0.02, 0.12, 0.02], P.soot); });
    else { moustache(m, 0.19, P.soot); if (t >= 3) goggles(m, 0.19, core(t), GOLD, 1); halo(m, p, 0.19, 0.56); }
  });
  if (dummy) { m.cylinder(h.pt([0, 0, 0]), h.pt([0, 0, 0.26]), 0.03, P.woodDk, 0.03, { segs: 6 }); return; }
  // a fan of cards in the right hand
  m.at(h.aim("R", norm(p.mix<V3>([0.4, 0, 1], [1, 0, 0.1], { wind: [-0.2, 0, 1], cast: [0, 0, 1] }))), () => {
    for (let i = -1; i <= 1; i++) m.with(() => { m.rotY(i * 24); m.decal(0.004 * (i + 2), () => m.box([0.1, 0, 0], [0.13, 0.012, 0.08], i === 0 ? P.teamLt : P.white)); });
  });
  if (p.hit && !p.is("cast")) slashArc(m, h, [0.1, 0, 0.44], 0.36, 60, -30, -0.1);
  if (p.is("cast") && p.after) for (const s of [1, -1]) puff(m, h.pt([0.1, s * 0.34, 0.8]), 0.08, p.hit ? 0.2 : 0.7, mat("#c9a3f0", { emit: 0.9, ink: false, alpha: 0.85 }), s + 2);
}
/** Decoy: the conjurer's dummy, a sack-and-broomstick copy in his hat and cape. Soaks up blows; fools nobody twice. */
export const decoy: UnitDef = { weight: "light", build: (m, p) => conjurer(m, p, true) };

/** Gravecaller: a resurrection man. Undertaker's hat with a long crape, a galvanic rod that jolts scrap back to work. */
export const grave: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.2, 0.36], [0.32, 0.12, 0.5], { wind: [0.04, 0.24, 0.6], cast: [0.14, 0.2, 0.74], castWind: [0.16, 0.2, 0.3] });
    const h = gent(m, p, { weight: "mid", bulk: 0.9, handR: R, handL: p.mix<V3>([0.06, -0.24, 0.32], [0.2, -0.2, 0.46], { cast: [0.2, -0.24, 0.6] }), torso: PLUM, arms: PLUM, legs: P.soot, boots: P.soot, skin: mat("#d9d3c0"), hands: P.white, lunge: 0.2 });
    skirt(m, h, PLUM, 0.15, 0.2);
    m.at(h.chest, () => m.decal(0.02, () => { m.ellipsoid([0.1, 0, 0.04], [0.05, 0.07, 0.11], P.white); m.torus([0.0, 0, 0.15], [0, 0, 1], 0.14, 0.04, P.team, { segs: 12 }); }));
    m.at(h.head, () => {
      topHat(m, 0.19, 0.3 + 0.02 * t, P.soot, P.team);
      m.capsule([-0.14, 0, 0.2], [-0.3, 0.03 * p.wave(1), 0.0], 0.04, P.team, 0.02, { segs: 6 }); // crape
      goggles(m, 0.19, t >= 4 ? P.aether : P.venom, trim(Math.max(2, t)), 0);
      halo(m, p, 0.19, 0.62);
    });
    const aim = norm(p.mix<V3>([0.3, 0, 1], [1, 0, 0.2], { cast: [0, 0, 1] }));
    m.at(h.aim("R", aim), () => {
      const L = 0.5 + 0.03 * t;
      shaft(m, 0.2, L, 0.017, P.ironDk);
      m.group(() => { for (let i = 0; i < 3; i++) m.torus([L - 0.12 + i * 0.045, 0, 0], [1, 0, 0], 0.035, 0.012, P.copper, { segs: 8 }); });
      for (const s of [1, -1]) m.tube([[L, 0, 0], [L + 0.06, 0, s * 0.05], [L + 0.13, 0, s * 0.03]], 0.012, trim(Math.max(2, t)), { segs: 5 });
      m.sphere([L + 0.1, 0, 0], 0.035 + (p.blend !== 0 ? 0.02 : 0), t >= 4 ? P.aetherInk : P.venom, { segs: 8 });
      if (p.after) arcBolt(m, [L + 0.1, 0, 0], [L + 0.34, 0.05, 0.02], 0.018, p.i, P.venom);
    });
  },
};

/** Bone Thrall: scrap jolted back to its feet: a tin skeleton of pipe and plate with one green lamp for an eye. */
export const thrall: UnitDef = {
  weight: "light",
  build(m, p) {
    const R = p.mix<V3>([0.14, 0.2, 0.36], [0.34, 0.1, 0.36], { wind: [0.0, 0.24, 0.6] });
    const L = p.mix<V3>([0.14, -0.2, 0.34], [0.3, -0.12, 0.4], { wind: [0.06, -0.24, 0.5] });
    const h = humanoid(m, p, { weight: "light", size: 0.9, bulk: 0.7, skin: P.steel, torso: P.iron, legs: P.iron, boots: P.brassDk, arms: P.iron, hands: P.copper, handR: R, handL: L, noTorso: true, noHead: true, lean: 14, lunge: 1 });
    m.at(h.hips, () => m.sphere([0, 0, 0.02], 0.07, P.copperDk, { segs: 8 }));
    m.at(h.chest, () => {
      m.cylinder([0, 0, -0.14], [0, 0, 0.1], 0.03, P.ironDk, 0.03, { segs: 6 });
      m.group(() => { for (let i = 0; i < 3; i++) m.torus([0, 0, -0.04 + i * 0.06], [0.2, 0, 1], 0.1 + i * 0.012, 0.026, i === 1 ? P.team : P.brass, { segs: 10 }); });
      m.sphere([0.02, 0, 0.02], 0.045, P.venom, { segs: 8 });
    });
    m.at(h.head, () => {
      m.group(() => { m.cylinder([0, 0, -0.1], [0, 0, 0.08], 0.13, P.steel, 0.15, { segs: 8 }); m.ellipsoid([0, 0, 0.08], [0.15, 0.15, 0.06], P.steel, { segs: 8 }); });
      m.decal(0.03, () => { m.sphere([0.12, 0.05, 0.0], 0.05, p.is("death") && p.i > 2 ? P.soot : P.venom, { segs: 8 }); m.box([0.13, 0, -0.08], [0.02, 0.12, 0.02], P.soot); });
    });
    m.at(h.aim("R", norm(p.mix<V3>([0.5, 0, 1], [1, 0, -0.2], { wind: [-0.3, 0, 1] }))), () => m.tube([[0, 0, 0], [0.2, 0, 0], [0.26, 0, 0.05]], 0.022, P.copperDk, { segs: 6 }));
    if (p.hit) slashArc(m, h, [0.1, 0, 0.36], 0.32, 50, -30, -0.15, P.venom);
  },
};
void lantern; void flatCap; void bowler;
