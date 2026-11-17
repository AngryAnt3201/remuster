// How this game builds its world: the buildings, walls, cover, roads, brush, trees and props of every level
// (engine/core/terrain.ts blocks, engine/core/arena.ts looks and marks) and the globe the battlefield sits on.
// The renderer (../render/props.ts) builds each look as real geometry from these materials and shapes, so the
// world can be turned and seen from any side. A game re-themes its world by shadowing this one file
// (games/<id>/src/game/terrain.ts): adobe and saloons, brass boilers, neon towers, ink-wash pagodas.
// A game that wants a shape the kit can't make shadows ../render/props.ts and adds a builder.

export type Roof = "gable" | "hip" | "flat" | "dome" | "pagoda" | "barrel";
export type Tree = "round" | "pine" | "palm" | "cactus" | "dead" | "pylon" | "blossom" | "bamboo";
export type Lamp = "post" | "brazier" | "neon" | "lantern";

export interface Materials {
  /** Masonry: walls, towers, wells, plinths. */
  stone: string; stoneDark: string;
  /** House walls. */
  plaster: string; plaster2: string;
  timber: string; timberDark: string;
  /** Roofs: houses, then the grander buildings. */
  roof: string; roof2: string;
  thatch: string;
  /** Awnings, banners, stall canopies (two colours stripe). */
  cloth: string; cloth2: string;
  metal: string;
  foliage: string; foliage2: string;
  trunk: string;
  rock: string;
  /** Lit windows, lamps, signs. */
  glow: string;
  door: string;
  hay: string;
  sack: string;
}

export interface WorldStyle {
  /** Outline colour and width (world units; 0 = no outlines). */
  ink: string; inkW: number;
  /** Direction toward the sun (x across, y toward the player, z up); need not be normalised. */
  light: [number, number, number];
  /** Brightness of faces turned away from the sun (0..1), the colour shade leans toward, and shading bands (0 = smooth). */
  dark: number; tint?: string; bands: number;
  /** Ground shadow under anything standing. */
  shadow: string;
  mat: Materials;
  /** The default roof for houses, and the tree, lamp and window shape of this world. */
  roof: Roof; tree: Tree; lamp: Lamp;
  /** Per-look overrides: height in world units (a unit is about 0.6 tall), wall and roof colour, roof shape. */
  looks?: Record<string, { h?: number; wall?: string; roof?: Roof; roofC?: string }>;
  water: { deep: string; shallow: string; foam: string; bank: string };
  road: { fill: string; edge: string; /** paving joints / wheel ruts / lane dashes */ mark: string; kind: "cobble" | "dirt" | "plank" | "lane" };
  plaza: string;
  bridge: { deck: string; plank: string; rail: string };
  /** Tall grass and reeds (ambush ground): blade colours, and crop colour for cornfields. */
  brush: { a: string; b: string; tip: string; crop: string };
  rubble: string; dust: string; spark: string;
  /** The globe: sky behind it (top, bottom), the soil of its rim (lit, dark), a glow round its edge. */
  sky: [string, string]; soil: [string, string]; halo: string;
  /** Scenery standing around the battlefield, per 100 square units of ground. */
  scenery: { trees: number; rocks: number; houses: number; lamps: number };
}

export const TERRAIN: WorldStyle = {
  ink: "#231c18", inkW: 0.028,
  light: [-0.5, 0.45, 0.8],
  dark: 0.6, tint: "#3b3560", bands: 3,
  shadow: "rgba(10,12,20,0.26)",
  mat: {
    stone: "#b3ac9e", stoneDark: "#8d8778",
    plaster: "#e6d8ba", plaster2: "#d9c7a2",
    timber: "#a87a48", timberDark: "#6f4a2a",
    roof: "#c2553c", roof2: "#4f6f9c",
    thatch: "#c9a85a",
    cloth: "#d8473c", cloth2: "#f3e6c8",
    metal: "#8a8f98",
    foliage: "#5fa04a", foliage2: "#3f7f3c",
    trunk: "#7a5632",
    rock: "#8f8a84",
    glow: "#ffd98a",
    door: "#5d3f1f",
    hay: "#e0bf62",
    sack: "#c9b48a",
  },
  roof: "gable", tree: "round", lamp: "post",
  water: { deep: "#2f6f9f", shallow: "#58a6c9", foam: "rgba(235,250,255,0.75)", bank: "rgba(60,45,30,0.45)" },
  road: { fill: "#c9b48c", edge: "#a08a63", mark: "rgba(90,70,45,0.35)", kind: "cobble" },
  plaza: "#d6c6a2",
  bridge: { deck: "#a47a4a", plank: "#7a5630", rail: "#5d3f1f" },
  brush: { a: "#6fae4a", b: "#4e8f3c", tip: "#b9d86a", crop: "#d9b84a" },
  rubble: "#5a4a3a", dust: "#cdbf9f", spark: "#ffe9a8",
  sky: ["#8fc7e8", "#dff1f4"], soil: ["#7a5a3c", "#3c2a1c"], halo: "rgba(255,255,255,0.35)",
  scenery: { trees: 20, rocks: 3, houses: 1.6, lamps: 0 },
};

/** Which of the game's battlefield backdrops (public/arenas/act<N>) each Arena-mode arena is fought on. */
export const ARENA_BACKDROP: Record<string, number> = {
  "twin-gates": 1, "the-crossing": 3, "crate-yard": 2,
  courtyard: 5, watchtowers: 4, "barricade-pass": 6,
  "old-village": 10, "the-fens": 9, "long-lane": 7,
  bastions: 5, "broken-bridge": 3, switchback: 6,
};
