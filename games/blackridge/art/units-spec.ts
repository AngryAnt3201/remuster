// Blackridge's specialists: everyone on foot who is not line infantry, plus the dogs and the two stand-ins.
import { gripAim, quadruped, type Pose, type UnitDef } from "../../../artkit/rig";
import { norm, type Material, type Model, type V3 } from "../../../artkit/toon3d";
import type { SoldierRig } from "./body";
import { P, antenna, arc, beret, boonie, carrier, flash, helmet, hood, knife, mask, pack, pistol, puff, r, rankKit, rifle, ring, swish, tool, trooper } from "./parts";

/** A one-handed overhead blow: the hand and the way the weapon points, through wind-up, strike and rest. */
const chop = (p: Pose) => ({
  hand: p.mix<V3>([0.1, 0.17, 0.56], [0.3, 0.04, 0.58], { wind: [-0.06, 0.2, 0.86] }),
  aim: norm(p.mix<V3>([0.5, 0.1, 0.85], [1, -0.2, -0.25], { wind: [-0.5, 0.2, 1] })),
});
/** A long coat or poncho hanging from the hips or shoulders. */
function skirt(m: Model, h: SoldierRig, col: Material, len: number, top = 0.1, flare = 0.15) {
  m.at(h.hips, () => m.cylinder([0, 0, 0.07], [-0.01, 0, -len], top * h.bulk, col, flare * h.bulk, { segs: 12 }));
}
/** The rally / signal ring that opens round a caster. */
function pulse(m: Model, h: SoldierRig, p: Pose, col: Material, z = 0.5) {
  if (p.is("cast") && p.blend > 0.3) m.torus(h.pt([0.05, 0, z]), [0, 0, 1], 0.2 + 0.2 * p.blend, 0.016, col, { segs: 18 });
}

// ------------------------------------------------------------------------------------------------ throwers and sprayers
/** Fragger: stout, a bandolier across the chest, a grenade in the raised throwing hand. */
export const grenadier: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.27);
    const R = p.mix<V3>([0.04, 0.2, 0.7], [0.3, 0.1, 0.95], { wind: [-0.2, 0.2, 0.84] });
    const L = p.mix<V3>([0.2, -0.12, 0.6], [0.1, -0.2, 0.5], { wind: [0.28, -0.08, 0.72] });
    const h = trooper(m, p, { bulk: 1.18, handR: R, handL: L, twist: 24, lunge: 0.5, torso: P.coyote, legs: P.coyote, pads: P.black });
    carrier(m, h, P.oliveDk, { pouches: null });
    m.at(h.chest, () => m.group(() => { for (let i = 0; i < 4 + t; i++) { const k = i / (3 + t) - 0.5; m.sphere([0.105, k * 0.2, -0.02 + k * 0.16], 0.026, P.oliveDk, { segs: 6 }); } }));
    pack(m, h, P.oliveDk, 0.08, 0.2, 0.2);
    rankKit(m, h, p, P.oliveDk);
    m.at(h.head, () => helmet(m, P.coyoteDk));
    if (!p.after) m.at(h.aim("R", [1, 0, 0]), () => m.group(() => { m.ellipsoid([0.02, 0, 0.045], [0.048 + 0.004 * t, 0.048 + 0.004 * t, 0.06 + 0.004 * t], t >= 3 ? P.armorDk : P.oliveDk, { segs: 8 }); m.box([0.02, 0, 0.115], [0.03, 0.03, 0.03], P.steel); m.decal(0.01, () => m.cylinder([0.02, 0, 0.03], [0.02, 0, 0.05], 0.054, t >= 4 ? P.teamGlow : P.hazard, 0.054, { segs: 8 })); }));
  },
};

/** Cryo: a pale hooded suit, coolant tanks, a spray lance that throws a freezing cloud. */
export const rime: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.27);
    const R = p.mix<V3>([0.08, 0.1, 0.58], [0.14, 0.08, 0.66], { wind: [0.04, 0.1, 0.62] });
    const L = p.mix<V3>([0.28, 0.0, 0.58], [0.32, 0.01, 0.68], { wind: [0.26, 0.0, 0.64] });
    const h = trooper(m, p, { handR: R, handL: L, lunge: 0, recoil: 0.01, torso: P.white, legs: P.white, hands: P.navy, boots: P.navy });
    m.at(h.back, () => { m.group(() => { for (const y of [-0.055, 0.055]) m.capsule([0.07, y, -0.1], [0.07, y, 0.13 + 0.01 * t], 0.05, P.cryoTank, 0.05, { segs: 10 }); m.box([0.05, 0, 0], [0.04, 0.16, 0.2], P.greyDk); }); m.decal(0.012, () => { for (const y of [-0.055, 0.055]) m.cylinder([0.07, y, 0.02], [0.07, y, 0.07], 0.052, t >= 4 ? P.teamGlow : P.team, 0.052, { segs: 10 }); }); });
    m.tube([h.pt([-0.12, 0.05, 0.62]), h.pt([-0.05, 0.2, 0.5]), h.pR], 0.012, P.rubber, { segs: 5 });
    m.at(h.head, () => { hood(m, P.white); mask(m, P.cryo); });
    m.at(gripAim(h.pR, h.pL), () => {
      const L2 = 0.46 + 0.02 * t;
      m.group(() => { m.cylinder([-0.06, 0, 0.01], [L2, 0, 0.01], 0.014, P.steel, 0.012, { segs: 6 }); m.cylinder([L2, 0, 0.01], [L2 + 0.06, 0, 0.01], 0.014, P.steelDk, 0.03, { segs: 8 }); m.box([0.04, 0, -0.02], [0.08, 0.03, 0.05], P.greyDk); });
      if (p.after) { const k = p.hit ? 1 : 1.5; m.cone([L2 + 0.42 * k, 0, 0.01], [L2 + 0.04, 0, 0.01], 0.13 * k, P.cryoMist, { segs: 8 }); for (let i = 0; i < 4; i++) m.cone([L2 + 0.12 + i * 0.09 * k, Math.sin(i * 2.4) * 0.07, 0.01 + Math.cos(i * 1.9) * 0.06], [L2 + 0.2 + i * 0.09 * k, Math.sin(i * 2.4) * 0.1, 0.01 + Math.cos(i * 1.9) * 0.09], 0.016, P.cryo, { segs: 4 }); }
    });
  },
};

/** Surge: tanks and a fat pressure cannon under the arm. One blast clears a lane. */
export const tide: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.27);
    const R = p.mix<V3>([0.02, 0.14, 0.56], [0.06, 0.13, 0.6], { wind: [-0.02, 0.14, 0.58] });
    const L = p.mix<V3>([0.26, 0.04, 0.56], [0.3, 0.05, 0.62], { wind: [0.24, 0.04, 0.6] });
    const h = trooper(m, p, { bulk: 1.1, handR: R, handL: L, lunge: 0, recoil: 0.05, torso: P.navy, legs: P.navy, crouch: 0.25, pads: P.black });
    carrier(m, h, P.black, { pouches: null });
    m.at(h.back, () => { m.group(() => { m.capsule([0.09, 0, -0.12], [0.09, 0, 0.14 + 0.01 * t], 0.085, P.steelDk, 0.085, { segs: 12 }); }); m.decal(0.012, () => m.cylinder([0.09, 0, 0.0], [0.09, 0, 0.07], 0.088, t >= 4 ? P.teamGlow : P.team, 0.088, { segs: 12 })); });
    m.tube([h.pt([-0.16, 0.08, 0.6]), h.pt([-0.1, 0.24, 0.46]), h.pR], 0.02, P.rubber, { segs: 6 });
    rankKit(m, h, p, P.black);
    m.at(h.head, () => helmet(m, P.navy, { visor: true }));
    m.at(gripAim(h.pR, h.pL), () => {
      const L2 = 0.5 + 0.02 * t;
      m.group(() => { m.cylinder([-0.1, 0, 0], [L2, 0, 0], 0.045, P.gun, 0.04, { segs: 10 }); m.cylinder([L2, 0, 0], [L2 + 0.07, 0, 0], 0.04, P.steel, 0.06, { segs: 10 }); m.box([0.05, 0, 0.05], [0.14, 0.03, 0.03], P.black); });
      if (p.after) {
        const k = p.hit ? 1 : 1.35;
        m.group(() => { m.cone([L2 + 0.75 * k, 0, 0], [L2 + 0.06, 0, 0], 0.2 * k, P.water, { segs: 10 }); m.torus([L2 + 0.4 * k, 0, 0], [1, 0, 0], 0.16 * k, 0.025, P.cryoMist, { segs: 12 }); m.torus([L2 + 0.7 * k, 0, 0], [1, 0, 0], 0.24 * k, 0.03, P.cryoMist, { segs: 12 }); });
      }
    });
  },
};

// ------------------------------------------------------------------------------------------------ blades and clubs
/** Prowler: hooded in a ghillie, dark, twin knives. The side shows only as an armband and the ring. */
export const shade: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.24);
    const R = p.mix<V3>([0.12, 0.15, 0.5], [0.34, 0.03, 0.62], { wind: [-0.06, 0.18, 0.7] });
    const L = p.mix<V3>([0.14, -0.15, 0.5], [0.28, -0.08, 0.52], { wind: [0.04, -0.2, 0.6] });
    const aR = norm(p.mix<V3>([0.7, 0, 0.6], [1, -0.2, -0.1], { wind: [-0.3, 0.2, 1] })), aL = norm(p.mix<V3>([0.7, 0, 0.6], [1, 0.2, 0.1], { wind: [0.2, -0.2, 1] }));
    const h = trooper(m, p, { bulk: 0.94, handR: R, handL: L, twist: 20, lunge: 1.1, lean: 16, crouch: 0.3, skin: P.night, torso: P.ghillie, legs: P.night, arms: P.ghillie, boots: P.night, swingR: 0.5, swingL: 0.5 });
    m.at(h.chest, () => m.group(() => { for (let i = 0; i < 9; i++) { const a = i * 2.4; m.cone([Math.cos(a) * 0.05 - 0.02, Math.sin(a) * 0.1, 0.1 - (i % 3) * 0.07], [Math.cos(a) * 0.13 - 0.05, Math.sin(a) * 0.17, -0.02 - (i % 3) * 0.07], 0.035, i % 2 ? P.ghillie : P.ghillie2, { segs: 4 }); } }));
    m.at(h.head, () => { hood(m, P.ghillie, P.ghillie2); if (t >= 2) m.decal(0.03, () => { for (const s of [1, -1]) m.sphere([r * 1.12, s * r * 0.32, 0], r * 0.16, t >= 4 ? P.teamGlow : P.nvg, { segs: 5 }); }); });
    m.at(h.aim("R", aR), () => knife(m, 0.2 + 0.012 * t, t >= 3 ? P.steel : P.steelDk));
    m.at(h.aim("L", aL), () => knife(m, 0.2 + 0.012 * t, t >= 3 ? P.steel : P.steelDk));
    if (p.hit) { swish(m, h.root, [0.12, 0, 0.6], 0.3, 60, -40, -0.25); swish(m, h.root, [0.12, 0, 0.54], 0.26, -60, 20, 0.2); }
  },
};

/** Striker: a slim close-quarters specialist with a machete. The cast is the parry. */
export const duelist: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, parry = p.is("cast");
    ring(m, p, 0.25);
    const hand = parry ? p.mix<V3>([0.12, 0.16, 0.56], [0.24, 0.02, 0.8], { castWind: [0.1, 0.18, 0.56] }) : p.mix<V3>([0.12, 0.16, 0.56], [0.36, 0.06, 0.66], { wind: [-0.04, 0.2, 0.68] });
    const aim = parry ? norm(p.mix<V3>([1, 0, 0.4], [0.1, -0.9, 0.5], { castWind: [1, 0.2, 0.3] })) : norm(p.mix<V3>([1, 0, 0.4], [1, -0.05, 0.0], { wind: [0.5, 0.3, 0.8] }));
    const L = p.mix<V3>([0.08, -0.17, 0.6], [-0.06, -0.2, 0.56], { cast: [0.14, -0.16, 0.66] });
    const h = trooper(m, p, { bulk: 0.9, handR: hand, handL: L, torso: P.black, legs: P.greyDk, arms: P.black, skin: P.skinDk, lunge: parry ? 0 : 1.3, crouch: 0.2 });
    carrier(m, h, P.greyDk, { pouches: null });
    m.at(h.chest, () => m.decal(0.015, () => m.box([0.09, 0, 0.05], [0.012, 0.12, 0.07], P.team)));
    m.at(h.head, () => { m.ellipsoid([-r * 0.1, 0, r * 0.15], [r * 1.12, r * 1.02, r * 1.2], P.black, { segs: 10 }); m.decal(0.02, () => m.box([r * 0.95, 0, r * 0.12], [r * 0.2, r * 1.1, r * 0.3], P.skinDk)); m.decal(0.014, () => m.cylinder([0, 0, r * 0.62], [0, 0, r * 0.88], r * 1.06, P.team, r * 0.92, { segs: 10 })); });
    if (t >= 2) m.at(h.aim("L", [0.3, 0, -1]), () => pistol(m));
    m.at(h.aim("R", aim), () => {
      knife(m, 0.42 + 0.025 * t, t >= 4 ? P.teamLt : t >= 3 ? P.steel : P.steelDk, 0.04);
      if (p.hit && !parry) m.capsule([0.4, 0, 0], [0.8, 0, 0], 0.02, P.cryoMist, 0.003, { segs: 4 });
      if (p.hit && parry) { m.sphere([0.26, 0, 0], 0.05, P.flashHot, { segs: 6 }); for (let i = 0; i < 4; i++) m.cone([0.26, 0, 0], [0.26 + Math.cos(i * 1.6) * 0.14, Math.sin(i * 1.6) * 0.14, 0.05], 0.014, P.flash, { segs: 4 }); }
    });
  },
};

/** Breacher: bare-armed and huge, a sledgehammer in both hands. He goes for the toughest thing on the field. */
export const ravager: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.3);
    const R = p.mix<V3>([0.08, 0.14, 0.52], [0.34, 0.02, 0.5], { wind: [-0.1, 0.16, 0.92] });
    const L = p.mix<V3>([0.2, -0.04, 0.62], [0.42, -0.04, 0.42], { wind: [-0.04, 0.02, 1.02] });
    const h = trooper(m, p, { size: 1.1, bulk: 1.28, weight: "heavy", handR: R, handL: L, twist: 34, lunge: 1.2, arms: P.skinLt, skin: P.skinLt, torso: P.greyDk, legs: P.coyoteDk, crouch: 0.2, pads: P.black });
    carrier(m, h, P.black, { pouches: null });
    m.at(h.chest, () => m.decal(0.015, () => m.box([0.095, 0, 0.05], [0.012, 0.16, 0.09], P.team)));
    m.at(h.head, () => { m.ellipsoid([-r * 0.1, 0, r * 0.45], [r * 1.1, r * 1.0, r * 0.8], P.black, { segs: 10 }); m.decal(0.02, () => m.ellipsoid([r * 0.6, 0, -r * 0.55], [r * 0.6, r * 0.7, r * 0.6], P.wood, { segs: 8 })); m.decal(0.014, () => m.cylinder([0, 0, r * 0.3], [0, 0, r * 0.56], r * 1.08, P.team, r * 1.0, { segs: 10 })); });
    m.at(gripAim(h.pR, h.pL), () => {
      m.move(-0.14, 0, 0);
      tool(m, 0.6 + 0.03 * t, () => m.group(() => { m.box([0, 0, 0], [0.1 + 0.01 * t, 0.2 + 0.015 * t, 0.1 + 0.01 * t], t >= 3 ? P.steel : P.steelDk); if (t >= 4) m.decal(0.01, () => m.box([0, 0, 0], [0.104, 0.05, 0.114], P.teamGlow)); }), P.wood, 0.017);
    });
    if (p.hit) { swish(m, h.root, [0.1, 0, 0.5], 0.62, 80, -50, -0.5, P.dust); puff(m, h.pt([0.6, 0, 0.06]), 0.08, P.dust); }
  },
};

/** Bayonet: a very long rifle with a fixed blade, held level. The cast braces it against a charge. */
export const pikeman: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, brace = p.is("cast") ? Math.max(0, p.blend) : 0;
    ring(m, p, 0.28);
    const R = p.mix<V3>([0.02, 0.12, 0.6], [0.2, 0.08, 0.62], { wind: [-0.12, 0.14, 0.64], cast: [0.0, 0.12, 0.34] });
    const L = p.mix<V3>([0.28, 0.02, 0.62], [0.46, 0.03, 0.6], { wind: [0.14, 0.03, 0.66], cast: [0.26, 0.03, 0.5] });
    const h = trooper(m, p, { handR: R, handL: L, lunge: p.is("cast") ? 0 : 0.9, crouch: 0.15 + 0.5 * brace, torso: P.grey, legs: P.grey, pads: P.black });
    carrier(m, h, P.oliveDk);
    rankKit(m, h, p, P.oliveDk);
    m.at(h.head, () => helmet(m, P.grey, { visor: t >= 3 }));
    m.at(gripAim(h.pR, h.pL), () => {
      const L2 = rifle(m, 1, { len: 0.62 + 0.03 * t, col: P.wood });
      m.extrude([[L2 - 0.02, -0.012], [L2 + 0.3, -0.008], [L2 + 0.36, 0.0], [L2 + 0.3, 0.012], [L2 - 0.02, 0.014]], 0.007, t >= 4 ? P.teamLt : P.steel);
      m.decal(0.01, () => m.box([0.2, 0, 0.022], [0.06, 0.04, 0.045], P.team));
      if (p.hit && !p.is("cast")) m.capsule([L2 + 0.3, 0, 0], [L2 + 0.6, 0, 0], 0.018, P.cryoMist, 0.003, { segs: 4 });
    });
  },
};

// ------------------------------------------------------------------------------------------------ signals and support
/** Radioman: a radio pack with a mast far taller than he is, the side's pennant at its head. */
export const banner: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.27);
    const R = p.mix<V3>([0.1, 0.1, 0.74], [0.24, 0.08, 0.7], { wind: [0.08, 0.12, 0.78], cast: [0.1, 0.16, 1.0] });
    const h = trooper(m, p, { handR: R, lunge: 0.3 });
    carrier(m, h, P.coyoteDk, { panel: null });
    pack(m, h, P.greyDk, 0.1, 0.19, 0.26);
    rankKit(m, h, p);
    m.at(h.head, () => helmet(m, P.olive));
    m.at(h.aim("R", [0.2, 0, 1]), () => m.box([0.03, 0, 0], [0.09, 0.035, 0.03], P.black));
    m.tube([h.pR, h.pt([0.0, 0.16, 0.6]), h.pt([-0.14, 0.06, 0.66])], 0.006, P.rubber, { segs: 4 });
    // the mast and the pennant
    const top = 0.74 + 0.05 * t, w = p.wave(0.03, 1), k = p.is("walk") ? 0.08 : 0;
    m.at(h.back, () => {
      m.capsule([0.09, 0.06, 0.1], [0.11, 0.06, top], 0.011, P.gun, 0.007, { segs: 5 });
      m.group(() => { m.poly([[0.11, 0.06, top], [0.52 + k, 0.06 + w, top - 0.03], [0.5 + k, 0.06 + w * 1.4, top - 0.23], [0.11, 0.06, top - 0.26]], P.team); m.poly([[0.11, 0.06, top], [0.4 + k, 0.3 + w, top - 0.04], [0.38 + k, 0.3 + w, top - 0.24], [0.11, 0.06, top - 0.26]], P.team); });
      m.decal(0.01, () => m.poly([[0.13, 0.06, top - 0.09], [0.48 + k, 0.06 + w, top - 0.1], [0.47 + k, 0.06 + w * 1.2, top - 0.15], [0.13, 0.06, top - 0.16]], t >= 4 ? P.teamGlow : P.teamLt));
      if (t >= 2) m.group(() => { for (const z of [0.4, 0.5]) m.capsule([0.1, -0.02, z], [0.1, 0.14, z], 0.005, P.gun, 0.005, { segs: 4 }); });
      if (t >= 3) m.sphere([0.11, 0.06, top + 0.02], 0.02, P.amber, { segs: 6 });
    });
    pulse(m, h, p, P.ring, 0.9);
  },
};

/** Beacon: a floodlight on a long mast. Its light wards the squad. */
export const lamp: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, lit = p.is("cast") ? Math.max(0, p.blend) : 0;
    ring(m, p, 0.25);
    const R = p.mix<V3>([0.18, 0.12, 0.6], [0.3, 0.08, 0.66], { wind: [0.08, 0.14, 0.7], cast: [0.16, 0.12, 0.84], castWind: [0.14, 0.12, 0.56] });
    const h = trooper(m, p, { handR: R, lunge: 0.4, torso: P.grey, legs: P.olive });
    carrier(m, h, P.oliveDk, { pouches: null });
    pack(m, h, P.black, 0.09, 0.18, 0.2);
    rankKit(m, h, p, P.oliveDk);
    m.at(h.head, () => helmet(m, P.grey));
    m.tube([h.pt([-0.14, 0.07, 0.62]), h.pt([-0.02, 0.2, 0.5]), h.pR], 0.008, P.rubber, { segs: 4 });
    m.at(h.aim("R", norm(p.mix<V3>([0.12, 0, 1], [0.7, 0, 0.7], { wind: [-0.1, 0, 1], cast: [0, 0, 1] }))), () => {
      const L = 0.74 + 0.04 * t;
      m.capsule([-0.36, 0, 0], [L, 0, 0], 0.011, P.steelDk, 0.009, { segs: 5 });
      m.group(() => { m.box([L + 0.03, 0, 0], [0.07, 0.17 + 0.01 * t, 0.12], P.black); });
      m.decal(0.012, () => m.box([L + 0.045, 0, 0.062], [0.05, 0.15 + 0.01 * t, 0.01], P.lamp));
      m.decal(0.012, () => m.cylinder([L - 0.12, 0, 0], [L - 0.06, 0, 0], 0.014, t >= 4 ? P.teamGlow : P.team, 0.014, { segs: 6 }));
      if (lit > 0.2) m.sphere([L + 0.05, 0, 0.1], 0.07 + 0.08 * lit, P.lamp, { segs: 8 });
      if (p.hit && !p.is("cast")) m.sphere([L + 0.05, 0, 0.1], 0.1, P.lamp, { segs: 8 });
    });
    pulse(m, h, p, P.lamp, 0.4);
  },
};

/** Arc Tech: a coil mast on a generator pack and a two-pronged emitter. Arcs jump from man to man. */
export const storm: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.27);
    const R = p.mix<V3>([0.14, 0.14, 0.6], [0.34, 0.06, 0.72], { wind: [0.02, 0.16, 0.84] });
    const h = trooper(m, p, { handR: R, lunge: 0.2, torso: P.grey, legs: P.greyDk, hands: P.hazard });
    carrier(m, h, P.greyDk, { pouches: null, panel: null });
    const top = 0.5 + 0.04 * t, hot = p.blend !== 0 || t >= 4;
    m.at(h.back, () => {
      m.group(() => { m.box([0.07, 0, 0.0], [0.11, 0.2, 0.24], P.greyDk); m.capsule([0.07, 0, 0.12], [0.07, 0, top], 0.016, P.steelDk, 0.012, { segs: 6 }); });
      for (let i = 0; i < 4 + t; i++) m.torus([0.07, 0, 0.2 + i * 0.055], [0, 0, 1], 0.05 - i * 0.003, 0.012, P.brass, { segs: 10 });
      m.sphere([0.07, 0, top + 0.03], 0.04, hot ? P.arc : P.steel, { segs: 8 });
      m.decal(0.012, () => m.box([0.128, 0, 0.0], [0.01, 0.16, 0.08], P.team));
      if (p.after) for (let i = 0; i < 3; i++) arc(m, [0.07, 0, top + 0.03], [0.07 + Math.cos(i * 2.1 + p.i) * 0.2, Math.sin(i * 2.1 + p.i) * 0.2, top + 0.1 - i * 0.07], i + p.i, P.arc, 0.007);
    });
    m.tube([h.pt([-0.16, 0.06, 0.6]), h.pt([-0.04, 0.22, 0.5]), h.pR], 0.009, P.rubber, { segs: 4 });
    m.at(h.head, () => { helmet(m, P.grey, { visor: true }); });
    m.at(h.aim("R", norm(p.mix<V3>([0.8, 0, 0.6], [1, 0, 0.05], { wind: [0.2, 0, 1] }))), () => {
      m.group(() => { m.capsule([-0.08, 0, 0], [0.28, 0, 0], 0.014, P.hazard, 0.012, { segs: 6 }); for (const s of [1, -1]) m.capsule([0.28, 0, 0], [0.38, s * 0.035, 0], 0.008, P.brass, 0.006, { segs: 4 }); });
      if (p.after) { arc(m, [0.38, 0, 0], [0.9, 0.05, 0.06], p.i, P.arc, 0.014); arc(m, [0.38, 0, 0], [0.8, -0.14, -0.04], p.i + 3, P.arcHot, 0.008); m.sphere([0.4, 0, 0], 0.045, P.arc, { segs: 6 }); }
    });
  },
};

/** Reclaimer: a dark tech under a hood, green night-vision eyes, a controller that walks wrecks back into the fight. */
export const grave: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.28);
    const R = p.mix<V3>([0.16, 0.14, 0.6], [0.34, 0.08, 0.7], { wind: [0.06, 0.16, 0.74], cast: [0.14, 0.16, 1.02], castWind: [0.12, 0.14, 0.56] });
    const L = p.mix<V3>([0.2, -0.1, 0.64], [0.22, -0.1, 0.66], { cast: [0.24, -0.08, 0.7] });
    const h = trooper(m, p, { handR: R, handL: L, lunge: 0.2, torso: P.night, legs: P.night, arms: P.night, boots: P.night });
    skirt(m, h, P.night, 0.3, 0.1, 0.17);
    pack(m, h, P.black, 0.09, 0.18, 0.22, null);
    m.at(h.back, () => { m.torus([0.15, 0, 0], [1, 0, 0], 0.07, 0.02, P.rubber, { segs: 12 }); antenna(m, [0.08, -0.06, 0.1], 0.36 + 0.04 * t, p.wave(0.015, 1)); if (t >= 3) antenna(m, [0.08, 0.06, 0.1], 0.3, p.wave(0.015, 1, 0.3)); m.sphere([0.08, -0.06, 0.47 + 0.04 * t], 0.02, P.heal, { segs: 5 }); });
    m.at(h.head, () => { hood(m, P.night); m.decal(0.035, () => { for (const s of [1, -1]) m.sphere([r * 1.15, s * r * 0.34, 0], r * (0.2 + 0.02 * t), P.nvg, { segs: 6 }); }); });
    m.at(h.aim("L", [1, 0, 0.5]), () => { m.box([0.03, 0, 0.01], [0.11, 0.15, 0.014], P.black); m.decal(0.01, () => m.box([0.03, 0, 0.02], [0.09, 0.12, 0.004], t >= 4 ? P.teamGlow : P.heal)); });
    m.at(h.aim("R", norm(p.mix<V3>([0.5, 0, 1], [1, 0, 0.1], { cast: [0, 0, 1] }))), () => {
      m.capsule([-0.06, 0, 0], [0.24, 0, 0], 0.012, P.gun, 0.01, { segs: 5 });
      m.sphere([0.26, 0, 0], 0.03, P.heal, { segs: 6 });
      if (p.hit) { m.sphere([0.26, 0, 0], 0.08, P.heal, { segs: 8 }); arc(m, [0.26, 0, 0], [0.6, 0, -0.3], p.i, P.heal, 0.01); }
    });
    pulse(m, h, p, P.heal, 0.2);
  },
};

/** Engineer: a yellow hard hat, a big wrench, a pack of parts. Builds a sentry and mends machines. */
export const tinker: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.26);
    const c = chop(p), build = p.is("cast");
    const R = build ? p.mix<V3>([0.1, 0.17, 0.56], [0.3, 0.06, 0.34], { castWind: [0.0, 0.2, 0.84] }) : c.hand;
    const aim = build ? norm(p.mix<V3>([0.5, 0.1, 0.85], [0.9, 0, -0.5], { castWind: [-0.4, 0.2, 1] })) : c.aim;
    const h = trooper(m, p, { handR: R, twist: 20, lunge: 0.7, torso: P.grey, legs: P.grey, crouch: build ? 0.15 + 0.35 * Math.max(0, p.blend) : 0.1, pads: P.black });
    carrier(m, h, P.hazard, { pouches: P.greyDk, panel: null });
    m.at(h.back, () => { m.group(() => { m.box([0.09, 0, 0.0], [0.12, 0.2, 0.22 + 0.01 * t], P.crate); for (const y of [-0.05, 0.05]) m.cylinder([0.09, y, 0.11], [0.09, y, 0.22 + 0.02 * t], 0.016, P.steel, 0.016, { segs: 6 }); }); m.decal(0.012, () => m.box([0.152, 0, 0], [0.008, 0.16, 0.1], P.team)); });
    m.at(h.head, () => { m.group(() => { m.ellipsoid([-r * 0.05, 0, r * 0.4], [r * 1.25, r * 1.2, r * 0.95], P.hazard, { segs: 12 }); m.cylinder([r * 0.2, 0, r * 0.3], [r * 0.2, 0, r * 0.4], r * 1.5, P.hazard, r * 1.4, { segs: 12 }); }); m.decal(0.012, () => m.box([-r * 0.05, 0, r * 1.34], [r * 1.6, r * 0.5, r * 0.06], P.team)); if (t >= 2) m.decal(0.02, () => m.sphere([r * 1.25, 0, r * 0.75], r * 0.28, t >= 4 ? P.teamGlow : P.lamp, { segs: 6 })); });
    m.at(h.aim("R", aim), () => tool(m, 0.34 + 0.02 * t, () => m.group(() => { m.box([0.03, 0, 0.03], [0.09, 0.022, 0.035], t >= 3 ? P.steel : P.steelDk); m.box([0.03, 0, -0.03], [0.09, 0.022, 0.035], t >= 3 ? P.steel : P.steelDk); m.box([-0.01, 0, 0], [0.03, 0.022, 0.09], t >= 3 ? P.steel : P.steelDk); }), P.steelDk, 0.014));
    if (p.hit) { const q = h.pt(build ? [0.5, 0.04, 0.12] : [0.5, 0, 0.5]); m.sphere(q, 0.04, P.flashHot, { segs: 6 }); for (let i = 0; i < 5; i++) m.cone(q, [q[0] + Math.cos(i * 1.3) * 0.13, q[1] + Math.sin(i * 1.3) * 0.13, q[2] + 0.06 + 0.03 * i], 0.012, P.flash, { segs: 4 }); }
  },
};

/** Mole: an entrenching tool, a headlamp, a coil of rope. He goes under the line and comes up behind it. */
export const sapper: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, c = chop(p);
    ring(m, p, 0.26);
    const h = trooper(m, p, { handR: c.hand, handL: p.mix<V3>([0.18, -0.06, 0.56], [0.36, -0.02, 0.5], { wind: [-0.02, 0.06, 0.92] }), twist: 22, lunge: 0.9, torso: P.coyote, legs: P.coyoteDk, pads: P.black, crouch: 0.2 });
    carrier(m, h, P.coyoteDk, { pouches: null });
    pack(m, h, P.coyoteDk, 0.07, 0.17, 0.2);
    m.at(h.back, () => m.torus([0.11, 0, -0.02], [1, 0, 0], 0.075, 0.022, P.sand, { segs: 12 }));
    m.at(h.head, () => { helmet(m, P.coyoteDk); m.decal(0.02, () => m.sphere([r * 1.2, 0, r * 0.62], r * (0.3 + 0.04 * t), t >= 4 ? P.teamGlow : P.lamp, { segs: 6 })); });
    m.at(h.aim("R", c.aim), () => tool(m, 0.34 + 0.02 * t, () => m.extrude([[-0.02, -0.055], [0.12, -0.05], [0.19, 0], [0.12, 0.05], [-0.02, 0.055]], 0.012, t >= 3 ? P.steel : P.steelDk), P.wood, 0.014));
    if (p.hit) { puff(m, h.pt([0.5, 0, 0.08]), 0.08, P.dust); for (let i = 0; i < 4; i++) m.sphere(h.pt([0.46 + 0.05 * i, Math.sin(i * 2) * 0.1, 0.16 + 0.05 * i]), 0.022, P.coyoteDk, { segs: 5 }); }
  },
};

/** Wireman: a coil of razor wire on his back and heavy gloves. He sows wire ahead of the enemy. */
export const thorn: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.26);
    const R = p.mix<V3>([0.1, 0.16, 0.58], [0.34, 0.06, 0.7], { wind: [-0.1, 0.2, 0.74] });
    const L = p.mix<V3>([0.18, -0.14, 0.56], [0.2, -0.16, 0.5], { wind: [0.24, -0.1, 0.66] });
    const h = trooper(m, p, { handR: R, handL: L, twist: 20, lunge: 0.4, torso: P.oliveDk, legs: P.olive, hands: P.hazard });
    carrier(m, h, P.web, { pouches: null, panel: null });
    // the coil: loops of bright wire across the back
    m.at(h.back, () => { for (let i = 0; i < 4 + t; i++) m.torus([0.07 + i * 0.022, 0, 0.02], [1, 0.25 * Math.sin(i * 1.7), 0.2 * Math.cos(i * 1.3)], 0.15 + 0.004 * t, 0.008, P.wire, { segs: 16 }); m.decal(0.012, () => m.box([0.05, 0, 0.02], [0.02, 0.1, 0.1], P.team)); });
    m.at(h.head, () => helmet(m, P.oliveDk, { visor: t >= 3 }));
    const wireLoop = (c: V3, rad: number) => { for (let i = 0; i < 3; i++) m.torus([c[0] + i * 0.035, c[1], c[2]], [1, 0.2 * Math.sin(i * 2), 0.2], rad, 0.006, t >= 4 ? P.teamGlow : P.wire, { segs: 12 }); };
    if (!p.after) m.at(h.aim("R", [1, 0, 0]), () => wireLoop([0.02, 0, 0], 0.07));
    else wireLoop(h.pt([0.55 + (p.hit ? 0 : 0.15), 0.02, 0.3 - (p.hit ? 0 : 0.14)]), 0.11);
  },
};

/** Winchman: heavy, a launcher on the shoulder with a hook in its mouth and a cable drum on his back. */
export const hook: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, out = p.is("cast") ? Math.max(0, Math.min(1, p.blend)) : p.hit ? 0.5 : 0;
    ring(m, p, 0.3);
    const R = p.mix<V3>([0.06, 0.13, 0.7], [0.1, 0.12, 0.74], { wind: [0.02, 0.13, 0.72] });
    const L = p.mix<V3>([0.26, 0.06, 0.72], [0.3, 0.07, 0.78], { wind: [0.24, 0.06, 0.74] });
    const h = trooper(m, p, { size: 1.08, bulk: 1.25, weight: "heavy", handR: R, handL: L, lunge: 0.2, recoil: 0.04, torso: P.greyDk, legs: P.greyDk, crouch: 0.2, pads: P.black });
    carrier(m, h, P.armorDk, { thick: 1.3, pouches: null });
    m.at(h.back, () => { m.cylinder([0.1, -0.09, 0], [0.1, 0.09, 0], 0.1, P.steelDk, 0.1, { segs: 12 }); m.decal(0.012, () => m.cylinder([0.1, -0.05, 0], [0.1, 0.05, 0], 0.103, P.team, 0.103, { segs: 12 })); });
    rankKit(m, h, p, P.armorDk);
    m.at(h.head, () => helmet(m, P.greyDk, { visor: true }));
    m.at(gripAim(h.pR, h.pL), () => {
      m.move(0, 0, 0.05);
      const L2 = 0.42 + 0.02 * t, x = L2 + 0.04 + out * 0.9;
      m.group(() => { m.cylinder([-0.22, 0, 0], [L2, 0, 0], 0.05, P.armorDk, 0.045, { segs: 10 }); m.cylinder([L2, 0, 0], [L2 + 0.04, 0, 0], 0.055, P.gun, 0.055, { segs: 10 }); m.box([0.04, 0, -0.06], [0.03, 0.03, 0.08], P.gun); });
      m.decal(0.01, () => m.cylinder([0.2, 0, 0], [0.28, 0, 0], 0.05, t >= 4 ? P.teamGlow : P.team, 0.049, { segs: 10 }));
      if (out > 0) m.capsule([L2, 0, 0], [x, 0, 0], 0.008, P.wire, 0.008, { segs: 4 });
      m.group(() => { m.cone([x, 0, 0], [x + 0.09, 0, 0], 0.022, P.steel, { segs: 6 }); for (let i = 0; i < 3; i++) { const a = i * 2.094; m.tube([[x + 0.02, 0, 0], [x + 0.06, Math.cos(a) * 0.06, Math.sin(a) * 0.06], [x - 0.02, Math.cos(a) * 0.085, Math.sin(a) * 0.085]], 0.009, t >= 3 ? P.steel : P.steelDk, { segs: 4 }); } });
      if (p.hit) flash(m, [L2 + 0.04, 0, 0], 0.7);
    });
  },
};

/** Spoofer: a poncho, a boonie hat and an antenna rig. Throws out dummies that draw fire. */
export const trickster: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.25);
    const R = p.mix<V3>([0.12, 0.14, 0.6], [0.3, 0.08, 0.72], { wind: [0.1, 0.12, 0.7], cast: [0.26, 0.1, 0.96], castWind: [-0.08, 0.18, 0.7] });
    const h = trooper(m, p, { handR: R, handL: p.mix<V3>([0.1, -0.16, 0.56], [0.14, -0.18, 0.6], { cast: [0.2, -0.16, 0.5] }), lunge: 0.2, recoil: 0.015, legs: P.coyoteDk });
    spooferKit(m, h, p, P.tarp, P.team, t >= 4 ? P.teamGlow : P.amber, t);
    m.at(h.aim("R", norm(p.mix<V3>([1, 0, -0.3], [1, 0, 0.05], { cast: [0.6, 0, 0.8] }))), () => {
      if (p.is("cast")) { if (!p.after) m.cylinder([0, 0, 0.02], [0, 0, 0.05], 0.05, P.amber, 0.05, { segs: 8 }); }
      else { pistol(m); if (p.hit) flash(m, [0.12, 0, 0.022], 0.6); }
    });
    if (p.is("cast") && p.after) for (const s of [1, -1]) puff(m, h.pt([0.4, s * 0.3, 0.3]), 0.09, P.smokeLt);
  },
};
function spooferKit(m: Model, h: SoldierRig, p: Pose, cloth: Material, trim: Material | null, light: Material, t: number) {
  m.at(h.chest, () => { m.cone([0, 0, 0.19], [0, 0, 0.19], 0.01, cloth); m.cylinder([-0.01, 0, 0.17], [-0.02, 0, -0.2], 0.1, cloth, 0.21, { segs: 12 }); if (trim) m.decal(0.012, () => m.cylinder([-0.02, 0, -0.14], [-0.02, 0, -0.19], 0.196, trim, 0.21, { segs: 12 })); });
  m.at(h.head, () => boonie(m, cloth, trim));
  m.at(h.back, () => { m.box([0.12, 0, 0.06], [0.07, 0.14, 0.16], P.black); for (const y of [-0.05, 0.05]) antenna(m, [0.12, y, 0.14], 0.34 + 0.03 * t, p.wave(0.015, 1, y)); m.cylinder([0.12, 0, 0.14], [0.12, 0, 0.26], 0.012, P.gun, 0.012, { segs: 5 }); m.cone([0.12, 0, 0.34], [0.12, 0, 0.26], 0.07, P.steelDk, { segs: 10 }); m.sphere([0.12, 0, 0.3], 0.02, light, { segs: 5 }); });
}
/** Dummy: the Spoofer's stand-in. The same outline in one flat pale colour, on a stand. */
export const decoy: UnitDef = {
  weight: "light",
  build(m, p) {
    ring(m, p, 0.25);
    m.group(() => { m.box([0, 0, 0.012], [0.3, 0.04, 0.024], P.wood); m.box([0, 0, 0.012], [0.04, 0.3, 0.024], P.wood); });
    const h = trooper(m, p, { skin: P.dummy, torso: P.dummy, legs: P.dummy, boots: P.dummy, hands: P.dummy, arms: P.dummy, band: undefined, lunge: 0, swingR: 0, swingL: 0, handR: [0.12, 0.14, 0.6], handL: [0.1, -0.16, 0.56] });
    spooferKit(m, h, p, P.dummy, null, P.dummyDk, 1);
    m.at(h.chest, () => m.decal(0.02, () => { for (const z of [-0.1, 0.0, 0.1]) m.cylinder([-0.015, 0, z], [-0.015, 0, z + 0.012], 0.11 + (0.1 - z) * 0.37, P.dummyDk, 0.11 + (0.1 - z - 0.012) * 0.37, { segs: 12 }); }));
    if (p.hit) puff(m, h.pt([0.2, 0, 0.6]), 0.05, P.smokeLt);
  },
};

/** Major: the hero. Taller, a long coat and a beret, a pistol raised; the squad rallies to him. */
export const lion: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.3);
    const R = p.mix<V3>([0.16, 0.12, 0.66], [0.36, 0.08, 0.8], { wind: [0.2, 0.1, 0.84], cast: [0.1, 0.16, 1.06], castWind: [0.1, 0.14, 0.6] });
    const L = p.mix<V3>([0.06, -0.17, 0.5], [0.1, -0.2, 0.52], { cast: [0.3, -0.12, 0.76], castWind: [0.0, -0.18, 0.5] });
    const h = trooper(m, p, { size: 1.17, bulk: 1.1, handR: R, handL: L, lunge: 0.25, recoil: 0.02, torso: P.coat, legs: P.greyDk, arms: P.coat });
    skirt(m, h, P.coat, 0.32, 0.105, 0.17);
    carrier(m, h, P.black, { pouches: null });
    m.at(h.chest, () => { for (const s of [1, -1]) { m.box([0, s * 0.13 * h.bulk, 0.14], [0.08, 0.07, 0.02], t >= 4 ? P.teamGlow : P.team); if (t >= 2) m.decal(0.01, () => m.box([0, s * 0.13 * h.bulk, 0.152], [0.06, 0.02, 0.006], P.brass)); } m.decal(0.016, () => m.poly([[0.086, 0.09, 0.14], [0.086, 0.05, 0.14], [0.086, -0.1, -0.08], [0.086, -0.06, -0.08]], P.team)); if (t >= 3) m.tube([[0.08, 0.1, 0.1], [0.1, 0.06, 0.02], [0.08, 0.03, 0.1]], 0.007, P.brass, { segs: 4 }); });
    m.at(h.head, () => beret(m, P.team, t >= 4 ? P.teamGlow : P.brass));
    m.at(h.aim("R", norm(p.mix<V3>([0.8, 0, 0.6], [1, 0, 0.05], { wind: [0.6, 0, 0.8], cast: [0, 0, 1] }))), () => {
      pistol(m, t >= 3 ? P.steel : P.gun);
      if (p.hit) flash(m, [0.12, 0, 0.022], p.is("cast") ? 1.1 : 0.75);
      if (p.is("cast") && p.after) m.sphere([0.3 + (p.hit ? 0 : 0.2), 0, 0.02], 0.05, P.teamGlow, { segs: 6 });
    });
    pulse(m, h, p, P.ring, 0.6);
    pulse(m, h, p, P.ringLt, 0.9);
  },
};

/** Scrapbot: a thin walking frame the Reclaimer builds from a wreck. */
export const thrall: UnitDef = {
  weight: "light",
  build(m, p) {
    ring(m, p, 0.22);
    const R = p.mix<V3>([0.14, 0.14, 0.56], [0.36, 0.06, 0.66], { wind: [0.0, 0.18, 0.76] });
    const L = p.mix<V3>([0.14, -0.14, 0.56], [0.3, -0.08, 0.6], { wind: [0.06, -0.18, 0.66] });
    const h = trooper(m, p, { size: 0.94, bulk: 0.7, handR: R, handL: L, lunge: 0.8, twist: 14, skin: P.steelDk, torso: P.rust, legs: P.steelDk, arms: P.steelDk, hands: P.gun, boots: P.gun, noHead: true, crouch: 0.2, swingR: 0.6, swingL: 0.6 });
    m.at(h.chest, () => { m.box([0, 0, 0.04], [0.11, 0.17, 0.17], P.rust); m.decal(0.012, () => m.box([0.058, 0, 0.05], [0.006, 0.1, 0.06], P.team)); m.box([-0.07, 0, 0.04], [0.05, 0.12, 0.13], P.gun); });
    m.at(h.head, () => { m.box([0.01, 0, 0], [0.11, 0.09, 0.07], P.gun); m.decal(0.02, () => m.sphere([0.07, 0, 0], 0.024, P.nvg, { segs: 6 })); antenna(m, [-0.03, 0.03, 0.03], 0.14, p.wave(0.01, 2)); });
    for (const hd of ["R", "L"] as const) m.at(h.aim(hd, [1, 0, -0.2]), () => { for (const s of [1, -1]) m.capsule([0, 0, 0], [0.09, s * 0.025, 0], 0.008, P.steel, 0.005, { segs: 4 }); });
    if (p.hit) m.sphere(h.pt([0.48, 0, 0.64]), 0.035, P.flashHot, { segs: 5 });
  },
};

// ------------------------------------------------------------------------------------------------ dogs
/** K9 Pack: three attack dogs in the side's vests. Small, quick, on you before you turn. */
export const blades: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.2);
    const q = quadruped(m, p, { size: 0.8 + 0.02 * t, weight: "light", height: 0.3, length: 0.2, width: 0.07, legs: P.dog, hooves: P.dogDk, legR: 0.022, stride: 0.66, lunge: 1.2 });
    const jaw = p.mix(4, 2, { wind: 26 });
    m.at(q.body, () => {
      m.group(() => {
        m.ellipsoid([0, 0, 0], [0.22, 0.075, 0.085], P.dog, { segs: 10 });
        m.ellipsoid([0.12, 0, 0.01], [0.11, 0.08, 0.095], P.dog, { segs: 10 });
        m.capsule([0.18, 0, 0.04], [0.28, 0, 0.13], 0.055, P.dog, 0.045, { segs: 8 });
        m.ellipsoid([0.31, 0, 0.15], [0.06, 0.05, 0.05], P.dog, { segs: 8 });
        m.capsule([0.34, 0, 0.14], [0.42, 0, 0.125], 0.03, P.dogDk, 0.022, { segs: 6 });
        for (const s of [1, -1]) m.cone([0.28, s * 0.035, 0.18], [0.27, s * 0.045, 0.25], 0.022, P.dogDk, { segs: 4 });
        m.tube([[-0.2, 0, 0.03], [-0.3, 0, 0.06 + p.wave(0.02, 2)], [-0.38, 0, 0.0 + p.wave(0.03, 2)]], [0.02, 0.016, 0.008], P.dogDk, { segs: 5 });
      });
      m.with(() => { m.move(0.34, 0, 0.125).rotY(jaw); m.capsule([0, 0, -0.012], [0.07, 0, -0.02], 0.016, P.dogDk, 0.012, { segs: 5 }); });
      // the vest: the side's colour over the back, a handle and (rank 4) a light
      m.decal(0.012, () => m.ellipsoid([0.02, 0, 0.012], [0.13, 0.08, 0.085], P.team, { segs: 10 }));
      m.decal(0.02, () => m.box([0.02, 0, 0.1], [0.08, 0.02, 0.016], P.black));
      if (t >= 2) m.decal(0.02, () => m.torus([0.2, 0, 0.06], [1, 0, 0.6], 0.055, 0.012, t >= 3 ? P.steel : P.black, { segs: 10 }));
      if (t >= 4) m.decal(0.025, () => m.sphere([-0.06, 0, 0.1], 0.02, P.teamGlow, { segs: 5 }));
    });
  },
};
