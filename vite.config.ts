// One engine, many games. `GAME=<id>` picks which game to serve or build:
//   base (default)   the base game in base/
//   <id>             games/<id>/, an overlay on the base game: any file under games/<id>/src shadows the file at the
//                    same path under base/src, and any file under games/<id>/public shadows base/public.
// Inside an overlay, `@base/<path>` imports the base game's own file (so a shadow can wrap what it replaces), and
// `@engine/<path>` is the locked engine (engine/, see ENGINE.md).
import { defineConfig, type Plugin } from "vite";
import { cpSync, existsSync, readFileSync, statSync, createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = __dirname;
export const GAME = process.env.GAME || "base";
const baseSrc = resolve(root, "base/src");
const basePublic = resolve(root, "base/public");
const gameDir = GAME === "base" ? resolve(root, "base") : resolve(root, "games", GAME);
const gameSrc = join(gameDir, "src");
const gamePublic = join(gameDir, "public");
if (!existsSync(gameDir)) throw new Error(`GAME=${GAME}: no such game (expected ${gameDir}). Run: npm run new -- ${GAME}`);
const meta = JSON.parse(readFileSync(join(gameDir, "game.json"), "utf8")) as { id: string; name: string; themeColor?: string };

const MIME: Record<string, string> = {
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4",
  ".css": "text/css", ".js": "text/javascript", ".txt": "text/plain", ".html": "text/html", ".mp4": "video/mp4",
};

function gameOverlay(): Plugin {
  const overlay = GAME !== "base";
  return {
    name: "remuster-game-overlay",
    enforce: "pre",
    async resolveId(source, importer, opts) {
      if (source.startsWith("@base/")) {
        const r = await this.resolve(join(baseSrc, source.slice(6)), importer, { ...opts, skipSelf: true });
        return r ?? null;
      }
      if (!overlay || !importer) return null;
      const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
      if (!r || r.external) return r;
      const [file, query] = r.id.split("?");
      if (!file.startsWith(baseSrc + "/")) return r;
      const shadow = join(gameSrc, file.slice(baseSrc.length + 1));
      return existsSync(shadow) ? shadow + (query ? `?${query}` : "") : r;
    },
    transformIndexHtml(html) {
      return html.replace(/<title>.*?<\/title>/, `<title>${meta.name}</title>`)
        .replace(/(name="theme-color" content=")[^"]*/, `$1${meta.themeColor ?? "#0b0f17"}`)
        .replace('src="/base/src/main.ts"', overlay && existsSync(join(gameSrc, "main.ts")) ? `src="/games/${GAME}/src/main.ts"` : 'src="/base/src/main.ts"');
    },
    configureServer(server) {
      if (!overlay) return;
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
        const f = join(gamePublic, path);
        if (path === "/" || !f.startsWith(gamePublic) || !existsSync(f) || !statSync(f).isFile()) return next();
        res.setHeader("Content-Type", MIME[extname(f).toLowerCase()] ?? "application/octet-stream");
        res.setHeader("Cache-Control", "no-cache");
        createReadStream(f).pipe(res);
      });
    },
    closeBundle() {
      if (overlay && existsSync(gamePublic) && process.env.VITEST !== "true") cpSync(gamePublic, resolve(root, outDir), { recursive: true });
    },
  };
}

const outDir = GAME === "base" ? "dist" : `dist-games/${GAME}`;

export default defineConfig({
  base: "./",
  publicDir: basePublic,
  define: { __GAME__: JSON.stringify(GAME) },
  resolve: { alias: [{ find: /^@engine\//, replacement: resolve(root, "engine") + "/" }] },
  plugins: [gameOverlay()],
  server: { fs: { allow: [root] } },
  build: { target: "es2020", outDir, assetsInlineLimit: 0, emptyOutDir: true },
  test: { environment: "node", include: ["tests/**/*.test.ts", "engine/**/*.test.ts", "infra/**/*.test.ts"], testTimeout: 60000 },
} as any);
