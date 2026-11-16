// How Inkfall draws Arena terrain (engine/core/terrain.ts blocks, engine/core/arena.ts looks): plaster-and-timber
// walls under a tiled coping, thatched houses, pagoda towers, bamboo fences and stake lines, rice-straw bales, and
// koi ponds crossed by arched timber bridges. All in paper, wash greys and a little tea stain, so the two clans stay
// the only colour on the sheet.
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

const plaster = { top: "#f7f1e1", front: "#e9e0c9", side: "#cfc5ad", trim: "#2a2622" };
const tile = { roofLit: "#6f6a62", roofDark: "#3b3833" };
const thatch = { roofLit: "#cdb884", roofDark: "#a08a58" };
const bamboo = { top: "#a9b596", front: "#84946f", side: "#687859", trim: "#3f4a38" };
const straw = { top: "#e2cf9c", front: "#c9b27c", side: "#a8925e", trim: "#6e5c3a" };

export const TERRAIN: TerrainStyle = {
  ink: "#1d1a17",
  looks: {
    // a plaster wall with black timbers and a tiled coping along its top
    wall: { h: 0.8, ...plaster, roof: "gable", ...tile, detail: "plank" },
    // thatched houses with paper windows
    building: { h: 0.85, ...plaster, roof: "gable", ...thatch, detail: "house", glow: "#f1d894" },
    house: { h: 0.85, ...plaster, roof: "gable", ...thatch, detail: "house", glow: "#f1d894" },
    // a tiled hall, taller
    hall: { h: 1.15, ...plaster, roof: "gable", ...tile, detail: "house", glow: "#f1d894" },
    // a pagoda tower: plaster under a tall pointed tiled roof
    tower: { h: 1.9, ...plaster, roof: "cone", ...tile, detail: "plank", glow: "#f1d894" },
    // bamboo: stake lines, fences
    barricade: { h: 0.5, ...bamboo, detail: "stake" },
    fence: { h: 0.5, ...bamboo, detail: "rail" },
    logs: { h: 0.45, ...bamboo, detail: "log" },
    // rice-straw bales
    crates: { h: 0.55, ...straw, detail: "log" },
    cover: { h: 0.5, ...straw, detail: "log" },
  },
  // koi ponds: a grey-green wash with a dark wet bank and pale ripples
  water: { deep: "#7f9a9c", shallow: "#a9bcb8", foam: "rgba(250,246,234,0.85)", bank: "rgba(29,26,23,0.5)" },
  gate: "rgba(184,154,94,0.3)",
  bridge: { deck: "#b8a47c", plank: "#8a775a", rail: "#2a2622" },
  rubble: "#6f6a62",
  dust: "#a9a397",
  spark: "#1d1a17",
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 5, "the-crossing": 1, "crate-yard": 2,
  courtyard: 10, watchtowers: 4, "barricade-pass": 3,
  "old-village": 1, "the-fens": 8, "long-lane": 9,
  bastions: 10, "broken-bridge": 8, switchback: 6,
};
