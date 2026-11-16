// The 30-day gem model in outputs/economy/gems.md, run on the real earn rules (engine/economy/gems.ts).
// npx vite-node tools/gems-model.ts
import { ACTS, LEVELS } from "../engine/core/campaign";
import { claimIn, rewardsOwed, GEM_PACKS, type EarnSave } from "../engine/economy/gems";

const ctx = { levels: LEVELS, acts: ACTS.length };
type Plan = { name: string; fullArmy: boolean; buys: Record<number, number> };
const plans: Plan[] = [
  { name: "Free player", fullArmy: false, buys: {} },
  { name: "Full Army only (US$4.99 day 1)", fullArmy: true, buys: {} },
  { name: "Full Army + Sack day 1 + Coffer day 10 (US$19.97)", fullArmy: true, buys: { 1: 450, 10: 1000 } },
];

function simulate(p: Plan) {
  const s: EarnSave = { campaign: {}, puzzles: {}, gauntlet: { best: 0, runs: 0 }, daily: { streak: 0, bestStreak: 0, wins: 0 } };
  const r = { claimed: [] as string[] };
  // A level's first clear: two in three get two stars, the rest three; later days replay one level to three stars.
  const clearAct = (a: number) => LEVELS.filter((l) => l.act === a).forEach((l, i) => { s.campaign[l.id] = Math.max(s.campaign[l.id] ?? 0, i % 3 === 0 ? 3 : 2); });
  const polishOne = () => { const l = LEVELS.find((x) => (s.campaign[x.id] ?? 0) > 0 && s.campaign[x.id] < 3); if (l) s.campaign[l.id] = 3; };
  const rows: { day: number; free: number; bought: number; total: number }[] = [];
  let free = 0, bought = 0;
  for (let d = 1; d <= 30; d++) {
    if (d === 1) clearAct(1);
    if (d === 2) clearAct(2);
    if (d === 3) for (let k = 1; k <= 5; k++) s.puzzles[k] = k <= 3 ? 3 : 1;
    if (p.fullArmy && d >= 3 && d <= 13 && d % 2 === 1) clearAct((d - 1) / 2 + 2); // acts 3-8 on days 3,5,...,13
    if (p.fullArmy && d >= 4 && d <= 12) s.puzzles[d + 2] = d % 2 ? 3 : 2; // puzzles 6-14
    if (p.fullArmy && d >= 6) s.gauntlet.best = Math.min(6, Math.max(s.gauntlet.best, d - 5));
    if (d >= 4) polishOne();
    s.daily.streak = d; s.daily.bestStreak = d;
    const won = d % 4 !== 0;
    if (won) s.daily.wins++;
    s.daily.today = { key: `d${d}`, done: true, won };
    free += claimIn(r, rewardsOwed(s, r, ctx));
    bought += p.buys[d] ?? 0;
    rows.push({ day: d, free, bought, total: free + bought });
  }
  return rows;
}

const pick = [1, 2, 3, 7, 14, 21, 30];
const out = plans.map((p) => ({ p, rows: simulate(p) }));
console.log("| Day | " + out.map((o) => o.p.name).join(" | ") + " |");
console.log("| --- | " + out.map(() => "---").join(" | ") + " |");
for (const d of pick) console.log(`| ${d} | ` + out.map((o) => { const r = o.rows[d - 1]; return r.bought ? `${r.total} (${r.free} free)` : String(r.total); }).join(" | ") + " |");
console.log("");
const daily = out[0].rows.map((r, i) => r.free - (i ? out[0].rows[i - 1].free : 0));
console.log("Free player, gems earned per day:", daily.join(" "));
const daily2 = out[1].rows.map((r, i) => r.free - (i ? out[1].rows[i - 1].free : 0));
console.log("Full Army owner, gems earned per day:", daily2.join(" "));
console.log("Packs:", GEM_PACKS.map((g) => `${g.gems}@${g.usd}`).join(" "));
