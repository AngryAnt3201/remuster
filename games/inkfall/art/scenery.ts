// What stands round Inkfall's battlefields, on its maps and in its key art: pines, bamboo, plum trees, torii gates,
// stone lanterns, pagodas, thatched houses, rocks. Scenery is painted in washes (greys, a little tea stain) so the
// armies, in solid ink and their two colours, stay the darkest and brightest things on the paper.
import { Model, mat, type Material } from "../../../artkit/toon3d";
import { P } from "./parts";

const INKHEX = "#1d1a17";
const w = (k: number) => mat(INKHEX, { emit: k });
export const S = {
  trunk: w(0.75), trunkLt: w(0.45), needle: w(0.42), needleDk: w(0.6), needleLt: w(0.2),
  bamboo: mat("#7d8f70", { emit: 0.85 }), bambooDk: mat("#55684f", { emit: 0.9 }), leaf: mat("#6f8563", { emit: 0.9 }),
  stone: mat("#b3ad9f", { emit: 0.85 }), stoneDk: mat("#7c776d", { emit: 0.9 }), stoneLt: mat("#d6d0c0", { emit: 0.85 }),
  plaster: mat("#f3ecda", { emit: 0.9 }), tile: w(0.7), tileLt: w(0.45), timber: w(0.8),
  thatch: mat("#c9b27c", { emit: 0.85 }), thatchDk: mat("#9c8554", { emit: 0.85 }), wood: mat("#9a8464", { emit: 0.85 }),
  snow: mat("#fffdf6", { emit: 1 }), cloud: mat("#fffaf0", { emit: 0.9 }), petal: mat("#eeb0a4", { emit: 1, ink: false }), petalDk: mat("#d98474", { emit: 1, ink: false }),
  lampLit: mat("#f1d894", { emit: 1 }), water: mat("#9fb6b8", { emit: 0.9 }), lotus: mat("#8fa68c", { emit: 0.9 }), lotusFlower: mat("#f4d3cc", { emit: 1 }),
  clay: mat("#a98a6c", { emit: 0.85 }), ember: mat("#d9793c", { emit: 1, ink: false }), paperLamp: mat("#f6ecd0", { emit: 1 }),
};

/** A pine: a leaning dark trunk and flat pads of needles, like clouds, stepping up it. */
export function pine(m: Model, s = 1, pads: Material = S.needle, cap: Material | null = null, lean = 0.18) {
  const top = 1.7 * s;
  m.tube([[0, 0, 0], [0, lean * 0.5 * s, top * 0.45], [0, lean * s, top * 0.8], [0, lean * 0.6 * s, top]], [0.1 * s, 0.085 * s, 0.06 * s, 0.03 * s], S.trunk, { segs: 6 });
  const P3: [number, number, number, number][] = [[0.55, -0.42, 0.5, 0.46], [0.75, 0.5, 0.56, 0.5], [1.0, -0.2, 0.5, 0.42], [1.25, 0.34, 0.42, 0.36], [1.5, 0.05, 0.36, 0.3]];
  for (const [z, y, rx, ry] of P3) {
    m.group(() => m.ellipsoid([0, (y + lean * z) * s, z * top / 1.7], [ry * s, rx * s, 0.12 * s], pads, { segs: 9 }));
    if (cap) m.decal(0.03, () => m.ellipsoid([0, (y + lean * z) * s, z * top / 1.7 + 0.07 * s], [ry * 0.8 * s, rx * 0.82 * s, 0.07 * s], cap, { segs: 9 }));
  }
}
/** A clump of bamboo: a few tall jointed stalks with sprays of leaves near the top. */
export function bamboo(m: Model, s = 1, n = 4) {
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, x = Math.cos(a) * 0.16 * s, y = Math.sin(a) * 0.22 * s, h = (1.7 + 0.35 * ((i * 7) % 3)) * s, ly = Math.sin(a) * 0.12 * s;
    m.tube([[x, y, 0], [x, y + ly * 0.4, h * 0.6], [x, y + ly, h]], [0.04 * s, 0.035 * s, 0.02 * s], i % 2 ? S.bamboo : S.bambooDk, { segs: 5 });
    m.decal(0.02, () => m.group(() => { for (let k = 1; k < 5; k++) m.cylinder([x, y + ly * 0.4 * (k / 3), h * 0.17 * k - 0.012 * s], [x, y + ly * 0.4 * (k / 3), h * 0.17 * k + 0.012 * s], 0.045 * s, S.trunk, 0.045 * s, { segs: 5 }); }));
    m.group(() => { for (let k = 0; k < 5; k++) { const sd = k % 2 ? 1 : -1, z = h * (0.62 + k * 0.08); m.poly([[x, y + ly * 0.8, z], [x, y + ly + sd * 0.34 * s, z + 0.1 * s], [x, y + ly + sd * 0.3 * s, z - 0.08 * s]], S.leaf); } });
  }
}
/** A plum tree: a black twisting trunk and bare forked branches dotted with blossom. */
export function plum(m: Model, s = 1, flower: Material = S.petal) {
  m.tube([[0, 0, 0], [0, 0.12 * s, 0.35 * s], [0, -0.05 * s, 0.7 * s], [0, 0.1 * s, 1.0 * s]], [0.11 * s, 0.09 * s, 0.07 * s, 0.04 * s], S.trunk, { segs: 6 });
  const br: [number, number, number, number][] = [[0.6, -0.65, 1.1, 0.045], [0.75, 0.7, 1.25, 0.04], [0.95, -0.4, 1.55, 0.03], [1.0, 0.45, 1.6, 0.03], [0.5, 0.5, 0.75, 0.035]];
  for (const [z0, y, z1, r] of br) {
    m.tube([[0, 0, z0 * s], [0, y * 0.6 * s, (z0 + (z1 - z0) * 0.4) * s], [0, y * s, z1 * s]], [r * 1.4 * s, r * s, r * 0.4 * s], S.trunk, { segs: 5 });
    m.group(() => { for (let k = 0; k < 5; k++) { const t = 0.35 + k * 0.16; m.sphere([0.03 * s * (k % 2 ? 1 : -1), y * t * s + (k % 2 ? 0.05 : -0.05) * s, (z0 + (z1 - z0) * t) * s + 0.04 * s], (0.06 + 0.02 * (k % 2)) * s, k % 3 ? flower : S.petalDk, { segs: 5 }); } });
  }
}
/** A boulder: one big stone and a smaller one leaning on it. */
export function rock(m: Model, s = 1, col: Material = S.stone, dk: Material = S.stoneDk, cap: Material | null = null) {
  m.group(() => { m.ellipsoid([0, 0, 0.3 * s], [0.5 * s, 0.6 * s, 0.5 * s], col, { segs: 7 }); m.ellipsoid([0.2 * s, 0.5 * s, 0.16 * s], [0.34 * s, 0.36 * s, 0.3 * s], dk, { segs: 6 }); });
  if (cap) m.decal(0.03, () => m.ellipsoid([-0.05 * s, 0, 0.72 * s], [0.34 * s, 0.42 * s, 0.1 * s], cap, { segs: 7 }));
}
/** A tall standing rock, like a scholar's stone. */
export function crag(m: Model, s = 1, col: Material = S.stone, dk: Material = S.stoneDk, cap: Material | null = null) {
  m.group(() => { m.lathe([[0.42 * s, 0], [0.36 * s, 0.5 * s], [0.42 * s, 0.9 * s], [0.22 * s, 1.5 * s], [0.06 * s, 1.75 * s]], col, { segs: 6 }); m.lathe([[0.26 * s, 0], [0.2 * s, 0.6 * s], [0.05 * s, 0.95 * s]], dk, { segs: 5, at: [0.2 * s, 0.42 * s, 0] }); });
  if (cap) m.decal(0.03, () => m.cone([0, 0, 1.45 * s], [0, 0, 1.8 * s], 0.24 * s, cap, { segs: 6 }));
}
/** A stone lantern: foot, post, a lit box, a wide cap with a knob. */
export function stoneLantern(m: Model, s = 1, lit: Material = S.lampLit, cap: Material | null = null) {
  m.group(() => {
    m.cylinder([0, 0, 0], [0, 0, 0.12 * s], 0.3 * s, S.stone, 0.24 * s, { segs: 6 });
    m.cylinder([0, 0, 0.12 * s], [0, 0, 0.62 * s], 0.1 * s, S.stone, 0.09 * s, { segs: 6 });
    m.cylinder([0, 0, 0.62 * s], [0, 0, 0.7 * s], 0.24 * s, S.stoneDk, 0.26 * s, { segs: 6 });
  });
  m.box([0, 0, 0.84 * s], [0.3 * s, 0.3 * s, 0.28 * s], S.stone);
  m.decal(0.03, () => m.box([0.15 * s, 0, 0.84 * s], [0.02 * s, 0.18 * s, 0.18 * s], lit));
  m.group(() => { m.cone([0, 0, 0.98 * s], [0, 0, 1.22 * s], 0.42 * s, cap ?? S.stoneDk, { segs: 6 }); m.sphere([0, 0, 1.24 * s], 0.07 * s, S.stoneDk, { segs: 6 }); });
}
/** A torii gate in black ink: two leaning posts, a tie beam and a long upswept lintel. Opens along x (walk through along x). */
export function torii(m: Model, s = 1, col: Material = S.timber) {
  for (const sd of [1, -1]) m.cylinder([0, sd * 0.75 * s, 0], [0, sd * 0.68 * s, 1.75 * s], 0.085 * s, col, 0.07 * s, { segs: 7 });
  m.box([0, 0, 1.32 * s], [0.1 * s, 1.75 * s, 0.1 * s], col);
  m.group(() => {
    m.box([0, 0, 1.74 * s], [0.14 * s, 2.1 * s, 0.12 * s], col);
    for (const sd of [1, -1]) m.with(() => { m.move(0, sd * 1.12 * s, 1.8 * s).rotX(-sd * 16); m.box([0, 0, 0], [0.16 * s, 0.34 * s, 0.1 * s], col); });
  });
  m.decal(0.02, () => m.box([0.06 * s, 0, 1.53 * s], [0.03 * s, 0.2 * s, 0.3 * s], S.plaster));
}
/** One curved tiled roof on a square of half-width `half`: four concave slopes (the two that face the viewer and
 *  away in `col`, the two sides in `dk`, so the form reads without shading), black hips and upturned corners. */
export function roof(m: Model, z: number, half: number, rise: number, col: Material, dk: Material = col, edge: Material = S.tile) {
  const h0 = half * 1.08, h1 = half * 0.56, h2 = half * 0.1, z1 = z + rise * 0.3, z2 = z + rise;
  const ring = (h: number, zz: number): [number, number, number][] => [[h, h, zz], [h, -h, zz], [-h, -h, zz], [-h, h, zz]];
  const A = ring(h0, z), B = ring(h1, z1), C = ring(h2, z2);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, mt = i % 2 === 0 ? col : dk;
    m.group(() => { m.poly([A[i], A[j], B[j], B[i]], mt); m.poly([B[i], B[j], C[j], C[i]], mt); });
  }
  m.decal(0.01, () => m.box([0, 0, z2], [h2 * 2, h2 * 2, 0.02], edge));
  m.decal(0.02, () => m.group(() => { for (let i = 0; i < 4; i++) m.tube([A[i], B[i], C[i]], [half * 0.035, half * 0.03, half * 0.025], edge, { segs: 4 }); }));
  m.group(() => { for (let i = 0; i < 4; i++) m.cone([A[i][0] * 0.96, A[i][1] * 0.96, z], [A[i][0] * 1.16, A[i][1] * 1.16, z + rise * 0.36], 0.07 * half, edge, { segs: 4 }); });
}
/** A pagoda: stacked storeys, each a plaster box under a tiled roof, a spire on top. */
export function pagoda(m: Model, s = 1, storeys = 3, roofCol: Material = S.tile, cap: Material | null = null) {
  let z = 0, half = 0.62 * s;
  m.box([0, 0, 0.06 * s], [half * 2.5, half * 2.5, 0.12 * s], S.stone);
  z = 0.12 * s;
  for (let i = 0; i < storeys; i++) {
    const h = (0.46 - i * 0.04) * s;
    m.box([0, 0, z + h / 2], [half * 1.5, half * 1.5, h], S.plaster);
    m.decal(0.02, () => m.group(() => { for (const y of [-half * 0.74, 0, half * 0.74]) m.box([half * 0.76, y, z + h / 2], [0.02 * s, 0.05 * s, h], S.timber); m.box([half * 0.76, 0, z + h * 0.82], [0.02 * s, half * 1.5, 0.05 * s], S.timber); }));
    z += h;
    roof(m, z, half * 1.06, 0.3 * s, roofCol, S.tileLt);
    if (cap) m.decal(0.03, () => m.with(() => { m.rotZ(45); m.lathe([[half * 0.9, z + 0.14 * s], [half * 0.45, z + 0.26 * s], [0.02, z + 0.33 * s]], cap, { segs: 4 }); }));
    z += 0.2 * s; half *= 0.8;
  }
  m.group(() => { m.cylinder([0, 0, z], [0, 0, z + 0.5 * s], 0.025 * s, S.timber, 0.012 * s, { segs: 4 }); for (let k = 0; k < 3; k++) m.torus([0, 0, z + (0.16 + k * 0.1) * s], [0, 0, 1], (0.07 - k * 0.015) * s, 0.014 * s, S.timber, { segs: 6 }); });
}
/** A thatched farmhouse: plaster walls with dark timbers under a deep steep thatch. */
export function house(m: Model, s = 1, thatch: Material = S.thatch, cap: Material | null = null) {
  const L = 1.3 * s, Wd = 0.9 * s, h = 0.42 * s;
  m.box([0, 0, h / 2], [Wd, L, h], S.plaster);
  m.decal(0.02, () => m.group(() => { for (const y of [-L * 0.48, -L * 0.16, L * 0.16, L * 0.48]) m.box([Wd / 2 + 0.005, y, h / 2], [0.02 * s, 0.05 * s, h], S.timber); m.box([Wd / 2 + 0.008, 0, h * 0.2], [0.02 * s, 0.28 * s, h * 0.6], S.timber); }));
  // the roof: a ridge running along y
  m.group(() => m.extrude([[-Wd * 0.8, h * 0.85], [0, h + 0.75 * s], [Wd * 0.8, h * 0.85], [Wd * 0.72, h * 0.8], [0, h + 0.6 * s], [-Wd * 0.72, h * 0.8]], L * 1.18, thatch));
  m.box([0, 0, h + 0.76 * s], [0.14 * s, L * 1.22, 0.08 * s], S.thatchDk);
  if (cap) m.decal(0.03, () => m.extrude([[-Wd * 0.5, h + 0.36 * s], [0, h + 0.8 * s], [Wd * 0.5, h + 0.36 * s], [0, h + 0.7 * s]], L * 1.2, cap));
}
/** A length of plaster wall under a tiled coping, running along y. */
export function wall(m: Model, len = 2, s = 1, cap: Material | null = null) {
  m.box([0, 0, 0.3 * s], [0.2 * s, len, 0.6 * s], S.plaster);
  m.box([0, 0, 0.06 * s], [0.24 * s, len, 0.12 * s], S.stoneDk);
  m.group(() => m.extrude([[-0.24 * s, 0.6 * s], [0, 0.8 * s], [0.24 * s, 0.6 * s]], len * 1.02, cap ?? S.tile));
}
/** A bamboo fence along y. */
export function fence(m: Model, len = 2, s = 1) {
  m.group(() => { for (let y = -len / 2; y <= len / 2 + 0.01; y += 0.22 * s) m.cylinder([0, y, 0], [0, y, 0.5 * s], 0.025 * s, S.bamboo, 0.025 * s, { segs: 4 }); });
  m.group(() => { for (const z of [0.16, 0.4]) m.cylinder([0.02 * s, -len / 2, z * s], [0.02 * s, len / 2, z * s], 0.022 * s, S.bambooDk, 0.022 * s, { segs: 4 }); });
}
/** A stack of rice-straw bales. */
export function bales(m: Model, s = 1) {
  for (const [x, y, z, a] of [[0, -0.34, 0.24, 0], [0, 0.34, 0.24, 0], [0, 0, 0.66, 0]] as [number, number, number, number][]) m.with(() => {
    m.move(x * s, y * s, z * s).rotZ(a);
    m.cylinder([-0.42 * s, 0, 0], [0.42 * s, 0, 0], 0.26 * s, S.thatch, 0.26 * s, { segs: 10 });
    m.decal(0.02, () => m.group(() => { for (const xx of [-0.22, 0.22]) m.torus([xx * s, 0, 0], [1, 0, 0], 0.262 * s, 0.022 * s, S.thatchDk, { segs: 10 }); }));
  });
}
/** A great drum on a stand. */
export function drum(m: Model, s = 1) {
  m.group(() => { for (const sd of [1, -1]) { m.box([0, sd * 0.36 * s, 0.04 * s], [0.7 * s, 0.08 * s, 0.08 * s], S.timber); m.box([0, sd * 0.36 * s, 0.32 * s], [0.08 * s, 0.08 * s, 0.56 * s], S.timber); } });
  m.group(() => m.lathe([[0.36, -0.3], [0.46, 0], [0.36, 0.3]].map(([r, z]) => [r * s, z * s] as [number, number]), S.trunk, { smooth: true, segs: 12, at: [0, 0, 0] }));
  m.with(() => { m.move(0, 0, 0.62 * s).rotX(90); m.group(() => m.lathe([[0.36, -0.3], [0.46, 0], [0.36, 0.3]].map(([r, z]) => [r * s, z * s] as [number, number]), S.trunk, { smooth: true, segs: 12 })); m.decal(0.02, () => { m.cylinder([0, 0, 0.3 * s], [0, 0, 0.31 * s], 0.34 * s, S.plaster, 0.34 * s, { segs: 12 }); m.cylinder([0, 0, -0.31 * s], [0, 0, -0.3 * s], 0.34 * s, S.plaster, 0.34 * s, { segs: 12 }); }); });
}
/** A big lidded storage jar. */
export function jar(m: Model, s = 1, col: Material = S.clay) {
  m.group(() => m.lathe([[0.3 * s, 0], [0.48 * s, 0.3 * s], [0.44 * s, 0.62 * s], [0.26 * s, 0.82 * s], [0.3 * s, 0.9 * s]], col, { smooth: true, segs: 10 }));
  m.cylinder([0, 0, 0.9 * s], [0, 0, 0.96 * s], 0.33 * s, S.wood, 0.33 * s, { segs: 10 });
  m.decal(0.02, () => m.torus([0, 0, 0.74 * s], [0, 0, 1], 0.34 * s, 0.03 * s, S.thatch, { segs: 10 }));
}
/** A beehive kiln: a clay dome, a dark mouth with a glow, a short chimney. */
export function kiln(m: Model, s = 1) {
  m.group(() => { m.ellipsoid([0, 0, 0.1 * s], [0.7 * s, 0.7 * s, 0.75 * s], S.clay, { segs: 9 }); m.cylinder([-0.3 * s, 0, 0.6 * s], [-0.3 * s, 0, 1.1 * s], 0.14 * s, S.clay, 0.11 * s, { segs: 6 }); });
  m.decal(0.03, () => m.ellipsoid([0.62 * s, 0, 0.2 * s], [0.1 * s, 0.24 * s, 0.26 * s], S.trunk, { segs: 7 }));
  m.decal(0.05, () => m.ellipsoid([0.66 * s, 0, 0.14 * s], [0.06 * s, 0.14 * s, 0.12 * s], S.ember, { segs: 6 }));
}
/** Lotus leaves and a flower, lying flat (stands in ponds and marsh). */
export function lotus(m: Model, s = 1) {
  for (const [x, y, r] of [[0, 0, 0.42], [0.36, 0.5, 0.3], [-0.3, -0.52, 0.34], [0.5, -0.3, 0.22]] as [number, number, number][]) m.cylinder([x * s, y * s, 0.02 * s], [x * s, y * s, 0.05 * s], r * s, S.lotus, r * s, { segs: 9 });
  m.group(() => { m.cylinder([0.1 * s, 0.1 * s, 0], [0.1 * s, 0.1 * s, 0.4 * s], 0.02 * s, S.bambooDk, 0.02 * s, { segs: 4 }); for (let i = 0; i < 5; i++) { const a = i * 1.26; m.cone([0.1 * s, 0.1 * s, 0.38 * s], [(0.1 + Math.cos(a) * 0.12) * s, (0.1 + Math.sin(a) * 0.12) * s, 0.6 * s], 0.07 * s, S.lotusFlower, { segs: 4 }); } });
}
/** Reeds. */
export function reeds(m: Model, s = 1) {
  m.group(() => { for (let i = 0; i < 7; i++) { const a = i * 2.2, x = Math.cos(a) * 0.2 * s, y = Math.sin(a) * 0.3 * s, h = (0.7 + 0.2 * (i % 3)) * s; m.tube([[x, y, 0], [x, y + 0.05 * s, h * 0.6], [x, y + 0.2 * s * (i % 2 ? 1 : -1), h]], [0.02 * s, 0.016 * s, 0.006 * s], i % 2 ? S.bamboo : S.bambooDk, { segs: 3 }); } });
  m.group(() => { for (let i = 0; i < 3; i++) { const a = i * 2.2; m.capsule([Math.cos(a) * 0.2 * s, Math.sin(a) * 0.3 * s + 0.05 * s, 0.75 * s], [Math.cos(a) * 0.2 * s, Math.sin(a) * 0.3 * s + 0.08 * s, 0.95 * s], 0.035 * s, S.trunk, 0.03 * s, { segs: 5 }); } });
}
/** A bank of cloud. */
export function cloudBank(m: Model, s = 1) {
  m.group(() => { for (const [y, z, r] of [[0, 0.3, 0.5], [0.6, 0.24, 0.38], [-0.62, 0.22, 0.36], [0.3, 0.55, 0.3], [-1.05, 0.14, 0.22], [1.0, 0.14, 0.24]] as [number, number, number][]) m.ellipsoid([0, y * s, z * s], [r * 0.7 * s, r * s, r * 0.75 * s], S.cloud, { segs: 8 }); });
}
/** A tall paper lantern on a post. */
export function postLantern(m: Model, s = 1) {
  m.cylinder([0, 0, 0], [0, 0, 1.0 * s], 0.04 * s, S.timber, 0.035 * s, { segs: 5 });
  m.group(() => { m.box([0, 0, 1.18 * s], [0.3 * s, 0.3 * s, 0.38 * s], S.paperLamp); });
  m.decal(0.02, () => m.group(() => { for (const y of [-0.15, 0.15]) m.box([0.155 * s, y * s, 1.18 * s], [0.02 * s, 0.03 * s, 0.38 * s], S.timber); }));
  m.cone([0, 0, 1.37 * s], [0, 0, 1.56 * s], 0.3 * s, S.tile, { segs: 4 });
}
/** A banner on a pole in the picture's team colour (neutral unless the stamp names a side). */
export function standard(m: Model, s = 1) {
  m.cylinder([0, 0, 0], [0, 0, 1.9 * s], 0.03 * s, S.timber, 0.025 * s, { segs: 5 });
  m.cylinder([0, 0, 1.86 * s], [0, 0.36 * s, 1.86 * s], 0.02 * s, S.timber, 0.02 * s, { segs: 4 });
  m.poly([[0, 0.03 * s, 1.84 * s], [0, 0.36 * s, 1.84 * s], [0.03 * s, 0.36 * s, 0.9 * s], [0.03 * s, 0.03 * s, 0.9 * s]], P.team);
  m.decal(0.02, () => m.torus([0.02 * s, 0.2 * s, 1.6 * s], [1, 0, 0], 0.09 * s, 0.02 * s, P.white, { segs: 10 }));
}
/** A small arched footbridge along x. */
export function bridge(m: Model, s = 1) {
  m.group(() => m.extrude([[-0.9 * s, 0], [-0.5 * s, 0.24 * s], [0, 0.32 * s], [0.5 * s, 0.24 * s], [0.9 * s, 0], [0.9 * s, -0.06 * s], [0.5 * s, 0.16 * s], [0, 0.24 * s], [-0.5 * s, 0.16 * s], [-0.9 * s, -0.06 * s]], 0.7 * s, S.wood));
  for (const sd of [1, -1]) m.group(() => { for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) m.cylinder([x * s, sd * 0.33 * s, 0.1 * s], [x * s, sd * 0.33 * s, (0.5 - Math.abs(x) * 0.26) * s], 0.03 * s, S.timber, 0.03 * s, { segs: 4 }); m.tube([[-0.8 * s, sd * 0.33 * s, 0.28 * s], [0, sd * 0.33 * s, 0.5 * s], [0.8 * s, sd * 0.33 * s, 0.28 * s]], 0.025 * s, S.timber, { segs: 4 }); });
}
