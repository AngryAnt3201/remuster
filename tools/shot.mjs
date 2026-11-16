// Phone-size screenshots of the running dev server: node tools/shot.mjs <path?query> <out.png> [waitMs] [actions-json]
// actions: {tap:[x,y]} {click:sel} {drag:[x0,y0,x1,y1]} {wait:ms} {shot:path} {eval:"js run in the page"}
import { chromium, devices } from "playwright";
const [, , path = "/", out = "shot.png", wait = "2500", actions = "[]"] = process.argv;
const browser = await chromium.launch();
// Full-screen iPhone (as inside the app): 390x844 points.
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("http://localhost:" + (process.env.PORT || 5300) + path);
await page.waitForTimeout(Number(wait));
for (const a of JSON.parse(actions)) {
  if (a.tap) await page.touchscreen.tap(a.tap[0], a.tap[1]);
  if (a.click) await page.click(a.click);
  if (a.drag) { const [x0, y0, x1, y1] = a.drag; await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12); await page.mouse.up(); }
  if (a.eval) await page.evaluate(a.eval);
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.shot) await page.screenshot({ path: a.shot });
}
await page.screenshot({ path: out });
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
