// Cindermaw's look: the kit's `grit` look. Sprites are rendered small with no ink, a hard top light and a dark
// silhouette edge, then noised and dithered to a few shades per channel, like figures digitised for a 1993 shooter.
//
// Each asset family is rendered at a different pixels-per-unit, and the look's `scale` is one number, so (as
// Pixelkeep does) `STYLE.look` is a getter that answers per family by reading which bake function is asking from the
// call stack (the bake page runs unminified in Vite's dev server, so function names are intact).
import { DEFAULT_STYLE, type Style, type TeamCols } from "../../../artkit/toon3d";

type Look = NonNullable<Style["look"]>;
const grit = (scale: number, levels = 6, noise = 0.7): Look => ({ kind: "grit", scale, levels, noise, contrast: 1.1 });
let smoothStamps = false;
/** Paintings that are crushed whole afterwards (maps, key art) ask for their stamped models un-dithered. */
export const setSmoothStamps = (on: boolean) => { smoothStamps = on; };

function lookNow(): Look {
  const s = new Error().stack ?? "";
  if (/\bportraits\b/.test(s)) return grit(4, 6, 0.8);
  if (/\bbakeArena\b/.test(s)) return grit(3, 6);
  if (/\bbakeKeep\b/.test(s)) return grit(3, 6);
  if (/\bvfx\b/.test(s)) return grit(3, 6, 0.2);
  if (/Stamps|\bsprite\b/.test(s)) return smoothStamps ? grit(1, 32, 0.25) : grit(3, 6);
  return grit(2, 6); // unit sheets: the battle canvas pixelates them again at about the same size
}

export const STYLE: Style = {
  ...DEFAULT_STYLE,
  ink: "#0a0605", outline: 0, inner: 0,
  bands: { t: [0.3, 0.68], v: [0.4, 0.72, 1] },
  shadowTint: "#3a0c08", shadowAmount: 0.3,
  rim: { color: "#ffffff", strength: 0, width: 0.3 },
  light: [-0.45, 0.25, 1],
  glow: { gain: 0, radius: 0 },
  get look(): Look { return lookNow(); },
};

/** The 9th: toxic green. The Maw: hot blood red. Bright and acid against deep and hot, so the sides separate in
 *  lightness as well as hue. src/render/style.ts holds the same colours for the HUD. */
export const TEAMS: { tide: TeamCols; ember: TeamCols } = {
  tide: { main: "#8cf02a", dark: "#2c6a10", light: "#e4ff9a" },
  ember: { main: "#e0240c", dark: "#6a0c06", light: "#ffb060" },
};
