// Bake tasks for the non-unit asset families (arenas, keeps, vfx, maps, ui, td).
import { ARENA, bakeArena } from "../arena";
import type { GameArt } from "../game";
import { shoot } from "../looks";
import { KEEP, bakeKeep, keepManifest } from "../keep";
import { canvas, loadImage, log, save, saveText, toCanvas } from "./io";
import { MAP_DEFS, getMap } from "@engine/core/td/maps";
import { Stamps, TD, TITLE_SIZE, mapInfos, tdSize } from "../flat";
import { Painter } from "../paint";
import { Model } from "../toon3d";
import { gradePixels, type VfxSheet } from "../vfx";

const NEUTRAL = { main: "#c9a15a", dark: "#8a6a34", light: "#f1dca6" };

export function tasks(art: () => GameArt, ready: Promise<void>): Record<string, (a: any) => Promise<any>> {
  /** Arena backdrops, foregrounds and obstacle props for every act (or `acts`: [1, 5]). */
  async function arenas(a: { acts?: number[]; preview?: boolean }) {
    await ready;
    const def = art().arenas;
    if (!def) throw new Error("this game has no arenas (GameArt.arenas)");
    const acts: Record<string, unknown> = {};
    const thumbs: HTMLCanvasElement[] = [];
    for (let i = 0; i < def.acts.length; i++) {
      const n = i + 1, d = def.acts[i];
      if (a.acts?.length && !a.acts.includes(n)) continue;
      const t0 = performance.now();
      const b = bakeArena(d, n, art().style, def.team ?? NEUTRAL, shoot);
      if (a.preview) { thumbs.push(b.backdrop); continue; }
      await save(`public/arenas/act${n}.jpg`, b.backdrop, 0.84);
      await save(`public/arenas/act${n}_fg.webp`, b.fg, 0.85);
      for (let k = 0; k < b.props.length; k++) await save(`public/arenas/act${n}_prop${k}.png`, b.props[k].canvas);
      acts[String(n)] = {
        name: d.name, edge: d.edge, obstacle: d.obstacle, ground: `act${n}.jpg`,
        props: b.props.map((p, k) => ({ file: `act${n}_prop${k}.png`, footprint: p.footprint })),
        fg: { file: `act${n}_fg.webp`, cells: b.cells }, ...(d.ambient ? { ambient: d.ambient } : {}),
      };
      log(`  act ${n} ${d.name}  ${Math.round(performance.now() - t0)} ms`);
    }
    if (a.preview) {
      const [c, g] = canvas(thumbs.length * 368, 608);
      g.fillStyle = "#222"; g.fillRect(0, 0, c.width, c.height);
      thumbs.forEach((t, i) => g.drawImage(t, i * 368 + 2, 3, 364, 602));
      await save(`art/preview/_arenas${a.acts?.length ? "_" + a.acts.join("_") : ""}.webp`, c, 0.85);
      return {};
    }
    return { head: { version: ARENA.version, style: art().id, camera: ARENA.camera, view: ARENA.view, prop: ARENA.prop, size: ARENA.size }, acts };
  }
  /** Both sides' keeps in every damage state, the boss keep and the cosmetic skins. */
  async function keeps(a: { preview?: boolean }) {
    await ready;
    const def = art().keeps;
    if (!def) throw new Error("this game has no keeps (GameArt.keeps)");
    const st = art().style, T = art().teams;
    const variants: { file: string; team: typeof T.tide; boss: boolean; skin: string | null }[] = [
      { file: "tide", team: T.tide, boss: false, skin: null }, { file: "ember", team: T.ember, boss: false, skin: null }, { file: "ember_boss", team: T.ember, boss: true, skin: null },
      ...KEEP.skins.map((k) => ({ file: `skins/${k}/`, team: def.skinTeams?.[k] ?? T.tide, boss: false, skin: k as string })),
    ];
    const [pc, pg] = canvas(KEEP.w * 5 * 0.6, KEEP.h * variants.length * 0.6);
    pg.fillStyle = "#8f8b84"; pg.fillRect(0, 0, pc.width, pc.height);
    for (let v = 0; v < variants.length; v++) for (let d = 0; d < KEEP.states.length; d++) {
      const va = variants[v], state = KEEP.states[d];
      const px = bakeKeep(def, { damage: d, state, boss: va.boss, skin: va.skin }, va.team, st, shoot);
      const c = toCanvas(px, KEEP.w, KEEP.h);
      if (a.preview) pg.drawImage(c, d * KEEP.w * 0.6, v * KEEP.h * 0.6, KEEP.w * 0.6, KEEP.h * 0.6);
      else await save(`public/keeps/${va.file}${va.skin ? "" : "_"}${state}.webp`, c, 0.9);
    }
    if (a.preview) await save(`art/preview/_keeps.webp`, pc, 0.85);
    else await saveText(`public/keeps/manifest.json`, JSON.stringify(keepManifest(def, art().id), null, 1));
    return {};
  }
  /** The effect atlas: the base game's sheets, regraded and redrawn as the game asks. */
  async function vfx(a: { preview?: boolean }) {
    await ready;
    const def = art().vfx ?? {};
    const man = await (await fetch("/vfx/atlas.json")).json() as { image: string; w: number; h: number; version: number; sheets: Record<string, VfxSheet> };
    const img = await loadImage(`/vfx/${man.image}`);
    const [c, g] = canvas(man.w, man.h);
    g.drawImage(img, 0, 0);
    for (const [name, sh] of Object.entries(man.sheets)) {
      const rows = Math.ceil(sh.frames / sh.cols), W = sh.cols * (sh.w + sh.gap) - sh.gap, H = rows * (sh.h + sh.gap) - sh.gap;
      const cell = (f: number): [number, number] => [sh.x + (f % sh.cols) * (sh.w + sh.gap), sh.y + Math.floor(f / sh.cols) * (sh.h + sh.gap)];
      const model = def.models?.[name], paint = def.paint?.[name];
      if (model || paint) {
        g.clearRect(sh.x, sh.y, W, H);
        for (let f = 0; f < sh.frames; f++) {
          const [cx, cy] = cell(f);
          g.save(); g.beginPath(); g.rect(cx, cy, sh.w, sh.h); g.clip();
          if (model) {
            const m = new Model();
            model(m, f, sh.frames);
            const sp = shoot(m, { yaw: 0, el: 12, ppu: sh.h, style: art().style, teams: [NEUTRAL] });
            g.drawImage(toCanvas(sp.data[0], sp.w, sp.h), Math.round(cx + sh.w * sh.anchor[0] - sp.ax), Math.round(cy + sh.h * sh.anchor[1] - sp.ay));
          } else { g.translate(cx, cy); paint!(g, f, sh.frames, sh.w, sh.h); }
          g.restore();
        }
        continue;
      }
      const gr = def.grade?.[name] ?? (sh.tint ? undefined : def.grade?.["*"]);
      if (!gr) continue;
      const d = g.getImageData(sh.x, sh.y, W, H);
      gradePixels(d.data, gr);
      g.putImageData(d, sh.x, sh.y);
    }
    if (a.preview) {
      const [pc, pg] = canvas(man.w / 2, man.h / 2);
      pg.fillStyle = "#3a3a40"; pg.fillRect(0, 0, pc.width, pc.height); pg.drawImage(c, 0, 0, pc.width, pc.height);
      await save(`art/preview/_vfx.webp`, pc, 0.85);
      return {};
    }
    await save(`public/vfx/atlas.webp`, c, 1);
    await saveText(`public/vfx/atlas.json`, JSON.stringify({ ...man, image: "atlas.webp" }));
    return {};
  }
  /** Campaign map pages, one per act. */
  async function maps(a: { preview?: boolean; acts?: number[] }) {
    await ready;
    const def = art().maps;
    if (!def) throw new Error("this game has no maps (GameArt.maps)");
    const st = new Stamps(art(), shoot), infos = mapInfos();
    const [pc, pg] = canvas(infos.length * 212, 464);
    for (const info of infos) {
      if (a.acts?.length && !a.acts.includes(info.index + 1)) continue;
      const p = new Painter(0, 0, info.w, info.h, 1, { ink: art().style.ink, seed: 100 + info.index });
      def.paint(p, info, st);
      if (a.preview) pg.drawImage(p.canvas, info.index * 212 + 1, 1, 210, 462);
      else await save(`public/maps/${info.id}.jpg`, p.canvas, 0.86);
    }
    if (a.preview) await save(`art/preview/_maps.webp`, pc, 0.85);
    return {};
  }
  /** The home screen's key art. */
  async function ui(a: { preview?: boolean }) {
    await ready;
    const def = art().ui;
    if (!def) throw new Error("this game has no key art (GameArt.ui)");
    const p = new Painter(0, 0, TITLE_SIZE.w, TITLE_SIZE.h, 1, { ink: art().style.ink, seed: 7 });
    def.titleKey(p, new Stamps(art(), shoot));
    if (a.preview) { const [pc, pg] = canvas(TITLE_SIZE.w / 3, TITLE_SIZE.h / 3); pg.drawImage(p.canvas, 0, 0, pc.width, pc.height); await save(`art/preview/_title.webp`, pc, 0.85); }
    else await save(`public/ui/title-key.webp`, p.canvas, 0.86);
    return {};
  }
  /** Bastion backdrops: every tower-defence map's ground, in strips. */
  async function td(a: { preview?: boolean }) {
    await ready;
    const def = art().td;
    if (!def) throw new Error("this game has no Bastion backdrops (GameArt.td)");
    const st = new Stamps(art(), shoot);
    const out: Record<string, unknown> = {};
    const thumbs: HTMLCanvasElement[] = [];
    for (const md of MAP_DEFS) {
      const map = getMap(md.id), [W, H] = tdSize(map);
      const p = new Painter(-TD.margin, -TD.margin, map.w + TD.margin * 2, map.h + TD.margin * 2, TD.ppu, { ys: TD.ppu * TD.squash, px: [W, H], ink: art().style.ink, seed: 300 + md.w });
      def.paint(p, map, st);
      if (a.preview) { thumbs.push(p.canvas); continue; }
      const slices: { file: string; y: number; h: number }[] = [];
      for (let k = 0, y = 0; k < TD.slices; k++) {
        const h = k === TD.slices - 1 ? H - y : Math.round(H / TD.slices);
        const [sc, sg] = canvas(W, h);
        sg.drawImage(p.canvas, 0, -y);
        const file = `${md.id}_${k}.webp`;
        await save(`public/td/${file}`, sc, 0.84);
        slices.push({ file, y, h }); y += h;
      }
      out[md.id] = { w: map.w, h: map.h, px: [W, H], slices, pads: map.pads.map((q) => [q.x, q.y]), roads: map.paths.map((r) => r.pts.filter((_, i) => i % 8 === 0).map((q) => [+q.x.toFixed(3), +q.y.toFixed(3)])), check: { camera_px: 0, pads: [0, 0], road: [0, 0], verge: [0, 0] } };
    }
    if (a.preview) {
      const [pc, pg] = canvas(thumbs.length * 300, 800);
      thumbs.forEach((t, i) => pg.drawImage(t, i * 300, 0, 296, 800));
      await save(`art/preview/_td.webp`, pc, 0.85);
    } else await saveText(`public/td/manifest.json`, JSON.stringify({ version: 1, squash: TD.squash, margin: TD.margin, ppu: TD.ppu, maps: out }));
    return {};
  }
  return { arenas, keeps, vfx, maps, ui, td };
}
