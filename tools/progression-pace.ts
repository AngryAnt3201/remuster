// Free-play pace: what a player who never pays reaches by the end of each act, from campaign cards and coins alone
// (no chests, no shop), upgrading greedily with what they hold. Compare with the foe curve (EXPECTED_LEVEL_BY_ACT).
//   npx vite-node tools/progression-pace.ts           REPLAYS=2 (replay wins per level, e.g. losses retried and stars chased)
import { LEVELS } from "../engine/core/campaign";
import type { UnitKind } from "../engine/core/defs";
import { MAX_LEVEL } from "../engine/core/levels";
import { RARITY } from "../engine/progression/collection";
import {
  CAMPAIGN_WIN, DECK_SIZE, EXPECTED_LEVEL_BY_ACT, FIRST_CLEAR, STAR_COINS, STARTER_KINDS, WIN_XP, campaignCards, commanderLevel, levelCap,
  upgradeCards, upgradeCoins, upgradeXp,
} from "../engine/progression/economy";

const replays = Number(process.env.REPLAYS ?? 2);
/** Coins from other modes (a scored Daily ~230, Skirmish up to 300, Gauntlet rivals) over a day of ~6 campaign levels. */
const SIDE_COINS_PER_LEVEL = Number(process.env.SIDE ?? 120);
const cards = new Map<UnitKind, number>(), levels = new Map<UnitKind, number>(), found = new Set<UnitKind>(STARTER_KINDS);
let coins = 0, xp = 0;
const rows: string[] = ["act | cmdr cap | foe | best-8 avg  min  max | found | coins left"];
for (const l of LEVELS) {
  const grant = (list: [UnitKind, number][]) => { for (const [k, n] of list) { const isNew = !found.has(k); found.add(k); cards.set(k, (cards.get(k) ?? 0) + n - (isNew ? 1 : 0)); } };
  grant(campaignCards({ act: l.act, roster: l.roster, unlocks: l.unlocks ?? (l.unlock ? [l.unlock] : []), first: true, won: true, salt: l.id }));
  coins += CAMPAIGN_WIN(l.act) + 2 * STAR_COINS + FIRST_CLEAR(l.act) + SIDE_COINS_PER_LEVEL;
  xp += l.boss ? WIN_XP.boss : WIN_XP.firstClear;
  for (let r = 0; r < replays; r++) {
    grant(campaignCards({ act: l.act, roster: l.roster, unlocks: [], first: false, won: true, salt: l.id * 31 + r }));
    coins += Math.round(CAMPAIGN_WIN(l.act) * 0.6); // the daily replay cap trims some
    xp += WIN_XP.replay;
  }
  // Upgrade greedily, lowest level first, within the cap.
  for (let again = true; again;) {
    again = false;
    const cap = levelCap(commanderLevel(xp));
    const order = [...found].sort((a, b) => (levels.get(a) ?? 1) - (levels.get(b) ?? 1));
    for (const k of order) {
      const lv = levels.get(k) ?? 1, r = RARITY[k];
      if (lv >= Math.min(cap, MAX_LEVEL)) continue;
      const need = upgradeCards(lv, r), cost = upgradeCoins(lv, r);
      if ((cards.get(k) ?? 0) >= need && coins >= cost) {
        cards.set(k, (cards.get(k) ?? 0) - need); coins -= cost; levels.set(k, lv + 1); xp += upgradeXp(lv + 1); again = true;
      }
    }
  }
  if (l.boss) {
    const lv = l.roster.filter((k) => found.has(k)).map((k) => levels.get(k) ?? 1).sort((a, b) => b - a).slice(0, DECK_SIZE);
    const avg = lv.reduce((s, x) => s + x, 0) / lv.length;
    const c = commanderLevel(xp);
    rows.push(`${l.act}   | ${String(c).padStart(4)} ${String(levelCap(c)).padStart(3)} | ${String(EXPECTED_LEVEL_BY_ACT[l.act - 1]).padStart(3)} | ${avg.toFixed(1).padStart(10)} ${String(Math.min(...lv)).padStart(4)} ${String(Math.max(...lv)).padStart(4)} | ${String(found.size).padStart(5)} | ${coins}`);
  }
}
console.log(`Free-play pace, campaign only (${replays} replay wins per level, +${SIDE_COINS_PER_LEVEL} side coins per level, no chests):`);
console.log(rows.join("\n"));
