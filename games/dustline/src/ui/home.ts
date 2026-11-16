// Dustline's home. The base game hangs a Battle button and a chest rack over full-bleed key art, and lists its modes
// as a column of wide cards. Dustline nails things to a wall instead:
//   Battle tab  the key art is a framed view up main street; under it a WANTED poster names the next job (chapter,
//               level, how far along the trail), with the Showdown sign nailed across its foot, the trail map as a
//               folded chart beside it, and the strongboxes on a plank shelf.
//   Modes tab   a notice board: two columns of tacked-up handbills, one per mode, each a little crooked.
// Same exports and callbacks as base/src/ui/home.ts, so main.ts and every other screen are unchanged.
import "@base/ui/home.css";
import { MAX_COMMANDER } from "@engine/progression/economy";
import { commanderBar } from "@engine/progression/troops";
import { sfx, unlockAudio } from "@base/audio/sfx";
import { chestBar } from "@base/ui/chests";
import { currencyPill } from "@base/ui/currency";
import { el } from "@base/ui/dom";
import type { BattleTabOpts, ModeCard } from "@base/ui/home";
import { icon } from "./kit";

export { settingsBody, starChip, flameChip } from "@base/ui/home";
export type { BattleTabOpts, ModeCard, SettingsOpts } from "@base/ui/home";

function tapper<T extends HTMLElement>(b: T, fn: () => void): T {
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); fn(); });
  return b;
}
const tack = (cls: string) => el("i", { class: `dl-tack ${cls}`, "aria-hidden": "true" });
const tacks = () => [tack("tl"), tack("tr"), tack("bl"), tack("br")];

const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M10.200 1.500h3.600l.600 3a7.600 7.600 0 0 1 2 1.200l2.900-1 1.800 3.100-2.300 2a7.600 7.600 0 0 1 0 2.400l2.300 2-1.800 3.100-2.900-1a7.600 7.600 0 0 1-2 1.200l-.600 3h-3.600l-.600-3a7.600 7.600 0 0 1-2-1.200l-2.900 1-1.800-3.100 2.300-2a7.600 7.600 0 0 1 0-2.400l-2.300-2 1.800-3.100 2.900 1a7.600 7.600 0 0 1 2-1.200zM12 8.400a3.600 3.600 0 1 0 0 7.200 3.600 3.600 0 0 0 0-7.200z"/></svg>';
/** A folded trail chart with a dashed route and an X. */
const CHART = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 7 11 4l10 3 8-3v21l-8 3-10-3-8 3z" fill="#2a1608"/><path d="M5 8.600 11 6.200v16.600L5 25.200zM21 9.200l6-2.400v16.600l-6 2.400z" fill="#f0e2b8"/><path d="M11 6.200l10 3v16.600l-10-3z" fill="#dcc890"/>'
  + '<path d="M7.500 21c3-1 3.500-5.500 7.500-5.500s4 3 6.500 1.500" fill="none" stroke="#8f1d16" stroke-width="1.700" stroke-dasharray="2.200 1.800" stroke-linecap="round"/><path d="M22 10.600l3.400 3.400m0-3.400L22 14" stroke="#2a1608" stroke-width="2.200" stroke-linecap="round"/></svg>';
const BADGE6 = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2 25 12.200 36.200 11.400 30 20 36.200 28.600 25 27.800 20 38 15 27.800 3.800 28.600 10 20 3.800 11.400 15 12.200z" fill="#2a1608"/><path d="M20 6.600l3.600 7.600 8.200-.600-4.600 6.400 4.600 6.400-8.200-.600-3.600 7.600-3.600-7.600-8.200.600 4.600-6.400-4.600-6.400 8.200.600z" fill="#e2a93b"/><path d="M20 6.600l3.600 7.600 8.200-.600-4.600 6.400H20z" fill="#ffd45e"/></svg>';

/** The top rail: the sheriff's badge with the level on it and experience on a notched tally stick, the purse, the gear. */
export function homeTopBar(onSettings: () => void, onCommander?: () => void): HTMLElement {
  const b = commanderBar();
  const pct = b.span ? Math.min(100, (100 * b.into) / b.span) : 100;
  const gear = tapper(el("button", { class: "icon-btn hm-gear", "aria-label": "Settings" }), onSettings);
  gear.innerHTML = GEAR;
  const badge = el("span", { class: "hm-cmd-lv dl-badge" });
  badge.innerHTML = BADGE6;
  badge.append(el("b", {}, [String(b.level)]));
  return el("div", { class: "hm-top dl-top" }, [
    tapper(el("button", { class: "hm-cmd", "aria-label": `Commander level ${b.level}: open the Army` }, [
      badge,
      el("span", { class: "hm-cmd-xp" }, [el("i", { style: `width:${pct}%` }), el("small", {}, [b.level >= MAX_COMMANDER ? "max" : `${b.into}/${b.span}`])]),
    ]), () => onCommander?.()),
    el("div", { class: "hm-cur" }, [currencyPill("coins"), currencyPill("gems")]),
    gear,
  ]);
}

const BUZZARD = `<svg viewBox="0 0 20 9" aria-hidden="true"><path d="M1 2.500 Q5.500 1 10 6 Q14.500 1 19 2.500" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/** Life in the window: heat shimmer over the street, buzzards wheeling, dust blowing through, a tumbleweed. */
function street(): HTMLElement {
  const v = (o: Record<string, string | number>) => Object.entries(o).map(([k, x]) => `--${k}:${x}`).join(";");
  const birds = el("span", { class: "dl-wheel" });
  for (const [a, r, s] of [[0, 34, 1], [140, 26, 0.8], [250, 40, 0.7]]) {
    const b = el("i", { class: "dl-buzzard", style: v({ a: `${a}deg`, r: `${r}px`, s }) });
    b.innerHTML = BUZZARD;
    birds.append(b);
  }
  const dust = Array.from({ length: 9 }, (_, i) => el("i", { class: "dl-dust", style: v({ y: `${52 + ((i * 23) % 40)}%`, d: `${7 + (i % 4) * 2.3}s`, del: `${-i * 1.7}s`, s: `${3 + (i % 3) * 2}px` }) }));
  return el("div", { class: "hm-life dl-street", "aria-hidden": "true" }, [birds, ...dust, el("i", { class: "dl-weed" })]);
}

/** The Battle tab: main street in a plank frame, the WANTED poster, the Showdown sign, the trail chart, the shelf. */
export function battleTab(o: BattleTabOpts): HTMLElement {
  const n = o.next;
  const play = tapper(el("button", { class: "btn primary hm-play dl-sign", "aria-label": `Battle: ${n.name}` }, [
    el("i", { class: "dl-nail l" }), el("i", { class: "dl-nail r" }),
    el("span", { class: "hm-play-word" }, [n.replay ? "Replay" : "Battle"]),
  ]), o.play);
  const map = tapper(el("button", { class: "btn hm-map dl-chart", "aria-label": "Campaign map" }), o.map);
  map.innerHTML = CHART;
  map.append(el("b", {}, ["Map"]));
  const pct = Math.round((100 * Math.max(0, n.id - 1)) / Math.max(1, n.of));
  const poster = el("div", { class: "dl-poster hm-arena" }, [
    ...tacks(),
    el("div", { class: "dl-poster-head" }, [icon("star"), el("b", {}, ["Wanted"]), icon("star")]),
    el("div", { class: "dl-poster-rule" }),
    el("small", { class: "dl-poster-act" }, [`Act ${n.act} · ${n.actName}`]),
    el("b", { class: "dl-poster-name hm-play-lv" }, [n.name]),
    el("div", { class: "dl-poster-trail", title: `Level ${n.id} of ${n.of}` }, [
      el("span", {}, [`Level ${n.id} of ${n.of}`]),
      el("i", { class: "dl-poster-bar" }, [el("i", { style: `width:${pct}%` })]),
    ]),
  ]);
  return el("div", { class: "hm-battle dl-home" }, [
    homeTopBar(o.settings, o.army),
    el("div", { class: "hm-stage dl-window" }, [street(), el("i", { class: "dl-window-frame" })]),
    el("div", { class: "hm-low dl-wall" }, [
      el("div", { class: "dl-notice" }, [poster, map]),
      el("div", { class: "hm-go" }, [play]),
      el("div", { class: "hm-rack dl-shelf" }, [chestBar()]),
    ]),
  ]);
}

/** The Modes tab: a notice board of handbills, two to a row. */
export function modesTab(cards: ModeCard[], settings: () => void, army?: () => void): HTMLElement {
  return el("div", { class: "hm-modes dl-board-screen" }, [
    homeTopBar(settings, army),
    el("h1", { class: "hm-modes-h dl-board-h" }, [icon("star"), el("span", {}, ["Modes"]), icon("star")]),
    el("div", { class: "hm-cards dl-bills" }, cards.map((c, i) => tapper(el("button", {
      class: `hm-card dl-bill ${c.id}-btn mode-${c.id} ${c.dot ? "has-dot" : ""}`, style: `--art:url(${c.art});--art-y:${c.artY ?? "16%"};--tilt:${[-1.4, 1.1, 0.9, -1.2, -0.7, 1.5][i % 6]}deg;animation-delay:${i * 50}ms`, "aria-label": c.name,
    }, [
      tack("tc"),
      el("span", { class: "hm-card-art" }, c.glyph ? [icon(c.glyph, "hm-card-glyph")] : []),
      el("span", { class: "hm-card-body" }, [
        el("b", { class: "hm-card-name" }, [c.name]),
        el("small", { class: "hm-card-line" }, [c.line]),
      ]),
      el("span", { class: "hm-card-stat" }, [c.stat, ...(c.progress !== undefined ? [el("i", { class: "hm-card-bar" }, [el("i", { style: `width:${Math.round(c.progress * 100)}%` })])] : [])]),
      ...(c.dot ? [el("i", { class: "tb-dot" })] : []),
    ]), c.open))),
  ]);
}
