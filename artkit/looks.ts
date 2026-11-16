// Looks: whole-sprite post-processing chosen by a game's Style, so the same models can ship with a radically
// different feel. "toon" (the default), "neon" and "paper" are shaded inside the renderer (toon3d.ts reads
// style.look); "pixel" renders small and scales up with hard pixels and a short palette, here.
import { render, type Model, type RenderOpts, type Sprite, type Style } from "./toon3d";

/** Render a model in the style's look. Use this everywhere a sprite is made for a game. */
export function shoot(m: Model, o: RenderOpts): Sprite {
  const lk = o.style.look;
  if (lk?.kind !== "pixel") return render(m, o);
  const scale = Math.max(2, Math.round(lk.scale)), levels = Math.max(2, lk.levels ?? 6);
  const k = (o.ppu / scale) / 128;
  // one small pixel of ink, whatever the scale
  const st: Style = { ...o.style, outline: 1 / k, inner: 0.9 / k, glow: { ...o.style.glow, radius: o.style.glow.radius * 0.6 } };
  const s = render(m, { ...o, ppu: o.ppu / scale, style: st, ss: 2, shadow: undefined });
  const q = 255 / (levels - 1);
  const w = s.w * scale, h = s.h * scale;
  const data = s.data.map((d) => {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const i = (y * s.w + x) * 4;
      if (d[i + 3] < 110) continue;
      const r = Math.round(d[i] / q) * q, g = Math.round(d[i + 1] / q) * q, b = Math.round(d[i + 2] / q) * q;
      for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
        const j = ((y * scale + yy) * w + x * scale + xx) * 4;
        out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
      }
    }
    return out;
  });
  return { w, h, ax: s.ax * scale, ay: s.ay * scale, data };
}

/** Ready-made styles to start a game from (spread one and change what you like). */
export const LOOKS = {
  /** Thick warm ink, three soft bands, violet shadows: the base game's feel. */
  toon: (): Partial<Style> => ({ look: { kind: "toon" } }),
  /** Chunky pixels: `scale` output pixels per art pixel, `levels` shades per channel. */
  pixel: (scale = 3, levels = 6): Partial<Style> => ({ look: { kind: "pixel", scale, levels }, rim: { color: "#ffffff", strength: 0, width: 0.3 } }),
  /** Dark fills with glowing edges in each part's own colour. */
  neon: (fill = 0.16): Partial<Style> => ({ look: { kind: "neon", fill }, outline: 2.2, inner: 1.4, glow: { gain: 1, radius: 8 }, rim: { color: "#ffffff", strength: 0, width: 0.3 } }),
  /** Ink on paper: pale washes, hatched shadows, a heavy black line. */
  paper: (paper = "#f1e6cf"): Partial<Style> => ({ look: { kind: "paper", paper }, ink: "#1d1a17", outline: 3.4, inner: 1.8, rim: { color: "#ffffff", strength: 0, width: 0.3 } }),
};
