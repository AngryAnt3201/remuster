// Content contracts: campaign levels, Breakpoint puzzles and the Gauntlet. Data lives in campaign.ts, puzzles.ts and
// gauntlet.ts; the UI only uses what is exported here and there.
import type { AIProfile } from "./ai";
import { supplyFor, type Mods, type Obstacle, type UnitKind } from "./defs";
import type { Match, MatchConfig, StartPiece } from "./match";
import { hashSeed } from "./rng";

export type Objective =
  | { kind: "win" }
  | { kind: "hpAtLeast"; value: number }
  | { kind: "roundsAtMost"; value: number }
  | { kind: "lossesAtMost"; value: number };

export interface LevelDef {
  id: number; // 1..30
  act: number; // 1..5
  name: string;
  foe: string; // the rival commander
  line?: string; // one short line on the level card, flavour not rules
  ai: AIProfile;
  hp: [number, number];
  roster: UnitKind[]; // what the player can draft
  foeRoster?: UnitKind[];
  unlock?: UnitKind; // the unit this level introduces (badged NEW)
  unlocks?: UnitKind[]; // every unit it introduces, when there is more than one (unlock is the first)
  startGold?: [number, number];
  income?: [number, number];
  supply?: [number, number];
  start?: [StartPiece[] | undefined, StartPiece[] | undefined];
  obstacles?: Obstacle[];
  mods?: [Mods | undefined, Mods | undefined];
  noReroll?: boolean;
  maxRounds?: number;
  boss?: boolean;
  /** Three stars: the first is always { kind: "win" }. */
  stars: [Objective, Objective, Objective];
}

export interface PuzzleDef {
  id: number;
  name: string;
  /** All the gold there is. No income. */
  gold: number;
  /** Kinds on offer; each can be bought any number of times. */
  shop: UnitKind[];
  /** Most pieces the player may field. */
  supply: number;
  /** The enemy board (side 1, side-local coordinates). It does not move before the battle. */
  foe: StartPiece[];
  /** Pieces the player already has (side 0), if any. */
  mine?: StartPiece[];
  obstacles?: Obstacle[];
  foeMods?: Mods;
  /** Gold left for two and three stars (solver-checked). */
  silver: number;
  par: number;
}

export interface Boon {
  id: string;
  name: string;
  text: string; // short, shown on the pick card
  apply: (m: Mods) => void;
}

export interface GauntletFoe {
  name: string;
  ai: AIProfile;
  hp: number;
  start: StartPiece[];
  obstacles?: Obstacle[];
}

// ---------------------------------------------------------------- campaign helpers
export function levelConfig(level: LevelDef, attempt = 0): MatchConfig {
  return {
    seed: hashSeed("level", level.id, attempt),
    hp: level.hp,
    roster: [level.roster, level.foeRoster ?? level.roster],
    startGold: level.startGold,
    income: level.income,
    supply: level.supply,
    start: level.start,
    obstacles: level.obstacles,
    mods: level.mods,
    noReroll: level.noReroll,
    maxRounds: level.maxRounds,
    names: ["You", level.foe],
  };
}

export function objectiveMet(o: Objective, m: Match): boolean {
  if (m.winner !== 0) return false;
  switch (o.kind) {
    case "win": return true;
    case "hpAtLeast": return m.sides[0].hp >= o.value;
    case "roundsAtMost": return m.played <= o.value;
    case "lossesAtMost": return m.history.filter((r) => r.winner === 1).length <= o.value;
  }
}

export function starsFor(level: LevelDef, m: Match): number {
  return level.stars.filter((o) => objectiveMet(o, m)).length;
}

export function objectiveText(o: Objective): string {
  switch (o.kind) {
    case "win": return "Win";
    case "hpAtLeast": return `Finish on ${o.value}+ health`;
    case "roundsAtMost": return `Win within ${o.value} rounds`;
    case "lossesAtMost": return o.value === 0 ? "Lose no rounds" : `Lose ${o.value} rounds or fewer`;
  }
}

// ---------------------------------------------------------------- puzzle helpers
export function puzzleConfig(p: PuzzleDef): MatchConfig {
  return {
    seed: hashSeed("puzzle", p.id),
    hp: [100, 100],
    fixedShop: [p.shop, []],
    fixedGold: [p.gold, 0],
    supply: [p.supply - supplyFor(1), 0],
    start: [p.mine, p.foe],
    obstacles: p.obstacles,
    mods: [undefined, p.foeMods],
    noReroll: true,
    maxRounds: 1,
    names: ["You", p.name],
  };
}

/** 0 if the battle was lost, else 1..3 by gold left. */
export function puzzleStars(p: PuzzleDef, won: boolean, goldLeft: number): number {
  if (!won) return 0;
  return goldLeft >= p.par ? 3 : goldLeft >= p.silver ? 2 : 1;
}
