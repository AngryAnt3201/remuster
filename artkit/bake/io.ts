// Getting pixels out of the bake page: canvases and RGBA buffers to image files, saved by tools/bake.mjs.
declare global { interface Window { __save(path: string, base64: string): Promise<void>; __log(msg: string): void; } }

export function toCanvas(px: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const id = c.getContext("2d")!.createImageData(w, h);
  id.data.set(px);
  c.getContext("2d")!.putImageData(id, 0, 0);
  return c;
}
export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.round(w); c.height = Math.round(h);
  return [c, c.getContext("2d")!];
}
const MIME: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg" };
/** Save a canvas under the game's folder. `path` is relative to games/<id>/ (e.g. "public/atlas/ranger_t1_tide.webp").
 *  quality: 0..1 for webp and jpg (webp at 1 is lossless). */
export async function save(path: string, c: HTMLCanvasElement, quality = 0.9): Promise<number> {
  const ext = path.split(".").pop()!.toLowerCase();
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed: " + path))), MIME[ext], quality));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  await window.__save(path, btoa(s));
  return buf.length;
}
export async function saveText(path: string, text: string) { await window.__save(path, btoa(unescape(encodeURIComponent(text)))); }
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("no image " + url)); i.src = url; });
}
export const log = (msg: string) => window.__log?.(msg);
