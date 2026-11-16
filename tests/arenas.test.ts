import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEVELS } from "../engine/core/campaign";
import { H, W } from "../engine/core/defs";
import { ARENA_COUNT, arenaAct, backdropRect, propRect, propVariant, type ArenaManifest } from "../base/src/render/arena";
import { Camera, DIST, TILT } from "../base/src/render/camera";

const DIR = join(__dirname, "..", "base", "public", "arenas");
const man = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) as ArenaManifest;
const NAMES = ["Borderlands", "Ash Fields", "Hollow Wood", "Iron Pass", "High Keep", "Frozen Reach", "Sky Throne", "Mirelight Fen", "Saltwind Coast", "Crownfall Citadel"];

describe("arenas", () => {
  it("has a backdrop and three obstacle props for each of the 10 acts", () => {
    expect(man.version).toBe(3);
    expect(ARENA_COUNT).toBe(10);
    expect(Object.keys(man.acts).sort((a, b) => +a - +b)).toEqual(Array.from({ length: ARENA_COUNT }, (_, i) => String(i + 1)));
    for (let a = 1; a <= ARENA_COUNT; a++) {
      const info = man.acts[String(a)];
      expect(info.name).toBe(NAMES[a - 1]);
      expect(statSync(join(DIR, info.ground)).size).toBeGreaterThan(50_000);
      expect(info.props).toHaveLength(3);
      for (const p of info.props) expect(existsSync(join(DIR, p.file))).toBe(true);
    }
  });

  it("was rendered through the game's camera, so its ground lines up with the board on any screen", () => {
    expect(man.camera.tilt).toBeCloseTo(TILT, 6);
    expect(man.camera.dist).toBeCloseTo(DIST, 6);
    const v = man.view;
    // pixel aspect matches the image-plane rect
    expect(man.size[0] / man.size[1]).toBeCloseTo((v.u1 - v.u0) / (v.v1 - v.v0), 2);
    for (const [w, h] of [[390, 844], [430, 932], [820, 1180]]) {
      const cam = new Camera(W, H);
      cam.fit({ x: 8, y: 90, w: w - 16, h: h - 330 });
      const r = backdropRect(man, cam.k, cam.cx, cam.cy);
      // a board corner lands where the camera puts it: the same image-plane point
      for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
        const p = cam.project(x, y);
        const u = (p.x - r.x) / r.w, q = (p.y - r.y) / r.h;
        const X = x - W / 2, Y = y - H / 2, cz = DIST - Y * Math.sin(TILT);
        expect(u).toBeCloseTo((X / cz - v.u0) / (v.u1 - v.u0), 6);
        expect(q).toBeCloseTo(((Y * Math.cos(TILT)) / cz - v.v0) / (v.v1 - v.v0), 6);
      }
      // and the backdrop covers the whole board with the screen's sides
      expect(r.x).toBeLessThanOrEqual(0);
      expect(r.x + r.w).toBeGreaterThanOrEqual(w);
      expect(r.y).toBeLessThanOrEqual(cam.project(0, 0, 1.1).y);
    }
  });

  it("keeps every prop's base silhouette within 8% of its collision circle", () => {
    for (const info of Object.values(man.acts))
      for (const p of info.props) {
        expect(p.footprint, `${info.name} ${p.file}`).toBeGreaterThan(0.92);
        expect(p.footprint, `${info.name} ${p.file}`).toBeLessThan(1.08);
      }
  });

  it("stands a prop on its obstacle: ground anchor on the centre, scaled by the obstacle radius", () => {
    const s = 40, r = 0.75, cx = 200, cy = 300;
    const rect = propRect(man, cx, cy, r, s);
    expect(rect.x + rect.w * man.prop.anchor[0]).toBeCloseTo(cx, 6);
    expect(rect.y + rect.h * man.prop.anchor[1]).toBeCloseTo(cy, 6);
    expect(rect.w).toBeCloseTo(man.prop.frame[0] * r * s, 6);
    expect(rect.w / rect.h).toBeCloseTo(man.prop.res[0] / man.prop.res[1], 2);
    // rendered at the camera's mid-board elevation
    expect(man.prop.elev).toBeCloseTo(90 - (TILT * 180) / Math.PI, 2);
  });

  it("picks the arena by act and falls back to act 1", () => {
    for (let a = 1; a <= ARENA_COUNT; a++) expect(arenaAct(a, man)).toBe(a);
    expect(arenaAct(undefined, man)).toBe(1);
    expect(arenaAct(0, man)).toBe(1);
    expect(arenaAct(ARENA_COUNT + 1, man)).toBe(1);
    expect(arenaAct(3, null)).toBe(3);
    expect(arenaAct(12, null)).toBe(1);
    for (const l of LEVELS) expect(man.acts[String(arenaAct(l.act, man))]).toBeDefined();
  });

  it("gives an obstacle the same prop variant every time", () => {
    const o = { x: 2.2, y: 7, r: 0.6 };
    expect(propVariant(o, 3)).toBe(propVariant({ ...o }, 3));
    for (const l of LEVELS) for (const ob of l.obstacles ?? []) {
      const v = propVariant(ob, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
    }
  });
});
