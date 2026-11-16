// The campaign's ending: one victory card after the last boss falls, then back to the map.
// Self-contained (its own few styles), shown by main.ts after the finale's result sheet and on ?ending for review.
import { el } from "./dom";
import { ribbon } from "./game";
import { icon } from "./kit";

export const ENDING = {
  title: "Crownfall",
  line: "The last crown is down and the citadel is yours. Sixty battles, ten acts, and every banner flies your colours.",
  button: "Back to the map",
};

const CSS = `
.ending { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: calc(var(--st, 0px) + 20px) 18px calc(var(--sb, 0px) + 20px);
  background: radial-gradient(120% 80% at 50% 30%, rgba(255, 196, 110, 0.35), rgba(40, 20, 50, 0.92) 70%), url(arenas/act10.jpg) center / cover, #2a1830;
  animation: fade 0.4s; }
.ending-card { width: min(360px, 100%); display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center;
  padding: 26px 20px 22px; border-radius: 24px; color: var(--k-text, #2b1d14); background: var(--k-panel, #f6ead2); border: 3px solid var(--k-ink, #2b1d14);
  box-shadow: 0 6px 0 var(--k-ink, #2b1d14), 0 24px 60px rgba(0, 0, 0, 0.45); animation: rise 0.5s cubic-bezier(.2,1.2,.3,1); }
.ending-crown { font-size: 84px; height: 92px; display: grid; place-items: center; }
.ending-crown .icon { color: var(--gold, #ffcf4d); filter: drop-shadow(0 3px 0 var(--k-ink, #2b1d14)); animation: crestIn 0.6s cubic-bezier(.2,1.4,.4,1) 0.3s backwards; }
.ending-kicker { font: 700 13px/1 system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: var(--k-muted, #7a6450); }
.ending-line { margin: 0; font-size: 17px; line-height: 1.4; font-weight: 600; }
.ending-card .btn { width: 100%; }
`;

let styled = false;

/** Shows the ending over everything; the button removes it and calls onDone (back to the campaign map). */
export function showEnding(host: HTMLElement, onDone: () => void): HTMLElement {
  if (!styled) { document.head.append(el("style", {}, [CSS])); styled = true; }
  const go = el("button", { class: "btn primary big" }, [ENDING.button]);
  const card = el("div", { class: "ending" }, [
    el("div", { class: "ending-card" }, [
      ribbon(ENDING.title),
      el("div", { class: "ending-crown" }, [icon("crown")]),
      el("div", { class: "ending-kicker" }, ["The campaign is won"]),
      el("p", { class: "ending-line" }, [ENDING.line]),
      go,
    ]),
  ]);
  go.addEventListener("click", () => { card.remove(); onDone(); });
  host.append(card);
  return card;
}
