// Neonhold's flat pictures: effect sheets, the ten district maps, the home key art and the Firewall backdrops.
import { ROAD_HALF } from "@engine/core/td/maps";
import type { MapArt, MapInfo, Stamps, TdArt, UiArt } from "../../../artkit/flat";
import { Painter, mixHex, rgba, shade, spline, type Pt } from "../../../artkit/paint";
import type { VfxArt } from "../../../artkit/vfx";
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { neonLine } from "./arenas";
import { KEEPS } from "./keeps";
import { P } from "./parts";
import { S, SIGNS, WINS, billboard, container, crane, lampPost, rack, tank, tower, tree, vending } from "./scenery";

// ------------------------------------------------------------------------------------------------ effects
const TRACER = mat("#ff9af0", { emit: 1, ink: false, alpha: 0.9 });
const CORE = mat("#ffffff", { emit: 1, ink: false });
export const VFX: VfxArt = {
  grade: {
    // nothing here burns orange (that is the rival's colour): fire is plasma, earth is wet grit, slime is coolant
    fireball: { tint: "#ff5ce6", amount: 0.7 }, flame: { tint: "#ff5ce6", amount: 0.7 }, scorch: { saturation: 0.2, brightness: 0.5, tint: "#3a2a6a", amount: 0.6 },
    dirt: { saturation: 0.2, brightness: 0.6, tint: "#5a5aa0", amount: 0.6 }, mound: { saturation: 0.2, brightness: 0.6, tint: "#5a5aa0", amount: 0.6 },
    divot: { saturation: 0.2, brightness: 0.5, tint: "#3a3a70", amount: 0.6 }, crack: { saturation: 0.2, brightness: 0.6, tint: "#8a70ff", amount: 0.5 },
    goo: { tint: "#9dff4a", amount: 0.6 }, frost: { tint: "#e6f3ff", amount: 0.3 }, ice: { tint: "#d6ecff", amount: 0.3 }, icebreak: { tint: "#d6ecff", amount: 0.3 },
    heal: { tint: "#5dffa0", amount: 0.5 }, gear: { saturation: 0.3, tint: "#b9a0ff", amount: 0.6 }, shadow: { tint: "#05041a", amount: 0.8 },
  },
  models: {
    // a rail slug with a plasma tracer
    arrow: (m) => { m.cone([-1.8, 0, 0], [0.3, 0, 0], 0.16, TRACER, { segs: 6 }); m.cone([0.2, 0, 0], [1.75, 0, 0], 0.2, CORE, { segs: 6 }); },
    // the Railgun's slug: a long bar of light
    bolt: (m) => { m.cone([-1.9, 0, 0], [0.6, 0, 0], 0.2, P.arc, { segs: 6 }); m.cylinder([0.2, 0, 0], [1.4, 0, 0], 0.13, CORE, 0.13, { segs: 6 }); m.cone([1.4, 0, 0], [1.85, 0, 0], 0.13, CORE, { segs: 6 }); },
    // the Lobber's canister
    bomb: (m, f) => { m.sphere([0, 0, 0], 0.28, P.laser, { segs: 10 }); m.torus([0, 0, 0], [1, 0, 0.3], 0.28, 0.04, P.armorDk, { segs: 12 }); m.cylinder([0, 0, 0.24], [0, 0, 0.38], 0.1, P.chrome, 0.1, { segs: 6 }); m.sphere([0, 0, 0.42], 0.06 + 0.03 * (f % 2), P.red, { segs: 6 }); },
    // the Meltdown's cell
    keg: (m, f) => { m.with(() => { m.rotY(8); m.cylinder([0, 0, -0.28], [0, 0, 0.24], 0.24, P.armorDk, 0.24, { segs: 10 }); for (const z of [-0.2, 0.16]) m.cylinder([0, 0, z - 0.03], [0, 0, z + 0.03], 0.255, P.laser, 0.255, { segs: 10 }); m.decal(0.02, () => m.cylinder([0, 0, -0.1], [0, 0, 0.08], 0.25, f % 2 ? P.red : P.magenta, 0.25, { segs: 10 })); m.sphere([0, 0, 0.34], 0.1, P.red, { segs: 6 }); }); },
    // the Thumper's shell
    shell: (m) => { m.group(() => { m.cylinder([-0.3, 0, 0], [0.12, 0, 0], 0.2, P.armorDk, 0.2, { segs: 10 }); m.ellipsoid([0.12, 0, 0], [0.26, 0.2, 0.2], P.laser, { segs: 10 }); }); m.cylinder([-0.16, 0, 0], [-0.08, 0, 0], 0.215, P.magenta, 0.215, { segs: 10 }); m.cone([-0.3, 0, 0], [-0.46, 0, 0], 0.16, P.plasma, { segs: 6 }); },
    shard: (m) => { m.cone([-0.9, 0, 0], [0.9, 0, 0], 0.2, P.frost, { segs: 4 }); },
    pellet: (m) => { m.sphere([0, 0, 0], 0.3, P.plasma, { segs: 6 }); m.sphere([0, 0, 0], 0.16, CORE, { segs: 6 }); },
  },
};

// ------------------------------------------------------------------------------------------------ shared: districts
interface Theme { ground: string; road: string; glow: string; glow2: string; haze: string; walls: Material[]; signs: Material[]; extra(m: Model): void; landmark(m: Model): void }
const T = (ground: string, glow: string, glow2: string, haze: string, walls: Material[], signs: Material[], extra: (m: Model) => void, landmark: (m: Model) => void): Theme => ({ ground, road: shade(ground, -0.35), glow, glow2, haze, walls, signs, extra, landmark });
const big = (wall: Material, win: Material, sign: Material, h = 7, band: Material | null = null) => (m: Model) => tower(m, { w: 3, d: 2.4, h, wall, win, lit: 0.8, seed: 5, sign, roof: "antenna", band });
const THEMES: Theme[] = [
  T("#23274e", "#ff3fd8", "#7a5cff", "#3a1a66", [S.wall, S.wallDk, S.wallVi], SIGNS, (m) => vending(m), big(S.wallVi, S.winPink, S.mag)),
  T("#202a4c", "#ffe14d", "#4d7dff", "#182a5c", [S.wallBl, S.wallDk], [S.yel, S.blue, S.white], (m) => container(m, S.wallBl, 1.6), (m) => crane(m, 5, 4)),
  T("#26264e", "#ff2e5b", "#ff3fd8", "#2a1050", [S.wall, S.wallDk], [S.red, S.mag, S.blue], (m) => billboard(m, 1.4, 0.8, 1.2), big(S.wall, S.winBlue, S.red, 8)),
  T("#1b2d3f", "#5dffa0", "#9a6bff", "#0e3a3a", [S.wallGr, S.wallDk], [S.green, S.vi, S.white], (m) => rack(m, 1.8, 0.8), big(S.wallGr, S.winGreen, S.green, 6.5)),
  T("#2a2256", "#ffe14d", "#ff3fd8", "#4a1466", [S.wallVi, S.wall], [S.mag, S.yel, S.blue], (m) => billboard(m, 1.6, 0.9, 1.0, S.holoMag, S.yel), big(S.wallVi, S.winPink, S.yel, 6)),
  T("#2f4067", "#d6ecff", "#7a5cff", "#3a5a8a", [S.wallBl, S.concrete], [S.ice, S.white, S.vi], (m) => tank(m, 0.8, 1.8), (m) => tank(m, 1.6, 4.2, S.wallBl, S.ice)),
  T("#1c2656", "#4d7dff", "#ff3fd8", "#1a2a7a", [S.wallBl, S.wall, S.wallDk], [S.blue, S.mag, S.white], (m) => lampPost(m, 1.8, 0.5, S.blue), big(S.wallBl, S.winBlue, S.blue, 9)),
  T("#1c3537", "#9dff4a", "#ff3fd8", "#14402c", [S.wallGr, S.wallDk], [S.green, S.mag], (m) => tree(m, 1.8), (m) => tank(m, 1.4, 3.6, S.wallGr, S.toxic)),
  T("#223259", "#4d7dff", "#f4f0ff", "#12246a", [S.wallBl, S.wallDk], [S.blue, S.white], (m) => container(m, S.wallGr, 1.6, S.white), (m) => crane(m, 5.4, 4.4)),
  T("#2c2750", "#ffd14a", "#ff3fd8", "#5a1a4a", [S.wallVi, S.wallDk], [S.mag, S.white, S.yel], (m) => tree(m, 1.6, S.leafPink), big(S.wallVi, S.winWarm, S.mag, 10, S.gold)),
];
const near = (pts: Pt[], x: number, y: number, d: number) => pts.some(([px, py]) => Math.hypot(px - x, py - y) < d);
const keepModel = (boss: boolean) => (m: Model) => KEEPS.build(m, { damage: 0, state: "intact", boss, skin: null });
const ringPts = (x: number, y: number, r: number, ry = r, n = 36): Pt[] => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, y + Math.sin((i / n) * Math.PI * 2) * ry] as Pt);

// ------------------------------------------------------------------------------------------------ campaign maps
export const MAPS: MapArt = {
  paint(p: Painter, map: MapInfo, st: Stamps) {
    const th = THEMES[map.index], id = map.id;
    // the district from above: dark blocks, a grid of dim streets
    p.fill(th.ground);
    p.slabs(0, 0, map.w, map.h, [th.ground, shade(th.ground, -0.08), shade(th.ground, 0.04)], { sw: 108, sh: 92, joint: 5, jointColor: rgba("#05041a", 0.7) });
    for (let y = 46; y < map.h; y += 92) p.line([[0, y], [map.w, y]], rgba(th.glow2, 0.12), 2);
    for (let i = 0; i < 40; i++) p.glow(p.rand(0, map.w), p.rand(0, map.h), p.rand(60, 150), i % 2 ? th.glow : th.glow2, 0.07, "lighter");
    // the road from the camp to the boss: black tarmac between two tubes of light
    const road = spline(map.path, 14);
    const full: Pt[] = [[map.camp[0], map.camp[1]], ...road, [map.boss[0], map.boss[1] + 40]];
    p.line(full, th.glow, 96, 0.08);
    p.line(full, mixHex(th.glow, "#ffffff", 0.3), 70); p.line(full, "#0b0a22", 62);
    for (let i = 0; i + 3 < full.length; i += 6) p.line([full[i], full[i + 3]], rgba(th.glow2, 0.75), 4);
    for (let i = 6; i < full.length; i += 9) { const [x, y] = full[i]; p.glow(x, y, 90, th.glow, 0.14, "lighter"); }
    // landing rings at each end
    for (const [x, y, rr] of [[map.camp[0], map.camp[1], 86], [map.boss[0], map.boss[1], 112]]) {
      p.glow(x, y + 8, rr * 1.5, "#05041a", 0.6, "source-over", rr * 1.2); p.circle(x, y, rr, "#0e0c28");
      p.line(ringPts(x, y, rr), th.glow, 16, 0.2); p.line(ringPts(x, y, rr), mixHex(th.glow, "#ffffff", 0.5), 4); p.line(ringPts(x, y, rr * 0.76), rgba(th.glow2, 0.7), 2.5);
    }
    // tower blocks wherever there is room
    const spots: { x: number; y: number; draw(): void }[] = [];
    const blocked = (x: number, y: number, d: number) => near(full, x, y, d) || Math.hypot(x - map.camp[0], y - map.camp[1]) < 150 || Math.hypot(x - map.boss[0], y - map.boss[1]) < 200;
    for (let gy = -20; gy < map.h + 60; gy += 92) for (let gx = -30 + ((gy / 92) % 2) * 50; gx < map.w + 60; gx += 108) {
      const x = gx + p.rand(-12, 12), y = gy + p.rand(-10, 10);
      if (blocked(x, y, 96)) continue;
      const v = Math.floor(p.r() * 8);
      spots.push({ x, y, draw: () => st.model(p, (m) => tower(m, { w: 1.5 + (v % 3) * 0.3, d: 1.5, h: 1.3 + (v % 4) * 0.6, wall: th.walls[v % th.walls.length], win: WINS[v % WINS.length], lit: 0.55, seed: v + 1, sign: v % 3 ? th.signs[v % th.signs.length] : null }), x, y, { ppu: 46, yaw: v % 2 ? 62 : 118, el: 52, key: `${id}t${v}`, shadow: 1.1 }) });
    }
    for (let i = 0, tries = 0; i < 7 && tries < 200; tries++) {
      const x = p.rand(60, map.w - 60), y = p.rand(240, map.h - 240);
      if (blocked(x, y, 110) || !near(full, x, y, 240)) continue;
      i++;
      spots.push({ x, y: y + 30, draw: () => st.model(p, th.extra, x, y, { ppu: 46, yaw: 70, el: 52, key: `${id}x`, shadow: 0.7 }) });
    }
    const lx = map.boss[0] + (map.boss[0] > map.w / 2 ? -250 : 250);
    spots.push({ x: lx, y: map.boss[1] - 40, draw: () => st.model(p, th.landmark, lx, map.boss[1] - 60, { ppu: 54, yaw: 70, el: 50, shadow: 1.2 }) });
    spots.push({ x: map.boss[0], y: map.boss[1], draw: () => st.model(p, keepModel(true), map.boss[0], map.boss[1], { ppu: 82, yaw: 90, el: 52, team: "ember" }) });
    spots.push({ x: map.camp[0], y: map.camp[1], draw: () => st.model(p, keepModel(false), map.camp[0], map.camp[1], { ppu: 62, yaw: 90, el: 52, team: "tide" }) });
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    // haze over the far end, a vignette
    p.wash(0, 0, map.w, map.h * 0.32, rgba(th.haze, 0.75), rgba(th.haze, 0));
    const g = p.g, vg = g.createRadialGradient(map.w / 2, map.h * 0.5, map.h * 0.3, map.w / 2, map.h * 0.5, map.h * 0.72);
    vg.addColorStop(0, "rgba(4,3,20,0)"); vg.addColorStop(1, "rgba(4,3,20,0.6)");
    g.fillStyle = vg; g.fillRect(0, 0, map.w, map.h);
  },
};

// ------------------------------------------------------------------------------------------------ key art
export const UI: UiArt = {
  titleKey(p, st) {
    // The home screen shows the whole picture; its buttons cover everything below about 60% of the height, so the
    // crew stands on a horizon at 44% and the sky above carries the moon, the skyline and the fliers.
    const W = 1206, H = 2622, g = p.g, HZ = 1150;
    const sky = g.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, "#06051c"); sky.addColorStop(0.45, "#1a0f4a"); sky.addColorStop(0.8, "#5a1a7a"); sky.addColorStop(1, "#c02aa8");
    g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    for (let i = 0; i < 90; i++) p.circle(p.rand(0, W), p.rand(0, 620), p.rand(0.8, 2.2), rgba("#d6ccff", p.rand(0.3, 0.9)));
    // the moon: a disc of light cut by scan slits
    const mx = 620, my = HZ - 330, mr = 300;
    p.glow(mx, my, 620, "#ff3fd8", 0.4, "lighter");
    p.clip((gg) => gg.arc(mx, my, mr, 0, 7), () => {
      const mg = g.createLinearGradient(0, my - mr, 0, my + mr);
      mg.addColorStop(0, "#fff0fb"); mg.addColorStop(0.5, "#ff8ae8"); mg.addColorStop(1, "#b030e0");
      g.fillStyle = mg; g.fillRect(mx - mr, my - mr, 2 * mr, 2 * mr);
      for (let i = 0; i < 9; i++) { const y = my + 10 + i * 34; p.rect(mx - mr, y, 2 * mr, 5 + i * 2.6, "#3a1466"); }
    });
    // three layers of skyline, nearer and darker, windows lit
    const layer = (base: number, col: string, hmin: number, hmax: number, win: number, seed: number, wins: string[]) => {
      let x = -40;
      const rr = (a: number, b: number) => a + (b - a) * (Math.abs(Math.sin((seed += 1.7) * 99.13)) % 1);
      while (x < W + 40) {
        const w = rr(60, 150), h = rr(hmin, hmax), kind = rr(0, 1), wc = wins[Math.floor(rr(0, wins.length)) % wins.length];
        p.rect(x, base - h, w, h + 60, col);
        if (kind < 0.3) p.rect(x + w * 0.44, base - h - rr(60, 200), w * 0.08, 220, col);
        else if (kind < 0.5) p.rect(x + w * 0.2, base - h - 30, w * 0.6, 40, col);
        g.fillStyle = rgba(wc, win);
        for (let wy = base - h + 14; wy < base - 16; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 20) if (rr(0, 1) < 0.5) g.fillRect(wx, wy, 9, 12);
        if (kind > 0.6) { const sc = ["#ff3fd8", "#7a5cff", "#4d7dff", "#ffe14d"][Math.floor(rr(0, 4)) % 4]; p.glow(x + w * 0.2, base - h * 0.6, 60, sc, 0.5 * win, "lighter"); p.rect(x + w * 0.16, base - h * 0.85, 10, h * 0.5, rgba(sc, win)); }
        p.line([[x, base - h], [x + w, base - h]], rgba("#b9a0ff", win * 0.5), 2);
        x += w + rr(-6, 14);
      }
    };
    layer(HZ - 130, "#3a1a66", 90, 300, 0.35, 1, ["#ffb3f0", "#b9a0ff"]); layer(HZ - 70, "#22104a", 120, 380, 0.6, 5, ["#ffb3f0", "#7fa0ff", "#fff0b8"]); layer(HZ + 10, "#0e0a2c", 110, 300, 0.9, 9, ["#ff8af0", "#b9a0ff", "#7fa0ff", "#fff0b8"]);
    // the street: wet tarmac, a grid of light running to the horizon, the signs mirrored in it
    p.rect(0, HZ, W, H - HZ, "#14123a");
    for (let i = -14; i <= 14; i++) p.line([[W / 2 + i * 26, HZ], [W / 2 + i * 300, H]], rgba("#ff3fd8", 0.34), 3);
    for (let k = 0; k < 16; k++) { const y = HZ + 18 * Math.pow(1.36, k); if (y > H) break; p.line([[0, y], [W, y]], rgba("#7a5cff", 0.4), 2 + k * 0.4); }
    for (let i = 0; i < 16; i++) p.glow(p.rand(0, W), HZ + p.rand(40, 700), p.rand(30, 70), i % 2 ? "#ff3fd8" : "#7a5cff", 0.2, "lighter", p.rand(160, 360));
    p.wash(0, HZ, W, 380, "rgba(200,50,180,0.4)", "rgba(200,50,180,0)");
    p.wash(0, HZ + 500, W, H - HZ - 500, "rgba(6,5,28,0)", "rgba(6,5,28,0.9)");
    // towers either side, the keep and the crew
    st.model(p, (m) => tower(m, { w: 2.6, d: 2.2, h: 7.5, wall: S.wallVi, win: S.winPink, lit: 0.7, seed: 3, sign: S.mag, roof: "antenna" }), 110, HZ + 60, { ppu: 120, yaw: 40, el: 12 });
    st.model(p, (m) => tower(m, { w: 2.6, d: 2.2, h: 6.2, wall: S.wallBl, win: S.winBlue, lit: 0.7, seed: 8, sign: S.yel, roof: "tank" }), 1100, HZ + 60, { ppu: 120, yaw: 140, el: 12 });
    p.glow(603, HZ + 190, 520, "#1fe5ff", 0.16, "lighter", 220);
    st.model(p, keepModel(false), 603, HZ + 150, { ppu: 205, yaw: 90, el: 30, team: "tide", shadow: 1.3 });
    const cast: [string, number, number, number, number, number][] = [["golem", 3, 150, HZ + 300, 250, 62], ["storm", 3, 1060, HZ + 330, 270, 118], ["bulwark", 3, 330, HZ + 420, 300, 66], ["ranger", 3, 880, HZ + 440, 300, 112], ["lion", 4, 610, HZ + 520, 350, 80]];
    for (const [kind, tier, x, y, ppu, yaw] of cast) st.unit(p, kind, tier, x, y, { ppu, yaw, el: 24, shadow: 0.36 });
    st.unit(p, "harrier", 3, 215, HZ - 230, { ppu: 250, yaw: 40, el: 20, anim: "walk", frame: 1 });
    st.unit(p, "griffin", 3, 960, HZ - 520, { ppu: 220, yaw: 140, el: 20, anim: "walk", frame: 2 });
    // rain, and a vignette
    g.strokeStyle = "rgba(190,200,255,0.16)"; g.lineWidth = 2;
    for (let i = 0; i < 260; i++) { const x = p.rand(0, W), y = p.rand(0, H * 0.7), l = p.rand(30, 80); g.beginPath(); g.moveTo(x, y); g.lineTo(x - l * 0.16, y + l); g.stroke(); }
    const vg = g.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.66);
    vg.addColorStop(0, "rgba(4,3,20,0)"); vg.addColorStop(1, "rgba(4,3,20,0.6)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  },
};

// ------------------------------------------------------------------------------------------------ firewall (tower defence)
export const TDART: TdArt = {
  paint(p, map, st) {
    const M = 3.5, th = THEMES[(map.act - 1) % THEMES.length];
    p.slabs(-M, -M, map.w + 2 * M, map.h + 2 * M, [th.ground, shade(th.ground, -0.07), shade(th.ground, 0.05)], { sw: 1.5, sh: 1.0, joint: 0.03, jointColor: rgba("#9aa0ff", 0.3) });
    p.mottle(-M, -M, map.w + 2 * M, map.h + 2 * M, "#05041a", { n: 160, alpha: 0.13, size: [0.6, 2] });
    for (let i = 0; i < 40; i++) p.glow(p.rand(-M, map.w + M), p.rand(-M, map.h + M), 0.5, i % 2 ? th.glow : th.glow2, 0.12, "lighter", 2.2);
    // the roads: black tarmac between tubes of light, dashed down the middle
    const roads = map.paths.map((r) => r.pts.map((q) => [q.x, q.y] as Pt));
    for (const r of roads) p.line(r, th.glow, ROAD_HALF * 2 + 0.5, 0.1);
    for (const r of roads) p.line(r, mixHex(th.glow, "#ffffff", 0.35), ROAD_HALF * 2 + 0.12);
    for (const r of roads) p.line(r, "#0c0b24", ROAD_HALF * 2 - 0.02);
    for (const r of roads) for (let i = 0; i + 6 < r.length; i += 14) p.line([r[i], r[i + 6]], rgba(th.glow2, 0.7), 0.06);
    // keep and gate rings
    for (const [q, rr] of [[map.keep, 2.0], ...map.gates.map((gq) => [gq, 1.3] as [typeof gq, number])] as [{ x: number; y: number }, number][]) { p.circle(q.x, q.y, rr, "#0e0c28"); neonLine(p, ringPts(q.x, q.y, rr * 0.96), th.glow, 0.06); neonLine(p, ringPts(q.x, q.y, rr * 0.7), th.glow2, 0.03, 0.6); }
    // build pads: a hex plate with a lit rim
    for (const pad of map.pads) {
      p.glow(pad.x, pad.y + 0.08, 0.95, "#05041a", 0.5, "source-over");
      const hex = (r: number): Pt[] => Array.from({ length: 7 }, (_, i) => [pad.x + Math.cos((i / 6) * Math.PI * 2) * r, pad.y + Math.sin((i / 6) * Math.PI * 2) * r] as Pt);
      p.poly(hex(0.6), "#1a1840"); neonLine(p, hex(0.58), "#b9a0ff", 0.035); p.poly(hex(0.4), "#262458"); p.line(hex(0.4), rgba("#ffffff", 0.35), 0.02);
    }
    // the city around: towers, racks, lamps, machines wherever there is room
    const pts = roads.flat();
    const free = (x: number, y: number, rad: number) => !near(pts, x, y, ROAD_HALF + rad + 0.3) && !map.pads.some((q) => Math.hypot(q.x - x, q.y - y) < 0.95 + rad) && Math.hypot(map.keep.x - x, map.keep.y - y) > 2.4 + rad && !map.gates.some((q) => Math.hypot(q.x - x, q.y - y) < 1.8 + rad);
    const spots: { y: number; draw(): void }[] = [];
    for (let y = -M + 0.6; y < map.h + M; y += 1.75) for (let x = -M + 0.8 + (Math.round(y / 1.75) % 2) * 0.9; x < map.w + M; x += 2.05) {
      const px = x + p.rand(-0.25, 0.25), py = y + p.rand(-0.2, 0.2);
      if (!free(px, py, 1.05)) {
        if (free(px, py, 0.25) && p.r() < 0.4) { const lamp = p.r() < 0.6; p.glow(px, py, 1.2, th.glow, 0.2, "lighter"); spots.push({ y: py, draw: () => st.model(p, lamp ? (m) => lampPost(m, 1.4, 0, S.vi) : (m) => vending(m), px, py, { ppu: 72, el: 53.13, key: lamp ? "tdlamp" : "tdvend", shadow: 0.15 }) }); }
        continue;
      }
      const v = Math.floor(p.r() * 8);
      spots.push({ y: py, draw: () => st.model(p, (m) => tower(m, { w: 1.5 + (v % 3) * 0.2, d: 1.4, h: 1.0 + (v % 4) * 0.4, wall: th.walls[v % th.walls.length], win: WINS[v % WINS.length], lit: 0.55, seed: v + 2, sign: v % 2 ? th.signs[v % th.signs.length] : null }), px, py, { ppu: 72, yaw: v % 2 ? 60 : 120, el: 53.13, key: `td${map.act}t${v}`, shadow: 1.0 }) });
    }
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
  },
};
