// Blackridge's tab bar: the base game's five tabs as hairline pictograms (map-symbol weight, no fill, no ink
// outline), each with a short code under it. The open tab is marked with an amber rule (game/theme.css).
// Navigation and swiping are the base game's.
import { sfx, unlockAudio } from "@base/audio/sfx";
import { el } from "@base/ui/dom";
import { TABS, type Badges, type Tab } from "@base/ui/tabs";

export * from "@base/ui/tabs";

const LABEL: Record<Tab, string> = { shop: "Shop", army: "Army", battle: "Battle", modes: "Modes", pass: "Pass" };
const S = `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter" stroke-linecap="square"`;
// 32x32, drawn for this game.
const ICONS: Record<Tab, string> = {
  // a supply crate with a strap and a lifting chevron
  shop: `<path d="M4 11h24v16H4z" ${S}/><path d="M4 16h24M13 11v16M19 11v16" ${S} opacity=".55"/><path d="M11 7l5-3.500 5 3.500" ${S}/>`,
  // a unit symbol: a framed rectangle with the infantry cross and a size mark over it
  army: `<path d="M4 10h24v16H4z" ${S}/><path d="M4 10l24 16M28 10 4 26" ${S} opacity=".55"/><path d="M13 5v2M16 5v2M19 5v2" ${S}/>`,
  // a reticle
  battle: `<circle cx="16" cy="16" r="9" ${S}/><path d="M16 2v8M16 22v8M2 16h8M22 16h8" ${S}/><circle cx="16" cy="16" r="1.600" fill="currentColor"/>`,
  // a radio set: channels
  modes: `<path d="M5 9h22v17H5z" ${S}/><path d="M9 9V3" ${S}/><path d="M9 14h8M9 18h8M9 22h5" ${S} opacity=".55"/><circle cx="22" cy="18" r="2.600" ${S}/>`,
  // a service ribbon: bars and a chevron
  pass: `<path d="M6 5h20v12H6z" ${S}/><path d="M11 5v12M16 5v12M21 5v12" ${S} opacity=".55"/><path d="M8 21l8 6 8-6" ${S}/>`,
};

/** A tab's icon at any size (the bar uses 24 px; the Ops and Tour headers reuse them). */
export function tabIcon(t: Tab, cls = "") {
  const s = el("span", { class: `tb-ico ${cls}`.trim() });
  s.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true">${ICONS[t]}</svg>`;
  return s;
}

/** The bar. `go` runs on a tap of another tab. */
export function tabBar(active: Tab, badges: Badges, go: (t: Tab) => void): HTMLElement {
  const bar = el("nav", { class: "tb-bar br-bar", "aria-label": "Main" });
  for (const t of TABS) {
    const b = badges[t];
    const badge = typeof b === "number" ? (b > 0 ? el("i", { class: "tb-badge" }, [b > 9 ? "9+" : String(b)]) : null) : b ? el("i", { class: "tb-dot" }) : null;
    const btn = el("button", { class: `tb-tab ${t === active ? "on" : ""} ${t === "battle" ? "home" : ""}`, "data-tab": t, "aria-label": LABEL[t], ...(t === active ? { "aria-current": "page" } : {}) }, [
      el("span", { class: "tb-face" }, [tabIcon(t), ...(badge ? [badge] : [])]),
      el("b", { class: "tb-label" }, [LABEL[t]]),
    ]);
    btn.addEventListener("click", () => {
      unlockAudio();
      if (t === active) return;
      sfx("tap");
      go(t);
    });
    bar.append(btn);
  }
  return bar;
}
