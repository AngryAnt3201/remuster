// Blackridge's look: the kit's "real" look. No ink and no bands: smooth light over muted materials, cool shadows,
// soft highlights on metal. The only saturated things are the two sides' colours, which are also the only flat ones.
import { DEFAULT_STYLE, type Style, type TeamCols } from "../../../artkit/toon3d";
import { LOOKS } from "../../../artkit/looks";

export const STYLE: Style = {
  ...DEFAULT_STYLE,
  ...LOOKS.real(0.54, 0.55, 0.3),
  ink: "#0b0d0e",
  shadowTint: "#2a3848", shadowAmount: 0.3,
  light: [-0.5, 0.35, 0.9],
  glow: { gain: 0.9, radius: 7 },
};

/** Task Force Halcyon (the player): cold cyan. The Meridian Pact (the rival): signal orange, a step darker.
 *  src/render/style.ts holds the same colours for the HUD. */
export const TEAMS: { tide: TeamCols; ember: TeamCols } = {
  tide: { main: "#2ec4e6", dark: "#0f6f8c", light: "#a8ecff" },
  ember: { main: "#f26a1b", dark: "#9c3a08", light: "#ffc089" },
};
