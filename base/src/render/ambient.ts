// Ambient arena life, drawn in code on top of the Blender backdrop (foreground.ts calls it): cloud shadows sliding
// over the ground, gusts of wind combing the grass, motes in the air (pollen, leaves, snow, embers, fireflies),
// butterflies, and a flock crossing overhead now and then with its shadows on the ground. Every arena gets a mix that
// fits it (AMBIENT, keyed by the arena's obstacle family like the rest of foreground.ts).
// Render-only and cheap: flat fills and short strokes, one cached soft blob, nothing the sim can see. All positions
// are pure functions of time, so tests can check them and a frame-stepped capture is repeatable.
import { H, W } from "@engine/core/defs";
import type { Camera } from "./camera";

export type MoteKind = "drift" | "fall" | "rise" | "blink";
export interface MoteCfg { kind: MoteKind; n: number; colors: string[]; /** radius in world units */ size: number; /** a tumbling flake (leaf, petal) rather than a dot */ leaf?: boolean }
export interface AmbientCfg {
  /** Strength of the drifting cloud shadows (0 = none). */
  shade: number;
  /** Colour of the wind gusts combing the ground, or null. */
  gust: string | null;
  motes: MoteCfg[];
  /** Butterflies wandering over the grass. */
  butterflies: number;
  /** A flock that crosses overhead: how many, and their colour. */
  flock: { n: number; color: string } | null;
}

const LEAVES = ["#7fbf4d", "#b8d65a", "#e2c04a"];
export const AMBIENT: Record<string, AmbientCfg> = {
  // 1 Borderlands: a summer meadow
  boulder: { shade: 1, gust: "#f4ffd8", motes: [{ kind: "drift", n: 18, colors: ["#fffbe0", "#fff3a8"], size: 0.038 }], butterflies: 3, flock: { n: 4, color: "#2d3a4a" } },
  // 2 Ash Fields: dry wind, drifting ash and the odd ember
  charstump: { shade: 0.8, gust: "#fff1c9", motes: [{ kind: "fall", n: 10, colors: ["#6f6a62", "#8d867b"], size: 0.03 }, { kind: "rise", n: 8, colors: ["#ffb04d", "#ff7a3d"], size: 0.028 }], butterflies: 0, flock: { n: 3, color: "#23201f" } },
  // 3 Hollow Wood: leaves coming down through the canopy
  stump: { shade: 0.7, gust: null, motes: [{ kind: "fall", n: 12, colors: LEAVES, size: 0.055, leaf: true }, { kind: "blink", n: 6, colors: ["#eaffa0"], size: 0.03 }], butterflies: 2, flock: { n: 3, color: "#2d3a4a" } },
  // 4 Iron Pass: highland wind and dust
  crag: { shade: 1, gust: "#f2f6e4", motes: [{ kind: "drift", n: 12, colors: ["#efe6cf", "#d9cfb4"], size: 0.028 }], butterflies: 0, flock: { n: 2, color: "#3a2f2a" } },
  // 5 High Keep: petals over the courtyard
  pillar: { shade: 0.9, gust: null, motes: [{ kind: "fall", n: 12, colors: ["#ffd3e0", "#ffffff", "#ffc0d0"], size: 0.045, leaf: true }], butterflies: 2, flock: { n: 4, color: "#2d3a4a" } },
  // 6 Frozen Reach: steady snowfall
  icerock: { shade: 0.6, gust: "#ffffff", motes: [{ kind: "fall", n: 34, colors: ["#ffffff", "#e8f4ff"], size: 0.032 }], butterflies: 0, flock: null },
  // 7 Sky Throne: gold motes (its cloud wisps are in foreground.ts)
  obelisk: { shade: 0.5, gust: null, motes: [{ kind: "blink", n: 12, colors: ["#ffe9a3", "#fff6d6"], size: 0.03 }], butterflies: 0, flock: { n: 5, color: "#ffffff" } },
  // 8 Mirelight Fen: fireflies over the mere (its water glints are in foreground.ts)
  fenlamp: { shade: 0.6, gust: null, motes: [{ kind: "blink", n: 16, colors: ["#d8ff8a", "#fff3a0"], size: 0.032 }, { kind: "drift", n: 6, colors: ["#e9f5e0"], size: 0.025 }], butterflies: 0, flock: null },
  // 9 Saltwind Coast: gulls and a hard sea wind (its spray is in foreground.ts)
  seastack: { shade: 1, gust: "#f4fbff", motes: [{ kind: "drift", n: 8, colors: ["#f2fbff"], size: 0.028 }], butterflies: 0, flock: { n: 4, color: "#ffffff" } },
  // 10 Crownfall Citadel: ash at dusk and crows (its embers are in foreground.ts)
  brokencolumn: { shade: 0.7, gust: null, motes: [{ kind: "fall", n: 12, colors: ["#6b6470", "#8b8494"], size: 0.03 }], butterflies: 0, flock: { n: 3, color: "#1d1a22" } },
};

const TAU = Math.PI * 2;
/** Deterministic 0..1 noise. */
const rnd = (i: number, k: number) => Math.abs(Math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1;
const frac = (v: number) => v - Math.floor(v);

/** Where mote i of a group is at `time`: world x, y, height z and opacity a (0..1); r is its tumble angle. */
export function moteAt(kind: MoteKind, i: number, time: number): { x: number; y: number; z: number; a: number; r: number } {
  const ph = rnd(i, 3), x0 = rnd(i, 7) * (W + 1) - 0.5, y0 = rnd(i, 11) * (H + 1) - 0.5;
  if (kind === "drift") {
    const x = frac((x0 + time * (0.22 + 0.2 * rnd(i, 5))) / (W + 2)) * (W + 2) - 1;
    return { x, y: y0 + Math.sin(time * 0.5 + ph * TAU) * 0.3, z: 0.6 + 0.35 * Math.sin(time * 0.8 + ph * TAU), a: 0.45 + 0.35 * Math.sin(time * 1.1 + ph * 9), r: 0 };
  }
  if (kind === "blink") {
    const g = Math.max(0, Math.sin(time * (1.1 + rnd(i, 5)) + ph * 9));
    return { x: x0 + Math.sin(time * 0.31 + ph * TAU) * 0.7, y: y0 + Math.cos(time * 0.23 + ph * 4) * 0.5, z: 0.45 + 0.25 * Math.sin(time * 0.6 + ph * 5), a: g * g, r: 0 };
  }
  const period = 5 + 4 * rnd(i, 13), u = frac(time / period + ph);
  const edge = Math.min(1, u * 8, (1 - u) * 8);
  if (kind === "rise") return { x: x0 + Math.sin(time * 0.9 + ph * TAU) * 0.2, y: y0, z: u * 2.4, a: Math.sin(u * Math.PI) * 0.85, r: 0 };
  // fall: down from above the board on a slant, swaying
  return { x: x0 + u * 1.3 + Math.sin(u * 7 + ph * TAU) * 0.28, y: y0, z: 3 * (1 - u), a: edge * 0.9, r: time * (1.5 + 2 * ph) + ph * TAU };
}

/** Seconds between flocks, and how long one takes to cross. The first one starts FLOCK_FIRST seconds in. */
export const FLOCK_EVERY = 17;
export const FLOCK_CROSS = 8;
export const FLOCK_FIRST = 2.5;
/** Bird i of the flock at `time`: world position (z is its height), heading dir (+1 right, -1 left) and wing beat
 *  (-1..1), or null between crossings. They fly a loose V across the board, alternating direction each pass. */
export function flockAt(i: number, time: number): { x: number; y: number; z: number; dir: number; beat: number } | null {
  const t = time - FLOCK_FIRST + FLOCK_EVERY, n = Math.floor(t / FLOCK_EVERY), u = (t - n * FLOCK_EVERY) / FLOCK_CROSS;
  if (t < FLOCK_EVERY || u < 0 || u > 1) return null;
  const dir = n % 2 ? 1 : -1, row = Math.ceil(i / 2), wing = i === 0 ? 0 : i % 2 ? 1 : -1;
  const lead = -3.5 + u * (W + 7 + 2);
  const along = lead - row * 0.55, x = dir > 0 ? along : W - along;
  const y0 = 2.5 + rnd(n, 5) * (H - 5);
  return { x, y: y0 + (u - 0.5) * 2.2 * (rnd(n, 9) - 0.5) + wing * row * 0.5, z: 2.6 + 0.15 * Math.sin(time * 2 + i), dir, beat: Math.sin(time * 9 + i * 1.9) };
}

/** Butterfly i at `time`: it loops around a home patch, pausing on the ground now and then (z 0, wings slow). */
export function butterflyAt(i: number, time: number): { x: number; y: number; z: number; flap: number; face: number } {
  const hx = 1 + rnd(i, 21) * (W - 2), hy = (i % 2 ? 1.2 : H - 4.6) + rnd(i, 23) * 3.4, ph = rnd(i, 29) * TAU;
  const rest = Math.sin(time * 0.33 + ph) > 0.82;
  const a = time * 0.7 + ph, x = hx + Math.sin(a) * 0.9 + Math.sin(a * 2.3) * 0.25, y = hy + Math.cos(a * 0.8) * 0.6;
  return { x, y, z: rest ? 0.05 : 0.45 + 0.18 * Math.sin(time * 5 + ph), flap: Math.abs(Math.sin(time * (rest ? 3 : 15) + ph)), face: Math.cos(a) >= 0 ? 1 : -1 };
}

/** Gust g at `time`: a streak of wind crossing the ground, as a centre, a length and a strength (0 between gusts). */
export function gustAt(g: number, time: number): { x: number; y: number; len: number; k: number } {
  const period = 4.5 + 2.5 * rnd(g, 31), n = Math.floor(time / period + rnd(g, 33)), u = frac(time / period + rnd(g, 33)) * period / 1.5;
  if (u > 1) return { x: 0, y: 0, len: 0, k: 0 };
  const y = 0.8 + rnd(g * 17 + n, 37) * (H - 1.6), x0 = rnd(g * 13 + n, 41) * (W - 4);
  return { x: x0 + u * 3.2, y, len: 1.1 + 0.7 * rnd(g + n, 43), k: Math.sin(u * Math.PI) };
}

const BUTTERFLY = ["#ffffff", "#ffe27a", "#ffb3d1"];

export class AmbientLife {
  /** Under the units: cloud shadows, gusts, and the shadows of the flock. */
  ground(ctx: CanvasRenderingContext2D, cfg: AmbientCfg, cam: Camera, time: number) {
    ctx.save();
    if (cfg.shade > 0) {
      // Two flat cloud shadows (three overlapping lobes each, one fill): flat like the arena's own baked shadows, and
      // a plain path fill costs far less than blending a soft image this size every frame.
      const span = W + 14;
      ctx.fillStyle = "#10263f";
      ctx.globalAlpha = 0.11 * cfg.shade;
      for (let i = 0; i < 2; i++) {
        const x = frac((rnd(i, 51) * span + time * (0.28 + 0.1 * i)) / span) * span - 7, y = 3 + i * 7 + Math.sin(time * 0.05 + i) * 0.8;
        ctx.beginPath();
        for (const [ox, oy, r] of [[-1.5, 0.15, 1.5], [0, -0.2, 2], [1.7, 0.2, 1.4]]) { cam.groundPath(ctx, x + ox, y + oy, r); ctx.closePath(); }
        ctx.fill("nonzero");
      }
    }
    if (cfg.gust) {
      ctx.strokeStyle = cfg.gust; ctx.lineCap = "round";
      for (let g = 0; g < 3; g++) {
        const w = gustAt(g, time);
        if (w.k <= 0.02) continue;
        const a = cam.project(w.x - w.len / 2, w.y), m = cam.project(w.x, w.y - 0.12), b = cam.project(w.x + w.len / 2, w.y + 0.05);
        ctx.globalAlpha = 0.5 * w.k; ctx.lineWidth = Math.max(1, m.s * 0.035);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, b.x, b.y); ctx.stroke();
        const a2 = cam.project(w.x - w.len * 0.2, w.y + 0.22), b2 = cam.project(w.x + w.len * 0.35, w.y + 0.24);
        ctx.globalAlpha = 0.3 * w.k;
        ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      }
    }
    if (cfg.flock) {
      ctx.fillStyle = "#14202a";
      for (let i = 0; i < cfg.flock.n; i++) {
        const b = flockAt(i, time);
        if (!b) continue;
        const p = cam.project(b.x, b.y);
        ctx.globalAlpha = 0.16;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * 0.28, p.s * 0.09, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Over the units: motes, butterflies and the flock. */
  air(ctx: CanvasRenderingContext2D, cfg: AmbientCfg, cam: Camera, time: number) {
    ctx.save();
    let seed = 0;
    for (const m of cfg.motes) {
      const glow = m.kind === "blink" || m.kind === "rise";
      if (glow) ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < m.n; i++) {
        const q = moteAt(m.kind, seed + i, time);
        if (q.a <= 0.03) continue;
        const p = cam.project(q.x, q.y, q.z), r = Math.max(1, m.size * p.s);
        ctx.fillStyle = m.colors[i % m.colors.length];
        ctx.globalAlpha = q.a;
        ctx.beginPath();
        if (m.leaf) ctx.ellipse(p.x, p.y, r, r * (0.25 + 0.75 * Math.abs(Math.cos(q.r * 1.3))), q.r, 0, TAU);
        else ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
        if (m.kind === "blink") { ctx.globalAlpha = q.a * 0.28; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, TAU); ctx.fill(); }
      }
      if (glow) ctx.globalCompositeOperation = "source-over";
      seed += 100;
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < cfg.butterflies; i++) {
      const b = butterflyAt(i, time), p = cam.project(b.x, b.y, b.z), s = p.s * 0.11;
      ctx.fillStyle = BUTTERFLY[i % BUTTERFLY.length]; ctx.strokeStyle = "#3a2a22"; ctx.lineWidth = 1;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(p.x + side * s * 0.55 * b.flap, p.y - s * 0.2, Math.max(0.6, s * 0.6 * b.flap), s * 0.75, side * 0.35, 0, TAU);
        ctx.fill(); ctx.stroke();
      }
    }
    if (cfg.flock) {
      ctx.strokeStyle = cfg.flock.color; ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let i = 0; i < cfg.flock.n; i++) {
        const b = flockAt(i, time);
        if (!b) continue;
        const p = cam.project(b.x, b.y, b.z), s = p.s * 0.3, lift = b.beat * s * 0.55;
        ctx.lineWidth = Math.max(2, p.s * 0.06);
        ctx.beginPath();
        ctx.moveTo(p.x - s, p.y - lift);
        ctx.quadraticCurveTo(p.x - s * 0.45, p.y - lift * 0.2 - s * 0.25, p.x, p.y);
        ctx.quadraticCurveTo(p.x + s * 0.45, p.y - lift * 0.2 - s * 0.25, p.x + s, p.y - lift);
        ctx.stroke();
        // a short body stroke along the heading, so the direction of flight reads
        ctx.beginPath(); ctx.moveTo(p.x - b.dir * s * 0.18, p.y + s * 0.05); ctx.lineTo(p.x + b.dir * s * 0.28, p.y); ctx.stroke();
      }
    }
    ctx.restore();
  }
}
