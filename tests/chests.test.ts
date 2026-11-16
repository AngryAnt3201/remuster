import { describe, expect, it } from "vitest";
import {
  CHESTS, CROWNS_FOR_CHEST, CYCLE, DEAL_PRICE, FREE_BANK, FREE_EVERY, SLOTS, addCrownsIn, blankChests, claimCrownIn, claimFreeIn,
  crownReady, cycleAt, dailyDeals, dropIn, effectiveOdds, findable, freeBanked, freeNextIn, gemsToOpen, msLeft, normalizeChests,
  rollContents, rushIn, skipCost, startIn, stateOf, takeIn, tick, type ChestType, type Progress,
} from "../engine/progression/chests";
import { RARITIES, RARITY } from "../engine/progression/collection";
import { UNIT_KINDS } from "../engine/core/defs";

const MIN = 60_000, HOUR = 60 * MIN;
const fresh: Progress = { campaign: {}, found: [] };
const act3: Progress = { campaign: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 3])), found: ["blades", "ranger", "mine"] };
const all: Progress = { campaign: Object.fromEntries(Array.from({ length: 48 }, (_, i) => [i + 1, 3])), found: [] };

describe("chest cycle", () => {
  it("is a fixed 24-chest cycle with the documented mix, and repeats", () => {
    expect(CYCLE).toHaveLength(24);
    const count = (t: string) => CYCLE.filter((c) => c === t).length;
    expect([count("wood"), count("iron"), count("gilded"), count("royal"), count("legend")]).toEqual([12, 6, 4, 1, 1]);
    expect(cycleAt(24)).toBe(CYCLE[0]);
    expect(cycleAt(23)).toBe("legend");
    expect(cycleAt(-1)).toBe("legend");
  });
  it("wins fill the slots in cycle order, then a win with full slots drops nothing and holds the cycle", () => {
    const c = blankChests();
    for (let i = 0; i < SLOTS; i++) expect(dropIn(c, act3, i).chest!.type).toBe(CYCLE[i]);
    const full = dropIn(c, act3, 9);
    expect(full).toMatchObject({ full: true, chest: null });
    expect(c.cycle).toBe(SLOTS);
  });
});

describe("timers", () => {
  it("one chest unlocks at a time and is ready after its unlock time", () => {
    const c = blankChests(), t0 = 1_000_000;
    dropIn(c, act3, 1); dropIn(c, act3, 2);
    expect(startIn(c, 0, t0)).toBe(true);
    expect(startIn(c, 1, t0)).toBe(false); // one at a time
    const ch = c.slots[0]!;
    expect(stateOf(ch, t0 + CHESTS.wood.unlockMs - 1)).toBe("unlocking");
    expect(takeIn(c, 0, t0 + CHESTS.wood.unlockMs - 1)).toBeNull();
    expect(stateOf(ch, t0 + CHESTS.wood.unlockMs)).toBe("ready");
    expect(startIn(c, 1, t0 + CHESTS.wood.unlockMs)).toBe(true); // the first is done unlocking
    expect(takeIn(c, 0, t0 + CHESTS.wood.unlockMs)).toBe(ch);
    expect(c.slots[0]).toBeNull();
  });
  it("has the documented unlock times", () => {
    expect([CHESTS.wood, CHESTS.iron, CHESTS.gilded, CHESTS.royal, CHESTS.legend].map((d) => d.unlockMs / MIN)).toEqual([15, 180, 480, 720, 1440]);
  });
});

describe("clock rollback guard", () => {
  it("game time never runs backwards, so winding the clock back pauses timers", () => {
    const c = blankChests();
    expect(tick(c, 10 * HOUR)).toBe(10 * HOUR);
    expect(tick(c, 2 * HOUR)).toBe(10 * HOUR); // clock wound back: still 10 h
    expect(tick(c, NaN)).toBe(10 * HOUR);
    expect(tick(c, 11 * HOUR)).toBe(11 * HOUR);
  });
  it("a chest is never ready before it started: forward-and-back costs the next chest the same time", () => {
    const c = blankChests();
    dropIn(c, act3, 1); dropIn(c, act3, 2);
    const real = 100 * HOUR;
    tick(c, real);
    startIn(c, 0, tick(c, real));
    // Clock pushed a day forward: the chest opens (offline we can't tell)...
    const fwd = tick(c, real + 24 * HOUR);
    expect(takeIn(c, 0, fwd)).not.toBeNull();
    // ...then set back to the real time: game time stays a day ahead, so the next chest starts there.
    const back = tick(c, real + MIN);
    expect(back).toBe(real + 24 * HOUR);
    startIn(c, 1, back);
    expect(c.slots[1]!.readyAt! - c.slots[1]!.startedAt!).toBe(CHESTS[c.slots[1]!.type].unlockMs);
    expect(stateOf(c.slots[1]!, tick(c, real + 2 * HOUR))).toBe("unlocking");
    expect(c.slots[1]!.readyAt!).toBeGreaterThanOrEqual(c.slots[1]!.startedAt!);
  });
  it("a gem skip never sets a chest ready before its start", () => {
    const c = blankChests();
    dropIn(c, act3, 1);
    const ch = c.slots[0]!;
    const got = rushIn(c, 0, 5 * HOUR);
    expect(got).toBe(ch);
    expect(ch.readyAt).toBe(5 * HOUR);
    expect(ch.readyAt!).toBeGreaterThanOrEqual(ch.startedAt!);
  });
  it("normalizes broken saves", () => {
    const c = normalizeChests({ slots: [{ type: "nope" } as never, null], cycle: -3, seen: NaN } as never);
    expect(c.slots).toHaveLength(SLOTS);
    expect(c.slots.every((s) => s === null)).toBe(true);
    expect(c.cycle).toBe(0);
    expect(c.seen).toBe(0);
  });
});

describe("gem skip curve", () => {
  it("matches the documented points", () => {
    expect([15 * MIN, HOUR, 3 * HOUR, 8 * HOUR, 12 * HOUR, 24 * HOUR].map(gemsToOpen)).toEqual([4, 10, 25, 53, 74, 128]);
    expect(gemsToOpen(0)).toBe(0);
    expect(gemsToOpen(-5)).toBe(0);
    expect(gemsToOpen(1000)).toBe(1);
  });
  it("only ever falls as the timer runs down", () => {
    let last = Infinity;
    for (let ms = 24 * HOUR; ms > 0; ms -= 7 * MIN) {
      const g = gemsToOpen(ms);
      expect(g).toBeLessThanOrEqual(last);
      last = g;
    }
  });
  it("prices a slot from its time left (a locked chest costs its full timer)", () => {
    const c = blankChests();
    dropIn(c, act3, 1); dropIn(c, act3, 2); dropIn(c, act3, 3);
    expect(skipCost(c, 2, 0)).toBe(gemsToOpen(CHESTS.iron.unlockMs));
    startIn(c, 2, 0);
    expect(skipCost(c, 2, HOUR)).toBe(gemsToOpen(2 * HOUR));
    expect(msLeft(c.slots[2]!, HOUR)).toBe(2 * HOUR);
  });
});

describe("contents", () => {
  it("are fixed when the chest drops: the same seed rolls the same chest, and they are kept in the save", () => {
    const pool = findable(act3.campaign, act3.found);
    expect(rollContents("royal", 42, 3, pool, act3.found)).toEqual(rollContents("royal", 42, 3, pool, act3.found));
    const c = blankChests();
    const { chest } = dropIn(c, act3, 77);
    const copy = normalizeChests(JSON.parse(JSON.stringify(c)));
    expect(copy.slots[0]!.contents).toEqual(chest!.contents);
    expect(chest!.contents).toEqual(rollContents(chest!.type, 77, chest!.act, pool, act3.found));
  });
  it("only hold units the player can find at their progress", () => {
    const pool = findable(fresh.campaign);
    expect(pool.sort()).toEqual(["blades", "ranger"].sort());
    for (let s = 0; s < 200; s++) {
      for (const t of ["wood", "legend", "free", "crown"] as ChestType[]) {
        for (const st of rollContents(t, s, 1, pool).cards) expect(pool).toContain(st.kind);
      }
    }
    const mid = findable(act3.campaign, act3.found);
    for (let s = 0; s < 200; s++) for (const st of rollContents("legend", s, 3, mid, act3.found).cards) expect(mid).toContain(st.kind);
  });
  it("weight towards owned units, with a chance of new ones", () => {
    const pool = findable(act3.campaign, ["blades"]);
    let owned = 0, other = 0;
    for (let s = 0; s < 400; s++) for (const st of rollContents("wood", s, 3, pool, ["blades"]).cards) (st.kind === "blades" ? owned++ : RARITY[st.kind] === "common" && other++);
    expect(owned).toBeGreaterThan(other / 2); // blades is 1 of 3 commons but leads most crates
    expect(other).toBeGreaterThan(0);
  });
  it("scale with chest type and act, with the card total matching the table", () => {
    const pool = UNIT_KINDS;
    const sum = (t: ChestType, act: number) => rollContents(t, 5, act, pool).cards.reduce((a, b) => a + b.n, 0);
    expect(sum("wood", 1)).toBe(CHESTS.wood.cards);
    expect(sum("legend", 1)).toBe(CHESTS.legend.cards);
    expect(sum("legend", 8)).toBe(Math.round(CHESTS.legend.cards * 2.05));
    expect(rollContents("legend", 5, 8, pool).coins).toBeGreaterThan(rollContents("legend", 5, 1, pool).coins);
  });
});

describe("odds", () => {
  it("every chest's table sums to 100%", () => {
    for (const t of Object.keys(CHESTS) as ChestType[]) {
      expect(RARITIES.reduce((a, r) => a + CHESTS[t].odds[r], 0)).toBeCloseTo(100, 6);
    }
  });
  it("the odds shown for a player's progress still sum to 100% and never promise a rarity they can't find", () => {
    for (const p of [fresh, act3, all]) {
      const pool = findable(p.campaign, p.found);
      for (const t of Object.keys(CHESTS) as ChestType[]) {
        const o = effectiveOdds(t, pool);
        expect(RARITIES.reduce((a, r) => a + o[r], 0)).toBeCloseTo(100, 6);
        for (const r of RARITIES) if (!pool.some((k) => RARITY[k] === r)) expect(o[r]).toBe(0);
      }
    }
    expect(effectiveOdds("legend", findable(all.campaign))).toEqual(CHESTS.legend.odds);
  });
});

describe("free chest", () => {
  it("banks one every 4 hours, up to 2; a new player starts with one", () => {
    const c = blankChests(), t = 1000 * HOUR;
    expect(freeBanked(c, t)).toBe(1);
    expect(freeNextIn(c, t)).toBe(FREE_EVERY);
    expect(freeBanked(c, t + FREE_EVERY)).toBe(2);
    expect(freeBanked(c, t + 10 * FREE_EVERY)).toBe(FREE_BANK);
    expect(freeNextIn(c, t + 10 * FREE_EVERY)).toBe(0);
  });
  it("claiming from a full bank leaves one and starts the next from now", () => {
    const c = blankChests(), t = 1000 * HOUR;
    freeBanked(c, t);
    const later = t + 10 * FREE_EVERY;
    expect(claimFreeIn(c, act3, later, 1)!.type).toBe("free");
    expect(freeBanked(c, later)).toBe(1);
    expect(freeNextIn(c, later)).toBe(FREE_EVERY);
    expect(claimFreeIn(c, act3, later, 2)).not.toBeNull();
    expect(claimFreeIn(c, act3, later, 3)).toBeNull();
    expect(freeBanked(c, later + FREE_EVERY)).toBe(1);
  });
  it("never counts from the future", () => {
    const c = blankChests();
    c.freeFrom = 50 * HOUR;
    expect(freeBanked(c, 10 * HOUR)).toBe(0);
    expect(c.freeFrom).toBe(10 * HOUR);
  });
});

describe("crown chest", () => {
  it("opens once a day after 10 stars or crowns", () => {
    const c = blankChests();
    addCrownsIn(c, "2026-11-07", 3);
    addCrownsIn(c, "2026-11-07", 6);
    expect(crownReady(c, "2026-11-07")).toBe(false);
    addCrownsIn(c, "2026-11-07", 3);
    expect(c.crown.crowns).toBe(CROWNS_FOR_CHEST);
    expect(claimCrownIn(c, act3, "2026-11-07", 1)!.type).toBe("crown");
    expect(claimCrownIn(c, act3, "2026-11-07", 2)).toBeNull();
    expect(crownReady(c, "2026-11-08")).toBe(false);
    expect(c.crown).toEqual({ day: "2026-11-08", crowns: 0, claimed: false });
  });
});

describe("daily deals", () => {
  const pool = findable(act3.campaign, act3.found);
  it("are seeded by date: the same all day, different another day", () => {
    expect(dailyDeals("2026-11-07", pool)).toEqual(dailyDeals("2026-11-07", pool));
    const days = ["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"].map((d) => JSON.stringify(dailyDeals(d, pool)));
    expect(new Set([JSON.stringify(dailyDeals("2026-11-07", pool)), ...days]).size).toBeGreaterThan(1);
  });
  it("offer 3-6 findable units, priced by rarity, at most one epic or legendary", () => {
    for (let d = 1; d <= 28; d++) {
      const deals = dailyDeals(`2026-12-${String(d).padStart(2, "0")}`, findable(all.campaign));
      expect(deals.length).toBeGreaterThanOrEqual(3);
      expect(deals.length).toBeLessThanOrEqual(6);
      expect(deals.filter((x) => x.rarity === "epic" || x.rarity === "legendary").length).toBeLessThanOrEqual(1);
      for (const x of deals) expect(x.price).toBe(x.n * DEAL_PRICE[x.rarity]);
    }
    for (const x of dailyDeals("2026-11-07", pool)) expect(pool).toContain(x.kind);
  });
});
