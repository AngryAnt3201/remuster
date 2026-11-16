// Inkfall's look: the kit's `paper` look (every material becomes a pale wash of itself on the paper colour, under a
// heavy black line), tuned for sumi-e rather than pen drawing:
//   - the lowest shade band is switched off (the paper look cross-hatches it; a brush painting has washes, not hatching),
//     so a part is one of two wash strengths, lit or shaded;
//   - parts that must be solid (ink-black armour and hair, the side's colour) are materials with `emit`, which the
//     paper look leaves at full strength. That is what gives every unit a dark silhouette and one flat area of its
//     side's colour on the pale ground.
import { DEFAULT_STYLE, type Style, type TeamCols } from "../../../artkit/toon3d";
import { LOOKS } from "../../../artkit/looks";

export const PAPER = "#efe6d0";
export const INK = "#1d1a17";

export const STYLE: Style = {
  ...DEFAULT_STYLE,
  ...LOOKS.paper(PAPER),
  ink: INK,
  outline: 3.6, inner: 1.5,
  bands: { t: [-5, 0.52], v: [0.6, 0.8, 1] },
  shadowTint: "#3a3630", shadowAmount: 0,
  light: [-0.4, 0.35, 1],
  glow: { gain: 0, radius: 0 },
};

/** The Indigo clan (the player): dark and cool. The Vermilion clan (the rival): bright and warm. About 20 points of
 *  lightness apart as well as opposite in hue. src/render/style.ts holds the same colours for the HUD. */
export const TEAMS: { tide: TeamCols; ember: TeamCols } = {
  tide: { main: "#1f5878", dark: "#123a52", light: "#8fd3d6" },
  ember: { main: "#e2482b", dark: "#9a2716", light: "#ffb690" },
};
