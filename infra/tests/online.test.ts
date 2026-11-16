// The base game's backend link (base/src/online.ts) end to end against the real Worker: a server Arena match played
// and settled, trophies counted once, the record kept when the server is away, and plain offline play.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onlineArenaFinish, onlineArenaForfeit, onlineArenaMatch, startOnline, trackMatchEnd, trackScreen, type OnlineArenaMatch } from "../../base/src/online";
import { DEFAULT_AI, applyPlan, planTurn } from "../../engine/core/ai";
import { UNIT_KINDS } from "../../engine/core/defs";
import { MAX_LEVEL } from "../../engine/core/levels";
import { Match } from "../../engine/core/match";
import { wallet } from "../../engine/economy/wallet";
import * as net from "../../engine/net/client";
import { stopSync } from "../../engine/net/sync";
import { arenaLadder, awardArena, nextArenaMatch, settleArena } from "../../engine/progression/troops";
import { resetSave, save } from "../../engine/save";
import { handle } from "../src/worker";
import type { Env } from "../src/env";
import { localD1, migrate } from "../local/d1";
import { localR2 } from "../local/r2";

let env: Env, down = false;
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
const serverLadder = async () => (await net.me())!.ladder;
/** Plays a match to its end; `you` null never buys (a loss). */
function play(next: { cfg: Match["cfg"]; foe: { ai: typeof DEFAULT_AI } }, you: number | null = 0.4) {
  const m = new Match(next.cfg);
  while (m.phase !== "over") {
    applyPlan(m, 1, planTurn(m, 1, next.foe.ai));
    if (you !== null) applyPlan(m, 0, planTurn(m, 0, { ...DEFAULT_AI, difficulty: you }));
    m.fight(); m.next();
  }
  return m;
}

beforeEach(async () => {
  const DB = localD1(); await migrate(DB);
  env = { DB, GAMES: localR2(), TOKEN_SECRET: "s" };
  down = false;
  vi.stubGlobal("localStorage", mem());
  net.configure({ api: "https://api.test/", storage: mem(), fetch: ((url: string, init?: RequestInit) => (down ? Promise.reject(new Error("net")) : handle(new Request(url, init), env))) as typeof fetch });
  resetSave();
  // A maxed army, so the wins below are certain.
  save((s) => { s.progression = { levels: Object.fromEntries(UNIT_KINDS.map((k) => [k, MAX_LEVEL])), v: 2 }; });
});
afterEach(() => { stopSync(); vi.unstubAllGlobals(); });

describe("the base game online", () => {
  it("with no backend, every call is a no-op and the game plays from the device", async () => {
    net.configure({ api: null });
    startOnline();
    expect(await onlineArenaMatch()).toBeNull();
    expect(await onlineArenaFinish({ id: "x" } as OnlineArenaMatch, new Match({ seed: 1 }))).toBeNull();
    expect(await onlineArenaForfeit({ id: "x" } as OnlineArenaMatch)).toBeNull();
    trackScreen("home"); trackMatchEnd("arena", true, 9);
    const next = nextArenaMatch();
    expect(awardArena(next, true).result.trophies).toBe(30);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM players").first()).toEqual({ n: 0 });
  });

  it("boots: one account, the save in the cloud, events recorded under the game's id", async () => {
    startOnline();
    trackScreen("arena"); trackMatchEnd("arena", true, 12);
    await net.ensurePlayer();
    await net.flush();
    const rows = await env.DB.prepare("SELECT game, name, props FROM events ORDER BY id").all<{ game: string; name: string; props: string | null }>();
    expect(rows.results.map((r) => r.name)).toEqual(["boot", "screen", "match_end"]);
    expect(rows.results[0].game).toBe("base");
    expect(JSON.parse(rows.results[2].props!)).toEqual({ mode: "arena", won: true, rounds: 12 });
    for (let i = 0; i < 100 && !(await net.pullSave())?.rev; i++) await new Promise((r) => setTimeout(r, 5));
    expect((await net.pullSave())?.rev).toBe(1);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM players").first()).toEqual({ n: 1 });
  });

  it("plays a server match: the server's result, trophies counted once, rewards paid once", async () => {
    save((s) => { s.arena = { ...s.arena!, trophies: 400, best: 400, wins: 20, played: 25 }; }); // device-only trophies
    const srv = (await onlineArenaMatch())!;
    expect(srv.id).toBeTruthy();
    expect(arenaLadder()).toMatchObject({ trophies: 0, wins: 0 }); // the server's ladder is the ladder
    expect((await onlineArenaMatch())!.id).toBe(srv.id); // stable until a result is recorded
    expect(srv.cfg.levels![0]).toMatchObject({ blades: MAX_LEVEL });
    const coins = wallet().coins;
    const m = play(srv);
    expect(m.winner).toBe(0);
    const result = (await onlineArenaFinish(srv, m))!;
    expect(result).toMatchObject({ won: true, delta: 30, trophies: 30 });
    expect(arenaLadder()).toMatchObject({ trophies: 30, wins: 1, played: 1, streak: 1 });
    const end = settleArena(srv, result, new Date(2026, 0, 5));
    expect(end.result).toBe(result);
    expect(end.reward.coins).toBe(40);
    expect(end.chest).not.toBeNull();
    expect(wallet().coins).toBe(coins + 40);
    expect(arenaLadder()).toMatchObject({ trophies: 30, wins: 1, played: 1, day: { day: "2026-01-05", coins: 40 } }); // not 60
    expect(await serverLadder()).toMatchObject({ trophies: 30, wins: 1, losses: 0 });
    // the next match is a new one, and the day's coin count survives the server's ladder being written in
    const next = (await onlineArenaMatch())!;
    expect(next.id).not.toBe(srv.id);
    expect(arenaLadder().day).toEqual({ day: "2026-01-05", coins: 40 });
    // a loss, then a quit
    const lost = (await onlineArenaFinish(next, play(next, null)))!;
    expect(lost).toMatchObject({ won: false, delta: -8, trophies: 22 });
    expect(settleArena(next, lost).reward.coins).toBe(0);
    const third = (await onlineArenaMatch())!;
    expect((await onlineArenaForfeit(third))).toMatchObject({ won: false, trophies: 14 });
    expect(arenaLadder()).toMatchObject({ trophies: 14, wins: 1, losses: 2 });
  });

  it("keeps the record when the server is away at the end, and sends it before the next match", async () => {
    const srv = (await onlineArenaMatch())!;
    const m = play(srv);
    down = true;
    expect(await onlineArenaFinish(srv, m)).toBeNull();
    const end = awardArena(srv, m.winner === 0); // the caller's fallback: the device moves the trophies
    expect(end.result.trophies).toBe(30);
    expect(await onlineArenaMatch()).toBeNull(); // still away: play offline rather than be handed the same match
    down = false;
    expect((await serverLadder()).trophies).toBe(0);
    const next = (await onlineArenaMatch())!;
    expect(next.id).not.toBe(srv.id);
    expect(await serverLadder()).toMatchObject({ trophies: 30, wins: 1 });
    expect(arenaLadder()).toMatchObject({ trophies: 30, wins: 1, played: 1 }); // counted once on both sides
  });

  it("falls back to the device when the server can't be reached for a match", async () => {
    await net.ensurePlayer();
    down = true;
    expect(await onlineArenaMatch()).toBeNull();
    expect(nextArenaMatch().arena.league).toBe(1);
  });
});
