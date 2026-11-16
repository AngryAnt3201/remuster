// Frame sequences for docs/POLISH-SCORECARD.md at phone size (390x844 @2x): every moment the scorecard grades, as one
// strip per moment, so motion can be judged (a still cannot show it).
//   PORT=5377 node tools/scorecard-shots.mjs <tag> [--only=battle,home,chest,upgrade,victory,keep] [--level=1]
// Writes outputs/review/scorecard/<tag>/<moment>.jpg and prints, per strip, the share of pixels that change between
// consecutive frames (a rough "how much moves" number).
// Battle moments are driven frame by frame at 60 Hz with the game's own loop rules (hit-stop holds the sim, the
// final blow runs at 0.35x), on the 24-unit bench armies (tools/perf-bench.js). Each strip keeps frames from before
// its event (a ring of the last 16 frames), so wind-ups show. Screens (home, chest, upgrade, victory) run live and
// are shot as fast as the browser allows; the keep uses tools/keep-polish-shots.mjs.
import { chromium, devices } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const tag = process.argv[2] ?? "before";
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const only = new Set(arg("only", "battle,home,chest,upgrade,victory,keep").split(","));
const level = arg("level", "1");
const port = process.env.PORT || 5377;
const host = `http://localhost:${port}`;
const out = `outputs/review/scorecard/${tag}`;
const PY = process.env.PYTHON || "/usr/local/bin/python3";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const phone = { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2 };
async function open(save) {
  const ctx = await browser.newContext(phone);
  if (save) await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("muster.save.v1", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(save));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("vibrate")) errors.push(m.text()); });
  return { ctx, page };
}
/** Shoot `n` frames back to back into a temp folder and stitch them into <name>.jpg (labelled with ms since the first). */
async function burst(page, name, n, { gap = 0, cols = 6, scale = 0.5 } = {}) {
  const dir = `${out}/.${name}`;
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const ms = Date.now() - t0;
    await page.screenshot({ path: `${dir}/${String(i).padStart(2, "0")}_${ms}ms.png` });
    if (gap) await page.waitForTimeout(gap);
  }
  stitch(dir, name, cols, scale);
}
function stitch(dir, name, cols, scale) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort().map((f) => `${dir}/${f}`);
  const res = execFileSync(PY, ["tools/scorecard-strip.py", `${out}/${name}.jpg`, String(cols), String(scale), ...files]).toString().trim();
  console.log(res);
  rmSync(dir, { recursive: true, force: true });
}

const cleared = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 3]));
const found = ["blades", "ranger", "mine", "medic", "bulwark", "lancer", "grenadier", "ballista", "shade", "hive", "storm"];
const player = {
  settings: { sound: false, haptics: false, speed: 1 }, puzzles: {}, gauntlet: { best: 0, runs: 0 }, seen: [], campaign: cleared(14),
  wallet: { coins: 2450, gems: 260, earned: { coins: 2450, gems: 260 }, spent: { coins: 0, gems: 0 }, txIds: [] },
  rewards: { paid: ["act1", "act2"] },
  progression: { v: 2, xp: 250, legacyPaid: true, levels: { blades: 3, ranger: 4, bulwark: 2, mine: 2, lancer: 3, medic: 2 }, deck: ["blades", "ranger", "bulwark", "lancer", "medic", "shade"] },
  collection: { found, cards: { blades: 9, ranger: 11, mine: 3, medic: 6, bulwark: 5, lancer: 2, grenadier: 1, ballista: 3, shade: 1, hive: 0, storm: 1 } },
};

// ------------------------------------------------------------------------------------------------ battle moments
if (only.has("battle")) {
  const { ctx, page } = await open({ settings: { sound: false, haptics: false, speed: 1 }, campaign: {}, puzzles: {}, gauntlet: { best: 0, runs: 0 }, seen: [] });
  await page.goto(`${host}/?level=${level}`);
  await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const strips = await page.evaluate(async () => {
    const g = window.__game, m = g.match;
    await Promise.all(g.plans);
    const { UNITS, DT } = await import("/engine/core/defs.ts");
    const kinds = Object.keys(UNITS).slice(-24);
    let id = 1000;
    for (const s of [0, 1]) {
      m.sides[s].pieces = Array.from({ length: 12 }, (_, i) => {
        const x = 1 + (i % 6) * 1.4, row = Math.floor(i / 6);
        const y = s === 0 ? 12.6 - row * 2 : 1.4 + row * 2;
        return { id: id++, kind: kinds[(i + s * 12) % kinds.length], side: s, x, y, rank: 1 + ((i + s) % 4), spent: 3 };
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
    cancelAnimationFrame(g.raf); g.destroyed = true;
    const view = g.view, cv = view.canvas, dpr = view.dpr;
    const K = 16, ring = Array.from({ length: K }, () => { const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height; return c; });
    let f = 0, acc = 0;
    const pend = [], done = {}, stats = {};
    const cell = (src, at, size) => {
      const c = document.createElement("canvas");
      if (size === "full") {
        c.width = cv.width / 2; c.height = cv.height / 2;
        const x = c.getContext("2d"); x.fillStyle = "#14161c"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
        return c;
      }
      const p = view.cam.project(at[0], at[1], 0.4);
      const cx = Math.max(0, Math.min(view.cssW - size, p.x - size / 2)), cy = Math.max(0, Math.min(view.cssH - size, p.y - size * 0.6));
      c.width = c.height = size * dpr;
      const x = c.getContext("2d"); x.fillStyle = "#14161c"; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(src, cx * dpr, cy * dpr, size * dpr, size * dpr, 0, 0, size * dpr, size * dpr);
      return c;
    };
    /** Start a strip: offs are frame offsets from now (negative ones come from the ring), at() the world point to centre on. */
    const trigger = (name, offs, size, at) => {
      if (done[name] || pend.some((p) => p.name === name)) return;
      const p = { name, f0: f, offs, size, at, cells: new Map() };
      for (const o of offs) if (o < 0 && f + o >= 0 && -o <= K) p.cells.set(o, cell(ring[(f + o) % K], at(), size));
      pend.push(p);
    };
    const finish = (p) => {
      const cells = p.offs.filter((o) => p.cells.has(o)).map((o) => [o, p.cells.get(o)]);
      const cols = p.size === "full" ? cells.length : 5, rows = Math.ceil(cells.length / cols);
      const w = cells[0][1].width, h = cells[0][1].height, gap = 6;
      const c = document.createElement("canvas");
      c.width = cols * w + (cols - 1) * gap; c.height = rows * (h + gap);
      const x = c.getContext("2d");
      x.fillStyle = "#14161c"; x.fillRect(0, 0, c.width, c.height);
      x.font = "bold 22px sans-serif";
      const moved = [];
      let prev = null;
      cells.forEach(([o, im], i) => {
        const px = (i % cols) * (w + gap), py = Math.floor(i / cols) * (h + gap);
        x.drawImage(im, px, py);
        x.fillStyle = "rgba(0,0,0,0.6)"; x.fillRect(px, py, 78, 30);
        x.fillStyle = "#fff"; x.fillText(`${o >= 0 ? "+" : ""}${o}f`, px + 8, py + 23);
        const d = im.getContext("2d").getImageData(0, 0, w, h).data;
        if (prev) { let n = 0; for (let k = 0; k < d.length; k += 16) if (Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]) + Math.abs(d[k + 2] - prev[k + 2]) > 48) n++; moved.push(+(100 * n / (d.length / 16)).toFixed(1)); }
        prev = d;
      });
      done[p.name] = c.toDataURL("image/jpeg", 0.86);
      stats[p.name] = moved;
    };
    const seq = (a, b, n) => Array.from({ length: n }, (_, i) => Math.round(a + ((b - a) * i) / (n - 1)));
    let calls = 0, walkAt = -1, midDone = false;
    const onEv = (e, bt) => {
      const find = (i) => bt.bodies.find((b) => b.id === i);
      if (e.t === "shot" && (e.kind === "arrow" || e.kind === "bolt") && bt.time > 0.6) {
        const s = find(e.id), tg = s && find(s.target);
        if (s && tg) { const mx = (s.x + tg.x) / 2, my = (s.y + tg.y) / 2; trigger("ranged-shot", [-6, -3, 0, 3, 6, 10, 14, 18, 23, 28], 300, () => [mx, my]); }
      }
      if (e.t === "shot" && (e.kind === "grenade" || e.kind === "shell")) {
        const s = find(e.id), pr = bt.projs[bt.projs.length - 1];
        if (s && pr) { const mx = (s.x + pr.tx) / 2, my = (s.y + pr.ty) / 2; trigger("lobbed-shot", [-4, 0, 8, 16, 24, 32, 40, 50, 60, 72], 300, () => [mx, my]); }
      }
      if (e.t === "death" && !["mite", "decoy", "thrall", "golemling"].includes(e.kind) && bt.time > 1) trigger("death", [-6, -2, 0, 3, 6, 10, 15, 21, 28, 36], 200, () => [e.x, e.y]);
      if (e.t === "hit" && e.big && !e.shielded && bt.time > 1) trigger("big-hit", [-3, 0, 1, 2, 3, 5, 8, 12, 17, 24], 200, () => [e.x, e.y]);
      if (e.t === "spawn" && e.kind !== "decoy" && bt.time > 1) trigger("battle-spawn", [-2, 0, 2, 4, 7, 11, 16, 22, 30, 40], 200, () => [e.x, e.y]);
      if (e.t === "end") trigger("final-blow", [-6, 0, 6, 16, 30, 50, 75, 100], "full", () => [4.5, 7]);
    };
    const drive = (n = 1) => {
      for (let i = 0; i < n; i++) {
        const bt = g.battle;
        if (bt && g.phase === "battle") {
          if (g.hold > 0) g.hold -= 1 / 60;
          else {
            if (!view.hitStopping) acc += (1 / 60) * (bt.done ? 0.35 : 1);
            while (acc >= DT && !bt.done) { bt.step(); for (const e of bt.events) onEv(e, bt); view.consume(bt); acc -= DT; }
            g.acc = acc;
            // a melee blow: a ground fighter whose swing started this tick, with its target in view
            if (bt.time > 1.5 && !done["melee-hit"]) {
              const m = bt.bodies.find((b) => b.alive && !b.structure && !b.flying && b.range < 1.2 && b.swing > bt.time - DT * 1.5 && bt.bodies.some((o) => o.id === b.target && o.alive));
              if (m) { const tg = bt.bodies.find((o) => o.id === m.target), mx = (m.x + tg.x) / 2, my = (m.y + tg.y) / 2; trigger("melee-hit", [-12, -9, -6, -3, 0, 2, 4, 7, 11, 16], 200, () => [mx, my]); }
            }
            if (view.juice.callouts.length > calls) { const c = view.juice.callouts[view.juice.callouts.length - 1]; trigger("ability-cast", [-4, 0, 2, 5, 9, 14, 20, 28, 40, 55], 240, () => [c.x, c.y]); }
            calls = view.juice.callouts.length;
            if (walkAt < 0 && bt.time > 0.5) { walkAt = f; const w = bt.bodies.find((b) => b.side === 0 && b.kind === "pikeman") ?? bt.bodies.find((b) => b.side === 0 && !b.structure); trigger("walk", seq(0, 36, 10), 180, () => [w.x, w.y]); }
            if (!midDone && bt.time > 4) { midDone = true; stats.midBodies = bt.bodies.filter((b) => b.alive).length; trigger("mid-battle", [0, 5, 10, 15, 20, 25], "full", () => [4.5, 7]); }
          }
        }
        view.update(1 / 60); view.render(g.scene());
        ring[f % K].getContext("2d").drawImage(cv, 0, 0);
        for (let k = pend.length - 1; k >= 0; k--) {
          const p = pend[k], o = f - p.f0;
          if (p.offs.includes(o)) p.cells.set(o, cell(cv, p.at(), p.size));
          if (o >= p.offs[p.offs.length - 1]) { finish(p); pend.splice(k, 1); }
        }
        f++;
      }
    };
    // Deploy phase: the board at rest (idle life, ambient arena), then the whole side dropping in.
    drive(20);
    const me = m.sides[0].pieces;
    trigger("idle", seq(0, 90, 10), 240, () => [me[2].x + 0.7, me[2].y]);
    trigger("ambient-arena", [0, 60, 120, 180, 240, 300], "full", () => [4.5, 7]);
    drive(310);
    view.dropIn(me.map((p) => ({ id: p.id, x: p.x, y: p.y, radius: UNITS[p.kind].radius, side: 0 })));
    trigger("deploy-drop", [0, 4, 8, 12, 16, 20, 24, 30, 38, 48], 240, () => [me[2].x + 0.7, me[2].y]);
    drive(60);
    g.destroyed = false;
    await g.fight();
    cancelAnimationFrame(g.raf);
    const bt = g.battle;
    for (let guard = 0; guard < 60 * 70 && !(bt.done && !pend.length); guard++) drive(1);
    drive(110);
    for (const p of [...pend]) finish(p);
    return { done, stats, time: bt.time, winner: bt.winner };
  });
  for (const [name, url] of Object.entries(strips.done)) writeFileSync(`${out}/${name}.jpg`, Buffer.from(url.split(",")[1], "base64"));
  console.log("battle strips:", Object.keys(strips.done).join(", "));
  console.log("moved % between frames:", JSON.stringify(strips.stats));
  await ctx.close();
}

// ------------------------------------------------------------------------------------------------ screens (live)
if (only.has("home")) {
  const { ctx, page } = await open(player);
  await page.goto(`${host}/`);
  await page.waitForTimeout(2500);
  await burst(page, "home-idle", 6, { gap: 350 });
  // a tab change and a button press
  const tabs = page.locator(".tb-bar button");
  if (await tabs.count()) { await tabs.nth(1).click(); await burst(page, "home-tab-change", 6); }
  await ctx.close();
}
if (only.has("chest")) {
  const { ctx, page } = await open(player);
  await page.goto(`${host}/?chests=open`);
  await page.waitForTimeout(1200);
  await burst(page, "chest-wait", 4, { gap: 250, cols: 4 });
  await page.mouse.click(195, 700);
  await burst(page, "chest-open", 12);
  await page.mouse.click(195, 700);
  await burst(page, "chest-card", 6);
  for (let i = 0; i < 8; i++) { await page.mouse.click(195, 700); await page.waitForTimeout(350); }
  await burst(page, "chest-summary", 12, { gap: 120 });
  await ctx.close();
}
if (only.has("upgrade")) {
  const { ctx, page } = await open(player);
  await page.goto(`${host}/?army`);
  await page.waitForTimeout(1500);
  await page.locator(".ar-tile.ready").first().click();
  await page.waitForTimeout(700);
  await page.locator(".ar-upbtn").click();
  await burst(page, "card-upgrade", 12);
  await ctx.close();
}
if (only.has("victory")) {
  const { ctx, page } = await open(player);
  await page.goto(`${host}/?gemdemo=reward`, { waitUntil: "commit" });
  await page.waitForSelector(".sheet, .results, .screen", { timeout: 30000 });
  await burst(page, "victory", 18, { cols: 6 });
  await ctx.close();
}
await browser.close();
if (only.has("keep")) {
  const dir = `${out}/.keep`;
  execFileSync("node", ["tools/keep-polish-shots.mjs", `--out=${dir}`, `--tag=x`, "--only=states,collapse"], { env: { ...process.env, PORT: String(port) }, stdio: "inherit" });
  stitch(dir, "keep-damage-collapse", 6, 0.5);
}
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
