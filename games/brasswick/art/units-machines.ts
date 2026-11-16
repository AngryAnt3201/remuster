// Brasswick's machines: emplacements, clockwork vermin, and the things people ride.
import { crawler, flyer, gripAim, humanoid, quadruped, structure, type UnitDef } from "../../../artkit/rig";
import { Model, norm, ringOutline, type V3 } from "../../../artkit/toon3d";
import { GOLD, P, boiler, core, dial, flash, gear, goggles, helmet, porthole, puff, stack, trim, vent } from "./parts";

/** A spoked wheel in the x-z plane (axis along y), turned by `spin` degrees. */
function wheel(m: Model, r: number, spin: number, rim = P.ironDk, spoke = P.brass, n = 8) {
  m.torus([0, 0, 0], [0, 1, 0], r, r * 0.09, rim, { segs: 18 });
  m.group(() => {
    for (let i = 0; i < n / 2; i++) { const a = ((spin + (i * 360) / n) * Math.PI) / 180; m.cylinder([Math.cos(a) * r, 0, Math.sin(a) * r], [-Math.cos(a) * r, 0, -Math.sin(a) * r], r * 0.035, spoke, r * 0.035, { segs: 5 }); }
    m.cylinder([0, -r * 0.1, 0], [0, r * 0.1, 0], r * 0.16, spoke, r * 0.16, { segs: 8 });
  });
}

/** Mine: a brass pressure plate with a ring of spikes and one red lamp that blinks. It jumps when it goes. */
export const mine: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0, collapse: 0.6 });
    const jump = p.mix(0, 0.16, { wind: -0.02 });
    m.at(s.base, () => {
      m.move(0, 0, jump);
      m.group(() => { m.cylinder([0, 0, 0], [0, 0, 0.05], 0.2 + 0.008 * t, P.ironDk, 0.19); m.ellipsoid([0, 0, 0.05], [0.17 + 0.008 * t, 0.17 + 0.008 * t, 0.08], t >= 3 ? P.brass : P.brassDk); });
      m.decal(0.01, () => m.cylinder([0, 0, 0.03], [0, 0, 0.06], 0.195 + 0.008 * t, P.team, 0.18, { segs: 12 }));
      const n = 5 + t;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; m.cone([Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.06], [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.13 + 0.01 * t], 0.028, trim(Math.max(2, t)), { segs: 5 }); }
      const on = p.is("idle") ? p.i % 3 === 0 : true;
      m.sphere([0, 0, 0.14], 0.045, on ? (t >= 4 ? P.aether : P.fire) : P.red, { segs: 8 });
      if (p.hit) { m.sphere([0, 0, 0.1], 0.3, P.fire, { segs: 10 }); m.sphere([0, 0, 0.12], 0.19, P.fireHot, { segs: 8 }); }
    });
  },
};

/** Ballista: a harpoon gun on a turntable. A long brass barrel, a pressure tank, a barbed bolt that skewers a line. */
export const ballista: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.1 });
    m.at(s.base, () => {
      m.cylinder([0, 0, 0], [0, 0, 0.07], 0.36, P.ironDk, 0.33, { segs: 10 });
      m.decal(0.01, () => m.cylinder([0, 0, 0.05], [0, 0, 0.09], 0.335, P.team, 0.31, { segs: 10 }));
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; m.tube([[Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.03], [Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.3]], 0.03, P.woodDk, { segs: 6 }); }
      m.cylinder([0, 0, 0.26], [0, 0, 0.34], 0.1, trim(t), 0.1, { segs: 10 });
    });
    m.at(s.top, () => {
      m.move(0, 0, 0.38).rotY(-8 + p.mix(0, 0, { wind: -6 }));
      const L = 0.5 + 0.03 * t;
      m.group(() => { m.cylinder([-0.26, 0, 0], [0.12, 0, 0], 0.085, P.ironDk, 0.075, { segs: 10 }); m.cylinder([0.1, 0, 0], [L, 0, 0], 0.055, t >= 3 ? P.brass : P.copper, 0.045, { segs: 10 }); });
      m.cylinder([L - 0.04, 0, 0], [L + 0.01, 0, 0], 0.065, trim(Math.max(2, t)), 0.065, { segs: 10 });
      m.cylinder([0.0, 0, 0], [0.06, 0, 0], 0.095, trim(Math.max(2, t)), 0.095, { segs: 10 });
      // the bolt, loaded until it is fired
      if (!p.after && !(p.is("death") && p.i > 1)) { m.cone([L + 0.02, 0, 0], [L + 0.2, 0, 0], 0.045, t >= 4 ? P.aether : P.steel, { segs: 6 }); m.cylinder([L - 0.02, 0, 0], [L + 0.03, 0, 0], 0.025, P.steel, 0.025, { segs: 6 }); }
      m.with(() => { m.move(-0.16, 0, -0.14); m.rotY(90); boiler(m, 0.075, 0.2, P.copperDk, trim(t)); });
      m.with(() => { m.move(-0.1, 0.08, 0.02).rotZ(90); dial(m, 0.05, p.i * 30); });
      // crank handles at the breech
      m.with(() => { m.move(-0.28, 0, 0).rotX(p.i * 30); m.cylinder([0, -0.12, 0], [0, 0.12, 0], 0.015, P.iron, 0.015, { segs: 5 }); m.sphere([0, 0.12, 0], 0.03, P.wood, { segs: 6 }); m.sphere([0, -0.12, 0], 0.03, P.wood, { segs: 6 }); });
      if (t >= 3) for (const sd of [1, -1]) m.extrude([[0.1, 0.02], [0.3, 0.02], [0.2, 0.14]], 0.012, P.team), m.move(0, sd * 0, 0);
      if (p.hit) flash(m, [L + 0.03, 0, 0], 0.09);
      if (p.after) puff(m, [L + 0.1, 0, 0.06], 0.1, p.hit ? 0.2 : 0.7, P.steam, 1);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.3], 0.15, p.dead, P.smoke, 3);
  },
};

/** Bombard: a squat siege mortar. A fat riveted barrel pointing at the sky on an iron bed, shells stacked beside it. */
export const bombard: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.05 });
    m.at(s.base, () => {
      m.cylinder([0, 0, 0], [0, 0, 0.1], 0.38, P.ironDk, 0.35, { segs: 8 });
      m.decal(0.01, () => m.cylinder([0, 0, 0.07], [0, 0, 0.12], 0.355, P.team, 0.33, { segs: 8 }));
      for (const sd of [1, -1]) m.with(() => { m.move(-0.02, sd * 0.22, 0.2); gear(m, 0.14, 0.05, trim(Math.max(2, t)), 10, p.is("attack") ? p.blend * 20 : 0); });
      // shells
      m.group(() => { for (const [x, y] of [[0.26, 0.2], [0.3, 0.08], [0.2, 0.28]].slice(0, 1 + Math.min(2, t - 1))) { m.cylinder([x, y, 0.1], [x, y, 0.2], 0.05, P.iron, 0.05, { segs: 8 }); m.sphere([x, y, 0.2], 0.05, t >= 4 ? P.aether : P.brass, { segs: 8 }); } });
    });
    m.at(s.top, () => {
      m.move(-0.02, 0, 0.2).rotY(-58 + p.mix(0, 0, { wind: 5 }));
      const L = 0.34 + 0.025 * t, r = 0.16 + 0.006 * t;
      const squash = p.hit ? 0.88 : 1;
      m.group(() => { m.sphere([0, 0, 0], r * 1.08, P.ironDk); m.cylinder([0, 0, 0], [L * squash, 0, 0], r, t >= 3 ? P.brassDk : P.iron, r * 0.92, { segs: 12 }); });
      m.cylinder([L * squash - 0.06, 0, 0], [L * squash, 0, 0], r * 1.06, trim(Math.max(2, t)), r * 1.06, { segs: 12 });
      m.cylinder([0.08, 0, 0], [0.13, 0, 0], r * 1.08, trim(Math.max(2, t)), r * 1.06, { segs: 12 });
      m.decal(0.01, () => m.cylinder([L * squash - 0.01, 0, 0], [L * squash + 0.005, 0, 0], r * 0.72, P.soot, r * 0.72, { segs: 12 }));
      if (t >= 4) m.torus([L * 0.5, 0, 0], [1, 0, 0], r * 1.02, 0.02, P.aether);
      if (p.hit) flash(m, [L + 0.02, 0, 0], 0.14);
      if (p.after) puff(m, [L + 0.2 + (p.hit ? 0 : 0.1), 0, 0], 0.16, p.hit ? 0.2 : 0.7, P.smoke, 2);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.3], 0.16, p.dead, P.smoke, 3);
  },
};

/** Turret: the Tinker's field gun. A little brass repeater on a tripod, a hopper of shot on top. */
export const turret: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const s = structure(m, p, { recoil: 0.04 });
    m.at(s.base, () => {
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 1; m.tube([[Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.02], [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.26]], 0.024, P.ironDk, { segs: 6 }); }
      m.cylinder([0, 0, 0.24], [0, 0, 0.3], 0.07, P.brassDk, 0.07, { segs: 8 });
    });
    m.at(s.top, () => {
      m.move(0, 0, 0.34);
      m.group(() => { m.box([-0.02, 0, 0], [0.2, 0.13, 0.12], P.team); });
      m.with(() => { m.rotX(p.i * 60); m.group(() => { for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; m.cylinder([0.06, Math.cos(a) * 0.03, Math.sin(a) * 0.03], [0.32, Math.cos(a) * 0.03, Math.sin(a) * 0.03], 0.018, P.brass, 0.018, { segs: 6 }); } }); m.cylinder([0.26, 0, 0], [0.29, 0, 0], 0.055, P.ironDk, 0.055, { segs: 8 }); });
      m.cylinder([-0.04, 0, 0.06], [-0.04, 0, 0.17], 0.06, P.copper, 0.075, { segs: 8 });
      if (p.hit) flash(m, [0.34, 0, 0], 0.06);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.25], 0.1, p.dead, P.smoke, 3);
  },
};

/** Mite: a clockwork spider the size of a boot: a brass bulb on six wire legs, one red eye, a key in its back. */
export const mite: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = crawler(m, p, { height: 0.12, length: 0.13, width: 0.085, leg: P.ironDk, legR: 0.02, stride: 0.17 });
    m.at(c.body, () => {
      m.ellipsoid([0, 0, 0.02], [0.13, 0.1, 0.085], P.brass);
      m.decal(0.01, () => m.ellipsoid([-0.03, 0, 0.04], [0.085, 0.085, 0.07], P.team));
      m.decal(0.02, () => m.sphere([0.115, 0, 0.03], 0.035, p.is("death") && p.i > 2 ? P.soot : P.fire, { segs: 6 }));
      m.with(() => { m.move(-0.08, 0, 0.1).rotZ(p.i * 45); m.cylinder([0, 0, -0.03], [0, 0, 0.02], 0.012, P.ironDk, 0.012, { segs: 5 }); m.box([0, 0, 0.04], [0.09, 0.015, 0.04], P.steel); });
      for (const s of [1, -1]) m.cone([0.11, s * 0.04, -0.01], [0.19 + 0.03 * Math.max(0, p.blend), s * 0.02, -0.03], 0.018, P.steel, { segs: 5 });
    });
  },
};

/** Brood Queen: the foundry's masterwork: a spider with a boiler for an abdomen and a smoking stack. */
export const queen: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = crawler(m, p, { height: 0.2, length: 0.22, width: 0.12, legs: 4, leg: P.ironDk, foot: P.brass, legR: 0.028, stride: 0.28, splay: 2.3 });
    m.at(c.body, () => {
      m.group(() => { m.ellipsoid([-0.12, 0, 0.06], [0.2, 0.16, 0.15], P.copper); m.sphere([0.12, 0, 0.02], 0.11, P.brass); });
      m.decal(0.01, () => m.ellipsoid([-0.12, 0, 0.1], [0.15, 0.14, 0.12], P.team));
      for (const x of [-0.02, -0.22]) m.torus([x, 0, 0.06], [1, 0, 0], 0.155, 0.02, P.brass, { segs: 12 });
      m.decal(0.02, () => { for (const s of [1, -1]) m.sphere([0.21, s * 0.05, 0.05], 0.035, p.is("death") && p.i > 2 ? P.soot : P.fire, { segs: 6 }); });
      m.with(() => { m.move(-0.16, 0, 0.19); stack(m, 0.04, 0.14, P.ironDk, P.brass); vent(m, p, [0, 0, 0.2], 0.06, P.smoke); });
      for (const s of [1, -1]) m.tube([[0.2, s * 0.06, -0.02], [0.3, s * 0.08, -0.03], [0.34 + 0.04 * Math.max(0, p.blend), s * 0.03, -0.07]], [0.025, 0.02, 0.006], P.steel, { segs: 5 });
      m.cone([0, 0, 0.15], [0, 0, 0.26], 0.035, GOLD, { segs: 6 });
    });
  },
};

/** Lancer: a cuirassier on a clockwork charger. Barrel-bodied brass horse, smoking rump, a lance levelled for the charge. */
export const lancer: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { size: 1.0, height: 0.4, length: 0.27, width: 0.13, legs: P.ironDk, hooves: t >= 3 ? P.brass : P.iron, legR: 0.045, stride: 0.62 });
    m.at(q.body, () => {
      m.group(() => { m.ellipsoid([0, 0, 0], [0.31, 0.16, 0.16], t >= 3 ? P.brass : P.copper); });
      for (const x of [0.14, -0.14]) m.torus([x, 0, 0], [1, 0, 0], 0.155, 0.02, trim(Math.max(2, t)), { segs: 12 });
      m.decal(0.01, () => m.ellipsoid([0, 0, 0.03], [0.14, 0.165, 0.14], P.team)); // saddle cloth
      // neck and head
      const nod = p.is("walk") ? 5 * Math.sin(p.t * Math.PI * 4) : p.mix(0, -10, { wind: 14 });
      m.with(() => {
        m.move(0.24, 0, 0.06).rotY(-52 + nod);
        m.capsule([0, 0, 0], [0.26, 0, 0], 0.085, P.copperDk, 0.065, { segs: 10 });
        m.decal(0.01, () => m.group(() => { for (let i = 0; i < 4; i++) m.box([0.04 + i * 0.06, 0, 0.075], [0.04, 0.03, 0.07], P.team); })); // mane plates
        m.move(0.27, 0, 0).rotY(70);
        m.group(() => { m.ellipsoid([0.06, 0, 0], [0.13, 0.075, 0.075], P.copper); m.ellipsoid([0.15, 0, -0.01], [0.06, 0.06, 0.055], P.brassDk); });
        m.decal(0.02, () => { for (const s of [1, -1]) m.sphere([0.06, s * 0.065, 0.025], 0.028, p.is("death") && p.i > 2 ? P.soot : t >= 4 ? P.aether : P.lamp, { segs: 6 }); });
        for (const s of [1, -1]) m.cone([-0.02, s * 0.045, 0.05], [-0.05, s * 0.06, 0.14], 0.03, P.copperDk, { segs: 5 });
        if (p.is("walk") || p.hit) puff(m, [0.2, 0, -0.02], 0.035, 0.3, P.steam, p.i);
      });
      m.with(() => { m.move(-0.27, 0, 0.1); stack(m, 0.04, 0.12, P.ironDk, trim(Math.max(2, t))); vent(m, p, [0, 0, 0.17], 0.06, P.smoke); });
      m.capsule([-0.3, 0, 0.02], [-0.42, 0.02 * p.wave(1, 2), -0.12], 0.03, P.ironDk, 0.012, { segs: 6 });
    });
    // the rider
    m.at(q.saddle, () => {
      const R = p.mix<V3>([0.1, 0.2, 0.36], [0.3, 0.16, 0.36], { wind: [-0.02, 0.22, 0.4] });
      const h = humanoid(m, p, { seated: true, size: 0.86, skin: P.skin, torso: P.steel, arms: P.team, legs: P.team, boots: P.soot, hands: P.leatherDk, handR: R, handL: [0.2, -0.08, 0.3], lunge: 0 });
      m.at(h.chest, () => { for (const s of [1, -1]) m.sphere([0, s * 0.18, 0.13], 0.07, trim(Math.max(2, t))); });
      m.at(h.head, () => {
        helmet(m, 0.19, t >= 3 ? P.brass : P.steel, trim(Math.max(2, t)));
        m.extrude([[-0.2, 0.16], [0.12, 0.16], [0.14, 0.3 + 0.02 * t], [-0.26, 0.26 + 0.02 * t]], 0.04, t >= 4 ? P.aether : P.team);
      });
      m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.5], [1, -0.06, 0.02], { wind: [1, 0, 0.3] }))), () => {
        const L = 0.8 + 0.05 * t;
        m.cylinder([-0.3, 0, 0], [L, 0, 0], 0.022, P.woodDk, 0.016, { segs: 6 });
        m.cone([L, 0, 0], [L + 0.18, 0, 0], 0.04, t >= 4 ? P.aether : P.steel, { segs: 6 });
        m.cone([0.02, 0, 0], [0.16, 0, 0], 0.07, trim(Math.max(2, t)), { segs: 8 });
        m.decal(0.01, () => m.extrude([[L - 0.02, -0.01], [L - 0.02, -0.14], [L - 0.2, -0.09], [L - 0.18, -0.01]], 0.01, P.team));
        if (p.hit) m.cone([L + 0.5, 0, 0], [L - 0.1, 0, 0], 0.07, P.steam, { segs: 6 });
      });
    });
  },
};

/** Outrider: a carbineer on a penny-farthing. The great wheel is the silhouette; he circles and never stops shooting. */
export const outrider: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, R0 = 0.33 + 0.01 * t;
    const q = quadruped(m, p, { noLegs: true, legs: P.iron, hooves: P.iron, height: R0, stride: 0.58, weight: "mid", lunge: 0.3 });
    const spin = p.is("walk") ? -q.spin * ((0.58 / (2 * Math.PI * R0))) : p.is("idle") ? 0 : 0;
    m.at(q.root, () => {
      m.with(() => { m.move(0.1, 0, R0); wheel(m, R0, spin, P.ironDk, t >= 3 ? GOLD : P.brass, 10); });
      m.with(() => { m.move(-0.36, 0, 0.12); wheel(m, 0.12, spin * 2.6, P.ironDk, P.brass, 6); });
      // backbone from the fork down to the small wheel, in team colour
      m.tube([[0.1, 0, R0 * 2 + 0.06], [-0.08, 0, R0 * 2 + 0.02], [-0.3, 0, 0.36], [-0.36, 0, 0.12]], 0.03, P.team, { segs: 6 });
      for (const s of [1, -1]) m.tube([[0.1, s * 0.05, R0], [0.1, s * 0.045, R0 * 2 + 0.06]], 0.018, P.team, { segs: 5 });
      m.tube([[0.12, -0.16, R0 * 2 + 0.12], [0.1, 0, R0 * 2 + 0.07], [0.12, 0.16, R0 * 2 + 0.12]], 0.016, P.brass, { segs: 5 });
      if (t >= 2) m.with(() => { m.move(0.22, 0, R0 * 2 + 0.02); m.cylinder([0, 0, 0], [0.05, 0, 0], 0.05, P.brassDk, 0.055, { segs: 8 }); m.decal(0.02, () => m.sphere([0.05, 0, 0], 0.04, t >= 4 ? P.aether : P.lamp, { segs: 6 })); });
      if (t >= 3) m.with(() => { m.move(-0.24, 0, 0.34); boiler(m, 0.055, 0.12, P.copper, GOLD); vent(m, p, [0, 0, 0.18], 0.05, P.steam); });
    });
    m.at(q.root, () => {
      m.move(-0.06, 0, R0 * 2 - 0.12 + (q.body[11] - R0)); // sits over the big wheel, riding its bob
      const Rh = p.mix<V3>([0.12, 0.16, 0.36], [0.16, 0.14, 0.46], { wind: [0.06, 0.16, 0.44] });
      const Lh = p.mix<V3>([0.26, -0.1, 0.36], [0.34, -0.02, 0.5], { wind: [0.24, -0.04, 0.52] });
      const h = humanoid(m, p, { seated: true, size: 0.84, skin: P.skin, torso: P.team, legs: P.wool, boots: P.leatherDk, hands: P.leather, handR: Rh, handL: Lh, recoil: 0.03, lunge: 0 });
      m.at(h.head, () => {
        m.group(() => { m.ellipsoid([-0.02, 0, 0.1], [0.18, 0.18, 0.13], P.leatherDk); m.ellipsoid([0.14, 0, 0.06], [0.1, 0.13, 0.03], P.leatherDk); }); // riding cap
        goggles(m, 0.19, core(t), trim(Math.max(2, t)), 0);
        m.capsule([-0.12, 0, -0.02], [-0.34, 0.04 * p.wave(1, 2), 0.04 + 0.03 * p.wave(1, 2, 0.3)], 0.045, P.teamLt, 0.02, { segs: 6 });
      });
      m.at(gripAim(h.pR, h.pL), () => {
        m.box([-0.05, 0, -0.02], [0.14, 0.045, 0.07], P.wood);
        m.cylinder([0.02, 0, 0.01], [0.36, 0, 0.01], 0.024, t >= 3 ? P.brass : P.steel, 0.02, { segs: 6 });
        if (p.hit) flash(m, [0.38, 0, 0.01], 0.06);
      });
    });
  },
};

/** Griffin Knight: a rocket-pack lancer. Twin boilers roar on his back; he drops on the back line like a shell. */
export const griffin: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.2, lunge: 1.3 });
    m.at(f.body, () => {
      m.rotY(22); // leaning into the flight
      m.move(0, 0, -0.34);
      const R = p.mix<V3>([0.16, 0.2, 0.4], [0.3, 0.16, 0.36], { wind: [0.0, 0.22, 0.46] });
      const h = humanoid(m, p, { seated: true, size: 1.05, bulk: 1.1, skin: P.skin, torso: P.steel, arms: P.team, legs: P.team, boots: P.iron, hands: P.leatherDk, handR: R, handL: [0.14, -0.24, 0.36], lunge: 0 });
      m.at(h.chest, () => { for (const s of [1, -1]) m.sphere([0, s * 0.2, 0.13], 0.085, trim(Math.max(2, t))); m.decal(0.02, () => m.torus([0, 0, -0.06], [0, 0, 1], 0.185, 0.03, P.team, { segs: 12 })); });
      m.at(h.head, () => {
        helmet(m, 0.19, t >= 3 ? P.brass : P.steel, trim(Math.max(2, t)));
        goggles(m, 0.19, core(t), P.brassDk, 0);
        for (const s of [1, -1]) m.extrude([[-0.08, 0.1], [0.02, 0.12], [-0.2, 0.34 + 0.02 * t]], 0.02, P.team), m.rotZ(s * 0);
      });
      // the rocket pack: two boilers, fins, fire
      m.at(h.back, () => {
        for (const s of [1, -1]) m.with(() => {
          m.move(0.06, s * 0.11, -0.12);
          boiler(m, 0.085, 0.3 + 0.02 * t, t >= 3 ? P.brass : P.copper, trim(Math.max(2, t)));
          m.cone([0, 0, 0.02], [0, 0, -0.08], 0.09, P.ironDk, { segs: 8 });
          const fl = 0.16 + 0.07 * Math.abs(f.flap) + (p.blend > 0 ? 0.12 : 0);
          if (!(p.is("death") && p.i > 1)) { m.cone([0, 0, -0.04], [0, 0, -0.06 - fl], 0.065, t >= 4 ? P.aetherInk : P.fire, { segs: 7 }); m.cone([0, 0, -0.04], [0, 0, -0.05 - fl * 0.55], 0.035, P.fireHot, { segs: 6 }); }
          // a brass fin, team-coloured web
          m.with(() => { m.move(0.0, s * 0.08, 0.22).rotX(-s * (14 + 16 * f.flap)); const sp = 0.5 + 0.04 * t; m.poly([[0.1, 0, 0], [0.14, s * sp * 0.6, 0.02], [0.02, s * sp, 0.03], [-0.2, s * sp * 0.85, 0], [-0.3, s * sp * 0.4, -0.02], [-0.16, 0, -0.02]], P.team); m.tube([[0.1, 0, 0.006], [0.14, s * sp * 0.6, 0.026], [0.02, s * sp, 0.036]], 0.018, trim(Math.max(2, t)), { segs: 5 }); m.decal(0.01, () => m.tube([[-0.06, 0, 0.004], [-0.2, s * sp * 0.85, 0.006]], 0.01, P.teamDk, { segs: 4 })); });
        });
      });
      m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.3], [1, 0, -0.5], { wind: [0.7, 0, 0.7] }))), () => {
        const L = 0.62 + 0.04 * t;
        m.cylinder([-0.24, 0, 0], [L, 0, 0], 0.02, P.woodDk, 0.016, { segs: 6 });
        m.cone([L, 0, 0], [L + 0.17, 0, 0], 0.04, t >= 4 ? P.aether : P.steel, { segs: 6 });
        m.decal(0.01, () => m.extrude([[L - 0.02, -0.01], [L - 0.02, -0.12], [L - 0.18, -0.08], [L - 0.16, -0.01]], 0.01, P.team));
        if (p.hit) flash(m, [L + 0.18, 0, 0], 0.07, P.lamp, P.fireHot);
      });
      if (p.is("death")) puff(m, [-0.2, 0, 0.5], 0.12, p.dead, P.smoke, 4);
    });
  },
};
void ringOutline; void porthole; void dial;
