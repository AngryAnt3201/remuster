// Set the active v3 style direction (art/style/active.json) once Jack picks one from
// outputs/signoff/muster-style/index.html. The game palette (base/src/render/style.ts) and every Blender
// renderer (art/muster_art/style.py `load()`) read it.
//   npm run style:pick -- dusk
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "art", "style", "active.json");
const active = JSON.parse(readFileSync(file, "utf8"));
const id = process.argv[2];
if (!id) {
  console.log(`active: ${active.direction} (${active.status})\nchoices: ${active.choices.join(", ")}`);
  process.exit(0);
}
if (!active.choices.includes(id)) {
  console.error(`unknown direction "${id}"; expected one of ${active.choices.join(", ")}`);
  process.exit(1);
}
const day = new Date().toISOString().slice(0, 10);
const next = { direction: id, status: `picked by Jack on ${day}`, choices: active.choices };
writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
console.log(`active direction: ${id}`);
