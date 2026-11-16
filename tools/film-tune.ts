// How does a film scene play out? `npx vite-node tools/film-tune.ts <scene> [seedFrom] [seedCount]`
// For each seed: who wins, when the last blow lands, and how many bodies each side has standing every 4 seconds.
// Use it to pick a scene seed whose fight stays busy for as long as the edit holds on it (and that the player wins).
import { Match } from "../engine/core/match";
import { DT } from "../engine/core/defs";
import { SCENES, sceneConfig } from "../base/src/film";

const [, , name = "clash", from = "1", count = "40"] = process.argv;
const scene = SCENES[name];
if (!scene) { console.error(`no scene "${name}" (have: ${Object.keys(SCENES).join(", ")})`); process.exit(1); }
const rows: { seed: number; winner: number; end: number; alive: string; score: number }[] = [];
for (let seed = Number(from); seed < Number(from) + Number(count); seed++) {
  const m = new Match(sceneConfig({ ...scene, seed }));
  const b = m.makeBattle(false);
  const alive: [number, number][] = [];
  let next = 4;
  while (!b.done && b.time < 60) {
    b.step(DT);
    if (b.time >= next) { alive.push([0, 1].map((s) => b.bodies.filter((x) => x.alive && x.side === s && x.kind !== "mine").length) as [number, number]); next += 4; }
  }
  const r = b.result();
  // busy = the smaller side's count, summed over the samples up to 24 s
  const score = alive.slice(0, 6).reduce((n, [a, c]) => n + Math.min(a, c), 0);
  rows.push({ seed, winner: r.winner, end: Math.round(b.time * 10) / 10, alive: alive.map(([a, c]) => `${a}/${c}`).join(" "), score });
}
rows.sort((a, b) => b.score - a.score);
for (const r of rows.slice(0, 15)) console.log(`seed ${String(r.seed).padEnd(5)} winner ${r.winner}  ends ${String(r.end).padStart(5)} s  busy ${String(r.score).padStart(3)}   ${r.alive}`);
