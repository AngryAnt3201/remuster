// Unit atlases: every frame of every clip and facing for one body and tier, rendered, trimmed, packed into one sheet
// per team and described in the layout base/src/render/sprites.ts reads (see docs/ART-V3-ATLAS.md "Frames").
// Pure: the bake page turns the packed pixels into WebP files.
import { CLIPS, IMPACT, Pose, TIER_SCALE, buildFrame, clipPoses, type Anim, type UnitDef, type Weight } from "./rig";
import { WHITE_TEAM, render, trim, type RenderOpts, type Sprite, type Style, type TeamCols } from "./toon3d";

/** The atlas contract shared with the runtime. */
export const ATLAS = {
  version: 4,
  /** Atlas pixels per world unit (a game may lower it to ship smaller sheets: GameArt.atlas.ppu). */
  ppu: 128,
  /** Camera pitch below the horizon: 90 degrees minus the board camera's tilt (0.64 rad). */
  el: 53.3,
  /** Rendered facings in game angles (0 = east / screen right, 90 = south / towards the camera). */
  dirs: [0, 45, 90, -45, -90],
  /** 8-way screen facing -> [rendered facing, mirrored]. */
  dir8: [[0, false], [1, false], [2, false], [1, true], [0, true], [3, true], [4, false], [3, false]] as [number, boolean][],
  anims: CLIPS,
  impact: { attack: IMPACT, cast: IMPACT },
  /** The death clip ships at this fraction of the atlas resolution. */
  deathScale: 0.6,
};
export const ANIM_ORDER: Anim[] = ["idle", "walk", "attack", "cast", "death"];

/** x, y, w, h in the sheet, the ground anchor in the frame, and the frame's resolution against the atlas ppu. */
export type Rect = [number, number, number, number, number, number, number?];
export interface SheetMeta {
  w: number; h: number;
  /** Absent: <key>.webp holds palette indices (lossless) and `pal` the palette, the base game's own format: small
   *  and crisp, right for flat toon shading. "mask": <key>.webp is twice the sheet's height, the sheet in full colour
   *  (team parts white) over its team mask (red = team main, green = dark, blue = light): for looks with soft
   *  gradients that a 255-colour palette would band. The runtime tints either per team at load. */
  fmt?: "mask";
  /** base64 palette, 7 bytes an entry: r, g, b, a, then the team mask (main, dark, light); entry 0 is clear. */
  pal?: string;
  stride: number; weight: Weight;
  anims: Record<string, Rect[][] | string>;
}
export interface BakedSheet { meta: SheetMeta; /** RGBA, w x 2h: the colour sheet over its team mask. */ pixels: Uint8ClampedArray; }

/** Renders a model for the game's board (the kit's looks are applied in shoot, see looks.ts). */
export type Shooter = (m: import("./toon3d").Model, o: RenderOpts) => Sprite;

function hash(d: Uint8ClampedArray, w: number, h: number) {
  let a = 2166136261 ^ w, b = 5381 ^ h;
  for (let i = 0; i < d.length; i++) { a = Math.imul(a ^ d[i], 16777619); b = (Math.imul(b, 33) + d[i]) | 0; }
  return `${w}x${h}:${a >>> 0}:${b >>> 0}`;
}

/** Shelf-pack rectangles (w, h) into a sheet about as wide as it is tall. Returns the positions and the sheet size. */
export function shelfPack(sizes: [number, number][], gap = 2): { pos: [number, number][]; w: number; h: number } {
  const area = sizes.reduce((s, [w, h]) => s + (w + gap) * (h + gap), 0);
  const maxW = Math.max(1, ...sizes.map((s) => s[0]));
  const W = Math.max(maxW + gap, Math.ceil(Math.sqrt(area * 1.06) / 16) * 16);
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b][1] - sizes[a][1] || sizes[b][0] - sizes[a][0] || a - b);
  const pos: [number, number][] = sizes.map(() => [0, 0]);
  let x = 0, y = 0, row = 0;
  for (const i of order) {
    const [w, h] = sizes[i];
    if (x + w > W) { x = 0; y += row + gap; row = 0; }
    pos[i] = [x, y];
    x += w + gap; row = Math.max(row, h);
  }
  return { pos, w: W, h: y + row };
}

/** Every frame of one body and tier, rendered and packed. */
export function bakeSheet(def: UnitDef, kind: string, tier: number, style: Style, shoot: Shooter = render, ppu = ATLAS.ppu): BakedSheet {
  const teams = [WHITE_TEAM];
  const frames: Sprite[] = [];
  const index = new Map<string, number>();
  const anims: Record<string, Rect[][] | string> = {};
  const ref: Record<string, { fi: number; s: number }[][]> = {};
  let stride = 0;
  for (const anim of ANIM_ORDER) {
    if (anim === "cast" && !def.cast) continue;
    if (anim === "walk" && def.fixed) { anims.walk = "idle"; continue; }
    const s = anim === "death" ? ATLAS.deathScale : 1;
    const byDir: { fi: number; s: number }[][] = ATLAS.dirs.map(() => []);
    for (const p of clipPoses(kind, tier, anim)) {
      const m = buildFrame(def, p);
      stride = Math.max(stride, p.stride);
      ATLAS.dirs.forEach((yaw, di) => {
        const sp = trim(shoot(m, { yaw, el: ATLAS.el, ppu: ppu * s, style, teams, mask: true }));
        const key = hash(sp.data[0], sp.w, sp.h) + hash(sp.data[1], sp.w, sp.h) + `:${Math.round(sp.ax * 4)}:${Math.round(sp.ay * 4)}`;
        let fi = index.get(key);
        if (fi === undefined) { fi = frames.length; frames.push(sp); index.set(key, fi); }
        byDir[di].push({ fi, s });
      });
    }
    ref[anim] = byDir;
  }
  const pack = shelfPack(frames.map((f) => [f.w, f.h]));
  const pixels = new Uint8ClampedArray(pack.w * pack.h * 2 * 4);
  frames.forEach((f, i) => {
    const [x, y] = pack.pos[i];
    f.data.forEach((d, ti) => { for (let r = 0; r < f.h; r++) pixels.set(d.subarray(r * f.w * 4, (r + 1) * f.w * 4), ((y + r + ti * pack.h) * pack.w + x) * 4); });
  });
  // the mask half is opaque, so its colour survives lossy compression everywhere
  for (let i = pack.w * pack.h * 4 + 3; i < pixels.length; i += 4) pixels[i] = 255;
  for (const [anim, byDir] of Object.entries(ref)) {
    anims[anim] = byDir.map((list) => list.map(({ fi, s }) => {
      const f = frames[fi], [x, y] = pack.pos[fi];
      const r: Rect = [x, y, f.w, f.h, Math.round(f.ax), Math.round(f.ay)];
      if (s !== 1) r.push(s);
      return r;
    }));
  }
  return { meta: { w: pack.w, h: pack.h, stride: def.flying || def.fixed ? 0 : +stride.toFixed(4), weight: def.weight, anims }, pixels };
}

/** One frame for previews and portraits. */
export function frameSprite(def: UnitDef, kind: string, tier: number, anim: Anim, i: number, o: Omit<RenderOpts, "yaw" | "el" | "ppu"> & { yaw?: number; el?: number; ppu?: number }, shoot: Shooter = render): Sprite {
  const m = buildFrame(def, new Pose(kind, tier, anim, i, CLIPS[anim]));
  return shoot(m, { yaw: 45, el: ATLAS.el, ppu: ATLAS.ppu, ...o });
}

export interface AtlasManifest {
  version: number; style: string; ppu: number; el: number; dirs: number[]; dir8: [number, boolean][];
  anims: Record<Anim, number>; impact: { attack: number; cast: number };
  teams: { tide: TeamCols; ember: TeamCols };
  /** True: the runtime tints these sheets with `teams` above (the game's own colours), not the base style's. */
  ownTeams: boolean;
  units: Record<string, { tiers: number[]; radius: number }>;
  sheets: Record<string, SheetMeta>;
}
export function emptyManifest(style: string, teams: { tide: TeamCols; ember: TeamCols }, ppu = ATLAS.ppu): AtlasManifest {
  return { version: ATLAS.version, style, ppu, el: ATLAS.el, dirs: ATLAS.dirs, dir8: ATLAS.dir8, anims: ATLAS.anims, impact: ATLAS.impact, teams, ownTeams: true, units: {}, sheets: {} };
}
export { TIER_SCALE };

/** Which file format unit sheets ship in (see SheetMeta.fmt). */
export type SheetFormat = "indexed" | "mask";

/** Quantise a baked sheet (colour over mask, w x 2h) to one palette of at most `colors` entries over colour, alpha
 *  and team mask together. Returns the palette (7 bytes an entry, entry 0 clear) and the w x h index image as opaque
 *  RGBA with the index in every colour channel (the runtime reads red). */
export function indexSheet(px: Uint8ClampedArray, w: number, h: number, colors = 160): { pal: Uint8Array; idx: Uint8ClampedArray } {
  const n = w * h, off = n * 4, K = Math.min(255, colors);
  const key = (i: number) => {
    const a = px[i + 3];
    if (a < 20) return -1;
    return (px[i] >> 4) | ((px[i + 1] >> 4) << 4) | ((px[i + 2] >> 4) << 8) | ((a >> 5) << 12) | ((px[off + i] >> 6) << 15) | ((px[off + i + 1] >> 6) << 17) | ((px[off + i + 2] >> 6) << 19);
  };
  // bins: how many pixels, and their summed components (so an entry is the true mean of what it stands for)
  const bins = new Map<number, Float64Array>();
  for (let p = 0; p < n; p++) {
    const i = p * 4, k = key(i);
    if (k < 0) continue;
    let b = bins.get(k);
    if (!b) bins.set(k, (b = new Float64Array(8)));
    b[0]++; b[1] += px[i]; b[2] += px[i + 1]; b[3] += px[i + 2]; b[4] += px[i + 3]; b[5] += px[off + i]; b[6] += px[off + i + 1]; b[7] += px[off + i + 2];
  }
  const ranked = [...bins.entries()].sort((a, b) => b[1][0] - a[1][0] || a[0] - b[0]);
  const top = ranked.slice(0, K);
  const pal = new Uint8Array((top.length + 1) * 7);
  const entry = new Map<number, number>();
  top.forEach(([k, b], e) => {
    for (let c = 0; c < 7; c++) pal[(e + 1) * 7 + c] = Math.round(b[c + 1] / b[0]);
    if (pal[(e + 1) * 7 + 3] > 236) pal[(e + 1) * 7 + 3] = 255;
    entry.set(k, e + 1);
  });
  // everything else goes to its nearest entry (alpha and team coverage weigh most: they change what a pixel is)
  for (const [k, b] of ranked.slice(K)) {
    let best = Infinity, be = 1;
    for (let e = 1; e <= top.length; e++) {
      let d = 0;
      for (let c = 0; c < 7; c++) { const x = b[c + 1] / b[0] - pal[e * 7 + c]; d += x * x * (c === 3 ? 3 : c > 3 ? 2 : 1); }
      if (d < best) { best = d; be = e; }
    }
    entry.set(k, be);
  }
  const idx = new Uint8ClampedArray(n * 4);
  for (let p = 0; p < n; p++) {
    const k = key(p * 4), e = k < 0 ? 0 : entry.get(k)!;
    idx[p * 4] = idx[p * 4 + 1] = idx[p * 4 + 2] = e; idx[p * 4 + 3] = 255;
  }
  return { pal, idx };
}
export function base64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return typeof btoa === "function" ? btoa(s) : Buffer.from(b).toString("base64");
}
