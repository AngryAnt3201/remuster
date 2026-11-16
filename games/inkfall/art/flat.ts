// Inkfall's flat pictures: the effect sheets (ink splats, brush slashes, enso rings), the ten map pages, the home
// screen's hanging scroll and the Gatewatch grounds. All painted with art/ink.ts on bare paper.
import { ROAD_HALF } from "@engine/core/td/maps";
import type { MapArt, MapInfo, StampOpts, Stamps, TdArt, UiArt } from "../../../artkit/flat";
import { Painter, rgba, spline, type Pt } from "../../../artkit/paint";
import type { VfxArt } from "../../../artkit/vfx";
import type { Model } from "../../../artkit/toon3d";
import { SCENES, koiPond } from "./arenas";
import { TONE, blossom, dabs, dry, enso, line, mist, mountains, paper, pine2d, pool, seal, splatter, stroke, tuft, wash } from "./ink";
import { KEEPS } from "./keeps";
import { P, bombPot } from "./parts";
import { plum, standard, stoneLantern, torii } from "./scenery";
import { INK, PAPER } from "./style";

type Build = (m: Model) => void;
const keepModel = (boss: boolean): Build => (m) => KEEPS.build(m, { damage: 0, state: "intact", boss, skin: null });
const near = (pts: Pt[], x: number, y: number, d: number) => pts.some(([px, py]) => Math.hypot(px - x, py - y) < d);

// ------------------------------------------------------------------------------------------------ effects
// The base atlas is light: white-hot cores, glows, additive sparks. On pale paper light is invisible, so every sheet
// is turned into ink. Sheets the runtime tints are greyscale: their brightness becomes how thick the ink lies (alpha)
// and their grey is flattened to the level the runtime's gradient map turns into the pure tint, so a tinted sheet
// comes out as a wash of that tint (src/render/vfx.ts maps the game's tints to ink tones and draws every sheet with
// normal blending). Coloured sheets are greyed and darkened. A few sheets are repainted outright as brush marks.
let baseAtlas: HTMLImageElement | null = null, baseMan: { sheets: Record<string, { x: number; y: number; w: number; h: number; frames: number; cols: number; gap: number; tint: boolean }> } | null = null;
if (typeof Image !== "undefined") {
  baseAtlas = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = "/vfx/atlas.png"; });
  baseMan = await fetch("/vfx/atlas.json").then((r) => r.json()).catch(() => null);
}
/** Haze and light: thin washes, so a puff does not hide the unit under it. */
const SOFT: Record<string, number> = { aura: 0.5, disc: 0.4, dust: 0.5, smoke: 0.55, chill: 0.6, rage: 0.7, rally: 0.8, shield: 0.7, pillar: 0.7, vortex: 0.7, mirror: 0.7, soul: 0.8, shock: 0.75 };
/** Sheets that keep more of their own colour (healing is the one place celadon appears). */
const KEEP_HUE: Record<string, number> = { heal: 0.7, goo: 0.45, frost: 0.4, ice: 0.45, icebreak: 0.45, shard: 0.5, flame: 0.4, fireball: 0.35 };
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function inkify(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, name: string, tint: boolean) {
  const img = g.getImageData(x, y, w, h), d = img.data, soft = SOFT[name] ?? 1, hue = KEEP_HUE[name] ?? 0.22;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (!a) continue;
    const l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
    if (tint) {
      const v = 178 - 62 * l;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255 * Math.min(1, sm(0.04, 0.5, a * l) * 1.15) * soft;
    } else {
      // darker and greyer, leaning to ink: a bright core becomes a mid wash, a dark edge stays dark
      const k = 0.42 + 0.3 * (1 - l);
      for (let c = 0; c < 3; c++) { const v = l * 255 + (d[i + c] - l * 255) * hue * 1.6; d[i + c] = Math.max(0, Math.min(255, v * (1 - k) + [29, 26, 23][c] * k * 0.6)); }
      d[i + 3] = 255 * Math.min(1, a * 1.1) * soft;
    }
  }
  g.putImageData(img, x, y);
}
/** A little Painter the size of one effect cell (units = pixels), seeded per frame. */
function cell(g: CanvasRenderingContext2D, w: number, h: number, seed: number, fn: (p: Painter) => void) {
  const p = new Painter(0, 0, w, h, 1, { ink: INK, seed });
  fn(p);
  g.drawImage(p.canvas, 0, 0);
}
const TINT = "#b2b2b2"; // the grey the runtime's gradient map turns into the pure tint colour
const PAINT: NonNullable<VfxArt["paint"]> = {
  // a ring on the ground: one brushed circle, not quite closed
  ring: (g, _f, _n, w, h) => cell(g, w, h, 5, (p) => enso(p, w / 2, h / 2, w * 0.4, h * 0.4, w * 0.075, TINT, 1, -1.2, 5.6)),
  // an explosion: a blot that bursts into a splatter, then scatters as drops while a pale wash spreads
  fireball: (g, f, n, w, h) => cell(g, w, h, 11, (p) => {
    const t = f / (n - 1), cx = w / 2, cy = h / 2;
    if (t > 0.25) pool(p, cx, cy, w * (0.2 + 0.26 * t), h * (0.18 + 0.22 * t), TONE.mid, 0.34 * (1 - t), { bleed: 6, rim: 0.6 });
    if (t < 0.7) { const r = w * (0.12 + 0.34 * Math.min(1, t / 0.35)), a = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.3; splatter(p, cx, cy, r, INK, a, 14); }
    if (t > 0.2) { p.g.fillStyle = INK; for (let i = 0; i < 26; i++) { const an = i * 2.4 + 0.3, d = w * (0.16 + 0.32 * t) * (0.7 + 0.5 * ((i * 7) % 5) / 4), s = w * 0.022 * (1 - t * 0.6) * (0.6 + ((i * 3) % 4) / 3); p.g.globalAlpha = Math.max(0, 1 - Math.max(0, t - 0.55) / 0.45); p.g.beginPath(); p.g.ellipse(cx + Math.cos(an) * d, cy + Math.sin(an) * d * 0.9, s * 1.7, s, an, 0, Math.PI * 2); p.g.fill(); } }
    if (t < 0.18) { p.g.globalAlpha = 1; p.g.fillStyle = TONE.seal; p.g.beginPath(); p.g.arc(cx, cy, w * 0.035, 0, Math.PI * 2); p.g.fill(); }
  }),
  // a hit: a quick splat
  impact: (g, f, n, w, h) => cell(g, w, h, 21 + f, (p) => { const t = f / (n - 1); p.g.globalAlpha = 1; splatter(p, w / 2, h / 2, w * (0.16 + 0.26 * Math.min(1, t / 0.4)), TINT, t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5, 10); }),
};
const MODELS: NonNullable<VfxArt["models"]> = {
  // an arrow: a dark shaft, a pale steel head, white fletching
  arrow: (m) => { m.cylinder([-1.6, 0, 0], [1.3, 0, 0], 0.08, P.ink, 0.08, { segs: 5 }); m.cone([1.25, 0, 0], [1.9, 0, 0], 0.2, P.steel, { segs: 4 }); m.group(() => { for (const s of [1, -1]) m.poly([[-1.1, 0, 0], [-1.8, 0, s * 0.34], [-1.9, 0, 0]], P.white); }); },
  // the Great Bow's bolt: thicker, a broad head, a tag of paper streaming behind
  bolt: (m) => { m.cylinder([-1.7, 0, 0], [1.2, 0, 0], 0.11, P.ink, 0.11, { segs: 5 }); m.group(() => { m.cone([1.1, 0, 0], [1.95, 0, 0], 0.28, P.steel, { segs: 4 }); m.cone([1.2, 0, 0], [0.9, 0, 0], 0.28, P.steel, { segs: 4 }); }); m.poly([[-1.3, 0, 0.05], [-1.95, 0, 0.42], [-1.9, 0, 0.0]], P.white); },
  bomb: (m, f) => { m.with(() => { m.rotY(f * 90); bombPot(m, 0.3, f % 2 ? P.flame : P.ember); }); },
  // the Cask Runner's cask
  keg: (m, f) => { m.with(() => { m.rotY(f * 20 - 10); m.group(() => m.lathe([[0.24, -0.34], [0.33, -0.12], [0.33, 0.12], [0.24, 0.34]], P.wood, { smooth: true, segs: 10 })); m.decal(0.02, () => m.group(() => { for (const z of [-0.22, 0.22]) m.torus([0, 0, z], [0, 0, 1], 0.3, 0.035, P.rope, { segs: 10 }); })); m.sphere([0.04, 0, 0.5], 0.09, f % 2 ? P.flame : P.ember, { segs: 5 }); }); },
  // the Sky Mortar's shot: a black ball trailing a wash
  shell: (m) => { m.sphere([0.1, 0, 0], 0.3, P.ink, { segs: 8 }); m.capsule([-0.2, 0, 0.02], [-0.85, 0, 0.1], 0.16, P.mist, 0.03, { segs: 5 }); },
  shard: (m) => { m.cone([-0.2, 0, 0], [0.95, 0, 0], 0.26, P.frostDk, { segs: 4 }); m.cone([-0.2, 0, 0], [-0.9, 0, 0], 0.26, P.frost, { segs: 4 }); },
  pellet: (m) => { m.sphere([0, 0, 0], 0.26, P.splat, { segs: 6 }); },
};
export const VFX: VfxArt = {
  models: MODELS,
  paint: new Proxy(PAINT, {
    get(t, name: string) {
      if (name in t) return t[name];
      if (name in MODELS || !baseAtlas || !baseMan?.sheets[name]) return undefined;
      const sh = baseMan.sheets[name];
      return (g: CanvasRenderingContext2D, _f: number, _n: number, w: number, h: number) => {
        const tr = g.getTransform(), x = Math.round(tr.e), y = Math.round(tr.f);
        g.drawImage(baseAtlas!, x, y, w, h, 0, 0, w, h);
        inkify(g, x, y, w, h, name, sh.tint);
      };
    },
  }) as NonNullable<VfxArt["paint"]>,
};

// ------------------------------------------------------------------------------------------------ campaign maps
/** Stand a model in a painting. */
const put = (st: Stamps, p: Painter, build: Build, x: number, y: number, o: StampOpts) => st.model(p, build, x, y, o);

export const MAPS: MapArt = {
  paint(p: Painter, map: MapInfo, st: Stamps) {
    const sc = SCENES[map.index] ?? SCENES[0], id = map.id, u = 60;
    paper(p, 0, 0, map.w, map.h, u);
    // the land as a scroll: ranges of mountains stepping up the page with mist between, darkest at the top
    const rows = [1500, 1180, 880, 600, 330];
    rows.forEach((base, i) => {
      mountains(p, -60, map.w + 60, base, 150 + i * 34, sc.peaks[0], (0.2 + i * 0.09) * (0.6 + sc.peaks[1] * 0.6), { peaks: 3 + (i % 2), mist: 0.9 });
      mist(p, 0, map.w, base + 20, 60, 0.85);
    });
    const road = spline(map.path, 14);
    const full: Pt[] = [[map.camp[0], map.camp[1]], ...road, [map.boss[0], map.boss[1] + 40]];
    const blocked = (x: number, y: number, d: number) => near(full, x, y, d) || Math.hypot(x - map.camp[0], y - map.camp[1]) < 150 || Math.hypot(x - map.boss[0], y - map.boss[1]) < 200;
    // ponds where the road is not
    for (let i = 0, tries = 0; i < 3 && tries < 80; tries++) { const x = p.rand(90, map.w - 90), y = p.rand(300, map.h - 200); if (blocked(x, y, 150)) continue; koiPond(p, x, y, p.rand(60, 95), p.rand(34, 50), u); i++; }
    // the road: bare paper cleared through the washes, a tea-stain wash down it, a dry-brush edge each side
    p.line(full, rgba(PAPER, 0.9), 62);
    p.line(full, rgba(TONE.teaLt, 0.55), 46);
    for (const off of [-25, 25]) {
      const edge = full.map(([x, y], i) => { const a = full[Math.max(0, i - 1)], b = full[Math.min(full.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [x - (dy / l) * off, y + (dx / l) * off] as Pt; });
      for (let i = 0; i + 4 < edge.length; i += 4) dry(p, edge[i], edge[i + 4], 5, TONE.wet, 0.5, 3);
    }
    for (const [c, r] of [[map.camp, 100], [map.boss, 132]] as [Pt, number][]) { pool(p, c[0], c[1], r * 1.08, r * 0.76, PAPER, 0.9, { bleed: 10, rim: 0 }); pool(p, c[0], c[1], r, r * 0.7, TONE.teaLt, 0.4, { bleed: 6, rim: 0.4, jitter: 0.05 }); enso(p, c[0], c[1], r, r * 0.7, 11, INK, 0.7, p.rand(0, 6)); }
    // marks and scenery, sparse: most of the page is paper
    p.scatter(20, 140, map.w - 40, map.h - 170, 70, (x, y) => (sc.mark === "dabs" ? dabs(p, x, y, 9, sc.marks, 0.45) : tuft(p, x, y, 13, sc.marks, 0.5)), (x, y) => !blocked(x, y, 50));
    const all = [...sc.scatter, ...sc.side];
    const spots: { x: number; y: number; draw(): void }[] = [];
    for (let i = 0, tries = 0; i < 26 && tries < 1200; tries++) {
      const x = p.rand(30, map.w - 30), y = p.rand(150, map.h - 40);
      if (blocked(x, y, 92) || spots.some((s) => Math.abs(s.y - y) < 70 && Math.abs(s.x - x) < 110)) continue;
      const v = Math.floor(p.r() * all.length);
      spots.push({ x, y, draw: () => put(st, p, all[v], x, y, { ppu: 52, yaw: v % 2 ? 72 : 108, el: 40, key: `${id}s${v}` }) });
      i++;
    }
    const lx = map.boss[0] + (map.boss[0] > map.w / 2 ? -250 : 250);
    spots.push({ x: lx, y: map.boss[1] - 40, draw: () => put(st, p, sc.far[2], lx, map.boss[1] - 40, { ppu: 78, yaw: 80, el: 40 }) });
    spots.push({ x: 0, y: map.boss[1], draw: () => put(st, p, keepModel(true), map.boss[0], map.boss[1], { ppu: 84, yaw: 90, el: 46, team: "ember" }) });
    spots.push({ x: 0, y: map.camp[1], draw: () => put(st, p, keepModel(false), map.camp[0], map.camp[1], { ppu: 64, yaw: 90, el: 46, team: "tide" }) });
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    // petals drifting down the page on the temple acts, and the painter's seal in a bottom corner
    if (map.index === 4 || map.index === 0) for (let i = 0; i < 40; i++) blossom(p, p.rand(0, map.w), p.rand(100, map.h), p.rand(5, 9), i % 3 ? TONE.petal : "#f6d2ca", 0.8);
    seal(p, map.camp[0] > map.w / 2 ? 70 : map.w - 70, map.h - 80, 62, TONE.seal, 3 + (map.index % 3));
  },
};

// ------------------------------------------------------------------------------------------------ key art
export const UI: UiArt = {
  titleKey(p, st) {
    // A hanging scroll. The home screen shows the whole picture and its buttons cover everything below about 60% of
    // the height: a red sun and far ranges above, the hall on a rise at the horizon (44%), the clan drawn up in front
    // of it between 45% and 60%, and bare paper below.
    const W = 1206, H = 2622, HZ = 1150, u = 80;
    paper(p, 0, 0, W, H, u);
    // the sun: a disc of seal red, low behind the far range
    p.g.save(); p.g.globalAlpha = 0.9; p.g.fillStyle = TONE.seal; p.g.beginPath(); p.g.arc(330, 590, 150, 0, Math.PI * 2); p.g.fill(); p.g.restore();
    pool(p, 330, 590, 168, 168, TONE.seal, 0.12, { bleed: 18, rim: 0 });
    mountains(p, -80, W + 80, 900, 420, TONE.mid, 0.34, { peaks: 3, mist: 0.92 });
    mist(p, 0, W, 900, 90, 0.9);
    mountains(p, -80, W + 80, 1040, 330, TONE.wet, 0.5, { peaks: 4, mist: 0.9 });
    mist(p, 0, W, 1050, 70, 0.92);
    // a flight of cranes and a kite in the empty sky
    for (const [x, y, s, tm] of [[720, 330, 150, "tide"], [900, 240, 110, "tide"], [560, 250, 90, "tide"]] as [number, number, number, "tide"][]) st.unit(p, "harrier", 2, x, y, { ppu: s, yaw: 150, el: 26, anim: "walk", frame: (x >> 3) % 6, team: tm });
    st.unit(p, "griffin", 3, 990, 560, { ppu: 150, yaw: 150, el: 24, anim: "walk", frame: 2 });
    // the near ridge: a dark wash rising to the hall's hill, pines along it
    mountains(p, -80, W + 80, HZ + 60, 190, INK, 0.62, { peaks: 3, rough: 0.2, mist: 0.96 });
    wash(p, [[-40, HZ + 40], [300, HZ - 6], [620, HZ - 36], [900, HZ - 4], [W + 40, HZ + 50], [W + 40, HZ + 520], [-40, HZ + 520]], TONE.teaLt, 0.3, { bleed: 16, rim: 0.3 });
    for (const [x, y, s, ln] of [[70, HZ + 70, 330, 0.3], [230, HZ + 20, 230, 0.16], [1150, HZ + 80, 360, -0.28], [1010, HZ + 16, 220, -0.14]]) pine2d(p, x, y, s, ln, INK, 0.92);
    const side: [Build, number, number, number, number][] = [[(m) => torii(m, 1), 960, HZ + 110, 120, 150], [(m) => stoneLantern(m, 1), 200, HZ + 170, 130, 80], [(m) => standard(m, 1), 400, HZ + 40, 140, 90], [(m) => standard(m, 1), 820, HZ + 40, 140, 90]];
    side.sort((a, b) => a[2] - b[2]).forEach(([b, x, y, ppu, yaw]) => put(st, p, b, x, y, { ppu, yaw, el: 22, team: "tide", shadow: 0.4 }));
    put(st, p, keepModel(false), 610, HZ + 40, { ppu: 190, yaw: 90, el: 28, team: "tide" });
    // the clan, drawn up in two ranks with room between the figures
    const cast: [string, number, number, number, number, number][] = [["golem", 3, 120, HZ + 330, 190, 62], ["lancer", 3, 1070, HZ + 330, 200, 124], ["banner", 3, 330, HZ + 300, 215, 74], ["storm", 3, 890, HZ + 300, 215, 110], ["pikeman", 3, 210, HZ + 450, 240, 64], ["ranger", 3, 1000, HZ + 455, 240, 116], ["bulwark", 3, 420, HZ + 440, 250, 70], ["medic", 3, 810, HZ + 450, 240, 108], ["lion", 4, 615, HZ + 480, 290, 90]];
    for (const [kind, tier, x, y, ppu, yaw] of cast) st.unit(p, kind, tier, x, y, { ppu, yaw, el: 22, shadow: 0.3 });
    // a plum branch reaching in from the top right corner
    const g = p.g;
    const br: Pt[] = [[W + 30, 60], [1020, 150], [860, 130], [720, 210], [600, 190]];
    stroke(p, br, 46, INK, 0.94, { taper: 0.82, dry: 0.3, lead: 0.05 });
    for (const [a, b, c] of [[[1040, 146], [980, 260], [900, 330]], [[870, 132], [830, 60], [740, 30]], [[760, 190], [720, 300], [640, 350]], [[1100, 110], [1130, 220], [1090, 320]]] as [Pt, Pt, Pt][]) stroke(p, [a, b, c], 20, INK, 0.9, { taper: 0.85, dry: 0.4, lead: 0.05 });
    for (let i = 0; i < 46; i++) { const t = p.r(), k = Math.floor(t * (br.length - 1)), a = br[k], b = br[k + 1], f = t * (br.length - 1) - k; blossom(p, a[0] + (b[0] - a[0]) * f + p.rand(-90, 90), a[1] + (b[1] - a[1]) * f + p.rand(-20, 150), p.rand(13, 24), i % 4 ? TONE.petal : "#f6d2ca", 0.92); }
    for (let i = 0; i < 26; i++) blossom(p, p.rand(60, W - 60), p.rand(300, HZ + 500), p.rand(6, 11), TONE.petal, 0.7);
    void g;
    // the buttons cover the bottom: let the picture run out into bare paper
    const fade = p.g.createLinearGradient(0, HZ + 520, 0, HZ + 900);
    fade.addColorStop(0, rgba(PAPER, 0)); fade.addColorStop(1, rgba(PAPER, 1));
    p.g.fillStyle = fade; p.g.fillRect(0, HZ + 520, W, H - HZ - 520);
    void line;
  },
};

// ------------------------------------------------------------------------------------------------ gatewatch (tower defence)
export const TDART: TdArt = {
  paint(p, map, st) {
    const M = 3.5, sc = SCENES[(map.act - 1) % SCENES.length];
    paper(p, -M, -M, map.w + M * 2, map.h + M * 2, 1);
    wash(p, [[-0.6, -0.6], [map.w + 0.6, -0.6], [map.w + 0.6, map.h + 0.6], [-0.6, map.h + 0.6]], sc.field[0], sc.field[1] * 0.8, { bleed: 0.4, rim: 0.4, smooth: false });
    const roads = map.paths.map((r) => r.pts.map((q) => [q.x, q.y] as Pt));
    for (const r of roads) p.line(r, rgba(PAPER, 0.95), ROAD_HALF * 2 + 0.2);
    for (const r of roads) p.line(r, rgba(TONE.teaLt, 0.6), ROAD_HALF * 2 - 0.06);
    for (const r of roads) for (const off of [-ROAD_HALF, ROAD_HALF]) for (let i = 0; i + 1 < r.length; i++) {
      const a = r[i], b = r[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * off, ny = (dx / l) * off;
      dry(p, [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], 0.09, TONE.wet, 0.55, 4);
    }
    const pts = roads.flat();
    for (const [q, rr] of [[map.keep, 2.0], ...map.gates.map((gq) => [gq, 1.3] as [typeof gq, number])] as [{ x: number; y: number }, number][]) {
      pool(p, q.x, q.y, rr * 1.06, rr * 1.06, PAPER, 0.92, { bleed: 0.14, rim: 0 });
      pool(p, q.x, q.y, rr, rr, TONE.teaLt, 0.4, { bleed: 0.1, rim: 0.4, jitter: 0.04 });
      enso(p, q.x, q.y, rr, rr, 0.16, INK, 0.7, p.rand(0, 6));
    }
    // build pads: a small brushed ring on a clean patch
    for (const pad of map.pads) { pool(p, pad.x, pad.y, 0.6, 0.6, PAPER, 0.95, { bleed: 0.06, rim: 0, jitter: 0.04 }); pool(p, pad.x, pad.y, 0.5, 0.5, TONE.pale, 0.35, { bleed: 0.04, rim: 0.5, jitter: 0.04 }); enso(p, pad.x, pad.y, 0.52, 0.52, 0.08, TONE.wet, 0.8, p.rand(0, 6)); }
    const free = (x: number, y: number, rad: number) => !near(pts, x, y, ROAD_HALF + rad + 0.3) && !map.pads.some((q) => Math.hypot(q.x - x, q.y - y) < 0.95 + rad) && Math.hypot(map.keep.x - x, map.keep.y - y) > 2.6 + rad && !map.gates.some((q) => Math.hypot(q.x - x, q.y - y) < 1.9 + rad);
    p.scatter(-M, -M, map.w + M * 2, map.h + M * 2, 120, (x, y) => (sc.mark === "dabs" ? dabs(p, x, y, 0.14, sc.marks, 0.4) : tuft(p, x, y, 0.2, sc.marks, 0.45)), (x, y) => free(x, y, 0.1));
    const all = [...sc.side, ...sc.scatter];
    const spots: { y: number; draw(): void }[] = [];
    for (let y = -M + 0.6; y < map.h + M; y += 2.2) for (let x = -M + 0.8 + (Math.round(y / 2.2) % 2) * 1.2; x < map.w + M; x += 2.6) {
      const qx = x + p.rand(-0.4, 0.4), qy = y + p.rand(-0.3, 0.3);
      if (!free(qx, qy, 0.8) || p.r() < 0.45) continue;
      const v = Math.floor(p.r() * all.length);
      spots.push({ y: qy, draw: () => put(st, p, all[v], qx, qy, { ppu: 60, yaw: v % 2 ? 74 : 106, el: 53.13, key: `td${map.act}s${v}` }) });
    }
    spots.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    void plum;
  },
};
