// Blackridge's battle screen: the base game's (every rule, input and animation), with the HUD laid out again as a
// command display. The base HUD puts the rival's plate along the top and the player's bar over the shop. Here both
// forces face each other in one telemetry strip across the top (player left, round counter in the middle, hostile
// right, bars running outward), the battlefield sits in a feed frame with corner brackets and a blinking REC mark,
// and the bottom is only the unit rack: a label, the supply and squad counters, the cards and the action bar.
import { el } from "@base/ui/dom";
import { GameScreen as Base, type GameOpts } from "@base/ui/game";

export * from "@base/ui/game";

export class GameScreen extends Base {
  private brRo?: ResizeObserver;
  constructor(host: HTMLElement, opts: GameOpts) {
    super(host, opts);
    const root = (this as unknown as { root: HTMLElement }).root;
    const q = (s: string) => root.querySelector(s) as HTMLElement | null;
    const top = q(".hud-top"), bottom = q(".hud-bottom"), you = q(".cmdr.you"), foe = q(".cmdr.foe"), round = q(".round");
    if (!top || !bottom || !you || !foe || !round) return;
    root.classList.add("br-game");
    // ---- the telemetry strip: the player's bar comes up beside the hostile's
    const youHp = you.querySelector(".hpbar") as HTMLElement;
    const youSide = el("div", { class: "br-side you" }, [el("div", { class: "br-tag" }, [el("b", {}, ["Halcyon"]), el("span", {}, ["CP"])]), youHp]);
    foe.classList.remove("plate");
    foe.classList.add("br-side");
    top.insertBefore(youSide, top.firstChild);
    top.insertBefore(round, foe);
    round.classList.remove("plate");
    // ---- the rack header where the player's bar was
    you.insertBefore(el("span", { class: "br-rack-h" }, ["Unit rack"]), you.firstChild);
    // ---- the feed frame over the battlefield
    const feed = el("div", { class: "br-feed", "aria-hidden": "true" }, [
      el("span", { class: "tl" }, ["REC // FEED 03"]), el("span", { class: "tr" }, ["ALT 120 M"]),
      el("span", { class: "bl" }, ["GRID 41-88"]), el("span", { class: "br" }, [opts.title ?? "LIVE"]),
    ]);
    root.insertBefore(feed, top);
    const fit = () => { root.style.setProperty("--br-top", `${Math.round(top.getBoundingClientRect().bottom + 5)}px`); root.style.setProperty("--br-bot", `${Math.round(window.innerHeight - bottom.getBoundingClientRect().top + 5)}px`); };
    fit();
    this.brRo = new ResizeObserver(fit);
    this.brRo.observe(top); this.brRo.observe(bottom);
  }
  destroy() { this.brRo?.disconnect(); super.destroy(); }
}
