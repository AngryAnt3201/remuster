// Dustline's style direction for the app: the base game's (art/style/active.json) with the frontier's own team
// colours, ink, effect tints and UI slots. The battle canvas (health bars, zone wash, callouts: ./palette.ts) and the
// stylesheet's --tide / --ember / --gold variables all read `STYLE` from here, so both sides look the same on the
// board, in the HUD and in the baked art (games/dustline/art/style.ts holds the same team colours).
import { STYLE as BASE, type Style } from "@base/render/style";

export * from "@base/render/style";

export const STYLE: Style = {
  ...BASE,
  outline: { ...BASE.outline, color: "#2a1608" },
  rim: { color: "#fff0bf", strength: 0.42 },
  team: {
    tide: { main: "#45a3ec", dark: "#1c5c9c", light: "#bfe4ff" },
    ember: { main: "#d63b2a", dark: "#861d12", light: "#ffb9a3" },
  },
  shadow: { color: "#3a1c14", alpha: 0.36 },
  vfx: {
    ...BASE.vfx,
    slash: "#fff6dc", spark: "#ffe08a", fire: "#ff9a3a", fire_hot: "#fff2b4", smoke: "#b9a892",
    frost: "#cfeefc", zap: "#d6f0ff", heal: "#9cf28a", arcane: "#e2a93b", gold: "#f2b632", dust: "#e6cfa2",
  },
  ui: {
    font: "Rye", panel: "#ecd9ae", panel_dk: "#c9a86a", frame: "#6e4526", accent: "#e2a93b",
    text: "#2a1608", text_lt: "#fff3d6", button: "#b5372a", button_dk: "#7a2018", danger: "#8f1d16", page: "#8a5a34",
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
