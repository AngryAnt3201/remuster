// The Starter Pack: a one-time offer of gems, coins and unit cards. Nothing in Muster is locked behind it (every act,
// level, Gauntlet and puzzle is free to play); it only gets a new player further, faster.
// In the App Store it is a Consumable (co.inflect.muster.starter) that the app sells once: the Shop hides it after
// it's bought. Like the gem packs (engine/store/gems.ts), a purchase is credited once per transaction and saved before
// the store is told it's finished, so a crash between paying and crediting is picked up on the next launch.
import type { UnitKind } from "../core/defs";
import { GEM_PACKS } from "../economy/gems";
import { STARTER, type BuyResult, type Product, type Purchase, type Store } from "./types";

export { STARTER } from "./types";

export interface StarterPackDef {
  /** App Store product id (Consumable). Never changes once created in App Store Connect. */
  id: string;
  /** The US base price set in App Store Connect. Docs and tests only: the Shop shows StoreKit's displayPrice. */
  usd: number;
  gems: number;
  coins: number;
  /** Unit cards, through the shared card contract (engine/progression/collection.ts grantCards). */
  cards: [UnitKind, number][];
}

/**
 * What the pack pays. Cards are for units every player meets in Acts 1-3 (rarity from RARITY in
 * engine/progression/collection.ts): 120 common, 20 rare, 2 epic.
 */
export const STARTER_PACK: StarterPackDef = {
  id: STARTER,
  usd: 4.99,
  gems: 1200,
  coins: 6000,
  cards: [["blades", 40], ["ranger", 40], ["medic", 40], ["bulwark", 10], ["lancer", 10], ["shade", 2]],
};

/** Coins per gem at the Shop's coin-bundle rate (engine/economy/gems.ts COIN_BUNDLES, before bulk bonus). */
export const COINS_PER_GEM = 10;
/** The pack's gems plus its coins counted in gems. Cards are on top of this. */
export const starterGemValue = (p: StarterPackDef = STARTER_PACK) => p.gems + Math.round(p.coins / COINS_PER_GEM);
export const starterCardCount = (p: StarterPackDef = STARTER_PACK) => p.cards.reduce((n, [, c]) => n + c, 0);

/**
 * How many times the gems-per-money of the gem pack at the same US price (the Sack), from live store prices when
 * known. Rounded down, so the "4x value" flag never overstates it.
 */
export function starterValueX(prices: Record<string, number | undefined> = {}, p: StarterPackDef = STARTER_PACK): number {
  const ref = GEM_PACKS.find((g) => g.usd === p.usd) ?? GEM_PACKS[0];
  const price = (id: string, usd: number) => (prices[id] && prices[id]! > 0 ? prices[id]! : usd);
  const mine = starterGemValue(p) / price(p.id, p.usd);
  const theirs = ref.gems / price(ref.id, ref.usd);
  return Math.floor(mine / theirs);
}

// ---------------------------------------------------------------- the save

/** What the save keeps about store purchases. Older saves may still hold a Full Army record: it is ignored. */
export interface StoreSave { starter?: { txId: string; at: number } }
export interface StarterSave { store?: StoreSave }

export const starterBought = (s: StarterSave) => !!s.store?.starter;
/** Marks the pack bought. Returns true when it changed the save. Drops anything else an old save kept there. */
export function markStarter(s: StarterSave, txId: string, now = Date.now()): boolean {
  if (starterBought(s)) return false;
  s.store = { starter: { txId, at: now } };
  return true;
}

/** Where the pack's contents go. The device binding is in base/src/main.ts (wallet, card collection, save). */
export interface StarterPayout {
  /** Credits gems once per transaction and saves it (engine/economy/wallet.ts creditPurchase). False if already paid. */
  creditGems(txId: string, gems: number): boolean;
  earnCoins(coins: number): void;
  grantCards(kind: UnitKind, n: number): void;
  markBought(txId: string): void;
}

/**
 * Pays one Starter Pack transaction. The wallet's per-transaction check runs first, so a transaction reported twice
 * (the buy, Transaction.updates and the launch sweep) never pays twice. True when it paid now.
 */
export function payStarter(txId: string, out: StarterPayout, p: StarterPackDef = STARTER_PACK): boolean {
  if (!txId || !out.creditGems(txId, p.gems)) return false;
  out.earnCoins(p.coins);
  for (const [k, n] of p.cards) out.grantCards(k, n);
  out.markBought(txId);
  return true;
}

// ---------------------------------------------------------------- the store side

/** Pays a Starter Pack transaction and saves it. True when it paid now, false when it was already paid. */
export type StarterCredit = (txId: string) => boolean;
export interface StarterCredited { txId: string; productId: string }

export class StarterShop {
  private subs = new Set<(c: StarterCredited) => void>();
  private cached: Promise<Product | null> | null = null;
  private stop: (() => void) | null = null;

  constructor(readonly store: Store, private credit: StarterCredit, private bought: () => boolean) {}

  /** Credits a pack that was paid and never finished (a crash, an Ask to Buy approved while closed), then listens. */
  async start() {
    this.stop = this.store.onPurchase((p) => void this.settle(p));
    let open: Purchase[] = [];
    try { open = await this.store.unfinished(); } catch { return; }
    for (const p of open) await this.settle(p);
  }
  dispose() { this.stop?.(); this.stop = null; }

  /** True once the pack has been bought on this save: the Shop stops offering it. */
  owned() { return this.bought(); }

  /** Called after a pack arrives outside a buy (Ask to Buy approved, an interrupted purchase finishing). */
  onCredit(cb: (c: StarterCredited) => void) { this.subs.add(cb); return () => void this.subs.delete(cb); }

  /** The pack's product from the store (cached; a failed fetch is retried next time). Rejects when offline. */
  product(): Promise<Product | null> {
    if (!this.cached) {
      this.cached = this.store.products([STARTER]).then((ps) => ps.find((p) => p.id === STARTER) ?? null);
      this.cached.catch(() => { this.cached = null; });
    }
    return this.cached;
  }

  /** Buys the pack (once). A purchase is credited and saved before the store is told it's finished. */
  async buy(): Promise<BuyResult> {
    if (this.bought()) return { status: "failed", message: "You already have the Starter Pack." };
    const r = await this.store.buy(STARTER);
    if (r.status !== "purchased") return r;
    if (!r.txId) return { status: "failed", message: "The App Store didn't send a transaction to credit." };
    const s = await this.settle({ txId: r.txId, productId: r.productId ?? STARTER }, false);
    if (s === "error") return { status: "failed", message: "It's paid but couldn't be saved. It arrives next time Muster opens." };
    return r;
  }

  /**
   * Credits one Starter Pack transaction (no-op if already credited), then finishes it. Anything else is left for
   * the store to handle. "error" means the credit wasn't saved: it stays unfinished and is retried next launch.
   */
  async settle(p: Purchase, announce = true): Promise<"paid" | "dup" | "error" | null> {
    if (p.productId !== STARTER || !p.txId) return null;
    let paid = false;
    try { paid = this.credit(p.txId); } catch { return "error"; }
    try { await this.store.finish(p.txId); } catch { /* finished next launch; the txId check stops a double pay */ }
    if (!paid) return "dup";
    if (announce) for (const f of this.subs) f({ txId: p.txId, productId: p.productId });
    return "paid";
  }
}
