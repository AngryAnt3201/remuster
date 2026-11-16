// The client for the Remuster backend (infra/): accounts, cloud saves, the games gallery, the Arena ladder and
// analytics. Every game talks to the same backend through this file, whatever it looks like.
//
// The backend is optional. With no API URL configured (VITE_REMUSTER_API unset) `online()` is false, every call
// resolves to null, and the game plays fully offline exactly as before. Nothing here throws to its caller: a
// network failure is the same as being offline.
import { arenaConfig, type ArenaMatch, type ArenaResult, type ArenaSave } from "../core/arena";
import type { UnitKind } from "../core/defs";
import type { MatchRecord } from "../core/ghost";
import type { Levels } from "../core/levels";

const TOKEN_KEY = "remuster.player.v1";
export interface Player { id: string; name: string; token: string; }
export interface GameListing { id: string; name: string; tagline: string; themeColor: string; creator: string; plays: number; version: number; updated: number; url: string; }
export interface LadderRow { name: string; trophies: number; best: number; wins: number; losses: number; }

let apiBase: string | null | undefined;
let fetchImpl: typeof fetch | null = null;
let store: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null | undefined;
let player: Player | null | undefined;
let signingUp: Promise<Player | null> | null = null;

/** Point the client somewhere explicitly (tests, tools, a native shell). `api: null` forces offline. */
export function configure(opts: { api?: string | null; fetch?: typeof fetch; storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null }) {
  if ("api" in opts) apiBase = opts.api ? opts.api.replace(/\/+$/, "") : null;
  if (opts.fetch) fetchImpl = opts.fetch;
  if ("storage" in opts) { store = opts.storage; player = undefined; }
}

function base(): string | null {
  if (apiBase === undefined) {
    const env = (import.meta as any).env?.VITE_REMUSTER_API as string | undefined;
    apiBase = env ? env.replace(/\/+$/, "") : null;
  }
  return apiBase;
}
function storage() {
  if (store === undefined) { try { store = globalThis.localStorage ?? null; } catch { store = null; } }
  return store;
}
/** Whether a backend is configured at all. */
export const online = () => !!base();

export interface ApiResult<T> { ok: boolean; status: number; data: T | null; error?: string; }

/** One request. Never throws: `ok` false with status 0 means the network (or the backend) is unreachable. */
export async function call<T>(method: string, path: string, opts: { body?: unknown; raw?: BodyInit; auth?: boolean; token?: string } = {}): Promise<ApiResult<T>> {
  const b = base();
  if (!b) return { ok: false, status: 0, data: null, error: "offline" };
  const headers: Record<string, string> = {};
  let token = opts.token;
  if (!token && opts.auth !== false) token = (await ensurePlayer())?.token;
  if (opts.auth !== false && !token) return { ok: false, status: 0, data: null, error: "offline" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  try {
    const r = await (fetchImpl ?? fetch)(`${b}${path}`, { method, headers, body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)) });
    const data = r.status === 204 ? null : await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data: data as T | null, error: r.ok ? undefined : (data as any)?.error ?? `http_${r.status}` };
  } catch {
    return { ok: false, status: 0, data: null, error: "offline" };
  }
}

/** The signed-in player, signing up anonymously the first time (one account per install). Null when offline. */
export async function ensurePlayer(): Promise<Player | null> {
  if (!base()) return null;
  if (player === undefined) {
    try { const raw = storage()?.getItem(TOKEN_KEY); player = raw ? JSON.parse(raw) as Player : null; } catch { player = null; }
  }
  if (player) return player;
  signingUp ??= (async () => {
    const r = await call<Player>("POST", "/v1/players", { body: {}, auth: false });
    if (r.ok && r.data?.token) {
      player = r.data;
      try { storage()?.setItem(TOKEN_KEY, JSON.stringify(player)); } catch { /* private mode: the account lasts this session */ }
    }
    signingUp = null;
    return player ?? null;
  })();
  return signingUp;
}

export async function me() { return (await call<{ id: string; name: string; ladder: LadderRow }>("GET", "/v1/me")).data; }

export async function rename(name: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  const r = await call<{ name: string }>("PUT", "/v1/me", { body: { name } });
  if (r.ok && r.data && player) { player = { ...player, name: r.data.name }; try { storage()?.setItem(TOKEN_KEY, JSON.stringify(player)); } catch { /* fine */ } }
  return { ok: r.ok, name: r.data?.name, error: r.error };
}

// ---------------------------------------------------------------- cloud save
export interface CloudSave<S> { rev: number; updated: number; data: S | null; }
export async function pullSave<S>(): Promise<CloudSave<S> | null> { return (await call<CloudSave<S>>("GET", "/v1/save")).data; }
/** Push a save the caller based on revision `rev`. `conflict` carries the server's newer copy to merge and retry. */
export async function pushSave<S>(rev: number, data: S): Promise<{ ok: boolean; rev?: number; conflict?: CloudSave<S> }> {
  const r = await call<{ rev: number } & Partial<CloudSave<S>>>("PUT", "/v1/save", { body: { rev, data } });
  if (r.ok && r.data) return { ok: true, rev: r.data.rev };
  if (r.status === 409 && r.data) return { ok: false, conflict: { rev: r.data.rev ?? 0, updated: r.data.updated ?? 0, data: (r.data.data ?? null) as S | null } };
  return { ok: false };
}

// ---------------------------------------------------------------- the gallery
export async function listGames(sort: "top" | "new" = "top", limit = 30): Promise<GameListing[]> {
  return (await call<{ games: GameListing[] }>("GET", `/v1/games?sort=${sort}&limit=${limit}`, { auth: false })).data?.games ?? [];
}
export async function reportGame(id: string, reason: string) { return (await call("POST", `/v1/games/${id}/report`, { body: { reason }, auth: false })).ok; }

// ---------------------------------------------------------------- ladder
export async function leaderboard(limit = 50): Promise<LadderRow[]> {
  return (await call<{ top: LadderRow[] }>("GET", `/v1/arena/leaderboard?limit=${limit}`, { auth: false })).data?.top ?? [];
}

// ---------------------------------------------------------------- Arena matches (server-authoritative ladder)
/** What the player brings to a match (engine/progression/troops.ts arenaLoadout()). The server clamps it. */
export interface ArenaLoadout { levels?: Levels; roster?: UnitKind[]; hp?: number; }
/** A match the server issued: its id, its seed and arena, the player's ladder as the server holds it, and the
 * loadout as the server accepted it. */
export interface ArenaTicket { id: string; seed: number; arena: string; save: ArenaSave; levels?: Levels; roster?: UnitKind[]; hp: number; }
export interface ArenaSettled { result: ArenaResult; save: ArenaSave; }
/** How a result call went. `retry` is true when the server never judged it (unreachable, busy, 5xx): send it again later. */
export interface ArenaFinish { settled: ArenaSettled | null; retry: boolean; error?: string; }

/** The match the server will rebuild for this ticket. */
export const ticketMatch = (t: ArenaTicket): ArenaMatch => arenaConfig(t.save, { seed: t.seed, arena: t.arena, levels: t.levels, roster: t.roster, hp: t.hp });

/** Ask the server for the player's next Arena match (the open one again, if there is one). Null when offline. */
export async function arenaStart(loadout: ArenaLoadout = {}): Promise<ArenaTicket | null> {
  const r = await call<ArenaTicket>("POST", "/v1/arena/match", { body: loadout });
  return r.ok && r.data && typeof r.data.id === "string" && r.data.save ? r.data : null;
}
async function settle(body: unknown): Promise<ArenaFinish> {
  const r = await call<ArenaSettled>("POST", "/v1/arena/result", { body });
  if (r.ok && r.data?.result && r.data.save) return { settled: r.data, retry: false };
  return { settled: null, retry: r.status === 0 || r.status === 429 || r.status >= 500, error: r.error };
}
/** Send a finished match's record (encodeRecord(match)). The server replays it and answers with the result it found. */
export const arenaFinish = (id: string, record: MatchRecord) => settle({ id, record });
/** Give up an issued match: it counts as a loss. */
export const arenaForfeit = (id: string) => settle({ id, forfeit: true });

// ---------------------------------------------------------------- analytics
const queue: { name: string; props?: unknown; at: number }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let gameId = "base";
export function setGame(id: string) { gameId = id; }
/** Record a product event (batched; dropped silently when offline). */
export function track(name: string, props?: Record<string, unknown>) {
  if (!base()) return;
  queue.push({ name, props, at: Date.now() });
  if (queue.length > 200) queue.splice(0, queue.length - 200);
  flushTimer ??= setTimeout(() => { flushTimer = null; void flush(); }, 4000);
}
export async function flush() {
  if (!queue.length || !base()) return;
  const events = queue.splice(0, 50);
  const r = await call("POST", "/v1/events", { body: { game: gameId, player: player?.id, events }, auth: false });
  if (!r.ok && r.status === 0) queue.unshift(...events); // unreachable: keep them for the next try
}
