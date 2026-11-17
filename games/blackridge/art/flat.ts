// Blackridge's flat pictures: the projectiles (tracer rounds, shells, grenades), the ten theatre maps (a planning
// map: contours, grid squares, a marked route), the home screen's surveillance frame and the Redoubt grounds.
import { ROAD_HALF } from "@engine/core/td/maps";
import type { MapArt, MapInfo, Stamps, TdArt, UiArt } from "../../../artkit/flat";
import { rgba, shade, spline, type Painter, type Pt } from "../../../artkit/paint";
import type { VfxArt } from "../../../artkit/vfx";
import type { Model } from "../../../artkit/toon3d";
import { KEEPS } from "./keeps";
import { P } from "./parts";
import { TEAMS } from "./style";

type Build = (m: Model) => void;
const keepModel = (boss: boolean): Build => (m) => KEEPS.build(m, { damage: 0, state: "intact", boss, skin: null });
const near = (pts: Pt[], x: number, y: number, d: number) => pts.some(([px, py]) => Math.hypot(px - x, py - y) < d);

// ------------------------------------------------------------------------------------------------ effects
export const VFX: VfxArt = {
  grade: { "*": { saturation: 0.72, brightness: 0.96 }, flame: { saturation: 0.9 }, fireball: { saturation: 0.9 } },
  models: {
    // a rifle round: a short bright tracer
    arrow: (m) => { m.capsule([-1.5, 0, 0], [1.2, 0, 0], 0.03, P.tracer, 0.11, { segs: 5 }); m.sphere([1.3, 0, 0], 0.16, P.flashHot, { segs: 6 }); },
    // an anti-tank round: a dark dart on a long hot streak
    bolt: (m) => { m.capsule([-1.8, 0, 0], [0.6, 0, 0], 0.03, P.fire, 0.16, { segs: 6 }); m.cylinder([0.4, 0, 0], [1.5, 0, 0], 0.13, P.gun, 0.13, { segs: 6 }); m.cone([1.5, 0, 0], [1.95, 0, 0], 0.13, P.steel, { segs: 6 }); m.group(() => { for (let i = 0; i < 4; i++) m.poly([[0.4, 0, 0], [0.75, 0, 0], [0.4, Math.cos(i * 1.571) * 0.3, Math.sin(i * 1.571) * 0.3]], P.steelDk); }); },
    // a fragmentation grenade, tumbling
    bomb: (m, f) => { m.with(() => { m.rotY(f * 90); m.group(() => { m.ellipsoid([0, 0, 0], [0.3, 0.3, 0.36], P.oliveDk, { segs: 8 }); m.box([0, 0, 0.42], [0.16, 0.16, 0.14], P.steel); m.box([0.14, 0, 0.3], [0.05, 0.08, 0.36], P.steelDk); }); m.decal(0.02, () => m.cylinder([0, 0, -0.06], [0, 0, 0.06], 0.31, P.hazard, 0.31, { segs: 8 })); }); },
    // the Demo Bot's charge
    keg: (m, f) => { m.with(() => { m.rotY(f * 20 - 10); m.group(() => { for (const y of [-0.17, 0.17]) m.cylinder([-0.3, y, 0], [0.3, y, 0], 0.2, P.hazard, 0.2, { segs: 8 }); }); m.decal(0.02, () => m.box([0, 0, 0], [0.12, 0.76, 0.42], P.black)); m.sphere([0, 0, 0.26], 0.08, f % 2 ? P.warn : P.red, { segs: 5 }); }); },
    // a mortar bomb: a finned teardrop
    shell: (m) => { m.group(() => { m.ellipsoid([0.15, 0, 0], [0.5, 0.24, 0.24], P.armorDk, { segs: 8 }); m.cylinder([-0.7, 0, 0], [-0.2, 0, 0], 0.07, P.gun, 0.1, { segs: 6 }); for (let i = 0; i < 4; i++) m.poly([[-0.85, 0, 0], [-0.5, 0, 0], [-0.85, Math.cos(i * 1.571) * 0.26, Math.sin(i * 1.571) * 0.26]], P.steelDk); }); m.decal(0.02, () => m.cylinder([0.3, 0, 0], [0.4, 0, 0], 0.235, P.hazard, 0.2, { segs: 8 })); },
    shard: (m) => { m.cone([-0.2, 0, 0], [0.95, 0, 0], 0.22, P.cryo, { segs: 4 }); m.cone([-0.2, 0, 0], [-0.9, 0, 0], 0.22, P.cryoMist, { segs: 4 }); },
    pellet: (m) => { m.capsule([-0.5, 0, 0], [0.2, 0, 0], 0.04, P.tracer, 0.16, { segs: 5 }); },
  },
};

// ------------------------------------------------------------------------------------------------ theatre maps
const MAP_BASE = ["#2a3338", "#33322c", "#2e342c", "#303234", "#39403f", "#333638", "#30302e", "#2c3438", "#2a322c", "#322c2a"];

/** A planning map: dark ground, contour lines, a kilometre grid with references, the route in amber. */
function planningMap(p: Painter, w: number, h: number, base: string, seed: number) {
  const g = p.g;
  p.rect(0, 0, w, h, base);
  p.mottle(0, 0, w, h, shade(base, 0.25), { n: 60, size: [120, 420], alpha: 0.12 });
  p.mottle(0, 0, w, h, shade(base, -0.4), { n: 60, size: [120, 420], alpha: 0.18 });
  p.mottle(0, 0, w, h, shade(base, 0.4), { n: 2400, size: [1.5, 5], alpha: 0.12 });
  // contours: rings round a few summits
  const tops: [number, number, number][] = [];
  for (let i = 0; i < 7; i++) tops.push([p.rand(0, w), p.rand(120, h - 60), p.rand(120, 300)]);
  for (const [cx, cy, R] of tops) for (let k = 1; k <= 7; k++) {
    const pts: Pt[] = [], rr = (R * k) / 5;
    for (let a = 0; a <= 6.4; a += 0.16) { const wob = 1 + 0.16 * Math.sin(a * 3 + cx) + 0.1 * Math.sin(a * 5 + cy + k) + 0.06 * Math.sin(a * 9 + seed); pts.push([cx + Math.cos(a) * rr * wob, cy + Math.sin(a) * rr * wob * 0.8]); }
    p.line(pts, shade(base, 0.5), k % 4 === 0 ? 2.2 : 1.1, k % 4 === 0 ? 0.42 : 0.26);
  }
  // the grid, with references along the top and left edges
  for (let x = 0; x <= w; x += 105) p.line([[x, 0], [x, h]], "#9fb4c0", x % 420 === 0 ? 1.6 : 0.8, 0.22);
  for (let y = 0; y <= h; y += 105) p.line([[0, y], [w, y]], "#9fb4c0", y % 420 === 0 ? 1.6 : 0.8, 0.22);
  g.save(); g.fillStyle = "rgba(190,208,218,0.5)"; g.font = "600 17px ui-monospace, Menlo, monospace";
  for (let x = 105, i = 0; x < w; x += 105, i++) g.fillText(String(41 + i + seed), x + 6, 20);
  for (let y = 105, i = 0; y < h; y += 105, i++) g.fillText(String(88 - i), 6, y + 20);
  g.restore();
}
function marker(p: Painter, x: number, y: number, r: number, col: string) {
  p.circle(x, y, r, rgba("#0b0f14", 0.55)); p.g.save(); p.g.strokeStyle = col; p.g.lineWidth = 3; p.g.setLineDash([14, 8]); p.g.beginPath(); p.g.arc(x, y, r, 0, 6.283); p.g.stroke(); p.g.setLineDash([]);
  for (const a of [0, 1.571, 3.142, 4.712]) { p.g.beginPath(); p.g.moveTo(x + Math.cos(a) * (r - 12), y + Math.sin(a) * (r - 12)); p.g.lineTo(x + Math.cos(a) * (r + 16), y + Math.sin(a) * (r + 16)); p.g.stroke(); }
  p.g.restore();
}

export const MAPS: MapArt = {
  paint(p: Painter, map: MapInfo, st: Stamps) {
    planningMap(p, map.w, map.h, MAP_BASE[map.index] ?? MAP_BASE[0], map.index);
    const road = spline(map.path, 14), full: Pt[] = [[map.camp[0], map.camp[1]], ...road, [map.boss[0], map.boss[1] + 40]];
    // water, woods and built-up blocks as flat map tints, clear of the route
    for (let i = 0, tries = 0; i < 9 && tries < 200; tries++) {
      const x = p.rand(60, map.w - 60), y = p.rand(260, map.h - 120);
      if (near(full, x, y, 150)) continue;
      const kind = (i + map.index) % 3;
      if (kind === 0) { p.g.save(); p.g.globalAlpha = 0.5; for (let k = 0; k < 6; k++) p.rect(x + (k % 3) * 34 - 50, y + Math.floor(k / 3) * 30 - 30, 26, 22, "#8f969a"); p.g.restore(); }
      else if (kind === 1) p.circle(x, y, p.rand(50, 90), rgba("#3f5a44", 0.45), 0, p.rand(34, 60));
      else p.circle(x, y, p.rand(46, 80), rgba("#2c4a5c", 0.6), 0, p.rand(26, 44));
      i++;
    }
    // the route: a dark casing, an amber dashed line, a tick at each bend
    p.line(full, rgba("#0b0f14", 0.7), 44);
    p.line(full, rgba("#5a6468", 0.5), 30);
    p.g.save(); p.g.setLineDash([22, 14]); p.line(full, "#ffb000", 4, 0.85); p.g.restore();
    marker(p, map.camp[0], map.camp[1], 96, TEAMS.tide.main);
    marker(p, map.boss[0], map.boss[1], 128, TEAMS.ember.main);
    st.model(p, keepModel(true), map.boss[0], map.boss[1] + 20, { ppu: 76, yaw: 90, el: 50, team: "ember", shadow: 1.2 });
    st.model(p, keepModel(false), map.camp[0], map.camp[1] + 16, { ppu: 58, yaw: 90, el: 50, team: "tide", shadow: 1.2 });
    // a cold vignette and scan grain
    const g = p.g, v = g.createRadialGradient(map.w / 2, map.h / 2, map.h * 0.3, map.w / 2, map.h / 2, map.h * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(4,8,12,0.6)"); g.fillStyle = v; g.fillRect(0, 0, map.w, map.h);
  },
};

// ------------------------------------------------------------------------------------------------ key art
export const UI: UiArt = {
  titleKey(p, st) {
    // A long-lens frame of the ridge at dusk under smoke: sky above, the black ridge and a burning skyline at the
    // horizon (44%), the task force drawn up on wet tarmac between 45% and 60%, dark ground below for the interface.
    const W = 1206, H = 2622, HZ = 1150, g = p.g;
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, "#161c22"); sky.addColorStop(0.55, "#3c444a"); sky.addColorStop(0.9, "#8a8478"); sky.addColorStop(1, "#b89a74");
    g.fillStyle = sky; g.fillRect(0, 0, W, HZ + 4);
    // smoke: long smears drifting right, darker low down
    for (let i = 0; i < 90; i++) { const y = p.rand(120, HZ - 40); p.glow(p.rand(-100, W + 100), y, p.rand(120, 380), i % 3 ? "#1c2126" : "#59605f", p.rand(0.1, 0.26), "source-over", p.rand(30, 90)); }
    for (const [x, hgt] of [[250, 620], [820, 760], [1040, 420]]) for (let k = 0; k < 14; k++) p.glow(x + k * 16 + p.rand(-30, 30), HZ - (hgt * k) / 14, 60 + k * 16, "#14171a", 0.34, "source-over", 50 + k * 10);
    // the far ridge, then the near one with a comms mast, and fires along the skyline
    const ridge = (y: number, amp: number, col: string, seed: number) => { const pts: Pt[] = [[-10, HZ + 40]]; for (let x = -10; x <= W + 10; x += 30) pts.push([x, y - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + seed)) - amp * 0.3 * Math.sin(x * 0.021 + seed * 2) - amp * 0.12 * Math.sin(x * 0.07 + seed)]); pts.push([W + 10, HZ + 40]); p.poly(pts, col); };
    ridge(HZ - 120, 260, "#3a4146", 1.3); ridge(HZ - 30, 170, "#22272b", 4.1);
    for (const x of [180, 420, 700, 930, 1100]) { p.glow(x, HZ - 20, 90, "#ff8a2a", 0.5, "lighter", 40); p.glow(x, HZ - 14, 30, "#ffd27a", 0.7, "lighter", 16); }
    g.fillStyle = "#14181b"; g.fillRect(600, HZ - 520, 6, 520); for (let k = 0; k < 9; k++) { g.fillRect(586 - k, HZ - 500 + k * 56, 34 + 2 * k, 3); } p.glow(603, HZ - 524, 16, "#ff3a2a", 0.9, "lighter");
    // the ground: wet tarmac catching the fires
    const gr = g.createLinearGradient(0, HZ, 0, H); gr.addColorStop(0, "#3a3d3e"); gr.addColorStop(0.25, "#26292b"); gr.addColorStop(1, "#0d1014");
    g.fillStyle = gr; g.fillRect(0, HZ, W, H - HZ);
    p.mottle(0, HZ, W, 700, "#0c0d0e", { n: 500, size: [2, 9], alpha: 0.3 });
    for (let i = 0; i < 40; i++) p.glow(p.rand(0, W), HZ + p.rand(10, 420), p.rand(60, 200), i % 2 ? "#ff9a4a" : "#8fa6b4", 0.07, "lighter", p.rand(6, 16));
    for (let i = 0; i < 9; i++) { const y = HZ + 60 + i * i * 9; p.line([[0, y], [W, y + p.rand(-6, 6)]], "#0a0b0c", 2 + i * 0.6, 0.35); }
    // helicopters and a drone in the smoke
    st.unit(p, "griffin", 3, 300, 520, { ppu: 210, yaw: 20, el: 14, anim: "walk", frame: 2 });
    st.unit(p, "griffin", 2, 930, 380, { ppu: 120, yaw: 30, el: 12, anim: "walk", frame: 4 });
    st.unit(p, "harrier", 2, 760, 640, { ppu: 120, yaw: 25, el: 16, anim: "walk", frame: 1 });
    // the command post behind, armour on the flanks, the squad in front
    st.model(p, keepModel(false), 603, HZ + 70, { ppu: 150, yaw: 90, el: 24, team: "tide", shadow: 1.2 });
    const cast: [string, number, number, number, number, number][] = [
      ["golem", 3, 200, HZ + 270, 250, 62], ["lancer", 3, 1010, HZ + 250, 240, 122], ["outrider", 2, 860, HZ + 150, 170, 118], ["bombard", 2, 360, HZ + 150, 170, 70],
      ["banner", 3, 420, HZ + 300, 250, 76], ["bulwark", 3, 790, HZ + 330, 260, 108], ["ranger", 3, 520, HZ + 380, 270, 82], ["medic", 2, 930, HZ + 400, 250, 110],
      ["lion", 4, 640, HZ + 430, 300, 90], ["ranger", 2, 300, HZ + 420, 260, 72], ["blades", 2, 760, HZ + 470, 250, 100], ["tide", 2, 130, HZ + 440, 250, 66], ["hook", 2, 1080, HZ + 440, 250, 116],
    ];
    cast.sort((a, b) => a[3] - b[3]).forEach(([kind, tier, x, y, ppu, yaw]) => st.unit(p, kind, tier, x, y, { ppu, yaw, el: 20, shadow: 0.3 }));
    // haze over the horizon, darkness below for the interface, a cold grade
    const hz = g.createLinearGradient(0, HZ - 200, 0, HZ + 160); hz.addColorStop(0, "rgba(160,150,130,0)"); hz.addColorStop(0.55, "rgba(160,150,130,0.3)"); hz.addColorStop(1, "rgba(160,150,130,0)");
    g.fillStyle = hz; g.fillRect(0, HZ - 200, W, 360);
    const low = g.createLinearGradient(0, HZ + 480, 0, H); low.addColorStop(0, "rgba(11,15,20,0)"); low.addColorStop(0.3, "rgba(11,15,20,0.92)"); low.addColorStop(1, "#0b0f14");
    g.fillStyle = low; g.fillRect(0, HZ + 480, W, H - HZ - 480);
    g.save(); g.globalCompositeOperation = "soft-light"; g.fillStyle = "rgba(90,130,150,0.35)"; g.fillRect(0, 0, W, H); g.restore();
  },
};

// ------------------------------------------------------------------------------------------------ Redoubt (tower defence)
export const TDART: TdArt = {
  paint(p, map, st) {
    const M = 3.5, base = ["#55585a", "#5e574b", "#6e695e", "#6a6b68", "#7b8084", "#66625c", "#575b5d", "#74787a", "#4c4f44", "#4a4846"][(map.act - 1) % 10];
    p.rect(-M, -M, map.w + M * 2, map.h + M * 2, base);
    p.mottle(-M, -M, map.w + M * 2, map.h + M * 2, shade(base, -0.25), { n: 160, size: [1, 3.2], alpha: 0.14 });
    p.mottle(-M, -M, map.w + M * 2, map.h + M * 2, shade(base, 0.22), { n: 160, size: [0.8, 2.6], alpha: 0.1 });
    p.mottle(-M, -M, map.w + M * 2, map.h + M * 2, shade(base, -0.4), { n: 1800, size: [0.04, 0.14], alpha: 0.22 });
    p.cracks(-M, -M, map.w + M * 2, map.h + M * 2, 40, rgba("#0c0c0c", 0.45), 0.03);
    const roads = map.paths.map((r) => r.pts.map((q) => [q.x, q.y] as Pt)), pts = roads.flat();
    for (const r of roads) p.line(r, shade(base, -0.55), ROAD_HALF * 2 + 0.24);
    for (const r of roads) p.line(r, "#3c3f41", ROAD_HALF * 2);
    for (const r of roads) { p.g.save(); p.g.setLineDash([0.5, 0.4]); p.line(r, "#d9d2b4", 0.07, 0.6); p.g.restore(); }
    for (const [q, rr, col] of [[map.keep, 2.0, TEAMS.tide.main], ...map.gates.map((gq) => [gq, 1.3, TEAMS.ember.main] as [typeof gq, number, string])] as [{ x: number; y: number }, number, string][]) {
      p.circle(q.x, q.y, rr, "#62666a"); p.circle(q.x, q.y, rr * 0.9, "#55595c");
      p.g.save(); p.g.strokeStyle = col; p.g.globalAlpha = 0.7; p.g.lineWidth = 0.08; p.g.setLineDash([0.4, 0.25]); p.g.beginPath(); p.g.ellipse(q.x, q.y, rr * 0.8, rr * 0.8, 0, 0, 6.283); p.g.stroke(); p.g.restore();
    }
    // build pads: a concrete hardstand with hazard corners
    for (const pad of map.pads) { p.round(pad.x - 0.56, pad.y - 0.56, 1.12, 1.12, 0.06, "#2a2d2f"); p.round(pad.x - 0.5, pad.y - 0.5, 1.0, 1.0, 0.04, "#7a7e7c"); for (const sx of [-1, 1]) for (const sy of [-1, 1]) p.line([[pad.x + sx * 0.44, pad.y + sy * 0.2], [pad.x + sx * 0.44, pad.y + sy * 0.44], [pad.x + sx * 0.2, pad.y + sy * 0.44]], "#c79a1e", 0.06, 0.8); }
    const free = (x: number, y: number, rad: number) => !near(pts, x, y, ROAD_HALF + rad + 0.3) && !map.pads.some((q) => Math.hypot(q.x - x, q.y - y) < 0.95 + rad) && Math.hypot(map.keep.x - x, map.keep.y - y) > 2.6 + rad && !map.gates.some((q) => Math.hypot(q.x - x, q.y - y) < 1.8 + rad);
    p.scatter(-M, -M, map.w + M * 2, map.h + M * 2, 14, (x, y) => { p.glow(x, y, 1.1, "#0a0a0a", 0.45, "source-over"); p.circle(x, y, 0.4, shade(base, -0.5), 0, 0.3); }, (x, y) => free(x, y, 0.5));
    const things: Build[] = [
      (m) => { m.group(() => m.box([0, 0, 0.3], [1.3, 0.55, 0.6], P.rust)); },
      (m) => { m.group(() => m.box([0, 0, 0.3], [1.3, 0.55, 0.6], P.armor)); },
      (m) => { for (const x of [-0.3, 0.3]) m.group(() => m.extrude([[-0.18, 0], [0.18, 0], [0.07, 0.18], [0.05, 0.45], [-0.05, 0.45], [-0.07, 0.18]], 0.55, P.concrete)), void x; },
      (m) => { for (const [x, y] of [[-0.2, -0.15], [0.2, -0.1], [0, 0.2]]) m.cylinder([x, y, 0], [x, y, 0.45], 0.17, P.armorDk, 0.17, { segs: 10 }); },
    ];
    const spots: { y: number; draw(): void }[] = [];
    for (let y = -M + 0.6; y < map.h + M; y += 2.2) for (let x = -M + 0.8 + (Math.round(y / 2.2) % 2) * 1.2; x < map.w + M; x += 2.6) {
      const qx = x + p.rand(-0.4, 0.4), qy = y + p.rand(-0.3, 0.3);
      if (!free(qx, qy, 0.8) || p.r() < 0.5) continue;
      const v = Math.floor(p.r() * things.length);
      spots.push({ y: qy, draw: () => st.model(p, things[v], qx, qy, { ppu: 60, yaw: v % 2 ? 74 : 106, el: 53.13, key: `td${v}`, shadow: 0.7 }) });
    }
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
  },
};
