// Neonhold's art direction for the app: the base direction with the game's own team colours (Volt cyan against Blaze
// orange-red), effect tints and UI slots. Everything the canvas HUD draws in a side's colour (health bars, zone wash,
// range rings, banners) and the CSS tokens main.ts writes on <html> come from here, so nothing shows the base game's
// teal, orange or parchment. Types, the contract and the other directions are the base game's.
import { STYLE as BASE, rgba, rgbaPrefix, type Style } from "@base/render/style";

export * from "@base/render/style";

export const STYLE: Style = {
  ...BASE,
  name: "Neonhold",
  pitch: "Wet asphalt at 2 a.m.: dark bodies read by glowing edges, argon cyan against neon-gas orange-red.",
  outline: { ...BASE.outline, color: "#07051a" },
  rim: { color: "#d9c8ff", strength: 0.3 },
  team: {
    tide: { main: "#1fe5ff", dark: "#0b7fa8", light: "#b8f9ff" },
    ember: { main: "#ff5630", dark: "#a8260f", light: "#ffc4a6" },
  },
  shadow: { color: "#07051a", alpha: 0.5 },
  vfx: {
    blend: "additive", glow: 1.25,
    slash: "#f4f0ff", spark: "#fff36b", fire: "#ff4de1", fire_hot: "#ffe6fb", smoke: "#4a4670",
    frost: "#a8ecff", zap: "#d8c4ff", heal: "#5dffa0", arcane: "#c05cff", gold: "#ffc53d", dust: "#6f6a9c",
  },
  ui: {
    font: "Chakra Petch", panel: "#0c0a22", panel_dk: "#070517", frame: "#8a5cff", accent: "#ff2bd6",
    text: "#e9f3ff", text_lt: "#ffffff", button: "#d4ff3a", button_dk: "#7f9a12", danger: "#ff2e5b", page: "#141233",
  },
  keep: { ...BASE.keep, stone: "#2a2850", stone_dk: "#17153a", trim: "#ff2bd6", window_glow: true },
};

/** CSS custom properties for the direction (the base function with this game's STYLE as the default). */
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

export { rgba, rgbaPrefix };
