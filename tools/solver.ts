// Breakpoint puzzle solver: random drafts plus local search over the deterministic sim. Shared by tests and tools.
import { DEFAULT_AI, TACTICS, applyPlan, planTurn, type AIProfile } from "../engine/core/ai";
import { puzzleConfig, type PuzzleDef } from "../engine/core/content";
import { ASCEND_ROUND, MAX_RANK, UNITS, W, ZONE_DEPTH, toLocal, toWorld, type UnitKind } from "../engine/core/defs";
import { Match, type StartPiece } from "../engine/core/match";
import { Rng } from "../engine/core/rng";

export interface Gene { kind: UnitKind; lx: number; depth: number; rank: number; }

/** Gold a piece of this rank costs in total: the buy plus every rank-up (cost, 2x, then 3x to Ascend). */
export const pieceCost = (kind: UnitKind, rank: number) => UNITS[kind].cost * (1 + (rank * (rank - 1)) / 2);
/** Puzzles are one round-1 battle, so Ascending (rank 4, from round ASCEND_ROUND) is never on offer. */
const PUZZLE_MAX_RANK = ASCEND_ROUND > 1 ? 3 : MAX_RANK;
export const spend = (genes: Gene[]) => genes.reduce((s, g) => s + pieceCost(g.kind, g.rank), 0);

export interface Outcome { won: boolean; legal: boolean; goldLeft: number; fitness: number; margin: number; }

/** Plays a puzzle with these purchases on a real Match (what the UI does), returns how it went. */
export function playPuzzle(p: PuzzleDef, genes: Gene[]): Outcome {
  const m = new Match(puzzleConfig(p));
  const supply = m.supplyCap(0);
  if (spend(genes) > p.gold || genes.length + (p.mine?.length ?? 0) > supply) return { won: false, legal: false, goldLeft: 0, fitness: -1e9, margin: -99 };
  for (const g of genes) {
    const slot = p.shop.indexOf(g.kind);
    const w = toWorld(0, g.lx, g.depth);
    const piece = m.buy(0, slot, w.x, w.y);
    for (let r = 1; r < g.rank; r++) m.upgrade(0, piece.id);
  }
  return judge(m);
}

function judge(m: Match): Outcome {
  const goldLeft = m.sides[0].gold;
  const rep = m.fight();
  const r = rep.result;
  const won = m.winner === 0;
  const margin = r.value[0] - r.value[1];
  // Winning dominates; then gold kept; losses are graded by how close they were.
  const fitness = won ? 1000 + goldLeft * 40 + r.value[0] * 3 + (45 - r.time) * 0.2 : margin * 12 + (r.winner === -1 ? 30 : 0) - r.alive[1] * 2;
  return { won, legal: true, goldLeft, fitness, margin };
}

/** Plays a puzzle with an AI turn on the player side (the naive baseline). */
export function playPuzzleAI(p: PuzzleDef, ai: AIProfile): Outcome {
  const m = new Match(puzzleConfig(p));
  applyPlan(m, 0, planTurn(m, 0, ai));
  return judge(m);
}

/** Pieces the AI would buy (for seeding the search). */
function aiGenes(p: PuzzleDef, ai: AIProfile): Gene[] {
  const m = new Match(puzzleConfig(p));
  applyPlan(m, 0, planTurn(m, 0, ai));
  // Given pieces are created first; everything after them was bought.
  return m.sides[0].pieces.slice(p.mine?.length ?? 0).map((x) => ({ kind: x.kind, rank: x.rank, ...toLocal(0, x.x, x.y) }));
}

const BACKISH = new Set<UnitKind>(["ranger", "medic", "grenadier", "storm", "ballista", "hive"]);

function randomPos(rng: Rng, kind: UnitKind): { lx: number; depth: number } {
  const lx = rng.range(0.6, W - 0.6);
  let depth = rng.range(0.3, ZONE_DEPTH - 0.05);
  if (BACKISH.has(kind) && rng.chance(0.6)) depth = rng.range(0.3, 3);
  if ((kind === "mine" || kind === "bulwark" || kind === "blades") && rng.chance(0.5)) depth = rng.range(3.5, ZONE_DEPTH - 0.05);
  return { lx, depth };
}

function clampGene(g: Gene): Gene {
  return { ...g, lx: Math.max(0.55, Math.min(W - 0.55, g.lx)), depth: Math.max(0.25, Math.min(ZONE_DEPTH - 0.02, g.depth)) };
}

function randomDraft(p: PuzzleDef, rng: Rng): Gene[] {
  const supply = p.supply - (p.mine?.length ?? 0);
  const out: Gene[] = [];
  let gold = p.gold * rng.range(0.55, 1);
  for (let k = 0; k < 20 && out.length < supply; k++) {
    const kinds = p.shop.filter((x) => UNITS[x].cost <= gold);
    if (!kinds.length) break;
    const kind = rng.pick(kinds);
    let rank = 1;
    if (rng.chance(0.18) && pieceCost(kind, 2) <= gold) rank = 2;
    if (rank === 2 && rng.chance(0.2) && pieceCost(kind, 3) <= gold) rank = 3;
    gold -= pieceCost(kind, rank);
    out.push({ kind, rank, ...randomPos(rng, kind) });
  }
  return out;
}

function mutate(p: PuzzleDef, genes: Gene[], rng: Rng, scale: number): Gene[] {
  const g = genes.map((x) => ({ ...x }));
  const supply = p.supply - (p.mine?.length ?? 0);
  const left = p.gold - spend(g);
  const r = rng.next();
  if (g.length === 0 || r < 0.08) {
    const kinds = p.shop.filter((k) => UNITS[k].cost <= left);
    if (kinds.length && g.length < supply) { const kind = rng.pick(kinds); g.push({ kind, rank: 1, ...randomPos(rng, kind) }); return g; }
  }
  const i = rng.int(0, g.length - 1);
  if (r < 0.55) {
    g[i].lx += rng.range(-1, 1) * scale;
    g[i].depth += rng.range(-1, 1) * scale;
  } else if (r < 0.63) {
    Object.assign(g[i], randomPos(rng, g[i].kind));
  } else if (r < 0.7) {
    // Swap two pieces' spots.
    const j = rng.int(0, g.length - 1);
    const a = { lx: g[i].lx, depth: g[i].depth };
    g[i].lx = g[j].lx; g[i].depth = g[j].depth; g[j].lx = a.lx; g[j].depth = a.depth;
  } else if (r < 0.8) {
    const kinds = p.shop.filter((k) => k !== g[i].kind && pieceCost(k, g[i].rank) <= left + pieceCost(g[i].kind, g[i].rank));
    if (kinds.length) g[i].kind = rng.pick(kinds);
  } else if (r < 0.87) {
    if (g[i].rank < PUZZLE_MAX_RANK && pieceCost(g[i].kind, g[i].rank + 1) - pieceCost(g[i].kind, g[i].rank) <= left) g[i].rank++;
    else if (g[i].rank > 1) g[i].rank--;
  } else if (r < 0.94) {
    g.splice(i, 1);
  } else {
    // Mirror the whole layout.
    for (const x of g) x.lx = W - x.lx;
  }
  return g.map(clampGene);
}

export interface Win { goldLeft: number; genes: Gene[]; robust: number; }
export interface SolveResult {
  /** Most robust win found for each amount of gold left, most gold first. */
  wins: Win[];
  best: Gene[] | null;
  bestLeft: number;
  evals: number;
}

export interface SolveOpts { seed?: number; evals?: number; restarts?: number; /** Robustness polish steps per gold level (0 = none). */ polish?: number; }

/** Searches purchases and placements. Deterministic for a given seed. */
export function solve(p: PuzzleDef, opts: SolveOpts = {}): SolveResult {
  const rng = new Rng(opts.seed ?? 1);
  const budget = opts.evals ?? 2500;
  let evals = 0;
  const wins = new Map<number, { g: Gene[]; f: number }[]>();
  const evalG = (g: Gene[]): Outcome => {
    evals++;
    const o = playPuzzle(p, g);
    if (o.won) {
      const list = wins.get(o.goldLeft) ?? [];
      list.push({ g: g.map((x) => ({ ...x })), f: o.fitness });
      list.sort((a, b) => b.f - a.f);
      if (list.length > 5) list.length = 5;
      wins.set(o.goldLeft, list);
    }
    return o;
  };
  // Seeds: AI drafts in every style, then random drafts.
  const pool: { g: Gene[]; f: number }[] = [];
  for (const tactic of TACTICS) for (const aggression of [0.25, 0.75]) {
    const g = aiGenes(p, { ...DEFAULT_AI, difficulty: 0.9, tactic, aggression, economy: 0 });
    pool.push({ g, f: evalG(g).fitness });
  }
  const randoms = Math.round(budget * 0.25);
  for (let k = 0; k < randoms; k++) {
    const g = randomDraft(p, rng);
    pool.push({ g, f: evalG(g).fitness });
  }
  pool.sort((a, b) => b.f - a.f);
  // Local search from the best few, sharing what is left of the budget.
  const restarts = opts.restarts ?? 6;
  const starts = pool.slice(0, restarts);
  const per = Math.max(20, Math.floor((budget - evals) / Math.max(1, starts.length)));
  for (const s of starts) {
    let cur = s.g, cf = s.f;
    for (let it = 0; it < per; it++) {
      const scale = 1.2 * (1 - it / per) + 0.15;
      const cand = mutate(p, cur, rng, scale);
      const o = evalG(cand);
      if (!o.legal) continue;
      // Mild annealing: accept small steps back early on.
      const temp = 20 * (1 - it / per);
      if (o.fitness >= cf || rng.chance(Math.exp((o.fitness - cf) / Math.max(1e-3, temp)))) { cur = cand; cf = o.fitness; }
    }
  }
  // Rank each gold level's wins by how well they survive small nudges; polish the top levels' layouts for it.
  const out: Win[] = [];
  const levels = [...wins.keys()].sort((a, b) => b - a);
  const polish = opts.polish ?? 40;
  levels.forEach((goldLeft, li) => {
    let best: Win | null = null;
    for (const w of wins.get(goldLeft)!) {
      const r = robustness(p, w.g, 8);
      evals += 8;
      if (!best || r > best.robust) best = { goldLeft, genes: w.g, robust: r };
    }
    if (polish > 0 && li < 4 && best!.robust < 1) {
      for (let it = 0; it < polish; it++) {
        const cand = best!.genes.map((x) => clampGene({ ...x, lx: x.lx + rng.range(-0.5, 0.5), depth: x.depth + rng.range(-0.5, 0.5) }));
        const o = playPuzzle(p, cand);
        evals++;
        if (!o.won || o.goldLeft !== goldLeft) continue;
        const r = robustness(p, cand, 8, 0.25, 7 + it);
        evals += 8;
        if (r > best!.robust) best = { goldLeft, genes: cand, robust: r };
        if (best!.robust >= 1) break;
      }
      best!.robust = robustness(p, best!.genes, 16, 0.25, 99);
    }
    out.push(best!);
  });
  return { wins: out, best: out[0]?.genes ?? null, bestLeft: out[0]?.goldLeft ?? -1, evals };
}

/** Share of small nudges (each piece moved up to `jitter` either way) that still win. */
export function robustness(p: PuzzleDef, genes: Gene[], n = 12, jitter = 0.25, seed = 7): number {
  const rng = new Rng(seed);
  let w = 0;
  for (let k = 0; k < n; k++) {
    const g = genes.map((x) => clampGene({ ...x, lx: x.lx + rng.range(-jitter, jitter), depth: x.depth + rng.range(-jitter, jitter) }));
    if (playPuzzle(p, g).won) w++;
  }
  return w / n;
}

/** How often obvious plays win: the 0.3 AI in every style (banking or spending it all), plus all gold on the cheapest
 * (or dearest) kind in a centred row. */
export function naive(p: PuzzleDef): { aiRate: number; cheapWins: boolean; costlyWins: boolean } {
  let w = 0, n = 0;
  for (const tactic of TACTICS) for (const aggression of [0.3, 0.7]) for (const economy of [0, 0.4]) {
    n++;
    if (playPuzzleAI(p, { ...DEFAULT_AI, difficulty: 0.3, tactic, aggression, economy }).won) w++;
  }
  const row = (kind: UnitKind) => {
    const supply = p.supply - (p.mine?.length ?? 0);
    const count = Math.min(supply, Math.floor(p.gold / UNITS[kind].cost));
    const g: Gene[] = Array.from({ length: count }, (_, i) => ({ kind, rank: 1, lx: W / 2 + (i - (count - 1) / 2) * 0.9, depth: 3 }));
    return playPuzzle(p, g.map(clampGene)).won;
  };
  const byCost = [...p.shop].sort((a, b) => UNITS[a].cost - UNITS[b].cost);
  return { aiRate: w / n, cheapWins: row(byCost[0]), costlyWins: row(byCost[byCost.length - 1]) };
}

export const toStart = (genes: Gene[]): StartPiece[] => genes.map((g) => ({ kind: g.kind, lx: +g.lx.toFixed(2), depth: +g.depth.toFixed(2), ...(g.rank > 1 ? { rank: g.rank } : {}) }));
export const fromStart = (s: StartPiece[]): Gene[] => s.map((x) => ({ kind: x.kind, lx: x.lx, depth: x.depth, rank: x.rank ?? 1 }));
