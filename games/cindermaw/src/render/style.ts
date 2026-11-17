// Cindermaw's style direction for the app: the base game's (art/style/active.json) with this game's team colours,
// effect tints and UI slots. The battle canvas (health bars, zone wash, callouts: ./palette.ts) and the stylesheet's
// --tide / --ember / --gold variables all read `STYLE` from here, so both sides look the same on the board, in the
// status bar and in the baked art (games/cindermaw/art/style.ts holds the same team colours).
import { STYLE as BASE, type Style } from "@base/render/style";

export * from "@base/render/style";

export const STYLE: Style = {
  ...BASE,
  outline: { ...BASE.outline, color: "#0a0605" },
  rim: { color: "#ffffff", strength: 0 },
  team: {
    tide: { main: "#8cf02a", dark: "#2c6a10", light: "#e4ff9a" },
    ember: { main: "#e0240c", dark: "#6a0c06", light: "#ffb060" },
  },
  shadow: { color: "#000000", alpha: 0.5 },
  vfx: {
    ...BASE.vfx,
    slash: "#ffffff", spark: "#ffe070", fire: "#ff7a1c", fire_hot: "#ffe070", smoke: "#6b5348",
    frost: "#bcf0ff", zap: "#bfe8ff", heal: "#6affb0", arcane: "#b040b0", gold: "#ffb020", dust: "#8f7a66",
  },
  ui: {
    font: "Jersey 10", panel: "#6e6e6e", panel_dk: "#2e2e2e", frame: "#a8a8a8", accent: "#ffb020",
    text: "#e0d4b8", text_lt: "#e0d4b8", button: "#6e6e6e", button_dk: "#2e2e2e", danger: "#b3170d", page: "#120a08",
  },
};

/** CSS custom properties for the direction: the stylesheet's team and gold colours, plus every UI slot as
 *  `--ui-<slot>` and the outline colour as `--style-ink`. */
export function styleVars(st: Style = STYLE): Record<string, string> {
  const v: Record<string, string> = {
    "--tide": st.team.tide.main, "--tide-d": st.team.tide.dark, "--tide-l": st.team.tide.light,
    "--ember": st.team.ember.main, "--ember-d": st.team.ember.dark, "--ember-l": st.team.ember.light,
    "--gold": st.vfx.gold, "--style-ink": st.outline.color,
  };
  for (const [k, x] of Object.entries(st.ui)) v[`--ui-${k.replace(/_/g, "-")}`] = String(x);
  return v;
}

export function applyStyleVars(el: HTMLElement, st: Style = STYLE): void {
  el.dataset.style = st.id;
  for (const [k, x] of Object.entries(styleVars(st))) el.style.setProperty(k, x);
}
