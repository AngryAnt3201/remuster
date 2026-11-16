// Dustline: a railroad town at high noon. Everything the bake needs, built with artkit.
import type { GameArt } from "../../../artkit/game";
import { ARENAS } from "./arenas";
import { MAPS, TDART, UI, VFX } from "./flat";
import { KEEPS } from "./keeps";
import { STYLE, TEAMS } from "./style";
import * as foot from "./units-foot";
import * as other from "./units-other";

/** Every exported UnitDef in the unit modules, keyed by body kind. */
function pick(mods: Record<string, unknown>): GameArt["units"] {
  return Object.fromEntries(Object.entries(mods).filter(([, v]) => !!v && typeof v === "object" && "build" in (v as object))) as GameArt["units"];
}

const art: GameArt = {
  id: "dustline",
  style: STYLE,
  teams: TEAMS,
  units: pick({ ...foot, ...other }),
  atlas: { ppu: 104, colors: 56 },
  arenas: ARENAS,
  keeps: KEEPS,
  vfx: VFX,
  maps: MAPS,
  ui: UI,
  td: TDART,
};
export default art;
