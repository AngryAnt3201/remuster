// Pixelkeep's look: the kit's `pixel` look (render small, scale up with hard pixels, short palette), one art pixel of
// black ink, three flat shades per material and no rim light, no gradients, no soft shadows.
//
// One thing the kit does not do by itself: every asset family is rendered at a different pixels-per-unit (unit sheets
// at 128, portraits at up to 330, keeps at 128 but drawn larger, obstacle props at 160 per radius), and the pixel
// look's `scale` is one number for the whole game, so the art pixels would come out a different size in each family.
// The battle canvas is drawn on a low-resolution grid (src/render/board.ts: one canvas pixel = one backdrop art
// pixel), so every family must bake its art pixels at about that size. `STYLE.look` is therefore a getter that
// answers per family: it reads which bake function is asking from the call stack (the bake page runs unminified in
// Vite's dev server, so function names are intact), plus a flag the arena builders set between scenery and props.
// Models that stand in a painting (arena scenery, stamps in maps, key art, Bastion grounds) are rendered smooth and
// the whole painting is cut to blocks afterwards by art/pixel.ts, so it has one grid.
import { DEFAULT_STYLE, type Style, type TeamCols } from "../../../artkit/toon3d";

/** Backdrop pixels per art pixel (the backdrop is 1456 wide: 364 art pixels across). The board canvas uses the same. */
export const ARENA_PX = 4;
/** Shades per colour channel: 5 gives 125 possible colours, of which the materials use a few dozen. */
export const LEVELS = 5;

type Look = NonNullable<Style["look"]>;
let arenaPhase: "scenery" | "props" = "scenery";
/** Arena builders call this: scenery is rendered smooth and pixelated with the ground (one grid for the whole
 *  backdrop); props are separate sprites and take the pixel look. */
export const setArenaPhase = (p: "scenery" | "props") => { arenaPhase = p; };

function lookNow(): Look {
  const s = new Error().stack ?? "";
  const px = (scale: number): Look => ({ kind: "pixel", scale, levels: LEVELS });
  if (/\bportraits\b/.test(s)) return px(6);
  if (/\bbakeArena\b/.test(s)) return arenaPhase === "scenery" ? { kind: "toon" } : px(11);
  if (/\bbakeKeep\b/.test(s)) return px(5);
  if (/\bvfx\b/.test(s)) return px(4);
  if (/Stamps|\bsprite\b/.test(s)) return { kind: "toon" };
  return px(4); // unit sheets and previews: 128 / 4 = 32 art pixels per world unit
}
/** Ink weight for models rendered smooth and cut to blocks afterwards (arena scenery, stamps in maps, key art and
 *  Bastion grounds), in output pixels at 128 px per unit: set it so the line is about one block wide. */
let inkPx = 5.2;
export const setInk = (px128: number) => { inkPx = px128; };

export const STYLE: Style = {
  ...DEFAULT_STYLE,
  ink: "#101018",
  // (the pixel look sets its own one-art-pixel line; this is for the smooth renders that are cut to blocks later)
  get outline() { return inkPx; }, get inner() { return inkPx * 0.5; },
  bands: { t: [0.3, 0.68], v: [0.5, 0.75, 1] },
  shadowTint: "#202060", shadowAmount: 0.12,
  rim: { color: "#ffffff", strength: 0, width: 0.3 },
  light: [-0.4, 0.35, 1],
  glow: { gain: 0, radius: 0 },
  get look(): Look { return lookNow(); },
};

/** Player One: light sky blue. The CPU: dark cartridge red. Light and cool against dark and warm, so the two sides
 *  separate in lightness as well as hue. src/render/style.ts holds the same colours for the HUD. */
export const TEAMS: { tide: TeamCols; ember: TeamCols } = {
  tide: { main: "#40a0ff", dark: "#0040c0", light: "#c0ffff" },
  ember: { main: "#e02020", dark: "#800000", light: "#ffc080" },
};
