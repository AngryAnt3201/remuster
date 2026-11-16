// Dustline's flat pictures: effect sheets, the ten territory maps, the home key art and the Bastion backdrops.
import { ROAD_HALF } from "@engine/core/td/maps";
import type { MapArt, MapInfo, Stamps, TdArt, UiArt } from "../../../artkit/flat";
import { Painter, rgba, shade, spline, type Pt } from "../../../artkit/paint";
import type { VfxArt } from "../../../artkit/vfx";
import { Model, mat } from "../../../artkit/toon3d";
import { KEEPS } from "./keeps";
import { P, dynamite, powderKeg, pricklyPear, starOutline } from "./parts";
import { S, adobe, belfry, blockhouse, boulder, boxcar, cactus, cottonwood, cypress, derrick, falseFront, locomotive, mesa, palm, pine, spire, telegraph, tent, waterTower, windmill } from "./scenery";

// ------------------------------------------------------------------------------------------------ effects
const TRACER = mat("#fff3c4", { emit: 1, ink: false, alpha: 0.9 });
const SAND = { saturation: 0.75, brightness: 1.08, tint: "#d9b47a", amount: 0.55 };
export const VFX: VfxArt = {
  grade: {
    // earth thrown up by tunnellers and shells is pale desert dust here, not loam
    dirt: SAND, mound: SAND, clod: SAND, divot: { saturation: 0.7, brightness: 0.95, tint: "#b98a55", amount: 0.5 },
    crack: { saturation: 0.6, brightness: 0.95, tint: "#8a5a34", amount: 0.4 }, scorch: { saturation: 0.6, brightness: 0.9, tint: "#5a3a26", amount: 0.3 },
    goo: { tint: "#7fb85a", amount: 0.5 }, gear: { tint: "#c9a15a", amount: 0.35 },
  },
  models: {
    // a rifle slug with a hot tracer
    arrow: (m) => { m.cone([-1.8, 0, 0], [0.3, 0, 0], 0.14, TRACER, { segs: 6 }); m.group(() => { m.cylinder([0.3, 0, 0], [1.15, 0, 0], 0.19, P.brass, 0.19, { segs: 8 }); m.cone([1.15, 0, 0], [1.75, 0, 0], 0.19, P.ironDk, { segs: 8 }); }); },
    // the Buffalo Gun's slug: a long brass cartridge trailing smoke
    bolt: (m) => { m.cone([-1.9, 0, 0], [-0.3, 0, 0], 0.2, P.smoke, { segs: 6 }); m.group(() => { m.cylinder([-0.5, 0, 0], [0.9, 0, 0], 0.17, P.brass, 0.17, { segs: 8 }); m.cone([0.9, 0, 0], [1.8, 0, 0], 0.17, P.ironDk, { segs: 8 }); }); m.cylinder([-0.6, 0, 0], [-0.5, 0, 0], 0.21, P.brassDk, 0.21, { segs: 8 }); m.cylinder([0.2, 0, 0], [0.3, 0, 0], 0.18, P.brassDk, 0.18, { segs: 8 }); },
    // a bundle of dynamite turning end over end
    bomb: (m, f) => { m.with(() => { m.rotY(f * 90 + 20); dynamite(m, 0.6, 0.085, P.fire, 3); }); },
    // the Nitro Kid's powder keg
    keg: (m, f) => { m.with(() => { m.rotY(10); m.move(0, 0, -0.3); powderKeg(m, 0.26, 0.56, P.wood, P.ironDk); m.decal(0.02, () => m.cylinder([0, 0, 0.2], [0, 0, 0.36], 0.265, P.red, 0.265, { segs: 12 })); m.sphere([0.04, 0, 0.66], 0.06 + 0.025 * (f % 2), P.fire, { segs: 6 }); }); },
    // a mortar ball, smoking
    shell: (m) => { m.sphere([0, 0, 0], 0.3, P.ironDk, { segs: 10 }); m.decal(0.03, () => m.sphere([0.1, 0, 0.12], 0.09, P.iron, { segs: 6 })); m.cone([-0.24, 0, 0.05], [-0.48, 0, 0.12], 0.13, P.fire, { segs: 6 }); },
  },
};

// ------------------------------------------------------------------------------------------------ shared: the ten places
type Build = (m: Model) => void;
interface Theme { ground: string[]; trail: string; haze: string; dots: string[]; scatter: Build[]; n: number; landmark: Build; water?: string }
const store = (w: number, seed: number, wall = S.pine, front = S.pineLt): Build => (m) => falseFront(m, { w, h: 1.2 + (seed % 3) * 0.2, wall, front, seed, awning: seed % 2 ? P.team : S.shingleDk });
const THEMES: Theme[] = [
  { ground: ["#dcb67c", "#e8c892", "#c9a066"], trail: "#f0dcae", haze: "#f6dcae", dots: ["#a8804e", "#8f9a4a"], scatter: [store(1.8, 1), store(2.2, 2, S.sage, S.cream), store(2.0, 3, S.barn, S.barn), (m) => cactus(m, 1.6), (m) => cactus(m, 1.2, 1), (m) => mesa(m, 2.6, 2, 1.4, 2)], n: 34, landmark: (m) => waterTower(m, 3.2, 0.9) },
  { ground: ["#9a7e60", "#a88c6c", "#806850"], trail: "#c9b090", haze: "#5a4a44", dots: ["#2a2428", "#5a4a3a"], scatter: [(m) => derrick(m, 3.4), (m) => derrick(m, 2.8), store(1.8, 4, S.greyDk, S.grey), (m) => boulder(m, 0.7, 0.4, S.coal)], n: 30, landmark: (m) => derrick(m, 5) },
  { ground: ["#b9b468", "#c8c47a", "#a09c54"], trail: "#e6d6a4", haze: "#e6e2b0", dots: ["#7d8a40", "#8f9a4a"], scatter: [(m) => cottonwood(m, 2.0), (m) => cottonwood(m, 2.6), (m) => cottonwood(m, 1.6, S.leafDk, S.leaf), (m) => falseFront(m, { w: 2.6, h: 1.8, wall: S.barn, front: S.barn, trim: S.white, awning: null, seed: 2, sign: false })], n: 44, landmark: (m) => windmill(m, 3.6), water: "#5f9fb8" },
  { ground: ["#c4ac88", "#d2bc9a", "#ac9472"], trail: "#8f8272", haze: "#d9cbb4", dots: ["#6a5e52", "#8f8272"], scatter: [(m) => boxcar(m, S.barn), (m) => boxcar(m, S.ochre), store(2.4, 5, S.ochre, S.ochre), (m) => waterTower(m, 2.4, 0.6), (m) => telegraph(m, 2.2)], n: 30, landmark: (m) => locomotive(m) },
  { ground: ["#d6bd8c", "#e2cc9e", "#c0a674"], trail: "#eadbb4", haze: "#f0dcb4", dots: ["#a8804e", "#8f9a4a"], scatter: [(m) => tent(m, 1.3), (m) => tent(m, 1.1), (m) => cactus(m, 1.5), (m) => mesa(m, 2.8, 2.2, 1.6, 5), (m) => boulder(m, 0.6, 0.4)], n: 34, landmark: (m) => blockhouse(m, 2.8) },
  { ground: ["#e6edf4", "#f6f9fc", "#d0dce8"], trail: "#c9b89a", haze: "#e6eef6", dots: ["#b9c6d4", "#ffffff"], scatter: [(m) => pine(m, 2.2, true), (m) => pine(m, 2.8, true), (m) => pine(m, 1.8, true), (m) => boulder(m, 0.8, 0.5, S.snow)], n: 60, landmark: (m) => { mesa(m, 4.4, 3.4, 3.6, 4); m.decal(0.02, () => m.ellipsoid([0, 0, 3.5], [1.4, 1.1, 0.45], S.snow, { segs: 7 })); }, water: "#a9d2e6" },
  { ground: ["#cf8658", "#dc9a6a", "#b46e48"], trail: "#ecc096", haze: "#f0b890", dots: ["#8f3f2a", "#b8724a"], scatter: [(m) => mesa(m, 2.8, 2.2, 1.6, 1), (m) => mesa(m, 2.2, 1.8, 2.2, 3), (m) => spire(m, 2.4, 0.5), (m) => spire(m, 1.7, 0.4), (m) => cactus(m, 1.4)], n: 38, landmark: (m) => { m.tube([[0, -1.8, 0], [0, -1.6, 2.0], [0, 0, 2.8], [0, 1.6, 2.0], [0, 1.8, 0]], [0.6, 0.5, 0.42, 0.5, 0.6], S.rock, { segs: 7 }); } },
  { ground: ["#587a5e", "#648a6a", "#4a6a52"], trail: "#a89c6e", haze: "#4a6a5a", dots: ["#6f9a5a", "#a9e0c8"], scatter: [(m) => cypress(m, 2.6), (m) => cypress(m, 3.2), (m) => cypress(m, 2.2), store(1.8, 7, S.greyDk, S.grey)], n: 52, landmark: (m) => cypress(m, 4.6), water: "#3f6e62" },
  { ground: ["#e9d6a8", "#f3e4bc", "#d6c08e"], trail: "#f8f0d8", haze: "#cfe6f0", dots: ["#c8644a", "#b9a878"], scatter: [(m) => adobe(m, { w: 2.0, wall: S.plaster, seed: 2, tile: true }), (m) => adobe(m, { w: 1.7, wall: S.adobeLt, seed: 3 }), (m) => palm(m, 2.4), (m) => palm(m, 3.0), (m) => pricklyPear(m, 0.7)], n: 36, landmark: (m) => belfry(m, 4.2, 2.0), water: "#4fa3c4" },
  { ground: ["#b98458", "#c89466", "#9f6e48"], trail: "#e6bc8c", haze: "#b8553a", dots: ["#6a3a3a", "#ffd45e"], scatter: [(m) => falseFront(m, { w: 2.2, h: 2.0, wall: S.barn, front: S.cream, trim: S.gold, awning: P.team, lit: true, seed: 2, storeys: 2 }), (m) => falseFront(m, { w: 2.0, h: 2.0, wall: S.teal, front: S.teal, awning: S.canvas, lit: true, seed: 3, storeys: 2 }), (m) => falseFront(m, { w: 1.8, h: 1.3, wall: S.ochre, lit: true, seed: 4 }), (m) => cactus(m, 1.5), (m) => mesa(m, 2.6, 2, 1.6, 6)], n: 34, landmark: (m) => falseFront(m, { w: 4.6, d: 2.4, h: 2.9, wall: S.cream, front: S.barn, trim: S.gold, awning: S.canvas, lit: true, seed: 2, storeys: 3 }) },
];
const near = (pts: Pt[], x: number, y: number, d: number) => pts.some(([px, py]) => Math.hypot(px - x, py - y) < d);
const keepModel = (boss: boolean) => (m: Model) => KEEPS.build(m, { damage: 0, state: "intact", boss, skin: null });
/** A plank deck with a painted star and brass tacks round the rim. */
function deck(p: Painter, x: number, y: number, r: number, k: number, ry = r) {
  const g = p.g;
  p.glow(x, y + 8 * k, r * 1.5, "#1c0e06", 0.35, "source-over", ry * 1.3);
  p.circle(x, y, r, "#5f3d20", 2.5 * k, ry);
  p.clip((gg) => gg.ellipse(x, y, r * 0.93, ry * 0.93, 0, 0, 7), () => p.planks(x - r, y - ry, r * 2, ry * 2, ["#b08050", "#a27445", "#bd8d5c"], { width: r * 0.17, len: r }));
  g.save(); g.globalAlpha = 0.55; p.poly(starOutline(r * 0.72, 0.45, -Math.PI / 2).map(([sx, sy]) => [x + sx, y + sy * (ry / r)] as Pt), "#f3e2b4", 1.5 * k); g.restore();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; p.circle(x + Math.cos(a) * r * 0.96, y + Math.sin(a) * ry * 0.96, 3.2 * k, "#e2a93b", 1 * k); }
}

// ------------------------------------------------------------------------------------------------ campaign maps
export const MAPS: MapArt = {
  paint(p: Painter, map: MapInfo, st: Stamps) {
    const th = THEMES[map.index], id = map.id, g = p.g;
    p.fill(th.ground[0]);
    p.mottle(0, 0, map.w, map.h, th.ground[1], { n: 240, alpha: 0.45, size: [40, 150] });
    p.mottle(0, 0, map.w, map.h, th.ground[2], { n: 160, alpha: 0.35, size: [30, 110] });
    p.mottle(0, 0, map.w, map.h, "#fff6dc", { n: 50, alpha: 0.08, size: [60, 180] });
    const road = spline(map.path, 14);
    const full: Pt[] = [[map.camp[0], map.camp[1]], ...road, [map.boss[0], map.boss[1] + 40]];
    // water where the place has it: a creek that wanders across under the trail
    if (th.water) for (const yy of [map.h * 0.42, map.h * 0.68]) { const cr = spline([[-20, yy - 40], [map.w * 0.3, yy + 30], [map.w * 0.62, yy - 26], [map.w + 20, yy + 20]], 16); p.line(cr, shade(th.water, -0.35), 44); p.line(cr, th.water, 36); p.line(cr.map(([x, y]) => [x, y - 9] as Pt), "#ffffff", 3, 0.35); }
    // the trail: pale dust, two ruts, a dashed centre like a surveyor's line
    p.line(full, shade(th.trail, -0.4), 62); p.line(full, th.trail, 54);
    for (const o of [-13, 13]) p.line(full.map(([x, y]) => [x + o, y] as Pt), shade(th.trail, -0.22), 5, 0.7);
    g.save(); g.setLineDash([16, 14]); p.line(full, "#8f1d16", 4, 0.75); g.restore();
    p.scatter(0, 0, map.w, map.h, 520, (x, y) => p.circle(x, y, p.rand(2, 5), p.pick(th.dots), 0, p.rand(1.5, 3)), (x, y) => !near(full, x, y, 40));
    deck(p, map.camp[0], map.camp[1], 88, 1, 70); deck(p, map.boss[0], map.boss[1], 112, 1.2, 90);
    // the place itself, wherever there is room
    const spots: { y: number; draw(): void }[] = [];
    const blocked = (x: number, y: number, d: number) => near(full, x, y, d) || Math.hypot(x - map.camp[0], y - map.camp[1]) < 150 || Math.hypot(x - map.boss[0], y - map.boss[1]) < 200;
    for (let i = 0, tries = 0; i < th.n && tries < 900; tries++) {
      const x = p.rand(20, map.w - 20), y = p.rand(120, map.h - 40);
      if (blocked(x, y, 96) || spots.some((s) => Math.abs(s.y - y) < 60 && Math.abs((s as { x?: number }).x! - x) < 96)) continue;
      const v = Math.floor(p.r() * th.scatter.length);
      spots.push(Object.assign({ y, draw: () => st.model(p, th.scatter[v], x, y, { ppu: 48, yaw: v % 2 ? 72 : 108, el: 40, key: `${id}s${v}`, shadow: 0.9 }) }, { x }));
      i++;
    }
    const lx = map.boss[0] + (map.boss[0] > map.w / 2 ? -250 : 250);
    spots.push({ y: map.boss[1] - 40, draw: () => st.model(p, th.landmark, lx, map.boss[1] - 50, { ppu: 60, yaw: 70, el: 50, shadow: 1.2 }) });
    spots.push({ y: map.boss[1], draw: () => st.model(p, keepModel(true), map.boss[0], map.boss[1], { ppu: 82, yaw: 90, el: 52, team: "ember" }) });
    spots.push({ y: map.camp[1], draw: () => st.model(p, keepModel(false), map.camp[0], map.camp[1], { ppu: 62, yaw: 90, el: 52, team: "tide" }) });
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    // heat haze over the far end, a burnt paper edge
    p.wash(0, 0, map.w, map.h * 0.3, rgba(th.haze, 0.7), rgba(th.haze, 0));
    const vg = g.createRadialGradient(map.w / 2, map.h * 0.5, map.h * 0.3, map.w / 2, map.h * 0.5, map.h * 0.72);
    vg.addColorStop(0, "rgba(70,30,10,0)"); vg.addColorStop(1, "rgba(70,30,10,0.5)");
    g.fillStyle = vg; g.fillRect(0, 0, map.w, map.h);
  },
};

// ------------------------------------------------------------------------------------------------ key art
export const UI: UiArt = {
  titleKey(p, st) {
    // The home screen shows the whole picture; its poster covers everything below about 60% of the height, so the
    // posse stands on a horizon at 44% and the sky above carries the sun and the buzzards.
    const W = 1206, H = 2622, g = p.g, HZ = 1150;
    const sky = g.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, "#3f8fc9"); sky.addColorStop(0.45, "#8fc6e0"); sky.addColorStop(0.8, "#f6dca0"); sky.addColorStop(1, "#ffc978");
    g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    p.glow(610, 420, 620, "#fff6d0", 0.75, "lighter");
    p.circle(610, 420, 120, "#fffbe6", 0);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.line([[610 + Math.cos(a) * 160, 420 + Math.sin(a) * 160], [610 + Math.cos(a) * (230 + 40 * (i % 2)), 420 + Math.sin(a) * (230 + 40 * (i % 2))]], "#fff6d0", 10, 0.5); }
    for (let i = 0; i < 6; i++) { const x = p.rand(0, W), y = p.rand(160, 760), w = p.rand(200, 420); g.save(); g.globalAlpha = 0.5; p.round(x - w / 2, y, w, p.rand(26, 44), 22, "#ffffff"); p.round(x - w / 3, y - 18, w * 0.5, 40, 20, "#ffffff"); g.restore(); }
    // three ranges of mesas, nearer and redder
    const range = (base: number, col: string, hmin: number, hmax: number, seed: number) => {
      let x = -60;
      const rr = (a: number, b: number) => a + (b - a) * (Math.abs(Math.sin((seed += 1.7) * 99.13)) % 1);
      while (x < W + 60) {
        const w = rr(120, 320), h = rr(hmin, hmax), sl = rr(14, 40);
        if (rr(0, 1) < 0.72) p.poly([[x - sl, base + 30], [x, base - h * 0.5], [x + sl * 0.4, base - h], [x + w - sl * 0.4, base - h], [x + w, base - h * 0.5], [x + w + sl, base + 30]], col);
        else p.poly([[x + w * 0.3, base + 30], [x + w * 0.4, base - h * 1.25], [x + w * 0.56, base - h * 1.25], [x + w * 0.66, base + 30]], col);
        x += w + rr(-10, 80);
      }
      p.rect(0, base, W, 60, col);
    };
    range(HZ - 110, "#e3a67a", 70, 190, 1); range(HZ - 50, "#cf7f55", 80, 220, 5); range(HZ + 4, "#b3583a", 50, 150, 9);
    // the street: sunlit dirt, ruts running to the vanishing point, the rails across
    const gr = g.createLinearGradient(0, HZ, 0, H);
    gr.addColorStop(0, "#f0d096"); gr.addColorStop(0.3, "#dcb67c"); gr.addColorStop(1, "#b98a55");
    g.fillStyle = gr; g.fillRect(0, HZ, W, H - HZ);
    p.mottle(0, HZ, W, H - HZ, "#fff6dc", { n: 60, alpha: 0.12, size: [60, 200] });
    p.mottle(0, HZ, W, H - HZ, "#8a5a34", { n: 60, alpha: 0.1, size: [50, 160] });
    for (const o of [-1, 1]) p.poly([[603 + o * 6, HZ + 6], [603 + o * 120, H], [603 + o * 200, H], [603 + o * 12, HZ + 6]], "rgba(140,90,50,0.3)");
    for (let i = 0; i < 9; i++) { const y = HZ + 22 + i * i * 2.4; p.rect(0, y, W, 3 + i, "rgba(110,70,40,0.5)"); }
    p.rect(0, HZ + 60, W, 5, "#b9b4ac"); p.rect(0, HZ + 86, W, 6, "#b9b4ac");
    // the town down both sides, a water tower, the wires
    const fronts: [number, number, number, number][] = [[80, HZ + 80, 150, 20], [1126, HZ + 80, 150, 160], [230, HZ + 42, 104, 24], [976, HZ + 42, 104, 156], [330, HZ + 22, 74, 28], [876, HZ + 22, 74, 152]];
    fronts.forEach(([x, y, ppu, yaw], i) => st.model(p, (m) => falseFront(m, { w: 2.4, h: 1.5 + (i % 3) * 0.25, wall: [S.pine, S.sage, S.barn, S.cream, S.ochre, S.teal][i], front: [S.pineLt, S.cream, S.barn, S.cream, S.ochre, S.teal][i], awning: i % 2 ? S.shingleDk : P.team, seed: i + 1, storeys: i < 2 ? 2 : 1 }), x, y, { ppu, yaw, el: 12, team: i % 2 ? "ember" : "tide", shadow: 1 }));
    st.model(p, (m) => waterTower(m, 3.6, 0.9), 1000, HZ + 20, { ppu: 70, yaw: 70, el: 12 });
    for (const [x, ppu] of [[150, 120], [1056, 120], [420, 60], [786, 60]]) st.model(p, (m) => telegraph(m, 2.6), x, HZ + (ppu > 100 ? 110 : 30), { ppu, yaw: 90, el: 10 });
    for (const [x, y, s] of [[-10, HZ + 150, 170], [1215, HZ + 150, 170]]) st.model(p, (m) => cactus(m, 2.2), x, y, { ppu: s, yaw: 90, el: 14, shadow: 0.3 });
    // the hall and the posse
    p.glow(603, HZ + 200, 520, "#fff0c0", 0.35, "lighter", 200);
    st.model(p, keepModel(false), 603, HZ + 150, { ppu: 200, yaw: 90, el: 28, team: "tide", shadow: 1.3 });
    const cast: [string, number, number, number, number, number][] = [["golem", 3, 150, HZ + 310, 240, 62], ["lancer", 3, 1040, HZ + 330, 250, 124], ["bulwark", 3, 340, HZ + 430, 300, 66], ["ranger", 3, 880, HZ + 450, 300, 112], ["lion", 4, 610, HZ + 530, 350, 80]];
    for (const [kind, tier, x, y, ppu, yaw] of cast) st.unit(p, kind, tier, x, y, { ppu, yaw, el: 24, shadow: 0.36 });
    st.unit(p, "harrier", 3, 250, HZ - 420, { ppu: 230, yaw: 40, el: 20, anim: "walk", frame: 1 });
    st.unit(p, "griffin", 3, 880, HZ - 610, { ppu: 190, yaw: 140, el: 20, anim: "walk", frame: 2 });
    g.fillStyle = "#3a2a22"; for (const [x, y, s] of [[420, 250, 1], [470, 290, 0.8], [760, 200, 0.9], [330, 330, 0.7]]) { g.beginPath(); g.moveTo(x - 26 * s, y - 6 * s); g.quadraticCurveTo(x - 10 * s, y - 14 * s, x, y); g.quadraticCurveTo(x + 10 * s, y - 14 * s, x + 26 * s, y - 6 * s); g.quadraticCurveTo(x + 10 * s, y - 6 * s, x, y + 5 * s); g.quadraticCurveTo(x - 10 * s, y - 6 * s, x - 26 * s, y - 6 * s); g.fill(); }
    p.wash(0, HZ + 520, W, H - HZ - 520, "rgba(70,30,10,0)", "rgba(70,30,10,0.75)");
    const vg = g.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.66);
    vg.addColorStop(0, "rgba(70,30,10,0)"); vg.addColorStop(1, "rgba(70,30,10,0.45)");
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  },
};

// ------------------------------------------------------------------------------------------------ bastion
export const TDART: TdArt = {
  paint(p, map, st) {
    const M = 3.5, th = THEMES[(map.act - 1) % THEMES.length];
    p.rect(-M, -M, map.w + 2 * M, map.h + 2 * M, th.ground[0]);
    p.mottle(-M, -M, map.w + 2 * M, map.h + 2 * M, th.ground[1], { n: 220, alpha: 0.45, size: [0.6, 2.2] });
    p.mottle(-M, -M, map.w + 2 * M, map.h + 2 * M, th.ground[2], { n: 140, alpha: 0.3, size: [0.5, 1.8] });
    p.mottle(-M, -M, map.w + 2 * M, map.h + 2 * M, "#fff6dc", { n: 60, alpha: 0.08, size: [0.6, 2] });
    // the trails: pale packed dust between timber kerbs, wagon ruts down the middle
    const roads = map.paths.map((r) => r.pts.map((q) => [q.x, q.y] as Pt));
    for (const r of roads) p.line(r, shade(th.trail, -0.5), ROAD_HALF * 2 + 0.22);
    for (const r of roads) p.line(r, shade(th.trail, -0.2), ROAD_HALF * 2 + 0.08);
    for (const r of roads) p.line(r, th.trail, ROAD_HALF * 2 - 0.1);
    for (const r of roads) for (const o of [-0.24, 0.24]) p.line(r.map(([x, y]) => [x + o, y + o * 0.3] as Pt), shade(th.trail, -0.2), 0.08, 0.6);
    const pts = roads.flat();
    p.scatter(-M, -M, map.w + 2 * M, map.h + 2 * M, 420, (x, y) => p.circle(x, y, p.rand(0.03, 0.08), p.pick(th.dots), 0, p.rand(0.02, 0.05)), (x, y) => !near(pts, x, y, ROAD_HALF + 0.2));
    for (const [q, rr] of [[map.keep, 2.0], ...map.gates.map((gq) => [gq, 1.3] as [typeof gq, number])] as [{ x: number; y: number }, number][]) deck(p, q.x, q.y, rr, 0.02);
    // build pads: a square of planks nailed down, a tack in each corner
    for (const pad of map.pads) {
      p.glow(pad.x, pad.y + 0.08, 0.95, "#1c0e06", 0.4, "source-over");
      p.rect(pad.x - 0.56, pad.y - 0.56, 1.12, 1.12, "#5f3d20", 0.04);
      p.planks(pad.x - 0.5, pad.y - 0.5, 1.0, 1.0, ["#c79a66", "#b98b58", "#d2a674"], { width: 0.2, len: 1.2 });
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.circle(pad.x + dx * 0.42, pad.y + dy * 0.42, 0.045, "#e2a93b", 0.015);
    }
    const free = (x: number, y: number, rad: number) => !near(pts, x, y, ROAD_HALF + rad + 0.3) && !map.pads.some((q) => Math.hypot(q.x - x, q.y - y) < 0.95 + rad) && Math.hypot(map.keep.x - x, map.keep.y - y) > 2.4 + rad && !map.gates.some((q) => Math.hypot(q.x - x, q.y - y) < 1.8 + rad);
    const spots: { y: number; draw(): void }[] = [];
    for (let y = -M + 0.6; y < map.h + M; y += 1.75) for (let x = -M + 0.8 + (Math.round(y / 1.75) % 2) * 0.9; x < map.w + M; x += 2.05) {
      const px = x + p.rand(-0.25, 0.25), py = y + p.rand(-0.2, 0.2);
      if (!free(px, py, 1.0)) { if (free(px, py, 0.2) && p.r() < 0.4) spots.push({ y: py, draw: () => st.model(p, (m) => cactus(m, 1.1, 1), px, py, { ppu: 72, el: 53.13, key: "tdcactus", shadow: 0.15 }) }); continue; }
      const v = Math.floor(p.r() * th.scatter.length);
      if (p.r() < 0.55) { if (p.r() < 0.5) spots.push({ y: py, draw: () => st.model(p, (m) => (v % 2 ? cactus(m, 1.3, 2) : boulder(m, 0.5, 0.3)), px, py, { ppu: 72, el: 53.13, key: `tdx${v % 2}`, shadow: 0.2 }) }); continue; }
      spots.push({ y: py, draw: () => st.model(p, th.scatter[v], px, py, { ppu: 72, yaw: v % 2 ? 74 : 106, el: 53.13, key: `td${map.act}s${v}`, shadow: 0.9 }) });
    }
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
  },
};
