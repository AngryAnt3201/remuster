// Inkfall's world: the materials and shapes its buildings, walls, cover, roads, brush, trees and props are built
// from (see base/src/game/terrain.ts for what each field does, base/src/render/props.ts for the builders).
export type { Lamp, Materials, Roof, Tree, WorldStyle } from "@base/game/terrain";
import type { WorldStyle } from "@base/game/terrain";

export const TERRAIN: WorldStyle = {
  ink: "#1d1a17", inkW: 0.036,
  light: [-0.5, 0.45, 0.8],
  dark: 0.62, bands: 2,
  shadow: "rgba(29,26,23,0.2)",
  mat: { stone: "#d9d0b8", stoneDark: "#6f6a62", plaster: "#f7f1e1", plaster2: "#e9e0c9", timber: "#84946f", timberDark: "#3f4a38", roof: "#cdb884", roof2: "#55514a", thatch: "#cdb884", cloth: "#c8321e", cloth2: "#f7f1e1", metal: "#3b3833", foliage: "#8a9a80", foliage2: "#5d6b58", trunk: "#2a2622", rock: "#9a958a", glow: "#f1d894", door: "#2a2622", hay: "#e2cf9c", sack: "#c9b27c" },
  roof: "gable", tree: "bamboo", lamp: "lantern",
  looks: { wall: { h: 0.8, wall: "#e9e0c9" }, hall: { h: 1.1, roof: "pagoda", roofC: "#55514a" }, tower: { h: 1.9, wall: "#f7f1e1", roof: "pagoda", roofC: "#55514a" }, chapel: { roof: "pagoda", roofC: "#55514a", wall: "#f7f1e1" }, gatehouse: { wall: "#c8321e" }, shop: { roof: "hip", roofC: "#55514a" } },
  water: { deep: "#7f9a9c", shallow: "#a9bcb8", foam: "rgba(250,246,234,0.85)", bank: "rgba(29,26,23,0.5)" },
  road: { fill: "#ece3cc", edge: "#b8ad94", mark: "rgba(29,26,23,0.22)", kind: "dirt" },
  plaza: "#f1e9d4",
  bridge: { deck: "#b8a47c", plank: "#8a775a", rail: "#2a2622" },
  brush: { a: "#8a9a80", b: "#5d6b58", tip: "#2a2622", crop: "#cdb884" },
  rubble: "#6f6a62", dust: "#a9a397", spark: "#1d1a17",
  sky: ["#e9dfc8", "#f7f1e1"], soil: ["#b8ad94", "#5a544a"], halo: "rgba(29,26,23,0.1)",
  scenery: { trees: 16, rocks: 5, houses: 1.5, lamps: 2 },
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 5, "the-crossing": 1, "crate-yard": 2,
  courtyard: 10, watchtowers: 4, "barricade-pass": 3,
  "old-village": 1, "the-fens": 8, "long-lane": 9,
  bastions: 10, "broken-bridge": 8, switchback: 6,
};
