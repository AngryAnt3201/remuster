// Progress on this device.
import { blankArena, type ArenaSave } from "./core/arena";
import { blankDaily, type DailySave } from "./core/daily";
import type { StoreSave } from "./store/starter";
import type { WalletSave } from "./economy/wallet";
import type { RewardSave } from "./economy/gems";
import type { ProgressionSave } from "./progression/troops";
import type { CollectionSave } from "./progression/collection";
import type { ChestSave } from "./progression/chests";
import type { CosmeticsSave } from "./progression/cosmetics";

export interface Save {
  campaign: Record<number, number>; // level id -> best stars
  puzzles: Record<number, number>;
  gauntlet: { best: number; runs: number };
  daily: DailySave;
  settings: { sound: boolean; haptics: boolean; speed: number };
  seen: string[]; // unit kinds seen in a shop (NEW badge)
  lab?: unknown;
  /** Store purchases the game tracks: whether the one-time Starter Pack was bought (engine/store/starter.ts). */
  store?: StoreSave;
  /** Coins and gems (engine/economy/wallet.ts). Older saves have none; the wallet fills it in. */
  wallet?: WalletSave;
  /** Free gem rewards already paid (engine/economy/gems.ts). */
  rewards?: RewardSave;
  /** Troop levels bought with coins (engine/progression/troops.ts). Older saves have none: every unit is level 1. */
  progression?: ProgressionSave;
  /** Units found and spare cards held (engine/progression/collection.ts). */
  collection?: CollectionSave;
  /** Chest slots, timers, the cycle and the free and crown chests (engine/progression/chests.ts). */
  chests?: ChestSave;
  /** Keep skins owned and equipped (engine/progression/cosmetics.ts). */
  cosmetics?: CosmeticsSave;
  /** The Arena trophy ladder (engine/core/arena.ts). Older saves have none: they load with a blank ladder. */
  arena?: ArenaSave;
  /** Counts every write of this save, on any device (cloud sync, engine/net/sync.ts, takes the higher as the newer). */
  rev?: number;
}

const KEY = "muster.save.v1";
const blank = (): Save => ({ campaign: {}, puzzles: {}, gauntlet: { best: 0, runs: 0 }, daily: blankDaily(), settings: { sound: true, haptics: true, speed: 1 }, seen: [], arena: blankArena() });

let cache: Save | null = null;
export function load(): Save {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const b = blank(), got = JSON.parse(raw);
      cache = { ...b, ...got, daily: { ...b.daily, ...got?.daily } };
    } else cache = blank();
  } catch {
    cache = blank();
  }
  return cache!;
}
const listeners = new Set<(s: Save) => void>();
/** Calls `fn` after every write of the save (the cloud sync listens here). Returns the function that stops it. */
export function subscribe(fn: (s: Save) => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
function persist(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
export function save(mut?: (s: Save) => void) {
  const s = load();
  mut?.(s);
  s.rev = (s.rev ?? 0) + 1;
  persist(s);
  for (const fn of [...listeners]) { try { fn(s); } catch { /* a listener never breaks a save */ } }
}
/** Swaps the whole save for `next` (a cloud save merged in). Kept in place, so anything holding load()'s object sees
 * it. Listeners are not called: this is the sync writing, not the player. */
export function replaceSave(next: Save) {
  const s = load() as unknown as Record<string, unknown>;
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, blank(), next, { daily: { ...blankDaily(), ...next.daily } });
  persist(load());
}
export function resetSave() {
  cache = blank();
  save();
}
