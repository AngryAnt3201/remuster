// Cindermaw's home: a 1993 shooter's title screen instead of the base game's key art with a big button.
//   Raid tab   the logo in bevelled iron over the key art, a text menu with a skull cursor (NEW RAID, ZONE MAP),
//              the cache rack, and the player's status bar (rank, brass, shards, the Warden) along the bottom
//   Hunts tab  an episode list: one numbered slab per mode with its name, line and stat; no picture cards
// The settings sheet and chips are the base game's (restyled in game/theme.css). main.ts passes the actions in.
import { sfx, unlockAudio } from "@base/audio/sfx";
import { MAX_COMMANDER } from "@engine/progression/economy";
import { commanderBar } from "@engine/progression/troops";
import { chestBar } from "@base/ui/chests";
import { currencyPill } from "@base/ui/currency";
import { el } from "@base/ui/dom";
import type { BattleTabOpts, ModeCard } from "@base/ui/home";
import { warden } from "./game";

export { flameChip, settingsBody, starChip } from "@base/ui/home";
export type * from "@base/ui/home";

function tapper<T extends HTMLElement>(b: T, fn: () => void): T {
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); fn(); });
  return b;
}

/** The status bar of the menus: rank and XP, brass, the Warden, shards, the options key. */
export function homeTopBar(onSettings: () => void, onCommander?: () => void): HTMLElement {
  const b = commanderBar();
  const pct = b.span ? Math.min(100, (100 * b.into) / b.span) : 100;
  const gear = tapper(el("button", { class: "icon-btn hm-gear", "aria-label": "Settings" }, [el("b", {}, ["OPT"])]), onSettings);
  const cmd = tapper(el("button", { class: "hm-cmd cm-cell", "aria-label": `Commander level ${b.level}: open the Army` }, [
    el("div", { class: "cm-led" }, [el("span", { class: "hm-cmd-lv" }, [String(b.level)])]),
    el("span", { class: "hm-cmd-xp" }, [el("i", { style: `width:${pct}%` }), el("small", {}, [b.level >= MAX_COMMANDER ? "max" : `${b.into}/${b.span}`])]),
    el("small", { class: "cm-lab" }, ["Rank"]),
  ]), () => onCommander?.());
  const cur = (kind: "coins" | "gems", label: string) => el("div", { class: `cm-cell cm-${kind}` }, [el("div", { class: "cm-led" }, [currencyPill(kind)]), el("small", { class: "cm-lab" }, [label])]);
  return el("div", { class: "hm-top cm-bar cm-status" }, [
    cmd,
    el("div", { class: "hm-cur" }, [cur("coins", "Brass"), warden(), cur("gems", "Shards")]),
    gear,
  ]);
}

/** The logo: bevelled iron letters over a hazard rule, like the top of a title screen. */
function logo(): HTMLElement {
  return el("div", { class: "cm-logo", "aria-hidden": "true" }, [
    el("b", { "data-t": "CINDERMAW" }, ["CINDERMAW"]),
    el("i"),
    el("small", {}, ["9TH BREACH COMPANY"]),
  ]);
}

/** The Raid tab as a title screen. */
export function battleTab(o: BattleTabOpts): HTMLElement {
  const n = o.next;
  const play = tapper(el("button", { class: "btn primary hm-play cm-item", "aria-label": `Battle: ${n.name}` }, [
    el("span", { class: "hm-play-word" }, [n.replay ? "Replay Raid" : "New Raid"]),
    el("small", { class: "hm-play-lv" }, [n.name]),
  ]), o.play);
  const map = tapper(el("button", { class: "btn hm-map cm-item", "aria-label": "Campaign map" }, [el("span", {}, ["Zone Map"])]), o.map);
  return el("div", { class: "hm-battle cm-title" }, [
    el("div", { class: "hm-life cm-life", "aria-hidden": "true" }, Array.from({ length: 12 }, (_, i) => el("i", { class: "cm-ember", style: `--x:${4 + ((i * 41) % 92)}%;--d:${5 + (i % 5) * 1.3}s;--del:${-i * 1.1}s;--s:${2 + (i % 3) * 2}px` }))),
    logo(),
    el("div", { class: "hm-stage" }),
    el("div", { class: "hm-low" }, [
      el("div", { class: "hm-arena cm-zone" }, [
        el("small", {}, [`Zone ${n.act} · Level ${n.id} of ${n.of}`]),
        el("b", {}, [n.actName]),
      ]),
      el("div", { class: "hm-go cm-menu" }, [play, map]),
      el("div", { class: "hm-rack" }, [chestBar()]),
      homeTopBar(o.settings, o.army),
    ]),
  ]);
}

/** The Hunts tab: an episode list. */
export function modesTab(cards: ModeCard[], settings: () => void, army?: () => void): HTMLElement {
  return el("div", { class: "hm-modes cm-modes" }, [
    homeTopBar(settings, army),
    el("h1", { class: "hm-modes-h" }, ["Modes"]),
    el("div", { class: "cm-list" }, cards.map((c, i) => tapper(el("button", {
      class: `cm-row ${c.id}-btn mode-${c.id} ${c.dot ? "has-dot" : ""}`, style: `animation-delay:${i * 50}ms`, "aria-label": c.name,
    }, [
      el("span", { class: "cm-row-no" }, [`${i + 1}`]),
      el("span", { class: "cm-row-body" }, [
        el("b", { class: "hm-card-name" }, [c.name]),
        el("small", { class: "hm-card-line" }, [c.line]),
      ]),
      el("span", { class: "hm-card-stat" }, [c.stat, ...(c.progress !== undefined ? [el("i", { class: "hm-card-bar" }, [el("i", { style: `width:${Math.round(c.progress * 100)}%` })])] : [])]),
      ...(c.dot ? [el("i", { class: "tb-dot" })] : []),
    ]), c.open))),
  ]);
}
