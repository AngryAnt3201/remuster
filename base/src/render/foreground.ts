// Arena layers drawn around the units (see arena.ts and art/arenas/render_arenas.py):
//  - the foreground: border canopy, boughs and banners that overhang the board edge, rendered in Blender through the
//    game camera as act<n>_fg.webp (the same frame as the backdrop) and drawn over the units. It is cut into cells
//    (each side in bands); a cell fades out while a unit's screen box overlaps it, so units under it stay readable.
//  - ambient motion under the units: water glints on the Fen's mere, cloud wisps drifting past the Sky Throne,
//    spray off the Saltwind cliffs and embers rising from the Crownfall braziers (all outside the board but the glints).
// Render-only: the sim never sees any of it, and obstacles and lanes are untouched.
import { H, W, ZONE_DEPTH } from "@engine/core/defs";
import { backdropRect, type Arena } from "./arena";
import type { Camera, Rect } from "./camera";
import { AMBIENT, AmbientLife } from "./ambient";

/** Alpha of a foreground cell with a unit under it. */
export const FG_FADED = 0.4;

/** Screen rects of the foreground cells (stored as fractions of the backdrop) for a backdrop drawn at `r`. */
export function fgCells(cells: readonly (readonly number[])[], r: Rect): Rect[] {
  return cells.map(([x, y, w, h]) => ({ x: r.x + x * r.w, y: r.y + y * r.h, w: w * r.w, h: h * r.h }));
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Target alpha per cell: FG_FADED where any unit box overlaps it, else 1. */
export function fadeTargets(cells: readonly Rect[], boxes: readonly Rect[], faded = FG_FADED): number[] {
  return cells.map((c) => (boxes.some((b) => overlaps(c, b)) ? faded : 1));
}

/** The part of a cell under the figures overlapping it: the cell clipped to their bounding box (null if none). */
export function clipTo(cell: Rect, boxes: readonly Rect[]): Rect | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    if (!overlaps(cell, b)) continue;
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  if (x1 < x0) return null;
  x0 = Math.max(x0, cell.x); y0 = Math.max(y0, cell.y);
  x1 = Math.min(x1, cell.x + cell.w); y1 = Math.min(y1, cell.y + cell.h);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

/** Eases alphas toward their targets in place: out quickly (a unit walked under), back in slowly. */
export function easeAlphas(cur: number[], target: readonly number[], dt: number): void {
  for (let i = 0; i < target.length; i++) {
    const a = cur[i] ?? target[i], t = target[i];
    const rate = t < a ? 9 : 2.5;
    cur[i] = a + (t - a) * Math.min(1, dt * rate);
  }
  cur.length = target.length;
}

/** A standing figure's screen box from its ground contact point: about a body wide and two tall (more for flyers). */
export function unitBox(cam: Camera, x: number, y: number, z = 0): Rect {
  const p = cam.project(x, y, 0), s = p.s;
  const lift = z * s * 0.75;
  return { x: p.x - 0.6 * s, y: p.y - 1.9 * s - lift, w: 1.2 * s, h: 2.0 * s };
}

interface Pos { x: number; y: number; z?: number; alive?: boolean; burrowed?: boolean; flying?: boolean }
/** The scene's figures: bodies in a battle, pieces and the ghost while deploying. */
export function sceneFigures(scene: { mode: string; battle?: { bodies: Pos[] }; pieces?: Pos[]; ghost?: Pos }): Pos[] {
  if (scene.mode === "battle") return (scene.battle?.bodies ?? []).filter((b) => b.alive !== false && !b.burrowed);
  return [...(scene.pieces ?? []), ...(scene.ghost ? [scene.ghost] : [])];
}

/** Deterministic 0..1 noise. */
const rnd = (i: number, k: number) => Math.abs(Math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1;

/** Water glint spots on the Fen's mere (between the zones, off the boardwalk), world coordinates. */
export function glintSpots(n = 22): { x: number; y: number; ph: number }[] {
  const out: { x: number; y: number; ph: number }[] = [];
  for (let i = 0; out.length < n && i < n * 6; i++) {
    const x = 0.3 + rnd(i, 7) * (W - 0.6), y = ZONE_DEPTH + 0.3 + rnd(i, 11) * (H - 2 * ZONE_DEPTH - 0.6);
    const px = 4.5 + 0.32 * Math.sin(((y + 6.0) / 0.6) * 0.55); // the boardwalk's centre (render_arenas.py path_x)
    if (Math.abs(x - px) < 0.95) continue;
    out.push({ x, y, ph: rnd(i, 13) * Math.PI * 2 });
  }
  return out;
}

/** Where the Coast's spray and the Citadel's embers rise: just outside the board's side edges, world coordinates. */
export function sideSpots(n = 14): { x: number; y: number; ph: number }[] {
  const out: { x: number; y: number; ph: number }[] = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2;
    out.push({ x: side ? W + 0.75 + 0.5 * rnd(i, 3) : -0.75 - 0.5 * rnd(i, 3), y: -0.6 + rnd(i, 5) * (H + 1.2), ph: rnd(i, 7) });
  }
  return out;
}

const TAU = Math.PI * 2;

export class ArenaLayers {
  private alpha: number[] = [];
  private forFile = "";
  private last = -1;
  private wisp?: HTMLCanvasElement;
  private glints = glintSpots();
  private sides = sideSpots();

  private life = new AmbientLife();

  /** Ambient life in the air, over the units: motes, butterflies and the flock (ambient.ts). Off in calm mode. */
  overhead(ctx: CanvasRenderingContext2D, a: Arena, cam: Camera, time: number, calm = false) {
    const cfg = AMBIENT[a.info.obstacle];
    if (cfg && !calm) this.life.air(ctx, cfg, cam, time);
  }

  /** Ambient motion on the ground, under the units. */
  ambient(ctx: CanvasRenderingContext2D, a: Arena, cam: Camera, time: number, calm = false) {
    const cfg = AMBIENT[a.info.obstacle];
    if (cfg && !calm) this.life.ground(ctx, cfg, cam, time);
    if (a.info.obstacle === "fenlamp") this.shimmer(ctx, cam, time);
    else if (a.info.obstacle === "obelisk") this.clouds(ctx, a, cam, time);
    else if (a.info.obstacle === "seastack") this.rise(ctx, cam, time, "#f2fbff", 0.5, 1.6);
    else if (a.info.obstacle === "brokencolumn") this.rise(ctx, cam, time, "#ffb04d", 0.35, 2.2);
  }

  /** Motes rising off the side edges and fading as they climb: sea spray on the Coast, embers in the Citadel. */
  private rise(ctx: CanvasRenderingContext2D, cam: Camera, time: number, col: string, speed: number, top: number) {
    ctx.save();
    ctx.fillStyle = col;
    for (const m of this.sides) {
      const t = (time * speed * 0.25 + m.ph) % 1;
      const p = cam.project(m.x + Math.sin(time * 0.9 + m.ph * TAU) * 0.15, m.y, t * top);
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.75;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, p.s * 0.035 * (1 - t * 0.5)), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Small glints on the mere that swell and fade, a few at a time. */
  private shimmer(ctx: CanvasRenderingContext2D, cam: Camera, time: number) {
    ctx.save();
    ctx.fillStyle = "#e6fbff";
    for (const g of this.glints) {
      const w = Math.sin(time * 1.3 + g.ph);
      if (w <= 0.35) continue;
      const p = cam.project(g.x + Math.sin(time * 0.4 + g.ph) * 0.06, g.y), s = p.s;
      ctx.globalAlpha = (w - 0.35) * 1.1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * (0.07 + 0.06 * w), s * 0.022, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Soft cloud wisps drifting through the sky beyond the far and near rails (outside the board, so no clip). */
  private clouds(ctx: CanvasRenderingContext2D, a: Arena, cam: Camera, time: number) {
    const r = backdropRect(a.m, cam.k, cam.cx, cam.cy);
    if (!this.wisp) {
      const c = document.createElement("canvas");
      c.width = 128; c.height = 64;
      const g = c.getContext("2d")!;
      for (const [x, y, rr] of [[40, 34, 26], [70, 28, 30], [96, 36, 22]]) {
        const gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, "rgba(255,255,255,0.75)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
      }
      this.wisp = c;
    }
    const far = cam.project(0, -0.9).y, near = cam.project(0, H + 0.9).y;
    const span = r.w + 240;
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const top = i % 2 === 0;
      const y0 = top ? r.y : near, y1 = top ? far : r.y + r.h;
      const w = 90 + 60 * rnd(i, 9), hh = w * 0.5;
      if (y1 - y0 < hh * 0.6) continue;
      const y = y0 + hh * 0.3 + (y1 - y0 - hh * 0.6) * rnd(i, 5) - hh / 2;
      const x = r.x - 200 + ((rnd(i, 1) * span + time * (7 + 6 * rnd(i, 3))) % span);
      ctx.globalAlpha = 0.4 + 0.3 * rnd(i, 17);
      ctx.drawImage(this.wisp, x, y, w, hh);
    }
    ctx.restore();
  }

  /** The foreground over the units, each cell faded while a figure stands under it. */
  foreground(ctx: CanvasRenderingContext2D, a: Arena, cam: Camera, time: number, figures: readonly Pos[]) {
    const img = a.fg, info = a.info.fg;
    if (!img || !info?.cells.length) return;
    const r = backdropRect(a.m, cam.k, cam.cx, cam.cy);
    const cells = fgCells(info.cells, r);
    const boxes = figures.map((f) => unitBox(cam, f.x, f.y, f.flying ? (f.z ?? 1) : 0));
    const target = fadeTargets(cells, boxes);
    if (this.forFile !== info.file) { this.alpha = target.slice(); this.forFile = info.file; }
    const dt = this.last < 0 ? 0 : Math.max(0, Math.min(0.1, time - this.last));
    this.last = time;
    easeAlphas(this.alpha, target, dt);
    // The backdrop already holds this canopy at full strength, so drawing it again only shows where a figure was drawn
    // over it: each cell redraws just the part covering the figures under it, at the cell's eased alpha.
    const sx = img.naturalWidth / r.w, sy = img.naturalHeight / r.h;
    ctx.save();
    for (let i = 0; i < cells.length; i++) {
      if (target[i] >= 1) continue;
      const c = clipTo(cells[i], boxes);
      if (!c) continue;
      ctx.globalAlpha = this.alpha[i];
      ctx.drawImage(img, (c.x - r.x) * sx, (c.y - r.y) * sy, c.w * sx, c.h * sy, c.x, c.y, c.w, c.h);
    }
    ctx.restore();
  }
}

const layers = new WeakMap<object, ArenaLayers>();
/** One ArenaLayers per board (its fade state carries from frame to frame). */
export function arenaLayers(owner: object): ArenaLayers {
  let l = layers.get(owner);
  if (!l) layers.set(owner, (l = new ArenaLayers()));
  return l;
}
