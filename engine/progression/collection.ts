// The card collection: which units the player has found, and how many spare cards of each they hold.
// Shared contract for troop upgrades (cards + coins), chests and shop offers. Pure rules over a save-shaped
// object, plus a thin binding to the device save, so tests need no storage.
import type { UnitKind } from "../core/defs";
import { UNIT_KINDS } from "../core/defs";
import { load, save } from "../save";

export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

/** Rarity by unit: cheap all-rounders are common, the strongest specialists legendary. */
export const RARITY: Record<UnitKind, Rarity> = {
  mine: "common", blades: "common", ranger: "common", medic: "common", pikeman: "common",
  duelist: "common", keg: "common", banner: "common", tinker: "common", lamp: "common",
  bulwark: "rare", grenadier: "rare", ballista: "rare", lancer: "rare", rime: "rare",
  harrier: "rare", hook: "rare", outrider: "rare",
  shade: "epic", sapper: "epic", hive: "epic", grave: "epic", bombard: "epic",
  trickster: "epic", thorn: "epic", ravager: "epic",
  storm: "legendary", golem: "legendary", griffin: "legendary", tide: "legendary", lion: "legendary",
};
export const rarityOf = (k: UnitKind): Rarity => RARITY[k];
export const kindsOfRarity = (r: Rarity): UnitKind[] => UNIT_KINDS.filter((k) => RARITY[k] === r);

export interface CollectionSave {
  /** Spare cards held per unit (spent on upgrades). */
  cards: Partial<Record<UnitKind, number>>;
  /** Units found, in the order they were found. */
  found: UnitKind[];
}

export const blankCollection = (): CollectionSave => ({ cards: {}, found: [] });

export function normalizeCollection(c: Partial<CollectionSave> | undefined): CollectionSave {
  const cards: CollectionSave["cards"] = {};
  for (const [k, v] of Object.entries(c?.cards ?? {})) {
    if (k in RARITY && typeof v === "number" && Number.isFinite(v) && v > 0) cards[k as UnitKind] = Math.floor(v);
  }
  const found = [...new Set((c?.found ?? []).filter((k) => k in RARITY))] as UnitKind[];
  return { cards, found };
}

/** Finding a unit for the first time uses up one card (it becomes the unit itself); the rest are spare. */
export function grantIn(c: CollectionSave, k: UnitKind, n: number): { isNew: boolean } {
  if (!(k in RARITY) || !Number.isInteger(n) || n <= 0) return { isNew: false };
  const isNew = !c.found.includes(k);
  if (isNew) c.found.push(k);
  const spare = isNew ? n - 1 : n;
  if (spare > 0) c.cards[k] = (c.cards[k] ?? 0) + spare;
  return { isNew };
}

export function spendIn(c: CollectionSave, k: UnitKind, n: number): boolean {
  if (!Number.isInteger(n) || n <= 0 || (c.cards[k] ?? 0) < n) return false;
  c.cards[k] = (c.cards[k] ?? 0) - n;
  return true;
}

// ---- Device-save binding -------------------------------------------------------------

type Listener = (c: Readonly<CollectionSave>) => void;
const listeners = new Set<Listener>();
const current = (): CollectionSave => {
  const s = load();
  s.collection = normalizeCollection(s.collection);
  return s.collection;
};
function commit<T>(apply: (c: CollectionSave) => T): T {
  let out!: T;
  save((s) => { s.collection = normalizeCollection(s.collection); out = apply(s.collection); });
  for (const fn of listeners) fn(current());
  return out;
}

export const collection = (): Readonly<CollectionSave> => current();
export const cardsOf = (k: UnitKind) => current().cards[k] ?? 0;
export const isFound = (k: UnitKind) => current().found.includes(k);
export const foundKinds = (): UnitKind[] => [...current().found];
/** `reason` is for debugging and the economy log; it never changes the result. */
export const grantCards = (k: UnitKind, n: number, _reason: string) => commit((c) => grantIn(c, k, n));
export const spendCards = (k: UnitKind, n: number) => commit((c) => spendIn(c, k, n));
/** Subscribe to collection changes (Army screen badges). Returns an unsubscribe function. */
export function onCollectionChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
