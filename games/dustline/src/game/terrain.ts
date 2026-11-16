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

const stone = { top: "#b9b2a4", front: "#8d8778", side: "#726d61", trim: "#5a564d" };
const timber = { top: "#b98a55", front: "#8f6238", side: "#734c2b", trim: "#4f331c" };

export const TERRAIN: TerrainStyle = {
  ink: "#231c18",
  looks: {
    wall: { h: 0.95, ...stone, roof: "crenel", detail: "brick" },
    building: { h: 1.0, top: "#e9dcc0", front: "#cdbb98", side: "#a8977a", trim: "#6d5a43", roof: "gable", roofLit: "#c2553c", roofDark: "#8f3a2a", detail: "house", glow: "#ffd98a" },
    house: { h: 1.0, top: "#e9dcc0", front: "#cdbb98", side: "#a8977a", trim: "#6d5a43", roof: "gable", roofLit: "#c2553c", roofDark: "#8f3a2a", detail: "house", glow: "#ffd98a" },
    hall: { h: 1.25, top: "#ddd3bd", front: "#b9ad93", side: "#978c75", trim: "#5d5241", roof: "gable", roofLit: "#4f6f9c", roofDark: "#364e72", detail: "house", glow: "#ffe2a0" },
    tower: { h: 2.1, ...stone, roof: "cone", roofLit: "#4f6f9c", roofDark: "#364e72", detail: "brick", glow: "#ffd98a" },
    barricade: { h: 0.5, ...timber, detail: "stake" },
    logs: { h: 0.45, top: "#a97b4b", front: "#7f5631", side: "#684526", trim: "#3f2a17", detail: "log" },
    crates: { h: 0.55, top: "#d2a565", front: "#a87a42", side: "#8b6233", trim: "#5d3f1f", detail: "crate" },
    cover: { h: 0.5, top: "#d2a565", front: "#a87a42", side: "#8b6233", trim: "#5d3f1f", detail: "crate" },
    fence: { h: 0.5, top: "#c79a62", front: "#9c6f3f", side: "#7f5830", trim: "#523720", detail: "rail" },
  },
  water: { deep: "#2f6f9f", shallow: "#58a6c9", foam: "rgba(235,250,255,0.75)", bank: "rgba(60,45,30,0.45)" },
  gate: "rgba(240,225,190,0.28)",
  bridge: { deck: "#a47a4a", plank: "#7a5630", rail: "#5d3f1f" },
  rubble: "#5a4a3a",
  dust: "#cdbf9f",
  spark: "#ffe9a8",
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 1, "the-crossing": 3, "crate-yard": 2,
  courtyard: 5, watchtowers: 4, "barricade-pass": 6,
  "old-village": 10, "the-fens": 9, "long-lane": 7,
  bastions: 5, "broken-bridge": 3, switchback: 6,
};
