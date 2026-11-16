// Arena mode: the same match loop as the rest of the game (buy, place, watch the battle, lose health on a lost
// round), fought on maps with real structure against AI opponents on a trophy ladder.
//
// This file is content and rules only: the twelve arenas, the four leagues, the opponents, trophy maths and the
// MatchConfig builder. Everything is a pure function over plain data. The device save binding and the rewards live
// beside the other modes' in engine/progression/troops.ts (arenaLadder, nextArenaMatch, awardArena).
// The terrain rules themselves are in terrain.ts (contract), nav.ts and battle.ts; docs/ARENA.md has the lot.
import { TACTICS, type AIProfile, type Tactic } from "./ai";
import { rosterAt } from "./campaign";
import { H, START_HP, UNIT_KINDS, W, ZONE_DEPTH, type UnitKind } from "./defs";
import { MAX_LEVEL, uniformLevels, type Levels } from "./levels";
import type { MatchConfig } from "./match";
import { Rng, hashSeed } from "./rng";
import { mirrorBlock, type Block, type BlockKind } from "./terrain";

// ---------------------------------------------------------------- arenas
/**
 * The `look` hints the built-in arenas use (frontends pick a model per hint; unknown hints fall back on the kind):
 *   wall         a length of masonry                         (kind wall)
 *   house        a small building                            (kind building)
 *   hall         a larger building                           (kind building)
 *   tower        a watchtower                                (kind building)
 *   barricade    a timber barricade that can be broken       (kind barricade)
 *   logs         a log jam across a ford, breakable          (kind barricade)
 *   crates       stacked crates, low                         (kind cover)
 *   fence        a low fence or hedge                        (kind cover)
 *   pond         standing water                              (kind water)
 *   river        a stretch of river                          (kind water)
 * Marks (ArenaMark) are decoration only, never blocks: "gate" for an opening in a wall, "bridge" for a crossing.
 */
export type ArenaLook = "wall" | "house" | "hall" | "tower" | "barricade" | "logs" | "crates" | "fence" | "pond" | "river";
export const ARENA_LOOKS: ArenaLook[] = ["wall", "house", "hall", "tower", "barricade", "logs", "crates", "fence", "pond", "river"];

/** Decoration for a frontend: where a gate or a bridge is (an opening units walk through). The sim never reads these. */
export interface ArenaMark { look: "gate" | "bridge"; x: number; y: number; w: number; h: number; }

export interface ArenaDef {
  /** Stable id (saved per-arena wins are keyed by it). */
  id: string;
  name: string;
  /** One line for the arena card. */
  blurb: string;
  /** The league it is played in, 1..4. */
  league: number;
  /** The terrain: pass as MatchConfig.terrain / BattleOptions.terrain. Symmetric under a half turn about the board centre. */
  blocks: Block[];
  marks: ArenaMark[];
}

type Rect = Omit<Block, "id">;
/** A block from its edges: left, top, right, bottom. */
const r = (kind: BlockKind, look: ArenaLook, x0: number, y0: number, x1: number, y1: number, hp?: number): Rect =>
  ({ kind, look, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, ...(hp ? { hp } : {}) });
const mark = (look: ArenaMark["look"], x0: number, y0: number, x1: number, y1: number): ArenaMark =>
  ({ look, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });
/** Every block in `half` plus its mirror image (a half turn about the board centre), then the `centre` blocks, which
 * must be centred on the board (they are their own mirror). */
function layout(half: Rect[], centre: Rect[] = []): Block[] {
  const out: Block[] = [];
  for (const b of half) {
    out.push({ ...b, id: out.length + 1 });
    out.push(mirrorBlock(out[out.length - 1], out.length + 1, W, H));
  }
  for (const b of centre) out.push({ ...b, id: out.length + 1 });
  return out;
}
const marks = (half: ArenaMark[]): ArenaMark[] => half.flatMap((m) => (m.x === W / 2 && m.y === H / 2 ? [m] : [m, { ...m, x: W - m.x, y: H - m.y }]));

/** The twelve arenas, three to a league. Side 0 deploys in y 7.6..13.5 (bottom), side 1 in y 0.5..6.4 (top). */
export const ARENAS: ArenaDef[] = [
  // ---- League 1
  {
    id: "twin-gates", name: "Twin Gates", league: 1,
    blurb: "A wall across the middle with two gates. Hold one, force the other.",
    blocks: layout(
      [r("wall", "wall", 0, 6.75, 1.5, 7.25), r("cover", "crates", 1.75, 8.5, 3.0, 8.9)],
      [r("wall", "wall", 3.25, 6.75, 5.75, 7.25)],
    ),
    marks: marks([mark("gate", 1.5, 6.75, 3.25, 7.25)]),
  },
  {
    id: "the-crossing", name: "The Crossing", league: 1,
    blurb: "A river with two bridges. Arrows cross the water; boots need a bridge.",
    blocks: layout(
      [r("water", "river", 0, 6.5, 1.5, 7.5), r("cover", "crates", 3.75, 8.4, 5.25, 8.8)],
      [r("water", "river", 3.25, 6.5, 5.75, 7.5)],
    ),
    marks: marks([mark("bridge", 1.5, 6.5, 3.25, 7.5)]),
  },
  {
    id: "crate-yard", name: "Crate Yard", league: 1,
    blurb: "Open ground strewn with crates. Shoot from cover, or smash it.",
    blocks: layout(
      [r("cover", "crates", 1.25, 8.2, 2.75, 8.7), r("cover", "crates", 5.75, 9.4, 7.25, 9.9), r("cover", "crates", 3.75, 10.9, 5.0, 11.4)],
      [r("cover", "crates", 4.0, 6.7, 5.0, 7.3)],
    ),
    marks: [],
  },
  // ---- League 2
  {
    id: "courtyard", name: "The Courtyard", league: 2,
    blurb: "A hall in the middle of a walled yard. Fight round it, never through it.",
    blocks: layout(
      [r("wall", "wall", 1.25, 8.75, 3.0, 9.25), r("wall", "wall", 6.0, 8.75, 7.75, 9.25)],
      [r("building", "hall", 3.75, 6.25, 5.25, 7.75)],
    ),
    marks: marks([mark("gate", 3.0, 8.75, 6.0, 9.25)]),
  },
  {
    id: "watchtowers", name: "Watchtowers", league: 2,
    blurb: "Two towers a side and a fence between them. A marksman's ground.",
    blocks: layout(
      [r("building", "tower", 1.5, 8.75, 2.5, 9.75), r("building", "tower", 6.5, 8.75, 7.5, 9.75), r("cover", "fence", 3.5, 8.2, 5.5, 8.6)],
    ),
    marks: [],
  },
  {
    id: "barricade-pass", name: "Barricade Pass", league: 2,
    blurb: "One narrow gate, and two barricaded passes that siege can open.",
    blocks: layout(
      [r("wall", "wall", 0, 6.75, 0.75, 7.25), r("barricade", "barricade", 0.75, 6.75, 2.5, 7.25), r("wall", "wall", 2.5, 6.75, 3.75, 7.25)],
    ),
    marks: [mark("gate", 3.75, 6.75, 5.25, 7.25)],
  },
  // ---- League 3
  {
    id: "old-village", name: "Old Village", league: 3,
    blurb: "Houses and alleys. Lines break up; ambushers and fliers thrive.",
    blocks: layout(
      [r("building", "house", 1.25, 8.5, 2.75, 10.0), r("building", "house", 5.75, 9.75, 7.25, 11.0), r("building", "house", 2.75, 6.5, 3.75, 7.5), r("cover", "fence", 4.0, 8.55, 5.0, 8.95)],
    ),
    marks: [],
  },
  {
    id: "the-fens", name: "The Fens", league: 3,
    blurb: "Ponds everywhere. Shots fly over the water; the ground between is narrow.",
    blocks: layout(
      [r("water", "pond", 1.25, 9.25, 2.75, 10.5), r("water", "pond", 6.25, 9.0, 7.75, 10.0)],
      [r("water", "pond", 3.5, 6.25, 5.5, 7.75)],
    ),
    marks: [],
  },
  {
    id: "long-lane", name: "Long Lane", league: 3,
    blurb: "Two long walls make a firing lane down the middle, with cover at each end.",
    blocks: layout(
      [r("wall", "wall", 2.75, 5.25, 3.25, 8.75), r("cover", "fence", 3.75, 10.0, 5.25, 10.4), r("cover", "crates", 0.5, 8.3, 1.5, 8.7)],
    ),
    marks: [],
  },
  // ---- League 4
  {
    id: "bastions", name: "Bastions", league: 4,
    blurb: "Each side has a wall with a barricaded gate. Go round the flanks, or break in.",
    blocks: layout(
      [r("wall", "wall", 1.5, 8.5, 3.5, 9.0), r("wall", "wall", 5.5, 8.5, 7.5, 9.0), r("barricade", "barricade", 3.5, 8.5, 5.5, 9.0)],
    ),
    marks: marks([mark("gate", 3.5, 8.5, 5.5, 9.0)]),
  },
  {
    id: "broken-bridge", name: "Broken Bridge", league: 4,
    blurb: "One bridge over the river. Log jams block the fords until someone clears them.",
    blocks: layout(
      [r("water", "river", 1.5, 6.5, 3.5, 7.5), r("barricade", "logs", 0, 6.75, 1.5, 7.25), r("cover", "crates", 3.75, 9.0, 5.25, 9.4)],
    ),
    marks: [mark("bridge", 3.5, 6.5, 5.5, 7.5)],
  },
  {
    id: "switchback", name: "Switchback", league: 4,
    blurb: "Staggered walls make the way in a long S. Burrowers, fliers and mortars take the short cut.",
    blocks: layout(
      [r("wall", "wall", 0, 8.75, 5.0, 9.25), r("cover", "fence", 6.25, 8.8, 7.75, 9.2)],
      [r("building", "house", 4.0, 6.5, 5.0, 7.5)],
    ),
    marks: [],
  },
];

/** An arena by id (undefined for an unknown id). */
export const arenaById = (id: string): ArenaDef | undefined => ARENAS.find((a) => a.id === id);

// ---------------------------------------------------------------- arena checks (used by tests and tools)
/** The commander keeps: just off each end of the board. Blocks stay clear of them. */
export const KEEPS = [{ x: W / 2, y: -0.9, r: 1.1 }, { x: W / 2, y: H + 0.9, r: 1.1 }] as const;
/** The share of a side's deploy zone (depth ZONE_DEPTH from its back edge) not covered by blocks, 0..1. */
export function zoneFree(blocks: readonly Block[], side: 0 | 1): number {
  let free = 0, n = 0;
  const step = 0.1;
  for (let d = step / 2; d < ZONE_DEPTH; d += step) for (let lx = 0.3 + step / 2; lx < W - 0.3; lx += step) {
    // Sampled in side-local terms, so the two sides of a symmetric arena measure the same.
    const x = side === 0 ? lx : W - lx, y = side === 0 ? H - 0.5 - d : 0.5 + d;
    n++;
    if (!blocks.some((b) => Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2)) free++;
  }
  return free / n;
}

// ---------------------------------------------------------------- leagues and trophies
export interface League {
  /** 1..4. */
  id: number;
  name: string;
  /** Trophies needed to play in it. */
  trophies: number;
  /** Ids of its three arenas. */
  arenas: string[];
}
export const LEAGUES: League[] = [
  { id: 1, name: "Bronze League", trophies: 0, arenas: [] },
  { id: 2, name: "Silver League", trophies: 200, arenas: [] },
  { id: 3, name: "Gold League", trophies: 500, arenas: [] },
  { id: 4, name: "Champion League", trophies: 900, arenas: [] },
].map((l) => ({ ...l, arenas: ARENAS.filter((a) => a.league === l.id).map((a) => a.id) }));

/** Trophies for a win, and what a loss costs in each league (index = league id - 1). */
export const TROPHY_WIN = 30;
export const TROPHY_LOSS = [8, 12, 16, 20] as const;
/** A win streak adds this per win past the first, up to STREAK_MAX extra. */
export const STREAK_BONUS = 2;
export const STREAK_MAX = 10;

/** The league a trophy count plays in. */
export const leagueOf = (trophies: number): League => {
  let l = LEAGUES[0];
  for (const x of LEAGUES) if (trophies >= x.trophies) l = x;
  return l;
};
/** The league after this one, or null at the top. */
export const nextLeague = (l: League): League | null => LEAGUES[l.id] ?? null;
/** Progress through the current league toward the next: trophies into it, the span to the next (0 at the top). */
export function leagueProgress(trophies: number): { league: League; into: number; span: number; next: League | null } {
  const league = leagueOf(trophies), next = nextLeague(league);
  return { league, into: trophies - league.trophies, span: next ? next.trophies - league.trophies : 0, next };
}
/** Is an arena open to a player whose best trophy count is `best`. */
export const arenaUnlocked = (a: ArenaDef, best: number) => best >= LEAGUES[a.league - 1].trophies;

/** The ladder as the save keeps it (Save.arena). */
export interface ArenaSave {
  trophies: number;
  /** Highest trophies ever held (leagues unlock on this, and trophies never fall below the gate of the league it reached). */
  best: number;
  wins: number;
  losses: number;
  /** Current run of wins. */
  streak: number;
  bestStreak: number;
  /** Matches finished (drives the arena rotation). */
  played: number;
  /** Wins per arena id. */
  arenaWins: Record<string, number>;
  /** Arena coins paid today, for the daily cap (set by awardArena). */
  day?: { day: string; coins: number };
}
export const blankArena = (): ArenaSave => ({ trophies: 0, best: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, played: 0, arenaWins: {} });
const whole = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
/** Fills in whatever an older or damaged save is missing. */
export function normalizeArena(a: Partial<ArenaSave> | undefined): ArenaSave {
  const trophies = whole(a?.trophies), wins = whole(a?.wins), losses = whole(a?.losses);
  const arenaWins: Record<string, number> = {};
  for (const [k, v] of Object.entries(a?.arenaWins ?? {})) if (arenaById(k) && whole(v) > 0) arenaWins[k] = whole(v);
  return {
    trophies, best: Math.max(trophies, whole(a?.best)), wins, losses,
    streak: whole(a?.streak), bestStreak: Math.max(whole(a?.streak), whole(a?.bestStreak)),
    played: Math.max(whole(a?.played), wins + losses), arenaWins,
    ...(a?.day && typeof a.day.day === "string" ? { day: { day: a.day.day, coins: whole(a.day.coins) } } : {}),
  };
}

export interface ArenaResult {
  won: boolean;
  /** Trophy change (never below the floor of the highest league reached). */
  delta: number;
  trophies: number;
  /** The league before and after; `promoted` when the result reached a new league for the first time. */
  from: League;
  to: League;
  promoted: boolean;
  streak: number;
}
/** What a result would do to the trophies, without applying it. */
export function trophyChange(s: ArenaSave, won: boolean): number {
  if (won) return TROPHY_WIN + Math.min(STREAK_MAX, STREAK_BONUS * s.streak);
  const floor = leagueOf(s.best).trophies;
  const loss = Math.min(TROPHY_LOSS[leagueOf(s.trophies).id - 1], Math.max(0, s.trophies - floor));
  return loss > 0 ? -loss : 0;
}
/**
 * Applies a finished Arena match to the ladder (mutates `s`) and says what changed. Pure over the save object:
 * awardArena() in engine/progression/troops.ts calls it on the device save and pays the rewards.
 */
export function finishArena(s: ArenaSave, arenaId: string, won: boolean): ArenaResult {
  const from = leagueOf(s.trophies), bestBefore = leagueOf(s.best);
  const delta = trophyChange(s, won);
  s.trophies = Math.max(0, s.trophies + delta);
  s.best = Math.max(s.best, s.trophies);
  s.played++;
  if (won) {
    s.wins++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.arenaWins[arenaId] = (s.arenaWins[arenaId] ?? 0) + 1;
  } else {
    s.losses++;
    s.streak = 0;
  }
  const to = leagueOf(s.trophies);
  return { won, delta, trophies: s.trophies, from, to, promoted: leagueOf(s.best).id > bestBefore.id, streak: s.streak };
}

// ---------------------------------------------------------------- opponents
export interface ArenaOpponent {
  /** Display name, e.g. "Marshal Corvane". */
  name: string;
  /** A short epithet for the card, from its tactic, e.g. "the Besieger". */
  title: string;
  ai: AIProfile;
  /** The troop level its whole army fields. */
  level: number;
  /** Trophies it is shown with (close to the player's). */
  trophies: number;
}
const RANKS = ["Sergeant", "Captain", "Marshal", "Warden", "Commander", "Dame", "Sir", "Lady", "Master", "Old"];
const NAMES = ["Pell", "Corvane", "Ilse", "Tobin", "Hask", "Wren", "Cassia", "Rook", "Kettle", "Dunmere", "Varro", "Brandt", "Oriel", "Sable", "Thorne", "Quill", "Maren", "Aldous", "Fenn", "Lorca", "Bryn", "Castell", "Ember", "Vance"];
const TITLES: Record<Tactic, string> = {
  balanced: "the Steady", swarm: "the Many", fortress: "the Wall", artillery: "the Gunner", ambush: "the Unseen", blitz: "the Swift", siege: "the Besieger",
};
/** How sharp the AI is at a trophy count: 0.2 for a newcomer, 0.95 from 1,300 trophies. */
export const arenaDifficulty = (trophies: number) => Math.max(0.2, Math.min(0.95, 0.2 + (Math.max(0, trophies) / 1300) * 0.75));
/** The troop level arena foes field: 1 below 150 trophies, one more every 150, up to 10 (the campaign's last act). */
export const arenaFoeLevel = (trophies: number) => Math.max(1, Math.min(MAX_LEVEL - 2, 1 + Math.floor(Math.max(0, trophies) / 150)));
/** The units an arena foe drafts from: the campaign's unlock order, reaching the full roster by the Champion League. */
export const arenaFoeRoster = (trophies: number): UnitKind[] => rosterAt(Math.min(60, 12 + Math.floor(Math.max(0, trophies) / 18)));
/** The opponent for a match at this trophy count: tougher with trophies, its tactic and temper varied by the seed. */
export function arenaOpponent(trophies: number, seed: number): ArenaOpponent {
  const rng = new Rng(hashSeed("arena-foe", seed));
  const tactic = TACTICS[rng.int(0, TACTICS.length - 1)];
  const difficulty = Math.max(0.15, Math.min(0.97, arenaDifficulty(trophies) + rng.range(-0.05, 0.05)));
  const base: Record<Tactic, [number, number, number]> = {
    // aggression, economy, spread
    balanced: [0.5, 0.4, 0.6], swarm: [0.7, 0.2, 0.6], fortress: [0.25, 0.5, 0.5], artillery: [0.3, 0.4, 0.8],
    ambush: [0.55, 0.35, 0.7], blitz: [0.85, 0.2, 0.7], siege: [0.6, 0.45, 0.5],
  };
  const [ag, ec, sp] = base[tactic];
  const j = (v: number) => Math.max(0, Math.min(1, v + rng.range(-0.12, 0.12)));
  const name = `${RANKS[rng.int(0, RANKS.length - 1)]} ${NAMES[rng.int(0, NAMES.length - 1)]}`;
  return {
    name, title: TITLES[tactic],
    ai: { difficulty, tactic, aggression: j(ag), economy: j(ec), spread: j(sp), rerolls: difficulty < 0.3 ? 0 : difficulty < 0.7 ? 1 : 2 },
    level: arenaFoeLevel(trophies),
    trophies: Math.max(0, Math.round(trophies + rng.range(-25, 25))),
  };
}

// ---------------------------------------------------------------- the next match
/** The arena a player meets next: their league's three in a seeded order, each once before any repeats. */
export function arenaFor(s: ArenaSave, salt = 0): ArenaDef {
  const league = leagueOf(s.trophies), n = league.arenas.length;
  const order = [...league.arenas];
  const rng = new Rng(hashSeed("arena-rot", league.id, Math.floor(s.played / n), salt));
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return arenaById(order[s.played % n])!;
}

export interface ArenaMatch {
  /** Pass to `new Match(cfg)`: seed, terrain, rosters, levels and names are set. */
  cfg: MatchConfig;
  arena: ArenaDef;
  league: League;
  /** The opponent: drive side 1 with `foe.ai` (planTurn / planTurnAsync), show `foe.name`, `foe.title`, `foe.level`. */
  foe: ArenaOpponent;
}
/**
 * Builds the player's next Arena match from the ladder. Pure: `levels` (the player's troop levels), `roster` (the
 * player's units; all of them when omitted) and `hp` (the player's keep health) come from the caller;
 * nextArenaMatch() in engine/progression/troops.ts fills them from the device save. `seed` varies the opponent and the
 * shops (default: derived from the ladder, so the same save always meets the same match); `arena` forces a map.
 */
export function arenaConfig(s: ArenaSave, o: { levels?: Levels; roster?: UnitKind[]; hp?: number; seed?: number; arena?: string } = {}): ArenaMatch {
  const seed = o.seed ?? hashSeed("arena", s.played, s.trophies, s.wins);
  const arena = (o.arena ? arenaById(o.arena) : undefined) ?? arenaFor(s);
  const league = leagueOf(s.trophies);
  const foe = arenaOpponent(s.trophies, seed);
  const foeLevels = foe.level > 1 ? uniformLevels(foe.level) : undefined;
  const cfg: MatchConfig = {
    seed: hashSeed("arena-match", seed, arena.id),
    hp: [o.hp ?? START_HP, START_HP],
    roster: [o.roster?.length ? o.roster : [...UNIT_KINDS], arenaFoeRoster(s.trophies)],
    terrain: arena.blocks,
    ...(o.levels || foeLevels ? { levels: [o.levels, foeLevels] as [Levels | undefined, Levels | undefined] } : {}),
    names: ["You", foe.name],
  };
  return { cfg, arena, league, foe };
}

// ---------------------------------------------------------------- rewards (numbers only; awardArena pays them)
/** Coins for an Arena win, by league (index = league id - 1); a streak adds ARENA_STREAK_COINS per win past the first, up to 5. */
export const ARENA_WIN_COINS = [40, 55, 70, 85] as const;
export const ARENA_STREAK_COINS = 5;
/** Arena coins paid per day at most (first-time league promotions are on top). */
export const ARENA_DAILY_CAP = 400;
/** Coins for reaching a league for the first time (index = league id - 1). */
export const ARENA_PROMOTION_COINS = [0, 150, 300, 500] as const;
/** Crowns a win adds toward the crown chest (as a Skirmish or Gauntlet win does). */
export const ARENA_CROWNS = 2;
/** The coin line items an Arena result pays: [label, coins][]; a loss pays nothing. `earnedToday` applies the daily cap. */
export function arenaCoins(r: ArenaResult, earnedToday = 0): [string, number][] {
  if (!r.won) return [];
  let left = Math.max(0, ARENA_DAILY_CAP - earnedToday);
  const win = Math.min(ARENA_WIN_COINS[r.from.id - 1], left);
  left -= win;
  const streak = Math.min(ARENA_STREAK_COINS * Math.min(5, Math.max(0, r.streak - 1)), left);
  const parts: [string, number][] = [["Arena victory", win], [`Streak ${r.streak}`, streak], [r.promoted ? `${r.to.name} reached` : "", r.promoted ? ARENA_PROMOTION_COINS[r.to.id - 1] : 0]];
  return parts.filter(([, n]) => n > 0);
}
