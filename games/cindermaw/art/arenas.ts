// Cindermaw's ten battlefields. The renderer lays each painted ground on its globe and stands real geometry on it
// (src/game/terrain.ts), so only the ground matters here: scorched rock, deck plate, ash, flesh, slime... Each is
// painted in colours the battle's 34-colour palette keeps (rust, iron, bone, char), mid-valued and calm so the two
// sides' green and red are the only saturated things on it. Lava, slime and blood stay thin or outside the zones.
import type { Ambient, ArenaArt, ArenaDef } from "../../../artkit/arena";
import { rgba, shade, type Painter } from "../../../artkit/paint";
import type { Model } from "../../../artkit/toon3d";
import { P } from "./parts";

const W = 9, H = 14, S0 = 5.9, S1 = 8.1;
const KEEPS: [number, number][] = [[4.5, 13.4], [4.5, 1.55]];
type Build = (m: Model) => void;

export interface Ground {
  name: string; obstacle: string;
  /** Base colour of the battlefield, and of the country outside it. */
  field: string; out: string;
  /** How the field is surfaced. */
  kind: "rock" | "plate" | "ash" | "flesh" | "marsh" | "grate" | "bone" | "tile" | "slab" | "obsidian";
  /** The hot or wet stuff: cracks, pools and glow (lava, slime, blood). */
  hot: string; hotGlow: string;
  /** The neutral strip and its kerb; the plaza under each keep. */
  strip: string; kerb: string; plaza: string;
  ambient: Ambient;
}

const motes = (kind: "drift" | "fall" | "rise" | "blink", n: number, colors: string[], size = 0.05): Ambient => ({ shade: 0, gust: null, motes: [{ kind, n, colors, size }], butterflies: 0, flock: null });

/** A wandering crack that glows: a dark trench, a hot core. */
function vein(p: Painter, x: number, y: number, len: number, hot: string, w = 0.07) {
  let a = p.rand(0, 7);
  const pts: [number, number][] = [[x, y]];
  for (let k = 0; k < len; k++) { a += p.rand(-0.8, 0.8); x += Math.cos(a) * 0.3; y += Math.sin(a) * 0.3; pts.push([x, y]); }
  p.line(pts, "#140806", w * 2.4, 0.8); p.line(pts, hot, w);
}
/** A pool with a dark bank. */
function pool(p: Painter, x: number, y: number, r: number, hot: string, glow: string) {
  const pts: [number, number][] = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, rr = r * p.rand(0.75, 1.1); pts.push([x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr * 0.85]); }
  p.poly(pts.map(([px, py]) => [x + (px - x) * 1.15, y + (py - y) * 1.15] as [number, number]), "#140806");
  p.poly(pts, hot);
  p.glow(x, y, r * 0.8, glow, 0.5, "lighter", r * 0.5);
}

function surface(p: Painter, d: Ground, x: number, y: number, w: number, h: number, base: string, inside: boolean) {
  p.rect(x, y, w, h, base);
  const lt = shade(base, 0.14), dk = shade(base, -0.2);
  switch (d.kind) {
    case "plate": p.slabs(x, y, w, h, [base, lt, shade(base, -0.07)], { sw: 1.5, sh: 1.0, joint: 0.05, jointColor: "#16181a", rivets: shade(base, 0.3) }); p.mottle(x, y, w, h, "#5a2a14", { alpha: 0.14, n: Math.round(w * h * 0.25) }); break;
    case "slab": p.slabs(x, y, w, h, [base, lt, shade(base, -0.06)], { sw: 2.25, sh: 2.0, joint: 0.07, jointColor: "#1c1612", bond: 0 }); p.mottle(x, y, w, h, "#1c1612", { alpha: 0.12 }); break;
    case "tile": p.slabs(x, y, w, h, [base, dk, lt], { sw: 0.75, sh: 0.75, joint: 0.045, jointColor: "#120a08", bond: 0 }); break;
    case "grate": p.rect(x, y, w, h, "#1c1210"); for (let yy = y; yy < y + h; yy += 0.5) for (let xx = x; xx < x + w; xx += 0.5) { p.rect(xx + 0.05, yy + 0.05, 0.4, 0.4, p.r() < 0.2 ? lt : base); p.rect(xx + 0.14, yy + 0.14, 0.22, 0.22, dk); } break;
    case "bone": p.cobbles(x, y, w, h, [base, shade(base, 0.06), shade(base, -0.08)], { size: 0.34, gap: shade(base, -0.24), aspect: 1.5, edge: 0.008 }); break;
    default:
      p.mottle(x, y, w, h, dk, { alpha: 0.4, n: Math.round(w * h * 0.5), size: [0.3, 1.2] });
      p.mottle(x, y, w, h, lt, { alpha: 0.3, n: Math.round(w * h * 0.4), size: [0.2, 0.8] });
      if (d.kind === "flesh") for (let i = 0; i < w * h * 0.12; i++) { const px = x + p.r() * w, py = y + p.r() * h; p.line([[px, py], [px + p.rand(-0.6, 0.6), py + p.rand(-0.6, 0.6)], [px + p.rand(-1, 1), py + p.rand(-1, 1)]], shade(base, -0.34), 0.05, 0.7); }
      else p.cracks(x, y, w, h, Math.round(w * h * (d.kind === "ash" ? 0.08 : 0.25)), rgba("#0a0605", 0.5), 0.035);
  }
  if (!inside) p.wash(x, y, w, h, "rgba(0,0,0,0.22)", "rgba(0,0,0,0.22)");
}

function ground(d: Ground): ArenaDef {
  return {
    name: d.name, edge: shade(d.out, -0.5), obstacle: d.obstacle, ambient: d.ambient,
    ground(p) {
      surface(p, d, -8, -17, 25, 38, d.out, false);
      // hot stuff outside the board: pools and long veins
      for (const [x, y, r] of [[-3.4, 3, 1.3], [12.2, 9, 1.5], [-4, 11, 1.2], [12, -2, 1.3], [-4.5, -6, 1.6], [6, -8, 1.8], [13, -9, 1.4], [-2.6, 17.5, 1.4], [11.5, 17, 1.2]]) pool(p, x, y, r, d.hot, d.hotGlow);
      for (let i = 0; i < 26; i++) { const x = p.rand(-8, 17), y = p.rand(-17, 21); if (x > -1 && x < W + 1 && y > -1 && y < H + 1) continue; vein(p, x, y, 8, d.hot); }
      // the battlefield, with a dark trench round it
      p.rect(-0.7, -0.7, W + 1.4, H + 1.4, "#140a08");
      surface(p, d, -0.55, -0.55, W + 1.1, H + 1.1, d.field, true);
      // a few thin veins in each deploy zone (never in the lanes' middle)
      for (const [y0, y1] of [[0.4, 5], [9, 13.6]]) for (const x of [0.9, 8.1, 2.4, 6.6]) vein(p, x + p.rand(-0.3, 0.3), p.rand(y0, y1), 4, d.hot, 0.05);
      // the neutral strip: its own paving, a hazard kerb on each zone line
      p.rect(-8, S0, 25, S1 - S0, d.strip);
      p.slabs(-8, S0, 25, S1 - S0, [d.strip, shade(d.strip, 0.1), shade(d.strip, -0.1)], { sw: 1.1, sh: (S1 - S0) / 3, joint: 0.045, jointColor: "#120c0a" });
      for (const y of [S0, S1]) {
        p.rect(-8, y - 0.14, 25, 0.28, "#16120e");
        for (let x = -8; x < 17; x += 0.5) p.poly([[x, y - 0.1], [x + 0.25, y - 0.1], [x + 0.37, y + 0.1], [x + 0.12, y + 0.1]], d.kerb);
      }
      // a plate under each keep, bolted down, with a ring
      for (const [kx, ky] of KEEPS) {
        p.round(kx - 1.9, ky - 1.55, 3.8, 3.1, 0.2, "#140a08");
        p.slabs(kx - 1.75, ky - 1.4, 3.5, 2.8, [d.plaza, shade(d.plaza, 0.1), shade(d.plaza, -0.1)], { sw: 0.875, sh: 0.7, joint: 0.045, jointColor: "#120c0a", rivets: shade(d.plaza, 0.35) });
        p.circle(kx, ky, 1.15, rgba("#000000", 0), 0.1);
        p.g.strokeStyle = d.kerb; p.g.lineWidth = 0.09; p.g.beginPath(); p.g.arc(kx, ky, 1.2, 0, 7); p.g.stroke();
      }
      // heat over everything outside, a vignette on the country
      p.wash(-8, -17, 25, 8, rgba(d.hotGlow, 0.22), rgba(d.hotGlow, 0), "lighter");
    },
    scenery() { /* the world's geometry stands the scenery: src/game/terrain.ts */ },
    props: PROPS,
  };
}

// obstacle props (base fills the unit circle)
const bonePile: Build = (m) => { for (const [x, y, z, s] of [[0, 0, 0.3, 0.55], [0.5, 0.3, 0.2, 0.38], [-0.5, 0.2, 0.2, 0.4], [0.1, -0.5, 0.18, 0.36], [-0.3, -0.4, 0.5, 0.3]]) m.ellipsoid([x, y, z], [s, s * 0.9, s * 0.8], P.bone, { segs: 7 }); for (const a of [0.4, 2.2, 4.1]) m.cylinder([Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.5], [Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.9], 0.06, P.boneDk, 0.05, { segs: 5 }); };
const crate: Build = (m) => { m.box([0, 0, 0.6], [1.5, 1.5, 1.2], P.ironDk); m.decal(0.02, () => { for (const z of [0.25, 0.95]) m.box([0, 0, z], [1.52, 1.52, 0.2], P.hazard); }); m.box([0.2, -0.1, 1.5], [0.9, 0.9, 0.6], P.rust); };
const spikes: Build = (m) => { m.cylinder([0, 0, 0], [0, 0, 0.25], 1.0, P.char, 0.9, { segs: 10 }); for (const [x, y, hh] of [[0, 0, 2.0], [0.5, 0.3, 1.3], [-0.45, 0.35, 1.5], [0.2, -0.5, 1.1], [-0.4, -0.4, 1.2]]) m.cone([x, y, 0.2], [x * 1.2, y * 1.2, hh], 0.22, P.boneDk, { segs: 5 }); };
export const PROPS: Build[] = [bonePile, crate, spikes];

const EMBERS = motes("rise", 16, ["#ff7a1c", "#ffb020"], 0.045), ASH = motes("fall", 22, ["#8f7a66", "#6b5348"], 0.05), SPORES = motes("drift", 14, ["#b8e03a", "#7aa024"], 0.045), BLINK = motes("blink", 10, ["#ff7a1c", "#e03a10"], 0.05);

export const GROUNDS: Ground[] = [
  { name: "Scorched Rock", obstacle: "rock", kind: "rock", field: "#5e4234", out: "#4a3026", hot: "#ff7a1c", hotGlow: "#e03a10", strip: "#4a3830", kerb: "#c08a40", plaza: "#5d646a", ambient: EMBERS },
  { name: "Deck Plating", obstacle: "crate", kind: "plate", field: "#5d646a", out: "#3a3f44", hot: "#ff7a1c", hotGlow: "#e03a10", strip: "#3a3f44", kerb: "#ffb020", plaza: "#6b5348", ambient: BLINK },
  { name: "Ash Wastes", obstacle: "bone", kind: "ash", field: "#7a6658", out: "#5a4a40", hot: "#2a1c14", hotGlow: "#8a1c12", strip: "#4a3830", kerb: "#b8a488", plaza: "#5d646a", ambient: ASH },
  { name: "Flesh Floor", obstacle: "bone", kind: "flesh", field: "#7a4a3e", out: "#5a2e28", hot: "#3a1410", hotGlow: "#b3170d", strip: "#3d2c26", kerb: "#b8a488", plaza: "#6b5348", ambient: EMBERS },
  { name: "Slime Marsh", obstacle: "stump", kind: "marsh", field: "#4e4a34", out: "#343822", hot: "#7aa024", hotGlow: "#b8e03a", strip: "#3a3f44", kerb: "#c08a40", plaza: "#5d646a", ambient: SPORES },
  { name: "Slag Foundry", obstacle: "crate", kind: "grate", field: "#4c5054", out: "#3a2a24", hot: "#ffb020", hotGlow: "#ff7a1c", strip: "#2a2c30", kerb: "#ffb020", plaza: "#6b5348", ambient: EMBERS },
  { name: "Bone Yard", obstacle: "bone", kind: "bone", field: "#7a6c5a", out: "#5a4a3c", hot: "#3a1410", hotGlow: "#8a1c12", strip: "#4a3830", kerb: "#e0d4b8", plaza: "#5d646a", ambient: ASH },
  { name: "Blood Cistern", obstacle: "pillar", kind: "tile", field: "#5e5650", out: "#3a2c28", hot: "#8a1c12", hotGlow: "#b3170d", strip: "#3d2c26", kerb: "#b8a488", plaza: "#4a3830", ambient: BLINK },
  { name: "Hazard Depot", obstacle: "crate", kind: "slab", field: "#6e675c", out: "#4a443c", hot: "#7aa024", hotGlow: "#b8e03a", strip: "#3a3f44", kerb: "#ffb020", plaza: "#5d646a", ambient: SPORES },
  { name: "The Maw", obstacle: "spike", kind: "obsidian", field: "#3e3234", out: "#241a1a", hot: "#ff7a1c", hotGlow: "#e03a10", strip: "#5a1c14", kerb: "#e0d4b8", plaza: "#4a3830", ambient: EMBERS },
];
export const ARENAS: ArenaArt = { acts: GROUNDS.map(ground) };
