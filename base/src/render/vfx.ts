// Sprite-sheet VFX: the atlas painted by art/vfx/make_vfx.py (public/vfx/atlas.png + atlas.json), gradient-map tinting,
// and the table that turns every battle event in docs/EVENTS.md into effects on an Fx. Pure apart from the loader and
// the tint cache, so tests can drive playEvent() with a manifest read from disk.
import type { BattleEvent } from "@engine/core/battle";
import { bodyDef, type BodyKind, type Side } from "@engine/core/defs";
import { Fx, frand } from "./fx";
import { GOLD, HEAL, TEAM, VIOLET, ZAP } from "./palette";

export interface VfxSheet {
  x: number; y: number; w: number; h: number;
  frames: number; cols: number; gap: number;
  /** Painted in greyscale: gradient-mapped dark -> tint -> white when drawn with a tint. */
  tint: boolean;
  blend: "normal" | "add";
  /** Where (x, y) sits in the frame, 0..1. */
  anchor: [number, number];
}
export interface VfxManifest { version: number; image: string; w: number; h: number; sheets: Record<string, VfxSheet>; }

let manifest: VfxManifest | null = null;
let atlas: HTMLImageElement | null = null;
let loading: Promise<void> | null = null;
const tints = new Map<string, HTMLCanvasElement | null>();

const base = () => (import.meta as any).env?.BASE_URL ?? "./";

/** Fetch the atlas once. Until it is ready the board falls back to its drawn effects. */
export function loadVfx(): Promise<void> {
  if (loading) return loading;
  if (typeof fetch === "undefined" || typeof Image === "undefined") return (loading = Promise.resolve());
  loading = fetch(`${base()}vfx/atlas.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((m: VfxManifest | null) => new Promise<void>((res) => {
      if (!m) return res();
      const i = new Image();
      i.decoding = "async";
      i.onload = () => { manifest = m; atlas = i; res(); };
      i.onerror = () => res();
      i.src = `${base()}vfx/${m.image}`;
    }))
    .catch(() => undefined);
  return loading;
}

/** Tests: use a manifest without an image (playEvent only needs the sheet list). */
export function setVfxManifest(m: VfxManifest | null) { manifest = m; tints.clear(); }
export const vfxManifest = () => manifest;
export const vfxSheet = (name: string): VfxSheet | undefined => manifest?.sheets[name];
/** True once the atlas image can be drawn. */
export const vfxReady = () => !!(manifest && atlas && atlas.complete && atlas.naturalWidth);

/** Source rectangle of frame f of a sheet within its source image. */
export function frameRect(sh: VfxSheet, f: number, local = false): [number, number] {
  const c = f % sh.cols, r = Math.floor(f / sh.cols);
  return [(local ? 0 : sh.x) + c * (sh.w + sh.gap), (local ? 0 : sh.y) + r * (sh.h + sh.gap)];
}

/** Parse "#rgb", "#rrggbb" or "rgb(a)(...)" into [r, g, b, a] (0..255, alpha 0..1). */
export function parseColor(c: string): [number, number, number, number] {
  if (c[0] === "#") {
    const h = c.length === 4 ? c.slice(1).split("").map((x) => x + x).join("") : c.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = c.match(/[\d.]+/g)?.map(Number) ?? [255, 255, 255];
  return [m[0] ?? 255, m[1] ?? 255, m[2] ?? 255, m[3] ?? 1];
}

/** Gradient map used for tinted sheets: lum 0 -> black, 0.7 -> tint, 1 -> white. */
export function gradientMap(lum: number, t: [number, number, number]): [number, number, number] {
  if (lum < 0.7) { const k = lum / 0.7; return [t[0] * k, t[1] * k, t[2] * k]; }
  const k = (lum - 0.7) / 0.3;
  return [t[0] + (255 - t[0]) * k, t[1] + (255 - t[1]) * k, t[2] + (255 - t[2]) * k];
}

export interface FrameSource { img: CanvasImageSource; sx: number; sy: number; sh: VfxSheet; }

/** The image and source corner to draw frame f of `name`, gradient-mapped to `tint` when the sheet is tintable. */
export function vfxFrame(name: string, f: number, tint?: string): FrameSource | null {
  if (!vfxReady()) return null;
  const sh = manifest!.sheets[name];
  if (!sh) return null;
  f = Math.max(0, Math.min(sh.frames - 1, f | 0));
  if (!tint || !sh.tint) { const [sx, sy] = frameRect(sh, f); return { img: atlas!, sx, sy, sh }; }
  const [r, g, b] = parseColor(tint);
  const key = `${name}|${r},${g},${b}`;
  let c = tints.get(key);
  if (c === undefined) {
    c = makeTint(sh, [r, g, b]);
    if (tints.size > 160) tints.delete(tints.keys().next().value!);
    tints.set(key, c);
  }
  if (!c) { const [sx, sy] = frameRect(sh, f); return { img: atlas!, sx, sy, sh }; }
  const [sx, sy] = frameRect(sh, f, true);
  return { img: c, sx, sy, sh };
}

function makeTint(sh: VfxSheet, t: [number, number, number]): HTMLCanvasElement | null {
  try {
    const rows = Math.ceil(sh.frames / sh.cols);
    const w = sh.cols * (sh.w + sh.gap) - sh.gap, h = rows * (sh.h + sh.gap) - sh.gap;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(atlas!, sh.x, sh.y, w, h, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const [r, gg, b] = gradientMap(p[i] / 255, t);
      p[i] = r; p[i + 1] = gg; p[i + 2] = b;
    }
    g.putImageData(d, 0, 0);
    return c;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ what each persistent field draws
/** Sheets the board draws every frame from body and battle state (docs/EVENTS.md "Body fields" and "Battle fields"). */
export const FIELD_VFX = {
  burrowed: ["mound", "divot"],
  flying: ["shadow"],
  slow: ["chill"],
  frozen: ["ice", "icebreak"],
  braced: ["glint"],
  buff: ["aura"],
  rally: ["aura", "rally"],
  parryCd: ["glint"],
  stun: ["glint"],
  fury: ["rage"],
  zones: ["scorch", "flame"],
  fuses: ["bomb", "keg"],
  build: ["gear"],
} as const;

/** Projectile kind -> sprite (all face +x) and whether it trails a streak. */
export const PROJ_VFX: Record<string, { sheet: string; size: number; trail?: boolean }> = {
  // Sized to read on a phone: an arrow is ~8 px thick at the board's middle on a 390 pt screen, a shell ~20 px.
  arrow: { sheet: "arrow", size: 0.2, trail: true },
  bolt: { sheet: "bolt", size: 0.27, trail: true },
  shard: { sheet: "shard", size: 0.25, trail: true },
  grenade: { sheet: "bomb", size: 0.38 },
  shell: { sheet: "shell", size: 0.46 },
  pellet: { sheet: "pellet", size: 0.2 },
};

// ------------------------------------------------------------------ events -> effects
export interface VfxEnv {
  /** A body by id (alive or not), for beams and facing. */
  find(id: number): { x: number; y: number; kind: BodyKind; face: number; radius: number; side: Side; alive: boolean } | undefined;
  /** Bodies on the field (end-of-battle flourishes). */
  bodies?: readonly { x: number; y: number; kind: BodyKind; side: Side; alive: boolean; radius: number }[];
  /** Battle time now (bomblet flights). */
  time: number;
  /** Atlas drawn: skip the old vector-only primitives that the sheets replace. */
  textured: boolean;
  sound?(name: string, gain?: number): void;
  /** Camera kick for the biggest blasts. */
  kick?(amount: number): void;
  /** World height of a body above the ground (a flyer's altitude, 0 on foot), so its hits play where it is drawn. */
  lift?(id: number): number;
}

const RADIUS = (k: BodyKind): number => bodyDef(k)?.radius ?? 0.3;
const ICE = "#bfe9ff";
const DIRT = "rgba(120,92,60,0.9)";
const DUST = "#d6c3a0";
const STEEL = "#bcd6ff";
const STRUCT = new Set(["turret", "mine", "decoy"]);

/** Events that play at one body's position (its id): their sparks, flashes and debris rise with a flyer. */
const AT_BODY = new Set<BattleEvent["t"]>(["hit", "shot", "parry", "freeze"]);

/** Drop a few sheets plus the debris particles for one event. A hit on a flyer plays at the flyer's height, not at
 *  its feet, so it never sits on the ground under the bodies standing there. */
export function playEvent(fx: Fx, e: BattleEvent, env: VfxEnv) {
  const lift = AT_BODY.has(e.t) && "id" in e ? env.lift?.(e.id) ?? 0 : 0;
  if (lift <= 0) return playAt(fx, e, env);
  const a0 = fx.anims.length, p0 = fx.parts.length, f0 = fx.floats.length;
  playAt(fx, e, env);
  for (let i = a0; i < fx.anims.length; i++) if (fx.anims[i].layer === "air" && !fx.anims[i].path) fx.anims[i].z += lift;
  for (let i = p0; i < fx.parts.length; i++) fx.parts[i].z += lift;
  for (let i = f0; i < fx.floats.length; i++) fx.floats[i].z = (fx.floats[i].z ?? 0) + lift;
}

function playAt(fx: Fx, e: BattleEvent, env: VfxEnv) {
  const snd = (n: string, g = 0.5) => env.sound?.(n, g);
  switch (e.t) {
    case "slash": {
      const tint = e.side === 0 ? TEAM[0].main : TEAM[1].main;
      if (e.spin) {
        fx.anim("spin", e.x, e.y, { size: (2 * e.r) / 0.95, max: 0.32, tint, a: frand(0, 6.28) });
        fx.anim("dust", e.x, e.y, { size: e.r * 2.2, max: 0.4, tint: DUST, layer: "ground", alpha: 0.6 });
        if (!env.textured) fx.ring(e.x, e.y, e.r * 0.4, e.r, 0.22, e.side === 0 ? "#e9fffd" : "#fff0ea", 0.1);
        snd("slash", 0.6);
      } else {
        fx.anim("slash", e.x, e.y, { size: (2 * e.r) / 0.95, max: 0.2, tint, a: e.a });
        if (!env.textured) fx.arc(e.x, e.y, e.a, e.r, e.side === 0 ? "#e9fffd" : "#fff0ea", 2.0, 0.16);
      }
      snd("slash", 0.35);
      break;
    }
    case "shot": {
      const b = env.find(e.id);
      const a = b?.face ?? 0;
      const mx = e.x + Math.cos(a) * (b?.radius ?? 0.3), my = e.y + Math.sin(a) * (b?.radius ?? 0.3);
      if (e.kind === "grenade" || e.kind === "shell" || e.kind === "bolt") {
        fx.anim("flash", mx, my, { size: e.kind === "shell" ? 0.9 : 0.6, max: 0.14, tint: "#ffd9a0", z: 0.2 });
        fx.anim("smoke", mx, my, { size: e.kind === "shell" ? 0.8 : 0.5, max: 0.5, tint: "#d9d2c8", z: 0.2, vx: Math.cos(a) * 0.4, vy: Math.sin(a) * 0.4, alpha: 0.85 });
      } else if (e.kind === "shard") {
        fx.anim("frost", mx, my, { size: 0.55, max: 0.3, z: 0.2 });
      } else if (e.kind === "pellet") {
        fx.anim("flash", mx, my, { size: 0.4, max: 0.1, tint: GOLD, z: 0.15 });
      } else {
        fx.anim("streak", mx, my, { size: 0.12, max: 0.12, a, tint: "#ffffff", z: 0.2, alpha: 0.7 });
      }
      snd(e.kind === "grenade" || e.kind === "shell" ? "throw" : e.kind === "bolt" ? "bolt" : e.kind === "shard" ? "zap" : "arrow", e.kind === "shard" ? 0.2 : 0.4);
      break;
    }
    case "hit": {
      const col = e.shielded ? "#cfd8e3" : TEAM[(1 - e.side) as Side].light;
      if (e.shielded) {
        fx.anim("shield", e.x, e.y, { size: e.big ? 1.2 : 0.9, max: 0.28, tint: STEEL, z: 0.15 });
        fx.anim("spark", e.x, e.y, { size: 0.5, max: 0.16, tint: "#dfe8f2", a: frand(0, 6.28), z: 0.2 });
      } else {
        fx.anim("spark", e.x, e.y, { size: e.big ? 0.95 : 0.6, max: 0.2, tint: TEAM[(1 - e.side) as Side].main, a: frand(0, 6.28), z: 0.2 });
        if (e.big) fx.anim("impact", e.x, e.y, { size: 0.9, max: 0.3, tint: GOLD, a: frand(0, 6.28), z: 0.2 });
      }
      fx.burst(e.x, e.y, e.big ? 7 : 3, { color: col, speed: 2.2, size: 0.05, max: 0.3, gravity: 0, kind: "spark" });
      if (e.big) fx.float(e.x, e.y - 0.45, `${e.dmg}!`, GOLD, 0.34, 0.9, "crit");
      else if (e.dmg >= 18) fx.float(e.x, e.y - 0.45, String(e.dmg), e.shielded ? "#b9c6d4" : "#ffffff", 0.27, 0.75, "dmg");
      snd(e.shielded ? "clank" : "hit", e.big ? 0.6 : 0.25);
      break;
    }
    case "boom": playBoom(fx, e.x, e.y, e.r, e.kind, e.side, env); break;
    case "zap":
      if (env.textured) {
        // One stretched lightning strip per jump, flickering through its frames.
        for (let i = 1; i < e.pts.length; i++) {
          const [x0, y0] = e.pts[i - 1], [x1, y1] = e.pts[i];
          const len = Math.hypot(x1 - x0, y1 - y0);
          if (len < 0.05) continue;
          fx.anim("zap", (x0 + x1) / 2, (y0 + y1) / 2, { size: 0.5, w: len * 1.08, a: Math.atan2(y1 - y0, x1 - x0), max: 0.28, loop: 24, tint: "#8fc4ff", z: 0.25, fadeOut: 0.12 });
        }
      } else fx.bolt(e.pts, ZAP, 0.26);
      for (const [x, y] of e.pts.slice(1)) {
        fx.anim("flash", x, y, { size: 0.9, max: 0.22, tint: "#8fc4ff", z: 0.2 });
        fx.anim("spark", x, y, { size: 0.6, max: 0.2, tint: "#cfe8ff", a: frand(0, 6.28), z: 0.2 });
        fx.burst(x, y, 4, { color: "#dff1ff", speed: 2.4, size: 0.04, max: 0.25, kind: "spark", gravity: 0 });
      }
      fx.flash = Math.max(fx.flash, 0.08); fx.flashColor = "#cfe8ff";
      snd("zap", 0.6);
      break;
    case "heal": {
      const from = env.find(e.from);
      if (e.from === e.to) {
        // Bloodlust: the ravager feeds on its own blow.
        fx.anim("rage", e.x, e.y, { size: 1.3, max: 0.5, tint: "#ff3b3b", fadeOut: 0.2 });
        fx.burst(e.x, e.y, 2, { color: "#ff8a8a", speed: 0.6, size: 0.1, max: 0.7, kind: "plus", gravity: -1.2, drag: 3, z: 0.2 });
      } else if (from?.kind === "banner") {
        // Rally pulse from the Standard Bearer.
        fx.anim("rally", e.x, e.y, { size: 1.0, max: 0.7, tint: GOLD });
        fx.burst(e.x, e.y, 2, { color: GOLD, speed: 0.6, size: 0.09, max: 0.7, kind: "plus", gravity: -1.2, drag: 3, z: 0.2 });
      } else {
        if (from) fx.beam(from.x, from.y, e.x, e.y, HEAL, 0.06, 0.28);
        fx.anim("heal", e.x, e.y, { size: 1.2, max: 0.75 });
        fx.burst(e.x, e.y, 3, { color: HEAL, speed: 0.6, size: 0.1, max: 0.7, kind: "plus", gravity: -1.2, drag: 3, z: 0.2 });
      }
      if (e.amt >= 8) fx.float(e.x, e.y - 0.4, `+${e.amt}`, "#7dff9a", 0.25, 0.8, "heal");
      snd("heal", 0.2);
      break;
    }
    case "spawn": {
      const small = e.kind === "mite";
      const tint = e.kind === "thrall" ? "#9dffb8" : e.kind === "turret" ? GOLD : e.kind === "decoy" ? VIOLET : TEAM[e.side].main;
      fx.anim("pillar", e.x, e.y, { size: small ? 0.7 : 1.4, max: 0.5, tint });
      fx.anim("dust", e.x, e.y, { size: small ? 0.6 : 1.1, max: 0.4, tint: DUST, layer: "ground", alpha: 0.7 });
      if (!env.textured) fx.ring(e.x, e.y, 0.05, 0.35, 0.25, TEAM[e.side].light, 0.04);
      break;
    }
    case "death": {
      const col = TEAM[e.side].main;
      const r = RADIUS(e.kind);
      if (e.kind === "mite") {
        fx.anim("goo", e.x, e.y, { size: 0.8, max: 0.4 });
      } else if (e.kind === "keg") {
        fx.anim("smoke", e.x, e.y, { size: 1.0, max: 0.8, tint: "#5a5458" });
        fx.burst(e.x, e.y, 10, { color: "rgba(80,80,80,0.7)", speed: 1, size: 0.2, max: 0.9, kind: "smoke", gravity: 0 });
      } else {
        fx.anim("impact", e.x, e.y, { size: Math.max(0.8, r * 2.8), max: 0.18, tint: "#ffffff", a: frand(0, 6.28), z: 0.35 });
        fx.anim("dust", e.x, e.y, { size: Math.max(1, r * 3.6), max: 0.5, tint: DUST, layer: "ground", alpha: 0.7 });
        fx.burst(e.x, e.y, 5, { color: "#d9cdb8", speed: 1.6, size: 0.06, max: 0.55, kind: "chunk", vz: 3.5, spin: 10 });
        fx.anim("smoke", e.x, e.y, { size: Math.max(0.9, r * 3.4), max: 0.6, tint: "#e3e6ea", z: 0.1 });
        if (!STRUCT.has(e.kind)) fx.anim("soul", e.x, e.y, { size: Math.max(0.8, r * 2.6), max: 0.9, tint: TEAM[e.side].light, delay: 0.08 });
        else fx.anim("flash", e.x, e.y, { size: 1, max: 0.2, tint: GOLD });
        // ANIM: the body ends in a poof as it fades at the end of its death clip (board.ts: 0.45 s), never a hard cut
        fx.anim("smoke", e.x, e.y, { size: Math.max(0.75, r * 2.8), max: 0.5, tint: "#eef0f3", z: 0.06, delay: 0.28, alpha: 0.85, grow: [0.6, 1.15] });
        fx.anim("shock", e.x, e.y, { size: Math.max(0.7, r * 2.6), max: 0.3, tint: TEAM[e.side].light, layer: "ground", delay: 0.3, alpha: 0.6 });
      }
      if (!env.textured) fx.ring(e.x, e.y, r * 0.6, r * 1.8, 0.35, col, 0.05);
      fx.burst(e.x, e.y, e.kind === "mite" ? 4 : 10, { color: col, speed: 2.2, size: 0.07, max: 0.6, kind: "chunk", vz: 3, spin: 8 });
      if (e.kind === "golem") {
        fx.anim("dust", e.x, e.y, { size: 2.4, max: 0.6, tint: "#b7aea2", layer: "ground" });
        fx.anim("crack", e.x, e.y, { size: 1.8, max: 2.2, fadeOut: 0.9, layer: "ground", a: frand(0, 6.28) });
        fx.burst(e.x, e.y, 10, { color: "#8a8f99", speed: 2.6, size: 0.09, max: 0.7, kind: "chunk", vz: 4, spin: 6 });
        fx.shake = Math.min(1, fx.shake + 0.5); snd("crumble", 0.9);
      } else if (e.kind === "keg") snd("squish", 0.5);
      else snd(e.kind === "mite" ? "squish" : "down", 0.4);
      break;
    }
    case "blink":
      fx.anim("vortex", e.x0, e.y0, { size: 1.2, max: 0.35, tint: VIOLET, spin: 4 });
      fx.anim("vortex", e.x, e.y, { size: 1.2, max: 0.35, tint: VIOLET, reverse: true, spin: -4, delay: 0.04 });
      fx.burst(e.x, e.y, 6, { color: VIOLET, speed: 1.6, size: 0.16, max: 0.5, kind: "smoke", gravity: 0, drag: 2 });
      if (!env.textured) {
        fx.burst(e.x0, e.y0, 10, { color: VIOLET, speed: 1.2, size: 0.18, max: 0.5, kind: "smoke", gravity: 0, drag: 2 });
        fx.beam(e.x0, e.y0, e.x, e.y, "rgba(180,140,255,0.5)", 0.05, 0.18);
      }
      snd("blink", 0.5);
      break;
    case "charge":
      fx.anim("dust", e.x - Math.cos(e.a) * 0.3, e.y - Math.sin(e.a) * 0.3, { size: 1.1, max: 0.45, tint: DUST, layer: "ground" });
      fx.anim("streak", e.x, e.y, { size: 0.25, max: 0.25, a: e.a, tint: "#ffffff", z: 0.25, alpha: 0.8 });
      fx.burst(e.x, e.y, 6, { color: "rgba(180,160,130,0.6)", speed: 1.5, size: 0.14, max: 0.5, kind: "smoke", gravity: 0, dir: e.a + Math.PI, spread: 1.4 });
      snd("charge", 0.6);
      break;
    case "fuse":
      fx.anim("flash", e.x, e.y, { size: 1.4, max: 0.3, tint: "#ff4d4d" });
      fx.anim("glint", e.x, e.y, { size: 0.6, max: 0.3, tint: "#ff8a5c", z: 0.2 });
      fx.ring(e.x, e.y, 0.2, 1.0, 0.32, "#ff4d4d", 0.04);
      snd("fuse", 0.6);
      break;
    // ---- v2
    case "burrow":
      fx.anim("dirt", e.x, e.y, { size: 1.3, max: 0.6 });
      fx.anim("divot", e.x, e.y, { size: 0.7, max: 1.6, fadeOut: 0.8, layer: "ground" });
      fx.burst(e.x, e.y, 8, { color: DIRT, speed: 1.8, size: 0.08, max: 0.6, kind: "chunk", vz: 3, spin: 6 });
      snd("slam", 0.3);
      break;
    case "dig":
      fx.anim("divot", e.x, e.y, { size: 0.42, max: 1.4, fadeOut: 0.9, layer: "ground", a: frand(0, 6.28), alpha: 0.85 });
      fx.burst(e.x, e.y, 2, { color: DIRT, speed: 0.6, size: 0.07, max: 0.9, kind: "chunk", vz: 1.5, drag: 4 });
      if (Math.random() < 0.4) fx.burst(e.x, e.y, 1, { color: "rgba(110,85,55,0.5)", speed: 0.2, size: 0.18, max: 1.2, kind: "smoke", gravity: 0 });
      break;
    case "emerge":
      fx.anim("dirt", e.x, e.y, { size: e.big ? 2.6 : 1.6, max: 0.65 });
      fx.anim("shock", e.x, e.y, { size: (2 * e.r) / 0.94, max: 0.4, tint: "#c9a26b", layer: "ground" });
      fx.anim("dust", e.x, e.y, { size: e.r * 2, max: 0.6, tint: DUST, layer: "ground" });
      if (e.big) fx.anim("crack", e.x, e.y, { size: e.r * 2, max: 2.2, fadeOut: 0.9, layer: "ground", a: frand(0, 6.28) });
      fx.burst(e.x, e.y, e.big ? 20 : 12, { color: DIRT, speed: e.big ? 4.5 : 3, size: 0.09, max: 0.7, kind: "chunk", vz: 4, spin: 8 });
      fx.shake = Math.min(1, fx.shake + (e.big ? 0.6 : 0.35));
      snd("slam", e.big ? 0.9 : 0.6);
      break;
    case "dive": {
      const a = Math.atan2(e.ty - e.y, e.tx - e.x);
      fx.anim("streak", e.x, e.y, { size: 0.3, max: 0.3, a, tint: "#ffffff", z: 0.9, alpha: 0.85 });
      fx.anim("glint", e.x, e.y, { size: 0.6, max: 0.25, tint: "#ffffff", z: 0.9 });
      snd("blink", 0.35);
      break;
    }
    case "soar":
      // The griffin climbs for a dive: wind and feathers, and a Second Dive flares gold.
      fx.anim("streak", e.x, e.y, { size: 0.4, max: 0.35, a: e.side === 0 ? -Math.PI / 2 : Math.PI / 2, tint: e.second ? GOLD : "#ffffff", z: 1.0, alpha: 0.85 });
      fx.burst(e.x, e.y, 8, { color: "#f3e6c8", speed: 1.6, size: 0.05, max: 0.6, kind: "chunk", vz: 2, spin: 5 });
      if (e.second) fx.ring(e.x, e.y, 0.2, 0.9, 0.35, GOLD, 0.05);
      snd("blink", 0.45);
      break;
    case "swoop":
      fx.anim("flash", e.x, e.y, { size: e.r * 1.6, max: 0.18, tint: "#fff6d6", z: 0.2 });
      fx.ring(e.x, e.y, 0.15, e.r * 1.1, 0.3, e.second ? GOLD : "#fff2d6", 0.07);
      fx.burst(e.x, e.y, 10, { color: "#f3e6c8", speed: 3, size: 0.05, max: 0.5, kind: "chunk", vz: 3, spin: 6 });
      fx.float(e.x, e.y - 0.6, "SWOOP", "#fff2d6", 0.26, 0.6);
      snd("slam", 0.8);
      break;
    case "wave": {
      const mid = (e.y0 + e.y1) / 2;
      fx.anim("dust", e.x, e.y0, { size: e.w * 1.4, max: 0.45, tint: "#9fd8f0", layer: "ground", alpha: 0.7 });
      fx.burst(e.x, e.y0, 12, { color: "#dff6ff", speed: 2.2, size: 0.05, max: 0.5, kind: "spark", gravity: 1, dir: e.y1 > e.y0 ? Math.PI / 2 : -Math.PI / 2, spread: 0.7 });
      fx.float(e.x, mid, e.surf ? "RIPTIDE" : "WAVE", "#bfeaff", 0.24, 0.6);
      snd("throw", 0.6);
      break;
    }
    case "rally":
      fx.anim("aura", e.x, e.y, { size: 2 * e.r, max: 0.6, tint: GOLD, grow: [0.25, 1], fadeOut: 0.4, alpha: 0.7, layer: "ground", spin: 1.2 });
      fx.anim("rally", e.x, e.y, { size: 1.1, max: 0.7, tint: GOLD });
      fx.float(e.x, e.y - 0.6, "RALLY", GOLD, 0.26, 0.7);
      snd("upgrade", 0.4);
      break;
    case "laststand":
      fx.anim("pillar", e.x, e.y, { size: 1.6, max: 0.7, tint: GOLD });
      fx.anim("flash", e.x, e.y, { size: 1.4, max: 0.2, tint: "#fff2b8", z: 0.3 });
      fx.burst(e.x, e.y, 14, { color: "#ffe2a0", speed: 3, size: 0.05, max: 0.5, kind: "spark", gravity: 0 });
      snd("clank", 0.9);
      break;
    case "chill":
      fx.anim("frost", e.x, e.y, { size: 0.95, max: 0.4, z: 0.1 });
      break;
    case "freeze": {
      const b = env.find(e.id);
      fx.anim("ice", e.x, e.y, { size: Math.max(0.8, (b?.radius ?? 0.35) * 3.3), max: 0.25 });
      fx.anim("frost", e.x, e.y, { size: 1.3, max: 0.45 });
      fx.anim("flash", e.x, e.y, { size: 1.2, max: 0.2, tint: ICE });
      fx.burst(e.x, e.y, 10, { color: "#e9f9ff", speed: 2.2, size: 0.06, max: 0.5, kind: "chunk", vz: 2, spin: 6 });
      snd("clank", 0.6);
      break;
    }
    case "aura": {
      const tint = e.rally ? GOLD : TEAM[e.side].main;
      fx.anim("aura", e.x, e.y, { size: 2 * e.r, max: 0.7, tint, grow: [0.25, 1], fadeOut: 0.45, alpha: 0.7, layer: "ground", spin: 0.8 });
      if (e.rally) fx.anim("rally", e.x, e.y, { size: 1.1, max: 0.7, tint: GOLD });
      break;
    }
    case "parry":
      fx.anim("parry", e.x, e.y, { size: 1.0, max: 0.26, tint: "#fff2b8", z: 0.25, a: frand(-0.3, 0.3) });
      if (e.riposte) fx.anim("impact", e.x, e.y, { size: 0.85, max: 0.3, tint: GOLD, delay: 0.08, z: 0.2 });
      fx.burst(e.x, e.y, 8, { color: "#fff6d6", speed: 3, size: 0.04, max: 0.25, kind: "spark", gravity: 0 });
      fx.float(e.x, e.y - 0.5, e.riposte ? "RIPOSTE" : "PARRY", "#fff2b8", 0.24, 0.6);
      snd("clank", 0.8);
      break;
    case "brace":
      for (const da of [-0.35, 0.35]) {
        fx.anim("glint", e.x + Math.cos(e.a + da) * 0.55, e.y + Math.sin(e.a + da) * 0.55, { size: 0.5, max: 0.3, tint: "#e8eef5", z: 0.2 });
      }
      fx.anim("dust", e.x, e.y, { size: 0.9, max: 0.35, tint: DUST, layer: "ground", alpha: 0.6 });
      fx.burst(e.x, e.y, 4, { color: "#e8eef5", speed: 1, size: 0.04, max: 0.25, kind: "spark", gravity: 0, dir: e.a, spread: 0.8 });
      snd("clank", 0.3);
      break;
    case "impale":
      fx.anim("impact", e.x, e.y, { size: 1.4, max: 0.36, tint: GOLD, a: frand(0, 6.28), z: 0.2 });
      fx.anim("spark", e.x, e.y, { size: 1.0, max: 0.22, tint: "#ffe2a0", z: 0.2 });
      fx.anim("dust", e.x, e.y, { size: 1.4, max: 0.45, tint: DUST, layer: "ground" });
      fx.burst(e.x, e.y, 12, { color: "#ffe2a0", speed: 3.5, size: 0.06, max: 0.4, kind: "spark", gravity: 1 });
      fx.float(e.x, e.y - 0.55, "IMPALED", GOLD, 0.3, 0.8);
      fx.shake = Math.min(1, fx.shake + 0.4);
      snd("clank", 1); snd("hit", 1);
      break;
    case "raise":
      fx.anim("dirt", e.x, e.y, { size: 1.0, max: 0.5 });
      fx.anim("pillar", e.x, e.y, { size: 1.5, max: 0.6, tint: "#9dffb8" });
      fx.burst(e.x, e.y, 8, { color: "rgba(150,255,190,0.55)", speed: 0.6, size: 0.14, max: 0.9, kind: "smoke", gravity: -0.6, drag: 1.5 });
      snd("blink", 0.4);
      break;
    case "build":
      fx.anim("gear", e.x, e.y, { size: 0.55, max: Math.max(0.3, e.dur), loop: 14, z: 0.7, fadeIn: 0.1, fadeOut: 0.2 });
      fx.anim("dust", e.x, e.y, { size: 0.9, max: 0.4, tint: DUST, layer: "ground", alpha: 0.6 });
      snd("clank", 0.35);
      break;
    case "repair": {
      const from = env.find(e.from);
      if (from) fx.beam(from.x, from.y, e.x, e.y, "rgba(255,200,90,0.8)", 0.05, 0.25);
      fx.anim("gear", e.x, e.y, { size: 0.36, max: 0.45, loop: 18, z: 0.6, fadeOut: 0.15 });
      fx.anim("spark", e.x, e.y, { size: 0.45, max: 0.18, tint: GOLD, z: 0.3 });
      snd("clank", 0.25);
      break;
    }
    case "decoy":
      fx.anim("vortex", e.x, e.y, { size: 1.0, max: 0.3, tint: VIOLET, reverse: true, spin: -5 });
      fx.anim("smoke", e.x, e.y, { size: 1.0, max: 0.5, tint: "#c8aaff", alpha: 0.85 });
      snd("blink", 0.4);
      break;
    case "pop":
      fx.anim("mirror", e.x, e.y, { size: 1.1, max: 0.4, tint: VIOLET, z: 0.2 });
      fx.anim("smoke", e.x, e.y, { size: 0.9, max: 0.45, tint: "#c8aaff", alpha: 0.8 });
      snd("squish", 0.5);
      break;
    case "light":
      fx.anim("glint", e.x, e.y, { size: 0.55, max: 0.3, tint: GOLD, z: 0.35 });
      fx.anim("flash", e.x, e.y, { size: 0.5, max: 0.15, tint: GOLD, z: 0.3 });
      fx.burst(e.x, e.y, 4, { color: "#ffd166", speed: 1.5, size: 0.04, max: 0.3, kind: "spark", gravity: 0 });
      snd("fuse", 0.5);
      break;
    case "kegdrop":
      fx.anim("keg", e.x, e.y, { size: 0.42, max: 0.3, loop: 16, path: { x0: e.x, y0: e.y - 0.01, x1: e.x, y1: e.y, h: 0.5 } });
      fx.anim("dust", e.x, e.y, { size: 0.8, max: 0.4, tint: DUST, layer: "ground", delay: 0.28 });
      snd("throw", 0.4);
      break;
    case "bomblets": {
      const flight = BOMBLET_FLIGHT;
      for (const [x, y] of e.pts) {
        fx.anim("bomb", 0, 0, { size: 0.3, max: flight, loop: 16, path: { x0: e.x, y0: e.y, x1: x, y1: y, h: 0.9 }, spin: 9 });
        fx.anim("dust", x, y, { size: 0.5, max: 0.3, tint: DUST, layer: "ground", delay: flight, alpha: 0.7 });
      }
      snd("throw", 0.4);
      break;
    }
    case "zone":
      if (e.kind === "surf") {
        fx.anim("dust", e.x, e.y, { size: e.r * 1.6, max: 0.4, tint: "#bfeaff", layer: "ground", alpha: 0.6 });
        fx.burst(e.x, e.y, 5, { color: "#dff6ff", speed: 1.2, size: 0.04, max: 0.4, kind: "spark", gravity: 1 });
        break;
      }
      if (e.kind === "thorn") {
        // Brambles burst out of the ground; an Ascended crown seizes whatever is standing there.
        fx.anim("dirt", e.x, e.y, { size: e.r * 1.6, max: 0.5 });
        fx.anim("dust", e.x, e.y, { size: e.r * 2, max: 0.5, tint: "#b7c48a", layer: "ground" });
        fx.burst(e.x, e.y, 10, { color: "#7f9a52", speed: 2.2, size: 0.07, max: 0.6, kind: "chunk", vz: 3, spin: 6 });
        if (e.root) {
          fx.ring(e.x, e.y, 0.2, e.r * 1.1, 0.35, "#a8d36b", 0.05);
          fx.float(e.x, e.y - 0.5, "SEIZED", "#c6e48b", 0.26, 0.7);
        }
        snd("slam", 0.35);
        break;
      }
      fx.anim("fireball", e.x, e.y, { size: e.r * 1.4, max: 0.5 });
      fx.anim("flash", e.x, e.y, { size: e.r * 1.8, max: 0.15, tint: "#ffb347" });
      snd("pop", 0.3);
      break;
    case "hook": {
      const a = Math.atan2(e.ty - e.y, e.tx - e.x);
      fx.anim("streak", e.x, e.y, { size: 0.3, max: 0.22, a, tint: "#d7dde6", z: 0.3, alpha: 0.8 });
      snd("throw", 0.5);
      break;
    }
    case "reel":
      fx.anim("impact", e.x, e.y, { size: 0.9, max: 0.28, tint: STEEL, z: 0.25, a: frand(0, 6.28) });
      fx.burst(e.x, e.y, 6, { color: "#e8eef5", speed: 2.2, size: 0.04, max: 0.25, kind: "spark", gravity: 0 });
      fx.float(e.x, e.y - 0.5, "HOOKED", "#e8eef5", 0.24, 0.6);
      snd("clank", 0.7);
      break;
    case "ward": {
      const from = env.find(e.from);
      if (from) fx.beam(from.x, from.y, e.x, e.y, "rgba(255,210,120,0.8)", 0.05, 0.25);
      fx.anim("glint", e.x, e.y, { size: 0.6, max: 0.35, tint: GOLD, z: 0.5 });
      fx.ring(e.x, e.y, 0.15, 0.55, 0.3, "#ffd27a", 0.04);
      snd("upgrade", 0.25);
      break;
    }
    case "wardbreak":
      fx.anim("flash", e.x, e.y, { size: e.burst ? 1.6 : 0.8, max: 0.2, tint: "#ffe2a0", z: 0.3 });
      fx.burst(e.x, e.y, e.burst ? 14 : 6, { color: "#ffe2a0", speed: e.burst ? 3.5 : 1.6, size: 0.05, max: 0.35, kind: "spark", gravity: 0 });
      if (e.burst) {
        fx.ring(e.x, e.y, 0.2, 1.3, 0.35, "#fff2b8", 0.06);
        fx.float(e.x, e.y - 0.55, "BEACON", "#fff2b8", 0.26, 0.7);
        snd("pop", 0.6);
      } else snd("clank", 0.3);
      break;
    case "revive":
      fx.anim("pillar", e.x, e.y, { size: 2.0, max: 0.9, tint: GOLD });
      fx.anim("aura", e.x, e.y, { size: 2.0, max: 0.8, tint: GOLD, grow: [0.2, 1], fadeOut: 0.5, layer: "ground", spin: 1.2 });
      for (let i = 0; i < 3; i++) fx.anim("glint", e.x + frand(-0.4, 0.4), e.y + frand(-0.3, 0.3), { size: 0.5, max: 0.4, tint: "#fff2b8", delay: 0.1 + i * 0.12, z: frand(0.3, 1) });
      fx.burst(e.x, e.y, 10, { color: "#fff2b8", speed: 1, size: 0.08, max: 1, kind: "plus", gravity: -1.5, drag: 2 });
      fx.float(e.x, e.y - 0.6, "REVIVED", "#fff2b8", 0.3, 1);
      snd("upgrade", 0.6);
      break;
    case "volley":
      for (const da of [-0.25, 0, 0.25]) fx.anim("streak", e.x + Math.cos(e.a + da) * 0.4, e.y + Math.sin(e.a + da) * 0.4, { size: 0.14, max: 0.16, a: e.a + da, tint: "#ffffff", z: 0.2 });
      fx.anim("flash", e.x + Math.cos(e.a) * 0.3, e.y + Math.sin(e.a) * 0.3, { size: 0.5, max: 0.12, tint: "#fff2d6", z: 0.2 });
      snd("arrow", 0.7);
      break;
    case "twin":
      for (const side of [-1, 1]) {
        const ox = e.x + Math.cos(e.a) * 0.35 + Math.cos(e.a + Math.PI / 2) * 0.15 * side;
        const oy = e.y + Math.sin(e.a) * 0.35 + Math.sin(e.a + Math.PI / 2) * 0.15 * side;
        fx.anim("flash", ox, oy, { size: 0.6, max: 0.14, tint: "#ffd9a0", z: 0.2 });
      }
      fx.anim("smoke", e.x + Math.cos(e.a) * 0.35, e.y + Math.sin(e.a) * 0.35, { size: 0.6, max: 0.45, tint: "#d9d2c8", z: 0.2, alpha: 0.8 });
      snd("bolt", 0.7);
      break;
    case "reset":
      fx.anim("glint", e.x, e.y, { size: 0.7, max: 0.4, tint: VIOLET, z: 0.4 });
      fx.anim("vortex", e.x, e.y, { size: 0.6, max: 0.3, tint: VIOLET, reverse: true });
      fx.burst(e.x, e.y, 6, { color: VIOLET, speed: 1.5, size: 0.05, max: 0.4, kind: "spark", gravity: 0 });
      break;
    case "end": {
      if (e.winner === -1) break;
      let i = 0;
      for (const b of env.bodies ?? []) {
        if (!b.alive || b.side !== e.winner || STRUCT.has(b.kind)) continue;
        fx.anim("glint", b.x + b.radius * 0.6, b.y - b.radius * 0.4, { size: 0.55, max: 0.45, tint: GOLD, z: 0.6, delay: 0.05 * i++ });
      }
      break;
    }
    default:
      break;
  }
}

/** How long a thrown bomblet flies before it sits sputtering on the ground (board.ts hides its fuse until then). */
export const BOMBLET_FLIGHT = 0.32;

export function playBoom(fx: Fx, x: number, y: number, r: number, kind: string, side: Side, env: VfxEnv) {
  const snd = (n: string, g = 0.5) => env.sound?.(n, g);
  const fiery = ["mine", "grenade", "shell", "keg", "bomblet", "shrapnel"].includes(kind);
  const big = kind === "mine" || kind === "keg" || kind === "shell" || kind === "quake";
  if (kind === "quake" || kind === "slam" || kind === "talon" || kind === "erupt" || kind === "swoop") {
    const q = kind === "quake";
    const tint = q ? "#e8d3a8" : "#c9b79c";
    fx.anim("shock", x, y, { size: (2 * r) / 0.94, max: q ? 0.55 : 0.36, tint, layer: "ground" });
    fx.anim("dust", x, y, { size: r * 2.1, max: q ? 0.7 : 0.5, tint: DUST, layer: "ground" });
    if (q) {
      fx.anim("shock", x, y, { size: (1.2 * r) / 0.94, max: 0.4, tint: "#fff2d6", layer: "ground", delay: 0.08 });
      fx.anim("crack", x, y, { size: r * 2, max: 2.6, fadeOut: 1, layer: "ground", a: frand(0, 6.28) });
    }
    if (kind === "erupt") fx.anim("dirt", x, y, { size: r * 2.2, max: 0.6 });
    if (kind === "talon" || kind === "swoop") fx.anim("impact", x, y, { size: r * 1.6, max: 0.3, tint: "#fff2d6", a: frand(0, 6.28) });
    if (kind === "slam") fx.anim("crack", x, y, { size: r * 1.4, max: 1.4, fadeOut: 0.7, layer: "ground", a: frand(0, 6.28), alpha: 0.7 });
    if (!env.textured) {
      fx.ring(x, y, 0.1, r, q ? 0.55 : 0.32, tint, q ? 0.14 : 0.07, q ? "rgba(200,170,120,0.22)" : undefined);
      fx.burst(x, y, q ? 20 : 10, { color: "rgba(180,160,130,0.7)", speed: q ? 3.5 : 2.2, size: 0.16, max: 0.7, kind: "smoke", gravity: 0, drag: 2 });
    }
    fx.burst(x, y, q ? 14 : 6, { color: "#6f7782", speed: 2.6, size: 0.06, max: 0.6, kind: "chunk", vz: 3, spin: 6 });
    fx.shake = Math.min(1, fx.shake + (q ? 0.9 : 0.25));
    if (q) env.kick?.(2);
    snd(q ? "boom" : "slam", q ? 0.9 : 0.6);
    return;
  }
  if (kind === "pop") {
    fx.anim("goo", x, y, { size: Math.max(0.9, r * 2.2), max: 0.45 });
    fx.anim("shock", x, y, { size: (2 * r) / 0.94, max: 0.3, tint: "#aaff8c", layer: "ground", alpha: 0.7 });
    fx.burst(x, y, 6, { color: "rgba(170,255,140,0.8)", speed: 2.4, size: 0.06, max: 0.4, kind: "spark", gravity: 0 });
    snd("pop", 0.35);
    return;
  }
  if (kind === "mirror") {
    fx.anim("mirror", x, y, { size: r * 2.2, max: 0.45, tint: VIOLET });
    fx.anim("flash", x, y, { size: r * 2, max: 0.2, tint: VIOLET });
    fx.anim("shock", x, y, { size: (2 * r) / 0.94, max: 0.3, tint: VIOLET, layer: "ground" });
    snd("pop", 0.35);
    return;
  }
  if (fiery) {
    const small = kind === "bomblet" || kind === "shrapnel";
    fx.anim("fireball", x, y, { size: r * 2.1, max: big ? 0.8 : 0.6, a: frand(-0.3, 0.3) });
    fx.anim("flash", x, y, { size: r * 2.6, max: 0.16, tint: "#ffd9a0" });
    fx.anim("shock", x, y, { size: (2 * r) / 0.94, max: big ? 0.4 : 0.3, tint: "#ffd9a0", layer: "ground", alpha: 0.85 });
    fx.anim("scorch", x, y, { size: r * 2.2, max: big ? 3 : 2, fadeIn: 0.05, fadeOut: 1.2, layer: "ground", a: frand(0, 6.28), alpha: 0.8 });
    const puffs = big ? 4 : small ? 1 : 2;
    for (let i = 0; i < puffs; i++) {
      const a = frand(0, 6.28), d = r * 0.35;
      fx.anim("smoke", x + Math.cos(a) * d, y + Math.sin(a) * d, { size: r * (small ? 1.1 : 1.3), max: 0.9, tint: "#6a6266", delay: 0.18 + i * 0.05, z: 0.3, vx: Math.cos(a) * 0.4, vy: Math.sin(a) * 0.4, vz: 0.6, alpha: 0.9 });
    }
    fx.burst(x, y, big ? 22 : small ? 6 : 12, { color: "#ffcf6b", speed: big ? 5 : 3.5, size: 0.07, max: 0.5, kind: "spark", gravity: 2 });
    fx.burst(x, y, big ? 8 : 3, { color: "#3a3a3a", speed: 3, size: 0.07, max: 0.9, kind: "chunk", vz: 4, spin: 9 });
    if (!env.textured) {
      fx.ring(x, y, 0.1, r, big ? 0.45 : 0.3, big ? "#ffd27a" : "#ffb347", big ? 0.12 : 0.06, big ? "rgba(255,180,80,0.35)" : undefined);
      fx.burst(x, y, big ? 16 : 7, { color: "rgba(60,55,60,0.8)", speed: 1.4, size: 0.28, max: 1.0, kind: "smoke", gravity: 0, drag: 1.5 });
    }
    fx.flash = Math.max(fx.flash, big ? 0.35 : 0.12); fx.flashColor = "#ffd9a0";
    fx.shake = Math.min(1, fx.shake + (big ? 0.8 : 0.25));
    env.kick?.(big ? 2 : 1);
    snd(big ? "boom" : "pop", big ? 1 : 0.5);
    return;
  }
  fx.anim("shock", x, y, { size: (2 * r) / 0.94, max: 0.3, tint: TEAM[side].light, layer: "ground" });
  if (!env.textured) fx.ring(x, y, 0.1, r, 0.3, TEAM[side].light, 0.05);
  snd("pop", 0.4);
}

/** Deploy drop-in: how long a placed piece falls before it lands. */
export const DROP_TIME = 0.26;

/** The dust and flash when a placed piece lands (scheduled to fire at the end of its fall). */
export function playDrop(fx: Fx, x: number, y: number, radius: number, side: Side) {
  const d = DROP_TIME;
  fx.anim("dust", x, y, { size: Math.max(1.0, radius * 4), max: 0.5, tint: DUST, layer: "ground", delay: d });
  fx.anim("shock", x, y, { size: Math.max(0.9, radius * 3.2), max: 0.3, tint: TEAM[side].light, layer: "ground", delay: d, alpha: 0.8 });
  fx.anim("pillar", x, y, { size: 1.2, max: 0.35, tint: TEAM[side].main, delay: d, alpha: 0.6 });
  fx.anim("shadow", x, y, { size: Math.max(0.5, radius * 2.4), max: d, grow: [0.3, 1], alpha: 0.5, layer: "ground" });
}
