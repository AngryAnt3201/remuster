// AI vs AI matches: does difficulty matter, and how often do the AIs Ascend?
//   DUEL=1 npx vite-node tools/duel.ts            N=24 games per pairing, PROCS=6 in parallel
//   PAIRS=0.9:0.15,0.9:0.5 N=32 DUEL=1 npx vite-node tools/duel.ts
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Match } from "../engine/core/match";
import { planTurn, applyPlan, DEFAULT_AI, type AIProfile } from "../engine/core/ai";
import type { UnitKind } from "../engine/core/defs";

export function play(seed: number, a: AIProfile, b: AIProfile) {
  const m = new Match({ seed });
  while (m.phase !== "over" && m.round < 40) {
    applyPlan(m, 0, planTurn(m, 0, a));
    applyPlan(m, 1, planTurn(m, 1, b));
    m.fight();
    m.next();
  }
  return m;
}
export function series(a: AIProfile, b: AIProfile, n: number, seed0 = 1) {
  let w = 0, l = 0, rounds = 0;
  for (let s = 0; s < n; s++) {
    // Alternate seats so neither side has an edge.
    const flip = s % 2 === 1;
    const m = flip ? play(seed0 + s, b, a) : play(seed0 + s, a, b);
    if (flip ? m.winner === 1 : m.winner === 0) w++;
    if (flip ? m.winner === 0 : m.winner === 1) l++;
    rounds += m.round;
  }
  return { w, l, n, avgRounds: +(rounds / n).toFixed(1) };
}

interface Game { pair: string; a: number; b: number; seed: number; }
interface Out extends Game { won: boolean; lost: boolean; rounds: number; ascended: number; army: UnitKind[] }

const prof = (x: number): AIProfile => ({ ...DEFAULT_AI, difficulty: x });
function playOne(g: Game): Out {
  const flip = g.seed % 2 === 1;
  const m = flip ? play(g.seed, prof(g.b), prof(g.a)) : play(g.seed, prof(g.a), prof(g.b));
  const me = flip ? 1 : 0;
  return {
    ...g, won: m.winner === me, lost: m.winner === 1 - me, rounds: m.round,
    ascended: m.sides[me].pieces.filter((p) => p.rank === 4).length,
    army: m.sides[me].pieces.map((p) => p.kind),
  };
}

async function main() {
  const pairs = (process.env.PAIRS ?? "0.9:0.15,0.9:0.5,0.5:0.15").split(",").map((p) => p.split(":").map(Number) as [number, number]);
  const n = Number(process.env.N ?? 24);
  const games: Game[] = [];
  for (const [a, b] of pairs) for (let s = 0; s < n; s++) games.push({ pair: `${a} vs ${b}`, a, b, seed: 1 + s });
  const procs = Math.max(1, Math.min(Number(process.env.PROCS ?? Math.max(1, cpus().length - 4)), games.length));
  const outs: Out[] = [];
  const t0 = performance.now();
  const bin = resolve(dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/vite-node");
  const self = fileURLToPath(import.meta.url);
  await Promise.all(Array.from({ length: procs }, (_, k) => new Promise<void>((done, fail) => {
    const mine = games.filter((_, i) => i % procs === k);
    const child = spawn(bin, [self], { env: { ...process.env, DUEL_WORKER: JSON.stringify(mine) }, stdio: ["ignore", "pipe", "inherit"] });
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (line.startsWith("{")) outs.push(JSON.parse(line));
      }
    });
    child.on("exit", (code) => (code === 0 ? done() : fail(Error(`worker ${k} exited ${code}`))));
  })));
  for (const [a, b] of pairs) {
    const rs = outs.filter((o) => o.a === a && o.b === b);
    const w = rs.filter((o) => o.won).length, l = rs.filter((o) => o.lost).length;
    const rounds = rs.reduce((s, o) => s + o.rounds, 0) / rs.length;
    const asc = rs.reduce((s, o) => s + o.ascended, 0) / rs.length;
    console.log(`${a} vs ${b}: ${w}-${l} of ${rs.length} (${Math.round((w / rs.length) * 100)}% wins), ${rounds.toFixed(1)} rounds, ${asc.toFixed(2)} Ascended per final army`);
  }
  // What the strongest AI ends up fielding.
  const count = new Map<UnitKind, number>();
  for (const o of outs.filter((x) => x.a === pairs[0][0])) for (const k of o.army) count.set(k, (count.get(k) ?? 0) + 1);
  const total = [...count.values()].reduce((s, x) => s + x, 0);
  console.log("final armies of the first AI:", [...count.entries()].sort((x, y) => y[1] - x[1]).map(([k, c]) => `${k} ${Math.round((c / total) * 100)}%`).join(", "));
  console.log(`${outs.length} games in ${((performance.now() - t0) / 1000).toFixed(0)}s on ${procs} processes`);
}

if (process.env.DUEL_WORKER) {
  for (const g of JSON.parse(process.env.DUEL_WORKER) as Game[]) console.log(JSON.stringify(playOne(g)));
} else if (process.env.DUEL) {
  main();
}
