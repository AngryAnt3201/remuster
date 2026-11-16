// One match on screen: deploy (drag from the shop, move, upgrade, sell), then the battle plays out, then the damage.
import { applyPlan, planTurnAsync, type AIProfile } from "@engine/core/ai";
import type { Battle } from "@engine/core/battle";
import { BODY_EXTRA, DT, UNITS, clampToZone, inZone, upgradeCost, type Piece, type Side, type SpawnKind, type UnitKind } from "@engine/core/defs";
import { Match, type MatchConfig, type RoundReport } from "@engine/core/match";
import { sfx, unlockAudio } from "../audio/sfx";
import { buzz } from "../native";
import { BoardView, type Scene } from "../render/board";
import type { Assault } from "../render/assault";
import { drawIcon } from "../render/units";
import { loadSprites, preload, whenPortrait } from "../render/sprites";
import * as Defs from "@engine/core/defs";
import { levelDmg, levelHp, levelOf } from "@engine/core/levels";

/** Seconds the board holds on the final blow (slow motion and the camera's push-in, juice.ts) before the round's result. */
const END_BEAT = 1.15;
export const TIER_NAMES = ["Recruit", "Veteran", "Elite", "Ascended"];
/** The rank-4 signature ability, if the build has them. */
export const abilityOf = (k: UnitKind): { name: string; text: string } | undefined => (Defs as any).ABILITIES?.[k];

/** Draws a unit's portrait into a card canvas, falling back to the drawn token. */
export function paintPortrait(canvas: HTMLCanvasElement, kind: UnitKind, tier = 1) {
  drawIcon(canvas, kind);
  void whenPortrait(kind, tier).then((img) => {
    if (!img || canvas.dataset.kind !== kind + tier) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight) * 1.05;
    ctx.drawImage(img, (w - img.naturalWidth * k) / 2, (h - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
  });
  canvas.dataset.kind = kind + tier;
}
import { load, save } from "@engine/save";
import { el, fmt } from "./dom";
import { ROLE_FAMILY, ROLE_LABEL, coin, icon, roleBadge } from "./kit";

/** A tier-framed portrait canvas (metal by tier, window colour by role family). */
export function framedPortrait(kind: UnitKind, tier: number, cls: string) {
  const c = el("canvas") as HTMLCanvasElement;
  const f = el("div", { class: `frame ${cls} t${tier} fam-${ROLE_FAMILY[UNITS[kind].role]}` }, [c]);
  requestAnimationFrame(() => paintPortrait(c, kind, tier));
  return { frame: f, canvas: c };
}
/** Ribbon banner markup: tails and a band. */
export function ribbon(text: string, cls = "") {
  return el("div", { class: `ribbon ${cls}` }, [el("i", { class: "l" }), el("i", { class: "r" }), el("b", {}, [text])]);
}

export interface GameOpts {
  cfg: MatchConfig;
  foe?: AIProfile; // the rival's AI (omit for a puzzle: the foe board stands still)
  you?: AIProfile; // set to let an AI play your side (watch mode)
  mode: "campaign" | "skirmish" | "gauntlet" | "puzzle" | "daily" | "watch" | "demo";
  title?: string;
  showEnemyMines?: boolean;
  /** Campaign act whose arena to fight in (anything else gets act 1's). */
  arena?: number;
  /** Line under the opening banner (default "vs <rival>"). */
  intro?: string;
  /** First-time coaching: drag a card down, then Fight. */
  hint?: boolean;
  onEnd: (m: Match) => void;
  onQuit: () => void;
  onRestart?: () => void;
}

type Phase = "deploy" | "battle" | "result" | "over";

export class GameScreen {
  readonly root: HTMLElement;
  readonly match: Match;
  readonly view: BoardView;
  private o: GameOpts;
  private canvas: HTMLCanvasElement;
  private phase: Phase = "deploy";
  private battle?: Battle;
  private acc = 0;
  private raf = 0;
  private lastT = 0;
  private endT = 0;
  private hold = 0;
  private plans: Promise<void>[] = [];
  private planning = false;
  private selected: number | null = null;
  private pickSlot: number | null = null;
  private ghost: { kind: UnitKind; x: number; y: number; ok: boolean } | null = null;
  private drag: { type: "card" | "piece"; slot?: number; id?: number; sx: number; sy: number; moved: boolean; pid: number } | null = null;
  private tipTimer = 0;
  private hpShown: [number, number];
  /** The round-end march on the losing keep; the bars drain when its first blow lands. */
  private assault?: { a: Assault; from: [number, number]; to: [number, number]; hit: [boolean, boolean]; leaving: boolean };
  /** Health the light "damage trail" behind each bar still shows; it drains after the bar. */
  private trail: [number, number];
  private destroyed = false;
  private paused = false;
  private speed = load().settings.speed || 1;
  // HUD nodes
  private h!: {
    foeName: HTMLElement; foeHp: HTMLElement; foeHpText: HTMLElement; foeGold: HTMLElement; round: HTMLElement;
    youHp: HTMLElement; youHpText: HTMLElement; gold: HTMLElement; supply: HTMLElement; shop: HTMLElement; reroll: HTMLButtonElement;
    fight: HTMLButtonElement; banner: HTMLElement; pop: HTMLElement; tip: HTMLElement; speed: HTMLButtonElement; skip: HTMLButtonElement;
    bottom: HTMLElement; top: HTMLElement; status: HTMLElement; menu: HTMLElement; tally: [HTMLElement, HTMLElement];
  };

  constructor(host: HTMLElement, opts: GameOpts) {
    this.o = opts;
    this.match = new Match(opts.cfg);
    this.hpShown = [this.match.sides[0].hp, this.match.sides[1].hp];
    this.trail = [...this.hpShown];
    this.root = el("div", { class: `game mode-${opts.mode}` });
    this.canvas = el("canvas", { class: "board" }) as HTMLCanvasElement;
    this.root.append(this.canvas);
    this.buildHud();
    host.append(this.root);
    this.view = new BoardView(this.canvas);
    // Each side's recruits and the bodies they spawn, in that side's colours, warmed up front; higher tiers tint on
    // demand (the lower tier shows meanwhile). Warm only: a late act's rosters outgrow the sheet budget, so each
    // fight pins just what is on the board (pinBattle).
    void loadSprites().then(() => {
      for (const side of [0, 1] as const) {
        const roster: string[] = this.match.sides[side].roster;
        const spawns = (Object.keys(BODY_EXTRA) as SpawnKind[]).filter((k) => roster.includes(BODY_EXTRA[k].from));
        preload([...roster, ...spawns], side, [1], { pin: false });
      }
    });
    this.view.setObstacles(opts.cfg.obstacles);
    void this.view.setArena(opts.arena);
    this.view.onSound = (n, g) => sfx(n, g);
    this.view.onShake = (a) => { if (a >= 2) buzz("heavy"); };
    window.addEventListener("resize", this.onResize);
    this.bindInput();
    this.startDeploy(true);
    this.layout();
    // The HUD settles after fonts and shop cards; keep the board fitted to the space between.
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.h.top);
    this.ro.observe(this.h.bottom);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    if (opts.mode !== "demo") (window as any).__game = this;
  }

  private ro?: ResizeObserver;

  destroy() {
    this.ro?.disconnect();
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.root.remove();
  }

  private get watch() { return !!this.o.you; }

  // ------------------------------------------------------------ HUD
  private buildHud() {
    const top = el("div", { class: "hud-top" });
    const foe = el("div", { class: "cmdr foe plate" }, [
      el("div", { class: "crest" }, [icon("shield")]),
      el("div", { class: "cmdr-body" }, [
        el("div", { class: "cmdr-row" }, [el("span", { class: "cmdr-name" }), el("span", { class: "cmdr-gold" })]),
        el("div", { class: "hpbar foe" }, [el("b"), el("i"), el("span")]),
      ]),
    ]);
    const round = el("div", { class: "round plate" });
    const pause = el("button", { class: "icon-btn", "aria-label": "Pause" }, [icon("pause")]);
    pause.addEventListener("click", () => this.openMenu());
    top.append(foe, round, pause);

    const bottom = el("div", { class: "hud-bottom" });
    const you = el("div", { class: "cmdr you" }, [
      el("div", { class: "crest" }, [icon("shield")]),
      el("div", { class: "hpbar you" }, [el("b"), el("i"), el("span")]),
      el("div", { class: "pills" }, [el("span", { class: "pill gold" }), el("span", { class: "pill supply" })]),
    ]);
    const shop = el("div", { class: "shop" });
    const reroll = el("button", { class: "btn small reroll" }) as HTMLButtonElement;
    reroll.addEventListener("click", () => this.reroll());
    const fight = el("button", { class: "btn fight" }, ["Fight"]) as HTMLButtonElement;
    fight.addEventListener("click", () => void this.fight());
    const speed = el("button", { class: "btn small speed" }) as HTMLButtonElement;
    speed.addEventListener("click", () => this.toggleSpeed());
    const skip = el("button", { class: "btn small skip" }, ["Skip"]) as HTMLButtonElement;
    skip.addEventListener("click", () => this.skipBattle());
    const status = el("div", { class: "status" }, [el("span")]);
    // In the fight: troops still standing on each side, where the reroll button was.
    const tally = el("div", { class: "tally", role: "status", "aria-label": "Troops standing" }, [
      el("span", { class: "tally-side you" }, [icon("sword"), el("b", {}, ["0"])]),
      el("i", {}, ["vs"]),
      el("span", { class: "tally-side foe" }, [el("b", {}, ["0"]), icon("sword")]),
    ]);
    const actions = el("div", { class: "actions" }, [reroll, tally, status, speed, skip, fight]);
    bottom.append(you, shop, actions);

    const banner = el("div", { class: "banner" });
    const pop = el("div", { class: "pop hidden" });
    const tip = el("div", { class: "tip hidden" });
    const menu = el("div", { class: "overlay center hidden" });
    const hint = el("div", { class: "hint hidden" });
    this.root.append(top, bottom, banner, pop, tip, menu, hint);
    const q = (s: string, r: HTMLElement = this.root) => r.querySelector(s) as HTMLElement;
    this.h = {
      foeName: q(".cmdr-name", foe), foeHp: q(".hpbar i", foe), foeHpText: q(".hpbar span", foe), foeGold: q(".cmdr-gold", foe), round,
      youHp: q(".hpbar i", you), youHpText: q(".hpbar span", you), gold: q(".gold", you), supply: q(".supply", you), shop, reroll, fight,
      banner, pop, tip, speed, skip, bottom, top, status, menu, tally: [q(".you b", tally), q(".foe b", tally)],
    };
    this.h.foeName.textContent = this.match.sides[1].name;
  }

  private onResize = () => this.layout();

  private layout() {
    const w = window.innerWidth, hgt = window.innerHeight;
    const topR = this.h.top.getBoundingClientRect(), botR = this.h.bottom.getBoundingClientRect();
    const area = this.o.mode === "demo"
      ? { x: 0, y: 0, w, h: hgt }
      : { x: 8, y: topR.bottom + 6, w: w - 16, h: Math.max(200, botR.top - topR.bottom - 12) };
    this.view.layout(w, hgt, area);
  }

  private refreshHud() {
    const m = this.match, you = m.sides[0], foe = m.sides[1];
    const puzzle = this.o.mode === "puzzle";
    this.h.round.classList.toggle("puzzle", puzzle);
    this.h.round.innerHTML = puzzle ? `<small>BREAK</small><b>1</b>` : `<small>ROUND</small><b>${m.round}</b>`;
    this.setHp(this.h.youHp, this.h.youHpText, this.hpShown[0], you.maxHp, this.trail[0]);
    this.setHp(this.h.foeHp, this.h.foeHpText, this.hpShown[1], foe.maxHp, this.trail[1]);
    // The keeps break up in step with the bars.
    this.view.keepHp = [Math.max(0, this.hpShown[0] / you.maxHp), Math.max(0, this.hpShown[1] / foe.maxHp)];
    this.h.gold.replaceChildren(coin("", "icon-only"), el("b", {}, [String(you.gold)]));
    this.h.supply.replaceChildren(icon("flag"), el("b", {}, [String(m.supplyUsed(0))]), `/${m.supplyCap(0)}`);
    this.h.foeGold.replaceChildren(...(puzzle ? [] : [coin("", "icon-only"), String(foe.gold)]));
    const deploy = this.phase === "deploy" && !this.watch;
    this.root.classList.toggle("in-battle", this.phase !== "deploy");
    this.h.reroll.replaceChildren(icon("reroll"), coin(m.rerollCost(0)));
    this.h.reroll.disabled = !deploy || !m.canReroll(0);
    this.h.reroll.classList.toggle("gone", !!m.cfg.noReroll || !!m.cfg.fixedShop?.[0]);
    this.h.fight.disabled = !deploy;
    this.h.fight.textContent = this.planning && deploy ? "..." : "Fight";
    this.h.fight.classList.toggle("ready", deploy && !this.planning && m.sides[0].pieces.length > 0);
    this.h.speed.textContent = `${this.speed}×`;
    const hint = this.root.querySelector(".hint") as HTMLElement;
    if (this.o.hint && this.phase === "deploy" && this.match.round <= 2) {
      const none = this.match.sides[0].pieces.length === 0;
      hint.textContent = none ? "Drag a card onto your half" : this.match.round === 1 ? "Tap Fight when you're ready" : "";
      hint.className = `hint ${hint.textContent ? "" : "hidden"} ${none ? "drag" : "go"}`;
      // Both sit on the board just above the tray, so they never hide the shop cards. Drag is centred over the
      // cards; Go lines up over the (pulsing) Fight button, kept on screen.
      hint.style.bottom = `${window.innerHeight - this.h.bottom.getBoundingClientRect().top + 22}px`;
      if (none || !hint.textContent) hint.style.left = "";
      else {
        const f = this.h.fight.getBoundingClientRect(), half = hint.offsetWidth / 2;
        hint.style.left = `${Math.max(8 + half, Math.min(window.innerWidth - 8 - half, f.left + f.width / 2))}px`;
      }
    } else hint.className = "hint hidden";
    this.renderShop();
  }

  private setHp(bar: HTMLElement, text: HTMLElement, hp: number, max: number, trail: number) {
    bar.style.width = `${Math.max(0, (hp / max) * 100)}%`;
    (bar.previousElementSibling as HTMLElement).style.width = `${Math.max(0, (Math.max(hp, trail) / max) * 100)}%`;
    text.textContent = `${Math.max(0, Math.round(hp))}`;
  }

  private renderShop() {
    const st = this.match.sides[0];
    const seen = new Set(load().seen);
    const shop = this.h.shop;
    if (shop.childElementCount !== st.shop.length) {
      shop.replaceChildren(...st.shop.map((_, i) => {
        const card = el("div", { class: "card t1", "data-slot": String(i), style: `--i:${i}` }, [
          el("div", { class: "card-art" }, [el("canvas", { class: "card-icon" })]), el("div", { class: "card-name" }), coin("", "card-cost"),
          el("span", { class: "card-role" }), el("div", { class: "card-new" }, ["NEW"]),
        ]);
        return card;
      }));
    }
    const live = this.phase === "deploy" && !this.watch;
    st.shop.forEach((k, i) => {
      const card = shop.children[i] as HTMLElement;
      const was = card.dataset.kind;
      card.dataset.kind = k ?? "";
      card.classList.toggle("sold", !k);
      const why = k ? this.match.canBuy(0, i) : "Sold";
      // Never greyscale: a card you can't take now dims a touch, and a short purse turns the cost red.
      card.classList.toggle("off", !!k && live && !!why);
      card.classList.toggle("poor", !!k && why === "Need gold");
      card.classList.toggle("rest", !!k && !live);
      card.classList.toggle("picked", this.pickSlot === i);
      card.classList.toggle("is-new", !!k && !seen.has(k));
      if (k && was !== k) {
        const nameEl = card.querySelector(".card-name") as HTMLElement;
        nameEl.textContent = UNITS[k].name;
        nameEl.classList.toggle("long", UNITS[k].name.length > 11);
        (card.querySelector(".card-cost") as HTMLElement).textContent = String(UNITS[k].cost);
        const role = UNITS[k].role;
        // Frame metal by price: bronze for the cheap rank and file, silver at 4, gold at 5+.
        const rar = UNITS[k].cost >= 5 ? 3 : UNITS[k].cost >= 4 ? 2 : 1;
        card.className = card.className.replace(/\b(fam|rar)-\w+/g, "").trim() + ` fam-${ROLE_FAMILY[role]} rar-${rar}`;
        card.querySelector(".card-role")!.replaceWith(roleBadge(role, "card-role"));
        requestAnimationFrame(() => paintPortrait(card.querySelector("canvas") as HTMLCanvasElement, k));
        card.classList.remove("deal"); void card.offsetWidth; card.classList.add("deal");
      } else if (!k && was) {
        card.classList.remove("deal", "socket-in"); void card.offsetWidth; card.classList.add("socket-in");
      }
      if (!k) (card.querySelector(".card-name") as HTMLElement).textContent = "";
    });
    const gold = st.gold;
    if (this.lastGold !== undefined && gold !== this.lastGold) {
      const pill = this.h.gold;
      pill.classList.remove("bump", "spend"); void pill.offsetWidth; pill.classList.add(gold > this.lastGold ? "bump" : "spend");
    }
    this.lastGold = gold;
    if (st.shop.some((k) => k && !seen.has(k))) save((s) => { for (const k of st.shop) if (k && !s.seen.includes(k)) s.seen.push(k); });
  }
  private lastGold?: number;

  /** The bought card leaves the tray: a copy of it (portrait included) flies up towards the drop and fades. */
  private spendFx(slot: number, toX?: number, toY?: number) {
    const card = this.h.shop.children[slot] as HTMLElement | undefined;
    if (!card || this.o.mode === "demo") return;
    const r = card.getBoundingClientRect();
    const copy = card.cloneNode(true) as HTMLElement;
    const src = card.querySelector("canvas") as HTMLCanvasElement | null, dst = copy.querySelector("canvas") as HTMLCanvasElement | null;
    if (src && dst && src.width && src.height) { dst.width = src.width; dst.height = src.height; dst.getContext("2d")?.drawImage(src, 0, 0); }
    copy.classList.remove("deal", "picked", "dragging", "off", "poor", "is-new");
    copy.classList.add("spent");
    const dx = toX === undefined ? 0 : toX - (r.left + r.width / 2), dy = toY === undefined ? -90 : toY - (r.top + r.height / 2);
    copy.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--dx:${Math.round(dx * 0.55)}px;--dy:${Math.round(dy * 0.55)}px`;
    copy.addEventListener("animationend", () => copy.remove());
    setTimeout(() => copy.remove(), 900);
    this.root.append(copy);
  }

  private bannerT = 0;
  /** A round banner: a ribbon (or one big word for "fight") and an optional line under it. */
  private showBanner(head: string, sub: string | (Node | string)[] = "", cls = "", ms = 1100) {
    if (this.o.mode === "demo") return;
    const b = this.h.banner;
    b.className = `banner show ${cls}`;
    const top = cls === "fight" ? el("div", { class: "big-word" }, [head]) : ribbon(head);
    const line = typeof sub === "string" ? (sub ? [sub] : []) : sub;
    b.replaceChildren(top, ...(line.length ? [el("small", {}, line)] : []));
    clearTimeout(this.bannerT);
    this.bannerT = window.setTimeout(() => { b.className = "banner"; }, ms);
  }

  // ------------------------------------------------------------ rounds
  private startDeploy(first = false) {
    this.phase = "deploy";
    this.selected = null;
    this.pickSlot = null;
    this.battle = undefined;
    this.assault = undefined;
    this.view.assault = undefined;
    this.closePop();
    const m = this.match;
    const inc = m.sides[0].lastIncome;
    if (this.o.mode === "puzzle") this.showBanner(this.o.title ?? "Breakpoint", "Win this one battle", "intro", 1600);
    else if (first) this.showBanner(this.o.title ?? "Muster", this.o.intro ?? `vs ${m.sides[1].name}`, "intro", 1600);
    else {
      const extra = inc.interest ? ` +${inc.interest} interest` : "";
      this.showBanner(`Round ${m.round}`, [coin("", "icon-only"), `+${inc.base + inc.bonus} gold${extra}`], "round", 1200);
      sfx("round");
    }
    // The rival plans now, from what it could see at the start of the round.
    this.plans = [];
    const tick = () => new Promise<void>((r) => setTimeout(r, 0));
    if (this.o.foe) {
      this.planning = true;
      this.plans.push(planTurnAsync(m, 1, this.o.foe, { tick }).then((p) => { if (!this.destroyed) applyPlan(m, 1, p); }));
    }
    if (this.o.you) this.plans.push(planTurnAsync(m, 0, this.o.you, { tick }).then((p) => { if (!this.destroyed) applyPlan(m, 0, p); }));
    void Promise.all(this.plans).then(() => {
      this.planning = false;
      if (this.destroyed) return;
      this.refreshHud();
      if (this.watch) setTimeout(() => void this.fight(), 900);
    });
    this.refreshHud();
  }

  /** Pin the sheets this fight draws (every body at its rank, and what it spawns at tier 1) so the sheet budget never
   *  evicts them mid-battle (sprites.ts preload). */
  private pinBattle() {
    const b = this.battle;
    if (!b) return;
    for (const side of [0, 1] as const) {
      const byRank = new Map<number, Set<string>>();
      const add = (rank: number, kind: string) => { if (!byRank.has(rank)) byRank.set(rank, new Set()); byRank.get(rank)!.add(kind); };
      for (const bd of b.bodies) {
        if (bd.side !== side) continue;
        add(bd.rank, bd.kind);
        for (const k of Object.keys(BODY_EXTRA) as SpawnKind[]) if (BODY_EXTRA[k].from === bd.kind) add(1, k);
      }
      for (const [rank, kinds] of byRank) preload([...kinds], side, [rank]);
    }
  }

  private async fight() {
    if (this.phase !== "deploy" || this.paused) return;
    unlockAudio();
    this.closePop();
    this.pickSlot = null;
    this.h.fight.disabled = true;
    await Promise.all(this.plans);
    if (this.destroyed || this.phase !== "deploy") return;
    const m = this.match;
    const seen = new Set(m.sides[1].seen.map((p) => p.id));
    this.view.markReveal(m.sides[1].pieces.filter((p) => !seen.has(p.id)).map((p) => p.id));
    this.battle = m.makeBattle(true);
    this.pinBattle();
    this.phase = "battle";
    this.acc = 0;
    // A beat to see what the rival added before the clash starts.
    const fresh = new Set(m.sides[1].pieces.filter((p) => !seen.has(p.id)).map((p) => p.id));
    // The rival's new pieces drop in (one landing per piece; a pack's bodies fall together).
    const landed = new Set<number>();
    for (const b of this.battle.bodies) {
      if (b.side !== 1 || !fresh.has(b.pieceId) || b.hidden || landed.has(b.pieceId)) continue;
      landed.add(b.pieceId);
      this.view.dropIn([{ id: b.pieceId, x: b.x, y: b.y, radius: b.pack === b.pieceId ? 0.5 : b.radius, side: 1 }]);
    }
    this.hold = fresh.size && !this.watch ? 0.75 : 0.25;
    sfx("fight");
    buzz("medium");
    this.showBanner("Fight!", "", "fight", 700);
    this.refreshHud();
  }

  private reroll() {
    if (this.phase !== "deploy" || this.watch || !this.match.canReroll(0)) { sfx("deny"); return; }
    this.match.reroll(0);
    this.pickSlot = null;
    sfx("reroll");
    buzz("light");
    this.refreshHud();
  }

  private skipBattle() {
    if (this.phase !== "battle" || !this.battle) return;
    while (!this.battle.done) { this.battle.step(); this.battle.events.length = 0; }
    this.view.fx.clear();
  }

  private toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    save((s) => { s.settings.speed = this.speed; });
    this.refreshHud();
  }

  private finishBattle() {
    const b = this.battle!;
    const rep = this.match.resolve(b.result());
    this.phase = this.match.phase === "over" ? "over" : "result";
    this.showRound(rep);
  }

  private showRound(rep: RoundReport) {
    const won = rep.winner === 0, lost = rep.winner === 1;
    const head = won ? "Round won" : lost ? "Round lost" : "Draw";
    const dmgFoe = rep.damage[1], dmgYou = rep.damage[0];
    const dmg = (n: number, who: "foe" | "you") => el("span", { class: `dmg ${who}` }, [icon("shield"), `-${n}`]);
    const detail = [...(dmgFoe ? [dmg(dmgFoe, "foe")] : []), ...(dmgYou ? [dmg(dmgYou, "you")] : [])];
    this.showBanner(head, detail, won ? "won" : lost ? "lost" : "draw", 1500);
    sfx(won ? "round" : lost ? "hurt" : "tap", 1);
    const to: [number, number] = [this.match.sides[0].hp, this.match.sides[1].hp];
    if (this.battle && rep.damage.some((d) => d > 0)) {
      // The survivors march on the losing keep; the bars drain only once the first blow lands (see frame()).
      const a = this.view.startAssault(this.battle, rep.damage, this.watch ? 0.6 : 0.9);
      this.assault = { a, from: [...this.hpShown], to, hit: [false, false], leaving: false };
      return;
    }
    this.hpShown = to;
    this.trail = [...to];
    this.refreshHud();
    setTimeout(() => this.afterRound(), this.watch ? 1200 : 1500);
  }

  /** The assault's clock: the hit lands, then the bar, the number and the keep move together. */
  private stepAssault(dt: number) {
    const st = this.assault!, a = st.a;
    this.view.updateAssault(dt * (this.speed > 1 ? 1.4 : 1));
    for (const side of [0, 1] as Side[]) {
      if (st.hit[side] || a.t < a.hitAt[side]) continue;
      st.hit[side] = true;
      if (st.to[side] < st.from[side]) {
        const hp = (side === 0 ? this.h.youHp : this.h.foeHp).parentElement!;
        hp.classList.remove("hit"); void hp.offsetWidth; hp.classList.add("hit");
      }
      if (side === 0) {
        buzz("heavy");
        this.root.classList.add("hurt");
        setTimeout(() => this.root.classList.remove("hurt"), 500);
      } else buzz("medium");
    }
    const shown: [number, number] = [0, 1].map((s) => st.from[s] + (st.to[s] - st.from[s]) * a.drain(s as Side)) as [number, number];
    if (shown[0] !== this.hpShown[0] || shown[1] !== this.hpShown[1]) {
      this.hpShown = shown;
      this.refreshHud();
    }
    if (a.over && !st.leaving) {
      st.leaving = true;
      this.hpShown = [...st.to];
      this.refreshHud();
      // The light damage trail drains after the bar.
      const to = st.to;
      setTimeout(() => { if (this.destroyed) return; this.trail = [...to]; this.refreshHud(); }, 250);
      this.afterRound();
    }
  }

  private afterRound() {
    if (this.destroyed) return;
    if (this.match.phase === "over") {
      sfx(this.match.winner === 0 ? "win" : "lose");
      buzz(this.match.winner === 0 ? "success" : "error");
      this.o.onEnd(this.match);
    } else {
      this.match.next();
      this.startDeploy();
    }
  }

  // ------------------------------------------------------------ frame
  private frame = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (!this.paused) {
      if (this.phase === "battle" && this.battle && this.hold > 0) this.hold -= dt;
      else if (this.phase === "battle" && this.battle) {
        const slow = this.battle.done ? 0.35 : 1;
        if (!this.view.hitStopping) this.acc += dt * this.speed * slow; // JUICE: a hit-stop holds the sim too
        while (this.acc >= DT && !this.battle.done) {
          this.battle.step();
          this.view.consume(this.battle);
          this.acc -= DT;
        }
        this.updateTally();
        if (this.battle.done) {
          this.endT += dt;
          if (this.endT > END_BEAT) { this.endT = 0; this.finishBattle(); }
        }
      } else if (this.assault && (this.phase === "result" || this.phase === "over")) this.stepAssault(dt);
      this.view.update(dt * (this.phase === "battle" ? Math.min(this.speed, 2) : 1));
    }
    this.view.render(this.scene());
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Troops standing per side (as the battle result counts them: no mines, decoys or turrets). */
  private updateTally() {
    const n = [0, 0];
    for (const b of this.battle!.bodies) if (b.alive && b.kind !== "mine" && b.kind !== "decoy" && b.kind !== "turret") n[b.side]++;
    for (const s of [0, 1] as const) {
      const t = this.h.tally[s], v = String(n[s]);
      if (t.textContent === v) continue;
      t.textContent = v;
      t.parentElement!.classList.remove("hit"); void t.offsetWidth; t.parentElement!.classList.add("hit");
    }
  }

  private scene(): Scene {
    if ((this.phase === "battle" || ((this.phase === "result" || this.phase === "over") && this.battle)) && this.battle)
      return { mode: "battle", battle: this.battle, alpha: Math.min(1, this.acc / DT) };
    const m = this.match;
    const theirs = this.o.mode === "puzzle" || this.watch ? m.sides[1].pieces : m.sides[1].seen;
    return {
      mode: "deploy",
      pieces: [...m.sides[0].pieces, ...theirs],
      showEnemyMines: this.o.showEnemyMines,
      ghost: this.ghost ?? undefined,
      selected: this.selected ?? undefined,
      zone: this.ghost || this.drag?.type === "piece" && this.drag.moved ? 0 : null,
    };
  }

  // ------------------------------------------------------------ input
  private bindInput() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this.boardDown(e));
    window.addEventListener("pointermove", this.move);
    window.addEventListener("pointerup", this.up);
    window.addEventListener("pointercancel", this.up);
    this.h.shop.addEventListener("pointerdown", (e) => {
      const card = (e.target as HTMLElement).closest(".card") as HTMLElement | null;
      if (!card) return;
      unlockAudio();
      const slot = Number(card.dataset.slot);
      const kind = this.match.sides[0].shop[slot];
      if (!kind) return;
      e.preventDefault();
      this.drag = { type: "card", slot, sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
      clearTimeout(this.tipTimer);
      this.tipTimer = window.setTimeout(() => { if (this.drag && !this.drag.moved) this.showTip(kind, card); }, 380);
    });
  }

  private pieceAt(x: number, y: number, side: Side): Piece | undefined {
    const m = this.match;
    const list = side === 0 ? m.sides[0].pieces : this.o.mode === "puzzle" ? m.sides[1].pieces : m.sides[1].seen;
    let best: Piece | undefined, bd = Infinity;
    for (const p of list) {
      if (side === 1 && p.kind === "mine" && !this.o.showEnemyMines) continue;
      const r = (p.kind === "blades" ? 0.62 : UNITS[p.kind].radius) + 0.3;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < r && d < bd) { bd = d; best = p; }
    }
    return best;
  }

  private boardDown(e: PointerEvent) {
    unlockAudio();
    if (this.phase !== "deploy" || this.watch || this.paused) return;
    const w = this.view.toWorld(e.clientX, e.clientY);
    // Figures stand up off the ground: a tap on the body (not just the feet) picks it.
    const up = this.view.toWorldAt(e.clientX, e.clientY, 0.35);
    const mine = this.pieceAt(w.x, w.y, 0) ?? this.pieceAt(up.x, up.y, 0);
    if (mine) {
      this.drag = { type: "piece", id: mine.id, sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
      return;
    }
    if (this.pickSlot !== null) {
      this.tryBuy(this.pickSlot, w.x, w.y, e.clientX, e.clientY);
      return;
    }
    const theirs = this.pieceAt(w.x, w.y, 1) ?? this.pieceAt(up.x, up.y, 1);
    if (theirs) { this.openPop(theirs); return; }
    this.selected = null;
    this.closePop();
  }

  private move = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (!d.moved && dist > 8) {
      d.moved = true; clearTimeout(this.tipTimer); this.hideTip(); this.closePop();
      if (d.type === "card") (this.h.shop.children[d.slot!] as HTMLElement | undefined)?.classList.add("dragging");
    }
    if (!d.moved) return;
    // Lift the preview above the finger so it stays visible.
    const lift = e.pointerType === "touch" ? 46 : 0;
    const w = this.view.toWorld(e.clientX, e.clientY - lift);
    if (d.type === "card") {
      const kind = this.match.sides[0].shop[d.slot!];
      if (!kind) return;
      const ok = inZone(0, w.x, w.y) && !this.match.canBuy(0, d.slot!);
      // Show the ghost exactly where the sim will place it (buy clamps into the zone by the unit's radius).
      const at = ok ? clampToZone(0, w.x, w.y, UNITS[kind].radius) : w;
      this.ghost = { kind, x: at.x, y: at.y, ok };
    } else {
      try { this.match.move(0, d.id!, w.x, w.y); } catch { /* not now */ }
      this.selected = d.id!;
    }
  };

  private up = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    this.drag = null;
    clearTimeout(this.tipTimer);
    this.hideTip();
    if (d.type === "card") (this.h.shop.children[d.slot!] as HTMLElement | undefined)?.classList.remove("dragging");
    if (d.type === "card") {
      if (d.moved && this.ghost) {
        const g = this.ghost;
        this.ghost = null;
        if (g.ok) this.tryBuy(d.slot!, g.x, g.y, e.clientX, e.clientY);
        else if (this.view.toWorld(e.clientX, e.clientY).y < 14) { sfx("deny"); }
      } else if (!d.moved) {
        // Tap: pick the card, then tap the board to place it.
        const why = this.match.canBuy(0, d.slot!);
        if (why) { this.flashStatus(why); sfx("deny"); }
        else { this.pickSlot = this.pickSlot === d.slot ? null : d.slot!; sfx("tap"); }
        this.refreshHud();
      }
      return;
    }
    if (d.moved) { sfx("place", 0.6); buzz("light"); this.selected = null; this.refreshHud(); return; }
    // Tap on own piece: upgrade / sell popover.
    const p = this.match.sides[0].pieces.find((x) => x.id === d.id);
    if (p) { this.selected = p.id; this.openPop(p); sfx("tap"); }
  };

  private tryBuy(slot: number, x: number, y: number, sx?: number, sy?: number) {
    const why = this.match.canBuy(0, slot);
    if (why) { this.flashStatus(why); sfx("deny"); return; }
    if (!inZone(0, x, y)) { this.flashStatus("Place it in your half"); sfx("deny"); return; }
    const p = this.match.buy(0, slot, x, y);
    this.spendFx(slot, sx, sy);
    this.view.dropIn([{ id: p.id, x: p.x, y: p.y, radius: p.kind === "blades" ? 0.5 : UNITS[p.kind].radius, side: p.side }]);
    sfx("buy"); sfx("place");
    buzz("light");
    this.pickSlot = null;
    this.refreshHud();
  }

  private flashStatus(text: string) {
    this.h.status.firstElementChild!.textContent = text;
    this.h.status.classList.remove("flash"); void this.h.status.offsetWidth; this.h.status.classList.add("flash");
  }

  // ------------------------------------------------------------ popover & tips
  private openPop(p: Piece) {
    const pop = this.h.pop;
    const def = UNITS[p.kind];
    const own = p.side === 0;
    const m = this.match;
    pop.replaceChildren();
    pop.className = `pop ${own ? "own" : "theirs"} rank-${p.rank}`;
    const face = framedPortrait(p.kind, p.rank, "pop-portrait").frame;
    const level = levelOf(m.cfg.levels?.[p.side], p.kind);
    pop.append(el("div", { class: "pop-top" }, [
      face,
      el("div", { class: "pop-id" }, [
        el("div", { class: "pop-head" }, [el("b", {}, [def.name]), el("span", { class: "pop-rank" }, [TIER_NAMES[p.rank - 1] ?? ""])]),
        el("span", { class: "role-line" }, [roleBadge(def.role), ROLE_LABEL[def.role], el("span", { class: "pop-lv" }, [`Lv ${level}`])]),
        el("div", { class: "pop-text" }, [def.short]),
      ]),
    ]));
    pop.append(el("div", { class: "pop-stats" }, [statsLine(p.kind, p.rank, level, m.sides[p.side].mods)]));
    const ab = abilityOf(p.kind);
    if (ab && (p.rank >= 3 || !own)) pop.append(el("div", { class: `pop-ability ${p.rank >= 4 ? "on" : ""}` }, [el("b", {}, [ab.name]), " ", ab.text]));
    if (own && this.phase === "deploy") {
      const why = m.canUpgrade(0, p.id);
      const ascend = p.rank === 3;
      // The price rides on a coin, which turns red when the purse is short (the button only dims a touch).
      const label: (Node | string)[] = p.rank >= 4 ? ["Ascended"] : [ascend ? "Ascend" : "Rank up", coin(upgradeCost(p.kind, p.rank), "up-cost")];
      const poor = why === "Need gold";
      const up = el("button", { class: `btn small up ${ascend ? "ascend" : ""} ${poor ? "poor" : ""}` }, why && !poor && p.rank < 4 ? [why] : label) as HTMLButtonElement;
      up.disabled = !!why;
      up.addEventListener("click", () => {
        if (m.canUpgrade(0, p.id)) return;
        m.upgrade(0, p.id);
        // Close the card so the evolution plays on the board.
        this.closePop();
        this.selected = null;
        this.evolve(p);
        this.refreshHud();
      });
      const sell = el("button", { class: "btn small sell" }, ["Sell", coin(`+${m.sellValue(p)}`, "up-cost sell-cost")]) as HTMLButtonElement;
      sell.addEventListener("click", () => {
        m.sell(0, p.id);
        sfx("sell");
        this.view.fx.burst(p.x, p.y, 10, { color: "#ffd166", speed: 1.4, size: 0.07, max: 0.5, kind: "chunk", vz: 2 });
        this.selected = null;
        this.closePop();
        this.refreshHud();
      });
      pop.append(el("div", { class: "pop-actions" }, [up, sell]));
    }
    const at = this.view.toScreen(p.x, p.y), sx = at.x, sy = at.y;
    pop.classList.remove("hidden");
    const r = pop.getBoundingClientRect();
    const x = Math.max(8, Math.min(window.innerWidth - r.width - 8, sx - r.width / 2));
    const above = sy - r.height - 30;
    const isAbove = above > this.view.rect.y;
    const y = isAbove ? above : sy + 32;
    pop.classList.toggle("below", !isAbove);
    pop.style.setProperty("--ax", `${Math.max(22, Math.min(r.width - 22, sx - x))}px`);
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
  }

  /** The look changes with the rank: a flash, a burst and the new tier's name. */
  private evolve(p: Piece) {
    const fx = this.view.fx;
    const ascended = p.rank >= 4;
    const col = ascended ? "#fff2b8" : "#ffd166";
    this.view.markEvolve(p.id);
    fx.ring(p.x, p.y, 0.1, ascended ? 1.6 : 1.0, ascended ? 0.6 : 0.4, col, ascended ? 0.09 : 0.06, ascended ? "rgba(255,230,150,0.25)" : undefined);
    fx.burst(p.x, p.y, ascended ? 30 : 14, { color: col, speed: ascended ? 3 : 2, size: 0.06, max: 0.6, kind: "spark", gravity: 0 });
    if (ascended) { fx.flash = 0.3; fx.flashColor = "#fff2b8"; fx.shake = 0.3; }
    sfx("upgrade");
    buzz(ascended ? "heavy" : "medium");
    const ab = abilityOf(p.kind);
    this.showBanner(TIER_NAMES[p.rank - 1], `${UNITS[p.kind].name}${ascended && ab ? " · " + ab.name : ""}`, ascended ? "ascend" : "evolve", 1100);
  }

  private closePop() {
    this.h.pop.classList.add("hidden");
  }

  private showTip(kind: UnitKind, card: HTMLElement) {
    const d = UNITS[kind];
    const tip = this.h.tip;
    tip.innerHTML = `<b>${d.name}</b><span>${d.short}</span><em>${statsLine(kind, 1, levelOf(this.match.cfg.levels?.[0], kind), this.match.sides[0].mods)}</em>`;
    tip.classList.remove("hidden");
    const r = card.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2))}px`;
    tip.style.top = `${r.top - tr.height - 10}px`;
  }
  private hideTip() { this.h.tip.classList.add("hidden"); }

  // ------------------------------------------------------------ pause
  private openMenu() {
    this.paused = true;
    const s = load().settings;
    const m = this.h.menu;
    const mt = this.match, you = mt.sides[0], foe = mt.sides[1];
    const toggle = (name: string, on: boolean, fn: () => void) => {
      const b = button("", `ghost toggle ${on ? "on" : ""}`, fn);
      b.replaceChildren(el("span", {}, [name]), el("i", { class: "switch" }, [el("b")]));
      b.setAttribute("aria-pressed", String(on));
      return b;
    };
    // The score so far: both keeps' health, the round, and what's at stake.
    const side = (cls: string, name: string, hp: number, max: number) => el("div", { class: `pause-side ${cls}` }, [
      el("span", { class: "pause-name" }, [name]),
      el("div", { class: `hpbar ${cls}` }, [el("b", { style: `width:${Math.max(0, (hp / max) * 100)}%` }), el("i", { style: `width:${Math.max(0, (hp / max) * 100)}%` }), el("span", {}, [String(Math.max(0, Math.round(hp)))])]),
    ]);
    m.replaceChildren(el("div", { class: "sheet pause-sheet" }, [
      ribbon("Paused"),
      el("div", { class: "pause-info" }, [
        el("div", { class: "pause-title" }, [el("b", {}, [this.o.title ?? "Battle"]), el("span", {}, [this.o.mode === "puzzle" ? "Breakpoint" : `Round ${mt.round}`])]),
        side("you", "You", this.hpShown[0], you.maxHp),
        side("foe", foe.name, this.hpShown[1], foe.maxHp),
      ]),
      button("Resume", "primary big", () => this.closeMenu()),
      el("div", { class: "pause-row" }, [
        ...(this.o.onRestart ? [button("Restart", "", () => { this.closeMenu(); this.o.onRestart!(); })] : []),
        button("Quit", "danger", () => { this.closeMenu(); this.o.onQuit(); }),
      ]),
      el("div", { class: "pause-row toggles" }, [
        toggle("Sound", s.sound, () => { save((x) => { x.settings.sound = !x.settings.sound; }); import("../audio/sfx").then((a) => a.setSound(load().settings.sound)); this.openMenu(); }),
        toggle("Haptics", s.haptics, () => { save((x) => { x.settings.haptics = !x.settings.haptics; }); import("../native").then((n) => n.setHaptics(load().settings.haptics)); this.openMenu(); }),
      ]),
    ]));
    m.classList.remove("hidden");
  }
  private closeMenu() {
    this.paused = false;
    this.lastT = performance.now();
    this.h.menu.classList.add("hidden");
  }
}

/** A unit's health and damage at a rank and troop level, with its side's modifiers, as the battle builds them. */
export function unitStats(kind: UnitKind, rank = 1, level = 1, mods?: Defs.Mods) {
  const d = UNITS[kind];
  const hpMul = (mods?.hpMul ?? 1) * (mods?.kindHp?.[kind] ?? 1);
  const dmgMul = (mods?.dmgMul ?? 1) * (mods?.kindDmg?.[kind] ?? 1);
  return {
    hp: Math.round(d.hp * Defs.rankHp(rank) * hpMul * levelHp(level)) * (d.bodies ?? 1),
    dmg: d.dmg * Defs.rankDmg(rank) * dmgMul * levelDmg(level),
  };
}

export function statsLine(kind: UnitKind, rank = 1, level = 1, mods?: Defs.Mods) {
  const d = UNITS[kind];
  const st = unitStats(kind, rank, level, mods);
  const parts = [`${st.hp} hp`];
  if (d.dmg) parts.push(`${fmt(Math.round(st.dmg * 10) / 10)} dmg${d.bodies ? " each" : ""}`);
  if (d.range >= 1.5) parts.push(`range ${fmt(d.range)}`);
  if (d.speed) parts.push(d.speed >= 2.2 ? "fast" : d.speed <= 1 ? "slow" : "steady");
  else parts.push("fixed");
  return parts.join(" · ");
}

function button(label: string, cls: string, fn: () => void) {
  const b = el("button", { class: `btn ${cls}` }, label ? [label] : []);
  b.addEventListener("click", () => { sfx("tap"); fn(); });
  return b;
}
