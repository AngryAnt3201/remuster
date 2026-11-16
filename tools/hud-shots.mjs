// Phone-size (390x844 @2x) before/after shots of the battle HUD, card hand and menu screens.
//   PORT=<dev port> node tools/hud-shots.mjs <before|after> [only,comma,separated]
// Writes outputs/review/polish2/hud/<name>-<tag>.png. Run from the repo root so `playwright` resolves.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const [, , tag = "after", only = ""] = process.argv;
const port = process.env.PORT || 5300;
const host = process.env.HOST || "127.0.0.1";
const want = only ? new Set(only.split(",")) : null;
const out = "outputs/review/polish2/hud";
mkdirSync(out, { recursive: true });

const cleared = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 3]));
const settings = { sound: false, haptics: false, speed: 1 };
const dayKey = (off) => { const d = new Date(); d.setDate(d.getDate() + off); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const SAVES = {
  free: { settings, campaign: cleared(12), puzzles: cleared(5), gauntlet: { best: 0, runs: 0 }, seen: [] },
  owner: { settings, campaign: cleared(42), puzzles: cleared(20), gauntlet: { best: 3, runs: 2 }, seen: [] },
  // Played the last three days: the streak week lights up and today's slot waits.
  streak: { settings, campaign: cleared(12), puzzles: cleared(5), gauntlet: { best: 0, runs: 0 }, seen: [],
    daily: { last: dayKey(-1), streak: 3, bestStreak: 5, best: 1840, bestKey: dayKey(-2), played: 9, wins: 6 } },
};

const browser = await chromium.launch();
const errors = [];
async function page(save) {
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
const shot = async (p, name) => { await p.screenshot({ path: `${out}/${name}-${tag}.png` }); console.log("shot", name); };

async function still(name, save, path, { wait = 2500, click, after = 900 } = {}) {
  if (skip(name)) return;
  const p = await page(save);
  await p.goto(`http://${host}:${port}/${path}`);
  await p.waitForTimeout(wait);
  if (click) { await p.click(click); await p.waitForTimeout(after); }
  await shot(p, name);
  await p.context().close();
}

const deployAI = async (p) => p.evaluate(async () => {
  const ai = await import("/engine/core/ai.ts");
  const g = window.__game, m = g.match;
  await Promise.all(g.plans ?? []);
  const me = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced" };
  ai.applyPlan(m, 0, await ai.planTurnAsync(m, 0, me));
  g.refreshHud?.();
});

async function battle() {
  // Deploy phase: a fresh hand, one card picked.
  if (!skip("battle-deploy")) {
    const p = await page("owner");
    await p.goto(`http://${host}:${port}/?level=6`);
    await p.waitForTimeout(2600);
    await p.evaluate(() => { const g = window.__game; g.pickSlot = 1; g.refreshHud(); });
    await p.waitForTimeout(500);
    await shot(p, "battle-deploy");
    await p.context().close();
  }
  // Short of gold: the cards you can't afford dim a touch and their cost gem turns red (after only).
  if (!skip("battle-poor") && tag !== "before") {
    const p = await page("owner");
    await p.goto(`http://${host}:${port}/?level=6`);
    await p.waitForTimeout(2600);
    await p.evaluate(() => { const g = window.__game; g.match.sides[0].gold = 2; g.refreshHud(); });
    await p.waitForTimeout(600);
    await shot(p, "battle-poor");
    await p.context().close();
  }
  // Drag and deploy (after only): a card held over your half, then the bought card flying out of the tray.
  if ((!skip("battle-drag") || !skip("battle-deployed")) && tag !== "before") {
    const p = await page("owner");
    await p.goto(`http://${host}:${port}/?level=6`);
    await p.waitForTimeout(2600);
    const from = await p.evaluate(() => { const c = document.querySelectorAll(".shop .card")[2]; const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await p.mouse.move(from.x, from.y);
    await p.mouse.down();
    for (let i = 1; i <= 12; i++) { await p.mouse.move(from.x - i * 5, from.y - i * 32); await p.waitForTimeout(16); }
    await p.waitForTimeout(250);
    if (!skip("battle-drag")) await shot(p, "battle-drag");
    await p.mouse.up();
    await p.waitForTimeout(110);
    if (!skip("battle-deployed")) await shot(p, "battle-deployed");
    await p.context().close();
  }
  if (!skip("battle-fight") || !skip("battle-shop")) {
    const p = await page("owner");
    await p.goto(`http://${host}:${port}/?level=6`);
    await p.waitForTimeout(2500);
    await deployAI(p);
    await p.waitForTimeout(700);
    await p.evaluate(() => void window.__game.fight());
    await p.waitForTimeout(1600);
    if (!skip("battle-fight")) await shot(p, "battle-fight");
    // Shop phase: skip to the next round's deploy, where a fresh hand is dealt and gold is short.
    await p.evaluate(() => window.__game.skipBattle());
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(250);
      if (await p.evaluate(() => window.__game.phase === "deploy" && window.__game.match.round > 1)) break;
    }
    await p.waitForTimeout(900);
    if (!skip("battle-shop")) await shot(p, "battle-shop");
    await p.context().close();
  }
  // A placed unit's card (upgrade / sell popover).
  if (!skip("battle-pop")) {
    const p = await page("owner");
    await p.goto(`http://${host}:${port}/?level=6`);
    await p.waitForTimeout(2500);
    await deployAI(p);
    await p.waitForTimeout(600);
    await p.evaluate(() => { const g = window.__game; const pc = g.match.sides[0].pieces.find((x) => x.kind !== "mine") ?? g.match.sides[0].pieces[0]; g.selected = pc.id; g.openPop(pc); });
    await p.waitForTimeout(500);
    await shot(p, "battle-pop");
    await p.context().close();
  }
  if (!skip("pause")) {
    const p = await page("owner");
    await p.goto(`http://${host}:${port}/?level=6`);
    await p.waitForTimeout(2500);
    await p.click('[aria-label="Pause"]');
    await p.waitForTimeout(700);
    await shot(p, "pause");
    await p.context().close();
  }
  // Defeat (after only): no rays, the dull crest.
  if (!skip("results-lost") && tag !== "before") {
    const p = await page("owner");
    await p.goto(`http://${host}:${port}/?level=6`);
    await p.waitForTimeout(2500);
    await p.evaluate(() => {
      const g = window.__game, m = g.match;
      m.history.push({ round: 1, winner: 1, damage: [120, 0] }, { round: 2, winner: 0, damage: [0, 60] }, { round: 3, winner: 1, damage: [300, 0] });
      m.sides[0].hp = 0; m.sides[1].hp = 160; m.winner = 1; m.played = 3;
      g.destroyed = true;
      g.o.onEnd(m);
    });
    await p.waitForTimeout(1600);
    await shot(p, "results-lost");
    await p.context().close();
  }
  if (!skip("results")) {
    const p = await page("owner");
    await p.goto(`http://${host}:${port}/?level=6`);
    await p.waitForTimeout(2500);
    await p.evaluate(() => {
      const g = window.__game, m = g.match;
      m.history.push({ round: 1, winner: 0, damage: [0, 400] }, { round: 2, winner: 1, damage: [80, 0] }, { round: 3, winner: 0, damage: [0, 300] });
      m.sides[0].hp = 320; m.sides[1].hp = 0; m.winner = 0; m.played = 3;
      g.destroyed = true;
      g.o.onEnd(m);
    });
    await p.waitForTimeout(2200);
    await shot(p, "results");
    await p.context().close();
  }
}

await battle();
await still("daily", "free", "?daily");
if (tag !== "before") await still("daily-streak", "streak", "?daily");
await still("paywall", "free", "?tab=modes", { click: ".gauntlet-btn" }); // [home] modes live on the Modes tab
// The shared currency pill (base/src/ui/currency.ts): coin and gem counters on a plate.
if (!skip("currency-pill") && tag !== "before") {
  const p = await page("free");
  await p.goto(`http://${host}:${port}/?barracks`);
  await p.waitForTimeout(1800);
  await p.evaluate(async () => {
    const cur = await import("/base/src/ui/currency.ts");
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99;display:flex;gap:10px;justify-content:center;padding:70px 12px 18px;background:#3f7d34";
    bar.append(cur.currencyPill("coins"), cur.currencyPill("gems"));
    document.body.append(bar);
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/currency-pill-${tag}.png`, clip: { x: 0, y: 0, width: 390, height: 140 } });
  console.log("shot currency-pill");
  await p.context().close();
}
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
