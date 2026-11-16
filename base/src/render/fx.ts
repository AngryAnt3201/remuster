// Short-lived effects in world coordinates: sprite-sheet animations (public/vfx, see src/render/vfx.ts), particles,
// rings, arcs, bolts of lightning, beams and floating numbers. Pure state: board.ts draws it.

export interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number; color: string;
  drag: number; gravity: number;
  kind: "dot" | "spark" | "smoke" | "plus" | "chunk";
  spin?: number; a?: number;
}
export interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string; width: number; fill?: string; }
export interface Arc { x: number; y: number; a: number; r: number; life: number; max: number; color: string; spread: number; }
export interface Bolt { pts: [number, number][]; life: number; max: number; color: string; seed: number; }
export interface Beam { x0: number; y0: number; x1: number; y1: number; life: number; max: number; color: string; width: number; }
/** One play of a sprite sheet from the VFX atlas. */
export interface Anim {
  sheet: string;
  x: number; y: number; z: number;
  /** Drawn height of one frame in world units (width follows the frame's aspect). */
  size: number;
  /** Drawn width in world units, stretching the frame (lightning between two points); default keeps the aspect. */
  w?: number;
  /** Rotation (radians); sheets face +x. */
  a: number;
  life: number; max: number;
  /** Seconds before it starts (not drawn, not ageing). */
  delay: number;
  tint?: string;
  alpha: number;
  blend?: "add" | "normal";
  /** "ground" draws under the bodies (decals, rings, auras), "air" over them. */
  layer: "ground" | "air";
  /** Loop at this many frames a second instead of playing once across the life. */
  loop?: number;
  /** Hold one frame. */
  frame?: number;
  reverse?: boolean;
  /** Vertical squash for things lying on the ground (1 = top-down). */
  squash: number;
  /** Scale over the life, from -> to. */
  grow?: [number, number];
  /** Seconds of fade at the start and at the end. */
  fadeIn: number; fadeOut: number;
  spin: number;
  vx: number; vy: number; vz: number; gravity: number;
  /** A thrown arc from (x0, y0) to (x1, y1) peaking at height h; overrides x, y, z. */
  path?: { x0: number; y0: number; x1: number; y1: number; h: number };
}
export type AnimOpts = Partial<Omit<Anim, "sheet" | "x" | "y" | "life">> & { size: number; max: number };

export interface Float {
  x: number; y: number; text: string; life: number; max: number; color: string; size: number;
  /** extra height (a flyer's) */ z?: number;
  /** How it is styled (juicedraw.ts drawFloat): plain damage, a crit, a heal, or a word. */
  kind?: FloatKind;
}
export type FloatKind = "dmg" | "crit" | "heal" | "text";
/** Most numbers on screen at once: past this the oldest plain one goes, so a brawl never turns into a wall of digits. */
export const MAX_FLOATS = 9;
/** Numbers within this distance (world units) and age (s) merge into one. */
export const MERGE_DIST = 0.9;
export const MERGE_AGE = 0.3;

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export const frand = (a: number, b: number) => a + (b - a) * rnd();

/** Which frame of an n-frame sheet an anim shows now. */
export function animFrame(an: Anim, frames: number): number {
  if (an.frame !== undefined) return Math.max(0, Math.min(frames - 1, an.frame));
  const age = an.max - an.life;
  let f = an.loop ? Math.floor(age * an.loop) % frames : Math.min(frames - 1, Math.floor((age / an.max) * frames));
  if (an.reverse) f = frames - 1 - f;
  return f;
}

/** 0..1 opacity from the fades. */
export function animAlpha(an: Anim): number {
  const age = an.max - an.life;
  let k = an.alpha;
  if (an.fadeIn > 0) k *= Math.min(1, age / an.fadeIn);
  if (an.fadeOut > 0) k *= Math.min(1, an.life / an.fadeOut);
  return Math.max(0, Math.min(1, k));
}

export class Fx {
  anims: Anim[] = [];
  parts: Particle[] = [];
  rings: Ring[] = [];
  arcs: Arc[] = [];
  bolts: Bolt[] = [];
  beams: Beam[] = [];
  floats: Float[] = [];
  shake = 0;
  flash = 0;
  flashColor = "#fff";

  clear() {
    this.anims = []; this.parts = []; this.rings = []; this.arcs = []; this.bolts = []; this.beams = []; this.floats = [];
    this.shake = 0; this.flash = 0;
  }

  update(dt: number) {
    for (const an of this.anims) {
      if (an.delay > 0) { an.delay -= dt; continue; }
      an.life -= dt;
      if (an.path) {
        const u = Math.min(1, 1 - an.life / an.max);
        an.x = an.path.x0 + (an.path.x1 - an.path.x0) * u;
        an.y = an.path.y0 + (an.path.y1 - an.path.y0) * u;
        an.z = an.path.h * 4 * u * (1 - u);
      } else {
        an.x += an.vx * dt; an.y += an.vy * dt;
        if (an.vz || an.gravity) { an.vz -= an.gravity * dt; an.z = Math.max(0, an.z + an.vz * dt); }
      }
      if (an.spin) an.a += an.spin * dt;
    }
    this.anims = this.anims.filter((an) => an.life > 0);
    if (this.anims.length > 400) this.anims.splice(0, this.anims.length - 400);
    for (const p of this.parts) {
      p.life -= dt;
      p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vz -= p.gravity * dt; p.z = Math.max(0, p.z + p.vz * dt);
      if (p.z === 0 && p.gravity > 0) { p.vz *= -0.35; p.vx *= 0.7; p.vy *= 0.7; }
      if (p.spin) p.a = (p.a ?? 0) + p.spin * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const list of [this.rings, this.arcs, this.bolts, this.beams, this.floats] as { life: number }[][]) for (const r of list) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    this.arcs = this.arcs.filter((r) => r.life > 0);
    this.bolts = this.bolts.filter((r) => r.life > 0);
    this.beams = this.beams.filter((r) => r.life > 0);
    this.floats = this.floats.filter((r) => r.life > 0);
    for (const f of this.floats) f.y -= dt * 0.35;
    this.shake = Math.max(0, this.shake - dt * 2.8);
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
  }

  burst(x: number, y: number, n: number, o: Partial<Particle> & { speed?: number; spread?: number; dir?: number } = {}) {
    const speed = o.speed ?? 2, spread = o.spread ?? Math.PI * 2, dir = o.dir ?? 0;
    for (let i = 0; i < n; i++) {
      const a = dir + (rnd() - 0.5) * spread;
      const s = speed * (0.35 + rnd() * 0.9);
      const max = (o.max ?? 0.6) * (0.6 + rnd() * 0.7);
      this.parts.push({
        x, y, z: o.z ?? 0.1, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: o.vz ?? frand(0.5, 2.5),
        life: max, max, size: (o.size ?? 0.06) * (0.6 + rnd() * 0.8), color: o.color ?? "#fff",
        drag: o.drag ?? 2.5, gravity: o.gravity ?? 6, kind: o.kind ?? "dot", spin: o.spin, a: rnd() * 6.28,
      });
    }
  }
  /** Play a VFX sheet at (x, y). */
  anim(sheet: string, x: number, y: number, o: AnimOpts): Anim {
    const an: Anim = {
      sheet, x, y, z: o.z ?? 0, size: o.size, w: o.w, a: o.a ?? 0, life: o.max, max: o.max, delay: o.delay ?? 0, tint: o.tint,
      alpha: o.alpha ?? 1, blend: o.blend, layer: o.layer ?? "air", loop: o.loop, frame: o.frame, reverse: o.reverse,
      squash: o.squash ?? 1, grow: o.grow, fadeIn: o.fadeIn ?? 0, fadeOut: o.fadeOut ?? 0, spin: o.spin ?? 0,
      vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, gravity: o.gravity ?? 0, path: o.path,
    };
    if (an.path) { an.x = an.path.x0; an.y = an.path.y0; }
    this.anims.push(an);
    return an;
  }
  ring(x: number, y: number, r0: number, r1: number, max: number, color: string, width = 0.06, fill?: string) {
    this.rings.push({ x, y, r0, r1, life: max, max, color, width, fill });
  }
  arc(x: number, y: number, a: number, r: number, color: string, spread = 2.0, max = 0.16) {
    this.arcs.push({ x, y, a, r, life: max, max, color, spread });
  }
  bolt(pts: [number, number][], color: string, max = 0.24) {
    this.bolts.push({ pts, life: max, max, color, seed: Math.floor(rnd() * 1e6) });
  }
  beam(x0: number, y0: number, x1: number, y1: number, color: string, width = 0.07, max = 0.3) {
    this.beams.push({ x0, y0, x1, y1, life: max, max, color, width });
  }
  float(x: number, y: number, text: string, color = "#fff", size = 0.32, max = 0.8, kind: FloatKind = "text") {
    // Numbers landing on the same spot within a moment add up into one (a cleave or a burst hitting a crowd shows a
    // few totals, not a stack of digits). A crit merging into a plain number upgrades it.
    if (kind !== "text") {
      const n = parseInt(text.replace(/[^0-9]/g, ""), 10);
      for (const f of this.floats) {
        if (f.kind === "text" || (f.kind === "heal") !== (kind === "heal") || f.max - f.life > MERGE_AGE) continue;
        if (Math.abs(f.x - x) > MERGE_DIST || Math.abs(f.y - y) > MERGE_DIST) continue;
        const sum = parseInt(f.text.replace(/[^0-9]/g, ""), 10) + n;
        const crit = f.kind === "crit" || kind === "crit";
        f.kind = crit ? "crit" : f.kind;
        f.text = kind === "heal" ? `+${sum}` : crit ? `${sum}!` : String(sum);
        if (crit) { f.color = color; f.size = Math.max(f.size, size); }
        f.life = f.max = Math.max(f.max, max) * 0.9 + 0.1 * (f.max - f.life);
        return;
      }
    }
    if (this.floats.length >= MAX_FLOATS) {
      const i = this.floats.findIndex((f) => f.kind === "dmg" || f.kind === "heal");
      this.floats.splice(i < 0 ? 0 : i, 1);
    }
    this.floats.push({ x: x + frand(-0.15, 0.15), y, text, life: max, max, color, size, kind });
  }
}
