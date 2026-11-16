// Effect sheets (public/vfx/atlas.json + its image, loaded by base/src/render/vfx.ts). A game starts from the base
// game's atlas, which is mostly greyscale light, smoke and debris that the runtime tints, and then:
//   grade   recolours any sheet (soot instead of soil, verdigris instead of slime),
//   models  redraws a sheet's frames from toon-3D models (projectiles and thrown things in the game's own style),
//   paint   redraws a sheet's frames with 2D canvas calls.
// The sheet list, cell sizes, anchors and blend modes never change, so the renderer needs nothing new.
import type { Model } from "./toon3d";

export interface Grade {
  /** Multiply saturation and brightness (1 = unchanged). */
  saturation?: number; brightness?: number;
  /** Pull every colour towards this one by `amount` (0..1), keeping its light and dark. */
  tint?: string; amount?: number;
}
export interface VfxArt {
  /** Recolour sheets by name ("*" applies to every sheet that carries its own colour, i.e. is not runtime-tinted). */
  grade?: Record<string, Grade>;
  /** Redraw a sheet from a model, one call per frame (f of n). The model is seen from the side, facing +x (screen
   *  right), z up; the sheet's anchor is the origin and the cell is `1` unit tall (so a cell twice as wide as tall
   *  spans x from -1 to 1). */
  models?: Record<string, (m: Model, f: number, n: number) => void>;
  /** Redraw a sheet in 2D, one call per frame, in a w x h pixel cell (origin at the cell's top left). */
  paint?: Record<string, (g: CanvasRenderingContext2D, f: number, n: number, w: number, h: number) => void>;
}
/** One sheet of the atlas manifest. */
export interface VfxSheet { x: number; y: number; w: number; h: number; frames: number; cols: number; gap: number; tint: boolean; blend: string; anchor: [number, number]; }

/** Apply a grade to RGBA pixels in place. */
export function gradePixels(p: Uint8ClampedArray, g: Grade) {
  const sat = g.saturation ?? 1, br = g.brightness ?? 1, amt = g.amount ?? (g.tint ? 0.6 : 0);
  const t = g.tint ? [parseInt(g.tint.slice(1, 3), 16), parseInt(g.tint.slice(3, 5), 16), parseInt(g.tint.slice(5, 7), 16)] : [0, 0, 0];
  const tl = Math.max(1, 0.3 * t[0] + 0.59 * t[1] + 0.11 * t[2]);
  for (let i = 0; i < p.length; i += 4) {
    if (!p[i + 3]) continue;
    const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
    for (let c = 0; c < 3; c++) {
      let v = (l + (p[i + c] - l) * sat) * br;
      if (amt) v = v + ((t[c] / tl) * l * br - v) * amt;
      p[i + c] = v;
    }
  }
}
