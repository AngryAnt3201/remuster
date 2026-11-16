// Dustline's folk on foot. Each is the humanoid rig plus a hat nobody else wears and one big prop: the camera looks
// down, so the hat and the thing in the hands say the job, and the serape, coat or shirt says whose side it is on.
import { gripAim, humanoid, type HumanoidOpts, type HumanoidRig, type Pose, type UnitDef } from "../../../artkit/rig";
import { Model, frameAt, lerp3, mat, norm, type Material, type V3 } from "../../../artkit/toon3d";
import { GOLD, P, arcBolt, badge, bandolier, beard, braces, core, derby, dynamite, flash, flatHat, gunbelt, halo, kepi, mask, moustache, neckerchief, powderKeg, puff, rifle, saguaro, serape, skirt, sombrero, star, stetson, stovepipe, strawHat, trim, trim2, wisp } from "./parts";

/** The humanoid with Dustline's defaults: team shirt, denim, hide boots. */
function poke(m: Model, p: Pose, o: Partial<HumanoidOpts>): HumanoidRig {
  return humanoid(m, p, { skin: P.skin, torso: P.team, legs: P.denim, boots: P.hideDk, ...o });
}
/** A crescent of light where a blade passed: an arc of radius r about body point c, from a0 to a1 degrees (0 = ahead,
 *  90 = the body's right). */
function slashArc(m: Model, h: HumanoidRig, c: V3, r: number, a0: number, a1: number, dz = 0, col: Material = P.slash) {
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
/** A shaft along +x from the grip, from -back to +front. */
const shaft = (m: Model, back: number, front: number, r = 0.016, col: Material = P.wood) => m.cylinder([-back, 0, 0], [front, 0, 0], r, col, r, { segs: 6 });
/** A heavy knife or machete along +x. */
function bowie(m: Model, len: number, blade: Material = P.steel, guard: Material = P.brass) {
  m.extrude([[0.03, -0.022], [len * 0.8, -0.026], [len, 0.012], [len * 0.82, 0.03], [0.03, 0.022]], 0.014, blade);
  m.group(() => { m.box([0.025, 0, 0], [0.022, 0.03, 0.075], guard); m.capsule([-0.07, 0, 0], [0.015, 0, 0], 0.02, P.hideDk, 0.02, { segs: 6 }); });
}
/** A cavalry sabre along +x. */
function sabre(m: Model, len: number, blade: Material = P.steel, guard: Material = P.brass) {
  m.extrude([[0.04, -0.018], [len * 0.7, -0.02], [len, 0.035], [len * 0.7, 0.026], [0.04, 0.018]], 0.014, blade);
  m.group(() => { m.box([0.03, 0, 0], [0.025, 0.09, 0.06], guard); m.capsule([-0.06, 0, 0], [0.02, 0, 0], 0.02, P.hideDk, 0.02, { segs: 6 }); m.tube([[0.03, 0, -0.03], [-0.02, 0, -0.06], [-0.06, 0, -0.02]], 0.01, guard, { segs: 4 }); });
}
const up = (tilt: number): V3 => [Math.sin((tilt * Math.PI) / 180), 0, Math.cos((tilt * Math.PI) / 180)];

// ------------------------------------------------------------------------------------------------ guns
/** Deadeye: a rifleman in a serape and a stetson. Keeps his distance; the long rifle is the silhouette. */
export const ranger: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.06, 0.13, 0.33], [0.04, 0.1, 0.47], { wind: [0.02, 0.12, 0.44] });
    const L = p.mix<V3>([0.25, -0.05, 0.4], [0.3, 0.0, 0.485], { wind: [0.2, -0.02, 0.56] });
    const h = poke(m, p, { weight: "light", bulk: 0.92, torso: P.canvas, arms: P.canvas, hands: P.hide, handR: R, handL: L, lunge: 0, recoil: 0.04, swingR: 0.3, swingL: 0.3 });
    serape(m, h, P.team, t >= 3 ? GOLD : P.teamDk, 0.95, 0.2);
    gunbelt(m, h, t);
    m.at(h.head, () => {
      stetson(m, 0.19, t >= 3 ? P.hideLt : P.hide, P.team);
      if (t >= 2) m.decal(0.02, () => m.sphere([0.155, 0, 0.19], 0.028, trim(t), { segs: 6 }));
      if (t >= 3) m.cone([-0.1, 0.13, 0.14], [-0.24, 0.2, 0.36], 0.04, P.white, { segs: 5 });
      halo(m, p, 0.5);
    });
    m.at(gripAim(h.pR, h.pL), () => {
      const len = 0.5 + 0.03 * t;
      rifle(m, t, len);
      if (p.hit) flash(m, [len + 0.03, 0, 0.014], 0.08);
      if (p.after) puff(m, [len + 0.1 + (p.hit ? 0 : 0.07), 0, 0.06], 0.07, p.hit ? 0.2 : 0.7);
    });
  },
};

/** Dynamiter: a stout blaster with a satchel of sticks, one bundle always lit in the throwing hand. */
export const grenadier: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.1, 0.24, 0.4], [0.3, 0.14, 0.7], { wind: [-0.14, 0.26, 0.56] });
    const h = poke(m, p, { weight: "mid", bulk: 1.16, handR: R, twist: 24, lunge: 0.5, torso: P.team, arms: P.team, legs: P.wool, hands: P.hide });
    braces(m, h, P.hideDk, 1.16);
    m.at(h.chest, () => {
      m.with(() => {
        m.move(-0.02, -0.215, -0.09);
        m.ellipsoid([0, 0, 0], [0.12, 0.08, 0.1], P.canvasDk);
        m.group(() => { for (const [x, a] of [[0.05, 12], [-0.01, -6], [-0.07, 10]]) m.with(() => { m.move(x, -0.01, 0.1).rotY(a); m.cylinder([0, 0, -0.05], [0, 0, 0.07], 0.024, P.red, 0.024, { segs: 6 }); }); });
      });
      if (t >= 2) m.decal(0.03, () => m.box([0.16, 0, -0.07], [0.02, 0.07, 0.05], trim(t)));
    });
    m.at(h.head, () => {
      derby(m, 0.19, t >= 3 ? P.hideDk : P.felt, P.team);
      moustache(m, 0.19, P.hairRed, 0.5);
      if (t >= 3) m.decal(0.02, () => m.sphere([0.16, 0, 0.2], 0.03, trim(t), { segs: 6 }));
      halo(m, p, 0.46);
    });
    if (!p.after) m.at(frameAt(h.pR, h.dir([0.2, 0, 1])), () => { m.rotY(-90); dynamite(m, 0.17 + 0.01 * t, 0.027, t >= 4 ? P.gloryInk : P.fire, t >= 2 ? 3 : 2); });
    else puff(m, h.pt([0.36, 0.14, 0.78]), 0.05, 0.3, P.smoke, 1);
  },
};

/** Dowser: a water-witch. The barrel on his back and the forked rod find the flood, and the flood clears a lane. */
export const tide: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.2, 0.1, 0.36], [0.3, 0.09, 0.46], { wind: [0.1, 0.12, 0.56] });
    const L = p.mix<V3>([0.2, -0.1, 0.36], [0.3, -0.09, 0.46], { wind: [0.1, -0.12, 0.56] });
    const h = poke(m, p, { weight: "mid", bulk: 1.08, handR: R, handL: L, lunge: 0, recoil: 0.05, torso: P.team, arms: P.team, legs: P.wool, boots: P.black });
    skirt(m, h, P.team, 0.1, 0.2);
    m.at(h.chest, () => m.decal(0.02, () => m.torus([0, 0, -0.07], [0, 0, 1], 0.19, 0.028, P.hideDk, { segs: 12 })));
    m.at(h.back, () => {
      m.move(0.05, 0, -0.14);
      powderKeg(m, 0.125 + 0.006 * t, 0.3, P.barrelBlue, trim2(t));
      m.decal(0.02, () => m.cylinder([0, 0, 0.3], [0, 0, 0.305], 0.09, t >= 4 ? P.glory : P.water, 0.09, { segs: 10 }));
      m.cylinder([0.11, 0, 0.1], [0.17, 0, 0.1], 0.02, P.brass, 0.02, { segs: 6 });
    });
    m.at(h.head, () => { flatHat(m, 0.19, P.felt, P.team, 1.36); moustache(m, 0.19, P.hairGrey, 0.6); halo(m, p, 0.42); });
    // the forked rod: one stem, two branches back to the hands
    const tip = h.pt(p.mix<V3>([0.44, 0, 0.34], [0.58, 0, 0.44], { wind: [0.3, 0, 0.72] })), mid = h.pt(p.mix<V3>([0.32, 0, 0.35], [0.44, 0, 0.45], { wind: [0.2, 0, 0.64] }));
    m.group(() => { m.tube([h.pR, mid, tip], [0.014, 0.016, 0.01], P.woodLt, { segs: 5 }); m.tube([h.pL, mid], 0.014, P.woodLt, { segs: 5 }); });
    if (t >= 3) m.sphere(tip, 0.028, core(t, P.brass), { segs: 6 });
    if (p.after) {
      const k = p.hit ? 1 : 0.6;
      m.at(frameAt(tip, h.dir([1, 0, -0.1])), () => m.group(() => {
        m.cone([0, 0, 0], [0.5 * k, 0, 0], 0.035, P.water, { segs: 8 });
        m.cylinder([0.08, 0, 0], [0.5 * k, 0, 0.02], 0.05 * k, P.water, 0.13 * k, { segs: 8 });
        m.sphere([0.55 * k, 0, 0.02], 0.14 * k, P.water, { segs: 8 });
        for (const s of [1, -1]) m.sphere([0.4 * k, s * 0.12 * k, 0.1 * k], 0.05 * k, P.water, { segs: 6 });
      }));
    }
  },
};

// ------------------------------------------------------------------------------------------------ blades
/** Bowie Trio: three masked knife bandits. Light, quick, always in a pack. */
export const blades: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const h = poke(m, p, { weight: "light", bulk: 0.9, size: 0.94, handR: c.hand, twist: 28, torso: P.team, arms: P.canvas, hands: P.skin, legs: P.felt });
    m.at(h.chest, () => m.decal(0.02, () => m.torus([0, 0, -0.06], [0, 0, 1], 0.165, 0.03, P.hideDk, { segs: 12 })));
    if (t >= 2) bandolier(m, h, P.hideDk);
    m.at(h.head, () => {
      flatHat(m, 0.19, t >= 3 ? P.hideDk : P.feltDk, P.team, 1.42);
      mask(m, 0.19, P.team);
      if (t >= 3) m.decal(0.02, () => m.sphere([0.16, 0, 0.21], 0.026, trim(t), { segs: 6 }));
      halo(m, p, 0.42);
    });
    m.at(h.aim("R", c.aim), () => bowie(m, 0.34 + 0.02 * t, t >= 4 ? GOLD : P.steel, trim2(t)));
    if (p.hit) slashArc(m, h, [0.05, 0, 0.36], 0.42, 70, -45, -0.25);
  },
};

/** Cardsharp: a riverboat gambler with a sword in his cane. Parries, then runs you through. */
export const duelist: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, th = thrust(p, 0.38), parry = p.is("cast");
    const hand = parry ? p.mix<V3>([0.12, 0.2, 0.38], [0.24, 0.02, 0.56], { castWind: [0.1, 0.24, 0.4] }) : th.hand;
    const aim = parry ? norm(p.mix<V3>([1, 0, 0.35], [0.1, -0.9, 0.5], { castWind: [1, 0.2, 0.3] })) : th.aim;
    const L = p.mix<V3>([-0.02, -0.24, 0.36], [-0.14, -0.26, 0.44], { cast: [0.2, -0.2, 0.52] });
    const h = poke(m, p, { weight: "light", bulk: 0.86, handR: hand, handL: L, torso: P.team, arms: P.white, legs: P.black, boots: P.black, lunge: parry ? 0 : 1.2 });
    skirt(m, h, P.black, 0.05, 0.17);
    m.at(h.chest, () => {
      m.decal(0.02, () => { m.ellipsoid([0.11, 0, 0.04], [0.05, 0.07, 0.12], P.white); for (const z of [0.07, 0.0]) m.sphere([0.15, 0, z], 0.016, trim2(t), { segs: 5 }); });
      m.decal(0.03, () => m.box([0.14, 0, 0.14], [0.02, 0.1, 0.035], P.black));
    });
    m.at(h.head, () => { flatHat(m, 0.19, P.black, P.team, 1.5); moustache(m, 0.19, P.black, 0.25); halo(m, p, 0.42); });
    m.at(h.aim("R", aim), () => {
      m.cylinder([0.03, 0, 0], [0.5 + 0.03 * t, 0, 0], 0.013, t >= 4 ? GOLD : P.steel, 0.005, { segs: 6 });
      m.group(() => { m.sphere([0.02, 0, 0], 0.036, trim2(t), { segs: 8 }); m.capsule([-0.08, 0, 0], [0, 0, 0], 0.018, P.black, 0.018, { segs: 6 }); });
      if (p.hit && !parry) m.cone([0.3, 0, 0], [0.86, 0, 0], 0.03, P.slash, { segs: 6 });
      if (p.hit && parry) flash(m, [0.3, 0, 0], 0.07, P.slash, P.slash);
    });
    // a fan of cards in the off hand: flung on the parry
    const fl = parry && p.after ? (p.hit ? 0.12 : 0.26) : 0;
    for (let i = 0; i < (t >= 3 ? 4 : 3); i++) m.at(frameAt([h.pL[0] + fl * (1 + i * 0.4), h.pL[1] + fl * (i - 1.5) * 0.5, h.pL[2] + 0.04 + fl * 0.6], h.dir([0.3, (i - 1.5) * 0.35, 1])), () => m.box([0.05, 0, 0], [0.09, 0.012, 0.06], i === 1 ? P.red : P.white));
  },
};

/** Bushwhacker: black duster, hat pulled low, a knife in each hand. Team colour only where the bandana shows. */
export const shade: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.14, 0.2, 0.36], [0.38, 0.06, 0.44], { wind: [-0.08, 0.26, 0.52] });
    const L = p.mix<V3>([0.14, -0.2, 0.36], [0.3, -0.1, 0.36], { wind: [0.02, -0.26, 0.44] });
    const aR = norm(p.mix<V3>([0.6, 0, 0.8], [1, -0.2, -0.1], { wind: [-0.3, 0.2, 1] })), aL = norm(p.mix<V3>([0.6, 0, 0.8], [1, 0.2, 0.1], { wind: [0.2, -0.2, 1] }));
    const h = poke(m, p, { weight: "light", bulk: 0.9, handR: R, handL: L, twist: 22, lunge: 1.1, lean: 16, torso: P.black, arms: P.black, legs: P.feltDk, boots: P.black, hands: P.black, swingR: 0.5, swingL: 0.5 });
    skirt(m, h, P.black, 0.16, 0.21);
    m.at(h.chest, () => { m.cylinder([0, 0, 0.17], [0, 0, 0.06], 0.1, P.black, 0.2, { segs: 10 }); m.decal(0.02, () => m.torus([0, 0, -0.07], [0, 0, 1], 0.185, 0.02, trim(t), { segs: 12 })); });
    m.at(h.head, () => {
      stetson(m, 0.19, P.black, P.team, { brim: 1.6, h: 0.8, tilt: 8 });
      if (t >= 3) m.decal(0.02, () => m.sphere([0.15, 0, 0.2], 0.028, trim(t), { segs: 6 }));
      mask(m, 0.19, P.team);
      halo(m, p, 0.44);
    });
    m.at(h.aim("R", aR), () => bowie(m, 0.26 + 0.015 * t, t >= 4 ? P.glory : P.steel, trim2(t)));
    m.at(h.aim("L", aL), () => bowie(m, 0.24 + 0.015 * t, t >= 4 ? P.glory : P.steel, trim2(t)));
    if (p.hit) { slashArc(m, h, [0.08, 0, 0.4], 0.4, 60, -30, -0.2); slashArc(m, h, [0.08, 0, 0.34], 0.36, -60, 20, 0.14); }
  },
};

/** Spikedriver: a rail hand with a spike maul as long as he is. Hunts the biggest thing on the field. */
export const ravager: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const L = p.mix<V3>([0.2, 0.02, 0.36], [0.3, -0.06, 0.26], { wind: [0.04, 0.08, 0.6] });
    const h = poke(m, p, { weight: "heavy", bulk: 1.3, size: 1.07, handR: c.hand, handL: L, twist: 30, skin: P.skinTan, torso: P.team, arms: P.skinTan, legs: P.denimDk, boots: P.black });
    braces(m, h, P.hideDk, 1.3);
    m.at(h.chest, () => { m.decal(0.02, () => m.torus([0, 0, -0.08], [0, 0, 1], 0.24, 0.035, P.hideDk, { segs: 12 })); if (t >= 2) m.decal(0.035, () => m.box([0.19, 0, -0.08], [0.02, 0.08, 0.06], trim(t))); });
    m.at(h.head, () => {
      m.decal(0.01, () => m.torus([0, 0, 0.06], [0.1, 0, 1], 0.185, 0.04, P.team, { segs: 12 }));
      m.cone([-0.17, 0.04, 0.05], [-0.33, 0.1 + 0.03 * p.wave(1), -0.06], 0.045, P.team, { segs: 5 });
      beard(m, 0.19, P.hair, 0.8);
      if (t >= 3) for (const s of [1, -1]) m.decal(0.02, () => m.sphere([0.02, s * 0.185, -0.02], 0.03, trim(t), { segs: 6 }));
      halo(m, p, 0.36);
    });
    m.at(h.aim("R", c.aim), () => {
      const len = 0.44 + 0.02 * t;
      shaft(m, 0.2, len, 0.02, P.woodDk);
      m.group(() => { m.box([len, 0, 0], [0.11, 0.1, 0.24 + 0.01 * t], t >= 3 ? P.iron : P.ironDk); });
      for (const s of [1, -1]) m.decal(0.005, () => m.box([len, 0, s * (0.115 + 0.005 * t)], [0.125, 0.115, 0.03], trim2(t)));
      if (t >= 4) m.sphere([len, 0, 0], 0.05, P.glory, { segs: 6 });
    });
    if (p.hit) { slashArc(m, h, [0.1, 0, 0.3], 0.5, 60, -50, -0.2); puff(m, h.pt([0.5, 0, 0.06]), 0.09, 0.3, P.dust, 2); }
  },
};

/** Marshal: the hero. A long coat, a tall white hat with a plume, a sabre as long as he is. Rallies as he kills. */
export const lion: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), rally = p.is("cast");
    const hand = rally ? p.mix<V3>([0.14, 0.2, 0.38], [0.1, 0.2, 0.86], { castWind: [0.16, 0.2, 0.3] }) : c.hand;
    const aim = rally ? norm(p.mix<V3>([0.45, 0.1, 1], [0.1, 0, 1], { castWind: [1, 0, 0] })) : c.aim;
    const h = poke(m, p, { weight: "heavy", bulk: 1.18, size: 1.13, handR: hand, handL: p.mix<V3>([0.1, -0.24, 0.34], [0.02, -0.28, 0.42], { cast: [0.16, -0.2, 0.6] }), twist: rally ? 0 : 26, torso: P.team, arms: P.team, hands: P.hide, legs: P.black, boots: P.black });
    skirt(m, h, P.team, 0.2, 0.25);
    m.at(h.hips, () => m.decal(0.01, () => m.torus([-0.015, 0, -0.17], [0, 0, 1], 0.24, 0.022, t >= 2 ? GOLD : P.teamDk, { segs: 14 })));
    m.at(h.chest, () => {
      badge(m, [0.15, -0.07, 0.07], 0.06, GOLD);
      m.decal(0.02, () => m.torus([0, 0, -0.08], [0, 0, 1], 0.2, 0.03, P.hideDk, { segs: 12 }));
      for (const s of [1, -1]) m.ellipsoid([-0.01, s * 0.2, 0.14], [0.085, 0.095, 0.05], t >= 2 ? GOLD : P.teamDk);
      neckerchief(m, P.red, 1.15);
      // a short cape off the shoulders
      m.extrude([[-0.13, 0.17], [-0.17, 0.0], [-0.23 - 0.02 * p.wave(1), -0.22], [-0.12, -0.22]], 0.36, t >= 3 ? P.white : P.teamDk);
    });
    m.at(h.head, () => {
      stetson(m, 0.19, P.white, t >= 2 ? GOLD : P.team, { brim: 1.75, h: 1.25, tilt: -5 });
      m.capsule([-0.08, 0.1, 0.3], [-0.22, 0.16, 0.5 + 0.03 * t], 0.04, t >= 4 ? P.glory : P.red, 0.065 + 0.008 * t, { segs: 6 });
      moustache(m, 0.19, P.hairGrey, 0.62);
      halo(m, p, 0.62, 0.1);
    });
    m.at(h.aim("R", aim), () => sabre(m, 0.5 + 0.03 * t, t >= 4 ? P.glory : P.steel, GOLD));
    if (p.hit && !rally) slashArc(m, h, [0.05, 0, 0.36], 0.56, 75, -50, -0.3);
    if (rally && p.after) for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + p.i; m.at(frameAt(h.pt([0.1 + 0.32 * Math.cos(a), 0.32 * Math.sin(a), 0.98]), [0, 1, 0]), () => star(m, 0.045, P.lamp, 0.02)); }
  },
};

// ------------------------------------------------------------------------------------------------ the line
/** Barndoor: a smith behind a barn door. The door is the unit: wide, braced, team-painted, always in front. */
export const bulwark: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const sh = p.mix<V3>([0.24, -0.1, 0.36], [0.3, -0.06, 0.38], { wind: [0.2, -0.14, 0.36] });
    const h = poke(m, p, { weight: "heavy", bulk: 1.32, size: 1.1, handR: c.hand, handL: sh, twist: 14, lunge: 0.6, skin: P.skinTan, torso: P.hide, arms: P.canvasDk, legs: P.denimDk, boots: P.black, hands: P.hideDk });
    m.at(h.chest, () => { for (const s of [1, -1]) m.sphere([0, s * 0.225, 0.13], 0.095, P.team); m.decal(0.02, () => m.torus([0, 0, -0.07], [0, 0, 1], 0.245, 0.03, P.hideDk, { segs: 12 })); });
    m.at(h.head, () => { stetson(m, 0.19, P.feltDk, P.team, { brim: 1.4, h: 0.7 }); beard(m, 0.19, P.black, 0.7); halo(m, p, 0.42); });
    // the door: planks, a Z of braces, iron straps, the star
    m.at(frameAt(h.pL, h.dir([1, -0.12, 0])), () => {
      const w = 0.6 + 0.02 * t, hh = 0.66 + 0.02 * t;
      m.move(0.05, 0, 0.02);
      m.box([0, 0, 0], [0.05, w, hh], P.woodDk);
      m.decal(0.01, () => m.box([0.03, 0, 0], [0.012, w * 0.9, hh * 0.9], P.teamFlat));
      m.decal(0.016, () => m.group(() => { for (const y of [-w * 0.3, 0, w * 0.3]) m.box([0.036, y + w * 0.15, 0], [0.008, 0.012, hh * 0.9], P.teamDk); }));
      m.decal(0.022, () => m.group(() => {
        for (const z of [-hh * 0.36, hh * 0.36]) m.box([0.04, 0, z], [0.014, w * 0.96, 0.05], t >= 3 ? trim(t) : P.ironDk);
        m.with(() => { m.move(0.04, 0, 0).rotX(Math.atan2(hh * 0.72, w * 0.9) * (180 / Math.PI)); m.box([0, 0, 0], [0.012, Math.hypot(w * 0.9, hh * 0.72), 0.045], P.woodLt); });
      }));
      m.decal(0.035, () => m.with(() => { m.move(0.05, 0, 0).rotZ(90); star(m, 0.13 + 0.01 * t, t >= 4 ? P.glory : trim2(t), 0.02); }));
    });
    // a smith's hammer
    m.at(h.aim("R", c.aim), () => { shaft(m, 0.06, 0.28, 0.02, P.woodDk); m.box([0.3, 0, 0], [0.09, 0.08, 0.17], trim2(t)); });
    if (p.hit) puff(m, h.pt([0.48, 0.05, 0.1]), 0.07, 0.3, P.dust, 2);
  },
};

/** Sodbuster: a homesteader with a hay fork twice his height. Braces it against a charge. */
export const pikeman: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, th = thrust(p, 0.34), brace = p.is("cast");
    const hand = brace ? p.mix<V3>([0.12, 0.2, 0.38], [0.06, 0.16, 0.22], { castWind: [0.1, 0.2, 0.42] }) : th.hand;
    const aim = brace ? norm(p.mix<V3>([1, 0, 0.35], [1, -0.05, 0.42], { castWind: [1, 0, 0.3] })) : th.aim;
    const h = poke(m, p, { weight: "mid", bulk: 1.05, handR: hand, handL: [hand[0] + aim[0] * 0.26, hand[1] - 0.16, hand[2] + aim[2] * 0.26 + 0.01], torso: P.team, arms: P.team, legs: P.denim, boots: P.hideDk, lunge: brace ? -0.5 : 0.9 });
    braces(m, h, P.denim, 1.05);
    m.at(h.chest, () => m.decal(0.03, () => { m.box([0.135, 0, 0.0], [0.03, 0.17, 0.15], P.denim); for (const s of [1, -1]) m.sphere([0.155, s * 0.06, 0.06], 0.016, trim2(t), { segs: 5 }); }));
    m.at(h.head, () => {
      strawHat(m, 0.19, P.team, 1.8);
      m.tube([[0.17, 0.04, -0.07], [0.27, 0.07, -0.05 + 0.01 * p.wave(1)]], 0.008, P.straw, { segs: 4 }); // a straw in the teeth
      halo(m, p, 0.42);
    });
    m.at(h.aim("R", aim), () => {
      const L = 0.84 + 0.04 * t;
      shaft(m, 0.22, L, 0.017, P.woodLt);
      m.box([L, 0, 0], [0.03, 0.2, 0.03], t >= 3 ? trim(t) : P.ironDk);
      m.group(() => { for (const y of [-0.09, 0, 0.09]) m.cone([L, y, 0], [L + 0.2, y * 1.1, 0.012], 0.016, t >= 4 ? P.glory : P.steel, { segs: 5 }); });
      if (t >= 2) m.decal(0.01, () => m.extrude([[L - 0.1, -0.01], [L - 0.1, -0.13], [L - 0.22, -0.09], [L - 0.2, -0.01]], 0.01, P.team));
      if (p.hit) flash(m, [L + 0.2, 0, 0], 0.05, P.slash, P.slash);
    });
  },
};

/** Wrangler: a big cowhand in woolly chaps, a loop always turning over his hat. Ropes the back line into the front. */
export const hook: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, rope = t >= 4 ? P.gloryFlat : P.rawhide;
    const R0: V3 = [0.08, 0.22, 0.66];
    const R = p.mix<V3>(R0, [0.36, 0.1, 0.5], { wind: [-0.12, 0.26, 0.72], cast: [0.38, 0.08, 0.52], castWind: [-0.12, 0.26, 0.74] });
    const h = poke(m, p, { weight: "heavy", bulk: 1.26, size: 1.09, handR: R, handL: [0.12, -0.26, 0.3], swingL: 0.6, twist: 26, lunge: 0.5, torso: P.team, arms: P.team, legs: P.fur, boots: P.hideDk, hands: P.hide });
    // woolly chaps: tufts down the legs
    m.at(h.hips, () => { m.group(() => { for (const s of [1, -1]) for (const z of [-0.02, -0.1]) m.sphere([0.03, s * 0.13, z], 0.085, P.fur, { segs: 7 }); }); m.decal(0.02, () => m.torus([0, 0, 0.08], [0.1, 0, 1], 0.2, 0.03, P.hideDk, { segs: 12 })); m.decal(0.035, () => m.box([0.2, 0, 0.08], [0.02, 0.08, 0.06], trim2(t))); });
    m.at(h.chest, () => { m.decal(0.015, () => m.group(() => { for (const s of [1, -1]) m.ellipsoid([0.02, s * 0.12, 0.0], [0.15, 0.09, 0.17], P.hideDk, { segs: 8 }); })); neckerchief(m, P.canvas, 1.26); });
    m.at(h.head, () => { stetson(m, 0.19, t >= 3 ? P.hideLt : P.hide, P.team, { brim: 1.6, h: 1.1 }); moustache(m, 0.19, P.hair, 0.6); halo(m, p, 0.54); });
    // the coil on the hip and the loop
    m.at(h.hips, () => m.torus([0, -0.2, 0.0], [0, 1, 0.2], 0.085, 0.022, P.rawhide, { segs: 10 }));
    const out = Math.max(0, Math.min(1.1, p.blend)), far = p.is("cast") ? 0.95 : 0.62;
    const c = h.pt(lerp3([R[0] - 0.02, R[1] - 0.06, R[2] + 0.24], [far, 0, 0.36], out));
    const spin = p.i * 1.3, axis = norm(lerp3([0.16 * Math.cos(spin), 0.16 * Math.sin(spin), 1], [0.5, 0, 1], out));
    m.group(() => {
      m.torus(c, axis, 0.2 - 0.04 * out, 0.017, rope, { segs: 16 });
      m.tube([h.pR, lerp3(h.pR, c, 0.5), [c[0] - 0.16 * (1 - out) * Math.cos(spin) - 0.14 * out, c[1] - 0.16 * (1 - out) * Math.sin(spin), c[2]]], 0.012, rope, { segs: 4 });
    });
    if (p.hit) puff(m, h.pt([far, 0, 0.1]), 0.07, 0.3, P.dust, 1);
  },
};

// ------------------------------------------------------------------------------------------------ casters
/** Rainmaker: a showman in a copper skullcap who flies a kite on a wire in clear weather, and lightning comes. */
export const storm: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.06, 0.24, 0.56], [0.0, 0.24, 0.72], { wind: [0.1, 0.24, 0.42] });
    const L = p.mix<V3>([0.16, -0.2, 0.4], [0.4, -0.06, 0.56], { wind: [0.0, -0.26, 0.66] });
    const h = poke(m, p, { weight: "mid", handR: R, handL: L, lunge: 0.3, torso: P.team, arms: P.team, hands: P.black, legs: P.wool });
    skirt(m, h, P.team, 0.14, 0.22);
    m.at(h.chest, () => { m.decal(0.02, () => m.torus([0, 0, -0.07], [0, 0, 1], 0.188, 0.028, P.hideDk, { segs: 12 })); for (const s of [1, -1]) m.cylinder([-0.13, s * 0.07, -0.1], [-0.13, s * 0.07, 0.08], 0.05, P.glass, 0.05, { segs: 8 }); });
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([-0.02, 0, 0.0], [0.215, 0.225, 0.14], P.hairGrey); m.ellipsoid([0, 0, 0.08], [0.17, 0.17, 0.13], t >= 3 ? P.brass : P.copper); });
      m.cylinder([0, 0, 0.18], [0, 0, 0.36 + 0.02 * t], 0.014, P.iron, 0.01, { segs: 5 });
      m.sphere([0, 0, 0.38 + 0.02 * t], 0.035, core(t, P.brass), { segs: 6 });
      moustache(m, 0.19, P.hairGrey, 0.3);
    });
    if (p.is("death") && p.i > 1) return;
    // the kite: a team-coloured diamond high on its wire, a tail of bows
    const K: V3 = [-0.16 + 0.03 * p.wave(1), 0.26 + 0.03 * p.wave(1, 1, 0.25), 1.18 + 0.03 * t + 0.02 * p.wave(1, 1, 0.5)];
    const kp = (dy: number, dz: number): V3 => h.pt([K[0] - dz * 0.35, K[1] + dy, K[2] + dz]);
    m.tube([h.pR, lerp3(h.pR, kp(0, -0.06), 0.5), kp(0, -0.06)], 0.006, P.iron, { segs: 4 });
    m.poly([kp(0, 0.17), kp(0.12, 0.03), kp(0, -0.16), kp(-0.12, 0.03)], P.team);
    m.decal(0.01, () => m.group(() => { m.tube([kp(0, 0.17), kp(0, -0.16)], 0.008, P.woodDk, { segs: 4 }); m.tube([kp(0.12, 0.03), kp(-0.12, 0.03)], 0.008, P.woodDk, { segs: 4 }); }));
    m.group(() => { for (let i = 1; i <= 3; i++) m.sphere(kp(0.03 * Math.sin(p.t * 6.28 + i), -0.16 - 0.08 * i), 0.022, i % 2 ? P.white : P.teamDk, { segs: 5 }); });
    if (t >= 4) m.sphere(kp(0, 0.03), 0.04, P.glory, { segs: 6 });
    arcBolt(m, kp(0, 0.17), kp(0.14 * Math.cos(p.i * 2.3), 0.3 + 0.06 * Math.sin(p.i * 2.3)), 0.012, p.i + 1);
    if (p.blend < -0.3 || p.hit) arcBolt(m, kp(0, -0.06), h.pR, 0.016, p.i + 4);
    if (p.blend < -0.3) arcBolt(m, h.pR, h.pL, 0.014, p.i + 2);
    if (p.hit) { arcBolt(m, h.pL, h.pt([0.8, 0, 0.5]), 0.024, 7); arcBolt(m, kp(0, 0), h.pt([0.8, 0, 0.5]), 0.016, 9); m.sphere(h.pt([0.8, 0, 0.5]), 0.07, P.arcCore, { segs: 8 }); }
  },
};

/** Frostbite: a mountain trapper in pale furs with a block of high-country ice on his back. What he throws, slows. */
export const rime: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, COAT = mat("#bcd9ea");
    const R = p.mix<V3>([0.14, 0.2, 0.38], [0.4, 0.1, 0.5], { wind: [-0.06, 0.24, 0.6] });
    const L = p.mix<V3>([0.14, -0.2, 0.38], [0.36, -0.12, 0.44], { wind: [0.02, -0.24, 0.5] });
    const h = poke(m, p, { weight: "mid", handR: R, handL: L, lunge: 0.3, twist: 14, torso: COAT, arms: P.team, hands: P.fur, legs: P.team, boots: P.fur });
    skirt(m, h, COAT, 0.1, 0.21);
    m.at(h.hips, () => m.decal(0.008, () => m.torus([-0.015, 0, -0.085], [0, 0, 1], 0.208, 0.035, P.fur, { segs: 12 })));
    m.at(h.chest, () => { m.torus([0, 0, 0.17], [0, 0, 1], 0.13, 0.06, P.team, { segs: 10 }); m.capsule([-0.1, 0.08, 0.14], [-0.2, 0.1 + 0.02 * p.wave(1), -0.08], 0.045, P.team, 0.035, { segs: 6 }); });
    m.at(h.back, () => {
      m.move(0.07, 0, -0.08);
      m.group(() => { for (const y of [-0.1, 0.1]) m.box([0, y, 0.1], [0.03, 0.03, 0.34], P.woodDk); m.box([0, 0, -0.06], [0.14, 0.24, 0.03], P.woodDk); });
      m.box([0.02, 0, 0.1], [0.15, 0.17, 0.26 + 0.02 * t], t >= 4 ? P.glory : P.ice);
      if (t >= 2) m.decal(0.01, () => m.torus([0.02, 0, 0.1], [0, 0, 1], 0.125, 0.012, P.rawhide, { segs: 4 }));
    });
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([-0.02, 0, 0.09], [0.215, 0.22, 0.16], P.fur); m.capsule([-0.19, 0, 0.06], [-0.3, 0.03 * p.wave(1), -0.16], 0.055, P.furDk, 0.035, { segs: 6 }); });
      m.decal(0.01, () => m.torus([0.0, 0, 0.03], [0.1, 0, 1], 0.2, 0.04, P.furDk, { segs: 12 }));
      if (t >= 3) m.decal(0.02, () => m.sphere([0.19, 0, 0.1], 0.03, trim(t), { segs: 6 }));
      beard(m, 0.19, P.hairGrey, 0.5);
      halo(m, p, 0.44);
    });
    // an icicle in the throwing hand; on the blow, a fan of shards
    if (!p.after) m.at(h.aim("R", norm(p.mix<V3>([0.4, 0, 1], [1, 0, 0], { wind: [-0.4, 0, 1] }))), () => m.cone([-0.04, 0, 0], [0.2, 0, 0], 0.035, P.ice, { segs: 5 }));
    else {
      const k = p.hit ? 1 : 0.6;
      m.group(() => { for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32; m.cone(h.pt([0.5 + 0.06 * i * (1 - k), Math.sin(a) * 0.1, 0.48 + 0.03 * Math.cos(i * 2)]), h.pt([0.5 + 0.34 * k * Math.cos(a) + 0.1 * (1 - k), Math.sin(a) * 0.5 * k, 0.46 + 0.05 * Math.cos(i * 2)]), 0.03, P.frost, { segs: 5 }); } });
      m.sphere(h.pt([0.5, 0, 0.48]), 0.06 * k, P.arcCore, { segs: 6 });
    }
    wisp(m, p, h.pt([-0.2, 0, 0.76]), 0.04, P.frost, 0.3);
  },
};

/** Cholla: a seed-sower with a saguaro growing out of her pack. Where she casts her seed, the ground turns to thorns. */
export const thorn: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.14, 0.22, 0.34], [0.4, 0.1, 0.44], { wind: [-0.1, 0.26, 0.32] });
    const h = poke(m, p, { weight: "mid", bulk: 0.95, handR: R, handL: [0.12, -0.2, 0.34], swingL: 0.3, lunge: 0.3, twist: 20, torso: P.canvas, arms: P.canvas, hands: P.hide, legs: P.hideDk, skin: P.skinTan });
    serape(m, h, P.team, P.cactusDk, 0.92, 0.19);
    skirt(m, h, P.hide, 0.12, 0.21);
    m.at(h.back, () => {
      m.move(0.06, 0, -0.1);
      m.cylinder([0, 0, -0.04], [0, 0, 0.1], 0.1, P.rock, 0.125, { segs: 10 });
      m.decal(0.01, () => m.cylinder([0, 0, 0.06], [0, 0, 0.1], 0.122, trim2(t), 0.128, { segs: 10 }));
      m.with(() => { m.move(0, 0, 0.08); saguaro(m, 0.56 + 0.05 * t, 0.07, t >= 2 ? 2 : 1, P.cactus, t >= 4 ? P.glory : P.bloom); });
    });
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([-0.03, 0, 0.05], [0.205, 0.21, 0.17], P.team); m.capsule([-0.16, -0.06, -0.02], [-0.22, -0.1, -0.28], 0.05, P.black, 0.03, { segs: 6 }); });
      m.decal(0.01, () => m.torus([0.0, 0, 0.07], [0.25, 0, 1], 0.2, 0.022, P.teamDk, { segs: 12 }));
      if (t >= 3) m.sphere([0.08, 0.14, 0.14], 0.05, P.bloom, { segs: 6 });
    });
    // a seed pouch on the off hip, a spiny pod in the hand; on the blow the pods fly
    m.at(h.hips, () => m.ellipsoid([0.04, -0.19, 0.02], [0.09, 0.06, 0.09], P.burlap));
    if (!p.after) m.group(() => { m.sphere(h.pR, 0.055, P.cactusDk, { segs: 6 }); m.sphere([h.pR[0], h.pR[1], h.pR[2] + 0.05], 0.022, P.bloom, { segs: 5 }); });
    else m.group(() => { const k = p.hit ? 0.5 : 1; for (let i = 0; i < 4; i++) m.sphere(h.pt([0.5 + 0.2 * k + i * 0.08 * k, (i - 1.5) * 0.12 * k, 0.4 - 0.1 * k + 0.05 * Math.cos(i * 2)]), 0.035, P.cactusDk, { segs: 6 }); });
  },
};

// ------------------------------------------------------------------------------------------------ support
/** Sawbones: a frontier doctor. White coat, black bag, and a bottle of tonic that mends whoever it mists. */
export const medic: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.18, 0.4], [0.34, 0.1, 0.52], { wind: [0.06, 0.22, 0.5], cast: [0.3, 0.1, 0.7], castWind: [0.04, 0.22, 0.44] });
    const h = poke(m, p, { weight: "mid", bulk: 0.95, handR: R, handL: [0.06, -0.25, 0.27], swingL: 0.5, lunge: 0.2, torso: P.white, arms: P.team, legs: P.team, boots: P.black });
    skirt(m, h, P.white, 0.15, 0.215);
    m.at(h.chest, () => {
      m.decal(0.02, () => { m.ellipsoid([0.11, 0, 0.03], [0.05, 0.075, 0.13], P.team); for (const z of [0.08, 0.02, -0.04]) m.sphere([0.155, 0, z], 0.014, trim2(t), { segs: 5 }); });
      m.decal(0.03, () => m.group(() => { m.box([0.13, 0.11, 0.06], [0.02, 0.07, 0.022], P.red); m.box([0.13, 0.11, 0.06], [0.02, 0.022, 0.07], P.red); }));
    });
    m.at(h.head, () => {
      derby(m, 0.19, P.white, P.team);
      m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) m.torus([0.175, s * 0.07, 0.02], [1, 0, 0], 0.04, 0.009, trim2(t), { segs: 8 }); }));
      moustache(m, 0.19, P.hairGrey, 0.3);
      halo(m, p, 0.44);
    });
    // the black bag
    m.with(() => { m.move(h.pL[0], h.pL[1], h.pL[2] - 0.11 * h.size); m.group(() => { m.box([0, 0, 0], [0.17, 0.09, 0.11], P.black); m.cylinder([-0.085, 0, 0.055], [0.085, 0, 0.055], 0.045, P.black, 0.045, { segs: 6 }); }); m.decal(0.02, () => m.box([0, -0.047, 0.03], [0.05, 0.01, 0.03], trim2(t))); });
    const aim = norm(p.mix<V3>([0.3, 0, 1], [1, 0, 0.3], { cast: [0.5, 0, 1] }));
    m.at(h.aim("R", aim), () => {
      m.group(() => { m.cylinder([-0.05, 0, 0], [0.11, 0, 0], 0.05, t >= 4 ? P.glory : P.bottle, 0.05, { segs: 8 }); m.cylinder([0.11, 0, 0], [0.19, 0, 0], 0.022, t >= 4 ? P.glory : P.bottle, 0.02, { segs: 6 }); });
      m.decal(0.01, () => m.cylinder([-0.02, 0, 0], [0.07, 0, 0], 0.052, P.canvas, 0.052, { segs: 8 }));
      if (!p.after) m.cylinder([0.19, 0, 0], [0.22, 0, 0], 0.024, P.woodLt, 0.024, { segs: 6 });
      else puff(m, [0.32 + (p.hit ? 0 : 0.08), 0, 0], 0.1, p.hit ? 0.3 : 0.8, P.mist, 2);
    });
  },
};

/** Bugler: the troop's guidon on a tall staff. Everyone near steps quicker. */
export const banner: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.2, 0.34], [0.3, 0.14, 0.4], { wind: [0.1, 0.22, 0.4], cast: [0.14, 0.2, 0.56], castWind: [0.16, 0.2, 0.3] });
    const L = p.mix<V3>([0.08, -0.24, 0.32], [0.1, -0.24, 0.34], { cast: [0.2, -0.1, 0.62], castWind: [0.12, -0.2, 0.4] });
    const tilt = p.mix(0, 38, { wind: -10, cast: -4, castWind: 8 });
    const h = poke(m, p, { weight: "mid", handR: R, handL: L, swingL: 0.5, lunge: 0.5, torso: P.team, arms: P.team, legs: P.denim, boots: P.black, hands: P.rawhide });
    m.at(h.chest, () => { m.decal(0.02, () => { for (const z of [0.1, 0.04, -0.02]) for (const s of [1, -1]) m.sphere([0.14, s * 0.045, z], 0.016, GOLD, { segs: 5 }); m.torus([0, 0, -0.08], [0, 0, 1], 0.185, 0.028, P.black, { segs: 12 }); }); neckerchief(m, P.straw); for (const s of [1, -1]) if (t >= 2) m.ellipsoid([-0.01, s * 0.18, 0.135], [0.065, 0.07, 0.04], trim(t)); });
    m.at(h.head, () => { kepi(m, 0.19, P.team, GOLD); if (t >= 3) m.capsule([0.06, 0, 0.26], [0.04, 0, 0.42], 0.03, P.straw, 0.045, { segs: 6 }); moustache(m, 0.19); });
    // the bugle in the off hand
    m.at(frameAt(h.pL, h.dir(p.is("cast") ? [0.6, 0.2, 0.7] : [1, 0, 0.2])), () => m.group(() => { m.tube([[-0.03, 0, 0], [0.12, 0, 0]], 0.014, P.brass, { segs: 5 }); m.cone([0.2, 0, 0], [0.1, 0, 0], 0.055, P.brass, { segs: 8 }); m.torus([0.03, 0, -0.03], [0, 1, 0], 0.035, 0.012, P.brass, { segs: 8 }); }));
    m.at(frameAt(h.pR, h.dir(up(tilt)), h.dir([-1, 0, 0])), () => {
      // +x runs up the staff; the guidon streams along local z (backwards)
      const L = 0.88 + 0.05 * t;
      shaft(m, 0.34, L, 0.02, t >= 2 ? P.woodLt : P.wood);
      m.cone([L, 0, 0], [L + 0.1, 0, 0], 0.035, t >= 4 ? P.glory : trim2(t), { segs: 6 });
      const w = (k: number) => 0.03 * Math.sin(p.t * Math.PI * 2 + k * 2.4) * k;
      const fl = 0.36 + 0.03 * t;
      m.poly([[L - 0.02, 0, 0.02], [L - 0.02, w(0.5), 0.02 + fl * 0.5], [L - 0.04, w(1), 0.02 + fl], [L - 0.17, w(0.8), 0.02 + fl * 0.7], [L - 0.3, w(1), 0.02 + fl], [L - 0.32, w(0.5), 0.02 + fl * 0.5], [L - 0.32, 0, 0.02]], P.team);
      m.decal(0.015, () => m.poly([[L - 0.02, 0.002, 0.03], [L - 0.02, w(0.6) + 0.002, 0.02 + fl * 0.62], [L - 0.17, w(0.6) + 0.002, 0.02 + fl * 0.56], [L - 0.17, 0.002, 0.03]], t >= 3 ? GOLD : P.white));
    });
    if (p.is("cast") && p.after) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + p.i * 0.5; m.sphere(h.pt([0.34 * Math.cos(a), 0.34 * Math.sin(a), 0.12]), 0.03, P.lamp, { segs: 6 }); }
  },
};

/** Switchman: a railroad signalman with his lantern on a long pole. Its light shields friends. */
export const lamp: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.2, 0.34], [0.3, 0.14, 0.42], { wind: [0.04, 0.22, 0.5], cast: [0.16, 0.2, 0.62], castWind: [0.14, 0.2, 0.3] });
    const tilt = p.mix(14, 62, { wind: -12, cast: 0, castWind: 20 });
    const h = poke(m, p, { weight: "mid", bulk: 0.98, handR: R, lunge: 0.4, torso: P.team, arms: P.team, legs: P.denimDk, boots: P.black, hands: P.hide });
    braces(m, h, P.denimDk, 0.98);
    m.at(h.chest, () => { m.decal(0.03, () => m.box([0.132, 0, -0.01], [0.03, 0.16, 0.15], P.denimDk)); neckerchief(m, P.red); });
    m.at(h.head, () => {
      // a striped engineer's cap
      m.with(() => { m.move(-0.01, 0, 0.1); m.group(() => { m.cylinder([0, 0, 0], [0, 0, 0.13], 0.185, P.white, 0.2, { segs: 12 }); m.ellipsoid([0.16, 0, 0.0], [0.1, 0.12, 0.02], P.denimDk); }); m.decal(0.005, () => m.group(() => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; m.box([Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.065], [0.03, 0.03, 0.125], P.denim); } })); m.cylinder([0, 0, 0.13], [0, 0, 0.14], 0.2, P.denim, 0.2, { segs: 12 }); });
      moustache(m, 0.19, P.hairGrey, 0.4);
      halo(m, p, 0.4);
    });
    m.at(frameAt(h.pR, h.dir(up(tilt)), h.dir([-1, 0, 0])), () => {
      const L = 0.72 + 0.05 * t, lit = t >= 4 ? P.glory : P.lamp;
      shaft(m, 0.3, L, 0.016, P.woodDk);
      m.tube([[L, 0, 0], [L + 0.06, 0, -0.03], [L + 0.07, 0, -0.1]], 0.012, P.ironDk, { segs: 5 });
      m.with(() => {
        m.move(L + 0.07, 0, -0.1).rotY(90 - tilt);
        const s = 0.085 + 0.008 * t;
        m.group(() => { m.cylinder([0, 0, 0], [0, 0, -s * 0.3], s * 0.45, trim2(t), s * 0.62, { segs: 8 }); m.cylinder([0, 0, -s * 1.35], [0, 0, -s * 1.6], s * 0.62, trim2(t), s * 0.5, { segs: 8 }); m.torus([0, 0, 0.05], [0, 1, 0], 0.045, 0.008, P.ironDk, { segs: 8 }); });
        m.cylinder([0, 0, -s * 0.3], [0, 0, -s * 1.35], s * 0.52, lit, s * 0.52, { segs: 8 });
        m.decal(0.01, () => m.cylinder([0, 0, -s * 0.72], [0, 0, -s * 0.95], s * 0.54, P.red, s * 0.54, { segs: 8 }));
      });
    });
    if (p.is("cast") && p.after) m.torus(h.pt([0.16, 0.2, 0.95]), [0, 0, 1], p.hit ? 0.2 : 0.32, 0.02, P.lamp, { segs: 14 });
  },
};

// ------------------------------------------------------------------------------------------------ diggers and builders
/** Prospector: a bearded miner with a pick, a pan and a candle on his hat. Goes under the line, not through it. */
export const sapper: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const h = poke(m, p, { weight: "mid", bulk: 1.05, handR: c.hand, handL: p.mix<V3>([0.16, -0.16, 0.34], [0.24, -0.1, 0.3], { wind: [0.02, -0.1, 0.56] }), twist: 24, torso: P.team, arms: P.team, legs: P.wool, hands: P.hideDk });
    braces(m, h, P.hideDk, 1.05);
    m.at(h.back, () => {
      m.move(0.03, 0, -0.03);
      m.with(() => { m.rotY(90); m.cylinder([0, 0, 0], [0, 0, 0.04], 0.15, t >= 3 ? trim(t) : P.tin, 0.19, { segs: 12 }); });
      m.capsule([0.06, -0.14, 0.18], [0.06, 0.14, 0.18], 0.06, P.burlap, 0.06, { segs: 8 });
    });
    m.at(h.head, () => {
      stetson(m, 0.19, P.felt, P.team, { brim: 1.45, h: 0.8, tilt: -2 });
      m.with(() => { m.move(0.16, 0, 0.2); m.cylinder([0, 0, 0], [0, 0, 0.07], 0.022, P.white, 0.022, { segs: 5 }); m.sphere([0, 0, 0.1], 0.034, p.is("death") && p.i > 2 ? P.feltDk : core(t, P.lamp), { segs: 6 }); });
      beard(m, 0.19, P.hairGrey, 1.1);
      halo(m, p, 0.48);
    });
    m.at(h.aim("R", c.aim), () => {
      shaft(m, 0.08, 0.34, 0.019, P.woodDk);
      m.tube([[0.3, 0, 0.17], [0.34, 0, 0.06], [0.35, 0, 0], [0.34, 0, -0.06], [0.3, 0, -0.17]], [0.008, 0.022, 0.028, 0.022, 0.008], t >= 4 ? P.glory : trim2(t), { segs: 5 });
    });
    if (p.hit) { puff(m, h.pt([0.46, 0.02, 0.06]), 0.08, 0.3, P.dust, 2); m.group(() => { for (let i = 0; i < 3; i++) m.sphere(h.pt([0.44 + i * 0.07, (i - 1) * 0.1, 0.16 + 0.05 * i]), 0.028, P.rockDk, { segs: 5 }); }); }
  },
};

/** Gunsmith: an apron, a hammer as long as her arm, and a crate of barrels. Bolts Gatlings together; mends machines. */
export const tinker: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), build = p.is("cast");
    const hand = build ? p.mix<V3>([0.14, 0.2, 0.38], [0.34, 0.1, 0.16], { castWind: [0.0, 0.24, 0.66] }) : c.hand;
    const aim = build ? norm(p.mix<V3>([0.45, 0.1, 1], [1, 0, -0.7], { castWind: [-0.4, 0.1, 1] })) : c.aim;
    const h = poke(m, p, { weight: "mid", bulk: 0.98, handR: hand, twist: 20, torso: P.team, arms: P.team, legs: P.wool, hands: P.hideDk });
    m.at(h.chest, () => m.decal(0.02, () => { m.ellipsoid([0.09, 0, -0.04], [0.075, 0.13, 0.16], P.hide); m.torus([0, 0, -0.07], [0, 0, 1], 0.185, 0.026, P.hideDk, { segs: 12 }); }));
    skirt(m, h, P.hide, 0.12, 0.2);
    m.at(h.back, () => {
      m.move(0.05, 0, -0.08);
      m.box([0, 0, 0.1], [0.14, 0.26, 0.22], P.woodLt);
      m.decal(0.01, () => m.box([-0.072, 0, 0.1], [0.01, 0.2, 0.08], P.team));
      m.group(() => { for (const [y, a] of [[-0.07, -8], [0.0, 4], [0.08, 12]].slice(0, Math.min(3, t + 1))) m.with(() => { m.move(0, y, 0.2).rotX(a); m.cylinder([0, 0, 0], [0, 0, 0.2 + 0.02 * t], 0.022, P.ironDk, 0.02, { segs: 6 }); }); });
      if (t >= 3) m.with(() => { m.move(0.08, -0.1, 0.1).rotZ(90); m.torus([0, 0, 0], [0, 1, 0], 0.06, 0.014, trim(t), { segs: 8 }); });
    });
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([-0.03, 0, 0.06], [0.205, 0.205, 0.165], P.hairRed); m.sphere([-0.2, 0, 0.12], 0.075, P.hairRed, { segs: 7 }); });
      m.decal(0.012, () => m.torus([0.02, 0, 0.09], [0.3, 0, 1], 0.19, 0.03, P.team, { segs: 12 }));
      m.decal(0.02, () => m.extrude([[0.14, 0.05], [0.27, 0.0], [0.27, 0.02], [0.14, 0.09]], 0.22, mat("#3d8a5c", { alpha: 0.9 })));  // a green eyeshade
      halo(m, p, 0.42);
    });
    m.at(h.aim("R", aim), () => { shaft(m, 0.07, 0.3, 0.018, P.woodDk); m.box([0.31, 0, 0], [0.08, 0.07, 0.17], trim2(t)); if (t >= 4) m.sphere([0.31, 0, 0], 0.04, P.glory, { segs: 6 }); });
    if (p.hit) m.at(frameAt(h.pt(build ? [0.5, 0.1, 0.1] : [0.46, 0.04, 0.3])), () => flash(m, [0, 0, 0], 0.05, P.spark, P.fireHot));
  },
};

/** Nitro Kid: a boy sprinting flat out with a red powder keg over his head and the fuse already lit. */
export const keg: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.04, 0.17, 0.76], [0.4, 0.15, 0.36], { wind: [-0.02, 0.17, 0.78] });
    const L = p.mix<V3>([0.04, -0.17, 0.76], [0.4, -0.15, 0.36], { wind: [-0.02, -0.17, 0.78] });
    const h = poke(m, p, { weight: "light", size: 0.9, bulk: 0.95, handR: R, handL: L, lean: 22, lunge: 1.2, torso: P.team, arms: P.canvas, legs: P.wool, hands: P.skin });
    braces(m, h, P.hideDk, 0.95);
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([-0.02, 0, 0.08], [0.2, 0.205, 0.12], P.team); m.ellipsoid([0.15, 0, 0.04], [0.11, 0.14, 0.03], P.teamDk); });
      m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) m.sphere([0.15, s * 0.1, -0.06], 0.018, P.hairRed, { segs: 4 }); }));
    });
    if (p.after) return void puff(m, h.pt([0.4, 0, 0.3]), 0.16, p.hit ? 0.2 : 0.7, P.smokeDk, 3);
    // the keg rides on his head, lying across; it comes down in front of him for the blow
    const at = h.pt(p.mix<V3>([0.03, 0, 0.93], [0.42, 0, 0.36], { wind: [-0.03, 0, 0.99] }));
    m.at(frameAt(at, h.dir([0, 1, 0])), () => {
      const r = 0.16 + 0.008 * t, len = 0.38 + 0.01 * t, hoop = t >= 3 ? trim(t) : P.ironDk;
      m.group(() => { m.cylinder([-len / 2, 0, 0], [0, 0, 0], r * 0.8, P.wood, r, { segs: 12 }); m.cylinder([0, 0, 0], [len / 2, 0, 0], r, P.wood, r * 0.8, { segs: 12 }); });
      for (const x of [-len * 0.36, len * 0.36]) m.torus([x, 0, 0], [1, 0, 0], r * 0.86, r * 0.09, hoop, { segs: 14 });
      m.torus([0, 0, 0], [1, 0, 0], r * 0.98, r * 0.16, P.team, { segs: 14 });
      m.decal(0.02, () => { for (const s of [1, -1]) m.cylinder([s * len / 2 - 0.004, 0, 0], [s * len / 2 + 0.004, 0, 0], r * 0.6, P.red, r * 0.6, { segs: 10 }); });
      m.tube([[0, 0, r * 0.95], [0.02, 0.02, r + 0.05], [0.05, 0, r + 0.08]], 0.009, P.feltDk, { segs: 4 });
      m.sphere([0.05, 0, r + 0.09], 0.03 + 0.012 * (p.i % 2), t >= 4 ? P.gloryInk : P.fire, { segs: 6 });
      m.decal(0.03, () => m.sphere([0.05, 0, r + 0.09], 0.015, P.spark, { segs: 5 }));
    });
  },
};

// ------------------------------------------------------------------------------------------------ show folk and the dead
/** The Huckster and his Dummy: a medicine-show barker in a striped stovepipe and a cape. `fake` is the burlap copy. */
function barker(m: Model, p: Pose, fake: boolean) {
  const t = fake ? 1 : p.tier, th = thrust(p, 0.34), show = p.is("cast");
  const hand = show ? p.mix<V3>([0.12, 0.2, 0.38], [0.14, 0.3, 0.74], { castWind: [0.2, 0.12, 0.34] }) : th.hand;
  const aim = show ? norm(p.mix<V3>([1, 0, 0.35], [0.2, 0.4, 1], { castWind: [1, 0, 0] })) : th.aim;
  const L = show ? p.mix<V3>([0.06, -0.24, 0.32], [0.14, -0.3, 0.74], { castWind: [0.2, -0.12, 0.34] }) : p.mix<V3>([0.06, -0.24, 0.32], [-0.06, -0.26, 0.4]);
  const body = fake ? P.burlap : P.team, cape = fake ? P.canvasDk : P.teamDk;
  const h = poke(m, p, { weight: "light", bulk: 0.92, handR: hand, handL: L, lunge: show ? 0 : 0.8, skin: fake ? P.burlap : P.skin, torso: body, arms: fake ? P.burlap : P.white, legs: fake ? P.burlap : P.black, boots: fake ? P.strawDk : P.black, hands: fake ? P.straw : P.white, noFace: fake });
  m.at(h.chest, () => {
    if (!fake) m.decal(0.02, () => { m.ellipsoid([0.11, 0, 0.03], [0.05, 0.07, 0.12], P.white); m.box([0.15, 0, 0.14], [0.02, 0.11, 0.04], P.red); for (const z of [0.06, 0]) m.sphere([0.155, 0, z], 0.015, trim2(t), { segs: 5 }); });
    else { m.decal(0.02, () => m.group(() => { m.box([0.14, 0.03, 0.02], [0.02, 0.09, 0.012], P.feltDk); m.box([0.14, 0.03, 0.02], [0.02, 0.012, 0.09], P.feltDk); })); m.torus([0, 0, 0.17], [0, 0, 1], 0.1, 0.035, P.straw, { segs: 8 }); }
    const sw = 0.03 * p.wave(1, 1);
    m.extrude([[-0.02, 0.17], [-0.2, 0.1], [-0.27 - sw, fake ? -0.14 : -0.24], [-0.19, fake ? -0.08 : -0.24], [-0.08, fake ? -0.16 : -0.24]], 0.32, cape);
    if (!fake && t >= 3) m.decal(0.012, () => m.extrude([[-0.22, -0.2], [-0.27 - sw, -0.24], [-0.08, -0.24], [-0.1, -0.2]], 0.33, GOLD));
  });
  if (fake) {
    // a scarecrow: the stake it stands on, straw at the cuffs
    m.at(h.hips, () => m.cylinder([-0.04, 0, 0.2], [-0.04, 0, -0.24], 0.022, P.woodDk, 0.022, { segs: 5 }));
    for (const ph of [h.pR, h.pL]) m.group(() => { for (let i = 0; i < 3; i++) m.cone(ph, [ph[0] + 0.06 * Math.cos(i * 2.1), ph[1] + 0.06 * Math.sin(i * 2.1), ph[2] - 0.07], 0.02, P.straw, { segs: 4 }); });
  }
  m.at(h.head, () => {
    stovepipe(m, 0.19, 0.34 + 0.025 * t, fake ? P.canvasDk : P.white, fake ? P.feltDk : P.teamDk, fake ? P.wool : P.team);
    if (fake) m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) for (const a of [45, -45]) m.with(() => { m.move(0.175, s * 0.07, 0.02).rotX(a); m.box([0, 0, 0], [0.02, 0.07, 0.014], P.feltDk); }); m.box([0.17, 0, -0.08], [0.02, 0.1, 0.012], P.feltDk); }));
    else { moustache(m, 0.19, P.black, 0.1); m.decal(0.025, () => m.cone([0.17, 0, -0.1], [0.2, 0, -0.2], 0.03, P.black, { segs: 4 })); }
    if (!fake) halo(m, p, 0.62);
  });
  if (!fake || p.is("idle") || p.is("walk")) m.at(h.aim("R", aim), () => { m.cylinder([-0.04, 0, 0], [0.4 + 0.02 * t, 0, 0], 0.014, fake ? P.woodLt : P.black, 0.012, { segs: 6 }); m.sphere([-0.05, 0, 0], 0.03, fake ? P.straw : t >= 4 ? P.glory : GOLD, { segs: 6 }); if (p.hit && !show) flash(m, [0.44, 0, 0], 0.045, P.slash, P.slash); });
  if (!fake && show && p.after) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + p.i; m.at(frameAt(h.pt([0.12 + 0.36 * Math.cos(a), 0.36 * Math.sin(a), 0.6 + 0.2 * Math.sin(a * 2)]), [0, 1, 0]), () => star(m, 0.04, i % 2 ? P.lamp : P.teamLt, 0.02)); }
  if (fake && p.is("death") && p.i >= 2) puff(m, h.pt([0, 0, 0.3]), 0.1, p.dead, P.dust, 2);
}
export const trickster: UnitDef = { weight: "light", cast: true, build: (m, p) => barker(m, p, false) };
export const decoy: UnitDef = { weight: "light", build: (m, p) => barker(m, p, true) };

/** Undertaker: black coat, a stovepipe taller than anyone's, a shovel, and a lantern that burns green. */
export const grave: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), raise = p.is("cast");
    const hand = raise ? p.mix<V3>([0.14, 0.2, 0.38], [0.2, 0.2, 0.3], { castWind: [0.1, 0.22, 0.5] }) : c.hand;
    const aim = raise ? norm(p.mix<V3>([0.45, 0.1, 1], [0.3, 0, -1], { castWind: [0.2, 0, 1] })) : c.aim;
    const L = p.mix<V3>([0.2, -0.18, 0.4], [0.16, -0.22, 0.44], { cast: [0.24, -0.14, 0.78], castWind: [0.2, -0.18, 0.3] });
    const h = poke(m, p, { weight: "mid", bulk: 0.94, size: 1.04, handR: hand, handL: L, twist: raise ? 0 : 18, lunge: raise ? 0 : 0.6, skin: mat("#d9d2c0"), torso: P.black, arms: P.black, legs: P.black, boots: P.black, hands: P.white });
    skirt(m, h, P.black, 0.2, 0.22);
    m.at(h.chest, () => { m.decal(0.02, () => { m.ellipsoid([0.11, 0, 0.03], [0.05, 0.075, 0.13], P.team); m.box([0.15, 0, 0.14], [0.02, 0.1, 0.04], P.teamDk); }); m.extrude([[-0.12, 0.16], [-0.17, 0.02], [-0.2, -0.12], [-0.11, -0.12]], 0.34, P.teamDk); });
    m.at(h.head, () => { stovepipe(m, 0.19, 0.42 + 0.03 * t, P.black, P.team); if (t >= 2) m.decal(0.02, () => m.box([0.15, 0, 0.18], [0.02, 0.06, 0.05], trim(t))); moustache(m, 0.19, P.black, 0.7); halo(m, p, 0.7); });
    m.at(h.aim("R", aim), () => { shaft(m, 0.1, 0.34, 0.018, P.woodDk); m.extrude([[0.33, 0.07], [0.5 + 0.01 * t, 0.05], [0.56 + 0.01 * t, 0], [0.5 + 0.01 * t, -0.05], [0.33, -0.07]], 0.02, trim2(t)); m.box([-0.11, 0, 0], [0.03, 0.09, 0.025], P.woodDk); });
    // the lantern: green, brighter as it rises
    const glow = t >= 4 ? P.glory : P.ghost;
    m.with(() => {
      m.move(h.pL[0], h.pL[1], h.pL[2] - 0.03);
      m.group(() => { m.cylinder([0, 0, 0], [0, 0, -0.03], 0.03, P.ironDk, 0.045, { segs: 6 }); m.cylinder([0, 0, -0.13], [0, 0, -0.16], 0.05, P.ironDk, 0.04, { segs: 6 }); m.torus([0, 0, 0.03], [0, 1, 0], 0.03, 0.007, P.ironDk, { segs: 6 }); });
      m.cylinder([0, 0, -0.03], [0, 0, -0.13], 0.042, p.is("death") && p.i > 2 ? P.feltDk : glow, 0.042, { segs: 8 });
    });
    if (raise && p.after) { m.torus(h.pt([0.3, 0, 0.04]), [0, 0, 1], p.hit ? 0.2 : 0.32, 0.022, P.ghost, { segs: 14 }); for (let i = 0; i < 3; i++) m.cone(h.pt([0.3 + 0.14 * Math.cos(i * 2.1), 0.14 * Math.sin(i * 2.1), 0.04]), h.pt([0.3 + 0.14 * Math.cos(i * 2.1), 0.14 * Math.sin(i * 2.1), p.hit ? 0.3 : 0.44]), 0.03, P.ghost, { segs: 5 }); }
    if (p.hit && !raise) puff(m, h.pt([0.46, 0.04, 0.08]), 0.07, 0.3, P.dust, 2);
  },
};

/** Stiff: what the Undertaker's lantern calls up out of boot hill. Bones, a rag of team colour, a dead man's hat. */
export const thrall: UnitDef = {
  weight: "light",
  build(m, p) {
    const R = p.mix<V3>([0.24, 0.13, 0.44], [0.4, 0.08, 0.42], { wind: [0.06, 0.2, 0.56] });
    const L = p.mix<V3>([0.22, -0.13, 0.4], [0.36, -0.1, 0.36], { wind: [0.12, -0.18, 0.46] });
    const h = humanoid(m, p, { weight: "light", bulk: 0.72, size: 0.96, handR: R, handL: L, swingR: 0.4, swingL: 0.4, lean: 14, skin: P.bone, torso: P.bone, legs: P.boneDk, boots: P.boneDk, arms: P.bone, hands: P.bone, noFace: true });
    m.at(h.chest, () => { m.decal(0.02, () => m.group(() => { for (const z of [0.1, 0.04, -0.02, -0.08]) m.box([0.1, 0, z], [0.03, 0.2 - Math.abs(z - 0.02) * 0.5, 0.018], P.feltDk); })); neckerchief(m, P.team, 0.8); });
    m.at(h.head, () => {
      m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) m.ellipsoid([0.165, s * 0.075, 0.02], [0.03, 0.05, 0.055], p.is("death") && p.i > 2 ? P.feltDk : P.ghostDim, { segs: 6 }); m.box([0.17, 0, -0.09], [0.02, 0.12, 0.03], P.feltDk); }));
      stetson(m, 0.19, P.feltDk, P.team, { brim: 1.2, h: 0.75, tilt: 12 });
    });
    if (p.hit) for (const ph of [h.pR, h.pL]) m.cone(ph, [ph[0] + 0.14, ph[1], ph[2] - 0.03], 0.03, P.slash, { segs: 4 });
  },
};
void bandolier; void gunbelt; void gripAim; void trim; void arcBolt; void sombrero;
