// Arena mode: the same match loop as the rest of the game (buy, place, watch the battle, lose health on a lost
// round), fought on maps with real structure against AI opponents on a trophy ladder.
//
// This file is content and rules only: the twelve arenas (each a designed place: roads, buildings, cover and brush),
// the checks a designed map must pass (terrainIssues), the four leagues, the opponents, trophy maths and the
// MatchConfig builder. Everything is a pure function over plain data. The device save binding and the rewards live
// beside the other modes' in engine/progression/troops.ts (arenaLadder, nextArenaMatch, awardArena).
// The terrain rules themselves are in terrain.ts (contract), nav.ts and battle.ts; docs/ARENA.md has the lot.
import { TACTICS, type AIProfile, type Tactic } from "./ai";
import { rosterAt } from "./campaign";
import { H, START_HP, UNITS, UNIT_KINDS, W, ZONE_DEPTH, type UnitKind } from "./defs";
import { MAX_LEVEL, uniformLevels, type Levels } from "./levels";
import type { MatchConfig } from "./match";
import { Nav } from "./nav";
import { Rng, hashSeed } from "./rng";
import { LOOKS_BY_KIND, layout, mark, mirrorMarks, prop, rect, type ArenaMark, type BlockLook } from "./layout";
import { isZone, type Block } from "./terrain";

// ---------------------------------------------------------------- arenas
export { LOOKS_BY_KIND, layout, mark, mirrorMarks, prop, rect, type ArenaMark, type BlockLook, type Rect } from "./layout";
/** Every `look` hint a block may carry (LOOKS_BY_KIND in layout.ts has them by kind). */
export type ArenaLook = BlockLook;
export const ARENA_LOOKS: ArenaLook[] = Object.values(LOOKS_BY_KIND).flat();

export interface ArenaDef {
  /** Stable id (saved per-arena wins are keyed by it). */
  id: string;
  name: string;
  /** One line for the arena card. */
  blurb: string;
  /** What the place is and how it plays, for docs and a longer card. */
  idea: string;
  /** The league it is played in, 1..4. */
  league: number;
  /** The terrain: pass as MatchConfig.terrain / BattleOptions.terrain. Symmetric under a half turn about the board centre. */
  blocks: Block[];
  marks: ArenaMark[];
}

const r = rect, marks = mirrorMarks;

/**
 * The twelve arenas, three to a league. Side 0 deploys in y 7.6..13.5 (bottom), side 1 in y 0.5..6.4 (top). Each is
 * a place: a road that joins the two sides, buildings and walls that make routes, cover to shoot from and brush to
 * lie in wait in. The `half` lists are side 0's (bottom) half; `layout` adds the mirror image.
 */
export const ARENAS: ArenaDef[] = [
  // ---- League 1
  {
    id: "twin-gates", name: "Twin Gates", league: 1,
    blurb: "A curtain wall with two gates and a road through each. Hold one, force the other.",
    idea: "A border wall with a pair of guard towers in the middle and a gate either side. A road runs through each gate: quick, and watched. Sandbags flank the gates, a barracks stands behind the right one, and the orchard and the long grass by the wall hide whoever waits for the gate to be forced.",
    blocks: layout(
      [
        r("wall", "wall", 0, 6.75, 1.5, 7.25), r("building", "tower", 3.25, 6.5, 4.0, 7.5),
        r("road", "road", 1.75, 3.0, 3.0, 11.0),
        r("cover", "sandbags", 0.5, 8.25, 1.5, 8.65), r("cover", "sandbags", 3.25, 8.25, 4.25, 8.65), r("cover", "barrels", 7.6, 8.6, 8.4, 9.0),
        r("brush", "orchard", 0.25, 9.5, 1.5, 11.5), r("brush", "brush", 7.5, 7.6, 8.75, 8.4),
        r("building", "house", 6.0, 11.5, 7.5, 12.75),
      ],
      [r("wall", "wall", 4.0, 6.75, 5.0, 7.25)],
    ),
    marks: marks([mark("gate", 1.5, 6.75, 3.25, 7.25), prop("banner", 3.6, 7.6), prop("lamp", 1.6, 7.5), prop("lamp", 3.15, 7.5), prop("tree", 0.5, 10.0), prop("tree", 1.1, 11.0), prop("tree", -0.5, 12.5), prop("signpost", 3.2, 10.8), mark("door", 6.5, 11.4, 7.0, 11.5)]),
  },
  {
    id: "the-crossing", name: "The Crossing", league: 1,
    blurb: "A river, two bridges and reeds on both banks. Arrows cross the water; boots need a bridge.",
    idea: "A river town's crossing: two timber bridges with a road over each, a ferryman's house, crates on the quay. Shots fly over the water, but the reeds along the banks hide whoever stands in them, so a firing line on the bank is not the free win it looks.",
    blocks: layout(
      [
        r("water", "river", 0, 6.5, 1.5, 7.5),
        r("road", "bridge-deck", 1.5, 6.25, 3.25, 7.75),
        r("road", "road", 1.75, 7.75, 3.0, 10.5), r("road", "road", 6.0, 7.75, 7.25, 10.5),
        r("brush", "reeds", 3.25, 7.6, 5.75, 8.3), r("brush", "reeds", 0, 7.6, 1.4, 8.4),
        r("building", "house", 0.25, 9.0, 1.5, 10.25),
        r("cover", "crates", 3.75, 9.0, 5.25, 9.4), r("cover", "barrels", 7.6, 8.75, 8.5, 9.15),
      ],
      [r("water", "river", 3.25, 6.5, 5.75, 7.5)],
    ),
    marks: marks([mark("bridge", 1.5, 6.5, 3.25, 7.5), prop("lamp", 1.6, 7.9), prop("lamp", 3.15, 7.9), prop("signpost", 3.2, 10.3), prop("tree", 8.6, 11.0), prop("tree", -0.4, 11.5), prop("tree", 9.5, 9.5), mark("door", 1.5, 9.4, 1.6, 9.9)]),
  },
  {
    id: "crate-yard", name: "Market Square", league: 1,
    blurb: "A market round a fountain: stalls for cover, two lanes through, shops on the corners.",
    idea: "Market day. A fountain in the middle with a paved lane either side of it, stalls and crates scattered through the square to shoot from (or smash), a shop on each corner, and an orchard and a patch of long grass on the flanks for anyone who would rather not be seen crossing.",
    blocks: layout(
      [
        r("road", "road", 2.75, 2.5, 3.75, 11.5),
        r("road", "plaza", 3.75, 7.5, 5.25, 8.75),
        r("cover", "stall", 1.25, 8.2, 2.5, 8.7), r("cover", "stall", 6.5, 9.2, 7.75, 9.7), r("cover", "crates", 3.9, 10.6, 5.1, 11.1),
        r("building", "shop", 0, 11.75, 1.5, 13.0), r("building", "shop", 7.25, 11.5, 8.75, 12.75),
        r("brush", "orchard", 0.25, 9.25, 1.75, 10.75), r("brush", "brush", 7.5, 7.6, 8.75, 8.6),
      ],
      [r("water", "fountain", 4.0, 6.5, 5.0, 7.5)],
    ),
    marks: marks([prop("lamp", 2.6, 8.0), prop("lamp", 6.4, 8.0), prop("banner", 3.8, 10.4), prop("tree", 0.6, 9.6), prop("tree", 1.3, 10.4), prop("tree", -0.5, 8.5), prop("signpost", 3.85, 11.4), mark("door", 1.5, 12.1, 1.6, 12.6), mark("door", 7.15, 11.9, 7.25, 12.4)]),
  },
  // ---- League 2
  {
    id: "courtyard", name: "The Courtyard", league: 2,
    blurb: "A manor hall in a walled yard. Two lanes pass it; the garden hides the rest.",
    idea: "A manor's forecourt. The hall fills the middle, so the fight goes round it down two paved lanes past a pair of statues. Each side has a yard wall with a wide gate, a fence and barrels to shoot from, and a garden inside the wall and an orchard outside it to lie in wait in.",
    blocks: layout(
      [
        r("wall", "wall", 1.25, 9.0, 2.75, 9.5), r("wall", "wall", 6.25, 9.0, 7.75, 9.5),
        r("building", "statue", 2.0, 6.75, 2.5, 7.25),
        r("road", "road", 2.75, 3.5, 3.75, 10.5),
        r("road", "plaza", 3.75, 7.75, 5.25, 9.0),
        r("cover", "fence", 4.0, 10.5, 5.0, 10.9), r("cover", "barrels", 1.5, 9.75, 2.5, 10.15), r("cover", "crates", 7.0, 10.5, 8.0, 10.9),
        r("brush", "brush", 1.25, 7.6, 2.5, 8.6), r("brush", "orchard", 6.25, 11.25, 8.0, 12.75),
      ],
      [r("building", "hall", 3.75, 6.25, 5.25, 7.75)],
    ),
    marks: marks([mark("gate", 2.75, 9.0, 6.25, 9.5), mark("door", 4.2, 7.75, 4.8, 7.85), prop("lamp", 2.85, 9.65), prop("lamp", 6.15, 9.65), prop("banner", 4.5, 7.9), prop("tree", 6.6, 11.6), prop("tree", 7.6, 12.3), prop("tree", 9.5, 11.0), prop("tree", -0.5, 9.0)]),
  },
  {
    id: "watchtowers", name: "Watchtowers", league: 2,
    blurb: "A border post: two towers a side, a road up the middle and long grass in no man's land.",
    idea: "Two border posts facing each other. Each has a pair of watchtowers joined by a palisade with the road running through the gap, a fence either side of the road and sandbags on the flank. Between the posts the road is open ground under every bow; the long grass either side of it is slower and unseen.",
    blocks: layout(
      [
        r("building", "tower", 1.5, 8.75, 2.5, 9.75), r("building", "tower", 6.5, 8.75, 7.5, 9.75),
        r("wall", "palisade", 2.5, 9.0, 3.25, 9.5), r("wall", "palisade", 5.75, 9.0, 6.5, 9.5),
        r("cover", "fence", 2.75, 8.1, 3.75, 8.5), r("cover", "fence", 5.25, 8.1, 6.25, 8.5),
        r("cover", "sandbags", 0.25, 11.25, 1.25, 11.65), r("cover", "haystack", 7.75, 11.25, 8.5, 11.75),
        r("brush", "brush", 6.0, 6.6, 8.75, 7.4), r("brush", "brush", 0.25, 7.6, 1.75, 8.5),
      ],
      [r("road", "road", 4.0, 2.0, 5.0, 12.0)],
    ),
    marks: marks([mark("gate", 3.25, 9.0, 5.75, 9.5), prop("banner", 2.0, 8.6), prop("banner", 7.0, 8.6), prop("lamp", 3.4, 9.7), prop("lamp", 5.6, 9.7), prop("signpost", 5.15, 11.8), prop("tree", -0.5, 10.0), prop("tree", 9.5, 12.0), prop("tree", 9.4, 8.0)]),
  },
  {
    id: "barricade-pass", name: "Barricade Pass", league: 2,
    blurb: "Crags close the pass but for one gate and two barricaded tracks that siege can open.",
    idea: "A toll gate in a mountain pass. Crags run right across; the road goes through the one gate, and the two side tracks are stopped with timber barricades until something heavy breaks them. Sandbags guard the gate, a toll house stands behind it, and there is long grass behind the right-hand barricade for whoever expects company.",
    blocks: layout(
      [
        r("building", "rock", 0, 6.5, 0.75, 7.5), r("barricade", "barricade", 0.75, 6.75, 2.5, 7.25), r("building", "rock", 2.5, 6.5, 3.75, 7.5),
        r("cover", "sandbags", 2.5, 8.75, 3.5, 9.15), r("cover", "sandbags", 5.5, 8.75, 6.5, 9.15), r("cover", "crates", 1.0, 9.5, 2.0, 9.9),
        r("brush", "brush", 6.5, 7.6, 8.25, 8.6), r("brush", "brush", 0.25, 10.5, 1.5, 12.0),
        r("building", "house", 6.75, 10.25, 8.0, 11.5),
      ],
      [r("road", "road", 4.0, 3.0, 5.0, 11.0)],
    ),
    marks: marks([mark("gate", 3.75, 6.75, 5.25, 7.25), prop("banner", 3.8, 7.6), prop("lamp", 5.2, 7.6), prop("signpost", 5.15, 10.8), prop("tree", -0.6, 9.0), prop("tree", 9.5, 9.5), prop("tree", 0.7, 11.3), mark("door", 6.65, 10.6, 6.75, 11.1)]),
  },
  // ---- League 3
  {
    id: "old-village", name: "Old Village", league: 3,
    blurb: "A main street, a well in the square, houses and alleys. Lines break up; ambushers thrive.",
    idea: "A village on a crossroads. The main street runs end to end through a little square with a well; houses, a shop and a barn stand off it and make alleys, one of them too narrow for anything big and deep in shadow. Market stalls line the street for cover and there is an orchard on the green.",
    blocks: layout(
      [
        r("road", "road", 4.0, 7.75, 5.0, 13.0),
        r("road", "plaza", 3.0, 6.0, 4.25, 8.0),
        r("building", "house", 0.75, 8.75, 2.5, 10.25), r("building", "house", 6.25, 9.5, 7.75, 11.0),
        r("building", "shop", 1.75, 6.25, 3.0, 7.5), r("building", "barn", 0.75, 11.5, 2.5, 12.75),
        r("cover", "stall", 3.0, 8.5, 3.9, 8.9), r("cover", "stall", 5.1, 8.5, 6.0, 8.9), r("cover", "cart", 5.25, 11.75, 6.0, 12.25),
        r("brush", "brush", 7.75, 9.5, 9.0, 11.0), r("brush", "orchard", 0.25, 7.6, 1.5, 8.6),
      ],
      [r("building", "well", 4.25, 6.75, 4.75, 7.25)],
    ),
    marks: marks([prop("lamp", 3.9, 8.3), prop("lamp", 5.1, 9.2), prop("signpost", 5.1, 7.9), prop("tree", 0.6, 8.0), prop("tree", 1.2, 8.3), prop("tree", -0.5, 11.0), prop("tree", 9.5, 12.5), mark("door", 2.5, 9.2, 2.6, 9.8), mark("door", 6.15, 10.0, 6.25, 10.6), mark("door", 2.5, 11.9, 2.6, 12.4), prop("banner", 3.1, 7.6)]),
  },
  {
    id: "the-fens", name: "The Fens", league: 3,
    blurb: "Ponds, reed beds and a boardwalk round the mere. Shots fly over the water; boots go round.",
    idea: "Marshland. A mere in the middle with a boardwalk all the way round it, a pond on each flank of each camp, and reed beds on every shore. The boardwalk is the quick way and the only dry one; the reeds are everywhere else, and so is whoever is hiding in them. A fisherman's hut and his upturned cart are the only hard cover.",
    blocks: layout(
      [
        r("water", "pond", 1.25, 9.25, 2.75, 10.5), r("water", "pond", 6.25, 9.0, 7.75, 10.0),
        r("road", "bridge-deck", 4.0, 8.5, 5.0, 12.0), r("road", "bridge-deck", 2.25, 7.9, 6.75, 8.6), r("road", "bridge-deck", 2.25, 5.5, 3.25, 8.0),
        r("brush", "reeds", 2.75, 9.25, 3.6, 10.5), r("brush", "reeds", 5.4, 9.0, 6.25, 10.0), r("brush", "reeds", 0.25, 6.5, 2.0, 7.5),
        r("building", "house", 7.25, 11.25, 8.5, 12.5),
        r("cover", "cart", 0.25, 8.0, 1.0, 8.5), r("cover", "barrels", 7.9, 8.0, 8.75, 8.4), r("cover", "fence", 3.0, 11.5, 3.9, 11.9),
      ],
      [r("water", "pond", 3.5, 6.25, 5.5, 7.75)],
    ),
    marks: marks([mark("bridge", 2.25, 6.25, 3.25, 7.75), prop("lamp", 3.9, 8.7), prop("lamp", 5.1, 11.8), prop("tree", -0.5, 9.5), prop("tree", 9.5, 10.5), prop("tree", 8.7, 13.2), prop("signpost", 5.1, 8.7), mark("door", 7.15, 11.6, 7.25, 12.2)]),
  },
  {
    id: "long-lane", name: "Long Lane", league: 3,
    blurb: "A hedged farm lane between two cornfields. The lane is quick and watched; the corn is neither.",
    idea: "A mill farm. A lane runs straight down the middle between two tall hedges, a firing gallery from end to end. Either side of it is standing corn, right across the middle of the field: slower going, and nobody in it can be seen until they are on top of you. The mill and the barn anchor each camp, with haystacks and fences to shoot from.",
    blocks: layout(
      [
        r("wall", "hedge-wall", 2.75, 5.25, 3.25, 8.75),
        r("brush", "cornfield", 0.5, 5.5, 2.5, 8.5),
        r("building", "mill", 0, 10.0, 1.5, 11.5), r("building", "barn", 7.5, 11.25, 9.0, 12.5),
        r("cover", "haystack", 0.25, 8.9, 1.05, 9.4), r("cover", "haystack", 8.0, 9.0, 8.75, 9.5),
        r("cover", "fence", 2.75, 10.0, 3.5, 10.4), r("cover", "fence", 5.5, 10.4, 6.25, 10.8),
      ],
      [r("road", "road", 3.5, 2.0, 5.5, 12.0)],
    ),
    marks: marks([prop("signpost", 5.6, 11.8), prop("lamp", 3.4, 9.0), prop("tree", -0.5, 9.5), prop("tree", 9.5, 10.0), prop("tree", 8.8, 13.0), prop("banner", 0.75, 9.9), mark("door", 1.5, 10.5, 1.6, 11.0), mark("door", 7.4, 11.6, 7.5, 12.2), mark("gate", 3.25, 8.5, 5.75, 8.75)]),
  },
  // ---- League 4
  {
    id: "bastions", name: "Bastions", league: 4,
    blurb: "Two forts face to face, each with a barricaded gate. Take the flank roads, or break in.",
    idea: "Each side holds a bastion: a wall with a barricaded gate, sandbags along its inner face and a barracks behind. The made roads go round the outside of both walls, so a fast army flanks; a heavy one breaks the gate and comes straight down the middle, through the long grass of no man's land.",
    blocks: layout(
      [
        r("wall", "wall", 1.5, 8.5, 3.5, 9.0), r("wall", "wall", 5.5, 8.5, 7.5, 9.0), r("barricade", "barricade", 3.5, 8.5, 5.5, 9.0),
        r("building", "hall", 1.5, 10.5, 3.25, 11.75),
        r("road", "road", 0.25, 5.0, 1.25, 9.0), r("road", "road", 4.0, 9.0, 5.0, 12.0),
        r("cover", "sandbags", 2.0, 9.4, 3.0, 9.8), r("cover", "sandbags", 6.0, 9.4, 7.0, 9.8), r("cover", "crates", 5.5, 11.0, 6.5, 11.4),
        r("brush", "brush", 2.0, 6.5, 3.5, 7.5), r("brush", "brush", 7.5, 10.0, 8.75, 11.5),
      ],
      [r("road", "road", 4.0, 5.5, 5.0, 8.5)],
    ),
    marks: marks([mark("gate", 3.5, 8.5, 5.5, 9.0), prop("banner", 3.4, 8.4), prop("banner", 5.6, 8.4), prop("lamp", 1.4, 9.1), prop("lamp", 7.6, 9.1), prop("tree", -0.5, 11.0), prop("tree", 9.5, 12.0), mark("door", 3.25, 10.9, 3.35, 11.4), prop("signpost", 1.35, 8.2)]),
  },
  {
    id: "broken-bridge", name: "Broken Bridge", league: 4,
    blurb: "One stone bridge. Log jams block the fords, and the reeds on the banks hide the welcome.",
    idea: "A river with a single stone bridge and the road over it. The fords at either edge are jammed with logs until someone clears them. Both banks are thick with reeds right up to the bridge, so whoever crosses walks into a bank they cannot see into. A ruined gatehouse and a mill house stand back from the water.",
    blocks: layout(
      [
        r("water", "river", 1.5, 6.5, 3.5, 7.5), r("barricade", "logs", 0, 6.75, 1.5, 7.25),
        r("road", "road", 4.0, 7.75, 5.0, 11.5),
        r("brush", "reeds", 1.5, 7.5, 3.5, 8.25), r("brush", "reeds", 5.5, 7.5, 7.5, 8.25),
        r("building", "ruin", 2.5, 9.0, 3.5, 10.0), r("building", "house", 6.5, 10.5, 8.0, 11.75),
        r("cover", "crates", 5.25, 9.0, 6.25, 9.4), r("cover", "cart", 0.5, 8.5, 1.25, 9.0), r("cover", "barrels", 7.75, 8.75, 8.5, 9.15),
      ],
      [r("road", "bridge-deck", 3.5, 6.25, 5.5, 7.75)],
    ),
    marks: marks([mark("bridge", 3.5, 6.5, 5.5, 7.5), prop("lamp", 3.6, 7.9), prop("lamp", 5.4, 7.9), prop("signpost", 5.1, 11.3), prop("tree", -0.5, 10.0), prop("tree", 9.5, 9.8), prop("tree", 0.6, 12.6), mark("door", 6.4, 10.9, 6.5, 11.4)]),
  },
  {
    id: "switchback", name: "Switchback", league: 4,
    blurb: "A mountain road doubling back between crags. Burrowers, fliers and mortars take the short cut.",
    idea: "A mountain track. Two cliffs reach in from opposite sides, so the road climbs in a long S: out past your own cliff, across the middle, round theirs. A ruined chapel stands at each end of the middle stretch, there is scrub at the bend to lie in wait in, and fences and sandbags at each turn.",
    blocks: layout(
      [
        r("building", "rock", 0, 8.5, 2.5, 9.5), r("wall", "wall", 2.5, 8.75, 5.0, 9.25),
        r("building", "chapel", 7.5, 6.5, 8.5, 7.5),
        r("road", "road", 5.5, 7.5, 6.5, 12.0),
        r("cover", "fence", 6.75, 8.8, 7.75, 9.2), r("cover", "crates", 3.0, 10.0, 4.0, 10.4), r("cover", "sandbags", 7.5, 10.5, 8.5, 10.9),
        r("brush", "brush", 3.5, 7.6, 5.0, 8.6), r("brush", "brush", 0.25, 9.75, 2.25, 10.75),
      ],
      [r("road", "road", 2.5, 6.5, 6.5, 7.5)],
    ),
    marks: marks([prop("signpost", 5.4, 9.4), prop("lamp", 6.6, 7.6), prop("banner", 8.0, 7.6), prop("tree", -0.5, 11.5), prop("tree", 9.5, 11.0), prop("tree", 1.0, 10.2), prop("tree", 9.4, 8.2), mark("door", 7.4, 6.8, 7.5, 7.2)]),
  },
];

/** An arena by id (undefined for an unknown id). */
export const arenaById = (id: string): ArenaDef | undefined => ARENAS.find((a) => a.id === id);

// ---------------------------------------------------------------- arena checks (used by tests and tools)
/** The commander keeps: just off each end of the board. Blocks stay clear of them. */
export const KEEPS = [{ x: W / 2, y: -0.9, r: 1.1 }, { x: W / 2, y: H + 0.9, r: 1.1 }] as const;
/** The share of a side's deploy zone (depth ZONE_DEPTH from its back edge) not covered by blocks, 0..1 (roads and
 * brush are ground: a piece may stand on them). */
export function zoneFree(blocks: readonly Block[], side: 0 | 1): number {
  let free = 0, n = 0;
  const step = 0.1;
  for (let d = step / 2; d < ZONE_DEPTH; d += step) for (let lx = 0.3 + step / 2; lx < W - 0.3; lx += step) {
    // Sampled in side-local terms, so the two sides of a symmetric arena measure the same.
    const x = side === 0 ? lx : W - lx, y = side === 0 ? H - 0.5 - d : 0.5 + d;
    n++;
    // A sample that falls exactly on a block's edge counts as free (so rounding never makes the two sides differ).
    if (!blocks.some((b) => !isZone(b.kind) && Math.abs(x - b.x) < b.w / 2 - 1e-6 && Math.abs(y - b.y) < b.h / 2 - 1e-6)) free++;
  }
  return free / n;
}

/** What a designed map must have, beyond being legal. Arenas use ARENA_RULES; campaign sets are lighter (sets.ts). */
export interface TerrainRules {
  /** Fewest and most blocks (zones included). */
  blocks: [number, number];
  /** Least share of each deploy zone left free of blocking blocks. */
  zoneFree: number;
  /** A chain of road zones must join the two deploy zones. */
  road: boolean;
  /** Fewest cover blocks, and brush zones, on each side's half of the board. */
  cover: number;
  brush: number;
}
export const ARENA_RULES: TerrainRules = { blocks: [14, 30], zoneFree: 0.75, road: true, cover: 2, brush: 1 };
/** The width of the plug used to test for a single chokepoint: no one gap narrower than this may be the only way across. */
export const CHOKE_WIDTH = 1.2;

const edges = (b: Block) => [b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2] as const;
const overlaps = (a: Block, b: Block, eps = 1e-9) => {
  const [al, at, ar, ab] = edges(a), [bl, bt, br, bb] = edges(b);
  return !(ar <= bl + eps || br <= al + eps || ab <= bt + eps || bb <= at + eps);
};
/** Do the road zones form a chain from side 1's deploy zone to side 0's (rectangles that overlap or share an edge). */
export function roadJoins(blocks: readonly Block[]): boolean {
  const roads = blocks.filter((b) => b.kind === "road");
  const seen = new Set<Block>(), todo = roads.filter((b) => b.y - b.h / 2 <= ZONE_DEPTH + 0.5);
  while (todo.length) {
    const b = todo.pop()!;
    if (seen.has(b)) continue;
    seen.add(b);
    if (b.y + b.h / 2 >= H - 0.5 - ZONE_DEPTH) return true;
    for (const o of roads) if (!seen.has(o) && overlaps(b, o, -1e-6)) todo.push(o);
  }
  return false;
}
/**
 * Is there one narrow gap every ground route between the two sides must squeeze through? Walks the cheapest route
 * for an ordinary unit from side 0's back to side 1's (breaking a barricade counts as a way through) and, at each
 * step of it, drops a CHOKE_WIDTH plug there: if any plug cuts the sides off, that spot is a single chokepoint.
 * Returns it, or null when every such gap has a way round.
 */
export function chokepoint(blocks: readonly Block[]): { x: number; y: number } | null {
  const rad = 0.3, pen = 1 / 32;
  const nav = new Nav([...blocks]);
  nav.spot(W / 2, H - 1.5, rad); const sx = nav.sx, sy = nav.sy;
  nav.spot(W / 2, 1.5, rad); const gx = nav.sx, gy = nav.sy;
  const pts: [number, number][] = [[sx, sy]];
  // The whole route: plan again from each barricade the route means to break, as if it were gone.
  let live = [...blocks];
  for (let guard = 0; guard < 8; guard++) {
    const n = new Nav(live), [fx, fy] = pts[pts.length - 1];
    if (!n.path(fx, fy, gx, gy, rad, pen) || n.partial) return { x: fx, y: fy };
    for (let i = 0; i < n.np; i++) pts.push([n.pts[i * 2], n.pts[i * 2 + 1]]);
    if (n.breach < 0) break;
    const gone = n.blocks[n.breach];
    live = live.filter((b) => b.id !== gone.id);
    pts.push([gone.x, gone.y]);
  }
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 0.4));
    for (let k = 1; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n;
      if (y < 2.5 || y > H - 2.5) continue;
      const plug: Block = { id: -1, kind: "wall", x, y, w: CHOKE_WIDTH, h: CHOKE_WIDTH };
      const cut = new Nav([...blocks, plug]);
      if (!cut.path(sx, sy, gx, gy, rad, pen) || cut.partial) return { x, y };
    }
  }
  return null;
}
/**
 * Everything wrong with a designed map, as readable lines (empty = sound). Legal: in bounds, big enough to see, known
 * looks, blocking blocks clear of each other and of the keeps, zones clear of blocking blocks, the same after a half
 * turn, every free spot reachable by the largest unit without breaking anything, no single chokepoint. Designed: the
 * `rules` (block count, free deploy room, a road joining the sides, cover and brush on each side).
 */
export function terrainIssues(blocks: readonly Block[], rules: TerrainRules = ARENA_RULES): string[] {
  const out: string[] = [];
  const solid = blocks.filter((b) => !isZone(b.kind));
  if (new Set(blocks.map((b) => b.id)).size !== blocks.length) out.push("block ids repeat");
  if (blocks.length < rules.blocks[0] || blocks.length > rules.blocks[1]) out.push(`${blocks.length} blocks (want ${rules.blocks[0]}-${rules.blocks[1]})`);
  for (const b of blocks) {
    const [l, t, rr, bt] = edges(b);
    if (l < -1e-9 || t < -1e-9 || rr > W + 1e-9 || bt > H + 1e-9) out.push(`block ${b.id} is off the board`);
    if (b.w < 0.39 || b.h < 0.39) out.push(`block ${b.id} is too small to see`);
    if (!(LOOKS_BY_KIND[b.kind] as readonly string[]).includes(b.look ?? "")) out.push(`block ${b.id}: look "${b.look}" is not a ${b.kind} look`);
    const twin = blocks.find((o) => o.kind === b.kind && o.look === b.look && Math.abs(o.x - (W - b.x)) < 1e-9 && Math.abs(o.y - (H - b.y)) < 1e-9
      && Math.abs(o.w - b.w) < 1e-9 && Math.abs(o.h - b.h) < 1e-9 && (o.hp ?? 0) === (b.hp ?? 0));
    if (!twin) out.push(`block ${b.id} has no mirror image`);
    if (isZone(b.kind)) { for (const o of solid) if (overlaps(b, o)) out.push(`${b.kind} ${b.id} overlaps block ${o.id}`); continue; }
    for (const k of KEEPS) {
      const cx = Math.max(l, Math.min(rr, k.x)), cy = Math.max(t, Math.min(bt, k.y));
      if (Math.hypot(k.x - cx, k.y - cy) < k.r + 0.3) out.push(`block ${b.id} crowds a keep`);
    }
    for (const o of solid) if (o.id > b.id && overlaps(b, o)) out.push(`blocks ${b.id} and ${o.id} overlap`);
  }
  for (const side of [0, 1] as const) {
    const mine = (b: Block) => (side === 0 ? b.y + b.h / 2 > H / 2 : b.y - b.h / 2 < H / 2);
    const free = zoneFree(blocks, side);
    if (free < rules.zoneFree) out.push(`side ${side}: only ${Math.round(free * 100)}% of the deploy zone is free`);
    const cover = blocks.filter((b) => b.kind === "cover" && mine(b)).length, brush = blocks.filter((b) => b.kind === "brush" && mine(b)).length;
    if (cover < rules.cover) out.push(`side ${side}: ${cover} cover (want ${rules.cover})`);
    if (brush < rules.brush) out.push(`side ${side}: ${brush} brush (want ${rules.brush})`);
  }
  if (rules.road && !roadJoins(blocks)) out.push("no road joins the two sides");
  // The largest unit can get everywhere it can stand, breaking nothing.
  const nav = new Nav([...blocks]), big = UNITS.golem.radius;
  const spots: [number, number][] = [];
  for (let y = 0.75; y < H; y += 0.5) for (let x = 0.75; x < W; x += 0.5) if (!nav.hitsGround(x, y, big + 0.13)) spots.push([x, y]);
  const from = spots.find(([, y]) => y > H - 2);
  if (!from) out.push("no room for the largest unit at side 0's back");
  else for (const [x, y] of spots) if (!nav.reachable(from[0], from[1], x, y, big)) { out.push(`the largest unit cannot reach (${x}, ${y})`); break; }
  const choke = chokepoint(blocks);
  if (choke) out.push(`a single chokepoint under ${CHOKE_WIDTH} wide at (${choke.x.toFixed(2)}, ${choke.y.toFixed(2)})`);
  return out;
}

// ---------------------------------------------------------------- leagues and trophies
export interface League {
  /** 1..4. */
  id: number;
  name: string;
  /** Trophies needed to play in it. */
  trophies: number;
  /** Ids of its three arenas. */
  arenas: string[];
}
export const LEAGUES: League[] = [
  { id: 1, name: "Bronze League", trophies: 0, arenas: [] },
  { id: 2, name: "Silver League", trophies: 200, arenas: [] },
  { id: 3, name: "Gold League", trophies: 500, arenas: [] },
  { id: 4, name: "Champion League", trophies: 900, arenas: [] },
].map((l) => ({ ...l, arenas: ARENAS.filter((a) => a.league === l.id).map((a) => a.id) }));

/** Trophies for a win, and what a loss costs in each league (index = league id - 1). */
export const TROPHY_WIN = 30;
export const TROPHY_LOSS = [8, 12, 16, 20] as const;
/** A win streak adds this per win past the first, up to STREAK_MAX extra. */
export const STREAK_BONUS = 2;
export const STREAK_MAX = 10;

/** The league a trophy count plays in. */
export const leagueOf = (trophies: number): League => {
  let l = LEAGUES[0];
  for (const x of LEAGUES) if (trophies >= x.trophies) l = x;
  return l;
};
/** The league after this one, or null at the top. */
export const nextLeague = (l: League): League | null => LEAGUES[l.id] ?? null;
/** Progress through the current league toward the next: trophies into it, the span to the next (0 at the top). */
export function leagueProgress(trophies: number): { league: League; into: number; span: number; next: League | null } {
  const league = leagueOf(trophies), next = nextLeague(league);
  return { league, into: trophies - league.trophies, span: next ? next.trophies - league.trophies : 0, next };
}
/** Is an arena open to a player whose best trophy count is `best`. */
export const arenaUnlocked = (a: ArenaDef, best: number) => best >= LEAGUES[a.league - 1].trophies;

/** The ladder as the save keeps it (Save.arena). */
export interface ArenaSave {
  trophies: number;
  /** Highest trophies ever held (leagues unlock on this, and trophies never fall below the gate of the league it reached). */
  best: number;
  wins: number;
  losses: number;
  /** Current run of wins. */
  streak: number;
  bestStreak: number;
  /** Matches finished (drives the arena rotation). */
  played: number;
  /** Wins per arena id. */
  arenaWins: Record<string, number>;
  /** Arena coins paid today, for the daily cap (set by awardArena). */
  day?: { day: string; coins: number };
}
export const blankArena = (): ArenaSave => ({ trophies: 0, best: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, played: 0, arenaWins: {} });
const whole = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
/** Fills in whatever an older or damaged save is missing. */
export function normalizeArena(a: Partial<ArenaSave> | undefined): ArenaSave {
  const trophies = whole(a?.trophies), wins = whole(a?.wins), losses = whole(a?.losses);
  const arenaWins: Record<string, number> = {};
  for (const [k, v] of Object.entries(a?.arenaWins ?? {})) if (arenaById(k) && whole(v) > 0) arenaWins[k] = whole(v);
  return {
    trophies, best: Math.max(trophies, whole(a?.best)), wins, losses,
    streak: whole(a?.streak), bestStreak: Math.max(whole(a?.streak), whole(a?.bestStreak)),
    played: Math.max(whole(a?.played), wins + losses), arenaWins,
    ...(a?.day && typeof a.day.day === "string" ? { day: { day: a.day.day, coins: whole(a.day.coins) } } : {}),
  };
}

export interface ArenaResult {
  won: boolean;
  /** Trophy change (never below the floor of the highest league reached). */
  delta: number;
  trophies: number;
  /** The league before and after; `promoted` when the result reached a new league for the first time. */
  from: League;
  to: League;
  promoted: boolean;
  streak: number;
}
/** What a result would do to the trophies, without applying it. */
export function trophyChange(s: ArenaSave, won: boolean): number {
  if (won) return TROPHY_WIN + Math.min(STREAK_MAX, STREAK_BONUS * s.streak);
  const floor = leagueOf(s.best).trophies;
  const loss = Math.min(TROPHY_LOSS[leagueOf(s.trophies).id - 1], Math.max(0, s.trophies - floor));
  return loss > 0 ? -loss : 0;
}
/**
 * Applies a finished Arena match to the ladder (mutates `s`) and says what changed. Pure over the save object:
 * awardArena() in engine/progression/troops.ts calls it on the device save and pays the rewards.
 */
export function finishArena(s: ArenaSave, arenaId: string, won: boolean): ArenaResult {
  const from = leagueOf(s.trophies), bestBefore = leagueOf(s.best);
  const delta = trophyChange(s, won);
  s.trophies = Math.max(0, s.trophies + delta);
  s.best = Math.max(s.best, s.trophies);
  s.played++;
  if (won) {
    s.wins++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.arenaWins[arenaId] = (s.arenaWins[arenaId] ?? 0) + 1;
  } else {
    s.losses++;
    s.streak = 0;
  }
  const to = leagueOf(s.trophies);
  return { won, delta, trophies: s.trophies, from, to, promoted: leagueOf(s.best).id > bestBefore.id, streak: s.streak };
}

// ---------------------------------------------------------------- opponents
export interface ArenaOpponent {
  /** Display name, e.g. "Marshal Corvane". */
  name: string;
  /** A short epithet for the card, from its tactic, e.g. "the Besieger". */
  title: string;
  ai: AIProfile;
  /** The troop level its whole army fields. */
  level: number;
  /** Trophies it is shown with (close to the player's). */
  trophies: number;
}
const RANKS = ["Sergeant", "Captain", "Marshal", "Warden", "Commander", "Dame", "Sir", "Lady", "Master", "Old"];
const NAMES = ["Pell", "Corvane", "Ilse", "Tobin", "Hask", "Wren", "Cassia", "Rook", "Kettle", "Dunmere", "Varro", "Brandt", "Oriel", "Sable", "Thorne", "Quill", "Maren", "Aldous", "Fenn", "Lorca", "Bryn", "Castell", "Ember", "Vance"];
const TITLES: Record<Tactic, string> = {
  balanced: "the Steady", swarm: "the Many", fortress: "the Wall", artillery: "the Gunner", ambush: "the Unseen", blitz: "the Swift", siege: "the Besieger",
};
/** How sharp the AI is at a trophy count: 0.2 for a newcomer, 0.95 from 1,300 trophies. */
export const arenaDifficulty = (trophies: number) => Math.max(0.2, Math.min(0.95, 0.2 + (Math.max(0, trophies) / 1300) * 0.75));
/** The troop level arena foes field: 1 below 150 trophies, one more every 150, up to 10 (the campaign's last act). */
export const arenaFoeLevel = (trophies: number) => Math.max(1, Math.min(MAX_LEVEL - 2, 1 + Math.floor(Math.max(0, trophies) / 150)));
/** The units an arena foe drafts from: the campaign's unlock order, reaching the full roster by the Champion League. */
export const arenaFoeRoster = (trophies: number): UnitKind[] => rosterAt(Math.min(60, 12 + Math.floor(Math.max(0, trophies) / 18)));
/** The opponent for a match at this trophy count: tougher with trophies, its tactic and temper varied by the seed. */
export function arenaOpponent(trophies: number, seed: number): ArenaOpponent {
  const rng = new Rng(hashSeed("arena-foe", seed));
  const tactic = TACTICS[rng.int(0, TACTICS.length - 1)];
  const difficulty = Math.max(0.15, Math.min(0.97, arenaDifficulty(trophies) + rng.range(-0.05, 0.05)));
  const base: Record<Tactic, [number, number, number]> = {
    // aggression, economy, spread
    balanced: [0.5, 0.4, 0.6], swarm: [0.7, 0.2, 0.6], fortress: [0.25, 0.5, 0.5], artillery: [0.3, 0.4, 0.8],
    ambush: [0.55, 0.35, 0.7], blitz: [0.85, 0.2, 0.7], siege: [0.6, 0.45, 0.5],
  };
  const [ag, ec, sp] = base[tactic];
  const j = (v: number) => Math.max(0, Math.min(1, v + rng.range(-0.12, 0.12)));
  const name = `${RANKS[rng.int(0, RANKS.length - 1)]} ${NAMES[rng.int(0, NAMES.length - 1)]}`;
  return {
    name, title: TITLES[tactic],
    ai: { difficulty, tactic, aggression: j(ag), economy: j(ec), spread: j(sp), rerolls: difficulty < 0.3 ? 0 : difficulty < 0.7 ? 1 : 2 },
    level: arenaFoeLevel(trophies),
    trophies: Math.max(0, Math.round(trophies + rng.range(-25, 25))),
  };
}

// ---------------------------------------------------------------- the next match
/** The arena a player meets next: their league's three in a seeded order, each once before any repeats. */
export function arenaFor(s: ArenaSave, salt = 0): ArenaDef {
  const league = leagueOf(s.trophies), n = league.arenas.length;
  const order = [...league.arenas];
  const rng = new Rng(hashSeed("arena-rot", league.id, Math.floor(s.played / n), salt));
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return arenaById(order[s.played % n])!;
}

export interface ArenaMatch {
  /** Pass to `new Match(cfg)`: seed, terrain, rosters, levels and names are set. */
  cfg: MatchConfig;
  arena: ArenaDef;
  league: League;
  /** The opponent: drive side 1 with `foe.ai` (planTurn / planTurnAsync), show `foe.name`, `foe.title`, `foe.level`. */
  foe: ArenaOpponent;
}
/**
 * Builds the player's next Arena match from the ladder. Pure: `levels` (the player's troop levels), `roster` (the
 * player's units; all of them when omitted) and `hp` (the player's keep health) come from the caller;
 * nextArenaMatch() in engine/progression/troops.ts fills them from the device save. `seed` varies the opponent and the
 * shops (default: derived from the ladder, so the same save always meets the same match); `arena` forces a map.
 */
export function arenaConfig(s: ArenaSave, o: { levels?: Levels; roster?: UnitKind[]; hp?: number; seed?: number; arena?: string } = {}): ArenaMatch {
  const seed = o.seed ?? hashSeed("arena", s.played, s.trophies, s.wins);
  const arena = (o.arena ? arenaById(o.arena) : undefined) ?? arenaFor(s);
  const league = leagueOf(s.trophies);
  const foe = arenaOpponent(s.trophies, seed);
  const foeLevels = foe.level > 1 ? uniformLevels(foe.level) : undefined;
  const cfg: MatchConfig = {
    seed: hashSeed("arena-match", seed, arena.id),
    hp: [o.hp ?? START_HP, START_HP],
    roster: [o.roster?.length ? o.roster : [...UNIT_KINDS], arenaFoeRoster(s.trophies)],
    terrain: arena.blocks,
    ...(o.levels || foeLevels ? { levels: [o.levels, foeLevels] as [Levels | undefined, Levels | undefined] } : {}),
    names: ["You", foe.name],
  };
  return { cfg, arena, league, foe };
}

// ---------------------------------------------------------------- rewards (numbers only; awardArena pays them)
/** Coins for an Arena win, by league (index = league id - 1); a streak adds ARENA_STREAK_COINS per win past the first, up to 5. */
export const ARENA_WIN_COINS = [40, 55, 70, 85] as const;
export const ARENA_STREAK_COINS = 5;
/** Arena coins paid per day at most (first-time league promotions are on top). */
export const ARENA_DAILY_CAP = 400;
/** Coins for reaching a league for the first time (index = league id - 1). */
export const ARENA_PROMOTION_COINS = [0, 150, 300, 500] as const;
/** Crowns a win adds toward the crown chest (as a Skirmish or Gauntlet win does). */
export const ARENA_CROWNS = 2;
/** The coin line items an Arena result pays: [label, coins][]; a loss pays nothing. `earnedToday` applies the daily cap. */
export function arenaCoins(r: ArenaResult, earnedToday = 0): [string, number][] {
  if (!r.won) return [];
  let left = Math.max(0, ARENA_DAILY_CAP - earnedToday);
  const win = Math.min(ARENA_WIN_COINS[r.from.id - 1], left);
  left -= win;
  const streak = Math.min(ARENA_STREAK_COINS * Math.min(5, Math.max(0, r.streak - 1)), left);
  const parts: [string, number][] = [["Arena victory", win], [`Streak ${r.streak}`, streak], [r.promoted ? `${r.to.name} reached` : "", r.promoted ? ARENA_PROMOTION_COINS[r.to.id - 1] : 0]];
  return parts.filter(([, n]) => n > 0);
}
