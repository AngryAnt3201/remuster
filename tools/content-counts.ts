// Prints the game's content counts as JSON, read from base/src/core so store copy and the site never go stale.
// Used by tools/release-config.mjs (fills {{units}}, {{levels}}, {{acts}} ... in store/metadata.json and site/*.html).
// Run: npx vite-node tools/content-counts.ts
import { contentCounts } from "../engine/core/counts";

console.log(JSON.stringify(contentCounts()));
