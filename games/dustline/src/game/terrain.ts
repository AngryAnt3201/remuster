// How Dustline draws Arena terrain (engine/core/terrain.ts blocks, engine/core/arena.ts looks): adobe walls with
// roof beams, false-front saloons, a water tower, hay-bale barricades, barrels and crates for cover, corral fences,
// log jams, watering holes and trestles. The colours and sizes are here; the shapes the base renderer cannot
// describe (the false front, the tower on legs, bales, barrels) are drawn by ../render/terrain.ts.

export type Roof = "flat" | "gable" | "cone" | "crenel";
export type Detail = "brick" | "plank" | "house" | "stake" | "log" | "crate" | "rail";

export interface LookStyle {
  h: number;
  top: string; front: string; side: string; trim: string;
  roof?: Roof;
  /** Roof colours (lit slope, shaded slope). */
  roofLit?: string; roofDark?: string;
  detail?: Detail;
  /** Window / lamp glow. */
  glow?: string;
  /** Dustline: the painted false front (sign board, awning stripe) of a building. */
  paint?: string; sign?: string;
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

const adobe = { top: "#ecc79a", front: "#d9a070", side: "#b87c50", trim: "#8a5634" };
const pine = { top: "#d2a56c", front: "#b98a55", side: "#96693c", trim: "#5f3d20" };

export const TERRAIN: TerrainStyle = {
  ink: "#2a1608",
  looks: {
    // adobe: thick, flat-topped, roof beams poking out of the face
    wall: { h: 0.9, ...adobe, roof: "flat" },
    // false-front stores: plank sheds behind a tall painted facade
    building: { h: 1.05, ...pine, roofLit: "#8a6446", roofDark: "#5f4330", glow: "#ffd98a", paint: "#a8402e", sign: "#f0e2b8" },
    house: { h: 1.05, ...pine, roofLit: "#8a6446", roofDark: "#5f4330", glow: "#ffd98a", paint: "#a8402e", sign: "#f0e2b8" },
    hall: { h: 1.3, top: "#e6d2a8", front: "#d6bd8c", side: "#a88e60", trim: "#5f3d20", roofLit: "#8a6446", roofDark: "#5f4330", glow: "#ffe2a0", paint: "#3f7f7a", sign: "#f6ecd0" },
    // a water tower: a banded tank on legs under a shingled cap
    tower: { h: 2.2, top: "#d2a56c", front: "#b98a55", side: "#8f6238", trim: "#3c3f48", roofLit: "#8a6446", roofDark: "#5f4330", paint: "#a8402e" },
    // hay bales
    barricade: { h: 0.5, top: "#f0d470", front: "#e2c25a", side: "#c2a044", trim: "#8f7430" },
    logs: { h: 0.45, top: "#b88a58", front: "#8f623c", side: "#734c2b", trim: "#3f2a17", detail: "log" },
    // barrels and the odd crate
    crates: { h: 0.6, top: "#d9b07a", front: "#b07c48", side: "#8f6238", trim: "#3c3f48", detail: "crate" },
    cover: { h: 0.6, top: "#d9b07a", front: "#b07c48", side: "#8f6238", trim: "#3c3f48", detail: "crate" },
    // corral fence, whitewashed
    fence: { h: 0.52, top: "#f6efdc", front: "#e9dfc6", side: "#c9bda0", trim: "#8a7a5a", detail: "rail" },
  },
  water: { deep: "#3f86a8", shallow: "#7fc0d6", foam: "rgba(246,252,255,0.8)", bank: "rgba(110,70,40,0.5)" },
  gate: "rgba(246,226,180,0.3)",
  bridge: { deck: "#b08050", plank: "#7a5630", rail: "#5f3d20" },
  rubble: "#8a6a48",
  dust: "#e6cfa2",
  spark: "#fff0b8",
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 9, "the-crossing": 3, "crate-yard": 4,
  courtyard: 1, watchtowers: 5, "barricade-pass": 7,
  "old-village": 10, "the-fens": 3, "long-lane": 1,
  bastions: 5, "broken-bridge": 8, switchback: 7,
};
