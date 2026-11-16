// Accounts and cloud saves.
import { cleanName, limit, randomName, requirePlayer, tokenFor } from "./auth";
import { HttpError, bad, now, type Env } from "./env";

const SAVE_MAX = 512 * 1024; // bytes of JSON

export async function createPlayer(env: Env, req: Request, ip: string) {
  await limit(env, ip, "signup", 20, 3600);
  const body = await req.json().catch(() => ({})) as { name?: unknown };
  const id = crypto.randomUUID();
  const name = cleanName(body.name) ?? randomName();
  await env.DB.prepare("INSERT INTO players (id, name, created, seen) VALUES (?, ?, ?, ?)").bind(id, name, now(), now()).run();
  return { id, name, token: await tokenFor(env, id) };
}

export async function me(env: Env, req: Request) {
  const p = await requirePlayer(env, req);
  const l = await env.DB.prepare("SELECT trophies, best, wins, losses FROM ladder WHERE player = ?").bind(p.id).first();
  return { id: p.id, name: p.name, ladder: l ?? { trophies: 0, best: 0, wins: 0, losses: 0 } };
}

export async function rename(env: Env, req: Request) {
  const p = await requirePlayer(env, req);
  await limit(env, p.id, "rename", 10, 86400);
  const name = cleanName(((await req.json().catch(() => ({}))) as { name?: unknown }).name);
  if (!name) throw bad("bad_name", "2 to 20 letters, digits, spaces or . _ ' -");
  await env.DB.prepare("UPDATE players SET name = ? WHERE id = ?").bind(name, p.id).run();
  return { id: p.id, name };
}

export async function getSave(env: Env, req: Request) {
  const p = await requirePlayer(env, req);
  const s = await env.DB.prepare("SELECT rev, data, updated FROM saves WHERE player = ?").bind(p.id).first<{ rev: number; data: string; updated: number }>();
  return s ? { rev: s.rev, updated: s.updated, data: JSON.parse(s.data) } : { rev: 0, updated: 0, data: null };
}

/** Write the save if the caller has seen the latest one: `rev` is the revision they last read (0 = none). On a
 *  mismatch the server's copy comes back with 409 and the client merges and retries. */
export async function putSave(env: Env, req: Request) {
  const p = await requirePlayer(env, req);
  await limit(env, p.id, "save", 120, 3600);
  const text = await req.text();
  if (text.length > SAVE_MAX) throw new HttpError(413, "too_large", "save over 512 KB");
  let body: { rev?: unknown; data?: unknown };
  try { body = JSON.parse(text); } catch { throw bad("bad_json"); }
  if (typeof body.rev !== "number" || !body.data || typeof body.data !== "object") throw bad("bad_save", "expected { rev, data }");
  const data = JSON.stringify(body.data), t = now();
  const cur = await env.DB.prepare("SELECT rev, data, updated FROM saves WHERE player = ?").bind(p.id).first<{ rev: number; data: string; updated: number }>();
  if ((cur?.rev ?? 0) !== body.rev) {
    throw Object.assign(new HttpError(409, "conflict", "the save changed on another device"), { extra: { rev: cur?.rev ?? 0, updated: cur?.updated ?? 0, data: cur ? JSON.parse(cur.data) : null } });
  }
  const rev = body.rev + 1;
  // guard the write on the revision too, so two racing writers can't both win
  const r = cur
    ? await env.DB.prepare("UPDATE saves SET rev = ?, data = ?, updated = ? WHERE player = ? AND rev = ?").bind(rev, data, t, p.id, body.rev).run()
    : await env.DB.prepare("INSERT OR IGNORE INTO saves (player, rev, data, updated) VALUES (?, ?, ?, ?)").bind(p.id, rev, data, t).run();
  if (!r.meta.changes) throw new HttpError(409, "conflict", "the save changed on another device");
  return { rev, updated: t };
}

export async function track(env: Env, req: Request, ip: string) {
  const body = await req.json().catch(() => null) as { game?: unknown; player?: unknown; events?: unknown } | null;
  if (!body || !Array.isArray(body.events)) throw bad("bad_events");
  await limit(env, ip, "events", 120, 3600);
  const game = typeof body.game === "string" ? body.game.slice(0, 40) : null;
  const player = typeof body.player === "string" ? body.player.slice(0, 40) : null;
  const rows = body.events.slice(0, 50).filter((e): e is { name: string; props?: unknown; at?: number } => !!e && typeof e.name === "string" && /^[a-z0-9_.:-]{1,48}$/.test(e.name));
  if (rows.length) {
    await env.DB.batch(rows.map((e) => env.DB.prepare("INSERT INTO events (player, game, name, props, at) VALUES (?, ?, ?, ?, ?)")
      .bind(player, game, e.name, e.props === undefined ? null : JSON.stringify(e.props).slice(0, 2000), typeof e.at === "number" ? e.at : now())));
  }
  return { stored: rows.length };
}
