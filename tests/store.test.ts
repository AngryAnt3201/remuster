import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { UNIT_KINDS } from "../engine/core/defs";
import { GEM_PACKS } from "../engine/economy/gems";
import { blankWallet, creditPurchaseIn, earnIn } from "../engine/economy/wallet";
import { RARITY, blankCollection, grantIn } from "../engine/progression/collection";
import { createStore } from "../engine/store";
import { GemShop } from "../engine/store/gems";
import { MOCK_KEY, MockStore } from "../engine/store/mock";
import {
  STARTER, STARTER_PACK, StarterShop, markStarter, payStarter, starterBought, starterGemValue, starterValueX, type StarterSave,
} from "../engine/store/starter";

function kv() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

/** A save-shaped device: wallet, card collection and the store record, with the real pure rules behind payStarter. */
function device(store = new MockStore()) {
  const w = blankWallet();
  const c = blankCollection();
  const s: StarterSave = {};
  const saves: string[] = [];
  const credit = vi.fn((txId: string) => payStarter(txId, {
    creditGems: (tx, g) => { const ok = creditPurchaseIn(w, tx, g); saves.push(`gems:${tx}`); return ok; },
    earnCoins: (n) => void earnIn(w, "coins", n),
    grantCards: (k, n) => void grantIn(c, k, n),
    markBought: (tx) => { markStarter(s, tx); saves.push(`bought:${tx}`); },
  }));
  const starter = new StarterShop(store, credit, () => starterBought(s));
  return { store, w, c, s, credit, saves, starter };
}

describe("starter pack", () => {
  it("is the consumable co.inflect.muster.starter at US$4.99", () => {
    expect(STARTER).toBe("co.inflect.muster.starter");
    expect(STARTER_PACK.id).toBe(STARTER);
    expect(STARTER_PACK.usd).toBe(4.99);
  });

  it("is clearly better value than any gem pack: 4x the Sack at the same price, and more than the best pack", () => {
    const sack = GEM_PACKS.find((p) => p.usd === STARTER_PACK.usd)!;
    expect(starterValueX()).toBe(4);
    expect(starterGemValue()).toBeGreaterThanOrEqual(sack.gems * 4);
    const best = Math.max(...GEM_PACKS.map((p) => p.gems / p.usd));
    expect(starterGemValue() / STARTER_PACK.usd).toBeGreaterThan(best * 3);
    // A storefront where the Sack is relatively cheap still never overstates it.
    expect(starterValueX({ [sack.id]: 2.99 })).toBe(2);
  });

  it("holds cards for real units, from every rarity up to epic", () => {
    for (const [k, n] of STARTER_PACK.cards) { expect(UNIT_KINDS).toContain(k); expect(n).toBeGreaterThan(0); }
    const rar = new Set(STARTER_PACK.cards.map(([k]) => RARITY[k]));
    expect([...rar].sort()).toEqual(["common", "epic", "rare"]);
  });

  it("pays gems, coins and every card once per transaction, and marks itself bought", () => {
    const d = device();
    expect(d.credit("tx-1")).toBe(true);
    expect(d.w.gems).toBe(STARTER_PACK.gems);
    expect(d.w.coins).toBe(STARTER_PACK.coins);
    // A unit found for the first time uses one card (engine/progression/collection.ts); the rest are spares.
    for (const [k, n] of STARTER_PACK.cards) expect((d.c.cards[k] ?? 0) + (d.c.found.includes(k) ? 1 : 0), k).toBe(n);
    expect(starterBought(d.s)).toBe(true);
    expect(d.credit("tx-1")).toBe(false);
    expect(d.w.gems).toBe(STARTER_PACK.gems);
    expect(d.w.coins).toBe(STARTER_PACK.coins);
  });

  it("drops an old Full Army record from the save: legacy grandfathering simply goes away", () => {
    const s = { store: { fullArmy: true, source: "legacy" } } as unknown as StarterSave;
    expect(starterBought(s)).toBe(false);
    expect(markStarter(s, "tx", 5)).toBe(true);
    expect(s.store).toEqual({ starter: { txId: "tx", at: 5 } });
    expect(markStarter(s, "tx2")).toBe(false);
  });
});

describe("buying the starter pack", () => {
  it("credits and saves before the transaction is finished, then the Shop stops offering it", async () => {
    const d = device();
    const order: string[] = [];
    const finish = d.store.finish.bind(d.store);
    d.store.finish = async (tx) => { order.push(`finish:${tx}`, ...d.saves.map((x) => `after ${x}`)); await finish(tx); };
    expect(d.starter.owned()).toBe(false);
    const r = await d.starter.buy();
    expect(r.status).toBe("purchased");
    expect(d.credit).toHaveBeenCalledTimes(1);
    expect(order[0]).toMatch(/^finish:/);
    expect(order).toContain(`after gems:${r.txId}`);
    expect(order).toContain(`after bought:${r.txId}`);
    expect(await d.store.unfinished()).toEqual([]);
    expect(d.starter.owned()).toBe(true);
    expect((await d.starter.buy()).status).toBe("failed");
    expect(d.credit).toHaveBeenCalledTimes(1);
  });

  it("reports pending, cancelled and failed without paying or finishing anything", async () => {
    for (const mode of ["pending", "cancelled", "failed", "offline"] as const) {
      const d = device(new MockStore({ mode }));
      const r = await d.starter.buy();
      expect(r.status, mode).toBe(mode === "offline" ? "failed" : mode);
      expect(d.w.gems).toBe(0);
      expect(d.starter.owned()).toBe(false);
      expect(await d.store.unfinished()).toEqual([]);
    }
  });

  it("delivers an approved Ask to Buy once, even when the launch sweep sees it too", async () => {
    const storage = kv();
    const d = device(new MockStore({ storage, mode: "pending" }));
    await d.starter.start();
    expect((await d.starter.buy()).status).toBe("pending");
    const got = new Promise<string>((res) => d.starter.onCredit((c) => res(c.productId)));
    d.store.approvePending();
    expect(await got).toBe(STARTER);
    expect(d.w.gems).toBe(STARTER_PACK.gems);
    await d.starter.start();
    expect(d.w.gems).toBe(STARTER_PACK.gems);
    expect(d.credit).toHaveBeenCalledTimes(1);
  });

  it("leaves a paid pack unfinished when the save fails, and credits it on the next launch", async () => {
    const storage = kv();
    const store = new MockStore({ storage });
    const broken = new StarterShop(store, () => { throw new Error("disk full"); }, () => false);
    const r = await broken.buy();
    expect(r.status).toBe("failed");
    expect(r.message).toMatch(/next time/);
    expect((await store.unfinished()).map((p) => p.productId)).toEqual([STARTER]);

    const d = device(new MockStore({ storage }));
    await d.starter.start();
    expect(d.w.gems).toBe(STARTER_PACK.gems);
    expect(d.starter.owned()).toBe(true);
    expect(await d.store.unfinished()).toEqual([]);
  });

  it("and the gem shop leave each other's transactions alone", async () => {
    const store = new MockStore();
    const d = device(store);
    const w2 = blankWallet();
    const gems = new GemShop(store, (tx, g) => creditPurchaseIn(w2, tx, g));
    const r = await store.buy(STARTER);
    expect(await gems.settle({ txId: r.txId!, productId: STARTER })).toBeNull();
    expect((await store.unfinished()).length).toBe(1);
    expect(await d.starter.settle({ txId: "g1", productId: GEM_PACKS[0].id })).toBeNull();
    await d.starter.start();
    expect(d.w.gems).toBe(STARTER_PACK.gems);
    expect(w2.gems).toBe(0);
  });

  it("retries a failed product fetch", async () => {
    const d = device(new MockStore({ mode: "offline" }));
    await expect(d.starter.product()).rejects.toThrow();
    d.store.mode = "ok";
    expect((await d.starter.product())?.displayPrice).toBe("$4.99");
  });
});

describe("mock store", () => {
  it("lists the Starter Pack and gem packs with store prices and ignores unknown ids", async () => {
    const m = new MockStore();
    const ps = await m.products([STARTER, GEM_PACKS[0].id, "nope"]);
    expect(ps.map((p) => p.id)).toEqual([STARTER, GEM_PACKS[0].id]);
    expect(ps[0].title).toBe("Starter Pack");
  });

  it("sells only consumables: nothing is owned or restored after a buy", async () => {
    const storage = kv();
    const m = new MockStore({ storage });
    await m.buy(STARTER);
    expect(await m.owned()).toEqual([]);
    expect(await m.restore()).toEqual([]);
    expect(JSON.parse(storage.m.get(MOCK_KEY)!).open.length).toBe(1);
  });

  it("is what web and dev builds get, with ?store= picking its behaviour", async () => {
    expect(createStore("").kind).toBe("mock");
    const s = createStore("?store=cancelled") as MockStore;
    s.delay = 0;
    expect((await s.buy(STARTER)).status).toBe("cancelled");
  });
});

describe("content is never gated", () => {
  it("has no gate rules, paywall or act-gate card left in the game", () => {
    const src = ["base/src/main.ts", "base/src/ui/shop.ts", "base/src/ui/gemshop.ts"].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
    expect(src).not.toMatch(/actGated|levelGated|gauntletGated|puzzleGated|paywall|actGateCard|fullArmyOffer|Full Army/);
    expect(src).not.toMatch(/Restore Purchases/);
  });
});
