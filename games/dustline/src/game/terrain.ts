// Dustline's world: the materials and shapes its buildings, walls, cover, roads, brush, trees and props are built
// from (see base/src/game/terrain.ts for what each field does, base/src/render/props.ts for the builders).
export type { Lamp, Materials, Roof, Tree, WorldStyle } from "@base/game/terrain";
import type { WorldStyle } from "@base/game/terrain";

export const TERRAIN: WorldStyle = {
  ink: "#2a1608", inkW: 0.028,
  light: [-0.5, 0.45, 0.8],
  dark: 0.56, tint: "#6a3a4a", bands: 3,
  shadow: "rgba(60,25,10,0.3)",
  mat: { stone: "#d9a070", stoneDark: "#b87c50", plaster: "#d2a56c", plaster2: "#e6d2a8", timber: "#b98a55", timberDark: "#5f3d20", roof: "#8a6446", roof2: "#a8402e", thatch: "#c9a05a", cloth: "#a8402e", cloth2: "#f0e2b8", metal: "#3c3f48", foliage: "#7a9a5a", foliage2: "#5f8050", trunk: "#7a5632", rock: "#c08a5a", glow: "#ffd98a", door: "#5f3d20", hay: "#e2c25a", sack: "#d9b07a" },
  roof: "flat", tree: "cactus", lamp: "post",
  looks: { wall: { h: 0.9 }, house: { h: 1.0, roof: "flat", roofC: "#8a6446" }, hall: { h: 1.25, roof: "gable", roofC: "#a8402e" }, tower: { h: 2.2, wall: "#b98a55", roof: "hip", roofC: "#8a6446" }, barn: { roof: "gable", roofC: "#a8402e", wall: "#a8402e" }, chapel: { wall: "#f0e2b8", roof: "gable", roofC: "#a8402e" }, shop: { wall: "#3f7f7a" } },
  water: { deep: "#3f86a8", shallow: "#7fc0d6", foam: "rgba(246,252,255,0.8)", bank: "rgba(110,70,40,0.5)" },
  road: { fill: "#e0bd86", edge: "#c0935a", mark: "rgba(120,70,30,0.3)", kind: "dirt" },
  plaza: "#e8cc9a",
  bridge: { deck: "#b08050", plank: "#7a5630", rail: "#5f3d20" },
  brush: { a: "#c9b05a", b: "#a8923c", tip: "#eadb96", crop: "#e2c25a" },
  rubble: "#8a6a48", dust: "#e6cfa2", spark: "#fff0b8",
  sky: ["#f0a85c", "#fde6b4"], soil: ["#b0703f", "#5a3018"], halo: "rgba(255,240,200,0.4)",
  scenery: { trees: 9, rocks: 7, houses: 1.6, lamps: 0 },
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 9, "the-crossing": 3, "crate-yard": 4,
  courtyard: 1, watchtowers: 5, "barricade-pass": 7,
  "old-village": 10, "the-fens": 3, "long-lane": 1,
  bastions: 5, "broken-bridge": 8, switchback: 7,
};
