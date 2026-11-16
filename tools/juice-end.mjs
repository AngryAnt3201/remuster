// Round-end frames (the board's flourish under the HUD's ribbon, then the assault) at phone size:
//   PORT=5194 node tools/juice-end.mjs <outdir> <tag> [level]
// Plays ?level=N with the AI deploying your side, waits for the battle to end and shoots a short sequence.
import { chromium, devices } from "playwright";
const [, , outDir = "outputs/review/polish2/juice", tag = "after", level = "1"] = process.argv;
const port = process.env.PORT || 5194;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://localhost:${port}/?level=${level}`);
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.waitForTimeout(2000);
await page.evaluate(async () => {
  const ai = await import("/engine/core/ai.ts");
  const g = window.__game, m = g.match;
  await Promise.all(g.plans ?? []);
  const me = { ...ai.DEFAULT_AI, difficulty: 0.95, aggression: 0.6, tactic: "balanced" };
  ai.applyPlan(m, 0, await ai.planTurnAsync(m, 0, me));
  g.refreshHud?.();
});
await page.waitForTimeout(600);
await page.evaluate(() => void window.__game.fight());
await page.waitForFunction(() => window.__game.battle?.done, null, { timeout: 120000, polling: 16 });
const t0 = Date.now();
for (const ms of [60, 400, 900, 1300, 1800, 2600]) {
  const wait = ms - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${outDir}/round-end-${tag}-t${String(ms).padStart(4, "0")}.png` });
}
const w = await page.evaluate(() => window.__game.battle.winner);
console.log("winner", w);
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
