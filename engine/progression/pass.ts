// The War Pass: a 30-day season of 30 tiers, filled by pass XP from daily quests and from the stars or crowns a win
// earns. The free track pays every player coins, cards, chests, a few gems and the Blossom keep at tier 15. Premium
// (one consumable a season, co.inflect.muster.pass) adds a second, richer track with the Gilded keep at tier 30 and
// one harmless perk: chests unlock 20% faster. Premium is retroactive: every tier already reached becomes claimable.
// Nothing here changes a battle; every level stays open. Rewards are claimed by tapping.
// Pure rules over a save-shaped object (time passed in), plus a thin binding to the device save.
// Numbers and how fast the pass fills: outputs/economy/pass.md.
import type { UnitKind } from "../core/defs";
import { load, save, type Save } from "../save";
import { earn, spend } from "../economy/wallet";
import { RARITIES, RARITY, cardsOf, foundKinds, grantCards, type Rarity } from "./collection";
import { DEAL_PRICE, SHOP_CHESTS, findable, localDay, makeChest, type Chest, type SlotChest } from "./chests";
import { grantCosmetic, ownsCosmetic } from "./cosmetics";
import { onPassEvent, setChestUnlockFactor } from "./passEvents";
import { setQuestXpSink, startQuests } from "./quests";

// ---------------------------------------------------------------- the season clock
const DAY = 86_400_000;
/** Season 1 starts at 00:00 UTC on 1 November 2026. Every season is the same for everyone, worldwide. */
export const SEASON_EPOCH = Date.UTC(2026, 10, 1);
export const SEASON_DAYS = 30;
export const SEASON_MS = SEASON_DAYS * DAY;
export const TIERS = 30;
export const XP_PER_TIER = 120;
export const MAX_XP = TIERS * XP_PER_TIER;

export const seasonAt = (now: number) => Math.max(1, Math.floor((now - SEASON_EPOCH) / SEASON_MS) + 1);
export const seasonStart = (season: number) => SEASON_EPOCH + (season - 1) * SEASON_MS;
export const seasonEnd = (season: number) => seasonStart(season + 1);
export const seasonLeft = (now: number) => Math.max(0, seasonEnd(seasonAt(now)) - now);

export interface SeasonTheme { name: string; tagline: string; theme: string; accent: string; deep: string }
/** Season names and themes, in order; they repeat after the last. The CSS reads `theme` as data-theme. */
export const SEASON_THEMES: SeasonTheme[] = [
  { name: "Blossom March", tagline: "The orchards are in bloom and the banners are out.", theme: "blossom", accent: "#f08cb0", deep: "#7b2d52" },
  { name: "The Gilded Crown", tagline: "Old gold, new rivals.", theme: "gilded", accent: "#f2b632", deep: "#6b4510" },
  { name: "Frostwatch", tagline: "Hold the passes through the long cold.", theme: "frost", accent: "#8fd3ff", deep: "#1d4a6b" },
  { name: "Ember Road", tagline: "The road is burning. Keep it.", theme: "ember", accent: "#ff8a4c", deep: "#6b2410" },
  { name: "Shadow Muster", tagline: "Something marches by night.", theme: "shadow", accent: "#b39cff", deep: "#2e1f5a" },
];
export const themeOf = (season: number) => SEASON_THEMES[(season - 1) % SEASON_THEMES.length];

// ---------------------------------------------------------------- the tracks
export type PassReward =
  | { kind: "coins"; n: number }
  | { kind: "gems"; n: number }
  /** Cards of one rarity, for a specific unit decided by cardTarget (never random). */
  | { kind: "cards"; rarity: Rarity; n: number }
  /** A chest, opened with the usual chest sequence. Its contents are rolled with the odds the chest info shows. */
  | { kind: "chest"; chest: SlotChest }
  /** A keep skin. If it's already owned, `gems` are paid instead. */
  | { kind: "skin"; id: string; gems: number };
export type Track = "free" | "premium";

const c = (n: number): PassReward => ({ kind: "coins", n });
const g = (n: number): PassReward => ({ kind: "gems", n });
const k = (rarity: Rarity, n: number): PassReward => ({ kind: "cards", rarity, n });
const ch = (chest: SlotChest): PassReward => ({ kind: "chest", chest });

/** Tier 1 is index 0. */
export const FREE_TRACK: PassReward[] = [
  c(150), k("common", 15), ch("iron"), g(5), c(250), k("rare", 4), ch("iron"), c(300), g(5), ch("gilded"),
  k("common", 25), c(350), k("rare", 6), g(10), { kind: "skin", id: "keep:blossom", gems: 60 }, c(400), ch("iron"), k("epic", 1), c(450), ch("gilded"),
  g(10), k("rare", 8), c(500), k("common", 40), ch("gilded"), g(10), c(600), k("epic", 2), c(700), ch("royal"),
];
export const PREMIUM_TRACK: PassReward[] = [
  g(30), ch("gilded"), c(600), k("rare", 10), g(40), ch("gilded"), k("epic", 2), c(800), g(40), ch("royal"),
  k("legendary", 1), c(1000), g(50), k("epic", 3), ch("royal"), c(1200), g(50), k("rare", 20), ch("gilded"), k("legendary", 1),
  g(60), c(1500), ch("royal"), k("epic", 4), g(60), ch("legend"), c(2000), g(80), k("legendary", 2), { kind: "skin", id: "keep:gilded", gems: 150 },
];
export const trackOf = (t: Track) => (t === "free" ? FREE_TRACK : PREMIUM_TRACK);

// ---------------------------------------------------------------- XP, premium, prices
/** Pass XP per star or crown a win earns, up to a daily cap (quests carry the rest). */
export const CROWN_XP = 5;
export const CROWN_XP_DAILY_CAP = 100;
/** Gems to skip a whole tier (less when part of it is filled): ceil(50 x XP still needed / 120). */
export const SKIP_TIER_GEMS = 50;
/** War Pass Premium's one perk: chest timers run at 80% (20% faster). */
export const PREMIUM_CHEST_FACTOR = 0.8;
/** If a second Premium arrives in a season it's already owned (an old Ask to Buy approved late), it pays its price in gems. */
export const PASS_EXTRA_GEMS = 450;

export interface PassSave {
  season: number;
  xp: number;
  /** Tiers claimed on each track this season (1-based). */
  free: number[];
  prem: number[];
  /** Seasons Premium was bought for. */
  premium: number[];
  /** App Store transaction ids already credited (kept across seasons). */
  txIds: string[];
  /** Crown XP earned today (for the daily cap). */
  crown: { day: string; xp: number };
  /** Chests won (pass rewards, special offers) waiting for their opening sequence. Saved before it plays. */
  toOpen: Chest[];
}

export const blankPass = (season = 1): PassSave => ({ season, xp: 0, free: [], prem: [], premium: [], txIds: [], crown: { day: "", xp: 0 }, toOpen: [] });

const ints = (a: unknown, ok: (n: number) => boolean) => (Array.isArray(a) ? [...new Set(a.filter((n) => Number.isInteger(n) && ok(n)) as number[])] : []);
export function normalizePass(p: Partial<PassSave> | undefined): PassSave {
  const b = blankPass(Number.isInteger(p?.season) && p!.season! > 0 ? p!.season! : 1);
  const tier = (n: number) => n >= 1 && n <= TIERS;
  return {
    season: b.season,
    xp: Math.max(0, Math.min(MAX_XP, Math.floor(Number(p?.xp) || 0))),
    free: ints(p?.free, tier), prem: ints(p?.prem, tier), premium: ints(p?.premium, (n) => n > 0),
    txIds: Array.isArray(p?.txIds) ? p!.txIds.filter((x) => typeof x === "string").slice(-200) : [],
    crown: { day: typeof p?.crown?.day === "string" ? p.crown.day : "", xp: Math.max(0, Number(p?.crown?.xp) || 0) },
    toOpen: Array.isArray(p?.toOpen) ? p!.toOpen.filter((x) => x && typeof x === "object" && x.contents) : [],
  };
}

/** Moves the save into `season`: a new season starts at tier 0 with nothing claimed. Premium bought and txIds stay. */
export function seasonIn(p: PassSave, season: number) {
  if (p.season === season) return;
  Object.assign(p, { season, xp: 0, free: [], prem: [], crown: { day: "", xp: 0 } });
}

export const tierOf = (xp: number) => Math.min(TIERS, Math.floor(Math.max(0, xp) / XP_PER_TIER));
export const intoTier = (xp: number) => (tierOf(xp) >= TIERS ? XP_PER_TIER : Math.max(0, xp) % XP_PER_TIER);
export const hasPremium = (p: PassSave, season = p.season) => p.premium.includes(season);

export function addXpIn(p: PassSave, n: number): { from: number; to: number } {
  const from = tierOf(p.xp);
  if (Number.isFinite(n) && n > 0) p.xp = Math.min(MAX_XP, p.xp + Math.floor(n));
  return { from, to: tierOf(p.xp) };
}
/** XP for the stars or crowns a win earned, within today's cap. Returns the XP added. */
export function crownXpIn(p: PassSave, day: string, crowns: number): number {
  if (p.crown.day !== day) p.crown = { day, xp: 0 };
  const want = Math.max(0, Math.floor(crowns)) * CROWN_XP;
  const add = Math.min(want, CROWN_XP_DAILY_CAP - p.crown.xp);
  if (add <= 0) return 0;
  p.crown.xp += add;
  addXpIn(p, add);
  return add;
}

export const claimed = (p: PassSave, t: Track, tier: number) => (t === "free" ? p.free : p.prem).includes(tier);
export const reached = (p: PassSave, tier: number) => tier >= 1 && tier <= tierOf(p.xp);
export const claimable = (p: PassSave, t: Track, tier: number) =>
  reached(p, tier) && !claimed(p, t, tier) && (t === "free" || hasPremium(p));
export const claimableCount = (p: PassSave) =>
  Array.from({ length: TIERS }, (_, i) => i + 1).reduce((n, i) => n + (claimable(p, "free", i) ? 1 : 0) + (claimable(p, "premium", i) ? 1 : 0), 0);

/** Marks a reward claimed and returns it (the caller pays it out in the same task). Null when it can't be claimed. */
export function claimIn(p: PassSave, t: Track, tier: number): PassReward | null {
  if (!claimable(p, t, tier)) return null;
  (t === "free" ? p.free : p.prem).push(tier);
  return trackOf(t)[tier - 1];
}

/** Gems to finish the current tier now (0 at the top). */
export const skipCost = (p: PassSave) => (tierOf(p.xp) >= TIERS ? 0 : Math.max(1, Math.ceil((SKIP_TIER_GEMS * (XP_PER_TIER - intoTier(p.xp))) / XP_PER_TIER)));
/** Fills the current tier (call after the gems are spent). */
export function skipIn(p: PassSave): boolean {
  if (tierOf(p.xp) >= TIERS) return false;
  p.xp = (tierOf(p.xp) + 1) * XP_PER_TIER;
  return true;
}

export type PassCredit = "paid" | "extra" | "dup";
/**
 * Credits one Premium transaction for `season`, once per transaction id. "paid": Premium is now active (retroactive:
 * every tier reached is claimable at once). "extra": Premium was already owned this season, so the caller pays
 * PASS_EXTRA_GEMS instead. "dup": that transaction was credited before.
 */
export function creditPremiumIn(p: PassSave, txId: string, season: number): PassCredit {
  if (!txId || p.txIds.includes(txId)) return "dup";
  p.txIds = [...p.txIds, txId].slice(-200);
  seasonIn(p, season);
  if (hasPremium(p, season)) return "extra";
  p.premium.push(season);
  return "paid";
}

// ---------------------------------------------------------------- cards: which unit (never random)
/**
 * The unit a card reward goes to: of the units the player can find at that rarity, a found one with the fewest spare
 * cards (ties by unit order), else the first findable one. With none at that rarity yet, it drops a rarity and pays
 * the same coin value in cards (by DEAL_PRICE), so a legendary card early on becomes about 7 epic cards.
 */
export function cardTarget(rarity: Rarity, n: number, pool: UnitKind[], found: UnitKind[], spare: (k: UnitKind) => number): { kind: UnitKind; n: number; rarity: Rarity } | null {
  for (let i = RARITIES.indexOf(rarity); i >= 0; i--) {
    const r = RARITIES[i];
    const units = pool.filter((u) => RARITY[u] === r);
    if (!units.length) continue;
    const owned = units.filter((u) => found.includes(u));
    const pick = owned.length ? owned.reduce((a, b) => (spare(b) < spare(a) ? b : a)) : units[0];
    return { kind: pick, n: Math.max(1, Math.round((n * DEAL_PRICE[rarity]) / DEAL_PRICE[r])), rarity: r };
  }
  return null;
}

// ---------------------------------------------------------------- value (docs and tests)
/** Gem value of chests the Shop doesn't sell, sized between the wooden crate and the cheapest Shop chest. */
const CHEST_GEMS: Record<SlotChest, number> = { wood: 15, iron: 40, gilded: 80, royal: 180, legend: 400 };
for (const o of SHOP_CHESTS) CHEST_GEMS[o.type] = o.gems;
export const chestGems = (t: SlotChest) => CHEST_GEMS[t];
/** A reward's worth in gems: coins at 10 a gem, cards at the daily-deal coin price, chests at the Shop's gem price. Skins count 0. */
export function rewardGems(r: PassReward): number {
  switch (r.kind) {
    case "coins": return r.n / 10;
    case "gems": return r.n;
    case "cards": return (r.n * DEAL_PRICE[r.rarity]) / 10;
    case "chest": return CHEST_GEMS[r.chest];
    case "skin": return 0;
  }
}
export const trackGems = (t: Track) => Math.round(trackOf(t).reduce((n, r) => n + rewardGems(r), 0));

// ---------------------------------------------------------------- device-save binding
type WithPass = Save & { pass?: PassSave };
type Listener = () => void;
const listeners = new Set<Listener>();
const now = () => Date.now();

function current(): PassSave {
  const p = normalizePass((load() as WithPass).pass);
  seasonIn(p, seasonAt(now()));
  return p;
}
function commit<T>(apply: (p: PassSave) => T): T {
  let out!: T;
  save((s) => { const w = s as WithPass; w.pass = normalizePass(w.pass); seasonIn(w.pass, seasonAt(now())); out = apply(w.pass); });
  for (const f of listeners) f();
  return out;
}
export const pass = (): Readonly<PassSave> => current();
export const season = () => seasonAt(now());
export const premiumActive = () => hasPremium(current());
export const addPassXp = (n: number) => commit((p) => addXpIn(p, n));
export function onPassChange(f: Listener): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/** The unit a card reward pays to for this player right now. */
export function cardsFor(rarity: Rarity, n: number) {
  const found = foundKinds();
  return cardTarget(rarity, n, findable(load().campaign, found), found, cardsOf);
}

export interface Paid { reward: PassReward; coins: number; gems: number; cards?: { kind: UnitKind; n: number; isNew: boolean }; chest?: Chest; skin?: string }

/** Pays a reward out: coins and gems to the wallet, cards to the collection, a chest into the to-open queue, a skin. */
export function payReward(r: PassReward, why: string): Paid {
  const out: Paid = { reward: r, coins: 0, gems: 0 };
  if (r.kind === "coins") { earn("coins", r.n, why); out.coins = r.n; }
  if (r.kind === "gems") { earn("gems", r.n, why); out.gems = r.n; }
  if (r.kind === "cards") {
    const t = cardsFor(r.rarity, r.n);
    if (t) out.cards = { kind: t.kind, n: t.n, ...grantCards(t.kind, t.n, why) };
  }
  if (r.kind === "skin") {
    if (grantCosmetic(r.id, why)) out.skin = r.id;
    else if (ownsCosmetic(r.id)) { earn("gems", r.gems, `${why} (skin owned)`); out.gems = r.gems; }
  }
  if (r.kind === "chest") { const chest = makeChest(r.chest); queueChest(chest); out.chest = chest; }
  return out;
}

/** Tap to claim. The tier is marked claimed and its reward paid in the same task, before any animation. */
export function claimReward(t: Track, tier: number): Paid | null {
  const r = commit((p) => claimIn(p, t, tier));
  return r ? payReward(r, `pass ${t} ${tier}`) : null;
}

/** Gems to finish this tier; null if it can't be afforded or it's the top. */
export function skipTier(): boolean {
  const cost = skipCost(current());
  if (!cost || !spend("gems", cost, `pass skip ${tierOf(current().xp) + 1}`)) return false;
  return commit((p) => skipIn(p));
}

/** Credits a Premium transaction and saves it. Called by PassShop before the transaction is finished. */
export function creditPremium(txId: string): PassCredit {
  const r = commit((p) => creditPremiumIn(p, txId, seasonAt(now())));
  if (r === "extra") earn("gems", PASS_EXTRA_GEMS, `pass extra ${txId}`);
  return r;
}

/** Chests waiting for their opening sequence (saved, so closing the app mid-way never loses one). */
export const queueChest = (chest: Chest) => commit((p) => { p.toOpen.push(chest); });
export const waitingChests = (): Chest[] => [...current().toOpen];
/** Takes the next waiting chest out of the queue: the caller opens it (openChest pays it in its first frame). */
export const takeChest = (): Chest | null => commit((p) => p.toOpen.shift() ?? null);

let started = false;
/** Wires the pass in once: crown XP from wins, quest XP, quests' own listener, and Premium's chest speed perk. */
export function startPass() {
  if (started) return;
  started = true;
  setQuestXpSink((xp) => void addPassXp(xp));
  startQuests();
  onPassEvent((e) => { if (e.kind === "win" && e.stars > 0) commit((p) => crownXpIn(p, localDay(), e.stars)); });
  setChestUnlockFactor(() => (premiumActive() ? PREMIUM_CHEST_FACTOR : 1));
}

/** Debug and review shots: ?pass=free|premium|claim set the save to a mid-season state. */
export function seedPassDemo(kind: string) {
  commit((p) => {
    p.xp = 11 * XP_PER_TIER + 70;
    p.free = [1, 2, 3, 4, 5, 6, 7, 8];
    p.prem = kind === "premium" ? [1, 2, 3, 4, 5] : [];
    p.premium = kind === "premium" || kind === "claim" ? [p.season] : [];
    if (kind === "claim") p.prem = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  });
}
