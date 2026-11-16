// The Arena ladder, server side. The server owns each player's ladder (the engine's ArenaSave) and issues matches
// from it with a seed of its own choosing; the client plays the match and sends back a record of the boards each
// round was fought with (engine/core/ghost.ts); the server rebuilds the match, re-fights every round with the same
// engine, and only then moves trophies with the engine's finishArena. Nothing the client says about the outcome is
// read. README.md ("The Arena ladder: what the server checks") has the model and its limits.
import { arenaConfig, arenaFor, blankArena, finishArena, normalizeArena, type ArenaSave } from "../../engine/core/arena";
import { START_HP, UNIT_KINDS, type UnitKind } from "../../engine/core/defs";
import { RECORD_VERSION, decodeRecord, replayArena } from "../../engine/core/ghost";
import { clampLevel, type Levels } from "../../engine/core/levels";
import { MAX_COMMANDER, keepBonus } from "../../engine/progression/economy";
import { limit, requirePlayer } from "./auth";
import { HttpError, bad, now, type Env } from "./env";

/** An issued match nobody finished is dropped (no result, no penalty) after this long. */
export const MATCH_TTL = 24 * 3600 * 1000;
const BODY_MAX = 256 * 1024;
const GHOSTS_KEPT = 5;
const OPEN = 0, PLAYED = 1, FORFEIT = 2, EXPIRED = 3;

interface Setup { save: ArenaSave; levels?: Levels; roster?: UnitKind[]; hp: number }
interface MatchRow { id: string; player: string; seed: number; arena: string; created: number; settled: number; setup: string }

/** What the player says they bring, held to what the engine allows: levels 1..MAX_LEVEL for real units, a roster of
 * real units without repeats, keep health between the base and the most a commander can add. */
function loadout(b: { levels?: unknown; roster?: unknown; hp?: unknown } | null): Omit<Setup, "save"> {
  const levels: Levels = {};
  if (b?.levels && typeof b.levels === "object") {
    for (const k of UNIT_KINDS) { const l = clampLevel((b.levels as Record<string, unknown>)[k]); if (l > 1) levels[k] = l; }
  }
  const roster = Array.isArray(b?.roster) ? UNIT_KINDS.filter((k) => (b!.roster as unknown[]).includes(k)) : [];
  const hpMax = START_HP + keepBonus(MAX_COMMANDER);
  const hp = typeof b?.hp === "number" && Number.isFinite(b.hp) ? Math.max(START_HP, Math.min(hpMax, Math.floor(b.hp))) : START_HP;
  return { ...(Object.keys(levels).length ? { levels } : {}), ...(roster.length ? { roster } : {}), hp };
}

async function ladderOf(env: Env, player: string): Promise<ArenaSave> {
  const row = await env.DB.prepare("SELECT save FROM ladder WHERE player = ?").bind(player).first<{ save: string | null }>();
  if (!row?.save) return blankArena();
  try { return normalizeArena(JSON.parse(row.save)); } catch { return blankArena(); }
}
const ticket = (m: Pick<MatchRow, "id" | "seed" | "arena">, s: Setup) => ({ id: m.id, seed: m.seed, arena: m.arena, save: s.save, levels: s.levels, roster: s.roster, hp: s.hp });
/** The MatchConfig for an issued match: the same call the client makes with the ticket. */
const configOf = (m: Pick<MatchRow, "seed" | "arena">, s: Setup) => arenaConfig(normalizeArena(s.save), { seed: m.seed, arena: m.arena, levels: s.levels, roster: s.roster, hp: s.hp }).cfg;

/**
 * POST /v1/arena/match { levels?, roster?, hp? } -> { id, seed, arena, save, levels?, roster?, hp }.
 * `arenaConfig(save, { seed, arena, levels, roster, hp })` on the client is the match. A player has one open match:
 * asking again returns it (same seed and arena, with the loadout just sent) until a result settles it or it expires.
 */
export async function arenaMatch(env: Env, req: Request) {
  const p = await requirePlayer(env, req);
  await limit(env, p.id, "arena_match", 240, 3600);
  const mine = loadout(await req.json().catch(() => null) as Record<string, unknown> | null);
  const t = now();
  const open = await env.DB.prepare("SELECT id, player, seed, arena, created, settled, setup FROM matches WHERE player = ? AND settled = 0 ORDER BY created DESC LIMIT 1").bind(p.id).first<MatchRow>();
  if (open && t - open.created < MATCH_TTL) {
    const setup: Setup = { ...mine, save: normalizeArena((JSON.parse(open.setup) as Partial<Setup>).save) };
    await env.DB.prepare("UPDATE matches SET setup = ? WHERE id = ? AND settled = 0").bind(JSON.stringify(setup), open.id).run();
    return ticket(open, setup);
  }
  if (open) await env.DB.prepare("UPDATE matches SET settled = ? WHERE player = ? AND settled = 0").bind(EXPIRED, p.id).run();
  const save = await ladderOf(env, p.id);
  delete save.day; // the daily coin count is the device's, not the ladder's
  const setup: Setup = { ...mine, save };
  const m = { id: crypto.randomUUID(), seed: crypto.getRandomValues(new Uint32Array(1))[0], arena: arenaFor(save).id };
  await env.DB.prepare("INSERT INTO matches (id, player, seed, arena, trophies, created, setup) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(m.id, p.id, m.seed, m.arena, save.trophies, t, JSON.stringify(setup)).run();
  return ticket(m, setup);
}

/**
 * POST /v1/arena/result { id, record } or { id, forfeit: true } -> { result, save }.
 * The record is replayed; the winner is the replay's. Errors: 404 no_such_match, 403 not_yours, 409 already_settled,
 * 410 expired, 422 bad_record (the message says which rule a board broke; the match stays open).
 */
export async function arenaResult(env: Env, req: Request) {
  const p = await requirePlayer(env, req);
  await limit(env, p.id, "arena_result", 240, 3600);
  const text = await req.text();
  if (text.length > BODY_MAX) throw new HttpError(413, "too_large", "record over 256 KB");
  let b: { id?: unknown; record?: unknown; forfeit?: unknown };
  try { b = JSON.parse(text); } catch { throw bad("bad_json"); }
  if (!b || typeof b.id !== "string") throw bad("bad_result", "expected { id, record } or { id, forfeit: true }");
  const m = await env.DB.prepare("SELECT id, player, seed, arena, created, settled, setup FROM matches WHERE id = ?").bind(b.id).first<MatchRow>();
  if (!m) throw new HttpError(404, "no_such_match");
  if (m.player !== p.id) throw new HttpError(403, "not_yours", "this match was issued to another player");
  if (m.settled === EXPIRED) throw new HttpError(410, "expired", "this match expired");
  if (m.settled !== OPEN) throw new HttpError(409, "already_settled", "this match already has a result");
  const t = now();
  if (t - m.created >= MATCH_TTL) {
    await env.DB.prepare("UPDATE matches SET settled = ? WHERE id = ? AND settled = 0").bind(EXPIRED, m.id).run();
    throw new HttpError(410, "expired", "this match expired");
  }
  const setup = JSON.parse(m.setup) as Setup;
  const forfeit = b.forfeit === true;
  let won = false, rounds = 0;
  if (!forfeit) {
    const r = replayArena(configOf(m, setup), b.record);
    if (!r.ok) throw new HttpError(422, "bad_record", r.reason);
    won = r.winner === 0;
    rounds = r.rounds;
  }
  // Claim the match first: of two racing results, one settles it and the other is told it is settled.
  const claim = await env.DB.prepare("UPDATE matches SET settled = ?, won = ?, rounds = ? WHERE id = ? AND settled = 0").bind(forfeit ? FORFEIT : PLAYED, won ? 1 : 0, rounds, m.id).run();
  if (!claim.meta.changes) throw new HttpError(409, "already_settled", "this match already has a result");

  const save = await ladderOf(env, p.id);
  delete save.day;
  const result = finishArena(save, m.arena, won);
  await env.DB.prepare(
    "INSERT INTO ladder (player, trophies, best, wins, losses, updated, save) VALUES (?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(player) DO UPDATE SET trophies = excluded.trophies, best = excluded.best, wins = excluded.wins, losses = excluded.losses, updated = excluded.updated, save = excluded.save",
  ).bind(p.id, save.trophies, save.best, save.wins, save.losses, t, JSON.stringify(save)).run();

  if (!forfeit) {
    // The army the player ended on, kept as a future opponent for others.
    const boards = decodeRecord(b.record)!, last = boards[boards.length - 1];
    const pieces = last.pieces.filter((x) => x.side === 0).map((x) => [x.kind, x.x, x.y, x.rank]);
    if (pieces.length) {
      await env.DB.prepare("INSERT INTO ghosts (player, name, trophies, arena, engine, data, created) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(p.id, p.name, save.trophies, m.arena, RECORD_VERSION, JSON.stringify({ v: RECORD_VERSION, round: last.round, won, levels: setup.levels ?? {}, pieces }), t).run();
      await env.DB.prepare("DELETE FROM ghosts WHERE player = ? AND id NOT IN (SELECT id FROM ghosts WHERE player = ? ORDER BY id DESC LIMIT ?)").bind(p.id, p.id, GHOSTS_KEPT).run();
    }
  }
  return { result, save };
}

export async function arenaLeaderboard(env: Env, _req: Request, url: URL) {
  const n = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const r = await env.DB.prepare("SELECT p.name, l.trophies, l.best, l.wins, l.losses FROM ladder l JOIN players p ON p.id = l.player WHERE p.banned = 0 ORDER BY l.trophies DESC, l.updated ASC LIMIT ?").bind(n).all();
  return { top: r.results };
}
