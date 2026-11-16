import { describe, expect, it } from "vitest";
import { DEFAULT_AI, applyPlan, planTurn } from "../engine/core/ai";
import {
  DAILY_RULES, beginDaily, blankDaily, canScore, challengeNumber, dailyBoard, dailyConfig, dailyResult, dateKey, dayNumber,
  finishDaily, keyFromDay, prevKey, streakOn,
} from "../engine/core/daily";
import { UNITS, inZone, toWorld } from "../engine/core/defs";
import { Match } from "../engine/core/match";

const play = (key: string) => {
  const b = dailyBoard(key);
  const m = new Match(dailyConfig(b));
  const you = { ...DEFAULT_AI, difficulty: 0.7 };
  while (m.phase !== "over" && m.played < 30) {
    const f = planTurn(m, 1, b.foe.ai);
    const y = planTurn(m, 0, you);
    applyPlan(m, 1, f);
    applyPlan(m, 0, y);
    m.fight();
    m.next();
  }
  return m;
};

describe("daily dates", () => {
  it("keys the device's local calendar day", () => {
    expect(dateKey(new Date(2026, 10, 7, 0, 0, 1))).toBe("2026-11-07");
    expect(dateKey(new Date(2026, 10, 7, 23, 59, 59))).toBe("2026-11-07");
    expect(dateKey(new Date(2027, 0, 1, 9))).toBe("2027-01-01");
  });
  it("steps days across months, years and leap days", () => {
    expect(prevKey("2026-12-01")).toBe("2026-11-30");
    expect(prevKey("2027-01-01")).toBe("2026-12-31");
    expect(prevKey("2028-03-01")).toBe("2028-02-29");
    expect(keyFromDay(dayNumber("2026-11-07") + 1)).toBe("2026-11-08");
    expect(challengeNumber("2026-11-06")).toBe(1);
    expect(challengeNumber("2026-11-17")).toBe(12);
    expect(() => dayNumber("7 Nov")).toThrow();
  });
});

describe("daily board", () => {
  it("is the same board for the same date", () => {
    const a = dailyBoard("2026-11-07"), b = dailyBoard("2026-11-07");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.rule).toBe(b.rule);
    expect(JSON.stringify(dailyConfig(a))).toBe(JSON.stringify(dailyConfig(b)));
  });

  it("is a different board on a different date", () => {
    const a = dailyBoard("2026-11-07"), b = dailyBoard("2026-11-08");
    expect(a.seed).not.toBe(b.seed);
    const sig = (x: ReturnType<typeof dailyBoard>) => JSON.stringify([x.roster, x.rule.id, x.foe]);
    expect(sig(a)).not.toBe(sig(b));
    // A month of boards: almost all distinct, and the rules and rivals rotate.
    const month = Array.from({ length: 30 }, (_, i) => dailyBoard(keyFromDay(dayNumber("2026-11-07") + i)));
    expect(new Set(month.map(sig)).size).toBe(30);
    expect(new Set(month.map((x) => x.rule.id)).size).toBeGreaterThan(6);
    expect(new Set(month.map((x) => x.foe.ai.tactic)).size).toBeGreaterThan(3);
  });

  it("always has a playable shop, an opening army in the rival's zone, and a rule", () => {
    for (let i = 0; i < 120; i++) {
      const b = dailyBoard(keyFromDay(dayNumber("2026-11-07") + i));
      expect(b.roster).toHaveLength(9);
      expect(new Set(b.roster).size).toBe(9);
      expect(b.roster.filter((k) => UNITS[k].cost <= 3).length).toBeGreaterThanOrEqual(4);
      expect(b.foe.start.length).toBeGreaterThan(0);
      for (const p of b.foe.start) {
        expect(b.roster).toContain(p.kind);
        const w = toWorld(1, p.lx, p.depth);
        expect(inZone(1, w.x, w.y)).toBe(true);
      }
      expect(DAILY_RULES).toContain(b.rule);
      const cfg = dailyConfig(b);
      expect(cfg.roster).toEqual([b.roster, b.roster]);
    }
  });

  it("each rule changes the match config", () => {
    const base = dailyBoard("2026-11-07");
    const plain = JSON.stringify(dailyConfig({ ...base, rule: { ...base.rule, apply: () => {} } }));
    for (const r of DAILY_RULES) expect(JSON.stringify(dailyConfig({ ...base, rule: r }))).not.toBe(plain);
  });

  it("plays out the same way twice (deterministic) and scores it", () => {
    const a = play("2026-11-09"), b = play("2026-11-09");
    expect(a.phase).toBe("over");
    expect(a.history.map((r) => r.damage)).toEqual(b.history.map((r) => r.damage));
    const ra = dailyResult(a);
    expect(ra).toEqual(dailyResult(b));
    if (ra.won) expect(ra.score).toBeGreaterThanOrEqual(1000);
    else expect(ra.score).toBeLessThan(1000);
  });
});

describe("daily streaks", () => {
  it("scores one attempt a day; replays are practice", () => {
    const d = blankDaily();
    expect(canScore(d, "2026-11-07")).toBe(true);
    expect(beginDaily(d, "2026-11-07")).toBe(true);
    expect(canScore(d, "2026-11-07")).toBe(false);
    expect(beginDaily(d, "2026-11-07")).toBe(false);
    expect(finishDaily(d, "2026-11-07", { won: true, score: 1200 })).toBe(true);
    // A second finish (a practice replay) is not scored.
    expect(finishDaily(d, "2026-11-07", { won: true, score: 1500 })).toBe(false);
    expect(d).toMatchObject({ streak: 1, best: 1200, bestKey: "2026-11-07", played: 1, wins: 1 });
  });

  it("an attempt that is quit still uses the day, and a late finish can't score another day", () => {
    const d = blankDaily();
    beginDaily(d, "2026-11-07");
    expect(canScore(d, "2026-11-07")).toBe(false);
    expect(finishDaily(d, "2026-11-08", { won: true, score: 1300 })).toBe(false);
    expect(d.best).toBe(0);
  });

  it("finishing after midnight still records the day it started", () => {
    const d = blankDaily();
    beginDaily(d, "2026-11-07");
    expect(finishDaily(d, "2026-11-07", { won: false, score: 300 })).toBe(true);
    expect(canScore(d, "2026-11-08")).toBe(true);
  });

  it("rolls the streak over on consecutive days, including month ends", () => {
    const d = blankDaily();
    for (const k of ["2026-11-29", "2026-11-30", "2026-12-01"]) { beginDaily(d, k); finishDaily(d, k, { won: false, score: 100 }); }
    expect(d.streak).toBe(3);
    expect(streakOn(d, "2026-12-01")).toBe(3);
    // Still alive the next day, before playing it.
    expect(streakOn(d, "2026-12-02")).toBe(3);
    beginDaily(d, "2026-12-02");
    expect(d.streak).toBe(4);
    expect(d.bestStreak).toBe(4);
  });

  it("resets the streak after a missed day, keeping the best", () => {
    const d = blankDaily();
    for (const k of ["2026-11-07", "2026-11-08", "2026-11-09"]) beginDaily(d, k);
    expect(d.streak).toBe(3);
    expect(streakOn(d, "2026-11-11")).toBe(0);
    beginDaily(d, "2026-11-11");
    expect(d.streak).toBe(1);
    expect(d.bestStreak).toBe(3);
    expect(d.played).toBe(4);
  });

  it("keeps the best score across days", () => {
    const d = blankDaily();
    beginDaily(d, "2026-11-07"); finishDaily(d, "2026-11-07", { won: true, score: 1250 });
    beginDaily(d, "2026-11-08"); finishDaily(d, "2026-11-08", { won: false, score: 400 });
    expect(d.best).toBe(1250);
    expect(d.bestKey).toBe("2026-11-07");
    expect(d.wins).toBe(1);
  });
});
