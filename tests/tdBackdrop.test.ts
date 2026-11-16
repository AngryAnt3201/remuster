// Bastion backdrops (art/td/render_td.py -> base/public/td): rendered through the TD camera's ground layout from the sim's
// own road and pad geometry, and pixel-checked after the render (pads read as stone, the road centre as dirt, the
// verge just past the sim's road edge as not-dirt). These tests hold the shipped render to the current sim.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAP_DEFS, getMap } from "../engine/core/td/maps";
import { TD_SQUASH, TD_TEX_M, TD_TEX_PPU } from "../base/src/render/tdCamera";
import type { TdBackdropManifest } from "../base/src/render/tdView";

const DIR = join(__dirname, "..", "base", "public", "td");
const man = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) as TdBackdropManifest;

describe("bastion backdrops", () => {
  it("were rendered in the ground texture's layout", () => {
    expect(man.ppu).toBe(TD_TEX_PPU);
    expect(man.margin).toBe(TD_TEX_M);
    expect(man.squash).toBe(TD_SQUASH);
  });

  it("cover every map, sliced into webp strips that tile the full height", () => {
    for (const def of MAP_DEFS) {
      const info = man.maps[def.id];
      expect(info, def.id).toBeDefined();
      expect(info.px[0]).toBe(Math.round((def.w + TD_TEX_M * 2) * TD_TEX_PPU));
      expect(info.px[1]).toBe(Math.ceil((def.h + TD_TEX_M * 2) * TD_TEX_PPU * TD_SQUASH));
      let y = 0;
      for (const s of info.slices) {
        expect(s.y).toBe(y);
        y += s.h;
        expect(existsSync(join(DIR, s.file))).toBe(true);
        expect(statSync(join(DIR, s.file)).size).toBeGreaterThan(20_000);
      }
      expect(y).toBe(info.px[1]);
    }
  });

  it("was built from the sim's own pads and roads", () => {
    for (const def of MAP_DEFS) {
      const m = getMap(def.id), info = man.maps[def.id];
      expect(info.pads.length).toBe(m.pads.length);
      info.pads.forEach(([x, y], i) => {
        expect(Math.abs(x - m.pads[i].x)).toBeLessThan(0.002);
        expect(Math.abs(y - m.pads[i].y)).toBeLessThan(0.002);
      });
      expect(info.roads.length).toBe(m.paths.length);
      info.roads.forEach((r, k) => r.forEach(([x, y], i) => {
        const q = m.paths[k].pts[i * 8];
        expect(Math.abs(x - q.x) + Math.abs(y - q.y)).toBeLessThan(0.002);
      }));
    }
  });

  it("lines up on the pixels: camera exact, every pad is stone, the road centre is dirt and no wider than the sim's", () => {
    for (const def of MAP_DEFS) {
      const c = man.maps[def.id].check;
      expect(c.camera_px).toBeLessThan(0.5);
      expect(c.pads[0]).toBe(c.pads[1]);
      expect(c.road[0] / c.road[1]).toBeGreaterThanOrEqual(0.98);
      expect(c.verge[0] / c.verge[1]).toBeGreaterThanOrEqual(0.95);
    }
  });

  it("stays small: under 4 MB on disk and about 6 MP decoded per map", () => {
    const bytes = readdirSync(DIR).reduce((n, f) => n + statSync(join(DIR, f)).size, 0);
    expect(bytes).toBeLessThan(4_000_000);
    for (const def of MAP_DEFS) { const [w, h] = man.maps[def.id].px; expect(w * h).toBeLessThan(6_500_000); }
  });
});
