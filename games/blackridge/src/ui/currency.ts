// The game's one currency pill (title, Shop and Barracks counters), the reward strip on result screens, and the
// "gems fly into the counter" feedback.
import "@base/ui/gems.css";
import { sfx } from "@base/audio/sfx";
import { GEM_NAME, type Reward } from "@engine/economy/gems";
import { onWalletChange, wallet, type Currency } from "@engine/economy/wallet";
import { el } from "@base/ui/dom";

const GEM_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6v2.500h3.500V22h-13V4.500H9z" fill="none" stroke="currentColor" stroke-width="1.800"/><path d="M8.500 17.500h7v2h-7zM8.500 13.500h7v2h-7zM8.500 9.500h7v2h-7z" fill="currentColor"/></svg>`;

/** A gem glyph, coloured by CSS. */
export function gemIcon(cls = "") {
  const s = document.createElement("span");
  s.className = `gem-ico ${cls}`;
  s.innerHTML = GEM_SVG;
  return s;
}
/** A coin glyph (the same coin as the battle HUD, without a number). */
export const coinIcon = (cls = "") => el("span", { class: `coin icon-only ${cls}` });

const fmt = (n: number) => n.toLocaleString("en");

/**
 * The currency pill: an icon and a live count for one currency. Every pill on the page follows the wallet
 * (one shared listener), so a pill made while its screen is still being built is never left stale.
 */
export function currencyPill(c: Currency, cls = "") {
  const n = wallet()[c];
  const p = el("span", { class: `cur-pill cur-${c} ${cls}`.trim(), role: "status", "aria-label": c === "gems" ? GEM_NAME : "Coins", "data-cur": c }, [
    c === "gems" ? gemIcon() : coinIcon(), el("b", {}, [fmt(n)]),
  ]);
  p.dataset.value = String(n);
  follow();
  return p;
}

let following = false;
function follow() {
  if (following) return;
  following = true;
  onWalletChange((w) => {
    for (const p of document.querySelectorAll<HTMLElement>(".cur-pill[data-cur]")) {
      if (p.dataset.flying) continue; // a fly-in is on its way; it counts up when it lands
      countTo(p, w[p.dataset.cur as Currency]);
    }
  });
}

/** Pills side by side (coins and gems unless told otherwise). */
export const currencyBar = (cls = "", kinds: Currency[] = ["coins", "gems"]) => el("div", { class: `cur-bar ${cls}` }, kinds.map((c) => currencyPill(c)));

function countTo(p: HTMLElement, to: number) {
  const b = p.querySelector("b")!;
  const from = Number(p.dataset.value ?? to);
  p.dataset.value = String(to);
  if (from === to) { b.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 520;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    b.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // A hop when it grows, a dip when it's spent.
  p.classList.remove("bump", "spend"); void p.offsetWidth; p.classList.add(to < from ? "spend" : "bump");
}

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * Purchase feedback: a burst of gem (or coin) glyphs flies from `from` into the counter `to`, which then counts up
 * to the wallet's balance. Resolves when it lands. Respects reduced motion.
 */
export function flyInto(from: Element, to: HTMLElement, c: Currency, amount: number): Promise<void> {
  const finish = () => { delete to.dataset.flying; countTo(to, wallet()[c]); };
  const reduce = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !to.isConnected || !from.isConnected) { finish(); return Promise.resolve(); }
  to.dataset.flying = "1";
  const a = center(from.getBoundingClientRect()), b = center(to.getBoundingClientRect());
  const n = Math.max(5, Math.min(14, Math.round(Math.log2(amount + 1) * 1.6)));
  const layer = el("div", { class: "fly-layer", "aria-hidden": "true" });
  document.body.append(layer);
  const runs: Promise<unknown>[] = [];
  for (let i = 0; i < n; i++) {
    const g = c === "gems" ? gemIcon("fly") : coinIcon("fly");
    g.style.left = `${a.x}px`; g.style.top = `${a.y}px`;
    layer.append(g);
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6, rad = 40 + Math.random() * 46;
    const sx = Math.cos(ang) * rad, sy = Math.sin(ang) * rad * 0.8;
    const anim = g.animate([
      { transform: "translate(-50%,-50%) scale(0.3)", opacity: 0 },
      { transform: `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(1.15)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(0.6)`, opacity: 0.9 },
    ], { duration: 760 + i * 45, delay: i * 25, easing: "cubic-bezier(.45,0,.3,1)", fill: "forwards" });
    runs.push(anim.finished.then(() => { if (i % 3 === 0) sfx("buy"); }));
  }
  return Promise.all(runs).then(() => { layer.remove(); finish(); sfx("upgrade"); }, () => { layer.remove(); finish(); });
}

/** The strip of free gems a result screen just paid, e.g. "+4 Three stars". Nothing when the list is empty. */
export function rewardStrip(rewards: Reward[]) {
  if (!rewards.length) return null;
  const total = rewards.reduce((a, r) => a + r.gems, 0);
  const list = rewards.length > 3 ? [{ id: "sum", gems: total, label: `${rewards.length} rewards` }] : rewards;
  return el("div", { class: "reward-strip", role: "status" }, [
    el("div", { class: "reward-total" }, [gemIcon(), el("b", {}, [`+${fmt(total)}`]), el("span", {}, [GEM_NAME])]),
    el("div", { class: "reward-why" }, list.map((r, i) => el("span", { class: "reward-chip", style: `animation-delay:${0.5 + i * 0.12}s` }, [`+${r.gems} ${r.label}`]))),
  ]);
}
