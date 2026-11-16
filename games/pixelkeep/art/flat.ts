// Pixelkeep's flat pictures: effect sheets, the ten world maps, the title screen's key art and the Bastion grounds.
// Each is painted (and its models stood in it) smooth, then cut to fat pixels and the console palette in one pass
// (art/pixel.ts), so a picture has a single pixel grid.
import { ROAD_HALF } from "@engine/core/td/maps";
import type { MapArt, MapInfo, StampOpts, Stamps, TdArt, UiArt } from "../../../artkit/flat";
import { Painter, spline, type Pt } from "../../../artkit/paint";
import type { VfxArt } from "../../../artkit/vfx";
import type { Model } from "../../../artkit/toon3d";
import { WORLDS, chequer, tiles } from "./arenas";
import { KEEPS } from "./keeps";
import { P, bomb } from "./parts";
import { pixelate } from "./pixel";
import { bush, cloudBank, hut, tower, tree } from "./scenery";
import { setInk } from "./style";

type Build = (m: Model) => void;
/** Stand a model in a painting with ink about one `block` wide. */
function put(st: Stamps, p: Painter, build: Build, x: number, y: number, block: number, o: StampOpts & { ppu: number }) { setInk((block * 128) / o.ppu); st.model(p, build, x, y, o); }
function putUnit(st: Stamps, p: Painter, kind: string, tier: number, x: number, y: number, block: number, o: StampOpts & { ppu: number; anim?: "idle" | "walk" | "attack"; frame?: number }) { setInk((block * 128) / o.ppu); st.unit(p, kind, tier, x, y, o); }
const keepModel = (boss: boolean): Build => (m) => KEEPS.build(m, { damage: 0, state: "intact", boss, skin: null });
const near = (pts: Pt[], x: number, y: number, d: number) => pts.some(([px, py]) => Math.hypot(px - x, py - y) < d);

// ------------------------------------------------------------------------------------------------ effects
// The base game's effect atlas is soft light, smoke and debris. Every sheet is redrawn from the base sheet, cut to
// blocks with hard (or one-step) alpha and the console palette; the projectiles are redrawn as chunky models.
let baseAtlas: HTMLImageElement | null = null;
if (typeof Image !== "undefined") {
  baseAtlas = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = "/vfx/atlas.png"; });
}
/** Sheets that are light or haze: they keep one half-transparent step, so a puff does not hide the unit under it. */
const SOFT = new Set(["aura", "disc", "ring", "dust", "smoke", "shadow", "chill", "rage", "rally", "shield", "pillar", "vortex", "mirror", "soul", "heal", "shock"]);
const MODELS: NonNullable<VfxArt["models"]> = {
  // an arrow: a pale shaft, a steel head, a white fletching
  arrow: (m) => { m.box([-0.1, 0, 0], [2.6, 0.2, 0.2], P.cream); m.box([1.5, 0, 0], [0.5, 0.36, 0.5], P.steel); m.box([-1.5, 0, 0], [0.5, 0.1, 0.6], P.white); },
  // the Long Cannon's ball, trailing three white pixels
  bolt: (m) => { m.sphere([1.3, 0, 0], 0.42, P.ironDk, { segs: 8 }); for (const [x, s] of [[0.4, 0.4], [-0.4, 0.3], [-1.1, 0.2]]) m.box([x, 0, 0], [0.4, s, s], P.spark); },
  bomb: (m, f) => { m.with(() => { m.rotY(f * 90); bomb(m, 0.3, f % 2 ? P.fire : P.fireHot); }); },
  keg: (m, f) => { m.with(() => { m.rotY(f * 20 - 10); bomb(m, 0.34, f % 2 ? P.fire : P.fireHot, P.redDk); }); },
  shell: (m) => { m.sphere([0, 0, 0], 0.32, P.black, { segs: 8 }); m.box([-0.42, 0, 0.06], [0.3, 0.2, 0.2], P.fire); m.box([-0.7, 0, 0.1], [0.2, 0.14, 0.14], P.fireHot); },
  shard: (m) => { m.cone([-0.2, 0, 0], [0.9, 0, 0], 0.3, P.frostBlue, { segs: 4 }); m.cone([-0.2, 0, 0], [-0.9, 0, 0], 0.3, P.frost, { segs: 4 }); },
  pellet: (m) => { m.box([0, 0, 0], [0.5, 0.5, 0.5], P.spark); },
};
export const VFX: VfxArt = {
  models: MODELS,
  paint: new Proxy({}, {
    get(_t, name: string) {
      if (name in MODELS || !baseAtlas) return undefined;
      return (g: CanvasRenderingContext2D, _f: number, _n: number, w: number, h: number) => {
        const t = g.getTransform(), x = Math.round(t.e), y = Math.round(t.f);
        g.drawImage(baseAtlas!, x, y, w, h, 0, 0, w, h);
        pixelate(g, x, y, w, h, w <= 64 ? 4 : w >= 192 ? 6 : 5, { dither: false, alpha: SOFT.has(name) ? "soft" : true });
      };
    },
  }) as NonNullable<VfxArt["paint"]>,
};

// ------------------------------------------------------------------------------------------------ campaign maps
export const MAPS: MapArt = {
  paint(p: Painter, map: MapInfo, st: Stamps) {
    const wd = WORLDS[map.index], id = map.id, B = 4, TP = 64;
    tiles(p, 0, 0, map.w, map.h, wd.out, undefined, 0.4, TP);
    const road = spline(map.path, 14);
    const full: Pt[] = [[map.camp[0], map.camp[1]], ...road, [map.boss[0], map.boss[1] + 40]];
    const blocked = (x: number, y: number, d: number) => near(full, x, y, d) || Math.hypot(x - map.camp[0], y - map.camp[1]) < 150 || Math.hypot(x - map.boss[0], y - map.boss[1]) < 210;
    // pools on the tile grid, wherever the road is not
    if (wd.pool) for (let i = 0, tries = 0; i < 7 && tries < 200; tries++) {
      const w = TP * (2 + Math.floor(p.r() * 3)), h = TP * (1 + Math.floor(p.r() * 2)), x = Math.floor(p.rand(0, map.w - w) / TP) * TP, y = Math.floor(p.rand(100, map.h - h) / TP) * TP;
      if ([[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2]].some(([cx, cy]) => blocked(cx, cy, 80))) continue;
      p.rect(x, y, w, h, wd.pool[0]);
      for (let yy = y + 18; yy < y + h - 8; yy += 32) for (let xx = x + 12 + ((yy / 32) % 2) * 24; xx < x + w - 30; xx += 72) p.rect(xx, yy, 24, 5, wd.pool[1]);
      i++;
    }
    // the road, with a dark edge and stepping stones down the middle
    p.line(full, wd.road[1], 66); p.line(full, wd.road[0], 50);
    full.forEach(([x, y], i) => { if (i % 3 === 0) p.rect(x - 5, y - 5, 10, 10, wd.road[1]); });
    for (const [c, r] of [[map.camp, 96], [map.boss, 128]] as [Pt, number][]) { p.rect(c[0] - r - 8, c[1] - r * 0.7 - 8, r * 2 + 16, r * 1.4 + 16, wd.plaza[2]); chequer(p, c[0] - r, c[1] - r * 0.7, c[0] + r, c[1] + r * 0.7, wd.plaza[0], wd.plaza[1], 32); }
    // the world's own scenery wherever there is room, then the two keeps
    const all = [...wd.scatter, ...wd.side];
    const spots: { x: number; y: number; draw(): void }[] = [];
    for (let i = 0, tries = 0; i < 46 && tries < 1200; tries++) {
      const x = p.rand(20, map.w - 20), y = p.rand(120, map.h - 30);
      if (blocked(x, y, 84) || spots.some((s) => Math.abs(s.y - y) < 54 && Math.abs(s.x - x) < 84)) continue;
      const v = Math.floor(p.r() * all.length);
      spots.push({ x, y, draw: () => put(st, p, all[v], x, y, B, { ppu: 54, yaw: v % 2 ? 72 : 108, el: 44, key: `${id}s${v}` }) });
      i++;
    }
    const lx = map.boss[0] + (map.boss[0] > map.w / 2 ? -250 : 250);
    spots.push({ x: lx, y: map.boss[1] - 40, draw: () => put(st, p, wd.far[2], lx, map.boss[1] - 40, B, { ppu: 80, yaw: 80, el: 46 }) });
    spots.push({ x: 0, y: map.boss[1], draw: () => put(st, p, keepModel(true), map.boss[0], map.boss[1], B, { ppu: 84, yaw: 90, el: 52, team: "ember" }) });
    spots.push({ x: 0, y: map.camp[1], draw: () => put(st, p, keepModel(false), map.camp[0], map.camp[1], B, { ppu: 64, yaw: 90, el: 52, team: "tide" }) });
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    pixelate(p.g, 0, 0, p.canvas.width, p.canvas.height, B);
  },
};

// ------------------------------------------------------------------------------------------------ key art
export const UI: UiArt = {
  titleKey(p, st) {
    // The title screen shows the whole picture and its menu covers everything below about 60% of the height: the
    // castle stands on a horizon at 44%, the army in front of it, and the sky above carries the sun and the fliers.
    const W = 1206, H = 2622, g = p.g, HZ = 1150, B = 6;
    const sky = g.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, "#0040bf"); sky.addColorStop(0.3, "#4080ff"); sky.addColorStop(0.75, "#80bfff"); sky.addColorStop(1, "#bfffff");
    g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    // a square sun and blocky clouds
    p.rect(820, 260, 216, 216, "#ffff80"); p.rect(844, 284, 168, 168, "#ffffff");
    for (const [x, y, s] of [[90, 420, 1], [520, 230, 0.8], [960, 640, 1.1], [300, 760, 0.7], [700, 900, 0.6]]) { p.rect(x, y, 264 * s, 48 * s, "#ffffff"); p.rect(x + 48 * s, y - 36 * s, 150 * s, 48 * s, "#ffffff"); p.rect(x + 24 * s, y + 42 * s, 216 * s, 18 * s, "#bfffff"); }
    // two ranges of stepped hills
    const hills = (base: number, col: string, hmax: number, seed: number, step: number) => {
      let s = seed;
      const rr = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      for (let x = -40; x < W + 40;) { const w = step * (2 + Math.floor(rr() * 4)), h = step * (1 + Math.floor(rr() * hmax)); for (let k = 0; k * step < h; k++) p.rect(x + k * step * 0.5, base - h + k * step, w - k * step, step + 2, col); x += w * 0.8; }
      p.rect(0, base, W, 80, col);
    };
    hills(HZ - 90, "#40bf80", 4, 3, 48); hills(HZ - 20, "#008040", 3, 11, 42);
    // the field: tiles, a road to the gate, a chequered plaza
    tiles(p, 0, HZ, W, H, WORLDS[0].field, undefined, 0.4, 96);
    p.poly([[603 - 70, HZ + 150], [603 + 70, HZ + 150], [603 + 260, H], [603 - 260, H]], "#ffbf80");
    for (const o of [-1, 1]) p.poly([[603 + o * 70, HZ + 150], [603 + o * 82, HZ + 150], [603 + o * 290, H], [603 + o * 260, H]], "#bf8040");
    chequer(p, 603 - 330, HZ + 60, 603 + 330, HZ + 250, "#ffbf80", "#bf8040", 48);
    // trees and huts down both sides
    const side: [Build, number, number, number][] = [[(m) => tree(m, 1.2), 70, HZ + 70, 150], [(m) => tree(m, 1), 230, HZ + 30, 120], [(m) => hut(m, 1.1), 1090, HZ + 60, 150], [(m) => tree(m, 1.1), 960, HZ + 30, 120], [(m) => tower(m, 0.9), 150, HZ + 10, 110], [(m) => tree(m, 1.3), 1160, HZ + 200, 170], [(m) => bush(m, 1.2, undefined, P.red), 60, HZ + 300, 170]];
    side.sort((a, b) => a[2] - b[2]).forEach(([b, x, y, ppu]) => put(st, p, b, x, y, B, { ppu, yaw: x < 600 ? 70 : 110, el: 24 }));
    // the keep and the army
    put(st, p, keepModel(false), 603, HZ + 150, B, { ppu: 210, yaw: 90, el: 28, team: "tide" });
    const cast: [string, number, number, number, number, number][] = [["golem", 3, 170, HZ + 330, 250, 62], ["lancer", 3, 1030, HZ + 350, 260, 124], ["storm", 3, 420, HZ + 370, 290, 70], ["bulwark", 3, 330, HZ + 470, 320, 66], ["ranger", 3, 880, HZ + 470, 320, 112], ["mite", 1, 760, HZ + 560, 330, 100], ["lion", 4, 603, HZ + 560, 380, 84]];
    for (const [kind, tier, x, y, ppu, yaw] of cast) putUnit(st, p, kind, tier, x, y, B, { ppu, yaw, el: 24 });
    putUnit(st, p, "harrier", 3, 250, HZ - 430, B, { ppu: 250, yaw: 40, el: 20, anim: "walk", frame: 1 });
    putUnit(st, p, "griffin", 3, 800, HZ - 560, B, { ppu: 200, yaw: 140, el: 20, anim: "walk", frame: 2 });
    put(st, p, (m) => cloudBank(m, 1), 1100, HZ - 330, B, { ppu: 170, yaw: 90, el: 10 });
    // the menu covers the bottom: fade it to the page colour in dithered bands
    const fade = g.createLinearGradient(0, HZ + 620, 0, HZ + 1100);
    fade.addColorStop(0, "rgba(8,8,32,0)"); fade.addColorStop(1, "rgba(8,8,32,1)");
    g.fillStyle = fade; g.fillRect(0, HZ + 620, W, H - HZ - 620);
    pixelate(g, 0, 0, W, H, B);
  },
};

// ------------------------------------------------------------------------------------------------ bastion
export const TDART: TdArt = {
  paint(p, map, st) {
    const M = 3.5, wd = WORLDS[(map.act - 1) % WORLDS.length], B = 3;
    tiles(p, -M, -M, map.w + M, map.h + M, wd.field, wd.grid);
    const roads = map.paths.map((r) => r.pts.map((q) => [q.x, q.y] as Pt));
    for (const r of roads) p.line(r, wd.road[1], ROAD_HALF * 2 + 0.24);
    for (const r of roads) p.line(r, wd.road[0], ROAD_HALF * 2 - 0.08);
    const pts = roads.flat();
    for (const [q, rr] of [[map.keep, 2.0], ...map.gates.map((gq) => [gq, 1.3] as [typeof gq, number])] as [{ x: number; y: number }, number][]) {
      p.rect(q.x - rr - 0.1, q.y - rr - 0.1, rr * 2 + 0.2, rr * 2 + 0.2, wd.plaza[2]);
      chequer(p, q.x - rr, q.y - rr, q.x + rr, q.y + rr, wd.plaza[0], wd.plaza[1], rr / 3);
    }
    // build pads: a framed square of the strip's tiles
    for (const pad of map.pads) { p.rect(pad.x - 0.58, pad.y - 0.58, 1.16, 1.16, wd.strip[2]); chequer(p, pad.x - 0.48, pad.y - 0.48, pad.x + 0.48, pad.y + 0.48, wd.strip[0], wd.strip[1], 0.32); }
    const free = (x: number, y: number, rad: number) => !near(pts, x, y, ROAD_HALF + rad + 0.3) && !map.pads.some((q) => Math.hypot(q.x - x, q.y - y) < 0.95 + rad) && Math.hypot(map.keep.x - x, map.keep.y - y) > 2.6 + rad && !map.gates.some((q) => Math.hypot(q.x - x, q.y - y) < 1.9 + rad);
    const all = [...wd.side, ...wd.scatter];
    const spots: { y: number; draw(): void }[] = [];
    for (let y = -M + 0.6; y < map.h + M; y += 1.75) for (let x = -M + 0.8 + (Math.round(y / 1.75) % 2) * 0.9; x < map.w + M; x += 2.05) {
      const px = x + p.rand(-0.25, 0.25), py = y + p.rand(-0.2, 0.2);
      if (!free(px, py, 0.8) || p.r() < 0.35) continue;
      const v = Math.floor(p.r() * all.length);
      spots.push({ y: py, draw: () => put(st, p, all[v], px, py, B, { ppu: 60, yaw: v % 2 ? 74 : 106, el: 53.13, key: `td${map.act}s${v}` }) });
    }
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    pixelate(p.g, 0, 0, p.canvas.width, p.canvas.height, B);
  },
};
