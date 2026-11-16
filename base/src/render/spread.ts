// Render-only crowd spacing. Atlas sprites draw larger than their collision circles (units.spriteVis), so bodies the
// sim packs shoulder to shoulder (a Blade Trio, a front line on a keep) merge into one blob on a phone. This nudges
// same-side ground bodies apart on screen by a small, capped amount; the sim and its positions are untouched.
// Pure maths, no DOM: tested in tests/spread.test.ts.

export interface SpreadBody { id: number; x: number; y: number; /** collision radius, world units */ r: number; side: number; /** draw scale over r */ vis: number; }

/** How close two drawn figures may stand, as a share of their drawn radii summed (above 1 leaves room for swords and shields that reach past the body). */
export const SPREAD_GAP = 1.15;
/** The largest nudge any one body gets, in world units (keeps hits and projectiles visually on their target). */
export const SPREAD_MAX = 0.2;

/** Offset per body id (world units) that pushes overlapping same-side figures apart. Deterministic for a given input. */
export function spreadOffsets(bodies: readonly SpreadBody[], gap = SPREAD_GAP, max = SPREAD_MAX, passes = 3): Map<number, [number, number]> {
  const n = bodies.length;
  const ox = new Float64Array(n), oy = new Float64Array(n);
  for (let pass = 0; pass < passes; pass++) {
    const px = new Float64Array(n), py = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (a.side !== b.side) continue;
        const want = (a.r * a.vis + b.r * b.vis) * gap;
        let dx = b.x + ox[j] - (a.x + ox[i]), dy = b.y + oy[j] - (a.y + oy[i]);
        let d = Math.hypot(dx, dy);
        if (d >= want) continue;
        if (d < 1e-6) {
          // Exactly stacked: split along a direction fixed by the ids so it never flickers.
          const ang = ((a.id * 7 + b.id * 13) % 16) * (Math.PI / 8);
          dx = Math.cos(ang); dy = Math.sin(ang); d = 1;
        }
        // Each moves half the overlap; the bigger body gives way less.
        const push = (want - d) / d / 2, wa = b.r / (a.r + b.r), wb = a.r / (a.r + b.r);
        px[i] -= dx * push * wa * 2; py[i] -= dy * push * wa * 2;
        px[j] += dx * push * wb * 2; py[j] += dy * push * wb * 2;
      }
    }
    for (let i = 0; i < n; i++) {
      ox[i] += px[i] / passes * 1.5; oy[i] += py[i] / passes * 1.5;
      const m = Math.hypot(ox[i], oy[i]);
      if (m > max) { ox[i] *= max / m; oy[i] *= max / m; }
    }
  }
  const out = new Map<number, [number, number]>();
  for (let i = 0; i < n; i++) if (ox[i] || oy[i]) out.set(bodies[i].id, [ox[i], oy[i]]);
  return out;
}
