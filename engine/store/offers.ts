// [pass] Special offers: 2-3 limited-time bundles in the Shop (gems + coins + unit cards + a chest), the same for
// everyone in a 2-day window (seeded by the window, from the War Pass epoch), each buyable once while it's up.
// They sell through four generic consumable price tiers (co.inflect.muster.offer.t1-t4) whose App Store description
// says only "Limited-time bundle; contents shown in game": what a tier pays is decided here, never by the store.
// Value is shown honestly: "3x value" is the bundle's worth in gems (coins at 10 a gem, cards at the daily-deal coin
// price, the chest at its Shop gem price) over the gems the gem-pack ladder gives for the same money, rounded down.
// The chest's contents are random with the odds its info sheet shows (the offer card links to them).
import type { UnitKind } from "../core/defs";
import { GEM_PACKS } from "../economy/gems";
import { RARITIES, RARITY, type Rarity } from "../progression/collection";
import { CHESTS, DEAL_PRICE, hash, rng, type SlotChest } from "../progression/chests";
import { SEASON_EPOCH, chestGems } from "../progression/pass";

export const OFFER_PREFIX = "co.inflect.muster.offer.";
export type OfferTier = "t1" | "t2" | "t3" | "t4";
export const OFFER_TIERS: Record<OfferTier, { id: string; usd: number }> = {
  t1: { id: `${OFFER_PREFIX}t1`, usd: 1.99 },
  t2: { id: `${OFFER_PREFIX}t2`, usd: 4.99 },
  t3: { id: `${OFFER_PREFIX}t3`, usd: 9.99 },
  t4: { id: `${OFFER_PREFIX}t4`, usd: 19.99 },
};
export const OFFER_IDS = Object.values(OFFER_TIERS).map((t) => t.id);
export const tierOfProduct = (id: string) => (Object.keys(OFFER_TIERS) as OfferTier[]).find((t) => OFFER_TIERS[t].id === id);

export interface OfferTemplate { tier: OfferTier; name: string; gems: number; coins: number; cards: { rarity: Rarity; n: number }; chest: SlotChest }
/** Each tier has a few names and looks; contents are fixed per template. All work out at 3x value or better. */
export const OFFER_TEMPLATES: OfferTemplate[] = [
  { tier: "t1", name: "Scout's Satchel", gems: 200, coins: 2000, cards: { rarity: "common", n: 30 }, chest: "gilded" },
  { tier: "t1", name: "Recruit's Purse", gems: 180, coins: 2200, cards: { rarity: "rare", n: 3 }, chest: "gilded" },
  { tier: "t2", name: "Captain's Bundle", gems: 700, coins: 5000, cards: { rarity: "rare", n: 12 }, chest: "royal" },
  { tier: "t2", name: "Quartermaster's Crate", gems: 650, coins: 6000, cards: { rarity: "epic", n: 1 }, chest: "royal" },
  { tier: "t3", name: "Warlord's Hoard", gems: 1600, coins: 12000, cards: { rarity: "epic", n: 3 }, chest: "royal" },
  { tier: "t3", name: "Siege Chest", gems: 1500, coins: 14000, cards: { rarity: "epic", n: 3 }, chest: "royal" },
  { tier: "t4", name: "Legend's Cache", gems: 3600, coins: 25000, cards: { rarity: "legendary", n: 1 }, chest: "legend" },
];

const DAY = 86_400_000;
export const OFFER_WINDOW_MS = 2 * DAY;
export const windowAt = (now: number) => Math.max(0, Math.floor((now - SEASON_EPOCH) / OFFER_WINDOW_MS));
export const windowEnd = (w: number) => SEASON_EPOCH + (w + 1) * OFFER_WINDOW_MS;

export interface Offer extends OfferTemplate { id: string; productId: string; window: number; endsAt: number; unitSeed: number }

const make = (t: OfferTemplate, w: number, unitSeed: number): Offer =>
  ({ ...t, cards: { ...t.cards }, id: `w${w}-${t.tier}`, productId: OFFER_TIERS[t.tier].id, window: w, endsAt: windowEnd(w), unitSeed });

/** The window's offers: 2 or 3, always one small (t1/t2) and one big (t3/t4), cheapest first. Same for everyone. */
export function offersFor(w: number): Offer[] {
  const rand = rng(hash(`muster-offers-${w}`));
  const pick = (ts: OfferTier[]) => ts[Math.floor(rand() * ts.length)];
  const tiers = new Set<OfferTier>([pick(["t1", "t2"]), pick(["t3", "t4"])]);
  if (rand() < 0.5) tiers.add(pick((["t1", "t2", "t3", "t4"] as OfferTier[]).filter((t) => !tiers.has(t))));
  return [...tiers].sort().map((t) => {
    const ts = OFFER_TEMPLATES.filter((x) => x.tier === t);
    return make(ts[Math.floor(rand() * ts.length)], w, Math.floor(rand() * 1e9));
  });
}
export const activeOffers = (now: number) => offersFor(windowAt(now));

/**
 * The unit an offer's cards are for: picked by the offer's seed from the units of that rarity the player can find
 * (so it's shown before buying and never random after). With none of that rarity yet, it drops a rarity at the same
 * coin value. Null when the player can find nothing at all yet (cards then pay as coins, see offerPayout).
 */
export function offerCards(o: Pick<Offer, "cards" | "unitSeed">, pool: UnitKind[]): { kind: UnitKind; n: number; rarity: Rarity } | null {
  for (let i = RARITIES.indexOf(o.cards.rarity); i >= 0; i--) {
    const r = RARITIES[i], units = pool.filter((u) => RARITY[u] === r);
    if (!units.length) continue;
    return { kind: units[o.unitSeed % units.length], n: Math.max(1, Math.round((o.cards.n * DEAL_PRICE[o.cards.rarity]) / DEAL_PRICE[r])), rarity: r };
  }
  return null;
}

/** The bundle's worth in gems. */
export function offerGems(o: OfferTemplate): number {
  return o.gems + o.coins / 10 + (o.cards.n * DEAL_PRICE[o.cards.rarity]) / 10 + chestGems(o.chest);
}
/** Gems per unit of money from the gem-pack ladder at this price: the biggest pack that costs no more. */
export function ladderRate(usd: number, prices: Record<string, number | undefined> = {}): number {
  const at = (id: string, d: number) => (prices[id] && prices[id]! > 0 ? prices[id]! : d);
  const packs = GEM_PACKS.filter((p) => p.usd <= usd + 1e-9);
  const p = packs[packs.length - 1] ?? GEM_PACKS[0];
  return p.gems / at(p.id, p.usd);
}
/** "Nx value": the bundle's gem worth over what the same money buys in gem packs, rounded down (never overstated). */
export function offerValueX(o: OfferTemplate, prices: Record<string, number | undefined> = {}): number {
  const id = OFFER_TIERS[o.tier].id, usd = OFFER_TIERS[o.tier].usd;
  const price = prices[id] && prices[id]! > 0 ? prices[id]! : usd;
  // Live prices in another currency: compare against the pack ladder in that same currency.
  const rate = ladderRate(usd, prices);
  return Math.floor(offerGems(o) / (price * rate));
}

// ---------------------------------------------------------------- the save
export interface OfferSave {
  /** Offer ids bought (one each while it's up). */
  bought: string[];
  /** App Store transaction ids already credited. */
  txIds: string[];
  /** Which offer a tier's purchase was for, saved before the buy so a late Ask to Buy still pays that offer. */
  intent: { productId: string; offer: Offer }[];
}
export const blankOffers = (): OfferSave => ({ bought: [], txIds: [], intent: [] });
export function normalizeOffers(o: Partial<OfferSave> | undefined): OfferSave {
  const strs = (a: unknown) => (Array.isArray(a) ? a.filter((x) => typeof x === "string") : []);
  return {
    bought: strs(o?.bought).slice(-100), txIds: strs(o?.txIds).slice(-200),
    intent: Array.isArray(o?.intent) ? o!.intent.filter((x) => x && typeof x.productId === "string" && x.offer?.id) : [],
  };
}
export const offerBought = (s: OfferSave, id: string) => s.bought.includes(id);
/** Records which offer a tier's buy is for (one intent per product id). */
export function intendIn(s: OfferSave, o: Offer) {
  s.intent = [...s.intent.filter((x) => x.productId !== o.productId), { productId: o.productId, offer: o }];
}

/**
 * Credits one offer transaction, once per txId. Pays the offer the buy was for (its saved intent), else the offer up
 * now at that tier, else that tier's first template. Returns the offer to pay, or null for a duplicate.
 */
export function creditOfferIn(s: OfferSave, txId: string, productId: string, now: number): Offer | null {
  const tier = tierOfProduct(productId);
  if (!txId || !tier || s.txIds.includes(txId)) return null;
  s.txIds = [...s.txIds, txId].slice(-200);
  const meant = s.intent.find((x) => x.productId === productId)?.offer;
  const w = windowAt(now);
  const o = meant ?? activeOffers(now).find((x) => x.productId === productId) ?? make(OFFER_TEMPLATES.find((t) => t.tier === tier)!, w, 0);
  s.intent = s.intent.filter((x) => x.productId !== productId);
  if (!s.bought.includes(o.id)) s.bought = [...s.bought, o.id].slice(-100);
  return o;
}

/** What paying an offer means for this player: cards resolved to a unit, or their coin value if no unit is findable yet. */
export function offerPayout(o: Offer, pool: UnitKind[]) {
  const cards = offerCards(o, pool);
  const extraCoins = cards ? 0 : o.cards.n * DEAL_PRICE[o.cards.rarity];
  return { gems: o.gems, coins: o.coins + extraCoins, cards, chest: o.chest, chestName: CHESTS[o.chest].name };
}
