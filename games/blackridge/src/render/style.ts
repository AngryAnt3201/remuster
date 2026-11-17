// Blackridge's style direction for the app: the base game's (art/style/active.json) with the two forces' colours, no
// outline, cold effect tints and the command display's UI slots. The battle canvas (health bars, zone wash, callouts)
// and the stylesheet's --tide / --ember / --gold variables read `STYLE` from here, so both sides look the same on
// the board, in the HUD and in the baked art (games/blackridge/art/style.ts holds the same colours).
import { STYLE as BASE, type Style } from "@base/render/style";

export * from "@base/render/style";

export const STYLE: Style = {
  ...BASE,
  outline: { ...BASE.outline, color: "#0b0f14" },
  rim: { color: "#ffffff", strength: 0 },
  team: {
    tide: { main: "#2ec4e6", dark: "#0f6f8c", light: "#a8ecff" },
    ember: { main: "#f26a1b", dark: "#9c3a08", light: "#ffc089" },
  },
  shadow: { color: "#05070a", alpha: 0.42 },
  vfx: {
    ...BASE.vfx,
    slash: "#e8eef0", spark: "#ffe2a0", fire: "#ff8a2a", fire_hot: "#fff0c8", smoke: "#3a3c3e",
    frost: "#cfeeff", zap: "#bfe6ff", heal: "#7dffa0", arcane: "#9fb8ff", gold: "#ffb000", dust: "#9a917c",
  },
  ui: {
    font: "DIN Condensed", panel: "#121922", panel_dk: "#0b0f14", frame: "#2a3a48", accent: "#ffb000",
    text: "#d6e2ea", text_lt: "#7c8e9c", button: "#18222d", button_dk: "#0b0f14", danger: "#ff4a3a", page: "#0b0f14",
  },
};

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
