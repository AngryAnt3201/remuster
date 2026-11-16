import { describe, expect, it } from "vitest";
import { DEFAULT_AI, TACTICS, applyPlan, planTurn } from "../engine/core/ai";
import { ACTS, LEVELS, rosterAt } from "../engine/core/campaign";
import { levelConfig, objectiveMet, objectiveText, puzzleConfig, puzzleStars, starsFor, type Objective } from "../engine/core/content";
import { UNITS, UNIT_KINDS, inZone } from "../engine/core/defs";
import {
  BOONS, MEND_HP, boardValue, boonChoices, duelConfig, endDuel, gauntletFoe, newRun, rivalMods, runMods, takeBoon,
} from "../engine/core/gauntlet";
import { Match, type RoundReport } from "../engine/core/match";
import { PUZZLES, SOLUTIONS } from "../engine/core/puzzles";
import { Battle } from "../engine/core/battle";
import { fromStart, naive, pieceCost, playPuzzle, solve } from "../tools/solver";

describe("campaign", () => {
  it("has 60 levels, ids 1..60, ten acts of six, a boss closing each act", () => {
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    expect(ACTS).toHaveLength(10);
    for (const l of LEVELS) {
      expect(l.act).toBe(Math.ceil(l.id / 6));
      expect(!!l.boss).toBe(l.id % 6 === 0);
      expect(l.stars[0]).toEqual({ kind: "win" });
      expect(l.stars).toHaveLength(3);
      expect(l.name.length).toBeGreaterThan(0);
      expect(l.foe.length).toBeGreaterThan(0);
    }
    // Bosses: a set-piece board and at least one more twist.
    for (const b of LEVELS.filter((l) => l.boss)) {
      expect(b.start?.[1]?.length).toBeGreaterThan(0);
      const twists = [b.obstacles?.length, b.noReroll, b.maxRounds, b.mods?.[1]?.broodStart, b.mods?.[1]?.litStart, b.income?.[1], b.supply?.[1], b.hp[0] !== 400].filter(Boolean);
      expect(twists.length).toBeGreaterThan(0);
    }
  });

  it("unlocks every unit once, each level's roster holds its unlock, rosters only grow", () => {
    const unlocks = LEVELS.filter((l) => l.unlock).map((l) => l.unlock!);
    expect(new Set(unlocks).size).toBe(unlocks.length);
    for (const l of LEVELS) {
      if (l.unlock) expect(l.roster).toContain(l.unlock);
      if (l.id > 1) for (const k of LEVELS[l.id - 2].roster) expect(l.roster).toContain(k);
    }
    // The three legendaries (Griffin Knight, Tidecaller, Lionheart) join the campaign in Acts 9-10.
    const preLegend = UNIT_KINDS.filter((k) => !["griffin", "tide", "lion"].includes(k));
    expect(new Set(LEVELS[41].roster)).toEqual(new Set(preLegend));
    expect(new Set(LEVELS[47].roster)).toEqual(new Set(preLegend));
    expect(new Set(LEVELS[59].roster)).toEqual(new Set(UNIT_KINDS));
    expect(LEVELS[29].roster).toHaveLength(12);
    expect(rosterAt(1)).toEqual(["blades", "ranger"]);
    // Acts 6 and 7 bring in one new unit a level, in the spec's order.
    const fresh = ["sapper", "harrier", "banner", "rime", "ravager", "grave", "bombard", "tinker", "duelist", "pikeman", "keg", "trickster"];
    expect(LEVELS.slice(30, 42).map((l) => l.unlock)).toEqual(fresh);
    // Late foes field the new units, in their rosters or on their opening boards.
    for (const l of LEVELS.slice(30)) {
      const kinds = new Set([...(l.foeRoster ?? l.roster), ...(l.start?.[1] ?? []).map((p) => p.kind)]);
      expect(fresh.some((k) => kinds.has(k as never)), `level ${l.id}`).toBe(true);
    }
    const at = (k: string) => LEVELS.find((l) => l.unlock === k)!.id;
    expect(at("golem")).toBeLessThanOrEqual(23);
    expect(at("bulwark")).toBeGreaterThanOrEqual(3);
  });

  it("ramps the foe: every tactic appears, difficulty ~0.1 to ~0.95, foe health 120ish to 400", () => {
    expect(new Set(LEVELS.map((l) => l.ai.tactic))).toEqual(new Set(TACTICS));
    expect(LEVELS[0].ai.difficulty).toBeLessThanOrEqual(0.15);
    expect(LEVELS[29].ai.difficulty).toBeGreaterThanOrEqual(0.85);
    expect(LEVELS[41].ai.difficulty).toBeGreaterThanOrEqual(0.9);
    for (let a = 1; a < ACTS.length; a++) {
      const avg = (act: number) => LEVELS.filter((l) => l.act === act).reduce((s, l) => s + l.ai.difficulty, 0) / 6;
      expect(avg(a + 1)).toBeGreaterThan(avg(a));
    }
    expect(LEVELS[0].hp[1]).toBeLessThanOrEqual(150);
    expect(LEVELS[29].hp[1]).toBe(400);
    expect(LEVELS[41].hp[1]).toBe(400);
    expect(LEVELS[47].hp[1]).toBe(400);
    for (const l of LEVELS) expect(l.hp[0]).toBe(400);
  });

  it("every level builds a valid match", () => {
    for (const l of LEVELS) {
      const m = new Match(levelConfig(l));
      expect(m.round).toBe(1);
      expect(m.phase).toBe("deploy");
      expect(m.sides[0].hp).toBe(l.hp[0]);
      expect(m.sides[1].hp).toBe(l.hp[1]);
      expect(m.sides[1].name).toBe(l.foe);
      for (const k of m.sides[0].shop) expect(l.roster).toContain(k!);
      for (const s of [0, 1] as const) for (const p of m.sides[s].pieces) expect(inZone(s, p.x, p.y)).toBe(true);
      expect(m.sides[1].pieces).toHaveLength(l.start?.[1]?.length ?? 0);
      for (const o of l.obstacles ?? []) {
        expect(o.x).toBeGreaterThan(0); expect(o.x).toBeLessThan(9);
        expect(o.y).toBeGreaterThan(5); expect(o.y).toBeLessThan(9);
      }
    }
  });

  it("a level plays to the end headless and scores stars", () => {
    const l = LEVELS[0];
    const m = new Match(levelConfig(l, 3));
    while (m.phase !== "over" && m.played < 40) {
      applyPlan(m, 1, planTurn(m, 1, l.ai));
      applyPlan(m, 0, planTurn(m, 0, { ...DEFAULT_AI, difficulty: 0.3 }));
      m.fight();
      m.next();
    }
    expect(m.phase).toBe("over");
    const stars = starsFor(l, m);
    if (m.winner === 0) expect(stars).toBeGreaterThanOrEqual(1);
    else expect(stars).toBe(0);
  });
});

describe("Act 8: The Mirelight Fen", () => {
  const fen = LEVELS.filter((l) => l.act === 8);
  const NEW = ["hook", "thorn", "outrider", "lamp"];

  it("is six levels, 43-48, built around the four 1.1 units, with no new unlocks", () => {
    expect(ACTS[7]).toBe("The Mirelight Fen");
    expect(fen.map((l) => l.id)).toEqual([43, 44, 45, 46, 47, 48]);
    for (const l of fen) {
      expect(l.unlock).toBeUndefined();
      expect(l.roster).toEqual(rosterAt(42));
      const kinds = new Set([...(l.foeRoster ?? l.roster), ...(l.start?.[1] ?? []).map((p) => p.kind)]);
      expect(NEW.some((k) => kinds.has(k as never)), `level ${l.id}`).toBe(true);
    }
    // Names are its own: no foe or level name reused from earlier acts.
    const before = LEVELS.filter((l) => l.act < 8);
    for (const l of fen) {
      expect(before.map((b) => b.foe)).not.toContain(l.foe);
      expect(before.map((b) => b.name)).not.toContain(l.name);
    }
  });

  it("ends on Mother Wick: all four new units on her opening board and her own twist, lantern wards on every soldier", () => {
    const boss = fen[5];
    expect(boss.boss).toBe(true);
    expect(boss.foe).toBe("Mother Wick");
    const start = new Set(boss.start![1]!.map((p) => p.kind));
    for (const k of NEW) expect(start.has(k as never), k).toBe(true);
    expect(boss.mods?.[1]?.litStart).toBe(true);
    // Only this boss has it, until the finale brings every boss's trick back.
    expect(LEVELS.filter((l) => l.mods?.[1]?.litStart).map((l) => l.id)).toEqual([48, 60]);
  });

  it("litStart: each of that side's units starts warded (mines and the other side don't), and stays deterministic", () => {
    const pieces = () => [
      { id: 1, kind: "blades" as const, side: 0 as const, x: 4.5, y: 10, rank: 1, spent: 3 },
      { id: 2, kind: "hook" as const, side: 1 as const, x: 4.5, y: 4, rank: 2, spent: 8 },
      { id: 3, kind: "ranger" as const, side: 1 as const, x: 3, y: 2, rank: 1, spent: 3 },
      { id: 4, kind: "mine" as const, side: 1 as const, x: 6, y: 5, rank: 1, spent: 2 },
    ];
    const b = new Battle(pieces(), { seed: 5, events: true, mods: [undefined, { litStart: true }] });
    const by = (id: number) => b.bodies.find((x) => x.pieceId === id)!;
    expect(by(1).ward).toBe(0);
    expect(by(2).ward).toBeGreaterThan(0);
    expect(by(3).ward).toBeGreaterThan(0);
    expect(by(4).ward).toBe(0);
    expect(b.events.filter((e) => e.t === "ward")).toHaveLength(2);
    const play = () => {
      const c = new Battle(pieces(), { seed: 5, mods: [undefined, { litStart: true }] });
      while (!c.done) c.step();
      return c.bodies.map((x) => `${x.kind}:${x.hp.toFixed(3)}`).join(",");
    };
    expect(play()).toBe(play());
  });
});

describe("Acts 9-10: The Saltwind Coast and Crownfall Citadel", () => {
  const coast = LEVELS.filter((l) => l.act === 9);
  const citadel = LEVELS.filter((l) => l.act === 10);

  it("are six levels each, 49-54 and 55-60, on the full roster, with names of their own", () => {
    expect(ACTS[8]).toBe("The Saltwind Coast");
    expect(ACTS[9]).toBe("Crownfall Citadel");
    expect(coast.map((l) => l.id)).toEqual([49, 50, 51, 52, 53, 54]);
    expect(citadel.map((l) => l.id)).toEqual([55, 56, 57, 58, 59, 60]);
    const before = LEVELS.filter((l) => l.act < 9);
    for (const l of [...coast, ...citadel]) {
      // The whole 1.1 army, plus any legendary unlocked on or before the level (slots at 50, 53 and 57).
      for (const k of rosterAt(48)) expect(l.roster).toContain(k);
      expect(before.map((b) => b.foe)).not.toContain(l.foe);
      expect(before.map((b) => b.name)).not.toContain(l.name);
      expect(l.hp[1]).toBe(400);
    }
  });

  it("gives every level its own twist: a rule bent for one side, a timer, an extra purse or a set board", () => {
    for (const l of [...coast, ...citadel]) {
      const [mine, foe] = l.mods ?? [];
      const bent = [mine?.speedMul, foe?.speedMul, foe?.kindDmg, foe?.kindHp, foe?.bigMines, foe?.cooldownMul, foe?.healMul,
        foe?.broodStart, foe?.litStart, l.noReroll, l.maxRounds, l.income?.[1], l.startGold?.[1], l.start?.[1]?.length].filter(Boolean);
      expect(bent.length, `level ${l.id}`).toBeGreaterThan(0);
    }
  });

  it("ends Act 9 on Lightkeeper Orrin, the gale at his back (his army faster, yours slower)", () => {
    const boss = coast[5];
    expect(boss.boss).toBe(true);
    expect(boss.foe).toBe("Lightkeeper Orrin");
    expect(boss.mods?.[1]?.speedMul).toBeGreaterThan(1);
    expect(boss.mods?.[0]?.speedMul).toBeLessThan(1);
    expect(LEVELS.filter((l) => (l.mods?.[1]?.speedMul ?? 1) > 1).map((l) => l.id)).toEqual([54]);
  });

  it("ends the campaign on King Aurel the Last, who brings back earlier bosses' tricks at once", () => {
    const boss = citadel[5];
    expect(boss).toBe(LEVELS[LEVELS.length - 1]);
    expect(boss.boss).toBe(true);
    expect(boss.foe).toBe("King Aurel the Last");
    const m = boss.mods?.[1];
    expect(m?.broodStart && m?.litStart && m?.bigMines).toBe(true);
    const start = new Set(boss.start![1]!.map((p) => p.kind));
    for (const k of ["hive", "lamp", "mine", "golem"]) expect(start.has(k as never), k).toBe(true);
  });
});

describe("objectives and stars", () => {
  const fake = (winner: -1 | 0 | 1, hp: number, results: (0 | 1)[]) => {
    const m = new Match({ seed: 1 });
    m.winner = winner;
    m.sides[0].hp = hp;
    for (const w of results) m.history.push({ round: m.history.length + 1, winner: w, damage: [0, 0] } as unknown as RoundReport);
    return m;
  };
  const level = { ...LEVELS[0], stars: [{ kind: "win" }, { kind: "hpAtLeast", value: 300 }, { kind: "roundsAtMost", value: 5 }] as [Objective, Objective, Objective] };

  it("counts met objectives, and none when the match is lost", () => {
    expect(starsFor(level, fake(0, 350, [0, 0, 1, 0]))).toBe(3);
    expect(starsFor(level, fake(0, 250, [0, 0, 1, 0]))).toBe(2);
    expect(starsFor(level, fake(0, 250, [0, 1, 1, 0, 1, 0]))).toBe(1);
    expect(starsFor(level, fake(1, 400, [0]))).toBe(0);
    expect(objectiveMet({ kind: "lossesAtMost", value: 1 }, fake(0, 100, [1, 0, 0]))).toBe(true);
    expect(objectiveMet({ kind: "lossesAtMost", value: 1 }, fake(0, 100, [1, 1, 0]))).toBe(false);
  });

  it("describes objectives in a few words", () => {
    expect(objectiveText({ kind: "win" })).toBe("Win");
    expect(objectiveText({ kind: "hpAtLeast", value: 300 })).toBe("Finish on 300+ health");
    expect(objectiveText({ kind: "roundsAtMost", value: 8 })).toBe("Win within 8 rounds");
    expect(objectiveText({ kind: "lossesAtMost", value: 0 })).toBe("Lose no rounds");
    expect(objectiveText({ kind: "lossesAtMost", value: 2 })).toBe("Lose 2 rounds or fewer");
    for (const l of LEVELS) for (const o of l.stars) expect(objectiveText(o).length).toBeLessThan(30);
  });
});

describe("breakpoint puzzles", () => {
  it("has 18 puzzles, ids 1..18, each a valid one-battle match", () => {
    expect(PUZZLES.map((p) => p.id)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    for (const p of PUZZLES) {
      const m = new Match(puzzleConfig(p));
      expect(m.sides[0].gold).toBe(p.gold);
      expect(m.supplyCap(0)).toBe(p.supply);
      expect(m.sides[0].shop).toEqual(p.shop);
      expect(m.sides[1].pieces).toHaveLength(p.foe.length);
      for (const q of m.sides[1].pieces) expect(inZone(1, q.x, q.y)).toBe(true);
      expect(m.canReroll(0)).toBe(false);
      expect(p.silver).toBeLessThanOrEqual(p.par);
      expect(p.par).toBeLessThan(p.gold);
      expect(p.par).toBeGreaterThan(0);
      // No Ascended pieces: a puzzle is a round-1 battle.
      for (const q of [...p.foe, ...(SOLUTIONS[p.id] ?? [])]) expect(q.rank ?? 1).toBeLessThanOrEqual(3);
      // Gold buys a full board of the cheapest kind or less: the supply limit bites.
      expect(p.shop.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every puzzle is beaten by its stored solution, keeping par gold for three stars", () => {
    for (const p of PUZZLES) {
      const sol = SOLUTIONS[p.id];
      expect(sol, `puzzle ${p.id} has a solution`).toBeTruthy();
      const o = playPuzzle(p, fromStart(sol));
      expect(o.legal, `puzzle ${p.id} solution is legal`).toBe(true);
      expect(o.won, `puzzle ${p.id} solution wins`).toBe(true);
      expect(puzzleStars(p, o.won, o.goldLeft)).toBe(3);
    }
  });

  it("is not beaten by the obvious plays", () => {
    let aiWins = 0;
    for (const p of PUZZLES) {
      const n = naive(p);
      expect(n.cheapWins, `puzzle ${p.id}: a row of the cheapest unit wins`).toBe(false);
      aiWins += n.aiRate;
    }
    // The 0.3 AI in every style wins few of them, on average.
    expect(PUZZLES.slice(15).some((p) => p.shop.some((k) => ["pikeman", "rime", "tinker", "keg"].includes(k)))).toBe(true);
    expect(aiWins / PUZZLES.length).toBeLessThan(0.15);
  });

  it("prices pieces by rank, Ascended included", () => {
    expect([1, 2, 3, 4].map((r) => pieceCost("ranger", r))).toEqual([3, 6, 12, 21]);
  });

  it("the solver finds a win from scratch", () => {
    for (const id of [1, 3]) {
      const r = solve(PUZZLES[id - 1], { evals: 1200, seed: 1, polish: 0 });
      expect(r.best, `puzzle ${id}`).not.toBeNull();
    }
  });

  it("stars by gold left", () => {
    const p = { ...PUZZLES[0], silver: 1, par: 3 };
    expect(puzzleStars(p, false, 9)).toBe(0);
    expect(puzzleStars(p, true, 0)).toBe(1);
    expect(puzzleStars(p, true, 1)).toBe(2);
    expect(puzzleStars(p, true, 3)).toBe(3);
  });
});

describe("gauntlet", () => {
  it("has a dozen-plus boons with short names and text, all applying cleanly", () => {
    expect(BOONS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(BOONS.map((b) => b.id)).size).toBe(BOONS.length);
    for (const b of BOONS) {
      expect(b.name.length).toBeLessThanOrEqual(16);
      expect(b.text.length).toBeLessThanOrEqual(40);
    }
    const run = newRun(5);
    for (const b of BOONS) takeBoon(run, b.id);
    const m = runMods(run);
    expect(m.income).toBe(2);
    expect(m.hpMul).toBeCloseTo(1.15);
    expect(m.bigMines).toBe(true);
    expect(m.kindDmg?.lancer).toBeCloseTo(1.2);
  });

  it("rivals vary in name and style, scale with stage and with your army, and sometimes bring rocks", () => {
    const foes = Array.from({ length: 9 }, (_, i) => gauntletFoe(i + 1, 10 + i * 6, 77));
    expect(new Set(foes.map((f) => f.ai.tactic)).size).toBe(7);
    expect(new Set(foes.map((f) => f.name)).size).toBeGreaterThan(5);
    expect(foes.filter((f) => f.obstacles?.length).length).toBeGreaterThanOrEqual(3);
    expect(foes[8].hp).toBeGreaterThan(foes[0].hp);
    expect(foes[8].ai.difficulty).toBeGreaterThan(foes[0].ai.difficulty);
    const value = (f: { start: { kind: keyof typeof UNITS; rank?: number; lx: number; depth: number }[] }) => boardValue(f.start);
    expect(value(gauntletFoe(5, 60, 3))).toBeGreaterThan(value(gauntletFoe(5, 10, 3)));
    expect(value(gauntletFoe(8, 30, 3))).toBeGreaterThan(value(gauntletFoe(1, 30, 3)));
    // The first rival starts from nothing; later ones bring the new units and, from stage 5, Ascended pieces.
    expect(gauntletFoe(1, 0, 9).start).toHaveLength(0);
    const late = Array.from({ length: 6 }, (_, i) => gauntletFoe(9 + i, 420, 11 + i));
    expect(late.some((f) => f.start.some((p) => (p.rank ?? 1) === 4))).toBe(true);
    expect(late.every((f) => f.start.every((p) => (p.rank ?? 1) <= 4))).toBe(true);
    for (let st = 1; st <= 4; st++) expect(gauntletFoe(st, 120, 5).start.every((p) => (p.rank ?? 1) <= 3)).toBe(true);
    const fresh = new Set(["sapper", "harrier", "banner", "rime", "ravager", "grave", "bombard", "tinker", "duelist", "pikeman", "keg", "trickster"]);
    expect(late.some((f) => f.start.some((p) => fresh.has(p.kind)))).toBe(true);
    expect(rivalMods(4)).toBeUndefined();
    expect(rivalMods(10)!.hpMul).toBeGreaterThan(1);
  });

  it("a run plays duel after duel: the army, gold and health carry over and boons apply", () => {
    const run = newRun(2024);
    const you = { ...DEFAULT_AI, difficulty: 0.6 };
    let duels = 0;
    while (!run.over && duels < 3) {
      const foe = gauntletFoe(run.stage, boardValue(run.board), run.seed);
      const cfg = duelConfig(run, foe);
      const m = new Match(cfg);
      expect(m.sides[0].pieces).toHaveLength(run.board.length);
      expect(m.supplyCap(0)).toBeGreaterThanOrEqual(Math.min(run.board.length + 1, 12));
      for (const p of m.sides[0].pieces) expect(inZone(0, p.x, p.y)).toBe(true);
      while (m.phase !== "over" && m.played < 40) {
        applyPlan(m, 1, planTurn(m, 1, { ...foe.ai, difficulty: 0.2 }));
        applyPlan(m, 0, planTurn(m, 0, you));
        m.fight();
        m.next();
      }
      const stage = run.stage;
      const won = endDuel(run, m);
      duels++;
      expect(run.hp).toBe(m.sides[0].hp);
      if (!won) { expect(run.over).toBe(true); break; }
      expect(run.stage).toBe(stage + 1);
      expect(run.board).toHaveLength(m.sides[0].pieces.length);
      expect(run.gold).toBeLessThanOrEqual(10);
      const choices = boonChoices(run);
      expect(choices).toHaveLength(3);
      expect(new Set(choices.map((b) => b.id)).size).toBe(3);
      takeBoon(run, choices[0].id);
      expect(run.boons).toContain(choices[0].id);
    }
    expect(duels).toBeGreaterThanOrEqual(2);
  });

  it("Field Hospital heals, up to full health", () => {
    const run = newRun(1);
    run.hp = 100;
    takeBoon(run, "mend");
    expect(run.hp).toBe(100 + MEND_HP);
    run.hp = run.maxHp - 10;
    takeBoon(run, "mend");
    expect(run.hp).toBe(run.maxHp);
  });
});
