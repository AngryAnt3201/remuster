// Gauntlet check: an AI plays the player side through whole runs (duel after duel, picking boons) and we see how far
// it gets. A good player should reach stage ~8-12.
//   npx vite-node tools/gauntlet.ts            RUNS=8 per player, parallel
//   RUNS=4 WHO=strong npx vite-node tools/gauntlet.ts
// Troop levels: GAUNTLET_LEVELS=1 gives rivals the game's level rule (engine/progression/economy.ts gauntletFoeLevel,
// capped at CAP, default 10); PLAYER_LEVEL=n puts the player's whole army at level n. Default: everyone level 1.
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { DEFAULT_AI, applyPlan, planTurn, type AIProfile } from "../engine/core/ai";
import type { Boon } from "../engine/core/content";
import { boardValue, boonChoices, duelConfig, endDuel, gauntletFoe, newRun, takeBoon, type GauntletRun } from "../engine/core/gauntlet";
import { uniformLevels } from "../engine/core/levels";
import { Match } from "../engine/core/match";
import { gauntletFoeLevel } from "../engine/progression/economy";

export const PLAYERS: Record<string, AIProfile> = {
  strong: { ...DEFAULT_AI, difficulty: 0.9 },
  mid: { ...DEFAULT_AI, difficulty: 0.5 },
  weak: { ...DEFAULT_AI, difficulty: 0.2 },
};

/** A sensible pick: heal when hurt, money early, then whatever suits the army. */
export function pickBoon(run: GauntletRun, choices: Boon[]): Boon {
  const kinds = new Set(run.board.map((p) => p.kind));
  const score = (b: Boon) => {
    switch (b.id) {
      case "mend": return run.hp < run.maxHp * 0.5 ? 10 : 1;
      case "tithe": return run.stage <= 4 ? 6 : 3;
      case "iron": case "edge": return 5;
      case "drill": return 4.5;
      case "barracks": return 4;
      case "scout": return 2;
      default: return kinds.size ? 3.5 : 1;
    }
  };
  return choices.reduce((a, b) => (score(b) > score(a) ? b : a));
}

export interface DuelLog { stage: number; foe: string; tactic: string; won: boolean; rounds: number; hpAfter: number; board: number; value: number; }

/** Plays one duel of a run headless (the AI on both sides). */
export function playDuel(run: GauntletRun, player: AIProfile): { m: Match; log: DuelLog } {
  const foe = gauntletFoe(run.stage, boardValue(run.board), run.seed);
  const pl = Number(process.env.PLAYER_LEVEL) || 1;
  const fl = process.env.GAUNTLET_LEVELS ? gauntletFoeLevel(run.stage, Number(process.env.CAP) || 10) : 1;
  const m = new Match({ ...duelConfig(run, foe), ...(pl > 1 || fl > 1 ? { levels: [uniformLevels(pl), uniformLevels(fl)] } : {}) });
  while (m.phase !== "over" && m.played < 40) {
    const f = planTurn(m, 1, foe.ai);
    const y = planTurn(m, 0, player);
    applyPlan(m, 1, f);
    applyPlan(m, 0, y);
    m.fight();
    m.next();
  }
  const stage = run.stage;
  const won = endDuel(run, m);
  return { m, log: { stage, foe: foe.name, tactic: foe.ai.tactic, won, rounds: m.played, hpAfter: run.hp, board: m.sides[0].pieces.length, value: boardValue(run.board) } };
}

export function playRun(seed: number, player: AIProfile, maxStage = 20): { run: GauntletRun; logs: DuelLog[] } {
  const run = newRun(seed);
  const logs: DuelLog[] = [];
  while (!run.over && run.stage <= maxStage) {
    const { log } = playDuel(run, player);
    logs.push(log);
    if (log.won) takeBoon(run, pickBoon(run, boonChoices(run)).id);
  }
  return { run, logs };
}

interface Task { who: string; seed: number; }

async function main() {
  const runs = Number(process.env.RUNS ?? 8);
  const who = (process.env.WHO ?? "strong,mid").split(",");
  const tasks: Task[] = [];
  for (let i = 0; i < runs; i++) for (const w of who) tasks.push({ who: w, seed: 1000 + i * 7919 });
  const procs = Math.max(1, Math.min(Number(process.env.PROCS ?? Math.max(1, cpus().length - 3)), tasks.length));
  const results: { who: string; seed: number; wins: number; boons: string[]; logs: DuelLog[] }[] = [];
  const t0 = performance.now();
  const bin = resolve(dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/vite-node");
  await Promise.all(Array.from({ length: procs }, (_, k) => new Promise<void>((done, fail) => {
    const child = spawn(bin, [fileURLToPath(import.meta.url)], { env: { ...process.env, GAUNTLET_WORKER: JSON.stringify(tasks.filter((_, i) => i % procs === k)) }, stdio: ["ignore", "pipe", "inherit"] });
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.startsWith("{")) results.push(JSON.parse(line)); }
    });
    child.on("exit", (code) => (code === 0 ? done() : fail(Error(`worker ${k} exited ${code}`))));
  })));
  for (const w of who) {
    const rs = results.filter((r) => r.who === w).sort((a, b) => a.seed - b.seed);
    const wins = rs.map((r) => r.wins).sort((a, b) => a - b);
    console.log(`${w}: rivals beaten ${wins.join(" ")} | mean ${(wins.reduce((s, x) => s + x, 0) / wins.length).toFixed(1)} median ${wins[Math.floor(wins.length / 2)]}`);
    if (process.env.VERBOSE) for (const r of rs) {
      console.log(`  seed ${r.seed}: ${r.wins} wins, boons ${r.boons.join(",")}`);
      for (const l of r.logs) console.log(`    stage ${l.stage} vs ${l.foe} (${l.tactic}) ${l.won ? "won" : "LOST"} in ${l.rounds} rounds, hp ${l.hpAfter}, board ${l.board} worth ${l.value}`);
    }
  }
  console.log(`${results.length} runs in ${((performance.now() - t0) / 1000).toFixed(0)}s on ${procs} processes`);
}

if (process.env.GAUNTLET_WORKER) {
  for (const t of JSON.parse(process.env.GAUNTLET_WORKER) as Task[]) {
    const { run, logs } = playRun(t.seed, PLAYERS[t.who], Number(process.env.MAX_STAGE ?? 16));
    console.log(JSON.stringify({ ...t, wins: run.wins, boons: run.boons, logs }));
  }
} else if (!process.env.VITEST) {
  main();
}
