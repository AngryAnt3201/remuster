// StoreKit 2 on iOS, through the local MusterStore Capacitor plugin (no third-party SDK):
// ios/MusterStore/ios/Sources/MusterStorePlugin/ (npm "muster-store": "file:ios/MusterStore", linked by tools/cap-sync.mjs).
// The plugin's side of the contract, which the Swift code matches (tests/storekit.test.ts checks the names):
//   getProducts({ ids: string[] })  -> { products: { id, title, description, displayPrice, price }[] }   Product.products(for:)
//   purchase({ id: string })        -> { status: "purchased" | "pending" | "cancelled" | "failed", message?, txId?, productId? }
//                                      product.purchase(): .success(verified) -> purchased. A non-consumable is finished
//                                      there; a consumable (gem pack, Starter Pack) is NOT: it comes back with txId for the game to
//                                      credit, then finish. .pending -> pending, .userCancelled -> cancelled,
//                                      unverified or thrown -> failed
//   restore()                       -> { owned: string[] }   AppStore.sync(), then Transaction.currentEntitlements
//   owned()                         -> { owned: string[] }   Transaction.currentEntitlements (verified, not revoked)
//   unfinished()                    -> { purchases: { txId, productId }[] }   verified consumables in Transaction.unfinished
//   finish({ txId: string })        -> { finished: boolean } finishes that consumable transaction (after its credit is saved)
//   event "ownedChanged"            -> { owned: string[] }   from Transaction.updates (Ask to Buy, refunds, other devices)
//   event "purchase"                -> { txId, productId }   a consumable from Transaction.updates (kept until a listener)
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { BuyResult, BuyStatus, Product, Purchase, Store } from "./types";

export const PLUGIN_NAME = "MusterStore";

interface MusterStorePlugin {
  getProducts(o: { ids: string[] }): Promise<{ products: Product[] }>;
  purchase(o: { id: string }): Promise<{ status: BuyStatus; message?: string; txId?: string; productId?: string }>;
  restore(): Promise<{ owned: string[] }>;
  owned(): Promise<{ owned: string[] }>;
  unfinished(): Promise<{ purchases: Purchase[] }>;
  finish(o: { txId: string }): Promise<{ finished: boolean }>;
  addListener(event: "ownedChanged", cb: (e: { owned: string[] }) => void): Promise<PluginListenerHandle>;
  addListener(event: "purchase", cb: (e: Purchase) => void): Promise<PluginListenerHandle>;
}
const isPurchase = (p: unknown): p is Purchase =>
  !!p && typeof (p as Purchase).txId === "string" && !!(p as Purchase).txId && typeof (p as Purchase).productId === "string";

const STATUSES: BuyStatus[] = ["purchased", "pending", "cancelled", "failed"];

export class NativeStore implements Store {
  readonly kind = "native" as const;
  private plugin = registerPlugin<MusterStorePlugin>(PLUGIN_NAME);

  async products(ids: string[]) {
    const r = await this.plugin.getProducts({ ids });
    return (r.products ?? []).filter((p) => ids.includes(p.id));
  }
  async buy(id: string): Promise<BuyResult> {
    try {
      const r = await this.plugin.purchase({ id });
      if (!STATUSES.includes(r.status)) return { status: "failed", message: "Unexpected reply from the store." };
      const out: BuyResult = { status: r.status, message: r.message };
      if (r.status === "purchased" && isPurchase(r)) { out.txId = r.txId; out.productId = r.productId; }
      return out;
    } catch (e) {
      return { status: "failed", message: e instanceof Error ? e.message : String(e) };
    }
  }
  async restore() { return (await this.plugin.restore()).owned ?? []; }
  async owned() { return (await this.plugin.owned()).owned ?? []; }
  onChange(cb: (owned: string[]) => void) {
    const h = this.plugin.addListener("ownedChanged", (e) => cb(e.owned ?? []));
    return () => void h.then((x) => x.remove()).catch(() => undefined);
  }
  async unfinished() { return ((await this.plugin.unfinished()).purchases ?? []).filter(isPurchase); }
  async finish(txId: string) { await this.plugin.finish({ txId }); }
  onPurchase(cb: (p: Purchase) => void) {
    const h = this.plugin.addListener("purchase", (e) => { if (isPurchase(e)) cb({ txId: e.txId, productId: e.productId }); });
    return () => void h.then((x) => x.remove()).catch(() => undefined);
  }
}

/** A native build without the plugin: nothing to buy (the whole game is free to play anyway). */
export class UnavailableStore implements Store {
  readonly kind = "unavailable" as const;
  async products(): Promise<Product[]> { throw new Error("The App Store isn't available."); }
  async buy(): Promise<BuyResult> { return { status: "failed", message: "The App Store isn't available." }; }
  async restore(): Promise<string[]> { throw new Error("The App Store isn't available."); }
  async owned(): Promise<string[]> { throw new Error("The App Store isn't available."); }
  onChange() { return () => undefined; }
  async unfinished(): Promise<Purchase[]> { return []; }
  async finish() { /* nothing to finish */ }
  onPurchase() { return () => undefined; }
}

export const nativeStore = (): Store => (Capacitor.isPluginAvailable(PLUGIN_NAME) ? new NativeStore() : new UnavailableStore());
