// Brasswick's Arena buildings: soot-brick mills under slate roofs, riveted iron plate, copper boilers, brass-bound
// packing crates, iron railings and oily canal water. See base/src/game/terrain.ts for what each field does.
export type { Detail, LookStyle, Roof, TerrainStyle } from "@base/game/terrain";
import type { TerrainStyle } from "@base/game/terrain";

const plate = { top: "#7d848c", front: "#565c64", side: "#42474e", trim: "#c79a45" };
const brick = { top: "#b0715a", front: "#8a4f3d", side: "#6c3b2e", trim: "#3a2019" };

export const TERRAIN: TerrainStyle = {
  ink: "#17110e",
  looks: {
    wall: { h: 1.0, ...plate, roof: "crenel", detail: "brick" },
    building: { h: 1.1, ...brick, roof: "gable", roofLit: "#56606e", roofDark: "#353d48", detail: "house", glow: "#ffc864" },
    house: { h: 1.1, ...brick, roof: "gable", roofLit: "#56606e", roofDark: "#353d48", detail: "house", glow: "#ffc864" },
    hall: { h: 1.4, top: "#9a6a52", front: "#774a38", side: "#5c372a", trim: "#2e1a14", roof: "gable", roofLit: "#3f8f86", roofDark: "#27625c", detail: "house", glow: "#ffd98a" },
    tower: { h: 2.2, top: "#c98a4a", front: "#a5672f", side: "#7f4c20", trim: "#4a2a10", roof: "cone", roofLit: "#4fb3a6", roofDark: "#2c7a70", detail: "brick", glow: "#ffe08a" },
    barricade: { h: 0.55, top: "#8a9098", front: "#5f656d", side: "#484d54", trim: "#2a2d32", detail: "stake" },
    logs: { h: 0.5, top: "#c98a4a", front: "#9a6230", side: "#7a4a22", trim: "#3f2610", detail: "log" },
    crates: { h: 0.6, top: "#b98d5a", front: "#8f683d", side: "#72512e", trim: "#d6a84a", detail: "crate" },
    cover: { h: 0.6, top: "#b98d5a", front: "#8f683d", side: "#72512e", trim: "#d6a84a", detail: "crate" },
    fence: { h: 0.55, top: "#6d737b", front: "#3d4248", side: "#2f3338", trim: "#1c1f22", detail: "rail" },
  },
  water: { deep: "#1f4a4a", shallow: "#3f7f78", foam: "rgba(210,240,225,0.6)", bank: "rgba(20,14,10,0.55)" },
  gate: "rgba(255,200,100,0.2)",
  bridge: { deck: "#6a7078", plank: "#3c4046", rail: "#c79a45" },
  rubble: "#4a3a30",
  dust: "#b9a58c",
  spark: "#ffd27a",
};

export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 1, "the-crossing": 9, "crate-yard": 2,
  courtyard: 3, watchtowers: 4, "barricade-pass": 2,
  "old-village": 10, "the-fens": 5, "long-lane": 7,
  bastions: 4, "broken-bridge": 9, switchback: 1,
};
