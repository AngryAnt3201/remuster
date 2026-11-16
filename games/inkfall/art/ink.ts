// Ink on paper, in 2D: the brush marks every painted picture in Inkfall is made of (arena grounds, map pages, the key
// art, Bastion grounds, effect cells). The kit's Painter has cobbles, planks and rails; it has no wash that bleeds,
// no dry brush and no mist, so they live here. Everything works in the painter's own units (`u` = how many units one
// "brush width" is: about 1 for a world-unit ground, about 60 for a pixel page).
import type { Painter, Pt } from "../../../artkit/paint";
import { rgba } from "../../../artkit/paint";
import { INK, PAPER } from "./style";

export const TONE = { paper: PAPER, ink: INK, wet: "#3b3833", mid: "#6f6a62", pale: "#a9a397", mist: "#cfc8b8", tea: "#b89a5e", teaLt: "#d8c79c", moss: "#8a9a78", celadon: "#9bb5a2", seal: "#c8321e", indigo: "#1f5878", petal: "#e9a79b" };

type G = CanvasRenderingContext2D;
/** Canvas pixels for a length in painter units. */
const px = (p: Painter, units: number) => Math.max(0, units * p.scale);

/** A closed wobbly outline round (cx, cy). */
export function blob(p: Painter, cx: number, cy: number, rx: number, ry: number, n = 12, jitter = 0.22): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 1 + p.rand(-jitter, jitter); out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  return out;
}
/** Trace a closed outline as a smooth curve through the midpoints. */
function smoothPath(g: G, pts: Pt[], closed = true) {
  const n = pts.length;
  if (n < 3) { g.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]); return; }
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (closed) {
    const s = mid(pts[n - 1], pts[0]);
    g.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const c = pts[i], e = mid(c, pts[(i + 1) % n]); g.quadraticCurveTo(c[0], c[1], e[0], e[1]); }
    g.closePath();
  } else {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) { const c = pts[i], e = mid(c, pts[i + 1]); g.quadraticCurveTo(c[0], c[1], e[0], e[1]); }
    g.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}

/** A wet wash: a shape filled with thin ink that bleeds at the edge and dries with a slightly darker rim. */
export function wash(p: Painter, pts: Pt[], color: string, alpha = 0.3, o: { bleed?: number; rim?: number; smooth?: boolean } = {}) {
  const g = p.g, bleed = px(p, o.bleed ?? 0.12);
  const path = () => { g.beginPath(); if (o.smooth ?? true) smoothPath(g, pts); else { pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); } };
  g.save();
  g.filter = bleed > 0.5 ? `blur(${bleed.toFixed(1)}px)` : "none";
  g.globalAlpha = alpha; g.fillStyle = color; path(); g.fill();
  g.restore();
  g.save();
  g.globalAlpha = alpha * 0.7; g.fillStyle = color; path(); g.fill();
  if ((o.rim ?? 0.5) > 0) { g.globalAlpha = alpha * (o.rim ?? 0.5); g.strokeStyle = color; g.lineWidth = (o.bleed ?? 0.12) * 0.22; path(); g.stroke(); }
  g.restore();
}
/** A round wash. */
export const pool = (p: Painter, x: number, y: number, rx: number, ry: number, color: string, alpha = 0.3, o: { bleed?: number; rim?: number; jitter?: number } = {}) => wash(p, blob(p, x, y, rx, ry, 12, o.jitter ?? 0.18), color, alpha, o);

/** A loaded brush stroke along a path: wide where the brush lands, thinning to the lift, with dry streaks at the tail. */
export function stroke(p: Painter, pts: Pt[], width: number, color: string = INK, alpha = 0.9, o: { taper?: number; dry?: number; lead?: number } = {}) {
  const g = p.g, n = pts.length;
  if (n < 2) return;
  const taper = o.taper ?? 0.75, lead = o.lead ?? 0.15;
  const wAt = (t: number) => width * (t < lead ? 0.45 + 0.55 * (t / lead) : 1 - taper * Math.pow((t - lead) / (1 - lead), 1.6));
  const dryK = o.dry ?? 0.4, from = dryK > 0 ? Math.max(2, Math.floor((n - 1) * (1 - dryK))) : n - 1;
  const frame = (i: number): [number, number, number] => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    return [-dy, dx, wAt(i / (n - 1))];
  };
  const L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i <= from; i++) {
    const [nx, ny, w0] = frame(i), w = (w0 / 2) * (1 + p.rand(-0.08, 0.08));
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  g.save();
  g.globalAlpha = alpha; g.fillStyle = color; g.strokeStyle = color;
  g.beginPath(); smoothPath(g, [...L, ...R.reverse()]); g.fill();
  // the tail: the bristles split into separate filaments that skip over the paper (dry brush)
  if (from < n - 1) {
    const K = 6;
    g.lineCap = "butt";
    for (let k = 0; k < K; k++) {
      const off = (k + 0.5) / K - 0.5, end = from + Math.max(1, Math.round((n - 1 - from) * p.rand(0.55, 1)));
      g.lineWidth = (frame(from)[2] / K) * p.rand(0.55, 1.05);
      g.globalAlpha = alpha * p.rand(0.6, 1);
      g.setLineDash([width * p.rand(0.8, 2.6), width * p.rand(0.1, 0.5)]);
      g.beginPath();
      for (let i = from - 1; i <= Math.min(n - 1, end); i++) {
        const [nx, ny, w0] = frame(i), x = pts[i][0] + nx * w0 * off, y = pts[i][1] + ny * w0 * off;
        i === from - 1 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
    g.setLineDash([]);
  }
  g.restore();
}
/** A plain round-ended line through points. */
export function line(p: Painter, pts: Pt[], width: number, color: string = INK, alpha = 0.8) {
  const g = p.g;
  g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); smoothPath(g, pts, false); g.stroke(); g.restore();
}
/** A dry-brush band: many thin broken filaments side by side (a kerb, a rule, a raked line). */
export function dry(p: Painter, a: Pt, b: Pt, width: number, color: string = INK, alpha = 0.7, n = 7) {
  const g = p.g, dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  g.save(); g.strokeStyle = color; g.lineCap = "butt";
  for (let k = 0; k < n; k++) {
    const off = (k / (n - 1) - 0.5) * width + p.rand(-0.04, 0.04) * width;
    g.globalAlpha = alpha * p.rand(0.45, 1);
    g.lineWidth = (width / n) * p.rand(0.5, 1.3);
    g.setLineDash([l * p.rand(0.05, 0.3), l * p.rand(0.004, 0.035)]);
    g.lineDashOffset = p.rand(0, l);
    g.beginPath(); g.moveTo(a[0] + nx * off + dx * p.rand(0, 0.015), a[1] + ny * off + dy * p.rand(0, 0.015)); g.lineTo(b[0] + nx * off - dx * p.rand(0, 0.02), b[1] + ny * off - dy * p.rand(0, 0.02)); g.stroke();
  }
  g.restore();
}
/** A brushed ring (an enso): one stroke round a circle, not quite closed. */
export function enso(p: Painter, x: number, y: number, rx: number, ry: number, width: number, color: string = INK, alpha = 0.8, start = -1.9, sweep = 5.7) {
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) { const a = start + (i / 40) * sweep, k = 1 + 0.02 * Math.sin(i * 0.9); pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]); }
  stroke(p, pts, width, color, alpha, { taper: 0.6, dry: 0.3 });
}
/** Paint `fn` on a transparent layer and lay the result over the picture (so dry-brush cuts stay inside the layer). */
export function layer(p: Painter, fn: () => void, alpha = 1, mode: GlobalCompositeOperation = "source-over") {
  const main = p.g, c = document.createElement("canvas");
  c.width = p.canvas.width; c.height = p.canvas.height;
  const g = c.getContext("2d")!;
  g.setTransform(main.getTransform()); g.lineJoin = "round"; g.lineCap = "round";
  (p as { g: G }).g = g;
  try { fn(); } finally { (p as { g: G }).g = main; }
  main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = alpha; main.globalCompositeOperation = mode; main.drawImage(c, 0, 0); main.restore();
}

/** Bare rice paper over a rectangle: the paper colour, faint cloudy stains and scattered fibres. `u` = brush unit. */
export function paper(p: Painter, x: number, y: number, w: number, h: number, u = 1, color: string = PAPER) {
  const g = p.g;
  g.fillStyle = color; g.fillRect(x, y, w, h);
  const n = Math.round((w * h) / (u * u) * 0.05);
  for (let i = 0; i < n; i++) pool(p, x + p.r() * w, y + p.r() * h, p.rand(1, 3.2) * u, p.rand(0.7, 2) * u, i % 3 ? "#d8cba9" : "#fffaf0", p.rand(0.05, 0.11), { bleed: 0.5 * u, rim: 0 });
  g.save(); g.lineCap = "round";
  const f = Math.round((w * h) / (u * u) * 1.1);
  for (let i = 0; i < f; i++) {
    const fx = x + p.r() * w, fy = y + p.r() * h, a = p.r() * Math.PI, l = p.rand(0.05, 0.22) * u;
    g.globalAlpha = p.rand(0.05, 0.16); g.strokeStyle = i % 4 ? "#a8996f" : "#fffdf6"; g.lineWidth = 0.012 * u;
    g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + Math.cos(a) * l * 0.5 + p.rand(-0.03, 0.03) * u, fy + Math.sin(a) * l * 0.5, fx + Math.cos(a) * l, fy + Math.sin(a) * l); g.stroke();
  }
  g.restore();
}

/** A range of misty mountains: ink at the ridge fading down into bare paper. `base` is the foot line, `height` the
 *  tallest peak (painter units, y grows down the page). */
export function mountains(p: Painter, x0: number, x1: number, base: number, height: number, color: string, alpha = 0.6, o: { peaks?: number; rough?: number; mist?: number } = {}) {
  const g = p.g, n = o.peaks ?? 5, rough = o.rough ?? 0.35, W = x1 - x0;
  const ridge: Pt[] = [];
  const steps = n * 10;
  const peaks = Array.from({ length: n }, (_, i) => ({ x: x0 + (W * (i + 0.5 + p.rand(-0.3, 0.3))) / n, h: height * p.rand(0.5, 1), w: (W / n) * p.rand(0.5, 0.95) }));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + (W * i) / steps;
    let h = 0;
    for (const pk of peaks) h = Math.max(h, pk.h * Math.max(0, 1 - Math.pow(Math.abs(x - pk.x) / pk.w, 1.4)));
    h += height * rough * 0.12 * (Math.sin(i * 1.7) * 0.5 + p.rand(-0.5, 0.5));
    ridge.push([x, base - Math.max(0, h)]);
  }
  g.save();
  const gr = g.createLinearGradient(0, base - height, 0, base + height * 0.05);
  gr.addColorStop(0, rgba(color, alpha)); gr.addColorStop(0.45, rgba(color, alpha * 0.55)); gr.addColorStop(o.mist ?? 0.85, rgba(color, 0));
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(x0, base + height * 0.1); for (const q of ridge) g.lineTo(q[0], q[1]); g.lineTo(x1, base + height * 0.1); g.closePath(); g.fill();
  // the ridge line itself: a broken darker stroke
  g.globalAlpha = Math.min(1, alpha * 1.1); g.strokeStyle = color; g.lineWidth = height * 0.018; g.lineJoin = "round";
  g.setLineDash([height * 0.5, height * 0.06, height * 0.2, height * 0.1]);
  g.beginPath(); ridge.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke();
  // a few fold strokes down from each peak
  g.setLineDash([]); g.globalAlpha = alpha * 0.5; g.lineWidth = height * 0.012;
  for (const pk of peaks) for (let k = 0; k < 3; k++) {
    const sx = pk.x + p.rand(-0.2, 0.2) * pk.w, top = base - pk.h * (1 - Math.pow(Math.abs(sx - pk.x) / pk.w, 1.4)) * 0.96;
    g.beginPath(); g.moveTo(sx, top); g.quadraticCurveTo(sx + p.rand(-0.1, 0.1) * pk.w, top + pk.h * 0.25, sx + p.rand(-0.25, 0.25) * pk.w, top + pk.h * p.rand(0.3, 0.55)); g.stroke();
  }
  g.restore();
}
/** A band of mist: paper laid back over the picture in a soft horizontal drift. */
export function mist(p: Painter, x0: number, x1: number, y: number, h: number, alpha = 0.8, color: string = PAPER) {
  const g = p.g;
  g.save();
  const gr = g.createLinearGradient(0, y - h, 0, y + h);
  gr.addColorStop(0, rgba(color, 0)); gr.addColorStop(0.5, rgba(color, alpha)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(x0, y - h, x1 - x0, h * 2);
  g.restore();
}
/** A tuft of grass or reed: a few quick upward flicks. */
export function tuft(p: Painter, x: number, y: number, s: number, color: string = INK, alpha = 0.5, n = 4) {
  const g = p.g;
  g.save(); g.strokeStyle = color; g.lineCap = "round"; g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.32 + p.rand(-0.1, 0.1), l = s * p.rand(0.6, 1);
    g.lineWidth = s * 0.09;
    g.beginPath(); g.moveTo(x + (i - n / 2) * s * 0.07, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l + s * 0.1, y + Math.sin(a) * l); g.stroke();
  }
  g.restore();
}
/** Pebbles: a few dabs. */
export function dabs(p: Painter, x: number, y: number, s: number, color: string = INK, alpha = 0.4, n = 3) {
  const g = p.g;
  g.save(); g.fillStyle = color;
  for (let i = 0; i < n; i++) { g.globalAlpha = alpha * p.rand(0.5, 1); g.beginPath(); g.ellipse(x + p.rand(-1, 1) * s, y + p.rand(-0.6, 0.6) * s, s * p.rand(0.12, 0.3), s * p.rand(0.08, 0.18), p.rand(0, 3), 0, Math.PI * 2); g.fill(); }
  g.restore();
}
/** An ink splat: a blot, satellites and flung drops. */
export function splatter(p: Painter, x: number, y: number, r: number, color: string = INK, alpha = 0.9, n = 9) {
  const g = p.g;
  g.save(); g.fillStyle = color; g.globalAlpha = alpha;
  g.beginPath(); smoothPath(g, blob(p, x, y, r * 0.55, r * 0.5, 11, 0.3)); g.fill();
  for (let i = 0; i < n; i++) {
    const a = p.r() * Math.PI * 2, d = r * p.rand(0.55, 1.15), s = r * p.rand(0.04, 0.16);
    g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, s * 1.6, s, a, 0, Math.PI * 2); g.fill();
    g.lineWidth = s * 0.7; g.strokeStyle = color; g.lineCap = "round";
    g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4); g.lineTo(x + Math.cos(a) * d * 0.9, y + Math.sin(a) * d * 0.9); g.stroke();
  }
  g.restore();
}
/** A five-petal plum blossom. */
export function blossom(p: Painter, x: number, y: number, s: number, color: string = TONE.petal, alpha = 0.9) {
  const g = p.g;
  g.save(); g.globalAlpha = alpha; g.fillStyle = color;
  const rot = p.r() * 2;
  for (let i = 0; i < 5; i++) { const a = rot + (i / 5) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5, s * 0.42, s * 0.34, a, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = INK; g.globalAlpha = alpha * 0.7; g.beginPath(); g.arc(x, y, s * 0.13, 0, Math.PI * 2); g.fill();
  g.restore();
}
/** A red seal stamp: a rough square of seal ink with pale carved marks. */
export function seal(p: Painter, x: number, y: number, s: number, color: string = TONE.seal, marks = 4) {
  const g = p.g;
  g.save(); g.fillStyle = color; g.globalAlpha = 0.92;
  const pts: Pt[] = [];
  for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let k = 0; k < 3; k++) pts.push([x + cx * s * 0.5 * (1 + p.rand(-0.05, 0.03)) + (k - 1) * -cy * cx * s * 0.0, y + cy * s * 0.5 * (1 + p.rand(-0.05, 0.03))]);
  g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill();
  g.globalAlpha = 0.95; g.lineCap = "square"; g.lineWidth = s * 0.07; g.strokeStyle = "#f7efdc";
  const c = s * 0.3;
  g.strokeRect(x - c, y - c, c * 2, c * 2);
  for (let i = 0; i < marks; i++) { const vx = x - c + (c * 2 * (i + 1)) / (marks + 1); g.beginPath(); if (i % 2) { g.moveTo(vx, y - c * 0.6); g.lineTo(vx, y + c * 0.6); } else { g.moveTo(vx - c * 0.2, y - c * 0.5 + (i * c) / 3); g.lineTo(vx + c * 0.25, y - c * 0.5 + (i * c) / 3); g.moveTo(vx, y - c * 0.3); g.lineTo(vx, y + c * 0.7); } g.stroke(); }
  g.restore();
}
/** A brush-painted pine seen from the side: a leaning trunk in one stroke, flat tiers of needles as dark dabs with
 *  a fringe of short flicks. (x, y) is the foot; `s` its height. */
export function pine2d(p: Painter, x: number, y: number, s: number, lean = 0.2, color: string = INK, alpha = 0.9) {
  const top: Pt = [x + lean * s, y - s];
  stroke(p, [[x, y], [x + lean * s * 0.1, y - s * 0.35], [x + lean * s * 0.7, y - s * 0.7], top], s * 0.075, color, alpha, { taper: 0.6, dry: 0.25, lead: 0.05 });
  const g = p.g;
  const tiers: [number, number, number][] = [[0.45, -0.34, 0.3], [0.58, 0.3, 0.34], [0.74, -0.16, 0.28], [0.88, 0.2, 0.24], [1.0, 0.0, 0.2]];
  for (const [t, off, w] of tiers) {
    const cx = x + lean * s * t + off * s, cy = y - s * t;
    stroke(p, [[x + lean * s * t * 0.9, cy + s * 0.05], [(x + lean * s * t + cx) / 2, cy + s * 0.01], [cx, cy]], s * 0.03, color, alpha, { taper: 0.5, dry: 0 });
    wash(p, blob(p, cx, cy - s * 0.02, w * s, s * 0.065, 10, 0.25), color, alpha * 0.78, { bleed: s * 0.012, rim: 0.4 });
    g.save(); g.strokeStyle = color; g.globalAlpha = alpha * 0.8; g.lineWidth = s * 0.012; g.lineCap = "round";
    for (let i = 0; i < 16; i++) { const fx = cx + (i / 15 - 0.5) * 2 * w * s, a = -Math.PI / 2 + (i / 15 - 0.5) * 1.5 + p.rand(-0.2, 0.2), l = s * p.rand(0.05, 0.09); g.beginPath(); g.moveTo(fx, cy - s * 0.02); g.lineTo(fx + Math.cos(a) * l, cy - s * 0.02 + Math.sin(a) * l); g.stroke(); }
    g.restore();
  }
}
