// Pixelkeep's own pixel pass for painted pictures (arena backdrops, maps, key art, Bastion grounds, effect cells):
// cut a canvas into square blocks, snap every block to the five-level console palette, and where a colour sits
// halfway between two palette colours lay it down as a checkerboard dither. The kit's `pixel` look does this for
// models; nothing in the kit does it for paintings.
import { LEVELS } from "./style";

const STEP = 255 / (LEVELS - 1);

/** Snap one channel to the palette; `odd` picks the upper neighbour for in-between values (the checker dither). */
function snap(v: number, odd: boolean, dither: boolean): number {
  const f = v / STEP, lo = Math.floor(f), fr = f - lo;
  const up = !dither ? fr >= 0.5 : fr > 0.68 || (fr >= 0.32 && odd);
  return Math.round(Math.min(LEVELS - 1, lo + (up ? 1 : 0)) * STEP);
}

/** Pixelate a region of a canvas in place: `b` canvas pixels per art pixel. `alpha`: also harden the alpha channel
 *  (for sprites and effect cells; "soft" steps it in quarters instead, so a faint glow stays faint); otherwise the region
 *  is treated as opaque. */
export function pixelate(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, b: number, o: { dither?: boolean; alpha?: boolean | "soft"; cut?: number } = {}) {
  const img = g.getImageData(x0, y0, w, h), d = img.data, dither = o.dither ?? true, cut = o.cut ?? (o.alpha === "soft" ? 32 : 96);
  for (let by = 0; by * b < h; by++) for (let bx = 0; bx * b < w; bx++) {
    // the middle of the block decides its colour
    let r = 0, gg = 0, bl = 0, a = 0, n = 0;
    const c0 = Math.max(0, Math.floor(b / 2) - 1), c1 = Math.min(b - 1, c0 + 1);
    for (let yy = c0; yy <= c1; yy++) for (let xx = c0; xx <= c1; xx++) {
      const x = bx * b + xx, y = by * b + yy;
      if (x >= w || y >= h) continue;
      const i = (y * w + x) * 4, al = d[i + 3];
      r += d[i] * al; gg += d[i + 1] * al; bl += d[i + 2] * al; a += al; n++;
    }
    if (!n) continue;
    const al = a / n, odd = ((bx + by) & 1) === 1;
    const on = !o.alpha || al >= cut;
    const R = on && a ? snap(r / a, odd, dither) : 0, G = on && a ? snap(gg / a, odd, dither) : 0, B = on && a ? snap(bl / a, odd, dither) : 0;
    for (let yy = 0; yy < b; yy++) for (let xx = 0; xx < b; xx++) {
      const x = bx * b + xx, y = by * b + yy;
      if (x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = !on ? 0 : o.alpha === "soft" ? Math.min(255, Math.round(al / 64) * 64) : 255;
    }
  }
  g.putImageData(img, x0, y0);
}

/** Mix two "#rrggbb" colours half and half: painted flat, the pixel pass turns it into their checkerboard. */
export function dither(a: string, b: string): string {
  const ch = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map((i) => Math.round((ch(a, i) + ch(b, i)) / 2).toString(16).padStart(2, "0")).join("");
}
