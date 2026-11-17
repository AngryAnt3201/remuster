// Cindermaw's combat-feel drawing: the base game's, with its rounded system face swapped for the game's pixel
// face. The base file sets `ctx.font` from a private constant, so rather than copy the whole file the battle
// canvas's font setter is wrapped once: any font that names the base face is rewritten to Jersey 10 (drawn a little
// larger, since it is a narrow face) before it reaches the canvas.
import * as base from "@base/render/juicedraw";

export * from "@base/render/juicedraw";

const FACE = `"Jersey 10", ui-monospace, Menlo, monospace`;
if (typeof document !== "undefined") void document.fonts?.load(`16px "Jersey 10"`);
const wrapped = new WeakSet<CanvasRenderingContext2D>();

function pixelFont(ctx: CanvasRenderingContext2D) {
  if (wrapped.has(ctx)) return;
  wrapped.add(ctx);
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "font");
  if (!d?.get || !d.set) return;
  Object.defineProperty(ctx, "font", {
    configurable: true,
    get() { return d.get!.call(this); },
    set(v: string) {
      const s = String(v);
      d.set!.call(this, /ui-rounded/.test(s) ? s.replace(/^\s*\d+\s+/, "").replace(/(\d+(?:\.\d+)?)px.*$/, (_m, n) => `${Math.round(Number(n) * 1.3)}px ${FACE}`) : s);
    },
  });
}

export const drawFloat: typeof base.drawFloat = (ctx, ...a) => { pixelFont(ctx); return base.drawFloat(ctx, ...a); };
export const drawCallout: typeof base.drawCallout = (ctx, ...a) => { pixelFont(ctx); return base.drawCallout(ctx, ...a); };
export const drawBanner: typeof base.drawBanner = (ctx, ...a) => { pixelFont(ctx); return base.drawBanner(ctx, ...a); };
