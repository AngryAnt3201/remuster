// The bindings the Worker runs with. Typed by hand (the subset we use) so the same code runs on Cloudflare
// (D1, R2) and locally on Node's built-in SQLite and an in-memory bucket (infra/local), with no cloud account.
export interface D1Result<T = unknown> { results: T[]; meta: { changes: number; last_row_id: number } }
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1 {
  prepare(sql: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<D1Result[]>;
  exec(sql: string): Promise<unknown>;
}
export interface R2Object { size: number; httpMetadata?: { contentType?: string }; arrayBuffer(): Promise<ArrayBuffer>; body?: unknown }
export interface R2 {
  put(key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(opts: { prefix: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string; size: number }[]; truncated: boolean; cursor?: string }>;
}
export interface Env {
  DB: D1;
  GAMES: R2;
  /** Signs player tokens. Set once by `npm run infra:deploy` (wrangler secret). */
  TOKEN_SECRET: string;
  /** Lets the operator hide a published game: `Authorization: Bearer <ADMIN_TOKEN>` on /v1/admin/*. */
  ADMIN_TOKEN?: string;
  /** Comma-separated origins allowed to call the API with credentials-free CORS ("*" by default). */
  ALLOW_ORIGINS?: string;
  /** Where published games are served from when that is a different host from the API (recommended in
   *  production, so a player-made page never shares an origin with the API). Empty = same host, /g/<id>/. */
  GAMES_ORIGIN?: string;
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}
export const bad = (code: string, message?: string) => new HttpError(400, code, message);
export const now = () => Date.now();
