// The Shop screen: the one-time Starter Pack at the top while it's unbought, then the chests mount
// (<div id="shop-chests">, filled by the chests work), then gem packs (App Store consumables), then coin bundles
// bought with gems. Nothing sold here unlocks content: every level and mode is free, purchases speed things up. Plus the two small gem moments elsewhere: the free-gem strip on result screens and the
// Gauntlet Rally. Prices are always StoreKit's displayPrice; gem amounts come from src/economy/gems.ts.
import { skinShop } from "./skins";
import { chestShop } from "./chests";
import { sfx, unlockAudio } from "../audio/sfx";
import {
  COIN_BUNDLES, GEM_NAME, GEM_PACKS, RALLY_GEMS, applyRally, bestValue, canRally, coinBonus, packBonus, type RallyRun, type Reward,
} from "@engine/economy/gems";
import { canAfford, earn, spend } from "@engine/economy/wallet";
import { buzz } from "../native";
import type { GemShop } from "@engine/store/gems";
import type { StarterShop } from "@engine/store/starter";
import type { Product } from "@engine/store/types";
import { currencyBar, flyInto, gemIcon, coinIcon, rewardStrip } from "./currency";
import { el } from "./dom";
import { ribbon } from "./game";
import { starterOffer } from "./shop";
// [pass] special offers: limited-time bundles on the generic price tiers (src/store/offers.ts, src/store/pass.ts)
import "./pass.css";
import { UNITS } from "@engine/core/defs";
import { CHESTS } from "@engine/progression/chests";
import { takeChest, waitingChests } from "@engine/progression/pass";
import { offerPayout, offerValueX, type Offer } from "@engine/store/offers";
import { currentOffers, isOfferBought, offerPool, passShops } from "@engine/store/pass";
import { chestArt, chestInfo, clock, openChest } from "./chests";
import { paintPortrait } from "./game";

const fmt = (n: number) => n.toLocaleString("en");
function button(label: string | Node, cls: string, fn: () => void) {
  const b = el("button", { class: `btn ${cls}` }, [label]) as HTMLButtonElement;
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); fn(); });
  return b;
}

/** Bigger packs show a bigger pile. */
const pile = (i: number) => el("span", { class: `gem-pile p${i}` }, Array.from({ length: Math.min(5, i + 1) }, (_, k) => gemIcon(`g${k}`)));

/** The coin and gem counters for the Shop header (the fly-ins land on these). */
export const shopCounters = () => currencyBar("shop-cur");
const counter = (c: "gems" | "coins") => document.querySelector<HTMLElement>(`.shop-cur .cur-${c}`) ?? document.createElement("span");

/** Everything under the Shop header. */
export function shopView(starter: StarterShop, gems: GemShop) {
  const status = el("p", { class: "gem-status", role: "status", "aria-live": "polite" });
  const say = (text: string, tone: "" | "warn" | "good" = "") => { status.textContent = text; status.className = `gem-status ${tone}`; };
  let busy = false;

  // ---- gem packs
  const grid = el("div", { class: "gem-grid" });
  const cards = new Map<string, { card: HTMLElement; buy: HTMLButtonElement; bonus: HTMLElement }>();
  GEM_PACKS.forEach((p, i) => {
    const buy = button(el("span", {}, ["..."]), "gold gem-buy", () => void doBuy(p.id));
    buy.disabled = true;
    const bonus = el("span", { class: "gem-bonus" });
    const card = el("div", { class: "gem-card", "data-pack": p.id }, [
      pile(i),
      el("b", { class: "gem-amount" }, [fmt(p.gems)]),
      el("span", { class: "gem-name" }, [p.name]),
      bonus,
      buy,
    ]);
    cards.set(p.id, { card, buy, bonus });
    grid.append(card);
  });

  function show(ps: Product[]) {
    const prices = Object.fromEntries(ps.map((p) => [p.id, p.price]));
    const bonus = packBonus(prices), best = bestValue(prices);
    for (const [id, c] of cards) {
      const p = ps.find((x) => x.id === id);
      c.card.classList.toggle("best", id === best && !!p);
      c.card.querySelector(".gem-flag")?.remove();
      if (id === best && p) c.card.prepend(el("span", { class: "gem-flag" }, ["Best value"]));
      c.bonus.textContent = bonus[id] ? `+${bonus[id]}% more` : "";
      c.buy.disabled = !p || busy;
      c.buy.dataset.ready = p ? "1" : "";
      c.buy.replaceChildren(el("span", {}, [p ? p.displayPrice : "Unavailable"]));
    }
  }
  function load() {
    for (const c of cards.values()) { c.buy.disabled = true; c.buy.replaceChildren(el("span", {}, ["..."])); }
    gems.packs().then((ps) => { if (!busy) { show(ps); if (!ps.length) say(`${GEM_NAME} aren't on sale right now.`, "warn"); } }, () => {
      for (const c of cards.values()) { c.buy.disabled = false; c.buy.dataset.ready = ""; c.buy.replaceChildren(el("span", {}, ["Retry"])); }
      say("Can't reach the App Store right now.", "warn");
    });
  }
  async function doBuy(id: string) {
    const c = cards.get(id)!;
    if (busy) return;
    if (!c.buy.dataset.ready) { say(""); load(); return; }
    busy = true;
    for (const x of cards.values()) x.buy.disabled = true;
    c.buy.replaceChildren(el("span", {}, ["Buying..."]));
    say("");
    const r = await gems.buy(id);
    busy = false;
    load();
    if (r.status === "purchased") {
      const n = GEM_PACKS.find((p) => p.id === id)!.gems;
      say(`+${fmt(n)} ${GEM_NAME}. Thank you!`, "good");
      buzz("success");
      c.card.classList.remove("gem-pop"); void c.card.offsetWidth; c.card.classList.add("gem-pop");
      void flyInto(c.card.querySelector(".gem-pile")!, counter("gems"), "gems", n);
      refreshCoins();
    } else if (r.status === "pending") say(`Waiting for approval. The ${GEM_NAME.toLowerCase()} arrive by themselves once it goes through.`);
    else if (r.status === "cancelled") say("");
    else { sfx("deny"); say(r.message ? `The purchase didn't go through. ${r.message}` : "The purchase didn't go through.", "warn"); }
  }

  // Gems that land outside a buy (Ask to Buy approved, an interrupted purchase finishing) fly in too.
  const offCredit = gems.onCredit((cr) => {
    if (!grid.isConnected) { offCredit(); return; }
    say(`+${fmt(cr.gems)} ${GEM_NAME} arrived. Thank you!`, "good");
    const card = cards.get(cr.productId)?.card ?? grid;
    void flyInto(card, counter("gems"), "gems", cr.gems);
    refreshCoins();
  });

  // ---- coin bundles (gems -> coins)
  const coinRows = COIN_BUNDLES.map((b) => {
    const go = button(el("span", {}, [gemIcon(), fmt(b.gems)]), "coin-buy", () => {
      if (!spend("gems", b.gems, `coins:${b.id}`)) { sfx("deny"); say(`Not enough ${GEM_NAME.toLowerCase()} for that bundle.`, "warn"); return; }
      earn("coins", b.coins, `bundle:${b.id}`);
      buzz("light");
      say(`+${fmt(b.coins)} coins.`, "good");
      void flyInto(row, counter("coins"), "coins", b.coins);
      refreshCoins();
    });
    const row = el("div", { class: "coin-row", "data-bundle": b.id }, [
      el("span", { class: "coin-pile" }, [coinIcon(), coinIcon(), ...(b.gems >= 100 ? [coinIcon()] : [])]),
      el("span", { class: "coin-what" }, [el("b", {}, [`${fmt(b.coins)} coins`]), el("small", {}, [coinBonus(b) > 0 ? `+${coinBonus(b)}% bulk bonus` : "For troop upgrades"])]),
      go,
    ]);
    return { row, go, b };
  });
  function refreshCoins() { for (const c of coinRows) c.go.classList.toggle("short", !canAfford("gems", c.b.gems)); }
  refreshCoins();

  load();
  // The Starter Pack sits at the top until it's bought, then shows "Owned" for a moment and removes itself.
  const offer = starterOffer(starter, { onGone: refreshCoins });
  return el("div", { class: "gem-shop" }, [
    ...(offer ? [offer] : []),
    offersSection(refreshCoins), // [pass] special offers: below the Starter Pack, above the chests
    // [chests] Chest offers for gems (with odds) and the daily card deals for coins.
    el("div", { id: "shop-chests", class: "shop-chests" }, [chestShop()]),
    el("section", { class: "gem-section panel" }, [
      ribbon(GEM_NAME, "gem-ribbon"),
      el("p", { class: "gem-lead" }, [`Spend ${GEM_NAME.toLowerCase()} on coins for troop upgrades or a Gauntlet Rally. Every Daily win, boss and three-star clear earns them free.`]),
      grid,
      status,
    ]),
    el("section", { class: "gem-section panel coins" }, [
      ribbon("Coins", "gold small"),
      ...coinRows.map((c) => c.row),
    ]),
    skinShop(), // [skins] keep skins for gems; the War Pass skins say where they come from
    el("p", { class: "gem-fine" }, [
      `Every level and mode is free to play: purchases only speed you up. Every pack and bundle gives exactly what it says. No ads, no tracking.`,
    ]),
  ]);
}

// ---------------------------------------------------------------- [pass] special offers
const longWait = (ms: number) => (ms >= 86_400_000 ? `${Math.floor(ms / 86_400_000)}d ${Math.floor((ms % 86_400_000) / 3_600_000)}h` : clock(ms));
const RARITY_WORD: Record<string, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };

/** Opens the next chest a bundle or pass reward left waiting (saved), then the next. */
function openWaiting(after: () => void) {
  const ch = takeChest();
  if (!ch) return after();
  openChest(ch, () => (waitingChests().length ? openWaiting(after) : after()));
}

/**
 * The Shop's special offers: 2-3 bundles that rotate every 2 days, each buyable once while it's up. Each shows exactly
 * what it pays (the unit its cards are for, the chest with a link to its odds) and an honest "Nx value" against the
 * gem packs. Prices are StoreKit's displayPrice for the bundle's price tier.
 */
export function offersSection(onChange: () => void = () => undefined): HTMLElement {
  const shops = passShops();
  const root = el("section", { class: "offers-section panel", "data-offers": "1" });
  const status = el("p", { class: "of-status", role: "status", "aria-live": "polite" });
  const say = (t: string, tone = "") => { status.textContent = t; status.className = `of-status ${tone}`; };
  let busy = false, prices: Record<string, number | undefined> = {}, shown: Record<string, string> = {};
  const draw = () => {
    const offers = currentOffers(), pool = offerPool();
    if (!offers.length) { root.hidden = true; return; }
    const ends = offers[0].endsAt;
    const waiting = waitingChests().length;
    root.replaceChildren(
      ribbon("Special offers", "gem-ribbon"),
      el("span", { class: "of-timer" }, [`Ends in ${longWait(ends - Date.now())}`]),
      ...(waiting ? [el("div", { class: "of-waiting" }, [button(el("span", {}, [`Open your chest${waiting > 1 ? "s" : ""} (${waiting})`]), "primary small", () => openWaiting(draw))])] : []),
      ...offers.map((o) => card(o, pool)),
      status,
      el("p", { class: "of-fine" }, ["Value compares the bundle with gem packs at the same price (coins at 10 a gem, cards at their daily-deal price, the chest at its Shop price). Chest contents follow the odds shown."]),
    );
  };
  const card = (o: Offer, pool: ReturnType<typeof offerPool>) => {
    const pay = offerPayout(o, pool), bought = isOfferBought(o.id);
    const unit = pay.cards ? (() => {
      const c = el("canvas", { width: "60", height: "60", style: "width:30px;height:30px" }) as HTMLCanvasElement;
      requestAnimationFrame(() => paintPortrait(c, pay.cards!.kind));
      return c;
    })() : coinIcon();
    const buy = button(el("span", {}, [shown[o.productId] ?? "..."]), "gold big of-buy", () => void doBuy(o));
    buy.disabled = busy || !shown[o.productId];
    const x = offerValueX(o, prices);
    return el("div", { class: `of-card ${o.tier} ${bought ? "bought" : ""}`, "data-offer-id": o.id }, [
      el("div", { class: "of-head" }, [el("b", {}, [o.name]), x >= 2 ? el("span", { class: "gem-flag" }, [`${x}x value`]) : el("span")]),
      el("div", { class: "of-items" }, [
        el("div", { class: "of-item" }, [gemIcon(), el("b", {}, [fmt(pay.gems)]), el("small", {}, [GEM_NAME])]),
        el("div", { class: "of-item" }, [coinIcon(), el("b", {}, [fmt(pay.coins)]), el("small", {}, ["coins"])]),
        el("div", { class: `of-item r-${pay.cards?.rarity ?? "common"}` }, [unit, el("b", {}, [pay.cards ? `x${pay.cards.n}` : "-"]), el("small", {}, [pay.cards ? `${UNITS[pay.cards.kind].name} (${RARITY_WORD[pay.cards.rarity]})` : "cards as coins"])]),
        el("div", { class: "of-item" }, [chestArt(o.chest), el("small", {}, [CHESTS[o.chest].name]), button("Odds", "ghost small of-odds", () => chestInfo(o.chest))]),
      ]),
      el("div", { class: "of-foot" }, [bought ? el("span", { class: "of-done" }, ["Bought. Thank you!"]) : buy]),
    ]);
  };
  async function doBuy(o: Offer) {
    if (busy || isOfferBought(o.id)) return;
    busy = true; say(""); draw();
    const r = await shops.buyOffer(o);
    busy = false;
    if (r.status === "purchased") {
      buzz("success"); sfx("upgrade");
      say(`${o.name}: +${fmt(o.gems)} ${GEM_NAME.toLowerCase()}, coins and cards. Opening your chest...`, "good");
      const at = root.querySelector(`[data-offer-id="${o.id}"]`) ?? root;
      void flyInto(at, counter("gems"), "gems", o.gems);
      void flyInto(at, counter("coins"), "coins", o.coins);
      draw(); onChange();
      setTimeout(() => openWaiting(() => { draw(); onChange(); }), 650);
      return;
    }
    draw();
    if (r.status === "pending") say("Waiting for approval. The bundle arrives by itself once it goes through.");
    else if (r.status === "failed") { sfx("deny"); say(r.message ? `The purchase didn't go through. ${r.message}` : "The purchase didn't go through.", "warn"); }
  }
  const off = shops.offers.onCredit((_p, what) => {
    if (!root.isConnected) { off(); return; }
    say(what ? `${what.offer.name} arrived. Thank you!` : "Your bundle arrived.", "good");
    draw(); onChange();
  });
  shops.offers.products().then((ps) => {
    prices = Object.fromEntries(ps.map((p) => [p.id, p.price]));
    shown = Object.fromEntries(ps.map((p) => [p.id, p.displayPrice]));
    if (!busy) draw();
  }, () => { say("Can't reach the App Store right now.", "warn"); });
  const tick = window.setInterval(() => { if (!root.isConnected) { clearInterval(tick); return; } if (!busy) draw(); }, 60_000);
  draw();
  return root;
}

/** Appends the free gems a result screen just paid into its sheet (a marked hook in src/main.ts calls this). */
export function showRewards(host: HTMLElement | null, rewards: Reward[]) {
  const strip = rewardStrip(rewards);
  const box = host?.querySelector(".results");
  if (!strip || !box) return;
  const before = box.querySelector(".result-stats");
  box.insertBefore(strip, before?.nextSibling ?? null);
}

/** The Gauntlet Rally on a lost run's result sheet: refight the same rival at half health, once per run, for gems. */
export function rallyOffer(host: HTMLElement | null, run: RallyRun & { stage: number }, onRally: () => void) {
  const box = host?.querySelector(".results");
  if (!box || !canRally(run)) return;
  const afford = canAfford("gems", RALLY_GEMS);
  const go = button(el("span", {}, ["Rally", el("small", {}, [gemIcon(), String(RALLY_GEMS)])]), `gem big rally-btn ${afford ? "" : "short"}`, () => {
    if (!spend("gems", RALLY_GEMS, "gauntlet:rally")) { sfx("deny"); note.textContent = `You need ${RALLY_GEMS} ${GEM_NAME.toLowerCase()}. Daily wins and bosses earn them.`; return; }
    applyRally(run);
    buzz("success");
    onRally();
  });
  const note = el("small", { class: "rally-note" }, [`Refight rival ${run.stage} at half health. Once per run.`]);
  const first = box.querySelector(".btn");
  box.insertBefore(el("div", { class: "rally" }, [go, note]), first);
}
