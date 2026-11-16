// The bake page: tools/bake.mjs opens this in headless Chromium, and calls window.bake.<task>(args). The game's
// TypeScript builders run here, in a real canvas, and every file goes back to Node through window.__save.
import { BODY_EXTRA, UNITS } from "@engine/core/defs";
import { ANIM_ORDER, ATLAS, base64, bakeSheet, emptyManifest, indexSheet, type SheetMeta } from "../atlas";
import type { GameArt } from "../game";
import { TEAM_NAMES } from "../game";
import { shoot } from "../looks";
import { CLIPS, Pose, buildFrame, type Anim } from "../rig";
import { trim, type Sprite, type TeamCols } from "../toon3d";
import { canvas, log, save, toCanvas } from "./io";
import * as families from "./families";

const game = new URLSearchParams(location.search).get("game") ?? "";
let art: GameArt;
const ready = import(/* @vite-ignore */ `/games/${game}/art/index.ts`).then((m) => { art = m.default; });

const radiusOf = (k: string) => ((UNITS as any)[k] ?? (BODY_EXTRA as any)[k])?.radius ?? 0.25;
const tiersOf = (k: string) => (k in UNITS ? [1, 2, 3, 4] : [1]);
const teamCols = (): TeamCols[] => TEAM_NAMES.map((t) => art.teams[t]);

/** Quality of "mask" format sheets (lossy WebP). Indexed sheets are lossless (WebP at quality 1 in Chromium). */
const SHEET_Q = 0.8;

async function units(a: { kinds?: string[]; tiers?: number[] }) {
  await ready;
  const kinds = a.kinds?.length ? a.kinds : Object.keys(art.units);
  const out: { units: Record<string, { tiers: number[]; radius: number }>; sheets: Record<string, SheetMeta>; bytes: number } = { units: {}, sheets: {}, bytes: 0 };
  for (const kind of kinds) {
    const def = art.units[kind];
    if (!def) throw new Error(`${game}: no builder for "${kind}"`);
    const tiers = tiersOf(kind).filter((t) => !a.tiers?.length || a.tiers.includes(t));
    out.units[kind] = { tiers: tiersOf(kind), radius: radiusOf(kind) };
    for (const tier of tiers) {
      const t0 = performance.now();
      const sheet = bakeSheet(def, kind, tier, art.style, shoot, art.atlas?.ppu);
      const key = `${kind}_t${tier}`;
      if (art.atlas?.format === "mask") {
        sheet.meta.fmt = "mask";
        out.bytes += await save(`public/atlas/${key}.webp`, toCanvas(sheet.pixels, sheet.meta.w, sheet.meta.h * 2), SHEET_Q);
      } else {
        const ix = indexSheet(sheet.pixels, sheet.meta.w, sheet.meta.h, art.atlas?.colors);
        sheet.meta.pal = base64(ix.pal);
        out.bytes += await save(`public/atlas/${key}.webp`, toCanvas(ix.idx, sheet.meta.w, sheet.meta.h), 1);
      }
      out.sheets[key] = sheet.meta;
      log(`  ${key}  ${sheet.meta.w}x${sheet.meta.h}  ${Math.round(performance.now() - t0)} ms`);
    }
  }
  return out;
}

/** Card portraits: the idle pose in three-quarter view, in the player's colours, 256 x 256. */
async function portraits(a: { kinds?: string[] }) {
  await ready;
  const kinds = a.kinds?.length ? a.kinds : Object.keys(art.units);
  let bytes = 0;
  for (const kind of kinds) for (const tier of tiersOf(kind)) {
    const def = art.units[kind];
    const m = buildFrame(def, new Pose(kind, tier, "idle", 1, CLIPS.idle));
    // measure at a small size, then render so the body fills the card
    const probe = trim(shoot(m, { yaw: 58, el: 30, ppu: 64, style: art.style, teams: [art.teams.tide] }));
    const ppu = Math.min(330, 64 * Math.min(236 / probe.w, 236 / probe.h));
    const sp = trim(shoot(m, { yaw: 58, el: 30, ppu, style: art.style, teams: [art.teams.tide] }));
    const [c, g] = canvas(256, 256);
    g.drawImage(toCanvas(sp.data[0], sp.w, sp.h), Math.round((256 - sp.w) / 2), Math.round((256 - sp.h) / 2));
    bytes += await save(`public/portraits/${kind}_t${tier}.png`, c);
  }
  return { bytes };
}

// ------------------------------------------------------------------------------------------------ previews
function blit(g: CanvasRenderingContext2D, s: Sprite, ti: number, x: number, y: number, k = 1) {
  g.imageSmoothingEnabled = k !== 1;
  g.drawImage(toCanvas(s.data[ti], s.w, s.h), Math.round(x - s.ax * k), Math.round(y - s.ay * k), s.w * k, s.h * k);
}
const DIR_NAMES = ["E", "SE", "S", "NE", "N"];

/** Contact sheets into art/preview: per kind, every clip and facing on a baseline (tier 1 unless `tiers` says
 *  otherwise) under a strip of all four tiers; and _roster.png, every kind and tier side by side. */
async function preview(a: { kinds?: string[]; tiers?: number[]; roster?: boolean; sheets?: boolean }) {
  await ready;
  const kinds = a.sheets === false ? [] : a.kinds?.length ? a.kinds : Object.keys(art.units);
  const teams = teamCols();
  for (const kind of kinds) {
    const def = art.units[kind];
    if (!def) throw new Error(`${game}: no builder for "${kind}"`);
    const tier = a.tiers?.[0] ?? 1;
    const anims = ANIM_ORDER.filter((an) => (an !== "cast" || def.cast) && (an !== "walk" || !def.fixed));
    // two rows per facing: idle + walk, then attack (+ cast) + death
    const halves = [anims.filter((x) => x === "idle" || x === "walk"), anims.filter((x) => x !== "idle" && x !== "walk")];
    const models = new Map<string, ReturnType<typeof buildFrame>[]>();
    for (const an of anims) models.set(an, Array.from({ length: CLIPS[an] }, (_, i) => buildFrame(def, new Pose(kind, tier, an as Anim, i, CLIPS[an]))));
    const rows: { label: string; frames: (Sprite | null)[] }[] = [];
    let cw = 40, up = 40, down = 12;
    ATLAS.dirs.forEach((yaw, di) => {
      for (const half of halves) {
        const frames: (Sprite | null)[] = [];
        for (const an of half) {
          for (const m of models.get(an)!) {
            const f = trim(shoot(m, { yaw, el: ATLAS.el, ppu: ATLAS.ppu, style: art.style, teams: [teams[di % 2]] }));
            cw = Math.max(cw, 2 * Math.max(f.ax, f.w - f.ax) + 4); up = Math.max(up, f.ay + 3); down = Math.max(down, f.h - f.ay + 3);
            frames.push(f);
          }
          frames.push(null);
        }
        rows.push({ label: `${DIR_NAMES[di]} ${half.join("+")}`, frames });
      }
    });
    const tierSprites = tiersOf(kind).map((t) => [45, 90, -45].map((yaw) =>
      trim(shoot(buildFrame(def, new Pose(kind, t, "idle", 0, 6)), { yaw, el: ATLAS.el, ppu: ATLAS.ppu * 2, style: art.style, teams }))));
    const th = Math.max(...tierSprites.flat().map((s) => s.h)) + 16, tw = Math.max(...tierSprites.flat().map((s) => s.w)) + 10;
    const ch = up + down, cols = Math.max(...rows.map((r) => r.frames.length));
    {
      // the tiers, large: three-quarter front, front (rival colours) and three-quarter back
      const [tc, tg] = canvas(tw * tierSprites.length * 3 + 10, th);
      tg.fillStyle = "#77736c"; tg.fillRect(0, 0, tc.width, th);
      tierSprites.forEach((list, ti) => list.forEach((s, vi) => blit(tg, s, vi === 1 ? 1 : 0, ti * tw * 3 + vi * tw + tw / 2 - s.w / 2 + s.ax, th - 8 - s.h + s.ay)));
      await save(`art/preview/${kind}_tiers.webp`, tc, 0.8);
    }
    const W = cw * cols, H = rows.length * ch + 4;
    const [c, g] = canvas(W, H);
    g.fillStyle = "#8f8b84"; g.fillRect(0, 0, W, H);
    g.font = "11px monospace"; g.textBaseline = "top";
    rows.forEach((r, ri) => {
      const y = ri * ch + up;
      g.fillStyle = ri % 4 < 2 ? "#96928a" : "#8a867f"; g.fillRect(0, ri * ch, W, ch);
      g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, y, W, 1);
      r.frames.forEach((f, fi) => { if (f) blit(g, f, 0, fi * cw + cw / 2, y); });
      g.fillStyle = "#1c1a17"; g.fillText(r.label, 3, ri * ch + 2);
    });
    await save(`art/preview/${kind}${tier === 1 ? "" : `_t${tier}`}.webp`, c, 0.7);
    log(`  preview ${kind}`);
  }
  if (a.roster) {
    const all = Object.keys(art.units), cell = 150, cols = 8;
    const cellsOf = all.flatMap((k) => tiersOf(k).map((t) => [k, t] as [string, number]));
    const rowsN = Math.ceil(cellsOf.length / cols);
    const [c, g] = canvas(cols * cell, rowsN * (cell + 14));
    g.fillStyle = "#8f8b84"; g.fillRect(0, 0, c.width, c.height);
    g.font = "11px monospace"; g.fillStyle = "#1c1a17";
    cellsOf.forEach(([k, t], i) => {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * (cell + 14);
      const s = trim(shoot(buildFrame(art.units[k], new Pose(k, t, "idle", 0, 6)), { yaw: 45, el: ATLAS.el, ppu: ATLAS.ppu, style: art.style, teams: [teams[(i >> 2) % 2]] }));
      const kk = Math.min(1, (cell - 6) / s.w, (cell - 6) / s.h);
      g.imageSmoothingEnabled = true;
      g.drawImage(toCanvas(s.data[0], s.w, s.h), x + (cell - s.w * kk) / 2, y + cell - s.h * kk - 2, s.w * kk, s.h * kk);
      g.fillText(`${k} ${t}`, x + 4, y + cell + 10);
    });
    await save(`art/preview/_roster.webp`, c, 0.88);
  }
  return {};
}

const atlasHead = async () => { await ready; return emptyManifest(art.id, art.teams, art.atlas?.ppu); };
(window as any).bake = { units, portraits, preview, atlasHead, ...families.tasks(() => art, ready) };
(window as any).bakeReady = ready.then(() => Object.keys(art.units));
