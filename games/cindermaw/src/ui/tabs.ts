// Cindermaw's tab bar: the weapon keys of a shooter's status bar. Five numbered slots (1 to 5), each a pixel icon
// in a bevelled key; the selected key is lit amber. Navigation and swiping are the base game's.
import { sfx, unlockAudio } from "@base/audio/sfx";
import { el } from "@base/ui/dom";
import { TABS, type Badges, type Tab } from "@base/ui/tabs";

export { TABS, neighbour, swipeTabs } from "@base/ui/tabs";
export type { Badges, Tab } from "@base/ui/tabs";

const LABEL: Record<Tab, string> = { shop: "Shop", army: "Army", battle: "Battle", modes: "Modes", pass: "Pass" };
const COL: Record<string, string> = { K: "#0a0605", G: "#8a9298", g: "#5d646a", D: "#3a3f44", Y: "#ffb020", y: "#c08a40", R: "#e03a10", r: "#8a1c12", B: "#e0d4b8", b: "#8f7a66", W: "#ffffff", O: "#ff7a1c", L: "#b8e03a" };
// 13 x 11 pixel pictures
const ICONS: Record<Tab, string[]> = {
  // a hazard crate
  shop: ["..KKKKKKKKK..", ".KYYKYYKYYKK.", ".KGGGGGGGGGK.", ".KGgggggggGK.", ".KGgKKgKKgGK.", ".KGgKYgKYgGK.", ".KGgggggggGK.", ".KGGGGGGGGGK.", ".KYKYYKYYKYK.", ".KKKKKKKKKKK.", "............."],
  // a pump shotgun
  army: [".............", ".............", "KKKKKKKKKKK..", "KGGGGGGGGGGKK", "KKKKKKKKgggyK", "..KyyyKKKKyyK", "..KKKKK..KyyK", "..........KyK", "..........KKK", ".............", "............."],
  // a horned skull
  battle: ["B...KKKKK...B", "BB.KBBBBBK.BB", ".BKBBBBBBBKB.", "..KBBBBBBBK..", "..KBRRBRRBK..", "..KBRRBRRBK..", "..KBBBKBBBK..", "...KBBBBBK...", "...KBKBKBK...", "...KBBBBBK...", "....KKKKK...."],
  // a crosshair
  modes: ["......R......", "......R......", "...RRRRRRR...", "..RR.....RR..", "..R...R...R..", "RRR..RRR..RRR", "..R...R...R..", "..RR.....RR..", "...RRRRRRR...", "......R......", "......R......"],
  // a tally sheet
  pass: ["..KKKKKKKKK..", "..KBBBBBBBK..", "..KBRBRBRBK..", "..KBRBRBRBK..", "..KBRRRRRBK..", "..KBBBBBBBK..", "..KBRBRBBBK..", "..KBRBRBBBK..", "..KBBBBBBBK..", "..KKKKKKKKK..", "............."],
};

function pixels(rows: string[]): string {
  let s = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== ".") s += `<rect x="${x}" y="${y}" width="1.03" height="1.03" fill="${COL[c] ?? "#f0f"}"/>`; }));
  return `<svg viewBox="0 0 13 11" aria-hidden="true" shape-rendering="crispEdges">${s}</svg>`;
}

/** A tab's icon at any size (the bar, the Hunts and Kill Sheet headers). */
export function tabIcon(t: Tab, cls = "") {
  const s = el("span", { class: `tb-ico ${cls}`.trim() });
  s.innerHTML = pixels(ICONS[t]);
  return s;
}

/** The bar. `go` runs on a tap of another tab; the active tab bounces instead. */
export function tabBar(active: Tab, badges: Badges, go: (t: Tab) => void): HTMLElement {
  const bar = el("nav", { class: "tb-bar cm-keys", "aria-label": "Main" });
  TABS.forEach((t, i) => {
    const b = badges[t];
    const badge = typeof b === "number" ? (b > 0 ? el("i", { class: "tb-badge" }, [b > 9 ? "9+" : String(b)]) : null) : b ? el("i", { class: "tb-dot" }) : null;
    const btn = el("button", { class: `tb-tab ${t === active ? "on" : ""} ${t === "battle" ? "home" : ""}`, "data-tab": t, "aria-label": LABEL[t], ...(t === active ? { "aria-current": "page" } : {}) }, [
      el("i", { class: "cm-key-no", "aria-hidden": "true" }, [String(i + 1)]),
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
  });
  return bar;
}
