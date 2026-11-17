// Campaign set pieces (engine/core/sets.ts): the small designed places campaign levels are fought on.
import { describe, expect, it } from "vitest";
import { DEFAULT_AI, applyPlan, draftArmy, planTurn } from "../engine/core/ai";
import { ARENA_RULES, chokepoint, terrainIssues, zoneFree } from "../engine/core/arena";
import { LEVELS } from "../engine/core/campaign";
import { levelConfig, puzzleConfig } from "../engine/core/content";
import { H, UNIT_KINDS, W, inZone, type Side } from "../engine/core/defs";
import { duelConfig, gauntletFoe, newRun } from "../engine/core/gauntlet";
import { Match } from "../engine/core/match";
import { spotBlocked } from "../engine/core/placement";
import { PUZZLES } from "../engine/core/puzzles";
import { SETS, SET_RULES, setById } from "../engine/core/sets";
import { isZone } from "../engine/core/terrain";

const sets = Object.values(SETS);

describe("campaign set pieces", () => {
  it("there is a library of about ten, with unique ids and names", () => {
    expect(sets.length).toBeGreaterThanOrEqual(10);
    expect(sets.length).toBeLessThanOrEqual(14);
    expect(new Set(sets.map((s) => s.id)).size).toBe(sets.length);
    expect(new Set(sets.map((s) => s.name)).size).toBe(sets.length);
    for (const s of sets) { expect(setById(s.id)).toBe(s); expect(s.idea.length).toBeGreaterThan(30); }
    expect(setById("nope")).toBeUndefined();
  });
  for (const s of sets) {
    describe(s.name, () => {
      it("is sound and light: 6-14 legal blocks, symmetric, no single chokepoint, the largest unit can go everywhere", () => {
        expect(terrainIssues(s.blocks, SET_RULES)).toEqual([]);
        expect(s.blocks.length).toBeGreaterThanOrEqual(6);
        expect(s.blocks.length).toBeLessThanOrEqual(14);
        expect(s.blocks.length).toBeLessThan(ARENA_RULES.blocks[0]); // lighter than any arena
        expect(chokepoint(s.blocks)).toBeNull();
      });
      it("gives each side something to use: brush to hide in, and cover or a road", () => {
        for (const side of [0, 1] as Side[]) {
          const mine = s.blocks.filter((b) => (side === 0 ? b.y + b.h / 2 > H / 2 : b.y - b.h / 2 < H / 2));
          expect(mine.some((b) => b.kind === "brush"), `side ${side} brush`).toBe(true);
          expect(mine.some((b) => b.kind === "cover" || b.kind === "road"), `side ${side} cover or road`).toBe(true);
        }
        expect(s.blocks.some((b) => !isZone(b.kind))).toBe(true);
      });
      it("does not block the deploy zones: 85% of each free, room for a full army, keeps clear", () => {
        for (const side of [0, 1] as Side[]) {
          expect(zoneFree(s.blocks, side)).toBeGreaterThanOrEqual(0.85);
          for (const tactic of ["balanced", "fortress", "blitz"] as const) {
            const army = draftArmy(side, 60, [...UNIT_KINDS], { ...DEFAULT_AI, tactic }, 3 + side, 12, 3, s.blocks);
            expect(army.length).toBe(12);
            for (const p of army) { expect(spotBlocked(s.blocks, p.kind, p.x, p.y)).toBe(false); expect(inZone(side, p.x, p.y)).toBe(true); }
          }
        }
        expect(zoneFree(s.blocks, 1)).toBeCloseTo(zoneFree(s.blocks, 0), 6);
      });
      it("has mirrored decoration in range", () => {
        expect(s.marks.length).toBeGreaterThanOrEqual(4);
        for (const m of s.marks) {
          expect(m.x).toBeGreaterThanOrEqual(-1); expect(m.x).toBeLessThanOrEqual(10);
          expect(m.y).toBeGreaterThanOrEqual(-1); expect(m.y).toBeLessThanOrEqual(15);
          expect(s.marks.some((o) => o.look === m.look && Math.abs(o.x - (W - m.x)) < 1e-9 && Math.abs(o.y - (H - m.y)) < 1e-9)).toBe(true);
        }
      });
    });
  }
});

describe("campaign levels on sets", () => {
  const onSets = LEVELS.filter((l) => l.set);
  it("every level that had rocks now has a set, every set is used, and every act has at least one", () => {
    expect(onSets.length).toBe(25);
    for (const l of LEVELS) expect(l.obstacles, `level ${l.id}`).toBeUndefined();
    expect(new Set(onSets.map((l) => l.set)).size).toBe(sets.length);
    for (let act = 1; act <= 10; act++) expect(onSets.some((l) => l.act === act), `act ${act}`).toBe(true);
    // A set belongs to an act or two: the same place is not reused all over the campaign.
    for (const s of sets) expect(new Set(onSets.filter((l) => l.set === s.id).map((l) => l.act)).size).toBeLessThanOrEqual(2);
  });
  it("a level carries its set's blocks and marks, and levelConfig passes the blocks to the match", () => {
    for (const l of LEVELS) {
      const cfg = levelConfig(l);
      if (!l.set) { expect(l.terrain).toBeUndefined(); expect(l.marks).toBeUndefined(); expect(cfg.terrain).toBeUndefined(); continue; }
      expect(l.terrain).toBe(SETS[l.set].blocks);
      expect(l.marks).toBe(SETS[l.set].marks);
      expect(cfg.terrain).toBe(l.terrain);
      expect(cfg.obstacles).toBeUndefined();
    }
  });
  it("a foe's opening board stands on free ground inside its zone", () => {
    for (const l of onSets) {
      const m = new Match(levelConfig(l));
      expect(m.sides[1].pieces).toHaveLength(l.start?.[1]?.length ?? 0);
      for (const p of m.sides[1].pieces) {
        expect(spotBlocked(l.terrain, p.kind, p.x, p.y), `level ${l.id}: ${p.kind}`).toBe(false);
        expect(inZone(1, p.x, p.y)).toBe(true);
      }
      // The player can deploy anywhere sensible: a ranger at the middle of the zone, a Colossus at the back.
      expect(m.freeSpot(0, "golem", 4.5, 12.8)).toEqual({ x: 4.5, y: 12.8 });
      expect(m.freeSpot(0, "ranger", 4.5, 10.6)).not.toBeNull();
    }
  });
  it("set levels play to the end headless, with every piece on free ground every round", () => {
    for (const id of [4, 6, 18, 24, 43, 60]) {
      const l = LEVELS[id - 1];
      const m = new Match(levelConfig(l, 1));
      while (m.phase !== "over" && m.played < 30) {
        applyPlan(m, 1, planTurn(m, 1, { ...l.ai, difficulty: Math.min(l.ai.difficulty, 0.4) }));
        applyPlan(m, 0, planTurn(m, 0, { ...DEFAULT_AI, difficulty: 0.4 }));
        for (const s of [0, 1] as Side[]) for (const p of m.sides[s].pieces) {
          expect(spotBlocked(l.terrain, p.kind, p.x, p.y), `level ${id}`).toBe(false);
          expect(inZone(s, p.x, p.y)).toBe(true);
        }
        m.fight();
        m.next();
      }
      expect(m.phase, `level ${id}`).toBe("over");
    }
  });
  it("puzzles and the Gauntlet still use plain obstacles, never terrain", () => {
    expect(PUZZLES.some((p) => p.obstacles?.length)).toBe(true);
    for (const p of PUZZLES) expect(puzzleConfig(p).terrain).toBeUndefined();
    const foe = gauntletFoe(3, 30, 7);
    expect(foe.obstacles?.length).toBeGreaterThan(0);
    const cfg = duelConfig(newRun(7), foe);
    expect(cfg.obstacles).toBe(foe.obstacles);
    expect(cfg.terrain).toBeUndefined();
  });
});
