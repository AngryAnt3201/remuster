// Neonhold's world: the materials and shapes its buildings, walls, cover, roads, brush, trees and props are built
// from (see base/src/game/terrain.ts for what each field does, base/src/render/props.ts for the builders).
export type { Lamp, Materials, Roof, Tree, WorldStyle } from "@base/game/terrain";
import type { WorldStyle } from "@base/game/terrain";

export const TERRAIN: WorldStyle = {
  ink: "#c9b6ff", inkW: 0.018,
  light: [-0.5, 0.45, 0.8],
  dark: 0.42, tint: "#12082e", bands: 3,
  shadow: "rgba(4,0,20,0.45)",
  mat: { stone: "#a81f96", stoneDark: "#3a3766", plaster: "#2a2757", plaster2: "#232b5e", timber: "#3d2f8a", timberDark: "#16142f", roof: "#4a3f96", roof2: "#5b7bff", thatch: "#7d1f9e", cloth: "#ff4fdc", cloth2: "#4df0f0", metal: "#6f74c9", foliage: "#4df0a0", foliage2: "#1fb5ff", trunk: "#2a2757", rock: "#3a3766", glow: "#fff27a", door: "#0d0b24", hay: "#ffe84a", sack: "#6a3fb0" },
  roof: "flat", tree: "pylon", lamp: "neon",
  looks: { house: { h: 1.25, roofC: "#3d2f8a" }, hall: { h: 1.7, roof: "flat", roofC: "#5b7bff" }, tower: { h: 2.7, wall: "#2a2757", roof: "flat", roofC: "#b48cff" }, shop: { roofC: "#4df0f0" }, barn: { wall: "#3d2f8a", roof: "barrel", roofC: "#6f74c9" }, chapel: { wall: "#232b5e", roof: "dome", roofC: "#ff3fd0" }, mill: { wall: "#232b5e", roofC: "#4df0f0" } },
  water: { deep: "#0d6b45", shallow: "#4df0a0", foam: "rgba(214,255,232,0.85)", bank: "rgba(120,255,190,0.28)" },
  road: { fill: "#1a1838", edge: "#ff4fdc", mark: "rgba(77,240,240,0.75)", kind: "lane" },
  plaza: "#2a2757",
  bridge: { deck: "#2c2f55", plank: "#6f74c9", rail: "#ff4fdc" },
  brush: { a: "#4df0a0", b: "#178f6a", tip: "#d6ffe8", crop: "#ffe84a" },
  rubble: "#3a3566", dust: "#8f86c9", spark: "#ff9df2",
  sky: ["#07041a", "#3a1466"], soil: ["#241a4a", "#090516"], halo: "rgba(255,80,220,0.4)",
  scenery: { trees: 7, rocks: 0, houses: 7, lamps: 6 },
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 1, "the-crossing": 3, "crate-yard": 2,
  courtyard: 5, watchtowers: 4, "barricade-pass": 6,
  "old-village": 10, "the-fens": 9, "long-lane": 7,
  bastions: 5, "broken-bridge": 3, switchback: 6,
};
