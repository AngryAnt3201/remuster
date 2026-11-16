// War Pass Premium and special offers on the store: credit once per transaction (saved before finish), pending,
// cancelled, failed and Ask to Buy, offer rotation, one buy per offer, and the honest value maths.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { GEM_PACKS } from "../engine/economy/gems";
import { blankPass, creditPremiumIn, hasPremium } from "../engine/progression/pass";
import { ConsumableShop } from "../engine/store/consumable";
import { MOCK_PRODUCTS, MockStore } from "../engine/store/mock";
import {
  OFFER_IDS, OFFER_TEMPLATES, OFFER_TIERS, OFFER_WINDOW_MS, blankOffers, creditOfferIn, intendIn, ladderRate, offerBought,
  offerCards, offerGems, offerPayout, offerValueX, offersFor, windowAt, windowEnd,
} from "../engine/store/offers";
import { PASS } from "../engine/store/types";
import { SEASON_EPOCH } from "../engine/progression/pass";

function kv() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

/** Premium on a save-shaped object, through the real pure credit rule. */
function premiumDevice(store = new MockStore(), season = 1) {
  const p = blankPass(season);
  const saves: string[] = [];
  const credit = vi.fn((x: { txId: string }) => { const r = creditPremiumIn(p, x.txId, season); saves.push(`pass:${x.txId}`); return { paid: r !== "dup", what: r }; });
  const shop = new ConsumableShop(store, [PASS], credit);
  return { store, p, saves, credit, shop };
}

describe("War Pass Premium purchase", () => {
  it("credits and saves before the transaction is finished, once", async () => {
    const d = premiumDevice();
    const order: string[] = [];
    const finish = d.store.finish.bind(d.store);
    d.store.finish = async (tx) => { order.push(`finish:${tx}`, ...d.saves.map((x) => `after ${x}`)); await finish(tx); };
    const r = await d.shop.buy(PASS);
    expect(r.status).toBe("purchased");
    expect(r.what).toBe("paid");
    expect(order).toEqual([`finish:${r.txId}`, `after pass:${r.txId}`]);
    expect(hasPremium(d.p)).toBe(true);
    expect(await d.store.unfinished()).toEqual([]);
    expect((await d.shop.settle({ txId: r.txId!, productId: PASS })).result).toBe("dup");
    expect(d.p.premium).toEqual([1]);
  });

  it("reports pending, cancelled and failed without paying or finishing anything", async () => {
    for (const mode of ["pending", "cancelled", "failed", "offline"] as const) {
      const d = premiumDevice(new MockStore({ mode }));
      const r = await d.shop.buy(PASS);
      expect(r.status, mode).toBe(mode === "offline" ? "failed" : mode);
      expect(hasPremium(d.p)).toBe(false);
      expect(await d.store.unfinished()).toEqual([]);
    }
  });

  it("delivers an approved Ask to Buy once, even when the launch sweep sees it too", async () => {
    const d = premiumDevice(new MockStore({ storage: kv(), mode: "pending" }));
    await d.shop.start();
    expect((await d.shop.buy(PASS)).status).toBe("pending");
    const got = new Promise<string>((res) => d.shop.onCredit((p) => res(p.productId)));
    d.store.approvePending();
    expect(await got).toBe(PASS);
    await d.shop.start();
    expect(d.credit).toHaveBeenCalledTimes(1);
    expect(hasPremium(d.p)).toBe(true);
  });

  it("leaves a paid Premium unfinished when the save fails, and credits it on the next launch", async () => {
    const storage = kv();
    const store = new MockStore({ storage });
    const broken = new ConsumableShop(store, [PASS], () => { throw new Error("disk full"); });
    const r = await broken.buy(PASS);
    expect(r.status).toBe("failed");
    expect(r.message).toMatch(/next time/);
    expect((await store.unfinished()).map((x) => x.productId)).toEqual([PASS]);
    const d = premiumDevice(new MockStore({ storage }));
    await d.shop.start();
    expect(hasPremium(d.p)).toBe(true);
    expect(await d.store.unfinished()).toEqual([]);
  });

  it("leaves other shops' transactions alone", async () => {
    const store = new MockStore();
    const d = premiumDevice(store);
    const r = await store.buy(GEM_PACKS[0].id);
    expect((await d.shop.settle({ txId: r.txId!, productId: GEM_PACKS[0].id })).result).toBeNull();
    expect((await store.unfinished()).length).toBe(1);
  });
});

describe("special offers", () => {
  const w0 = windowAt(Date.UTC(2026, 10, 7, 12));

  it("rotate every 2 days from the epoch: 2 or 3 offers, one small and one big, the same for everyone", () => {
    expect(windowAt(SEASON_EPOCH)).toBe(0);
    expect(windowAt(SEASON_EPOCH + OFFER_WINDOW_MS)).toBe(1);
    expect(windowEnd(0)).toBe(SEASON_EPOCH + OFFER_WINDOW_MS);
    const sets = Array.from({ length: 40 }, (_, i) => offersFor(i));
    for (const os of sets) {
      expect(os.length).toBeGreaterThanOrEqual(2);
      expect(os.length).toBeLessThanOrEqual(3);
      expect(os.some((o) => o.tier === "t1" || o.tier === "t2")).toBe(true);
      expect(os.some((o) => o.tier === "t3" || o.tier === "t4")).toBe(true);
      expect(new Set(os.map((o) => o.productId)).size).toBe(os.length);
      for (const o of os) expect(o.endsAt).toBe(windowEnd(o.window));
    }
    expect(offersFor(w0)).toEqual(offersFor(w0));
    expect(new Set(sets.map((os) => os.map((o) => o.name).join())).size).toBeGreaterThan(4);
  });

  it("can each be bought once while up, and a late Ask to Buy pays the offer it was for", () => {
    const s = blankOffers();
    const [o] = offersFor(w0);
    intendIn(s, o);
    const paid = creditOfferIn(s, "tx-1", o.productId, windowEnd(w0) + 5 * OFFER_WINDOW_MS); // approved days later
    expect(paid?.id).toBe(o.id);
    expect(offerBought(s, o.id)).toBe(true);
    expect(creditOfferIn(s, "tx-1", o.productId, Date.now())).toBeNull(); // the same transaction again
    expect(s.intent).toEqual([]);
  });

  it("without a saved intent, pays the offer up now at that tier", () => {
    const s = blankOffers();
    const now = windowEnd(w0) - 1000;
    const o = offersFor(w0)[0];
    expect(creditOfferIn(s, "tx-9", o.productId, now)?.id).toBe(o.id);
    expect(creditOfferIn(s, "tx-10", "co.inflect.muster.gems.pouch", now)).toBeNull();
  });

  it("show an honest 'Nx value' from the gem-pack ladder, rounded down, at 3x or better", () => {
    expect(ladderRate(1.99)).toBeCloseTo(80 / 0.99);
    expect(ladderRate(4.99)).toBeCloseTo(450 / 4.99);
    expect(ladderRate(19.99)).toBeCloseTo(2200 / 19.99);
    for (const t of OFFER_TEMPLATES) {
      const x = offerValueX(t);
      const exact = offerGems(t) / (OFFER_TIERS[t.tier].usd * ladderRate(OFFER_TIERS[t.tier].usd));
      expect(x, t.name).toBe(Math.floor(exact));
      expect(x, t.name).toBeGreaterThanOrEqual(3);
      expect(x, t.name).toBeLessThan(6);
    }
    // Captain's Bundle: 700 gems + 5,000 coins (500) + 12 rare cards (144) + a Royal Hoard (180) = 1,524 gems of value.
    const cap = OFFER_TEMPLATES.find((t) => t.name === "Captain's Bundle")!;
    expect(offerGems(cap)).toBe(1524);
    expect(offerValueX(cap)).toBe(3);
  });

  it("name a specific unit for their cards (shown before buying), and pay coins if none can be found yet", () => {
    const o = { ...offersFor(w0)[0], cards: { rarity: "rare" as const, n: 12 }, unitSeed: 3 };
    const a = offerCards(o, ["blades", "lancer", "bulwark"]);
    expect(a).toEqual(offerCards(o, ["blades", "lancer", "bulwark"]));
    expect(a?.rarity).toBe("rare");
    expect(offerCards(o, ["blades"])).toEqual({ kind: "blades", n: 96, rarity: "common" });
    expect(offerPayout(o, []).coins).toBe(o.coins + 12 * 120);
  });

  it("are consumables in the mock store and the .storekit file, with the generic description", () => {
    const sk = JSON.parse(readFileSync(new URL("../ios/App/Muster.storekit", import.meta.url), "utf8"));
    for (const id of [PASS, ...OFFER_IDS]) {
      expect(MOCK_PRODUCTS.some((p) => p.id === id), id).toBe(true);
      const p = sk.products.find((x: { productID: string }) => x.productID === id);
      expect(p?.type, id).toBe("Consumable");
    }
    for (const [t, d] of Object.entries(OFFER_TIERS)) {
      const p = sk.products.find((x: { productID: string }) => x.productID === d.id);
      expect(p.displayPrice, t).toBe(String(d.usd));
      expect(p.localizations[0].description).toBe("Limited-time bundle; contents shown in game");
    }
    expect(sk.products.find((x: { productID: string }) => x.productID === PASS).displayPrice).toBe("4.99");
  });
});
