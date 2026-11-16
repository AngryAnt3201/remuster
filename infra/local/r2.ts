// Cloudflare R2's API in memory, or on a folder when given one (the local server keeps published games on disk).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { R2 } from "../src/env";

export function localR2(dir?: string): R2 {
  const mem = new Map<string, { data: Uint8Array; type?: string }>();
  const file = (k: string) => join(dir!, k);
  const walk = (d: string, out: string[] = []): string[] => {
    if (!existsSync(d)) return out;
    for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (!n.endsWith(".type")) out.push(p); }
    return out;
  };
  return {
    async put(key, value, opts) {
      const data = value instanceof Uint8Array ? value : new Uint8Array(value);
      const type = opts?.httpMetadata?.contentType;
      if (!dir) { mem.set(key, { data: data.slice(), type }); return; }
      mkdirSync(dirname(file(key)), { recursive: true });
      writeFileSync(file(key), data);
      if (type) writeFileSync(file(key) + ".type", type);
    },
    async get(key) {
      let data: Uint8Array, type: string | undefined;
      if (!dir) { const o = mem.get(key); if (!o) return null; data = o.data; type = o.type; }
      else { if (!existsSync(file(key))) return null; data = readFileSync(file(key)); type = existsSync(file(key) + ".type") ? readFileSync(file(key) + ".type", "utf8") : undefined; }
      return { size: data.byteLength, httpMetadata: { contentType: type }, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer };
    },
    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) {
        if (!dir) mem.delete(k);
        else { rmSync(file(k), { force: true }); rmSync(file(k) + ".type", { force: true }); }
      }
    },
    async list({ prefix }) {
      const keys = dir ? walk(dir).map((p) => p.slice(dir.length + 1).split("\\").join("/")) : [...mem.keys()];
      return { objects: keys.filter((k) => k.startsWith(prefix)).sort().map((k) => ({ key: k, size: dir ? statSync(file(k)).size : mem.get(k)!.data.byteLength })), truncated: false };
    },
  };
}
