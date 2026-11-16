// Dustline's kit: the base game's roles, families and helpers with the frontier's own glyphs. Shields become sheriff
// stars, swords become bowie knives, the bow becomes a revolver, the crown a ten-gallon hat, the banner a wanted
// poster, and the premium currency is a gold nugget instead of a cut gem.
import type { Role } from "@engine/core/defs";
import { ROLE_FAMILY, ROLE_LABEL } from "@base/ui/kit";

export * from "@base/ui/kit";

const STAR5 = '<path d="M12 1.2l2.9 6.4 7 .7-5.2 4.8 1.5 6.9L12 16.4 5.8 20l1.5-6.9L2.1 8.3l7-.7z"/>';
/** A six-pointed tin star with ball tips: the lawman's badge (the base game's shield). */
const BADGE = '<path d="M12 2.6 14.6 7.5 20.1 7.3 17.2 12 20.1 16.7 14.6 16.5 12 21.4 9.4 16.5 3.9 16.7 6.8 12 3.9 7.3 9.4 7.5z"/>'
  + '<circle cx="12" cy="2.4" r="1.6"/><circle cx="12" cy="21.6" r="1.6"/><circle cx="20.4" cy="7.2" r="1.6"/><circle cx="3.6" cy="7.2" r="1.6"/><circle cx="20.4" cy="16.8" r="1.6"/><circle cx="3.6" cy="16.8" r="1.6"/>';
const KNIFE = '<path d="M21.5 2.5c-1 5.2-4 9.4-8.6 12.6l-3-3C13 7.4 17 4 21.5 2.5z"/><path d="M9 12.6l2.4 2.4-1.6 1.6 1.2 1.2-1.6 1.6-1.2-1.2-3.6 3.6-2.4-2.4 3.6-3.6-1.2-1.2 1.6-1.6 1.2 1.2z"/>';

// 24x24 glyphs, filled with currentColor. Drawn for Dustline; each reads at 12 px.
const ROLE_PATHS: Record<Role, string> = {
  melee: KNIFE,
  tank: BADGE,
  // a revolver
  ranged: '<path d="M2 6.5h13.5V5h2v1.5H22v3.6h-8.2c-.2 1.5-1 2.4-2.4 2.8l1.9 6.6H8.2L6.6 13.4C4.5 13.2 3 12 2.6 10.1H2z"/><circle cx="10" cy="9" r="1.3" fill="#000" opacity=".35"/>',
  support: '<path d="M9 2.5h6v6.5h6.5v6H15v6.5H9V15H2.5V9H9z"/>',
  // a bundle of dynamite with a lit fuse
  artillery: '<path d="M4 9h4.4v12H4zM9.8 9h4.4v12H9.8zM15.6 9H20v12h-4.4z"/><path d="M3 12.5h18v3H3z" opacity=".55"/><path d="M11.2 9V6.2c0-2 1.2-3.2 3.4-3.4l.2 1.6c-1.300.200-1.900.800-1.900 1.800V9z"/><circle cx="16.800" cy="2.800" r="1.800"/>',
  // a bandit's mask
  assassin: '<path d="M2 8.500c3.300 1.300 6.700 1.300 10 0 3.300 1.300 6.700 1.300 10 0-.300 5.200-2.400 8-5.800 8-1.800 0-3.200-.800-4.200-2.400-1 1.600-2.400 2.400-4.200 2.400-3.400 0-5.500-2.800-5.800-8z"/><path d="M5.500 11.200h4v2h-4zM14.500 11.200h4v2h-4z" fill="#000" opacity=".4"/>',
  cavalry: '<path d="M4.500 3.500h4.500V12a3 3 0 0 0 6 0V3.500h4.500V12a7.500 7.500 0 0 1-15 0z"/>',
  // a water tower
  structure: '<path d="M12 2 19.500 6v1.500h-15V6z"/><path d="M5.500 8.500h13v7h-13z"/><path d="M6 16.500h2.600l-1.300 5.500H5zM15.400 16.500H18l1 5.500h-2.300z"/><path d="M8 18h8v1.600H8z" opacity=".6"/>',
  caster: '<path d="M14.500 1.500 4.500 14h6.500l-2.200 8.500L19.500 9H13z"/>',
  spawner: '<path d="M12 2l8.600 5v10L12 22l-8.600-5V7z"/>',
  // a bear trap
  trap: '<path d="M2 15.500 5 8l2.200 4.200L9.600 8l2.400 4.200L14.400 8l2.400 4.200L19 8l3 7.500z"/><path d="M2 16.500h20v3.500H2z"/>',
  // a cannon
  siege: '<path d="M2.500 8.500 16 5.500l1.500 6.500L4 15z"/><path d="M16.500 5.200 21 4.200l1.500 6.700-4.500 1z"/><circle cx="8.500" cy="17.500" r="4.500"/><circle cx="8.500" cy="17.500" r="1.600" fill="#000" opacity=".4"/>',
  air: '<path d="M1.500 14.500c6.400-.800 10.600-5.200 12.600-11.400 1.300 4 .300 7.300-1.800 9.500 3.300-1 6.600-1 10.200.200-3 2-6.200 3-9.400 3.100 2 1.200 3.100 3.300 3.200 6.300-3.100-2.200-6.300-3.300-9.400-4-2.300-.300-4.200-1.400-5.400-3.700z"/>',
};

const ICON_PATHS: Record<string, string> = {
  star: STAR5,
  back: '<path d="M16.500 3.500 8 12l8.500 8.500-3 3L2 12 13.500.500z"/>',
  pause: '<path d="M5 3h5v18H5zM14 3h5v18h-5z"/>',
  // a padlock with a keyhole
  lock: '<path d="M7 10V7.500a5 5 0 0 1 10 0V10h-2.800V7.500a2.200 2.200 0 0 0-4.400 0V10z"/><path d="M4.500 10h15v11.500h-15z"/><path d="M11 13.500h2v4.500h-2z" fill="#000" opacity=".4"/>',
  // a guidon: a swallow-tailed cavalry flag
  flag: '<path d="M4 2h2.400v20H4z"/><path d="M6.400 3H20l-4 4.800 4 4.800H6.400z"/>',
  // a dealt hand: two cards
  reroll: '<path d="M3 6.500 12 3.500l4 12-9 3z"/><path d="M13.800 5.200 21 7.600l-3.800 11.400-3.400-1.100 1.500-.500z" opacity=".75"/>',
  // a ten-gallon hat
  crown: '<path d="M7.500 15c0-6 1.300-10 4.500-10s4.500 4 4.500 10z"/><path d="M1.500 13.500c2.500 3.300 6 5 10.500 5s8-1.700 10.500-5c-1 4.300-4.500 6.500-10.500 6.500S2.500 17.800 1.500 13.500z"/><path d="M7.600 13h8.800v2.200H7.600z" fill="#000" opacity=".35"/>',
  sword: KNIFE,
  shield: BADGE,
  check: '<path d="M2.500 12.500 6 9l3.800 3.800L18 4.500l3.500 3.500L9.800 19.800z"/>',
  flame: '<path d="M12.500 1.500c1 3.600 5.600 6.400 6.600 11 .900 4.600-2.300 9.500-7.100 9.500S4 19 4.400 14.600c.300-3 2.200-4.800 3.600-6.600.300 1.900 1.100 3.200 2.400 3.900-.400-3.900.700-7.200 2.100-10.400z"/>',
};

function svg(paths: string, cls: string) {
  const s = document.createElement("span");
  s.className = `glyph ${cls}`;
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${paths}</svg>`;
  return s;
}
export const roleGlyph = (r: Role) => svg(ROLE_PATHS[r], `role-glyph role-${r}`);
export const icon = (name: string, cls = "") => svg(ICON_PATHS[name] ?? STAR5, `icon icon-${name} ${cls}`);

/** A role badge: family-coloured disc with the role glyph. */
export function roleBadge(r: Role, cls = "") {
  const b = document.createElement("span");
  b.className = `role-badge fam-${ROLE_FAMILY[r]} ${cls}`;
  b.title = ROLE_LABEL[r];
  b.append(roleGlyph(r));
  return b;
}

/** Inline HTML for a star (for innerHTML strings such as banners). */
export const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${STAR5}</svg>`;

/** The premium currency: a gold nugget, faceted and inked. */
export function gem(cls = "") {
  const g = document.createElement("span");
  g.className = `gem ${cls}`;
  g.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true">'
    + '<path d="M5 12 11 4l10 1 7 8-2 10-9 6-11-5z" fill="#2a1608"/>'
    + '<path d="M7 12.600 11.800 6.200l8.400.800 5.600 6.600-1.600 8.200-7.400 5-9-4.200z" fill="#f2b632"/>'
    + '<path d="M11.800 6.200l8.400.800-3.600 5.800-6.800 1.200z" fill="#ffe08a"/>'
    + '<path d="M7 12.600l2.800 1.400 1 8.800-3-.200z" fill="#c9861c"/>'
    + '<path d="M16.600 12.800l9.200.800-1.600 8.200-5.800-2z" fill="#d99a22"/>'
    + '<path d="M9.800 14l6.800-1.200 1.800 7-7.600 3z" fill="#ffc93d"/>'
    + '<path d="M10.800 22.800l7.600-3 5.800 2-7.400 5z" fill="#b8741a"/>'
    + '<path d="M12.600 7.800h3.200l-1.600 2.400z" fill="#fff" opacity=".85"/></svg>';
  return g;
}
