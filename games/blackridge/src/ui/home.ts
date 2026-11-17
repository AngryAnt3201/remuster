// Blackridge's home: an operations brief, not key art over a big button.
//   Battle tab  a link-status strip; the top bar; the key art as a surveillance frame (brackets, coordinates, scan
//               lines, the game's name set low in the frame); the current operation as a brief card with a segmented
//               progress strip; one wide DEPLOY bar with the map as a square plate beside it; the crate rack
//   Ops tab     a left-aligned list of orders (code, name, line, stat), ruled with hairlines: no picture cards
// The top bar, settings sheet and chips are the base game's (restyled in game/theme.css). main.ts passes the actions.
import { sfx, unlockAudio } from "@base/audio/sfx";
import { chestBar } from "./chests";
import { el } from "@base/ui/dom";
import { homeTopBar, type BattleTabOpts, type ModeCard } from "@base/ui/home";

export { flameChip, homeTopBar, settingsBody, starChip } from "@base/ui/home";
export type * from "@base/ui/home";

function tapper<T extends HTMLElement>(b: T, fn: () => void): T {
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); fn(); });
  return b;
}
const MAP = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="miter"><path d="M2.5 5.5 8.5 3.500l7 2 6-2v15l-6 2-7-2-6 2z"/><path d="M8.500 3.500v15M15.500 5.500v15" opacity=".5"/><path d="M5 14l3.500-3 3.500 2.500 3.500-5 3.500 2" stroke-dasharray="2 1.500"/></svg>';
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** The link-status strip across the very top. */
function statusStrip(left: string): HTMLElement {
  return el("div", { class: "br-status", "aria-hidden": "true" }, [el("span", {}, [el("b", {}, ["TF HALCYON"]), ` // ${left}`]), el("i", {}, ["LINK SECURE"])]);
}

/** The Battle tab as an operations brief. */
export function battleTab(o: BattleTabOpts): HTMLElement {
  const n = o.next;
  const play = tapper(el("button", { class: "btn primary hm-play", "aria-label": `Battle: ${n.name}` }, [
    el("span", { class: "hm-play-word" }, [n.replay ? "Rerun" : "Deploy"]),
    el("small", { class: "hm-play-lv" }, ["▸▸"]),
  ]), o.play);
  const map = tapper(el("button", { class: "btn hm-map", "aria-label": "Campaign map" }), o.map);
  map.innerHTML = MAP;
  map.append(el("b", {}, ["Map"]));
  // ten segments: where this operation sits in the whole theatre
  const seg = Math.min(9, Math.floor(((n.id - 1) / Math.max(1, n.of)) * 10));
  const prog = el("div", { class: "br-prog" }, Array.from({ length: 10 }, (_, i) => el("i", { class: i < seg ? "on" : i === seg && !n.replay ? "now" : n.replay ? "on" : "" })));
  return el("div", { class: "hm-battle br-home" }, [
    statusStrip("OPS BRIEF"),
    homeTopBar(o.settings, o.army),
    el("div", { class: "hm-stage" }, [
      el("div", { class: "br-coords" }, [el("span", {}, ["FEED 03 // RIDGE CAM"]), el("span", {}, [`GRID 41-${pad(88 - n.act)}`])]),
      el("div", { class: "br-title" }, [el("b", {}, ["Blackridge"]), el("small", {}, ["Hold the corridor"])]),
    ]),
    el("div", { class: "hm-low" }, [
      el("div", { class: "br-op" }, [
        el("small", {}, [el("span", {}, [n.replay ? "Theatre secured" : "Current operation"]), el("em", {}, [`OP-${pad(n.id, 3)} / ${pad(n.of, 3)}`])]),
        el("b", {}, [n.name]),
        el("span", {}, [`Sector ${pad(n.act)} // ${n.actName}`]),
        prog,
      ]),
      el("div", { class: "hm-go" }, [play, map]),
      el("div", { class: "hm-rack" }, [chestBar()]),
    ]),
  ]);
}

/** The Ops tab: a list of orders. */
export function modesTab(cards: ModeCard[], settings: () => void, army?: () => void): HTMLElement {
  return el("div", { class: "hm-modes br-modes" }, [
    statusStrip("STANDING ORDERS"),
    homeTopBar(settings, army),
    el("h1", { class: "hm-modes-h" }, ["Modes"]),
    el("div", { class: "br-sub" }, [`${cards.length} channels open`]),
    el("div", { class: "br-orders" }, cards.map((c, i) => tapper(el("button", {
      class: `br-row ${c.id}-btn mode-${c.id} ${c.dot ? "has-dot" : ""}`, "aria-label": c.name,
    }, [
      el("span", { class: "br-row-no", "aria-hidden": "true" }, [`CH`, el("br"), pad(i + 1)]),
      el("span", { class: "br-row-body" }, [
        el("b", { class: "hm-card-name" }, [c.name]),
        el("small", { class: "hm-card-line" }, [c.line]),
      ]),
      el("span", { class: "hm-card-stat" }, [c.stat, ...(c.progress !== undefined ? [el("i", { class: "hm-card-bar" }, [el("i", { style: `width:${Math.round(c.progress * 100)}%` })])] : [])]),
      el("span", { class: "br-row-go", "aria-hidden": "true" }, ["›"]),
      ...(c.dot ? [el("i", { class: "tb-dot" })] : []),
    ]), c.open))),
  ]);
}
