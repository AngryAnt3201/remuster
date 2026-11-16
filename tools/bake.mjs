// Bake a game's art from its TypeScript builders (games/<game>/art) into the files the runtime loads
// (games/<game>/public/...). See artkit/README.md.
//
//   node tools/bake.mjs <game> [--only units,portraits,arenas,keeps,vfx,maps,ui,td] [--kinds ranger,golem] [--tiers 1,4]
//   node tools/bake.mjs <game> --only arenas --acts 1,5                    just those acts
//   node tools/bake.mjs <game> --preview [--kinds ranger] [--tiers 4]     contact sheets into games/<game>/art/preview
//   node tools/bake.mjs <game> --preview --only arenas [--acts 3]         a strip of arena backdrops, etc.
//   node tools/bake.mjs <game> --check                                    is the art complete and valid? (also runs after a full bake)
//   options: --jobs N (parallel pages for units, default 3)   --port P (default 5318)
//
// It serves artkit/bake/index.html with Vite (so the builders run as TypeScript in a real canvas), drives it with
// headless Chromium (Playwright) and writes whatever the page saves. Nothing else is needed: no Blender, no Python.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const game = argv.find((a) => !a.startsWith("--"));
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined; };
const list = (n) => opt(n)?.split(",").map((s) => s.trim()).filter(Boolean);
if (!game) { console.error("usage: node tools/bake.mjs <game> [--only units,arenas,keeps,vfx,portraits,maps,ui,td] [--kinds a,b] [--tiers 1,4] [--preview]"); process.exit(2); }
const gameDir = join(root, "games", game);
if (!existsSync(join(gameDir, "art", "index.ts"))) { console.error(`${game}: no games/${game}/art/index.ts`); process.exit(2); }

const FAMILIES = ["units", "portraits", "arenas", "keeps", "vfx", "maps", "ui", "td"];
const only = list("only") ?? (list("kinds") ? ["units", "portraits"] : FAMILIES);
for (const f of only) if (!FAMILIES.includes(f)) { console.error(`unknown family "${f}" (expected ${FAMILIES.join(", ")})`); process.exit(2); }
const kinds = list("kinds"), tiers = list("tiers")?.map(Number), acts = list("acts")?.map(Number);
const jobs = Math.max(1, Number(opt("jobs") ?? 3));
const port = Number(opt("port") ?? process.env.BAKE_PORT ?? 5318);

const server = await createServer({
  configFile: false, root, logLevel: "warn", publicDir: join(root, "base/public"),
  resolve: { alias: [{ find: /^@engine\//, replacement: join(root, "engine") + "/" }, { find: /^@base\//, replacement: join(root, "base/src") + "/" }, { find: /^@artkit\//, replacement: join(root, "artkit") + "/" }] },
  define: { __GAME__: JSON.stringify(game) },
  server: { port, strictPort: false, fs: { allow: [root] }, hmr: false },
  optimizeDeps: { noDiscovery: true },
});
await server.listen();
const url = `http://localhost:${server.config.server.port}/artkit/bake/index.html?game=${game}`;
const browser = await chromium.launch();
let written = 0, files = 0;

async function openPage() {
  const page = await browser.newPage();
  page.on("pageerror", (e) => { console.error("page error:", e.stack || String(e)); process.exitCode = 1; });
  page.on("console", (m) => { if (m.type() === "error") console.error("page:", m.text()); });
  await page.exposeFunction("__save", (path, b64) => {
    const f = join(gameDir, path);
    if (!f.startsWith(gameDir)) throw new Error("bad path " + path);
    mkdirSync(dirname(f), { recursive: true });
    const buf = Buffer.from(b64, "base64");
    writeFileSync(f, buf);
    written += buf.length; files++;
  });
  await page.exposeFunction("__log", (msg) => console.log(msg));
  await page.goto(url);
  await page.evaluate(() => window.bakeReady);
  return page;
}
const run = (page, task, args = {}) => page.evaluate(([t, a]) => {
  const f = window.bake[t];
  if (!f) throw new Error("this game has no art for: " + t);
  return f(a);
}, [task, args]);
const chunk = (arr, n) => Array.from({ length: n }, (_, i) => arr.filter((_, j) => j % n === i)).filter((c) => c.length);

const t0 = Date.now();
try {
  const page = await openPage();
  const allKinds = await page.evaluate(() => window.bakeReady);
  for (const k of kinds ?? []) if (!allKinds.includes(k)) throw new Error(`${game} has no unit "${k}"`);
  const want = kinds ?? allKinds;

  if (flag("check")) {
    // nothing to bake
  } else if (flag("preview")) {
    if (!list("only") || list("only").includes("units")) {
      const pages = [page, ...(await Promise.all(chunk(want, jobs).slice(1).map(() => openPage())))];
      await Promise.all(chunk(want, pages.length).map((ks, i) => run(pages[i], "preview", { kinds: ks, tiers, roster: false })));
      for (const p of pages.slice(1)) await p.close();
    }
    if (!kinds && !list("only")) await run(page, "preview", { sheets: false, roster: true });
    for (const fam of FAMILIES.slice(2)) if (list("only")?.includes(fam) || (!kinds && !list("only"))) await run(page, fam, { preview: true, acts }).catch((e) => console.log(`(no ${fam} preview: ${String(e.message).split("\n")[0]})`));
  } else {
    if (only.includes("units")) {
      // biggest first across the pages, so they finish together
      const pages = [page, ...(await Promise.all(Array.from({ length: Math.min(jobs, want.length) - 1 }, () => openPage())))];
      const parts = await Promise.all(chunk(want, pages.length).map((ks, i) => run(pages[i], "units", { kinds: ks, tiers })));
      for (const p of pages.slice(1)) await p.close();
      const mf = join(gameDir, "public/atlas/manifest.json");
      const head = await run(page, "atlasHead");
      const old = existsSync(mf) ? JSON.parse(readFileSync(mf, "utf8")) : { units: {}, sheets: {} };
      const man = { ...head, units: {}, sheets: {} };
      // keep the engine's kind order, merging what was baked this time over what was there
      const fresh = { units: Object.assign({}, ...parts.map((p) => p.units)), sheets: Object.assign({}, ...parts.map((p) => p.sheets)) };
      for (const k of allKinds) {
        const u = fresh.units[k] ?? old.units[k];
        if (!u) continue;
        man.units[k] = u;
        for (const t of u.tiers) { const s = fresh.sheets[`${k}_t${t}`] ?? old.sheets[`${k}_t${t}`]; if (s) man.sheets[`${k}_t${t}`] = s; }
        // a kind only counts tiers that have a sheet (the runtime falls back to the highest tier at or below)
        man.units[k] = { ...u, tiers: u.tiers.filter((t) => man.sheets[`${k}_t${t}`]) };
      }
      mkdirSync(dirname(mf), { recursive: true });
      writeFileSync(mf, JSON.stringify(man));
      // drop sheets no longer in the manifest
      const keep = new Set(["manifest.json", ...Object.keys(man.sheets).map((k) => `${k}.webp`)]);
      for (const f of readdirSync(dirname(mf))) if (!keep.has(f)) rmSync(join(dirname(mf), f));
    }
    for (const fam of FAMILIES.slice(1)) {
      if (!only.includes(fam)) continue;
      const s = Date.now();
      const res = await run(page, fam, { kinds, acts });
      if (fam === "arenas") {
        // merge the acts baked this time into the manifest
        const mf = join(gameDir, "public/arenas/manifest.json");
        const old = existsSync(mf) ? JSON.parse(readFileSync(mf, "utf8")) : { acts: {} };
        const all = { ...old.acts, ...res.acts };
        writeFileSync(mf, JSON.stringify({ ...res.head, acts: Object.fromEntries(Object.keys(all).sort((a, b) => a - b).map((k) => [k, all[k]])) }));
      }
      console.log(`${fam}: ${((Date.now() - s) / 1000).toFixed(1)} s`);
    }
  }
  if (flag("check") || (!flag("preview") && !list("only") && !kinds)) {
    // is the game's art complete, and does it keep the loaders' contract? (artkit/check.ts)
    const { checkGameArt } = await server.ssrLoadModule("/artkit/check.ts");
    const rep = checkGameArt(root, game);
    for (const e of rep.errors) console.log(`  error: ${e}`);
    for (const m of rep.missing.slice(0, 40)) console.log(`  missing: ${m}`);
    if (rep.missing.length > 40) console.log(`  ... and ${rep.missing.length - 40} more`);
    console.log(`${game}: art check: ${rep.errors.length} errors, ${rep.missing.length} missing` + (rep.errors.length + rep.missing.length ? "" : " (complete)"));
    if (rep.errors.length) process.exitCode = 1;
  }
  const size = (d) => existsSync(d) ? readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? size(join(d, e.name)) : statSync(join(d, e.name)).size), 0) : 0;
  console.log(`${game}: ${files} files, ${(written / 1e6).toFixed(1)} MB written in ${((Date.now() - t0) / 1000).toFixed(1)} s` + (flag("preview") ? "" : `; public/ is ${(size(join(gameDir, "public")) / 1e6).toFixed(1)} MB`));
} catch (e) {
  console.error(String(e?.message ?? e));
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
