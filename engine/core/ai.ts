// The opponent. It drafts from its own shop, lays out a formation and, the harder it is, tests candidate plans by
// simulating the coming battle against what it can see of your board (plus a guess at what you'll add).
import { Battle, canHitAir } from "./battle";
import {
  ASCEND_ROUND, MAX_RANK, UNITS, UNIT_KINDS, W, ZONE_DEPTH, clampToZone, toWorld, upgradeCost,
  type Piece, type Role, type Side, type UnitKind,
} from "./defs";
import { Match } from "./match";
import { Rng, hashSeed } from "./rng";

export type Tactic = "balanced" | "swarm" | "fortress" | "artillery" | "ambush" | "blitz" | "siege";
export const TACTICS: Tactic[] = ["balanced", "swarm", "fortress", "artillery", "ambush", "blitz", "siege"];

export interface AIProfile {
  /** 0..1: how many plans it tests, how well it counters you, how rarely it blunders. */
  difficulty: number;
  /** 0..1: how far forward it sets up and how much it favours damage over defence. */
  aggression: number;
  /** Its army style. */
  tactic: Tactic;
  /** 0..1: banks gold for interest and upgrades rather than spending it all. */
  economy: number;
  /** Most rerolls per round. */
  rerolls: number;
  /** 0..1: formation width, tight column to full width. */
  spread: number;
}

export const DEFAULT_AI: AIProfile = { difficulty: 0.6, aggression: 0.5, tactic: "balanced", economy: 0.4, rerolls: 1, spread: 0.6 };

export const TACTIC_WEIGHTS: Record<Tactic, Partial<Record<UnitKind, number>>> = {
  balanced: {},
  swarm: { blades: 1.9, hive: 1.9, medic: 1.2, ranger: 0.8, golem: 0.6, ballista: 0.6, grave: 1.8, banner: 1.6, trickster: 1.3, bombard: 0.6, lamp: 1.3, lion: 1.4 },
  fortress: { bulwark: 1.9, ballista: 1.9, medic: 1.4, mine: 1.4, lancer: 0.6, shade: 0.5, pikeman: 1.7, tinker: 1.8, bombard: 1.5, keg: 0.6, sapper: 0.6, ravager: 0.7, hook: 1.6, lamp: 1.5, outrider: 0.7, tide: 1.3, griffin: 0.7 },
  artillery: { ranger: 1.6, grenadier: 1.9, storm: 1.7, ballista: 1.4, bulwark: 1.3, blades: 0.7, lancer: 0.7, bombard: 1.9, rime: 1.6, pikeman: 1.2, tinker: 1.2, ravager: 0.7, thorn: 1.7, hook: 1.2, tide: 1.6 },
  ambush: { mine: 2.4, shade: 1.9, lancer: 1.3, ballista: 0.8, golem: 0.7, sapper: 2.0, trickster: 1.8, keg: 1.4, harrier: 1.3, bombard: 0.7, thorn: 1.4, outrider: 1.3, griffin: 1.6 },
  blitz: { lancer: 2.0, shade: 1.6, blades: 1.5, ballista: 0.4, mine: 0.5, hive: 0.6, ravager: 1.8, harrier: 1.7, keg: 1.5, duelist: 1.3, banner: 1.2, bombard: 0.4, tinker: 0.5, outrider: 1.7, thorn: 0.6, griffin: 1.4, lion: 1.5, tide: 0.7 },
  siege: { golem: 2.2, hive: 1.4, bulwark: 1.3, storm: 1.2, mine: 0.6, bombard: 1.8, keg: 1.6, sapper: 1.4, grave: 1.3, harrier: 0.8, hook: 1.5, lamp: 1.2, tide: 1.2 },
};

const FRONT: Role[] = ["tank", "melee", "siege", "cavalry"];
const BACK: Role[] = ["ranged", "artillery", "caster", "structure", "spawner"];
const role = (k: UnitKind) => UNITS[k].role;

/** Rough strength of a piece, close to its cost by design. */
export const POWER: Record<UnitKind, number> = {
  mine: 2.1, blades: 3.2, ranger: 3.0, bulwark: 4.0, medic: 2.8, grenadier: 4.0,
  shade: 4.0, lancer: 4.1, ballista: 3.0, hive: 4.0, storm: 5.1, golem: 5.2,
  sapper: 4.0, harrier: 4.0, banner: 2.8, rime: 4.0, ravager: 4.0, grave: 3.8,
  bombard: 3.8, tinker: 2.9, duelist: 3.0, pikeman: 3.0, keg: 2.8, trickster: 3.9,
  hook: 4.0, thorn: 4.0, outrider: 4.0, lamp: 2.9,
  griffin: 5.0, tide: 5.0, lion: 5.0,
};
/** Shoots or casts at flyers itself, or builds something that does. */
const antiAir = (k: UnitKind) => canHitAir(k) || k === "tinker";

export interface PlanOption { type: "buy" | "upgrade"; slot?: number; kind: UnitKind; pieceId?: number; cost: number; }
export interface Plan {
  rerolls: number;
  options: PlanOption[];
  /** Final positions for every piece (existing ids, then new ones in buy order as negative ids -1, -2…). */
  layout: { id: number; x: number; y: number }[];
  score: number;
  tested: number;
  /** The drafted army (new pieces carry negative ids) and the gold it leaves. */
  pieces: Piece[];
  goldLeft: number;
}

interface Draft { gold: number; pieces: Piece[]; shop: (UnitKind | null)[]; supply: number; shopFixed?: boolean; round: number; }

// ---------------------------------------------------------------- valuation
function composition(pieces: Piece[]) {
  const c = {
    front: 0, back: 0, support: 0, swarm: 0, tanks: 0, cavalry: 0, mines: 0,
    air: 0, sneaks: 0, chargers: 0, melee: 0, shooters: 0, structures: 0,
    kinds: {} as Partial<Record<UnitKind, number>>,
  };
  for (const p of pieces) {
    const r = role(p.kind);
    c.kinds[p.kind] = (c.kinds[p.kind] ?? 0) + 1;
    if (FRONT.includes(r)) c.front += p.rank;
    if (BACK.includes(r)) c.back += p.rank;
    if (r === "support") c.support++;
    if (p.kind === "blades" || p.kind === "hive") c.swarm += 1 + (p.kind === "hive" ? 1 : 0);
    if (p.kind === "grave" || p.kind === "trickster") c.swarm += 1;
    if (p.kind === "bulwark" || p.kind === "golem") c.tanks++;
    if (p.kind === "lancer" || p.kind === "golem") c.cavalry++;
    if (p.kind === "mine") c.mines++;
    if (r === "air") c.air++;
    if (p.kind === "sapper" || p.kind === "shade" || p.kind === "trickster") c.sneaks++;
    if (p.kind === "lancer" || p.kind === "keg") c.chargers++;
    if (FRONT.includes(r) || r === "assassin") c.melee++;
    if (r === "ranged" || r === "caster" || p.kind === "ballista" || p.kind === "tinker") c.shooters++;
    if (UNITS[p.kind].structure) c.structures++;
  }
  return c;
}

export function valueOf(kind: UnitKind, mine: Piece[], theirs: Piece[], ai: AIProfile): number {
  const own = composition(mine), opp = composition(theirs);
  const r = role(kind);
  let v = POWER[kind] * (TACTIC_WEIGHTS[ai.tactic][kind] ?? 1);
  // What the army lacks.
  if (FRONT.includes(r) && own.front < 1 + own.back * 0.6) v *= 1.6;
  if (BACK.includes(r) && own.back < own.front * 0.5) v *= 1.35;
  if (r === "support" && own.support >= Math.max(1, Math.floor(mine.length / 4))) v *= 0.35;
  if (kind === "mine" && own.mines >= 3) v *= 0.4;
  if (kind === "hive" && (own.kinds.hive ?? 0) >= 2) v *= 0.5;
  if (kind === "medic" && own.front + own.back === 0) v *= 0.2;
  if (kind === "banner" && mine.length < 3) v *= 0.5; // a flag needs someone to rally
  if (kind === "grave" && (own.kinds.grave ?? 0) >= 1) v *= 0.5;
  if (kind === "keg" && (own.kinds.keg ?? 0) >= 3) v *= 0.6;
  if (kind === "tinker") v *= own.structures >= 2 ? 1.25 : own.structures === 0 ? 0.9 : 1;
  // Counters to what it can see, scaled by how sharp it is.
  const sharp = 0.25 + 0.75 * ai.difficulty;
  let counter = 1;
  if (opp.swarm >= 2 && (kind === "grenadier" || kind === "storm")) counter *= 1.6;
  if (opp.swarm >= 2 && kind === "bulwark") counter *= 1.2;
  if (opp.back >= 3 && (kind === "shade" || kind === "lancer")) counter *= 1.5;
  if (opp.tanks >= 2 && (kind === "ballista" || kind === "shade" || kind === "mine")) counter *= 1.3;
  if (opp.cavalry >= 1 && (kind === "mine" || kind === "bulwark")) counter *= 1.35;
  if (opp.mines >= 2 && kind === "hive") counter *= 1.4;
  if (opp.mines >= 2 && (kind === "lancer" || kind === "blades")) counter *= 0.75;
  if ((opp.kinds.grenadier ?? 0) + (opp.kinds.storm ?? 0) >= 2 && (kind === "blades" || kind === "hive")) counter *= 0.7;
  // Flyers: only shots and spells reach them.
  if (opp.air >= 1) counter *= antiAir(kind) ? 1 + 0.25 * Math.min(3, opp.air) : FRONT.includes(r) ? 0.9 : 1;
  // Diggers and assassins: guards for the back line.
  if (opp.sneaks >= 1 && (kind === "bulwark" || kind === "duelist" || kind === "pikeman")) counter *= 1.25;
  // Cavalry and kegs: pikes.
  if (opp.chargers >= 1 && kind === "pikeman") counter *= 1.5;
  // Crowds: kegs and mortars.
  if (opp.swarm >= 2 && (kind === "keg" || kind === "bombard")) counter *= 1.5;
  // A wall of fighters: something they can't reach, or that out-duels them.
  if (opp.melee >= 4 && (kind === "harrier" || kind === "duelist")) counter *= 1.3;
  if (opp.structures >= 2 && (kind === "sapper" || kind === "harrier")) counter *= 1.3;
  if (opp.back >= 3 && (kind === "sapper" || kind === "harrier" || kind === "trickster")) counter *= 1.4;
  if (opp.tanks >= 2 && kind === "ravager") counter *= 1.3;
  // Kegs get shot before they arrive.
  if (opp.shooters >= 3 && kind === "keg") counter *= 0.75;
  // Back lines get chained to the front; crowds and chargers get tangled in brambles.
  if (opp.back >= 3 && kind === "hook") counter *= 1.4;
  if ((opp.swarm >= 2 || opp.chargers >= 1) && kind === "thorn") counter *= 1.4;
  // Big hitters and artillery: wards soak the blows.
  if ((opp.kinds.bombard ?? 0) + (opp.kinds.grenadier ?? 0) + (opp.kinds.keg ?? 0) >= 2 && kind === "lamp") counter *= 1.35;
  // Slow tanks and flyers: an archer that keeps moving.
  if ((opp.tanks >= 2 || opp.air >= 1) && kind === "outrider") counter *= 1.25;
  // Legendaries: a dive on a soft back line; a wave down a packed front; a hero among many allies.
  if (opp.back >= 3 && kind === "griffin") counter *= 1.3;
  if ((opp.swarm >= 2 || opp.tanks >= 2) && kind === "tide") counter *= 1.25;
  v *= 1 + (counter - 1) * sharp;
  // Temperament.
  const dmg = r === "melee" || r === "cavalry" || r === "assassin" || r === "siege" || r === "caster" || r === "air";
  const def = r === "tank" || r === "structure" || r === "trap" || r === "support";
  if (dmg) v *= 0.8 + 0.4 * ai.aggression;
  if (def) v *= 1.2 - 0.4 * ai.aggression;
  return v;
}

function draftOptions(d: Draft, theirs: Piece[], ai: AIProfile): { opt: PlanOption; score: number }[] {
  const out: { opt: PlanOption; score: number }[] = [];
  const full = d.pieces.length >= d.supply;
  d.shop.forEach((k, slot) => {
    if (!k || full || UNITS[k].cost > d.gold) return;
    const v = valueOf(k, d.pieces, theirs, ai);
    out.push({ opt: { type: "buy", slot, kind: k, cost: UNITS[k].cost }, score: v / UNITS[k].cost });
  });
  // A green commander forgets upgrades until the board is full.
  const upgrades = ai.difficulty >= 0.3 || full;
  for (const p of upgrades ? d.pieces : []) {
    if (p.rank >= MAX_RANK || (p.rank === 3 && d.round < ASCEND_ROUND)) continue;
    const cost = upgradeCost(p.kind, p.rank);
    if (cost > d.gold) continue;
    let v = POWER[p.kind] * (TACTIC_WEIGHTS[ai.tactic][p.kind] ?? 1) * 0.62 * p.rank * (0.75 + 0.6 * ai.economy) * (full ? 1.6 : 1);
    // Ascending buys less raw stat than the earlier ranks; it pays off late, once the board is full and gold piles up.
    if (p.rank === 3) v *= ascendWorth(d.round);
    out.push({ opt: { type: "upgrade", pieceId: p.id, kind: p.kind, cost }, score: v / cost });
  }
  return out;
}

/** How much an Ascend is worth next to a plain rank-up, by round (nothing before ASCEND_ROUND). */
export const ascendWorth = (round: number) => (round < ASCEND_ROUND ? 0 : Math.min(1.05, 0.55 + 0.08 * (round - ASCEND_ROUND)));

/** Spends a side's gold on a draft: greedy for the first candidate, sampled for the rest. */
function draft(base: Draft, theirs: Piece[], ai: AIProfile, rng: Rng, temperature: number, round: number): { options: PlanOption[]; pieces: Piece[]; gold: number } {
  const d: Draft = { gold: base.gold, pieces: base.pieces.map((p) => ({ ...p })), shop: [...base.shop], supply: base.supply, shopFixed: base.shopFixed, round: base.round };
  const options: PlanOption[] = [];
  // Bank toward interest early on, the more it cares about economy.
  const reserve = round < 9 ? Math.min(d.gold, Math.round(ai.economy * 6)) : 0;
  let fresh = -1;
  for (let guard = 0; guard < 20; guard++) {
    const opts = draftOptions(d, theirs, ai).filter((o) => d.gold - o.opt.cost >= reserve || d.pieces.length === 0);
    if (!opts.length) break;
    let i = 0;
    if (temperature <= 0) i = opts.reduce((bi, o, j) => (o.score > opts[bi].score ? j : bi), 0);
    else i = rng.weighted(opts.map((o) => Math.exp(o.score / temperature)));
    const o = opts[i].opt;
    options.push(o);
    d.gold -= o.cost;
    if (o.type === "buy") {
      d.pieces.push({ id: fresh--, kind: o.kind, side: 0, x: 0, y: 0, rank: 1, spent: o.cost });
      if (!d.shopFixed) d.shop[o.slot!] = null;
    } else {
      const p = d.pieces.find((x) => x.id === o.pieceId)!;
      p.rank++;
      p.spent += o.cost;
    }
  }
  return { options, pieces: d.pieces, gold: d.gold };
}

// ---------------------------------------------------------------- formation
const BAND: Record<Role, number> = {
  tank: -0.15, siege: -0.35, melee: -0.6, cavalry: -1.7, assassin: -1.1, trap: 0.4,
  support: -1.9, ranged: -2.4, caster: -2.2, artillery: -3.0, structure: -3.6, spawner: -3.4, air: -1.3,
};

/** Lays the whole army out in side-local terms, then converts to the board. */
export function formation(side: Side, pieces: Piece[], theirs: Piece[], ai: AIProfile, rng: Rng, jitter: number): { id: number; x: number; y: number }[] {
  const front = ZONE_DEPTH * (0.42 + 0.5 * ai.aggression);
  const span = 2.2 + ai.spread * 5.4;
  // Lean toward the side of the board where they are thinner, if it is aggressive and sharp.
  let focus = W / 2;
  if (theirs.length && ai.aggression > 0.55 && ai.difficulty > 0.45) {
    const left = theirs.filter((p) => p.x < W / 2).length, right = theirs.length - left;
    focus += (left < right ? -1 : left > right ? 1 : 0) * (ai.aggression - 0.5) * 2.2;
  }
  const groups = new Map<Role, Piece[]>();
  for (const p of pieces) {
    const r = role(p.kind);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(p);
  }
  const out: { id: number; x: number; y: number }[] = [];
  const theirLanes = theirs.filter((p) => FRONT.includes(role(p.kind)) || p.kind === "shade").map((p) => p.x);
  for (const [r, list] of groups) {
    const n = list.length;
    list.forEach((p, i) => {
      let lx: number, depth: number;
      if (r === "trap") {
        // Mines go where their front-liners will walk, else spread across the front.
        lx = theirLanes.length ? theirLanes[(i + rng.int(0, 2)) % theirLanes.length] + rng.range(-0.6, 0.6) : W / 2 + (i - (n - 1) / 2) * 1.4;
        depth = ZONE_DEPTH - 0.25 - rng.range(0, 1.3) - (i % 2) * 0.5;
      } else if (r === "assassin" || r === "cavalry") {
        const flank = i % 2 === 0 ? -1 : 1;
        lx = r === "assassin" ? W / 2 + flank * (W / 2 - 0.9) : focus + flank * Math.min(span / 2, 1.2 + Math.floor(i / 2) * 1.1);
        depth = front + BAND[r] - Math.floor(i / 2) * 0.6;
      } else if (r === "spawner" || r === "structure") {
        const w = Math.min(span, 1.6 * n + 0.6);
        lx = n === 1 ? focus : focus - w / 2 + (w * i) / (n - 1);
        depth = Math.max(0.5, 0.9 + (i % 2) * 0.8 + (r === "structure" ? 0.2 : 0));
      } else {
        const w = Math.min(span, 1.05 * n);
        lx = n === 1 ? focus : focus - w / 2 + (w * i) / (n - 1);
        depth = front + BAND[r] - (i % 3 === 1 ? 0.35 : 0);
      }
      lx += rng.range(-jitter, jitter);
      depth += rng.range(-jitter, jitter) * 0.8;
      if (rng.chance((1 - ai.difficulty) * 0.3)) {
        // A careless placement.
        lx = rng.range(0.8, W - 0.8);
        depth = rng.range(0.4, ZONE_DEPTH);
      }
      depth = Math.max(0.35, Math.min(ZONE_DEPTH - 0.05, depth));
      const w = toWorld(side, lx, depth);
      const c = clampToZone(side, w.x, w.y, UNITS[p.kind].radius);
      out.push({ id: p.id, x: c.x, y: c.y });
    });
  }
  // Ease apart anything stacked.
  for (let it = 0; it < 6; it++) {
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < 0.62) {
        const k = (0.62 - d) / 2;
        a.x -= (dx / d) * k; a.y -= (dy / d) * k;
        b.x += (dx / d) * k; b.y += (dy / d) * k;
      }
    }
    for (const o of out) {
      const p = pieces.find((q) => q.id === o.id)!;
      const c = clampToZone(side, o.x, o.y, UNITS[p.kind].radius);
      o.x = c.x; o.y = c.y;
    }
  }
  return out;
}

// ---------------------------------------------------------------- guessing the other side
/** What the other side might add this round with the gold it holds, from a balanced read of its roster. */
export function guessAdditions(side: Side, seen: Piece[], gold: number, supply: number, roster: UnitKind[], rng: Rng): Piece[] {
  const guess: Piece[] = seen.map((p) => ({ ...p }));
  const ai: AIProfile = { ...DEFAULT_AI, difficulty: 0.5 };
  let g = gold, id = -100;
  for (let k = 0; k < 8 && g >= 2 && guess.length < supply; k++) {
    const pool = roster.filter((x) => UNITS[x].cost <= g);
    if (!pool.length) break;
    const kind = pool[rng.weighted(pool.map((x) => valueOf(x, guess, [], ai)))];
    g -= UNITS[kind].cost;
    guess.push({ id: id--, kind, side, x: 0, y: 0, rank: 1, spent: UNITS[kind].cost });
  }
  const added = guess.filter((p) => p.id <= -100);
  if (added.length) {
    const lay = formation(side, added, [], ai, rng, 0.4);
    for (const l of lay) { const p = guess.find((q) => q.id === l.id)!; p.x = l.x; p.y = l.y; }
  }
  return guess;
}

// ---------------------------------------------------------------- planning
export interface PlanOpts {
  /** Override the number of candidates tested. */
  candidates?: number;
}

function scoreBattle(b: Battle, side: Side, goldLeft: number, ai: AIProfile): number {
  const r = b.run();
  const opp = (1 - side) as Side;
  let s = r.winner === side ? 100 : r.winner === -1 ? 0 : -100;
  s += (r.value[side] - r.value[opp]) * 7;
  s += (r.threat[side] - r.threat[opp]) * 1.5;
  if (r.winner === side) s += (b.limit - r.time) * 0.4;
  s += goldLeft * ai.economy * 1.2;
  return s;
}

/** The planner as a generator: it yields after each simulated test so a caller can keep the UI responsive. */
export function* planSteps(match: Match, side: Side, ai: AIProfile, opts: PlanOpts = {}): Generator<void, Plan> {
  const rng = new Rng(hashSeed(match.cfg.seed, "ai", side, match.round));
  const st = match.sides[side];
  const opp = (1 - side) as Side;
  const other = match.sides[opp];
  // 1. Reroll a weak shop (decided on the real shop, so the match state changes here).
  let rerolls = 0;
  const quality = () => Math.max(0, ...st.shop.map((k) => (k ? valueOf(k, st.pieces, other.seen, ai) / UNITS[k].cost : 0)));
  while (ai.difficulty >= 0.3 && rerolls < ai.rerolls && match.canReroll(side) && st.gold >= 4 && quality() < 1.15 - 0.2 * ai.economy) {
    match.reroll(side);
    rerolls++;
  }
  // 2. What it believes it will face.
  // Mines are buried: it knows how many it has met, not where they are now, so its test battles leave them out.
  const visible = other.seen.filter((p) => p.kind !== "mine");
  const theirs = ai.difficulty >= 0.55
    ? guessAdditions(opp, visible, other.gold, match.supplyCap(opp), other.roster, rng.fork(3))
    : visible.map((p) => ({ ...p }));
  const n = opts.candidates ?? Math.max(1, Math.round(1 + ai.difficulty * 15));
  const base: Draft = { gold: st.gold, pieces: st.pieces.map((p) => ({ ...p })), shop: [...st.shop], supply: match.supplyCap(side), shopFixed: !!match.cfg.fixedShop?.[side], round: match.round };
  const candidates: Plan[] = [];
  for (let c = 0; c < n; c++) {
    const crng = rng.fork(100 + c);
    // Candidate 0 is its honest best guess (sloppier the easier it is); the rest explore drafts and shapes.
    const temp = c === 0 ? (ai.difficulty < 0.5 ? (1 - ai.difficulty) * 0.9 : 0) : 0.25 + 0.5 * (c / n);
    const d = draft(base, theirs, ai, crng, temp, match.round);
    const shape: AIProfile = c === 0 ? ai : {
      ...ai,
      aggression: Math.max(0, Math.min(1, ai.aggression + crng.range(-0.3, 0.3))),
      spread: Math.max(0, Math.min(1, ai.spread + crng.range(-0.35, 0.35))),
    };
    const layout = formation(side, d.pieces, theirs, shape, crng, c === 0 ? 0.15 : 0.45);
    candidates.push({ rerolls, options: d.options, layout, score: 0, tested: 0, pieces: d.pieces, goldLeft: d.gold });
  }
  // 3. Test the candidates in simulation, the sharper the more of them.
  let chosen = candidates[0];
  if (ai.difficulty >= 0.2 && theirs.length > 0 && n > 1) {
    let best = -Infinity;
    for (const cand of candidates) {
      const pieces = cand.pieces.map((p) => {
        const l = cand.layout.find((x) => x.id === p.id)!;
        return { ...p, side, x: l.x, y: l.y };
      });
      const seeds = ai.difficulty > 0.75 ? 2 : 1;
      cand.score = 0;
      for (let k = 0; k < seeds; k++) {
        const b = new Battle([...pieces, ...theirs.map((p) => ({ ...p, side: opp }))], {
          seed: hashSeed(match.cfg.seed, "probe", match.round, k),
          obstacles: match.cfg.obstacles,
          mods: side === 0 ? [st.mods, other.mods] : [other.mods, st.mods],
          levels: match.cfg.levels,
          limit: 30,
        });
        cand.score += scoreBattle(b, side, cand.goldLeft, ai) / seeds;
      }
      cand.tested = seeds;
      if (cand.score > best) { best = cand.score; chosen = cand; }
      yield;
    }
    // A blunder now and then on the easier settings.
    if (rng.chance((1 - ai.difficulty) * 0.3)) chosen = candidates[rng.int(0, candidates.length - 1)];
  }
  return chosen;
}

export function planTurn(match: Match, side: Side, ai: AIProfile, opts: PlanOpts = {}): Plan {
  const g = planSteps(match, side, ai, opts);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

export async function planTurnAsync(match: Match, side: Side, ai: AIProfile, opts: PlanOpts & { tick?: () => Promise<void> } = {}): Promise<Plan> {
  const g = planSteps(match, side, ai, opts);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
    if (opts.tick) await opts.tick();
  }
}

/** Carries a plan out on the real match. */
export function applyPlan(match: Match, side: Side, plan: Plan) {
  const idMap = new Map<number, number>();
  let fresh = -1;
  for (const o of plan.options) {
    if (o.type === "buy") {
      const tmp = fresh--;
      const l = plan.layout.find((x) => x.id === tmp);
      const why = match.canBuy(side, o.slot!);
      if (why) continue;
      const p = match.buy(side, o.slot!, l?.x ?? W / 2, l?.y ?? toWorld(side, W / 2, 1).y);
      idMap.set(tmp, p.id);
    } else {
      const real = o.pieceId! < 0 ? idMap.get(o.pieceId!) : o.pieceId!;
      if (real !== undefined && !match.canUpgrade(side, real)) match.upgrade(side, real);
    }
  }
  for (const l of plan.layout) {
    const id = l.id < 0 ? idMap.get(l.id) : l.id;
    if (id === undefined) continue;
    try { match.move(side, id, l.x, l.y); } catch { /* sold or missing */ }
  }
}

/** Drafts a starting army worth about `budget` gold (Gauntlet opponents, campaign set pieces); ranks go up to `maxRank`
 * once the board is full (4 = Ascended, for armies that start late in a match). */
export function draftArmy(side: Side, budget: number, roster: UnitKind[], ai: AIProfile, seed: number, maxPieces = 12, maxRank = 3): Piece[] {
  const rng = new Rng(seed);
  const pieces: Piece[] = [];
  let g = budget, id = 1000;
  for (let k = 0; k < 30 && g >= 2; k++) {
    const pool = roster.filter((x) => UNITS[x].cost <= g);
    if (!pool.length) break;
    if (pieces.length >= maxPieces) {
      const up = pieces.filter((p) => p.rank < Math.min(maxRank, MAX_RANK) && upgradeCost(p.kind, p.rank) <= g);
      if (!up.length) break;
      const p = up[rng.int(0, up.length - 1)];
      g -= upgradeCost(p.kind, p.rank);
      p.spent += upgradeCost(p.kind, p.rank);
      p.rank++;
      continue;
    }
    const kind = pool[rng.weighted(pool.map((x) => valueOf(x, pieces, [], ai) / UNITS[x].cost))];
    g -= UNITS[kind].cost;
    pieces.push({ id: id++, kind, side, x: 0, y: 0, rank: 1, spent: UNITS[kind].cost });
  }
  const lay = formation(side, pieces, [], ai, rng, 0.3);
  for (const l of lay) { const p = pieces.find((q) => q.id === l.id)!; p.x = l.x; p.y = l.y; }
  return pieces;
}

export const ALL_KINDS = UNIT_KINDS;
