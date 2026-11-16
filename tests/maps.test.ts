import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACTS, LEVELS } from "../engine/core/campaign";
import { ACT_MAPS, MAP_SIZE } from "../base/src/ui/mapdata";
import { mapForAct, nodeFractions, nodePositions, pathUpTo, pointAt } from "../base/src/ui/maplayout";

describe("campaign act maps", () => {
  it("has a painted map for each of the ten acts, and one for every act in ACTS", () => {
    expect(ACT_MAPS.length).toBe(10);
    expect(ACT_MAPS[7].id).toBe("fen");
    expect(ACT_MAPS[8].id).toBe("coast");
    expect(ACT_MAPS[9].id).toBe("citadel");
    expect(ACTS.length).toBeLessThanOrEqual(ACT_MAPS.length);
    expect(new Set(ACT_MAPS.map((m) => m.id)).size).toBe(ACT_MAPS.length);
    ACTS.forEach((_, i) => expect(mapForAct(i)).toBe(ACT_MAPS[i]));
  });

  it("ships every map image at the generated size", () => {
    for (const m of ACT_MAPS) {
      const f = `base/public/${m.image}`;
      expect(existsSync(f), f).toBe(true);
      const b = readFileSync(f);
      // JPEG SOF0/SOF2 marker holds height then width
      let i = 2;
      let size: [number, number] | null = null;
      while (i < b.length) {
        const marker = b[i + 1];
        const len = b.readUInt16BE(i + 2);
        if (marker === 0xc0 || marker === 0xc2) { size = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; break; }
        i += 2 + len;
      }
      expect(size).toEqual([MAP_SIZE.w, MAP_SIZE.h]);
      expect(b.length).toBeLessThan(600_000);
    }
  });

  it("keeps every road inside the image, clear of the header and the act bar, climbing to the boss", () => {
    for (const m of ACT_MAPS) {
      expect(m.path.length).toBeGreaterThan(10);
      for (const [x, y] of m.path) {
        expect(x).toBeGreaterThan(0.08);
        expect(x).toBeLessThan(0.92);
        expect(y).toBeGreaterThan(0.18);
        expect(y).toBeLessThan(0.9);
      }
      expect(m.path[0][1]).toBeGreaterThan(m.path[m.path.length - 1][1] + 0.5);
      expect(m.boss[1]).toBeLessThan(m.path[m.path.length - 1][1]);
    }
  });

  it("lays one node per level along the road, first at the camp and the boss at the end", () => {
    ACTS.forEach((_, i) => {
      const levels = LEVELS.filter((l) => l.act === i + 1);
      const m = mapForAct(i);
      const pts = nodePositions(m, levels.length);
      expect(pts.length).toBe(levels.length);
      expect(pts[0]).toEqual(m.path[0]);
      expect(pts[pts.length - 1]).toEqual(m.path[m.path.length - 1]);
      const boss = levels.findIndex((l) => l.boss);
      if (boss >= 0) expect(boss).toBe(levels.length - 1);
      // nodes far enough apart to tap (48 pt buttons on a 390 pt wide phone)
      for (let k = 1; k < pts.length; k++) {
        const d = Math.hypot((pts[k][0] - pts[k - 1][0]) * 390, (pts[k][1] - pts[k - 1][1]) * 390 * (MAP_SIZE.h / MAP_SIZE.w));
        expect(d).toBeGreaterThan(56);
      }
    });
  });

  it("works for any act size, and the progress trail ends on the node", () => {
    expect(nodeFractions(0)).toEqual([]);
    expect(nodeFractions(1)).toEqual([1]);
    expect(nodeFractions(6)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    const m = ACT_MAPS[0];
    const trail = pathUpTo(m.path, 0.4);
    expect(trail[0]).toEqual(m.path[0]);
    expect(trail[trail.length - 1]).toEqual(pointAt(m.path, 0.4));
    expect(mapForAct(99)).toBe(ACT_MAPS[ACT_MAPS.length - 1]);
  });
});
