// Neonhold's home: a visor, not a poster with a button stack. The key art fills the screen behind four corner
// brackets; chips run down the left edge (map, crew, the free and daily drops), the drop rack stands on end down the
// right edge, and one wide slab at the bottom starts the next fight. Same exports and callbacks as the base screen
// (base/src/ui/home.ts), so main.ts does not notice. The Modes tab, the top bar and the settings sheet keep the base
// structure and are restyled in theme.css.
import "@base/ui/home.css";
import { sfx, unlockAudio } from "@base/audio/sfx";
import { chestBar } from "@base/ui/chests";
import { el } from "@base/ui/dom";
import { homeTopBar, type BattleTabOpts } from "@base/ui/home";

export { homeTopBar, modesTab, settingsBody, starChip, flameChip } from "@base/ui/home";
export type * from "@base/ui/home";

function tapper<T extends HTMLElement>(b: T, fn: () => void): T {
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); fn(); });
  return b;
}

const ICO = {
  // a street grid with a route pin
  map: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M3 6l6-2.5 6 2.5 6-2.5v15L15 21l-6-2.5L3 21z"/><path d="M9 3.5v15M15 6v15"/><path d="M6 14l3-2 3 3 3-5 3 2" stroke-width="1.2" opacity=".7"/></svg>',
  // three heads: the crew
  crew: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"><path d="M12 4l3 3-3 3-3-3z"/><path d="M5.5 20v-4l3-3h7l3 3v4"/><path d="M4 9.5l2-2 2 2-2 2zM16 9.5l2-2 2 2-2 2z" opacity=".7"/></svg>',
};

/** Life behind the visor: the key art on a slow drift, rain slanting across it, a few sign tubes that flicker. */
function homeLife(): HTMLElement {
  const v = (o: Record<string, string | number>) => Object.entries(o).map(([k, x]) => `--${k}:${x}`).join(";");
  const rain = Array.from({ length: 16 }, (_, i) => el("i", { class: "nh-rain", style: v({ x: `${(i * 53) % 108}%`, h: `${50 + ((i * 29) % 70)}px`, d: `${0.9 + ((i * 7) % 5) * 0.16}s`, del: `${-((i * 0.37) % 1.4)}s`, o: 0.25 + ((i * 3) % 4) * 0.1 }) }));
  const signs = [[7, 21, 46, "#ff2bd6", 7.3, -1], [78, 27, 58, "#8a5cff", 5.1, -3.2], [62, 16, 30, "#ff2bd6", 9.7, -6]]
    .map(([x, y, w, c, d, del]) => el("i", { class: "nh-sign", style: v({ x: `${x}%`, y: `${y}%`, w: `${w}px`, c: String(c), d: `${d}s`, del: `${del}s` }) }));
  return el("div", { class: "hm-life", "aria-hidden": "true" }, [...signs, ...rain]);
}

/** The Battle tab as a visor: brackets round the key art, a rail on each edge, one slab at the bottom. */
export function battleTab(o: BattleTabOpts): HTMLElement {
  const n = o.next;
  const play = tapper(el("button", { class: "btn primary hm-play", "aria-label": `Battle: ${n.name}` }, [
    el("span", { class: "hm-play-word" }, [n.replay ? "Replay" : "Battle"]),
    el("small", { class: "hm-play-lv" }, [`Act ${n.act} · ${n.name}`]),
    el("span", { class: "nh-arrow", "aria-hidden": "true" }, [el("i"), el("i"), el("i")]),
  ]), o.play);
  const chip = (cls: string, svg: string, label: string, aria: string, fn: () => void) => {
    const b = tapper(el("button", { class: `nh-chip ${cls}`, "aria-label": aria }), fn);
    b.innerHTML = svg;
    b.append(el("b", {}, [label]));
    return b;
  };
  // The chest bar is one element holding both groups; the rail lays its slots out on the right and its two free
  // chests on the left (theme.css), so its own redraws keep working untouched.
  const bar = chestBar();
  const left = el("div", { class: "nh-rail l" }, [
    chip("hm-map", ICO.map, "Map", "Campaign map", o.map),
    chip("nh-crew", ICO.crew, "Army", "Army", () => o.army?.()),
  ]);
  const right = el("div", { class: "nh-rail r hm-rack" }, [bar]);
  const pct = Math.max(2, Math.round((100 * (n.id - 1)) / Math.max(1, n.of)));
  return el("div", { class: "hm-battle nh-visor" }, [
    homeLife(),
    homeTopBar(o.settings, o.army),
    el("div", { class: "nh-stage" }, [
      el("i", { class: "nh-br tl" }), el("i", { class: "nh-br tr" }), el("i", { class: "nh-br bl" }), el("i", { class: "nh-br br" }),
      el("span", { class: "nh-read a", "aria-hidden": "true" }, [el("i", {}, ["● "]), "Link live"]),
      el("span", { class: "nh-read b", "aria-hidden": "true" }, [`${String(n.id).padStart(2, "0")} / ${n.of}`]),
      left, right,
    ]),
    el("div", { class: "nh-low" }, [
      el("div", { class: "nh-where hm-arena" }, [el("small", {}, [`Level ${n.id} of ${n.of}`]), el("b", {}, [n.actName])]),
      el("div", { class: "nh-prog", "aria-hidden": "true" }, [el("i", { style: `width:${pct}%` })]),
      play,
    ]),
  ]);
}
