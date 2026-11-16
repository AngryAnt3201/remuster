// A stand-in store for web and dev builds, tests and e2e. Behaves like StoreKit from the game's side:
// async products, buy outcomes (picked with `mode`, or ?store=<mode> in the browser), unfinished consumables, events.
// What it "owns" lives in its own storage key, like an Apple ID that outlives a save reset.
import { GEM_PACKS } from "../economy/gems";
import { STARTER_PACK } from "./starter";
import { OFFER_TIERS } from "./offers"; // [pass]
import { PASS, STARTER, type BuyResult, type Product, type Purchase, type Store } from "./types";

export type MockMode = "ok" | "pending" | "cancelled" | "failed" | "offline";
export const MOCK_MODES: MockMode[] = ["ok", "pending", "cancelled", "failed", "offline"];

type KV = Pick<Storage, "getItem" | "setItem">;
export const MOCK_KEY = "muster.mockstore.v1";

/** The mock's catalogue. The price here is the mock's own; the game only ever shows what a store returns. */
export const MOCK_PRODUCTS: Product[] = [
  { id: STARTER, title: "Starter Pack", description: "Gems, coins and unit cards to get your army going. One per player.", displayPrice: `$${STARTER_PACK.usd}`, price: STARTER_PACK.usd },
  ...GEM_PACKS.map((p) => ({ id: p.id, title: `${p.gems.toLocaleString("en")} Gems`, description: `A ${p.name.toLowerCase()} of ${p.gems.toLocaleString("en")} gems.`, displayPrice: `$${p.usd}`, price: p.usd })),
  // [pass] War Pass Premium (once a season, app-enforced) and the special-offer price tiers.
  { id: PASS, title: "War Pass Premium", description: "This season's premium reward track.", displayPrice: "$4.99", price: 4.99 },
  ...Object.values(OFFER_TIERS).map((t) => ({ id: t.id, title: "Special Offer", description: "Limited-time bundle; contents shown in game", displayPrice: `$${t.usd}`, price: t.usd })),
];
/** Every product Muster sells is a consumable (gem packs, the Starter Pack, War Pass Premium, offer tiers). */
const consumable = (id: string) => id === STARTER || id === PASS || id.startsWith("co.inflect.muster.offer.") || GEM_PACKS.some((p) => p.id === id);

function memory(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

export interface MockOptions { mode?: MockMode; delay?: number; storage?: KV }

export class MockStore implements Store {
  readonly kind = "mock" as const;
  mode: MockMode;
  delay: number;
  private kv: KV;
  private subs = new Set<(owned: string[]) => void>();
  private buys = new Set<(p: Purchase) => void>();
  private pending: string[] = [];
  private seq = 0;

  constructor(o: MockOptions = {}) {
    this.mode = o.mode ?? "ok";
    this.delay = o.delay ?? 0;
    this.kv = o.storage ?? memory();
  }

  private wait() { return new Promise<void>((r) => setTimeout(r, this.delay)); }
  private state(): { owned: string[]; open: Purchase[] } {
    try {
      const v = JSON.parse(this.kv.getItem(MOCK_KEY) ?? "{}");
      return { owned: Array.isArray(v.owned) ? v.owned : [], open: Array.isArray(v.open) ? v.open : [] };
    } catch { return { owned: [], open: [] }; }
  }
  private read(): string[] { return this.state().owned; }
  private write(owned: string[], open = this.state().open) {
    try { this.kv.setItem(MOCK_KEY, JSON.stringify({ owned, open })); } catch { /* private mode */ }
  }
  /** A paid, unfinished consumable transaction, kept like StoreKit keeps one until it's finished. */
  private open(productId: string): Purchase {
    const p = { txId: `mock-${Date.now().toString(36)}-${++this.seq}`, productId };
    const st = this.state();
    this.write(st.owned, [...st.open, p]);
    return p;
  }
  private emit() { const o = this.read(); for (const f of this.subs) f(o); }

  async products(ids: string[]): Promise<Product[]> {
    await this.wait();
    if (this.mode === "offline") throw new Error("The store can't be reached.");
    return MOCK_PRODUCTS.filter((p) => ids.includes(p.id)).map((p) => ({ ...p }));
  }

  async buy(id: string): Promise<BuyResult> {
    await this.wait();
    if (!MOCK_PRODUCTS.some((p) => p.id === id)) return { status: "failed", message: "Unknown product." };
    switch (this.mode) {
      case "ok": {
        if (consumable(id)) { const p = this.open(id); return { status: "purchased", ...p }; }
        const o = this.read();
        if (!o.includes(id)) this.write([...o, id]);
        return { status: "purchased" };
      }
      case "pending": if (!this.pending.includes(id)) this.pending.push(id); return { status: "pending" };
      case "cancelled": return { status: "cancelled" };
      case "offline": return { status: "failed", message: "The store can't be reached." };
      default: return { status: "failed", message: "The payment was declined." };
    }
  }

  async restore(): Promise<string[]> {
    await this.wait();
    if (this.mode === "offline") throw new Error("The store can't be reached.");
    return this.read();
  }

  async owned(): Promise<string[]> { return this.read(); }

  onChange(cb: (owned: string[]) => void) { this.subs.add(cb); return () => void this.subs.delete(cb); }

  async unfinished(): Promise<Purchase[]> { return this.state().open.map((p) => ({ ...p })); }
  async finish(txId: string) { const st = this.state(); this.write(st.owned, st.open.filter((p) => p.txId !== txId)); }
  onPurchase(cb: (p: Purchase) => void) { this.buys.add(cb); return () => void this.buys.delete(cb); }

  /** Test hook: a parent approves an Ask to Buy request (arrives as a change, like Transaction.updates). */
  approvePending() {
    if (!this.pending.length) return;
    const gems = this.pending.filter(consumable), rest = this.pending.filter((p) => !consumable(p));
    this.pending = [];
    for (const id of gems) { const p = this.open(id); for (const f of this.buys) f({ ...p }); }
    if (!rest.length) return;
    const o = this.read();
    this.write([...o, ...rest.filter((p) => !o.includes(p))]);
    this.emit();
  }
  /** Test hook: the store takes a product back (a refund). */
  revoke(id: string) { this.write(this.read().filter((p) => p !== id)); this.emit(); }
}
