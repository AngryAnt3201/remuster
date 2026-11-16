// Phone-size (390x844 @2x) review shots of the gem store: Shop states, title counters, a gem reward on a result
// screen and the Gauntlet Rally. PORT=<port> node tools/gems-shots.mjs [outDir]   (dev server must be running)
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "outputs/review/gems";
const port = process.env.PORT ?? "5300";
mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}/`;
const campaign = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, i % 3 === 0 ? 2 : 3]));
const puzzles = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i + 1, 2]));
// A free player a few days in: rewards for Acts 1-2 already paid, some coins from play.
const wallet = (gems, coins = 640) => ({ coins, gems, earned: { coins, gems }, spent: { coins: 0, gems: 0 }, txIds: [] });
const player = (gems, extra = {}) => ({ settings: { sound: false, haptics: false, speed: 1 }, campaign, puzzles, gauntlet: { best: 0, runs: 0 }, seen: [], wallet: wallet(gems), ...extra });

const browser = await chromium.launch();
const errors = [];
async function shots(save, mock, list, { settle = false } = {}) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([s, m]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("muster.save.v1", JSON.stringify(s));
      if (m) localStorage.setItem("muster.mockstore.v1", JSON.stringify(m)); else localStorage.removeItem("muster.mockstore.v1");
      sessionStorage.setItem("seeded", "1");
    }
  }, [save, mock]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  for (const [name, path, steps = []] of list) {
    await page.goto(base + path);
    await page.waitForTimeout(1600);
    for (const s of steps) {
      if (s.click) await page.click(s.click);
      if (s.scroll) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "center" }), s.scroll);
      if (s.wait) await page.waitForTimeout(s.wait);
    }
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log("shot", name);
  }
  await ctx.close();
}

const SACK = '[data-pack="co.inflect.muster.gems.sack"] .gem-buy';
await shots(player(120), null, [
  ["title-counters", ""],
  ["shop", "?shop"],
  ["shop-gems", "?shop", [{ scroll: ".gem-grid" }, { wait: 400 }]],
]);
await shots(player(120), null, [["shop-after-purchase", "?shop", [{ scroll: ".gem-grid" }, { wait: 300 }, { click: SACK }, { wait: 620 }]]]);
await shots(player(120), null, [["shop-after-purchase-landed", "?shop", [{ scroll: ".gem-grid" }, { wait: 300 }, { click: SACK }, { wait: 2600 }]]]);
await shots(player(120), null, [["shop-pending", "?shop&store=pending", [{ scroll: ".gem-grid" }, { wait: 300 }, { click: SACK }, { wait: 1200 }]]]);
await shots(player(120), null, [["shop-failed", "?shop&store=failed", [{ scroll: ".gem-grid" }, { wait: 300 }, { click: SACK }, { wait: 1200 }]]]);
await shots(player(120), null, [["shop-offline", "?shop&store=offline", [{ wait: 600 }, { scroll: ".gem-grid" }, { wait: 400 }]]]);
await shots(player(420), null, [["shop-coins", "?shop", [{ scroll: ".gem-section.coins" }, { wait: 300 }, { click: '[data-bundle="coins.m"] .coin-buy' }, { wait: 2000 }]]]);
await shots(player(120), { owned: ["co.inflect.muster.fullarmy"], open: [] }, [["shop-owner", "?shop"]]);
// Result screens: an Act 1 boss three-starred for the first time (rewards for that level not paid yet).
const fresh = { ...player(35), campaign: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i + 1, 3])) };
await shots(fresh, null, [["result-gem-reward", "?gemdemo=reward", [{ wait: 1800 }]]]);
await shots(player(120, { store: { fullArmy: true, source: "purchase", at: 1 } }), { owned: ["co.inflect.muster.fullarmy"], open: [] }, [["gauntlet-rally", "?gemdemo=rally", [{ wait: 900 }]]]);
// The App Store Connect review screenshot for the gem packs (store/IAP.md section 4): 1320x2868, the Gems section.
{
  const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript((s) => { localStorage.setItem("muster.save.v1", JSON.stringify(s)); localStorage.removeItem("muster.mockstore.v1"); }, player(120));
  const page = await ctx.newPage();
  await page.goto(base + "?shop");
  await page.waitForTimeout(1600);
  await page.evaluate(() => document.querySelector(".gem-section")?.scrollIntoView({ block: "start" }));
  await page.evaluate(() => document.querySelector(".screen")?.scrollBy(0, -80));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "store/screenshots/iap-gems-review.png" });
  console.log("shot store/screenshots/iap-gems-review.png");
  await ctx.close();
}
console.log(JSON.stringify({ errors }));
await browser.close();
