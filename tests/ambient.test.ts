// Ambient arena life (base/src/render/ambient.ts): every arena has some, and its motion stays where it should.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { H, W } from "../engine/core/defs";
import { AMBIENT, FLOCK_CROSS, FLOCK_EVERY, FLOCK_FIRST, butterflyAt, flockAt, gustAt, moteAt, type MoteKind } from "../base/src/render/ambient";
import { IDLE_BREATH, IDLE_FIDGET_EVERY, idleLife } from "../base/src/render/units";

describe("ambient arena life", () => {
  it("every arena in the manifest has ambient life that moves", () => {
    const m = JSON.parse(readFileSync("base/public/arenas/manifest.json", "utf8"));
    for (const [act, a] of Object.entries<{ obstacle: string }>(m.acts)) {
      const cfg = AMBIENT[a.obstacle];
      expect(cfg, `act ${act} (${a.obstacle})`).toBeDefined();
      expect(cfg.motes.reduce((n, g) => n + g.n, 0), `act ${act} motes`).toBeGreaterThan(0);
      expect(cfg.shade > 0 || !!cfg.gust || !!cfg.flock || cfg.butterflies > 0, `act ${act} ground or sky life`).toBe(true);
      // cheap: a few dozen flat fills at most
      expect(cfg.motes.reduce((n, g) => n + g.n, 0)).toBeLessThanOrEqual(40);
    }
  });

  it("motes stay near the board, fade in and out, and move", () => {
    for (const kind of ["drift", "fall", "rise", "blink"] as MoteKind[]) {
      let moved = 0;
      for (let i = 0; i < 20; i++) {
        const a = moteAt(kind, i, 3), b = moteAt(kind, i, 3.5);
        moved += Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        for (let t = 0; t < 30; t += 0.37) {
          const q = moteAt(kind, i, t);
          expect(q.x).toBeGreaterThan(-3); expect(q.x).toBeLessThan(W + 3);
          expect(q.y).toBeGreaterThan(-2); expect(q.y).toBeLessThan(H + 2);
          expect(q.z).toBeGreaterThanOrEqual(0); expect(q.z).toBeLessThanOrEqual(3.01);
          expect(q.a).toBeGreaterThanOrEqual(0); expect(q.a).toBeLessThanOrEqual(1);
        }
      }
      expect(moved / 20, kind).toBeGreaterThan(0.02);
    }
  });

  it("a flock crosses soon after the board appears, then again on a period, alternating direction", () => {
    expect(flockAt(0, 0)).toBeNull();
    const first = flockAt(0, FLOCK_FIRST + 1)!, later = flockAt(0, FLOCK_FIRST + 3)!;
    expect(first).not.toBeNull();
    expect(later.x).toBeGreaterThan(first.x);
    expect(first.dir).toBe(1);
    expect(flockAt(0, FLOCK_FIRST + FLOCK_CROSS + 1)).toBeNull();
    const next = flockAt(0, FLOCK_FIRST + FLOCK_EVERY + 2)!;
    expect(next.dir).toBe(-1);
    expect(flockAt(0, FLOCK_FIRST + FLOCK_EVERY + 4)!.x).toBeLessThan(next.x);
    // the followers trail the leader
    expect(flockAt(1, FLOCK_FIRST + 2)!.x).toBeLessThan(flockAt(0, FLOCK_FIRST + 2)!.x);
  });

  it("butterflies keep to the grass and gusts come and go", () => {
    for (let i = 0; i < 3; i++) for (let t = 0; t < 40; t += 0.5) {
      const b = butterflyAt(i, t);
      expect(b.x).toBeGreaterThan(-0.5); expect(b.x).toBeLessThan(W + 0.5);
      expect(b.y).toBeGreaterThan(0); expect(b.y).toBeLessThan(H);
      expect(b.flap).toBeGreaterThanOrEqual(0); expect(b.flap).toBeLessThanOrEqual(1);
    }
    let on = 0, off = 0;
    for (let t = 0; t < 60; t += 0.1) (gustAt(0, t).k > 0.05 ? on++ : off++);
    expect(on).toBeGreaterThan(30); expect(off).toBeGreaterThan(on);
  });
});

describe("idle life", () => {
  it("breathes about the feet in step with the idle clip, deeper for light bodies", () => {
    for (const w of ["heavy", "mid", "light"] as const) {
      const up = idleLife(1.25, w, 7), down = idleLife(1.75, w, 7);
      expect(up.sy - down.sy).toBeGreaterThan(IDLE_BREATH[w] * 1.2);
      expect(up.sx).toBeLessThan(down.sx); // taller means narrower
    }
    expect(IDLE_BREATH.light).toBeGreaterThan(IDLE_BREATH.heavy);
  });

  it("stays a small motion, dips once per cycle and repeats", () => {
    let min = 1, max = 1;
    for (let p = 0; p < IDLE_FIDGET_EVERY; p += 0.01) {
      const l = idleLife(p, "mid", 3);
      min = Math.min(min, l.sy); max = Math.max(max, l.sy);
      expect(Math.abs(l.lean)).toBeLessThan(0.05);
      expect(l.sx).toBeGreaterThan(0.9); expect(l.sx).toBeLessThan(1.1);
    }
    expect(max).toBeLessThan(1.07);
    expect(min).toBeLessThan(1 - IDLE_BREATH.mid - 0.02); // the dip goes below a plain breath out
    expect(min).toBeGreaterThan(0.85);
    const a = idleLife(0.4, "mid", 3), b = idleLife(0.4 + IDLE_FIDGET_EVERY, "mid", 3);
    expect(b.sy).toBeCloseTo(a.sy, 6); expect(b.sx).toBeCloseTo(a.sx, 6);
    // two bodies don't dip together
    const dipAt = (seed: number) => { let at = 0, low = 9; for (let p = 0; p < IDLE_FIDGET_EVERY; p += 0.01) { const v = idleLife(p, "mid", seed).sy; if (v < low) { low = v; at = p; } } return at; };
    expect(Math.abs(dipAt(1) - dipAt(2))).toBeGreaterThan(0.5);
  });
});
