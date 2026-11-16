// Neonhold: a rain-slick neon megacity at night. Everything the bake needs, built with artkit.
import type { GameArt } from "../../../artkit/game";
import { ARENAS } from "./arenas";
import { MAPS, TDART, UI, VFX } from "./flat";
import { KEEPS } from "./keeps";
import { STYLE, TEAMS } from "./style";
import * as crewUnits from "./units-crew";
import * as heavy from "./units-heavy";
import * as machines from "./units-machines";

/** Every exported UnitDef in the unit modules, keyed by body kind. */
function pick(mods: Record<string, unknown>): GameArt["units"] {
  return Object.fromEntries(Object.entries(mods).filter(([, v]) => !!v && typeof v === "object" && "build" in (v as object))) as GameArt["units"];
}

const art: GameArt = {
  id: "neonhold",
  style: STYLE,
  teams: TEAMS,
  units: pick({ ...crewUnits, ...machines, ...heavy }),
  atlas: { ppu: 92, colors: 56 },
  arenas: ARENAS,
  keeps: KEEPS,
  vfx: VFX,
  maps: MAPS,
  ui: UI,
  td: TDART,
};
export default art;
