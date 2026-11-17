// Surface textures, drawn in code: small grey tiles that are multiplied over a face's shaded colour (kit3d.ts), so
// one tile serves every colour and both light and shade. Light grey = no change, darker = joints, grime, seams.
import type { Texture } from "../game/terrain";

const SIZE = 128;
const cache = new Map<Texture, HTMLCanvasElement>();
function rnd(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

function speckle(g: CanvasRenderingContext2D, r: () => number, n: number, lo: number, hi: number, size = 2, alpha = 0.25) {
  for (let i = 0; i < n; i++) { const v = (lo + r() * (hi - lo)) | 0; g.fillStyle = `rgba(${v},${v},${v},${alpha})`; const s = 1 + r() * size; g.fillRect(r() * SIZE, r() * SIZE, s, s); }
}
function blotch(g: CanvasRenderingContext2D, r: () => number, n: number, dark: number, rad = 26) {
  for (let i = 0; i < n; i++) {
    const x = r() * SIZE, y = r() * SIZE, rr = rad * (0.4 + r());
    for (const [ox, oy] of [[0, 0], [SIZE, 0], [-SIZE, 0], [0, SIZE], [0, -SIZE]]) { // wraps, so the tile repeats cleanly
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
      gr.addColorStop(0, `rgba(0,0,0,${dark})`); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, SIZE, SIZE);
    }
  }
}

const DRAW: Record<Texture, (g: CanvasRenderingContext2D, r: () => number) => void> = {
  brick(g, r) {
    const bh = SIZE / 8, bw = SIZE / 4;
    for (let j = 0; j < 8; j++) for (let i = -1; i < 4; i++) { const v = 205 + r() * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * bw + (j % 2 ? bw / 2 : 0) + 1, j * bh + 1, bw - 2, bh - 2); }
    speckle(g, r, 500, 120, 255);
  },
  block(g, r) {
    const bh = SIZE / 4, bw = SIZE / 2;
    for (let j = 0; j < 4; j++) for (let i = -1; i < 2; i++) { const v = 200 + r() * 55; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * bw + (j % 2 ? bw / 2 : 0) + 1.5, j * bh + 1.5, bw - 3, bh - 3); }
    blotch(g, r, 5, 0.12); speckle(g, r, 700, 110, 255);
  },
  plank(g, r) {
    const pw = SIZE / 6;
    for (let i = 0; i < 6; i++) { const v = 205 + r() * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * pw + 1, 0, pw - 1.5, SIZE); for (let k = 0; k < 5; k++) { g.fillStyle = "rgba(60,60,60,0.18)"; g.fillRect(i * pw + 2 + r() * (pw - 4), 0, 1, SIZE); } if (r() > 0.4) { g.fillStyle = "rgba(40,40,40,0.5)"; g.fillRect(i * pw + 1, r() * SIZE, pw - 1.5, 1.5); } }
  },
  plate(g, r) {
    const p = SIZE / 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const v = 210 + r() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * p + 1.5, j * p + 1.5, p - 3, p - 3);
      g.fillStyle = "rgba(40,40,40,0.55)"; for (const [x, y] of [[6, 6], [p - 8, 6], [6, p - 8], [p - 8, p - 8]]) { g.beginPath(); g.arc(i * p + x + 1, j * p + y + 1, 2, 0, 7); g.fill(); }
    }
    for (let k = 0; k < 14; k++) { g.fillStyle = "rgba(70,50,40,0.16)"; const x = r() * SIZE; g.fillRect(x, r() * SIZE, 1.5 + r() * 2, 10 + r() * 30); } // rust runs
    speckle(g, r, 300, 130, 255);
  },
  stucco(g, r) { blotch(g, r, 7, 0.1, 30); speckle(g, r, 1800, 150, 255, 2, 0.3); },
  concrete(g, r) {
    blotch(g, r, 9, 0.16, 34); speckle(g, r, 2200, 110, 255, 2, 0.3);
    g.strokeStyle = "rgba(30,30,30,0.5)"; g.lineWidth = 1;
    for (let k = 0; k < 3; k++) { let x = r() * SIZE, y = r() * SIZE; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 6; i++) { x += (r() - 0.5) * 22; y += r() * 14; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = "rgba(30,30,30,0.35)"; g.fillRect(0, SIZE / 2 - 1, SIZE, 1.5); // a pour line
  },
  tech(g, r) {
    g.strokeStyle = "rgba(20,20,30,0.6)"; g.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { const x = ((k + 0.5) * SIZE) / 4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, SIZE); g.stroke(); }
    g.beginPath(); g.moveTo(0, SIZE * 0.3); g.lineTo(SIZE, SIZE * 0.3); g.moveTo(0, SIZE * 0.8); g.lineTo(SIZE, SIZE * 0.8); g.stroke();
    for (let k = 0; k < 10; k++) { g.fillStyle = "rgba(20,20,30,0.4)"; g.fillRect(r() * SIZE, r() * SIZE, 8 + r() * 14, 3); }
    speckle(g, r, 200, 150, 255);
  },
  flesh(g, r) {
    blotch(g, r, 12, 0.2, 22);
    g.strokeStyle = "rgba(20,0,0,0.45)"; g.lineWidth = 1.5;
    for (let k = 0; k < 7; k++) { let x = r() * SIZE, y = r() * SIZE; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 8; i++) { x += (r() - 0.5) * 26; y += (r() - 0.5) * 26; g.lineTo(x, y); } g.stroke(); }
    speckle(g, r, 600, 90, 255, 3, 0.25);
  },
  tile(g, r) {
    const t = SIZE / 8;
    for (let j = 0; j < 8; j++) for (let i = -1; i < 8; i++) { const v = 200 + r() * 55; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); const x = i * t + (j % 2 ? t / 2 : 0), y = j * t; g.moveTo(x + 1, y); g.lineTo(x + t - 1, y); g.lineTo(x + t - 1, y + t - 4); g.quadraticCurveTo(x + t / 2, y + t + 1, x + 1, y + t - 4); g.closePath(); g.fill(); }
  },
  camo(g, r) { blotch(g, r, 16, 0.3, 20); blotch(g, r, 10, 0.18, 34); speckle(g, r, 500, 140, 255); },
};

/** The tile for a texture (built once). */
export function texture(t: Texture): HTMLCanvasElement {
  let c = cache.get(t);
  if (!c) {
    c = document.createElement("canvas"); c.width = c.height = SIZE;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f4f4f4"; g.fillRect(0, 0, SIZE, SIZE);
    DRAW[t](g, rnd(t.length * 7919 + t.charCodeAt(0) * 131));
    cache.set(t, c);
  }
  return c;
}
export const TEX_SIZE = SIZE;
