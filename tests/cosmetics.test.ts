import { describe, expect, it } from "vitest";
import { DEFAULT_KEEP, blankCosmetics, equipIn, grantIn, normalizeCosmetics } from "../engine/progression/cosmetics";

describe("cosmetics", () => {
  it("owns the default keep and wears it", () => {
    expect(blankCosmetics()).toEqual({ owned: [DEFAULT_KEEP], equipped: { keep: DEFAULT_KEEP } });
  });
  it("grants known skins once and equips only owned ones", () => {
    const c = blankCosmetics();
    expect(equipIn(c, "keep", "keep:frost")).toBe(false);
    expect(grantIn(c, "keep:frost")).toBe(true);
    expect(grantIn(c, "keep:frost")).toBe(false);
    expect(grantIn(c, "keep:nope")).toBe(false);
    expect(equipIn(c, "keep", "keep:frost")).toBe(true);
    expect(c.equipped.keep).toBe("keep:frost");
  });
  it("repairs damaged saves", () => {
    expect(normalizeCosmetics({ owned: ["keep:nope"], equipped: { keep: "keep:gilded" } })).toEqual(blankCosmetics());
  });
});
