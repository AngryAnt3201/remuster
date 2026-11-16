// Player identity: an anonymous account per install. The token is "<id>.<HMAC-SHA256(secret, id)>", so it is
// verified without a database read and can't be forged without the secret.
import { HttpError, now, type Env } from "./env";

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sign(secret: string, id: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(id)));
}
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function tokenFor(env: Env, id: string) { return `${id}.${await sign(env.TOKEN_SECRET, id)}`; }

/** The player id a request is signed in as, or null. */
export async function playerOf(env: Env, req: Request): Promise<string | null> {
  const h = req.headers.get("authorization") ?? "";
  const tok = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const dot = tok.lastIndexOf(".");
  if (dot < 1) return null;
  const id = tok.slice(0, dot);
  return same(tok.slice(dot + 1), await sign(env.TOKEN_SECRET, id)) ? id : null;
}

/** The signed-in, existing, not-banned player (401/403 otherwise); also stamps when they were last seen. */
export async function requirePlayer(env: Env, req: Request): Promise<{ id: string; name: string }> {
  const id = await playerOf(env, req);
  if (!id) throw new HttpError(401, "unauthorized", "missing or invalid player token");
  const p = await env.DB.prepare("SELECT id, name, banned FROM players WHERE id = ?").bind(id).first<{ id: string; name: string; banned: number }>();
  if (!p) throw new HttpError(401, "unauthorized", "unknown player");
  if (p.banned) throw new HttpError(403, "banned");
  await env.DB.prepare("UPDATE players SET seen = ? WHERE id = ?").bind(now(), id).run();
  return { id: p.id, name: p.name };
}

export function isAdmin(env: Env, req: Request) {
  const h = req.headers.get("authorization") ?? "";
  return !!env.ADMIN_TOKEN && h.startsWith("Bearer ") && same(h.slice(7).trim(), env.ADMIN_TOKEN);
}

/** Fixed-window rate limit: at most `max` of `action` per `windowSec` for `who`. Throws 429 past it. */
export async function limit(env: Env, who: string, action: string, max: number, windowSec: number) {
  const win = Math.floor(now() / 1000 / windowSec), key = `${action}:${who}`;
  const r = await env.DB.prepare(
    "INSERT INTO rate (key, win, n) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET n = CASE WHEN win = excluded.win THEN n + 1 ELSE 1 END, win = excluded.win RETURNING n",
  ).bind(key, win).first<{ n: number }>();
  if ((r?.n ?? 0) > max) throw new HttpError(429, "slow_down", `too many ${action} requests`);
}

const NAME = /^[\p{L}\p{N} _.'-]{2,20}$/u;
export function cleanName(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  return NAME.test(s) ? s : null;
}
const ADJ = ["Bold", "Swift", "Iron", "Lucky", "Quiet", "Brave", "Grim", "Merry", "Sly", "Stout", "Keen", "Wild"];
const NOUN = ["Marshal", "Warden", "Captain", "Ranger", "Baron", "Tinker", "Lancer", "Scout", "Duelist", "Bannerman", "Sapper", "Regent"];
export function randomName(): string {
  const r = crypto.getRandomValues(new Uint32Array(3));
  return `${ADJ[r[0] % ADJ.length]} ${NOUN[r[1] % NOUN.length]} ${100 + (r[2] % 900)}`;
}
