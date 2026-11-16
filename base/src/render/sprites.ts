// Blender-rendered character atlases (public/atlas, see docs/ART-V3-ATLAS.md). One atlas per body and tier holds
// 5 rendered facings (the other 3 are mirrors) x idle/walk/attack/death (+ cast) frames. A sheet is one 8-bit image of
// palette indices (lossless WebP) with a joint palette in the manifest: each entry's colour (team parts in white) and
// team mask. A sheet is tinted for a team by tinting its palette (at most 256 entries) and writing one lookup per
// pixel, into a canvas the first time that team needs it. Until a sheet is ready the renderer falls back to the drawn
// tokens in units.ts.
import type { Side } from "@engine/core/defs";
import { TEAM } from "./palette";

export type Anim = "idle" | "walk" | "attack" | "death" | "cast";
/** x, y, w, h in the sheet; ax, ay the ground anchor in the frame; s the frame's resolution against the atlas PPU
 *  (absent = 1; the death clip ships at a lower resolution and is scaled back up). */
type Rect = [x: number, y: number, w: number, h: number, ax: number, ay: number, s?: number];
interface Sheet {
  w: number; h: number; anims: Record<string, Rect[][] | string>;
  /** base64 palette, 7 bytes per entry: r, g, b, a, then the team mask (main, dark, light coverage); entry 0 is clear.
   *  Not used by "mask" sheets. */
  pal: string;
  /** "mask": a full-colour sheet for games baked with artkit (artkit/README.md). <key>.webp is twice the sheet's
   *  height: the sheet with team parts in white, over its team mask (red = team main, green = dark, blue = light),
   *  tinted at load with the manifest's own team colours. Absent: palette indices tinted through `pal`. */
  fmt?: "mask";
  /** World units the body travels per walk cycle at true scale (0 = not measured). */
  stride?: number;
  /** Motion class: heavy bodies wind up longer and raise dust as they step; light ones are snappy. */
  weight?: Weight;
}
export type Weight = "heavy" | "mid" | "light";
interface TeamCols { main: string; dark: string; light: string; }
export interface Manifest {
  version: number;
  /** Atlas pixels per world unit, horizontally. */
  ppu: number;
  /** Camera pitch in degrees below the horizon: a ground circle of radius r draws r * sin(el) tall. */
  el: number;
  dirs: number[];
  dir8: [number, boolean][];
  anims: Record<Anim, number>;
  /** The frame each strike clip lands its blow on; the frames before it are the wind-up. */
  impact?: Partial<Record<Anim, number>>;
  /** The team colours the atlases were rendered beside (the runtime tints with the active direction's, TEAM). */
  teams: Record<"tide" | "ember", TeamCols>;
  /** True: tint with `teams` above, the colours this game's atlases were made for, not the base style's TEAM. */
  ownTeams?: boolean;
  /** The style direction the atlases were rendered in ("v2" = the built-in look). */
  style?: string;
  units: Record<string, { tiers: number[]; radius: number }>;
  sheets: Record<string, Sheet>;
}

let manifest: Manifest | null = null;
let loading: Promise<void> | null = null;
const portraits = new Map<string, HTMLImageElement | null>();

// ---- the tinted sheet cache: a byte budget with least-recently-used eviction
/** Most decoded bytes the tinted sheet canvases may hold. One team's full set is ~1.1 GB and iOS kills a WKWebView
 *  long before that on smaller phones; a battle needs ~140 MB. */
export const SHEET_BUDGET = 256 * 1024 * 1024;
/** A sheet drawn this recently (ms) belongs to the screen being shown and is never evicted. */
export const SHEET_RECENT_MS = 3000;
/** preload() calls this close together (ms) are one screen's: a later call starts a new screen's pins. */
const SCENE_GAP_MS = 1000;
interface Slot { c: HTMLCanvasElement | "loading" | null; bytes: number; used: number; }
/** "<sheet key>|<side>" -> that team's tinted canvas ("loading", or null when the file failed), its decoded bytes and
 *  when it was last asked for. */
const tinted = new Map<string, Slot>();
/** Sheets the current battle or screen preloaded: never evicted while it lasts. */
let pins = new Set<string>();
let pinAt = -Infinity;
/** When the current screen's pins were set: sheets last drawn before it belong to a screen that is gone. */
let sceneStart = -Infinity;
let lastEnforce = -Infinity;
let budget = SHEET_BUDGET, total = 0, peak = 0, evictions = 0;
const evictListeners: ((c: HTMLCanvasElement) => void)[] = [];
const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export interface CacheEntry { id: string; bytes: number; used: number; pinned: boolean; }
/** Which sheets to evict to bring `total` decoded bytes under `budget`: least recently used first, skipping pinned
 *  ones, ones drawn in the last `recentMs` since the current screen began (`sceneStart`; sheets last drawn before it
 *  belong to a screen that is gone) and ones still loading (no bytes). Pure, for the cache and its tests. */
export function pickEvictions(entries: CacheEntry[], total: number, budget: number, now: number, recentMs = SHEET_RECENT_MS, sceneStart = -Infinity): string[] {
  if (total <= budget) return [];
  const out: string[] = [];
  const inUse = (e: CacheEntry) => e.pinned || (e.used >= sceneStart && now - e.used < recentMs);
  const free = entries.filter((e) => e.bytes > 0 && !inUse(e)).sort((a, b) => a.used - b.used);
  for (const e of free) {
    if (total <= budget) break;
    out.push(e.id);
    total -= e.bytes;
  }
  return out;
}

/** Let go of a canvas's pixels now (WebKit frees a canvas's backing store when it is resized to nothing). */
function release(c: HTMLCanvasElement) { c.width = 0; c.height = 0; }

function drop(id: string) {
  const sl = tinted.get(id);
  if (!sl) return;
  if (sl.c && sl.c !== "loading") { for (const f of evictListeners) f(sl.c); release(sl.c); }
  total -= sl.bytes;
  tinted.delete(id);
  evictions++;
}

/** Evict least-recently-used sheets the current screen isn't using until the cache (plus `incoming` bytes about to be
 *  added) is within budget. */
function enforceBudget(incoming = 0) {
  lastEnforce = clock();
  if (total + incoming <= budget) return;
  const entries = [...tinted].map(([id, sl]) => ({ id, bytes: sl.bytes, used: sl.used, pinned: pins.has(id) }));
  for (const id of pickEvictions(entries, total + incoming, budget, lastEnforce, SHEET_RECENT_MS, sceneStart)) drop(id);
}

/** Called with each canvas the cache evicts, before its pixels go (caches keyed by it can let go too). */
export function onSheetEvict(f: (c: HTMLCanvasElement) => void) { evictListeners.push(f); }
/** The cache's decoded bytes now and at most so far, its canvases, evictions and budget (tools/sprite-mem.mjs). */
export function sheetCacheStats() {
  let sheets = 0, pinned = 0, inUse = 0;
  const now = clock();
  for (const [id, sl] of tinted) {
    if (!sl.c || sl.c === "loading") continue;
    sheets++;
    if (pins.has(id)) pinned += sl.bytes;
    if (pins.has(id) || (sl.used >= sceneStart && now - sl.used < SHEET_RECENT_MS)) inUse += sl.bytes;
  }
  return { bytes: total, peak, sheets, evictions, budget, pinned, inUse };
}
/** Change the byte budget (tools and tests; Infinity keeps every sheet, as before the cache was bounded). */
export function setSheetBudget(b: number) { budget = b; enforceBudget(); }

const base = () => (import.meta as any).env?.BASE_URL ?? "./";

export function loadSprites(): Promise<void> {
  if (loading) return loading;
  loading = fetch(`${base()}atlas/manifest.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => { manifest = m && m.version >= 4 ? m : null; })
    .catch(() => { manifest = null; });
  return loading;
}

export const spritesReady = () => !!manifest;
/** Whether a body kind has atlas art at all (the drawn token stands in otherwise). */
export const hasAtlas = (kind: string) => !!manifest?.units[kind]?.tiers.length;
export const atlasManifest = () => manifest;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.decoding = "async";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(url));
    i.src = url;
  });
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

/** Decode a sheet's base64 palette (7 bytes per entry). */
export function decodePalette(b64: string): Uint8Array {
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** One team's colours for every palette entry, as RGBA bytes:
 *  rgb = colour * (1 + R*(main-1) + G*(dark-1) + B*(light-1)), entry 0 transparent. */
export function tintPalette(pal: Uint8Array, team: TeamCols): Uint8ClampedArray {
  const [km, kd, kl] = [hex(team.main), hex(team.dark), hex(team.light)].map((c) => c.map((v) => (v - 1) / 255));
  const n = pal.length / 7, out = new Uint8ClampedArray(n * 4);
  for (let e = 1; e < n; e++) {
    const p = e * 7, r = pal[p + 4], g = pal[p + 5], b = pal[p + 6];
    for (let c = 0; c < 3; c++) out[e * 4 + c] = Math.round(pal[p + c] * (1 + r * km[c] + g * kd[c] + b * kl[c]));
    out[e * 4 + 3] = pal[p + 3];
  }
  return out;
}

/** Index pixels (the red channel of the decoded sheet) through a tinted palette into RGBA, a 32-bit word at a time
 *  (little-endian: the red byte is the low byte, and a palette word copies its bytes in order). */
export function tintIndexed(idx: Uint8ClampedArray, lut: Uint8ClampedArray, out: Uint8ClampedArray) {
  const src = new Uint32Array(idx.buffer, idx.byteOffset, idx.length >> 2);
  const dst = new Uint32Array(out.buffer, out.byteOffset, out.length >> 2);
  const pal = new Uint32Array(lut.buffer, lut.byteOffset, lut.length >> 2);
  const n = pal.length;
  for (let i = 0; i < src.length; i++) {
    const e = src[i] & 0xff;
    if (e && e < n) dst[i] = pal[e];
  }
}

/** Tint a "mask" sheet: `src` is the colour sheet (team parts white) followed by its mask (the same size again);
 *  each pixel is multiplied by 1 + R*(main-1) + G*(dark-1) + B*(light-1), as tintPalette does per entry. */
export function tintMasked(src: Uint8ClampedArray, team: TeamCols, out: Uint8ClampedArray) {
  const [km, kd, kl] = [hex(team.main), hex(team.dark), hex(team.light)].map((c) => c.map((v) => (v - 1) / 255));
  const n = out.length;
  for (let i = 0; i < n; i += 4) {
    const a = src[i + 3];
    if (!a) continue;
    const r = src[n + i], g = src[n + i + 1], b = src[n + i + 2];
    if (r + g + b < 12) { out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2]; }
    else for (let c = 0; c < 3; c++) out[i + c] = src[i + c] * (1 + r * km[c] + g * kd[c] + b * kl[c]);
    out[i + 3] = a;
  }
}

function pixels(img: HTMLImageElement): ImageData {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  release(c); // the scratch canvas: its pixels are in d now
  return d;
}

function buildSheet(key: string, side: Side) {
  const id = `${key}|${side}`;
  if (!manifest || tinted.has(id)) return;
  const sheet = manifest.sheets[key];
  if (!sheet) return;
  tinted.set(id, { c: "loading", bytes: 0, used: clock() });
  loadImage(`${base()}atlas/${key}.webp`)
    .then((img) => {
      const src = pixels(img);
      img.src = "";
      const out = new ImageData(src.width, sheet.fmt === "mask" ? src.height >> 1 : src.height);
      // the active direction's team colours, so units match the rest of the app even before a re-render (or the
      // game's own, if its manifest says so)
      const cols = manifest!.ownTeams ? manifest!.teams[side === 0 ? "tide" : "ember"] : TEAM[side];
      if (sheet.fmt === "mask") tintMasked(src.data, cols, out.data);
      else tintIndexed(src.data, tintPalette(decodePalette(sheet.pal), cols), out.data);
      const c = document.createElement("canvas");
      c.width = out.width; c.height = out.height;
      c.getContext("2d")!.putImageData(out, 0, 0);
      const sl = tinted.get(id);
      if (!sl) { release(c); return; } // dropped while it loaded
      const bytes = c.width * c.height * 4;
      enforceBudget(bytes); // make room first, so the cache never holds more than the budget (unless all of it is in use)
      sl.c = c;
      sl.bytes = bytes;
      total += bytes;
      peak = Math.max(peak, total);
    })
    .catch(() => { const sl = tinted.get(id); if (sl) sl.c = null; });
}

/** A frame ready to draw: the source rect in `img`, the ground anchor inside it, and whether to mirror it. */
export interface Frame { img: HTMLCanvasElement; x: number; y: number; w: number; h: number; ax: number; ay: number; flip: boolean; ppu: number; }

/** The tier a body actually has art for (the highest rendered tier at or below the asked one). */
function tierFor(kind: string, tier: number): number | null {
  const u = manifest?.units[kind];
  if (!u || !u.tiers.length) return null;
  return u.tiers.includes(tier) ? tier : u.tiers.filter((x) => x <= tier).pop() ?? u.tiers[0];
}

/** Which frame of an n-frame clip a phase shows. idle and walk loop (phase 0..1). attack and cast: phase -1..0 is the
 *  wind-up before the blow (frames before `impact`), 0..1 the blow and what follows it (clamped to the last frame).
 *  death: 0..1 progress. */
export function clipIndex(anim: Anim, n: number, phase: number, impact = 0): number {
  if (anim === "idle" || anim === "walk") return Math.min(n - 1, Math.floor((((phase % 1) + 1) % 1) * n));
  if ((anim === "attack" || anim === "cast") && impact > 0 && impact < n) {
    if (phase < 0) return Math.max(0, Math.min(impact - 1, Math.floor((1 + phase) * impact)));
    return Math.min(n - 1, impact + Math.floor(Math.min(0.999, phase) * (n - impact)));
  }
  return Math.min(n - 1, Math.floor(Math.max(0, Math.min(0.999, phase)) * n));
}

/**
 * The frame of `anim` for a body, or null if its sheet isn't loaded (yet). `phase`: see clipIndex. `dir` is the
 * 8-way screen facing from Camera.facing8 (0 = right, 2 = towards the camera, 6 = away); the manifest maps it to a
 * rendered facing, mirrored for 3, 4 and 5. A body without the asked clip (cast) plays its attack instead.
 */
export function frame(kind: string, tier: number, side: Side, anim: Anim, phase: number, dir: number): Frame | null {
  if (!manifest) return null;
  const t = tierFor(kind, tier);
  if (t == null) return null;
  let key = `${kind}_t${t}`;
  if (!manifest.sheets[key]) return null;
  const now = clock();
  // sheets age out of "recent" while nothing new is built: re-check the budget a few times a second
  if (total > budget && now - lastEnforce > 250) enforceBudget();
  const sl = tinted.get(`${key}|${side}`);
  if (sl === undefined) buildSheet(key, side);
  else sl.used = now;
  let tc = sl?.c;
  if (!tc || tc === "loading") {
    // While a newly reached tier tints (or rebuilds after an eviction), keep showing the highest lower tier that is ready.
    tc = undefined;
    for (const lt of manifest.units[kind].tiers.filter((x) => x < t).reverse()) {
      const lo = tinted.get(`${kind}_t${lt}|${side}`);
      if (lo?.c && lo.c !== "loading") { key = `${kind}_t${lt}`; tc = lo.c; lo.used = now; break; }
    }
    if (!tc) return null;
  }
  const sheet = manifest.sheets[key];
  if (anim === "cast" && !sheet.anims.cast) anim = "attack";
  let a = sheet.anims[anim] ?? sheet.anims.idle;
  if (typeof a === "string") a = sheet.anims[a] as Rect[][];
  const [di, flip] = manifest.dir8[((dir % 8) + 8) % 8];
  const list = a[di];
  if (!list?.length) return null;
  const [x, y, w, h, ax, ay, s] = list[clipIndex(anim, list.length, phase, manifest.impact?.[anim] ?? 0)];
  return { img: tc, x, y, w, h, ax, ay, flip, ppu: manifest.ppu * (s ?? 1) };
}

/** A body's motion data: walk stride (world units per cycle at true scale, 0 if unknown), motion class and whether it
 *  has a cast clip. Defaults until the manifest has loaded. */
export function motionOf(kind: string, tier = 1): { stride: number; weight: Weight; cast: boolean } {
  const t = manifest ? tierFor(kind, tier) : null;
  const sh = t == null ? undefined : manifest!.sheets[`${kind}_t${t}`];
  return { stride: sh?.stride ?? 0, weight: sh?.weight ?? "mid", cast: !!sh?.anims.cast };
}

/** Card and menu portrait (3/4 view), or null. */
export function portrait(kind: string, tier = 1): HTMLImageElement | null {
  if (!manifest?.units[kind]) return null;
  const key = `${kind}_t${tier}`;
  if (portraits.has(key)) {
    const i = portraits.get(key)!;
    return i && i.complete && i.naturalWidth ? i : null;
  }
  const i = new Image();
  i.decoding = "async";
  i.src = `${base()}portraits/${key}.png`;
  i.onerror = () => portraits.set(key, null);
  portraits.set(key, i);
  return null;
}

/** Resolves when a portrait has loaded (or failed). */
export function whenPortrait(kind: string, tier = 1): Promise<HTMLImageElement | null> {
  return loadSprites().then(() => new Promise((res) => {
    const p = portrait(kind, tier);
    if (p) return res(p);
    const i = portraits.get(`${kind}_t${tier}`);
    if (!i) return res(null);
    i.addEventListener("load", () => res(i), { once: true });
    i.addEventListener("error", () => res(null), { once: true });
  }));
}

/** Warm one team's atlases for a set of kinds at the given tiers (all rendered tiers when omitted). A call starts the
 *  battle or screen being set up (calls within SCENE_GAP_MS of each other are one screen's; a later call releases the
 *  previous screen's pins and lets its sheets go first). With pin (the default) the budget never evicts these sheets
 *  while the screen lasts: pin what is actually on the board; warm a whole roster with pin: false. */
export function preload(kinds: string[], side: Side, tiers?: number[], opts: { pin?: boolean } = {}) {
  if (!manifest) return;
  const now = clock();
  if (now - pinAt > SCENE_GAP_MS) { pins = new Set(); sceneStart = now; }
  pinAt = now;
  for (const k of kinds) {
    const u = manifest.units[k];
    if (!u) continue;
    for (const t of tiers ? [...new Set(tiers.map((x) => tierFor(k, x)!))] : u.tiers) {
      const key = `${k}_t${t}`;
      if (opts.pin !== false) pins.add(`${key}|${side}`);
      buildSheet(key, side);
    }
  }
  enforceBudget();
}

const heights = new Map<string, number>();
/** How far the idle sprite rises above its ground anchor, in world units at true scale (0 if unknown). */
export function spriteHeight(kind: string, tier: number): number {
  if (!manifest) return 0;
  const t = tierFor(kind, tier);
  if (t == null) return 0;
  const key = `${kind}_t${t}`;
  let h = heights.get(key);
  if (h === undefined) {
    const a = manifest.sheets[key]?.anims.idle;
    h = Array.isArray(a) ? Math.max(0, ...a.flat().map((r) => r[5])) / manifest.ppu : 0;
    heights.set(key, h);
  }
  return h;
}
