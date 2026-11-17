// Brasswick's world: the materials and shapes its buildings, walls, cover, roads, brush, trees and props are built
// from (see base/src/game/terrain.ts for what each field does, base/src/render/props.ts for the builders).
export type { Lamp, Materials, Roof, Tree, WorldStyle } from "@base/game/terrain";
import type { WorldStyle } from "@base/game/terrain";

export const TERRAIN: WorldStyle = {
  ink: "#17110e", inkW: 0.03,
  light: [-0.5, 0.45, 0.8],
  dark: 0.5, tint: "#241a2e", bands: 3,
  shadow: "rgba(8,6,10,0.34)",
  mat: { stone: "#6a7078", stoneDark: "#42474e", plaster: "#9a5a46", plaster2: "#7f4c3a", timber: "#a5672f", timberDark: "#4a2a10", roof: "#56606e", roof2: "#3f8f86", thatch: "#c98a4a", cloth: "#a23b2a", cloth2: "#d6a84a", metal: "#c79a45", foliage: "#6b7f4c", foliage2: "#46603e", trunk: "#3a2a20", rock: "#5e5a54", glow: "#ffc864", door: "#2e1a14", hay: "#b98d5a", sack: "#8f683d" },
  roof: "gable", tree: "round", lamp: "post",
  looks: { hall: { h: 1.3, roof: "barrel", roofC: "#3f8f86" }, tower: { h: 2.2, wall: "#a5672f", roof: "dome", roofC: "#4fb3a6" }, barn: { roof: "barrel", roofC: "#c79a45", wall: "#565c64" }, mill: { wall: "#7f4c3a", roofC: "#c79a45" }, chapel: { roofC: "#3f8f86" } },
  water: { deep: "#1f4a4a", shallow: "#3f7f78", foam: "rgba(210,240,225,0.6)", bank: "rgba(20,14,10,0.55)" },
  road: { fill: "#77726a", edge: "#3f3c3a", mark: "rgba(20,14,10,0.3)", kind: "cobble" },
  plaza: "#8a857c",
  bridge: { deck: "#6a7078", plank: "#3c4046", rail: "#c79a45" },
  brush: { a: "#7a8a4a", b: "#55663a", tip: "#b9c27a", crop: "#c9a04a" },
  rubble: "#4a3a30", dust: "#b9a58c", spark: "#ffd27a",
  sky: ["#4a4652", "#d49a5c"], soil: ["#4a3a30", "#1c1512"], halo: "rgba(255,200,120,0.3)",
  scenery: { trees: 7, rocks: 1, houses: 5, lamps: 4 },
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 1, "the-crossing": 9, "crate-yard": 2,
  courtyard: 3, watchtowers: 4, "barricade-pass": 2,
  "old-village": 10, "the-fens": 5, "long-lane": 7,
  bastions: 4, "broken-bridge": 9, switchback: 1,
};
