// Bastion balance: scripted placements on every map, a few seeds each. `npx vite-node tools/td-balance.ts`
import { MAP_DEFS } from "../engine/core/td/maps";
import { playBot, type BotPlan } from "../engine/core/td/sim";

const PLANS: Record<string, BotPlan> = {
  // Never builds: the waves must beat this.
  idle: { order: ["ranger"], upgrade: false, early: false, maxPads: 0 },
  // Only a few cheap archers, no upgrades: should fall short.
  thin: { order: ["ranger"], upgrade: false, early: false, maxPads: 4 },
  // One unit type only, with rank-ups: blockers alone can't touch flyers; archers alone get overrun.
  rangers: { order: ["ranger"], upgrade: true, early: false },
  pikes: { order: ["pikeman"], upgrade: true, early: false },
  // A plain mixed line with rank-ups: the "simple scripted placement" that should win.
  mixed: { order: ["pikeman", "ranger", "grenadier", "ranger", "blades", "storm", "ballista", "medic"], upgrade: true, early: false },
  // Same, calling every wave early.
  rush: { order: ["pikeman", "ranger", "grenadier", "ranger", "blades", "storm", "ballista", "medic"], upgrade: true, early: true },
};
for (const m of MAP_DEFS) {
  for (const [name, plan] of Object.entries(PLANS)) {
    const rows = [1, 2, 3].map((seed) => playBot(m.id, plan, seed).snapshot());
    console.log(`${m.id.padEnd(7)} ${name.padEnd(6)} ` + rows.map((r) => `${r.phase} w${r.wave} hp${r.keepHp} *${r.stars} gold${r.gold} t${Math.round(r.time)}`).join(" | "));
  }
}
