// The player's two currencies, shared by troop upgrades (coins) and the premium store (gems).
// Pure rules over a save-shaped object, plus a thin binding to the device save, so tests need no storage.
import { load, save } from "../save";

export type Currency = "coins" | "gems";

export interface WalletSave {
  coins: number;
  gems: number;
  /** Lifetime totals, for the economy model and support questions ("where did my gems go?"). */
  earned: Record<Currency, number>;
  spent: Record<Currency, number>;
  /** App Store transaction ids already credited, so a replayed transaction never pays twice. */
  txIds: string[];
}

export const blankWallet = (): WalletSave => ({ coins: 0, gems: 0, earned: { coins: 0, gems: 0 }, spent: { coins: 0, gems: 0 }, txIds: [] });

/** Fill in fields an older save is missing. */
export function normalizeWallet(w: Partial<WalletSave> | undefined): WalletSave {
  const b = blankWallet();
  return {
    coins: whole(w?.coins), gems: whole(w?.gems),
    earned: { ...b.earned, ...w?.earned }, spent: { ...b.spent, ...w?.spent },
    txIds: Array.isArray(w?.txIds) ? w!.txIds.slice(-200) : [],
  };
}

const whole = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
const amountOk = (n: number) => Number.isInteger(n) && n > 0;

export function earnIn(w: WalletSave, c: Currency, amount: number): boolean {
  if (!amountOk(amount)) return false;
  w[c] += amount;
  w.earned[c] += amount;
  return true;
}

export function spendIn(w: WalletSave, c: Currency, amount: number): boolean {
  if (!amountOk(amount) || w[c] < amount) return false;
  w[c] -= amount;
  w.spent[c] += amount;
  return true;
}

/** Credit a purchased gem pack once per App Store transaction id. */
export function creditPurchaseIn(w: WalletSave, txId: string, gems: number): boolean {
  if (!txId || w.txIds.includes(txId) || !amountOk(gems)) return false;
  w.txIds = [...w.txIds, txId].slice(-200);
  return earnIn(w, "gems", gems);
}

// ---- Device-save binding -------------------------------------------------------------

type Listener = (w: Readonly<WalletSave>) => void;
const listeners = new Set<Listener>();
const current = (): WalletSave => {
  const s = load();
  s.wallet = normalizeWallet(s.wallet);
  return s.wallet;
};
function commit(apply: (w: WalletSave) => boolean): boolean {
  let ok = false;
  save((s) => { s.wallet = normalizeWallet(s.wallet); ok = apply(s.wallet); });
  if (ok) for (const fn of listeners) fn(current());
  return ok;
}

export const wallet = (): Readonly<WalletSave> => current();
export const canAfford = (c: Currency, amount: number) => current()[c] >= amount;
/** `reason` is for debugging and the economy log; it never changes the result. */
export const earn = (c: Currency, amount: number, _reason: string) => commit((w) => earnIn(w, c, amount));
export const spend = (c: Currency, amount: number, _reason: string) => commit((w) => spendIn(w, c, amount));
export const creditPurchase = (txId: string, gems: number) => commit((w) => creditPurchaseIn(w, txId, gems));
/** Subscribe to balance changes (HUD counters). Returns an unsubscribe function. */
export function onWalletChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
