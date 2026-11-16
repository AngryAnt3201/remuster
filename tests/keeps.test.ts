import { describe, expect, it } from "vitest";
import { H, W, type Side } from "../engine/core/defs";
import { Match } from "../engine/core/match";
import { Assault, detour, styleOf } from "../base/src/render/assault";
import { KEEP_ARTS, KEEP_STATES, RAISE_FROM, RAISE_TIME, VICTORY_HOLD, bannerRaise, behindKeep, collapsePose, keepAnchor, keepFile, keepSquash, keepState } from "../base/src/render/keeps";
import { existsSync, readFileSync } from "node:fs";

/** Plays one round headless with events off and returns the finished battle and its report. */
function round(start: ConstructorParameters<typeof Match>[0]["start"], seed = 7) {
  const m = new Match({ seed, start });
  const b = m.makeBattle(false);
  const rep = m.resolve(b.run());
  return { b, rep };
}

describe("keeps", () => {
  it("break up through four states as the commander's hp falls", () => {
    expect(KEEP_STATES).toEqual(["intact", "cracked", "burning", "ruined"]);
    const seen = [1, 0.8, 0.6, 0.4, 0.2, 0.05, 0].map(keepState);
    expect(seen[0]).toBe("intact");
    expect(seen[seen.length - 1]).toBe("ruined");
    expect(new Set(seen)).toEqual(new Set(KEEP_STATES));
    // Never heals back to an earlier state as hp drops.
    const idx = seen.map((s) => KEEP_STATES.indexOf(s));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it("sit on the board behind each side's deploy zone", () => {
    const [you, foe] = [keepAnchor(0), keepAnchor(1)];
    expect(you.x).toBe(W / 2);
    expect(foe.x).toBe(W / 2);
    expect(you.y).toBeGreaterThan(H - 1.5);
    expect(foe.y).toBeLessThan(2);
  });
});

describe("keep damage art", () => {
  it("maps commander hp to intact, cracked, burning and ruined at 70%, 45% and 20%", () => {
    expect([1, 0.71, 0.7, 0.46, 0.45, 0.21, 0.2, 0.01, 0].map(keepState)).toEqual(
      ["intact", "intact", "cracked", "cracked", "burning", "burning", "ruined", "ruined", "ruined"]);
    // A damaged foe at 220 of 400 shows a cracked keep; 400 of 400 is intact.
    expect(keepState(220 / 400)).toBe("cracked");
    expect(keepState(400 / 400)).toBe("intact");
  });

  it("ships an image for every state of each keep, the boss variant only for the rival", () => {
    expect(keepFile(0, "cracked")).toBe("tide_cracked.webp");
    expect(keepFile(1, "cracked", true)).toBe("ember_boss_cracked.webp");
    expect(keepFile(0, "cracked", true)).toBe("tide_cracked.webp");
    const man = JSON.parse(readFileSync("base/public/keeps/manifest.json", "utf8"));
    expect(man.states).toEqual(KEEP_ARTS);
    for (const st of KEEP_ARTS) for (const f of [keepFile(0, st), keepFile(1, st), keepFile(1, st, true)]) expect(existsSync(`base/public/keeps/${f}`), f).toBe(true);
  });

  it("go see-through only for a body right behind the tower", () => {
    const k = keepAnchor(0);
    expect(behindKeep(0, k.x, k.y - 0.8)).toBe(true);
    expect(behindKeep(0, k.x + 2.2, k.y - 0.8)).toBe(false); // off to the side
    expect(behindKeep(0, k.x, k.y + 0.3)).toBe(false); // in front
    expect(behindKeep(0, k.x, k.y - 3)).toBe(false); // well clear above the flag
  });

  it("squash on a blow and settle back to rest", () => {
    expect(keepSquash(9, 1)).toEqual({ sx: 1, sy: 1 });
    const hit = keepSquash(0, 1.3);
    expect(hit.sy).toBeLessThan(1); // squashed down
    expect(hit.sx).toBeGreaterThan(1); // and spread
    expect(keepSquash(0, 1.3).sy).toBeLessThan(keepSquash(0, 0.6).sy); // a big blow squashes harder
    const late = keepSquash(0.55, 1.3);
    expect(Math.abs(late.sy - 1)).toBeLessThan(0.005);
  });

  it("collapse: a rumble, then the keep sinks into its rubble, which stays", () => {
    expect(collapsePose(0.1).phase).toBe("rumble");
    expect(collapsePose(0.1).sink).toBe(0);
    const mid = collapsePose(0.8, 1);
    expect(mid.phase).toBe("fall");
    expect(mid.sink).toBeGreaterThan(0);
    expect(mid.tilt).toBeGreaterThan(0);
    expect(collapsePose(0.8, -1).tilt).toBeLessThan(0);
    const end = collapsePose(5);
    expect(end).toMatchObject({ phase: "settled", alpha: 0, rubble: 1 });
    // sinks monotonically
    const sinks = [0.3, 0.5, 0.7, 0.9, 1.1].map((t) => collapsePose(t).sink);
    expect(sinks).toEqual([...sinks].sort((a, b) => a - b));
  });

  it("the winner's banner climbs after the fall starts and is up before the hold ends", () => {
    expect(bannerRaise(0)).toBe(0);
    expect(bannerRaise(RAISE_FROM)).toBe(0);
    expect(bannerRaise(RAISE_FROM + RAISE_TIME * 0.5)).toBeGreaterThan(0.5);
    expect(bannerRaise(RAISE_FROM + RAISE_TIME)).toBe(1);
    expect(RAISE_FROM + RAISE_TIME).toBeLessThan(VICTORY_HOLD);
  });
});

describe("round-end assault", () => {
  it("the winners march on the losing keep and the first blow lands before the bar drains", () => {
    const { b, rep } = round([[{ kind: "bulwark", lx: 4.5, depth: 3, rank: 3 }, { kind: "ranger", lx: 3, depth: 1 }], [{ kind: "medic", lx: 4.5, depth: 1 }]]);
    expect(rep.winner).toBe(0);
    const loser: Side = 1;
    const a = new Assault(b.bodies, { damage: rep.damage });
    const survivors = b.bodies.filter((x) => x.alive && x.side === 0 && x.kind !== "mine");
    expect(a.strikers.length).toBe(survivors.length);
    expect(a.strikers.every((s) => s.target === loser)).toBe(true);
    expect(Number.isFinite(a.hitAt[loser])).toBe(true);
    expect(a.hitAt[0]).toBe(Infinity);

    const k = keepAnchor(loser);
    const startDist = Math.min(...a.strikers.filter((s) => s.style === "melee").map((s) => Math.hypot(s.x - k.x, s.y - k.y)));
    const events: string[] = [];
    let impactAt = Infinity, drainAtImpact = -1;
    while (!a.over) {
      a.update(1 / 60, (e) => {
        events.push(e.t);
        if (e.t === "impact" && e.first) { impactAt = a.t; drainAtImpact = a.drain(loser); }
      });
      if (a.t < a.hitAt[loser]) expect(a.drain(loser)).toBe(0);
      expect(a.t).toBeLessThan(10);
    }
    const endDist = Math.min(...a.strikers.filter((s) => s.style === "melee").map((s) => Math.hypot(s.x - k.x, s.y - k.y)));
    expect(endDist).toBeLessThan(startDist);
    expect(endDist).toBeLessThan(2.2);
    // The ranger shoots, the bulwark swings, then the keep is hit and only after that does the bar move.
    expect(events).toContain("launch");
    expect(events.indexOf("swing")).toBeLessThan(events.indexOf("impact"));
    expect(impactAt).toBeGreaterThanOrEqual(a.hitAt[loser]);
    expect(drainAtImpact).toBeLessThan(0.1);
    expect(a.drain(loser)).toBe(1);
    expect(a.drain(0)).toBe(1); // an undamaged side is never held back
  });

  it("still lands a blow when nobody is left standing to deliver it (a draw)", () => {
    const { b } = round([[{ kind: "ranger", lx: 4.5, depth: 1 }], [{ kind: "ranger", lx: 4.5, depth: 1 }]]);
    const a = new Assault(b.bodies.map((x) => ({ ...x, alive: false })), { damage: [10, 10] });
    expect(a.strikers.length).toBe(0);
    expect(Number.isFinite(a.hitAt[0]) && Number.isFinite(a.hitAt[1])).toBe(true);
    let impacts = 0;
    while (!a.over) a.update(0.05, (e) => { if (e.t === "impact") impacts++; });
    expect(impacts).toBe(2);
  });

  it("every unit kind has a way to strike or stands by", () => {
    for (const k of ["blades", "ranger", "bombard", "storm", "golem", "harrier", "keg", "medic"] as const) expect(styleOf(k)).toBeTruthy();
  });

  it("marches round a rock in the way", () => {
    const p = detour([0, 0], [0, 6], 0.3, [{ x: 0, y: 3, r: 0.8 }]);
    expect(p.length).toBe(3);
    expect(Math.abs(p[1][0])).toBeGreaterThan(0.8 + 0.3);
    expect(detour([0, 0], [0, 6], 0.3, [{ x: 3, y: 3, r: 0.5 }]).length).toBe(2);
  });
});

describe("assault hold", () => {
  it("a defeat holds the assault open for the collapse and the banner", () => {
    const { b, rep } = round([[{ kind: "bulwark", lx: 4.5, depth: 3, rank: 3 }], [{ kind: "medic", lx: 4.5, depth: 1 }]]);
    const a = new Assault(b.bodies, { damage: rep.damage });
    const end = a.endAt;
    a.update(end - 0.5, () => {});
    expect(a.over).toBe(false);
    a.hold(VICTORY_HOLD);
    expect(a.endAt).toBeCloseTo(end - 0.5 + VICTORY_HOLD);
    a.update(0.6, () => {});
    expect(a.over).toBe(false);
    a.hold(0.1); // never shortens it
    expect(a.endAt).toBeCloseTo(end - 0.5 + VICTORY_HOLD);
  });
});
