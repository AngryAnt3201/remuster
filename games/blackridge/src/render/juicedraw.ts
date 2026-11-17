// Drawing for the combat-feel layer (juice.ts): ground shadows with team rings, HP bars with a draining damage segment,
// styled damage/heal/crit numbers, Ascended ability callouts, projectile trails and the round-end flourish.
// Flat fills and strokes only (no per-frame gradients or shadows), so a 24-unit battle stays cheap.
import type { Camera } from "@base/render/camera";
import type { Float } from "@base/render/fx";
import type { Banner, Callout, HpShown } from "@base/render/juice";
import { BANNER_LIFE } from "@base/render/juice";
import { GOLD, TEAM } from "@base/render/palette";
import type { Side } from "@engine/core/defs";

const TAU = Math.PI * 2;
const FONT = `"DIN Condensed", "Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", sans-serif`;
const INK = "#1d2330";
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOutBack = (u: number) => { const c = 1.9; return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2; };

/** A cool-toned contact shadow under the feet (one fill), plus a thin team ring so
 *  teal and red read at a glance. r in world units. */
export function shadowRing(ctx: CanvasRenderingContext2D, cam: Camera, x: number, y: number, r: number, alpha: number, side: Side | null, ring = 1) {
  ctx.save();
  const team = side !== null && ring > 0;
  if (team) {
    // A faint team-coloured base just wider than the shadow: the colour shows around the feet even in a crowd.
    ctx.globalAlpha = Math.min(1, alpha * 1.6) * 0.3 * ring;
    ctx.fillStyle = TEAM[side].main;
    ctx.beginPath(); cam.groundPath(ctx, x, y, r * 1.32); ctx.fill();
  }
  ctx.fillStyle = "#14202a";
  ctx.globalAlpha = alpha * 0.95;
  ctx.beginPath(); cam.groundPath(ctx, x + r * 0.07, y + r * 0.09, r * 0.98); ctx.fill();
  if (team) {
    const p = cam.project(x, y);
    ctx.globalAlpha = Math.min(1, alpha * 1.6) * 0.9 * ring;
    ctx.strokeStyle = TEAM[side].main;
    ctx.lineWidth = Math.max(1.5, p.s * 0.045);
    ctx.beginPath(); cam.groundPath(ctx, x, y, r * 1.32); ctx.stroke();
  }
  ctx.restore();
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2); ctx.closePath();
}

/** A slim rounded HP bar centred at (cx, top): ink frame, the light segment just lost (draining), then the team fill
 *  with a highlight. Pops in (scale + fade) over its first 0.15 s. */
export function hpBar(ctx: CanvasRenderingContext2D, cx: number, top: number, w: number, hp: HpShown, side: Side, now: number) {
  const h = 5;
  const k = clamp01((now - hp.seenAt) / 0.15);
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.translate(cx, top + h / 2);
  ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
  const x = -w / 2, y = -h / 2;
  ctx.fillStyle = "rgba(20,24,34,0.82)";
  pill(ctx, x - 1.5, y - 1.5, w + 3, h + 3); ctx.fill();
  if (hp.lag > hp.frac + 0.002) {
    ctx.fillStyle = now - hp.hitAt < 0.08 ? "#ffffff" : "#ffe3a3";
    pill(ctx, x, y, Math.max(h, w * hp.lag), h); ctx.fill();
  }
  if (hp.frac > 0) {
    const fw = Math.max(h, w * hp.frac);
    ctx.fillStyle = hp.frac < 0.3 && side === 0 ? "#f0b43c" : TEAM[side].main;
    pill(ctx, x, y, fw, h); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    pill(ctx, x + 1, y + 0.6, Math.max(0, fw - 2), h * 0.38); ctx.fill();
  }
  ctx.restore();
}

/** A floating number: pops in big and settles, rises with an ease-out, fades at the end. Crits are gold, larger and
 *  tilted with a hot outline; heals are green with a "+"; plain hits are white. Whole-pixel font sizes only. */
export function drawFloat(ctx: CanvasRenderingContext2D, f: Float, x: number, y: number, s: number) {
  const u = 1 - f.life / f.max;
  const kind = f.kind ?? "text";
  const crit = kind === "crit";
  const pop = u < 0.12 ? 1 + (crit ? 0.5 : 0.3) * (1 - u / 0.12) : 1;
  const rise = (1 - (1 - Math.min(1, u * 1.6)) ** 3) * s * (crit ? 0.32 : 0.24);
  const size = Math.max(7, Math.round(f.size * s * pop));
  ctx.save();
  ctx.globalAlpha *= u < 0.72 ? 1 : 1 - (u - 0.72) / 0.28;
  ctx.translate(Math.round(x), Math.round(y - rise));
  if (crit) ctx.rotate(-0.12);
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.26);
  ctx.strokeStyle = crit ? "#7a2a08" : kind === "heal" ? "#0d4a2a" : INK;
  ctx.strokeText(f.text, 0, 0);
  ctx.fillStyle = f.color;
  ctx.fillText(f.text, 0, 0);
  ctx.restore();
}

/** Ascended ability callout over the unit: a burst of gold rays and a ring, then the ability's name on a team ribbon
 *  that pops in, holds and lifts away. */
export function drawCallout(ctx: CanvasRenderingContext2D, cam: Camera, c: Callout, headY: number | null, now: number) {
  const u = 1 - c.life / c.max;
  const p = cam.project(c.x, c.y, 0.6);
  const s = p.s;
  const cy = headY ?? p.y - s * 0.9;
  ctx.save();
  // Burst: rays and a ring, first 0.45 of the life.
  if (u < 0.5) {
    const k = u / 0.5, R = s * (0.5 + 1.1 * Math.sqrt(k));
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (1 - k) * 0.5;
    ctx.fillStyle = GOLD;
    const n = 10, rot = now * 1.5 + c.x;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU, w = 0.11;
      ctx.moveTo(p.x + Math.cos(a) * R * 0.25, p.y - s * 0.3 + Math.sin(a) * R * 0.25 * 0.7);
      ctx.lineTo(p.x + Math.cos(a - w) * R, p.y - s * 0.3 + Math.sin(a - w) * R * 0.7);
      ctx.lineTo(p.x + Math.cos(a + w) * R, p.y - s * 0.3 + Math.sin(a + w) * R * 0.7);
    }
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "#fff6d6"; ctx.lineWidth = Math.max(1.5, s * 0.08 * (1 - k));
    ctx.beginPath(); ctx.ellipse(p.x, p.y - s * 0.3, R * 0.8, R * 0.56, 0, 0, TAU); ctx.stroke();
  }
  // Ribbon with the ability's name.
  const inK = clamp01(u / 0.16), outK = clamp01((u - 0.78) / 0.22);
  const sc = easeOutBack(inK) * (1 - 0.15 * outK);
  ctx.globalAlpha = Math.min(1, inK * 2) * (1 - outK);
  ctx.translate(p.x, cy - s * 0.45 - outK * s * 0.4);
  ctx.scale(sc, sc);
  const size = Math.max(10, Math.round(s * 0.3));
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const text = c.text.toUpperCase();
  const tw = ctx.measureText(text).width, bw = tw + size * 1.4, bh = size * 1.5;
  ctx.fillStyle = TEAM[c.side].dark ?? TEAM[c.side].main;
  ctx.beginPath();
  ctx.moveTo(-bw / 2 - bh * 0.35, -bh / 2 + bh * 0.25); ctx.lineTo(-bw / 2, -bh / 2); ctx.lineTo(bw / 2, -bh / 2);
  ctx.lineTo(bw / 2 + bh * 0.35, -bh / 2 + bh * 0.25); ctx.lineTo(bw / 2, bh / 2); ctx.lineTo(-bw / 2, bh / 2); ctx.closePath();
  ctx.fill();
  ctx.lineWidth = Math.max(2, size * 0.14); ctx.strokeStyle = GOLD; ctx.stroke();
  ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2.5, size * 0.22); ctx.strokeStyle = INK;
  ctx.strokeText(text, 0, 1);
  ctx.fillStyle = "#fff8e2";
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

/** A tapered fading trail through screen points (oldest first). */
export function drawTrail(ctx: CanvasRenderingContext2D, pts: readonly { x: number; y: number }[], color: string, width: number, alpha = 0.55) {
  const n = pts.length;
  if (n < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  for (let i = 1; i < n; i++) {
    const k = i / (n - 1);
    ctx.globalAlpha = alpha * k * k;
    ctx.lineWidth = Math.max(0.75, width * (0.25 + 0.75 * k));
    ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
  }
  ctx.restore();
}

/** Screen-space confetti for the round-end flourish (fixed per round: seeded from the banner start). */
const CONFETTI = Array.from({ length: 36 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  return { a: r(1) * TAU, v: 0.55 + r(2) * 0.6, spin: (r(3) - 0.5) * 14, w: 0.6 + r(4) * 0.8, c: i % 3 };
});

/** The board half of the round-end banner. It starts on the battle's "end" event, under the final blow's hit-stop,
 *  and frames the HUD's ribbon (game.ts shows it ~0.9 s later at 36% of the screen): victory throws slow gold rays
 *  and team confetti from the ribbon's spot, defeat closes a dusk vignette and drifts ash, a draw just dims. */
export function drawBanner(ctx: CanvasRenderingContext2D, b: Banner, area: { x: number; y: number; w: number; h: number }, cssH: number, calm: boolean) {
  const t = b.t, cx = area.x + area.w / 2, cy = cssH * 0.36 + 30;
  const fadeIn = clamp01(t / 0.35), fadeOut = clamp01((BANNER_LIFE - t) / 0.7), k = fadeIn * fadeOut;
  if (k <= 0) return;
  ctx.save();
  if (b.winner === 0) {
    if (!calm) {
      // Rays: long thin wedges turning slowly behind the ribbon.
      const R = Math.max(area.w, area.h) * (0.45 + 0.35 * fadeIn);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.16 * k;
      ctx.fillStyle = "#ffe7a3";
      ctx.beginPath();
      const n = 14, rot = t * 0.35;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - 0.09) * R, cy + Math.sin(a - 0.09) * R);
        ctx.lineTo(cx + Math.cos(a + 0.09) * R, cy + Math.sin(a + 0.09) * R);
      }
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // Confetti: bursts out of the ribbon spot, then flutters down.
      const cols = [TEAM[0].main, GOLD, "#ffffff"];
      for (const c of CONFETTI) {
        const tt = Math.max(0, t - 0.05), sp = c.v * area.w * 0.7;
        const x = cx + Math.cos(c.a) * sp * (1 - Math.exp(-tt * 3)) / 1.2;
        const y = cy + Math.sin(c.a) * sp * 0.6 * (1 - Math.exp(-tt * 3)) / 1.2 + tt * tt * 60;
        ctx.globalAlpha = k;
        ctx.fillStyle = cols[c.c];
        ctx.save(); ctx.translate(x, y); ctx.rotate(c.spin * tt + c.a); ctx.scale(1, Math.cos(tt * c.spin));
        ctx.fillRect(-3 * c.w, -1.6, 6 * c.w, 3.2);
        ctx.restore();
      }
    }
    // A warm lift over the whole board.
    ctx.globalAlpha = 0.1 * k;
    ctx.fillStyle = "#fff2c4";
    ctx.fillRect(area.x, area.y, area.w, area.h);
  } else {
    // Defeat (or draw): dusk closes in from the edges.
    const loss = b.winner === 1;
    ctx.globalAlpha = (loss ? 0.42 : 0.22) * k;
    ctx.fillStyle = loss ? "#2a1020" : "#1d2330";
    const e = Math.min(area.w, area.h) * 0.22 * fadeIn;
    ctx.fillRect(area.x, area.y, area.w, e);
    ctx.fillRect(area.x, area.y + area.h - e, area.w, e);
    ctx.globalAlpha = (loss ? 0.2 : 0.1) * k;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    if (loss && !calm) {
      ctx.fillStyle = "#c9b8c4";
      for (const c of CONFETTI) {
        const x = area.x + ((c.a / TAU) * area.w + Math.sin(t * 1.3 + c.spin) * 12);
        const y = area.y + ((c.v - 0.55) / 0.6) * area.h * 0.4 + t * 70 * c.w;
        ctx.globalAlpha = 0.5 * k;
        ctx.fillRect(x, y, 2.4 * c.w, 2.4 * c.w);
      }
    }
  }
  ctx.restore();
}
