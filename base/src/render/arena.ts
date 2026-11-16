// Blender-rendered arenas (public/arenas, see docs/ARENAS.md and art/arenas/render_arenas.py), one per campaign act.
//
// The backdrop is rendered through the game's own 3/4 camera (camera.ts: same tilt and distance), so it is the
// exact ground plane under the Camera: a point on the normalised image plane (u, v) = ((X / cz), (Y cos - z sin) / cz)
// lands on screen at (cam.cx + cam.k * u, cam.cy + cam.k * v) whatever the screen size. It holds the ground, paths,
// keep plazas and the low borders and trees around the board. Obstacles stand upright as prop sprites (rendered at
// the camera's mid-board elevation) and depth-sort with units and keeps. Loaded lazily; until the images are ready
// (or if they're missing) the board paints its drawn terrain.
import type { Obstacle } from "@engine/core/defs";

export interface ArenaProp { file: string; /** measured silhouette radius at the base, in prop radii (~1) */ footprint: number; }
export interface ArenaAct {
  name: string;
  /** Fill for any screen area outside the backdrop. */
  edge: string;
  obstacle: string;
  ground: string;
  props: ArenaProp[];
  /** The foreground (foreground.ts): border canopy drawn over units, same frame as the backdrop, cut into cells
   *  given as [x, y, w, h] fractions of the backdrop. Optional: older manifests have none. */
  fg?: { file: string; cells: [number, number, number, number][] };
}
export interface ArenaManifest {
  version: number;
  /** The camera the backdrop was rendered through: must match camera.ts TILT and DIST. */
  camera: { tilt: number; dist: number };
  /** The normalised image-plane rectangle the backdrop covers (v grows down the screen). */
  view: { u0: number; u1: number; v0: number; v1: number };
  /** Backdrop pixel size. */
  size: [number, number];
  /** Prop sprite frame in prop radii [w, h], the ground anchor as fractions of it, pixel size, render elevation. */
  prop: { frame: [number, number]; anchor: [number, number]; res: [number, number]; elev: number };
  acts: Record<string, ArenaAct>;
}

export const ARENA_COUNT = 10;

let manifest: ArenaManifest | null = null;
let loading: Promise<ArenaManifest | null> | null = null;
const images = new Map<string, HTMLImageElement | null>();

const base = () => (import.meta as any).env?.BASE_URL ?? "./";

export function loadArenas(): Promise<ArenaManifest | null> {
  if (loading) return loading;
  loading = fetch(`${base()}arenas/manifest.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((m: ArenaManifest | null) => (manifest = m && m.version >= 3 ? m : null))
    .catch(() => (manifest = null));
  return loading;
}

/** The act whose arena to use: the level's act if there is an arena for it, else act 1. */
export function arenaAct(act: number | undefined, m: Pick<ArenaManifest, "acts"> | null = manifest): number {
  const a = Math.floor(act ?? 1);
  if (!m) return a >= 1 && a <= ARENA_COUNT ? a : 1;
  return m.acts[String(a)] ? a : 1;
}

/** Loads an image once; resolves when decoded (null on error). */
function load(url: string): Promise<HTMLImageElement | null> {
  const have = images.get(url);
  if (have !== undefined && have?.complete) return Promise.resolve(have);
  return new Promise((res) => {
    const i = new Image();
    i.decoding = "async";
    // Decode up front so the first frame that draws it (the foreground, mid-battle) doesn't hitch.
    i.onload = () => { images.set(url, i); (i.decode ? i.decode().catch(() => undefined) : Promise.resolve()).then(() => res(i)); };
    i.onerror = () => { images.set(url, null); res(null); };
    i.src = url;
  });
}

export interface Arena {
  act: number;
  info: ArenaAct;
  m: ArenaManifest;
  ground: HTMLImageElement;
  props: HTMLImageElement[];
  /** The foreground layer, null if the act has none (or it failed to load). */
  fg: HTMLImageElement | null;
}

/** Loads the arena for an act (falling back to act 1). Null if the art isn't there. */
export async function arenaFor(act: number | undefined): Promise<Arena | null> {
  const m = await loadArenas();
  if (!m) return null;
  const a = arenaAct(act, m);
  const info = m.acts[String(a)];
  if (!info) return null;
  const files = [info.ground, ...info.props.map((p) => p.file)];
  const [fg, ground, ...props] = await Promise.all([info.fg ? load(`${base()}arenas/${info.fg.file}`) : Promise.resolve(null), ...files.map((f) => load(`${base()}arenas/${f}`))]);
  if (!ground) return null;
  return { act: a, info, m, ground, props: props.filter((p): p is HTMLImageElement => !!p), fg };
}

/** Which prop variant an obstacle gets: stable for its position so it doesn't change between rounds. */
export function propVariant(o: Obstacle, n: number): number {
  if (n <= 1) return 0;
  const h = Math.abs(Math.sin(o.x * 12.9898 + o.y * 78.233) * 43758.5453) % 1;
  return Math.min(n - 1, Math.floor(h * n));
}

/**
 * Where a prop sprite goes on screen for an obstacle of radius r whose ground centre projects to (sx, sy), with
 * `s` screen px per world unit at that depth. Props are modelled with their base silhouette on the unit circle, so
 * prop radius 1 maps to r.
 */
export function propRect(m: Pick<ArenaManifest, "prop">, sx: number, sy: number, r: number, s: number) {
  const w = m.prop.frame[0] * r * s, h = m.prop.frame[1] * r * s;
  return { x: sx - w * m.prop.anchor[0], y: sy - h * m.prop.anchor[1], w, h };
}

/** Screen rect of the backdrop for a camera fitted with image-plane scale k and board centre at (cx, cy). */
export function backdropRect(m: Pick<ArenaManifest, "view">, k: number, cx: number, cy: number) {
  const v = m.view;
  return { x: cx + k * v.u0, y: cy + k * v.v0, w: k * (v.u1 - v.u0), h: k * (v.v1 - v.v0) };
}
