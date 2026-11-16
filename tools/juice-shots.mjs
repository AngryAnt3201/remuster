// Frame strips of the combat-feel effects (big hit, death, spawn, Ascended ability, deploy drop-in, round end) at
// phone size (390x844 @2x), for before/after review:  PORT=5194 node tools/juice-shots.mjs <outdir> <tag>
// Uses the 24-unit bench armies (ranks 1-4, so Ascended abilities fire), stops the game's rAF loop and drives the
// battle frame by frame at 60 Hz, so each strip shows exact frames after the event (round end: tools/juice-end.mjs). Writes <outdir>/<effect>-<tag>-fNN.png
// (cropped around the event) and <outdir>/<effect>-<tag>-full.png; tools/juice-strip.py stitches them into strips.
import { chromium, devices } from "playwright";
const [, , outDir = "outputs/review/polish2/juice", tag = "after"] = process.argv;
const port = process.env.PORT || 5194;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://localhost:${port}/?level=1`);
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const g = window.__game, m = g.match;
  await Promise.all(g.plans);
  const { UNITS } = await import("/engine/core/defs.ts");
  const kinds = Object.keys(UNITS).slice(-24);
  let id = 1000;
  for (const s of [0, 1]) {
    m.sides[s].pieces = Array.from({ length: 12 }, (_, i) => {
      const x = 1 + (i % 6) * 1.4, row = Math.floor(i / 6);
      const y = s === 0 ? 12.6 - row * 2 : 1.4 + row * 2;
      return { id: id++, kind: kinds[(i + s * 12) % kinds.length], side: s, x, y, rank: 4 - ((i + s) % 2), spent: 3 };
    });
    m.sides[s].seen = m.sides[s].pieces;
  }
  const sprites = await import("/base/src/render/sprites.ts");
  await sprites.loadSprites();
  for (const s of [0, 1]) sprites.preload([...Object.keys(UNITS), "mite", "golemling", "thrall", "turret", "decoy", "queen"], s);
  for (let quiet = 0, t0 = performance.now(); quiet < 15 && performance.now() - t0 < 30000;) {
    const t = performance.now();
    await new Promise((r) => setTimeout(r, 100));
    quiet = performance.now() - t > 150 ? 0 : quiet + 1;
  }
  g.refreshHud?.();
  // Stop the live loop; frames are driven from here on.
  cancelAnimationFrame(g.raf); g.destroyed = true;
  const view = g.view;
  window.__drive = (n) => { for (let i = 0; i < n; i++) { view.update(1 / 60); view.render(g.scene()); } };
  // Deploy drop-in for your whole side.
  view.dropIn(m.sides[0].pieces.map((p) => ({ id: p.id, x: p.x, y: p.y, radius: UNITS[p.kind].radius, side: 0 })));
  window.__drive(1);
});
const dpr = 2;
async function strip(name, at, frames) {
  // at: world point -> screen crop box (css px) around it.
  let f = 0;
  for (const n of frames) {
    await page.evaluate((k) => window.__drive(k), n - f);
    f = n;
    const box = await page.evaluate(([x, y]) => {
      const v = window.__game.view, p = v.cam.project(x, y, 0.4);
      return { x: Math.max(0, Math.min(390 - 200, p.x - 100)), y: Math.max(0, Math.min(844 - 200, p.y - 120)) };
    }, at);
    await page.screenshot({ path: `${outDir}/${name}-${tag}-f${String(n).padStart(2, "0")}.png`, clip: { ...box, width: 200, height: 200 } });
    if (n === frames[Math.min(2, frames.length - 1)]) await page.screenshot({ path: `${outDir}/${name}-${tag}-full.png` });
  }
}
// Deploy drop-in: frames since the drop started.
await strip("spawn-drop", [4.2, 12.6], [0, 6, 12, 18, 24, 32, 44]);
// Fight, then stop the loop again and step the battle ourselves (sim at 30 Hz, render at 60 Hz).
await page.evaluate(async () => {
  const g = window.__game;
  g.destroyed = false;
  await g.fight();
  cancelAnimationFrame(g.raf); g.destroyed = true;
  const bt = g.battle, view = g.view;
  g.hold = 0;
  let f = 0;
  window.__drive = (n) => {
    for (let i = 0; i < n; i++) {
      if (f++ % 2 === 0 && !bt.done) { window.__seen.push(...bt.events.map((e) => ({ ...e, time: bt.time }))); bt.step(); window.__seen.push(...bt.events.map((e) => ({ ...e, time: bt.time }))); view.consume(bt); }
      view.update(1 / 60); view.render(g.scene());
    }
  };
  window.__seen = [];
});
const ASC = new Set(["volley", "twin", "revive", "bomblets", "reset", "impale"]);
const wants = {
  "big-hit": (e) => e.t === "hit" && e.big && !e.shielded,
  death: (e) => e.t === "death" && e.kind !== "mite" && e.kind !== "decoy",
  "battle-spawn": (e) => e.t === "spawn" && e.kind !== "decoy",
  ascended: (e) => ASC.has(e.t) || (e.t === "slash" && e.spin) || (e.t === "hook") || (e.t === "spawn" && e.kind === "queen"),
};
const done = new Set();
for (let guard = 0; guard < 2400 && done.size < Object.keys(wants).length; guard++) {
  const hit = await page.evaluate(() => { window.__seen = []; window.__drive(1); const g = window.__game; return { ev: window.__seen, t: g.battle.time, over: g.battle.done }; });
  for (const e of hit.ev) {
    for (const [name, ok] of Object.entries(wants)) {
      if (done.has(name) || hit.t < 1 || !ok(e)) continue;
      done.add(name);
      await strip(name, [e.x ?? 4.5, e.y ?? 7], [0, 2, 4, 7, 11, 16, 24]);
    }
  }
  if (hit.over) break;
}
// Round end: see tools/juice-end.mjs (plays a real level to its end on the game's own loop).
console.log("captured:", [...done].join(", "));
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
