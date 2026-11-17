// Blackridge: a modern war seen from a drone feed. Everything the bake needs, built with artkit in its "real" look.
import type { GameArt } from "../../../artkit/game";
import { ARENAS } from "./arenas";
import { MAPS, TDART, UI, VFX } from "./flat";
import { KEEPS } from "./keeps";
import { STYLE, TEAMS } from "./style";
import * as foot from "./units-foot";
import * as mech from "./units-mech";
import * as spec from "./units-spec";

function pick(mods: Record<string, unknown>): GameArt["units"] {
  return Object.fromEntries(Object.entries(mods).filter(([, v]) => !!v && typeof v === "object" && "build" in (v as object))) as GameArt["units"];
}

const art: GameArt = {
  id: "blackridge",
  style: STYLE,
  teams: TEAMS,
  units: pick({ ...foot, ...mech, ...spec }),
  atlas: { ppu: 112, colors: 200 },
  arenas: ARENAS,
  keeps: KEEPS,
  vfx: VFX,
  maps: MAPS,
  ui: UI,
  td: TDART,
};
export default art;
