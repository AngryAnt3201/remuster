// Start a new game: `npm run new -- <id> ["Display Name"]`
// Creates games/<id>/ as an overlay on the base game (see REMIX.md): a game.json and copies of the five files a
// re-theme always touches (its words, skin, sounds, soundtrack table and Arena buildings), ready to edit. Everything else falls
// through to the base game until the new game shadows it.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , id, name] = process.argv;
if (!id || !/^[a-z][a-z0-9-]{1,30}$/.test(id) || id === "base") {
  console.error('usage: npm run new -- <id> ["Display Name"]   (id: lower-case letters, digits, dashes; not "base")');
  process.exit(1);
}
const dir = join(root, "games", id);
if (existsSync(dir)) { console.error(`games/${id} already exists`); process.exit(1); }
const display = name || id.replace(/(^|-)([a-z])/g, (_, a, b) => (a ? " " : "") + b.toUpperCase());

mkdirSync(join(dir, "src/game"), { recursive: true });
mkdirSync(join(dir, "public"), { recursive: true });
writeFileSync(join(dir, "game.json"), JSON.stringify({ id, name: display, tagline: "", themeColor: "#0b0f17" }, null, 2) + "\n");
for (const f of ["lexicon.ts", "theme.css", "sounds.ts", "music.ts", "terrain.ts"]) cpSync(join(root, "base/src/game", f), join(dir, "src/game", f));
writeFileSync(join(dir, "public/.gitkeep"), "");

console.log(`Created games/${id} ("${display}").

  GAME=${id} npm run dev        play it (it is the base game until you change something)
  npm run text -- ${id}         list every name the engine ships, for games/${id}/src/game/lexicon.ts
  npm run check -- ${id}        is it complete, and is the engine untouched?

Next: read REMIX.md, or in Claude Code run  /remix ${id} <your theme>`);
