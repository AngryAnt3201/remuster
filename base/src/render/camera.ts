// The 3/4 diorama camera. The sim stays 2D (x across, y down the board, 0 = the rival's back edge, H = yours);
// the renderer looks at that board from a pinhole camera raised behind your edge and tilted toward the rival.
//
// World point (x, y, z), z = height above the ground in world units. Board-centred:
//   X = x - W/2, Y = y - H/2, depth cz = dist - Y sin(tilt) - z cos(tilt)
//   screen = centre + k * (X / cz, (Y cos(tilt) - z sin(tilt)) / cz)
// Every ground row (fixed y) maps to a screen row with one horizontal scale, so the ground plane inverts in closed
// form (unproject) and a flat top-down texture warps into perspective row by row (see BoardView.paintBackground).
//
// Contract for art (characters, props, keeps):
//   - Anchor every upright sprite at its ground contact point (feet / base centre) = project(x, y, 0).
//   - Scale by scaleAt(y): pixels per world unit at that depth (smaller toward the rival's edge).
//   - Pick the facing frame with facing8(face, y); frames 5..7 can be mirrors of 3..1.
//   - Contact shadows and ground decals use groundPath (an exact projected circle), never a screen circle.
//   - Draw order: ground decals, then upright things by ground y (sortDrawables), then the air layer.
// Pure maths, no DOM: tested in tests/camera.test.ts.

export interface Rect { x: number; y: number; w: number; h: number; }
export interface Pt { x: number; y: number; }
export interface ScreenPt { x: number; y: number; /** px per world unit at this depth */ s: number; }

/** Tilt from straight down, in radians (0 = top-down). */
export const TILT = 0.64;
/** Camera distance from the board centre, in world units. Larger = flatter perspective. */
export const DIST = 30;
/** Room kept above the far edge for heads and flyers, and the thickness of the board's front face (world units). */
export const HEADROOM = 1.1;
export const SLAB = 0.45;

/** Default curvature of the world: the ground falls away from the board centre by BEND * distance squared, so the
 *  battlefield reads as the top of a small globe. 0 = a flat table. */
export const BEND = 0.011;

export class Camera {
  readonly W: number;
  readonly H: number;
  tilt: number;
  dist: number;
  sin: number;
  cos: number;
  /** Turn of the world about the board centre, radians (0 = you look from your own edge toward the rival). */
  yaw = 0;
  private cy_ = 1; private sy_ = 0;
  /** Globe curvature (see BEND). */
  bend = 0;
  /** Bumped whenever the view changes: caches of projected geometry compare it. */
  rev = 0;
  /** px per unit of normalised image plane */
  k = 1;
  /** screen position of the board centre on the ground */
  cx = 0;
  cy = 0;

  constructor(W: number, H: number, tilt = TILT, dist = DIST) {
    this.W = W; this.H = H; this.tilt = tilt; this.dist = dist;
    this.sin = Math.sin(tilt); this.cos = Math.cos(tilt);
  }

  /** Turn and tilt the view. */
  setView(yaw: number, tilt = this.tilt) {
    this.yaw = yaw; this.cy_ = Math.cos(yaw); this.sy_ = Math.sin(yaw);
    this.tilt = tilt; this.sin = Math.sin(tilt); this.cos = Math.cos(tilt);
    this.rev++;
  }

  /** World to screen. */
  project(x: number, y: number, z = 0): ScreenPt {
    const X0 = x - this.W / 2, Y0 = y - this.H / 2;
    if (this.bend) z -= this.bend * (X0 * X0 + Y0 * Y0);
    const X = X0 * this.cy_ - Y0 * this.sy_, Y = X0 * this.sy_ + Y0 * this.cy_;
    const cz = Math.max(0.5, this.dist - Y * this.sin - z * this.cos);
    return { x: this.cx + (this.k * X) / cz, y: this.cy + (this.k * (Y * this.cos - z * this.sin)) / cz, s: this.k / cz };
  }

  /** Depth order on the ground: larger = nearer the camera (draw later). Equals y when the view is not turned. */
  sortKey(x: number, y: number): number {
    return (x - this.W / 2) * this.sy_ + (y - this.H / 2) * this.cy_ + this.H / 2;
  }

  /** Screen to the ground point under it (z = 0). */
  unproject(px: number, py: number): Pt { return this.unprojectAt(px, py, 0); }

  /** Screen to the point at height z under the pointer (for picking things that stand up). */
  unprojectAt(px: number, py: number, z: number): Pt {
    const u = (px - this.cx) / this.k, v = (py - this.cy) / this.k;
    const den = this.cos + v * this.sin;
    let X0 = 0, Y0 = 0, ze = z;
    // The curved ground has no closed form: solve on a flat plane at the height found so far, a few times over.
    for (let i = 0; i < (this.bend ? 16 : 1); i++) {
      // v (D - Y s - z c) = Y c - z s  =>  Y = (v (D - z c) + z s) / (c + v s)
      const Y = den > 1e-6 ? (v * (this.dist - ze * this.cos) + ze * this.sin) / den : -1e6;
      const X = u * (this.dist - Y * this.sin - ze * this.cos);
      X0 = X * this.cy_ + Y * this.sy_; Y0 = -X * this.sy_ + Y * this.cy_;
      const d2 = Math.min(900, X0 * X0 + Y0 * Y0);
      ze = z - this.bend * d2;
    }
    return { x: X0 + this.W / 2, y: Y0 + this.H / 2 };
  }

  private depthAt(x: number, y: number, z: number) {
    const X0 = x - this.W / 2, Y0 = y - this.H / 2;
    return Math.max(0.5, this.dist - (X0 * this.sy_ + Y0 * this.cy_) * this.sin - (z - this.bend * (X0 * X0 + Y0 * Y0)) * this.cos);
  }

  /** Pixels per world unit across the screen at ground row y (and height z); pass x when the view may be turned. */
  scaleAt(y: number, z = 0, x = this.W / 2) { return this.k / this.depthAt(x, y, z); }

  /** How much a ground length running away from the camera shrinks against one running across (< 1: foreshortened). */
  squashAt(y: number, x = this.W / 2) { return (this.cos * this.dist) / this.depthAt(x, y, 0); }

  /** Fit the board (plus headroom over the far edge and the front face) inside an area, centred. */
  fit(area: Rect, headroom = HEADROOM, slab = SLAB) {
    this.k = 1; this.cx = 0; this.cy = 0;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of [[0, 0], [this.W, 0], [0, this.H], [this.W, this.H]]) for (const z of [headroom, 0, -slab]) {
      const p = this.project(x, y, z);
      // only the far corners need headroom and only the near ones the slab
      const far = this.sortKey(x, y) < this.H / 2;
      if ((z > 0 && !far) || (z < 0 && far)) continue;
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const k = Math.min(area.w / (x1 - x0), area.h / (y1 - y0));
    this.k = k;
    this.cx = area.x + area.w / 2 - ((x0 + x1) / 2) * k;
    this.cy = area.y + area.h / 2 - ((y0 + y1) / 2) * k;
    this.rev++;
  }

  /** The screen box the board's ground covers. */
  groundRect(): Rect {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of [[0, 0], [this.W, 0], [0, this.H], [this.W, this.H]]) {
      const p = this.project(x, y);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** The 8-way screen facing for a world heading (radians, 0 = +x, pi/2 = +y toward you).
   *  0 = right, 1 = down-right, 2 = down (toward the camera), 3 = down-left, 4 = left, 5 = up-left, 6 = up, 7 = up-right.
   *  With mirroring, frames 3, 4, 5 are 1, 0, 7 flipped horizontally (see mirror8). */
  facing8(face: number, y = this.H / 2): number {
    const f = face + this.yaw;
    const a = Math.atan2(Math.sin(f) * this.squashAt(y), Math.cos(f));
    return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  }

  /** Path a ground circle (exactly projected) into ctx. Use for shadows, rings, ranges, zones. */
  groundPath(ctx: PathSink, x: number, y: number, r: number, z = 0) {
    const n = Math.max(12, Math.min(64, Math.round(r * this.scaleAt(y, 0, x) * 0.6)));
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = this.project(x + Math.cos(a) * r, y + Math.sin(a) * r, z);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.closePath();
  }
}

export interface PathSink { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void; }

/** For a mirrored 5-frame set (stored frames 0 right, 1 down-right, 2 down, 6 up, 7 up-right): the stored frame
 *  for an 8-way facing and whether to flip it horizontally. */
export function mirror8(dir: number): { frame: number; flip: boolean } {
  if (dir === 3) return { frame: 1, flip: true };
  if (dir === 4) return { frame: 0, flip: true };
  if (dir === 5) return { frame: 7, flip: true };
  return { frame: dir, flip: false };
}

/** Painter's order: ground layer first, then upright things by ground y (far first), then the air layer by y.
 *  Ties keep insertion order (Array.prototype.sort is stable). */
export interface Drawable { y: number; /** ground x, for a turned camera (default: the board's middle) */ x?: number; layer: 0 | 1 | 2; draw(): void; }
export function sortDrawables<T extends { y: number; x?: number; layer: number }>(list: T[], cam?: Camera): T[] {
  if (!cam || !cam.yaw) return list.sort((a, b) => a.layer - b.layer || a.y - b.y);
  const key = new Map<T, number>();
  for (const d of list) key.set(d, cam.sortKey(d.x ?? cam.W / 2, d.y));
  return list.sort((a, b) => a.layer - b.layer || key.get(a)! - key.get(b)!);
}
