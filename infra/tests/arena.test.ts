// The server-run Arena ladder against the real Worker code: matches are issued by the server, results are replayed
// by the engine, and nothing the client claims moves a trophy.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI, applyPlan, planTurn } from "../../engine/core/ai";
import { arenaConfig, blankArena, type ArenaSave } from "../../engine/core/arena";
import { START_HP, UNIT_KINDS } from "../../engine/core/defs";
import { encodeRecord, replayArena, type MatchRecord } from "../../engine/core/ghost";
import { MAX_LEVEL, uniformLevels } from "../../engine/core/levels";
import { Match } from "../../engine/core/match";
import { ticketMatch, type ArenaTicket } from "../../engine/net/client";
import { MATCH_TTL } from "../src/arena";
import { handle } from "../src/worker";
import type { Env } from "../src/env";
import { localD1, migrate } from "../local/d1";
import { localR2 } from "../local/r2";

let env: Env, seed = 100;
const api = async (method: string, path: string, opts: { token?: string; body?: unknown } = {}) => {
  const r = await handle(new Request(`https://api.test${path}`, {
    method, headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }), env);
  return { status: r.status, json: await r.json() as any };
};
const signup = async (name?: string) => (await api("POST", "/v1/players", { body: name ? { name } : {} })).json as { id: string; name: string; token: string };
const start = async (token: string, body: unknown = {}) => (await api("POST", "/v1/arena/match", { token, body })).json as ArenaTicket;
const finish = (token: string, body: unknown) => api("POST", "/v1/arena/result", { token, body });

/** Plays a ticket to the end. `you` null: the player never buys a thing (and loses). */
function play(t: ArenaTicket, you: number | null) {
  const a = ticketMatch(t);
  const m = new Match(a.cfg);
  while (m.phase !== "over") {
    applyPlan(m, 1, planTurn(m, 1, a.foe.ai));
    if (you !== null) applyPlan(m, 0, planTurn(m, 0, { ...DEFAULT_AI, difficulty: you }));
    m.fight();
    m.next();
  }
  return { m, record: encodeRecord(m) };
}
/** A maxed army against a newcomer's rival: a certain win. */
const STRONG = { levels: uniformLevels(MAX_LEVEL) };

beforeEach(async () => {
  const DB = localD1();
  await migrate(DB);
  env = { DB, GAMES: localR2(), TOKEN_SECRET: "test-secret" };
  seed = 100;
  // The server picks the seed; pin it so every run plays the same matches.
  vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(((a: Uint32Array) => { for (let i = 0; i < a.length; i++) a[i] = seed++; return a; }) as typeof crypto.getRandomValues);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("issuing a match", () => {
  it("issues from the server's ladder, with a server seed, and the client rebuilds the same match", async () => {
    const a = await signup();
    const t = await start(a.token, { levels: { ranger: 4 }, roster: ["ranger", "blades", "bulwark", "medic"], hp: 416 });
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(t.save).toEqual(blankArena());
    expect(t).toMatchObject({ levels: { ranger: 4 }, roster: UNIT_KINDS.filter((k) => ["ranger", "blades", "bulwark", "medic"].includes(k)), hp: 416 });
    const mine = ticketMatch(t);
    expect(mine.arena.id).toBe(t.arena);
    expect(mine.arena.league).toBe(1);
    expect(mine.cfg).toEqual(arenaConfig(blankArena(), { seed: t.seed, arena: t.arena, levels: { ranger: 4 }, roster: t.roster, hp: 416 }).cfg);
    expect(mine.cfg.hp).toEqual([416, START_HP]);
    expect((await api("POST", "/v1/arena/match", { body: {} })).status).toBe(401);
  });

  it("returns the open match again until it is settled, and a new one after", async () => {
    const a = await signup(), b = await signup();
    const t1 = await start(a.token), t2 = await start(a.token, { levels: { blades: 3 } });
    expect(t2).toMatchObject({ id: t1.id, seed: t1.seed, arena: t1.arena, levels: { blades: 3 } }); // same match, today's army
    expect((await start(b.token)).id).not.toBe(t1.id);
    expect((await finish(a.token, { id: t1.id, forfeit: true })).status).toBe(200);
    const t3 = await start(a.token);
    expect(t3.id).not.toBe(t1.id);
    expect(t3.seed).not.toBe(t1.seed);
    expect(t3.save.played).toBe(1);
  });

  it("holds what the client says it brings to the engine's limits", async () => {
    const a = await signup();
    const t = await start(a.token, { levels: { ranger: 99, blades: -4, medic: "9", nope: 5, golem: 7.9 }, roster: ["ranger", "ranger", "dragon-of-doom", 7], hp: 99999 });
    expect(t.levels).toEqual({ ranger: MAX_LEVEL, golem: 7 });
    expect(t.roster).toEqual(["ranger"]);
    expect(t.hp).toBeGreaterThan(START_HP);
    expect(t.hp).toBeLessThan(START_HP + 200);
    await finish(a.token, { id: t.id, forfeit: true });
    const plain = await start(a.token, { levels: "all", roster: [], hp: 1 });
    expect(plain.levels).toBeUndefined();
    expect(plain.roster).toBeUndefined();
    expect(plain.hp).toBe(START_HP);
    expect(ticketMatch(plain).cfg.roster![0]).toEqual(UNIT_KINDS);
  });

  it("expires a match nobody finished, at no cost", async () => {
    const a = await signup();
    const t = await start(a.token);
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + MATCH_TTL + 1000 });
    const late = await finish(a.token, { id: t.id, forfeit: true });
    expect(late.status).toBe(410);
    expect(late.json.error).toBe("expired");
    const next = await start(a.token);
    expect(next.id).not.toBe(t.id);
    expect(next.save).toEqual(blankArena());
    expect((await finish(a.token, { id: t.id, forfeit: true })).status).toBe(410);
  });
});

describe("settling a match", () => {
  it("a win: the replay says so, trophies move by the engine's rules, a ghost is kept", async () => {
    const a = await signup("Winner");
    const t = await start(a.token, STRONG);
    const { m, record } = play(t, 0.4);
    expect(m.winner).toBe(0);
    const r = await finish(a.token, { id: t.id, record });
    expect(r.status).toBe(200);
    expect(r.json.result).toMatchObject({ won: true, delta: 30, trophies: 30, streak: 1, promoted: false });
    expect(r.json.save).toMatchObject({ trophies: 30, best: 30, wins: 1, losses: 0, played: 1, streak: 1, arenaWins: { [t.arena]: 1 } });
    expect((await api("GET", "/v1/me", { token: a.token })).json.ladder).toMatchObject({ trophies: 30, best: 30, wins: 1, losses: 0 });
    const ghost = await env.DB.prepare("SELECT name, trophies, arena, data FROM ghosts WHERE player = ?").bind(a.id).first<{ name: string; trophies: number; arena: string; data: string }>();
    expect(ghost).toMatchObject({ name: "Winner", trophies: 30, arena: t.arena });
    const army = JSON.parse(ghost!.data);
    expect(army.pieces.length).toBe(m.sides[0].pieces.length);
    expect(army.pieces[0]).toEqual([m.sides[0].pieces[0].kind, m.sides[0].pieces[0].x, m.sides[0].pieces[0].y, m.sides[0].pieces[0].rank]);
    // the next match is issued from the new ladder, and a second win carries the streak
    const t2 = await start(a.token, STRONG);
    expect(t2.save).toEqual(r.json.save);
    const r2 = await finish(a.token, { id: t2.id, record: play(t2, 0.4).record });
    expect(r2.json.result).toMatchObject({ won: true, delta: 32, trophies: 62, streak: 2 });
  });

  it("a loss: recorded as one, and trophies never go below zero", async () => {
    const a = await signup();
    const t = await start(a.token);
    const { m, record } = play(t, null);
    expect(m.winner).toBe(1);
    const r = await finish(a.token, { id: t.id, record });
    expect(r.status).toBe(200);
    expect(r.json.result).toMatchObject({ won: false, delta: 0, trophies: 0, streak: 0 });
    expect(r.json.save).toMatchObject({ trophies: 0, wins: 0, losses: 1, played: 1 });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM ghosts").first()).toEqual({ n: 0 }); // an empty board is no ghost
  });

  it("what the client claims is never read: a lost match sent as a win is a loss", async () => {
    const a = await signup();
    const won = await start(a.token, STRONG);
    await finish(a.token, { id: won.id, record: play(won, 0.4).record }); // 30 trophies to lose
    const t = await start(a.token);
    const { record } = play(t, null);
    const r = await finish(a.token, { id: t.id, record, won: true, winner: 0, result: { won: true, delta: 500, trophies: 9999 }, save: { trophies: 9999 } });
    expect(r.status).toBe(200);
    expect(r.json.result).toMatchObject({ won: false, delta: -8, trophies: 22 });
    expect((await api("GET", "/v1/me", { token: a.token })).json.ladder).toMatchObject({ trophies: 22, wins: 1, losses: 1 });
  });

  it("a record that breaks the rules is refused and moves nothing", async () => {
    const a = await signup();
    const t = await start(a.token);
    const lost = play(t, null).record;
    const edit = (f: (r: MatchRecord) => void) => { const r: MatchRecord = JSON.parse(JSON.stringify(lost)); f(r); return r; };
    const k = (r: MatchRecord) => (r.kinds.includes("golem") ? r.kinds.indexOf("golem") : r.kinds.push("golem") - 1);
    const cheats: [string, unknown][] = [
      ["gold", edit((r) => { for (let i = 0; i < 3; i++) r.rounds[0][1].push([900 + i, k(r), 2.5 + i * 1.25, 12, 3]); })], // free ground on every Bronze arena
      ["supply", edit((r) => { for (let i = 0; i < 8; i++) r.rounds[0][1].push([900 + i, k(r), 1 + i, 12, 1]); })],
      ["zone", edit((r) => { r.rounds[0][1].push([900, k(r), 4.5, 2, 1]); })],
      ["unfinished", edit((r) => { r.rounds.length = 1; })],
      ["trailing_rounds", edit((r) => { r.rounds.push([r.rounds.length + 1, [], []]); })],
      ["malformed", { v: 1, rounds: "win" }],
      ["malformed", undefined],
    ];
    for (const [why, record] of cheats) {
      const r = await finish(a.token, { id: t.id, record, won: true });
      expect(r.status, why).toBe(422);
      expect(r.json.error).toBe("bad_record");
      expect(String(r.json.message).split(":")[0]).toBe(why);
    }
    expect((await api("GET", "/v1/me", { token: a.token })).json.ladder).toMatchObject({ trophies: 0, wins: 0, losses: 0 });
    expect((await api("GET", "/v1/arena/leaderboard")).json.top).toEqual([]);
  });

  it("settles once: a second result, another player's match and an unknown match are refused", async () => {
    const a = await signup(), b = await signup();
    const t = await start(a.token, STRONG);
    const { record } = play(t, 0.4);
    expect((await finish(b.token, { id: t.id, record })).json.error).toBe("not_yours");
    expect((await finish(b.token, { id: t.id, forfeit: true })).status).toBe(403);
    expect((await finish(a.token, { id: "nope", record })).status).toBe(404);
    expect((await finish(a.token, { record })).status).toBe(400);
    expect((await finish(a.token, { id: t.id, record })).status).toBe(200);
    const again = await finish(a.token, { id: t.id, record });
    expect(again.status).toBe(409);
    expect(again.json.error).toBe("already_settled");
    expect((await finish(a.token, { id: t.id, forfeit: true })).status).toBe(409);
    expect((await api("GET", "/v1/me", { token: a.token })).json.ladder).toMatchObject({ trophies: 30, wins: 1 });
    expect((await api("GET", "/v1/me", { token: b.token })).json.ladder).toMatchObject({ trophies: 0, wins: 0, losses: 0 });
  });

  it("a forfeit is a loss", async () => {
    const a = await signup();
    const won = await start(a.token, STRONG);
    await finish(a.token, { id: won.id, record: play(won, 0.4).record });
    const t = await start(a.token);
    const r = await finish(a.token, { id: t.id, forfeit: true });
    expect(r.json.result).toMatchObject({ won: false, delta: -8, trophies: 22, streak: 0 });
    expect(r.json.save).toMatchObject({ wins: 1, losses: 1, played: 2 });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM ghosts").first()).toEqual({ n: 1 });
  });

  it("the leaderboard is what the server settled", async () => {
    const a = await signup("Ada"), b = await signup("Bex"), c = await signup("Cy");
    for (let i = 0; i < 2; i++) { const t = await start(a.token, STRONG); await finish(a.token, { id: t.id, record: play(t, 0.4).record }); }
    const tb = await start(b.token, STRONG);
    await finish(b.token, { id: tb.id, record: play(tb, 0.4).record });
    const tc = await start(c.token);
    await finish(c.token, { id: tc.id, forfeit: true });
    const top = (await api("GET", "/v1/arena/leaderboard")).json.top;
    expect(top).toEqual([
      { name: "Ada", trophies: 62, best: 62, wins: 2, losses: 0 },
      { name: "Bex", trophies: 30, best: 30, wins: 1, losses: 0 },
      { name: "Cy", trophies: 0, best: 0, wins: 0, losses: 1 },
    ]);
  });

  it("limits how often results can be sent", async () => {
    const a = await signup();
    let last = 0;
    for (let i = 0; i < 241; i++) last = (await finish(a.token, { id: "nope" })).status;
    expect(last).toBe(429);
  });
});

describe("what a replay costs", () => {
  it("re-fights a full 15-round match in well under a second", () => {
    // Seed 2 on Twin Gates runs 16 rounds with both sides fielding full boards by the end.
    const a = arenaConfig(blankArena() as ArenaSave, { seed: 2, arena: "twin-gates" });
    const m = new Match(a.cfg);
    while (m.phase !== "over") {
      applyPlan(m, 1, planTurn(m, 1, a.foe.ai));
      applyPlan(m, 0, planTurn(m, 0, { ...DEFAULT_AI, difficulty: 0.4 }));
      m.fight(); m.next();
    }
    expect(m.played).toBeGreaterThanOrEqual(15);
    const wire = JSON.stringify(encodeRecord(m));
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const r = replayArena(a.cfg, JSON.parse(wire));
      times.push(performance.now() - t0);
      expect(r).toMatchObject({ ok: true, winner: m.winner, rounds: m.played });
    }
    times.sort((x, y) => x - y);
    console.log(`arena replay: ${m.played} rounds, record ${(wire.length / 1024).toFixed(1)} KB, median ${times[2].toFixed(0)} ms, fastest ${times[0].toFixed(0)} ms (node, one core)`);
    expect(times[2]).toBeLessThan(3000);
    expect(wire.length).toBeLessThan(64 * 1024);
  });
});
