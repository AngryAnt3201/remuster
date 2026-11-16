// Bastion: the tower-defence run. Enemies march waves down the map's roads (flyers go straight for the keep);
// you place existing units on pads as defenders. Melee defenders step onto the road and block, shooters and
// casters hold their pad and cover it, healers patch the line. Deterministic: fixed DT, one seeded Rng, no clocks.
// Reuses unit stats, rank multipliers, upgrade costs and the air rule from base/src/core; battle.ts is untouched.
import { canHitAir } from "../battle";
import { ASCEND_ROUND, BODY_EXTRA, DT, MAX_RANK, UNITS, rankDmg, rankHp, upgradeCost, type BodyKind, type UnitKind } from "../defs";
import { Rng, hashSeed } from "../rng";
import { getMap, pointAt, type TdMap } from "./maps";
import { BOSS_NAME, WAVE_COUNT, waves, type Wave } from "./waves";

export { DT };
/** Units you can place: one or two from each family that make sense holding a pad. */
export const TD_ROSTER: UnitKind[] = [
  "blades", "pikeman", "bulwark", "duelist", "ravager", "banner",
  "ranger", "outrider", "ballista", "grenadier", "bombard",
  "storm", "rime", "thorn", "medic", "harrier",
];
export type DefMode = "block" | "shoot" | "heal" | "hunt";
export function modeOf(kind: UnitKind): DefMode {
  const r = UNITS[kind].role;
  if (kind === "harrier") return "hunt";
  if (kind === "medic") return "heal";
  if (r === "ranged" || r === "artillery" || r === "caster" || r === "structure") return "shoot";
  return "block";
}

/** Gold prices: the shop cost scaled to wave gold. */
export const GOLD_SCALE = 10;
export const placeCost = (k: UnitKind) => UNITS[k].cost * GOLD_SCALE;
/** In-run rank up, the main game's upgrade rule (cost x rank) in wave gold; Ascending waits for wave ASCEND_ROUND. */
export const rankUpCost = (k: UnitKind, rank: number) => upgradeCost(k, rank) * GOLD_SCALE;
export const SELL_BACK = 0.6;
export const KEEP_HP = 100;
export const BUILD_TIME = 24; // seconds between waves before the next one calls itself
export const LEASH = 2.2; // how far a blocker strays from its rally point
const AIR_Z = 0.6;
/** Defenders hit a little harder than in a duel: they face whole waves alone. */
export const DEF_DMG = 1.5;
/** Arrows into tanks and siege bodies. */
export const ARROW_VS_ARMOUR = 0.55;

export interface Defender {
  id: number; kind: UnitKind; pad: number; rank: number; spent: number;
  x: number; y: number; hx: number; hy: number; // position and guard spot
  hp: number; maxHp: number; cd: number; face: number;
  target: number; // enemy id or -1
  down: boolean; shots: number; swing: number; moving: boolean;
}
export interface Enemy {
  id: number; kind: BodyKind; rank: number; road: number; air: boolean; boss: boolean;
  s: number; // distance along its road (or along the straight flight line)
  lane: number; // sideways offset for a natural spread
  x: number; y: number; hp: number; maxHp: number; speed: number; dmg: number; range: number; radius: number; cd: number; cool: number;
  block: number; // defender id or -1
  slow: number; slowT: number; frozen: number; spawnT: number; face: number; swing: number; bounty: number; leak: number;
  fx: number; fy: number; // flyer start
}
export interface Shot { id: number; kind: UnitKind | BodyKind; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; target: number; dmg: number; splash: number; enemy: boolean; slow: number; pierce: boolean; z: number; }
export interface Zone { x: number; y: number; r: number; dps: number; until: number; slow: number; kind: "fire" | "thorn"; }
export type TdEvent =
  | { t: "hit"; x: number; y: number; air: boolean; enemy: boolean }
  | { t: "boom"; x: number; y: number; r: number }
  | { t: "zap"; pts: [number, number][] }
  | { t: "heal"; x: number; y: number }
  | { t: "die"; x: number; y: number; kind: BodyKind; enemy: boolean; air: boolean; face: number; rank: number }
  | { t: "leak"; dmg: number }
  | { t: "gold"; x: number; y: number; n: number }
  | { t: "wave"; n: number; boss: boolean }
  | { t: "cleared"; n: number; bonus: number };

export type Phase = "build" | "wave" | "won" | "lost";

export interface TdSnapshot { phase: Phase; wave: number; gold: number; keepHp: number; time: number; stars: number; leaked: number; kills: number; }

export class TdRun {
  readonly map: TdMap;
  readonly waves: Wave[];
  readonly rng: Rng;
  phase: Phase = "build";
  /** Waves started so far (1-based number of the current or last wave). */
  wave = 0;
  gold: number;
  keepHp = KEEP_HP;
  time = 0;
  /** Seconds left in the build phase before the next wave calls itself (Infinity before wave 1). */
  countdown = Infinity;
  defenders: Defender[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  zones: Zone[] = [];
  events: TdEvent[] = [];
  kills = 0;
  leaked = 0;
  earlyBonus = 0;
  private nextId = 1;
  private queue: { at: number; kind: UnitKind; road: number; boss: boolean }[] = [];
  private waveT = 0;

  constructor(mapId: string, seed = 1) {
    this.map = getMap(mapId);
    this.waves = waves(this.map.paths.length);
    this.rng = new Rng(hashSeed("bastion", mapId, seed));
    this.gold = this.map.startGold;
  }

  get waveCount() { return WAVE_COUNT; }
  defenderAt(pad: number) { return this.defenders.find((d) => d.pad === pad); }
  /** The bonus for calling the next wave now. */
  callBonus(): number { return this.phase === "build" && this.wave > 0 && Number.isFinite(this.countdown) ? Math.floor(this.countdown * 0.8) : 0; }
  canAscend() { return this.wave + 1 >= ASCEND_ROUND; }
  stars(): number { return this.phase !== "won" ? 0 : this.keepHp >= KEEP_HP * 0.8 ? 3 : this.keepHp >= KEEP_HP * 0.4 ? 2 : 1; }
  snapshot(): TdSnapshot { return { phase: this.phase, wave: this.wave, gold: this.gold, keepHp: this.keepHp, time: +this.time.toFixed(3), stars: this.stars(), leaked: this.leaked, kills: this.kills }; }

  // ------------------------------------------------------------ commands
  place(pad: number, kind: UnitKind): Defender | null {
    const p = this.map.pads[pad];
    if (!p || this.defenderAt(pad) || this.phase === "won" || this.phase === "lost" || !TD_ROSTER.includes(kind)) return null;
    const cost = placeCost(kind);
    if (this.gold < cost) return null;
    this.gold -= cost;
    const block = modeOf(kind) === "block" || modeOf(kind) === "hunt";
    const hx = block ? p.rally.x : p.x, hy = block ? p.rally.y : p.y;
    const d: Defender = { id: this.nextId++, kind, pad, rank: 1, spent: cost, x: hx, y: hy, hx, hy, hp: 0, maxHp: 0, cd: 0.3, face: Math.PI / 2, target: -1, down: false, shots: 0, swing: -1, moving: false };
    this.refit(d, true);
    this.defenders.push(d);
    return d;
  }
  upgrade(id: number): boolean {
    const d = this.defenders.find((x) => x.id === id);
    if (!d || d.rank >= MAX_RANK || (d.rank === 3 && !this.canAscend())) return false;
    const cost = rankUpCost(d.kind, d.rank);
    if (this.gold < cost) return false;
    this.gold -= cost;
    d.spent += cost;
    d.rank++;
    this.refit(d, false);
    return true;
  }
  sell(id: number): number {
    const i = this.defenders.findIndex((x) => x.id === id);
    if (i < 0) return 0;
    const d = this.defenders[i];
    const back = Math.floor(d.spent * SELL_BACK);
    this.gold += back;
    this.defenders.splice(i, 1);
    for (const e of this.enemies) if (e.block === id) e.block = -1;
    return back;
  }
  /** Start the next wave now; calling early (after wave 1) pays the bonus. */
  callWave(): number {
    if (this.phase !== "build" || this.wave >= WAVE_COUNT) return 0;
    const bonus = this.callBonus();
    this.gold += bonus;
    this.earlyBonus += bonus;
    this.startWave();
    return bonus;
  }

  private refit(d: Defender, fresh: boolean) {
    const u = UNITS[d.kind], bodies = u.bodies ?? 1;
    const max = Math.round(u.hp * bodies * rankHp(d.rank) * 1.25);
    d.hp = fresh ? max : Math.min(max, d.hp + (max - d.maxHp));
    d.maxHp = max;
  }

  private startWave() {
    const w = this.waves[this.wave];
    this.wave++;
    this.phase = "wave";
    this.countdown = Infinity;
    this.waveT = 0;
    this.queue = [];
    for (const g of w.groups) {
      const bodies = UNITS[g.kind].bodies ?? 1;
      for (let i = 0; i < g.n; i++) for (let b = 0; b < bodies; b++) this.queue.push({ at: g.at + i * g.gap + b * 0.18, kind: g.kind, road: (g.road ?? 0) % this.map.paths.length, boss: !!g.boss });
    }
    this.queue.sort((a, b) => a.at - b.at);
    this.events.push({ t: "wave", n: this.wave, boss: !!w.boss });
  }

  // ------------------------------------------------------------ enemies
  private spawn(kind: BodyKind, road: number, boss: boolean, s = 0, from?: { x: number; y: number }) {
    const w = this.waves[Math.max(0, this.wave - 1)];
    const isUnit = kind in UNITS;
    const base = isUnit ? UNITS[kind as UnitKind] : BODY_EXTRA[kind as keyof typeof BODY_EXTRA];
    const rank = boss ? 4 : w.rank;
    const air = kind === "harrier";
    const hpMul = w.hpMul * (boss ? 4.5 : 1) * (air ? 0.8 : 1);
    const hp = Math.round(base.hp * rankHp(rank) * hpMul);
    const cost = isUnit ? UNITS[kind as UnitKind].cost : 1;
    const gate = this.map.gates[road] ?? this.map.gates[0];
    const e: Enemy = {
      id: this.nextId++, kind, rank, road, air, boss, s, lane: this.rng.range(-0.32, 0.32),
      x: from?.x ?? gate.x, y: from?.y ?? gate.y, hp, maxHp: hp,
      speed: Math.max(1.15, Math.min(3.2, base.speed)) * (boss ? 0.75 : 1),
      dmg: base.dmg * rankDmg(rank) * (boss ? 2.2 : 1) * (1 + 0.03 * this.wave), range: base.range, radius: base.radius * (boss ? 1.6 : 1),
      cd: Math.max(0.8, base.cooldown || 1.1), cool: this.rng.range(0.2, 0.8), block: -1, slow: 1, slowT: 0, frozen: 0, spawnT: 2.5, face: Math.PI / 2, swing: -1,
      bounty: isUnit ? cost * 2 + Math.floor(this.wave / 3) + (boss ? 150 : 0) : 1,
      leak: boss ? 60 : Math.max(2, (isUnit ? UNITS[kind as UnitKind].threat : 1) * 2),
      fx: from?.x ?? gate.x, fy: from?.y ?? gate.y,
    };
    this.enemies.push(e);
    return e;
  }

  private moveEnemy(e: Enemy, dt: number) {
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 1; }
    if (e.frozen > 0) { e.frozen -= dt; return; }
    if (e.block >= 0) return;
    let slow = e.slow;
    for (const z of this.zones) if (z.slow < 1 && !e.air && Math.hypot(z.x - e.x, z.y - e.y) < z.r) slow = Math.min(slow, z.slow);
    const v = e.speed * slow * dt;
    if (e.air) {
      const k = this.map.keep, dx = k.x - e.fx, dy = k.y - 0.6 - e.fy, L = Math.hypot(dx, dy) || 1;
      e.s += v;
      const t = Math.min(1, e.s / L);
      e.x = e.fx + dx * t + (-dy / L) * e.lane * 2;
      e.y = e.fy + dy * t + (dx / L) * e.lane * 2;
      e.face = Math.atan2(dy, dx);
      if (e.s >= L) this.leak(e);
      return;
    }
    const path = this.map.paths[e.road];
    e.s += v;
    const p = pointAt(path, e.s);
    const px = p.x - p.dy * e.lane, py = p.y + p.dx * e.lane;
    if (Math.abs(px - e.x) + Math.abs(py - e.y) > 1e-4) e.face = Math.atan2(py - e.y, px - e.x);
    e.x = px; e.y = py;
    if (e.s >= path.len) this.leak(e);
  }

  private leak(e: Enemy) {
    e.hp = 0;
    this.keepHp = Math.max(0, this.keepHp - e.leak);
    this.leaked++;
    this.events.push({ t: "leak", dmg: e.leak });
  }

  private hurtEnemy(e: Enemy, dmg: number, slow = 0) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    if (slow > 0) { e.slow = Math.min(e.slow, 1 - slow); e.slowT = 1.6; }
    this.events.push({ t: "hit", x: e.x, y: e.y, air: e.air, enemy: true });
    if (e.hp <= 0) this.killEnemy(e);
  }
  private killEnemy(e: Enemy) {
    this.kills++;
    this.gold += e.bounty;
    this.events.push({ t: "die", x: e.x, y: e.y, kind: e.kind, enemy: true, air: e.air, face: e.face, rank: e.rank });
    this.events.push({ t: "gold", x: e.x, y: e.y, n: e.bounty });
    // The Colossus breaks into shardlings, like it does in battle.
    if (e.kind === "golem") for (const side of [-1, 1]) {
      const c = this.spawn("golemling", e.road, false, Math.max(0, e.s - 0.3), { x: e.x, y: e.y });
      c.lane = side * 0.3; c.x = e.x + side * 0.3;
      if (e.boss) { c.hp = c.maxHp = c.maxHp * 4; c.radius *= 1.2; }
    }
  }

  // ------------------------------------------------------------ defenders
  private dmgOf(d: Defender) {
    const u = UNITS[d.kind];
    const banner = this.defenders.some((b) => b.kind === "banner" && !b.down && b !== d && Math.hypot(b.x - d.x, b.y - d.y) < 2.6);
    return u.dmg * (u.bodies ?? 1) * rankDmg(d.rank) * DEF_DMG * (banner ? 1.15 : 1);
  }
  private cdOf(d: Defender) {
    const u = UNITS[d.kind];
    const banner = this.defenders.some((b) => b.kind === "banner" && !b.down && b !== d && Math.hypot(b.x - d.x, b.y - d.y) < 2.6);
    return Math.max(0.6, u.cooldown || 1) * (banner ? 0.8 : 1);
  }
  private reachOf(d: Defender) {
    const u = UNITS[d.kind], m = modeOf(d.kind);
    return m === "shoot" ? u.range * 1.05 + 0.35 : u.range + u.radius + 0.35;
  }
  private blockCap(d: Defender) {
    const u = UNITS[d.kind];
    const base = u.role === "tank" ? 2 : u.bodies ? 2 : 1;
    return base + (d.rank >= 3 ? 1 : 0) + (d.kind === "bulwark" && d.rank >= 4 ? 2 : 0);
  }

  private stepDefender(d: Defender, dt: number) {
    if (d.down) return;
    d.cd -= dt;
    if (d.swing >= 0) { d.swing += dt / 0.4; if (d.swing >= 1) d.swing = -1; }
    const m = modeOf(d.kind);
    if (m === "heal") return this.stepHealer(d);
    if (m === "shoot") return this.stepShooter(d);
    // Blockers and the hunter: hold the road near the guard spot.
    let t = this.enemies.find((e) => e.id === d.target && e.hp > 0);
    const air = m === "hunt";
    const ok = (e: Enemy) => e.hp > 0 && (air || !e.air) && Math.hypot(e.x - d.hx, e.y - d.hy) < LEASH;
    if (t && !ok(t)) { if (t.block === d.id) t.block = -1; t = undefined; }
    if (!t) {
      let best: Enemy | undefined, bs = Infinity;
      for (const e of this.enemies) {
        if (!ok(e)) continue;
        const free = e.block < 0 || e.block === d.id;
        const sc = Math.hypot(e.x - d.x, e.y - d.y) + (free ? 0 : 3) - e.s * 0.01;
        if (sc < bs) { bs = sc; best = e; }
      }
      t = best;
    }
    d.target = t ? t.id : -1;
    const reach = this.reachOf(d);
    if (!t) {
      // Back to the guard spot.
      const dx = d.hx - d.x, dy = d.hy - d.y, L = Math.hypot(dx, dy);
      d.moving = L > 0.05;
      if (d.moving) { const v = Math.min(L, UNITS[d.kind].speed * 1.2 * dt); d.x += (dx / L) * v; d.y += (dy / L) * v; d.face = Math.atan2(dy, dx); }
      return;
    }
    const dx = t.x - d.x, dy = t.y - d.y, L = Math.hypot(dx, dy);
    d.face = Math.atan2(dy, dx);
    if (L > reach + t.radius) {
      d.moving = true;
      const v = Math.min(L - reach * 0.8, Math.max(1.4, UNITS[d.kind].speed) * 1.2 * dt);
      d.x += (dx / L) * v; d.y += (dy / L) * v;
      return;
    }
    d.moving = false;
    // In reach: hold it (if this defender still has room) and strike.
    if (!air && !t.air && t.block < 0) {
      const holding = this.enemies.filter((e) => e.block === d.id && e.hp > 0).length;
      if (holding < this.blockCap(d)) t.block = d.id;
    }
    if (d.cd <= 0) {
      d.cd = this.cdOf(d);
      d.swing = 0;
      d.shots++;
      let dmg = this.dmgOf(d);
      if (d.kind === "duelist" && isMeleeEnemy(t)) dmg *= 1.3;
      if (d.kind === "ravager" && t.maxHp > 300) dmg *= 1.3;
      if (d.kind === "ravager" && d.rank >= 4) d.hp = Math.min(d.maxHp, d.hp + dmg * 0.2);
      // Blade Trio Whirlwind and Pikeman reach: hit the others it holds too.
      const sweep = (d.kind === "blades" && (d.rank >= 4 ? d.shots % 3 === 0 : false)) || d.kind === "pikeman";
      if (sweep) for (const e of this.enemies) if (e !== t && e.hp > 0 && !e.air && Math.hypot(e.x - d.x, e.y - d.y) < reach + 0.4) this.hurtEnemy(e, dmg * 0.5);
      this.hurtEnemy(t, dmg);
    }
  }

  private stepShooter(d: Defender) {
    const reach = this.reachOf(d);
    const air = canHitAir(d.kind);
    const minR = d.kind === "bombard" ? 1.6 : 0;
    // Target the enemy furthest down its road (closest to the keep) in reach.
    let best: Enemy | undefined, bs = -Infinity;
    for (const e of this.enemies) {
      if (e.hp <= 0 || (e.air && !air)) continue;
      const L = Math.hypot(e.x - d.x, e.y - d.y);
      if (L > reach || L < minR) continue;
      const sc = e.s + (e.boss ? 5 : 0) - (e.block >= 0 ? 0 : 0);
      if (sc > bs) { bs = sc; best = e; }
    }
    d.target = best ? best.id : -1;
    if (!best) return;
    d.face = Math.atan2(best.y - d.y, best.x - d.x);
    if (d.cd > 0) return;
    d.cd = this.cdOf(d);
    d.swing = 0;
    d.shots++;
    const dmg = this.dmgOf(d);
    const k = d.kind, asc = d.rank >= 4;
    const L = Math.hypot(best.x - d.x, best.y - d.y);
    const fire = (t: Enemy, mul = 1, extra: Partial<Shot> = {}) => this.shots.push({
      id: this.nextId++, kind: k, x0: d.x, y0: d.y, x1: t.x, y1: t.y, t: 0, dur: Math.max(0.12, L / (k === "grenadier" || k === "bombard" ? 6 : k === "thorn" ? 9 : 16)),
      target: t.id, dmg: dmg * mul, splash: 0, enemy: false, slow: 0, pierce: false, z: t.air ? AIR_Z : 0, ...extra,
    });
    if (k === "storm") {
      // Chain lightning, resolved at once.
      const hit: Enemy[] = [best];
      const jumps = 2 + (asc ? 3 : 0);
      for (let j = 0; j < jumps; j++) {
        const last = hit[hit.length - 1];
        let nb: Enemy | undefined, nd = 2.4;
        for (const e of this.enemies) if (e.hp > 0 && !hit.includes(e) && Math.hypot(e.x - last.x, e.y - last.y) < nd) { nd = Math.hypot(e.x - last.x, e.y - last.y); nb = e; }
        if (!nb) break;
        hit.push(nb);
      }
      this.events.push({ t: "zap", pts: [[d.x, d.y], ...hit.map((e) => [e.x, e.y] as [number, number])] });
      hit.forEach((e, i) => { this.hurtEnemy(e, dmg * Math.pow(0.75, i)); if (asc) e.frozen = Math.max(e.frozen, 0.3); });
      return;
    }
    if (k === "grenadier") return void fire(best, 1, { splash: 1.1, x1: best.x, y1: best.y });
    if (k === "bombard") return void fire(best, 1, { splash: asc ? 1.9 : 1.4 });
    if (k === "thorn") return void fire(best, 1, { splash: asc ? 1.5 : 1.1 });
    if (k === "rime") return void fire(best, 1, { slow: 0.4 });
    if (k === "ballista") {
      fire(best, 1, { pierce: true });
      if (asc) fire(best, 0.8, { pierce: true });
      return;
    }
    // Ranger Volley / Outrider Running Fire: extra arrows at other foes.
    const extra = (k === "ranger" && asc && d.shots % 4 === 0) ? 2 : (k === "outrider" && asc) ? 1 : 0;
    fire(best);
    if (extra) {
      const others = this.enemies.filter((e) => e !== best && e.hp > 0 && (!e.air || air) && Math.hypot(e.x - d.x, e.y - d.y) < reach).slice(0, extra);
      for (const o of others) fire(o);
    }
  }

  private stepHealer(d: Defender) {
    const reach = 2.8;
    if (d.cd > 0) return;
    let best: Defender | undefined, bf = 0.97;
    for (const o of this.defenders) {
      if (o.down || o.hp >= o.maxHp) continue;
      if (Math.hypot(o.x - d.x, o.y - d.y) > reach) continue;
      const f = o.hp / o.maxHp;
      if (f < bf) { bf = f; best = o; }
    }
    if (!best) return;
    d.cd = this.cdOf(d) * 1.2;
    d.swing = 0;
    const amt = 26 * rankDmg(d.rank);
    best.hp = Math.min(best.maxHp, best.hp + amt);
    this.events.push({ t: "heal", x: best.x, y: best.y });
  }

  private hurtDefender(d: Defender, dmg: number) {
    if (d.down) return;
    // Pikeman Hedgehog: throws back part of the harm (reflection handled by the caller's enemy).
    d.hp -= dmg;
    this.events.push({ t: "hit", x: d.x, y: d.y, air: false, enemy: false });
    if (d.hp <= 0) {
      d.hp = 0;
      d.down = true;
      d.target = -1;
      this.events.push({ t: "die", x: d.x, y: d.y, kind: d.kind, enemy: false, air: false, face: d.face, rank: d.rank });
      for (const e of this.enemies) if (e.block === d.id) e.block = -1;
    }
  }

  private stepEnemyAttack(e: Enemy, dt: number) {
    e.cool -= dt;
    if (e.swing >= 0) { e.swing += dt / 0.4; if (e.swing >= 1) e.swing = -1; }
    if (e.frozen > 0 || e.air) return;
    // Spawners drop their brood as they walk.
    if (e.kind === "hive" || e.kind === "grave") {
      e.spawnT -= dt;
      if (e.spawnT <= 0) {
        e.spawnT = e.kind === "hive" ? 2.6 : 3.4;
        const c = this.spawn(e.kind === "hive" ? "mite" : "thrall", e.road, false, Math.max(0, e.s - 0.2), { x: e.x, y: e.y });
        c.lane = this.rng.range(-0.3, 0.3);
      }
      return;
    }
    if (e.cool > 0) return;
    let target: Defender | undefined;
    if (e.block >= 0) target = this.defenders.find((d) => d.id === e.block && !d.down);
    else if (e.range >= 2) {
      let bd = e.range + 0.3;
      for (const d of this.defenders) { if (d.down) continue; const L = Math.hypot(d.x - e.x, d.y - e.y); if (L < bd) { bd = L; target = d; } }
    }
    if (!target) return;
    e.cool = e.cd;
    e.swing = 0;
    e.face = Math.atan2(target.y - e.y, target.x - e.x);
    if (e.range >= 2) {
      const L = Math.hypot(target.x - e.x, target.y - e.y);
      this.shots.push({ id: this.nextId++, kind: e.kind, x0: e.x, y0: e.y, x1: target.x, y1: target.y, t: 0, dur: Math.max(0.12, L / 14), target: target.id, dmg: e.dmg, splash: 0, enemy: true, slow: 0, pierce: false, z: 0 });
    } else {
      this.hurtDefender(target, e.dmg);
      if (target.kind === "pikeman" && target.rank >= 4) this.hurtEnemy(e, e.dmg * 0.3);
    }
  }

  private stepShots(dt: number) {
    const keep: Shot[] = [];
    for (const s of this.shots) {
      s.t += dt;
      if (!s.enemy) {
        const t = this.enemies.find((e) => e.id === s.target);
        if (t && t.hp > 0 && !s.splash) { s.x1 = t.x; s.y1 = t.y; }
      }
      if (s.t < s.dur) { keep.push(s); continue; }
      if (s.enemy) {
        const d = this.defenders.find((x) => x.id === s.target);
        if (d) this.hurtDefender(d, s.dmg);
        continue;
      }
      if (s.splash > 0) {
        this.events.push({ t: "boom", x: s.x1, y: s.y1, r: s.splash });
        for (const e of this.enemies) if (e.hp > 0 && !e.air && Math.hypot(e.x - s.x1, e.y - s.y1) < s.splash + e.radius) this.hurtEnemy(e, s.dmg * (e.id === s.target ? 1 : 0.7));
        if (s.kind === "thorn") this.zones.push({ x: s.x1, y: s.y1, r: s.splash, dps: s.dmg * 0.35, until: this.time + 3, slow: 0.45, kind: "thorn" });
        if (s.kind === "grenadier" && this.defenders.some((d) => d.kind === "grenadier" && d.rank >= 4 && Math.hypot(d.x - s.x0, d.y - s.y0) < 0.01)) this.zones.push({ x: s.x1, y: s.y1, r: 1, dps: s.dmg * 0.3, until: this.time + 3, slow: 1, kind: "fire" });
        continue;
      }
      if (s.pierce) {
        const dx = s.x1 - s.x0, dy = s.y1 - s.y0, L = Math.hypot(dx, dy) || 1;
        for (const e of this.enemies) {
          if (e.hp <= 0 || e.air && e.id !== s.target) continue;
          const t = ((e.x - s.x0) * dx + (e.y - s.y0) * dy) / (L * L);
          if (t < 0 || t > 1.35) continue;
          if (Math.abs((e.x - s.x0) * dy - (e.y - s.y0) * dx) / L < 0.45 + e.radius) this.hurtEnemy(e, s.dmg);
        }
        continue;
      }
      const t = this.enemies.find((e) => e.id === s.target);
      if (t) {
        // Armour: tanks and siege bodies shrug off arrows, so a line of archers alone isn't enough.
        const arrow = s.kind === "ranger" || s.kind === "outrider";
        const role = t.kind in UNITS ? UNITS[t.kind as UnitKind].role : "melee";
        this.hurtEnemy(t, s.dmg * (arrow && (role === "tank" || role === "siege" || t.kind === "golemling") ? ARROW_VS_ARMOUR : 1), s.slow);
        if (s.slow && s.kind === "rime" && this.defenders.some((d) => d.kind === "rime" && d.rank >= 4 && d.shots % 3 === 0 && Math.hypot(d.x - s.x0, d.y - s.y0) < 0.01)) t.frozen = 1.2;
      }
    }
    this.shots = keep;
  }

  /** Advance one fixed tick. */
  step(dt = DT) {
    if (this.phase === "won" || this.phase === "lost") return;
    this.time += dt;
    if (this.phase === "build") {
      if (Number.isFinite(this.countdown)) {
        this.countdown -= dt;
        if (this.countdown <= 0) this.startWave();
      }
      // Idle defenders walk home and heal up between waves.
      for (const d of this.defenders) { if (!d.down) d.hp = Math.min(d.maxHp, d.hp + d.maxHp * 0.25 * dt); this.stepDefender(d, dt); }
      return;
    }
    this.waveT += dt;
    while (this.queue.length && this.queue[0].at <= this.waveT) {
      const q = this.queue.shift()!;
      this.spawn(q.kind, q.road, q.boss);
    }
    for (const z of this.zones) for (const e of this.enemies) if (e.hp > 0 && !e.air && Math.hypot(z.x - e.x, z.y - e.y) < z.r) { e.hp -= z.dps * dt; if (e.hp <= 0) this.killEnemy(e); }
    this.zones = this.zones.filter((z) => z.until > this.time);
    for (const e of this.enemies) if (e.hp > 0) { this.moveEnemy(e, dt); }
    for (const d of this.defenders) this.stepDefender(d, dt);
    for (const e of this.enemies) if (e.hp > 0) this.stepEnemyAttack(e, dt);
    this.stepShots(dt);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.keepHp <= 0) { this.phase = "lost"; return; }
    if (!this.queue.length && !this.enemies.length) {
      this.shots = [];
      const bonus = 25 + this.wave * 4;
      this.gold += bonus;
      this.events.push({ t: "cleared", n: this.wave, bonus });
      if (this.wave >= WAVE_COUNT) { this.phase = "won"; return; }
      this.phase = "build";
      this.countdown = BUILD_TIME;
      // The fallen get back up for the next wave.
      for (const d of this.defenders) if (d.down) { d.down = false; d.hp = d.maxHp * 0.5; d.x = d.hx; d.y = d.hy; }
    }
  }

  /** Drain the events since the last call (for the renderer and HUD). */
  drain(): TdEvent[] { const e = this.events; this.events = []; return e; }
}

const isMeleeEnemy = (e: Enemy) => e.range < 1.5;
export { BOSS_NAME };

// ------------------------------------------------------------ scripted player (balance checks and tests)
export interface BotPlan { order: UnitKind[]; upgrade: boolean; early: boolean; maxPads?: number; }
/** A simple placement script: fill pads nearest the keep end of the road first with the next unit in `order`
 *  it can afford, then rank up the cheapest defender. Returns the finished run. */
export function playBot(mapId: string, plan: BotPlan, seed = 1, maxTime = 1800, log?: (run: TdRun) => void): TdRun {
  const run = new TdRun(mapId, seed);
  const pads = [...run.map.pads].sort((a, b) => scorePad(run, b) - scorePad(run, a));
  let next = 0;
  const shop = () => {
    for (let guard = 0; guard < 40; guard++) {
      const kind = plan.order[next % plan.order.length];
      const used = run.defenders.length;
      const free = pads.find((p) => !run.defenderAt(p.id));
      if (free && used < (plan.maxPads ?? 99) && run.gold >= placeCost(kind)) { run.place(free.id, kind); next++; continue; }
      if (plan.upgrade) {
        const cand = run.defenders.filter((d) => d.rank < MAX_RANK && (d.rank < 3 || run.canAscend())).sort((a, b) => rankUpCost(a.kind, a.rank) - rankUpCost(b.kind, b.rank))[0];
        if (cand && run.upgrade(cand.id)) continue;
      }
      break;
    }
  };
  while (run.phase !== "won" && run.phase !== "lost" && run.time < maxTime) {
    if (run.phase === "build") { shop(); plan.early || run.wave === 0 ? run.callWave() : null; }
    run.step();
    if (log && run.events.some((e) => e.t === "cleared" || e.t === "leak")) log(run);
    run.events.length = 0;
  }
  return run;
}
/** Pads that see the most road (counted every unit along each road) rank first. */
function scorePad(run: TdRun, p: { x: number; y: number }): number {
  let n = 0;
  for (const path of run.map.paths) for (let s = 0; s < path.len; s += 1) { const q = pointAt(path, s); if (Math.hypot(q.x - p.x, q.y - p.y) < 3.6) n++; }
  return n + p.y * 0.25;
}
