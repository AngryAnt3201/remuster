// Phone-size (390x844 @2x) review shots for Acts 9-10: both map pages, each arena in battle, both bosses, the ending.
//   PORT=5592 node tools/acts-shots.mjs [only, comma separated: map9,map10,arena9,arena10,boss9,boss10,ending]
//   -> outputs/review/acts/*.png
// Uses an owner save (levels 1-59 cleared with three stars). Battle shots let the AI deploy your side, press Fight
// and shoot 1.5 s in; boss shots show the rival's opening board before the first fight.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
const port = process.env.PORT ?? "5592";
const only = (process.argv[2] ?? "").split(",").filter(Boolean);
const out = "outputs/review/acts";
mkdirSync(out, { recursive: true });
const cleared = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 3]));
const save = { settings: { sound: false, haptics: false, speed: 1 }, campaign: cleared(59), puzzles: cleared(18), gauntlet: { best: 3, runs: 2 }, seen: [] };
const SHOTS = [
  { name: "map9", url: "?campaign=9", wait: 2500 },
  { name: "map10", url: "?campaign=10", wait: 2500 },
  { name: "arena9", url: "?level=50", fight: true },
  { name: "arena10", url: "?level=57", fight: true },
  { name: "boss9", url: "?level=54", deploy: true },
  { name: "boss9-fight", url: "?level=54", fight: true },
  { name: "boss10", url: "?level=60", deploy: true },
  { name: "boss10-fight", url: "?level=60", fight: true },
  { name: "ending", url: "?ending", wait: 2000 },
];
const browser = await chromium.launch();
const errors = [];
for (const s of SHOTS.filter((x) => !only.length || only.some((o) => x.name.startsWith(o)))) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("muster.save.v1", v); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(save));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${s.name}: ${e}`));
  await p.goto(`http://localhost:${port}/${s.url}`);
  await p.waitForTimeout(s.wait ?? 2500);
  if (s.fight || s.deploy) {
    await p.evaluate(async () => {
      const ai = await import("/engine/core/ai.ts");
      const g = window.__game, m = g.match;
      await Promise.all(g.plans ?? []);
      ai.applyPlan(m, 0, await ai.planTurnAsync(m, 0, { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced" }));
      g.refreshHud?.();
    });
    await p.waitForTimeout(900);
  }
  if (s.fight) { await p.evaluate(() => void window.__game.fight()); await p.waitForTimeout(1500); }
  await p.screenshot({ path: `${out}/${s.name}.png` });
  console.log("shot", s.name);
  await ctx.close();
}
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
