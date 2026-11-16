// Neonhold's ten battlefields: one block of the Hold per campaign act. They share a family look (wet dark paving
// that mirrors the signs, a zebra crossing across the middle between two lit kerb lines, a marked lane from keep
// to keep, a ringed landing pad under each keep, hard-light fences) and each has its own floor, light and skyline.
import type { ArenaArt, ArenaDef, SceneItem } from "../../../artkit/arena";
import { Painter, mixHex, rgba, shade, spline, type Pt } from "../../../artkit/paint";
import { Model, type Material } from "../../../artkit/toon3d";
import { S, SIGNS, WINS, acUnit, barrier, beacon, billboard, container, crane, crateStack, dish, fountain, jersey, lampPost, monorail, parapet, pipeRun, rack, railcar, stall, tank, tower, tree, vending } from "./scenery";

const W = 9, H = 14, STRIP0 = 5.9, STRIP1 = 8.1;
const KEEPS: Pt[] = [[4.5, 13.4], [4.5, 1.55]];
/** The lane between the keeps. */
const PATH: Pt[] = spline([[4.5, 15.5], [4.5, 12.4], [4.8, 10.2], [4.3, 7.0], [4.1, 4.4], [4.5, 2.4], [4.5, -0.8], [4.5, -7]], 0.15);
function ribbon(path: Pt[], w: number): Pt[] {
  const a: Pt[] = [], b: Pt[] = [];
  path.forEach(([x, y], i) => { const [px, py] = path[Math.max(0, i - 1)], [qx, qy] = path[Math.min(path.length - 1, i + 1)], d = Math.hypot(qx - px, qy - py) || 1; const nx = -(qy - py) / d, ny = (qx - px) / d; a.push([x + nx * w / 2, y + ny * w / 2]); b.push([x - nx * w / 2, y - ny * w / 2]); });
  return [...a, ...b.reverse()];
}
const polyPath = (pts: Pt[]) => (g: CanvasRenderingContext2D) => pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
const ring = (x: number, y: number, r: number, n = 40): Pt[] => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, y + Math.sin((i / n) * Math.PI * 2) * r] as Pt);
/** A tube of light painted on the ground: a soft spill, then a bright core. */
export function neonLine(p: Painter, pts: Pt[], col: string, w = 0.05, k = 1) {
  p.line(pts, col, w * 7, 0.1 * k); p.line(pts, col, w * 3, 0.28 * k); p.line(pts, mixHex(col, "#ffffff", 0.5), w, 0.95 * k);
}
/** A sign's reflection in wet ground: a long soft streak running towards the camera. */
const streak = (p: Painter, x: number, y: number, col: string, a = 0.2, len = 2.2, w = 0.4) => p.glow(x, y, w, col, a, "lighter", len);

type Floor = (p: Painter, x: number, y: number, w: number, h: number, c: string[], line: string) => void;
const FLOORS: Record<string, Floor> = {
  slabs: (p, x, y, w, h, c, l) => p.slabs(x, y, w, h, c, { sw: 1.5, sh: 1.0, joint: 0.03, jointColor: rgba(l, 0.4) }),
  tiles: (p, x, y, w, h, c, l) => p.slabs(x, y, w, h, c, { sw: 0.75, sh: 0.75, joint: 0.025, jointColor: rgba(l, 0.45), bond: 0 }),
  grate: (p, x, y, w, h, c, l) => p.slabs(x, y, w, h, c, { sw: 0.5, sh: 0.5, joint: 0.04, jointColor: rgba(l, 0.5), bond: 0, rivets: rgba(l, 0.5) }),
  deck: (p, x, y, w, h, c, l) => p.slabs(x, y, w, h, c, { sw: 2.4, sh: 0.5, joint: 0.03, jointColor: rgba(l, 0.4), rivets: rgba(l, 0.45) }),
  glass: (p, x, y, w, h, c, l) => p.slabs(x, y, w, h, c, { sw: 1.5, sh: 1.5, joint: 0.045, jointColor: rgba(l, 0.7), bond: 0 }),
  plain: (p, x, y, w, h, c) => { p.rect(x, y, w, h, c[0]); p.mottle(x, y, w, h, c[1] ?? shade(c[0], 0.1), { alpha: 0.3, size: [0.4, 1.4] }); },
};

interface District {
  name: string; obstacle: string; edge: string;
  /** Floors: the yard, the strip across the middle, the streets outside. */
  floor: keyof typeof FLOORS; yard: string[]; strip: string[]; street: string[];
  /** Joint and marking colour; the kerb tubes; the two sign colours the wet ground mirrors. */
  line: string; kerb: string; a: string; b: string;
  haze: string;
  wall: "barrier" | "parapet" | "jersey" | "pipe" | "rack";
  pane?: Material; lamp?: Material;
  decals?(p: Painter): void;
  skyline(add: (it: SceneItem) => void, r: () => number): void;
  props: ((m: Model) => void)[];
  ambient?: ArenaDef["ambient"];
}
const RAIN = { kind: "fall" as const, n: 30, colors: ["#b9c4ff", "#8f9ae0"], size: 0.018 };

function district(d: District): ArenaDef {
  const lamps: Pt[] = [];
  for (const y of [0.9, 3.7, 7.0, 10.3, 13.1]) lamps.push([-0.5, y], [W + 0.5, y]);
  return {
    name: d.name, edge: d.edge, obstacle: d.obstacle, ambient: d.ambient, props: d.props,
    ground(p) {
      // the streets outside, darker, with their own lane marks
      FLOORS.slabs(p, -8, -17, 25, 38, d.street, d.line);
      for (const x of [-3.4, W + 3.4]) for (let y = -16; y < 21; y += 1.6) p.rect(x - 0.05, y, 0.1, 0.8, rgba(d.line, 0.35));
      for (let i = 0; i < 26; i++) streak(p, p.rand(-7.5, 16.5), p.rand(-16, 20), i % 2 ? d.a : d.b, 0.16, 2.4, 0.5);
      p.rect(-0.78, -0.78, W + 1.56, H + 1.56, shade(d.yard[0], -0.4));
      // the yard: wet paving
      p.clip((g) => g.rect(-0.55, -0.55, W + 1.1, H + 1.1), () => {
        FLOORS[d.floor](p, -0.55, -0.55, W + 1.1, H + 1.1, d.yard, d.line);
        p.mottle(-0.5, -0.5, W + 1, H + 1, "#05041a", { n: 40, alpha: 0.14, size: [0.5, 1.8] });
        p.mottle(-0.5, -0.5, W + 1, H + 1, "#c9c4ff", { n: 34, alpha: 0.045, size: [0.5, 1.6] });
        // the signs down both sides, mirrored in the wet
        for (const [x, y] of lamps) streak(p, x + (x < 0 ? 1.0 : -1.0), y + 0.9, x < 0 ? d.a : d.b, 0.2, 1.9, 0.55);
        for (let i = 0; i < 7; i++) streak(p, p.rand(1.5, 7.5), p.rand(0.5, 13), i % 2 ? d.a : d.b, 0.07, 1.6, 0.3);
      });
      // the strip between the deploy zones: a zebra crossing between two kerb tubes
      p.clip((g) => g.rect(-0.55, STRIP0, W + 1.1, STRIP1 - STRIP0), () => {
        FLOORS.plain(p, -0.55, STRIP0, W + 1.1, STRIP1 - STRIP0, d.strip, d.line);
        for (let x = -0.4; x < W + 0.5; x += 0.72) p.rect(x, STRIP0 + 0.34, 0.4, STRIP1 - STRIP0 - 0.68, rgba(d.line, 0.34));
      });
      for (const y of [STRIP0, STRIP1]) neonLine(p, [[-0.55, y], [W + 0.55, y]], d.kerb, 0.055);
      // the lane: darker tarmac, edge lines, a dashed centre
      const rib = ribbon(PATH, 1.25);
      p.clip(polyPath(rib), () => { p.rect(2.5, -8, 4.5, 24, rgba("#05041a", 0.3)); });
      for (const s of [0.62, -0.62]) p.line(PATH.map(([x, y], i) => { const [qx, qy] = PATH[Math.min(PATH.length - 1, i + 1)], [px, py] = PATH[Math.max(0, i - 1)], dd = Math.hypot(qx - px, qy - py) || 1; return [x - ((qy - py) / dd) * s, y + ((qx - px) / dd) * s] as Pt; }), rgba(d.line, 0.5), 0.04);
      for (let i = 0; i + 4 < PATH.length; i += 9) { const [x, y] = PATH[i]; if (y > STRIP0 - 0.2 && y < STRIP1 + 0.2) continue; p.line([PATH[i], PATH[i + 4]], rgba(d.b, 0.6), 0.06); void x; }
      // a ringed landing pad under each keep
      for (const [kx, ky] of KEEPS) {
        p.glow(kx, ky + 0.1, 2.5, "#05041a", 0.45, "source-over", 2.0);
        p.circle(kx, ky, 1.74, shade(d.yard[0], -0.3));
        neonLine(p, ring(kx, ky, 1.66), d.kerb, 0.05);
        neonLine(p, ring(kx, ky, 1.28), d.a, 0.03, 0.6);
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; p.line([[kx + Math.cos(a) * 1.36, ky + Math.sin(a) * 1.36], [kx + Math.cos(a) * 1.58, ky + Math.sin(a) * 1.58]], rgba(d.line, 0.8), 0.05); }
      }
      d.decals?.(p);
      p.cracks(0, 0, W, H, 6, rgba("#05041a", 0.5));
      // light pooling under the lamps
      for (const [x, y] of lamps) p.glow(x + (x < 0 ? 0.6 : -0.6), y, 1.5, x < 0 ? d.a : d.b, 0.2, "lighter", 1.1);
    },
    scenery(add, r) {
      const seg = (m: Model, len: number) => {
        if (d.wall === "parapet") parapet(m, len, 0.34, S.mag);
        else if (d.wall === "jersey") jersey(m, len);
        else if (d.wall === "pipe") pipeRun(m, len + 0.04, 0.3, 0.13);
        else if (d.wall === "rack") rack(m, 0.62, len - 0.1);
        else barrier(m, len, 0.42, d.pane ?? S.holoVi);
      };
      for (const [x, yaw] of [[-0.64, 0], [W + 0.64, 180]]) for (let y = -0.1; y < H + 0.4; y += 1.4) add({ build: (m) => seg(m, 1.38), x, y: y + 0.7, yaw });
      for (const y of [-0.64, H + 0.64]) for (let x = -0.6; x < W + 0.6; x += 1.4) {
        if (x + 0.7 > 2.9 && x + 0.7 < 6.1) continue;
        add({ build: (m) => { m.rotZ(90); seg(m, 1.38); }, x: x + 0.7, y, yaw: 90 });
      }
      for (const y of [-0.64, H + 0.64]) for (const x of [3.0, 6.0]) add({ build: (m) => beacon(m, 0.6, S.white), x, y, shadow: 0.2 });
      for (const [x, y] of lamps) add({ build: (m) => lampPost(m, 1.55, 0.44, d.lamp ?? (x < 0 ? S.mag : S.vi)), x, y, yaw: x < 0 ? 0 : 180, fg: true, shadow: 0.14 });
      d.skyline(add, r);
    },
    grade(g, w, h) {
      const hz = g.createLinearGradient(0, 0, 0, h * 0.4);
      hz.addColorStop(0, rgba(d.haze, 0.7)); hz.addColorStop(0.55, rgba(d.haze, 0.2)); hz.addColorStop(1, rgba(d.haze, 0));
      g.fillStyle = hz; g.fillRect(0, 0, w, h * 0.4);
      const vg = g.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, h * 0.75);
      vg.addColorStop(0, "rgba(4,3,20,0)"); vg.addColorStop(1, "rgba(4,3,20,0.5)");
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
    },
  };
}

// ---- shared skyline pieces
type Add = (it: SceneItem) => void;
const pickOf = <T,>(l: T[], r: () => number) => l[Math.floor(r() * l.length) % l.length];
/** Tower blocks down both sides of the yard. */
function blocks(add: Add, r: () => number, o: { walls?: Material[]; h?: [number, number]; x?: number; lit?: number; signs?: Material[] } = {}) {
  const walls = o.walls ?? [S.wall, S.wallDk, S.wallVi], [h0, h1] = o.h ?? [1.6, 3.4];
  for (const sx of [-1, 1]) for (let y = -3; y < 17; ) {
    const w = 1.8 + r() * 1.4, h = h0 + r() * (h1 - h0), wall = pickOf(walls, r), win = pickOf(WINS, r), sign = r() < 0.75 ? pickOf(o.signs ?? SIGNS, r) : null, seed = Math.floor(r() * 99);
    add({ build: (m) => tower(m, { w, d: 2.2, h, wall, win, lit: o.lit ?? 0.5, seed, sign }), x: sx < 0 ? -(o.x ?? 2.5) : W + (o.x ?? 2.5), y: y + w / 2, yaw: sx < 0 ? 0 : 180, shadow: 1.3 });
    y += w + 0.14;
  }
}
/** The far skyline beyond the rival's gate: two rows, the back one taller. */
function farRow(add: Add, r: () => number, o: { walls?: Material[]; h?: [number, number]; y?: number; gap?: boolean; signs?: Material[]; back?: boolean } = {}) {
  const walls = o.walls ?? [S.wall, S.wallDk, S.wallVi, S.wallBl], [h0, h1] = o.h ?? [2.2, 4.6];
  const row = (y: number, k: number) => {
    for (let x = -7.5; x < 16.5; ) {
      const w = 1.9 + r() * 1.5;
      if (!(o.gap && x + w > 3.3 && x < 5.7)) { const h = (h0 + r() * (h1 - h0)) * k, wall = pickOf(walls, r), win = pickOf(WINS, r), sign = r() < 0.8 ? pickOf(o.signs ?? SIGNS, r) : null, seed = Math.floor(r() * 99); add({ build: (m) => tower(m, { w, d: 2.2, h, wall, win, lit: 0.55, seed, sign }), x: x + w / 2, y, yaw: 90, shadow: 1.3 }); }
      x += w + 0.16;
    }
  };
  if (o.back !== false) row((o.y ?? -2.9) - 3.2, 1.6);
  row(o.y ?? -2.9, 1);
}
/** Sign blades and billboards leaning in over the board's edges (drawn over the units, fading under them). */
function signs(add: Add, cols: Material[], ys: [number, number][] = [[2.3, 9.0], [5.2, 11.9]]) {
  ys[0].forEach((y, i) => add({ build: (m) => billboard(m, 1.3, 0.7, 1.25, [S.holoMag, S.holoVi, S.holoBlue][i % 3], cols[i % cols.length]), x: -1.25, y, yaw: 20, fg: true }));
  ys[1].forEach((y, i) => add({ build: (m) => billboard(m, 1.3, 0.7, 1.25, [S.holoBlue, S.holoMag, S.holoVi][i % 3], cols[(i + 1) % cols.length]), x: W + 1.25, y, yaw: 160, fg: true }));
}

// ---- props (obstacles on the board): each fills the unit circle
const propMarket = [
  (m: Model) => { m.with(() => { m.move(-0.2, 0, 0).scale(1.25); stall(m, 1.3, S.mag); }); },
  (m: Model) => { m.with(() => { m.move(0, -0.42, 0).scale(1.3); vending(m, S.mag); }); m.with(() => { m.move(0, 0.42, 0).scale(1.3); vending(m, S.blue, S.wallVi); }); },
  (m: Model) => { m.with(() => { m.move(-0.3, -0.3, 0); crateStack(m, 0.9); }); m.with(() => { m.move(0.4, 0.3, 0); crateStack(m, 0.7, S.wallBl, S.green); }); m.with(() => { m.move(-0.2, -0.25, 0.9).rotZ(20); crateStack(m, 0.55, S.wallDk, S.mag); }); },
];
const propYard = [
  (m: Model) => { m.rotZ(25); m.scale(1.25); container(m, S.wallBl, 1.5); },
  (m: Model) => { m.scale(1.2); m.with(() => { m.move(0, 0, 0).rotZ(-20); container(m, S.wallVi, 1.4, S.mag); }); m.with(() => { m.move(0, 0, 0.72).rotZ(10); container(m, S.wallGr, 1.1, S.yel); }); },
  (m: Model) => { for (const [x, y, s] of [[-0.4, -0.3, 0.8], [0.4, 0.2, 0.7], [-0.1, 0.5, 0.6]]) m.with(() => { m.move(x, y, 0); crateStack(m, s, S.wallBl, S.yel); }); },
];
const propRoof = [
  (m: Model) => { m.scale(1.3); acUnit(m, 1.0); },
  (m: Model) => { m.cylinder([0, 0, 0], [0, 0, 0.16], 0.95, S.concrete, 0.9, { segs: 10 }); m.with(() => { m.move(0, 0, 0.16); dish(m, 1.3, 0.55); }); },
  (m: Model) => { m.with(() => { m.move(-0.35, 0, 0); acUnit(m, 0.75); }); m.with(() => { m.move(0.45, 0.2, 0); beacon(m, 0.9, S.red); }); m.with(() => { m.move(0.3, -0.45, 0); crateStack(m, 0.5, S.wallDk, S.white); }); },
];
const propServer = [
  (m: Model) => { for (const y of [-0.5, 0, 0.5]) m.with(() => { m.move(0, y, 0); rack(m, 1.5, 0.46, y ? S.green : S.vi, S.white); }); },
  (m: Model) => { m.with(() => { m.move(-0.3, 0, 0).rotZ(30); rack(m, 1.8, 0.7, S.green, S.mag); }); m.with(() => { m.move(0.45, 0.2, 0); rack(m, 1.0, 0.5, S.vi, S.green); }); },
  (m: Model) => { m.cylinder([0, 0, 0], [0, 0, 0.5], 0.9, S.wallDk, 0.8, { segs: 8 }); m.decal(0.02, () => m.torus([0, 0, 0.5], [0, 0, 1], 0.6, 0.04, S.green, { segs: 14 })); m.cylinder([0, 0, 0.5], [0, 0, 1.4], 0.2, S.holoVi, 0.3, { segs: 8 }); },
];
const propArcade = [
  (m: Model) => { for (const [y, c] of [[-0.45, S.mag], [0.45, S.yel]] as [number, Material][]) m.with(() => { m.move(0, y, 0).scale(1.3); vending(m, c, S.wallVi); }); },
  (m: Model) => { m.scale(1.1); billboard(m, 1.5, 0.9, 0.5, S.holoMag, S.yel); m.box([0, 0, 0.12], [0.5, 1.6, 0.24], S.wallDk); },
  (m: Model) => { m.cylinder([0, 0, 0], [0, 0, 0.3], 0.95, S.wallVi, 0.9, { segs: 10 }); m.with(() => { m.move(0, 0, 0.3).scale(1.2); tree(m, 1.5, S.leafPink); }); },
];
const propCoolant = [
  (m: Model) => { m.scale(0.9); tank(m, 0.9, 1.5, S.wallBl, S.ice); },
  (m: Model) => { for (const [x, z] of [[-0.3, 0.3], [0.3, 0.3], [0, 0.72]]) m.with(() => { m.move(x, 0, 0); pipeRun(m, 1.7, z, 0.24, S.metal, S.ice); }); },
  (m: Model) => { m.box([0, 0, 0.3], [1.3, 1.3, 0.6], S.concrete); m.decal(0.02, () => m.cylinder([0, 0, 0.6], [0, 0, 0.62], 0.5, S.coolant, 0.5, { segs: 12 })); m.cylinder([0.45, 0.45, 0.6], [0.45, 0.45, 1.2], 0.06, S.metal, 0.06, { segs: 6 }); m.sphere([0.45, 0.45, 1.25], 0.08, S.ice, { segs: 6 }); },
];
const propRail = [
  (m: Model) => { m.box([0, 0, 0.8], [0.9, 0.9, 1.6], S.concrete); m.decal(0.02, () => m.box([0.45, 0, 1.0], [0.02, 0.6, 0.12], S.mag)); m.box([0, 0, 1.66], [1.2, 1.2, 0.12], S.wallDk); },
  (m: Model) => { m.rotZ(20); m.with(() => { m.move(0, 0, 0.06); railcar(m, 1.7, S.winWarm); }); m.box([0, 0, 0.04], [0.9, 1.8, 0.08], S.dark); },
  (m: Model) => { m.cylinder([0, 0, 0], [0, 0, 0.2], 0.95, S.wallDk, 0.9, { segs: 10 }); m.with(() => { m.move(0, 0, 0.2).scale(1.1); billboard(m, 1.2, 0.8, 0.5, S.holoBlue, S.white); }); },
];
const propGrow = [
  (m: Model) => { m.cylinder([0, 0, 0], [0, 0, 0.3], 0.95, S.concrete, 0.9, { segs: 10 }); m.with(() => { m.move(0, 0, 0.3).scale(1.3); tree(m, 1.6, S.leaf); }); },
  (m: Model) => { m.scale(0.85); tank(m, 0.85, 1.4, S.wallGr, S.toxic); },
  (m: Model) => { for (const [x, y] of [[-0.4, -0.35], [0.4, -0.2], [0, 0.45]]) m.with(() => { m.move(x, y, 0); tree(m, 1.0 + 0.3 * x, x > 0 ? S.leafPink : S.leaf); }); },
];
const propDock = [
  (m: Model) => { m.rotZ(-15); m.scale(1.25); container(m, S.wallGr, 1.5, S.white); },
  (m: Model) => { m.cylinder([0, 0, 0], [0, 0, 0.5], 0.5, S.dark, 0.6, { segs: 10 }); m.cylinder([0, 0, 0.5], [0, 0, 0.7], 0.7, S.metal, 0.7, { segs: 10 }); m.sphere([0, 0, 0.8], 0.16, S.yel, { segs: 8 }); for (const a of [0, 2.1, 4.2]) m.with(() => { m.move(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0); beacon(m, 0.35, S.blue); }); },
  (m: Model) => { m.with(() => { m.move(-0.25, 0, 0).rotZ(40); container(m, S.wallBl, 1.2, S.yel); }); m.with(() => { m.move(0.5, 0.3, 0); crateStack(m, 0.6, S.wallVi, S.white); }); },
];
const propPlaza = [
  (m: Model) => { m.scale(1.05); fountain(m, 0.92, S.holoMag); },
  (m: Model) => { m.cylinder([0, 0, 0], [0, 0, 0.5], 0.9, S.marble, 0.8, { segs: 8 }); m.decal(0.02, () => m.torus([0, 0, 0.5], [0, 0, 1], 0.66, 0.035, S.gold, { segs: 14 })); m.with(() => { m.move(0, 0, 1.2).rotZ(45).rotY(35); m.box([0, 0, 0], [0.62, 0.62, 0.62], S.holoVi); }); },
  (m: Model) => { m.box([0, 0, 0.2], [1.5, 1.5, 0.4], S.marble); m.decal(0.02, () => m.box([0.75, 0, 0.34], [0.02, 1.3, 0.04], S.gold)); m.with(() => { m.move(0, 0, 0.4).scale(1.2); tree(m, 1.5, S.leafPink); }); },
];

// ------------------------------------------------------------------------------------------------ the ten acts
const acts: District[] = [
  { // 1
    name: "Night Market", obstacle: "stalls", edge: "#0d0c24", floor: "slabs", yard: ["#272b55", "#24284f", "#2a2f5b"], strip: ["#1c1e40", "#23264c"], street: ["#171936", "#15172f"],
    line: "#8a90e0", kerb: "#ff3fd8", a: "#ff3fd8", b: "#7a5cff", haze: "#3a1a66", wall: "barrier", pane: S.holoMag,
    decals(p) {
      for (const [x, y] of [[1.5, 3.3], [7.4, 10.7], [7.5, 4.3]] as Pt[]) p.cover(x, y, 0.3, "#1b1d3c", "#353a78");
      for (const [x, y, c] of [[2.1, 9.7, "#ff3fd8"], [6.9, 2.7, "#7a5cff"], [6.6, 12.1, "#ff3fd8"], [1.3, 5.0, "#7a5cff"]] as [number, number, string][]) p.puddle(x, y, 0.42, "#141433", c);
    },
    skyline(add, r) {
      blocks(add, r); farRow(add, r, { gap: true });
      signs(add, [S.yel, S.white, S.green]);
      for (const x of [1.2, 2.4, 6.6, 7.8]) add({ build: (m) => stall(m, 1.0, pickOf([S.mag, S.yel, S.green, S.vi], r)), x, y: -1.45, yaw: 90, shadow: 0.5 });
    },
    props: propMarket,
    ambient: { shade: 0.25, gust: null, motes: [RAIN, { kind: "blink", n: 8, colors: ["#ff8af0", "#fff3a0"], size: 0.026 }], butterflies: 0, flock: null },
  },
  { // 2
    name: "Stack Yard", obstacle: "containers", edge: "#0b1026", floor: "deck", yard: ["#232e52", "#202a4b", "#263258"], strip: ["#191f3c", "#1f2748"], street: ["#141a34", "#12172e"],
    line: "#ffe14d", kerb: "#ffe14d", a: "#4d7dff", b: "#ffe14d", haze: "#182a5c", wall: "jersey", lamp: S.yel,
    decals(p) {
      for (const [x, y, w, h] of [[0.6, 2.6, 2.2, 1.3], [6.3, 9.6, 2.2, 1.3], [6.2, 3.0, 2.2, 1.3], [0.6, 10.6, 2.2, 1.3]]) { p.g.strokeStyle = rgba("#ffe14d", 0.4); p.g.lineWidth = 0.05; p.g.strokeRect(x, y, w, h); }
      for (const [x, y] of [[2.6, 12.0], [7.0, 1.2]] as Pt[]) p.puddle(x, y, 0.4, "#111530", "#4d7dff");
    },
    skyline(add, r) {
      for (const sx of [-1, 1]) for (let y = -2; y < 16; y += 1.7) { const n = 1 + Math.floor(r() * 3); for (let k = 0; k < n; k++) add({ build: (m) => { m.move(0, 0, k * 0.74); container(m, pickOf([S.wallBl, S.wallVi, S.wallGr, S.wallDk], r), 1.6, pickOf([S.yel, S.white, S.mag], r)); }, x: sx < 0 ? -2.0 - (k % 2) * 0.1 : W + 2.0, y, yaw: sx < 0 ? 0 : 180, shadow: 0.9 }); }
      for (let x = -6; x < 15; x += 1.75) { if (x > 2.6 && x < 5.4) continue; const n = 1 + Math.floor(r() * 4); for (let k = 0; k < n; k++) add({ build: (m) => { m.rotZ(90); m.move(0, 0, k * 0.74); container(m, pickOf([S.wallBl, S.wallVi, S.wallGr, S.wallDk], r), 1.6, pickOf([S.yel, S.white, S.mag], r)); }, x: x + 0.8, y: -2.2, yaw: 90, shadow: 0.9 }); }
      add({ build: (m) => crane(m, 4.4, 5.5), x: 4.5, y: -4.2, yaw: 90 });
      add({ build: (m) => crane(m, 3.6, 3), x: -4.4, y: 3, yaw: 0 }); add({ build: (m) => crane(m, 3.6, 3), x: W + 4.4, y: 9, yaw: 180 });
      farRow(add, r, { y: -6.5, back: false, h: [3, 5] });
    },
    props: propYard,
    ambient: { shade: 0.2, gust: null, motes: [RAIN, { kind: "blink", n: 6, colors: ["#ffe14d"], size: 0.03 }], butterflies: 0, flock: null },
  },
  { // 3
    name: "Helipad Nine", obstacle: "vents", edge: "#07061a", floor: "tiles", yard: ["#2c2c58", "#292952", "#30305e"], strip: ["#1e1e44", "#25254e"], street: ["#0c0b22", "#0b0a1f"],
    line: "#b9b4ff", kerb: "#ff2e5b", a: "#ff3fd8", b: "#4d7dff", haze: "#2a1050", wall: "parapet", lamp: S.red,
    decals(p) {
      // far below, the city: a spill of tiny lights beyond the roof's edge
      for (let i = 0; i < 500; i++) { const x = p.rand(-8, 17), y = p.rand(-17, 21); if (x > -1.2 && x < W + 1.2 && y > -1.2 && y < H + 1.2) continue; p.rect(x, y, p.rand(0.04, 0.14), 0.05, rgba(p.pick(["#ff3fd8", "#7a5cff", "#4d7dff", "#fff0b8"]), p.rand(0.3, 0.8))); }
      for (const [x, y] of [[1.6, 3.0], [7.4, 11.0]] as Pt[]) { neonLine(p, ring(x, y, 0.55, 20), "#ffe14d", 0.03, 0.7); }
      for (const [x, y] of [[7.2, 3.2], [1.8, 10.6]] as Pt[]) p.puddle(x, y, 0.4, "#15143a", "#ff3fd8");
    },
    skyline(add, r) {
      farRow(add, r, { y: -5.5, h: [4, 7] });
      for (const [x, y] of [[-1.9, 1.5], [-2.2, 6.5], [-1.9, 11.5], [W + 1.9, 3.5], [W + 2.2, 8.5], [W + 1.9, 13]] as Pt[]) add({ build: (m) => acUnit(m, 0.9), x, y, yaw: x < 0 ? 0 : 180, shadow: 0.6 });
      for (const [x, y] of [[-2.6, 4], [W + 2.6, 11], [1.2, -1.8], [7.8, -1.8]] as Pt[]) add({ build: (m) => dish(m, 1.4, 0.5), x, y, yaw: 60, shadow: 0.3 });
      add({ build: (m) => tank(m, 0.8, 1.6, S.wallDk, S.mag), x: -2.6, y: 9, shadow: 0.8 }); add({ build: (m) => tank(m, 0.8, 1.6, S.wallDk, S.blue), x: W + 2.6, y: 0.5, shadow: 0.8 });
      for (const x of [-1.2, W + 1.2]) for (const y of [-1.2, H + 1.2]) add({ build: (m) => beacon(m, 0.5, S.red), x, y });
    },
    props: propRoof,
    ambient: { shade: 0.2, gust: "#b9b4ff", motes: [RAIN, { kind: "blink", n: 8, colors: ["#ff2e5b"], size: 0.03 }], butterflies: 0, flock: null },
  },
  { // 4
    name: "Server Hall", obstacle: "racks", edge: "#06141c", floor: "grate", yard: ["#1e3144", "#1b2d3f", "#21354a"], strip: ["#152634", "#1a2d3d"], street: ["#0e1c28", "#0c1822"],
    line: "#5dffa0", kerb: "#5dffa0", a: "#5dffa0", b: "#9a6bff", haze: "#0e3a3a", wall: "rack", lamp: S.green,
    decals(p) {
      for (const y of [2.2, 4.4, 9.6, 11.8]) neonLine(p, [[0.4, y], [2.6, y]], "#5dffa0", 0.02, 0.5), neonLine(p, [[6.4, y], [8.6, y]], "#9a6bff", 0.02, 0.5);
    },
    skyline(add, r) {
      for (const sx of [-1, 1]) for (let y = -2.5; y < 16.5; y += 0.9) for (const k of [0, 1]) add({ build: (m) => rack(m, 1.8 + k * 1.2 + r() * 0.4, 0.8, pickOf([S.green, S.vi, S.white], r), pickOf([S.vi, S.mag], r)), x: sx < 0 ? -1.7 - k * 1.3 : W + 1.7 + k * 1.3, y, yaw: sx < 0 ? 0 : 180, shadow: 0.5 });
      for (let x = -7; x < 16; x += 0.9) { if (x > 2.8 && x < 5.4) continue; for (const k of [0, 1]) add({ build: (m) => { m.rotZ(90); rack(m, 2.2 + k * 1.6 + r() * 0.6, 0.8, pickOf([S.green, S.vi], r), S.white); }, x: x + 0.4, y: -1.9 - k * 1.5, yaw: 90, shadow: 0.5 }); }
      add({ build: (m) => tower(m, { w: 3, d: 2, h: 5.5, wall: S.wallGr, win: S.winGreen, lit: 0.8, seed: 4, sign: S.green, roof: "antenna" }), x: 4.5, y: -5.6, yaw: 90 });
    },
    props: propServer,
    ambient: { shade: 0.1, gust: null, motes: [{ kind: "blink", n: 18, colors: ["#5dffa0", "#b9a0ff"], size: 0.024 }, { kind: "rise", n: 8, colors: ["#5dffa0"], size: 0.016 }], butterflies: 0, flock: null },
  },
  { // 5
    name: "Arcade Row", obstacle: "cabinets", edge: "#140a2a", floor: "tiles", yard: ["#30265c", "#261f4e", "#30265c", "#2a2256"], strip: ["#20183f", "#281f4c"], street: ["#191233", "#17102e"],
    line: "#c9a0ff", kerb: "#ffe14d", a: "#ff3fd8", b: "#ffe14d", haze: "#4a1466", wall: "barrier", pane: S.holoBlue, lamp: S.mag,
    decals(p) {
      for (const [x, y, c] of [[1.4, 2.2, "#ff3fd8"], [7.6, 12.0, "#ffe14d"], [7.4, 3.4, "#4d7dff"], [1.5, 11.0, "#ff3fd8"]] as [number, number, string][]) { for (let k = 0; k < 3; k++) neonLine(p, [[x - 0.5 + k * 0.3, y - 0.3], [x - 0.2 + k * 0.3, y], [x - 0.5 + k * 0.3, y + 0.3]], c, 0.03, 0.55); }
      for (const [x, y] of [[2.4, 9.2], [6.4, 4.9]] as Pt[]) p.puddle(x, y, 0.4, "#1a1238", "#ffe14d");
    },
    skyline(add, r) {
      blocks(add, r, { walls: [S.wallVi, S.wall, S.wallDk], h: [2, 3.8], signs: [S.mag, S.yel, S.blue, S.white], lit: 0.65 });
      farRow(add, r, { walls: [S.wallVi, S.wall], signs: [S.mag, S.yel, S.blue], gap: true });
      signs(add, [S.yel, S.white, S.mag], [[1.8, 5.0, 10.0], [3.4, 8.9, 12.2]] as unknown as [number, number][]);
      add({ build: (m) => billboard(m, 2.8, 1.5, 2.6, S.holoMag, S.yel), x: 4.5, y: -2.4, yaw: 90 });
    },
    props: propArcade,
    ambient: { shade: 0.2, gust: null, motes: [RAIN, { kind: "blink", n: 14, colors: ["#ff8af0", "#fff3a0", "#9ab4ff"], size: 0.028 }], butterflies: 0, flock: null },
  },
  { // 6
    name: "Coolant Works", obstacle: "tanks", edge: "#0c1830", floor: "slabs", yard: ["#33456e", "#2f4067", "#374a75"], strip: ["#243352", "#2a3a5c"], street: ["#18233f", "#152038"],
    line: "#d6ecff", kerb: "#d6ecff", a: "#d6ecff", b: "#7a5cff", haze: "#3a5a8a", wall: "pipe", lamp: S.ice,
    decals(p) {
      // frost creeping in from the pipes, and two coolant channels
      for (const y of [1.6, 12.4]) { p.line([[-0.5, y], [3.0, y]], "#0f1a34", 0.34); p.line([[-0.5, y], [3.0, y]], "#9fe8d8", 0.2, 0.7); p.line([[6.0, y], [9.5, y]], "#0f1a34", 0.34); p.line([[6.0, y], [9.5, y]], "#9fe8d8", 0.2, 0.7); }
      p.mottle(-0.5, -0.5, 1.6, H + 1, "#e6f3ff", { n: 24, alpha: 0.12, size: [0.3, 0.9] }); p.mottle(W - 1.1, -0.5, 1.6, H + 1, "#e6f3ff", { n: 24, alpha: 0.12, size: [0.3, 0.9] });
    },
    skyline(add, r) {
      for (const sx of [-1, 1]) for (let y = -2; y < 16; y += 2.6) add({ build: (m) => tank(m, 0.9 + r() * 0.3, 1.8 + r() * 1.4, pickOf([S.wallBl, S.wallDk, S.concrete], r), S.ice), x: sx < 0 ? -2.3 : W + 2.3, y: y + r(), shadow: 1.0 });
      for (let x = -6.5; x < 16; x += 2.5) { if (x > 2.2 && x < 5.4) continue; add({ build: (m) => tank(m, 1.0 + r() * 0.3, 2.4 + r() * 2, pickOf([S.wallBl, S.wallDk], r), S.ice), x: x + 1, y: -2.6, shadow: 1.0 }); }
      farRow(add, r, { y: -6, back: false, walls: [S.wallBl, S.wallDk], h: [3.5, 6] });
      for (const [x, y] of [[-1.3, 3], [-1.3, 9], [W + 1.3, 6], [W + 1.3, 12]] as Pt[]) add({ build: (m) => pipeRun(m, 2.6, 0.9, 0.2, S.metal, S.ice), x, y, yaw: x < 0 ? 0 : 180, fg: true });
    },
    props: propCoolant,
    ambient: { shade: 0.2, gust: "#e6f3ff", motes: [{ kind: "rise", n: 14, colors: ["#e6f3ff", "#b9d8ff"], size: 0.03 }, { kind: "fall", n: 14, colors: ["#ffffff"], size: 0.02 }], butterflies: 0, flock: null },
  },
  { // 7
    name: "Skyline Loop", obstacle: "pylons", edge: "#080a22", floor: "glass", yard: ["#1f2a5e", "#1c2656", "#222e66"], strip: ["#161c44", "#1b2250"], street: ["#0b0d28", "#0a0b24"],
    line: "#7fa0ff", kerb: "#4d7dff", a: "#4d7dff", b: "#ff3fd8", haze: "#1a2a7a", wall: "barrier", pane: S.holoBlue, lamp: S.blue,
    decals(p) {
      for (let i = 0; i < 380; i++) { const x = p.rand(-8, 17), y = p.rand(-17, 21); if (x > -1.2 && x < W + 1.2 && y > -1.2 && y < H + 1.2) continue; p.rect(x, y, p.rand(0.04, 0.12), 0.05, rgba(p.pick(["#ff3fd8", "#4d7dff", "#fff0b8"]), p.rand(0.3, 0.8))); }
      for (const x of [1.5, 3, 6, 7.5]) for (const y of [2.2, 11.8]) neonLine(p, [[x - 0.3, y], [x + 0.3, y]], "#4d7dff", 0.025, 0.5);
    },
    skyline(add, r) {
      for (const sx of [-1, 1]) { for (let y = -4; y < 18; y += 4) add({ build: (m) => monorail(m, 4, 2.0, sx < 0 ? S.mag : S.blue), x: sx < 0 ? -2.2 : W + 2.2, y, yaw: sx < 0 ? 0 : 180, shadow: 0.3 }); }
      add({ build: (m) => { m.move(0, 0, 2.2); railcar(m, 2.2); }, x: -2.2, y: 5, yaw: 0 }); add({ build: (m) => { m.move(0, 0, 2.2); railcar(m, 2.2, S.winPink); }, x: W + 2.2, y: 10.5, yaw: 180 });
      farRow(add, r, { y: -4.2, h: [4, 7.5], walls: [S.wallBl, S.wall, S.wallDk] });
      signs(add, [S.white, S.mag]);
    },
    props: propRail,
    ambient: { shade: 0.15, gust: "#7fa0ff", motes: [RAIN, { kind: "drift", n: 8, colors: ["#9ab4ff"], size: 0.022 }], butterflies: 0, flock: null },
  },
  { // 8
    name: "The Undergrowth", obstacle: "planters", edge: "#06160f", floor: "slabs", yard: ["#1f3a3c", "#1c3537", "#224042"], strip: ["#152a2c", "#1a3133"], street: ["#0f2022", "#0d1c1e"],
    line: "#9dff4a", kerb: "#9dff4a", a: "#9dff4a", b: "#ff3fd8", haze: "#14402c", wall: "parapet", lamp: S.toxic,
    decals(p) {
      p.mottle(0, 0, W, H, "#3fd890", { n: 34, alpha: 0.1, size: [0.3, 1.0] });
      for (const [x, y] of [[1.6, 2.6], [7.3, 11.4], [7.6, 4.8], [1.4, 10.2]] as Pt[]) { p.puddle(x, y, 0.45, "#0f2a1c", "#9dff4a"); p.glow(x, y, 0.9, "#9dff4a", 0.12, "lighter"); }
    },
    skyline(add, r) {
      for (const sx of [-1, 1]) for (let y = -2.5; y < 16.5; y += 1.3) add({ build: (m) => tree(m, 1.4 + r() * 1.2, r() < 0.25 ? S.leafPink : S.leaf), x: (sx < 0 ? -1.6 : W + 1.6) + sx * r() * 1.2, y, shadow: 0.5 });
      for (let x = -7; x < 16; x += 1.3) { if (x > 2.8 && x < 5.4) continue; add({ build: (m) => tree(m, 1.6 + r() * 1.6, r() < 0.25 ? S.leafPink : S.leaf), x: x + 0.5, y: -1.6 - r(), shadow: 0.5 }); }
      blocks(add, r, { x: 4.4, walls: [S.wallGr, S.wallDk], h: [2.4, 4], signs: [S.green, S.mag] });
      farRow(add, r, { y: -4.4, walls: [S.wallGr, S.wallDk, S.wall], signs: [S.green, S.mag, S.yel] });
      for (const [x, y] of [[-2.4, 3.5], [W + 2.4, 9.5]] as Pt[]) add({ build: (m) => tank(m, 0.8, 1.7, S.wallGr, S.toxic), x, y, shadow: 0.8 });
    },
    props: propGrow,
    ambient: { shade: 0.3, gust: null, motes: [{ kind: "blink", n: 18, colors: ["#c9ff8a", "#9dff4a"], size: 0.028 }, { kind: "drift", n: 8, colors: ["#ff8ad8"], size: 0.03, leaf: true }], butterflies: 0, flock: null },
  },
  { // 9
    name: "The Spillway", obstacle: "bollards", edge: "#060c26", floor: "deck", yard: ["#253660", "#223259", "#283a66"], strip: ["#1a2748", "#1f2e52"], street: ["#101c48", "#0e1940"],
    line: "#9ab4ff", kerb: "#4d7dff", a: "#4d7dff", b: "#f4f0ff", haze: "#12246a", wall: "jersey", lamp: S.white,
    decals(p) {
      // black water round the pier, lit ripples on it
      for (let i = 0; i < 160; i++) { const x = p.rand(-8, 17), y = p.rand(-17, 21); if (x > -1.4 && x < W + 1.4 && y > -1.4 && y < H + 1.4) continue; const w = p.rand(0.4, 1.4); p.line([[x, y], [x + w, y]], p.pick(["#4d7dff", "#9ab4ff", "#ff3fd8"]), 0.04, p.rand(0.15, 0.45)); }
      for (const [x, y] of [[1.8, 4.4], [7.2, 9.6], [6.8, 2.4]] as Pt[]) p.puddle(x, y, 0.45, "#0e1634", "#9ab4ff");
    },
    skyline(add, r) {
      add({ build: (m) => crane(m, 4.6, 4), x: -3.4, y: 2.5, yaw: 0 }); add({ build: (m) => crane(m, 4.6, 4), x: W + 3.4, y: 8.5, yaw: 180 });
      for (const [x, y] of [[-2, 6.5], [-2, 11.5], [W + 2, 1.5], [W + 2, 13]] as Pt[]) add({ build: (m) => container(m, pickOf([S.wallBl, S.wallGr], r), 1.6, S.white), x, y, yaw: x < 0 ? 0 : 180, shadow: 0.9 });
      for (let x = -6; x < 15; x += 1.8) { if (x > 2.4 && x < 5.4) continue; add({ build: (m) => { m.rotZ(90); container(m, pickOf([S.wallBl, S.wallVi, S.wallGr], r), 1.6, S.yel); }, x: x + 0.8, y: -1.9, yaw: 90, shadow: 0.9 }); }
      farRow(add, r, { y: -7, h: [3, 6.5], walls: [S.wallBl, S.wallDk] });
      for (const x of [-1.3, W + 1.3]) for (const y of [0, 4.6, 9.3, 14]) add({ build: (m) => beacon(m, 0.45, S.blue), x, y });
    },
    props: propDock,
    ambient: { shade: 0.2, gust: "#9ab4ff", motes: [RAIN, { kind: "drift", n: 8, colors: ["#c9d8ff"], size: 0.025 }], butterflies: 0, flock: null },
  },
  { // 10
    name: "Apex Plaza", obstacle: "holos", edge: "#120a22", floor: "glass", yard: ["#322c58", "#2c2750", "#383160"], strip: ["#3a1838", "#44203f"], street: ["#1a1432", "#17112c"],
    line: "#ffd14a", kerb: "#ffd14a", a: "#ff3fd8", b: "#ffd14a", haze: "#5a1a4a", wall: "parapet", lamp: S.gold,
    decals(p) {
      for (const [kx, ky] of KEEPS) neonLine(p, ring(kx, ky, 2.05), "#ffd14a", 0.025, 0.6);
      for (const [x, y] of [[1.5, 3.0], [7.5, 3.0], [1.5, 11.0], [7.5, 11.0]] as Pt[]) { neonLine(p, [[x, y - 0.5], [x + 0.5, y], [x, y + 0.5], [x - 0.5, y], [x, y - 0.5]], "#ffd14a", 0.025, 0.6); }
    },
    skyline(add, r) {
      blocks(add, r, { walls: [S.wallVi, S.wallDk], h: [2.6, 4.4], signs: [S.mag, S.white, S.yel], lit: 0.7 });
      farRow(add, r, { walls: [S.wallVi, S.wallDk, S.wall], signs: [S.mag, S.white], h: [3, 5.5], gap: true, y: -3.4 });
      add({ build: (m) => tower(m, { w: 3.4, d: 2.6, h: 9, wall: S.wallVi, win: S.winWarm, lit: 0.85, seed: 10, sign: S.mag, roof: "antenna", band: S.gold }), x: 4.5, y: -6.2, yaw: 90 });
      for (const [x, y] of [[-1.5, 2], [-1.5, 8.5], [W + 1.5, 5.5], [W + 1.5, 12]] as Pt[]) add({ build: (m) => tree(m, 1.5, S.leafPink), x, y, shadow: 0.4 });
      signs(add, [S.white, S.gold]);
    },
    props: propPlaza,
    ambient: { shade: 0.2, gust: null, motes: [RAIN, { kind: "blink", n: 12, colors: ["#ffd14a", "#ff8af0"], size: 0.028 }], butterflies: 0, flock: null },
  },
];

export const ARENAS: ArenaArt = { acts: acts.map(district) };
