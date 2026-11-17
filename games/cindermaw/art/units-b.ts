// Hellspawn, mounts and machines. Ash hide, bone and char for bodies, gunmetal for machines; the side burns in the
// eyes, wings, plates and pustules.
import { crawler, flyer, gripAim, quadruped, structure, type Pose, type UnitDef } from "../../../artkit/rig";
import { Model, norm, type Material, type V3 } from "../../../artkit/toon3d";
import { P, R, blade, boneBlade, burst, cape, chop, cleaver, eyes, fiend, flash, glint, gun, helmet, horns, offHand, pads, pike, poleHand, puff, rank, robe, skull, slashArc, staff, trim, trooper } from "./parts";

const r = R;

/** A membrane wing in the local x-y plane, reaching out along sign `s` * y. */
function wing(m: Model, s: number, span: number, col: Material, bone: Material) {
  m.poly([[0.12, 0, 0], [0.2, s * span * 0.5, 0], [0.06, s * span, 0], [-0.06, s * span * 0.72, 0], [-0.02, s * span * 0.5, 0], [-0.2, s * span * 0.34, 0], [-0.1, s * span * 0.16, 0], [-0.18, 0, 0]], col);
  m.tube([[0.12, 0, 0.006], [0.2, s * span * 0.5, 0.006], [0.06, s * span, 0.006]], [0.026, 0.02, 0.008], bone, { segs: 4 });
  m.tube([[0.2, s * span * 0.5, 0.006], [-0.02, s * span * 0.5, 0.006]], 0.01, bone, { segs: 3 });
}

/** Gnashers: three small hunched imps with bone claws. */
export const blades: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const Rh = p.mix<V3>([0.2, 0.2, 0.34], [0.42, 0.04, 0.36], { wind: [-0.04, 0.26, 0.6] });
    const Lh = p.mix<V3>([0.2, -0.2, 0.34], [0.34, -0.1, 0.3], { wind: [0.06, -0.26, 0.46] });
    const h = fiend(m, p, { weight: "light", size: 0.84, bulk: 1.0, handR: Rh, handL: Lh, twist: 26, lean: 18, lunge: 1.1, torso: P.hide, legs: P.hideDk });
    m.at(h.back, () => { for (const z of [0.12, 0.0, -0.12]) m.cone([0.02, 0, z], [0.16, 0, z + 0.08], 0.05, P.team, { segs: 4 }); });
    m.at(h.chest, () => { for (const s of [1, -1]) m.cone([0, s * 0.2, 0.14], [-0.02, s * 0.32, 0.26], 0.05, P.team, { segs: 4 }); });
    m.at(h.head, () => { eyes(m, r, t >= 4 ? P.glory : P.visor); horns(m, r, t >= 3 ? P.brass : P.bone, 0.6, 0.6, 0.26); if (t >= 2) rank(m, p); });
    for (const [fr, s] of [[h.handR, 1], [h.handL, -1]] as const) m.at(fr, () => { for (const y of [-0.035, 0, 0.035]) m.cone([0.02, y, 0], [0.16 + 0.01 * t, y * 1.6, -0.03 * s], 0.016, blade(t, P.bone), { segs: 3 }); });
    if (p.hit) { slashArc(m, h, [0.05, 0, 0.36], 0.42, 70, -45, -0.25); slashArc(m, h, [0.05, 0, 0.3], 0.36, 60, -40, -0.2); }
  },
};

/** Flayer: a thin black hellspawn with two long bone blades. The side shows only in its eyes and spine. */
export const shade: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const Rh = p.mix<V3>([0.14, 0.22, 0.36], [0.38, 0.06, 0.44], { wind: [-0.08, 0.26, 0.52] });
    const Lh = p.mix<V3>([0.14, -0.22, 0.36], [0.3, -0.1, 0.36], { wind: [0.02, -0.26, 0.44] });
    const aR = norm(p.mix<V3>([0.6, 0, 0.8], [1, -0.2, -0.1], { wind: [-0.3, 0.2, 1] })), aL = norm(p.mix<V3>([0.6, 0, 0.8], [1, 0.2, 0.1], { wind: [0.2, -0.2, 1] }));
    const h = fiend(m, p, { weight: "light", bulk: 0.82, leg: 1.08, handR: Rh, handL: Lh, twist: 22, lunge: 1.1, lean: 16, skin: P.char, torso: P.char, arms: P.char, legs: P.char, boots: P.black, hands: P.black, swingR: 0.5, swingL: 0.5 });
    m.at(h.back, () => { for (const z of [0.14, 0.04, -0.06]) m.cone([0.02, 0, z], [0.13, 0, z + 0.05], 0.035, P.teamDk, { segs: 4 }); });
    m.at(h.head, () => { eyes(m, r, t >= 4 ? P.glory : P.visor, null); m.cone([-r * 0.4, 0, r * 0.7], [-r * 1.6, 0, r * 1.5], r * 0.5, P.char, { segs: 5 }); if (t >= 2) rank(m, p, r * 1.1); });
    m.at(h.aim("R", aR), () => boneBlade(m, 0.4 + 0.02 * t, blade(t, P.bone)));
    m.at(h.aim("L", aL), () => boneBlade(m, 0.4 + 0.02 * t, blade(t, P.bone)));
    if (p.hit) { slashArc(m, h, [0.1, 0, 0.4], 0.46, 60, -30, -0.2); slashArc(m, h, [0.1, 0, 0.36], 0.4, -60, 20, 0.2); }
  },
};

/** A gore-beast on the quadruped rig: a barrel body, a low horned head, a side-colour saddle cloth. */
function beast(m: Model, body: number[], L: number, W: number, t: number) {
  m.at(body, () => {
    m.group(() => {
      m.ellipsoid([0, 0, 0], [L * 1.15, W * 1.25, 0.16], P.hide, { segs: 8 });
      m.ellipsoid([L * 0.75, 0, 0.06], [0.16, W * 1.35, 0.17], P.hideDk, { segs: 8 });
      m.box([L + 0.2, 0, 0.0], [0.24, 0.2, 0.17], P.hide);
    });
    for (const s of [1, -1]) m.tube([[L + 0.16, s * 0.09, 0.08], [L + 0.3, s * 0.2, 0.12], [L + 0.46, s * 0.14, 0.2]], [0.045, 0.035, 0.008], t >= 3 ? P.brass : P.bone, { segs: 5 });
    m.decal(0.03, () => { for (const s of [1, -1]) m.box([L + 0.31, s * 0.07, 0.04], [0.03, 0.05, 0.04], t >= 4 ? P.glory : P.visor); });
    m.tube([[-L, 0, 0.04], [-L - 0.14, 0, 0.1], [-L - 0.24, 0, 0.0]], [0.04, 0.03, 0.01], P.hideDk, { segs: 4 });
    m.decal(0.015, () => m.cylinder([-L * 0.5, 0, 0], [L * 0.4, 0, 0], 0.175, P.teamFlat, 0.175, { segs: 8 }));
  });
}

/** Ramrider: a marine with a levelled pike on a horned gore-beast. Charges through lines. */
export const lancer: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { size: 1.0, height: 0.38, length: 0.27, width: 0.13, legs: P.hideDk, hooves: P.black, legR: 0.05, stride: 0.62 });
    beast(m, q.body, 0.27, 0.13, t);
    m.at(q.saddle, () => {
      const Rh = p.mix<V3>([0.1, 0.22, 0.36], [0.3, 0.18, 0.36], { wind: [-0.02, 0.24, 0.4] });
      const h = trooper(m, p, { seated: true, size: 0.82, handR: Rh, handL: [0.2, -0.08, 0.3], lunge: 0 });
      pads(m, h);
      m.at(h.head, () => { helmet(m, r, t >= 3 ? P.brass : P.armor); if (t >= 2) rank(m, p); });
      m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.5], [1, -0.06, 0.02], { wind: [1, 0, 0.3] }))), () => {
        const L = 0.85 + 0.05 * t;
        pike(m, 0.3, L, blade(t), 0.022);
        m.decal(0.01, () => m.box([L - 0.16, 0, -0.09], [0.24, 0.02, 0.16], P.teamFlat));
        if (p.hit) glint(m, [L + 0.24, 0, 0], 0.05);
      });
    });
  },
};

/** Outrunner: a marine gunner on a fast bike. Circles and shoots. */
export const outrider: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { size: 0.95, weight: "mid", height: 0.26, length: 0.3, width: 0.1, legs: P.black, hooves: P.black, noLegs: true, stride: 0.7, lunge: 0.3 });
    m.at(q.body, () => {
      for (const x of [0.33, -0.33]) m.with(() => { m.move(x, 0, -0.08).rotY(q.spin); m.cylinder([0, -0.045, 0], [0, 0.045, 0], 0.17, P.rubber, 0.17, { segs: 10 }); m.decal(0.01, () => { m.cylinder([0, -0.05, 0], [0, 0.05, 0], 0.07, trim(t), 0.07, { segs: 6 }); m.box([0, 0, 0], [0.3, 0.104, 0.03], P.ironDk); }); });
      m.group(() => { m.box([0, 0, 0.04], [0.5, 0.12, 0.14], P.ironDk); m.box([-0.2, 0, 0.12], [0.24, 0.14, 0.06], P.black); });
      m.box([0.14, 0, 0.14], [0.26, 0.17, 0.1], P.teamFlat);
      m.tube([[0.26, 0, 0.14], [0.33, 0, -0.08]], 0.025, P.steel, { segs: 4 });
      m.box([0.24, 0, 0.26], [0.03, 0.34, 0.03], P.ironDk);
      m.decal(0.04, () => m.sphere([0.3, 0, 0.2], 0.045, P.lamp, { segs: 5 }));
      for (const s of [1, -1]) m.cylinder([-0.34, s * 0.07, 0.0], [-0.5, s * 0.08, 0.04], 0.025, trim(t), 0.03, { segs: 5 });
    });
    m.at(q.saddle, () => {
      m.move(-0.1, 0, -0.04);
      const Rh = p.mix<V3>([0.26, 0.14, 0.42], [0.34, 0.12, 0.46], { wind: [0.2, 0.14, 0.46] });
      const h = trooper(m, p, { seated: true, size: 0.82, handR: Rh, handL: [0.3, -0.14, 0.3], lunge: 0, recoil: 0.03, lean: 14 });
      pads(m, h);
      m.at(h.head, () => { helmet(m, r, t >= 3 ? P.brass : P.ironDk); if (t >= 2) rank(m, p); });
      m.at(h.aim("R", [1, 0, 0.02]), () => { gun(m, 0.36 + 0.02 * t, { stock: false, barrel: blade(t, P.iron) }); if (p.hit) flash(m, [0.38, 0, 0.01], 0.06); });
    });
  },
};

/** Shrieker: a flying horned skull on wide wings in the side's colour. */
export const harrier: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.22 });
    m.at(f.body, () => {
      skull(m, 0.15, t >= 4 ? P.glory : P.visor, t >= 3 ? P.brass : P.bone);
      horns(m, 0.15, P.boneDk, 0.7, 1.2, 0.3);
      m.tube([[-0.14, 0, 0], [-0.3, 0, 0.04], [-0.44, 0, -0.04]], [0.07, 0.04, 0.01], P.boneDk, { segs: 5 });
      const ang = 8 + 36 * f.flap, span = 0.6 + 0.03 * t;
      for (const s of [1, -1]) m.with(() => { m.move(-0.04, s * 0.1, 0.03).rotX(-s * ang); wing(m, s, span, P.team, t >= 2 ? trim(t) : P.teamDk); });
      if (p.hit) { glint(m, [0.34, 0, -0.08], 0.05); m.cone([0.16, 0, -0.08], [0.4, 0, -0.14], 0.06, P.fire, { segs: 5 }); }
    });
  },
};

/** Hellwing Lancer: an armoured rider with a lance on a winged fiend. Dives and stuns. */
export const griffin: UnitDef = {
  weight: "heavy", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.22, lunge: 1.3 });
    m.at(f.body, () => {
      m.group(() => {
        m.ellipsoid([0, 0, 0], [0.32, 0.16, 0.14], P.hideDk, { segs: 8 });
        m.tube([[0.24, 0, 0.04], [0.4, 0, 0.12]], [0.1, 0.085], P.hideDk, { segs: 6 });
        m.tube([[-0.26, 0, 0], [-0.5, 0, 0.04], [-0.7, 0, -0.02]], [0.09, 0.05, 0.012], P.hideDk, { segs: 5 });
      });
      m.with(() => { m.move(0.5, 0, 0.14); skull(m, 0.11, t >= 4 ? P.glory : P.visor, P.boneDk); horns(m, 0.11, P.bone, 0.9, 1.4, 0.3); });
      const ang = 6 + 34 * f.flap, span = 0.74 + 0.03 * t;
      for (const s of [1, -1]) m.with(() => { m.move(0.04, s * 0.12, 0.06).rotX(-s * ang); wing(m, s, span, P.team, t >= 2 ? trim(t) : P.teamDk); });
      m.with(() => {
        m.move(-0.04, 0, 0.06);
        const Rh = p.mix<V3>([0.1, 0.22, 0.36], [0.3, 0.18, 0.34], { wind: [-0.02, 0.24, 0.42] });
        const h = trooper(m, p, { seated: true, size: 0.76, torso: P.iron, handR: Rh, handL: [0.2, -0.08, 0.3], lunge: 0 });
        pads(m, h, t >= 3 ? P.brass : P.steel, 1.1);
        m.at(h.head, () => { helmet(m, r, t >= 3 ? P.brass : P.steel, { fin: P.team, stripe: null }); });
        m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.4], [1, -0.05, -0.3], { wind: [1, 0, 0.5] }))), () => { pike(m, 0.25, 0.72 + 0.04 * t, blade(t), 0.024); if (p.hit) glint(m, [1.0, 0, 0], 0.06); });
      });
    });
  },
};

/** Gorebrute: a hulking horned hellspawn with a huge cleaver. */
export const ravager: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const Rh = p.mix<V3>([0.1, 0.14, 0.4], [0.3, 0.08, 0.3], { wind: [-0.06, 0.16, 0.62] });
    const Lh = p.mix<V3>([0.24, -0.04, 0.54], [0.5, 0.0, 0.16], { wind: [-0.14, 0.02, 0.86] });
    const h = fiend(m, p, { weight: "heavy", size: 1.16, bulk: 1.42, handR: Rh, handL: Lh, twist: 30, lunge: 1.1, torso: P.hide, arms: P.hide, legs: P.hideDk, head: r * 0.95 });
    m.at(h.hips, () => m.cylinder([0, 0, 0.12], [0, 0, -0.08], 0.2, P.teamFlat, 0.25, { segs: 8 }));
    m.at(h.chest, () => { for (const s of [1, -1]) { m.ellipsoid([0, s * 0.3, 0.15], [0.13, 0.12, 0.09], P.team, { segs: 8 }); m.cone([0, s * 0.32, 0.2], [-0.02, s * 0.44, 0.36], 0.045, trim(t), { segs: 4 }); } m.decal(0.02, () => m.box([0.16, 0, 0.02], [0.03, 0.3, 0.05], P.hideDk)); });
    m.at(h.head, () => { eyes(m, r, t >= 4 ? P.glory : P.visor); horns(m, r, t >= 3 ? P.brass : P.bone, 1.1, -0.5, 0.42); m.decal(0.03, () => m.box([r * 0.9, 0, -r * 0.55], [r * 0.3, r * 1.0, r * 0.3], P.tooth)); if (t >= 2) rank(m, p, r * 1.2); });
    m.at(gripAim(h.pR, h.pL), () => cleaver(m, 0.56 + 0.02 * t, blade(t, P.iron), 0.3));
    if (p.hit) slashArc(m, h, [0.1, 0, 0.4], 0.66, 80, -60, -0.4);
  },
};

/** Meathook: a heavy butcher with a hook and chain on a launcher arm. The cast flings it. */
export const hook: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, fl = p.is("cast") ? p.mix(0, 1, { castWind: -0.2 }) : p.mix(0, 0.45, { wind: -0.15 });
    const Rh = p.mix<V3>([0.16, 0.26, 0.4], [0.4, 0.14, 0.5], { wind: [-0.1, 0.3, 0.6], cast: [0.42, 0.12, 0.54], castWind: [-0.14, 0.3, 0.62] });
    const h = fiend(m, p, { weight: "heavy", size: 1.18, bulk: 1.4, handR: Rh, twist: 20, torso: P.hideLt, arms: P.hideLt, legs: P.cloth, boots: P.black, hands: P.hideDk, lunge: 0.5 });
    m.at(h.chest, () => { m.decal(0.02, () => m.box([0.13, 0, -0.06], [0.06, 0.3, 0.44], P.leather)); m.ellipsoid([0, 0.3, 0.15], [0.14, 0.13, 0.1], P.team, { segs: 8 }); m.ellipsoid([0, -0.3, 0.15], [0.12, 0.11, 0.08], P.team, { segs: 8 }); });
    m.at(h.head, () => { helmet(m, r, t >= 3 ? P.brass : P.rust, { stripe: P.team }); if (t >= 2) rank(m, p); });
    m.at(h.aim("R", norm(p.mix<V3>([0.7, 0.1, -0.7], [1, 0, 0], { wind: [-0.4, 0.2, 0.9], cast: [1, 0, 0.05], castWind: [-0.5, 0.2, 0.8] }))), () => {
      const len = 0.16 + 0.9 * Math.max(0, fl);
      m.cylinder([-0.12, 0, 0], [0.08, 0, 0], 0.07, P.ironDk, 0.06, { segs: 6 });
      m.group(() => { for (let x = 0.1; x < len; x += 0.08) m.torus([x, 0, 0], [0, (x * 12.5) % 2 < 1 ? 1 : 0, (x * 12.5) % 2 < 1 ? 0 : 1], 0.03, 0.011, P.iron); });
      m.with(() => { m.move(len, 0, 0); m.tube([[0, 0, 0], [0.12, 0, 0], [0.2, 0, -0.08], [0.16, 0, -0.18], [0.06, 0, -0.16]], [0.025, 0.025, 0.022, 0.018, 0.006], blade(t), { segs: 5 }); });
      if (p.hit) glint(m, [len + 0.22, 0, 0], 0.05);
    });
  },
};

/** Bone Priest: tall and hooded, a skull for a face, a staff burning green. The cast raises the fallen. */
export const grave: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, Rh = poleHand(p);
    const h = fiend(m, p, { weight: "mid", size: 1.08, bulk: 0.92, leg: 1.06, handR: Rh, handL: offHand(p), lunge: 0, torso: P.coat, arms: P.coat, legs: P.coat, boots: P.black, hands: P.bone, swingR: 0 });
    robe(m, h, P.coat, 0.25, 0.3);
    m.at(h.chest, () => m.cylinder([0, 0, 0.06], [0, 0, 0.2], 0.3, P.team, 0.16, { segs: 10 }));
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([-r * 0.2, 0, r * 0.15], [r * 1.25, r * 1.2, r * 1.25], P.coat, { segs: 10 }); m.cone([-r * 0.6, 0, r * 0.8], [-r * 1.7, 0, r * 1.5], r * 0.6, P.coat, { segs: 6 }); });
      m.decal(0.03, () => m.ellipsoid([r * 0.5, 0, -r * 0.1], [r * 0.7, r * 0.75, r * 0.8], P.bone, { segs: 8 }));
      m.decal(0.06, () => { for (const s of [1, -1]) m.box([r * 1.1, s * r * 0.3, r * 0.05], [r * 0.2, r * 0.34, r * 0.32], t >= 4 ? P.glory : P.ghost); });
      rank(m, p, r * 1.5);
    });
    m.at(h.aim("R", [0.12, 0, 1]), () => {
      const top = 0.6 + 0.03 * t, k = 1 + 0.2 * Math.sin(p.i * 2.2) + (p.is("cast") && p.after ? 0.9 : 0);
      m.cylinder([-0.4, 0, 0], [top, 0, 0], 0.018, t >= 3 ? P.brass : P.boneDk, 0.018, { segs: 5 });
      m.with(() => { m.move(top + 0.06, 0, 0).rotY(-90); skull(m, 0.07, P.ghost, P.bone); });
      m.group(() => { m.cone([top + 0.1, 0, 0], [top + 0.1 + 0.24 * k, 0, 0], 0.07 * k, P.ghost, { segs: 5 }); });
      if (p.hit && !p.is("cast")) m.cone([top, 0, -0.1], [top - 0.1, 0, -0.7], 0.05, P.ghost, { segs: 5 });
    });
    if (p.is("cast") && p.after) for (const a of [0.5, 2.6, 4.7]) m.cone(h.pt([0.5 + Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0]), h.pt([0.5 + Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.4]), 0.06, P.ghost, { segs: 5 });
  },
};

/** The Deceiver's body, real or (ghost) a hollow flickering copy. */
function deceiver(m: Model, p: Pose, ghost: boolean) {
  const t = p.tier, G = ghost ? (p.i % 2 ? P.teamLt : P.gloryInk) : null;
  const skin = G ?? P.hideDk, hornC = G ?? (t >= 3 ? P.brass : P.bone);
  const Rh = p.mix<V3>([0.14, 0.22, 0.44], [0.4, 0.1, 0.56], { wind: [-0.06, 0.26, 0.66], cast: [0.2, 0.26, 0.78], castWind: [0.1, 0.2, 0.4] });
  const Lh = p.mix<V3>([0.14, -0.22, 0.4], [0.2, -0.24, 0.5], { wind: [0.1, -0.22, 0.4], cast: [0.2, -0.26, 0.78], castWind: [0.1, -0.2, 0.4] });
  const h = fiend(m, p, { weight: "light", bulk: 0.88, leg: 1.05, handR: Rh, handL: Lh, twist: 18, lunge: 0.5, skin, torso: skin, arms: skin, legs: G ?? P.char, boots: G ?? P.black, hands: skin });
  cape(m, h, p, G ?? P.teamFlat, 0.52, 0.24);
  m.at(h.chest, () => m.cylinder([0, 0, 0.1], [0, 0, 0.2], 0.25, G ?? P.team, 0.14, { segs: 8 }));
  m.at(h.head, () => {
    if (!ghost) eyes(m, r, t >= 4 ? P.glory : P.visor); else m.decal(0.05, () => { for (const s of [1, -1]) m.box([r * 0.97, s * r * 0.42, r * 0.08], [r * 0.24, r * 0.44, r * 0.3], P.black); });
    for (const s of [1, -1]) m.tube([[0, s * r * 0.7, r * 0.6], [-r * 0.5, s * r * 1.2, r * 1.6], [-r * 1.6, s * r * 0.9, r * 2.8], [-r * 2.2, s * r * 0.4, r * 3.3]], [r * 0.3, r * 0.24, r * 0.14, r * 0.04], hornC, { segs: 5 });
    if (!ghost && t >= 2) rank(m, p, r * 1.2);
  });
  if (ghost) return;
  const c = h.pt([Rh[0] + 0.05, Rh[1], Rh[2] + 0.06]);
  m.sphere(c, 0.05, p.i % 2 ? P.fire : P.fireHot, { segs: 5 });
  if (p.hit) { glint(m, [c[0] + 0.3, c[1], c[2]], 0.05, P.fireHot); glint(m, [c[0] + 0.5, c[1] - 0.1, c[2] + 0.1], 0.035, P.fire); }
  if (p.is("cast") && p.after) for (const s of [1, -1]) burst(m, h.pt([0.2, s * 0.4, 0.8]), 0.08, P.gloryInk, P.spark, 5);
}
/** Deceiver: a caped hellspawn with tall swept horns, throwing sparks. The cast throws out Phantoms. */
export const trickster: UnitDef = { weight: "light", cast: true, build: (m, p) => deceiver(m, p, false) };
/** Phantom: a hollow flickering copy of the Deceiver. */
export const decoy: UnitDef = { weight: "light", build: (m, p) => deceiver(m, p, true) };

/** Spore Witch: fungus growing off a hunched body, a sprouting staff, a cloud of spores on the blow. */
export const thorn: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, Rh = poleHand(p);
    const h = fiend(m, p, { weight: "mid", bulk: 1.05, lean: 20, handR: Rh, handL: offHand(p), lunge: 0.2, torso: P.gut, arms: P.hide, legs: P.cloth, swingR: 0 });
    robe(m, h, P.cloth, 0.22, 0.16);
    const cap = (at: V3, s: number, col: Material) => { m.cylinder([at[0], at[1], at[2] - s * 0.6], at, s * 0.25, P.pale, s * 0.25, { segs: 5 }); m.ellipsoid(at, [s, s, s * 0.5], col, { segs: 8 }); };
    m.at(h.back, () => { cap([0.1, 0.08, 0.2], 0.13, P.team); cap([0.12, -0.1, 0.08], 0.1, P.fungus); cap([0.08, 0.02, -0.06], 0.08, P.team); if (t >= 3) cap([0.14, 0, 0.36], 0.09, P.fungusLt); });
    m.at(h.head, () => { eyes(m, r, t >= 4 ? P.glory : P.visor); cap([-r * 0.1, 0, r * 1.2], r * 1.5, P.fungus); m.decal(0.03, () => { for (const [x, y] of [[0.5, 0.5], [-0.6, 0.3], [0, -0.7], [-0.3, -0.2]]) m.sphere([x * r - r * 0.1, y * r, r * 1.6], r * 0.2, P.fungusLt, { segs: 4 }); }); if (t >= 2) rank(m, p, r * 2); });
    m.at(h.aim("R", [0.12, 0, 1]), () => {
      const top = 0.56 + 0.03 * t;
      m.cylinder([-0.36, 0, 0], [top, 0, 0], 0.02, P.boneDk, 0.016, { segs: 5 });
      m.with(() => { m.move(top, 0, 0).rotY(-90); cap([0, 0, 0.06], 0.1, t >= 4 ? P.glory : P.team); cap([0.06, 0.05, -0.04], 0.05, P.fungusLt); });
    });
    if (p.after) { const k = p.hit ? 0.3 : 0.9; puff(m, h.pt([0.6 + 0.3 * k, 0.1, 0.4]), 0.2, k, P.spore, 2); puff(m, h.pt([0.9 + 0.3 * k, -0.1, 0.3]), 0.14, k, P.spore, 4); }
  },
};

/** Husk: a thin charred corpse with a shard blade and burning eyes. */
export const thrall: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = chop(p);
    const h = fiend(m, p, { weight: "light", bulk: 0.74, handR: c.hand, twist: 20, lean: 12, skin: P.charLt, torso: P.char, arms: P.charLt, legs: P.char, boots: P.char, hands: P.charLt });
    m.at(h.chest, () => m.decal(0.02, () => { for (const z of [0.06, -0.02, -0.1]) m.box([0.11, 0, z], [0.04, 0.24, 0.03], P.boneDk); }));
    m.at(h.head, () => eyes(m, r * 0.95, P.visor, null));
    m.at(h.aim("R", c.aim), () => m.extrude([[0, 0.02], [0.34, 0.035], [0.44, -0.01], [0.3, -0.03], [0, -0.02]], 0.02, P.rust));
    if (p.hit) slashArc(m, h, [0.05, 0, 0.36], 0.4, 70, -45, -0.25);
  },
};

// ------------------------------------------------------------------------------------------------ crawlers
function grub(m: Model, p: Pose, s: number, big: boolean) {
  const c = crawler(m, p, { size: 1, weight: big ? "mid" : "light", height: 0.1 * s, length: 0.16 * s, width: 0.09 * s, legs: big ? 4 : 3, leg: P.hideDk, legR: 0.014 * s, stride: 0.3 * s });
  m.at(c.body, () => {
    m.group(() => { for (let i = 0; i < 4; i++) m.ellipsoid([(-0.5 + i * 0.32) * 0.36 * s, 0, 0.01 * s * (i % 2)], [0.1 * s, (0.1 + 0.02 * (i === 1 ? 1 : 0)) * s * (big && i < 2 ? 1.5 : 1), 0.09 * s * (big && i < 2 ? 1.3 : 1)], i % 2 ? P.pale : P.hideLt, { segs: 7 }); });
    m.decal(0.02, () => { for (const x of [-0.1, 0.02]) m.ellipsoid([x * s, 0, 0.08 * s * (big ? 1.2 : 1)], [0.05 * s, 0.07 * s, 0.03 * s], P.team, { segs: 6 }); });
    m.decal(0.04, () => { for (const y of [1, -1]) m.sphere([0.2 * s, y * 0.045 * s, 0.03 * s], 0.025 * s, P.visor, { segs: 4 }); });
    for (const y of [1, -1]) m.cone([0.2 * s, y * 0.03 * s, -0.02 * s], [(0.3 + (p.hit ? 0.06 : 0)) * s, y * 0.01 * s, -0.04 * s], 0.02 * s, P.tooth, { segs: 3 });
    if (big) for (const [x, y] of [[-0.14, 0.1], [-0.14, -0.1], [-0.02, 0.12], [-0.02, -0.12]]) m.sphere([x * s, y * s, 0.06 * s], 0.045 * s, P.team, { segs: 5 });
  });
}
/** Maggot: the Spawn Pit's swarm. */
export const mite: UnitDef = { weight: "light", build: (m, p) => grub(m, p, 0.72, false) };
/** Maw Mother: a big bloated crawler. */
export const queen: UnitDef = { weight: "mid", build: (m, p) => grub(m, p, 1.15, true) };

// ------------------------------------------------------------------------------------------------ the walker
function rig(m: Model, p: Pose, half: boolean) {
  const t = p.tier;
  const Rh = p.mix<V3>([0.16, 0.3, 0.3], [0.5, 0.16, 0.36], { wind: [-0.1, 0.32, 0.66] });
  const Lh = p.mix<V3>([0.16, -0.3, 0.3], [0.3, -0.26, 0.34], { wind: [0.2, -0.3, 0.4] });
  const h = trooper(m, p, { size: half ? 1.05 : 1.62, bulk: half ? 1.7 : 1.5, leg: half ? 0.4 : 0.95, weight: "heavy", noHead: true, torso: P.iron, arms: P.ironDk, legs: P.ironDk, boots: P.black, hands: P.ironDk, handR: Rh, handL: Lh, twist: 22, lunge: 0.9 });
  // the waist ring where the torso unit sits on the leg unit
  m.at(h.hips, () => { m.cylinder([0, 0, 0.06], [0, 0, 0.14], 0.24, P.hazard, 0.24, { segs: 10 }); m.decal(0.02, () => { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; m.box([Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.1], [0.05, 0.05, 0.09], P.black); } }); if (!half) m.box([0, 0, -0.04], [0.26, 0.36, 0.14], P.ironDk); });
  m.at(h.chest, () => {
    m.box([0, 0, 0.1], [0.36, 0.5, 0.3], P.iron);
    m.decal(0.03, () => m.box([0.17, 0, 0.14], [0.04, 0.3, 0.1], t >= 4 ? P.glory : P.visor));
    for (const s of [1, -1]) m.box([0, s * 0.33, 0.2], [0.3, 0.2, 0.16], P.team);
    for (const s of [1, -1]) m.cylinder([-0.16, s * 0.12, 0.2], [-0.2, s * 0.14, 0.44], 0.045, trim(t), 0.035, { segs: 6 });
    if (t >= 3) m.box([0, 0, 0.3], [0.2, 0.2, 0.08], P.brass);
    if (p.is("death") && p.i >= 2) puff(m, [-0.2, 0, 0.6], 0.2, p.dead, P.smokeDk, 3);
  });
  for (const fr of [h.handR, h.handL]) m.at(fr, () => { m.box([0.03, 0, 0], [0.2, 0.19, 0.19], trim(t)); m.decal(0.02, () => m.box([0.13, 0, 0], [0.02, 0.2, 0.06], blade(t, P.black))); });
  if (p.hit) burst(m, h.pt([0.66, 0.14, 0.34]), 0.1, P.fire, P.fireHot, 6);
}
/** Dread Rig: the biggest body, a two-part walker: a leg unit and a fist-armed torso unit. */
export const golem: UnitDef = { weight: "heavy", build: (m, p) => rig(m, p, false) };
/** Half Rig: the torso unit of a fallen Dread Rig, walking on stub legs. */
export const golemling: UnitDef = { weight: "heavy", build: (m, p) => rig(m, p, true) };

// ------------------------------------------------------------------------------------------------ emplacements
const plate = (m: Model, at: V3, size: V3) => m.box(at, size, P.teamFlat);
const smokeOnDeath = (m: Model, p: Pose, z = 0.4) => { if (p.is("death") && p.i >= 2) puff(m, [0, 0, z], 0.2, p.dead, P.smokeDk, 3); };

/** Railspike: a long rail gun on a tripod. Shoots straight through a line. */
export const ballista: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.12 });
    m.at(s.base, () => {
      for (const a of [60, 180, 300]) m.with(() => { m.rotZ(a); m.cylinder([0, 0, 0.3], [0.42, 0, 0], 0.035, P.ironDk, 0.035, { segs: 5 }); m.box([0.42, 0, 0.02], [0.12, 0.1, 0.04], P.iron); });
      m.cylinder([0, 0, 0.24], [0, 0, 0.36], 0.1, P.iron, 0.1, { segs: 8 });
    });
    m.at(s.top, () => {
      m.move(0, 0, 0.42).rotY(-5);
      const L = 0.84 + 0.03 * t;
      m.box([-0.1, 0, 0], [0.4, 0.2, 0.16], P.ironDk);
      for (const sd of [1, -1]) { m.box([L / 2, sd * 0.06, 0], [L, 0.03, 0.07], trim(t)); plate(m, [-0.08, sd * 0.12, 0.02], [0.36, 0.03, 0.2]); }
      for (const x of [0.2, 0.45, 0.7]) m.box([x, 0, 0], [0.04, 0.16, 0.1], P.ironDk);
      m.decal(0.03, () => m.box([-0.1, 0, 0.09], [0.2, 0.08, 0.02], t >= 4 ? P.glory : P.visor));
      if (!p.after) m.cone([L - 0.1, 0, 0], [L + 0.16, 0, 0], 0.035, blade(t), { segs: 4 });
      if (p.hit) { flash(m, [L, 0, 0], 0.1, P.zap, P.spark); }
      if (p.after) puff(m, [L + 0.2 + (p.hit ? 0 : 0.12), 0, 0.06], 0.14, p.hit ? 0.2 : 0.8);
    });
    smokeOnDeath(m, p);
  },
};

/** Slag Mortar: a fat barrel pointing at the sky on a hazard-striped bed. */
export const bombard: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.06 });
    m.at(s.base, () => {
      m.box([0, 0, 0.09], [0.7, 0.7, 0.18], P.ironDk);
      m.decal(0.01, () => { for (const x of [-0.24, 0, 0.24]) m.box([x, 0, 0.1], [0.1, 0.72, 0.12], P.hazard); });
      for (const sd of [1, -1]) plate(m, [0, sd * 0.31, 0.3], [0.3, 0.08, 0.28]);
    });
    m.at(s.top, () => {
      m.move(-0.02, 0, 0.3).rotY(-64);
      const L = 0.44 + 0.02 * t;
      m.cylinder([-0.14, 0, 0], [L, 0, 0], 0.2, P.iron, 0.19, { segs: 10 });
      m.cylinder([L - 0.08, 0, 0], [L + 0.02, 0, 0], 0.235, trim(t), 0.235, { segs: 10 });
      m.cylinder([-0.16, 0, 0], [-0.06, 0, 0], 0.22, trim(t), 0.2, { segs: 10 });
      m.decal(0.03, () => m.cylinder([L + 0.02, 0, 0], [L + 0.025, 0, 0], 0.16, t >= 4 ? P.glory : P.black, 0.16, { segs: 10 }));
      if (p.hit) flash(m, [L + 0.06, 0, 0], 0.17);
      if (p.after) puff(m, [L + 0.3 + (p.hit ? 0 : 0.16), 0, 0], 0.24, p.hit ? 0.2 : 0.8, P.smokeDk);
    });
    smokeOnDeath(m, p);
  },
};

/** Skull Mine: a horned iron skull half-buried on a side-colour ring, one eye blinking. The attack sets it off. */
export const mine: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0, collapse: 0.6 });
    m.at(s.base, () => {
      m.cylinder([0, 0, 0], [0, 0, 0.05], 0.31, P.team, 0.28, { segs: 10 });
      if (p.is("attack") && p.after) { burst(m, [0, 0, 0.2], 0.2); puff(m, [0, 0, 0.4], 0.26, p.hit ? 0.2 : 0.8, P.smokeDk); return; }
      const on = p.is("idle") ? p.i % 3 === 0 : true;
      m.with(() => { m.move(0, 0, 0.08).rotY(-50); skull(m, 0.17, t >= 4 ? P.glory : on ? P.redLamp : P.off, t >= 3 ? P.brass : P.iron); horns(m, 0.17, trim(t), 0.7, 0.2, 0.3); });
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.6; m.cone([Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.04], [Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0.12], 0.04, trim(t), { segs: 4 }); }
    });
  },
};

/** Spawn Pit: a squat flesh mound whose toothed mouth opens on the "attack" to spit a Maggot. */
export const hive: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.02 });
    const open = p.is("attack") ? Math.max(0, Math.min(1, p.blend)) : 0, br = 0.012 * p.wave(1);
    m.at(s.base, () => {
      m.group(() => { m.ellipsoid([0, 0, 0.08], [0.54 + br, 0.54 + br, 0.42], P.hide, { segs: 10 }); for (const [a, k] of [[0.6, 1], [2.3, 0.8], [3.9, 1], [5.3, 0.7]]) m.ellipsoid([Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.06], [0.2 * k, 0.2 * k, 0.16 * k], P.hideDk, { segs: 6 }); });
      // the mouth, tipped to face up and forward
      m.with(() => {
        m.move(0.14, 0, 0.42).rotY(38);
        const mr = 0.2 + 0.08 * open;
        m.cylinder([0, 0, -0.04], [0, 0, 0.02], mr + 0.06, P.gut, mr + 0.04, { segs: 10 });
        m.decal(0.03, () => m.cylinder([0, 0, 0.02], [0, 0, 0.025], mr, P.black, mr, { segs: 10 }));
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; m.cone([Math.cos(a) * (mr + 0.02), Math.sin(a) * (mr + 0.02), 0.02], [Math.cos(a) * mr * (0.5 + 0.3 * open), Math.sin(a) * mr * (0.5 + 0.3 * open), 0.1 + 0.05 * open], 0.035, t >= 3 ? P.brass : P.tooth, { segs: 4 }); }
        if (open > 0.5) m.ellipsoid([0, 0, 0.1], [0.09, 0.08, 0.08], P.pale, { segs: 6 });
      });
      // pustules and a spine ridge in the side's colour
      for (const [a, z, k] of [[1.2, 0.3, 1], [2.6, 0.34, 1.2], [3.7, 0.3, 1], [5.0, 0.26, 0.9], [0.3, 0.14, 0.8], [-0.4, 0.2, 0.8]]) m.sphere([Math.cos(a) * 0.4, Math.sin(a) * 0.4, z], 0.085 * k, t >= 4 && k > 1 ? P.glory : P.team, { segs: 6 });
      for (const x of [-0.14, -0.3, -0.44]) m.cone([x, 0, 0.44 + x * 0.3], [x - 0.1, 0, 0.66 + x * 0.3 + 0.02 * t], 0.06, trim(t), { segs: 4 });
    });
  },
};
export { cape, staff };
