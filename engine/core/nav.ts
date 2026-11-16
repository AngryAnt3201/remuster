// Terrain for the battle sim: the live blocks of an arena, the geometry queries the sim asks every step (line of
// sight, shot stops, swept body-versus-block collision, free spots) and ground navigation (a clearance grid over the
// board and A* round blocks). Pure and deterministic; a Battle owns one Nav when its options carry terrain, and none
// otherwise (so a terrain-free battle never touches this file).
//
// Two metrics are used on purpose:
//  - collision is exact (a circle against a rectangle), so a body can stand anywhere it physically fits;
//  - navigation is conservative (rectangles grown square by the body's radius less NAV_TOL), so every route it
//    returns is one the body can physically walk, and a corridor exactly as wide as the body still counts as open.
import { H, W } from "./defs";
import { BLOCK_HP, blocksShots, breakable, type Block, type BlockState } from "./terrain";

/** Nav grid cell, world units (the board is 36 x 56 cells). */
export const NAV_CELL = 0.25;
/** How far inside a grown block the planner lets a body's centre be (half a cell: a gap as wide as the body is open). */
export const NAV_TOL = 0.126;
const NX = Math.round(W / NAV_CELL), NY = Math.round(H / NAV_CELL), N = NX * NY;
const FAR = 99;
const TAU = Math.PI * 2;

/** Entry parameter (0..1) of the segment from (x0, y0) along (dx, dy) into a rectangle, or -1 when it misses. */
function segRect(x0: number, y0: number, dx: number, dy: number, l: number, t: number, r: number, b: number): number {
  let t0 = 0, t1 = 1;
  if (dx > 1e-12 || dx < -1e-12) {
    let a = (l - x0) / dx, c = (r - x0) / dx;
    if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t0 > t1) return -1;
  } else if (x0 < l || x0 > r) return -1;
  if (dy > 1e-12 || dy < -1e-12) {
    let a = (t - y0) / dy, c = (b - y0) / dy;
    if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t0 > t1) return -1;
  } else if (y0 < t || y0 > b) return -1;
  return t0;
}

/** Distance from a point to a rectangle (0 inside). */
function rectDist(x: number, y: number, l: number, t: number, r: number, b: number): number {
  const dx = x < l ? l - x : x > r ? x - r : 0, dy = y < t ? t - y : y > b ? y - b : 0;
  return Math.hypot(dx, dy);
}

interface Fields { hard: Float32Array; soft: Float32Array; near: Int16Array; }
/** The clearance fields of an arena with every block standing, shared by all the battles fought on it. */
const fieldCache = new WeakMap<object, Fields>();

export class Nav {
  readonly blocks: BlockState[];
  /** Bumped whenever a block breaks: cached routes planned under an older version are stale. */
  ver = 1;
  // Live blocks as flat [left, top, right, bottom] quads, with the index of each in `blocks`.
  private g = new Float64Array(0); private gi: number[] = []; private gn = 0; // everything that blocks ground movement
  private s = new Float64Array(0); private si: number[] = []; private sn = 0; // blocks shots and sight
  private c = new Float64Array(0); private ci: number[] = []; private cn = 0; // cover
  /** Square (Chebyshev) distance from each cell centre to the nearest unbreakable block or board edge. */
  private hard: Float32Array;
  /** The same to the nearest live breakable block, and which block that is. */
  private soft: Float32Array;
  private near: Int16Array;
  private ownsSoft = false;
  // A* scratch.
  private gs = new Float32Array(N);
  private par = new Int16Array(N);
  private seen = new Int32Array(N);
  private closed = new Int32Array(N);
  private stamp = 0;
  private heapC: number[] = [];
  private heapF: number[] = [];
  private cells: number[] = [];
  // Results of the last query (kept on the object so the hot paths allocate nothing).
  /** Where the last shotHit / coverFor / sweep landed, and how far along the segment (0..1). */
  hx = 0; hy = 0; ht = 0;
  /** Surface normal of the last sweep hit. */
  snx = 0; sny = 0;
  /** The last spot() result. */
  sx = 0; sy = 0;
  /** The last path(): waypoints as x, y pairs, how many, the breakable block it means to break through (-1 for
   * none) and whether it stops short of the goal (nothing closer is reachable). */
  pts: number[] = [];
  np = 0;
  breach = -1;
  partial = false;

  constructor(terrain: Block[]) {
    this.blocks = terrain.map((b) => {
      const hp = breakable(b.kind) ? b.hp ?? BLOCK_HP[b.kind] : 0;
      return { ...b, maxHp: hp, hp, alive: true };
    });
    let f = fieldCache.get(terrain);
    if (!f) {
      f = { hard: new Float32Array(N), soft: new Float32Array(N), near: new Int16Array(N) };
      this.fillHard(f.hard);
      this.fillSoft(f.soft, f.near);
      fieldCache.set(terrain, f);
    }
    this.hard = f.hard; this.soft = f.soft; this.near = f.near;
    this.lists();
  }

  // ------------------------------------------------------------ upkeep
  private lists() {
    const pack = (keep: (b: BlockState) => boolean): [Float64Array, number[]] => {
      const idx: number[] = [];
      this.blocks.forEach((b, i) => { if (b.alive && keep(b)) idx.push(i); });
      const q = new Float64Array(idx.length * 4);
      idx.forEach((i, k) => {
        const b = this.blocks[i];
        q[k * 4] = b.x - b.w / 2; q[k * 4 + 1] = b.y - b.h / 2; q[k * 4 + 2] = b.x + b.w / 2; q[k * 4 + 3] = b.y + b.h / 2;
      });
      return [q, idx];
    };
    [this.g, this.gi] = pack(() => true); this.gn = this.gi.length;
    [this.s, this.si] = pack((b) => blocksShots(b.kind)); this.sn = this.si.length;
    [this.c, this.ci] = pack((b) => b.kind === "cover"); this.cn = this.ci.length;
  }
  private fillHard(out: Float32Array) {
    for (let cy = 0; cy < NY; cy++) for (let cx = 0; cx < NX; cx++) {
      const x = (cx + 0.5) * NAV_CELL, y = (cy + 0.5) * NAV_CELL;
      let d = Math.min(x, W - x, y, H - y);
      for (const b of this.blocks) {
        if (breakable(b.kind)) continue;
        const k = Math.max(b.x - b.w / 2 - x, x - b.x - b.w / 2, b.y - b.h / 2 - y, y - b.y - b.h / 2, 0);
        if (k < d) d = k;
      }
      out[cy * NX + cx] = d;
    }
  }
  private fillSoft(out: Float32Array, near: Int16Array) {
    for (let cy = 0; cy < NY; cy++) for (let cx = 0; cx < NX; cx++) {
      const x = (cx + 0.5) * NAV_CELL, y = (cy + 0.5) * NAV_CELL;
      let d = FAR, who = -1;
      for (let i = 0; i < this.blocks.length; i++) {
        const b = this.blocks[i];
        if (!b.alive || !breakable(b.kind)) continue;
        const k = Math.max(b.x - b.w / 2 - x, x - b.x - b.w / 2, b.y - b.h / 2 - y, y - b.y - b.h / 2, 0);
        if (k < d) { d = k; who = i; }
      }
      out[cy * NX + cx] = d; near[cy * NX + cx] = who;
    }
  }
  /** Call after a block's `alive` goes false: the block lists and the clearance grid follow, routes go stale. */
  rebuild() {
    this.lists();
    if (!this.ownsSoft) { this.soft = new Float32Array(N); this.near = new Int16Array(N); this.ownsSoft = true; }
    this.fillSoft(this.soft, this.near);
    this.ver++;
  }

  // ------------------------------------------------------------ sight and shots
  /** Line of sight: true when no live wall, building or barricade crosses the segment. */
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    const q = this.s, dx = x1 - x0, dy = y1 - y0;
    const lx = x0 < x1 ? x0 : x1, hx = x0 < x1 ? x1 : x0, ly = y0 < y1 ? y0 : y1, hy = y0 < y1 ? y1 : y0;
    for (let k = 0, n = this.sn * 4; k < n; k += 4) {
      if (hx < q[k] || lx > q[k + 2] || hy < q[k + 1] || ly > q[k + 3]) continue;
      if (segRect(x0, y0, dx, dy, q[k], q[k + 1], q[k + 2], q[k + 3]) >= 0) return false;
    }
    return true;
  }
  /** The first shot-blocking block the segment meets: its index in `blocks` (hx, hy, ht say where), or -1. */
  shotHit(x0: number, y0: number, x1: number, y1: number): number {
    const q = this.s, dx = x1 - x0, dy = y1 - y0;
    const lx = x0 < x1 ? x0 : x1, hx = x0 < x1 ? x1 : x0, ly = y0 < y1 ? y0 : y1, hy = y0 < y1 ? y1 : y0;
    let best = -1, bt = 2;
    for (let k = 0, n = this.sn * 4; k < n; k += 4) {
      if (hx < q[k] || lx > q[k + 2] || hy < q[k + 1] || ly > q[k + 3]) continue;
      const t = segRect(x0, y0, dx, dy, q[k], q[k + 1], q[k + 2], q[k + 3]);
      if (t >= 0 && t < bt) { bt = t; best = k >> 2; }
    }
    if (best < 0) return -1;
    this.ht = bt; this.hx = x0 + dx * bt; this.hy = y0 + dy * bt;
    return this.si[best];
  }
  /** Is the point inside a live shot-blocking block. */
  inShot(x: number, y: number): boolean {
    const q = this.s;
    for (let k = 0, n = this.sn * 4; k < n; k += 4) if (x > q[k] && x < q[k + 2] && y > q[k + 1] && y < q[k + 3]) return true;
    return false;
  }
  /**
   * The cover a direct shot from (x0, y0) at a target standing at (tx, ty) has to cross: a live cover block on the
   * line, within `reach` of the target and nearer the target than the shooter. Its index (hx, hy = where the shot
   * crosses it), or -1.
   */
  coverFor(x0: number, y0: number, tx: number, ty: number, reach: number): number {
    const q = this.c, dx = tx - x0, dy = ty - y0;
    for (let k = 0, n = this.cn * 4; k < n; k += 4) {
      const dt = rectDist(tx, ty, q[k], q[k + 1], q[k + 2], q[k + 3]);
      if (dt > reach || rectDist(x0, y0, q[k], q[k + 1], q[k + 2], q[k + 3]) <= dt) continue;
      const t = segRect(x0, y0, dx, dy, q[k], q[k + 1], q[k + 2], q[k + 3]);
      if (t < 0) continue;
      this.ht = t; this.hx = x0 + dx * t; this.hy = y0 + dy * t;
      return this.ci[k >> 2];
    }
    return -1;
  }

  // ------------------------------------------------------------ ground
  /** Does a circle overlap any live block (exact). */
  hitsGround(x: number, y: number, r: number): boolean {
    const q = this.g, r2 = r * r;
    for (let k = 0, n = this.gn * 4; k < n; k += 4) {
      const dx = x < q[k] ? q[k] - x : x > q[k + 2] ? x - q[k + 2] : 0;
      if (dx >= r) continue;
      const dy = y < q[k + 1] ? q[k + 1] - y : y > q[k + 3] ? y - q[k + 3] : 0;
      if (dx * dx + dy * dy < r2) return true;
    }
    return false;
  }
  /** True when no live block's rectangle crosses the segment (a walkable straight line for a point). */
  groundLos(x0: number, y0: number, x1: number, y1: number): boolean {
    const q = this.g, dx = x1 - x0, dy = y1 - y0;
    for (let k = 0, n = this.gn * 4; k < n; k += 4) if (segRect(x0, y0, dx, dy, q[k], q[k + 1], q[k + 2], q[k + 3]) >= 0) return false;
    return true;
  }
  /**
   * Can a body walk the straight line: no live block, grown square by `rr`, crosses the segment. A block the start
   * or end already sits within `rr` of (a body touching a wall, a target hugging one) is tested at its true size.
   */
  clear(x0: number, y0: number, x1: number, y1: number, rr: number): boolean {
    const q = this.g, dx = x1 - x0, dy = y1 - y0;
    const lx = (x0 < x1 ? x0 : x1) - rr, hx = (x0 < x1 ? x1 : x0) + rr, ly = (y0 < y1 ? y0 : y1) - rr, hy = (y0 < y1 ? y1 : y0) + rr;
    for (let k = 0, n = this.gn * 4; k < n; k += 4) {
      if (hx < q[k] || lx > q[k + 2] || hy < q[k + 1] || ly > q[k + 3]) continue;
      let l = q[k] - rr, t = q[k + 1] - rr, r = q[k + 2] + rr, b = q[k + 3] + rr;
      if ((x0 > l && x0 < r && y0 > t && y0 < b) || (x1 > l && x1 < r && y1 > t && y1 < b)) { l = q[k]; t = q[k + 1]; r = q[k + 2]; b = q[k + 3]; }
      if (segRect(x0, y0, dx, dy, l, t, r, b) >= 0) return false;
    }
    return true;
  }
  /**
   * Swept circle against the live blocks (exact, rounded corners): how far along the move from (ox, oy) to (nx, ny)
   * a body of radius `rad` first touches one. Returns 0..1 with the surface normal in (snx, sny), or 2 for a clear
   * move. A block the body already overlaps at the start is left to pushOut().
   */
  sweep(ox: number, oy: number, nx: number, ny: number, rad: number): number {
    const q = this.g, dx = nx - ox, dy = ny - oy;
    const lx = (ox < nx ? ox : nx) - rad, hx = (ox < nx ? nx : ox) + rad, ly = (oy < ny ? oy : ny) - rad, hy = (oy < ny ? ny : oy) + rad;
    let best = 2;
    for (let k = 0, n = this.gn * 4; k < n; k += 4) {
      const l = q[k], t = q[k + 1], r = q[k + 2], b = q[k + 3];
      if (hx <= l || lx >= r || hy <= t || ly >= b) continue;
      // Slab test against the block grown by rad, remembering which face the move enters through.
      let t0 = 0, t1 = 1, axis = -1;
      if (dx > 1e-12 || dx < -1e-12) {
        let a = (l - rad - ox) / dx, c = (r + rad - ox) / dx;
        if (a > c) { const s = a; a = c; c = s; }
        if (a >= t0) { t0 = a; axis = 0; }
        if (c < t1) t1 = c;
        if (t0 > t1) continue;
      } else if (ox <= l - rad || ox >= r + rad) continue;
      if (dy > 1e-12 || dy < -1e-12) {
        let a = (t - rad - oy) / dy, c = (b + rad - oy) / dy;
        if (a > c) { const s = a; a = c; c = s; }
        if (a >= t0) { t0 = a; axis = 1; }
        if (c < t1) t1 = c;
        if (t0 > t1) continue;
      } else if (oy <= t - rad || oy >= b + rad) continue;
      let cx: number, cy: number;
      if (axis < 0) {
        // Starts inside the grown rectangle: either already overlapping (not this function's job) or in the
        // square corner outside the rounded one, where only the corner itself can be hit.
        if ((ox >= l && ox <= r) || (oy >= t && oy <= b)) continue;
        cx = ox < l ? l : r; cy = oy < t ? t : b;
        if ((ox - cx) * (ox - cx) + (oy - cy) * (oy - cy) < rad * rad) continue;
      } else {
        const px = ox + dx * t0, py = oy + dy * t0;
        if (axis === 0) {
          if (py >= t && py <= b) { if (t0 < best) { best = t0; this.snx = dx > 0 ? -1 : 1; this.sny = 0; } continue; }
          cx = dx > 0 ? l : r; cy = py < t ? t : b;
        } else {
          if (px >= l && px <= r) { if (t0 < best) { best = t0; this.snx = 0; this.sny = dy > 0 ? -1 : 1; } continue; }
          cx = px < l ? l : r; cy = dy > 0 ? t : b;
        }
      }
      // The rounded corner: ray against a circle of radius rad about the block's corner.
      const fx = ox - cx, fy = oy - cy;
      const a = dx * dx + dy * dy, bq = 2 * (fx * dx + fy * dy), cq = fx * fx + fy * fy - rad * rad;
      const disc = bq * bq - 4 * a * cq;
      if (disc < 0 || a < 1e-18) continue;
      const tc = (-bq - Math.sqrt(disc)) / (2 * a);
      if (tc < 0 || tc > 1 || tc >= best) continue;
      best = tc;
      this.snx = (fx + dx * tc) / rad; this.sny = (fy + dy * tc) / rad;
    }
    this.ht = best;
    return best;
  }
  /** Moves a circle out of any live block it overlaps (shortest way out); returns whether it moved. */
  pushOut(p: { x: number; y: number }, rad: number): boolean {
    const q = this.g;
    let moved = false;
    for (let k = 0, n = this.gn * 4; k < n; k += 4) {
      const l = q[k], t = q[k + 1], r = q[k + 2], b = q[k + 3];
      const qx = p.x < l ? l : p.x > r ? r : p.x, qy = p.y < t ? t : p.y > b ? b : p.y;
      const dx = p.x - qx, dy = p.y - qy, d2 = dx * dx + dy * dy;
      if (d2 >= rad * rad) continue;
      moved = true;
      if (d2 > 1e-12) {
        const d = Math.sqrt(d2);
        p.x = qx + (dx / d) * (rad + 1e-6); p.y = qy + (dy / d) * (rad + 1e-6);
      } else {
        // Centre inside the block: out through the nearest face.
        const dl = p.x - l, dr = r - p.x, dt = p.y - t, db = b - p.y, m = Math.min(dl, dr, dt, db);
        const o = rad + 1e-6;
        if (m === dl) p.x = l - o; else if (m === dr) p.x = r + o; else if (m === dt) p.y = t - o; else p.y = b + o;
      }
    }
    return moved;
  }
  /**
   * The nearest free spot to (x, y) for a circle of radius `rad`: on the board and clear of every live block. With
   * `from`, it must also be reachable in a straight line from (fx, fy), so a spawn never lands across a wall from its
   * maker. The result is in (sx, sy); returns false (and the point unchanged) only when nothing within 4 units fits.
   */
  spot(x: number, y: number, rad: number, from = false, fx = 0, fy = 0): boolean {
    const ok = (px: number, py: number) =>
      px >= rad && px <= W - rad && py >= rad && py <= H - rad && !this.hitsGround(px, py, rad + 0.01) && (!from || this.groundLos(fx, fy, px, py));
    this.sx = Math.max(rad, Math.min(W - rad, x)); this.sy = Math.max(rad, Math.min(H - rad, y));
    if (ok(this.sx, this.sy)) return true;
    // Mirrored between the two halves of the board so neither side is favoured.
    const flip = y < H / 2 ? -1 : 1;
    for (let k = 1; k <= 40; k++) {
      const d = k * 0.1, n = 8 + 4 * k;
      for (let i = 0; i < n; i++) {
        // Straight back first, then alternately either side of it.
        const a = ((i % 2 ? -1 : 1) * Math.ceil(i / 2) * TAU) / n;
        const px = x + Math.sin(a) * d * flip, py = y + Math.cos(a) * d * flip;
        if (ok(px, py)) { this.sx = px; this.sy = py; return true; }
      }
    }
    return false;
  }

  // ------------------------------------------------------------ routes
  private cellOf(x: number, y: number): number {
    const cx = Math.max(0, Math.min(NX - 1, Math.floor(x / NAV_CELL))), cy = Math.max(0, Math.min(NY - 1, Math.floor(y / NAV_CELL)));
    return cy * NX + cx;
  }
  /** The open cell nearest (x, y) within `rings` cells; `softOk` also takes cells only a breakable block closes. */
  private cellNear(x: number, y: number, rr: number, rings: number, softOk: boolean, flip = false): number {
    const c0 = this.cellOf(x, y), cx0 = c0 % NX, cy0 = (c0 - cx0) / NX;
    const open = (c: number) => this.hard[c] >= rr && (softOk || this.soft[c] >= rr);
    if (open(c0)) return c0;
    for (let k = 1; k <= rings; k++) {
      let best = -1, bd = Infinity;
      for (let iy = -k; iy <= k; iy++) for (let ix = -k; ix <= k; ix++) {
        if (Math.max(Math.abs(ix), Math.abs(iy)) !== k) continue;
        const cx = cx0 + (flip ? -ix : ix), cy = cy0 + (flip ? -iy : iy);
        if (cx < 0 || cy < 0 || cx >= NX || cy >= NY) continue;
        const c = cy * NX + cx;
        if (!open(c)) continue;
        const d = Math.hypot((cx + 0.5) * NAV_CELL - x, (cy + 0.5) * NAV_CELL - y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  private push(c: number, f: number) {
    const hc = this.heapC, hf = this.heapF;
    let i = hc.length;
    hc.push(c); hf.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= f) break;
      hc[i] = hc[p]; hf[i] = hf[p];
      i = p;
    }
    hc[i] = c; hf[i] = f;
  }
  private pop(): number {
    const hc = this.heapC, hf = this.heapF;
    const top = hc[0], c = hc.pop()!, f = hf.pop()!, n = hc.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let k = 2 * i + 1;
        if (k >= n) break;
        if (k + 1 < n && hf[k + 1] < hf[k]) k++;
        if (hf[k] >= f) break;
        hc[i] = hc[k]; hf[i] = hf[k];
        i = k;
      }
      hc[i] = c; hf[i] = f;
    }
    return top;
  }
  /**
   * A ground route for a body of radius `rad` from (x0, y0) toward (x1, y1): A* over the clearance grid, then pulled
   * straight into a few corner waypoints (in `pts`, `np` of them). `pen` is what breaking through a breakable block
   * costs, in world units of walking per point of the block's health (0 = never break through): when the cheapest
   * route crosses one, the route stops in front of it and `breach` names it. `partial` is set when the goal can't be
   * reached and the route leads to the nearest point that can. Returns false when the body has nowhere to go.
   * `flip` runs the search turned half round (pass it for side 1), so on a symmetric arena the two sides' routes are
   * exact mirror images and ties between equal routes favour neither.
   */
  path(x0: number, y0: number, x1: number, y1: number, rad: number, pen: number, flip = false): boolean {
    const rr = rad - NAV_TOL, hard = this.hard, soft = this.soft;
    this.np = 0; this.breach = -1; this.partial = false;
    const s = this.cellNear(x0, y0, rr, 4, false, flip);
    if (s < 0) return false;
    let g = this.cellNear(x1, y1, rr, 8, pen > 0, flip);
    if (g < 0) g = this.cellOf(x1, y1);
    const gx = g % NX, gy = (g - gx) / NX;
    const stamp = ++this.stamp, gs = this.gs, par = this.par, seen = this.seen, closed = this.closed;
    this.heapC.length = 0; this.heapF.length = 0;
    const h = (c: number) => {
      const ax = Math.abs((c % NX) - gx), ay = Math.abs(Math.floor(c / NX) - gy);
      return ax > ay ? ax + 0.4142 * ay : ay + 0.4142 * ax;
    };
    gs[s] = 0; seen[s] = stamp; par[s] = -1;
    this.push(s, h(s));
    let found = -1, best = s, bh = h(s);
    while (this.heapC.length) {
      const c = this.pop();
      if (closed[c] === stamp) continue;
      closed[c] = stamp;
      if (c === g) { found = c; break; }
      const hc = h(c);
      if (hc < bh) { bh = hc; best = c; }
      const cx = c % NX, cy = (c - cx) / NX, cSoft = soft[c] < rr;
      for (let iy = -1; iy <= 1; iy++) for (let ix = -1; ix <= 1; ix++) {
        if (!ix && !iy) continue;
        const dx = flip ? -ix : ix, dy = flip ? -iy : iy;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= NX || ny >= NY) continue;
        const n = ny * NX + nx;
        if (closed[n] === stamp || hard[n] < rr) continue;
        const nSoft = soft[n] < rr;
        if (nSoft && pen <= 0) continue;
        if (dx && dy) {
          // No cutting corners.
          const a = cy * NX + nx, b = ny * NX + cx;
          if (hard[a] < rr || hard[b] < rr || (pen <= 0 && (soft[a] < rr || soft[b] < rr))) continue;
        }
        let cost = dx && dy ? 1.4142 : 1;
        if (nSoft && !cSoft) cost += (pen * this.blocks[this.near[n]].hp) / NAV_CELL;
        else if (hard[n] < rad + 0.12 || soft[n] < rad + 0.12) cost += 0.5; // keep off the walls where there is room
        const ng = gs[c] + cost;
        if (seen[n] === stamp && ng >= gs[n]) continue;
        gs[n] = ng; seen[n] = stamp; par[n] = c;
        this.push(n, ng + h(n));
      }
    }
    if (found < 0) { found = best; this.partial = true; }
    // Cells from start to goal.
    const cells = this.cells;
    cells.length = 0;
    for (let c = found; c >= 0; c = par[c]) cells.push(c);
    cells.reverse();
    let m = cells.length;
    for (let i = 0; i < m; i++) if (soft[cells[i]] < rr) { this.breach = this.near[cells[i]]; m = i; break; }
    // Pull the cell path straight: keep only the corners.
    const pts = this.pts;
    let ax = x0, ay = y0, n = 0, i = 0;
    while (i < m) {
      let j = i;
      while (j + 1 < m && this.clear(ax, ay, ((cells[j + 1] % NX) + 0.5) * NAV_CELL, (Math.floor(cells[j + 1] / NX) + 0.5) * NAV_CELL, rr)) j++;
      ax = ((cells[j] % NX) + 0.5) * NAV_CELL; ay = (Math.floor(cells[j] / NX) + 0.5) * NAV_CELL;
      pts[n++] = ax; pts[n++] = ay;
      i = j + 1;
    }
    if (this.breach < 0 && !this.partial && this.clear(ax, ay, x1, y1, rr)) {
      // Finish on the goal itself rather than its cell's centre.
      if (n >= 2 && Math.hypot(ax - x1, ay - y1) < NAV_CELL * 1.5 && (n < 4 ? this.clear(x0, y0, x1, y1, rr) : this.clear(pts[n - 4], pts[n - 3], x1, y1, rr))) n -= 2;
      pts[n++] = x1; pts[n++] = y1;
    }
    this.np = n >> 1;
    return this.np > 0 || this.breach >= 0;
  }

  /** Can a body of radius `rad` walk from one point to the other without breaking anything. */
  reachable(x0: number, y0: number, x1: number, y1: number, rad: number): boolean {
    return this.path(x0, y0, x1, y1, rad, 0) && !this.partial;
  }
}
