// Pixelkeep's soldiers on foot: the humanoid rig with a big head, one piece of headgear nobody else wears and one
// oversized prop. The tunic, shield or robe says whose side it is on.
import { gripAim, type Pose, type UnitDef } from "../../../artkit/rig";
import { Model, norm, type Material, type V3 } from "../../../artkit/toon3d";
import { HEAD, P, axe, beard, belt, blade, bomb, bow, cape, chop, dagger, flash, guy, hammer, headband, heart, helm, hood, puff, rank, robe, shield, slashArc, sparkle, spear, staff, sword, thrust, trim, tunic, wizHat, zigzag } from "./parts";

const r = HEAD;
/** A staff hand: rest, a forward jab on the blow, raised in the wind-up (and on a cast). */
const staffHand = (p: Pose): V3 => p.mix<V3>([0.2, 0.2, 0.42], [0.32, 0.14, 0.56], { wind: [0.06, 0.24, 0.66], cast: [0.16, 0.2, 0.74], castWind: [0.1, 0.22, 0.4] });
const offHand = (p: Pose): V3 => p.mix<V3>([0.12, -0.2, 0.36], [0.3, -0.12, 0.5], { wind: [0.0, -0.24, 0.4], cast: [0.14, -0.22, 0.7], castWind: [0.1, -0.2, 0.36] });

// ------------------------------------------------------------------------------------------------ shooters
/** Bowkin: a hooded archer with a bow as tall as he is. */
export const ranger: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const pull = p.mix(0.04, 0.0, { wind: 0.2 });
    const L = p.mix<V3>([0.3, -0.06, 0.42], [0.34, -0.04, 0.46], { wind: [0.32, -0.05, 0.47] });
    const R = p.mix<V3>([0.24, 0.1, 0.42], [0.3, 0.1, 0.46], { wind: [0.08, 0.12, 0.47] });
    const h = guy(m, p, { weight: "light", bulk: 0.95, torso: P.green, arms: P.green, legs: P.woodDk, boots: P.leather, handR: R, handL: L, lunge: 0, recoil: 0.03 });
    tunic(m, h, P.green);
    belt(m, h, P.leather, trim(t));
    m.at(h.back, () => m.group(() => { m.box([0.05, 0.06, 0.02], [0.08, 0.1, 0.3], P.leather); for (const y of [0.03, 0.09]) m.box([0.05, y, 0.2], [0.03, 0.03, 0.1], P.cream); }));
    m.at(h.head, () => { hood(m, r, P.team, 0.5); m.cone([-r * 0.2, r * 0.6, r * 0.8], [-r * 1.0, r * 0.9, r * 2.0], r * 0.3, t >= 3 ? P.gold : P.leaf, { segs: 4 }); rank(m, p, r * 1.5); });
    m.at(h.aim("L", [1, 0, 0]), () => {
      bow(m, 0.32 + 0.012 * t, pull, t >= 4 ? P.glory : t >= 3 ? P.gold : P.wood, p.after ? null : P.cream);
      if (p.hit) sparkle(m, [0.3, 0, 0], 0.045);
    });
  },
};

/** Bomber: a stout fellow in a kettle helmet with a round black bomb, fuse lit, over his head. */
export const grenadier: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.1, 0.24, 0.62], [0.32, 0.14, 0.72], { wind: [-0.14, 0.26, 0.6] });
    const h = guy(m, p, { weight: "mid", bulk: 1.28, handR: R, twist: 22, lunge: 0.5, torso: P.team, arms: P.team, legs: P.woodDk, boots: P.black });
    belt(m, h, P.leather, trim(t), 1.25);
    m.at(h.chest, () => m.decal(0.02, () => m.box([0.14, -0.1, 0], [0.06, 0.12, 0.3], P.leather)));
    m.at(h.head, () => { helm(m, r, t >= 3 ? P.gold : P.ironDk, { brim: P.team }); rank(m, p, r * 1.3); });
    if (!p.after) m.at(h.aim("R", [1, 0, 0]), () => { m.move(0, 0, 0.16); bomb(m, 0.13 + 0.008 * t, t >= 4 ? P.gloryInk : P.fire); });
    else puff(m, h.pt([0.36, 0.14, 0.86]), 0.06, 0.4);
  },
};

// ------------------------------------------------------------------------------------------------ blades
/** Bigshield: a fat knight behind a door-sized shield in the team's colour. */
export const bulwark: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const L = p.mix<V3>([0.26, -0.03, 0.38], [0.44, 0.0, 0.4], { wind: [0.16, -0.05, 0.38] });
    const R = p.mix<V3>([0.02, 0.3, 0.36], [0.2, 0.26, 0.4], { wind: [-0.1, 0.3, 0.44] });
    const h = guy(m, p, { size: 1.22, bulk: 1.4, weight: "heavy", torso: P.iron, arms: P.iron, legs: P.ironDk, boots: P.ironDk, hands: P.ironDk, handL: L, handR: R, lunge: 0.6 });
    m.at(h.chest, () => { for (const s of [1, -1]) m.box([0, s * 0.25, 0.14], [0.2, 0.16, 0.1], P.team); });
    cape(m, h, p, P.teamFlat, 0.4, 0.26);
    m.at(h.head, () => { helm(m, r, t >= 3 ? P.gold : P.steel, { plume: P.team }); if (t >= 4) rank(m, p, r * 1.6); });
    m.at(h.aim("L", [1, 0, 0]), () => {
      m.move(0.06, 0.03, 0.0);
      shield(m, 0.62 + 0.02 * t, 0.8 + 0.02 * t, trim(t), P.teamFlat, t >= 4 ? P.glory : t >= 2 ? P.white : P.teamDk);
      if (p.hit) flash(m, [0.12, 0, 0], 0.07, P.spark, P.spark);
    });
    m.at(h.aim("R", norm(p.mix<V3>([0.3, 0.2, 1], [1, 0, 0.2], { wind: [-0.2, 0.2, 1] }))), () => hammer(m, 0.26, trim(t), 0.1));
  },
};

/** Squires: three tiny knights with short swords. */
export const blades: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const h = guy(m, p, { weight: "light", size: 0.88, bulk: 0.95, handR: c.hand, twist: 28, torso: P.team, arms: P.grey, legs: P.dark, hands: P.grey });
    tunic(m, h, P.team, 0.19);
    m.at(h.head, () => { helm(m, r, trim(t), { crest: P.team }); rank(m, p, r * 1.5); });
    m.at(h.aim("R", c.aim), () => sword(m, 0.36 + 0.02 * t, blade(t), trim(t), 0.075));
    if (p.hit) slashArc(m, h, [0.05, 0, 0.36], 0.42, 70, -45, -0.25);
  },
};

/** Sneak: a black ninja with two daggers. Team colour only on the headband. */
export const shade: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.14, 0.22, 0.36], [0.38, 0.06, 0.44], { wind: [-0.08, 0.26, 0.52] });
    const L = p.mix<V3>([0.14, -0.22, 0.36], [0.3, -0.1, 0.36], { wind: [0.02, -0.26, 0.44] });
    const aR = norm(p.mix<V3>([0.6, 0, 0.8], [1, -0.2, -0.1], { wind: [-0.3, 0.2, 1] })), aL = norm(p.mix<V3>([0.6, 0, 0.8], [1, 0.2, 0.1], { wind: [0.2, -0.2, 1] }));
    const h = guy(m, p, { weight: "light", bulk: 0.9, handR: R, handL: L, twist: 22, lunge: 1.1, lean: 16, skin: P.black, torso: P.black, arms: P.black, legs: P.black, boots: P.night, hands: P.black, noFace: true, swingR: 0.5, swingL: 0.5 });
    belt(m, h, P.team, trim(t), 0.95);
    m.at(h.head, () => {
      m.decal(0.03, () => m.box([r * 0.9, 0, r * 0.05], [r * 0.3, r * 1.2, r * 0.36], P.skin));
      m.decal(0.05, () => { for (const s of [1, -1]) m.box([r * 0.98, s * r * 0.36, r * 0.05], [r * 0.2, r * 0.22, r * 0.24], P.black); });
      headband(m, r, P.team);
      rank(m, p, r * 1.25);
    });
    m.at(h.aim("R", aR), () => dagger(m, 0.24 + 0.015 * t, blade(t)));
    m.at(h.aim("L", aL), () => dagger(m, 0.24 + 0.015 * t, blade(t)));
    if (p.hit) { slashArc(m, h, [0.1, 0, 0.4], 0.4, 60, -30, -0.2); slashArc(m, h, [0.1, 0, 0.36], 0.34, -60, 20, 0.2); }
  },
};

/** Fencer: slim, a wide feathered hat and a needle of a rapier. The cast is the parry. */
export const duelist: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, th = thrust(p, 0.4), parry = p.is("cast");
    const hand = parry ? p.mix<V3>([0.12, 0.22, 0.38], [0.24, 0.02, 0.58], { castWind: [0.1, 0.24, 0.4] }) : th.hand;
    const aim = parry ? norm(p.mix<V3>([1, 0, 0.35], [0.1, -0.9, 0.5], { castWind: [1, 0.2, 0.3] })) : th.aim;
    const L = p.mix<V3>([-0.04, -0.24, 0.34], [-0.14, -0.26, 0.46], { cast: [0.1, -0.24, 0.5] });
    const h = guy(m, p, { weight: "light", bulk: 0.84, handR: hand, handL: L, torso: P.team, arms: P.white, legs: P.white, boots: P.black, lunge: parry ? 0 : 1.3 });
    tunic(m, h, P.team, 0.18);
    m.at(h.head, () => {
      m.with(() => { m.move(0, 0, r * 0.5).rotY(-8); m.group(() => { m.cylinder([0, 0, 0], [0, 0, r * 0.14], r * 1.7, P.team, r * 1.7, { segs: 10 }); m.cylinder([0, 0, r * 0.1], [0, 0, r * 0.6], r * 0.9, P.team, r * 0.8, { segs: 8 }); }); });
      m.tube([[-r * 0.3, r * 0.7, r * 0.7], [-r * 0.9, r * 0.9, r * 1.5], [-r * 1.7, r * 0.9, r * 1.6]], [r * 0.2, r * 0.3, r * 0.12], t >= 3 ? P.gold : P.white, { segs: 4 });
      rank(m, p, r * 1.4);
    });
    m.at(h.aim("R", aim), () => {
      m.cylinder([0.03, 0, 0], [0.56 + 0.03 * t, 0, 0], 0.016, blade(t), 0.012, { segs: 4 });
      m.sphere([0.02, 0, 0], 0.05, trim(t), { segs: 6 });
      if (p.hit && !parry) m.box([0.72, 0, 0], [0.34, 0.04, 0.04], P.slash);
      if (p.hit && parry) flash(m, [0.3, 0, 0], 0.07, P.spark, P.spark);
    });
  },
};

/** Spearman: a kettle helm and a spear twice his height. The cast braces it against a charge. */
export const pikeman: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.06, 0.2, 0.36], [0.26, 0.16, 0.4], { wind: [-0.12, 0.22, 0.42], cast: [0.0, 0.2, 0.24] });
    const L = p.mix<V3>([0.28, -0.02, 0.44], [0.46, 0.04, 0.4], { wind: [0.12, 0.0, 0.46], cast: [0.3, 0.0, 0.34] });
    const h = guy(m, p, { weight: "mid", handR: R, handL: L, torso: P.team, arms: P.grey, legs: P.dark, lunge: p.is("cast") ? 0 : 0.9 });
    tunic(m, h, P.team);
    m.at(h.head, () => { helm(m, r, P.team, { brim: trim(t) }); rank(m, p, r * 1.3); });
    m.at(gripAim(h.pR, h.pL), () => {
      const F = 0.95 + 0.04 * t;
      spear(m, 0.3, F, blade(t), 0.022);
      m.decal(0.01, () => m.box([F - 0.12, 0, -0.06], [0.14, 0.02, 0.1], P.team));
      if (p.hit) sparkle(m, [F + 0.2, 0, 0], 0.045);
    });
  },
};

/** Berserker: horned helmet, bare chest, a two-handed axe as big as he is. */
export const ravager: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.1, 0.14, 0.4], [0.3, 0.08, 0.3], { wind: [-0.06, 0.16, 0.62] });
    const L = p.mix<V3>([0.24, -0.04, 0.54], [0.5, 0.0, 0.16], { wind: [-0.14, 0.02, 0.86] });
    const h = guy(m, p, { weight: "heavy", size: 1.12, bulk: 1.3, handR: R, handL: L, twist: 30, torso: P.skin, arms: P.skin, legs: P.team, boots: P.leather, lunge: 1.1 });
    tunic(m, h, P.team, 0.24);
    belt(m, h, P.leather, trim(t), 1.3);
    m.at(h.chest, () => m.decal(0.02, () => m.box([0.1, 0, 0.02], [0.14, 0.12, 0.34], P.team)));
    m.at(h.head, () => { helm(m, r, t >= 3 ? P.gold : P.iron, { horns: P.white, crest: P.team }); beard(m, r, P.orange, 0.9); rank(m, p, r * 1.3); });
    m.at(gripAim(h.pR, h.pL), () => axe(m, 0.5 + 0.02 * t, blade(t), 0.24, true));
    if (p.hit) slashArc(m, h, [0.1, 0, 0.4], 0.62, 80, -60, -0.4);
  },
};

/** Chain Ogre: a heavy green brute with an anchor hook on a chain. The cast flings it. */
export const hook: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, fl = p.is("cast") ? p.mix(0, 1, { castWind: -0.2 }) : p.mix(0, 0.45, { wind: -0.15 });
    const R = p.mix<V3>([0.16, 0.26, 0.4], [0.4, 0.14, 0.5], { wind: [-0.1, 0.3, 0.6], cast: [0.42, 0.12, 0.54], castWind: [-0.14, 0.3, 0.62] });
    const h = guy(m, p, { weight: "heavy", size: 1.18, bulk: 1.38, skin: P.ogre, handR: R, twist: 20, torso: P.team, arms: P.ogre, legs: P.leather, boots: P.black, hands: P.ogre, lunge: 0.5 });
    belt(m, h, P.black, trim(t), 1.38);
    m.at(h.chest, () => m.ellipsoid([0, 0.24, 0.14], [0.11, 0.11, 0.08], trim(t), { segs: 6 }));
    m.at(h.head, () => { m.decal(0.03, () => { for (const s of [1, -1]) m.box([r * 0.9, s * r * 0.4, -r * 0.5], [r * 0.14, r * 0.16, r * 0.3], P.white); }); headband(m, r, P.team); m.box([0, 0, r * 0.95], [r * 0.5, r * 0.5, r * 0.3], P.black); rank(m, p, r * 1.4); });
    m.at(h.aim("R", norm(p.mix<V3>([0.7, 0.1, -0.7], [1, 0, 0], { wind: [-0.4, 0.2, 0.9], cast: [1, 0, 0.05], castWind: [-0.5, 0.2, 0.8] }))), () => {
      const len = 0.16 + 0.9 * Math.max(0, fl);
      m.group(() => { for (let x = 0.04; x < len; x += 0.09) m.box([x, 0, 0], [0.06, 0.05, 0.05], P.grey); });
      m.with(() => { m.move(len, 0, 0); m.group(() => { m.box([0.06, 0, 0], [0.16, 0.05, 0.06], blade(t)); m.box([0.14, 0, 0], [0.06, 0.05, 0.3], blade(t)); for (const s of [1, -1]) m.box([0.08, 0, s * 0.15], [0.12, 0.05, 0.06], blade(t)); }); });
      if (p.hit) sparkle(m, [len + 0.2, 0, 0], 0.05);
    });
  },
};

/** Fuse Runner: sprinting flat out with a huge lit bomb held overhead. */
export const keg: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, up = p.mix(0.86, 0.6, { wind: 0.9 }), fw = p.mix(0.04, 0.4, { wind: -0.04 });
    const h = guy(m, p, { weight: "light", bulk: 0.95, handR: [fw, 0.14, up - 0.1], handL: [fw, -0.14, up - 0.1], lean: 22, torso: P.team, arms: P.skin, legs: P.woodDk, lunge: 0.8, stride: 0.44 });
    m.at(h.head, () => { headband(m, r, P.team); m.box([-r * 0.1, 0, r * 0.95], [r * 1.2, r * 1.3, r * 0.3], P.leather); });
    if (!p.after) m.with(() => { m.move(...h.pt([fw, 0, up + 0.1])); bomb(m, 0.21 + 0.012 * t, t >= 4 ? P.gloryInk : (p.i % 2 ? P.fire : P.fireHot), t >= 3 ? P.redDk : P.black); m.decal(0.02, () => m.cylinder([0, 0, -0.04], [0, 0, 0.04], 0.225 + 0.012 * t, t >= 2 ? trim(t) : P.team, 0.225 + 0.012 * t, { segs: 10 })); });
    else { flash(m, h.pt([0.5, 0, 0.5]), 0.16); puff(m, h.pt([0.5, 0, 0.7]), 0.2, p.hit ? 0.2 : 0.8); }
  },
};

/** Digger: a miner with a lamp on his helmet and a big pickaxe. */
export const sapper: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const h = guy(m, p, { weight: "mid", bulk: 1.05, handR: c.hand, twist: 24, torso: P.team, arms: P.team, legs: P.leather, boots: P.black });
    belt(m, h, P.black, trim(t), 1.05);
    m.at(h.back, () => m.box([0.06, 0, -0.02], [0.1, 0.24, 0.24], P.sack));
    m.at(h.head, () => { helm(m, r, t >= 3 ? P.gold : P.yellow, { brim: true, crest: P.team }); m.decal(0.05, () => m.box([r * 1.0, 0, r * 0.55], [r * 0.3, r * 0.44, r * 0.44], t >= 4 ? P.glory : P.lamp)); beard(m, r, P.wood, 0.7); rank(m, p, r * 1.3); });
    m.at(h.aim("R", c.aim), () => {
      const L = 0.4 + 0.02 * t;
      m.cylinder([-0.1, 0, 0], [L, 0, 0], 0.024, P.wood, 0.024, { segs: 5 });
      m.tube([[L - 0.1, 0, 0.26], [L + 0.02, 0, 0.1], [L + 0.04, 0, 0], [L + 0.02, 0, -0.1], [L - 0.1, 0, -0.26]], [0.012, 0.035, 0.04, 0.035, 0.012], blade(t), { segs: 4 });
    });
    if (p.hit) { flash(m, h.pt([0.5, 0, 0.1]), 0.06, P.spark, P.spark); puff(m, h.pt([0.5, 0.1, 0.06]), 0.08, 0.3, P.sack); }
  },
};

/** Smith: a leather apron, goggles, a giant hammer and a pack of gears. The cast builds a Pop Gun. */
export const tinker: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.14, 0.22, 0.38], [0.32, 0.1, 0.24], { wind: [-0.04, 0.24, 0.7], cast: [0.3, 0.1, 0.16], castWind: [-0.02, 0.24, 0.74] });
    const aim = norm(p.mix<V3>([0.45, 0.1, 1], [1, -0.2, -0.5], { wind: [-0.5, 0.15, 1], cast: [0.9, -0.1, -0.8], castWind: [-0.5, 0.1, 1] }));
    const h = guy(m, p, { weight: "mid", bulk: 1.12, handR: R, twist: 20, torso: P.team, arms: P.team, legs: P.woodDk, boots: P.black, lunge: 0.6 });
    m.at(h.chest, () => m.decal(0.025, () => m.box([0.1, 0, -0.08], [0.14, 0.3, 0.36], P.leather)));
    m.at(h.back, () => { m.box([0.07, 0, 0], [0.12, 0.28, 0.26], P.woodDk); m.with(() => { m.move(0.14, 0, 0.06).rotY(90); m.cylinder([0, 0, 0], [0, 0, 0.04], 0.12, trim(Math.max(2, t)), 0.12, { segs: 6 }); }); });
    m.at(h.head, () => { m.decal(0.04, () => m.box([r * 0.9, 0, r * 0.12], [r * 0.3, r * 1.5, r * 0.42], trim(t))); m.decal(0.06, () => { for (const s of [1, -1]) m.box([r * 0.98, s * r * 0.4, r * 0.12], [r * 0.2, r * 0.4, r * 0.3], P.ice); }); m.box([-r * 0.1, 0, r * 0.95], [r * 1.3, r * 1.4, r * 0.3], P.orange); headband(m, r, P.team); rank(m, p, r * 1.35); });
    m.at(h.aim("R", aim), () => hammer(m, 0.36 + 0.02 * t, blade(t) === P.steel ? P.iron : P.glory, 0.16));
    if (p.hit) flash(m, h.pt([0.48, 0, 0.08]), 0.07, P.spark, P.yellow);
  },
};

// ------------------------------------------------------------------------------------------------ casters
/** Zap Wizard: a tall pointed hat and a staff with a lightning bolt on it. */
export const storm: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const h = guy(m, p, { weight: "mid", torso: P.team, arms: P.team, legs: P.teamDk, boots: P.black, handR: staffHand(p), handL: offHand(p), lunge: 0, recoil: 0.02 });
    robe(m, h, P.team, 0.25, 0.2);
    belt(m, h, P.yellow, trim(t));
    m.at(h.head, () => { beard(m, r, P.white, 1.1); wizHat(m, r, P.team, t >= 3 ? P.gold : P.yellow, 2.3 + 0.1 * t); if (t >= 4) rank(m, p, r * 2.6); });
    m.at(h.aim("R", [1, 0, 0]), () => {
      const top = 0.5 + 0.02 * t;
      staff(m, 0.36, top, P.woodDk);
      m.group(() => { m.box([0, 0, top + 0.04], [0.06, 0.18, 0.07], P.zap); m.box([0, 0.05, top + 0.11], [0.06, 0.09, 0.09], P.zap); m.box([0, -0.05, top - 0.03], [0.06, 0.09, 0.09], t >= 4 ? P.gloryInk : P.zap); });
      if (p.hit) { zigzag(m, [0.05, 0, top + 0.05], [0.75, 0, top - 0.25], 0.09, P.zap, 0.03); sparkle(m, [0.78, 0, top - 0.27], 0.05, P.spark); }
      if (p.after && !p.hit) zigzag(m, [0.3, 0, top], [0.85, 0, top - 0.3], 0.07, P.spark, 0.02, 4);
    });
  },
};

/** Frost Mage: a white fur hood, a team robe and a staff topped with a big snowflake. */
export const rime: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const h = guy(m, p, { weight: "mid", torso: P.team, arms: P.white, legs: P.iceDk, boots: P.white, handR: staffHand(p), handL: offHand(p), lunge: 0, recoil: 0.02 });
    robe(m, h, P.team, 0.24, 0.2);
    m.at(h.chest, () => m.decal(0.02, () => m.cylinder([0, 0, 0.1], [0, 0, 0.2], 0.21, P.white, 0.15, { segs: 8 })));
    m.at(h.head, () => { hood(m, r, P.white, 0); m.decal(0.03, () => m.box([-r * 0.1, 0, r * 1.0], [r * 1.5, r * 0.8, r * 0.4], P.team)); rank(m, p, r * 1.4); });
    m.at(h.aim("R", [1, 0, 0]), () => {
      const top = 0.5 + 0.02 * t;
      staff(m, 0.36, top, t >= 3 ? P.gold : P.iceDk);
      sparkle(m, [0, 0, top + 0.08], 0.075, t >= 4 ? P.gloryInk : P.frostBlue);
      m.box([0, 0, top + 0.08], [0.1, 0.1, 0.1], P.frost);
      if (p.after) { const k = p.hit ? 1 : 1.5; for (const [x, y, z] of [[0.3, 0, 0.02], [0.5, 0.12, -0.06], [0.5, -0.12, -0.02], [0.7, 0.04, -0.1], [0.72, -0.14, -0.14]]) m.box([x * k, y * k, top + z * k], [0.07, 0.07, 0.07], (x * 10) % 2 > 1 ? P.frost : P.frostBlue); }
    });
  },
};

/** Wave Mage: a shell hat, a team robe and a gold trident; the blow throws a wall of water forward. */
export const tide: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.18, 0.2, 0.42], [0.36, 0.12, 0.44], { wind: [0.0, 0.24, 0.6] });
    const h = guy(m, p, { weight: "mid", bulk: 1.05, torso: P.team, arms: P.team, legs: P.seaDk, boots: P.seaDk, handR: R, handL: offHand(p), lunge: 0.3, recoil: 0.03 });
    robe(m, h, P.team, 0.25, 0.2);
    belt(m, h, P.sea, trim(t), 1.05);
    m.at(h.head, () => { m.group(() => { m.ellipsoid([-r * 0.1, 0, r * 0.4], [r * 1.25, r * 1.3, r * 0.75], P.sea, { segs: 8 }); m.cone([-r * 0.3, 0, r * 0.9], [-r * 1.2, 0, r * 1.5], r * 0.5, P.sea, { segs: 5 }); }); m.decal(0.02, () => m.cylinder([0, 0, r * 0.2], [0, 0, r * 0.55], r * 1.34, P.team, r * 1.25, { segs: 8 })); beard(m, r, P.ice, 0.8); rank(m, p, r * 1.6); });
    m.at(h.aim("R", norm(p.mix<V3>([0.3, 0, 1], [1, 0, 0.1], { wind: [-0.2, 0, 1] }))), () => {
      const L = 0.5 + 0.02 * t, g = t >= 4 ? P.glory : P.gold;
      m.cylinder([-0.3, 0, 0], [L, 0, 0], 0.022, P.woodDk, 0.022, { segs: 5 });
      m.group(() => { m.box([L, 0, 0], [0.05, 0.26, 0.05], g); for (const y of [-0.11, 0, 0.11]) m.box([L + 0.09, y, 0], [0.16, 0.045, 0.045], g); });
    });
    if (p.after) {
      const k = p.hit ? 1 : 1.5;
      m.group(() => { for (const y of [-0.18, 0, 0.18]) m.box(h.pt([0.5 * k + 0.2, y, 0.16]), [0.2, 0.17, 0.32], P.water); });
      m.group(() => { for (const y of [-0.18, 0, 0.18]) m.box(h.pt([0.5 * k + 0.28, y, 0.36]), [0.14, 0.14, 0.1], P.foam); });
    }
  },
};

/** Cleric: a white robe with a team cowl, a staff topped with a green heart. Heals on the cast. */
export const medic: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, casting = p.is("cast");
    const h = guy(m, p, { weight: "light", torso: P.white, arms: P.white, legs: P.white, boots: P.cream, handR: staffHand(p), handL: offHand(p), lunge: 0 });
    robe(m, h, P.white, 0.24, 0.2);
    m.at(h.chest, () => { m.decal(0.02, () => m.cylinder([0, 0, 0.0], [0, 0, 0.2], 0.27, P.team, 0.15, { segs: 8 })); m.decal(0.03, () => m.box([0.12, 0, -0.1], [0.08, 0.1, 0.34], P.team)); });
    m.at(h.head, () => { hood(m, r, P.white, 0.3); m.decal(0.03, () => m.box([-r * 0.1, 0, r * 1.05], [r * 0.5, r * 1.3, r * 0.4], P.heal)); m.decal(0.035, () => m.box([-r * 0.1, 0, r * 1.05], [r * 1.3, r * 0.5, r * 0.4], P.heal)); rank(m, p, r * 1.5); });
    m.at(h.aim("R", [1, 0, 0]), () => {
      const top = 0.48 + 0.02 * t;
      staff(m, 0.36, top, t >= 3 ? P.gold : P.cream);
      m.with(() => { m.rotZ(90); heart(m, [0, 0, top + 0.1], 0.065, t >= 4 ? P.gloryInk : P.heal); });
      if ((casting || p.is("attack")) && p.after) { const k = p.hit ? 0 : 0.12; for (const [x, y, z] of [[0.2, 0.2, 0.2], [0.1, -0.24, 0.05], [0.3, 0, 0.36]]) sparkle(m, [x, y, top + z + k], 0.04, P.heal); }
    });
  },
};

/** Necromancer: a dark pointed hood, a team mantle and a skull on a staff that burns green. The cast raises bones. */
export const grave: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const h = guy(m, p, { weight: "mid", skin: P.bone, torso: P.purpleDk, arms: P.purpleDk, legs: P.night, boots: P.black, hands: P.bone, handR: staffHand(p), handL: offHand(p), lunge: 0, noFace: true });
    robe(m, h, P.purpleDk, 0.26, 0.2);
    m.at(h.chest, () => m.decal(0.02, () => m.cylinder([0, 0, 0.02], [0, 0, 0.2], 0.25, P.team, 0.15, { segs: 8 })));
    m.at(h.head, () => { hood(m, r, P.purpleDk, 0.9); m.decal(0.04, () => { for (const s of [1, -1]) m.box([r * 0.95, s * r * 0.38, 0], [r * 0.2, r * 0.3, r * 0.3], t >= 4 ? P.gloryInk : P.ghost); }); rank(m, p, r * 1.9); });
    m.at(h.aim("R", [1, 0, 0]), () => {
      const top = 0.5 + 0.02 * t;
      staff(m, 0.36, top, t >= 3 ? P.gold : P.black);
      m.group(() => { m.box([0, 0, top + 0.09], [0.15, 0.16, 0.14], P.bone); m.box([0.01, 0, top], [0.1, 0.1, 0.06], P.bone); });
      m.decal(0.04, () => { for (const s of [1, -1]) m.box([0.07, s * 0.04, top + 0.1], [0.03, 0.045, 0.05], P.black); });
      m.group(() => { m.box([0, 0, top + 0.21], [0.1, 0.1, 0.1], P.ghost); m.box([0, 0, top + 0.3 + 0.02 * (p.i % 2)], [0.06, 0.06, 0.08], P.ghost); });
      if (p.after) { const k = p.hit ? 0 : 0.14; for (const [x, y, z] of [[0.3, 0.16, -0.3], [0.44, -0.14, -0.4], [0.2, 0, 0.3]]) sparkle(m, [x, y, top + z + k], 0.045, P.ghost); }
    });
  },
};

/** Druid: antlers, a leaf cloak and a staff that sprouts. Sows brambles ahead of the enemy. */
export const thorn: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const h = guy(m, p, { weight: "mid", torso: P.team, arms: P.team, legs: P.woodDk, boots: P.leather, handR: staffHand(p), handL: offHand(p), lunge: 0 });
    robe(m, h, P.team, 0.24, 0.2);
    cape(m, h, p, P.teamFlat, 0.44, 0.24);
    m.at(h.head, () => {
      hood(m, r, P.moss, 0);
      for (const s of [1, -1]) m.group(() => { m.tube([[0, s * r * 0.7, r * 0.8], [0, s * r * 1.2, r * 1.4], [0, s * r * 1.1, r * 2.0]], r * 0.16, t >= 3 ? P.gold : P.woodLt, { segs: 4 }); m.box([0, s * r * 1.6, r * 1.5], [r * 0.25, r * 0.6, r * 0.25], t >= 3 ? P.gold : P.woodLt); });
      rank(m, p, r * 1.5);
    });
    m.at(h.aim("R", [1, 0, 0]), () => {
      const top = 0.48 + 0.02 * t;
      staff(m, 0.36, top, P.woodDk, 0.026);
      m.group(() => { m.box([0, 0, top + 0.08], [0.2, 0.2, 0.16], t >= 4 ? P.glory : P.leaf); m.box([0, 0, top + 0.19], [0.1, 0.1, 0.08], P.green); });
      if (t >= 2) m.box([0.04, 0.06, top + 0.1], [0.07, 0.07, 0.07], P.pink);
    });
    if (p.after) { const k = p.hit ? 1 : 1.3; m.group(() => { for (const [x, y] of [[0.5, 0], [0.66, 0.16], [0.66, -0.16]]) m.cone(h.pt([x * k, y, 0]), h.pt([x * k + 0.04, y, 0.26 * k]), 0.07, P.leaf, { segs: 4 }); }); }
  },
};

/** Lantern Monk: a bald monk in a team robe with a glowing lantern on a long pole. The cast sets a ward. */
export const lamp: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const h = guy(m, p, { weight: "mid", torso: P.team, arms: P.team, legs: P.teamDk, boots: P.leather, handR: staffHand(p), handL: offHand(p), lunge: 0 });
    robe(m, h, P.team, 0.24, 0.2);
    belt(m, h, P.cream, trim(t));
    m.at(h.head, () => { m.decal(0.02, () => m.cylinder([0, 0, r * 0.1], [0, 0, r * 0.3], r * 1.03, P.woodDk, r * 1.0, { segs: 8 })); rank(m, p, r * 1.25); });
    m.at(h.aim("R", [1, 0, 0]), () => {
      const top = 0.62 + 0.02 * t, sw = 0.03 * p.wave(1);
      staff(m, 0.36, top, P.woodDk);
      m.box([0.1, 0, top], [0.26, 0.03, 0.03], P.woodDk);
      m.with(() => { m.move(0.2 + sw, 0, top - 0.14); m.box([0, 0, 0.1], [0.12, 0.12, 0.04], trim(Math.max(2, t))); m.box([0, 0, 0], [0.15, 0.15, 0.17], t >= 4 ? P.glory : P.lamp); m.box([0, 0, -0.1], [0.12, 0.12, 0.04], trim(Math.max(2, t))); });
      if (p.after) { const k = p.hit ? 1 : 1.4; for (let i = 0; i < 4; i++) sparkle(m, [0.2 + Math.cos(i * 1.57 + 0.4) * 0.26 * k, Math.sin(i * 1.57 + 0.4) * 0.26 * k, top - 0.14], 0.04, P.yellow); }
    });
  },
};

// ------------------------------------------------------------------------------------------------ leaders and showmen
/** Flagbearer: the tall team flag is the whole silhouette. The cast rallies. */
export const banner: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.2, 0.4], [0.3, 0.14, 0.5], { wind: [0.04, 0.22, 0.5], cast: [0.14, 0.2, 0.66], castWind: [0.14, 0.2, 0.36] });
    const h = guy(m, p, { weight: "mid", handR: R, handL: offHand(p), torso: P.team, arms: P.grey, legs: P.dark, lunge: 0.3 });
    tunic(m, h, P.team);
    m.at(h.head, () => { helm(m, r, trim(t), { plume: P.team }); if (t >= 4) rank(m, p, r * 1.7); });
    m.at(h.aim("R", [1, 0, 0]), () => {
      const top = 0.95 + 0.04 * t, w = 0.03 * p.wave(1, 1), w2 = 0.03 * p.wave(1, 1, 0.3);
      staff(m, 0.36, top, P.woodDk, 0.024);
      m.box([0, 0, top + 0.03], [0.07, 0.07, 0.07], t >= 4 ? P.glory : trim(Math.max(2, t)));
      m.poly([[0, 0, top], [-0.26, w, top - 0.02], [-0.5, w2, top - 0.04], [-0.5, w2, top - 0.4], [-0.26, w, top - 0.42], [0, 0, top - 0.44]], P.teamFlat);
      m.decal(0.012, () => m.poly([[-0.14, w * 0.5, top - 0.14], [-0.36, (w + w2) / 2, top - 0.15], [-0.36, (w + w2) / 2, top - 0.3], [-0.14, w * 0.5, top - 0.3]], t >= 3 ? P.gold : P.white));
      if (p.is("cast") && p.after) for (const [x, z] of [[-0.6, 0], [0.2, 0.1], [-0.25, 0.25]]) sparkle(m, [x, 0, top - 0.2 + z], 0.045, P.yellow);
    });
  },
};

/** Hero: bigger than anyone on foot, caped, a plumed gold helm and a great sword. The cast rallies the army. */
export const lion: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), cast = p.is("cast");
    const R = cast ? p.mix<V3>([0.14, 0.22, 0.4], [0.12, 0.2, 0.78], { castWind: [0.1, 0.24, 0.36] }) : c.hand;
    const aim = cast ? norm(p.mix<V3>([0.45, 0.1, 1], [0, 0, 1], { castWind: [0.8, 0.1, 0.4] })) : c.aim;
    const L = p.mix<V3>([0.26, -0.06, 0.38], [0.36, -0.04, 0.4], { wind: [0.2, -0.08, 0.38] });
    const h = guy(m, p, { weight: "heavy", size: 1.2, bulk: 1.18, handR: R, handL: L, twist: 26, torso: P.team, arms: P.steel, legs: P.iron, boots: P.gold, hands: P.steel, lunge: cast ? 0 : 1 });
    tunic(m, h, P.team, 0.22);
    belt(m, h, P.gold, P.white, 1.18);
    cape(m, h, p, P.teamFlat, 0.5, 0.26);
    m.at(h.chest, () => { for (const s of [1, -1]) m.box([0, s * 0.22, 0.15], [0.16, 0.14, 0.1], P.gold); });
    m.at(h.head, () => { helm(m, r, P.gold, { plume: t >= 3 ? P.white : P.team }); rank(m, p, r * 1.75); });
    m.at(h.aim("L", [1, 0, 0]), () => { m.move(0.05, 0, 0); shield(m, 0.34, 0.4, P.gold, P.teamFlat, P.white); });
    m.at(h.aim("R", aim), () => sword(m, 0.56 + 0.03 * t, blade(t), P.gold, 0.085));
    if (p.hit && !cast) slashArc(m, h, [0.05, 0, 0.4], 0.66, 75, -50, -0.3);
    if (cast && p.after) for (let i = 0; i < 5; i++) sparkle(m, h.pt([0.12 + Math.cos(i * 1.26) * 0.3, 0.2 + Math.sin(i * 1.26) * 0.3, 1.1 + (p.hit ? 0 : 0.1) + 0.06 * (i % 2)]), 0.05, P.yellow);
  },
};

/** The Jester and his Dummy share a body: a two-horned cap with bells, a cape, three juggled stars. */
function jester(m: Model, p: Pose, fake: boolean) {
  const t = p.tier, cast = p.is("cast");
  const cloth: Material = fake ? P.sack : P.team, alt: Material = fake ? P.straw : P.yellow;
  const R = p.mix<V3>([0.16, 0.24, 0.42], [0.36, 0.1, 0.46], { wind: [-0.06, 0.26, 0.6], cast: [0.2, 0.3, 0.72], castWind: [0.1, 0.2, 0.36] });
  const L = p.mix<V3>([0.16, -0.24, 0.42], [0.2, -0.2, 0.4], { wind: [0.1, -0.26, 0.5], cast: [0.2, -0.3, 0.72], castWind: [0.1, -0.2, 0.36] });
  const h = guy(m, p, { weight: "light", bulk: 0.95, skin: fake ? P.sack : P.skin, handR: R, handL: L, torso: cloth, arms: alt, legs: fake ? P.straw : P.purple, boots: fake ? P.woodDk : P.yellow, hands: fake ? P.straw : P.white, lunge: 0.5, noFace: fake });
  tunic(m, h, cloth);
  if (fake) m.cylinder([0, 0, 0], [0, 0, 0.3], 0.03, P.woodDk, 0.03, { segs: 4 });
  else cape(m, h, p, P.teamDk, 0.4, 0.2);
  m.at(h.head, () => {
    for (const s of [1, -1]) { m.cone([0, s * r * 0.4, r * 0.5], [-r * 0.2, s * r * 1.6, r * 1.5], r * 0.6, s > 0 ? cloth : alt, { segs: 5 }); m.box([-r * 0.2, s * r * 1.65, r * 1.55], [r * 0.34, r * 0.34, r * 0.34], fake ? P.woodDk : trim(Math.max(3, t))); }
    m.decal(0.02, () => m.cylinder([0, 0, r * 0.3], [0, 0, r * 0.55], r * 1.05, alt, r * 1.0, { segs: 8 }));
    if (fake) m.decal(0.04, () => { for (const s of [1, -1]) { m.box([r * 0.97, s * r * 0.38, r * 0.05], [r * 0.1, r * 0.3, r * 0.1], P.black); m.box([r * 0.97, s * r * 0.38, r * 0.05], [r * 0.1, r * 0.1, r * 0.3], P.black); } });
    rank(m, p, r * 1.5);
  });
  if (!fake) {
    const n = 3, ph = p.is("idle") || p.is("walk") ? p.t : 0;
    for (let i = 0; i < n; i++) { const a = (ph + i / n) * Math.PI * 2; sparkle(m, h.pt([0.24 + (cast && p.after ? 0.3 : 0), Math.cos(a) * 0.26, 0.66 + Math.sin(a) * 0.14 + (cast && p.after ? 0.1 : 0)]), 0.04, t >= 4 ? P.gloryInk : i === 1 ? P.pink : P.yellow); }
    if (p.hit && !cast) flash(m, h.pt([0.5, 0.05, 0.46]), 0.06, P.pink, P.white);
  }
}
/** Jester: throws out Dummies of himself. */
export const trickster: UnitDef = { weight: "light", cast: true, build: (m, p) => jester(m, p, false) };
/** Dummy: a sack-and-straw copy of the Jester on a stick. */
export const decoy: UnitDef = { weight: "light", build: (m, p) => jester(m, p, true) };

/** Skeleton: thin white bones with a rusty sword and a scrap of team cloth. */
export const thrall: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = chop(p);
    const h = guy(m, p, { weight: "light", bulk: 0.72, skin: P.bone, handR: c.hand, twist: 20, torso: P.bone, arms: P.bone, legs: P.bone, boots: P.boneDk, hands: P.bone, noFace: true });
    tunic(m, h, P.team, 0.17);
    m.at(h.chest, () => m.decal(0.02, () => { for (const z of [-0.04, 0.06]) m.box([0.11, 0, z], [0.06, 0.26, 0.04], P.dark); }));
    m.at(h.head, () => { m.decal(0.04, () => { for (const s of [1, -1]) m.box([r * 0.92, s * r * 0.4, r * 0.05], [r * 0.2, r * 0.36, r * 0.4], P.black); m.box([r * 0.96, 0, -r * 0.5], [r * 0.2, r * 0.7, r * 0.16], P.black); }); headband(m, r, P.team); });
    m.at(h.aim("R", c.aim), () => sword(m, 0.32, P.copper, P.dark, 0.055));
    if (p.hit) slashArc(m, h, [0.05, 0, 0.36], 0.4, 70, -45, -0.25);
  },
};

/** Blockhead and its Half Block: stone blocks with a face, team shoulder plates and huge fists. */
function blocky(m: Model, p: Pose, size: number, tier: number, half = false) {
  const R = p.mix<V3>([0.16, 0.34, 0.3], [0.5, 0.16, 0.4], { wind: [-0.1, 0.36, 0.66] });
  const L = p.mix<V3>([0.16, -0.34, 0.3], [0.24, -0.3, 0.34], { wind: [0.2, -0.34, 0.36] });
  const h = guy(m, p, { weight: "heavy", size, bulk: 1.5, leg: half ? 0.7 : 0.9, handR: R, handL: L, twist: 18, skin: P.stone, torso: P.stone, arms: P.stoneDk, legs: P.stoneDk, boots: P.stoneDk, hands: P.stone, noHead: true, noTorso: true, noFace: true, lunge: 0.7 });
  const eye = tier >= 4 ? P.gloryInk : P.yellow;
  if (!half) m.at(h.hips, () => { m.box([0, 0, 0.04], [0.4, 0.52, 0.24], P.stoneDk); m.decal(0.02, () => m.box([0.2, 0, 0.04], [0.02, 0.2, 0.16], P.teamFlat)); });
  m.at(h.chest, () => {
    const z = half ? -0.04 : 0.16, s = half ? 0.9 : 1;
    m.box([0, 0, z], [0.46 * s, 0.62 * s, 0.44 * s], P.stone);
    m.decal(0.02, () => { for (const sd of [1, -1]) m.box([0.23 * s, sd * 0.14 * s, z + 0.06], [0.03, 0.12, 0.1], eye); m.box([0.23 * s, 0, z - 0.1 * s], [0.03, 0.3 * s, 0.06], P.black); });
    m.decal(0.015, () => m.box([-0.05, 0.2 * s, z + 0.2 * s], [0.2, 0.16, 0.06], P.moss));
    if (half) m.box([-0.02, 0, z + 0.24 * s], [0.3, 0.4, 0.08], P.team);
    if (!half) for (const sd of [1, -1]) m.box([0, sd * 0.36, z + 0.14], [0.26, 0.14, 0.2], P.team);
    if (!half && tier >= 2) m.box([0, 0, z + 0.26], [0.2, 0.2, 0.1], trim(tier));
    if (!half && tier >= 3) m.box([0, 0, z + 0.36], [0.1, 0.1, 0.12], P.gold);
    if (!half && tier >= 4) m.at([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, z + 0.2], () => rank(m, p, 0.3));
  });
  for (const hp of [h.pR, h.pL]) m.box(hp, [0.2 * size, 0.2 * size, 0.2 * size], P.stoneLt);
  if (p.hit) { flash(m, h.pt([0.6, 0.1, 0.3]), 0.09 * size, P.spark, P.yellow); puff(m, h.pt([0.6, 0.1, 0.1]), 0.12, 0.3, P.stoneDk); }
}
/** Blockhead: the biggest body on the board, two stacked blocks. */
export const golem: UnitDef = { weight: "heavy", build: (m, p) => blocky(m, p, 1.42, p.tier) };
/** Half Block: one block of a fallen Blockhead. */
export const golemling: UnitDef = { weight: "heavy", build: (m, p) => blocky(m, p, 1.0, 1, true) };
