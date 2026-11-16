// Prepares the edit's inputs: `npx vite-node video/cuts.mjs` (vite-node so it can read the edit in src/timeline.ts)
//   src/clips.json        which captures exist (public/clips/<game>/<clip>.mp4 + .json), so missing ones get a slate
//   audio/cuts.json       which arrangement of the theme plays from which bar, for tools/music/mix.py
//   public/vo, fonts      the voice-over lines and the display font, where Remotion can load them
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const clipsDir = join(here, "public/clips");
const out = {};
if (existsSync(clipsDir)) for (const g of readdirSync(clipsDir)) {
  if (g.startsWith(".")) continue;
  for (const f of readdirSync(join(clipsDir, g)).filter((n) => n.endsWith(".json"))) {
    const meta = JSON.parse(readFileSync(join(clipsDir, g, f), "utf8")), name = f.replace(/\.json$/, "");
    if (existsSync(join(clipsDir, g, `${name}.mp4`))) (out[g] ??= {})[name] = { seconds: meta.seconds, sfx: existsSync(join(clipsDir, g, `${name}.wav`)) };
  }
}
writeFileSync(join(here, "src/clips.json"), JSON.stringify(out, null, 2) + "\n");
mkdirSync(join(here, "public/vo"), { recursive: true });
mkdirSync(join(here, "public/fonts"), { recursive: true });
for (const f of readdirSync(join(here, "vo")).filter((n) => n.endsWith(".wav"))) cpSync(join(here, "vo", f), join(here, "public/vo", f));
cpSync(join(here, "../base/public/fonts/LilitaOne-Regular.ttf"), join(here, "public/fonts/LilitaOne-Regular.ttf"));
// the soundtrack follows the picture: one arrangement per stretch of bars (0-based for mix.py)
const { musicCuts } = await import("./src/timeline.ts");
writeFileSync(join(here, "audio/cuts.json"), JSON.stringify(musicCuts().map(([bar, style]) => [bar - 1, style])) + "\n");
console.log("clips:", Object.entries(out).map(([g, c]) => `${g}(${Object.keys(c).join(",")})`).join(" ") || "none yet");
