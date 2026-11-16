// Bastion maps: a tall battlefield (MW x MH world units, same 1.0 unit as the main board) with one or more roads
// from enemy gates at the top (y small) down to your keep at the bottom. Roads are hand-placed control points,
// smoothed into dense polylines that enemies walk by distance. Build pads sit beside the road.
// Pure data + geometry, no DOM; deterministic.

export interface Pt { x: number; y: number; }
export interface Pad { id: number; x: number; y: number; /** nearest road point: where melee defenders stand guard */ rally: Pt; }
export interface RoadPath { pts: Pt[]; /** cumulative length at each point */ cum: number[]; len: number; }

export interface TdMapDef {
  id: string;
  name: string;
  blurb: string;
  w: number;
  h: number;
  /** Control points per road, gate first, keep last. */
  roads: Pt[][];
  /** Extra hand-placed pads (beyond the generated ones). */
  pads?: Pt[];
  /** Arena act whose grass and props dress the map. */
  act: number;
  startGold: number;
}

export interface TdMap extends Omit<TdMapDef, "pads" | "roads"> {
  paths: RoadPath[];
  pads: Pad[];
  keep: Pt;
  gates: Pt[];
}

export const MAP_DEFS: TdMapDef[] = [
  {
    id: "meadow",
    name: "Meadow Pass",
    blurb: "One long road winds down the valley.",
    w: 13,
    h: 54,
    act: 1,
    startGold: 110,
    roads: [[
      { x: 6.5, y: 1.2 }, { x: 6.5, y: 5 }, { x: 3, y: 8.5 }, { x: 2.6, y: 13.5 }, { x: 6, y: 17 }, { x: 10.2, y: 19.5 },
      { x: 10.4, y: 25 }, { x: 6.8, y: 28.5 }, { x: 3, y: 31 }, { x: 2.8, y: 36 }, { x: 6.5, y: 39.5 }, { x: 10, y: 42 },
      { x: 9.8, y: 46.5 }, { x: 6.5, y: 49 }, { x: 6.5, y: 52.2 },
    ]],
  },
  {
    id: "fords",
    name: "Twin Fords",
    blurb: "Two roads from two gates meet at the old bridge.",
    w: 15,
    h: 56,
    act: 3,
    startGold: 130,
    roads: [
      [
        { x: 2.6, y: 1.2 }, { x: 2.6, y: 6 }, { x: 4.8, y: 10.5 }, { x: 3, y: 15.5 }, { x: 4.5, y: 21 }, { x: 7.5, y: 25.5 },
        { x: 7.5, y: 30 }, { x: 4, y: 34 }, { x: 3.6, y: 39 }, { x: 7.5, y: 43 }, { x: 11, y: 46 }, { x: 10.5, y: 50 }, { x: 7.5, y: 51.8 }, { x: 7.5, y: 54.2 },
      ],
      [
        { x: 12.4, y: 1.2 }, { x: 12.4, y: 6 }, { x: 10.2, y: 10.5 }, { x: 12, y: 15.5 }, { x: 10.5, y: 21 }, { x: 7.5, y: 25.5 },
        { x: 7.5, y: 30 }, { x: 4, y: 34 }, { x: 3.6, y: 39 }, { x: 7.5, y: 43 }, { x: 11, y: 46 }, { x: 10.5, y: 50 }, { x: 7.5, y: 51.8 }, { x: 7.5, y: 54.2 },
      ],
    ],
  },
];

/** Catmull-Rom through the control points, sampled every ~0.25 units. */
export function smoothRoad(ctrl: Pt[], step = 0.25): RoadPath {
  const pts: Pt[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  pts.push({ ...ctrl[ctrl.length - 1] });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, len: cum[cum.length - 1] };
}

/** Position and heading at distance s along a road (clamped to its ends). */
export function pointAt(p: RoadPath, s: number): { x: number; y: number; dx: number; dy: number } {
  const d = Math.max(0, Math.min(p.len, s));
  let lo = 0, hi = p.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p.cum[m] <= d) lo = m; else hi = m; }
  const a = p.pts[lo], b = p.pts[hi], seg = p.cum[hi] - p.cum[lo] || 1, t = (d - p.cum[lo]) / seg;
  const dx = (b.x - a.x) / seg, dy = (b.y - a.y) / seg;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx, dy };
}

/** Nearest point on a road to (x, y): the point, its distance along the road and how far off it is. */
export function nearestOnRoad(p: RoadPath, x: number, y: number): { x: number; y: number; s: number; d: number } {
  let best = { x: p.pts[0].x, y: p.pts[0].y, s: 0, d: Infinity };
  for (let i = 0; i < p.pts.length - 1; i++) {
    const a = p.pts[i], b = p.pts[i + 1];
    const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / l2));
    const qx = a.x + vx * t, qy = a.y + vy * t, d = Math.hypot(x - qx, y - qy);
    if (d < best.d) best = { x: qx, y: qy, s: p.cum[i] + Math.sqrt(l2) * t, d };
  }
  return best;
}

export const ROAD_HALF = 0.62; // half the road's width, world units
const PAD_OFF = 1.75; // pad centre from the road centre
const PAD_GAP = 2.3; // minimum spacing between pads

/** Pads alternate either side of the road every few units, skipping spots that crowd another road bend or a pad. */
function generatePads(def: TdMapDef, paths: RoadPath[]): Pt[] {
  const out: Pt[] = [...(def.pads ?? [])];
  const clear = (x: number, y: number) => {
    if (x < 0.9 || x > def.w - 0.9 || y < 4 || y > def.h - 4.2) return false;
    for (const p of paths) if (nearestOnRoad(p, x, y).d < PAD_OFF - 0.2) return false;
    for (const q of out) if (Math.hypot(q.x - x, q.y - y) < PAD_GAP) return false;
    return true;
  };
  for (const p of paths) {
    let side = 1;
    for (let s = 3.2; s < p.len - 3; s += 1.6) {
      const a = pointAt(p, s);
      for (const sd of [side, -side]) {
        const x = a.x - a.dy * PAD_OFF * sd, y = a.y + a.dx * PAD_OFF * sd;
        if (clear(x, y)) { out.push({ x: +x.toFixed(2), y: +y.toFixed(2) }); side = -sd; break; }
      }
    }
  }
  return out;
}

const cache = new Map<string, TdMap>();
export function getMap(id: string): TdMap {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = MAP_DEFS.find((m) => m.id === id) ?? MAP_DEFS[0];
  const paths = def.roads.map((r) => smoothRoad(r));
  const pads: Pad[] = generatePads(def, paths).map((p, i) => {
    let best = nearestOnRoad(paths[0], p.x, p.y);
    for (const path of paths.slice(1)) { const n = nearestOnRoad(path, p.x, p.y); if (n.d < best.d) best = n; }
    return { id: i, x: p.x, y: p.y, rally: { x: best.x, y: best.y } };
  });
  const last = def.roads[0][def.roads[0].length - 1];
  const map: TdMap = {
    id: def.id, name: def.name, blurb: def.blurb, w: def.w, h: def.h, act: def.act, startGold: def.startGold,
    paths, pads, keep: { x: last.x, y: last.y }, gates: def.roads.map((r) => ({ ...r[0] })),
  };
  cache.set(id, map);
  return map;
}
