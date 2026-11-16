import { describe, expect, it } from "vitest";
import { ARENAS } from "../engine/core/arena";
import { Battle, CRASH_STUN, type BattleEvent, type Body } from "../engine/core/battle";
import { BODY_EXTRA, DT, H, UNITS, UNIT_KINDS, W, ZONE_DEPTH, clampToZone, toWorld, type BodyKind, type Piece, type Side, type UnitKind } from "../engine/core/defs";
import { NAV_TOL, Nav } from "../engine/core/nav";
import { Rng } from "../engine/core/rng";
import {
  BLOCK_HP, COVER_KEEP, blockBottom, blockLeft, blockRight, blockTop, blocksGround, blocksShots, blocksSight, breakable, circleHitsBlock,
  mirrorBlock, segmentHitsBlock, type Block,
} from "../engine/core/terrain";

// ---------------------------------------------------------------- helpers
let nextId = 1;
const piece = (side: Side, kind: UnitKind, x: number, y: number, rank = 1): Piece => ({ id: nextId++, kind, side, x, y, rank, spent: UNITS[kind].cost });
const rect = (id: number, kind: Block["kind"], x0: number, y0: number, x1: number, y1: number, hp?: number): Block =>
  ({ id, kind, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, ...(hp ? { hp } : {}) });

/** A varied army for each side: the kinds cycle with the seed so a handful of seeds covers every unit, at every rank. */
function army(seed: number, n = 10): Piece[] {
  const rng = new Rng(seed);
  const out: Piece[] = [];
  let id = 1;
  for (const side of [0, 1] as Side[]) for (let i = 0; i < n; i++) {
    const kind = UNIT_KINDS[(seed * 5 + i * 3 + side * 7) % UNIT_KINDS.length];
    const w = toWorld(side, rng.range(0.8, W - 0.8), rng.range(0.4, ZONE_DEPTH));
    const c = clampToZone(side, w.x, w.y, UNITS[kind].radius);
    out.push({ id: id++, kind, side, x: c.x, y: c.y, rank: 1 + ((seed + i) % 4), spent: UNITS[kind].cost });
  }
  return out;
}
/** A fingerprint of a finished battle: the result plus every body's place and health. */
function digest(b: Battle) {
  let s = 0;
  for (const x of b.bodies) s += x.x * 31 + x.y * 17 + x.hp + (x.alive ? 1000 : 0);
  const r = b.result();
  return [r.winner, +r.time.toFixed(4), +r.value[0].toFixed(6), +r.value[1].toFixed(6), b.bodies.length, +s.toFixed(4)];
}
const ground = (u: Body) => u.alive && !u.flying && !u.burrowed;
/** Steps a battle to the end (or `until` seconds), handing each step's events to `each`. */
function play(b: Battle, each?: (events: BattleEvent[]) => void, until = Infinity): BattleEvent[] {
  const all: BattleEvent[] = [];
  while (!b.done && b.time < until) {
    b.step();
    all.push(...b.events);
    each?.(b.events);
    b.events.length = 0;
  }
  return all;
}
const shrink = (k: Block, by: number): Block => ({ ...k, w: Math.max(0.01, k.w - by * 2), h: Math.max(0.01, k.h - by * 2) });

// ---------------------------------------------------------------- the contract
describe("terrain geometry", () => {
  const b = rect(1, "wall", 2, 6, 5, 7);
  it("block edges, circle and segment tests", () => {
    expect([blockLeft(b), blockTop(b), blockRight(b), blockBottom(b)]).toEqual([2, 6, 5, 7]);
    expect(circleHitsBlock(b, 3, 6.5, 0.1)).toBe(true); // inside
    expect(circleHitsBlock(b, 1.6, 6.5, 0.5)).toBe(true); // overlapping a face
    expect(circleHitsBlock(b, 1.4, 6.5, 0.5)).toBe(false);
    expect(circleHitsBlock(b, 1.7, 5.7, 0.5)).toBe(true); // overlapping a corner
    expect(circleHitsBlock(b, 1.6, 5.6, 0.5)).toBe(false); // the corner is round: diagonal distance 0.57
    expect(segmentHitsBlock(b, 3, 4, 3, 9)).toBe(true); // straight through
    expect(segmentHitsBlock(b, 0, 6.5, 9, 6.5)).toBe(true);
    expect(segmentHitsBlock(b, 3, 4, 3, 5.9)).toBe(false); // stops short
    expect(segmentHitsBlock(b, 1, 4, 1.9, 9)).toBe(false); // passes beside
    expect(segmentHitsBlock(b, 1, 5, 3, 8)).toBe(true); // clips a corner
    expect(segmentHitsBlock(b, 3, 6.2, 4, 6.8)).toBe(true); // wholly inside
  });
  it("what each kind blocks", () => {
    for (const k of ["wall", "building", "barricade", "cover", "water"] as const) expect(blocksGround(k)).toBe(true);
    expect((["wall", "building", "barricade", "cover", "water"] as const).filter(blocksShots)).toEqual(["wall", "building", "barricade"]);
    expect(blocksSight).toBe(blocksShots);
    expect((["wall", "building", "barricade", "cover", "water"] as const).filter(breakable)).toEqual(["barricade", "cover"]);
  });
  it("mirrorBlock is a half turn about the board centre", () => {
    const m = mirrorBlock(b, 7, W, H);
    expect(m).toMatchObject({ id: 7, kind: "wall", x: W - 3.5, y: H - 6.5, w: 3, h: 1 });
    expect(mirrorBlock(m, 1, W, H)).toEqual(b);
  });
  it("Battle.blocks carries live state: hp for the kinds that break, alive for all", () => {
    const bt = new Battle([piece(0, "ranger", 4, 12), piece(1, "ranger", 4, 2)], { terrain: [b, rect(2, "barricade", 6, 6, 8, 7), rect(3, "cover", 0, 6, 1, 6.5, 50)] });
    expect(bt.blocks.map((k) => [k.id, k.kind, k.hp, k.maxHp, k.alive])).toEqual([[1, "wall", 0, 0, true], [2, "barricade", BLOCK_HP.barricade, BLOCK_HP.barricade, true], [3, "cover", 50, 50, true]]);
    expect(new Battle([piece(0, "ranger", 4, 12), piece(1, "ranger", 4, 2)]).blocks).toEqual([]);
  });
});

// ---------------------------------------------------------------- an open field is untouched
describe("terrain-free battles", () => {
  // Recorded from engine/core/battle.ts as it stood before terrain existed (same armies, seeds, obstacles, events).
  const BEFORE = [
    [1, 26.8333, 0, 6.281494, 36, 11860.832], [1, 11.1, 0, 54.28244, 27, 19466.834], [0, 22.6, 50.158244, 0, 30, 19331.7167], [0, 14.8, 44.504365, 0, 39, 16074.729],
    [0, 18.8667, 15.788759, 0, 29, 12750.4555], [1, 23.6333, 0, 27.908594, 38, 18743.3162], [1, 32.5, 0, 12.022109, 45, 14785.1449], [0, 22.8333, 14.948526, 0, 26, 9656.8959],
    [1, 31.9333, 0, 2.538587, 40, 12238.3718], [1, 15.4333, 0, 41.260332, 25, 13533.9962],
  ];
  const opts = (seed: number) => ({ seed: seed * 101, obstacles: seed % 3 === 0 ? [{ x: 3, y: 7, r: 0.7 }, { x: 6, y: 7, r: 0.7 }] : undefined, events: seed % 2 === 0 });
  it("give exactly the results they gave before terrain existed", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const b = new Battle(army(seed), opts(seed));
      b.run();
      expect(digest(b), `seed ${seed}`).toEqual(BEFORE[seed - 1]);
    }
  });
  it("and an empty terrain list is the same as none", () => {
    for (const seed of [2, 7]) {
      const b = new Battle(army(seed), { ...opts(seed), terrain: [] });
      b.run();
      expect(digest(b)).toEqual(BEFORE[seed - 1]);
      expect(b.blocks).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------- the invariants, on every arena
describe("battles on every arena", () => {
  const seenKinds = new Set<BodyKind>();
  let shots = 0, zaps = 0;
  for (const [ai, a] of ARENAS.entries()) {
    it(`${a.name}: nothing is ever inside a block or passes through one, and nobody shoots through a wall`, () => {
      for (const seed of [ai + 1, ai + 13, ai + 25]) {
        const b = new Battle(army(seed), { seed: seed * 7, terrain: a.blocks, events: true });
        const was = new Map<number, { x: number; y: number; ground: boolean }>();
        const live = () => b.blocks.filter((k) => k.alive);
        let bad = "";
        const fail = (what: string) => { bad ||= `${a.id} seed ${seed} t ${b.time.toFixed(2)}: ${what}`; };
        const check = (events: BattleEvent[]) => {
          const blocks = live(), wallsNow = blocks.filter((k) => blocksShots(k.kind)).map((k) => shrink(k, 0.12));
          for (const u of b.bodies) {
            if (!u.alive) continue;
            seenKinds.add(u.kind);
            if (ground(u)) {
              const p = was.get(u.id);
              for (const k of blocks) {
                if (circleHitsBlock(k, u.x, u.y, u.radius - 0.01)) fail(`${u.kind} at ${u.x.toFixed(3)}, ${u.y.toFixed(3)} is in block ${k.id}`);
                // No tunnelling: its centre's path this step never crosses a block (a blink is a teleport).
                if (p?.ground && u.kind !== "shade" && segmentHitsBlock(k, p.x, p.y, u.x, u.y)) fail(`${u.kind} went through block ${k.id}`);
              }
              if (u.x < u.radius - 1e-6 || u.x > W - u.radius + 1e-6 || u.y < u.radius - 1e-6 || u.y > H - u.radius + 1e-6) fail(`${u.kind} off the board`);
            }
            was.set(u.id, { x: u.x, y: u.y, ground: ground(u) });
          }
          // A homing direct shot is only ever loosed with a line of sight (its first step has just been taken).
          for (const p of b.projs) {
            if (!p.alive || p.target < 0 || p.over || p.t > DT * 1.5 || (p.kind !== "arrow" && p.kind !== "shard" && p.kind !== "pellet")) continue;
            const t = b.bodies.find((u) => u.id === p.target)!;
            shots++;
            for (const k of wallsNow) if (segmentHitsBlock(k, p.x0, p.y0, t.x, t.y)) fail(`${p.kind} loosed through block ${k.id}`);
          }
          // Chain lightning: every jump has a line of sight (a jump to or from something in the air goes over).
          for (const e of events) {
            if (e.t !== "zap") continue;
            zaps++;
            for (let i = 1; i < e.pts.length; i++) {
              const [x0, y0] = e.pts[i - 1], [x1, y1] = e.pts[i];
              if (b.bodies.some((u) => u.flying && (Math.hypot(u.x - x1, u.y - y1) < 0.5 || Math.hypot(u.x - x0, u.y - y0) < 0.5))) continue;
              for (const k of wallsNow) if (segmentHitsBlock(k, x0, y0, x1, y1)) fail(`lightning through block ${k.id}`);
            }
          }
        };
        check([]);
        play(b, check);
        expect(bad).toBe("");
        expect(b.done).toBe(true);
      }
    });
  }
  it("covered every unit and every spawned body, and plenty of shots", () => {
    for (const k of [...UNIT_KINDS, ...(Object.keys(BODY_EXTRA) as BodyKind[])]) expect(seenKinds.has(k), `${k} never fielded`).toBe(true);
    expect(shots).toBeGreaterThan(300);
    expect(zaps).toBeGreaterThan(10);
  });
  it("are deterministic: the same seed gives the same battle, a different seed another", () => {
    for (const a of [ARENAS[0], ARENAS[5], ARENAS[6], ARENAS[9]]) {
      const run = (seed: number) => { const b = new Battle(army(4), { seed, terrain: a.blocks }); b.run(); return digest(b); };
      expect(run(77)).toEqual(run(77));
      expect(run(77)).not.toEqual(run(78));
    }
    // With events on or off the sim is the same.
    const a = ARENAS[5].blocks;
    const quiet = new Battle(army(9), { seed: 3, terrain: a }), loud = new Battle(army(9), { seed: 3, terrain: a, events: true });
    quiet.run(); loud.run();
    expect(digest(loud)).toEqual(digest(quiet));
    expect(loud.events.length).toBeGreaterThan(0);
    expect(quiet.events.length).toBe(0);
  });
});

// ---------------------------------------------------------------- navigation
describe("navigation", () => {
  // A U open toward the bottom of the board, with a target straight through its closed end.
  const U = [rect(1, "wall", 2, 5.75, 7, 6.25), rect(2, "wall", 2, 6.25, 2.5, 8.75), rect(3, "wall", 6.5, 6.25, 7, 8.75)];
  it("a route out of a U-shaped wall goes out of the mouth and round", () => {
    const nav = new Nav(U);
    expect(nav.clear(4.5, 7.5, 4.5, 4.5, 0.25 - NAV_TOL)).toBe(false);
    expect(nav.path(4.5, 7.5, 4.5, 4.5, 0.25, 0)).toBe(true);
    expect(nav.partial).toBe(false);
    expect(nav.breach).toBe(-1);
    const pts: [number, number][] = [];
    for (let i = 0; i < nav.np; i++) pts.push([nav.pts[i * 2], nav.pts[i * 2 + 1]]);
    expect(pts.length).toBeGreaterThanOrEqual(3);
    expect(pts.length).toBeLessThanOrEqual(8);
    expect(Math.max(...pts.map((p) => p[1]))).toBeGreaterThan(8.75); // out of the mouth
    expect(pts[pts.length - 1]).toEqual([4.5, 4.5]);
    // Every leg is walkable.
    let [x, y] = [4.5, 7.5];
    for (const [px, py] of pts) { expect(nav.clear(x, y, px, py, 0.25 - NAV_TOL)).toBe(true); [x, y] = [px, py]; }
  });
  it("a unit inside the U walks out and round to an enemy behind it, without sticking", () => {
    const b = new Battle([piece(0, "duelist", 4.5, 7.5), piece(1, "hive", 4.5, 4.5)], { seed: 1, terrain: U });
    const me = b.bodies[0], hive = b.bodies[1];
    let still = 0, worst = 0, last = { x: me.x, y: me.y };
    while (!b.done && b.time < 14 && Math.hypot(me.x - hive.x, me.y - hive.y) > 1.0) {
      b.step();
      const moved = Math.hypot(me.x - last.x, me.y - last.y);
      last = { x: me.x, y: me.y };
      still = moved < 0.01 && me.stun <= 0 ? still + 1 : 0;
      worst = Math.max(worst, still);
    }
    expect(Math.hypot(me.x - hive.x, me.y - hive.y)).toBeLessThanOrEqual(1.0);
    expect(b.time).toBeLessThan(11); // about 13 units of walking at speed 2, with mites in the way
    expect(worst).toBeLessThan(30); // never a second at a standstill
  });
  it("a route is refused only when there is no way: partial routes lead as near as can be", () => {
    const sealed = [rect(1, "wall", 0, 6.75, 9, 7.25)];
    const nav = new Nav(sealed);
    expect(nav.reachable(4.5, 10, 4.5, 3, 0.3)).toBe(false);
    expect(nav.path(4.5, 10, 4.5, 3, 0.3, 0)).toBe(true);
    expect(nav.partial).toBe(true);
    expect(nav.pts[nav.np * 2 - 1]).toBeGreaterThan(7.25);
    expect(nav.pts[nav.np * 2 - 1]).toBeLessThan(8);
  });
  it("gaps: open to a body that fits, closed to one that does not", () => {
    const gate = [rect(1, "wall", 0, 6.75, 4, 7.25), rect(2, "wall", 5, 6.75, 9, 7.25)]; // a gate 1.0 wide
    const nav = new Nav(gate);
    expect(nav.reachable(4.5, 10, 4.5, 3, UNITS.ravager.radius)).toBe(true); // 0.6 across
    expect(nav.reachable(4.5, 10, 4.5, 3, UNITS.golem.radius)).toBe(false); // 1.1 across
    const b = new Battle([piece(0, "ravager", 2, 10), piece(1, "ballista", 4.5, 3)], { seed: 1, terrain: gate });
    play(b);
    expect(b.winner).toBe(0);
  });
});

// ---------------------------------------------------------------- sight and shots
describe("sight and direct fire", () => {
  const wall = [rect(1, "wall", 3, 6.75, 6, 7.25)];
  it("bolts stop on a wall and never reach what is behind it; shells are lobbed over", () => {
    const ballista = piece(0, "ballista", 4.5, 10), near = piece(1, "bombard", 4.5, 8), far = piece(1, "bombard", 4.5, 5);
    const b = new Battle([ballista, near, far], { seed: 2, terrain: wall, events: true });
    const [mine, front, behind] = b.bodies;
    const ev = play(b, undefined, 30);
    const ric = ev.filter((e) => e.t === "ricochet");
    expect(ric.length).toBeGreaterThan(0);
    for (const e of ric) if (e.t === "ricochet") {
      expect(e.kind).toBe("bolt");
      expect(e.block).toBe(1);
      expect(e.y).toBeCloseTo(7.25, 3); // on the near face
    }
    expect(front.hp).toBeLessThan(front.maxHp); // pierced on the way
    expect(behind.hp).toBe(behind.maxHp); // never touched
    expect(mine.hp).toBeLessThan(mine.maxHp); // the far bombard's shells came over the wall
    expect(ev.some((e) => e.t === "boom" && e.kind === "shell")).toBe(true);
    // Once the one it can see is dead, the ballista has nothing to shoot at and holds its fire.
    if (!front.alive) {
      const after = b.projs.filter((p) => p.alive && p.kind === "bolt").length;
      play(b, undefined, b.time + 6);
      expect(b.projs.filter((p) => p.alive && p.kind === "bolt").length).toBeLessThanOrEqual(after);
    }
  });
  it("with no line of sight a shooter holds fire and walks round until it has one", () => {
    const b = new Battle([piece(0, "ranger", 4.5, 9), piece(1, "ballista", 4.5, 5.5)], { seed: 3, terrain: wall, events: true });
    const [ranger, target] = b.bodies;
    let firstShot = -1, at = { x: 0, y: 0 };
    play(b, (events) => {
      for (const e of events) if (e.t === "shot" && e.id === ranger.id && firstShot < 0) { firstShot = b.time; at = { x: ranger.x, y: ranger.y }; }
    }, 20);
    // It started 3.5 away (well inside bow range) but behind the wall: no shot until it had stepped out.
    expect(firstShot).toBeGreaterThan(0.7);
    expect(segmentHitsBlock(wall[0], at.x, at.y, target.x, target.y)).toBe(false);
    expect(target.hp).toBeLessThan(target.maxHp);
    // On an open field it shoots at once.
    const open = new Battle([piece(0, "ranger", 4.5, 9), piece(1, "ballista", 4.5, 5.5)], { seed: 3, events: true });
    let openShot = -1;
    play(open, (events) => { for (const e of events) if (e.t === "shot" && e.id === open.bodies[0].id && openShot < 0) openShot = open.time; }, 5);
    expect(openShot).toBeGreaterThan(0);
    expect(openShot).toBeLessThan(0.7);
  });
  it("melee does not reach through a wall, and a mine does not hear footsteps through one", () => {
    // A pikeman (reach 1.0) one side of a thin wall, a ballista hard against the other.
    const thin = [rect(1, "wall", 0, 6.9, 9, 7.2)];
    const b = new Battle([piece(0, "pikeman", 4.5, 7.5), piece(0, "mine", 3, 7.45), piece(1, "ballista", 4.5, 6.45), piece(1, "blades", 3, 6.5)], { seed: 4, terrain: thin, events: true });
    const ev = play(b, undefined, 10);
    expect(b.bodies.find((u) => u.kind === "ballista")!.hp).toBe(UNITS.ballista.hp);
    expect(ev.some((e) => e.t === "fuse")).toBe(false);
    expect(b.bodies.find((u) => u.kind === "mine")!.state).toBe("armed");
  });
  it("cover: a direct shot across it at a target close behind keeps COVER_KEEP of its damage and chips the cover", () => {
    const cover = [rect(1, "cover", 3.5, 6.5, 5.5, 6.9)];
    const first = (terrain?: Block[]) => {
      const b = new Battle([piece(0, "ranger", 4.5, 9.8), piece(1, "hive", 4.5, 6.0)], { seed: 5, terrain, events: true });
      const hive = b.bodies[1];
      let hit = 0, chip: BattleEvent | undefined;
      play(b, (events) => {
        for (const e of events) {
          if (e.t === "hit" && e.id === hive.id && !hit) hit = e.dmg;
          if (e.t === "blockhit" && !chip) chip = e;
        }
      }, 4);
      return { hit, chip, block: b.blocks[0] };
    };
    const open = first(), covered = first(cover);
    expect(open.hit).toBe(UNITS.ranger.dmg);
    expect(covered.hit).toBe(Math.round(UNITS.ranger.dmg * COVER_KEEP));
    expect(covered.chip).toMatchObject({ t: "blockhit", id: 1, dmg: Math.round(UNITS.ranger.dmg * (1 - COVER_KEEP)), by: -1 });
    expect(covered.block.hp).toBeLessThan(BLOCK_HP.cover);
    expect(covered.block.hp).toBeGreaterThan(0);
    // A target standing well back from the cover gets nothing from it.
    const far = new Battle([piece(0, "ranger", 4.5, 9.8), piece(1, "hive", 4.5, 6.0)], { seed: 5, terrain: [rect(1, "cover", 3.5, 7.6, 5.5, 8.0)], events: true });
    let farHit = 0;
    play(far, (events) => { for (const e of events) if (e.t === "hit" && e.id === far.bodies[1].id && !farHit) farHit = e.dmg; }, 4);
    expect(farHit).toBe(UNITS.ranger.dmg);
  });
  it("cover breaks once it has soaked its health, and then it is open ground", () => {
    const b = new Battle([piece(0, "ranger", 4.5, 9.8), piece(0, "ranger", 4.0, 9.8), piece(1, "ballista", 4.5, 6.0, 3)], { seed: 6, terrain: [rect(9, "cover", 3.5, 6.5, 5.5, 6.9, 20)], events: true });
    const ev = play(b, undefined, 12);
    const broke = ev.find((e) => e.t === "blockbreak");
    expect(broke).toMatchObject({ t: "blockbreak", id: 9, kind: "cover", x: 4.5, y: expect.closeTo(6.7, 6), w: 2, h: expect.closeTo(0.4, 6) });
    expect(b.blocks[0]).toMatchObject({ alive: false, hp: 0 });
    const hits = ev.filter((e) => e.t === "blockhit");
    expect(hits[hits.length - 1]).toMatchObject({ hp: 0 });
  });
});

// ---------------------------------------------------------------- breaking through
describe("barricades", () => {
  const sealed = [rect(1, "wall", 0, 6.75, 3.5, 7.25), rect(2, "barricade", 3.5, 6.75, 5.5, 7.25), rect(3, "wall", 5.5, 6.75, 9, 7.25)];
  it("melee with no other way in breaks the barricade, and the way through opens", () => {
    const b = new Battle([piece(0, "blades", 4.5, 9.5), piece(1, "ballista", 4.5, 3)], { seed: 7, terrain: sealed, events: true });
    const blades = b.bodies.filter((u) => u.kind === "blades");
    let brokeAt = -1, crossedAt = -1;
    const ev = play(b, (events) => {
      if (events.some((e) => e.t === "blockbreak")) brokeAt = b.time;
      if (crossedAt < 0 && blades.some((u) => u.alive && u.y < 6.5)) crossedAt = b.time;
      // Until it breaks, nobody is across.
      if (brokeAt < 0) for (const u of blades) expect(u.y).toBeGreaterThan(7.25);
    });
    const hits = ev.filter((e) => e.t === "blockhit");
    expect(hits.length).toBeGreaterThan(5);
    for (const e of hits) if (e.t === "blockhit") { expect(e.id).toBe(2); expect(blades.map((u) => u.id)).toContain(e.by); }
    expect(brokeAt).toBeGreaterThan(2);
    expect(brokeAt).toBeLessThan(14);
    expect(crossedAt).toBeGreaterThan(brokeAt);
    expect(crossedAt).toBeLessThan(brokeAt + 2.5); // the cached routes were thrown away when it broke
    expect(b.blocks[1].alive).toBe(false);
    expect(b.winner).toBe(0);
  });
  it("shooters never break in: a barricade is a wall to them", () => {
    const b = new Battle([piece(0, "ranger", 4.5, 9.5), piece(1, "ballista", 4.5, 3)], { seed: 7, terrain: sealed, events: true });
    const ev = play(b, undefined, 20);
    expect(ev.some((e) => e.t === "blockhit")).toBe(false);
    expect(b.bodies[0].y).toBeGreaterThan(7.25);
  });
  it("siege prefers to break a barricade in its way where others walk round", () => {
    // A barricade straight ahead, an open gate five units along the wall.
    const pass = [rect(1, "barricade", 0, 6.75, 2.5, 7.25), rect(2, "wall", 2.5, 6.75, 7, 7.25)];
    const run = (kind: UnitKind) => {
      const b = new Battle([piece(0, kind, 1.25, 9), piece(1, "ballista", 1.25, 4.5)], { seed: 8, terrain: pass, events: true });
      const me = b.bodies[0];
      let maxX = 0;
      const ev = play(b, () => { if (me.alive) maxX = Math.max(maxX, me.x); }, 40);
      return { broke: ev.some((e) => e.t === "blockbreak"), struck: ev.filter((e) => e.t === "blockhit" && e.by === me.id).length, maxX };
    };
    const golem = run("golem"), duelist = run("duelist");
    expect(golem.broke).toBe(true);
    expect(golem.struck).toBeGreaterThanOrEqual(2);
    expect(golem.maxX).toBeLessThan(3);
    expect(duelist.struck).toBe(0);
    expect(duelist.maxX).toBeGreaterThan(7); // round by the gate
  });
  it("a keg blows itself up on the barricade and takes it down in one", () => {
    const b = new Battle([piece(0, "keg", 4.5, 9.5), piece(0, "medic", 4.5, 13), piece(1, "ballista", 4.5, 3)], { seed: 9, terrain: sealed, events: true });
    const ev = play(b, undefined, 8);
    expect(ev.some((e) => e.t === "boom" && e.kind === "keg")).toBe(true);
    expect(ev.find((e) => e.t === "blockbreak")).toMatchObject({ id: 2, kind: "barricade" });
  });
  it("blasts wear down barricades and cover in reach, and leave walls alone", () => {
    const yard = [rect(1, "barricade", 3.5, 6.75, 5.5, 7.25, 60), rect(2, "wall", 0, 6.75, 3.5, 7.25)];
    const b = new Battle([piece(0, "grenadier", 4.5, 11, 3), piece(1, "ballista", 4.5, 7.75), piece(1, "ballista", 3.2, 7.75)], { seed: 10, terrain: yard, events: true });
    const ev = play(b, undefined, 12);
    expect(ev.some((e) => e.t === "blockhit" && e.id === 1 && e.by === -1)).toBe(true);
    expect(ev.some((e) => e.t === "blockhit" && e.id === 2)).toBe(false);
    expect(b.blocks[1]).toMatchObject({ alive: true, hp: 0, maxHp: 0 });
  });
});

// ---------------------------------------------------------------- the special movers
describe("charges, fliers and burrowers", () => {
  const across = [rect(1, "wall", 0, 6.75, 9, 7.25)];
  it("a lancer that charges into a wall stops there, dazed, and hurts nothing behind it", () => {
    const b = new Battle([piece(0, "lancer", 4.5, 11), piece(1, "ranger", 4.5, 8.0), piece(1, "ballista", 4.5, 6.3)], { seed: 11, terrain: across, events: true });
    const lancer = b.bodies[0], behind = b.bodies[2];
    let crash: BattleEvent | undefined, stunned = 0;
    play(b, (events) => {
      const c = events.find((e) => e.t === "crash");
      if (c && !crash) { crash = c; stunned = lancer.stun; expect(lancer.state).toBe("aim"); expect(Math.hypot(lancer.vx, lancer.vy)).toBeLessThan(0.01); }
      expect(lancer.y).toBeGreaterThanOrEqual(7.25 + lancer.radius - 1e-3);
    }, 12);
    expect(crash).toMatchObject({ t: "crash", id: lancer.id });
    if (crash?.t === "crash") expect(crash.y).toBeCloseTo(7.25, 2);
    expect(stunned).toBeGreaterThan(CRASH_STUN - DT * 2);
    expect(behind.hp).toBe(behind.maxHp);
  });
  it("with no straight run the lancer trots round the wall instead of charging it", () => {
    const b = new Battle([piece(0, "lancer", 4.5, 9), piece(1, "ballista", 4.5, 5)], { seed: 12, terrain: [rect(1, "wall", 2.5, 6.75, 6.5, 7.25)], events: true });
    const ev = play(b, undefined, 25);
    expect(ev.some((e) => e.t === "crash")).toBe(false);
    expect(ev.some((e) => e.t === "charge")).toBe(true);
    expect(b.bodies[1].hp).toBeLessThan(b.bodies[1].maxHp);
  });
  it("fliers cross a wall no ground unit can", () => {
    const b = new Battle([piece(0, "harrier", 3, 10), piece(0, "griffin", 6, 10), piece(0, "bulwark", 4.5, 9), piece(1, "ballista", 4.5, 3), piece(1, "medic", 6, 2)], { seed: 13, terrain: across });
    const [harrier, griffin, bulwark] = b.bodies;
    let hy = 99, gy = 99;
    while (!b.done && b.time < 20) {
      b.step();
      if (harrier.alive) hy = Math.min(hy, harrier.y);
      if (griffin.alive) gy = Math.min(gy, griffin.y);
      expect(bulwark.y).toBeGreaterThan(7.25);
      // Down from its dive the griffin is a ground body: never on the wall.
      if (griffin.alive && !griffin.flying) expect(circleHitsBlock(across[0], griffin.x, griffin.y, griffin.radius - 0.01)).toBe(false);
    }
    expect(hy).toBeLessThan(6.5);
    expect(gy).toBeLessThan(6.5);
  });
  it("a sapper tunnels under and never surfaces inside a block", () => {
    // Its mark stands hard against the far side of a thick building.
    const block = [rect(1, "building", 2.5, 5.5, 6.5, 8.5)];
    const b = new Battle([piece(0, "sapper", 4.5, 10), piece(1, "ballista", 4.5, 5.05)], { seed: 14, terrain: block, events: true });
    const sapper = b.bodies[0];
    let under = false, up: BattleEvent | undefined;
    play(b, (events) => {
      if (sapper.burrowed && circleHitsBlock(block[0], sapper.x, sapper.y, 0.01)) under = true;
      up ??= events.find((e) => e.t === "emerge");
      if (!sapper.burrowed && sapper.alive) expect(circleHitsBlock(block[0], sapper.x, sapper.y, sapper.radius - 0.01)).toBe(false);
    }, 15);
    expect(under).toBe(true); // straight under the building
    expect(up).toBeTruthy();
    if (up?.t === "emerge") expect(circleHitsBlock(block[0], up.x, up.y, sapper.radius - 0.01)).toBe(false);
    expect(b.bodies[1].hp).toBeLessThan(b.bodies[1].maxHp);
  });
  it("a shade blinks to free ground beside its mark, never into a block", () => {
    // The spot behind the mark (toward its own back edge) is inside a building.
    const house = [rect(1, "building", 3.5, 3.0, 5.5, 4.6)];
    const b = new Battle([piece(0, "shade", 4.5, 7.5), piece(1, "ranger", 4.5, 4.9)], { seed: 15, terrain: house, events: true });
    const ev = play(b, undefined, 10);
    const blink = ev.find((e) => e.t === "blink");
    expect(blink).toBeTruthy();
    if (blink?.t === "blink") expect(circleHitsBlock(house[0], blink.x, blink.y, UNITS.shade.radius - 0.01)).toBe(false);
  });
});

describe("blasts and walls", () => {
  it("a blast does not reach a body fully behind a wall", () => {
    const wall = [rect(1, "wall", 2.5, 6.75, 6.5, 7.25)];
    const run = (terrain?: Block[]) => {
      const b = new Battle([piece(0, "mine", 4.5, 7.6), piece(0, "medic", 4.5, 13), piece(1, "bulwark", 4.5, 7.95), piece(1, "ballista", 4.5, 6.3)], { seed: 16, terrain, events: true });
      const ev = play(b, undefined, 1.2);
      return { boom: ev.some((e) => e.t === "boom" && e.kind === "mine"), near: b.bodies[2], behind: b.bodies[3] };
    };
    const walled = run(wall), open = run();
    expect(walled.boom).toBe(true);
    expect(walled.near.hp).toBeLessThan(walled.near.maxHp);
    expect(walled.behind.hp).toBe(walled.behind.maxHp);
    expect(open.behind.hp).toBeLessThan(open.behind.maxHp); // the same blast with no wall
  });
  it("a body only half behind the wall's end is still caught", () => {
    const wall = [rect(1, "wall", 2.5, 6.75, 4.6, 7.25)];
    const b = new Battle([piece(0, "mine", 4.5, 7.6), piece(0, "medic", 4.5, 13), piece(1, "bulwark", 4.5, 7.95), piece(1, "ballista", 4.75, 6.3)], { seed: 16, terrain: wall, events: true });
    play(b, undefined, 1.2);
    expect(b.bodies[3].hp).toBeLessThan(b.bodies[3].maxHp);
  });
  it("lobbed shots aimed into a building come down beside it", () => {
    const hall = [rect(1, "building", 3, 5, 6, 7)];
    const b = new Battle([piece(0, "grenadier", 4.5, 10.5), piece(1, "lancer", 4.5, 4.4)], { seed: 17, terrain: hall, events: true });
    play(b, (events) => {
      for (const e of events) if (e.t === "boom" && (e.kind === "grenade")) expect(circleHitsBlock(hall[0], e.x, e.y, 0.01)).toBe(false);
    }, 12);
  });
});

describe("spawned bodies in arenas", () => {
  it("mites, turrets, decoys, thralls and shardlings all appear on free ground", () => {
    // Makers hard against walls, so the usual spawn spot is inside one.
    const yard = [rect(1, "wall", 0, 8.0, 9, 8.5), rect(2, "building", 3.4, 9.1, 5.6, 10.2)];
    const pieces = [
      piece(0, "hive", 2, 9.0, 4), piece(0, "tinker", 6.2, 8.85), piece(0, "trickster", 3.05, 9.5), piece(0, "grave", 7.5, 8.85, 4), piece(0, "golem", 1, 9.2),
      piece(1, "grenadier", 2, 5.5, 3), piece(1, "bombard", 6, 3, 3), piece(1, "harrier", 4.5, 4), piece(1, "storm", 7, 5),
    ];
    const b = new Battle(pieces, { seed: 18, terrain: yard, events: true });
    const kinds = new Set<string>();
    play(b, (events) => {
      for (const e of events) if (e.t === "spawn") {
        kinds.add(e.kind);
        const r = b.bodies.find((u) => u.id === e.id)!.radius;
        for (const k of yard) expect(circleHitsBlock(k, e.x, e.y, r - 0.01), `${e.kind} spawned in block ${k.id}`).toBe(false);
      }
    }, 30);
    for (const k of ["mite", "queen", "turret", "decoy"]) expect(kinds.has(k), k).toBe(true);
  });
});
