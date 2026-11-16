// The engine is the part of the game we own: the sim, the rules, the AI, the economy and the content. A game may
// change everything a player sees and hears, and nothing in engine/. This tool records and checks that.
//   node tools/engine-lock.mjs --check    exit 1 (and list the files) if engine/ differs from engine/ENGINE.lock.json
//   node tools/engine-lock.mjs --write    engine maintainers only: record the current engine as the released one
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "engine");
const lockFile = join(dir, "ENGINE.lock.json");

function files(d, out = []) {
  for (const n of readdirSync(d).sort()) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) files(p, out);
    else if (p !== lockFile && !n.startsWith(".")) out.push(p);
  }
  return out;
}
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

export function engineState() {
  const list = {};
  for (const f of files(dir)) list[relative(dir, f).split("\\").join("/")] = sha(readFileSync(f));
  return { files: list, hash: sha(JSON.stringify(list)) };
}

/** What changed against the lock: { added, removed, changed } (all empty = untouched), or null with no lock yet. */
export function engineDiff() {
  if (!existsSync(lockFile)) return null;
  const lock = JSON.parse(readFileSync(lockFile, "utf8")), now = engineState();
  const added = Object.keys(now.files).filter((f) => !(f in lock.files));
  const removed = Object.keys(lock.files).filter((f) => !(f in now.files));
  const changed = Object.keys(now.files).filter((f) => f in lock.files && lock.files[f] !== now.files[f]);
  return { added, removed, changed, version: lock.version, hash: now.hash, locked: lock.hash };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (mode === "--write") {
    const prev = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : { version: 0 };
    const now = engineState();
    if (prev.hash === now.hash) { console.log(`engine unchanged (v${prev.version}, ${now.hash.slice(0, 12)})`); process.exit(0); }
    writeFileSync(lockFile, JSON.stringify({ version: prev.version + 1, hash: now.hash, files: now.files }, null, 2) + "\n");
    console.log(`engine locked: v${prev.version + 1}, ${Object.keys(now.files).length} files, ${now.hash.slice(0, 12)}`);
  } else {
    const d = engineDiff();
    if (!d) { console.error("no engine/ENGINE.lock.json: run `node tools/engine-lock.mjs --write` (engine maintainers)"); process.exit(1); }
    const n = d.added.length + d.removed.length + d.changed.length;
    if (!n) { console.log(`engine untouched (v${d.version}, ${d.hash.slice(0, 12)})`); process.exit(0); }
    console.error(`engine/ was modified (${n} file${n === 1 ? "" : "s"}). A game changes base/ or games/<id>/, never engine/:`);
    for (const [k, list] of [["changed", d.changed], ["added", d.added], ["removed", d.removed]]) for (const f of list) console.error(`  ${k}: engine/${f}`);
    console.error("Undo with: git checkout -- engine && git clean -fd engine");
    process.exit(1);
  }
}
