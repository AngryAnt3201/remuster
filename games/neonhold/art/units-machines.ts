// Neonhold's machines: emplacements, drones, bugs, and the things people ride.
import { flyer, structure, type UnitDef } from "../../../artkit/rig";
import { Model, type V3 } from "../../../artkit/toon3d";
import { P, core, puff, trim } from "./parts";

/** Dronebox: a hacked vending machine. The lit front shows its stock; the hatch at the bottom drops drones. */
export const hive: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.02 });
    const W = 0.6, D = 0.46, H = 0.86 + 0.02 * t;
    m.at(s.base, () => {
      m.box([0, 0, 0.04], [D + 0.06, W + 0.06, 0.08], P.black);
      m.box([0, 0, H / 2 + 0.06], [D, W, H - 0.04], P.armorDk);
      // team livery down both sides and across the back
      for (const sd of [1, -1]) m.decal(0.015, () => m.box([0, sd * W / 2, H / 2 + 0.08], [D * 0.8, 0.02, H * 0.72], P.team));
      m.decal(0.015, () => m.box([-D / 2, 0, H / 2 + 0.08], [0.02, W * 0.8, H * 0.72], P.team));
      // the lit window: rows of stock
      m.decal(0.02, () => m.box([D / 2, 0.06, H * 0.62], [0.02, W * 0.62, H * 0.5], P.glass));
      m.decal(0.035, () => m.group(() => { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m.box([D / 2 + 0.01, -0.07 + c * 0.13, H * 0.45 + r * 0.14], [0.02, 0.07, 0.07], (r + c) % 2 ? P.magenta : P.white); }));
      // keypad strip
      m.decal(0.02, () => m.box([D / 2, -W * 0.38, H * 0.6], [0.02, 0.08, 0.3], P.black));
      m.decal(0.035, () => m.box([D / 2 + 0.01, -W * 0.38, H * 0.68], [0.02, 0.05, 0.06], core(t, P.green)));
      // the hatch: glows, and gapes on the spawn
      const open = p.mix(0, 1, { wind: 0.3 });
      m.decal(0.02, () => m.box([D / 2, 0, 0.19], [0.02, W * 0.7, 0.18], p.is("death") && p.i > 2 ? P.dead : P.teamGlow));
      m.with(() => { m.move(D / 2 + 0.02, 0, 0.28).rotY(-95 * open); m.box([0, 0, -0.09], [0.025, W * 0.74, 0.19], trim(Math.max(2, t))); });
      if (t >= 2) for (const sd of [1, -1]) m.box([0, sd * (W / 2 + 0.005), H + 0.02], [D + 0.02, 0.03, 0.04], trim(t));
    });
    m.at(s.top, () => {
      m.move(0, 0, H + 0.04);
      // the sign on top: a slab of team light
      m.box([0.02, 0, 0.1], [0.06, W * 0.86, 0.16], P.holo);
      m.decal(0.02, () => m.box([0.055, 0, 0.1], [0.01, W * 0.6, 0.04], P.teamLt));
      if (t >= 3) { m.cylinder([-0.14, 0.18, 0], [-0.14, 0.18, 0.34], 0.014, trim(t), 0.01, { segs: 5 }); m.sphere([-0.14, 0.18, 0.36], 0.03, P.red, { segs: 6 }); }
      if (t >= 4) m.torus([0.02, 0, 0.1], [1, 0, 0], 0.2, 0.018, P.aether, { segs: 14 });
      if (p.after) puff(m, [0.3, 0, -H + 0.2], 0.1, p.hit ? 0.2 : 0.7, P.smoke, 3);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0.05, 0.02, 0.5], 0.16, p.dead, P.smoke, 5);
  },
};

/** Skyray: a delta-wing strike drone. Wide wings of team light over a small dark hull; it only ever dives. */
export const harrier: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.24 });
    m.at(f.body, () => {
      m.group(() => {
        m.ellipsoid([0, 0, 0], [0.25, 0.085, 0.07], P.armor);
        m.cone([0.2, 0, 0], [0.4, 0, -0.01], 0.05, trim(Math.max(2, t)), { segs: 8 });
      });
      m.decal(0.02, () => m.ellipsoid([0.1, 0, 0.035], [0.1, 0.05, 0.035], p.is("death") && p.i > 2 ? P.dead : core(t, P.red)));
      // delta wings
      const ang = 5 + 13 * f.flap, span = 0.5 + 0.03 * t;
      for (const s of [1, -1]) m.with(() => {
        m.move(-0.02, s * 0.06, 0.01).rotX(-s * ang);
        m.poly([[0.24, 0, 0], [-0.08, s * span, 0.01], [-0.24, s * span * 0.96, 0.01], [-0.2, 0, 0]], P.team);
        m.tube([[0.24, 0, 0.004], [-0.08, s * span, 0.014]], 0.014, P.teamLt, { segs: 5 });
        if (t >= 2) m.cylinder([-0.14, s * span * 0.5, 0], [-0.3, s * span * 0.5, 0], 0.028, trim(t), 0.022, { segs: 6 });
        if (t >= 4) m.sphere([-0.08, s * span, 0.014], 0.03, P.aether, { segs: 6 });
      });
      // twin tail fins and thrusters
      for (const s of [1, -1]) {
        m.extrude([[-0.12, 0.02], [-0.3, 0.14], [-0.34, 0.14], [-0.26, 0.02]], 0.012, P.teamDk);
        m.cylinder([-0.2, s * 0.055, 0], [-0.3, s * 0.055, 0], 0.04, P.armorDk, 0.046, { segs: 8 });
        const fl = 0.1 + 0.05 * Math.abs(f.flap) + (p.blend > 0 ? 0.1 : 0);
        if (!(p.is("death") && p.i > 1)) m.cone([-0.3, s * 0.055, 0], [-0.3 - fl, s * 0.055, 0], 0.034, P.plasma, { segs: 6 });
      }
      // dive spike
      const drop = p.mix(0, 1, { wind: 0.3 });
      m.cone([0.14, 0, -0.05], [0.26 + 0.08 * drop, 0, -0.1 - 0.08 * drop], 0.03, t >= 3 ? P.gold : P.chrome, { segs: 6 });
      if (p.is("death")) puff(m, [-0.2, 0, 0.1], 0.1, p.dead, P.smoke, 4);
    });
  },
};
void ({} as V3); void ({} as Model);
