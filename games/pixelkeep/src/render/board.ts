// Pixelkeep's battle canvas is a low-resolution screen, like the console it pretends to be.
//
// The base BoardView draws at the device's pixel ratio and smooths every sprite it scales, which turns pixel art to
// mush and leaves each asset family with its own pixel size. Here the canvas's backing store is sized so that one
// canvas pixel is exactly one art pixel of the arena backdrop (ARENA_PX backdrop pixels, see art/style.ts), image
// smoothing is off, and the stylesheet scales the canvas up with `image-rendering: pixelated` (game/theme.css). So
// the ground, scenery, units, keeps, effects, Arena buildings, shadows and health bars all land on one pixel grid,
// whatever the screen size: a phone and a tablet both show a picture about 220 art pixels wide.
import { BoardView as Base } from "@base/render/board";
import type { Rect } from "@base/render/camera";

export * from "@base/render/board";

/** Art pixels per unit of the camera's image plane: the backdrop is 1456 px over 0.52 units, 4 px per art pixel. */
const ART_PER_PLANE = 1456 / 4 / 0.52;
/** The backdrop's top-left corner on the image plane (artkit/arena.ts ARENA.view). */
const U0 = -0.26, V0 = -0.42;

export class BoardView extends Base {
  layout(cssW: number, cssH: number, area: Rect) {
    super.layout(cssW, cssH, area);
    const cam = this.cam, dpr = ART_PER_PLANE / cam.k;
    // put the backdrop's corner on a whole canvas pixel, so every art pixel of it fills exactly one canvas pixel
    const rx = cam.cx + cam.k * U0, ry = cam.cy + cam.k * V0;
    cam.cx += Math.round(rx * dpr) / dpr - rx;
    cam.cy += Math.round(ry * dpr) / dpr - ry;
    this.rect = cam.groundRect();
    this.dpr = dpr;
    this.canvas.width = Math.ceil(cssW * dpr);
    this.canvas.height = Math.ceil(cssH * dpr);
    this.canvas.style.imageRendering = "pixelated";
    this.ctx.imageSmoothingEnabled = false; // resizing a canvas resets its context
  }
}
