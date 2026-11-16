// Frame-exact gameplay capture for the launch video.
//   node tools/film.mjs --game brasswick --scene clash --seconds 24 [--fps 60] [--port 5300] [--out video/captures]
//   node tools/film.mjs --game base --url "/?tab=army&seed=rich" --name army --seconds 6     (any screen, not only scenes)
//
// The page runs on a virtual clock: time only moves when the recorder steps it (1/fps at a time), timers and
// animation frames fire from that clock, CSS animations are stepped with it, Math.random is seeded, and a frame is
// only photographed once every image and fetch the page asked for has arrived. So the same scene gives the same
// frames every run and, since the battle is the engine's, the same battle in every game: frame N of the steampunk
// capture is the same moment as frame N of the western one, and an edit can cut between them mid-fight.
//
// Writes <out>/<game>/<name>.mp4 (H.264, 1080 wide), <name>.wav (the game's own sound effects for those frames,
// rendered offline by the game's synth) and <name>.json (frame count, fps, named moments in seconds).
// Needs the game's dev server running: GAME=<game> PORT=<port> npm run dev
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const game = arg("game", "base"), scene = arg("scene", ""), fps = Number(arg("fps", 60)), seconds = Number(arg("seconds", 20));
const port = Number(arg("port", process.env.PORT ?? 5300)), speed = arg("speed", "");
const url = arg("url", `/?film=${scene || "clash"}${speed ? `&speed=${speed}` : ""}`);
const name = arg("name", scene || "clash");
const outDir = join(resolve(root, arg("out", "video/captures")), game);
const W = 390, H = 844, SCALE = 1080 / W; // 1080 x 2337 frames (a 9:19.5 phone at video width)
mkdirSync(outDir, { recursive: true });

// ---- the virtual clock, installed before any page script runs
const shim = (seed) => {
  let now = 0, seq = 0, inflight = 0, loads = 0;
  const T0 = Date.UTC(2026, 10, 16, 12, 0, 0);
  const timers = new Map();
  let rafs = [];
  const RealDate = Date;
  class VDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(T0 + now); }
    static now() { return T0 + now; }
  }
  window.Date = VDate;
  performance.now = () => now;
  window.setTimeout = (fn, ms = 0, ...args) => { const id = ++seq; timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, args }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => { const id = ++seq; timers.set(id, { at: now + Math.max(1, Number(ms) || 0), fn, args, every: Math.max(1, Number(ms) || 0) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (fn) => { const id = ++seq; rafs.push({ id, fn }); return id; };
  window.cancelAnimationFrame = (id) => { rafs = rafs.filter((r) => r.id !== id); };
  let s = seed >>> 0;
  Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // what the page is still waiting for from the network
  const realFetch = window.fetch.bind(window);
  window.fetch = (...a) => { inflight++; loads++; return realFetch(...a).finally(() => { setTimeout(() => {}, 0); queueMicrotask(() => { inflight--; }); }); };
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    get() { return desc.get.call(this); },
    set(v) {
      if (v) { inflight++; loads++; const done = () => { inflight--; this.removeEventListener("load", done); this.removeEventListener("error", done); }; this.addEventListener("load", done); this.addEventListener("error", done); }
      desc.set.call(this, v);
    },
  });

  const anims = new WeakSet();
  function stepAnimations(dt) {
    for (const a of document.getAnimations()) {
      try {
        if (!anims.has(a)) { anims.add(a); a.pause(); a.currentTime = 0; } // whatever real time it ran for is discarded
        const end = a.effect?.getComputedTiming().endTime ?? Infinity;
        const t = Number(a.currentTime ?? 0) + dt;
        if (t >= end && Number.isFinite(end)) a.finish(); else a.currentTime = t;
      } catch { /* an animation that went away mid-step */ }
    }
  }
  const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

  window.__clock = {
    now: () => now, inflight: () => inflight, loads: () => loads, sync: () => stepAnimations(0), reseed: (v) => { s = v >>> 0; },
    /** Advance `dt` ms: run every timer that falls due (in order, letting promises settle between them), then one
     *  animation frame. dt = 0 redraws the current moment (used after late-arriving art). */
    async step(dt) {
      const target = now + dt;
      for (let guard = 0; guard < 20000; guard++) {
        let pick = null, pid = 0;
        for (const [id, t] of timers) if (t.at <= target && (!pick || t.at < pick.at || (t.at === pick.at && id < pid))) { pick = t; pid = id; }
        if (!pick) break;
        now = Math.max(now, pick.at);
        if (pick.every) pick.at += pick.every; else timers.delete(pid);
        try { pick.fn(...pick.args); } catch (e) { console.error(e); }
        await flush();
      }
      now = target;
      const cbs = rafs; rafs = [];
      for (const c of cbs) { try { c.fn(now); } catch (e) { console.error(e); } }
      await flush();
      stepAnimations(dt);
    },
  };
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, screen: { width: W, height: H }, deviceScaleFactor: SCALE, hasTouch: true, isMobile: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
await ctx.addInitScript(shim, 20261116);
await ctx.addInitScript(() => { try { localStorage.setItem("remuster.music", "0"); } catch { /* fine */ } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`http://localhost:${port}${url}`);

const settle = async (maxMs = 15000) => { // real time: wait for the network the page asked for
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await page.evaluate(() => window.__clock.inflight()) <= 0) { await new Promise((r) => setTimeout(r, 15)); if (await page.evaluate(() => window.__clock.inflight()) <= 0) return; }
    await new Promise((r) => setTimeout(r, 20));
  }
};
const step = (dt) => page.evaluate((d) => window.__clock.step(d), dt);

// Boot with the clock frozen: the app loads in real time (fonts, sprites, the scene's art) while virtual time stays
// at zero, so however long the network takes, the scene's first moment is always t = 0 and every run is the same.
const isFilm = url.includes("film=");
const ready = () => page.evaluate((film) => (film ? !!window.__film?.ready : !!document.querySelector("#app > *")), isFilm);
let up = false;
for (let i = 0; i < 400 && !up; i++) { await settle(); await step(0); up = await ready(); }
// (a screen that only appears after a timer: let time run, as a fallback)
for (let i = 0; i < 300 && !up; i++) { await settle(); await step(1000 / fps); up = await ready(); }
if (!up) { console.error(`the page never became ready: ${url}`); errors.push("not ready"); }
await page.evaluate(() => document.fonts.ready);
// Draw the opening moment until nothing new is being fetched (each redraw asks for the sheets it is missing).
for (let quiet = 0, i = 0; quiet < 3 && i < 200; i++) {
  const before = await page.evaluate(() => window.__clock.loads());
  await step(0); await settle();
  quiet = (await page.evaluate(() => window.__clock.loads())) === before ? quiet + 1 : 0;
}
const t0 = await page.evaluate(() => window.__clock.now());
await page.evaluate(() => { window.__clock.reseed(20261116); if (window.__film) window.__film.sfx.length = 0; });

const total = Math.round(seconds * fps);
const mp4 = join(outDir, `${name}.mp4`);
const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
  "-vf", "scale=1080:-2:flags=lanczos", "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4], { stdio: ["pipe", "inherit", "inherit"] });
const ffDone = new Promise((res) => ff.on("close", res));
const began = Date.now();
for (let f = 0; f < total; f++) {
  const before = await page.evaluate(() => window.__clock.loads());
  await step(1000 / fps);
  await settle();
  // art that arrived during this frame: draw the same moment again with it in place
  if (await page.evaluate(() => window.__clock.loads()) !== before) { await step(0); await settle(); }
  await page.evaluate(() => window.__clock.sync()); // animations born while waiting on the network start from this frame
  const jpg = await page.screenshot({ type: "jpeg", quality: 95 });
  if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 60 === 0) process.stdout.write(`\r${game}/${name}: frame ${f}/${total}`);
}
ff.stdin.end();
await ffDone;

// The sound of those frames, from the game's own synth.
const info = { game, name, url, fps, frames: total, seconds: total / fps, marks: [], errors };
if (isFilm) {
  const film = await page.evaluate((base) => ({ marks: window.__film.marks.map((m) => ({ name: m.name, t: (m.t - base) / 1000 })), sfx: window.__film.sfx.map((e) => ({ ...e, t: e.t - base })) }), t0);
  info.marks = film.marks;
  info.sounds = film.sfx.length;
  if (process.argv.includes("--debug")) info.sfx = film.sfx;
  const pcm = await page.evaluate(async ({ log, seconds }) => {
    const [l, r] = await window.__film.render(log, seconds); // the game's own synth (set by playFilm)
    const out = new Int16Array(l.length * 2);
    for (let i = 0; i < l.length; i++) { out[2 * i] = Math.max(-1, Math.min(1, l[i])) * 32767; out[2 * i + 1] = Math.max(-1, Math.min(1, r[i])) * 32767; }
    let bin = ""; const u8 = new Uint8Array(out.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(bin);
  }, { log: film.sfx, seconds: total / fps });
  const data = Buffer.from(pcm, "base64"), hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write("WAVEfmt ", 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(48000, 24); hdr.writeUInt32LE(48000 * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(data.length, 40);
  writeFileSync(join(outDir, `${name}.wav`), Buffer.concat([hdr, data]));
}
writeFileSync(join(outDir, `${name}.json`), JSON.stringify(info, null, 2) + "\n");
await browser.close();
console.log(`\r${game}/${name}: ${total} frames in ${((Date.now() - began) / 1000).toFixed(0)} s -> ${mp4}${errors.length ? `\nPAGE ERRORS:\n${[...new Set(errors)].slice(0, 8).join("\n")}` : ""}`);
