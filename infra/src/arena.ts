// The Arena ladder, server side. Filled in once the Arena engine lands (engine/core/arena.ts): the server issues a
// match (seed, arena, opponent), the client plays it, and the result is re-simulated here by the same engine before
// any trophies move.
import { requirePlayer } from "./auth";
import { HttpError, type Env } from "./env";

export async function arenaMatch(env: Env, req: Request): Promise<unknown> { await requirePlayer(env, req); throw new HttpError(501, "not_ready"); }
export async function arenaResult(env: Env, req: Request): Promise<unknown> { await requirePlayer(env, req); throw new HttpError(501, "not_ready"); }
export async function arenaLeaderboard(env: Env, _req: Request, url: URL) {
  const n = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const r = await env.DB.prepare("SELECT p.name, l.trophies, l.best, l.wins, l.losses FROM ladder l JOIN players p ON p.id = l.player WHERE p.banned = 0 ORDER BY l.trophies DESC, l.updated ASC LIMIT ?").bind(n).all();
  return { top: r.results };
}
