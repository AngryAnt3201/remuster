// Phone-size (390x844 @2x) battle shots of every act's arena, for arena art review:
//   PORT=5191 node tools/arena-shots.mjs <tag> [acts, comma separated]   -> outputs/review/polish2/arenas/act<n>-<tag>.png
// Uses an owner save (every act open), lets the AI deploy your side, presses Fight and shoots 1.5 s in.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
const port = process.env.PORT ?? "5191";
const [, , tag = "after", only = ""] = process.argv;
const acts = only ? only.split(",").map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const LEVEL = { 1: 6, 2: 10, 3: 16, 4: 22, 5: 28, 6: 34, 7: 40, 8: 48, 9: 50, 10: 57 };
const out = "outputs/review/polish2/arenas";
mkdirSync(out, { recursive: true });
const cleared = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 3]));
const save = { settings: { sound: false, haptics: false, speed: 1 }, campaign: cleared(59), puzzles: cleared(20), gauntlet: { best: 3, runs: 2 }, seen: [] };
const browser = await chromium.launch();
const errors = [];
for (const act of acts) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("muster.save.v1", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(save));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`act ${act}: ${e}`));
  await p.goto(`http://localhost:${port}/?level=${LEVEL[act]}`);
  await p.waitForTimeout(2500);
  await p.evaluate(async () => {
    const ai = await import("/engine/core/ai.ts");
    const g = window.__game, m = g.match;
    await Promise.all(g.plans ?? []);
    ai.applyPlan(m, 0, await ai.planTurnAsync(m, 0, { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced" }));
    g.refreshHud?.();
  });
  await p.waitForTimeout(900);
  await p.evaluate(() => void window.__game.fight());
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/act${act}-${tag}.png` });
  console.log("shot", act);
  await ctx.close();
}
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
