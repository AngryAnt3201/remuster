import { describe, expect, it } from "vitest";
import { blankWallet, creditPurchaseIn, earnIn, normalizeWallet, spendIn } from "../engine/economy/wallet";

describe("wallet", () => {
  it("earns and spends whole positive amounts only", () => {
    const w = blankWallet();
    expect(earnIn(w, "coins", 120)).toBe(true);
    for (const bad of [0, -5, 1.5, NaN]) expect(earnIn(w, "coins", bad)).toBe(false);
    expect(spendIn(w, "coins", 200)).toBe(false);
    expect(spendIn(w, "coins", 100)).toBe(true);
    expect(w).toMatchObject({ coins: 20, earned: { coins: 120 }, spent: { coins: 100 } });
  });

  it("credits a gem purchase once per transaction", () => {
    const w = blankWallet();
    expect(creditPurchaseIn(w, "tx-1", 500)).toBe(true);
    expect(creditPurchaseIn(w, "tx-1", 500)).toBe(false);
    expect(creditPurchaseIn(w, "", 500)).toBe(false);
    expect(w.gems).toBe(500);
  });

  it("repairs old or damaged saves", () => {
    expect(normalizeWallet(undefined)).toEqual(blankWallet());
    expect(normalizeWallet({ coins: -3, gems: 7.9 } as never)).toMatchObject({ coins: 0, gems: 7 });
  });
});
