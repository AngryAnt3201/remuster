// App Store screenshots for iPhone 6.9" (1320 x 2868, portrait, no alpha) from the dev server.
//   npm run store:shots                      all scenes, with a caption band, into store/screenshots/
//   node tools/store-shots.mjs --only=battle,ascended --no-caption --out=some/dir --base=http://127.0.0.1:5300
//   node tools/store-shots.mjs --only=iap-review     the Shop screen for the Starter Pack review screenshot (store/IAP.md), no caption
// Uses the running dev server (npm run dev, port 5300) or starts one for the run. Re-run any time the art changes.
// Scenes are built through the game's own modules (Vite serves them by URL) and the GameScreen on window.__game,
// so what you see is the real game UI and renderer; only the setup (rounds played, gold for the Ascend) is scripted.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, devices } from "playwright";
import { contentCounts, fillCounts } from "./counts.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const root = new URL("..", import.meta.url).pathname;
const BASE = arg("base", "http://127.0.0.1:5300");
const OUT = arg("out", `${root}store/screenshots`);
const ONLY = arg("only", "")?.split(",").filter(Boolean);
const CAPTION = !process.argv.includes("--no-caption");
const W = 440, H = 956, DPR = 3; // 6.9" iPhone in points; x3 = 1320 x 2868
const BAND = CAPTION ? 168 : 0; // caption band height in points
const ROUNDED = "/System/Library/Fonts/SFNSRounded.ttf"; // the font the app gets from ui-rounded on iPhone
const font = existsSync(ROUNDED) ? readFileSync(ROUNDED) : null;
const FONT_CSS = font ? `@font-face{font-family:"SF Pro Rounded";src:url(data:font/ttf;base64,${font.toString("base64")});font-weight:1 1000}` : "";

// ------------------------------------------------------------------ scenes
// Each scene: caption [headline (with <em> for teal), subline], a save to start from, and a run(page) that sets it up.
const SCENES = [
  { id: "01-battle", caption: ["Watch your army <em>fight</em>", "every unit thinks for itself"], run: battle },
  { id: "02-deploy", caption: ["Build. Place. <em>Clash.</em>", "buy from the shop, place anywhere"], run: deploy },
  { id: "03-ascended", caption: ["<em>Ascend</em> your units", "{{units}} units · {{abilities}} signature abilities"], run: ascended },
  { id: "04-campaign", caption: ["A <em>{{levels}}-level</em> campaign", "{{actsWord}} acts · a boss at the end of each"], save: { campaign: stars(11), puzzles: { 1: 3, 2: 2, 3: 3 }, gauntlet: { best: 7, runs: 4 } }, run: campaign },
  { id: "05-breakpoint", caption: ["<em>Breakpoint</em> puzzles", "one battle · fixed gold"], run: breakpoint },
  { id: "06-ai-lab", caption: ["Rivals you can <em>tune</em>", "or set two AIs on each other"], run: lab },
  // Not a listing screenshot: App Review's screenshot of the Starter Pack purchase. Only runs when asked for by --only.
  { id: "iap-review", extra: true, run: shop },
];
// Counts in captions come from base/src/core, so they match the game that ships.
const COUNTS = contentCounts();
for (const s of SCENES) if (s.caption) s.caption = s.caption.map((c) => fillCounts(c, COUNTS));

function stars(n) { const s = {}; for (let i = 1; i <= n; i++) s[i] = [3, 3, 2, 3, 1, 3, 2, 3, 3, 2, 3][(i - 1) % 11]; return s; }

/** A skirmish a few rounds in, both armies built by the game's own AI (you included), at the start of a deploy. */
async function setupMatch(page, { seed = 7, rounds = 3, firstRound = 4, gold = 12, planNow = true } = {}) {
  await page.goto(`${BASE}/?lab`);
  await page.waitForSelector(".screen");
  await page.evaluate(async ({ seed, rounds, firstRound, gold, planNow }) => {
    const [{ GameScreen }, ai, defs, store] = await Promise.all([import("/base/src/ui/game.ts"), import("/engine/core/ai.ts"), import("/engine/core/defs.ts"), import("/engine/save.ts")]);
    store.save((s) => { s.seen = Object.keys(defs.UNITS); });
    const app = document.getElementById("app");
    window.__game?.destroy?.();
    app.replaceChildren();
    const foe = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.6, tactic: "balanced" };
    const me = { ...ai.DEFAULT_AI, difficulty: 0.85, aggression: 0.5, tactic: "balanced", economy: 0.3 };
    const g = new GameScreen(app, {
      cfg: { seed, firstRound, startGold: [gold, gold], hp: [defs.START_HP, defs.START_HP], names: ["You", "Warden Hask"] },
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
    if (planNow) await plan(0, me); // otherwise this round's gold is still to spend
    g.hpShown = [m.sides[0].hp, m.sides[1].hp];
    g.refreshHud();
    window.__shots = { g, m, defs };
  }, { seed, rounds, firstRound, gold, planNow });
  await page.waitForTimeout(1700); // round banner gone, cards dealt
}

async function battle(page) {
  await setupMatch(page, { seed: 11, rounds: 4 });
  await page.evaluate(() => window.__shots.g.fight());
  await page.waitForTimeout(2300); // past the reveal beat, into the clash
}

async function deploy(page) {
  await setupMatch(page, { seed: 5, rounds: 3, planNow: false });
  // Pick up an affordable card and hold it over your half: the placement ghost shows.
  const from = await page.evaluate(() => {
    const c = [...document.querySelectorAll(".shop .card")].find((x) => !x.classList.contains("off")) ?? document.querySelector(".shop .card");
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const to = await page.evaluate(() => { const { g, defs } = window.__shots; const p = g.view.toScreen(defs.W * 0.3, defs.H - 2.2); return { x: p.x, y: p.y }; });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / 14, from.y + (to.y - from.y) * i / 14); await page.waitForTimeout(16); }
  await page.waitForTimeout(250);
}

async function ascended(page) {
  await setupMatch(page, { seed: 9, rounds: 4, firstRound: 3 });
  await page.evaluate(async () => {
    const { g, m, defs } = window.__shots;
    if (m.round < defs.ASCEND_ROUND) throw Error(`round ${m.round} is before Ascend (round ${defs.ASCEND_ROUND})`);
    const prefer = ["golem", "storm", "lancer", "bulwark", "grenadier", "ranger", "blades", "shade"];
    const mine = m.sides[0].pieces.filter((p) => p.kind !== "mine");
    const p = [...mine].sort((a, b) => (prefer.indexOf(a.kind) + 99 * (prefer.indexOf(a.kind) < 0)) - (prefer.indexOf(b.kind) + 99 * (prefer.indexOf(b.kind) < 0)) || b.rank - a.rank)[0];
    if (!p) throw Error("no unit to ascend");
    while (p.rank < defs.MAX_RANK) {
      m.sides[0].gold = Math.max(m.sides[0].gold, defs.upgradeCost(p.kind, p.rank)); // scripted: enough gold to show the Ascend
      const why = m.canUpgrade(0, p.id);
      if (why) throw Error(`cannot upgrade ${p.kind}: ${why}`);
      m.upgrade(0, p.id);
    }
    m.sides[0].gold = 9;
    g.selected = p.id;
    g.evolve(p);
    g.refreshHud();
    g.openPop(p);
  });
  await page.waitForTimeout(260); // evolve burst and Ascended banner on screen
}

async function campaign(page) {
  await page.goto(`${BASE}/?campaign`);
  await page.waitForSelector(".node");
  await page.waitForTimeout(1200);
}

async function breakpoint(page) {
  await page.goto(`${BASE}/?puzzle=5`);
  await page.waitForFunction(() => window.__game);
  await page.evaluate(async () => {
    const [defs, store] = await Promise.all([import("/engine/core/defs.ts"), import("/engine/save.ts")]);
    store.save((s) => { s.seen = Object.keys(defs.UNITS); });
    const g = window.__game, m = g.match;
    // One unit already placed at the back; the next card is held over the field.
    const slot = m.sides[0].shop.findIndex((k, i) => k && !m.canBuy(0, i));
    if (slot >= 0) m.buy(0, slot, defs.W * 0.62, defs.H - 1.4);
    g.refreshHud();
    window.__shots = { g, m, defs };
  });
  await page.waitForTimeout(1800); // intro banner gone
  const from = await page.evaluate(() => { const c = document.querySelectorAll(".shop .card")[2] ?? document.querySelector(".shop .card"); const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const to = await page.evaluate(() => { const { g, defs } = window.__shots; const p = g.view.toScreen(defs.W * 0.35, defs.H - 3.4); return { x: p.x, y: p.y }; });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / 14, from.y + (to.y - from.y) * i / 14); await page.waitForTimeout(16); }
  await page.waitForTimeout(250);
}

async function lab(page) {
  await page.goto(`${BASE}/?lab`);
  await page.waitForSelector(".screen");
  await page.waitForTimeout(900);
}

/** The Shop screen with the Starter Pack offer: ?shop if the app supports it, else the title screen's Shop button. */
async function shop(page) {
  await page.goto(`${BASE}/?shop`);
  await page.waitForSelector(".screen");
  await page.waitForTimeout(600);
  if (!(await page.getByText("Starter Pack").count())) {
    await page.goto(`${BASE}/`);
    await page.waitForSelector(".screen");
    const button = page.getByRole("button", { name: /shop/i }).first();
    if (!(await button.count())) throw Error("no Shop screen in this build yet ");
    await button.click();
    await page.getByText("Starter Pack").first().waitFor({ timeout: 5000 });
  }
  await page.waitForTimeout(900); // the mock store answers with a price
}

// ------------------------------------------------------------------ run
async function ensureServer() {
  try { await fetch(BASE); return null; } catch { /* start one */ }
  console.log(`no dev server at ${BASE}; starting one`);
  const port = new URL(BASE).port || "5300";
  const child = spawn("npx", ["vite", "--port", port, "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { await fetch(BASE); return child; } catch { /* not yet */ }
  }
  child.kill();
  throw Error("dev server did not start");
}

async function compose(browser, png, [head, sub]) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  await page.setContent(`<style>${FONT_CSS}
    html,body{margin:0;background:#0b0f17}
    .band{height:${BAND}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
      background:radial-gradient(420px 220px at 50% 0%,#1f3047 0%,#0b0f17 80%);border-bottom:1px solid rgba(63,208,201,.25);
      font-family:"SF Pro Rounded",ui-rounded,system-ui,sans-serif}
    h1{margin:0;font-size:38px;font-weight:900;line-height:1.05;color:#fff;letter-spacing:.005em;text-shadow:0 3px 0 rgba(0,0,0,.35)}
    h1 em{font-style:normal;color:#3fd0c9}
    p{margin:12px 0 0;font-size:14px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:#ffc1ad}
    img{display:block;width:${W}px;height:${H - BAND}px}
  </style><div class=band><h1>${head}</h1><p>${sub}</p></div><img src="data:image/png;base64,${png.toString("base64")}">`);
  await page.evaluate(async () => { await document.images[0].decode(); await document.fonts.ready; });
  const out = await page.screenshot({ type: "png" });
  await page.close();
  return out;
}

function checkPng(buf, name) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), colorType = buf[25];
  if (w !== W * DPR || h !== H * DPR) throw Error(`${name}: ${w}x${h}, expected ${W * DPR}x${H * DPR}`);
  if (colorType !== 2) throw Error(`${name}: PNG color type ${colorType} has alpha; App Store wants RGB`);
}

const server = await ensureServer();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const failures = [];
try {
  for (const scene of SCENES) {
    if (ONLY.length ? !ONLY.some((o) => scene.id.includes(o)) : scene.extra) continue;
    const band = CAPTION && scene.caption ? BAND : 0;
    const ctx = await browser.newContext({ ...devices["iPhone 15 Pro Max"], viewport: { width: W, height: H - band }, screen: { width: W, height: H }, deviceScaleFactor: DPR });
    const save = { campaign: {}, puzzles: {}, gauntlet: { best: 0, runs: 0 }, seen: [], ...scene.save, settings: { sound: false, haptics: false, speed: 1 } };
    await ctx.addInitScript(({ save, css }) => {
      try { localStorage.setItem("muster.save.v1", JSON.stringify(save)); } catch { /* fine */ }
      if (!css) return;
      const add = () => { if (!document.head) return false; const s = document.createElement("style"); s.textContent = css; document.head.append(s); return true; };
      if (!add()) new MutationObserver((_, o) => { if (add()) o.disconnect(); }).observe(document, { childList: true, subtree: true });
    }, { save, css: FONT_CSS });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("vibrate")) errors.push(m.text()); });
    try {
      await scene.run(page);
      let png = await page.screenshot({ type: "png" });
      if (CAPTION && scene.caption) png = await compose(browser, png, scene.caption);
      checkPng(png, scene.id);
      writeFileSync(`${OUT}/${scene.id}.png`, png);
      console.log(`${scene.id}.png${errors.length ? `  (page errors: ${errors.join(" | ")})` : ""}`);
    } catch (e) {
      failures.push(`${scene.id}: ${e.message}`);
      console.error(`${scene.id} FAILED: ${e.message}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server?.kill();
}
console.log(`-> ${OUT} (${W * DPR}x${H * DPR}${CAPTION ? ", captioned" : ""})`);
if (failures.length) process.exit(1);
