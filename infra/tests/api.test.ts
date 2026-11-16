// The backend end to end against the real Worker code, on Node's SQLite and an in-memory bucket.
import { beforeEach, describe, expect, it } from "vitest";
import { handle } from "../src/worker";
import type { Env } from "../src/env";
import { localD1, migrate } from "../local/d1";
import { localR2 } from "../local/r2";

let env: Env;
const api = async (method: string, path: string, opts: { token?: string; body?: unknown; raw?: Uint8Array; headers?: Record<string, string> } = {}) => {
  const r = await handle(new Request(`https://api.test${path}`, {
    method,
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.headers ?? {}) },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  }), env);
  const type = r.headers.get("content-type") ?? "";
  return { status: r.status, headers: r.headers, json: type.includes("json") && r.status !== 204 ? await r.clone().json() as any : null, bytes: new Uint8Array(await r.arrayBuffer()) };
};
const signup = async (name?: string) => (await api("POST", "/v1/players", { body: name ? { name } : {} })).json as { id: string; name: string; token: string };
const text = (s: string) => new TextEncoder().encode(s);

beforeEach(async () => {
  const DB = localD1();
  await migrate(DB);
  env = { DB, GAMES: localR2(), TOKEN_SECRET: "test-secret", ADMIN_TOKEN: "admin-secret" };
});

describe("players", () => {
  it("signs up anonymously, with a generated or a chosen name", async () => {
    const a = await signup(), b = await signup("Jack the Bold");
    expect(a.id).not.toBe(b.id);
    expect(a.name.length).toBeGreaterThan(3);
    expect(b.name).toBe("Jack the Bold");
    const me = await api("GET", "/v1/me", { token: b.token });
    expect(me.json).toMatchObject({ id: b.id, name: "Jack the Bold", ladder: { trophies: 0 } });
  });
  it("rejects forged, missing and foreign tokens", async () => {
    const a = await signup();
    expect((await api("GET", "/v1/me")).status).toBe(401);
    expect((await api("GET", "/v1/me", { token: `${a.id}.forged` })).status).toBe(401);
    const [id, sig] = a.token.split(".");
    expect((await api("GET", "/v1/me", { token: `${id.replace(/.$/, "0")}.${sig}` })).status).toBe(401);
    expect((await api("GET", "/v1/me", { token: a.token })).status).toBe(200);
  });
  it("renames with validation", async () => {
    const a = await signup();
    expect((await api("PUT", "/v1/me", { token: a.token, body: { name: "x" } })).status).toBe(400);
    expect((await api("PUT", "/v1/me", { token: a.token, body: { name: "<script>" } })).status).toBe(400);
    expect((await api("PUT", "/v1/me", { token: a.token, body: { name: "Wren  O'Hara" } })).json.name).toBe("Wren O'Hara");
  });
  it("rate-limits signups per address", async () => {
    for (let i = 0; i < 20; i++) expect((await api("POST", "/v1/players", { body: {} })).status).toBe(200);
    expect((await api("POST", "/v1/players", { body: {} })).status).toBe(429);
  });
});

describe("cloud saves", () => {
  it("round-trips a save and bumps the revision", async () => {
    const a = await signup();
    expect((await api("GET", "/v1/save", { token: a.token })).json).toMatchObject({ rev: 0, data: null });
    const w = await api("PUT", "/v1/save", { token: a.token, body: { rev: 0, data: { campaign: { 1: 3 }, coins: 40 } } });
    expect(w.json.rev).toBe(1);
    expect((await api("GET", "/v1/save", { token: a.token })).json).toMatchObject({ rev: 1, data: { campaign: { 1: 3 }, coins: 40 } });
  });
  it("refuses a stale write and hands back the server's copy", async () => {
    const a = await signup();
    await api("PUT", "/v1/save", { token: a.token, body: { rev: 0, data: { v: "phone" } } });
    const stale = await api("PUT", "/v1/save", { token: a.token, body: { rev: 0, data: { v: "tablet" } } });
    expect(stale.status).toBe(409);
    expect(stale.json).toMatchObject({ error: "conflict", rev: 1, data: { v: "phone" } });
    expect((await api("PUT", "/v1/save", { token: a.token, body: { rev: 1, data: { v: "merged" } } })).json.rev).toBe(2);
  });
  it("keeps players' saves apart and rejects junk", async () => {
    const a = await signup(), b = await signup();
    await api("PUT", "/v1/save", { token: a.token, body: { rev: 0, data: { who: "a" } } });
    expect((await api("GET", "/v1/save", { token: b.token })).json.data).toBeNull();
    expect((await api("PUT", "/v1/save", { token: b.token, body: { rev: 0 } })).status).toBe(400);
    expect((await api("PUT", "/v1/save", { token: b.token, raw: text("{not json") })).status).toBe(400);
    expect((await api("PUT", "/v1/save", { token: b.token, body: { rev: 0, data: { big: "x".repeat(600_000) } } })).status).toBe(413);
  });
});

describe("published games", () => {
  const publish = async (token: string, id: string, files: Record<string, string>, meta: Record<string, unknown> = {}) => {
    const d = await api("POST", "/v1/games", { token, body: { id, name: "Brasswick", tagline: "Steam and brass", themeColor: "#3b2a1a", engine: 1, ...meta } });
    if (d.status !== 200) return d;
    for (const [p, c] of Object.entries(files)) { const u = await api("PUT", `/v1/games/${id}/files/${p}`, { token, raw: text(c) }); if (u.status !== 200) return u; }
    return api("POST", `/v1/games/${id}/publish`, { token });
  };

  it("publishes a build and serves it, with the right types and a locked-down policy", async () => {
    const a = await signup("Maker");
    const r = await publish(a.token, "brasswick", { "index.html": "<h1>v1</h1>", "assets/app-abc123.js": "console.log(1)", "atlas/manifest.json": "{}" });
    expect(r.json).toMatchObject({ id: "brasswick", version: 1, files: 3, url: "https://api.test/g/brasswick/" });
    const page = await api("GET", "/g/brasswick/");
    expect(page.status).toBe(200);
    expect(new TextDecoder().decode(page.bytes)).toBe("<h1>v1</h1>");
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(page.headers.get("content-security-policy")).toContain("connect-src 'self' https://api.test");
    const js = await api("GET", "/g/brasswick/assets/app-abc123.js");
    expect(js.headers.get("content-type")).toContain("javascript");
    expect(js.headers.get("cache-control")).toContain("immutable");
    expect((await api("GET", "/g/brasswick/missing.png")).status).toBe(404);
    expect((await api("GET", "/g/brasswick")).status).toBe(301);
  });

  it("lists live games with creator and play count", async () => {
    const a = await signup("Maker");
    await publish(a.token, "brasswick", { "index.html": "x" });
    await api("GET", "/g/brasswick/"); await api("GET", "/g/brasswick/");
    const list = await api("GET", "/v1/games");
    expect(list.json.games).toHaveLength(1);
    expect(list.json.games[0]).toMatchObject({ id: "brasswick", name: "Brasswick", creator: "Maker", plays: 2, themeColor: "#3b2a1a" });
  });

  it("only goes live when a whole upload is published, and a republish replaces the old files", async () => {
    const a = await signup();
    await publish(a.token, "brasswick", { "index.html": "v1", "old.css": "a{}" });
    // a second upload in progress: still serving v1
    await api("POST", "/v1/games", { token: a.token, body: { id: "brasswick", name: "Brasswick" } });
    await api("PUT", "/v1/games/brasswick/files/index.html", { token: a.token, raw: text("v2") });
    expect(new TextDecoder().decode((await api("GET", "/g/brasswick/")).bytes)).toBe("v1");
    const r = await api("POST", "/v1/games/brasswick/publish", { token: a.token });
    expect(r.json.version).toBe(2);
    expect(new TextDecoder().decode((await api("GET", "/g/brasswick/")).bytes)).toBe("v2");
    expect((await api("GET", "/g/brasswick/old.css")).status).toBe(404);
    expect((await env.GAMES.list({ prefix: "games/brasswick/v1/" })).objects).toHaveLength(0);
  });

  it("protects ids, owners, paths and file types", async () => {
    const a = await signup(), b = await signup();
    await publish(a.token, "brasswick", { "index.html": "x" });
    expect((await api("POST", "/v1/games", { token: b.token, body: { id: "brasswick", name: "Mine now" } })).status).toBe(409);
    expect((await api("PUT", "/v1/games/brasswick/files/index.html", { token: b.token, raw: text("pwn") })).status).toBe(403);
    expect((await api("POST", "/v1/games", { token: a.token, body: { id: "base", name: "Nope" } })).status).toBe(400);
    expect((await api("POST", "/v1/games", { token: a.token, body: { id: "Bad Id", name: "Nope" } })).status).toBe(400);
    await api("POST", "/v1/games", { token: a.token, body: { id: "brasswick", name: "Brasswick" } });
    for (const p of ["../escape.js", "a/../../b.js", ".env", "run.exe", "nested/.hidden.js"]) {
      expect((await api("PUT", `/v1/games/brasswick/files/${encodeURIComponent(p)}`, { token: a.token, raw: text("x") })).status, p).toBe(400);
    }
    expect((await api("GET", "/g/brasswick/..%2F..%2Fsecret")).status).not.toBe(200);
  });

  it("needs an index.html to publish", async () => {
    const a = await signup();
    const r = await publish(a.token, "nopage", { "app.js": "1" });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("no_index");
    expect((await api("GET", "/g/nopage/")).status).toBe(404);
  });

  it("lets the operator take a game down, and only the operator", async () => {
    const a = await signup();
    await publish(a.token, "brasswick", { "index.html": "x" });
    expect((await api("PUT", "/v1/admin/games/brasswick", { token: a.token, body: { status: "hidden" } })).status).toBe(403);
    expect((await api("POST", "/v1/games/brasswick/report", { body: { reason: "stolen art" } })).status).toBe(200);
    expect((await api("PUT", "/v1/admin/games/brasswick", { token: "admin-secret", body: { status: "hidden" } })).status).toBe(200);
    expect((await api("GET", "/g/brasswick/")).status).toBe(404);
    expect((await api("GET", "/v1/games")).json.games).toHaveLength(0);
  });
});

describe("the API surface", () => {
  it("answers health, CORS preflight, unknown routes and wrong methods", async () => {
    expect((await api("GET", "/v1/health")).json).toMatchObject({ ok: true });
    const pre = await api("OPTIONS", "/v1/save", { headers: { origin: "https://brasswick.example" } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe("*");
    expect((await api("GET", "/v1/nope")).status).toBe(404);
    expect((await api("DELETE", "/v1/save")).status).toBe(405);
  });
  it("can restrict CORS to listed origins", async () => {
    env.ALLOW_ORIGINS = "https://play.example";
    expect((await api("GET", "/v1/health", { headers: { origin: "https://evil.example" } })).headers.get("access-control-allow-origin")).toBeNull();
    expect((await api("GET", "/v1/health", { headers: { origin: "https://play.example" } })).headers.get("access-control-allow-origin")).toBe("https://play.example");
  });
  it("stores analytics events, dropping malformed ones", async () => {
    const r = await api("POST", "/v1/events", { body: { game: "brasswick", events: [{ name: "match_end", props: { won: true } }, { name: "BAD NAME" }, { nope: 1 }] } });
    expect(r.json.stored).toBe(1);
  });
});
