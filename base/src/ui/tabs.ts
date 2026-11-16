// The home's bottom tab bar (Shop, Army, Battle, Modes, Pass) and the horizontal swipe between tabs.
// main.ts owns navigation: it builds the bar with the active tab and badge values, and decides what each tab shows.
import "./home.css";
import { sfx, unlockAudio } from "../audio/sfx";
import { el } from "./dom";

export const TABS = ["shop", "army", "battle", "modes", "pass"] as const;
export type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { shop: "Shop", army: "Army", battle: "Battle", modes: "Modes", pass: "Pass" };

// 32x32 icons drawn for this game: ink outline, flat colour, one highlight. Read at 26 px.
const INK = "#2b1d14";
const ICONS: Record<Tab, string> = {
  // a market stall with a striped awning
  shop: `<path d="M5 13h22v14H5z" fill="${INK}"/><path d="M7 14.5h18V25H7z" fill="#e9c07a"/><path d="M12.5 18h7v7h-7z" fill="#7a4a26"/>`
    + `<path d="M3 6h26l-1.5 8.5H4.5z" fill="${INK}"/><path d="M5.2 7.8h4.4l-.6 5H5.8zM14 7.8h4l.2 5h-4.4zM22.4 7.8h4.4l-.6 5h-3.2z" fill="#e8553d"/><path d="M9.6 7.8H14l-.2 5H9zM18 7.8h4.4l.6 5h-4.8z" fill="#fff4dd"/>`,
  // a kite shield with a sword behind it
  army: `<path d="M23.6 2.4 27.6 6.4 13 21l-4-4z" fill="${INK}"/><path d="M23.6 4.8 25.2 6.4 12.9 18.7l-1.6-1.6z" fill="#dfe8f2"/>`
    + `<path d="M16 6.5 26 10v7c0 5.6-4.2 9.6-10 12.2C10.2 26.6 6 22.6 6 17v-7z" fill="${INK}"/><path d="M16 9 23.6 11.6V17c0 4.1-3 7.2-7.6 9.4-4.6-2.2-7.6-5.3-7.6-9.4v-5.4z" fill="#4a9be0"/><path d="M16 9v17.4c-4.6-2.2-7.6-5.3-7.6-9.4v-5.4z" fill="#3a7fc4"/><path d="M14.4 12.5h3.2v3.4H21v3.2h-3.4v3.6h-3.2v-3.6H11v-3.2h3.4z" fill="#ffcf4d"/>`,
  // crossed swords
  battle: `<path d="M5.2 3.2 9.4 3.6 25.4 19.6 21.6 23.4 5.6 7.4z" fill="${INK}"/><path d="M7.2 5.2 9 5.4 23.4 19.8 21.8 21.4 7.4 7z" fill="#eef3f8"/>`
    + `<path d="M26.8 3.2 22.6 3.6 6.6 19.6 10.4 23.4 26.4 7.4z" fill="${INK}"/><path d="M24.8 5.2 23 5.4 8.6 19.8 10.2 21.4 24.6 7z" fill="#eef3f8"/>`
    + `<path d="M3 21.5 6.5 18l7.5 7.5-3.5 3.5zM29 21.5 25.5 18 18 25.5l3.5 3.5z" fill="${INK}"/><path d="M5.6 21.6 6.6 20.6l4.8 4.8-1 1zM26.4 21.6l-1-1-4.8 4.8 1 1z" fill="#ffcf4d"/>`
    + `<circle cx="4.6" cy="27.4" r="3" fill="${INK}"/><circle cx="27.4" cy="27.4" r="3" fill="${INK}"/><circle cx="4.6" cy="27.4" r="1.4" fill="#e8553d"/><circle cx="27.4" cy="27.4" r="1.4" fill="#e8553d"/>`,
  // a little map with a route and an X
  modes: `<path d="M3 7.5 11 4l10 3.5L29 4v20.5L21 28l-10-3.5L3 28z" fill="${INK}"/><path d="M5.2 9 11 6.5v15.8l-5.8 2.6zM21 9.7l5.8-2.6v15.8L21 25.5z" fill="#f4e6c4"/><path d="M11 6.5l10 3.2v15.8l-10-3.2z" fill="#e2cf9c"/>`
    + `<path d="M7.5 20c3-1 4-5 7.5-5s4 3 7 1" fill="none" stroke="#e8553d" stroke-width="1.6" stroke-dasharray="2 1.6" stroke-linecap="round"/><path d="M21.6 11.4l3.2 3.2m0-3.2-3.2 3.2" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
  // a war banner on a pole
  pass: `<path d="M6 2.5h3V30H6z" fill="${INK}"/><path d="M7 3.5h1V29H7z" fill="#c98a4a"/>`
    + `<path d="M8 4h19l-4 7 4 7H8z" fill="${INK}"/><path d="M9.6 5.6h14.6l-3.1 5.4 3.1 5.4H9.6z" fill="#7b4ad8"/><path d="M15.6 7.4l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" fill="#ffcf4d"/>`,
};

/** A tab's icon at any size (the bar uses 30 px; the Modes and Pass headers reuse them). */
export function tabIcon(t: Tab, cls = "") {
  const s = el("span", { class: `tb-ico ${cls}`.trim() });
  s.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true">${ICONS[t]}</svg>`;
  return s;
}

/** Badge per tab: a number (shown when > 0), true for a dot, or nothing. */
export type Badges = Partial<Record<Tab, number | boolean>>;

/** The bar. `go` runs on a tap of another tab; the active tab bounces instead. */
export function tabBar(active: Tab, badges: Badges, go: (t: Tab) => void): HTMLElement {
  const bar = el("nav", { class: "tb-bar", "aria-label": "Main" });
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

/** The tab one step left or right of `t`, or null at the ends. */
export const neighbour = (t: Tab, dir: 1 | -1): Tab | null => TABS[TABS.indexOf(t) + dir] ?? null;

/** True when the touch started on something that scrolls sideways or takes drags (a slider, a deck strip...). */
function ownsSideways(n: EventTarget | null, root: HTMLElement): boolean {
  for (let e = n as HTMLElement | null; e && e !== root.parentElement; e = e.parentElement) {
    if (e instanceof HTMLInputElement || e.dataset?.noswipe !== undefined) return true;
    if (e.scrollWidth > e.clientWidth + 2) { const o = getComputedStyle(e).overflowX; if (o === "auto" || o === "scroll") return true; }
  }
  return false;
}

/**
 * Horizontal swipe on `root` changes tab: a quick, mostly sideways flick of 60+ px. Vertical scrolling is left alone,
 * and so is anything that scrolls sideways itself. Overlays (sheets, chest opening) are ignored.
 */
export function swipeTabs(root: HTMLElement, onSwipe: (dir: 1 | -1) => void) {
  let sx = 0, sy = 0, t0 = 0, live = false;
  root.addEventListener("pointerdown", (e) => {
    live = e.isPrimary && !ownsSideways(e.target, root) && !(e.target as HTMLElement).closest?.(".overlay, .ch-overlay");
    sx = e.clientX; sy = e.clientY; t0 = performance.now();
  }, { passive: true });
  root.addEventListener("pointerup", (e) => {
    if (!live) return;
    live = false;
    const dx = e.clientX - sx, dy = e.clientY - sy, dt = performance.now() - t0;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 700) onSwipe(dx < 0 ? 1 : -1);
  }, { passive: true });
  root.addEventListener("pointercancel", () => { live = false; }, { passive: true });
}
