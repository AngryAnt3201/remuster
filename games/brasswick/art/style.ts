// Brasswick's look: thick sepia ink, three warm bands, plum shadows, a gaslight rim.
import { DEFAULT_STYLE, type Style, type TeamCols } from "../../../artkit/toon3d";

export const STYLE: Style = {
  ...DEFAULT_STYLE,
  ink: "#2a1a12",
  outline: 3, inner: 1.5,
  bands: { t: [0.3, 0.68], v: [0.56, 0.8, 1] },
  shadowTint: "#5b3f86", shadowAmount: 0.4,
  rim: { color: "#ffe6b0", strength: 0.36, width: 0.3 },
  light: [-0.35, 0.4, 1],
  glow: { gain: 0.9, radius: 7 },
  grade: { saturation: 1.06, contrast: 1.03, warmth: 0.04 },
};

/** Verdigris against furnace red: the player's Tide and the rival's Ember, kept close to the base game's hues so
 *  the HUD's team colours still match. */
export const TEAMS: { tide: TeamCols; ember: TeamCols } = {
  tide: { main: "#2fc8b6", dark: "#157a73", light: "#a9fff0" },
  ember: { main: "#f5623f", dark: "#a32f1e", light: "#ffc7b0" },
};
