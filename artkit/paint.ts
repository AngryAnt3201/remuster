// 2D painting helpers for flat art: arena ground, map pages, tower-defence backdrops, key art. A Painter wraps a
// canvas whose units are world units (or whatever unit the caller picks), with seeded randomness, so the same code
// always paints the same picture. Everything is drawn in the toon idiom: flat fills, a darker inked edge, chunky shapes.
import { hexRgb, mixHex, rgbHex, type V3 } from "./toon3d";

/** A seeded random number generator (0..1). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export type Pt = [number, number];
/** Lighten (k > 0) or darken (k < 0) a hex colour. */
export const shade = (hex: string, k: number) => mixHex(hex, k > 0 ? "#ffffff" : "#000000", Math.abs(k));
export const rgba = (hex: string, a: number) => { const c = hexRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
/** Points along a smooth curve through `pts` (Catmull-Rom), about `step` apart. */
export function spline(pts: Pt[], step = 0.2): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)) as Pt);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export interface PainterOpts { ink?: string; seed?: number; /** Pixels per unit down the canvas, if not `scale` (a foreshortened ground). */ ys?: number; /** Exact canvas size in pixels, if rounding matters. */ px?: [number, number]; }

/** A canvas you paint in your own units. `scale` is canvas pixels per unit; (x0, y0) the unit coordinates of the
 *  canvas's top-left corner. */
export class Painter {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly r: () => number;
  ink: string;
  /** Canvas pixels per unit down the canvas. */
  readonly ys: number;
  constructor(readonly x0: number, readonly y0: number, readonly w: number, readonly h: number, readonly scale: number, o: PainterOpts = {}) {
    this.canvas = document.createElement("canvas");
    this.ys = o.ys ?? scale;
    this.canvas.width = o.px?.[0] ?? Math.round(w * scale); this.canvas.height = o.px?.[1] ?? Math.round(h * this.ys);
    this.g = this.canvas.getContext("2d")!;
    this.g.setTransform(scale, 0, 0, this.ys, -x0 * scale, -y0 * this.ys);
    this.g.lineJoin = "round"; this.g.lineCap = "round";
    this.r = rng(o.seed ?? 1);
    this.ink = o.ink ?? "#2a1a12";
  }
  /** A point in the painter's units as canvas pixels. */
  toPx(x: number, y: number): [number, number] { return [(x - this.x0) * this.scale, (y - this.y0) * this.ys]; }
  /** Random number in a..b. */
  rand(a = 0, b = 1) { return a + (b - a) * this.r(); }
  pick<T>(list: T[]): T { return list[Math.floor(this.r() * list.length) % list.length]; }
  /** Run `fn` clipped to a shape (the path `shape` draws). */
  clip(shape: (g: CanvasRenderingContext2D) => void, fn: () => void) {
    this.g.save(); this.g.beginPath(); shape(this.g); this.g.clip();
    try { fn(); } finally { this.g.restore(); }
  }
  /** Fill everything. */
  fill(color: string) { this.g.fillStyle = color; this.g.fillRect(this.x0, this.y0, this.w, this.h); }
  rect(x: number, y: number, w: number, h: number, color: string, ink = 0) {
    this.g.fillStyle = color; this.g.fillRect(x, y, w, h);
    if (ink > 0) { this.g.strokeStyle = this.ink; this.g.lineWidth = ink; this.g.strokeRect(x, y, w, h); }
  }
  /** A filled polygon with an optional inked edge (ink = line width in units). */
  poly(pts: Pt[], color: string, ink = 0, inkColor = this.ink) {
    const g = this.g;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.fillStyle = color; g.fill();
    if (ink > 0) { g.strokeStyle = inkColor; g.lineWidth = ink; g.stroke(); }
  }
  circle(x: number, y: number, r: number, color: string, ink = 0, ry = r) {
    const g = this.g;
    g.beginPath(); g.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
    g.fillStyle = color; g.fill();
    if (ink > 0) { g.strokeStyle = this.ink; g.lineWidth = ink; g.stroke(); }
  }
  /** A stroked path. */
  line(pts: Pt[], color: string, width: number, alpha = 1) {
    const g = this.g;
    g.save(); g.globalAlpha = alpha;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = color; g.lineWidth = width; g.stroke(); g.restore();
  }
  /** A rounded rectangle. */
  round(x: number, y: number, w: number, h: number, rad: number, color: string, ink = 0, inkColor = this.ink) {
    const g = this.g, r = Math.min(rad, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    g.fillStyle = color; g.fill();
    if (ink > 0) { g.strokeStyle = inkColor; g.lineWidth = ink; g.stroke(); }
  }
  /** Soft blotches of `color` scattered over a rectangle: wear, soot, moss, damp. */
  mottle(x: number, y: number, w: number, h: number, color: string, o: { n?: number; size?: [number, number]; alpha?: number } = {}) {
    const g = this.g, n = o.n ?? Math.round(w * h * 0.6), [s0, s1] = o.size ?? [0.4, 1.4];
    g.save(); g.globalAlpha = o.alpha ?? 0.12; g.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const cx = x + this.r() * w, cy = y + this.r() * h, r = this.rand(s0, s1);
      g.beginPath();
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, rr = r * this.rand(0.6, 1); k ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7); }
      g.closePath(); g.fill();
    }
    g.restore();
  }
  /** Cobbles or setts over a rectangle: rows of rounded stones in `colors`, each with a darker edge. */
  cobbles(x: number, y: number, w: number, h: number, colors: string[], o: { size?: number; gap?: string; jitter?: number; aspect?: number; edge?: number } = {}) {
    const s = o.size ?? 0.3, asp = o.aspect ?? 1.25, j = o.jitter ?? 0.12, g = this.g;
    if (o.gap) this.rect(x, y, w, h, o.gap);
    let row = 0;
    for (let yy = y; yy < y + h; yy += s, row++) {
      let xx = x - (row % 2 ? s * asp * 0.5 : 0) - this.r() * s * 0.2;
      while (xx < x + w) {
        const sw = s * asp * this.rand(0.8, 1.25), c = this.pick(colors);
        const px = xx + s * 0.06, py = yy + s * 0.06 + this.rand(-j, j) * s * 0.2, pw = sw - s * 0.12, ph = s - s * 0.12;
        this.round(px, py, pw, ph, s * 0.22, c, o.edge ?? s * 0.05, rgba(this.ink, 0.5));
        g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(px + pw * 0.15, py + ph * 0.14, pw * 0.5, ph * 0.16);
        xx += sw;
      }
    }
  }
  /** Flagstones, plates or bricks: a regular bond of rectangles with an inked joint. */
  slabs(x: number, y: number, w: number, h: number, colors: string[], o: { sw?: number; sh?: number; joint?: number; jointColor?: string; bond?: number; rivets?: string } = {}) {
    const sw = o.sw ?? 0.8, sh = o.sh ?? 0.5, jt = o.joint ?? 0.035, g = this.g;
    let row = 0;
    for (let yy = y; yy < y + h - 1e-6; yy += sh, row++) {
      for (let xx = x - (row % 2 ? sw * (o.bond ?? 0.5) : 0); xx < x + w; xx += sw) {
        const a = Math.max(x, xx), b = Math.min(x + w, xx + sw), hh = Math.min(sh, y + h - yy);
        if (b - a < 0.02) continue;
        g.fillStyle = this.pick(colors); g.fillRect(a, yy, b - a, hh);
        g.fillStyle = "rgba(255,255,255,0.07)"; g.fillRect(a + jt, yy + jt, b - a - 2 * jt, hh * 0.12);
        g.strokeStyle = o.jointColor ?? rgba(this.ink, 0.55); g.lineWidth = jt; g.strokeRect(a, yy, b - a, hh);
        if (o.rivets) { g.fillStyle = o.rivets; for (const [rx, ry] of [[a + 0.07, yy + 0.07], [b - 0.07, yy + 0.07], [a + 0.07, yy + hh - 0.07], [b - 0.07, yy + hh - 0.07]]) { g.beginPath(); g.arc(rx, ry, 0.025, 0, 7); g.fill(); } }
      }
    }
  }
  /** Planks running along x (or y when `vertical`): boards with end joints and nail heads. */
  planks(x: number, y: number, w: number, h: number, colors: string[], o: { width?: number; vertical?: boolean; len?: number } = {}) {
    const pw = o.width ?? 0.28, g = this.g, L = o.len ?? 2.4;
    const along = o.vertical ? h : w, across = o.vertical ? w : h;
    for (let a = 0; a < across; a += pw) {
      let b = -this.r() * L;
      while (b < along) {
        const len = L * this.rand(0.7, 1.3), b0 = Math.max(0, b), b1 = Math.min(along, b + len);
        const [rx, ry, rw, rh] = o.vertical ? [x + a, y + b0, Math.min(pw, across - a), b1 - b0] : [x + b0, y + a, b1 - b0, Math.min(pw, across - a)];
        g.fillStyle = this.pick(colors); g.fillRect(rx, ry, rw, rh);
        g.strokeStyle = rgba(this.ink, 0.5); g.lineWidth = 0.025; g.strokeRect(rx, ry, rw, rh);
        g.fillStyle = rgba(this.ink, 0.55);
        for (const e of [0.08, -0.08]) { const nx = o.vertical ? rx + rw / 2 : e > 0 ? rx + e : rx + rw + e, ny = o.vertical ? (e > 0 ? ry + e : ry + rh + e) : ry + rh / 2; g.beginPath(); g.arc(nx, ny, 0.018, 0, 7); g.fill(); }
        b += len;
      }
    }
  }
  /** A road, track bed or channel along a path: a wide stroke with an inked kerb each side. */
  road(path: Pt[], width: number, color: string, o: { kerb?: string; kerbW?: number; alpha?: number } = {}) {
    if (o.kerb) this.line(path, o.kerb, width + 2 * (o.kerbW ?? 0.08));
    this.line(path, color, width, o.alpha ?? 1);
  }
  /** Railway track along a path: sleepers and two rails. */
  rails(path: Pt[], gauge = 0.5, o: { sleeper?: string; rail?: string; bed?: string } = {}) {
    const g = this.g;
    if (o.bed) this.line(path, o.bed, gauge * 2);
    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1], [bx, by] = path[i], d = Math.hypot(bx - ax, by - ay);
      acc += d;
      if (acc < 0.28) continue;
      acc = 0;
      const nx = -(by - ay) / d, ny = (bx - ax) / d;
      g.strokeStyle = this.ink; g.lineWidth = 0.15; g.beginPath(); g.moveTo(ax + nx * gauge * 0.8, ay + ny * gauge * 0.8); g.lineTo(ax - nx * gauge * 0.8, ay - ny * gauge * 0.8); g.stroke();
      g.strokeStyle = o.sleeper ?? "#6b4a32"; g.lineWidth = 0.1; g.beginPath(); g.moveTo(ax + nx * gauge * 0.78, ay + ny * gauge * 0.78); g.lineTo(ax - nx * gauge * 0.78, ay - ny * gauge * 0.78); g.stroke();
    }
    for (const s of [1, -1]) {
      const off = path.map(([x, y], i) => { const [px, py] = path[Math.max(0, i - 1)], [qx, qy] = path[Math.min(path.length - 1, i + 1)], d = Math.hypot(qx - px, qy - py) || 1; return [x - ((qy - py) / d) * gauge * 0.5 * s, y + ((qx - px) / d) * gauge * 0.5 * s] as Pt; });
      this.line(off, this.ink, 0.1); this.line(off, o.rail ?? "#aab2bd", 0.05);
    }
  }
  /** A toothed ring: a cog set in the ground (keep plazas, turntables, inlays). */
  cog(x: number, y: number, r: number, teeth: number, color: string, o: { tooth?: number; ink?: number; phase?: number; hole?: number; holeColor?: string } = {}) {
    const pts: Pt[] = [], t = o.tooth ?? 0.12;
    for (let i = 0; i < teeth; i++) {
      const s = (Math.PI * 2) / teeth, a = (o.phase ?? 0) + i * s;
      for (const [da, rr] of [[0, r], [0.1, r * (1 + t)], [0.5, r * (1 + t)], [0.6, r]] as Pt[]) pts.push([x + Math.cos(a + da * s) * rr, y + Math.sin(a + da * s) * rr]);
    }
    this.poly(pts, color, o.ink ?? 0.05);
    if (o.hole) this.circle(x, y, r * o.hole, o.holeColor ?? shade(color, -0.25), o.ink ?? 0.05);
  }
  /** A pool of light (or shadow) that fades out: gaslight on wet cobbles, furnace glow, soot. `mode` is the canvas
   *  blend ("lighter" to add light, "multiply" to darken, "source-over" to tint). */
  glow(x: number, y: number, r: number, color: string, alpha = 0.35, mode: GlobalCompositeOperation = "lighter", ry = r) {
    const g = this.g;
    g.save(); g.globalCompositeOperation = mode;
    g.translate(x, y); g.scale(1, ry / r);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, rgba(color, alpha)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r);
    g.restore();
  }
  /** A top-to-bottom wash over a rectangle. */
  wash(x: number, y: number, w: number, h: number, top: string, bottom: string, mode: GlobalCompositeOperation = "source-over") {
    const g = this.g, gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.save(); g.globalCompositeOperation = mode; g.fillStyle = gr; g.fillRect(x, y, w, h); g.restore();
  }
  /** Wandering cracks. */
  cracks(x: number, y: number, w: number, h: number, n: number, color = rgba(this.ink, 0.45), width = 0.03) {
    for (let i = 0; i < n; i++) {
      let px = x + this.r() * w, py = y + this.r() * h, a = this.r() * 7;
      const pts: Pt[] = [[px, py]];
      for (let k = 0; k < 5; k++) { a += this.rand(-0.9, 0.9); px += Math.cos(a) * 0.22; py += Math.sin(a) * 0.22; pts.push([px, py]); }
      this.line(pts, color, width);
    }
  }
  /** A puddle: a dark glossy blob with a pale glint. */
  puddle(x: number, y: number, r: number, color = "#3d4a5c", glint = "#cfe6f2") {
    const pts: Pt[] = [];
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, rr = r * this.rand(0.7, 1.1); pts.push([x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr * 0.8]); }
    this.g.save(); this.g.globalAlpha = 0.75; this.poly(pts, color, 0); this.g.restore();
    this.line([[x - r * 0.5, y - r * 0.15], [x + r * 0.2, y - r * 0.25]], glint, r * 0.12, 0.6);
  }
  /** A round iron cover: manholes, drains, hatch plates. */
  cover(x: number, y: number, r: number, color = "#4a4e58", ring = "#30333b") {
    this.circle(x, y, r, ring, 0.04); this.circle(x, y, r * 0.8, color, 0);
    for (let i = -2; i <= 2; i++) this.line([[x - r * 0.55, y + i * r * 0.22], [x + r * 0.55, y + i * r * 0.22]], ring, r * 0.07);
  }
  /** Scatter: calls `fn(x, y, i)` at n random spots inside a rectangle that pass `ok`. */
  scatter(x: number, y: number, w: number, h: number, n: number, fn: (x: number, y: number, i: number) => void, ok: (x: number, y: number) => boolean = () => true) {
    for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
      const px = x + this.r() * w, py = y + this.r() * h;
      if (!ok(px, py)) continue;
      fn(px, py, i++);
    }
  }
  /** Stamp another canvas (a rendered sprite) with its anchor at (x, y), `k` units per source pixel. */
  stamp(img: CanvasImageSource, x: number, y: number, ax: number, ay: number, k: number, w: number, h: number, alpha = 1) {
    this.g.save(); this.g.globalAlpha = alpha; this.g.drawImage(img, x - ax * k, y - ay * k, w * k, h * k); this.g.restore();
  }
}
export { hexRgb, mixHex, rgbHex };
export type { V3 };
