// Applies the game's lexicon (./lexicon.ts) to everything the player reads. `tr(text)` translates one string (the
// battle canvas uses it for callouts); `installLexicon(root)` keeps a DOM subtree translated as the UI builds itself.
import { LEXICON } from "./lexicon";

const keys = Object.keys(LEXICON).filter((k) => k && LEXICON[k] !== k).sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole words only: a phrase must not continue a word on either side (letters, digits or apostrophes).
const RE = keys.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${keys.map(esc).join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;

/** Whether this game renames anything at all. */
export const hasLexicon = !!RE;

/** One string in this game's words. */
export function tr(text: string): string {
  return RE && text ? text.replace(RE, (m) => LEXICON[m] ?? m) : text;
}

const ATTRS = ["title", "aria-label", "placeholder", "alt"];
/** What we last wrote into a text node, so our own edits (and re-reads of them) are never translated twice. */
const done = new WeakMap<Node, string>();

function text(n: Text) {
  if (done.get(n) === n.data) return;
  const out = tr(n.data);
  done.set(n, out);
  if (out !== n.data) n.data = out;
}
function attrs(e: Element) {
  for (const a of ATTRS) {
    const v = e.getAttribute(a);
    if (v) { const out = tr(v); if (out !== v) e.setAttribute(a, out); }
  }
}
function walk(n: Node) {
  if (n.nodeType === Node.TEXT_NODE) { text(n as Text); return; }
  if (n.nodeType !== Node.ELEMENT_NODE) return;
  const e = n as Element;
  if (e.tagName === "SCRIPT" || e.tagName === "STYLE") return;
  attrs(e);
  const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let c = w.nextNode(); c; c = w.nextNode()) {
    if (c.nodeType === Node.TEXT_NODE) text(c as Text);
    else attrs(c as Element);
  }
}

/** Keep `root` (and the page title) in this game's words from now on. A no-op for a game with an empty lexicon. */
export function installLexicon(root: Node = document.body): void {
  if (!RE) return;
  document.title = tr(document.title);
  walk(root);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "characterData") { if (m.target.nodeType === Node.TEXT_NODE) text(m.target as Text); }
      else if (m.type === "attributes") { const e = m.target as Element, v = e.getAttribute(m.attributeName!); if (v) { const out = tr(v); if (out !== v) e.setAttribute(m.attributeName!, out); } }
      else for (const n of m.addedNodes) walk(n);
    }
  }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
