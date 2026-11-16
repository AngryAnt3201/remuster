// The Remuster backend: one Cloudflare Worker.
//   /v1/players, /v1/me, /v1/save      anonymous accounts and cloud saves
//   /v1/games, /g/<id>/...             the gallery of player-made games, and the games themselves
//   /v1/arena/...                      the Arena ladder (results re-simulated by the engine before trophies move)
//   /v1/events                         product analytics
// Runs unchanged on Cloudflare and on the local server (infra/local/server.ts).
import { arenaLeaderboard, arenaMatch, arenaResult } from "./arena";
import { HttpError, type Env } from "./env";
import { declareGame, getGame, listGames, moderate, publishGame, reportGame, serveGame, uploadFile } from "./games";
import { createPlayer, getSave, me, putSave, rename, track } from "./players";

export const API_VERSION = 1;

function cors(env: Env, req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = (env.ALLOW_ORIGINS ?? "*").split(",").map((s) => s.trim());
  const ok = allow.includes("*") ? "*" : allow.includes(origin) ? origin : "";
  return ok ? {
    "access-control-allow-origin": ok, "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-allow-headers": "authorization, content-type", "access-control-max-age": "86400", vary: "origin",
  } : {};
}

type Handler = (m: RegExpMatchArray) => Promise<unknown> | unknown;

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url), path = url.pathname, method = req.method;
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "local";

  // published games (not JSON, no CORS: they are pages)
  const g = path.match(/^\/g\/([a-z][a-z0-9-]{2,30})(?:\/(.*))?$/);
  if (g && (method === "GET" || method === "HEAD")) {
    if (g[2] === undefined) return Response.redirect(`${url.origin}/g/${g[1]}/`, 301);
    return serveGame(env, g[1], g[2], url.origin);
  }

  const headers = { "content-type": "application/json", "cache-control": "no-store", ...cors(env, req) };
  if (method === "OPTIONS") return new Response(null, { status: 204, headers });
  const routes: [string, RegExp, Handler][] = [
    ["GET", /^\/v1\/health$/, () => ({ ok: true, api: API_VERSION })],
    ["POST", /^\/v1\/players$/, () => createPlayer(env, req, ip)],
    ["GET", /^\/v1\/me$/, () => me(env, req)],
    ["PUT", /^\/v1\/me$/, () => rename(env, req)],
    ["GET", /^\/v1\/save$/, () => getSave(env, req)],
    ["PUT", /^\/v1\/save$/, () => putSave(env, req)],
    ["GET", /^\/v1\/games$/, () => listGames(env, url)],
    ["POST", /^\/v1\/games$/, () => declareGame(env, req, url.origin)],
    ["GET", /^\/v1\/games\/([a-z][a-z0-9-]{2,30})$/, (m) => getGame(env, m[1], url.origin)],
    ["PUT", /^\/v1\/games\/([a-z][a-z0-9-]{2,30})\/files\/(.+)$/, (m) => uploadFile(env, req, m[1], m[2])],
    ["POST", /^\/v1\/games\/([a-z][a-z0-9-]{2,30})\/publish$/, (m) => publishGame(env, req, m[1], url.origin)],
    ["POST", /^\/v1\/games\/([a-z][a-z0-9-]{2,30})\/report$/, (m) => reportGame(env, req, m[1], ip)],
    ["PUT", /^\/v1\/admin\/games\/([a-z][a-z0-9-]{2,30})$/, (m) => moderate(env, req, m[1])],
    ["POST", /^\/v1\/arena\/match$/, () => arenaMatch(env, req)],
    ["POST", /^\/v1\/arena\/result$/, () => arenaResult(env, req)],
    ["GET", /^\/v1\/arena\/leaderboard$/, () => arenaLeaderboard(env, req, url)],
    ["POST", /^\/v1\/events$/, () => track(env, req, ip)],
  ];
  try {
    let pathMatched = false;
    for (const [m, re, fn] of routes) {
      const hit = path.match(re);
      if (!hit) continue;
      pathMatched = true;
      if (m !== method) continue;
      return new Response(JSON.stringify(await fn(hit)), { status: 200, headers });
    }
    throw pathMatched ? new HttpError(405, "method_not_allowed") : new HttpError(404, "not_found");
  } catch (e) {
    if (e instanceof HttpError) return new Response(JSON.stringify({ error: e.code, message: e.message, ...((e as any).extra ?? {}) }), { status: e.status, headers });
    console.error("unhandled", e);
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers });
  }
}

export default { fetch: (req: Request, env: Env) => handle(req, env) };
