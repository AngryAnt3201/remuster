// Chests on screen: the title's chest bar, the chest info sheet (contents and odds), the opening moment, the
// "Chest earned!" line on result screens, and the Shop's chest offers and daily deals (chestShop, mounted by the lead).
// Animation is transforms and opacity only. Rules live in src/progression/chests.ts.
import "./chests.css";
import { sfx, unlockAudio } from "../audio/sfx";
import { UNITS, type UnitKind } from "@engine/core/defs";
import { RARITIES, RARITY, rarityOf, type Rarity } from "@engine/progression/collection";
import { load } from "@engine/save";
import {
  CHESTS, CROWNS_FOR_CHEST, FREE_BANK, SHOP_CHESTS, actOf, actScale, buyDeal, buyShopChest, chests, claimCrown, claimFree,
  crownReady, dealBought, effectiveOdds, findable, freeBanked, freeNextIn, gameNow, grantChest, localDay, msLeft,
  onChestsChange, openReady, openWithGems, skipCost, startUnlock, stateOf, todaysDeals, unlocking,
  initChests, rollContents, type Chest, type ChestType, type Granted, type WinResult,
  unlockMsOf,
} from "@engine/progression/chests";
import { foundKinds } from "@engine/progression/collection";
import { canAfford } from "@engine/economy/wallet";
import { coinIcon, currencyBar, flyInto, gemIcon } from "./currency";
import { el } from "./dom";
import { icon } from "./kit";
import { paintPortrait } from "./game";

// ---------------------------------------------------------------- chest art
const PAL: Record<ChestType, [string, string, string]> = {
  // body, band, glow
  wood: ["#b9773f", "#7a4a26", "#ffd9a0"], iron: ["#8d9bb0", "#4c5566", "#d8e6ff"], gilded: ["#f2b632", "#a8701a", "#fff1a8"],
  royal: ["#7b4ad8", "#f2b632", "#d9c4ff"], legend: ["#2fb6a6", "#f6d36b", "#b9fff4"], free: ["#5aa85a", "#2f6b33", "#d6ffc4"],
  crown: ["#d8455a", "#f2b632", "#ffd0d6"],
};
/** The chest drawn for this game: an ink-outlined box and lid, coloured by type. The lid is its own group so it can fly. */
export function chestArt(type: ChestType, cls = "") {
  const [body, band, glow] = PAL[type];
  const s = el("span", { class: `ch-art ch-${type} ${cls}`, style: `--ch-glow:${glow}` });
  s.innerHTML = `<svg viewBox="0 0 64 56" aria-hidden="true">
<ellipse cx="32" cy="52" rx="24" ry="3.5" fill="rgba(0,0,0,.22)"/>
<g class="ch-body"><rect x="7" y="24" width="50" height="27" rx="4" fill="#2b1d14"/><rect x="9.5" y="26" width="45" height="22.5" rx="2.6" fill="${body}"/>
<rect x="9.5" y="26" width="45" height="5" fill="rgba(0,0,0,.18)"/><rect x="15" y="25" width="5" height="24" fill="${band}" stroke="#2b1d14" stroke-width="1.4"/>
<rect x="44" y="25" width="5" height="24" fill="${band}" stroke="#2b1d14" stroke-width="1.4"/></g>
<g class="ch-lid"><path d="M7 25V18c0-8 8-13 25-13s25 5 25 13v7z" fill="#2b1d14"/><path d="M9.5 23v-5c0-6 7-10.5 22.5-10.5S54.5 12 54.5 18v5z" fill="${body}"/>
<path d="M12 13.5c4-3.5 10-5 20-5s16 1.5 20 5" stroke="rgba(255,255,255,.45)" stroke-width="2" fill="none" stroke-linecap="round"/>
<rect x="15" y="7.5" width="5" height="17" fill="${band}" stroke="#2b1d14" stroke-width="1.4"/><rect x="44" y="7.5" width="5" height="17" fill="${band}" stroke="#2b1d14" stroke-width="1.4"/>
<rect x="27" y="19" width="10" height="11" rx="2" fill="${band}" stroke="#2b1d14" stroke-width="1.8"/><circle cx="32" cy="24" r="1.8" fill="#2b1d14"/></g></svg>`;
  return s;
}

// ---------------------------------------------------------------- shared bits
const tap = (b: HTMLElement, fn: () => void) => b.addEventListener("click", (e) => { e.stopPropagation(); unlockAudio(); sfx("tap"); fn(); });
function button(label: (Node | string)[] | string, cls: string, fn: () => void) {
  const b = el("button", { class: `btn ${cls}` }, typeof label === "string" ? [label] : label);
  tap(b, fn);
  return b;
}
export function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  if (h) return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
  if (m) return x ? `${m}m ${String(x).padStart(2, "0")}s` : `${m} min`;
  return `${x}s`;
}
const gemPrice = (n: number) => el("span", { class: "ch-gems" }, [gemIcon(), String(n)]);
const portrait = (kind: UnitKind, size: number) => {
  const c = el("canvas", { class: "ch-portrait", style: `width:${size}px;height:${size}px` }) as HTMLCanvasElement;
  requestAnimationFrame(() => paintPortrait(c, kind));
  return c;
};
const SHORT: Record<ChestType, string> = { wood: "Crate", iron: "Coffer", gilded: "Gilded", royal: "Hoard", legend: "Reliquary", free: "Satchel", crown: "Casket" };
const RARITY_LABEL: Record<Rarity, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };

function overlay(cls: string, kids: Node[], dismiss = true) {
  const o = el("div", { class: `ch-overlay ${cls}` }, kids);
  if (dismiss) o.addEventListener("click", (e) => { if (e.target === o) o.remove(); });
  (document.getElementById("app") ?? document.body).append(o);
  return o;
}

// ---------------------------------------------------------------- info sheet (contents and odds)
/** Odds per card for this player, and the chance of at least one of each rarity in the whole chest. */
export function oddsTable(type: ChestType) {
  const pool = findable(load().campaign, foundKinds());
  const odds = effectiveOdds(type, pool);
  const n = Math.round(CHESTS[type].cards * actScale(actOf({ campaign: load().campaign, found: [] })));
  const atLeast = (p: number) => (p <= 0 ? 0 : 100 * (1 - (1 - p / 100) ** n));
  const pct = (x: number) => (x === 0 ? "0%" : x < 0.1 ? "<0.1%" : x >= 99.95 ? "100%" : `${x < 10 ? x.toFixed(1) : Math.round(x)}%`);
  return el("table", { class: "ch-odds" }, [
    el("thead", {}, [el("tr", {}, [el("th", {}, ["Rarity"]), el("th", {}, ["Each card"]), el("th", {}, ["At least one"])])]),
    el("tbody", {}, RARITIES.map((r) => el("tr", { class: `r-${r}` }, [el("td", {}, [el("i", { class: `ch-dot r-${r}` }), RARITY_LABEL[r]]), el("td", {}, [pct(odds[r])]), el("td", {}, [pct(atLeast(odds[r]))])]))),
  ]);
}
function contentsLine(type: ChestType) {
  const k = actScale(actOf({ campaign: load().campaign, found: [] })), d = CHESTS[type];
  const coins = Math.round(d.coins * k);
  return el("div", { class: "ch-contents" }, [
    el("span", {}, [coinIcon(), el("b", {}, [`${Math.round(coins * 0.9 / 5) * 5}-${Math.round(coins * 1.1 / 5) * 5}`])]),
    el("span", {}, [el("i", { class: "ch-cards-ico" }), el("b", {}, [`${Math.round(d.cards * k)}`]), " cards"]),
    ...(d.gems ? [el("span", {}, [gemIcon(), el("b", {}, [String(d.gems)])])] : []),
  ]);
}
const ODDS_NOTE = "Cards only come from units you've met in the campaign. Units you own are 4x as likely as new ones. If no unit of a rarity is reachable yet, its share goes to the next rarity down.";

/** The chest info sheet: what's inside, the odds, and (for a slot) Start unlock / Open now. */
export function chestInfo(type: ChestType, slot?: number, after?: () => void) {
  const d = CHESTS[type];
  const kids: Node[] = [
    el("div", { class: "ch-info-head" }, [chestArt(type, "big"), el("div", {}, [el("h2", {}, [d.name]), el("small", {}, [d.unlockMs ? `Unlocks in ${clock(unlockMsOf(type))}` : "Opens at once"])])]),
    contentsLine(type),
    el("div", { class: "ch-sub" }, ["Drop odds"]),
    oddsTable(type),
    el("p", { class: "ch-note" }, [ODDS_NOTE]),
  ];
  let o: HTMLElement;
  if (slot !== undefined) {
    const ch = chests().slots[slot];
    if (ch) {
      const now = gameNow(), st = stateOf(ch, now), busy = unlocking(chests(), now);
      const cost = skipCost(chests(), slot, now);
      const row = el("div", { class: "ch-actions" });
      if (st === "locked" && !busy) row.append(button(`Start unlock · ${clock(unlockMsOf(type))}`, "primary", () => { startUnlock(slot); o.remove(); after?.(); }));
      if (st === "locked" && busy) row.append(el("small", { class: "ch-note" }, ["Another chest is unlocking. One at a time."]));
      if (st !== "ready") row.append(button(["Open now ", gemPrice(cost)], `gold ${canAfford("gems", cost) ? "" : "short"}`, () => {
        const got = openWithGems(slot);
        if (!got) { row.classList.remove("nope"); void row.offsetWidth; row.classList.add("nope"); return; }
        o.remove(); after?.(); openChest(got);
      }));
      else row.append(button("Open", "primary", () => { const got = openReady(slot); o.remove(); after?.(); if (got) openChest(got); }));
      kids.push(row);
    }
  }
  o = overlay("sheetish", [el("div", { class: "ch-sheet" }, kids)]);
  return o;
}

// ---------------------------------------------------------------- chest bar (title)
/** The title's chest bar: four slots, then the free chest and the crown chest. Ticks every second while shown. */
export function chestBar(): HTMLElement {
  const bar = el("div", { class: "ch-bar" });
  initChests();
  // A full redraw only when something changes state (a chest lands, starts, gets ready...); otherwise each second just
  // updates the timer and price text, so the ready hop and other loops never restart.
  let sig = "", live: (() => void)[] = [];
  const view = () => {
    const c = chests(), now = gameNow(), busy = unlocking(c, now);
    const freeN = freeBanked({ ...c } as never, now);
    const k = c.crown.day === localDay() ? c.crown : { crowns: 0, claimed: false };
    const cReady = crownReady({ ...c, crown: { ...c.crown } } as never, localDay());
    return { c, now, busy, freeN, k, cReady, sig: JSON.stringify([c.slots.map((ch) => ch && [ch.id, stateOf(ch, now)]), !!busy, freeN, k, cReady]) };
  };
  const draw = () => {
    const v = view();
    if (v.sig === sig) { for (const fn of live) fn(); return; }
    sig = v.sig; live = [];
    const { c, now, busy, freeN, k, cReady } = v;
    const slots = c.slots.map((ch, i) => {
      if (!ch) return el("div", { class: "ch-slot empty" }, [el("span", { class: "ch-slot-empty" }, ["Win a battle"])]);
      const st = stateOf(ch, now);
      const t = el("b", { class: `ch-slot-t ${st === "ready" ? "ready" : ""}` });
      const gem = el("span", { class: "ch-slot-gem" });
      const update = () => {
        const n = gameNow();
        t.textContent = st === "ready" ? "Open!" : st === "unlocking" ? clock(msLeft(ch, n)) : busy ? clock(unlockMsOf(ch.type)) : "Tap to unlock";
        gem.replaceChildren(...(st === "ready" ? [] : [gemPrice(skipCost(chests(), i, n))]));
      };
      update();
      if (st === "unlocking") live.push(update);
      const s = el("button", { class: `ch-slot ${st} t-${ch.type}` }, [chestArt(ch.type), el("span", { class: "ch-slot-name" }, [SHORT[ch.type]]), t, gem]);
      tap(s, () => {
        if (st === "ready") { const got = openReady(i); if (got) openChest(got); return; }
        if (st === "locked" && !busy) { startUnlock(i); sfx("buy"); return; }
        chestInfo(ch.type, i);
      });
      s.addEventListener("contextmenu", (e) => { e.preventDefault(); chestInfo(ch.type, i); });
      return s;
    });
    const freeT = el("small");
    const freeUpdate = () => { freeT.textContent = freeN ? `${freeN}/${FREE_BANK} ready` : `next in ${clock(freeNextIn({ ...chests() } as never, gameNow()))}`; };
    freeUpdate();
    if (freeN < FREE_BANK) live.push(freeUpdate);
    const free = el("button", { class: `ch-mini free ${freeN ? "ready" : ""}` }, [chestArt("free", "mini"), el("span", {}, [el("b", {}, ["Free chest"]), freeT])]);
    tap(free, () => { if (!freeN) return void chestInfo("free"); const got = claimFree(); if (got) openChest(got); });
    const crown = el("button", { class: `ch-mini crown ${cReady ? "ready" : ""}` }, [
      chestArt("crown", "mini"), el("span", {}, [el("b", {}, ["Crown chest"]), el("small", {}, [k.claimed ? "opened · back tomorrow" : cReady ? "ready!" : `${k.crowns}/${CROWNS_FOR_CHEST} stars`])]),
      el("i", { class: "ch-crown-fill", style: `transform:scaleX(${k.claimed ? 1 : k.crowns / CROWNS_FOR_CHEST})` }),
    ]);
    tap(crown, () => { if (!cReady) return void chestInfo("crown"); const got = claimCrown(); if (got) openChest(got); });
    bar.replaceChildren(el("div", { class: "ch-slots" }, slots), el("div", { class: "ch-minis" }, [free, crown]));
  };
  draw();
  const off = onChestsChange(draw);
  const t = setInterval(() => { if (!bar.isConnected) { clearInterval(t); off(); return; } draw(); }, 1000);
  return bar;
}

// ---------------------------------------------------------------- result screen line
/** "Chest earned!" (or a friendly "slots full") on a result sheet, above its buttons. */
export function chestEarned(r: WinResult, into?: HTMLElement | null) {
  const host = into ?? document.querySelector<HTMLElement>(".overlay .sheet > .results, .overlay .sheet > .boons");
  if (!host) return;
  const line = r.chest
    ? el("div", { class: "ch-earned" }, [chestArt(r.chest.type, "ch-pop-in"), el("span", { class: "ch-earned-t" }, [el("b", {}, ["Chest earned!"]), el("small", {}, [`${CHESTS[r.chest.type].name} · ${clock(unlockMsOf(r.chest.type))}`])])])
    : el("div", { class: "ch-earned full" }, [chestArt("wood", "dim"), el("span", { class: "ch-earned-t" }, [el("b", {}, ["Slots full"]), el("small", {}, ["Open a chest to make room for the next one."])])]);
  if (r.crowns > 0) line.append(el("span", { class: `ch-crowns ${r.crownReady ? "ready" : ""}` }, [icon("crown"), r.crownReady ? "Ready!" : `${r.crowns}/${CROWNS_FOR_CHEST}`]));
  const before = host.querySelector(":scope > .btn, :scope > .boon-list, :scope > .td-result-btns");
  host.insertBefore(line, before);
  if (r.chest) setTimeout(() => sfx("buy"), 900);
}

// ---------------------------------------------------------------- the opening moment
/**
 * Opens a chest: it drops and bounces, bursts on tap, then cards fly out one at a time (count, rarity glow, a big
 * flash for epic and legendary, NEW for a unit found), coins and gems fly into the counters, and a summary ends it.
 * Tap advances; tap-and-hold skips to the summary. The chest is paid out before the first frame, so closing the
 * app mid-animation never loses anything.
 */
export function openChest(ch: Chest, onDone?: () => void): HTMLElement {
  const cur = currencyBar("ch-cur");
  for (const p of cur.querySelectorAll<HTMLElement>(".cur-pill")) p.dataset.flying = "1";
  const got = grantChest(ch);
  // Biggest moments last: commons, rares, epics, legendaries.
  const cards = [...got.cards].sort((a, b) => RARITIES.indexOf(RARITY[a.kind]) - RARITIES.indexOf(RARITY[b.kind]));
  const art = chestArt(ch.type, "hero");
  const left = el("b", { class: "ch-left" }, [String(cards.length)]);
  const stage = el("div", { class: "ch-stage" });
  const flash = el("i", { class: "ch-flash" }), rays = el("i", { class: "ch-rays" });
  const hint = el("div", { class: "ch-hint" }, ["Tap to open"]);
  const title = el("div", { class: "ch-open-title" }, [CHESTS[ch.type].name]);
  const o = overlay("opening", [rays, cur, title, stage, el("div", { class: "ch-hero-wrap" }, [art, left]), flash, hint], false);
  o.style.setProperty("--ch-glow", PAL[ch.type][2]);
  let step = -1, busy = true, done = false;
  setTimeout(() => { busy = false; sfx("tap"); }, 720); // the drop lands
  const pulse = (cls: string) => { flash.className = "ch-flash"; void flash.offsetWidth; flash.className = `ch-flash ${cls}`; };
  const finishCounters = () => {
    for (const p of cur.querySelectorAll<HTMLElement>(".cur-pill")) {
      delete p.dataset.flying;
      const c = p.dataset.cur as "coins" | "gems", b = p.querySelector("b");
      if (b) b.textContent = (c === "coins" ? load().wallet?.coins ?? 0 : load().wallet?.gems ?? 0).toLocaleString("en");
    }
  };
  const showCard = (i: number) => {
    const s = cards[i], r = rarityOf(s.kind);
    stage.querySelector(".ch-card.live")?.classList.replace("live", "gone");
    const card = el("div", { class: `ch-card live r-${r}` }, [
      el("i", { class: "ch-card-glow" }),
      el("div", { class: "ch-card-face" }, [portrait(s.kind, 96), s.isNew ? el("span", { class: "ch-new" }, ["NEW"]) : el("span")]),
      el("div", { class: "ch-card-name" }, [UNITS[s.kind].name]),
      el("div", { class: "ch-card-n" }, [`x${s.n}`]),
      el("div", { class: `ch-card-r r-${r}` }, [RARITY_LABEL[r]]),
    ]);
    stage.append(card);
    setTimeout(() => stage.querySelectorAll(".ch-card.gone").forEach((g) => g.remove()), 500);
    left.textContent = String(cards.length - i - 1);
    art.classList.remove("spit"); void art.offsetWidth; art.classList.add("spit");
    if (r === "epic" || r === "legendary") { pulse(r); sfx("upgrade"); } else sfx("buy");
  };
  const showMoney = () => {
    stage.querySelector(".ch-card.live")?.classList.replace("live", "gone");
    left.textContent = "0";
    const coinsEl = el("div", { class: "ch-money" }, [coinIcon("big"), el("b", {}, [`+${got.coins.toLocaleString("en")}`])]);
    const gemsEl = got.gems ? el("div", { class: "ch-money" }, [gemIcon("big"), el("b", {}, [`+${got.gems}`])]) : null;
    const box = el("div", { class: "ch-money-row" }, [coinsEl, ...(gemsEl ? [gemsEl] : [])]);
    stage.append(box);
    const pill = (c: string) => cur.querySelector<HTMLElement>(`.cur-pill[data-cur="${c}"]`)!;
    busy = true;
    setTimeout(() => {
      const flights = [got.coins > 0 ? flyInto(coinsEl, pill("coins"), "coins", got.coins) : Promise.resolve()];
      if (gemsEl) flights.push(flyInto(gemsEl, pill("gems"), "gems", got.gems));
      void Promise.all(flights).then(() => { busy = false; box.classList.add("gone"); setTimeout(summary, 160); });
    }, 380);
  };
  const summary = () => {
    if (done) return;
    done = true; busy = true;
    finishCounters();
    hint.textContent = "";
    o.classList.add("summary");
    stage.replaceChildren(el("div", { class: "ch-summary" }, [
      el("div", { class: "ch-sum-money" }, [el("span", {}, [coinIcon(), `+${got.coins.toLocaleString("en")}`]), ...(got.gems ? [el("span", {}, [gemIcon(), `+${got.gems}`])] : [])]),
      el("div", { class: "ch-sum-grid" }, cards.map((s, i) => el("div", { class: `ch-sum-card r-${rarityOf(s.kind)}`, style: `animation-delay:${i * 0.05}s` }, [
        portrait(s.kind, 52), el("b", {}, [`x${s.n}`]), ...(s.isNew ? [el("span", { class: "ch-new small" }, ["NEW"])] : []),
      ]))),
      button("Collect", "primary big", () => { o.remove(); onDone?.(); }),
    ]));
  };
  const advance = () => {
    if (busy || done) return;
    if (step === -1) {
      o.classList.add("burst"); pulse("open"); sfx("upgrade");
      busy = true;
      setTimeout(() => { busy = false; step = 0; if (cards.length) showCard(0); else showMoney(); hint.textContent = "Tap for more · hold to skip"; }, 420);
      return;
    }
    step++;
    if (step < cards.length) showCard(step);
    else if (step === cards.length) showMoney();
  };
  // Tap to advance, hold to skip.
  let hold: ReturnType<typeof setTimeout> | null = null, held = false;
  o.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button")) return;
    held = false;
    hold = setTimeout(() => { held = true; o.classList.add("burst"); summary(); }, 480);
  });
  const release = () => { if (hold) clearTimeout(hold); hold = null; };
  o.addEventListener("pointerup", (e) => { release(); if (!held && !(e.target as HTMLElement).closest("button")) advance(); });
  o.addEventListener("pointercancel", release);
  return o;
}
export type { Granted };

// ---------------------------------------------------------------- Shop: chests for gems, daily deals for coins
/** The Shop's chest offers and daily deals. The lead mounts it into <div id="shop-chests">. */
export function chestShop(): HTMLElement {
  const root = el("section", { class: "ch-shop" });
  const draw = () => {
    const offers = SHOP_CHESTS.map((o) => {
      const card = el("div", { class: `ch-offer t-${o.type}` }, [
        chestArt(o.type, "offer"),
        el("b", { class: "ch-offer-name" }, [CHESTS[o.type].name]),
        contentsLine(o.type),
        button(["Odds"], "ghost small ch-odds-btn", () => chestInfo(o.type)),
        button([gemPrice(o.gems)], `gold ${canAfford("gems", o.gems) ? "" : "short"}`, () => {
          const got = buyShopChest(o.type);
          if (!got) { card.classList.remove("nope"); void card.offsetWidth; card.classList.add("nope"); return; }
          openChest(got, draw);
        }),
      ]);
      return card;
    });
    const deals = todaysDeals().map((d, i) => {
      const bought = dealBought(i);
      const card = el("div", { class: `ch-deal r-${d.rarity} ${bought ? "bought" : ""}` }, [
        el("div", { class: "ch-deal-face" }, [portrait(d.kind, 54), el("span", { class: "ch-deal-n" }, [`x${d.n}`])]),
        el("b", {}, [UNITS[d.kind].name]),
        el("small", { class: `r-${d.rarity}` }, [RARITY_LABEL[d.rarity]]),
        bought ? el("span", { class: "ch-deal-done" }, ["Bought"]) : button([coinIcon(), d.price.toLocaleString("en")], `small ${canAfford("coins", d.price) ? "gold" : "short"}`, () => {
          const r = buyDeal(i);
          if (!r) { card.classList.remove("nope"); void card.offsetWidth; card.classList.add("nope"); return; }
          sfx("upgrade"); draw();
        }),
      ]);
      return card;
    });
    const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    root.replaceChildren(
      el("h3", { class: "ch-shop-h" }, ["Chests"]),
      el("div", { class: "ch-offers" }, offers),
      el("p", { class: "ch-note" }, ["Chests open at once. Tap Odds to see what each can hold."]),
      el("h3", { class: "ch-shop-h" }, ["Daily deals", el("small", {}, [`new in ${clock(midnight.getTime() - Date.now())}`])]),
      el("div", { class: "ch-deals" }, deals.length ? deals : [el("p", { class: "ch-note" }, ["Meet units in the campaign to see deals."])]),
    );
  };
  draw();
  return root;
}

// ---------------------------------------------------------------- review shots
/** ?chests=info|open|shop over the title (main.ts seeds demo slots first). */
export function chestDemo(kind: string) {
  if (kind === "info") return void chestInfo("legend", chests().slots.findIndex((c) => c?.type === "legend"));
  if (kind === "open") return void openChest({ id: 0, type: "royal", act: 3, seed: 7, contents: rollContents("royal", 7, 3, findable({ 1: 3, 2: 3, 3: 3, 6: 3, 12: 3, 14: 3, 18: 3, 20: 3, 22: 3 }), ["blades", "ranger", "mine"]) });
  if (kind === "shop") {
    const host = el("div", { class: "ch-overlay sheetish" }, [el("div", { class: "ch-sheet" }, [el("div", { id: "shop-chests" }, [chestShop()])])]);
    (document.getElementById("app") ?? document.body).append(host);
  }
}
