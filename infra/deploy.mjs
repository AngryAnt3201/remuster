// The one step that stands up the backend: `npm run infra:deploy`
// Needs a Cloudflare account signed in (`npx wrangler login`, once). Safe to run again: it creates only what is
// missing, applies only new migrations, keeps existing secrets, and redeploys the Worker.
//   1. D1 database "remuster" and R2 bucket "remuster-games" (created if missing)
//   2. infra/wrangler.toml written from the template with the database id
//   3. migrations applied
//   4. TOKEN_SECRET and ADMIN_TOKEN generated and stored as Worker secrets (first run only; the admin token is
//      also saved to infra/.secrets.local, which is git-ignored)
//   5. the Worker deployed, health-checked, and its URL written to .env.production as VITE_REMUSTER_API so every
//      game build from then on talks to it
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, "..");
const DB = "remuster", BUCKET = "remuster-games";
const dry = process.argv.includes("--dry-run");

function wr(args, opts = {}) {
  const r = spawnSync("npx", ["--yes", "wrangler@4", ...args], { cwd: here, encoding: "utf8", input: opts.input, stdio: opts.input ? ["pipe", "pipe", "pipe"] : ["inherit", "pipe", "pipe"] });
  if (r.status !== 0 && !opts.allowFail) { console.error(r.stdout, r.stderr); console.error(`\nwrangler ${args.join(" ")} failed.`); process.exit(1); }
  return { ok: r.status === 0, out: (r.stdout ?? "") + (r.stderr ?? "") };
}
const step = (s) => console.log(`\n== ${s}`);

step("Cloudflare account");
const who = wr(["whoami"], { allowFail: true });
if (!who.ok || /not authenticated|You are not logged in/i.test(who.out)) {
  console.error("Not signed in to Cloudflare. Run this once, then run the deploy again:\n\n  npx wrangler login\n");
  process.exit(1);
}
console.log(who.out.split("\n").filter((l) => /email|Account Name|account/i.test(l)).slice(0, 4).join("\n") || "signed in");
if (dry) { console.log("\n--dry-run: stopping before anything is created."); process.exit(0); }

step(`D1 database "${DB}"`);
let list = JSON.parse(wr(["d1", "list", "--json"]).out.replace(/^[^[]*/s, "") || "[]");
let db = list.find((d) => d.name === DB);
if (!db) {
  wr(["d1", "create", DB]);
  list = JSON.parse(wr(["d1", "list", "--json"]).out.replace(/^[^[]*/s, "") || "[]");
  db = list.find((d) => d.name === DB);
  if (!db) { console.error("created the database but could not find it afterwards"); process.exit(1); }
  console.log("created");
} else console.log("exists");
const id = db.uuid ?? db.database_id;

step(`R2 bucket "${BUCKET}"`);
const buckets = wr(["r2", "bucket", "list"], { allowFail: true }).out;
if (!buckets.includes(BUCKET)) { wr(["r2", "bucket", "create", BUCKET]); console.log("created"); } else console.log("exists");

step("wrangler.toml");
const keep = existsSync(join(here, "wrangler.toml")) ? readFileSync(join(here, "wrangler.toml"), "utf8") : "";
const origin = keep.match(/^GAMES_ORIGIN = "(.*)"$/m)?.[1] ?? "", allow = keep.match(/^ALLOW_ORIGINS = "(.*)"$/m)?.[1] ?? "*";
writeFileSync(join(here, "wrangler.toml"), readFileSync(join(here, "wrangler.template.toml"), "utf8")
  .replace("__D1_ID__", id).replace('GAMES_ORIGIN = ""', `GAMES_ORIGIN = "${origin}"`).replace('ALLOW_ORIGINS = "*"', `ALLOW_ORIGINS = "${allow}"`));
console.log(`database_id ${id}`);

step("Migrations");
console.log(wr(["d1", "migrations", "apply", DB, "--remote"], { input: "y\n" }).out.split("\n").filter((l) => /✅|applied|No migrations|migrat/i.test(l)).join("\n"));

step("Deploy");
const dep = wr(["deploy"]).out;
const url = dep.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0];
console.log(url ?? dep);

step("Secrets");
const have = wr(["secret", "list"], { allowFail: true }).out;
const secretsFile = join(here, ".secrets.local");
if (!have.includes("TOKEN_SECRET")) { wr(["secret", "put", "TOKEN_SECRET"], { input: randomBytes(32).toString("base64url") + "\n" }); console.log("TOKEN_SECRET set"); } else console.log("TOKEN_SECRET kept");
if (!have.includes("ADMIN_TOKEN")) {
  const admin = randomBytes(24).toString("base64url");
  wr(["secret", "put", "ADMIN_TOKEN"], { input: admin + "\n" });
  writeFileSync(secretsFile, `ADMIN_TOKEN=${admin}\n`, { mode: 0o600 });
  console.log(`ADMIN_TOKEN set (saved to ${secretsFile})`);
} else console.log("ADMIN_TOKEN kept");

if (url) {
  step("Health check");
  let ok = false;
  for (let i = 0; i < 6 && !ok; i++) {
    try { ok = (await (await fetch(`${url}/v1/health`)).json()).ok === true; } catch { /* still propagating */ }
    if (!ok) await new Promise((r) => setTimeout(r, 2500));
  }
  console.log(ok ? "healthy" : "not answering yet (new workers.dev hostnames can take a minute); try: curl " + url + "/v1/health");
  const envFile = join(root, ".env.production");
  const rest = existsSync(envFile) ? readFileSync(envFile, "utf8").split("\n").filter((l) => l && !l.startsWith("VITE_REMUSTER_API=")) : [];
  writeFileSync(envFile, [...rest, `VITE_REMUSTER_API=${url}`].join("\n") + "\n");
  console.log(`\nDone. Backend: ${url}\nWritten to .env.production; every \`npm run build\` and \`npm run publish\` now uses it.`);
}
