// Cosmetics the player owns and wears: keep skins first. Shared contract for the skin art, the War Pass
// rewards and gem/offer purchases. Cosmetics never change the battle: the sim never reads this file.
import { load, save } from "../save";

export type CosmeticSlot = "keep";

/** Every keep skin, by id. "keep:meadow" is the default everyone owns. Art: base/public/keeps/skins/<name>/. */
export const KEEP_SKINS = ["keep:meadow", "keep:frost", "keep:ember", "keep:gilded", "keep:shadow", "keep:blossom"] as const;
export type KeepSkin = (typeof KEEP_SKINS)[number];
export const DEFAULT_KEEP: KeepSkin = "keep:meadow";
export const isKeepSkin = (id: string): id is KeepSkin => (KEEP_SKINS as readonly string[]).includes(id);

export interface CosmeticsSave {
  owned: string[];
  equipped: Partial<Record<CosmeticSlot, string>>;
}

export const blankCosmetics = (): CosmeticsSave => ({ owned: [DEFAULT_KEEP], equipped: { keep: DEFAULT_KEEP } });

export function normalizeCosmetics(c: Partial<CosmeticsSave> | undefined): CosmeticsSave {
  const owned: string[] = [...new Set<string>([DEFAULT_KEEP, ...(c?.owned ?? []).filter(isKeepSkin)])];
  const keep = c?.equipped?.keep;
  return { owned, equipped: { keep: keep && owned.includes(keep) ? keep : DEFAULT_KEEP } };
}

export function grantIn(c: CosmeticsSave, id: string): boolean {
  if (!isKeepSkin(id) || c.owned.includes(id)) return false;
  c.owned.push(id);
  return true;
}

export function equipIn(c: CosmeticsSave, slot: CosmeticSlot, id: string): boolean {
  if (!c.owned.includes(id)) return false;
  c.equipped[slot] = id;
  return true;
}

// ---- Device-save binding -------------------------------------------------------------

type Listener = (c: Readonly<CosmeticsSave>) => void;
const listeners = new Set<Listener>();
const current = (): CosmeticsSave => {
  const s = load();
  s.cosmetics = normalizeCosmetics(s.cosmetics);
  return s.cosmetics;
};
function commit(apply: (c: CosmeticsSave) => boolean): boolean {
  let ok = false;
  save((s) => { s.cosmetics = normalizeCosmetics(s.cosmetics); ok = apply(s.cosmetics); });
  if (ok) for (const fn of listeners) fn(current());
  return ok;
}

export const cosmetics = (): Readonly<CosmeticsSave> => current();
export const ownsCosmetic = (id: string) => current().owned.includes(id);
export const equipped = (slot: CosmeticSlot): string => current().equipped[slot] ?? DEFAULT_KEEP;
/** Returns false if already owned or unknown. `reason` is for the economy log only. */
export const grantCosmetic = (id: string, _reason: string) => commit((c) => grantIn(c, id));
export const equip = (slot: CosmeticSlot, id: string) => commit((c) => equipIn(c, slot, id));
export function onCosmeticsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
