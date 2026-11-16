// Combat feel ("juice") for the board, render-only and driven by the sim's events: hit-stop, a smooth trauma camera
// shake, Ascended ability callouts, HP bars that drain behind the damage, squash-and-stretch for landings, and the
// round-end flourish. Pure state (no canvas): board.ts draws it, tests drive it directly.
import type { BattleEvent, Body } from "@engine/core/battle";
import { tr } from "../game/text";
import { ABILITIES, UNITS, type BodyKind, type Side, type UnitKind } from "@engine/core/defs";

/** One display frame at 60 Hz: hit-stop is counted in these. */
export const FRAME = 1 / 60;
/** Longest single hit-stop, in frames. */
export const MAX_STOP_FRAMES = 4;
/** After a stop ends, smaller ones are ignored for this long, so a melee brawl never stutters. */
export const STOP_COOLDOWN = 0.22;
/** How long an Ascended callout stays up, and how long before the same unit may call out again. */
export const CALLOUT_LIFE = 1.15;
export const CALLOUT_REPEAT = 9;
/** Least time between two callouts anywhere on the board. */
export const CALLOUT_GAP = 0.45;
/** Seconds the round-end flourish plays (the HUD's ribbon lands ~0.9 s in, see game.ts showRound). */
export const BANNER_LIFE = 2.4;
/** HP bar: the light "lost" segment holds this long after a hit, then drains at DRAIN of the bar per second. */
export const HP_HOLD = 0.32;
export const HP_DRAIN = 0.9;

/** The OS asks for less motion (iOS Settings > Accessibility > Motion > Reduce Motion reaches WKWebView). */
export function prefersReducedMotion(): boolean {
  try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

export interface Callout { id: number; x: number; y: number; side: Side; text: string; life: number; max: number; }
export interface Banner { winner: -1 | 0 | 1; t: number; }
export interface HpShown { frac: number; lag: number; hitAt: number; seenAt: number; /** lag when the last hit landed */ from: number; }

/** What one battle event asks of the camera and the clock. */
export interface Kick { /** a camera push-in (zoom) about a world point */ push?: Push; stop?: number; shake?: number; callout?: { id: number; key: string; x: number; y: number; side: Side; text: string }; banner?: -1 | 0 | 1; spawn?: number; }

/** A camera push-in: zoom by `amp` (0.14 = 14% closer) about world (x, y); in over `attack` s, held `hold` s, out
 *  over `release` s. x and y are left out when the event has no place of its own (the round's end: the board fills
 *  in where the last body fell). */
export interface Push { amp: number; attack: number; hold: number; release: number; x?: number; y?: number; }
/** The final blow: the camera leans in on it and holds while the moment plays in slow motion. */
export const FINAL_PUSH: Push = { amp: 0.14, attack: 0.16, hold: 0.7, release: 0.5 };
/** Board-time scale for the first FINAL_SLOW_FOR real seconds after the last blow. */
export const FINAL_SLOW = 0.3;
export const FINAL_SLOW_FOR = 0.55;
/** The rare heavy moments (a quake, a colossus falling, a griffin landing): a quick punch in and back. Common blasts
 *  (mines, kegs, shells) don't zoom: scaling the whole picture costs a full-screen resample, and they come in bursts. */
const punch = (amp: number, x: number, y: number): Push => ({ amp, attack: 0.05, hold: 0, release: 0.26, x, y });
/** How far in a push is `t` seconds after it began (0..1), and whether it is over. */
export function pushEnv(p: Push, t: number): number {
  if (t <= 0) return 0;
  if (t < p.attack) return 1 - (1 - t / p.attack) ** 3;
  if (t < p.attack + p.hold) return 1;
  const u = (t - p.attack - p.hold) / p.release;
  return u >= 1 ? 0 : 1 - u * u * (3 - 2 * u);
}

type Find = (id: number) => Pick<Body, "id" | "kind" | "rank" | "side" | "x" | "y"> | undefined;
const BIG_BOOM = new Set(["mine", "keg", "shell", "quake"]);
const SMALL = new Set<BodyKind>(["mite", "decoy", "thrall", "golemling"]);

/** The Ascended (rank 4) signature an event shows, if any: which unit's ability, and where to call it out.
 *  Events that only an Ascended unit can make need no rank check; shared ones check the source's rank. */
export function ascendedOf(e: BattleEvent, find: Find): Kick["callout"] | undefined {
  const asc = (id: number, kind: UnitKind, need = true) => {
    const b = find(id);
    if (!b || b.kind !== kind || (need && b.rank < 4)) return undefined;
    return { id: b.id, key: `b${b.id}`, x: b.x, y: b.y, side: b.side, text: tr(ABILITIES[kind].name) };
  };
  const at = (key: string, x: number, y: number, side: Side, kind: UnitKind) => ({ id: -1, key, x, y, side, text: tr(ABILITIES[kind].name) });
  switch (e.t) {
    case "slash": return e.spin ? asc(e.id, "blades") : undefined;
    case "volley": return asc(e.id, "ranger", false);
    case "twin": return asc(e.id, "ballista", false);
    case "revive": return asc(e.from, "medic", false);
    case "reset": return asc(e.id, "shade", false);
    case "emerge": return e.big ? asc(e.id, "sapper", false) : undefined;
    case "dive": return asc(e.id, "harrier");
    case "aura": return e.rally ? asc(e.id, "banner", false) : undefined;
    case "parry": return e.riposte ? asc(e.id, "duelist") : undefined;
    case "brace": return asc(e.id, "pikeman");
    case "hook": return asc(e.id, "hook");
    case "ward": return asc(e.from, "lamp");
    case "decoy": return asc(e.from, "trickster");
    case "charge": return asc(e.id, "lancer");
    case "build": return asc(e.id, "tinker");
    case "heal": return e.from === e.to ? asc(e.from, "ravager", false) : undefined;
    case "spawn": return e.kind === "queen" ? asc(e.from, "hive", false) : e.kind === "thrall" ? asc(e.from, "grave") : undefined;
    case "bomblets": return at(`cluster${e.side}`, e.x, e.y, e.side, "mine");
    case "zone": return e.kind === "thorn" && e.root ? at(`thorn${e.side}`, e.x, e.y, e.side, "thorn") : undefined;
    case "boom": return e.kind === "quake" ? at(`quake${e.side}`, e.x, e.y, e.side, "golem") : e.kind === "shrapnel" ? at(`shrap${e.side}`, e.x, e.y, e.side, "bombard") : undefined;
    case "freeze": {
      const v = find(e.id);
      return v ? at(`freeze${1 - v.side}`, e.x, e.y, (1 - v.side) as Side, "rime") : undefined;
    }
    case "shot": return e.kind === "arrow" ? asc(e.id, "outrider") : undefined;
    case "soar": return e.second ? asc(e.id, "griffin", false) : undefined;
    case "wave": return e.surf ? asc(e.from, "tide", false) : undefined;
    case "laststand": return asc(e.id, "lion", false);
    default: return undefined;
  }
}

/** The hit-stop (frames), camera shake (trauma) and callout one event asks for. */
export function kickFor(e: BattleEvent, find: Find): Kick {
  const k: Kick = {};
  switch (e.t) {
    case "hit":
      // heavy blows (a crit, a colossus slam, a bolt, a shell) hold for 3 frames (50 ms)
      if (e.big && !e.shielded) { k.stop = 3; k.shake = 0.16; } else if (e.dmg >= 36 && !e.shielded) k.stop = 3;
      break;
    case "death":
      if (!SMALL.has(e.kind)) k.stop = e.kind === "golem" ? 4 : 2;
      if (e.kind === "golem") { k.shake = 0.3; k.push = punch(0.035, e.x, e.y); }
      break;
    case "boom":
      if (BIG_BOOM.has(e.kind)) { k.stop = 3; k.shake = e.kind === "quake" ? 0.45 : 0.35; if (e.kind === "quake") k.push = punch(0.045, e.x, e.y); } else if (e.r >= 1) k.shake = 0.14;
      break;
    case "emerge": if (e.big) k.shake = 0.25; break;
    case "impale": k.stop = 3; k.shake = 0.2; break;
    case "swoop": k.stop = 3; k.shake = 0.3; k.push = punch(0.03, e.x, e.y); break;
    case "wave": k.shake = 0.12; break;
    case "spawn": k.spawn = e.id; break;
    case "end": k.banner = e.winner; k.stop = 4; k.shake = 0.2; k.push = FINAL_PUSH; break;
    default: break;
  }
  const c = ascendedOf(e, find);
  if (c) { k.callout = c; k.stop = Math.max(k.stop ?? 0, 4); k.shake = Math.max(k.shake ?? 0, 0.12); }
  return k;
}

/** Squash-and-stretch [sx, sy] for a body landing: u is time since touchdown over the settle time (0..1). Stretched
 *  tall in the air (u < 0), squashed wide on impact, one springy wobble, then still. */
export function landSquash(u: number): [number, number] {
  if (u < 0) return [0.9, 1.12];
  if (u >= 1) return [1, 1];
  const k = Math.exp(-u * 4.2) * Math.cos(u * Math.PI * 2.6);
  return [1 + 0.24 * k, 1 - 0.26 * k];
}

/** Pop-in scale for a body summoned mid-battle (thralls, turrets, decoys), u = age / 0.3 s. */
export function popScale(u: number): number {
  if (u >= 1) return 1;
  if (u <= 0) return 0.35;
  return 1 + (0.35 - 1) * (1 - u) ** 2 + 0.22 * Math.sin(u * Math.PI);
}

export class Juice {
  /** Calm mode: no hit-stop, no shake, no screen-wide rays (the game's setting or the OS's reduce-motion). */
  reduced = prefersReducedMotion();
  /** Seconds of hit-stop left; the board shows the impact frame and holds it. */
  stop = 0;
  /** The impact frame has been drawn since the stop began (the rest of the stop holds it). */
  drawn = true;
  private cool = 0;
  /** 0..1 camera trauma; the shake is trauma squared, so small kicks stay small. */
  trauma = 0;
  time = 0;
  callouts: Callout[] = [];
  banner: Banner | null = null;
  private lastCall = new Map<string, number>();
  private lastAny = -Infinity;
  private hp = new Map<number, HpShown>();
  /** Body id -> board time it was summoned (pop-in). */
  spawned = new Map<number, number>();
  /** The camera push-in playing now (age in real seconds), if any. */
  private pushing: { p: Push; t: number; x: number; y: number } | null = null;
  /** Where the last body fell, and when: the final blow's push-in centres on it. */
  private lastFall: { x: number; y: number; at: number } | null = null;
  /** Real seconds since the round's last blow (-1 before it): the board runs in slow motion for the first few. */
  sinceEnd = -1;

  /** The camera zoom now: k (1 = none) about world (x, y). */
  zoom(): { k: number; x: number; y: number } {
    const z = this.pushing;
    if (!z || this.reduced) return { k: 1, x: 0, y: 0 };
    return { k: 1 + z.p.amp * pushEnv(z.p, z.t), x: z.x, y: z.y };
  }

  /** How fast the board's clock runs now: slow for a moment after the final blow, else 1. */
  get timeScale() { return !this.reduced && this.sinceEnd >= 0 && this.sinceEnd < FINAL_SLOW_FOR ? FINAL_SLOW : 1; }

  /** Start a push-in about (x, y) unless a stronger one is still playing. */
  push(p: Push, x: number, y: number) {
    if (this.reduced) return;
    const cur = this.pushing;
    if (cur && cur.p.amp * pushEnv(cur.p, cur.t) > p.amp) return;
    this.pushing = { p, t: 0, x, y };
  }

  get frozen() { return this.stop > 0; }

  /** Freeze the picture for n display frames (2-4). Ignored in calm mode, and while a recent stop cools down
   *  unless this one is the biggest kind. */
  hitStop(frames: number) {
    if (this.reduced || frames <= 0) return;
    frames = Math.min(MAX_STOP_FRAMES, Math.max(2, Math.round(frames)));
    if (this.stop > 0 || (this.cool > 0 && frames < MAX_STOP_FRAMES)) return;
    this.stop = frames * FRAME;
    this.cool = STOP_COOLDOWN + this.stop;
    this.drawn = false;
  }

  /** Add camera trauma (0..1). The view shakes by trauma² and settles in about a second. */
  shake(amount: number) {
    if (this.reduced || amount <= 0) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Smooth shake offset in px for a peak of maxPx: summed sines at unrelated rates, not white noise, so it reads as
   *  a jolt of the camera rather than a jitter. */
  offset(maxPx: number, extra = 0): [number, number] {
    if (this.reduced) return [0, 0];
    const m = Math.min(1, this.trauma + extra) ** 2 * maxPx;
    if (m < 0.05) return [0, 0];
    const t = this.time;
    return [m * (Math.sin(t * 61.3) * 0.6 + Math.sin(t * 97.1 + 1.3) * 0.4), m * (Math.sin(t * 53.7 + 2.1) * 0.6 + Math.sin(t * 89.9 + 0.4) * 0.4)];
  }

  /** Apply one event's kick (board time now). */
  onEvent(e: BattleEvent, find: Find) {
    const k = kickFor(e, find);
    if (k.callout) {
      const last = this.lastCall.get(k.callout.key);
      // At most two on screen, and a beat between them; a callout skipped for room can show next time it fires.
      const room = this.callouts.length < 2 && this.time - this.lastAny >= CALLOUT_GAP;
      if (!room) { if (k.stop === MAX_STOP_FRAMES) k.stop = 0; }
      else if (last === undefined || this.time - last >= CALLOUT_REPEAT) {
        this.lastAny = this.time;
        this.lastCall.set(k.callout.key, this.time);
        const c = k.callout;
        this.callouts.push({ id: c.id, x: c.x, y: c.y, side: c.side, text: c.text, life: CALLOUT_LIFE, max: CALLOUT_LIFE });
      } else if (k.stop === MAX_STOP_FRAMES && e.t !== "end") k.stop = 0; // a repeat: no freeze either
    }
    if (e.t === "death") this.lastFall = { x: e.x, y: e.y, at: this.time };
    if (e.t === "end") this.sinceEnd = 0;
    if (k.push) {
      // The final blow leans in on the body that just fell (within the last half second), else on mid-board.
      const f = this.lastFall && this.time - this.lastFall.at < 0.5 ? this.lastFall : null;
      this.push(k.push, k.push.x ?? f?.x ?? 4.5, k.push.y ?? f?.y ?? 7);
    }
    if (k.stop) this.hitStop(k.stop);
    if (k.shake) this.shake(k.shake);
    if (k.spawn !== undefined) this.spawned.set(k.spawn, this.time);
    if (k.banner !== undefined) this.banner = { winner: k.banner, t: 0 };
  }

  /** Advance by dt seconds. Returns false while a hit-stop holds the frame (the shake and callouts wait for it). */
  update(dt: number): boolean {
    this.cool = Math.max(0, this.cool - dt);
    if (this.sinceEnd >= 0) this.sinceEnd += dt;
    if (this.pushing) { this.pushing.t += dt; if (this.pushing.t >= this.pushing.p.attack + this.pushing.p.hold + this.pushing.p.release) this.pushing = null; }
    if (this.stop > 0) {
      this.stop = this.stop - dt < 1e-4 ? 0 : this.stop - dt;
      return false;
    }
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    for (const c of this.callouts) c.life -= dt;
    if (this.callouts.length && this.callouts[0].life <= 0) this.callouts = this.callouts.filter((c) => c.life > 0);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > BANNER_LIFE) this.banner = null; }
    if (this.spawned.size > 64) for (const [id, t] of this.spawned) if (this.time - t > 1) this.spawned.delete(id);
    return true;
  }

  /** The HP bar a body shows now: frac (0..1 real), lag (the light segment still draining) and seenAt (first damage,
   *  for the fade-in). */
  hpBar(id: number, frac: number): HpShown {
    let h = this.hp.get(id);
    if (!h) { h = { frac, lag: 1, hitAt: this.time, seenAt: this.time, from: 1 }; this.hp.set(id, h); }
    if (frac < h.frac - 1e-4) { h.hitAt = this.time; h.from = h.lag; }
    h.frac = frac;
    const drained = h.from - HP_DRAIN * Math.max(0, this.time - h.hitAt - HP_HOLD);
    h.lag = Math.max(frac, Math.min(h.from, drained));
    return h;
  }

  /** A new battle (or deploy): forget per-body state. */
  reset() {
    this.hp.clear(); this.spawned.clear(); this.lastCall.clear(); this.callouts = []; this.banner = null; this.lastAny = -Infinity;
    this.stop = 0; this.trauma = 0; this.cool = 0; this.drawn = true;
    this.pushing = null; this.lastFall = null; this.sinceEnd = -1;
  }
}

/** Every unit kind has an ability name (tests assert the callout table covers the roster). */
export const ASCENDED_KINDS = Object.keys(UNITS) as UnitKind[];
