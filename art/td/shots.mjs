// Before/after phone shots of the Bastion backdrops (390x844 @2x) from the dev server:
//   PORT=5391 node art/td/shots.mjs [outDir] [--before]   (default outputs/review/td-art)
// --before blocks base/public/td so the old procedural ground draws. Per map: zoomed out, zoomed in, mid-wave, and the
// ?tddebug overlay (sim road edges in magenta, pad rings in cyan) over the render.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
const PORT = process.env.PORT || "5391";
const out = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "outputs/review/td-art";
const before = process.argv.includes("--before");
const tag = before ? "before" : "after";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
if (before) await page.route("**/td/manifest.json", (r) => r.abort());
const base = `http://localhost:${PORT}/`;
const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: `${out}/${tag}-${name}.png` });
for (const map of ["meadow", "fords"]) {
  await page.goto(`${base}?td=${map}`);
  await wait(2500);
  await page.evaluate(() => { const t = window.__td; t.closeSheet?.(); t.view.cam.follow = null; t.view.cam.zoom = 0.8; t.view.cam.centerOn(t.run.map.w / 2, 10); });
  await wait(600);
  await shot(`${map}-zoomed-out`);
  await page.evaluate(() => { const t = window.__td; const p = t.run.map.pads[4]; t.view.cam.zoom = 2.4; t.view.cam.centerOn(p.x, p.y); });
  await wait(600);
  await shot(`${map}-zoomed-in`);
  // Mid-wave: build every pad, run the sim to wave 8, then look at the front.
  await page.evaluate(() => {
    const t = window.__td, run = t.run;
    t.pause(true);
    const order = ["pikeman", "ranger", "grenadier", "ranger", "blades", "storm", "ballista", "medic", "rime", "bulwark"];
    const pads = [...run.map.pads].sort((a, b) => b.y - a.y);
    let guard = 0;
    while (run.wave < 8 && run.phase !== "lost" && guard++ < 200000) {
      if (run.phase === "build") {
        let i = run.defenders.length;
        for (const p of pads) { if (run.defenderAt(p.id)) continue; const k = order[i % order.length]; if (run.place(p.id, k)) i++; else break; }
        for (let g = 0; g < 30; g++) { const d = [...run.defenders].filter((d) => d.rank < 3).sort((a, b) => a.rank - b.rank)[0]; if (!d || !run.upgrade(d.id)) break; }
        run.callWave();
      }
      run.step(); run.drain();
    }
    for (let i = 0; i < 12 * 30; i++) { run.step(); t.view.absorb(run.drain()); }
    t.refresh(true);
    t.pause(false);
    t.setFollow(false); t.view.cam.follow = null; t.view.cam.zoom = 1.3;
    const f = t.view.front(); if (f) t.view.cam.centerOn(f.x, f.y - 3);
  });
  await wait(700);
  await shot(`${map}-mid-wave`);
  if (!before) {
    await page.goto(`${base}?td=${map}&tddebug`);
    await wait(2500);
    await page.evaluate(() => { const t = window.__td; t.closeSheet?.(); t.view.cam.follow = null; t.view.cam.zoom = 1.6; t.view.cam.centerOn(t.run.map.w / 2, 18); });
    await wait(600);
    await shot(`${map}-debug-overlay`);
  }
}
console.log(JSON.stringify({ tag, errors }));
await browser.close();
