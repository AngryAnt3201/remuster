// Peak decoded bytes of the tinted unit sheets over a long session: plays several campaign levels back to back in one
// page (no reload, like a player going level to level) in headless WebKit, and reads base/src/render/sprites.ts
// sheetCacheStats() after each. Runs twice: with no budget (every sheet kept, as before the cache was bounded) and
// with the shipped SHEET_BUDGET.
//   node tools/sprite-mem.mjs [port] [level ids, comma separated] [seconds of battle per level]
// Needs the dev server: npx vite --host 127.0.0.1 --port 5300 (window.__playLevel is a dev-only hook).
import { webkit, devices } from "playwright";

const [, , port = "5300", ids = "1,6,12,18,24,30,36,42,50,57", secs = "6"] = process.argv;
const levels = ids.split(",").map(Number);
const MB = 1024 * 1024;

async function run(unbounded) {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await ctx.addInitScript(() => localStorage.setItem("muster.save.v1", JSON.stringify({ settings: { sound: false, haptics: false, speed: 3 }, campaign: {}, puzzles: {}, gauntlet: { best: 0, runs: 0 }, seen: [] })));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("vibrate")) errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/?level=${levels[0]}`);
  await page.waitForFunction(() => window.__game && window.__playLevel, null, { timeout: 60000 });
  if (unbounded) await page.evaluate(async () => (await import("/base/src/render/sprites.ts")).setSheetBudget(Infinity));
  const rows = [];
  for (const [i, id] of levels.entries()) {
    if (i > 0) {
      await page.evaluate((id) => { window.__prevGame = window.__game; window.__playLevel(id); }, id);
      await page.waitForFunction(() => window.__game && window.__game !== window.__prevGame, null, { timeout: 30000 });
    }
    await page.waitForTimeout(1200);
    // the game's AI deploys the player's side too, then the battle plays for a few seconds
    await page.evaluate(async () => {
      const ai = await import("/engine/core/ai.ts");
      const g = window.__game;
      await Promise.all(g.plans ?? []);
      ai.applyPlan(g.match, 0, await ai.planTurnAsync(g.match, 0, { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced" }));
      g.refreshHud?.();
      void g.fight();
    });
    await page.waitForTimeout(Number(secs) * 1000);
    const st = await page.evaluate(async () => (await import("/base/src/render/sprites.ts")).sheetCacheStats());
    rows.push({ level: id, mb: +(st.bytes / MB).toFixed(1), peakMb: +(st.peak / MB).toFixed(1), inUseMb: +(st.inUse / MB).toFixed(1),
      pinnedMb: +(st.pinned / MB).toFixed(1), sheets: st.sheets, evictions: st.evictions });
  }
  await browser.close();
  return { budget: unbounded ? "none" : "SHEET_BUDGET", peakMb: rows.at(-1).peakMb, finalMb: rows.at(-1).mb, rows, errors };
}

const mode = process.env.ONLY;
const before = mode === "after" ? null : await run(true);
const after = mode === "before" ? null : await run(false);
console.log(JSON.stringify({ levels, before, after }, null, 1));
