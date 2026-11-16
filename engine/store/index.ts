// The game's store front: picks a store for the platform. Everything sold is a consumable (gem packs in
// engine/store/gems.ts, the one-time Starter Pack in engine/store/starter.ts); nothing in the game is locked behind a
// purchase, so there is no entitlement to cache and no Restore Purchases.
import { Capacitor } from "@capacitor/core";
import { MOCK_MODES, MockStore, type MockMode } from "./mock";
import { nativeStore } from "./native";
import type { Store } from "./types";

export { STARTER } from "./types";
export type { BuyResult, Product, Store } from "./types";

/** StoreKit on iOS; the mock everywhere else (?store=pending|cancelled|failed|offline picks its behaviour). */
export function createStore(search = ""): Store {
  if (Capacitor.isNativePlatform()) return nativeStore();
  const want = new URLSearchParams(search).get("store") as MockMode | null;
  let storage: Storage | undefined;
  try { storage = globalThis.localStorage; } catch { /* no storage */ }
  return new MockStore({ mode: want && MOCK_MODES.includes(want) ? want : "ok", delay: 350, storage });
}
