// Bastion renderer: a big meadow battlefield in one ground texture: the map's Blender render (public/td, from
// art/td/render_td.py through this camera's ground layout) or, without one, a procedural bake (grass, road, pads, trees),
// then units from the Blender atlases (sprites.ts / units.ts), the keeps (keeps.ts), projectiles and a capped
// particle layer, all through TdCamera. Off-screen bodies are culled; the sim is interpolated between ticks.
import type { BodyKind, Side } from "@engine/core/defs";
import { UNITS, bodyDef } from "@engine/core/defs";
import { ROAD_HALF, type TdMap } from "@engine/core/td/maps";
import { DT, type TdEvent, type TdRun } from "@engine/core/td/sim";
import { KEEP_SCALE, keepImage, keepManifest, keepState } from "./keeps";
import { frame, preload } from "./sprites";
import { TD_SQUASH, TD_TEX_M, TD_TEX_PPU, TdCamera } from "./tdCamera";
import { animFor, drawFrame, drawRank, drawUnit, spriteVis } from "./units";
import { loadVfx, vfxFrame, vfxSheet } from "./vfx";

const TEX_PPU = TD_TEX_PPU;
const TEX_M = TD_TEX_M;

/** public/td/manifest.json, written by art/td/render_td.py: each map's backdrop as horizontal webp slices. */
export interface TdBackdropManifest {
  version: number; squash: number; margin: number; ppu: number;
  maps: Record<string, { w: number; h: number; px: [number, number]; slices: { file: string; y: number; h: number }[];
    pads: [number, number][]; roads: [number, number][][];
    check: { camera_px: number; pads: [number, number]; road: [number, number]; verge: [number, number] } }>;
}
const tdBase = () => (import.meta as any).env?.BASE_URL ?? "./";
let tdManifest: Promise<TdBackdropManifest | null> | null = null;
/** The rendered backdrop for a map, slices loaded and decoded; null when there is none (the procedural bake stays). */
export function loadBackdrop(mapId: string): Promise<{ px: [number, number]; slices: { img: HTMLImageElement; y: number }[] } | null> {
  tdManifest ??= fetch(`${tdBase()}td/manifest.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return tdManifest.then(async (m) => {
    const info = m && m.ppu === TEX_PPU && m.margin === TEX_M && m.squash === TD_SQUASH ? m.maps[mapId] : null;
    if (!info) return null;
    const slices = await Promise.all(info.slices.map((s) => new Promise<{ img: HTMLImageElement; y: number }>((ok, no) => {
      const img = new Image();
      img.onload = () => ok({ img, y: s.y });
      img.onerror = no;
      img.src = `${tdBase()}td/${s.file}`;
    })));
    return { px: info.px, slices };
  }).catch(() => null);
}
const MAX_PARTICLES = 140;
const MAX_FLOATS = 24;

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: string; size: number; }
interface Float { x: number; y: number; text: string; life: number; color: string; }
interface Ring { x: number; y: number; r: number; life: number; max: number; color: string; }
interface Zap { pts: [number, number][]; life: number; }
interface Sfx { sheet: string; x: number; y: number; z: number; size: number; t: number; max: number; tint?: string; }
const MAX_SFX = 48;
interface Corpse { x: number; y: number; kind: BodyKind; side: Side; face: number; rank: number; t: number; air: boolean; }

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const dir8 = (face: number) => {
  const a = Math.atan2(Math.sin(face) * TD_SQUASH, Math.cos(face));
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
};

/** A soft contact shadow, drawn once and blitted per body (filling an ellipse path per body cost more). */
let shadowCanvas: HTMLCanvasElement | null = null;
function shadowSprite(): HTMLCanvasElement {
  if (shadowCanvas) return shadowCanvas;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, "rgba(0,0,0,0.34)"); grad.addColorStop(0.75, "rgba(0,0,0,0.26)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return (shadowCanvas = c);
}

export class TdView {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly cam: TdCamera;
  run: TdRun;
  dpr = 1;
  selectedPad = -1;
  /** Shown range ring (world units) at the selected pad. */
  ringR = 0;
  /** Frames drawn and bodies drawn last frame (for the perf probe). */
  stats = { units: 0, culled: 0, particles: 0 };
  private ground: HTMLCanvasElement | null = null;
  private groundCanvas: HTMLCanvasElement;
  private gctx: CanvasRenderingContext2D;
  private groundKey = "";
  /** Decoded backdrop slices waiting to be copied into the ground texture (dropped once baked). */
  private backdrop: { px: [number, number]; slices: { img: HTMLImageElement; y: number }[] } | null = null;
  /** While the render loads, the ground is plain grass (no procedural bake to pop out a moment later). */
  private backdropPending = true;
  /** ?tddebug: draw the sim's road and pads over the ground, to check them against the render. */
  private debug = typeof location !== "undefined" && /[?&]tddebug\b/.test(location.search);
  private parts: Particle[] = [];
  private floats: Float[] = [];
  private rings: Ring[] = [];
  private zaps: Zap[] = [];
  private corpses: Corpse[] = [];
  private sfx: Sfx[] = [];
  private prev = new Map<number, [number, number]>();
  private shake = 0;
  private keepFlash = 0;
  private t = 0;
  /** Minimap rect on screen (css px), for taps. */
  mini = { x: 0, y: 0, w: 0, h: 0 };

  constructor(canvas: HTMLCanvasElement, run: TdRun) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    // The ground lives on its own canvas underneath, redrawn only when the camera moves.
    this.groundCanvas = document.createElement("canvas");
    this.groundCanvas.className = "td-ground";
    canvas.parentElement?.insertBefore(this.groundCanvas, canvas);
    this.gctx = this.groundCanvas.getContext("2d", { alpha: false })!;
    this.run = run;
    this.cam = new TdCamera(run.map.w, run.map.h);
    // Pin each wave's kinds at that wave's rank (not every tier of every kind: that outgrows the sheet budget).
    const byRank = new Map<number, Set<string>>();
    for (const w of run.waves) for (const g of w.groups) { if (!byRank.has(w.rank)) byRank.set(w.rank, new Set()); byRank.get(w.rank)!.add(g.kind); }
    preload(["mite", "thrall", "golemling"], 1, [1]);
    for (const [rank, kinds] of byRank) preload([...kinds], 1, [rank]);
    void loadVfx();
    void loadBackdrop(run.map.id).then((b) => {
      this.backdropPending = false;
      if (!b || this.run.map.id !== run.map.id) return;
      this.backdrop = b;
      this.ground = null; // rebake from the render
      this.tiles.clear(); this.tileScale = 0; this.groundKey = "";
    });
  }

  /** A one-shot sprite effect from the shared VFX atlas (capped). */
  private play(sheet: string, x: number, y: number, z: number, size: number, max: number, tint?: string) {
    if (this.sfx.length >= MAX_SFX) return;
    this.sfx.push({ sheet, x, y, z, size, t: 0, max, tint });
  }

  resize(w: number, h: number, dpr: number) {
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    for (const c of [this.groundCanvas]) { c.width = this.canvas.width; c.height = this.canvas.height; c.style.width = `${w}px`; c.style.height = `${h}px`; }
    this.groundKey = "";
    this.cam.resize(w, h);
  }

  /** Remember positions before a sim tick so frames between ticks can interpolate. */
  beforeStep() {
    this.prev.clear();
    for (const e of this.run.enemies) this.prev.set(e.id, [e.x, e.y]);
    for (const d of this.run.defenders) this.prev.set(d.id, [d.x, d.y]);
  }

  /** Turn sim events into effects. */
  absorb(events: TdEvent[]) {
    for (const e of events) {
      switch (e.t) {
        case "hit": this.burst(e.x, e.y, e.air ? 0.6 : 0.3, e.enemy ? "#fff3c4" : "#ffb0a0", 2, 0.8); if (this.sfx.length < MAX_SFX / 2) this.play("impact", e.x, e.y, e.air ? 0.7 : 0.35, 0.7, 0.22); break;
        case "boom": this.rings.push({ x: e.x, y: e.y, r: e.r, life: 0, max: 0.4, color: "#ffcf6a" }); this.burst(e.x, e.y, 0.2, "#c8a070", 6, 2); this.play("fireball", e.x, e.y, 0, e.r * 2, 0.45); this.play("dust", e.x, e.y, 0, e.r * 2.2, 0.6); break;
        case "zap": this.zaps.push({ pts: e.pts, life: 0.22 }); for (const [x, y] of e.pts.slice(1)) this.play("shock", x, y, 0.4, 0.9, 0.3); break;
        case "heal": this.burst(e.x, e.y, 0.5, "#8ff0a0", 3, 0.6); this.play("heal", e.x, e.y, 0.2, 1, 0.5); break;
        case "die": this.corpses.push({ x: e.x, y: e.y, kind: e.kind, side: e.enemy ? 1 : 0, face: e.face, rank: e.rank, t: 0, air: e.air }); if (this.corpses.length > 30) this.corpses.shift(); break;
        case "gold": if (this.floats.length < MAX_FLOATS) this.floats.push({ x: e.x, y: e.y, text: `+${e.n}`, life: 0, color: "#ffd23f" }); break;
        case "leak": this.shake = 0.35; this.keepFlash = 0.5; break;
        default: break;
      }
    }
  }

  private burst(x: number, y: number, z: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n && this.parts.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      this.parts.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 1 + Math.random() * 1.5, life: 0, max: 0.35 + Math.random() * 0.25, color, size: 0.06 + Math.random() * 0.05 });
    }
  }

  // ------------------------------------------------------------ ground
  private bake(map: TdMap): HTMLCanvasElement {
    const P = TEX_PPU, Q = TEX_PPU * TD_SQUASH;
    if (this.backdrop) {
      // The Blender render: same layout as this bake (TEX_M margin, TEX_PPU across, squashed down), in slices.
      const c = document.createElement("canvas");
      [c.width, c.height] = this.backdrop.px;
      const g = c.getContext("2d", { alpha: false })!;
      g.fillStyle = "#2f8a3a"; g.fillRect(0, 0, c.width, c.height);
      for (const sl of this.backdrop.slices) g.drawImage(sl.img, 0, sl.y);
      this.backdrop = null; // let the decoded slices go
      return c;
    }
    const W = Math.round((map.w + TEX_M * 2) * P), H = Math.round((map.h + TEX_M * 2) * Q);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    const X = (x: number) => (x + TEX_M) * P, Y = (y: number) => (y + TEX_M) * Q;
    const rnd = seeded(map.w * 1000 + map.h);
    const fen = map.act === 3;
    // Grass: a base and soft camo blotches in the meadow greens.
    g.fillStyle = fen ? "#6db352" : "#79c257";
    g.fillRect(0, 0, W, H);
    const blot = fen ? ["#5fa548", "#82c561", "#679f45"] : ["#8fd064", "#6ab24a", "#9ad86e", "#73ba50"];
    for (let i = 0; i < (map.w * map.h) * 1.6; i++) {
      const x = rnd() * W, y = rnd() * H, r = (0.25 + rnd() * 0.7) * P;
      g.fillStyle = blot[i % blot.length];
      g.globalAlpha = 0.55;
      g.beginPath(); g.ellipse(x, y, r, r * TD_SQUASH * (0.7 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // Tiny flowers.
    for (let i = 0; i < map.w * map.h * 0.5; i++) {
      g.fillStyle = ["#fff6d8", "#f7d34a", "#e8a0d8", "#b8c8ff"][i % 4];
      g.beginPath(); g.arc(rnd() * W, rnd() * H, 1.6 + rnd() * 1.4, 0, Math.PI * 2); g.fill();
    }
    // Roads: a dark rim, the sand, then lighter patches inside.
    const stroke = (w: number, color: string) => {
      g.lineJoin = "round"; g.lineCap = "round"; g.strokeStyle = color; g.lineWidth = w;
      for (const p of map.paths) { g.beginPath(); p.pts.forEach((q, i) => (i ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y)))); g.stroke(); }
    };
    stroke(ROAD_HALF * 2 * P + 8, "rgba(60,90,30,0.35)");
    stroke(ROAD_HALF * 2 * P + 3, "#b98d55");
    stroke(ROAD_HALF * 2 * P - 2, "#e7c78b");
    for (const p of map.paths) for (let i = 0; i < p.pts.length; i += 3) {
      const q = p.pts[i];
      g.fillStyle = rnd() < 0.5 ? "#f1d8a2" : "#d8b479";
      g.globalAlpha = 0.7;
      g.beginPath(); g.ellipse(X(q.x + (rnd() - 0.5) * 0.7), Y(q.y + (rnd() - 0.5) * 0.7), (0.12 + rnd() * 0.22) * P, (0.08 + rnd() * 0.14) * P, rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // Plazas at the gates and the keep.
    for (const q of [...map.gates, map.keep]) {
      g.fillStyle = "#b98d55"; g.beginPath(); g.ellipse(X(q.x), Y(q.y), 1.75 * P, 1.75 * Q, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ead2a0"; g.beginPath(); g.ellipse(X(q.x), Y(q.y), 1.65 * P, 1.65 * Q, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(150,110,60,0.35)"; g.lineWidth = 2;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(X(q.x), Y(q.y), 0.42 * k * P, 0.42 * k * Q, 0, 0, Math.PI * 2); g.stroke(); }
    }
    // Build pads: low stone plinths.
    for (const pad of map.pads) {
      const x = X(pad.x), y = Y(pad.y), r = 0.62 * P;
      g.fillStyle = "rgba(30,50,20,0.3)"; g.beginPath(); g.ellipse(x + 3, y + 5, r * 1.05, r * TD_SQUASH * 1.05, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#8c8576"; g.beginPath(); g.ellipse(x, y + 4, r, r * TD_SQUASH, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#d9d1bf"; g.beginPath(); g.ellipse(x, y, r, r * TD_SQUASH, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#a99f8a"; g.lineWidth = 2;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45 * TD_SQUASH); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * TD_SQUASH); g.stroke(); }
      g.beginPath(); g.ellipse(x, y, r * 0.45, r * 0.45 * TD_SQUASH, 0, 0, Math.PI * 2); g.stroke();
    }
    // Trees wherever there is room: never on the road, a pad or a plaza.
    const busy = (x: number, y: number, r: number) => {
      for (const p of map.paths) for (let i = 0; i < p.pts.length; i += 2) if (Math.hypot(p.pts[i].x - x, p.pts[i].y - y) < ROAD_HALF + r + 0.35) return true;
      for (const pad of map.pads) if (Math.hypot(pad.x - x, pad.y - y) < 0.9 + r) return true;
      for (const q of [...map.gates, map.keep]) if (Math.hypot(q.x - x, q.y - y) < 2.4 + r) return true;
      return false;
    };
    const trees: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 2600 && trees.length < 420; i++) {
      const x = -TEX_M + rnd() * (map.w + TEX_M * 2), y = -TEX_M + rnd() * (map.h + TEX_M * 2), r = 0.45 + rnd() * 0.4;
      if (busy(x, y, r) || trees.some((t) => Math.hypot(t.x - x, t.y - y) < (t.r + r) * 0.8)) continue;
      trees.push({ x, y, r });
    }
    trees.sort((a, b) => a.y - b.y);
    const canopy = fen ? ["#2f7a3c", "#3f9248", "#5cb35a"] : ["#2f8a3a", "#45a446", "#6cc85a"];
    for (const t of trees) {
      const x = X(t.x), y = Y(t.y), r = t.r * P;
      g.fillStyle = "rgba(20,50,20,0.35)"; g.beginPath(); g.ellipse(x + r * 0.2, y + r * 0.35, r, r * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#6b4a2b"; g.fillRect(x - r * 0.12, y - r * 0.2, r * 0.24, r * 0.5);
      g.fillStyle = canopy[0]; g.beginPath(); g.arc(x, y - r * 0.55, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = canopy[1]; g.beginPath(); g.arc(x - r * 0.12, y - r * 0.68, r * 0.82, 0, Math.PI * 2); g.fill();
      g.fillStyle = canopy[2]; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.9, r * 0.42, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  // ------------------------------------------------------------ frame
  /** Draw a frame. alpha: 0..1 progress from the last sim tick to the next; dt: real seconds since the last frame. */
  draw(dt: number, alpha: number) {
    const { ctx, cam, run } = this;
    this.t += dt;
    if (!this.ground && !this.backdropPending) this.ground = this.bake(run.map);
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let sx = 0, sy = 0;
    if (this.shake > 0) { this.shake -= dt; sx = (Math.random() - 0.5) * 6 * this.shake; sy = (Math.random() - 0.5) * 6 * this.shake; }
    ctx.clearRect(0, 0, cam.vw, cam.vh);
    ctx.translate(sx, sy);
    // Ground: the visible window of the baked texture, on the layer below; skipped while the camera holds still.
    const key = `${cam.cx.toFixed(3)},${cam.cy.toFixed(3)},${cam.s.toFixed(3)},${sx.toFixed(1)},${sy.toFixed(1)},${this.tileScale}`;
    if (key !== this.groundKey) {
      const g = this.gctx;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = "#2f8a3a";
      g.fillRect(0, 0, cam.vw, cam.vh);
      g.translate(sx, sy);
      g.imageSmoothingEnabled = true;
      if (!this.ground) {
        g.fillStyle = "#80c25a"; g.fillRect(0, 0, cam.vw, cam.vh);
        this.groundKey = "";
      } else if (!this.drawTiles(g, sx, sy)) {
        const a = cam.toWorld(0, 0), b = cam.toWorld(cam.vw, cam.vh), P = TEX_PPU, Q = TEX_PPU * TD_SQUASH;
        g.drawImage(this.ground, (a.x + TEX_M) * P, (a.y + TEX_M) * Q, (b.x - a.x) * P, (b.y - a.y) * Q, 0, 0, cam.vw, cam.vh);
        this.groundKey = ""; // redraw sharp once the zoom settles
      } else this.groundKey = `${cam.cx.toFixed(3)},${cam.cy.toFixed(3)},${cam.s.toFixed(3)},${sx.toFixed(1)},${sy.toFixed(1)},${this.tileScale}`;
    }
    const s = cam.s;
    const view = cam.view(1.5);
    const vis = (x: number, y: number) => x > view.x0 && x < view.x1 && y > view.y0 && y < view.y1;
    const lerp = (id: number, x: number, y: number): [number, number] => {
      const p = this.prev.get(id);
      return p ? [p[0] + (x - p[0]) * alpha, p[1] + (y - p[1]) * alpha] : [x, y];
    };

    // Zones and the selection ring on the ground.
    for (const z of run.zones) {
      if (!vis(z.x, z.y)) continue;
      const p = cam.toScreen(z.x, z.y);
      ctx.fillStyle = z.kind === "fire" ? "rgba(255,120,40,0.35)" : "rgba(60,120,40,0.45)";
      ctx.beginPath(); ctx.ellipse(p.x, p.y, z.r * s, z.r * s * TD_SQUASH, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (this.debug) {
      ctx.strokeStyle = "rgba(255,0,200,0.9)"; ctx.lineWidth = 1.5;
      for (const p of run.map.paths) {
        for (const off of [-ROAD_HALF, 0, ROAD_HALF]) {
          ctx.beginPath();
          p.pts.forEach((q, i) => {
            const a = p.pts[Math.max(0, i - 1)], b = p.pts[Math.min(p.pts.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const o = cam.toScreen(q.x - ((b.y - a.y) / l) * off, q.y + ((b.x - a.x) / l) * off);
            i ? ctx.lineTo(o.x, o.y) : ctx.moveTo(o.x, o.y);
          });
          ctx.stroke();
        }
      }
      ctx.strokeStyle = "rgba(0,255,255,0.95)";
      for (const pad of run.map.pads) {
        const p = cam.toScreen(pad.x, pad.y);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.47 * s, 0.47 * s * TD_SQUASH, 0, 0, Math.PI * 2); ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y + 4); ctx.stroke();
      }
    }
    if (this.selectedPad >= 0) {
      const pad = run.map.pads[this.selectedPad];
      const p = cam.toScreen(pad.x, pad.y);
      ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.7 * s, 0.7 * s * TD_SQUASH, 0, 0, Math.PI * 2); ctx.stroke();
      if (this.ringR > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, this.ringR * s, this.ringR * s * TD_SQUASH, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Free pads pulse gently during the build phase so you see where to build.
    if (run.phase === "build") {
      const pulse = 0.35 + 0.25 * Math.sin(this.t * 3);
      ctx.strokeStyle = `rgba(255,236,150,${pulse})`; ctx.lineWidth = 2.5;
      for (const pad of run.map.pads) {
        if (run.defenderAt(pad.id) || !vis(pad.x, pad.y)) continue;
        const p = cam.toScreen(pad.x, pad.y);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.55 * s, 0.55 * s * TD_SQUASH, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Upright things, far to near.
    type D = { y: number; air: number; f: () => void };
    const list: D[] = [];
    let units = 0, culled = 0;
    const keepFrac = run.keepHp / 100;
    list.push({ y: run.map.keep.y, air: 0, f: () => this.drawKeep(0, run.map.keep.x, run.map.keep.y, keepState(keepFrac), 1.5) });
    for (const g of run.map.gates) list.push({ y: g.y, air: 0, f: () => this.drawKeep(1, g.x, g.y, "intact", 1.25) });
    for (const d of run.defenders) {
      const [x, y] = lerp(d.id, d.x, d.y);
      if (!vis(x, y)) { culled++; continue; }
      units++;
      list.push({ y, air: 0, f: () => {
        if (d.down) {
          const p = cam.toScreen(run.map.pads[d.pad].x, run.map.pads[d.pad].y);
          ctx.fillStyle = "rgba(60,60,60,0.55)"; ctx.font = `${Math.round(s * 0.5)}px "Lilita One", sans-serif`; ctx.textAlign = "center"; ctx.fillText("✝", p.x, p.y);
          return;
        }
        this.drawBody(d.kind, 0, x, y, 0, UNITS[d.kind].radius, d.face, d.rank, d.swing, d.moving ? 1.5 : 0, d.id, d.hp / d.maxHp, 1);
      } });
    }
    for (const e of run.enemies) {
      const [x, y] = lerp(e.id, e.x, e.y);
      if (!vis(x, y)) { culled++; continue; }
      units++;
      const blocked = e.block >= 0 || e.frozen > 0;
      list.push({ y, air: e.air ? 1 : 0, f: () => {
        this.drawBody(e.kind, 1, x, y, e.air ? 0.7 : 0, e.radius, e.face, e.rank, e.swing, blocked ? 0 : e.speed, e.id, e.hp / e.maxHp, e.boss ? 1.6 : 1);
        if (e.frozen > 0) { const p = cam.toScreen(x, y); ctx.fillStyle = "rgba(170,220,255,0.45)"; ctx.beginPath(); ctx.ellipse(p.x, p.y - e.radius * s, e.radius * s * 1.3, e.radius * s * 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
      } });
    }
    for (const c of this.corpses) {
      if (!vis(c.x, c.y)) continue;
      list.push({ y: c.y - 0.01, air: c.air ? 1 : 0, f: () => {
        const fr = frame(c.kind, Math.max(1, Math.min(4, c.rank)), c.side, "death", Math.min(0.999, c.t / 0.7), dir8(c.face));
        const p = cam.toScreen(c.x, c.y, c.air ? 0.7 * Math.max(0, 1 - c.t * 2) : 0);
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, c.t - 0.7) / 0.5);
        if (fr) { ctx.translate(p.x, p.y); drawFrame(ctx, fr, (s * spriteVis(bodyDef(c.kind).radius)) / fr.ppu); }
        ctx.restore();
      } });
    }
    list.sort((p, q) => p.air - q.air || p.y - q.y);
    for (const d of list) d.f();

    // Shots.
    for (const sh of run.shots) {
      const k = Math.min(1, (sh.t + alpha * DT) / sh.dur);
      const x = sh.x0 + (sh.x1 - sh.x0) * k, y = sh.y0 + (sh.y1 - sh.y0) * k;
      if (!vis(x, y)) continue;
      const lob = sh.kind === "grenadier" || sh.kind === "bombard" || sh.kind === "thorn";
      const z = lob ? 0.4 + Math.sin(k * Math.PI) * 1.6 : 0.45 + sh.z * k;
      const p = cam.toScreen(x, y, z);
      if (lob) {
        ctx.fillStyle = sh.kind === "thorn" ? "#3f8f3a" : "#3a3330";
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2.5, s * 0.11), 0, Math.PI * 2); ctx.fill();
      } else {
        const k0 = Math.max(0, k - 0.12), x0 = sh.x0 + (sh.x1 - sh.x0) * k0, y0 = sh.y0 + (sh.y1 - sh.y0) * k0;
        const p0 = cam.toScreen(x0, y0, 0.45 + sh.z * k0);
        ctx.strokeStyle = sh.enemy ? "#ff8a6a" : sh.kind === "rime" ? "#bfe8ff" : sh.kind === "ballista" ? "#5a3a20" : "#fff4d0";
        ctx.lineWidth = sh.kind === "ballista" ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
    }
    // Sprite effects from the shared VFX atlas.
    for (const fx of this.sfx) {
      fx.t += dt;
      if (!vis(fx.x, fx.y)) continue;
      const sh0 = vfxSheet(fx.sheet);
      if (!sh0) continue;
      const src2 = vfxFrame(fx.sheet, Math.min(sh0.frames - 1, Math.floor((fx.t / fx.max) * sh0.frames)), fx.tint);
      if (!src2) continue;
      const sh = src2.sh;
      const p = cam.toScreen(fx.x, fx.y, fx.z), w = fx.size * s, h = w * (sh.h / sh.w);
      ctx.save();
      if (sh.blend === "add") ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(src2.img, src2.sx, src2.sy, sh.w, sh.h, p.x - w * sh.anchor[0], p.y - h * sh.anchor[1], w, h);
      ctx.restore();
    }
    this.sfx = this.sfx.filter((f) => f.t < f.max);
    // Lightning.
    ctx.lineJoin = "round";
    for (const z of this.zaps) {
      z.life -= dt;
      ctx.strokeStyle = `rgba(190,230,255,${Math.max(0, z.life / 0.22)})`; ctx.lineWidth = 3;
      ctx.beginPath();
      z.pts.forEach(([x, y], i) => { const p = cam.toScreen(x, y, 0.6); i ? ctx.lineTo(p.x + (Math.random() - 0.5) * 6, p.y + (Math.random() - 0.5) * 6) : ctx.moveTo(p.x, p.y); });
      ctx.stroke();
    }
    this.zaps = this.zaps.filter((z) => z.life > 0);
    // Blast rings.
    for (const r of this.rings) {
      r.life += dt;
      const k = r.life / r.max, p = cam.toScreen(r.x, r.y);
      ctx.strokeStyle = `rgba(255,210,120,${Math.max(0, 1 - k)})`; ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r.r * s * (0.4 + k * 0.7), r.r * s * TD_SQUASH * (0.4 + k * 0.7), 0, 0, Math.PI * 2); ctx.stroke();
    }
    this.rings = this.rings.filter((r) => r.life < r.max);
    // Particles (capped).
    for (const pt of this.parts) {
      pt.life += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z = Math.max(0, pt.z + pt.vz * dt); pt.vz -= 6 * dt;
      if (!vis(pt.x, pt.y)) continue;
      const p = cam.toScreen(pt.x, pt.y, pt.z);
      ctx.globalAlpha = Math.max(0, 1 - pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(p.x - pt.size * s / 2, p.y - pt.size * s / 2, pt.size * s, pt.size * s);
    }
    ctx.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const c of this.corpses) c.t += dt;
    this.corpses = this.corpses.filter((c) => c.t < 1.2);
    // Gold floats.
    ctx.textAlign = "center";
    ctx.font = `${Math.round(Math.max(12, s * 0.42))}px "Lilita One", sans-serif`;
    for (const f of this.floats) {
      f.life += dt;
      const p = cam.toScreen(f.x, f.y, 1.2 + f.life * 1.2);
      ctx.globalAlpha = Math.max(0, 1 - f.life / 0.9);
      ctx.lineWidth = 3; ctx.strokeStyle = "#3a2a10"; ctx.strokeText(f.text, p.x, p.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    this.floats = this.floats.filter((f) => f.life < 0.9);
    // Keep hit flash.
    if (this.keepFlash > 0) {
      this.keepFlash -= dt;
      ctx.fillStyle = `rgba(255,40,40,${this.keepFlash * 0.4})`;
      ctx.fillRect(0, 0, cam.vw, cam.vh);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawMinimap();
    this.stats = { units, culled, particles: this.parts.length + this.sfx.length };
  }

  /** Ground tiles pre-scaled to the current zoom so each frame is a 1:1 blit (scaling the whole texture every
   *  frame was the main cost on a slow CPU). Rebuilt once the zoom settles; until then the caller scales. */
  private tiles = new Map<string, HTMLCanvasElement>();
  private tileScale = 0;
  private scaleSeen = 0;
  private scaleSince = 0;
  private drawTiles(ctx: CanvasRenderingContext2D, shx: number, shy: number): boolean {
    const { cam, dpr, ground } = this;
    if (!ground) return false;
    const scale = +(cam.s * dpr).toFixed(3);
    if (scale !== this.scaleSeen) { this.scaleSeen = scale; this.scaleSince = this.t; }
    if (scale !== this.tileScale) {
      if (this.t - this.scaleSince < 0.15) return false;
      this.tiles.clear();
      this.tileScale = scale;
    }
    const T = 512, k = TEX_PPU / scale;
    const midY = cam.toScreen(cam.cx, cam.cy).y;
    const ox = Math.round((cam.cx + TEX_M) * scale - (cam.vw / 2) * dpr), oy = Math.round((cam.cy + TEX_M) * scale * TD_SQUASH - midY * dpr);
    const i0 = Math.floor(ox / T), i1 = Math.floor((ox + cam.vw * dpr) / T), j0 = Math.floor(oy / T), j1 = Math.floor((oy + cam.vh * dpr) / T);
    ctx.setTransform(1, 0, 0, 1, Math.round(shx * dpr), Math.round(shy * dpr));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i * T * k > ground.width || j * T * k > ground.height) continue;
      const key = `${i},${j}`;
      let c = this.tiles.get(key);
      if (!c) {
        c = document.createElement("canvas");
        c.width = c.height = T;
        const g = c.getContext("2d")!;
        g.fillStyle = "#2f8a3a"; g.fillRect(0, 0, T, T);
        g.drawImage(ground, i * T * k, j * T * k, T * k, T * k, 0, 0, T, T);
        if (this.tiles.size >= 40) this.tiles.delete(this.tiles.keys().next().value!);
      } else this.tiles.delete(key);
      this.tiles.set(key, c); // most recently used last
      ctx.drawImage(c, i * T - ox, j * T - oy);
    }
    ctx.setTransform(dpr, 0, 0, dpr, shx * dpr, shy * dpr);
    return true;
  }

  private drawKeep(side: Side, x: number, y: number, state: Parameters<typeof keepImage>[1], scale: number) {
    const img = keepImage(side, state);
    if (!img) return;
    const m = keepManifest(), p = this.cam.toScreen(x, y), u = (KEEP_SCALE / m.ppu) * p.s * scale;
    this.ctx.drawImage(img, p.x - m.anchors.ground[0] * u, p.y - m.anchors.ground[1] * u, m.w * u, m.h * u);
  }

  private drawBody(kind: BodyKind, side: Side, x: number, y: number, z: number, radius: number, face: number, rank: number, swing: number, speed: number, id: number, hpFrac: number, big: number) {
    const { ctx, cam } = this;
    const s = cam.s, g = cam.toScreen(x, y), p = cam.toScreen(x, y, z);
    const baseR = bodyDef(kind).radius;
    // Contact shadow.
    const sw = radius * s * 2.3, shh = radius * s * 1.35;
    ctx.drawImage(shadowSprite(), g.x - sw / 2, g.y - shh / 2, sw, shh);
    const o = { t: this.t, id, swing, speed, rank };
    const { anim, phase } = animFor(o);
    const fr = frame(kind, Math.max(1, Math.min(4, rank)), side, anim, phase, dir8(face));
    if (fr) {
      ctx.save(); ctx.translate(p.x, p.y);
      drawFrame(ctx, fr, (s * spriteVis(baseR) * big) / fr.ppu);
      ctx.restore();
    } else drawUnit(ctx, kind, side, p.x, p.y, radius * s, face, { ...o, noShadow: true });
    const top = p.y - (0.75 + radius * 1.6) * s * (big > 1 ? 0.8 : 1);
    // Rank pips only once they are big enough to read (a cheap level of detail when zoomed out).
    if (rank > 1 && side === 0 && s >= 34) drawRank(ctx, p.x, top - 6, Math.max(6, s * 0.18), rank);
    if (hpFrac < 0.999) {
      const w = Math.max(18, radius * s * 2.2 * big), h = big > 1 ? 6 : 4;
      ctx.fillStyle = "rgba(20,16,12,0.75)"; ctx.fillRect(p.x - w / 2 - 1, top - 1, w + 2, h + 2);
      ctx.fillStyle = side === 0 ? "#4fd0c8" : big > 1 ? "#ff4f3a" : "#f06a4a";
      ctx.fillRect(p.x - w / 2, top, w * Math.max(0, hpFrac), h);
    }
  }

  private drawMinimap() {
    const { ctx, cam, run } = this;
    const map = run.map;
    const h = Math.min(210, cam.vh * 0.26), w = h * (map.w / map.h) / TD_SQUASH * 1.25;
    const x0 = cam.vw - w - 10, y0 = cam.insetTop + 8;
    this.mini = { x: x0, y: y0, w, h };
    const X = (x: number) => x0 + (x / map.w) * w, Y = (y: number) => y0 + (y / map.h) * h;
    ctx.fillStyle = "rgba(30,50,24,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.65)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0 - 3, y0 - 3, w + 6, h + 6, 6); else ctx.rect(x0 - 3, y0 - 3, w + 6, h + 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#e7c78b"; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
    for (const p of map.paths) { ctx.beginPath(); for (let i = 0; i < p.pts.length; i += 4) { const q = p.pts[i]; i ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y)); } ctx.stroke(); }
    ctx.fillStyle = "#57d6ff";
    for (const d of run.defenders) if (!d.down) ctx.fillRect(X(d.x) - 1.5, Y(d.y) - 1.5, 3, 3);
    for (const e of run.enemies) {
      ctx.fillStyle = e.boss ? "#ff2a1a" : e.air ? "#ffb347" : "#ff5a4a";
      const r = e.boss ? 4 : 2;
      ctx.beginPath(); ctx.arc(X(e.x), Y(e.y), r, 0, Math.PI * 2); ctx.fill();
    }
    const v = cam.toWorld(0, 0), v2 = cam.toWorld(cam.vw, cam.vh);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    ctx.strokeRect(X(Math.max(0, v.x)), Y(Math.max(0, v.y)), X(Math.min(map.w, v2.x)) - X(Math.max(0, v.x)), Y(Math.min(map.h, v2.y)) - Y(Math.max(0, v.y)));
  }

  /** The pad under a screen point, or -1. */
  padAt(px: number, py: number): number {
    const w = this.cam.toWorld(px, py);
    let best = -1, bd = 0.95;
    for (const p of this.run.map.pads) { const d = Math.hypot(p.x - w.x, p.y - w.y); if (d < bd) { bd = d; best = p.id; } }
    // A blocker standing on the road also selects its pad.
    if (best < 0) for (const d of this.run.defenders) if (Math.hypot(d.x - w.x, d.y - w.y) < 0.6) best = d.pad;
    return best;
  }
  /** The front of the wave: the enemy furthest along, or null. */
  front(): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, bs = -1;
    for (const e of this.run.enemies) { const sc = e.air ? e.y : e.s / (this.run.map.paths[e.road]?.len || 1) * this.run.map.h; if (sc > bs) { bs = sc; best = { x: e.x, y: e.y }; } }
    return best;
  }
}
