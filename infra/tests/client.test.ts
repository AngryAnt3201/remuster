// The engine's backend client against the real Worker (no network: fetch is wired straight into the handler).
import { beforeEach, describe, expect, it } from "vitest";
import * as net from "../../engine/net/client";
import { handle } from "../src/worker";
import type { Env } from "../src/env";
import { localD1, migrate } from "../local/d1";
import { localR2 } from "../local/r2";

let env: Env, down = false;
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

beforeEach(async () => {
  const DB = localD1(); await migrate(DB);
  env = { DB, GAMES: localR2(), TOKEN_SECRET: "s" };
  down = false;
  net.configure({ api: "https://api.test/", storage: mem(), fetch: ((url: string, init?: RequestInit) => (down ? Promise.reject(new Error("net")) : handle(new Request(url, init), env))) as typeof fetch });
});

describe("backend client", () => {
  it("signs up once and reuses the account", async () => {
    const a = await net.ensurePlayer(), b = await net.ensurePlayer();
    expect(a?.id).toBeTruthy();
    expect(b).toEqual(a);
    expect((await net.me())?.id).toBe(a!.id);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM players").first<{ n: number }>())!.n).toBe(1);
  });
  it("concurrent first calls share one signup", async () => {
    await Promise.all([net.me(), net.pullSave(), net.ensurePlayer()]);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM players").first<{ n: number }>())!.n).toBe(1);
  });
  it("pushes, pulls and reports conflicts on the save", async () => {
    expect((await net.pullSave())?.rev).toBe(0);
    expect(await net.pushSave(0, { coins: 5 })).toEqual({ ok: true, rev: 1 });
    const stale = await net.pushSave(0, { coins: 9 });
    expect(stale.ok).toBe(false);
    expect(stale.conflict).toMatchObject({ rev: 1, data: { coins: 5 } });
    expect((await net.pullSave<{ coins: number }>())?.data?.coins).toBe(5);
  });
  it("is quiet when the network is down, and when no backend is configured", async () => {
    await net.ensurePlayer();
    down = true;
    expect(await net.pullSave()).toBeNull();
    expect((await net.pushSave(0, {})).ok).toBe(false);
    expect(await net.listGames()).toEqual([]);
    net.configure({ api: null });
    expect(net.online()).toBe(false);
    expect(await net.ensurePlayer()).toBeNull();
    expect(await net.me()).toBeNull();
  });
  it("batches analytics and keeps events while offline", async () => {
    net.setGame("brasswick");
    net.track("match_end", { won: true }); net.track("screen", { id: "army" });
    down = true; await net.flush();
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM events").first<{ n: number }>())!.n).toBe(0);
    down = false; await net.flush();
    const rows = await env.DB.prepare("SELECT game, name FROM events ORDER BY id").all<{ game: string; name: string }>();
    expect(rows.results).toEqual([{ game: "brasswick", name: "match_end" }, { game: "brasswick", name: "screen" }]);
  });
});
