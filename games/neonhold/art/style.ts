// Neonhold's look: the kit's neon look (dark fills, every edge a tube of the part's own colour, a soft halo), with
// a little more fill than the default so bodies have a lit surface on a dark street.
import { DEFAULT_STYLE, type Style, type TeamCols } from "../../../artkit/toon3d";
import { LOOKS } from "../../../artkit/looks";

export const STYLE: Style = {
  ...DEFAULT_STYLE,
  ink: "#07051a",
  ...LOOKS.neon(0.3),
  outline: 2.6, inner: 1.5,
  bands: { t: [0.3, 0.68], v: [0.5, 0.78, 1] },
  light: [-0.35, 0.4, 1],
  glow: { gain: 0.9, radius: 6 },
};

/** Argon cyan against neon-gas orange-red: far apart in lightness and on the blue/yellow axis, and neither is a
 *  colour the city's own signage uses. */
export const TEAMS: { tide: TeamCols; ember: TeamCols } = {
  tide: { main: "#1fe5ff", dark: "#0b7fa8", light: "#b8f9ff" },
  ember: { main: "#ff5630", dark: "#a8260f", light: "#ffc4a6" },
};
