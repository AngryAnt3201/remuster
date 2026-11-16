// [pass] The shared buy-credit-finish loop for the War Pass and special offers, the same pattern as the Starter Pack
// and gem packs: a purchase is credited (and saved) once per transaction id before the store is told it's finished,
// so a crash between paying and crediting is picked up on the next launch (store.unfinished), and a transaction
// reported twice (the buy, Transaction.updates, the launch sweep) never pays twice. Pending (Ask to Buy) arrives
// later through onPurchase. Products this shop doesn't sell are left alone for the other shops.
import type { BuyResult, Product, Purchase, Store } from "./types";

/** "paid": credited now. "dup": that transaction was credited before. "error": not saved, so left unfinished. */
export type CreditResult = "paid" | "dup" | "error";

export class ConsumableShop<T = unknown> {
  private subs = new Set<(p: Purchase, what: T) => void>();
  private stop: (() => void) | null = null;
  private cached: Promise<Product[]> | null = null;

  /** `credit` pays one transaction and saves it, returning what it paid (null when it was a duplicate). */
  constructor(readonly store: Store, readonly ids: string[], private credit: (p: Purchase) => { paid: boolean; what: T }) {}

  async start() {
    this.stop = this.store.onPurchase((p) => void this.settle(p));
    let open: Purchase[] = [];
    try { open = await this.store.unfinished(); } catch { return; }
    for (const p of open) await this.settle(p);
  }
  dispose() { this.stop?.(); this.stop = null; }

  /** Called after a purchase arrives outside a buy (Ask to Buy approved, an interrupted purchase finishing). */
  onCredit(cb: (p: Purchase, what: T) => void) { this.subs.add(cb); return () => void this.subs.delete(cb); }

  /** This shop's products from the store, in `ids` order (cached; a failed fetch is retried next time). */
  products(): Promise<Product[]> {
    if (!this.cached) {
      this.cached = this.store.products(this.ids).then((ps) => this.ids.map((id) => ps.find((p) => p.id === id)).filter((p): p is Product => !!p));
      this.cached.catch(() => { this.cached = null; });
    }
    return this.cached;
  }

  /** Buys one product; a purchase is credited and saved before it's finished. */
  async buy(id: string): Promise<BuyResult & { what?: T }> {
    if (!this.ids.includes(id)) return { status: "failed", message: "Unknown product." };
    const r = await this.store.buy(id);
    if (r.status !== "purchased") return r;
    if (!r.txId) return { status: "failed", message: "The App Store didn't send a transaction to credit." };
    const s = await this.settle({ txId: r.txId, productId: r.productId ?? id }, false);
    if (s.result === "error") return { status: "failed", message: "It's paid but couldn't be saved. It arrives next time Muster opens." };
    return { ...r, what: s.what };
  }

  /** Credits one transaction (no-op if already credited), then finishes it. Other shops' products are ignored. */
  async settle(p: Purchase, announce = true): Promise<{ result: CreditResult | null; what?: T }> {
    if (!p.txId || !this.ids.includes(p.productId)) return { result: null };
    let out: { paid: boolean; what: T };
    try { out = this.credit(p); } catch { return { result: "error" }; }
    try { await this.store.finish(p.txId); } catch { /* finished next launch; the txId check stops a double pay */ }
    if (!out.paid) return { result: "dup" };
    if (announce) for (const f of this.subs) f(p, out.what);
    return { result: "paid", what: out.what };
  }
}
