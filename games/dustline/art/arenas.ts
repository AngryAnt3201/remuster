// Dustline's ten battlefields: one place on the frontier per campaign act. They share a family look (sunlit dirt
// between two boardwalks, wagon ruts from keep to keep, a plank deck with a painted star under each keep, something
// crossing the neutral strip) and each has its own ground, crossing, buildings, landmark and props.
import type { ArenaArt, ArenaDef, SceneItem } from "../../../artkit/arena";
import { Painter, rgba, shade, spline, type Pt } from "../../../artkit/paint";
import { Model, type Material } from "../../../artkit/toon3d";
import { P, dynamite, powderKeg, pricklyPear, starOutline, wheel } from "./parts";
import { S, adobe, barrel, belfry, blockhouse, boulder, boxcar, cactus, cottonwood, crate, cypress, derrick, falseFront, fence, hayBale, hitch, lanternPost, locomotive, mesa, palm, pine, riverboat, skull, spire, stockade, telegraph, tent, trough, wagon, waterTower, windmill } from "./scenery";

const W = 9, H = 14, STRIP0 = 5.9, STRIP1 = 8.1;
const KEEPS: Pt[] = [[4.5, 13.4], [4.5, 1.55]];
/** The wagon trail between the keeps. */
const PATH: Pt[] = spline([[4.5, 16], [4.5, 12.4], [4.1, 10.2], [4.8, 7.0], [5.0, 4.4], [4.5, 2.4], [4.5, -0.8], [4.5, -7]], 0.15);
type Add = (it: SceneItem) => void;
type Strip = "rails" | "creek" | "planks" | "ice" | "rock" | "tiles";

interface Place {
  name: string; obstacle: string; edge: string;
  /** Ground: the yard between the boardwalks, the country outside, the wagon trail, the boardwalk planks. */
  dirt: string[]; out: string[]; trail: string; walk: string[];
  strip: Strip; stripCol: string[];
  /** The plank deck under each keep and the star painted on it. */
  deck: string[]; starCol: string;
  haze: string; hazeA?: number; glow?: string;
  decals?(p: Painter): void;
  outside?(p: Painter): void;
  scenery(add: Add, r: () => number): void;
  props: ((m: Model) => void)[];
  ambient?: ArenaDef["ambient"];
  /** Edge furniture along the board's sides. */
  rail?: "hitch" | "fence" | "stockade" | "rope" | "none";
  lamp?: Material;
}

function place(d: Place): ArenaDef {
  const inStrip = (y: number) => y > STRIP0 - 0.25 && y < STRIP1 + 0.25;
  const clear = (x: number, y: number) => !inStrip(y) && KEEPS.every(([kx, ky]) => Math.hypot(x - kx, y - ky) > 2.0) && PATH.every(([px, py]) => Math.hypot(x - px, y - py) > 0.8);
  const posts: Pt[] = [];
  for (const y of [0.9, 3.9, 10.1, 13.1]) posts.push([-0.55, y], [W + 0.55, y]);
  return {
    name: d.name, edge: d.edge, obstacle: d.obstacle, ambient: d.ambient, props: d.props,
    ground(p) {
      // the country outside
      p.fill(d.out[0]);
      p.mottle(-8, -17, 25, 38, d.out[1] ?? shade(d.out[0], 0.15), { n: 520, alpha: 0.3, size: [0.5, 2.2] });
      p.mottle(-8, -17, 25, 38, "#2a1608", { n: 260, alpha: 0.08, size: [0.4, 1.6] });
      d.outside?.(p);
      // the yard: packed dirt, lighter down the middle where everyone walks
      p.rect(-0.5, -1.2, W + 1, H + 2.4, d.dirt[0]);
      p.clip((g) => g.rect(-0.5, -1.2, W + 1, H + 2.4), () => {
        p.mottle(-0.5, -1.2, W + 1, H + 2.4, d.dirt[1] ?? shade(d.dirt[0], 0.12), { n: 150, alpha: 0.4, size: [0.5, 1.8] });
        p.mottle(-0.5, -1.2, W + 1, H + 2.4, d.dirt[2] ?? shade(d.dirt[0], -0.12), { n: 90, alpha: 0.28, size: [0.4, 1.4] });
        p.mottle(-0.5, -1.2, W + 1, H + 2.4, "#fff6dc", { n: 40, alpha: 0.08, size: [0.6, 2] });
      });
      // boardwalks down both sides
      for (const x of [-1.5, W + 0.5]) { p.rect(x - 0.05, -1.5, 1.1, H + 3, shade(d.walk[0], -0.45)); p.planks(x, -1.45, 1.0, H + 2.9, d.walk, { width: 0.25, vertical: false, len: 1.0 }); }
      // the wagon trail and its ruts
      p.line(PATH, d.trail, 1.25, 0.75);
      for (const o of [-0.34, 0.34]) p.line(PATH.map(([x, y]) => [x + o, y] as Pt), shade(d.trail, -0.28), 0.1, 0.55);
      p.scatter(3.6, -1, 1.8, 16, 26, (x, y) => { p.g.save(); p.g.globalAlpha = 0.3; p.circle(x, y, 0.05, shade(d.trail, -0.4), 0, 0.035); p.circle(x + 0.09, y + 0.02, 0.05, shade(d.trail, -0.4), 0, 0.035); p.g.restore(); }, (_x, y) => !inStrip(y));
      // the neutral strip, a sleeper of timber along each zone line
      p.clip((g) => g.rect(-0.5, STRIP0, W + 1, STRIP1 - STRIP0), () => stripFloor(p, d));
      for (const y of [STRIP0, STRIP1]) { p.rect(-0.5, y - 0.085, W + 1, 0.17, shade(d.walk[0], -0.3), 0.03); for (let x = -0.3; x < W + 0.5; x += 0.55) p.circle(x, y, 0.022, rgba(p.ink, 0.6)); }
      // a plank deck under each keep, a star painted on it
      for (const [kx, ky] of KEEPS) {
        p.glow(kx, ky + 0.1, 2.5, "#1c0e06", 0.3, "source-over", 2.0);
        p.circle(kx, ky, 1.72, shade(d.deck[0], -0.45), 0.05);
        p.clip((g) => g.arc(kx, ky, 1.62, 0, 7), () => p.planks(kx - 1.7, ky - 1.7, 3.4, 3.4, d.deck, { width: 0.27, len: 1.6 }));
        p.g.save(); p.g.globalAlpha = 0.55; p.poly(starOutline(1.25, 0.45, -Math.PI / 2).map(([x, y]) => [kx + x, ky + y] as Pt), d.starCol, 0.035); p.g.restore();
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; p.circle(kx + Math.cos(a) * 1.67, ky + Math.sin(a) * 1.67, 0.05, "#d9a441", 0.018); }
      }
      // scrub, stones and cracks where nobody walks
      p.scatter(0.3, 0.3, W - 0.6, H - 0.6, 30, (x, y) => { const c = p.pick([shade(d.dirt[0], -0.25), shade(d.dirt[0], -0.35), shade(d.dirt[0], 0.2)]); p.circle(x, y, p.rand(0.035, 0.08), c, 0.012, p.rand(0.03, 0.05)); }, clear);
      d.decals?.(p);
      p.cracks(0, 0, W, H, 8, rgba(p.ink, 0.3), 0.025);
      if (d.glow) for (const [x, y] of posts) p.glow(x + (x < 0 ? 0.7 : -0.7), y, 2.2, d.glow, 0.24, "lighter", 1.7);
    },
    scenery(add, r) {
      const rail = d.rail ?? "hitch";
      for (const [x, yaw] of [[-0.42, 0], [W + 0.42, 180]] as [number, number][]) for (let y = 0.2; y < H; y += 1.5) {
        if (inStrip(y + 0.6)) continue;
        if (rail === "hitch" && Math.round(y / 1.5) % 2 === 0) add({ build: (m) => hitch(m, 1.1), x, y: y + 0.6, yaw });
        else if (rail === "fence") add({ build: (m) => fence(m, 1.46, 0.5), x, y: y + 0.6, yaw });
        else if (rail === "stockade") add({ build: (m) => stockade(m, 1.46, 0.55), x, y: y + 0.6, yaw });
        else if (rail === "rope") add({ build: (m) => { m.cylinder([0, -0.73, 0], [0, -0.73, 0.5], 0.05, S.logDk, 0.05, { segs: 5 }); m.tube([[0, -0.73, 0.42], [0, 0, 0.28], [0, 0.73, 0.42]], 0.025, S.rope, { segs: 4 }); }, x, y: y + 0.6, yaw });
      }
      for (const [x, y] of posts) add({ build: (m) => (d.glow ? lanternPost(m, 1.5, 0.42, d.lamp ?? P.lamp) : telegraph(m, 2.1)), x, y, yaw: x < 0 ? 0 : 180, fg: true, shadow: 0.14 });
      d.scenery(add, r);
    },
    grade(g, w, h) {
      const a = d.hazeA ?? 0.6;
      const hz = g.createLinearGradient(0, 0, 0, h * 0.4);
      hz.addColorStop(0, rgba(d.haze, a)); hz.addColorStop(0.55, rgba(d.haze, a * 0.3)); hz.addColorStop(1, rgba(d.haze, 0));
      g.fillStyle = hz; g.fillRect(0, 0, w, h * 0.4);
      const vg = g.createRadialGradient(w / 2, h * 0.55, h * 0.32, w / 2, h * 0.55, h * 0.78);
      vg.addColorStop(0, "rgba(60,24,10,0)"); vg.addColorStop(1, "rgba(60,24,10,0.3)");
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
    },
  };
}

/** What crosses the neutral strip. */
function stripFloor(p: Painter, d: Place) {
  const y0 = STRIP0, hh = STRIP1 - STRIP0, c = d.stripCol;
  if (d.strip === "rails") {
    p.rect(-0.5, y0, W + 1, hh, c[0]);
    p.scatter(-0.5, y0, W + 1, hh, 320, (x, y) => p.circle(x, y, p.rand(0.025, 0.05), p.pick(c), 0));
    p.rails(spline([[-8, 7], [17, 7]], 0.14), 0.62, { sleeper: "#6a4a30", rail: "#b9b4ac" });
    for (const [px] of PATH.filter(([, y]) => Math.abs(y - 7) < 0.08).slice(0, 1)) p.planks(px - 0.75, 6.42, 1.5, 1.16, d.walk, { width: 0.2, vertical: true, len: 1.3 });
  } else if (d.strip === "creek" || d.strip === "ice") {
    const ice = d.strip === "ice";
    p.rect(-0.5, y0, W + 1, hh, c[0]);
    p.poly(spline([[-0.6, y0 + 0.5], [2, y0 + 0.32], [4.5, y0 + 0.52], [7, y0 + 0.3], [9.6, y0 + 0.5], [9.6, y0 + 1.75], [7, y0 + 1.9], [4.5, y0 + 1.68], [2, y0 + 1.9], [-0.6, y0 + 1.7]], 0.3), c[1], 0.04);
    for (let i = 0; i < 22; i++) { const x = p.rand(-0.3, 9), y = p.rand(y0 + 0.6, y0 + 1.6); p.line([[x, y], [x + p.rand(0.3, 0.9), y + (ice ? p.rand(-0.2, 0.2) : 0)]], c[2] ?? "#ffffff", 0.03, ice ? 0.7 : 0.5); }
    for (const [px] of PATH.filter(([, y]) => Math.abs(y - 7) < 0.08).slice(0, 1)) { p.rect(px - 0.82, y0 + 0.12, 1.64, hh - 0.24, shade(d.walk[0], -0.45)); p.planks(px - 0.76, y0 + 0.16, 1.52, hh - 0.32, d.walk, { width: 0.22, len: 1.5 }); }
  } else if (d.strip === "planks") {
    p.planks(-0.5, y0, W + 1, hh, c, { width: 0.28 });
  } else if (d.strip === "tiles") {
    p.slabs(-0.5, y0, W + 1, hh, c, { sw: 0.55, sh: 0.55, joint: 0.035, bond: 0 });
  } else {
    p.rect(-0.5, y0, W + 1, hh, c[0]);
    p.mottle(-0.5, y0, W + 1, hh, c[1], { n: 40, alpha: 0.6, size: [0.4, 1.3] });
    p.cracks(-0.5, y0, W + 1, hh, 14, rgba(p.ink, 0.5), 0.04);
  }
}

// ---- shared scenery rows
const WALLS = [S.pine, S.grey, S.pineLt, S.sage, S.ochre, S.barn, S.cream, S.teal];
/** A street of false fronts down both sides and across the far end, with a gap for the trail. */
function town(add: Add, r: () => number, o: { walls?: Material[]; lit?: boolean; storeys?: number; x?: number; far?: number; awning?: Material[]; adobeMix?: number } = {}) {
  const walls = o.walls ?? WALLS, aw = o.awning ?? [S.shingleDk, P.team, S.barnDk, S.canvas];
  const one = (x: number, y: number, yaw: number, w: number) => {
    const seed = Math.floor(r() * 99), wall = walls[Math.floor(r() * walls.length)], front = r() < 0.5 ? wall : walls[Math.floor(r() * walls.length)], st = (o.storeys ?? 1) + (r() < 0.35 ? 1 : 0), awn = aw[Math.floor(r() * aw.length)];
    if (r() < (o.adobeMix ?? 0)) add({ build: (m) => adobe(m, { w, h: 1.2 + (seed % 3) * 0.2, seed, lit: o.lit }), x, y, yaw, shadow: 1.2 });
    else add({ build: (m) => falseFront(m, { w, h: 1.2 + 0.75 * (st - 1) + (seed % 3) * 0.12, wall, front, awning: awn, lit: o.lit, seed, storeys: st }), x, y, yaw, shadow: 1.2 });
  };
  for (const sx of [-1, 1]) for (let y = -2.6; y < 17; ) { const w = 1.8 + r() * 1.2; one(sx < 0 ? -(o.x ?? 2.5) : W + (o.x ?? 2.5), y + w / 2, sx < 0 ? 0 : 180, w); y += w + 0.14; }
  for (let x = -7.5; x < 16.5; ) { const w = 2.0 + r() * 1.3; if (!(x + w > 3.2 && x < 5.8)) one(x + w / 2, o.far ?? -3.4, 90, w); x += w + 0.14; }
}
/** Mesas and spires along the far horizon. */
function badlands(add: Add, r: () => number, y = -9, n = 7) {
  for (let i = 0; i < n; i++) { const x = -7 + (i / (n - 1)) * 23 + (r() - 0.5) * 2, big = r() < 0.6; add({ build: (m) => (big ? mesa(m, 3.5 + r() * 2.5, 2.6, 2.2 + r() * 1.8, i + 1) : spire(m, 2.4 + r() * 1.6, 0.5)), x, y: y - r() * 3, shadow: big ? 2 : 0.5 }); }
}
const scatterAt = (add: Add, pts: [number, number, number?][], build: (m: Model, s: number) => void, o: Partial<SceneItem> = {}) => pts.forEach(([x, y, s]) => add({ build: (m) => build(m, s ?? 1), x, y, ...o }));

// ---- props shared by the town acts
const propTown = [
  (m: Model) => { m.with(() => { m.move(-0.3, -0.25, 0); barrel(m, 0.46, 1.05); }); m.with(() => { m.move(0.42, 0.25, 0); barrel(m, 0.4, 0.9, S.pineDk); }); m.with(() => { m.move(0.3, -0.5, 0); crate(m, 0.55); }); },
  (m: Model) => { m.with(() => { m.move(0, -0.28, 0).rotZ(90); hayBale(m, 1.5, 0.6, 0.62); }); m.with(() => { m.move(0, 0.34, 0).rotZ(90); hayBale(m, 1.5, 0.6, 0.62); }); m.with(() => { m.move(0, 0.02, 0.6).rotZ(78); hayBale(m, 1.4, 0.55, 0.6); }); },
  (m: Model) => { m.with(() => { m.rotZ(90); trough(m, 1.7); }); m.with(() => { m.move(0, -0.55, 0).rotZ(90); hitch(m, 1.5); }); },
];

// ------------------------------------------------------------------------------------------------ the ten acts
const DIRT = ["#dcb67c", "#e8c892", "#c9a066"], WALK = ["#b98b58", "#a97c4b", "#c59a66"], DECK = ["#b08050", "#a27445", "#bd8d5c"];
const acts: Place[] = [
  { // 1
    name: "Dustline Junction", obstacle: "barrels", edge: "#c99a5e", dirt: DIRT, out: ["#cfa468", "#dcb67c"], trail: "#ecd3a2", walk: WALK,
    strip: "rails", stripCol: ["#b59a78", "#a08868", "#c9b08c", "#8a745a"], deck: DECK, starCol: "#f3e2b4", haze: "#f6dcae",
    decals(p) { for (const [x, y] of [[1.3, 3.0], [7.6, 10.8], [7.4, 4.4], [1.5, 11.6]] as Pt[]) { p.g.save(); p.g.globalAlpha = 0.5; p.circle(x, y, 0.3, "#b9905a", 0, 0.2); p.g.restore(); } },
    scenery(add, r) {
      town(add, r);
      add({ build: (m) => waterTower(m, 3.0, 0.8), x: 7.9, y: -1.6, shadow: 1.0 });
      badlands(add, r, -9);
      scatterAt(add, [[-1.9, 1.2, 1.5], [W + 1.9, 6.9, 1.7], [1.6, -1.7, 1.4], [-1.9, 12.4, 1.3]], (m, s) => cactus(m, s), { shadow: 0.25 });
      scatterAt(add, [[W + 1.0, 2.0], [-1.0, 9.0]], (m) => { barrel(m, 0.24, 0.6); m.with(() => { m.move(0.1, 0.5, 0); crate(m, 0.45); }); });
    },
    props: propTown,
    ambient: { shade: 0.35, gust: "#f6e6c4", motes: [{ kind: "drift", n: 14, colors: ["#f3dfb6", "#e2c690"], size: 0.03 }], butterflies: 0, flock: { n: 3, color: "#3a2a22" } },
  },
  { // 2
    name: "Blackwater Wells", obstacle: "oildrums", edge: "#6e5a48", dirt: ["#a88a68", "#b89a78", "#8f7256"], out: ["#7f6a54", "#8f7a62"], trail: "#c4a888", walk: ["#7d6048", "#70543e", "#8a6c52"],
    strip: "planks", stripCol: ["#6e5540", "#624a37", "#7a6049"], deck: ["#8a6a4c", "#7d5e42", "#977657"], starCol: "#e6d2a8", haze: "#5a4a44", hazeA: 0.7, glow: "#ff9a4d", lamp: P.fire,
    decals(p) {
      for (const [x, y, s] of [[1.6, 2.6, 0.5], [7.4, 11.2, 0.6], [7.2, 3.6, 0.4], [1.9, 10.8, 0.45], [6.6, 12.6, 0.3]]) p.puddle(x, y, s, "#1c1a20", "#8f8a9a");
      for (const y of [STRIP0 + 0.45, STRIP1 - 0.45]) { p.line([[-0.5, y], [W + 0.5, y]], "#2a2428", 0.2); p.line([[-0.5, y], [W + 0.5, y]], "#5a5560", 0.1); for (let x = 0.4; x < W; x += 1.4) p.circle(x, y, 0.13, "#3a363e", 0.02); }
    },
    scenery(add, r) {
      for (const [x, y, hh] of [[-2.4, 2, 4.2], [-2.6, 9, 4.8], [W + 2.4, 5, 4.5], [W + 2.6, 12, 4], [1.2, -3.6, 4.6], [7.6, -3.8, 5], [-4.5, -5, 4], [13, -5.5, 4.4]]) add({ build: (m) => derrick(m, hh), x, y, yaw: x < 4.5 ? 0 : 180, shadow: 0.9 });
      for (const x of [-2.2, W + 2.2]) for (let y = -1; y < 16; y += 3.4) add({ build: (m) => { m.cylinder([0, 0, 0], [0, 0, 1.1], 0.8, S.greyDk, 0.8, { segs: 12 }); m.cylinder([0, 0, 1.1], [0, 0, 1.2], 0.84, S.iron, 0.6, { segs: 12 }); m.decal(0.01, () => m.cylinder([0, 0, 0.4], [0, 0, 0.6], 0.81, P.team, 0.81, { segs: 12 })); }, x, y: y + 5.6 * r(), shadow: 0.9 });
      town(add, r, { walls: [S.greyDk, S.grey, S.pineDk], x: 5.2, far: -6 });
      badlands(add, r, -10, 5);
    },
    props: [
      (m) => { for (const [x, y, c] of [[-0.4, -0.3, S.oil], [0.4, -0.2, S.barn], [0, 0.45, S.oil]] as [number, number, Material][]) m.with(() => { m.move(x, y, 0); barrel(m, 0.42, 0.95, c, S.tin); }); },
      (m) => { m.box([0, 0, 0.15], [1.5, 1.0, 0.3], S.pineDk); m.with(() => { m.move(0.1, 0, 0.3); m.tube([[-0.5, 0, 0], [-0.5, 0, 0.9]], 0.07, S.iron, { segs: 5 }); m.with(() => { m.move(-0.5, 0, 0.9).rotY(12); m.box([0.1, 0, 0], [1.3, 0.12, 0.12], S.pine); m.extrude([[0.6, 0.1], [0.9, 0.1], [0.9, -0.5], [0.75, -0.5]], 0.14, S.iron); }); }); },
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.9], 0.9, S.greyDk, 0.9, { segs: 12 }); m.decal(0.02, () => m.cylinder([0, 0, 0.9], [0, 0, 0.91], 0.78, S.oil, 0.78, { segs: 12 })); m.cylinder([0, 0, 0.4], [0, 0, 0.5], 0.92, S.iron, 0.92, { segs: 12 }); },
    ],
    ambient: { shade: 0.3, gust: null, motes: [{ kind: "rise", n: 12, colors: ["#ffb04d", "#ff7a3d"], size: 0.028 }, { kind: "fall", n: 10, colors: ["#2c2428", "#4a4044"], size: 0.03 }], butterflies: 0, flock: null },
  },
  { // 3
    name: "Cottonwood Ranch", obstacle: "haybales", edge: "#a8a060", dirt: ["#cdb878", "#d9c68a", "#b8a264"], out: ["#a9a85c", "#bcb86e"], trail: "#e6d6a4", walk: WALK,
    strip: "creek", stripCol: ["#b9a86a", "#5f9fb8", "#d6eef5"], deck: DECK, starCol: "#f3e2b4", haze: "#e6e2b0", rail: "fence",
    decals(p) { p.scatter(0.3, 0.3, W - 0.6, H - 0.6, 46, (x, y) => { for (let k = 0; k < 3; k++) p.line([[x + k * 0.05, y], [x + k * 0.05 + p.rand(-0.04, 0.04), y - p.rand(0.08, 0.16)]], p.pick(["#8f9a4a", "#a3a858", "#7d8a40"]), 0.03); }, (x, y) => !(y > STRIP0 - 0.3 && y < STRIP1 + 0.3) && Math.abs(x - 4.5) > 1); },
    scenery(add, r) {
      add({ build: (m) => falseFront(m, { w: 3.4, d: 2.8, h: 2.2, wall: S.barn, front: S.barn, trim: S.white, awning: null, seed: 2, sign: false }), x: -3.0, y: 3.2, yaw: 0, shadow: 1.8 });
      add({ build: (m) => falseFront(m, { w: 3.0, d: 2.6, h: 2.0, wall: S.barn, front: S.barn, trim: S.white, awning: null, seed: 4, sign: false }), x: 7.6, y: -3.6, yaw: 90, shadow: 1.8 });
      add({ build: (m) => windmill(m, 3.4), x: 1.4, y: -2.4, yaw: 60, shadow: 0.5 });
      add({ build: (m) => windmill(m, 3.0), x: W + 2.2, y: 9.6, yaw: 120, shadow: 0.5 });
      for (let i = 0; i < 26; i++) { const sx = r() < 0.5 ? -1 : 1; add({ build: (m) => cottonwood(m, 1.9 + r() * 1.2), x: sx < 0 ? -1.7 - r() * 5 : W + 1.7 + r() * 5, y: -5 + r() * 22, shadow: 0.7 }); }
      for (let x = -7; x < 16; x += 1.8) if (Math.abs(x - 4.5) > 3.4) add({ build: (m) => cottonwood(m, 2.2 + r() * 1.4), x, y: -5.4 - r() * 3, shadow: 0.7 });
      for (const [x0, x1, y] of [[-6, 2.9, -1.3], [6.1, 15, -1.3]]) for (let x = x0; x < x1; x += 1.5) add({ build: (m) => fence(m, 1.5, 0.55, S.white), x: x + 0.75, y, yaw: 90 });
      scatterAt(add, [[-1.6, 7.4], [-1.9, 11.5], [W + 1.6, 3.6], [W + 1.7, 13.2]], (m) => { m.rotZ(20); hayBale(m, 1.0, 0.5, 0.55); m.with(() => { m.move(0.1, 0.1, 0.5).rotZ(70); hayBale(m, 0.9, 0.45, 0.5); }); });
      add({ build: (m) => wagon(m, null, S.pine), x: W + 1.7, y: 6.6, yaw: 80, shadow: 0.6 });
    },
    props: [propTown[1], (m) => { m.with(() => { m.rotZ(60); wagon(m, null, S.pine); }); }, (m) => { m.with(() => { m.rotZ(90); trough(m, 1.7); }); m.with(() => { m.move(-0.1, 0.5, 0); barrel(m, 0.3, 0.7); }); }],
    ambient: { shade: 0.6, gust: "#f4f0c8", motes: [{ kind: "fall", n: 10, colors: ["#c9c05a", "#a8a84a", "#e2d27a"], size: 0.05, leaf: true }], butterflies: 3, flock: { n: 4, color: "#3a3428" } },
  },
  { // 4
    name: "Iron Horse Depot", obstacle: "freight", edge: "#9a8468", dirt: ["#c4ac88", "#d2bc9a", "#ac9472"], out: ["#a8906e", "#b8a080"], trail: "#dccaa8", walk: WALK,
    strip: "rails", stripCol: ["#8f8272", "#7d7062", "#a39684", "#6a5e52"], deck: DECK, starCol: "#f3e2b4", haze: "#d9cbb4", rail: "none",
    decals(p) {
      for (const x of [-2.6, W + 2.6]) p.rails(spline([[x, -16], [x, 20]], 0.14), 0.6, { sleeper: "#6a4a30", rail: "#b9b4ac", bed: "#8f8272" });
      p.rails(spline([[-8, 6.3], [17, 6.3]], 0.14), 0.5, { sleeper: "#6a4a30", rail: "#b9b4ac" }); p.rails(spline([[-8, 7.7], [17, 7.7]], 0.14), 0.5, { sleeper: "#6a4a30", rail: "#b9b4ac" });
      for (const [x, y] of [[1.6, 2.2], [7.4, 11.4]] as Pt[]) p.mottle(x - 0.6, y - 0.5, 1.2, 1, "#201a1c", { n: 8, alpha: 0.4, size: [0.15, 0.4] });
    },
    scenery(add, r) {
      add({ build: (m) => locomotive(m), x: -2.6, y: 4.2, yaw: 90, shadow: 1.0 });
      for (const [x, y] of [[-2.6, 0.6], [-2.6, -2.2], [-2.6, 9.8], [-2.6, 12.5], [W + 2.6, 2.2], [W + 2.6, 5.0], [W + 2.6, 10.6], [W + 2.6, 13.4]]) add({ build: (m) => boxcar(m, [S.barn, S.ochre, S.sage, S.greyDk][Math.floor(r() * 4)]), x, y, yaw: 90, shadow: 0.9 });
      add({ build: (m) => falseFront(m, { w: 5.2, d: 2.4, h: 1.6, wall: S.ochre, front: S.ochre, trim: S.barnDk, awning: S.shingleDk, seed: 3 }), x: 0.2, y: -3.4, yaw: 90, shadow: 1.6 });
      add({ build: (m) => waterTower(m, 3.2, 0.85), x: 7.4, y: -2.6, shadow: 1.0 });
      town(add, r, { walls: [S.grey, S.pine, S.barn], x: 5.4, far: -6.5 });
      badlands(add, r, -11, 5);
      for (const y of [1.6, 12.2]) for (const x of [-1.0, W + 1.0]) add({ build: (m) => { crate(m, 0.6); m.with(() => { m.move(0.05, 0.6, 0); crate(m, 0.45, S.pineDk); }); m.with(() => { m.move(0, 0.1, 0.6).rotZ(20); crate(m, 0.4); }); }, x, y });
    },
    props: [
      (m) => { m.with(() => { m.move(-0.3, -0.3, 0); crate(m, 0.85); }); m.with(() => { m.move(0.45, 0.2, 0); crate(m, 0.7, S.pineDk); }); m.with(() => { m.move(-0.2, -0.2, 0.85).rotZ(25); crate(m, 0.55, S.pineLt); }); },
      (m) => { m.box([0, 0, 0.22], [1.6, 1.0, 0.12], S.pineDk); for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) m.with(() => { m.move(x, y, 0.2); wheel(m, 0.2, 0, S.iron, S.iron, 6, null); }); m.with(() => { m.move(0, 0, 0.28); m.cylinder([0, 0, 0], [0, 0, 0.55], 0.06, S.iron, 0.06, { segs: 5 }); m.with(() => { m.move(0, 0, 0.55).rotY(14); m.box([0, 0, 0], [1.3, 0.08, 0.08], S.pine); }); }); },
      (m) => { m.group(() => { m.ellipsoid([0, 0, 0], [0.95, 0.95, 0.6], S.coal, { segs: 9 }); m.ellipsoid([0.4, 0.3, 0], [0.5, 0.5, 0.4], S.coal, { segs: 7 }); }); m.with(() => { m.move(0.7, -0.4, 0).rotY(-50); m.cylinder([0, 0, 0], [0, 0, 0.9], 0.03, S.pine, 0.03, { segs: 4 }); m.box([0, 0, 0.95], [0.02, 0.24, 0.26], S.iron); }); },
    ],
    ambient: { shade: 0.6, gust: "#efe6d2", motes: [{ kind: "drift", n: 12, colors: ["#e9dfcb", "#cfc4ae"], size: 0.03 }], butterflies: 0, flock: { n: 3, color: "#3a2a22" } },
  },
  { // 5
    name: "Fort Buckhorn", obstacle: "ordnance", edge: "#b99a6a", dirt: ["#d6bd8c", "#e2cc9e", "#c0a674"], out: ["#c2a26c", "#cfb280"], trail: "#eadbb4", walk: ["#a8845a", "#99764e", "#b59166"],
    strip: "planks", stripCol: ["#b08a5c", "#a27d50", "#bd976a"], deck: DECK, starCol: "#f3e2b4", haze: "#f0dcb4", rail: "stockade",
    decals(p) { for (const y of [2.2, 4.0, 10.0, 11.8]) for (const [a, b] of [[0.5, 3.2], [5.8, 8.5]]) p.line([[a, y], [b, y]], "#f3ead0", 0.05, 0.35); },
    scenery(add, r) {
      for (const x of [-1.9, W + 1.9]) for (let y = -2.2; y < 16.4; y += 2.2) add({ build: (m) => stockade(m, 2.2, 1.5), x, y: y + 1.1, yaw: x < 0 ? 0 : 180, shadow: 0.3 });
      for (let x = -1.9; x < W + 1.9; x += 2.2) if (!(x + 2.2 > 3.3 && x < 5.7)) add({ build: (m) => stockade(m, 2.2, 1.5), x: x + 1.1, y: -2.2, yaw: 90 });
      for (const [x, y] of [[-1.9, -2.2], [W + 1.9, -2.2], [-1.9, 7], [W + 1.9, 7]]) add({ build: (m) => blockhouse(m, 2.6), x, y, yaw: x < 0 ? 0 : 180, shadow: 1.2 });
      for (const [x, y] of [[-0.9, 2.5], [-0.9, 11.0], [W + 0.9, 4.2], [W + 0.9, 12.4]]) add({ build: (m) => tent(m, 1.3), x, y, yaw: x < 0 ? 20 : 160, shadow: 0.6 });
      add({ build: (m) => { m.cylinder([0, 0, 0], [0, 0, 4.2], 0.06, S.white, 0.04, { segs: 6 }); m.poly([[0, 0, 4.15], [0, 0, 3.3], [1.3, 0, 3.4], [1.3, 0, 4.1]], P.team); m.sphere([0, 0, 4.25], 0.09, S.gold); }, x: 2.4, y: -1.2, yaw: 0, shadow: 0.2 });
      badlands(add, r, -7, 8);
      scatterAt(add, [[-4, 3, 1.7], [-5, 10, 1.5], [14, 5, 1.8], [13, 12, 1.4]], (m, s) => cactus(m, s), { shadow: 0.25 });
    },
    props: [
      (m) => { m.group(() => { for (const [x, y, z] of [[-0.3, -0.3, 0.18], [0.1, -0.3, 0.18], [-0.1, 0.05, 0.18], [0.3, 0.05, 0.18], [-0.3, 0.4, 0.18], [0.1, 0.4, 0.18], [-0.1, -0.12, 0.48], [0.1, 0.22, 0.48], [0, 0.05, 0.78]]) m.sphere([x, y, z], 0.2, S.iron, { segs: 8 }); }); m.box([0, 0.05, 0.05], [1.2, 1.3, 0.1], S.pineDk); },
      (m) => { m.with(() => { m.move(-0.35, -0.3, 0); powderKeg(m, 0.42, 0.95, P.red); }); m.with(() => { m.move(0.42, 0.2, 0); powderKeg(m, 0.38, 0.85, P.red); }); m.with(() => { m.move(0.2, -0.55, 0); crate(m, 0.5); }); },
      (m) => { for (const s of [1, -1]) m.with(() => { m.move(0, s * 0.42, 0.4); wheel(m, 0.4, 20); }); m.with(() => { m.move(0, 0, 0.5).rotY(-14); m.cylinder([-0.5, 0, 0], [0.8, 0, 0], 0.16, P.brassDk, 0.12, { segs: 10 }); m.cylinder([0.72, 0, 0], [0.8, 0, 0], 0.15, P.brass, 0.15, { segs: 10 }); m.sphere([-0.5, 0, 0], 0.17, P.brassDk, { segs: 8 }); }); m.box([-0.6, 0, 0.2], [0.9, 0.16, 0.1], S.pineDk); },
    ],
    ambient: { shade: 0.5, gust: "#f6e6c4", motes: [{ kind: "drift", n: 12, colors: ["#f3dfb6"], size: 0.03 }], butterflies: 0, flock: { n: 4, color: "#3a2a22" } },
  },
  { // 6
    name: "Blizzard Pass", obstacle: "snowdrifts", edge: "#cfdbe6", dirt: ["#e9eff5", "#f6f9fc", "#d6e0ea"], out: ["#d0dce8", "#e2eaf2"], trail: "#c9b89a", walk: ["#8f7458", "#80664c", "#9c8064"],
    strip: "ice", stripCol: ["#dfe8f0", "#a9d2e6", "#ffffff"], deck: ["#9a7a58", "#8c6d4d", "#a78764"], starCol: "#f6f1e4", haze: "#e6eef6", hazeA: 0.75, glow: "#ffe2a8", rail: "rope",
    decals(p) {
      p.scatter(0.3, 0.3, W - 0.6, H - 0.6, 40, (x, y) => p.circle(x, y, p.rand(0.12, 0.3), "#ffffff", 0, p.rand(0.07, 0.14)), (_x, y) => !(y > STRIP0 - 0.2 && y < STRIP1 + 0.2));
      p.scatter(0.4, 0.4, W - 0.8, H - 0.8, 26, (x, y) => { for (const dx of [0, 0.16]) p.circle(x + dx, y + dx * 0.4, 0.045, "#b9c6d4", 0, 0.07); }, (_x, y) => !(y > STRIP0 - 0.2 && y < STRIP1 + 0.2));
    },
    scenery(add, r) {
      for (let i = 0; i < 44; i++) { const sx = r() < 0.5 ? -1 : 1; add({ build: (m) => pine(m, 2.0 + r() * 1.6, true), x: sx < 0 ? -1.7 - r() * 6 : W + 1.7 + r() * 6, y: -6 + r() * 24, shadow: 0.5 }); }
      for (let x = -7.5; x < 16.5; x += 1.3) if (Math.abs(x - 4.5) > 2.2) add({ build: (m) => pine(m, 2.4 + r() * 1.8, true), x, y: -3.2 - r() * 4, shadow: 0.5 });
      for (const [x, y, yaw] of [[-2.7, 3.4, 0], [W + 2.7, 10.2, 180], [1.2, -2.9, 90], [7.8, -2.9, 90]]) add({ build: (m) => { falseFront(m, { w: 2.4, d: 2.0, h: 1.2, wall: S.log, front: S.logDk, trim: S.logDk, awning: S.snow, lit: true, seed: 3, sign: false }); m.with(() => { m.move(-1.0, 0, 1.2).rotZ(90); m.extrude([[-1.3, 0.02], [1.3, 0.02], [0, 0.5]], 2.16, S.snow); }); m.box([-1.4, 0.6, 1.7], [0.3, 0.3, 0.7], S.stoneDk); }, x, y, yaw, shadow: 1.3 });
      scatterAt(add, [[-1.3, 1.2], [-1.3, 12.2], [W + 1.3, 6.3], [W + 1.2, 1.8], [-1.2, 8.8]], (m) => boulder(m, 0.7, 0.4, S.snow));
      for (let i = 0; i < 6; i++) add({ build: (m) => { mesa(m, 5 + r() * 3, 3, 3.5 + r() * 2, i + 3); m.decal(0.02, () => m.ellipsoid([0, 0, 3.4], [1.6, 1.2, 0.5], S.snow, { segs: 7 })); }, x: -8 + i * 5, y: -10 - r() * 3 });
    },
    props: [
      (m) => { crate(m, 1.0); m.ellipsoid([0, 0, 1.0], [0.6, 0.6, 0.16], S.snow); m.with(() => { m.move(-0.6, 0.55, 0); barrel(m, 0.34, 0.8); m.ellipsoid([0, 0, 0.8], [0.3, 0.3, 0.1], S.snow); }); },
      (m) => { m.group(() => { for (const [x, y, h, rr] of [[0, 0, 1.4, 0.5], [0.5, 0.3, 0.9, 0.36], [-0.45, 0.35, 0.7, 0.34], [0.2, -0.5, 0.8, 0.3]]) m.cone([x, y, 0], [x * 1.2, y * 1.2, h], rr, S.ice, { segs: 6 }); }); boulder(m, 0.95, 0.22, S.snow); },
      (m) => { boulder(m, 0.95, 0.4, S.snow); m.with(() => { m.move(0.1, 0, 0.2); pine(m, 1.7, true); }); },
    ],
    ambient: { shade: 0.5, gust: "#ffffff", motes: [{ kind: "fall", n: 32, colors: ["#ffffff", "#e8f4ff"], size: 0.032 }], butterflies: 0, flock: null },
  },
  { // 7
    name: "Red Mesa", obstacle: "boulders", edge: "#9a4630", dirt: ["#d08a5c", "#dc9c6c", "#b8724a"], out: ["#a8553a", "#b8664a"], trail: "#e6b488", walk: ["#b8724a", "#a8653f", "#c58056"],
    strip: "rock", stripCol: ["#b86a48", "#d69a70"], deck: ["#b08050", "#a27445", "#bd8d5c"], starCol: "#f6dcae", haze: "#f0b890", rail: "none",
    outside(p) { for (let i = 0; i < 40; i++) { const x = p.rand(-8, 17), y = p.rand(-17, 21); if (x > -1.8 && x < W + 1.8) continue; p.line([[x, y], [x + p.rand(1, 3), y + p.rand(-0.3, 0.3)]], "#8f3f2a", p.rand(0.08, 0.2), 0.5); } },
    decals(p) { for (let i = 0; i < 14; i++) { const y = p.rand(0.5, 13.5); if (y > STRIP0 - 0.4 && y < STRIP1 + 0.4) continue; const x = p.rand(0, 6); p.line(spline([[x, y], [x + 1.2, y + p.rand(-0.15, 0.15)], [x + 2.6, y + p.rand(-0.2, 0.2)]], 0.2), "#b8724a", 0.05, 0.5); } },
    scenery(add, r) {
      for (const sx of [-1, 1]) for (let y = -2; y < 16; y += 2.3) { const big = r() < 0.5; add({ build: (m) => (big ? mesa(m, 2.6 + r(), 2.2, 1.2 + r() * 1.4, Math.floor(y + 5)) : spire(m, 1.8 + r() * 1.8, 0.45)), x: sx < 0 ? -2.4 - r() * 1.2 : W + 2.4 + r() * 1.2, y: y + r(), shadow: big ? 1.4 : 0.5 }); }
      for (let x = -7; x < 16; x += 2.6) if (Math.abs(x - 4.5) > 2.4) add({ build: (m) => (r() < 0.5 ? mesa(m, 3 + r() * 2, 2.4, 2 + r() * 2, Math.floor(x + 9)) : spire(m, 2.6 + r() * 2, 0.55)), x, y: -3.4 - r() * 2, shadow: 1.2 });
      // a natural arch beyond the far gate
      add({ build: (m) => { m.tube([[0, -2.2, 0], [0, -2.0, 2.4], [0, 0, 3.3], [0, 2.0, 2.4], [0, 2.2, 0]], [0.7, 0.6, 0.5, 0.6, 0.7], S.rock, { segs: 7 }); m.decal(0.02, () => m.tube([[0.05, -1.9, 2.5], [0.05, 0, 3.4], [0.05, 1.9, 2.5]], 0.4, S.rockLt, { segs: 6 })); }, x: 4.5, y: -6.5, yaw: 90, shadow: 1 });
      scatterAt(add, [[-1.2, 2, 1.3], [-1.3, 9.4, 1.6], [W + 1.2, 4.6, 1.5], [W + 1.3, 12, 1.2], [2.2, -1.6, 1.4], [6.9, -1.5, 1.2]], (m, s) => cactus(m, s), { shadow: 0.2 });
      scatterAt(add, [[-1.1, 5.2], [W + 1.1, 8.9]], (m) => skull(m, 0.36));
    },
    props: [
      (m) => { boulder(m, 0.95, 0.8, S.rock); m.ellipsoid([-0.3, -0.3, 0.6], [0.4, 0.4, 0.3], S.rockLt, { segs: 6 }); },
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.3], 0.98, S.rockDk, 0.8, { segs: 7 }); m.with(() => { m.move(0, 0, 0.2); spire(m, 1.9, 0.55); }); },
      (m) => { boulder(m, 0.95, 0.35, S.rockDk); m.with(() => { m.move(0, 0, 0.2); cactus(m, 1.5); }); m.with(() => { m.move(0.5, 0.3, 0.1); pricklyPear(m, 0.4); }); },
    ],
    ambient: { shade: 0.7, gust: "#f6d6b0", motes: [{ kind: "drift", n: 10, colors: ["#f0c8a0"], size: 0.03 }], butterflies: 0, flock: { n: 2, color: "#2a1a14" } },
  },
  { // 8
    name: "Lantern Bayou", obstacle: "stumps", edge: "#3f5a4a", dirt: ["#8f8a5c", "#a09a6a", "#787448"], out: ["#3f6050", "#4a6e5a"], trail: "#b0a67a", walk: ["#7d6a4a", "#6e5c3f", "#8a7655"],
    strip: "creek", stripCol: ["#6a7a50", "#3f6e62", "#a9e0c8"], deck: ["#8a7250", "#7d6645", "#977f5c"], starCol: "#e6e2b4", haze: "#4a6a5a", hazeA: 0.7, glow: "#d8ffa0", lamp: P.ghost, rail: "rope",
    outside(p) {
      for (let i = 0; i < 90; i++) { const x = p.rand(-8, 17), y = p.rand(-17, 21); if (x > -1.8 && x < W + 1.8 && y > -1.6) continue; p.circle(x, y, p.rand(0.12, 0.3), p.pick(["#6f9a5a", "#5f8a4e"]), 0.02, p.rand(0.08, 0.18)); }
      for (let i = 0; i < 60; i++) { const x = p.rand(-8, 17), y = p.rand(-17, 21); p.line([[x, y], [x + p.rand(0.4, 1), y]], "#a9e0c8", 0.035, 0.35); }
    },
    decals(p) { p.mottle(0, 0, W, H, "#3b5a2f", { n: 36, alpha: 0.18, size: [0.3, 0.9] }); for (const [x, y] of [[1.6, 3.2], [7.2, 11], [7.4, 3.8], [1.8, 11.4]] as Pt[]) p.puddle(x, y, 0.4, "#2f4a44", "#c9ffe0"); },
    scenery(add, r) {
      for (let i = 0; i < 36; i++) { const sx = r() < 0.5 ? -1 : 1; add({ build: (m) => cypress(m, 2.4 + r() * 1.6), x: sx < 0 ? -1.9 - r() * 6 : W + 1.9 + r() * 6, y: -6 + r() * 24, shadow: 0.5 }); }
      for (let x = -7.5; x < 16.5; x += 1.5) if (Math.abs(x - 4.5) > 2.2) add({ build: (m) => cypress(m, 2.8 + r() * 1.8), x, y: -5.6 - r() * 3, shadow: 0.5 });
      add({ build: (m) => riverboat(m), x: -4.6, y: 6.5, yaw: 270 });
      for (const [x, y, yaw] of [[W + 2.6, 3.2, 180], [W + 2.6, 11.6, 180], [1.3, -3.0, 90], [7.7, -3.0, 90], [-2.6, 13.0, 0]]) add({ build: (m) => { m.group(() => { for (const [a, b] of [[0.2, 0.9], [0.2, -0.9], [-1.6, 0.9], [-1.6, -0.9]]) m.cylinder([a, b, -0.3], [a, b, 0.5], 0.06, S.logDk, 0.06, { segs: 5 }); }); m.with(() => { m.move(0, 0, 0.45); falseFront(m, { w: 2.2, d: 1.8, h: 1.1, wall: S.greyDk, front: S.grey, awning: S.shingleDk, lit: true, seed: Math.floor(y) + 5, sign: false }); }); }, x, y, yaw, shadow: 1.2 });
    },
    props: [
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.9], 0.75, S.logDk, 0.5, { segs: 8 }); m.decal(0.02, () => m.cylinder([0, 0, 0.9], [0, 0, 0.91], 0.44, S.pineLt, 0.44, { segs: 8 })); m.group(() => { for (let i = 0; i < 5; i++) { const a = i * 1.26; m.cone([Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0], [Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.5], 0.14, S.logDk, { segs: 5 }); } }); },
      (m) => { m.with(() => { m.move(-0.3, 0, 0); barrel(m, 0.5, 1.1, S.pineDk, P.brassDk); }); m.with(() => { m.move(0.5, 0.3, 0); barrel(m, 0.36, 0.8, S.greyDk); }); m.with(() => { m.move(0.5, 0.3, 0.8); lanternPost(m, 0.7, 0, P.ghost); }); },
      (m) => { m.extrude([[-0.95, 0.3], [0.8, 0.3], [1.0, 0.45], [0.7, 0], [-0.8, 0]], 0.8, S.pineDk); m.decal(0.02, () => m.box([-0.1, 0, 0.31], [1.5, 0.6, 0.02], S.pine)); m.cylinder([-0.3, 0, 0.3], [-0.6, 0.3, 1.3], 0.03, S.pineLt, 0.03, { segs: 4 }); },
    ],
    ambient: { shade: 0.4, gust: null, motes: [{ kind: "blink", n: 18, colors: ["#d8ff8a", "#fff3a0"], size: 0.032 }, { kind: "drift", n: 6, colors: ["#e9f5e0"], size: 0.03 }], butterflies: 0, flock: null },
  },
  { // 9
    name: "Mission Coast", obstacle: "ollas", edge: "#e2cc9a", dirt: ["#e9d6a8", "#f3e4bc", "#d6c08e"], out: ["#dcc694", "#e9d6a8"], trail: "#f6ecd0", walk: ["#c2553a", "#b04a32", "#cf6446"],
    strip: "tiles", stripCol: ["#c8644a", "#b85840", "#d67656"], deck: ["#c2553a", "#b04a32", "#cf6446"], starCol: "#f6ecd0", haze: "#cfe6f0", rail: "none",
    outside(p) {
      // the sea beyond the right-hand wall
      p.poly(spline([[W + 3.4, -17], [W + 2.9, -8], [W + 3.6, 0], [W + 3.0, 8], [W + 3.5, 16], [W + 3.2, 21], [17, 21], [17, -17]], 0.4), "#4fa3c4", 0);
      p.line(spline([[W + 3.4, -17], [W + 2.9, -8], [W + 3.6, 0], [W + 3.0, 8], [W + 3.5, 16], [W + 3.2, 21]], 0.4), "#f6fbff", 0.22, 0.8);
      for (let i = 0; i < 70; i++) { const x = p.rand(W + 3.8, 17), y = p.rand(-16, 20); p.line([[x, y], [x + p.rand(0.3, 0.8), y]], "#e6f6fb", 0.04, 0.55); }
    },
    decals(p) { for (const [x, y] of [[2, 3.3], [7, 3.3], [2, 10.6], [7, 10.6]] as Pt[]) { p.g.save(); p.g.globalAlpha = 0.6; p.clip((g) => g.arc(x, y, 0.62, 0, 7), () => p.slabs(x - 0.7, y - 0.7, 1.4, 1.4, ["#c8644a", "#5f9fb8", "#f3e4bc"], { sw: 0.24, sh: 0.24, joint: 0.02, bond: 0 })); p.g.restore(); } },
    scenery(add, r) {
      for (const sx of [-1, 1]) for (let y = -2.6; y < 17; ) { const w = 2.0 + r() * 1.2, seed = Math.floor(r() * 99); add({ build: (m) => adobe(m, { w, h: 1.3 + (seed % 3) * 0.25, wall: seed % 3 ? S.plaster : S.adobeLt, seed, tile: seed % 2 === 0 }), x: sx < 0 ? -2.4 : W + 2.2, y: y + w / 2, yaw: sx < 0 ? 0 : 180, shadow: 1.2 }); y += w + 0.9; }
      for (let x = -7.5; x < 16.5; ) { const w = 2.2 + r() * 1.2, seed = Math.floor(r() * 99); if (!(x + w > 3.0 && x < 6.0)) add({ build: (m) => adobe(m, { w, h: 1.5 + (seed % 3) * 0.25, wall: S.plaster, seed, tile: true }), x: x + w / 2, y: -3.3, yaw: 90, shadow: 1.2 }); x += w + 0.2; }
      add({ build: (m) => belfry(m, 4.2, 2.0), x: 1.6, y: -5.2, yaw: 90, shadow: 1.2 });
      scatterAt(add, [[-1.2, 1.6, 2.6], [-1.2, 10.4, 3.0], [W + 1.2, 3.0, 2.8], [W + 1.2, 11.8, 2.4], [7.4, -1.7, 3.0], [-1.3, 6.9, 2.2]], (m, s) => palm(m, s), { fg: true, shadow: 0.3 });
    },
    props: [
      (m) => { for (const [x, y, s] of [[-0.3, -0.25, 1], [0.4, 0.1, 0.8], [-0.1, 0.5, 0.65]]) m.with(() => { m.move(x, y, 0).scale(s); m.lathe([[0.2, 0], [0.42, 0.3], [0.44, 0.6], [0.24, 0.9], [0.3, 1.0], [0.2, 1.0]], S.tile, { smooth: true, segs: 10 }); m.decal(0.01, () => m.cylinder([0, 0, 0.5], [0, 0, 0.6], 0.45, S.plaster, 0.45, { segs: 10 })); }); },
      (m) => { m.cylinder([0, 0, 0], [0, 0, 0.4], 0.98, S.plaster, 0.92, { segs: 8 }); m.decal(0.02, () => m.cylinder([0, 0, 0.4], [0, 0, 0.41], 0.8, S.water, 0.8, { segs: 8 })); m.cylinder([0, 0, 0.3], [0, 0, 1.0], 0.14, S.plaster, 0.1, { segs: 6 }); m.cylinder([0, 0, 1.0], [0, 0, 1.06], 0.36, S.tile, 0.3, { segs: 8 }); },
      (m) => { m.with(() => { m.rotZ(30); m.extrude([[-0.95, 0.35], [0.85, 0.35], [1.05, 0.5], [0.7, 0], [-0.8, 0]], 0.75, S.teal); m.decal(0.02, () => m.box([-0.1, 0, 0.36], [1.5, 0.55, 0.02], S.pine)); m.decal(0.02, () => m.box([0, 0.38, 0.28], [1.7, 0.01, 0.08], S.white)); }); },
    ],
    ambient: { shade: 0.8, gust: "#f4fbff", motes: [{ kind: "drift", n: 8, colors: ["#f2fbff"], size: 0.028 }], butterflies: 2, flock: { n: 4, color: "#ffffff" } },
  },
  { // 10
    name: "Goldspur", obstacle: "strongboxes", edge: "#6a3a3a", dirt: ["#c08a5e", "#d09a6a", "#a8744c"], out: ["#8f5a48", "#a06a52"], trail: "#e2b888", walk: ["#8a5a3c", "#7a4e33", "#986848"],
    strip: "rails", stripCol: ["#8a6a5a", "#7a5c4e", "#9a7a68", "#6a4e42"], deck: ["#9a6a48", "#8c5e3f", "#a87754"], starCol: "#ffd45e", haze: "#b8553a", hazeA: 0.62, glow: "#ffcf7a",
    decals(p) { p.wash(-0.5, -1.2, W + 1, H + 2.4, "rgba(255,150,70,0.16)", "rgba(90,40,80,0.16)"); for (const y of [1.0, 3.4, 10.6, 13.0]) for (const [a, b] of [[0.4, 3.2], [5.8, 8.6]]) p.line([[a, y], [b, y]], "#ffd45e", 0.05, 0.4); },
    scenery(add, r) {
      town(add, r, { walls: [S.barn, S.cream, S.teal, S.ochre, S.white], lit: true, storeys: 2, awning: [P.team, S.barnDk, S.canvas] });
      // the Palace: the grandest front in the territory, straight up the street
      add({ build: (m) => { falseFront(m, { w: 5.4, d: 2.6, h: 3.0, wall: S.cream, front: S.barn, trim: S.gold, awning: S.canvas, lit: true, seed: 2, storeys: 3 }); m.with(() => { m.move(0.2, 0, 4.2).rotZ(90); m.extrude(starOutline(0.5), 0.08, S.gold); }); }, x: 8.4, y: -6.4, yaw: 90, shadow: 2 });
      add({ build: (m) => waterTower(m, 3.4, 0.85), x: 0.6, y: -6.2, shadow: 1.0 });
      badlands(add, r, -11, 6);
    },
    props: [
      (m) => { m.box([0, 0, 0.5], [1.2, 1.1, 1.0], S.iron); m.decal(0.02, () => m.box([0.605, 0, 0.5], [0.02, 0.86, 0.76], S.greyDk)); m.decal(0.04, () => { m.with(() => { m.move(0.62, 0.1, 0.5).rotZ(90); wheel(m, 0.17, 20, S.gold, S.gold, 6, null); }); }); m.group(() => { for (const [x, y] of [[0.75, -0.5], [0.85, -0.3]]) m.box([x, y, 0.06], [0.3, 0.14, 0.1], S.gold); }); },
      (m) => { m.with(() => { m.rotZ(70); m.box([0, 0, 0.75], [0.8, 1.3, 0.7], S.barn); m.box([0, 0, 1.13], [0.86, 1.4, 0.06], S.pineDk); m.decal(0.02, () => m.group(() => { for (const s of [1, -1]) m.box([s * 0.405, 0, 0.8], [0.02, 0.5, 0.36], S.window); })); for (const y of [-0.45, 0.45]) for (const x of [-0.45, 0.45]) m.with(() => { m.move(x, y, 0.32).rotZ(90); wheel(m, 0.32, 20, S.ochre, S.ochre, 8); }); }); },
      (m) => { m.with(() => { m.move(-0.3, -0.3, 0); crate(m, 0.8, S.pineDk); }); m.with(() => { m.move(0.4, 0.3, 0); crate(m, 0.65); }); m.group(() => { for (const [x, y, z] of [[-0.4, -0.3, 0.85], [-0.2, -0.35, 0.85], [-0.3, -0.2, 0.93]]) m.box([x, y, z], [0.28, 0.13, 0.09], S.gold); }); m.with(() => { m.move(0.4, 0.3, 0.8); dynamite(m, 0.3, 0.05, null, 3); }); },
    ],
    ambient: { shade: 0.3, gust: null, motes: [{ kind: "blink", n: 12, colors: ["#ffe9a3", "#fff6d6"], size: 0.03 }, { kind: "rise", n: 8, colors: ["#ffcf7a"], size: 0.026 }], butterflies: 0, flock: { n: 3, color: "#2a1a22" } },
  },
];

export const ARENAS: ArenaArt = { acts: acts.map(place) };
