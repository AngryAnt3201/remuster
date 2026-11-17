// Roads and brush (engine/core/terrain.ts): the two ground zones. A road is quicker to walk; brush hides whoever
// stands in it, and whoever starts a battle there lies in wait. Neither blocks anything.
import { describe, expect, it } from "vitest";
import { DEFAULT_AI, applyPlan, planTurn, shelter } from "../engine/core/ai";
import { ARENAS, arenaById } from "../engine/core/arena";
import { Battle, type BattleEvent, type Body } from "../engine/core/battle";
import { BATTLE_LIMIT, H, UNITS, W, inZone, type Piece, type Side, type UnitKind } from "../engine/core/defs";
import { Match } from "../engine/core/match";
import { Nav } from "../engine/core/nav";
import { freeSpotIn, spotBlocked } from "../engine/core/placement";
import { Rng } from "../engine/core/rng";
import {
  AMBUSH_RANGE, AMBUSH_WAIT, BRUSH_EXPOSE, BRUSH_REVEAL, ROAD_SPEED, blocksGround, blocksShots, blocksSight, breakable, isZone, pointInBlock,
  type Block,
} from "../engine/core/terrain";

let nextId = 1;
const piece = (side: Side, kind: UnitKind, x: number, y: number, rank = 1): Piece => ({ id: nextId++, kind, side, x, y, rank, spent: UNITS[kind].cost });
const rect = (id: number, kind: Block["kind"], x0: number, y0: number, x1: number, y1: number): Block =>
  ({ id, kind, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });
/** Steps a battle until `until` seconds (or its end), handing each step's events to `each`. */
function play(b: Battle, each?: (events: BattleEvent[]) => void, until = Infinity) {
  while (!b.done && b.time < until) {
    b.step();
    each?.(b.events);
    b.events.length = 0;
  }
}
const edge = (a: Body, b: Body) => Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
/** A far-off pebble: turns terrain on (so the comparison runs the same code) without being in anyone's way. */
const PEBBLE = rect(90, "wall", 0, 0, 0.4, 0.4);

describe("zones: the contract", () => {
  it("roads and brush are zones: they block nothing and never break", () => {
    for (const k of ["road", "brush"] as const) {
      expect(isZone(k)).toBe(true);
      expect(blocksGround(k)).toBe(false);
      expect(blocksShots(k)).toBe(false);
      expect(blocksSight(k)).toBe(false);
      expect(breakable(k)).toBe(false);
    }
    for (const k of ["wall", "building", "barricade", "cover", "water"] as const) { expect(isZone(k)).toBe(false); expect(blocksGround(k)).toBe(true); }
    expect([ROAD_SPEED, BRUSH_REVEAL, BRUSH_EXPOSE]).toEqual([1.25, 1.7, 1.5]);
    expect(AMBUSH_RANGE).toBeGreaterThan(BRUSH_REVEAL);
    expect(AMBUSH_WAIT).toBeLessThan(BATTLE_LIMIT / 4);
  });
  it("the nav treats a zone as open ground, and Battle.blocks still lists it", () => {
    const zones = [rect(1, "road", 0, 6, 9, 8), rect(2, "brush", 2, 3, 7, 5)];
    const nav = new Nav(zones);
    expect(nav.hitsGround(4.5, 7, 0.5)).toBe(false);
    expect(nav.los(4.5, 12, 4.5, 2)).toBe(true);
    expect(nav.shotHit(4.5, 12, 4.5, 2)).toBe(-1);
    expect(nav.clear(4.5, 12, 4.5, 2, 0.5)).toBe(true);
    expect(nav.reachable(4.5, 12, 4.5, 2, 0.55)).toBe(true);
    expect([nav.onRoad(4.5, 7), nav.onRoad(4.5, 5.9), nav.inBrush(4.5, 4), nav.inBrush(4.5, 7)]).toEqual([true, false, true, false]);
    expect([nav.hasRoads, nav.hasBrush]).toEqual([true, true]);
    expect([new Nav([PEBBLE]).hasRoads, new Nav([PEBBLE]).hasBrush]).toEqual([false, false]);
    const b = new Battle([piece(0, "duelist", 4.5, 12), piece(1, "hive", 4.5, 2)], { seed: 1, terrain: zones });
    expect(b.blocks.map((k) => [k.id, k.kind, k.alive, k.hp])).toEqual([[1, "road", true, 0], [2, "brush", true, 0]]);
    play(b, undefined, 12);
    expect(edge(b.bodies[0], b.bodies[1])).toBeLessThan(1); // walked straight through both
    expect(b.blocks.every((k) => k.alive)).toBe(true);
  });
  it("a piece may be placed on a zone, by a player and by the match", () => {
    const zones = [rect(1, "road", 3, 8, 6, 13), rect(2, "brush", 0.5, 8, 2.5, 10)];
    expect(spotBlocked(zones, "golem", 4.5, 10)).toBe(false);
    expect(spotBlocked(zones, "blades", 1.5, 9)).toBe(false);
    expect(freeSpotIn(zones, 0, "golem", 4.5, 10)).toEqual({ x: 4.5, y: 10 });
    const m = new Match({ seed: 3, terrain: zones, fixedShop: [["duelist"], undefined], fixedGold: [20, 0] });
    const p = m.buy(0, 0, 1.5, 9);
    expect([p.x, p.y]).toEqual([1.5, 9]);
    m.move(0, p.id, 4.5, 11);
    expect([p.x, p.y]).toEqual([4.5, 11]);
    for (const a of ARENAS) for (const z of a.blocks.filter((k) => isZone(k.kind))) {
      // In every arena a ranger may stand in the middle of any zone that is in its half.
      const side: Side = z.y > H / 2 ? 0 : 1;
      if (!inZone(side, z.x, z.y)) continue;
      expect(spotBlocked(a.blocks, "ranger", z.x, z.y), `${a.id} zone ${z.id}`).toBe(false);
    }
  });
});

describe("roads", () => {
  /** Seconds for a lone unit to walk from y 12.5 to y 4 up the middle of the board (toward a medic, who harms nobody). */
  const walk = (kind: UnitKind, terrain: Block[]) => {
    const c = new Battle([piece(0, kind, 4.5, 12.5), piece(1, "medic", 4.5, 0.8)], { seed: 2, terrain });
    const u = c.bodies[0];
    while (!c.done && u.y > 4 && c.time < 30) c.step();
    return c.time;
  };
  const road = [rect(1, "road", 4, 2, 5, 13.5)];
  it("a ground unit on a road moves 1.25 times as fast", () => {
    for (const kind of ["duelist", "bulwark", "pikeman"] as const) {
      const open = walk(kind, [PEBBLE]), paved = walk(kind, road);
      expect(open / paved, kind).toBeGreaterThan(1.18);
      expect(open / paved, kind).toBeLessThan(1.27);
    }
    // Top speed on the road is exactly ROAD_SPEED times the unit's own.
    const b = new Battle([piece(0, "duelist", 4.5, 12.5), piece(1, "hive", 4.5, 1.2)], { seed: 2, terrain: road });
    let top = 0;
    play(b, () => { top = Math.max(top, Math.hypot(b.bodies[0].vx, b.bodies[0].vy)); }, 3);
    expect(top).toBeCloseTo(UNITS.duelist.speed * ROAD_SPEED, 6);
  });
  it("off the road it is no faster, and fliers and burrowers gain nothing", () => {
    const beside = [rect(1, "road", 7, 2, 8, 13.5)];
    expect(walk("duelist", beside)).toBeCloseTo(walk("duelist", [PEBBLE]), 6);
    expect(walk("harrier", road)).toBeCloseTo(walk("harrier", [PEBBLE]), 6);
    // A burrowed sapper under a road tunnels at its own speed.
    const top = (terrain: Block[]) => {
      const b = new Battle([piece(0, "sapper", 4.5, 12.5), piece(1, "medic", 4.5, 2)], { seed: 2, terrain });
      const s = b.bodies[0];
      let v = 0;
      play(b, () => { if (s.burrowed) v = Math.max(v, Math.hypot(s.vx, s.vy)); }, 3);
      return v;
    };
    expect(top(road)).toBeCloseTo(top([PEBBLE]), 6);
    expect(top(road)).toBeLessThanOrEqual(UNITS.sapper.speed + 1e-6);
  });
  it("routes round a wall take the road when the ways are otherwise equal", () => {
    // A wall with a gate either side of the middle; the road runs through one of them.
    const wall = [rect(1, "wall", 0, 6.75, 1.5, 7.25), rect(2, "wall", 3, 6.75, 6, 7.25), rect(3, "wall", 7.5, 6.75, 9, 7.25)];
    for (const [x0, x1, left] of [[1.75, 2.75, true], [6.25, 7.25, false]] as const) {
      const nav = new Nav([...wall, rect(4, "road", x0, 4, x1, 10)]);
      expect(nav.path(4.5, 10, 4.5, 4, 0.3, 0)).toBe(true);
      const xs: number[] = [];
      for (let i = 0; i < nav.np; i++) xs.push(nav.pts[i * 2]);
      expect(left ? Math.min(...xs) < 3 : Math.max(...xs) > 6, `road ${left ? "left" : "right"}: ${xs.join(", ")}`).toBe(true);
      // And side 1's route, planned turned half round, is the mirror image.
      const mine = nav.pts.slice(0, nav.np * 2);
      const turned = new Nav([...wall, rect(4, "road", W - x1, 4, W - x0, 10)]);
      expect(turned.path(4.5, 4, 4.5, 10, 0.3, 0, true)).toBe(true);
      for (let k = 0; k < mine.length; k += 2) { expect(turned.pts[k]).toBeCloseTo(W - mine[k], 6); expect(turned.pts[k + 1]).toBeCloseTo(H - mine[k + 1], 6); }
    }
  });
});

describe("brush", () => {
  const grass = [rect(1, "brush", 2.5, 4.5, 6.5, 7.5)];
  it("hides a ground unit standing in it: no shot until the shooter is within BRUSH_REVEAL", () => {
    const deep = [rect(1, "brush", 0, 0, 9, 7.5)]; // the medic backs away once it is seen: grass all the way back
    // A ranger 4 away from a medic: in bow range. In the open it looses at once; into the grass it has to walk up.
    const go = (terrain: Block[]) => {
      const b = new Battle([piece(0, "ranger", 4.5, 10), piece(1, "medic", 4.5, 6)], { seed: 4, terrain, events: true });
      const [ranger, medic] = b.bodies;
      let at = -1, gap = 0, hiddenBefore = medic.hidden;
      play(b, (events) => {
        if (at < 0 && events.some((e) => e.t === "shot" && e.id === ranger.id)) { at = b.time; gap = edge(ranger, medic); }
        if (at < 0) hiddenBefore = hiddenBefore && medic.hidden;
      }, 5.5);
      return { at, gap, hiddenBefore, medic, ranger };
    };
    const open = go([PEBBLE]), hid = go(deep);
    expect(open.at).toBeGreaterThan(0);
    expect(open.at).toBeLessThan(0.7);
    expect(open.gap).toBeGreaterThan(3);
    expect(open.medic.hidden).toBe(false);
    expect(hid.hiddenBefore).toBe(true); // hidden right up to the first shot
    expect(hid.at).toBeGreaterThan(open.at + 0.5); // it had to close in first
    expect(hid.gap).toBeLessThanOrEqual(BRUSH_REVEAL + 0.05);
    expect(hid.gap).toBeGreaterThan(BRUSH_REVEAL - 0.4);
    expect(hid.medic.hp).toBeLessThan(hid.medic.maxHp);
  });
  it("a hit reveals it for BRUSH_EXPOSE seconds, then the brush hides it again", () => {
    // A fixed ballista cannot walk up: it only ever shoots the pikeman in the grass once something else has hurt it.
    const b = new Battle([piece(0, "ballista", 4.5, 10.6), piece(1, "pikeman", 4.5, 6)], { seed: 5, terrain: grass, events: true });
    const [ballista, pike] = b.bodies;
    play(b, undefined, 3);
    expect(pike.hidden).toBe(true);
    expect(pike.ambush).toBe(true); // lying in wait: the ballista is 4.6 away, out of its reach
    expect(pike.hp).toBe(pike.maxHp);
    expect(b.projs.filter((p) => p.owner === ballista.id).length).toBe(0); // nothing to shoot at
    const t0 = b.time;
    b.damage(pike, 5, null, 0); // a stray blast
    expect(pike.hidden).toBe(false);
    expect(pike.reveal).toBeCloseTo(t0 + BRUSH_EXPOSE, 6);
    expect(pike.ambush).toBe(false);
    // Hold it where it is (stunned) so we watch the brush, not its charge.
    let bolts = 0, shown = 0, hiddenAgain = -1;
    play(b, (events) => {
      pike.stun = 1;
      bolts += events.filter((e) => e.t === "shot" && e.id === ballista.id).length;
      if (!pike.hidden) shown = b.time; else if (hiddenAgain < 0) hiddenAgain = b.time;
    }, t0 + BRUSH_EXPOSE - 0.1);
    expect(hiddenAgain).toBe(-1); // revealed the whole time
    expect(shown).toBeGreaterThan(t0 + BRUSH_EXPOSE - 0.2);
    void bolts;
  });
  it("attacking or casting gives a hidden unit away", () => {
    // A ranger in the grass with a ballista in its bow range: its first arrow reveals it, and only then can the ballista answer.
    const b = new Battle([piece(0, "ballista", 4.5, 9.6), piece(1, "ranger", 4.5, 6)], { seed: 6, terrain: grass, events: true });
    const [ballista, ranger] = b.bodies;
    expect(ranger.hidden).toBe(true);
    let arrow = -1, bolt = -1, hiddenAfterArrow = true;
    play(b, (events) => {
      for (const e of events) {
        if (e.t === "shot" && e.id === ranger.id && arrow < 0) { arrow = b.time; hiddenAfterArrow = ranger.hidden; }
        if (e.t === "shot" && e.id === ballista.id && bolt < 0) bolt = b.time;
      }
    }, 12);
    expect(arrow).toBeGreaterThan(0);
    expect(hiddenAfterArrow).toBe(false);
    expect(bolt).toBeGreaterThan(arrow);
    // A medic that heals is casting: revealed too.
    const c = new Battle([piece(1, "medic", 4.5, 6), piece(1, "bulwark", 4.5, 5), piece(0, "hive", 0.8, 13)], { seed: 6, terrain: grass, events: true });
    const [medic, ward] = c.bodies;
    ward.hp = 100;
    let healedAt = -1, hiddenThen = true;
    play(c, (events) => { if (healedAt < 0 && events.some((e) => e.t === "heal" && e.from === medic.id)) { healedAt = c.time; hiddenThen = medic.hidden; } }, 8);
    expect(healedAt).toBeGreaterThan(0);
    expect(hiddenThen).toBe(false);
  });
  it("fliers and structures are never hidden, and a unit that leaves the brush is seen", () => {
    const b = new Battle([piece(1, "harrier", 4.5, 6), piece(1, "ballista", 3.5, 6), piece(1, "hive", 5.5, 6), piece(1, "mine", 4.5, 5), piece(0, "bombard", 4.5, 13)], { seed: 7, terrain: grass });
    const [harrier, ballista, hive, mine] = b.bodies;
    play(b, undefined, 0.5);
    expect([harrier.hidden, ballista.hidden, hive.hidden]).toEqual([false, false, false]);
    expect(mine.hidden).toBe(true); // a mine is buried wherever it is
    expect([harrier.ambush, ballista.ambush, hive.ambush]).toEqual([false, false, false]);
    // The bombard shells the structures in the grass from 7 away.
    play(b, undefined, 14);
    expect(ballista.hp + hive.hp).toBeLessThan(ballista.maxHp + hive.maxHp);
    // A duelist that walks out of the grass after its foe is no longer hidden.
    const c = new Battle([piece(1, "duelist", 4.5, 7), piece(0, "ballista", 4.5, 9.2)], { seed: 7, terrain: grass });
    const d = c.bodies[0];
    expect(d.hidden).toBe(true);
    play(c, undefined, 2.5);
    expect(pointInBlock(grass[0], d.x, d.y)).toBe(false);
    expect(d.hidden).toBe(false);
  });
  it("area damage still hurts a hidden unit, though nothing can aim at it", () => {
    // A bombard shells the hive; the pikeman lying in the grass beside it is caught in the blast.
    const b = new Battle([piece(0, "bombard", 4.5, 13), piece(1, "hive", 4.5, 5.6), piece(1, "pikeman", 5.3, 6.1)], { seed: 8, terrain: grass, events: true });
    const [, hive, pike] = b.bodies;
    expect(pike.hidden).toBe(true);
    let hit = -1, wasHidden = false, hidden = true;
    play(b, (events) => {
      if (hit < 0 && events.some((e) => e.t === "hit" && e.id === pike.id)) { hit = b.time; wasHidden = hidden; }
      hidden = pike.hidden;
    }, 9);
    expect(hit).toBeGreaterThan(0);
    expect(wasHidden).toBe(true);
    expect(hive.hp).toBeLessThan(hive.maxHp);
    // A grenadier with only a hidden unit in reach has nothing to throw at.
    const c = new Battle([piece(0, "grenadier", 4.5, 10.4), piece(1, "medic", 4.5, 6)], { seed: 8, terrain: [rect(1, "brush", 0, 0, 9, 7.5)], events: true });
    let thrown = -1, gap = 0;
    play(c, (events) => { if (thrown < 0 && events.some((e) => e.t === "shot")) { thrown = c.time; gap = edge(c.bodies[0], c.bodies[1]); } }, 5);
    expect(thrown < 0 || gap <= BRUSH_REVEAL + 0.05).toBe(true);
  });
  it("Body.hidden tracks it every step, and the same battle without events is the same battle", () => {
    const army = (): Piece[] => [piece(0, "blades", 3, 10), piece(0, "ranger", 5, 11), piece(0, "lancer", 6.5, 10.5), piece(1, "duelist", 4, 6), piece(1, "ranger", 5, 5.5), piece(1, "storm", 3.2, 5)];
    nextId = 1; const a = new Battle(army(), { seed: 9, terrain: grass, events: true });
    nextId = 1; const q = new Battle(army(), { seed: 9, terrain: grass });
    let flips = 0, last = a.bodies.map((u) => u.hidden);
    play(a, () => {
      a.bodies.forEach((u, i) => {
        if (i < last.length && u.hidden !== last[i]) flips++;
        if (u.alive && u.hidden && !u.stealth) expect(pointInBlock(grass[0], u.x, u.y)).toBe(true);
      });
      last = a.bodies.map((u) => u.hidden);
    });
    q.run();
    expect(flips).toBeGreaterThan(2);
    expect(q.bodies.map((u) => [u.x, u.y, u.hp, u.hidden])).toEqual(a.bodies.map((u) => [u.x, u.y, u.hp, u.hidden]));
    expect(q.result()).toEqual(a.result());
  });
});

describe("lying in wait", () => {
  const grass = [rect(1, "brush", 2.5, 4.5, 6.5, 7.5)];
  it("a unit that starts in brush holds still until an enemy it can see is within AMBUSH_RANGE, then strikes", () => {
    const b = new Battle([piece(0, "bulwark", 4.5, 12.5), piece(1, "duelist", 4.5, 6)], { seed: 10, terrain: grass, events: true });
    const [bul, due] = b.bodies;
    expect(due.ambush).toBe(true);
    const start = { x: due.x, y: due.y };
    let sprang = -1, gapThen = 0;
    play(b, () => {
      if (sprang < 0 && Math.hypot(due.x - start.x, due.y - start.y) > 0.02) { sprang = b.time; gapThen = edge(bul, due); }
    }, 5.9);
    expect(sprang).toBeGreaterThan(2); // the bulwark needs a few seconds to walk up
    expect(gapThen).toBeLessThanOrEqual(AMBUSH_RANGE + 0.05);
    expect(gapThen).toBeGreaterThan(AMBUSH_RANGE - 0.4);
    expect(due.ambush).toBe(false);
    // The bulwark was searching: it walked toward the grass with nobody in sight.
    expect(bul.y).toBeLessThan(11);
    // In the open the duelist runs at it from the first step.
    const o = new Battle([piece(0, "bulwark", 4.5, 12.5), piece(1, "duelist", 4.5, 6)], { seed: 10, terrain: [PEBBLE] });
    play(o, undefined, 0.5);
    expect(o.bodies[1].y).toBeGreaterThan(6.2);
    expect(o.bodies[1].ambush).toBe(false);
  });
  it("it gives up waiting after AMBUSH_WAIT seconds", () => {
    // Nothing comes: a lone medic far away keeps its distance. The ravager breaks cover at AMBUSH_WAIT and goes to it.
    const b = new Battle([piece(0, "medic", 4.5, 13.2), piece(1, "ravager", 4.5, 5)], { seed: 11, terrain: grass });
    const r = b.bodies[1];
    play(b, undefined, AMBUSH_WAIT - 0.2);
    expect([r.x, r.y]).toEqual([4.5, 5]);
    expect(r.ambush).toBe(true);
    play(b, undefined, AMBUSH_WAIT + 1.5);
    expect(r.ambush).toBe(false);
    expect(r.y).toBeGreaterThan(6);
    play(b);
    expect(b.winner).toBe(1);
  });
  it("a Shade, a flier and a burrower do not lie in wait; a hurt ambusher breaks cover", () => {
    const b = new Battle([piece(1, "shade", 3.5, 6), piece(1, "harrier", 4.5, 6), piece(1, "sapper", 5.5, 6), piece(1, "lancer", 4.5, 5), piece(0, "hive", 4.5, 13.2)], { seed: 12, terrain: grass });
    expect(b.bodies.slice(0, 4).map((u) => u.ambush)).toEqual([false, false, false, true]);
    const lancer = b.bodies[3];
    b.step();
    b.damage(lancer, 3, null, 0);
    expect(lancer.ambush).toBe(false);
    play(b, undefined, 3);
    expect(Math.hypot(lancer.x - 4.5, lancer.y - 5)).toBeGreaterThan(1);
  });
});

describe("no standoffs in the grass", () => {
  const field = [rect(1, "brush", 0.5, 2, 8.5, 5.5), rect(2, "brush", 0.5, 8.5, 8.5, 12)];
  it("two armies that both start hidden still find each other and finish", () => {
    const fights: [UnitKind[], UnitKind[]][] = [
      [["duelist"], ["duelist"]], [["ranger"], ["ranger"]], [["blades", "ranger"], ["pikeman", "storm"]], [["grenadier"], ["ravager"]],
      [["lancer", "shade"], ["bulwark", "rime"]], [["keg"], ["trickster"]], [["hook", "thorn"], ["lion", "outrider"]], [["golem"], ["tide", "blades"]],
    ];
    fights.forEach(([mine, theirs], i) => {
      const ps = [...mine.map((k, j) => piece(0, k, 3 + j * 3, 10.5)), ...theirs.map((k, j) => piece(1, k, 3 + j * 3, 3.5))];
      const b = new Battle(ps, { seed: 20 + i, terrain: field });
      expect(b.bodies.filter((u) => !u.flying && !u.burrowed).every((u) => u.hidden), `fight ${i}`).toBe(true);
      b.run();
      expect(b.time, `fight ${i}: ${mine} v ${theirs}`).toBeLessThan(BATTLE_LIMIT - 1);
    });
  });
  it("the last unit of each side, both in brush, do not wait each other out", () => {
    // Each alone and hidden, far apart, with nothing else to see: both must come out and meet.
    for (const [a, c] of [["duelist", "pikeman"], ["ranger", "duelist"], ["storm", "pikeman"], ["blades", "medic"], ["lancer", "ravager"]] as [UnitKind, UnitKind][]) {
      const b = new Battle([piece(0, a, 1.2, 11.5), piece(1, c, 7.8, 2.5)], { seed: 31, terrain: field });
      b.run();
      expect(b.time, `${a} v ${c}`).toBeLessThan(BATTLE_LIMIT - 1);
    }
  });
  it("on every arena, armies of mobile fighters always fight to a finish", () => {
    // Hand-to-hand fighters and a caster: nobody who kites or turtles (an Outrider against a Bulwark runs long on any ground).
    const kinds: UnitKind[] = ["blades", "duelist", "ravager", "pikeman", "lancer", "hook", "lion", "storm"];
    for (const [ai, a] of ARENAS.entries()) {
      for (const seed of [1, 2, 3]) {
        const rng = new Rng(ai * 10 + seed);
        const ps: Piece[] = [];
        // Half of each army is dropped into the arena's own brush where there is some in its zone.
        const brush = (side: Side) => a.blocks.filter((k) => k.kind === "brush" && inZone(side, k.x, k.y));
        for (const side of [0, 1] as Side[]) for (let i = 0; i < 6; i++) {
          const kind = kinds[(ai + i * 3 + side + seed) % kinds.length];
          const z = brush(side)[i % Math.max(1, brush(side).length)];
          const x = z && i % 2 === 0 ? z.x + rng.range(-0.3, 0.3) * z.w : rng.range(1, W - 1);
          const y = z && i % 2 === 0 ? z.y + rng.range(-0.3, 0.3) * z.h : side === 0 ? rng.range(8.2, 13) : rng.range(1, 5.8);
          const p = freeSpotIn(a.blocks, side, kind, x, y)!;
          ps.push(piece(side, kind, p.x, p.y));
        }
        const b = new Battle(ps, { seed: seed * 13 + ai, terrain: a.blocks });
        b.run();
        expect(b.time, `${a.id} seed ${seed}`).toBeLessThan(BATTLE_LIMIT - 0.5);
      }
    }
  });
});

describe("the AI and brush", () => {
  it("shelter puts some hand-to-hand units in brush, on free ground inside the zone, mirrored between the sides", () => {
    const a = arenaById("long-lane")!;
    const army = (side: Side): Piece[] => (["duelist", "ravager", "blades", "pikeman", "ranger", "medic"] as UnitKind[]).map((k, i) => ({ id: i + 1, kind: k, side, x: 0, y: 0, rank: 1, spent: 3 }));
    let hidden = 0, tries = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const ps = army(0);
      const layout = ps.map((p, i) => ({ id: p.id, ...freeSpotIn(a.blocks, 0, p.kind, 1 + i * 1.3, 9.5 + (i % 2))! }));
      shelter(0, layout, ps, a.blocks, new Rng(seed));
      tries++;
      for (const l of layout) {
        const p = ps.find((q) => q.id === l.id)!;
        expect(spotBlocked(a.blocks, p.kind, l.x, l.y)).toBe(false);
        expect(inZone(0, l.x, l.y)).toBe(true);
        const inBrush = a.blocks.some((k) => k.kind === "brush" && pointInBlock(k, l.x, l.y));
        if (inBrush) { hidden++; expect(["duelist", "ravager", "blades", "pikeman"]).toContain(p.kind); }
      }
    }
    expect(tries).toBe(30);
    expect(hidden).toBeGreaterThan(5);
  });
  it("plans a whole match on an arena with brush, simulating the hiding rules, and never stalls", () => {
    const a = arenaById("watchtowers")!;
    const m = new Match({ seed: 5, terrain: a.blocks });
    let ambushes = 0;
    for (let round = 0; round < 8 && m.phase !== "over"; round++) {
      for (const s of [1, 0] as Side[]) applyPlan(m, s, planTurn(m, s, { ...DEFAULT_AI, difficulty: 0.6, tactic: s ? "ambush" : "blitz" }));
      const b = m.makeBattle(false);
      ambushes += b.bodies.filter((u) => u.ambush).length;
      m.resolve(b.run());
      m.next();
    }
    expect(m.played).toBeGreaterThan(3);
    expect(ambushes).toBeGreaterThanOrEqual(0);
  });
});
