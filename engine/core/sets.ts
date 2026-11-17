// Campaign set pieces: small designed places a campaign level is fought on, themed per act. Lighter than an arena
// (6-14 blocks) so the campaign stays readable, and built the same way: one half plus its mirror image, so neither
// side gets the better ground. A level names its set (`set` in campaign.ts); the level then carries the blocks as
// `terrain` and the decoration as `marks` (LevelDef in content.ts), and levelConfig passes the terrain to the match.
import type { TerrainRules } from "./arena";
import { layout, mark, mirrorMarks, prop, rect as r, type ArenaMark } from "./layout";
import type { Block } from "./terrain";

export interface SetDef {
  id: SetId;
  name: string;
  /** What the place is, in a line. */
  idea: string;
  /** Pass as MatchConfig.terrain (levelConfig does). Symmetric under a half turn about the board centre. */
  blocks: Block[];
  marks: ArenaMark[];
}
export type SetId = "farmstead" | "old-bridge" | "cinder-road" | "glade" | "lumber-camp" | "crags" | "toll-gate" | "keep-yard"
  | "frozen-camp" | "ruined-chapel" | "reed-marsh" | "wreck-beach" | "citadel-breach";

/** What a set must have (terrainIssues in arena.ts checks it): few blocks, most of each deploy zone free. */
export const SET_RULES: TerrainRules = { blocks: [6, 14], zoneFree: 0.85, road: false, cover: 0, brush: 1 };

const set = (id: SetId, name: string, idea: string, blocks: Block[], marks: ArenaMark[]): SetDef => ({ id, name, idea, blocks, marks: mirrorMarks(marks) });

const LIST: SetDef[] = [
  // ---- Act 1: The Borderlands
  set("farmstead", "Farmstead", "A cart track between two cornfields, a barn, a fence line and a haystack to shoot from.",
    layout(
      [
        r("brush", "cornfield", 0.25, 6.0, 1.75, 8.0),
        r("cover", "fence", 2.0, 7.9, 3.25, 8.3), r("cover", "haystack", 6.25, 8.5, 7.0, 9.0),
        r("building", "barn", 7.25, 10.5, 8.75, 11.75),
      ],
      [r("road", "road", 4.0, 3.0, 5.0, 11.0)],
    ),
    [prop("tree", -0.5, 9.5), prop("tree", 9.5, 9.0), prop("signpost", 5.1, 10.8), mark("door", 7.15, 10.9, 7.25, 11.4)]),
  set("old-bridge", "The Old Bridge", "A river and one wide stone bridge, reeds on the banks and crates on the quay.",
    layout(
      [
        r("water", "river", 0, 6.6, 3.0, 7.4),
        r("road", "road", 4.0, 7.75, 5.0, 10.5),
        r("brush", "reeds", 0.25, 7.6, 2.0, 8.3),
        r("cover", "crates", 6.25, 8.5, 7.25, 8.9),
      ],
      [r("road", "bridge-deck", 3.0, 6.25, 6.0, 7.75)],
    ),
    [mark("bridge", 3.0, 6.6, 6.0, 7.4), prop("lamp", 3.1, 7.9), prop("lamp", 5.9, 7.9), prop("tree", -0.5, 10.0), prop("tree", 9.5, 9.5)]),
  // ---- Act 2: Ash Fields
  set("cinder-road", "Cinder Road", "A burnt hamlet on the road: two gutted houses, a cart, a fence and scrub that grew back.",
    layout(
      [
        r("building", "ruin", 5.75, 7.0, 6.75, 8.0),
        r("cover", "cart", 1.0, 8.5, 1.75, 9.0), r("cover", "fence", 5.5, 9.0, 6.5, 9.4),
        r("brush", "brush", 7.25, 8.0, 8.75, 9.25),
      ],
      [r("road", "road", 4.0, 2.5, 5.0, 11.5)],
    ),
    [prop("signpost", 3.9, 9.0), prop("tree", -0.5, 8.5), prop("tree", 9.5, 11.0), prop("lamp", 5.1, 8.0)]),
  // ---- Act 3: The Hollow Wood
  set("glade", "The Glade", "A forest path through a clearing: two mossy crags, a fallen trunk and deep thickets either side.",
    layout(
      [
        r("building", "rock", 2.0, 6.5, 3.0, 7.5),
        r("barricade", "logs", 5.25, 8.25, 6.75, 8.65),
        r("brush", "brush", 0.25, 7.6, 1.75, 9.25), r("brush", "brush", 7.0, 8.75, 8.75, 10.25),
      ],
      [r("road", "road", 4.0, 3.0, 5.0, 11.0)],
    ),
    [prop("tree", 0.6, 8.0), prop("tree", 1.3, 8.9), prop("tree", 7.6, 9.2), prop("tree", 8.4, 9.9), prop("tree", -0.5, 11.0), prop("tree", 9.5, 12.0), prop("tree", -0.4, 7.2)]),
  set("lumber-camp", "Lumber Camp", "A felling camp: log piles across the middle, a sawyer's hut, crates of tools and uncut brush.",
    layout(
      [
        r("barricade", "logs", 1.75, 6.7, 3.25, 7.3),
        r("building", "house", 0.5, 9.5, 1.75, 10.75),
        r("cover", "crates", 5.5, 8.5, 6.5, 8.9),
        r("brush", "brush", 7.0, 7.6, 8.75, 8.75),
      ],
      [r("road", "road", 4.0, 3.0, 5.0, 11.0)],
    ),
    [prop("tree", 7.5, 8.0), prop("tree", 8.4, 8.5), prop("tree", -0.5, 8.5), prop("tree", 9.5, 10.5), mark("door", 1.75, 9.9, 1.85, 10.4), prop("signpost", 5.1, 10.8)]),
  // ---- Act 4: Iron Pass
  set("crags", "The Narrows", "Crags close in from both sides and leave one track up the middle, with scrub under the rock.",
    layout(
      [
        r("building", "rock", 0, 6.0, 1.5, 7.25), r("building", "rock", 0, 7.25, 1.0, 8.5),
        r("cover", "sandbags", 2.75, 8.4, 3.75, 8.8),
        r("brush", "brush", 1.0, 7.6, 2.25, 8.75),
      ],
      [r("road", "road", 4.0, 3.0, 5.0, 11.0)],
    ),
    [prop("tree", -0.5, 9.5), prop("tree", 9.5, 10.0), prop("signpost", 5.1, 8.2)]),
  set("toll-gate", "Toll Gate", "A palisade across the pass between two crags: the gate in the middle, a track either side.",
    layout(
      [
        r("building", "rock", 0, 6.25, 1.5, 7.75),
        r("wall", "palisade", 2.75, 6.75, 3.75, 7.25),
        r("cover", "sandbags", 2.5, 8.4, 3.5, 8.8),
        r("brush", "brush", 0.25, 8.0, 1.5, 9.25),
      ],
      [r("road", "road", 4.0, 3.0, 5.0, 11.0)],
    ),
    [mark("gate", 3.75, 6.75, 5.25, 7.25), prop("banner", 3.8, 7.5), prop("lamp", 5.2, 7.5), prop("tree", 9.5, 9.0)]),
  // ---- Act 5: The High Keep
  set("keep-yard", "The Breach", "The keep's outer wall, breached in the middle round a fallen statue, with a paved yard behind.",
    layout(
      [
        r("wall", "wall", 0.75, 6.75, 2.75, 7.25),
        r("road", "plaza", 3.0, 7.5, 6.0, 9.0),
        r("cover", "sandbags", 1.0, 8.25, 2.0, 8.65),
        r("brush", "brush", 7.0, 8.5, 8.5, 9.75),
      ],
      [r("building", "statue", 4.25, 6.75, 4.75, 7.25)],
    ),
    [prop("banner", 0.9, 7.5), prop("banner", 2.6, 7.5), prop("lamp", 3.1, 9.1), prop("lamp", 5.9, 9.1), prop("tree", 7.6, 9.1)]),
  // ---- Act 6: The Frozen Reach
  set("frozen-camp", "Frozen Camp", "A winter camp round a frozen pool: two ice-bound crags, trodden paths, supply crates, frosted scrub.",
    layout(
      [
        r("building", "rock", 1.25, 6.6, 2.25, 7.4),
        r("road", "road", 2.5, 5.0, 3.5, 9.0),
        r("cover", "crates", 0.5, 8.5, 1.5, 8.9),
        r("brush", "brush", 7.25, 9.0, 8.75, 10.25),
      ],
      [r("water", "pond", 3.75, 6.5, 5.25, 7.5)],
    ),
    [prop("tree", -0.5, 9.0), prop("tree", 9.5, 8.0), prop("lamp", 3.6, 8.9), prop("banner", 0.4, 8.3)]),
  // ---- Act 7: The Sky Throne
  set("ruined-chapel", "Ruined Chapel", "A roofless chapel in the middle, toppled columns, a processional way either side and an overgrown yard.",
    layout(
      [
        r("building", "statue", 6.5, 7.25, 7.0, 7.75),
        r("road", "road", 2.75, 4.0, 3.75, 10.0),
        r("cover", "fence", 6.5, 8.6, 7.5, 9.0),
        r("brush", "brush", 0.25, 8.5, 1.75, 9.75),
      ],
      [r("building", "ruin", 4.0, 6.5, 5.0, 7.5)],
    ),
    [prop("lamp", 3.85, 8.0), prop("banner", 4.5, 7.7), prop("tree", 0.9, 9.1), prop("tree", -0.5, 11.0), mark("door", 4.3, 7.5, 4.7, 7.6)]),
  // ---- Act 8: The Mirelight Fen
  set("reed-marsh", "Reed Marsh", "A boardwalk across the fen between two pools, reed beds on every shore, a stack of barrels.",
    layout(
      [
        r("water", "pond", 1.25, 6.5, 2.75, 7.5),
        r("brush", "reeds", 2.75, 6.4, 3.5, 7.6), r("brush", "reeds", 0.25, 7.6, 1.25, 9.0),
        r("cover", "barrels", 6.0, 8.5, 6.9, 8.9),
      ],
      [r("road", "bridge-deck", 3.5, 3.0, 5.5, 11.0)],
    ),
    [prop("lamp", 3.4, 8.0), prop("lamp", 5.6, 10.8), prop("tree", -0.5, 10.0), prop("tree", 9.5, 9.0)]),
  // ---- Act 9: The Saltwind Coast
  set("wreck-beach", "Wreckers' Beach", "A wreck's ribs across the sand, sea-rocks, a tide pool, salvage crates and dune grass.",
    layout(
      [
        r("building", "rock", 0.75, 6.25, 1.75, 7.25),
        r("water", "pond", 6.5, 9.0, 7.5, 9.75),
        r("cover", "crates", 2.25, 9.0, 3.25, 9.4),
        r("brush", "brush", 0.25, 8.75, 2.0, 10.0),
      ],
      [r("barricade", "wagon", 3.75, 6.75, 5.25, 7.25)],
    ),
    [prop("lamp", 2.1, 8.9), prop("signpost", 7.7, 9.9), prop("tree", -0.5, 11.5), prop("banner", 4.5, 7.4)]),
  // ---- Act 10: Crownfall Citadel
  set("citadel-breach", "The Broken Gate", "The citadel's curtain wall, fallen in three places, a paved court behind and rubble to hide in.",
    layout(
      [
        r("wall", "wall", 0, 6.75, 1.25, 7.25), r("building", "ruin", 2.5, 6.5, 3.5, 7.5),
        r("cover", "sandbags", 1.5, 8.5, 2.5, 8.9),
        r("brush", "brush", 7.0, 9.0, 8.5, 10.25),
      ],
      [r("road", "plaza", 3.5, 4.5, 5.5, 9.5)],
    ),
    [mark("gate", 3.5, 6.75, 5.5, 7.25), prop("banner", 3.4, 7.7), prop("banner", 5.6, 7.7), prop("lamp", 3.4, 9.4), prop("lamp", 5.6, 9.4)]),
];

/** The set pieces by id. */
export const SETS = Object.fromEntries(LIST.map((s) => [s.id, s])) as Record<SetId, SetDef>;
export const setById = (id: string): SetDef | undefined => (SETS as Record<string, SetDef | undefined>)[id];
