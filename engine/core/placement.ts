// Where a piece may stand in an arena: never overlapping a block. Shared by the match (buy, place, move), the AI's
// formations and any UI that wants to test or snap a spot before committing it.
import { UNITS, clampToZone, type Side, type UnitKind } from "./defs";
import { circleHitsBlock, type Block } from "./terrain";

/** The radius a placed piece needs clear of blocks: its body, or for a pack (Blade Trio) the whole triangle. */
export const footprint = (kind: UnitKind) => UNITS[kind].radius + ((UNITS[kind].bodies ?? 1) > 1 ? 0.32 : 0);

/** Does a piece of this kind placed at (x, y) overlap any block. */
export function spotBlocked(terrain: readonly Block[] | undefined, kind: UnitKind, x: number, y: number): boolean {
  if (!terrain?.length) return false;
  const r = footprint(kind) + 0.02;
  for (const b of terrain) if (circleHitsBlock(b, x, y, r)) return true;
  return false;
}

/**
 * The spot a piece of this kind takes when dropped at (x, y) on `side`: clamped into the side's deploy zone and, if a
 * block is in the way, nudged to the nearest free spot still inside the zone. Null when the zone has no free spot
 * within 7 units (it never happens on the built-in arenas). Without terrain this is exactly clampToZone.
 */
export function freeSpotIn(terrain: readonly Block[] | undefined, side: Side, kind: UnitKind, x: number, y: number): { x: number; y: number } | null {
  const r = UNITS[kind].radius;
  const p = clampToZone(side, x, y, r);
  if (!spotBlocked(terrain, kind, p.x, p.y)) return p;
  // Rings outward, straight back toward the side's own edge first, mirrored between the sides.
  const flip = side === 0 ? 1 : -1;
  for (let k = 1; k <= 70; k++) {
    const d = k * 0.1, n = 8 + 4 * k;
    for (let i = 0; i < n; i++) {
      const a = ((i % 2 ? -1 : 1) * Math.ceil(i / 2) * Math.PI * 2) / n;
      const cx = p.x + Math.sin(a) * d * flip, cy = p.y + Math.cos(a) * d * flip;
      const c = clampToZone(side, cx, cy, r);
      if (Math.abs(c.x - cx) > 1e-9 || Math.abs(c.y - cy) > 1e-9) continue; // outside the zone
      if (!spotBlocked(terrain, kind, cx, cy)) return { x: cx, y: cy };
    }
  }
  return null;
}
