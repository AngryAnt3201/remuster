// The battle: a deterministic fixed-step simulation with free 360-degree steering (no grid).
// Every unit kind has its own behaviour; the renderer only reads bodies, projectiles, zones, fuses and events.
import {
  BATTLE_LIMIT, BODY_EXTRA, DT, H, UNITS, W,
  bodyDef, isSpawn, rankDmg, rankHp, toLocal,
  type BodyKind, type Mods, type Obstacle, type Piece, type Role, type Side, type UnitKind,
} from "./defs";
import { levelDmg, levelHp, levelOf, type Levels } from "./levels";
import { NAV_TOL, Nav } from "./nav";
import {
  AMBUSH_RANGE, AMBUSH_WAIT, BRUSH_EXPOSE, BRUSH_REVEAL, COVER_KEEP, COVER_REACH, ROAD_SPEED, breakable, circleHitsBlock,
  type Block, type BlockKind, type BlockState,
} from "./terrain";
import { Rng } from "./rng";

export interface Body {
  id: number;
  pieceId: number;
  kind: BodyKind;
  side: Side;
  rank: number;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  face: number;
  hp: number; maxHp: number;
  /** Current damage (baseDmg plus any Rally bonus). */
  dmg: number; baseDmg: number;
  range: number; speed: number; radius: number; cooldown: number;
  cd: number;
  alive: boolean;
  structure: boolean;
  /** Out of the other side's sight, for renderers (updated every step): a buried mine, a cloaked Shade, or a ground
   * unit standing in brush that has not been revealed (see terrain.ts). Its own side should still draw it. */
  hidden: boolean;
  /** Nobody can target it at any distance: a buried mine, a cloaked Shade. */
  stealth: boolean;
  /** Battle time until which brush does not hide it (it attacked, cast or took damage). */
  reveal: number;
  /** Lying in wait: it started the battle in brush and has not moved yet (see AMBUSH_RANGE, AMBUSH_WAIT). */
  ambush: boolean;
  taunt: boolean;
  stun: number;
  flash: number;
  state: string;
  t: number;
  target: number;
  pack: number;
  slot: number;
  /** The body that made this one (mite, queen, thrall, turret, decoy), else -1. */
  owner: number;
  ax: number; ay: number;
  budget: number;
  hits: number[];
  cloak: number;
  blinkCd: number;
  healMul: number;
  diedAt: number;
  /** Sapper underground: untargetable, no collision, leaves a trail. */
  burrowed: boolean;
  /** Harrier: only air-capable attackers can hit it; ignores collision, obstacles and mines. */
  flying: boolean;
  /** Altitude for flyers (0 ground, 1.2 cruising). */
  z: number;
  /** Seconds left of frost slow (half speed, attacks 25% slower). */
  slow: number;
  /** Seconds left frozen solid (no moving, no acting). */
  frozen: number;
  /** Pikeman with pikes set (stands still, stops chargers). */
  braced: boolean;
  /** Seconds left inside a Standard Bearer's aura (attacks 25% faster). */
  buff: number;
  /** Seconds left inside an Ascended (Rally) aura (+20% damage). */
  rally: number;
  /** Duelist: seconds until the next parry is ready (ready at <= 0). */
  parryCd: number;
  /** Attacks made, for every-Nth abilities. */
  strikes: number;
  /** A second per-kind timer (dig trail, retarget, build, raise, recast, brace hold). */
  aux: number;
  /** A once-per-battle flag (revive spent, queen hatched, keg lit). */
  once: boolean;
  /** Which way it circles (+1/-1), mirrored between the sides so neither has the better hand. */
  hand: number;
  /** Lamplighter ward: damage it still soaks up before health (0 = none). */
  ward: number;
  /** Seconds left on the ward. */
  wardT: number;
  /** The ward was cast by an Ascended Lamplighter (Beacon): it bursts when broken. */
  wardBurst: boolean;
  /** Seconds left caught in brambles (moves at 45% speed). */
  snare: number;
  /** Render-only: last swing time and angle. */
  swing: number;
  swingA: number;
}

export type ProjKind = "arrow" | "bolt" | "grenade" | "shard" | "shell" | "pellet";
export interface Proj {
  id: number;
  kind: ProjKind;
  side: Side;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  x0: number; y0: number; tx: number; ty: number;
  target: number;
  dmg: number;
  t: number;
  life: number;
  z: number;
  hits: number[];
  owner: number;
  rank: number;
  alive: boolean;
  /** Extra effect on landing: "fire" (Firebomb), "shrapnel", "freeze" (Deep Freeze), or "". */
  fx: string;
  /** A direct shot loosed at something in the air: it flies over the arena's blocks instead of stopping on them. */
  over: boolean;
}

export type BoomKind = "mine" | "grenade" | "slam" | "quake" | "erupt" | "shell" | "shrapnel" | "bomblet" | "keg" | "pop" | "talon" | "mirror" | "swoop";
/** Ground that hurts the other side's ground bodies inside it: a Firebomb's flames, or a Thornweaver's brambles (which also snare). */
export type ZoneKind = "fire" | "thorn" | "surf";
export interface Zone { id: number; kind: ZoneKind; x: number; y: number; r: number; side: Side; until: number; dps: number; tick: number; }
/** A Tidecaller wave rolling down a lane: its front is at y, moving `dir` toward y1; each foe it reaches is hit once. */
export interface Wave { id: number; side: Side; x: number; y: number; y0: number; y1: number; dir: number; w: number; speed: number; dmg: number; hits: number[]; surf: boolean; nextSurf: number; done: boolean; }
/** A blast waiting to go off (Cluster bomblets, Shrapnel, Chain Keg). */
export interface Fuse { x: number; y: number; at: number; r: number; dmg: number; side: Side; kind: BoomKind; knock: number; stun: number; }

export type BattleEvent =
  | { t: "slash"; id: number; x: number; y: number; a: number; r: number; side: Side; spin?: boolean }
  | { t: "shot"; id: number; kind: ProjKind; x: number; y: number }
  | { t: "hit"; id: number; x: number; y: number; dmg: number; side: Side; shielded?: boolean; big?: boolean }
  | { t: "boom"; x: number; y: number; r: number; kind: BoomKind; side: Side }
  | { t: "zap"; pts: [number, number][]; side: Side }
  | { t: "heal"; from: number; to: number; x: number; y: number; amt: number }
  | { t: "spawn"; id: number; x: number; y: number; side: Side; kind: BodyKind; from: number }
  | { t: "death"; id: number; x: number; y: number; kind: BodyKind; side: Side }
  | { t: "blink"; id: number; x0: number; y0: number; x: number; y: number; side: Side }
  | { t: "charge"; id: number; x: number; y: number; a: number }
  | { t: "fuse"; id: number; x: number; y: number }
  | { t: "burrow"; id: number; x: number; y: number; side: Side }
  | { t: "dig"; id: number; x: number; y: number }
  | { t: "emerge"; id: number; x: number; y: number; r: number; side: Side; big: boolean }
  | { t: "dive"; id: number; x: number; y: number; target: number; tx: number; ty: number; side: Side }
  | { t: "chill"; id: number; x: number; y: number; dur: number }
  | { t: "freeze"; id: number; x: number; y: number; dur: number }
  | { t: "aura"; id: number; x: number; y: number; r: number; side: Side; rally: boolean }
  | { t: "parry"; id: number; x: number; y: number; by: number; riposte: boolean }
  | { t: "brace"; id: number; x: number; y: number; a: number }
  | { t: "impale"; id: number; target: number; x: number; y: number }
  | { t: "raise"; id: number; from: number; x: number; y: number; side: Side }
  | { t: "build"; id: number; x: number; y: number; dur: number }
  | { t: "repair"; from: number; to: number; x: number; y: number; amt: number }
  | { t: "decoy"; id: number; from: number; x: number; y: number; side: Side }
  | { t: "pop"; id: number; x: number; y: number; side: Side }
  | { t: "light"; id: number; x: number; y: number }
  | { t: "kegdrop"; x: number; y: number; at: number; side: Side }
  | { t: "bomblets"; x: number; y: number; pts: [number, number][]; at: number; side: Side }
  | { t: "zone"; id: number; x: number; y: number; r: number; until: number; side: Side; kind?: ZoneKind; root?: boolean }
  | { t: "hook"; id: number; target: number; x: number; y: number; tx: number; ty: number; side: Side }
  | { t: "reel"; id: number; target: number; x: number; y: number }
  | { t: "ward"; id: number; from: number; x: number; y: number; amt: number }
  | { t: "wardbreak"; id: number; x: number; y: number; side: Side; burst: boolean }
  | { t: "revive"; id: number; from: number; x: number; y: number }
  | { t: "soar"; id: number; x: number; y: number; side: Side; second: boolean }
  | { t: "swoop"; id: number; x: number; y: number; r: number; side: Side; second: boolean }
  | { t: "wave"; id: number; from: number; x: number; y0: number; y1: number; w: number; dur: number; side: Side; surf: boolean }
  | { t: "rally"; id: number; x: number; y: number; r: number; side: Side; n: number }
  | { t: "laststand"; id: number; x: number; y: number; until: number }
  | { t: "volley"; id: number; x: number; y: number; a: number }
  | { t: "twin"; id: number; x: number; y: number; a: number }
  | { t: "reset"; id: number; x: number; y: number }
  // Arena terrain (only in battles with BattleOptions.terrain). `id` / `block` are Block ids.
  | { t: "blockhit"; id: number; x: number; y: number; dmg: number; hp: number; by: number }
  | { t: "blockbreak"; id: number; kind: BlockKind; x: number; y: number; w: number; h: number }
  | { t: "ricochet"; x: number; y: number; kind: ProjKind | "hook"; block: number }
  | { t: "crash"; id: number; x: number; y: number; a: number }
  | { t: "end"; winner: -1 | 0 | 1 };

export interface BattleOptions {
  seed?: number;
  obstacles?: Obstacle[];
  /** Terrain (engine/core/terrain.ts): walls, buildings, barricades, cover, water, roads and brush. Omitted or empty = open field. */
  terrain?: Block[];
  mods?: [Mods | undefined, Mods | undefined];
  /** Persistent troop levels per side (engine/core/levels.ts). Missing = level 1, which leaves every stat unchanged. */
  levels?: [Levels | undefined, Levels | undefined];
  limit?: number;
  /** Keep the event log (the renderer drains it; headless sims leave it off). */
  events?: boolean;
}

export interface BattleResult {
  winner: -1 | 0 | 1;
  time: number;
  /** Threat each side's survivors carry: what they deal to the other commander. */
  threat: [number, number];
  /** Value (cost-weighted health) left on each side, for AI scoring. */
  value: [number, number];
  /** Survivors per side (living bodies; mines, turrets and decoys excluded). */
  alive: [number, number];
}

const TAU = Math.PI * 2;
const hyp = Math.hypot;
const angleDiff = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
const turnToward = (a: number, b: number, max: number) => {
  const d = angleDiff(a, b);
  return a + Math.max(-max, Math.min(max, d));
};
const fwd = (side: Side) => (side === 0 ? -1 : 1);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const ROLE_BACKLINE = new Set<BodyKind>(["ranger", "medic", "grenadier", "storm", "ballista", "hive", "rime", "bombard", "banner", "tinker", "grave", "turret", "thorn", "lamp"]);
/** Bodies whose attacks can reach a flyer. */
export const AIR_HITTERS = new Set<BodyKind>(["ranger", "ballista", "storm", "rime", "turret", "harrier", "outrider", "griffin"]);
export const canHitAir = (k: BodyKind) => AIR_HITTERS.has(k);
const MELEE_ROLES = new Set<Role>(["melee", "tank", "cavalry", "siege", "assassin"]);
/** Fights hand to hand (what a Duelist hunts and a Hedgehog throws damage back at). */
export const isMeleeKind = (k: BodyKind) =>
  k === "mite" || k === "thrall" || k === "golemling" || k === "queen" || (!isSpawn(k) && MELEE_ROLES.has(UNITS[k].role));

const DECOY_LURE = 1.5; // decoys look this much closer to anyone picking the nearest enemy
const AURA_R = 2; // Standard Bearer reach
const RAISE_R = 3; // Gravecaller reach
const REVIVE_R = 3;
const BOMBARD_MIN = 2.5;
const THRALL_CAP = 4;
const HOOK_R = 4.0; // Hookwarden chain reach
const HOOK_CD = 4.5;
const HOOK_SPEED = 12; // chain flight, units per second
const REEL_SPEED = 8;
const WARD_HP = 55; // Lamplighter ward at rank 1 (scaled like damage by rank)
const WARD_TIME = 6;
const SNARE = 0.45; // speed kept inside brambles
const SWOOP_R = 1.0; // Griffin Knight landing reach
const SWOOP_STUN = 0.6;
const WAVE_W = 1.8; // Tidecaller wave: lane width, length, speed, shove
const WAVE_LEN = 7;
const WAVE_SPEED = 5.5;
const WAVE_PUSH = 4.2;
const SURF_TIME = 3;
const RALLY_R = 2.2; // Lionheart rally reach and haste time
const RALLY_TIME = 3;
const LAST_STAND = 2.5;
// Arena terrain.
/** Siege (Stone Colossus slams, keg blasts) does this many times its damage to barricades and cover. */
export const SIEGE_MUL = 3;
/** What breaking through a block costs a melee unit's route, in units of walking per point of the block's health:
 * a fresh barricade is worth a 10-unit detour to most, under 2 to siege. */
const BREACH_PEN = 1 / 32;
const SIEGE_PEN = 1 / 200;
/** A Lancer that charges into a wall is stunned this long. */
export const CRASH_STUN = 0.6;
const DEFLECT = [0.8, -0.8, 1.5, -1.5];
/** A body's cached route round the blocks (see Battle.steer). */
interface Route { gx: number; gy: number; pts: number[]; n: number; i: number; ver: number; at: number; breach: number; partial: boolean; live: boolean; }

export class Battle {
  bodies: Body[] = [];
  projs: Proj[] = [];
  events: BattleEvent[] = [];
  /** Burning ground on the field now. */
  zones: Zone[] = [];
  /** Blasts still to go off. */
  fuses: Fuse[] = [];
  /** Tidecaller waves rolling now. */
  waves: Wave[] = [];
  time = 0;
  done = false;
  winner: -1 | 0 | 1 = -1;
  readonly rng: Rng;
  readonly obstacles: Obstacle[];
  /** The arena's blocks as they stand now: `hp` counts down and `alive` goes false when one breaks. Empty on an open field. */
  readonly blocks: BlockState[];
  readonly limit: number;
  private nextId = 1;
  private log: boolean;
  private packTarget = new Map<number, number>();
  private packRetarget = new Map<number, number>();
  private mods: [Mods, Mods];
  private levels: [Levels | undefined, Levels | undefined];
  private index = new Map<number, Body>();
  private order: number[] = [];
  // Bodies some rule needs to find quickly (none of these kinds spawn mid-battle).
  private banners: Body[] = [];
  private bastions: Body[] = [];
  private graves: Body[] = [];
  private medics: Body[] = [];
  /** Terrain queries and navigation; null on an open field (every terrain rule is behind this check). */
  private nav: Nav | null;
  private routes = new Map<number, Route>();
  /** The terrain has brush / roads (the hiding and road rules are skipped without them). */
  private brushOn = false;
  private roadsOn = false;
  // Where the body now acting is heading (set by seek), for steer().
  private goalOn = false;
  private goalX = 0;
  private goalY = 0;
  private goalSp = 0;

  constructor(pieces: Piece[], opts: BattleOptions = {}) {
    this.rng = new Rng(opts.seed ?? 1);
    this.obstacles = opts.obstacles ?? [];
    this.limit = opts.limit ?? BATTLE_LIMIT;
    this.log = opts.events ?? false;
    this.mods = [opts.mods?.[0] ?? {}, opts.mods?.[1] ?? {}];
    this.levels = [opts.levels?.[0], opts.levels?.[1]];
    this.nav = opts.terrain?.length ? new Nav(opts.terrain) : null;
    this.blocks = this.nav ? this.nav.blocks : [];
    this.brushOn = !!this.nav?.hasBrush;
    this.roadsOn = !!this.nav?.hasRoads;
    for (const p of pieces) this.addPiece(p);
    if (this.brushOn) for (const b of this.bodies) {
      // Whoever is placed in brush starts hidden, and lies in wait there.
      if (!this.inBrush(b)) continue;
      b.hidden = true;
      b.ambush = !isSpawn(b.kind) && b.kind !== "shade";
    }
    for (const b of this.bodies) if (b.kind === "hive" && this.mods[b.side].broodStart) { this.spawnMite(b); this.spawnMite(b); }
    for (const b of this.bodies) {
      if (!this.mods[b.side].litStart || b.kind === "mine" || isSpawn(b.kind)) continue;
      b.ward = WARD_HP; b.wardT = WARD_TIME;
      this.emit({ t: "ward", id: b.id, from: b.id, x: b.x, y: b.y, amt: WARD_HP });
    }
    for (const b of this.bodies) {
      if (b.kind === "banner") this.banners.push(b);
      if (b.kind === "bulwark" && b.rank >= 4) this.bastions.push(b);
      if (b.kind === "grave") this.graves.push(b);
      if (b.kind === "medic" && b.rank >= 4) this.medics.push(b);
      if (b.burrowed) this.emit({ t: "burrow", id: b.id, x: b.x, y: b.y, side: b.side });
      if (b.kind === "griffin") this.emit({ t: "soar", id: b.id, x: b.x, y: b.y, side: b.side, second: false });
    }
    if (!this.sideAlive(0) || !this.sideAlive(1)) this.finish();
  }

  // ------------------------------------------------------------ setup
  private addPiece(p: Piece) {
    const def = UNITS[p.kind];
    const n = def.bodies ?? 1;
    for (let i = 0; i < n; i++) {
      let x = p.x, y = p.y;
      if (n > 1) {
        // Three swords in a small triangle around the placement point (slot order mirrored between the sides).
        const a = -fwd(p.side) * (Math.PI / 2 + (i * TAU) / n);
        x += Math.cos(a) * 0.32;
        y += Math.sin(a) * 0.32;
      }
      const b = this.makeBody(p.kind, p.side, p.rank, x, y, p.id);
      if (n > 1) { b.pack = p.id; b.slot = i; }
    }
  }

  private makeBody(kind: BodyKind, side: Side, rank: number, x: number, y: number, pieceId: number, from?: { x: number; y: number }): Body {
    const base = bodyDef(kind);
    // Nothing starts inside a block (flyers and the burrowed sapper are over or under them).
    if (this.nav && kind !== "sapper" && kind !== "harrier" && kind !== "griffin") [x, y] = this.freeAt(x, y, base.radius, from);
    const m = this.mods[side];
    const unitKind: UnitKind = isSpawn(kind) ? BODY_EXTRA[kind].from : kind;
    const hpMul = (m.hpMul ?? 1) * (m.kindHp?.[unitKind] ?? 1);
    const dmgMul = (m.dmgMul ?? 1) * (m.kindDmg?.[unitKind] ?? 1);
    // Troop level: a multiplier of exactly 1 at level 1 (spawned bodies share their maker's level).
    const level = levelOf(this.levels[side], unitKind);
    const hp = Math.round(base.hp * rankHp(rank) * hpMul * levelHp(level));
    const dmg = base.dmg * rankDmg(rank) * dmgMul * levelDmg(level);
    const b: Body = {
      id: this.nextId++, pieceId, kind, side, rank,
      x, y, px: x, py: y, vx: 0, vy: 0,
      face: side === 0 ? -Math.PI / 2 : Math.PI / 2,
      hp, maxHp: hp,
      dmg, baseDmg: dmg,
      range: base.range * (kind === "mine" && m.bigMines ? 1.25 : 1),
      speed: base.speed * (m.speedMul ?? 1),
      radius: base.radius,
      cooldown: base.cooldown * (m.cooldownMul ?? 1),
      cd: 0.25 + this.rng.next() * 0.35,
      alive: true,
      structure: kind === "mine" || kind === "turret" || (!isSpawn(kind) && !!UNITS[kind].structure),
      hidden: kind === "mine" || kind === "shade",
      stealth: kind === "mine" || kind === "shade",
      reveal: 0, ambush: false,
      taunt: kind === "bulwark",
      stun: 0, flash: 0,
      state: kind === "mine" ? "armed" : kind === "lancer" ? "aim" : kind === "shade" ? "flank" : kind === "sapper" ? "burrow"
        : kind === "harrier" ? "circle" : kind === "keg" ? "run" : kind === "griffin" ? "soar" : "idle",
      t: 0, target: -1, pack: -1, slot: 0, owner: -1,
      ax: 0, ay: 0, budget: 0, hits: [],
      cloak: kind === "shade" ? 3.2 : 0,
      blinkCd: 0,
      healMul: (m.healMul ?? 1) * levelDmg(level),
      diedAt: -1,
      burrowed: kind === "sapper",
      flying: kind === "harrier" || kind === "griffin",
      z: kind === "harrier" ? 1.2 : kind === "griffin" ? 1.5 : 0,
      slow: 0, frozen: 0, braced: false, buff: 0, rally: 0, parryCd: 0, strikes: 0, aux: 0, once: false,
      ward: 0, wardT: 0, wardBurst: false, snare: 0,
      hand: (x <= W / 2 ? 1 : -1) * -fwd(side),
      swing: -9, swingA: 0,
    };
    this.bodies.push(b);
    this.index.set(b.id, b);
    return b;
  }

  // ------------------------------------------------------------ queries
  private byId(id: number): Body | undefined {
    return id < 0 ? undefined : this.index.get(id);
  }
  /** Can a body of this side and kind attack e: alive, hostile, seen, above ground, and reachable if it flies. */
  private canTarget(side: Side, kind: BodyKind, e: Body) {
    return e.alive && e.side !== side && !e.stealth && !e.burrowed && (!e.flying || AIR_HITTERS.has(kind));
  }
  private targetable(b: Body, e: Body) {
    return this.canTarget(b.side, b.kind, e) && !(this.brushOn && this.veiled(b, e));
  }
  /** Is this ground body standing in brush (structures, fliers and burrowers never count). */
  private inBrush(b: Body) {
    return !b.structure && !b.flying && !b.burrowed && this.nav!.inBrush(b.x, b.y);
  }
  /** Is `e` hidden in brush from `a`: on the other side, unrevealed and farther than BRUSH_REVEAL edge to edge. */
  private veiled(a: Body, e: Body) {
    return e.hidden && !e.stealth && e.side !== a.side && hyp(a.x - e.x, a.y - e.y) - a.radius - e.radius > BRUSH_REVEAL;
  }
  /** Brush stops hiding a body for a while: it attacked, cast or was hurt. Ends its ambush too. */
  private expose(b: Body) {
    if (!this.brushOn) return;
    b.reveal = this.time + BRUSH_EXPOSE;
    b.ambush = false;
    if (!b.stealth) b.hidden = false;
  }
  /** The nearest enemy hidden in brush from `b`: nobody to attack yet, but somewhere to search when no one is in sight
   * (so two armies in the grass still find each other). */
  private lurker(b: Body): Body | undefined {
    if (!this.brushOn) return undefined;
    let best: Body | undefined, bd = Infinity;
    for (const e of this.bodies) {
      if (!this.canTarget(b.side, b.kind, e) || !this.veiled(b, e)) continue;
      const d = this.dist(b, e) - e.radius;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  /** A body lying in wait in brush: true while it should keep still. It breaks cover when an enemy it can see is
   * within AMBUSH_RANGE (or its own reach), when it has been revealed or moved out of the brush, or after AMBUSH_WAIT. */
  private lieLow(b: Body): boolean {
    if (this.time >= AMBUSH_WAIT || !b.hidden) { b.ambush = false; return false; }
    const reach = Math.max(AMBUSH_RANGE, b.range);
    for (const e of this.bodies) {
      if (!this.targetable(b, e) || e.kind === "mine") continue;
      if (hyp(e.x - b.x, e.y - b.y) - e.radius - b.radius <= reach) { b.ambush = false; return false; }
    }
    return true;
  }
  private dist(a: { x: number; y: number }, b: { x: number; y: number }) {
    return hyp(a.x - b.x, a.y - b.y);
  }
  /** Gap between two bodies' edges. */
  private gap(a: Body, b: Body) {
    const g = this.dist(a, b) - a.radius - b.radius;
    // Across a wall nobody is in reach, however close; nor is anyone hidden in brush.
    return this.nav && ((g < 1.6 && !this.sees(a, b)) || (this.brushOn && this.veiled(a, b))) ? 99 : g;
  }
  /** Line of sight between two bodies' centres: walls, buildings and barricades block it. Always true on an open
   * field, and to or from anything in the air. */
  private sees(a: Body, b: Body) {
    if (!this.nav) return true;
    if (this.brushOn && this.veiled(a, b)) return false;
    return a.flying || b.flying || this.nav.los(a.x, a.y, b.x, b.y);
  }
  /** Distance for a direct shot: infinite with no line of sight, so a shooter closes in until it has one. */
  private shotDist(a: Body, b: Body) {
    return this.sees(a, b) ? this.dist(a, b) : Infinity;
  }
  /** Is a body fully behind a wall from a point: its centre and both flanks out of sight (blasts don't reach it). */
  private shadowed(x: number, y: number, e: Body): boolean {
    const nav = this.nav!;
    if (e.flying || nav.los(x, y, e.x, e.y)) return false;
    const dx = e.x - x, dy = e.y - y, d = hyp(dx, dy) || 1, px = (-dy / d) * e.radius, py = (dx / d) * e.radius;
    return !nav.los(x, y, e.x + px, e.y + py) && !nav.los(x, y, e.x - px, e.y - py);
  }
  /** The nearest free ground to (x, y) for a circle of radius `rad`, on `from`'s side of any block when given. */
  private freeAt(x: number, y: number, rad: number, from?: { x: number; y: number }): [number, number] {
    const nav = this.nav;
    if (!nav) return [x, y];
    if (!from) nav.spot(x, y, rad);
    else if (!nav.spot(x, y, rad, true, from.x, from.y)) nav.spot(from.x, from.y, rad);
    return [nav.sx, nav.sy];
  }
  /** A body that just landed, surfaced or blinked takes the nearest free ground (on `by`'s side of any block). */
  private settle(b: Body, by?: { x: number; y: number }) {
    if (!this.nav) return;
    [b.x, b.y] = this.freeAt(b.x, b.y, b.radius, by);
    b.px = b.x; b.py = b.y;
  }
  nearestEnemy(b: Body, opts: { max?: number; filter?: (e: Body) => boolean; taunt?: boolean } = {}): Body | undefined {
    let best: Body | undefined, bd = opts.max ?? Infinity;
    let lurk: Body | undefined, ld = Infinity;
    for (const e of this.bodies) {
      if (!this.canTarget(b.side, b.kind, e) || (opts.filter && !opts.filter(e))) continue;
      let d = this.dist(b, e) - e.radius;
      if (e.kind === "decoy") d -= DECOY_LURE;
      if (this.brushOn && this.veiled(b, e)) { if (d < ld) { ld = d; lurk = e; } continue; }
      if (d < bd) { bd = d; best = e; }
    }
    // Nobody in sight: with no reach limit, search toward the nearest enemy hidden in brush (gap() and shotDist()
    // keep it out of reach until it is seen).
    if (!best) return opts.max === undefined ? lurk : undefined;
    if (this.nav && best && !b.flying && !b.burrowed && !best.flying && !this.nav.los(b.x, b.y, best.x, best.y)) {
      // The nearest is behind a wall: take the nearest in plain sight instead. With no reach limit and nobody in
      // sight, keep the hidden one (to walk toward).
      let vis: Body | undefined, vd = opts.max ?? Infinity;
      for (const e of this.bodies) {
        if (e === best || !this.targetable(b, e) || (opts.filter && !opts.filter(e))) continue;
        let d = this.dist(b, e) - e.radius;
        if (e.kind === "decoy") d -= DECOY_LURE;
        if (d < vd && (e.flying || this.nav.los(b.x, b.y, e.x, e.y))) { vd = d; vis = e; }
      }
      if (vis || opts.max !== undefined) best = vis;
    }
    if (opts.taunt !== false && best) {
      // A shield bearer close by draws melee attackers to itself.
      for (const e of this.bodies) {
        if (!e.taunt || !this.targetable(b, e)) continue;
        if (this.gap(b, e) < 1.3 && e !== best) return e;
      }
    }
    return best;
  }
  /** The other side's bodies a ground blast at (x, y) reaches; `air` also takes flyers. With `walls`, bodies fully
   * behind a wall from (x, y) are sheltered and left out. */
  private enemiesNear(side: Side, x: number, y: number, r: number, air = false, walls = true): Body[] {
    const out: Body[] = [];
    for (const e of this.bodies) {
      if (!e.alive || e.side === side || e.kind === "mine" || e.burrowed || (e.flying && !air)) continue;
      if (hyp(e.x - x, e.y - y) <= r + e.radius && !(walls && this.nav && this.shadowed(x, y, e))) out.push(e);
    }
    return out;
  }
  private allies(b: Body): Body[] {
    return this.bodies.filter((a) => a.alive && a.side === b.side && a !== b && a.kind !== "mine" && a.kind !== "decoy");
  }
  private enemyCentroid(b: Body): { x: number; y: number } | undefined {
    let sx = 0, sy = 0, n = 0;
    for (const e of this.bodies) if (this.targetable(b, e)) { sx += e.x; sy += e.y; n++; }
    return n ? { x: sx / n, y: sy / n } : undefined;
  }
  private owned(b: Body, kind: BodyKind): number {
    let n = 0;
    for (const x of this.bodies) if (x.alive && x.kind === kind && x.owner === b.id) n++;
    return n;
  }
  /** Mines, turrets and decoys can't hold the field alone. */
  sideAlive(side: Side): boolean {
    return this.bodies.some((b) => b.alive && b.side === side && b.kind !== "mine" && b.kind !== "decoy" && b.kind !== "turret");
  }

  // ------------------------------------------------------------ effects
  private emit(e: BattleEvent) {
    if (this.log) this.events.push(e);
  }
  /**
   * Deals damage and returns what landed. `by` is the body striking in melee (for parries, Hedgehog and kill credit);
   * shots, spells and blasts leave it out.
   */
  damage(target: Body, amount: number, src: { x: number; y: number } | null, side: Side, big = false, by?: Body): number {
    if (!target.alive || amount <= 0) return 0;
    if (target.kind === "duelist" && target.parryCd <= 0 && src && target.stun <= 0 && target.frozen <= 0) {
      // Parry: the blow does nothing, and if the striker is in reach it gets the point back.
      const r4 = target.rank >= 4;
      target.parryCd = r4 ? 1.5 : 3;
      const riposte = !!by && by.alive && !by.flying && this.gap(target, by) <= target.range + 0.4;
      this.emit({ t: "parry", id: target.id, x: target.x, y: target.y, by: by ? by.id : -1, riposte });
      if (riposte) {
        target.swing = this.time; target.swingA = Math.atan2(by!.y - target.y, by!.x - target.x);
        this.damage(by!, target.dmg * (r4 ? 3 : 1.5), target, target.side, r4, target);
      }
      return 0;
    }
    let shielded = false;
    if (target.kind === "bulwark" && src) {
      const a = Math.atan2(src.y - target.y, src.x - target.x);
      if (Math.abs(angleDiff(target.face, a)) < 1.15) { amount *= 0.4; shielded = true; }
    } else if (this.bastions.length) {
      // Bastion: cover just behind an Ascended shield.
      for (const w of this.bastions) {
        if (!w.alive || w.side !== target.side) continue;
        const dx = target.x - w.x, dy = target.y - w.y;
        if (hyp(dx, dy) <= 1.5 + target.radius && dx * Math.cos(w.face) + dy * Math.sin(w.face) < 0) { amount *= 0.7; shielded = true; break; }
      }
    }
    if (target.ward > 0) {
      // A lantern ward soaks the blow first.
      const soak = Math.min(target.ward, amount);
      target.ward -= soak;
      amount -= soak;
      if (target.ward <= 0.01) this.breakWard(target);
      if (amount <= 0) {
        target.flash = 0.06;
        this.emit({ t: "hit", id: target.id, x: target.x, y: target.y, dmg: Math.round(soak), side, shielded: true, big });
        return 0;
      }
      shielded = true;
    }
    target.hp -= amount;
    if (target.hp <= 0 && target.kind === "lion" && target.rank >= 4) {
      // Last Stand: once a battle a killing blow leaves him standing at 1, and nothing kills him for a moment.
      if (this.time < target.budget) target.hp = 1;
      else if (!target.once) {
        target.once = true;
        target.budget = this.time + LAST_STAND;
        target.hp = 1;
        target.stun = 0; target.frozen = 0;
        this.emit({ t: "laststand", id: target.id, x: target.x, y: target.y, until: target.budget });
      }
    }
    target.flash = 0.12;
    if (target.kind === "shade" && target.cloak > 0) { target.cloak = 0; target.stealth = false; target.hidden = false; }
    if (this.brushOn) { this.expose(target); if (by) this.expose(by); }
    this.emit({ t: "hit", id: target.id, x: target.x, y: target.y, dmg: Math.round(amount), side, shielded, big });
    if (by && by.alive && !by.flying && target.kind === "pikeman" && target.braced && target.rank >= 4) {
      this.damage(by, amount * 0.3, target, target.side); // Hedgehog
    }
    if (target.kind === "decoy" && target.rank >= 4) target.hp = 0; // Mirror Hall decoys burst at a touch
    if (target.hp <= 0) {
      this.kill(target);
      if (!target.alive && by && by.kind === "shade" && by.rank >= 4) {
        by.blinkCd = 0; // Shadow Step
        this.emit({ t: "reset", id: by.id, x: by.x, y: by.y });
      }
      if (!target.alive && by && by.kind === "lion" && by.alive && target.kind !== "decoy") this.lionRally(by, isSpawn(target.kind));
    }
    return amount;
  }
  /** A ward used up: gone, and an Ascended one (Beacon) bursts, knocking back and dazzling foes close by. */
  private breakWard(b: Body) {
    const burst = b.wardBurst;
    b.ward = 0; b.wardT = 0; b.wardBurst = false;
    this.emit({ t: "wardbreak", id: b.id, x: b.x, y: b.y, side: b.side, burst });
    if (!burst) return;
    for (const e of this.enemiesNear(b.side, b.x, b.y, 1.1)) {
      const d = hyp(e.x - b.x, e.y - b.y) || 0.001;
      this.damage(e, 60, b, b.side);
      this.push(e, (e.x - b.x) / d, (e.y - b.y) / d, 2.0, 0.6);
    }
  }
  private kill(b: Body) {
    if (!b.alive) return;
    if (this.tryRevive(b)) return;
    b.alive = false;
    b.hp = 0;
    b.diedAt = this.time;
    if (b.kind === "decoy") {
      this.emit({ t: "pop", id: b.id, x: b.x, y: b.y, side: b.side });
      if (b.rank >= 4) {
        const owner = this.byId(b.owner);
        this.explode(b.x, b.y, 0.8, (owner?.baseDmg ?? 25) * 1.6, b.side, "mirror", 2.0, 0.3);
      }
      return;
    }
    this.emit({ t: "death", id: b.id, x: b.x, y: b.y, kind: b.kind, side: b.side });
    if (b.kind === "golem") {
      // The giant breaks into two smaller golems, thrown apart.
      const px = -Math.sin(b.face), py = Math.cos(b.face);
      for (const s of [-1, 1]) {
        const g = this.makeBody("golemling", b.side, b.rank, b.x + px * s * 0.42, b.y + py * s * 0.42, b.pieceId, b);
        g.vx = px * s * 2; g.vy = py * s * 2; g.face = b.face; g.cd = 0.6;
        this.emit({ t: "spawn", id: g.id, x: g.x, y: g.y, side: g.side, kind: g.kind, from: b.id });
      }
    }
    if (b.kind === "mite" && b.rank >= 4) this.explode(b.x, b.y, 0.5, b.baseDmg * 1.2, b.side, "pop", 0.8, 0);
    if (b.kind === "trickster") {
      // The illusions go with their maker.
      for (const d of this.bodies) if (d.alive && d.kind === "decoy" && d.owner === b.id) {
        d.alive = false; d.hp = 0; d.diedAt = this.time;
        this.emit({ t: "pop", id: d.id, x: d.x, y: d.y, side: d.side });
      }
    }
    this.raiseFrom(b);
  }
  /** Revive: an Ascended medic brings back the first ally to fall near it, once a battle. */
  private tryRevive(b: Body): boolean {
    if (!this.medics.length || b.kind === "mine" || isSpawn(b.kind)) return false;
    for (const m of this.medics) {
      if (m === b || !m.alive || m.once || m.side !== b.side || this.dist(m, b) > REVIVE_R) continue;
      m.once = true;
      b.hp = Math.round(b.maxHp * 0.5);
      b.stun = 0; b.frozen = 0;
      this.emit({ t: "revive", id: b.id, from: m.id, x: b.x, y: b.y });
      return true;
    }
    return false;
  }
  /** A Gravecaller in reach raises the fallen as a thrall for its own side. */
  private raiseFrom(dead: Body) {
    if (!this.graves.length || dead.structure || dead.kind === "thrall" || dead.kind === "decoy") return;
    let best: Body | undefined, bd = RAISE_R + dead.radius;
    for (const g of this.graves) {
      if (!g.alive || g.cd > 0 || this.owned(g, "thrall") >= THRALL_CAP) continue;
      const d = this.dist(g, dead);
      if (d <= bd) { bd = d; best = g; }
    }
    if (!best) return;
    best.cd = best.cooldown;
    this.raise(best, dead.x, dead.y);
  }
  private raise(g: Body, x0: number, y0: number, from?: Body) {
    const th = this.makeBody("thrall", g.side, g.rank, x0, y0, g.pieceId, from);
    const x = th.x, y = th.y;
    th.owner = g.id;
    th.cd = 0.5;
    th.face = g.side === 0 ? -Math.PI / 2 : Math.PI / 2;
    if (g.rank >= 4) {
      // Ossuary thralls.
      th.hp = th.maxHp = Math.round(th.maxHp * 1.6);
      th.baseDmg = th.dmg = th.baseDmg * 1.3;
    }
    this.emit({ t: "raise", id: th.id, from: g.id, x, y, side: g.side });
    this.emit({ t: "spawn", id: th.id, x, y, side: g.side, kind: "thrall", from: g.id });
  }
  private push(target: Body, nx: number, ny: number, force: number, stun = 0) {
    if (!target.alive || target.structure || target.flying || target.burrowed) return;
    const mass = Math.max(1, (target.radius / 0.25) ** 2);
    target.vx += (nx * force) / mass;
    target.vy += (ny * force) / mass;
    if (stun) target.stun = Math.max(target.stun, stun / Math.sqrt(mass));
  }
  private explode(x: number, y: number, r: number, dmg: number, side: Side, kind: BoomKind, knock: number, stun: number) {
    this.emit({ t: "boom", x, y, r, kind, side });
    const flat = kind === "slam" || kind === "quake";
    for (const e of this.enemiesNear(side, x, y, r)) {
      const d = hyp(e.x - x, e.y - y) || 0.001;
      const fall = flat ? 1 : 1 - 0.35 * Math.min(1, d / (r + e.radius));
      this.damage(e, dmg * fall, { x, y }, side, !flat);
      this.push(e, (e.x - x) / d, (e.y - y) / d, knock, stun);
    }
    if (this.nav) {
      // Blasts wear down barricades and cover in reach; siege blasts far more.
      const hit = dmg * (kind === "keg" || kind === "slam" || kind === "quake" ? SIEGE_MUL : 1);
      for (let i = 0; i < this.blocks.length; i++) {
        const k = this.blocks[i];
        if (k.alive && breakable(k.kind) && circleHitsBlock(k, x, y, r)) this.hitBlock(i, hit, clamp(x, k.x - k.w / 2, k.x + k.w / 2), clamp(y, k.y - k.h / 2, k.y + k.h / 2));
      }
    }
  }
  /** Damage to a breakable block (index into `blocks`); `by` is the body striking it hand to hand. */
  private hitBlock(i: number, dmg: number, x: number, y: number, by = -1) {
    const k = this.blocks[i];
    if (!k.alive || !breakable(k.kind) || dmg <= 0) return;
    k.hp = Math.max(0, k.hp - dmg);
    this.emit({ t: "blockhit", id: k.id, x, y, dmg: Math.round(dmg), hp: Math.round(k.hp), by });
    if (k.hp > 0) return;
    k.alive = false;
    this.nav!.rebuild();
    this.emit({ t: "blockbreak", id: k.id, kind: k.kind, x: k.x, y: k.y, w: k.w, h: k.h });
  }
  /** A melee blow; returns the damage that landed. */
  private melee(b: Body, t: Body, dmg: number, knock = 0, stun = 0): number {
    b.swing = this.time;
    b.swingA = Math.atan2(t.y - b.y, t.x - b.x);
    const dealt = this.damage(t, dmg, b, b.side, false, b);
    if (knock) {
      const d = this.dist(b, t) || 0.001;
      this.push(t, (t.x - b.x) / d, (t.y - b.y) / d, knock, stun);
    }
    return dealt;
  }
  private heal(b: Body, a: Body, amt: number) {
    if (!a.alive) return;
    const before = a.hp;
    a.hp = Math.min(a.maxHp, a.hp + amt);
    if (a.hp > before) this.emit({ t: "heal", from: b.id, to: a.id, x: a.x, y: a.y, amt: Math.round(a.hp - before) });
  }
  private chill(e: Body, dur: number) {
    e.slow = Math.max(e.slow, dur);
    this.emit({ t: "chill", id: e.id, x: e.x, y: e.y, dur });
  }
  private freeze(e: Body, dur: number) {
    e.frozen = Math.max(e.frozen, dur);
    this.emit({ t: "freeze", id: e.id, x: e.x, y: e.y, dur });
  }
  /** Delayed blasts around a point (Cluster bomblets, Shrapnel). */
  private scatter(x: number, y: number, n: number, spread: number, a0: number, delay: number, r: number, dmg: number, side: Side, kind: BoomKind) {
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * TAU) / n;
      const px = clamp(x + Math.cos(a) * spread, 0.2, W - 0.2), py = clamp(y + Math.sin(a) * spread, 0.2, H - 0.2);
      pts.push([px, py]);
      this.fuses.push({ x: px, y: py, at: this.time + delay, r, dmg, side, kind, knock: 1.4, stun: 0.2 });
    }
    this.emit({ t: "bomblets", x, y, pts, at: this.time + delay, side });
  }

  // ------------------------------------------------------------ steering
  /** Desired velocity toward a point, slowing within `arrive` of it. */
  private seek(b: Body, tx: number, ty: number, frac = 1, arrive = 0.6): [number, number] {
    const dx = tx - b.x, dy = ty - b.y, d = hyp(dx, dy);
    this.goalOn = true; this.goalX = tx; this.goalY = ty; this.goalSp = b.speed * frac;
    if (d < 0.02) return [0, 0];
    const s = b.speed * frac * Math.min(1, d / arrive);
    return [(dx / d) * s, (dy / d) * s];
  }
  private flee(b: Body, from: { x: number; y: number }, frac = 1): [number, number] {
    let dx = b.x - from.x, dy = b.y - from.y;
    const d = hyp(dx, dy) || 0.001;
    dx /= d; dy /= d;
    // Steer away from walls so a fleeing unit slides along them rather than pinning itself.
    const m = 1.2;
    if (b.x < m) dx += (m - b.x) * 1.5;
    if (b.x > W - m) dx -= (b.x - (W - m)) * 1.5;
    if (b.y < m) dy += (m - b.y) * 1.5;
    if (b.y > H - m) dy -= (b.y - (H - m)) * 1.5;
    const n = hyp(dx, dy) || 1;
    return [(dx / n) * b.speed * frac, (dy / n) * b.speed * frac];
  }
  private avoid(b: Body, v: [number, number]): [number, number] {
    let [vx, vy] = v;
    const sp = hyp(vx, vy);
    if (sp < 0.01 || !this.obstacles.length) return v;
    const dx = vx / sp, dy = vy / sp;
    for (const o of this.obstacles) {
      const ox = o.x - b.x, oy = o.y - b.y;
      const ahead = ox * dx + oy * dy;
      if (ahead < 0 || ahead > 1.6 + o.r) continue;
      const lat = ox * -dy + oy * dx; // signed lateral offset of the obstacle from the path
      const clear = o.r + b.radius + 0.15;
      if (Math.abs(lat) > clear) continue;
      const side = lat >= 0 ? -1 : 1; // steer to the side away from it
      const k = (1 - ahead / (1.6 + o.r)) * 1.4;
      vx += -dy * side * sp * k;
      vy += dx * side * sp * k;
    }
    const n = hyp(vx, vy) || 1;
    return [(vx / n) * sp, (vy / n) * sp];
  }
  /**
   * Ground navigation, applied to what every behaviour returns. When a block stands on the straight line to where
   * `b` is heading (the last seek), it follows a route round it instead: a few corner waypoints from Nav.path, cached
   * per body and planned again only when a block breaks, the goal moves out of the last corner's view, or the body is
   * shoved off the route. Melee bodies may route through a barricade or cover, and then they break it.
   */
  private steer(b: Body, want: [number, number]): [number, number] {
    const nav = this.nav!;
    if (b.kind === "lancer" && b.state !== "aim") return want; // a charge and its wheel run straight
    const sp = hyp(want[0], want[1]);
    if (sp < 0.01) return want;
    const gx = this.goalX, gy = this.goalY;
    if (!this.goalOn || want[0] * (gx - b.x) + want[1] * (gy - b.y) <= 0) return this.deflect(b, want, sp);
    const rr = b.radius - NAV_TOL;
    let rt = this.routes.get(b.id);
    if (nav.clear(b.x, b.y, gx, gy, rr)) { if (rt) rt.live = false; return want; }
    if (!rt) { rt = { gx: 0, gy: 0, pts: [], n: 0, i: 0, ver: 0, at: -9, breach: -1, partial: false, live: false }; this.routes.set(b.id, rt); }
    const now = this.time, pts = rt.pts;
    let stale = !rt.live || rt.ver !== nav.ver || now - rt.at > 2.5;
    if (!stale) {
      const moved = hyp(gx - rt.gx, gy - rt.gy);
      if (moved > 0.4) {
        const k = (rt.n - 1) * 2;
        if (rt.breach >= 0 || rt.partial) stale = moved > 1.5;
        else if (rt.n >= 2 && nav.clear(pts[k - 2], pts[k - 1], gx, gy, rr)) { rt.gx = gx; rt.gy = gy; pts[k] = gx; pts[k + 1] = gy; }
        else stale = true;
      }
      // Shoved off the route.
      if (!stale && rt.i < rt.n && !nav.clear(b.x, b.y, pts[rt.i * 2], pts[rt.i * 2 + 1], rr)) stale = true;
    }
    if (stale && now - rt.at >= 0.25) {
      const pen = !isMeleeKind(b.kind) || b.baseDmg <= 0 ? 0 : b.kind === "golem" || b.kind === "keg" ? SIEGE_PEN : BREACH_PEN;
      rt.at = now; rt.ver = nav.ver; rt.gx = gx; rt.gy = gy; rt.i = 0;
      rt.live = nav.path(b.x, b.y, gx, gy, b.radius, pen, b.side === 1);
      rt.n = nav.np; rt.breach = nav.breach; rt.partial = nav.partial;
      for (let i = 0; i < rt.n * 2; i++) pts[i] = nav.pts[i];
    }
    if (!rt.live) return this.deflect(b, want, sp);
    // Skip ahead to the next corner once it is in plain view.
    if (rt.i < rt.n - 1 && nav.clear(b.x, b.y, pts[rt.i * 2 + 2], pts[rt.i * 2 + 3], rr)) rt.i++;
    for (let guard = 0; guard < 2 && rt.i < rt.n; guard++) {
      const dx = pts[rt.i * 2] - b.x, dy = pts[rt.i * 2 + 1] - b.y, d = hyp(dx, dy);
      const last = rt.i === rt.n - 1;
      if (d < 0.15 && (!last || rt.breach >= 0)) { rt.i++; continue; } // corner reached
      if (d < 0.03) return [0, 0];
      const s = this.goalSp * (last && rt.breach < 0 ? Math.min(1, d / 0.3) : 1);
      return [(dx / d) * s, (dy / d) * s];
    }
    return rt.breach >= 0 ? this.breachAt(b, rt) : [0, 0];
  }
  /** At the end of a route that goes through a breakable block: walk up to it and break it (a keg blows itself up on it). */
  private breachAt(b: Body, rt: Route): [number, number] {
    const k = this.blocks[rt.breach];
    if (!k.alive) { rt.live = false; return [0, 0]; }
    const qx = clamp(b.x, k.x - k.w / 2, k.x + k.w / 2), qy = clamp(b.y, k.y - k.h / 2, k.y + k.h / 2);
    const dx = qx - b.x, dy = qy - b.y, d = hyp(dx, dy) || 0.001;
    if (d > b.radius + clamp(b.range, 0.15, 0.6) + 0.1) return [(dx / d) * this.goalSp, (dy / d) * this.goalSp];
    if (b.kind === "keg") { this.kegBlast(b); return [0, 0]; }
    if (b.cd <= 0) {
      b.cd = b.cooldown > 0 ? b.cooldown : 1;
      b.swing = this.time; b.swingA = Math.atan2(dy, dx);
      if (b.kind !== "bulwark") b.face = b.swingA;
      this.hitBlock(rt.breach, b.dmg * (b.kind === "golem" ? SIEGE_MUL : 1), qx, qy, b.id);
    }
    return [0, 0];
  }
  /** Movement with no destination (fleeing): turn aside rather than press into a block dead ahead. */
  private deflect(b: Body, want: [number, number], sp: number): [number, number] {
    const nav = this.nav!, dx = want[0] / sp, dy = want[1] / sp, look = b.radius + 0.3;
    if (!nav.hitsGround(b.x + dx * look, b.y + dy * look, b.radius)) return want;
    for (const a of DEFLECT) {
      const c = Math.cos(a * b.hand), s = Math.sin(a * b.hand), ex = dx * c - dy * s, ey = dx * s + dy * c;
      if (!nav.hitsGround(b.x + ex * look, b.y + ey * look, b.radius)) return [ex * sp, ey * sp];
    }
    return want;
  }
  /**
   * Keeps a ground body out of the blocks. Its whole move this step (walking, shoves, a hook's reel) is swept against
   * them from where it stood when the step began, so nothing tunnels however fast; it slides along what it hits; any
   * overlap left is pushed out; and if it still overlaps it goes back to where it began, which was clear.
   */
  private blockMove(b: Body) {
    const nav = this.nav!, r = b.radius;
    let ox = b.px, oy = b.py;
    for (let it = 0; it < 2; it++) {
      const dx = b.x - ox, dy = b.y - oy;
      if (dx * dx + dy * dy < 1e-12) break;
      const t = nav.sweep(ox, oy, b.x, b.y, r);
      if (t > 1) break;
      const nx = nav.snx, ny = nav.sny;
      const cx = ox + dx * t + nx * 1e-4, cy = oy + dy * t + ny * 1e-4;
      if (it === 0 && b.kind === "lancer" && b.state === "charge" && b.ax * nx + b.ay * ny < -0.4) {
        // A charge into a wall ends there, with the rider dazed.
        b.x = cx; b.y = cy; b.vx = 0; b.vy = 0;
        b.state = "aim"; b.t = 0; b.stun = Math.max(b.stun, CRASH_STUN);
        this.emit({ t: "crash", id: b.id, x: cx - nx * r, y: cy - ny * r, a: Math.atan2(b.ay, b.ax) });
        break;
      }
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { b.vx -= nx * vn; b.vy -= ny * vn; }
      if (it === 0) {
        // Slide: keep the part of the move that runs along the surface.
        const rx = dx * (1 - t), ry = dy * (1 - t), dot = rx * nx + ry * ny;
        b.x = cx + rx - nx * dot; b.y = cy + ry - ny * dot;
        ox = cx; oy = cy;
      } else { b.x = cx; b.y = cy; }
    }
    if (nav.pushOut(b, r)) nav.pushOut(b, r);
    b.x = Math.max(r, Math.min(W - r, b.x));
    b.y = Math.max(r, Math.min(H - r, b.y));
    if (nav.hitsGround(b.x, b.y, r - 1e-3)) { b.x = b.px; b.y = b.py; b.vx = 0; b.vy = 0; }
  }
  /** Attack-speed multiplier: banner haste, frost, a ravager's fury. */
  private rate(b: Body) {
    let r = 1;
    if (b.buff > 0) r *= 1.25;
    if (b.slow > 0) r *= 0.75;
    if (b.kind === "ravager") r *= 1 + 2 * (1 - b.hp / b.maxHp);
    return r;
  }

  // ------------------------------------------------------------ step
  step(dt = DT) {
    if (this.done) return;
    this.time += dt;
    for (const b of this.bodies) { b.px = b.x; b.py = b.y; }
    for (const p of this.projs) { p.px = p.x; p.py = p.y; }
    if (this.brushOn) for (const b of this.bodies) {
      // Who is hidden this step: in brush and not revealed (on top of buried mines and cloaked Shades).
      if (!b.alive) continue;
      const cover = this.inBrush(b);
      b.hidden = b.stealth || (cover && this.time >= b.reveal);
      if (b.ambush && !cover) b.ambush = false;
    }
    if (this.banners.length) this.auras();
    // Update in a fresh shuffled order every step so neither side gains from acting first or last.
    const order = this.order;
    order.length = 0;
    for (let i = 0; i < this.bodies.length; i++) if (this.bodies[i].alive) order.push(i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    for (const i of order) {
      const b = this.bodies[i];
      if (!b.alive) continue;
      b.cd -= dt * this.rate(b);
      b.t += dt;
      b.flash = Math.max(0, b.flash - dt);
      b.blinkCd -= dt;
      b.parryCd -= dt;
      b.aux -= dt;
      if (b.cloak > 0) { b.cloak -= dt; if (b.cloak <= 0) { b.stealth = false; b.hidden = false; } }
      if (b.slow > 0) b.slow -= dt;
      if (b.buff > 0) b.buff -= dt;
      if (b.rally > 0) b.rally -= dt;
      if (b.snare > 0) b.snare -= dt;
      if (b.wardT > 0) { b.wardT -= dt; if (b.wardT <= 0) b.ward = 0; }
      b.dmg = b.rally > 0 ? b.baseDmg * 1.2 : b.baseDmg;
      let want: [number, number] = [0, 0];
      if (b.frozen > 0) b.frozen -= dt;
      else if (b.stun > 0) b.stun -= dt;
      else if (!(b.ambush && this.lieLow(b))) {
        this.goalOn = false;
        const cd0 = b.cd;
        want = this.act(b, dt);
        // An attack or a cast (anything that starts its cooldown) gives away a body in brush.
        if (this.brushOn && b.cd > cd0 && b.cd > 0.35) this.expose(b);
        if (this.nav && !b.structure && !b.flying && !b.burrowed && b.alive) {
          want = this.steer(b, want);
          if (this.roadsOn && this.nav.onRoad(b.x, b.y)) want = [want[0] * ROAD_SPEED, want[1] * ROAD_SPEED];
        }
      }
      if (b.structure) { b.vx = 0; b.vy = 0; continue; }
      if (b.slow > 0) want = [want[0] * 0.5, want[1] * 0.5];
      if (b.snare > 0 && !b.flying) want = [want[0] * SNARE, want[1] * SNARE];
      if (!b.flying && !b.burrowed) want = this.avoid(b, want);
      const accel = b.kind === "lancer" ? 10 : b.kind === "golem" || b.kind === "golemling" ? 3.5 : 9;
      const dvx = want[0] - b.vx, dvy = want[1] - b.vy, dv = hyp(dvx, dvy), lim = accel * b.speed * dt + 0.02;
      if (b.stun > 0) { b.vx *= 0.86; b.vy *= 0.86; }
      else if (b.frozen > 0) { b.vx *= 0.5; b.vy *= 0.5; }
      else if (dv > lim) { b.vx += (dvx / dv) * lim; b.vy += (dvy / dv) * lim; }
      else { b.vx = want[0]; b.vy = want[1]; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const sp = hyp(b.vx, b.vy);
      if (sp > 0.15 && b.frozen <= 0 && b.kind !== "bulwark" && b.kind !== "lancer" && !b.braced) b.face = turnToward(b.face, Math.atan2(b.vy, b.vx), 9 * dt);
    }
    this.collide();
    this.stepProjectiles(dt);
    if (this.waves.length) this.stepWaves(dt);
    if (this.fuses.length) this.stepFuses();
    if (this.zones.length) this.stepZones(dt);
    if (!this.sideAlive(0) || !this.sideAlive(1) || this.time >= this.limit) this.finish();
  }

  /** Standard Bearer auras: haste (and Rally) for allies inside, refreshed every step; Rally heals in pulses. */
  private auras() {
    for (const f of this.banners) {
      if (!f.alive || f.stun > 0 || f.frozen > 0) continue;
      const rally = f.rank >= 4;
      const pulse = f.aux <= 0;
      if (pulse) {
        f.aux = 0.5;
        if (f.strikes++ % 2 === 0) this.emit({ t: "aura", id: f.id, x: f.x, y: f.y, r: AURA_R, side: f.side, rally });
      }
      for (const a of this.bodies) {
        if (!a.alive || a.side !== f.side || a === f || a.kind === "mine" || a.kind === "decoy" || a.burrowed) continue;
        if (this.dist(a, f) > AURA_R + a.radius) continue;
        a.buff = Math.max(a.buff, 0.2);
        if (rally) {
          a.rally = 0.2;
          if (pulse) this.heal(f, a, a.maxHp * 0.01 * f.healMul);
        }
      }
    }
  }

  /** Pushes overlapping bodies apart, pairs taken in this step's shuffled order (array order would favour a side). */
  private collide() {
    const bs = this.bodies, order = this.order;
    for (let i = 0; i < order.length; i++) {
      const a = bs[order[i]];
      if (!a.alive || a.kind === "mine" || a.flying || a.burrowed) continue;
      for (let j = i + 1; j < order.length; j++) {
        const b = bs[order[j]];
        if (!b.alive || b.kind === "mine" || b.flying || b.burrowed) continue;
        const dx = b.x - a.x, dy = b.y - a.y, min = a.radius + b.radius;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = hyp(dx, dy);
        if (d >= min) continue;
        const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0, over = min - d;
        // Inverse mass: structures never move, lighter bodies give way more.
        const ia = a.structure ? 0 : 1 / (a.radius * a.radius), ib = b.structure ? 0 : 1 / (b.radius * b.radius);
        const tot = ia + ib;
        if (tot <= 0) continue;
        a.x -= nx * over * (ia / tot); a.y -= ny * over * (ia / tot);
        b.x += nx * over * (ib / tot); b.y += ny * over * (ib / tot);
      }
    }
    for (const b of bs) {
      if (!b.alive || b.structure) continue;
      if (!b.flying && !b.burrowed) for (const o of this.obstacles) {
        const dx = b.x - o.x, dy = b.y - o.y, d = hyp(dx, dy), min = o.r + b.radius;
        if (d < min && d > 1e-6) { b.x = o.x + (dx / d) * min; b.y = o.y + (dy / d) * min; }
      }
      b.x = Math.max(b.radius, Math.min(W - b.radius, b.x));
      b.y = Math.max(b.radius, Math.min(H - b.radius, b.y));
      if (this.nav && !b.flying && !b.burrowed) this.blockMove(b);
    }
  }

  private stepFuses() {
    const due = this.fuses.filter((f) => f.at <= this.time + 1e-9);
    if (!due.length) return;
    this.fuses = this.fuses.filter((f) => f.at > this.time + 1e-9);
    for (const f of due) this.explode(f.x, f.y, f.r, f.dmg, f.side, f.kind, f.knock, f.stun);
  }

  private stepZones(dt: number) {
    this.zones = this.zones.filter((z) => z.until > this.time);
    for (const z of this.zones) {
      z.tick -= dt;
      if (z.tick > 0) continue;
      z.tick += 0.25;
      for (const e of this.enemiesNear(z.side, z.x, z.y, z.r, false, false)) {
        if (z.kind === "surf") { e.slow = Math.max(e.slow, 0.4); continue; }
        if (z.kind === "thorn") e.snare = Math.max(e.snare, 0.35);
        this.damage(e, z.dps * 0.25, null, z.side);
      }
    }
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    const a0 = this.sideAlive(0), a1 = this.sideAlive(1);
    if (a0 && !a1) this.winner = 0;
    else if (a1 && !a0) this.winner = 1;
    else if (!a0 && !a1) this.winner = -1;
    else {
      // Called on time: the side with clearly more strength left takes it.
      const [v0, v1] = this.result().value;
      this.winner = v0 > v1 * 1.08 ? 0 : v1 > v0 * 1.08 ? 1 : -1;
    }
    this.emit({ t: "end", winner: this.winner });
  }

  result(): BattleResult {
    const threat: [number, number] = [0, 0], value: [number, number] = [0, 0], alive: [number, number] = [0, 0];
    for (const b of this.bodies) {
      if (!b.alive || b.kind === "mine" || b.kind === "decoy") continue;
      if (b.kind !== "turret") alive[b.side]++;
      const spawn = isSpawn(b.kind) ? BODY_EXTRA[b.kind] : null;
      const unit = spawn ? null : UNITS[b.kind as UnitKind];
      threat[b.side] += (spawn ? spawn.threat : unit!.threat) * b.rank;
      const cost = spawn ? spawn.value : unit!.cost / (unit!.bodies ?? 1);
      value[b.side] += cost * b.rank * (b.hp / b.maxHp);
    }
    return { winner: this.winner, time: this.time, threat, value, alive };
  }

  /** Runs to the end (headless). */
  run(maxSteps = Math.ceil(this.limit / DT) + 2): BattleResult {
    for (let i = 0; i < maxSteps && !this.done; i++) this.step();
    if (!this.done) this.finish();
    return this.result();
  }

  // ------------------------------------------------------------ behaviours
  private act(b: Body, dt: number): [number, number] {
    switch (b.kind) {
      case "mine": return this.actMine(b, dt);
      case "blades": return this.actBlades(b);
      case "ranger": return this.actRanger(b);
      case "bulwark": return this.actBulwark(b, dt);
      case "medic": return this.actMedic(b);
      case "grenadier": return this.actGrenadier(b);
      case "shade": return this.actShade(b);
      case "lancer": return this.actLancer(b, dt);
      case "ballista": return this.actBallista(b, dt);
      case "hive": return this.actHive(b);
      case "storm": return this.actStorm(b);
      case "golem": case "golemling": return this.actGolem(b);
      case "mite": case "queen": case "thrall": return this.actMite(b);
      case "sapper": return this.actSapper(b);
      case "harrier": return this.actHarrier(b, dt);
      case "banner": return this.actBanner(b);
      case "rime": return this.actRime(b);
      case "ravager": return this.actRavager(b);
      case "grave": return this.actGrave(b);
      case "bombard": return this.actBombard(b);
      case "tinker": return this.actTinker(b);
      case "turret": return this.actTurret(b, dt);
      case "duelist": return this.actDuelist(b);
      case "pikeman": return this.actPikeman(b, dt);
      case "keg": return this.actKeg(b);
      case "trickster": return this.actTrickster(b);
      case "decoy": return this.actDecoy(b);
      case "hook": return this.actHook(b, dt);
      case "thorn": return this.actThorn(b);
      case "outrider": return this.actOutrider(b);
      case "lamp": return this.actLamp(b);
      case "griffin": return this.actGriffin(b, dt);
      case "tide": return this.actTide(b);
      case "lion": return this.actLion(b);
    }
  }

  /** Hidden until something steps close, then a short fuse and a blast one unit wide. */
  private actMine(b: Body, dt: number): [number, number] {
    if (b.state === "armed") {
      for (const e of this.bodies) {
        if (!e.alive || e.side === b.side || e.structure || e.flying || e.burrowed) continue;
        if (this.dist(b, e) <= 0.62 + e.radius && this.sees(b, e)) {
          b.state = "fuse"; b.t = 0; b.stealth = false; b.hidden = false;
          this.emit({ t: "fuse", id: b.id, x: b.x, y: b.y });
          break;
        }
      }
    } else if (b.state === "fuse") {
      if (b.t >= 0.32 - dt / 2) {
        const big = this.mods[b.side].bigMines;
        this.explode(b.x, b.y, b.range, b.dmg, b.side, "mine", 3.2, big ? 0.9 : 0.55);
        // Cluster: three bomblets thrown out, bursting a moment later.
        if (b.rank >= 4) this.scatter(b.x, b.y, 3, 0.95, this.rng.next() * TAU, 0.6, 0.55, b.dmg * 0.4, b.side, "bomblet");
        b.alive = false;
        b.diedAt = this.time;
        b.state = "spent";
      }
    }
    return [0, 0];
  }

  /** Three swords share one target and close on it from different angles, slashing in an arc. */
  private actBlades(b: Body): [number, number] {
    const pack = this.bodies.filter((m) => m.alive && m.pack === b.pack && m.side === b.side);
    let cx = 0, cy = 0;
    for (const m of pack) { cx += m.x; cy += m.y; }
    cx /= pack.length; cy /= pack.length;
    const centre = { x: cx, y: cy };
    let target = this.byId(this.packTarget.get(b.pack) ?? -1);
    const due = (this.packRetarget.get(b.pack) ?? 0) <= this.time;
    if (!target || !this.targetable(b, target) || due) {
      const probe = { ...b, x: cx, y: cy } as Body;
      target = this.nearestEnemy(probe);
      this.packTarget.set(b.pack, target ? target.id : -1);
      this.packRetarget.set(b.pack, this.time + 0.6);
    }
    if (!target) return [0, 0];
    const gap = this.gap(b, target);
    if (gap <= b.range && b.cd <= 0) {
      b.cd = b.cooldown;
      const a = Math.atan2(target.y - b.y, target.x - b.x);
      b.face = a;
      b.swing = this.time; b.swingA = a;
      const spin = b.rank >= 4 && ++b.strikes % 3 === 0; // Whirlwind
      const reach = b.radius + b.range + (spin ? 0.4 : 0.25);
      this.emit({ t: "slash", id: b.id, x: b.x, y: b.y, a, r: reach, side: b.side, spin });
      for (const e of this.enemiesNear(b.side, b.x, b.y, reach)) {
        if ((spin || Math.abs(angleDiff(a, Math.atan2(e.y - b.y, e.x - b.x))) <= 1.0) && !e.stealth) this.damage(e, b.dmg, b, b.side, false, b);
      }
    }
    // Surround: each sword takes its own angle around the target, relative to where the pack comes from.
    const base = Math.atan2(centre.y - target.y, centre.x - target.x);
    const a = base + (b.slot - (pack.length - 1) / 2) * 1.0 * -fwd(b.side);
    const ring = target.radius + b.radius + 0.12;
    let [vx, vy] = this.seek(b, target.x + Math.cos(a) * ring, target.y + Math.sin(a) * ring, 1, 0.35);
    const dc = this.dist(b, centre);
    if (dc > 0.9 && this.dist(centre, target) > 2) {
      // Keep the pack together on the way in.
      vx += ((cx - b.x) / dc) * b.speed * 0.5;
      vy += ((cy - b.y) / dc) * b.speed * 0.5;
    }
    if (gap < b.range * 0.6) { vx *= 0.3; vy *= 0.3; b.face = turnToward(b.face, Math.atan2(target.y - b.y, target.x - b.x), 0.4); }
    return [vx, vy];
  }

  /** Holds at bow range, backs off when rushed, strafes while it shoots. */
  private actRanger(b: Body): [number, number] {
    const near = this.nearestEnemy(b, { taunt: false });
    if (!near) return [0, 0];
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || this.shotDist(b, t) > b.range * 1.15) { t = near; b.target = near.id; }
    const dn = this.gap(b, near);
    const dt = this.shotDist(b, t);
    if (dt <= b.range && b.cd <= 0) {
      b.cd = b.cooldown;
      b.face = Math.atan2(t.y - b.y, t.x - b.x);
      if (b.rank >= 4 && ++b.strikes % 4 === 0) this.volley(b, t);
      else this.shoot(b, "arrow", t, 10);
    }
    if (dn < 1.6) return this.flee(b, near, 0.9);
    if (dt > b.range * 0.92) return this.seek(b, t.x, t.y, 1, 0.3);
    // Strafe slowly around the target so it is never a still target.
    const a = Math.atan2(b.y - t.y, b.x - t.x) + b.hand * 0.35;
    const r = b.range * 0.82;
    return this.seek(b, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, 0.45, 0.5);
  }
  /** Volley: three arrows in a fan; the side arrows seek whoever is nearest their line, else fly straight. */
  private volley(b: Body, t: Body) {
    this.shoot(b, "arrow", t, 10);
    const taken = [t.id];
    for (const s of [-1, 1]) {
      const a = b.face + s * 0.24;
      let pick: Body | undefined, pd = 0.45;
      for (const e of this.bodies) {
        if (!this.targetable(b, e) || taken.includes(e.id) || this.shotDist(b, e) > b.range * 1.1) continue;
        const d = Math.abs(angleDiff(a, Math.atan2(e.y - b.y, e.x - b.x)));
        if (d < pd) { pd = d; pick = e; }
      }
      if (pick) { taken.push(pick.id); this.shoot(b, "arrow", pick, 10); }
      else {
        const p = this.newProj("arrow", b, Math.cos(a) * 10, Math.sin(a) * 10);
        p.life = (b.range * 1.1) / 10;
      }
    }
    this.emit({ t: "volley", id: b.id, x: b.x, y: b.y, a: b.face });
  }

  /** Stands between the ally in most danger and what threatens it, shield toward the threat. */
  private actBulwark(b: Body, dt: number): [number, number] {
    const near = this.nearestEnemy(b, { taunt: false });
    if (!near) return [0, 0];
    b.face = turnToward(b.face, Math.atan2(near.y - b.y, near.x - b.x), 4 * dt);
    const gap = this.gap(b, near);
    if (gap <= b.range && b.cd <= 0) {
      b.cd = b.cooldown;
      this.melee(b, near, b.dmg, 2.4, b.rank >= 4 ? 0.6 : 0.25);
    }
    if (gap < 0.9) return this.seek(b, near.x, near.y, 0.8, 0.5);
    let ward: Body | undefined, worst = 0;
    for (const a of this.allies(b)) {
      if (a.kind === "bulwark" || a.structure) continue;
      let danger = 0;
      for (const e of this.bodies) {
        if (!this.targetable(b, e)) continue;
        const d = this.dist(a, e);
        if (d < 4) danger += 1 / (d + 0.5);
      }
      if (ROLE_BACKLINE.has(a.kind)) danger *= 1.6;
      if (danger > worst) { worst = danger; ward = a; }
    }
    if (ward && worst > 0.25) {
      const ec = this.enemyCentroid(b)!;
      const dx = ec.x - ward.x, dy = ec.y - ward.y, d = hyp(dx, dy) || 1;
      const off = ward.radius + b.radius + 0.3;
      return this.seek(b, ward.x + (dx / d) * off, ward.y + (dy / d) * off, 1, 0.5);
    }
    return this.seek(b, near.x, near.y, 0.85, 0.6);
  }

  /** Heals the most hurt ally in reach while keeping that ally between itself and the enemy. */
  private actMedic(b: Body): [number, number] {
    const threat = this.nearestEnemy(b, { taunt: false });
    let ward: Body | undefined, low = 0.97;
    for (const a of this.allies(b)) {
      const f = a.hp / a.maxHp;
      if (f < low && this.dist(b, a) < 6) { low = f; ward = a; }
    }
    if (ward && b.cd <= 0 && this.dist(b, ward) <= b.range + ward.radius && this.sees(b, ward)) {
      b.cd = b.cooldown;
      const amt = 26 * rankDmg(b.rank) * b.healMul;
      this.heal(b, ward, amt);
      for (const a of this.allies(b)) if (a !== ward && this.dist(a, ward) < 0.9) this.heal(b, a, amt * 0.4);
    }
    if (threat && this.gap(b, threat) < 1.5) return this.flee(b, threat, 1);
    return this.hangBack(b, ward, ward ? 1.3 : 1.1, threat);
  }
  /** Keeps behind an anchor (an ally, else the group's middle), on the side away from the enemy. */
  private hangBack(b: Body, anchor0: { x: number; y: number } | undefined, off: number, threat?: Body): [number, number] {
    const ec = this.enemyCentroid(b);
    const anchor = anchor0 ?? this.alliesCentre(b);
    if (!anchor) return threat ? this.flee(b, threat, 0.6) : [0, 0];
    let dx = 0, dy = -fwd(b.side);
    if (ec) { dx = anchor.x - ec.x; dy = anchor.y - ec.y; const d = hyp(dx, dy) || 1; dx /= d; dy /= d; }
    return this.seek(b, anchor.x + dx * off, anchor.y + dy * off, 1, 0.5);
  }
  /** Any ally left that does the fighting (not a structure, a helper or a Gravecaller)? */
  private hasFighters(b: Body): boolean {
    for (const a of this.bodies) {
      if (!a.alive || a.side !== b.side || a === b || a.structure || a.kind === "decoy" || a.kind === "grave") continue;
      if (isSpawn(a.kind) || UNITS[a.kind].role !== "support") return true;
    }
    return false;
  }
  private alliesCentre(b: Body): { x: number; y: number } | undefined {
    let sx = 0, sy = 0, n = 0;
    for (const a of this.allies(b)) if (!a.structure && !a.flying && !a.burrowed) { sx += a.x; sy += a.y; n++; }
    return n ? { x: sx / n, y: sy / n } : undefined;
  }

  /** Throws where the most enemies will be when the bomb lands; keeps its distance. */
  private actGrenadier(b: Body): [number, number] {
    const near = this.nearestEnemy(b, { taunt: false });
    if (!near) return [0, 0];
    const flight = 0.9;
    if (b.cd <= 0) {
      let best: { x: number; y: number } | undefined, score = 0;
      for (const e of this.bodies) {
        if (!this.targetable(b, e)) continue;
        const d = this.dist(b, e);
        if (d < 1.3 || d > b.range) continue;
        const px = e.x + e.vx * flight * 0.8, py = e.y + e.vy * flight * 0.8;
        let s = 0;
        for (const o of this.bodies) if (this.targetable(b, o) && hyp(o.x - px, o.y - py) < 0.95 + o.radius) s += o.kind === "mite" ? 0.6 : 1;
        if (s > score) { score = s; best = { x: px, y: py }; }
      }
      if (best) {
        b.cd = b.cooldown;
        b.face = Math.atan2(best.y - b.y, best.x - b.x);
        b.swing = this.time; b.swingA = b.face;
        const p = this.lob(b, best.x, best.y, flight, "grenade");
        if (b.rank >= 4) p.fx = "fire";
      }
    }
    const dn = this.gap(b, near);
    if (dn < 1.4) return this.flee(b, near, 0.9);
    if (dn > b.range - 0.6) return this.seek(b, near.x, near.y, 0.9, 0.4);
    return [0, 0];
  }

  /** Cloaked on the way in; curves round the flank, blinks behind the softest target and strikes. */
  private actShade(b: Body): [number, number] {
    let t = this.byId(b.target);
    const pickNew = !t || !this.targetable(b, t) || t.kind === "mine";
    if (pickNew) {
      t = this.softest(b, 2.2, 0.18);
      b.target = t ? t.id : -1;
    }
    if (!t) return [0, 0];
    const d = this.dist(b, t);
    if (d < 2.6 && b.blinkCd <= 0 && !(this.brushOn && this.veiled(b, t))) {
      // Blink to the far side of the target and stab.
      const back = -fwd(t.side);
      const x0 = b.x, y0 = b.y;
      b.x = Math.max(b.radius, Math.min(W - b.radius, t.x + (this.rng.next() - 0.5) * 0.3));
      b.y = Math.max(b.radius, Math.min(H - b.radius, t.y + back * (t.radius + b.radius + 0.12)));
      this.settle(b, t);
      b.px = b.x; b.py = b.y;
      b.vx = 0; b.vy = 0;
      b.face = Math.atan2(t.y - b.y, t.x - b.x);
      this.emit({ t: "blink", id: b.id, x0, y0, x: b.x, y: b.y, side: b.side });
      b.cloak = 0; b.stealth = false; b.hidden = false;
      b.blinkCd = 5;
      b.state = "fight";
      b.cd = b.cooldown;
      this.melee(b, t, b.dmg * 3);
      return [0, 0];
    }
    if (b.state === "flank" && d > 2.6) {
      // Curve in from the side: aim at a point beside the target, nearer the wall.
      const side = t.x < W / 2 ? -1 : 1;
      const lateral = Math.min(2.2, d * 0.55);
      return this.seek(b, Math.max(0.4, Math.min(W - 0.4, t.x + side * lateral)), t.y - fwd(b.side) * 0.4, 1, 0.3);
    }
    if (this.gap(b, t) <= b.range && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, t, b.dmg); }
    // Re-pick the softest target now and then once revealed.
    if (b.t > 2) { b.t = 0; b.target = -1; }
    return this.seek(b, t.x, t.y, 1, 0.3);
  }
  /** The softest worthwhile enemy: back-liners, the hurt and the frail, not too far. */
  private softest(b: Body, backline: number, distW: number): Body | undefined {
    let best: Body | undefined, bs = -Infinity;
    for (const e of this.bodies) {
      if (!this.targetable(b, e) || e.kind === "mine") continue;
      const s = (ROLE_BACKLINE.has(e.kind) ? backline : 0) + (1 - e.hp / e.maxHp) * 2 + (e.maxHp < 150 ? 1 : 0) - this.dist(b, e) * distW;
      if (s > bs) { bs = s; best = e; }
    }
    return best ?? this.lurker(b);
  }

  /** Aims, charges in a straight line through everything, wheels round in an arc, aims again. */
  private actLancer(b: Body, dt: number): [number, number] {
    if (b.state === "aim") {
      const t = this.nearestEnemy(b, { taunt: false });
      if (!t) return [0, 0];
      const a = Math.atan2(t.y - b.y, t.x - b.x);
      if (this.nav && (this.chargeBlocked(b, t) || (this.brushOn && this.veiled(b, t)))) {
        // No straight run at anyone: trot round the blocks to where there is one.
        if (hyp(b.vx, b.vy) > 0.3) b.face = turnToward(b.face, Math.atan2(b.vy, b.vx), 5 * dt);
        b.t = Math.min(b.t, 0.2);
        return this.seek(b, t.x, t.y, 0.5, 0.3);
      }
      b.face = turnToward(b.face, a, 5 * dt);
      const adj = this.nearestEnemy(b, { max: 0.35, taunt: false });
      if (adj && b.cd <= 0) { b.cd = 0.9; this.melee(b, adj, b.dmg * 0.3); }
      if (b.t > 0.35 && Math.abs(angleDiff(b.face, a)) < 0.2) {
        b.state = "charge"; b.t = 0;
        b.ax = Math.cos(b.face); b.ay = Math.sin(b.face);
        b.budget = Math.min(7.5, this.dist(b, t) + 2.0);
        b.hits = [];
        this.emit({ t: "charge", id: b.id, x: b.x, y: b.y, a: b.face });
      }
      return [Math.cos(b.face) * 0.25, Math.sin(b.face) * 0.25];
    }
    if (b.state === "charge") {
      const sp = hyp(b.vx, b.vy);
      const trample = b.rank >= 4;
      b.budget -= sp * dt;
      for (const e of this.bodies) {
        if (!this.targetable(b, e) && !(e.alive && e.side !== b.side && e.kind === "shade")) continue;
        if (e.kind === "mine" || b.hits.includes(e.id)) continue;
        if (this.dist(b, e) > b.radius + e.radius + 0.12 || !this.sees(b, e)) continue;
        b.hits.push(e.id);
        if (!trample && (e.structure || e.kind === "golem" || e.kind === "bulwark")) {
          // Something it can't go through: big hit and the charge ends.
          this.damage(e, b.dmg * 1.4, b, b.side, true, b);
          b.state = "wheel"; b.t = 0;
          b.vx *= -0.3; b.vy *= -0.3;
          return [0, 0];
        }
        const side = (e.x - b.x) * -b.ay + (e.y - b.y) * b.ax >= 0 ? 1 : -1;
        const heavy = e.structure || e.kind === "golem" || e.kind === "bulwark";
        this.damage(e, b.dmg * (heavy ? 1.4 : Math.min(1, 0.5 + sp / b.speed / 2)), b, b.side, true, b);
        this.push(e, -b.ay * side * 0.8 + b.ax * 0.5, b.ax * side * 0.8 + b.ay * 0.5, 3.0, 0.4);
        if (trample && e.alive) e.stun = Math.max(e.stun, 0.6);
      }
      const nearWall = b.x < 0.45 || b.x > W - 0.45 || b.y < 0.45 || b.y > H - 0.45;
      if (b.budget <= 0 || b.t > 2.4 || nearWall) { b.state = "wheel"; b.t = 0; }
      b.face = Math.atan2(b.ay, b.ax);
      return [b.ax * b.speed, b.ay * b.speed];
    }
    // wheel: carry the speed round in an arc toward the next target, then aim again.
    const t = this.nearestEnemy(b, { taunt: false });
    const want = t ? Math.atan2(t.y - b.y, t.x - b.x) : b.face + Math.PI;
    b.face = turnToward(b.face, want, 3.2 * dt);
    const sp = Math.max(0.6, b.speed * 0.45 * (1 - b.t));
    if (b.t > 0.85) { b.state = "aim"; b.t = 0; }
    return [Math.cos(b.face) * sp, Math.sin(b.face) * sp];
  }

  /** Would a straight run from `b` up to `t` hit a block first (its body sampled along the line, a little fattened). */
  private chargeBlocked(b: Body, t: Body): boolean {
    const dx = t.x - b.x, dy = t.y - b.y, d = hyp(dx, dy);
    const run = d - t.radius - b.radius;
    if (run <= 0.05) return false;
    for (let s = 0.15; s < run + 0.15; s += 0.15) {
      const u = Math.min(s, run);
      if (this.nav!.hitsGround(b.x + (dx / d) * u, b.y + (dy / d) * u, b.radius + 0.02)) return true;
    }
    return false;
  }

  /** Fixed. Turns slowly and looses a bolt that goes through every enemy in its line. */
  private actBallista(b: Body, dt: number): [number, number] {
    const t = this.nearestEnemy(b, { max: b.range, taunt: false });
    if (!t) return [0, 0];
    const lead = 0.25;
    const a = Math.atan2(t.y + t.vy * lead - b.y, t.x + t.vx * lead - b.x);
    b.face = turnToward(b.face, a, 1.8 * dt);
    if (b.cd <= 0 && Math.abs(angleDiff(b.face, a)) < 0.08) {
      b.cd = b.cooldown;
      b.swing = this.time; b.swingA = b.face;
      if (b.rank >= 4) {
        // Twin Bolt.
        for (const s of [-1, 1]) {
          const ba = b.face + s * 0.06;
          const p = this.newProj("bolt", b, Math.cos(ba) * 14, Math.sin(ba) * 14);
          p.life = b.range / 14; p.over = t.flying;
        }
        this.emit({ t: "twin", id: b.id, x: b.x, y: b.y, a: b.face });
      } else {
        const p = this.newProj("bolt", b, Math.cos(b.face) * 14, Math.sin(b.face) * 14);
        p.life = b.range / 14; p.over = t.flying;
      }
    }
    return [0, 0];
  }

  /** Breeds mites on a timer, up to a cap; mites swarm whatever is nearest. */
  private actHive(b: Body): [number, number] {
    if (b.cd <= 0 && this.nearestEnemy(b, { taunt: false })) {
      b.cd = b.cooldown;
      if (b.rank >= 4 && !b.once) { b.once = true; this.spawnMite(b, "queen"); return [0, 0]; }
      const cap = 3 + b.rank;
      if (this.owned(b, "mite") < cap) this.spawnMite(b);
    }
    return [0, 0];
  }
  private spawnMite(b: Body, kind: "mite" | "queen" = "mite") {
    const ec = this.enemyCentroid(b);
    const a = ec ? Math.atan2(ec.y - b.y, ec.x - b.x) + (this.rng.next() - 0.5) * 1.6 : this.rng.next() * TAU;
    const m = this.makeBody(kind, b.side, b.rank, b.x + Math.cos(a) * (b.radius + 0.2), b.y + Math.sin(a) * (b.radius + 0.2), b.pieceId, b);
    m.owner = b.id;
    m.vx = Math.cos(a) * 2; m.vy = Math.sin(a) * 2;
    m.face = a;
    m.cd = 0.3;
    this.emit({ t: "spawn", id: m.id, x: m.x, y: m.y, side: m.side, kind, from: b.id });
  }
  /** Mites, the brood queen and bone thralls: rush whatever is nearest. */
  private actMite(b: Body): [number, number] {
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || b.t > 0.4) { b.t = 0; t = this.nearestEnemy(b); b.target = t ? t.id : -1; }
    if (!t) return [0, 0];
    if (this.gap(b, t) <= b.range && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, t, b.dmg); }
    // A wobble across the path so the swarm streams rather than marching in single file.
    this.goalOn = true; this.goalX = t.x; this.goalY = t.y; this.goalSp = b.speed;
    const wob = Math.sin(this.time * 9 + b.id * 1.7) * 0.6 * -fwd(b.side);
    const a = Math.atan2(t.y - b.y, t.x - b.x) + wob * Math.min(1, this.dist(b, t) / 2);
    return [Math.cos(a) * b.speed, Math.sin(a) * b.speed];
  }

  /** Keeps casting range; lightning jumps from enemy to enemy. */
  private actStorm(b: Body): [number, number] {
    const near = this.nearestEnemy(b, { taunt: false });
    if (!near) return [0, 0];
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || this.shotDist(b, t) > b.range * 1.1) { t = near; b.target = near.id; }
    if (this.shotDist(b, t) <= b.range && b.cd <= 0) {
      b.cd = b.cooldown;
      b.swing = this.time; b.swingA = Math.atan2(t.y - b.y, t.x - b.x);
      const over = b.rank >= 4; // Overcharge
      const pts: [number, number][] = [[b.x, b.y]];
      const hit: number[] = [];
      let cur: Body | undefined = t, dmg = b.dmg;
      for (let k = 0; k < (over ? 8 : 5) && cur; k++) {
        pts.push([cur.x, cur.y]);
        hit.push(cur.id);
        const from: Body = cur;
        this.damage(from, dmg, b, b.side);
        from.stun = Math.max(from.stun, over ? 0.6 : 0.22);
        dmg *= 0.8;
        let next: Body | undefined, nd = 2.1;
        for (const e of this.bodies) {
          if (!this.targetable(b, e) || hit.includes(e.id)) continue;
          const d = this.dist(from, e);
          if (d < nd && this.sees(from, e)) { nd = d; next = e; }
        }
        cur = next;
      }
      this.emit({ t: "zap", pts, side: b.side });
    }
    const dn = this.gap(b, near);
    if (dn < 1.4) return this.flee(b, near, 0.85);
    if (this.shotDist(b, t) > b.range * 0.9) return this.seek(b, t.x, t.y, 1, 0.3);
    return [0, 0];
  }

  /** Walks at structures first (they can't run), slams the ground in front of it. */
  private actGolem(b: Body): [number, number] {
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || b.t > 1) {
      b.t = 0;
      t = b.kind === "golem" ? this.nearestEnemy(b, { max: 5, filter: (e) => e.structure, taunt: false }) : undefined;
      t ??= this.nearestEnemy(b);
      b.target = t ? t.id : -1;
    }
    if (!t) return [0, 0];
    const a = Math.atan2(t.y - b.y, t.x - b.x);
    if (this.gap(b, t) <= b.range * 0.75 && b.cd <= 0) {
      b.cd = b.cooldown;
      b.face = a;
      b.swing = this.time; b.swingA = a;
      if (b.kind === "golem" && b.rank >= 4 && ++b.strikes % 3 === 0) {
        // Quake: a wide stunning shock round the giant.
        this.explode(b.x, b.y, 2.0, b.dmg * 0.8, b.side, "quake", 2.4, 0.9);
      } else {
        const reach = b.radius + 0.35;
        const r = b.kind === "golem" ? 0.85 : 0.6;
        this.explode(b.x + Math.cos(a) * reach, b.y + Math.sin(a) * reach, r, b.dmg, b.side, "slam", 1.4, 0.15);
      }
    }
    if (this.gap(b, t) < b.range * 0.5) return [0, 0];
    return this.seek(b, t.x, t.y, 1, 0.4);
  }

  /** Tunnels unseen to the softest back-liner, bursts up stunning everything round it, then fights. */
  private actSapper(b: Body): [number, number] {
    if (b.state === "burrow") {
      let t = this.byId(b.target);
      if (!t || !this.targetable(b, t) || t.kind === "decoy") {
        t = this.softest(b, 3, 0.1);
        b.target = t ? t.id : -1;
      }
      if (b.aux <= 0) { b.aux = 0.12; this.emit({ t: "dig", id: b.id, x: b.x, y: b.y }); }
      if (!t || this.dist(b, t) <= t.radius + b.radius + 0.2 || b.t > 7) { this.emerge(b); return [0, 0]; }
      return this.seek(b, t.x, t.y, 1, 0.2);
    }
    const t = this.nearestEnemy(b);
    if (!t) return [0, 0];
    if (this.gap(b, t) <= b.range && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, t, b.dmg); }
    return this.seek(b, t.x, t.y, 1, 0.3);
  }
  private emerge(b: Body) {
    const big = b.rank >= 4; // Cave-in
    const r = big ? 2.0 : 1.0;
    this.settle(b); // never up inside a block
    b.burrowed = false; b.state = "fight"; b.t = 0; b.cd = 0.35; b.target = -1;
    this.emit({ t: "emerge", id: b.id, x: b.x, y: b.y, r, side: b.side, big });
    this.emit({ t: "boom", x: b.x, y: b.y, r, kind: "erupt", side: b.side });
    for (const e of this.enemiesNear(b.side, b.x, b.y, r)) {
      const d = hyp(e.x - b.x, e.y - b.y) || 0.001;
      if (big) this.damage(e, b.dmg * 2, b, b.side, true);
      e.stun = Math.max(e.stun, 1.3);
      this.push(e, (e.x - b.x) / d, (e.y - b.y) / d, big ? 2.4 : 1.2);
    }
  }

  /** Flies: circles above its prey, dives, strikes, climbs away and circles again. */
  private actHarrier(b: Body, dt: number): [number, number] {
    if (b.state === "climb") {
      b.z = Math.min(1.2, b.z + dt * 2.2);
      if (b.t > 0.55) { b.state = "circle"; b.t = 0; }
      const sp = hyp(b.vx, b.vy);
      return sp > 0.1 ? [(b.vx / sp) * b.speed, (b.vy / sp) * b.speed] : [0, -fwd(b.side) * b.speed];
    }
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || (b.state === "circle" && b.aux <= 0)) {
      b.aux = 1.0;
      let best: Body | undefined, bs = -Infinity;
      for (const e of this.bodies) {
        if (!this.targetable(b, e) || e.kind === "mine") continue;
        // Prey that can't shoot back, back-liners, the hurt and the frail.
        const s = (AIR_HITTERS.has(e.kind) ? -2.5 : 0) + (ROLE_BACKLINE.has(e.kind) ? 1.5 : 0) + (1 - e.hp / e.maxHp) * 1.5 + (e.maxHp < 160 ? 0.8 : 0) - this.dist(b, e) * 0.25;
        if (s > bs) { bs = s; best = e; }
      }
      t = best ?? this.lurker(b);
      b.target = t ? t.id : -1;
    }
    if (!t) { b.z = Math.min(1.2, b.z + dt * 2); return [0, 0]; }
    if (b.state === "circle") {
      b.z = Math.min(1.2, b.z + dt * 2);
      const a = Math.atan2(b.y - t.y, b.x - t.x) + b.hand * 0.9;
      const v = this.seek(b, t.x + Math.cos(a) * 1.6, t.y + Math.sin(a) * 1.6, 1, 0.3);
      if (b.cd <= 0 && b.t > 0.6 && !(this.brushOn && this.veiled(b, t))) {
        b.state = "dive"; b.t = 0;
        this.emit({ t: "dive", id: b.id, x: b.x, y: b.y, target: t.id, tx: t.x, ty: t.y, side: b.side });
      }
      return v;
    }
    // dive
    const d = this.dist(b, t);
    b.z = Math.max(0.15, Math.min(b.z, (d - t.radius) * 0.5));
    if (d <= b.radius + t.radius + 0.12) {
      this.melee(b, t, b.dmg);
      if (b.rank >= 4) {
        // Talon Dive: everything under the strike is hit and thrown back.
        this.emit({ t: "boom", x: t.x, y: t.y, r: 0.9, kind: "talon", side: b.side });
        for (const e of this.enemiesNear(b.side, t.x, t.y, 0.9)) {
          const dd = hyp(e.x - t.x, e.y - t.y) || 0.001;
          if (e !== t) this.damage(e, b.dmg * 0.6, b, b.side, true);
          const nx = e === t ? (t.x - b.x) / (d || 0.001) : (e.x - t.x) / dd, ny = e === t ? (t.y - b.y) / (d || 0.001) : (e.y - t.y) / dd;
          this.push(e, nx, ny, 2.6, 0.35);
        }
      }
      b.cd = b.cooldown;
      b.state = "climb"; b.t = 0;
      return [b.vx, b.vy];
    }
    if (b.t > 1.6) { b.state = "climb"; b.t = 0; b.cd = b.cooldown * 0.5; }
    return this.seek(b, t.x, t.y, 1.5, 0.05);
  }

  /** Walks just behind the main group with the flag up; the aura itself is in auras(). */
  private actBanner(b: Body): [number, number] {
    const threat = this.nearestEnemy(b, { taunt: false });
    if (threat && this.gap(b, threat) <= b.range && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, threat, b.dmg); }
    if (threat && this.gap(b, threat) < 1.1) return this.flee(b, threat, 0.9);
    if (!this.hasFighters(b)) return threat ? this.seek(b, threat.x, threat.y, 0.7, 0.4) : [0, 0];
    return this.hangBack(b, undefined, 0.5, threat);
  }

  /** Frost caster: shards slow what they hit (every third freezes when Ascended); keeps its distance. */
  private actRime(b: Body): [number, number] {
    const near = this.nearestEnemy(b, { taunt: false });
    if (!near) return [0, 0];
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || this.shotDist(b, t) > b.range * 1.1) { t = near; b.target = near.id; }
    if (b.cd <= 0 && (t.slow > 0.6 || t.frozen > 0)) {
      // Spread the frost: prefer someone not yet chilled.
      const alt = this.nearestEnemy(b, { max: b.range, taunt: false, filter: (e) => e.slow <= 0 && e.frozen <= 0 });
      if (alt) { t = alt; b.target = alt.id; }
    }
    if (this.shotDist(b, t) <= b.range && b.cd <= 0) {
      b.cd = b.cooldown;
      b.face = Math.atan2(t.y - b.y, t.x - b.x);
      b.swing = this.time; b.swingA = b.face;
      const p = this.shoot(b, "shard", t, 9);
      if (b.rank >= 4 && ++b.strikes % 3 === 0) p.fx = "freeze";
    }
    const dn = this.gap(b, near);
    if (dn < 1.5) return this.flee(b, near, 0.85);
    if (this.shotDist(b, t) > b.range * 0.9) return this.seek(b, t.x, t.y, 1, 0.3);
    return [0, 0];
  }

  /** Berserker: goes for the toughest enemy; strikes faster the more it bleeds (see rate()). */
  private actRavager(b: Body): [number, number] {
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || b.aux <= 0) {
      b.aux = 1.5;
      let best: Body | undefined, bs = -Infinity;
      for (const e of this.bodies) {
        if (!this.targetable(b, e) || e.kind === "mine") continue;
        const s = e.hp - this.dist(b, e) * 45;
        if (s > bs) { bs = s; best = e; }
      }
      t = best ?? this.lurker(b);
      b.target = t ? t.id : -1;
    }
    if (!t) return [0, 0];
    // Cut through whatever stands in the way.
    const hit = this.gap(b, t) <= b.range ? t : this.nearestEnemy(b, { max: b.range + b.radius, taunt: false });
    if (hit && b.cd <= 0) {
      b.cd = b.cooldown;
      const dealt = this.melee(b, hit, b.dmg);
      if (b.rank >= 4 && dealt > 0) this.heal(b, b, dealt * 0.2); // Bloodlust
    }
    return this.seek(b, t.x, t.y, 1, 0.3);
  }

  /** Hangs back near the fighting so the fallen are within reach; raising happens in kill(). */
  private actGrave(b: Body): [number, number] {
    const threat = this.nearestEnemy(b, { taunt: false });
    if (b.rank >= 4) {
      // Ossuary: a thrall rises every 6 s regardless.
      if (!b.once) { b.once = true; b.aux = 3; }
      else if (b.aux <= 0) {
        b.aux = 6;
        if (threat && this.owned(b, "thrall") < THRALL_CAP) this.raise(b, clamp(b.x, 0.4, W - 0.4), clamp(b.y + fwd(b.side) * 0.6, 0.4, H - 0.4), b);
      }
    }
    if (threat && this.gap(b, threat) < 1.5) return this.flee(b, threat, 0.9);
    return this.hangBack(b, undefined, 1.0, threat);
  }

  /** Fixed mortar: a slow, high shell at the thickest group between its minimum and maximum range. */
  private actBombard(b: Body): [number, number] {
    if (b.cd > 0) return [0, 0];
    const flight = 1.6;
    let best: { x: number; y: number } | undefined, score = 0;
    for (const e of this.bodies) {
      if (!this.targetable(b, e)) continue;
      const d = this.dist(b, e);
      if (d < BOMBARD_MIN || d > b.range) continue;
      const px = e.x + e.vx * flight * 0.6, py = e.y + e.vy * flight * 0.6;
      let s = 0;
      for (const o of this.bodies) if (this.targetable(b, o) && hyp(o.x - px, o.y - py) < 1.2 + o.radius) s += o.kind === "mite" ? 0.5 : o.kind === "decoy" ? 0.3 : 1;
      if (s > score) { score = s; best = { x: px, y: py }; }
    }
    if (!best) { b.cd = 0.3; return [0, 0]; }
    b.cd = b.cooldown;
    b.face = Math.atan2(best.y - b.y, best.x - b.x);
    b.swing = this.time; b.swingA = b.face;
    const p = this.lob(b, clamp(best.x, 0.2, W - 0.2), clamp(best.y, 0.2, H - 0.2), flight, "shell");
    if (b.rank >= 4) p.fx = "shrapnel";
    return [0, 0];
  }

  /** Builds a turret (two when Ascended), mends damaged structures, keeps out of the fighting. */
  private actTinker(b: Body): [number, number] {
    const threat = this.nearestEnemy(b, { taunt: false });
    if (b.state === "build") {
      if (threat && this.gap(b, threat) < 0.8) b.state = "idle"; // knocked off the job
      else {
        if (b.t >= 1.2) {
          b.state = "idle";
          b.aux = 2.5;
          const tu = this.makeBody("turret", b.side, b.rank, b.ax, b.ay, b.pieceId, b);
          tu.owner = b.id;
          tu.face = b.face;
          tu.cd = 0.4;
          if (b.rank >= 4) tu.cooldown *= 0.6; // Workshop
          this.emit({ t: "spawn", id: tu.id, x: tu.x, y: tu.y, side: tu.side, kind: "turret", from: b.id });
        }
        return [0, 0];
      }
    }
    if (threat && this.gap(b, threat) <= b.range && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, threat, b.dmg); }
    if (threat && this.gap(b, threat) < 1.3) return this.flee(b, threat, 0.9);
    let fix: Body | undefined, low = 0.92;
    for (const a of this.allies(b)) if (a.structure && a.hp / a.maxHp < low && this.dist(a, b) < 6) { low = a.hp / a.maxHp; fix = a; }
    if (fix) {
      if (this.gap(b, fix) > 0.45) return this.seek(b, fix.x, fix.y, 1, 0.3);
      if (b.cd <= 0) {
        b.cd = 0.5;
        const before = fix.hp;
        fix.hp = Math.min(fix.maxHp, fix.hp + 14 * rankDmg(b.rank) * b.healMul);
        b.swing = this.time; b.swingA = Math.atan2(fix.y - b.y, fix.x - b.x);
        this.emit({ t: "repair", from: b.id, to: fix.id, x: fix.x, y: fix.y, amt: Math.round(fix.hp - before) });
      }
      return [0, 0];
    }
    if (threat && b.aux <= 0 && this.owned(b, "turret") < (b.rank >= 4 ? 2 : 1)) {
      const ec = this.enemyCentroid(b) ?? threat;
      const dx = ec.x - b.x, dy = ec.y - b.y, d = hyp(dx, dy) || 1;
      b.ax = clamp(b.x + (dx / d) * 0.7, 0.4, W - 0.4);
      b.ay = clamp(b.y + (dy / d) * 0.7, 0.4, H - 0.4);
      if (this.nav) [b.ax, b.ay] = this.freeAt(b.ax, b.ay, BODY_EXTRA.turret.radius, b);
      b.face = Math.atan2(dy, dx);
      b.state = "build"; b.t = 0;
      this.emit({ t: "build", id: b.id, x: b.ax, y: b.ay, dur: 1.2 });
      return [0, 0];
    }
    // With nobody left to hide behind, it walks in with its wrench (and builds again closer up).
    if (threat && !this.hasFighters(b)) return this.seek(b, threat.x, threat.y, 0.8, 0.4);
    let mine: Body | undefined;
    for (const x of this.bodies) if (x.alive && x.kind === "turret" && x.owner === b.id) { mine = x; break; }
    return this.hangBack(b, mine, 0.8, threat);
  }
  private actTurret(b: Body, dt: number): [number, number] {
    const t = this.nearestEnemy(b, { max: b.range, taunt: false });
    if (!t) return [0, 0];
    const a = Math.atan2(t.y - b.y, t.x - b.x);
    b.face = turnToward(b.face, a, 6 * dt);
    if (b.cd <= 0 && Math.abs(angleDiff(b.face, a)) < 0.3) {
      b.cd = b.cooldown;
      b.swing = this.time; b.swingA = b.face;
      this.shoot(b, "pellet", t, 11);
    }
    return [0, 0];
  }

  /** Hunts enemy fighters; its parry and riposte live in damage(). */
  private actDuelist(b: Body): [number, number] {
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || b.aux <= 0) {
      b.aux = 1.2;
      let best: Body | undefined, bs = -Infinity;
      for (const e of this.bodies) {
        if (!this.targetable(b, e) || e.kind === "mine") continue;
        const s = (isMeleeKind(e.kind) ? 2.5 : 0) + (e.kind === "decoy" ? 1 : 0) - this.dist(b, e) * 0.45;
        if (s > bs) { bs = s; best = e; }
      }
      t = best ?? this.lurker(b);
      b.target = t ? t.id : -1;
    }
    if (!t) return [0, 0];
    const hit = this.gap(b, t) <= b.range ? t : this.nearestEnemy(b, { max: b.range + b.radius, taunt: false });
    if (hit && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, hit, b.dmg); }
    return this.seek(b, t.x, t.y, 1, 0.3);
  }

  /** Long reach; sets its pikes when a charge comes and stops it cold (Hedgehog: against any melee). */
  private actPikeman(b: Body, dt: number): [number, number] {
    const charging = (e: Body) => (e.kind === "lancer" && e.state === "charge") || (e.kind === "keg" && e.state === "run");
    let charger: Body | undefined, cdist = 3.2;
    for (const e of this.bodies) {
      if (!e.alive || e.side === b.side || e.flying || e.burrowed || !charging(e)) continue;
      const d = this.dist(b, e), sp = hyp(e.vx, e.vy);
      if (d > cdist || sp < 0.5 || ((b.x - e.x) * e.vx + (b.y - e.y) * e.vy) / (d * sp) < 0.5) continue;
      cdist = d; charger = e;
    }
    const brawl = b.rank >= 4 ? this.nearestEnemy(b, { max: b.radius + 0.9, taunt: false, filter: (e) => isMeleeKind(e.kind) }) : undefined;
    const was = b.braced;
    if (charger || brawl) { b.braced = true; b.aux = 0.6; }
    else if (b.braced && b.aux <= 0) b.braced = false;
    if (b.braced) {
      const focus = charger ?? brawl ?? this.nearestEnemy(b, { taunt: false });
      if (focus) b.face = turnToward(b.face, Math.atan2(focus.y - b.y, focus.x - b.x), 10 * dt);
      if (!was) this.emit({ t: "brace", id: b.id, x: b.x, y: b.y, a: b.face });
      for (const e of this.bodies) {
        if (!e.alive || e.side === b.side || !charging(e) || this.gap(b, e) > b.range + 0.1) continue;
        if (Math.abs(angleDiff(b.face, Math.atan2(e.y - b.y, e.x - b.x))) > 1.2) continue;
        this.impale(b, e);
      }
      const t = this.nearestEnemy(b, { max: b.range + b.radius, taunt: false });
      if (t && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, t, b.dmg); }
      return [0, 0];
    }
    const t = this.nearestEnemy(b);
    if (!t) return [0, 0];
    const gap = this.gap(b, t);
    if (gap <= b.range && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, t, b.dmg); }
    if (gap < b.range * 0.75) { b.face = turnToward(b.face, Math.atan2(t.y - b.y, t.x - b.x), 6 * dt); return [0, 0]; }
    return this.seek(b, t.x, t.y, 1, 0.4);
  }
  private impale(b: Body, e: Body) {
    const d = this.dist(b, e) || 0.001;
    const nx = (e.x - b.x) / d, ny = (e.y - b.y) / d;
    this.emit({ t: "impale", id: b.id, target: e.id, x: e.x, y: e.y });
    e.state = e.kind === "lancer" ? "wheel" : "reel";
    e.t = 0;
    e.vx = nx * 2; e.vy = ny * 2;
    b.swing = this.time; b.swingA = Math.atan2(ny, nx);
    this.damage(e, b.dmg * 4, b, b.side, true, b);
    if (e.alive) e.stun = Math.max(e.stun, 0.8);
  }

  /** Sprints at the thickest knot of enemies and blows up there. Killed first, it fizzles. */
  private actKeg(b: Body): [number, number] {
    if (b.state === "reel") { if (b.t > 0.6) { b.state = "run"; b.t = 0; } return [0, 0]; }
    if (!b.once) { b.once = true; this.emit({ t: "light", id: b.id, x: b.x, y: b.y }); }
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || b.aux <= 0) {
      b.aux = 0.4;
      let best: Body | undefined, bs = -Infinity;
      for (const e of this.bodies) {
        if (!this.targetable(b, e) || e.kind === "mine") continue;
        let n = 0;
        for (const o of this.bodies) if (this.targetable(b, o) && o.kind !== "mine" && hyp(o.x - e.x, o.y - e.y) < b.range + o.radius) n += o.kind === "mite" ? 0.5 : o.kind === "decoy" ? 0.3 : 1;
        const s = n * 3 - this.dist(b, e) * 0.35;
        if (s > bs) { bs = s; best = e; }
      }
      t = best ?? this.lurker(b);
      b.target = t ? t.id : -1;
    }
    if (!t) return [0, 0];
    if (b.t > 0.25) {
      if (this.dist(b, t) <= b.radius + t.radius + 0.15) { this.kegBlast(b); return [0, 0]; }
      // Bumped on the way: blow only if it would catch two, or it has run long enough.
      for (const e of this.bodies) {
        if (!this.targetable(b, e) || e.kind === "mine" || this.gap(b, e) >= 0.08) continue;
        if (b.t > 3 || this.enemiesNear(b.side, b.x, b.y, b.range).length >= 2) { this.kegBlast(b); return [0, 0]; }
        break;
      }
    }
    return this.seek(b, t.x, t.y, 1, 0.05);
  }
  private kegBlast(b: Body) {
    this.explode(b.x, b.y, b.range, b.dmg, b.side, "keg", 3.0, 0.7);
    b.alive = false; b.hp = 0; b.diedAt = this.time; b.state = "spent";
    if (b.rank >= 4) {
      // Chain Keg: a second keg left behind.
      const at = this.time + 1;
      this.fuses.push({ x: b.x, y: b.y, at, r: b.range * 0.9, dmg: b.dmg * 0.7, side: b.side, kind: "keg", knock: 2.4, stun: 0.35 });
      this.emit({ t: "kegdrop", x: b.x, y: b.y, at, side: b.side });
    }
  }

  /** Throws out decoys of itself (recast once they have all popped) and knifes the soft back line. */
  private actTrickster(b: Body): [number, number] {
    if (b.t > 0.3 && b.aux <= 0 && this.owned(b, "decoy") === 0 && this.nearestEnemy(b, { taunt: false })) {
      const n = b.rank >= 4 ? 4 : 2; // Mirror Hall
      for (let i = 0; i < n; i++) {
        const a = b.face + Math.PI / 2 + (i * TAU) / n;
        const d = this.makeBody("decoy", b.side, b.rank, clamp(b.x + Math.cos(a) * 0.55, 0.3, W - 0.3), clamp(b.y + Math.sin(a) * 0.55, 0.3, H - 0.3), b.pieceId, b);
        d.owner = b.id;
        d.face = b.face;
        d.vx = Math.cos(a) * 2; d.vy = Math.sin(a) * 2;
        this.emit({ t: "decoy", id: d.id, from: b.id, x: d.x, y: d.y, side: d.side });
        this.emit({ t: "spawn", id: d.id, x: d.x, y: d.y, side: d.side, kind: "decoy", from: b.id });
      }
      b.aux = 4;
    }
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || t.kind === "decoy") {
      t = this.softest(b, 2, 0.2);
      b.target = t ? t.id : -1;
    }
    if (!t) return [0, 0];
    const hit = this.gap(b, t) <= b.range ? t : this.nearestEnemy(b, { max: b.range + b.radius, taunt: false });
    if (hit && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, hit, b.dmg); }
    return this.seek(b, t.x, t.y, 1, 0.3);
  }
  /** An illusion: dances in front of the nearest enemy, pretending to fight, and draws its attacks. */
  private actDecoy(b: Body): [number, number] {
    const t = this.nearestEnemy(b, { taunt: false });
    if (!t) return [0, 0];
    if (this.gap(b, t) < 0.7 && b.cd <= 0) { b.cd = b.cooldown; b.swing = this.time; b.swingA = Math.atan2(t.y - b.y, t.x - b.x); }
    const a = Math.atan2(b.y - t.y, b.x - t.x) + Math.sin(this.time * 2.2 + b.id) * 0.8 * b.hand;
    const r = t.radius + b.radius + 0.5;
    return this.seek(b, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, 1, 0.3);
  }

  /**
   * Holds the line hand to hand; every few seconds throws a chain at the softest back-liner
   * in reach and reels it in to the front (Iron Tether: two at once, each held stunned on arrival).
   * State: "" fighting, "cast" chain in flight (lands at `budget`), "reel" dragging the `hits`.
   */
  private actHook(b: Body, dt: number): [number, number] {
    if (b.state === "cast") {
      if (this.time < b.budget) return [0, 0];
      const caught: number[] = [];
      for (const id of b.hits) {
        const v = this.byId(id);
        if (!v || !this.targetable(b, v) || v.structure || v.flying || this.dist(b, v) > HOOK_R * 1.25) continue;
        if (this.nav && !this.nav.los(b.x, b.y, v.x, v.y)) {
          // The chain is a direct shot: it stops on the wall its mark stepped behind.
          const k = this.nav.shotHit(b.x, b.y, v.x, v.y);
          this.emit({ t: "ricochet", x: this.nav.hx, y: this.nav.hy, kind: "hook", block: k >= 0 ? this.blocks[k].id : -1 });
          continue;
        }
        caught.push(id);
        this.damage(v, b.dmg * 2, b, b.side, false, b); // the hook bites
        if (v.alive) this.emit({ t: "reel", id: b.id, target: v.id, x: v.x, y: v.y });
      }
      b.hits = caught;
      b.state = caught.length ? "reel" : "";
      b.t = 0;
      return [0, 0];
    }
    if (b.state === "reel") {
      let pulling = false;
      for (const id of b.hits) {
        const v = this.byId(id);
        if (!v || !v.alive || v.burrowed || v.flying) continue;
        const dx = b.x - v.x, dy = b.y - v.y, d = hyp(dx, dy) || 0.001;
        const stop = b.radius + v.radius + 0.12;
        if (d <= stop) continue;
        pulling = true;
        const step = Math.min(REEL_SPEED * dt, d - stop);
        v.x = clamp(v.x + (dx / d) * step, v.radius, W - v.radius);
        v.y = clamp(v.y + (dy / d) * step, v.radius, H - v.radius);
        v.vx = 0; v.vy = 0;
        v.stun = Math.max(v.stun, 0.05);
      }
      if (pulling && b.t < 1.4) return [0, 0];
      // Landed at the Hookwarden's feet, dazed for a moment (Iron Tether: a full second).
      for (const id of b.hits) { const v = this.byId(id); if (v && v.alive) v.stun = Math.max(v.stun, b.rank >= 4 ? 1.0 : 0.6); }
      b.hits = [];
      b.state = "";
    }
    const near = this.nearestEnemy(b);
    if (!near) return [0, 0];
    if (b.aux <= 0) {
      // Who is worth the chain: soft, behind the line, not already in our face.
      const n = b.rank >= 4 ? 2 : 1;
      const picks: { e: Body; s: number }[] = [];
      for (const e of this.bodies) {
        if (!this.targetable(b, e) || e.structure || e.flying || e.kind === "mine" || e.kind === "decoy") continue;
        const d = this.dist(b, e);
        if (d > HOOK_R || this.gap(b, e) < 1.0 || !this.sees(b, e)) continue;
        const s = (ROLE_BACKLINE.has(e.kind) ? 3 : 0) + (1 - e.hp / e.maxHp) - d * 0.25 - (isSpawn(e.kind) ? 2 : 0);
        picks.push({ e, s });
      }
      picks.sort((p, q) => q.s - p.s || p.e.id - q.e.id);
      const chosen = picks.slice(0, n).map((p) => p.e);
      if (chosen.length) {
        b.aux = HOOK_CD;
        b.state = "cast";
        this.expose(b);
        b.hits = chosen.map((e) => e.id);
        const far = Math.max(...chosen.map((e) => this.dist(b, e)));
        b.budget = this.time + far / HOOK_SPEED;
        b.face = Math.atan2(chosen[0].y - b.y, chosen[0].x - b.x);
        b.swing = this.time; b.swingA = b.face;
        for (const e of chosen) this.emit({ t: "hook", id: b.id, target: e.id, x: b.x, y: b.y, tx: e.x, ty: e.y, side: b.side });
        return [0, 0];
      }
      b.aux = 0.4; // look again shortly
    }
    const gap = this.gap(b, near);
    if (gap <= b.range && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, near, b.dmg, 1.2); }
    if (gap < b.range * 0.6) return [0, 0];
    return this.seek(b, near.x, near.y, 1, 0.4);
  }

  /** Sows bramble patches where the enemy is about to walk; keeps well back (Bramble Crown: wider, longer, and seizes on sprouting). */
  private actThorn(b: Body): [number, number] {
    const near = this.nearestEnemy(b, { taunt: false });
    if (!near) return [0, 0];
    const asc = b.rank >= 4;
    const r = asc ? 1.25 : 0.95;
    if (b.cd <= 0) {
      const lead = 1.1;
      let best: { x: number; y: number } | undefined, score = 0;
      for (const e of this.bodies) {
        if (!this.targetable(b, e) || e.flying || e.structure) continue;
        const d = this.dist(b, e);
        if (d > b.range) continue;
        const px = clamp(e.x + e.vx * lead, 0.3, W - 0.3), py = clamp(e.y + e.vy * lead, 0.3, H - 0.3);
        let s = 0;
        // Score the spot against where everyone else will be by then too.
        for (const o of this.bodies) {
          if (!this.targetable(b, o) || o.flying || o.structure) continue;
          if (hyp(o.x + o.vx * lead - px, o.y + o.vy * lead - py) < r + o.radius) s += isSpawn(o.kind) ? 0.5 : 1;
        }
        if (s > score) { score = s; best = { x: px, y: py }; }
      }
      if (best) {
        b.cd = b.cooldown;
        b.face = Math.atan2(best.y - b.y, best.x - b.x);
        b.swing = this.time; b.swingA = b.face;
        const z: Zone = { id: this.nextId++, kind: "thorn", x: best.x, y: best.y, r, side: b.side, until: this.time + (asc ? 5 : 3.5), dps: b.dmg, tick: 0.25 };
        this.zones.push(z);
        this.emit({ t: "zone", id: z.id, x: z.x, y: z.y, r: z.r, until: z.until, side: z.side, kind: "thorn", root: asc });
        if (asc) for (const e of this.enemiesNear(b.side, z.x, z.y, z.r, false, false)) if (!e.structure) e.stun = Math.max(e.stun, 0.8);
      }
    }
    const dn = this.gap(b, near);
    if (dn < 1.6) return this.flee(b, near, 0.9);
    if (dn > b.range - 0.5) return this.seek(b, near.x, near.y, 0.9, 0.4);
    return [0, 0];
  }

  /** Mounted archer: rides a ring round its mark at range, shooting on the move (Running Fire: two arrows, two foes). */
  private actOutrider(b: Body): [number, number] {
    const near = this.nearestEnemy(b, { taunt: false });
    if (!near) return [0, 0];
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || this.shotDist(b, t) > b.range * 1.3) { t = near; b.target = near.id; }
    const d = this.shotDist(b, t);
    if (d <= b.range && b.cd <= 0) {
      b.cd = b.cooldown;
      b.swing = this.time; b.swingA = Math.atan2(t.y - b.y, t.x - b.x);
      this.shoot(b, "arrow", t, 11);
      if (b.rank >= 4) {
        const t2 = this.nearestEnemy(b, { max: b.range, taunt: false, filter: (e) => e !== t }) ?? t;
        this.shoot(b, "arrow", t2, 11);
      }
    }
    // Melee on its heels: break away at full gallop.
    const chaser = this.nearestEnemy(b, { max: 1.3 + b.radius, taunt: false, filter: (e) => isMeleeKind(e.kind) });
    if (chaser) return this.flee(b, chaser, 1);
    if (d > b.range * 0.95) return this.seek(b, t.x, t.y, 1, 0.3);
    // Circle: aim for a point a little way round the ring; flip direction off a wall.
    const ring = b.range * 0.8;
    const a = Math.atan2(b.y - t.y, b.x - t.x) + b.hand * 0.8;
    const px = t.x + Math.cos(a) * ring, py = t.y + Math.sin(a) * ring;
    const m = 0.6;
    if ((px < m || px > W - m || py < m || py > H - m) && b.aux <= 0) { b.hand = -b.hand; b.aux = 1.2; }
    return this.seek(b, clamp(px, m, W - m), clamp(py, m, H - m), 0.85, 0.3);
  }

  /** Lantern wards on the allies under the most pressure; plinks with sparks between casts (Beacon: four wards that burst when broken). */
  private actLamp(b: Body): [number, number] {
    const threat = this.nearestEnemy(b, { taunt: false });
    if (b.cd <= 0 && threat) {
      const n = b.rank >= 4 ? 4 : 2;
      const picks: { a: Body; s: number }[] = [];
      const pool = this.allies(b).filter((a) => !a.structure && !a.burrowed && a.ward <= 0 && this.sees(b, a));
      if (!pool.length && b.ward <= 0) pool.push(b);
      for (const a of pool) {
        const d = this.dist(b, a);
        if (d > b.range + 1.2) continue;
        let danger = 0;
        for (const e of this.bodies) if (this.targetable(b, e)) { const de = this.dist(a, e); if (de < 3.5) danger += 1 / (de + 0.5); }
        if (danger < 0.2) continue;
        picks.push({ a, s: danger + (1 - a.hp / a.maxHp) - (isSpawn(a.kind) ? 0.6 : 0) });
      }
      picks.sort((p, q) => q.s - p.s || p.a.id - q.a.id);
      const chosen = picks.slice(0, n);
      if (chosen.length) {
        b.cd = b.cooldown;
        b.swing = this.time; b.swingA = Math.atan2(chosen[0].a.y - b.y, chosen[0].a.x - b.x);
        const amt = WARD_HP * rankDmg(b.rank) * b.healMul;
        for (const { a } of chosen) {
          a.ward = amt; a.wardT = WARD_TIME; a.wardBurst = b.rank >= 4;
          this.emit({ t: "ward", id: a.id, from: b.id, x: a.x, y: a.y, amt: Math.round(amt) });
        }
      } else b.cd = 0.3;
    }
    if (threat && b.aux <= 0 && this.shotDist(b, threat) <= b.range) {
      b.aux = 1.3;
      b.face = Math.atan2(threat.y - b.y, threat.x - b.x);
      this.shoot(b, "pellet", threat, 9);
    }
    if (threat && this.gap(b, threat) < 1.5) return this.flee(b, threat, 1);
    return this.hangBack(b, undefined, 1.4, threat);
  }

  // ------------------------------------------------------------ projectiles
  private newProj(kind: ProjKind, b: Body, vx: number, vy: number): Proj {
    const p: Proj = {
      id: this.nextId++, kind, side: b.side,
      x: b.x + Math.cos(b.face) * b.radius, y: b.y + Math.sin(b.face) * b.radius, px: b.x, py: b.y,
      vx, vy, x0: b.x, y0: b.y, tx: 0, ty: 0, target: -1, dmg: b.dmg, t: 0, life: 2, z: 0, hits: [], owner: b.id, rank: b.rank, alive: true, fx: "", over: false,
    };
    p.px = p.x; p.py = p.y;
    if (this.brushOn) this.expose(b);
    this.projs.push(p);
    this.emit({ t: "shot", id: b.id, kind, x: p.x, y: p.y });
    return p;
  }
  private shoot(b: Body, kind: ProjKind, t: Body, speed: number): Proj {
    const a = Math.atan2(t.y - b.y, t.x - b.x);
    const p = this.newProj(kind, b, Math.cos(a) * speed, Math.sin(a) * speed);
    p.target = t.id;
    p.life = 1.2;
    p.over = t.flying;
    return p;
  }
  private lob(b: Body, tx: number, ty: number, flight: number, kind: "grenade" | "shell"): Proj {
    // A lob aimed into a wall or building comes down beside it instead of on the roof.
    if (this.nav && this.nav.inShot(tx, ty)) [tx, ty] = this.freeAt(tx, ty, 0.05);
    const p = this.newProj(kind, b, 0, 0);
    p.x0 = p.x; p.y0 = p.y; p.tx = tx; p.ty = ty; p.life = flight;
    return p;
  }
  /** Where a direct shot's move this step meets a wall, building or barricade: the shot is put there and the block's
   * index returned (-1 when the way is clear, or the shot flies over). */
  private wallStop(p: Proj, x0: number, y0: number): number {
    if (p.over) return -1;
    const k = this.nav!.shotHit(x0, y0, p.x, p.y);
    if (k >= 0) { p.x = this.nav!.hx; p.y = this.nav!.hy; }
    return k;
  }
  /** A direct shot stops on a block (and wears it down if it can break). */
  private wallHit(p: Proj, k: number) {
    p.alive = false;
    this.emit({ t: "ricochet", x: p.x, y: p.y, kind: p.kind, block: this.blocks[k].id });
    this.hitBlock(k, p.dmg, p.x, p.y);
  }
  /** Cover: a direct shot that crosses a cover block close in front of its target keeps COVER_KEEP of its damage,
   * and what the cover soaks comes off the cover. Returns the damage multiplier. */
  private cover(p: Proj, e: Body): number {
    const nav = this.nav;
    if (!nav || e.flying) return 1;
    const k = nav.coverFor(p.x0, p.y0, e.x, e.y, COVER_REACH);
    if (k < 0) return 1;
    this.hitBlock(k, p.dmg * (1 - COVER_KEEP), nav.hx, nav.hy);
    return COVER_KEEP;
  }
  private land(p: Proj) {
    if (p.kind === "shell") {
      this.explode(p.tx, p.ty, 1.2, p.dmg, p.side, "shell", 2.4, 0.3);
      if (p.fx === "shrapnel") this.scatter(p.tx, p.ty, 4, 1.0, Math.PI / 4, 0.25, 0.55, p.dmg * 0.35, p.side, "shrapnel");
      return;
    }
    this.explode(p.tx, p.ty, 0.95, p.dmg, p.side, "grenade", 1.6, 0.2);
    if (p.fx === "fire") {
      const z: Zone = { id: this.nextId++, kind: "fire", x: p.tx, y: p.ty, r: 0.95, side: p.side, until: this.time + 3, dps: p.dmg * 0.18, tick: 0.25 };
      this.zones.push(z);
      this.emit({ t: "zone", id: z.id, x: z.x, y: z.y, r: z.r, until: z.until, side: z.side, kind: "fire" });
    }
  }
  private stepProjectiles(dt: number) {
    for (const p of this.projs) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.kind === "grenade" || p.kind === "shell") {
        const u = Math.min(1, p.t / p.life);
        p.x = p.x0 + (p.tx - p.x0) * u;
        p.y = p.y0 + (p.ty - p.y0) * u;
        p.z = 4 * (p.kind === "shell" ? 3.2 : 1.4) * u * (1 - u);
        if (u >= 1) { p.alive = false; this.land(p); }
        continue;
      }
      if (p.kind === "arrow" || p.kind === "shard" || p.kind === "pellet") {
        if (p.target < 0) {
          // A stray volley arrow: straight, stops in the first enemy on its line.
          const x0 = p.x, y0 = p.y;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const wall = this.nav ? this.wallStop(p, x0, y0) : -1;
          for (const e of this.bodies) {
            if (!this.canTarget(p.side, "ranger", e) || segDist(x0, y0, p.x, p.y, e.x, e.y) >= e.radius + 0.1) continue;
            p.alive = false;
            this.damage(e, p.dmg * this.cover(p, e), { x: x0, y: y0 }, p.side);
            break;
          }
          if (wall >= 0 && p.alive) this.wallHit(p, wall);
          if (p.t > p.life) p.alive = false;
          continue;
        }
        const t = this.byId(p.target);
        if (t && t.alive) {
          const a = Math.atan2(t.y - p.y, t.x - p.x), s = hyp(p.vx, p.vy);
          p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
        }
        const x0 = p.x, y0 = p.y;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (this.nav && !p.over) {
          const k = this.nav.shotHit(x0, y0, p.x, p.y);
          // The wall stops it, unless its target stands nearer than the wall.
          if (k >= 0 && !(t && t.alive && hyp(t.x - x0, t.y - y0) - t.radius - 0.1 <= hyp(this.nav.hx - x0, this.nav.hy - y0))) {
            p.x = this.nav.hx; p.y = this.nav.hy;
            this.wallHit(p, k);
            continue;
          }
        }
        if (t && t.alive && this.dist(p, t) < t.radius + 0.1) {
          p.alive = false;
          const dealt = this.damage(t, p.dmg * this.cover(p, t), { x: p.px, y: p.py }, p.side);
          if (p.kind === "shard" && dealt > 0 && t.alive) {
            this.chill(t, 2);
            if (p.fx === "freeze") this.freeze(t, 1.5);
          }
        }
        if (p.t > p.life) p.alive = false;
        continue;
      }
      // bolt: straight, pierces; tests the segment covered this step.
      const x0 = p.x, y0 = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const wall = this.nav ? this.wallStop(p, x0, y0) : -1;
      for (const e of this.bodies) {
        if (!this.canTarget(p.side, "ballista", e) || p.hits.includes(e.id)) continue;
        if (segDist(x0, y0, p.x, p.y, e.x, e.y) < e.radius + 0.1) {
          p.hits.push(e.id);
          this.damage(e, p.dmg * this.cover(p, e), { x: x0, y: y0 }, p.side);
          this.push(e, p.vx / 14, p.vy / 14, 1.0, 0.1);
        }
      }
      if (wall >= 0) this.wallHit(p, wall);
      if (p.t > p.life || p.x < 0 || p.x > W || p.y < 0 || p.y > H) p.alive = false;
    }
    if (this.projs.length > 64) this.projs = this.projs.filter((p) => p.alive);
  }

  // ------------------------------------------------------------ legendaries
  /**
   * Griffin Knight: soars over the fight onto their back line (only shots and spells reach it up there), lands with a
   * stunning swoop, then fights low on the wing where swords reach it too.
   * Second Dive (Ascended): the first time it drops below half health it climbs and dives again.
   */
  private actGriffin(b: Body, dt: number): [number, number] {
    if (b.rank >= 4 && !b.once && b.state === "fight" && b.hp < b.maxHp * 0.5) {
      b.once = true;
      b.state = "soar"; b.t = 0; b.target = -1; b.flying = true;
      this.emit({ t: "soar", id: b.id, x: b.x, y: b.y, side: b.side, second: true });
    }
    if (b.state === "soar") {
      let t = this.byId(b.target);
      if (!t || !this.targetable(b, t) || t.flying) { t = this.diveMark(b); b.target = t ? t.id : -1; }
      if (!t) { b.state = "fight"; b.t = 0; b.flying = false; this.settle(b); return [0, 0]; }
      const d = this.dist(b, t);
      // High over the fight, then down onto the mark over the last stretch.
      b.z = Math.max(0.2, Math.min(Math.min(1.5, b.z + dt * 2.5), (d - t.radius) * 0.6 + 0.2));
      if (d <= b.radius + t.radius + 0.15 || b.t > 7) { this.swoop(b, t); return [b.vx * 0.3, b.vy * 0.3]; }
      return this.seek(b, t.x, t.y, 1.35, 0.05);
    }
    b.z += Math.sign(0.6 - b.z) * Math.min(Math.abs(0.6 - b.z), dt * 2);
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || b.aux <= 0) {
      b.aux = 1.0;
      t = this.nearestEnemy(b, { taunt: false });
      b.target = t ? t.id : -1;
    }
    if (!t) return [0, 0];
    if (this.gap(b, t) <= b.range + 0.05 && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, t, b.dmg); }
    // Hover at the foe's edge (flyers don't collide, so it keeps its own spot rather than sitting on top).
    const d = this.dist(b, t) || 0.001;
    const r = b.radius + t.radius + 0.05;
    return this.seek(b, t.x + ((b.x - t.x) / d) * r, t.y + ((b.y - t.y) / d) * r, 1, 0.3);
  }
  /** The ground foe deepest in their back line, weighted to support and shooters and to where they bunch. */
  private diveMark(b: Body): Body | undefined {
    let best: Body | undefined, bs = -Infinity;
    for (const e of this.bodies) {
      if (!this.targetable(b, e) || e.flying || e.kind === "mine" || e.kind === "decoy") continue;
      let near = 0;
      for (const o of this.bodies) if (o !== e && this.targetable(b, o) && !o.flying && hyp(o.x - e.x, o.y - e.y) <= SWOOP_R) near++;
      const s = (ROLE_BACKLINE.has(e.kind) ? 2 : 0) - toLocal(e.side, e.x, e.y).depth * 0.35 + near * 0.4 - this.dist(b, e) * 0.05;
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }
  private swoop(b: Body, t: Body) {
    const second = b.once;
    this.emit({ t: "swoop", id: b.id, x: t.x, y: t.y, r: SWOOP_R, side: b.side, second });
    this.emit({ t: "boom", x: t.x, y: t.y, r: SWOOP_R, kind: "swoop", side: b.side });
    b.swing = this.time; b.swingA = Math.atan2(t.y - b.y, t.x - b.x);
    for (const e of this.enemiesNear(b.side, t.x, t.y, SWOOP_R)) {
      this.damage(e, e === t ? b.dmg * 1.5 : b.dmg * 0.6, { x: t.x, y: t.y }, b.side, true);
      if (e.alive && !e.structure) e.stun = Math.max(e.stun, SWOOP_STUN);
    }
    // Down among them now: it fights low, on the wing but in reach of swords and blasts.
    b.state = "fight"; b.t = 0; b.cd = b.cooldown; b.aux = 1.0; b.flying = false;
    this.settle(b, t);
    b.target = t.alive ? t.id : -1;
  }

  /** Tidecaller: from behind the line, rolls a wave down the most crowded lane ahead, shoving foes back (Riptide: slowing surf). */
  private actTide(b: Body): [number, number] {
    const near = this.nearestEnemy(b, { taunt: false });
    if (!near) return [0, 0];
    const dir = fwd(b.side);
    if (b.cd <= 0) {
      let bx = -1, bs = 0.99;
      for (let cx = 0.9; cx <= W - 0.9 + 1e-6; cx += 0.45) {
        let s = 0;
        for (const e of this.bodies) {
          if (!this.targetable(b, e) || e.flying || e.kind === "mine") continue;
          const ahead = (e.y - b.y) * dir;
          if (ahead < -0.3 || ahead > WAVE_LEN || Math.abs(e.x - cx) > WAVE_W / 2 + e.radius * 0.5) continue;
          if (this.nav && !this.nav.los(e.x, b.y, e.x, e.y)) continue; // sheltered behind a wall down the lane
          s += isSpawn(e.kind) ? 0.5 : 1;
        }
        s -= Math.abs(cx - b.x) * 0.04;
        if (s > bs) { bs = s; bx = cx; }
      }
      if (bx >= 0) {
        b.cd = b.cooldown;
        b.face = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        b.swing = this.time; b.swingA = b.face;
        const y1 = clamp(b.y + dir * WAVE_LEN, 0.2, H - 0.2);
        const w: Wave = { id: this.nextId++, side: b.side, x: bx, y: b.y, y0: b.y, y1, dir, w: WAVE_W, speed: WAVE_SPEED, dmg: b.dmg, hits: [], surf: b.rank >= 4, nextSurf: b.y + dir * 0.8, done: false };
        this.waves.push(w);
        this.emit({ t: "wave", id: w.id, from: b.id, x: w.x, y0: w.y0, y1: w.y1, w: w.w, dur: Math.abs(y1 - b.y) / WAVE_SPEED, side: b.side, surf: w.surf });
      }
    }
    const dn = this.gap(b, near);
    if (dn < 1.6) return this.flee(b, near, 0.9);
    if (dn > 3.6 || !this.sees(b, near)) return this.seek(b, near.x, near.y, 0.9, 0.4);
    return [0, 0];
  }
  private stepWaves(dt: number) {
    for (const w of this.waves) {
      const y0 = w.y;
      w.y += w.dir * w.speed * dt;
      if ((w.y1 - w.y) * w.dir <= 0) { w.y = w.y1; w.done = true; }
      const span = (w.y - y0) * w.dir;
      for (const e of this.bodies) {
        if (!e.alive || e.side === w.side || e.kind === "mine" || e.burrowed || e.flying || w.hits.includes(e.id)) continue;
        if (Math.abs(e.x - w.x) > w.w / 2 + e.radius * 0.5) continue;
        const a = (e.y - y0) * w.dir;
        if (a < -e.radius - 0.3 || a > span + e.radius) continue;
        w.hits.push(e.id);
        if (this.nav && !this.nav.los(e.x, w.y0, e.x, e.y)) continue; // the wave broke on a wall before reaching it
        this.damage(e, w.dmg, { x: e.x, y: e.y - w.dir }, w.side, true);
        this.push(e, 0, w.dir, WAVE_PUSH, 0.35);
      }
      if (w.surf) while ((w.y - w.nextSurf) * w.dir >= 0) {
        const z: Zone = { id: this.nextId++, kind: "surf", x: w.x, y: w.nextSurf, r: 0.8, side: w.side, until: this.time + SURF_TIME, dps: 0, tick: 0 };
        this.zones.push(z);
        this.emit({ t: "zone", id: z.id, x: z.x, y: z.y, r: z.r, until: z.until, side: z.side, kind: "surf" });
        w.nextSurf += w.dir * 1.2;
      }
    }
    this.waves = this.waves.filter((w) => !w.done);
  }

  /** Lionheart: a front-line hero. Each kill rallies allies close by (attacks 25% faster) and heals him. */
  private actLion(b: Body): [number, number] {
    let t = this.byId(b.target);
    if (!t || !this.targetable(b, t) || b.aux <= 0) {
      b.aux = 1.0;
      t = this.nearestEnemy(b);
      b.target = t ? t.id : -1;
    }
    if (!t) return [0, 0];
    const hit = this.gap(b, t) <= b.range ? t : this.nearestEnemy(b, { max: b.range + b.radius, taunt: false });
    if (hit && b.cd <= 0) { b.cd = b.cooldown; this.melee(b, hit, b.dmg); }
    return this.seek(b, t.x, t.y, 1, 0.3);
  }
  private lionRally(b: Body, small: boolean) {
    this.heal(b, b, b.maxHp * (small ? 0.04 : 0.1) * b.healMul);
    let n = 0;
    for (const a of this.bodies) {
      if (!a.alive || a.side !== b.side || a.kind === "mine" || a.kind === "decoy" || a.burrowed || this.dist(a, b) > RALLY_R + a.radius) continue;
      a.buff = Math.max(a.buff, RALLY_TIME);
      n++;
    }
    this.emit({ t: "rally", id: b.id, x: b.x, y: b.y, r: RALLY_R, side: b.side, n });
  }
}

function segDist(x0: number, y0: number, x1: number, y1: number, px: number, py: number) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  const u = l2 > 0 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
  return hyp(px - (x0 + dx * u), py - (y0 + dy * u));
}

export function simulate(pieces: Piece[], opts: BattleOptions = {}): BattleResult {
  return new Battle(pieces, { ...opts, events: false }).run();
}
