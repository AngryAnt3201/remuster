// Cloud saves: keeps the device save (engine/save.ts) and the player's save on the backend the same, in the
// background. On start it pulls the cloud save and merges it with the device's; after that every local write is
// pushed, debounced. A failed call backs off and tries again later. Nothing here blocks or throws into the game, and
// with no backend configured startSync() does nothing.
//
// The merge rule (mergeSaves) never loses progress:
//   - The save with the higher `rev` (Save.rev counts every write, and a merge carries the higher count forward) is
//     the newer one, and is taken whole for everything that can go down as well as up or that belongs together: the
//     wallet with its purchase receipts and claimed rewards, chests, the Arena ladder, the deck, settings, today's
//     daily state. A tie goes to the device.
//   - Whatever only ever grows is then taken from both, the larger or the union: campaign and puzzle stars per level,
//     the Gauntlet best and runs, daily bests, troop levels, commander XP, units found, units seen, skins owned.
// So two devices played in turn lose nothing. Two devices played at the same time without syncing keep every star,
// level and unit from both, and the coins, gems and chests of whichever wrote more.
import type { UnitKind } from "../core/defs";
import { load, replaceSave, subscribe, type Save } from "../save";
import { online, pullSave, pushSave, type CloudSave } from "./client";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const maxOf = (a: unknown, b: unknown) => Math.max(typeof a === "number" && Number.isFinite(a) ? a : 0, typeof b === "number" && Number.isFinite(b) ? b : 0);
const union = <T>(a: readonly T[] | undefined, b: readonly T[] | undefined): T[] => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];
function maxEach<K extends string | number>(a: Partial<Record<K, number>> | undefined, b: Partial<Record<K, number>> | undefined): Record<K, number> {
  const out = { ...(a ?? {}) } as Record<string, number>;
  for (const [k, v] of Object.entries(b ?? {})) if (typeof v === "number" && v > (out[k] ?? -Infinity)) out[k] = v;
  return out as Record<K, number>;
}

/** The two saves as one (see the rule at the top of this file). Pure: neither input is changed. */
export function mergeSaves(device: Save, cloud: Save): Save {
  const newer = (cloud.rev ?? 0) > (device.rev ?? 0) ? cloud : device, older = newer === cloud ? device : cloud;
  const out = clone(newer);
  out.rev = maxOf(device.rev, cloud.rev);
  out.campaign = maxEach(newer.campaign, older.campaign);
  out.puzzles = maxEach(newer.puzzles, older.puzzles);
  out.gauntlet = { best: maxOf(newer.gauntlet?.best, older.gauntlet?.best), runs: maxOf(newer.gauntlet?.runs, older.gauntlet?.runs) };
  out.seen = union(newer.seen, older.seen);
  if (older.daily) {
    const n = (out.daily ??= clone(older.daily)), o = older.daily;
    if ((o.best ?? 0) > (n.best ?? 0)) { n.best = o.best; if (o.bestKey) n.bestKey = o.bestKey; else delete n.bestKey; }
    n.bestStreak = maxOf(n.bestStreak, o.bestStreak);
    n.played = maxOf(n.played, o.played);
    n.wins = maxOf(n.wins, o.wins);
  }
  if (newer.progression || older.progression) {
    const n = newer.progression, o = older.progression;
    const xp = maxOf(n?.xp, o?.xp), v = maxOf(n?.v, o?.v);
    out.progression = {
      ...clone(n ?? o!),
      levels: maxEach(n?.levels, o?.levels),
      ...(xp ? { xp } : {}), ...(v ? { v } : {}), ...(n?.legacyPaid || o?.legacyPaid ? { legacyPaid: true } : {}),
    };
  }
  if (newer.collection || older.collection) {
    const n = newer.collection, o = older.collection;
    const cards = { ...(n?.cards ?? {}) };
    // Spare cards are spent, so the newer count stands; a unit only the older save had found keeps the cards it had.
    for (const k of (o?.found ?? []) as UnitKind[]) if (!n?.found?.includes(k) && o?.cards?.[k]) cards[k] = Math.max(cards[k] ?? 0, o.cards[k]!);
    out.collection = { cards, found: union(n?.found, o?.found) };
  }
  if (newer.cosmetics || older.cosmetics) {
    const n = newer.cosmetics, o = older.cosmetics;
    out.cosmetics = { owned: union(n?.owned, o?.owned), equipped: { ...(n ?? o!).equipped } };
  }
  return out;
}

export interface SyncOptions {
  /** Quiet time after a local write before it is pushed. */
  debounceMs?: number;
  /** Least time between two pushes (the backend allows 120 an hour). */
  minGapMs?: number;
  /** First wait after a failed call; doubles each failure up to maxBackoffMs. */
  backoffMs?: number;
  maxBackoffMs?: number;
  /** Called after a cloud save changed the device save (re-draw what is on screen). */
  onMerged?: (s: Save) => void;
}

let o: Required<Omit<SyncOptions, "onMerged">> & Pick<SyncOptions, "onMerged"> = { debounceMs: 4000, minGapMs: 30000, backoffMs: 5000, maxBackoffMs: 300000 };
/** The cloud revision the device save is based on; null until the first pull has answered. */
let cloudRev: number | null = null;
let dirty = false, busy = false, running = false, fails = 0, notBefore = 0, session = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let idle: Promise<void> = Promise.resolve();

function schedule(ms: number) {
  if (!running) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; void syncNow(); }, Math.max(ms, notBefore - Date.now()));
}
function failed() {
  fails++;
  const wait = Math.min(o.maxBackoffMs, o.backoffMs * 2 ** (fails - 1));
  notBefore = Date.now() + wait;
  schedule(wait);
}
/** Takes in a copy of the cloud save: merges it into the device save and notes whether the cloud is now behind. */
function adopt(cloud: CloudSave<Save>) {
  cloudRev = cloud.rev;
  if (!cloud.data || typeof cloud.data !== "object") { dirty = true; return; }
  const mine = JSON.stringify(load());
  const merged = mergeSaves(load(), cloud.data);
  const text = JSON.stringify(merged);
  if (text !== mine) { replaceSave(merged); try { o.onMerged?.(load()); } catch { /* the game's redraw is its own business */ } }
  if (text !== JSON.stringify(cloud.data)) dirty = true;
}
async function pass() {
  const mine = session; // a pass that outlives stopSync() must not touch the next session's state
  if (cloudRev === null) {
    const got = await pullSave<Save>();
    if (mine !== session) return;
    if (!got) return failed();
    adopt(got);
  }
  for (let tries = 0; dirty && tries < 3; tries++) {
    dirty = false;
    const r = await pushSave<Save>(cloudRev!, clone(load()));
    if (mine !== session) return;
    if (r.ok) { cloudRev = r.rev ?? cloudRev! + 1; notBefore = Date.now() + o.minGapMs; break; }
    dirty = true;
    if (!r.conflict) return failed();
    adopt(r.conflict); // another device wrote first: merge its copy and push the result
  }
  fails = 0;
  if (dirty) schedule(o.debounceMs);
}
/** Sync now instead of waiting for the timer (also what the timer calls). Resolves when the pass is over; never rejects. */
export function syncNow(): Promise<void> {
  if (!running || !online()) return Promise.resolve();
  if (busy) return idle;
  busy = true;
  idle = pass().catch(() => failed()).finally(() => { busy = false; });
  return idle;
}

/** Start syncing (once; call at boot). Returns the function that stops it. Does nothing when no backend is configured. */
export function startSync(opts: SyncOptions = {}): () => void {
  stopSync();
  if (!online()) return stopSync;
  o = { ...o, ...opts };
  running = true;
  unsubscribe = subscribe(() => { dirty = true; schedule(o.debounceMs); });
  void syncNow();
  return stopSync;
}
export function stopSync() {
  running = false;
  session++;
  if (timer) clearTimeout(timer);
  timer = null;
  unsubscribe?.();
  unsubscribe = null;
  cloudRev = null; dirty = false; fails = 0; notBefore = 0;
}
/** For a status line or a test: is there a local change the cloud has not got yet, and how many calls have failed in a row. */
export const syncState = () => ({ running, pulled: cloudRev !== null, rev: cloudRev, dirty, fails });
