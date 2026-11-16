// Inkfall's tab bar: the base game's five tabs as ink drawings on a strip of paper. Each icon is one or two brush
// shapes in black with a single touch of seal red; the open tab gets a seal mark under it (game/theme.css).
// Navigation and swiping are the base game's.
import { sfx, unlockAudio } from "@base/audio/sfx";
import { el } from "@base/ui/dom";
import { TABS, type Badges, type Tab } from "@base/ui/tabs";

export * from "@base/ui/tabs";

const LABEL: Record<Tab, string> = { shop: "Shop", army: "Army", battle: "Battle", modes: "Modes", pass: "Pass" };
const INK = "#1d1a17", SEAL = "#c8321e", PAPER = "#f7f1e1";
// 32x32, drawn for this game.
const ICONS: Record<Tab, string> = {
  // a string of coppers: three round coins with square holes on a cord
  shop: `<path d="M4 27C9 22 22 9 28 4" fill="none" stroke="${SEAL}" stroke-width="1.6" stroke-linecap="round"/>`
    + [[9.5, 22.5, 6], [16, 16, 6.4], [22.5, 9.5, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><rect x="${x - 1.9}" y="${y - 1.9}" width="3.8" height="3.8" fill="${PAPER}" transform="rotate(12 ${x} ${y})"/>`).join(""),
  // a war helmet: bowl, flared neck guard, an upswept crest
  army: `<path d="M16 7.5c6 0 10 4 10.5 10.5l3 6.5c-4.4 1.6-8 2.4-13.5 2.4S6.900 26.100 2.500 24.500l3-6.500C6 11.500 10 7.500 16 7.500z" fill="${INK}"/>`
    + `<path d="M9.500 19.500c4.200 1.300 8.800 1.300 13 0" fill="none" stroke="${PAPER}" stroke-width="1.500" stroke-linecap="round"/>`
    + `<path d="M16 9.500C14.500 6 11 3.600 7 2.500c1 3.200 3.600 6 9 7zM16 9.500c1.500-3.500 5-5.900 9-7-1 3.200-3.600 6-9 7z" fill="${SEAL}"/>`,
  // two crossed swords, curved
  battle: `<path d="M5 5c6.500 3.500 13.500 10 19.500 19.500l-2.600 2C16.500 17 10.500 11 4.200 7.200z" fill="${INK}"/><path d="M27 5c-6.500 3.500-13.500 10-19.500 19.500l2.600 2C15.500 17 21.500 11 27.800 7.200z" fill="${INK}"/>`
    + `<path d="M19.500 20.500l5.500-3.500M12.500 20.500 7 17" stroke="${INK}" stroke-width="2.600" stroke-linecap="round"/><circle cx="16" cy="13.200" r="2.300" fill="${SEAL}"/>`,
  // an open folding fan
  modes: `<path d="M16 27 2.800 12.500C6.200 7.800 10.800 5.500 16 5.500s9.800 2.300 13.200 7z" fill="${INK}"/>`
    + `<path d="M16 26 9 8.500M16 26V6.500M16 26l7-17.500" stroke="${PAPER}" stroke-width="1.100"/><path d="M6.200 14.500c2.800-3.200 6-4.800 9.800-4.800s7 1.600 9.800 4.800" fill="none" stroke="${PAPER}" stroke-width="1.300"/><circle cx="16" cy="26.500" r="2.400" fill="${SEAL}"/>`,
  // a hanging scroll, half unrolled, with a seal on it
  pass: `<path d="M7 5.500h18v19H7z" fill="${INK}"/><path d="M9 7.500h14v15H9z" fill="${PAPER}"/><rect x="4.500" y="3" width="23" height="3.600" rx="1.800" fill="${INK}"/><rect x="4.500" y="23.600" width="23" height="4.400" rx="2.200" fill="${INK}"/>`
    + `<path d="M12 10.500v8M15.500 10.500v5" stroke="${INK}" stroke-width="1.700" stroke-linecap="round"/><rect x="17.800" y="16.300" width="3.700" height="3.700" fill="${SEAL}"/>`,
};

/** A tab's icon at any size (the bar uses 30 px; the Modes and Pass headers reuse them). */
export function tabIcon(t: Tab, cls = "") {
  const s = el("span", { class: `tb-ico ${cls}`.trim() });
  s.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true">${ICONS[t]}</svg>`;
  return s;
}

/** The bar. `go` runs on a tap of another tab; the active tab bounces instead. */
export function tabBar(active: Tab, badges: Badges, go: (t: Tab) => void): HTMLElement {
  const bar = el("nav", { class: "tb-bar ink-bar", "aria-label": "Main" });
  for (const t of TABS) {
    const b = badges[t];
    const badge = typeof b === "number" ? (b > 0 ? el("i", { class: "tb-badge" }, [b > 9 ? "9+" : String(b)]) : null) : b ? el("i", { class: "tb-dot" }) : null;
    const btn = el("button", { class: `tb-tab ${t === active ? "on" : ""} ${t === "battle" ? "home" : ""}`, "data-tab": t, "aria-label": LABEL[t], ...(t === active ? { "aria-current": "page" } : {}) }, [
      el("span", { class: "tb-face" }, [tabIcon(t), ...(badge ? [badge] : [])]),
      el("b", { class: "tb-label" }, [LABEL[t]]),
    ]);
    btn.addEventListener("click", () => {
      unlockAudio();
      if (t === active) { btn.classList.remove("hop"); void btn.offsetWidth; btn.classList.add("hop"); return; }
      sfx("tap");
      go(t);
    });
    bar.append(btn);
  }
  return bar;
}
