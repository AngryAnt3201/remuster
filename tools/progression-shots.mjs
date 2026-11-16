// Phone-size (390x844 @2x) shots of the Barracks and a coin result, for outputs/review/progression/.
//   PORT=<dev port> node tools/progression-shots.mjs
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const port = process.env.PORT || 5300;
const out = "outputs/review/progression";
mkdirSync(out, { recursive: true });

const cleared = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 3]));
const settings = { sound: false, haptics: false, speed: 1 };
const wallet = (coins) => ({ coins, gems: 0, earned: { coins, gems: 0 }, spent: { coins: 0, gems: 0 }, txIds: [] });
const base = { settings, puzzles: {}, gauntlet: { best: 0, runs: 0 }, seen: [] };
// Act 2 cleared (cap 4), part-way into Act 3.
const mid = { ...base, campaign: cleared(14), progression: { levels: { blades: 3, ranger: 4, bulwark: 2, mine: 2, lancer: 3 } } };
const SAVES = {
  normal: { ...mid, wallet: wallet(2450) },
  short: { ...mid, wallet: wallet(160) },
  capped: { ...base, campaign: cleared(14), wallet: wallet(5200), progression: { levels: { blades: 4, ranger: 4, mine: 4, bulwark: 4, medic: 4, lancer: 4, grenadier: 4, ballista: 4, shade: 3 } } },
  maxed: { ...base, campaign: cleared(48), wallet: wallet(4100), progression: { levels: { blades: 10, ranger: 9, bulwark: 7, mine: 10 } } },
  result: { ...base, campaign: cleared(5), wallet: wallet(320), progression: { levels: { blades: 2, ranger: 2 } } },
};

const browser = await chromium.launch();
const errors = [];
async function page(save) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem("seeded")) { localStorage.setItem("muster.save.v1", s); sessionStorage.setItem("seeded", "1"); }
  }, JSON.stringify(SAVES[save]));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${p.url()}: ${e}`));
  p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("vibrate")) errors.push(m.text()); });
  return p;
}
const settle = (p, ms = 900) => p.waitForTimeout(ms);

{
  const p = await page("normal");
  await p.goto(`http://127.0.0.1:${port}/?barracks`);
  await settle(p, 1400);
  await p.screenshot({ path: `${out}/barracks-normal.png` });
  // The level-up moment: tap Upgrade on the first ready card and catch it mid-celebration.
  await p.locator(".pg-card.ready .pg-up").first().click();
  await p.waitForTimeout(260);
  await p.screenshot({ path: `${out}/barracks-upgrade.png` });
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${out}/barracks-after-upgrade.png` });
  await p.locator(".pg-card.locked").first().scrollIntoViewIfNeeded();
  await p.evaluate(() => document.querySelector(".pg-barracks").scrollBy(0, 260));
  await settle(p, 500);
  await p.screenshot({ path: `${out}/barracks-locked.png` });
}
{
  // Title: the Barracks button counts troops ready to level up.
  const p = await page("normal");
  await p.goto(`http://127.0.0.1:${port}/`);
  await settle(p, 1400);
  await p.screenshot({ path: `${out}/title-barracks-badge.png` });
}
{
  const p = await page("capped");
  await p.goto(`http://127.0.0.1:${port}/?barracks`);
  await settle(p, 1400);
  await p.screenshot({ path: `${out}/barracks-capped.png` });
}
{
  const p = await page("maxed");
  await p.goto(`http://127.0.0.1:${port}/?barracks`);
  await settle(p, 1400);
  await p.screenshot({ path: `${out}/barracks-max.png` });
}
{
  const p = await page("short");
  await p.goto(`http://127.0.0.1:${port}/?barracks`);
  await settle(p, 1400);
  await p.screenshot({ path: `${out}/barracks-short.png` });
  await p.locator(".pg-get").first().click();
  await settle(p, 900);
  await p.screenshot({ path: `${out}/barracks-get-coins-to-shop.png` });
}
{
  // A real campaign result: Act 1's boss (level 6), ended as a 3-star first clear, which also raises the level cap.
  const p = await page("result");
  await p.goto(`http://127.0.0.1:${port}/?level=6`);
  await settle(p, 1500);
  await p.evaluate(() => {
    const g = window.__game;
    g.match.sides[1].hp = 0; g.match.winner = 0; g.match.phase = "over";
    g.o.onEnd(g.match);
  });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `${out}/result-coins.png` });
}
{
  // Gauntlet: each rival beaten pays coins on the boon pick.
  const p = await page("result");
  await p.goto(`http://127.0.0.1:${port}/?gauntlet`);
  await settle(p, 1500);
  await p.evaluate(() => {
    const g = window.__game;
    g.match.sides[1].hp = 0; g.match.winner = 0; g.match.phase = "over";
    g.o.onEnd(g.match);
  });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}/gauntlet-coins.png` });
}
{
  // The level sheet names the foe troop level (Act 3 here: level 2).
  const p = await page("capped");
  await p.goto(`http://127.0.0.1:${port}/?campaign=3`);
  await settle(p, 1400);
  await p.locator(".node.current").first().click();
  await settle(p, 700);
  await p.screenshot({ path: `${out}/level-sheet-foe-level.png` });
}
await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
