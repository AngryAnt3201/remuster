// Is a game's art complete, and does it keep the contract the runtime's loaders rely on? Node only (reads files).
//   errors   the files a game ships break the contract: the game would draw wrongly or fall back to drawn tokens
//   missing  art the game does not supply, so the base game's shows through instead (fine while a game is in
//            progress; a finished re-theme has none)
// Used by tests/artkit.test.ts and by `node tools/bake.mjs <game> --check`.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BODY_EXTRA, UNITS } from "../engine/core/defs";
import { MAP_DEFS } from "../engine/core/td/maps";
import { DIST, TILT, mirror8 } from "../base/src/render/camera";
import { KEEP_ARTS } from "../base/src/render/keeps";
import { TD_SQUASH, TD_TEX_M, TD_TEX_PPU } from "../base/src/render/tdCamera";
import { ACT_MAPS } from "../base/src/ui/mapdata";
import { CLIPS, IMPACT } from "./rig";

export interface ArtReport { game: string; errors: string[]; missing: string[]; bytes: number; }
/** Bodies that fly: they need no stride. */
const FLYING = ["harrier", "griffin"];

function webpSize(file: string): { w: number; h: number } | null {
  const b = readFileSync(file);
  if (b.toString("ascii", 0, 4) + b.toString("ascii", 8, 12) !== "RIFFWEBP") return null;
  const cc = b.toString("ascii", 12, 16);
  if (cc === "VP8L") { const bits = b.readUInt32LE(21); return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }; }
  if (cc === "VP8X") return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  if (cc === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return null;
}
const json = (f: string) => JSON.parse(readFileSync(f, "utf8"));
const dirSize = (d: string): number => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? dirSize(join(d, e.name)) : statSync(join(d, e.name)).size), 0) : 0);

/** Check games/<game>/public under `root` (the repo). */
export function checkGameArt(root: string, game: string): ArtReport {
  const pub = join(root, "games", game, "public"), basePub = join(root, "base", "public");
  const errors: string[] = [], missing: string[] = [];
  const has = (...p: string[]) => existsSync(join(pub, ...p));

  // ---- unit atlases
  if (!has("atlas", "manifest.json")) missing.push("atlas: no unit sheets at all (public/atlas/manifest.json)");
  else {
    const m = json(join(pub, "atlas", "manifest.json"));
    if (!(m.version >= 4)) errors.push(`atlas: version ${m.version}, the loader needs 4 or later`);
    if (Math.abs(m.el - (90 - (TILT * 180) / Math.PI)) > 0.1) errors.push(`atlas: rendered at pitch ${m.el}, the board camera is ${(90 - (TILT * 180) / Math.PI).toFixed(1)}`);
    const rendered = (m.dirs as number[]).map((deg) => ((Math.round(deg / 45) % 8) + 8) % 8);
    for (let d = 0; d < 8; d++) { const [di, flip] = m.dir8?.[d] ?? [-1, false], want = mirror8(d); if (rendered[di] !== want.frame || flip !== want.flip) errors.push(`atlas: dir8[${d}] does not match the camera's mirrored facings`); }
    if (m.impact?.attack !== IMPACT) errors.push(`atlas: impact.attack is ${m.impact?.attack}, expected ${IMPACT}`);
    for (const [k, tiers] of [...Object.keys(UNITS).map((k) => [k, [1, 2, 3, 4]] as const), ...Object.keys(BODY_EXTRA).map((k) => [k, [1]] as const)]) {
      const u = m.units?.[k];
      if (!u?.tiers?.length) { missing.push(`atlas: no sheet for "${k}"`); continue; }
      if (!u.tiers.includes(1)) errors.push(`atlas: "${k}" has no tier 1 sheet (lower ranks would have nothing to fall back to)`);
      for (const t of tiers) if (!u.tiers.includes(t)) missing.push(`atlas: "${k}" has no tier ${t} sheet (it shows tier ${u.tiers.filter((x: number) => x <= t).pop() ?? u.tiers[0]})`);
      for (const t of u.tiers) {
        const key = `${k}_t${t}`, sh = m.sheets?.[key], file = join(pub, "atlas", `${key}.webp`);
        if (!sh) { errors.push(`atlas: units.${k} lists tier ${t} but sheets.${key} is absent`); continue; }
        if (!existsSync(file)) { errors.push(`atlas: ${key}.webp is absent`); continue; }
        const size = webpSize(file), wantH = sh.fmt === "mask" ? sh.h * 2 : sh.h;
        if (!size || size.w !== sh.w || size.h !== wantH) errors.push(`atlas: ${key}.webp is ${size?.w}x${size?.h}, the manifest says ${sh.w}x${wantH}`);
        if (sh.fmt !== "mask") {
          const pal = Buffer.from(sh.pal ?? "", "base64");
          if (!pal.length || pal.length % 7 || pal.length / 7 > 256 || pal[3] !== 0) errors.push(`atlas: ${key} has a bad palette`);
        }
        if (!["heavy", "mid", "light"].includes(sh.weight)) errors.push(`atlas: ${key} has no motion weight`);
        for (const a of ["idle", "walk", "attack", "death", "cast"] as const) {
          let list = sh.anims?.[a], src: string = a;
          if (a === "cast" && !list) continue;
          if (typeof list === "string") list = sh.anims[(src = list)];
          if (!Array.isArray(list)) { errors.push(`atlas: ${key} has no ${a} clip`); continue; }
          if (list.length !== m.dirs.length) errors.push(`atlas: ${key} ${a} has ${list.length} facings, expected ${m.dirs.length}`);
          for (const frames of list as number[][][]) {
            if (frames.length !== CLIPS[src as keyof typeof CLIPS]) { errors.push(`atlas: ${key} ${a} has ${frames.length} frames, expected ${CLIPS[src as keyof typeof CLIPS]}`); break; }
            if (frames.some(([x, y, w, h]) => x < 0 || y < 0 || x + w > sh.w || y + h > sh.h)) { errors.push(`atlas: ${key} ${a} has a frame outside its sheet`); break; }
          }
        }
        if (sh.anims?.walk !== "idle" && !FLYING.includes(k) && !(sh.stride > 0.1)) errors.push(`atlas: ${key} walks but records no stride (its feet would slide)`);
      }
    }
  }
  // ---- portraits (the cards ask for the exact tier, with no fallback)
  for (const k of Object.keys(UNITS)) for (const t of [1, 2, 3, 4]) if (!has("portraits", `${k}_t${t}.png`)) missing.push(`portraits: ${k}_t${t}.png`);
  for (const k of Object.keys(BODY_EXTRA)) if (!has("portraits", `${k}_t1.png`)) missing.push(`portraits: ${k}_t1.png`);

  // ---- arenas
  if (!has("arenas", "manifest.json")) missing.push("arenas: no arenas (public/arenas/manifest.json)");
  else {
    const m = json(join(pub, "arenas", "manifest.json"));
    if (!(m.version >= 3)) errors.push(`arenas: version ${m.version}, the loader needs 3`);
    if (Math.abs(m.camera?.tilt - TILT) > 1e-6 || Math.abs(m.camera?.dist - DIST) > 1e-6) errors.push("arenas: not rendered through the board camera (camera.tilt / camera.dist)");
    const v = m.view;
    if (!v || Math.abs(m.size[0] / m.size[1] - (v.u1 - v.u0) / (v.v1 - v.v0)) > 0.01) errors.push("arenas: the backdrop's pixel aspect does not match its view rectangle");
    if (!m.acts?.["1"]) errors.push("arenas: act 1 is absent (every act falls back to it)");
    for (let a = 1; a <= 10; a++) {
      const info = m.acts?.[String(a)];
      if (!info) { missing.push(`arenas: act ${a}`); continue; }
      if (!has("arenas", info.ground)) errors.push(`arenas: act ${a} ground ${info.ground} is absent`);
      if (!has("arenas", `act${a}.jpg`)) missing.push(`arenas: act${a}.jpg (menus use this name for card art)`);
      if (!info.props?.length) errors.push(`arenas: act ${a} has no obstacle props`);
      for (const p of info.props ?? []) {
        if (!has("arenas", p.file)) errors.push(`arenas: act ${a} prop ${p.file} is absent`);
        if (!(p.footprint > 0.92 && p.footprint < 1.08)) errors.push(`arenas: act ${a} prop ${p.file} footprint ${p.footprint} is not within 8% of its collision circle`);
      }
      if (info.fg) {
        if (!has("arenas", info.fg.file)) errors.push(`arenas: act ${a} foreground ${info.fg.file} is absent`);
        if ((info.fg.cells as number[][]).some(([x, y, w, h]) => x < 0 || y < 0 || x + w > 1.0001 || y + h > 1.0001)) errors.push(`arenas: act ${a} has a foreground cell outside the backdrop`);
      }
    }
  }
  // ---- keeps
  if (!has("keeps", "manifest.json")) missing.push("keeps: no keeps (public/keeps/manifest.json)");
  else {
    const m = json(join(pub, "keeps", "manifest.json"));
    for (const k of ["ground", "gate", "top"]) { const p = m.anchors?.[k]; if (!p || p[0] < 0 || p[0] > m.w || p[1] < 0 || p[1] > m.h) errors.push(`keeps: anchor "${k}" is absent or outside the image`); }
    if (!m.anchors?.fires?.length || !m.anchors?.smoke?.length) errors.push("keeps: no fire or smoke anchors");
    for (const v of ["tide", "ember", "ember_boss"]) for (const st of KEEP_ARTS) {
      const f = join(pub, "keeps", `${v}_${st}.webp`);
      if (!existsSync(f)) { (v === "ember_boss" ? missing : errors).push(`keeps: ${v}_${st}.webp is absent`); continue; }
      const s = webpSize(f);
      if (!s || s.w !== m.w || s.h !== m.h) errors.push(`keeps: ${v}_${st}.webp is ${s?.w}x${s?.h}, the manifest says ${m.w}x${m.h}`);
    }
    const skins = existsSync(join(basePub, "keeps", "skins")) ? readdirSync(join(basePub, "keeps", "skins")) : [];
    for (const sk of skins) for (const st of KEEP_ARTS) if (!has("keeps", "skins", sk, `${st}.webp`)) missing.push(`keeps: skin ${sk}/${st}.webp`);
  }
  // ---- effects
  if (!has("vfx", "atlas.json")) missing.push("vfx: no effect atlas (public/vfx/atlas.json)");
  else {
    const m = json(join(pub, "vfx", "atlas.json")), b = json(join(basePub, "vfx", "atlas.json"));
    if (!has("vfx", m.image)) errors.push(`vfx: image ${m.image} is absent`);
    for (const [name, sh] of Object.entries(b.sheets) as [string, any][]) {
      const g = m.sheets?.[name];
      if (!g) { errors.push(`vfx: sheet "${name}" is absent (the renderer plays it by name)`); continue; }
      if (g.frames < sh.frames) errors.push(`vfx: sheet "${name}" has ${g.frames} frames, the renderer plays ${sh.frames}`);
      if (g.x + g.cols * (g.w + g.gap) - g.gap > m.w || g.y + Math.ceil(g.frames / g.cols) * (g.h + g.gap) - g.gap > m.h) errors.push(`vfx: sheet "${name}" runs outside the atlas`);
    }
  }
  // ---- maps, key art, bastion
  for (const a of ACT_MAPS) if (!has(a.image)) missing.push(`maps: ${a.image}`);
  if (!has("ui", "title-key.webp")) missing.push("ui: title-key.webp (the home screen's key art)");
  if (!has("td", "manifest.json")) missing.push("td: no Bastion backdrops (public/td/manifest.json)");
  else {
    const m = json(join(pub, "td", "manifest.json"));
    if (m.ppu !== TD_TEX_PPU || m.margin !== TD_TEX_M || m.squash !== TD_SQUASH) errors.push("td: not painted in the ground texture's layout (ppu, margin, squash): the runtime would ignore it");
    for (const def of MAP_DEFS) {
      const info = m.maps?.[def.id];
      if (!info) { missing.push(`td: map "${def.id}"`); continue; }
      let y = 0;
      for (const s of info.slices) { if (s.y !== y) errors.push(`td: ${def.id} slices do not tile`); y += s.h; if (!has("td", s.file)) errors.push(`td: ${s.file} is absent`); }
      if (y !== info.px[1] || info.px[0] !== Math.round((def.w + TD_TEX_M * 2) * TD_TEX_PPU) || info.px[1] !== Math.ceil((def.h + TD_TEX_M * 2) * TD_TEX_PPU * TD_SQUASH)) errors.push(`td: ${def.id} is the wrong size for its map`);
    }
  }
  return { game, errors, missing, bytes: dirSize(pub) };
}

/** Every game under games/ that has a public folder. */
export function gamesWithArt(root: string): string[] {
  const d = join(root, "games");
  return existsSync(d) ? readdirSync(d).filter((g) => existsSync(join(d, g, "public"))) : [];
}
