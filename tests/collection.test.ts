import { describe, expect, it } from "vitest";
import { UNIT_KINDS } from "../engine/core/defs";
import { RARITY, blankCollection, grantIn, kindsOfRarity, normalizeCollection, spendIn } from "../engine/progression/collection";

describe("card collection", () => {
  it("gives every unit a rarity", () => {
    for (const k of UNIT_KINDS) expect(RARITY[k]).toBeTruthy();
    expect(kindsOfRarity("legendary").length).toBeGreaterThan(0);
  });

  it("uses the first card to find a unit, keeps the rest as spares", () => {
    const c = blankCollection();
    expect(grantIn(c, "ranger", 3)).toEqual({ isNew: true });
    expect(c).toEqual({ cards: { ranger: 2 }, found: ["ranger"] });
    expect(grantIn(c, "ranger", 4)).toEqual({ isNew: false });
    expect(c.cards.ranger).toBe(6);
    expect(grantIn(c, "ranger", 0)).toEqual({ isNew: false });
  });

  it("spends only cards it holds", () => {
    const c = blankCollection();
    grantIn(c, "golem", 1);
    expect(spendIn(c, "golem", 1)).toBe(false);
    grantIn(c, "golem", 5);
    expect(spendIn(c, "golem", 5)).toBe(true);
    expect(c.cards.golem).toBe(0);
  });

  it("repairs damaged saves", () => {
    expect(normalizeCollection(undefined)).toEqual(blankCollection());
    expect(normalizeCollection({ cards: { ranger: 2.7, nope: 3 } as never, found: ["ranger", "ranger", "nope"] as never }))
      .toEqual({ cards: { ranger: 2 }, found: ["ranger"] });
  });
});
