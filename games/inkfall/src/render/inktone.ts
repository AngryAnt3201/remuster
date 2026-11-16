// Light does not show on paper. The base game's effects are light: white slashes, pale gold sparks, sky-blue bolts,
// each asked for by colour all over base/src/render/vfx.ts and board.ts. `inkTone` turns any of those colours into the
// ink that stands for it here: whites and greys become black ink, colours keep their hue as a dark, muted wash, and
// the two clans' light colours become the clans' own colours.
import { STYLE } from "./style";

const cache = new Map<string, string>();
const hex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");

function parse(c: string): [number, number, number, number] | null {
  if (c[0] === "#") {
    const h = c.length === 4 ? c.slice(1).split("").map((x) => x + x).join("") : c.slice(1, 7);
    if (h.length < 6) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = c.match(/[\d.]+/g)?.map(Number);
  return m && m.length >= 3 ? [m[0], m[1], m[2], m[3] ?? 1] : null;
}
function hsl(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** The ink that stands for a colour of light. Dark colours pass through, so applying it twice is harmless. */
export function inkTone(c: string | undefined): string {
  if (!c) return "#1d1a17";
  const hit = cache.get(c);
  if (hit) return hit;
  let out = c;
  const p = parse(c), T = STYLE.team, lc = c.toLowerCase();
  if (lc === T.tide.light.toLowerCase() || lc === T.tide.main.toLowerCase()) out = T.tide.main;
  else if (lc === T.ember.light.toLowerCase() || lc === T.ember.main.toLowerCase()) out = T.ember.main;
  else if (p) {
    const [r, g, b, a] = p, mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
    const s = d === 0 ? 0 : d / Math.max(1e-6, 1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d) { h = mx === r / 255 ? ((g - b) / 255 / d) % 6 : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4; h = (h * 60 + 360) % 360; }
    let rgb: [number, number, number];
    if (s < 0.28 || l > 0.9) rgb = l > 0.5 ? [29, 26, 23] : [59, 56, 51];                   // whites, greys, pale creams: black ink
    else if (h >= 28 && h < 75) rgb = l > 0.8 ? [29, 26, 23] : hsl(38, Math.min(0.55, s * 0.6), Math.min(l, 0.3)); // golds: a dark tea stain
    else if (h < 28 || h >= 335) rgb = hsl(8, Math.min(0.72, s), Math.min(l, 0.35));         // reds and oranges: dark seal red
    else if (h < 170) rgb = hsl(150, Math.min(0.3, s * 0.5), Math.min(l, 0.36));             // greens: celadon ink
    else if (h < 260) rgb = hsl(200, Math.min(0.3, s * 0.45), Math.min(l, 0.3));             // blues: blue-black
    else rgb = hsl(275, Math.min(0.2, s * 0.4), Math.min(l, 0.3));                           // violets: plum-black
    out = a < 1 ? `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${a})` : `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`;
  }
  cache.set(c, out);
  return out;
}
