// The twelve v2 units, the four 1.1 units, the flying and burrowing layers, and every unit's Ascended (rank 4) ability.
import { describe, expect, it } from "vitest";
import { Battle, type BattleEvent, type Body } from "../engine/core/battle";
import { ABILITIES, BODY_EXTRA, H, UNITS, UNIT_KINDS, W, rankHp, type BodyKind, type Piece, type Side, type UnitKind } from "../engine/core/defs";
import { DEFAULT_AI, POWER, TACTICS, draftArmy } from "../engine/core/ai";
import { LEVELS, rosterAt } from "../engine/core/campaign";

let nid = 1;
const P = (kind: UnitKind, side: Side, x: number, y: number, rank = 1): Piece => ({ id: nid++, kind, side, x, y, rank, spent: UNITS[kind].cost });
const run = (b: Battle, seconds: number) => { for (let t = 0; t < seconds * 30 && !b.done; t++) b.step(); };
/** Steps until `until` is true (or the time runs out); returns whether it happened. */
const runUntil = (b: Battle, seconds: number, until: () => boolean) => {
  for (let t = 0; t < seconds * 30 && !b.done; t++) { b.step(); if (until()) return true; }
  return false;
};
const events = <T extends BattleEvent["t"]>(b: Battle, t: T) => b.events.filter((e) => e.t === t) as Extract<BattleEvent, { t: T }>[];
const dist = (a: Body, c: Body) => Math.hypot(a.x - c.x, a.y - c.y);
const one = (b: Battle, kind: BodyKind, side?: Side) => b.bodies.find((x) => x.kind === kind && (side === undefined || x.side === side))!;
const all = (b: Battle, kind: BodyKind, side?: Side) => b.bodies.filter((x) => x.kind === kind && (side === undefined || x.side === side));
/** A punching bag: never acts or moves. */
const pin = (...bs: Body[]) => { for (const x of bs) x.frozen = 999; };
const swings = (b: Battle, body: Body, seconds: number) => {
  let n = 0, last = body.swing;
  for (let t = 0; t < seconds * 30 && !b.done; t++) { b.step(); if (body.swing !== last) { n++; last = body.swing; } }
  return n;
};

describe("air and underground", () => {
  it("melee can't touch a flyer; shooters and spells can; it ignores mines and collision", () => {
    const b = new Battle([P("harrier", 0, 4.5, 9), P("blades", 1, 4.5, 6), P("ranger", 1, 2, 3), P("mine", 1, 4.5, 9)], { seed: 1, events: true });
    const h = one(b, "harrier"), blade = one(b, "blades"), ranger = one(b, "ranger"), mine = one(b, "mine");
    expect(h.flying).toBe(true);
    expect(h.z).toBeGreaterThan(1);
    expect(b.nearestEnemy(blade)).toBeUndefined();
    expect(b.nearestEnemy(ranger)?.id).toBe(h.id);
    run(b, 1);
    expect(mine.state).toBe("armed");
    // Only arrows ever land on it.
    const b2 = new Battle([P("harrier", 0, 4.5, 9), P("blades", 1, 4.5, 6), P("golem", 1, 3, 5)], { seed: 2, events: true });
    const h2 = one(b2, "harrier");
    run(b2, 12);
    expect(h2.hp).toBe(h2.maxHp);
    expect(events(b2, "hit").some((e) => e.side === 0)).toBe(true);
    const b3 = new Battle([P("harrier", 0, 4.5, 9), P("ranger", 1, 4.5, 4), P("blades", 1, 3, 4)], { seed: 3 });
    run(b3, 6);
    expect(one(b3, "harrier").hp).toBeLessThan(one(b3, "harrier").maxHp);
  });

  it("harrier dives low onto its prey, strikes, then climbs and circles again", () => {
    const b = new Battle([P("harrier", 0, 4.5, 11), P("grenadier", 1, 4.5, 3)], { seed: 4, events: true });
    const h = one(b, "harrier"), g = one(b, "grenadier");
    let low = 9;
    for (let i = 0; i < 150; i++) { b.step(); low = Math.min(low, h.z); }
    expect(events(b, "dive").length).toBeGreaterThanOrEqual(2);
    expect(low).toBeLessThan(0.4);
    expect(g.hp).toBeLessThan(g.maxHp);
    expect(runUntil(b, 3, () => h.z > 1.1)).toBe(true);
    // It goes for prey that can't shoot back.
    const c = new Battle([P("harrier", 0, 4.5, 11), P("ranger", 1, 4, 5), P("grenadier", 1, 6, 3)], { seed: 4 });
    c.step();
    expect(one(c, "harrier").target).toBe(one(c, "grenadier").id);
  });

  it("sapper tunnels unseen past a mine to the back line, leaves a trail, and erupts stunning what is near", () => {
    const b = new Battle([
      P("sapper", 0, 4.5, 12.5), P("mine", 1, 4.5, 8),
      P("bulwark", 1, 4.5, 5.5), P("ranger", 1, 4.5, 2), P("ballista", 1, 6.5, 1.5),
    ], { seed: 5, events: true });
    const s = one(b, "sapper"), mine = one(b, "mine");
    expect(s.burrowed).toBe(true);
    expect(events(b, "burrow")).toHaveLength(1);
    for (const e of b.bodies.filter((x) => x.side === 1)) expect(b.nearestEnemy(e)).toBeUndefined();
    let stunned = 0;
    const up = runUntil(b, 8, () => {
      const em = events(b, "emerge")[0];
      if (em && !stunned) stunned = b.bodies.filter((e) => e.side === 1 && e.alive && Math.hypot(e.x - em.x, e.y - em.y) < em.r + e.radius && e.stun > 0.8).length;
      return !!em;
    });
    expect(up).toBe(true);
    expect(events(b, "hit").filter((e) => e.id === s.id)).toHaveLength(0);
    expect(events(b, "dig").length).toBeGreaterThan(5);
    expect(mine.state).toBe("armed");
    const em = events(b, "emerge")[0];
    expect(em.y).toBeLessThan(3.5); // came up in the back line
    expect(stunned).toBeGreaterThanOrEqual(1);
    expect(s.burrowed).toBe(false);
    run(b, 2);
    expect(events(b, "hit").some((e) => e.side === 0)).toBe(true);
  });
});

describe("the v2 units", () => {
  it("standard bearer: allies within 2 attack 25% faster", () => {
    const b = new Battle([P("banner", 0, 2, 12), P("ballista", 0, 2.7, 12), P("ballista", 0, 7.5, 12), P("bulwark", 1, 4.5, 0.6)], { seed: 6, events: true });
    const flag = one(b, "banner"), [near, far] = all(b, "ballista");
    flag.speed = 0;
    one(b, "bulwark").speed = 0;
    near.cd = far.cd = 5;
    run(b, 1);
    expect(near.buff).toBeGreaterThan(0);
    expect(far.buff).toBeLessThanOrEqual(0);
    expect((5 - near.cd) / (5 - far.cd)).toBeCloseTo(1.25, 2);
    expect(events(b, "aura").length).toBeGreaterThanOrEqual(1);
  });

  it("rimecaller's shards slow what they hit to half speed", () => {
    const b = new Battle([P("rime", 0, 4.5, 11), P("lancer", 1, 4.5, 6.5)], { seed: 7, events: true });
    const l = one(b, "lancer");
    expect(runUntil(b, 4, () => l.slow > 0)).toBe(true);
    expect(events(b, "chill")[0].id).toBe(l.id);
    expect(events(b, "shot").some((e) => e.kind === "shard")).toBe(true);
    let top = 0;
    for (let i = 0; i < 20 && l.slow > 0; i++) { b.step(); if (i > 8) top = Math.max(top, Math.hypot(l.vx, l.vy)); }
    expect(top).toBeLessThanOrEqual(l.speed * 0.5 + 0.05);
  });

  it("ravager hunts the toughest enemy and strikes faster the more it bleeds", () => {
    const b = new Battle([P("ravager", 0, 4.5, 9), P("ranger", 1, 3.5, 6), P("bulwark", 1, 6, 5)], { seed: 8 });
    b.step();
    expect(one(b, "ravager").target).toBe(one(b, "bulwark").id);
    const duel = (hurt: number) => {
      const d = new Battle([P("ravager", 0, 4.5, 8), P("grave", 1, 4.5, 7.2, 3)], { seed: 9 });
      const r = one(d, "ravager");
      pin(one(d, "grave"));
      r.hp = r.maxHp * hurt;
      return swings(d, r, 6);
    };
    expect(duel(0.2) / duel(1)).toBeGreaterThan(1.8);
  });

  it("gravecaller raises the fallen nearby as thralls for its side, four at most", () => {
    const b = new Battle([
      P("grave", 0, 4.5, 11), P("bulwark", 0, 4.5, 12.5),
      ...[3, 3.6, 4.2, 4.8, 5.4, 6].map((x) => P("ranger", 1, x, 9.5)), P("ranger", 1, 4.5, 4), P("ballista", 1, 4.5, 0.6),
    ], { seed: 10, events: true });
    const g = one(b, "grave");
    g.speed = 0;
    const near = all(b, "ranger").filter((r) => r.y > 9);
    pin(...b.bodies.filter((x) => x.side === 1), one(b, "bulwark"));
    for (const r of near) { b.damage(r, 9999, null, 0); run(b, 0.7); }
    b.damage(all(b, "ranger").find((r) => r.y < 5)!, 9999, null, 0); // too far away to raise
    const thralls = all(b, "thrall");
    expect(thralls).toHaveLength(4);
    for (const t of thralls) { expect(t.side).toBe(0); expect(t.owner).toBe(g.id); }
    expect(events(b, "raise")).toHaveLength(4);
    expect(events(b, "raise").every((e) => e.from === g.id)).toBe(true);
  });

  it("bombard lobs a high shell at a far group, but can't hit anything close", () => {
    const b = new Battle([P("bombard", 0, 4.5, 12.5), P("blades", 1, 4.5, 5.5)], { seed: 11, events: true });
    pin(...all(b, "blades"));
    let peak = 0;
    expect(runUntil(b, 4, () => { for (const p of b.projs) if (p.kind === "shell") peak = Math.max(peak, p.z); return events(b, "boom").some((e) => e.kind === "shell"); })).toBe(true);
    expect(peak).toBeGreaterThan(2.5);
    expect(all(b, "blades").some((x) => x.hp < x.maxHp)).toBe(true);
    const c = new Battle([P("bombard", 0, 4.5, 12.5), P("blades", 1, 4.5, 10.8)], { seed: 11, events: true });
    pin(...all(c, "blades"));
    run(c, 5);
    expect(events(c, "shot")).toHaveLength(0);
  });

  it("tinker builds a turret that shoots, and patches up damaged structures", () => {
    const b = new Battle([P("tinker", 0, 4.5, 12), P("ballista", 0, 3, 12.8), P("blades", 1, 4.5, 8.2)], { seed: 12, events: true });
    const bal = one(b, "ballista");
    bal.hp = Math.round(bal.maxHp * 0.5);
    bal.range = 0; // keep the bolts out of it
    pin(...all(b, "blades"));
    const hurt = bal.hp;
    run(b, 8);
    const tu = one(b, "turret");
    expect(tu).toBeTruthy();
    expect(tu.owner).toBe(one(b, "tinker").id);
    expect(tu.structure).toBe(true);
    expect(events(b, "build").length).toBeGreaterThanOrEqual(1);
    expect(events(b, "shot").some((e) => e.kind === "pellet")).toBe(true);
    expect(events(b, "repair").length).toBeGreaterThan(0);
    expect(bal.hp).toBeGreaterThan(hurt);
  });

  it("duelist parries a blow for nothing and ripostes; it hunts enemy melee", () => {
    const b = new Battle([P("duelist", 0, 4.5, 8), P("blades", 1, 4.5, 7.4), P("ranger", 1, 2, 5)], { seed: 13, events: true });
    const d = one(b, "duelist"), foe = one(b, "blades");
    expect(d.parryCd).toBeLessThanOrEqual(0);
    const before = foe.hp;
    expect(b.damage(d, 50, foe, 1, false, foe)).toBe(0);
    expect(d.hp).toBe(d.maxHp);
    const p = events(b, "parry")[0];
    expect(p).toMatchObject({ id: d.id, by: foe.id, riposte: true });
    expect(before - foe.hp).toBeCloseTo(d.dmg * 1.5);
    b.damage(d, 50, foe, 1, false, foe); // the next blow lands
    expect(d.hp).toBe(d.maxHp - 50);
    const c = new Battle([P("duelist", 0, 4.5, 9), P("ranger", 1, 4.5, 6.8), P("blades", 1, 6, 5)], { seed: 13 });
    c.step();
    // The ranger is nearer, but it goes for the swords.
    expect(c.bodies.find((x) => x.id === one(c, "duelist").target)?.kind).toBe("blades");
  });

  it("pikeman braces against a lancer's charge and stops it cold", () => {
    const b = new Battle([P("pikeman", 0, 4.5, 9.5), P("lancer", 1, 4.5, 3.5)], { seed: 14, events: true });
    const pk = one(b, "pikeman"), l = one(b, "lancer");
    expect(runUntil(b, 4, () => events(b, "impale").length > 0)).toBe(true);
    expect(events(b, "brace").length).toBeGreaterThanOrEqual(1);
    expect(events(b, "impale")[0].target).toBe(l.id);
    expect(l.state).not.toBe("charge");
    expect(l.maxHp - l.hp).toBeGreaterThanOrEqual(pk.dmg * 4 - 1);
    expect(pk.hp).toBe(pk.maxHp); // stopped before it reached the pikes' owner
  });

  it("pikes stop a kegrunner too", () => {
    const b = new Battle([P("pikeman", 0, 4.5, 9.5), P("ranger", 0, 4.5, 11), P("keg", 1, 4.5, 4)], { seed: 15, events: true });
    const k = one(b, "keg");
    expect(runUntil(b, 5, () => events(b, "impale").some((e) => e.target === k.id))).toBe(true);
    expect(k.hp).toBeLessThan(k.maxHp);
  });

  it("kegrunner sprints at the thickest group and blows up there; shot down first, it fizzles", () => {
    const b = new Battle([P("keg", 0, 4.5, 12), P("ranger", 1, 2, 7.5), P("blades", 1, 6.5, 6), P("medic", 1, 7, 5.3)], { seed: 16, events: true });
    const k = one(b, "keg");
    pin(...b.bodies.filter((x) => x.side === 1));
    expect(runUntil(b, 5, () => events(b, "boom").some((e) => e.kind === "keg"))).toBe(true);
    const boom = events(b, "boom").find((e) => e.kind === "keg")!;
    expect(boom.x).toBeGreaterThan(5);
    expect(k.alive).toBe(false);
    expect(events(b, "light")).toHaveLength(1);
    expect(new Set(events(b, "hit").filter((e) => e.side === 0).map((e) => e.id)).size).toBeGreaterThanOrEqual(3);
    const c = new Battle([P("keg", 0, 4.5, 12), P("blades", 1, 4.5, 4)], { seed: 16, events: true });
    c.damage(one(c, "keg"), 9999, null, 1);
    run(c, 1);
    expect(events(c, "death").some((e) => e.kind === "keg")).toBe(true);
    expect(events(c, "boom").some((e) => e.kind === "keg")).toBe(false);
  });

  it("trickster throws out decoys that draw attacks, and casts again once they pop", () => {
    const b = new Battle([P("trickster", 0, 4.5, 10), P("blades", 1, 4.5, 6)], { seed: 17, events: true });
    const t = one(b, "trickster");
    expect(runUntil(b, 1, () => all(b, "decoy").length === 2)).toBe(true);
    const decoys = all(b, "decoy");
    for (const d of decoys) { expect(d.owner).toBe(t.id); expect(d.side).toBe(0); }
    expect(events(b, "decoy")).toHaveLength(2);
    run(b, 1.5);
    const hitIds = new Set(events(b, "hit").filter((e) => e.side === 1).map((e) => e.id));
    expect(decoys.some((d) => hitIds.has(d.id))).toBe(true);
    expect(runUntil(b, 10, () => events(b, "decoy").length > 2)).toBe(true);
    expect(events(b, "pop").length).toBeGreaterThanOrEqual(2);
    // Illusions can't hold the field, and they vanish with their maker.
    const c = new Battle([P("trickster", 0, 4.5, 10), P("blades", 1, 4.5, 4)], { seed: 17 });
    run(c, 1);
    c.damage(one(c, "trickster"), 9999, null, 1);
    expect(all(c, "decoy").every((d) => !d.alive)).toBe(true);
    c.step();
    expect(c.done).toBe(true);
    expect(c.winner).toBe(1);
  });
});

describe("ascended (rank 4) abilities", () => {
  it("every unit has a named signature ability", () => {
    for (const k of UNIT_KINDS) {
      expect(ABILITIES[k].name.length).toBeGreaterThan(2);
      expect(ABILITIES[k].text.length).toBeGreaterThan(10);
      expect(ABILITIES[k].text.length).toBeLessThanOrEqual(80);
    }
  });

  it("Mine, Cluster: the blast throws three bomblets that burst a moment later", () => {
    const b = new Battle([P("ranger", 0, 0.5, 13.5), P("mine", 0, 4.5, 8, 4), P("bulwark", 1, 4.5, 7.2, 3), P("bulwark", 1, 5.4, 8.6, 3)], { seed: 20, events: true });
    expect(runUntil(b, 3, () => events(b, "bomblets").length > 0)).toBe(true);
    const bl = events(b, "bomblets")[0];
    expect(bl.pts).toHaveLength(3);
    expect(bl.at - b.time).toBeCloseTo(0.6, 1);
    expect(b.fuses).toHaveLength(3);
    run(b, 0.8);
    expect(events(b, "boom").filter((e) => e.kind === "bomblet")).toHaveLength(3);
    expect(b.fuses).toHaveLength(0);
  });

  it("Blade Trio, Whirlwind: every third slash spins all the way round", () => {
    const b = new Battle([P("blades", 0, 4.5, 8, 4), ...[0, 1, 2, 3].map((i) => P("bulwark", 1, 4.5 + Math.cos(i * 1.57) * 1.1, 8 + Math.sin(i * 1.57) * 1.1, 3))], { seed: 21, events: true });
    pin(...all(b, "bulwark"));
    run(b, 4);
    const sl = events(b, "slash");
    expect(sl.filter((e) => e.spin).length).toBeGreaterThan(0);
    const perBlade = new Map<number, boolean[]>();
    for (const e of sl) perBlade.set(e.id, [...(perBlade.get(e.id) ?? []), !!e.spin]);
    for (const seq of perBlade.values()) seq.forEach((spin, i) => expect(spin).toBe(i % 3 === 2));
  });

  it("Ranger, Volley: every fourth shot is three arrows in a fan", () => {
    const b = new Battle([P("ranger", 0, 4.5, 11, 4), P("bulwark", 1, 4, 7, 3), P("bulwark", 1, 5.2, 7, 3)], { seed: 22, events: true });
    pin(...all(b, "bulwark"));
    expect(runUntil(b, 8, () => events(b, "volley").length > 0)).toBe(true);
    const shots = events(b, "shot");
    expect(shots).toHaveLength(6); // three single shots, then the fan
  });

  it("Bulwark, Bastion: allies just behind it take 30% less; bashes stun longer", () => {
    const b = new Battle([P("bulwark", 0, 4.5, 8, 4), P("ranger", 0, 4.5, 9), P("ranger", 0, 4.5, 6.8), P("ballista", 1, 4.5, 1)], { seed: 23 });
    const bw = one(b, "bulwark"), [behind, ahead] = all(b, "ranger", 0);
    bw.face = -Math.PI / 2;
    b.damage(behind, 50, { x: 4.5, y: 2 }, 1);
    b.damage(ahead, 50, { x: 4.5, y: 2 }, 1);
    expect(behind.maxHp - behind.hp).toBeCloseTo(35);
    expect(ahead.maxHp - ahead.hp).toBeCloseTo(50);
    const stunOf = (rank: number) => {
      const c = new Battle([P("bulwark", 0, 4.5, 8, rank), P("ranger", 1, 4.5, 7.25)], { seed: 24 });
      const r = one(c, "ranger");
      pin(r);
      let top = 0;
      for (let i = 0; i < 60; i++) { c.step(); top = Math.max(top, r.stun); }
      return top;
    };
    expect(stunOf(4)).toBeGreaterThan(0.5);
    expect(stunOf(3)).toBeLessThan(0.3);
  });

  it("Medic, Revive: the first nearby ally to fall gets back up at half health, once", () => {
    const b = new Battle([P("medic", 0, 4.5, 12, 4), P("bulwark", 0, 4.5, 10.5), P("blades", 0, 7, 12), P("ballista", 1, 4.5, 1)], { seed: 25, events: true });
    const bw = one(b, "bulwark");
    b.damage(bw, 99999, null, 1);
    expect(bw.alive).toBe(true);
    expect(bw.hp).toBe(Math.round(bw.maxHp * 0.5));
    expect(events(b, "revive")).toHaveLength(1);
    b.damage(bw, 99999, null, 1);
    expect(bw.alive).toBe(false);
    const blade = one(b, "blades");
    b.damage(blade, 99999, null, 1);
    expect(blade.alive).toBe(false);
  });

  it("Grenadier, Firebomb: bombs leave the ground burning for 3 seconds", () => {
    const b = new Battle([P("grenadier", 0, 4.5, 11, 4), P("bulwark", 1, 4.5, 7, 3)], { seed: 26, events: true });
    const bw = one(b, "bulwark");
    pin(bw);
    expect(runUntil(b, 4, () => b.zones.length > 0)).toBe(true);
    const z = b.zones[0], made = b.time;
    expect(z.until - made).toBeCloseTo(3, 1);
    expect(events(b, "zone")).toHaveLength(1);
    one(b, "grenadier").cd = 99; // no more bombs: only the fire now
    const hp = bw.hp;
    run(b, 1);
    expect(bw.hp).toBeLessThan(hp);
    run(b, 2.5);
    expect(b.zones).toHaveLength(0);
  });

  it("Shade, Shadow Step: a kill readies the next blink at once", () => {
    const b = new Battle([P("shade", 0, 1, 12, 4), ...[2.5, 4.5, 6.5].map((x) => P("medic", 1, x, 3)), P("ballista", 1, 4.5, 0.6)], { seed: 27, events: true });
    run(b, 5);
    expect(events(b, "reset").length).toBeGreaterThanOrEqual(1);
    expect(events(b, "blink").length).toBeGreaterThanOrEqual(2); // without the reset, blinks are 5 s apart
  });

  it("Lancer, Trample: charges go through big units and stun all they pass", () => {
    const charge = (rank: number) => {
      const b = new Battle([P("lancer", 0, 4.5, 11, rank), P("bulwark", 1, 4.5, 7.6), P("ranger", 1, 4.5, 6.2), P("ranger", 1, 4.5, 5.2)], { seed: 28, events: true });
      pin(...b.bodies.filter((x) => x.side === 1));
      const l = one(b, "lancer");
      runUntil(b, 3, () => l.state === "wheel");
      return { hits: l.hits.length, stun: Math.min(...b.bodies.filter((x) => l.hits.includes(x.id) && x.alive && !x.structure).map((x) => x.stun)) };
    };
    expect(charge(3).hits).toBe(1); // stopped by the shield
    const t = charge(4);
    expect(t.hits).toBeGreaterThanOrEqual(2);
    expect(t.stun).toBeGreaterThan(0.3);
  });

  it("Ballista, Twin Bolt: two bolts in a narrow spread", () => {
    const b = new Battle([P("ballista", 0, 4.5, 12, 4), P("bulwark", 1, 4.5, 7, 3)], { seed: 29, events: true });
    pin(one(b, "bulwark"));
    expect(runUntil(b, 4, () => events(b, "twin").length > 0)).toBe(true);
    expect(events(b, "shot").filter((e) => e.kind === "bolt")).toHaveLength(2);
  });

  it("Hive, Brood Queen: one tough queen, and mites burst when they die", () => {
    const b = new Battle([P("hive", 0, 4.5, 12, 4), P("bulwark", 1, 4.5, 2, 3)], { seed: 30, events: true });
    run(b, 8);
    const queens = all(b, "queen");
    expect(queens).toHaveLength(1);
    expect(queens[0].maxHp).toBeGreaterThan(all(b, "mite")[0].maxHp * 4);
    const m = all(b, "mite").find((x) => x.alive)!;
    b.damage(m, 9999, null, 1);
    expect(events(b, "boom").some((e) => e.kind === "pop")).toBe(true);
  });

  it("Stormcaller, Overcharge: three more jumps and a longer stun", () => {
    const zap = (rank: number) => {
      const b = new Battle([P("storm", 0, 4.5, 11, rank), ...[3, 3.8, 4.6, 5.4, 6.2].flatMap((x) => [P("ranger", 1, x, 7.2), P("ranger", 1, x, 6.4)])], { seed: 31, events: true });
      pin(...b.bodies.filter((x) => x.side === 1));
      runUntil(b, 3, () => events(b, "zap").length > 0);
      return { jumps: events(b, "zap")[0].pts.length - 1, stun: Math.max(...b.bodies.filter((x) => x.side === 1).map((x) => x.stun)) };
    };
    const base = zap(3), over = zap(4);
    expect(base.jumps).toBe(5);
    expect(over.jumps).toBe(8);
    expect(over.stun).toBeGreaterThan(0.5);
  });

  it("Stone Colossus, Quake: every third slam is a wide stunning quake", () => {
    const b = new Battle([P("golem", 0, 4.5, 8, 4), P("bulwark", 1, 4.5, 7, 3), P("ranger", 1, 6.2, 8)], { seed: 32, events: true });
    pin(...b.bodies.filter((x) => x.side === 1));
    expect(runUntil(b, 8, () => events(b, "boom").some((e) => e.kind === "quake"))).toBe(true);
    const booms = events(b, "boom").filter((e) => e.kind === "slam" || e.kind === "quake");
    expect(booms.map((e) => e.kind)).toEqual(["slam", "slam", "quake"]);
    expect(booms[2].r).toBeCloseTo(2);
    expect(one(b, "ranger").hp).toBeLessThan(one(b, "ranger").maxHp);
  });

  it("Sapper, Cave-in: it bursts up twice as wide and hurts all it throws", () => {
    const up = (rank: number) => {
      const b = new Battle([P("sapper", 0, 4.5, 12, rank), P("ranger", 1, 4.5, 3), P("ranger", 1, 6, 3), P("ballista", 1, 4.5, 1.2)], { seed: 33, events: true });
      pin(...b.bodies.filter((x) => x.side === 1));
      runUntil(b, 8, () => events(b, "emerge").length > 0);
      return { e: events(b, "emerge")[0], hurt: b.bodies.filter((x) => x.side === 1 && x.hp < x.maxHp).length };
    };
    const plain = up(3), cave = up(4);
    expect(cave.e.r).toBeCloseTo(plain.e.r * 2);
    expect(cave.e.big).toBe(true);
    expect(plain.hurt).toBe(0);
    expect(cave.hurt).toBeGreaterThanOrEqual(2);
  });

  it("Harrier, Talon Dive: dives hit everything underneath and knock it back", () => {
    const b = new Battle([P("harrier", 0, 4.5, 11, 4), P("grenadier", 1, 4.5, 4), P("blades", 1, 4.5, 4.6)], { seed: 34, events: true });
    expect(runUntil(b, 6, () => events(b, "boom").some((e) => e.kind === "talon"))).toBe(true);
    const t = events(b, "boom").find((e) => e.kind === "talon")!;
    const hit = new Set(events(b, "hit").filter((e) => e.side === 0).map((e) => e.id));
    expect(hit.size).toBeGreaterThanOrEqual(2);
    expect(t.r).toBeCloseTo(0.9);
  });

  it("Standard Bearer, Rally: the flag also adds 20% damage and heals 2% a second", () => {
    const b = new Battle([P("banner", 0, 2, 12, 4), P("bulwark", 0, 2.8, 12), P("bulwark", 1, 4.5, 0.6)], { seed: 35, events: true });
    one(b, "banner").speed = 0;
    const ally = one(b, "bulwark", 0);
    ally.speed = 0;
    one(b, "bulwark", 1).speed = 0;
    ally.hp = Math.round(ally.maxHp * 0.5);
    const hp = ally.hp;
    run(b, 2);
    expect(ally.dmg).toBeCloseTo(ally.baseDmg * 1.2);
    expect((ally.hp - hp) / ally.maxHp).toBeCloseTo(0.04, 1);
    expect(events(b, "aura").every((e) => e.rally)).toBe(true);
  });

  it("Rimecaller, Deep Freeze: every third shard freezes its target solid", () => {
    const b = new Battle([P("rime", 0, 4.5, 11, 4), P("bulwark", 1, 4.5, 8, 3)], { seed: 36, events: true });
    const bw = one(b, "bulwark");
    bw.speed = 0;
    expect(runUntil(b, 8, () => events(b, "freeze").length > 0)).toBe(true);
    expect(events(b, "shot").filter((e) => e.kind === "shard")).toHaveLength(3);
    expect(bw.frozen).toBeGreaterThan(1.2);
  });

  it("Ravager, Bloodlust: heals a fifth of the damage it deals", () => {
    const b = new Battle([P("ravager", 0, 4.5, 8, 4), P("grave", 1, 4.5, 7.2, 3)], { seed: 37, events: true });
    const r = one(b, "ravager"), g = one(b, "grave");
    pin(g);
    r.hp = r.maxHp * 0.5;
    const hp = r.hp, gh = g.hp;
    run(b, 3);
    const self = events(b, "heal").filter((e) => e.from === r.id && e.to === r.id);
    expect(self.length).toBeGreaterThan(0);
    expect(r.hp - hp).toBeCloseTo((gh - g.hp) * 0.2, 0);
  });

  it("Gravecaller, Ossuary: tougher thralls, and one rises every 6 seconds regardless", () => {
    const b = new Battle([P("grave", 0, 4.5, 12, 4), P("ballista", 1, 4.5, 0.6)], { seed: 38, events: true });
    one(b, "ballista").range = 0;
    run(b, 3.5);
    expect(all(b, "thrall")).toHaveLength(1);
    run(b, 6);
    expect(all(b, "thrall")).toHaveLength(2);
    expect(all(b, "thrall")[0].maxHp).toBe(Math.round(Math.round(BODY_EXTRA.thrall.hp * rankHp(4)) * 1.6));
  });

  it("Bombard, Shrapnel: shells burst into four more on landing", () => {
    const b = new Battle([P("bombard", 0, 4.5, 12.5, 4), P("bulwark", 1, 4.5, 6, 3)], { seed: 39, events: true });
    pin(one(b, "bulwark"));
    expect(runUntil(b, 4, () => events(b, "bomblets").length > 0)).toBe(true);
    expect(events(b, "bomblets")[0].pts).toHaveLength(4);
    run(b, 0.5);
    expect(events(b, "boom").filter((e) => e.kind === "shrapnel")).toHaveLength(4);
  });

  it("Tinker, Workshop: two turrets at once, firing faster", () => {
    const b = new Battle([P("tinker", 0, 4.5, 12, 4), P("ballista", 1, 4.5, 0.6)], { seed: 40, events: true });
    one(b, "ballista").range = 0;
    run(b, 8);
    const tus = all(b, "turret").filter((x) => x.alive);
    expect(tus).toHaveLength(2);
    for (const t of tus) expect(t.cooldown).toBeCloseTo(BODY_EXTRA.turret.cooldown * 0.6);
  });

  it("Duelist, Perfect Parry: parries every 1.5 s and the riposte crits", () => {
    const b = new Battle([P("duelist", 0, 4.5, 8, 4), P("grave", 1, 4.5, 7.3, 3)], { seed: 41, events: true });
    const d = one(b, "duelist"), foe = one(b, "grave"); // no shield to blunt the riposte
    d.speed = 0;
    pin(foe); // a frozen duelist couldn't parry, so only the foe is held
    const before = foe.hp;
    b.damage(d, 50, foe, 1, false, foe);
    expect(d.parryCd).toBeCloseTo(1.5);
    expect(before - foe.hp).toBeCloseTo(d.dmg * 3);
    run(b, 1.6);
    b.damage(d, 50, foe, 1, false, foe);
    expect(d.hp).toBe(d.maxHp);
    expect(events(b, "parry")).toHaveLength(2);
  });

  it("Pikeman, Hedgehog: braces against any melee and throws back 30% of the harm", () => {
    const b = new Battle([P("pikeman", 0, 4.5, 8, 4), P("blades", 1, 4.5, 7.2)], { seed: 42, events: true });
    const pk = one(b, "pikeman"), foe = one(b, "blades");
    b.step();
    expect(pk.braced).toBe(true);
    const before = foe.hp;
    b.damage(pk, 40, foe, 1, false, foe);
    expect(before - foe.hp).toBeCloseTo(12);
    const c = new Battle([P("pikeman", 0, 4.5, 8, 3), P("blades", 1, 4.5, 7.2)], { seed: 42 });
    c.step();
    expect(one(c, "pikeman").braced).toBe(false); // plain pikes only brace for a charge
  });

  it("Kegrunner, Chain Keg: drops a second keg that blows a second later", () => {
    const b = new Battle([P("keg", 0, 4.5, 11, 4), P("ranger", 0, 0.5, 13.5), P("blades", 1, 4.5, 7), P("bulwark", 1, 4.5, 2, 3)], { seed: 43, events: true });
    pin(...all(b, "blades"));
    expect(runUntil(b, 4, () => events(b, "kegdrop").length > 0)).toBe(true);
    const drop = events(b, "kegdrop")[0], t0 = b.time;
    expect(drop.at - t0).toBeCloseTo(1, 1);
    runUntil(b, 2, () => events(b, "boom").filter((e) => e.kind === "keg").length > 1);
    expect(events(b, "boom").filter((e) => e.kind === "keg")).toHaveLength(2);
    expect(b.time - t0).toBeCloseTo(1, 1);
  });

  it("Trickster, Mirror Hall: four decoys, and they explode when struck", () => {
    const b = new Battle([P("trickster", 0, 4.5, 10, 4), P("bulwark", 1, 4.5, 2, 3)], { seed: 44, events: true });
    runUntil(b, 1, () => all(b, "decoy").length > 0);
    const decoys = all(b, "decoy");
    expect(decoys).toHaveLength(4);
    b.damage(decoys[0], 1, { x: 4.5, y: 5 }, 1);
    expect(decoys[0].alive).toBe(false);
    expect(events(b, "pop")).toHaveLength(1);
    expect(events(b, "boom").some((e) => e.kind === "mirror")).toBe(true);
  });
});

describe("1.1 units: Hookwarden, Thornweaver, Outrider, Lamplighter", () => {
  it("Hookwarden chains the back-liner behind the wall and drags it to the front", () => {
    const b = new Battle([P("hook", 0, 4.5, 10), P("bulwark", 1, 4.5, 8.6), P("ranger", 1, 4.5, 6.6)], { seed: 3, events: true });
    const h = one(b, "hook"), ranger = one(b, "ranger"), wall = one(b, "bulwark");
    pin(ranger, wall);
    const start = dist(h, ranger);
    expect(runUntil(b, 2, () => events(b, "hook").length > 0)).toBe(true);
    // It skips the bulwark in its face and throws at the soft ranger.
    expect(events(b, "hook")[0].target).toBe(ranger.id);
    expect(runUntil(b, 2, () => events(b, "reel").length > 0)).toBe(true);
    expect(ranger.hp).toBeLessThan(ranger.maxHp);
    run(b, 1.5);
    expect(dist(h, ranger)).toBeLessThan(start * 0.5);
    expect(h.state).toBe("");
    // The chain waits for its cooldown before the next throw.
    const thrown = events(b, "hook").length;
    run(b, 2);
    expect(events(b, "hook").length).toBe(thrown);
  });

  it("Hookwarden ignores flyers and what is already in its face", () => {
    const b = new Battle([P("hook", 0, 4.5, 10), P("harrier", 1, 4.5, 7), P("blades", 1, 4.5, 9.2)], { seed: 4, events: true });
    pin(...b.bodies.filter((x) => x.side === 1));
    run(b, 2);
    const ids = new Set(b.bodies.filter((x) => x.kind === "harrier" || x.kind === "blades").map((x) => x.id));
    expect(events(b, "hook").some((e) => ids.has(e.target))).toBe(false);
  });

  it("Hookwarden, Iron Tether: two chains at once, each catch held stunned", () => {
    const b = new Battle([P("hook", 0, 4.5, 10, 4), P("ranger", 1, 3.5, 7), P("medic", 1, 5.5, 7)], { seed: 5, events: true });
    const r = one(b, "ranger"), m = one(b, "medic");
    pin(r, m);
    for (const x of [r, m]) x.hp = x.maxHp = 400; // survive the bite so the reel can finish
    expect(runUntil(b, 2, () => events(b, "hook").length > 0)).toBe(true);
    expect(new Set(events(b, "hook").map((e) => e.target))).toEqual(new Set([r.id, m.id]));
    r.frozen = 0; m.frozen = 0; // let them try to walk off once caught
    expect(runUntil(b, 3, () => one(b, "hook").state === "")).toBe(true);
    expect(r.stun).toBeGreaterThan(0.8);
    expect(m.stun).toBeGreaterThan(0.8);
    // Rank 1 throws one.
    const c = new Battle([P("hook", 0, 4.5, 10), P("ranger", 1, 3.5, 7), P("medic", 1, 5.5, 7)], { seed: 5, events: true });
    pin(...c.bodies.filter((x) => x.side === 1));
    runUntil(c, 2, () => events(c, "hook").length > 0);
    expect(events(c, "hook")).toHaveLength(1);
  });

  it("Thornweaver sows brambles on the crowd that hurt and slow it, and keeps its distance", () => {
    const b = new Battle([P("thorn", 0, 4.5, 11), P("blades", 1, 4.5, 6)], { seed: 6, events: true });
    const t = one(b, "thorn");
    expect(runUntil(b, 3, () => events(b, "zone").length > 0)).toBe(true);
    const z = events(b, "zone")[0];
    expect(z.kind).toBe("thorn");
    expect(z.side).toBe(0);
    expect(z.root).toBe(false);
    expect(b.zones.some((x) => x.kind === "thorn")).toBe(true);
    expect(runUntil(b, 2, () => all(b, "blades", 1).some((x) => x.snare > 0))).toBe(true);
    // Snared bodies crawl.
    run(b, 0.3);
    const blade = all(b, "blades", 1).find((x) => x.snare > 0)!;
    expect(Math.hypot(blade.vx, blade.vy)).toBeLessThan(blade.speed * 0.8);
    run(b, 1);
    expect(all(b, "blades", 1).some((x) => x.hp < x.maxHp)).toBe(true);
    // It backs off rather than trading blows.
    expect(t.alive).toBe(true);
    // Brambles only catch the other side and never flyers.
    const c = new Battle([P("thorn", 0, 4.5, 11), P("harrier", 1, 4.5, 7), P("blades", 0, 4.5, 7)], { seed: 6 });
    c.zones.push({ id: 999, kind: "thorn", x: 4.5, y: 7, r: 1.2, side: 0, until: 5, dps: 30, tick: 0 });
    c.step();
    expect(one(c, "harrier").snare).toBe(0);
    expect(one(c, "blades", 0).snare).toBe(0);
  });

  it("Thornweaver, Bramble Crown: wider, longer patches that seize what they sprout under", () => {
    const b = new Battle([P("thorn", 0, 4.5, 11, 4), P("bulwark", 1, 4.5, 7.5)], { seed: 7, events: true });
    const w = one(b, "bulwark");
    pin(w);
    expect(runUntil(b, 3, () => events(b, "zone").length > 0)).toBe(true);
    const z = events(b, "zone")[0];
    expect(z.root).toBe(true);
    expect(z.r).toBeGreaterThan(1.1);
    expect(z.until - b.time).toBeGreaterThan(4.5);
    expect(w.stun).toBeGreaterThan(0.5);
  });

  it("Outrider shoots on the move, circling its mark, and outruns melee", () => {
    const b = new Battle([P("outrider", 0, 4.5, 10), P("bulwark", 1, 4.5, 5)], { seed: 8, events: true });
    const o = one(b, "outrider"), w = one(b, "bulwark");
    pin(w);
    run(b, 2);
    let moving = 0, shots = 0;
    for (let i = 0; i < 90; i++) { const last = o.swing; b.step(); if (Math.hypot(o.vx, o.vy) > 0.5) moving++; if (o.swing !== last) shots++; }
    expect(moving).toBeGreaterThan(60);
    expect(shots).toBeGreaterThanOrEqual(2);
    expect(w.hp).toBeLessThan(w.maxHp);
    expect(dist(o, w)).toBeLessThan(UNITS.outrider.range * 1.05);
    // Melee that runs a Ranger down in six seconds can't pin the Outrider.
    for (const foe of ["blades", "duelist", "ravager"] as UnitKind[]) {
      const duel = (k: UnitKind) => { const c = new Battle([P(k, 0, 4.5, 10), P(foe, 1, 4.5, 7)], { seed: 9 }); run(c, 6); return one(c, k); };
      expect(duel("ranger").alive, foe).toBe(false);
      expect(duel("outrider").alive, foe).toBe(true);
    }
    // And it can shoot down a flyer.
    const air = new Battle([P("outrider", 0, 4.5, 10), P("harrier", 1, 4.5, 7)], { seed: 9 });
    expect(air.nearestEnemy(one(air, "outrider"))?.kind).toBe("harrier");
  });

  it("Outrider, Running Fire: two arrows a shot, at two foes when it can", () => {
    const b = new Battle([P("outrider", 0, 4.5, 10, 4), P("golem", 1, 3.5, 7), P("golem", 1, 5.5, 7)], { seed: 10 });
    const o = one(b, "outrider");
    const [g1, g2] = all(b, "golem", 1);
    pin(g1, g2);
    expect(runUntil(b, 3, () => b.projs.some((p) => p.side === 0))).toBe(true);
    expect(b.projs.filter((p) => p.side === 0)).toHaveLength(2);
    run(b, 4);
    expect(g1.hp).toBeLessThan(g1.maxHp);
    expect(g2.hp).toBeLessThan(g2.maxHp);
    // Rank 1 looses one at a time.
    const c = new Battle([P("outrider", 0, 4.5, 10), P("golem", 1, 3.5, 7), P("golem", 1, 5.5, 7)], { seed: 10 });
    pin(...all(c, "golem", 1));
    runUntil(c, 3, () => c.projs.some((p) => p.side === 0));
    expect(c.projs.filter((p) => p.side === 0)).toHaveLength(1);
    expect(o.rank).toBe(4);
  });

  it("Lamplighter wards the ally under pressure; the ward soaks the next blows, then breaks", () => {
    const b = new Battle([P("lamp", 0, 4.5, 11.5), P("blades", 0, 4.5, 9), P("golem", 1, 4.5, 7.6)], { seed: 11, events: true });
    const l = one(b, "lamp"), g = one(b, "golem");
    pin(g);
    expect(runUntil(b, 2, () => events(b, "ward").length > 0)).toBe(true);
    const w = events(b, "ward")[0];
    expect(w.from).toBe(l.id);
    const ally = b.bodies.find((x) => x.id === w.id)!;
    expect(ally.side).toBe(0);
    expect(ally.ward).toBeCloseTo(w.amt, 0);
    const hp = ally.hp;
    expect(b.damage(ally, w.amt - 5, g, 1)).toBe(0);
    expect(ally.hp).toBe(hp);
    expect(b.damage(ally, 20, g, 1)).toBeCloseTo(15, 0);
    expect(ally.ward).toBe(0);
    const br = events(b, "wardbreak").find((e) => e.id === ally.id)!;
    expect(br.burst).toBe(false);
    // Wards fade if nothing hits them.
    const c = new Battle([P("lamp", 0, 4.5, 11.5), P("blades", 0, 4.5, 9), P("golem", 1, 4.5, 7.6)], { seed: 11, events: true });
    pin(one(c, "golem"));
    runUntil(c, 2, () => events(c, "ward").length > 0);
    const warded = c.bodies.find((x) => x.id === events(c, "ward")[0].id)!;
    pin(...c.bodies.filter((x) => x.side === 0));
    run(c, 6.5);
    expect(warded.ward).toBe(0);
  });

  it("Lamplighter, Beacon: four wards, and a broken one bursts and throws foes back", () => {
    const b = new Battle([
      P("lamp", 0, 4.5, 12, 4), P("bulwark", 0, 3, 9.5), P("bulwark", 0, 4, 9.5), P("bulwark", 0, 5, 9.5), P("bulwark", 0, 6, 9.5), P("bulwark", 0, 7, 9.5),
      P("golem", 1, 4.5, 7.5),
    ], { seed: 12, events: true });
    const g = one(b, "golem");
    pin(g);
    expect(runUntil(b, 2, () => events(b, "ward").length > 0)).toBe(true);
    expect(events(b, "ward")).toHaveLength(4);
    const ally = b.bodies.find((x) => x.id === events(b, "ward")[0].id)!;
    expect(ally.wardBurst).toBe(true);
    // Put a foe next to it and break the ward.
    const hp = g.hp;
    g.x = ally.x; g.y = ally.y - ally.radius - g.radius - 0.05;
    const gx = g.x, gy = g.y;
    b.damage(ally, ally.ward * 3, g, 1); // a bulwark shield takes 30% off first
    expect(events(b, "wardbreak").at(-1)!.burst).toBe(true);
    expect(g.hp).toBeLessThan(hp);
    g.frozen = 0;
    b.step();
    expect(Math.hypot(g.x - gx, g.y - gy)).toBeGreaterThan(0);
  });

  it("the AI drafts and places all four once they are on the roster", () => {
    const seen = new Set<UnitKind>();
    const fresh: UnitKind[] = ["hook", "thorn", "outrider", "lamp"];
    for (let s = 1; s <= 40; s++) {
      const army = draftArmy(1, 24, fresh, { ...DEFAULT_AI, tactic: TACTICS[s % TACTICS.length] }, s);
      for (const p of army) {
        seen.add(p.kind);
        expect(p.y).toBeLessThan(H / 2);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(W);
      }
    }
    expect(seen).toEqual(new Set(fresh));
    for (const k of fresh) expect(POWER[k]).toBeGreaterThan(2);
  });

  it("they join the campaign late in Act 7, one beside each of its last four unlocks", () => {
    const byId = (id: number) => LEVELS.find((l) => l.id === id)!;
    expect(rosterAt(38).some((k) => ["hook", "thorn", "outrider", "lamp"].includes(k))).toBe(false);
    expect(byId(39).unlocks).toEqual(["duelist", "lamp"]);
    expect(byId(40).unlocks).toEqual(["pikeman", "thorn"]);
    expect(byId(41).unlocks).toEqual(["keg", "hook"]);
    expect(byId(42).unlocks).toEqual(["trickster", "outrider"]);
    for (const id of [39, 40, 41, 42]) expect(byId(id).act).toBe(7);
    expect(rosterAt(42)).toEqual(expect.arrayContaining(["hook", "thorn", "outrider", "lamp"]));
  });
});
