import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { H, W, ZONE_DEPTH } from "../engine/core/defs";
import { ARENA_COUNT, backdropRect, type ArenaManifest } from "../base/src/render/arena";
import { Camera } from "../base/src/render/camera";
import { FG_FADED, easeAlphas, fadeTargets, fgCells, glintSpots, sceneFigures, sideSpots, unitBox } from "../base/src/render/foreground";

const DIR = join(__dirname, "..", "base", "public", "arenas");
const man = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) as ArenaManifest;

describe("arena foreground", () => {
  it("every act has a foreground layer whose cells sit inside the backdrop, along its sides", () => {
    for (let a = 1; a <= ARENA_COUNT; a++) {
      const fg = man.acts[String(a)].fg;
      expect(fg, `act ${a}`).toBeTruthy();
      expect(existsSync(join(DIR, fg!.file))).toBe(true);
      expect(fg!.cells.length).toBeGreaterThan(6);
      for (const [x, y, w, h] of fg!.cells) {
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(1.0001); expect(y + h).toBeLessThanOrEqual(1.0001);
        // a side cell: it never spans the board's middle
        expect(x + w <= 0.5 + 1e-6 || x >= 0.5 - 1e-6).toBe(true);
      }
    }
  });

  it("maps cells to screen with the backdrop rect", () => {
    const r = { x: 10, y: 20, w: 200, h: 400 };
    expect(fgCells([[0.1, 0.25, 0.2, 0.05]], r)).toEqual([{ x: 30, y: 120, w: 40, h: 20 }]);
  });

  it("fades only the cells a unit stands under", () => {
    const cells = [{ x: 0, y: 0, w: 50, h: 50 }, { x: 0, y: 60, w: 50, h: 50 }];
    expect(fadeTargets(cells, [{ x: 40, y: 70, w: 20, h: 30 }])).toEqual([1, FG_FADED]);
    expect(fadeTargets(cells, [])).toEqual([1, 1]);
  });

  it("eases out quickly and back in slowly, never overshooting", () => {
    const a = [1, FG_FADED];
    easeAlphas(a, [FG_FADED, 1], 0.05);
    const out = 1 - a[0], back = a[1] - FG_FADED;
    expect(out).toBeGreaterThan(back);
    for (let i = 0; i < 100; i++) easeAlphas(a, [FG_FADED, 1], 0.1);
    expect(a[0]).toBeCloseTo(FG_FADED, 5);
    expect(a[1]).toBeCloseTo(1, 5);
  });

  it("a unit near the side edge of the board overlaps that side's canopy, one in the middle doesn't", () => {
    const cam = new Camera(W, H);
    cam.fit({ x: 8, y: 90, w: 374, h: 514 });
    const r = backdropRect(man, cam.k, cam.cx, cam.cy);
    const cells = fgCells(man.acts["1"].fg!.cells, r);
    const edge = fadeTargets(cells, [unitBox(cam, 0.35, 10)]);
    const mid = fadeTargets(cells, [unitBox(cam, W / 2, 10)]);
    expect(edge.some((t) => t < 1)).toBe(true);
    expect(mid.every((t) => t === 1)).toBe(true);
  });

  it("collects live, above-ground bodies in a battle and pieces while deploying", () => {
    const bodies = [{ x: 1, y: 1, alive: true }, { x: 2, y: 2, alive: false }, { x: 3, y: 3, alive: true, burrowed: true }];
    expect(sceneFigures({ mode: "battle", battle: { bodies } })).toHaveLength(1);
    expect(sceneFigures({ mode: "deploy", pieces: [{ x: 1, y: 1 }], ghost: { x: 2, y: 2 } })).toHaveLength(2);
  });

  it("rises the Coast's spray and the Citadel's embers off the side edges, never over the board", () => {
    const m = sideSpots();
    expect(m.length).toBeGreaterThan(8);
    for (const p of m) expect(p.x < 0 || p.x > W).toBe(true);
  });

  it("puts the Fen's water glints on the mere, off the boardwalk", () => {
    const g = glintSpots();
    expect(g.length).toBeGreaterThan(10);
    for (const p of g) {
      expect(p.y).toBeGreaterThan(ZONE_DEPTH);
      expect(p.y).toBeLessThan(H - ZONE_DEPTH);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(W);
    }
  });
});

describe("foreground redraw region", () => {
  it("clips a cell to the figures under it, and skips cells with none", async () => {
    const { clipTo } = await import("../base/src/render/foreground");
    const cell = { x: 0, y: 0, w: 100, h: 100 };
    expect(clipTo(cell, [{ x: 90, y: 40, w: 30, h: 20 }])).toEqual({ x: 90, y: 40, w: 10, h: 20 });
    expect(clipTo(cell, [{ x: 10, y: 10, w: 10, h: 10 }, { x: 50, y: 60, w: 10, h: 10 }])).toEqual({ x: 10, y: 10, w: 50, h: 60 });
    expect(clipTo(cell, [{ x: 200, y: 0, w: 10, h: 10 }])).toBeNull();
  });
});
