// Phone-size (390x844 @2x) shots of the polish/fixes round, for outputs/review/fixes/.
//   PORT=<dev port> HOST=localhost node tools/fixes-shots.mjs [only,comma,separated]
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const [, , only = "", tag = ""] = process.argv;
const port = process.env.PORT || 5300;
const host = process.env.HOST || "localhost";
const want = only ? new Set(only.split(",")) : null;
const out = "outputs/review/fixes";
mkdirSync(out, { recursive: true });

const cleared = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 3]));
const settings = { sound: false, haptics: false, speed: 1 };
const wallet = (coins, gems = 0) => ({ coins, gems, earned: { coins, gems }, spent: { coins: 0, gems: 0 }, txIds: [] });
const base = { settings, puzzles: cleared(5), gauntlet: { best: 0, runs: 0 }, seen: [] };
const levels = { blades: 6, ranger: 7, bulwark: 5, mine: 4, lancer: 6, medic: 5, grenadier: 4, ballista: 3, shade: 3 };
const SAVES = {
  levelled: { ...base, campaign: cleared(14), wallet: wallet(2450, 120), progression: { levels } },
};

const browser = await chromium.launch();
const errors = [];
async function page(save = "levelled") {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("muster.save.v1", s);
      localStorage.removeItem("muster.mockstore.v1");
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(SAVES[save]));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${p.url()}: ${e}`));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return p;
}
const skip = (name) => want && !want.has(name);
const shot = async (p, name) => { await p.screenshot({ path: `${out}/${name}.png` }); console.log("shot", name); };
const deployAI = async (p) => p.evaluate(async () => {
  const ai = await import("/engine/core/ai.ts");
  const g = window.__game, m = g.match;
  await Promise.all(g.plans ?? []);
  const me = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced" };
  ai.applyPlan(m, 0, await ai.planTurnAsync(m, 0, me));
  g.refreshHud?.();
});

// 1. A placed unit's card at its troop level.
if (!skip("pop-level")) {
  const p = await page();
  await p.goto(`http://${host}:${port}/?level=10`);
  await p.waitForTimeout(2600);
  await deployAI(p);
  await p.waitForTimeout(600);
  await p.evaluate(() => { const g = window.__game; const pc = g.match.sides[0].pieces.find((x) => x.kind !== "mine") ?? g.match.sides[0].pieces[0]; g.selected = pc.id; g.openPop(pc); });
  await p.waitForTimeout(500);
  await shot(p, "pop-level");
  await p.context().close();
}

// 3. The one currency pill: title, Shop and Barracks headers (and a live update after a spend in the Barracks).
for (const [name, path] of [["pill-title", ""], ["pill-shop", "?shop"], ["pill-barracks", "?barracks"]]) {
  if (skip(name)) continue;
  const p = await page();
  await p.goto(`http://${host}:${port}/${path}`);
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `${out}/${name}${tag}.png`, clip: { x: 0, y: 0, width: 390, height: 160 } });
  console.log("shot", name);
  if (name === "pill-barracks" && tag === "") {
    await p.evaluate(async () => { const w = await import("/engine/economy/wallet.ts"); w.earn("coins", 1000, "shot"); });
    await p.waitForTimeout(900);
    const txt = await p.evaluate(() => document.querySelector(".screen-head .cur-coins b")?.textContent);
    console.log("barracks pill after +1000:", txt);
    await p.screenshot({ path: `${out}/pill-barracks-live.png`, clip: { x: 0, y: 0, width: 390, height: 160 } });
  }
  await p.context().close();
}

// 4. Barracks -> "Get coins" -> Shop -> back lands on the Barracks again.
if (!skip("shop-back")) {
  const p = await page();
  await p.goto(`http://${host}:${port}/?barracks`);
  await p.waitForTimeout(1800);
  // Short of coins so a "Get coins" button shows.
  await p.evaluate(async () => { const w = await import("/engine/economy/wallet.ts"); w.spend("coins", w.wallet().coins, "shot"); });
  await p.waitForTimeout(600);
  await p.click(".pg-get");
  await p.waitForTimeout(900);
  await shot(p, "shop-from-barracks");
  await p.click(".screen-head .back");
  await p.waitForTimeout(900);
  console.log("after back:", await p.evaluate(() => document.querySelector(".screen-head h1")?.textContent));
  await shot(p, "shop-back-to-barracks");
  await p.context().close();
}

// 5. The Daily draft pool on one row.
if (!skip("daily-draft")) {
  const p = await page();
  await p.goto(`http://${host}:${port}/?daily`);
  await p.waitForTimeout(2200);
  await shot(p, "daily-draft");
  await p.context().close();
}

// 6. The bottom bar mid-fight.
if (!skip("battle-bar")) {
  const p = await page();
  await p.goto(`http://${host}:${port}/?level=10`);
  await p.waitForTimeout(2500);
  await deployAI(p);
  await p.waitForTimeout(600);
  await p.evaluate(() => void window.__game.fight());
  await p.waitForTimeout(1800);
  await shot(p, `battle-bar${tag}`);
  await p.context().close();
}

// 7. Gauntlet boon sheet: the "Rival N beaten" line clear of the ribbon.
if (!skip("gauntlet-boons")) {
  const p = await page();
  await p.goto(`http://${host}:${port}/?gauntlet`);
  await p.waitForTimeout(2500);
  await p.evaluate(() => {
    const g = window.__game;
    g.match.sides[1].hp = 0; g.match.winner = 0; g.match.phase = "over";
    g.o.onEnd(g.match);
  });
  await p.waitForTimeout(1800);
  await shot(p, `gauntlet-boons${tag}`);
  await p.context().close();
}

// 8. Bastion's result card with the shared coin line.
if (!skip("bastion-result")) {
  const p = await page();
  await p.goto(`http://${host}:${port}/?td=meadow`);
  await p.waitForTimeout(2500);
  await p.evaluate(() => { const r = window.__td.run; r.wave = r.waveCount; r.phase = "won"; });
  await p.waitForTimeout(2600);
  await shot(p, "bastion-result");
  await p.context().close();
}

if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
