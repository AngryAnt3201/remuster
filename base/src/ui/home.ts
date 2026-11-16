// The home screen's tab bodies: the Battle tab (slim top bar, key art, the big Battle button, the chest rack), the
// Modes tab (one illustrated card per mode) and the settings sheet. main.ts owns navigation and passes the actions in.
import "./home.css";
import { hasMusic } from "../audio/music";
import { sfx, unlockAudio } from "../audio/sfx";
import { MAX_COMMANDER } from "@engine/progression/economy";
import { commanderBar } from "@engine/progression/troops";
import { chestBar } from "./chests";
import { currencyPill } from "./currency";
import { el, stars } from "./dom";
import { icon } from "./kit";

function tapper<T extends HTMLElement>(b: T, fn: () => void): T {
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); fn(); });
  return b;
}

const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M10.2 1.5h3.6l.6 3a7.6 7.6 0 0 1 2 1.2l2.9-1 1.8 3.1-2.3 2a7.6 7.6 0 0 1 0 2.4l2.3 2-1.8 3.1-2.9-1a7.6 7.6 0 0 1-2 1.2l-.6 3h-3.6l-.6-3a7.6 7.6 0 0 1-2-1.2l-2.9 1-1.8-3.1 2.3-2a7.6 7.6 0 0 1 0-2.4l-2.3-2 1.8-3.1 2.9 1a7.6 7.6 0 0 1 2-1.2zM12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z"/></svg>';
const MAP = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M2 5.5 8 3l8 2.5L22 3v15.5L16 21l-8-2.5L2 21z" opacity=".35"/><path d="M2 5.5 8 3v15.5L2 21zM16 5.5 22 3v15.5L16 21z"/><circle cx="17.5" cy="9" r="2.2" fill="#e8553d"/></svg>';

/** The slim top bar: commander level with XP, coins, gems, the settings gear. */
export function homeTopBar(onSettings: () => void, onCommander?: () => void): HTMLElement {
  const b = commanderBar();
  const pct = b.span ? Math.min(100, (100 * b.into) / b.span) : 100;
  const gear = tapper(el("button", { class: "icon-btn hm-gear", "aria-label": "Settings" }), onSettings);
  gear.innerHTML = GEAR;
  return el("div", { class: "hm-top" }, [
    tapper(el("button", { class: "hm-cmd", "aria-label": `Commander level ${b.level}: open the Army` }, [
      el("span", { class: "hm-cmd-lv" }, [String(b.level)]),
      el("span", { class: "hm-cmd-xp" }, [el("i", { style: `width:${pct}%` }), el("small", {}, [b.level >= MAX_COMMANDER ? "max" : `${b.into}/${b.span}`])]),
    ]), () => onCommander?.()),
    el("div", { class: "hm-cur" }, [currencyPill("coins"), currencyPill("gems")]),
    gear,
  ]);
}

export interface BattleTabOpts {
  /** The next campaign level: name, act, act name, and whether everything is already cleared. */
  next: { id: number; of: number; name: string; act: number; actName: string; replay: boolean };
  play: () => void;
  map: () => void;
  settings: () => void;
  /** Tapping the commander plate (opens the Army). */
  army?: () => void;
}

const BIRD = `<svg viewBox="0 0 20 9" aria-hidden="true"><path d="M1.5 3 Q5.5 0.5 10 6 Q14.5 0.5 18.5 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
/** Life behind the Battle tab (home.css .hm-life): the key art on a slow drift, clouds sliding across its sky, a flock
 *  crossing now and then and pollen rising off the meadow. Decoration only: no pointer events, hidden from readers. */
function homeLife(): HTMLElement {
  const v = (o: Record<string, string | number>) => Object.entries(o).map(([k, x]) => `--${k}:${x}`).join(";");
  const clouds = [[7, 96, 78, -8, 0.9], [15, 64, 104, -51, 0.75], [24, 118, 90, -70, 0.85], [11, 52, 122, -97, 0.7]]
    .map(([y, w, d, del, o]) => el("i", { class: "hm-cloud", style: v({ y: `${y}%`, w: `${w}px`, d: `${d}s`, del: `${del}s`, o }) }));
  const flock = el("span", { class: "hm-flock" });
  for (const [x, y, del] of [[0, 0, 0], [-22, 10, 0.12], [-20, -12, 0.2], [-44, 20, 0.05]]) {
    const b = el("i", { class: "hm-bird", style: `left:${x}px;top:${y}px;animation-delay:${del}s` });
    b.innerHTML = BIRD;
    flock.append(b);
  }
  const motes = Array.from({ length: 10 }, (_, i) => el("i", { class: "hm-mote", style: v({ x: `${6 + ((i * 37) % 88)}%`, y: `${48 + ((i * 23) % 34)}%`, d: `${6 + (i % 4) * 1.7}s`, del: `${-i * 1.3}s`, s: `${3 + (i % 3)}px` }) }));
  return el("div", { class: "hm-life", "aria-hidden": "true" }, [...clouds, flock, ...motes]);
}

/** The Battle tab: the key art has the room; the Battle button, map button and chest rack sit low, over the meadow. */
export function battleTab(o: BattleTabOpts): HTMLElement {
  const n = o.next;
  const play = tapper(el("button", { class: "btn primary hm-play", "aria-label": `Battle: ${n.name}` }, [
    el("span", { class: "hm-play-word" }, [n.replay ? "Replay" : "Battle"]),
    el("small", { class: "hm-play-lv" }, [`Act ${n.act} · ${n.name}`]),
  ]), o.play);
  const map = tapper(el("button", { class: "btn hm-map", "aria-label": "Campaign map" }), o.map);
  map.innerHTML = MAP;
  map.append(el("b", {}, ["Map"]));
  const rack = el("div", { class: "hm-rack" }, [chestBar()]);
  return el("div", { class: "hm-battle" }, [
    homeLife(),
    homeTopBar(o.settings, o.army),
    el("div", { class: "hm-stage" }, [
      el("div", { class: "hm-arena" }, [el("small", {}, [`Level ${n.id} of ${n.of}`]), el("b", {}, [n.actName])]),
    ]),
    el("div", { class: "hm-low" }, [
      el("div", { class: "hm-go" }, [play, map]),
      rack,
    ]),
  ]);
}

export interface ModeCard {
  id: "arena" | "daily" | "gauntlet" | "puzzles" | "skirmish" | "bastion";
  name: string;
  line: string;
  /** The stat chip, e.g. "streak 3" or "best 4". */
  stat: Node | string;
  /** 0..1 for a progress bar under the stat, if any. */
  progress?: number;
  art: string;
  /** Which part of the art shows (CSS background-position y), default 16%. */
  artY?: string;
  /** A kit icon stamped on the card's corner. */
  glyph?: "flame" | "crown" | "star" | "sword" | "shield" | "flag";
  dot?: boolean;
  open: () => void;
}

/** The Modes tab: a header and one big illustrated card per mode. */
export function modesTab(cards: ModeCard[], settings: () => void, army?: () => void): HTMLElement {
  return el("div", { class: "hm-modes" }, [
    homeTopBar(settings, army),
    el("h1", { class: "hm-modes-h" }, ["Modes"]),
    el("div", { class: "hm-cards" }, cards.map((c, i) => tapper(el("button", {
      class: `hm-card ${c.id}-btn mode-${c.id} ${c.dot ? "has-dot" : ""}`, style: `--art:url(${c.art});--art-y:${c.artY ?? "16%"};animation-delay:${i * 40}ms`, "aria-label": c.name,
    }, [
      el("span", { class: "hm-card-art" }),
      ...(c.glyph ? [icon(c.glyph, "hm-card-glyph")] : []),
      el("span", { class: "hm-card-body" }, [
        el("b", { class: "hm-card-name" }, [c.name]),
        el("small", { class: "hm-card-line" }, [c.line]),
      ]),
      el("span", { class: "hm-card-stat" }, [c.stat, ...(c.progress !== undefined ? [el("i", { class: "hm-card-bar" }, [el("i", { style: `width:${Math.round(c.progress * 100)}%` })])] : [])]),
      ...(c.dot ? [el("i", { class: "tb-dot" })] : []),
    ]), c.open))),
  ]);
}

/** A star count chip (Bastion, Breakpoint). */
export const starChip = (got: number, of: number) => el("span", { class: "hm-stars" }, [stars(1, 1), `${got}/${of}`]);
/** A flame chip (Daily streak). */
export const flameChip = (n: number) => el("span", { class: "hm-flame" }, [icon("flame"), String(n)]);

export interface SettingsOpts {
  sound: boolean; haptics: boolean; speed: number;
  setSound: (on: boolean) => void; setHaptics: (on: boolean) => void; setSpeed: (x: number) => void;
  /** Present when the game ships a soundtrack. */
  music?: boolean; setMusic?: (on: boolean) => void;
}

/** The settings sheet body: Sound and Haptics switches, battle Speed (1x, 2x, 3x). */
export function settingsBody(o: SettingsOpts): HTMLElement {
  const sw = (label: string, on: boolean, set: (v: boolean) => void) => {
    const b = el("button", { class: `btn ghost toggle hm-set-${label.toLowerCase()} ${on ? "on" : ""}`, role: "switch", "aria-checked": String(on) }, [
      el("span", {}, [label]), el("span", { class: "switch" }, [el("b")]),
    ]);
    return tapper(b, () => { on = !on; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); set(on); });
  };
  const speeds = el("div", { class: "hm-speed", role: "radiogroup", "aria-label": "Battle speed" }, [1, 2, 3].map((x) => {
    const c = el("button", { class: `chip ${o.speed === x ? "on" : ""}`, role: "radio", "aria-checked": String(o.speed === x) }, [`${x}×`]);
    return tapper(c, () => {
      speeds.querySelectorAll(".chip").forEach((k, i) => { k.classList.toggle("on", i + 1 === x); k.setAttribute("aria-checked", String(i + 1 === x)); });
      o.setSpeed(x);
    });
  }));
  return el("div", { class: "hm-settings" }, [
    el("h2", {}, ["Settings"]),
    sw("Sound", o.sound, o.setSound),
    ...(o.setMusic && hasMusic() ? [sw("Music", !!o.music, o.setMusic)] : []),
    sw("Haptics", o.haptics, o.setHaptics),
    el("div", { class: "hm-set-row" }, [el("span", {}, ["Battle speed"]), speeds]),
  ]);
}
