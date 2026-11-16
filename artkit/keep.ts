// Commander keeps: each side's stronghold behind its deploy zone, in the layout base/src/render/keeps.ts loads.
//   <team>_<state>.webp          tide, ember and ember_boss (the rival's keep on a boss level)
//   skins/<skin>/<state>.webp    cosmetic skins for the player's keep (frost, ember, gilded, shadow, blossom)
//   manifest.json                canvas size and anchors (ground, gate, top, flag pole, where fires and smoke rise)
// States follow the commander's health: intact, cracked, burning, ruined, then fallen (rubble) once defeated.
import { Model, DEG, type RenderOpts, type Sprite, type Style, type TeamCols, type V3 } from "./toon3d";

export const KEEP = {
  ppu: 128, w: 372, h: 380, elevation: 55,
  /** Where the model's origin (the centre of its footprint on the ground) sits in the image. */
  ground: [188.5, 246.1] as [number, number],
  /** Half width of the footprint the game expects, world units: keep the base within about 1.3 units of the origin
   *  and the whole keep under about 2.6 units tall (flag included) so it fits the canvas. */
  footprint: 1.22,
  states: ["intact", "cracked", "burning", "ruined", "fallen"] as const,
  skins: ["frost", "ember", "gilded", "shadow", "blossom"] as const,
};
export type KeepStateName = (typeof KEEP.states)[number];

export interface KeepBuild {
  /** 0 intact, 1 cracked, 2 burning, 3 ruined, 4 fallen. */
  damage: number;
  state: KeepStateName;
  /** The rival's keep on a boss level: grander, crowned. */
  boss: boolean;
  /** A cosmetic skin for the player's keep, or null for the default. */
  skin: string | null;
}
export interface KeepArt {
  /** Build the keep for a state: origin on the ground at the centre of the footprint, the gate facing +x (the bake
   *  turns it to face the camera). Team materials take the side's colours. */
  build(m: Model, k: KeepBuild): void;
  /** Points on the intact keep (model space) the game hangs effects on: the gate (where attackers strike), the top
   *  of the tower, the tip of the flag pole (the victory banner runs up it), where fires burn and smoke rises. */
  anchors: { gate: V3; top: V3; pole: V3; fires: V3[]; smoke: V3[] };
  /** Team colours for a skin (the skin replaces the player's colours): omit a skin to bake it in the tide colours. */
  skinTeams?: Partial<Record<string, TeamCols>>;
}

type Shoot = (m: Model, o: RenderOpts) => Sprite;
const YAW = 90;

/** Model point to keep-image pixel. */
export function keepPixel(p: V3): [number, number] {
  const el = KEEP.elevation * DEG;
  // yaw 90: the model's +x faces the camera, its +y (right side) runs to screen left
  const wx = -p[1], wy = p[0];
  return [+(KEEP.ground[0] + wx * KEEP.ppu).toFixed(1), +(KEEP.ground[1] + (wy * Math.sin(el) - p[2] * Math.cos(el)) * KEEP.ppu).toFixed(1)];
}
/** One keep image: RGBA pixels, KEEP.w x KEEP.h. */
export function bakeKeep(def: KeepArt, k: KeepBuild, team: TeamCols, style: Style, shoot: Shoot): Uint8ClampedArray {
  const m = new Model();
  def.build(m, k);
  const sp = shoot(m, { yaw: YAW, el: KEEP.elevation, ppu: KEEP.ppu, style, teams: [team], shadow: k.damage >= 4 ? 1.0 : 1.25 });
  const out = new Uint8ClampedArray(KEEP.w * KEEP.h * 4);
  const dx = Math.round(KEEP.ground[0] - sp.ax), dy = Math.round(KEEP.ground[1] - sp.ay);
  for (let y = 0; y < sp.h; y++) {
    const oy = y + dy;
    if (oy < 0 || oy >= KEEP.h) continue;
    for (let x = 0; x < sp.w; x++) {
      const ox = x + dx;
      if (ox < 0 || ox >= KEEP.w) continue;
      const i = (y * sp.w + x) * 4, o = (oy * KEEP.w + ox) * 4;
      out[o] = sp.data[0][i]; out[o + 1] = sp.data[0][i + 1]; out[o + 2] = sp.data[0][i + 2]; out[o + 3] = sp.data[0][i + 3];
    }
  }
  return out;
}
export function keepManifest(def: KeepArt, style: string) {
  const a = def.anchors;
  return {
    ppu: KEEP.ppu, w: KEEP.w, h: KEEP.h, elevation: KEEP.elevation, style, states: KEEP.states, teams: ["tide", "ember"], variants: ["tide", "ember", "ember_boss"], footprint: KEEP.footprint,
    anchors: { ground: KEEP.ground, gate: keepPixel(a.gate), top: keepPixel(a.top), pole: keepPixel(a.pole), fires: a.fires.map(keepPixel), smoke: a.smoke.map(keepPixel) },
  };
}
