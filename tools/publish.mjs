// Put a game in the gallery: `npm run publish -- <game>`
// Builds games/<game> against the backend in .env.production (VITE_REMUSTER_API, written by `npm run infra:deploy`;
// or REMUSTER_API=http://localhost:8787 for the local backend), then uploads the build and makes it live at
// <backend>/g/<game>/. The first publish from a machine creates a creator account and remembers it in
// ~/.remuster/credentials.json; the game id then belongs to that account.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { engineDiff } from "./engine-lock.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const game = process.argv[2];
const dir = game === "base" ? join(root, "base") : join(root, "games", game ?? "");
if (!game || !existsSync(join(dir, "game.json"))) { console.error("usage: npm run publish -- <game>"); process.exit(1); }
const meta = JSON.parse(readFileSync(join(dir, "game.json"), "utf8"));

const envFile = join(root, ".env.production");
const api = (process.env.REMUSTER_API ?? (existsSync(envFile) ? readFileSync(envFile, "utf8").match(/^VITE_REMUSTER_API=(.+)$/m)?.[1] : "") ?? "").trim().replace(/\/+$/, "");
if (!api) { console.error("No backend yet. Deploy it (npm run infra:deploy) or point at one: REMUSTER_API=http://localhost:8787 npm run publish -- " + game); process.exit(1); }

const diff = engineDiff();
if (diff && diff.added.length + diff.removed.length + diff.changed.length) { console.error("engine/ was modified: a game with a changed engine can't be published (npm run engine:check)."); process.exit(1); }

console.log(`Building ${meta.name} (${game}) for ${api}`);
const b = spawnSync("npx", ["vite", "build"], { cwd: root, stdio: "inherit", env: { ...process.env, GAME: game, VITE_REMUSTER_API: api } });
if (b.status !== 0) process.exit(b.status ?? 1);
const out = game === "base" ? join(root, "dist") : join(root, "dist-games", game);

const credFile = join(homedir(), ".remuster", "credentials.json");
const creds = existsSync(credFile) ? JSON.parse(readFileSync(credFile, "utf8")) : {};
async function req(method, path, { body, raw, token } = {}) {
  const r = await fetch(api + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: raw ?? (body ? JSON.stringify(body) : undefined) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${data.error ?? ""} ${data.message ?? ""}`);
  return data;
}
if (!creds[api]) {
  const p = await req("POST", "/v1/players", { body: { name: process.env.REMUSTER_NAME } });
  creds[api] = { id: p.id, name: p.name, token: p.token };
  mkdirSync(dirname(credFile), { recursive: true });
  writeFileSync(credFile, JSON.stringify(creds, null, 2) + "\n", { mode: 0o600 });
  console.log(`Created creator account "${p.name}" (saved to ${credFile})`);
}
const token = creds[api].token;

const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (!n.startsWith(".")) files.push(p); } })(out);
const total = files.reduce((s, f) => s + statSync(f).size, 0);
console.log(`Uploading ${files.length} files, ${(total / 1e6).toFixed(1)} MB`);

await req("POST", "/v1/games", { token, body: { id: meta.id, name: meta.name, tagline: meta.tagline ?? "", themeColor: meta.themeColor, engine: diff?.version ?? 0 } });
let done = 0;
const queue = [...files];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let f = queue.shift(); f; f = queue.shift()) {
    const rel = relative(out, f).split("\\").join("/");
    for (let attempt = 1; ; attempt++) {
      try { await req("PUT", `/v1/games/${meta.id}/files/${rel.split("/").map(encodeURIComponent).join("/")}`, { token, raw: readFileSync(f) }); break; }
      catch (e) { if (attempt >= 3) throw e; await new Promise((r) => setTimeout(r, 500 * attempt)); }
    }
    if (++done % 25 === 0 || done === files.length) process.stdout.write(`\r  ${done}/${files.length}`);
  }
}));
const live = await req("POST", `/v1/games/${meta.id}/publish`, { token });
console.log(`\nLive: ${live.url}   (version ${live.version})`);
