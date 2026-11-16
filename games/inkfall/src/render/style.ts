// Inkfall's style direction for the app: the base game's (art/style/active.json) with the two clans' colours, ink
// outlines, effect tints as ink tones and paper UI slots. The battle canvas (health bars, zone wash, callouts:
// ./palette.ts) and the stylesheet's --tide / --ember / --gold variables all read `STYLE` from here, so both sides
// look the same on the board, in the HUD and in the baked art (games/inkfall/art/style.ts holds the same colours).
import { STYLE as BASE, type Style } from "@base/render/style";

export * from "@base/render/style";

export const STYLE: Style = {
  ...BASE,
  outline: { ...BASE.outline, color: "#1d1a17" },
  rim: { color: "#ffffff", strength: 0 },
  team: {
    tide: { main: "#1f5878", dark: "#123a52", light: "#8fd3d6" },
    ember: { main: "#e2482b", dark: "#9a2716", light: "#ffb690" },
  },
  shadow: { color: "#3b3833", alpha: 0.3 },
  vfx: {
    ...BASE.vfx, blend: "normal", glow: 0,
    slash: "#1d1a17", spark: "#1d1a17", fire: "#3b3833", fire_hot: "#9a2716", smoke: "#6f6a62",
    frost: "#5f8796", zap: "#2a2a30", heal: "#4f8a66", arcane: "#5a5068", gold: "#9c7a2e", dust: "#8f8a80",
  },
  ui: {
    font: "Yuji Syuku", panel: "#f7f1e1", panel_dk: "#e6dcc4", frame: "#1d1a17", accent: "#c8321e",
    text: "#1d1a17", text_lt: "#6f6a62", button: "#1d1a17", button_dk: "#000000", danger: "#9a2716", page: "#efe6d0",
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
