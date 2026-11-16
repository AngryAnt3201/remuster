// Plays a whole AI-vs-AI match in the browser at 3x and screenshots the end; also checks console errors.
import { chromium, devices } from "playwright";
const out = process.argv[2] ?? ".";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem("muster.save.v1", JSON.stringify({ settings: { sound: false, haptics: false, speed: 3 }, campaign: {}, puzzles: {}, gauntlet: { best: 0, runs: 0 }, seen: [] })));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("vibrate")) errors.push(m.text()); });
await page.goto("http://127.0.0.1:5300/?watch");
const t0 = Date.now();
let midShot = false;
const trace = [];
while (Date.now() - t0 < 240000) {
  if (await page.locator(".results").count()) break;
  const snap = await page.evaluate(() => { const g = window.__game; return g && { r: g.match.round, hp: g.match.sides.map((x) => x.hp), shown: g.hpShown.map(Math.round), id: g.match.cfg.seed }; });
  if (snap) {
    const prev = trace.at(-1);
    if (prev && (snap.hp[0] > prev.hp[0] || snap.hp[1] > prev.hp[1] || snap.id !== prev.id)) console.log("HP WENT UP / NEW MATCH", JSON.stringify(prev), JSON.stringify(snap));
    trace.push(snap);
  }
  if (!midShot && Date.now() - t0 > 40000) { await page.screenshot({ path: `${out}/e2e-mid.png` }); midShot = true; }
  await page.waitForTimeout(1000);
}
const done = await page.locator(".results").count();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/e2e-end.png` });
const info = await page.evaluate(() => { const g = window.__game; return g && { hp: g.match.sides.map((x) => x.hp), hist: g.match.history.map((r) => [r.round, r.winner, ...r.damage]) }; });
console.log(JSON.stringify(info));
console.log(JSON.stringify({ finished: !!done, seconds: Math.round((Date.now() - t0) / 1000), errors }));
await browser.close();
