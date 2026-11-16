// Commander keeps: one Blender-rendered keep per side (art/keeps/render_keeps.py -> public/keeps), sitting behind
// its deploy zone. The damage state follows the commander's shown hp over max hp, so the keep breaks up as the
// health bar drains. Geometry here is pure (used by the assault and tests); images load lazily like the sprites.
import { H, W, type Side } from "@engine/core/defs";

export type KeepState = "intact" | "cracked" | "burning" | "ruined";
export const KEEP_STATES: KeepState[] = ["intact", "cracked", "burning", "ruined"];
/** Every rendered image: the four damage states plus the rubble left once a commander is defeated. */
export type KeepArt = KeepState | "fallen";
export const KEEP_ARTS: KeepArt[] = [...KEEP_STATES, "fallen"];

export interface KeepManifest {
  ppu: number; w: number; h: number;
  anchors: { ground: [number, number]; gate: [number, number]; top: [number, number]; pole?: [number, number]; fires: [number, number][]; smoke: [number, number][] };
}

/** What the renderer ships with (public/keeps/manifest.json); used for geometry before the fetch lands. */
const DEFAULT: KeepManifest = {
  ppu: 128, w: 372, h: 380,
  anchors: {
    ground: [188.5, 246.1], gate: [188.5, 293.8], top: [188.5, 125.0], pole: [188.5, 33.9],
    fires: [[194.9, 136.0], [134.7, 228.8], [299.8, 169.5], [233.3, 258.2]],
    smoke: [[188.5, 194.7], [124.5, 251.3], [265.3, 226.7]],
  },
};

/** Drawn at true scale: big enough to own the end of the board, still clear of the lanes either side (it has no
 *  collision, and it goes see-through when a body walks behind it). */
export const KEEP_SCALE = 1.08;
/** Half-extents of the keep's plinth on the board, world units (for attacker slots and the see-through test). */
export const KEEP_RX = 1.22;
export const KEEP_RY = 0.74;
/** How far the keep rises above its ground anchor, world units (the flag tip). */
export const KEEP_TALL = 2.0;

/** The keep's ground anchor (centre of its footprint) on the board. */
export function keepAnchor(side: Side): { x: number; y: number } {
  return side === 0 ? { x: W / 2, y: H - 0.6 } : { x: W / 2, y: 1.55 };
}

/** The damage state for a commander at hp / max hp. Intact above 70%; cracked (stones out, banners torn) to 45%;
 *  burning (roof caved in, smoking) to 20%; then ruined. */
export function keepState(frac: number): KeepState {
  return frac > 0.7 ? "intact" : frac > 0.45 ? "cracked" : frac > 0.2 ? "burning" : "ruined";
}

/** Where a blow from (fx, fy) lands on the keep's wall: on the side facing the attacker, partway up the tower. */
export function keepHitPoint(side: Side, fx: number, fy: number): { x: number; y: number } {
  const k = keepAnchor(side);
  const g = KEEP_SCALE / 0.8; // the offsets were set for the keep at 0.8 scale
  const cx = k.x, cy = k.y - 0.55 * g;
  const dx = fx - cx, dy = fy - cy, d = Math.hypot(dx, dy) || 1;
  return { x: cx + (dx / d) * 0.6 * g, y: cy + (dy / d) * 0.38 * g };
}

/** A manifest anchor (image pixels) as a board position. */
export function keepPoint(side: Side, px: [number, number], m: KeepManifest = manifest ?? DEFAULT): { x: number; y: number } {
  const k = keepAnchor(side), g = m.anchors.ground, u = KEEP_SCALE / m.ppu;
  return { x: k.x + (px[0] - g[0]) * u, y: k.y + (px[1] - g[1]) * u };
}

/** True when a body at (x, y) stands behind the keep's solid tower (not just its flag or the plinth's flanks),
 *  so the keep should go see-through. Kept tight so the keep only fades when it would really hide someone. */
export function behindKeep(side: Side, x: number, y: number, r = 0.3): boolean {
  const k = keepAnchor(side);
  return Math.abs(x - k.x) < KEEP_RX * 0.72 + r * 0.5 && y < k.y - 0.2 && y > k.y - KEEP_TALL * 0.82;
}

// ------------------------------------------------------------ art
let manifest: KeepManifest | null = null;
let loading: Promise<void> | null = null;
const images = new Map<string, HTMLImageElement>();
const base = () => (import.meta as any).env?.BASE_URL ?? "./";
const teamName = (s: Side) => (s === 0 ? "tide" : "ember");

export function keepManifest(): KeepManifest { return manifest ?? DEFAULT; }

/** Fetches the manifest and starts every state image loading (two teams, five images each; the boss variant loads
 *  on first use). */
export function loadKeeps(): Promise<void> {
  if (loading) return loading;
  loading = fetch(`${base()}keeps/manifest.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => { manifest = m ?? DEFAULT; })
    .catch(() => { manifest = DEFAULT; })
    .then(() => {
      for (const s of [0, 1] as Side[]) for (const st of KEEP_ARTS) keepImage(s, st);
    });
  return loading;
}

/** The image file for a side's keep in a state; the rival's keep on a boss level is the crowned variant. */
export function keepFile(side: Side, state: KeepArt, boss = false): string {
  return `${teamName(side)}${boss && side === 1 ? "_boss" : ""}_${state}.webp`;
}

/** The image for a keep state once loaded, else null (the board then draws nothing for the keep). A boss keep
 *  falls back to the plain one until its own image has loaded. [skins] `skin` dresses the player's keep (side 0)
 *  in a cosmetic skin; it falls back to the default keep until the skin's image has loaded, and for good if it fails. */
export function keepImage(side: Side, state: KeepArt, boss = false, skin?: string | null): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  if (boss && side === 1) return loadImage(keepFile(side, state, true)) ?? loadImage(keepFile(side, state));
  const sf = side === 0 ? skinFile(skin, state) : null;
  if (sf) {
    preloadSkin(skin!);
    const im = loadImage(sf);
    if (im) return im;
  }
  return loadImage(keepFile(side, state));
}

// ------------------------------------------------------------ [skins] cosmetic keep skins
/** The default keep skin (the plain Sunlit Meadow keep, public/keeps/tide_*). */
export const DEFAULT_SKIN = "keep:meadow";
/** A skin's art folder name ("keep:frost" -> "frost"), or null for the default keep and anything unknown. */
export function skinName(skin: string | null | undefined): string | null {
  if (!skin || skin === DEFAULT_SKIN || !/^keep:[a-z]+$/.test(skin)) return null;
  return skin.slice(5);
}
/** A skin's image for a state, relative to public/keeps (null: the default keep). Same canvas and anchors as the
 *  default keep (art/keeps/render_keeps.py --skin), so it swaps in place. */
export function skinFile(skin: string | null | undefined, state: KeepArt): string | null {
  const n = skinName(skin);
  return n ? `skins/${n}/${state}.webp` : null;
}
/** The URL of the player's keep in a skin and state, for the UI (the default keep for the default skin). */
export function keepSkinUrl(skin: string | null | undefined, state: KeepArt = "intact"): string {
  return `${base()}keeps/${skinFile(skin, state) ?? keepFile(0, state)}`;
}
const preloaded = new Set<string>();
/** Starts every state of a skin loading (so the collapse's rubble is ready when the keep falls). */
export function preloadSkin(skin: string) {
  if (preloaded.has(skin) || typeof Image === "undefined") return;
  preloaded.add(skin);
  for (const st of KEEP_ARTS) { const f = skinFile(skin, st); if (f) loadImage(f); }
}
/** True once a skin image failed to load (the board then keeps the default keep). */
export function skinFailed(skin: string, state: KeepArt = "intact"): boolean {
  const f = skinFile(skin, state);
  return !!f && failed.has(f);
}
const failed = new Set<string>();

/** A skin's ambient motes drifting off the player's keep in battle: snow, embers, gold glints, ghost lights, petals. */
export interface SkinMote {
  /** Motes a second. */
  rate: number;
  colors: string[];
  kind: "dot" | "spark" | "plus" | "chunk";
  size: number; max: number; gravity: number; vz: number; speed: number; drag: number; spin?: number;
}
const MOTES: Record<string, SkinMote> = {
  frost: { rate: 6, colors: ["#ffffff", "#e2f6ff", "#bfe9ff"], kind: "dot", size: 0.065, max: 2.2, gravity: 0.5, vz: 0.1, speed: 0.25, drag: 0.6 },
  ember: { rate: 7, colors: ["#ffb347", "#ff7a1f", "#ffe08a"], kind: "spark", size: 0.05, max: 1.3, gravity: -1.3, vz: 1, speed: 0.3, drag: 1 },
  gilded: { rate: 4, colors: ["#fff6cc", "#ffd84d"], kind: "plus", size: 0.09, max: 0.9, gravity: 0, vz: 0.15, speed: 0.08, drag: 2 },
  shadow: { rate: 4, colors: ["#7dffd0", "#b48cff"], kind: "dot", size: 0.07, max: 2.1, gravity: -0.45, vz: 0.4, speed: 0.2, drag: 0.8 },
  blossom: { rate: 5, colors: ["#ffc6db", "#f6a3c2", "#fff0f6"], kind: "chunk", size: 0.06, max: 2.4, gravity: 0.6, vz: 0.25, speed: 0.55, drag: 0.7, spin: 5 },
};
/** The motes for a skin (null for the default keep and unknown skins). */
export const skinMotes = (skin: string | null | undefined): SkinMote | null => { const n = skinName(skin); return n ? MOTES[n] ?? null : null; };
let debugState: KeepState | null = null;
/** Debug only (?keepstate= for review shots): pins the player's keep to a damage state. */
export function setKeepStateDebug(s: string | null) { debugState = (KEEP_STATES as string[]).includes(s ?? "") ? (s as KeepState) : null; }
export const keepStateDebug = () => debugState;

function loadImage(file: string): HTMLImageElement | null {
  const key = file;
  let i = images.get(key);
  if (!i) {
    i = new Image();
    i.decoding = "async";
    i.onerror = () => { failed.add(file); }; // [skins]
    i.src = `${base()}keeps/${file}`;
    images.set(key, i);
  }
  return i.complete && i.naturalWidth ? i : null;
}

// ------------------------------------------------------------ hit, collapse and victory beats (pure timing)
/** The keep's own squash on a blow, t seconds after it, with strength k (0.5 a light hit .. 1.4 a big one):
 *  it squashes down and spreads, springs up past rest, and settles in about half a second. Scale about the ground. */
export function keepSquash(t: number, k = 1): { sx: number; sy: number } {
  if (!(t >= 0) || t > 0.6 || k <= 0) return { sx: 1, sy: 1 };
  const a = Math.min(1.4, k) * 0.075 * Math.exp(-t * 7.5) * Math.cos(t * 26);
  return { sx: 1 + a * 0.6, sy: 1 - a };
}

/** Seconds from a commander's defeat until the rubble has settled. */
export const COLLAPSE_TIME = 1.7;
/** When the winner's banner starts up its pole, seconds after the rival keep starts to fall, and how long it takes. */
export const RAISE_FROM = 0.75;
export const RAISE_TIME = 0.85;
/** How long the round-end assault holds for the collapse and the banner before the result screen. */
export const VICTORY_HOLD = RAISE_FROM + RAISE_TIME + 0.55;

export interface CollapsePose {
  /** 0..1 rumble on the standing keep before it goes. */
  shake: number;
  /** How far the standing keep has sunk, as a fraction of its image height. */
  sink: number;
  /** Lean of the falling keep, radians (signed by `dir`). */
  tilt: number;
  /** Opacity of the standing keep (it crumbles away as it sinks). */
  alpha: number;
  /** Opacity of the rubble image underneath. */
  rubble: number;
  /** True in the slice where the tower hits the ground (the big dust burst). */
  phase: "rumble" | "fall" | "settled";
}

/** The collapse, t seconds after the commander's hp reached zero: a short rumble, then the tower drops into its
 *  plinth with a lean, leaving the rubble. */
export function collapsePose(t: number, dir = 1): CollapsePose {
  const RUMBLE = 0.32, FALL = 0.85;
  if (t < RUMBLE) return { shake: Math.max(0, t / RUMBLE), sink: 0, tilt: 0, alpha: 1, rubble: 0, phase: "rumble" };
  const u = Math.min(1, (t - RUMBLE) / FALL);
  if (u < 1) {
    const e = u * u; // accelerates down
    return { shake: 1 - u * 0.5, sink: e * 0.55, tilt: dir * e * 0.09, alpha: 1 - Math.max(0, (u - 0.55) / 0.45), rubble: Math.min(1, u * 2.5), phase: "fall" };
  }
  return { shake: 0, sink: 0.55, tilt: 0, alpha: 0, rubble: 1, phase: "settled" };
}

/** How far up its pole the winner's banner is, 0..1 (with a little overshoot), t seconds after the rival fell. */
export function bannerRaise(t: number): number {
  const u = (t - RAISE_FROM) / RAISE_TIME;
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  // ease out with a small overshoot (back-out)
  const c = 1.6, v = u - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
}

/** The winner's banner run up a pole over its keep: a gold-tipped pole and a big swallowtail in team colour that
 *  waves as it climbs. (x, y) is the pole's foot on screen, `len` its height in pixels, `raise` 0..1. */
export function drawVictoryBanner(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, raise: number, t: number, col: { main: string; dark: string; light: string }, gold: string, ink: string) {
  if (raise <= 0) return;
  const lw = Math.max(1.5, len * 0.045);
  const grow = Math.min(1, raise * 3); // the pole shoots up first, then the cloth climbs it
  const top = y - len * grow;
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = ink; ctx.lineWidth = lw + 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top); ctx.stroke();
  ctx.strokeStyle = "#7a4b2a"; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top); ctx.stroke();
  ctx.fillStyle = gold; ctx.strokeStyle = ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, top, lw * 1.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // the cloth: climbs from the foot to the top of the pole
  const fh = len * 0.42, fw = len * 0.62;
  const fy = y - fh - (len - fh - lw * 1.5) * Math.max(0, Math.min(1.08, raise));
  const wave = (k: number) => Math.sin(t * 7 - k * 3.2) * fh * 0.09 * k;
  const pts: [number, number][] = [];
  const N = 6;
  for (let i = 0; i <= N; i++) { const k = i / N; pts.push([x + fw * k, fy + wave(k)]); }
  pts.push([x + fw * 0.74, fy + fh * 0.5 + wave(0.74)]);
  for (let i = N; i >= 0; i--) { const k = i / N; pts.push([x + fw * k, fy + fh + wave(k)]); }
  const path = () => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); };
  ctx.lineJoin = "round";
  path(); ctx.fillStyle = col.main; ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.stroke();
  // a darker lower band, a gold stripe and a gold diamond emblem
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = col.dark; ctx.globalAlpha = 0.55;
  ctx.fillRect(x, fy + fh * 0.72, fw, fh);
  ctx.globalAlpha = 1;
  ctx.fillStyle = col.light; ctx.globalAlpha = 0.35;
  ctx.fillRect(x, fy, fw, fh * 0.16);
  ctx.restore();
  ctx.fillStyle = gold; ctx.strokeStyle = ink; ctx.lineWidth = 2;
  const ex = x + fw * 0.34, ey = fy + fh * 0.5 + wave(0.34), er = fh * 0.24;
  ctx.beginPath(); ctx.moveTo(ex, ey - er); ctx.lineTo(ex + er * 0.75, ey); ctx.lineTo(ex, ey + er); ctx.lineTo(ex - er * 0.75, ey); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
