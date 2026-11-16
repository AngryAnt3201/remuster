// Campaign balance: plays every level against its foe with a strong (0.9) and a mid (0.5) player AI and prints win rates.
//   npx vite-node tools/balance.ts                    all levels, N=8 seeds per player, parallel
//   LEVELS=1,6,12 N=16 PROCS=6 npx vite-node tools/balance.ts
// Troop levels (default: everyone level 1, the game as tuned):
//   FOE_LEVEL=act        foes at the campaign's level curve (engine/progression/economy.ts EXPECTED_LEVEL_BY_ACT); or a number
//   PLAYER_LEVEL=expected|cap|behind|<n>   the player's whole army at the expected curve, one above it, one below it, or n
// Targets: strong wins every level at least sometimes (>= 40% on bosses, more elsewhere); mid falls off act by act.
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_AI, applyPlan, planTurn, type AIProfile } from "../engine/core/ai";
import { ACTS, LEVELS, buildLevel } from "../engine/core/campaign";
import { levelConfig, starsFor, type LevelDef } from "../engine/core/content";
import { uniformLevels, type Levels } from "../engine/core/levels";
import { Match } from "../engine/core/match";
import { foeLevelForAct } from "../engine/progression/economy";

export const PLAYERS: Record<string, AIProfile> = {
  strong: { ...DEFAULT_AI, difficulty: 0.9 },
  mid: { ...DEFAULT_AI, difficulty: 0.5 },
};

/** Plays a whole level headless: both sides plan on the board as it stood at the start of the round, then fight. */
export function playLevel(level: LevelDef, player: AIProfile, attempt: number, levels?: [Levels | undefined, Levels | undefined]): Match {
  const m = new Match({ ...levelConfig(level, attempt), ...(levels ? { levels } : {}) });
  while (m.phase !== "over" && m.played < 40) {
    const foe = planTurn(m, 1, level.ai);
    const you = planTurn(m, 0, player);
    applyPlan(m, 1, foe);
    applyPlan(m, 0, you);
    m.fight();
    m.next();
  }
  return m;
}

interface Task { id: number; who: string; attempt: number; }
interface Result extends Task { won: boolean; stars: number; rounds: number; hp: number; losses: number; }

/** POWER=x overrides every level's tuned foe strength (for sweeps). */
const levelFor = (id: number) => (process.env.POWER ? buildLevel(id - 1, Number(process.env.POWER)) : LEVELS[id - 1]);

/** The uniform troop level each side fields on a level, from PLAYER_LEVEL and FOE_LEVEL. */
export function sideLevels(l: LevelDef): [number, number] {
  const pick = (v: string | undefined, act: number) =>
    !v ? 1 : v === "act" || v === "expected" ? foeLevelForAct(act) : v === "cap" ? foeLevelForAct(act) + 1 : v === "behind" ? Math.max(1, foeLevelForAct(act) - 1) : Number(v) || 1;
  return [pick(process.env.PLAYER_LEVEL, l.act), pick(process.env.FOE_LEVEL, l.act)];
}

function runTask(t: Task): Result {
  const level = levelFor(t.id);
  const [pl, fl] = sideLevels(level);
  const m = playLevel(level, PLAYERS[t.who], t.attempt, pl > 1 || fl > 1 ? [uniformLevels(pl), uniformLevels(fl)] : undefined);
  return { ...t, won: m.winner === 0, stars: starsFor(level, m), rounds: m.played, hp: m.sides[0].hp, losses: m.history.filter((r) => r.winner === 1).length };
}

export function twistOf(l: LevelDef): string {
  const t: string[] = [];
  if (l.start?.[1]?.length) t.push(`start ${l.start[1].length}`);
  if (l.obstacles?.length) t.push(`${l.obstacles.length} rocks`);
  if (l.noReroll) t.push("no reroll");
  if (l.maxRounds) t.push(`${l.maxRounds} rounds`);
  const fm = l.mods?.[1];
  if (fm?.hpMul) t.push(`foe hp x${fm.hpMul}`);
  if (fm?.dmgMul) t.push(`foe dmg x${fm.dmgMul}`);
  if (fm?.broodStart) t.push("brood");
  if (l.income?.[1]) t.push(`foe +${l.income[1]} gold`);
  if (l.supply?.[1]) t.push(`foe +${l.supply[1]} supply`);
  if (l.startGold?.[1]) t.push(`foe +${l.startGold[1]} start gold`);
  if (l.income?.[0]) t.push(`you +${l.income[0]} gold`);
  if (l.supply?.[0]) t.push(`you +${l.supply[0]} supply`);
  if (l.startGold?.[0]) t.push(`you +${l.startGold[0]} start gold`);
  if (l.hp[0] !== 400) t.push(`you ${l.hp[0]} hp`);
  return t.join(", ");
}

async function main() {
  const ids = (process.env.LEVELS ?? "").split(",").filter(Boolean).map(Number);
  const levels = LEVELS.filter((l) => !ids.length || ids.includes(l.id));
  const n = Number(process.env.N ?? 8);
  const who = (process.env.WHO ?? "strong,mid").split(",");
  const tasks: Task[] = [];
  for (let a = 0; a < n; a++) for (const l of levels) for (const w of who) tasks.push({ id: l.id, who: w, attempt: a });
  const procs = Math.max(1, Math.min(Number(process.env.PROCS ?? Math.max(1, cpus().length - 3)), tasks.length));
  const results: Result[] = [];
  const t0 = performance.now();
  if (procs === 1) {
    for (const t of tasks) results.push(runTask(t));
  } else {
    const bin = resolve(dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/vite-node");
    const self = fileURLToPath(import.meta.url);
    await Promise.all(Array.from({ length: procs }, (_, k) => new Promise<void>((done, fail) => {
      const mine = tasks.filter((_, i) => i % procs === k);
      const child = spawn(bin, [self], { env: { ...process.env, BALANCE_WORKER: JSON.stringify(mine) }, stdio: ["ignore", "pipe", "inherit"] });
      let buf = "";
      child.stdout.on("data", (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (line.startsWith("{")) results.push(JSON.parse(line));
        }
      });
      child.on("exit", (code) => (code === 0 ? done() : fail(Error(`worker ${k} exited ${code}`))));
    })));
  }
  const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
  const rows: string[] = [];
  const byAct = new Map<number, { s: number[]; m: number[] }>();
  const problems: string[] = [];
  if (process.env.PLAYER_LEVEL || process.env.FOE_LEVEL) rows.push(`Troop levels: player ${process.env.PLAYER_LEVEL ?? 1}, foe ${process.env.FOE_LEVEL ?? 1}\n`);
  rows.push(" id act name                 foe              tactic     diff  foeHp | strong win stars rnds | mid win | twist");
  for (const l of levels) {
    const rs = results.filter((r) => r.id === l.id && r.who === "strong");
    const rm = results.filter((r) => r.id === l.id && r.who === "mid");
    const win = (list: Result[]) => (list.length ? list.filter((r) => r.won).length / list.length : NaN);
    const sw = win(rs), mw = win(rm);
    const stars = rs.length ? rs.reduce((s, r) => s + r.stars, 0) / rs.length : NaN;
    const rnds = rs.length ? rs.reduce((s, r) => s + r.rounds, 0) / rs.length : NaN;
    const a = byAct.get(l.act) ?? { s: [], m: [] };
    if (!isNaN(sw)) a.s.push(sw);
    if (!isNaN(mw)) a.m.push(mw);
    byAct.set(l.act, a);
    const [pl, fl] = sideLevels(l);
    rows.push(`${String(l.id).padStart(3)} ${String(l.act).padStart(3)} ${(l.name + (l.boss ? " *" : "")).padEnd(20)} ${l.foe.padEnd(16)} ${l.ai.tactic.padEnd(10)} ${l.ai.difficulty.toFixed(2)} ${String(l.hp[1]).padStart(6)} | ${pct(sw)}       ${stars.toFixed(1)} ${rnds.toFixed(1).padStart(4)} | ${pct(mw)}    | ${twistOf(levelFor(l.id))}${pl > 1 || fl > 1 ? ` | L${pl} v L${fl}` : ""}`);
    if (!isNaN(sw) && sw < (l.boss ? 0.4 : 0.5)) problems.push(`level ${l.id}: strong wins only ${pct(sw)}`);
  }
  console.log(rows.join("\n"));
  console.log("\n act                 strong   mid");
  const actMid: number[] = [], actIds: number[] = [];
  for (const [act, a] of [...byAct.entries()].sort((x, y) => x[0] - y[0])) {
    const avg = (v: number[]) => v.reduce((s, x) => s + x, 0) / Math.max(1, v.length);
    actMid.push(avg(a.m)); actIds.push(act);
    console.log(` ${act} ${ACTS[act - 1].padEnd(18)} ${pct(avg(a.s))}   ${pct(avg(a.m))}`);
  }
  for (let i = 1; i < actMid.length; i++) if (actMid[i] > actMid[i - 1] + 0.05) problems.push(`mid win rate rises from act ${actIds[i - 1]} to act ${actIds[i]}`);
  if (process.env.JSON_OUT) (await import("node:fs")).writeFileSync(process.env.JSON_OUT, JSON.stringify(results));
  console.log(`\n${results.length} matches in ${((performance.now() - t0) / 1000).toFixed(0)}s on ${procs} processes. ${problems.length ? "CHECK:\n  " + problems.join("\n  ") : "All targets met."}`);
}

if (process.env.BALANCE_WORKER) {
  for (const t of JSON.parse(process.env.BALANCE_WORKER) as Task[]) console.log(JSON.stringify(runTask(t)));
} else if (!process.env.VITEST) {
  main();
}
