// "See it in the rival's game": the last round of a match, handed to another game as a link, is the same battle.
import { describe, expect, it } from "vitest";
import { arenaConfig } from "../engine/core/arena";
import { Match } from "../engine/core/match";
import { DEFAULT_AI, applyPlan, planTurn } from "../engine/core/ai";
import { peerFor, replayConfig, replayOf, replayUrl, type ReplayPayload } from "../base/src/replay";

function played() {
  const next = arenaConfig({ trophies: 300, best: 300, wins: 0, losses: 0, streak: 0 } as never, { seed: 77, arena: "the-crossing" });
  const m = new Match(next.cfg);
  for (let i = 0; i < 40 && m.phase !== "over"; i++) {
    applyPlan(m, 0, planTurn(m, 0, { ...DEFAULT_AI, difficulty: 0.5 }));
    applyPlan(m, 1, planTurn(m, 1, next.foe.ai));
    m.fight(); m.next();
  }
  return { next, m };
}

describe("replay link", () => {
  it("re-fights the deciding round to the same result from the link alone", () => {
    const { next, m } = played();
    expect(m.phase).toBe("over");
    const p = replayOf(next, m, { id: "base", name: "Crownfall" })!;
    const url = replayUrl({ id: "inkfall", name: "Inkfall", url: "https://example.test/g/inkfall/" }, p);
    const raw = url.split("#replay=")[1].replace(/-/g, "+").replace(/_/g, "/");
    const back = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as ReplayPayload;
    expect(back.arena).toBe("the-crossing");
    expect((back.cfg as { terrain?: unknown }).terrain).toBeUndefined();
    const r = new Match(replayConfig(back));
    for (const s of [0, 1] as const) r.sides[s].pieces = back.pieces.filter((x) => x.side === s).map((x) => ({ ...x }));
    r.round = back.round;
    const b = r.makeBattle(false);
    while (!b.done) b.step(1 / 30);
    expect(b.result().winner).toBe(m.history[m.history.length - 1].winner);
    expect(back.hp[0]).toBeGreaterThanOrEqual(1);
  });
  it("gives a rival the same game every time, and none when there are no other games", () => {
    const list = [{ id: "a", name: "A", url: "u1" }, { id: "b", name: "B", url: "u2" }, { id: "c", name: "C", url: "u3" }];
    expect(peerFor("Captain Varro", list)).toBe(peerFor("Captain Varro", list));
    expect(peerFor("Captain Varro", [])).toBeNull();
  });
});
