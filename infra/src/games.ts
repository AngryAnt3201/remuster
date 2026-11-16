// The gallery: players publish their re-themed game (a static web build) and anyone can play it at /g/<id>/.
// A publish is: declare the game (POST /v1/games), upload each file of the build into a new draft version (PUT
// /v1/games/<id>/files/<path>), then make that version live (POST /v1/games/<id>/publish). The live version only
// changes when a whole upload has succeeded, so players never see a half-uploaded game.
import { isAdmin, limit, requirePlayer } from "./auth";
import { HttpError, bad, now, type Env } from "./env";

export const GAME_ID = /^[a-z][a-z0-9-]{2,30}$/;
const RESERVED = new Set(["base", "api", "admin", "www", "static", "assets", "new", "g", "v1"]);
const FILE_MAX = 25 * 1024 * 1024, GAME_MAX = 80 * 1024 * 1024, FILES_MAX = 3000;
const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", json: "application/json",
  webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", gif: "image/gif", ico: "image/x-icon",
  woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", m4a: "audio/mp4", mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav",
  mp4: "video/mp4", webm: "video/webm", txt: "text/plain; charset=utf-8", map: "application/json", webmanifest: "application/manifest+json",
};
const typeOf = (path: string) => TYPES[path.slice(path.lastIndexOf(".") + 1).toLowerCase()];
const key = (id: string, version: number, path: string) => `games/${id}/v${version}/${path}`;

function cleanPath(raw: string): string {
  let p: string;
  try { p = decodeURIComponent(raw); } catch { throw bad("bad_path"); }
  if (!p || p.length > 200 || p.startsWith("/") || p.includes("\\") || p.split("/").some((s) => !s || s === "." || s === ".." || s.startsWith("."))) throw bad("bad_path");
  if (!typeOf(p)) throw bad("bad_type", `files of this type can't be published: ${p}`);
  return p;
}

interface GameRow { id: string; owner: string; name: string; tagline: string; theme: string; engine: number; version: number; draft: number; status: string; bytes: number; plays: number; created: number; updated: number }
const pub = (g: GameRow & { creator?: string }, env: Env, origin: string) => ({
  id: g.id, name: g.name, tagline: g.tagline, themeColor: g.theme, engine: g.engine, version: g.version, plays: g.plays,
  creator: g.creator ?? "", updated: g.updated, url: `${env.GAMES_ORIGIN || origin}/g/${g.id}/`,
});

async function owned(env: Env, req: Request, id: string) {
  const p = await requirePlayer(env, req);
  const g = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).first<GameRow>();
  if (!g) throw new HttpError(404, "no_such_game");
  if (g.owner !== p.id) throw new HttpError(403, "not_yours", "this game id belongs to another player");
  return { p, g };
}

/** Declare (or update the details of) a game and open a new draft version to upload into. */
export async function declareGame(env: Env, req: Request, origin: string) {
  const p = await requirePlayer(env, req);
  await limit(env, p.id, "publish", 30, 3600);
  const b = await req.json().catch(() => null) as { id?: unknown; name?: unknown; tagline?: unknown; themeColor?: unknown; engine?: unknown } | null;
  const id = typeof b?.id === "string" ? b.id : "";
  if (!GAME_ID.test(id) || RESERVED.has(id)) throw bad("bad_id", "3 to 31 lower-case letters, digits or dashes, starting with a letter");
  const name = typeof b?.name === "string" ? b.name.trim().slice(0, 40) : "";
  if (name.length < 2) throw bad("bad_name");
  const tagline = typeof b?.tagline === "string" ? b.tagline.trim().slice(0, 140) : "";
  const theme = typeof b?.themeColor === "string" && /^#[0-9a-fA-F]{6}$/.test(b.themeColor) ? b.themeColor : "#0b0f17";
  const engine = typeof b?.engine === "number" && Number.isInteger(b.engine) && b.engine >= 0 ? b.engine : 0;
  const t = now();
  const cur = await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).first<GameRow>();
  if (cur && cur.owner !== p.id) throw new HttpError(409, "taken", "that game id is taken");
  if (!cur) {
    const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM games WHERE owner = ?").bind(p.id).first<{ n: number }>();
    if ((mine?.n ?? 0) >= 20) throw new HttpError(403, "too_many_games");
    await env.DB.prepare("INSERT INTO games (id, owner, name, tagline, theme, engine, draft, created, updated) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(id, p.id, name, tagline, theme, engine, t, t).run();
    return { ...pub({ ...(await env.DB.prepare("SELECT * FROM games WHERE id = ?").bind(id).first<GameRow>())!, creator: p.name }, env, origin), draft: 1 };
  }
  // a fresh draft each time: drop whatever an abandoned upload left behind
  const draft = Math.max(cur.version, cur.draft) + 1;
  await dropVersion(env, id, cur.draft > cur.version ? cur.draft : -1);
  await env.DB.prepare("UPDATE games SET name = ?, tagline = ?, theme = ?, engine = ?, draft = ?, updated = ? WHERE id = ?").bind(name, tagline, theme, engine, draft, t, id).run();
  return { ...pub({ ...cur, name, tagline, theme, engine, creator: p.name }, env, origin), draft };
}

async function dropVersion(env: Env, id: string, version: number) {
  if (version < 1) return;
  const files = await env.DB.prepare("SELECT path FROM game_files WHERE game = ? AND version = ?").bind(id, version).all<{ path: string }>();
  for (let i = 0; i < files.results.length; i += 500) await env.GAMES.delete(files.results.slice(i, i + 500).map((f) => key(id, version, f.path)));
  await env.DB.prepare("DELETE FROM game_files WHERE game = ? AND version = ?").bind(id, version).run();
}

export async function uploadFile(env: Env, req: Request, id: string, rawPath: string) {
  const { g } = await owned(env, req, id);
  if (g.draft <= g.version) throw bad("no_draft", "declare the game first (POST /v1/games)");
  const path = cleanPath(rawPath);
  const body = await req.arrayBuffer();
  if (body.byteLength > FILE_MAX) throw new HttpError(413, "too_large", `${path} is over 25 MB`);
  const tot = await env.DB.prepare("SELECT COALESCE(SUM(size), 0) AS bytes, COUNT(*) AS n FROM game_files WHERE game = ? AND version = ? AND path != ?").bind(id, g.draft, path).first<{ bytes: number; n: number }>();
  if ((tot?.bytes ?? 0) + body.byteLength > GAME_MAX) throw new HttpError(413, "game_too_large", "a game can be at most 80 MB");
  if ((tot?.n ?? 0) >= FILES_MAX) throw new HttpError(413, "too_many_files");
  const type = typeOf(path)!;
  await env.GAMES.put(key(id, g.draft, path), body, { httpMetadata: { contentType: type } });
  await env.DB.prepare("INSERT INTO game_files (game, version, path, size, type) VALUES (?, ?, ?, ?, ?) ON CONFLICT(game, version, path) DO UPDATE SET size = excluded.size, type = excluded.type").bind(id, g.draft, path, body.byteLength, type).run();
  return { path, size: body.byteLength };
}

/** Make the draft live. The build must have an index.html; the previous live version's files are removed. */
export async function publishGame(env: Env, req: Request, id: string, origin: string) {
  const { p, g } = await owned(env, req, id);
  if (g.draft <= g.version) throw bad("no_draft");
  const tot = await env.DB.prepare("SELECT COALESCE(SUM(size), 0) AS bytes, COUNT(*) AS n, SUM(path = 'index.html') AS idx FROM game_files WHERE game = ? AND version = ?").bind(id, g.draft).first<{ bytes: number; n: number; idx: number }>();
  if (!tot?.idx) throw bad("no_index", "the build has no index.html");
  const old = g.version;
  await env.DB.prepare("UPDATE games SET version = ?, bytes = ?, updated = ? WHERE id = ?").bind(g.draft, tot.bytes, now(), id).run();
  await dropVersion(env, id, old);
  return { ...pub({ ...g, version: g.draft, creator: p.name }, env, origin), files: tot.n, bytes: tot.bytes };
}

export async function listGames(env: Env, url: URL) {
  const limitN = Math.min(60, Math.max(1, Number(url.searchParams.get("limit")) || 30));
  const sort = url.searchParams.get("sort") === "new" ? "g.updated DESC" : "g.plays DESC, g.updated DESC";
  const r = await env.DB.prepare(`SELECT g.*, p.name AS creator FROM games g JOIN players p ON p.id = g.owner WHERE g.status = 'live' AND g.version > 0 ORDER BY ${sort} LIMIT ?`).bind(limitN).all<GameRow & { creator: string }>();
  return { games: r.results.map((g) => pub(g, env, url.origin)) };
}

export async function getGame(env: Env, id: string, origin: string) {
  const g = await env.DB.prepare("SELECT g.*, p.name AS creator FROM games g JOIN players p ON p.id = g.owner WHERE g.id = ? AND g.status = 'live' AND g.version > 0").bind(id).first<GameRow & { creator: string }>();
  if (!g) throw new HttpError(404, "no_such_game");
  return pub(g, env, origin);
}

export async function reportGame(env: Env, req: Request, id: string, ip: string) {
  await limit(env, ip, "report", 10, 3600);
  const b = await req.json().catch(() => ({})) as { reason?: unknown };
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  if (reason.length < 3) throw bad("bad_reason");
  await env.DB.prepare("INSERT INTO reports (game, reason, created) VALUES (?, ?, ?)").bind(id, reason, now()).run();
  return { ok: true };
}

/** Operator only: hide or restore a game. */
export async function moderate(env: Env, req: Request, id: string) {
  if (!isAdmin(env, req)) throw new HttpError(403, "forbidden");
  const b = await req.json().catch(() => ({})) as { status?: unknown };
  if (b.status !== "live" && b.status !== "hidden") throw bad("bad_status");
  const r = await env.DB.prepare("UPDATE games SET status = ? WHERE id = ?").bind(b.status, id).run();
  if (!r.meta.changes) throw new HttpError(404, "no_such_game");
  return { id, status: b.status };
}

/** GET /g/<id>/<path>: a published game's files. A player-made page never gets to talk to anything but itself
 *  and the API (Content-Security-Policy), and is counted as a play when its index is opened. */
export async function serveGame(env: Env, id: string, rawPath: string, apiOrigin: string): Promise<Response> {
  const g = await env.DB.prepare("SELECT version, status FROM games WHERE id = ?").bind(id).first<{ version: number; status: string }>();
  if (!g || g.status !== "live" || g.version < 1) return new Response("No such game", { status: 404 });
  let path = rawPath || "index.html";
  try { path = decodeURIComponent(path); } catch { return new Response("Bad path", { status: 400 }); }
  if (path.endsWith("/")) path += "index.html";
  if (path.split("/").some((s) => s === ".." || s === ".")) return new Response("Bad path", { status: 400 });
  const obj = await env.GAMES.get(key(id, g.version, path));
  if (!obj) return new Response("Not found", { status: 404 });
  const index = path === "index.html";
  if (index) await env.DB.prepare("UPDATE games SET plays = plays + 1 WHERE id = ?").bind(id).run();
  return new Response(await obj.arrayBuffer(), {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? typeOf(path) ?? "application/octet-stream",
      // hashed build assets never change; everything else is revalidated so a republish shows up at once
      "cache-control": /\/assets\/|^assets\//.test(path) ? "public, max-age=31536000, immutable" : "public, max-age=60",
      "content-security-policy": `default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${apiOrigin}; frame-ancestors *; base-uri 'self'; form-action 'none'`,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
