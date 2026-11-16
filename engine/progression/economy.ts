// Troop progression rules: card and coin costs per level, the commander level and troop cap, coin and card rewards per
// mode and the level curves foes follow.
// Pure functions over plain data (no storage, no DOM), so tests and tools/balance.ts use them directly.
// Shared economy anchors (keep in step with the gem store): a free player earns ~1,000 coins a day of active play,
// maxing one common costs ~12,800 coins, and 1 gem is worth ~10 coins. See outputs/economy/coins.md and progression.md.
import { ACTS, rosterAt } from "../core/campaign";
import { UNIT_KINDS, type UnitKind } from "../core/defs";
import { MAX_LEVEL, clampLevel, uniformLevels, type Levels } from "../core/levels";
import { RARITY, type Rarity } from "./collection";

// ---------------------------------------------------------------- costs and cap
// Clash Royale-style upgrades: each level costs spare cards of that unit plus coins. Rarer units need fewer cards
// (their cards are rarer to find) but more coins; legendaries are the hardest to max.
/** Cards to go from level L to L+1 (index L-1), per rarity. */
export const UPGRADE_CARDS: Record<Rarity, readonly number[]> = {
  common: [2, 4, 8, 15, 25, 40, 60, 90, 130, 180, 250],
  rare: [1, 2, 4, 8, 12, 20, 30, 45, 65, 90, 125],
  epic: [1, 1, 2, 3, 5, 8, 12, 18, 26, 36, 50],
  legendary: [1, 1, 1, 2, 3, 4, 6, 8, 11, 15, 20],
};
/** Coins to go from level L to L+1 for a common (index L-1); rarer units cost RARITY_COINS times as much. */
export const UPGRADE_COINS = [30, 60, 120, 240, 400, 650, 1000, 1500, 2100, 2900, 3800] as const;
export const RARITY_COINS: Record<Rarity, number> = { common: 1, rare: 1.25, epic: 1.5, legendary: 2 };
const top = (level: number) => clampLevel(level) >= MAX_LEVEL;
export const upgradeCards = (level: number, r: Rarity = "common"): number => (top(level) ? Infinity : UPGRADE_CARDS[r][clampLevel(level) - 1]);
export const upgradeCoins = (level: number, r: Rarity = "common"): number =>
  top(level) ? Infinity : Math.round((UPGRADE_COINS[clampLevel(level) - 1] * RARITY_COINS[r]) / 10) * 10;
/** Coins from `from` up to `to` (a whole climb). */
export function coinsBetween(from: number, to: number, r: Rarity = "common"): number {
  let n = 0;
  for (let l = clampLevel(from); l < clampLevel(to); l++) n += upgradeCoins(l, r);
  return n;
}
export function cardsBetween(from: number, to: number, r: Rarity = "common"): number {
  let n = 0;
  for (let l = clampLevel(from); l < clampLevel(to); l++) n += upgradeCards(l, r);
  return n;
}
export const COINS_TO_MAX = coinsBetween(1, MAX_LEVEL);

// ---------------------------------------------------------------- commander level
/** The player's level. Upgrades and wins earn XP; each level adds keep health and lifts the troop level cap. */
export const MAX_COMMANDER = 13;
/** Total XP to reach commander level L (index L-1). */
export const COMMANDER_XP = [0, 20, 60, 140, 280, 500, 800, 1200, 1700, 2400, 3300, 4500, 6000] as const;
/** XP an upgrade earns, by the level it reaches (index = new level). Bigger upgrades are worth more. */
export const UPGRADE_XP = [0, 0, 4, 6, 10, 16, 25, 40, 60, 90, 130, 180, 250] as const;
export const upgradeXp = (newLevel: number) => UPGRADE_XP[clampLevel(newLevel)] ?? 0;
/** Wins earn a little XP too: a campaign first clear (bosses double), a replay, a Gauntlet rival, a Skirmish win. */
export const WIN_XP = { firstClear: 15, boss: 30, replay: 3, gauntlet: 8, skirmish: 3 } as const;
export function commanderLevel(xp: number): number {
  let l = 1;
  while (l < MAX_COMMANDER && xp >= COMMANDER_XP[l]) l++;
  return l;
}
/** Progress through the current commander level: XP into it, XP the level spans (0 at the top). */
export function commanderProgress(xp: number): { level: number; into: number; span: number } {
  const level = commanderLevel(xp);
  if (level >= MAX_COMMANDER) return { level, into: 0, span: 0 };
  return { level, into: xp - COMMANDER_XP[level - 1], span: COMMANDER_XP[level] - COMMANDER_XP[level - 1] };
}
/** Keep health added per commander level past 1 (on a 400 keep, about 2% a level). */
export const KEEP_HP_PER_LEVEL = 8;
export const keepBonus = (commander: number) => KEEP_HP_PER_LEVEL * (Math.max(1, Math.min(MAX_COMMANDER, Math.floor(commander))) - 1);
/** The troop level cap: one above the commander level (2 for a new player), up to MAX_LEVEL. */
export const BASE_CAP = 2;
export const levelCap = (commander: number) => Math.max(1, Math.min(MAX_LEVEL, Math.floor(commander) + 1));

/** Campaign progress as the save keeps it: level id -> best stars (a win is at least one star). */
export type CampaignStars = Record<number, number>;
const LEVELS_PER_ACT = 6;
/** Acts whose boss (the act's last level) has been beaten. */
export const actsCleared = (c: CampaignStars) => ACTS.filter((_, i) => (c[(i + 1) * LEVELS_PER_ACT] ?? 0) > 0).length;
/** The furthest level the player can play: one past the highest cleared. */
export function reachedLevel(c: CampaignStars): number {
  const ids = Object.keys(c).map(Number).filter((id) => (c[id] ?? 0) > 0);
  return Math.min(ACTS.length * LEVELS_PER_ACT, (ids.length ? Math.max(...ids) : 0) + 1);
}
/** Units the player has met in the campaign (used to migrate old saves into the collection). */
export const unlockedKinds = (c: CampaignStars): UnitKind[] => rosterAt(reachedLevel(c));

export interface UpgradeState {
  kind: UnitKind;
  rarity: Rarity;
  level: number;
  cap: number;
  /** Spare cards held, and cards the next level needs (Infinity at the top). */
  cards: number;
  need: number;
  /** Coins for the next level (Infinity at the top). */
  cost: number;
  locked: boolean;
  /** Why the Upgrade button is off, or null when it can be pressed. */
  why: null | "locked" | "max" | "cap" | "cards" | "coins";
}
export function upgradeState(kind: UnitKind, o: { levels: Levels; found: boolean; cards: number; coins: number; commander: number }): UpgradeState {
  const rarity = RARITY[kind];
  const level = clampLevel(o.levels[kind]);
  const cap = levelCap(o.commander);
  const need = upgradeCards(level, rarity), cost = upgradeCoins(level, rarity);
  const locked = !o.found;
  const why = locked ? "locked" : level >= MAX_LEVEL ? "max" : level >= cap ? "cap" : o.cards < need ? "cards" : o.coins < cost ? "coins" : null;
  return { kind, rarity, level, cap, cards: o.cards, need, cost, locked, why };
}

// ---------------------------------------------------------------- foe levels
/** The level a free player's core units are expected to reach while playing each act (see progression.md); campaign
 * foes field their whole army at this level. It climbs steeply: an army left at level 1 stalls around Act 3-4. */
export const EXPECTED_LEVEL_BY_ACT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const foeLevelForAct = (act: number) => EXPECTED_LEVEL_BY_ACT[Math.max(0, Math.min(EXPECTED_LEVEL_BY_ACT.length - 1, act - 1))];
/** The level card's "recommended level" is the foe's. */
export const DECK_SIZE = 8;
/** An army's level for a level: the average of its best DECK_SIZE found units in that level's roster (what you'd field). */
export function armyLevelOf(roster: UnitKind[], levelOf: (k: UnitKind) => number, found: (k: UnitKind) => boolean): number {
  const lv = roster.filter(found).map(levelOf).sort((a, b) => b - a).slice(0, DECK_SIZE);
  return lv.length ? lv.reduce((s, x) => s + x, 0) / lv.length : 1;
}
export const recommendedLevel = foeLevelForAct;
/** Gauntlet rivals start at level 1 and gain one every 3 rivals, never above the player's cap. */
export const gauntletFoeLevel = (stage: number, cap: number) => Math.max(1, Math.min(cap, 1 + Math.floor((Math.max(1, stage) - 1) / 3)));

// ---------------------------------------------------------------- deck
/** A deck needs at least this many of a match's units to apply; below it the full roster is offered (so a deck built
 * from late units never empties an early level's shop). Without a deck the shop offers the whole roster, as tuned. */
export const DECK_MIN = 4;
/** The player's in-match roster with a deck: the roster's units that are in the deck, in roster order. */
export function deckRoster(roster: readonly UnitKind[], deck: readonly UnitKind[]): UnitKind[] | undefined {
  if (!deck.length) return undefined;
  const mine = roster.filter((k) => deck.includes(k));
  return mine.length >= DECK_MIN ? mine : undefined;
}

// ---------------------------------------------------------------- campaign cards
/** Units every new player starts with. */
export const STARTER_KINDS: UnitKind[] = ["blades", "ranger", "mine", "medic"];
/** Of a card bundle, the share each rarity gets (rarer cards are scarcer). */
const CARD_SHARE: Record<Rarity, number> = { common: 1, rare: 0.5, epic: 0.2, legendary: 0.1 };
/**
 * Cards a campaign win pays. A first clear finds the units the level introduces (with a few spares) and pays a bundle
 * for two units of the level's roster; a replay pays a smaller bundle for one. `salt` picks which units (deterministic).
 */
export function campaignCards(o: { act: number; roster: UnitKind[]; unlocks: UnitKind[]; first: boolean; won: boolean; salt: number }): [UnitKind, number][] {
  if (!o.won || !o.roster.length) return [];
  const out = new Map<UnitKind, number>();
  const add = (k: UnitKind, n: number) => { if (n > 0) out.set(k, (out.get(k) ?? 0) + n); };
  if (o.first) for (const k of o.unlocks) add(k, 1 + Math.max(1, Math.round(4 * CARD_SHARE[RARITY[k]])));
  const picks = o.first ? 2 : 1;
  // Grows with the act squared: late levels need far more cards (and the roster is wider), early ones stay modest.
  const base = o.first ? 2 + 0.75 * o.act * o.act : 1 + 0.3 * o.act * o.act;
  for (let i = 0; i < picks; i++) {
    const k = o.roster[Math.abs(o.salt * 7 + i * 13) % o.roster.length];
    add(k, Math.max(1, Math.round(base * CARD_SHARE[RARITY[k]])));
  }
  return [...out];
}

/** Which modes count troop levels. Daily and Breakpoint puzzles never do: everyone plays them at level 1. */
export type Mode = "campaign" | "gauntlet" | "skirmish" | "watch" | "daily" | "puzzle";
export function levelsFor(mode: Mode, mine: Levels, o: { act?: number; stage?: number; cap?: number } = {}): [Levels | undefined, Levels | undefined] | undefined {
  const own = hasLevels(mine) ? { ...mine } : undefined;
  switch (mode) {
    case "campaign": {
      const foe = uniformLevels(foeLevelForAct(o.act ?? 1));
      return own || foe ? [own, foe] : undefined;
    }
    case "gauntlet": {
      const foe = uniformLevels(gauntletFoeLevel(o.stage ?? 1, o.cap ?? BASE_CAP));
      return own || foe ? [own, foe] : undefined;
    }
    // Skirmish is an AI lab: both sides field your levels, so a test stays a like-for-like fight.
    case "skirmish":
    case "watch":
      return own ? [own, { ...own }] : undefined;
    case "daily":
    case "puzzle":
      return undefined;
  }
}
const hasLevels = (l: Levels) => UNIT_KINDS.some((k) => clampLevel(l[k]) > 1);

// ---------------------------------------------------------------- coin rewards
export interface Reward {
  coins: number;
  /** Line items for the result screen, in order. */
  parts: [string, number][];
  /** Set when this result raised the commander level (and so the troop cap). */
  capTo?: number;
  /** Cards this result granted, and the commander XP it earned (set by the device hooks in troops.ts). */
  cards?: [UnitKind, number][];
  xp?: number;
}
const reward = (parts: [string, number][], capTo?: number): Reward => {
  const kept = parts.filter(([, n]) => n > 0);
  return { coins: kept.reduce((s, [, n]) => s + n, 0), parts: kept, ...(capTo ? { capTo } : {}) };
};

export const CAMPAIGN_WIN = (act: number) => 30 + 8 * act;
export const STAR_COINS = 15;
export const FIRST_CLEAR = (act: number) => 100 + 25 * act;
/** Replays (wins on a level already cleared) pay at most this a day, so grinding one level can't outrun the curve.
 * First clears are never capped and don't count toward it. */
export const REPLAY_DAILY_CAP = 400;
/** A campaign result. `prevStars` is the best before this match (0 = never won). Losses pay nothing.
 * `replayEarnedToday` is what replays have already paid today (see REPLAY_DAILY_CAP). */
export function campaignReward(o: { act: number; won: boolean; stars: number; prevStars: number; boss?: boolean; actsClearedBefore?: number; replayEarnedToday?: number }): Reward {
  if (!o.won) return reward([]);
  const first = o.prevStars <= 0;
  let win = CAMPAIGN_WIN(o.act), stars = STAR_COINS * o.stars;
  if (!first) {
    // The win is paid before the stars, so a nearly-spent cap still shows the "Victory" line.
    let left = Math.max(0, REPLAY_DAILY_CAP - (o.replayEarnedToday ?? 0));
    win = Math.min(win, left); left -= win;
    stars = Math.min(stars, left);
  }
  return reward([["Victory", win], [`${o.stars} star${o.stars === 1 ? "" : "s"}`, stars], ["First clear", first ? FIRST_CLEAR(o.act) : 0]]);
}

/** A Gauntlet rival beaten (stage = the rival's number, 1-based). */
export const gauntletRivalReward = (stage: number): Reward => reward([[`Rival ${stage} beaten`, Math.min(150, 30 + 10 * Math.max(1, stage))]]);

/** The scored Daily attempt; practice pays nothing. */
export function dailyReward(o: { won: boolean; scored: boolean; streak: number }): Reward {
  if (!o.scored) return reward([]);
  return reward([[o.won ? "Daily victory" : "Daily played", o.won ? 200 : 60], [`Streak ${o.streak}`, Math.min(100, 10 * Math.max(0, o.streak))]]);
}

/** Skirmish pays for a win over the rival AI, more the sharper it is and the fairer the health; at most this a day. */
export const SKIRMISH_DAILY_CAP = 300;
export function skirmishReward(o: { won: boolean; watch: boolean; difficulty: number; hp: [number, number]; earnedToday: number }): Reward {
  if (!o.won || o.watch) return reward([]);
  const fair = Math.max(0.25, Math.min(1, o.hp[1] / Math.max(1, o.hp[0])));
  const raw = Math.round((20 + 60 * Math.max(0, Math.min(1, o.difficulty))) * fair);
  return reward([["Skirmish win", Math.max(0, Math.min(raw, SKIRMISH_DAILY_CAP - o.earnedToday))]]);
}
