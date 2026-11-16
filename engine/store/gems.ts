// Gem packs (App Store consumables): buy, credit once per transaction, then finish. The order matters:
// StoreKit keeps re-offering a transaction until it is finished, so finishing only after the credit is saved means
// a crash between paying and crediting is picked up on the next launch, and creditPurchase's txId check means it
// can never pay twice (a buy, Transaction.updates and the launch sweep may all report the same transaction).
import { GEM_PACK_IDS, gemsFor } from "../economy/gems";
import type { BuyResult, Product, Purchase, Store } from "./types";

/** Credits `gems` for `txId` and saves it. True when it paid now, false when that transaction was already paid. */
export type Credit = (txId: string, gems: number) => boolean;

export interface Credited { txId: string; productId: string; gems: number }

export class GemShop {
  private subs = new Set<(c: Credited) => void>();
  private cached: Promise<Product[]> | null = null;
  private stop: (() => void) | null = null;

  constructor(readonly store: Store, private credit: Credit) {}

  /** Credits whatever was paid and never finished (a crash, an Ask to Buy approved while closed), then listens. */
  async start() {
    this.stop = this.store.onPurchase((p) => void this.settle(p));
    let open: Purchase[] = [];
    try { open = await this.store.unfinished(); } catch { return; }
    for (const p of open) await this.settle(p);
  }
  dispose() { this.stop?.(); this.stop = null; }

  /** Called after gems arrive from a store purchase (here, from Transaction.updates or the launch sweep). */
  onCredit(cb: (c: Credited) => void) { this.subs.add(cb); return () => void this.subs.delete(cb); }

  /** The gem packs the store sells, cheapest first (cached; a failed fetch is retried next time). Rejects offline. */
  packs(): Promise<Product[]> {
    if (!this.cached) {
      this.cached = this.store.products(GEM_PACK_IDS).then((ps) => GEM_PACK_IDS.map((id) => ps.find((p) => p.id === id)).filter((p): p is Product => !!p));
      this.cached.catch(() => { this.cached = null; });
    }
    return this.cached;
  }

  /** Buys a pack. A purchase is credited (saved) before the store is told it's finished. */
  async buy(productId: string): Promise<BuyResult & { gems?: number }> {
    if (!gemsFor(productId)) return { status: "failed", message: "Unknown gem pack." };
    const r = await this.store.buy(productId);
    if (r.status !== "purchased") return r;
    if (!r.txId) return { status: "failed", message: "The App Store didn't send a transaction to credit." };
    const c = await this.settle({ txId: r.txId, productId: r.productId ?? productId }, false);
    return { ...r, gems: c?.gems ?? 0 };
  }

  /**
   * Credits one transaction (no-op if already credited) and then finishes it. Only gem packs are touched; anything
   * else is left for the store to handle. Returns what was credited now, or null.
   */
  async settle(p: Purchase, announce = true): Promise<Credited | null> {
    const gems = gemsFor(p.productId);
    if (!gems || !p.txId) return null;
    let paid = false;
    try { paid = this.credit(p.txId, gems); } catch { return null; } // not saved: leave it unfinished for next time
    try { await this.store.finish(p.txId); } catch { /* finished next launch; the txId check stops a double pay */ }
    if (!paid) return null;
    const c = { txId: p.txId, productId: p.productId, gems };
    if (announce) for (const f of this.subs) f(c);
    return c;
  }
}
