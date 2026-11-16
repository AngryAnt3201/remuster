// Dumps each Bastion map's sim geometry (smoothed roads, pads, gates, keep) for the Blender backdrop script, so the
// render is built from the exact points the sim walks. Run: npx vite-node art/td/export_maps.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MAP_DEFS, ROAD_HALF, getMap } from "../../engine/core/td/maps";

const out: Record<string, unknown> = {};
for (const def of MAP_DEFS) {
  const m = getMap(def.id);
  out[m.id] = {
    w: m.w, h: m.h, act: m.act, roadHalf: ROAD_HALF,
    roads: m.paths.map((p) => p.pts.map((q) => [+q.x.toFixed(4), +q.y.toFixed(4)])),
    pads: m.pads.map((p) => [p.x, p.y]),
    gates: m.gates.map((g) => [g.x, g.y]),
    keep: [m.keep.x, m.keep.y],
  };
}
const dir = join(__dirname, "build");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "maps.json"), JSON.stringify(out));
console.log("wrote", Object.keys(out).join(", "));
