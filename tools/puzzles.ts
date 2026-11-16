// Breakpoint check: solves every puzzle, checks the obvious plays fail and suggests silver/par from what the solver reached.
//   npx vite-node tools/puzzles.ts            all puzzles
//   PIDS=3,7 EVALS=8000 npx vite-node tools/puzzles.ts
import { DEFAULT_AI } from "../engine/core/ai";
import { PUZZLES, SOLUTIONS } from "../engine/core/puzzles";
import type { PuzzleDef } from "../engine/core/content";
import type { StartPiece } from "../engine/core/match";
import { fromStart, naive, playPuzzle, playPuzzleAI, robustness, solve, toStart, type Gene, type Win } from "./solver";

const ids = (process.env.PIDS ?? "").split(",").filter(Boolean).map(Number);
const evals = Number(process.env.EVALS ?? 6000);
const seeds = Number(process.env.SEEDS ?? 3);
const suggested: Record<number, unknown> = {};

/** The solution as stored (coordinates rounded), checked to still win with the same gold left; nudged if not. */
function storable(p: PuzzleDef, genes: Gene[]): StartPiece[] {
  const want = playPuzzle(p, genes).goldLeft;
  for (let k = 0; k < 200; k++) {
    const g = k === 0 ? genes : genes.map((x, i) => ({ ...x, lx: x.lx + Math.sin(k * 7.1 + i) * 0.05, depth: x.depth + Math.cos(k * 3.7 + i) * 0.05 }));
    const s = toStart(g);
    const o = playPuzzle(p, fromStart(s));
    if (o.won && o.goldLeft >= want) return s;
  }
  throw Error(`puzzle ${p.id}: no stable rounding of the solution`);
}

for (const p of PUZZLES.filter((x) => !ids.length || ids.includes(x.id))) {
  const t = performance.now();
  const nv = naive(p);
  const strong = playPuzzleAI(p, { ...DEFAULT_AI, difficulty: 0.9 }).won;
  // Merge several solver runs: keep the most robust win per gold level.
  const best = new Map<number, Win>();
  for (let s = 1; s <= seeds; s++) {
    for (const w of solve(p, { evals, seed: s }).wins) {
      const prev = best.get(w.goldLeft);
      if (!prev || w.robust > prev.robust) best.set(w.goldLeft, w);
    }
  }
  const wins = [...best.values()].sort((a, b) => b.goldLeft - a.goldLeft);
  // Par: the most gold kept by a layout that survives nudges at least half the time; silver: a step below, sturdier.
  const parWin = wins.find((w) => w.robust >= 0.5);
  const par = parWin?.goldLeft ?? -1;
  const silverWin = wins.find((w) => w.goldLeft < par && w.robust >= 0.6);
  const silver = silverWin?.goldLeft ?? Math.max(0, par - 1);
  const stored = SOLUTIONS[p.id] ? playPuzzle(p, fromStart(SOLUTIONS[p.id])) : null;
  const flags = [
    nv.aiRate > 0.25 ? "NAIVE-AI-WINS" : "",
    nv.cheapWins ? "CHEAP-WINS" : "",
    nv.costlyWins ? "COSTLY-WINS" : "",
    par < 0 ? "UNSOLVED" : "",
    par !== p.par || silver !== p.silver ? `STARS ${p.silver}/${p.par} -> ${silver}/${par}` : "",
    stored && (!stored.won || stored.goldLeft < p.par) ? "STORED-SOLUTION-BELOW-PAR" : "",
  ].filter(Boolean);
  console.log(`#${String(p.id).padStart(2)} ${p.name.padEnd(15)} gold ${String(p.gold).padStart(2)} | naive AI ${(nv.aiRate * 100).toFixed(0).padStart(3)}% cheap ${nv.cheapWins ? "W" : "-"} costly ${nv.costlyWins ? "W" : "-"} ai0.9 ${strong ? "W" : "-"} | wins ${wins.map((w) => `${w.goldLeft}:${w.robust.toFixed(2)}`).join(" ")} | silver ${silver} par ${par} (${((performance.now() - t) / 1000).toFixed(1)}s) ${flags.join(" ")}`);
  if (parWin) suggested[p.id] = { silver, par, solution: storable(p, parWin.genes), robust: robustness(p, parWin.genes, 16, 0.25, 99) };
}
if (process.env.JSON) console.log(JSON.stringify(suggested));
