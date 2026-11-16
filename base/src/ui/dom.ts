import { STAR_SVG } from "./kit";

export function el(tag: string, attrs: Record<string, string> = {}, children: (Node | string)[] = []): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children) e.append(c);
  return e;
}

export const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));

/** A row of kit stars, `n` of `of` lit. */
export function stars(n: number, of = 3, cls = "") {
  const row = el("span", { class: `stars ${cls}` });
  for (let i = 0; i < of; i++) {
    const s = el("i", { class: `star ${i < n ? "on" : ""}` });
    s.innerHTML = STAR_SVG;
    row.append(s);
  }
  return row;
}
