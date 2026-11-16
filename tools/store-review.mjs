// Phone-size screenshots of the Full Army gating and Shop screens (and the same screens before the change).
// node tools/store-review.mjs <outDir> [port]   (dev server must be running: npx vite --port <port>)
// Saves: a fresh player (Acts 1-2 cleared to level 12) so every gate shows, plus an owner for the unlocked look.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "outputs/review/store";
const port = process.argv[3] ?? process.env.PORT ?? "5300";
mkdirSync(out, { recursive: true });
const base = `http://localhost:${port}/`;
const campaign = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 3]));
const puzzles = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i + 1, 2]));
const fresh = { settings: { sound: false, haptics: false, speed: 1 }, campaign, puzzles, gauntlet: { best: 0, runs: 0 }, seen: [] };

const browser = await chromium.launch();
const errors = [];
async function shots(save, mock, list) {
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
      if (s.wait) await page.waitForTimeout(s.wait);
    }
    await page.screenshot({ path: `${out}/${name}.png` });
    console.log("shot", name);
  }
  await ctx.close();
}

await shots(fresh, null, [
  ["title", ""],
  ["campaign-act2", "?campaign=2"],
  ["campaign-act3", "?campaign=3"],
  ["puzzles", "?puzzles"],
  ["shop", "?shop"],
  ["paywall-from-gauntlet", "?tab=modes", [{ click: ".gauntlet-btn" }, { wait: 900 }]],
]);
await shots(fresh, null, [
  ["shop-bought", "?shop", [{ click: ".shop-buy" }, { wait: 1500 }]],
  ["campaign-act3-owned", "?campaign=3"],
  ["puzzles-owned", "?puzzles"],
]);
await shots(fresh, null, [["shop-pending", "?shop&store=pending", [{ click: ".shop-buy" }, { wait: 1500 }]]]);
await shots(fresh, null, [["shop-failed", "?shop&store=failed", [{ click: ".shop-buy" }, { wait: 1500 }]]]);
await shots(fresh, null, [["shop-offline", "?shop&store=offline", [{ wait: 1200 }]]]);
await shots(fresh, { owned: ["co.inflect.muster.fullarmy"] }, [["shop-restored", "?shop", [{ click: ".shop-restore" }, { wait: 1500 }]]]);
console.log(JSON.stringify({ errors }));
await browser.close();
