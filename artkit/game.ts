// What a game hands the bake: `games/<id>/art/index.ts` default-exports a GameArt.
import type { UnitDef } from "./rig";
import type { Style, TeamCols } from "./toon3d";
import type { ArenaArt } from "./arena";
import type { KeepArt } from "./keep";
import type { MapArt, TdArt, UiArt } from "./flat";
import type { VfxArt } from "./vfx";

export interface GameArt {
  id: string;
  /** The look every sprite is rendered in. */
  style: Style;
  /** The two armies' colours: the player's (tide) and the rival's (ember). Team materials take these. */
  teams: { tide: TeamCols; ember: TeamCols };
  /** One builder per body kind: every key of UNITS and BODY_EXTRA in engine/core/defs.ts. */
  units: Record<string, UnitDef>;
  /** Unit sheet options: pixels per world unit (default 128; lower ships smaller, softer sheets), the file format
   *  ("indexed", the default: palette indices, small and crisp; "mask": full colour over a team mask, for looks with
   *  soft gradients) and the palette size for indexed sheets (default 160, at most 255). */
  atlas?: { ppu?: number; format?: "indexed" | "mask"; colors?: number };
  /** The ten campaign battlefields (artkit/arena.ts). */
  arenas?: ArenaArt;
  /** The commander keeps (artkit/keep.ts). */
  keeps?: KeepArt;
  /** Effect sheets: recolour or redraw the base game's (artkit/vfx.ts). Omit to bake them unchanged. */
  vfx?: VfxArt;
  /** Campaign map pages, the home key art and the Bastion backdrops (artkit/flat.ts). */
  maps?: MapArt;
  ui?: UiArt;
  td?: TdArt;
}
export const TEAM_NAMES = ["tide", "ember"] as const;
