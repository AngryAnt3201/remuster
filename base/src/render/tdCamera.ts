// Bastion's panning camera: an orthographic 3/4 view over a tall map (ground squashed on y so sprites rendered for
// the diorama camera still sit right). Drag to pan with inertia, pinch or double-tap to zoom, clamped to the map,
// and an optional follow that eases toward a target (the front of the wave). Pure maths; separate from camera.ts.

/** Vertical foreshortening of the ground. */
export const TD_SQUASH = 0.8;
/** Ground texture layout (tdView.ts bake, and the Blender backdrops in art/td): pixels per world unit across, and
 *  the forest margin around the map in world units. Ground (x, y) is texture pixel ((x + M) * PPU, (y + M) * PPU * SQUASH). */
export const TD_TEX_PPU = 72;
export const TD_TEX_M = 3.5;
const MARGIN = 1.5; // world units of forest shown beyond the map edge

export class TdCamera {
  /** Map size, world units. */
  readonly mw: number;
  readonly mh: number;
  vw = 390;
  vh = 844;
  /** Centre of the view, world units. */
  cx: number;
  cy: number;
  zoom = 1.25;
  minZoom = 0.8;
  maxZoom = 2.6;
  /** Pan velocity (world units per second) for inertia. */
  vx = 0;
  vy = 0;
  follow: { x: number; y: number } | null = null;
  /** Screen insets kept clear by the HUD (top, bottom), px. */
  insetTop = 0;
  insetBottom = 0;
  private zoomTo: { z: number; sx: number; sy: number } | null = null;

  constructor(mw: number, mh: number) {
    this.mw = mw; this.mh = mh;
    this.cx = mw / 2; this.cy = mh - 8;
  }

  resize(w: number, h: number) { this.vw = w; this.vh = h; this.clamp(); }
  /** Pixels per world unit across. */
  get s() { return (this.vw / this.mw) * this.zoom; }

  toScreen(x: number, y: number, z = 0) {
    const s = this.s;
    return { x: (x - this.cx) * s + this.vw / 2, y: (y - this.cy) * s * TD_SQUASH - z * s * 0.9 + this.midY(), s };
  }
  toWorld(px: number, py: number) {
    const s = this.s;
    return { x: (px - this.vw / 2) / s + this.cx, y: (py - this.midY()) / (s * TD_SQUASH) + this.cy };
  }
  private midY() { return this.insetTop + (this.vh - this.insetTop - this.insetBottom) / 2; }

  /** World rect currently on screen (plus a margin), for culling. */
  view(margin = 1) {
    const a = this.toWorld(0, 0), b = this.toWorld(this.vw, this.vh);
    return { x0: a.x - margin, y0: a.y - margin, x1: b.x + margin, y1: b.y + margin * 2 };
  }

  /** Drag by screen pixels (finger moved dx, dy). */
  panBy(dx: number, dy: number) {
    const s = this.s;
    this.cx -= dx / s;
    this.cy -= dy / (s * TD_SQUASH);
    this.follow = null;
    this.clamp();
  }
  /** Release a drag with a fling velocity in px per second. */
  fling(vxPx: number, vyPx: number) {
    const s = this.s;
    this.vx = -vxPx / s;
    this.vy = -vyPx / (s * TD_SQUASH);
  }
  stop() { this.vx = 0; this.vy = 0; this.zoomTo = null; }

  /** Zoom by a factor keeping the world point under (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number) {
    const before = this.toWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const after = this.toWorld(sx, sy);
    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
    this.clamp();
  }
  /** Double tap: ease between the overview and a close look at the tapped spot. */
  toggleZoom(sx: number, sy: number) {
    this.zoomTo = { z: this.zoom > 1.6 ? 1.0 : 2.0, sx, sy };
  }

  centerOn(x: number, y: number) { this.cx = x; this.cy = y; this.clamp(); }

  update(dt: number) {
    if (this.zoomTo) {
      const f = Math.pow(this.zoomTo.z / this.zoom, Math.min(1, dt * 10));
      this.zoomAt(this.zoomTo.sx, this.zoomTo.sy, f);
      if (Math.abs(this.zoom - this.zoomTo.z) < 0.01) this.zoomTo = null;
    }
    if (this.follow) {
      const k = Math.min(1, dt * 2.2);
      this.cx += (this.follow.x - this.cx) * k * 0.6;
      this.cy += (this.follow.y - this.cy) * k;
      this.vx = this.vy = 0;
    } else if (this.vx || this.vy) {
      this.cx += this.vx * dt;
      this.cy += this.vy * dt;
      const decay = Math.exp(-dt * 4.5);
      this.vx *= decay; this.vy *= decay;
      if (Math.hypot(this.vx, this.vy) < 0.05) this.vx = this.vy = 0;
    }
    this.clamp();
  }

  /** Keep the view over the map (with a little forest margin); centre it when the map is smaller than the view. */
  clamp() {
    const s = this.s;
    const halfW = this.vw / 2 / s, viewH = (this.vh - this.insetTop - this.insetBottom) / (s * TD_SQUASH);
    const x0 = -MARGIN + halfW, x1 = this.mw + MARGIN - halfW;
    this.cx = x0 > x1 ? this.mw / 2 : Math.max(x0, Math.min(x1, this.cx));
    const top = this.insetTop / (s * TD_SQUASH), bottom = this.insetBottom / (s * TD_SQUASH);
    const y0 = -MARGIN + viewH / 2 - top * 0.5, y1 = this.mh + MARGIN - viewH / 2 + bottom * 0.5;
    this.cy = y0 > y1 ? this.mh / 2 : Math.max(y0, Math.min(y1, this.cy));
    if (this.cx === x0 || this.cx === x1) this.vx = 0;
    if (this.cy === y0 || this.cy === y1) this.vy = 0;
  }
}
