import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI, TACTICS, applyPlan, draftArmy, planTurn } from "../engine/core/ai";
import {
  ARENAS, ARENA_DAILY_CAP, ARENA_LOOKS, ARENA_PROMOTION_COINS, ARENA_RULES, ARENA_WIN_COINS, LEAGUES, LOOKS_BY_KIND, TROPHY_LOSS, TROPHY_WIN,
  arenaById, arenaCoins, arenaConfig, arenaDifficulty, arenaFoeLevel, arenaFoeRoster, arenaFor, arenaOpponent, arenaUnlocked,
  blankArena, chokepoint, finishArena, leagueOf, leagueProgress, nextLeague, normalizeArena, roadJoins, terrainIssues, trophyChange, zoneFree,
} from "../engine/core/arena";
import { H, START_HP, UNIT_KINDS, W, inZone, type Side } from "../engine/core/defs";
import { Match } from "../engine/core/match";
import { footprint, freeSpotIn, spotBlocked } from "../engine/core/placement";
import { blockBottom, blockTop, isZone, type Block } from "../engine/core/terrain";
import { arenaLadder, arenaLoadout, arenaRoster, awardArena, nextArenaMatch, setArenaLadder, settleArena } from "../engine/progression/troops";
import { wallet } from "../engine/economy/wallet";
import { load, resetSave } from "../engine/save";

describe("arenas", () => {
  it("there are twelve, three to each of four leagues, with unique ids and names", () => {
    expect(ARENAS).toHaveLength(12);
    expect(new Set(ARENAS.map((a) => a.id)).size).toBe(12);
    expect(new Set(ARENAS.map((a) => a.name)).size).toBe(12);
    expect(LEAGUES.map((l) => l.arenas.length)).toEqual([3, 3, 3, 3]);
    for (const a of ARENAS) {
      expect(arenaById(a.id)).toBe(a);
      expect(a.blurb.length).toBeGreaterThan(10);
      expect(LEAGUES[a.league - 1].arenas).toContain(a.id);
      expect(new Set(a.blocks.map((b) => b.id)).size).toBe(a.blocks.length);
      for (const b of a.blocks) {
        expect(ARENA_LOOKS).toContain(b.look);
        expect(LOOKS_BY_KIND[b.kind] as readonly string[]).toContain(b.look);
      }
      expect(a.blocks.some((b) => isZone(b.kind))).toBe(true);
    }
    expect(arenaById("nope")).toBeUndefined();
  });

  for (const a of ARENAS) {
    describe(a.name, () => {
      it("is a sound, designed place: legal blocks, symmetric, a road joining the sides, cover and brush each side, no single chokepoint", () => {
        // terrainIssues is the whole rule book (engine/core/arena.ts): in bounds, known looks, blocking blocks clear of
        // each other and the keeps, zones clear of blocking blocks, the same after a half turn, 14-30 blocks, 75% of each
        // deploy zone free, a road chain from zone to zone, 2+ cover and 1+ brush per side, the largest unit can reach
        // every free spot breaking nothing, and no gap under 1.2 wide is the only way across.
        expect(terrainIssues(a.blocks, ARENA_RULES)).toEqual([]);
        expect(a.blocks.length).toBeGreaterThanOrEqual(14);
        expect(a.blocks.length).toBeLessThanOrEqual(30);
        expect(roadJoins(a.blocks)).toBe(true);
        expect(chokepoint(a.blocks)).toBeNull();
        expect(a.idea.length).toBeGreaterThan(60);
      });
      it("has cover and brush on each side, and they are where a side can use them", () => {
        for (const side of [0, 1] as Side[]) {
          const mine = (b: Block) => (side === 0 ? b.y > H / 2 : b.y < H / 2);
          expect(a.blocks.filter((b) => b.kind === "cover" && mine(b)).length, `side ${side} cover`).toBeGreaterThanOrEqual(2);
          const brush = a.blocks.filter((b) => b.kind === "brush" && (side === 0 ? blockBottom(b) > H / 2 : blockTop(b) < H / 2));
          expect(brush.length, `side ${side} brush`).toBeGreaterThanOrEqual(1);
          // An ambush position: brush big enough to hold a unit, reaching into the side's deploy zone or the middle ground.
          expect(brush.some((b) => b.w >= 0.7 && b.h >= 0.7)).toBe(true);
        }
      });
      it("keeps its marks decorative and in range", () => {
        for (const m of a.marks) {
          expect(["gate", "bridge", "tree", "lamp", "banner", "door", "signpost"]).toContain(m.look);
          expect(m.x).toBeGreaterThanOrEqual(-1); expect(m.x).toBeLessThanOrEqual(10);
          expect(m.y).toBeGreaterThanOrEqual(-1); expect(m.y).toBeLessThanOrEqual(15);
          const twin = a.marks.find((o) => o.look === m.look && Math.abs(o.x - (W - m.x)) < 1e-9 && Math.abs(o.y - (H - m.y)) < 1e-9);
          expect(twin, `${m.look} at ${m.x}, ${m.y} has no mirror`).toBeTruthy();
        }
        expect(a.marks.length).toBeGreaterThanOrEqual(6);
      });
      it("leaves room to deploy: at least 75% of each zone free, the same on both sides", () => {
        expect(zoneFree(a.blocks, 0)).toBeGreaterThanOrEqual(0.75);
        expect(zoneFree(a.blocks, 1)).toBeCloseTo(zoneFree(a.blocks, 0), 6);
      });
      it("lets an AI place a full army on each side with nothing on a block", () => {
        for (const side of [0, 1] as Side[]) for (const tactic of ["balanced", "fortress", "blitz"] as const) {
          const army = draftArmy(side, 60, [...UNIT_KINDS], { ...DEFAULT_AI, tactic }, 7 + side, 12, 3, a.blocks);
          expect(army.length).toBe(12);
          for (const p of army) {
            expect(spotBlocked(a.blocks, p.kind, p.x, p.y), `${a.id}: ${p.kind} at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}`).toBe(false);
            expect(inZone(side, p.x, p.y)).toBe(true);
          }
        }
      });
      it("has room for twelve of the largest unit in each deploy zone", () => {
        for (const side of [0, 1] as Side[]) {
          const placed: { x: number; y: number }[] = [];
          for (let d = 0.6; d < 5.9 && placed.length < 12; d += 0.6) for (let lx = 0.7; lx < W - 0.6 && placed.length < 12; lx += 0.6) {
            const x = side === 0 ? lx : W - lx, y = side === 0 ? H - 0.5 - d : 0.5 + d;
            if (spotBlocked(a.blocks, "golem", x, y) || placed.some((q) => Math.hypot(q.x - x, q.y - y) < 1.15)) continue;
            placed.push({ x, y });
          }
          expect(placed.length, `${a.id} side ${side}`).toBe(12);
        }
      });
    });
  }

  it("the rule book catches a bad map", () => {
    const good = arenaById("twin-gates")!.blocks;
    expect(terrainIssues(good)).toEqual([]);
    const wall = (id: number, x0: number, y0: number, x1: number, y1: number): Block => ({ id, kind: "wall", look: "wall", x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });
    // One 1.0 gate in a wall right across: a single chokepoint.
    const gate = [wall(1, 0, 6.75, 4, 7.25), wall(2, 5, 6.75, 9, 7.25)];
    expect(chokepoint(gate)).not.toBeNull();
    // Two such gates: a way round each.
    expect(chokepoint([wall(1, 0, 6.75, 1.5, 7.25), wall(2, 2.5, 6.75, 6.5, 7.25), wall(3, 7.5, 6.75, 9, 7.25)])).toBeNull();
    // One gate, but wide: nothing under 1.2 to squeeze through.
    expect(chokepoint([wall(1, 0, 6.75, 3, 7.25), wall(2, 6, 6.75, 9, 7.25)])).toBeNull();
    // A barricaded second way counts (it can be broken).
    expect(chokepoint([...gate.slice(0, 1), { ...wall(2, 5, 6.75, 7, 7.25) }, { id: 3, kind: "barricade", look: "barricade", x: 8, y: 7, w: 2, h: 0.5 }])).toBeNull();
    const issues = terrainIssues(gate);
    expect(issues.some((i) => i.includes("chokepoint"))).toBe(true);
    expect(issues.some((i) => i.includes("no road"))).toBe(true);
    expect(issues.some((i) => i.includes("cover"))).toBe(true);
    expect(issues.some((i) => i.includes("brush"))).toBe(true);
    expect(issues.some((i) => i.includes("blocks (want"))).toBe(true);
    // A road laid over a wall, a block with no mirror, a road that stops short.
    const over = [...good, { id: 99, kind: "road" as const, look: "road", x: 4.5, y: 7, w: 1, h: 0.5 }];
    expect(terrainIssues(over).some((i) => i.includes("overlaps"))).toBe(true);
    expect(terrainIssues([...good, wall(98, 0.2, 2, 0.7, 2.5)]).some((i) => i.includes("no mirror"))).toBe(true);
    expect(roadJoins(good.filter((b) => b.kind !== "road"))).toBe(false);
    expect(roadJoins([{ id: 1, kind: "road", look: "road", x: 4.5, y: 4, w: 1, h: 4 }])).toBe(false);
  });

  it("a whole AI-vs-AI match on an arena keeps every piece off the blocks, every round", () => {
    const a = arenaById("old-village")!;
    const m = new Match({ seed: 11, terrain: a.blocks });
    for (let round = 0; round < 8 && m.phase !== "over"; round++) {
      for (const s of [1, 0] as Side[]) applyPlan(m, s, planTurn(m, s, { ...DEFAULT_AI, difficulty: 0.5, tactic: s ? "fortress" : "blitz" }));
      for (const s of [0, 1] as Side[]) for (const p of m.sides[s].pieces) {
        expect(spotBlocked(a.blocks, p.kind, p.x, p.y)).toBe(false);
        expect(inZone(s, p.x, p.y)).toBe(true);
      }
      m.fight();
      m.next();
    }
    expect(m.played).toBeGreaterThan(3);
  });
});

describe("arena placement", () => {
  const a = arenaById("courtyard")!;
  const wall = a.blocks.find((b) => b.kind === "wall" && b.y > H / 2)!;
  it("freeSpot nudges a piece dropped on a block to the nearest free spot in the zone", () => {
    const m = new Match({ seed: 3, terrain: a.blocks });
    expect(m.spotBlocked("golem", wall.x, wall.y)).toBe(true);
    const p = m.freeSpot(0, "golem", wall.x, wall.y)!;
    expect(m.spotBlocked("golem", p.x, p.y)).toBe(false);
    expect(Math.hypot(p.x - wall.x, p.y - wall.y)).toBeLessThan(1.2);
    expect(inZone(0, p.x, p.y)).toBe(true);
    // A free spot is left alone.
    expect(m.freeSpot(0, "ranger", 4.5, 11.5)).toEqual({ x: 4.5, y: 11.5 });
  });
  it("buy and move never leave a piece on a block", () => {
    const m = new Match({ seed: 3, terrain: a.blocks, fixedShop: [["blades", "golem", "ballista"], undefined], fixedGold: [30, 0] });
    const b = m.buy(0, 0, wall.x, wall.y);
    expect(spotBlocked(a.blocks, "blades", b.x, b.y)).toBe(false);
    const g = m.buy(0, 1, 4.5, 12);
    m.move(0, g.id, wall.x + 0.3, wall.y - 0.1);
    expect(spotBlocked(a.blocks, "golem", g.x, g.y)).toBe(false);
    expect(Math.hypot(g.x - wall.x, g.y - wall.y)).toBeLessThan(1.5);
  });
  it("is mirrored between the sides, refuses when the zone is walled solid, and is plain clamping without terrain", () => {
    const p0 = freeSpotIn(a.blocks, 0, "bulwark", wall.x, wall.y)!;
    const p1 = freeSpotIn(a.blocks, 1, "bulwark", W - wall.x, H - wall.y)!;
    expect(p1.x).toBeCloseTo(W - p0.x, 9);
    expect(p1.y).toBeCloseTo(H - p0.y, 9);
    expect(freeSpotIn([{ id: 1, kind: "wall", x: W / 2, y: H / 2, w: W, h: H }], 0, "ranger", 4, 10)).toBeNull();
    const open = new Match({ seed: 1 });
    expect(open.freeSpot(0, "ranger", 4.2, 3)).toEqual({ x: 4.2, y: 7.6 });
    expect(open.spotBlocked("ranger", 4.2, 9)).toBe(false);
    expect(footprint("blades")).toBeGreaterThan(footprint("ranger"));
  });
  it("start pieces in a config are moved off blocks too", () => {
    const m = new Match({ seed: 2, terrain: a.blocks, start: [[{ kind: "ballista", lx: wall.x, depth: H - 0.5 - wall.y }], undefined] });
    const p = m.sides[0].pieces[0];
    expect(spotBlocked(a.blocks, "ballista", p.x, p.y)).toBe(false);
  });
});

describe("arena ladder", () => {
  it("leagues open at 0, 200, 500 and 900 trophies", () => {
    expect(LEAGUES.map((l) => l.trophies)).toEqual([0, 200, 500, 900]);
    expect(leagueOf(0).id).toBe(1);
    expect(leagueOf(199).id).toBe(1);
    expect(leagueOf(200).id).toBe(2);
    expect(leagueOf(899).id).toBe(3);
    expect(leagueOf(5000).id).toBe(4);
    expect(nextLeague(LEAGUES[0])).toBe(LEAGUES[1]);
    expect(nextLeague(LEAGUES[3])).toBeNull();
    expect(leagueProgress(260)).toEqual({ league: LEAGUES[1], into: 60, span: 300, next: LEAGUES[2] });
    expect(leagueProgress(1000).span).toBe(0);
    expect(arenaUnlocked(arenaById("bastions")!, 899)).toBe(false);
    expect(arenaUnlocked(arenaById("bastions")!, 900)).toBe(true);
  });
  it("a win adds trophies (more on a streak), a loss takes some, never below the gate of the best league reached", () => {
    const s = blankArena();
    expect(trophyChange(s, false)).toBe(0);
    let r = finishArena(s, "twin-gates", true);
    expect(r).toMatchObject({ won: true, delta: TROPHY_WIN, trophies: 30, streak: 1, promoted: false });
    r = finishArena(s, "twin-gates", true);
    expect(r.delta).toBe(TROPHY_WIN + 2);
    expect(s).toMatchObject({ trophies: 62, best: 62, wins: 2, losses: 0, streak: 2, bestStreak: 2, played: 2, arenaWins: { "twin-gates": 2 } });
    r = finishArena(s, "the-crossing", false);
    expect(r.delta).toBe(-TROPHY_LOSS[0]);
    expect(s).toMatchObject({ trophies: 54, best: 62, losses: 1, streak: 0, bestStreak: 2, played: 3 });
    // Promotion, then the gate holds.
    s.trophies = 190; s.best = 190;
    r = finishArena(s, "crate-yard", true);
    expect(r.promoted).toBe(true);
    expect(r.from.id).toBe(1);
    expect(r.to.id).toBe(2);
    for (let i = 0; i < 5; i++) finishArena(s, "courtyard", false);
    expect(s.trophies).toBe(200);
    expect(leagueOf(s.trophies).id).toBe(2);
    // Climbing back is not a second promotion.
    s.trophies = 480; s.best = 520;
    expect(finishArena(s, "courtyard", true).promoted).toBe(false);
    // The streak bonus is capped.
    s.streak = 50;
    expect(trophyChange(s, true)).toBe(TROPHY_WIN + 10);
  });
  it("coins: by league, a streak bonus, a one-off for promotion, a daily cap, nothing for a loss", () => {
    const s = blankArena();
    const r1 = finishArena(s, "twin-gates", true);
    expect(arenaCoins(r1)).toEqual([["Arena victory", ARENA_WIN_COINS[0]]]);
    const r2 = finishArena(s, "twin-gates", true);
    expect(arenaCoins(r2)).toEqual([["Arena victory", 40], ["Streak 2", 5]]);
    expect(arenaCoins(finishArena(s, "twin-gates", false))).toEqual([]);
    s.trophies = 195; s.best = 195;
    const up = finishArena(s, "twin-gates", true);
    expect(arenaCoins(up, ARENA_DAILY_CAP)).toEqual([["Silver League reached", ARENA_PROMOTION_COINS[1]]]);
    expect(arenaCoins(up, ARENA_DAILY_CAP - 10)).toEqual([["Arena victory", 10], ["Silver League reached", 150]]);
  });
  it("normalizeArena repairs partial and damaged saves", () => {
    expect(normalizeArena(undefined)).toEqual(blankArena());
    expect(normalizeArena({ trophies: 250.7, wins: 9, arenaWins: { "twin-gates": 3, gone: 4 } as Record<string, number> })).toEqual(
      { trophies: 250, best: 250, wins: 9, losses: 0, streak: 0, bestStreak: 0, played: 9, arenaWins: { "twin-gates": 3 } });
    expect(normalizeArena({ trophies: -5, best: NaN, streak: 3 } as never)).toMatchObject({ trophies: 0, best: 0, streak: 3, bestStreak: 3 });
  });
  it("opponents get sharper, higher level and a wider roster with trophies, and vary in tactic", () => {
    expect(arenaDifficulty(0)).toBeCloseTo(0.2);
    expect(arenaDifficulty(650)).toBeGreaterThan(arenaDifficulty(300));
    expect(arenaDifficulty(9999)).toBe(0.95);
    expect([0, 149, 150, 600, 5000].map(arenaFoeLevel)).toEqual([1, 1, 2, 5, 10]);
    expect(arenaFoeRoster(0).length).toBeGreaterThanOrEqual(8);
    expect(arenaFoeRoster(900).sort()).toEqual([...UNIT_KINDS].sort());
    const tactics = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const lo = arenaOpponent(0, seed), hi = arenaOpponent(1200, seed);
      expect(hi.ai.difficulty).toBeGreaterThan(lo.ai.difficulty + 0.5);
      expect(TACTICS).toContain(lo.ai.tactic);
      expect(lo.name).toMatch(/^\S+ \S+$/);
      expect(lo.title.startsWith("the ")).toBe(true);
      expect(arenaOpponent(0, seed)).toEqual(lo);
      for (const v of [lo.ai.aggression, lo.ai.economy, lo.ai.spread, hi.ai.difficulty]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      tactics.add(lo.ai.tactic);
    }
    expect(tactics.size).toBeGreaterThanOrEqual(5);
  });
  it("the rotation shows each of the league's arenas once before repeating", () => {
    const s = blankArena();
    for (const trophies of [0, 300, 600, 1000]) {
      s.trophies = trophies;
      const league = leagueOf(trophies);
      for (let cycle = 0; cycle < 4; cycle++) {
        const seen = new Set<string>();
        for (let i = 0; i < 3; i++) { s.played = cycle * 3 + i; seen.add(arenaFor(s).id); }
        expect([...seen].sort()).toEqual([...league.arenas].sort());
      }
    }
  });
  it("arenaConfig builds a playable match: terrain, rosters, levels, names; deterministic for a save", () => {
    const s = normalizeArena({ trophies: 640, best: 640, wins: 20, losses: 6 });
    const a = arenaConfig(s, { levels: { ranger: 4 }, roster: ["ranger", "blades", "bulwark", "medic"], hp: 432 });
    expect(a).toEqual(arenaConfig(s, { levels: { ranger: 4 }, roster: ["ranger", "blades", "bulwark", "medic"], hp: 432 }));
    expect(a.league.id).toBe(3);
    expect(a.arena.league).toBe(3);
    expect(a.cfg.terrain).toBe(a.arena.blocks);
    expect(a.cfg.hp).toEqual([432, START_HP]);
    expect(a.cfg.roster![0]).toEqual(["ranger", "blades", "bulwark", "medic"]);
    expect(a.cfg.roster![1]).toEqual(arenaFoeRoster(640));
    expect(a.cfg.levels![0]).toEqual({ ranger: 4 });
    expect(a.cfg.levels![1]!.golem).toBe(a.foe.level);
    expect(a.cfg.names).toEqual(["You", a.foe.name]);
    expect(arenaConfig(s, { arena: "twin-gates" }).arena.id).toBe("twin-gates");
    expect(arenaConfig(s, { seed: 5 }).cfg.seed).not.toBe(arenaConfig(s, { seed: 6 }).cfg.seed);
    // A newcomer: level 1 everywhere, so no levels at all.
    expect(arenaConfig(blankArena()).cfg.levels).toBeUndefined();
    // And it plays.
    const m = new Match(a.cfg);
    applyPlan(m, 1, planTurn(m, 1, a.foe.ai));
    applyPlan(m, 0, planTurn(m, 0, DEFAULT_AI));
    expect(m.fight().round).toBe(1);
  });
});

describe("arena on the device save", () => {
  beforeEach(() => resetSave());
  it("a new save has a blank ladder, and an old save without the field loads with one", async () => {
    expect(load().arena).toEqual(blankArena());
    expect(arenaLadder()).toEqual(blankArena());
    const old = { campaign: { 1: 3 }, puzzles: {}, gauntlet: { best: 2, runs: 3 }, settings: { sound: false, haptics: true, speed: 2 }, seen: ["blades"] };
    const store = new Map<string, string>([["muster.save.v1", JSON.stringify(old)]]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.resetModules();
    try {
      const fresh = await import("../engine/save");
      const got = fresh.load();
      expect(got.campaign).toEqual({ 1: 3 });
      expect(got.gauntlet).toEqual({ best: 2, runs: 3 });
      expect(got.arena).toEqual(blankArena());
      // A ladder that was saved comes back.
      fresh.save((x) => { x.arena = { ...blankArena(), trophies: 310, best: 340, wins: 12 }; });
      vi.resetModules();
      expect((await import("../engine/save")).load().arena).toMatchObject({ trophies: 310, best: 340, wins: 12 });
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
  it("awardArena records the result, pays coins through the wallet and drops a chest on a win", () => {
    const match = nextArenaMatch();
    expect(match.arena.league).toBe(1);
    expect(match.cfg.roster![0]).toEqual(expect.arrayContaining(["blades", "ranger", "mine", "medic"]));
    expect(nextArenaMatch()).toEqual(match);
    const coins = wallet().coins;
    const won = awardArena(match, true, new Date(2026, 0, 5));
    expect(won.result).toMatchObject({ won: true, delta: 30, trophies: 30 });
    expect(won.reward.coins).toBe(40);
    expect(won.reward.xp).toBe(5);
    expect(wallet().coins).toBe(coins + 40);
    expect(won.chest).not.toBeNull();
    expect(arenaLadder()).toMatchObject({ trophies: 30, wins: 1, played: 1, day: { day: "2026-01-05", coins: 40 }, arenaWins: { [match.arena.id]: 1 } });
    expect(load().arena!.trophies).toBe(30);
    const next = nextArenaMatch();
    expect(next.cfg.seed).not.toBe(match.cfg.seed);
    const lost = awardArena(next, false, new Date(2026, 0, 5));
    expect(lost.result.delta).toBe(-8);
    expect(lost.reward.coins).toBe(0);
    expect(lost.chest).toBeNull();
    expect(wallet().coins).toBe(coins + 40);
    expect(arenaLadder()).toMatchObject({ trophies: 22, wins: 1, losses: 1, streak: 0, played: 2 });
  });
  it("arena coins stop at the daily cap and start again the next day", () => {
    let total = 0;
    for (let i = 0; i < 12; i++) total += awardArena(nextArenaMatch(), true, new Date(2026, 0, 5)).reward.parts.filter(([l]) => !l.endsWith("reached")).reduce((n, [, c]) => n + c, 0);
    expect(total).toBe(ARENA_DAILY_CAP);
    expect(awardArena(nextArenaMatch(), true, new Date(2026, 0, 6)).reward.coins).toBeGreaterThan(0);
  });
  it("settleArena pays for a result the server settled without moving the trophies again", () => {
    const match = nextArenaMatch();
    expect(arenaLoadout()).toEqual({ levels: undefined, roster: arenaRoster(), hp: START_HP });
    expect(arenaConfig(arenaLadder(), arenaLoadout()).cfg).toEqual(match.cfg);
    // The server's verdict: its ladder after a win, and the result finishArena gave it.
    const server = blankArena();
    const result = finishArena(server, match.arena.id, true);
    const coins = wallet().coins;
    expect(setArenaLadder(server)).toMatchObject({ trophies: 30, wins: 1, played: 1, streak: 1 });
    const end = settleArena(match, result, new Date(2026, 0, 5));
    expect(end.result).toBe(result);
    expect(end.reward).toMatchObject({ coins: 40, xp: 5 });
    expect(end.chest).not.toBeNull();
    expect(wallet().coins).toBe(coins + 40);
    expect(arenaLadder()).toMatchObject({ trophies: 30, wins: 1, played: 1, streak: 1, day: { day: "2026-01-05", coins: 40 } });
    // The same pay as awardArena gives for the same result, and the daily cap counts both.
    const local = awardArena(nextArenaMatch(), true, new Date(2026, 0, 5));
    expect(local.result).toMatchObject({ delta: 32, trophies: 62, streak: 2 });
    expect(arenaLadder().day).toEqual({ day: "2026-01-05", coins: 40 + local.reward.coins });
    // A server ladder written in keeps the device's coin count for the day and drops junk.
    expect(setArenaLadder({ trophies: 22, best: 62, wins: 2, losses: 1, played: 3, streak: 0, bestStreak: 2, arenaWins: { nope: 4 }, day: { day: "1999-01-01", coins: 9 } })).toEqual(
      { trophies: 22, best: 62, wins: 2, losses: 1, played: 3, streak: 0, bestStreak: 2, arenaWins: {}, day: { day: "2026-01-05", coins: 40 + local.reward.coins } });
    // A settled loss pays nothing and drops no chest.
    const lost = settleArena(match, finishArena(blankArena(), match.arena.id, false), new Date(2026, 0, 5));
    expect(lost.reward.coins).toBe(0);
    expect(lost.chest).toBeNull();
    expect(arenaLadder().trophies).toBe(22);
  });
});
