// Arena balance: AI-vs-AI matches on every arena (plus the open field as a baseline), reporting per arena the side 0
// vs side 1 win rate (should be near 50/50: the maps are symmetric), the share of battles that ran to the 45 s limit,
// the share that were standoffs (ran to the limit with a mobile ground fighter still alive on BOTH sides: the armies
// never finished each other, which is what terrain could cause; should be under ~8%), the average battle length, and
// unit pick and win rates in arenas next to the open field (is anything useless or dominant once there are walls?).
// Note the time-limit column is high even on the open field (~20-25%): AI armies often end as fixed structures out of
// each other's reach (ballista vs ballista, a bombard inside its minimum range, a buried mine), and the battle is then
// called on what is left. That is the base game, not terrain; compare each arena with the "open" row.
//   npx vite-node tools/arena-balance.ts                      all arenas, N=12 matches each, 4 processes
//   ARENAS=twin-gates,open N=24 DIFF=0.7 PROCS=4 npx vite-node tools/arena-balance.ts
//   MD=1 ...        print the tables as Markdown (for docs/ARENA.md)
// Heavy: run it one at a time, as  lockf -k ~/Desktop/game_development/.heavy.lock nice -n 10 npx vite-node tools/arena-balance.ts
// Each pair of matches shares a seed and swaps which AI profile sits on which side, so a profile's edge cancels out.
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TACTICS, applyPlan, planTurn, type AIProfile } from "../engine/core/ai";
import { ARENAS, arenaById } from "../engine/core/arena";
import { BATTLE_LIMIT, UNIT_KINDS, UNITS, type UnitKind } from "../engine/core/defs";
import { Match } from "../engine/core/match";
import { Rng, hashSeed } from "../engine/core/rng";

interface Task { arena: string; n: number; }
interface Result extends Task {
  winner: -1 | 0 | 1;
  rounds: number;
  /** Rounds won by side 0, side 1, drawn; rounds that hit the time limit; total battle seconds. */
  r0: number; r1: number; rd: number; limit: number; standoff: number; secs: number;
  /** Per unit kind: pieces fielded in a round, and of those the ones on the side that won it. */
  picks: Partial<Record<UnitKind, [number, number]>>;
}

const DIFF = Number(process.env.DIFF ?? 0.6);
/** Bodies that hang back by design, or that a fixed Hive or a Gravecaller keeps sending: one left alive is not a standoff. */
const SUPPORT = new Set<string>(["medic", "banner", "tinker", "lamp", "grave", "decoy", "mite", "queen", "thrall"]);
function profile(seed: number, k: number): AIProfile {
  const rng = new Rng(hashSeed("arena-balance", seed, k));
  return { difficulty: DIFF, tactic: TACTICS[rng.int(0, TACTICS.length - 1)], aggression: rng.range(0.25, 0.8), economy: rng.range(0.2, 0.5), spread: rng.range(0.4, 0.8), rerolls: 1 };
}

function runTask(t: Task): Result {
  const pair = Math.floor(t.n / 2), swap = t.n % 2 === 1;
  const a = profile(pair, 0), b = profile(pair, 1);
  const ai: [AIProfile, AIProfile] = swap ? [b, a] : [a, b];
  const m = new Match({ seed: hashSeed("arena-balance-match", t.arena, pair), terrain: arenaById(t.arena)?.blocks });
  const out: Result = { ...t, winner: -1, rounds: 0, r0: 0, r1: 0, rd: 0, limit: 0, standoff: 0, secs: 0, picks: {} };
  while (m.phase !== "over" && m.played < 30) {
    const p1 = planTurn(m, 1, ai[1]);
    const p0 = planTurn(m, 0, ai[0]);
    applyPlan(m, 1, p1);
    applyPlan(m, 0, p0);
    const battle = m.makeBattle(false);
    const rep = m.resolve(battle.run());
    if (rep.winner === 0) out.r0++; else if (rep.winner === 1) out.r1++; else out.rd++;
    if (rep.result.time >= BATTLE_LIMIT - 1e-6) {
      out.limit++;
      const fighter = (s: number) => battle.bodies.some((b) => b.alive && b.side === s && !b.structure && !b.flying && b.baseDmg > 0 && !SUPPORT.has(b.kind));
      if (fighter(0) && fighter(1)) out.standoff++;
    }
    out.secs += rep.result.time;
    for (const s of [0, 1] as const) for (const p of m.sides[s].pieces) {
      const e = (out.picks[p.kind] ??= [0, 0]);
      e[0]++;
      if (rep.winner === s) e[1]++;
    }
    m.next();
  }
  out.winner = m.winner ?? -1;
  out.rounds = m.played;
  return out;
}

async function main() {
  const want = (process.env.ARENAS ?? "").split(",").filter(Boolean);
  const ids = ["open", ...ARENAS.map((a) => a.id)].filter((id) => !want.length || want.includes(id));
  const n = Number(process.env.N ?? 12);
  const tasks: Task[] = [];
  for (let k = 0; k < n; k++) for (const arena of ids) tasks.push({ arena, n: k });
  const procs = Math.max(1, Math.min(4, Number(process.env.PROCS ?? 4), tasks.length));
  const results: Result[] = [];
  const t0 = performance.now();
  if (procs === 1) for (const t of tasks) results.push(runTask(t));
  else {
    const bin = resolve(dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/vite-node");
    const self = fileURLToPath(import.meta.url);
    await Promise.all(Array.from({ length: procs }, (_, k) => new Promise<void>((done, fail) => {
      const mine = tasks.filter((_, i) => i % procs === k);
      const child = spawn(bin, [self], { env: { ...process.env, ARENA_WORKER: JSON.stringify(mine) }, stdio: ["ignore", "pipe", "inherit"] });
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
  const md = !!process.env.MD;
  const pct = (x: number) => (isNaN(x) ? "  -" : `${Math.round(x * 100)}%`).padStart(4);
  const row = (cells: string[]) => (md ? `| ${cells.join(" | ")} |` : cells.join("  "));
  const problems: string[] = [];
  const head = ["arena".padEnd(15), "league", "matches", "side0 win", "side1 win", "rounds 0/1/draw".padEnd(15), "time limit", "standoff", "avg battle", "avg rounds"];
  console.log(row(head));
  if (md) console.log(row(head.map((h) => "-".repeat(Math.max(3, h.trim().length)))));
  for (const id of ids) {
    const rs = results.filter((r) => r.arena === id);
    if (!rs.length) continue;
    const sum = (f: (r: Result) => number) => rs.reduce((s, r) => s + f(r), 0);
    const rounds = sum((r) => r.rounds), decided = rs.filter((r) => r.winner !== -1).length;
    const w0 = rs.filter((r) => r.winner === 0).length / Math.max(1, decided), w1 = rs.filter((r) => r.winner === 1).length / Math.max(1, decided);
    const lim = sum((r) => r.limit) / rounds;
    console.log(row([
      id.padEnd(15), String(arenaById(id)?.league ?? "-").padStart(6), String(rs.length).padStart(7), pct(w0).padStart(9), pct(w1).padStart(9),
      `${pct(sum((r) => r.r0) / rounds)}/${pct(sum((r) => r.r1) / rounds)}/${pct(sum((r) => r.rd) / rounds)}`.padEnd(15),
      pct(lim).padStart(10), pct(sum((r) => r.standoff) / rounds).padStart(8), `${(sum((r) => r.secs) / rounds).toFixed(1)} s`.padStart(10), (rounds / rs.length).toFixed(1).padStart(10),
    ]));
    const so = sum((r) => r.standoff) / rounds;
    if (so > 0.08) problems.push(`${id}: ${pct(so).trim()} of battles were standoffs`);
    if (rs.length >= 16 && Math.abs(w0 - 0.5) > 0.2) problems.push(`${id}: side 0 wins ${pct(w0).trim()} of matches`);
  }
  // Units: fielded share and round win rate in arenas, next to the open field.
  const tally = (rs: Result[]) => {
    const t = new Map<UnitKind, [number, number]>();
    let all = 0;
    for (const r of rs) for (const [k, v] of Object.entries(r.picks) as [UnitKind, [number, number]][]) {
      const e = t.get(k) ?? [0, 0];
      e[0] += v[0]; e[1] += v[1]; all += v[0];
      t.set(k, e);
    }
    return { t, all };
  };
  const inArena = tally(results.filter((r) => r.arena !== "open")), open = tally(results.filter((r) => r.arena === "open"));
  if (inArena.all) {
    console.log("");
    const uh = ["unit".padEnd(16), "cost", "arena pick", "arena win", "open pick", "open win"];
    console.log(row(uh));
    if (md) console.log(row(uh.map((h) => "-".repeat(Math.max(3, h.trim().length)))));
    const kinds = [...UNIT_KINDS].sort((a, b) => (inArena.t.get(b)?.[0] ?? 0) - (inArena.t.get(a)?.[0] ?? 0));
    for (const k of kinds) {
      const a = inArena.t.get(k) ?? [0, 0], o = open.t.get(k) ?? [0, 0];
      const aw = a[0] ? a[1] / a[0] : NaN;
      console.log(row([
        UNITS[k].name.padEnd(16), String(UNITS[k].cost).padStart(4), pct(a[0] / inArena.all).padStart(10), pct(aw).padStart(9),
        pct(open.all ? o[0] / open.all : NaN).padStart(9), pct(o[0] ? o[1] / o[0] : NaN).padStart(8),
      ]));
      if (a[0] >= 150 && (aw < 0.36 || aw > 0.64)) problems.push(`${UNITS[k].name}: wins ${pct(aw).trim()} of its arena rounds`);
    }
  }
  console.log(`\n${results.length} matches (AI difficulty ${DIFF}) in ${((performance.now() - t0) / 1000).toFixed(0)}s on ${procs} processes. ${problems.length ? "CHECK:\n  " + problems.join("\n  ") : "All targets met."}`);
}

if (process.env.ARENA_WORKER) {
  for (const t of JSON.parse(process.env.ARENA_WORKER) as Task[]) console.log(JSON.stringify(runTask(t)));
} else {
  await main();
}
