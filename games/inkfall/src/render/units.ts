// Inkfall's rank marks. The base game floats gold chevrons (and a gold star at the top rank) over a unit; gold is
// not in this game's palette. Here a rank is ink: one dab per rank above the first, on a paper halo so it reads over
// anything, and at Master rank a small red seal.
import { roundRect } from "@base/render/units";

export * from "@base/render/units";

const INK = "#1d1a17", PAPER = "#f7f1e1", SEAL = "#c8321e";

/** Rank marks above a token. */
export function drawRank(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rank: number) {
  if (rank <= 1) return;
  ctx.save();
  ctx.translate(x, y - r - r * 0.42);
  if (rank >= 4) {
    const k = Math.max(4.5, r * 0.36);
    ctx.rotate(-0.1);
    ctx.fillStyle = PAPER; roundRect(ctx, -k - 1.5, -k - 1.5, k * 2 + 3, k * 2 + 3, 1.5); ctx.fill();
    ctx.fillStyle = SEAL; ctx.fillRect(-k, -k, k * 2, k * 2);
    ctx.strokeStyle = PAPER; ctx.lineWidth = Math.max(1, k * 0.2); ctx.strokeRect(-k * 0.5, -k * 0.5, k, k);
    ctx.restore();
    return;
  }
  // short brush dashes, one above the other (two dabs side by side read as a pair of eyes)
  const w = Math.max(7, r * 0.62), t = Math.max(2, r * 0.15), gap = t * 1.9, n = rank - 1;
  ctx.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    const yy = -i * gap;
    ctx.strokeStyle = pass ? INK : PAPER; ctx.lineWidth = t + (pass ? 0 : 2.4);
    ctx.beginPath(); ctx.moveTo(-w / 2, yy + t * 0.25); ctx.lineTo(w / 2, yy - t * 0.25); ctx.stroke();
  }
  ctx.restore();
}
