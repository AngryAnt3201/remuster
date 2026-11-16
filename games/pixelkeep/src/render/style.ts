// Pixelkeep's style direction for the app: the base game's (art/style/active.json) with the cartridge's own team
// colours, ink, effect tints and UI slots. The battle canvas (health bars, zone wash, callouts: ./palette.ts) and the
// stylesheet's --tide / --ember / --gold variables all read `STYLE` from here, so both sides look the same on the
// board, in the HUD and in the baked art (games/pixelkeep/art/style.ts holds the same team colours).
import { STYLE as BASE, type Style } from "@base/render/style";

export * from "@base/render/style";

export const STYLE: Style = {
  ...BASE,
  outline: { ...BASE.outline, color: "#101018" },
  rim: { color: "#ffffff", strength: 0 },
  team: {
    tide: { main: "#40a0ff", dark: "#0040c0", light: "#c0ffff" },
    ember: { main: "#e02020", dark: "#800000", light: "#ffc080" },
  },
  shadow: { color: "#000020", alpha: 0.4 },
  vfx: {
    ...BASE.vfx,
    slash: "#ffffff", spark: "#ffff80", fire: "#ff8000", fire_hot: "#ffff80", smoke: "#bfbfbf",
    frost: "#80ffff", zap: "#ffff40", heal: "#80ff40", arcane: "#ff80ff", gold: "#ffbf00", dust: "#ffbf80",
  },
  ui: {
    font: "Press Start 2P", panel: "#000000", panel_dk: "#101040", frame: "#ffffff", accent: "#ffbf00",
    text: "#ffffff", text_lt: "#ffffff", button: "#101040", button_dk: "#000000", danger: "#ff4040", page: "#080820",
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
