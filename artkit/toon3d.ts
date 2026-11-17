// Toon 3D: a small software renderer for chunky, inked, cel-shaded game sprites. Pure TypeScript on typed arrays (no
// DOM, no WebGL), so it runs the same in the bake page, in Node and in tests.
//
//   const m = new Model();
//   m.sphere([0, 0, 0.5], 0.25, mat("#c8873a", { metal: 0.6 }));
//   const sprite = render(m, { yaw: 45, el: 53.3, ppu: 128, style: DEFAULT_STYLE, teams: [TIDE, EMBER] });
//
// Model space: +x forward (where the body faces), +y the body's right side, +z up; one unit = one world unit.
// The camera is orthographic, pitched `el` degrees below the horizon, and `yaw` turns the model to a screen facing
// (0 = facing screen right, 90 = facing the camera, -90 = facing away), as the game's atlas facings do.
// Primitives are tessellated to triangles and drawn into a depth buffer with normals, materials and part ids, so
// limbs, held items and overlapping parts always sort correctly per pixel. Shading is by band (cel), outlines are
// inked from the buffers (silhouette, plus inner lines where one part stands in front of another).

export type V3 = [number, number, number];
/** A 3x4 affine transform, row-major: [xx xy xz tx, yx yy yz ty, zx zy zz tz]. */
export type M34 = number[];

// ------------------------------------------------------------------------------------------------ vectors
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const DEG = Math.PI / 180;

export const IDENT: M34 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
export function mmul(a: M34, b: M34): M34 {
  const o = new Array(12);
  for (let r = 0; r < 3; r++) {
    const a0 = a[r * 4], a1 = a[r * 4 + 1], a2 = a[r * 4 + 2];
    o[r * 4] = a0 * b[0] + a1 * b[4] + a2 * b[8];
    o[r * 4 + 1] = a0 * b[1] + a1 * b[5] + a2 * b[9];
    o[r * 4 + 2] = a0 * b[2] + a1 * b[6] + a2 * b[10];
    o[r * 4 + 3] = a0 * b[3] + a1 * b[7] + a2 * b[11] + a[r * 4 + 3];
  }
  return o;
}
export const mpoint = (m: M34, p: V3): V3 => [
  m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
  m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
  m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
];
export const mdir = (m: M34, p: V3): V3 => [
  m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
  m[4] * p[0] + m[5] * p[1] + m[6] * p[2],
  m[8] * p[0] + m[9] * p[1] + m[10] * p[2],
];
export const translation = (x: number, y: number, z: number): M34 => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
export const scaling = (x: number, y = x, z = x): M34 => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0];
export function rotation(axis: "x" | "y" | "z", deg: number): M34 {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  if (axis === "x") return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0];
  if (axis === "y") return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0];
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0];
}
/** A frame at `pos` whose local +x points along `fwd` and whose local +z is as close to `up` as it can be. */
export function frameAt(pos: V3, fwd: V3 = [1, 0, 0], up: V3 = [0, 0, 1]): M34 {
  const x = norm(fwd);
  let y = cross(up, x);
  if (len(y) < 1e-6) y = cross([0, 1, 0], x);
  y = norm(y);
  const z = cross(x, y);
  return [x[0], y[0], z[0], pos[0], x[1], y[1], z[1], pos[1], x[2], y[2], z[2], pos[2]];
}

// ------------------------------------------------------------------------------------------------ materials
export interface Material {
  /** "#rrggbb". Ignored when `team` is set. */
  color: string;
  /** Take the colour from the team being baked: its main, dark or light shade. */
  team?: "main" | "dark" | "light";
  /** How strongly the shadow bands darken this part (1 = the style's bands, 0 = flat). */
  shade?: number;
  /** 0..1: a hard specular highlight, for brass, steel and glass. */
  metal?: number;
  /** 0..1: how unlit the part is (1 = a pure light source). */
  emit?: number;
  /** > 0: the part throws a soft halo of its own colour (lamps, Ascended trim, furnace mouths). */
  glow?: number;
  /** false: never inked (steam, flames, glows). */
  ink?: boolean;
  /** < 1: see-through (steam, glass). */
  alpha?: number;
}
export function mat(color: string, o: Omit<Material, "color"> = {}): Material { return { color, ...o }; }
/** A team-coloured material: `shade` picks the team's main, dark or light colour. */
export function team(shade: "main" | "dark" | "light" = "main", o: Omit<Material, "color" | "team"> = {}): Material {
  return { color: "#ffffff", team: shade, ...o };
}

export interface TeamCols { main: string; dark: string; light: string; }

// ------------------------------------------------------------------------------------------------ model
interface PrimOpts {
  /** Segments around (default 14). */
  segs?: number;
}

export class Model {
  /** Vertex positions and normals in root space (3 per vertex). */
  pos: number[] = [];
  nrm: number[] = [];
  /** Triangles: 3 vertex indices each, plus one material index, part id and depth bias per triangle. */
  tri: number[] = [];
  triMat: number[] = [];
  triObj: number[] = [];
  triBias: number[] = [];
  mats: Material[] = [];
  private matIx = new Map<Material, number>();
  private cur: M34 = IDENT.slice();
  private stack: M34[] = [];
  private obj = 0;
  private grouped = 0;
  private bias = 0;

  // ---- transform stack
  push() { this.stack.push(this.cur); return this; }
  pop() { this.cur = this.stack.pop() ?? IDENT.slice(); return this; }
  /** Run `fn` inside a saved transform. */
  with(fn: () => void) { this.push(); try { fn(); } finally { this.pop(); } return this; }
  /** Run `fn` inside frame `f` (a matrix in the current space, e.g. a rig's hand or head frame). */
  at(f: M34, fn: () => void) { this.push(); this.cur = mmul(this.cur, f); try { fn(); } finally { this.pop(); } return this; }
  move(x: number, y = 0, z = 0) { this.cur = mmul(this.cur, translation(x, y, z)); return this; }
  rotX(deg: number) { this.cur = mmul(this.cur, rotation("x", deg)); return this; }
  rotY(deg: number) { this.cur = mmul(this.cur, rotation("y", deg)); return this; }
  rotZ(deg: number) { this.cur = mmul(this.cur, rotation("z", deg)); return this; }
  scale(x: number, y = x, z = x) { this.cur = mmul(this.cur, scaling(x, y, z)); return this; }
  apply(f: M34) { this.cur = mmul(this.cur, f); return this; }
  /** The current transform (a copy): keep it to come back with `at`. */
  matrix(): M34 { return this.cur.slice(); }
  /** A local point in root space. */
  point(p: V3): V3 { return mpoint(this.cur, p); }
  /** All primitives made inside `fn` count as one part: no ink lines between them. */
  group(fn: () => void) { if (!this.grouped) this.obj++; this.grouped++; try { fn(); } finally { this.grouped--; } return this; }
  /** Primitives made inside `fn` are pulled `d` world units towards the camera (decals, faces, stripes on a surface). */
  decal(d: number, fn: () => void) { const b = this.bias; this.bias = b + d; try { fn(); } finally { this.bias = b; } return this; }

  private mid(m: Material) {
    let i = this.matIx.get(m);
    if (i === undefined) { i = this.mats.length; this.mats.push(m); this.matIx.set(m, i); }
    return i;
  }
  private part() { if (!this.grouped) this.obj++; return this.obj; }

  /** Adds a vertex (local position and normal) and returns its index. */
  private vert(p: V3, n: V3) {
    const c = this.cur;
    this.pos.push(c[0] * p[0] + c[1] * p[1] + c[2] * p[2] + c[3], c[4] * p[0] + c[5] * p[1] + c[6] * p[2] + c[7], c[8] * p[0] + c[9] * p[1] + c[10] * p[2] + c[11]);
    // normals go through the cofactor matrix so squashed parts still shade right
    const a = c[0], b = c[1], cc = c[2], d = c[4], e = c[5], f = c[6], g = c[8], h = c[9], i = c[10];
    const nx = (e * i - f * h) * n[0] + (f * g - d * i) * n[1] + (d * h - e * g) * n[2];
    const ny = (cc * h - b * i) * n[0] + (a * i - cc * g) * n[1] + (b * g - a * h) * n[2];
    const nz = (b * f - cc * e) * n[0] + (cc * d - a * f) * n[1] + (a * e - b * d) * n[2];
    const l = Math.hypot(nx, ny, nz) || 1;
    this.nrm.push(nx / l, ny / l, nz / l);
    return this.pos.length / 3 - 1;
  }
  private face(a: number, b: number, c: number, mi: number, oi: number) {
    this.tri.push(a, b, c); this.triMat.push(mi); this.triObj.push(oi); this.triBias.push(this.bias);
  }

  /** Rings of (offset along the axis, radius, normal along the axis, normal outwards) swept around an axis. */
  private revolve(origin: V3, axis: V3, profile: [t: number, r: number, nt: number, nr: number][], m: Material, segs = 14) {
    const mi = this.mid(m), oi = this.part();
    const ax = norm(axis);
    let u = cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]); u = norm(u);
    const w = cross(ax, u);
    const rows: number[][] = [];
    for (const [t, r, nt, nr] of profile) {
      const row: number[] = [];
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const rad: V3 = [u[0] * ca + w[0] * sa, u[1] * ca + w[1] * sa, u[2] * ca + w[2] * sa];
        row.push(this.vert(
          [origin[0] + ax[0] * t + rad[0] * r, origin[1] + ax[1] * t + rad[1] * r, origin[2] + ax[2] * t + rad[2] * r],
          [ax[0] * nt + rad[0] * nr, ax[1] * nt + rad[1] * nr, ax[2] * nt + rad[2] * nr]));
      }
      rows.push(row);
    }
    for (let k = 0; k + 1 < rows.length; k++) {
      const a = rows[k], b = rows[k + 1];
      for (let s = 0; s < segs; s++) {
        const s1 = (s + 1) % segs;
        this.face(a[s], a[s1], b[s1], mi, oi);
        this.face(a[s], b[s1], b[s], mi, oi);
      }
    }
    return this;
  }

  /** A ball. */
  sphere(c: V3, r: number, m: Material, o: PrimOpts = {}) { return this.ellipsoid(c, [r, r, r], m, o); }
  /** A ball stretched along the local axes: radii [x, y, z]. */
  ellipsoid(c: V3, r: V3, m: Material, o: PrimOpts = {}) {
    const rings = 9, prof: [number, number, number, number][] = [];
    for (let k = 0; k <= rings; k++) { const a = (k / rings) * Math.PI; prof.push([-Math.cos(a), Math.sin(a), -Math.cos(a), Math.sin(a)]); }
    return this.with(() => { this.move(c[0], c[1], c[2]).scale(r[0], r[1], r[2]); this.revolve([0, 0, 0], [0, 0, 1], prof, m, o.segs ?? 14); });
  }
  /** A pill from a to b (radius r at a, r2 at b: a tapered limb). */
  capsule(a: V3, b: V3, r: number, m: Material, r2 = r, o: PrimOpts = {}) {
    const d = sub(b, a), L = len(d);
    if (L < 1e-6) return this.sphere(a, Math.max(r, r2), m, o);
    const prof: [number, number, number, number][] = [];
    const sl = (r - r2) / L, nr = Math.sqrt(Math.max(0.05, 1 - sl * sl));
    for (let k = 0; k <= 4; k++) { const an = (k / 4) * (Math.PI / 2); prof.push([-Math.cos(an) * r, Math.sin(an) * r, -Math.cos(an), Math.sin(an)]); }
    prof.push([0, r, sl, nr], [L, r2, sl, nr]);
    for (let k = 4; k >= 0; k--) { const an = (k / 4) * (Math.PI / 2); prof.push([L + Math.cos(an) * r2, Math.sin(an) * r2, Math.cos(an), Math.sin(an)]); }
    return this.revolve(a, d, prof, m, o.segs ?? 12);
  }
  /** A can from a to b with flat ends (radius r at a, r2 at b; r2 = 0 makes a cone). */
  cylinder(a: V3, b: V3, r: number, m: Material, r2 = r, o: PrimOpts = {}) {
    const d = sub(b, a), L = len(d);
    const sl = (r - r2) / (L || 1), k = Math.hypot(1, sl);
    return this.revolve(a, d, [[0, 0, -1, 0], [0, r, -1, 0], [0, r, sl / k, 1 / k], [L, r2, sl / k, 1 / k], [L, r2, 1, 0], [L, 0, 1, 0]], m, o.segs ?? 14);
  }
  /** A cone standing on a (radius r) with its tip at b. */
  cone(a: V3, b: V3, r: number, m: Material, o: PrimOpts = {}) { return this.cylinder(a, b, r, m, 0, o); }
  /** A turned shape about the local z axis through `c`: `profile` is a list of [radius, z] from bottom to top. */
  lathe(profile: [number, number][], m: Material, o: PrimOpts & { at?: V3; smooth?: boolean } = {}) {
    const prof: [number, number, number, number][] = [];
    const nrm = (i: number): [number, number] => {
      const a = profile[i], b = profile[i + 1];
      const dr = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dr, dz) || 1;
      return [-dr / l, dz / l]; // [along axis, outwards]
    };
    for (let i = 0; i < profile.length; i++) {
      const [r, z] = profile[i];
      if (o.smooth) {
        const n0 = nrm(Math.max(0, i - 1)), n1 = nrm(Math.min(profile.length - 2, i));
        const nt = n0[0] + n1[0], nr = n0[1] + n1[1], l = Math.hypot(nt, nr) || 1;
        prof.push([z, r, nt / l, nr / l]);
      } else {
        if (i > 0) { const n = nrm(i - 1); prof.push([z, r, n[0], n[1]]); }
        if (i < profile.length - 1) { const n = nrm(i); prof.push([z, r, n[0], n[1]]); }
      }
    }
    return this.revolve(o.at ?? [0, 0, 0], [0, 0, 1], prof, m, o.segs ?? 16);
  }
  /** A round tube along a path (radius r, or one radius per point). */
  tube(path: V3[], r: number | number[], m: Material, o: PrimOpts = {}) {
    const mi = this.mid(m), oi = this.part(), segs = o.segs ?? 8, n = path.length;
    if (n < 2) return this;
    const rad = (i: number) => (typeof r === "number" ? r : r[Math.min(i, r.length - 1)]);
    let t0 = norm(sub(path[1], path[0]));
    let u = norm(cross(t0, Math.abs(t0[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    const rows: number[][] = [];
    for (let i = 0; i < n; i++) {
      const t = norm(sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)]));
      // carry the ring's frame along the path so the tube never twists
      u = norm(sub(u, mul(t, dot(u, t))));
      const w = cross(t, u);
      const row: number[] = [];
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const d: V3 = [u[0] * ca + w[0] * sa, u[1] * ca + w[1] * sa, u[2] * ca + w[2] * sa];
        row.push(this.vert(add(path[i], mul(d, rad(i))), d));
      }
      rows.push(row);
      t0 = t;
    }
    for (let k = 0; k + 1 < rows.length; k++) for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      this.face(rows[k][s], rows[k][s1], rows[k + 1][s1], mi, oi);
      this.face(rows[k][s], rows[k + 1][s1], rows[k + 1][s], mi, oi);
    }
    for (const [row, p, sgn] of [[rows[0], path[0], -1], [rows[n - 1], path[n - 1], 1]] as [number[], V3, number][]) {
      const t = mul(norm(sub(path[sgn < 0 ? 1 : n - 1], path[sgn < 0 ? 0 : n - 2])), sgn);
      const c = this.vert(p, t);
      for (let s = 0; s < segs; s++) this.face(c, row[s], row[(s + 1) % segs], mi, oi);
    }
    return this;
  }
  /** A box centred on c with full sizes [x, y, z]. */
  box(c: V3, size: V3, m: Material) {
    const mi = this.mid(m), oi = this.part();
    const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
    const F: [V3, V3, V3][] = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
      [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
    ];
    for (const [n, a, b] of F) {
      const q = (sa: number, sb: number): V3 => [
        c[0] + (n[0] + a[0] * sa + b[0] * sb) * hx, c[1] + (n[1] + a[1] * sa + b[1] * sb) * hy, c[2] + (n[2] + a[2] * sa + b[2] * sb) * hz];
      const v0 = this.vert(q(-1, -1), n), v1 = this.vert(q(1, -1), n), v2 = this.vert(q(1, 1), n), v3 = this.vert(q(-1, 1), n);
      this.face(v0, v1, v2, mi, oi); this.face(v0, v2, v3, mi, oi);
    }
    return this;
  }
  /** A flat polygon in 3D (convex, or at least fan-able from its first point), lit from both sides. */
  poly(pts: V3[], m: Material) {
    const mi = this.mid(m), oi = this.part();
    const n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
    const ix = pts.map((p) => this.vert(p, n));
    for (let i = 1; i + 1 < ix.length; i++) this.face(ix[0], ix[i], ix[i + 1], mi, oi);
    return this;
  }
  /** A flat disc at c facing along `n`. */
  disc(c: V3, n: V3, r: number, m: Material, o: PrimOpts = {}) {
    const ax = norm(n);
    const u = norm(cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), w = cross(ax, u);
    const segs = o.segs ?? 14, pts: V3[] = [];
    for (let s = 0; s < segs; s++) { const a = (s / segs) * Math.PI * 2; pts.push(add(c, add(mul(u, Math.cos(a) * r), mul(w, Math.sin(a) * r)))); }
    return this.poly(pts, m);
  }
  /** A 2D outline in the local x-z plane (x forward, z up) given thickness along y, centred on y = 0: plates, gears,
   *  blades, shields, signs. The outline may be concave (it is ear-clipped). */
  extrude(outline: [number, number][], thick: number, m: Material) {
    const mi = this.mid(m), oi = this.part(), h = thick / 2;
    let pts = outline.slice();
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) pts = pts.reverse();
    const tris = earclip(pts);
    for (const side of [1, -1]) {
      const ix = pts.map(([x, z]) => this.vert([x, side * h, z], [0, side, 0]));
      for (const [a, b, c] of tris) this.face(ix[a], ix[b], ix[c], mi, oi);
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const n: V3 = [dz / l, 0, -dx / l];
      const v0 = this.vert([a[0], -h, a[1]], n), v1 = this.vert([b[0], -h, b[1]], n), v2 = this.vert([b[0], h, b[1]], n), v3 = this.vert([a[0], h, a[1]], n);
      this.face(v0, v1, v2, mi, oi); this.face(v0, v2, v3, mi, oi);
    }
    return this;
  }
  /** A ring (torus) at c about axis `n`: major radius R, tube radius r. */
  torus(c: V3, n: V3, R: number, r: number, m: Material, o: PrimOpts = {}) {
    const ax = norm(n);
    const u = norm(cross(ax, Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), w = cross(ax, u);
    const segs = o.segs ?? 16, path: V3[] = [];
    for (let s = 0; s <= segs; s++) { const a = (s / segs) * Math.PI * 2; path.push(add(c, add(mul(u, Math.cos(a) * R), mul(w, Math.sin(a) * R)))); }
    return this.tube(path, r, m, { segs: 6 });
  }

  /** Every vertex of the model (root space) through `f`: fold a whole model into a pose after building it. */
  transform(f: M34) {
    for (let i = 0; i < this.pos.length; i += 3) {
      const p = mpoint(f, [this.pos[i], this.pos[i + 1], this.pos[i + 2]]);
      this.pos[i] = p[0]; this.pos[i + 1] = p[1]; this.pos[i + 2] = p[2];
      const n = norm(mdir(f, [this.nrm[i], this.nrm[i + 1], this.nrm[i + 2]]));
      this.nrm[i] = n[0]; this.nrm[i + 1] = n[1]; this.nrm[i + 2] = n[2];
    }
    return this;
  }
  /** Copy another model's geometry into this one, through the current transform. */
  merge(o: Model) {
    const v0 = this.pos.length / 3, c = this.cur, objBase = this.obj;
    for (let i = 0; i < o.pos.length; i += 3) {
      const p = mpoint(c, [o.pos[i], o.pos[i + 1], o.pos[i + 2]]), n = norm(mdir(c, [o.nrm[i], o.nrm[i + 1], o.nrm[i + 2]]));
      this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]);
    }
    const mm = o.mats.map((m) => this.mid(m));
    for (let t = 0; t < o.triMat.length; t++) {
      this.tri.push(o.tri[t * 3] + v0, o.tri[t * 3 + 1] + v0, o.tri[t * 3 + 2] + v0);
      this.triMat.push(mm[o.triMat[t]]); this.triObj.push(o.triObj[t] + objBase); this.triBias.push(o.triBias[t] + this.bias);
    }
    this.obj += o.obj + 1;
    return this;
  }
  get triangles() { return this.triMat.length; }
}

/** Triangulate a simple counter-clockwise polygon by clipping ears. */
export function earclip(pts: [number, number][]): [number, number, number][] {
  const idx = pts.map((_, i) => i), out: [number, number, number][] = [];
  const cr = (a: number, b: number, c: number) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
  // a point on the ear's edge counts as inside it: cutting that ear would cover the notch the point marks
  const same = (p: number, q: number) => pts[p][0] === pts[q][0] && pts[p][1] === pts[q][1];
  const inside = (p: number, a: number, b: number, c: number) => !same(p, a) && !same(p, b) && !same(p, c) && cr(a, b, p) >= -1e-12 && cr(b, c, p) >= -1e-12 && cr(c, a, p) >= -1e-12;
  let guard = pts.length * pts.length + 8;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if (cr(a, b, c) <= 1e-12) continue;
      if (idx.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      out.push([a, b, c]); idx.splice(i, 1); cut = true;
      break;
    }
    if (!cut) idx.splice(0, 1); // degenerate: drop a point and carry on
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

/** A gear outline for `extrude` (in the x-z plane): `teeth` square teeth between radii r0 (root) and r1 (tip). */
export function gearOutline(teeth: number, r0: number, r1: number, phase = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < teeth; i++) {
    const a = phase + (i / teeth) * Math.PI * 2, s = (Math.PI * 2) / teeth;
    for (const [da, r] of [[0, r0], [0.12, r1], [0.5, r1], [0.62, r0]] as [number, number][]) out.push([Math.cos(a + da * s) * r, Math.sin(a + da * s) * r]);
  }
  return out;
}
/** A regular polygon / circle outline for `extrude`. */
export function ringOutline(n: number, r: number, phase = 0, rz = r): [number, number][] {
  return Array.from({ length: n }, (_, i) => { const a = phase + (i / n) * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * rz] as [number, number]; });
}

// ------------------------------------------------------------------------------------------------ style
export interface Style {
  /** Ink colour and the silhouette's weight in output pixels (at 128 px per unit; it scales with ppu). 0 = none. */
  ink: string;
  outline: number;
  /** Inner lines (where one part stands in front of another), output pixels. 0 = none. */
  inner: number;
  /** Cel bands over N.L: the light value below `t[0]` is `v[0]`, between t[0] and t[1] is v[1], above is v[2]. */
  bands: { t: [number, number]; v: [number, number, number] };
  /** Shadows lean towards this colour by `shadowAmount`. */
  shadowTint: string;
  shadowAmount: number;
  /** Rim light: colour, strength 0..1 and how far it wraps (0.2 thin .. 0.6 broad). */
  rim: { color: string; strength: number; width: number };
  /** Where the key light comes from in world space (x right, y towards the camera, z up). */
  light: V3;
  /** Halo strength and radius (output px at 128 ppu) for glowing parts. */
  glow: { gain: number; radius: number };
  /** A colour grade applied to every material colour: saturation and contrast (1 = unchanged), warmth -1..1, and an
   *  optional free-form remap. */
  grade?: { saturation?: number; contrast?: number; warmth?: number; map?: (rgb: V3) => V3 };
  /** A whole-sprite look applied after rendering (artkit/looks.ts): reuse models with a radically different feel. */
  look?: { kind: "toon" } | { kind: "pixel"; scale: number; levels?: number } | { kind: "neon"; fill?: number } | { kind: "paper"; paper?: string }
    /** Smooth, unbanded shading for realistic figures: wrapped diffuse light over a sky/ground ambient, soft
     *  highlights on metal, forms darkening where they turn away from the eye. Use with outline 0 and inner 0. */
    | { kind: "real"; ambient?: number; spec?: number; edge?: number }
    /** Digitised 90s sprites (looks.ts): smooth hard-lit shading with dark edges and no ink, rendered small, then
     *  noised and ordered-dithered to `levels` shades per channel. `contrast` deepens the falloff (default 1). */
    | { kind: "grit"; scale: number; levels?: number; noise?: number; contrast?: number };
}

export const DEFAULT_STYLE: Style = {
  ink: "#2b1d14", outline: 3, inner: 1.6,
  bands: { t: [0.34, 0.7], v: [0.58, 0.82, 1] },
  shadowTint: "#6c5fb8", shadowAmount: 0.38,
  rim: { color: "#fff1cf", strength: 0.32, width: 0.3 },
  light: [-0.35, 0.4, 1],
  glow: { gain: 0.8, radius: 9 },
};

export const hexRgb = (h: string): V3 => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const rgbHex = (c: V3) => "#" + c.map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, "0")).join("");
/** Mix two hex colours. */
export const mixHex = (a: string, b: string, t: number) => rgbHex(lerp3(hexRgb(a), hexRgb(b), t));

export function gradeColor(c: V3, g: Style["grade"]): V3 {
  if (!g) return c;
  let [r, gg, b] = c;
  const l = 0.3 * r + 0.59 * gg + 0.11 * b, s = g.saturation ?? 1, k = g.contrast ?? 1, w = g.warmth ?? 0;
  r = l + (r - l) * s; gg = l + (gg - l) * s; b = l + (b - l) * s;
  r = 128 + (r - 128) * k; gg = 128 + (gg - 128) * k; b = 128 + (b - 128) * k;
  r += w * 24; b -= w * 24;
  const out: V3 = [clamp(r, 0, 255), clamp(gg, 0, 255), clamp(b, 0, 255)];
  return g.map ? g.map(out) : out;
}

// ------------------------------------------------------------------------------------------------ render
export interface RenderOpts {
  /** Screen facing in degrees: 0 the model faces screen right, 90 the camera, -90 away, 180 screen left. */
  yaw: number;
  /** Camera pitch below the horizon, degrees (the board's camera is 53.3). */
  el: number;
  /** Output pixels per world unit. */
  ppu: number;
  style: Style;
  /** One finished image per team here. */
  teams: TeamCols[];
  /** Supersampling (default 2). */
  ss?: number;
  /** Root-space point that becomes the sprite's anchor (default the origin: the feet). */
  anchor?: V3;
  /** A soft contact shadow of this radius (world units) baked under the model at the anchor. */
  shadow?: number;
  /** Also return a team mask as the last image: red = how much of the pixel is team main, green = team dark,
   *  blue = team light. Render with WHITE_TEAM and the runtime can tint the sprite for any team. */
  mask?: boolean;
}
/** Team parts in neutral white: what a sheet is rendered in when the runtime tints it through a mask. */
export const WHITE_TEAM: TeamCols = { main: "#ffffff", dark: "#ffffff", light: "#ffffff" };
const MASK_TEAM: TeamCols = { main: "#ff0000", dark: "#00ff00", light: "#0000ff" };
/** A rendered sprite: one RGBA image per team (straight alpha) and the anchor's pixel inside it. */
export interface Sprite { w: number; h: number; ax: number; ay: number; data: Uint8ClampedArray[]; }

interface Lut { c: Float32Array; }

/** Draw a model to RGBA: one image per team, trimmed loosely to the model plus its ink and glow. */
export function render(model: Model, o: RenderOpts): Sprite {
  const st = o.style, ss = o.ss ?? 2, S = o.ppu * ss, k = o.ppu / 128;
  const el = o.el * DEG, sinE = Math.sin(el), cosE = Math.cos(el);
  const cy = Math.cos(o.yaw * DEG), sy = Math.sin(o.yaw * DEG);
  const nv = model.pos.length / 3;
  const X = new Float32Array(nv), Y = new Float32Array(nv), Z = new Float32Array(nv), N = new Float32Array(nv * 3);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const proj = (px: number, py: number, pz: number): V3 => {
    const wx = px * cy - py * sy, wy = px * sy + py * cy;
    return [wx * S, (wy * sinE - pz * cosE) * S, wy * cosE + pz * sinE];
  };
  for (let i = 0; i < nv; i++) {
    const p = proj(model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]);
    X[i] = p[0]; Y[i] = p[1]; Z[i] = p[2];
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    const nx = model.nrm[i * 3], ny = model.nrm[i * 3 + 1], nz = model.nrm[i * 3 + 2];
    const wx = nx * cy - ny * sy, wy = nx * sy + ny * cy;
    N[i * 3] = wx; N[i * 3 + 1] = -wy * sinE + nz * cosE; N[i * 3 + 2] = wy * cosE + nz * sinE;
  }
  const a0 = o.anchor ?? [0, 0, 0], ap = proj(a0[0], a0[1], a0[2]);
  const anyGlow = st.look?.kind === "neon" || model.mats.some((m) => (m.glow ?? 0) > 0);
  const glowR = anyGlow ? Math.ceil(st.glow.radius * k * 1.3) : 0;
  const shR = o.shadow ? o.shadow * o.ppu : 0;
  if (o.shadow) {
    x0 = Math.min(x0, ap[0] - shR * ss * 1.15); x1 = Math.max(x1, ap[0] + shR * ss * 1.15);
    y0 = Math.min(y0, ap[1] - shR * ss * sinE * 1.15); y1 = Math.max(y1, ap[1] + shR * ss * sinE * 1.15);
  }
  if (!nv) { x0 = y0 = -1; x1 = y1 = 1; }
  const padOut = Math.ceil(st.outline * k) + glowR + 2;
  // final-pixel box, then the supersampled buffer over it
  const fx0 = Math.floor(x0 / ss) - padOut, fy0 = Math.floor(y0 / ss) - padOut;
  const fw = Math.ceil(x1 / ss) + padOut - fx0, fh = Math.ceil(y1 / ss) + padOut - fy0;
  const w = fw * ss, h = fh * ss, ox = fx0 * ss, oy = fy0 * ss;
  const depth = new Float32Array(w * h).fill(-Infinity);
  const nb = new Float32Array(w * h * 3);
  const mb = new Uint16Array(w * h), ob = new Uint16Array(w * h);

  // ---- rasterise
  const T = model.tri, nt = model.triMat.length;
  for (let t = 0; t < nt; t++) {
    const i0 = T[t * 3], i1 = T[t * 3 + 1], i2 = T[t * 3 + 2];
    const ax = X[i0] - ox, ay = Y[i0] - oy, bx = X[i1] - ox, by = Y[i1] - oy, cx = X[i2] - ox, cyy = Y[i2] - oy;
    const area = (bx - ax) * (cyy - ay) - (cx - ax) * (by - ay);
    if (area > -1e-9 && area < 1e-9) continue;
    const minx = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxx = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const miny = Math.max(0, Math.floor(Math.min(ay, by, cyy))), maxy = Math.min(h - 1, Math.ceil(Math.max(ay, by, cyy)));
    const inv = 1 / area, za = Z[i0], zb = Z[i1], zc = Z[i2], bias = model.triBias[t];
    const mi = model.triMat[t] + 1, oi = model.triObj[t];
    for (let py = miny; py <= maxy; py++) {
      const sy2 = py + 0.5;
      for (let px = minx; px <= maxx; px++) {
        const sx2 = px + 0.5;
        const w0 = ((bx - sx2) * (cyy - sy2) - (cx - sx2) * (by - sy2)) * inv;
        const w1 = ((cx - sx2) * (ay - sy2) - (ax - sx2) * (cyy - sy2)) * inv;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * za + w1 * zb + w2 * zc + bias, ix = py * w + px;
        if (z <= depth[ix]) continue;
        depth[ix] = z; mb[ix] = mi; ob[ix] = oi;
        nb[ix * 3] = w0 * N[i0 * 3] + w1 * N[i1 * 3] + w2 * N[i2 * 3];
        nb[ix * 3 + 1] = w0 * N[i0 * 3 + 1] + w1 * N[i1 * 3 + 1] + w2 * N[i2 * 3 + 1];
        nb[ix * 3 + 2] = w0 * N[i0 * 3 + 2] + w1 * N[i1 * 3 + 2] + w2 * N[i2 * 3 + 2];
      }
    }
  }

  // ---- ink masks (shared by every team): 1 = silhouette ink, 2 = inner line
  const mats = model.mats;
  const inked = new Uint8Array(mats.length + 1);
  for (let i = 0; i < mats.length; i++) inked[i + 1] = mats[i].ink === false ? 0 : 1;
  const ink = new Uint8Array(w * h);
  const look = st.look?.kind ?? "toon";
  /** For silhouette ink pixels: the index of the nearest inked body pixel (the neon look colours its edges by it). */
  const near = look === "neon" ? new Int32Array(w * h).fill(-1) : null;
  const R = st.outline * k * ss;
  if (R > 0.2) {
    const Ri = Math.ceil(R), R2 = R * R, BIG = 1 << 20;
    const dx = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
      let last = -BIG;
      for (let x = 0; x < w; x++) { if (inked[mb[y * w + x]]) last = x; dx[y * w + x] = last - x; }
      last = BIG;
      for (let x = w - 1; x >= 0; x--) { if (inked[mb[y * w + x]]) last = x; const d = last - x; if (d < -dx[y * w + x]) dx[y * w + x] = d; }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ix = y * w + x;
      if (mb[ix]) continue;
      const ya = Math.max(0, y - Ri), yb = Math.min(h - 1, y + Ri);
      let best = R2 + 1;
      for (let yy = ya; yy <= yb; yy++) {
        const d = dx[yy * w + x], ad = d < 0 ? -d : d;
        if (ad > Ri) continue;
        const q = ad * ad + (yy - y) * (yy - y);
        if (q <= R2 && q < best) { best = q; ink[ix] = 1; if (near) near[ix] = yy * w + x + d; else break; }
      }
    }
  }
  const Ri2 = st.inner * k * ss;
  if (Ri2 > 0.2) {
    const r = Math.max(1, Math.round(Ri2)), d = Math.max(1, Math.round(r * 0.7)), gap = 0.035;
    const offs = [[r, 0], [-r, 0], [0, r], [0, -r], [d, d], [-d, d], [d, -d], [-d, -d]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ix = y * w + x, m0 = mb[ix];
      if (!m0 || !inked[m0]) continue;
      const z = depth[ix], o0 = ob[ix];
      for (const [ddx, ddy] of offs) {
        const xx = x + ddx, yy = y + ddy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (ob[j] !== o0 && inked[mb[j]] && depth[j] - z > gap) { ink[ix] = 2; break; }
      }
    }
  }

  // ---- shade, once per team
  const L = norm(o.style.light);
  const Lc: V3 = [L[0], -L[1] * sinE + L[2] * cosE, L[1] * cosE + L[2] * sinE];
  const Hc = norm([Lc[0], Lc[1], Lc[2] + 1]);
  const rimDir = norm([0.55, 0.75, -0.35]);
  const inkRgb = gradeColor(hexRgb(st.ink), undefined), tint = hexRgb(st.shadowTint), rimRgb = hexRgb(st.rim.color);
  const [t0, t1] = st.bands.t, [v0, v1, v2] = st.bands.v;
  const paper = st.look?.kind === "paper" ? hexRgb(st.look.paper ?? "#f1e6cf") : null;
  const out: Uint8ClampedArray[] = [];
  const acc = new Float32Array(fw * fh * 4), glowAcc = anyGlow ? new Float32Array(fw * fh * 4) : null;
  const inv = 1 / (ss * ss);
  const passes = o.teams.map((tm) => ({ tm, mask: false }));
  if (o.mask) passes.push({ tm: MASK_TEAM, mask: true });
  for (const { tm, mask } of passes) {
    // per material: base colour and the three band colours
    const lut: Lut[] = mats.map((m) => {
      const base = mask ? (m.team ? hexRgb(tm[m.team]) : [0, 0, 0] as V3) : gradeColor(hexRgb(m.team ? tm[m.team] : m.color), st.grade);
      const c = new Float32Array(12), sh = mask ? 0 : m.shade ?? 1;
      [v0, v1, v2].forEach((v, b) => {
        const f = 1 - (1 - v) * sh, l = (0.3 * base[0] + 0.59 * base[1] + 0.11 * base[2]) * f;
        const a = clamp(st.shadowAmount * (1 - f) * 2.4 * sh);
        for (let ch = 0; ch < 3; ch++) c[b * 3 + ch] = lerp(base[ch] * f, (tint[ch] / 255) * l * 1.35 + base[ch] * f * 0.25, a);
      });
      for (let ch = 0; ch < 3; ch++) c[9 + ch] = base[ch];
      return { c };
    });
    acc.fill(0); glowAcc?.fill(0);
    for (let y = 0; y < h; y++) {
      const fy = (y / ss) | 0;
      for (let x = 0; x < w; x++) {
        const ix = y * w + x, m0 = mb[ix], fi = (fy * fw + ((x / ss) | 0)) * 4, ik = ink[ix];
        if (ik === 1 || (ik === 2 && m0)) {
          if (mask) { acc[fi + 3] += 1; continue; }
          if (near) {
            // neon: the edge takes its part's colour, brightened, and feeds the halo
            const src = ik === 1 ? mb[near[ix]] : m0, c = src ? lut[src - 1].c : null;
            const r = c ? lerp(c[9], 255, 0.3) : 255, g = c ? lerp(c[10], 255, 0.3) : 255, b = c ? lerp(c[11], 255, 0.3) : 255;
            acc[fi] += r; acc[fi + 1] += g; acc[fi + 2] += b; acc[fi + 3] += 1;
            if (glowAcc) { glowAcc[fi] += r * 0.9; glowAcc[fi + 1] += g * 0.9; glowAcc[fi + 2] += b * 0.9; glowAcc[fi + 3] += 0.9; }
            continue;
          }
          acc[fi] += inkRgb[0]; acc[fi + 1] += inkRgb[1]; acc[fi + 2] += inkRgb[2]; acc[fi + 3] += 1;
          continue;
        }
        if (!m0) continue;
        const m = mats[m0 - 1], c = lut[m0 - 1].c;
        let nx = nb[ix * 3], ny = nb[ix * 3 + 1], nz = nb[ix * 3 + 2];
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const d = nx * Lc[0] + ny * Lc[1] + nz * Lc[2];
        // band value: 0 shadow, 1 mid, 2 lit, with a hair of blend at each step for clean edges
        const e = 0.02;
        const b = smooth(t0 - e, t0 + e, d) + smooth(t1 - e, t1 + e, d);
        const bi = b >= 2 ? 1 : b | 0, bf = b - bi;
        let r = lerp(c[bi * 3], c[bi * 3 + 3], bf), g = lerp(c[bi * 3 + 1], c[bi * 3 + 4], bf), bl = lerp(c[bi * 3 + 2], c[bi * 3 + 5], bf);
        const metal = mask ? 0 : m.metal ?? 0;
        if (metal > 0) {
          const s = nx * Hc[0] + ny * Hc[1] + nz * Hc[2];
          const hl = smooth(0.93, 0.95, s) * metal;
          if (hl > 0) { r = lerp(r, 255, hl * 0.85); g = lerp(g, 252, hl * 0.85); bl = lerp(bl, 235, hl * 0.85); }
          // a dark reflected band low on the form gives brass and steel their weight
          const lo = smooth(-0.15, -0.3, ny) * metal * 0.22;
          r *= 1 - lo; g *= 1 - lo; bl *= 1 - lo;
        }
        if (st.rim.strength > 0 && !mask) {
          const rm = smooth(1 - st.rim.width, 1 - st.rim.width + 0.06, 1 - nz) * clamp((nx * rimDir[0] + ny * rimDir[1] + nz * rimDir[2]) * 2.2) * st.rim.strength;
          if (rm > 0) { r = lerp(r, rimRgb[0], rm); g = lerp(g, rimRgb[1], rm); bl = lerp(bl, rimRgb[2], rm); }
        }
        if (mask) { /* flat coverage */ } else if (look === "real") {
          const lk = st.look as { ambient?: number; spec?: number; edge?: number };
          const amb = lk.ambient ?? 0.36, sh = m.shade ?? 1;
          const hemi = 0.5 + 0.5 * (ny * cosE + nz * sinE);                       // sky above, dark ground below
          const wrap = clamp((d + 0.3) / 1.3);
          let f = amb * (0.45 + 0.55 * hemi) + (1 - amb) * wrap * wrap * 1.08;
          f *= 1 - (lk.edge ?? 0.3) * (1 - smooth(0, 0.55, nz));                  // forms fall off toward their edges
          f = 1 - (1 - Math.min(f, 1.12)) * sh;
          const lum = (0.3 * c[9] + 0.59 * c[10] + 0.11 * c[11]) / 255, ta = clamp(st.shadowAmount * (1 - f) * 1.6);
          r = lerp(c[9] * f, tint[0] * lum * f * 1.5, ta); g = lerp(c[10] * f, tint[1] * lum * f * 1.5, ta); bl = lerp(c[11] * f, tint[2] * lum * f * 1.5, ta);
          const sp = Math.max(0, nx * Hc[0] + ny * Hc[1] + nz * Hc[2]);
          const hl = (Math.pow(sp, 26) * (0.12 + 0.88 * metal) + Math.pow(sp, 6) * 0.1 * metal) * (lk.spec ?? 0.5);
          if (hl > 0) { r += (235 - r) * hl; g += (238 - g) * hl; bl += (240 - bl) * hl; }
        } else if (look === "neon") {
          const f = (st.look as { fill?: number }).fill ?? 0.16, lit = 0.6 + 0.4 * b;
          r = c[9] * f * lit + 8; g = c[10] * f * lit + 9; bl = c[11] * f * lit + 20;
        } else if (look === "grit") {
          // smooth lambert with a hard falloff, a dark silhouette edge instead of ink, shadows leaning to the tint
          const gc = (st.look as { contrast?: number }).contrast ?? 1, sh = m.shade ?? 1;
          const lam = clamp(0.5 + 0.5 * d), edge = smooth(0.02, 0.42, nz);
          let kk = (0.07 + 1.14 * Math.pow(lam, 2.1 * gc)) * (0.42 + 0.58 * edge);
          kk = 1 - (1 - kk) * sh;
          const sa = clamp((1 - kk) * st.shadowAmount * 1.6), lum = (0.3 * c[9] + 0.59 * c[10] + 0.11 * c[11]) * kk;
          r = lerp(c[9] * kk, (tint[0] / 255) * lum * 1.3, sa); g = lerp(c[10] * kk, (tint[1] / 255) * lum * 1.3, sa); bl = lerp(c[11] * kk, (tint[2] / 255) * lum * 1.3, sa);
          const sp = Math.pow(clamp(nx * Hc[0] + ny * Hc[1] + nz * Hc[2]), 22) * (0.12 + 0.75 * metal) * sh;
          r += (255 - r) * sp; g += (250 - g) * sp; bl += (232 - bl) * sp;
        } else if (look === "paper") {
          const pc = paper!, mixk = b >= 1.5 ? 0.3 : 0.48;
          r = lerp(pc[0], c[9], mixk); g = lerp(pc[1], c[10], mixk); bl = lerp(pc[2], c[11], mixk);
          if (b < 0.5 && ((x + y) / ss) % 4 < 1.25) { r = inkRgb[0]; g = inkRgb[1]; bl = inkRgb[2]; }
        }
        const em = m.emit ?? 0;
        if (em > 0) { r = lerp(r, c[9], em); g = lerp(g, c[10], em); bl = lerp(bl, c[11], em); }
        const al = m.alpha ?? 1;
        acc[fi] += r * al; acc[fi + 1] += g * al; acc[fi + 2] += bl * al; acc[fi + 3] += al;
        if (glowAcc && (m.glow ?? 0) > 0) {
          const gk = m.glow!;
          glowAcc[fi] += c[9] * gk; glowAcc[fi + 1] += c[10] * gk; glowAcc[fi + 2] += c[11] * gk; glowAcc[fi + 3] += gk;
        }
      }
    }
    const img = new Uint8ClampedArray(fw * fh * 4);
    // contact shadow first (under everything)
    if (o.shadow) {
      const sx = ap[0] / ss - fx0, syy = ap[1] / ss - fy0, rx = shR, ry = shR * sinE;
      for (let y = Math.max(0, Math.floor(syy - ry * 1.15)); y < Math.min(fh, syy + ry * 1.15 + 1); y++)
        for (let x = Math.max(0, Math.floor(sx - rx * 1.15)); x < Math.min(fw, sx + rx * 1.15 + 1); x++) {
          const q = Math.hypot((x + 0.5 - sx) / rx, (y + 0.5 - syy) / ry);
          const a = (1 - smooth(0.55, 1.12, q)) * 0.42;
          if (a > 0) { const i = (y * fw + x) * 4; if (!mask) { img[i] = 20; img[i + 1] = 14; img[i + 2] = 24; } img[i + 3] = a * 255; }
        }
    }
    let halo: Float32Array | null = null;
    if (glowAcc) {
      for (let i = 0; i < glowAcc.length; i++) glowAcc[i] *= inv;
      halo = blur(glowAcc, fw, fh, Math.max(1, Math.round(st.glow.radius * k * 0.5)));
    }
    for (let i = 0; i < fw * fh; i++) {
      const a = acc[i * 4 + 3] * inv;
      let r = 0, g = 0, b = 0;
      if (a > 0) { r = acc[i * 4] * inv / a; g = acc[i * 4 + 1] * inv / a; b = acc[i * 4 + 2] * inv / a; }
      // composite the sprite over what is already there (the contact shadow)
      const ua = img[i * 4 + 3] / 255;
      let oa = a + ua * (1 - a);
      let or = oa > 0 ? (r * a + img[i * 4] * ua * (1 - a)) / oa : 0, og = oa > 0 ? (g * a + img[i * 4 + 1] * ua * (1 - a)) / oa : 0, obb = oa > 0 ? (b * a + img[i * 4 + 2] * ua * (1 - a)) / oa : 0;
      if (halo) {
        // the halo sits behind the sprite as a soft light and lifts the sprite's own pixels a little
        const ha = clamp(halo[i * 4 + 3] * st.glow.gain * 1.7), hk = halo[i * 4 + 3] > 1e-4 ? 1 / halo[i * 4 + 3] : 0;
        const hr = clamp(halo[i * 4] * hk, 0, 255), hg = clamp(halo[i * 4 + 1] * hk, 0, 255), hb = clamp(halo[i * 4 + 2] * hk, 0, 255);
        if (ha > 0.05) {
          const na = oa + ha * (1 - oa);
          or = (or * oa + hr * ha * (1 - oa)) / na; og = (og * oa + hg * ha * (1 - oa)) / na; obb = (obb * oa + hb * ha * (1 - oa)) / na;
          const lift = ha * 0.35 * oa;
          or += (255 - or) * lift * (hr / 255); og += (255 - og) * lift * (hg / 255); obb += (255 - obb) * lift * (hb / 255);
          oa = na;
        }
      }
      img[i * 4] = or; img[i * 4 + 1] = og; img[i * 4 + 2] = obb; img[i * 4 + 3] = oa * 255;
    }
    out.push(img);
  }
  return { w: fw, h: fh, ax: ap[0] / ss - fx0, ay: ap[1] / ss - fy0, data: out };
}

/** Two box blurs each way (close to a Gaussian) over a float RGBA buffer. */
function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const n = 2 * r + 1;
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(src.length), c = new Float32Array(src.length);
    for (let y = 0; y < h; y++) for (let ch = 0; ch < 4; ch++) {
      let s = 0;
      for (let x = -r; x <= r; x++) s += a[(y * w + clamp(x, 0, w - 1)) * 4 + ch];
      for (let x = 0; x < w; x++) {
        b[(y * w + x) * 4 + ch] = s / n;
        s += a[(y * w + Math.min(w - 1, x + r + 1)) * 4 + ch] - a[(y * w + Math.max(0, x - r)) * 4 + ch];
      }
    }
    for (let x = 0; x < w; x++) for (let ch = 0; ch < 4; ch++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += b[(clamp(y, 0, h - 1) * w + x) * 4 + ch];
      for (let y = 0; y < h; y++) {
        c[(y * w + x) * 4 + ch] = s / n;
        s += b[(Math.min(h - 1, y + r + 1) * w + x) * 4 + ch] - b[(Math.max(0, y - r) * w + x) * 4 + ch];
      }
    }
    a = c;
  }
  return a;
}

/** The tight box of pixels with any alpha: [x, y, w, h], or null for an empty sprite. */
export function bounds(data: Uint8ClampedArray, w: number, h: number): [number, number, number, number] | null {
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 2) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

/** Crop a sprite to the pixels any team's image uses, keeping the anchor right. */
export function trim(s: Sprite, pad = 1): Sprite {
  let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
  for (const d of s.data) {
    const b = bounds(d, s.w, s.h);
    if (!b) continue;
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[0] + b[2] - 1); y1 = Math.max(y1, b[1] + b[3] - 1);
  }
  if (x1 < 0) return { w: 1, h: 1, ax: 0, ay: 0, data: s.data.map(() => new Uint8ClampedArray(4)) };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(s.w - 1, x1 + pad); y1 = Math.min(s.h - 1, y1 + pad);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const data = s.data.map((d) => {
    const o = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) o.set(d.subarray(((y + y0) * s.w + x0) * 4, ((y + y0) * s.w + x0 + w) * 4), y * w * 4);
    return o;
  });
  return { w, h, ax: s.ax - x0, ay: s.ay - y0, data };
}
