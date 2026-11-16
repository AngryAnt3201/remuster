// Pixelkeep's Arena terrain is the base game's (walls, huts, towers, hedges and crates built from game/terrain.ts)
// with one change: water. The base renderer draws ponds as rounded pools with a soft gradient and drifting ripples;
// a tile map has square water tiles with a two-frame sparkle. Only that one method is replaced.
import type { Block } from "@engine/core/terrain";
import { W } from "@engine/core/defs";
import type { Camera } from "@base/render/camera";
import { TerrainLayer } from "@base/render/terrain";
import { TERRAIN } from "../game/terrain";

export * from "@base/render/terrain";

const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

/** Square water: a dark bank one step wide, flat water with a deeper band along the near edge, and short white
 *  dashes that swap places twice a second. */
function water(ctx: CanvasRenderingContext2D, cam: Camera, b: Block, time: number) {
  const wt = TERRAIN.water;
  const x0 = Math.max(-0.2, b.x - b.w / 2), x1 = Math.min(W + 0.2, b.x + b.w / 2), y0 = b.y - b.h / 2, y1 = b.y + b.h / 2;
  const rect = (ax: number, ay: number, bx: number, by: number, col: string) => {
    const p = [cam.project(ax, ay), cam.project(bx, ay), cam.project(bx, by), cam.project(ax, by)];
    ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  };
  rect(x0 - 0.08, y0 - 0.08, x1 + 0.08, y1 + 0.08, wt.bank);
  rect(x0, y0, x1, y1, wt.shallow);
  rect(x0, y1 - Math.min(0.22, b.h * 0.25), x1, y1, wt.deep);
  const frame = Math.floor(time * 2) % 2;
  for (let ty = y0 + 0.18, row = 0; ty < y1 - 0.3; ty += 0.36, row++) {
    for (let tx = x0 + 0.12 + ((row + frame) % 2) * 0.36; tx < x1 - 0.3; tx += 0.72) {
      if (hash(Math.round(tx * 10), Math.round(ty * 10) + b.id) < 0.25) continue;
      rect(tx, ty, tx + 0.26, ty + 0.07, wt.foam);
    }
  }
}
// `water` is private in the base class, so it cannot be overridden by a subclass in TypeScript: swap the method.
(TerrainLayer.prototype as unknown as { water: (ctx: CanvasRenderingContext2D, cam: Camera, b: Block, time: number) => void }).water = water;
