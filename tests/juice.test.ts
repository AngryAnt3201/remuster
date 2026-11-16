// Combat feel (base/src/render/juice.ts): hit-stop and shake timing, which events kick the camera, the Ascended callout
// table, squash-and-stretch, HP-bar lag and the float cap.
import { describe, expect, it } from "vitest";
import type { BattleEvent } from "../engine/core/battle";
import { ABILITIES, type BodyKind, type Side } from "../engine/core/defs";
import { Fx, MAX_FLOATS } from "../base/src/render/fx";
import { CALLOUT_LIFE, CALLOUT_REPEAT, FRAME, HP_HOLD, Juice, MAX_STOP_FRAMES, STOP_COOLDOWN, ascendedOf, kickFor, landSquash, popScale } from "../base/src/render/juice";

type B = { id: number; kind: BodyKind; rank: number; side: Side; x: number; y: number };
const world = (bodies: B[]) => (id: number) => bodies.find((b) => b.id === id);
const body = (id: number, kind: BodyKind, rank = 4, side: Side = 0): B => ({ id, kind, rank, side, x: 4, y: 7 });
const calm = () => { const j = new Juice(); j.reduced = false; return j; };
const step = (j: Juice, secs: number) => { for (let t = 0; t < secs - 1e-9; t += FRAME) j.update(FRAME); };

describe("hit-stop", () => {
  it("holds for 2-4 display frames, then lets the clock run", () => {
    const j = calm();
    j.hitStop(3);
    expect(j.frozen).toBe(true);
    expect(j.drawn).toBe(false); // the impact frame still has to be drawn once
    expect(j.update(FRAME)).toBe(false);
    expect(j.update(FRAME)).toBe(false);
    expect(j.update(FRAME)).toBe(false);
    expect(j.frozen).toBe(false);
    expect(j.update(FRAME)).toBe(true);
    j.hitStop(99);
    expect(j.stop).toBeCloseTo(MAX_STOP_FRAMES * FRAME);
    const k = calm(); k.hitStop(1);
    expect(k.stop).toBeCloseTo(2 * FRAME);
  });

  it("cools down so a brawl never stutters, but the biggest stops still land", () => {
    const j = calm();
    j.hitStop(2);
    step(j, 2 * FRAME);
    j.hitStop(3);
    expect(j.frozen).toBe(false);
    j.hitStop(MAX_STOP_FRAMES);
    expect(j.frozen).toBe(true);
    step(j, MAX_STOP_FRAMES * FRAME + STOP_COOLDOWN + 0.05);
    j.hitStop(2);
    expect(j.frozen).toBe(true);
  });

  it("does nothing in reduced motion: no stop, no shake", () => {
    const j = new Juice(); j.reduced = true;
    j.hitStop(4); j.shake(1);
    expect(j.frozen).toBe(false);
    expect(j.trauma).toBe(0);
    expect(j.offset(10, 1)).toEqual([0, 0]);
  });
});

describe("camera shake", () => {
  it("is trauma squared, smooth, bounded and settles in about a second", () => {
    const j = calm();
    j.shake(0.5);
    const [x, y] = j.offset(10);
    expect(Math.abs(x)).toBeLessThanOrEqual(2.5 + 1e-9);
    expect(Math.abs(y)).toBeLessThanOrEqual(2.5 + 1e-9);
    // Consecutive frames move a little, not a white-noise jump across the whole range.
    j.update(FRAME);
    const [x2] = j.offset(10);
    expect(Math.abs(x2 - x)).toBeLessThan(2.5);
    step(j, 0.35);
    expect(j.trauma).toBe(0);
    j.shake(5);
    expect(j.trauma).toBe(1);
  });
});

describe("event kicks", () => {
  const find = world([body(1, "ranger", 1), body(2, "ranger", 4), body(3, "golem", 4, 1), body(4, "medic", 4), body(5, "lamp", 2)]);
  it("big hits, big blasts and kills freeze; small ones don't", () => {
    expect(kickFor({ t: "hit", id: 1, x: 4, y: 7, dmg: 30, side: 0, big: true }, find)).toMatchObject({ stop: 3 });
    expect(kickFor({ t: "hit", id: 1, x: 4, y: 7, dmg: 8, side: 0 }, find).stop).toBeUndefined();
    expect(kickFor({ t: "hit", id: 1, x: 4, y: 7, dmg: 40, side: 0 }, find).stop).toBe(3);
    expect(kickFor({ t: "hit", id: 1, x: 4, y: 7, dmg: 30, side: 0, big: true, shielded: true }, find).stop).toBeUndefined();
    expect(kickFor({ t: "boom", x: 4, y: 7, r: 1.2, kind: "keg", side: 0 }, find)).toMatchObject({ stop: 3 });
    expect(kickFor({ t: "boom", x: 4, y: 7, r: 0.5, kind: "pop", side: 0 }, find).stop).toBeUndefined();
    expect(kickFor({ t: "death", id: 1, x: 4, y: 7, kind: "ranger", side: 0 }, find).stop).toBe(2);
    expect(kickFor({ t: "death", id: 1, x: 4, y: 7, kind: "mite", side: 0 }, find).stop).toBeUndefined();
    expect(kickFor({ t: "death", id: 3, x: 4, y: 7, kind: "golem", side: 1 }, find)).toMatchObject({ stop: 4, shake: 0.3 });
    expect(kickFor({ t: "end", winner: 0 }, find)).toMatchObject({ banner: 0, stop: 4 });
    expect(kickFor({ t: "spawn", id: 9, x: 4, y: 7, side: 1, kind: "thrall", from: 3 }, find).spawn).toBe(9);
  });

  it("calls out Ascended abilities by name, only from rank 4 where the event is shared", () => {
    expect(ascendedOf({ t: "volley", id: 2, x: 4, y: 7, a: 0 }, find)?.text).toBe(ABILITIES.ranger.name);
    expect(ascendedOf({ t: "revive", id: 1, from: 4, x: 4, y: 7 }, find)?.text).toBe(ABILITIES.medic.name);
    expect(ascendedOf({ t: "boom", x: 4, y: 7, r: 2, kind: "quake", side: 1 }, find)).toMatchObject({ text: ABILITIES.golem.name, side: 1 });
    expect(ascendedOf({ t: "ward", id: 1, from: 5, x: 4, y: 7, amt: 20 }, find)).toBeUndefined(); // a rank 2 lamp
    expect(ascendedOf({ t: "hit", id: 1, x: 4, y: 7, dmg: 30, side: 0 }, find)).toBeUndefined();
    const k = kickFor({ t: "volley", id: 2, x: 4, y: 7, a: 0 }, find);
    expect(k.stop).toBe(MAX_STOP_FRAMES);
    expect(k.callout?.key).toBe("b2");
  });

  it("shows one callout per unit, then not again until CALLOUT_REPEAT has passed", () => {
    const j = calm();
    const e: BattleEvent = { t: "volley", id: 2, x: 4, y: 7, a: 0 };
    j.onEvent(e, find);
    expect(j.callouts).toHaveLength(1);
    expect(j.frozen).toBe(true);
    step(j, 0.5);
    j.onEvent(e, find);
    expect(j.callouts).toHaveLength(1);
    expect(j.frozen).toBe(false); // a repeat doesn't freeze either
    step(j, CALLOUT_LIFE);
    expect(j.callouts).toHaveLength(0);
    step(j, CALLOUT_REPEAT);
    j.onEvent(e, find);
    expect(j.callouts).toHaveLength(1);
  });
});

describe("squash and stretch", () => {
  it("stretches in the air, squashes on landing and settles to 1", () => {
    const [ax, ay] = landSquash(-1);
    expect(ay).toBeGreaterThan(1); expect(ax).toBeLessThan(1);
    const [lx, ly] = landSquash(0);
    expect(lx).toBeGreaterThan(1.2); expect(ly).toBeLessThan(0.8);
    expect(landSquash(1)).toEqual([1, 1]);
    expect(popScale(0)).toBeLessThan(0.5);
    expect(popScale(1)).toBe(1);
    expect(Math.max(...[0.3, 0.5, 0.7].map(popScale))).toBeGreaterThan(1);
  });
});

describe("HP bar lag", () => {
  it("holds the lost segment, then drains it to the real value", () => {
    const j = calm();
    expect(j.hpBar(7, 1).lag).toBe(1);
    const h = j.hpBar(7, 0.6);
    expect(h.frac).toBe(0.6);
    expect(h.lag).toBe(1);
    step(j, HP_HOLD * 0.8);
    expect(j.hpBar(7, 0.6).lag).toBe(1);
    step(j, 1);
    expect(j.hpBar(7, 0.6).lag).toBe(0.6);
    expect(j.hpBar(7, 0.9).lag).toBe(0.9); // a heal never leaves the lag below the bar
  });
});

describe("damage numbers", () => {
  it("merge hits on one spot into a running total, a crit upgrading the number", () => {
    const fx = new Fx();
    fx.float(4, 7, "20", "#fff", 0.27, 0.75, "dmg");
    fx.float(4.2, 7.1, "30", "#fff", 0.27, 0.75, "dmg");
    fx.float(4.1, 7, "50!", "#ffd166", 0.34, 0.9, "crit");
    fx.float(4, 7, "+12", "#7dff9a", 0.25, 0.8, "heal");
    fx.float(8, 2, "9", "#fff", 0.27, 0.75, "dmg");
    expect(fx.floats.map((f) => [f.text, f.kind])).toEqual([["100!", "crit"], ["+12", "heal"], ["9", "dmg"]]);
  });

  it("cap how many are on screen, dropping the oldest plain number first", () => {
    const fx = new Fx();
    fx.float(4, 7, "PARRY", "#fff", 0.3, 0.8, "text");
    for (let i = 0; i < MAX_FLOATS + 5; i++) fx.float(i * 2, 7, String(i), "#fff", 0.3, 0.8, "dmg");
    expect(fx.floats.length).toBe(MAX_FLOATS);
    expect(fx.floats.some((f) => f.text === "PARRY")).toBe(true);
  });
});
