import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BODY_EXTRA, UNITS } from "../engine/core/defs";
import { TILT, mirror8 } from "../base/src/render/camera";
import { clipIndex, decodePalette, tintIndexed, tintPalette, type Manifest } from "../base/src/render/sprites";
import { animFor, idleJitter } from "../base/src/render/units";

const DIR = join(__dirname, "..", "base", "public", "atlas");
const man = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) as Manifest;
const ANIMS = ["idle", "walk", "attack", "death"] as const;
/** Kinds with a special move (art/muster_art/style.py CAST). */
const FLYING = ["harrier", "griffin"];
const CAST = ["medic", "grave", "tinker", "trickster", "lamp", "hook", "banner", "lion", "duelist", "pikeman"];

/** WebP width and height (lossless VP8L or extended VP8X). */
function webpSize(file: string) {
  const b = readFileSync(file);
  expect(b.toString("ascii", 0, 4) + b.toString("ascii", 8, 12)).toBe("RIFFWEBP");
  const fourcc = b.toString("ascii", 12, 16);
  if (fourcc === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (fourcc === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  throw new Error(`${file}: unexpected ${fourcc}`);
}

describe("character atlases", () => {
  it("cover every unit at tiers 1 to 4 and every spawned body at tier 1", () => {
    for (const k of Object.keys(UNITS)) expect(man.units[k]?.tiers, k).toEqual([1, 2, 3, 4]);
    for (const k of Object.keys(BODY_EXTRA)) expect(man.units[k]?.tiers, k).toEqual([1]);
  });

  it("match the diorama camera: same pitch, same mirrored facings", () => {
    expect(Math.abs(man.el - (90 - (TILT * 180) / Math.PI))).toBeLessThan(0.1);
    // Rendered facings, in screen 8-way terms (0 right, 1 down-right, 2 down, 7 up-right, 6 up).
    const rendered = man.dirs.map((deg) => ((Math.round(deg / 45) % 8) + 8) % 8);
    for (let d = 0; d < 8; d++) {
      const [di, flip] = man.dir8[d];
      const m = mirror8(d);
      expect(rendered[di], `facing ${d}`).toBe(m.frame);
      expect(flip, `facing ${d}`).toBe(m.flip);
    }
  });

  it("hold every facing and animation frame inside its sheet, with the anchor inside the frame", () => {
    for (const [key, sh] of Object.entries(man.sheets)) {
      expect(webpSize(join(DIR, `${key}.webp`)), key).toEqual({ w: sh.w, h: sh.h });
      const kind = key.split("_t")[0];
      const anims = [...ANIMS, ...(CAST.includes(kind) ? (["cast"] as const) : [])];
      expect(!!sh.anims.cast, `${key} cast`).toBe(CAST.includes(kind));
      for (const a of anims) {
        // Bodies that never move alias walk to idle, so they hold the target animation's frame count.
        let list = sh.anims[a], src: string = a;
        if (typeof list === "string") list = sh.anims[(src = list)];
        expect(Array.isArray(list), `${key} ${a}`).toBe(true);
        const dirs = list as number[][][];
        expect(dirs.length, `${key} ${a}`).toBe(man.dirs.length);
        for (const frames of dirs) {
          expect(frames.length, `${key} ${a}`).toBe(man.anims[src as (typeof ANIMS)[number]]);
          for (const [x, y, w, h, ax, ay, s] of frames) {
            expect(x >= 0 && y >= 0 && x + w <= sh.w && y + h <= sh.h, `${key} ${a} rect`).toBe(true);
            // a body toppling away from the camera can lie wholly beyond its feet, so the anchor may sit just below the frame
            expect(ax >= -w && ax <= 2 * w && ay >= -0.25 * h && ay <= h * 1.5, `${key} ${a} anchor`).toBe(true);
            if (s !== undefined) expect(s > 0.3 && s < 1, `${key} ${a} scale`).toBe(true);
          }
        }
      }
    }
  });

  it("evolve visibly: each unit's Ascended figure stands out from its Recruit", () => {
    const size = (key: string) => {
      const f = (man.sheets[key].anims.idle as number[][][])[1][0];
      return f[2] * f[3];
    };
    for (const k of Object.keys(UNITS)) expect(size(`${k}_t4`), k).toBeGreaterThan(size(`${k}_t1`) * 1.15);
  });

  it("give every clip its frames: idle 6+, walk 8+, attack 6-8 with a wind-up before the blow, death 6+, cast 6", () => {
    expect(man.anims.idle).toBeGreaterThanOrEqual(6);
    expect(man.anims.walk).toBeGreaterThanOrEqual(8);
    expect(man.anims.attack).toBeGreaterThanOrEqual(6);
    expect(man.anims.attack).toBeLessThanOrEqual(8);
    expect(man.anims.death).toBeGreaterThanOrEqual(6);
    expect(man.anims.cast).toBeGreaterThanOrEqual(6);
    expect(man.impact?.attack).toBeGreaterThanOrEqual(2);
    for (const [key, sh] of Object.entries(man.sheets)) {
      expect(["heavy", "mid", "light"], key).toContain(sh.weight);
      // ground walkers carry their stride (the runtime's walk cadence); fliers flap at a set beat
      if (sh.anims.walk !== "idle" && !FLYING.includes(key.split("_t")[0])) expect(sh.stride, `${key} stride`).toBeGreaterThan(0.1);
    }
  });

  it("stay small enough for the app budget (base/public/atlas under 45 MB, no stray files)", () => {
    let total = 0;
    for (const f of readdirSync(DIR)) total += statSync(join(DIR, f)).size;
    expect(total).toBeLessThan(45e6);
    expect(existsSync(join(DIR, "manifest.json"))).toBe(true);
    const want = new Set([...Object.keys(man.sheets).map((k) => `${k}.webp`), "manifest.json"]);
    expect(readdirSync(DIR).filter((f) => !want.has(f))).toEqual([]);
  });
});

describe("team tint", () => {
  it("tints white team parts to the team colour through the palette and leaves unmasked entries alone", () => {
    // entry 0 clear, 1 white team main, 2 a brown unmasked pixel, 3 white half team light
    const pal = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 100, 50, 25, 200, 0, 0, 0, 255, 255, 255, 255, 0, 0, 128]);
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const tide = tintPalette(pal, man.teams.tide), red = tintPalette(pal, { main: "#ff0000", dark: "#000000", light: "#ffffff" });
    expect([...tide.slice(4, 7)]).toEqual(hex(man.teams.tide.main));
    expect([...red.slice(4, 8)]).toEqual([255, 0, 0, 255]);
    expect([...tide.slice(8, 12)]).toEqual([100, 50, 25, 200]);
    expect([...tide.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    const idx = new Uint8ClampedArray([1, 1, 1, 255, 0, 0, 0, 255, 2, 2, 2, 255]);
    const out = new Uint8ClampedArray(12);
    tintIndexed(idx, red, out);
    expect([...out]).toEqual([255, 0, 0, 255, 0, 0, 0, 0, 100, 50, 25, 200]);
  });

  it("decodes every sheet's palette: 7 bytes an entry, at most 256, entry 0 clear", () => {
    for (const [key, sh] of Object.entries(man.sheets)) {
      const pal = decodePalette(sh.pal);
      expect(pal.length % 7, key).toBe(0);
      expect(pal.length / 7, key).toBeLessThanOrEqual(256);
      expect(pal[3], key).toBe(0);
    }
  });
});

describe("clip timing", () => {
  it("plays the wind-up frames before the blow and the rest after it", () => {
    // 7 frames, blow on frame 2
    expect(clipIndex("attack", 7, -1, 2)).toBe(0);
    expect(clipIndex("attack", 7, -0.4, 2)).toBe(1);
    expect(clipIndex("attack", 7, 0, 2)).toBe(2);
    expect(clipIndex("attack", 7, 0.5, 2)).toBe(4);
    expect(clipIndex("attack", 7, 0.99, 2)).toBe(6);
    expect(clipIndex("attack", 7, 3, 2)).toBe(6);
    expect(clipIndex("walk", 8, 1.25)).toBe(2);
    expect(clipIndex("idle", 6, -0.1)).toBe(5);
    expect(clipIndex("death", 6, 1)).toBe(5);
  });

  it("picks death, then the special move, the blow, the wind-up, walking, idle", () => {
    expect(animFor({ dying: 0.2, swing: 0.1 }).anim).toBe("death");
    expect(animFor({ cast: 0.5, swing: 0.1 }).anim).toBe("cast");
    expect(animFor({ swing: 0.1, windup: 0.5 }).anim).toBe("attack");
    const w = animFor({ windup: 0.5 });
    expect(w.anim).toBe("attack");
    expect(w.phase).toBeLessThan(0);
    expect(animFor({ speed: 1, gait: 0.3 })).toEqual({ anim: "walk", phase: 0.3 });
    expect(animFor({ speed: 0 }).anim).toBe("idle");
  });

  it("keeps a squad out of lockstep: every body breathes at its own phase and tempo", () => {
    const seen = new Set<number>();
    for (let id = 1; id <= 12; id++) {
      const [off, rate] = idleJitter(id);
      expect(off >= 0 && off < 1 && rate >= 0.9 && rate <= 1.1).toBe(true);
      seen.add(Math.floor(off * 6));
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});
