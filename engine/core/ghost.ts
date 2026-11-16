// Match records: what a finished match was fought with, round by round, in a compact JSON-safe form, and the replay
// that checks one. The backend (infra/src/arena.ts) issues an Arena match, the client plays it and sends the record
// back, and replayArena() re-fights every round here before any trophies move. Nothing the client says about who won
// is used: the winner is whatever the engine makes of the recorded boards.
//
// Pure and deterministic: no DOM, no Math.random, no time. Coordinates are JSON numbers, which round-trip doubles
// exactly, so a replay is bit-identical to the battle the player watched.
import {
  ASCEND_ROUND, GOLD_CAP, MAX_RANK, UNITS, clampToZone, incomeFor, upgradeCost,
  type Piece, type Side, type UnitKind,
} from "./defs";
import { Match, interestFor, type MatchConfig } from "./match";
import { spotBlocked } from "./placement";

/** Bumped when the encoding changes; decodeRecord refuses versions it does not know. */
export const RECORD_VERSION = 1;
/** Limits on what a record may hold (a real Arena match ends well inside them). */
export const RECORD_MAX_ROUNDS = 60;
export const RECORD_MAX_PIECES = 40;

/** One piece: [id, index into `kinds`, x, y, rank]. */
export type RecordPiece = [number, number, number, number, number];
/** One round: [round number, side 0's pieces, side 1's pieces], each in the order the battle received them. */
export type RecordRound = [number, RecordPiece[], RecordPiece[]];
export interface MatchRecord {
  v: number;
  /** The unit kinds the record uses; pieces refer to them by index. */
  kinds: UnitKind[];
  rounds: RecordRound[];
}
export interface RoundBoard { round: number; pieces: Piece[]; }

/** The least gold a piece of this kind and rank has cost: bought once, then upgraded rank by rank. */
export function pieceCost(kind: UnitKind, rank: number): number {
  let cost = UNITS[kind].cost;
  for (let r = 1; r < rank; r++) cost += upgradeCost(kind, r);
  return cost;
}

/** A match's log (Match.log) as a record. */
export function encodeRecord(match: { log: readonly RoundBoard[] }): MatchRecord {
  const kinds: UnitKind[] = [];
  const enc = (p: Piece): RecordPiece => {
    let k = kinds.indexOf(p.kind);
    if (k < 0) k = kinds.push(p.kind) - 1;
    return [p.id, k, p.x, p.y, p.rank];
  };
  const rounds = match.log.map((e): RecordRound => [e.round, e.pieces.filter((p) => p.side === 0).map(enc), e.pieces.filter((p) => p.side === 1).map(enc)]);
  return { v: RECORD_VERSION, kinds, rounds };
}

const int = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);
const num = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/**
 * A record back as boards (side 0's pieces then side 1's, as Match passes them to a battle), or null when it is not a
 * well-formed record. Takes anything: this is where untrusted input enters. It checks shape only (types, sizes, known
 * kinds); whether the boards are legal is replayArena's job. `spent` is not recorded (battles never read it) and comes
 * back as pieceCost().
 */
export function decodeRecord(raw: unknown): RoundBoard[] | null {
  const r = raw as Partial<MatchRecord> | null;
  if (!r || typeof r !== "object" || r.v !== RECORD_VERSION || !Array.isArray(r.kinds) || !Array.isArray(r.rounds)) return null;
  if (r.rounds.length > RECORD_MAX_ROUNDS || r.kinds.length > 200) return null;
  const kinds = r.kinds;
  if (!kinds.every((k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(UNITS, k))) return null;
  const out: RoundBoard[] = [];
  for (const row of r.rounds) {
    if (!Array.isArray(row) || row.length !== 3 || !int(row[0]) || row[0] < 1) return null;
    const pieces: Piece[] = [];
    for (const side of [0, 1] as Side[]) {
      const list = row[side + 1];
      if (!Array.isArray(list) || list.length > RECORD_MAX_PIECES) return null;
      for (const p of list as unknown[]) {
        if (!Array.isArray(p) || p.length !== 5) return null;
        const [id, k, x, y, rank] = p as unknown[];
        if (!int(id) || id < 1 || !int(k) || k < 0 || k >= kinds.length || !num(x) || !num(y) || !int(rank) || rank < 1 || rank > MAX_RANK) return null;
        pieces.push({ id, kind: kinds[k], side, x, y, rank, spent: pieceCost(kinds[k], rank) });
      }
    }
    out.push({ round: row[0], pieces });
  }
  return out;
}

/**
 * The most gold side 0 can have been paid by the end of `round`'s deploy phase, and so the most its board can have
 * cost. Derived from the match's own economy: the starting and carried gold, plus for every round so far the round's
 * income (incomeFor), the largest interest there is (interestFor at the gold cap) and any flat income bonus. It is an
 * upper bound, not the exact figure: it assumes full interest from round 1 and that no gold was ever lost to rerolls,
 * the gold cap or selling at half price, so an honest board is always inside it (a player who banks perfectly comes
 * close, most sit at about two thirds). With `fixedGold` (puzzles) that gold is all there ever is.
 */
export function goldBound(cfg: MatchConfig, round: number): number {
  const fixed = cfg.fixedGold?.[0];
  if (fixed !== undefined) return fixed;
  let gold = (cfg.startGold?.[0] ?? 0) + (cfg.carryGold ?? 0);
  const bonus = (cfg.income?.[0] ?? 0) + (cfg.mods?.[0]?.income ?? 0);
  for (let r = cfg.firstRound ?? 1; r <= round; r++) gold += incomeFor(r) + interestFor(GOLD_CAP) + bonus;
  return gold;
}

export type ReplayResult =
  | { ok: true; winner: -1 | 0 | 1; rounds: number; hp: [number, number] }
  | { ok: false; reason: string };

/**
 * Re-fights a recorded match. Builds the match from `cfg`, and for each recorded round checks both boards, sets them
 * as that round's pieces and lets Match fight it headless (same battle seeds, same damage rules), then moves to the
 * next round. A board is legal when: every kind is in that side's roster; ranks are 1..MAX_RANK, with rank 4 only
 * from ASCEND_ROUND; ids are unique; every piece stands inside its own deploy zone and on no block; the side is
 * within the round's supply; and side 0's board costs no more than goldBound() allows. The record must cover the match
 * exactly: rounds in order from the first, ending with the round that decided it.
 *
 * What this does not check: that side 0's exact purchases were on offer in its shops, or that side 1's boards are the
 * ones its AI would have built (see infra/README.md).
 */
export function replayArena(cfg: MatchConfig, record: unknown): ReplayResult {
  const rounds = decodeRecord(record);
  if (!rounds) return { ok: false, reason: "malformed" };
  if (!rounds.length) return { ok: false, reason: "empty" };
  const m = new Match(cfg);
  for (const board of rounds) {
    if (m.phase === "over") return { ok: false, reason: "trailing_rounds" };
    if (board.round !== m.round) return { ok: false, reason: "round_order" };
    const ids = new Set<number>();
    for (const s of [0, 1] as Side[]) {
      const mine = board.pieces.filter((p) => p.side === s);
      if (mine.length > m.supplyCap(s)) return { ok: false, reason: `supply:${board.round}:${s}` };
      let cost = 0;
      for (const p of mine) {
        const at = `${board.round}:${s}:${p.id}`;
        if (ids.has(p.id)) return { ok: false, reason: `duplicate_id:${at}` };
        ids.add(p.id);
        if (!m.sides[s].roster.includes(p.kind)) return { ok: false, reason: `roster:${at}` };
        if (p.rank >= MAX_RANK && board.round < ASCEND_ROUND) return { ok: false, reason: `rank:${at}` };
        const z = clampToZone(s, p.x, p.y, UNITS[p.kind].radius);
        if (Math.abs(z.x - p.x) > 1e-6 || Math.abs(z.y - p.y) > 1e-6) return { ok: false, reason: `zone:${at}` };
        if (spotBlocked(cfg.terrain, p.kind, p.x, p.y)) return { ok: false, reason: `blocked:${at}` };
        cost += p.spent;
      }
      if (s === 0 && cost > goldBound(cfg, board.round)) return { ok: false, reason: `gold:${board.round}` };
      m.sides[s].pieces = mine;
    }
    m.fight();
    m.next();
  }
  if (m.phase !== "over" || m.winner === null) return { ok: false, reason: "unfinished" };
  return { ok: true, winner: m.winner, rounds: m.played, hp: [m.sides[0].hp, m.sides[1].hp] };
}
