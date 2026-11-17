// The lens: what happens to the finished battle picture before the player sees it. A game sets `post` in its
// ../game/terrain.ts to grade, grain, bloom, fog, scanline or palette-crush the whole frame, which is most of what
// separates a gritty war film from a cartridge game from a storybook. Everything here is plain canvas compositing
// (no filters, which phones' browsers lack), so it runs the same in the app.
export interface Post {
  /** Canvas pixels per CSS pixel are divided by this: 3 = chunky pixels three CSS pixels wide (retro games). */
  lowres?: number;
  /** 1 = as drawn, 0 = black and white. */
  saturation?: number;
  /** 0..1: deepen darks and lift lights. */
  contrast?: number;
  /** Colour washes over the frame: [colour, strength 0..1, blend] ("multiply" grades, "soft-light" tints, "screen" lifts, "color" recolours). */
  grade?: [string, number, GlobalCompositeOperation][];
  /** 0..1: glow bleeding out of the bright parts. */
  bloom?: number;
  /** 0..1: dark corners. */
  vignette?: number;
  /** 0..1: film grain. */
  grain?: number;
  /** 0..1: dark horizontal lines (a tube TV). */
  scan?: number;
  /** Haze over the far part of the scene: colour and strength. */
  fog?: [string, number];
  /** Crush the frame to these colours (only sensible with `lowres`), with ordered dithering between neighbours. */
  palette?: string[];
  dither?: number;
}

let small: HTMLCanvasElement | undefined, noise: HTMLCanvasElement | undefined, scanP: HTMLCanvasElement | undefined;
const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const palCache = new Map<string, number[][]>();

/** Apply a game's lens to the canvas (device pixels; the context's transform is reset and restored). */
export function applyPost(ctx: CanvasRenderingContext2D, P: Post | undefined, time: number, area?: { x: number; y: number; w: number; h: number }, dpr = 1) {
  if (!P) return;
  const c = ctx.canvas, w = c.width, h = c.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  if (P.fog) {
    const y0 = (area?.y ?? 0) * dpr, hh = (area?.h ?? h / dpr) * dpr;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + hh * 0.75);
    ctx.globalAlpha = P.fog[1];
    g.addColorStop(0, P.fog[0]); g.addColorStop(1, "rgba(0,0,0,0)");
    // a gradient to transparent black would grey the colour; fade by a second stop of the same colour at zero alpha
    const m = P.fog[0].match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); const gg = ctx.createLinearGradient(0, y0, 0, y0 + hh * 0.75); gg.addColorStop(0, P.fog[0]); gg.addColorStop(1, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},0)`); ctx.fillStyle = gg; } else ctx.fillStyle = g;
    ctx.fillRect(0, y0, w, hh * 0.75);
    ctx.globalAlpha = 1;
  }
  if (P.bloom && P.bloom > 0) {
    const sw = Math.max(8, w >> 3), sh = Math.max(8, h >> 3);
    if (!small || small.width !== sw || small.height !== sh) small = mk(sw, sh);
    const sg = small.getContext("2d")!;
    sg.globalCompositeOperation = "source-over"; sg.globalAlpha = 1;
    sg.imageSmoothingEnabled = true;
    sg.drawImage(c, 0, 0, sw, sh);
    // keep only the bright parts: multiply the small copy by itself twice
    sg.globalCompositeOperation = "multiply"; sg.drawImage(small, 0, 0); sg.drawImage(small, 0, 0);
    ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, P.bloom);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, w, h);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }
  if (P.contrast && P.contrast > 0) { ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = Math.min(1, P.contrast); ctx.drawImage(c, 0, 0); ctx.globalAlpha = 1; }
  if (P.saturation !== undefined && P.saturation < 1) { ctx.globalCompositeOperation = "saturation"; ctx.globalAlpha = 1 - Math.max(0, P.saturation); ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  for (const [col, k, op] of P.grade ?? []) { ctx.globalCompositeOperation = op; ctx.globalAlpha = k; ctx.fillStyle = col; ctx.fillRect(0, 0, w, h); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  if (P.vignette && P.vignette > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.56);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${Math.min(1, P.vignette)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (P.grain && P.grain > 0) {
    if (!noise) {
      noise = mk(256, 256);
      const ng = noise.getContext("2d")!, id = ng.createImageData(256, 256);
      let s = 12345;
      for (let i = 0; i < id.data.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const v = 128 + (((s >> 8) & 255) - 128) * 0.9; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      ng.putImageData(id, 0, 0);
    }
    const f = Math.floor(time * 24), ox = (f * 73) % 256, oy = (f * 151) % 256, k = Math.max(1, Math.round(dpr));
    ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = Math.min(1, P.grain);
    ctx.imageSmoothingEnabled = false;
    for (let y = -oy * k; y < h; y += 256 * k) for (let x = -ox * k; x < w; x += 256 * k) ctx.drawImage(noise, x, y, 256 * k, 256 * k);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  }
  if (P.palette?.length && w * h <= 600000) {
    const key = P.palette.join(","); let pal = palCache.get(key);
    if (!pal) { pal = P.palette.map((p) => { const n = parseInt(p.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }); palCache.set(key, pal); }
    const id = ctx.getImageData(0, 0, w, h), d = id.data, dz = (P.dither ?? 0.5) * 48, memo = new Map<number, number>();
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
      const t = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * dz;
      const r = Math.max(0, Math.min(255, d[i] + t)) & 0xf8, g = Math.max(0, Math.min(255, d[i + 1] + t)) & 0xf8, b = Math.max(0, Math.min(255, d[i + 2] + t)) & 0xf8;
      const k = (r << 16) | (g << 8) | b; let best = memo.get(k);
      if (best === undefined) { let bd = 1e9; best = 0; for (let j = 0; j < pal.length; j++) { const q = pal[j], dr = q[0] - r, dg = q[1] - g, db = q[2] - b, dd = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; if (dd < bd) { bd = dd; best = j; } } memo.set(k, best); }
      const q = pal[best]; d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
    }
    ctx.putImageData(id, 0, 0);
  }
  if (P.scan && P.scan > 0) {
    const k = Math.max(2, Math.round(dpr * 3));
    if (!scanP || scanP.height !== k) { scanP = mk(4, k); const sg = scanP.getContext("2d")!; sg.fillStyle = "#000"; sg.fillRect(0, k - Math.max(1, k >> 1), 4, Math.max(1, k >> 1)); }
    ctx.globalAlpha = Math.min(1, P.scan); ctx.fillStyle = ctx.createPattern(scanP, "repeat")!; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
