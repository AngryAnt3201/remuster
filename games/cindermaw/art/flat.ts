// Cindermaw's flat pictures: projectiles, the ten zone maps, the title screen's key art and the Holdout grounds.
// Each picture is painted (and its models stood in it) smooth, then cut to fat pixels and crushed to the game's
// 34 colours with an ordered dither in one pass, the way the battle canvas is (src/game/terrain.ts `post`).
import { ROAD_HALF } from "@engine/core/td/maps";
import type { MapArt, MapInfo, StampOpts, Stamps, TdArt, UiArt } from "../../../artkit/flat";
import { Painter, rgba, shade, spline, type Pt } from "../../../artkit/paint";
import type { VfxArt } from "../../../artkit/vfx";
import type { Model } from "../../../artkit/toon3d";
import { GROUNDS, PROPS, type Ground } from "./arenas";
import { KEEPS } from "./keeps";
import { P } from "./parts";
import { setSmoothStamps } from "./style";

/** The battle palette (keep in step with `post.palette` in src/game/terrain.ts). */
export const PALETTE = ["#000000", "#1c0c08", "#3a1410", "#5a1c14", "#8a1c12", "#b3170d", "#e03a10", "#ff7a1c", "#ffb020", "#ffe070", "#2a1c14", "#4a3830", "#6b5348", "#8f7a66", "#b8a488", "#e0d4b8",
  "#22262a", "#3a3f44", "#5d646a", "#8a9298", "#bcc4c8", "#ffffff", "#2f4a12", "#4d6a1c", "#7aa024", "#b8e03a", "#0c3a4a", "#1c6a8a", "#3aa8d0", "#6a1c6a", "#b040b0", "#5a3a1c", "#8a5a2a", "#c08a40"];
const PAL = PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Cut a canvas region to `b`-pixel blocks and crush it to the palette with ordered dither. */
export function crush(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, b: number, dither = 0.7) {
  const img = g.getImageData(x0, y0, w, h), d = img.data, memo = new Map<number, number>(), dz = dither * 48;
  for (let by = 0; by * b < h; by++) for (let bx = 0; bx * b < w; bx++) {
    const cx = Math.min(w - 1, bx * b + (b >> 1)), cy = Math.min(h - 1, by * b + (b >> 1)), i = (cy * w + cx) * 4;
    const t = (BAYER[(by & 3) * 4 + (bx & 3)] / 16 - 0.47) * dz;
    const r = Math.max(0, Math.min(255, d[i] + t)) & 0xf8, gg = Math.max(0, Math.min(255, d[i + 1] + t)) & 0xf8, bl = Math.max(0, Math.min(255, d[i + 2] + t)) & 0xf8;
    const key = (r << 16) | (gg << 8) | bl;
    let best = memo.get(key);
    if (best === undefined) { let bd = 1e9; best = 0; for (let j = 0; j < PAL.length; j++) { const q = PAL[j], dr = q[0] - r, dg = q[1] - gg, db = q[2] - bl, dd = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; if (dd < bd) { bd = dd; best = j; } } memo.set(key, best); }
    const q = PAL[best];
    for (let yy = by * b; yy < Math.min(h, by * b + b); yy++) for (let xx = bx * b; xx < Math.min(w, bx * b + b); xx++) { const j = (yy * w + xx) * 4; d[j] = q[0]; d[j + 1] = q[1]; d[j + 2] = q[2]; d[j + 3] = 255; }
  }
  g.putImageData(img, x0, y0);
}

type Build = (m: Model) => void;
const put = (st: Stamps, p: Painter, build: Build, x: number, y: number, o: StampOpts) => { setSmoothStamps(true); st.model(p, build, x, y, o); setSmoothStamps(false); };
const putUnit = (st: Stamps, p: Painter, kind: string, tier: number, x: number, y: number, o: StampOpts & { anim?: "idle" | "walk" | "attack"; frame?: number }) => { setSmoothStamps(true); st.unit(p, kind, tier, x, y, o); setSmoothStamps(false); };
const keepModel = (boss: boolean): Build => (m) => KEEPS.build(m, { damage: 0, state: "intact", boss, skin: null });
const near = (pts: Pt[], x: number, y: number, d: number) => pts.some(([px, py]) => Math.hypot(px - x, py - y) < d);
const pylonLamp: Build = (m) => { m.box([0, 0, 0.5], [0.4, 0.4, 1.0], P.ironDk); m.decal(0.02, () => m.box([0, 0, 0.2], [0.42, 0.42, 0.12], P.hazard)); m.box([0, 0, 1.12], [0.24, 0.24, 0.24], P.redLamp); };
const deadTree: Build = (m) => { m.cylinder([0, 0, 0], [0.05, 0, 1.2], 0.14, P.char, 0.07, { segs: 5 }); for (const [a, z, l] of [[0.5, 0.7, 0.7], [2.6, 0.9, 0.6], [4.4, 1.1, 0.5]]) m.cylinder([0.03, 0, z], [Math.cos(a) * l, Math.sin(a) * l, z + l * 0.7], 0.06, P.char, 0.02, { segs: 4 }); };
const SCENE: Build[] = [...PROPS.map((b): Build => (m) => { m.scale(0.6); b(m); }), pylonLamp, deadTree];

/** Rough ground for a flat picture: base colour, blotches, cracks (units are whatever the painter's are; `u` is one world unit). */
function rough(p: Painter, d: Ground, x: number, y: number, w: number, h: number, u: number, base = d.out) {
  p.rect(x, y, w, h, base);
  const n = Math.round((w * h) / (u * u));
  p.mottle(x, y, w, h, shade(base, -0.22), { alpha: 0.45, n: Math.round(n * 0.5), size: [0.3 * u, 1.3 * u] });
  p.mottle(x, y, w, h, shade(base, 0.16), { alpha: 0.3, n: Math.round(n * 0.4), size: [0.2 * u, 0.8 * u] });
  if (d.kind === "plate" || d.kind === "slab" || d.kind === "tile" || d.kind === "grate") p.slabs(x, y, w, h, [rgba("#000000", 0)], { sw: 1.5 * u, sh: 1.0 * u, joint: 0.05 * u, jointColor: rgba("#0a0605", 0.55) });
  else p.cracks(x, y, w, h, Math.round(n * 0.2), rgba("#0a0605", 0.5), 0.04 * u);
}
function blob(p: Painter, x: number, y: number, r: number, hot: string, glow: string) {
  const pts: Pt[] = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, rr = r * p.rand(0.75, 1.1); pts.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * 0.85]); }
  p.poly(pts.map(([px, py]) => [x + (px - x) * 1.14, y + (py - y) * 1.14] as Pt), "#140806");
  p.poly(pts, hot);
  p.glow(x, y, r * 0.9, glow, 0.5, "lighter", r * 0.55);
}

// ------------------------------------------------------------------------------------------------ effects
// The base atlas is greyscale light and smoke the runtime tints, which the battle's palette crush turns to grit.
// The projectiles are redrawn: tracers, rail spikes, pipe bombs, hazard drums, slag.
export const VFX: VfxArt = {
  grade: { "*": { saturation: 1.15, tint: "#ff7a1c", amount: 0.1 }, heal: { tint: "#6affb0", amount: 0.5 }, goo: { tint: "#7aa024", amount: 0.5 }, dirt: { tint: "#4a3830", amount: 0.7 }, mound: { tint: "#4a3830", amount: 0.7 }, clod: { tint: "#4a3830", amount: 0.7 } },
  models: {
    arrow: (m) => { m.box([0.3, 0, 0], [2.2, 0.16, 0.16], P.fireHot); m.box([-1.1, 0, 0], [1.0, 0.1, 0.1], P.fire); m.box([1.5, 0, 0], [0.3, 0.26, 0.26], P.spark); },
    bolt: (m) => { m.cone([0.4, 0, 0], [1.9, 0, 0], 0.26, P.steel, { segs: 4 }); m.cylinder([-1.6, 0, 0], [0.5, 0, 0], 0.12, P.ironDk, 0.12, { segs: 5 }); for (const [x, s] of [[-1.0, 0.3], [-1.5, 0.2]]) m.box([x, 0, 0], [0.3, s, s], P.zap); },
    bomb: (m, f) => { m.with(() => { m.rotY(f * 90); m.cylinder([-0.3, 0, 0], [0.3, 0, 0], 0.16, P.rust, 0.16, { segs: 6 }); for (const x of [-0.3, 0.3]) m.cylinder([x - 0.04, 0, 0], [x + 0.04, 0, 0], 0.2, P.ironDk, 0.2, { segs: 6 }); m.sphere([0.42, 0, 0], 0.1, f % 2 ? P.fire : P.fireHot, { segs: 4 }); }); },
    keg: (m, f) => { m.with(() => { m.rotY(f * 20 - 10); m.cylinder([0, 0, -0.3], [0, 0, 0.3], 0.3, P.hazard, 0.3, { segs: 8 }); m.decal(0.02, () => { for (const z of [-0.18, 0.18]) m.cylinder([0, 0, z - 0.04], [0, 0, z + 0.04], 0.31, P.black, 0.31, { segs: 8 }); }); m.sphere([0, 0, 0.36], 0.1, f % 2 ? P.fire : P.fireHot, { segs: 4 }); }); },
    shell: (m) => { m.sphere([0, 0, 0], 0.3, P.char, { segs: 8 }); m.decal(0.03, () => m.sphere([0.1, 0, 0.05], 0.16, P.fire, { segs: 5 })); m.cone([-0.2, 0, 0.04], [-0.9, 0, 0.12], 0.16, P.fireRed, { segs: 5 }); },
    shard: (m) => { m.cone([-0.2, 0, 0], [0.9, 0, 0], 0.3, P.ice, { segs: 4 }); m.cone([-0.2, 0, 0], [-0.9, 0, 0], 0.3, P.frost, { segs: 4 }); },
    pellet: (m) => { m.sphere([0, 0, 0], 0.26, P.fireHot, { segs: 5 }); },
  },
};

// ------------------------------------------------------------------------------------------------ zone maps
export const MAPS: MapArt = {
  paint(p: Painter, map: MapInfo, st: Stamps) {
    const d = GROUNDS[map.index], id = map.id, U = 64;
    rough(p, d, 0, 0, map.w, map.h, U);
    const road = spline(map.path, 14);
    const full: Pt[] = [[map.camp[0], map.camp[1]], ...road, [map.boss[0], map.boss[1] + 40]];
    const blocked = (x: number, y: number, r: number) => near(full, x, y, r) || Math.hypot(x - map.camp[0], y - map.camp[1]) < 150 || Math.hypot(x - map.boss[0], y - map.boss[1]) < 210;
    // pools and veins wherever the road is not
    for (let i = 0, tries = 0; i < 8 && tries < 300; tries++) {
      const x = p.rand(40, map.w - 40), y = p.rand(120, map.h - 60), r = p.rand(40, 90);
      if (blocked(x, y, r * 1.5 + 50)) continue;
      blob(p, x, y, r, d.hot, d.hotGlow); i++;
    }
    for (let i = 0; i < 30; i++) { let x = p.rand(0, map.w), y = p.rand(0, map.h), a = p.rand(0, 7); const pts: Pt[] = [[x, y]]; for (let k = 0; k < 7; k++) { a += p.rand(-0.8, 0.8); x += Math.cos(a) * 22; y += Math.sin(a) * 22; pts.push([x, y]); } if (pts.some(([px, py]) => blocked(px, py, 50))) continue; p.line(pts, "#140806", 10, 0.8); p.line(pts, d.hot, 4); }
    // the road: a dark trench, plate, hazard dashes down both edges
    p.line(full, "#0e0806", 78); p.line(full, d.strip, 58); p.line(full, shade(d.strip, 0.12), 40);
    full.forEach(([x, y], i) => { if (i % 2 === 0) { p.rect(x - 34, y - 4, 10, 8, d.kerb); p.rect(x + 24, y - 4, 10, 8, d.kerb); } });
    for (const [c, r] of [[map.camp, 100], [map.boss, 132]] as [Pt, number][]) {
      p.round(c[0] - r - 10, c[1] - r * 0.7 - 10, r * 2 + 20, r * 1.4 + 20, 12, "#0e0806");
      p.slabs(c[0] - r, c[1] - r * 0.7, r * 2, r * 1.4, [d.plaza, shade(d.plaza, 0.1), shade(d.plaza, -0.1)], { sw: r / 2, sh: r * 0.35, joint: 3, jointColor: "#120c0a", rivets: shade(d.plaza, 0.35) });
    }
    // scenery wherever there is room, then the two strongholds
    const spots: { y: number; draw(): void }[] = [];
    for (let i = 0, tries = 0; i < 40 && tries < 1200; tries++) {
      const x = p.rand(20, map.w - 20), y = p.rand(120, map.h - 30);
      if (blocked(x, y, 88) || spots.some((s) => Math.abs(s.y - y) < 50)) continue;
      const v = Math.floor(p.r() * SCENE.length);
      spots.push({ y, draw: () => put(st, p, SCENE[v], x, y, { ppu: 70, yaw: v % 2 ? 72 : 108, el: 44, key: `${id}s${v}`, shadow: 0.7 }) });
      i++;
    }
    spots.push({ y: map.boss[1], draw: () => put(st, p, keepModel(true), map.boss[0], map.boss[1], { ppu: 84, yaw: 90, el: 52, team: "ember", shadow: 1.2 }) });
    spots.push({ y: map.camp[1], draw: () => put(st, p, keepModel(false), map.camp[0], map.camp[1], { ppu: 64, yaw: 90, el: 52, team: "tide", shadow: 1.2 }) });
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    p.wash(0, 0, map.w, map.h * 0.35, rgba(d.hotGlow, 0.3), rgba(d.hotGlow, 0), "lighter");
    crush(p.g, 0, 0, p.canvas.width, p.canvas.height, 4);
  },
};

// ------------------------------------------------------------------------------------------------ key art
export const UI: UiArt = {
  titleKey(p, st) {
    // The menu covers everything below about 60% of the height: the horizon is at 44%, the Maw (a horned skull of a
    // mountain with a furnace in its mouth) stands on it, and the 9th advance on it across cracked rock.
    const W = 1206, H = 2622, g = p.g, HZ = 1150;
    const sky = g.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, "#0a0403"); sky.addColorStop(0.4, "#3a1410"); sky.addColorStop(0.72, "#8a1c12"); sky.addColorStop(0.92, "#e03a10"); sky.addColorStop(1, "#ffb020");
    g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    // smoke bands
    for (let i = 0; i < 26; i++) { const y = p.rand(80, HZ - 160), x = p.rand(-100, W), w = p.rand(200, 620); p.g.globalAlpha = 0.35; p.round(x, y, w, p.rand(14, 46), 12, i % 3 ? "#1c0c08" : "#5a1c14"); p.g.globalAlpha = 1; }
    // far ranges
    const range = (base: number, col: string, amp: number, seed: number) => { let s = seed; const rr = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; const pts: Pt[] = [[-20, HZ + 40]]; for (let x = -20; x <= W + 60; x += 46) pts.push([x, base - amp * rr() - (Math.abs(x - W / 2) > 380 ? amp * 0.7 : 0)]); pts.push([W + 60, HZ + 40]); p.poly(pts, col); };
    range(HZ - 60, "#3a1410", 150, 5); range(HZ - 10, "#1c0c08", 110, 9);
    // the Maw: a skull mountain with horns, burning sockets and a furnace mouth
    const cx = W / 2, top = HZ - 560;
    p.poly([[cx - 330, HZ + 30], [cx - 300, HZ - 250], [cx - 210, top + 80], [cx - 90, top], [cx + 90, top], [cx + 210, top + 80], [cx + 300, HZ - 250], [cx + 330, HZ + 30]], "#120806");
    for (const s of [1, -1]) p.poly([[cx + s * 200, top + 110], [cx + s * 330, top - 60], [cx + s * 420, top - 250], [cx + s * 380, top - 20], [cx + s * 290, top + 190]], "#120806");
    for (const s of [1, -1]) { p.poly([[cx + s * 60, top + 210], [cx + s * 210, top + 190], [cx + s * 190, top + 330], [cx + s * 90, top + 350]], "#e03a10"); p.glow(cx + s * 135, top + 270, 150, "#ff7a1c", 0.6); p.poly([[cx + s * 95, top + 240], [cx + s * 180, top + 230], [cx + s * 165, top + 310], [cx + s * 110, top + 320]], "#ffe070"); }
    p.poly([[cx - 30, top + 370], [cx, top + 330], [cx + 30, top + 370], [cx, top + 440]], "#5a1c14");
    p.poly([[cx - 200, HZ - 110], [cx + 200, HZ - 110], [cx + 170, HZ + 30], [cx - 170, HZ + 30]], "#ff7a1c");
    p.glow(cx, HZ - 40, 330, "#ffb020", 0.7);
    for (let i = -4; i <= 4; i++) { p.poly([[cx + i * 44 - 20, HZ - 112], [cx + i * 44 + 20, HZ - 112], [cx + i * 44, HZ - 40]], "#120806"); p.poly([[cx + i * 44 + 2, HZ + 32], [cx + i * 44 + 42, HZ + 32], [cx + i * 44 + 22, HZ - 30]], "#120806"); }
    // the ground: scorched rock, lava running out of the mouth towards the viewer
    rough(p, GROUNDS[0], 0, HZ, W, H - HZ, 150, "#4a3026");
    p.poly([[cx - 150, HZ + 20], [cx + 150, HZ + 20], [cx + 70, HZ + 260], [cx + 240, H], [cx - 260, H], [cx - 60, HZ + 260]], "#140806");
    p.poly([[cx - 120, HZ + 20], [cx + 120, HZ + 20], [cx + 40, HZ + 260], [cx + 190, H], [cx - 210, H], [cx - 30, HZ + 260]], "#ff7a1c");
    p.poly([[cx - 60, HZ + 20], [cx + 60, HZ + 20], [cx + 10, HZ + 260], [cx + 90, H], [cx - 110, H], [cx - 4, HZ + 260]], "#ffb020");
    p.glow(cx, HZ + 200, 520, "#e03a10", 0.4, "lighter", 260);
    for (let i = 0; i < 26; i++) { let x = p.rand(0, W), y = p.rand(HZ + 60, HZ + 900), a = p.rand(0, 7); const pts: Pt[] = [[x, y]]; for (let k = 0; k < 7; k++) { a += p.rand(-0.8, 0.8); x += Math.cos(a) * 44; y += Math.sin(a) * 20; pts.push([x, y]); } p.line(pts, "#140806", 16, 0.8); p.line(pts, "#ff7a1c", 6); }
    p.wash(0, HZ, W, 260, "rgba(20,6,4,0.75)", "rgba(20,6,4,0)");
    // dressing down both sides, then the 9th
    const side: [Build, number, number, number][] = [[SCENE[2], 80, HZ + 110, 170], [SCENE[4], 230, HZ + 60, 190], [SCENE[3], 1100, HZ + 90, 200], [SCENE[0], 980, HZ + 70, 170], [SCENE[4], 1150, HZ + 250, 250], [SCENE[1], 60, HZ + 300, 230]];
    side.sort((a, b) => a[2] - b[2]).forEach(([b, x, y, ppu]) => put(st, p, b, x, y, { ppu, yaw: x < 600 ? 70 : 110, el: 24, shadow: 0.8 }));
    const cast: [string, number, number, number, number, number][] = [["golem", 3, 150, HZ + 250, 150, 70], ["bulwark", 3, 370, HZ + 300, 200, 76], ["ranger", 3, 840, HZ + 300, 200, 104], ["lancer", 3, 1050, HZ + 260, 170, 112], ["lion", 4, 603, HZ + 360, 250, 90]];
    for (const [kind, tier, x, y, ppu, yaw] of cast) putUnit(st, p, kind, tier, x, y, { ppu, yaw, el: 24, shadow: 0.5 });
    putUnit(st, p, "harrier", 3, 230, HZ - 500, { ppu: 250, yaw: 40, el: 20, anim: "walk", frame: 1, team: "ember" });
    putUnit(st, p, "griffin", 3, 960, HZ - 640, { ppu: 200, yaw: 140, el: 20, anim: "walk", frame: 2, team: "ember" });
    // the menu covers the bottom: fade to the page colour
    const fade = g.createLinearGradient(0, HZ + 640, 0, HZ + 1100);
    fade.addColorStop(0, "rgba(18,10,8,0)"); fade.addColorStop(1, "rgba(18,10,8,1)");
    g.fillStyle = fade; g.fillRect(0, HZ + 640, W, H - HZ - 640);
    crush(g, 0, 0, W, H, 6);
  },
};

// ------------------------------------------------------------------------------------------------ holdout
export const TDART: TdArt = {
  paint(p, map, st) {
    const M = 3.5, d = GROUNDS[(map.act - 1) % GROUNDS.length];
    rough(p, d, -M, -M, map.w + 2 * M, map.h + 2 * M, 1, d.field);
    const roads = map.paths.map((r) => r.pts.map((q) => [q.x, q.y] as Pt));
    for (const r of roads) p.line(r, "#0e0806", ROAD_HALF * 2 + 0.3);
    for (const r of roads) p.line(r, d.strip, ROAD_HALF * 2 - 0.06);
    for (const r of roads) p.line(r, shade(d.strip, 0.12), ROAD_HALF * 1.3);
    const pts = roads.flat();
    for (const [q, rr] of [[map.keep, 2.0], ...map.gates.map((gq) => [gq, 1.3] as [typeof gq, number])] as [{ x: number; y: number }, number][]) {
      p.rect(q.x - rr - 0.12, q.y - rr - 0.12, rr * 2 + 0.24, rr * 2 + 0.24, "#0e0806");
      p.slabs(q.x - rr, q.y - rr, rr * 2, rr * 2, [d.plaza, shade(d.plaza, 0.1), shade(d.plaza, -0.1)], { sw: rr / 2, sh: rr / 2, joint: 0.05, jointColor: "#120c0a", rivets: shade(d.plaza, 0.35), bond: 0 });
    }
    // build pads: a hazard-framed plate
    for (const pad of map.pads) { p.rect(pad.x - 0.6, pad.y - 0.6, 1.2, 1.2, "#0e0806"); p.rect(pad.x - 0.54, pad.y - 0.54, 1.08, 1.08, d.kerb); p.rect(pad.x - 0.44, pad.y - 0.44, 0.88, 0.88, shade(d.plaza, -0.15)); for (const [ox, oy] of [[-0.34, -0.34], [0.34, -0.34], [-0.34, 0.34], [0.34, 0.34]]) p.circle(pad.x + ox, pad.y + oy, 0.05, shade(d.plaza, 0.4)); }
    const free = (x: number, y: number, rad: number) => !near(pts, x, y, ROAD_HALF + rad + 0.3) && !map.pads.some((q) => Math.hypot(q.x - x, q.y - y) < 0.95 + rad) && Math.hypot(map.keep.x - x, map.keep.y - y) > 2.6 + rad && !map.gates.some((q) => Math.hypot(q.x - x, q.y - y) < 1.9 + rad);
    for (let i = 0, tries = 0; i < 7 && tries < 200; tries++) { const x = p.rand(-M, map.w + M), y = p.rand(-M, map.h + M), r = p.rand(0.5, 1.1); if (!free(x, y, r * 1.5)) continue; blob(p, x, y, r, d.hot, d.hotGlow); i++; }
    const spots: { y: number; draw(): void }[] = [];
    for (let y = -M + 0.6; y < map.h + M; y += 1.75) for (let x = -M + 0.8 + (Math.round(y / 1.75) % 2) * 0.9; x < map.w + M; x += 2.05) {
      const px = x + p.rand(-0.25, 0.25), py = y + p.rand(-0.2, 0.2);
      if (!free(px, py, 0.8) || p.r() < 0.5) continue;
      const v = Math.floor(p.r() * SCENE.length);
      spots.push({ y: py, draw: () => put(st, p, SCENE[v], px, py, { ppu: 60, yaw: v % 2 ? 74 : 106, el: 53.13, key: `td${map.act}s${v}`, shadow: 0.7 }) });
    }
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    crush(p.g, 0, 0, p.canvas.width, p.canvas.height, 3);
  },
};
