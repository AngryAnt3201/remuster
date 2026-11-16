// Free gems, bound to the device save: call settleRewards() after anything that can earn (a result screen,
// the title screen). It pays whatever progress has earned and not been paid yet, once.
import { ACTS, LEVELS } from "../core/campaign";
import { load, save } from "../save";
import { claimIn, normalizeRewards, rewardsOwed, type EarnCtx, type Reward } from "./gems";
import { earn } from "./wallet";

const ctx = (): EarnCtx => ({ levels: LEVELS, acts: ACTS.length });

/** Pays every reward owed and returns them (empty when nothing new). */
export function settleRewards(): Reward[] {
  const s = load();
  const owed = rewardsOwed(s, normalizeRewards(s.rewards), ctx());
  if (!owed.length) return [];
  let total = 0;
  save((x) => { x.rewards = normalizeRewards(x.rewards); total = claimIn(x.rewards, owed); });
  if (total > 0) earn("gems", total, `rewards:${owed.map((r) => r.id).join(",")}`);
  return owed;
}
