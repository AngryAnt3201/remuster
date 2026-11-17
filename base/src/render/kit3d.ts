// A small solid-geometry kit for the battlefield: buildings, walls, trees and props are meshes of flat polygons in
// world space, lit by a fixed sun, inked, and drawn through the board camera (camera.ts) from any angle. This is
// what lets the world turn: nothing here is a picture taken from one side.
//
//   const m = new Mesh();
//   m.box(0, 0, 0, 1, 1, 1, "#b9b2a4");
//   m.gable(0, 0, 1, 1, 1, 0.5, "#c2553c", "x");
//   for (const piece of slice(m.faces, x0, y0, x1, y1)) drawables.push({ x: piece.x, y: piece.y, layer: 1, draw: () => drawFaces(ctx, cam, piece.faces, look) });
//
// Faces sort far-to-near inside a piece; pieces sort with the units by where they stand (slice() cuts a long mesh
// into cells so a unit beside a wall is hidden by the stretch in front of it and drawn over the stretch behind).
import type { Camera } from "./camera";

export type P3 = [number, number, number];
export interface Face {
  p: P3[];
  /** Base colour (#rrggbb). */
  c: string;
  n: P3;
  /** Per edge (p[i] to p[i+1]): draw the ink line. Absent = every edge; false = none. */
  ink?: boolean[] | false;
  /** Drawn as is, unlit (windows, lamps, signs). */
  flat?: boolean;
  /** Seen from both sides (cloth, leaves). */
  two?: boolean;
  /** Pulls the face toward the camera in the sort (a door on a wall), world units. */
  bias?: number;
  alpha?: number;
}
export interface KitLook {
  ink: string;
  /** Ink width in world units (0 = no outlines). */
  inkW: number;
  /** Unit vector toward the sun, world space. */
  light: P3;
  /** Brightness of the fully shaded side (0..1) and an optional colour the shade leans toward. */
  dark: number;
  tint?: string;
  /** Bands of shading (0 = smooth). */
  bands: number;
}

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centroid = (p: P3[]): P3 => { let x = 0, y = 0, z = 0; for (const q of p) { x += q[0]; y += q[1]; z += q[2]; } return [x / p.length, y / p.length, z / p.length]; };
function normal(p: P3[]): P3 {
  let x = 0, y = 0, z = 0; // Newell
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

export class Mesh {
  faces: Face[] = [];
  /** Add a polygon. `away`: a point the face looks away from (the inside of its solid). */
  face(p: P3[], c: string, away?: P3 | null, o: Partial<Face> = {}): Face {
    let n = normal(p);
    if (away && dot(n, sub(centroid(p), away)) < 0) n = [-n[0], -n[1], -n[2]];
    const f: Face = { p, c, n, ...o };
    this.faces.push(f);
    return f;
  }
  /** An axis-aligned box. `c` may give the top its own colour. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string, top = c, o: Partial<Face> = {}) {
    const m: P3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top, m, o);
    this.face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c, m, o);
    this.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], c, m, o);
    this.face([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], c, m, o);
    this.face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], c, m, o);
  }
  /** An upright n-sided prism, frustum (r1 != r0) or cone (r1 = 0). `turn` rotates it about its axis. */
  prism(cx: number, cy: number, z0: number, z1: number, r0: number, n: number, c: string, r1 = r0, top = c, turn = Math.PI / n, o: Partial<Face> = {}) {
    const m: P3 = [cx, cy, (z0 + z1) / 2];
    const ring = (r: number, z: number): P3[] => Array.from({ length: n }, (_, i) => { const a = turn + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as P3; });
    const a = ring(r0, z0), b = ring(r1, z1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (r1 > 1e-4) this.face([a[i], a[j], b[j], b[i]], c, m, o); else this.face([a[i], a[j], [cx, cy, z1]], c, m, o);
    }
    if (r1 > 1e-4) this.face(b, top, m, o);
  }
  /** A gable roof over a rectangle: ridge along `axis`, eaves at z0, ridge h above. */
  gable(x0: number, y0: number, x1: number, y1: number, z0: number, h: number, c: string, axis: "x" | "y", end = c, o: Partial<Face> = {}) {
    const m: P3 = [(x0 + x1) / 2, (y0 + y1) / 2, z0];
    if (axis === "x") {
      const yc = (y0 + y1) / 2;
      this.face([[x0, y0, z0], [x1, y0, z0], [x1, yc, z0 + h], [x0, yc, z0 + h]], c, m, o);
      this.face([[x0, y1, z0], [x1, y1, z0], [x1, yc, z0 + h], [x0, yc, z0 + h]], c, m, o);
      this.face([[x0, y0, z0], [x0, y1, z0], [x0, yc, z0 + h]], end, m, o);
      this.face([[x1, y0, z0], [x1, y1, z0], [x1, yc, z0 + h]], end, m, o);
    } else {
      const xc = (x0 + x1) / 2;
      this.face([[x0, y0, z0], [x0, y1, z0], [xc, y1, z0 + h], [xc, y0, z0 + h]], c, m, o);
      this.face([[x1, y0, z0], [x1, y1, z0], [xc, y1, z0 + h], [xc, y0, z0 + h]], c, m, o);
      this.face([[x0, y0, z0], [x1, y0, z0], [xc, y0, z0 + h]], end, m, o);
      this.face([[x0, y1, z0], [x1, y1, z0], [xc, y1, z0 + h]], end, m, o);
    }
  }
  /** A hip roof: the ridge is pulled in from both ends by `inset` (a pyramid when the ridge shrinks to a point);
   *  `flat` > 0 cuts the top off at that fraction of the half-width (a mansard / pagoda tier). */
  hip(x0: number, y0: number, x1: number, y1: number, z0: number, h: number, c: string, flat = 0, o: Partial<Face> = {}) {
    const w = x1 - x0, d = y1 - y0, m: P3 = [(x0 + x1) / 2, (y0 + y1) / 2, z0];
    const half = Math.min(w, d) / 2, k = half * (1 - flat);
    const a: P3 = [x0 + k, y0 + k, z0 + h], b: P3 = [x1 - k, y0 + k, z0 + h], cc: P3 = [x1 - k, y1 - k, z0 + h], e: P3 = [x0 + k, y1 - k, z0 + h];
    const poly = (p: P3[]) => { const q = p.filter((v, i) => i === 0 || Math.hypot(v[0] - p[i - 1][0], v[1] - p[i - 1][1], v[2] - p[i - 1][2]) > 1e-6); if (q.length >= 3) this.face(q, c, m, o); };
    poly([[x0, y0, z0], [x1, y0, z0], b, a]); poly([[x1, y0, z0], [x1, y1, z0], cc, b]);
    poly([[x1, y1, z0], [x0, y1, z0], e, cc]); poly([[x0, y1, z0], [x0, y0, z0], a, e]);
    if (flat > 0) this.face([a, b, cc, e], c, m, o);
  }
  /** A low-poly ball (three rings). */
  blob(cx: number, cy: number, cz: number, r: number, c: string, n = 6, squash = 1, o: Partial<Face> = {}) {
    const m: P3 = [cx, cy, cz];
    const ring = (lat: number, t: number): P3[] => Array.from({ length: n }, (_, i) => { const a = t + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r * Math.cos(lat), cy + Math.sin(a) * r * Math.cos(lat), cz + Math.sin(lat) * r * squash] as P3; });
    const rs = [ring(-0.75, 0), ring(0, Math.PI / n), ring(0.75, 0)];
    const bot: P3 = [cx, cy, cz - r * squash], top: P3 = [cx, cy, cz + r * squash];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.face([bot, rs[0][i], rs[0][j]], c, m, o);
      this.face([rs[0][i], rs[1][i], rs[0][j]], c, m, o); this.face([rs[0][j], rs[1][i], rs[1][j]], c, m, o);
      this.face([rs[1][i], rs[2][j], rs[1][j]], c, m, o); this.face([rs[1][i], rs[2][i], rs[2][j]], c, m, o);
      this.face([rs[2][i], top, rs[2][j]], c, m, o);
    }
  }
  /** A flat panel (cloth, a sign, a leaf): seen from both sides. */
  panel(p: P3[], c: string, o: Partial<Face> = {}) { return this.face(p, c, null, { two: true, ...o }); }
  /** A decal on a wall: a quad given by its bottom edge (a to b) and height, pushed out along the wall's normal. */
  decal(a: P3, b: P3, h: number, c: string, out: P3, o: Partial<Face> = {}) {
    const e = 0.012, d: P3 = [out[0] * e, out[1] * e, out[2] * e];
    const p: P3[] = [[a[0] + d[0], a[1] + d[1], a[2]], [b[0] + d[0], b[1] + d[1], b[2]], [b[0] + d[0], b[1] + d[1], b[2] + h], [a[0] + d[0], a[1] + d[1], a[2] + h]];
    const f = this.face(p, c, [p[0][0] - out[0], p[0][1] - out[1], p[0][2]], { bias: 0.08, ...o });
    return f;
  }
  add(m: Mesh) { this.faces.push(...m.faces); return this; }
}

// ------------------------------------------------------------------------------------------------ colour
const rgbCache = new Map<string, [number, number, number]>();
export function rgb(c: string): [number, number, number] {
  let v = rgbCache.get(c);
  if (v) return v;
  if (c[0] === "#") {
    const h = c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1, 7);
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  } else { const m = c.match(/[\d.]+/g) ?? ["128", "128", "128"]; v = [+m[0], +m[1], +m[2]]; }
  rgbCache.set(c, v);
  return v;
}
const shadeCache = new Map<string, string>();
/** A colour at brightness f (1 = as given, above 1 lightens), its shaded part leaning toward `tint`. */
export function shade(c: string, f: number, tint?: string, flash = 0): string {
  const q = Math.round(f * 40), key = c + q + (tint ?? "") + (flash ? Math.round(flash * 8) : "");
  let s = shadeCache.get(key);
  if (s) return s;
  let [r, g, b] = rgb(c);
  const k = q / 40;
  if (k <= 1) {
    r *= k; g *= k; b *= k;
    if (tint) { const t = rgb(tint), a = (1 - k) * 0.4; r += (t[0] - r) * a; g += (t[1] - g) * a; b += (t[2] - b) * a; }
  } else { const a = k - 1; r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
  if (flash) { r += (255 - r) * flash; g += (255 - g) * flash; b += (255 - b) * flash; }
  s = `rgb(${r | 0},${g | 0},${b | 0})`;
  shadeCache.set(key, s);
  return s;
}
export const mix = (a: string, b: string, t: number): string => { const p = rgb(a), q = rgb(b); return `rgb(${(p[0] + (q[0] - p[0]) * t) | 0},${(p[1] + (q[1] - p[1]) * t) | 0},${(p[2] + (q[2] - p[2]) * t) | 0})`; };

// ------------------------------------------------------------------------------------------------ drawing
/** Where the camera stands, world space (the curve of the ground is ignored: it is far away). */
export function eye(cam: Camera): P3 {
  const d = cam.dist * cam.sin;
  return [cam.W / 2 + d * Math.sin(cam.yaw), cam.H / 2 + d * Math.cos(cam.yaw), cam.dist * cam.cos];
}

export interface DrawOpts { alpha?: number; flash?: number; /** skip the ink (far scenery) */ noInk?: boolean; }
const order: { f: Face; d: number }[] = [];
/** Draw faces far-to-near with back-face culling, banded sun shading and ink. */
export function drawFaces(ctx: CanvasRenderingContext2D, cam: Camera, faces: readonly Face[], look: KitLook, o: DrawOpts = {}) {
  const e = eye(cam);
  order.length = 0;
  for (const f of faces) {
    const c = centroid(f.p), v: P3 = [e[0] - c[0], e[1] - c[1], e[2] - c[2]];
    if (!f.two && dot(f.n, v) <= 0) continue;
    order.push({ f, d: Math.hypot(v[0], v[1], v[2]) - (f.bias ?? 0) });
  }
  order.sort((a, b) => b.d - a.d);
  const A = o.alpha ?? 1;
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  for (const { f } of order) {
    let lam = dot(f.n, look.light);
    if (f.two && lam < 0) lam = -lam * 0.7;
    let k = f.n[2] > 0.92 ? 1.08 : look.dark + (1 - look.dark) * Math.max(0, Math.min(1, lam * 0.95 + 0.2));
    if (look.bands && f.n[2] <= 0.92) k = look.dark + Math.round(((k - look.dark) / (1 - look.dark)) * look.bands) / look.bands * (1 - look.dark);
    ctx.fillStyle = f.flat ? (o.flash ? shade(f.c, 1, undefined, o.flash) : f.c) : shade(f.c, k, look.tint, o.flash ?? 0);
    ctx.globalAlpha = A * (f.alpha ?? 1);
    ctx.beginPath();
    let s = 0;
    const n = f.p.length, sx = new Array<number>(n), sy = new Array<number>(n);
    for (let i = 0; i < n; i++) { const q = f.p[i], p = cam.project(q[0], q[1], q[2]); sx[i] = p.x; sy[i] = p.y; s += p.s; i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.closePath();
    ctx.fill();
    // close hairline gaps between neighbours
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.6; ctx.stroke();
    if (look.inkW > 0 && f.ink !== false && !o.noInk) {
      ctx.strokeStyle = look.ink; ctx.lineWidth = Math.max(0.8, (s / n) * look.inkW);
      if (!f.ink) ctx.stroke();
      else {
        ctx.beginPath();
        for (let i = 0; i < n; i++) if (f.ink[i]) { const j = (i + 1) % n; ctx.moveTo(sx[i], sy[i]); ctx.lineTo(sx[j], sy[j]); }
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------------------------------------ slicing
/** Clip a face to the half-space where coordinate `ax` (0 = x, 1 = y) is >= v (keep = 1) or <= v (keep = -1). */
function clip(f: Face, ax: 0 | 1, v: number, keep: 1 | -1): Face | null {
  const n = f.p.length, ink = f.ink === false ? null : f.ink;
  const inside = (q: P3) => (q[ax] - v) * keep >= -1e-9;
  let all = true, none = true;
  for (const q of f.p) { if (inside(q)) none = false; else all = false; }
  if (all) return f;
  if (none) return null;
  const p: P3[] = [], e: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const a = f.p[i], b = f.p[(i + 1) % n], fl = ink ? ink[i] : f.ink !== false;
    const ia = inside(a), ib = inside(b);
    const cut = (): P3 => { const t = (v - a[ax]) / (b[ax] - a[ax]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
    if (ia && ib) { p.push(a); e.push(fl); }
    else if (ia && !ib) { p.push(a); e.push(fl); p.push(cut()); e.push(false); }
    else if (!ia && ib) { p.push(cut()); e.push(fl); }
  }
  return p.length >= 3 ? { ...f, p, ink: f.ink === false ? false : e } : null;
}
export interface Piece { x: number; y: number; faces: Face[]; }
/** Cut a mesh standing on the rectangle (x0, y0)-(x1, y1) into cells no larger than `cell`, each sorted where it
 *  stands. Faces overhanging the rectangle go with the nearest cell. */
export function slice(faces: Face[], x0: number, y0: number, x1: number, y1: number, cell = 0.85): Piece[] {
  const nx = Math.max(1, Math.ceil((x1 - x0 - 1e-6) / cell)), ny = Math.max(1, Math.ceil((y1 - y0 - 1e-6) / cell));
  if (nx === 1 && ny === 1) return [{ x: (x0 + x1) / 2, y: (y0 + y1) / 2, faces }];
  const out: Piece[] = [];
  const dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const fs: Face[] = [];
    for (const f0 of faces) {
      let f: Face | null = f0;
      if (i > 0) f = f && clip(f, 0, x0 + i * dx, 1);
      if (i < nx - 1) f = f && clip(f, 0, x0 + (i + 1) * dx, -1);
      if (j > 0) f = f && clip(f, 1, y0 + j * dy, 1);
      if (j < ny - 1) f = f && clip(f, 1, y0 + (j + 1) * dy, -1);
      if (f) fs.push(f);
    }
    if (fs.length) out.push({ x: x0 + (i + 0.5) * dx, y: y0 + (j + 0.5) * dy, faces: fs });
  }
  return out;
}

/** Path a polygon lying on the ground (z above it), following the curve of the world. */
export function groundPoly(ctx: CanvasRenderingContext2D, cam: Camera, pts: readonly (readonly [number, number])[], z = 0) {
  ctx.beginPath();
  let first = true;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const n = cam.bend ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5)) : 1;
    for (let k = 0; k < n; k++) {
      const p = cam.project(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, z);
      first ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); first = false;
    }
  }
  ctx.closePath();
}
