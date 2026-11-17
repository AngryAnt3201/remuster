// Cindermaw's world: a 1990s shooter's hell. The whole battle is drawn small and blown up in hard pixels, crushed
// to a short palette of rust, blood, bone and toxic green; walls are textured slabs of flesh and riveted iron under
// a burning sky, with no outlines and deep shade.
export type { Lamp, Materials, Roof, Texture, Tree, WorldStyle } from "@base/game/terrain";
import type { WorldStyle } from "@base/game/terrain";

export const TERRAIN: WorldStyle = {
  ink: "#0a0605", inkW: 0,
  light: [-0.4, 0.5, 0.7],
  dark: 0.42, tint: "#1a0504", bands: 0,
  shadow: "rgba(0,0,0,0.55)",
  mat: {
    stone: "#6b5348", stoneDark: "#3d2c26", plaster: "#7a3a2c", plaster2: "#5e2a22", timber: "#5a4636", timberDark: "#2a1c14",
    roof: "#3a3f44", roof2: "#8a1c12", thatch: "#6a4a2a", cloth: "#b3170d", cloth2: "#d8c7a0", metal: "#5d646a",
    foliage: "#4d6a1c", foliage2: "#2f4a12", trunk: "#2a1c14", rock: "#4a3830", glow: "#ffb020", door: "#140a08", hay: "#8a6a30", sack: "#7a6a4a",
  },
  roof: "flat", tree: "dead", lamp: "brazier",
  looks: {
    wall: { h: 1.1, wall: "#5d646a" }, house: { h: 1.2, roof: "flat", roofC: "#3a3f44" }, hall: { h: 1.7, roof: "hip", roofC: "#8a1c12", wall: "#6b5348" },
    tower: { h: 2.7, wall: "#5d646a", roof: "hip", roofC: "#8a1c12" }, chapel: { wall: "#3d2c26", roof: "hip", roofC: "#8a1c12" }, barn: { wall: "#5e2a22", roof: "barrel", roofC: "#3a3f44" },
    mill: { wall: "#6b5348", roofC: "#8a1c12" }, gatehouse: { wall: "#3d2c26" },
  },
  water: { deep: "#7a1206", shallow: "#ff5a10", foam: "rgba(255,220,120,0.9)", bank: "rgba(20,5,0,0.7)" },
  road: { fill: "#3a2c28", edge: "#1c1412", mark: "rgba(160,30,20,0.6)", kind: "plank" },
  plaza: "#4a3a34",
  bridge: { deck: "#4d5257", plank: "#22262a", rail: "#b3170d" },
  brush: { a: "#6a8a1c", b: "#3a5210", tip: "#b8e03a", crop: "#8a6a30" },
  rubble: "#2a1c18", dust: "#7a5a4a", spark: "#ffc040",
  sky: ["#140303", "#7a1a08"], soil: ["#3a1c14", "#0a0403"], halo: "rgba(255,80,20,0.3)", skyKind: "hell",
  scenery: { trees: 8, rocks: 9, houses: 2, lamps: 5 },
  tex: { stone: "block", stoneDark: "block", plaster: "flesh", plaster2: "flesh", timber: "plank", roof: "plate", roof2: "tile", metal: "plate", rock: "flesh", sack: "stucco" },
  texK: 0.8, texSize: 0.9, ao: 0.7,
  post: {
    lowres: 3, contrast: 0.3, grade: [["#ff5a20", 0.16, "soft-light"]], vignette: 0.5, dither: 0.7,
    palette: ["#000000", "#1c0c08", "#3a1410", "#5a1c14", "#8a1c12", "#b3170d", "#e03a10", "#ff7a1c", "#ffb020", "#ffe070", "#2a1c14", "#4a3830", "#6b5348", "#8f7a66", "#b8a488", "#e0d4b8",
      "#22262a", "#3a3f44", "#5d646a", "#8a9298", "#bcc4c8", "#ffffff", "#2f4a12", "#4d6a1c", "#7aa024", "#b8e03a", "#0c3a4a", "#1c6a8a", "#3aa8d0", "#6a1c6a", "#b040b0", "#5a3a1c", "#8a5a2a", "#c08a40"],
  },
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 1, "the-crossing": 3, "crate-yard": 2,
  courtyard: 5, watchtowers: 4, "barricade-pass": 6,
  "old-village": 10, "the-fens": 9, "long-lane": 7,
  bastions: 5, "broken-bridge": 3, switchback: 6,
};
