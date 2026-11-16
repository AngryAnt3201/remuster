// Rigs and motion for the toon renderer: a Pose for every frame of every clip, and rigs (humanoid, quadruped, flyer,
// crawler, structure) that turn a Pose into a moving body and hand back frames (head, hands, chest, saddle...) for a
// unit builder to hang its own parts on.
//
// The clip plan matches the game's atlas contract (base/public/atlas/manifest.json, docs/ART-V3-ATLAS.md):
//   idle 6 frames (loop), walk 8 (loop, feet planted, stride recorded), attack 6 (the blow lands on frame 2),
//   death 6, cast 6 (optional special move, the release on frame 2).
import { DEG, IDENT, Model, add, clamp, frameAt, lerp, lerp3, mmul, mpoint, mul, norm, rotation, scaling, sub, translation, type M34, type Material, type V3 } from "./toon3d";

export type Anim = "idle" | "walk" | "attack" | "death" | "cast";
export type Weight = "heavy" | "mid" | "light";
export const CLIPS: Record<Anim, number> = { idle: 6, walk: 8, attack: 6, death: 6, cast: 6 };
/** The frame of the attack and cast clips the blow lands on. */
export const IMPACT = 2;
/** The attack's blend per frame: wind-up, hold, IMPACT, overshoot, follow-through, recover. */
export const ATTACK_BLEND = [-0.6, -1, 1, 1.15, 0.65, 0.22];
export const CAST_BLEND = [-0.6, -1, 1, 1.1, 0.75, 0.3];

type Num3 = number | V3;

/** One frame of one clip: what to draw. Builders read it; rigs read it for the body's own motion. */
export class Pose {
  /** World units travelled per walk cycle; rigs set it on walk frames and the bake records it in the manifest. */
  stride = 0;
  constructor(
    readonly kind: string,
    /** Rank 1 to 4 (4 = Ascended). */
    readonly tier: number,
    readonly anim: Anim,
    /** Frame index and frame count of the clip. */
    readonly i: number,
    readonly n: number,
  ) {}
  /** 0..1 through a looping clip (idle, walk): i / n. */
  get t() { return this.i / this.n; }
  /** Death: 0 (first frame) to 1 (settled). 0 in every other clip. */
  get dead() { return this.anim === "death" ? this.i / (this.n - 1) : 0; }
  /** Attack and cast: -1 full wind-up, 0 rest, 1 the blow, > 1 overshoot. 0 in other clips. */
  get blend() { return this.anim === "attack" ? ATTACK_BLEND[this.i] ?? 0 : this.anim === "cast" ? CAST_BLEND[this.i] ?? 0 : 0; }
  /** True on the frame the blow lands (draw the muzzle flash, the slash, the spark here). */
  get hit() { return (this.anim === "attack" || this.anim === "cast") && this.i === IMPACT; }
  /** True on the impact frame and the one after it (smoke that lingers). */
  get after() { return (this.anim === "attack" || this.anim === "cast") && (this.i === IMPACT || this.i === IMPACT + 1); }
  is(a: Anim) { return this.anim === a; }
  /** A sine through the loop: amp * sin(2 pi (t * cycles + phase)). Loops cleanly in idle and walk. */
  wave(amp = 1, cycles = 1, phase = 0) { return amp * Math.sin(Math.PI * 2 * (this.t * cycles + phase)); }
  /** Rest, strike and wind-up poses blended for this frame. In the cast clip `cast` (and `castWind`) stand in for
   *  strike (and wind). Works on numbers and on points. */
  mix<T extends Num3>(rest: T, strike: T, o: { wind?: T; cast?: T; castWind?: T } = {}): T {
    const b = this.blend;
    let to: T = rest, k = 0;
    if (this.anim === "cast") { if (b > 0) { to = o.cast ?? strike; k = b; } else { to = o.castWind ?? o.wind ?? rest; k = -b; } }
    else if (b > 0) { to = strike; k = b; } else if (b < 0) { to = o.wind ?? rest; k = -b; }
    if (typeof rest === "number") return lerp(rest, to as number, k) as T;
    return lerp3(rest as V3, to as V3, k) as T;
  }
}

/** A foot's place in the walk cycle at phase ph (0..1): planted for the first half, sliding back at the body's
 *  ground speed (so the runtime's distance-based stepping keeps it still on the ground), then lifted and swung
 *  forward. Returns [x along the walk, lift]. */
export function step(ph: number, stride: number, lift: number): [number, number] {
  ph = ((ph % 1) + 1) % 1;
  if (ph < 0.5) return [stride / 4 - (stride / 2) * (ph / 0.5), 0];
  const u = (ph - 0.5) / 0.5;
  return [-stride / 4 + (stride / 2) * (u * u * (3 - 2 * u)), lift * Math.sin(Math.PI * u)];
}

const W_AMP: Record<Weight, number> = { heavy: 1.35, mid: 1, light: 0.8 };

/** The whole-body motion every rig shares, as a matrix about the feet: the attack's crouch-back and lunge with
 *  squash and stretch, the cast's rise. `lunge` scales how far the body throws itself (0 for a rooted shooter). */
function strikeRoot(p: Pose, weight: Weight, lunge: number, recoil = 0): M34 {
  const b = p.blend, a = W_AMP[weight];
  if (p.anim === "attack") {
    if (b < 0) return mmul(translation(0.07 * b * lunge * a, 0, 0), mmul(rotation("y", 9 * b * lunge), scaling(1 - 0.03 * b * a, 1 - 0.03 * b * a, 1 + 0.07 * b * a)));
    const kick = recoil * (p.i === IMPACT ? 1 : p.i === IMPACT + 1 ? 0.6 : 0.15);
    return mmul(translation(0.12 * Math.min(b, 1.2) * lunge * a - kick, 0, 0), mmul(rotation("y", 12 * b * lunge - kick * 60), scaling(1, 1, 1 + 0.04 * b * lunge)));
  }
  if (p.anim === "cast") return scaling(1 - 0.03 * b, 1 - 0.03 * b, 1 + 0.06 * b);
  return IDENT.slice();
}

// ------------------------------------------------------------------------------------------------ humanoid
export interface HumanoidOpts {
  /** Overall scale: 1 is a standard soldier, about 0.86 units tall. */
  size?: number;
  /** Body widths: 1 = standard; 1.3 a brute; 0.85 a wiry scout. */
  bulk?: number;
  weight?: Weight;
  skin: Material; torso: Material; legs: Material; boots: Material;
  /** Sleeves (default: the torso material) and hands (default: skin). */
  arms?: Material; hands?: Material;
  /** Hand targets for this frame, in body space at size 1 (x forward, y right, z up from the ground). Blend them
   *  yourself with pose.mix(rest, strike, { wind }). Omitted hands hang at the sides and swing with the walk. */
  handR?: V3; handL?: V3;
  /** How much each arm swings with the walk, 0..1 (default 1; 0 for a hand that holds something steady). */
  swingR?: number; swingL?: number;
  /** How far the body lunges into its blow (default 1 for a melee swing; 0 for a rooted shooter or caster). */
  lunge?: number;
  /** Kick back on the impact frame, world units (ranged recoil). */
  recoil?: number;
  /** The chest turns this many degrees into the blow: back in the wind-up, through on the strike. */
  twist?: number;
  /** Lean into the walk, degrees (default by weight). */
  lean?: number;
  /** Sitting astride a mount or in a cockpit: legs splay and the rig leaves walking and dying to the mount. */
  seated?: boolean;
  /** Skip drawing parts the builder replaces (a helmet instead of a head, armour instead of a torso). */
  noHead?: boolean; noTorso?: boolean; noFace?: boolean;
  /** Stride length in world units per cycle at size 1 (default by weight). */
  stride?: number;
  /** Leg length against the standard (default 1): long legs for giants and stilt-walkers. */
  leg?: number;
  /** Head radius (default 0.19). */
  head?: number;
}
export interface HumanoidRig {
  /** Frames to hang parts on, in the space the rig was called in. x forward, y right, z up. */
  root: M34; hips: M34; chest: M34; head: M34;
  /** The hands: +x runs from the right hand towards the left for a two-handed grip (use `gripAim` for a weapon). */
  handR: M34; handL: M34;
  /** Between the shoulder blades, facing back. */
  back: M34;
  /** Hand positions in the rig's space. */
  pR: V3; pL: V3;
  /** A body-space point (size 1, x forward, y right, z up from the ground) or direction in the rig's space. */
  pt(v: V3): V3; dir(v: V3): V3;
  /** A frame at a hand whose +x aims along a body-space direction: hang a one-handed weapon on it. */
  aim(hand: "R" | "L", bodyDir: V3, up?: V3): M34;
  size: number;
}

/** Draws a toy soldier and returns its frames. See HumanoidOpts for what a builder supplies. */
export function humanoid(m: Model, p: Pose, o: HumanoidOpts): HumanoidRig {
  const size = o.size ?? 1, bulk = o.bulk ?? 1, weight = o.weight ?? "mid", amp = W_AMP[weight];
  const S = o.stride ?? (weight === "heavy" ? 0.46 : weight === "light" ? 0.36 : 0.41);
  const t = p.t;
  let root = IDENT.slice();
  let bob = 0, sway = 0, breathe = 0, lean = 0;
  const legK = o.leg ?? 1, hipW = 0.085 * bulk, hipZ = 0.235 * legK;
  let footR: [number, number] = [0, 0], footL: [number, number] = [0, 0];
  let armSwing = 0, fling = 0, headNod = 0;
  if (p.anim === "idle") {
    breathe = p.wave(1); sway = p.wave(0.012, 1, 0.25);
    bob = -0.006 - 0.006 * breathe;
  } else if (p.anim === "walk" && !o.seated) {
    p.stride = Math.max(p.stride, S * size);
    footR = step(t, S, 0.085 * amp); footL = step(t + 0.5, S, 0.085 * amp);
    bob = -0.022 * amp * Math.cos(t * Math.PI * 4) - 0.012;
    lean = o.lean ?? (weight === "light" ? 11 : weight === "heavy" ? 4 : 7);
    armSwing = Math.cos(t * Math.PI * 2);
    sway = 0.012 * Math.sin(t * Math.PI * 2);
    headNod = 3 * Math.cos(t * Math.PI * 4);
  } else if (p.anim === "walk") {
    bob = -0.012 * Math.cos(t * Math.PI * 4);
  } else if (p.anim === "attack" || p.anim === "cast") {
    root = strikeRoot(p, weight, o.lunge ?? 1, o.recoil ?? 0);
    const b = p.blend, l = o.lunge ?? 1;
    // a wide braced stance through the swing
    footR = [-0.05 * l + (b > 0 ? -0.05 * b * l : 0), 0]; footL = [0.05 * l + (b > 0 ? 0.07 * b * l : 0), 0];
    bob = b < 0 ? 0.03 * b * amp : -0.012 * b * l;
    if (p.anim === "cast") bob = b < 0 ? 0.025 * b : 0.02 * Math.min(1, b);
  } else if (p.anim === "death" && !o.seated) {
    // recoil, buckle, fall, impact, bounce, settle: onto its back, head away from the blow
    const ang = [-14, -34, -68, -93, -86, -90][p.i] ?? -90;
    const lift = [0, 0.0, 0.03, 0.1, 0.13, 0.11][p.i] ?? 0.11;
    const sq = [1, 0.93, 1, 0.9, 1.03, 1][p.i] ?? 1;
    root = mmul(translation([-0.03, -0.06, -0.1, -0.12, -0.13, -0.13][p.i] ?? -0.13, 0, lift * size), mmul(rotation("y", ang), scaling(1, 1, sq)));
    fling = [0.35, 0.7, 1, 1, 0.9, 0.85][p.i] ?? 1;
    bob = [-0.02, -0.06, -0.03, 0, 0, 0][p.i] ?? 0;
    footR = [0.03 * fling, 0.02 * fling]; footL = [0.08 * fling, 0.06 * fling];
  } else if (p.anim === "death") {
    fling = [0.35, 0.7, 1, 1, 0.9, 0.85][p.i] ?? 1;
  }
  root = mmul(root, scaling(size));
  if (lean) root = mmul(root, rotation("y", lean));
  const hipsZ = (o.seated ? 0.2 : hipZ) + bob;
  const up = hipZ - 0.235; // how much taller than standard the legs make the body: hand targets ride up with it
  const hips = mmul(root, translation(0, sway, hipsZ));
  const tw = (o.twist ?? 0) * (p.anim === "attack" ? -p.blend : 0);
  const chest = mmul(hips, mmul(rotation("z", tw), translation(0, sway * 0.5, 0.15 + 0.008 * breathe)));
  const headR = o.head ?? 0.19;
  const head = mmul(chest, mmul(translation(0.012, 0, 0.3 + 0.004 * breathe), mmul(rotation("z", -tw * 0.5), rotation("y", headNod + (p.anim === "death" ? -12 * fling : 0)))));

  // ---- legs: hips down to feet that stay where the walk put them
  const toBody = (x: number, y: number, z: number): V3 => mpoint(root, [x, y, z]);
  const legR = 0.068 * Math.sqrt(bulk), LEG = 0.25 * legK;
  for (const sgn of [1, -1]) {
    const [fx, fz] = sgn > 0 ? footR : footL;
    const hip = mpoint(hips, [0, sgn * hipW, -0.02]);
    let foot: V3, toe: V3;
    if (o.seated) {
      foot = mpoint(hips, [0.07, sgn * (hipW + 0.14 * bulk), -0.2]);
      toe = [0.5, sgn * 0.5, -0.2];
    } else {
      foot = toBody(fx, sgn * (hipW + 0.012), 0.05 + fz);
      toe = [1, 0, fz > 0.01 ? -0.5 * (fz / 0.085) : 0];
    }
    const d = sub(foot, hip), dl = Math.hypot(d[0], d[1], d[2]);
    const fwd = mdirOf(root, [1, 0, 0]);
    const bend = Math.sqrt(Math.max(0, (LEG * size / 2) ** 2 - (Math.min(dl, LEG * size) / 2) ** 2));
    const knee = add(add(hip, mul(d, 0.5)), mul(fwd, bend * 0.9));
    m.group(() => {
      m.capsule(hip, knee, legR * size * 1.05, o.legs, legR * size);
      m.capsule(knee, add(foot, [0, 0, 0.02 * size]), legR * size, o.legs, legR * size * 0.9);
    });
    m.at(frameAt(foot, mdirOf(root, toe)), () => m.ellipsoid([0.035 * size, 0, 0.005 * size], [0.105 * size, 0.07 * size * Math.sqrt(bulk), 0.058 * size], o.boots));
  }
  // ---- hips and torso
  if (!o.noTorso) {
    m.at(hips, () => m.ellipsoid([0, 0, 0.02], [0.125 * bulk, 0.15 * bulk, 0.1], o.legs));
    m.at(chest, () => m.ellipsoid([0, 0, 0.03], [0.145 * bulk, 0.185 * bulk, 0.17 + 0.006 * breathe], o.torso));
  }
  // ---- arms
  const restR: V3 = [0.03, 0.245 * bulk, 0.3], restL: V3 = [0.03, -0.245 * bulk, 0.3];
  const flingTo = (side: number): V3 => [0.12, side * 0.3 * bulk, 0.62];
  const hand = (target: V3 | undefined, rest: V3, side: number, swing: number): V3 => {
    let h = target ? target.slice() as V3 : rest.slice() as V3;
    if (!target || swing > 0) h[0] += -side * 0.085 * amp * armSwing * (target ? swing : 1), h[2] += 0.012 * Math.abs(armSwing) * (target ? swing : 1);
    if (p.anim === "idle" && !target) h[2] += 0.006 * breathe;
    if (fling) h = lerp3(h, flingTo(side), fling * 0.8);
    // body space (ground-relative) follows the hips' bob and sway
    return [h[0], h[1] + sway, h[2] + bob + 0.008 * breathe + (o.seated ? 0 : up)];
  };
  const hR = hand(o.handR, restR, 1, o.swingR ?? (o.handR ? 0 : 1)), hL = hand(o.handL, restL, -1, o.swingL ?? (o.handL ? 0 : 1));
  const twM = mmul(root, rotation("z", tw));
  const pR = mpoint(twM, hR), pL = mpoint(twM, hL);
  const armM = o.arms ?? o.torso, handM = o.hands ?? o.skin, armRad = 0.058 * Math.sqrt(bulk) * size;
  for (const [sgn, ph] of [[1, pR], [-1, pL]] as [number, V3][]) {
    const sh = mpoint(chest, [0, sgn * 0.165 * bulk, 0.11]);
    const d = sub(ph, sh), dl = Math.hypot(d[0], d[1], d[2]), ARM = 0.27 * size;
    // the elbow drops and swings out a little when the hand is close in
    const bend = Math.sqrt(Math.max(0, (ARM / 2) ** 2 - (Math.min(dl, ARM) / 2) ** 2));
    const out = norm(add(mdirOf(root, [-0.35, sgn * 0.6, -0.7]), [0, 0, 0]));
    const elbow = add(add(sh, mul(d, 0.5)), mul(out, bend));
    const reach = dl > ARM ? add(sh, mul(d, ARM / dl)) : ph; // short arms: the hand floats on the weapon if it must
    m.group(() => {
      m.sphere(sh, armRad * 1.2, armM, { segs: 10 });
      m.capsule(sh, elbow, armRad * 1.1, armM, armRad, { segs: 10 });
      m.capsule(elbow, dl > ARM ? lerp3(reach, ph, 0.5) : ph, armRad, armM, armRad * 0.95, { segs: 10 });
    });
    m.sphere(ph, 0.062 * size * Math.sqrt(bulk), handM, { segs: 10 });
  }
  // ---- head
  if (!o.noHead) m.at(head, () => {
    m.sphere([0, 0, 0], headR, o.skin);
    if (!o.noFace) face(m, headR, p.anim === "death" && p.i >= 2);
  });
  const aimR = norm(sub(pL, pR));
  return {
    root, hips, chest, head,
    handR: frameAt(pR, aimR, mdirOf(root, [0, 0, 1])), handL: frameAt(pL, mul(aimR, -1), mdirOf(root, [0, 0, 1])),
    back: mmul(chest, mmul(translation(-0.13 * bulk, 0, 0.06), rotation("z", 180))),
    pR, pL, size,
    pt: (v) => mpoint(twM, v), dir: (v) => mdirOf(twM, v),
    aim: (hand, d, up = [0, 0, 1]) => frameAt(hand === "R" ? pR : pL, mdirOf(twM, d), mdirOf(twM, up)),
  };
}
const mdirOf = (f: M34, d: V3): V3 => norm([f[0] * d[0] + f[1] * d[1] + f[2] * d[2], f[4] * d[0] + f[5] * d[1] + f[6] * d[2], f[8] * d[0] + f[9] * d[1] + f[10] * d[2]]);
const EYE: Material = { color: "#2b1d14", shade: 0 };
/** Two dot eyes on the front of a head of radius r (crosses when `out`). Call inside the head frame. */
export function face(m: Model, r: number, out = false, eye: Material = EYE) {
  m.decal(0.02, () => m.group(() => {
    for (const s of [1, -1]) {
      const c: V3 = [r * 0.86, s * r * 0.4, r * 0.02];
      if (out) m.ellipsoid(c, [r * 0.05, r * 0.2, r * 0.05], eye, { segs: 6 });
      else m.ellipsoid(c, [r * 0.1, r * 0.11, r * 0.17], eye, { segs: 8 });
    }
  }));
}
/** A frame at a hand that aims a held thing: +x from `from` towards `to` (or along `dir`), z up as far as it can. */
export function gripAim(from: V3, to: V3): M34 { return frameAt(from, sub(to, from)); }

// ------------------------------------------------------------------------------------------------ quadruped
export interface QuadOpts {
  size?: number; weight?: Weight;
  /** Body centre height, half length and half width (the builder draws the body itself in `body`). */
  height?: number; length?: number; width?: number;
  legs: Material; hooves: Material;
  legR?: number;
  stride?: number;
  lunge?: number;
  /** Draw wheels instead of stepping legs? Then the rig returns `spin` (degrees) and draws nothing. */
  noLegs?: boolean;
}
export interface QuadRig {
  root: M34;
  /** The body centre (x forward): draw the barrel, neck and head here. */
  body: M34;
  /** Where a rider sits (on top of the body). */
  saddle: M34;
  /** Wheel or gear rotation for this frame, degrees: turns with the ground in the walk. */
  spin: number;
  size: number;
}
/** A four-legged mount: trots with planted hooves, rears into its charge, falls onto its side. */
export function quadruped(m: Model, p: Pose, o: QuadOpts): QuadRig {
  const size = o.size ?? 1, weight = o.weight ?? "heavy", amp = W_AMP[weight];
  const H = o.height ?? 0.4, L = o.length ?? 0.26, Wd = o.width ?? 0.13, S = o.stride ?? 0.6;
  let root = IDENT.slice(), bob = 0, pitch = 0, spin = 0;
  const feet: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0]]; // FR, FL, BR, BL
  const t = p.t;
  if (p.anim === "idle") { bob = -0.008 + 0.006 * p.wave(1); pitch = 0.6 * p.wave(1, 1, 0.2); }
  else if (p.anim === "walk") {
    p.stride = Math.max(p.stride, S * size);
    [0, 0.5, 0.5, 0].forEach((ph, i) => (feet[i] = step(t + ph, S * 0.55, 0.11 * amp)));
    bob = -0.02 * Math.cos(t * Math.PI * 4); pitch = 2.5 * Math.sin(t * Math.PI * 4);
    spin = -t * 360;
  } else if (p.anim === "attack" || p.anim === "cast") {
    root = strikeRoot(p, weight, o.lunge ?? 1);
    const b = p.blend;
    pitch = b < 0 ? 10 * b : -3 * b; // rears back, then drives through
    if (b < 0) { feet[0] = [0.04, -0.1 * b]; feet[1] = [0.08, -0.14 * b]; }
    else { feet[0] = [0.12 * b, 0]; feet[1] = [0.06 * b, 0]; feet[2] = [-0.08 * b, 0]; feet[3] = [-0.03 * b, 0]; }
  } else if (p.anim === "death") {
    const roll = [8, 30, 62, 92, 86, 90][p.i] ?? 90, drop = [0, 0.02, 0.1, 0.2, 0.17, 0.19][p.i] ?? 0.19;
    root = mmul(translation(-0.03 * p.i, 0.05 * p.dead, -drop * H * 1.2 * size + (p.i >= 3 ? Wd * size * 0.9 : 0)), rotation("x", -roll));
  }
  root = mmul(root, scaling(size));
  const body = mmul(root, mmul(translation(0, 0, H + bob), rotation("y", pitch)));
  if (!o.noLegs) {
    const lr = o.legR ?? 0.05, UP = H * 0.62;
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([fb, side], i) => {
      const hip = mpoint(body, [fb * L * 0.72, side * Wd * 0.85, -0.06]);
      const curl = p.anim === "death" ? clamp(p.dead * 1.4) : 0;
      let foot = mpoint(root, [fb * L * 0.78 + feet[i][0], side * Wd * 0.95, 0.045 + feet[i][1]]);
      if (curl) foot = lerp3(foot, mpoint(body, [fb * L * 0.5, side * Wd * 0.9, -UP * 0.7]), curl);
      const d = sub(foot, hip), dl = Math.hypot(d[0], d[1], d[2]);
      const full = (UP + 0.12) * size;
      const bend = Math.sqrt(Math.max(0, (full / 2) ** 2 - (Math.min(dl, full) / 2) ** 2));
      const knee = add(add(hip, mul(d, 0.5)), mul(mdirOf(root, [fb > 0 ? 1 : -1, 0, 0]), bend));
      m.group(() => {
        m.capsule(hip, knee, lr * 1.25 * size, o.legs, lr * size, { segs: 10 });
        m.capsule(knee, foot, lr * size, o.legs, lr * 0.8 * size, { segs: 10 });
      });
      m.sphere(add(foot, [0, 0, -0.005]), lr * 1.3 * size, o.hooves, { segs: 10 });
    });
  }
  return { root, body, saddle: mmul(body, translation(-0.02, 0, 0.12)), spin, size };
}

// ------------------------------------------------------------------------------------------------ flyer
export interface FlyerOpts {
  size?: number; weight?: Weight;
  /** How high the body hangs over its anchor in the sprite (the game adds the real flying height itself). */
  alt?: number;
  /** Wing beats per walk clip (default 2) and per idle clip (default 1). */
  beats?: number;
  lunge?: number;
}
export interface FlyerRig {
  root: M34;
  /** The hovering body: draw the hull, pilot and wing roots here. */
  body: M34;
  /** Wing beat for this frame, -1 (down) .. 1 (up): turn it into a wing angle. */
  flap: number;
  /** Propeller or rotor angle, degrees. */
  spin: number;
  size: number;
}
/** A hovering body: bobs on its wing beat, banks into the strike, tumbles out of the air. */
export function flyer(m: Model, p: Pose, o: FlyerOpts = {}): FlyerRig {
  const size = o.size ?? 1, alt = o.alt ?? 0.2, t = p.t;
  let root = IDENT.slice(), flap = 0, bob = 0, pitch = 0, roll = 0;
  let spin = p.i * 47;
  if (p.anim === "idle") { flap = p.wave(1, 1); bob = 0.02 * p.wave(1, 1, -0.2); roll = 2 * p.wave(1, 1, 0.3); }
  else if (p.anim === "walk") { const n = o.beats ?? 2; flap = p.wave(1, n); bob = 0.015 * p.wave(1, n, -0.2); pitch = 8; }
  else if (p.anim === "attack" || p.anim === "cast") {
    const b = p.blend, l = o.lunge ?? 1;
    pitch = b < 0 ? 14 * b * l : 22 * Math.min(b, 1.1) * l;
    root = translation(b < 0 ? 0.06 * b * l : 0.1 * b * l, 0, b < 0 ? -0.04 * b * l : -0.07 * b * l);
    flap = b < 0 ? 1 : -0.8;
  } else if (p.anim === "death") {
    const k = p.dead;
    pitch = -40 * k; roll = 70 * Math.sin(k * 2.2) + 30 * k; bob = -alt * 0.75 * k * k + 0.04 * Math.sin(k * Math.PI);
    flap = Math.cos(p.i * 2.1);
    root = translation(-0.1 * k, 0.04 * k, 0);
  }
  void t;
  root = mmul(root, scaling(size));
  const body = mmul(root, mmul(translation(0, 0, alt + bob), mmul(rotation("y", pitch), rotation("x", roll))));
  return { root, body, flap, spin, size };
}

// ------------------------------------------------------------------------------------------------ crawler
export interface CrawlerOpts {
  size?: number; weight?: Weight;
  /** Body height, half length, half width. */
  height?: number; length?: number; width?: number;
  /** Legs per side (default 3). */
  legs?: number;
  leg: Material; foot?: Material;
  legR?: number;
  stride?: number; lunge?: number;
  /** How far the feet stand out from the body, as a multiple of the half width (default 2.1). */
  splay?: number;
}
export interface CrawlerRig { root: M34; body: M34; size: number; }
/** A many-legged crawler: scuttles on alternating legs, lunges to bite, flips onto its back. */
export function crawler(m: Model, p: Pose, o: CrawlerOpts): CrawlerRig {
  const size = o.size ?? 1, weight = o.weight ?? "light";
  const H = o.height ?? 0.13, L = o.length ?? 0.14, Wd = o.width ?? 0.09, n = o.legs ?? 3, S = o.stride ?? 0.17, splay = o.splay ?? 2.1;
  let root = IDENT.slice(), bob = 0, pitch = 0, flip = 0;
  const t = p.t;
  if (p.anim === "idle") bob = 0.008 * p.wave(1);
  else if (p.anim === "walk") { p.stride = Math.max(p.stride, S * size); bob = 0.008 * Math.cos(t * Math.PI * 4); }
  else if (p.anim === "attack" || p.anim === "cast") { root = strikeRoot(p, weight, o.lunge ?? 1); pitch = p.blend < 0 ? 12 * p.blend : -8 * p.blend; }
  else if (p.anim === "death") {
    flip = [20, 70, 140, 180, 174, 180][p.i] ?? 180;
    root = mmul(translation(-0.02 * p.i, 0, [0.04, 0.12, 0.14, H * 1.4, H * 1.6, H * 1.5][p.i] ?? 0), rotation("x", flip));
  }
  root = mmul(root, scaling(size));
  const body = mmul(root, mmul(translation(0, 0, p.anim === "death" ? H * (1 - p.dead) : H + bob), rotation("y", pitch)));
  const lr = o.legR ?? 0.022;
  for (let i = 0; i < n; i++) for (const side of [1, -1]) {
    const fx = n === 1 ? 0 : lerp(L * 0.75, -L * 0.75, i / (n - 1));
    const ph = ((i + (side > 0 ? 0 : 1)) % 2) * 0.5;
    const [sx, sz] = p.anim === "walk" ? step(t + ph, S, 0.05) : [0, 0];
    const hip = mpoint(body, [fx * 0.8, side * Wd * 0.8, 0]);
    let foot: V3, knee: V3;
    if (p.anim === "death") {
      // legs curl in over the upturned belly
      const c = clamp(p.dead * 1.3);
      foot = mpoint(body, [fx * lerp(1.5, 0.7, c), side * Wd * lerp(splay, 0.7, c), lerp(-H, -H * 1.5, c)]);
      knee = mpoint(body, [fx * 1.2, side * Wd * lerp(splay * 0.75, 1.3, c), lerp(H * 0.5, -H * 0.9, c)]);
    } else {
      foot = mpoint(root, [fx * 1.5 + sx, side * Wd * splay, 0.02 + sz]);
      knee = add(lerp3(hip, foot, 0.5), [0, 0, H * 0.9 * size]);
    }
    m.tube([hip, knee, foot], [lr * size * 1.2, lr * size, lr * size * 0.7], o.leg, { segs: 6 });
    if (o.foot) m.sphere(foot, lr * size * 1.2, o.foot, { segs: 6 });
  }
  return { root, body, size };
}

// ------------------------------------------------------------------------------------------------ structure
export interface StructureOpts {
  size?: number;
  /** How far the top kicks back on the impact frame (world units, default 0.07). */
  recoil?: number;
  /** How far the wreck sinks and leans as it dies (default 1). */
  collapse?: number;
}
export interface StructureRig {
  /** The fixed base. */
  base: M34;
  /** The working top (barrel, arm, hopper): recoils on the blow, shudders as it dies. */
  top: M34;
  size: number;
}
/** A fixed emplacement: the base stays put, the top winds, fires and recoils, and the whole thing slumps when it dies. */
export function structure(_m: Model, p: Pose, o: StructureOpts = {}): StructureRig {
  const size = o.size ?? 1, rc = o.recoil ?? 0.07, col = o.collapse ?? 1;
  let root = scaling(size), top = IDENT.slice();
  if (p.anim === "attack" || p.anim === "cast") {
    const b = p.blend;
    const kick = p.i === IMPACT ? 1 : p.i === IMPACT + 1 ? 0.55 : p.i === IMPACT + 2 ? 0.2 : 0;
    top = mmul(translation(b < 0 ? -0.015 * b : -rc * kick, 0, 0), mmul(rotation("y", b < 0 ? 3 * b : -7 * kick), scaling(1 + 0.05 * kick, 1, 1 - 0.04 * kick)));
    root = mmul(scaling(1 + 0.03 * kick, 1 + 0.03 * kick, 1 - 0.04 * kick), root);
  } else if (p.anim === "idle") {
    top = translation(0, 0, 0.004 * p.wave(1));
  } else if (p.anim === "death") {
    const sink = [0.04, 0.14, 0.34, 0.52, 0.47, 0.5][p.i] * col, tilt = [3, -6, 12, 19, 16, 17][p.i] * col;
    const sh = [0.02, -0.02, 0.015, 0, 0, 0][p.i];
    root = mmul(mmul(translation(sh, 0, 0), mmul(rotation("x", tilt), scaling(1 + sink * 0.28, 1 + sink * 0.28, 1 - sink))), root);
    top = mmul(translation(0, 0.05 * p.dead, -0.03 * p.dead), rotation("x", 14 * p.dead));
  }
  return { base: root, top: mmul(root, top), size };
}

// ------------------------------------------------------------------------------------------------ unit definitions
/** One body kind: how to build it and how it moves. */
export interface UnitDef {
  /** Draw frame `p` into `m`: call a rig, then hang the kind's own parts on the frames it returns. */
  build(m: Model, p: Pose): void;
  /** Motion class: heavy bodies wind up longer and raise dust; light ones are snappy. */
  weight: Weight;
  /** Fixed bodies (traps, emplacements) have no walk clip: the manifest aliases walk to idle. */
  fixed?: boolean;
  /** Has a special-move clip (cast). */
  cast?: boolean;
  /** Flies: no stride is needed. */
  flying?: boolean;
  /** Scale per tier (default 1, 1.04, 1.08, 1.12: higher ranks stand a little taller). */
  tierScale?: number[];
}
export const TIER_SCALE = [1, 1.04, 1.08, 1.12];

/** Every frame of a clip for a kind and tier. */
export function clipPoses(kind: string, tier: number, anim: Anim): Pose[] {
  return Array.from({ length: CLIPS[anim] }, (_, i) => new Pose(kind, tier, anim, i, CLIPS[anim]));
}
/** The model for one frame, with the tier's scale applied. Returns the model and the stride it recorded. */
export function buildFrame(def: UnitDef, p: Pose): Model {
  const m = new Model();
  const s = (def.tierScale ?? TIER_SCALE)[p.tier - 1] ?? 1;
  m.scale(s);
  def.build(m, p);
  p.stride *= s;
  return m;
}
export { DEG };
