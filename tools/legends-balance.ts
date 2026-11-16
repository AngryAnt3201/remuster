// Legendary balance: cost-for-cost duels and mixed-army impact for every unit, with the new legendaries highlighted.
//   nice -n 10 npx vite-node tools/legends-balance.ts            N=16 seeds per pairing, one process
//   KINDS=griffin,tide,lion RANK=3 N=24 npx vite-node tools/legends-balance.ts
// Duel: about 15 gold of one kind against about 15 gold of another (both seats, mirrored), score = wins + draws/2.
// Mixed: random 5-unit armies; each kind's score is the win rate of armies that hold it, minus the overall 0.5.
import { simulate } from "../engine/core/battle";
import { H, UNITS, UNIT_KINDS, W, type Piece, type Side, type UnitKind } from "../engine/core/defs";

const N = Number(process.env.N ?? 16);
const RANK = Number(process.env.RANK ?? 2);
const FOCUS = (process.env.KINDS ?? "griffin,tide,lion,storm,golem").split(",") as UnitKind[];
const BUDGET = 15;

let nid = 1;
/** Lays out pieces in their zone: front line for melee and tanks, back line for the rest. */
function army(kinds: UnitKind[], side: Side, rank: number): Piece[] {
  const front = kinds.filter((k) => ["melee", "tank", "cavalry", "siege", "assassin", "air", "trap"].includes(UNITS[k].role));
  const back = kinds.filter((k) => !front.includes(k));
  const out: Piece[] = [];
  const row = (ks: UnitKind[], depth: number) => ks.forEach((k, i) => {
    const x = (W * (i + 1)) / (ks.length + 1);
    const y = side === 0 ? H - 0.5 - depth : 0.5 + depth;
    out.push({ id: nid++, kind: k, side, x, y, rank, spent: UNITS[k].cost * rank });
  });
  row(front, 4.2);
  row(back, 1.6);
  return out;
}
const copies = (k: UnitKind) => Array<UnitKind>(Math.max(1, Math.round(BUDGET / UNITS[k].cost))).fill(k);

function score(a: UnitKind[], b: UnitKind[], seeds: number, rank = RANK) {
  let s = 0;
  for (let i = 0; i < seeds; i++) {
    for (const flip of [false, true]) {
      const pa = army(a, flip ? 1 : 0, rank), pb = army(b, flip ? 0 : 1, rank);
      const r = simulate([...pa, ...pb], { seed: 1000 + i });
      const mine = flip ? 1 : 0;
      s += r.winner === mine ? 1 : r.winner === -1 ? 0.5 : 0;
    }
  }
  return s / (seeds * 2);
}

const t0 = Date.now();
console.log(`Cost-for-cost duels at rank ${RANK}, ${N} seeds x 2 seats (row unit vs every other unit; mean, and the worst and best matchups)`);
for (const k of FOCUS) {
  const res = UNIT_KINDS.filter((o) => o !== k && o !== "mine").map((o) => [o, score(copies(k), copies(o), N)] as const);
  const mean = res.reduce((a, [, v]) => a + v, 0) / res.length;
  const sorted = [...res].sort((x, y) => x[1] - y[1]);
  const f = (xs: readonly (readonly [UnitKind, number])[]) => xs.map(([o, v]) => `${o} ${v.toFixed(2)}`).join(", ");
  console.log(`${k.padEnd(8)} mean ${mean.toFixed(2)}  worst: ${f(sorted.slice(0, 3))}  best: ${f(sorted.slice(-3))}`);
}

// Mixed armies: shared random draws, so every kind sees the same opponents.
let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const pool = UNIT_KINDS.filter((k) => k !== "mine");
const games = N * 40;
const tally = new Map<UnitKind, [number, number]>();
for (let g = 0; g < games; g++) {
  const pick = () => Array.from({ length: 5 }, () => pool[Math.floor(rand() * pool.length)]);
  const a = pick(), b = pick();
  const r = simulate([...army(a, 0, RANK), ...army(b, 1, RANK)], { seed: g });
  const sa = r.winner === 0 ? 1 : r.winner === -1 ? 0.5 : 0;
  for (const [ks, s] of [[a, sa], [b, 1 - sa]] as const) for (const k of new Set(ks)) {
    // Normalise by cost so a 5-gold piece is judged against what 5 gold usually buys.
    const t = tally.get(k) ?? [0, 0];
    t[0] += s; t[1] += 1;
    tally.set(k, t);
  }
}
const rows = [...tally].map(([k, [s, n]]) => [k, s / n - 0.5, n] as const).sort((x, y) => y[1] - x[1]);
console.log(`\nMixed 5-unit armies (${games} games): win rate of armies holding the unit, minus 0.5 (cost not normalised; 5-cost units should sit high)`);
rows.forEach(([k, v, n], i) => console.log(`${String(i + 1).padStart(2)}. ${k.padEnd(10)} ${(v >= 0 ? "+" : "") + v.toFixed(3)}  cost ${UNITS[k].cost}  n=${n}${FOCUS.includes(k) ? "  <" : ""}`));
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
