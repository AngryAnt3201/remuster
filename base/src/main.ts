import "./styles.css";
import { DEFAULT_AI, TACTICS, type AIProfile, type Tactic } from "@engine/core/ai";
import { ACTS, LEVELS } from "@engine/core/campaign";
import { levelConfig, objectiveMet, objectiveText, puzzleConfig, puzzleStars, starsFor, type LevelDef, type PuzzleDef } from "@engine/core/content";
import { UNITS, START_HP, type UnitKind } from "@engine/core/defs";
import { beginDaily, canScore, dailyBoard, dailyConfig, dailyResult, dateKey, finishDaily, streakOn } from "@engine/core/daily";
import { boonChoices, duelConfig, endDuel, gauntletFoe, boardValue, newRun, takeBoon, type GauntletRun } from "@engine/core/gauntlet";
import type { Match } from "@engine/core/match";
import { PUZZLES } from "@engine/core/puzzles";
import { setSound, sfx, unlockAudio } from "./audio/sfx";
import { initNative, setHaptics } from "./native";
import { loadSprites } from "./render/sprites";
import { applyStyleVars } from "./render/style";
import { load, save } from "@engine/save";
import { createStore } from "@engine/store";
import { StarterShop, payStarter, markStarter, starterBought } from "@engine/store/starter";
import { dailyBody } from "./ui/daily";
import { el, stars } from "./ui/dom";
import { MAP_SIZE } from "./ui/mapdata";
import { mapForAct, nodeFractions, nodePositions, pathUpTo } from "./ui/maplayout";
import { GameScreen, framedPortrait, paintPortrait, ribbon } from "./ui/game";
import { applyUIStyle, icon } from "./ui/kit";
// [gems] the gem store: packs, free rewards, Shop, counters, Gauntlet Rally
import { settleRewards } from "@engine/economy/rewards";
import { creditPurchase, earn } from "@engine/economy/wallet";
import { grantCards } from "@engine/progression/collection";
import { GemShop } from "@engine/store/gems";
// [home] the title's currency bar and commander chip moved into the home top bar (src/ui/home.ts)
import { rallyOffer, shopCounters, shopView, showRewards } from "./ui/gemshop";
// [progression] the Army: cards + coins upgrades, commander level, recommended level, defeat hint (src/ui/army.ts)
import { armyLevel, migrateArmy } from "@engine/progression/troops";
import { underLevelledHint } from "./ui/army";
// [progression] troop levels, coin rewards and the Barracks (src/progression, src/ui/barracks.ts)
import { onlineArenaFinish, onlineArenaForfeit, onlineArenaMatch, startOnline, trackMatchEnd, trackScreen } from "./online";
import { arenaLadder, settleArena, awardArena, awardCampaign, awardDaily, awardGauntletRival, awardSkirmish, nextArenaMatch, settleLegacyCoins, withLevels } from "@engine/progression/troops";
import { LEAGUES, arenaById, arenaUnlocked, leagueProgress, trophyChange, type ArenaDef } from "@engine/core/arena";
import { isZone } from "@engine/core/terrain";
import { ARENA_BACKDROP, TERRAIN } from "./game/terrain";
import { foeLevelForAct } from "@engine/progression/economy";
import { attachReward, barracksScreen } from "./ui/barracks";
// [chests] chest slots, free and crown chests, the opening moment (src/progression/chests.ts, src/ui/chests.ts)
import { seedDemo, winChest } from "@engine/progression/chests";
import { chestDemo, chestEarned } from "./ui/chests";
// [home] the tabbed home: bottom tab bar, Battle and Modes tabs, settings sheet (src/ui/home.ts, src/ui/tabs.ts)
import { chests, crownReady, freeBanked, gameNow, initChests, localDay, onChestsChange, stateOf } from "@engine/progression/chests";
import { onWalletChange } from "@engine/economy/wallet";
import { onCollectionChange } from "@engine/progression/collection";
import { readyCount } from "@engine/progression/troops";
import { battleTab, flameChip, modesTab, settingsBody, starChip, type ModeCard } from "./ui/home";
import { TABS, neighbour, swipeTabs, tabBar, type Badges, type Tab } from "./ui/tabs";
import { MAP_DEFS } from "@engine/core/td/maps"; // map data only (no imports), so Bastion stays a lazy chunk
// [pass] daily quests, the War Pass and special offers (src/progression/pass.ts, quests.ts, src/store/pass.ts, offers.ts)
import { onPassChange, startPass } from "@engine/progression/pass";
import { passBadge, passScreen } from "./ui/pass";
import { passEvent } from "@engine/progression/passEvents";
import { onQuestsChange, settleQuests } from "@engine/progression/quests";
import { usePassStore } from "@engine/store/pass";
import { seedPassDemo } from "@engine/progression/pass";
import { seedQuestDemo } from "@engine/progression/quests";
import { showEnding } from "./ui/ending";
// [game] what a game overlay can replace without touching anything else: its words, its skin, its sounds and music
import { installLexicon } from "./game/text";
import { musicOn, playMusic, resumeMusic, setMusic } from "./audio/music";
import { audioContext, renderSfx } from "./audio/sfx";
import "./game/theme.css"; // last, so the game's skin wins over every base stylesheet

const app = document.getElementById("app")!;
let game: GameScreen | null = null;
/** The App Store (StoreKit on iOS, a mock on the web). Nothing is locked behind it: purchases only speed progress up. */
const store = createStore(location.search);
/** [store] The one-time Starter Pack: gems and coins through the wallet, cards through the collection, once per transaction. */
const starter = new StarterShop(store, (txId) => payStarter(txId, {
  creditGems: creditPurchase,
  earnCoins: (n) => void earn("coins", n, "starter"),
  grantCards: (k, n) => void grantCards(k, n, "starter"),
  markBought: (tx) => save((s) => { markStarter(s, tx); }),
}), () => starterBought(load()));
/** [gems] Gem packs on the same store, credited through the shared wallet once per transaction. */
const gemShop = new GemShop(store, creditPurchase);
/** [pass] War Pass Premium and special offers on the same store (credit once per transaction, then finish). */
usePassStore(store);
/** Redraws the menu screen when a Starter Pack lands outside a buy (null in battles and on the Shop, which updates itself). */
let here: (() => void) | null = null;

function clear() {
  game?.destroy(); game = null;
  // [game] the soundtrack follows the screen: whoever called clear() builds a battle or a menu right after
  queueMicrotask(() => playMusic(game ? (game.view.bossKeep ? "boss" : game.mode === "arena" ? "arena" : "battle") : "home"));
  sheetEl = null;
  here = null;
  app.replaceChildren();
}

function btn(label: string | Node, cls: string, fn: () => void) {
  const b = el("button", { class: `btn ${cls}` }, [label]);
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); fn(); });
  return b;
}
function screen(cls: string, ...kids: Node[]) {
  const s = el("div", { class: `screen ${cls}` }, kids);
  app.append(s);
  return s;
}
function header(title: string, back: () => void, right?: Node) {
  const b = el("button", { class: "icon-btn back", "aria-label": "Back" }, [icon("back")]);
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); back(); });
  return el("div", { class: "screen-head" }, [b, el("h1", {}, [title]), right ?? el("span")]);
}
const starTotal = (n: number) => el("span", { class: "star-total" }, [stars(1, 1), String(n)]);
function unitIcon(kind: keyof typeof UNITS, size = 44) {
  const c = el("canvas", { class: "unit-icon", style: `width:${size}px;height:${size}px` }) as HTMLCanvasElement;
  requestAnimationFrame(() => paintPortrait(c, kind));
  return c;
}

// ================================================================ [home] title, tabs and top-level navigation (feature/home)
// The home is five tabs over a bottom bar (src/ui/tabs.ts): Shop, Army, Battle (the default), Modes, Pass. The bar stays on
// these top-level screens; battles and sub-screens (campaign map, Daily, Gauntlet...) hide it. `title()` is the way home
// from anywhere: it reopens the tab the player left from, so Daily's back button lands on Modes and the map's on Battle.
let tab: Tab = "battle";
function title() { home(tab); }

/** Draws tab `t` (dir: the side it slides in from after a swipe or a tap on a neighbour). */
function home(t: Tab = tab, dir = 0) {
  clear();
  initChests(); // the badges read the chests on every tab, not only Battle's rack
  tab = t;
  here = () => home(tab);
  if (t === "battle") screen("home hm-screen", battleTab({ next: nextBattle(), play: () => playLevel(nextLevel()), map: () => campaign(), settings: settingsSheet, army: () => home("army", -1) }));
  else if (t === "modes") screen("home hm-screen hm-modes-screen", modesTab(modeCards(), settingsSheet, () => home("army", -1)));
  else if (t === "shop") { markShopSeen(); screen("shop-screen", header("Shop", title, shopCounters()), shopView(starter, gemShop)); } // [store] counters, Starter Pack, chests mount, gem packs, coin bundles
  else if (t === "army") barracksScreen({ app, back: title, shop: () => home("shop", -1) }); // [progression]
  else passTab();
  const page = [...app.querySelectorAll<HTMLElement>(":scope > .screen")].pop();
  if (page) {
    page.classList.add("tabbed", `tab-${t}`);
    if (dir) page.classList.add(dir > 0 ? "tab-in-r" : "tab-in-l");
    swipeTabs(page, (d) => { const n = neighbour(tab, d); if (n && !sheetEl) { sfx("tap"); home(n, d); } });
  }
  app.append(tabBar(t, tabBadges(), (n) => home(n, TABS.indexOf(n) > TABS.indexOf(tab) ? 1 : -1)));
}

/** The next campaign level to play (the first reached and uncleared one), or the last open one when all are cleared. */
const nextLevel = () => LEVELS.find((l) => reached(l.id) && !load().campaign[l.id]) ?? [...LEVELS].reverse().find((l) => unlocked(l.id)) ?? LEVELS[0];
function nextBattle() {
  const l = nextLevel();
  return { id: l.id, of: LEVELS.length, name: l.name, act: l.act, actName: ACTS[l.act - 1] ?? "", replay: !!load().campaign[l.id] };
}

/** Badges: Army counts troops ready to level up; Shop dots until today's deals are seen; Modes dots for a fresh Daily;
 *  Battle counts chests ready to open (slots, the free chest, the crown chest). */
function tabBadges(): Badges {
  const c = chests(), now = gameNow();
  const ready = c.slots.filter((ch) => ch && stateOf(ch, now) === "ready").length
    + (freeBanked({ ...c } as never, now) > 0 ? 1 : 0) + (crownReady({ ...c, crown: { ...c.crown } } as never, localDay()) ? 1 : 0);
  return { army: readyCount(), shop: !shopSeenToday(), modes: canScore(load().daily, today()), battle: ready, pass: passBadge() };
}
const SHOP_SEEN = "muster.home.shopSeen";
const shopSeenToday = () => { try { return localStorage.getItem(SHOP_SEEN) === localDay(); } catch { return true; } };
const markShopSeen = () => { try { localStorage.setItem(SHOP_SEEN, localDay()); } catch { /* private mode */ } };
/** Badges follow the wallet, the collection and the chests while the bar is up (an upgrade, a chest opening...). */
const refreshBar = () => { const bar = app.querySelector(":scope > .tb-bar"); if (bar) bar.replaceWith(tabBar(tab, tabBadges(), (n) => home(n, TABS.indexOf(n) > TABS.indexOf(tab) ? 1 : -1))); };
onWalletChange(refreshBar); onCollectionChange(refreshBar); onChestsChange(refreshBar); onPassChange(refreshBar); onQuestsChange(refreshBar); // [pass]

/** The Modes tab's cards. Each opens the mode's own screen; its back button returns here. */
function modeCards(): ModeCard[] {
  const s = load(), d = s.daily, k = today();
  const streak = streakOn(d, k), fresh = canScore(d, k);
  const pz = Object.keys(s.puzzles).length, pzStars = Object.values(s.puzzles).reduce((a, b) => a + b, 0);
  const td = bastionStars();
  return [
    { id: "arena", name: "Arena", line: "Walls, towers and cover: climb the ladder", stat: `${s.arena?.trophies ?? 0} trophies`, progress: (() => { const p = leagueProgress(s.arena?.trophies ?? 0); return p.span ? p.into / p.span : 1; })(), art: "/arenas/act4.jpg", artY: "40%", glyph: "flag", open: arena },
    { id: "daily", name: "Daily", line: fresh ? "A new board for everyone today" : `Next board in ${untilTomorrow()}`, stat: flameChip(streak), art: "/maps/sky.jpg", artY: "4%", glyph: "flame", dot: fresh, open: daily },
    { id: "gauntlet", name: "Gauntlet", line: "Rival after rival, one health pool", stat: s.gauntlet.best ? `best ${s.gauntlet.best}` : "endless", art: "/maps/ash.jpg", artY: "2%", glyph: "crown", open: gauntlet },
    { id: "puzzles", name: "Breakpoint", line: "Win with the gold you're given", stat: starChip(pzStars, PUZZLES.length * 3), progress: pz / PUZZLES.length, art: "/maps/frozen.jpg", glyph: "star", open: puzzles },
    { id: "skirmish", name: "Skirmish", line: "Tune a rival AI and fight it", stat: "AI lab", art: "/arenas/act5.jpg", glyph: "sword", open: skirmish },
    // [td] hook: Bastion, the tower-defence mode (src/ui/td.ts). Free, like every mode.
    { id: "bastion", name: "Bastion", line: "Hold the road, tower by tower", stat: starChip(td.got, td.of), art: "/td/fords_0.webp", artY: "30%", glyph: "shield", open: () => { clear(); void import("./ui/td").then((m) => m.bastionMenu(app, title)); } },
  ];
}
/** Bastion's stars, read from its own save (src/ui/td.ts, key muster.td.v1) so td.ts stays a lazy chunk. */
function bastionStars() {
  let got = 0;
  try { const r = JSON.parse(localStorage.getItem("muster.td.v1") ?? "null"); for (const v of Object.values<number>(r?.stars ?? {})) got += v; } catch { /* fresh */ }
  return { got, of: MAP_DEFS.length * 3 };
}

/** The settings gear: Sound, Haptics, battle Speed. */
function settingsSheet() {
  const st = load().settings;
  sheet(el("div", { class: "hm-settings-wrap" }, [
    settingsBody({
      sound: st.sound, haptics: st.haptics, speed: st.speed || 1,
      setSound: (on) => { save((x) => { x.settings.sound = on; }); setSound(on); },
      setHaptics: (on) => { save((x) => { x.settings.haptics = on; }); setHaptics(on); },
      music: musicOn(), setMusic: (on) => { try { localStorage.setItem(MUSIC_KEY, on ? "1" : "0"); } catch { /* private mode */ } setMusic(on); },
      setSpeed: (n) => save((x) => { x.settings.speed = n; }),
    }),
    peekToggle(),
    btn("Done", "primary", closeSheet),
  ]));
}
/** [replay] The setting for "see it in the rival's game" after Arena battles. */
function peekToggle(): HTMLElement {
  let on = true;
  try { on = localStorage.getItem("remuster.peek") !== "0"; } catch { /* private mode */ }
  const b = btn("", "ghost", () => { on = !on; try { localStorage.setItem("remuster.peek", on ? "1" : "0"); } catch { /* private mode */ } paint(); });
  const paint = () => { b.textContent = `Rival's game after Arena battles: ${on ? "On" : "Off"}`; };
  paint();
  return b;
}

// ---------------------------------------------------------------- [home] PASS TAB: the lead swaps in the War Pass here
// At merge, replace this body with the War Pass screen from src/ui/pass.ts, e.g.:
//   passScreen(app, { back: title, shop: () => home("shop", -1) });
// It should append one `.screen` to `app` (home() then adds the tab bar and swipe, and hides a `.screen-head > .back`).
function passTab() {
  // [pass] the War Pass screen (src/ui/pass.ts) fills the Pass tab; home() adds the tab bar around it.
  passScreen(app, { back: title });
}
// ================================================================ [/home]

// ---------------------------------------------------------------- campaign
/** Reached in the campaign: the first level, or the one before it cleared. */
const reached = (id: number) => id === 1 || (load().campaign[id - 1] ?? 0) > 0;
/** Reached: every level is free to play, opened by clearing the one before it. */
const unlocked = reached;
const SVG = "http://www.w3.org/2000/svg";

/** The campaign: one illustrated map per act (by ACTS index), level nodes on the painted road, swipe or arrows between acts. */
function campaign(focusAct?: number) {
  clear();
  const s = load();
  const acts = ACTS.map((name, i) => ({ name, index: i, levels: LEVELS.filter((l) => l.act === i + 1) })).filter((a) => a.levels.length);
  // The next level to play; the map opens on its act.
  const next = LEVELS.find((l) => reached(l.id) && !s.campaign[l.id]) ?? [...LEVELS].reverse().find((l) => unlocked(l.id));
  const want = focusAct ?? next?.act ?? 1;
  let cur = Math.max(0, acts.findIndex((a) => a.index === want - 1));
  const total = Object.values(s.campaign).reduce((a, b) => a + b, 0);

  const kicker = el("small", {});
  const name = el("span", {});
  const actStars = el("span", { class: "act-stars" });
  const head = el("div", { class: "screen-head map-head" }, [
    btn(icon("back"), "icon-btn back", title),
    el("h1", {}, [kicker, name]),
    el("div", { class: "map-totals" }, [actStars, starTotal(total)]),
  ]);
  const view = el("div", { class: "map-view" });
  const prev = btn("‹", "icon-btn act-prev", () => go(cur - 1));
  const nextBtn = btn("›", "icon-btn act-next", () => go(cur + 1));
  const dots = el("div", { class: "act-dots" });
  const bar = el("div", { class: "act-bar" }, [prev, dots, nextBtn]);
  const scr = screen("campaign map-screen", head, view, bar);
  here = () => campaign(acts[cur].index + 1);

  const actOpen = (a: (typeof acts)[number]) => unlocked(a.levels[0].id);
  acts.forEach((a, i) => {
    const d = el("button", { class: `act-dot ${actOpen(a) ? "" : "locked"}`, "aria-label": `Act ${a.index + 1}` });
    d.addEventListener("click", () => { sfx("tap"); go(i); });
    dots.append(d);
  });

  let swiped = false;
  function render(dir = 0) {
    const a = acts[cur];
    const map = mapForAct(a.index);
    const open = actOpen(a);
    kicker.textContent = `Act ${a.index + 1} of ${acts.length}`;
    name.textContent = a.name;
    const got = a.levels.reduce((n, l) => n + (s.campaign[l.id] ?? 0), 0);
    actStars.textContent = `${got}/${a.levels.length * 3}`;
    (prev as HTMLButtonElement).disabled = cur === 0;
    (nextBtn as HTMLButtonElement).disabled = cur === acts.length - 1;
    dots.querySelectorAll(".act-dot").forEach((d, i) => d.classList.toggle("on", i === cur));
    scr.style.setProperty("--map-tint", map.tint);

    const pts = nodePositions(map, a.levels.length);
    const reached = a.levels.reduce((k, l, i) => (unlocked(l.id) ? i : k), -1);
    const page = el("div", { class: `map ${open ? "" : "locked"} ${dir > 0 ? "from-right" : dir < 0 ? "from-left" : ""}`, style: `background-image:url(${map.image})` });
    // progress trail: the road walked so far, up to the furthest open node
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "map-trail");
    svg.setAttribute("viewBox", `0 0 ${MAP_SIZE.w} ${MAP_SIZE.h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    if (reached > 0) {
      const t = nodeFractions(a.levels.length)[reached];
      const line = document.createElementNS(SVG, "polyline");
      line.setAttribute("points", pathUpTo(map.path, t).map(([x, y]) => `${(x * MAP_SIZE.w).toFixed(1)},${(y * MAP_SIZE.h).toFixed(1)}`).join(" "));
      svg.append(line);
    }
    page.append(svg);
    a.levels.forEach((l, i) => {
      const lopen = unlocked(l.id);
      const best = s.campaign[l.id] ?? 0;
      const current = next?.id === l.id && lopen;
      const [x, y] = pts[i];
      const n = el("button", {
        class: `node ${lopen ? "" : "locked"} ${l.boss ? "boss" : ""} ${best ? "done" : ""} ${current ? "current" : ""}`,
        style: `left:${(x * 100).toFixed(2)}%;top:${(y * 100).toFixed(2)}%`,
        "aria-label": `Level ${l.id}: ${l.name}${lopen ? "" : " (locked)"}`,
      }, [
        el("span", { class: "node-face" }, [lopen ? el("span", { class: "node-id" }, [String(l.id)]) : el("span", { class: "node-lock" })]),
        stars(best),
      ]);
      if (l.boss) n.append(el("span", { class: "node-boss" }, ["Boss"]));
      if (l.unlock && lopen) for (const k of l.unlocks ?? [l.unlock]) n.append(unitIcon(k, 24));
      if (current) n.append(el("span", { class: "node-name" }, [l.name]));
      n.addEventListener("click", () => {
        if (swiped) return;
        if (lopen) { sfx("tap"); levelSheet(l); } else { sfx("deny"); n.classList.remove("shake"); void n.offsetWidth; n.classList.add("shake"); }
      });
      page.append(n);
    });
    if (!open) {
      const prevBoss = LEVELS.find((l) => l.id === a.levels[0].id - 1);
      page.append(el("div", { class: "map-lock" }, [el("span", { class: "node-lock" }), el("b", {}, [`Act ${a.index + 1} is locked`]), el("small", {}, [prevBoss ? `Beat ${prevBoss.foe} to open it` : "Finish the act before it"])]));
    }
    view.replaceChildren(page);
    const focus = page.querySelector(".node.current") ?? page.querySelectorAll(".node")[Math.max(0, reached)];
    requestAnimationFrame(() => (focus as HTMLElement | null)?.scrollIntoView({ block: "center" }));
  }

  function go(i: number) {
    if (i < 0 || i >= acts.length || i === cur) return;
    const dir = i > cur ? 1 : -1;
    cur = i;
    render(dir);
  }

  // Horizontal swipe changes act; vertical drags still scroll the map.
  let sx = 0, sy = 0, down = false;
  view.addEventListener("pointerdown", (e) => { down = true; swiped = false; sx = e.clientX; sy = e.clientY; });
  view.addEventListener("pointerup", (e) => {
    if (!down) return;
    down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      const before = cur;
      go(cur + (dx < 0 ? 1 : -1));
      if (cur !== before) { swiped = true; sfx("tap"); setTimeout(() => { swiped = false; }, 0); }
    }
  });
  view.addEventListener("pointercancel", () => { down = false; });
  render();
}

function levelSheet(l: LevelDef) {
  const best = load().campaign[l.id] ?? 0;
  const objs = el("ul", { class: "objectives" }, l.stars.map((o, i) => el("li", { class: i < best ? "met" : "" }, [stars(i < best ? 1 : 0, 1), objectiveText(o)])));
  const tags = el("div", { class: "tags" }, [
    el("span", { class: "tag" }, [cap(l.ai.tactic)]),
    el("span", { class: "tag" }, [icon("shield"), `${l.hp[1]}`]),
    ...(l.boss ? [el("span", { class: "tag boss" }, [icon("crown"), "Boss"])] : []),
    el("span", { class: `tag rec ${armyLevel(l.roster) < foeLevelForAct(l.act) - 0.5 ? "low" : ""}` }, [`Recommended Lv ${foeLevelForAct(l.act)}`]), // [progression]
  ]);
  const roster = el("div", { class: "roster" }, l.roster.map((k) => framedPortrait(k, 1, `roster-unit ${(l.unlocks ?? [l.unlock]).includes(k) ? "new" : ""}`).frame));
  sheet(el("div", {}, [
    el("div", { class: "sheet-kicker" }, [`Act ${l.act} · Level ${l.id}`]),
    el("h2", {}, [l.name]),
    el("div", { class: "foe-line" }, ["vs ", el("b", {}, [l.foe])]),
    ...(l.line ? [el("p", { class: "flavour" }, [l.line])] : []),
    tags, roster, objs,
    btn("Fight", "primary big", () => { closeSheet(); playLevel(l); }),
  ]));
}

function playLevel(l: LevelDef, attempt = 0) {
  clear();
  game = new GameScreen(app, {
    cfg: withLevels(levelConfig(l, attempt), "campaign", { act: l.act }), // [progression]
    foe: l.ai,
    mode: "campaign",
    title: l.name,
    arena: l.act,
    marks: l.marks, // [arena] the level's set piece: its blocks are cfg.terrain
    hint: l.id === 1 && !load().campaign[1],
    onEnd: (m) => {
      const n = starsFor(l, m);
      // [progression] once the result sheet is up: "your army is under-levelled" with a way to the Army
      if (m.winner !== 0) queueMicrotask(() => underLevelledHint({ avg: armyLevel(l.roster), recommended: foeLevelForAct(l.act), openArmy: barracks }));
      const coins = awardCampaign(l, m.winner === 0, n); // [progression] before the star save, to see a first clear
      if (n > (load().campaign[l.id] ?? 0)) save((s) => { s.campaign[l.id] = n; });
      const nextL = LEVELS.find((x) => x.id === l.id + 1);
      results(m, {
        heading: m.winner === 0 ? "Victory" : "Defeat",
        stars: m.winner === 0 ? n : undefined,
        lines: l.stars.map((o) => [objectiveText(o), objectiveMet(o, m)] as [string, boolean]),
        primary: m.winner === 0 && nextL
          ? ["Next level", () => playLevel(nextL)]
          : m.winner === 0 && l.boss // the last boss: the ending card, then back to the map
            ? ["Continue", () => { campaign(l.act); showEnding(app, () => campaign(l.act)); }]
            : ["Retry", () => playLevel(l, attempt + 1)],
        secondary: ["Campaign", () => campaign(l.act)],
      });
      attachReward(coins, barracks); // [progression]
      if (m.winner === 0) chestEarned(winChest(n)); // [chests]
    },
    onQuit: () => campaign(l.act),
    onRestart: () => playLevel(l, attempt + 1),
  });
  game.view.bossKeep = !!l.boss; // [keeps polish] act bosses get the boss keep
}

// ---------------------------------------------------------------- results
function results(m: Match, o: { heading: string; stars?: number; lines?: [string, boolean][]; note?: string; primary: [string, () => void]; secondary: [string, () => void] }) {
  const won = m.winner === 0;
  const lost = m.history.filter((r) => r.winner === 1).length;
  const n = o.stars ?? 0;
  sheet(el("div", { class: `results ${won ? "won" : "lost"}` }, [
    ribbon(o.heading),
    o.stars !== undefined ? stars(o.stars, 3, "result-stars") : el("div", { class: "result-crest" }, [icon(won ? "crown" : "shield")]),
    el("div", { class: "result-stats" }, [
      el("span", {}, [el("b", {}, [String(m.played)]), "rounds"]),
      el("span", {}, [el("b", {}, [String(Math.round(m.sides[0].hp))]), "health left"]),
      el("span", {}, [el("b", {}, [String(lost)]), "rounds lost"]),
    ]),
    ...(o.lines ? [el("ul", { class: "objectives" }, o.lines.map(([t, ok]) => el("li", { class: ok ? "met" : "" }, [stars(ok ? 1 : 0, 1), t])))] : []),
    ...(o.note ? [el("p", { class: "flavour" }, [o.note])] : []),
    btn(o.primary[0], "primary big", () => { closeSheet(); o.primary[1](); }),
    btn(o.secondary[0], "ghost", () => { closeSheet(); o.secondary[1](); }),
  ]), false, true);
  showRewards(sheetEl, settleRewards()); // [gems] free gems this result earned
  // A chime as each star lands (timed with the CSS: 0.35 s, 0.75 s, 1.15 s).
  const shown = sheetEl;
  for (let i = 0; i < n; i++) setTimeout(() => { if (sheetEl === shown) sfx(i === 2 ? "upgrade" : "buy"); }, 350 + 400 * i + 180);
}

// ---------------------------------------------------------------- sheets
let sheetEl: HTMLElement | null = null;
function sheet(content: HTMLElement, dismissable = true, center = false) {
  closeSheet();
  sheetEl = el("div", { class: `overlay ${center ? "center" : ""}` }, [el("div", { class: "sheet" }, [content])]);
  if (dismissable) sheetEl.addEventListener("click", (e) => { if (e.target === sheetEl) closeSheet(); });
  app.append(sheetEl);
}
function closeSheet() { sheetEl?.remove(); sheetEl = null; }

// ---------------------------------------------------------------- breakpoint
function puzzles() {
  clear();
  here = puzzles;
  const s = load();
  const tiles: HTMLElement[] = [];
  PUZZLES.forEach((p, i) => {
    const open = i === 0 || (s.puzzles[PUZZLES[i - 1].id] ?? 0) > 0;
    const b = el("button", { class: `tile ${open ? "" : "locked"} ${s.puzzles[p.id] ? "done" : ""}` }, [
      el("span", { class: "tile-id" }, [String(p.id)]), el("span", { class: "tile-name" }, [p.name]), stars(s.puzzles[p.id] ?? 0),
    ]);
    b.addEventListener("click", () => { if (open) { sfx("tap"); playPuzzle(p); } else sfx("deny"); });
    tiles.push(b);
  });
  const grid = el("div", { class: "puzzle-grid" }, tiles);
  const ptotal = Object.values(s.puzzles).reduce((a, b) => a + b, 0);
  screen("puzzles", header("Breakpoint", title, starTotal(ptotal)), grid);
}

function playPuzzle(p: PuzzleDef) {
  clear();
  game = new GameScreen(app, {
    cfg: puzzleConfig(p),
    mode: "puzzle",
    title: p.name,
    showEnemyMines: true,
    onEnd: (m) => {
      const won = m.history[0]?.winner === 0;
      const n = puzzleStars(p, won, m.sides[0].gold);
      if (n > (load().puzzles[p.id] ?? 0)) save((s) => { s.puzzles[p.id] = n; });
      const after = PUZZLES[PUZZLES.indexOf(p) + 1];
      const next = after;
      results(m, {
        heading: won ? "Solved" : "Not yet",
        stars: won ? n : undefined,
        lines: [["Win the battle", won], [`Keep ${p.silver}+ gold`, won && m.sides[0].gold >= p.silver], [`Keep ${p.par}+ gold`, won && m.sides[0].gold >= p.par]],
        primary: won && next ? ["Next puzzle", () => playPuzzle(next)] : ["Try again", () => playPuzzle(p)],
        secondary: ["Puzzles", puzzles],
      });
    },
    onQuit: puzzles,
    onRestart: () => playPuzzle(p),
  });
}

// ---------------------------------------------------------------- gauntlet
let run: GauntletRun | null = null;

function gauntlet() {
  clear();
  const s = load();
  screen("gauntlet", header("Gauntlet", title),
    el("div", { class: "panel" }, [
      el("p", { class: "lead" }, ["One health pool. Rival after rival. Your army carries on, and every win brings a boon."]),
      el("div", { class: "result-stats" }, [
        el("span", {}, [el("b", {}, [String(s.gauntlet.best)]), "best"]),
        el("span", {}, [el("b", {}, [String(s.gauntlet.runs)]), "runs"]),
      ]),
      ...(run && !run.over ? [btn(`Continue · rival ${run.stage}`, "primary big", () => duel())] : []),
      btn("New run", run && !run.over ? "big" : "primary big", () => { run = newRun(Math.floor(Math.random() * 1e9)); save((x) => { x.gauntlet.runs++; }); duel(); }),
    ]));
}

function duel() {
  if (!run) return;
  clear();
  const r = run;
  const foe = gauntletFoe(r.stage, boardValue(r.board), r.seed);
  game = new GameScreen(app, {
    cfg: withLevels(duelConfig(r, foe), "gauntlet", { stage: r.stage }), // [progression]
    foe: foe.ai,
    mode: "gauntlet",
    title: `Rival ${r.stage}`,
    onEnd: (m) => {
      const won = endDuel(r, m);
      if (!won) {
        if (r.wins > load().gauntlet.best) save((s) => { s.gauntlet.best = r.wins; });
        results(m, {
          heading: "Run over",
          note: `You beat ${r.wins} rival${r.wins === 1 ? "" : "s"}.`,
          primary: ["New run", () => { run = newRun(Math.floor(Math.random() * 1e9)); save((x) => { x.gauntlet.runs++; }); duel(); }],
          secondary: ["Menu", title],
        });
        rallyOffer(sheetEl, r, duel); // [gems] Gauntlet Rally: refight this rival for gems, once per run
        return;
      }
      if (r.wins > load().gauntlet.best) save((s) => { s.gauntlet.best = r.wins; });
      const coins = awardGauntletRival(r.stage - 1); // [progression]
      boonPick(r);
      attachReward(coins); // [progression]
      chestEarned(winChest(2)); // [chests] two crowns a rival
    },
    onQuit: gauntlet,
  });
}

function boonPick(r: GauntletRun) {
  const choices = boonChoices(r);
  sheet(el("div", { class: "boons results" }, [
    // Ribbon first, then the kicker: above it, the shared .results ribbon pull-up hid the kicker.
    ribbon("Choose a boon", "gold"),
    el("div", { class: "sheet-kicker" }, [`Rival ${r.stage - 1} beaten · ${Math.round(r.hp)} health left`]),
    el("div", { class: "boon-list" }, choices.map((b) => btn(el("span", {}, [el("b", {}, [b.name]), el("small", {}, [b.text])]), "boon", () => { takeBoon(r, b.id); closeSheet(); duel(); }))),
  ]), false);
}

// ---------------------------------------------------------------- [arena] Arena: battles around walls, buildings and cover, on a trophy ladder
/** A top-down thumbnail of an arena's blocks (the same rectangles the sim uses). */
function arenaThumb(a: ArenaDef, px = 54) {
  const c = el("canvas", { class: "ar-thumb" }) as HTMLCanvasElement;
  const k = px / 9, dpr = Math.min(3, window.devicePixelRatio || 1);
  c.width = Math.round(9 * k * dpr); c.height = Math.round(14 * k * dpr);
  c.style.width = `${9 * k}px`; c.style.height = `${14 * k}px`;
  const g = c.getContext("2d")!;
  g.scale(k * dpr, k * dpr);
  const M = TERRAIN.mat, zone = (b: { kind: import("@engine/core/terrain").BlockKind }) => isZone(b.kind);
  for (const b of [...a.blocks.filter(zone), ...a.blocks.filter((b) => !zone(b))]) {
    const k = b.kind as string;
    g.fillStyle = k === "water" ? TERRAIN.water.shallow : k === "road" ? TERRAIN.road.fill : k === "brush" ? TERRAIN.brush.b : k === "building" ? M.roof : k === "wall" ? M.stone : M.timber;
    g.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  }
  return c;
}

function arena() {
  clear();
  here = arena;
  trackScreen("arena");
  const s = arenaLadder(), p = leagueProgress(s.trophies), next = nextArenaMatch();
  const gain = trophyChange(s, true);
  screen("arena-screen", header("Arena", title),
    el("div", { class: "panel ar-ladder" }, [
      el("div", { class: "ar-league" }, [
        el("span", { class: `ar-badge league-${p.league.id}` }, [icon("flag")]),
        el("div", {}, [el("small", {}, ["League"]), el("b", {}, [p.league.name])]),
        el("div", { class: "ar-trophies" }, [el("b", {}, [String(s.trophies)]), el("small", {}, ["trophies"])]),
      ]),
      el("div", { class: "ar-bar" }, [el("i", { style: `width:${Math.round((p.span ? p.into / p.span : 1) * 100)}%` })]),
      el("small", { class: "ar-next" }, [p.next ? `${p.span - p.into} to ${p.next.name}` : "Top league"]),
      el("div", { class: "result-stats" }, [
        el("span", {}, [el("b", {}, [String(s.wins)]), "wins"]),
        el("span", {}, [el("b", {}, [String(s.streak)]), "streak"]),
        el("span", {}, [el("b", {}, [String(s.best)]), "best"]),
      ]),
    ]),
    el("div", { class: "panel ar-next-match" }, [
      el("div", { class: "ar-vs" }, [
        arenaThumb(next.arena, 46),
        el("div", { class: "ar-vs-text" }, [
          el("small", {}, ["Next battle"]),
          el("b", {}, [next.arena.name]),
          el("span", {}, [next.arena.blurb]),
          el("span", { class: "ar-foe" }, [`vs ${next.foe.name}, ${next.foe.title} · level ${next.foe.level}`]),
        ]),
      ]),
      btn(el("span", {}, ["Battle", el("small", {}, [` +${gain} / ${trophyChange(s, false)}`])]), "primary big", () => void playArena()),
    ]),
    el("div", { class: "ar-list" }, LEAGUES.map((l) => el("div", { class: `panel ar-row ${s.best >= l.trophies ? "" : "locked"}` }, [
      el("div", { class: "ar-row-head" }, [el("b", {}, [l.name]), el("small", {}, [s.best >= l.trophies ? "Unlocked" : `${l.trophies} trophies`])]),
      el("div", { class: "ar-arenas" }, l.arenas.map((id) => arenaById(id)!).map((a) => el("div", { class: `ar-arena ${arenaUnlocked(a, s.best) ? "" : "locked"}` }, [
        arenaThumb(a, 40), el("span", {}, [a.name]), el("small", {}, [s.arenaWins[a.id] ? `${s.arenaWins[a.id]} won` : arenaUnlocked(a, s.best) ? "new" : "locked"]),
      ]))),
    ]))),
  );
}

async function playArena(o: { arena?: string; seed?: number } = {}) {
  clear();
  // With a backend the server issues the match and verifies the result; deep links and offline play stay local.
  const srv = o.arena || o.seed !== undefined ? null : await onlineArenaMatch();
  const next = srv ?? nextArenaMatch(o);
  game = new GameScreen(app, {
    cfg: next.cfg, foe: next.foe.ai, mode: "arena", title: next.arena.name,
    arena: ARENA_BACKDROP[next.arena.id], marks: next.arena.marks,
    intro: `${next.arena.name} · vs ${next.foe.name}`,
    onEnd: async (m) => {
      const won = m.winner === 0;
      const verified = srv ? await onlineArenaFinish(srv, m) : null;
      const end = verified ? settleArena(next, verified) : awardArena(next, won); // one or the other, never both
      trackMatchEnd("arena", won, m.played);
      const r = end.result;
      results(m, {
        heading: won ? "Victory" : m.winner === 1 ? "Defeat" : "Draw",
        note: `${r.delta >= 0 ? "+" : ""}${r.delta} trophies · ${r.trophies} now${r.promoted ? ` · promoted to ${r.to.name}` : r.streak > 1 ? ` · ${r.streak} in a row` : ""}`,
        primary: ["Next battle", () => void playArena()],
        secondary: ["Arena", arena],
      });
      void offerPeek(next, m); // [replay] "see it in the rival's game", when there is one to show
      attachReward(end.reward, barracks);
      if (end.chest) chestEarned(end.chest);
    },
    // Walking out of a ladder match the server issued is a loss (otherwise a match could be retried until won).
    onQuit: () => { if (srv) void onlineArenaForfeit(srv).finally(arena); else arena(); },
  });
}

// ---------------------------------------------------------------- [replay] the rival's side of an Arena battle
/** Adds "See it in <rival>'s game" to the open results sheet, if the setting is on and a rival's game can be reached. */
async function offerPeek(next: import("@engine/core/arena").ArenaMatch, m: Match) {
  const { peekOn, loadPeers, peerFor, replayOf, replayUrl, openPeek } = await import("./replay");
  if (!peekOn()) return;
  const shown = sheetEl, peer = peerFor(next.foe.name, await loadPeers(__GAME__));
  const payload = peer && replayOf(next, m, { id: __GAME__, name: document.title || __GAME__ });
  if (!peer || !payload || sheetEl !== shown || !shown) return;
  const here = { id: __GAME__, name: document.title || __GAME__, url: location.href.replace(/[?#].*$/, "") };
  const b = btn(`See it in ${next.foe.name}'s game`, "ghost peek-btn", () => openPeek(replayUrl(here, payload), replayUrl(peer, payload), [`You: ${here.name}`, `${next.foe.name}: ${peer.name}`]));
  shown.querySelector(".results")?.append(b);
}
/** This game was opened to show a battle from another game: fight that one round, watch only, save nothing. */
async function playReplay(p: import("./replay").ReplayPayload) {
  const { replayConfig, waitForGo } = await import("./replay");
  const a = arenaById(p.arena)!;
  clear();
  await waitForGo(); // in a compare view, both games start the round together
  game = new GameScreen(app, {
    cfg: replayConfig(p), you: { ...DEFAULT_AI, difficulty: 0 }, mode: "watch", scripted: true, board: p.pieces,
    title: a.name, arena: ARENA_BACKDROP[a.id], marks: a.marks, intro: `${a.name} · vs ${p.names[1]}`,
    onEnd: () => { /* the battle stays on its last frame; the overlay's Close button is the way out */ }, onQuit: () => { try { parent !== window ? parent.postMessage("remuster:peek-close", "*") : title(); } catch { title(); } },
  });
}

// ---------------------------------------------------------------- daily challenge
/** Today's day key: the device's local calendar day. */
const today = () => dateKey(new Date());
const num = (n: number) => n.toLocaleString("en");
function untilTomorrow() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function daily() {
  clear();
  const key = today();
  const d = load().daily;
  const open = canScore(d, key);
  const streak = streakOn(d, key);
  // hud polish: the page body (board preview, rival, draft, streak week) lives in ui/daily.ts.
  screen("daily", header("Daily", title, el("span", { class: "star-total daily-streak-pill" }, [icon("flame"), String(streak)])),
    dailyBody({
      board: dailyBoard(key), save: d, key, streak, open, next: untilTomorrow(),
      when: new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
      action: open
        ? btn("Play today's board", "primary big daily-play", () => { save((s) => { beginDaily(s.daily, key); }); playDaily(key, false); })
        : btn("Practice (unscored)", "big daily-play", () => playDaily(key, true)),
    }));
}

function playDaily(key: string, practice: boolean, attempt = 0) {
  clear();
  const b = dailyBoard(key);
  const cfg = dailyConfig(b);
  // Practice replays shuffle the shop; the scored attempt is the same match for everyone.
  if (practice) cfg.seed = (cfg.seed + 7919 * (attempt + 1)) >>> 0;
  game = new GameScreen(app, {
    cfg,
    foe: b.foe.ai,
    mode: "daily",
    arena: b.arena,
    title: practice ? "Daily practice" : `Daily ${b.number}`,
    intro: `vs ${b.foe.name} · ${b.rule.name}`,
    onEnd: (m) => {
      const r = dailyResult(m);
      let scored = false;
      if (!practice) save((s) => { scored = finishDaily(s.daily, key, r); });
      const d = load().daily;
      const coins = awardDaily(r.won, scored, d.streak); // [progression] scored attempt only
      passEvent({ kind: "play", mode: "daily" }); // [pass] "play the Daily" quest
      results(m, {
        heading: r.won ? "Victory" : "Defeat",
        note: scored
          ? `Score ${num(r.score)} · streak ${d.streak}${d.bestKey === key ? " · new best!" : ""}`
          : `Practice: ${num(r.score)}, not scored.`,
        primary: ["Daily", daily],
        secondary: ["Menu", title],
      });
      attachReward(coins, barracks); // [progression]
    },
    onQuit: daily,
    ...(practice ? { onRestart: () => playDaily(key, true, attempt + 1) } : {}),
  });
}

// ---------------------------------------------------------------- skirmish / AI lab
interface Lab { foe: AIProfile; you: AIProfile; watch: boolean; hp: [number, number]; }

function skirmish() {
  clear();
  const lab: Lab = { foe: { ...DEFAULT_AI }, you: { ...DEFAULT_AI, difficulty: 0.8 }, watch: false, hp: [START_HP, START_HP], ...(load().lab as Partial<Lab> | undefined) };
  const persist = () => save((s) => { s.lab = lab; });
  const profileEditor = (p: AIProfile, label: string) => {
    const slider = (key: "difficulty" | "aggression" | "economy" | "spread", name: string, lo: string, hi: string) => {
      const out = el("output", {}, [String(Math.round(p[key] * 100))]);
      const input = el("input", { type: "range", min: "0", max: "100", value: String(Math.round(p[key] * 100)) }) as HTMLInputElement;
      input.addEventListener("input", () => { p[key] = Number(input.value) / 100; out.textContent = input.value; persist(); });
      return el("label", { class: "slider" }, [el("span", { class: "slider-name" }, [name, out]), input, el("span", { class: "slider-ends" }, [el("i", {}, [lo]), el("i", {}, [hi])])]);
    };
    const chips = el("div", { class: "chips" }, TACTICS.map((t) => {
      const c = el("button", { class: `chip ${p.tactic === t ? "on" : ""}` }, [t]);
      c.addEventListener("click", () => { p.tactic = t; persist(); sfx("tap"); chips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x.textContent === t)); });
      return c;
    }));
    const rr = el("output", {}, [String(p.rerolls)]);
    const rerolls = el("input", { type: "range", min: "0", max: "3", value: String(p.rerolls) }) as HTMLInputElement;
    rerolls.addEventListener("input", () => { p.rerolls = Number(rerolls.value); rr.textContent = rerolls.value; persist(); });
    return el("section", { class: "profile" }, [
      el("h2", {}, [label]),
      slider("difficulty", "Difficulty", "green", "ruthless"),
      slider("aggression", "Aggression", "turtle", "all-in"),
      slider("economy", "Economy", "spend it", "bank it"),
      slider("spread", "Formation", "column", "wide"),
      el("label", { class: "slider" }, [el("span", { class: "slider-name" }, ["Rerolls a round", rr]), rerolls]),
      el("div", { class: "slider-name" }, ["Tactic"]), chips,
    ]);
  };
  const hpRow = (i: 0 | 1, name: string) => {
    const out = el("output", {}, [String(lab.hp[i])]);
    const input = el("input", { type: "range", min: "50", max: "800", step: "50", value: String(lab.hp[i]) }) as HTMLInputElement;
    input.addEventListener("input", () => { lab.hp[i] = Number(input.value); out.textContent = input.value; persist(); });
    return el("label", { class: "slider" }, [el("span", { class: "slider-name" }, [name, out]), input]);
  };
  const youBox = el("div", { class: lab.watch ? "" : "hidden" }, [profileEditor(lab.you, "Your side's AI")]);
  const watch = el("label", { class: "toggle" }, [el("input", { type: "checkbox", ...(lab.watch ? { checked: "" } : {}) }), el("span", {}, ["Watch AI vs AI"])]);
  watch.querySelector("input")!.addEventListener("change", (e) => { lab.watch = (e.target as HTMLInputElement).checked; youBox.classList.toggle("hidden", !lab.watch); persist(); });
  screen("lab", header("Skirmish", title),
    el("div", { class: "lab-body" }, [
      profileEditor(lab.foe, "Rival AI"),
      el("section", { class: "profile" }, [el("h2", {}, ["Health"]), hpRow(0, "You"), hpRow(1, "Rival")]),
      watch, youBox,
    ]),
    el("div", { class: "lab-foot" }, [btn("Start", "primary big", () => playSkirmish(lab))]),
  );
}

function playSkirmish(lab: Lab) {
  clear();
  game = new GameScreen(app, {
    cfg: withLevels({ seed: Math.floor(Math.random() * 1e9), hp: lab.hp, names: [lab.watch ? "Blue AI" : "You", `${cap(lab.foe.tactic)} AI`] }, lab.watch ? "watch" : "skirmish"), // [progression]
    foe: { ...lab.foe },
    you: lab.watch ? { ...lab.you } : undefined,
    mode: lab.watch ? "watch" : "skirmish",
    title: "Skirmish",
    onEnd: (m) => {
      const coins = awardSkirmish(m.winner === 0, lab.watch, lab.foe.difficulty, lab.hp); // [progression]
      results(m, {
        heading: m.winner === 0 ? (lab.watch ? "Blue wins" : "Victory") : m.winner === 1 ? (lab.watch ? "Red wins" : "Defeat") : "Draw",
        primary: ["Again", () => playSkirmish(lab)],
        secondary: ["AI lab", skirmish],
      });
      attachReward(coins, barracks); // [progression]
      if (m.winner === 0 && !lab.watch) chestEarned(winChest(2)); // [chests]
    },
    onQuit: skirmish,
    onRestart: () => playSkirmish(lab),
  });
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- shop
/** [home] The Shop is a tab now. `back` is kept for older callers; the tab bar is the way out. */
function shopScreen(_back?: () => void) { home("shop"); }

// ---------------------------------------------------------------- barracks
// [progression] The Barracks is now the Army (src/ui/army.ts via the barracks.ts alias): the card collection, upgrades
// with cards + coins, the commander level, "Get coins" to the Shop. [home] It is the Army tab.
function barracks() { home("army"); }

// ---------------------------------------------------------------- showcase (debug / store shots)
function showcase(n: number) {
  clear();
  const sets: [string, number, number, number][][] = [
    [["pikeman", 3.0, 4.8, 4], ["ravager", 6.0, 4.6, 3], ["rime", 2.2, 2.6, 4], ["tinker", 6.8, 2.2, 3], ["banner", 4.5, 3.2, 4], ["grave", 4.5, 1.2, 3]],
    [["lancer", 2.0, 3.6, 4], ["keg", 4.5, 4.9, 3], ["harrier", 6.5, 3.4, 4], ["sapper", 7.6, 4.2, 3], ["trickster", 3.4, 2.4, 4], ["bombard", 4.5, 0.8, 3]],
    // 1.1: the four late-Act-7 units, Ascended and not.
    [["hook", 3.2, 4.6, 4], ["hook", 6.2, 4.4, 2], ["outrider", 1.2, 3.0, 4], ["thorn", 4.5, 1.6, 4], ["lamp", 6.6, 1.4, 4], ["outrider", 7.8, 2.6, 1]],
    // The three legendaries, Ascended and not.
    [["lion", 3.4, 4.6, 4], ["lion", 6.0, 4.6, 1], ["griffin", 1.4, 3.0, 4], ["griffin", 7.6, 3.0, 2], ["tide", 4.5, 1.4, 4], ["tide", 6.8, 1.6, 3]],
    // Tier line-up: each legendary at ranks 1-4, left to right.
    (["lion", "griffin", "tide"] as const).flatMap((k, row) => [1, 2, 3, 4].map((r): [string, number, number, number] => [k, 1.3 + (r - 1) * 2.1, 4.8 - row * 1.7, r])),
  ];
  const [mine, theirs] = n === 2 ? [sets[1], sets[0]] : n === 3 ? [sets[2], sets[0]] : n === 4 ? [sets[3], sets[0]] : n === 5 ? [sets[4], sets[0]] : sets;
  const start = (list: [string, number, number, number][]) => list.map(([kind, lx, depth, rank]) => ({ kind: kind as UnitKind, lx, depth, rank }));
  const ai = (t: Tactic): AIProfile => ({ ...DEFAULT_AI, difficulty: 0.6, tactic: t, economy: 1 });
  game = new GameScreen(app, {
    cfg: { seed: 7 + n, hp: [400, 400], firstRound: 6, start: [start(mine), start(theirs)], names: ["Tide", "Ember"] },
    foe: ai("balanced"),
    you: ai("balanced"),
    mode: "watch",
    title: "Showcase",
    onEnd: () => title(),
    onQuit: title,
  });
}

// ---------------------------------------------------------------- [gems] review shots
/** ?gemdemo=reward (Act 1 boss cleared with three stars) or ?gemdemo=rally (a lost Gauntlet run), on a stand-in match. */
function gemDemo(kind: string) {
  title();
  const won = kind === "reward";
  const m = { winner: won ? 0 : 1, played: 9, history: [{ winner: 1 }, { winner: 1 }], sides: [{ hp: won ? 212 : 0 }] } as unknown as Match;
  if (won) {
    const boss = LEVELS.find((l) => l.boss)!;
    save((s) => { s.campaign[boss.id] = 3; });
    return results(m, { heading: "Victory", stars: 3, lines: boss.stars.map((o) => [objectiveText(o), true] as [string, boolean]), primary: ["Next level", title], secondary: ["Campaign", title] });
  }
  run = { ...newRun(42), stage: 4, wins: 3, over: true, hp: 0 };
  const r = run;
  results(m, { heading: "Run over", note: "You beat 3 rivals.", primary: ["New run", title], secondary: ["Menu", title] });
  rallyOffer(sheetEl, r, duel);
}

// ---------------------------------------------------------------- [film] scripted battles for video capture
async function playFilm(name: string, speed: number) {
  const { SCENES, sceneConfig, filmState, filmMark, filmCamera } = await import("./film");
  const t0 = performance.now(), still = new URLSearchParams(location.search).has("still");
  const scene = SCENES[name] ?? SCENES.clash;
  const st = filmState(name);
  save((s) => { s.settings.speed = speed || scene.speed || 1; });
  clear();
  game = new GameScreen(app, {
    cfg: sceneConfig(scene), you: { ...DEFAULT_AI, difficulty: 0 }, mode: "watch", scripted: true, title: scene.title, arena: scene.arena,
    camera: still ? undefined : () => filmCamera(name, (performance.now() - t0) / 1000),
    marks: scene.marks ?? (scene.terrain ? arenaById(scene.terrain)?.marks : undefined),
    onEnd: (m) => {
      filmMark("end");
      if (!scene.sheet) return;
      // the real results sheet, with the real button (it has nowhere to go while filming)
      results(m, { heading: "Victory", note: "+28 trophies · 1,312 now · 3 in a row", primary: ["Next battle", () => {}], secondary: ["Arena", () => {}] });
      sheetEl?.querySelector(".results")?.append(btn(`See it in ${scene.names?.[1] ?? "the rival"}'s game`, "ghost peek-btn", () => {}));
      filmMark("sheet");
    }, onQuit: title,
  });
  st.render = renderSfx; // the recorder rebuilds the scene's sound offline with this game's synth
  st.ready = true;
  filmMark("start");
}

// ---------------------------------------------------------------- boot
const MUSIC_KEY = "remuster.music";
async function boot() {
  document.documentElement.dataset.game = __GAME__; // [game] theme.css can scope on html[data-game="<id>"]
  installLexicon(document.body);
  try { setMusic(localStorage.getItem(MUSIC_KEY) !== "0"); } catch { /* private mode */ }
  // iOS keeps WebAudio running behind a backgrounded app unless it is suspended
  document.addEventListener("visibilitychange", () => { const c = audioContext(); if (c) void (document.hidden ? c.suspend() : c.resume()); });
  applyStyleVars(document.documentElement);
  const q = new URLSearchParams(location.search);
  if (q.has("demo")) (await import("./film")).seedDemoSave(); // [film] a mid-game save for trailers, before anything loads the save
  const s = load();
  // ?style=meadow|dusk|toy picks the kit palette; ?safe=59,34 fakes iPhone safe areas in a desktop browser.
  applyUIStyle(q.get("style"));
  if (q.has("safe")) {
    const [t, b] = (q.get("safe") || "59,34").split(",").map(Number);
    document.documentElement.style.setProperty("--st", `${t || 0}px`);
    document.documentElement.style.setProperty("--sb", `${b || 0}px`);
  }
  // The display font is bundled; wait briefly so the HUD measures with it (never blocks for long).
  const font = Promise.race([document.fonts?.load('20px "Lilita One"').catch(() => undefined), new Promise((r) => setTimeout(r, 800))]);
  setSound(s.settings.sound);
  setHaptics(s.settings.haptics);
  // [store] A Starter Pack paid but never finished (or approved later) is credited, then the screen redraws.
  // The Shop's own Starter Pack panel shows "Owned" and removes itself, so the Shop isn't redrawn under it.
  starter.onCredit(() => { if (!sheetEl && !document.querySelector('[data-offer="starter"]')) here?.(); });
  void starter.start();
  void gemShop.start(); // [gems] credit paid-but-unfinished packs, then listen for Ask to Buy approvals
  settleRewards(); // [gems] pay free gems for progress made before gems existed
  startPass(); settleQuests(); // [pass] quest + pass XP listeners, Premium's chest perk, yesterday's unclaimed quests
  migrateArmy(); // [progression] once: old saves move to the card collection (found units, new-scale levels)
  settleLegacyCoins(); // [progression]
  startOnline(() => { if (!game) here?.(); }); // [online] accounts, cloud save, analytics: a no-op without VITE_REMUSTER_API coins for campaign clears made before troop levels existed
  await Promise.all([initNative(), loadSprites(), font]);
  window.addEventListener("pointerdown", () => { unlockAudio(); resumeMusic(); }, { once: true });
  // Dev only: play any level from a script without a reload (tools/sprite-mem.mjs plays several back to back).
  if (import.meta.env.DEV) (window as any).__playLevel = (id: number) => { const l = LEVELS.find((x) => x.id === id); if (l) playLevel(l); return !!l; };
  // Deep links for checks: ?level=3, ?puzzle=2, ?lab, ?daily, ?gauntlet, ?watch, ?shop
  // [replay] #replay=<payload>: another game handed this one a battle to show (src/replay.ts)
  { const rp = (await import("./replay")).readReplay(); if (rp) return playReplay(rp); }
  // [film] ?film=<scene>: a scripted battle for the video recorder (src/film.ts, tools/film.mjs)
  if (q.has("film")) return playFilm(q.get("film") || "clash", Number(q.get("speed")) || 0);
  if (q.has("skin")) await import("./ui/skins").then((m) => m.debugSkin(q.get("skin")!, q.get("keepstate")));
  if (q.has("level")) { const l = LEVELS.find((x) => x.id === Number(q.get("level"))); if (l) return playLevel(l); }
  if (q.has("puzzle")) { const p = PUZZLES.find((x) => x.id === Number(q.get("puzzle"))); if (p) return playPuzzle(p); }
  if (q.has("campaign")) return campaign(Number(q.get("campaign")) || undefined);
  if (q.has("ending")) { campaign(ACTS.length); return void showEnding(app, () => campaign(ACTS.length)); } // review shot of the ending
  if (q.has("puzzles")) return puzzles();
  if (q.has("lab")) return skirmish();
  if (q.has("daily")) return daily();
  // [arena] ?arena opens the ladder, ?arena=<id> plays that arena (engine/core/arena.ts ids).
  if (q.has("arena")) return q.get("arena") ? void playArena({ arena: q.get("arena")!, seed: 7 }) : arena();
  if (q.has("barracks") || q.has("army")) return barracks(); // [progression]
  if (q.has("shop")) return shopScreen();
  // [home] ?tab=shop|army|battle|modes|pass opens a tab; ?settings opens the settings sheet over Battle.
  if (q.has("tab") && (TABS as readonly string[]).includes(q.get("tab")!)) return home(q.get("tab") as Tab);
  if (q.has("settings")) { home("battle"); return settingsSheet(); }
  // [td] hook: ?td opens Bastion's map select, ?td=meadow|fords starts a run.
  if (q.has("td")) return void import("./ui/td").then((m) => (q.get("td") ? m.playBastion(app, q.get("td")!, title) : m.bastionMenu(app, title)));
  if (q.has("gauntlet")) { run = newRun(42); return duel(); }
  if (q.has("showcase")) return showcase(Number(q.get("showcase")) || 1);
  if (q.has("chests")) { const k = q.get("chests") ?? ""; if (k !== "result") seedDemo(); if (k === "result" || k === "full") { gemDemo("reward"); return chestEarned(winChest(3)); } title(); return chestDemo(k); } // [chests] review shots: ?chests=title|result|full|info|open|shop
  // [pass] debug route: ?pass opens the War Pass; ?pass=free|premium|claim seeds a mid-season save for review shots.
  if (q.has("pass")) { const k = q.get("pass") ?? ""; if (k) { seedPassDemo(k); seedQuestDemo(); } return void import("./ui/pass").then((m) => { clear(); m.passScreen(app, { back: title }); }); }
  if (q.has("gemdemo")) return gemDemo(q.get("gemdemo") ?? ""); // [gems] review shots of the result-screen moments
  if (q.has("vfx")) return void import("./ui/vfxlab").then((m) => m.vfxLab(app, { page: Number(q.get("vfx")) || 1, at: q.has("at") ? Number(q.get("at")) : undefined }));
  // [skins] ?skins shows the skin picker and shop standalone; ?skin=frost&keepstate=burning dresses the player's keep for shots
  if (q.has("skins")) return void import("./ui/skins").then((m) => m.skinsDemo(app, q));
  if (q.has("watch")) return playSkirmish({ foe: { ...DEFAULT_AI, tactic: "blitz" }, you: { ...DEFAULT_AI, difficulty: 0.9, tactic: "artillery" }, watch: true, hp: [400, 400] });
  title();
}
void boot();
