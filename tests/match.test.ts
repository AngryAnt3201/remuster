import { describe, expect, it } from "vitest";
import { applyPlan, DEFAULT_AI, planTurn, type AIProfile } from "../engine/core/ai";
import { ASCEND_ROUND, UNITS, ZONE_DEPTH, incomeFor, inZone, rankDmg, rankHp, roundBase, supplyFor, toLocal, upgradeCost } from "../engine/core/defs";
import { Match, interestFor } from "../engine/core/match";

describe("match", () => {
  it("pays income plus interest and rolls a shop of four", () => {
    const m = new Match({ seed: 1, startGold: [7, 0] });
    expect(m.round).toBe(1);
    expect(m.sides[0].gold).toBe(7 + incomeFor(1) + interestFor(7));
    expect(m.sides[0].shop).toHaveLength(4);
    expect(m.sides[1].gold).toBe(incomeFor(1));
  });

  it("buys inside the zone, charges gold and respects the board size", () => {
    const m = new Match({ seed: 2, startGold: [30, 0] });
    const st = m.sides[0];
    const slot = st.shop.findIndex(Boolean);
    const kind = st.shop[slot]!;
    const g = st.gold;
    const p = m.buy(0, slot, 4.5, 3); // asked for enemy ground: clamped into our zone
    expect(st.gold).toBe(g - UNITS[kind].cost);
    expect(inZone(0, p.x, p.y)).toBe(true);
    expect(toLocal(0, p.x, p.y).depth).toBeLessThanOrEqual(ZONE_DEPTH);
    expect(st.shop[slot]).toBeNull();
    while (m.supplyUsed(0) < m.supplyCap(0)) {
      const s = st.shop.findIndex(Boolean);
      if (s < 0) m.reroll(0);
      else m.buy(0, s, 4.5, 12);
    }
    const s = st.shop.findIndex(Boolean) >= 0 ? st.shop.findIndex(Boolean) : (m.reroll(0), 0);
    expect(m.canBuy(0, s)).toBe("Board full");
    expect(m.supplyCap(0)).toBe(supplyFor(1));
  });

  it("upgrades to rank 3 and sells for half of what was spent", () => {
    const m = new Match({ seed: 3, startGold: [30, 0] });
    const slot = m.sides[0].shop.findIndex(Boolean);
    const p = m.buy(0, slot, 4, 12);
    m.upgrade(0, p.id);
    m.upgrade(0, p.id);
    expect(p.rank).toBe(3);
    expect(m.canUpgrade(0, p.id)).toBe("Ascend from round 5");
    const g = m.sides[0].gold;
    m.sell(0, p.id);
    expect(m.sides[0].gold).toBe(Math.min(30, g + Math.floor(p.spent / 2)));
    expect(m.sides[0].pieces).toHaveLength(0);
  });

  it("Ascends to rank 4 only from round 5, for three times the cost, at rank 3 stats x1.15", () => {
    expect(rankHp(4)).toBeCloseTo(rankHp(3) * 1.15);
    expect(rankDmg(4)).toBeCloseTo(rankDmg(3) * 1.15);
    expect(upgradeCost("ranger", 1)).toBe(3);
    expect(upgradeCost("ranger", 2)).toBe(6);
    expect(upgradeCost("ranger", 3)).toBe(9);
    expect(upgradeCost("ranger", 4)).toBe(Infinity);
    const m = new Match({ seed: 3, start: [[{ kind: "ranger", lx: 4.5, depth: 2, rank: 3 }], [{ kind: "ranger", lx: 4.5, depth: 1 }]], startGold: [30, 0] });
    const p = m.sides[0].pieces[0];
    while (m.round < ASCEND_ROUND) {
      expect(m.canUpgrade(0, p.id)).toBe("Ascend from round 5");
      expect(() => m.upgrade(0, p.id)).toThrow();
      m.fight();
      m.next();
    }
    m.sides[0].gold = 30;
    expect(m.canUpgrade(0, p.id)).toBeNull();
    m.upgrade(0, p.id);
    expect(p.rank).toBe(4);
    expect(m.sides[0].gold).toBe(30 - 9);
    expect(m.canUpgrade(0, p.id)).toBe("Max rank");
    const b = m.makeBattle(false);
    const body = b.bodies.find((x) => x.pieceId === p.id)!;
    expect(body.maxHp).toBe(Math.round(UNITS.ranger.hp * rankHp(4)));
  });

  it("the loser takes the base plus twice the winners' threat; pieces persist", () => {
    // A medic can't fight back, so the bulwark always takes the round.
    const m = new Match({ seed: 4, start: [[{ kind: "bulwark", lx: 4.5, depth: 3 }], [{ kind: "medic", lx: 4.5, depth: 1 }]] });
    const rep = m.fight();
    expect(rep.winner).toBe(0);
    expect(rep.damage[1]).toBe(roundBase(1) + 2 * rep.result.threat[0]);
    expect(m.sides[1].hp).toBe(400 - rep.damage[1]);
    m.next();
    expect(m.sides[1].pieces).toHaveLength(1); // the medic comes back next round
    expect(m.round).toBe(2);
  });

  it("ends when a commander falls", () => {
    const m = new Match({ seed: 5, hp: [400, 20], start: [[{ kind: "bulwark", lx: 4.5, depth: 3, rank: 3 }], [{ kind: "medic", lx: 4.5, depth: 1 }]] });
    m.fight();
    expect(m.phase).toBe("over");
    expect(m.winner).toBe(0);
  });
});

describe("ai", () => {
  it("plays legal turns: within gold, board size and its own zone", () => {
    const m = new Match({ seed: 6 });
    for (let r = 0; r < 8 && m.phase !== "over"; r++) {
      for (const s of [0, 1] as const) {
        applyPlan(m, s, planTurn(m, s, { ...DEFAULT_AI, difficulty: s ? 0.9 : 0.2 }));
        expect(m.sides[s].gold).toBeGreaterThanOrEqual(0);
        expect(m.supplyUsed(s)).toBeLessThanOrEqual(m.supplyCap(s));
        for (const p of m.sides[s].pieces) expect(inZone(s, p.x, p.y)).toBe(true);
      }
      m.fight();
      m.next();
    }
  });

  it("ascends only late: never before round 5, and sometimes once it is rich and full", () => {
    let early = 0, late = 0;
    // Most matches end by round 8, so only a few seeds ever get rich enough: sample 8 of them.
    for (let seed = 1; seed <= 8; seed++) {
      const m = new Match({ seed, income: [0, 6] });
      for (let r = 0; r < 14 && m.phase !== "over"; r++) {
        applyPlan(m, 1, planTurn(m, 1, { ...DEFAULT_AI, difficulty: 0.9, economy: 0.8 }));
        for (const p of m.sides[1].pieces) if (p.rank === 4) { if (m.round < 5) early++; else late++; }
        applyPlan(m, 0, planTurn(m, 0, { ...DEFAULT_AI, difficulty: 0.3 }));
        m.fight();
        m.next();
      }
    }
    expect(early).toBe(0);
    expect(late).toBeGreaterThan(0);
  });

  it("tactics change what it drafts", () => {
    const count = (ai: AIProfile, kinds: string[]) => {
      let n = 0, total = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const m = new Match({ seed, startGold: [0, 0] });
        for (let r = 0; r < 6; r++) { applyPlan(m, 1, planTurn(m, 1, ai)); m.fight(); m.next(); }
        for (const p of m.sides[1].pieces) { total++; if (kinds.includes(p.kind)) n++; }
      }
      return n / Math.max(1, total);
    };
    const fort = { ...DEFAULT_AI, tactic: "fortress" as const, difficulty: 0.1 };
    const blitz = { ...DEFAULT_AI, tactic: "blitz" as const, difficulty: 0.1 };
    expect(count(fort, ["bulwark", "ballista", "medic", "mine"])).toBeGreaterThan(count(blitz, ["bulwark", "ballista", "medic", "mine"]));
    expect(count(blitz, ["lancer", "shade", "blades"])).toBeGreaterThan(count(fort, ["lancer", "shade", "blades"]));
  });

  it("aggression moves its formation forward", () => {
    const depthOf = (aggression: number) => {
      const m = new Match({ seed: 9, startGold: [0, 20] });
      applyPlan(m, 1, planTurn(m, 1, { ...DEFAULT_AI, aggression, difficulty: 0.1, spread: 0.5 }));
      const ps = m.sides[1].pieces.filter((p) => p.kind !== "mine");
      return ps.reduce((a, p) => a + toLocal(1, p.x, p.y).depth, 0) / Math.max(1, ps.length);
    };
    expect(depthOf(0.95)).toBeGreaterThan(depthOf(0.05));
  });
});
