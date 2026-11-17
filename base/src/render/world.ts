// The world the battlefield sits on: a small globe. The board is the top of it; the ground runs out past the
// board's edges to a rim, falls away with the curve (camera.ts BEND), and the whole thing can be turned.
//
// The ground is a top-down texture drawn through the camera as a mesh of small triangles, so it holds up from any
// angle. For a game with painted arenas (public/arenas, rendered through the fixed 3/4 camera) the texture is that
// painting taken back off the camera: each ground row of the backdrop is one row of the texture. Scenery around the
// board is built from the game's kit (props.ts) so it has a back as well as a front.
import { H, W } from "@engine/core/defs";
import type { Arena } from "./arena";
import type { Camera } from "./camera";
import { Mesh, drawFaces, mix, type Face, type KitLook } from "./kit3d";
import { lamp, sceneryHouse, sceneryRock, seeded, tree } from "./props";
import { TERRAIN } from "../game/terrain";

/** Radius of the world's top, in world units from the board centre. */
export const RAD = 11.5;
/** The sharp inner texture: the board and a margin round it. */
const IN = { x0: -1.5, y0: -1.5, w: W + 3, h: H + 3, ppu: 88 };
/** The soft outer texture: the whole top of the globe. */
const OUT = { x0: W / 2 - RAD - 0.5, y0: H / 2 - RAD - 0.5, w: RAD * 2 + 1, h: RAD * 2 + 1, ppu: 20 };

type G = CanvasRenderingContext2D;
interface Tex { c: HTMLCanvasElement; x0: number; y0: number; w: number; h: number; ppu: number; }
interface Item { x: number; y: number; faces: Face[]; }

function canvas(w: number, h: number) { const c = document.createElement("canvas"); c.width = Math.round(w); c.height = Math.round(h); return c; }

/** Take a backdrop painted through the fixed camera back to a top-down texture of the world rectangle `t`. */
function unwarp(a: Arena, t: Omit<Tex, "c">): HTMLCanvasElement {
  const c = canvas(t.w * t.ppu, t.h * t.ppu), g = c.getContext("2d")!;
  g.fillStyle = a.info.edge; g.fillRect(0, 0, c.width, c.height);
  const m = a.m, P = m.size[0] / (m.view.u1 - m.view.u0), sin = Math.sin(m.camera.tilt), cos = Math.cos(m.camera.tilt), D = m.camera.dist;
  const img = a.ground, iw = m.size[0], ih = m.size[1], kx = (img as HTMLImageElement).naturalWidth ? (img as HTMLImageElement).naturalWidth / iw : 1, ky = (img as HTMLImageElement).naturalHeight ? (img as HTMLImageElement).naturalHeight / ih : 1;
  g.imageSmoothingEnabled = true;
  const rowV = (y: number) => { const Y = y - H / 2; return ((Y * cos) / (D - Y * sin) - m.view.v0) * P; };
  for (let j = 0; j < c.height; j++) {
    const y = t.y0 + (j + 0.5) / t.ppu, Y = y - H / 2, cz = D - Y * sin;
    const sy0 = rowV(t.y0 + j / t.ppu), sy1 = rowV(t.y0 + (j + 1) / t.ppu);
    let sx0 = ((t.x0 - W / 2) / cz - m.view.u0) * P, sx1 = ((t.x0 + t.w - W / 2) / cz - m.view.u0) * P;
    let dx0 = 0, dx1 = c.width;
    const per = (dx1 - dx0) / (sx1 - sx0);
    if (sy1 <= 0 || sy0 >= ih) continue;
    if (sx0 < 0) { dx0 -= sx0 * per; sx0 = 0; }
    if (sx1 > iw) { dx1 -= (sx1 - iw) * per; sx1 = iw; }
    if (sx1 - sx0 < 1) continue;
    const a0 = Math.max(0, sy0), a1 = Math.min(ih, Math.max(sy1, a0 + 0.75));
    g.drawImage(img, sx0 * kx, a0 * ky, (sx1 - sx0) * kx, (a1 - a0) * ky, dx0, j, dx1 - dx0, 1.02);
  }
  return c;
}

/** Draw a top-down texture of a world rectangle through the camera, as a mesh (cells of `step` world units). */
function warp(g: G, cam: Camera, t: Tex, step: number, view: { w: number; h: number }, maxR = Infinity) {
  const nx = Math.ceil(t.w / step), ny = Math.ceil(t.h / step), dx = t.w / nx, dy = t.h / ny;
  const px = new Float64Array((nx + 1) * (ny + 1)), py = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const p = cam.project(t.x0 + i * dx, t.y0 + j * dy); px[j * (nx + 1) + i] = p.x; py[j * (nx + 1) + i] = p.y; }
  const tw = t.c.width / t.w, th = t.c.height / t.h;
  const tri = (u0: number, v0: number, x0: number, y0: number, u1: number, v1: number, x1: number, y1: number, u2: number, v2: number, x2: number, y2: number) => {
    const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
    if (Math.abs(det) < 1e-9) return;
    const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det, b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det;
    const c = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / det, d = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / det;
    const e = x0 - a * u0 - c * v0, f = y0 - b * u0 - d * v0;
    // grow the triangle a little so neighbours overlap (no hairlines)
    const mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3, gr = (x: number, m: number) => x + Math.sign(x - m) * 0.7;
    g.save();
    g.beginPath(); g.moveTo(gr(x0, mx), gr(y0, my)); g.lineTo(gr(x1, mx), gr(y1, my)); g.lineTo(gr(x2, mx), gr(y2, my)); g.closePath(); g.clip();
    g.transform(a, b, c, d, e, f);
    const sx = Math.max(0, Math.floor(Math.min(u0, u1, u2)) - 2), sy = Math.max(0, Math.floor(Math.min(v0, v1, v2)) - 2);
    const sw = Math.min(t.c.width, Math.ceil(Math.max(u0, u1, u2)) + 2) - sx, sh = Math.min(t.c.height, Math.ceil(Math.max(v0, v1, v2)) + 2) - sy;
    if (sw > 0 && sh > 0) g.drawImage(t.c, sx, sy, sw, sh, sx, sy, sw, sh);
    g.restore();
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = t.x0 + (i + 0.5) * dx - W / 2, cy = t.y0 + (j + 0.5) * dy - H / 2;
    if (cx * cx + cy * cy > (maxR + step) * (maxR + step)) continue;
    const k = j * (nx + 1) + i, a = k, b = k + 1, c = k + nx + 1, d = k + nx + 2;
    const lo = Math.min(px[a], px[b], px[c], px[d]), hi = Math.max(px[a], px[b], px[c], px[d]), to = Math.min(py[a], py[b], py[c], py[d]), bo = Math.max(py[a], py[b], py[c], py[d]);
    if (hi < 0 || lo > view.w || bo < 0 || to > view.h) continue;
    const u0 = i * dx * tw, u1 = (i + 1) * dx * tw, v0 = j * dy * th, v1 = (j + 1) * dy * th;
    tri(u0, v0, px[a], py[a], u1, v0, px[b], py[b], u0, v1, px[c], py[c]);
    tri(u1, v0, px[b], py[b], u1, v1, px[d], py[d], u0, v1, px[c], py[c]);
  }
}

export class World {
  private inner?: Tex;
  private outer?: Tex;
  private items: Item[] = [];
  private seed = 1;
  look!: KitLook;

  /** Build the ground textures: from the arena painting if there is one, else from the board's own drawn ground. */
  setGround(arena: Arena | null, board: () => HTMLCanvasElement, look: KitLook, seed = 1) {
    this.look = look;
    if (arena) {
      this.inner = { ...IN, c: unwarp(arena, IN) };
      const raw = unwarp(arena, OUT);
      // the far ground is soft: painted scenery that stood around the old fixed view melts into ground colour
      const small = canvas(raw.width / 6, raw.height / 6), sg = small.getContext("2d")!;
      sg.imageSmoothingEnabled = true; sg.drawImage(raw, 0, 0, small.width, small.height);
      const o = canvas(raw.width, raw.height), og = o.getContext("2d")!;
      og.imageSmoothingEnabled = true; og.imageSmoothingQuality = "high";
      og.drawImage(small, 0, 0, o.width, o.height);
      this.outer = { ...OUT, c: o };
      this.feather(this.inner, 1.1);
    } else {
      const b = board(), c = canvas(IN.w * IN.ppu, IN.h * IN.ppu), g = c.getContext("2d")!;
      g.fillStyle = TERRAIN.soil[0]; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(b, -IN.x0 * IN.ppu, -IN.y0 * IN.ppu, W * IN.ppu, H * IN.ppu);
      this.inner = { ...IN, c };
      const o = canvas(OUT.w * OUT.ppu, OUT.h * OUT.ppu), og = o.getContext("2d")!;
      og.fillStyle = TERRAIN.soil[0]; og.fillRect(0, 0, o.width, o.height);
      this.outer = { ...OUT, c: o };
    }
    // the rim darkens a little, like the limb of a planet
    const og = this.outer.c.getContext("2d")!, r = RAD * OUT.ppu, cx = this.outer.c.width / 2, cy = this.outer.c.height / 2;
    const rg = og.createRadialGradient(cx, cy, r * 0.62, cx, cy, r);
    rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(1, "rgba(0,0,10,0.3)");
    og.fillStyle = rg; og.fillRect(0, 0, this.outer.c.width, this.outer.c.height);
    if (seed !== this.seed || !this.items.length) { this.seed = seed; this.scatter(seed); }
  }

  /** Fade the inner texture's edges out over `m` world units so it melts into the outer one. */
  private feather(t: Tex, m: number) {
    const g = t.c.getContext("2d")!, w = t.c.width, h = t.c.height, k = m * t.ppu;
    g.save(); g.globalCompositeOperation = "destination-out";
    const band = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    };
    band(0, 0, k, 0, 0, 0, k, h); band(w, 0, w - k, 0, w - k, 0, k, h); band(0, 0, 0, k, 0, 0, w, k); band(0, h, 0, h - k, 0, h - k, w, k);
    g.restore();
  }

  /** Stand the game's scenery round the board: low things near it, tall things further out (so nothing in front of
   *  the board hides the fight), nothing where the keeps stand. */
  private scatter(seed: number) {
    const rnd = seeded(seed * 7919 + 13), S = TERRAIN, sc = S.scenery, area = (Math.PI * RAD * RAD - (W + 2) * (H + 2)) / 100;
    this.items = [];
    const spot = (minGap: number): [number, number, number] | null => {
      for (let k = 0; k < 30; k++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (RAD - 1.3), x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
        const gx = Math.max(-x, x - W, 0), gy = Math.max(-y, y - H, 0), gap = Math.hypot(gx, gy);
        if (gap < minGap) continue;
        if (x > 1 && x < W - 1 && gy < 3.4) continue; // the keeps and the ground before them
        if (this.items.some((i) => Math.hypot(i.x - x, i.y - y) < 0.8)) continue;
        return [x, y, gap];
      }
      return null;
    };
    const put = (n: number, minGap: number, build: (m: Mesh, x: number, y: number, gap: number) => void) => {
      for (let i = 0; i < Math.round(n * area); i++) { const p = spot(minGap); if (!p) continue; const m = new Mesh(); build(m, p[0], p[1], p[2]); this.items.push({ x: p[0], y: p[1], faces: m.faces }); }
    };
    put(sc.houses, 2.6, (m, x, y) => sceneryHouse(m, x, y, 1.1 + rnd() * 0.6, 0.9 + rnd() * 0.4, S, rnd));
    put(sc.trees, 0.7, (m, x, y, gap) => tree(m, x, y, Math.min(0.75 + rnd() * 0.5, 0.35 + gap * 0.42), S, rnd));
    put(sc.rocks, 0.6, (m, x, y, gap) => sceneryRock(m, x, y, Math.min(0.5 + rnd() * 0.6, 0.3 + gap * 0.4), S, rnd));
    put(sc.lamps, 0.5, (m, x, y) => lamp(m, x, y, S));
  }

  /** Sky, the globe's underside, the ground, its rim. `overlay`: a board-sized texture laid over the ground. */
  paint(g: G, cam: Camera, cssW: number, cssH: number, overlay?: HTMLCanvasElement) {
    const S = TERRAIN, view = { w: cssW, h: cssH };
    const sky = g.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, S.sky[0]); sky.addColorStop(1, S.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, cssW, cssH);
    // a glow behind the globe, then its underside as stacked rings, darkening downward
    const rimZ = 0, top = this.loop(cam, RAD, rimZ);
    const c = cam.project(W / 2, H / 2, -RAD * 0.6);
    const halo = g.createRadialGradient(c.x, c.y, cam.k / cam.dist * RAD * 0.7, c.x, c.y, cam.k / cam.dist * RAD * 1.45);
    halo.addColorStop(0, S.halo); halo.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = halo; g.fillRect(0, 0, cssW, cssH);
    const N = 7;
    for (let i = N; i >= 1; i--) {
      const f = i / N, a = f * 1.25, pts = this.loop(cam, RAD * Math.cos(a), -RAD * 0.75 * Math.sin(a));
      g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      g.fillStyle = mix(S.soil[0], S.soil[1], Math.min(1, f * 1.15)); g.fill();
    }
    // the ground: clipped to the top of the globe
    g.save();
    g.beginPath(); top.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    g.fillStyle = S.soil[0]; g.fill();
    g.clip();
    g.imageSmoothingEnabled = true;
    if (this.outer) warp(g, cam, this.outer, 2.4, view, RAD);
    if (this.inner) warp(g, cam, this.inner, 1.5, view);
    if (overlay) warp(g, cam, { c: overlay, x0: 0, y0: 0, w: W, h: H, ppu: overlay.width / W }, 2.4, view);
    g.restore();
    g.beginPath(); top.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    g.strokeStyle = S.halo; g.lineWidth = 2; g.stroke();
  }
  /** A circle about the globe's axis at radius r, dropped z below the rim, on screen. */
  private loop(cam: Camera, r: number, z: number): [number, number][] {
    const out: [number, number][] = [], zr = -cam.bend * RAD * RAD + cam.bend * r * r; // the camera bends by r; hold the rim's height
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2, p = cam.project(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, zr + z); out.push([p.x, p.y]); }
    return out;
  }

  /** The scenery behind the board (far = true) or in front of it, drawn far to near. */
  drawScenery(g: G, cam: Camera, far: boolean) {
    const mid = cam.sortKey(W / 2, H / 2);
    const list = this.items.map((i) => ({ i, k: cam.sortKey(i.x, i.y) })).filter((e) => (e.k < mid) === far).sort((a, b) => a.k - b.k);
    // cast shadows first
    const l = this.look.light, sx = -l[0] / Math.max(0.3, l[2]) * 0.5, sy = -l[1] / Math.max(0.3, l[2]) * 0.5;
    g.fillStyle = TERRAIN.shadow;
    for (const { i } of list) { g.beginPath(); cam.groundPath(g, i.x + sx, i.y + sy, 0.42); g.fill(); }
    for (const { i } of list) drawFaces(g, cam, i.faces, this.look, { noInk: this.look.inkW <= 0 });
  }
}
