// Content counts (units, levels, acts, puzzles...) read from base/src/core through vite-node, so store copy,
// the website and screenshot captions quote what the game actually ships. See tools/content-counts.ts.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

export function contentCounts() {
  const out = execFileSync(join(root, "node_modules/.bin/vite-node"), ["tools/content-counts.ts"], { cwd: root, encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop());
}

/** Replaces {{key}} with counts[key]; unknown placeholders are left as is so the caller can flag them. */
export const fillCounts = (s, counts) => (s ?? "").replace(/\{\{(\w+)\}\}/g, (m, k) => (k in counts ? String(counts[k]) : m));
