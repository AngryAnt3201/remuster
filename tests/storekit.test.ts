// The native side of the store: the JS bridge (engine/store/native.ts) against a fake MusterStore plugin, and the
// files that make the Swift plugin real (ios/MusterStore, ios/App/Muster.storekit, the App scheme, cap sync output).
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cap = vi.hoisted(() => ({
  native: true,
  available: true,
  plugin: null as null | Record<string, (...a: any[]) => any>,
  listeners: [] as ((e: { owned: string[] }) => void)[],
  buys: [] as ((e: unknown) => void)[],
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => cap.native,
    isPluginAvailable: (name: string) => cap.available && name === "MusterStore",
  },
  registerPlugin: (name: string) => {
    if (name !== "MusterStore") throw new Error(`unexpected plugin ${name}`);
    return new Proxy({}, { get: (_t, k: string) => cap.plugin?.[k] });
  },
}));

import { createStore } from "../engine/store";
import { NativeStore, PLUGIN_NAME, UnavailableStore } from "../engine/store/native";
import { STARTER } from "../engine/store/types";

/** A non-consumable the plugin could sell later (Muster sells none today; restore and owned stay in the bridge). */
const LATER = "co.inflect.muster.later";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function fakePlugin(over: Record<string, (...a: any[]) => any> = {}) {
  cap.listeners = [];
  cap.plugin = {
    getProducts: async () => ({
      products: [
        { id: STARTER, title: "Starter Pack", description: "Gems, coins and cards", displayPrice: "A$7.99" },
        { id: "co.inflect.muster.other", title: "Other", description: "", displayPrice: "$1" },
      ],
    }),
    purchase: async () => ({ status: "purchased" }),
    restore: async () => ({ owned: [LATER] }),
    owned: async () => ({ owned: [] }),
    unfinished: async () => ({ purchases: [] }),
    finish: async () => ({ finished: true }),
    addListener: async (event: string, cb: (e: any) => void) => {
      if (event === "purchase") {
        cap.buys.push(cb);
        return { remove: async () => { cap.buys = cap.buys.filter((f) => f !== cb); } };
      }
      expect(event).toBe("ownedChanged");
      cap.listeners.push(cb);
      return { remove: async () => { cap.listeners = cap.listeners.filter((f) => f !== cb); } };
    },
    ...over,
  };
}

beforeEach(() => { cap.native = true; cap.available = true; cap.buys = []; fakePlugin(); });

describe("NativeStore (JS bridge to the StoreKit plugin)", () => {
  it("is what a native build gets when the plugin is registered, and never on the web", () => {
    expect(createStore("").kind).toBe("native");
    expect(createStore("") instanceof NativeStore).toBe(true);
    cap.available = false;
    expect(createStore("")).toBeInstanceOf(UnavailableStore);
    cap.native = false;
    expect(createStore("").kind).toBe("mock");
  });

  it("passes the store's own price string through untouched and drops ids it didn't ask for", async () => {
    const ps = await new NativeStore().products([STARTER]);
    expect(ps).toEqual([{ id: STARTER, title: "Starter Pack", description: "Gems, coins and cards", displayPrice: "A$7.99" }]);
  });

  it("maps every purchase status, and turns a throw or an unknown reply into failed", async () => {
    for (const status of ["purchased", "pending", "cancelled", "failed"] as const) {
      fakePlugin({ purchase: async () => ({ status, message: status === "failed" ? "Declined." : undefined }) });
      const r = await new NativeStore().buy(STARTER);
      expect(r.status).toBe(status);
      if (status === "failed") expect(r.message).toBe("Declined.");
    }
    fakePlugin({ purchase: async () => { throw new Error("bridge gone"); } });
    expect(await new NativeStore().buy(STARTER)).toEqual({ status: "failed", message: "bridge gone" });
    fakePlugin({ purchase: async () => ({ status: "weird" }) });
    expect((await new NativeStore().buy(STARTER)).status).toBe("failed");
  });

  it("restores, reads owned, and forwards ownedChanged until unsubscribed", async () => {
    const s = new NativeStore();
    expect(await s.restore()).toEqual([LATER]);
    expect(await s.owned()).toEqual([]);
    const seen: string[][] = [];
    const off = s.onChange((o) => seen.push(o));
    await Promise.resolve();
    cap.listeners.forEach((f) => f({ owned: [LATER] }));
    expect(seen).toEqual([[LATER]]);
    off();
    await new Promise((r) => setTimeout(r, 0));
    expect(cap.listeners).toHaveLength(0);
  });

  it("passes a consumable's unfinished transaction through, and drops malformed ones", async () => {
    const gem = "co.inflect.muster.gems.sack";
    fakePlugin({ purchase: async () => ({ status: "purchased", txId: "2000000123", productId: gem }) });
    expect(await new NativeStore().buy(gem)).toEqual({ status: "purchased", message: undefined, txId: "2000000123", productId: gem });
    fakePlugin({ purchase: async () => ({ status: "purchased", txId: 42, productId: gem }) });
    expect(await new NativeStore().buy(gem)).toEqual({ status: "purchased", message: undefined });
    const finished: string[] = [];
    fakePlugin({
      unfinished: async () => ({ purchases: [{ txId: "1", productId: gem }, { txId: "", productId: gem }, { nope: true }] }),
      finish: async ({ txId }: { txId: string }) => { finished.push(txId); return { finished: true }; },
    });
    const s = new NativeStore();
    expect(await s.unfinished()).toEqual([{ txId: "1", productId: gem }]);
    await s.finish("1");
    expect(finished).toEqual(["1"]);
    const seen: unknown[] = [];
    const off = s.onPurchase((p) => seen.push(p));
    await Promise.resolve();
    cap.buys.forEach((f) => { f({ txId: "7", productId: gem }); f({ txId: "" }); });
    expect(seen).toEqual([{ txId: "7", productId: gem }]);
    off();
    await new Promise((r) => setTimeout(r, 0));
    expect(cap.buys).toHaveLength(0);
  });

  it("lets a failed restore reject so the Shop can say the store is unreachable", async () => {
    fakePlugin({ restore: async () => { throw new Error("sync failed"); } });
    await expect(new NativeStore().restore()).rejects.toThrow("sync failed");
  });
});

describe("MusterStore Swift plugin and StoreKit config", () => {
  const swift = read("ios/MusterStore/ios/Sources/MusterStorePlugin/MusterStorePlugin.swift");
  const core = read("ios/MusterStore/ios/Sources/MusterStorePlugin/StoreKitStore.swift");

  it("is a local npm package that cap sync links into the app's Swift package", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.dependencies["muster-store"]).toBe("file:ios/MusterStore");
    const plugin = JSON.parse(read("ios/MusterStore/package.json"));
    expect(plugin.name).toBe("muster-store");
    expect(plugin.capacitor.ios.src).toBe("ios");
    // cap sync names the Swift package after the npm name: muster-store -> MusterStore
    expect(read("ios/MusterStore/Package.swift")).toMatch(/name: "MusterStore"[\s\S]*\.library\(name: "MusterStore"/);
    const capApp = read("ios/App/CapApp-SPM/Package.swift");
    expect(capApp).toContain('.package(name: "MusterStore", path: "../../MusterStore")');
    expect(capApp).toContain('.product(name: "MusterStore", package: "MusterStore")');
    expect(existsSync(resolve(root, "ios/App/CapApp-SPM", "../../MusterStore/Package.swift"))).toBe(true);
  });

  it("is synced through tools/cap-sync.mjs everywhere, so a missing npm link can't drop the plugin", () => {
    expect(JSON.parse(read("package.json")).scripts["cap:sync"]).toContain("node tools/cap-sync.mjs");
    expect(read("tools/ios-release.sh")).toContain("node tools/cap-sync.mjs");
    expect(read("tools/ios-release.sh")).not.toMatch(/npx cap sync/);
  });

  it("registers under the name the JS bridge uses, with the methods it calls", () => {
    expect(swift).toMatch(/@objc\(MusterStorePlugin\)\s*public class MusterStorePlugin: CAPPlugin, CAPBridgedPlugin/);
    expect(swift).toContain(`public let jsName = "${PLUGIN_NAME}"`);
    const methods = [...swift.matchAll(/CAPPluginMethod\(name: "(\w+)"/g)].map((m) => m[1]).sort();
    expect(methods).toEqual(["finish", "getProducts", "owned", "purchase", "restore", "unfinished"]);
    for (const m of methods) expect(swift).toContain(`@objc func ${m}(_ call: CAPPluginCall)`);
    expect(swift).toContain('notifyListeners("ownedChanged"');
    expect(swift).toMatch(/notifyListeners\("purchase", data: \[[^\]]*\], retainUntilConsumed: true\)/);
  });

  it("uses StoreKit 2 only: purchase, AppStore.sync, currentEntitlements and Transaction.updates", () => {
    for (const api of ["Product.products(for:", "product.purchase(confirmIn: scene)", "product.purchase()", "AppStore.sync()", "Transaction.currentEntitlements", "Transaction.updates", "Transaction.unfinished", "transaction.finish()", ".unverified", ".pending", ".userCancelled"])
      expect(core).toContain(api);
    expect(core).not.toMatch(/SKPaymentQueue|RevenueCat|import (?!Foundation|StoreKit|UIKit)\w+/);
  });

  it("leaves a consumable (gem pack) unfinished until the game has saved its credit", () => {
    // In buy(): a verified consumable returns its transaction id before any finish() call.
    const buy = core.slice(core.indexOf("public func buy("), core.indexOf("public func restore("));
    const consumable = buy.indexOf("transaction.productType == .consumable");
    expect(consumable).toBeGreaterThan(0);
    expect(buy.indexOf(".purchasedUnfinished(")).toBeGreaterThan(consumable);
    expect(buy.indexOf(".purchasedUnfinished(")).toBeLessThan(buy.indexOf("await transaction.finish()"));
    // The launch sweep only finishes non-consumables; updates hand consumables to the game unfinished.
    expect(core).toContain("t.productType != .consumable { await t.finish() }");
    expect(core).toContain("public func unfinishedConsumables()");
    expect(core).toContain("public func finish(_ txId: String)");
    expect(swift).toContain('reply["txId"] = p.txId');
  });

  it("ships a .storekit file with the US$4.99 Starter Pack consumable and no non-consumables, matching the App Store Connect copy", () => {
    const sk = JSON.parse(read("ios/App/Muster.storekit"));
    const meta = JSON.parse(read("store/metadata.json")).inAppPurchase;
    expect(sk.products.filter((x: { type: string }) => x.type === "NonConsumable")).toHaveLength(0);
    expect(sk.products.some((x: { productID: string }) => x.productID === "co.inflect.muster.fullarmy")).toBe(false);
    const p = sk.products[0];
    expect(p.productID).toBe(STARTER);
    expect(p.productID).toBe(meta.productId);
    expect(p.type).toBe("Consumable");
    expect(meta.type).toBe("Consumable");
    expect(p.displayPrice).toBe("4.99");
    expect(meta.price).toContain("USD 4.99");
    expect(p.familyShareable).toBe(false);
    expect(p.localizations[0]).toMatchObject({ locale: "en_US", displayName: meta.displayName, description: meta.description });
    expect(sk.settings._storefront).toBe("USA");
  });

  it("is attached to the shared App scheme's Run action (path relative to App.xcodeproj)", () => {
    const scheme = read("ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme");
    const ref = scheme.match(/<LaunchAction[\s\S]*<StoreKitConfigurationFileReference\s+identifier = "([^"]+)"/)?.[1];
    expect(ref).toBe("../Muster.storekit");
    expect(existsSync(resolve(root, "ios/App/App.xcodeproj", ref!))).toBe(true);
    const target = read("ios/App/App.xcodeproj/project.pbxproj").match(/(\w{24}) \/\* App \*\/ = \{\s*isa = PBXNativeTarget;/)?.[1];
    expect(target).toBeTruthy();
    expect(scheme).toContain(`BlueprintIdentifier = "${target}"`);
  });
});
