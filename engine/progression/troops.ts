// Troop levels on the device: the save binding for engine/progression/economy.ts, plus the coin, card and XP hooks the
// result screens call. Coins move only through the shared wallet (engine/economy/wallet.ts); cards only through the
// collection (engine/progression/collection.ts).
import { ARENA_CROWNS, arenaCoins, arenaConfig, finishArena, normalizeArena, type ArenaMatch, type ArenaResult, type ArenaSave } from "../core/arena";
import type { LevelDef } from "../core/content";
import { START_HP, UNIT_KINDS, type UnitKind } from "../core/defs";
import { dateKey } from "../core/daily";
import { MAX_LEVEL, clampLevel, type Levels } from "../core/levels";
import type { MatchConfig } from "../core/match";
import { earn, spend, wallet } from "../economy/wallet";
import { load, save, type Save } from "../save";
import { LEVELS } from "../core/campaign";
import { winChest, type WinResult } from "./chests";
import { cardsOf, foundKinds, grantCards, grantIn, isFound, normalizeCollection, spendCards } from "./collection";
import { passEvent } from "./passEvents"; // [pass]
import {
  DECK_SIZE, FIRST_CLEAR, STARTER_KINDS, WIN_XP, actsCleared, armyLevelOf, deckRoster, campaignCards, campaignReward, commanderLevel, commanderProgress, dailyReward,
  gauntletRivalReward, keepBonus, levelCap, levelsFor, skirmishReward, unlockedKinds, upgradeState, upgradeXp,
  type Mode, type Reward, type UpgradeState,
} from "./economy";

export interface ProgressionSave {
  levels: Levels;
  /** Commander XP (the player's level). */
  xp?: number;
  /** The deck: up to 8 found units; the in-match shop offers only these in the campaign, Gauntlet and Skirmish. */
  deck?: UnitKind[];
  /** 2 once the save has moved to the card collection (levels 1-12 at +8%); older saves are migrated at boot. */
  v?: number;
  /** Skirmish coins paid today (for the daily cap). */
  skirmish?: { day: string; coins: number };
  /** Campaign replay coins paid today (for the daily replay cap). */
  replay?: { day: string; coins: number };
  /** The one-off coins for campaign clears made before troop levels existed have been paid. */
  legacyPaid?: boolean;
}
export const normalizeProgression = (p: Partial<ProgressionSave> | undefined): ProgressionSave => {
  const levels: Levels = {};
  for (const [k, v] of Object.entries(p?.levels ?? {})) if (clampLevel(v) > 1) levels[k as UnitKind] = clampLevel(v);
  const xp = typeof p?.xp === "number" && Number.isFinite(p.xp) && p.xp > 0 ? Math.floor(p.xp) : 0;
  const deck = [...new Set((p?.deck ?? []).filter((k) => typeof k === "string"))].slice(0, DECK_SIZE) as UnitKind[];
  return {
    levels, ...(xp ? { xp } : {}), ...(p?.v ? { v: p.v } : {}), ...(deck.length ? { deck } : {}),
    ...(p?.skirmish ? { skirmish: p.skirmish } : {}), ...(p?.replay ? { replay: p.replay } : {}), ...(p?.legacyPaid ? { legacyPaid: true } : {}),
  };
};
const prog = (): ProgressionSave => {
  const s = load();
  s.progression = normalizeProgression(s.progression);
  return s.progression;
};

// ---------------------------------------------------------------- migration
/** An old level (1-10 at +3%) as the new level with about the same stats (1-12 at +8%), rounded up in the player's favour. */
export const migrateLevel = (old: number) => Math.min(MAX_LEVEL, 1 + Math.ceil(((Math.min(10, clampLevel(old)) - 1) * 3) / 8));
/**
 * Moves a save to the card collection, once: every unit met in the campaign (and any levelled one) is found, the
 * starters are found, old troop levels become their new-scale equivalents, and each cleared level pays the cards and
 * commander XP its first clear would have. Commander XP also counts the upgrades the old levels stand for. Pure over a
 * save object, so tests need no storage.
 */
export function migrateArmySave(s: Save): boolean {
  const p = normalizeProgression(s.progression);
  if (p.v === 2) return false;
  const c = normalizeCollection(s.collection);
  const levels: Levels = {};
  let xp = p.xp ?? 0;
  for (const [k, v] of Object.entries(p.levels)) {
    const n = migrateLevel(v as number);
    if (n > 1) levels[k as UnitKind] = n;
    for (let l = 2; l <= n; l++) xp += upgradeXp(l);
  }
  const met = new Set<UnitKind>([...STARTER_KINDS, ...unlockedKinds(s.campaign ?? {}), ...(Object.keys(p.levels) as UnitKind[])]);
  for (const k of met) if (!c.found.includes(k)) grantIn(c, k, 1);
  // The cards their first clears would have paid, so a returning player opens the Army with upgrades to make.
  for (const l of LEVELS) {
    if ((s.campaign?.[l.id] ?? 0) <= 0) continue;
    xp += l.boss ? WIN_XP.boss : WIN_XP.firstClear;
    for (const [k, n] of campaignCards({ act: l.act, roster: l.roster, unlocks: l.unlocks ?? (l.unlock ? [l.unlock] : []), first: true, won: true, salt: l.id })) grantIn(c, k, n);
  }
  s.collection = c;
  s.progression = { ...p, levels, v: 2, ...(xp ? { xp } : {}) };
  return true;
}
/** Boot hook: migrate the device save once. */
export function migrateArmy(): boolean {
  let changed = false;
  save((s) => { changed = migrateArmySave(s); });
  return changed;
}

// ---------------------------------------------------------------- reads
export const troopLevels = (): Levels => ({ ...prog().levels });
export const troopLevel = (k: UnitKind) => clampLevel(prog().levels[k]);
export const commanderXp = () => prog().xp ?? 0;
export const commander = () => commanderLevel(commanderXp());
export const commanderBar = () => commanderProgress(commanderXp());
export const currentCap = () => levelCap(commander());
export const troopState = (k: UnitKind): UpgradeState =>
  upgradeState(k, { levels: prog().levels, found: isFound(k), cards: cardsOf(k), coins: wallet().coins, commander: commander() });
/** Units that can level up right now (the Army badge). */
export const readyCount = () => foundKinds().filter((k) => troopState(k).why === null).length;

/** Adds commander XP; returns the new commander level when it went up, else null. */
export function addXp(n: number): number | null {
  if (!(n > 0)) return null;
  const before = commander();
  save((s) => { s.progression = normalizeProgression(s.progression); s.progression.xp = (s.progression.xp ?? 0) + Math.floor(n); });
  const after = commander();
  return after > before ? after : null;
}

export interface UpgradeResult { level: number; xp: number; commanderUp: number | null; }
/** Buys the next level of a unit with cards plus coins. Returns the result, or null when it isn't allowed or affordable. */
export function upgradeTroop(k: UnitKind): UpgradeResult | null {
  const st = troopState(k);
  if (st.why) return null;
  if (!spend("coins", st.cost, `level ${k} ${st.level + 1}`)) return null;
  if (!spendCards(k, st.need)) { earn("coins", st.cost, `refund ${k}`); return null; }
  const level = Math.min(MAX_LEVEL, st.level + 1);
  save((s) => { s.progression = normalizeProgression(s.progression); s.progression.levels[k] = level; });
  const xp = upgradeXp(level);
  passEvent({ kind: "upgrade" }); // [pass] "upgrade a unit" quest
  return { level, xp, commanderUp: addXp(xp) };
}

/** The deck (found units only). */
export const deck = (): UnitKind[] => (prog().deck ?? []).filter(isFound);
/** Adds or removes a unit from the deck; returns whether it is in the deck now. A full deck refuses new units. */
export function toggleDeck(k: UnitKind): boolean {
  let inDeck = false;
  save((s) => {
    s.progression = normalizeProgression(s.progression);
    const d = (s.progression.deck ?? []).filter((x) => x !== k);
    inDeck = d.length === (s.progression.deck ?? []).length && d.length < DECK_SIZE && isFound(k);
    s.progression.deck = inDeck ? [...d, k] : d;
  });
  return inDeck;
}

/** Adds the troop levels a mode uses to a match config (Daily and puzzles come back untouched), and in the campaign
 * and the Gauntlet the commander's keep health. */
export function withLevels(cfg: MatchConfig, mode: Mode, o: { act?: number; stage?: number } = {}): MatchConfig {
  const levels = levelsFor(mode, prog().levels, { ...o, cap: currentCap() });
  let out = levels ? { ...cfg, levels } : cfg;
  const bonus = mode === "campaign" || mode === "gauntlet" ? keepBonus(commander()) : 0;
  if (bonus > 0) out = { ...out, hp: [(cfg.hp?.[0] ?? START_HP) + bonus, cfg.hp?.[1] ?? START_HP] };
  // The deck narrows your in-match shop (never the foe's, never the Daily or puzzles).
  const mine = mode === "campaign" || mode === "gauntlet" || mode === "skirmish" ? deckRoster(cfg.roster?.[0] ?? UNIT_KINDS, deck()) : undefined;
  if (mine) out = { ...out, roster: [mine, cfg.roster?.[1]] };
  return out;
}

// ---------------------------------------------------------------- coin hooks (result screens)
const pay = (r: Reward, why: string) => { if (r.coins > 0) earn("coins", r.coins, why); return r; };
/** Adds XP to a reward and marks a commander level-up on it. */
const withXp = (r: Reward, xp: number): Reward => {
  const up = addXp(xp);
  return { ...r, ...(xp > 0 ? { xp } : {}), ...(up ? { capTo: up } : {}) };
};

/** Coins a save would have earned as first clears before troop levels existed (campaign: level id -> best stars). */
export function legacyCoins(campaign: Record<number, number>): number {
  let coins = 0;
  for (const l of LEVELS) if ((campaign[l.id] ?? 0) > 0) coins += FIRST_CLEAR(l.act);
  return coins;
}
/** Once per save: pay those coins, so a returning player opens the Army with something to spend. */
export function settleLegacyCoins(): number {
  if (prog().legacyPaid) return 0;
  const coins = legacyCoins(load().campaign);
  save((s) => { s.progression = normalizeProgression(s.progression); s.progression.legacyPaid = true; });
  if (coins > 0) earn("coins", coins, "campaign clears before troop levels");
  return coins;
}

/** Call before the campaign's own star save, so a first clear is still known. Pays coins, cards and XP. */
export function awardCampaign(l: LevelDef, won: boolean, stars: number, now = new Date()): Reward {
  const c = load().campaign;
  const day = dateKey(now);
  const p = prog();
  const replayEarnedToday = p.replay?.day === day ? p.replay.coins : 0;
  const prevStars = c[l.id] ?? 0;
  const r = pay(campaignReward({ act: l.act, won, stars, prevStars, boss: l.boss, actsClearedBefore: actsCleared(c), replayEarnedToday }), `campaign ${l.id}`);
  if (prevStars > 0 && r.coins > 0) save((s) => { s.progression = normalizeProgression(s.progression); s.progression.replay = { day, coins: replayEarnedToday + r.coins }; });
  if (!won) return r;
  const first = prevStars <= 0;
  const salt = l.id + (first ? 0 : Number(day.replace(/\D/g, "")) + replayEarnedToday);
  const cards = campaignCards({ act: l.act, roster: l.roster, unlocks: l.unlocks ?? (l.unlock ? [l.unlock] : []), first, won, salt });
  for (const [k, n] of cards) grantCards(k, n, `campaign ${l.id}`);
  const xp = first ? (l.boss ? WIN_XP.boss : WIN_XP.firstClear) : WIN_XP.replay;
  return withXp({ ...r, ...(cards.length ? { cards } : {}) }, xp);
}
export const awardGauntletRival = (stage: number) => withXp(pay(gauntletRivalReward(stage), `gauntlet ${stage}`), WIN_XP.gauntlet);
export const awardDaily = (won: boolean, scored: boolean, streak: number) => pay(dailyReward({ won, scored, streak }), "daily");
export function awardSkirmish(won: boolean, watch: boolean, difficulty: number, hp: [number, number], now = new Date()): Reward {
  const day = dateKey(now);
  const p = prog();
  const earnedToday = p.skirmish?.day === day ? p.skirmish.coins : 0;
  const r = pay(skirmishReward({ won, watch, difficulty, hp, earnedToday }), "skirmish");
  if (r.coins > 0) save((s) => { s.progression = normalizeProgression(s.progression); s.progression.skirmish = { day, coins: earnedToday + r.coins }; });
  return r.coins > 0 ? withXp(r, WIN_XP.skirmish) : r;
}

// ---------------------------------------------------------------- Arena (engine/core/arena.ts)
const ladder = (): ArenaSave => {
  const s = load();
  s.arena = normalizeArena(s.arena);
  return s.arena;
};
/** The player's Arena ladder: trophies, best, wins, losses, streak, per-arena wins. */
export const arenaLadder = (): Readonly<ArenaSave> => ladder();
/** The player's units in an Arena match: every unit found (the starters at least), narrowed to the deck when it applies. */
export function arenaRoster(): UnitKind[] {
  const found = UNIT_KINDS.filter((k) => isFound(k) || STARTER_KINDS.includes(k));
  return deckRoster(found, deck()) ?? found;
}
/**
 * The player's next Arena match, from the device save: the arena (their league's rotation), the opponent, and a
 * MatchConfig carrying the player's troop levels, units (deck) and keep health. Read-only: call it again and the same
 * match comes back until awardArena() records a result. `seed` re-rolls the opponent and shops; `arena` forces a map.
 */
export function nextArenaMatch(o: { seed?: number; arena?: string } = {}): ArenaMatch {
  const lv = prog().levels;
  return arenaConfig(ladder(), {
    ...o,
    levels: Object.keys(lv).length ? { ...lv } : undefined,
    roster: arenaRoster(),
    hp: START_HP + keepBonus(commander()),
  });
}
export interface ArenaAward {
  /** Coins paid (line items in `parts`), commander XP, and `capTo` when the commander levelled up. */
  reward: Reward;
  /** What happened on the ladder: trophy change, leagues before and after, promotion, streak. */
  result: ArenaResult;
  /** The chest a win dropped (null on a loss): show it as the other modes do. Do not call winChest() again. */
  chest: WinResult | null;
}
/**
 * Call once when an Arena match ends (`won` = match.winner === 0). Records the result on the ladder in the save, pays
 * the coins through the wallet (capped per day) and commander XP, and on a win drops a chest through winChest().
 */
export function awardArena(match: Pick<ArenaMatch, "arena">, won: boolean, now = new Date()): ArenaAward {
  const day = dateKey(now);
  const before = ladder();
  const earnedToday = before.day?.day === day ? before.day.coins : 0;
  let result!: ArenaResult;
  save((s) => { s.arena = normalizeArena(s.arena); result = finishArena(s.arena, match.arena.id, won); });
  const parts = arenaCoins(result, earnedToday);
  const coins = parts.reduce((n, [, c]) => n + c, 0);
  const r = pay({ coins, parts }, `arena ${match.arena.id}`);
  // Promotion coins are a one-off and sit outside the daily cap.
  const capped = parts.filter(([label]) => !label.endsWith("reached")).reduce((n, [, c]) => n + c, 0);
  if (capped > 0) save((s) => { s.arena = normalizeArena(s.arena); s.arena.day = { day, coins: earnedToday + capped }; });
  return { reward: won ? withXp(r, WIN_XP.arena) : r, result, chest: won ? winChest(ARENA_CROWNS) : null };
}

/** The army's level for a roster: the average level of its best 8 found units (the "under-levelled" check). */
export const armyLevel = (roster: UnitKind[]): number => armyLevelOf(roster, troopLevel, isFound);
