// Building blocks for designed maps (the arenas in arena.ts, the campaign sets in sets.ts): the looks a block may carry,
// decoration marks, and helpers that write a map as one half plus its mirror image.
import { H, W } from "./defs";
import { mirrorBlock, type Block, type BlockKind } from "./terrain";

/**
 * The `look` hints blocks use (frontends pick a model per hint; unknown hints fall back on the kind). By kind:
 *   wall        wall (masonry), palisade (timber stakes), hedge-wall (a tall clipped hedge)
 *   building    house, hall, tower, barn, shop, chapel, mill, gatehouse, ruin, rock (a crag), well, statue
 *   barricade   barricade (timber), logs (a log jam), wagon (an overturned wagon)
 *   cover       crates, fence, sandbags, barrels, haystack, stall (a market stall), cart
 *   water       pond, river, fountain
 *   road        road, bridge-deck, plaza
 *   brush       brush (tall grass), reeds, orchard, cornfield
 */
export const LOOKS_BY_KIND = {
  wall: ["wall", "palisade", "hedge-wall"],
  building: ["house", "hall", "tower", "barn", "shop", "chapel", "mill", "gatehouse", "ruin", "rock", "well", "statue"],
  barricade: ["barricade", "logs", "wagon"],
  cover: ["crates", "fence", "sandbags", "barrels", "haystack", "stall", "cart"],
  water: ["pond", "river", "fountain"],
  road: ["road", "bridge-deck", "plaza"],
  brush: ["brush", "reeds", "orchard", "cornfield"],
} as const satisfies Record<BlockKind, readonly string[]>;
export type BlockLook = (typeof LOOKS_BY_KIND)[BlockKind][number];

/**
 * Decoration for a frontend. The sim never reads these.
 *   gate, bridge, door              a rectangle (x, y the centre; w, h its size): an opening in a wall, a crossing, a doorway
 *   tree, lamp, banner, signpost    a point (x, y; w and h are 0), which may sit just off the board (x -1..10, y -1..15)
 */
export interface ArenaMark { look: "gate" | "bridge" | "tree" | "lamp" | "banner" | "door" | "signpost"; x: number; y: number; w: number; h: number; }

export type Rect = Omit<Block, "id">;
/** A block from its edges: left, top, right, bottom. */
export const rect = <K extends BlockKind>(kind: K, look: (typeof LOOKS_BY_KIND)[K][number], x0: number, y0: number, x1: number, y1: number, hp?: number): Rect =>
  ({ kind, look, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, ...(hp ? { hp } : {}) });
/** A rectangular mark from its edges. */
export const mark = (look: "gate" | "bridge" | "door", x0: number, y0: number, x1: number, y1: number): ArenaMark =>
  ({ look, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });
/** A point mark. */
export const prop = (look: "tree" | "lamp" | "banner" | "signpost", x: number, y: number): ArenaMark => ({ look, x, y, w: 0, h: 0 });
/** Every block in `half` plus its mirror image (a half turn about the board centre), then the `centre` blocks, which
 * must be centred on the board (they are their own mirror). */
export function layout(half: Rect[], centre: Rect[] = []): Block[] {
  const out: Block[] = [];
  for (const b of half) {
    out.push({ ...b, id: out.length + 1 });
    out.push(mirrorBlock(out[out.length - 1], out.length + 1, W, H));
  }
  for (const b of centre) out.push({ ...b, id: out.length + 1 });
  return out;
}
/** Each mark plus its mirror image (one centred on the board is its own). */
export const mirrorMarks = (half: ArenaMark[]): ArenaMark[] => half.flatMap((m) => (m.x === W / 2 && m.y === H / 2 ? [m] : [m, { ...m, x: W - m.x, y: H - m.y }]));
