// A match: rounds of deploy (buy, place, move, upgrade, sell) then a battle. Pieces stay on the board between rounds.
import { Battle, type BattleResult } from "./battle";
import {
  ASCEND_ROUND, GOLD_CAP, MAX_RANK, REROLL_COST, SHOP_SIZE, START_HP, UNITS, UNIT_KINDS,
  clampToZone, incomeFor, inZone, roundBase, supplyFor, toWorld, upgradeCost,
  type Mods, type Obstacle, type Piece, type Side, type UnitKind,
} from "./defs";
import type { Levels } from "./levels";
import { freeSpotIn, spotBlocked } from "./placement";
import { Rng, hashSeed } from "./rng";
import type { Block } from "./terrain";

export interface StartPiece { kind: UnitKind; lx: number; depth: number; rank?: number; }

export interface MatchConfig {
  seed: number;
  hp?: [number, number];
  roster?: [UnitKind[] | undefined, UnitKind[] | undefined];
  /** Extra gold on round 1. */
  startGold?: [number, number];
  income?: [number, number];
  supply?: [number, number];
  mods?: [Mods | undefined, Mods | undefined];
  /** Persistent troop levels per side (engine/core/levels.ts). Omitted = level 1 everywhere (Daily, puzzles, tools). */
  levels?: [Levels | undefined, Levels | undefined];
  obstacles?: Obstacle[];
  /** Arena terrain (engine/core/terrain.ts): passed to every battle, and no piece may be placed overlapping a block. */
  terrain?: Block[];
  start?: [StartPiece[] | undefined, StartPiece[] | undefined];
  noReroll?: boolean;
  /** If both commanders still stand after this round, the one with more health wins. */
  maxRounds?: number;
  /** Puzzle shops: always these kinds, never sold out. */
  fixedShop?: [UnitKind[] | undefined, UnitKind[] | undefined];
  /** Puzzle gold: no income, no interest; this is all there is. */
  fixedGold?: [number | undefined, number | undefined];
  names?: [string, string];
  /** Start the economy (income, board size) as if this many rounds had passed. */
  firstRound?: number;
  /** Carried gold for side 0 (Gauntlet). */
  carryGold?: number;
}

export interface SideState {
  name: string;
  hp: number;
  maxHp: number;
  gold: number;
  pieces: Piece[];
  shop: (UnitKind | null)[];
  roster: UnitKind[];
  mods: Mods;
  rerolls: number;
  /** The board as it stood when the round began: what the other side may know. */
  seen: Piece[];
  lastIncome: { base: number; interest: number; bonus: number };
}

export type Phase = "deploy" | "battle" | "over";

export interface RoundReport {
  round: number;
  winner: -1 | 0 | 1;
  damage: [number, number];
  result: BattleResult;
}

export const interestFor = (gold: number) => Math.min(3, Math.floor(gold / 5));

export class Match {
  round = 0;
  phase: Phase = "deploy";
  winner: -1 | 0 | 1 | null = null;
  readonly sides: [SideState, SideState];
  readonly cfg: MatchConfig;
  readonly history: RoundReport[] = [];
  private shopRng: [Rng, Rng];
  private nextPiece = 1;

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    const rng = new Rng(cfg.seed);
    this.shopRng = [rng.fork(11), rng.fork(12)];
    const mk = (s: Side): SideState => ({
      name: cfg.names?.[s] ?? (s === 0 ? "You" : "Rival"),
      hp: cfg.hp?.[s] ?? START_HP,
      maxHp: cfg.hp?.[s] ?? START_HP,
      gold: (cfg.startGold?.[s] ?? 0) + (s === 0 ? cfg.carryGold ?? 0 : 0),
      pieces: [],
      shop: [],
      roster: cfg.roster?.[s]?.length ? [...cfg.roster[s]!] : [...UNIT_KINDS],
      mods: cfg.mods?.[s] ?? {},
      rerolls: 0,
      seen: [],
      lastIncome: { base: 0, interest: 0, bonus: 0 },
    });
    this.sides = [mk(0), mk(1)];
    for (const s of [0, 1] as Side[]) {
      for (const sp of cfg.start?.[s] ?? []) {
        const w = toWorld(s, sp.lx, sp.depth);
        const { x, y } = (cfg.terrain?.length ? freeSpotIn(cfg.terrain, s, sp.kind, w.x, w.y) : null) ?? w;
        const rank = sp.rank ?? 1;
        this.sides[s].pieces.push({ id: this.nextPiece++, kind: sp.kind, side: s, x, y, rank, spent: UNITS[sp.kind].cost * rank });
      }
    }
    this.round = Math.max(0, (cfg.firstRound ?? 1) - 1);
    this.startRound();
  }

  /** Rounds played in this match (the economy may have started later). */
  get played() {
    return this.history.length;
  }

  // ------------------------------------------------------------ rounds
  startRound() {
    this.round++;
    this.phase = "deploy";
    for (const s of [0, 1] as Side[]) {
      const st = this.sides[s];
      const fixed = this.cfg.fixedGold?.[s];
      if (fixed !== undefined) {
        if (this.history.length === 0) st.gold = fixed;
        st.lastIncome = { base: 0, interest: 0, bonus: 0 };
      } else {
        const base = incomeFor(this.round);
        const interest = interestFor(st.gold);
        const bonus = (this.cfg.income?.[s] ?? 0) + (st.mods.income ?? 0);
        st.gold = Math.min(GOLD_CAP, st.gold + base + interest + bonus);
        st.lastIncome = { base, interest, bonus };
      }
      st.rerolls = 0;
      this.rollShop(s);
      st.seen = st.pieces.map((p) => ({ ...p }));
    }
  }

  private rollShop(s: Side) {
    const st = this.sides[s];
    const fixed = this.cfg.fixedShop?.[s];
    if (fixed) { st.shop = [...fixed]; return; }
    const rng = this.shopRng[s];
    const pool = st.roster;
    const weights = pool.map((k) => shopWeight(UNITS[k].cost, this.round));
    st.shop = Array.from({ length: SHOP_SIZE }, () => pool[rng.weighted(weights)]);
  }

  supplyCap(s: Side) {
    return supplyFor(this.round) + (this.cfg.supply?.[s] ?? 0) + (this.sides[s].mods.supply ?? 0);
  }
  supplyUsed(s: Side) {
    return this.sides[s].pieces.length;
  }
  rerollCost(s: Side) {
    const st = this.sides[s];
    return st.rerolls < (st.mods.freeRerolls ?? 0) ? 0 : REROLL_COST;
  }
  canReroll(s: Side) {
    return this.phase === "deploy" && !this.cfg.noReroll && !this.cfg.fixedShop?.[s] && this.sides[s].gold >= this.rerollCost(s);
  }

  // ------------------------------------------------------------ actions (throw on illegal moves)
  reroll(s: Side) {
    if (!this.canReroll(s)) throw Error("Can't reroll now.");
    const st = this.sides[s];
    st.gold -= this.rerollCost(s);
    st.rerolls++;
    this.rollShop(s);
  }

  canBuy(s: Side, slot: number): string | null {
    const st = this.sides[s];
    const kind = st.shop[slot];
    if (this.phase !== "deploy") return "Not now";
    if (!kind) return "Sold";
    if (st.gold < UNITS[kind].cost) return "Need gold";
    if (this.supplyUsed(s) >= this.supplyCap(s)) return "Board full";
    return null;
  }

  buy(s: Side, slot: number, x: number, y: number): Piece {
    const why = this.canBuy(s, slot);
    if (why) throw Error(why);
    const st = this.sides[s];
    const kind = st.shop[slot]!;
    const pos = this.freeSpot(s, kind, x, y);
    if (!pos) throw Error("No room");
    st.gold -= UNITS[kind].cost;
    if (!this.cfg.fixedShop?.[s]) st.shop[slot] = null;
    const p: Piece = { id: this.nextPiece++, kind, side: s, x: pos.x, y: pos.y, rank: 1, spent: UNITS[kind].cost };
    st.pieces.push(p);
    return p;
  }

  piece(s: Side, id: number): Piece {
    const p = this.sides[s].pieces.find((x) => x.id === id);
    if (!p) throw Error("No such unit.");
    return p;
  }

  move(s: Side, id: number, x: number, y: number) {
    if (this.phase !== "deploy") throw Error("Not now");
    const p = this.piece(s, id);
    const pos = this.freeSpot(s, p.kind, x, y);
    if (!pos) throw Error("No room");
    p.x = pos.x;
    p.y = pos.y;
  }

  /**
   * Where a piece of `kind` dropped at (x, y) would stand: clamped into the side's zone and, in an arena, nudged off
   * any block to the nearest free spot in the zone. Null when there is none (buy and move then refuse). The UI can call
   * this while dragging to show the snapped spot; buy() and move() use it themselves.
   */
  freeSpot(s: Side, kind: UnitKind, x: number, y: number): { x: number; y: number } | null {
    return this.cfg.terrain?.length ? freeSpotIn(this.cfg.terrain, s, kind, x, y) : clampToZone(s, x, y, UNITS[kind].radius);
  }
  /** Would a piece of `kind` at exactly (x, y) overlap a block (for tinting a drag ghost). */
  spotBlocked(kind: UnitKind, x: number, y: number): boolean {
    return spotBlocked(this.cfg.terrain, kind, x, y);
  }

  canUpgrade(s: Side, id: number): string | null {
    const p = this.piece(s, id);
    if (this.phase !== "deploy") return "Not now";
    if (p.rank >= MAX_RANK) return "Max rank";
    if (p.rank === 3 && this.round < ASCEND_ROUND) return `Ascend from round ${ASCEND_ROUND}`;
    if (this.sides[s].gold < upgradeCost(p.kind, p.rank)) return "Need gold";
    return null;
  }

  upgrade(s: Side, id: number) {
    const why = this.canUpgrade(s, id);
    if (why) throw Error(why);
    const p = this.piece(s, id);
    const cost = upgradeCost(p.kind, p.rank);
    this.sides[s].gold -= cost;
    p.spent += cost;
    p.rank++;
  }

  sellValue(p: Piece) {
    return Math.floor(p.spent / 2);
  }

  sell(s: Side, id: number) {
    if (this.phase !== "deploy") throw Error("Not now");
    const p = this.piece(s, id);
    const st = this.sides[s];
    st.gold = Math.min(GOLD_CAP, st.gold + this.sellValue(p));
    st.pieces = st.pieces.filter((x) => x.id !== id);
  }

  // ------------------------------------------------------------ battle
  battleSeed() {
    return hashSeed(this.cfg.seed, "battle", this.round);
  }

  makeBattle(events = true): Battle {
    this.phase = "battle";
    const pieces = [...this.sides[0].pieces, ...this.sides[1].pieces].map((p) => ({ ...p }));
    return new Battle(pieces, {
      seed: this.battleSeed(),
      obstacles: this.cfg.obstacles,
      terrain: this.cfg.terrain,
      mods: [this.sides[0].mods, this.sides[1].mods],
      levels: this.cfg.levels,
      events,
    });
  }

  /** Applies a finished battle: the loser's commander takes the base plus twice what the winners carry. */
  resolve(result: BattleResult): RoundReport {
    const base = roundBase(this.round);
    const damage: [number, number] = [0, 0];
    if (result.winner === -1) {
      damage[0] = damage[1] = Math.ceil(base / 2);
    } else {
      const loser = (1 - result.winner) as Side;
      damage[loser] = base + 2 * result.threat[result.winner];
    }
    for (const s of [0, 1] as Side[]) this.sides[s].hp = Math.max(0, this.sides[s].hp - damage[s]);
    const report: RoundReport = { round: this.round, winner: result.winner, damage, result };
    this.history.push(report);
    const [h0, h1] = [this.sides[0].hp, this.sides[1].hp];
    if (h0 <= 0 || h1 <= 0) {
      this.phase = "over";
      this.winner = h0 <= 0 && h1 <= 0 ? (h0 === h1 ? -1 : h0 > h1 ? 0 : 1) : h0 <= 0 ? 1 : 0;
    } else if (this.cfg.maxRounds && this.played >= this.cfg.maxRounds) {
      this.phase = "over";
      this.winner = h0 === h1 ? -1 : h0 > h1 ? 0 : 1;
    } else {
      this.phase = "deploy";
    }
    return report;
  }

  /** Plays the current round's battle headless and resolves it. */
  fight(): RoundReport {
    const b = this.makeBattle(false);
    return this.resolve(b.run());
  }

  next() {
    if (this.phase === "over") return;
    this.startRound();
  }

  /** Is a world point inside this side's deploy zone. */
  inZone(s: Side, x: number, y: number) {
    return inZone(s, x, y);
  }
}

/** How likely a unit of this cost is to show in the shop by round. */
export function shopWeight(cost: number, round: number) {
  if (cost <= 3) return 1;
  if (cost === 4) return Math.min(1, 0.35 + round * 0.13);
  return Math.min(1, 0.12 + round * 0.1);
}
