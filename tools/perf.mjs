// Frame cost of a 24-unit battle (all 24 kinds, ranks 1-4) on the diorama board, at iPhone 17 Pro size in Chromium.
// Needs this worktree's dev server: npx vite --port 5377 --strictPort, then: [PERF_GPU=1] node tools/perf.mjs [port] [cpuThrottle] [seconds] [level]
// Reports, as median/p95/max ms: the live rAF loop (render time and frame gap), then a synchronous run of the same
// battle (sim + effects + draw per 60 Hz frame) whose syncFps is the CPU-side ceiling. A desktop proxy, not the
// simulator: on a loaded machine the rAF gap measures the machine, so compare syncFrameMs against a baseline build.
import { chromium, devices } from "playwright";
const [, , port = "5300", throttle = "1", secs = "8", level = "1"] = process.argv;
// PERF_GPU=1 runs new headless Chromium with GPU raster (Metal via ANGLE); the default headless shell may raster in software.
const browser = await chromium.launch(process.env.PERF_GPU ? { channel: "chromium", args: ["--enable-gpu", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] } : {});
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 402, height: 874 }, screen: { width: 402, height: 874 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
await page.goto(`http://localhost:${port}/?level=${level}`);
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(throttle) });
const res = await page.evaluate(async (secs) => {
  const { bench } = await import("/tools/perf-bench.js");
  return bench(window.__game, (p) => import(p), secs);
}, Number(secs));
console.log(JSON.stringify({ level: Number(level), throttle: Number(throttle), ...res }, null, 1));
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
