// Blackridge's world: a modern war zone shot like a war film. Nothing is outlined and nothing is banded: surfaces
// are concrete, corrugated plate, sandbags and scorched brick, shaded smoothly, textured, darkened at the ground,
// under smoke, through a cold desaturated lens with grain, bloom and haze.
export type { Lamp, Materials, Roof, Texture, Tree, WorldStyle } from "@base/game/terrain";
import type { WorldStyle } from "@base/game/terrain";

export const TERRAIN: WorldStyle = {
  ink: "#0b0d0e", inkW: 0,
  light: [-0.55, 0.3, 0.62],
  dark: 0.46, tint: "#141a22", bands: 0,
  shadow: "rgba(4,6,8,0.5)",
  mat: {
    stone: "#8a8d88", stoneDark: "#5a5d5a", plaster: "#9a917f", plaster2: "#84806f", timber: "#6b5a44", timberDark: "#3a3229",
    roof: "#565b5c", roof2: "#4a4f45", thatch: "#6a6652", cloth: "#5c6846", cloth2: "#8a8468", metal: "#4d5357",
    foliage: "#4f5c3c", foliage2: "#3b4a30", trunk: "#3a3026", rock: "#6e6a62", glow: "#ffd9a0", door: "#2a2c2c", hay: "#8f8560", sack: "#8a8163",
  },
  roof: "flat", tree: "dead", lamp: "post",
  looks: {
    wall: { h: 1.05, wall: "#7d807c" }, house: { h: 1.15, roof: "flat", roofC: "#565b5c" }, hall: { h: 1.6, roof: "flat", roofC: "#4a4f45", wall: "#8a8d88" },
    tower: { h: 2.5, wall: "#70736f", roof: "flat", roofC: "#4d5357" }, barn: { wall: "#4d5357", roof: "barrel", roofC: "#5f666a" }, shop: { wall: "#84806f", roofC: "#565b5c" },
    chapel: { wall: "#8a8d88", roof: "gable", roofC: "#4a4f45" }, mill: { wall: "#70736f", roofC: "#4d5357" }, gatehouse: { wall: "#70736f" },
  },
  water: { deep: "#232d2e", shallow: "#3d4a48", foam: "rgba(200,210,205,0.4)", bank: "rgba(10,10,8,0.6)" },
  road: { fill: "#3f4142", edge: "#2a2b2b", mark: "rgba(210,200,160,0.5)", kind: "lane" },
  plaza: "#5c5d5a",
  bridge: { deck: "#55585a", plank: "#2e3031", rail: "#8a8468" },
  brush: { a: "#5d6a44", b: "#3f4a30", tip: "#8a8f62", crop: "#8f8560" },
  rubble: "#3a3a36", dust: "#8f8a7c", spark: "#ffd27a",
  sky: ["#2e3438", "#8b8a80"], soil: ["#4a4438", "#14120e"], halo: "rgba(200,190,170,0.18)", skyKind: "smoke",
  scenery: { trees: 6, rocks: 5, houses: 4, lamps: 2 },
  tex: { stone: "concrete", stoneDark: "concrete", plaster: "brick", plaster2: "stucco", timber: "plank", roof: "plate", roof2: "plate", metal: "plate", rock: "concrete", sack: "camo", cloth: "camo" },
  texK: 0.6, texSize: 1.1, ao: 0.6,
  post: { saturation: 0.55, contrast: 0.35, grade: [["#6f8794", 0.22, "soft-light"], ["#f0d9a8", 0.1, "overlay"]], bloom: 0.35, vignette: 0.6, grain: 0.22, fog: ["#8f968f", 0.42] },
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 1, "the-crossing": 3, "crate-yard": 2,
  courtyard: 5, watchtowers: 4, "barricade-pass": 6,
  "old-village": 10, "the-fens": 9, "long-lane": 7,
  bastions: 5, "broken-bridge": 3, switchback: 6,
};
