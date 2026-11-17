// Blackridge's soldiers on foot. Realistic proportions, neutral fatigues, one large prop that names the job from
// above, and the side carried by the ring, the helmet band, armbands and a recognition panel on the back.
import { gripAim, type Pose, type UnitDef } from "../../../artkit/rig";
import { norm, type V3 } from "../../../artkit/toon3d";
import { P, carrier, flash, helmet, pack, r, rankKit, rifle, ring, trooper } from "./parts";

/** Rifle hands: low ready at rest, shouldered through the shot. */
const gunR = (p: Pose): V3 => p.mix<V3>([0.1, 0.07, 0.6], [0.12, 0.06, 0.69], { wind: [0.1, 0.065, 0.67] });
const gunL = (p: Pose): V3 => p.mix<V3>([0.26, 0.0, 0.55], [0.29, 0.015, 0.705], { wind: [0.28, 0.01, 0.69] });

// ------------------------------------------------------------------------------------------------ shooters
/** Rifleman: helmet, plate carrier, carbine shouldered. The line infantry. */
export const ranger: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.25);
    const h = trooper(m, p, { handR: gunR(p), handL: gunL(p), lunge: 0, recoil: 0.02, crouch: 0.15, pads: P.black });
    carrier(m, h, P.coyoteDk);
    rankKit(m, h, p);
    if (t >= 3) pack(m, h, P.coyoteDk, 0.07, 0.15, 0.17);
    m.at(h.head, () => helmet(m, P.olive, { nvg: t >= 2, nvgOn: t >= 4 }));
    m.at(gripAim(h.pR, h.pL), () => { const L = rifle(m, t); if (p.hit) flash(m, [L, 0, 0.026], 1); });
  },
};

/** Shieldman: a big man in heavy armour behind a tall ballistic shield with the side's panel across it. */
export const bulwark: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.4);
    const L = p.mix<V3>([0.2, -0.06, 0.62], [0.3, -0.03, 0.64], { wind: [0.14, -0.08, 0.62] });
    const R = p.mix<V3>([0.06, 0.2, 0.52], [0.3, 0.14, 0.7], { wind: [-0.06, 0.22, 0.74] });
    const h = trooper(m, p, { size: 1.14, bulk: 1.34, weight: "heavy", torso: P.greyDk, legs: P.greyDk, arms: P.greyDk, handL: L, handR: R, lunge: 0.6, crouch: 0.2, pads: P.black });
    carrier(m, h, P.black, { thick: 1.5, pouches: P.greyDk });
    m.at(h.chest, () => { for (const s of [1, -1]) m.ellipsoid([0, s * 0.165, 0.125], [0.075, 0.065, 0.055], P.black, { segs: 8 }); m.box([0.02, 0, 0.19], [0.1, 0.2, 0.07], P.black); });
    m.at(h.head, () => helmet(m, P.black, { visor: true, k: 1.12 }));
    m.at(h.aim("L", [1, 0, 0]), () => {
      m.move(0.045, 0.05, -0.12);
      const W = 0.5 + 0.02 * t, H = 0.84 + 0.03 * t;
      m.group(() => { m.box([0, 0, 0], [0.035, W, H], P.armorDk); m.box([-0.012, 0, 0], [0.03, W * 0.84, H * 0.9], P.black); });
      m.decal(0.012, () => { m.box([0.02, 0, -H * 0.06], [0.012, W * 0.92, H * 0.3], P.team); m.box([0.02, 0, H * 0.31], [0.012, W * 0.6, H * 0.1], P.glass); });
      if (t >= 2) m.decal(0.014, () => { for (const z of [-H * 0.36, H * 0.44]) m.box([0.02, 0, z], [0.012, W * 0.92, 0.03], t >= 3 ? P.steel : P.steelDk); });
      if (t >= 4) m.decal(0.02, () => m.box([0.022, 0, -H * 0.06], [0.012, W * 0.96, 0.03], P.teamGlow));
      if (p.hit) flash(m, [0.06, 0.02, 0.1], 0.6);
    });
    m.at(h.aim("R", norm(p.mix<V3>([0.3, 0.1, -1], [1, -0.1, 0.1], { wind: [-0.2, 0.2, 1] }))), () => { m.capsule([-0.03, 0, 0], [0.36, 0, 0], 0.016, P.rubber, 0.02, { segs: 6 }); m.capsule([0.02, 0, 0], [0.02, -0.07, 0], 0.012, P.rubber, 0.012, { segs: 5 }); });
  },
};

/** Corpsman: pale helmet and pack, an aid bag in one hand, a green chem-light; a green burst on the heal. */
export const medic: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    ring(m, p, 0.25);
    const R = p.mix<V3>([0.1, 0.16, 0.5], [0.26, 0.1, 0.62], { wind: [0.04, 0.18, 0.56], cast: [0.2, 0.12, 0.92], castWind: [0.08, 0.16, 0.5] });
    const L = p.mix<V3>([0.06, -0.17, 0.42], [0.1, -0.17, 0.44], { cast: [0.12, -0.2, 0.6] });
    const h = trooper(m, p, { handR: R, handL: L, torso: P.sand, legs: P.sand, lunge: 0.3 });
    carrier(m, h, P.white, { pouches: P.white, panel: null });
    pack(m, h, P.white, 0.1, 0.19, 0.25, null);
    m.at(h.back, () => m.decal(0.02, () => { m.box([0.135, 0, 0], [0.01, 0.13, 0.045], P.healLamp); m.box([0.135, 0, 0], [0.01, 0.045, 0.13], P.healLamp); m.box([0.08, 0, 0.13], [0.07, 0.11, 0.01], P.healLamp); }));
    rankKit(m, h, p, P.white);
    m.at(h.head, () => { helmet(m, P.white); m.decal(0.03, () => { m.box([-r * 0.2, 0, r * 1.36], [r * 0.95, r * 0.32, r * 0.05], P.healLamp); m.box([-r * 0.2, 0, r * 1.36], [r * 0.32, r * 0.95, r * 0.05], P.healLamp); }); });
    // the aid bag in the left hand, an auto-injector in the right
    m.at(h.aim("L", [1, 0, 0]), () => m.group(() => { m.box([0, 0, -0.08], [0.16 + 0.01 * t, 0.08, 0.11], P.white); m.decal(0.01, () => { m.box([0, 0.042, -0.08], [0.07, 0.006, 0.025], P.healLamp); m.box([0, 0.042, -0.08], [0.025, 0.006, 0.07], P.healLamp); }); }));
    m.at(h.aim("R", norm(p.mix<V3>([0.4, 0, 1], [1, 0, 0.1], { cast: [0, 0, 1] }))), () => {
      m.capsule([-0.02, 0, 0], [0.12, 0, 0], 0.016, t >= 4 ? P.teamGlow : P.heal, 0.012, { segs: 6 });
      if (p.hit) m.sphere([0.18, 0, 0], 0.06, P.heal, { segs: 8 });
    });
    if (p.is("cast") && p.blend > 0.3) m.torus(h.pt([0.1, 0, 0.5 + 0.2 * p.blend]), [0, 0, 1], 0.2 + 0.14 * p.blend, 0.018, P.heal, { segs: 16 });
  },
};
