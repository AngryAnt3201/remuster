// The tinted sheet cache's eviction policy (base/src/render/sprites.ts pickEvictions): a byte budget, least recently used
// first, never what the current battle preloaded (pinned), what was drawn in the last few seconds or what is loading.
import { describe, expect, it } from "vitest";
import { SHEET_BUDGET, SHEET_RECENT_MS, pickEvictions, type CacheEntry } from "../base/src/render/sprites";

const MB = 1024 * 1024;
const e = (id: string, mb: number, used: number, pinned = false): CacheEntry => ({ id, bytes: mb * MB, used, pinned });
const sum = (xs: CacheEntry[]) => xs.reduce((a, x) => a + x.bytes, 0);

describe("tinted sheet cache eviction", () => {
  it("evicts nothing while the cache is within its budget", () => {
    const xs = [e("a", 100, 0), e("b", 100, 1000)];
    expect(pickEvictions(xs, sum(xs), 256 * MB, 60_000)).toEqual([]);
  });

  it("evicts the least recently used sheets first, and only until it is back under budget", () => {
    const xs = [e("new", 60, 50_000), e("old", 60, 10_000), e("mid", 60, 30_000), e("oldest", 60, 1_000), e("x", 60, 40_000)];
    // 300 MB in a 200 MB budget: two 60 MB sheets have to go, the oldest two
    expect(pickEvictions(xs, sum(xs), 200 * MB, 60_000)).toEqual(["oldest", "old"]);
  });

  it("never evicts the current battle's pinned sheets, even if they are the oldest", () => {
    const xs = [e("pinned", 80, 0, true), e("stale", 80, 5_000), e("fresher", 80, 20_000)];
    expect(pickEvictions(xs, sum(xs), 100 * MB, 60_000)).toEqual(["stale", "fresher"]);
  });

  it("keeps anything drawn in the last few seconds, so units on screen never flicker", () => {
    const now = 100_000;
    const xs = [e("onscreen", 90, now - SHEET_RECENT_MS + 1), e("offscreen", 90, now - SHEET_RECENT_MS - 1)];
    expect(pickEvictions(xs, sum(xs), 50 * MB, now)).toEqual(["offscreen"]);
  });

  it("lets the last screen's sheets go as soon as a new battle starts, oldest first", () => {
    const now = 100_000, scene = 99_500; // the new battle preloaded half a second ago
    const xs = [e("old battle", 90, 99_000), e("older battle", 90, 60_000), e("new battle", 90, 99_900)];
    expect(pickEvictions(xs, sum(xs), 150 * MB, now, SHEET_RECENT_MS, scene)).toEqual(["older battle", "old battle"]);
  });

  it("stays over budget rather than evicting what is in use, and skips sheets still loading", () => {
    const xs = [e("loading", 0, 0), e("pinned", 200, 0, true), e("recent", 200, 99_000)];
    expect(pickEvictions(xs, sum(xs), 256 * MB, 100_000)).toEqual([]);
  });

  it("fits a typical battle (~140 MB of sheets) with room to spare", () => {
    expect(SHEET_BUDGET).toBe(256 * MB);
    const battle = Array.from({ length: 16 }, (_, i) => e(`s${i}`, 8.7, 0, true));
    expect(sum(battle)).toBeLessThan(SHEET_BUDGET);
  });
});
