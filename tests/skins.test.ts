// [skins] Keep skins: which image the player's keep draws, the fallback when skin art fails, and gem prices.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_KEEP, KEEP_SKINS, blankCosmetics, equipIn, grantIn } from "../engine/progression/cosmetics";
import { blankWallet } from "../engine/economy/wallet";
import { KEEP_ARTS, skinFile, skinName } from "../base/src/render/keeps";
import { SKIN_INFO, SKIN_ORDER, SKIN_PRICES, buySkinIn, howToGet, skinPrice } from "../base/src/ui/skins";

/** A stand-in for the browser Image: loads at once, or errors for any src matching `failing`. */
function fakeImages(failing: RegExp | null) {
  class FakeImage {
    complete = false; naturalWidth = 0; decoding = ""; onerror: (() => void) | null = null; private s = "";
    set src(v: string) {
      this.s = v;
      if (failing && failing.test(v)) { this.complete = true; this.naturalWidth = 0; this.onerror?.(); }
      else { this.complete = true; this.naturalWidth = 372; }
    }
    get src() { return this.s; }
  }
  vi.stubGlobal("Image", FakeImage);
}

async function freshKeeps() {
  vi.resetModules();
  return import("../base/src/render/keeps");
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("keep skin selection", () => {
  it("maps skin ids to their art folders, and the default to the plain keep", () => {
    expect(skinName("keep:frost")).toBe("frost");
    expect(skinName(DEFAULT_KEEP)).toBeNull();
    expect(skinName(null)).toBeNull();
    expect(skinName("keep:../x")).toBeNull();
    expect(skinFile("keep:gilded", "burning")).toBe("skins/gilded/burning.webp");
    expect(skinFile(DEFAULT_KEEP, "intact")).toBeNull();
  });

  it("draws the player's keep in the equipped skin, every state, and leaves the rival's keep alone", async () => {
    fakeImages(null);
    const k = await freshKeeps();
    const c = blankCosmetics();
    grantIn(c, "keep:ember");
    equipIn(c, "keep", "keep:ember");
    for (const st of KEEP_ARTS) expect(k.keepImage(0, st, false, c.equipped.keep)!.src).toContain(`keeps/skins/ember/${st}.webp`);
    expect(k.keepImage(1, "intact", false, c.equipped.keep)!.src).toContain("keeps/ember_intact.webp");
    expect(k.keepImage(1, "intact", true, c.equipped.keep)!.src).toContain("keeps/ember_boss_intact.webp");
    expect(k.keepImage(0, "cracked", false, DEFAULT_KEEP)!.src).toContain("keeps/tide_cracked.webp");
    expect(k.keepImage(0, "cracked", false, null)!.src).toContain("keeps/tide_cracked.webp");
  });

  it("falls back to the default keep when the skin's art fails to load", async () => {
    fakeImages(/\/skins\//);
    const k = await freshKeeps();
    for (const st of KEEP_ARTS) expect(k.keepImage(0, st, false, "keep:frost")!.src).toContain(`keeps/tide_${st}.webp`);
    expect(k.skinFailed("keep:frost", "intact")).toBe(true);
    expect(k.skinFailed("keep:frost", "fallen")).toBe(true); // preloaded with the rest, so the collapse falls back too
  });

  it("falls back for an unknown skin id", async () => {
    fakeImages(null);
    const k = await freshKeeps();
    expect(k.keepImage(0, "ruined", false, "keep:nope")!.src).toContain("keeps/skins/nope/ruined.webp");
    fakeImages(/nope/);
    const k2 = await freshKeeps();
    expect(k2.keepImage(0, "ruined", false, "keep:nope")!.src).toContain("keeps/tide_ruined.webp");
  });

  it("gives every skin its own ambient motes, and none to the default keep", async () => {
    const k = await freshKeeps();
    expect(k.skinMotes(DEFAULT_KEEP)).toBeNull();
    expect(k.skinMotes(null)).toBeNull();
    const kinds = new Set<string>();
    for (const id of KEEP_SKINS) {
      if (id === DEFAULT_KEEP) continue;
      const m = k.skinMotes(id)!;
      expect(m.rate).toBeGreaterThan(0);
      expect(m.rate).toBeLessThanOrEqual(8); // ambience, not noise
      kinds.add(`${m.kind}:${m.colors[0]}`);
    }
    expect(kinds.size).toBe(KEEP_SKINS.length - 1);
  });

  it("ships every skin's art, on the default keep's canvas", () => {
    const root = join(__dirname, "..", "base", "public", "keeps");
    const man = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
    for (const id of KEEP_SKINS) {
      for (const st of KEEP_ARTS) {
        const f = skinFile(id, st);
        if (!f) continue;
        const p = join(root, f);
        expect(existsSync(p), p).toBe(true);
        const b = readFileSync(p);
        expect(b.toString("ascii", 0, 4)).toBe("RIFF");
        expect(b.toString("ascii", 12, 16)).toBe("VP8X"); // alpha webp: the canvas size follows
        const w = 1 + b.readUIntLE(24, 3), h = 1 + b.readUIntLE(27, 3);
        expect([w, h]).toEqual([man.w, man.h]);
      }
    }
  });
});

describe("keep skin prices", () => {
  it("sells Frost, Ember and Shadow for 500..900 gems, cheapest first, and never the War Pass skins", () => {
    expect(SKIN_PRICES).toEqual({ "keep:frost": 500, "keep:ember": 700, "keep:shadow": 900 });
    const sold = SKIN_ORDER.filter((id) => SKIN_INFO[id].source === "gems");
    expect(sold).toEqual(["keep:frost", "keep:ember", "keep:shadow"]);
    for (const id of sold) expect(skinPrice(id)).toBe(SKIN_INFO[id].price);
    for (const id of ["keep:gilded", "keep:blossom"] as const) {
      expect(skinPrice(id)).toBeNull();
      expect(SKIN_INFO[id].source).toBe("pass");
      expect(howToGet(id)).toBe("War Pass reward");
    }
    expect(howToGet("keep:frost")).toBe("500 Gems in the Shop");
    expect([...SKIN_ORDER].sort()).toEqual([...KEEP_SKINS].sort());
  });

  it("a Coffer (1000 gems) buys any one gem skin", () => {
    for (const p of Object.values(SKIN_PRICES)) expect(p).toBeLessThanOrEqual(1000);
  });

  it("buying takes the gems and grants the skin, or changes nothing", () => {
    const w = blankWallet(), c = blankCosmetics();
    w.gems = 650;
    expect(buySkinIn(w, c, "keep:ember")).toBe("short");
    expect(w.gems).toBe(650);
    expect(c.owned).not.toContain("keep:ember");
    expect(buySkinIn(w, c, "keep:frost")).toBe("ok");
    expect(w.gems).toBe(150);
    expect(c.owned).toContain("keep:frost");
    expect(buySkinIn(w, c, "keep:frost")).toBe("owned");
    expect(w.gems).toBe(150);
    w.gems = 5000;
    expect(buySkinIn(w, c, "keep:gilded")).toBe("not-for-sale");
    expect(buySkinIn(w, c, "keep:blossom")).toBe("not-for-sale");
    expect(w.gems).toBe(5000);
    expect(c.owned).not.toContain("keep:gilded");
    expect(equipIn(c, "keep", "keep:frost")).toBe(true);
  });
});
