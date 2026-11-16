// Every name and line of text the engine ships, for a game's lexicon: `npm run text -- <game>`
// Writes games/<game>/lexicon.todo.json: { "<section>": { "<base text>": "<what this game says now, or empty>" } }.
// Fill in what the game should say and move the pairs into games/<game>/src/game/lexicon.ts. Text the game already
// renames is shown with its current value, so the file doubles as a "what is left" list.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ABILITIES, BODY_EXTRA, UNITS } from "../engine/core/defs";
import { ACTS, LEVELS } from "../engine/core/campaign";
import { PUZZLES } from "../engine/core/puzzles";

const game = process.argv[2];
const root = resolve(__dirname, "..");
if (!game || !existsSync(join(root, "games", game))) { console.error("usage: npm run text -- <game>   (an existing games/<game>)"); process.exit(1); }

/** Strings under these keys, anywhere inside a module's exports, are player-facing. */
const KEYS = new Set(["name", "short", "text", "line", "foe", "title", "desc", "label", "blurb", "hint"]);
function harvest(v: unknown, out: Set<string>, seen = new Set<unknown>(), depth = 0) {
  if (!v || typeof v !== "object" || seen.has(v) || depth > 8) return;
  seen.add(v);
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (typeof x === "string") { if (KEYS.has(k) && /[A-Za-z]{2}/.test(x) && x.length < 160) out.add(x); }
    else harvest(x, out, seen, depth + 1);
  }
}

const sections: Record<string, Set<string>> = {};
const add = (name: string, ...xs: string[]) => { const s = (sections[name] ??= new Set()); for (const x of xs) if (x) s.add(x); };

for (const u of Object.values(UNITS)) { add("units", u.name); add("unit lines", u.short); }
for (const b of Object.values(BODY_EXTRA)) add("units", b.name);
for (const a of Object.values(ABILITIES)) { add("abilities", a.name); add("ability lines", a.text); }
add("acts", ...ACTS);
for (const l of LEVELS) { add("levels", l.name); add("rivals", l.foe ?? ""); add("level lines", l.line ?? ""); }
for (const p of PUZZLES) harvest(p, (sections["puzzles"] ??= new Set()));

// Everything else the engine names (chests, boons, daily twists, quests, cosmetics, pass, maps, arenas...):
const modules = import.meta.glob(["../engine/core/*.ts", "../engine/core/td/*.ts", "../engine/progression/*.ts", "../engine/economy/*.ts", "../engine/store/*.ts"]);
for (const [path, load] of Object.entries(modules)) {
  const id = path.replace("../engine/", "").replace(/\.ts$/, "");
  if (/core\/(defs|campaign|puzzles|battle|ai|match|rng)$/.test(id) || /store\/(native|index)$/.test(id)) continue;
  try { const m = await load(); const out = new Set<string>(); harvest(m, out); if (out.size) sections[id] = out; } catch { /* a module that needs the browser */ }
}

// Words the base UI itself uses (not engine data).
add("ui", "Battle", "Army", "Shop", "Modes", "Pass", "War Pass", "Campaign", "Daily", "Gauntlet", "Breakpoint", "Skirmish", "Bastion", "Arena",
  "Coins", "Gems", "coins", "gems", "Chest", "chest", "Chests", "Keep", "keep", "Commander", "Fight", "Victory", "Defeat", "Round", "Reroll",
  "Level", "Act", "Boss", "Stars", "Trophies", "League", "Settings", "Sound", "Music", "Haptics", "Upgrade", "Sell", "Ascended", "Cards", "Quests");

let current: Record<string, string> = {};
const lex = join(root, "games", game, "src/game/lexicon.ts");
if (existsSync(lex)) {
  // read the pairs straight out of the source (the file is plain data)
  for (const m of readFileSync(lex, "utf8").matchAll(/^\s*(?:"((?:[^"\\]|\\.)+)"|([A-Za-z_][\w]*))\s*:\s*"((?:[^"\\]|\\.)*)"/gm)) current[(m[1] ?? m[2]).replace(/\\"/g, '"')] = m[3].replace(/\\"/g, '"');
}
const out: Record<string, Record<string, string>> = {};
let total = 0, left = 0;
for (const [name, set] of Object.entries(sections)) {
  out[name] = {};
  for (const s of [...set].sort()) { out[name][s] = current[s] ?? ""; total++; if (!(s in current)) left++; }
}
const file = join(root, "games", game, "lexicon.todo.json");
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`${file}\n${total} pieces of text in ${Object.keys(out).length} sections; ${total - left} already renamed, ${left} still the base game's words.`);
