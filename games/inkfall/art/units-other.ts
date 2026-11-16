// Inkfall's riders, fliers, giants, crawlers and emplacements.
import { crawler, flyer, quadruped, structure, type Pose, type QuadRig, type UnitDef } from "../../../artkit/rig";
import { Model, norm, type Material, type V3 } from "../../../artkit/toon3d";
import { HEAD, P, backBanner, blade, bow, guy, headband, helmet, puff, rank, splat, spear, strawHat, topknot, trim } from "./parts";

const r = HEAD;

// ------------------------------------------------------------------------------------------------ riders
/** A horse on the quadruped rig: an ink-black barrel, neck and head, a flying mane and tail, a saddle cloth. */
function horse(m: Model, q: QuadRig, p: Pose, o: { L: number; W: number; col: Material; mane: Material; cloth: Material }) {
  const { L, W } = o, w = p.wave(0.03, 2);
  m.at(q.body, () => {
    m.group(() => {
      m.ellipsoid([0, 0, 0], [L * 1.1, W * 1.15, 0.15], o.col, { segs: 10 });
      m.capsule([L * 0.8, 0, 0.04], [L * 1.35, 0, 0.3], 0.09, o.col, 0.07, { segs: 8 });
      m.capsule([L * 1.3, 0, 0.32], [L * 1.75, 0, 0.2], 0.075, o.col, 0.05, { segs: 8 });
      for (const s of [1, -1]) m.cone([L * 1.28, s * 0.045, 0.37], [L * 1.24, s * 0.06, 0.48], 0.028, o.col, { segs: 4 });
    });
    m.tube([[L * 0.85, 0, 0.17], [L * 1.05, 0, 0.32], [L * 1.28, 0, 0.42]], [0.03, 0.04, 0.03], o.mane, { segs: 4 });
    m.tube([[-L * 1.05, 0, 0.06], [-L * 1.5, w, 0.1], [-L * 1.85, w * 2, -0.06]], [0.035, 0.05, 0.012], o.mane, { segs: 5 });
    m.decal(0.02, () => m.box([-0.02, 0, 0.06], [L * 0.95, W * 2.36, 0.2], o.cloth));
    m.decal(0.03, () => m.sphere([L * 1.52, 0.05, 0.3], 0.014, P.white, { segs: 4 }));
  });
}

/** Charger: a rider in a horned helmet on a black horse, a long spear levelled, a banner on his back. */
export const lancer: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { size: 1.0, height: 0.4, length: 0.27, width: 0.13, legs: P.ink, hooves: P.ink, legR: 0.042, stride: 0.62 });
    horse(m, q, p, { L: 0.27, W: 0.13, col: P.ink, mane: P.inkMid, cloth: P.team });
    m.at(q.saddle, () => {
      const R = p.mix<V3>([0.1, 0.22, 0.36], [0.3, 0.18, 0.36], { wind: [-0.02, 0.24, 0.4] });
      const h = guy(m, p, { seated: true, size: 0.82, torso: P.inkDk, arms: P.cloth, legs: P.inkDk, handR: R, handL: [0.2, -0.08, 0.3], lunge: 0 });
      m.at(h.head, () => helmet(m, r, { crest: t >= 2 ? trim(t) : null }));
      backBanner(m, h, p, 0.62 + 0.02 * t, 0.17, P.team);
      rank(m, h, p, 0.4);
      m.at(h.aim("R", norm(p.mix<V3>([1, 0, 0.5], [1, -0.06, 0.02], { wind: [1, 0, 0.3] }))), () => {
        const L = 0.9 + 0.05 * t;
        spear(m, 0.3, L, blade(t), 0.02, P.team);
        if (p.hit) splat(m, [L + 0.24, 0, 0], 0.08, P.splat, 3);
      });
    });
  },
};

/** Horse Archer: a light rider on a pale horse, bow drawn, the side's colour on hood and saddle cloth. */
export const outrider: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const q = quadruped(m, p, { size: 0.94, weight: "mid", height: 0.38, length: 0.25, width: 0.115, legs: P.horse, hooves: P.ink, legR: 0.036, stride: 0.7 });
    horse(m, q, p, { L: 0.25, W: 0.115, col: P.horseLt, mane: P.ink, cloth: P.team });
    m.at(q.saddle, () => {
      const pull = p.mix(0.04, 0.0, { wind: 0.2 });
      const L = p.mix<V3>([0.28, -0.08, 0.42], [0.32, -0.06, 0.46], { wind: [0.3, -0.07, 0.47] });
      const R = p.mix<V3>([0.22, 0.08, 0.42], [0.28, 0.08, 0.46], { wind: [0.06, 0.1, 0.47] });
      const h = guy(m, p, { seated: true, size: 0.8, torso: P.ink, arms: P.cloth, legs: P.inkDk, handR: R, handL: L, lunge: 0 });
      m.at(h.head, () => { topknot(m, r); headband(m, r, p, P.team); });
      m.at(h.back, () => m.group(() => { m.cylinder([0.05, 0.06, -0.1], [0.05, 0.1, 0.16], 0.045, P.team, 0.05, { segs: 6 }); for (const y of [0.07, 0.12]) m.cone([0.05, y + 0.02, 0.16], [0.05, y + 0.04, 0.28], 0.022, P.white, { segs: 4 }); }));
      rank(m, h, p, 0.36);
      m.at(h.aim("L", [1, 0, 0]), () => { bow(m, 0.25 + 0.01 * t, pull, t >= 3 ? P.bronze : P.ink, p.after ? null : P.woodDk); if (p.hit) splat(m, [0.32, 0, 0], 0.06, P.splat, 2); });
    });
  },
};

// ------------------------------------------------------------------------------------------------ fliers
/** One wing as a fan of feathers out along +y * side: a flat blade in `col` with ink-black tips. */
function wing(m: Model, side: number, span: number, chord: number, col: Material, tip: Material) {
  const s = side;
  m.poly([[chord * 0.5, 0, 0], [chord * 0.35, s * span * 0.7, 0.02], [-chord * 0.1, s * span, 0.0], [-chord * 0.55, s * span * 0.75, 0], [-chord * 0.5, 0, 0]], col);
  m.decal(0.015, () => m.poly([[chord * 0.25, s * span * 0.74, 0.022], [-chord * 0.1, s * span * 1.02, 0.002], [-chord * 0.58, s * span * 0.78, 0.002], [-chord * 0.42, s * span * 0.56, 0.012]], tip));
}

/** War Crane: a white crane, long neck and beak, wide wings in the side's colour tipped with ink. */
export const harrier: UnitDef = {
  weight: "mid", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.22 });
    m.at(f.body, () => {
      m.group(() => {
        m.ellipsoid([0, 0, 0], [0.19, 0.1, 0.09], P.white, { segs: 10 });
        m.tube([[0.14, 0, 0.02], [0.28, 0, 0.07], [0.4, 0, 0.05]], [0.045, 0.03, 0.035], P.white, { segs: 6 });
      });
      m.sphere([0.42, 0, 0.05], 0.045, P.ink, { segs: 6 });
      m.decal(0.02, () => m.sphere([0.42, 0, 0.085], 0.025, t >= 4 ? P.teamLt : P.flame, { segs: 5 }));
      m.cone([0.45, 0, 0.04], [0.66, 0, 0.0], 0.022, t >= 3 ? P.bronze : P.ink, { segs: 4 });
      // legs trailing, black tail feathers
      m.group(() => { for (const s of [1, -1]) m.cylinder([-0.14, s * 0.03, -0.03], [-0.44, s * 0.04, -0.06], 0.009, P.ink, 0.009, { segs: 3 }); });
      m.poly([[-0.14, 0.07, 0.02], [-0.34, 0.1, 0.02], [-0.36, -0.1, 0.02], [-0.14, -0.07, 0.02]], P.ink);
      const ang = 8 + 34 * f.flap, span = 0.6 + 0.03 * t;
      for (const s of [1, -1]) m.with(() => { m.move(0.02, s * 0.07, 0.04).rotX(-s * ang); wing(m, s, span, 0.36, P.team, P.ink); });
      if (p.hit) splat(m, [0.7, 0, -0.06], 0.07, P.splat, 2);
    });
  },
};

/** Kite Rider: an armoured rider lying along a great diamond kite in the side's colour, a lance under his arm. */
export const griffin: UnitDef = {
  weight: "heavy", flying: true,
  build(m, p) {
    const t = p.tier, f = flyer(m, p, { alt: 0.24, weight: "heavy", beats: 1 });
    m.at(f.body, () => {
      const dip = 4 * f.flap, S = 0.62 + 0.03 * t;
      // the kite: a diamond with a spine and a spar, a painted ring, a long tail of paper bows
      m.with(() => {
        m.move(0, 0, 0.13).rotY(-6 + dip * 0.5);
        m.poly([[S * 0.95, 0, 0], [0.05, S * 0.82, 0.03 + dip * 0.01], [-S * 0.7, 0, 0], [0.05, -S * 0.82, 0.03 + dip * 0.01]], P.team);
        m.decal(0.02, () => m.group(() => { m.cylinder([-S * 0.7, 0, 0.012], [S * 0.95, 0, 0.012], 0.012, P.ink, 0.012, { segs: 4 }); m.cylinder([0.05, -S * 0.82, 0.04], [0.05, S * 0.82, 0.04], 0.012, P.ink, 0.012, { segs: 4 }); }));
        m.decal(0.03, () => m.torus([0.36, 0, 0.02], [0, 0, 1], 0.13, 0.024, t >= 4 ? P.teamLt : P.white, { segs: 12 }));
        const w = p.wave(0.06, 2);
        m.tube([[-S * 0.7, 0, 0], [-S * 1.0, w, -0.03], [-S * 1.35, -w, -0.02], [-S * 1.65, w, -0.06]], 0.008, P.ink, { segs: 3 });
        m.group(() => { for (let i = 0; i < 3; i++) m.box([-S * (0.95 + i * 0.25), (i % 2 ? -w : w) * 0.8, -0.03], [0.05, 0.12, 0.01], i % 2 ? P.white : P.team); });
      });
      // the rider hangs under the spine
      m.with(() => {
        m.move(0.02, 0, -0.14).scale(0.78);
        const R = p.mix<V3>([0.14, 0.2, 0.34], [0.32, 0.16, 0.3], { wind: [0.0, 0.22, 0.38] });
        const h = guy(m, p, { seated: true, torso: P.ink, arms: P.inkDk, legs: P.inkDk, hands: P.inkDk, handR: R, handL: [0.1, -0.2, 0.62], lunge: 0 });
        m.at(h.head, () => helmet(m, r, { crest: t >= 2 ? trim(t) : null }));
        m.at(h.aim("R", norm(p.mix<V3>([1, 0, -0.1], [1, 0, -0.35], { wind: [1, 0, 0.05] }))), () => {
          spear(m, 0.3, 0.8 + 0.04 * t, blade(t), 0.02, P.team);
          if (p.hit) splat(m, [1.05, 0, 0], 0.09, P.splat, 4);
        });
      });
    });
  },
};

// ------------------------------------------------------------------------------------------------ giants
/** A stone guardian: two boulders, one on the other, bound with a thick straw rope hung with paper tags. */
function warden(m: Model, p: Pose, size: number, tier: number, half = false) {
  const R = p.mix<V3>([0.16, 0.36, 0.4], [0.5, 0.14, 0.3], { wind: [-0.12, 0.4, 0.86] });
  const L = p.mix<V3>([0.16, -0.36, 0.4], [0.3, -0.3, 0.44], { wind: [0.1, -0.38, 0.5] });
  const h = guy(m, p, { size, bulk: 1.75, weight: "heavy", handR: R, handL: L, twist: 20, lunge: 0.9, leg: 0.8, skin: P.stone, torso: P.stone, arms: P.stoneDk, legs: P.stoneDk, boots: P.stoneDk, hands: P.stoneDk, noHead: true, noTorso: true });
  // the lower boulder (hips) and the upper boulder (chest and head in one)
  m.at(h.hips, () => m.ellipsoid([0, 0, 0.06], [0.24, 0.3, 0.19], P.stoneDk, { segs: 9 }));
  m.at(h.chest, () => {
    if (!half) m.ellipsoid([0.0, 0, 0.14], [0.27, 0.34, 0.27], P.stone, { segs: 9 });
    // the rope round the join, in the side's colour, with paper tags
    m.decal(0.02, () => m.torus([0, 0, half ? 0.02 : -0.06], [0, 0, 1], half ? 0.25 : 0.29, 0.04, P.team, { segs: 12 }));
    m.decal(0.04, () => m.group(() => { for (const y of [-0.16, 0, 0.16]) m.box([0.3, y, half ? -0.06 : -0.15], [0.02, 0.07, 0.13], P.white); }));
    if (!half) {
      // a carved face: heavy brow, two eyes; moss on the crown; master rank lights the eyes
      m.decal(0.03, () => m.box([0.25, 0, 0.24], [0.05, 0.4, 0.05], P.ink));
      m.decal(0.04, () => { for (const s of [1, -1]) m.sphere([0.26, s * 0.12, 0.17], 0.035, tier >= 4 ? P.teamLt : P.ink, { segs: 5 }); });
      m.decal(0.02, () => m.ellipsoid([-0.04, 0, 0.36], [0.2, 0.26, 0.08], tier >= 3 ? P.bronze : P.moss, { segs: 8 }));
      if (tier >= 2) m.decal(0.03, () => m.torus([0, 0, 0.3], [0, 0, 1], 0.2, 0.02, P.rope, { segs: 10 }));
    } else m.decal(0.02, () => m.ellipsoid([0, 0, 0.08], [0.2, 0.24, 0.06], P.moss, { segs: 8 }));
  });
  for (const hand of [h.pR, h.pL]) m.sphere(hand, 0.13 * size, P.stoneDk, { segs: 8 });
  if (p.hit) { splat(m, h.pt([0.62, 0.1, 0.08]), 0.16 * size, P.splat, 3); puff(m, h.pt([0.6, 0.1, 0.1]), 0.16 * size, 0.2); }
}
/** Stone Warden: the biggest body on the field. */
export const golem: UnitDef = { weight: "heavy", build: (m, p) => warden(m, p, 1.5, p.tier) };
/** Stone Cub: the lower boulder, walking on by itself. */
export const golemling: UnitDef = { weight: "heavy", build: (m, p) => warden(m, p, 1.02, 1, true) };

// ------------------------------------------------------------------------------------------------ crawlers
/** A blot of living ink: a glossy black drop on thin legs, two paper-white eyes, a fleck of the side's colour. */
function blot(m: Model, p: Pose, s: number, big: boolean) {
  const c = crawler(m, p, { size: 1, height: s * 0.75, length: s * 0.95, width: s * 0.7, legs: big ? 4 : 3, leg: P.ink, legR: big ? 0.02 : 0.014, stride: big ? 0.2 : 0.15, splay: 1.9 });
  m.at(c.body, () => {
    const sq = 1 + p.wave(0.06, 1);
    m.group(() => {
      m.ellipsoid([0, 0, s * 0.2], [s * 1.05, s * 0.9, s * 0.72 * sq], P.ink, { segs: 10 });
      m.cone([-s * 0.5, 0, s * 0.55], [-s * 0.95, 0, s * 1.35], s * 0.4, P.ink, { segs: 6 });
      if (big) for (const sd of [1, -1]) m.sphere([-s * 0.3, sd * s * 0.75, s * 0.5], s * 0.34, P.ink, { segs: 7 });
    });
    m.decal(0.03, () => { for (const sd of [1, -1]) m.sphere([s * 0.82, sd * s * 0.33, s * 0.42], s * (big ? 0.15 : 0.2), P.white, { segs: 6 }); });
    m.decal(0.02, () => m.ellipsoid([-s * 0.15, 0, s * 0.62], [s * 0.74, s * 0.68, s * 0.3], P.team, { segs: 8 }));
    if (p.hit) splat(m, [s * 1.6, 0, s * 0.2], s * 0.6, P.splat, 2);
  });
}
/** Blotling: the Inkwell's swarm. */
export const mite: UnitDef = { weight: "light", build: (m, p) => blot(m, p, 0.12, false) };
/** Blot Mother: the Inkwell's big crawler. */
export const queen: UnitDef = { weight: "mid", build: (m, p) => blot(m, p, 0.2, true) };

// ------------------------------------------------------------------------------------------------ emplacements
/** Great Crossbow: a long black bow arm across a timber trestle, a bolt as long as a man, a shield board in front. */
export const ballista: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.1 });
    m.at(s.base, () => {
      m.group(() => { for (const sd of [1, -1]) { m.box([0.0, sd * 0.26, 0.05], [0.7, 0.07, 0.08], P.woodDk); m.cylinder([0.2, sd * 0.26, 0.05], [0.05, sd * 0.1, 0.36], 0.03, P.woodDk, 0.03, { segs: 5 }); m.cylinder([-0.2, sd * 0.26, 0.05], [-0.05, sd * 0.1, 0.36], 0.03, P.woodDk, 0.03, { segs: 5 }); } });
      m.decal(0.01, () => m.box([-0.3, 0, 0.12], [0.06, 0.6, 0.2], P.team));
    });
    m.at(s.top, () => {
      const pull = p.mix(0.12, 0, { wind: 0.3 });
      m.with(() => {
        m.move(0, 0, 0.42).rotY(-7);
        m.box([0.05, 0, 0], [1.0, 0.09, 0.07], P.wood);
        m.tube([[0.42 - pull * 0.5, -0.6, 0], [0.56, -0.3, 0], [0.6, 0, 0], [0.56, 0.3, 0], [0.42 - pull * 0.5, 0.6, 0]], [0.016, 0.03, 0.04, 0.03, 0.016], t >= 3 ? P.bronze : P.ink, { segs: 6 });
        m.tube([[0.42 - pull * 0.5, -0.6, 0], [0.3 - pull, 0, 0.02], [0.42 - pull * 0.5, 0.6, 0]], 0.007, P.inkMid, { segs: 3 });
        if (!p.after) m.group(() => { m.cylinder([0.28 - pull, 0, 0.05], [0.98 - pull, 0, 0.05], 0.018, P.woodDk, 0.018, { segs: 5 }); m.cone([0.98 - pull, 0, 0.05], [1.14 - pull, 0, 0.05], 0.045, blade(t), { segs: 4 }); });
        m.decal(0.02, () => m.box([0.3, 0, 0.04], [0.14, 0.11, 0.02], P.team));
        if (t >= 2) m.cylinder([-0.44, -0.1, 0], [-0.44, 0.1, 0], 0.05, trim(t), 0.05, { segs: 8 });
        if (p.hit) splat(m, [1.2, 0, 0.05], 0.09, P.splat, 5);
      });
    });
  },
};

/** Sky Mortar: a fat banded barrel on a sledge, pointing at the sky, a sash of the side's colour round its belly. */
export const bombard: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.09 });
    m.at(s.base, () => {
      m.group(() => { for (const sd of [1, -1]) m.box([0, sd * 0.3, 0.06], [0.74, 0.09, 0.12], P.woodDk); m.box([0, 0, 0.1], [0.5, 0.6, 0.08], P.wood); });
      m.decal(0.01, () => m.box([0.26, 0, 0.1], [0.02, 0.44, 0.1], P.team));
    });
    m.at(s.top, () => m.with(() => {
      m.move(-0.1, 0, 0.16).rotY(24);
      m.group(() => m.lathe([[0.2, 0], [0.26, 0.1], [0.25, 0.4], [0.21, 0.56], [0.24, 0.6], [0.0, 0.6]], P.ink, { segs: 14 }));
      m.decal(0.015, () => m.cylinder([0, 0, 0.2], [0, 0, 0.36], 0.262, P.team, 0.256, { segs: 14 }));
      m.decal(0.02, () => m.group(() => { for (const z of [0.1, 0.46]) m.torus([0, 0, z], [0, 0, 1], 0.25, 0.022, t >= 3 ? P.bronze : P.rope, { segs: 14 }); }));
      m.decal(0.02, () => m.cylinder([0, 0, 0.6], [0, 0, 0.605], 0.17, t >= 4 ? P.teamLt : P.inkMid, 0.17, { segs: 12 }));
      if (p.hit) splat(m, [0, 0, 0.86], 0.2, P.splat, 3);
      if (p.after) puff(m, [0, 0, 0.8], 0.16, p.hit ? 0 : 0.5);
    }));
  },
};

/** Inkwell: a squat ink jar on a stand. The lid lifts and blots spill out of the mouth in front. */
export const hive: UnitDef = {
  weight: "heavy", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0.02 });
    const open = p.is("attack") ? Math.max(0, Math.min(1, p.blend)) : 0;
    m.at(s.base, () => {
      m.box([0, 0, 0.04], [0.8, 0.8, 0.08], P.woodDk);
      m.group(() => m.lathe([[0.3, 0.08], [0.46, 0.24], [0.44, 0.48], [0.3, 0.62], [0.24, 0.66]], P.ink, { smooth: true, segs: 14 }));
      // a broad band of the side's colour, a paper label, rope round the neck
      m.decal(0.015, () => m.cylinder([0, 0, 0.26], [0, 0, 0.46], 0.462, P.team, 0.452, { segs: 14 }));
      m.decal(0.03, () => m.box([0.44, 0, 0.36], [0.03, 0.16, 0.2], t >= 4 ? P.teamLt : P.white));
      m.decal(0.02, () => m.torus([0, 0, 0.62], [0, 0, 1], 0.29, 0.03, t >= 3 ? P.bronze : P.rope, { segs: 12 }));
      // the mouth: a dark spout at the front that drips; opens on the spawn
      m.decal(0.035, () => m.sphere([0.4, 0, 0.14], 0.1 + 0.05 * open, P.ink, { segs: 8 }));
      m.group(() => { for (const [y, l] of [[-0.14, 0.12], [0.1, 0.18], [0.2, 0.08]]) m.capsule([0.42, y, 0.26], [0.44, y, 0.26 - l - 0.05 * open], 0.035, P.ink, 0.02, { segs: 5 }); });
      if (open > 0.5) splat(m, [0.62, 0, 0.06], 0.14, P.splat, 4);
    });
    m.at(s.top, () => m.with(() => {
      m.move(0, 0, 0.66 + 0.16 * open).rotY(-18 * open);
      m.group(() => { m.cylinder([0, 0, 0], [0, 0, 0.06], 0.3, P.ink, 0.27, { segs: 12 }); m.sphere([0, 0, 0.1], 0.07, t >= 3 ? P.bronze : P.team, { segs: 7 }); });
    }));
  },
};

/** Fire Pot: a clay pot half buried, bamboo spikes round the rim, a lit taper and a tag in the side's colour. */
export const mine: UnitDef = {
  weight: "light", fixed: true,
  build(m, p) {
    const t = p.tier, s = structure(m, p, { recoil: 0 });
    m.at(s.base, () => {
      m.group(() => m.lathe([[0.2, 0], [0.24, 0.07], [0.17, 0.17], [0.12, 0.2], [0, 0.2]], P.ink, { smooth: true, segs: 12 }));
      m.decal(0.015, () => m.cylinder([0, 0, 0.05], [0, 0, 0.11], 0.242, P.team, 0.22, { segs: 12 }));
      m.group(() => { for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; m.cone([Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.1], [Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0.2], 0.03, t >= 3 ? P.bronze : P.bone, { segs: 4 }); } });
      const blink = p.i % 2 === 0;
      m.cylinder([0, 0, 0.2], [0, 0, 0.27], 0.02, P.rope, 0.02, { segs: 4 });
      m.sphere([0, 0, 0.3], 0.04, t >= 4 ? P.teamLt : blink ? P.flame : P.ember, { segs: 5 });
      if (p.hit) splat(m, [0, 0, 0.3], 0.36, P.splat, 5);
      if (p.after) puff(m, [0, 0, 0.4], 0.26, p.hit ? 0 : 0.5);
    });
  },
};

/** Bamboo Gun: a bamboo tube bound with rope on a tripod. */
export const turret: UnitDef = {
  weight: "light", fixed: true,
  build(m, p) {
    const s = structure(m, p, { recoil: 0.06 });
    m.at(s.base, () => m.group(() => { for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 1; m.cylinder([Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0], [0, 0, 0.3], 0.02, P.ink, 0.02, { segs: 4 }); } }));
    m.at(s.top, () => m.with(() => {
      m.move(0, 0, 0.32).rotY(-10);
      m.cylinder([-0.2, 0, 0], [0.36, 0, 0], 0.07, P.green, 0.062, { segs: 8 });
      m.decal(0.02, () => m.group(() => { for (const x of [-0.12, 0.08, 0.26]) m.torus([x, 0, 0], [1, 0, 0], 0.068, 0.014, P.greenDk, { segs: 8 }); }));
      m.decal(0.02, () => m.cylinder([-0.04, 0, 0], [0.04, 0, 0], 0.074, P.team, 0.074, { segs: 8 }));
      m.decal(0.03, () => m.cylinder([0.36, 0, 0], [0.365, 0, 0], 0.045, P.ink, 0.045, { segs: 8 }));
      if (p.hit) splat(m, [0.5, 0, 0], 0.07, P.splat, 2);
    }));
  },
};
void [strawHat];
