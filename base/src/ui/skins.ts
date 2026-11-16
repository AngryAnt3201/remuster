// [skins] Keep skins: the picker for the Army screen (skinPicker) and the gem shelf for the Shop (skinShop).
// Cosmetic only: the sim never reads them. Ownership and the equipped skin live in src/progression/cosmetics.ts;
// the art is public/keeps/skins/<name>/<state>.webp (art/keeps/render_keeps.py --skin <name>), drawn by the board
// for the player's keep (src/render/board.ts, src/render/keeps.ts).
import "./skins.css";
import { sfx } from "../audio/sfx";
import { buzz } from "../native";
import { GEM_NAME } from "@engine/economy/gems";
import { canAfford, earn, onWalletChange, spend, spendIn, wallet, type WalletSave } from "@engine/economy/wallet";
import {
  DEFAULT_KEEP, KEEP_SKINS, equip, equipped, grantCosmetic, grantIn, onCosmeticsChange, ownsCosmetic,
  type CosmeticsSave, type KeepSkin,
} from "@engine/progression/cosmetics";
import { KEEP_STATES, keepSkinUrl, setKeepStateDebug, type KeepState } from "../render/keeps";
import { gemIcon } from "./currency";
import { el } from "./dom";

// ---------------------------------------------------------------- catalogue (pure)

export type SkinSource = "default" | "gems" | "pass";
export interface SkinInfo {
  id: KeepSkin;
  name: string;
  blurb: string;
  source: SkinSource;
  /** Gem price, for skins sold in the Shop. */
  price?: number;
  /** UI accent (preview glow, confetti). */
  accent: string;
  accent2: string;
}

/**
 * Gem prices. The ladder: the Sack (450 gems, $4.99) plus a little free play buys Frost; the Coffer (1000 gems,
 * $9.99) buys any one skin with change. Free play pays about 4 gems a 3-star level or Daily win and 20 a boss, so 500
 * is a long-term goal a committed free player reaches, not an impulse buy. Each step up adds more to the keep:
 * Frost is a palette and snow; Ember adds lava light and braziers; Shadow adds glowing lanterns and wisps (the most
 * light effects), so it costs the most. Gilded and Blossom are War Pass rewards and are never sold for gems.
 */
export const SKIN_PRICES: Partial<Record<KeepSkin, number>> = { "keep:frost": 500, "keep:ember": 700, "keep:shadow": 900 };

export const SKIN_INFO: Record<KeepSkin, SkinInfo> = {
  "keep:meadow": { id: "keep:meadow", name: "Meadow Keep", blurb: "Sunlit stone and a sea-green roof. Where every warlord starts.", source: "default", accent: "#36b5a8", accent2: "#ffcf4d" },
  "keep:frost": { id: "keep:frost", name: "Frost Keep", blurb: "Ice-blue stone under deep snow, icicles on every ledge.", source: "gems", price: SKIN_PRICES["keep:frost"], accent: "#7cd3ff", accent2: "#ffffff" },
  "keep:ember": { id: "keep:ember", name: "Ember Keep", blurb: "Black basalt split by molten seams, ringed with lava and braziers.", source: "gems", price: SKIN_PRICES["keep:ember"], accent: "#ff7a1f", accent2: "#ffd36b" },
  "keep:shadow": { id: "keep:shadow", name: "Shadow Keep", blurb: "Violet-black stone lit by ghost lanterns and drifting wisps.", source: "gems", price: SKIN_PRICES["keep:shadow"], accent: "#8a5cff", accent2: "#7dffd0" },
  "keep:gilded": { id: "keep:gilded", name: "Gilded Keep", blurb: "White marble, a gold crown and royal banners. The War Pass prize.", source: "pass", accent: "#ffcf3f", accent2: "#3b5bd6" },
  "keep:blossom": { id: "keep:blossom", name: "Blossom Keep", blurb: "Pale stone under cherry trees, petals on every step.", source: "pass", accent: "#ff9cc2", accent2: "#fff0f6" },
};

/** Display order: the default, the gem skins cheapest first, then the War Pass rewards. */
export const SKIN_ORDER: KeepSkin[] = ["keep:meadow", "keep:frost", "keep:ember", "keep:shadow", "keep:gilded", "keep:blossom"];

export const skinPrice = (id: string): number | null => SKIN_PRICES[id as KeepSkin] ?? null;

/** How a locked skin is got, in a few words. */
export function howToGet(id: KeepSkin): string {
  const i = SKIN_INFO[id];
  if (i.source === "default") return "Yours from the start";
  if (i.source === "pass") return "War Pass reward";
  return `${i.price} ${GEM_NAME} in the Shop`;
}

export type BuyResult = "ok" | "owned" | "not-for-sale" | "short";

/** Buys a skin for gems on save-shaped objects: takes the gems and grants the skin, or changes nothing. */
export function buySkinIn(w: WalletSave, c: CosmeticsSave, id: string): BuyResult {
  if (c.owned.includes(id)) return "owned";
  const price = skinPrice(id);
  if (price == null) return "not-for-sale";
  if (w.gems < price) return "short";
  if (!spendIn(w, "gems", price)) return "short";
  grantIn(c, id);
  return "ok";
}

/** Buys a skin for gems on the device save. */
export function buySkin(id: KeepSkin): BuyResult {
  if (ownsCosmetic(id)) return "owned";
  const price = skinPrice(id);
  if (price == null) return "not-for-sale";
  if (!canAfford("gems", price)) return "short";
  if (!spend("gems", price, `skin:${id}`)) return "short";
  if (!grantCosmetic(id, "gems")) { earn("gems", price, `skin:${id}:refund`); return "owned"; }
  return "ok";
}

// ---------------------------------------------------------------- shared bits

/** Re-renders `root` whenever ownership, the equipped skin or (optionally) the wallet changes, until it is detached. */
function live(root: HTMLElement, draw: () => void, gems = false) {
  const offs: (() => void)[] = [];
  const tick = () => {
    if (!root.isConnected && root.dataset.seen) { offs.forEach((f) => f()); return; }
    if (root.isConnected) root.dataset.seen = "1";
    draw();
  };
  offs.push(onCosmeticsChange(tick));
  if (gems) offs.push(onWalletChange(tick));
}

/** A keep image that falls back to the default keep if the skin's art fails to load. */
function keepImg(id: KeepSkin, state: KeepState = "intact", cls = "skn-img"): HTMLImageElement {
  const img = document.createElement("img");
  img.className = cls;
  img.alt = SKIN_INFO[id].name;
  img.decoding = "async";
  img.draggable = false;
  img.onerror = () => {
    const fb = keepSkinUrl(DEFAULT_KEEP, state);
    if (!img.src.endsWith(fb.replace(/^\.\//, ""))) { img.dataset.fallback = "1"; img.src = fb; }
  };
  img.src = keepSkinUrl(id, state);
  return img;
}

function burst(host: HTMLElement, colors: string[], n = 18) {
  const box = el("div", { class: "skn-burst", "aria-hidden": "true" });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, d = 70 + Math.random() * 70;
    const p = el("i", {});
    p.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    p.style.setProperty("--dy", `${Math.sin(a) * d - 30}px`);
    p.style.setProperty("--r", `${Math.round(Math.random() * 540 - 270)}deg`);
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 60}ms`;
    box.append(p);
  }
  host.append(box);
  setTimeout(() => box.remove(), 1200);
}

/** The keep on a little grass plinth: bobbing, with a light sweep over it. Tapping it shows the damage states. */
function stage(): { root: HTMLElement; show: (id: KeepSkin) => void; celebrate: () => void } {
  const root = el("div", { class: "skn-stage", role: "img" });
  const rays = el("div", { class: "skn-rays", "aria-hidden": "true" });
  const ground = el("div", { class: "skn-ground", "aria-hidden": "true" });
  const bob = el("div", { class: "skn-bob" });
  const shine = el("div", { class: "skn-shine", "aria-hidden": "true" });
  const dots = el("div", { class: "skn-dots", "aria-hidden": "true" }, KEEP_STATES.map(() => el("i", {})));
  const tag = el("div", { class: "skn-tag", "aria-hidden": "true" }, ["Equipped!"]);
  let id: KeepSkin = DEFAULT_KEEP, si = 0, img: HTMLImageElement | null = null;
  const draw = () => {
    const state = KEEP_STATES[si];
    const next = keepImg(id, state, "skn-img");
    if (img) img.replaceWith(next); else bob.prepend(next);
    img = next;
    const url = next.src;
    shine.style.setProperty("-webkit-mask-image", `url("${url}")`);
    shine.style.setProperty("mask-image", `url("${url}")`);
    root.style.setProperty("--acc", SKIN_INFO[id].accent);
    root.style.setProperty("--acc2", SKIN_INFO[id].accent2);
    root.setAttribute("aria-label", `${SKIN_INFO[id].name}, ${state}`);
    dots.querySelectorAll("i").forEach((d, i) => d.classList.toggle("on", i === si));
  };
  bob.append(shine);
  root.append(rays, ground, bob, dots, tag);
  root.addEventListener("click", () => { si = (si + 1) % KEEP_STATES.length; sfx("tap"); draw(); root.classList.remove("skn-hit"); void root.offsetWidth; root.classList.add("skn-hit"); });
  return {
    root,
    show(next) { if (next !== id) { id = next; si = 0; draw(); root.classList.remove("skn-swap"); void root.offsetWidth; root.classList.add("skn-swap"); } else if (!img) draw(); },
    celebrate() {
      si = 0; draw();
      root.classList.remove("skn-equip"); void root.offsetWidth; root.classList.add("skn-equip");
      burst(root, [SKIN_INFO[id].accent, SKIN_INFO[id].accent2, "#ffffff"]);
    },
  };
}

// ---------------------------------------------------------------- the picker (Army screen)

export interface SkinPickerOpts {
  /** When given, locked gem skins get a button that opens the Shop. */
  onShop?: () => void;
}

/** The keep skin picker: a live preview, the skins you own with Equip, and the locked ones with how to get them. */
export function skinPicker(opts: SkinPickerOpts = {}): HTMLElement {
  const root = el("section", { class: "skn-picker", "data-skins": "picker" });
  const st = stage();
  const name = el("h3", { class: "skn-name" });
  const blurb = el("p", { class: "skn-blurb" });
  const action = el("div", { class: "skn-action" });
  const count = el("span", { class: "skn-count" });
  const grid = el("div", { class: "skn-grid", role: "listbox", "aria-label": "Keep skins" });
  root.append(
    el("header", { class: "skn-head" }, [el("h2", {}, ["Keep Skins"]), count]),
    el("div", { class: "skn-hero" }, [st.root, el("div", { class: "skn-info" }, [name, blurb, action])]),
    grid,
  );
  let sel = equipped("keep") as KeepSkin;
  if (!SKIN_INFO[sel]) sel = DEFAULT_KEEP;

  const draw = () => {
    const on = equipped("keep");
    const owned = SKIN_ORDER.filter((id) => ownsCosmetic(id));
    count.textContent = `${owned.length}/${SKIN_ORDER.length}`;
    const info = SKIN_INFO[sel];
    st.show(sel);
    name.textContent = info.name;
    blurb.textContent = info.blurb;
    action.replaceChildren();
    if (on === sel) {
      action.append(el("button", { class: "btn small ghost skn-on", disabled: "" }, ["Equipped"]));
    } else if (ownsCosmetic(sel)) {
      const b = el("button", { class: "btn small primary skn-equip-btn" }, ["Equip"]);
      b.addEventListener("click", () => {
        if (!equip("keep", sel)) { sfx("deny"); return; }
        sfx("upgrade"); buzz("success");
        st.celebrate();
      });
      action.append(b);
    } else if (info.source === "gems" && opts.onShop) {
      const b = el("button", { class: "btn small gold skn-shop-btn" }, [gemIcon(), el("span", {}, [`${info.price} in Shop`])]);
      b.addEventListener("click", () => { sfx("tap"); opts.onShop!(); });
      action.append(b);
    } else {
      action.append(el("div", { class: `skn-lock skn-src-${info.source}` }, [lockGlyph(), el("span", {}, [howToGet(sel)])]));
    }
    grid.replaceChildren(...SKIN_ORDER.map((id) => tile(id, id === sel, on === id)));
  };
  const tile = (id: KeepSkin, picked: boolean, on: boolean) => {
    const info = SKIN_INFO[id], own = ownsCosmetic(id);
    const t = el("button", { class: `skn-tile${picked ? " picked" : ""}${own ? "" : " locked"}${on ? " on" : ""}`, role: "option", "aria-selected": String(picked), "data-skin": id });
    t.style.setProperty("--acc", info.accent);
    const foot = on ? el("span", { class: "skn-badge on" }, ["Equipped"])
      : own ? el("span", { class: "skn-badge" }, ["Owned"])
      : info.source === "gems" ? el("span", { class: "skn-badge price" }, [gemIcon(), String(info.price)])
      : el("span", { class: "skn-badge pass" }, ["War Pass"]);
    t.append(el("span", { class: "skn-thumb" }, [keepImg(id, "intact", "skn-timg")]), el("span", { class: "skn-tname" }, [info.name.replace(" Keep", "")]), foot);
    if (!own) t.append(el("span", { class: "skn-padlock", "aria-hidden": "true" }, [lockGlyph()]));
    t.addEventListener("click", () => { if (sel === id) return; sel = id; sfx("tap"); draw(); });
    return t;
  };
  draw();
  live(root, draw);
  return root;
}

function lockGlyph() {
  const s = document.createElement("span");
  s.className = "skn-lock-ico";
  s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a5 5 0 0 1 10 0V10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="currentColor"/></svg>`;
  return s;
}

// ---------------------------------------------------------------- the Shop shelf

/** The Shop's keep skin shelf: Frost, Ember and Shadow for gems (tap, then tap again to confirm); Gilded and
 *  Blossom show as War Pass rewards. Owned skins offer Equip. */
export function skinShop(): HTMLElement {
  const root = el("section", { class: "skn-shop", "data-skins": "shop" });
  const shelf = el("div", { class: "skn-shelf" });
  const note = el("p", { class: "skn-note", role: "status" });
  root.append(el("header", { class: "skn-head" }, [el("h2", {}, ["Keep Skins"]), el("span", { class: "skn-sub" }, ["Looks only. Never power."])]), shelf, note);
  let confirm: KeepSkin | null = null, confirmT = 0, fresh: KeepSkin | null = null;
  const say = (t: string, warn = false) => { note.textContent = t; note.classList.toggle("warn", warn); };

  const draw = () => {
    const on = equipped("keep");
    shelf.replaceChildren(...SKIN_ORDER.filter((id) => id !== DEFAULT_KEEP).map((id) => {
      const info = SKIN_INFO[id], own = ownsCosmetic(id);
      const card = el("article", { class: `skn-card skn-${info.source}${own ? " owned" : ""}${fresh === id ? " skn-bought" : ""}`, "data-skin": id });
      card.style.setProperty("--acc", info.accent);
      card.style.setProperty("--acc2", info.accent2);
      const art = el("div", { class: "skn-card-art" }, [el("div", { class: "skn-card-bob" }, [keepImg(id, "intact", "skn-cimg")])]);
      if (info.source === "pass") art.append(el("span", { class: "skn-ribbon" }, ["War Pass"]));
      const foot = el("div", { class: "skn-card-foot" });
      if (own) {
        if (on === id) foot.append(el("span", { class: "skn-badge on" }, ["Equipped"]));
        else {
          const b = el("button", { class: "btn small primary" }, ["Equip"]);
          b.addEventListener("click", () => { if (equip("keep", id)) { sfx("upgrade"); buzz("success"); say(`${info.name} equipped.`); burst(card, [info.accent, info.accent2, "#fff"], 14); } });
          foot.append(el("span", { class: "skn-badge" }, ["Owned"]), b);
        }
      } else if (info.source === "pass") {
        foot.append(el("span", { class: "skn-lock skn-src-pass" }, [lockGlyph(), el("span", {}, ["War Pass reward"])]));
      } else {
        const asking = confirm === id && performance.now() - confirmT < 3500;
        const short = !canAfford("gems", info.price!);
        const b = el("button", { class: `btn small gold skn-buy${asking ? " confirm" : ""}${short ? " short" : ""}`, "data-buy": id },
          asking ? [el("span", {}, ["Buy for"]), gemIcon(), el("b", {}, [String(info.price)])] : [gemIcon(), el("b", {}, [String(info.price)])]);
        b.addEventListener("click", () => {
          if (short) { sfx("deny"); buzz("error"); say(`You need ${info.price! - wallet().gems} more ${GEM_NAME.toLowerCase()} for ${info.name}.`, true); return; }
          if (!(confirm === id && performance.now() - confirmT < 3500)) { confirm = id; confirmT = performance.now(); sfx("tap"); say(`Tap again to buy ${info.name}.`); draw(); return; }
          confirm = null;
          const r = buySkin(id);
          if (r !== "ok") { sfx("deny"); say(r === "short" ? `Not enough ${GEM_NAME.toLowerCase()}.` : "Already yours.", r === "short"); draw(); return; }
          fresh = id; sfx("buy"); buzz("success");
          say(`${info.name} is yours. Equip it here or in your Army.`);
          draw();
          const c = shelf.querySelector<HTMLElement>(`[data-skin="${id}"]`);
          if (c) burst(c, [info.accent, info.accent2, "#fff"], 22);
          setTimeout(() => { if (fresh === id) fresh = null; }, 1400);
        });
        foot.append(b);
      }
      card.append(art, el("div", { class: "skn-card-body" }, [el("h4", {}, [info.name]), el("p", {}, [info.blurb])]), foot);
      return card;
    }));
  };
  draw();
  live(root, draw, true);
  return root;
}

// ---------------------------------------------------------------- [skins] debug route (?skins) for review shots

/** ?skin=frost[&keepstate=burning]: grants and equips a skin before a deep-linked battle. Debug only. */
export function debugSkin(name: string, state: string | null) {
  const id = `keep:${name}`;
  grantCosmetic(id, "debug");
  equip("keep", id);
  setKeepStateDebug(state);
}

/** ?skins shows the picker and the shop standalone. ?skins=picker|shop shows one; &own=all grants every skin,
 *  &gems=N tops the wallet up to N; &pick=frost selects (and, if owned, equips) a skin. Debug only. */
export function skinsDemo(app: HTMLElement, q: URLSearchParams) {
  const which = q.get("skins") || "both";
  if (q.get("own") === "all") for (const id of KEEP_SKINS) grantCosmetic(id, "debug");
  else if (q.get("own")) for (const n of q.get("own")!.split(",")) grantCosmetic(`keep:${n}`, "debug");
  const g = Number(q.get("gems"));
  if (g > 0 && wallet().gems < g) earn("gems", g - wallet().gems, "debug");
  if (q.get("pick")) equip("keep", `keep:${q.get("pick")}`);
  app.replaceChildren();
  const page = el("div", { class: "skn-demo" });
  if (which !== "shop") page.append(skinPicker({ onShop: () => undefined }));
  if (which !== "picker") page.append(skinShop());
  app.append(page);
}
