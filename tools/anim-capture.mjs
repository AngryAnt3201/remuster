// A short battle capture for reviewing unit motion: stages a mirror battle with the given kinds (ranks 1-4), records
// it with the DevTools screencast at phone size, and converts it to <out>.mp4 and <out>.gif (ffmpeg), plus a still.
//   node tools/anim-capture.mjs <out-prefix> [kinds, comma separated] [seconds] [port] [zoom]
// Needs the dev server: npx vite --host 127.0.0.1 --port 5300. zoom (e.g. 2) crops the middle of the board and scales
// it up so single units can be judged at a glance. Prints console errors.
import { chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , out = "captures/anim", kindsArg = "", secs = "5", port = "5300", zoom = "1"] = process.argv;
const W = 390, H = 844;
const vdir = mkdtempSync(join(tmpdir(), "anim-cap-"));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: W, height: H }, screen: { width: W, height: H }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem("muster.save.v1", JSON.stringify({ settings: { sound: false, haptics: false, speed: 1 }, campaign: {}, puzzles: {}, gauntlet: { best: 0, runs: 0 }, seen: [] })));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("vibrate")) errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/?level=1`);
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate(async (kinds) => {
  const g = window.__game;
  await Promise.all(g.plans ?? []);
  const { UNITS } = await import("/engine/core/defs.ts");
  const ks = kinds.length ? kinds : Object.keys(UNITS).slice(0, 8);
  let id = 5000;
  for (const s of [0, 1]) {
    g.match.sides[s].pieces = ks.map((k, i) => ({
      id: id++, kind: k, side: s, x: 1 + (i % 6) * 1.4, y: s === 0 ? 11.6 - Math.floor(i / 6) * 1.6 : 2.4 + Math.floor(i / 6) * 1.6,
      rank: 1 + ((i + s) % 4), spent: 3,
    }));
  }
  const sp = await import("/base/src/render/sprites.ts");
  await sp.loadSprites();
  for (const s of [0, 1]) sp.preload([...ks, "mite", "thrall", "turret", "decoy", "queen", "golemling"], s);
  g.refreshHud?.();
}, kindsArg ? kindsArg.split(",") : []);
await page.waitForTimeout(2500);
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on("Page.screencastFrame", (f) => {
  frames.push({ data: f.data, t: f.metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "png", maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });
await page.evaluate(() => void window.__game.fight());
await page.waitForTimeout(Number(secs) * 1000);
await cdp.send("Page.stopScreencast");
await page.screenshot({ path: `${out}.png` });
await browser.close();
// frames arrive when the page repaints: write them with their real durations and let ffmpeg resample
let list = "";
frames.forEach((f, i) => {
  const name = join(vdir, `f${String(i).padStart(4, "0")}.png`);
  writeFileSync(name, Buffer.from(f.data, "base64"));
  const dur = i + 1 < frames.length ? Math.max(0.005, frames[i + 1].t - f.t) : 0.05;
  list += `file '${name}'\nduration ${dur.toFixed(4)}\n`;
});
writeFileSync(join(vdir, "list.txt"), list);
const z = Number(zoom);
// screencast frames come at CSS size; zoom crops the middle and scales it back up (even sizes for x264)
const crop = (z > 1 ? `crop=iw/${z}:ih/${z}:(iw-iw/${z})/2:(ih-ih/${z})/2,` : "") + `scale=trunc(iw*${z}/2)*2:trunc(ih*${z}/2)*2:flags=lanczos,`;
const inp = ["-f", "concat", "-safe", "0", "-i", join(vdir, "list.txt")];
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inp, "-vf", `${crop}fps=30,format=yuv420p`, `${out}.mp4`]);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...inp, "-vf", `${crop}fps=15,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none`, `${out}.gif`]);
const span = frames.length > 1 ? frames.at(-1).t - frames[0].t : 0;
rmSync(vdir, { recursive: true, force: true });
console.log(JSON.stringify({ out, frames: frames.length, captureFps: +(frames.length / Math.max(0.001, span)).toFixed(1), mp4: `${out}.mp4`, gif: `${out}.gif`, still: `${out}.png`, errors }));
