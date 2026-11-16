// The base game's link to the Remuster backend (infra/): account, cloud saves, the server-run Arena ladder and
// analytics. Everything here is optional: with no backend configured (VITE_REMUSTER_API unset) startOnline() does
// nothing, the Arena calls resolve to null and the game plays from the device save exactly as it always has. Nothing
// here throws, and nothing waits on the network for longer than a few seconds.
//
// How main.ts uses it:
//
//   boot():        startOnline(() => here?.());                 // re-draw when a cloud save lands
//   playArena():   const srv = await onlineArenaMatch();        // null: offline or unreachable
//                  const next = srv ?? nextArenaMatch(o);       // srv is an ArenaMatch too (plus the server's id)
//   onEnd(m):      const result = srv ? await onlineArenaFinish(srv, m) : null;
//                  const end = result ? settleArena(next, result) : awardArena(next, m.winner === 0);
//
// Trophies are counted once because exactly one of the two last calls runs. With a server result, the server has
// already moved the trophies and onlineArenaFinish() has written its ladder into the save, so settleArena() only pays
// the coins, XP and chest for that result. Without one (offline, or the server could not be reached when the match
// ended), awardArena() moves the trophies on the device as before; if the match was a server match, its record is
// kept and sent the next time a match is asked for, and the server's ladder then replaces the device's.
import { type ArenaMatch, type ArenaResult } from "@engine/core/arena";
import { encodeRecord, type MatchRecord } from "@engine/core/ghost";
import type { Match } from "@engine/core/match";
import { arenaFinish, arenaForfeit, arenaStart, configure, ensurePlayer, flush, online, setGame, ticketMatch, track, type ArenaFinish } from "@engine/net/client";
import { startSync, syncNow } from "@engine/net/sync";
import { arenaLoadout, setArenaLadder } from "@engine/progression/troops";

/** An Arena match the server issued: an ArenaMatch (cfg, arena, league, foe) plus the id the result is filed under. */
export type OnlineArenaMatch = ArenaMatch & { id: string };

const PENDING_KEY = "remuster.arena.pending.v1";
const START_WAIT = 6000, FINISH_WAIT = 8000;
/** `p`, or null if it has not answered within `ms` (a slow backend is treated as no backend). */
const within = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);

/** A finished server match whose record has not reached the server yet. */
interface Pending { id: string; record: MatchRecord }
function pending(): Pending | null {
  try { const raw = localStorage.getItem(PENDING_KEY); return raw ? JSON.parse(raw) as Pending : null; } catch { return null; }
}
function setPending(p: Pending | null) {
  try { if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p)); else localStorage.removeItem(PENDING_KEY); } catch { /* private mode */ }
}
/** Sends a kept record. True when nothing is left waiting (sent, or the server refused it for good). */
async function sendPending(): Promise<boolean> {
  const p = pending();
  if (!p) return true;
  const r: ArenaFinish = (await within(arenaFinish(p.id, p.record), FINISH_WAIT)) ?? { settled: null, retry: true };
  if (r.retry) return false;
  setPending(null);
  if (r.settled) setArenaLadder(r.settled.save);
  return true;
}

let started = false;
/**
 * Call once at boot. Points the client at the backend this build was made for, signs the install in (an anonymous
 * account the first time), starts the cloud-save sync, and records the boot. `onSave` is called when a cloud save has
 * changed the device save, so the screen can be drawn again. Returns at once; all of it happens in the background.
 */
export function startOnline(onSave?: () => void) {
  const api = import.meta.env.VITE_REMUSTER_API as string | undefined;
  if (api) configure({ api });
  if (!online() || started) return;
  started = true;
  setGame(__GAME__);
  void ensurePlayer().then(() => sendPending());
  startSync({ onMerged: onSave });
  track("boot");
  // Leaving the page: send what is waiting while there is still time.
  globalThis.addEventListener?.("pagehide", () => { void flush(); void syncNow(); });
}

/**
 * The player's next Arena match from the server, or null when there is no backend or it can't be reached in time
 * (fall back to nextArenaMatch()). Also writes the server's ladder into the save, so the ladder screen shows the
 * trophies the server holds. Asking again before a result is recorded returns the same match.
 */
export async function onlineArenaMatch(): Promise<OnlineArenaMatch | null> {
  if (!online()) return null;
  // A result still waiting to be sent would be issued again as the same match: play offline until it has gone.
  if (!(await sendPending())) return null;
  const t = await within(arenaStart(arenaLoadout()), START_WAIT);
  if (!t) return null;
  try {
    const m = ticketMatch(t);
    setArenaLadder(t.save);
    return { ...m, id: t.id };
  } catch {
    return null;
  }
}

/**
 * Reports a finished server match (`match` is the Match that was played, at its end). The server replays it and
 * answers with the result; its ladder is written into the save and the result is returned for settleArena(). Null
 * when the server did not give one: the caller then uses awardArena() as it does offline. If the server could not be
 * reached, the record is kept and sent later.
 */
export async function onlineArenaFinish(serverMatch: OnlineArenaMatch, match: Match): Promise<ArenaResult | null> {
  if (!online()) return null;
  const record = encodeRecord(match);
  const r: ArenaFinish = (await within(arenaFinish(serverMatch.id, record), FINISH_WAIT)) ?? { settled: null, retry: true };
  if (r.settled) {
    setArenaLadder(r.settled.save);
    return r.settled.result;
  }
  if (r.retry) setPending({ id: serverMatch.id, record });
  else track("arena_rejected", { error: r.error ?? "" });
  return null;
}

/**
 * Gives up a server match (the player quit it): the server counts a loss and the next match is a new one. Optional:
 * without it, quitting costs nothing and the same match is offered again, as it is offline. Returns the result, or
 * null if the server was not reached (the match then simply stays open).
 */
export async function onlineArenaForfeit(serverMatch: OnlineArenaMatch): Promise<ArenaResult | null> {
  if (!online()) return null;
  const r = await within(arenaForfeit(serverMatch.id), FINISH_WAIT);
  if (!r?.settled) return null;
  setArenaLadder(r.settled.save);
  return r.settled.result;
}

/** Analytics: a screen was opened. */
export function trackScreen(name: string) { track("screen", { id: name }); }
/** Analytics: a match ended (`mode` as GameScreen knows it: campaign, arena, skirmish, ...). */
export function trackMatchEnd(mode: string, won: boolean, rounds: number) { track("match_end", { mode, won, rounds }); }
