// Neonhold's city: towers with lit windows and blade signs, street furniture, containers, server racks, barriers.
// Everything is a dark box with a glowing edge (the neon look does that); windows and signs are emissive decals.
// The city's own light is magenta, violet, blue, with touches of yellow and green: never team cyan or orange-red.
import { Model, mat, type Material } from "../../../artkit/toon3d";

export const S = {
  wall: mat("#5a60c0"), wallDk: mat("#3c4090"), wallVi: mat("#7a52c8"), wallBl: mat("#4668c8"), wallGr: mat("#4a9088"),
  concrete: mat("#7a80b8"), metal: mat("#98a2d8", { emit: 0.15 }), dark: mat("#2c2c5c"), chrome: mat("#dfe6ff", { emit: 0.4 }),
  gold: mat("#ffd14a", { emit: 0.6 }), marble: mat("#c9c4e8", { emit: 0.3 }),
  winPink: mat("#ffb3f0", { emit: 1 }), winVi: mat("#b9a0ff", { emit: 1 }), winBlue: mat("#7fa0ff", { emit: 1 }), winWarm: mat("#fff0b8", { emit: 1 }), winGreen: mat("#8dffb8", { emit: 1 }),
  mag: mat("#ff3fd8", { emit: 1, glow: 0.8 }), vi: mat("#9a6bff", { emit: 1, glow: 0.8 }), blue: mat("#4d7dff", { emit: 1, glow: 0.8 }),
  yel: mat("#ffe14d", { emit: 1, glow: 0.7 }), green: mat("#5dffa0", { emit: 1, glow: 0.7 }), white: mat("#f4f0ff", { emit: 1, glow: 0.6 }),
  red: mat("#ff2e5b", { emit: 1, glow: 0.7 }), ice: mat("#d6ecff", { emit: 1, glow: 0.5 }),
  holoMag: mat("#ff3fd8", { emit: 0.9, alpha: 0.5, glow: 0.3 }), holoVi: mat("#9a6bff", { emit: 0.9, alpha: 0.5, glow: 0.3 }), holoBlue: mat("#4d7dff", { emit: 0.9, alpha: 0.5, glow: 0.3 }),
  water: mat("#3a4ad0", { emit: 0.5 }), coolant: mat("#9fe8d8", { emit: 0.8, glow: 0.4 }), toxic: mat("#9dff4a", { emit: 0.9, glow: 0.6 }),
  haz: mat("#ffe14d", { emit: 0.7 }), leaf: mat("#3fd890", { emit: 0.4 }), leafPink: mat("#ff8ad8", { emit: 0.6 }),
};
export const SIGNS = [S.mag, S.vi, S.blue, S.yel, S.green, S.white];
export const WINS = [S.winPink, S.winVi, S.winBlue, S.winWarm];
const rnd = (seed: number) => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

export interface TowerOpts { w: number; d: number; h: number; wall?: Material; win?: Material; lit?: number; seed?: number; sign?: Material | null; roof?: "flat" | "antenna" | "tank" | "pad"; band?: Material | null }
/** A tower block. The face toward +x (the camera at yaw 90) and the two flanks carry window grids; a blade sign
 *  hangs off the front corner. Base centred on the origin. */
export function tower(m: Model, o: TowerOpts) {
  const { w, d, h } = o, wall = o.wall ?? S.wall, win = o.win ?? S.winVi, r = rnd((o.seed ?? 1) * 31 + 7), lit = o.lit ?? 0.5;
  m.box([0, 0, h / 2], [d, w, h], wall);
  m.box([0, 0, h + 0.05], [d + 0.08, w + 0.08, 0.1], S.dark);
  // windows: lit cells on a grid
  const rows = Math.max(2, Math.round(h / 0.42)), cols = Math.max(2, Math.round(w / 0.4)), dc = Math.max(2, Math.round(d / 0.4));
  m.decal(0.03, () => m.group(() => {
    for (let i = 0; i < rows; i++) {
      const z = 0.3 + ((h - 0.5) * (i + 0.5)) / rows;
      for (let j = 0; j < cols; j++) if (r() < lit) m.box([d / 2, -w / 2 + (w * (j + 0.5)) / cols, z], [0.02, (w / cols) * 0.6, ((h - 0.5) / rows) * 0.5], win);
      for (const s of [1, -1]) for (let j = 0; j < dc; j++) if (r() < lit * 0.8) m.box([-d / 2 + (d * (j + 0.5)) / dc, s * w / 2, z], [(d / dc) * 0.6, 0.02, ((h - 0.5) / rows) * 0.5], win);
    }
  }));
  if (o.band) m.decal(0.02, () => m.box([0, 0, h * 0.86], [d + 0.03, w + 0.03, 0.07], o.band!));
  if (o.sign) m.with(() => { m.move(d / 2 + 0.1, (r() < 0.5 ? -1 : 1) * w * 0.32, h * 0.62); m.box([0, 0, 0], [0.18, 0.07, Math.min(1.6, h * 0.5)], o.sign!); });
  const roof = o.roof ?? (r() < 0.4 ? "antenna" : r() < 0.5 ? "tank" : "flat");
  if (roof === "antenna") { m.cylinder([-d * 0.2, w * 0.2, h], [-d * 0.2, w * 0.2, h + 0.9], 0.03, S.metal, 0.015, { segs: 5 }); m.sphere([-d * 0.2, w * 0.2, h + 0.92], 0.05, S.red, { segs: 6 }); }
  if (roof === "tank") { m.cylinder([-d * 0.15, -w * 0.15, h + 0.1], [-d * 0.15, -w * 0.15, h + 0.45], Math.min(w, d) * 0.22, S.wallDk, Math.min(w, d) * 0.22, { segs: 10 }); }
  if (roof === "pad") { m.decal(0.02, () => m.torus([0, 0, h + 0.1], [0, 0, 1], Math.min(w, d) * 0.32, 0.03, S.yel, { segs: 16 })); }
  if (roof === "flat") m.box([d * 0.15, -w * 0.2, h + 0.2], [0.4, 0.5, 0.22], S.metal);
}
/** A holo billboard on two legs: a pane of light facing +x. */
export function billboard(m: Model, w = 1.6, h = 0.9, z = 1.4, pane: Material = S.holoMag, bar: Material = S.white) {
  for (const s of [1, -1]) m.cylinder([0, s * w * 0.4, 0], [0, s * w * 0.4, z], 0.04, S.metal, 0.04, { segs: 6 });
  m.box([0, 0, z + h / 2], [0.05, w, h], pane);
  m.decal(0.03, () => m.group(() => { m.box([0.03, 0, z + h * 0.68], [0.02, w * 0.7, h * 0.12], bar); m.box([0.03, -w * 0.12, z + h * 0.36], [0.02, w * 0.46, h * 0.08], bar); }));
}
/** A street light: a pole with an arm reaching `arm` along +x and a lit bar under it. */
export function lampPost(m: Model, h = 1.6, arm = 0.45, light: Material = S.vi) {
  m.cylinder([0, 0, 0], [0, 0, h], 0.035, S.metal, 0.028, { segs: 6 });
  m.box([0, 0, 0.06], [0.14, 0.14, 0.12], S.dark);
  if (arm > 0) { m.box([arm / 2, 0, h], [arm + 0.06, 0.05, 0.04], S.metal); m.box([arm * 0.7, 0, h - 0.035], [arm * 0.6, 0.06, 0.03], light); }
  else m.sphere([0, 0, h + 0.04], 0.07, light, { segs: 8 });
}
/** A vending machine facing +x. */
export function vending(m: Model, glow: Material = S.mag, body: Material = S.wallDk) {
  m.box([0, 0, 0.45], [0.4, 0.52, 0.9], body);
  m.decal(0.02, () => m.box([0.2, 0.05, 0.56], [0.02, 0.32, 0.5], S.winPink));
  m.decal(0.03, () => m.group(() => { for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) m.box([0.21, -0.03 + c * 0.14, 0.42 + r * 0.14], [0.02, 0.08, 0.08], (r + c) % 2 ? glow : S.white); }));
  m.box([0.02, 0, 0.94], [0.44, 0.56, 0.06], glow);
}
/** A shipping container, long axis along y. */
export function container(m: Model, col: Material = S.wallBl, len = 1.5, stripe: Material | null = S.yel) {
  m.box([0, 0, 0.36], [0.62, len, 0.72], col);
  m.decal(0.015, () => m.group(() => { for (let i = 0; i < Math.round(len / 0.22); i++) m.box([0.31, -len / 2 + 0.12 + i * 0.22, 0.36], [0.02, 0.03, 0.6], S.dark); }));
  if (stripe) m.decal(0.02, () => m.box([0, 0, 0.66], [0.64, len + 0.02, 0.04], stripe));
}
/** A server rack: a tall cabinet with rows of status lights on the +x face. */
export function rack(m: Model, h = 1.5, w = 0.6, led: Material = S.green, led2: Material = S.vi) {
  m.box([0, 0, h / 2], [0.5, w, h], S.wallDk);
  m.decal(0.03, () => m.group(() => { for (let i = 0; i < Math.round(h / 0.16) - 1; i++) m.box([0.25, (i % 3 - 1) * w * 0.12, 0.14 + i * 0.16], [0.02, w * 0.5, 0.035], i % 4 === 1 ? led2 : led); }));
  m.box([0, 0, h + 0.03], [0.54, w + 0.04, 0.06], S.metal);
}
/** A run of hard-light barrier: two posts and a pane between them, along y, `len` long, centred on the origin. */
export function barrier(m: Model, len = 1.4, h = 0.42, pane: Material = S.holoVi, post: Material = S.metal) {
  for (const s of [1, -1]) { m.box([0, s * len / 2, h / 2 + 0.03], [0.1, 0.08, h + 0.06], post); m.decal(0.02, () => m.box([0, s * len / 2, h + 0.04], [0.11, 0.09, 0.03], S.white)); }
  m.box([0, 0, h * 0.55], [0.025, len - 0.08, h * 0.7], pane);
}
/** A concrete jersey block with a hazard stripe, along y. */
export function jersey(m: Model, len = 1.4, stripe: Material = S.haz) {
  m.group(() => { m.box([0, 0, 0.07], [0.32, len, 0.14], S.concrete); m.box([0, 0, 0.18], [0.2, len, 0.36], S.concrete); });
  m.decal(0.02, () => m.box([0, 0, 0.3], [0.25, len * 0.9, 0.05], stripe));
}
/** A low wall with a lit top rail, along y. */
export function parapet(m: Model, len = 1.4, h = 0.34, rail: Material = S.mag, body: Material = S.wallDk) {
  m.box([0, 0, h / 2], [0.2, len, h], body);
  m.decal(0.02, () => m.box([0, 0, h + 0.012], [0.08, len * 0.94, 0.024], rail));
}
/** A rooftop air handler: a box with a fan ring on top. */
export function acUnit(m: Model, s = 0.7) {
  m.box([0, 0, s * 0.35], [s, s * 1.2, s * 0.7], S.concrete);
  m.decal(0.02, () => m.torus([0, 0, s * 0.71], [0, 0, 1], s * 0.3, 0.03, S.metal, { segs: 12 }));
  m.decal(0.02, () => m.box([s / 2, 0, s * 0.35], [0.02, s * 0.8, s * 0.3], S.dark));
}
/** A dish antenna on a mast. */
export function dish(m: Model, h = 1.2, r = 0.4) {
  m.cylinder([0, 0, 0], [0, 0, h], 0.04, S.metal, 0.03, { segs: 6 });
  m.with(() => { m.move(0, 0, h).rotY(-40); m.cone([0.02, 0, 0], [-0.14, 0, 0], r, S.concrete, { segs: 12 }); m.cylinder([0, 0, 0], [0.22, 0, 0], 0.012, S.metal, 0.012, { segs: 4 }); m.sphere([0.24, 0, 0], 0.04, S.red, { segs: 6 }); });
}
/** A pipe run along y on stands, with a lit valve. */
export function pipeRun(m: Model, len = 1.4, z = 0.3, r = 0.12, col: Material = S.metal, light: Material = S.ice) {
  m.cylinder([0, -len / 2, z], [0, len / 2, z], r, col, r, { segs: 10 });
  for (const s of [-0.4, 0.4]) m.box([0, s * len, z / 2], [0.1, 0.08, z], S.dark);
  m.decal(0.01, () => m.torus([0, 0, z], [0, 1, 0], r * 1.08, 0.025, light, { segs: 10 }));
}
/** A coolant or fuel tank standing on legs. */
export function tank(m: Model, r = 0.8, h = 1.8, col: Material = S.wallBl, band: Material = S.ice) {
  m.group(() => { m.cylinder([0, 0, 0.2], [0, 0, h], r, col, r, { segs: 14 }); m.ellipsoid([0, 0, h], [r, r, r * 0.4], col, { segs: 14 }); });
  for (const z of [0.5, h - 0.3]) m.decal(0.02, () => m.torus([0, 0, z], [0, 0, 1], r * 1.01, 0.03, band, { segs: 16 }));
}
/** A gantry crane: two legs, a beam, a hanging hook block with a light. */
export function crane(m: Model, h = 3, span = 2.4, col: Material = S.wallBl) {
  for (const s of [1, -1]) m.box([0, s * span / 2, h / 2], [0.16, 0.16, h], col);
  m.box([0, 0, h], [0.24, span + 0.4, 0.22], col);
  m.decal(0.02, () => m.box([0.12, 0, h], [0.02, span, 0.06], S.yel));
  m.cylinder([0, span * 0.15, h], [0, span * 0.15, h - 0.9], 0.015, S.metal, 0.015, { segs: 4 });
  m.box([0, span * 0.15, h - 1], [0.2, 0.2, 0.2], S.dark); m.sphere([0, span * 0.15, h - 1.14], 0.05, S.red, { segs: 6 });
}
/** A monorail pylon and a length of track along y. */
export function monorail(m: Model, len = 4, h = 2.2, light: Material = S.mag) {
  m.box([0, 0, h / 2], [0.3, 0.3, h], S.concrete);
  m.box([0, 0, h + 0.1], [0.36, len, 0.2], S.wallDk);
  m.decal(0.02, () => m.box([0.18, 0, h + 0.1], [0.02, len * 0.96, 0.04], light));
}
/** A train car on the monorail, along y. */
export function railcar(m: Model, len = 2, win: Material = S.winWarm) {
  m.box([0, 0, 0.3], [0.5, len, 0.5], S.metal);
  m.decal(0.02, () => m.box([0.25, 0, 0.36], [0.02, len * 0.86, 0.16], win));
}
/** A potted tree in a planter: the Hold's gardens are lit too. */
export function tree(m: Model, h = 1.3, leaf: Material = S.leaf) {
  m.box([0, 0, 0.1], [0.4, 0.4, 0.2], S.concrete);
  m.cylinder([0, 0, 0.2], [0, 0, h * 0.6], 0.045, S.dark, 0.03, { segs: 5 });
  m.group(() => { m.sphere([0, 0, h * 0.75], h * 0.28, leaf, { segs: 8 }); m.sphere([0.12, 0.1, h * 0.9], h * 0.2, leaf, { segs: 8 }); m.sphere([-0.1, -0.12, h * 0.62], h * 0.2, leaf, { segs: 8 }); });
}
/** A market stall: a counter under a lit awning facing +x. */
export function stall(m: Model, w = 1.2, awn: Material = S.mag) {
  m.box([0, 0, 0.25], [0.5, w, 0.5], S.wallDk);
  for (const s of [1, -1]) m.cylinder([-0.2, s * w * 0.46, 0], [-0.2, s * w * 0.46, 1.1], 0.025, S.metal, 0.025, { segs: 5 });
  m.with(() => { m.move(0, 0, 1.1).rotY(14); m.box([0.12, 0, 0], [0.8, w + 0.1, 0.04], awn); });
  m.decal(0.02, () => m.group(() => { for (let i = 0; i < 3; i++) m.sphere([0.1, (i - 1) * w * 0.3, 0.56], 0.07, [S.yel, S.green, S.white][i], { segs: 6 }); }));
}
/** A stack of crates with lit corner tags. */
export function crateStack(m: Model, s = 0.6, col: Material = S.wallVi, tag: Material = S.yel) {
  m.box([0, 0, s / 2], [s, s, s], col);
  m.decal(0.02, () => m.box([s / 2, 0, s * 0.7], [0.02, s * 0.5, 0.05], tag));
}
/** A helipad beacon or bollard light. */
export function beacon(m: Model, h = 0.4, light: Material = S.red) {
  m.cylinder([0, 0, 0], [0, 0, h], 0.07, S.dark, 0.05, { segs: 6 });
  m.sphere([0, 0, h + 0.04], 0.07, light, { segs: 8 });
}
/** A fountain of light: a ring basin with a holo column. */
export function fountain(m: Model, r = 0.9, col: Material = S.holoBlue) {
  m.cylinder([0, 0, 0], [0, 0, 0.22], r, S.marble, r * 0.94, { segs: 14 });
  m.decal(0.02, () => m.cylinder([0, 0, 0.22], [0, 0, 0.24], r * 0.8, S.water, r * 0.8, { segs: 14 }));
  m.cylinder([0, 0, 0.24], [0, 0, 1.5], r * 0.16, col, r * 0.3, { segs: 10 });
}
