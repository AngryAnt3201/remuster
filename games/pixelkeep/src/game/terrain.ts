// Pixelkeep's world: the materials and shapes its buildings, walls, cover, roads, brush, trees and props are built
// from (see base/src/game/terrain.ts for what each field does, base/src/render/props.ts for the builders).
export type { Lamp, Materials, Roof, Tree, WorldStyle } from "@base/game/terrain";
import type { WorldStyle } from "@base/game/terrain";

export const TERRAIN: WorldStyle = {
  ink: "#101018", inkW: 0.045,
  light: [-0.5, 0.45, 0.8],
  dark: 0.5, bands: 2,
  shadow: "rgba(0,0,0,0.35)",
  mat: { stone: "#bfbfbf", stoneDark: "#808080", plaster: "#ffffbf", plaster2: "#ffffff", timber: "#bf8040", timberDark: "#804000", roof: "#bf4040", roof2: "#8080bf", thatch: "#ffbf40", cloth: "#ff4040", cloth2: "#ffffff", metal: "#808080", foliage: "#40bf40", foliage2: "#008000", trunk: "#804000", rock: "#808080", glow: "#ffff40", door: "#402000", hay: "#ffbf40", sack: "#bfbf80" },
  roof: "hip", tree: "pine", lamp: "brazier",
  looks: { wall: { wall: "#bf4040" }, hall: { roofC: "#8080bf" } },
  water: { deep: "#0040bf", shallow: "#4080ff", foam: "#ffffff", bank: "#004000" },
  road: { fill: "#bfbf80", edge: "#808040", mark: "rgba(64,32,0,0.45)", kind: "cobble" },
  plaza: "#ffffbf",
  bridge: { deck: "#bf8040", plank: "#804000", rail: "#402000" },
  brush: { a: "#80ff40", b: "#40bf40", tip: "#ffffff", crop: "#ffbf40" },
  rubble: "#804040", dust: "#ffbf80", spark: "#ffff80",
  sky: ["#4080ff", "#80bfff"], soil: ["#804000", "#402000"], halo: "rgba(255,255,255,0.5)",
  scenery: { trees: 18, rocks: 4, houses: 1.5, lamps: 0 },
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 5, "the-crossing": 1, "crate-yard": 4,
  courtyard: 10, watchtowers: 6, "barricade-pass": 3,
  "old-village": 1, "the-fens": 8, "long-lane": 5,
  bastions: 9, "broken-bridge": 3, switchback: 2,
};
