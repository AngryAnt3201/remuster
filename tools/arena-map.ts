// Draws the arenas and the campaign sets as ASCII maps and checks them against the design rules.
//   npx vite-node tools/arena-map.ts             every arena: map, block list, issues
//   npx vite-node tools/arena-map.ts sets        the campaign set pieces instead
//   npx vite-node tools/arena-map.ts md          the arena sections of docs/ARENA.md (setsmd: the campaign set sections)
// Each cell is half a unit; `#` wall, `H` building, `%` barricade, `=` cover, `~` water, `:` road, `"` brush.
import { ARENAS, ARENA_RULES, LEAGUES, terrainIssues, zoneFree } from "../engine/core/arena";
import { LEVELS } from "../engine/core/campaign";
import { H, W } from "../engine/core/defs";
import { SETS, SET_RULES } from "../engine/core/sets";
import type { Block } from "../engine/core/terrain";

const GLYPH: Record<Block["kind"], string> = { wall: "#", building: "H", barricade: "%", cover: "=", water: "~", road: ":", brush: '"' };
const ORDER: Block["kind"][] = ["road", "brush", "water", "cover", "barricade", "wall", "building"];

export function asciiMap(blocks: readonly Block[]): string {
  const rows: string[] = [];
  for (let cy = 0; cy < H * 2; cy++) {
    let row = "";
    for (let cx = 0; cx < W * 2; cx++) {
      const x = (cx + 0.5) / 2, y = (cy + 0.5) / 2;
      let g = ".";
      // A cell shows a block that covers at least a third of it (so thin cover is not lost between cell centres).
      const share = (b: Block) => Math.max(0, Math.min(x + 0.25, b.x + b.w / 2) - Math.max(x - 0.25, b.x - b.w / 2)) * Math.max(0, Math.min(y + 0.25, b.y + b.h / 2) - Math.max(y - 0.25, b.y - b.h / 2)) / 0.25;
      for (const k of ORDER) if (blocks.some((b) => b.kind === k && share(b) >= 0.33)) g = GLYPH[k];
      row += g + " ";
    }
    const yTop = cy / 2;
    rows.push(row + (cy === 0 ? "  y 0" : yTop === 6.5 ? "  y 6.4: side 1's zone ends" : yTop === 7.5 ? "  y 7.6: side 0's zone starts" : cy === H * 2 - 1 ? "  y 14" : ""));
  }
  return rows.join("\n");
}
const n = (v: number) => String(+v.toFixed(2));
export const blockList = (blocks: readonly Block[]) =>
  blocks.map((b) => `${b.id} ${b.kind}/${b.look} x ${n(b.x - b.w / 2)}-${n(b.x + b.w / 2)} y ${n(b.y - b.h / 2)}-${n(b.y + b.h / 2)}`).join("; ");

const mode = process.argv[2] ?? "";
if (!process.env.VITEST) {
  if (mode === "setsmd") {
    for (const s of Object.values(SETS)) {
      const used = LEVELS.filter((l) => l.set === s.id).map((l) => `${l.id} ${l.name}${l.boss ? " (boss)" : ""}`).join(", ");
      console.log(`### ${s.name} (\`${s.id}\`)\n${s.idea} ${s.blocks.length} blocks; zone free: ${Math.round(zoneFree(s.blocks, 0) * 100)}%. Levels: ${used}.\n\n\`\`\`\n${asciiMap(s.blocks)}\n\`\`\`\n\nBlocks: ${blockList(s.blocks)}.\n`);
    }
  } else if (mode === "sets") {
    for (const s of Object.values(SETS)) {
      console.log(`\n### ${s.name} (\`${s.id}\`)  ${s.blocks.length} blocks, zone free ${Math.round(zoneFree(s.blocks, 0) * 100)}%\n${s.idea}\n`);
      console.log(asciiMap(s.blocks));
      const issues = terrainIssues(s.blocks, SET_RULES);
      console.log(issues.length ? "ISSUES:\n  " + issues.join("\n  ") : "sound");
    }
  } else {
    for (const a of ARENAS) {
      const league = LEAGUES[a.league - 1].name;
      if (mode === "md") {
        console.log(`### ${a.name} (\`${a.id}\`, ${league})\n${a.idea} ${a.blocks.length} blocks; zone free: ${Math.round(zoneFree(a.blocks, 0) * 100)}%.\n\n\`\`\`\n${asciiMap(a.blocks)}\n\`\`\`\n\nBlocks: ${blockList(a.blocks)}.\n`);
        continue;
      }
      console.log(`\n### ${a.name} (${a.id}, ${league})  ${a.blocks.length} blocks, zone free ${Math.round(zoneFree(a.blocks, 0) * 100)}%`);
      console.log(asciiMap(a.blocks));
      const issues = terrainIssues(a.blocks, ARENA_RULES);
      console.log(issues.length ? "ISSUES:\n  " + issues.join("\n  ") : "sound");
    }
  }
}
