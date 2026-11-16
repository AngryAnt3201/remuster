// Flat pictures built from paint and stamped models: campaign map pages (public/maps), the home key art
// (public/ui/title-key.webp) and the Bastion tower-defence backdrops (public/td). A game paints each with a Painter
// and stands toon-3D models in it with Stamps (buildings, landmarks, even its own units).
import type { TdMap } from "@engine/core/td/maps";
import { ACT_MAPS, MAP_SIZE } from "../base/src/ui/mapdata";
import { TD_SQUASH, TD_TEX_M, TD_TEX_PPU } from "../base/src/render/tdCamera";
import type { GameArt } from "./game";
import type { Painter, Pt } from "./paint";
import { CLIPS, Pose, buildFrame, type Anim } from "./rig";
import { Model, trim, type RenderOpts, type Sprite, type TeamCols } from "./toon3d";

type Shoot = (m: Model, o: RenderOpts) => Sprite;
export interface StampOpts {
  /** Pixels per model unit in the picture (default 60). */
  ppu?: number;
  /** Facing (0 = screen right, 90 = towards the viewer; default 60) and camera pitch (default 50). */
  yaw?: number; el?: number;
  /** Team colours for team materials: "tide", "ember" or explicit colours (default neutral brass). */
  team?: "tide" | "ember" | TeamCols;
  /** A contact shadow of this radius (model units). */
  shadow?: number;
  alpha?: number;
  /** Reuse the rendered sprite under this name next time (same build, same options). */
  key?: string;
}
const NEUTRAL: TeamCols = { main: "#c9a15a", dark: "#8a6a34", light: "#f1dca6" };

/** Stands rendered models in a Painter's picture. */
export class Stamps {
  private cache = new Map<string, { c: HTMLCanvasElement; ax: number; ay: number }>();
  constructor(readonly art: GameArt, private shoot: Shoot) {}
  private team(t: StampOpts["team"]): TeamCols { return t === "tide" || t === "ember" ? this.art.teams[t] : t ?? NEUTRAL; }
  private sprite(build: (m: Model) => void, o: StampOpts) {
    const hit = o.key ? this.cache.get(o.key) : undefined;
    if (hit) return hit;
    const m = new Model();
    build(m);
    const sp = trim(this.shoot(m, { yaw: o.yaw ?? 60, el: o.el ?? 50, ppu: o.ppu ?? 60, style: this.art.style, teams: [this.team(o.team)], shadow: o.shadow }));
    const c = document.createElement("canvas");
    c.width = sp.w; c.height = sp.h;
    const id = c.getContext("2d")!.createImageData(sp.w, sp.h);
    id.data.set(sp.data[0]);
    c.getContext("2d")!.putImageData(id, 0, 0);
    const out = { c, ax: sp.ax, ay: sp.ay };
    if (o.key) this.cache.set(o.key, out);
    return out;
  }
  /** Stand a model with its origin at (x, y) in the painter's units. */
  model(p: Painter, build: (m: Model) => void, x: number, y: number, o: StampOpts = {}) {
    const s = this.sprite(build, o), [px, py] = p.toPx(x, y), g = p.g;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = o.alpha ?? 1;
    g.drawImage(s.c, Math.round(px - s.ax), Math.round(py - s.ay));
    g.restore();
  }
  /** Stand one of the game's own units: a frame of a clip (default the first idle frame). */
  unit(p: Painter, kind: string, tier: number, x: number, y: number, o: StampOpts & { anim?: Anim; frame?: number } = {}) {
    const def = this.art.units[kind];
    if (!def) throw new Error(`no unit "${kind}"`);
    const an = o.anim ?? "idle";
    this.model(p, (m) => m.merge(buildFrame(def, new Pose(kind, tier, an, o.frame ?? 0, CLIPS[an]))), x, y, { team: "tide", ...o });
  }
}

// ------------------------------------------------------------------------------------------------ campaign maps
/** One campaign map page. The road, camp and boss positions are the base game's (base/src/ui/mapdata.ts), so the
 *  level nodes the UI draws land on the road you paint. All in pixels of the 840 x 1848 page. */
export interface MapInfo { id: string; index: number; w: number; h: number; path: Pt[]; camp: Pt; boss: Pt; }
export interface MapArt {
  /** Paint page `map.index` (0..9, one per act). The painter's units are pixels. */
  paint(p: Painter, map: MapInfo, st: Stamps): void;
}
export function mapInfos(): MapInfo[] {
  const { w, h } = MAP_SIZE;
  return ACT_MAPS.map((a, index) => ({ id: a.id, index, w, h, path: a.path.map(([x, y]) => [x * w, y * h] as Pt), camp: [a.camp[0] * w, a.camp[1] * h], boss: [a.boss[0] * w, a.boss[1] * h] }));
}

// ------------------------------------------------------------------------------------------------ key art
export interface UiArt {
  /** The home screen's key art, 1206 x 2622 (the UI crops it to the screen around 35% down). Units are pixels. */
  titleKey(p: Painter, st: Stamps): void;
}
export const TITLE_SIZE = { w: 1206, h: 2622 };

// ------------------------------------------------------------------------------------------------ bastion (tower defence)
export interface TdArt {
  /** Paint a Bastion map's ground. The painter's units are the map's world units (x 0..map.w, y 0..map.h, plus a
   *  3.5-unit margin all round); y is already foreshortened, so circles come out as ground ellipses. Draw the road
   *  along map.paths (half width ROAD_HALF) and a plinth on every map.pads entry; stand models with `st`. */
  paint(p: Painter, map: TdMap, st: Stamps): void;
}
export const TD = { ppu: TD_TEX_PPU, margin: TD_TEX_M, squash: TD_SQUASH, slices: 4 };
/** Pixel size of a map's backdrop. */
export const tdSize = (map: { w: number; h: number }): [number, number] => [Math.round((map.w + TD.margin * 2) * TD.ppu), Math.ceil((map.h + TD.margin * 2) * TD.ppu * TD.squash)];
