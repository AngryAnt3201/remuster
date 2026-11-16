// Dustline's tab bar: a hitching rail across the bottom of the screen with five wooden shingles hanging from it on
// chains (Store, Posse, Showdown, Trails, Bounty). The shingle for the open tab is the painted one. Navigation, badges
// and the swipe between tabs are the base game's; only what the bar is made of, and its icons, are Dustline's.
import "@base/ui/home.css";
import { sfx, unlockAudio } from "@base/audio/sfx";
import { el } from "@base/ui/dom";
import { TABS, type Badges, type Tab } from "@base/ui/tabs";

export { TABS, neighbour, swipeTabs } from "@base/ui/tabs";
export type { Badges, Tab } from "@base/ui/tabs";

const LABEL: Record<Tab, string> = { shop: "Shop", army: "Army", battle: "Battle", modes: "Modes", pass: "Pass" };

// 32x32 icons drawn for Dustline: burnt-umber ink, flat colour, one highlight. Read at 26 px.
const INK = "#2a1608";
const ICONS: Record<Tab, string> = {
  // a false-front general store
  shop: `<path d="M3 4h26v8H3z" fill="${INK}"/><path d="M5 6h22v4.400H5z" fill="#f0e2b8"/><path d="M8 7.400h3v1.600H8zM13 7.400h6v1.600h-6zM21 7.400h3v1.600h-3z" fill="${INK}"/>`
    + `<path d="M5 12h22v17H5z" fill="${INK}"/><path d="M7 16h18v11H7z" fill="#c79a5e"/><path d="M13 19h6v8h-6z" fill="#5f3d20"/><path d="M8.400 18.400h3.200v4H8.400zM20.400 18.400h3.200v4h-3.200z" fill="#ffd98a"/>`
    + `<path d="M3.600 12h24.800l1 5H2.600z" fill="${INK}"/><path d="M5 13.400h3.600l-.400 2.400H4.400zM12.400 13.400H16v2.400h-3.800zM19.800 13.400h3.600l.400 2.400H20z" fill="#b5372a"/><path d="M8.600 13.400h3.800l-.200 2.400h-4zM16 13.400h3.800l.200 2.400h-4zM23.400 13.400H27l.600 2.400h-3.800z" fill="#f6ecd0"/>`,
  // a ten-gallon hat
  army: `<path d="M9 21c-.400-9 1.400-16 7-16s7.400 7 7 16z" fill="${INK}"/><path d="M11 20c-.200-7.400 1.200-13 5-13s5.200 5.600 5 13z" fill="#a8703f"/><path d="M12.600 9.600c.800-1.600 2-2.600 3.400-2.600v6c-1.300 0-2.500-.300-3.600-1z" fill="#cf9a5e"/>`
    + `<path d="M1 18.600c3 5.400 8 8.200 15 8.200s12-2.800 15-8.200c.200 6.800-5 10.800-15 10.800S.800 25.400 1 18.600z" fill="${INK}"/><path d="M3.400 22.400c3 2.900 7.200 4.400 12.600 4.400s9.600-1.500 12.600-4.400c-1.400 3.300-5.600 5-12.600 5s-11.200-1.700-12.600-5z" fill="#a8703f"/>`
    + `<path d="M10.900 17.200h10.200V21H10.900z" fill="#45a3ec"/><path d="M14.800 17.600l1.200 2.600 1.200-2.600z" fill="#ffd45e"/>`,
  // a sheriff's star
  battle: `<path d="M16 1.600 20 9l8.400-.300L24 16l4.400 7.300L20 23l-4 7.400L12 23l-8.400.300L8 16 3.600 8.700 12 9z" fill="${INK}"/>`
    + `<path d="M16 5.800l2.800 5.300 6-.200-3.200 5.100 3.200 5.100-6-.200L16 26.200l-2.800-5.300-6 .200 3.200-5.100-3.200-5.100 6 .200z" fill="#e2a93b"/><path d="M16 5.800l2.800 5.300 6-.200-3.200 5.100H16z" fill="#ffd45e"/>`
    + `<circle cx="16" cy="16" r="4.400" fill="${INK}"/><circle cx="16" cy="16" r="2.600" fill="#fff3d6"/>`
    + `<circle cx="16" cy="2.600" r="2.200" fill="${INK}"/><circle cx="16" cy="29.400" r="2.200" fill="${INK}"/><circle cx="27.800" cy="9" r="2.200" fill="${INK}"/><circle cx="4.200" cy="9" r="2.200" fill="${INK}"/><circle cx="27.800" cy="23" r="2.200" fill="${INK}"/><circle cx="4.200" cy="23" r="2.200" fill="${INK}"/>`
    + `<circle cx="16" cy="2.600" r="1" fill="#ffd45e"/><circle cx="16" cy="29.400" r="1" fill="#ffd45e"/><circle cx="27.800" cy="9" r="1" fill="#ffd45e"/><circle cx="4.200" cy="9" r="1" fill="#ffd45e"/><circle cx="27.800" cy="23" r="1" fill="#ffd45e"/><circle cx="4.200" cy="23" r="1" fill="#ffd45e"/>`,
  // a wagon wheel
  modes: `<circle cx="16" cy="16" r="14" fill="${INK}"/><circle cx="16" cy="16" r="11.400" fill="#c79a5e"/><circle cx="16" cy="16" r="8.600" fill="#f0e2b8"/>`
    + `<path d="M15 4h2v24h-2zM4 15h24v2H4z" fill="${INK}"/><path d="M6.800 8.200l1.400-1.400 17 17-1.400 1.400zM23.800 6.800l1.400 1.400-17 17-1.400-1.400z" fill="${INK}"/>`
    + `<circle cx="16" cy="16" r="3.600" fill="${INK}"/><circle cx="16" cy="16" r="1.800" fill="#e2a93b"/>`,
  // a wanted poster
  pass: `<path d="M5 2h22v28H5z" fill="${INK}"/><path d="M7 4h18v24H7z" fill="#f0e2b8"/><path d="M9.400 6h13.200v3.200H9.400z" fill="#b5372a"/>`
    + `<path d="M10.400 11h11.200v9H10.400z" fill="${INK}"/><path d="M11.600 12.200h8.800v6.600h-8.800z" fill="#c79a5e"/><circle cx="16" cy="15" r="1.800" fill="${INK}"/><path d="M12.600 18.800c.600-2 1.800-2.900 3.400-2.900s2.800.900 3.400 2.900z" fill="${INK}"/><path d="M12.400 14.200h7.200v-.900c-.500-.300-1.300-.500-2.200-.600-.200-1-.700-1.500-1.400-1.500s-1.200.500-1.400 1.500c-.900.100-1.700.300-2.200.600z" fill="${INK}"/>`
    + `<path d="M9.400 22h13.200v1.600H9.400zM11.400 25h9.200v1.400h-9.200z" fill="${INK}"/><circle cx="16" cy="3" r="1.500" fill="#e2a93b"/>`,
};

/** A tab's icon at any size (the bar uses 30 px; the Modes and Pass headers reuse them). */
export function tabIcon(t: Tab, cls = "") {
  const s = el("span", { class: `tb-ico ${cls}`.trim() });
  s.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true">${ICONS[t]}</svg>`;
  return s;
}

/** The rail. `go` runs on a tap of another tab; the open tab's shingle swings instead. */
export function tabBar(active: Tab, badges: Badges, go: (t: Tab) => void): HTMLElement {
  const bar = el("nav", { class: "tb-bar dl-rail", "aria-label": "Main" }, [el("i", { class: "dl-rail-beam" })]);
  for (const t of TABS) {
    const b = badges[t];
    const badge = typeof b === "number" ? (b > 0 ? el("i", { class: "tb-badge" }, [b > 9 ? "9+" : String(b)]) : null) : b ? el("i", { class: "tb-dot" }) : null;
    const btn = el("button", { class: `tb-tab dl-shingle ${t === active ? "on" : ""} ${t === "battle" ? "home" : ""}`, "data-tab": t, "aria-label": LABEL[t], ...(t === active ? { "aria-current": "page" } : {}) }, [
      el("i", { class: "dl-chain l" }), el("i", { class: "dl-chain r" }),
      el("span", { class: "dl-board" }, [
        el("span", { class: "tb-face" }, [tabIcon(t), ...(badge ? [badge] : [])]),
        el("b", { class: "tb-label" }, [LABEL[t]]),
      ]),
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
