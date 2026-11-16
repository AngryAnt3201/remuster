// Pixelkeep: a lost 8-bit cartridge. Everything the bake needs, built with artkit in the kit's pixel look.
import type { GameArt } from "../../../artkit/game";
import { ARENAS } from "./arenas";
import { MAPS, TDART, UI, VFX } from "./flat";
import { KEEPS } from "./keeps";
import { STYLE, TEAMS } from "./style";
import * as a from "./units-a";
import * as b from "./units-b";

/** Every exported UnitDef in the unit modules, keyed by body kind. */
function pick(mods: Record<string, unknown>): GameArt["units"] {
  return Object.fromEntries(Object.entries(mods).filter(([, v]) => !!v && typeof v === "object" && "build" in (v as object))) as GameArt["units"];
}

const art: GameArt = {
  id: "pixelkeep",
  style: STYLE,
  teams: TEAMS,
  units: pick({ ...a, ...b }),
  atlas: { ppu: 128, colors: 40 },
  arenas: ARENAS,
  keeps: KEEPS,
  vfx: VFX,
  maps: MAPS,
  ui: UI,
  td: TDART,
};
export default art;
