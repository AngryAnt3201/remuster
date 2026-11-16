// The v3 art direction in the app: the same parameter files the Blender renderers read (art/style/,
// docs/ART-V3.md). `STYLE` is the active direction (art/style/active.json). The in-game palette, and later
// the atlas, arena, keep, VFX and UI renderers, take their colours from here, so switching the direction
// (`npm run style:pick -- <id>`) restyles the game and the art pipeline together.
import active from "../../../art/style/active.json";
import contractJson from "../../../art/style/contract.json";
import dusk from "../../../art/style/dusk.json";
import meadow from "../../../art/style/meadow.json";
import toy from "../../../art/style/toy.json";

export type StyleId = "meadow" | "dusk" | "toy";
type Shades = { main: string; dark: string; light: string };

/** One style direction. Only the slots the app reads are typed; the files hold more (see docs/ART-V3.md). */
export interface Style {
  id: StyleId;
  name: string;
  pitch: string;
  outline: { hull: number; props: number; color: string; silhouette_px: number };
  rim: { color: string; strength: number };
  team: { tide: Shades; ember: Shades };
  shadow: { color: string; alpha: number };
  grade: { saturation: number; contrast: number; vignette: number; warmth: number };
  vfx: {
    blend: "additive" | "normal"; glow: number;
    slash: string; spark: string; fire: string; fire_hot: string; smoke: string;
    frost: string; zap: string; heal: string; arcane: string; gold: string; dust: string;
  };
  ui: {
    font: string; panel: string; panel_dk: string; frame: string; accent: string;
    text: string; text_lt: string; button: string; button_dk: string; danger: string; page: string;
  };
  keep: { stone: string; stone_dk: string; roof: string; trim: string; wood: string; window: string; window_glow: boolean };
}

export const STYLES = { meadow, dusk, toy } as unknown as Record<StyleId, Style>;
export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

export const styleById = (id: string): Style => {
  const st = STYLES[id as StyleId];
  if (!st) throw new Error(`unknown style direction "${id}"; expected one of ${STYLE_IDS.join(", ")}`);
  return st;
};

/** The active direction: provisional until Jack's pick, then the one all v3 art is produced in. */
export const STYLE: Style = styleById(active.direction);

/** Shared camera, facing, atlas, arena and VFX layout (art/style/contract.json). */
export const CONTRACT = contractJson;

/** "#rrggbb" -> "rgba(r,g,b," so callers can append an alpha and ")". */
export function rgbaPrefix(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},`;
}

export const rgba = (hex: string, a: number) => `${rgbaPrefix(hex)}${a})`;

/** CSS custom properties for a direction: the stylesheet's team and gold colours, plus every UI slot as
 *  `--ui-<slot>` and the outline colour as `--style-ink` for the UI kit. */
export function styleVars(st: Style = STYLE): Record<string, string> {
  const v: Record<string, string> = {
    "--tide": st.team.tide.main, "--tide-d": st.team.tide.dark,
    "--ember": st.team.ember.main, "--ember-d": st.team.ember.dark,
    "--gold": st.vfx.gold, "--style-ink": st.outline.color,
  };
  for (const [k, x] of Object.entries(st.ui)) v[`--ui-${k.replace(/_/g, "-")}`] = String(x);
  return v;
}

export function applyStyleVars(el: HTMLElement, st: Style = STYLE): void {
  el.dataset.style = st.id;
  for (const [k, x] of Object.entries(styleVars(st))) el.style.setProperty(k, x);
}
