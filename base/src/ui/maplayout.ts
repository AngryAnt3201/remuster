// Campaign map layout: which illustrated map an act uses and where its level nodes sit on the painted road.
// Pure functions (no DOM) so tests can check them.
import { ACT_MAPS, MAP_SIZE, type ActMap } from "./mapdata";

export type Pt = [number, number];

/** The map for an act by its ACTS index. Acts past the last painted map reuse the last one. */
export function mapForAct(index: number): ActMap {
  return ACT_MAPS[Math.max(0, Math.min(ACT_MAPS.length - 1, index))];
}

/** Cumulative arc lengths along a path given in image fractions, measured in image pixels. */
function arcs(path: Pt[], w: number, h: number): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) {
    out.push(out[i - 1] + Math.hypot((path[i][0] - path[i - 1][0]) * w, (path[i][1] - path[i - 1][1]) * h));
  }
  return out;
}

/** The point at arc fraction t (0 = road start at the camp, 1 = road end at the boss). */
export function pointAt(path: Pt[], t: number, w = MAP_SIZE.w, h = MAP_SIZE.h): Pt {
  const a = arcs(path, w, h);
  const target = Math.max(0, Math.min(1, t)) * a[a.length - 1];
  for (let i = 1; i < path.length; i++) {
    if (a[i] >= target) {
      const seg = a[i] - a[i - 1] || 1;
      const f = (target - a[i - 1]) / seg;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f];
    }
  }
  return path[path.length - 1];
}

/** Arc fractions for n level nodes: the first on the camp, the last (the boss) at the road end, evenly spaced. */
export function nodeFractions(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  return Array.from({ length: n }, (_, i) => i / (n - 1));
}

/** Node positions (image fractions) for n levels along the act's road. */
export function nodePositions(map: ActMap, n: number): Pt[] {
  return nodeFractions(n).map((t) => pointAt(map.path, t));
}

/** The road from its start up to arc fraction t, for drawing the progress trail. */
export function pathUpTo(path: Pt[], t: number, w = MAP_SIZE.w, h = MAP_SIZE.h): Pt[] {
  if (t <= 0) return [path[0]];
  const a = arcs(path, w, h);
  const target = Math.min(1, t) * a[a.length - 1];
  const out: Pt[] = [path[0]];
  for (let i = 1; i < path.length && a[i] < target; i++) out.push(path[i]);
  out.push(pointAt(path, t, w, h));
  return out;
}
