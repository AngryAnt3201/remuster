// Pixelkeep's combat-feel drawing. The battle canvas is a low-resolution pixel screen (./board.ts), so the base
// game's rounded bars and smooth outlined numbers would come out as a blur of a few pixels. Health bars, damage
// numbers and ability callouts are redrawn here on whole canvas pixels: segmented bars, bitmap-font numbers with a
// one-pixel black edge, and callouts in a black window with a white border.
import type { Camera } from "@base/render/camera";
import type { Float } from "@base/render/fx";
import type { Callout, HpShown } from "@base/render/juice";
import { GOLD, TEAM } from "@base/render/palette";
import type { Side } from "@engine/core/defs";

export { drawBanner, drawTrail } from "@base/render/juicedraw";

const FONT = `"Press Start 2P", ui-monospace, Menlo, monospace`;
const INK = "#000000";
// the canvas font is the page's bundled bitmap font: ask for it early so the first number is not drawn in the fallback
if (typeof document !== "undefined") void document.fonts?.load(`8px "Press Start 2P"`);

/** The canvas pixel under a point in the current transform. */
function px(ctx: CanvasRenderingContext2D, x: number, y: number): [number, number, number] {
  const t = ctx.getTransform();
  return [Math.round(t.a * x + t.c * y + t.e), Math.round(t.b * x + t.d * y + t.f), Math.hypot(t.a, t.b)];
}
/** Bitmap text centred on a canvas pixel, with a one-pixel black edge. `size` is a multiple of 8. */
function pixelText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, fill: string, edge = INK) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  const x = cx - Math.round((text.length * size) / 2), y = cy - size / 2, e = size / 8;
  ctx.fillStyle = edge;
  for (const [dx, dy] of [[-e, 0], [e, 0], [0, -e], [0, e], [e, e]]) ctx.fillText(text, x + dx, y + dy);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** A hard contact shadow and a team-coloured ring of at least one canvas pixel. */
export function shadowRing(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, r: number, alpha: number, side: Side | null, ring = 1) {
  ctx.save();
  ctx.fillStyle = "#000020";
  ctx.globalAlpha = Math.min(1, alpha * 1.2);
  ctx.beginPath(); cam.groundPath(ctx, x + r * 0.05, y + r * 0.06, r); ctx.fill();
  if (side !== null && ring > 0) {
    const k = Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1;
    ctx.globalAlpha = Math.min(1, alpha * 2.2) * ring;
    ctx.strokeStyle = TEAM[side].main;
    ctx.lineWidth = 1.3 / k;
    ctx.beginPath(); cam.groundPath(ctx, x, y, r * 1.3); ctx.stroke();
  }
  ctx.restore();
}

/** A segmented health bar on whole canvas pixels: a black frame, team-coloured cells, the cells just lost in white. */
export function hpBar(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, hp: HpShown, side: Side, now: number) {
  const [X, Y, k] = px(ctx, cx, top);
  const cells = Math.max(3, Math.round((w * k) / 3)), W = cells * 3 + 1, x0 = X - (W >> 1);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = INK;
  ctx.fillRect(x0, Y, W, 4);
  const full = Math.ceil(hp.frac * cells - 1e-6), lag = Math.ceil(hp.lag * cells - 1e-6);
  for (let i = 0; i < cells; i++) {
    ctx.fillStyle = i < full ? (hp.frac < 0.3 && side === 0 ? "#ffbf00" : TEAM[side].main) : i < lag ? (now - hp.hitAt < 0.08 ? "#ffffff" : "#ffff80") : "#404040";
    ctx.fillRect(x0 + 1 + i * 3, Y + 1, 2, 2);
  }
  ctx.restore();
}

/** A floating number in the bitmap font: pops up a few pixels and blinks out. Crits rise further, on a red edge. */
export function drawFloat(ctx: CanvasRenderingContext2D, f: Float, x: number, y: number, _s: number) {
  const u = 1 - f.life / f.max, kind = f.kind ?? "text", crit = kind === "crit";
  if (u > 0.8 && Math.floor(u * 40) % 2) return; // blink out, like a sprite about to despawn
  const [X, Y] = px(ctx, x, y);
  const rise = Math.round((1 - (1 - Math.min(1, u * 1.6)) ** 3) * (crit ? 12 : 9));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  pixelText(ctx, f.text, X, Y - rise, 8, f.color, crit ? "#800000" : kind === "heal" ? "#004000" : INK);
  ctx.restore();
}

/** A Max Level ability callout: a flash of gold blocks round the unit, then its name in a console text window. */
export function drawCallout(ctx: CanvasRenderingContext2D, cam: Camera, c: Callout, headY: number | null, _now: number) {
  const u = 1 - c.life / c.max;
  const p = cam.project(c.x, c.y, 0.6);
  const [X, Y, k] = px(ctx, p.x, headY ?? p.y - p.s * 0.9);
  const [, FY] = px(ctx, p.x, p.y - p.s * 0.3);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (u < 0.4) {
    const R = Math.round(p.s * k * (0.4 + 1.4 * (u / 0.4)));
    ctx.fillStyle = Math.floor(u * 30) % 2 ? GOLD : "#ffffff";
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.fillRect(X + Math.round(Math.cos(a) * R) - 1, FY + Math.round(Math.sin(a) * R * 0.7) - 1, 3, 3); }
  }
  if (u < 0.9 || Math.floor(u * 40) % 2 === 0) {
    const text = c.text.toUpperCase(), w = text.length * 8 + 8, x0 = Math.max(1, Math.min(ctx.canvas.width - w - 1, X - (w >> 1))), y0 = Y - 22 - Math.round(Math.min(1, u / 0.12) * 4);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 16);
    ctx.fillStyle = TEAM[c.side].dark; ctx.fillRect(x0, y0, w, 14);
    pixelText(ctx, text, x0 + (w >> 1), y0 + 7, 8, "#ffffff");
  }
  ctx.restore();
}
