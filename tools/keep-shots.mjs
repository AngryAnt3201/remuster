// Keep and round-end assault frames from the dev server, for review:
//   node tools/keep-shots.mjs [--base=http://127.0.0.1:5300] [--out=outputs/keeps] [--seed=11] [--rounds=4] [--lose]
// --lose strips your army to one piece before the shot round, so the rival marches on your keep instead.
// Fast-forwards a skirmish built by the game's AI, fights a round on screen, and shoots the battle, the march,
// the hit on the keep and the bar draining. Also writes a deploy frame per keep damage state.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const root = new URL("..", import.meta.url).pathname;
const BASE = arg("base", "http://127.0.0.1:5300");
const OUT = arg("out", `${root}outputs/keeps`);
const SEED = Number(arg("seed", "11")), ROUNDS = Number(arg("rounds", "4")), LOSE = process.argv.includes("--lose");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`${BASE}/?lab`);
await page.waitForSelector(".screen");
await page.evaluate(async ({ seed, rounds, lose }) => {
  const [{ GameScreen }, ai, defs, store] = await Promise.all([import("/base/src/ui/game.ts"), import("/engine/core/ai.ts"), import("/engine/core/defs.ts"), import("/engine/save.ts")]);
  store.save((s) => { s.seen = Object.keys(defs.UNITS); });
  const app = document.getElementById("app");
  window.__game?.destroy?.();
  app.replaceChildren();
  const foe = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.6, tactic: "balanced" };
  const me = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced", economy: 0.3 };
  const g = new GameScreen(app, {
    cfg: { seed, firstRound: 4, startGold: [12, 12], hp: [defs.START_HP, defs.START_HP], names: ["You", "Warden Hask"] },
    foe, mode: "skirmish", title: "Skirmish", onEnd() {}, onQuit() {},
  });
  const m = g.match;
  const plan = async (side, p) => ai.applyPlan(m, side, await ai.planTurnAsync(m, side, p));
  for (let i = 0; i < rounds; i++) {
    await Promise.all(g.plans);
    await plan(0, me);
    m.fight();
    if (m.phase === "over") throw Error("match ended while fast-forwarding; try another seed");
    m.next();
    g.startDeploy();
  }
  await Promise.all(g.plans);
  await plan(0, me);
  if (lose) m.sides[0].pieces = m.sides[0].pieces.slice(0, 1);
  g.hpShown = [m.sides[0].hp, m.sides[1].hp];
  g.refreshHud();
  window.__k = { g, m, defs };
}, { seed: SEED, rounds: ROUNDS, lose: LOSE });
await page.waitForTimeout(1700);
await page.screenshot({ path: `${OUT}/01-deploy.png` });
await page.evaluate(() => { window.__k.g.speed = 2; window.__k.g.fight(); });
// Wait for the battle to end, then shoot the assault as it plays.
await page.waitForFunction(() => window.__k.g.battle?.done, null, { timeout: 60000 });
await page.screenshot({ path: `${OUT}/02-battle-end.png` });
const t0 = Date.now();
for (const [ms, name] of [[1150, "03-march"], [1900, "04-attack"], [2500, "05-hit"], [3300, "06-drain"]]) {
  await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
// Every damage state on both keeps, in the deploy view (the next round's deploy, once the assault is over).
await page.waitForFunction(() => !window.__k.g.assault, null, { timeout: 20000 });
for (const [i, f] of [[0, 1], [1, 0.7], [2, 0.4], [3, 0.12]]) {
  await page.evaluate((f) => { const { g, m } = window.__k; g.hpShown = [m.sides[0].maxHp * f, m.sides[1].maxHp * f]; g.refreshHud(); }, f);
  await page.waitForTimeout(2200); // let the crumble from the state change settle
  await page.screenshot({ path: `${OUT}/1${i}-state-${["intact", "cracked", "burning", "ruined"][i]}.png` });
}
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
console.log(`wrote ${OUT}`);
