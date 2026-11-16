// [pass] The tiny event bus the War Pass and daily quests listen on. It imports nothing, so the marked hooks in
// chests.ts, troops.ts, main.ts and td.ts can call it without import cycles. engine/progression/pass.ts subscribes.

export type PassEvent =
  /** A won battle. `stars` is the stars or crowns it earned (campaign stars, two crowns a rival or skirmish). */
  | { kind: "win"; stars: number }
  | { kind: "upgrade" }
  | { kind: "chest" }
  /** A mode was played to its end (won or lost). */
  | { kind: "play"; mode: "bastion" | "daily" };

type Fn = (e: PassEvent) => void;
const subs = new Set<Fn>();

export function passEvent(e: PassEvent) {
  for (const f of subs) {
    try { f(e); } catch { /* a quest or pass bug must never break a result screen */ }
  }
}
export function onPassEvent(f: Fn): () => void {
  subs.add(f);
  return () => void subs.delete(f);
}

/** Chest unlock time multiplier (War Pass Premium: 0.8). chests.ts reads it when a timer starts. */
let factor: () => number = () => 1;
export const chestUnlockFactor = () => {
  const f = factor();
  return Number.isFinite(f) && f > 0 && f <= 1 ? f : 1;
};
export const setChestUnlockFactor = (f: () => number) => { factor = f; };
