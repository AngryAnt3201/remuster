// The Starter Pack offer at the top of the Shop: a one-time pack of gems, coins and unit cards that gets a new
// player further, faster. Nothing in the game is locked behind it. Price and name come from the store; the panel
// shows every buy state (loading, buying, pending approval, cancelled, failed) and "Owned" for a moment once bought,
// then removes itself.
import { sfx, unlockAudio } from "../audio/sfx";
import { GEM_NAME } from "@engine/economy/gems";
import { buzz } from "../native";
import { rarityOf } from "@engine/progression/collection";
import { STARTER_PACK, starterCardCount, starterValueX, type StarterShop } from "@engine/store/starter";
import { coinIcon, flyInto, gemIcon } from "./currency";
import { el } from "./dom";
import { framedPortrait, ribbon } from "./game";
import { icon } from "./kit";
import "./shop.css";

function button(label: string | Node, cls: string, fn: () => void) {
  const b = el("button", { class: `btn ${cls}` }, [label]) as HTMLButtonElement;
  b.addEventListener("click", () => { unlockAudio(); sfx("tap"); fn(); });
  return b;
}
const fmt = (n: number) => n.toLocaleString("en");
const counter = (c: "gems" | "coins") => document.querySelector<HTMLElement>(`.shop-cur .cur-${c}`) ?? document.createElement("span");

export interface StarterOpts {
  /** Called after the pack is bought and the "Owned" moment has passed (the panel has removed itself). */
  onGone?: () => void;
  /** How long "Owned" shows before the panel goes (ms). */
  ownedMs?: number;
}

/** The Starter Pack panel. Returns null when the pack is already bought (the Shop doesn't show it). */
export function starterOffer(starter: StarterShop, o: StarterOpts = {}): HTMLElement | null {
  if (starter.owned()) return null;
  const p = STARTER_PACK;
  const status = el("p", { class: "shop-status", role: "status", "aria-live": "polite" });
  const buy = button("", "gold big shop-buy", () => void doBuy());
  const owned = el("div", { class: "shop-owned" }, [icon("check"), el("span", {}, ["Owned. Thank you!"])]);
  owned.hidden = true;
  const flag = el("span", { class: "gem-flag starter-flag" }, [`${starterValueX()}x value`]);
  // The pack's best cards up front: the epic in the middle, flanked by the rares and two commons.
  const show = [...p.cards].sort((a, b) => rank(b[0]) - rank(a[0])).slice(0, 5);
  const order = [show[3], show[1], show[0], show[2], show[4]].filter(Boolean);
  const heroes = el("div", { class: "shop-heroes" }, order.map(([k, n], i) => {
    const f = framedPortrait(k, i === 2 ? 4 : 3, `shop-hero h${i}`).frame;
    f.append(el("span", { class: `starter-count r-${rarityOf(k)}` }, [`x${n}`]));
    return f;
  }));
  const gemsLine = el("li", { class: "starter-gems" }, [gemIcon(), el("span", {}, [el("b", {}, [fmt(p.gems)]), ` ${GEM_NAME}`])]);
  const coinsLine = el("li", { class: "starter-coins" }, [coinIcon(), el("span", {}, [el("b", {}, [fmt(p.coins)]), " coins"])]);
  const byRarity = (r: string) => p.cards.filter(([k]) => rarityOf(k) === r).reduce((n, [, c]) => n + c, 0);
  const cardBits = (["common", "rare", "epic", "legendary"] as const).filter((r) => byRarity(r) > 0).map((r) => `${byRarity(r)} ${r}`);
  const cardsLine = el("li", { class: "starter-cards" }, [icon("check"), el("span", {}, [el("b", {}, [`${starterCardCount()} unit cards`]), ` (${cardBits.join(", ")})`])]);
  const panel = el("div", { class: "shop-offer panel starter-offer", "data-offer": "starter" }, [
    ribbon("Starter Pack", "gold"),
    flag,
    heroes,
    el("p", { class: "lead shop-pitch" }, ["A head start for your army. Every level is already free: this just gets you there faster."]),
    el("ul", { class: "shop-perks starter-perks" }, [gemsLine, coinsLine, cardsLine]),
    owned, buy, status,
    el("p", { class: "shop-fine" }, ["One per player. No ads, no subscriptions, no tracking."]),
  ]);

  let busy = false, done = false;
  const say = (text: string, tone: "" | "warn" | "good" = "") => { status.textContent = text; status.className = `shop-status ${tone}`; };
  const label = (text: string, price?: string) => buy.replaceChildren(el("span", {}, [text, ...(price ? [el("small", {}, [price])] : [])]));

  function loadPrice() {
    buy.disabled = true;
    label("Get it", "...");
    starter.product().then((pr) => {
      if (busy || done) return;
      if (!pr) { buy.disabled = true; label("Unavailable"); say("The Starter Pack isn't on sale right now.", "warn"); return; }
      buy.disabled = false;
      buy.dataset.ready = "1";
      label("Get it", pr.displayPrice);
    }, () => {
      if (busy) return;
      buy.disabled = false;
      delete buy.dataset.ready;
      label("Try again");
      say("Can't reach the App Store right now.", "warn");
    });
  }
  async function doBuy() {
    if (busy || done) return;
    if (!buy.dataset.ready) { say(""); loadPrice(); return; }
    busy = true; buy.disabled = true;
    label("Buying...");
    say("");
    const r = await starter.buy();
    busy = false;
    if (r.status === "purchased") { arrived("Starter Pack added. Thank you!"); return; }
    loadPrice();
    if (r.status === "pending") { panel.dataset.state = "pending"; say("Waiting for approval. The pack arrives by itself once it goes through."); }
    else if (r.status === "cancelled") { panel.dataset.state = ""; say(""); }
    else { panel.dataset.state = "failed"; sfx("deny"); say(r.message ? `The purchase didn't go through. ${r.message}` : "The purchase didn't go through.", "warn"); }
  }
  function arrived(text: string) {
    if (done) return;
    done = true;
    panel.dataset.state = "owned";
    sfx("upgrade"); buzz("success");
    buy.hidden = true;
    owned.hidden = false;
    panel.classList.add("owned");
    say(text, "good");
    void flyInto(gemsLine, counter("gems"), "gems", p.gems);
    void flyInto(coinsLine, counter("coins"), "coins", p.coins);
    setTimeout(() => {
      if (!panel.isConnected) return;
      panel.classList.add("starter-gone");
      setTimeout(() => { panel.remove(); o.onGone?.(); }, 380);
    }, o.ownedMs ?? 2400);
  }

  loadPrice();
  // An Ask to Buy approval (or a purchase interrupted earlier) can land while the panel is open.
  const off = starter.onCredit(() => { if (!panel.isConnected) { off(); return; } arrived("Approved. Starter Pack added."); });
  return panel;
}

const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 } as const;
function rank(k: Parameters<typeof rarityOf>[0]) { return RANK[rarityOf(k)] * 1000 + (STARTER_PACK.cards.find(([x]) => x === k)?.[1] ?? 0); }
