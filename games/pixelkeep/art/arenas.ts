// Pixelkeep's ten battlefields: one "world" of the cartridge per campaign act. Each is a tile map: a field of flat
// and dithered tiles, a road between the keeps, a paved neutral strip, a tiled plaza under each keep, and rows of
// tile-map scenery round the edge. The whole backdrop (ground and scenery together) is cut to the game's pixel grid
// and palette by the `grade` pass, so one art pixel is the same size everywhere on it.
import type { ArenaArt, ArenaDef } from "../../../artkit/arena";
import type { Painter } from "../../../artkit/paint";
import type { Model } from "../../../artkit/toon3d";
import { dither, pixelate } from "./pixel";
import { S, barrel, bush, cactus, cloudBank, crate, crystal, deadTree, hut, mushroom, palm, pillar, pine, rock, snowman, tower, tree, wall } from "./scenery";
import { ARENA_PX, setArenaPhase, setInk } from "./style";

const W = 9, H = 14, STRIP0 = 5.9, STRIP1 = 8.1, TILE = 0.75;
const KEEPS: [number, number][] = [[4.5, 13.4], [4.5, 1.55]];
type Build = (m: Model) => void;

export interface World {
  name: string; obstacle: string; edge: string;
  /** The battlefield's tiles: flat colour, its dither partner, the colour of the little marks (tufts, pebbles). */
  field: [string, string, string];
  /** Stone floors draw their tile joints in this colour. */
  grid?: string;
  /** The country outside the board. */
  out: [string, string, string];
  /** The road between the keeps: fill and edge. */
  road: [string, string];
  /** The neutral strip: two tile colours and the kerb on each zone line. */
  strip: [string, string, string];
  /** The plaza under each keep: two tile colours and the border. */
  plaza: [string, string, string];
  /** Pools outside the board (water, lava, ice): fill and glint. Null for none. */
  pool: [string, string] | null;
  /** Scenery: the row along each side, the big things across the far end, and what is scattered beyond. */
  side: Build[]; far: Build[]; scatter: Build[];
  props: Build[];
  ambient?: ArenaDef["ambient"];
}

/** Paint a rectangle of square tiles: each is flat, dithered or marked. */
export function tiles(p: Painter, x0: number, y0: number, x1: number, y1: number, c: [string, string, string], grid?: string, markRate = 0.3, T = TILE) {
  const mid = dither(c[0], c[1]), u = T / 0.75;
  for (let y = y0; y < y1 - 1e-6; y += T) for (let x = x0; x < x1 - 1e-6; x += T) {
    const w = Math.min(T, x1 - x), h = Math.min(T, y1 - y), k = p.r();
    p.rect(x, y, w + 0.01 * u, h + 0.01 * u, k < 0.2 ? mid : k < 0.27 ? c[1] : c[0]);
    if (grid) { p.rect(x, y, w, 0.07 * u, grid); p.rect(x, y, 0.06 * u, h, grid); }
    else if (p.r() < markRate) { const mx = x + p.rand(0.1, 0.45) * u, my = y + p.rand(0.1, 0.45) * u; p.rect(mx, my, 0.07 * u, 0.16 * u, c[2]); p.rect(mx + 0.13 * u, my + 0.05 * u, 0.07 * u, 0.13 * u, c[2]); p.rect(mx - 0.12 * u, my + 0.07 * u, 0.07 * u, 0.1 * u, c[2]); }
  }
}
/** A chequered floor of half tiles. */
export function chequer(p: Painter, x0: number, y0: number, x1: number, y1: number, a: string, b: string, size = TILE / 2) {
  let row = 0;
  for (let y = y0; y < y1 - 1e-6; y += size, row++) { let col = row; for (let x = x0; x < x1 - 1e-6; x += size, col++) p.rect(x, y, Math.min(size, x1 - x) + 0.01, Math.min(size, y1 - y) + 0.01, col % 2 ? a : b); }
}

/** The ten worlds, in campaign order (the maps, the key art and the Bastion grounds reuse their colours). */
export const WORLDS: World[] = [];
function world(d: World): ArenaDef {
  WORLDS.push(d);
  return {
    name: d.name, edge: d.edge, obstacle: d.obstacle, ambient: d.ambient, props: d.props,
    ground(p) {
      setArenaPhase("scenery"); setInk(5.2);
      // the country outside, with a few pools
      tiles(p, -8, -17, 17, 21, d.out, undefined, 0.4);
      if (d.pool) for (const [x, y, w, h] of [[-4.5, 2, 3, 2.25], [10.5, 8, 3, 3], [-5.25, 10.25, 3.75, 2.25], [10.5, -3.25, 3, 2.25], [-6, -6.5, 4.5, 2.25], [4, -9, 6, 1.5], [11, -8, 3, 3]]) {
        p.rect(x, y, w, h, d.pool[0]);
        for (let yy = y + 0.3; yy < y + h - 0.2; yy += 0.75) for (let xx = x + 0.25 + ((yy * 4) % 2) * 0.4; xx < x + w - 0.5; xx += 1.5) p.rect(xx, yy, 0.4, 0.08, d.pool[1]);
      }
      // the battlefield
      p.rect(-0.62, -0.62, W + 1.24, H + 1.24, d.road[1]);
      tiles(p, -0.5, -0.5, W + 0.5, H + 0.5, d.field, d.grid);
      // the road from keep to keep, dashed along its edges
      p.rect(3.75, -17, 1.5, 38, d.road[0]);
      for (let y = -17; y < 21; y += 0.5) for (const x of [3.75, 5.17]) p.rect(x, y, 0.08, 0.3, d.road[1]);
      // the neutral strip: a chequered causeway right across the map, a kerb on each zone line
      chequer(p, -8, STRIP0, 17, STRIP1, d.strip[0], d.strip[1], 0.55);
      for (const y of [STRIP0, STRIP1]) { p.rect(-8, y - 0.11, 25, 0.22, d.strip[2]); for (let x = -0.4; x < W + 0.4; x += 0.75) p.rect(x, y - 0.05, 0.3, 0.1, d.strip[0]); }
      // a tiled plaza under each keep
      for (const [kx, ky] of KEEPS) {
        p.rect(kx - 1.82, ky - 1.5, 3.64, 3.0, d.plaza[2]);
        chequer(p, kx - 1.7, ky - 1.38, kx + 1.7, ky + 1.38, d.plaza[0], d.plaza[1], 0.425);
      }
    },
    scenery(add, r) {
      const pick = (l: Build[]) => l[Math.floor(r() * l.length) % l.length];
      // a row down each side, close enough to frame the board on a phone
      for (const x of [-1.15, W + 1.15]) for (let y = -0.2; y < H + 1; y += 1.25) {
        if (y > STRIP0 - 0.6 && y < STRIP1 + 0.6) continue;
        add({ build: pick(d.side), x: x + (r() - 0.5) * 0.3, y: y + (r() - 0.5) * 0.3, yaw: 60 + r() * 60 });
      }
      // the big things across the far end, either side of the road
      d.far.forEach((b, i) => { const n = d.far.length, x = -2.2 + (i / Math.max(1, n - 1)) * (W + 4.4); if (Math.abs(x - 4.5) > 1.2) add({ build: b, x, y: -1.9 - (i % 2) * 0.5, yaw: 90 }); });
      for (let x = -3.5; x < W + 4; x += 1.5) if (Math.abs(x - 4.5) > 1.3) add({ build: pick(d.side), x: x + (r() - 0.5) * 0.5, y: -3.8 - r() * 0.6, yaw: 90 });
      // and the rest of the map, for wide screens
      for (let i = 0; i < 70; i++) {
        const x = -7.5 + r() * 24, y = -15 + r() * 34;
        if (x > -2.2 && x < W + 2.2 && y > -4.6 && y < H + 2) continue;
        if (Math.abs(x - 4.5) < 1.3 || (y > STRIP0 - 0.5 && y < STRIP1 + 0.5)) continue;
        add({ build: pick(d.scatter), x, y, yaw: 60 + r() * 60 });
      }
    },
    grade(g, w, h) {
      pixelate(g, 0, 0, w, h, ARENA_PX);
      setArenaPhase("props");
    },
  };
}

const none: ArenaDef["ambient"] = { shade: 0, gust: null, motes: [], butterflies: 0, flock: null };
const motes = (kind: "drift" | "fall" | "rise" | "blink", n: number, colors: string[], size = 0.05): ArenaDef["ambient"] => ({ ...none, motes: [{ kind, n, colors, size }] });

export const ARENAS: ArenaArt = {
  team: { main: "#ffbf00", dark: "#bf8000", light: "#ffff80" },
  acts: [
    world({
      name: "Grassy Plains", obstacle: "tree", edge: "#008000",
      field: ["#40bf40", "#008000", "#80ff40"], out: ["#40bf40", "#008000", "#008000"], road: ["#ffbf80", "#bf8040"],
      strip: ["#bfbfbf", "#808080", "#404040"], plaza: ["#ffbf80", "#bf8040", "#804000"], pool: ["#4080ff", "#ffffff"],
      side: [(m) => tree(m, 1), (m) => tree(m, 0.85), (m) => bush(m, 1, S.leaf, S.roofRed)], far: [(m) => hut(m, 1.2), (m) => tree(m, 1.3), (m) => tower(m, 0.9), (m) => tower(m, 0.9), (m) => tree(m, 1.3), (m) => hut(m, 1.2, S.roofBlue)],
      scatter: [(m) => tree(m, 1.1), (m) => bush(m), (m) => rock(m, 0.8), (m) => hut(m)],
      props: [(m) => tree(m, 1.25), (m) => rock(m, 1.25), (m) => bush(m, 1.5, S.leaf, S.roofRed)],
      ambient: { ...none, butterflies: 3 },
    }),
    world({
      name: "Magma Fields", obstacle: "rock", edge: "#400000",
      field: ["#808080", "#804040", "#404040"], out: ["#400000", "#200000", "#804040"], road: ["#808080", "#404040"],
      strip: ["#404040", "#202020", "#ff8000"], plaza: ["#808080", "#404040", "#ff8000"], pool: ["#ff8000", "#ffff40"],
      side: [(m) => rock(m, 0.9, S.caveDk, S.cave), (m) => pillar(m, 0.8, S.stoneDk, S.slate, S.lava), (m) => deadTree(m, 0.9, S.caveDk)], far: [(m) => rock(m, 1.8, S.caveDk, S.cave), (m) => pillar(m, 1.3, S.stoneDk, S.slate, S.lava), (m) => tower(m, 1.0, S.caveDk, S.cave, null, S.lava), (m) => tower(m, 1.0, S.caveDk, S.cave, null, S.lava), (m) => pillar(m, 1.3, S.stoneDk, S.slate, S.lava), (m) => rock(m, 1.8, S.caveDk, S.cave)],
      scatter: [(m) => rock(m, 1.2, S.caveDk, S.cave), (m) => deadTree(m, 1, S.caveDk)],
      props: [(m) => rock(m, 1.25, S.caveDk, S.cave), (m) => pillar(m, 1.2, S.stoneDk, S.slate, S.lava), (m) => crystal(m, 1.1, S.lava)],
      ambient: motes("rise", 20, ["#ff8000", "#ffff40"], 0.05),
    }),
    world({
      name: "Deep Woods", obstacle: "pine", edge: "#004040",
      field: ["#008000", "#004040", "#40bf40"], out: ["#008040", "#004040", "#004040"], road: ["#bf8040", "#804000"],
      strip: ["#804000", "#bf8040", "#402000"], plaza: ["#bf8040", "#804000", "#402000"], pool: ["#4040bf", "#80bfff"],
      side: [(m) => pine(m, 1), (m) => pine(m, 1.15), (m) => mushroom(m, 0.7)], far: [(m) => pine(m, 1.5), (m) => pine(m, 1.3), (m) => hut(m, 1.1, S.leafDk, S.trunkLt), (m) => pine(m, 1.4), (m) => pine(m, 1.5), (m) => pine(m, 1.3)],
      scatter: [(m) => pine(m, 1.2), (m) => pine(m, 1), (m) => mushroom(m, 0.8), (m) => bush(m, 1, S.leafDk)],
      props: [(m) => pine(m, 1.2), (m) => mushroom(m, 1.6), (m) => rock(m, 1.25, S.stoneDk, S.slate)],
      ambient: motes("drift", 10, ["#ffff80", "#80ff40"], 0.045),
    }),
    world({
      name: "Crystal Cave", obstacle: "crystal", edge: "#200020",
      field: ["#bf8040", "#804040", "#ffbf80"], out: ["#402020", "#200020", "#804040"], road: ["#ffbf80", "#804040"],
      strip: ["#8040bf", "#400080", "#200040"], plaza: ["#bf8080", "#804040", "#200020"], pool: ["#400080", "#ff80ff"],
      side: [(m) => rock(m, 0.9, S.cave, S.caveDk), (m) => crystal(m, 0.8), (m) => crystal(m, 0.7, S.crystalBlue)], far: [(m) => crystal(m, 1.6), (m) => rock(m, 1.6, S.cave, S.caveDk), (m) => crystal(m, 1.3, S.crystalBlue), (m) => crystal(m, 1.5), (m) => rock(m, 1.6, S.cave, S.caveDk), (m) => crystal(m, 1.4, S.crystalBlue)],
      scatter: [(m) => rock(m, 1.2, S.cave, S.caveDk), (m) => crystal(m, 1), (m) => crystal(m, 0.9, S.crystalBlue)],
      props: [(m) => crystal(m, 1.2), (m) => rock(m, 1.25, S.cave, S.caveDk), (m) => crystal(m, 1.2, S.crystalBlue)],
      ambient: motes("blink", 14, ["#ff80ff", "#80ffff"], 0.045),
    }),
    world({
      name: "Castle Yard", obstacle: "crate", edge: "#404040",
      field: ["#bfbfbf", "#808080", "#808080"], grid: "#808080", out: ["#40bf40", "#008000", "#008000"], road: ["#ffbf80", "#804040"],
      strip: ["#bf4040", "#802020", "#400000"], plaza: ["#ffffff", "#4080ff", "#404080"], pool: ["#4080ff", "#ffffff"],
      side: [(m) => wall(m, 1.3, 1), (m) => wall(m, 1.3, 1), (m) => tower(m, 0.7)], far: [(m) => tower(m, 1.1), (m) => wall(m, 2.4, 1.2), (m) => tower(m, 1.3), (m) => tower(m, 1.3), (m) => wall(m, 2.4, 1.2), (m) => tower(m, 1.1)],
      scatter: [(m) => tree(m, 1.1), (m) => hut(m), (m) => bush(m)],
      props: [(m) => { crate(m, 1.3); }, (m) => barrel(m, 1.25), (m) => pillar(m, 1.2, S.stone, S.stoneDk)],
    }),
    world({
      name: "Frost Field", obstacle: "snow", edge: "#80bfff",
      field: ["#bfffff", "#80bfff", "#ffffff"], out: ["#ffffff", "#bfffff", "#80bfff"], road: ["#bfbfff", "#8080bf"],
      strip: ["#80ffff", "#40bfff", "#4040bf"], plaza: ["#bfbfff", "#8080bf", "#404080"], pool: ["#80ffff", "#ffffff"],
      side: [(m) => pine(m, 1, S.pine, S.snow), (m) => pine(m, 1.1, S.pine, S.snow), (m) => snowman(m, 0.8)], far: [(m) => pine(m, 1.5, S.pine, S.snow), (m) => hut(m, 1.2, S.snow, S.trunkLt), (m) => pine(m, 1.3, S.pine, S.snow), (m) => tower(m, 0.9, S.stone, S.stoneDk, S.snow), (m) => pine(m, 1.4, S.pine, S.snow), (m) => snowman(m, 1.2)],
      scatter: [(m) => pine(m, 1.2, S.pine, S.snow), (m) => rock(m, 0.8, S.snow, S.snowDk), (m) => snowman(m)],
      props: [(m) => snowman(m, 1.35), (m) => rock(m, 1.25, S.snow, S.snowDk), (m) => crystal(m, 1.2, S.crystalBlue)],
      ambient: motes("fall", 26, ["#ffffff", "#bfffff"], 0.055),
    }),
    world({
      name: "Cloud Top", obstacle: "pillar", edge: "#4080ff",
      field: ["#ffffff", "#bfffff", "#80bfff"], out: ["#80bfff", "#4080ff", "#ffffff"], road: ["#ffffbf", "#ffbf40"],
      strip: ["#ffbf40", "#ffffbf", "#bf8000"], plaza: ["#ffffbf", "#ffbf40", "#bf8000"], pool: null,
      side: [(m) => cloudBank(m, 1), (m) => pillar(m, 0.9), (m) => cloudBank(m, 0.8)], far: [(m) => pillar(m, 1.5), (m) => cloudBank(m, 1.6), (m) => pillar(m, 1.3), (m) => pillar(m, 1.3), (m) => cloudBank(m, 1.6), (m) => pillar(m, 1.5)],
      scatter: [(m) => cloudBank(m, 1.4), (m) => cloudBank(m, 1), (m) => pillar(m)],
      props: [(m) => pillar(m, 1.2), (m) => cloudBank(m, 1.5), (m) => crystal(m, 1.1, S.gold)],
      ambient: { ...none, flock: { n: 5, color: "#ffffff" } },
    }),
    world({
      name: "Murk Marsh", obstacle: "stump", edge: "#004040",
      field: ["#408040", "#404040", "#80bf40"], out: ["#408040", "#004040", "#004040"], road: ["#808040", "#404000"],
      strip: ["#804040", "#402020", "#200000"], plaza: ["#808080", "#404040", "#202020"], pool: ["#8040bf", "#ff80ff"],
      side: [(m) => deadTree(m, 1), (m) => bush(m, 1, S.swamp), (m) => mushroom(m, 0.8, S.darkLt)], far: [(m) => deadTree(m, 1.5), (m) => tree(m, 1.2, S.swamp, null, S.dead), (m) => hut(m, 1.1, S.darkLt, S.stoneDk), (m) => deadTree(m, 1.4), (m) => tree(m, 1.3, S.swamp, null, S.dead), (m) => deadTree(m, 1.5)],
      scatter: [(m) => deadTree(m, 1.1), (m) => bush(m, 1, S.swamp), (m) => mushroom(m, 1, S.darkLt)],
      props: [(m) => deadTree(m, 1.2), (m) => mushroom(m, 1.6, S.darkLt), (m) => rock(m, 1.25, S.swamp, S.swampDk)],
      ambient: motes("blink", 12, ["#80ff40", "#ffff80"], 0.045),
    }),
    world({
      name: "Sandy Shore", obstacle: "cactus", edge: "#bf8040",
      field: ["#ffbf80", "#ffff80", "#bf8040"], out: ["#ffbf80", "#bf8040", "#bf8040"], road: ["#ffffbf", "#bf8040"],
      strip: ["#bf8040", "#804000", "#402000"], plaza: ["#ffffbf", "#ffbf40", "#bf8040"], pool: ["#40bfff", "#ffffff"],
      side: [(m) => palm(m, 1), (m) => cactus(m, 0.9), (m) => rock(m, 0.6, S.sand, S.sandDk)], far: [(m) => palm(m, 1.4), (m) => hut(m, 1.2, S.roofBlue, S.sand), (m) => palm(m, 1.2), (m) => palm(m, 1.3), (m) => tower(m, 0.9, S.sand, S.sandDk, null), (m) => palm(m, 1.4)],
      scatter: [(m) => palm(m, 1.1), (m) => cactus(m), (m) => rock(m, 0.8, S.sand, S.sandDk)],
      props: [(m) => cactus(m, 1.35), (m) => rock(m, 1.25, S.sand, S.sandDk), (m) => { barrel(m, 1.1); }],
    }),
    world({
      name: "Dark Keep", obstacle: "torch", edge: "#200040",
      field: ["#402060", "#200040", "#8040bf"], grid: "#200040", out: ["#200040", "#000020", "#402060"], road: ["#8040bf", "#400080"],
      strip: ["#404080", "#202040", "#ffbf00"], plaza: ["#8040bf", "#400080", "#ffbf00"], pool: ["#40ff80", "#ffffff"],
      side: [(m) => pillar(m, 0.9, S.dark, S.darkDk, S.lava), (m) => wall(m, 1.3, 1, S.dark, S.darkDk), (m) => pillar(m, 0.8, S.dark, S.darkDk, S.crystal)], far: [(m) => tower(m, 1.2, S.dark, S.darkDk, S.roofRed, S.lava), (m) => wall(m, 2.4, 1.3, S.dark, S.darkDk), (m) => tower(m, 1.5, S.dark, S.darkDk, S.roofRed, S.lava), (m) => tower(m, 1.5, S.dark, S.darkDk, S.roofRed, S.lava), (m) => wall(m, 2.4, 1.3, S.dark, S.darkDk), (m) => tower(m, 1.2, S.dark, S.darkDk, S.roofRed, S.lava)],
      scatter: [(m) => deadTree(m, 1.1, S.dark), (m) => pillar(m, 1, S.dark, S.darkDk, S.lava), (m) => rock(m, 1, S.dark, S.darkDk)],
      props: [(m) => pillar(m, 1.2, S.dark, S.darkDk, S.lava), (m) => crystal(m, 1.2), (m) => rock(m, 1.25, S.dark, S.darkDk)],
      ambient: motes("rise", 12, ["#ff80ff", "#ffbf00"], 0.045),
    }),
  ],
};
