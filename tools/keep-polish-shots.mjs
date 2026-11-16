// Phone-size (390x844 @2x) keep review shots: a battle deploy view, a boss keep, every damage state, and frames
// from the collapse and the winner's banner.
//   PORT=<dev port> node tools/keep-polish-shots.mjs [--out=outputs/review/polish2/keeps] [--tag=after] [--only=battle,boss,states,collapse,lose]
// Built like tools/keep-shots.mjs: fast-forwards an AI skirmish, then poses the keeps. "before" runs against a
// server for main (no boss variant or collapse there, so only battle and states are shot).
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const root = new URL("..", import.meta.url).pathname;
const BASE = `http://localhost:${process.env.PORT || 5300}`;
const OUT = arg("out", `${root}outputs/review/polish2/keeps`);
const TAG = arg("tag", "after");
const ONLY = new Set(arg("only", TAG === "before" ? "battle,states" : "battle,boss,states,collapse,lose").split(","));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function game({ seed = 11, rounds = 3, arena = 1, boss = false, names = ["You", "Warden Hask"] } = {}) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${BASE}/?lab`);
  await page.waitForSelector(".screen");
  await page.evaluate(async ({ seed, rounds, arena, boss, names }) => {
    const [{ GameScreen }, ai, defs, store] = await Promise.all([import("/base/src/ui/game.ts"), import("/engine/core/ai.ts"), import("/engine/core/defs.ts"), import("/engine/save.ts")]);
    store.save((s) => { s.seen = Object.keys(defs.UNITS); s.settings = { ...s.settings, sound: false, haptics: false }; });
    const app = document.getElementById("app");
    window.__game?.destroy?.();
    app.replaceChildren();
    const foe = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.6, tactic: "balanced" };
    const me = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced", economy: 0.3 };
    const g = new GameScreen(app, {
      cfg: { seed, firstRound: 4, startGold: [12, 12], hp: [defs.START_HP, defs.START_HP], names },
      foe, mode: "skirmish", title: "Skirmish", arena, onEnd() {}, onQuit() {},
    });
    if ("bossKeep" in g.view) g.view.bossKeep = boss;
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
    g.hpShown = [m.sides[0].hp, m.sides[1].hp];
    g.refreshHud();
    window.__k = { g, m, plan, me };
  }, { seed, rounds, arena, boss, names });
  await page.waitForTimeout(1800);
  return { page, ctx };
}

const setHp = (page, f) => page.evaluate((f) => { const { g, m } = window.__k; g.hpShown = [m.sides[0].maxHp * f[0], m.sides[1].maxHp * f[1]]; g.refreshHud(); }, f);

if (ONLY.has("battle")) {
  const { page, ctx } = await game();
  await page.screenshot({ path: `${OUT}/battle-act1-${TAG}.png` });
  // mid-battle
  await page.evaluate(() => { window.__k.g.speed = 1; window.__k.g.fight(); });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/battle-fight-${TAG}.png` });
  await ctx.close();
}

if (ONLY.has("boss")) {
  for (const [act, name] of [[1, "Warden Hask"], [7, "Empress Solace"]]) {
    const { page, ctx } = await game({ arena: act, boss: true, names: ["You", name] });
    await page.screenshot({ path: `${OUT}/boss-act${act}-${TAG}.png` });
    await setHp(page, [0.6, 0.55]);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/boss-act${act}-cracked-${TAG}.png` });
    await ctx.close();
  }
}

if (ONLY.has("states")) {
  const { page, ctx } = await game();
  for (const [f, name] of [[1, "intact"], [0.6, "cracked"], [0.35, "burning"], [0.12, "ruined"]]) {
    await setHp(page, [f, f]);
    await page.waitForTimeout(2200); // let the crumble from the state change settle
    await page.screenshot({ path: `${OUT}/state-${name}-${TAG}.png` });
  }
  await ctx.close();
}

// The finishing round: the rival is down to a sliver, so the round's damage defeats them (or you, with "lose").
for (const lose of [false, true]) {
  if (!ONLY.has(lose ? "lose" : "collapse")) continue;
  const { page, ctx } = await game({ seed: lose ? 11 : 11 });
  await page.evaluate((lose) => {
    const { g, m } = window.__k;
    const loser = lose ? 0 : 1;
    m.sides[loser].pieces = m.sides[loser].pieces.slice(0, 1);
    // A full-health keep that this round's damage defeats, so the whole fall shows (intact -> collapse).
    m.sides[loser].maxHp = 40; m.sides[loser].hp = 38;
    g.hpShown = [m.sides[0].hp, m.sides[1].hp];
    g.refreshHud();
    g.speed = 2;
    g.fight();
  }, lose);
  await page.waitForFunction(() => window.__k.g.battle?.done, null, { timeout: 60000 });
  await page.evaluate(() => { window.__k.g.speed = 1; });
  const tag = lose ? "lose" : "win";
  const loser = lose ? 0 : 1;
  // Frames keyed to the assault and the keep's own clocks: the march, the first blow, then the fall and the banner.
  const at = async (fn, arg, name) => {
    await page.waitForFunction(fn, arg, { timeout: 20000, polling: 16 });
    await page.screenshot({ path: `${OUT}/collapse-${tag}-${name}-${TAG}.png` });
  };
  await at(() => window.__k.g.view.assault?.t > 0.7, null, "a-march");
  await at((s) => window.__k.g.view.assault?.t > window.__k.g.view.assault?.hitAt[s] + 0.06, loser, "b-hit");
  for (const [t, name] of [[0.2, "c-rumble"], [0.75, "d-fall"], [1.05, "e-fall2"], [1.4, "f-rubble"], [1.75, "g-banner"], [2.1, "h-banner-up"]]) {
    await at(([s, t]) => window.__k.g.view.keeps[s].fallT > t, [loser, t], name);
  }
  await ctx.close();
}

if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
await browser.close();
console.log(`wrote ${OUT}`);
