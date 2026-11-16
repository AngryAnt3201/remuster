import { describe, expect, it } from "vitest";
import { UNITS, upgradeCost } from "../engine/core/defs";
import { MAP_DEFS, getMap, nearestOnRoad } from "../engine/core/td/maps";
import { KEEP_HP, TdRun, placeCost, playBot, rankUpCost, SELL_BACK, TD_ROSTER, type BotPlan } from "../engine/core/td/sim";
import { WAVE_COUNT, waves } from "../engine/core/td/waves";
import { TdCamera } from "../base/src/render/tdCamera";

const MIXED: BotPlan = { order: ["pikeman", "ranger", "grenadier", "ranger", "blades", "storm", "ballista", "medic"], upgrade: true, early: false };

describe("bastion maps", () => {
  it("every map has a long road, pads beside it and none on it", () => {
    for (const d of MAP_DEFS) {
      const m = getMap(d.id);
      expect(m.h).toBeGreaterThan(40);
      for (const p of m.paths) expect(p.len).toBeGreaterThan(50);
      expect(m.pads.length).toBeGreaterThanOrEqual(14);
      for (const pad of m.pads) {
        const d0 = Math.min(...m.paths.map((p) => nearestOnRoad(p, pad.x, pad.y).d));
        expect(d0).toBeGreaterThan(1.2);
        expect(d0).toBeLessThan(2.2);
      }
    }
  });
});

describe("bastion waves", () => {
  it("has 15-20 waves that rise in strength, mix roles and end on a boss", () => {
    const w = waves(1);
    expect(w.length).toBe(WAVE_COUNT);
    expect(WAVE_COUNT).toBeGreaterThanOrEqual(15);
    expect(WAVE_COUNT).toBeLessThanOrEqual(20);
    const power = w.map((x) => x.groups.reduce((a, g) => a + UNITS[g.kind].hp * (UNITS[g.kind].bodies ?? 1) * g.n, 0) * x.hpMul * x.rank);
    for (let i = 3; i < power.length; i += 3) expect(power[i]).toBeGreaterThan(power[i - 3]);
    expect(w[w.length - 1].boss).toBe(true);
    expect(w[w.length - 1].groups.some((g) => g.boss)).toBe(true);
    const roles = new Set(w.flatMap((x) => x.groups.map((g) => UNITS[g.kind].role)));
    for (const r of ["air", "cavalry", "tank", "spawner", "siege"]) expect(roles.has(r as never)).toBe(true);
  });
});

describe("bastion run", () => {
  it("is deterministic: the same inputs give the same outcome", () => {
    const a = playBot("meadow", MIXED, 7).snapshot();
    const b = playBot("meadow", MIXED, 7).snapshot();
    expect(a).toEqual(b);
  });

  it("charges, ranks up and refunds with the shared rank rules", () => {
    const r = new TdRun("meadow", 1);
    r.gold = 1000;
    const d = r.place(0, "ranger")!;
    expect(d).toBeTruthy();
    expect(r.gold).toBe(1000 - placeCost("ranger"));
    expect(r.place(0, "pikeman")).toBeNull(); // pad taken
    expect(r.upgrade(d.id)).toBe(true);
    expect(rankUpCost("ranger", 1)).toBe(upgradeCost("ranger", 1) * 10);
    expect(d.rank).toBe(2);
    expect(r.upgrade(d.id)).toBe(true);
    expect(r.upgrade(d.id)).toBe(false); // Ascending waits for the later waves
    const spent = d.spent;
    const back = r.sell(d.id);
    expect(back).toBe(Math.floor(spent * SELL_BACK));
    expect(r.defenders.length).toBe(0);
    expect(TD_ROSTER.every((k) => UNITS[k])).toBe(true);
  });

  it("leaks cost keep HP and an undefended keep falls", () => {
    const r = new TdRun("meadow", 1);
    r.callWave();
    let leaks = 0;
    while (r.phase === "wave") { r.step(); for (const e of r.drain()) if (e.t === "leak") leaks++; }
    expect(leaks).toBeGreaterThan(0);
    expect(r.keepHp).toBeLessThan(KEEP_HP);
    const idle = playBot("meadow", { order: ["ranger"], upgrade: false, early: false, maxPads: 0 });
    expect(idle.phase).toBe("lost");
    expect(idle.stars()).toBe(0);
  });

  it("calling a wave early pays a bonus", () => {
    const r = new TdRun("meadow", 1);
    r.place(0, "pikeman"); r.place(1, "ranger"); r.place(2, "ranger");
    r.callWave();
    while (r.phase === "wave") r.step();
    expect(r.phase).toBe("build");
    const g = r.gold, bonus = r.callBonus();
    expect(bonus).toBeGreaterThan(0);
    expect(r.callWave()).toBe(bonus);
    expect(r.gold).toBe(g + bonus);
  });

  it("is winnable but not trivial: a simple mixed line wins, a thin one loses", () => {
    for (const id of ["meadow", "fords"]) {
      const win = playBot(id, MIXED, 1);
      expect(win.phase).toBe("won");
      expect(win.wave).toBe(WAVE_COUNT);
      expect(win.stars()).toBeGreaterThanOrEqual(1);
      expect(win.stars()).toBeLessThan(3); // three stars needs better play than the script
      const thin = playBot(id, { order: ["ranger"], upgrade: false, early: false, maxPads: 4 }, 1);
      expect(thin.phase).toBe("lost");
      // One unit type alone falls short: archers can't break the armour, blockers can't reach the flyers.
      expect(playBot(id, { order: ["ranger"], upgrade: true, early: false }, 1).phase).toBe("lost");
      expect(playBot(id, { order: ["pikeman"], upgrade: true, early: false }, 1).phase).toBe("lost");
    }
  });

  it("stars follow keep HP left", () => {
    const r = new TdRun("meadow", 1);
    r.phase = "won";
    r.keepHp = 90; expect(r.stars()).toBe(3);
    r.keepHp = 50; expect(r.stars()).toBe(2);
    r.keepHp = 5; expect(r.stars()).toBe(1);
    r.phase = "lost"; expect(r.stars()).toBe(0);
  });
});

describe("bastion camera", () => {
  it("clamps pan and zoom to the map and round-trips points", () => {
    const c = new TdCamera(13, 54);
    c.resize(390, 844);
    c.panBy(10000, 10000);
    c.update(0.016);
    const tl = c.toWorld(0, 0), br = c.toWorld(390, 844);
    expect(tl.x).toBeGreaterThanOrEqual(-1.5);
    expect(br.y).toBeLessThanOrEqual(54 + 1.5);
    c.zoomAt(195, 400, 100);
    expect(c.zoom).toBeLessThanOrEqual(c.maxZoom);
    c.zoomAt(195, 400, 0.001);
    expect(c.zoom).toBeGreaterThanOrEqual(c.minZoom);
    const p = c.toScreen(6, 20), q = c.toWorld(p.x, p.y);
    expect(q.x).toBeCloseTo(6, 5);
    expect(q.y).toBeCloseTo(20, 5);
  });
});
