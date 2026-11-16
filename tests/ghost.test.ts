// Match records and their replay (engine/core/ghost.ts): what the backend trusts instead of the client.
import { describe, expect, it } from "vitest";
import { DEFAULT_AI, applyPlan, planTurn } from "../engine/core/ai";
import { arenaConfig, blankArena } from "../engine/core/arena";
import { UNITS, type UnitKind } from "../engine/core/defs";
import { RECORD_VERSION, decodeRecord, encodeRecord, goldBound, pieceCost, replayArena, type MatchRecord, type RecordPiece } from "../engine/core/ghost";
import { Match } from "../engine/core/match";

const ROSTER: UnitKind[] = ["blades", "ranger", "bulwark", "medic", "mine"];
const setup = (seed = 3, roster: UnitKind[] | null = ROSTER) => arenaConfig(blankArena(), { seed, arena: "twin-gates", roster: roster ?? undefined });
/** A whole Arena match, both sides driven by the AI. */
function play(seed = 3, you: number | null = 0.4, roster: UnitKind[] | null = ROSTER) {
  const a = setup(seed, roster);
  const m = new Match(a.cfg);
  while (m.phase !== "over") {
    applyPlan(m, 1, planTurn(m, 1, a.foe.ai));
    if (you !== null) applyPlan(m, 0, planTurn(m, 0, { ...DEFAULT_AI, difficulty: you }));
    m.fight();
    m.next();
  }
  return { cfg: a.cfg, m, record: encodeRecord(m) };
}
const copy = (r: MatchRecord): MatchRecord => JSON.parse(JSON.stringify(r));
const kindIx = (r: MatchRecord, k: UnitKind) => (r.kinds.includes(k) ? r.kinds.indexOf(k) : r.kinds.push(k) - 1);

describe("match records", () => {
  const game = play();

  it("a match logs one board per round, as the battle received it", () => {
    const { m } = game;
    expect(m.log.length).toBe(m.history.length);
    expect(m.log.map((e) => e.round)).toEqual(m.history.map((h) => h.round));
    const m2 = new Match(setup().cfg);
    applyPlan(m2, 0, planTurn(m2, 0, DEFAULT_AI));
    m2.makeBattle(false); m2.makeBattle(false);
    expect(m2.log.length).toBe(1);
    expect(m2.log[0].pieces).toEqual(m2.sides[0].pieces);
    expect(m2.log[0].pieces[0]).not.toBe(m2.sides[0].pieces[0]);
  });

  it("round-trips through JSON and replays to the same winner and health", () => {
    const { m, cfg, record } = game;
    const wire = JSON.parse(JSON.stringify(record));
    expect(wire.v).toBe(RECORD_VERSION);
    const boards = decodeRecord(wire)!;
    expect(boards.length).toBe(m.log.length);
    boards.forEach((b, i) => expect(b.pieces.map(({ spent: _s, ...p }) => p)).toEqual(m.log[i].pieces.map(({ spent: _s, ...p }) => p)));
    const r = replayArena(cfg, wire);
    expect(r).toEqual({ ok: true, winner: m.winner, rounds: m.played, hp: [m.sides[0].hp, m.sides[1].hp] });
    expect(replayArena(cfg, wire)).toEqual(r);
  });

  it("replays a match whichever side won", () => {
    const games = [play(3, null), play(1, 0.4, null)]; // a player who never buys loses; the whole roster at seed 1 wins
    const winners = games.map((g) => {
      const r = replayArena(g.cfg, g.record);
      expect(r.ok && r.winner).toBe(g.m.winner);
      return g.m.winner;
    });
    expect(winners).toEqual([1, 0]);
  });

  it("an honest board is always inside the gold bound", () => {
    const { m, cfg } = game;
    for (const e of m.log) {
      const spent = e.pieces.filter((p) => p.side === 0).reduce((n, p) => n + pieceCost(p.kind, p.rank), 0);
      expect(spent).toBeLessThanOrEqual(goldBound(cfg, e.round));
    }
    expect(goldBound(cfg, 1)).toBe(4 + 3);
    expect(goldBound(cfg, 3)).toBe(4 + 5 + 6 + 9);
    expect(pieceCost("blades", 3)).toBe(UNITS.blades.cost * 4);
  });

  it("rejects malformed, truncated and padded records", () => {
    const { cfg, record } = game;
    const junk: unknown[] = [
      null, 5, "x", {}, { v: 99, kinds: [], rounds: [] }, { v: 1, kinds: ["nope"], rounds: [] },
      { v: 1, kinds: ["blades"], rounds: [[1, [[1, 0, 4, 9]], []]] },
      { v: 1, kinds: ["blades"], rounds: [[1, [[1, 3, 4, 9, 1]], []]] },
      { v: 1, kinds: ["blades"], rounds: [[1, [[1, 0, null, 9, 1]], []]] },
      { v: 1, kinds: ["blades"], rounds: [[1, [[1, 0, 4, 9, 7]], []]] },
    ];
    for (const j of junk) expect(replayArena(cfg, j)).toEqual({ ok: false, reason: "malformed" });
    expect(replayArena(cfg, { v: 1, kinds: [], rounds: [] })).toEqual({ ok: false, reason: "empty" });
    const short = copy(record); short.rounds.pop();
    expect(replayArena(cfg, short)).toEqual({ ok: false, reason: "unfinished" });
    const long = copy(record); long.rounds.push([long.rounds.length + 1, [], []]);
    expect(replayArena(cfg, long)).toEqual({ ok: false, reason: "trailing_rounds" });
    const skip = copy(record); skip.rounds.shift();
    expect(replayArena(cfg, skip)).toEqual({ ok: false, reason: "round_order" });
  });

  it("rejects tampered boards", () => {
    const { cfg, record } = game;
    const bad = (edit: (r: MatchRecord) => void) => { const r = copy(record); edit(r); const out = replayArena(cfg, r); return out.ok ? "ok" : out.reason.split(":")[0]; };
    const mine = (r: MatchRecord, round = 0): RecordPiece[] => r.rounds[round][1];
    const only = (r: MatchRecord, ...ps: RecordPiece[]) => { mine(r).length = 0; mine(r).push(...ps); };
    // an extra unit: round 1 has room for three
    expect(bad((r) => { const b = kindIx(r, "blades"); only(r, [900, b, 1, 12, 1], [901, b, 2, 12, 1], [902, b, 3, 12, 1], [903, b, 4, 12, 1]); })).toBe("supply");
    // on the crates in its own zone (twin-gates: x 1.75..3.0, y 8.5..8.9)
    expect(bad((r) => only(r, [900, kindIx(r, "blades"), 2.4, 8.7, 1]))).toBe("blocked");
    // in the enemy's zone, and off the board
    expect(bad((r) => only(r, [900, kindIx(r, "blades"), 4.5, 3, 1]))).toBe("zone");
    expect(bad((r) => only(r, [900, kindIx(r, "blades"), -3, 12, 1]))).toBe("zone");
    // more than the gold there has been: three rank-3 units in round 1
    expect(bad((r) => { const b = kindIx(r, "blades"); only(r, [900, b, 2, 12, 3], [901, b, 3, 12, 3], [902, b, 4, 12, 3]); })).toBe("gold");
    // an ascended unit before ascension opens
    expect(bad((r) => only(r, [900, kindIx(r, "mine"), 4, 12, 4]))).toBe("rank");
    // a unit that is not in the player's roster
    expect(bad((r) => only(r, [900, kindIx(r, "golem"), 4, 12, 1]))).toBe("roster");
    // the same piece twice
    expect(bad((r) => { const p = mine(r)[0]; only(r, p, [...p] as RecordPiece); })).toBe("duplicate_id");
    // the foe's board is held to the same placement rules
    expect(bad((r) => { r.rounds[0][2].length = 0; r.rounds[0][2].push([901, kindIx(r, "blades"), 4.5, 12, 1]); })).toBe("zone");
    // untouched, it replays
    expect(bad(() => {})).toBe("ok");
  });
});
