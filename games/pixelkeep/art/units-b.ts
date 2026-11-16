// Pixelkeep's beasts, riders, slimes and machines.
import { flyer, quadruped, structure, type Pose, type QuadRig, type UnitDef } from "../../../artkit/rig";
import { Model, norm, type Material, type V3 } from "../../../artkit/toon3d";
import { HEAD, P, blade, bow, flash, guy, helm, hood, puff, rank, shield, sparkle, spear, trim } from "./parts";

const r = HEAD;

/** A bat-style wing in the local x-y plane, reaching out along sign `s` * y. */
export function wing(m: Model, s: number, span: number, col: Material, bone: Material) {
  m.poly([[0.1, 0, 0], [0.16, s * span * 0.55, 0], [0.04, s * span, 0], [-0.08, s * span * 0.7, 0], [-0.06, s * span * 0.45, 0], [-0.2, s * span * 0.3, 0], [-0.14, 0, 0]], col);
  m.tube([[0.1, 0, 0.005], [0.16, s * span * 0.55, 0.005], [0.04, s * span, 0.005]], 0.02, bone, { segs: 4 });
}

/** A mount's body on the quadruped rig: a barrel, a neck and a blocky head, a tail, and a team blanket. */
function mount(m: Model, q: QuadRig, o: { L: number; W: number; col: Material; dk: Material; wolf?: boolean; cloth?: Material | null; trim?: Material }) {
  const { L, W } = o;
  m.at(q.body, () => {
    m.group(() => {
      m.ellipsoid([0, 0, 0], [L * 1.1, W * 1.15, 0.14], o.col, { segs: 8 });
      if (o.wolf) { m.tube([[L * 0.8, 0, 0.04], [L + 0.1, 0, 0.12]], [0.11, 0.1], o.col, { segs: 6 }); m.box([L + 0.2, 0, 0.13], [0.2, 0.19, 0.16], o.col); m.box([L + 0.34, 0, 0.09], [0.14, 0.11, 0.09], o.col); }
      else { m.tube([[L * 0.8, 0, 0.04], [L + 0.08, 0, 0.3]], [0.11, 0.085], o.col, { segs: 6 }); m.box([L + 0.17, 0, 0.33], [0.26, 0.14, 0.14], o.col); }
    });
    if (o.wolf) { for (const s of [1, -1]) m.cone([L + 0.14, s * 0.07, 0.2], [L + 0.12, s * 0.09, 0.34], 0.045, o.dk, { segs: 4 }); m.tube([[-L, 0, 0.04], [-L - 0.16, 0, 0.14], [-L - 0.26, 0, 0.1]], [0.06, 0.07, 0.03], o.dk, { segs: 5 }); m.decal(0.03, () => m.box([L + 0.41, 0, 0.11], [0.04, 0.07, 0.05], P.black)); }
    else { for (const s of [1, -1]) m.box([L + 0.08, s * 0.05, 0.43], [0.05, 0.04, 0.08], o.dk); m.tube([[L * 0.7, 0, 0.14], [L + 0.02, 0, 0.36]], 0.05, o.dk, { segs: 4 }); m.tube([[-L, 0, 0.06], [-L - 0.1, 0, 0.0], [-L - 0.12, 0, -0.16]], [0.045, 0.05, 0.03], o.dk, { segs: 5 }); }
    m.decal(0.03, () => { for (const s of [1, -1]) m.box([L + (o.wolf ? 0.26 : 0.2), s * (o.wolf ? 0.1 : 0.075), o.wolf ? 0.16 : 0.36], [0.04, 0.02, 0.04], P.black); });
    if (o.cloth) { m.decal(0.015, () => m.cylinder([-L * 0.45, 0, 0], [L * 0.45, 0, 0], 0.15, o.cloth!, 0.15, { segs: 8 })); if (o.trim) m.decal(0.02, () => m.cylinder([-L * 0.5, 0, 0], [-L * 0.38, 0, 0], 0.155, o.trim!, 0.155, { segs: 8 })); }
  });
}

/** Cavalier: a knight on a horse with a long levelled lance and a pennant. Charges through lines. */
export const lancer: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { size: 1.0, height: 0.4, length: 0.27, width: 0.13, legs: P.horse, hooves: P.black, legR: 0.045, stride: 0.62 });
    mount(m, q, { L: 0.27, W: 0.13, col: P.horse, dk: P.horseDk, cloth: P.team, trim: trim(t) });
    m.at(q.saddle, () => {
      const R = p.mix<V3>([0.1, 0.22, 0.36], [0.3, 0.18, 0.36], { wind: [-0.02, 0.24, 0.4] });
      const h = guy(m, p, { seated: true, size: 0.82, torso: P.team, arms: P.grey, legs: P.iron, boots: P.ironDk, hands: P.grey, handR: R, handL: [0.2, -0.08, 0.3], lunge: 0 });
      m.at(h.head, () => { helm(m, r, trim(t), { plume: P.team }); if (t >= 4) rank(m, p, r * 1.7); });
      m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.5], [1, -0.06, 0.02], { wind: [1, 0, 0.3] }))), () => {
        const L = 0.85 + 0.05 * t;
        spear(m, 0.3, L, blade(t), 0.026);
        m.decal(0.01, () => m.box([L - 0.16, 0, -0.09], [0.24, 0.02, 0.16], P.teamFlat));
        if (p.hit) flash(m, [L + 0.2, 0, 0], 0.07, P.spark, P.spark);
      });
    });
  },
};

/** Wolf Rider: a hooded archer on a fast grey wolf. Circles and shoots. */
export const outrider: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { size: 0.95, weight: "mid", height: 0.34, length: 0.26, width: 0.125, legs: P.wolf, hooves: P.wolfDk, legR: 0.042, stride: 0.6, lunge: 0.3 });
    mount(m, q, { L: 0.26, W: 0.125, col: P.wolf, dk: P.wolfDk, wolf: true, cloth: P.team, trim: t >= 2 ? trim(t) : undefined });
    m.at(q.saddle, () => {
      const pull = p.mix(0.04, 0.0, { wind: 0.2 });
      const L = p.mix<V3>([0.3, -0.06, 0.42], [0.34, -0.04, 0.46], { wind: [0.32, -0.05, 0.47] });
      const R = p.mix<V3>([0.24, 0.1, 0.42], [0.3, 0.1, 0.46], { wind: [0.08, 0.12, 0.47] });
      const h = guy(m, p, { seated: true, size: 0.82, torso: P.leather, arms: P.leather, legs: P.woodDk, boots: P.leather, handR: R, handL: L, lunge: 0, recoil: 0.03 });
      m.at(h.head, () => { hood(m, r, P.team, 0.4); m.cone([-r * 0.2, r * 0.6, r * 0.8], [-r * 0.9, r * 0.8, r * 1.9], r * 0.3, t >= 3 ? P.gold : P.white, { segs: 4 }); rank(m, p, r * 1.5); });
      m.at(h.aim("L", [1, 0, 0]), () => { bow(m, 0.27, pull, t >= 4 ? P.glory : t >= 3 ? P.gold : P.wood, p.after ? null : P.cream); if (p.hit) sparkle(m, [0.3, 0, 0], 0.04); });
    });
  },
};

/** Bat: wide wings in the team's colour, a tiny dark body, two white fangs. */
export const harrier: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.22 });
    m.at(f.body, () => {
      m.group(() => { m.ellipsoid([0, 0, 0], [0.16, 0.14, 0.14], P.bat, { segs: 8 }); for (const s of [1, -1]) m.cone([0.02, s * 0.08, 0.1], [0.0, s * 0.13, 0.28], 0.06, P.bat, { segs: 4 }); });
      m.decal(0.03, () => { for (const s of [1, -1]) { m.box([0.15, s * 0.06, 0.03], [0.03, 0.06, 0.06], t >= 4 ? P.gloryInk : P.yellow); m.box([0.15, s * 0.035, -0.07], [0.03, 0.035, 0.07], P.white); } });
      const ang = 8 + 36 * f.flap, span = 0.58 + 0.03 * t;
      for (const s of [1, -1]) m.with(() => { m.move(0, s * 0.1, 0.03).rotX(-s * ang); wing(m, s, span, P.team, t >= 3 ? trim(t) : P.teamDk); });
      if (t >= 2) m.decal(0.02, () => m.box([0.0, 0, 0.14], [0.1, 0.1, 0.05], trim(t)));
      if (p.hit) sparkle(m, [0.3, 0, -0.08], 0.05);
    });
  },
};

/** Drake Knight: an armoured rider with a lance on a green winged drake. Dives and stuns. */
export const griffin: UnitDef = {
  weight: "heavy", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.22, lunge: 1.3 });
    m.at(f.body, () => {
      m.group(() => {
        m.ellipsoid([0, 0, 0], [0.3, 0.15, 0.14], P.drake, { segs: 8 });
        m.tube([[0.22, 0, 0.04], [0.38, 0, 0.14]], [0.1, 0.09], P.drake, { segs: 6 });
        m.box([0.47, 0, 0.16], [0.22, 0.17, 0.15], P.drake);
        m.box([0.6, 0, 0.12], [0.12, 0.12, 0.08], P.drake);
        m.tube([[-0.24, 0, 0], [-0.46, 0, 0.04], [-0.62, 0, 0.0]], [0.09, 0.06, 0.02], P.drake, { segs: 5 });
      });
      for (const s of [1, -1]) m.cone([0.42, s * 0.06, 0.22], [0.34, s * 0.09, 0.36], 0.04, P.cream, { segs: 4 });
      m.decal(0.03, () => { for (const s of [1, -1]) m.box([0.52, s * 0.09, 0.19], [0.05, 0.02, 0.05], t >= 4 ? P.gloryInk : P.yellow); });
      m.decal(0.02, () => m.ellipsoid([0.02, 0, -0.06], [0.24, 0.1, 0.09], P.cream, { segs: 6 }));
      const ang = 6 + 34 * f.flap, span = 0.7 + 0.03 * t;
      for (const s of [1, -1]) m.with(() => { m.move(0.04, s * 0.12, 0.06).rotX(-s * ang); wing(m, s, span, P.team, t >= 3 ? trim(t) : P.drakeDk); });
      m.with(() => {
        m.move(-0.04, 0, 0.06);
        const R = p.mix<V3>([0.1, 0.22, 0.36], [0.3, 0.18, 0.34], { wind: [-0.02, 0.24, 0.42] });
        const h = guy(m, p, { seated: true, size: 0.74, torso: P.team, arms: P.grey, legs: P.iron, boots: P.ironDk, hands: P.grey, handR: R, handL: [0.2, -0.08, 0.3], lunge: 0 });
        m.at(h.head, () => { helm(m, r, trim(t), { plume: P.team }); if (t >= 4) rank(m, p, r * 1.7); });
        m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.4], [1, -0.05, -0.3], { wind: [1, 0, 0.5] }))), () => { spear(m, 0.25, 0.7 + 0.04 * t, blade(t), 0.026); if (p.hit) flash(m, [0.95, 0, 0], 0.08, P.spark, P.spark); });
      });
    });
  },
};

// ------------------------------------------------------------------------------------------------ slimes
/** A slime: a wobbling blob with two eyes. Hops to walk, stretches to bite, flattens to die. */
function blob(m: Model, p: Pose, R: number, col: Material, crown: Material | null = null) {
  let sx = 1, sz = 1, x = 0, z = 0;
  if (p.is("idle")) { sz = 1 + 0.08 * p.wave(1); sx = 1 - 0.05 * p.wave(1); }
  else if (p.is("walk")) { const hop = Math.abs(Math.sin(p.t * Math.PI * 2)); z = hop * R * 0.7; sz = 0.82 + 0.34 * hop; sx = 1.12 - 0.18 * hop; p.stride = Math.max(p.stride, R * 2.4); }
  else if (p.is("attack")) { const b = p.blend; if (b < 0) { sz = 1 + 0.35 * b; sx = 1 - 0.22 * b; x = 0.3 * R * b; } else { x = R * Math.min(1.1, b); z = R * 0.35 * Math.min(1, b); sz = 1 - 0.12 * b; sx = 1 + 0.08 * b; } }
  else if (p.is("death")) { sz = 1 - 0.82 * p.dead; sx = 1 + 0.6 * p.dead; }
  m.with(() => {
    m.move(x, 0, z);
    const hz = R * 0.82 * sz;
    m.ellipsoid([0, 0, hz], [R * sx * 1.05, R * sx, hz], col, { segs: 8 });
    m.decal(0.03, () => m.box([R * 0.3 * sx, -R * 0.4 * sx, hz * 1.6], [R * 0.3, R * 0.3, R * 0.2], P.white));
    if (!(p.is("death") && p.i > 2)) m.decal(0.04, () => { for (const s of [1, -1]) m.box([R * 0.93 * sx, s * R * 0.38, hz * 1.15], [R * 0.2, R * 0.28, R * 0.42], P.black); });
    if (crown) m.group(() => { m.box([0, 0, hz * 2 + R * 0.08], [R * 0.9, R * 0.9, R * 0.22], crown); for (const [cx, cy] of [[0.34, 0.34], [0.34, -0.34], [-0.34, 0.34], [-0.34, -0.34]]) m.box([R * cx, R * cy, hz * 2 + R * 0.3], [R * 0.24, R * 0.24, R * 0.3], crown); });
    if (p.hit) sparkle(m, [R * 1.6, 0, hz], R * 0.22);
  });
}
/** Slimelet: the Slime Den's swarm, a tiny slime in the team's colour. */
export const mite: UnitDef = { weight: "light", build: (m, p) => blob(m, p, 0.14, P.team) };
/** Slime Queen: a big slime with a little gold crown. */
export const queen: UnitDef = { weight: "mid", build: (m, p) => blob(m, p, 0.24, P.team, P.gold) };

// ------------------------------------------------------------------------------------------------ machines and buildings
/** Long Cannon: a long thin barrel on two wheels behind a team gun shield. Shoots straight through a line. */
export const ballista: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.1 });
    m.at(s.base, () => {
      for (const sd of [1, -1]) m.group(() => { m.cylinder([0, sd * 0.3, 0.17], [0, sd * 0.36, 0.17], 0.17, P.woodDk, 0.17, { segs: 8 }); m.cylinder([0, sd * 0.36, 0.17], [0, sd * 0.37, 0.17], 0.07, trim(t), 0.07, { segs: 6 }); });
      m.box([-0.14, 0, 0.14], [0.5, 0.5, 0.1], P.wood);
      m.with(() => { m.move(0.14, 0, 0.36); shield(m, 0.62, 0.34, trim(t), P.teamFlat, t >= 4 ? P.glory : P.white); });
    });
    m.at(s.top, () => {
      m.move(0, 0, 0.34).rotY(-6);
      const L = 0.74 + 0.03 * t;
      m.cylinder([-0.3, 0, 0], [L, 0, 0], 0.085, P.ironDk, 0.065, { segs: 8 });
      for (const x of [-0.26, 0.2, L - 0.06]) m.cylinder([x, 0, 0], [x + 0.06, 0, 0], 0.1, trim(t), 0.09, { segs: 8 });
      m.sphere([-0.32, 0, 0], 0.07, trim(t), { segs: 6 });
      if (p.hit) flash(m, [L + 0.04, 0, 0], 0.11);
      if (p.after) puff(m, [L + 0.16 + (p.hit ? 0 : 0.1), 0, 0.06], 0.13, p.hit ? 0.2 : 0.8);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.3], 0.18, p.dead, P.smokeDk, 3);
  },
};

/** Mortar: a fat stubby barrel pointing at the sky on a team-painted block. */
export const bombard: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.06 });
    m.at(s.base, () => {
      m.box([0, 0, 0.1], [0.66, 0.66, 0.2], P.woodDk);
      m.decal(0.01, () => m.box([0, 0, 0.12], [0.68, 0.5, 0.1], P.teamFlat));
      for (const sd of [1, -1]) m.box([0, sd * 0.3, 0.3], [0.24, 0.08, 0.26], trim(t));
    });
    m.at(s.top, () => {
      m.move(-0.02, 0, 0.3).rotY(-62);
      const L = 0.42 + 0.02 * t;
      m.cylinder([-0.14, 0, 0], [L, 0, 0], 0.2, P.ironDk, 0.2, { segs: 8 });
      m.cylinder([L - 0.08, 0, 0], [L + 0.02, 0, 0], 0.235, trim(t), 0.235, { segs: 8 });
      m.cylinder([-0.16, 0, 0], [-0.06, 0, 0], 0.22, trim(t), 0.2, { segs: 8 });
      m.decal(0.03, () => m.cylinder([L + 0.02, 0, 0], [L + 0.025, 0, 0], 0.16, t >= 4 ? P.glory : P.black, 0.16, { segs: 8 }));
      if (p.hit) flash(m, [L + 0.08, 0, 0], 0.16);
      if (p.after) puff(m, [L + 0.26 + (p.hit ? 0 : 0.14), 0, 0], 0.2, p.hit ? 0.2 : 0.8);
    });
    if (p.is("death") && p.i >= 2) puff(m, [0, 0, 0.4], 0.2, p.dead, P.smokeDk, 3);
  },
};

/** Pop Gun: the Smith's little cannon on a tripod. */
export const turret: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const s = structure(m, p, { recoil: 0.05 });
    m.at(s.base, () => { for (const a of [0, 120, 240]) m.with(() => { m.rotZ(a + 60); m.cylinder([0, 0, 0.26], [0.2, 0, 0], 0.03, P.woodDk, 0.03, { segs: 4 }); }); m.box([0, 0, 0.28], [0.16, 0.16, 0.08], P.team); });
    m.at(s.top, () => {
      m.move(0, 0, 0.36);
      m.cylinder([-0.14, 0, 0], [0.3, 0, 0], 0.085, P.ironDk, 0.07, { segs: 8 });
      m.cylinder([0.24, 0, 0], [0.31, 0, 0], 0.095, P.gold, 0.095, { segs: 8 });
      m.box([-0.02, 0, 0.0], [0.12, 0.2, 0.12], P.teamFlat);
      if (p.hit) flash(m, [0.34, 0, 0], 0.08);
      if (p.after) puff(m, [0.44 + (p.hit ? 0 : 0.08), 0, 0.04], 0.08, p.hit ? 0.2 : 0.8);
    });
  },
};

/** Spike Trap: a low spiked ball half buried in a team ring, with a blinking red pixel. The attack sets it off. */
export const mine: UnitDef = {
  weight: "mid", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0, collapse: 0.6 });
    m.at(s.base, () => {
      m.cylinder([0, 0, 0], [0, 0, 0.05], 0.3, P.team, 0.27, { segs: 8 });
      if (p.is("attack") && p.after) { flash(m, [0, 0, 0.2], 0.2); puff(m, [0, 0, 0.36], 0.24, p.hit ? 0.2 : 0.8); return; }
      m.ellipsoid([0, 0, 0.08], [0.2, 0.2, 0.16], t >= 3 ? P.ironDk : P.black, { segs: 8 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; m.cone([Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.1], [Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.16], 0.05, trim(t), { segs: 4 }); }
      m.cone([0, 0, 0.2], [0, 0, 0.36], 0.05, trim(t), { segs: 4 });
      const on = p.is("idle") ? p.i % 3 === 0 : true;
      m.decal(0.05, () => m.box([0.1, 0, 0.2], [0.08, 0.08, 0.08], t >= 4 ? P.glory : on ? P.fire : P.redDk));
    });
  },
};

/** Slime Den: a squat stone cave with a team flag. The mouth opens on the "attack" and a slime comes out. */
export const hive: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.02 });
    const open = p.is("attack") ? Math.max(0, Math.min(1, p.blend)) : 0;
    m.at(s.base, () => {
      m.group(() => { m.ellipsoid([0, 0, 0.1], [0.5, 0.52, 0.5], P.stone, { segs: 8 }); m.box([0.3, 0, 0.16], [0.3, 0.6, 0.32], P.stone); });
      m.decal(0.02, () => m.ellipsoid([-0.06, 0, 0.36], [0.36, 0.38, 0.27], P.team, { segs: 8 }));
      m.decal(0.03, () => m.box([0.46, 0, 0.14 + 0.03 * open], [0.03, 0.34 + 0.06 * open, 0.26 + 0.1 * open], P.black));
      m.decal(0.04, () => { for (const y of [-0.12, 0, 0.12]) m.box([0.47, y, 0.3 + 0.07 * open], [0.03, 0.07, 0.08], P.white); });
      m.decal(0.05, () => { for (const sd of [1, -1]) m.box([0.4, sd * 0.2, 0.46], [0.04, 0.09, 0.07], t >= 4 ? P.gloryInk : P.yellow); });
      m.decal(0.02, () => { m.box([0.1, 0.34, 0.42], [0.2, 0.14, 0.1], P.moss); m.box([-0.1, -0.3, 0.46], [0.2, 0.16, 0.08], P.moss); });
      // slime drips in the team's colour, a flag on top
      m.decal(0.045, () => { for (const [y, z] of [[-0.26, 0.2], [0.27, 0.12]]) m.box([0.47, y, z], [0.03, 0.08, 0.2], P.team); });
      m.cylinder([-0.1, 0, 0.56], [-0.1, 0, 0.92 + 0.03 * t], 0.022, P.woodDk, 0.022, { segs: 4 });
      m.poly([[-0.1, 0, 0.92 + 0.03 * t], [-0.1, 0.3, 0.84 + 0.03 * t], [-0.1, 0, 0.72 + 0.03 * t]], P.teamFlat);
      if (t >= 2) for (const sd of [1, -1]) m.box([0.34, sd * 0.34, 0.1], [0.14, 0.1, 0.2], trim(t));
      if (open > 0.5) m.ellipsoid([0.56, 0, 0.1], [0.1, 0.1, 0.09], P.team, { segs: 6 });
    });
  },
};
