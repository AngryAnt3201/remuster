// Cindermaw: a 1993 demon-shooter. Everything the bake needs, built with artkit in the kit's grit look.
import type { GameArt } from "../../../artkit/game";
import { ARENAS } from "./arenas";
import { STYLE, TEAMS } from "./style";
import * as a from "./units-a";
import * as b from "./units-b";

/** Every exported UnitDef in the unit modules, keyed by body kind. */
function pick(mods: Record<string, unknown>): GameArt["units"] {
  return Object.fromEntries(Object.entries(mods).filter(([, v]) => !!v && typeof v === "object" && "build" in (v as object))) as GameArt["units"];
}

const art: GameArt = {
  id: "cindermaw",
  style: STYLE,
  teams: TEAMS,
  units: pick({ ...a, ...b }),
  atlas: { ppu: 96, colors: 56 },
  arenas: ARENAS,
};
export default art;
