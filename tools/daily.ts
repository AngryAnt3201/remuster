// Daily Challenge check: an AI plays the player side through a run of days and we see how often it wins.
//   npx vite-node tools/daily.ts            DAYS=40 from today
import { DEFAULT_AI, applyPlan, planTurn, type AIProfile } from "../engine/core/ai";
import { dailyBoard, dailyConfig, dailyResult, dateKey, dayNumber, keyFromDay } from "../engine/core/daily";
import { Match } from "../engine/core/match";

const PLAYERS: Record<string, AIProfile> = { strong: { ...DEFAULT_AI, difficulty: 0.9 }, mid: { ...DEFAULT_AI, difficulty: 0.5 } };
const days = Number(process.env.DAYS ?? 40);
const start = dayNumber(dateKey(new Date()));
const rules: Record<string, number[]> = {};
for (const [who, player] of Object.entries(PLAYERS)) {
  let wins = 0, total = 0;
  for (let i = 0; i < days; i++) {
    const b = dailyBoard(keyFromDay(start + i));
    const m = new Match(dailyConfig(b));
    while (m.phase !== "over" && m.played < 40) {
      const f = planTurn(m, 1, b.foe.ai);
      const y = planTurn(m, 0, player);
      applyPlan(m, 1, f); applyPlan(m, 0, y);
      m.fight(); m.next();
    }
    const r = dailyResult(m);
    wins += r.won ? 1 : 0; total += r.score;
    (rules[`${who}:${b.rule.id}`] ??= []).push(r.won ? 1 : 0);
  }
  console.log(`${who}: won ${wins}/${days}, mean score ${Math.round(total / days)}`);
}
for (const [k, v] of Object.entries(rules).sort()) console.log(k.padEnd(20), `${v.reduce((a, b) => a + b, 0)}/${v.length}`);
