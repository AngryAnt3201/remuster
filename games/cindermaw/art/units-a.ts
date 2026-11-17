// The 9th's kit, as both sides field it: marines on foot. Gunmetal and khaki bodies; the side shows on the visor,
// the helmet stripe, the shoulder plates and one big piece of kit each.
import { gripAim, type UnitDef } from "../../../artkit/rig";
import { norm, type V3 } from "../../../artkit/toon3d";
import { P, R, blade, burst, cape, chop, flash, glint, gun, gunHands, helmet, offHand, pack, pads, pike, poleHand, puff, rank, slab, slashArc, staff, sword, tanks, thrust, trim, trooper, zigzag } from "./parts";

const r = R;

/** Rifleman: a marine with a long rifle held across the body. */
export const ranger: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, g = gunHands(p);
    const h = trooper(m, p, { weight: "light", handR: g.R, handL: g.L, lunge: 0, recoil: 0.04, torso: t >= 2 ? P.iron : P.armor });
    pads(m, h); pack(m, h, P.armorDk, P.team, 0.8);
    m.at(h.head, () => { helmet(m, r, t >= 3 ? P.brass : P.armor); rank(m, p); });
    m.at(gripAim(h.pR, h.pL), () => {
      const L = 0.62 + 0.03 * t;
      gun(m, L, { barrel: blade(t, P.iron) });
      if (p.hit) flash(m, [L, 0, 0.01], 0.07);
    });
  },
};

/** Breacher: a huge trooper behind a slab riot shield in the side's colour. */
export const bulwark: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const L = p.mix<V3>([0.26, -0.03, 0.38], [0.44, 0.0, 0.4], { wind: [0.16, -0.05, 0.38] });
    const Rh = p.mix<V3>([0.02, 0.3, 0.36], [0.24, 0.26, 0.42], { wind: [-0.1, 0.3, 0.5] });
    const h = trooper(m, p, { size: 1.22, bulk: 1.45, weight: "heavy", torso: P.iron, arms: P.ironDk, legs: P.ironDk, boots: P.black, handL: L, handR: Rh, lunge: 0.6 });
    pads(m, h, P.team, 1.35, 1.45);
    m.at(h.head, () => { helmet(m, r, t >= 3 ? P.brass : P.ironDk); if (t >= 2) rank(m, p); });
    m.at(h.aim("L", [1, 0, 0]), () => {
      m.move(0.06, 0.03, 0.0);
      slab(m, 0.66 + 0.02 * t, 0.84 + 0.02 * t, trim(t), P.teamFlat, t >= 4 ? P.glory : P.hazard);
      if (p.hit) glint(m, [0.14, 0, 0], 0.05);
    });
    m.at(h.aim("R", norm(p.mix<V3>([0.3, 0.2, 1], [1, 0, 0.1], { wind: [-0.2, 0.2, 1] }))), () => { m.cylinder([-0.06, 0, 0], [0.3, 0, 0], 0.03, P.black, 0.035, { segs: 6 }); m.cylinder([0.2, 0, 0], [0.32, 0, 0], 0.04, blade(t, P.steel), 0.04, { segs: 6 }); });
  },
};

/** Sawbones: bone-white armour, an injector gun and a cross on the helmet. The cast is the heal. */
export const medic: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, cast = p.is("cast");
    const Rh = p.mix<V3>([0.16, 0.2, 0.4], [0.36, 0.14, 0.46], { wind: [0.08, 0.22, 0.44], cast: [0.2, 0.18, 0.74], castWind: [0.1, 0.22, 0.4] });
    const h = trooper(m, p, { weight: "light", torso: P.white, arms: P.white, legs: P.whiteDk, handR: Rh, handL: offHand(p), lunge: 0, recoil: 0.02 });
    pads(m, h);
    m.at(h.back, () => { m.box([0.07, 0, 0], [0.13, 0.26, 0.3], P.white); m.decal(0.03, () => { m.box([0.14, 0, 0.02], [0.02, 0.2, 0.07], P.heal); m.box([0.14, 0, 0.02], [0.02, 0.07, 0.2], P.heal); }); });
    m.at(h.head, () => {
      helmet(m, r, P.white, { stripe: null });
      m.decal(0.04, () => { m.box([0, 0, r * 1.06], [r * 1.3, r * 0.4, r * 0.2], P.heal); m.box([0, 0, r * 1.06], [r * 0.4, r * 1.3, r * 0.2], P.heal); });
      rank(m, p, r * 1.45);
    });
    m.at(h.aim("R", cast ? [0.3, 0, 1] : [1, 0, 0.05]), () => {
      m.group(() => { m.box([0.08, 0, 0], [0.2, 0.05, 0.07], trim(t)); m.box([0.02, 0, -0.06], [0.05, 0.04, 0.1], P.black); });
      m.cylinder([0.16, 0, 0], [0.3, 0, 0], 0.014, P.steel, 0.006, { segs: 4 });
      m.cylinder([0.0, 0, 0.06], [0.12, 0, 0.06], 0.03, t >= 4 ? P.glory : P.heal, 0.03, { segs: 6 });
      if (p.hit && !cast) flash(m, [0.3, 0, 0], 0.04, P.heal, P.spark);
    });
    if (cast && p.after) { const c = h.pt([0.2, 0.18, 0.95]); burst(m, c, 0.1, P.heal, P.spark, 6); glint(m, [c[0], c[1], c[2] + 0.2], 0.04, P.heal); }
  },
};

/** Pipebomber: a stout marine with a bandolier, a pipe bomb in an overarm throw. */
export const grenadier: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const Rh = p.mix<V3>([0.1, 0.24, 0.6], [0.34, 0.14, 0.72], { wind: [-0.16, 0.26, 0.58] });
    const h = trooper(m, p, { weight: "mid", bulk: 1.25, handR: Rh, handL: [0.16, -0.22, 0.34], twist: 24, lunge: 0.5 });
    pads(m, h, P.team, 1.1, 1.25);
    m.at(h.chest, () => m.decal(0.02, () => { for (let i = 0; i < 4; i++) m.cylinder([0.15, -0.14 + i * 0.09, 0.06 - i * 0.05], [0.15, -0.14 + i * 0.09, -0.04 - i * 0.05], 0.03, i % 2 ? P.rust : P.hazard, 0.03, { segs: 5 }); }));
    m.at(h.head, () => { helmet(m, r, t >= 3 ? P.brass : P.armor, { brim: true }); rank(m, p); });
    if (!p.after) m.at(h.aim("R", [0.2, 0, 1]), () => {
      m.cylinder([0.0, 0, 0], [0.22 + 0.01 * t, 0, 0], 0.045, t >= 2 ? trim(t) : P.rust, 0.045, { segs: 6 });
      for (const x of [0.0, 0.22 + 0.01 * t]) m.cylinder([x - 0.015, 0, 0], [x + 0.015, 0, 0], 0.055, P.ironDk, 0.055, { segs: 6 });
      m.sphere([0.27, 0, 0], 0.035, t >= 4 ? P.gloryInk : p.i % 2 ? P.fire : P.fireHot, { segs: 5 });
    });
    else puff(m, h.pt([0.36, 0.14, 0.86]), 0.08, 0.4);
  },
};

/** Arc Trooper: a coil pack with a tall antenna; forked arcs on the blow. */
export const storm: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, g = gunHands(p);
    const h = trooper(m, p, { weight: "mid", handR: g.R, handL: g.L, lunge: 0, recoil: 0.02, torso: P.ironDk });
    pads(m, h);
    const top = 0.52 + 0.04 * t;
    m.at(h.back, () => {
      m.cylinder([0.09, 0, -0.14], [0.09, 0, 0.2], 0.1, P.ironDk, 0.1, { segs: 8 });
      for (const z of [-0.06, 0.04, 0.14]) m.torus([0.09, 0, z], [0, 0, 1], 0.11, 0.022, t >= 3 ? P.brass : P.rust);
      m.cylinder([0.09, 0, 0.2], [0.09, 0, top], 0.016, P.steel, 0.012, { segs: 4 });
      m.sphere([0.09, 0, top], 0.06, t >= 4 ? P.gloryInk : P.zap, { segs: 6 });
      m.decal(0.03, () => m.box([0.2, 0, 0.0], [0.02, 0.12, 0.12], P.team));
    });
    m.at(h.head, () => { helmet(m, r, P.ironDk); rank(m, p); });
    m.at(gripAim(h.pR, h.pL), () => {
      m.box([0.1, 0, 0], [0.34, 0.06, 0.08], P.ironDk);
      for (const s of [1, -1]) m.cylinder([0.2, s * 0.03, 0], [0.42, s * 0.05, 0], 0.014, P.brass, 0.01, { segs: 4 });
      if (p.hit) { zigzag(m, [0.42, 0, 0], [1.0, 0.1, 0.06], 0.1); zigzag(m, [0.42, 0, 0], [0.9, -0.2, -0.04], 0.08); glint(m, [0.44, 0, 0], 0.05, P.zap); }
      else if (p.blend < -0.5) glint(m, [0.44, 0, 0], 0.03, P.zap);
    });
  },
};

/** Borer: a trooper with a helmet lamp and a big drill. */
export const sapper: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const Rh = p.mix<V3>([0.08, 0.14, 0.36], [0.22, 0.1, 0.36], { wind: [-0.02, 0.14, 0.42] });
    const Lh = p.mix<V3>([0.28, -0.04, 0.36], [0.44, 0, 0.32], { wind: [0.18, -0.04, 0.46] });
    const h = trooper(m, p, { weight: "mid", bulk: 1.08, handR: Rh, handL: Lh, lunge: 0.8, torso: P.khaki });
    pads(m, h); pack(m, h, P.rust, P.team, 0.85);
    m.at(h.head, () => { helmet(m, r, P.hazard, { lamp: true, brim: true }); rank(m, p); });
    m.at(gripAim(h.pR, h.pL), () => {
      m.rotX(p.i * 60 + (p.hit ? 30 : 0));
      m.box([0.12, 0, 0], [0.3, 0.1, 0.1], P.ironDk);
      m.cone([0.26, 0, 0], [0.62 + 0.03 * t, 0, 0], 0.085, blade(t), { segs: 6 });
      for (const x of [0.32, 0.42, 0.52]) m.torus([x, 0, 0], [1, 0, 0], 0.085 - (x - 0.26) * 0.2, 0.014, trim(t));
      if (p.hit) glint(m, [0.7, 0, 0], 0.05, P.fireHot);
    });
  },
};

/** Colours: a marine carrying a tall banner in the side's colour. The cast is the rally. */
export const banner: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, Rh = poleHand(p);
    const h = trooper(m, p, { weight: "mid", handR: Rh, handL: offHand(p), lunge: 0.3, swingR: 0 });
    pads(m, h);
    m.at(h.head, () => { helmet(m, r, t >= 3 ? P.brass : P.armor); rank(m, p); });
    m.at(h.aim("R", UPV), () => {
      const top = 0.86 + 0.04 * t, w = 0.03 * p.wave(1, 1);
      m.cylinder([-0.36, 0, 0], [top, 0, 0], 0.018, trim(t), 0.018, { segs: 5 });
      m.cone([top, 0, 0], [top + 0.1, 0, 0], 0.035, blade(t, P.bone), { segs: 4 });
      m.poly([[top - 0.02, 0, 0], [top - 0.04, 0.02 + w, -0.2], [top - 0.02, 0, -0.42], [top - 0.5, 0.04 - w, -0.42], [top - 0.42, 0.02 + w, -0.2], [top - 0.5, 0, 0]], P.teamFlat);
      m.decal(0.03, () => m.box([top - 0.24, 0, -0.2], [0.14, 0.02, 0.14], P.bone));
      m.decal(0.05, () => m.box([top - 0.24, 0, -0.2], [0.05, 0.03, 0.05], P.black));
    });
    if (p.is("cast") && p.after) for (const a of [0, 1.6, 3.2, 4.8]) glint(m, h.pt([0.2 + Math.cos(a) * 0.3, 0.2 + Math.sin(a) * 0.3, 1.2]), 0.03, P.gloryInk);
  },
};
const UPV: V3 = [0.12, 0, 1];

/** Cryo Gunner: ice-blue coolant tanks and a sprayer; a spray of white shards on the blow. */
export const rime: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, g = gunHands(p);
    const h = trooper(m, p, { weight: "mid", handR: g.R, handL: g.L, lunge: 0, recoil: 0.02, torso: P.whiteDk, arms: P.iceDk });
    pads(m, h);
    tanks(m, h, P.ice, t >= 3 ? 3 : 2, trim(t));
    m.at(h.head, () => { helmet(m, r, P.ice); rank(m, p); });
    m.at(gripAim(h.pR, h.pL), () => {
      m.box([0.1, 0, 0], [0.3, 0.06, 0.08], P.iceDk);
      m.cylinder([0.2, 0, 0], [0.46, 0, 0], 0.03, blade(t, P.steel), 0.05, { segs: 6 });
      if (p.after) {
        const k = p.hit ? 1 : 1.5;
        for (const [y, z, l] of [[0, 0, 0.5], [0.16, 0.08, 0.4], [-0.16, 0.06, 0.4], [0.07, -0.1, 0.34], [-0.08, 0.14, 0.3]]) m.cone([0.46 + l * k, y * k, z * k], [0.5, y * 0.2, z * 0.2], 0.04, p.hit ? P.frost : P.zap, { segs: 4 });
      }
    });
  },
};

/** Field Tech: a hard hat, a big wrench and a pack of parts with an antenna. The cast builds. */
export const tinker: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p);
    const hand = p.is("cast") ? p.mix<V3>([0.14, 0.22, 0.38], [0.34, 0.1, 0.22], { castWind: [0.0, 0.24, 0.7] }) : c.hand;
    const aim = p.is("cast") ? norm(p.mix<V3>([0.45, 0.1, 1], [1, -0.1, -0.5], { castWind: [-0.4, 0.15, 1] })) : c.aim;
    const h = trooper(m, p, { weight: "mid", handR: hand, handL: [0.18, -0.2, 0.34], twist: 22, torso: P.khaki, lunge: 0.6 });
    pads(m, h);
    m.at(h.back, () => {
      m.box([0.08, 0, 0.02], [0.16, 0.3, 0.34], P.rust);
      m.box([0.08, 0, 0.2], [0.18, 0.32, 0.06], P.team);
      m.cylinder([0.1, 0.1, 0.2], [0.1, 0.12, 0.62], 0.01, P.steel, 0.01, { segs: 3 });
      m.sphere([0.1, 0.12, 0.62], 0.03, t >= 4 ? P.glory : P.redLamp, { segs: 5 });
      for (const y of [-0.1, 0.02]) m.cylinder([0.17, y, -0.08], [0.17, y, 0.06], 0.035, trim(t), 0.035, { segs: 6 });
    });
    m.at(h.head, () => { helmet(m, r, P.hazard, { brim: true, stripe: null }); rank(m, p); });
    m.at(h.aim("R", aim), () => {
      const L = 0.4 + 0.02 * t;
      m.box([L / 2, 0, 0], [L, 0.03, 0.045], trim(t));
      m.extrude([[L - 0.02, 0.09], [L + 0.12, 0.09], [L + 0.12, 0.03], [L + 0.05, 0.03], [L + 0.05, -0.03], [L + 0.12, -0.03], [L + 0.12, -0.09], [L - 0.02, -0.09]], 0.035, blade(t));
      if (p.hit) glint(m, [L + 0.1, 0, -0.06], 0.045, P.fireHot);
    });
  },
};

/** Razor: a slim officer in a long coat with a thin sabre. The cast is the parry. */
export const duelist: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, th = thrust(p, 0.4), parry = p.is("cast");
    const hand = parry ? p.mix<V3>([0.12, 0.22, 0.38], [0.24, 0.02, 0.58], { castWind: [0.1, 0.24, 0.4] }) : th.hand;
    const aim = parry ? norm(p.mix<V3>([1, 0, 0.35], [0.1, -0.9, 0.5], { castWind: [1, 0.2, 0.3] })) : th.aim;
    const Lh = p.mix<V3>([-0.04, -0.24, 0.34], [-0.14, -0.26, 0.46], { cast: [0.1, -0.24, 0.5] });
    const h = trooper(m, p, { weight: "light", bulk: 0.86, handR: hand, handL: Lh, torso: P.coat, arms: P.coat, legs: P.coat, lunge: parry ? 0 : 1.3 });
    cape(m, h, p, P.coat, 0.5, 0.17);
    m.at(h.chest, () => m.decal(0.02, () => m.box([0.12, 0, 0.0], [0.08, 0.08, 0.34], P.team)));
    m.at(h.head, () => {
      m.group(() => { m.cylinder([0, 0, r * 0.5], [0, 0, r * 0.9], r * 1.1, P.coat, r * 1.35, { segs: 10 }); m.cylinder([r * 0.6, 0, r * 0.45], [r * 0.6, 0, r * 0.52], r * 0.9, P.black, r * 0.9, { segs: 8 }); });
      m.decal(0.03, () => m.cylinder([0, 0, r * 0.92], [0, 0, r * 0.98], r * 1.36, P.team, r * 1.36, { segs: 10 }));
      m.decal(0.03, () => m.box([r * 0.95, 0, -r * 0.05], [r * 0.3, r * 1.3, r * 0.3], P.visor));
      rank(m, p, r * 1.2);
    });
    m.at(h.aim("R", aim), () => {
      m.cylinder([0.03, 0, 0], [0.6 + 0.03 * t, 0, 0], 0.014, blade(t), 0.008, { segs: 4 });
      m.sphere([0.02, 0, 0], 0.045, trim(t), { segs: 6 });
      if (p.hit && !parry) m.cone([0.5, 0, 0], [1.0, 0, 0], 0.03, P.spark, { segs: 4 });
      if (p.hit && parry) glint(m, [0.3, 0, 0], 0.05);
    });
  },
};

/** Impaler: a very long barbed pike. The cast braces it against a charge. */
export const pikeman: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const Rh = p.mix<V3>([0.06, 0.2, 0.36], [0.26, 0.16, 0.4], { wind: [-0.12, 0.22, 0.42], cast: [0.0, 0.2, 0.24] });
    const Lh = p.mix<V3>([0.28, -0.02, 0.44], [0.46, 0.04, 0.4], { wind: [0.12, 0.0, 0.46], cast: [0.3, 0.0, 0.34] });
    const h = trooper(m, p, { weight: "mid", handR: Rh, handL: Lh, lunge: p.is("cast") ? 0 : 0.9, torso: t >= 2 ? P.iron : P.armor });
    pads(m, h, P.team, 1.15);
    m.at(h.head, () => { helmet(m, r, t >= 3 ? P.brass : P.armor, { fin: P.team, stripe: null }); rank(m, p, r * 1.9); });
    m.at(gripAim(h.pR, h.pL), () => {
      const F = 1.0 + 0.04 * t;
      pike(m, 0.3, F, blade(t), 0.02);
      m.decal(0.01, () => m.box([F - 0.14, 0, -0.07], [0.16, 0.02, 0.12], P.teamFlat));
      if (p.hit) glint(m, [F + 0.24, 0, 0], 0.045);
    });
  },
};

/** Drum Runner: sprinting flat out with a leaking hazard drum held overhead. */
export const keg: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, up = p.mix(0.86, 0.6, { wind: 0.9 }), fw = p.mix(0.04, 0.4, { wind: -0.04 });
    const h = trooper(m, p, { weight: "light", bulk: 0.95, handR: [fw, 0.15, up - 0.1], handL: [fw, -0.15, up - 0.1], lean: 22, torso: P.khaki, arms: P.hideLt, lunge: 0.8, stride: 0.44 });
    m.at(h.head, () => { helmet(m, r * 0.95, P.rubber, { visor: P.visor, stripe: P.team }); });
    m.at(h.hips, () => m.decal(0.02, () => m.cylinder([0, 0, 0.04], [0, 0, 0.12], 0.17, P.team, 0.17, { segs: 8 })));
    if (!p.after) m.with(() => {
      m.move(...h.pt([fw, 0, up + 0.08])); m.rotY(90);
      const rr = 0.17 + 0.01 * t, hl = 0.2 + 0.01 * t;
      m.cylinder([-hl, 0, 0], [hl, 0, 0], rr, t >= 3 ? P.brass : P.hazard, rr, { segs: 10 });
      m.decal(0.02, () => { for (const x of [-hl * 0.6, 0, hl * 0.6]) m.cylinder([x - 0.025, 0, 0], [x + 0.025, 0, 0], rr + 0.005, P.black, rr + 0.005, { segs: 10 }); });
      m.decal(0.04, () => m.cylinder([-hl - 0.01, 0, 0], [-hl, 0, 0], rr * 0.6, t >= 4 ? P.gloryInk : p.i % 2 ? P.fire : P.fireHot, rr * 0.6, { segs: 8 }));
    });
    else { burst(m, h.pt([0.5, 0, 0.5]), 0.2); puff(m, h.pt([0.5, 0, 0.8]), 0.24, p.hit ? 0.2 : 0.8, P.smokeDk); }
  },
};

/** Flare Bearer: a burning flare on a long pole. The cast sets a ward. */
export const lamp: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, Rh = poleHand(p);
    const h = trooper(m, p, { weight: "mid", handR: Rh, handL: offHand(p), lunge: 0.3, swingR: 0, torso: P.khaki });
    pads(m, h); pack(m, h, P.armorDk, P.team, 0.8);
    m.at(h.head, () => { helmet(m, r, P.armor, { brim: true }); rank(m, p); });
    m.at(h.aim("R", UPV), () => {
      const top = 0.74 + 0.03 * t, k = 1 + 0.2 * Math.sin(p.i * 2.4) + (p.is("cast") && p.after ? 0.8 : 0);
      m.cylinder([-0.34, 0, 0], [top, 0, 0], 0.016, P.ironDk, 0.016, { segs: 5 });
      m.cylinder([top - 0.02, 0, 0], [top + 0.1, 0, 0], 0.04, trim(t), 0.05, { segs: 6 });
      m.group(() => { m.cone([top + 0.08, 0, 0], [top + 0.08 + 0.26 * k, 0, 0], 0.08 * k, t >= 4 ? P.gloryInk : P.fire, { segs: 6 }); for (const s of [1, -1]) m.cone([top + 0.1, 0, 0], [top + 0.22 * k, s * 0.12 * k, 0.05], 0.045, P.fire, { segs: 4 }); });
      m.decal(0.05, () => m.sphere([top + 0.13, 0, 0], 0.06 * k, P.fireHot, { segs: 6 }));
      if (p.hit) glint(m, [top + 0.2, 0, 0.2], 0.04, P.fireHot);
    });
  },
};

/** Scorcher: fuel tanks and a flamethrower; a wall of fire forward on the blow. */
export const tide: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, g = gunHands(p, -0.04);
    const h = trooper(m, p, { weight: "mid", bulk: 1.1, handR: g.R, handL: g.L, lunge: 0.2, recoil: 0.03, torso: P.ironDk, arms: P.armorDk });
    pads(m, h, P.team, 1.1, 1.1);
    tanks(m, h, P.tankRed, 2, trim(t), 0.085);
    m.at(h.back, () => m.decal(0.03, () => m.box([0.19, 0, 0.02], [0.02, 0.3, 0.08], P.hazard)));
    m.at(h.head, () => { helmet(m, r, P.ironDk); rank(m, p); });
    m.at(gripAim(h.pR, h.pL), () => {
      m.box([0.08, 0, 0], [0.3, 0.07, 0.09], P.ironDk);
      m.cylinder([0.2, 0, 0], [0.5, 0, 0], 0.028, trim(t), 0.036, { segs: 6 });
      m.sphere([0.52, 0, -0.03], 0.02, P.fireHot, { segs: 4 });
      if (p.after) {
        const k = p.hit ? 1 : 1.3, c = t >= 4 ? P.gloryInk : P.fire;
        m.group(() => { for (const [x, y, z, s] of [[0.7, 0, 0, 0.13], [0.95, 0.12, 0.05, 0.17], [0.95, -0.12, 0.03, 0.17], [1.25, 0, 0.1, 0.2], [1.2, 0.26, 0.04, 0.14], [1.2, -0.26, 0.04, 0.14]]) m.ellipsoid([0.5 + (x - 0.5) * k, y * k, z * k], [s * 1.3, s, s], x > 1.1 && !p.hit ? P.fireRed : c, { segs: 6 }); });
        m.decal(0.06, () => m.ellipsoid([0.5 + 0.3 * k, 0, 0.02], [0.2 * k, 0.07, 0.07], P.fireHot, { segs: 6 }));
      }
    });
  },
};

/** Sentry Gun: the Field Tech's twin-barrel gun on a tripod. */
export const turret: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const s = structureLite(p);
    for (const a of [0, 120, 240]) m.with(() => { m.rotZ(a + 60); m.cylinder([0, 0, 0.26], [0.22, 0, 0], 0.022, P.ironDk, 0.022, { segs: 4 }); });
    m.with(() => {
      m.move(-s.kick, 0, 0.3 - s.sink).rotY(s.tip);
      m.box([0, 0, 0.02], [0.18, 0.22, 0.14], P.teamFlat);
      for (const y of [0.05, -0.05]) m.cylinder([0.05, y, 0.04], [0.36, y, 0.04], 0.026, P.ironDk, 0.022, { segs: 5 });
      m.decal(0.04, () => m.box([-0.02, 0, 0.1], [0.06, 0.06, 0.04], p.i % 2 ? P.redLamp : P.off));
      if (p.hit) for (const y of [0.05, -0.05]) flash(m, [0.36, y, 0.04], 0.045);
    });
  },
};
/** A tiny fixed-gun motion: kick on the blow, sink and tip in death. */
function structureLite(p: { hit: boolean; dead: number }) { return { kick: p.hit ? 0.05 : 0, sink: 0.14 * p.dead, tip: 40 * p.dead }; }

/** Phantom and Deceiver share a build in units-b; Bonelord is the hero. */
export const lion: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), rally = p.is("cast");
    const hand = rally ? p.mix<V3>([0.14, 0.22, 0.38], [0.18, 0.2, 0.82], { castWind: [0.1, 0.24, 0.36] }) : c.hand;
    const aim = rally ? norm(p.mix<V3>([0.45, 0.1, 1], [0.1, 0, 1], { castWind: [1, 0.1, 0.2] })) : c.aim;
    const h = trooper(m, p, { size: 1.3, bulk: 1.3, weight: "heavy", handR: hand, handL: offHand(p), twist: 26, torso: P.bone, arms: P.boneDk, legs: P.char, boots: P.boneDk, hands: P.boneDk, lunge: rally ? 0 : 1 });
    cape(m, h, p, P.teamFlat, 0.56, 0.26);
    m.at(h.chest, () => {
      m.decal(0.02, () => { for (const z of [0.08, 0.0, -0.08]) m.box([0.13, 0, z], [0.06, 0.34 - Math.abs(z) * 0.8, 0.04], P.boneDk); });
      for (const s of [1, -1]) { m.ellipsoid([0, s * 0.27, 0.16], [0.14, 0.13, 0.09], P.team, { segs: 8 }); m.cone([0, s * 0.3, 0.2], [-0.04, s * 0.46, 0.38], 0.05, P.bone, { segs: 4 }); }
    });
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([-r * 0.08, 0, r * 0.15], [r * 1.15, r * 1.05, r * 1.05], P.bone, { segs: 10 }); m.box([r * 0.5, 0, -r * 0.65], [r * 0.8, r * 1.1, r * 0.6], P.bone); });
      m.decal(0.04, () => { for (const s of [1, -1]) m.box([r * 0.97, s * r * 0.42, r * 0.1], [r * 0.3, r * 0.5, r * 0.44], t >= 4 ? P.glory : P.visor); });
      for (const s of [1, -1]) m.tube([[0, s * r * 0.8, r * 0.5], [r * 0.3, s * r * 1.7, r * 0.9], [r * 0.9, s * r * 1.7, r * 1.9]], [r * 0.34, r * 0.26, r * 0.05], t >= 3 ? P.brass : P.boneDk, { segs: 5 });
      m.extrude([[-r * 1.2, r * 0.8], [r * 0.5, r * 1.0], [r * 0.1, r * 2.0], [-r * 1.5, r * 1.7]], r * 0.3, P.team);
    });
    m.at(h.aim("R", aim), () => {
      sword(m, 0.62 + 0.03 * t, blade(t, P.bone), trim(t), 0.085);
      if (rally && p.after) glint(m, [0.7, 0, 0], 0.06, P.gloryInk);
    });
    if (p.hit && !rally) slashArc(m, h, [0.1, 0, 0.44], 0.66, 80, -55, -0.4);
    if (rally && p.after) for (const a of [0.4, 2.0, 3.6, 5.2]) glint(m, h.pt([0.15 + Math.cos(a) * 0.4, 0.2 + Math.sin(a) * 0.4, 1.3]), 0.035, P.gloryInk);
  },
};
export { staff };
