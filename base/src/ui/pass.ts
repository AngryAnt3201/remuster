// The War Pass screen: the season header and timer, today's three quests, the Premium card, and the free and premium
// tracks side by side (one row a tier, scrolling). Tap a reached reward to claim it: it pops, coins and gems fly into
// the counters, cards show the unit they went to, and chests play the usual chest-opening sequence. Tap a chest that
// isn't claimable yet to see its odds. Rules: src/progression/pass.ts and quests.ts; purchases: src/store/pass.ts.
// Mount: passScreen(app, { back }) appends the screen to `app` and returns it (the caller clears `app` first).
import "./pass.css";
import { sfx, unlockAudio } from "../audio/sfx";
import { UNITS, type UnitKind } from "@engine/core/defs";
import { GEM_NAME } from "@engine/economy/gems";
import { buzz } from "../native";
import { RARITY } from "@engine/progression/collection";
import { CHESTS } from "@engine/progression/chests";
import {
  PASS_EXTRA_GEMS, PREMIUM_TRACK, FREE_TRACK, TIERS, claimableCount, XP_PER_TIER, cardsFor, claimReward, claimable, claimed, hasPremium, intoTier,
  onPassChange, pass, reached, seasonLeft, skipCost, skipTier, takeChest, themeOf, tierOf, waitingChests, type Paid, type PassReward, type Track,
} from "@engine/progression/pass";
import { claimQuest, onQuestsChange, questState, todaysQuests } from "@engine/progression/quests";
import { passShops } from "@engine/store/pass";
import { chestArt, chestInfo, clock, openChest } from "./chests";
import { coinIcon, currencyBar, flyInto, gemIcon } from "./currency";
import { el } from "./dom";
import { paintPortrait, ribbon } from "./game";
import { icon } from "./kit";

const fmt = (n: number) => n.toLocaleString("en");
function button(label: (Node | string)[] | string, cls: string, fn: () => void) {
  const b = el("button", { class: `btn ${cls}` }, typeof label === "string" ? [label] : label) as HTMLButtonElement;
  b.addEventListener("click", (e) => { e.stopPropagation(); unlockAudio(); sfx("tap"); fn(); });
  return b;
}
const portrait = (kind: UnitKind, size: number) => {
  const c = el("canvas", { class: "pass-portrait", width: String(size * 2), height: String(size * 2), style: `width:${size}px;height:${size}px` }) as HTMLCanvasElement;
  requestAnimationFrame(() => paintPortrait(c, kind));
  return c;
};
/** Days and hours for long waits, the chest clock under a day. */
export const longClock = (ms: number) => (ms >= 86_400_000 ? `${Math.floor(ms / 86_400_000)}d ${Math.floor((ms % 86_400_000) / 3_600_000)}h` : clock(ms));
const SKIN_NAME: Record<string, string> = { "keep:blossom": "Blossom Keep", "keep:gilded": "Gilded Keep" };

/** A reward's face: icon and amount. */
export function rewardFace(r: PassReward): HTMLElement {
  switch (r.kind) {
    case "coins": return el("span", { class: "pr-face pr-coins" }, [el("span", { class: "pr-ico" }, [coinIcon(), coinIcon()]), el("b", {}, [fmt(r.n)])]);
    case "gems": return el("span", { class: "pr-face pr-gems" }, [el("span", { class: "pr-ico" }, [gemIcon()]), el("b", {}, [fmt(r.n)])]);
    case "cards": {
      const t = cardsFor(r.rarity, r.n);
      return el("span", { class: `pr-face pr-cards r-${t?.rarity ?? r.rarity}` }, [
        el("span", { class: "pr-card" }, [t ? portrait(t.kind, 30) : icon("lock")]),
        el("b", {}, [`x${t?.n ?? r.n}`]),
        el("small", {}, [t ? UNITS[t.kind].name : r.rarity]),
      ]);
    }
    case "chest": return el("span", { class: "pr-face pr-chest" }, [chestArt(r.chest, "pr-chest-art"), el("small", {}, [CHESTS[r.chest].name])]);
    case "skin": return el("span", { class: `pr-face pr-skin s-${r.id.split(":")[1]}` }, [el("span", { class: "pr-keep" }, [icon("crown")]), el("small", {}, [SKIN_NAME[r.id] ?? "Keep skin"])]);
  }
}

export interface PassOpts { back?: () => void }

export function passScreen(app: HTMLElement, opts: PassOpts = {}): HTMLElement {
  const shops = passShops();
  const p0 = pass(), th = themeOf(p0.season);
  const cur = currencyBar("pass-cur");
  const counter = (c: "gems" | "coins") => cur.querySelector<HTMLElement>(`.cur-${c}`) ?? cur;
  const backBtn = opts.back ? el("button", { class: "icon-btn back", "aria-label": "Back" }, [icon("back")]) : el("span");
  if (opts.back) backBtn.addEventListener("click", () => { unlockAudio(); sfx("tap"); opts.back!(); });
  const root = el("div", { class: "screen pass-screen", "data-theme": th.theme, style: `--season:${th.accent};--season-d:${th.deep}` });
  const head = el("div", { class: "screen-head" }, [backBtn, el("h1", {}, ["War Pass"]), cur]);
  const scroll = el("div", { class: "pass-scroll" });
  const toast = el("div", { class: "pass-toast", role: "status", "aria-live": "polite" });
  root.append(head, scroll, toast);
  app.append(root);

  let toastT = 0;
  const say = (node: (Node | string)[], tone = "") => {
    toast.replaceChildren(...node); toast.className = `pass-toast show ${tone}`;
    clearTimeout(toastT); toastT = window.setTimeout(() => toast.classList.remove("show"), 2600);
  };

  // ---- hero: season, timer, tier, XP bar, skip
  const hero = el("section", { class: "pass-hero" });
  function drawHero() {
    const p = pass(), tier = tierOf(p.xp), top = tier >= TIERS, cost = skipCost(p);
    hero.replaceChildren(
      el("div", { class: "ph-season" }, [el("small", {}, [`Season ${p.season}`]), el("h2", {}, [th.name]), el("p", {}, [th.tagline])]),
      el("div", { class: "ph-timer" }, [icon("flag"), `Ends in ${longClock(seasonLeft(Date.now()))}`]),
      el("div", { class: "ph-row" }, [
        el("div", { class: "ph-tier" }, [el("small", {}, ["Tier"]), el("b", {}, [String(tier)])]),
        el("div", { class: "ph-bar" }, [
          el("div", { class: "ph-fill", style: `width:${top ? 100 : (intoTier(p.xp) / XP_PER_TIER) * 100}%` }),
          el("span", {}, [top ? "Season complete!" : `${intoTier(p.xp)} / ${XP_PER_TIER} XP`]),
        ]),
        top ? el("span") : button([el("span", { class: "ph-skip-in" }, ["Skip", gemIcon(), String(cost)])], "gem small ph-skip", () => {
          if (!skipTier()) { sfx("deny"); say([`Not enough ${GEM_NAME.toLowerCase()} to skip this tier.`], "warn"); return; }
          buzz("success"); sfx("upgrade"); say([`Tier ${tierOf(pass().xp)} reached.`], "good");
        }),
      ]),
      hasPremium(p) ? el("div", { class: "ph-premium-on" }, [icon("crown"), "Premium active · chests unlock 20% faster"]) : el("span"),
    );
  }

  // ---- quests
  const quests = el("section", { class: "pass-quests panel" });
  function drawQuests() {
    const q = questState(), ds = todaysQuests();
    const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    quests.replaceChildren(
      ribbon("Daily quests", "gold small"),
      el("small", { class: "pq-new" }, [`New quests in ${clock(midnight.getTime() - Date.now())}`]),
      ...ds.map((d, i) => {
        const have = Math.min(d.n, q.have[i]), done = have >= d.n, got = q.claimed[i];
        const row = el("div", { class: `pq-row ${done ? "done" : ""} ${got ? "got" : ""}`, "data-quest": d.kind }, [
          el("div", { class: "pq-what" }, [el("b", {}, [d.text]), el("div", { class: "pq-bar" }, [el("i", { style: `width:${(have / d.n) * 100}%` }), el("span", {}, [`${have}/${d.n}`])])]),
          el("div", { class: "pq-pay" }, [el("span", {}, [coinIcon(), fmt(d.coins)]), el("span", { class: "pq-xp" }, [`+${d.xp} XP`])]),
          got ? el("span", { class: "pq-check" }, [icon("check")])
            : done ? button("Claim", "primary small pq-claim", () => {
              const pay = claimQuest(i);
              if (!pay) return;
              buzz("success"); sfx("upgrade");
              row.classList.add("pop");
              void flyInto(row, counter("coins"), "coins", pay.coins);
              say([`+${fmt(pay.coins)} coins · +${pay.xp} pass XP`], "good");
            }) : el("span", { class: "pq-wait" }),
        ]);
        return row;
      }),
    );
  }

  // ---- premium card
  const premium = el("section", { class: "pass-premium panel" });
  const pstatus = el("p", { class: "pp-status", role: "status", "aria-live": "polite" });
  let busy = false;
  function drawPremium() {
    const p = pass();
    if (hasPremium(p)) { premium.hidden = true; return; }
    premium.hidden = false;
    const buy = button([el("span", {}, ["..."])], "gold big pp-buy", () => void doBuy());
    buy.disabled = true;
    shops.pass.products().then((ps) => {
      const pr = ps[0];
      buy.disabled = !pr || busy;
      buy.replaceChildren(el("span", {}, [busy ? "Buying..." : pr ? `Unlock Premium · ${pr.displayPrice}` : "Unavailable"]));
    }, () => { buy.disabled = false; buy.replaceChildren(el("span", {}, ["Retry"])); pstatus.textContent = "Can't reach the App Store right now."; });
    const ready = Array.from({ length: TIERS }, (_, i) => i + 1).filter((t) => reached(p, t)).length;
    const prGems = PREMIUM_TRACK.reduce((n, r) => n + (r.kind === "gems" ? r.n : 0), 0);
    const legends = PREMIUM_TRACK.reduce((n, r) => n + (r.kind === "cards" && r.rarity === "legendary" ? r.n : 0), 0);
    const chests = PREMIUM_TRACK.filter((r) => r.kind === "chest").length;
    premium.replaceChildren(
      ribbon("War Pass Premium", "gold"),
      el("div", { class: "pp-body" }, [
        el("div", { class: "pp-keep" }, [el("span", { class: "pr-keep big" }, [icon("crown")]), el("small", {}, ["Gilded Keep at tier 30"])]),
        el("ul", { class: "pp-perks" }, [
          el("li", {}, [gemIcon(), el("span", {}, [el("b", {}, [fmt(prGems)]), ` ${GEM_NAME.toLowerCase()} over the season`])]),
          el("li", {}, [icon("check"), el("span", {}, [el("b", {}, [String(chests)]), " bigger chests, up to a Legend's Reliquary"])]),
          el("li", {}, [icon("check"), el("span", {}, [el("b", {}, [String(legends)]), " legendary cards, plus epics and rares"])]),
          el("li", {}, [icon("check"), el("span", {}, ["Chests unlock ", el("b", {}, ["20% faster"])])]),
        ]),
      ]),
      ready > 0 ? el("p", { class: "pp-retro" }, [`Unlocks the ${ready} premium reward${ready === 1 ? "" : "s"} you've already reached.`]) : el("span"),
      buy, pstatus,
      el("p", { class: "pp-fine" }, ["This season only. Every level stays free; Premium adds rewards, never power in battle."]),
    );
    async function doBuy() {
      if (busy) return;
      busy = true; buy.disabled = true; buy.replaceChildren(el("span", {}, ["Buying..."])); pstatus.textContent = "";
      const r = await shops.buyPass();
      busy = false;
      if (r.status === "purchased") {
        buzz("success"); sfx("upgrade");
        if (r.what === "extra") say([`Premium was already active: +${PASS_EXTRA_GEMS} ${GEM_NAME.toLowerCase()} instead.`], "good");
        else say(["Premium unlocked! Your premium rewards are ready."], "good");
        root.classList.add("premium-burst");
        setTimeout(() => root.classList.remove("premium-burst"), 1400);
        redraw();
        return;
      }
      drawPremium();
      if (r.status === "pending") pstatus.textContent = "Waiting for approval. Premium unlocks by itself once it goes through.";
      else if (r.status === "failed") { sfx("deny"); pstatus.textContent = r.message ? `The purchase didn't go through. ${r.message}` : "The purchase didn't go through."; pstatus.classList.add("warn"); }
    }
  }
  const offCredit = shops.pass.onCredit(() => { if (!root.isConnected) { offCredit(); return; } say(["War Pass Premium arrived. Thank you!"], "good"); redraw(); });

  // ---- the tracks
  const tracks = el("section", { class: "pass-tracks" });
  function cell(t: Track, tier: number): HTMLElement {
    const p = pass(), r = (t === "free" ? FREE_TRACK : PREMIUM_TRACK)[tier - 1];
    const can = claimable(p, t, tier), got = claimed(p, t, tier), locked = t === "premium" && !hasPremium(p);
    const c = el("button", { class: `pt-cell ${t} ${can ? "can" : ""} ${got ? "got" : ""} ${locked ? "locked" : ""} ${reached(p, tier) ? "reached" : ""}`, "data-tier": String(tier), "data-track": t }, [
      rewardFace(r),
      got ? el("span", { class: "pt-badge got" }, [icon("check")]) : locked ? el("span", { class: "pt-badge lock" }, [icon("lock")]) : can ? el("span", { class: "pt-badge can" }, ["Claim"]) : el("span"),
    ]);
    c.addEventListener("click", () => {
      unlockAudio();
      if (can) return void claim(t, tier, c);
      if (r.kind === "chest") return void chestInfo(r.chest);
      sfx("tap");
    });
    return c;
  }
  function claim(t: Track, tier: number, c: HTMLElement) {
    const paid = claimReward(t, tier);
    if (!paid) return;
    buzz("success"); sfx("upgrade");
    c.classList.add("claiming");
    celebrate(paid, c);
    setTimeout(() => redraw(), 520);
  }
  function celebrate(paid: Paid, from: HTMLElement) {
    if (paid.coins) void flyInto(from, counter("coins"), "coins", paid.coins);
    if (paid.gems) void flyInto(from, counter("gems"), "gems", paid.gems);
    if (paid.cards) say([portrait(paid.cards.kind, 26), `+${paid.cards.n} ${UNITS[paid.cards.kind].name} card${paid.cards.n === 1 ? "" : "s"}${paid.cards.isNew ? " · NEW unit!" : ""}`], `good r-${RARITY[paid.cards.kind]}`);
    if (paid.skin) say([icon("crown"), `${SKIN_NAME[paid.skin] ?? "Keep skin"} unlocked!`], "good skin");
    if (paid.chest) setTimeout(openWaiting, 380);
  }
  function drawTracks() {
    const p = pass(), tier = tierOf(p.xp);
    tracks.replaceChildren(
      el("div", { class: "pt-head" }, [el("b", { class: "free" }, ["Free"]), el("span"), el("b", { class: "premium" }, [icon("crown"), "Premium"])]),
      ...Array.from({ length: TIERS }, (_, i) => i + 1).map((t) =>
        el("div", { class: `pt-row ${t <= tier ? "reached" : ""} ${t === tier + 1 ? "next" : ""}`, "data-row": String(t) }, [
          cell("free", t),
          el("div", { class: "pt-node" }, [el("b", {}, [String(t)])]),
          cell("premium", t),
        ])),
      el("p", { class: "pt-fine" }, ["Tap a chest to see its odds. Cards go to the unit shown. Pass XP comes from daily quests and the stars or crowns you win."]),
    );
  }

  /** Chests from rewards or offers wait in the save until their opening sequence plays. */
  function openWaiting() {
    const ch = takeChest();
    if (!ch) return;
    openChest(ch, () => { drawHero(); if (waitingChests().length) openWaiting(); });
  }

  function redraw() { drawHero(); drawQuests(); drawPremium(); drawTracks(); }
  scroll.append(hero, quests, premium, tracks);
  redraw();
  const offPass = onPassChange(() => { if (!root.isConnected) { offPass(); return; } drawHero(); });
  const offQ = onQuestsChange(() => { if (!root.isConnected) { offQ(); return; } drawQuests(); });
  const tick = window.setInterval(() => { if (!root.isConnected) { clearInterval(tick); return; } drawHero(); }, 30_000);
  if (waitingChests().length) setTimeout(openWaiting, 400);
  return root;
}

/**
 * For the home tab bar's Pass tab: how many things are waiting to be tapped (pass rewards plus finished quests).
 * Subscribe with onPassChange / onQuestsChange from src/progression/pass.ts and quests.ts to refresh it.
 */
export function passBadge(): number {
  const q = questState();
  return claimableCount(pass()) + todaysQuests().filter((d, i) => q.have[i] >= d.n && !q.claimed[i]).length;
}
