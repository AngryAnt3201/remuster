// The in-app store, as the game sees it: the one-time Starter Pack (engine/store/starter.ts) and the gem packs
// (engine/economy/gems.ts), all App Store consumables. Nothing is locked behind a purchase: every act, level, Gauntlet
// and puzzle is free; purchases only speed progress up.
// Implementations: MockStore (web and dev builds, tests, e2e) and NativeStore (StoreKit 2 through the
// local MusterStore Capacitor plugin in ios/). Prices always come from the store, never from the game.

/** The App Store product id of the Starter Pack: a consumable the app sells once (engine/store/starter.ts). */
export const STARTER = "co.inflect.muster.starter";
/** [pass] War Pass Premium: a consumable the app sells once per season (engine/store/pass.ts). */
export const PASS = "co.inflect.muster.pass";

export interface Product {
  id: string;
  /** Localised name and blurb from the store. */
  title: string;
  description: string;
  /** Localised price string from the store (StoreKit `displayPrice`), e.g. "$4.99" or "4,99 €". */
  displayPrice: string;
  /** The price as a number in the storefront's currency (StoreKit `price`), only for comparing packs. Never shown. */
  price?: number;
}

/**
 * A consumable purchase the store has paid for but not finished yet. The game credits it (once per `txId`, saved),
 * then calls `finish(txId)`. Until then StoreKit keeps offering it, so a crash between payment and credit is safe.
 */
export interface Purchase { txId: string; productId: string }

/** How a buy ended. `pending` is Ask to Buy or a payment that still needs action: it may complete later. */
export type BuyStatus = "purchased" | "pending" | "cancelled" | "failed";
export interface BuyResult {
  status: BuyStatus;
  message?: string;
  /** Set for a purchased consumable: the unfinished transaction to credit, then finish. */
  txId?: string;
  productId?: string;
}

export type StoreKind = "mock" | "native" | "unavailable";

export interface Store {
  readonly kind: StoreKind;
  /** Product details for the given ids (missing ids are left out). Rejects when the store can't be reached. */
  products(ids: string[]): Promise<Product[]>;
  /** Starts a purchase. Resolves with how it ended; never rejects. */
  buy(id: string): Promise<BuyResult>;
  /**
   * Syncs with the store (may ask the player to sign in), then lists owned non-consumables. Muster sells none today,
   * so the game shows no Restore Purchases button; the call stays for a future non-consumable.
   */
  restore(): Promise<string[]>;
  /** Owned product ids as the store knows them now, without prompting. */
  owned(): Promise<string[]>;
  /** Called with the full owned list whenever it changes outside a buy (Ask to Buy approved, refund, other device). */
  onChange(cb: (owned: string[]) => void): () => void;
  /** Consumables paid for but not finished (a crash after paying, or an Ask to Buy approved while closed). */
  unfinished(): Promise<Purchase[]>;
  /** Marks a consumable delivered. Call only after its credit is saved. */
  finish(txId: string): Promise<void>;
  /** Called when a consumable arrives outside a buy (Ask to Buy approved, interrupted purchase completed). */
  onPurchase(cb: (p: Purchase) => void): () => void;
}
