// Inkfall's battle canvas is the base BoardView with one painter replaced: fire. The base draws a burning hall's
// flames as additive orange light, which on pale paper is a faint peach smear. Here a flame is brushwork: a tongue of
// black ink that flickers, with a smaller tongue of seal red inside it (the same for both clans' halls, so it never
// reads as a side's colour).
import { BoardView } from "@base/render/board";

export * from "@base/render/board";

interface FlamePainter { ctx: CanvasRenderingContext2D; time: number; drawFlame(x: number, y: number, size: number, seed: number): void }

(BoardView.prototype as unknown as FlamePainter).drawFlame = function (this: FlamePainter, x, y, size, seed) {
  const ctx = this.ctx, t = this.time * 9 + seed * 1.7;
  ctx.save();
  for (const [k, col, w] of [[1, "rgba(29,26,23,0.86)", 1], [0.56, "rgba(200,50,30,0.95)", 0.56]] as [number, string, number][]) {
    const hgt = size * k * (1.9 + 0.4 * Math.sin(t + k * 3) + 0.22 * Math.sin(t * 2.3 + seed));
    const half = size * w * 0.5, lean = Math.sin(t * 0.7 + seed) * size * 0.26;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - half, y);
    ctx.quadraticCurveTo(x - half * 1.25, y - hgt * 0.5, x + lean, y - hgt);
    ctx.quadraticCurveTo(x + half * 0.9, y - hgt * 0.55, x + half, y);
    ctx.quadraticCurveTo(x, y + half * 0.5, x - half, y);
    ctx.fill();
  }
  // two flecks of ink flung off the tip
  ctx.fillStyle = "rgba(29,26,23,0.7)";
  for (let i = 0; i < 2; i++) {
    const u = (t * 0.11 + i * 0.5 + seed * 0.37) % 1;
    ctx.globalAlpha = 1 - u;
    ctx.beginPath(); ctx.arc(x + Math.sin(seed + i * 2.1 + u * 3) * size * 0.5, y - size * (1.6 + u * 1.8), Math.max(0.8, size * 0.1 * (1 - u * 0.6)), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
};
