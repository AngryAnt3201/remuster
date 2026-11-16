// Brasswick's ten battlefields: one city district per campaign act. They share a family look (a paved yard between
// two great cog plazas, a kerbed strip across the middle, a tramway from keep to keep, gaslit walls) and each has its
// own floor, landmark, palette and props.
import type { ArenaArt, ArenaDef, SceneItem } from "../../../artkit/arena";
import { Painter, rgba, shade, spline, type Pt } from "../../../artkit/paint";
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { P, boiler, dial, gear, lantern, stack } from "./parts";
import { S, airship, awning, barrel, bigGear, bollard, clockTower, crane, crate, furnace, gasometer, heap, house, lampPost, pillar, pipeRun, railing, smokestack, tank, tree, wagon, wallSeg } from "./scenery";

const W = 9, H = 14, STRIP0 = 5.9, STRIP1 = 8.1;
const KEEPS: Pt[] = [[4.5, 13.4], [4.5, 1.55]];
/** The tramway between the keeps. */
const PATH: Pt[] = spline([[4.5, 14.6], [4.5, 12.4], [4.9, 10.2], [4.3, 7.0], [4.0, 4.4], [4.5, 2.4], [4.5, -0.8], [4.5, -6]], 0.15);
function ribbon(path: Pt[], w: number): Pt[] {
  const a: Pt[] = [], b: Pt[] = [];
  path.forEach(([x, y], i) => { const [px, py] = path[Math.max(0, i - 1)], [qx, qy] = path[Math.min(path.length - 1, i + 1)], d = Math.hypot(qx - px, qy - py) || 1; const nx = -(qy - py) / d, ny = (qx - px) / d; a.push([x + nx * w / 2, y + ny * w / 2]); b.push([x - nx * w / 2, y - ny * w / 2]); });
  return [...a, ...b.reverse()];
}
const polyPath = (pts: Pt[]) => (g: CanvasRenderingContext2D) => pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));

type Floor = (p: Painter, x: number, y: number, w: number, h: number, colors: string[]) => void;
const FLOORS: Record<string, Floor> = {
  cobbles: (p, x, y, w, h, c) => p.cobbles(x, y, w, h, c, { size: 0.3, gap: shade(c[0], -0.45) }),
  setts: (p, x, y, w, h, c) => p.slabs(x, y, w, h, c, { sw: 0.42, sh: 0.24, joint: 0.03 }),
  flags: (p, x, y, w, h, c) => p.slabs(x, y, w, h, c, { sw: 0.95, sh: 0.6, joint: 0.04 }),
  plates: (p, x, y, w, h, c) => p.slabs(x, y, w, h, c, { sw: 1.2, sh: 0.8, joint: 0.045, rivets: rgba("#1c1a1d", 0.55), bond: 0 }),
  planks: (p, x, y, w, h, c) => p.planks(x, y, w, h, c, { width: 0.3 }),
  planksV: (p, x, y, w, h, c) => p.planks(x, y, w, h, c, { width: 0.3, vertical: true }),
  marble: (p, x, y, w, h, c) => p.slabs(x, y, w, h, c, { sw: 0.8, sh: 0.8, joint: 0.025, bond: 0 }),
  plain: (p, x, y, w, h, c) => { p.rect(x, y, w, h, c[0]); p.mottle(x, y, w, h, c[1] ?? shade(c[0], 0.2), { alpha: 0.35, size: [0.3, 1.1] }); },
};

interface District {
  name: string; obstacle: string; edge: string; seed?: number;
  /** Floors: the yard (deploy zones), the strip across the middle, the streets outside the walls, the tramway. */
  yard: [keyof typeof FLOORS, string[]]; strip: [keyof typeof FLOORS, string[]]; street: [keyof typeof FLOORS, string[]]; way: [keyof typeof FLOORS, string[]];
  kerb: string; cog: string; rails?: boolean;
  /** Light pooling under the lamps, and the smog that hangs over the far end. */
  glow?: string; haze: string;
  wall?: "brick" | "rail" | "pipe" | "rope" | "stone";
  decals?(p: Painter): void;
  skyline(add: (it: SceneItem) => void, r: () => number): void;
  props: ((m: Model) => void)[];
  ambient?: ArenaDef["ambient"];
  lamp?: Material;
}

function district(d: District): ArenaDef {
  const inBoard = (x: number, y: number) => x > 0.3 && x < W - 0.3 && y > 0.3 && y < H - 0.3;
  const clearOf = (x: number, y: number) => inBoard(x, y) && !(y > STRIP0 - 0.3 && y < STRIP1 + 0.3) && KEEPS.every(([kx, ky]) => Math.hypot(x - kx, y - ky) > 2.1) && PATH.every(([px, py]) => Math.hypot(x - px, y - py) > 0.95);
  const lamps: Pt[] = [];
  for (const y of [0.9, 3.7, 7.0, 10.3, 13.1]) lamps.push([-0.5, y], [W + 0.5, y]);
  return {
    name: d.name, edge: d.edge, obstacle: d.obstacle, ambient: d.ambient, props: d.props,
    ground(p) {
      // streets outside, darker, then the walled yard
      FLOORS[d.street[0]](p, -8, -17, 25, 38, d.street[1]);
      p.rect(-8, -17, 25, 38, rgba("#120c14", 0.28));
      p.rect(-0.75, -0.75, W + 1.5, H + 1.5, shade(d.kerb, -0.35));
      p.clip((g) => g.rect(-0.55, -0.55, W + 1.1, H + 1.1), () => {
        FLOORS[d.yard[0]](p, -0.55, -0.55, W + 1.1, H + 1.1, d.yard[1]);
        p.mottle(-0.5, -0.5, W + 1, H + 1, "#1a1016", { n: 46, alpha: 0.09, size: [0.5, 1.8] });
        p.mottle(-0.5, -0.5, W + 1, H + 1, "#fff3d6", { n: 30, alpha: 0.06, size: [0.5, 1.6] });
      });
      // the strip between the two deploy zones, kerbed on each zone line
      p.clip((g) => g.rect(-0.55, STRIP0, W + 1.1, STRIP1 - STRIP0), () => FLOORS[d.strip[0]](p, -0.55, STRIP0, W + 1.1, STRIP1 - STRIP0, d.strip[1]));
      for (const y of [STRIP0, STRIP1]) { p.rect(-0.55, y - 0.09, W + 1.1, 0.18, d.kerb, 0.03); for (let x = -0.4; x < W + 0.5; x += 0.62) p.line([[x, y - 0.09], [x, y + 0.09]], rgba(p.ink, 0.5), 0.025); }
      // the tramway
      const rib = ribbon(PATH, 1.25);
      p.poly(ribbon(PATH, 1.45), shade(d.kerb, -0.2), 0);
      p.clip(polyPath(rib), () => FLOORS[d.way[0]](p, 2.5, -7, 4.5, 22, d.way[1]));
      if (d.rails !== false) p.rails(PATH, 0.5, { rail: "#b9c0c9", sleeper: shade(d.way[1][0], -0.35) });
      // a great cog set in the ground under each keep
      for (const [kx, ky] of KEEPS) {
        p.glow(kx, ky + 0.1, 2.4, "#140c14", 0.35, "source-over", 1.9);
        p.cog(kx, ky, 1.72, 18, d.cog, { tooth: 0.1, ink: 0.06, phase: 0.1 });
        p.circle(kx, ky, 1.42, shade(d.cog, -0.28), 0.05);
        p.clip((g) => g.arc(kx, ky, 1.36, 0, 7), () => FLOORS.setts(p, kx - 1.5, ky - 1.5, 3, 3, d.way[1]));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; p.circle(kx + Math.cos(a) * 1.57, ky + Math.sin(a) * 1.57, 0.06, shade(d.cog, 0.35), 0.02); }
      }
      d.decals?.(p);
      // wear, and gaslight pooling on the ground
      p.cracks(0, 0, W, H, 9);
      for (const [x, y] of lamps) p.glow(x + (x < 0 ? 0.7 : -0.7), y, 2.2, d.glow ?? "#ffcf7a", 0.26, "lighter", 1.7);
      void clearOf;
    },
    scenery(add, r) {
      const side = (x: number, yaw: number) => {
        for (let y = -0.1; y < H + 0.4; y += 1.4) {
          if (d.wall === "rail") add({ build: (m) => railing(m, 1.38), x, y: y + 0.7, yaw });
          else if (d.wall === "pipe") add({ build: (m) => pipeRun(m, 1.42, 0.3, 0.13, P.copper), x, y: y + 0.7, yaw });
          else if (d.wall === "rope") add({ build: (m) => { bollard(m, 0.45, S.plankDk, P.brass); m.tube([[0, 0, 0.36], [0, 0.7, 0.24], [0, 1.4, 0.36]], 0.03, S.canvas, { segs: 5 }); }, x, y, yaw });
          else add({ build: (m) => wallSeg(m, 1.4, 0.3, d.wall === "stone" ? S.stone : S.brick, d.wall === "stone" ? S.stoneLt : S.stone), x, y: y + 0.7, yaw });
        }
      };
      side(-0.62, 0); side(W + 0.62, 180);
      for (const y of [-0.62, H + 0.62]) for (let x = -0.6; x < W + 0.6; x += 1.4) {
        if (x + 0.7 > 2.9 && x + 0.7 < 6.1) continue;
        add({ build: (m) => (d.wall === "rail" ? railing(m, 1.38) : wallSeg(m, 1.4, 0.3, d.wall === "stone" ? S.stone : S.brick, d.wall === "stone" ? S.stoneLt : S.stone)), x: x + 0.7, y, yaw: 90 });
      }
      for (const y of [-0.62, H + 0.62]) for (const x of [3.0, 6.0]) add({ build: (m) => pillar(m, 0.95, d.wall === "stone" ? S.stoneLt : S.stone, d.lamp ?? P.lamp), x, y, shadow: 0.35 });
      for (const [x, y] of lamps) add({ build: (m) => lampPost(m, 1.55, 0.42, d.lamp ?? P.lamp), x, y, yaw: x < 0 ? 0 : 180, fg: true, shadow: 0.16 });
      d.skyline(add, r);
    },
    grade(g, w, h) {
      // smog over the far end, a soft vignette
      const hz = g.createLinearGradient(0, 0, 0, h * 0.42);
      hz.addColorStop(0, rgba(d.haze, 0.78)); hz.addColorStop(0.55, rgba(d.haze, 0.22)); hz.addColorStop(1, rgba(d.haze, 0));
      g.fillStyle = hz; g.fillRect(0, 0, w, h * 0.42);
      const vg = g.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, h * 0.75);
      vg.addColorStop(0, "rgba(20,10,24,0)"); vg.addColorStop(1, "rgba(20,10,24,0.42)");
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
    },
  };
}

// ---- shared skyline pieces
type Add = (it: SceneItem) => void;
/** Terraces down both sides of the yard. */
function terraces(add: Add, r: () => number, o: { wall?: Material[]; roof?: Material[]; lit?: number; x?: number; from?: number; to?: number } = {}) {
  const walls = o.wall ?? [S.brick, S.brickDk, S.brickLt], roofs = o.roof ?? [S.slate, S.slateDk, S.tile];
  for (const sx of [-1, 1]) for (let y = o.from ?? -2.5; y < (o.to ?? 17); ) {
    const w = 1.9 + r() * 1.3, h = 1.5 + r() * 1.2, wall = walls[Math.floor(r() * walls.length)], roof = roofs[Math.floor(r() * roofs.length)], seed = Math.floor(r() * 99), ch = 1 + Math.floor(r() * 2);
    add({ build: (m) => house(m, { w, d: 2.2, h, wall, roof, lit: o.lit ?? 0.55, chimneys: ch, seed }), x: sx < 0 ? -(o.x ?? 2.4) : W + (o.x ?? 2.4), y: y + w / 2, yaw: sx < 0 ? 0 : 180, shadow: 1.3 });
    y += w + 0.12;
  }
}
/** A far row of buildings beyond the rival's gate, with a gap for the tramway. */
function farRow(add: Add, r: () => number, y = -3.2, o: { wall?: Material[]; h?: number } = {}) {
  const walls = o.wall ?? [S.brick, S.brickDk, S.brickLt];
  for (let x = -7.5; x < 16.5; ) {
    const w = 2 + r() * 1.4;
    if (!(x + w > 3.1 && x < 5.9)) { const h = (o.h ?? 1.8) + r() * 1.5, wall = walls[Math.floor(r() * walls.length)], seed = Math.floor(r() * 99); add({ build: (m) => house(m, { w, d: 2.2, h, wall, lit: 0.6, seed, chimneys: 2 }), x: x + w / 2, y, yaw: 90, shadow: 1.3 }); }
    x += w + 0.15;
  }
}
const stacks = (add: Add, pts: [number, number, number][], col: Material = S.brick) => pts.forEach(([x, y, h]) => add({ build: (m) => smokestack(m, h, 0.36, true, col), x, y, shadow: 0.5 }));

// ---- props
const propCrates = [
  (m: Model) => { crate(m, 1.05); m.with(() => { m.move(0.1, -0.05, 1.05).rotZ(24); crate(m, 0.72, S.plankDk); }); m.with(() => { m.move(-0.62, 0.62, 0); barrel(m, 0.34, 0.8); }); },
  (m: Model) => { m.with(() => { m.move(-0.35, -0.3, 0); barrel(m, 0.5, 1.2); }); m.with(() => { m.move(0.45, 0.25, 0); barrel(m, 0.44, 1.0, S.plankDk, P.brass); }); m.with(() => { m.move(0.1, 0.1, 1.0).rotY(90); m.move(0, 0, -0.2); barrel(m, 0.3, 0.7); }); },
  (m: Model) => { m.cylinder([0, 0, 0], [0, 0, 0.2], 0.98, S.stoneDk, 0.9, { segs: 10 }); m.with(() => { m.move(0, 0, 0.2); lampPost(m, 2.2, 0); }); m.with(() => { m.move(0.5, 0.3, 0.2); crate(m, 0.5); }); },
];

// ------------------------------------------------------------------------------------------------ the ten acts
const C = {
  cobble: ["#8d7d72", "#827369", "#978679", "#89796c"], cobbleDk: ["#6a5d58", "#62564f", "#72645c"],
  sand: ["#c2ae90", "#b7a385", "#cbb89b"], sett: ["#a8998a", "#9c8d7f", "#b3a394"],
  iron: ["#6b7079", "#646973", "#737882"], ironDk: ["#4d5159", "#474b53", "#555962"],
  wood: ["#a17c57", "#96724f", "#ab8660"], woodDk: ["#765a40", "#6d523a", "#7f6247"],
  snow: ["#e6edf4", "#d6e0ea"], ice: ["#b5d9e8", "#c6e4ef", "#a9cfe0"],
  marble: ["#e2d9cb", "#d8cebf", "#ece4d7"], marbleDk: ["#8f7f8e", "#857687", "#998a97"],
  wet: ["#62706f", "#5a6867", "#6a7877"], brick: ["#9c6652", "#91604d", "#a66f5a"],
};

const acts: District[] = [
  { // 1
    name: "Cinder Row", obstacle: "crates", edge: "#4a4046", yard: ["cobbles", C.cobble], strip: ["flags", C.sand], street: ["cobbles", C.cobbleDk], way: ["setts", C.sett],
    kerb: "#cbbba0", cog: "#c79a4a", haze: "#6d6470",
    decals(p) {
      for (const [x, y] of [[1.4, 3.2], [7.3, 10.6], [7.6, 4.4], [1.6, 11.6]] as Pt[]) p.cover(x, y, 0.3);
      for (const [x, y] of [[2.2, 9.6], [6.9, 2.6], [6.4, 12.2]] as Pt[]) p.puddle(x, y, 0.42);
    },
    skyline(add, r) {
      terraces(add, r); farRow(add, r);
      stacks(add, [[-4.5, -6.5, 5.5], [13, -7.5, 6.5], [9.5, -9, 5]]);
      for (const [x, y] of [[-1.25, 2.2], [-1.25, 8.6]] as Pt[]) add({ build: (m) => awning(m, 1.7, 0.75), x, y, yaw: 0, fg: true });
      for (const [x, y] of [[W + 1.25, 5.4], [W + 1.25, 11.8]] as Pt[]) add({ build: (m) => awning(m, 1.7, 0.75), x, y, yaw: 180, fg: true });
    },
    props: propCrates,
    ambient: { shade: 0.5, gust: null, motes: [{ kind: "fall", n: 10, colors: ["#4a4448", "#6b6468"], size: 0.028 }, { kind: "drift", n: 8, colors: ["#f2ead8"], size: 0.03 }], butterflies: 0, flock: { n: 3, color: "#2a2228" } },
  },
  { // 2
    name: "The Foundry", obstacle: "ingots", edge: "#3b3034", yard: ["plates", C.iron], strip: ["cobbles", C.cobbleDk], street: ["plates", C.ironDk], way: ["flags", ["#8b7f78", "#827670"]],
    kerb: "#d0903e", cog: "#b8742c", haze: "#7a4a3a", glow: "#ff9a4d", lamp: P.fire, wall: "pipe",
    decals(p) {
      // channels of molten metal crossing the strip's edges
      for (const y of [STRIP0 + 0.55, STRIP1 - 0.55]) for (const [a, b] of [[-0.5, 2.9], [6.1, 9.5]]) { p.line([[a, y], [b, y]], "#2c2226", 0.34); p.line([[a, y], [b, y]], "#ff9d3a", 0.2); p.line([[a, y], [b, y]], "#ffe08a", 0.07); p.glow((a + b) / 2, y, 1.8, "#ff8a3c", 0.3, "lighter", 0.7); }
      for (const [x, y] of [[1.5, 2.6], [7.5, 11.2], [7.2, 3.6], [1.9, 10.8]] as Pt[]) p.cover(x, y, 0.36, "#3b3e46", "#26282e");
    },
    skyline(add, r) {
      for (const [x, y, s] of [[-2.6, 1.5, 1.4], [-2.8, 6.5, 1.7], [-2.6, 11.5, 1.4], [W + 2.6, 3.5, 1.6], [W + 2.8, 9, 1.5], [W + 2.6, 13.5, 1.3]]) add({ build: (m) => furnace(m, s), x, y, yaw: x < 0 ? 0 : 180, shadow: 1.1 * s });
      farRow(add, r, -3.4, { wall: [S.brickDk, S.brick], h: 2.4 });
      stacks(add, [[-5, -5.5, 7], [-1.5, -7, 6], [10.5, -6.5, 7.5], [14, -5, 6], [2, -9, 5], [7, -10, 5.5]], S.brickDk);
      for (const x of [-5.2, W + 5.2]) for (let y = -1; y < 16; y += 3.4) add({ build: (m) => house(m, { w: 3, d: 2.4, h: 2.6, wall: S.brickDk, flat: true, lit: 0.8, chimneys: 0, seed: Math.floor(y) }), x, y, yaw: x < 0 ? 0 : 180 });
    },
    props: [
      (m) => { m.group(() => { for (let k = 0; k < 3; k++) for (let i = 0; i < 3 - k; i++) m.box([0, -0.6 + i * 0.6 + k * 0.3, 0.16 + k * 0.3], [1.5, 0.52, 0.28], k === 2 ? S.molten : P.iron); }); },
      (m) => { m.box([0, 0, 0.3], [1.3, 1.3, 0.6], S.stoneDk); m.with(() => { m.move(0, 0, 0.6); m.extrude([[-0.8, 0.35], [0.9, 0.35], [0.5, 0.15], [0.3, 0], [-0.3, 0], [-0.4, 0.15]], 0.5, P.ironDk); }); },
      (m) => { m.lathe([[0.6, 0], [0.95, 0.5], [0.9, 1.0], [0.75, 1.0], [0.8, 0.5], [0, 0.4]], P.ironDk, { segs: 12 }); m.decal(0.05, () => m.cylinder([0, 0, 0.9], [0, 0, 0.92], 0.74, S.molten, 0.74, { segs: 12 })); },
    ],
    ambient: { shade: 0.3, gust: null, motes: [{ kind: "rise", n: 16, colors: ["#ffb04d", "#ff7a3d", "#ffe08a"], size: 0.03 }, { kind: "fall", n: 8, colors: ["#3b3438"], size: 0.03 }], butterflies: 0, flock: null },
  },
  { // 3
    name: "Clocktower Square", obstacle: "statue", edge: "#57505a", yard: ["flags", ["#b3a796", "#a99d8c", "#bcb09f"]], strip: ["marble", ["#d9cdb5", "#8f8376"]], street: ["cobbles", C.cobbleDk], way: ["setts", ["#c5b392", "#bba988"]],
    kerb: "#d8c48f", cog: "#d2a64e", haze: "#8b8494", wall: "rail",
    decals(p) {
      // a clock face inlaid across the strip
      p.circle(4.5, 7, 1.02, "#d2a64e", 0.05); p.circle(4.5, 7, 0.9, "#efe4c8", 0.03);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; p.line([[4.5 + Math.cos(a) * 0.7, 7 + Math.sin(a) * 0.7], [4.5 + Math.cos(a) * 0.84, 7 + Math.sin(a) * 0.84]], "#3a2a22", i % 3 ? 0.035 : 0.07); }
      p.line([[4.5, 7], [4.5, 6.36]], "#3a2a22", 0.07); p.line([[4.5, 7], [4.95, 7.2]], "#3a2a22", 0.09); p.circle(4.5, 7, 0.07, "#d2a64e", 0.02);
    },
    skyline(add, r) {
      terraces(add, r, { wall: [S.stone, S.stoneLt, S.brickLt], roof: [S.slate, S.verdigris] }); farRow(add, r, -3.4, { wall: [S.stone, S.stoneLt] });
      add({ build: (m) => clockTower(m, 6.5, 1.7), x: 7.6, y: -5.2, yaw: 90, shadow: 1.2 });
      for (const [x, y] of [[-1.3, 4.5], [-1.3, 10.5], [W + 1.3, 2.5], [W + 1.3, 8.5]] as Pt[]) add({ build: (m) => tree(m, 1.5), x, y, fg: true, shadow: 0.4 });
    },
    props: [
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.5], 0.98, S.stone, 0.8, { segs: 8 }); m.box([0, 0, 0.9], [0.8, 0.8, 0.8], S.stoneLt); m.with(() => { m.move(0, 0, 1.3); gear(m, 0.62, 0.14, P.brass, 10, 12); }); },
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.3], 0.98, S.stoneDk, 0.9, { segs: 10 }); m.cylinder([0, 0, 0.3], [0, 0, 1.5], 0.4, S.stoneLt, 0.34, { segs: 10 }); m.with(() => { m.move(0.3, 0, 1.3); dial(m, 0.4, 60); }); m.sphere([0, 0, 1.6], 0.3, P.brass); },
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.35], 0.98, S.stone, 0.92, { segs: 10 }); m.decal(0.02, () => m.cylinder([0, 0, 0.35], [0, 0, 0.36], 0.8, S.water, 0.8, { segs: 10 })); m.cylinder([0, 0, 0.3], [0, 0, 1.0], 0.16, S.stoneLt, 0.12, { segs: 8 }); m.sphere([0, 0, 1.1], 0.22, P.brass); },
    ],
    ambient: { shade: 0.7, gust: null, motes: [{ kind: "fall", n: 10, colors: ["#c9a24a", "#a8743a", "#d9c08a"], size: 0.05, leaf: true }], butterflies: 0, flock: { n: 5, color: "#3a3440" } },
  },
  { // 4
    name: "Railhead", obstacle: "coal", edge: "#463f3c", yard: ["plain", ["#857a6c", "#978b7c"]], strip: ["planks", C.woodDk], street: ["plain", ["#5e554c", "#6c6258"]], way: ["plain", ["#a39684", "#b1a493"]],
    kerb: "#c9b48a", cog: "#b98b45", haze: "#77706a",
    decals(p) {
      // sidings across the strip and through the yard edges
      for (const y of [STRIP0 + 0.6, STRIP1 - 0.6]) p.rails(spline([[-7, y], [16, y]], 0.14), 0.42, { sleeper: "#5a4230" });
      p.scatter(0.4, 0.4, 8.2, 13.2, 46, (x, y) => p.circle(x, y, p.rand(0.03, 0.07), p.pick(["#5b534b", "#a39887", "#3a3531"]), 0.012), (x, y) => !(y > STRIP0 && y < STRIP1));
      for (const [x, y] of [[1.6, 2.2], [7.4, 11.4]] as Pt[]) p.mottle(x - 0.6, y - 0.5, 1.2, 1, "#201a1c", { n: 8, alpha: 0.4, size: [0.15, 0.4] });
    },
    skyline(add, r) {
      for (const x of [-1.9, W + 1.9]) for (let y = -1; y < 16; y += 2.1) add({ build: (m) => wagon(m, [P.team, S.plank, P.ironDk, S.brick][Math.floor(r() * 4)], r() < 0.6 ? S.coal : null), x, y: y + r() * 0.3, yaw: 0, shadow: 0.8 });
      for (const x of [-4.2, W + 4.2]) for (let y = -2; y < 17; y += 4.5) add({ build: (m) => house(m, { w: 4, d: 2.6, h: 2.2, wall: S.brick, roof: S.slateDk, lit: 0.4, chimneys: 1, seed: Math.floor(y + 9) }), x, y, yaw: x < 0 ? 0 : 180 });
      farRow(add, r, -4.2, { h: 2.2 });
      for (const [x, y] of [[1.5, -1.9], [7.5, -1.9]] as Pt[]) add({ build: (m) => { m.cylinder([0, 0, 0], [0, 0, 2.2], 0.06, P.ironDk, 0.05, { segs: 6 }); m.box([0.3, 0, 2.0], [0.7, 0.05, 0.16], P.red); m.sphere([0, 0, 2.3], 0.1, P.lamp); }, x, y, shadow: 0.2 });
      stacks(add, [[-5, -7, 5], [13.5, -6.5, 6]]);
      add({ build: (m) => tank(m, 0.9, 2.0, S.plank), x: -1.9, y: -2.4, shadow: 0.9 });
    },
    props: [
      (m) => heap(m, 0.95, 0.7, S.coal),
      (m) => { m.box([0, 0, 0.25], [1.5, 1.5, 0.5], S.plankDk); m.box([0, 0, 0.7], [1.0, 1.6, 0.25], P.red); m.group(() => { for (const y of [-0.55, 0.55]) m.cylinder([0.45, y, 0.7], [0.75, y, 0.7], 0.16, P.ironDk, 0.2, { segs: 8 }); }); },
      (m) => { m.with(() => { m.scale(0.9); m.rotZ(30); wagon(m, S.brick, S.coal); }); },
    ],
    ambient: { shade: 0.8, gust: "#efe6d2", motes: [{ kind: "drift", n: 12, colors: ["#e9dfcb", "#cfc4ae"], size: 0.028 }], butterflies: 0, flock: { n: 3, color: "#2a2228" } },
  },
  { // 5
    name: "The Gasworks", obstacle: "valves", edge: "#34413f", yard: ["setts", ["#77847f", "#6e7b76", "#808d88"]], strip: ["plates", ["#59645f", "#515c57"]], street: ["cobbles", ["#4f5a57", "#485350"]], way: ["flags", ["#98a39a", "#8e9990"]],
    kerb: "#9fd0b2", cog: "#5fae98", haze: "#4f6b62", glow: "#b6ffb0", lamp: P.venom, wall: "pipe",
    decals(p) {
      for (const [x, y] of [[1.8, 3.4], [7.0, 2.2], [2.3, 11.8], [6.8, 10.2], [7.7, 12.6], [1.2, 9.2]] as Pt[]) p.puddle(x, y, p.rand(0.3, 0.5), "#2f4a44", "#c9ffe0");
      for (const [x, y] of [[7.6, 4.6], [1.4, 12.6]] as Pt[]) p.cover(x, y, 0.32, "#46524e", "#2b3431");
    },
    skyline(add, r) {
      for (const [x, y, s] of [[-3.3, 2.5, 1], [-3.5, 9.5, 1.15], [W + 3.3, 5.5, 1.1], [W + 3.4, 12.5, 0.95], [1, -4.6, 1.1], [8, -4.8, 1.2], [-4, -5, 1], [13, -5.4, 1.1]]) add({ build: (m) => { m.scale(s); gasometer(m); }, x, y, shadow: 1.9 * s });
      for (const x of [-1.5, W + 1.5]) for (let y = 0; y < 15; y += 3.2) add({ build: (m) => tank(m, 0.42, 1.1, r() < 0.5 ? P.copper : S.verdigris), x, y: y + 1.2, shadow: 0.5 });
      stacks(add, [[4.5 - 6, -8, 6], [4.5 + 6.5, -8.5, 6.5]], S.brickDk);
    },
    props: [
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.25], 0.98, P.ironDk, 0.9, { segs: 10 }); m.with(() => { m.move(0, 0, 0.25); boiler(m, 0.5, 1.0, S.verdigris, P.brass); }); m.with(() => { m.move(0.5, 0, 0.9); dial(m, 0.22, 20); }); },
      (m) => { m.tube([[-0.8, 0, 0], [-0.8, 0, 0.9], [0.8, 0, 0.9], [0.8, 0, 0]], 0.26, P.copper, { segs: 10 }); m.with(() => { m.move(0, 0, 1.25).rotX(90); gear(m, 0.45, 0.08, P.red, 6, 0, P.brass); }); m.cylinder([0, 0, 0.9], [0, 0, 1.25], 0.06, P.ironDk, 0.06, { segs: 6 }); },
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.2], 0.98, P.ironDk, 0.92, { segs: 10 }); m.with(() => { m.move(-0.3, 0.2, 0.2); stack(m, 0.3, 1.5, P.ironDk, P.brass); }); m.with(() => { m.move(0.4, -0.3, 0.2); boiler(m, 0.3, 0.6, P.copper, P.brass); }); },
    ],
    ambient: { shade: 0.4, gust: null, motes: [{ kind: "blink", n: 12, colors: ["#c9ffb0", "#e8ffd0"], size: 0.03 }, { kind: "drift", n: 8, colors: ["#dfeee6"], size: 0.035 }], butterflies: 0, flock: null },
  },
  { // 6
    name: "Coldharbour", obstacle: "icecrates", edge: "#cfdbe6", yard: ["plain", C.snow], strip: ["plain", C.ice], street: ["plain", ["#c3ceda", "#d5dee8"]], way: ["setts", ["#a9b3bf", "#9ea8b5", "#b4bdc8"]],
    kerb: "#8fa3b8", cog: "#9fb2c4", haze: "#dfe8f1", glow: "#ffe2a8",
    decals(p) {
      // a frozen canal under the strip: ice with skate scratches, snow banks either side
      for (let i = 0; i < 16; i++) { const x = p.rand(-0.3, 9), y = p.rand(STRIP0 + 0.25, STRIP1 - 0.25), a = p.rand(-0.5, 0.5); p.line([[x, y], [x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.3]], "#ffffff", 0.025, 0.7); }
      p.scatter(0.3, 0.3, 8.4, 13.4, 40, (x, y) => { p.circle(x, y, p.rand(0.1, 0.24), "#f7fbff", 0, p.rand(0.06, 0.12)); }, (x, y) => !(y > STRIP0 - 0.2 && y < STRIP1 + 0.2));
      p.scatter(0.4, 0.4, 8.2, 13.2, 26, (x, y) => { for (const dx of [0, 0.16]) p.circle(x + dx, y + dx * 0.4, 0.045, "#b9c6d4", 0, 0.07); }, (x, y) => !(y > STRIP0 - 0.2 && y < STRIP1 + 0.2));
    },
    skyline(add, r) {
      terraces(add, r, { roof: [S.snow], lit: 0.75 }); farRow(add, r, -3.3);
      for (const [x, y] of [[-1.3, 1.2], [-1.3, 12.2], [W + 1.3, 6.3]] as Pt[]) add({ build: (m) => heap(m, 0.7, 0.4, S.snow), x, y });
      stacks(add, [[-5, -6.5, 5.5], [12.5, -7, 6]]);
      add({ build: (m) => crane(m, 2.6, 2.0), x: W + 1.6, y: 2.2, yaw: 200, fg: true, shadow: 0.5 });
    },
    props: [
      (m) => { crate(m, 1.0); m.ellipsoid([0, 0, 1.0], [0.6, 0.6, 0.16], S.snow); m.with(() => { m.move(-0.6, 0.55, 0); barrel(m, 0.34, 0.8); m.ellipsoid([0, 0, 0.8], [0.3, 0.3, 0.1], S.snow); }); },
      (m) => { m.group(() => { for (const [x, y, h, r] of [[0, 0, 1.5, 0.5], [0.5, 0.3, 0.9, 0.36], [-0.45, 0.35, 0.7, 0.34], [0.2, -0.5, 0.8, 0.3]]) m.cone([x, y, 0], [x * 1.2, y * 1.2, h], r, S.ice, { segs: 6 }); }); heap(m, 0.95, 0.22, S.snow); },
      (m) => { heap(m, 0.95, 0.5, S.snow); m.with(() => { m.move(0, 0, 0.3); lampPost(m, 1.7, 0); }); },
    ],
    ambient: { shade: 0.5, gust: "#ffffff", motes: [{ kind: "fall", n: 32, colors: ["#ffffff", "#e8f4ff"], size: 0.032 }], butterflies: 0, flock: null },
  },
  { // 7
    name: "Skydock", obstacle: "moorings", edge: "#a9cbe6", yard: ["planks", C.wood], strip: ["plates", ["#8b939c", "#828a93"]], street: ["plain", ["#a9cbe6", "#c9e0f2"]], way: ["planksV", ["#c9a877", "#be9d6d", "#d2b281"]],
    kerb: "#d9b25e", cog: "#d9a94a", haze: "#d6e8f7", rails: false, wall: "rope", glow: "#fff0c0",
    decals(p) {
      // painted landing marks
      for (const [x, y] of [[2, 3.3], [7, 3.3], [2, 10.6], [7, 10.6]] as Pt[]) { p.g.save(); p.g.globalAlpha = 0.5; p.circle(x, y, 0.62, "#f3e3b0", 0); p.circle(x, y, 0.47, C.wood[0], 0); p.rect(x - 0.3, y - 0.07, 0.6, 0.14, "#f3e3b0"); p.g.restore(); }
    },
    skyline(add, r) {
      // the dock hangs in the sky: cloud banks, mooring masts, airships tethered off the edges
      const cloud = (x: number, y: number, s: number, fg = false) => add({ build: (m) => m.group(() => { for (let i = 0; i < 5; i++) m.sphere([Math.cos(i * 2.2) * 0.9 * s, Math.sin(i * 1.7) * 0.6 * s, 0.1 * i * s], (0.7 + 0.25 * ((i * 3) % 2)) * s, mat("#ffffff", { ink: false, shade: 0.35, emit: 0.3 }), { segs: 10 }); }), x, y, fg });
      for (let i = 0; i < 26; i++) { const sx = r() < 0.5 ? -1 : 1; cloud(sx < 0 ? -2.2 - r() * 5 : W + 2.2 + r() * 5, -6 + r() * 24, 0.8 + r() * 0.9); }
      for (let i = 0; i < 10; i++) cloud(-6 + r() * 21, -4 - r() * 9, 1 + r());
      add({ build: (m) => airship(m, 6.5, 0.6), x: 9.5, y: -6.5, yaw: 20 });
      add({ build: (m) => airship(m, 4.2, 0.4, S.canvas, P.red), x: -4.2, y: 4.5, yaw: 80 });
      add({ build: (m) => airship(m, 4.6, 0.4), x: W + 4.4, y: 9.5, yaw: 100 });
      for (const [x, y] of [[-1.2, 0.2], [-1.2, 7], [-1.2, 13.8], [W + 1.2, 0.2], [W + 1.2, 7], [W + 1.2, 13.8]] as Pt[]) add({ build: (m) => { m.cylinder([0, 0, 0], [0, 0, 2.6], 0.08, P.ironDk, 0.05, { segs: 6 }); m.poly([[0, 0, 2.5], [0, 0, 2.1], [0.7, 0, 2.3]], P.team); m.sphere([0, 0, 2.65], 0.09, P.lamp); }, x, y, yaw: x < 0 ? 0 : 180, fg: true });
    },
    props: [
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.3], 0.98, S.plankDk, 0.9, { segs: 10 }); m.cylinder([0, 0, 0.3], [0, 0, 1.0], 0.34, P.ironDk, 0.26, { segs: 8 }); m.sphere([0, 0, 1.05], 0.34, P.brass); m.torus([0, 0, 0.5], [0, 0, 1], 0.5, 0.11, S.canvas, { segs: 12 }); },
      (m) => { crate(m, 1.1, S.plank); m.with(() => { m.move(0.1, 0, 1.1); m.ellipsoid([0, 0, 0.3], [0.5, 0.42, 0.3], S.canvas); }); },
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.3], 0.98, S.plankDk, 0.92, { segs: 10 }); m.with(() => { m.move(0, 0, 0.3); boiler(m, 0.45, 0.9, P.copper, P.brass); }); m.with(() => { m.move(0, 0, 1.5).rotX(90); gear(m, 0.3, 0.06, P.brass, 8); }); },
    ],
    ambient: { shade: 0.6, gust: "#ffffff", motes: [{ kind: "drift", n: 10, colors: ["#ffffff"], size: 0.04 }], butterflies: 0, flock: { n: 5, color: "#ffffff" } },
  },
  { // 8
    name: "The Sump", obstacle: "pumps", edge: "#2f3e3a", yard: ["planks", ["#7c6e58", "#72644f", "#867761"]], strip: ["plain", ["#3f6660", "#4d7a72"]], street: ["plain", ["#35544f", "#3f625c"]], way: ["planksV", ["#9a8767", "#8f7c5d", "#a59272"]],
    kerb: "#6b5a44", cog: "#8a8f5a", haze: "#3f5a52", rails: false, glow: "#d8ffa0", lamp: P.venom, wall: "rope",
    decals(p) {
      // water under the strip, with ripples and floating scum
      for (let i = 0; i < 22; i++) { const x = p.rand(-0.4, 9.2), y = p.rand(STRIP0 + 0.25, STRIP1 - 0.25); p.line([[x, y], [x + p.rand(0.3, 0.8), y]], "#a9e0d0", 0.03, 0.5); }
      for (let i = 0; i < 9; i++) p.circle(p.rand(0, 9), p.rand(STRIP0 + 0.3, STRIP1 - 0.3), p.rand(0.12, 0.26), "#7fa35a", 0.02, p.rand(0.07, 0.14));
      p.mottle(0, 0, W, H, "#3b5a2f", { n: 30, alpha: 0.16, size: [0.3, 0.9] });
    },
    skyline(add, r) {
      for (const x of [-2.6, W + 2.6]) for (let y = -1.5; y < 16; y += 2.8) { const h = 1.2 + r() * 1.2; add({ build: (m) => { house(m, { w: 2.3, d: 2, h, wall: S.plank, roof: S.plankDk, lit: 0.6, chimneys: 1, seed: Math.floor(y + 5) }); }, x, y: y + r(), yaw: x < 0 ? 0 : 180, shadow: 1.2 }); }
      farRow(add, r, -3.6, { wall: [S.plank, S.plankDk, S.brickDk] });
      for (const [x, y] of [[-1.3, 3], [-1.3, 11], [W + 1.3, 5], [W + 1.3, 12.6]] as Pt[]) add({ build: (m) => { m.cylinder([0, 0, 0], [0, 0, 1.3], 0.07, S.plankDk, 0.06, { segs: 6 }); m.with(() => { m.move(0, 0, 1.3); lantern(m, 0.16, P.venom); }); }, x, y, fg: true });
      stacks(add, [[-4.5, -7, 4.5], [13, -6.5, 5]], S.brickDk);
    },
    props: [
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.3], 0.98, P.ironDk, 0.9, { segs: 10 }); m.cylinder([0, 0, 0.3], [0, 0, 1.1], 0.4, S.verdigris, 0.34, { segs: 10 }); m.tube([[0, 0, 1.0], [0.5, 0, 1.2], [0.8, 0, 0.9]], 0.14, P.copper, { segs: 8 }); m.with(() => { m.move(0, 0, 1.2).rotX(90); gear(m, 0.4, 0.07, P.red, 6, 0, P.brass); }); },
      (m) => { m.group(() => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; m.cylinder([Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0], [Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.9 + 0.3 * ((i * 5) % 3) / 2], 0.17, S.plankDk, 0.15, { segs: 6 }); } }); m.torus([0, 0, 0.5], [0, 0, 1], 0.76, 0.06, S.canvas, { segs: 12 }); },
      (m) => { m.with(() => { m.move(-0.3, 0, 0); barrel(m, 0.5, 1.1, S.plankDk, P.brassDk); }); m.with(() => { m.move(0.5, 0.3, 0); barrel(m, 0.36, 0.8, S.verdigris, P.ironDk); }); m.sphere([0.5, 0.3, 0.86], 0.14, P.venom); },
    ],
    ambient: { shade: 0.4, gust: null, motes: [{ kind: "blink", n: 16, colors: ["#d8ff8a", "#fff3a0"], size: 0.032 }, { kind: "drift", n: 6, colors: ["#e9f5e0"], size: 0.03 }], butterflies: 0, flock: null },
  },
  { // 9
    name: "Ironclad Quay", obstacle: "capstans", edge: "#55707e", yard: ["flags", ["#9a9d9c", "#909392", "#a4a7a6"]], strip: ["planks", ["#8a7a66", "#80705d", "#94846f"]], street: ["plain", ["#4c6a79", "#5b7b8a"]], way: ["setts", ["#b7b4a8", "#adaa9e"]],
    kerb: "#d0c7ae", cog: "#a7a08a", haze: "#8fa6b3", wall: "rope",
    decals(p) {
      for (const [x, y] of [[1.2, 2], [7.8, 2], [1.2, 12], [7.8, 12]] as Pt[]) { p.circle(x, y, 0.22, "#3d4148", 0.03); p.circle(x, y, 0.12, "#6b7079", 0.02); }
      for (let i = 0; i < 4; i++) p.puddle(p.rand(1, 8), p.rand(1, 13) > 7 ? p.rand(9, 13) : p.rand(1, 5), 0.36, "#48606c");
      // whitecaps on the water outside the quay walls
      for (let i = 0; i < 120; i++) { const sx = p.r() < 0.5, x = sx ? p.rand(-8, -1.4) : p.rand(W + 1.4, 17), y = p.rand(-16, 20); p.line([[x, y], [x + p.rand(0.3, 0.7), y]], "#dfeef5", 0.04, 0.55); }
    },
    skyline(add, r) {
      for (const [x, y, yaw] of [[-1.6, 2.4, 20], [-1.6, 10.2, 340], [W + 1.6, 5.6, 160], [W + 1.6, 12.6, 200]]) add({ build: (m) => crane(m, 2.8, 2.2), x, y, yaw, fg: true, shadow: 0.5 });
      // quay edges, and ironclads moored either side
      for (const x of [-1.15, W + 1.15]) for (let y = -0.6; y < 15; y += 1.5) add({ build: (m) => m.box([0, 0, -0.4], [0.5, 1.5, 0.8], S.stoneDk), x, y: y + 0.75 });
      const ship = (m: Model) => { m.extrude([[-3, 0.9], [3, 0.9], [3.6, 0], [3, -0.4], [-2.6, -0.4], [-3.2, 0.2]], 1.6, P.ironDk); m.box([0, 0, 1.2], [2.6, 1.1, 0.6], S.plank); m.decal(0.02, () => m.box([0, 0.56, 1.25], [2.2, 0.02, 0.24], S.window)); for (const x of [-0.6, 0.5]) m.with(() => { m.move(x, 0, 1.5); stack(m, 0.26, 1.4, P.ironDk, P.red); }); };
      add({ build: ship, x: -4.4, y: 6.5, yaw: 270 }); add({ build: ship, x: W + 4.4, y: 2.5, yaw: 90 }); add({ build: ship, x: W + 4.6, y: 12.5, yaw: 90 });
      farRow(add, r, -3.8, { wall: [S.brick, S.stone] });
      stacks(add, [[-5, -7, 5], [12.5, -7.5, 5.5]]);
    },
    props: [
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.25], 0.98, S.plankDk, 0.92, { segs: 10 }); m.lathe([[0.5, 0.25], [0.32, 0.6], [0.32, 1.0], [0.55, 1.15], [0, 1.25]], P.ironDk, { segs: 10 }); m.group(() => { for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; m.cylinder([0, 0, 1.0], [Math.cos(a) * 0.9, Math.sin(a) * 0.9, 1.0], 0.05, S.plank, 0.05, { segs: 5 }); } }); },
      (m) => { m.with(() => { m.rotY(-70).move(0.2, 0, 0.1); m.cylinder([0, 0, 0], [1.6, 0, 0], 0.09, P.ironDk, 0.09, { segs: 6 }); m.torus([1.7, 0, 0], [0, 1, 0], 0.16, 0.05, P.ironDk, { segs: 10 }); m.tube([[0.05, 0, -0.6], [0.0, 0, -0.2], [0, 0, 0.2], [0.05, 0, 0.6]], 0.1, P.ironDk, { segs: 6 }); }); m.torus([0, 0, 0.12], [0, 0, 1], 0.8, 0.12, S.canvas, { segs: 14 }); },
      (m) => { m.with(() => { m.move(-0.35, -0.2, 0); crate(m, 0.9); }); m.with(() => { m.move(0.45, 0.35, 0); barrel(m, 0.4, 0.9); }); m.with(() => { m.move(-0.3, -0.2, 0.9); m.ellipsoid([0, 0, 0.12], [0.4, 0.4, 0.14], S.canvas); }); },
    ],
    ambient: { shade: 0.9, gust: "#f4fbff", motes: [{ kind: "drift", n: 8, colors: ["#f2fbff"], size: 0.028 }], butterflies: 0, flock: { n: 4, color: "#ffffff" } },
  },
  { // 10
    name: "The Grand Engine", obstacle: "brokengear", edge: "#3a2d3a", yard: ["marble", C.marble], strip: ["marble", ["#7a5a66", "#d9cdb5"]], street: ["plates", ["#54485a", "#4c4152"]], way: ["plain", ["#a8323a", "#b9434a"]],
    kerb: "#e6b84a", cog: "#e0b04a", haze: "#6a4a72", rails: false, glow: "#ffd98a", wall: "stone",
    decals(p) {
      // brass inlay lines and a seal on the strip
      for (const y of [1.0, 3.4, 10.6, 13.0]) p.line([[0.4, y], [3.4, y]], "#e0b04a", 0.07, 0.9), p.line([[5.6, y], [8.6, y]], "#e0b04a", 0.07, 0.9);
      p.cog(4.5, 7, 0.78, 12, "#e0b04a", { ink: 0.04, hole: 0.45, holeColor: "#7a5a66" });
      p.line(PATH.filter(([, y]) => y > -1 && y < 14.6), "#e6b84a", 0.06, 0.9);
    },
    skyline(add, r) {
      for (const [x, y, s] of [[-2.2, 2.2, 1.5], [-2.4, 7.2, 1.9], [-2.2, 12.2, 1.5], [W + 2.2, 4.4, 1.7], [W + 2.4, 9.6, 1.9]]) add({ build: (m) => bigGear(m, s, r() < 0.5 ? P.brass : P.brassDk, r() * 30), x, y, yaw: x < 0 ? 0 : 180, shadow: s * 0.8 });
      for (const x of [-4.6, W + 4.6]) for (let y = -2; y < 17; y += 3.2) add({ build: (m) => house(m, { w: 3, d: 2.2, h: 3.2, wall: S.marble, flat: true, lit: 0.85, chimneys: 0, trim: P.brass, seed: Math.floor(y + 3) }), x, y, yaw: x < 0 ? 0 : 180 });
      farRow(add, r, -3.6, { wall: [S.marble, S.stoneLt], h: 2.8 });
      add({ build: (m) => clockTower(m, 7.5, 2.2), x: 4.5, y: -7.5, yaw: 90, shadow: 1.5 });
      for (const [x, y] of [[-1.3, 4.7], [-1.3, 9.7], [W + 1.3, 2], [W + 1.3, 7], [W + 1.3, 12]] as Pt[]) add({ build: (m) => { m.cylinder([0, 0, 0], [0, 0, 2.2], 0.14, S.marble, 0.11, { segs: 8 }); m.box([0, 0, 2.25], [0.4, 0.4, 0.1], P.brass); m.poly([[0.02, 0, 2.1], [0.02, 0, 1.1], [0.5, 0, 1.25], [0.5, 0, 2.1]], S.carpet); }, x, y, yaw: x < 0 ? 0 : 180, fg: true, shadow: 0.2 });
    },
    props: [
      (m) => { m.with(() => { m.rotY(64).move(0, 0, -0.1); gear(m, 0.95, 0.24, P.brass, 10, 8, P.ironDk); }); m.box([0.5, 0.2, 0.15], [0.5, 0.4, 0.3], S.marble); },
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.3], 0.98, S.marble, 0.9, { segs: 8 }); m.cylinder([0, 0, 0.3], [0.1, 0, 1.1], 0.36, S.marble, 0.33, { segs: 10 }); m.with(() => { m.move(0.7, 0.3, 0.2).rotY(80); m.cylinder([0, 0, 0], [0, 0, 0.7], 0.34, S.marble, 0.33, { segs: 10 }); }); m.sphere([0.2, -0.5, 0.2], 0.22, P.brass); },
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.25], 0.98, S.marble, 0.92, { segs: 8 }); m.with(() => { m.move(0, 0, 0.25); boiler(m, 0.45, 0.8, P.brass, P.copper); }); m.with(() => { m.move(0.25, 0.2, 1.3).rotX(70).rotZ(20); gear(m, 0.42, 0.1, P.brassDk, 8); }); },
    ],
    ambient: { shade: 0.5, gust: null, motes: [{ kind: "blink", n: 12, colors: ["#ffe9a3", "#fff6d6"], size: 0.03 }, { kind: "rise", n: 8, colors: ["#ffcf7a"], size: 0.026 }], butterflies: 0, flock: null },
  },
];

export const ARENAS: ArenaArt = { acts: acts.map(district) };
