// Phone-size (390x844 @2x) review shots for the free-to-play change: title (Gauntlet with no Full Army tag), the Shop
// with the Starter Pack unbought, bought, pending and failed, and Act 5 and the Gauntlet opening with no gate.
// PORT=<port> node tools/open-shots.mjs [outDir]   (dev server must be running)
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "outputs/review/open";
const port = process.env.PORT ?? "5300";
mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}/`;
// A free player who has cleared Acts 1-4 (24 levels): Act 5 is next, and was behind the Full Army before.
const campaign = Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i + 1, i % 3 === 0 ? 2 : 3]));
const puzzles = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i + 1, 2]));
const wallet = (gems, coins = 640) => ({ coins, gems, earned: { coins, gems }, spent: { coins: 0, gems: 0 }, txIds: [] });
const player = (extra = {}) => ({ settings: { sound: false, haptics: false, speed: 1 }, campaign, puzzles, gauntlet: { best: 0, runs: 0 }, seen: [], wallet: wallet(120), ...extra });

const browser = await chromium.launch();
const errors = [];
async function shots(save, list) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("muster.save.v1", JSON.stringify(s));
      localStorage.removeItem("muster.mockstore.v1");
      sessionStorage.setItem("seeded", "1");
    }
  }, save);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  for (const [name, path, steps = [], check] of list) {
    await page.goto(base + path);
    await page.waitForTimeout(1600);
    for (const s of steps) {
      if (s.click) await page.click(s.click);
      if (s.wait) await page.waitForTimeout(s.wait);
    }
    await page.screenshot({ path: `${out}/${name}.png` });
    if (check) { const r = await page.evaluate(check); if (r !== true) errors.push(`${name}: ${r}`); }
    console.log("shot", name);
  }
  await ctx.close();
}

const BUY = '[data-offer="starter"] .shop-buy';
const noGate = () => (document.querySelector(".map-gate, .act-gate, .paywall, .tile-gate, .gated") ? "a gate is showing" : true);
// page.evaluate can't see closures, so the checks below repeat the gate selector.
await shots(player(), [
  ["title", "", [], () => (/Full Army/.test(document.body.textContent) ? "title still says Full Army" : true)],
  ["shop-starter-unbought", "?shop", [], () => (document.querySelector('[data-offer="starter"]') && document.getElementById("shop-chests") ? true : "starter offer or #shop-chests missing")],
  ["act5-open", "?campaign=5", [], () => (document.querySelector(".map-gate, .act-gate, .paywall, .gated") ? "a gate is showing" : document.querySelector(".node.current") ? true : "no current node on Act 5")],
  ["gauntlet-open", "", [{ click: ".gauntlet-btn" }, { wait: 1400 }], () => (document.querySelector(".paywall, .act-gate") ? "a gate is showing" : document.querySelector(".title") ? "still on the title" : true)],
  ["puzzles-open", "?puzzles", [], noGate],
]);
await shots(player(), [["shop-starter-bought", "?shop", [{ click: BUY }, { wait: 900 }], () => (document.querySelector('[data-offer="starter"][data-state="owned"]') ? true : "no Owned state")]]);
await shots(player(), [["shop-starter-gone", "?shop", [{ click: BUY }, { wait: 3600 }], () => (document.querySelector('[data-offer="starter"]') ? "offer still showing after buy" : true)]]);
await shots(player({ store: { starter: { txId: "t", at: 1 } } }), [["shop-starter-owned-reopen", "?shop", [], () => (document.querySelector('[data-offer="starter"]') ? "offer shown after it was bought" : true)]]);
await shots(player(), [["shop-starter-pending", "?shop&store=pending", [{ click: BUY }, { wait: 1200 }], () => (document.querySelector('[data-offer="starter"][data-state="pending"]') ? true : "no pending state")]]);
await shots(player(), [["shop-starter-failed", "?shop&store=failed", [{ click: BUY }, { wait: 1200 }], () => (document.querySelector('[data-offer="starter"][data-state="failed"]') ? true : "no failed state")]]);
await browser.close();
if (errors.length) { console.error("errors:\n" + errors.join("\n")); process.exit(1); }
console.log("ok");
