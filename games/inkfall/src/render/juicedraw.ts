// Inkfall's combat-feel drawing: everything the battle canvas letters and marks on top of the painting, as ink.
//   - under every unit a faint grey wash and a brushed ring in its clan's colour (an open stroke, like an enso);
//   - health bars are a thin ink line with the clan's colour laid along it;
//   - numbers are brush lettering in black ink on a paper halo (crits in seal red, heals in celadon);
//   - a Master ability is called out on a slip of paper with a seal-red edge;
//   - victory is a fall of plum petals, defeat a wash of ink closing in from the edges.
// Flat fills and strokes only, as in the base file, so a full battle stays cheap.
import type { Camera } from "@base/render/camera";
import type { Float } from "@base/render/fx";
import type { Banner, Callout, HpShown } from "@base/render/juice";
import { BANNER_LIFE } from "@base/render/juice";
import { TEAM } from "@base/render/palette";
import type { Side } from "@engine/core/defs";
import { drawTrail as baseTrail } from "@base/render/juicedraw";
import { inkTone } from "./inktone";

const TAU = Math.PI * 2;
const FONT = `"Yuji Syuku", "Iowan Old Style", "Palatino Linotype", Palatino, "Songti SC", Georgia, serif`;
const INK = "#1d1a17", PAPER = "#f7f1e1", SEAL = "#c8321e";
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOutBack = (u: number) => { const c = 1.9; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };
// the canvas font is the page's bundled brush face: ask for it early so the first number is not drawn in the fallback
if (typeof document !== "undefined") void document.fonts?.load(`20px "Yuji Syuku"`);

/** A faint wash under the feet and an open brushed ring in the clan's colour. r in world units. */
export function shadowRing(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, r: number, alpha: number, side: Side | null, ring = 1) {
  ctx.save();
  ctx.fillStyle = "#3b3833";
  ctx.globalAlpha = alpha * 0.55;
  ctx.beginPath(); cam.groundPath(ctx, x + r * 0.06, y + r * 0.08, r * 1.02); ctx.fill();
  if (side !== null && ring > 0) {
    const p = cam.project(x, y), q = cam.project(x + r * 1.36, y), rx = Math.abs(q.x - p.x), ry = rx * 0.6;
    // the ring: one stroke, thick where the brush lands and thin where it lifts, not quite closed
    const a0 = (x * 1.7 + y * 2.3) % TAU, sweep = TAU * 0.86, n = 14;
    ctx.strokeStyle = TEAM[side].main; ctx.lineCap = "round";
    ctx.globalAlpha = Math.min(1, alpha * 2.4) * ring;
    const w = Math.max(1.6, p.s * 0.075);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1.15) / n;
      ctx.lineWidth = w * (1 - 0.72 * t0);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, a0 + t0 * sweep, a0 + Math.min(1, t1) * sweep); ctx.stroke();
    }
    ctx.globalAlpha = Math.min(1, alpha * 1.6) * 0.16 * ring;
    ctx.fillStyle = TEAM[side].main;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/** A thin ink line with the clan's colour laid along it: a hair of black the full width (with end ticks), the part
 *  just lost in pale grey, what is left as a thicker stroke of colour. Pops in over its first 0.15 s. */
export function hpBar(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, hp: HpShown, side: Side, now: number) {
  const k = clamp01((now - hp.seenAt) / 0.15), h = 4;
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.translate(cx, top + h / 2);
  ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
  const x = -w / 2;
  // a paper halo so the line reads over anything
  ctx.strokeStyle = "rgba(247,241,225,0.85)"; ctx.lineWidth = h + 3; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.stroke();
  ctx.lineCap = "butt";
  ctx.strokeStyle = INK; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 1, h / 2 + 0.5); ctx.lineTo(x + w + 1, h / 2 + 0.5); ctx.moveTo(x - 0.5, -h / 2); ctx.lineTo(x - 0.5, h / 2 + 1); ctx.moveTo(x + w + 0.5, -h / 2); ctx.lineTo(x + w + 0.5, h / 2 + 1); ctx.stroke();
  if (hp.lag > hp.frac + 0.002) {
    ctx.strokeStyle = now - hp.hitAt < 0.08 ? INK : "#a9a397"; ctx.lineWidth = h;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w * hp.lag, 0); ctx.stroke();
  }
  if (hp.frac > 0) {
    ctx.strokeStyle = TEAM[side].main; ctx.lineWidth = h;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + Math.max(1.5, w * hp.frac), 0); ctx.stroke();
  }
  ctx.restore();
}

/** A floating number in brush lettering: black ink on a paper halo, popping in and rising. Crits are seal red, larger
 *  and tilted; heals are celadon with a "+"; words (callouts) keep their own ink. */
export function drawFloat(ctx: CanvasRenderingContext2D, f: Float, x: number, y: number, s: number) {
  const u = 1 - f.life / f.max;
  const kind = f.kind ?? "text";
  const crit = kind === "crit";
  const pop = u < 0.12 ? 1 + (crit ? 0.5 : 0.3) * (1 - u / 0.12) : 1;
  const rise = (1 - (1 - Math.min(1, u * 1.6)) ** 3) * s * (crit ? 0.32 : 0.24);
  const size = Math.max(8, Math.round(f.size * s * pop * 1.08));
  ctx.save();
  ctx.globalAlpha *= u < 0.72 ? 1 : 1 - (u - 0.72) / 0.28;
  ctx.translate(Math.round(x), Math.round(y - rise));
  if (crit) ctx.rotate(-0.12);
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.3);
  ctx.strokeStyle = PAPER;
  ctx.strokeText(f.text, 0, 0);
  ctx.fillStyle = crit ? SEAL : kind === "heal" ? "#3f7a58" : kind === "dmg" ? INK : inkTone(f.color);
  ctx.fillText(f.text, 0, 0);
  ctx.restore();
}

/** A Master ability called out over the unit: a brushed ring opens round it, then the ability's name on a slip of
 *  paper with a bar of the clan's colour, which pops in, holds and lifts away. */
export function drawCallout(ctx: CanvasRenderingContext2D, cam: Camera, c: Callout, headY: number | null, now: number) {
  const u = 1 - c.life / c.max;
  const p = cam.project(c.x, c.y, 0.6);
  const s = p.s;
  const cy = headY ?? p.y - s * 0.9;
  ctx.save();
  if (u < 0.5) {
    const k = u / 0.5, R = s * (0.5 + 1.0 * Math.sqrt(k)), a0 = now * 1.2 + c.x;
    ctx.strokeStyle = INK; ctx.lineCap = "round"; ctx.globalAlpha = (1 - k) * 0.8;
    for (let i = 0; i < 12; i++) { ctx.lineWidth = Math.max(1, s * 0.11 * (1 - k) * (1 - 0.7 * (i / 12))); ctx.beginPath(); ctx.ellipse(p.x, p.y - s * 0.3, R * 0.8, R * 0.56, 0, a0 + (i / 12) * 5.4, a0 + ((i + 1.15) / 12) * 5.4); ctx.stroke(); }
    // a few flung drops
    ctx.fillStyle = INK;
    for (let i = 0; i < 7; i++) { const a = a0 + i * 0.9, d = R * (0.9 + 0.25 * ((i * 3) % 4) / 3); ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * d, p.y - s * 0.3 + Math.sin(a) * d * 0.7, Math.max(0.8, s * 0.035 * (1 - k)), 0, TAU); ctx.fill(); }
  }
  const inK = clamp01(u / 0.16), outK = clamp01((u - 0.78) / 0.22);
  const sc = easeOutBack(inK) * (1 - 0.15 * outK);
  ctx.globalAlpha = Math.min(1, inK * 2) * (1 - outK);
  ctx.translate(p.x, cy - s * 0.45 - outK * s * 0.4);
  ctx.scale(sc, sc);
  ctx.rotate(-0.03);
  const size = Math.max(11, Math.round(s * 0.31));
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const text = c.text.toUpperCase().split("").join(" ");
  const tw = ctx.measureText(text).width, bw = tw + size * 1.5, bh = size * 1.55;
  // the slip: paper with a slightly torn outline, a thin ink edge, a bar of the clan's colour down its left side
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(-bw / 2, -bh / 2 + 1); ctx.lineTo(-bw / 6, -bh / 2); ctx.lineTo(bw / 5, -bh / 2 + 1.2); ctx.lineTo(bw / 2, -bh / 2 + 0.4);
  ctx.lineTo(bw / 2 - 0.8, bh / 2 - 0.6); ctx.lineTo(bw / 8, bh / 2); ctx.lineTo(-bw / 4, bh / 2 - 1); ctx.lineTo(-bw / 2 + 0.6, bh / 2); ctx.closePath();
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.07); ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = TEAM[c.side].main;
  ctx.fillRect(-bw / 2, -bh / 2 + 1, Math.max(3, size * 0.32), bh - 2);
  ctx.fillStyle = INK;
  ctx.fillText(text, size * 0.16, 1);
  ctx.restore();
}

/** A projectile's trail: a tapering ink stroke in the tone that stands for its colour. */
export function drawTrail(ctx: CanvasRenderingContext2D, pts: readonly { x: number; y: number }[], color: string, width: number, alpha = 0.55) {
  baseTrail(ctx, pts, inkTone(color), width, alpha);
}

/** Petals and ash for the round-end flourish (fixed per round). */
const FLAKES = Array.from({ length: 44 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  return { x: r(1), y: r(2), v: 0.5 + r(3) * 0.7, sway: r(4) * TAU, spin: (r(5) - 0.5) * 6, w: 0.7 + r(6) * 0.8, c: i % 4 };
});

/** The board half of the round-end banner. Victory: plum petals fall across the field and the paper brightens.
 *  Defeat: ink washes in from the top and bottom edges and ash drifts down. A draw only dims. */
export function drawBanner(ctx: CanvasRenderingContext2D, b: Banner, area: { x: number; y: number; w: number; h: number }, _cssH: number, calm: boolean) {
  const t = b.t;
  const fadeIn = clamp01(t / 0.35), fadeOut = clamp01((BANNER_LIFE - t) / 0.7), k = fadeIn * fadeOut;
  if (k <= 0) return;
  ctx.save();
  if (b.winner === 0) {
    ctx.globalAlpha = 0.14 * k;
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(area.x, area.y, area.w, area.h);
    if (!calm) {
      const cols = ["#eeb0a4", "#f6d2ca", "#e58f80", TEAM[0].main];
      for (const c of FLAKES) {
        const x = area.x + ((c.x + Math.sin(t * 1.1 + c.sway) * 0.05 + t * 0.04) % 1) * area.w;
        const y = area.y - 20 + ((c.y * 0.9 + t * 0.2 * c.v) % 1.05) * (area.h + 40);
        ctx.globalAlpha = k * 0.95;
        ctx.fillStyle = cols[c.c];
        ctx.save(); ctx.translate(x, y); ctx.rotate(c.spin * t + c.sway); ctx.scale(1, 0.45 + 0.55 * Math.abs(Math.cos(t * 2.2 + c.sway)));
        ctx.beginPath(); ctx.ellipse(0, 0, 5.2 * c.w, 3.4 * c.w, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
  } else {
    const loss = b.winner === 1;
    const e = Math.min(area.w, area.h) * (loss ? 0.34 : 0.2) * fadeIn;
    for (const [y0, dir] of [[area.y, 1], [area.y + area.h, -1]] as [number, number][]) {
      const g = ctx.createLinearGradient(0, y0, 0, y0 + dir * e);
      g.addColorStop(0, `rgba(29,26,23,${(loss ? 0.72 : 0.4) * k})`); g.addColorStop(1, "rgba(29,26,23,0)");
      ctx.fillStyle = g;
      ctx.fillRect(area.x, Math.min(y0, y0 + dir * e), area.w, e);
    }
    ctx.globalAlpha = (loss ? 0.16 : 0.08) * k;
    ctx.fillStyle = INK;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    if (loss && !calm) {
      ctx.fillStyle = "#3b3833";
      for (const c of FLAKES) {
        const x = area.x + ((c.x + Math.sin(t * 1.3 + c.sway) * 0.03) % 1) * area.w;
        const y = area.y + ((c.y * 0.5 + t * 0.12 * c.v) % 1) * area.h;
        ctx.globalAlpha = 0.5 * k;
        ctx.beginPath(); ctx.arc(x, y, 1.6 * c.w, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.restore();
}
