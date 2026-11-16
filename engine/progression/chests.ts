// Chests: the reward loop in the Clash Royale mould. A win drops a chest into one of four slots (a fixed repeating
// cycle of types, never random by type); one chest unlocks at a time on the device clock; gems open one now at a
// price that falls as its timer runs down. A free chest banks every 4 hours (up to 2) and a daily crown chest opens
// after 10 stars or crowns. Contents are rolled with a seeded RNG the moment a chest drops and kept in the save, so
// reopening the app never re-rolls them. Daily deals sell specific unit cards for coins, seeded by date.
// Pure rules over a save-shaped object (time passed in), plus a thin binding to the device save. See outputs/economy/chests.md.
import { UNIT_KINDS, type UnitKind } from "../core/defs";
import { load, save, type Save } from "../save";
import { RARITIES, RARITY, grantCards, foundKinds, type Rarity } from "./collection";
import { actsCleared, unlockedKinds } from "./economy";
import { earn, spend, canAfford } from "../economy/wallet";
import { chestUnlockFactor, passEvent } from "./passEvents"; // [pass]

// ---------------------------------------------------------------- types and tables
export type SlotChest = "wood" | "iron" | "gilded" | "royal" | "legend";
export type ChestType = SlotChest | "free" | "crown";

const MIN = 60_000, HOUR = 60 * MIN;
export const SLOTS = 4;

export interface ChestDef {
  name: string;
  /** Unlock time in ms (free and crown chests open at once). */
  unlockMs: number;
  /** Coins and cards at Act 1; both grow with the act (see actScale). */
  coins: number;
  cards: number;
  /** Gems inside (fixed, not scaled). */
  gems: number;
  /** Chance each card is of each rarity, in percent (sums to 100). */
  odds: Record<Rarity, number>;
  /** Most different units per rarity, so the opening shows a handful of stacks rather than dozens. */
  stacks: Record<Rarity, number>;
}

export const CHESTS: Record<ChestType, ChestDef> = {
  wood:   { name: "Wooden Crate",       unlockMs: 15 * MIN, coins: 40,   cards: 6,   gems: 0,  odds: { common: 88, rare: 11, epic: 1,   legendary: 0 },   stacks: { common: 2, rare: 1, epic: 1, legendary: 1 } },
  iron:   { name: "Iron Coffer",        unlockMs: 3 * HOUR, coins: 120,  cards: 18,  gems: 0,  odds: { common: 80, rare: 17, epic: 2.8, legendary: 0.2 }, stacks: { common: 2, rare: 2, epic: 1, legendary: 1 } },
  gilded: { name: "Gilded Chest",       unlockMs: 8 * HOUR, coins: 350,  cards: 45,  gems: 2,  odds: { common: 72, rare: 22, epic: 5.4, legendary: 0.6 }, stacks: { common: 3, rare: 2, epic: 1, legendary: 1 } },
  royal:  { name: "Royal Hoard",        unlockMs: 12 * HOUR, coins: 800, cards: 110, gems: 8,  odds: { common: 66, rare: 25, epic: 8,   legendary: 1 },   stacks: { common: 3, rare: 2, epic: 2, legendary: 1 } },
  legend: { name: "Legend's Reliquary", unlockMs: 24 * HOUR, coins: 1600, cards: 220, gems: 20, odds: { common: 60, rare: 26, epic: 11,  legendary: 3 },   stacks: { common: 3, rare: 3, epic: 2, legendary: 1 } },
  free:   { name: "Wayfarer's Satchel", unlockMs: 0,        coins: 30,   cards: 5,   gems: 0,  odds: { common: 90, rare: 9.5, epic: 0.5, legendary: 0 },  stacks: { common: 2, rare: 1, epic: 1, legendary: 1 } },
  crown:  { name: "Crown Casket",       unlockMs: 0,        coins: 250,  cards: 30,  gems: 2,  odds: { common: 74, rare: 21, epic: 4.5, legendary: 0.5 }, stacks: { common: 2, rare: 2, epic: 1, legendary: 1 } },
};

/**
 * The fixed cycle wins step through (24 long, then it repeats): 12 Wooden Crates, 6 Iron Coffers, 4 Gilded Chests,
 * 1 Royal Hoard and 1 Legend's Reliquary. A player always knows a big chest is coming; nothing about the type is random.
 */
export const CYCLE: SlotChest[] = [
  "wood", "wood", "iron", "wood", "gilded", "wood", "iron", "wood", "wood", "iron", "gilded", "wood",
  "royal", "wood", "iron", "wood", "wood", "gilded", "iron", "wood", "wood", "iron", "gilded", "legend",
];
export const cycleAt = (i: number): SlotChest => CYCLE[((Math.floor(i) % CYCLE.length) + CYCLE.length) % CYCLE.length];

/** Coins and cards grow 15% per act beyond the first (Act 10 chests hold 2.35x). */
export const actScale = (act: number) => 1 + 0.15 * (Math.max(1, Math.min(10, Math.floor(act) || 1)) - 1);

/**
 * Gems to open a chest now, from the time left on its timer: ceil(10 x hours^0.8), at least 1, 0 when ready.
 * Concave like Clash Royale's, so long timers cost less per hour: 15 min 4, 1 h 10, 3 h 25, 8 h 53, 12 h 74, 24 h 128.
 * It only ever falls as the timer runs down.
 */
export function gemsToOpen(msLeft: number): number {
  if (!(msLeft > 0)) return 0;
  return Math.max(1, Math.ceil(10 * (msLeft / HOUR) ** 0.8 - 1e-9));
}

export const FREE_EVERY = 4 * HOUR;
export const FREE_BANK = 2;
export const CROWNS_FOR_CHEST = 10;

/** Card prices in coins by rarity, for daily deals. */
export const DEAL_PRICE: Record<Rarity, number> = { common: 15, rare: 120, epic: 900, legendary: 6000 };
/** Cards per deal by rarity. */
export const DEAL_COUNT: Record<Rarity, number> = { common: 20, rare: 5, epic: 1, legendary: 1 };
/** Chests the Shop sells for gems. */
export const SHOP_CHESTS: { type: SlotChest; gems: number }[] = [
  { type: "gilded", gems: 80 }, { type: "royal", gems: 180 }, { type: "legend", gems: 400 },
];

// ---------------------------------------------------------------- RNG
/** mulberry32: small, fast, and the same everywhere, so a seed always rolls the same chest. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A stable 32-bit hash of a string (daily deal seeds). */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------- contents
export interface CardStack { kind: UnitKind; n: number; }
export interface Contents { coins: number; gems: number; cards: CardStack[]; }

/** Units a chest may hold: those met in the campaign so far, plus any already found (a Starter Pack, say). */
export function findable(campaign: Record<number, number>, found: UnitKind[] = []): UnitKind[] {
  const set = new Set<UnitKind>([...unlockedKinds(campaign), ...found]);
  return UNIT_KINDS.filter((k) => set.has(k));
}

/**
 * The odds a card lands on each rarity for this player: the chest's table, with any rarity they can't find yet
 * folded into the next one down (so the table always sums to 100 and never promises what can't drop).
 */
export function effectiveOdds(type: ChestType, pool: UnitKind[]): Record<Rarity, number> {
  const out: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const have = (r: Rarity) => pool.some((k) => RARITY[k] === r);
  for (let i = RARITIES.length - 1; i >= 0; i--) {
    const r = RARITIES[i];
    let to = i;
    while (to > 0 && !have(RARITIES[to])) to--;
    if (!have(RARITIES[to])) { to = i; while (to < RARITIES.length - 1 && !have(RARITIES[to])) to++; }
    out[RARITIES[to]] += CHESTS[type].odds[r];
  }
  for (const r of RARITIES) out[r] = Math.round(out[r] * 100) / 100;
  return out;
}

/** Owned units are 4x as likely as ones met but not found yet. */
export const OWNED_WEIGHT = 4;

/** Rolls a chest's contents: fixed by the seed, the act and what the player can find at that moment. */
export function rollContents(type: ChestType, seed: number, act: number, pool: UnitKind[], found: UnitKind[] = []): Contents {
  const def = CHESTS[type], rand = rng(seed), k = actScale(act);
  const coins = Math.round((def.coins * k * (0.9 + rand() * 0.2)) / 5) * 5;
  const total = Math.max(1, Math.round(def.cards * k));
  if (!pool.length) return { coins, gems: def.gems, cards: [] };
  const odds = effectiveOdds(type, pool);
  // Each card rolls a rarity.
  const per: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (let i = 0; i < total; i++) {
    let x = rand() * 100, r: Rarity = "common";
    for (const q of RARITIES) { if (x < odds[q]) { r = q; break; } x -= odds[q]; }
    if (odds[r] === 0) r = RARITIES.find((q) => odds[q] > 0)!;
    per[r]++;
  }
  // Then each rarity's cards go to a few units, weighted towards owned ones.
  const cards: CardStack[] = [];
  const owned = new Set(found);
  for (const r of RARITIES) {
    if (!per[r]) continue;
    const units = pool.filter((u) => RARITY[u] === r);
    const picks: UnitKind[] = [];
    const want = Math.min(def.stacks[r], units.length, per[r]);
    while (picks.length < want) {
      const left = units.filter((u) => !picks.includes(u));
      const w = left.map((u) => (owned.has(u) ? OWNED_WEIGHT : 1));
      let x = rand() * w.reduce((a, b) => a + b, 0), i = 0;
      while (i < left.length - 1 && x >= w[i]) { x -= w[i]; i++; }
      picks.push(left[i]);
    }
    // Split: the first pick gets the biggest share (it leads the reveal), the rest split what's left.
    const counts = picks.map(() => 0);
    for (let c = 0; c < per[r]; c++) counts[rand() < 0.45 ? 0 : Math.floor(rand() * picks.length)]++;
    picks.forEach((u, i) => { if (counts[i] > 0) cards.push({ kind: u, n: counts[i] }); });
  }
  return { coins, gems: def.gems, cards };
}

// ---------------------------------------------------------------- save shape
export interface Chest {
  id: number;
  type: ChestType;
  act: number;
  seed: number;
  contents: Contents;
  /** Set when its unlock starts; the chest is ready once game time reaches it. Never before startedAt. */
  startedAt?: number;
  readyAt?: number;
}

export interface ChestSave {
  slots: (Chest | null)[];
  /** Wins that have dropped a chest so far: the place in the cycle. */
  cycle: number;
  nextId: number;
  /** The latest device time seen. Game time never runs behind it, so winding the clock back can't speed a chest up. */
  seen: number;
  /** The moment the free-chest bank was empty; one chest banks every FREE_EVERY after it, up to FREE_BANK. */
  freeFrom: number;
  /** Today's crowns (stars or crowns earned), and whether today's crown chest is opened. */
  crown: { day: string; crowns: number; claimed: boolean };
  /** Daily deals bought today (indexes into that day's list). */
  deals: { day: string; bought: number[] };
  /** A seed counter so free, crown and shop chests roll differently each time. */
  rolls: number;
}

export const blankChests = (): ChestSave => ({
  slots: Array(SLOTS).fill(null), cycle: 0, nextId: 1, seen: 0, freeFrom: -1,
  crown: { day: "", crowns: 0, claimed: false }, deals: { day: "", bought: [] }, rolls: 0,
});

export function normalizeChests(c: Partial<ChestSave> | undefined): ChestSave {
  const b = blankChests();
  if (!c || typeof c !== "object") return b;
  const slots = Array.from({ length: SLOTS }, (_, i) => {
    const x = c.slots?.[i];
    return x && typeof x === "object" && x.type in CHESTS && x.contents ? x : null;
  });
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    slots, cycle: Math.max(0, Math.floor(num(c.cycle, 0))), nextId: Math.max(1, Math.floor(num(c.nextId, 1))),
    seen: num(c.seen, 0), freeFrom: num(c.freeFrom, -1),
    crown: { ...b.crown, ...c.crown }, deals: { day: c.deals?.day ?? "", bought: Array.isArray(c.deals?.bought) ? c.deals!.bought : [] },
    rolls: Math.max(0, Math.floor(num(c.rolls, 0))),
  };
}

// ---------------------------------------------------------------- time
/**
 * Game time: the device clock, but never behind the latest time already seen. If the clock jumps backwards the
 * timers simply pause until it catches up, so setting the clock forward to open a chest and back again costs the
 * player the same time on the next one, and nothing can ever be ready before it was started.
 */
export function tick(c: ChestSave, deviceNow: number): number {
  if (Number.isFinite(deviceNow) && deviceNow > c.seen) c.seen = deviceNow;
  return c.seen;
}

export type SlotState = "locked" | "unlocking" | "ready";
export function stateOf(ch: Chest, now: number): SlotState {
  if (ch.readyAt === undefined) return "locked";
  return now >= ch.readyAt ? "ready" : "unlocking";
}
/** [pass] A chest's unlock time with War Pass Premium's perk applied (chests unlock 20% faster; 1x without it). */
export const unlockMsOf = (type: ChestType) => Math.round(CHESTS[type].unlockMs * chestUnlockFactor());
export const msLeft = (ch: Chest, now: number) => (ch.readyAt === undefined ? unlockMsOf(ch.type) : Math.max(0, ch.readyAt - now)); // [pass]
export const unlocking = (c: ChestSave, now: number) => c.slots.find((s) => s && stateOf(s, now) === "unlocking") ?? null;

// ---------------------------------------------------------------- rules (pure)
export interface Progress { campaign: Record<number, number>; found: UnitKind[]; }
export const actOf = (p: Progress) => Math.min(10, actsCleared(p.campaign) + 1);

function make(c: ChestSave, type: ChestType, seed: number, p: Progress): Chest {
  const act = actOf(p);
  return { id: c.nextId++, type, act, seed, contents: rollContents(type, seed, act, findable(p.campaign, p.found), p.found) };
}

export interface Drop { chest: Chest | null; slot: number; full: boolean; }
/** A win: the next chest in the cycle goes into the first free slot. Slots full means no chest (and the cycle waits). */
export function dropIn(c: ChestSave, p: Progress, seed: number): Drop {
  const slot = c.slots.findIndex((s) => !s);
  if (slot < 0) return { chest: null, slot: -1, full: true };
  const chest = make(c, cycleAt(c.cycle), seed, p);
  c.cycle++;
  c.slots[slot] = chest;
  return { chest, slot, full: false };
}

/** Tap to unlock: starts the timer, unless another chest is already unlocking. */
export function startIn(c: ChestSave, slot: number, now: number): boolean {
  const ch = c.slots[slot];
  if (!ch || ch.readyAt !== undefined || unlocking(c, now)) return false;
  ch.startedAt = now;
  ch.readyAt = now + unlockMsOf(ch.type); // [pass] Premium perk
  return true;
}

/** Takes a ready chest out of its slot (its contents are then granted by the caller). */
export function takeIn(c: ChestSave, slot: number, now: number): Chest | null {
  const ch = c.slots[slot];
  if (!ch || stateOf(ch, now) !== "ready") return null;
  c.slots[slot] = null;
  return ch;
}

/** Gems to open this slot now. */
export const skipCost = (c: ChestSave, slot: number, now: number) => {
  const ch = c.slots[slot];
  return ch ? gemsToOpen(msLeft(ch, now)) : 0;
};

/** Gem skip: the chest becomes ready now (its timer, if running, ends; one that hadn't started never blocks the queue). */
export function rushIn(c: ChestSave, slot: number, now: number): Chest | null {
  const ch = c.slots[slot];
  if (!ch) return null;
  ch.startedAt ??= now;
  ch.readyAt = Math.max(ch.startedAt, Math.min(ch.readyAt ?? now, now));
  return takeIn(c, slot, now);
}

// Free chest: banks one every 4 h, up to 2. A new player starts with one ready.
export function freeBanked(c: ChestSave, now: number): number {
  if (c.freeFrom < 0) c.freeFrom = now - FREE_EVERY;
  if (c.freeFrom > now) c.freeFrom = now; // never counts from the future
  return Math.min(FREE_BANK, Math.floor((now - c.freeFrom) / FREE_EVERY));
}
/** Ms until the next free chest banks (0 when the bank is full). */
export function freeNextIn(c: ChestSave, now: number): number {
  const n = freeBanked(c, now);
  if (n >= FREE_BANK) return 0;
  return c.freeFrom + (n + 1) * FREE_EVERY - now;
}
export function claimFreeIn(c: ChestSave, p: Progress, now: number, seed: number): Chest | null {
  const n = freeBanked(c, now);
  if (n <= 0) return null;
  // From a full bank, the next one starts banking now (time spent full is not kept); otherwise the clock runs on.
  c.freeFrom = n >= FREE_BANK ? now - (FREE_BANK - 1) * FREE_EVERY : c.freeFrom + FREE_EVERY;
  return make(c, "free", seed, p);
}

// Crown chest: 10 stars or crowns in a day, then it opens once.
function crownDay(c: ChestSave, day: string) {
  if (c.crown.day !== day) c.crown = { day, crowns: 0, claimed: false };
  return c.crown;
}
export function addCrownsIn(c: ChestSave, day: string, n: number) {
  const k = crownDay(c, day);
  if (n > 0) k.crowns = Math.min(CROWNS_FOR_CHEST, k.crowns + Math.floor(n));
  return k;
}
export const crownReady = (c: ChestSave, day: string) => { const k = crownDay(c, day); return !k.claimed && k.crowns >= CROWNS_FOR_CHEST; };
export function claimCrownIn(c: ChestSave, p: Progress, day: string, seed: number): Chest | null {
  if (!crownReady(c, day)) return null;
  c.crown.claimed = true;
  return make(c, "crown", seed, p);
}

/** A chest bought in the Shop opens at once (it never takes a slot). */
export const shopChestIn = (c: ChestSave, type: SlotChest, p: Progress, seed: number) => make(c, type, seed, p);

// Daily deals: 3-6 specific unit cards for coins, the same for everyone on a date, refreshed at local midnight.
export interface Deal { kind: UnitKind; n: number; price: number; rarity: Rarity; }
export function dailyDeals(day: string, pool: UnitKind[]): Deal[] {
  if (!pool.length) return [];
  const rand = rng(hash(`muster-deals-${day}`));
  const count = Math.min(pool.length, 3 + Math.floor(rand() * 4));
  const left = [...pool], out: Deal[] = [];
  // At most one epic or legendary deal a day; the rest common and rare.
  let big = false;
  while (out.length < count && left.length) {
    const i = Math.floor(rand() * left.length);
    const kind = left.splice(i, 1)[0], rarity = RARITY[kind];
    const isBig = rarity === "epic" || rarity === "legendary";
    if (isBig && big) continue;
    big ||= isBig;
    const n = DEAL_COUNT[rarity];
    out.push({ kind, n, price: n * DEAL_PRICE[rarity], rarity });
  }
  // Commons first, so the cheap pick leads.
  return out.sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
}

// ---------------------------------------------------------------- device-save binding
type WithChests = Save & { chests?: ChestSave };
type Listener = () => void;
const listeners = new Set<Listener>();
const now = () => Date.now();
const progress = (s: Save): Progress => ({ campaign: s.campaign, found: foundKinds() });
const seed = () => (Math.random() * 2 ** 32) >>> 0;

function current(): ChestSave {
  const s = load() as WithChests;
  s.chests = normalizeChests(s.chests);
  return s.chests;
}
function commit<T>(apply: (c: ChestSave, s: Save) => T): T {
  let out!: T;
  save((s) => { const w = s as WithChests; w.chests = normalizeChests(w.chests); tick(w.chests, now()); out = apply(w.chests, s); });
  for (const fn of listeners) fn();
  return out;
}
export const chests = (): Readonly<ChestSave> => current();
/** Game time now (reads only: it never moves the seen-mark without saving). */
export const gameNow = () => Math.max(now(), current().seen);
export const localDay = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export function onChestsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface WinResult extends Drop { crowns: number; crownReady: boolean; }
/** Call once per win: drops the next chest (if a slot is free) and adds today's crowns. */
export function winChest(crowns: number): WinResult {
  const r = commit((c, s) => {
    const d = dropIn(c, progress(s), seed());
    const k = addCrownsIn(c, localDay(), crowns);
    return { ...d, crowns: k.crowns, crownReady: !k.claimed && k.crowns >= CROWNS_FOR_CHEST };
  });
  passEvent({ kind: "win", stars: crowns }); // [pass] quests + pass XP: every win drops through here
  return r;
}
/** Starts the free-chest clock for a new player (one ready now), so the bank fills even before the first claim. */
export const initChests = () => { if (current().freeFrom < 0) commit((c) => freeBanked(c, c.seen)); };
export const startUnlock = (slot: number) => commit((c) => startIn(c, slot, c.seen));
export const openReady = (slot: number) => commit((c) => takeIn(c, slot, c.seen));
/** Opens a slot now for gems; null if the player can't afford it. */
export function openWithGems(slot: number): Chest | null {
  const cost = commit((c) => skipCost(c, slot, c.seen));
  if (cost > 0 && (!canAfford("gems", cost) || !spend("gems", cost, `chest skip ${slot}`))) return null;
  return commit((c) => rushIn(c, slot, c.seen));
}
export const claimFree = () => commit((c, s) => claimFreeIn(c, progress(s), c.seen, seed()));
export const claimCrown = () => commit((c, s) => claimCrownIn(c, progress(s), localDay(), seed()));
export function buyShopChest(type: SlotChest): Chest | null {
  const offer = SHOP_CHESTS.find((o) => o.type === type);
  if (!offer || !spend("gems", offer.gems, `shop chest ${type}`)) return null;
  return commit((c, s) => shopChestIn(c, type, progress(s), seed()));
}
export const todaysDeals = (): Deal[] => dailyDeals(localDay(), findable(load().campaign, foundKinds()));
export const dealBought = (i: number) => { const c = current(); return c.deals.day === localDay() && c.deals.bought.includes(i); };
export function buyDeal(i: number): { isNew: boolean } | null {
  const d = todaysDeals()[i];
  if (!d || dealBought(i) || !spend("coins", d.price, `deal ${d.kind}`)) return null;
  commit((c) => { if (c.deals.day !== localDay()) c.deals = { day: localDay(), bought: [] }; c.deals.bought.push(i); });
  return grantCards(d.kind, d.n, "daily deal");
}

export interface Granted { coins: number; gems: number; cards: (CardStack & { isNew: boolean })[]; }
/** Pays a chest out: coins and gems into the wallet, cards into the collection (noting which units are new). */
export function grantChest(ch: Chest): Granted {
  const { coins, gems, cards } = ch.contents;
  passEvent({ kind: "chest" }); // [pass] "open a chest" quest
  if (coins > 0) earn("coins", coins, `chest ${ch.type}`);
  if (gems > 0) earn("gems", gems, `chest ${ch.type}`);
  return { coins, gems, cards: cards.map((s) => ({ ...s, ...grantCards(s.kind, s.n, `chest ${ch.type}`) })) };
}
/** [pass] A chest from a War Pass reward or a special offer: rolled now, opened by the caller (never takes a slot). */
export const makeChest = (type: SlotChest) => commit((c, s) => shopChestIn(c, type, progress(s), seed()));
/** Debug and review shots: fill the slots with one of each state. */
export function seedDemo() {
  commit((c, s) => {
    const p = progress(s);
    c.slots = Array(SLOTS).fill(null);
    for (const t of ["gilded", "wood", "royal", "legend"] as SlotChest[]) { c.slots[c.slots.indexOf(null)] = make(c, t, seed(), p); }
    startIn(c, 0, c.seen - 5 * HOUR - 21 * MIN);
    c.slots[1]!.startedAt = c.seen - 20 * MIN; c.slots[1]!.readyAt = c.seen - 5 * MIN;
    c.crown = { day: localDay(), crowns: 6, claimed: false };
  });
}
