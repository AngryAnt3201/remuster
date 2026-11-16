// Pixelkeep's kit: the base game's roles, families and helpers with every glyph redrawn as a 12 x 12 bitmap (see
// ./pixicon.ts): swords, shields, bombs, crowns and stars made of square pixels. The premium currency is a ruby.
// It also hands the stylesheet its pixel pictures (coin, ruby, heart, star, menu cursor) as CSS variables, so
// game/theme.css can paint coins and hearts without a file per icon.
import type { Role } from "@engine/core/defs";
import { ROLE_FAMILY, ROLE_LABEL } from "@base/ui/kit";
import { BITS, COIN_PAL, RUBY_PAL, pix, pixUrl } from "./pixicon";

export * from "@base/ui/kit";

const ROLE_BITS: Record<Role, string[]> = {
  melee: BITS.sword, tank: BITS.shield, ranged: BITS.arrow, support: BITS.plus, artillery: BITS.bomb, assassin: BITS.shuriken,
  cavalry: BITS.horseshoe, structure: BITS.tower, caster: BITS.bolt, spawner: BITS.slime, trap: BITS.spikes, siege: BITS.cannon, air: BITS.bat,
};
const ICON_BITS: Record<string, string[]> = {
  star: BITS.star, back: BITS.back, pause: BITS.pause, lock: BITS.lock, flag: BITS.flag, reroll: BITS.reroll, crown: BITS.crown,
  sword: BITS.sword, shield: BITS.shield, check: BITS.check, flame: BITS.flame,
};

function svg(rows: string[], cls: string) {
  const s = document.createElement("span");
  s.className = `glyph ${cls}`;
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${pix(rows)}</svg>`;
  return s;
}
export const roleGlyph = (r: Role) => svg(ROLE_BITS[r], `role-glyph role-${r}`);
export const icon = (name: string, cls = "") => svg(ICON_BITS[name] ?? BITS.star, `icon icon-${name} ${cls}`);

/** A role badge: a family-coloured square with the role glyph. */
export function roleBadge(r: Role, cls = "") {
  const b = document.createElement("span");
  b.className = `role-badge fam-${ROLE_FAMILY[r]} ${cls}`;
  b.title = ROLE_LABEL[r];
  b.append(roleGlyph(r));
  return b;
}

/** Inline HTML for a star (for innerHTML strings such as banners). */
export const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${pix(BITS.star)}</svg>`;

/** A ruby (the premium currency). */
export function gem(cls = "") {
  const g = document.createElement("span");
  g.className = `gem ${cls}`;
  g.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${pix(BITS.ruby, RUBY_PAL)}</svg>`;
  return g;
}

// the stylesheet's pixel pictures
if (typeof document !== "undefined") {
  const st = document.documentElement.style;
  st.setProperty("--pk-coin", pixUrl(BITS.coin, COIN_PAL));
  st.setProperty("--pk-ruby", pixUrl(BITS.ruby, RUBY_PAL));
  st.setProperty("--pk-heart", pixUrl(BITS.heart));
  st.setProperty("--pk-star", pixUrl(BITS.star));
  st.setProperty("--pk-cursor", pixUrl(BITS.cursor, { "#": "#ffffff" }));
  st.setProperty("--pk-cursor-dk", pixUrl(BITS.cursor, { "#": "#000000" }));
  st.setProperty("--pk-chest", pixUrl(BITS.chest, { "#": "#101018", b: "#bf8040", B: "#ffbf80", d: "#804000", g: "#ffbf00" }));
}
