// Pixelkeep's home: a console title screen instead of the base game's key art with a big button.
//   Battle tab  a status line, the logo over the key art, a "world / stage" plate and a text menu in a window
//               (START GAME with a blinking cursor, WORLD MAP), then the box rack
//   Modes tab   "MODE SELECT": one window, one text row per mode with its name, line and stat; no picture cards
// The top bar, settings sheet and chips are the base game's (restyled in game/theme.css). main.ts passes the actions.
import { sfx, unlockAudio } from "@base/audio/sfx";
import { chestBar } from "@base/ui/chests";
import { el } from "@base/ui/dom";
import { homeTopBar, type BattleTabOpts, type ModeCard } from "@base/ui/home";

export { flameChip, homeTopBar, settingsBody, starChip } from "@base/ui/home";
export type * from "@base/ui/home";

function tapper<T extends HTMLElement>(b: T, fn: () => void): T {
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); fn(); });
  return b;
}

/** The logo: two stacked words in the bitmap font, with a copyright line like a title screen's. */
function logo(): HTMLElement {
  return el("div", { class: "pk-logo", "aria-hidden": "true" }, [
    el("b", { class: "pk-logo-a" }, ["PIXEL"]),
    el("b", { class: "pk-logo-b" }, ["KEEP"]),
    el("small", {}, ["© 198X  LOST CARTRIDGE"]),
  ]);
}

/** The Battle tab as a title screen. */
export function battleTab(o: BattleTabOpts): HTMLElement {
  const n = o.next;
  const play = tapper(el("button", { class: "btn primary hm-play pk-item", "aria-label": `Battle: ${n.name}` }, [
    el("span", { class: "hm-play-word" }, [n.replay ? "Replay" : "Start Game"]),
  ]), o.play);
  const map = tapper(el("button", { class: "btn hm-map pk-item", "aria-label": "Campaign map" }, [el("span", {}, ["World Map"])]), o.map);
  return el("div", { class: "hm-battle pk-title" }, [
    el("div", { class: "hm-life pk-life", "aria-hidden": "true" }),
    homeTopBar(o.settings, o.army),
    logo(),
    el("div", { class: "hm-stage" }),
    el("div", { class: "hm-low" }, [
      el("div", { class: "hm-arena pk-stage" }, [
        el("small", {}, [`World ${n.act}  Stage ${n.id}/${n.of}`]),
        el("b", {}, [n.actName]),
        el("i", {}, [n.name]),
      ]),
      el("div", { class: "hm-go pk-menu" }, [play, map]),
      el("div", { class: "pk-press" }, ["PRESS START"]),
      el("div", { class: "hm-rack" }, [chestBar()]),
    ]),
  ]);
}

/** The Modes tab: MODE SELECT, a text menu in one window. */
export function modesTab(cards: ModeCard[], settings: () => void, army?: () => void): HTMLElement {
  return el("div", { class: "hm-modes pk-modes" }, [
    homeTopBar(settings, army),
    el("h1", { class: "hm-modes-h" }, ["Mode Select"]),
    el("div", { class: "pk-list panel" }, cards.map((c, i) => tapper(el("button", {
      class: `pk-row ${c.id}-btn mode-${c.id} ${c.dot ? "has-dot" : ""}`, style: `animation-delay:${i * 50}ms`, "aria-label": c.name,
    }, [
      el("span", { class: "pk-row-no" }, [`${i + 1}`]),
      el("span", { class: "pk-row-body" }, [
        el("b", { class: "hm-card-name" }, [c.name]),
        el("small", { class: "hm-card-line" }, [c.line]),
      ]),
      el("span", { class: "hm-card-stat" }, [c.stat, ...(c.progress !== undefined ? [el("i", { class: "hm-card-bar" }, [el("i", { style: `width:${Math.round(c.progress * 100)}%` })])] : [])]),
      ...(c.dot ? [el("i", { class: "tb-dot" })] : []),
    ]), c.open))),
    el("p", { class: "pk-hint" }, ["▲▼ SELECT   ● OK"]),
  ]);
}
