// Inkfall's soldiers on foot. Each is a dark ink figure with one flat area of its side's colour (a sash, a hood, a
// skirt, a shield, a banner) and one large prop that names its job from above.
import { gripAim, type Pose, type UnitDef } from "../../../artkit/rig";
import { norm, type V3 } from "../../../artkit/toon3d";
import { HEAD, P, backBanner, basketHat, blade, bombPot, bow, cape, chop, club, courtHat, dagger, fan, flecks, foxMask, guy, headband, helmet, hood, lantern, longHair, mallet, plankShield, puff, rank, robe, sash, shoulders, skirt, slashArc, spear, splat, staff, strawCoat, strawHat, sword, thrust, topknot, trim, zigzag } from "./parts";

const r = HEAD;
/** A staff hand: rest, a forward jab on the blow, raised in the wind-up (and on a cast). */
const staffHand = (p: Pose): V3 => p.mix<V3>([0.2, 0.2, 0.42], [0.32, 0.14, 0.56], { wind: [0.06, 0.24, 0.66], cast: [0.16, 0.2, 0.74], castWind: [0.1, 0.22, 0.4] });
const offHand = (p: Pose): V3 => p.mix<V3>([0.12, -0.2, 0.36], [0.3, -0.12, 0.5], { wind: [0.0, -0.24, 0.4], cast: [0.14, -0.22, 0.7], castWind: [0.1, -0.2, 0.36] });

// ------------------------------------------------------------------------------------------------ shooters
/** Longbow: a hooded archer with a bow taller than he is, a quiver of arrows on his back. */
export const ranger: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const pull = p.mix(0.04, 0.0, { wind: 0.22 });
    const L = p.mix<V3>([0.3, -0.06, 0.42], [0.34, -0.04, 0.46], { wind: [0.32, -0.05, 0.47] });
    const R = p.mix<V3>([0.24, 0.1, 0.42], [0.3, 0.1, 0.46], { wind: [0.08, 0.12, 0.47] });
    const h = guy(m, p, { weight: "light", bulk: 0.95, torso: P.cloth, arms: P.cloth, handR: R, handL: L, lunge: 0, recoil: 0.03 });
    skirt(m, h, P.inkDk, 0.21);
    sash(m, h, p, P.team);
    m.at(h.back, () => m.group(() => { m.cylinder([0.05, 0.06, -0.12], [0.05, 0.1, 0.16], 0.05, P.ink, 0.055, { segs: 6 }); for (const y of [0.07, 0.12]) m.cone([0.05, y + 0.02, 0.16], [0.05, y + 0.04, 0.3], 0.025, P.white, { segs: 4 }); }));
    m.at(h.head, () => hood(m, r, P.team, 0.45));
    rank(m, h, p);
    m.at(h.aim("L", [1, 0, 0]), () => {
      bow(m, 0.4 + 0.012 * t, pull, t >= 3 ? P.bronze : P.ink, p.after ? null : P.woodDk);
      if (p.hit) splat(m, [0.34, 0, 0], 0.07, P.splat, 3);
    });
  },
};

/** Pot Thrower: a stout fellow with a round black bomb pot held high, fuse lit. */
export const grenadier: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.1, 0.24, 0.62], [0.32, 0.14, 0.72], { wind: [-0.14, 0.26, 0.6] });
    const h = guy(m, p, { weight: "mid", bulk: 1.28, handR: R, twist: 22, lunge: 0.5, torso: P.cloth, arms: P.skin });
    sash(m, h, p, P.team, 1.26);
    m.at(h.chest, () => m.decal(0.02, () => m.box([0.14, -0.1, 0], [0.06, 0.1, 0.32], P.team)));
    m.at(h.head, () => { topknot(m, r); headband(m, r, p, P.team); });
    rank(m, h, p);
    if (!p.after) m.at(h.aim("R", [1, 0, 0]), () => { m.move(0, 0, 0.16); bombPot(m, 0.125 + 0.008 * t, P.flame, t >= 3 ? P.bronze : P.ink); });
    else puff(m, h.pt([0.36, 0.14, 0.86]), 0.07, 0.4);
  },
};

// ------------------------------------------------------------------------------------------------ blades
/** Gate Shield: a broad armoured man behind a standing plank shield in the side's colour. */
export const bulwark: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const L = p.mix<V3>([0.26, -0.03, 0.38], [0.44, 0.0, 0.4], { wind: [0.16, -0.05, 0.38] });
    const R = p.mix<V3>([0.02, 0.3, 0.36], [0.2, 0.26, 0.4], { wind: [-0.1, 0.3, 0.44] });
    const h = guy(m, p, { size: 1.2, bulk: 1.4, weight: "heavy", torso: P.ink, arms: P.inkDk, legs: P.inkDk, hands: P.inkDk, handL: L, handR: R, lunge: 0.6 });
    shoulders(m, h, P.team, 1.4, 1.15);
    cape(m, h, p, P.team, 0.36, 0.24);
    m.at(h.head, () => helmet(m, r, { crest: t >= 3 ? P.bronze : t >= 2 ? P.steel : null }));
    rank(m, h, p, 0.4);
    m.at(h.aim("L", [1, 0, 0]), () => {
      m.move(0.06, 0.03, 0.02);
      plankShield(m, 0.62 + 0.02 * t, 0.84 + 0.02 * t, P.team, t >= 3 ? P.bronze : P.ink, t >= 4 ? P.teamLt : P.white);
      if (p.hit) splat(m, [0.14, 0, 0], 0.09, P.splat, 2);
    });
    m.at(h.aim("R", norm(p.mix<V3>([0.3, 0.2, 1], [1, 0, 0.2], { wind: [-0.2, 0.2, 1] }))), () => club(m, 0.3, P.ink, 0.06));
  },
};

/** Reed Blades: three small swordsmen in headbands. */
export const blades: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const h = guy(m, p, { weight: "light", size: 0.88, bulk: 0.95, handR: c.hand, twist: 28, torso: P.inkDk, arms: P.cloth });
    skirt(m, h, P.team, 0.2);
    m.at(h.head, () => { topknot(m, r); headband(m, r, p, P.team); });
    rank(m, h, p);
    m.at(h.aim("R", c.aim), () => sword(m, 0.4 + 0.02 * t, blade(t), trim(t)));
    if (p.hit) slashArc(m, h, [0.05, 0, 0.36], 0.44, 70, -45, -0.25);
  },
};

/** Night Blade: all black, hooded, twin short blades. The side's colour only on a long scarf. */
export const shade: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.14, 0.22, 0.36], [0.38, 0.06, 0.44], { wind: [-0.08, 0.26, 0.52] });
    const L = p.mix<V3>([0.14, -0.22, 0.36], [0.3, -0.1, 0.36], { wind: [0.02, -0.26, 0.44] });
    const aR = norm(p.mix<V3>([0.6, 0, 0.8], [1, -0.2, -0.1], { wind: [-0.3, 0.2, 1] })), aL = norm(p.mix<V3>([0.6, 0, 0.8], [1, 0.2, 0.1], { wind: [0.2, -0.2, 1] }));
    const h = guy(m, p, { weight: "light", bulk: 0.9, handR: R, handL: L, twist: 22, lunge: 1.1, lean: 16, skin: P.ink, torso: P.ink, arms: P.ink, legs: P.ink, hands: P.ink, noFace: true, swingR: 0.5, swingL: 0.5 });
    m.at(h.head, () => {
      hood(m, r, P.ink, 0);
      m.decal(0.03, () => m.box([r * 0.95, 0, r * 0.05], [r * 0.3, r * 1.3, r * 0.3], P.paper));
      m.decal(0.05, () => { for (const s of [1, -1]) m.sphere([r * 1.05, s * r * 0.36, r * 0.05], r * 0.1, P.ink, { segs: 5 }); });
    });
    // the scarf: round the neck, one long tail streaming behind
    const w = p.wave(0.04, 1), k = p.is("walk") ? 0.12 : 0;
    m.at(h.chest, () => { m.decal(0.02, () => m.cylinder([0, 0, 0.1], [0, 0, 0.24], 0.17, P.team, 0.14, { segs: 10 })); m.poly([[-0.1, 0.09, 0.22], [-0.56 - k, 0.2 + w, 0.3 + k * 0.5], [-0.52 - k, -0.02 + w, 0.1 + k * 0.5], [-0.1, -0.03, 0.12]], P.team); });
    rank(m, h, p);
    m.at(h.aim("R", aR), () => dagger(m, 0.26 + 0.015 * t, blade(t)));
    m.at(h.aim("L", aL), () => dagger(m, 0.26 + 0.015 * t, blade(t)));
    if (p.hit) { slashArc(m, h, [0.1, 0, 0.4], 0.4, 60, -30, -0.2, P.slash, 0.035); slashArc(m, h, [0.1, 0, 0.36], 0.34, -60, 20, 0.2, P.slash, 0.035); }
  },
};

/** Wanderer: slim, a deep basket hat over the whole head, one long thin blade. The cast is the parry. */
export const duelist: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, th = thrust(p, 0.4), parry = p.is("cast");
    const hand = parry ? p.mix<V3>([0.12, 0.22, 0.38], [0.24, 0.02, 0.58], { castWind: [0.1, 0.24, 0.4] }) : th.hand;
    const aim = parry ? norm(p.mix<V3>([1, 0, 0.35], [0.1, -0.9, 0.5], { castWind: [1, 0.2, 0.3] })) : th.aim;
    const L = p.mix<V3>([-0.04, -0.24, 0.34], [-0.14, -0.26, 0.46], { cast: [0.1, -0.24, 0.5] });
    const h = guy(m, p, { weight: "light", bulk: 0.84, handR: hand, handL: L, torso: P.team, arms: P.team, lunge: parry ? 0 : 1.3 });
    robe(m, h, P.inkDk, 0.2, 0.14);
    cape(m, h, p, P.team, 0.4, 0.2);
    m.at(h.hips, () => m.decal(0.03, () => m.cylinder([0, 0, 0.05], [0, 0, 0.12], 0.17, P.white, 0.17, { segs: 10 })));
    m.at(h.head, () => { basketHat(m, r, t >= 3 ? P.strawDk : P.straw); m.decal(0.025, () => m.cylinder([0, 0, r * 0.45], [0, 0, r * 0.8], r * 1.13, P.team, r * 1.08, { segs: 12 })); });
    rank(m, h, p, 0.4);
    m.at(h.aim("R", aim), () => {
      sword(m, 0.6 + 0.03 * t, blade(t), trim(t), 0.03);
      if (p.hit && !parry) m.capsule([0.5, 0, 0], [1.0, 0, 0], 0.03, P.slash, 0.004, { segs: 4 });
      if (p.hit && parry) splat(m, [0.3, 0, 0], 0.08, P.splat, 5);
    });
  },
};

/** Straw Spear: a conical straw hat and a spear twice his height. The cast braces it against a charge. */
export const pikeman: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.06, 0.2, 0.36], [0.26, 0.16, 0.4], { wind: [-0.12, 0.22, 0.42], cast: [0.0, 0.2, 0.24] });
    const L = p.mix<V3>([0.28, -0.02, 0.44], [0.46, 0.04, 0.4], { wind: [0.12, 0.0, 0.46], cast: [0.3, 0.0, 0.34] });
    const h = guy(m, p, { weight: "mid", handR: R, handL: L, torso: P.ink, arms: P.cloth, lunge: p.is("cast") ? 0 : 0.9 });
    skirt(m, h, P.team, 0.22, 0.1);
    m.at(h.head, () => strawHat(m, r, t >= 3 ? P.strawDk : P.straw, 1.95, 0.8, P.team));
    rank(m, h, p, 0.42);
    m.at(gripAim(h.pR, h.pL), () => {
      const F = 0.95 + 0.04 * t;
      spear(m, 0.3, F, blade(t), 0.018, P.team);
      if (p.hit) m.capsule([F + 0.1, 0, 0], [F + 0.5, 0, 0], 0.035, P.slash, 0.004, { segs: 4 });
    });
  },
};

/** Oni Brute: horned, bare-chested and grey, a studded club as long as he is, swung wide. */
export const ravager: UnitDef = {
  weight: "heavy",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.26, 0.42], [0.36, 0.0, 0.3], { wind: [-0.14, 0.3, 0.72] });
    const aim = norm(p.mix<V3>([0.3, 0.3, 1], [1, -0.5, -0.15], { wind: [-0.7, 0.3, 0.8] }));
    const h = guy(m, p, { size: 1.14, bulk: 1.36, weight: "heavy", handR: R, twist: 40, lunge: 1.1, skin: P.oni, torso: P.oni, arms: P.oni, legs: P.ink, hands: P.oni });
    skirt(m, h, P.team, 0.27, 0.1);
    sash(m, h, p, P.ink, 1.36);
    m.at(h.head, () => {
      m.group(() => m.ellipsoid([-r * 0.3, 0, r * 0.3], [r * 1.0, r * 1.1, r * 0.9], P.ink, { segs: 10 }));
      for (const s of [1, -1]) m.cone([r * 0.45, s * r * 0.55, r * 0.7], [r * 0.7, s * r * 0.85, r * 1.7], r * 0.26, t >= 3 ? P.bronze : P.bone, { segs: 6 });
      m.decal(0.04, () => { for (const s of [1, -1]) m.cone([r * 0.9, s * r * 0.3, -r * 0.5], [r * 1.0, s * r * 0.34, -r * 0.05], r * 0.1, P.white, { segs: 4 }); });
    });
    rank(m, h, p, 0.44);
    m.at(h.aim("R", aim), () => club(m, 0.62 + 0.03 * t, t >= 4 ? P.teamDk : P.ink, 0.1));
    if (p.hit) slashArc(m, h, [0.05, 0, 0.4], 0.66, 95, -70, -0.3, P.slash, 0.08);
  },
};

/** Chain Warden: heavy, a sickle hook swung on a long chain. The cast throws it. */
export const hook: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, thr = p.is("cast");
    const R = p.mix<V3>([0.14, 0.24, 0.4], [0.34, 0.1, 0.44], { wind: [-0.1, 0.28, 0.6], cast: [0.4, 0.12, 0.5], castWind: [-0.14, 0.26, 0.56] });
    const L = p.mix<V3>([0.16, -0.22, 0.34], [0.2, -0.2, 0.36], {});
    const h = guy(m, p, { size: 1.1, bulk: 1.3, weight: "heavy", handR: R, handL: L, twist: 26, lunge: thr ? 0.2 : 0.8, torso: P.ink, arms: P.cloth });
    shoulders(m, h, P.team, 1.3, 1.1);
    sash(m, h, p, P.team, 1.3);
    m.at(h.head, () => { topknot(m, r); headband(m, r, p, P.team); if (t >= 3) m.decal(0.03, () => m.box([r * 0.9, 0, r * 0.5], [r * 0.2, r * 0.7, r * 0.3], P.bronze)); });
    rank(m, h, p, 0.4);
    // the chain from the left hand, round to the right, and out to the hook
    const reach = thr ? p.mix(0.2, 1.25, { castWind: 0.1 }) : p.mix(0.22, 0.5, { wind: 0.12 });
    const tip = h.pt([R[0] + reach, R[1] - 0.06, R[2] + (thr ? 0.02 : -0.06)]);
    const link = (a: V3, b: V3, sag: number) => { const n = 6; const pts: V3[] = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u - sag * Math.sin(Math.PI * u)]); } m.tube(pts, 0.014, P.inkMid, { segs: 4 }); };
    link(h.pL, h.pR, 0.1); link(h.pR, tip, thr ? 0.02 : 0.05);
    m.at(gripAim(h.pR, tip), () => { m.move(Math.hypot(tip[0] - h.pR[0], tip[1] - h.pR[1], tip[2] - h.pR[2]), 0, 0); m.tube([[0, 0, 0], [0.1, 0, 0.06], [0.16, 0, -0.02], [0.12, 0, -0.14]], [0.03, 0.035, 0.03, 0.006], blade(t), { segs: 5 }); });
    if (p.hit) splat(m, [tip[0] + 0.1, tip[1], tip[2]], 0.08, P.splat, 4);
  },
};

/** Cask Runner: a great rice-wine cask on his back with a lit fuse, bent double in a sprint. */
export const keg: UnitDef = {
  weight: "light",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.02, 0.22, 0.46], [0.2, 0.2, 0.5], { wind: [-0.06, 0.22, 0.44] }), L: V3 = [R[0], -R[1], R[2]];
    const h = guy(m, p, { weight: "light", bulk: 0.95, handR: R, handL: L, lean: 20, lunge: 1.2, torso: P.cloth, arms: P.skin });
    m.at(h.head, () => { topknot(m, r); headband(m, r, p, P.team); });
    m.at(h.back, () => {
      m.with(() => {
        m.move(0.17, 0, 0.1);
        m.group(() => m.lathe([[0.15, -0.2], [0.2, -0.08], [0.2, 0.08], [0.15, 0.2]], P.team, { smooth: true, segs: 12 }));
        m.decal(0.02, () => m.group(() => { for (const z of [-0.14, 0.14]) m.torus([0, 0, z], [0, 0, 1], 0.178, 0.02, P.rope, { segs: 12 }); }));
        m.decal(0.01, () => m.cylinder([0, 0, 0.2], [0, 0, 0.21], 0.15, t >= 3 ? P.bronze : P.wood, 0.15, { segs: 12 }));
        m.decal(0.03, () => m.box([0.2, 0, 0], [0.02, 0.14, 0.14], P.white));
        const f = 0.03 * Math.sin(p.i * 2.2);
        m.tube([[0, 0, 0.2], [0.04, 0.03, 0.3], [0.02 + f, 0.05, 0.38]], 0.012, P.ink, { segs: 4 });
        m.group(() => { m.sphere([0.02 + f, 0.05, 0.42], 0.05, P.flame, { segs: 5 }); m.sphere([0.03 + f, 0.05, 0.47], 0.028, P.ember, { segs: 4 }); });
      });
    });
    rank(m, h, p);
    if (p.hit) splat(m, h.pt([0.3, 0, 0.4]), 0.22, P.splat, 7);
  },
};

// ------------------------------------------------------------------------------------------------ casters and supports
/** Shrine Maiden: white robe, a wide skirt in the side's colour, long black hair, a wand of paper streamers. */
export const medic: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier, R = staffHand(p);
    const h = guy(m, p, { weight: "light", bulk: 0.92, handR: R, handL: offHand(p), torso: P.white, arms: P.white, legs: P.white, boots: P.white, lunge: 0 });
    robe(m, h, P.team, 0.27, 0.2);
    m.at(h.head, () => { longHair(m, r); m.decal(0.03, () => m.box([-r * 0.9, 0, -r * 0.6], [r * 0.2, r * 0.5, r * 0.3], P.white)); });
    rank(m, h, p);
    m.at(h.aim("R", [0.2, 0, 1]), () => {
      m.cylinder([-0.14, 0, 0], [0.3, 0, 0], 0.014, t >= 3 ? P.bronze : P.woodDk, 0.014, { segs: 5 });
      const sw = p.wave(0.03, 1) + (p.is("cast") ? 0.05 * p.blend : 0);
      m.group(() => { for (const s of [1, -1]) for (let i = 0; i < 3; i++) m.box([0.3 - i * 0.07, s * (0.04 + i * 0.03) + sw * i * 0.5, s * 0.01 - i * 0.02], [0.07, 0.07, 0.012], P.white); });
    });
    if (p.is("cast") && p.after) { m.torus(h.pt([0.05, 0, 0.1]), [0, 0, 1], 0.36 * h.size, 0.03, P.heal, { segs: 14 }); flecks(m, h.pt([0.1, 0, 0.6]), 0.34, 7, 0.04, P.heal, p.i); }
    else if (p.hit) flecks(m, h.pt([0.5, 0.1, 0.6]), 0.14, 5, 0.035, P.heal, 2);
  },
};

/** Drummer: a hoop of drums arched over his back, a stick in each hand; the blow is a dry-brush bolt. */
export const storm: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.16, 0.24, 0.5], [0.3, 0.16, 0.4], { wind: [0.0, 0.28, 0.76] });
    const L = p.mix<V3>([0.16, -0.24, 0.5], [0.3, -0.16, 0.44], { wind: [0.06, -0.28, 0.66] });
    const h = guy(m, p, { weight: "mid", handR: R, handL: L, lunge: 0.2, torso: P.cloth, arms: P.skin });
    robe(m, h, P.inkDk, 0.25, 0.18);
    sash(m, h, p, P.team);
    m.at(h.head, () => { topknot(m, r); headband(m, r, p, P.team); });
    // the hoop of drums: an arc behind the shoulders, over the head
    m.at(h.back, () => {
      const n = 5, R0 = 0.43;
      const arc: V3[] = [];
      for (let i = 0; i <= 12; i++) { const a = (-100 + i * (200 / 12)) * Math.PI / 180; arc.push([0.06, Math.sin(a) * R0, 0.12 + Math.cos(a) * R0]); }
      m.tube(arc, 0.016, P.ink, { segs: 5 });
      for (let i = 0; i < n; i++) {
        const a = (-80 + i * 40) * Math.PI / 180, c: V3 = [0.06, Math.sin(a) * R0, 0.12 + Math.cos(a) * R0];
        m.group(() => m.cylinder([c[0] - 0.045, c[1], c[2]], [c[0] + 0.045, c[1], c[2]], 0.085 + 0.004 * t, P.team, 0.085 + 0.004 * t, { segs: 10 }));
        m.decal(0.02, () => m.group(() => { m.cylinder([c[0] - 0.05, c[1], c[2]], [c[0] - 0.046, c[1], c[2]], 0.07, P.white, 0.07, { segs: 10 }); m.cylinder([c[0] + 0.046, c[1], c[2]], [c[0] + 0.05, c[1], c[2]], 0.07, t >= 4 ? P.teamLt : P.white, 0.07, { segs: 10 }); }));
      }
    });
    rank(m, h, p, 0.36);
    for (const hand of ["R", "L"] as const) m.at(h.aim(hand, norm(p.mix<V3>([0.4, 0, 1], [1, 0, -0.2], { wind: [-0.4, 0, 1] }))), () => { m.cylinder([-0.04, 0, 0], [0.2, 0, 0], 0.014, P.woodDk, 0.014, { segs: 4 }); m.sphere([0.21, 0, 0], 0.03, t >= 3 ? P.bronze : P.ink, { segs: 5 }); });
    if (p.hit) { zigzag(m, h.pt([0.4, 0, 0.5]), h.pt([1.15, 0.05, 0.42]), 0.09, P.zap, 0.03, 6); zigzag(m, h.pt([0.4, 0, 0.5]), h.pt([0.85, -0.25, 0.7]), 0.06, P.zap, 0.018, 4); }
    else if (p.after) zigzag(m, h.pt([0.5, 0, 0.5]), h.pt([1.05, 0.05, 0.44]), 0.07, P.zap, 0.014, 5);
  },
};

/** Bannerman: a tall vertical banner in the side's colour, twice his height. The cast raises it. */
export const banner: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.18, 0.18, 0.4], [0.3, 0.14, 0.44], { wind: [0.08, 0.2, 0.44], cast: [0.16, 0.16, 0.62], castWind: [0.12, 0.2, 0.36] });
    const L = p.mix<V3>([0.2, 0.02, 0.26], [0.3, 0.0, 0.3], { cast: [0.18, 0.04, 0.46] });
    const h = guy(m, p, { weight: "mid", handR: R, handL: L, lunge: 0.3, torso: P.ink, arms: P.cloth });
    skirt(m, h, P.inkDk, 0.22, 0.1);
    sash(m, h, p, P.team);
    m.at(h.head, () => strawHat(m, r, P.ink, 1.5, 0.6, P.team));
    rank(m, h, p, 0.4);
    m.at(h.aim("R", [0.06, 0, 1]), () => {
      const H = 1.05 + 0.04 * t, W = 0.3, sw = p.wave(0.03, 1), drop = 0.72 + 0.03 * t;
      m.cylinder([-0.3, 0, 0], [H, 0, 0], 0.016, P.ink, 0.016, { segs: 5 });
      m.cylinder([H - 0.02, 0, 0], [H - 0.02, W + 0.03, 0], 0.012, P.ink, 0.012, { segs: 4 });
      m.poly([[H - 0.03, 0.02, 0], [H - 0.03, W, 0], [H - 0.03 - drop, W, sw], [H - 0.03 - drop, 0.02, sw * 0.5]], P.team);
      m.decal(0.02, () => { m.torus([H - 0.2, W * 0.52, 0], [0, 0, 1], 0.075, 0.018, P.white, { segs: 10 }); for (let i = 0; i < 2; i++) m.box([H - 0.42 - i * 0.13, W * 0.52, sw * 0.4], [0.07, 0.15, 0.004], i ? P.white : (t >= 4 ? P.teamLt : P.white)); });
      m.sphere([H + 0.03, 0, 0], 0.035, t >= 3 ? P.bronze : P.ink, { segs: 6 });
    });
    if (p.is("cast") && p.after) m.torus(h.pt([0, 0, 0.06]), [0, 0, 1], 0.5, 0.03, P.teamLt, { segs: 16 });
  },
};

/** Snow Sage: a pale robe, a huge snow-laden hat, a white fan that throws shards. */
export const rime: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.2, 0.2, 0.44], [0.4, 0.06, 0.5], { wind: [-0.02, 0.28, 0.6] });
    const h = guy(m, p, { weight: "mid", handR: R, handL: offHand(p), lunge: 0.2, torso: P.paper, arms: P.paper, legs: P.paper });
    robe(m, h, P.paper, 0.27, 0.2);
    sash(m, h, p, P.team);
    m.at(h.head, () => { strawHat(m, r, P.white, 2.1, 0.75, P.team); m.decal(0.03, () => m.cone([r * 0.6, 0, -r * 0.4], [r * 0.7, 0, -r * 1.6], r * 0.42, P.white, { segs: 6 })); });
    rank(m, h, p, 0.42);
    m.at(h.aim("R", norm(p.mix<V3>([0.5, 0, 1], [1, 0, 0.1], { wind: [-0.2, 0, 1] }))), () => fan(m, 0.26 + 0.01 * t, t >= 4 ? P.teamLt : P.white, P.ink));
    if (p.hit) m.group(() => { for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.28; m.cone(h.pt([0.5, Math.sin(a) * 0.2, 0.5]), h.pt([0.5 + Math.cos(a) * 0.5, Math.sin(a) * 0.62, 0.46 + (i % 2) * 0.1]), 0.05, i % 2 ? P.frost : P.frostDk, { segs: 4 }); } });
  },
};

/** Spirit Caller: a tall black court hat, long dark robe, a green ghost-lantern on a crook. */
export const grave: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, R = staffHand(p);
    const h = guy(m, p, { weight: "mid", bulk: 0.95, handR: R, handL: offHand(p), lunge: 0.1, torso: P.ink, arms: P.ink, hands: P.bone, skin: P.bone });
    robe(m, h, P.ink, 0.27, 0.21);
    sash(m, h, p, P.team);
    m.at(h.head, () => courtHat(m, r, P.ink, 2.0 + 0.15 * t));
    m.at(h.chest, () => m.decal(0.03, () => m.box([0.15, 0, 0.0], [0.02, 0.09, 0.2], P.white)));
    rank(m, h, p, 0.5);
    m.at(h.aim("R", [0.15, 0, 1]), () => {
      m.tube([[-0.36, 0, 0], [0.36, 0, 0], [0.46, 0, 0.08], [0.4, 0, 0.16]], 0.016, t >= 3 ? P.bronze : P.woodDk, { segs: 5 });
      m.with(() => { m.move(0.3, 0, 0.17); m.rotY(90); m.ellipsoid([0, 0, 0], [0.065, 0.065, 0.08], P.ghostLamp, { segs: 8 }); m.cylinder([0, 0, 0.07], [0, 0, 0.1], 0.04, P.ink, 0.04, { segs: 6 }); });
    });
    if (p.is("cast") && p.after) { for (let i = 0; i < 3; i++) { const a = i * 2.1 + p.i; m.capsule(h.pt([0.45 + Math.cos(a) * 0.2, Math.sin(a) * 0.25, 0.05]), h.pt([0.45 + Math.cos(a) * 0.22, Math.sin(a) * 0.27, 0.4 + i * 0.1]), 0.05, P.ghost, 0.012, { segs: 5 }); } }
    else if (p.hit) m.capsule(h.pt([0.4, 0.1, 0.7]), h.pt([0.9, 0.05, 0.5]), 0.05, P.ghost, 0.01, { segs: 5 });
  },
};

/** Wright: a carpenter with a great wooden mallet and a rack of bamboo on his back. The cast builds. */
export const tinker: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p);
    const hand = p.is("cast") ? p.mix<V3>([0.14, 0.22, 0.38], [0.34, 0.1, 0.2], { castWind: [0.0, 0.24, 0.7] }) : c.hand;
    const aim = p.is("cast") ? norm(p.mix<V3>([0.45, 0.1, 1], [0.8, 0, -0.6], { castWind: [-0.4, 0.1, 1] })) : c.aim;
    const h = guy(m, p, { weight: "mid", bulk: 1.08, handR: hand, twist: 24, torso: P.cloth, arms: P.skin });
    m.at(h.chest, () => m.decal(0.02, () => m.box([0.13, 0, -0.04], [0.04, 0.26, 0.28], P.team)));
    skirt(m, h, P.team, 0.2, 0.06);
    m.at(h.head, () => { topknot(m, r); m.decal(0.02, () => m.cylinder([0, 0, r * 0.3], [0, 0, r * 0.62], r * 1.05, P.white, r * 0.94, { segs: 10 })); });
    m.at(h.back, () => m.group(() => { for (let i = 0; i < 3 + (t >= 3 ? 1 : 0); i++) m.cylinder([0.07, -0.12 + i * 0.08, -0.14], [0.07 + 0.02 * i, -0.14 + i * 0.09, 0.4 + 0.05 * (i % 2)], 0.032, i % 2 ? P.green : P.greenDk, 0.03, { segs: 6 }); }));
    rank(m, h, p);
    m.at(h.aim("R", aim), () => mallet(m, 0.34, t >= 4 ? P.teamLt : t >= 3 ? P.bronze : P.wood, 0.12));
    if (p.hit) splat(m, h.pt(p.is("cast") ? [0.5, 0.05, 0.06] : [0.52, 0.02, 0.24]), 0.08, P.splat, 6);
  },
};

/** Fox Trickster: a white fox mask with tall ears, a bushy tail, a cape in the side's colour. The cast throws decoys. */
export const trickster: UnitDef = {
  weight: "light", cast: true,
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.14, 0.22, 0.4], [0.38, 0.08, 0.5], { wind: [-0.08, 0.26, 0.56], cast: [0.2, 0.3, 0.7], castWind: [0.05, 0.2, 0.3] });
    const L = p.mix<V3>([0.1, -0.22, 0.36], [0.0, -0.26, 0.4], { cast: [0.2, -0.3, 0.7], castWind: [0.05, -0.2, 0.3] });
    const h = guy(m, p, { weight: "light", bulk: 0.9, handR: R, handL: L, lunge: 0.6, torso: P.inkDk, arms: P.inkDk });
    cape(m, h, p, P.team, 0.44, 0.24);
    sash(m, h, p, P.white);
    // the tail
    const w = p.wave(0.06, 1);
    m.at(h.hips, () => m.group(() => { m.tube([[-0.12, 0, 0.02], [-0.3, w, 0.1], [-0.42, w * 1.5, 0.28]], [0.05, 0.09, 0.06], P.white, { segs: 6 }); m.sphere([-0.45, w * 1.6, 0.33], 0.055, P.ink, { segs: 6 }); }));
    m.at(h.head, () => { m.ellipsoid([-r * 0.2, 0, r * 0.15], [r * 1.02, r * 1.05, r], P.ink, { segs: 10 }); foxMask(m, r, P.white, P.team); });
    rank(m, h, p, 0.5);
    m.at(h.aim("R", norm(p.mix<V3>([0.6, 0, 0.8], [1, -0.2, 0], { wind: [-0.3, 0.2, 1] }))), () => dagger(m, 0.24 + 0.015 * t, blade(t)));
    if (p.is("cast") && p.after) { puff(m, h.pt([0.5, 0.3, 0.3]), 0.14, 0.3, P.mist, 1); puff(m, h.pt([0.5, -0.3, 0.3]), 0.14, 0.3, P.mist, 4); flecks(m, h.pt([0.3, 0, 0.6]), 0.4, 6, 0.035, P.petal, p.i); }
    else if (p.hit) slashArc(m, h, [0.1, 0, 0.42], 0.38, 50, -30, -0.15, P.slash, 0.035);
  },
};

/** Bamboo Sower: a monk with a basket of green shoots on his back and a staff that sprouts leaves. */
export const thorn: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, R = staffHand(p);
    const h = guy(m, p, { weight: "mid", handR: R, handL: offHand(p), lunge: 0.2, torso: P.cloth, arms: P.cloth });
    robe(m, h, P.clothDk, 0.25, 0.19);
    sash(m, h, p, P.team);
    m.at(h.head, () => strawHat(m, r, P.green, 1.7, 0.7, P.team));
    m.at(h.back, () => {
      m.cylinder([0.12, 0, -0.14], [0.12, 0, 0.12], 0.11, P.straw, 0.14, { segs: 10 });
      m.group(() => { for (let i = 0; i < 5; i++) { const a = i * 1.4; m.cone([0.12 + Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0.1], [0.12 + Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.38 + 0.06 * (i % 2)], 0.04, i % 2 ? P.green : P.greenDk, { segs: 5 }); } });
    });
    rank(m, h, p, 0.4);
    m.at(h.aim("R", [0.12, 0, 1]), () => {
      m.cylinder([-0.4, 0, 0], [0.42, 0, 0], 0.02, P.greenDk, 0.018, { segs: 6 });
      m.group(() => { for (let i = 0; i < 3 + t; i++) { const s = i % 2 ? 1 : -1; m.poly([[0.2 + i * 0.05, 0, 0], [0.3 + i * 0.05, s * 0.1, 0.03], [0.34 + i * 0.05, s * 0.02, 0.0]], t >= 4 && i > 3 ? P.teamLt : P.green); } });
    });
    if (p.hit) m.group(() => { for (let i = 0; i < 4; i++) m.cone(h.pt([0.5 + i * 0.14, (i % 2 ? 0.1 : -0.1), 0]), h.pt([0.54 + i * 0.14, (i % 2 ? 0.14 : -0.14), 0.26 + 0.05 * (i % 2)]), 0.045, i % 2 ? P.green : P.greenDk, { segs: 5 }); });
  },
};

/** Lantern Bearer: a big paper lantern on a long pole over the shoulder. The cast sets a ward. */
export const lamp: UnitDef = {
  weight: "mid", cast: true,
  build(m, p) {
    const t = p.tier, R = staffHand(p);
    const h = guy(m, p, { weight: "mid", handR: R, handL: offHand(p), lunge: 0.2, torso: P.inkDk, arms: P.cloth });
    robe(m, h, P.team, 0.24, 0.17);
    m.at(h.head, () => { topknot(m, r); m.decal(0.02, () => m.cylinder([0, 0, r * 0.3], [0, 0, r * 0.62], r * 1.05, P.white, r * 0.94, { segs: 10 })); });
    rank(m, h, p, 0.4);
    m.at(h.aim("R", [0.2, 0, 1]), () => {
      m.tube([[-0.4, 0, 0], [0.56, 0, 0], [0.7, 0, 0.12], [0.68, 0, 0.26]], 0.016, P.ink, { segs: 5 });
      m.with(() => { m.move(0.46, 0, 0.27 + p.wave(0.012, 1)); m.rotY(90); lantern(m, 0.15 + 0.006 * t, t >= 4 ? P.teamLt : P.lampLit, P.team); });
    });
    if (p.is("cast") && p.after) m.torus(h.pt([0.5, 0, 0.05]), [0, 0, 1], 0.34, 0.028, P.lampLit, { segs: 14 });
    else if (p.hit) splat(m, h.pt([0.6, 0.1, 0.6]), 0.07, P.ember, 3);
  },
};

/** Wave Monk: a shaved head, a water gourd, a great round fan that throws a curling wave. */
export const tide: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier;
    const R = p.mix<V3>([0.18, 0.22, 0.46], [0.42, 0.04, 0.46], { wind: [-0.1, 0.3, 0.6] });
    const h = guy(m, p, { weight: "mid", bulk: 1.1, handR: R, handL: offHand(p), twist: 30, lunge: 0.4, torso: P.team, arms: P.team });
    robe(m, h, P.inkDk, 0.26, 0.19);
    m.at(h.chest, () => m.decal(0.02, () => m.torus([0, 0, 0.1], [0.3, 0, 1], 0.17, 0.03, P.rope, { segs: 12 })));
    m.at(h.hips, () => m.group(() => { m.sphere([0.0, -0.2, 0.0], 0.07, P.clay, { segs: 7 }); m.sphere([0.0, -0.2, 0.09], 0.045, P.clay, { segs: 6 }); }));
    m.at(h.head, () => m.decal(0.02, () => m.box([r * 0.6, 0, r * 0.75], [r * 0.3, r * 0.3, r * 0.08], P.ink)));
    rank(m, h, p);
    m.at(h.aim("R", norm(p.mix<V3>([0.4, 0, 1], [1, 0, 0.1], { wind: [-0.4, 0.2, 1] }))), () => fan(m, 0.3 + 0.012 * t, t >= 4 ? P.teamLt : P.white, P.ink));
    if (p.after) {
      const k = p.hit ? 0 : 0.25;
      for (const y of [-0.24, 0, 0.24]) {
        const x0 = 0.55 + k + Math.abs(y) * 0.2;
        m.tube([h.pt([x0, y, 0]), h.pt([x0 + 0.2, y, 0.3]), h.pt([x0 + 0.42, y, 0.34]), h.pt([x0 + 0.5, y, 0.18])], [0.1, 0.085, 0.06, 0.02], P.water, { segs: 6 });
        m.sphere(h.pt([x0 + 0.52, y, 0.14]), 0.05, P.foam, { segs: 5 });
      }
    }
  },
};

/** Burrower: a shaggy straw raincoat, a mattock over the shoulder, a little lamp at the belt. */
export const sapper: UnitDef = {
  weight: "mid",
  build(m, p) {
    const t = p.tier, c = chop(p);
    const h = guy(m, p, { weight: "mid", handR: c.hand, twist: 24, torso: P.straw, arms: P.cloth });
    strawCoat(m, h, P.straw);
    m.at(h.hips, () => m.decal(0.02, () => m.cylinder([0, 0, 0.0], [0, 0, 0.1], 0.3, P.team, 0.32, { segs: 12 })));
    m.at(h.head, () => strawHat(m, r, P.strawDk, 1.45, 1.1, P.team));
    m.at(h.hips, () => m.with(() => { m.move(0.1, -0.24, 0.02); lantern(m, 0.05, P.lampLit, null); }));
    rank(m, h, p, 0.46);
    m.at(h.aim("R", c.aim), () => {
      m.cylinder([-0.14, 0, 0], [0.42, 0, 0], 0.02, P.woodDk, 0.02, { segs: 5 });
      m.tube([[0.42, 0, 0.12], [0.44, 0, 0], [0.4, 0, -0.2]], [0.02, 0.035, 0.008], t >= 4 ? P.teamLt : t >= 3 ? P.bronze : P.ink, { segs: 5 });
    });
    if (p.hit) { splat(m, h.pt([0.5, 0, 0.08]), 0.1, P.splat, 2); }
  },
};

/** Clan Lord: bigger than his men, a crested horned helmet, a cloak in the side's colour, a long sword and a war fan. */
export const lion: UnitDef = {
  weight: "heavy", cast: true,
  build(m, p) {
    const t = p.tier, c = chop(p), rally = p.is("cast");
    const hand = rally ? p.mix<V3>([0.14, 0.22, 0.38], [0.14, 0.2, 0.84], { castWind: [0.1, 0.24, 0.3] }) : c.hand;
    const aim = rally ? norm(p.mix<V3>([0.45, 0.1, 1], [0.1, 0, 1], { castWind: [0.8, 0.1, 0.3] })) : c.aim;
    const L = p.mix<V3>([0.16, -0.24, 0.4], [0.1, -0.26, 0.36], { cast: [0.3, -0.2, 0.6] });
    const h = guy(m, p, { size: 1.2, bulk: 1.22, weight: "heavy", handR: hand, handL: L, twist: 28, lunge: rally ? 0 : 1, torso: P.ink, arms: P.ink, hands: P.ink });
    shoulders(m, h, P.team, 1.22, 1.25);
    cape(m, h, p, P.team, 0.5, 0.3);
    skirt(m, h, P.team, 0.24, 0.1);
    m.at(h.hips, () => m.decal(0.03, () => m.cylinder([0, 0, 0.06], [0, 0, 0.13], 0.2, t >= 3 ? P.bronze : P.white, 0.2, { segs: 12 })));
    m.at(h.head, () => helmet(m, r, { crest: t >= 2 ? P.bronze : P.steel, horns: null, guard: P.team }));
    rank(m, h, p, 0.5);
    m.at(h.aim("R", aim), () => sword(m, 0.6 + 0.03 * t, blade(t), P.bronze, 0.05));
    m.at(h.aim("L", [0.6, 0, 0.8]), () => fan(m, 0.17, P.white, P.ink));
    if (rally && p.after) { m.torus(h.pt([0, 0, 0.06]), [0, 0, 1], 0.6, 0.035, P.teamLt, { segs: 18 }); flecks(m, h.pt([0, 0, 0.9]), 0.5, 8, 0.04, P.petal, p.i); }
    else if (p.hit) slashArc(m, h, [0.05, 0, 0.4], 0.62, 80, -55, -0.3, P.slash, 0.07);
  },
};

// ------------------------------------------------------------------------------------------------ spawned figures
/** Hollow: a thin bone figure in a torn straw hat, raised by the Spirit Caller. */
export const thrall: UnitDef = {
  weight: "light",
  build(m, p) {
    const c = chop(p);
    const h = guy(m, p, { weight: "light", size: 0.92, bulk: 0.7, handR: c.hand, twist: 20, skin: P.bone, torso: P.bone, arms: P.bone, legs: P.bone, boots: P.bone, hands: P.bone, noFace: true });
    m.at(h.chest, () => m.decal(0.02, () => m.group(() => { for (const z of [-0.06, 0.02, 0.1]) m.box([0.1, 0, z], [0.03, 0.2, 0.025], P.ink); })));
    m.at(h.hips, () => m.cylinder([0, 0, 0.1], [0, 0, -0.04], 0.13, P.team, 0.18, { segs: 8 }));
    m.at(h.head, () => {
      m.decal(0.04, () => { for (const s of [1, -1]) m.sphere([r * 0.85, s * r * 0.38, r * 0.05], r * 0.22, P.ink, { segs: 6 }); });
      m.with(() => { m.rotX(14); strawHat(m, r, P.strawDk, 1.5, 0.7); });
    });
    m.at(h.aim("R", c.aim), () => dagger(m, 0.3, P.steel));
    if (p.hit) slashArc(m, h, [0.05, 0, 0.36], 0.36, 60, -40, -0.2, P.slash, 0.03);
  },
};

/** Straw Fox: a straw dummy on a stick wearing the Trickster's mask and cape. */
export const decoy: UnitDef = {
  weight: "light",
  build(m, p) {
    const h = guy(m, p, { weight: "light", bulk: 0.9, skin: P.straw, torso: P.straw, arms: P.straw, legs: P.strawDk, boots: P.strawDk, hands: P.strawDk, noFace: true, lunge: 0.3 });
    cape(m, h, p, P.team, 0.4, 0.22);
    m.at(h.chest, () => m.decal(0.02, () => m.group(() => { for (const z of [-0.08, 0.08]) m.torus([0, 0, z], [0, 0, 1], 0.17, 0.014, P.woodDk, { segs: 10 }); })));
    m.at(h.head, () => { foxMask(m, r, P.paper, P.team); m.group(() => { for (let i = 0; i < 5; i++) m.cone([-r * 0.3, (i - 2) * r * 0.3, r * 0.7], [-r * 0.5, (i - 2) * r * 0.5, r * 1.5], r * 0.12, P.strawDk, { segs: 4 }); }); });
    if (p.hit) puff(m, h.pt([0.3, 0, 0.4]), 0.1, 0.3);
  },
};
void [backBanner, lantern, spear, staff];
