// Before/after phone-size shots of every screen the overnight 1.1 build changed, for outputs/review/MORNING.md.
//   PORT=<dev port> node tools/morning-shots.mjs <before|after> [only,comma,separated]
// "before" points at a dev server for the pre-overnight build (main), "after" at this branch; both write
// outputs/review/morning/<name>-<tag>.png at 390x844 @2x (iPhone 13/14 size). Screens that only exist in 1.1
// (Shop, Daily, Act 8) are skipped for "before". Run from the repo root so `playwright` resolves.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const [, , tag = "after", only = ""] = process.argv;
const port = process.env.PORT || 5300;
const want = only ? new Set(only.split(",")) : null;
const out = "outputs/review/morning";
mkdirSync(out, { recursive: true });

const cleared = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 3]));
const settings = { sound: false, haptics: false, speed: 1 };
// A free player who has finished the two free acts (every gate shows), and a player 42 levels in (owns everything:
// progress past Act 2 made before the unlock existed is kept as a legacy Full Army).
const SAVES = {
  free: { settings, campaign: cleared(12), puzzles: cleared(5), gauntlet: { best: 0, runs: 0 }, seen: [] },
  owner: { settings, campaign: cleared(42), puzzles: cleared(20), gauntlet: { best: 3, runs: 2 }, seen: [] },
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
  return p;
}
const skip = (name, newIn11) => (want && !want.has(name)) || (newIn11 && tag === "before");

async function still(name, save, path, { wait = 2500, click, newIn11 = false } = {}) {
  if (skip(name, newIn11)) return;
  const p = await page(save);
  await p.goto(`http://localhost:${port}/${path}`);
  await p.waitForTimeout(wait);
  if (click) { await p.click(click); await p.waitForTimeout(900); }
  await p.screenshot({ path: `${out}/${name}-${tag}.png` });
  console.log("shot", name);
  await p.context().close();
}

// A campaign battle: the AI deploys your side, then Fight, then a shot `ms` into the fight.
async function battle(name, level, ms, { newIn11 = false } = {}) {
  if (skip(name, newIn11)) return;
  const p = await page("owner");
  await p.goto(`http://localhost:${port}/?level=${level}`);
  await p.waitForTimeout(2500);
  await p.evaluate(async () => {
    const ai = await import("/engine/core/ai.ts");
    const g = window.__game, m = g.match;
    await Promise.all(g.plans ?? []);
    const me = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced" };
    ai.applyPlan(m, 0, await ai.planTurnAsync(m, 0, me));
    g.refreshHud?.();
  });
  await p.waitForTimeout(900);
  await p.evaluate(() => void window.__game.fight());
  await p.waitForTimeout(ms);
  await p.screenshot({ path: `${out}/${name}-${tag}.png` });
  console.log("shot", name);
  await p.context().close();
}

await still("title", "free", "");
await still("shop", "free", "?shop", { newIn11: true });
await still("paywall-card", "free", "?campaign=3");
await still("paywall-gauntlet", "free", "", { click: 'button:has-text("Gauntlet")' });
await still("daily", "free", "?daily", { newIn11: true });
await still("map-act1", "owner", "?campaign=1");
await still("map-act7", "owner", "?campaign=7");
await still("map-act8", "owner", "?campaign=8", { newIn11: true });
await still("map-act8-free", "free", "?campaign=8", { newIn11: true });
await battle("battle-act1", 6, 1500);
await battle("battle-act7", 40, 1500);
await battle("battle-act8", 48, 1500, { newIn11: true });
await still("battle-showcase", "owner", "?showcase=1", { wait: 3200 });
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
