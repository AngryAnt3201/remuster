// Blackridge's bodies. The kit's humanoid is a toy soldier (a head a quarter of its height); these are people:
// about seven and a half heads tall, long legs, narrow hips, shoulders under a plate carrier, two-bone arms and legs
// with real knees and elbows. Same Pose, same clip plan, same kind of frames handed back as artkit/rig.ts.
import { IMPACT, step, type Pose, type Weight } from "../../../artkit/rig";
import { IDENT, add, cross, dot, frameAt, len, lerp3, mmul, mpoint, mul, norm, rotation, scaling, sub, translation, type M34, type Material, type Model, type V3 } from "../../../artkit/toon3d";

const W_AMP: Record<Weight, number> = { heavy: 1.3, mid: 1, light: 0.85 };
const mdirOf = (f: M34, d: V3): V3 => norm([f[0] * d[0] + f[1] * d[1] + f[2] * d[2], f[4] * d[0] + f[5] * d[1] + f[6] * d[2], f[8] * d[0] + f[9] * d[1] + f[10] * d[2]]);

/** The attack's crouch-back and drive, the shooter's kick, the cast's rise: whole-body motion about the feet. */
export function strikeRoot(p: Pose, weight: Weight, lunge: number, recoil = 0): M34 {
  const b = p.blend, a = W_AMP[weight];
  if (p.anim === "attack") {
    if (b < 0) return mmul(translation(0.06 * b * lunge * a, 0, 0), rotation("y", 7 * b * lunge));
    const kick = recoil * (p.i === IMPACT ? 1 : p.i === IMPACT + 1 ? 0.6 : 0.15);
    return mmul(translation(0.11 * Math.min(b, 1.2) * lunge * a - kick, 0, 0), rotation("y", 10 * b * lunge - kick * 50));
  }
  return IDENT.slice();
}

/** Joint between a and b for bones of length la, lb, bending towards `pole`. */
function joint(a: V3, b: V3, la: number, lb: number, pole: V3): V3 {
  const d = sub(b, a), dl = Math.min(len(d), (la + lb) * 0.999) || 1e-6, u = mul(d, 1 / (len(d) || 1));
  const x = (la * la - lb * lb + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, la * la - x * x));
  let pp = sub(pole, mul(u, dot(pole, u)));
  if (len(pp) < 1e-5) pp = cross(u, [0, 1, 0]);
  return add(add(a, mul(u, x)), mul(norm(pp), h));
}

export interface SoldierOpts {
  /** 1 = a standard soldier, about 0.94 units to the top of the head. */
  size?: number;
  /** Widths: 1 standard, 1.25 a big man in armour, 0.9 slight. */
  bulk?: number;
  weight?: Weight;
  skin: Material; torso: Material; legs: Material; boots: Material;
  arms?: Material; hands?: Material;
  /** Hand targets in body space at size 1: x forward, y right, z up from the ground. Shoulders are at z 0.755,
   *  y +-0.118; the arm reaches 0.32. Omitted hands hang and swing. */
  handR?: V3; handL?: V3;
  swingR?: number; swingL?: number;
  lunge?: number; recoil?: number; twist?: number; lean?: number;
  /** Sitting (a vehicle seat): the legs fold forward and the body leaves walking and dying to its ride. */
  seated?: boolean;
  /** Knees bent this much at rest (0..1): a braced shooter 0.25, a kneeling crew 1. */
  crouch?: number;
  noHead?: boolean;
  stride?: number;
  /** An armband on both upper arms. */
  band?: Material;
  /** Knee pads. */
  pads?: Material;
}
export interface SoldierRig {
  root: M34; hips: M34; chest: M34; head: M34; back: M34;
  handR: M34; handL: M34; pR: V3; pL: V3;
  pt(v: V3): V3; dir(v: V3): V3;
  aim(hand: "R" | "L", bodyDir: V3, up?: V3): M34;
  size: number; bulk: number;
}

export const HEAD_R = 0.058;
const HIP_Z = 0.5, THIGH = 0.225, SHIN = 0.23, UPPER = 0.165, FORE = 0.16;

/** Draws a person and returns frames to hang kit on. */
export function soldier(m: Model, p: Pose, o: SoldierOpts): SoldierRig {
  const size = o.size ?? 1, bulk = o.bulk ?? 1, weight = o.weight ?? "mid", amp = W_AMP[weight], sb = Math.sqrt(bulk);
  const S = o.stride ?? (weight === "heavy" ? 0.5 : weight === "light" ? 0.62 : 0.56);
  const t = p.t, crouch = o.crouch ?? 0;
  let root = IDENT.slice();
  let bob = -0.008 - 0.09 * crouch, sway = 0, breathe = 0, lean = 4 + 10 * crouch;
  let footR: V3 = [-0.04, 0, 0], footL: V3 = [0.05, 0, 0];
  let armSwing = 0, fling = 0, nod = 0;
  if (p.anim === "idle") {
    breathe = p.wave(1); sway = p.wave(0.006, 1, 0.25); bob -= 0.003 * breathe;
  } else if (p.anim === "walk" && !o.seated) {
    p.stride = Math.max(p.stride, S * size);
    const a = step(t, S, 0.075 * amp), b = step(t + 0.5, S, 0.075 * amp);
    footR = [a[0], 0, a[1]]; footL = [b[0], 0, b[1]];
    bob = -0.03 - 0.014 * amp * Math.cos(t * Math.PI * 4) - 0.05 * crouch;
    lean = o.lean ?? (weight === "light" ? 12 : weight === "heavy" ? 6 : 9);
    armSwing = Math.cos(t * Math.PI * 2);
    sway = 0.008 * Math.sin(t * Math.PI * 2);
    nod = 2 * Math.cos(t * Math.PI * 4);
  } else if (p.anim === "attack" || p.anim === "cast") {
    const b = p.blend, l = o.lunge ?? 1;
    root = strikeRoot(p, weight, l, o.recoil ?? 0);
    footR = [-0.1 - 0.03 * l + (b > 0 ? -0.04 * b * l : 0), 0, 0]; footL = [0.1 + 0.03 * l + (b > 0 ? 0.08 * b * l : 0), 0, 0];
    bob = -0.045 - 0.05 * crouch + (b < 0 ? 0.02 * b * amp : -0.015 * b * l);
    lean = 6 + 8 * crouch + (b > 0 ? 5 * b * l : 0);
    if (p.anim === "cast") { bob = -0.03 + (b < 0 ? 0.02 * b : 0.015 * Math.min(1, b)); lean = 3; }
  } else if (p.anim === "death" && !o.seated) {
    // hit, buckle at the knees, fall onto the back, settle
    const ang = [-10, -30, -64, -90, -86, -89][p.i] ?? -89, lift = [0, 0, 0.02, 0.05, 0.065, 0.06][p.i] ?? 0.06;
    root = mmul(translation([-0.03, -0.07, -0.12, -0.15, -0.16, -0.16][p.i] ?? -0.16, 0, lift * size), rotation("y", ang));
    fling = [0.3, 0.65, 1, 1, 0.92, 0.9][p.i] ?? 0.9;
    bob = [-0.05, -0.12, -0.06, -0.01, 0, 0][p.i] ?? 0; lean = 0;
    footR = [0.02, 0.03 * fling, 0.01]; footL = [0.1 * fling, -0.04 * fling, 0.03 * fling];
  } else if (p.anim === "death") fling = [0.3, 0.65, 1, 1, 0.92, 0.9][p.i] ?? 0.9;
  if (o.seated) { bob = 0; lean = 0; }
  root = mmul(root, scaling(size));
  const hipsZ = o.seated ? 0.1 : HIP_Z + bob;
  const hips = mmul(root, mmul(translation(0, sway, hipsZ), rotation("y", lean * 0.4)));
  const tw = (o.twist ?? 0) * (p.anim === "attack" ? -p.blend : 0);
  const chest = mmul(hips, mmul(rotation("y", lean * 0.6), mmul(rotation("z", tw), translation(0, 0, 0.135 + 0.003 * breathe))));
  const head = mmul(chest, mmul(translation(0.012, 0, 0.262), mmul(rotation("z", -tw * 0.6), rotation("y", nod - lean * 0.8 + (p.anim === "death" ? -14 * fling : 0)))));
  const fwd = mdirOf(root, [1, 0, 0]);

  // ---- legs
  const thR = 0.05 * sb * size, knR = 0.037 * sb * size, anR = 0.03 * sb * size, hipW = 0.05 * bulk;
  for (const sgn of [1, -1]) {
    const f = sgn > 0 ? footR : footL;
    const hip = mpoint(hips, [0, sgn * hipW, -0.015]);
    let ankle: V3, toe: V3, knee: V3;
    if (o.seated) {
      knee = mpoint(hips, [0.2, sgn * (hipW + 0.03), 0.03]);
      ankle = mpoint(hips, [0.24, sgn * (hipW + 0.03), -0.19]);
      toe = mdirOf(root, [1, 0, 0]);
    } else {
      ankle = mpoint(root, [f[0], sgn * (hipW + 0.022) + f[1], 0.045 + f[2]]);
      toe = mdirOf(root, [1, sgn * 0.12, f[2] > 0.01 ? -0.6 * (f[2] / 0.075) : 0]);
      knee = joint(hip, ankle, THIGH * size, SHIN * size, add(fwd, mul(mdirOf(root, [0, sgn, 0]), 0.12)));
    }
    m.group(() => {
      m.capsule(hip, knee, thR, o.legs, knR * 1.08, { segs: 10 });
      m.capsule(knee, ankle, knR, o.legs, anR, { segs: 10 });
    });
    if (o.pads) m.sphere(add(knee, mul(fwd, knR * 0.45)), knR * 1.12, o.pads, { segs: 8 });
    m.at(frameAt(ankle, toe), () => m.group(() => {
      m.ellipsoid([0.03 * size, 0, -0.018 * size], [0.072 * size, 0.034 * size * sb, 0.03 * size], o.boots, { segs: 10 });
      m.capsule([0, 0, -0.01 * size], [0, 0, 0.04 * size], anR * 1.12, o.boots, anR * 1.05, { segs: 8 });
    }));
  }
  // ---- pelvis, torso, neck
  m.group(() => {
    m.at(hips, () => m.ellipsoid([0, 0, 0.005], [0.064 * bulk, 0.088 * bulk, 0.07], o.legs, { segs: 12 }));
    m.at(chest, () => {
      m.ellipsoid([0, 0, -0.03], [0.062 * bulk, 0.086 * bulk, 0.09], o.torso, { segs: 12 });
      m.ellipsoid([0.004, 0, 0.065 + 0.003 * breathe], [0.074 * bulk, 0.112 * bulk, 0.088], o.torso, { segs: 12 });
    });
  });
  m.at(chest, () => m.capsule([0.004, 0, 0.14], [0.01, 0, 0.215], 0.03, o.skin, 0.027, { segs: 8 }));

  // ---- arms
  const restR: V3 = [0.03, 0.155 * bulk, 0.44], restL: V3 = [0.03, -0.155 * bulk, 0.44];
  const hand = (target: V3 | undefined, rest: V3, side: number, swing: number): V3 => {
    let h = (target ?? rest).slice() as V3;
    const k = target ? swing : 1;
    if (k > 0) { h[0] += -side * 0.11 * amp * armSwing * k; h[2] += 0.02 * Math.abs(armSwing) * k; }
    if (fling) h = lerp3(h, [0.1, side * 0.3, 0.86], fling * 0.75);
    return [h[0], h[1] + sway, h[2] + (o.seated ? 0 : bob + 0.008) + 0.003 * breathe];
  };
  const twM = o.seated ? mmul(hips, translation(0, 0, -HIP_Z)) : mmul(root, rotation("z", tw));
  const pR = mpoint(twM, hand(o.handR, restR, 1, o.swingR ?? (o.handR ? 0 : 1)));
  const pL = mpoint(twM, hand(o.handL, restL, -1, o.swingL ?? (o.handL ? 0 : 1)));
  const armM = o.arms ?? o.torso, handM = o.hands ?? o.skin, aR = 0.036 * sb * size;
  for (const [sgn, ph] of [[1, pR], [-1, pL]] as [number, V3][]) {
    const sh = mpoint(chest, [0, sgn * 0.118 * bulk, 0.118]);
    const d = sub(ph, sh), dl = len(d), ARM = (UPPER + FORE) * size;
    const wrist = dl > ARM ? add(sh, mul(d, ARM / dl)) : ph;
    const elbow = joint(sh, wrist, UPPER * size, FORE * size, mdirOf(root, [-0.5, sgn * 0.55, -0.65]));
    m.group(() => {
      m.sphere(sh, aR * 1.25, armM, { segs: 10 });
      m.capsule(sh, elbow, aR * 1.12, armM, aR * 0.92, { segs: 10 });
      m.capsule(elbow, wrist, aR * 0.9, armM, aR * 0.72, { segs: 10 });
    });
    if (o.band) m.decal(0.012, () => m.cylinder(lerp3(sh, elbow, 0.3), lerp3(sh, elbow, 0.62), aR * 1.13, o.band!, aR * 1.03, { segs: 10 }));
    m.sphere(dl > ARM ? lerp3(wrist, ph, 0.5) : ph, 0.03 * size * sb, handM, { segs: 8 });
  }
  // ---- head
  if (!o.noHead) m.at(head, () => m.ellipsoid([0, 0, 0], [HEAD_R * 1.02, HEAD_R * 0.9, HEAD_R * 1.12], o.skin, { segs: 12 }));
  const aimR = norm(sub(pL, pR)), upv = mdirOf(root, [0, 0, 1]);
  return {
    root, hips, chest, head, pR, pL, size, bulk,
    handR: frameAt(pR, aimR, upv), handL: frameAt(pL, mul(aimR, -1), upv),
    back: mmul(chest, mmul(translation(-0.075 * bulk, 0, 0.05), rotation("z", 180))),
    pt: (v) => mpoint(twM, v), dir: (v) => mdirOf(twM, v),
    aim: (hd, d, up = [0, 0, 1]) => frameAt(hd === "R" ? pR : pL, mdirOf(twM, d), mdirOf(twM, up)),
  };
}

// ------------------------------------------------------------------------------------------------ vehicles
export interface VehicleRig {
  /** The hull: rocks on its springs, kicks on the shot, slumps when knocked out. */
  body: M34;
  /** Wheel or track travel, degrees. */
  spin: number;
  /** 0..1 how far the gun is in recoil; 0..1 how burnt out the wreck is. */
  kick: number; wreck: number;
}
/** A wheeled or tracked vehicle: idles on its engine, rolls with a recorded stride, lunges or recoils, burns out. */
export function vehicle(p: Pose, o: { stride?: number; lunge?: number; recoil?: number; size?: number; weight?: Weight } = {}): VehicleRig {
  const size = o.size ?? 1, S = o.stride ?? 0.7;
  let root = scaling(size), spin = 0, kick = 0, pitch = 0, roll = 0, z = 0, x = 0;
  if (p.anim === "idle") z = 0.004 * p.wave(1, 3);
  else if (p.anim === "walk") { p.stride = Math.max(p.stride, S * size); spin = -p.t * 360; z = 0.006 * p.wave(1, 2); pitch = -1.2 + 0.8 * p.wave(1, 2, 0.2); }
  else if (p.anim === "attack" || p.anim === "cast") {
    const b = p.blend, l = o.lunge ?? 0;
    kick = p.i === IMPACT ? 1 : p.i === IMPACT + 1 ? 0.55 : p.i === IMPACT + 2 ? 0.2 : 0;
    x = (b < 0 ? 0.07 * b : 0.16 * Math.min(b, 1.2)) * l - (o.recoil ?? 0) * kick;
    pitch = (b < 0 ? -4 * b : 5 * b) * l - (o.recoil ?? 0) * kick * 45;
    spin = -b * 60 * l;
  } else if (p.anim === "death") {
    const k = p.dead;
    z = [0.03, 0.07, 0.02, -0.03, -0.02, -0.025][p.i] ?? -0.025; roll = [2, -5, 7, 10, 9, 9][p.i] ?? 9; pitch = [-3, 4, 3, 2, 2, 2][p.i] ?? 2;
    x = -0.03 * k;
  }
  root = mmul(root, mmul(translation(x, 0, z), mmul(rotation("y", pitch), rotation("x", roll))));
  return { body: root, spin, kick, wreck: p.dead };
}
