// Unit balance at equal gold. Two tables:
//   mono:  an army of one kind vs an army of another, every pair, 60 gold each (rank 2), both seats.
//   mixed: random armies of 30 gold from all 24 kinds; each kind's win rate in the armies that hold it.
// Flags outliers: a kind whose mixed win rate is far from 50%, or a fighting kind whose mono record is lopsided.
//   npx vite-node tools/arena.ts                 MIXED=3000 SEEDS=2 PROCS=5
// `arenaTables()` is also used by tests (small sizes).
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_AI, formation } from "../engine/core/ai";
import { simulate } from "../engine/core/battle";
import { UNITS, UNIT_KINDS, type Piece, type Side, type UnitKind } from "../engine/core/defs";
import { Rng, hashSeed } from "../engine/core/rng";

const FIGHT = UNIT_KINDS.filter((k) => k !== "mine");

/** A mono army worth exactly 60 gold at rank 2 (one rank-1 piece fills the odd 4 for cost-4 kinds). */
export function monoArmy(kind: UnitKind, side: Side, seed: number): Piece[] {
  const c = UNITS[kind].cost, ps: Piece[] = [];
  let g = 60, id = side * 100 + 1;
  while (g >= 2 * c && ps.length < 12) { ps.push({ id: id++, kind, side, x: 0, y: 0, rank: 2, spent: 2 * c }); g -= 2 * c; }
  if (g >= c) ps.push({ id: id++, kind, side, x: 0, y: 0, rank: 1, spent: c });
  return place(ps, side, seed);
}

/** A random army spending `gold` on kinds drawn evenly from the whole roster. */
export function randomArmy(side: Side, gold: number, rng: Rng): Piece[] {
  const ps: Piece[] = [];
  let g = gold, id = side * 100 + 1;
  for (let guard = 0; guard < 40 && g >= 2 && ps.length < 10; guard++) {
    const k = rng.pick(UNIT_KINDS);
    if (UNITS[k].cost > g) continue;
    if (k === "mine" && ps.filter((p) => p.kind === "mine").length >= 2) continue;
    ps.push({ id: id++, kind: k, side, x: 0, y: 0, rank: 1, spent: UNITS[k].cost });
    g -= UNITS[k].cost;
  }
  return place(ps, side, rng.int(1, 1e9));
}

function place(ps: Piece[], side: Side, seed: number): Piece[] {
  const lay = formation(side, ps, [], { ...DEFAULT_AI, difficulty: 1 }, new Rng(seed), 0.2);
  for (const l of lay) { const p = ps.find((q) => q.id === l.id)!; p.x = l.x; p.y = l.y; }
  return ps;
}

const reId = (ps: Piece[], base: number) => ps.map((p, i) => ({ ...p, id: base + i }));

export interface MonoRow { a: UnitKind; b: UnitKind; score: number; n: number }
export function monoPair(a: UnitKind, b: UnitKind, seeds: number): MonoRow {
  let score = 0, n = 0;
  for (let s = 0; s < seeds; s++) for (const seat of [0, 1] as Side[]) {
    const A = monoArmy(a, seat, hashSeed("mono", a, s)), B = monoArmy(b, (1 - seat) as Side, hashSeed("mono", b, s));
    const r = simulate([...reId(A, 1), ...reId(B, 200)], { seed: hashSeed("arena", a, b, s, seat) });
    score += r.winner === seat ? 1 : r.winner === -1 ? 0.5 : 0;
    n++;
  }
  return { a, b, score, n };
}

export interface MixedRow { kinds: [UnitKind[], UnitKind[]]; winner: -1 | 0 | 1 }
export function mixedGame(i: number, gold = 30): MixedRow {
  const rng = new Rng(hashSeed("mixed", i));
  const A = randomArmy(0, gold, rng), B = randomArmy(1, gold, rng);
  const r = simulate([...reId(A, 1), ...reId(B, 200)], { seed: hashSeed("mixedfight", i) });
  return { kinds: [A.map((p) => p.kind), B.map((p) => p.kind)], winner: r.winner };
}

export interface KindStats { kind: UnitKind; mono: number; mixed: number; present: number; flag: string }
/** Builds both tables from raw results. */
export function summarise(mono: MonoRow[], mixed: MixedRow[]): KindStats[] {
  return UNIT_KINDS.map((k) => {
    const rows = mono.filter((r) => r.a === k && r.b !== k);
    const monoRate = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.reduce((s, r) => s + r.n, 0) : NaN;
    let w = 0, n = 0;
    for (const g of mixed) for (const s of [0, 1] as Side[]) {
      // Weight by how much of the army it is, so a kind's share of the gold counts.
      const copies = g.kinds[s].filter((x) => x === k).length;
      if (!copies) continue;
      const wt = (copies * UNITS[k].cost) / g.kinds[s].reduce((a, x) => a + UNITS[x].cost, 0);
      w += wt * (g.winner === s ? 1 : g.winner === -1 ? 0.5 : 0);
      n += wt;
    }
    const mixedRate = n ? w / n : NaN;
    const support = UNITS[k].role === "support" || k === "grave";
    const flags: string[] = [];
    if (mixedRate > 0.58) flags.push("strong in mixed armies");
    if (mixedRate < 0.42) flags.push("weak in mixed armies");
    if (!support && k !== "mine" && monoRate > 0.8) flags.push("mono army beats nearly everything");
    if (!support && k !== "mine" && monoRate < 0.15) flags.push("mono army beats nearly nothing");
    return { kind: k, mono: monoRate, mixed: mixedRate, present: n, flag: flags.join("; ") };
  });
}

export function arenaTables(opts: { seeds?: number; mixed?: number } = {}): KindStats[] {
  const mono: MonoRow[] = [];
  for (const a of FIGHT) for (const b of FIGHT) if (a !== b) mono.push(monoPair(a, b, opts.seeds ?? 1));
  const mixed: MixedRow[] = [];
  for (let i = 0; i < (opts.mixed ?? 400); i++) mixed.push(mixedGame(i));
  return summarise(mono, mixed);
}

// ---------------------------------------------------------------- CLI (parallel)
type Job = { t: "mono"; a: UnitKind; b: UnitKind } | { t: "mixed"; i: number };

async function main() {
  const seeds = Number(process.env.SEEDS ?? 2), nMixed = Number(process.env.MIXED ?? 3000);
  const jobs: Job[] = [];
  for (const a of FIGHT) for (const b of FIGHT) if (a !== b) jobs.push({ t: "mono", a, b });
  for (let i = 0; i < nMixed; i++) jobs.push({ t: "mixed", i });
  const procs = Math.max(1, Number(process.env.PROCS ?? Math.max(1, cpus().length - 4)));
  const mono: MonoRow[] = [], mixed: MixedRow[] = [];
  const t0 = performance.now();
  const bin = resolve(dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/vite-node");
  const self = fileURLToPath(import.meta.url);
  await Promise.all(Array.from({ length: procs }, (_, k) => new Promise<void>((done, fail) => {
    const mine = jobs.filter((_, i) => i % procs === k);
    const child = spawn(bin, [self], { env: { ...process.env, ARENA_WORKER: JSON.stringify({ jobs: mine, seeds }) }, stdio: ["ignore", "pipe", "inherit"] });
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.startsWith("{")) continue;
        const o = JSON.parse(line);
        if (o.kinds) mixed.push(o); else mono.push(o);
      }
    });
    child.on("exit", (code) => (code === 0 ? done() : fail(Error(`worker ${k} exited ${code}`))));
  })));
  const stats = summarise(mono, mixed);
  const pct = (x: number) => (isNaN(x) ? "  - " : `${Math.round(x * 100)}%`.padStart(4));
  console.log("kind        cost   hp  dmg role       | mono  mixed | flag");
  for (const s of [...stats].sort((a, b) => b.mixed - a.mixed)) {
    const u = UNITS[s.kind];
    console.log(`${s.kind.padEnd(10)} ${String(u.cost).padStart(4)} ${String(u.hp).padStart(4)} ${String(u.dmg).padStart(4)} ${u.role.padEnd(10)} | ${pct(s.mono)}  ${pct(s.mixed)} | ${s.flag}`);
  }
  // Each fighting kind's best and worst matchups, to show the niche.
  console.log("\nkind       beats (mono)                          loses to (mono)");
  for (const a of FIGHT) {
    const rows = mono.filter((r) => r.a === a).map((r) => ({ b: r.b, s: r.score / r.n })).sort((x, y) => y.s - x.s);
    const fmt = (l: typeof rows) => l.map((r) => `${r.b} ${Math.round(r.s * 100)}`).join(", ");
    console.log(`${a.padEnd(10)} ${fmt(rows.slice(0, 3)).padEnd(38)} ${fmt(rows.slice(-3).reverse())}`);
  }
  const flagged = stats.filter((s) => s.flag);
  console.log(`\n${mono.length} mono pairs x ${seeds * 2}, ${mixed.length} mixed games in ${((performance.now() - t0) / 1000).toFixed(0)}s. ${flagged.length ? "FLAGGED: " + flagged.map((s) => s.kind).join(", ") : "No outliers."}`);
  if (process.env.JSON_OUT) (await import("node:fs")).writeFileSync(process.env.JSON_OUT, JSON.stringify({ mono, mixed, stats }));
}

if (process.env.ARENA_WORKER) {
  const { jobs, seeds } = JSON.parse(process.env.ARENA_WORKER) as { jobs: Job[]; seeds: number };
  for (const j of jobs) console.log(JSON.stringify(j.t === "mono" ? monoPair(j.a, j.b, seeds) : mixedGame(j.i)));
} else if (!process.env.VITEST && !process.env.ARENA_LIB) {
  main();
}
