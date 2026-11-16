// The art kit (artkit/): the toon renderer, rigs and atlas packing, and the completeness check that holds every
// game's baked art (games/*/public) to the contract the runtime's loaders need.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BODY_EXTRA, UNITS } from "../engine/core/defs";
import { ATLAS, bakeSheet, indexSheet, shelfPack } from "../artkit/atlas";
import { checkGameArt, gamesWithArt } from "../artkit/check";
import { shoot } from "../artkit/looks";
import { ATTACK_BLEND, CLIPS, IMPACT, Pose, clipPoses, humanoid, step, structure, type UnitDef } from "../artkit/rig";
import { DEFAULT_STYLE, Model, WHITE_TEAM, bounds, earclip, mat, render, team, trim, type Style, type TeamCols } from "../artkit/toon3d";
import { decodePalette, tintIndexed, tintMasked, tintPalette } from "../base/src/render/sprites";
import baseManifest from "../base/public/atlas/manifest.json";

const ROOT = join(__dirname, "..");
const TIDE: TeamCols = { main: "#2fc8b6", dark: "#157a73", light: "#a9fff0" }, EMBER: TeamCols = { main: "#f5623f", dark: "#a32f1e", light: "#ffc7b0" };
const px = (d: Uint8ClampedArray, w: number, x: number, y: number) => [...d.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];
const opts = { yaw: 45, el: 53.3, ppu: 96, style: DEFAULT_STYLE, teams: [TIDE, EMBER] };

describe("toon renderer", () => {
  it("draws a model with an ink outline, an anchor at its feet, and one image per team", () => {
    const m = new Model();
    m.sphere([0, 0, 0.3], 0.3, team("main"));
    const s = render(m, opts);
    expect(s.data).toHaveLength(2);
    const b = bounds(s.data[0], s.w, s.h)!;
    expect(b[2]).toBeGreaterThan(55);
    expect(s.ax).toBeGreaterThan(b[0]);
    expect(s.ax).toBeLessThan(b[0] + b[2]);
    // the middle of the ball is team coloured: teal for one team, red for the other
    const cx = Math.round(s.ax), cy = Math.round(s.ay - 0.3 * 96 * Math.cos((53.3 * Math.PI) / 180));
    const [r0, g0] = px(s.data[0], s.w, cx, cy), [r1, g1] = px(s.data[1], s.w, cx, cy);
    expect(g0).toBeGreaterThan(r0);
    expect(r1).toBeGreaterThan(g1);
    // the outermost opaque pixel on the middle row is ink
    const row = b[1] + (b[3] >> 1);
    let x = b[0];
    while (s.data[0][(row * s.w + x) * 4 + 3] < 250) x++;
    const [r, g, bl] = px(s.data[0], s.w, x + 1, row);
    expect(r + g + bl).toBeLessThan(200);
  });

  it("sorts by depth per pixel, whatever order parts are added in", () => {
    const near = mat("#ff0000", { shade: 0 }), far = mat("#0000ff", { shade: 0 });
    const build = (nearFirst: boolean) => {
      const m = new Model();
      const a = () => m.sphere([0, 0.5, 0.3], 0.2, near), b = () => m.box([0, -0.2, 0.3], [0.9, 0.2, 0.6], far);
      if (nearFirst) { a(); b(); } else { b(); a(); }
      return render(m, { ...opts, yaw: 0, teams: [TIDE], style: { ...DEFAULT_STYLE, rim: { ...DEFAULT_STYLE.rim, strength: 0 } } });
    };
    const s1 = build(true), s2 = build(false);
    expect([...s1.data[0]]).toEqual([...s2.data[0]]);
    // the ball stands in front of the wall: red over blue somewhere in the picture
    let red = 0;
    for (let i = 0; i < s1.data[0].length; i += 4) if (s1.data[0][i] > 200 && s1.data[0][i + 2] < 60) red++;
    expect(red).toBeGreaterThan(200);
  });

  it("renders the same bytes every time", () => {
    const m = new Model();
    m.capsule([0, 0, 0.1], [0.2, 0.1, 0.6], 0.1, mat("#c8873a", { metal: 0.7 }));
    m.cylinder([0, 0, 0], [0, 0, 0.2], 0.3, team("dark"));
    expect([...render(m, opts).data[1]]).toEqual([...render(m, opts).data[1]]);
  });

  it("gives glowing parts a halo and trims to the drawn pixels", () => {
    const plain = new Model(), lit = new Model();
    plain.sphere([0, 0, 0.3], 0.2, mat("#ffd27a"));
    lit.sphere([0, 0, 0.3], 0.2, mat("#ffd27a", { emit: 1, glow: 1 }));
    const a = trim(render(plain, opts)), b = trim(render(lit, opts));
    expect(b.w).toBeGreaterThan(a.w + 3);
    expect(a.data[0][3]).toBeDefined();
  });

  it("writes a team mask the runtime can tint", () => {
    const m = new Model();
    m.box([0, 0, 0.2], [0.4, 0.4, 0.4], team("main", { shade: 0 }));
    m.box([0.5, 0, 0.2], [0.3, 0.3, 0.4], mat("#804020", { shade: 0 }));
    const s = render(m, { ...opts, yaw: 0, teams: [WHITE_TEAM], mask: true, style: { ...DEFAULT_STYLE, rim: { ...DEFAULT_STYLE.rim, strength: 0 }, grade: undefined } });
    expect(s.data).toHaveLength(2);
    const src = new Uint8ClampedArray(s.w * s.h * 8);
    src.set(s.data[0]); src.set(s.data[1], s.w * s.h * 4);
    const out = new Uint8ClampedArray(s.w * s.h * 4);
    tintMasked(src, EMBER, out);
    let teamPx = 0, brown = 0;
    for (let i = 0; i < out.length; i += 4) {
      if (out[i] === 0xf5 && out[i + 1] === 0x62 && out[i + 2] === 0x3f) teamPx++;
      if (out[i] === 0x80 && out[i + 1] === 0x40 && out[i + 2] === 0x20) brown++;
    }
    expect(teamPx).toBeGreaterThan(300);
    expect(brown).toBeGreaterThan(150);
  });

  it("triangulates concave outlines", () => {
    const L: [number, number][] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
    const tris = earclip(L);
    const area = tris.reduce((s, [a, b, c]) => s + Math.abs((L[b][0] - L[a][0]) * (L[c][1] - L[a][1]) - (L[b][1] - L[a][1]) * (L[c][0] - L[a][0])) / 2, 0);
    expect(tris).toHaveLength(4);
    expect(area).toBeCloseTo(3, 6);
  });

  it("has looks that change the feel without touching the model", () => {
    const m = new Model();
    m.sphere([0, 0, 0.3], 0.3, mat("#c8873a"));
    const base = shoot(m, { ...opts, teams: [TIDE] });
    const pixel = shoot(m, { ...opts, teams: [TIDE], style: { ...DEFAULT_STYLE, look: { kind: "pixel", scale: 4 } } });
    const neon = shoot(m, { ...opts, teams: [TIDE], style: { ...DEFAULT_STYLE, look: { kind: "neon" } } });
    const paper = shoot(m, { ...opts, teams: [TIDE], style: { ...DEFAULT_STYLE, look: { kind: "paper" } } });
    // pixel: blocks of 4 x 4 identical pixels
    expect(pixel.w % 4).toBe(0);
    const mid = ((pixel.h >> 1) & ~3) * pixel.w + ((pixel.w >> 1) & ~3);
    expect(px(pixel.data[0], pixel.w, mid % pixel.w, Math.floor(mid / pixel.w))).toEqual(px(pixel.data[0], pixel.w, (mid % pixel.w) + 3, Math.floor(mid / pixel.w) + 3));
    // neon: a dark fill; paper: a pale one
    const lum = (s: typeof base) => { const c = px(s.data[0], s.w, Math.round(s.ax), Math.round(s.ay - 20)); return c[0] + c[1] + c[2]; };
    expect(lum(neon)).toBeLessThan(lum(base) * 0.5);
    expect(lum(paper)).toBeGreaterThan(lum(base));
  });
});

describe("rigs and clips", () => {
  it("plans the clips the atlas contract asks for", () => {
    expect(CLIPS).toEqual(baseManifest.anims);
    expect(IMPACT).toBe(baseManifest.impact.attack);
    expect(ATLAS.dirs).toEqual(baseManifest.dirs);
    expect(ATLAS.dir8).toEqual(baseManifest.dir8);
    expect(ATLAS.el).toBe(baseManifest.el);
    expect(ATTACK_BLEND).toHaveLength(CLIPS.attack);
    // the wind-up comes before the blow, the blow lands on the impact frame
    expect(ATTACK_BLEND.slice(0, IMPACT).every((b) => b < 0)).toBe(true);
    expect(ATTACK_BLEND[IMPACT]).toBeGreaterThanOrEqual(1);
    expect(clipPoses("x", 1, "attack")[IMPACT].hit).toBe(true);
    expect(clipPoses("x", 1, "walk")).toHaveLength(8);
  });

  it("keeps a planted foot still on the ground: it slides back at exactly the body's speed", () => {
    const S = 0.4;
    // through the stance half the foot moves -S per cycle (the body moves +S), linearly
    for (let k = 0; k < 10; k++) {
      const a = step(k * 0.05, S, 0.1), b = step(k * 0.05 + 0.05, S, 0.1);
      if (k * 0.05 + 0.05 <= 0.5) { expect(b[0] - a[0]).toBeCloseTo(-S * 0.05, 9); expect(a[1]).toBe(0); }
    }
    // the swing lifts the foot and puts it back where the stance starts
    expect(step(0.75, S, 0.1)[1]).toBeCloseTo(0.1, 6);
    expect(step(0.9999, S, 0.1)[0]).toBeCloseTo(step(0, S, 0.1)[0], 2);
  });

  it("blends rest, wind-up and strike poses", () => {
    const wind = new Pose("x", 1, "attack", 1, 6), hit = new Pose("x", 1, "attack", IMPACT, 6), idle = new Pose("x", 1, "idle", 2, 6);
    expect(wind.mix(0, 10, { wind: -4 })).toBe(-4);
    expect(hit.mix(0, 10, { wind: -4 })).toBe(10);
    expect(idle.mix(0, 10, { wind: -4 })).toBe(0);
    expect(hit.mix([0, 0, 0], [1, 2, 3])).toEqual([1, 2, 3]);
    const cast = new Pose("x", 1, "cast", IMPACT, 6);
    expect(cast.mix(0, 10, { cast: 7 })).toBe(7);
  });

  it("hands a builder frames that follow the body: a weapon stays in the hand through the swing", () => {
    const skin = mat("#f1c49c");
    for (const p of clipPoses("x", 1, "attack")) {
      const m = new Model();
      const target = p.mix<[number, number, number]>([0.14, 0.2, 0.38], [0.32, 0.08, 0.3], { wind: [-0.04, 0.24, 0.68] });
      const h = humanoid(m, p, { skin, torso: skin, legs: skin, boots: skin, handR: target });
      const f = h.aim("R", [1, 0, 0]);
      expect([f[3], f[7], f[11]]).toEqual(h.pR);
      expect(m.triangles).toBeGreaterThan(500);
    }
  });
});

describe("atlas baking", () => {
  const soldier: UnitDef = {
    weight: "mid", cast: true,
    build(m, p) { const s = mat("#f1c49c"); humanoid(m, p, { skin: s, torso: team("main"), legs: mat("#4a4652"), boots: mat("#5a3620"), size: 0.6 }); },
  };
  const post: UnitDef = { weight: "heavy", fixed: true, build(m, p) { const s = structure(m, p); m.at(s.top, () => m.cylinder([0, 0, 0], [0, 0, 0.3], 0.12, team("main"))); } };
  const small: Style = { ...DEFAULT_STYLE, outline: 2 };

  it("packs every clip and facing into one sheet in the runtime's layout", () => {
    const sheet = bakeSheet(soldier, "soldier", 1, small, render, 48);
    const a = sheet.meta.anims as Record<string, number[][][]>;
    for (const [clip, n] of Object.entries(CLIPS)) {
      expect(a[clip]).toHaveLength(ATLAS.dirs.length);
      for (const frames of a[clip]) {
        expect(frames).toHaveLength(n);
        for (const [x, y, w, h] of frames) expect(x >= 0 && y >= 0 && x + w <= sheet.meta.w && y + h <= sheet.meta.h).toBe(true);
      }
    }
    expect(a.death[0][0][6]).toBe(ATLAS.deathScale);
    expect(sheet.meta.stride).toBeGreaterThan(0.1);
    expect(sheet.pixels.length).toBe(sheet.meta.w * sheet.meta.h * 2 * 4);
  });

  it("aliases walk to idle for fixed bodies and leaves out the cast clip when there is none", () => {
    const sheet = bakeSheet(post, "post", 1, small, render, 48);
    expect(sheet.meta.anims.walk).toBe("idle");
    expect(sheet.meta.anims.cast).toBeUndefined();
    expect(sheet.meta.stride).toBe(0);
  });

  it("indexes a sheet to a palette the base loader tints per team", () => {
    const sheet = bakeSheet(post, "post", 1, small, render, 48);
    const { pal, idx } = indexSheet(sheet.pixels, sheet.meta.w, sheet.meta.h, 64);
    expect(pal.length % 7).toBe(0);
    expect(pal.length / 7).toBeLessThanOrEqual(65);
    expect(pal[3]).toBe(0);
    const b64 = Buffer.from(pal).toString("base64");
    const out = new Uint8ClampedArray(idx.length);
    tintIndexed(idx, tintPalette(decodePalette(b64), EMBER), out);
    // some pixels come out in the team's red, none in the neutral white they were rendered in
    let red = 0, white = 0;
    for (let i = 0; i < out.length; i += 4) { if (out[i + 3] < 250) continue; if (out[i] > 200 && out[i + 1] < 130 && out[i + 2] < 100) red++; if (out[i] > 240 && out[i + 1] > 240 && out[i + 2] > 240) white++; }
    expect(red).toBeGreaterThan(100);
    expect(white).toBe(0);
  });

  it("packs frames without overlap", () => {
    const sizes: [number, number][] = Array.from({ length: 40 }, (_, i) => [20 + ((i * 37) % 50), 30 + ((i * 53) % 40)]);
    const { pos, w, h } = shelfPack(sizes);
    for (let i = 0; i < sizes.length; i++) {
      expect(pos[i][0] + sizes[i][0]).toBeLessThanOrEqual(w);
      expect(pos[i][1] + sizes[i][1]).toBeLessThanOrEqual(h);
      for (let j = 0; j < i; j++) {
        const sep = pos[i][0] + sizes[i][0] <= pos[j][0] || pos[j][0] + sizes[j][0] <= pos[i][0] || pos[i][1] + sizes[i][1] <= pos[j][1] || pos[j][1] + sizes[j][1] <= pos[i][1];
        expect(sep).toBe(true);
      }
    }
  });
});

describe("baked game art", () => {
  const games = gamesWithArt(ROOT);
  it("keeps the loaders' contract in every game that ships art", () => {
    for (const g of games) {
      const rep = checkGameArt(ROOT, g);
      if (rep.missing.length) console.log(`${g}: ${rep.missing.length} pieces of art not supplied (the base game's show instead):\n  ${rep.missing.slice(0, 12).join("\n  ")}${rep.missing.length > 12 ? "\n  ..." : ""}`);
      expect(rep.errors, g).toEqual([]);
    }
  });

  it.runIf(existsSync(join(ROOT, "games", "brasswick", "public")))("Brasswick is complete: every body, tier, clip, arena, keep, effect, portrait, map and backdrop", () => {
    const rep = checkGameArt(ROOT, "brasswick");
    expect(rep.errors).toEqual([]);
    expect(rep.missing).toEqual([]);
    expect(Object.keys(UNITS).length + Object.keys(BODY_EXTRA).length).toBe(37);
    expect(rep.bytes).toBeLessThan(48e6);
  });
});
