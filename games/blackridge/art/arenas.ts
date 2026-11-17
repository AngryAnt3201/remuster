// Blackridge's ten battlefields. The world itself (buildings, cover, the globe) is geometry from src/game/terrain.ts
// and src/render/props.ts; what is painted here is the ground it stands on: cracked asphalt, mud, a dry riverbed,
// rubble, a snow-dusted airfield, scree, steel plate, a dam's concrete, marsh and ash. Every ground is built from the
// same passes (a surface, wear, a band across the middle, pads under the command posts, worn paint on the zone lines).
import type { ArenaArt, ArenaDef } from "../../../artkit/arena";
import { rgba, shade, type Painter, type Pt } from "../../../artkit/paint";
import type { Model } from "../../../artkit/toon3d";
import { P } from "./parts";
import { TEAMS } from "./style";

const W = 9, H = 14, S0 = 5.9, S1 = 8.1;
const X0 = -8, Y0 = -17, GW = 25, GH = 38;
type Surface = "asphalt" | "mud" | "gravel" | "slab" | "snow" | "plate" | "ash" | "marsh";
type Band = "lane" | "rails" | "riverbed" | "trench" | "runway" | "pipes" | "spillway" | "duckboard" | "scorch" | "scree";

interface Scene {
  name: string; obstacle: string;
  surface: Surface; base: string; band: Band;
  /** Paint on the zone lines and pads. */
  paint: string;
  craters: number; puddles: number; tracks: number; cracks: number;
  extra?(p: Painter): void;
  haze: string;
  ambient?: ArenaDef["ambient"];
}

/** A soft dark burn with a pale blown rim. */
function crater(p: Painter, x: number, y: number, r: number, base: string) {
  p.glow(x, y, r * 2.2, "#0a0a0a", 0.5, "source-over");
  p.circle(x, y, r, shade(base, -0.45), 0, r * 0.82);
  p.circle(x - r * 0.08, y - r * 0.08, r * 0.62, shade(base, -0.62), 0, r * 0.5);
  for (let i = 0; i < 14; i++) { const a = p.rand(0, 6.283), d = r * p.rand(1.0, 2.1); p.line([[x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.75], [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85]], shade(base, i % 2 ? 0.16 : -0.3), p.rand(0.02, 0.06), 0.5); }
}
/** A pair of tyre or track ruts along a wandering line. */
function ruts(p: Painter, a: Pt, b: Pt, col: string, gauge = 0.34, w = 0.09) {
  const n = 9, pts: Pt[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([a[0] + (b[0] - a[0]) * t + Math.sin(t * 5 + a[0]) * 0.25, a[1] + (b[1] - a[1]) * t + Math.cos(t * 4 + a[1]) * 0.25]); }
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (const s of [-1, 1]) p.line(pts.map(([x, y]) => [x + nx * gauge * s, y + ny * gauge * s] as Pt), col, w, 0.3);
}
/** Worn paint: a dashed line whose dashes are chipped. */
function wornLine(p: Painter, x0: number, x1: number, y: number, col: string, w: number, dash = 0.7, gap = 0.4, a = 0.8) {
  for (let x = x0; x < x1; x += dash + gap) { if (p.rand() < 0.1) continue; p.line([[x, y + p.rand(-0.01, 0.01)], [Math.min(x1, x + dash * p.rand(0.7, 1)), y]], col, w * p.rand(0.75, 1), a * p.rand(0.55, 1)); }
}
/** Hazard chevrons along a strip. */
function chevrons(p: Painter, x: number, y: number, w: number, h: number, a: string, b: string, alpha = 0.75) {
  p.clip((g) => g.rect(x, y, w, h), () => { p.g.globalAlpha = alpha; p.rect(x, y, w, h, b); for (let k = x - h; k < x + w + h; k += h * 1.1) p.poly([[k, y + h], [k + h * 0.55, y + h], [k + h * 1.55, y], [k + h, y]], a); p.g.globalAlpha = 1; });
}

function surface(p: Painter, s: Scene) {
  const b = s.base;
  p.fill(b);
  // broad tonal drift, then grit
  p.mottle(X0, Y0, GW, GH, shade(b, -0.22), { n: 260, size: [1.2, 3.6], alpha: 0.12 });
  p.mottle(X0, Y0, GW, GH, shade(b, 0.2), { n: 260, size: [0.9, 3.0], alpha: 0.1 });
  p.mottle(X0, Y0, GW, GH, shade(b, -0.35), { n: 2600, size: [0.04, 0.16], alpha: 0.22 });
  p.mottle(X0, Y0, GW, GH, shade(b, 0.3), { n: 2200, size: [0.03, 0.11], alpha: 0.2 });
  if (s.surface === "asphalt") {
    for (let i = 0; i < 26; i++) { const x = p.rand(X0, X0 + GW), y = p.rand(Y0, Y0 + GH); p.round(x, y, p.rand(0.8, 2.6), p.rand(0.6, 1.8), 0.1, rgba(shade(b, -0.28), 0.5)); }
    for (let i = 0; i < 40; i++) p.glow(p.rand(X0, X0 + GW), p.rand(Y0, Y0 + GH), p.rand(0.2, 0.7), "#101214", 0.35, "source-over");
  } else if (s.surface === "slab" || s.surface === "snow") {
    p.g.globalAlpha = 0.5;
    p.slabs(X0, Y0, GW, GH, [shade(b, 0.05), shade(b, -0.05), b, shade(b, 0.1)], { sw: 2.25, sh: 2.33, joint: 0.06, jointColor: shade(b, -0.5), bond: 0 });
    p.g.globalAlpha = 1;
    p.mottle(X0, Y0, GW, GH, shade(b, -0.3), { n: 1200, size: [0.05, 0.2], alpha: 0.16 });
  } else if (s.surface === "plate") {
    p.g.globalAlpha = 0.55;
    p.slabs(X0, Y0, GW, GH, [shade(b, 0.06), shade(b, -0.08), b], { sw: 1.5, sh: 1.0, joint: 0.045, jointColor: shade(b, -0.55), bond: 0.5, rivets: shade(b, 0.3) });
    p.g.globalAlpha = 1;
    for (let i = 0; i < 50; i++) p.glow(p.rand(X0, X0 + GW), p.rand(Y0, Y0 + GH), p.rand(0.3, 1.1), "#6a3f26", 0.22, "source-over");
  } else if (s.surface === "gravel" || s.surface === "mud" || s.surface === "marsh" || s.surface === "ash") {
    const st = s.surface === "gravel" ? 4200 : 1500;
    p.scatter(X0, Y0, GW, GH, st, (x, y, i) => p.circle(x, y, p.rand(0.03, s.surface === "gravel" ? 0.11 : 0.07), shade(b, i % 3 ? -0.3 : 0.32), 0, p.rand(0.02, 0.07)));
    if (s.surface !== "gravel") for (let i = 0; i < 70; i++) p.glow(p.rand(X0, X0 + GW), p.rand(Y0, Y0 + GH), p.rand(0.5, 1.6), shade(b, -0.5), 0.3, "source-over");
  }
  if (s.surface === "snow") {
    // wind-drifted snow lying in the lee of everything, the slab showing through in streaks
    for (let i = 0; i < 520; i++) { const x = p.rand(X0, X0 + GW), y = p.rand(Y0, Y0 + GH); p.glow(x, y, p.rand(0.5, 1.9), "#e9eef0", p.rand(0.16, 0.42), "source-over", p.rand(0.2, 0.6)); }
    for (let i = 0; i < 90; i++) { const x = p.rand(X0, X0 + GW), y = p.rand(Y0, Y0 + GH), l = p.rand(1, 3.4); p.line([[x, y], [x + l, y + p.rand(-0.1, 0.1)]], "#f4f7f8", p.rand(0.03, 0.09), 0.5); }
  }
  if (s.surface === "marsh") for (let i = 0; i < 60; i++) { const x = p.rand(X0, X0 + GW), y = p.rand(Y0, Y0 + GH); if (y > -0.6 && y < H + 0.6 && x > 0.6 && x < W - 0.6) continue; p.puddle(x, y, p.rand(0.5, 1.6), "#2b3432", "#8ea09a"); }
  if (s.surface === "ash") for (let i = 0; i < 300; i++) p.glow(p.rand(X0, X0 + GW), p.rand(Y0, Y0 + GH), p.rand(0.3, 1.2), i % 5 ? "#191817" : "#8f8b84", p.rand(0.12, 0.3), "source-over");
}

function band(p: Painter, s: Scene) {
  const b = s.base, mid = (S0 + S1) / 2, x0 = X0, x1 = X0 + GW, h = S1 - S0;
  if (s.band === "lane" || s.band === "runway") {
    p.rect(x0, S0, GW, h, rgba(shade(b, -0.22), 0.75));
    p.mottle(x0, S0, GW, h, shade(b, -0.5), { n: 500, size: [0.05, 0.2], alpha: 0.25 });
    wornLine(p, x0, x1, mid, s.paint, s.band === "runway" ? 0.2 : 0.09, s.band === "runway" ? 1.6 : 0.9, s.band === "runway" ? 1.0 : 0.6);
    if (s.band === "runway") for (const y of [S0 + 0.3, S1 - 0.3]) wornLine(p, x0, x1, y, "#d8d4c4", 0.05, 3, 0.2, 0.6);
    for (let i = 0; i < 5; i++) ruts(p, [x0, mid + p.rand(-0.6, 0.6)], [x1, mid + p.rand(-0.6, 0.6)], "#0e0f10", 0.3, 0.08);
  } else if (s.band === "rails") {
    p.rect(x0, S0, GW, h, rgba(shade(b, -0.12), 0.8));
    p.scatter(x0, S0 + 0.1, GW, h - 0.2, 2600, (x, y, i) => p.circle(x, y, p.rand(0.03, 0.08), shade("#6a6660", i % 2 ? -0.3 : 0.2)));
    for (const y of [mid - 0.5, mid + 0.5]) p.rails([[x0, y], [x1, y]], 0.42, { sleeper: "#3f3830", rail: "#8a8d90", bed: rgba("#2f2c28", 0.6) });
  } else if (s.band === "riverbed" || s.band === "scree") {
    const c = s.band === "riverbed" ? "#7c766a" : shade(b, 0.12);
    p.rect(x0, S0 + 0.05, GW, h - 0.1, rgba(c, 0.85));
    p.cobbles(x0, S0 + 0.08, GW, h - 0.16, [shade(c, 0.18), shade(c, -0.12), c, shade(c, -0.25), shade(c, 0.3)], { size: 0.2, gap: shade(c, -0.5), jitter: 0.8, aspect: 0.8 });
    if (s.band === "riverbed") { for (let i = 0; i < 9; i++) p.puddle(p.rand(x0, x1), mid + p.rand(-0.5, 0.5), p.rand(0.3, 0.7), "#2e3a3c", "#9fb2b4"); for (const y of [S0 + 0.04, S1 - 0.04]) p.line([[x0, y], [x1, y]], "#3b3a36", 0.14, 0.9); }
  } else if (s.band === "trench" || s.band === "duckboard") {
    p.rect(x0, S0, GW, h, rgba(shade(b, -0.4), 0.85));
    p.planks(x0, mid - 0.55, GW, 1.1, ["#5a4e3e", "#4c4234", "#62553f", "#514636"], { width: 0.24, vertical: true, len: 1.1 });
    for (const y of [S0 + 0.14, S1 - 0.14]) for (let x = x0; x < x1; x += 0.46) p.circle(x, y, 0.2, x % 0.92 < 0.46 ? "#8a8163" : "#7a7258", 0, 0.12);
  } else if (s.band === "pipes") {
    p.rect(x0, S0, GW, h, rgba(shade(b, -0.25), 0.8));
    chevrons(p, x0, S0 + 0.06, GW, 0.16, "#c79a1e", "#1c1c1c", 0.6); chevrons(p, x0, S1 - 0.22, GW, 0.16, "#c79a1e", "#1c1c1c", 0.6);
    for (const y of [mid - 0.42, mid, mid + 0.42]) { p.line([[x0, y], [x1, y]], "#2a2c2e", 0.26, 1); p.line([[x0, y - 0.05], [x1, y - 0.05]], "#7e8588", 0.07, 0.8); for (let x = x0; x < x1; x += 1.8) p.rect(x, y - 0.16, 0.12, 0.32, "#40454a"); }
  } else if (s.band === "spillway") {
    p.rect(x0, S0, GW, h, rgba(shade(b, -0.1), 0.9));
    for (let x = x0; x < x1; x += 0.5) p.line([[x, S0 + 0.1], [x, S1 - 0.1]], shade(b, -0.5), 0.05, 0.55);
    for (let i = 0; i < 60; i++) { const x = p.rand(x0, x1); p.line([[x, S0 + 0.1], [x + p.rand(-0.05, 0.05), S1 - p.rand(0.1, 1.2)]], "#262a2b", p.rand(0.04, 0.12), 0.25); }
  } else {
    p.rect(x0, S0, GW, h, rgba("#141312", 0.6));
    for (let i = 0; i < 22; i++) crater(p, p.rand(x0, x1), mid + p.rand(-0.6, 0.6), p.rand(0.14, 0.34), b);
  }
}

function pads(p: Painter, s: Scene) {
  const b = s.base;
  for (const [i, [cx, cy]] of ([[4.5, 13.4], [4.5, 1.55]] as Pt[]).entries()) {
    const c = shade("#6f7270", s.surface === "snow" ? 0.25 : -0.05), w = 3.0, h = 1.9, tc = i === 0 ? TEAMS.tide.main : TEAMS.ember.main;
    p.g.globalAlpha = 0.92;
    p.slabs(cx - w / 2, cy - h / 2, w, h, [c, shade(c, -0.07), shade(c, 0.06)], { sw: 0.75, sh: 0.63, joint: 0.04, jointColor: shade(c, -0.5), bond: 0 });
    p.g.globalAlpha = 1;
    p.mottle(cx - w / 2, cy - h / 2, w, h, shade(c, -0.4), { n: 160, size: [0.04, 0.2], alpha: 0.22 });
    chevrons(p, cx - w / 2, cy - h / 2 - 0.02, w, 0.14, "#c79a1e", "#1e1e1e", 0.55); chevrons(p, cx - w / 2, cy + h / 2 - 0.12, w, 0.14, "#c79a1e", "#1e1e1e", 0.55);
    // corner brackets in the side's paint
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const x = cx + sx * (w / 2 + 0.16), y = cy + sy * (h / 2 + 0.16); p.line([[x, y - sy * 0.5], [x, y], [x - sx * 0.5, y]], tc, 0.07, 0.6); }
    void b;
  }
}

function wear(p: Painter, s: Scene) {
  const b = s.base, on = (x: number, y: number) => x > -1 && x < W + 1 && y > -1 && y < H + 1;
  const far = (x: number, y: number) => Math.hypot(x - 4.5, y - 13.4) > 2 && Math.hypot(x - 4.5, y - 1.55) > 2 && (y < S0 - 0.3 || y > S1 + 0.3);
  p.cracks(X0, Y0, GW, GH, s.cracks * 4, rgba("#0c0c0c", 0.5), 0.035);
  p.cracks(-0.5, -0.5, W + 1, H + 1, s.cracks, rgba("#0c0c0c", 0.55), 0.03);
  for (let i = 0; i < s.tracks; i++) { const x = p.rand(X0, X0 + GW); ruts(p, [x, Y0], [x + p.rand(-4, 4), Y0 + GH], shade(b, -0.5), 0.32, 0.1); }
  for (let i = 0; i < s.tracks; i++) { const x = p.rand(0.6, W - 0.6); ruts(p, [x, -1], [x + p.rand(-1.5, 1.5), H + 1], shade(b, -0.45), 0.3, 0.08); }
  p.scatter(X0, Y0, GW, GH, s.craters * 5, (x, y) => crater(p, x, y, p.rand(0.25, 0.8), b), (x, y) => !on(x, y));
  p.scatter(0.4, 0.4, W - 0.8, H - 0.8, s.craters, (x, y) => crater(p, x, y, p.rand(0.16, 0.4), b), far);
  p.scatter(X0, Y0, GW, GH, s.puddles * 4, (x, y) => p.puddle(x, y, p.rand(0.25, 0.9), "#2a3236", "#9fb0b6"), (x, y) => !on(x, y));
  p.scatter(0.4, 0.4, W - 0.8, H - 0.8, s.puddles, (x, y) => p.puddle(x, y, p.rand(0.16, 0.42), "#2a3236", "#9fb0b6"), far);
}

function lines(p: Painter, s: Scene) {
  // the zone lines: worn paint right across, heavier over the board, with range ticks along the board's edges
  for (const y of [S0, S1]) { wornLine(p, X0, X0 + GW, y, s.paint, 0.07, 1.2, 0.5, 0.45); wornLine(p, -0.3, W + 0.3, y, s.paint, 0.11, 0.9, 0.22, 0.85); }
  for (let y = 0; y <= H; y += 1) for (const x of [-0.12, W + 0.12]) p.line([[x - 0.1, y], [x + 0.1, y]], s.paint, y % 7 === 0 ? 0.07 : 0.035, 0.5);
  for (let x = 0; x <= W; x += 1) for (const y of [-0.12, H + 0.12]) p.line([[x, y - 0.1], [x, y + 0.1]], s.paint, 0.035, 0.5);
}

// ------------------------------------------------------------------------------------------------ what stands around
type Build = (m: Model) => void;
const container = (c: typeof P.armor): Build => (m) => { m.group(() => m.box([0, 0, 0.55], [2.4, 1.0, 1.1], c)); for (let i = 0; i < 11; i++) m.decal(0.01, () => m.box([-1.1 + i * 0.22, 0.505, 0.55], [0.06, 0.01, 0.95], P.armorDk)); };
const tWall: Build = (m) => { for (let i = 0; i < 4; i++) m.group(() => { m.box([i * 0.62 - 0.93, 0, 0.7], [0.58, 0.16, 1.4], P.concrete); m.box([i * 0.62 - 0.93, 0, 0.08], [0.58, 0.5, 0.16], P.concrete); }); };
const hedgehog: Build = (m) => { for (const [a, b] of [[[-0.6, -0.5, 0], [0.6, 0.5, 0.9]], [[0.6, -0.5, 0], [-0.6, 0.5, 0.9]], [[0, 0.7, 0], [0, -0.7, 0.9]]] as [[number, number, number], [number, number, number]][]) m.box([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.45], [0.1, 0.1, 0.1], P.rust), m.capsule(a, b, 0.07, P.rust, 0.07, { segs: 4 }); };
const barrier: Build = (m) => { for (const x of [-0.5, 0.5]) m.group(() => { m.extrude([[-0.3, 0], [0.3, 0], [0.12, 0.3], [0.09, 0.8], [-0.09, 0.8], [-0.12, 0.3]], 0.95, P.concrete); }), void x; m.decal(0.01, () => m.box([0, 0.48, 0.45], [0.5, 0.01, 0.12], P.hazard)); };
const drums: Build = (m) => { for (const [x, y, c] of [[-0.4, -0.3, P.rust], [0.35, -0.35, P.armorDk], [0, 0.35, P.red], [-0.5, 0.4, P.armor]] as [number, number, typeof P.rust][]) { m.cylinder([x, y, 0], [x, y, 0.85], 0.32, c, 0.32, { segs: 12 }); m.decal(0.01, () => m.cylinder([x, y, 0.5], [x, y, 0.6], 0.325, P.hazard, 0.325, { segs: 12 })); } };
const wreck: Build = (m) => { m.group(() => { m.extrude([[-1.1, 0.25], [1.0, 0.25], [1.05, 0.6], [0.5, 0.7], [0.2, 1.1], [-0.7, 1.1], [-1.1, 0.7]], 1.0, P.rust); }); for (const x of [-0.65, 0.6]) for (const y of [-0.5, 0.5]) m.cylinder([x, y - 0.06, 0.28], [x, y + 0.06, 0.28], 0.28, P.rubber, 0.28, { segs: 10 }); };
const SCENERY: Build[] = [container(P.rust), container(P.armor), container(P.navy), tWall, wreck, drums, barrier];

function scene(s: Scene): ArenaDef {
  return {
    name: s.name, edge: shade(s.base, -0.5), obstacle: s.obstacle, ambient: s.ambient,
    ground(p) { surface(p, s); wear(p, s); band(p, s); s.extra?.(p); pads(p, s); lines(p, s); },
    scenery(add, r) {
      for (let i = 0; i < 26; i++) {
        const left = i % 2 === 0, x = left ? -1.4 - r() * 5.5 : W + 1.4 + r() * 5.5, y = -12 + r() * 30;
        add({ build: SCENERY[Math.floor(r() * SCENERY.length)], x, y, yaw: 90 + (r() - 0.5) * 50, shadow: 1.1 });
      }
      for (let i = 0; i < 9; i++) add({ build: SCENERY[Math.floor(r() * 3)], x: -6 + r() * 21, y: -3.5 - r() * 9, yaw: r() * 180, shadow: 1.2 });
    },
    grade(g, w, h) {
      const f = g.createLinearGradient(0, 0, 0, h * 0.42); f.addColorStop(0, rgba(s.haze, 0.9)); f.addColorStop(1, rgba(s.haze, 0));
      g.fillStyle = f; g.fillRect(0, 0, w, h * 0.42);
      const v = g.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, h * 0.75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(4,6,8,0.5)");
      g.fillStyle = v; g.fillRect(0, 0, w, h);
    },
    props: [barrier, hedgehog, drums],
  };
}

const dust = (c: string, n = 14): ArenaDef["ambient"] => ({ shade: 0.25, gust: rgba(c, 0.35), motes: [{ kind: "drift", n, colors: [c], size: 2.2 }], butterflies: 0, flock: null });
const fall = (c: string[], n: number, size = 2.4): ArenaDef["ambient"] => ({ shade: 0.3, gust: null, motes: [{ kind: "fall", n, colors: c, size }], butterflies: 0, flock: null });

export const ARENAS: ArenaArt = {
  team: { main: "#8a8d88", dark: "#5a5d5a", light: "#c9cdc8" },
  acts: [
    scene({ name: "Apron Seven", obstacle: "barriers", surface: "asphalt", base: "#55585a", band: "lane", paint: "#d9d2b4", craters: 3, puddles: 4, tracks: 3, cracks: 34, haze: "#8f969a", ambient: dust("#9a9c98") }),
    scene({ name: "Kessel Yard", obstacle: "crates", surface: "mud", base: "#5e574b", band: "rails", paint: "#c9c2a4", craters: 3, puddles: 9, tracks: 7, cracks: 6, haze: "#8c8a80", ambient: dust("#8f8a7c") }),
    scene({ name: "Dry Ford", obstacle: "boulders", surface: "gravel", base: "#6e695e", band: "riverbed", paint: "#d0c8ac", craters: 2, puddles: 3, tracks: 4, cracks: 4, haze: "#96958c", ambient: dust("#a39d8c") }),
    scene({ name: "Block Nine", obstacle: "rubble", surface: "slab", base: "#6a6b68", band: "scorch", paint: "#cfc9b6", craters: 6, puddles: 2, tracks: 2, cracks: 46, haze: "#8a8c8a", ambient: fall(["#5a5a58", "#8a8a86"], 22),
      extra(p) { p.scatter(X0, Y0, GW, GH, 900, (x, y, i) => p.round(x, y, p.rand(0.06, 0.3), p.rand(0.05, 0.22), 0.02, shade("#7a7a76", i % 2 ? -0.3 : 0.15)), (x, y) => x < -0.3 || x > W + 0.3 || y < -0.3 || y > H + 0.3 || p.rand() < 0.2); } }),
    scene({ name: "Whiteout Strip", obstacle: "drifts", surface: "snow", base: "#7b8084", band: "runway", paint: "#e9d27a", craters: 2, puddles: 0, tracks: 5, cracks: 18, haze: "#c3cace", ambient: fall(["#ffffff", "#dfe8ee"], 46, 2.6) }),
    scene({ name: "Saddle Pass", obstacle: "boulders", surface: "gravel", base: "#66625c", band: "scree", paint: "#cfc8b0", craters: 3, puddles: 1, tracks: 3, cracks: 8, haze: "#9a9c9c", ambient: dust("#a8a8a2", 18) }),
    scene({ name: "Cracking Plant", obstacle: "drums", surface: "plate", base: "#575b5d", band: "pipes", paint: "#e0b23a", craters: 2, puddles: 5, tracks: 2, cracks: 4, haze: "#8c8a84", ambient: { shade: 0.3, gust: null, motes: [{ kind: "rise", n: 16, colors: ["#ffb060", "#ff7a2a"], size: 2 }], butterflies: 0, flock: null },
      extra(p) { for (let i = 0; i < 26; i++) p.glow(p.rand(X0, X0 + GW), p.rand(Y0, Y0 + GH), p.rand(0.5, 1.6), "#0c0d0e", 0.5, "source-over"); } }),
    scene({ name: "Crest Road", obstacle: "barriers", surface: "slab", base: "#74787a", band: "spillway", paint: "#d8d4c4", craters: 1, puddles: 6, tracks: 2, cracks: 22, haze: "#a0a8ac", ambient: dust("#b4bcc0", 10),
      extra(p) { for (let y = -1; y < H + 1; y += 4.66) for (const x of [1.5, 4.5, 7.5]) { p.rect(x - 0.35, y - 0.12, 0.7, 0.24, "#2a2d2e"); for (let k = 0; k < 6; k++) p.line([[x - 0.3 + k * 0.12, y - 0.1], [x - 0.3 + k * 0.12, y + 0.1]], "#6f7476", 0.03, 0.9); } } }),
    scene({ name: "Sump Flats", obstacle: "stumps", surface: "marsh", base: "#4c4f44", band: "duckboard", paint: "#c4c0a0", craters: 2, puddles: 12, tracks: 4, cracks: 0, haze: "#868c84", ambient: dust("#8f9688", 16),
      extra(p) { p.scatter(X0, Y0, GW, GH, 2400, (x, y, i) => p.line([[x, y], [x + p.rand(-0.05, 0.05), y - p.rand(0.1, 0.26)]], i % 3 ? "#6c7450" : "#8a8a5c", 0.025, 0.7), (x, y) => (x < -0.4 || x > W + 0.4 || y < -0.4 || y > H + 0.4) || p.rand() < 0.12); } }),
    scene({ name: "Cinder Row", obstacle: "wrecks", surface: "ash", base: "#4a4846", band: "scorch", paint: "#c8bfa8", craters: 7, puddles: 0, tracks: 3, cracks: 16, haze: "#7c7570", ambient: { shade: 0.35, gust: null, motes: [{ kind: "rise", n: 22, colors: ["#ff9a3a", "#ff5a1a", "#ffd27a"], size: 2 }, { kind: "fall", n: 20, colors: ["#3a3836", "#8a8680"], size: 2.2 }], butterflies: 0, flock: null },
      extra(p) { for (let i = 0; i < 40; i++) { const x = p.rand(X0, X0 + GW), y = p.rand(Y0, Y0 + GH); if (x > -0.5 && x < W + 0.5 && y > -0.5 && y < H + 0.5) continue; p.glow(x, y, p.rand(0.2, 0.6), "#ff7a2a", 0.5, "lighter"); } } }),
  ],
};
