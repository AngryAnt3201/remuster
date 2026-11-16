// Pixelkeep's Arena terrain: tile-map buildings on the five-level console palette. Red brick walls, plaster huts
// with red roofs, grey stone towers with blue caps, green hedges for barricades, crates, and blue water tiles.
// The battle canvas is a low-resolution pixel screen (src/render/board.ts), so these come out as fat pixels.
//
// The renderer (../render/terrain.ts) builds every wall, house, tower, crate stack and pond from these colours and
// shapes. Each look: `h` height in world units (a unit is about 0.6 tall), three face colours (top, the face toward
// the player, the side face), a trim colour for edges and details, and optionally a roof and a surface detail.

export type Roof = "flat" | "gable" | "cone" | "crenel";
export type Detail = "brick" | "plank" | "house" | "stake" | "log" | "crate" | "rail";

export interface LookStyle {
  h: number;
  top: string; front: string; side: string; trim: string;
  roof?: Roof;
  /** Roof colours (lit slope, shaded slope). */
  roofLit?: string; roofDark?: string;
  detail?: Detail;
  /** Window / lamp glow for "house" detail. */
  glow?: string;
}

export interface TerrainStyle {
  /** Outline colour for every block. */
  ink: string;
  /** Keyed by block.look, then block.kind as the fallback. */
  looks: Record<string, LookStyle>;
  water: { deep: string; shallow: string; foam: string; bank: string };
  /** Decoration marks: a gate's paving and a bridge's deck and rails. */
  gate: string;
  bridge: { deck: string; plank: string; rail: string };
  rubble: string;
  dust: string;
  /** Sparks when a shot glances off a wall. */
  spark: string;
}

const brick = { top: "#ff8080", front: "#bf4040", side: "#802020", trim: "#400000" };
const stone = { top: "#ffffff", front: "#bfbfbf", side: "#808080", trim: "#404040" };
const wood = { top: "#ffbf80", front: "#bf8040", side: "#804000", trim: "#402000" };
const hut = { top: "#ffffff", front: "#ffffbf", side: "#bfbf80", trim: "#804000", roofLit: "#ff4040", roofDark: "#bf0000", glow: "#ffff40" };

export const TERRAIN: TerrainStyle = {
  ink: "#101018",
  looks: {
    wall: { h: 0.95, ...brick, roof: "crenel", detail: "brick" },
    building: { h: 1.0, ...hut, roof: "gable", detail: "house" },
    house: { h: 1.0, ...hut, roof: "gable", detail: "house" },
    hall: { h: 1.3, ...stone, roof: "gable", roofLit: "#4080ff", roofDark: "#0040bf", detail: "house", glow: "#ffff40" },
    tower: { h: 2.1, ...stone, roof: "cone", roofLit: "#4080ff", roofDark: "#0040bf", detail: "brick", glow: "#ffff40" },
    barricade: { h: 0.55, top: "#80ff40", front: "#40bf40", side: "#008000", trim: "#004000", detail: "stake" },
    logs: { h: 0.45, ...wood, detail: "log" },
    crates: { h: 0.55, top: "#ffbf80", front: "#ffbf40", side: "#bf8000", trim: "#804000", detail: "crate" },
    cover: { h: 0.5, top: "#ffbf80", front: "#ffbf40", side: "#bf8000", trim: "#804000", detail: "crate" },
    fence: { h: 0.5, top: "#ffffff", front: "#bfbfbf", side: "#808080", trim: "#404040", detail: "rail" },
  },
  water: { deep: "#0040bf", shallow: "#4080ff", foam: "#ffffff", bank: "#004000" },
  gate: "rgba(255,255,255,0.3)",
  bridge: { deck: "#bf8040", plank: "#804000", rail: "#402000" },
  rubble: "#804040",
  dust: "#ffbf80",
  spark: "#ffff80",
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on:
 *  1 Grassy Plains, 2 Magma Fields, 3 Deep Woods, 4 Crystal Cave, 5 Castle Yard, 6 Frost Field, 7 Cloud Top,
 *  8 Murk Marsh, 9 Sandy Shore, 10 Dark Keep. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 5, "the-crossing": 1, "crate-yard": 4,
  courtyard: 10, watchtowers: 6, "barricade-pass": 3,
  "old-village": 1, "the-fens": 8, "long-lane": 5,
  bastions: 9, "broken-bridge": 3, switchback: 2,
};
