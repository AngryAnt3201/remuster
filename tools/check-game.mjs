// Is a game finished? `npm run check -- <game> [--fast] [--shots]`
// Runs every check REMIX.md asks for and prints one line each:
//   engine    engine/ is byte-for-byte the locked release (a game never edits it)
//   manifest  games/<id>/game.json is filled in
//   words     the lexicon renames the engine's vocabulary (units, abilities, acts, modes, currencies)
//   skin      theme.css restyles the UI (not the scaffold copy)
//   sounds    sounds.ts re-voices the effects
//   terrain   the game draws its own Arena buildings
//   music     every cue in music.ts has its file
//   art       the baked art is complete and loads (artkit/check.ts)
//   types     tsc passes
//   build     the game builds (skipped with --fast)
//   plays     the built game boots, shows its home, Army and Arena screens and plays a battle and an Arena battle to
//             the end with no errors; screenshots land in games/<id>/art/preview/screens (skipped with --fast)
// Exit code 1 if anything fails. `--shots` only takes the screenshots (against a dev server it starts itself).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineDiff } from "./engine-lock.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const game = args.find((a) => !a.startsWith("--"));
const fast = args.includes("--fast"), shotsOnly = args.includes("--shots");
const dir = join(root, "games", game ?? "");
if (!game || !existsSync(join(dir, "game.json"))) { console.error("usage: npm run check -- <game> [--fast] [--shots]   (an existing games/<game>)"); process.exit(1); }

const results = [];
const report = (name, ok, note = "") => { results.push(ok); console.log(`${ok === null ? "  skip" : ok ? "  ok  " : "  FAIL"}  ${name.padEnd(9)} ${note}`); };
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const same = (a, b) => read(a).replace(/\s+/g, "") === read(b).replace(/\s+/g, "");
const run = (cmd, argv, env = {}) => spawnSync(cmd, argv, { cwd: root, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 64 << 20 });
const g = (f) => join(dir, "src/game", f), b = (f) => join(root, "base/src/game", f);

console.log(`\n${game}\n`);
if (!shotsOnly) {
  // ---- engine
  const d = engineDiff();
  const touched = d ? [...d.changed, ...d.added, ...d.removed] : [];
  report("engine", !!d && !touched.length, !d ? "no engine/ENGINE.lock.json" : touched.length ? `changed: ${touched.slice(0, 6).join(", ")}${touched.length > 6 ? "..." : ""}  (a game never edits engine/: git checkout -- engine)` : `untouched (release ${d.version})`);

  // ---- manifest
  let mf = {};
  try { mf = JSON.parse(read(join(dir, "game.json"))); } catch { /* reported below */ }
  const mfBad = [mf.id !== game && "id must equal the folder name", !mf.name && "name", !mf.tagline && "tagline", !/^#[0-9a-f]{6}$/i.test(mf.themeColor ?? "") && "themeColor (#rrggbb)"].filter(Boolean);
  report("manifest", !mfBad.length, mfBad.length ? `missing: ${mfBad.join(", ")}` : `"${mf.name}": ${mf.tagline}`);

  // ---- words: run the text dump and count what the lexicon covers
  const td = run("npx", ["vite-node", "tools/text-dump.ts", game]);
  let words = { ok: false, note: "text dump failed: " + (td.stderr || td.stdout).split("\n")[0] };
  try {
    const todo = JSON.parse(read(join(dir, "lexicon.todo.json")));
    const cover = (sec) => { const e = Object.entries(todo[sec] ?? {}); return e.length ? e.filter(([k, v]) => v !== "" && v !== k).length / e.length : 1; }; // a phrase mapped to itself is not renamed
    const need = [["units", 1], ["abilities", 0.9], ["acts", 1], ["ui", 0.5], ["levels", 0.5]];
    const short = need.filter(([s, min]) => cover(s) < min).map(([s, min]) => `${s} ${Math.round(cover(s) * 100)}% (need ${Math.round(min * 100)}%)`);
    const all = Object.values(todo).flatMap((s) => Object.values(s));
    words = { ok: !short.length, note: short.length ? `not renamed yet: ${short.join(", ")}  (see games/${game}/lexicon.todo.json)` : `${all.filter((v) => v !== "").length} of ${all.length} engine phrases renamed` };
  } catch { /* keep the failure */ }
  report("words", words.ok, words.note);

  // ---- skin, sounds, terrain
  const css = read(g("theme.css")).replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = (css.match(/\{/g) ?? []).length;
  report("skin", rules >= 40, rules >= 40 ? `${rules} rules` : `${rules} rules in theme.css: a re-skin restyles panels, buttons, cards, bars, tabs, sheets and type (see REMIX.md "Interface")`);
  report("sounds", existsSync(g("sounds.ts")) && !same(g("sounds.ts"), b("sounds.ts")), existsSync(g("sounds.ts")) && !same(g("sounds.ts"), b("sounds.ts")) ? "re-voiced" : "sounds.ts is still the base game's");
  report("terrain", existsSync(g("terrain.ts")) && !same(g("terrain.ts"), b("terrain.ts")), existsSync(g("terrain.ts")) && !same(g("terrain.ts"), b("terrain.ts")) ? "own Arena buildings" : "terrain.ts is missing or still the base game's (Arena walls and houses)");

  // ---- music
  const cues = [...read(g("music.ts")).matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1]);
  const lost = cues.filter((f) => !existsSync(join(dir, "public/music", f)));
  report("music", cues.length >= 3 && !lost.length && existsSync(g("music.ts")) && !same(g("music.ts"), b("music.ts")), !cues.length || same(g("music.ts"), b("music.ts")) ? `no soundtrack of its own: npm run music -- ${game}` : lost.length ? `missing files: ${lost.join(", ")}` : `${cues.length} cues`);

  // ---- art
  const art = run("node", ["tools/bake.mjs", game, "--check"]);
  const artLine = (art.stdout.match(/art check: .*/) ?? [""])[0];
  report("art", art.status === 0 && /\(complete\)/.test(artLine), artLine || (art.stderr || art.stdout).trim().split("\n").slice(-3).join(" | "));
  if (art.status !== 0 || !/\(complete\)/.test(artLine)) console.log(art.stdout.split("\n").filter((l) => /missing|error/i.test(l)).slice(0, 20).map((l) => "            " + l).join("\n"));

  // ---- types
  const tsc = run("npx", ["tsc", "--noEmit"]);
  report("types", tsc.status === 0, tsc.status === 0 ? "" : tsc.stdout.split("\n").slice(0, 5).join(" | "));
}

// ---- build and play
if (fast && !shotsOnly) { report("build", null, "--fast"); report("plays", null, "--fast"); }
else {
  let ok = true;
  if (!shotsOnly) {
    const build = run("npx", ["vite", "build"], { GAME: game });
    ok = build.status === 0;
    const out = join(root, "dist-games", game);
    const size = ok ? Math.round(du(out) / 1e6) : 0;
    report("build", ok, ok ? `dist-games/${game} (${size} MB)` : (build.stderr || build.stdout).trim().split("\n").slice(-4).join(" | "));
  }
  if (ok) report("plays", ...(await play()));
}

const failed = results.filter((r) => r === false).length;
console.log(failed ? `\n${failed} check${failed > 1 ? "s" : ""} failed.\n` : `\nAll checks passed. Now look at games/${game}/art/preview/screens next to the base game.\n`);
process.exit(failed ? 1 : 0);

function du(p) { return statSync(p).isDirectory() ? readdirSync(p).reduce((n, f) => n + du(join(p, f)), 0) : statSync(p).size; }

/** Boots the game in a phone-size browser and walks it: home, Army, Arena ladder, a full battle, a full Arena battle. */
async function play() {
  const { chromium, devices } = await import("playwright");
  const port = 5340 + Math.floor(Math.random() * 40);
  const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, env: { ...process.env, GAME: game }, stdio: "ignore" });
  const shots = join(dir, "art/preview/screens");
  mkdirSync(shots, { recursive: true });
  const errors = [];
  let browser;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
    browser = await chromium.launch();
    const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const visit = async (name, path, wait, until) => {
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
      page.on("console", (m) => { if (m.type() === "error" && !/vibrate|favicon/.test(m.text())) errors.push(`${name}: ${m.text()}`); });
      page.on("response", (r) => { if (r.status() === 404 && !/favicon/.test(r.url())) errors.push(`${name}: 404 ${new URL(r.url()).pathname}`); });
      await page.goto(`http://127.0.0.1:${port}${path}`);
      await page.waitForTimeout(wait);
      await page.screenshot({ path: join(shots, `${name}.png`) });
      if (until) {
        const done = await page.waitForFunction(until, null, { timeout: 90000 }).then(() => true, () => false);
        if (!done) errors.push(`${name}: the battle did not finish within 90 s`);
        await page.screenshot({ path: join(shots, `${name}-end.png`) });
      }
      await page.close();
    };
    const ended = "window.__film && window.__film.marks.some((m) => m.name === 'end')";
    await visit("home", "/", 3500);
    await visit("army", "/?tab=army", 2500);
    await visit("modes", "/?tab=modes", 2500);
    await visit("shop", "/?tab=shop", 2500);
    await visit("map", "/?campaign", 3000);
    await visit("ladder", "/?arena", 2500);
    await visit("deploy", "/?level=3", 3500);
    await visit("battle", "/?film=clash&speed=3", 5000, ended);
    await visit("arena", "/?film=arena&speed=3", 5000, ended);
  } catch (e) { errors.push(String(e)); }
  finally { await browser?.close(); server.kill(); }
  const uniq = [...new Set(errors)];
  return [!uniq.length, uniq.length ? uniq.slice(0, 8).join("\n            ") : `9 screens in games/${game}/art/preview/screens`];
}
