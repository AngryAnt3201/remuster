// The Muster UI kit: role families, glyphs and icons shared by every screen. Look lives in styles.css.
// Colours come from the active style direction (art/style/<name>.json `ui.*`), set on <html data-style>.
import type { Role } from "@engine/core/defs";

/** Style directions the kit has palettes for. The default follows art/style/active.json. */
export const UI_STYLES = ["meadow", "dusk", "toy"] as const;
export type UIStyle = (typeof UI_STYLES)[number];
export const DEFAULT_UI_STYLE: UIStyle = "meadow";

export function applyUIStyle(name?: string | null) {
  const s = (UI_STYLES as readonly string[]).includes(name ?? "") ? (name as UIStyle) : DEFAULT_UI_STYLE;
  document.documentElement.dataset.style = s;
  return s;
}

/** Card frame colour family per role. */
export type Family = "might" | "guard" | "shot" | "arcane" | "shadow" | "works" | "air";
export const ROLE_FAMILY: Record<Role, Family> = {
  melee: "might", cavalry: "might",
  tank: "guard",
  ranged: "shot", artillery: "shot",
  caster: "arcane", support: "arcane",
  assassin: "shadow",
  structure: "works", spawner: "works", trap: "works", siege: "works",
  air: "air",
};
export const ROLE_LABEL: Record<Role, string> = {
  melee: "Melee", cavalry: "Cavalry", tank: "Tank", ranged: "Ranged", artillery: "Artillery", caster: "Caster",
  support: "Support", assassin: "Assassin", structure: "Structure", spawner: "Spawner", trap: "Trap", siege: "Siege", air: "Air",
};

// 24x24 glyphs, filled with currentColor. Drawn for this game, simple shapes that read at 12 px.
const ROLE_PATHS: Record<Role, string> = {
  melee: '<path d="M18.6 2.4 21.6 5.4 10.4 16.6 7.4 13.6z"/><path d="M4.6 12.4l7 7-1.7 1.7-2.1-2.1-3.3 3.3-1.7-1.7 3.3-3.3-2.1-2.1z"/>',
  tank: '<path d="M12 2 20.5 5v6.2c0 5-3.6 8.6-8.5 10.8C7.1 19.8 3.5 16.2 3.5 11.2V5z"/>',
  ranged: '<path d="M4 3.5c8.6 1.3 15.2 7.9 16.5 16.5l-2.4.4C17 13 11 7 3.6 5.9z"/><path d="M3 19.6 15.2 7.4l-.6-2.8 4-1.1-1 4.1-2.9-.6L2.5 19.1 3 19.6z"/><path d="M2.3 21.7 1.6 19l2.5-.6.6 2.6z"/>',
  support: '<path d="M9 2.5h6v6.5h6.5v6H15v6.5H9V15H2.5V9H9z"/>',
  artillery: '<circle cx="10.5" cy="13.5" r="7.5"/><path d="M14.8 6.6 18 3.4l2.6 2.6-3.2 3.2z"/><circle cx="21" cy="3" r="1.6"/>',
  assassin: '<path d="M15.5 2A10.2 10.2 0 1 0 22 17.6 8.2 8.2 0 0 1 15.5 2z"/>',
  cavalry: '<path d="M4.5 3.5h4.5V12a3 3 0 0 0 6 0V3.5h4.5V12a7.5 7.5 0 0 1-15 0z"/>',
  structure: '<path d="M4.5 3h3.2v3h2.6V3h3.4v3h2.6V3h3.2v6.3L17.5 11v10h-11V11L4.5 9.3z"/>',
  caster: '<path d="M14.5 1.5 4.5 14h6.5l-2.2 8.5L19.5 9H13z"/>',
  spawner: '<path d="M12 2l8.6 5v10L12 22l-8.6-5V7z"/>',
  trap: '<circle cx="12" cy="12" r="6"/><path d="M11 1h2v5h-2zM11 18h2v5h-2zM1 11h5v2H1zM18 11h5v2h-5z"/>',
  siege: '<path d="M2.5 5h12.5v7H2.5z"/><path d="M15 6.5h4.5v4H15z"/><path d="M7.2 12h3.3v10H7.2z"/>',
  air: '<path d="M1.5 14.5c6.4-.8 10.6-5.2 12.6-11.4 1.3 4 .3 7.3-1.8 9.5 3.3-1 6.6-1 10.2.2-3 2-6.2 3-9.4 3.1 2 1.2 3.1 3.3 3.2 6.3-3.1-2.2-6.3-3.3-9.4-4-2.3-.3-4.2-1.4-5.4-3.7z"/>',
};

const ICON_PATHS: Record<string, string> = {
  star: '<path d="M12 1.6l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L12 18l-6.5 3.5 1.3-7.2L1.5 9.2l7.3-1z"/>',
  back: '<path d="M16.5 3.5 8 12l8.5 8.5-3 3L2 12 13.5.5z"/>',
  pause: '<path d="M5 3h5v18H5zM14 3h5v18h-5z"/>',
  lock: '<path d="M7 10V7.5a5 5 0 0 1 10 0V10h-2.8V7.5a2.2 2.2 0 0 0-4.4 0V10z"/><path d="M4.5 10h15v11.5h-15z"/>',
  flag: '<path d="M4 2h2.4v20H4z"/><path d="M6.4 3h13l-3.4 4.8 3.4 4.8h-13z"/>',
  reroll: '<path d="M12 3.5a8.5 8.5 0 0 1 7.7 4.9L22 7l-.6 7.4-6.8-2.9 2.4-1.4A5.4 5.4 0 1 0 17.4 14l3 1A8.5 8.5 0 1 1 12 3.5z"/>',
  crown: '<path d="M2.5 7.5 7.4 12 12 4.5l4.6 7.5 4.9-4.5-2 12H4.5z"/>',
  sword: ROLE_PATHS.melee,
  shield: ROLE_PATHS.tank,
  check: '<path d="M2.5 12.5 6 9l3.8 3.8L18 4.5l3.5 3.5L9.8 19.8z"/>',
  flame: '<path d="M12.5 1.5c1 3.6 5.6 6.4 6.6 11 .9 4.6-2.3 9.5-7.1 9.5S4 19 4.4 14.6c.3-3 2.2-4.8 3.6-6.6.3 1.9 1.1 3.2 2.4 3.9-.4-3.9.7-7.2 2.1-10.4z"/>',
};

function svg(paths: string, cls: string) {
  const s = document.createElement("span");
  s.className = `glyph ${cls}`;
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${paths}</svg>`;
  return s;
}
export const roleGlyph = (r: Role) => svg(ROLE_PATHS[r], `role-glyph role-${r}`);
export const icon = (name: keyof typeof ICON_PATHS, cls = "") => svg(ICON_PATHS[name], `icon icon-${name} ${cls}`);

/** A role badge: family-coloured disc with the role glyph. */
export function roleBadge(r: Role, cls = "") {
  const b = document.createElement("span");
  b.className = `role-badge fam-${ROLE_FAMILY[r]} ${cls}`;
  b.title = ROLE_LABEL[r];
  b.append(roleGlyph(r));
  return b;
}

/** A gold coin with a number on it (costs). */
export function coin(n: number | string, cls = "") {
  const c = document.createElement("span");
  c.className = `coin ${cls}`;
  c.textContent = String(n);
  return c;
}

/** Inline HTML for a star (for innerHTML strings such as banners). */
export const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${ICON_PATHS.star}</svg>`;

/** A faceted gem (premium currency), drawn for this game: cool blue-violet cut stone with an ink outline. */
export function gem(cls = "") {
  const g = document.createElement("span");
  g.className = `gem ${cls}`;
  g.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true">'
    + '<path d="M9 4h14l7 8.5L16 29 2 12.5z" fill="#2b1d14"/>'
    + '<path d="M10 6h12l5.4 6.6L16 26.2 4.6 12.6z" fill="#6fc8ff"/>'
    + '<path d="M10 6h12l-3 6.6h-6z" fill="#c9f1ff"/>'
    + '<path d="M4.6 12.6h8.4L16 26.2z" fill="#3f8de0"/>'
    + '<path d="M19 12.6h8.4L16 26.2z" fill="#7a5fe0"/>'
    + '<path d="M13 12.6h6L16 26.2z" fill="#58aaf5"/>'
    + '<path d="M10 6l3 6.6H4.6z" fill="#a3e2ff"/><path d="M22 6l5.4 6.6H19z" fill="#9b8cff"/>'
    + '<path d="M11.2 7.4h3l-1.4 2.8z" fill="#fff" opacity=".85"/></svg>';
  return g;
}


/** Changes a currency pill's value; it hops when the number goes up. */
export function setPill(pill: HTMLElement, value: number | string) {
  const b = pill.querySelector("b");
  if (!b) return;
  const next = typeof value === "number" ? value.toLocaleString("en") : value;
  if (b.textContent === next) return;
  const up = Number(String(value).replace(/,/g, "")) > Number((b.textContent || "0").replace(/,/g, ""));
  b.textContent = next;
  if (up) { pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); }
}
