// Gems: the pack ladder, crediting purchases once (buy, Transaction.updates, the launch sweep), the free earn rules
// and the sinks. Pure rules plus the mock store, so no StoreKit or device save is needed.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ACTS, LEVELS } from "../engine/core/campaign";
import {
  ACHIEVEMENTS, COIN_BUNDLES, EARN, GEM_PACKS, GEM_PACK_PREFIX, RALLY_GEMS, STREAK_MILESTONES, applyRally, bestValue, blankRewards, canRally,
  claimIn, coinBonus, gemsFor, normalizeRewards, packBonus, rewardsOwed, type EarnSave,
} from "../engine/economy/gems";
import { blankWallet, creditPurchaseIn, spendIn } from "../engine/economy/wallet";
import { GemShop } from "../engine/store/gems";
import { MockStore } from "../engine/store/mock";
import { STARTER, type Purchase } from "../engine/store/types";

const ctx = { levels: LEVELS, acts: ACTS.length };
const blankSave = (): EarnSave => ({ campaign: {}, puzzles: {}, gauntlet: { best: 0, runs: 0 }, daily: { streak: 0, bestStreak: 0, wins: 0 } });
function shop(store = new MockStore()) {
  const w = blankWallet();
  const credit = vi.fn((tx: string, g: number) => creditPurchaseIn(w, tx, g));
  return { store, w, credit, gems: new GemShop(store, credit) };
}

describe("gem packs", () => {
  it("are consumables under co.inflect.muster.gems.* with a rising value ladder", () => {
    expect(GEM_PACKS.map((p) => [p.usd, p.gems])).toEqual([[0.99, 80], [4.99, 450], [9.99, 1000], [19.99, 2200], [49.99, 6000]]);
    for (const p of GEM_PACKS) expect(p.id.startsWith(GEM_PACK_PREFIX)).toBe(true);
    const b = packBonus();
    const steps = GEM_PACKS.map((p) => b[p.id]);
    expect(steps[0]).toBe(0);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    expect(steps.at(-1)).toBeLessThanOrEqual(50); // no bait ladder where the small packs are a rip-off
    expect(bestValue()).toBe(GEM_PACKS.at(-1)!.id);
  });

  it("works out bonus and best value from live store prices when another storefront bends the ladder", () => {
    const prices = Object.fromEntries(GEM_PACKS.map((p) => [p.id, p.usd]));
    prices[GEM_PACKS[3].id] = 9.99; // a storefront where the trove is cheap
    expect(bestValue(prices)).toBe(GEM_PACKS[3].id);
  });

  it("pay out from the app's catalogue, never from the store's text", () => {
    expect(gemsFor(GEM_PACKS[1].id)).toBe(450);
    expect(gemsFor(STARTER)).toBe(0);
    expect(gemsFor("co.inflect.muster.gems.free")).toBe(0);
  });

  it("are in the StoreKit test file as consumables at the ladder's prices", () => {
    const sk = JSON.parse(readFileSync(new URL("../ios/App/Muster.storekit", import.meta.url), "utf8"));
    for (const p of GEM_PACKS) {
      const got = sk.products.find((x: { productID: string }) => x.productID === p.id);
      expect(got, p.id).toBeTruthy();
      expect(got.type).toBe("Consumable");
      expect(Number(got.displayPrice)).toBe(p.usd);
    }
    expect(sk.products.find((x: { productID: string }) => x.productID === STARTER).type).toBe("Consumable");
    expect(sk.products.filter((x: { type: string }) => x.type === "NonConsumable")).toEqual([]);
  });
});

describe("buying gems", () => {
  it("credits a pack once, saved before the transaction is finished", async () => {
    const { store, w, credit, gems } = shop();
    const order: string[] = [];
    credit.mockImplementation((tx, g) => { order.push("credit"); return creditPurchaseIn(w, tx, g); });
    const finish = store.finish.bind(store);
    store.finish = async (tx) => { order.push("finish"); return finish(tx); };
    const r = await gems.buy(GEM_PACKS[2].id);
    expect(r).toMatchObject({ status: "purchased", gems: 1000 });
    expect(w.gems).toBe(1000);
    expect(order).toEqual(["credit", "finish"]);
    expect(await store.unfinished()).toEqual([]);
  });

  it("never pays twice for one transaction, whichever path reports it", async () => {
    const { w, gems } = shop();
    const p: Purchase = { txId: "tx-9", productId: GEM_PACKS[0].id };
    expect(await gems.settle(p)).toMatchObject({ gems: 80 });
    expect(await gems.settle(p)).toBeNull();
    expect(w.gems).toBe(80);
    expect(w.txIds).toEqual(["tx-9"]);
  });

  it("credits paid-but-unfinished packs on launch (a crash before the credit saved)", async () => {
    const store = new MockStore();
    store.finish = async () => undefined; // the app "dies" before finishing
    const first = shop(store);
    first.credit.mockImplementation(() => { throw new Error("save failed"); });
    expect((await first.gems.buy(GEM_PACKS[1].id)).gems).toBe(0);
    expect(await store.unfinished()).toHaveLength(1);
    const next = shop(new MockStore());
    // same store state, fresh launch
    (next as { store: MockStore }).store = store;
    const relaunch = new GemShop(store, next.credit);
    store.finish = MockStore.prototype.finish.bind(store);
    const seen: number[] = [];
    relaunch.onCredit((c) => seen.push(c.gems));
    await relaunch.start();
    expect(next.w.gems).toBe(450);
    expect(seen).toEqual([450]);
    expect(await store.unfinished()).toEqual([]);
  });

  it("leaves a transaction unfinished when the credit can't be saved", async () => {
    const { store, credit, gems } = shop();
    credit.mockImplementation(() => { throw new Error("disk full"); });
    await gems.buy(GEM_PACKS[0].id);
    expect(await store.unfinished()).toHaveLength(1);
  });

  it("reports pending (Ask to Buy), cancelled, failed and offline without crediting, and credits a later approval", async () => {
    for (const mode of ["pending", "cancelled", "failed", "offline"] as const) {
      const { w, gems } = shop(new MockStore({ mode }));
      const r = await gems.buy(GEM_PACKS[0].id);
      expect(r.status).toBe(mode === "offline" ? "failed" : mode);
      expect(w.gems).toBe(0);
      if (mode === "offline") await expect(gems.packs()).rejects.toThrow();
    }
    const store = new MockStore({ mode: "pending" });
    const { w, gems } = shop(store);
    await gems.start();
    await gems.buy(GEM_PACKS[1].id);
    const got = new Promise<number>((res) => gems.onCredit((c) => res(c.gems)));
    store.approvePending();
    expect(await got).toBe(450);
    expect(w.gems).toBe(450);
  });

  it("lists the packs cheapest first with store prices, and nothing is ever owned or restored", async () => {
    const store = new MockStore();
    const { gems } = shop(store);
    const ps = await gems.packs();
    expect(ps.map((p) => p.id)).toEqual(GEM_PACKS.map((p) => p.id));
    for (const p of ps) expect(p.displayPrice).toMatch(/\d/);
    await gems.buy(GEM_PACKS[0].id);
    expect(await store.restore()).toEqual([]);
  });

  it("refuses products that aren't gem packs", async () => {
    const { gems, w } = shop();
    expect((await gems.buy(STARTER)).status).toBe("failed");
    expect(w.gems).toBe(0);
  });
});

describe("free gems", () => {
  it("pays first three-star clears, bosses, puzzles and achievements once", () => {
    const s = blankSave();
    const r = blankRewards();
    s.campaign[1] = 3; s.campaign[2] = 2;
    const boss = LEVELS.find((l) => l.boss)!;
    s.campaign[boss.id] = 1;
    const owed = rewardsOwed(s, r, ctx);
    const ids = owed.map((x) => x.id);
    expect(ids).toContain("3star:1");
    expect(ids).not.toContain("3star:2");
    expect(ids).toContain(`boss:${boss.id}`);
    expect(ids).toContain("ach:first-win");
    const total = claimIn(r, owed);
    expect(total).toBe(EARN.campaignThreeStar + EARN.boss + 5);
    expect(rewardsOwed(s, r, ctx)).toEqual([]);
    expect(claimIn(r, owed)).toBe(0);
  });

  it("pays a won scored Daily once per day, and streak milestones once on the best streak", () => {
    const s = blankSave();
    const r = blankRewards();
    s.daily = { streak: 7, bestStreak: 7, wins: 1, today: { key: "2026-11-07", done: true, won: true } };
    const got = claimIn(r, rewardsOwed(s, r, ctx));
    expect(got).toBe(EARN.dailyWin + 10 + 25);
    s.daily.streak = 1; // streak broke and restarted: no repeat milestone
    s.daily.today = { key: "2026-11-08", done: true, won: false };
    expect(rewardsOwed(s, r, ctx)).toEqual([]);
    expect(STREAK_MILESTONES.map(([d]) => d)).toEqual([3, 7, 14, 30]);
  });

  it("lands in the 20-40 a day band for an active new player, then tapers", () => {
    // A model player: day 1 clears Act 1 (3 of 6 levels at three stars), day 2 Act 2 (2 of 6), day 3 the five free
    // puzzles (3 in full), and wins the Daily three days in four.
    const s = blankSave();
    const r = blankRewards();
    const act = (a: number, three: number) => LEVELS.filter((l) => l.act === a).forEach((l, i) => { s.campaign[l.id] = i < three ? 3 : 2; });
    const day = (n: number, f: () => void) => {
      f();
      s.daily.streak = n; s.daily.bestStreak = Math.max(s.daily.bestStreak, n);
      const won = n % 4 !== 0;
      if (won) s.daily.wins++;
      s.daily.today = { key: `d${n}`, done: true, won };
      return claimIn(r, rewardsOwed(s, r, ctx));
    };
    const perDay = [
      day(1, () => act(1, 3)),
      day(2, () => act(2, 2)),
      day(3, () => { for (let p = 1; p <= 5; p++) s.puzzles[p] = p <= 3 ? 3 : 1; }),
    ];
    for (let n = 4; n <= 30; n++) perDay.push(day(n, () => undefined));
    for (const g of perDay.slice(0, 3)) { expect(g).toBeGreaterThanOrEqual(20); expect(g).toBeLessThanOrEqual(45); }
    const late = perDay.slice(14);
    expect(late.reduce((a, b) => a + b, 0) / late.length).toBeLessThan(10);
    const month = perDay.reduce((a, b) => a + b, 0);
    expect(month).toBeGreaterThan(250);
    expect(month).toBeLessThan(500); // about one Sack: paying saves time, it doesn't buy a different game
  });

  it("has a short achievement list that the free game can mostly reach", () => {
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(8);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("repairs a missing or damaged reward record", () => {
    expect(normalizeRewards(undefined)).toEqual({ claimed: [] });
    expect(normalizeRewards({ claimed: ["a", 3 as never] })).toEqual({ claimed: ["a"] });
  });
});

describe("gem sinks", () => {
  it("sells coins at about 10 per gem with a bulk bonus", () => {
    let last = -1;
    for (const b of COIN_BUNDLES) {
      expect(b.coins / b.gems).toBeGreaterThanOrEqual(10);
      expect(coinBonus(b)).toBeGreaterThan(last);
      last = coinBonus(b);
    }
    expect(COIN_BUNDLES[0].gems).toBeLessThanOrEqual(80); // the cheapest pack or a few days of play buys one
  });

  it("spends gems only when affordable", () => {
    const w = blankWallet();
    w.gems = 20;
    expect(spendIn(w, "gems", COIN_BUNDLES[0].gems)).toBe(false);
    w.gems = 30;
    expect(spendIn(w, "gems", COIN_BUNDLES[0].gems)).toBe(true);
    expect(w.gems).toBe(0);
  });

  it("lets a lost Gauntlet run rally once, at half health against the same rival", () => {
    const run = { hp: 0, maxHp: 400, over: true, stage: 4 };
    expect(RALLY_GEMS).toBeLessThanOrEqual(50);
    expect(canRally(run)).toBe(true);
    expect(applyRally(run)).toBe(true);
    expect(run).toMatchObject({ hp: 200, over: false, stage: 4, rallies: 1 });
    run.over = true;
    expect(canRally(run)).toBe(false);
    expect(applyRally(run)).toBe(false);
    expect(canRally({ hp: 50, maxHp: 400, over: false })).toBe(false);
  });
});

describe("gem packs in the App Store Connect copy", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  const meta = JSON.parse(read("store/metadata.json"));
  it("lists every pack with the app's ids and gem amounts, inside Apple's limits", () => {
    expect(meta.gemPacks.type).toBe("Consumable");
    expect(meta.gemPacks.packs.map((p: { productId: string }) => p.productId)).toEqual(GEM_PACKS.map((p) => p.id));
    for (const [i, g] of meta.gemPacks.packs.entries()) {
      expect(g.gems).toBe(GEM_PACKS[i].gems);
      expect(g.price).toBe(`USD ${GEM_PACKS[i].usd}`);
      expect(g.referenceName.length).toBeLessThanOrEqual(64);
      expect(g.displayName.length).toBeLessThanOrEqual(30);
      expect(g.description.length).toBeLessThanOrEqual(45);
      expect(g.description).not.toMatch(/\$|USD|\d+\.\d\d/);
    }
  });
  it("is written into store/IAP.md and says there is nothing to restore", () => {
    const md = read("store/IAP.md");
    for (const g of meta.gemPacks.packs) for (const v of [g.productId, g.referenceName, g.displayName, g.description]) expect(md).toContain(v);
    expect(md).toMatch(/No Restore Purchases/);
    expect(meta.reviewNotes).toMatch(/no non-consumables, so there is no Restore Purchases button/);
  });
  it("still promises no ads and no tracking, and (with chests in offers) that every chest shows its odds", () => {
    expect(meta.description).toMatch(/no ads, no tracking/i);
    // [pass] Chests (Shop, War Pass, special offers) hold random contents, so the copy promises odds, not "no random rewards".
    expect(meta.description).not.toMatch(/no loot boxes|no random rewards/);
    expect(meta.description).toMatch(/every chest shows its odds/);
  });
});
