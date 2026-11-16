// The whole backend on this machine: `npm run infra:dev` (http://localhost:8787), state in infra/.local/.
// Same Worker code as production, on Node's SQLite and a folder instead of D1 and R2.
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { handle } from "../src/worker";
import type { Env } from "../src/env";
import { localD1, migrate } from "./d1";
import { localR2 } from "./r2";

const state = join(__dirname, "..", ".local");
mkdirSync(state, { recursive: true });
const DB = localD1(join(state, "remuster.sqlite"));
await migrate(DB);
const env: Env = { DB, GAMES: localR2(join(state, "games")), TOKEN_SECRET: process.env.TOKEN_SECRET ?? "local-dev-secret", ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? "local-admin" };
const port = Number(process.env.API_PORT ?? 8787);

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks);
  const request = new Request(`http://${req.headers.host ?? `localhost:${port}`}${req.url}`, {
    method: req.method, headers: req.headers as Record<string, string>,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  const r = await handle(request, env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`Remuster backend (local): http://localhost:${port}   state: ${state}`));
