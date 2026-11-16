// Phone-size battle frames of a campaign level from the dev server (port 5300), for art review:
//   node tools/battle-shot.mjs <level> <out-prefix> [ms after Fight, comma separated: 1400,2600]
// Opens /?level=N, lets the game's AI deploy your side too, presses Fight and shoots at each time.
import { chromium, devices } from "playwright";
const [, , level = "1", out = "battle", times = "1400"] = process.argv;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://127.0.0.1:5300/?level=${level}`);
await page.waitForTimeout(2500);
await page.evaluate(async () => {
  const ai = await import("/engine/core/ai.ts");
  const g = window.__game, m = g.match;
  await Promise.all(g.plans ?? []);
  const me = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced" };
  ai.applyPlan(m, 0, await ai.planTurnAsync(m, 0, me));
  g.refreshHud?.();
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}_deploy.png` });
await page.evaluate(() => void window.__game.fight());
let t = 0;
for (const ms of times.split(",").map(Number)) {
  await page.waitForTimeout(ms - t);
  t = ms;
  await page.screenshot({ path: `${out}_${ms}.png` });
}
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
