// Phone-size review shots for the Meadow polish pass (units at board scale, late-act courtyards, airborne VFX order,
// title key art): PORT=5300 node tools/polish-shots.mjs <outdir> <tag> [only,comma,separated]
// Writes <outdir>/<name>-<tag>.png. Battles use ?level=N with the AI deploying your side, then Fight.
import { chromium, devices } from "playwright";
const [, , outDir = "outputs/review/polish", tag = "after", only = ""] = process.argv;
const port = process.env.PORT || 5300;
const want = only ? new Set(only.split(",")) : null;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
async function open(path) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${path}: ${e}`));
  await page.goto(`http://localhost:${port}${path}`);
  return page;
}
const shot = (page, name) => page.screenshot({ path: `${outDir}/${name}-${tag}.png` });

async function battle(name, level, times) {
  if (want && !want.has(name)) return;
  const page = await open(`/?level=${level}`);
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
  await shot(page, `${name}_deploy`);
  await page.evaluate(() => void window.__game.fight());
  let t = 0;
  for (const ms of times) { await page.waitForTimeout(ms - t); t = ms; await shot(page, `${name}_${ms}`); }
  await page.close();
}

async function still(name, path, wait = 2500) {
  if (want && !want.has(name)) return;
  const page = await open(path);
  await page.waitForTimeout(wait);
  await shot(page, name);
  await page.close();
}

await still("title", "/");
await battle("act1", 6, [1500]);
await battle("act5", 30, [1500]);
await battle("act6", 34, [1500]);
await battle("act7", 40, [1500, 3000]);
// The showcase opens with ranked units on both sides, incl. harriers (flyers) over ground units.
await still("showcase", "/?showcase=1", 3200);
await still("showcase2", "/?showcase=2", 4200);
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
