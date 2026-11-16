// The round-end assault: the winners' survivors march on the losing keep and hit it with their own attacks before
// the commander damage lands on the health bar. Pure timing and geometry (no DOM), driven by one clock so pause and
// speed apply; the board draws it and the game reads `hitAt` / `drain()` / `over` to sequence the HUD.
import type { Body } from "@engine/core/battle";
import { bodyDef, type BodyKind, type Obstacle, type Side } from "@engine/core/defs";
import { keepAnchor, keepHitPoint, KEEP_RX, KEEP_RY } from "./keeps";

/** How each kind strikes a keep: walks in and swings, shoots from range, lobs, casts, slams, dives or blows up. */
export type Style = "melee" | "arrow" | "bolt" | "pellet" | "lob" | "shell" | "zap" | "shard" | "slam" | "dive" | "keg" | "none";

export function styleOf(kind: BodyKind): Style {
  switch (kind) {
    case "ranger": case "outrider": return "arrow";
    case "ballista": return "bolt";
    case "turret": case "lamp": return "pellet";
    case "grenadier": case "thorn": return "lob";
    case "bombard": return "shell";
    case "storm": return "zap";
    case "rime": case "tide": return "shard";
    case "golem": case "golemling": return "slam";
    case "harrier": case "griffin": return "dive";
    case "keg": return "keg";
    case "medic": case "hive": case "grave": case "mine": case "decoy": return "none";
    default: return "melee";
  }
}

const RANGED: Style[] = ["arrow", "bolt", "pellet", "lob", "shell", "zap", "shard"];
const FLIGHT: Partial<Record<Style, number>> = { arrow: 0.28, bolt: 0.22, pellet: 0.2, lob: 0.5, shell: 0.62, shard: 0.3 };
/** The most bodies that take part; the rest hold their ground. */
export const MAX_STRIKERS = 16;

export interface Striker {
  id: number; kind: BodyKind; side: Side; target: Side; style: Style;
  radius: number; flying: boolean;
  path: [number, number][]; // start, optional detour, slot
  len: number; // path length, world units
  go: number; arrive: number; // march start and end, assault seconds
  strikes: number[]; // when each swing / shot starts
  x: number; y: number; face: number; z: number;
  gone: boolean; // a keg that has blown
}

export interface Shot { style: Style; side: Side; x0: number; y0: number; x1: number; y1: number; t0: number; t1: number; }

export type AssaultEvent =
  | { t: "swing"; s: Striker }
  | { t: "launch"; s: Striker; shot: Shot }
  | { t: "impact"; target: Side; style: Style; x: number; y: number; from: Striker | null; first: boolean };

export interface AssaultOpts {
  /** Commander damage per side for this round (from the round report). */
  damage: [number, number];
  obstacles?: Obstacle[];
  /** Seconds the result holds after the bar has drained. */
  linger?: number;
}

const MARCH_FROM = 0.2; // a beat after the battle ends
const STRIKE_FROM = 0.95; // nobody hits before this, so the first blow reads as one moment
const DRAIN = 0.75;

export class Assault {
  t = 0;
  readonly strikers: Striker[] = [];
  readonly shots: Shot[] = [];
  readonly damage: [number, number];
  /** Assault time of the first blow on each damaged keep (Infinity if it takes none). */
  readonly hitAt: [number, number] = [Infinity, Infinity];
  /** When the HUD may move on to the next round (pushed back by `hold` for a commander's defeat). */
  endAt: number;
  private impacts: { at: number; target: Side; style: Style; x: number; y: number; from: Striker | null }[] = [];
  private fired = new Set<string>();
  private byId = new Map<number, Striker>();

  constructor(bodies: Body[], o: AssaultOpts) {
    this.damage = o.damage;
    const obstacles = o.obstacles ?? [];
    for (const target of [0, 1] as Side[]) {
      if (!(o.damage[target] > 0)) continue;
      const attackers = bodies
        .filter((b) => b.alive && b.side !== target && b.kind !== "mine" && b.kind !== "decoy")
        .sort((a, b) => (styleOf(a.kind) === "none" ? 1 : 0) - (styleOf(b.kind) === "none" ? 1 : 0) || b.rank - a.rank || a.id - b.id)
        .slice(0, MAX_STRIKERS);
      const slots = this.slotsFor(target, attackers);
      attackers.forEach((b, i) => this.addStriker(b, target, slots[i], i, obstacles));
      // A keep that takes damage with nobody left to deliver it still shakes when the blow lands.
      if (!this.impacts.some((m) => m.target === target)) {
        const p = keepHitPoint(target, 0, target === 0 ? -1 : 1);
        this.impacts.push({ at: STRIKE_FROM + 0.1, target, style: "slam", x: p.x, y: p.y, from: null });
      }
    }
    this.impacts.sort((a, b) => a.at - b.at);
    for (const m of this.impacts) this.hitAt[m.target] = Math.min(this.hitAt[m.target], m.at);
    const first = Math.min(...this.hitAt.filter(Number.isFinite), STRIKE_FROM);
    this.endAt = (Number.isFinite(first) ? first : 0) + DRAIN + (o.linger ?? 0.9);
  }

  /** Keeps the assault (and so the HUD) going at least `secs` more: the board calls it when a keep collapses, so the
   *  fall and the winner's banner play out before the result. */
  hold(secs: number) {
    this.endAt = Math.max(this.endAt, this.t + secs);
  }

  /** The first blow of the whole assault (Infinity if no keep takes damage). */
  get firstHit() { return Math.min(this.hitAt[0], this.hitAt[1]); }
  get over() { return this.t >= this.endAt; }

  /** How far the health bar of `side` has drained, 0..1: nothing until its keep is hit. */
  drain(side: Side): number {
    const h = this.hitAt[side];
    if (!Number.isFinite(h)) return 1;
    return Math.max(0, Math.min(1, (this.t - h - 0.05) / DRAIN));
  }

  pose(id: number): Striker | undefined { return this.byId.get(id); }

  /** Advances the clock and reports what happened in that slice. */
  update(dt: number, emit: (e: AssaultEvent) => void) {
    const t0 = this.t, t1 = (this.t += dt);
    for (const s of this.strikers) {
      this.place(s, t1);
      for (const at of s.strikes) {
        if (at < t0 || at >= t1 || s.gone) continue;
        emit({ t: "swing", s });
        if (!RANGED.includes(s.style)) continue;
        const hp = keepHitPoint(s.target, s.x, s.y);
        const shot: Shot = { style: s.style, side: s.side, x0: s.x, y0: s.y - (s.flying ? s.z * 0.55 : 0.25), x1: hp.x, y1: hp.y, t0: at, t1: at + (FLIGHT[s.style] ?? 0.05) };
        if (s.style !== "zap") this.shots.push(shot); // lightning is instant: the board draws it on launch
        emit({ t: "launch", s, shot });
      }
    }
    for (const m of this.impacts) {
      if (m.at < t0 || m.at >= t1) continue;
      const key = `${m.target}`;
      const first = !this.fired.has(key);
      this.fired.add(key);
      if (m.from?.style === "keg") m.from.gone = true;
      emit({ t: "impact", target: m.target, style: m.style, x: m.x, y: m.y, from: m.from, first });
    }
    for (let i = this.shots.length - 1; i >= 0; i--) if (this.shots[i].t1 < t1) this.shots.splice(i, 1);
  }

  // ------------------------------------------------------------ setup
  /** Where each attacker ends up: melee in an arc round the keep's near side, shooters further back. */
  private slotsFor(target: Side, list: Body[]): [number, number][] {
    const k = keepAnchor(target);
    const facing = target === 1 ? Math.PI / 2 : -Math.PI / 2; // the keep's side that faces the battle
    // The keep at the bottom is seen from behind, so its attackers spread to the flanks where they stay in view.
    const near = target === 1 ? [0, 0.42, -0.42, 0.85, -0.85, 1.25, -1.25, 1.6, -1.6] : [1.0, -1.0, 1.3, -1.3, 1.6, -1.6, 1.9, -1.9];
    const far = [0, 0.32, -0.32, 0.64, -0.64, 0.95, -0.95, 1.25, -1.25];
    let ni = 0, fi = 0;
    return list.map((b) => {
      const st = styleOf(b.kind), r = b.radius;
      if (b.speed <= 0) return [b.x, b.y]; // fixed structures fire from where they stand
      if (RANGED.includes(st) || st === "none") {
        const a = facing + far[fi % far.length] + 0.13 * Math.floor(fi / far.length);
        const d = (st === "none" ? 3.2 : Math.min(3.4, Math.max(2.3, b.range * 0.62))) + 0.35 * Math.floor(fi / far.length);
        fi++;
        return [k.x + Math.cos(a) * (KEEP_RX + d - 0.6), k.y + Math.sin(a) * (KEEP_RY + d - 0.6)];
      }
      const ring = Math.floor(ni / near.length);
      const a = facing + near[ni % near.length] + ring * 0.2;
      ni++;
      const gap = r + 0.08 + ring * 0.55 + (st === "dive" ? 0.15 : 0);
      return [k.x + Math.cos(a) * (KEEP_RX + gap), k.y + Math.sin(a) * (KEEP_RY + gap)];
    });
  }

  private addStriker(b: Body, target: Side, slot: [number, number], i: number, obstacles: Obstacle[]) {
    const style = styleOf(b.kind);
    const path = detour([b.x, b.y], slot, b.radius, b.flying ? [] : obstacles);
    let len = 0;
    for (let j = 1; j < path.length; j++) len += Math.hypot(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]);
    const def = bodyDef(b.kind);
    // A brisk march: never slower than a jog, and everyone is in place within about a second.
    const v = Math.max(2.6, (def.speed || 0) * 1.6);
    const go = MARCH_FROM + (i % 5) * 0.03;
    const arrive = len < 0.01 ? go : go + Math.min(1.05, Math.max(0.25, len / v));
    const s: Striker = {
      id: b.id, kind: b.kind, side: b.side, target, style, radius: b.radius, flying: b.flying,
      path, len, go, arrive, strikes: [], x: b.x, y: b.y, face: b.face, z: b.flying ? b.z || 1.2 : 0, gone: false,
    };
    if (style !== "none") {
      const first = Math.max(arrive + 0.05, STRIKE_FROM) + (i % 6) * 0.07;
      const every = style === "keg" ? 0 : style === "shell" || style === "lob" ? 0.8 : style === "slam" ? 0.75 : 0.55;
      s.strikes.push(first);
      if (every) s.strikes.push(first + every);
      for (const at of s.strikes) {
        const flight = FLIGHT[style] ?? (style === "melee" || style === "dive" ? 0.12 : style === "slam" ? 0.2 : style === "keg" ? 0.15 : 0.05);
        const hp = keepHitPoint(target, slot[0], slot[1]);
        this.impacts.push({ at: at + flight, target, style, x: hp.x, y: hp.y, from: s });
      }
    }
    this.place(s, 0);
    this.strikers.push(s);
    this.byId.set(s.id, s);
  }

  private place(s: Striker, t: number) {
    const u = s.arrive > s.go ? Math.max(0, Math.min(1, (t - s.go) / (s.arrive - s.go))) : 1;
    const e = u < 1 ? easeInOut(u) : 1;
    let d = e * s.len;
    let x = s.path[0][0], y = s.path[0][1];
    for (let j = 1; j < s.path.length; j++) {
      const [ax, ay] = s.path[j - 1], [bx, by] = s.path[j];
      const seg = Math.hypot(bx - ax, by - ay);
      if (d <= seg || j === s.path.length - 1) {
        const k = seg > 0 ? Math.min(1, d / seg) : 1;
        x = ax + (bx - ax) * k; y = ay + (by - ay) * k;
        break;
      }
      d -= seg;
    }
    const k = keepAnchor(s.target);
    const moving = u > 0 && u < 1;
    s.face = moving ? Math.atan2(y - s.y, x - s.x) || s.face : Math.atan2(k.y - y, k.x - x);
    s.x = x; s.y = y;
    if (s.style === "dive") {
      // Harriers swoop down onto the keep's roof on each pass.
      const dip = s.strikes.reduce((m, at) => Math.max(m, 1 - Math.abs(t - at - 0.06) / 0.22), 0);
      s.z = 1.2 - 0.7 * Math.max(0, dip);
    }
  }

  /** Swing progress for the attack pose (0..1) or -1 when not attacking. */
  swing(s: Striker): number {
    for (const at of s.strikes) {
      const u = (this.t - at) / 0.35;
      if (u >= 0 && u < 1) return u;
    }
    return -1;
  }

  /** Movement speed for the walk bob (world units a second). */
  speed(s: Striker): number {
    return this.t > s.go && this.t < s.arrive ? 2.5 : 0;
  }
}

/** A straight march, bent once round the first rock in the way. */
export function detour(a: [number, number], b: [number, number], r: number, obstacles: Obstacle[]): [number, number][] {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  if (L2 < 1e-6) return [a, b];
  let best: { u: number; o: Obstacle } | null = null;
  for (const o of obstacles) {
    const u = Math.max(0, Math.min(1, ((o.x - a[0]) * dx + (o.y - a[1]) * dy) / L2));
    const d = Math.hypot(a[0] + dx * u - o.x, a[1] + dy * u - o.y);
    if (d < o.r + r && u > 0.02 && u < 0.98 && (!best || u < best.u)) best = { u, o };
  }
  if (!best) return [a, b];
  const { o, u } = best;
  const L = Math.sqrt(L2);
  let nx = -dy / L, ny = dx / L;
  const cx = a[0] + dx * u - o.x, cy = a[1] + dy * u - o.y;
  if (cx * nx + cy * ny < 0) { nx = -nx; ny = -ny; }
  const off = o.r + r + 0.15;
  return [a, [o.x + nx * off, o.y + ny * off], b];
}

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
