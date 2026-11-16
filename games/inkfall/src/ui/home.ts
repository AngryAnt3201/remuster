// Inkfall's home: a hanging scroll instead of the base game's key art with a wide button under it.
//   Battle tab  the key art is the painting; the game's name runs down the right edge in a vertical column with the
//               painter's seal under it; the scene and level are a vertical caption down the left edge; the Battle
//               button is a large round seal pressed low on the sheet, with the map as a small brushed slip beside it
//               and the casket rack along the bottom
//   Modes tab   a ledger: one brushed row per mode (a numeral, the name, its line, the stat), ruled with dry-brush
//               lines, no picture cards
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

const MAP = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.500 19.500 8 9.500l4 6 3.500-8 6 12"/><path d="M5.500 14.500c1.500-.6 2.600-.6 4 0M14 12.500c1.200-.5 2.200-.5 3.400 0" stroke-width="1.200"/></svg>';
/** The painter's seal: an original mark (a falling drop of ink over two strokes of water), carved pale in the red. */
const HANKO = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.500c2.600 3.400 4 5.600 4 7.600a4 4 0 0 1-8 0c0-2 1.400-4.200 4-7.600z" fill="currentColor" stroke="none"/><path d="M5 17.500c2.300-1.200 4.700-1.200 7 0s4.700 1.200 7 0M7 21c1.700-.8 3.300-.8 5 0s3.300.8 5 0"/></svg>';

/** The game's name down the right edge, a letter to a line, with the seal under it. */
function title(): HTMLElement {
  const seal = el("i", { class: "ink-hanko" });
  seal.innerHTML = HANKO;
  return el("div", { class: "ink-title", "aria-hidden": "true" }, [el("b", {}, ["INKFALL"]), seal]);
}

/** Petals drifting down the scroll (decoration only: no pointer events, hidden from readers). */
function petals(): HTMLElement {
  const v = (o: Record<string, string | number>) => Object.entries(o).map(([k, x]) => `--${k}:${x}`).join(";");
  return el("div", { class: "hm-life ink-life", "aria-hidden": "true" }, Array.from({ length: 12 }, (_, i) =>
    el("i", { class: "ink-petal", style: v({ x: `${4 + ((i * 41) % 90)}%`, d: `${9 + (i % 5) * 2.3}s`, del: `${-i * 1.7}s`, s: `${7 + (i % 3) * 2}px`, sway: `${(i % 2 ? 1 : -1) * (14 + (i % 4) * 8)}px` }) })));
}

/** The Battle tab as a hanging scroll. */
export function battleTab(o: BattleTabOpts): HTMLElement {
  const n = o.next;
  const play = tapper(el("button", { class: "btn primary hm-play ink-seal-btn", "aria-label": `Battle: ${n.name}` }, [
    el("span", { class: "hm-play-word" }, [n.replay ? "Replay" : "Battle"]),
  ]), o.play);
  const map = tapper(el("button", { class: "btn ghost hm-map ink-map", "aria-label": "Campaign map" }), o.map);
  map.innerHTML = MAP;
  map.append(el("b", {}, ["Map"]));
  return el("div", { class: "hm-battle ink-scroll" }, [
    petals(),
    homeTopBar(o.settings, o.army),
    el("div", { class: "hm-stage ink-stage" }, [
      // the title down the right edge, a letter to a line, and the painter's seal
      title(),
      // the caption down the left edge
      el("div", { class: "hm-arena ink-caption" }, [el("b", {}, [n.actName]), el("small", {}, [`Level ${n.id} of ${n.of}`])]),
    ]),
    el("div", { class: "hm-low ink-low" }, [
      el("div", { class: "hm-go ink-go" }, [
        el("div", { class: "ink-next" }, [el("small", {}, [`Act ${n.act}`]), el("b", {}, [n.name])]),
        play,
        map,
      ]),
      el("div", { class: "hm-rack" }, [chestBar()]),
    ]),
  ]);
}

/** The Modes tab: a ledger of brushed rows. */
export function modesTab(cards: ModeCard[], settings: () => void, army?: () => void): HTMLElement {
  return el("div", { class: "hm-modes ink-modes" }, [
    homeTopBar(settings, army),
    el("h1", { class: "hm-modes-h" }, ["Modes"]),
    el("div", { class: "ink-ledger" }, cards.map((c, i) => tapper(el("button", {
      class: `ink-row ${c.id}-btn mode-${c.id} ${c.dot ? "has-dot" : ""}`, style: `animation-delay:${i * 60}ms`, "aria-label": c.name,
    }, [
      el("span", { class: "ink-row-no", "aria-hidden": "true" }, [String(i + 1)]),
      el("span", { class: "ink-row-body" }, [
        el("b", { class: "hm-card-name" }, [c.name]),
        el("small", { class: "hm-card-line" }, [c.line]),
      ]),
      el("span", { class: "hm-card-stat" }, [c.stat, ...(c.progress !== undefined ? [el("i", { class: "hm-card-bar" }, [el("i", { style: `width:${Math.round(c.progress * 100)}%` })])] : [])]),
      ...(c.dot ? [el("i", { class: "tb-dot" })] : []),
    ]), c.open))),
  ]);
}
