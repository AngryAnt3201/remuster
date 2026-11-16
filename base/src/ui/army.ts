// The Army: the card collection. Found units in rarity frames with a card bar (cards held / cards the next level
// needs), their level and stats, and an Upgrade button that costs cards plus coins; unfound units as silhouettes.
// The commander level bar sits on top. Also the reward line on result screens. Rules live in src/progression.
import { skinPicker } from "./skins";
import "./barracks.css";
import "./army.css";
import { UNITS, UNIT_KINDS, type UnitKind } from "@engine/core/defs";
import { MAX_LEVEL, levelDmg, levelHp } from "@engine/core/levels";
import { onWalletChange, wallet } from "@engine/economy/wallet";
import { currencyBar } from "./currency";
import { buzz } from "../native";
import { unlockAudio, sfx } from "../audio/sfx";
import { RARITY, isFound, onCollectionChange, type Rarity } from "@engine/progression/collection";
import { DECK_MIN, DECK_SIZE, KEEP_HP_PER_LEVEL, MAX_COMMANDER, levelCap, type Reward } from "@engine/progression/economy";
import { commander, commanderBar, deck, readyCount, toggleDeck, troopState, upgradeTroop } from "@engine/progression/troops";
import { abilityOf, framedPortrait, ribbon } from "./game";
import { el, fmt } from "./dom";
import { ROLE_LABEL, icon, roleBadge } from "./kit";

export const RARITY_NAME: Record<Rarity, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

/** Counts a number element from a to b. */
function tick(node: HTMLElement, a: number, b: number, ms: number, digits = 0, prefix = "") {
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3;
    const v = a + (b - a) * e;
    node.textContent = prefix + (digits ? fmt(v) : Math.round(v).toLocaleString("en"));
    if (k < 1 && node.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** The two stats a level changes, at rank 1: [label, value at a level, digits]. */
function statRows(k: UnitKind): [string, (lv: number) => number, number][] {
  const d = UNITS[k], bodies = d.bodies ?? 1;
  const rows: [string, (lv: number) => number, number][] = [];
  if (d.hp > 1) rows.push(["Health", (lv) => Math.round(d.hp * bodies * levelHp(lv)), 0]); // a Mine's 1 hp never changes
  if (d.dmg) rows.push([bodies > 1 ? "Damage each" : "Damage", (lv) => d.dmg * levelDmg(lv), 1]);
  else if (k === "medic") rows.push(["Healing", (lv) => 26 * levelDmg(lv), 1]);
  else if (k === "hive") rows.push(["Mite health", (lv) => Math.round(22 * levelHp(lv)), 0]);
  else if (k === "grave") rows.push(["Thrall health", (lv) => Math.round(80 * levelHp(lv)), 0]);
  return rows;
}
const show = (v: number, digits: number) => (digits ? fmt(v) : v.toLocaleString("en"));
const n = (v: number) => v.toLocaleString("en");

/** The card bar: cards held over cards needed, green and full when the next level is ready. */
function cardBar(k: UnitKind): HTMLElement {
  const st = troopState(k);
  const top = st.level >= MAX_LEVEL;
  const pct = top ? 100 : Math.min(100, (100 * st.cards) / st.need);
  return el("div", { class: `ar-cards ${st.cards >= st.need && !top ? "full" : ""} ${top ? "top" : ""}` }, [
    el("i", { class: "ar-fill", style: `width:${pct}%` }),
    el("i", { class: "ar-card-ico" }),
    el("span", {}, [top ? "Max" : `${n(st.cards)}/${n(st.need)}`]),
    ...(st.why === null ? [el("i", { class: "ar-up-arrow" }, ["▲"])] : []),
  ]);
}

/** The commander level plate: level shield, XP bar, what the next level gives. */
export function commanderPlate(cls = ""): HTMLElement {
  const b = commanderBar();
  const pct = b.span ? Math.min(100, (100 * b.into) / b.span) : 100;
  return el("div", { class: `ar-cmd ${cls}` }, [
    el("div", { class: "ar-cmd-lv" }, [el("small", {}, ["LV"]), el("b", {}, [String(b.level)])]),
    el("div", { class: "ar-cmd-body" }, [
      el("div", { class: "ar-cmd-top" }, [el("b", {}, ["Commander"]), el("span", {}, [b.span ? `${n(b.into)}/${n(b.span)} XP` : "Max level"])]),
      el("div", { class: "ar-xp" }, [el("i", { style: `width:${pct}%` })]),
      el("small", {}, [`Troop cap Lv ${levelCap(b.level)} · keep +${KEEP_HP_PER_LEVEL * (b.level - 1)} health`]),
    ]),
  ]);
}

/** The commander level-up moment: a full-screen burst with what the new level gives. */
export function commanderLevelUp(level: number, root: HTMLElement = document.body) {
  sfx("win"); buzz("success");
  const o = el("div", { class: "ar-cmd-up" }, [
    el("i", { class: "pg-rays big" }),
    el("div", { class: "ar-cmd-up-lv" }, [el("small", {}, ["LV"]), el("b", {}, [String(level)])]),
    ribbon("Commander level up!", "gold"),
    el("div", { class: "ar-cmd-up-gains" }, [
      el("span", {}, [icon("crown"), `Troop cap Lv ${levelCap(level)}`]),
      el("span", {}, [icon("shield"), `Keep +${KEEP_HP_PER_LEVEL} health`]),
    ]),
    el("small", {}, ["Tap to continue"]),
  ]);
  o.addEventListener("click", () => o.remove());
  root.append(o);
  setTimeout(() => o.isConnected && o.classList.add("settled"), 900);
}

export interface ArmyOpts { app: HTMLElement; back: () => void; shop: () => void; }

export function armyScreen(o: ArmyOpts) {
  const head = el("div", { class: "screen-head" }, []);
  const backBtn = el("button", { class: "icon-btn back", "aria-label": "Back" }, [icon("back")]);
  backBtn.addEventListener("click", () => { unlockAudio(); sfx("tap"); o.back(); });
  head.append(backBtn, el("h1", {}, ["Army"]), currencyBar("barracks-cur", ["coins"]));

  let cmd = commanderPlate();
  const sortKinds = (ks: UnitKind[]) => ks.sort((a, b) => RARITY_ORDER[RARITY[a]] - RARITY_ORDER[RARITY[b]] || UNITS[a].name.localeCompare(UNITS[b].name));
  const found = sortKinds(UNIT_KINDS.filter(isFound));
  const unfound = sortKinds(UNIT_KINDS.filter((k) => !isFound(k)));
  const tiles = new Map<UnitKind, HTMLElement>();
  const grid = el("div", { class: "ar-grid" }, found.map((k) => { const t = tile(k); tiles.set(k, t); return t; }));
  const ghosts = el("div", { class: "ar-grid ghosts" }, unfound.map(ghost));
  let deckRow = deckStrip();
  const scr = el("div", { class: "screen barracks-screen ar-army" }, [
    head, cmd, deckRow,
    el("div", { class: "ar-sec" }, [el("b", {}, ["Found"]), el("span", {}, [`${found.length}/${UNIT_KINDS.length}`])]),
    grid,
    ...(unfound.length ? [el("div", { class: "ar-sec" }, [el("b", {}, ["Not found yet"]), el("span", {}, ["Win cards in the campaign and chests"])]), ghosts] : []),
    skinPicker({ onShop: o.shop }), // [skins] keep skins: owned ones to equip, locked ones with where they come from
  ]);
  o.app.append(scr);

  const refreshAll = () => { for (const [k, t] of tiles) if (!t.classList.contains("leveling")) t.replaceWith(retile(k)); };
  const retile = (k: UnitKind) => { const t = tile(k); tiles.set(k, t); return t; };
  const offW = onWalletChange(() => { if (!scr.isConnected) { offW(); return; } refreshAll(); if (open) paintDetail(open); });
  const offC = onCollectionChange(() => { if (!scr.isConnected) { offC(); return; } refreshAll(); if (open) paintDetail(open); });

  function tile(k: UnitKind): HTMLElement {
    const st = troopState(k);
    const { frame } = framedPortrait(k, 1, "ar-portrait");
    const t = el("button", { class: `ar-tile r-${st.rarity} ${st.why === null ? "ready" : ""}` }, [
      el("div", { class: "ar-face" }, [frame, el("span", { class: "ar-lv" }, [el("small", {}, ["Lv"]), el("b", {}, [String(st.level)])])]),
      el("b", { class: "ar-name" }, [UNITS[k].name]),
      cardBar(k),
    ]);
    t.addEventListener("click", () => { unlockAudio(); sfx("tap"); showDetail(k); });
    return t;
  }

  /** The deck: 8 slots of found units; the in-match shop offers only these (campaign, Gauntlet, Skirmish). */
  function deckStrip(): HTMLElement {
    const d = deck();
    const slots = Array.from({ length: DECK_SIZE }, (_, i) => {
      const k = d[i];
      if (!k) return el("div", { class: "ar-slot empty" }, ["+"]);
      const s = el("button", { class: `ar-slot r-${RARITY[k]}` }, [framedPortrait(k, 1, "ar-portrait tiny").frame, el("b", {}, [String(troopState(k).level)])]);
      s.addEventListener("click", () => { unlockAudio(); sfx("tap"); showDetail(k); });
      return s;
    });
    const note = !d.length ? "No deck: every unit you meet can be bought in a match"
      : d.length < DECK_MIN ? `Add ${DECK_MIN - d.length} more to use your deck` : "Your match shop offers only these";
    return el("div", { class: "ar-deck" }, [
      el("div", { class: "ar-sec" }, [el("b", {}, [`Deck ${d.length}/${DECK_SIZE}`]), el("span", {}, [note])]),
      el("div", { class: "ar-slots" }, slots),
    ]);
  }
  const redeck = () => { const n = deckStrip(); deckRow.replaceWith(n); deckRow = n; };

  function ghost(k: UnitKind): HTMLElement {
    const r = RARITY[k];
    const { frame } = framedPortrait(k, 1, "ar-portrait");
    return el("div", { class: `ar-tile ghost r-${r}` }, [
      el("div", { class: "ar-face" }, [frame, el("span", { class: "ar-q" }, ["?"])]),
      el("b", { class: "ar-name" }, ["???"]),
      el("small", { class: `ar-rar r-${r}` }, [RARITY_NAME[r]]),
    ]);
  }

  // ---- the detail sheet: big card, stats now -> next, Upgrade (cards + coins)
  let open: UnitKind | null = null;
  const detail = el("div", { class: "ar-detail" });
  const shade = el("div", { class: "ar-shade" }, [detail]);
  shade.addEventListener("click", (e) => { if (e.target === shade) closeDetail(); });
  function closeDetail() { open = null; shade.remove(); }
  function showDetail(k: UnitKind) { open = k; paintDetail(k); if (!shade.isConnected) scr.append(shade); }

  function paintDetail(k: UnitKind) {
    const st = troopState(k), d = UNITS[k];
    const { frame } = framedPortrait(k, Math.min(4, 1 + Math.floor((st.level - 1) / 3)), "ar-portrait big");
    const atTop = st.level >= MAX_LEVEL;
    const stats = el("div", { class: "pg-stats ar-stats" }, statRows(k).map(([label, f, digits]) => el("div", { class: `pg-stat ${atTop ? "top" : ""}` }, [
      el("span", {}, [label]), el("b", { class: "now" }, [show(f(st.level), digits)]), el("i", { class: "arrow" }, ["→"]), el("b", { class: "next" }, [atTop ? "" : show(f(st.level + 1), digits)]),
    ])));
    const ab = abilityOf(k);
    const close = el("button", { class: "icon-btn ar-close", "aria-label": "Close" }, ["✕"]);
    close.addEventListener("click", () => { sfx("tap"); closeDetail(); });
    detail.className = `ar-detail r-${st.rarity}`;
    detail.replaceChildren(
      close,
      el("div", { class: "ar-d-top" }, [
        el("div", { class: "ar-face big" }, [frame, el("span", { class: "ar-lv" }, [el("small", {}, ["Lv"]), el("b", {}, [String(st.level)])])]),
        el("div", { class: "ar-d-id" }, [
          el("small", { class: `ar-rar r-${st.rarity}` }, [RARITY_NAME[st.rarity]]),
          el("b", { class: "ar-d-name" }, [d.name]),
          el("span", { class: "role-line" }, [roleBadge(d.role), ROLE_LABEL[d.role]]),
          cardBar(k),
        ]),
      ]),
      stats,
      ...(ab ? [el("div", { class: "pg-ability ar-ability" }, [el("b", {}, [`Ascended: ${ab.name}`]), " ", ab.text])] : []),
      action(k),
      deckButton(k),
    );
  }

  function deckButton(k: UnitKind): HTMLElement {
    const inDeck = deck().includes(k), full = deck().length >= DECK_SIZE;
    const b = el("button", { class: `btn small ${inDeck ? "" : "ghost"} ar-deckbtn` }, [inDeck ? "In deck: remove" : full ? "Deck full" : "Add to deck"]);
    if (!inDeck && full) b.setAttribute("disabled", "");
    b.addEventListener("click", () => { unlockAudio(); sfx("tap"); toggleDeck(k); redeck(); paintDetail(k); });
    return b;
  }

  function action(k: UnitKind): HTMLElement {
    const st = troopState(k);
    const slot = el("div", { class: "ar-act" });
    const cost = el("span", { class: "ar-cost" }, [
      el("span", { class: `ar-cost-cards ${st.cards < st.need ? "short" : ""}` }, [el("i", { class: "ar-card-ico" }), `${n(Math.min(st.cards, st.need))}/${n(st.need)}`]),
      el("span", { class: `pg-cost ${wallet().coins < st.cost ? "short" : ""}` }, [el("i", { class: "pg-coin" }), n(st.cost)]),
    ]);
    if (st.why === "max") slot.append(el("span", { class: "pg-max" }, [icon("crown"), "Max level"]));
    else if (st.why === "cap") slot.append(el("span", { class: "pg-capped" }, [icon("lock"), `Troop cap Lv ${st.cap}: raise your commander level`]));
    else if (st.why === "cards") slot.append(cost, el("small", { class: "ar-why" }, [`${n(st.need - st.cards)} more cards: win them in the campaign and chests`]));
    else if (st.why === "coins") {
      const get = el("button", { class: "btn small pg-get" }, ["Get coins"]);
      get.addEventListener("click", () => { unlockAudio(); sfx("tap"); o.shop(); });
      slot.append(cost, el("small", { class: "ar-why" }, [`${n(st.cost - wallet().coins)} coins short`]), get);
    } else {
      const up = el("button", { class: "btn gold ar-upbtn" }, [el("span", {}, ["Upgrade"]), cost]);
      up.addEventListener("click", () => { unlockAudio(); levelUp(k); });
      slot.append(up);
    }
    return slot;
  }

  function levelUp(k: UnitKind) {
    const before = troopState(k);
    const res = upgradeTroop(k);
    if (!res) { sfx("deny"); buzz("error"); paintDetail(k); return; }
    sfx("upgrade"); buzz("success");
    setTimeout(() => sfx("win", 0.5), 220);
    // The moment: the card bar fills and empties into the level badge, the card flashes gold, rays spin behind the
    // portrait, the badge pops and stats count up with +n floaters. Then the XP flies to the commander bar.
    paintDetail(k);
    detail.classList.remove("leveling"); void detail.offsetWidth; detail.classList.add("leveling");
    const bar = detail.querySelector<HTMLElement>(".ar-cards");
    if (bar) {
      const fill = bar.querySelector<HTMLElement>(".ar-fill")!, end = fill.style.width;
      bar.classList.add("filling"); fill.style.width = "100%";
      setTimeout(() => { fill.style.transition = "none"; fill.style.width = "0%"; void fill.offsetWidth; fill.style.transition = ""; fill.style.width = end; bar.classList.remove("filling"); }, 520);
    }
    const face = detail.querySelector(".ar-face")!;
    face.prepend(el("i", { class: "pg-rays" }));
    statRows(k).forEach(([, f, digits], i) => {
      const row = detail.querySelectorAll<HTMLElement>(".pg-stat")[i];
      tick(row.querySelector(".now") as HTMLElement, f(before.level), f(res.level), 650, digits);
      const float = el("i", { class: "pg-float" }, [`+${show(f(res.level) - f(before.level), digits)}`]);
      row.append(float);
      setTimeout(() => float.remove(), 1200);
    });
    const toast = el("div", { class: "pg-toast" }, [ribbon(`Level ${res.level}!`, "gold"), el("small", {}, [`${UNITS[k].name} · +${res.xp} XP`])]);
    scr.append(toast);
    setTimeout(() => toast.remove(), 1500);
    setTimeout(() => detail.classList.remove("leveling"), 900);
    const fresh = commanderPlate("bump");
    cmd.replaceWith(fresh); cmd = fresh;
    if (res.commanderUp) setTimeout(() => commanderLevelUp(res.commanderUp!, scr), 1100);
  }
}

/** The title screen's Army label, with a badge counting troops that can level up now. */
export function armyLabel(): Node {
  const ready = readyCount();
  return el("span", { class: "pg-menu" }, ["Army", ...(ready ? [el("i", { class: "pg-badge" }, [String(ready)])] : [])]);
}

/** The title screen's commander chip: level and XP bar. */
export function commanderChip(): HTMLElement {
  const b = commanderBar();
  const pct = b.span ? Math.min(100, (100 * b.into) / b.span) : 100;
  return el("div", { class: "ar-chip" }, [
    el("span", { class: "ar-chip-lv" }, [String(b.level)]),
    el("div", { class: "ar-chip-body" }, [el("small", {}, [b.level >= MAX_COMMANDER ? "Commander · max" : "Commander"]), el("div", { class: "ar-xp" }, [el("i", { style: `width:${pct}%` })])]),
  ]);
}

/** The under-levelled hint for a campaign defeat: shown when the army trails the level's recommended level. */
export function underLevelledHint(o: { avg: number; recommended: number; openArmy: () => void; into?: HTMLElement }) {
  if (o.avg >= o.recommended - 0.5) return;
  const sheet = o.into ?? document.querySelector<HTMLElement>(".overlay .sheet > .results");
  if (!sheet) return;
  const go = el("button", { class: "btn gold small ar-hint-go" }, ["Army"]);
  go.addEventListener("click", () => { unlockAudio(); sfx("tap"); document.querySelector(".overlay")?.remove(); o.openArmy(); });
  const box = el("div", { class: "ar-hint" }, [
    el("div", { class: "ar-hint-txt" }, [
      el("b", {}, ["Your army is under-levelled"]),
      el("small", {}, [`Your troops average Lv ${fmt(o.avg)}; this level recommends Lv ${o.recommended}. Upgrade them in the Army.`]),
    ]),
    go,
  ]);
  const before = sheet.querySelector(":scope > .btn");
  sheet.insertBefore(box, before);
}

// ---------------------------------------------------------------- result screens
/**
 * Adds what a result paid (coins, cards, commander XP) to the result sheet on screen. Call right after the result
 * sheet is shown. `openArmy` opens the Army from the line. `into` is the result card to add it to; by default the
 * result sheet that's open (campaign, Gauntlet, ...).
 */
export function attachReward(r: Reward, openArmy?: () => void, into?: HTMLElement) {
  if (r.coins <= 0 && !r.cards?.length && !r.xp) return;
  const sheet = into ?? document.querySelector<HTMLElement>(".overlay .sheet > .results, .overlay .sheet > .boons");
  if (!sheet) return;
  const amount = el("b", {}, ["+0"]);
  const ready = readyCount();
  const lvl = commander();
  const levelLine = r.capTo
    ? el("span", { class: "pg-r-cap up" }, [icon("crown"), `Commander level ${r.capTo}! Troop cap Lv ${levelCap(r.capTo)}`])
    : el("span", { class: "pg-r-cap" }, [`Commander Lv ${lvl}`, r.xp ? ` · +${r.xp} XP` : "", ready ? ` · ${ready} ready to upgrade` : ""]);
  const cards = r.cards?.length
    ? el("div", { class: "ar-r-cards" }, r.cards.map(([k, c]) => el("span", { class: `ar-r-card r-${RARITY[k]}` }, [framedPortrait(k, 1, "ar-portrait tiny").frame, el("b", {}, [`×${c}`])])))
    : null;
  const row = el("div", { class: "pg-reward" }, [
    ...(r.coins > 0 ? [el("div", { class: "pg-r-top" }, [el("i", { class: "pg-coin big" }), amount, el("small", {}, ["coins"])]),
      el("div", { class: "pg-r-parts" }, r.parts.map(([t, v]) => el("span", {}, [t, el("b", {}, [` +${v}`])])))] : []),
    ...(cards ? [cards] : []),
    levelLine,
  ]);
  if (openArmy && (ready || r.capTo)) {
    const go = el("button", { class: "btn small gold pg-r-go" }, ["Army"]);
    go.addEventListener("click", () => { unlockAudio(); sfx("tap"); document.querySelector(".overlay")?.remove(); openArmy(); });
    row.append(go);
  }
  const before = sheet.querySelector(":scope > .btn, :scope > .boon-list, :scope > .td-result-btns");
  sheet.insertBefore(row, before);
  if (r.coins > 0) setTimeout(() => { tick(amount, 0, r.coins, 700, 0, "+"); setTimeout(() => sfx("buy"), 700); }, 450);
  if (r.capTo && openArmy) setTimeout(() => commanderLevelUp(r.capTo!), 1400);
}
