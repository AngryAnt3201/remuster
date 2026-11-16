// Inkfall's ten battlefields: ten sheets of the same scroll. Each is mostly bare paper: a faint wash for the field,
// a brushed road between the halls, a band across the middle (a stream, raked gravel, a boardwalk, a causeway), a
// brushed ring under each hall, misty mountains painted flat beyond the far edge and a few things standing at the
// sides. The whole backdrop fades into mist at the top.
import type { ArenaArt, ArenaDef } from "../../../artkit/arena";
import type { Painter, Pt } from "../../../artkit/paint";
import { rgba } from "../../../artkit/paint";
import type { Model } from "../../../artkit/toon3d";
import { TONE, blob, blossom, dabs, dry, enso, line, mist, mountains, paper, pool, stroke, tuft, wash } from "./ink";
import { S, bales, bamboo, bridge, cloudBank, crag, drum, fence, house, jar, kiln, lotus, pagoda, pine, plum, postLantern, reeds, rock, stoneLantern, torii, wall } from "./scenery";
import { PAPER } from "./style";

const W = 9, H = 14, STRIP0 = 5.9, STRIP1 = 8.1;
const KEEPS: Pt[] = [[4.5, 13.4], [4.5, 1.55]];
type Build = (m: Model) => void;
type Strip = "stream" | "gravel" | "planks" | "flags" | "snow" | "cloud" | "sand" | "court";

export interface Scene {
  name: string; obstacle: string;
  /** The field's wash (colour, strength) and the colour of the marks scattered on and round it. */
  field: [string, number]; marks: string; mark: "tuft" | "dabs" | "both";
  /** The far mountains: colour and strength. */
  peaks: [string, number];
  strip: Strip;
  /** Extra painting outside the board (ponds, paddies, drifts). */
  extra?(p: Painter): void;
  side: Build[]; far: Build[]; scatter: Build[]; props: Build[];
  /** How thickly the sides are planted (0..1). */
  dense?: number;
  ambient?: ArenaDef["ambient"];
}
export const SCENES: Scene[] = [];

const onBoard = (x: number, y: number, pad = 0.6) => x > -pad && x < W + pad && y > -pad && y < H + pad;

/** The band across the middle of the field, right across the sheet. */
function paintStrip(p: Painter, kind: Strip) {
  const y0 = STRIP0, y1 = STRIP1, mid = (y0 + y1) / 2;
  const band = (color: string, a: number) => wash(p, [[-8.5, y0 + 0.06], [17.5, y0 + 0.06], [17.5, y1 - 0.06], [-8.5, y1 - 0.06]], color, a, { bleed: 0.1, rim: 0.3, smooth: false });
  if (kind === "stream") {
    band("#7f9a9c", 0.34);
    for (let i = 0; i < 70; i++) { const x = p.rand(-8, 17), y = p.rand(y0 + 0.25, y1 - 0.25), l = p.rand(0.3, 1.0); line(p, [[x, y], [x + l * 0.5, y - 0.04], [x + l, y]], 0.025, "#f9f4e6", 0.75); }
    for (let x = 0.5; x < W; x += 1.14) pool(p, x + p.rand(-0.1, 0.1), mid + p.rand(-0.3, 0.3), 0.3, 0.2, TONE.mid, 0.55, { bleed: 0.03, rim: 0.9 });
  } else if (kind === "gravel") {
    band(TONE.pale, 0.2);
    for (let y = y0 + 0.24; y < y1 - 0.1; y += 0.22) dry(p, [-8, y], [17, y + p.rand(-0.03, 0.03)], 0.05, TONE.mid, 0.4, 3);
  } else if (kind === "planks") {
    band(TONE.tea, 0.3);
    for (let x = -8; x < 17; x += 0.46) line(p, [[x, y0 + 0.1], [x + p.rand(-0.02, 0.02), y1 - 0.1]], 0.025, TONE.wet, 0.35);
  } else if (kind === "flags") {
    band(TONE.pale, 0.26);
    let row = 0;
    for (let y = y0 + 0.08; y < y1 - 0.2; y += 0.68, row++) { line(p, [[-8, y + 0.66], [17, y + 0.66]], 0.02, TONE.wet, 0.3); for (let x = -8 + (row % 2) * 0.55; x < 17; x += 1.1) line(p, [[x, y + 0.04], [x, y + 0.64]], 0.02, TONE.wet, 0.3); }
  } else if (kind === "snow") {
    band("#fffdf6", 0.75);
    for (let i = 0; i < 26; i++) pool(p, p.rand(-8, 17), p.rand(y0 + 0.3, y1 - 0.3), p.rand(0.3, 0.8), 0.14, "#9db0b8", 0.16, { bleed: 0.1, rim: 0 });
  } else if (kind === "cloud") {
    band("#fffdf6", 0.7);
    for (let x = -8; x < 17; x += 0.9) for (const y of [y0 + 0.1, y1 - 0.1]) pool(p, x + p.rand(-0.2, 0.2), y, 0.6, 0.26, "#fffdf6", 0.9, { bleed: 0.12, rim: 0 });
    for (let i = 0; i < 16; i++) { const x = p.rand(-8, 16), y = p.rand(y0 + 0.5, y1 - 0.5); line(p, [[x, y], [x + 0.4, y - 0.12], [x + 0.8, y], [x + 1.1, y - 0.1]], 0.025, TONE.pale, 0.6); }
  } else if (kind === "sand") {
    band(TONE.teaLt, 0.36);
    for (let i = 0; i < 40; i++) { const x = p.rand(-8, 16), y = p.rand(y0 + 0.3, y1 - 0.3); line(p, [[x, y], [x + 0.5, y + 0.05], [x + 1, y - 0.02]], 0.02, TONE.tea, 0.4); }
  } else {
    band(TONE.pale, 0.3);
    for (let x = -8; x < 17; x += 0.75) { line(p, [[x, y0 + 0.1], [x, y1 - 0.1]], 0.02, TONE.wet, 0.26); pool(p, x + 0.375, mid, 0.14, 0.14, TONE.mid, 0.3, { bleed: 0.02, rim: 0.9 }); }
  }
  // a kerb on each zone line: a dry brush stroke, heavy across the board, faint beyond it
  for (const y of [y0, y1]) { dry(p, [-8, y], [17, y], 0.05, TONE.mid, 0.35, 3); dry(p, [-0.5, y], [W + 0.5, y], 0.11, TONE.ink, 0.72, 6); }
}

function scene(d: Scene): ArenaDef {
  SCENES.push(d);
  return {
    name: d.name, edge: PAPER, obstacle: d.obstacle, ambient: d.ambient, props: d.props,
    ground(p) {
      paper(p, -8, -17, 25, 38, 1);
      // mountains beyond the far edge, painted flat like the top of a scroll
      mountains(p, -8, 17, -5.6, 7.5, d.peaks[0], d.peaks[1] * 0.55, { peaks: 4, mist: 0.9 });
      mist(p, -8, 17, -5.4, 1.6, 0.85);
      mountains(p, -8, 17, -1.7, 4.6, d.peaks[0], d.peaks[1], { peaks: 6, mist: 0.82 });
      mist(p, -8, 17, -1.5, 1.0, 0.9);
      d.extra?.(p);
      // the field: one faint wash with a wet edge, so the board reads as a place on the sheet
      wash(p, [[-0.42, -0.42], [W + 0.42, -0.42], [W + 0.42, H + 0.42], [-0.42, H + 0.42]], d.field[0], d.field[1], { bleed: 0.3, rim: 0.5, smooth: false });
      // the road from hall to hall
      wash(p, [[3.85, -2.4], [5.15, -2.4], [5.2, 17], [3.8, 17]], TONE.teaLt, 0.34, { bleed: 0.14, rim: 0.2, smooth: false });
      for (const x of [3.82, 5.18]) dry(p, [x, -1.6], [x + p.rand(-0.03, 0.03), 16.6], 0.07, TONE.mid, 0.34, 4);
      paintStrip(p, d.strip);
      // a brushed ring under each hall
      for (const [kx, ky] of KEEPS) { pool(p, kx, ky, 1.8, 1.42, PAPER, 0.85, { bleed: 0.16, rim: 0 }); pool(p, kx, ky, 1.66, 1.3, TONE.teaLt, 0.3, { bleed: 0.1, rim: 0.4, jitter: 0.05 }); enso(p, kx, ky, 1.72, 1.34, 0.17, TONE.ink, 0.62, p.rand(0, 6)); }
      // marks: sparse on the field (it stays calm under the armies), thicker outside it
      const mk = (x: number, y: number, a: number) => { const t = d.mark === "both" ? p.r() < 0.5 : d.mark === "tuft"; t ? tuft(p, x, y, p.rand(0.14, 0.24), d.marks, a) : dabs(p, x, y, p.rand(0.1, 0.18), d.marks, a); };
      p.scatter(0, 0, W, H, 34, (x, y) => mk(x, y, 0.3), (x, y) => Math.abs(x - 4.5) > 0.9 && (y < STRIP0 - 0.3 || y > STRIP1 + 0.3) && KEEPS.every(([kx, ky]) => Math.hypot(x - kx, y - ky) > 2));
      p.scatter(-8, -4, 25, 25, 190, (x, y) => mk(x, y, 0.5), (x, y) => !onBoard(x, y, 0.7) && Math.abs(x - 4.5) > 0.9 && (y < STRIP0 - 0.3 || y > STRIP1 + 0.3));
    },
    scenery(add, r) {
      const pick = (l: Build[]) => l[Math.floor(r() * l.length) % l.length], dense = d.dense ?? 0.6;
      // down each side, with gaps: paper is part of the picture
      for (const x of [-1.25, W + 1.25]) for (let y = 0.2; y < H + 1; y += 1.3) {
        if (y > STRIP0 - 0.7 && y < STRIP1 + 0.7) continue;
        if (r() > dense) continue;
        add({ build: pick(d.side), x: x + (r() - 0.5) * 0.5, y: y + (r() - 0.5) * 0.4, yaw: 60 + r() * 60, shadow: 0.5 });
      }
      // the far end, either side of the road
      d.far.forEach((b, i) => { const n = d.far.length, x = -2.4 + (i / Math.max(1, n - 1)) * (W + 4.8); if (Math.abs(x - 4.5) > 1.4) add({ build: b, x, y: -1.7 - (i % 2) * 0.6, yaw: 90, shadow: 0.7 }); });
      // and the rest of the sheet, for wide screens
      for (let i = 0; i < 46; i++) {
        const x = -7.5 + r() * 24, y = -3.6 + r() * 23;
        if (x > -2.4 && x < W + 2.4 && y > -3 && y < H + 2) continue;
        if (Math.abs(x - 4.5) < 1.4 || (y > STRIP0 - 0.6 && y < STRIP1 + 0.6)) continue;
        add({ build: pick(d.scatter), x, y, yaw: 60 + r() * 60, shadow: 0.5 });
      }
    },
    grade(g, w, h) {
      // the top of the sheet is lost in mist
      const gr = g.createLinearGradient(0, 0, 0, h * 0.2);
      gr.addColorStop(0, rgba(PAPER, 0.96)); gr.addColorStop(0.5, rgba(PAPER, 0.5)); gr.addColorStop(1, rgba(PAPER, 0));
      g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.2);
    },
  };
}

// ------------------------------------------------------------------------------------------------ things painted outside the board
/** A koi pond: a pale water wash with a dark rim, ripples and a few fish. */
export function koiPond(p: Painter, x: number, y: number, rx: number, ry: number, u = 1) {
  pool(p, x, y, rx, ry, "#7f9a9c", 0.4, { bleed: 0.12 * u, rim: 0.8 });
  for (let i = 0; i < 4; i++) { const a = p.r() * 6, d = p.rand(0.1, 0.6); const cx = x + Math.cos(a) * rx * d, cy = y + Math.sin(a) * ry * d; p.g.save(); p.g.globalAlpha = 0.4; p.g.strokeStyle = "#f9f4e6"; p.g.lineWidth = 0.03 * u; p.g.beginPath(); p.g.ellipse(cx, cy, rx * 0.2, ry * 0.14, 0, 0, Math.PI * 2); p.g.stroke(); p.g.restore(); }
  for (let i = 0; i < 5; i++) {
    const a = p.r() * 6, d = p.rand(0.15, 0.6), cx = x + Math.cos(a) * rx * d, cy = y + Math.sin(a) * ry * d, dir = p.r() * 6, s = 0.2 * u * p.rand(0.8, 1.3);
    const col = i % 3 === 0 ? TONE.ink : i % 3 === 1 ? "#f9f4e6" : TONE.tea;
    stroke(p, [[cx, cy], [cx + Math.cos(dir) * s * 0.5, cy + Math.sin(dir) * s * 0.5 + 0.02 * u], [cx + Math.cos(dir) * s, cy + Math.sin(dir) * s]], s * 0.36, col, 0.85, { taper: 0.9, dry: 0, lead: 0.3 });
  }
}
/** Flooded rice paddies: a patchwork of water washes between low banks, rows of seedlings. */
function paddies(p: Painter, x0: number, y0: number, cols: number, rows: number, cw = 2.1, ch = 1.5) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + c * cw + (r % 2) * 0.3, y = y0 + r * ch;
    if (onBoard(x + cw / 2, y + ch / 2, 1.6)) continue;
    wash(p, blob(p, x + cw / 2, y + ch / 2, cw * 0.47, ch * 0.42, 10, 0.08), "#8fa5a2", 0.26, { bleed: 0.08, rim: 0.9 });
    for (let yy = y + 0.35; yy < y + ch - 0.25; yy += 0.3) for (let xx = x + 0.35; xx < x + cw - 0.3; xx += 0.3) tuft(p, xx, yy, 0.1, TONE.moss, 0.7, 2);
  }
}
const drifts = (col: string, a: number) => (p: Painter) => { for (let i = 0; i < 40; i++) { const x = p.rand(-8, 17), y = p.rand(-3, 20); if (onBoard(x, y, 1.4)) continue; pool(p, x, y, p.rand(0.8, 2.2), p.rand(0.4, 0.9), col, a, { bleed: 0.3, rim: 0 }); } };
const ponds = (spots: [number, number, number, number][]) => (p: Painter) => { for (const [x, y, rx, ry] of spots) koiPond(p, x, y, rx, ry); };
const petalsOnGround = (p: Painter) => { for (let i = 0; i < 90; i++) { const x = p.rand(-6, 15), y = p.rand(-2, 18); if (onBoard(x, y, 0.2) && p.r() < 0.6) continue; blossom(p, x, y, p.rand(0.06, 0.11), i % 3 ? TONE.petal : "#f6d2ca", 0.8); } };

const none: NonNullable<ArenaDef["ambient"]> = { shade: 0.25, gust: null, motes: [], butterflies: 0, flock: null };
const petals = (n: number, colors = ["#eeb0a4", "#f6d2ca", "#fffaf0"]): NonNullable<ArenaDef["ambient"]> => ({ ...none, motes: [{ kind: "fall", n, colors, size: 0.05, leaf: true }] });
const cranes = { n: 3, color: "#2a2622" };

export const ARENAS: ArenaArt = {
  team: { main: "#6f6a62", dark: "#3b3833", light: "#cfc8b8" },
  acts: [
    scene({
      name: "Rice Terraces", obstacle: "rock", field: [TONE.moss, 0.2], marks: TONE.wet, mark: "tuft", peaks: [TONE.wet, 0.6], strip: "stream",
      extra: (p) => { paddies(p, -8, 0.4, 3, 9); paddies(p, 10.9, 0.2, 3, 9); },
      side: [(m) => pine(m, 0.9), (m) => rock(m, 0.7), (m) => stoneLantern(m, 0.85)], far: [(m) => house(m, 1.1), (m) => pine(m, 1.3), (m) => torii(m, 1.0), (m) => torii(m, 1.0), (m) => pine(m, 1.2), (m) => house(m, 1.1)],
      scatter: [(m) => pine(m, 1.1), (m) => house(m, 1), (m) => rock(m, 0.8)], dense: 0.45,
      props: [(m) => rock(m, 1.5), (m) => stoneLantern(m, 1.5), (m) => bales(m, 1.3)],
      ambient: { ...petals(8), flock: cranes },
    }),
    scene({
      name: "Kiln Fields", obstacle: "jar", field: [TONE.tea, 0.2], marks: TONE.wet, mark: "dabs", peaks: [TONE.wet, 0.7], strip: "flags",
      extra: drifts(TONE.mid, 0.09),
      side: [(m) => jar(m, 0.8), (m) => kiln(m, 0.8), (m) => jar(m, 0.6, S.stoneDk)], far: [(m) => kiln(m, 1.3), (m) => house(m, 1.1, S.thatchDk), (m) => kiln(m, 1.1), (m) => kiln(m, 1.1), (m) => pine(m, 1.2, S.needleDk), (m) => kiln(m, 1.3)],
      scatter: [(m) => kiln(m, 1), (m) => jar(m, 0.9), (m) => pine(m, 1, S.needleDk)], dense: 0.55,
      props: [(m) => jar(m, 1.5), (m) => kiln(m, 1.25), (m) => rock(m, 1.5, S.stoneDk, S.trunkLt)],
      ambient: { ...none, motes: [{ kind: "rise", n: 10, colors: ["#6f6a62", "#3b3833"], size: 0.035 }, { kind: "rise", n: 5, colors: ["#d9793c"], size: 0.028 }] },
    }),
    scene({
      name: "Bamboo Deep", obstacle: "bamboo", field: ["#7d8f70", 0.22], marks: "#55684f", mark: "tuft", peaks: ["#55684f", 0.5], strip: "planks",
      side: [(m) => bamboo(m, 1), (m) => bamboo(m, 1.15, 5), (m) => bamboo(m, 0.85, 3)], far: [(m) => bamboo(m, 1.4, 5), (m) => bamboo(m, 1.25), (m) => stoneLantern(m, 1.1), (m) => stoneLantern(m, 1.1), (m) => bamboo(m, 1.3, 5), (m) => bamboo(m, 1.4)],
      scatter: [(m) => bamboo(m, 1.2, 5), (m) => bamboo(m, 1), (m) => rock(m, 0.8, S.stone, S.stoneDk, S.lotus)], dense: 0.9,
      props: [(m) => bamboo(m, 1.1, 6), (m) => rock(m, 1.5, S.stone, S.stoneDk, S.lotus), (m) => stoneLantern(m, 1.5)],
      ambient: { ...none, motes: [{ kind: "fall", n: 10, colors: ["#7d8f70", "#55684f"], size: 0.05, leaf: true }] },
    }),
    scene({
      name: "Granite Pass", obstacle: "crag", field: [TONE.mid, 0.2], marks: TONE.wet, mark: "dabs", peaks: [TONE.ink, 0.8], strip: "gravel",
      extra: drifts(TONE.pale, 0.12),
      side: [(m) => crag(m, 0.9), (m) => rock(m, 0.9), (m) => pine(m, 0.8, S.needleDk, null, 0.4)], far: [(m) => crag(m, 1.6), (m) => crag(m, 1.2), (m) => pine(m, 1.2, S.needleDk, null, 0.4), (m) => crag(m, 1.3), (m) => crag(m, 1.7), (m) => rock(m, 1.4)],
      scatter: [(m) => crag(m, 1.2), (m) => rock(m, 1.1), (m) => pine(m, 1, S.needleDk, null, 0.4)], dense: 0.7,
      props: [(m) => crag(m, 1.15), (m) => rock(m, 1.5), (m) => pine(m, 0.95, S.needleDk, null, 0.4)],
      ambient: { ...none, shade: 0.4, motes: [{ kind: "drift", n: 10, colors: ["#cfc8b8", "#a9a397"], size: 0.03 }], flock: { n: 2, color: "#2a2622" } },
    }),
    scene({
      name: "Cloud Temple", obstacle: "lantern", field: [TONE.pale, 0.24], marks: TONE.mid, mark: "dabs", peaks: [TONE.wet, 0.55], strip: "court",
      extra: (p) => { ponds([[-3.2, 10.6, 1.7, 1.1], [12.4, 3.4, 1.7, 1.1]])(p); petalsOnGround(p); },
      side: [(m) => plum(m, 0.95), (m) => stoneLantern(m, 0.9), (m) => wall(m, 1.5, 0.9)], far: [(m) => pagoda(m, 1.05, 3), (m) => plum(m, 1.2), (m) => wall(m, 2.2, 1), (m) => wall(m, 2.2, 1), (m) => plum(m, 1.2), (m) => pagoda(m, 1.2, 4)],
      scatter: [(m) => plum(m, 1.1), (m) => pagoda(m, 0.9, 2), (m) => pine(m, 1)], dense: 0.6,
      props: [(m) => stoneLantern(m, 1.5), (m) => plum(m, 1.0), (m) => drum(m, 1.25)],
      ambient: { ...petals(16), flock: cranes },
    }),
    scene({
      name: "Snow Country", obstacle: "snowrock", field: ["#9db0b8", 0.2], marks: TONE.mid, mark: "dabs", peaks: [TONE.mid, 0.55], strip: "snow",
      extra: drifts("#fffdf6", 0.7),
      side: [(m) => pine(m, 0.95, S.needle, S.snow), (m) => pine(m, 1.1, S.needle, S.snow), (m) => rock(m, 0.8, S.stone, S.stoneDk, S.snow)], far: [(m) => pine(m, 1.4, S.needle, S.snow), (m) => house(m, 1.15, S.thatchDk, S.snow), (m) => pine(m, 1.2, S.needle, S.snow), (m) => stoneLantern(m, 1.1, S.lampLit, S.snow), (m) => pine(m, 1.3, S.needle, S.snow), (m) => house(m, 1.1, S.thatchDk, S.snow)],
      scatter: [(m) => pine(m, 1.2, S.needle, S.snow), (m) => rock(m, 0.9, S.stone, S.stoneDk, S.snow), (m) => house(m, 1, S.thatchDk, S.snow)], dense: 0.6,
      props: [(m) => rock(m, 1.5, S.stone, S.stoneDk, S.snow), (m) => pine(m, 0.95, S.needle, S.snow), (m) => stoneLantern(m, 1.5, S.lampLit, S.snow)],
      ambient: { ...none, motes: [{ kind: "fall", n: 34, colors: ["#fffdf6", "#b9c4c8"], size: 0.036 }] },
    }),
    scene({
      name: "Heaven's Stair", obstacle: "cloud", field: ["#fffdf6", 0.5], marks: TONE.pale, mark: "dabs", peaks: [TONE.mid, 0.4], strip: "cloud",
      extra: drifts("#fffdf6", 0.8),
      side: [(m) => cloudBank(m, 0.9), (m) => postLantern(m, 1), (m) => cloudBank(m, 0.7)], far: [(m) => pagoda(m, 1.2, 4), (m) => cloudBank(m, 1.5), (m) => torii(m, 1.1), (m) => torii(m, 1.1), (m) => cloudBank(m, 1.5), (m) => pagoda(m, 1.0, 3)],
      scatter: [(m) => cloudBank(m, 1.3), (m) => cloudBank(m, 1), (m) => crag(m, 1.2)], dense: 0.7,
      props: [(m) => postLantern(m, 1.3), (m) => cloudBank(m, 1.2), (m) => crag(m, 1.1)],
      ambient: { ...none, shade: 0.5, motes: [{ kind: "drift", n: 10, colors: ["#fffdf6"], size: 0.05 }], flock: { n: 5, color: "#2a2622" } },
    }),
    scene({
      name: "Lotus Marsh", obstacle: "reeds", field: ["#7f9a8c", 0.24], marks: "#55684f", mark: "tuft", peaks: ["#55684f", 0.45], strip: "planks",
      extra: (p) => { for (let i = 0; i < 16; i++) { const x = p.rand(-7.5, 16.5), y = p.rand(-2, 19); if (onBoard(x, y, 2.2) || Math.abs(x - 4.5) < 1.6 || (y > 4.6 && y < 9.4)) continue; koiPond(p, x, y, p.rand(1.1, 2.1), p.rand(0.7, 1.2)); } },
      side: [(m) => reeds(m, 1.1), (m) => lotus(m, 1), (m) => reeds(m, 0.9)], far: [(m) => reeds(m, 1.5), (m) => bridge(m, 1.2), (m) => reeds(m, 1.3), (m) => postLantern(m, 1.1), (m) => house(m, 1.05), (m) => reeds(m, 1.5)],
      scatter: [(m) => reeds(m, 1.3), (m) => lotus(m, 1.2), (m) => bamboo(m, 0.9, 3)], dense: 0.75,
      props: [(m) => reeds(m, 1.5), (m) => lotus(m, 1.6), (m) => postLantern(m, 1.3)],
      ambient: { ...none, motes: [{ kind: "blink", n: 14, colors: ["#b8a257", "#8a9a78"], size: 0.035 }, { kind: "drift", n: 6, colors: ["#cfc8b8"], size: 0.04 }] },
    }),
    scene({
      name: "Pine Shore", obstacle: "pine", field: [TONE.teaLt, 0.3], marks: TONE.mid, mark: "both", peaks: [TONE.indigo, 0.4], strip: "sand",
      extra: (p) => {
        // the sea down the right-hand side: a pale wash with wave strokes and a foam line
        wash(p, [[12.6, -4], [17.5, -4], [17.5, 21], [13.4, 21], [12.8, 14], [13.6, 8], [12.4, 2]], "#6f8e9c", 0.34, { bleed: 0.2, rim: 0.7 });
        for (let i = 0; i < 46; i++) { const x = p.rand(13.4, 16.6), y = p.rand(-3, 20); line(p, [[x, y], [x + 0.3, y - 0.1], [x + 0.6, y], [x + 0.9, y - 0.08]], 0.03, "#f9f4e6", 0.8); }
      },
      side: [(m) => pine(m, 1.0, S.needle, null, 0.5), (m) => rock(m, 0.8), (m) => pine(m, 0.85, S.needleDk, null, 0.6)], far: [(m) => pine(m, 1.4, S.needle, null, 0.5), (m) => house(m, 1.1), (m) => pine(m, 1.2, S.needleDk, null, 0.6), (m) => torii(m, 1.05), (m) => pine(m, 1.3, S.needle, null, 0.5), (m) => rock(m, 1.4)],
      scatter: [(m) => pine(m, 1.2, S.needle, null, 0.5), (m) => rock(m, 1), (m) => house(m, 1)], dense: 0.55,
      props: [(m) => pine(m, 0.95, S.needle, null, 0.5), (m) => rock(m, 1.5), (m) => bales(m, 1.3)],
      ambient: { ...none, shade: 0.4, motes: [{ kind: "drift", n: 8, colors: ["#fffdf6"], size: 0.03 }], flock: { n: 4, color: "#2a2622" } },
    }),
    scene({
      name: "Vermilion Court", obstacle: "drum", field: [TONE.mid, 0.26], marks: TONE.wet, mark: "dabs", peaks: [TONE.ink, 0.75], strip: "court",
      extra: (p) => { ponds([[-3.4, 3.2, 1.6, 1.0], [12.4, 10.8, 1.6, 1.0]])(p); drifts(TONE.mid, 0.08)(p); },
      side: [(m) => wall(m, 1.6, 1), (m) => postLantern(m, 1), (m) => drum(m, 0.9)], far: [(m) => pagoda(m, 1.3, 4), (m) => wall(m, 2.4, 1.1), (m) => torii(m, 1.2), (m) => torii(m, 1.2), (m) => wall(m, 2.4, 1.1), (m) => pagoda(m, 1.3, 4)],
      scatter: [(m) => pagoda(m, 1, 3), (m) => pine(m, 1.1, S.needleDk), (m) => wall(m, 2, 1)], dense: 0.8,
      props: [(m) => drum(m, 1.3), (m) => postLantern(m, 1.3), (m) => stoneLantern(m, 1.5)],
      ambient: { ...none, shade: 0.5, motes: [{ kind: "fall", n: 12, colors: ["#3b3833", "#6f6a62"], size: 0.03 }], flock: { n: 3, color: "#1d1a17" } },
    }),
  ],
};
void [fence];
