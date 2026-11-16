// Pixelkeep's tab bar: the base game's five tabs as a console's menu row. Each slot is a 12 x 12 pixel icon over a
// short label; the selected slot inverts and takes the menu cursor (game/theme.css). Navigation and swiping are the
// base game's.
import { sfx, unlockAudio } from "@base/audio/sfx";
import { el } from "@base/ui/dom";
import { TABS, type Badges, type Tab } from "@base/ui/tabs";
import { BITS, COIN_PAL, pix } from "./pixicon";

export * from "@base/ui/tabs";

const LABEL: Record<Tab, string> = { shop: "Shop", army: "Army", battle: "Battle", modes: "Modes", pass: "Pass" };
const ICONS: Record<Tab, string> = {
  shop: pix(BITS.coin, COIN_PAL),
  army: pix(BITS.shield, { "#": "#40a0ff" }),
  battle: pix(BITS.sword, { "#": "#ffffff" }),
  modes: pix(BITS.map, { "#": "#40bf40" }),
  pass: pix(BITS.crown, { "#": "#ffbf00" }),
};

/** A tab's icon at any size. */
export function tabIcon(t: Tab, cls = "") {
  const s = el("span", { class: `tb-ico ${cls}`.trim() });
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t]}</svg>`;
  return s;
}

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
