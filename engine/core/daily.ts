// Daily Challenge: one board a day, the same for everyone. The date (the device's local calendar day, as "YYYY-MM-DD")
// seeds the rival, its opening army, the shop pool and the day's rule; nothing comes from the network. One attempt a
// day is scored; the streak counts consecutive days played and resets after a missed day.
import { DEFAULT_AI, TACTICS, draftArmy, type AIProfile } from "./ai";
import { START_HP, UNITS, UNIT_KINDS, toLocal, type Mods, type Obstacle, type UnitKind } from "./defs";
import type { Match, MatchConfig, StartPiece } from "./match";
import { Rng, hashSeed } from "./rng";

// ---------------------------------------------------------------- dates
/** The local calendar day of a Date, "YYYY-MM-DD". */
export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Whole days since 1970-01-01 for a day key (calendar maths only, no time zone involved). */
export function dayNumber(key: string): number {
  const m = KEY_RE.exec(key);
  if (!m) throw Error(`Bad day key: ${key}`);
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
}
export function keyFromDay(n: number): string {
  const d = new Date(n * 86400000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
export const prevKey = (key: string) => keyFromDay(dayNumber(key) - 1);
/** Challenge numbers count from the first day it shipped. */
const FIRST_DAY = "2026-11-06";
export const challengeNumber = (key: string) => Math.max(1, dayNumber(key) - dayNumber(FIRST_DAY) + 1);

// ---------------------------------------------------------------- rules
export interface DailyRule {
  id: string;
  name: string;
  text: string; // one short line on the card
  apply: (cfg: MatchConfig) => void;
}
const bothMods = (cfg: MatchConfig, f: (m: Mods) => void) => {
  const [a, b] = cfg.mods ?? [undefined, undefined];
  const ma = { ...(a ?? {}) }, mb = { ...(b ?? {}) };
  f(ma); f(mb);
  cfg.mods = [ma, mb];
};

/** The day's twist; every rule binds both commanders. */
export const DAILY_RULES: DailyRule[] = [
  { id: "goldrush", name: "Gold Rush", text: "Both sides get +2 gold every round", apply: (c) => { c.income = [2, 2]; } },
  { id: "warchest", name: "War Chest", text: "Both sides start with 8 extra gold", apply: (c) => { c.startGold = [(c.startGold?.[0] ?? 0) + 8, (c.startGold?.[1] ?? 0) + 8]; } },
  { id: "ironage", name: "Iron Age", text: "Every unit has 25% more health", apply: (c) => bothMods(c, (m) => { m.hpMul = 1.25; }) },
  { id: "whetstone", name: "Sharp Steel", text: "Every unit deals 20% more damage", apply: (c) => bothMods(c, (m) => { m.dmgMul = 1.2; }) },
  { id: "frenzy", name: "Frenzy", text: "Everyone attacks 15% faster", apply: (c) => bothMods(c, (m) => { m.cooldownMul = 0.85; }) },
  { id: "fixed", name: "Fixed Fortunes", text: "No rerolls. Take the shop you get", apply: (c) => { c.noReroll = true; } },
  { id: "scouts", name: "Scouts", text: "First reroll each round is free", apply: (c) => bothMods(c, (m) => { m.freeRerolls = 1; }) },
  { id: "sprint", name: "Sprint", text: "10 rounds, then the healthier keep wins", apply: (c) => { c.maxRounds = 10; } },
  { id: "crowded", name: "Muster Call", text: "Both sides get +1 board space", apply: (c) => { c.supply = [(c.supply?.[0] ?? 0) + 1, (c.supply?.[1] ?? 0) + 1]; } },
  { id: "thinwalls", name: "Thin Walls", text: "Both keeps start on 250 health", apply: (c) => { c.hp = [250, 250]; } },
  { id: "veterans", name: "Veterans", text: "The war starts at round 4", apply: (c) => { c.firstRound = 4; } },
  { id: "rough", name: "Rough Ground", text: "Rocks break up the middle of the field", apply: (c) => { c.obstacles = ROUGH; } },
];
const ROUGH: Obstacle[] = [{ x: 2.2, y: 6.6, r: 0.55 }, { x: 4.5, y: 7.4, r: 0.6 }, { x: 6.8, y: 6.6, r: 0.55 }];

// ---------------------------------------------------------------- the board
export interface DailyBoard {
  key: string;
  number: number;
  seed: number;
  rule: DailyRule;
  /** The shop pool: both sides draft from these. */
  roster: UnitKind[];
  foe: { name: string; ai: AIProfile; start: StartPiece[] };
  /** Which campaign act's arena it is fought in (one of the first seven). */
  arena: number;
}

const TITLES = ["Warden", "Captain", "Old", "Dame", "Marshal", "Brother", "Lady", "Sergeant", "Baron", "Sister"];
const NAMES = ["Fenwick", "Ashby", "Merrow", "Tansy", "Gorse", "Holloway", "Pell", "Rook", "Briar", "Whitlow", "Cobb", "Linden", "Saffron", "Thistle"];
const ROSTER_SIZE = 9;

/** The kinds the daily draws from, in a fixed order so the board does not depend on how UNITS happens to be listed. */
const pool = () => [...UNIT_KINDS].sort();

/** Today's board: a pure function of the day key. */
export function dailyBoard(key: string): DailyBoard {
  dayNumber(key); // validates
  const seed = hashSeed("daily", key);
  const rng = new Rng(seed);
  // Shop pool: nine kinds, at least four costing 3 or less so round one always has a buy.
  const kinds = pool();
  const cheap = kinds.filter((k) => UNITS[k].cost <= 3);
  const roster: UnitKind[] = [];
  const take = (from: UnitKind[]) => {
    const left = from.filter((k) => !roster.includes(k));
    roster.push(left[rng.int(0, left.length - 1)]);
  };
  while (roster.length < 4) take(cheap);
  while (roster.length < ROSTER_SIZE) take(kinds);
  roster.sort((a, b) => UNITS[a].cost - UNITS[b].cost || a.localeCompare(b));

  const rule = DAILY_RULES[rng.int(0, DAILY_RULES.length - 1)];
  const tactic = TACTICS[rng.int(0, TACTICS.length - 1)];
  const ai: AIProfile = {
    ...DEFAULT_AI,
    tactic,
    difficulty: +rng.range(0.55, 0.7).toFixed(3),
    aggression: +rng.range(0.3, 0.75).toFixed(3),
    spread: +rng.range(0.45, 0.8).toFixed(3),
    economy: +rng.range(0.25, 0.5).toFixed(3),
  };
  // The rival opens with a small army on the board; you get gold to answer it.
  const army = draftArmy(1, 7, roster, ai, hashSeed(seed, "army"), 3, 1);
  const name = `${TITLES[rng.int(0, TITLES.length - 1)]} ${NAMES[rng.int(0, NAMES.length - 1)]}`;
  const arena = rng.int(1, 7);
  return {
    key,
    number: challengeNumber(key),
    seed,
    rule,
    roster,
    foe: { name, ai, start: army.map((p) => ({ kind: p.kind, rank: p.rank, ...toLocal(1, p.x, p.y) })) },
    arena,
  };
}

/** Gold you start with to answer the rival's opening army. */
export const DAILY_START_GOLD = 5;

export function dailyConfig(b: DailyBoard): MatchConfig {
  const cfg: MatchConfig = {
    seed: hashSeed(b.seed, "match"),
    hp: [START_HP, START_HP],
    roster: [b.roster, b.roster],
    startGold: [DAILY_START_GOLD, 0],
    start: [undefined, b.foe.start],
    names: ["You", b.foe.name],
  };
  b.rule.apply(cfg);
  return cfg;
}

// ---------------------------------------------------------------- scoring
export interface DailyResult { won: boolean; score: number; rounds: number; hp: number; }

/** A win scores 1000 plus health left plus 10 a round under 20; a loss scores the damage dealt (under 1000). */
export function dailyResult(m: Match): DailyResult {
  const won = m.winner === 0;
  const hp = Math.max(0, Math.round(m.sides[0].hp));
  const dealt = Math.max(0, Math.round(m.sides[1].maxHp - m.sides[1].hp));
  const score = won ? 1000 + hp + 10 * Math.max(0, 20 - m.played) : Math.min(999, dealt);
  return { won, score, rounds: m.played, hp };
}

// ---------------------------------------------------------------- streaks (stored on the device)
export interface DailySave {
  /** Day key of the last scored attempt. */
  last?: string;
  streak: number;
  bestStreak: number;
  /** Best score ever, and the day it came. */
  best: number;
  bestKey?: string;
  played: number;
  wins: number;
  /** The scored attempt for `last`: started, and how it went once finished. */
  today?: { key: string; done: boolean; won: boolean; score: number };
}
export const blankDaily = (): DailySave => ({ streak: 0, bestStreak: 0, best: 0, played: 0, wins: 0 });

/** The streak as it stands on `today`: zero once a whole day has been missed. */
export function streakOn(d: DailySave, today: string): number {
  if (!d.last) return 0;
  return d.last === today || d.last === prevKey(today) ? d.streak : 0;
}
/** Has today's scored attempt not been used yet. */
export const canScore = (d: DailySave, today: string) => d.today?.key !== today;

/** Starts today's scored attempt (quitting still uses it). Returns false if it was already used. */
export function beginDaily(d: DailySave, today: string): boolean {
  if (!canScore(d, today)) return false;
  d.streak = d.last === prevKey(today) ? d.streak + 1 : 1;
  d.bestStreak = Math.max(d.bestStreak, d.streak);
  d.last = today;
  d.played++;
  d.today = { key: today, done: false, won: false, score: 0 };
  return true;
}

/** Records how the scored attempt for `key` ended. False if that attempt isn't open (practice, or already recorded). */
export function finishDaily(d: DailySave, key: string, r: Pick<DailyResult, "won" | "score">): boolean {
  if (!d.today || d.today.key !== key || d.today.done) return false;
  d.today = { key, done: true, won: r.won, score: r.score };
  if (r.won) d.wins++;
  if (r.score > d.best) { d.best = r.score; d.bestKey = key; }
  return true;
}
