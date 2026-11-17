// How this game draws Arena terrain (engine/core/terrain.ts blocks, engine/core/arena.ts looks). The renderer
// (../render/terrain.ts) builds every wall, house, tower, crate stack and pond from these colours and shapes, so a
// game re-themes its arenas by shadowing this one file (games/<id>/src/game/terrain.ts): adobe and saloons, brass
// boilers, neon barriers. A game that wants something the shapes can't do shadows ../render/terrain.ts instead.
//
// Each look: `h` height in world units (a unit is about 0.6 tall), three face colours (top, the face toward the
// player, the side face), a trim colour for edges and details, and optionally a roof and a surface detail.

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

// Neonhold: every block is a dark body with a light edge. The shared outline (`ink`) is a pale violet tube, so walls,
// stalls and containers read by their glowing rims on wet asphalt. Magenta, violet, blue and coolant green belong to
// the city; argon cyan and neon orange-red are the two crews' and never appear here.
const chassis = { top: "#3a3766", front: "#211f45", side: "#16142f", trim: "#8a5cff" };
const container = { top: "#4a3f96", front: "#2f2870", side: "#1f1a4e", trim: "#ff6fe6" };

export const TERRAIN: TerrainStyle = {
  ink: "#c9b6ff",
  looks: {
    // hard-light barrier: a sheet of magenta light between emitter posts, lattice lines across its face
    wall: { h: 0.95, top: "#ff8cee", front: "#c026a8", side: "#8a177c", trim: "#ffd0fa", roof: "crenel", detail: "brick" },
    // night-market kiosks: dark boxes under a lit awning, a bright service hatch
    building: { h: 1.0, ...chassis, roof: "gable", roofLit: "#ff3fd0", roofDark: "#7d1f9e", detail: "house", glow: "#fff27a" },
    house: { h: 1.0, ...chassis, roof: "gable", roofLit: "#ff3fd0", roofDark: "#7d1f9e", detail: "house", glow: "#fff27a" },
    // the server hall: taller, cold blue roof lights
    hall: { h: 1.25, top: "#3d4a8c", front: "#232b5e", side: "#171c42", trim: "#6f8cff", roof: "gable", roofLit: "#5b7bff", roofDark: "#2a3794", detail: "house", glow: "#d9e2ff" },
    // server towers: a rack stack with status rows and a violet beacon cap
    tower: { h: 2.1, top: "#4b4780", front: "#2a2757", side: "#1a183b", trim: "#9f7bff", roof: "cone", roofLit: "#b48cff", roofDark: "#5a37b8", detail: "brick", glow: "#ff5fe0" },
    // hazard barricade: a kerb of dark plate with yellow warning spikes
    barricade: { h: 0.5, top: "#ffe84a", front: "#3b3a52", side: "#262538", trim: "#ffe84a", detail: "stake" },
    // pipe stacks
    logs: { h: 0.45, top: "#7f89c4", front: "#4a5290", side: "#353b6e", trim: "#c4ccff", detail: "log" },
    // shipping containers, and vending machines for loose cover
    crates: { h: 0.6, ...container, detail: "crate" },
    cover: { h: 0.62, top: "#6a3fb0", front: "#3d2278", side: "#2a1657", trim: "#ffe84a", detail: "crate" },
    // neon tube railing
    fence: { h: 0.5, top: "#ffd0fa", front: "#ff4fdc", side: "#2a2757", trim: "#8a5cff", detail: "rail" },
  },
  // coolant pools: luminous green, the one colour nothing else in the city wears
  water: { deep: "#0d6b45", shallow: "#4df0a0", foam: "rgba(214,255,232,0.85)", bank: "rgba(120,255,190,0.28)" },
  gate: "rgba(255,43,214,0.16)",
  bridge: { deck: "#2c2f55", plank: "#6f74c9", rail: "#ff4fdc" },
  rubble: "#3a3566",
  dust: "#8f86c9",
  spark: "#ff9df2",
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 1, "the-crossing": 3, "crate-yard": 2,
  courtyard: 5, watchtowers: 4, "barricade-pass": 6,
  "old-village": 10, "the-fens": 9, "long-lane": 7,
  bastions: 5, "broken-bridge": 3, switchback: 6,
};
