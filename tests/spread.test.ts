import { describe, expect, it } from "vitest";
import { SPREAD_GAP, SPREAD_MAX, spreadOffsets, type SpreadBody } from "../base/src/render/spread";
import { SPRITE_VIS, spriteVis } from "../base/src/render/units";

const body = (id: number, x: number, y: number, side = 0, r = 0.24): SpreadBody => ({ id, x, y, r, side, vis: spriteVis(r) });
const gapAfter = (a: SpreadBody, b: SpreadBody, off: Map<number, [number, number]>) => {
  const oa = off.get(a.id) ?? [0, 0], ob = off.get(b.id) ?? [0, 0];
  return Math.hypot(b.x + ob[0] - a.x - oa[0], b.y + ob[1] - a.y - oa[1]);
};

describe("render crowd spread", () => {
  it("pushes an overlapping same-side pair apart, symmetrically", () => {
    const a = body(1, 5, 5), b = body(2, 5.3, 5);
    const off = spreadOffsets([a, b]);
    expect(gapAfter(a, b, off)).toBeGreaterThan(0.3);
    expect(off.get(1)![0]).toBeCloseTo(-off.get(2)![0], 6);
    expect(off.get(1)![1]).toBeCloseTo(0, 6);
  });

  it("leaves rivals and well-spaced friends alone", () => {
    expect(spreadOffsets([body(1, 5, 5, 0), body(2, 5.2, 5, 1)]).size).toBe(0);
    const want = 0.24 * SPRITE_VIS * 2 * SPREAD_GAP;
    expect(spreadOffsets([body(1, 5, 5), body(2, 5 + want + 0.01, 5)]).size).toBe(0);
  });

  it("caps every nudge, even in a dense pile, and is deterministic", () => {
    const pile = Array.from({ length: 12 }, (_, i) => body(i, 5 + (i % 4) * 0.05, 5 + Math.floor(i / 4) * 0.05));
    const off = spreadOffsets(pile);
    for (const [, [dx, dy]] of off) expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(SPREAD_MAX + 1e-9);
    expect([...spreadOffsets(pile)]).toEqual([...off]);
  });

  it("splits exactly stacked bodies", () => {
    const off = spreadOffsets([body(3, 5, 5), body(4, 5, 5)]);
    expect(gapAfter(body(3, 5, 5), body(4, 5, 5), off)).toBeGreaterThan(0.1);
  });

  it("draws big bodies at a smaller multiplier than small ones", () => {
    expect(spriteVis(0.24)).toBe(SPRITE_VIS);
    expect(spriteVis(0.42)).toBeLessThan(SPRITE_VIS);
    expect(spriteVis(0.55)).toBeGreaterThanOrEqual(1.25);
  });
});
