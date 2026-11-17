// Neonhold's crews: every unit that walks on two legs. Each is the humanoid rig in dark plate with a glowing visor,
// one big lit team surface (jacket, shield, coat, banner) and one prop that says what it does. The camera looks
// down from behind the player, so the crown of the head and the shoulders carry as much as the front.
import { gripAim, type HumanoidRig, type Pose, type UnitDef } from "../../../artkit/rig";
import { Model, frameAt, mat, norm, team, type Material, type V3 } from "../../../artkit/toon3d";
import { P, arcBolt, blade, cap, chop, core, crew, eyes, flash, halo, helm, hood, pack, pads, puff, shaft, skirt, slashArc, strip, thrust, trim, visor } from "./parts";

const WATER = mat("#8fb4ff", { emit: 0.85, ink: false, alpha: 0.85 });
const GHOST = team("light", { emit: 0.9, alpha: 0.42 });
const GHOST_DK = team("main", { emit: 0.8, alpha: 0.5 });

/** A rail rifle along +x from the trigger hand: stock, receiver, two rails with a lit channel between them. */
function railRifle(m: Model, tier: number, len = 0.54) {
  m.group(() => {
    m.box([-0.08, 0, -0.02], [0.18, 0.045, 0.07], P.black);
    m.box([0.07, 0, 0], [0.18, 0.06, 0.07], P.armorDk);
  });
  m.box([(0.14 + len) / 2, 0, 0.014], [len - 0.14, 0.05, 0.05], tier >= 3 ? P.gold : tier === 2 ? P.chrome : P.steel);
  m.decal(0.02, () => m.box([(0.16 + len) / 2, 0, 0.014], [len - 0.2, 0.056, 0.014], tier >= 4 ? P.aether : P.magenta));
  if (tier >= 2) m.box([0.1, 0, 0.065], [0.14, 0.03, 0.035], P.black);
  if (tier >= 3) m.box([0.14, 0, -0.06], [0.07, 0.04, 0.08], P.armorDk);
}
/** A two-handed shooter's stance: the trigger hand and the fore hand. */
const stance = (p: Pose): [V3, V3] => [
  p.mix<V3>([0.06, 0.13, 0.33], [0.04, 0.1, 0.47], { wind: [0.02, 0.12, 0.44] }),
  p.mix<V3>([0.25, -0.05, 0.4], [0.3, 0.0, 0.485], { wind: [0.2, -0.02, 0.56] }),
];
/** A cape down the back (call inside the chest frame). */
const cape = (m: Model, p: Pose, col: Material, len = 0.34, w = 0.36) => m.extrude([[-0.15, 0.17], [-0.2, 0.0], [-0.3 - 0.02 * p.wave(1), -len], [-0.23, -len]], w, col);
/** A ring of little lights rising round a caster (rally, heal, ward). */
function sparks(m: Model, h: HumanoidRig, p: Pose, col: Material, r = 0.3, z = 0.9, n = 5) {
  if (!p.after) return;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + p.i; m.sphere(h.pt([0.1 + r * Math.cos(a), r * Math.sin(a), z]), 0.03, col, { segs: 6 }); }
}

// ------------------------------------------------------------------------------------------------ melee
/** Razors: three hooded kids with short light-knives. Light, quick, always in a pack. */
export const blades: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const h = crew(m, p, { weight: "light", bulk: 0.9, size: 0.94, handR: c.hand, twist: 28, torso: P.team, arms: P.team, handL: t >= 3 ? p.mix<V3>([0.1, -0.22, 0.34], [0.26, -0.1, 0.4], { wind: [0, -0.24, 0.4] }) : undefined });
    skirt(m, h, P.team, 0.04, 0.17);
    m.at(h.chest, () => { if (t >= 2) pads(m, trim(t), 0.055, 0.9); });
    m.at(h.head, () => { hood(m, 0.19, P.armorDk, core(t, P.teamLt)); m.decal(0.02, () => m.ellipsoid([-0.08, 0, 0.3], [0.16, 0.05, 0.1], P.teamLt, { segs: 8 })); halo(m, p); });
    m.at(h.aim("R", c.aim), () => blade(m, 0.34 + 0.02 * t, t >= 4 ? P.aether : P.teamLt, trim(Math.max(2, t))));
    if (t >= 3) m.at(h.aim("L", norm(p.mix<V3>([0.6, 0, 0.8], [1, 0.2, 0], { wind: [0, 0, 1] }))), () => blade(m, 0.24, P.teamLt, trim(t)));
    if (p.hit) slashArc(m, h, [0.05, 0, 0.36], 0.42, 70, -45, -0.25);
  },
};

/** Riotwall: a huge trooper behind a wall of hard light. The shield is the unit: wide, lit, always in front. */
export const bulwark: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const sh = p.mix<V3>([0.24, -0.1, 0.36], [0.32, -0.06, 0.38], { wind: [0.2, -0.14, 0.36] });
    const h = crew(m, p, { weight: "heavy", bulk: 1.32, size: 1.1, handR: c.hand, handL: sh, twist: 14, lunge: 0.6, torso: P.armor, arms: P.armorDk, legs: P.armorDk, boots: P.black });
    m.at(h.chest, () => {
      pads(m, P.team, 0.115, 1.3);
      m.decal(0.02, () => m.box([-0.15, 0, 0.04], [0.06, 0.26, 0.2], P.team)); // back plate: the side, seen from behind
      m.cylinder([0, 0, -0.1], [0, 0, -0.04], 0.21, trim(t), 0.21, { segs: 12 });
    });
    m.at(h.head, () => { helm(m, 0.2, P.armorDk, core(t), t >= 3 ? P.team : null); halo(m, p, 0.2, 0.42); });
    // the wall: three panes of hard light in an emitter frame, facing forward
    m.at(frameAt(h.pL, h.dir([1, -0.1, 0])), () => {
      const w = 0.4 + 0.012 * t, hh = 0.82 + 0.02 * t;
      m.move(0.06, 0.04, 0.02);
      for (const s of [-1, 0, 1]) m.with(() => {
        m.move(-Math.abs(s) * 0.035, s * w * 0.66, 0).rotZ(-s * 24);
        m.box([0, 0, 0], [0.022, w * 0.68, hh], P.holo);
        m.decal(0.02, () => m.box([0.014, 0, 0], [0.01, w * 0.5, hh * 0.08], P.teamLt));
      });
      for (const z of [hh / 2, -hh / 2]) m.box([-0.01, 0, z], [0.07, w * 2.05, 0.05], trim(Math.max(2, t)));
      if (t >= 3) m.decal(0.03, () => m.box([0.02, 0, 0.12], [0.02, 0.2, 0.2], P.teamLt));
      if (t >= 4) m.sphere([0.03, 0, hh / 2 + 0.05], 0.05, P.aether, { segs: 8 });
    });
    m.at(h.aim("R", c.aim), () => { shaft(m, 0.05, 0.3, 0.022, P.black); m.cylinder([0.16, 0, 0], [0.34, 0, 0], 0.03, core(t, P.magenta), 0.03, { segs: 6 }); });
    if (p.hit) slashArc(m, h, [0.1, 0, 0.3], 0.44, 60, -40, -0.2);
  },
};

/** Ghost: a cloaked killer with twin mono-blades. Dark all over; the side shows only in the eyes and the edges. */
export const shade: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.14, 0.2, 0.36], [0.36, 0.06, 0.4], { wind: [-0.06, 0.26, 0.5] });
    const L = p.mix<V3>([0.14, -0.2, 0.36], [0.3, -0.12, 0.34], { wind: [0.02, -0.26, 0.44] });
    const h = crew(m, p, { weight: "light", bulk: 0.88, handR: R, handL: L, twist: 20, torso: P.black, arms: P.black, legs: P.black, lean: 14 });
    skirt(m, h, P.black, 0.2, 0.2);
    m.at(h.chest, () => { cape(m, p, P.suitDk, 0.36, 0.34); m.decal(0.02, () => m.torus([0, 0, 0.14], [0.2, 0, 1], 0.15, 0.03, P.team, { segs: 12 })); if (t >= 2) pads(m, trim(t), 0.05, 0.88); });
    m.at(h.head, () => { hood(m, 0.19, P.black, core(t)); halo(m, p); });
    const aR = norm(p.mix<V3>([0.7, 0.3, 0.6], [1, -0.2, 0], { wind: [-0.2, 0.3, 1] })), aL = norm(p.mix<V3>([0.7, -0.3, 0.6], [1, 0.2, -0.1], { wind: [0.2, -0.3, 1] }));
    m.at(h.aim("R", aR), () => blade(m, 0.32 + 0.02 * t, t >= 4 ? P.aether : P.teamLt, trim(Math.max(2, t)), 0.014));
    m.at(h.aim("L", aL), () => blade(m, 0.32 + 0.02 * t, t >= 4 ? P.aether : P.teamLt, trim(Math.max(2, t)), 0.014));
    if (p.hit) { slashArc(m, h, [0.05, 0, 0.36], 0.42, 60, -30, -0.2); slashArc(m, h, [0.05, 0, 0.32], 0.36, -60, 20, 0.2); }
  },
};

/** Wrecker: a chromed brute with a power hammer. Mohawk of light, bare metal arms, the widest swing in the game. */
export const ravager: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.2, 0.4], [0.36, 0.0, 0.2], { wind: [-0.1, 0.2, 0.72] });
    const L = p.mix<V3>([0.22, -0.06, 0.36], [0.3, -0.08, 0.3], { wind: [0.0, 0.04, 0.6] });
    const h = crew(m, p, { weight: "heavy", bulk: 1.26, size: 1.08, handR: R, handL: L, twist: 30, torso: P.team, arms: P.chrome, hands: P.chrome, skin: P.skin });
    m.at(h.chest, () => { pads(m, trim(Math.max(2, t)), 0.1, 1.26); m.decal(0.02, () => m.torus([0, 0, -0.07], [0, 0, 1], 0.2, 0.03, P.black, { segs: 12 })); });
    m.at(h.head, () => {
      eyes(m, 0.19, core(t, P.red));
      m.extrude([[-0.2, 0.06], [0.14, 0.12], [0.1, 0.3 + 0.02 * t], [-0.04, 0.24], [-0.12, 0.32 + 0.02 * t], [-0.22, 0.22]], 0.05, t >= 4 ? P.aether : P.magenta);
      halo(m, p, 0.2, 0.44);
    });
    m.at(frameAt(h.pR, norm(p.mix<V3>([0.3, -0.2, 1], [1, -0.2, -0.3], { wind: [-0.6, 0, 1] }))), () => {
      const L2 = 0.5 + 0.02 * t;
      shaft(m, 0.14, L2, 0.022, P.steel);
      m.box([L2, 0, 0], [0.16, 0.14 + 0.01 * t, 0.2 + 0.01 * t], P.armorDk);
      m.decal(0.02, () => { for (const s of [1, -1]) m.box([L2, 0, s * (0.105 + 0.005 * t)], [0.12, 0.1, 0.02], core(t, P.plasma)); });
      if (t >= 3) m.cone([L2 + 0.08, 0, 0], [L2 + 0.2, 0, 0], 0.05, P.gold, { segs: 6 });
    });
    if (p.hit) { slashArc(m, h, [0.05, 0, 0.3], 0.6, 85, -60, -0.35, P.plasma); puff(m, h.pt([0.5, 0, 0.06]), 0.08, 0.3, P.hot, 2); }
  },
};

/** Ronin: slim, a wide rain hat with a lit rim, one long light-katana. The cast is the parry. */
export const duelist: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, parry = p.is("cast"), th = thrust(p, 0.38);
    const hand = parry ? p.mix<V3>([0.12, 0.2, 0.38], [0.24, 0.02, 0.5], { castWind: [0.1, 0.22, 0.36] }) : th.hand;
    const aim = parry ? norm(p.mix<V3>([1, 0, 0.35], [0.1, -1, 0.5], { castWind: [1, 0.2, 0.2] })) : th.aim;
    const h = crew(m, p, { weight: "light", bulk: 0.84, handR: hand, handL: p.mix<V3>([0.0, -0.22, 0.34], [-0.1, -0.24, 0.42]), twist: parry ? 0 : 16, torso: P.team, arms: P.team, legs: P.black });
    skirt(m, h, P.black, 0.2, 0.2);
    m.at(h.chest, () => { m.decal(0.02, () => m.torus([0, 0, -0.07], [0, 0, 1], 0.165, 0.03, t >= 3 ? P.gold : P.white, { segs: 12 })); if (t >= 2) pads(m, trim(t), 0.05, 0.84); });
    m.at(h.head, () => {
      // the hat: a shallow cone, lit round the rim
      m.cone([0, 0, 0.06], [0, 0, 0.24], 0.26 + 0.008 * t, P.armor, { segs: 14 });
      m.decal(0.02, () => m.torus([0, 0, 0.065], [0, 0, 1], 0.255 + 0.008 * t, 0.02, core(t, P.teamLt), { segs: 18 }));
      eyes(m, 0.19, core(t));
      halo(m, p, 0.2, 0.36);
    });
    m.at(h.aim("R", aim), () => blade(m, 0.56 + 0.03 * t, t >= 4 ? P.aether : P.teamGlow, trim(Math.max(2, t)), 0.016));
    if (p.hit && !parry) slashArc(m, h, [0.1, 0.1, 0.42], 0.56, 30, -30, 0);
    if (p.hit && parry) { const c = h.pt([0.34, -0.1, 0.5]); for (let i = 0; i < 5; i++) { const a = i * 1.26; m.cone(c, [c[0] + 0.02, c[1] + Math.cos(a) * 0.16, c[2] + Math.sin(a) * 0.16], 0.022, P.hot, { segs: 4 }); } }
  },
};

/** Stunpike: a very long shock pole with a forked tip. Braces it against anything that charges. */
export const pikeman: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, brace = p.is("cast");
    const R = brace ? p.mix<V3>([0.02, 0.18, 0.36], [0.0, 0.16, 0.2], { castWind: [0.0, 0.2, 0.4] }) : p.mix<V3>([0.02, 0.18, 0.36], [0.2, 0.12, 0.4], { wind: [-0.16, 0.2, 0.42] });
    const L = brace ? p.mix<V3>([0.26, -0.04, 0.42], [0.3, 0.0, 0.34], { castWind: [0.24, -0.06, 0.46] }) : p.mix<V3>([0.26, -0.04, 0.42], [0.42, 0.0, 0.42], { wind: [0.1, -0.04, 0.46] });
    const h = crew(m, p, { weight: "mid", handR: R, handL: L, lunge: brace ? 0 : 0.8, torso: P.team, arms: P.armorDk });
    skirt(m, h, P.team, 0.1, 0.2);
    m.at(h.chest, () => pads(m, trim(Math.max(1, t)), 0.075));
    m.at(h.head, () => { helm(m, 0.19, P.armor, core(t)); m.cone([-0.02, 0, 0.18], [-0.06, 0, 0.36 + 0.03 * t], 0.05, trim(Math.max(2, t)), { segs: 6 }); halo(m, p, 0.19, 0.5); });
    m.at(gripAim(h.pR, h.pL), () => {
      const L2 = 1.0 + 0.05 * t;
      shaft(m, 0.3, L2, 0.017, P.steel);
      m.box([L2 - 0.12, 0, 0], [0.1, 0.05, 0.05], P.armorDk);
      for (const s of [1, -1]) m.tube([[L2 - 0.08, 0, 0], [L2, s * 0.05, 0], [L2 + 0.14, s * 0.035, 0]], [0.014, 0.012, 0.006], t >= 4 ? P.aether : P.teamLt, { segs: 5 });
      if (t >= 2) m.decal(0.01, () => m.box([0.5, 0, 0], [0.2, 0.04, 0.04], P.team));
      if (p.hit) arcBolt(m, [L2 + 0.02, 0.04, 0], [L2 + 0.14, -0.04, 0], 0.014, 3);
      if (p.hit && !brace) flash(m, [L2 + 0.12, 0, 0], 0.06, P.arc);
    });
  },
};

/** Meltdown: sprints at the enemy with an unstable power cell strapped on. The cell is most of it. */
export const keg: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const h = crew(m, p, { weight: "light", bulk: 0.92, size: 0.96, lean: 20, handR: p.mix<V3>([0.1, 0.2, 0.44], [0.2, 0.26, 0.6]), handL: p.mix<V3>([0.1, -0.2, 0.44], [0.2, -0.26, 0.6]), swingR: 0.5, swingL: 0.5, torso: P.team, arms: P.team, stride: 0.44, skin: P.skin });
    m.at(h.head, () => { cap(m, 0.19, P.armorDk, P.laser); visor(m, 0.19, core(t, P.laser), 0.24, 0.0); m.decal(0.03, () => m.ellipsoid([-0.02, 0, 0.19], [0.17, 0.045, 0.03], P.laser, { segs: 8 })); halo(m, p, 0.19, 0.6); });
    // the cell on the back: a fat canister, hazard bands, a core that is about to go
    m.at(h.back, () => {
      const r = 0.15 + 0.008 * t, hh = 0.36 + 0.02 * t, beat = p.is("walk") || p.is("idle") ? 0.5 + 0.5 * p.wave(1, 2) : 1;
      m.move(0.06 + r * 0.5, 0, 0.02);
      m.cylinder([0, 0, -hh * 0.45], [0, 0, hh * 0.55], r, P.armorDk, r, { segs: 12 });
      for (const z of [-hh * 0.34, hh * 0.44]) m.cylinder([0, 0, z - 0.025], [0, 0, z + 0.025], r * 1.06, t >= 3 ? P.gold : t === 2 ? P.chrome : P.laser, r * 1.06, { segs: 12 });
      m.decal(0.01, () => m.cylinder([0, 0, -hh * 0.14], [0, 0, hh * 0.24], r * 1.05, beat > 0.5 ? P.red : P.magenta, r * 1.05, { segs: 12 }));
      m.sphere([0, 0, hh * 0.62], r * 0.5, t >= 4 ? P.aether : P.red, { segs: 8 });
    });
    if (p.hit) { m.sphere(h.pt([0.05, 0, 0.4]), 0.36, P.plasma, { segs: 10 }); m.sphere(h.pt([0.05, 0, 0.42]), 0.22, P.hot, { segs: 8 }); }
  },
};

// ------------------------------------------------------------------------------------------------ shooters
/** Tracer: a visor'd shooter in a team jacket. Keeps its distance; the long rail rifle is the silhouette. */
export const ranger: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, [R, L] = stance(p);
    const h = crew(m, p, { weight: "light", bulk: 0.92, torso: P.team, arms: P.team, handR: R, handL: L, lunge: 0, recoil: 0.035, swingR: 0.3, swingL: 0.3 });
    skirt(m, h, P.team, 0.06, 0.185);
    m.at(h.chest, () => { if (t >= 2) pads(m, trim(t), 0.068, 0.92); });
    if (t >= 3) m.at(h.back, () => pack(m, 0.17, 0.2, P.armorDk, core(t)));
    m.at(h.head, () => {
      helm(m, 0.19, t >= 3 ? P.armor : P.armorDk, core(t));
      if (t >= 3) m.cylinder([-0.1, 0.1, 0.1], [-0.16, 0.12, 0.42], 0.012, trim(t), 0.008, { segs: 5 });
      halo(m, p);
    });
    m.at(gripAim(h.pR, h.pL), () => {
      const len = 0.52 + 0.03 * t;
      railRifle(m, t, len);
      if (p.hit) flash(m, [len + 0.02, 0, 0.014], 0.08);
    });
  },
};

/** Lobber: stout, a bandolier of canisters, one always in the throwing hand. */
export const grenadier: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.1, 0.22, 0.36], [0.34, 0.1, 0.62], { wind: [-0.14, 0.24, 0.66] });
    const h = crew(m, p, { weight: "mid", bulk: 1.2, handR: R, handL: [0.16, -0.2, 0.34], twist: 22, lunge: 0.5, torso: P.team, arms: P.armorDk });
    skirt(m, h, P.team, 0.05, 0.22);
    m.at(h.chest, () => {
      m.decal(0.02, () => m.group(() => { for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6; m.sphere([0.15 * Math.cos(a) * 1.25, 0.2 * Math.sin(a) * 1.2, 0.06 - i * 0.045], 0.04, i % 2 ? P.laser : P.magenta, { segs: 6 }); } }));
      pads(m, trim(Math.max(1, t)), 0.08, 1.2);
    });
    if (t >= 3) m.at(h.back, () => pack(m, 0.24, 0.2, P.armorDk, core(t)));
    m.at(h.head, () => { helm(m, 0.19, P.armor, core(t), null, P.laser); halo(m, p); });
    const can = (c: V3, r = 0.065) => { m.sphere(c, r, t >= 4 ? P.aether : P.laser, { segs: 8 }); m.cylinder([c[0], c[1], c[2] + r * 0.7], [c[0], c[1], c[2] + r * 1.4], r * 0.4, P.chrome, r * 0.4, { segs: 6 }); };
    if (!p.after) can([h.pR[0], h.pR[1], h.pR[2] + 0.05]);
    can([h.pL[0], h.pL[1], h.pL[2] + 0.02], 0.055);
  },
};

/** Skimmer and Tracer share the pistol: a short machine pistol along +x. */
export function pistol(m: Model, tier: number, len = 0.3) {
  m.box([0.02, 0, -0.02], [0.1, 0.045, 0.1], P.black);
  m.box([len / 2 + 0.02, 0, 0.02], [len, 0.05, 0.055], tier >= 3 ? P.gold : P.chrome);
  m.decal(0.02, () => m.box([len / 2 + 0.04, 0, 0.02], [len * 0.7, 0.056, 0.014], tier >= 4 ? P.aether : P.magenta));
}

/** Washout: a riot-hose trooper. A pressure tank on the back, a nozzle as thick as an arm, a wave down the lane. */
export const tide: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, [R, L] = stance(p);
    const h = crew(m, p, { weight: "mid", bulk: 1.08, torso: P.team, arms: P.armorDk, handR: R, handL: L, lunge: 0, recoil: 0.06 });
    skirt(m, h, P.team, 0.12, 0.21);
    m.at(h.back, () => {
      for (const s of [1, -1]) { m.group(() => { m.cylinder([0.08, s * 0.085, -0.14], [0.08, s * 0.085, 0.14], 0.08, P.ice, 0.08, { segs: 10 }); m.sphere([0.08, s * 0.085, 0.14], 0.08, P.ice, { segs: 10 }); }); m.decal(0.01, () => m.cylinder([0.08, s * 0.085, -0.02], [0.08, s * 0.085, 0.04], 0.083, trim(Math.max(1, t)), 0.083, { segs: 10 })); }
      if (t >= 4) m.sphere([0.1, 0, 0.26], 0.05, P.aether, { segs: 8 });
    });
    m.at(h.head, () => { helm(m, 0.19, P.armor, core(t)); m.decal(0.02, () => m.cylinder([0, 0, -0.02], [0, 0, 0.02], 0.25, P.ice, 0.25, { segs: 14 })); halo(m, p, 0.2, 0.4); });
    m.tube([h.pt([-0.16, 0.1, 0.5]), h.pt([-0.1, 0.3, 0.3]), h.pR], 0.028, P.black, { segs: 6 });
    m.at(gripAim(h.pR, h.pL), () => {
      const len = 0.4 + 0.02 * t;
      m.cylinder([-0.04, 0, 0], [len, 0, 0], 0.05, t >= 3 ? P.gold : P.chrome, 0.06, { segs: 10 });
      m.cylinder([len, 0, 0], [len + 0.05, 0, 0], 0.075, P.armorDk, 0.075, { segs: 10 });
      if (p.hit) { m.cone([len + 1.0, 0, 0], [len, 0, 0], 0.26, WATER, { segs: 10 }); m.sphere([len + 0.95, 0, 0], 0.2, P.frost, { segs: 8 }); }
      else if (p.after) { m.cone([len + 1.3, 0, -0.04], [len + 0.4, 0, 0], 0.22, WATER, { segs: 10 }); }
      else if (p.blend < 0) m.sphere([len + 0.07, 0, 0], 0.05, WATER, { segs: 6 });
    });
  },
};

// ------------------------------------------------------------------------------------------------ casters
/** Arcjack: a hooded hacker with a tall antenna staff. Lightning chains from the coil when it strikes. */
export const storm: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.2, 0.36], [0.3, 0.14, 0.5], { wind: [0.04, 0.22, 0.6] });
    const aim = norm(p.mix<V3>([0.2, 0, 1], [1, 0, 0.45], { wind: [-0.25, 0, 1] }));
    const h = crew(m, p, { weight: "light", bulk: 0.94, handR: R, handL: p.mix<V3>([0.18, -0.16, 0.36], [0.26, -0.12, 0.44], { wind: [0.1, -0.2, 0.34] }), lunge: 0.2, torso: P.team, arms: P.team });
    skirt(m, h, P.team, 0.2, 0.22);
    m.at(h.chest, () => { if (t >= 2) pads(m, trim(t), 0.06, 0.94); });
    m.at(h.head, () => { hood(m, 0.19, P.violet, core(t)); halo(m, p); });
    m.at(frameAt(h.pL, h.dir([1, 0, 0.3])), () => { m.box([0.03, 0, 0.02], [0.1, 0.14, 0.02], P.armorDk); m.decal(0.02, () => m.box([0.03, 0, 0.032], [0.07, 0.1, 0.006], P.violet)); });
    m.at(h.aim("R", aim), () => {
      const L = 0.62 + 0.04 * t;
      shaft(m, 0.34, L, 0.016, P.steel);
      for (let i = 0; i < 2 + Math.min(2, t - 1); i++) m.torus([L - 0.04 - i * 0.07, 0, 0], [1, 0, 0], 0.06 - i * 0.008, 0.014, i === 0 ? trim(Math.max(2, t)) : P.violet, { segs: 10 });
      m.sphere([L + 0.03, 0, 0], 0.045, p.blend !== 0 ? P.arc : core(t, P.violet), { segs: 8 });
      if (p.blend < 0) for (let i = 0; i < 2; i++) arcBolt(m, [L + 0.03, 0, 0], [L - 0.1, 0.12 * (i ? 1 : -1), 0.1], 0.008, p.i + i);
      if (p.hit) { arcBolt(m, [L + 0.03, 0, 0], [L + 0.55, 0.08, -0.1], 0.02, 3); arcBolt(m, [L + 0.03, 0, 0], [L + 0.45, -0.2, 0.08], 0.014, 7); arcBolt(m, [L + 0.2, 0, 0], [L + 0.5, 0.24, 0.1], 0.012, 11); }
    });
  },
};

/** Cryo: coolant tank, spray nozzle, everything ice-white. Whatever it sprays slows down. */
export const rime: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, [R, L] = stance(p);
    const h = crew(m, p, { weight: "light", torso: P.ice, arms: P.ice, legs: P.suit, handR: R, handL: L, lunge: 0, recoil: 0.02 });
    skirt(m, h, P.team, 0.14, 0.21);
    m.at(h.chest, () => pads(m, P.team, 0.07));
    m.at(h.back, () => { m.group(() => { m.cylinder([0.1, 0, -0.16], [0.1, 0, 0.16], 0.1, P.ice, 0.1, { segs: 10 }); m.sphere([0.1, 0, 0.16], 0.1, P.ice, { segs: 10 }); }); m.decal(0.01, () => m.cylinder([0.1, 0, -0.03], [0.1, 0, 0.05], 0.104, P.team, 0.104, { segs: 10 })); if (t >= 3) m.cone([0.1, 0, 0.24], [0.1, 0, 0.4], 0.04, P.gold, { segs: 6 }); });
    m.at(h.head, () => {
      m.ellipsoid([-0.02, 0, 0.06], [0.215, 0.215, 0.2], P.ice); visor(m, 0.2, core(t), 0.3, 0.1);
      for (let i = 0; i < 3 + (t >= 2 ? 2 : 0); i++) { const a = -0.8 + i * (t >= 2 ? 0.4 : 0.8); m.cone([-0.04, Math.sin(a) * 0.12, 0.2], [-0.1, Math.sin(a) * 0.24, 0.36 + 0.02 * t], 0.035, t >= 4 ? P.aether : P.frost, { segs: 4 }); }
    });
    m.at(gripAim(h.pR, h.pL), () => {
      const len = 0.36 + 0.02 * t;
      m.box([0.04, 0, 0], [0.18, 0.06, 0.08], P.armorDk);
      m.cylinder([0.1, 0, 0.01], [len, 0, 0.01], 0.03, trim(Math.max(2, t)), 0.045, { segs: 8 });
      if (p.after) { const k = p.hit ? 0 : 0.2; for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.22; m.cone([len + 0.02, 0, 0.01], [len + 0.5 + k + (i % 2) * 0.12, Math.sin(a) * 0.5, 0.01 + (i % 2 ? 0.06 : -0.04)], 0.04, P.frost, { segs: 4 }); } }
    });
  },
};

/** Rebooter: a tall hooded coder, robe to the floor, a green terminal floating at its hand. Raises what falls. */
export const grave: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.2, 0.18, 0.4], [0.34, 0.1, 0.5], { wind: [0.1, 0.2, 0.56], cast: [0.2, 0.26, 0.8], castWind: [0.16, 0.16, 0.34] });
    const L = p.mix<V3>([0.16, -0.18, 0.36], [0.24, -0.14, 0.44], { cast: [0.2, -0.26, 0.8], castWind: [0.16, -0.16, 0.34] });
    const h = crew(m, p, { weight: "mid", size: 1.06, bulk: 0.96, handR: R, handL: L, lunge: 0.15, torso: P.black, arms: P.black, legs: P.black, hands: P.green });
    skirt(m, h, P.black, 0.24, 0.24);
    m.at(h.chest, () => {
      m.decal(0.02, () => { for (const s of [1, -1]) m.box([0.12, s * 0.07, -0.06], [0.06, 0.05, 0.34], P.team); });
      m.decal(0.02, () => m.box([-0.14, 0, -0.04], [0.04, 0.2, 0.3], P.team));
      if (t >= 2) pads(m, trim(t), 0.06);
    });
    m.at(h.head, () => {
      m.group(() => { m.ellipsoid([-0.03, 0, 0.1], [0.22, 0.215, 0.21], P.black); m.cone([-0.02, 0, 0.2], [-0.14, 0, 0.56 + 0.03 * t], 0.15, P.black, { segs: 8 }); });
      eyes(m, 0.205, t >= 4 ? P.aether : P.heal);
      if (t >= 3) m.decal(0.02, () => m.torus([-0.06, 0, 0.3], [-0.2, 0, 1], 0.12, 0.018, P.gold, { segs: 10 }));
    });
    // the terminal: a pane of green light over the hand
    m.at(frameAt([h.pR[0], h.pR[1], h.pR[2] + 0.1], h.dir([1, 0, 0.6])), () => { m.box([0, 0, 0], [0.02, 0.2 + 0.01 * t, 0.14], P.toxic); m.decal(0.02, () => m.group(() => { for (let i = 0; i < 3; i++) m.box([0.012, -0.03 + (i % 2) * 0.03, 0.04 - i * 0.04], [0.01, 0.1, 0.014], P.dead); })); });
    if (p.hit && !p.is("cast")) m.cone(h.pt([0.9, 0.1, 0.5]), h.pt([0.4, 0.1, 0.5]), 0.05, P.heal, { segs: 6 });
    if (p.is("cast") && p.blend > 0) { m.torus(h.pt([0.5, 0, 0.03]), [0, 0, 1], 0.24 + 0.06 * p.blend, 0.02, P.heal, { segs: 14 }); for (let i = 0; i < 3; i++) m.box(h.pt([0.5 + 0.12 * Math.cos(i * 2.1), 0.12 * Math.sin(i * 2.1), 0.1 + 0.16 * p.blend + 0.05 * i]), [0.03, 0.03, 0.06], P.heal); }
  },
};

/** Glitch: what the Rebooter raises. A thin flickering frame: a spine, ribs of light, a head that will not hold still. */
export const thrall: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = chop(p), j = (k: number) => 0.02 * Math.sin(p.i * 2.7 + k * 1.9);
    const h = crew(m, p, { weight: "light", bulk: 0.7, size: 0.96, handR: c.hand, noTorso: true, noHead: true, legs: P.green, arms: P.green, boots: P.green, hands: P.toxic, lean: 12 });
    m.at(h.chest, () => {
      m.box([0, 0, -0.04], [0.05, 0.05, 0.32], P.green);
      for (let i = 0; i < 3; i++) m.box([j(i), j(i + 3), 0.1 - i * 0.09], [0.1, 0.26 - i * 0.04, 0.03], i === 1 ? P.team : P.toxic);
      m.sphere([0.04, 0, 0.04], 0.045, P.teamGlow, { segs: 6 });
    });
    m.at(h.head, () => { m.box([j(5), j(6), 0], [0.24, 0.26, 0.24], P.green); m.decal(0.03, () => m.box([0.125 + j(5), j(6), 0.02], [0.02, 0.2, 0.05], p.is("death") && p.i > 2 ? P.dead : P.teamGlow)); m.box([0.1 + j(1), 0.16 + j(2), 0.16], [0.06, 0.06, 0.06], P.toxic); });
    m.at(h.aim("R", c.aim), () => m.box([0.14, 0, 0], [0.26, 0.03, 0.05], P.toxic));
  },
};

// ------------------------------------------------------------------------------------------------ support
/** Medtech: a white hazard suit with a green cross on the crown, an injector gun, a green burst when it heals. */
export const medic: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, heal = p.is("cast");
    const R = p.mix<V3>([0.18, 0.18, 0.38], [0.34, 0.1, 0.46], { wind: [0.1, 0.2, 0.44], cast: [0.14, 0.2, 0.82], castWind: [0.16, 0.16, 0.32] });
    const h = crew(m, p, { weight: "light", handR: R, handL: p.mix<V3>([0.12, -0.2, 0.34], [0.16, -0.2, 0.36], { cast: [0.14, -0.24, 0.7] }), lunge: 0.1, torso: P.white, arms: P.white, legs: P.whiteDk, boots: P.suit, hands: P.green });
    skirt(m, h, P.white, 0.12, 0.2);
    m.at(h.chest, () => { pads(m, P.team, 0.07); m.decal(0.02, () => m.box([-0.14, 0, 0.02], [0.05, 0.2, 0.2], P.team)); });
    m.at(h.back, () => { if (t >= 2) pack(m, 0.18, 0.18, P.whiteDk, t >= 4 ? P.aether : P.heal); });
    m.at(h.head, () => {
      m.ellipsoid([-0.02, 0, 0.08], [0.215, 0.215, 0.205], P.white);
      visor(m, 0.2, core(t), 0.3, 0.08);
      m.decal(0.03, () => m.group(() => { m.box([-0.02, 0, 0.285], [0.2, 0.07, 0.02], P.heal); m.box([-0.02, 0, 0.285], [0.07, 0.2, 0.02], P.heal); }));
      if (t >= 3) m.decal(0.02, () => m.torus([-0.02, 0, 0.1], [0, 0, 1], 0.215, 0.02, P.gold, { segs: 14 }));
    });
    m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.3], [1, 0, 0.1], { cast: [0, 0, 1] }))), () => {
      m.box([0.04, 0, -0.02], [0.1, 0.045, 0.1], P.whiteDk);
      m.cylinder([0.06, 0, 0.03], [0.24, 0, 0.03], 0.035, P.green, 0.035, { segs: 8 });
      m.cone([0.24, 0, 0.03], [0.34, 0, 0.03], 0.02, P.chrome, { segs: 5 });
      if (p.hit) m.sphere([0.4, 0, 0.03], 0.07, P.heal, { segs: 6 });
    });
    if (heal && p.blend > 0) { m.torus(h.pt([0.05, 0, 0.5]), [0, 0, 1], 0.3 + 0.12 * p.blend, 0.022, P.heal, { segs: 14 }); sparks(m, h, p, P.heal, 0.34, 0.9, 6); }
  },
};

/** Herald: carries the crew's colours as a holo-banner on a tall pole. The banner is the silhouette. */
export const banner: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, rally = p.is("cast");
    const R = p.mix<V3>([0.16, 0.2, 0.4], [0.3, 0.14, 0.44], { wind: [0.08, 0.2, 0.5], cast: [0.14, 0.2, 0.64], castWind: [0.16, 0.2, 0.34] });
    const h = crew(m, p, { weight: "mid", handR: R, handL: p.mix<V3>([0.1, -0.22, 0.34], [0.2, -0.18, 0.4], { cast: [0.1, -0.26, 0.6] }), lunge: 0.3, torso: P.armor, arms: P.armorDk });
    m.at(h.chest, () => { pads(m, P.team, 0.08); m.decal(0.02, () => m.torus([0, 0, 0.0], [0.55, 0.8, 0.5], 0.2, 0.035, P.team, { segs: 14 })); });
    m.at(h.head, () => { helm(m, 0.19, P.armor, core(t), t >= 2 ? P.team : null); halo(m, p, 0.19, 0.5); });
    m.at(h.aim("R", norm(p.mix<V3>([0.08, 0, 1], [0.5, 0, 0.9], { wind: [-0.1, 0, 1], cast: [0, 0, 1] }))), () => {
      const L = 0.95 + 0.05 * t, w = 0.34 + 0.02 * t, hh = 0.44 + 0.03 * t, fl = 0.03 * p.wave(1, 1) + (rally ? 0.04 * p.blend : 0);
      shaft(m, 0.34, L, 0.018, trim(Math.max(1, t)));
      // the banner hangs towards the body's right (local -y is up-screen for the far side): a pane of team light
      m.poly([[L, 0, 0], [L, 0, -w], [L - hh * 0.5, fl, -w * 1.02], [L - hh, -fl, -w], [L - hh, 0, 0]], P.holo);
      m.decal(0.02, () => m.poly([[L - hh * 0.25, 0, -w * 0.2], [L - hh * 0.25, 0, -w * 0.8], [L - hh * 0.4, fl * 0.6, -w * 0.8], [L - hh * 0.4, 0, -w * 0.2]], P.teamLt));
      m.box([L, 0, -w / 2], [0.03, 0.03, w + 0.04], trim(Math.max(2, t)));
      m.sphere([L + 0.04, 0, 0], 0.045, t >= 4 ? P.aether : P.teamGlow, { segs: 8 });
      if (t >= 3) m.decal(0.02, () => m.poly([[L - hh * 0.6, 0, -w * 0.3], [L - hh * 0.6, 0, -w * 0.7], [L - hh * 0.72, 0, -w * 0.7], [L - hh * 0.72, 0, -w * 0.3]], P.teamLt));
    });
    if (rally && p.blend > 0) { m.torus(h.pt([0.05, 0, 0.04]), [0, 0, 1], 0.3 + 0.2 * p.blend, 0.022, P.teamGlow, { segs: 16 }); sparks(m, h, p, P.teamLt, 0.36, 0.5, 6); }
    if (p.hit && !rally) slashArc(m, h, [0.1, 0, 0.5], 0.5, 40, -30, -0.2);
  },
};

/** Prism: a shield projector on a long pole. The lit crystal at the top is the unit; the cast throws a ward. */
export const lamp: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, ward = p.is("cast");
    const R = p.mix<V3>([0.16, 0.2, 0.38], [0.3, 0.12, 0.46], { wind: [0.08, 0.2, 0.5], cast: [0.16, 0.2, 0.6], castWind: [0.16, 0.2, 0.34] });
    const h = crew(m, p, { weight: "light", handR: R, handL: p.mix<V3>([0.1, -0.2, 0.34], [0.18, -0.16, 0.4], { cast: [0.2, -0.2, 0.56] }), lunge: 0.2, torso: P.team, arms: P.team });
    skirt(m, h, P.team, 0.18, 0.22);
    m.at(h.chest, () => { if (t >= 2) pads(m, trim(t), 0.06); });
    m.at(h.head, () => { cap(m, 0.19, P.armor, P.armorDk); visor(m, 0.19, core(t), 0.2, 0.0); m.decal(0.02, () => m.sphere([-0.02, 0, 0.21], 0.06, P.lamp, { segs: 6 })); halo(m, p, 0.19, 0.44); });
    m.at(h.aim("R", norm(p.mix<V3>([0.12, 0, 1], [0.8, 0, 0.7], { wind: [-0.1, 0, 1], cast: [0, 0, 1] }))), () => {
      const L = 0.8 + 0.04 * t, r = 0.09 + 0.008 * t;
      shaft(m, 0.34, L - r, 0.016, P.steel);
      m.box([L - r - 0.03, 0, 0], [0.05, 0.1, 0.1], trim(Math.max(2, t)));
      m.group(() => { m.cone([L, 0, 0], [L + r * 1.5, 0, 0], r, t >= 4 ? P.aether : P.lamp, { segs: 6 }); m.cone([L, 0, 0], [L - r * 1.1, 0, 0], r, t >= 4 ? P.aether : P.lamp, { segs: 6 }); });
      if (t >= 3) m.torus([L, 0, 0], [1, 0, 0], r * 1.5, 0.012, P.gold, { segs: 12 });
      if (p.hit && !ward) flash(m, [L + r * 1.6, 0, 0], 0.07, P.lamp);
    });
    if (ward && p.blend > 0) { const c = h.pt([0.5, 0, 0.0]); for (const k of [0.34, 0.24]) m.torus([c[0], c[1], 0.04 + (0.34 - k) * 1.6], [0, 0, 1], k + 0.1 * p.blend, 0.02, P.lamp, { segs: 16 }); }
  },
};

/** Rigger: a wrench as long as an arm and a pack of parts. Builds a Sentry on the cast, mends machines. */
export const tinker: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), build = p.is("cast");
    const hand = build ? p.mix<V3>([0.14, 0.2, 0.38], [0.34, 0.06, 0.16], { castWind: [0.0, 0.22, 0.66] }) : c.hand;
    const aim = build ? norm(p.mix<V3>([0.45, 0.1, 1], [1, -0.2, -0.6], { castWind: [-0.4, 0.1, 1] })) : c.aim;
    const h = crew(m, p, { weight: "mid", bulk: 1.05, handR: hand, handL: p.mix<V3>([0.14, -0.2, 0.34], [0.2, -0.16, 0.3]), twist: 16, torso: P.team, arms: P.armorDk, legs: P.team });
    m.at(h.chest, () => { m.decal(0.02, () => m.torus([0, 0, -0.07], [0, 0, 1], 0.185, 0.035, P.black, { segs: 12 })); if (t >= 2) pads(m, trim(t), 0.065, 1.05); });
    m.at(h.back, () => {
      pack(m, 0.3, 0.28, P.armorDk, core(t));
      m.cylinder([0.06, 0.1, 0.14], [0.06, 0.14, 0.4 + 0.03 * t], 0.012, P.steel, 0.008, { segs: 5 }); m.sphere([0.06, 0.14, 0.42 + 0.03 * t], 0.028, P.red, { segs: 6 });
      if (t >= 3) m.with(() => { m.move(0.06, -0.1, 0.2).rotX(p.i * 30); m.torus([0, 0, 0], [1, 0, 0], 0.07, 0.022, P.gold, { segs: 8 }); });
    });
    m.at(h.head, () => { cap(m, 0.19, P.gold, P.gold); visor(m, 0.19, core(t), 0.22, 0.0); halo(m, p, 0.19, 0.44); });
    m.at(h.aim("R", aim), () => {
      const L = 0.36 + 0.02 * t;
      shaft(m, 0.06, L, 0.024, trim(Math.max(2, t)));
      m.group(() => { for (const s of [1, -1]) m.box([L + 0.05, 0, s * 0.045], [0.12, 0.04, 0.035], trim(Math.max(2, t))); m.box([L, 0, 0], [0.04, 0.045, 0.12], trim(Math.max(2, t))); });
    });
    if (p.hit) { const c2 = h.pt([0.46, 0, build ? 0.08 : 0.3]); for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.3; m.cone(c2, [c2[0] + Math.cos(a) * 0.14, c2[1] + Math.sin(a) * 0.14, c2[2] + 0.1], 0.02, P.laser, { segs: 4 }); } }
  },
};

/** Borer: a hard hat with a lamp, a drill for an arm. Goes under the street and comes up behind the line. */
export const sapper: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, th = thrust(p, 0.36);
    const h = crew(m, p, { weight: "mid", bulk: 1.06, handR: th.hand, handL: p.mix<V3>([0.2, -0.1, 0.36], [0.3, -0.04, 0.4], { wind: [0.1, -0.14, 0.4] }), torso: P.team, arms: P.armorDk, lunge: 0.8 });
    m.at(h.chest, () => { m.decal(0.02, () => { for (const s of [1, -1]) m.box([0.13, s * 0.08, 0.0], [0.04, 0.035, 0.3], P.laser); }); if (t >= 2) pads(m, trim(t), 0.07, 1.06); });
    if (t >= 3) m.at(h.back, () => pack(m, 0.2, 0.22, P.armorDk, core(t)));
    m.at(h.head, () => {
      cap(m, 0.2, P.white, P.white); visor(m, 0.19, core(t), 0.2, -0.05);
      m.decal(0.03, () => m.sphere([0.15, 0, 0.14], 0.055, p.is("death") && p.i > 2 ? P.dead : P.lamp, { segs: 6 }));
      halo(m, p, 0.19, 0.44);
    });
    m.at(h.aim("R", th.aim), () => {
      const L = 0.3 + 0.02 * t;
      m.box([0.05, 0, 0], [0.2, 0.1, 0.1], P.armorDk);
      m.decal(0.02, () => m.box([0.05, 0, 0.052], [0.12, 0.05, 0.01], P.team));
      m.with(() => { m.move(0.15, 0, 0).rotX(p.i * 55); m.cone([0, 0, 0], [L, 0, 0], 0.075 + 0.005 * t, t >= 3 ? P.gold : P.chrome, { segs: 6 }); m.decal(0.01, () => m.torus([L * 0.4, 0, 0], [1, 0, 0], 0.05, 0.012, t >= 4 ? P.aether : P.magenta, { segs: 6 })); });
      if (p.hit) flash(m, [L + 0.16, 0, 0], 0.06, P.laser);
    });
  },
};

/** Grappler: heavy, a mag-hook launcher for an arm and a cable drum on the back. The cast fires the hook. */
export const hook: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, fire = p.is("cast");
    const R = p.mix<V3>([0.2, 0.2, 0.36], [0.38, 0.14, 0.4], { wind: [0.02, 0.22, 0.44], cast: [0.34, 0.16, 0.44], castWind: [0.06, 0.22, 0.42] });
    const h = crew(m, p, { weight: "heavy", bulk: 1.28, size: 1.06, handR: R, handL: p.mix<V3>([0.14, -0.24, 0.32], [0.22, -0.2, 0.34]), twist: 14, lunge: fire ? 0 : 0.7, torso: P.armor, arms: P.armorDk });
    m.at(h.chest, () => { pads(m, P.team, 0.1, 1.28); m.decal(0.02, () => m.box([0.14, 0, 0.0], [0.04, 0.2, 0.14], P.team)); });
    m.at(h.back, () => { m.with(() => { m.move(0.1, 0, 0); m.cylinder([0, -0.15, 0], [0, 0.15, 0], 0.13, P.team, 0.13, { segs: 12 }); for (const s of [1, -1]) m.cylinder([0, s * 0.15, 0], [0, s * 0.17, 0], 0.15, trim(Math.max(1, t)), 0.15, { segs: 12 }); }); });
    m.at(h.head, () => { m.box([0, 0, 0.02], [0.34, 0.34, 0.34], P.armorDk); m.decal(0.03, () => m.box([0.175, 0, 0.03], [0.02, 0.24, 0.08], core(t))); m.decal(0.02, () => m.box([0, 0, 0.195], [0.2, 0.08, 0.02], P.teamLt)); halo(m, p, 0.2, 0.42); });
    m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.2], [1, 0, 0], { wind: [1, 0, 0.4] }))), () => {
      m.box([0.1, 0, 0], [0.3, 0.13, 0.13], P.armorDk);
      m.decal(0.01, () => m.box([0.1, 0, 0.066], [0.2, 0.06, 0.01], P.team));
      const out = fire ? Math.max(0, p.blend) * 0.7 : p.hit ? 0.12 : 0, x = 0.28 + out;
      if (out > 0.02) m.cylinder([0.25, 0, 0], [x, 0, 0], 0.012, P.chrome, 0.012, { segs: 4 });
      m.group(() => { for (const a of [0, 2.1, 4.2]) m.tube([[x, 0, 0], [x + 0.08, Math.cos(a) * 0.08, Math.sin(a) * 0.08], [x + 0.17 + 0.01 * t, Math.cos(a) * 0.045, Math.sin(a) * 0.045]], [0.02, 0.016, 0.006], t >= 3 ? P.gold : P.chrome, { segs: 5 }); });
      m.sphere([x, 0, 0], 0.035, t >= 4 ? P.aether : P.magenta, { segs: 6 });
      if (p.hit) flash(m, [0.27, 0, 0], 0.05);
    });
  },
};

/** Biohacker: a tank of glowing vines on the back and a seed gun. Whatever it plants grows thorns. */
export const thorn: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, [R, L] = stance(p);
    const h = crew(m, p, { weight: "light", torso: P.team, arms: P.green, legs: P.suit, handR: R, handL: L, lunge: 0, recoil: 0.02 });
    skirt(m, h, P.team, 0.1, 0.2);
    m.at(h.back, () => {
      m.cylinder([0.1, 0, -0.16], [0.1, 0, 0.16], 0.11, P.toxic, 0.11, { segs: 10 });
      for (const z of [-0.16, 0.16]) m.cylinder([0.1, 0, z - 0.02], [0.1, 0, z + 0.02], 0.12, trim(Math.max(1, t)), 0.12, { segs: 10 });
      // what is growing out of it
      const n = 3 + t;
      m.group(() => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, sw = 0.02 * p.wave(1, 1, i / n); m.tube([[0.1, 0, 0.18], [0.1 + Math.cos(a) * 0.1 + sw, Math.sin(a) * 0.12, 0.3], [0.1 + Math.cos(a) * 0.2 + sw, Math.sin(a) * 0.22, 0.26 + 0.03 * (i % 3)]], [0.02, 0.016, 0.01], P.green, { segs: 5 }); } });
      for (let i = 0; i < n; i += 2) { const a = (i / n) * Math.PI * 2; m.sphere([0.1 + Math.cos(a) * 0.2, Math.sin(a) * 0.22, 0.26 + 0.03 * (i % 3)], 0.04, t >= 4 ? P.aether : P.magenta, { segs: 6 }); }
    });
    m.at(h.head, () => { m.ellipsoid([-0.02, 0, 0.08], [0.21, 0.21, 0.2], P.green); visor(m, 0.2, core(t), 0.3, 0.1); m.decal(0.02, () => m.cylinder([0.12, 0, -0.08], [0.2, 0, -0.1], 0.05, P.armorDk, 0.05, { segs: 6 })); for (const s of [1, -1]) m.cone([-0.04, s * 0.08, 0.24], [-0.1, s * 0.2, 0.38], 0.04, P.green, { segs: 5 }); halo(m, p, 0.19, 0.46); });
    m.at(gripAim(h.pR, h.pL), () => {
      m.box([0.04, 0, 0], [0.18, 0.06, 0.08], P.armorDk);
      m.cylinder([0.1, 0, 0.01], [0.36, 0, 0.01], 0.04, P.green, 0.05, { segs: 8 });
      m.sphere([0.08, 0, 0.08], 0.06, P.toxic, { segs: 6 });
      if (p.hit) for (let i = 0; i < 3; i++) m.sphere([0.5 + i * 0.14, (i - 1) * 0.1, 0.02 + 0.05 * i], 0.04, P.toxic, { segs: 5 });
    });
  },
};

// ------------------------------------------------------------------------------------------------ showmen
/** The Mirage, and its Echo. A showman in a cape of light and a tall hat; the fake is the same figure, see-through. */
function showman(m: Model, p: Pose, t: number, fake: boolean) {
  const M = (solid: Material, dk = false) => (fake ? (dk ? GHOST_DK : GHOST) : solid);
  const castK = p.is("cast");
  const R = p.mix<V3>([0.18, 0.2, 0.4], [0.36, 0.1, 0.46], { wind: [0.02, 0.24, 0.6], cast: [0.1, 0.34, 0.66], castWind: [0.14, 0.14, 0.4] });
  const L = p.mix<V3>([0.1, -0.22, 0.36], [0.14, -0.24, 0.4], { cast: [0.1, -0.34, 0.66], castWind: [0.14, -0.14, 0.4] });
  const h = crew(m, p, { weight: "light", bulk: 0.9, handR: R, handL: L, twist: castK ? 0 : 14, lunge: 0.4, torso: M(P.armor), arms: M(P.armorDk), legs: M(P.suit, true), boots: M(P.black, true), hands: M(P.white), skin: M(P.white) });
  m.at(h.chest, () => { cape(m, p, fake ? GHOST_DK : P.team, 0.36, 0.42); if (!fake) m.decal(0.02, () => m.box([0.14, 0, 0.02], [0.03, 0.08, 0.08], P.magenta)); if (t >= 2 && !fake) pads(m, trim(t), 0.06, 0.9); });
  m.at(h.head, () => {
    // the hat: a tall cylinder with a lit band and a wide brim
    m.with(() => {
      m.move(-0.01, 0, 0.1).rotY(-6);
      m.group(() => { m.cylinder([0, 0, 0], [0, 0, 0.025], 0.27, M(P.armorDk, true), 0.27, { segs: 14 }); m.cylinder([0, 0, 0.02], [0, 0, 0.3 + 0.03 * t], 0.15, M(P.armorDk, true), 0.17, { segs: 12 }); });
      m.cylinder([0, 0, 0.04], [0, 0, 0.11], 0.158, fake ? GHOST : P.team, 0.16, { segs: 12 });
      if (t >= 3 && !fake) m.decal(0.01, () => m.torus([0, 0, 0.3 + 0.03 * t], [0, 0, 1], 0.165, 0.014, P.gold, { segs: 12 }));
    });
    eyes(m, 0.19, fake ? GHOST : core(t, P.magenta));
    if (!fake) halo(m, p, 0.19, 0.62);
  });
  m.at(h.aim("R", norm(p.mix<V3>([0.6, 0, 0.8], [1, 0, 0.1], { wind: [0, 0, 1], cast: [0, 0.5, 1] }))), () => { shaft(m, 0.06, 0.34, 0.014, M(P.black, true)); m.sphere([0.36, 0, 0], 0.035, fake ? GHOST : core(t, P.magenta), { segs: 6 }); });
  if (!fake && p.hit) flash(m, h.pt([0.6, 0.05, 0.44]), 0.06, P.magenta);
  if (!fake && castK && p.after) for (const s of [1, -1]) { const c = h.pt([0.1, s * 0.5, 0.5]); m.box(c, [0.03, 0.14, 0.3], GHOST); m.sphere([c[0], c[1], c[2] + 0.22], 0.07, GHOST, { segs: 6 }); }
}
export const trickster: UnitDef = { weight: "light", cast: true, build: (m, p) => showman(m, p, p.tier, false) };
export const decoy: UnitDef = { weight: "light", build: (m, p) => showman(m, p, 1, true) };

/** Shogun: the crew boss. A head taller, a crescent crest, a long coat of team light, a great blade. Rallies. */
export const lion: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), rally = p.is("cast");
    const hand = rally ? p.mix<V3>([0.14, 0.2, 0.38], [0.1, 0.2, 0.86], { castWind: [0.16, 0.2, 0.3] }) : c.hand;
    const aim = rally ? norm(p.mix<V3>([0.45, 0.1, 1], [0.1, 0, 1], { castWind: [1, 0, 0] })) : c.aim;
    const h = crew(m, p, { weight: "heavy", bulk: 1.18, size: 1.14, handR: hand, handL: p.mix<V3>([0.1, -0.24, 0.34], [0.02, -0.28, 0.42], { cast: [0.16, -0.2, 0.6] }), twist: rally ? 0 : 26, torso: P.team, arms: P.team, legs: P.armorDk });
    skirt(m, h, P.team, 0.16, 0.25);
    m.at(h.chest, () => {
      for (const s of [1, -1]) { m.box([-0.01, s * 0.23, 0.14], [0.2, 0.14, 0.05], P.gold); m.box([-0.01, s * 0.27, 0.09], [0.18, 0.1, 0.04], t >= 2 ? P.gold : P.chrome); }
      m.decal(0.02, () => m.torus([0, 0, -0.08], [0, 0, 1], 0.2, 0.035, P.gold, { segs: 12 }));
      cape(m, p, P.teamDk, 0.36, 0.4);
    });
    m.at(h.head, () => {
      helm(m, 0.2, P.armor, core(t), null, null);
      // the crest: a crescent of gold, a plume of team light behind it
      m.with(() => { m.move(0.1, 0, 0.16).rotY(-20); m.torus([0, 0, 0.06], [1, 0, 0], 0.15 + 0.008 * t, 0.026, P.gold, { segs: 14 }); });
      m.capsule([-0.08, 0, 0.2], [-0.24, 0, 0.44 + 0.03 * t], 0.05, t >= 4 ? P.aether : P.teamLt, 0.08 + 0.01 * t, { segs: 8 });
    });
    m.at(h.aim("R", aim), () => blade(m, 0.6 + 0.03 * t, t >= 4 ? P.aether : P.teamGlow, P.gold, 0.024));
    if (p.hit && !rally) slashArc(m, h, [0.05, 0, 0.36], 0.6, 75, -50, -0.3);
    if (rally && p.blend > 0) m.torus(h.pt([0.05, 0, 0.04]), [0, 0, 1], 0.34 + 0.22 * p.blend, 0.024, P.teamGlow, { segs: 16 });
    if (rally) sparks(m, h, p, P.lamp, 0.34, 1.0, 6);
  },
};
void strip;
