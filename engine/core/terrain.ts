// Arena terrain: the walls, buildings, barricades, cover and water that Arena battles are fought around.
// This file is the contract between the sim (engine/core/battle.ts), the match and AI (placement), the Arena mode
// content (engine/core/arena.ts) and every frontend's renderer. Blocks are axis-aligned rectangles in world units
// (the board is W x H = 9 x 14, see defs.ts); (x, y) is the centre, w and h the full width (across) and depth.
//
// What each kind does:
//
//   kind        ground units   direct shots (arrow, bolt,   lobbed shots (grenade,   sight (who a unit    breaks
//                              shard, pellet), chains       shell), fliers, burrowers  may target)
//   wall        blocked        blocked                      pass over / under        blocked              never
//   building    blocked        blocked                      pass over / under        blocked              never
//   barricade   blocked        blocked                      pass over / under        blocked              yes (hp)
//   cover       blocked        pass; the shot is weakened   pass                     clear                yes (hp)
//   water       blocked        pass                         pass                     clear                never
//
// "building" behaves exactly like "wall"; it exists so a frontend can draw a house, tower or saloon instead of a
// length of wall. `look` is a free-form hint for frontends only (the sim never reads it).

export type BlockKind = "wall" | "building" | "barricade" | "cover" | "water";

export interface Block {
  /** Unique within its arena (stable across rounds; battle events refer to it). */
  id: number;
  kind: BlockKind;
  /** Centre, world units. */
  x: number;
  y: number;
  /** Full width (across the board) and depth (along it), world units. */
  w: number;
  h: number;
  /** Starting health for barricade and cover (defaults: BLOCK_HP). Ignored for the kinds that never break. */
  hp?: number;
  /** Frontend hint: which model to draw ("house", "tower", "crates", "fence", "pond"...). The sim never reads it. */
  look?: string;
}

/** Default health of the kinds that break. */
export const BLOCK_HP: Record<"barricade" | "cover", number> = { barricade: 320, cover: 160 };
/** Damage kept by a direct shot that crosses cover on its way to a target standing close behind it. */
export const COVER_KEEP = 0.6;
/** How close behind cover (edge to centre, world units) a target must stand for the cover to count. */
export const COVER_REACH = 0.9;

export const blocksGround = (_k: BlockKind) => true;
export const blocksShots = (k: BlockKind) => k === "wall" || k === "building" || k === "barricade";
export const blocksSight = blocksShots;
export const breakable = (k: BlockKind): k is "barricade" | "cover" => k === "barricade" || k === "cover";

/** A block as it stands during a battle: `hp` counts down for breakable kinds; `alive` false once it is rubble
 *  (rubble blocks nothing). The renderer reads these from Battle.blocks. */
export interface BlockState extends Block {
  maxHp: number;
  hp: number;
  alive: boolean;
}

export const blockLeft = (b: Block) => b.x - b.w / 2;
export const blockRight = (b: Block) => b.x + b.w / 2;
export const blockTop = (b: Block) => b.y - b.h / 2;
export const blockBottom = (b: Block) => b.y + b.h / 2;

/** Whether a circle (centre x, y, radius r) overlaps a block. */
export function circleHitsBlock(b: Block, x: number, y: number, r: number): boolean {
  const cx = Math.max(blockLeft(b), Math.min(blockRight(b), x));
  const cy = Math.max(blockTop(b), Math.min(blockBottom(b), y));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

/** Whether the segment (x0, y0) to (x1, y1) crosses a block (slab test). */
export function segmentHitsBlock(b: Block, x0: number, y0: number, x1: number, y1: number): boolean {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, d, lo, hi] of [[x0, dx, blockLeft(b), blockRight(b)], [y0, dy, blockTop(b), blockBottom(b)]] as const) {
    if (Math.abs(d) < 1e-12) { if (p < lo || p > hi) return false; continue; }
    let a = (lo - p) / d, c = (hi - p) / d;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return false;
  }
  return true;
}

/** The mirror image of a block for the other side of the board (arenas are built symmetric: 180-degree rotation
 *  about the board centre, so neither side gets the better ground). `W`, `H` are passed in to keep this file free of
 *  imports. */
export function mirrorBlock(b: Block, id: number, W: number, H: number): Block {
  return { ...b, id, x: W - b.x, y: H - b.y };
}
