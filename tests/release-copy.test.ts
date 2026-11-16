// Release 1.1 copy: the listing, IAP guide and site describe a free-to-play game with every level open, where
// optional purchases (a one-time Starter Pack and gem packs) only speed you up,
// never quote stale content counts, and never hard-code the price the app reads from StoreKit.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACTS, LEVELS } from "../engine/core/campaign";
import { contentCounts, numberWord } from "../engine/core/counts";
import { UNIT_KINDS } from "../engine/core/defs";
import { PUZZLES } from "../engine/core/puzzles";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const app = JSON.parse(read("app.config.json"));
const meta = JSON.parse(read("store/metadata.json"));
const siteFiles = readdirSync(new URL("../site", import.meta.url)).filter((f) => f.endsWith(".html")).map((f) => `site/${f}`);
const copy = [meta.promotionalText, meta.description, meta.reviewNotes, meta.whatsNew].join("\n");
const NO_IAP = /no (in-app )?purchases|no in-app purchase/i;

describe("content counts for the store copy", () => {
  it("counts what base/src/core ships", () => {
    const c = contentCounts();
    expect(c.units).toBe(UNIT_KINDS.length);
    expect(c.levels).toBe(LEVELS.length);
    expect(c.acts).toBe(ACTS.length);
    expect(c.actsWord).toBe(numberWord(ACTS.length));
    expect(c.puzzles).toBe(PUZZLES.length);
    expect(c.bosses).toBeGreaterThanOrEqual(1);
  });
  it("spells small numbers and falls back to digits", () => {
    expect(numberWord(8)).toBe("eight");
    expect(numberWord(40)).toBe("40");
  });
});

describe("release 1.1 listing", () => {
  it("has a release version in app.config.json, matched by the synced metadata", () => {
    expect(app.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(meta.version).toBe(app.version);
  });

  it("no longer says there are no purchases, in the store copy or on the site", () => {
    expect(copy).not.toMatch(NO_IAP);
    for (const f of [...siteFiles, "store/LISTING.md"]) expect(read(f), f).not.toMatch(NO_IAP);
  });

  it("still promises no ads and no tracking, and says it's free to play with every level open", () => {
    expect(meta.description).toMatch(/no ads, no tracking/i);
    expect(meta.description).toMatch(/free to play, every level open/i);
    expect(meta.description).toMatch(/Starter Pack/);
    expect(meta.description).toMatch(/only speed you up/);
    expect(meta.reviewNotes).toMatch(/Nothing is locked behind a purchase/);
    expect(meta.reviewNotes).toContain(meta.inAppPurchase.productId);
  });

  it("no longer mentions the Full Army, a locked act or Restore Purchases as a button the game has", () => {
    const all = [copy, meta.inAppPurchase.reviewNotes, meta.gemPacks.reviewNotes, meta.price, read("store/IAP.md").replace(/^\*\*Removed:\*\*.*$/m, ""), read("store/LISTING.md"), read("store/RELEASE-CHECKLIST.md"), ...siteFiles.map(read)].join("\n");
    expect(all).not.toMatch(/Full Army|fullarmy|Acts 1 and 2|locked Act/);
    expect(all).not.toMatch(/Shop > Restore Purchases|Restore Purchases (brings|restores|is on)/);
  });

  it("takes unit, level, act and puzzle counts from placeholders, not hard-coded numbers", () => {
    expect(copy).not.toMatch(/\b\d+ (units|levels|acts|puzzles|abilities)\b/i);
    expect(copy).not.toMatch(/\b(four|five|six|seven|eight) acts\b/i);
    expect(meta.description).toContain("{{units}}");
    expect(meta.description).toContain("{{levels}}");
    const known = Object.keys(contentCounts()).concat("name");
    for (const [, k] of copy.matchAll(/\{\{(\w+)\}\}/g)) expect(known).toContain(k);
    for (const f of siteFiles) for (const [, k] of read(f).matchAll(/data-count="(\w+)"/g)) expect(known, f).toContain(k);
  });

  it("never hard-codes a price in the player-facing copy (the app reads it from StoreKit)", () => {
    for (const s of [meta.promotionalText, meta.description, meta.whatsNew, meta.inAppPurchase.description])
      expect(s).not.toMatch(/\$|USD|\d+\.\d\d/);
    for (const f of siteFiles) expect(read(f), f).not.toMatch(/\$\s?\d|USD|4\.99/);
  });
});

describe("Starter Pack in-app purchase fields", () => {
  const iap = meta.inAppPurchase;
  it("matches the product the app sells", () => {
    expect(iap.productId).toBe("co.inflect.muster.starter");
    expect(iap.type).toBe("Consumable");
    expect(iap.price).toMatch(/^USD 4\.99\b/);
  });
  it("fits App Store Connect's limits", () => {
    expect(iap.referenceName.length).toBeLessThanOrEqual(64);
    expect(iap.displayName.length).toBeGreaterThanOrEqual(2);
    expect(iap.displayName.length).toBeLessThanOrEqual(30);
    expect(iap.description.length).toBeLessThanOrEqual(45);
    expect(iap.reviewNotes.length).toBeLessThanOrEqual(4000);
    expect(iap.productId).toMatch(/^[A-Za-z0-9._-]{1,100}$/);
  });
  it("is written out in store/IAP.md", () => {
    const md = read("store/IAP.md");
    for (const v of [iap.referenceName, iap.productId, iap.displayName, iap.description, iap.type]) expect(md).toContain(v);
    expect(md).toMatch(/Paid Apps/);
    expect(md).toMatch(/once per player/i);
    expect(md).toMatch(/No Restore Purchases/);
  });
});
