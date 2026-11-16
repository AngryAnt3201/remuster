// Brasswick's flat pictures: effect sheets, the ten district maps, the home key art and the Bastion backdrops.
import { ROAD_HALF } from "@engine/core/td/maps";
import type { MapArt, MapInfo, Stamps, TdArt, UiArt } from "../../../artkit/flat";
import { Painter, rgba, shade, spline, type Pt } from "../../../artkit/paint";
import type { VfxArt } from "../../../artkit/vfx";
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { KEEPS } from "./keeps";
import { P, boiler, dial } from "./parts";
import { S, airship, clockTower, crane, furnace, gasometer, heap, house, lampPost, smokestack, tank, tree, wagon, bigGear } from "./scenery";

// ------------------------------------------------------------------------------------------------ effects
const TRACER = mat("#fff3c4", { emit: 1, ink: false, alpha: 0.9 });
export const VFX: VfxArt = {
  grade: {
    // earth thrown up by tunnellers and shells is cobble grit and soot here, not soil
    dirt: { saturation: 0.3, brightness: 0.85, tint: "#7a7078", amount: 0.45 }, mound: { saturation: 0.3, brightness: 0.85, tint: "#7a7078", amount: 0.45 },
    divot: { saturation: 0.3, brightness: 0.8, tint: "#5a5258", amount: 0.5 }, crack: { saturation: 0.4, brightness: 0.9 },
    goo: { tint: "#7fb89a", amount: 0.55 }, frost: { tint: "#cfeeff", amount: 0.25 },
  },
  models: {
    // a rifle slug with a hot tracer
    arrow: (m) => { m.cone([-1.7, 0, 0], [0.2, 0, 0], 0.13, TRACER, { segs: 6 }); m.group(() => { m.cylinder([0.2, 0, 0], [1.2, 0, 0], 0.2, P.brass, 0.2, { segs: 8 }); m.cone([1.2, 0, 0], [1.75, 0, 0], 0.2, P.steel, { segs: 8 }); }); },
    // a barbed harpoon
    bolt: (m) => { m.cylinder([-1.7, 0, 0], [0.9, 0, 0], 0.09, P.ironDk, 0.09, { segs: 6 }); m.cone([0.8, 0, 0], [1.8, 0, 0], 0.22, P.steel, { segs: 6 }); m.extrude([[0.5, 0], [0.95, 0.3], [1.1, 0.0], [0.95, -0.3]], 0.05, P.steel); m.cylinder([-0.2, 0, 0], [0.0, 0, 0], 0.15, P.brass, 0.15, { segs: 8 }); m.torus([-1.6, 0, 0], [0, 1, 0], 0.16, 0.05, P.brass, { segs: 8 }); },
    // a round iron grenade, fuse spitting
    bomb: (m, f) => { m.sphere([0, 0, 0], 0.3, P.ironDk); m.torus([0, 0, 0], [1, 0, 0.3], 0.3, 0.035, P.brass, { segs: 12 }); m.cylinder([0.12, 0, 0.26], [0.18, 0, 0.38], 0.06, P.brass, 0.05, { segs: 6 }); m.sphere([0.2 + 0.03 * (f % 2), 0, 0.42 + 0.02 * (f % 2)], 0.07 + 0.03 * ((f + 1) % 2), P.fire, { segs: 6 }); m.decal(0.05, () => m.sphere([0.2, 0, 0.42], 0.04, P.fireHot, { segs: 5 })); },
    // the Kegrunner's boiler bomb
    keg: (m, f) => { m.with(() => { m.rotY(8); m.group(() => { m.cylinder([0, 0, -0.26], [0, 0, 0.22], 0.24, P.copper); m.ellipsoid([0, 0, 0.22], [0.24, 0.24, 0.1], P.copper); }); for (const z of [-0.16, 0.1]) m.cylinder([0, 0, z - 0.03], [0, 0, z + 0.03], 0.255, P.brass, 0.255); m.with(() => { m.move(0.24, 0, -0.03); dial(m, 0.09, f * 80); }); m.sphere([0.03, 0, 0.4], 0.06 + 0.025 * (f % 2), P.fire, { segs: 6 }); }); },
    // a mortar shell
    shell: (m) => { m.group(() => { m.cylinder([-0.3, 0, 0], [0.12, 0, 0], 0.2, P.ironDk, 0.2, { segs: 10 }); m.ellipsoid([0.12, 0, 0], [0.26, 0.2, 0.2], P.brass, { segs: 10 }); }); m.cylinder([-0.16, 0, 0], [-0.08, 0, 0], 0.215, P.brass, 0.215, { segs: 10 }); m.cone([-0.3, 0, 0], [-0.44, 0, 0], 0.16, P.fire, { segs: 6 }); },
  },
};

// ------------------------------------------------------------------------------------------------ shared: districts
interface Theme { ground: string[]; road: string[]; kerb: string; haze: string; glow: string; walls: Material[]; roofs: Material[]; landmark(m: Model): void; extra(m: Model): void; extras: number; }
const brickWalls = [S.brick, S.brickDk, S.brickLt], slates = [S.slate, S.slateDk, S.tile];
const THEMES: Theme[] = [
  { ground: ["#7d6f66", "#74675e"], road: ["#b3a394", "#a8998a"], kerb: "#d8c8a8", haze: "#6d6470", glow: "#ffcf7a", walls: brickWalls, roofs: slates, landmark: (m) => smokestack(m, 5, 0.4), extra: (m) => tree(m, 1.4), extras: 6 },
  { ground: ["#5a5a62", "#52525a"], road: ["#8b7f78", "#827670"], kerb: "#d0903e", haze: "#7a4a3a", glow: "#ff9a4d", walls: [S.brickDk, S.brick], roofs: [S.slateDk, S.brickDk], landmark: (m) => furnace(m, 1.6), extra: (m) => smokestack(m, 4.5, 0.36, true, S.brickDk), extras: 9 },
  { ground: ["#a79b8a", "#9d9180"], road: ["#d2c09c", "#c8b692"], kerb: "#e6d5a6", haze: "#8b8494", glow: "#ffe2a8", walls: [S.stone, S.stoneLt, S.brickLt], roofs: [S.slate, S.verdigris], landmark: (m) => clockTower(m, 6, 1.6), extra: (m) => tree(m, 1.6), extras: 10 },
  { ground: ["#7c7163", "#73685b"], road: ["#a39684", "#998c7b"], kerb: "#c9b48a", haze: "#77706a", glow: "#ffcf7a", walls: brickWalls, roofs: [S.slateDk], landmark: (m) => tank(m, 1.0, 2.2, S.plank), extra: (m) => wagon(m, S.brick, S.coal), extras: 12 },
  { ground: ["#5f6c68", "#566360"], road: ["#98a39a", "#8e9990"], kerb: "#9fd0b2", haze: "#4f6b62", glow: "#b6ffb0", walls: [S.brickDk, S.stoneDk], roofs: [S.slateDk, S.verdigris], landmark: (m) => gasometer(m, 1.7, 2.3), extra: (m) => gasometer(m, 1.1, 1.6), extras: 6 },
  { ground: ["#dfe7ef", "#d1dbe6"], road: ["#a9b3bf", "#9ea8b5"], kerb: "#8fa3b8", haze: "#dfe8f1", glow: "#ffe2a8", walls: brickWalls, roofs: [S.snow], landmark: (m) => crane(m, 2.8, 2.2), extra: (m) => heap(m, 0.8, 0.45, S.snow), extras: 8 },
  { ground: ["#b9d6ec", "#a9cbe6"], road: ["#c9a877", "#be9d6d"], kerb: "#d9b25e", haze: "#d6e8f7", glow: "#fff0c0", walls: [S.plank, S.plankDk], roofs: [S.canvas, S.tile], landmark: (m) => airship(m, 5, 0.6), extra: (m) => airship(m, 2.6, 0.4, S.canvas, P.red), extras: 5 },
  { ground: ["#45645e", "#3d5a55"], road: ["#9a8767", "#8f7c5d"], kerb: "#6b5a44", haze: "#3f5a52", glow: "#d8ffa0", walls: [S.plank, S.plankDk, S.brickDk], roofs: [S.plankDk, S.slateDk], landmark: (m) => tank(m, 0.9, 1.8, S.verdigris), extra: (m) => tree(m, 1.5, S.foliageDk), extras: 8 },
  { ground: ["#5b7b8a", "#52717f"], road: ["#b7b4a8", "#adaa9e"], kerb: "#d0c7ae", haze: "#8fa6b3", glow: "#ffe2a8", walls: [S.brick, S.stone], roofs: slates, landmark: (m) => crane(m, 3.2, 2.6), extra: (m) => crane(m, 2.2, 1.8), extras: 5 },
  { ground: ["#8f7f8e", "#857687"], road: ["#b9434a", "#a8323a"], kerb: "#e6b84a", haze: "#6a4a72", glow: "#ffd98a", walls: [S.marble, S.stoneLt], roofs: [S.slate, S.verdigris], landmark: (m) => clockTower(m, 7, 2), extra: (m) => bigGear(m, 1.3, P.brass, 10), extras: 7 },
];
const near = (pts: Pt[], x: number, y: number, d: number) => pts.some(([px, py]) => Math.hypot(px - x, py - y) < d);
function ribbonPts(path: Pt[], w: number): Pt[] {
  const a: Pt[] = [], b: Pt[] = [];
  path.forEach(([x, y], i) => { const [px, py] = path[Math.max(0, i - 1)], [qx, qy] = path[Math.min(path.length - 1, i + 1)], d = Math.hypot(qx - px, qy - py) || 1; a.push([x - ((qy - py) / d) * w / 2, y + ((qx - px) / d) * w / 2]); b.push([x + ((qy - py) / d) * w / 2, y - ((qx - px) / d) * w / 2]); });
  return [...a, ...b.reverse()];
}
const keepModel = (boss: boolean) => (m: Model) => KEEPS.build(m, { damage: 0, state: "intact", boss, skin: null });

// ------------------------------------------------------------------------------------------------ campaign maps
export const MAPS: MapArt = {
  paint(p: Painter, map: MapInfo, st: Stamps) {
    const th = THEMES[map.index], r = () => p.rand(), id = map.id;
    // the district's ground: streets between the blocks
    p.fill(th.ground[0]);
    p.cobbles(0, 0, map.w, map.h, th.ground, { size: 22, gap: shade(th.ground[0], -0.3), edge: 1.2 });
    p.rect(0, 0, map.w, map.h, rgba("#1a1018", 0.22));
    p.mottle(0, 0, map.w, map.h, "#fff0d0", { n: 40, alpha: 0.07, size: [50, 150] });
    // the road from the camp to the boss, with the tramway on it
    const road = spline(map.path, 14);
    const full: Pt[] = [[map.camp[0], map.camp[1]], ...road, [map.boss[0], map.boss[1] + 40]];
    p.line(full, shade(th.kerb, -0.45), 74); p.line(full, th.kerb, 62);
    p.clip((g) => ribbonPts(full, 52).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))), () => p.slabs(0, 0, map.w, map.h, th.road, { sw: 26, sh: 15, joint: 1.6 }));
    p.rails(full, 20, { rail: "#c9d0d8", sleeper: shade(th.road[0], -0.4) });
    for (let i = 6; i < full.length; i += 9) { const [x, y] = full[i]; p.glow(x, y, 90, th.glow, 0.16, "lighter"); }
    // plazas at each end
    for (const [x, y, rr] of [[map.camp[0], map.camp[1], 86], [map.boss[0], map.boss[1], 112]]) { p.glow(x, y + 8, rr * 1.5, "#140c14", 0.4, "source-over", rr * 1.2); p.cog(x, y, rr, 18, "#c79a4a", { tooth: 0.1, ink: 3 }); p.circle(x, y, rr * 0.82, shade(th.road[0], -0.1), 2.5); }
    // blocks of rooftops wherever there is room
    const spots: { x: number; y: number; draw(): void }[] = [];
    const variants = 7;
    const blocked = (x: number, y: number, d: number) => near(full, x, y, d) || Math.hypot(x - map.camp[0], y - map.camp[1]) < 150 || Math.hypot(x - map.boss[0], y - map.boss[1]) < 200;
    for (let gy = -20; gy < map.h + 60; gy += 92) for (let gx = -30 + ((gy / 92) % 2) * 50; gx < map.w + 60; gx += 108) {
      const x = gx + p.rand(-14, 14), y = gy + p.rand(-12, 12);
      if (blocked(x, y, 92)) continue;
      const v = Math.floor(r() * variants), lit = 0.45 + 0.1 * (v % 3);
      spots.push({ x, y, draw: () => st.model(p, (m) => house(m, { w: 1.5 + (v % 3) * 0.35, d: 1.5, h: 1.0 + (v % 4) * 0.28, wall: th.walls[v % th.walls.length], roof: th.roofs[v % th.roofs.length], lit, chimneys: 1 + (v % 2), seed: v }), x, y, { ppu: 46, yaw: v % 2 ? 62 : 118, el: 52, key: `${id}h${v}`, shadow: 1.1 }) });
    }
    // the district's own sights: a few extras, and its landmark behind the boss
    for (let i = 0, tries = 0; i < th.extras && tries < 200; tries++) {
      const x = p.rand(60, map.w - 60), y = p.rand(240, map.h - 240);
      if (blocked(x, y, 120) || !near(full, x, y, 250)) continue;
      i++;
      spots.push({ x, y: y + 30, draw: () => st.model(p, th.extra, x, y, { ppu: 44, yaw: 70, el: 52, key: `${id}x`, shadow: 0.8 }) });
    }
    const lx = map.boss[0] + (map.boss[0] > map.w / 2 ? -250 : 250);
    spots.push({ x: lx, y: map.boss[1] - 40, draw: () => st.model(p, th.landmark, lx, map.boss[1] - 60, { ppu: 60, yaw: 70, el: 50, shadow: 1.2 }) });
    spots.push({ x: map.boss[0], y: map.boss[1], draw: () => st.model(p, keepModel(true), map.boss[0], map.boss[1], { ppu: 82, yaw: 90, el: 52, team: "ember" }) });
    spots.push({ x: map.camp[0], y: map.camp[1], draw: () => st.model(p, keepModel(false), map.camp[0], map.camp[1], { ppu: 62, yaw: 90, el: 52, team: "tide" }) });
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    // smog over the far end, a vignette
    p.wash(0, 0, map.w, map.h * 0.3, rgba(th.haze, 0.7), rgba(th.haze, 0));
    const g = p.g, vg = g.createRadialGradient(map.w / 2, map.h * 0.5, map.h * 0.3, map.w / 2, map.h * 0.5, map.h * 0.72);
    vg.addColorStop(0, "rgba(20,10,24,0)"); vg.addColorStop(1, "rgba(20,10,24,0.5)");
    g.fillStyle = vg; g.fillRect(0, 0, map.w, map.h);
  },
};

// ------------------------------------------------------------------------------------------------ key art
export const UI: UiArt = {
  titleKey(p, st) {
    // The home screen shows the whole picture; its buttons cover everything below about 60% of the height, so the
    // company stands on a horizon at 44% and the sky above carries the fleet.
    const W = 1206, H = 2622, g = p.g, HZ = 1150;
    const sky = g.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, "#231a3a"); sky.addColorStop(0.45, "#6a3f5c"); sky.addColorStop(0.8, "#d9834f"); sky.addColorStop(1, "#f6c36e");
    g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    p.glow(640, HZ - 330, 480, "#ffe2a0", 0.55, "lighter");
    p.circle(640, HZ - 330, 130, "#fff0c4", 0);
    for (let i = 0; i < 9; i++) { const x = p.rand(0, W), y = p.rand(120, 700), w = p.rand(160, 380); p.g.save(); p.g.globalAlpha = 0.16; p.round(x - w / 2, y, w, p.rand(22, 44), 20, "#f7c7a0"); p.g.restore(); }
    // three layers of skyline, nearer and darker
    const layer = (base: number, col: string, hmin: number, hmax: number, win: number, seed: number) => {
      let x = -40;
      const rr = (a: number, b: number) => a + (b - a) * (Math.abs(Math.sin((seed += 1.7) * 99.13)) % 1);
      while (x < W + 40) {
        const w = rr(60, 150), h = rr(hmin, hmax), kind = rr(0, 1);
        p.rect(x, base - h, w, h + 40, col);
        if (kind < 0.35) p.poly([[x - 6, base - h], [x + w / 2, base - h - w * 0.45], [x + w + 6, base - h]], col);
        else if (kind < 0.55) { p.rect(x + w * 0.4, base - h - rr(80, 220), w * 0.2, 240, col); }
        g.fillStyle = rgba("#ffd98a", win);
        for (let wy = base - h + 16; wy < base - 20; wy += 34) for (let wx = x + 12; wx < x + w - 16; wx += 26) if (rr(0, 1) < 0.55) g.fillRect(wx, wy, 10, 16);
        x += w + rr(-6, 14);
      }
    };
    layer(HZ - 130, "#7a4a62", 70, 230, 0.35, 1); layer(HZ - 70, "#55354f", 100, 290, 0.55, 5); layer(HZ + 10, "#38243c", 110, 260, 0.8, 9);
    // the fleet and the clock
    st.model(p, (m) => airship(m, 6, 0), 330, 470, { ppu: 112, yaw: 28, el: 8, team: "tide" });
    st.model(p, (m) => airship(m, 4, 0, S.canvas, P.red), 930, 250, { ppu: 60, yaw: 150, el: 8, team: "ember" });
    st.model(p, (m) => clockTower(m, 7, 1.8), 1030, HZ + 30, { ppu: 122, yaw: 62, el: 14 });
    for (const [x, hh] of [[100, 5.5], [235, 4.2]]) st.model(p, (m) => smokestack(m, hh, 0.4), x, HZ + 30, { ppu: 104, yaw: 60, el: 12 });
    // the square, the keep and the company
    p.clip((gg) => gg.rect(0, HZ, W, H - HZ), () => p.cobbles(0, HZ, W, H - HZ, ["#7d6f66", "#74675e", "#867870"], { size: 46, gap: "#3a3034", edge: 3 }));
    p.wash(0, HZ, W, 420, "rgba(246,170,90,0.42)", "rgba(246,170,90,0)");
    p.wash(0, HZ + 500, W, H - HZ - 500, "rgba(24,12,26,0)", "rgba(24,12,26,0.85)");
    p.glow(603, HZ + 190, 520, "#ffcf7a", 0.3, "lighter", 220);
    st.model(p, keepModel(false), 603, HZ + 150, { ppu: 205, yaw: 90, el: 30, team: "tide", shadow: 1.3 });
    const cast: [string, number, number, number, number, number][] = [["golem", 3, 150, HZ + 300, 250, 62], ["storm", 3, 1060, HZ + 330, 270, 118], ["bulwark", 3, 330, HZ + 420, 300, 66], ["ranger", 3, 880, HZ + 440, 300, 112], ["lion", 4, 610, HZ + 520, 350, 80]];
    for (const [kind, tier, x, y, ppu, yaw] of cast) st.unit(p, kind, tier, x, y, { ppu, yaw, el: 24, shadow: 0.36 });
    st.unit(p, "harrier", 3, 215, HZ - 190, { ppu: 250, yaw: 40, el: 20, anim: "walk", frame: 1 });
    st.unit(p, "griffin", 3, 800, HZ - 420, { ppu: 220, yaw: 140, el: 20, anim: "walk", frame: 2 });
    for (const x of [60, 1150]) { st.model(p, (m) => lampPost(m, 2.2, 0.5), x, HZ + 330, { ppu: 150, yaw: x < 600 ? 0 : 180, el: 18 }); p.glow(x + (x < 600 ? 70 : -70), HZ - 10, 210, "#ffd98a", 0.4, "lighter"); }
    const vg = g.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.66);
    vg.addColorStop(0, "rgba(20,10,24,0)"); vg.addColorStop(1, "rgba(20,10,24,0.55)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  },
};

// ------------------------------------------------------------------------------------------------ bastion
export const TDART: TdArt = {
  paint(p, map, st) {
    const M = 3.5, th = THEMES[(map.act - 1) % THEMES.length];
    p.cobbles(-M, -M, map.w + 2 * M, map.h + 2 * M, ["#7d6f66", "#74675e", "#867870", "#796b62"], { size: 0.34, gap: "#3d3336" });
    p.mottle(-M, -M, map.w + 2 * M, map.h + 2 * M, "#1a1016", { n: 160, alpha: 0.1, size: [0.6, 2] });
    p.mottle(-M, -M, map.w + 2 * M, map.h + 2 * M, "#fff3d6", { n: 120, alpha: 0.06, size: [0.6, 2] });
    // the roads: kerbed flagstones with the tramway down the middle
    const roads = map.paths.map((r) => r.pts.map((q) => [q.x, q.y] as Pt));
    for (const r of roads) p.line(r, "#3a2f30", ROAD_HALF * 2 + 0.24);
    for (const r of roads) p.line(r, th.kerb, ROAD_HALF * 2 + 0.1);
    for (const r of roads) p.clip((g) => ribbonPts(r, ROAD_HALF * 2 - 0.06).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))), () => p.slabs(-M, -M, map.w + 2 * M, map.h + 2 * M, ["#b8a892", "#ad9d88", "#c2b29b"], { sw: 0.5, sh: 0.3, joint: 0.035 }));
    for (const r of roads) p.rails(r.filter((_, i) => i % 2 === 0), 0.36, { rail: "#c9d0d8", sleeper: "#6e5a48" });
    // keep and gate plazas
    for (const [q, rr] of [[map.keep, 2.0], ...map.gates.map((gq) => [gq, 1.3] as [typeof gq, number])] as [{ x: number; y: number }, number][]) { p.cog(q.x, q.y, rr, 18, "#c79a4a", { tooth: 0.1, ink: 0.06 }); p.circle(q.x, q.y, rr * 0.84, "#a8998a", 0.05); }
    // build pads: a brass-rimmed plinth
    for (const pad of map.pads) { p.glow(pad.x, pad.y + 0.08, 0.95, "#140c14", 0.4, "source-over"); p.cog(pad.x, pad.y, 0.6, 10, "#b98b45", { tooth: 0.12, ink: 0.045 }); p.circle(pad.x, pad.y, 0.47, "#d6cab6", 0.04); p.circle(pad.x, pad.y, 0.3, "#c2b6a2", 0.025); }
    // the city around: rooftops, stacks and lamps wherever there is room
    const pts = roads.flat();
    const free = (x: number, y: number, rad: number) => !near(pts, x, y, ROAD_HALF + rad + 0.3) && !map.pads.some((q) => Math.hypot(q.x - x, q.y - y) < 0.95 + rad) && Math.hypot(map.keep.x - x, map.keep.y - y) > 2.4 + rad && !map.gates.some((q) => Math.hypot(q.x - x, q.y - y) < 1.8 + rad);
    const spots: { y: number; draw(): void }[] = [];
    for (let y = -M + 0.6; y < map.h + M; y += 1.75) for (let x = -M + 0.8 + (Math.round(y / 1.75) % 2) * 0.9; x < map.w + M; x += 2.05) {
      const px = x + p.rand(-0.25, 0.25), py = y + p.rand(-0.2, 0.2);
      if (!free(px, py, 1.05)) { if (free(px, py, 0.25) && p.r() < 0.35) { p.glow(px, py, 1.3, th.glow, 0.22, "lighter"); spots.push({ y: py, draw: () => st.model(p, (m) => lampPost(m, 1.4, 0), px, py, { ppu: 72, el: 53.13, key: "tdlamp", shadow: 0.15 }) }); } continue; }
      const v = Math.floor(p.r() * 8);
      if (v === 7) spots.push({ y: py, draw: () => st.model(p, (m) => smokestack(m, 3.2, 0.34), px, py, { ppu: 72, el: 53.13, key: "tdstack", shadow: 0.5 }) });
      else spots.push({ y: py, draw: () => st.model(p, (m) => house(m, { w: 1.5 + (v % 3) * 0.2, d: 1.4, h: 0.9 + (v % 4) * 0.25, wall: brickWalls[v % 3], roof: slates[v % 3], lit: 0.5, chimneys: 1 + (v % 2), seed: v }), px, py, { ppu: 72, yaw: v % 2 ? 60 : 120, el: 53.13, key: `tdh${v}`, shadow: 1.0 }) });
    }
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    void boiler;
  },
};
