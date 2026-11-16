// The camera push-in and the slow-motion finish (base/src/render/juice.ts).
import { describe, expect, it } from "vitest";
import { FINAL_PUSH, FINAL_SLOW, FINAL_SLOW_FOR, Juice, kickFor, pushEnv } from "../base/src/render/juice";

const find = () => undefined;
const step = (j: Juice, secs: number) => { for (let t = 0; t < secs - 1e-9; t += 1 / 60) j.update(1 / 60); };

describe("camera push-in", () => {
  it("eases in, holds and eases back out to nothing", () => {
    const p = FINAL_PUSH, end = p.attack + p.hold + p.release;
    expect(pushEnv(p, 0)).toBe(0);
    expect(pushEnv(p, p.attack / 2)).toBeGreaterThan(0.5); // ease-out: most of the way in by half time
    expect(pushEnv(p, p.attack + p.hold / 2)).toBe(1);
    expect(pushEnv(p, end)).toBe(0);
    let prev = 1;
    for (let t = p.attack + p.hold; t <= end; t += 0.02) { const v = pushEnv(p, t); expect(v).toBeLessThanOrEqual(prev + 1e-9); prev = v; }
  });

  it("the final blow leans in on the body that just fell and runs the board slow for a moment", () => {
    const j = new Juice();
    j.reduced = false;
    expect(j.zoom().k).toBe(1);
    expect(j.timeScale).toBe(1);
    j.onEvent({ t: "death", id: 1, x: 2, y: 3, kind: "ranger", side: 1 }, find);
    j.onEvent({ t: "end", winner: 0 }, find);
    expect(j.timeScale).toBe(FINAL_SLOW);
    step(j, FINAL_PUSH.attack + 0.1);
    const z = j.zoom();
    expect(z.k).toBeCloseTo(1 + FINAL_PUSH.amp, 5);
    expect([z.x, z.y]).toEqual([2, 3]);
    step(j, FINAL_SLOW_FOR);
    expect(j.timeScale).toBe(1);
    step(j, FINAL_PUSH.hold + FINAL_PUSH.release);
    expect(j.zoom().k).toBe(1);
    j.reset();
    expect(j.timeScale).toBe(1);
  });

  it("the heaviest blasts punch in briefly, others don't, and a punch never cuts a stronger push short", () => {
    expect(kickFor({ t: "boom", x: 4, y: 7, r: 2, kind: "quake", side: 0 }, find).push?.amp).toBeGreaterThan(0);
    expect(kickFor({ t: "boom", x: 4, y: 7, r: 1.2, kind: "keg", side: 0 }, find).push).toBeUndefined(); // common blasts don't zoom
    expect(kickFor({ t: "boom", x: 4, y: 7, r: 0.5, kind: "pop", side: 0 }, find).push).toBeUndefined();
    expect(kickFor({ t: "hit", id: 1, x: 4, y: 7, dmg: 30, side: 0, big: true }, find).push).toBeUndefined();
    const j = new Juice();
    j.reduced = false;
    j.onEvent({ t: "end", winner: 0 }, find);
    step(j, FINAL_PUSH.attack + 0.05);
    j.onEvent({ t: "boom", x: 1, y: 1, r: 2, kind: "quake", side: 0 }, find);
    expect(j.zoom().k).toBeCloseTo(1 + FINAL_PUSH.amp, 5);
    expect(j.zoom().x).toBe(4.5);
  });

  it("calm mode never zooms or slows", () => {
    const j = new Juice();
    j.reduced = true;
    j.onEvent({ t: "end", winner: 0 }, find);
    step(j, 0.2);
    expect(j.zoom().k).toBe(1);
    expect(j.timeScale).toBe(1);
  });
});
