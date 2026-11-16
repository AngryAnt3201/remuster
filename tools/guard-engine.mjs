// Claude Code hook (PreToolUse on Edit/Write, see .claude/settings.json): a game never edits engine/.
// The engine is locked (engine/ENGINE.lock.json) and the backend re-runs it to verify results, so a changed engine
// can't play online. Engine maintainers work with REMUSTER_ENGINE=1 in the environment.
import { resolve, sep } from "node:path";
let input = "";
for await (const chunk of process.stdin) input += chunk;
let file = "";
try { const j = JSON.parse(input); file = j.tool_input?.file_path ?? j.tool_input?.notebook_path ?? ""; } catch { process.exit(0); }
const root = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const inEngine = file && resolve(file).startsWith(resolve(root, "engine") + sep);
if (inEngine && process.env.REMUSTER_ENGINE !== "1") {
  console.error("engine/ is locked: a game changes games/<id>/ (see REMIX.md), never the engine. Rename things in the game's lexicon, restyle in its theme and art. If the engine itself has a bug, report it to the user instead of patching it.");
  process.exit(2);
}
