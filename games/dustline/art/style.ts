// Dustline's look: burnt-umber ink, hard noon light from high overhead, short plum shadows, a hot sand-coloured rim.
import { DEFAULT_STYLE, type Style, type TeamCols } from "../../../artkit/toon3d";

export const STYLE: Style = {
  ...DEFAULT_STYLE,
  ink: "#2a1608",
  outline: 3.2, inner: 1.5,
  bands: { t: [0.26, 0.62], v: [0.5, 0.78, 1] },
  shadowTint: "#6a2f58", shadowAmount: 0.46,
  rim: { color: "#fff0bf", strength: 0.42, width: 0.34 },
  light: [-0.3, 0.3, 1],
  glow: { gain: 0.85, radius: 7 },
  grade: { saturation: 1.1, contrast: 1.06, warmth: 0.06 },
};

/** The Star (the player's lawmen): light denim-sky blue. The Brand (the rival's outlaws): dark bandana red. Light
 *  and cool against dark and warm, so the sides separate in lightness as well as hue. The HUD takes the same colours
 *  from games/dustline/src/render/style.ts. */
export const TEAMS: { tide: TeamCols; ember: TeamCols } = {
  tide: { main: "#45a3ec", dark: "#1c5c9c", light: "#bfe4ff" },
  ember: { main: "#d63b2a", dark: "#861d12", light: "#ffb9a3" },
};
