// Cloudflare D1's API on Node's built-in SQLite, for the local server and the tests: the real SQL runs, with no
// cloud account and nothing to install.
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { D1, D1Result, D1Stmt } from "../src/env";

// Loaded through require: bundlers (Vite, vitest) do not know this newer Node built-in by name.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export function localD1(file = ":memory:"): D1 & { close(): void } {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  const stmt = (sql: string, args: unknown[] = []): D1Stmt & { _run(): D1Result } => {
    const run = (): D1Result => {
      const s = db.prepare(sql);
      const a = args.map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v)) as any[];
      if (/^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql)) {
        const rows = s.all(...a).map((r: Record<string, unknown>) => ({ ...r }));
        return { results: rows, meta: { changes: 0, last_row_id: 0 } };
      }
      const r = s.run(...a);
      return { results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    };
    return {
      bind: (...values: unknown[]) => stmt(sql, values),
      first: async <T>() => (run().results[0] as T) ?? null,
      all: async <T>() => run() as D1Result<T>,
      run: async () => run(),
      _run: run,
    };
  };
  return {
    prepare: (sql) => stmt(sql),
    batch: async (stmts) => {
      db.exec("BEGIN");
      try { const out = stmts.map((s) => (s as any)._run() as D1Result); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    exec: async (sql) => { db.exec(sql); },
    close: () => db.close(),
  };
}

/** Apply every migration in infra/migrations, in order, once each. */
export async function migrate(db: D1, dir = join(__dirname, "..", "migrations")) {
  await db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, at INTEGER NOT NULL)");
  const done = new Set((await db.prepare("SELECT name FROM _migrations").all<{ name: string }>()).results.map((r) => r.name));
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    await db.exec(readFileSync(join(dir, f), "utf8"));
    await db.prepare("INSERT INTO _migrations (name, at) VALUES (?, ?)").bind(f, Date.now()).run();
  }
}
