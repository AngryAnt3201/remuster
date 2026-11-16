// Arenas: one battlefield per campaign act, in the layout base/src/render/arena.ts loads (docs/ARENAS.md).
//   act<n>.jpg        the backdrop, seen through the game's own 3/4 camera: painted ground plus upright scenery
//   act<n>_fg.webp    the scenery that overhangs the board's edges, drawn again over the units (same frame)
//   act<n>_prop<k>.png  the obstacle props, standing sprites with a baked contact shadow
// A game describes each act as: paint the ground top-down in world units (Painter), then stand toon-3D models around
// the board. The bake projects both through the camera, so the ground lines up with the board on every screen.
import { H, W } from "@engine/core/defs";
import { DIST, TILT } from "../base/src/render/camera";
import { Painter } from "./paint";
import { Model, trim, type RenderOpts, type Sprite, type Style, type TeamCols } from "./toon3d";

/** The backdrop contract shared with the runtime (the same numbers as the base game's manifest). */
export const ARENA = {
  version: 3,
  camera: { tilt: TILT, dist: DIST },
  view: { u0: -0.26, u1: 0.26, v0: -0.42, v1: 0.44 },
  size: [1456, 2408] as [number, number],
  prop: { frame: [3.2, 3.8] as [number, number], anchor: [0.5, 0.65789] as [number, number], res: [512, 608] as [number, number], elev: 53.331 },
  /** The world rectangle the ground painter covers (everything the camera can see, with a margin). */
  ground: { x0: -8, y0: -17, w: 25, h: 38, scale: 80 },
};
const P = ARENA.size[0] / (ARENA.view.u1 - ARENA.view.u0);
const SIN = Math.sin(TILT), COS = Math.cos(TILT);

/** World point to backdrop pixel, and the pixels per world unit at that depth. */
export function project(x: number, y: number, z = 0): { x: number; y: number; s: number } {
  const X = x - W / 2, Y = y - H / 2, cz = DIST - Y * SIN - z * COS;
  return { x: (X / cz - ARENA.view.u0) * P, y: ((Y * COS - z * SIN) / cz - ARENA.view.v0) * P, s: P / cz };
}

/** Something standing in the scene. */
export interface SceneItem {
  /** Build the model: base centred on the origin, z up, one unit = one world unit. */
  build(m: Model): void;
  /** Where its origin stands on the ground (board coordinates: the board is x 0..9, y 0..14; y grows towards the camera). */
  x: number; y: number;
  /** Which way it faces (0 = screen right, 90 = towards the camera). Default 90. */
  yaw?: number;
  scale?: number;
  /** True: it overhangs the board, so it is also drawn over the units (and fades when a unit walks under it). */
  fg?: boolean;
  /** Radius of a soft contact shadow painted on the ground under it (world units). */
  shadow?: number;
}
/** Ambient life over an arena (the runtime's AmbientCfg, base/src/render/ambient.ts): drifting cloud shade, wind
 *  gusts, motes (soot falling, embers rising, steam drifting, lamps blinking), butterflies, a passing flock. */
export interface Ambient {
  shade: number; gust: string | null;
  motes: { kind: "drift" | "fall" | "rise" | "blink"; n: number; colors: string[]; size: number; leaf?: boolean }[];
  butterflies: number; flock: { n: number; color: string } | null;
}
export interface ArenaDef {
  name: string;
  /** Fill for any screen area outside the backdrop. */
  edge: string;
  /** A name for the act's obstacle family (free text; the base game's names switch on its own ambient effects). */
  obstacle: string;
  /** Paint the ground, top-down, in world units. The painter covers x -8..17, y -17..21. */
  ground(p: Painter): void;
  /** Stand scenery around (never on) the board: call `add` for each item. `r` is a seeded random 0..1. */
  scenery(add: (item: SceneItem) => void, r: () => number): void;
  /** A last pass over the finished backdrop in pixels (haze, vignette, light shafts). */
  grade?(g: CanvasRenderingContext2D, w: number, h: number): void;
  /** Three obstacle props: each builds a model whose base fills the unit circle (radius 1 = the obstacle's radius). */
  props: ((m: Model) => void)[];
  ambient?: Ambient;
}
export interface ArenaArt {
  /** Acts 1 to 10, in campaign order. */
  acts: ArenaDef[];
  /** Colours for any team-coloured parts in the scenery (neutral bunting by default). */
  team?: TeamCols;
}
export interface BakedArena { backdrop: HTMLCanvasElement; fg: HTMLCanvasElement; cells: [number, number, number, number][]; props: { canvas: HTMLCanvasElement; footprint: number }[]; }

type Shoot = (m: Model, o: RenderOpts) => Sprite;
function spriteCanvas(s: Sprite): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = s.w; c.height = s.h;
  const id = c.getContext("2d")!.createImageData(s.w, s.h);
  id.data.set(s.data[0]);
  c.getContext("2d")!.putImageData(id, 0, 0);
  return c;
}

/** Paint, project and assemble one act. */
export function bakeArena(def: ArenaDef, seed: number, style: Style, team: TeamCols, shoot: Shoot): BakedArena {
  const G = ARENA.ground, [BW, BH] = ARENA.size;
  const ground = new Painter(G.x0, G.y0, G.w, G.h, G.scale, { ink: style.ink, seed });
  def.ground(ground);
  const items: SceneItem[] = [];
  let s = seed * 7919 + 13;
  const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  def.scenery((it) => items.push(it), r);
  for (const it of items) if (it.shadow) ground.glow(it.x, it.y + it.shadow * 0.15, it.shadow * 1.25, "#150d18", 0.5, "source-over", it.shadow);

  // ---- the ground through the camera: every screen row is one world row scaled across
  const backdrop = document.createElement("canvas");
  backdrop.width = BW; backdrop.height = BH;
  const g = backdrop.getContext("2d")!;
  g.fillStyle = def.edge; g.fillRect(0, 0, BW, BH);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  const rowY = (py: number) => { const v = ARENA.view.v0 + py / P; return (v * DIST) / (COS + v * SIN); };
  for (let py = 0; py < BH; py++) {
    const Y0 = rowY(py), Y1 = rowY(py + 1), Y = (Y0 + Y1) / 2, cz = DIST - Y * SIN;
    const sx = (ARENA.view.u0 * cz + W / 2 - G.x0) * G.scale, sw = (ARENA.view.u1 - ARENA.view.u0) * cz * G.scale;
    const sy = (Y0 + H / 2 - G.y0) * G.scale, sh = Math.max(1, (Y1 - Y0) * G.scale);
    g.drawImage(ground.canvas, sx, sy, sw, sh, 0, py, BW, 1);
  }
  // ---- scenery, far to near
  const fg = document.createElement("canvas");
  fg.width = BW; fg.height = BH;
  const fgc = fg.getContext("2d")!;
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const p = project(it.x, it.y);
    if (p.x < -400 || p.x > BW + 400 || p.y < -200 || p.y > BH + 700) continue;
    const m = new Model();
    m.scale(it.scale ?? 1);
    it.build(m);
    const sp = trim(shoot(m, { yaw: it.yaw ?? 90, el: 90 - (TILT * 180) / Math.PI, ppu: p.s, style, teams: [team] }));
    const c = spriteCanvas(sp);
    const dx = Math.round(p.x - sp.ax), dy = Math.round(p.y - sp.ay);
    g.drawImage(c, dx, dy);
    if (it.fg) fgc.drawImage(c, dx, dy);
  }
  def.grade?.(g, BW, BH);
  // ---- foreground cells: tight boxes of covered pixels, each side cut into bands
  const cells: [number, number, number, number][] = [];
  const data = fgc.getImageData(0, 0, BW, BH).data, bands = 14, bh = Math.ceil(BH / bands);
  for (const [xa, xb] of [[0, BW >> 1], [BW >> 1, BW]]) for (let b = 0; b < bands; b++) {
    let x0 = BW, x1 = -1, y0 = BH, y1 = -1;
    for (let y = b * bh; y < Math.min(BH, (b + 1) * bh); y++) for (let x = xa; x < xb; x++) if (data[(y * BW + x) * 4 + 3] > 12) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 >= 0) cells.push([+(x0 / BW).toFixed(5), +(y0 / BH).toFixed(5), +((x1 - x0 + 1) / BW).toFixed(5), +((y1 - y0 + 1) / BH).toFixed(5)]);
  }
  // ---- obstacle props
  const [PW, PH] = ARENA.prop.res, ppu = PW / ARENA.prop.frame[0];
  const props = def.props.map((build) => {
    const m = new Model();
    build(m);
    let foot = 0;
    for (let i = 0; i < m.pos.length; i += 3) if (m.pos[i + 2] < 0.2) foot = Math.max(foot, Math.hypot(m.pos[i], m.pos[i + 1]));
    const sp = shoot(m, { yaw: 60, el: ARENA.prop.elev, ppu, style, teams: [team], shadow: 1.05 });
    const c = document.createElement("canvas");
    c.width = PW; c.height = PH;
    c.getContext("2d")!.drawImage(spriteCanvas(sp), Math.round(PW * ARENA.prop.anchor[0] - sp.ax), Math.round(PH * ARENA.prop.anchor[1] - sp.ay));
    return { canvas: c, footprint: +Math.min(1.07, Math.max(0.93, foot)).toFixed(4) };
  });
  return { backdrop, fg, cells, props };
}
