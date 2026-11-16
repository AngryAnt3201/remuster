import { describe, expect, it } from "vitest";
import { EDGE, H, UNITS, W, ZONE_DEPTH, clampToZone, inZone, toWorld, type UnitKind } from "../engine/core/defs";
import { Match } from "../engine/core/match";
import { Camera, mirror8, sortDrawables } from "../base/src/render/camera";

// Phone layouts the board gets fitted into (css px): iPhone 17 Pro, a small phone, the 6.9" store size, landscape-ish.
const AREAS = [
  { x: 8, y: 120, w: 386, h: 560 },
  { x: 8, y: 100, w: 359, h: 470 },
  { x: 8, y: 130, w: 424, h: 640 },
  { x: 0, y: 0, w: 900, h: 600 },
];
const cams = () => AREAS.map((a) => { const c = new Camera(W, H); c.fit(a); return { c, a }; });

describe("diorama camera", () => {
  it("round-trips world to screen to world within 0.01 units across the board", () => {
    for (const { c } of cams()) {
      let worst = 0;
      for (let x = 0; x <= W; x += 0.125) for (let y = 0; y <= H; y += 0.125) {
        const p = c.project(x, y);
        const w = c.unproject(p.x, p.y);
        worst = Math.max(worst, Math.hypot(w.x - x, w.y - y));
      }
      expect(worst).toBeLessThan(0.01);
    }
  });

  it("round-trips screen to world to screen within half a pixel over the ground", () => {
    for (const { c } of cams()) {
      const g = c.groundRect();
      for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
        const px = g.x + (g.w * i) / 40, py = g.y + (g.h * j) / 40;
        const w = c.unproject(px, py);
        const p = c.project(w.x, w.y);
        expect(Math.hypot(p.x - px, p.y - py)).toBeLessThan(0.5);
      }
    }
  });

  it("inverts at height too, for picking standing figures", () => {
    const { c } = cams()[0];
    for (const z of [0.35, 1, 1.5]) for (let x = 0.5; x < W; x += 1) for (let y = 0.5; y < H; y += 1) {
      const p = c.project(x, y, z);
      const w = c.unprojectAt(p.x, p.y, z);
      expect(Math.hypot(w.x - x, w.y - y)).toBeLessThan(0.01);
    }
  });

  it("is an angled view: the far edge is narrower, the ground foreshortened, height lifts things up the screen", () => {
    const { c } = cams()[0];
    const far = c.project(W, 0).x - c.project(0, 0).x, near = c.project(W, H).x - c.project(0, H).x;
    expect(near).toBeGreaterThan(far * 1.1);
    expect(c.squashAt(H / 2)).toBeLessThan(0.9);
    expect(c.squashAt(H / 2)).toBeGreaterThan(0.6);
    const ground = c.project(4.5, 7), up = c.project(4.5, 7, 1);
    expect(up.y).toBeLessThan(ground.y - 10);
    expect(Math.abs(up.x - ground.x)).toBeLessThan(1e-9);
    // The rival's edge is up the screen, yours is down.
    expect(c.project(4.5, 0).y).toBeLessThan(c.project(4.5, H).y);
  });

  it("fits the board, its headroom and its front face inside the layout area", () => {
    for (const { c, a } of cams()) {
      const pts = [c.project(0, 0, 1.1), c.project(W, 0, 1.1), c.project(0, H, -0.45), c.project(W, H, -0.45)];
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(a.x - 0.5);
        expect(p.x).toBeLessThanOrEqual(a.x + a.w + 0.5);
        expect(p.y).toBeGreaterThanOrEqual(a.y - 0.5);
        expect(p.y).toBeLessThanOrEqual(a.y + a.h + 0.5);
      }
      // And it uses the room: one of the two directions is filled.
      const g = c.groundRect();
      expect(Math.max(g.w / a.w, (pts[2].y - pts[0].y) / a.h)).toBeGreaterThan(0.98);
    }
  });

  it("draws your deploy zone edge exactly on the sim's zone depth", () => {
    for (const { c } of cams()) {
      const edge = toWorld(0, 0, ZONE_DEPTH).y;
      for (let x = EDGE; x <= W - EDGE; x += 0.5) {
        const p = c.project(x, edge);
        expect(Math.abs(c.unproject(p.x, p.y).y - edge)).toBeLessThan(0.01);
        // A few pixels toward you is in the zone; a few pixels toward the rival is not.
        expect(inZone(0, ...xy(c.unproject(p.x, p.y + 2)))).toBe(true);
        expect(inZone(0, ...xy(c.unproject(p.x, p.y - 4)))).toBe(false);
      }
    }
  });

  it("drops a dragged card where the sim places it, and draws the piece under the finger", () => {
    const { c } = cams()[0];
    const g = c.groundRect();
    let placed = 0;
    for (let i = 1; i < 12; i++) {
      const m = new Match({ seed: 4 + i, startGold: [999, 0] });
      const slot = m.sides[0].shop.findIndex(Boolean);
      const kind = m.sides[0].shop[slot] as UnitKind;
      // A pointer somewhere over your half.
      const px = g.x + g.w * (0.15 + 0.07 * i), py = g.y + g.h * (0.7 + 0.02 * i);
      const w = c.unproject(px, py);
      if (!inZone(0, w.x, w.y)) continue;
      // What game.ts shows as the ghost...
      const ghost = clampToZone(0, w.x, w.y, UNITS[kind].radius);
      // ...is where the sim puts it.
      const p = m.buy(0, slot, ghost.x, ghost.y);
      expect(p.x).toBeCloseTo(ghost.x, 9);
      expect(p.y).toBeCloseTo(ghost.y, 9);
      // And unless it was clamped off the edge, it sits under the pointer to within half a pixel.
      if (Math.hypot(ghost.x - w.x, ghost.y - w.y) < 1e-9) {
        const s = c.project(p.x, p.y);
        expect(Math.hypot(s.x - px, s.y - py)).toBeLessThan(0.5);
      }
      placed++;
    }
    expect(placed).toBeGreaterThan(5);
  });

  it("turns world headings into 8 screen facings, with mirrors for the left-facing half", () => {
    const { c } = cams()[0];
    expect(c.facing8(0)).toBe(0); // right
    expect(c.facing8(Math.PI / 2)).toBe(2); // toward the camera
    expect(c.facing8(Math.PI)).toBe(4); // left
    expect(c.facing8(-Math.PI / 2)).toBe(6); // away
    expect(c.facing8(Math.PI / 4)).toBe(1);
    expect(c.facing8(-3 * Math.PI / 4)).toBe(5);
    for (let d = 0; d < 8; d++) {
      const m = mirror8(d);
      expect([0, 1, 2, 6, 7]).toContain(m.frame);
      expect(m.flip).toBe(d >= 3 && d <= 5);
    }
  });

  it("paints ground first, then upright things far to near, then the air", () => {
    const order = sortDrawables([
      { y: 10, layer: 2, id: "flyer near" },
      { y: 9, layer: 1, id: "near" },
      { y: 2, layer: 1, id: "far" },
      { y: 1, layer: 2, id: "flyer far" },
      { y: 5, layer: 0, id: "shadow" },
      { y: 5, layer: 1, id: "mid a" },
      { y: 5, layer: 1, id: "mid b" },
    ]).map((d) => d.id);
    expect(order).toEqual(["shadow", "far", "mid a", "mid b", "near", "flyer far", "flyer near"]);
  });
});

const xy = (p: { x: number; y: number }) => [p.x, p.y] as const;
