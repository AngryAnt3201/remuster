// The three legendaries: Griffin Knight (dive on the back line), Tidecaller (lane wave), Lionheart (rally on kills).
import { describe, expect, it } from "vitest";
import { Battle, simulate, type BattleEvent, type Body } from "../engine/core/battle";
import { ABILITIES, H, UNITS, W, type BodyKind, type Piece, type Side, type UnitKind } from "../engine/core/defs";
import { DEFAULT_AI, POWER, TACTICS, draftArmy } from "../engine/core/ai";
import { RARITY, kindsOfRarity } from "../engine/progression/collection";
import { findable, rollContents } from "../engine/progression/chests";
import { ascendedOf } from "../base/src/render/juice";

const LEGENDS: UnitKind[] = ["griffin", "tide", "lion"];
let nid = 1;
const P = (kind: UnitKind, side: Side, x: number, y: number, rank = 1): Piece => ({ id: nid++, kind, side, x, y, rank, spent: UNITS[kind].cost });
const run = (b: Battle, seconds: number) => { for (let t = 0; t < seconds * 30 && !b.done; t++) b.step(); };
const runUntil = (b: Battle, seconds: number, until: () => boolean) => {
  for (let t = 0; t < seconds * 30 && !b.done; t++) { b.step(); if (until()) return true; }
  return false;
};
const events = <T extends BattleEvent["t"]>(b: Battle, t: T) => b.events.filter((e) => e.t === t) as Extract<BattleEvent, { t: T }>[];
const one = (b: Battle, kind: BodyKind, side?: Side) => b.bodies.find((x) => x.kind === kind && (side === undefined || x.side === side))!;
const pin = (...bs: Body[]) => { for (const x of bs) x.frozen = 999; };

describe("legendaries: defs", () => {
  it("are legendary, cost 5 and have a named Ascended ability", () => {
    for (const k of LEGENDS) {
      expect(RARITY[k]).toBe("legendary");
      expect(UNITS[k].cost).toBe(5);
      expect(ABILITIES[k].name.length).toBeGreaterThan(2);
      expect(POWER[k]).toBeGreaterThan(4);
    }
    expect(kindsOfRarity("legendary")).toEqual(expect.arrayContaining(["storm", "golem", ...LEGENDS]));
  });

  it("the same pieces and seed play out the same battle, every time", () => {
    const army = (): Piece[] => {
      nid = 500;
      return [
        P("griffin", 0, 2, 11, 4), P("tide", 0, 4.5, 12, 4), P("lion", 0, 6, 9.5, 4), P("blades", 0, 4, 9.6, 2),
        P("lion", 1, 3, 4.5, 3), P("tide", 1, 6, 2, 2), P("griffin", 1, 7, 3, 1), P("ranger", 1, 4.5, 2.5, 3), P("bulwark", 1, 4.5, 5, 2),
      ];
    };
    const a = new Battle(army(), { seed: 21, events: true }), b = new Battle(army(), { seed: 21, events: true });
    a.run(); b.run();
    expect(a.result()).toEqual(b.result());
    expect(a.events.length).toBe(b.events.length);
    expect(a.bodies.map((x) => [x.kind, Math.round(x.hp), x.x.toFixed(4)])).toEqual(b.bodies.map((x) => [x.kind, Math.round(x.hp), x.x.toFixed(4)]));
    expect(simulate(army(), { seed: 21 })).toEqual(a.result());
  });
});

describe("Griffin Knight", () => {
  it("soars over the front line, swoops onto the back line and stuns where it lands", () => {
    const b = new Battle([P("griffin", 0, 4.5, 11), P("bulwark", 1, 4.5, 6), P("medic", 1, 4.5, 2)], { seed: 3, events: true });
    const g = one(b, "griffin"), wall = one(b, "bulwark"), med = one(b, "medic");
    pin(wall, med);
    expect(g.flying).toBe(true);
    expect(g.z).toBeGreaterThan(1.4);
    expect(events(b, "soar")).toEqual([{ t: "soar", id: g.id, x: g.x, y: g.y, side: 0, second: false }]);
    // Melee can't touch it.
    expect(b.nearestEnemy(wall, {})).toBeUndefined();
    expect(runUntil(b, 6, () => events(b, "swoop").length > 0)).toBe(true);
    const s = events(b, "swoop")[0];
    expect(Math.hypot(s.x - med.x, s.y - med.y)).toBeLessThan(0.3);
    expect(med.stun).toBeGreaterThan(0.4);
    expect(med.hp).toBeLessThan(med.maxHp);
    expect(wall.hp).toBe(wall.maxHp);
    expect(g.state).toBe("fight");
    // Down among them it fights low: swords reach it now.
    expect(g.flying).toBe(false);
    expect(b.nearestEnemy(med, { taunt: false })?.kind).toBe("griffin");
    run(b, 1);
    expect(g.z).toBeLessThan(0.7);
    expect(g.z).toBeGreaterThan(0.5);
  });

  it("can strike flyers in the air", () => {
    const b = new Battle([P("griffin", 0, 4.5, 10), P("harrier", 1, 4.5, 6)], { seed: 4 });
    expect(b.nearestEnemy(one(b, "griffin"))?.kind).toBe("harrier");
  });

  it("Second Dive: below half health an Ascended griffin climbs and dives again, once", () => {
    const mk = (rank: number) => {
      const b = new Battle([P("griffin", 0, 4.5, 11, rank), P("golem", 1, 3, 5), P("ranger", 1, 6, 2)], { seed: 5, events: true });
      pin(one(b, "golem"), one(b, "ranger"));
      runUntil(b, 6, () => events(b, "swoop").length > 0);
      const g = one(b, "griffin");
      g.hp = g.maxHp * 0.4;
      run(b, 0.2);
      return { b, g };
    };
    const { b, g } = mk(4);
    expect(events(b, "soar").filter((e) => e.second)).toHaveLength(1);
    expect(g.state).toBe("soar");
    expect(runUntil(b, 6, () => events(b, "swoop").length > 1)).toBe(true);
    expect(events(b, "swoop")[1].second).toBe(true);
    g.hp = g.maxHp * 0.2;
    run(b, 1);
    expect(events(b, "soar").filter((e) => e.second)).toHaveLength(1);
    const low = mk(3);
    expect(events(low.b, "soar").filter((e) => e.second)).toHaveLength(0);
    expect(low.g.state).toBe("fight");
  });
});

describe("Tidecaller", () => {
  it("rolls a wave down the crowded lane that hits each foe once and shoves it back", () => {
    const b = new Battle([P("tide", 0, 4.5, 12.5), P("pikeman", 1, 6.5, 8.5), P("pikeman", 1, 6.9, 7.2), P("ranger", 1, 1, 2)], { seed: 6, events: true });
    const [p1, p2] = b.bodies.filter((x) => x.kind === "pikeman");
    expect(runUntil(b, 3, () => events(b, "wave").length > 0)).toBe(true);
    const w = events(b, "wave")[0];
    for (const p of [p1, p2]) expect(Math.abs(w.x - p.x)).toBeLessThan(w.w / 2 + p.radius);
    expect(w.y1).toBeLessThan(w.y0); // side 0 sends it up the board
    expect(w.surf).toBe(false);
    let shoved = 0;
    for (let i = 0; i < 40; i++) { b.step(); shoved = Math.min(shoved, p1.vy, p2.vy); }
    expect(shoved).toBeLessThan(-1.2); // pushed back toward their own side (-y for side 1)
    const dmg = UNITS.tide.dmg;
    for (const p of [p1, p2]) expect(p.maxHp - p.hp).toBeCloseTo(dmg, 0);
    expect(one(b, "ranger").hp).toBe(one(b, "ranger").maxHp); // not in the lane
    expect(b.waves).toHaveLength(0);
  });

  it("Riptide: an Ascended wave leaves slowing surf along its lane", () => {
    const b = new Battle([P("tide", 0, 4.5, 12.5, 4), P("bulwark", 1, 4.5, 8)], { seed: 7, events: true });
    const wall = one(b, "bulwark");
    expect(runUntil(b, 3, () => events(b, "wave").length > 0)).toBe(true);
    expect(events(b, "wave")[0].surf).toBe(true);
    run(b, 1.2);
    const surf = b.zones.filter((z) => z.kind === "surf");
    expect(surf.length).toBeGreaterThanOrEqual(3);
    expect(surf.every((z) => Math.abs(z.x - events(b, "wave")[0].x) < 1e-9)).toBe(true);
    wall.x = surf[0].x; wall.y = surf[0].y;
    run(b, 0.3);
    expect(wall.slow).toBeGreaterThan(0);
    // Rank 3 leaves none.
    const c = new Battle([P("tide", 0, 4.5, 12.5, 3), P("bulwark", 1, 4.5, 8)], { seed: 7 });
    run(c, 4);
    expect(c.zones.filter((z) => z.kind === "surf")).toHaveLength(0);
  });

  it("doesn't cast into an empty field or at flyers", () => {
    const b = new Battle([P("tide", 0, 4.5, 12.5), P("harrier", 1, 4.5, 3)], { seed: 8, events: true });
    run(b, 4);
    expect(events(b, "wave")).toHaveLength(0);
  });
});

describe("Lionheart", () => {
  it("each kill rallies allies close by (attack haste) and heals him", () => {
    const b = new Battle([P("lion", 0, 4.5, 9), P("ranger", 0, 4.0, 10.4), P("ranger", 0, 1, 13), P("medic", 1, 4.5, 8.2)], { seed: 9, events: true });
    const lion = one(b, "lion");
    const [near, far] = b.bodies.filter((x) => x.kind === "ranger");
    pin(one(b, "medic"), near, far);
    one(b, "medic").hp = 10; // falls to the first blow, before the lion shoves it off down the board
    lion.hp = lion.maxHp - 100;
    expect(runUntil(b, 6, () => events(b, "rally").length > 0)).toBe(true);
    expect(lion.hp).toBeCloseTo(lion.maxHp - 100 + lion.maxHp * 0.1, 0);
    expect(near.buff).toBeGreaterThan(2.5);
    expect(lion.buff).toBeGreaterThan(2.5);
    expect(far.buff).toBeLessThanOrEqual(0);
    expect(events(b, "rally")[0].n).toBe(2);
  });

  it("Last Stand: once a battle, an Ascended Lionheart survives a killing blow on 1 health for 2.5 s", () => {
    const b = new Battle([P("lion", 0, 4.5, 11, 4), P("golem", 1, 4.5, 3)], { seed: 10, events: true });
    const lion = one(b, "lion"), g = one(b, "golem");
    pin(g);
    run(b, 0.2);
    b.damage(lion, 99999, g, 1);
    expect(lion.alive).toBe(true);
    expect(lion.hp).toBe(1);
    expect(events(b, "laststand")).toHaveLength(1);
    run(b, 1.5);
    b.damage(lion, 99999, g, 1);
    expect(lion.alive).toBe(true);
    run(b, 1.2);
    b.damage(lion, 99999, g, 1);
    expect(lion.alive).toBe(false);
    expect(events(b, "laststand")).toHaveLength(1);
    // Rank 3 falls at once.
    const c = new Battle([P("lion", 0, 4.5, 11, 3), P("golem", 1, 4.5, 3)], { seed: 10 });
    c.damage(one(c, "lion"), 99999, null, 1);
    expect(one(c, "lion").alive).toBe(false);
  });

  it("calls out each Ascended ability by name", () => {
    const bodies = [
      { id: 1, kind: "griffin" as BodyKind, rank: 4, side: 0 as Side, x: 4, y: 7 },
      { id: 2, kind: "tide" as BodyKind, rank: 4, side: 0 as Side, x: 4, y: 7 },
      { id: 3, kind: "lion" as BodyKind, rank: 4, side: 0 as Side, x: 4, y: 7 },
    ];
    const find = (id: number) => bodies.find((x) => x.id === id);
    expect(ascendedOf({ t: "soar", id: 1, x: 4, y: 7, side: 0, second: true }, find)?.text).toBe(ABILITIES.griffin.name);
    expect(ascendedOf({ t: "soar", id: 1, x: 4, y: 7, side: 0, second: false }, find)).toBeUndefined();
    expect(ascendedOf({ t: "wave", id: 9, from: 2, x: 4, y0: 12, y1: 6, w: 1.5, dur: 1, side: 0, surf: true }, find)?.text).toBe(ABILITIES.tide.name);
    expect(ascendedOf({ t: "wave", id: 9, from: 2, x: 4, y0: 12, y1: 6, w: 1.5, dur: 1, side: 0, surf: false }, find)).toBeUndefined();
    expect(ascendedOf({ t: "laststand", id: 3, x: 4, y: 7, until: 3 }, find)?.text).toBe(ABILITIES.lion.name);
  });
});

describe("legendaries: rosters and chests", () => {
  it("the AI drafts and places all three when they are on the roster", () => {
    const seen = new Set<UnitKind>();
    for (let s = 1; s <= 40; s++) {
      for (const p of draftArmy(1, 24, LEGENDS, { ...DEFAULT_AI, tactic: TACTICS[s % TACTICS.length] }, s)) {
        seen.add(p.kind);
        expect(p.y).toBeLessThan(H / 2);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(W);
      }
    }
    expect(seen).toEqual(new Set(LEGENDS));
  });

  it("chests can drop them once they are found", () => {
    const found: UnitKind[] = ["blades", "griffin", "tide", "lion"];
    const pool = findable({}, found);
    for (const k of LEGENDS) expect(pool).toContain(k);
    const got = new Set<UnitKind>();
    for (let s = 0; s < 60; s++) for (const st of rollContents("legend", s, 5, pool, found).cards) got.add(st.kind);
    for (const k of LEGENDS) expect(got.has(k), k).toBe(true);
    // Not found and not met in the campaign: never.
    expect(findable({}, ["blades"])).not.toContain("griffin");
  });
});
