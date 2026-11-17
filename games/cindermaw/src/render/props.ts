// Cindermaw's set dressing. The base kit builds a village (crates, haystacks, wells, statues, market stalls,
// fences, barrels, a gatehouse); hell needs other furniture, so the builders a player would recognise as rustic
// are replaced here: hazard-striped crates, bone piles, blood fountains, gargoyles, tech pillars with blinking
// lights, impaled pikes, toxic drums and a portal arch. Trees become dead trees and skull pikes; lamps become
// pylons with a blinking red light.
import { Mesh, type Face } from "@base/render/kit3d";
import { BUILDERS, HEIGHT, rcOf, seeded, tree as baseTree, type Built, type Rc } from "@base/render/props";
import type { ArenaMark } from "@engine/core/arena";
import { TERRAIN, type WorldStyle } from "../game/terrain";

export * from "@base/render/props";

type Rnd = () => number;
type Builder = (m: Mesh, r: Rc, S: WorldStyle, rnd: Rnd, look: string) => void | ((t: number) => Face[]);
const C = { iron: "#5d646a", ironDk: "#3a3f44", black: "#1c0c08", hazard: "#ffb020", bone: "#e0d4b8", boneDk: "#8f7a66", blood: "#b3170d", bloodLt: "#e03a10", flesh: "#7a3a2c", slime: "#b8e03a", slimeDk: "#4d6a1c", red: "#ff7a1c", rust: "#8a5a2a", char: "#2a1c14", portal: "#b040b0", portalLt: "#ffe070" };
const FLAT = { flat: true, ink: false as const };

/** A skull: a blob and a jaw. */
function skull(m: Mesh, x: number, y: number, z: number, s: number, c = C.bone) {
  m.blob(x, y, z + s * 0.2, s, c, 6, 0.9);
  m.box(x - s * 0.5, y - s * 0.1, z - s * 0.9, x + s * 0.5, y + s * 0.7, z - s * 0.2, c);
  m.box(x - s * 0.55, y + s * 0.72, z - s * 0.1, x - s * 0.1, y + s * 0.74, z + s * 0.35, C.black, undefined, FLAT);
  m.box(x + s * 0.1, y + s * 0.72, z - s * 0.1, x + s * 0.55, y + s * 0.74, z + s * 0.35, C.black, undefined, FLAT);
}
/** A pike stuck in the ground with something impaled on it. */
function impaled(m: Mesh, x: number, y: number, h: number, rnd: Rnd) {
  m.prism(x, y, 0, h, 0.03, 4, C.char, 0.012);
  if (rnd() < 0.7) skull(m, x, y, h * 0.78, 0.11);
  else { m.box(x - 0.09, y - 0.05, h * 0.45, x + 0.09, y + 0.05, h * 0.8, C.flesh); m.box(x - 0.05, y - 0.04, h * 0.3, x + 0.05, y + 0.04, h * 0.45, C.blood); }
}
/** A tech pillar: an iron column with hazard feet and lights that blink in turn. */
function pillar(m: Mesh, x: number, y: number, h: number, w = 0.16): (t: number) => Face[] {
  m.box(x - w * 1.3, y - w * 1.3, 0, x + w * 1.3, y + w * 1.3, 0.14, C.hazard, C.ironDk);
  m.box(x - w, y - w, 0.14, x + w, y + w, h, C.ironDk, C.iron);
  m.box(x - w * 1.2, y - w * 1.2, h, x + w * 1.2, y + w * 1.2, h + 0.08, C.iron);
  return (t) => {
    const a = new Mesh(), on = Math.floor(t * 2 + x * 3) % 3;
    for (let i = 0; i < 3; i++) { const z = 0.3 + (h - 0.45) * (i / 2), c = i === on ? (i === 1 ? C.slime : C.red) : C.black; a.box(x - w * 0.5, y + w, z, x + w * 0.5, y + w + 0.012, z + 0.09, c, undefined, FLAT); a.box(x + w, y - w * 0.5, z, x + w + 0.012, y + w * 0.5, z + 0.09, c, undefined, FLAT); }
    a.box(x - 0.04, y - 0.04, h + 0.08, x + 0.04, y + 0.04, h + 0.16, Math.floor(t * 3 + y) % 2 ? C.red : C.black, undefined, FLAT);
    return a.faces;
  };
}

// ------------------------------------------------------------------------------------------------ builders
/** Hazard-striped iron crates, stacked. */
const crates: Builder = (m, r, _S, rnd) => {
  const n = Math.max(1, Math.round(r.w / 0.55)), k = Math.max(1, Math.round(r.d / 0.55));
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) {
    const x0 = r.x0 + (r.w * i) / n + 0.03, x1 = r.x0 + (r.w * (i + 1)) / n - 0.03, y0 = r.y0 + (r.d * j) / k + 0.03, y1 = r.y0 + (r.d * (j + 1)) / k - 0.03, h = 0.42 + rnd() * 0.12;
    m.box(x0, y0, 0, x1, y1, h, C.ironDk, C.iron);
    m.box(x0 - 0.005, y0 - 0.005, h * 0.36, x1 + 0.005, y1 + 0.005, h * 0.6, C.hazard, C.hazard);
    if (rnd() < 0.4) m.box(x0 + 0.06, y0 + 0.06, h, x1 - 0.08, y1 - 0.08, h + 0.3, C.rust, C.iron);
  }
};
/** A heap of bones with a few skulls and ribs standing out of it. */
const bones: Builder = (m, r, _S, rnd) => {
  const s = Math.min(r.w, r.d) / 2;
  m.blob(r.cx, r.cy, s * 0.25, s * 0.95, C.boneDk, 7, 0.5);
  for (let i = 0; i < 5; i++) { const a = rnd() * 6.3, d = rnd() * s * 0.6; skull(m, r.cx + Math.cos(a) * d, r.cy + Math.sin(a) * d, s * 0.45 + rnd() * s * 0.25, s * 0.2); }
  for (let i = 0; i < 4; i++) { const a = i * 1.6 + rnd(), d = s * 0.5; m.prism(r.cx + Math.cos(a) * d, r.cy + Math.sin(a) * d, s * 0.2, s * (0.9 + rnd() * 0.5), 0.03, 4, C.bone, 0.01); }
};
/** A blood fountain: an iron basin, a pool, a spout that pulses. */
const bloodFountain: Builder = (m, r) => {
  const s = Math.min(r.w, r.d) / 2;
  m.prism(r.cx, r.cy, 0, 0.3, s * 0.95, 8, C.ironDk, s * 0.95, C.iron);
  m.prism(r.cx, r.cy, 0.3, 0.31, s * 0.8, 8, C.blood, s * 0.8, C.blood, undefined, FLAT);
  m.prism(r.cx, r.cy, 0.3, 0.75, s * 0.16, 6, C.boneDk);
  skull(m, r.cx, r.cy, 0.92, s * 0.26);
  return (t) => {
    const a = new Mesh(), k = 0.5 + 0.5 * Math.sin(t * 4);
    for (let i = 0; i < 4; i++) { const ang = i * 1.57 + 0.4, d = s * (0.3 + 0.2 * k); a.box(r.cx + Math.cos(ang) * d - 0.03, r.cy + Math.sin(ang) * d - 0.03, 0.31, r.cx + Math.cos(ang) * d + 0.03, r.cy + Math.sin(ang) * d + 0.03, 0.5 + 0.25 * k, i % 2 ? C.bloodLt : C.blood, undefined, FLAT); }
    return a.faces;
  };
};
/** A gargoyle crouched on a plinth: horns, folded wings, two red eyes. */
const gargoyle: Builder = (m, r) => {
  const s = Math.min(r.w, r.d) / 2, x = r.cx, y = r.cy;
  m.box(x - s * 0.8, y - s * 0.8, 0, x + s * 0.8, y + s * 0.8, 0.5, C.ironDk, C.iron);
  m.box(x - s * 0.9, y - s * 0.9, 0.5, x + s * 0.9, y + s * 0.9, 0.58, C.iron);
  m.blob(x, y, 0.85, s * 0.6, C.ironDk, 6, 1.1);
  m.blob(x, y + s * 0.25, 1.25, s * 0.36, C.ironDk, 6, 1);
  for (const sd of [1, -1]) {
    m.prism(x + sd * s * 0.3, y + s * 0.2, 1.4, 1.75, 0.05, 4, C.bone, 0.008);
    m.panel([[x + sd * s * 0.3, y - s * 0.3, 0.7], [x + sd * s * 1.1, y - s * 0.6, 1.5], [x + sd * s * 0.7, y - s * 0.5, 0.75]], C.iron);
    m.box(x + sd * s * 0.1, y + s * 0.6, 1.22, x + sd * s * 0.26, y + s * 0.62, 1.3, C.red, undefined, FLAT);
  }
};
/** A row of impaled pikes (where the village had a fence). */
const pikes: Builder = (m, r, _S, rnd) => {
  const along = r.w >= r.d, n = Math.max(2, Math.round((along ? r.w : r.d) / 0.4));
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; impaled(m, along ? r.x0 + r.w * t : r.cx, along ? r.cy : r.y0 + r.d * t, 0.7 + rnd() * 0.5, rnd); }
};
/** Toxic drums: hazard yellow, a glowing slick on top. */
const drums: Builder = (m, r, _S, rnd) => {
  const n = Math.max(1, Math.round((r.w * r.d) / 0.2)), s = Math.min(r.w, r.d);
  for (let i = 0; i < Math.min(5, n); i++) {
    const x = r.x0 + 0.16 + rnd() * Math.max(0.01, r.w - 0.32), y = r.y0 + 0.16 + rnd() * Math.max(0.01, r.d - 0.32), rr = Math.min(0.15, s * 0.3);
    m.prism(x, y, 0, 0.44, rr, 8, i % 2 ? C.hazard : C.slimeDk, rr, C.ironDk);
    m.prism(x, y, 0.18, 0.26, rr * 1.04, 8, C.black, rr * 1.04, C.black);
    m.prism(x, y, 0.44, 0.45, rr * 0.7, 6, C.slime, rr * 0.7, C.slime, undefined, FLAT);
  }
};
/** A tech pillar or two (where the village had a market stall). */
const tech: Builder = (m, r) => {
  const a = pillar(m, r.cx - r.w * 0.22, r.cy, 1.0, Math.min(0.17, r.d * 0.3)), b = pillar(m, r.cx + r.w * 0.22, r.cy, 0.75, Math.min(0.15, r.d * 0.28));
  m.box(r.cx - r.w * 0.22, r.cy - 0.04, 0.5, r.cx + r.w * 0.22, r.cy + 0.04, 0.58, C.rust);
  return (t) => [...a(t), ...b(t)];
};
/** A portal arch: two horned iron piers, a lintel of bone, a sheet of light that flickers between them. */
const portal: Builder = (m, r) => {
  const along = r.w >= r.d, L = (along ? r.w : r.d) / 2, T = Math.min(0.28, (along ? r.d : r.w) / 2), h = 1.5;
  const P = (u: number, v: number): [number, number] => (along ? [r.cx + u, r.cy + v] : [r.cx + v, r.cy + u]);
  for (const sd of [1, -1]) {
    const [x0, y0] = P(sd * L - sd * 0.02, -T), [x1, y1] = P(sd * (L - 0.34), T);
    m.box(Math.min(x0, x1), Math.min(y0, y1), 0, Math.max(x0, x1), Math.max(y0, y1), h, C.ironDk, C.iron);
    const [hx, hy] = P(sd * (L - 0.17), 0);
    m.prism(hx, hy, h, h + 0.5, 0.09, 4, C.bone, 0.01);
    m.box(Math.min(x0, x1) - 0.01, Math.min(y0, y1) - 0.01, 0.12, Math.max(x0, x1) + 0.01, Math.max(y0, y1) + 0.01, 0.26, C.hazard, C.hazard);
  }
  const [a0, b0] = P(-L, -T * 0.8), [a1, b1] = P(L, T * 0.8);
  m.box(Math.min(a0, a1), Math.min(b0, b1), h, Math.max(a0, a1), Math.max(b0, b1), h + 0.2, C.boneDk, C.bone);
  const [sx, sy] = P(0, 0);
  skull(m, sx, sy, h + 0.36, 0.14);
  return (t) => {
    const a = new Mesh(), n = 4;
    for (let i = 0; i < n; i++) {
      const u0 = -L + 0.34 + ((2 * L - 0.68) * i) / n, u1 = -L + 0.34 + ((2 * L - 0.68) * (i + 1)) / n, [px0, py0] = P(u0, 0), [px1, py1] = P(u1, 0);
      const lit = Math.sin(t * 5 + i * 1.9) > 0.2;
      a.panel([[px0, py0, 0.02], [px1, py1, 0.02], [px1, py1, h], [px0, py0, h]], lit ? C.portalLt : C.portal, { ...FLAT, alpha: 0.75 });
    }
    return a.faces;
  };
};

/** Wrap a base building: the same block, with a roof vent and a warning light that blinks. */
const industrial = (base: Builder): Builder => (m, r, S, rnd, look) => {
  const anim = base(m, r, S, rnd, look) || undefined, h = HEIGHT[look] ?? 1.3, lx = r.x0 + 0.12, ly = r.y1 - 0.12;
  m.box(r.cx - 0.2, r.cy - 0.14, h * 0.9, r.cx + 0.2, r.cy + 0.14, h * 0.9 + 0.36, C.ironDk, C.iron);
  m.prism(lx, ly, h * 0.8, h * 0.8 + 0.5, 0.025, 4, C.ironDk);
  return (t) => {
    const a = new Mesh();
    a.box(lx - 0.045, ly - 0.045, h * 0.8 + 0.5, lx + 0.045, ly + 0.045, h * 0.8 + 0.59, Math.floor(t * 1.5 + r.cx) % 2 ? C.red : C.black, undefined, FLAT);
    return anim ? [...anim(t), ...a.faces] : a.faces;
  };
};

Object.assign(BUILDERS, {
  cover: crates, crates, haystack: bones, well: bloodFountain, fountain: bloodFountain, statue: gargoyle, fence: pikes, barrels: drums, stall: tech, gatehouse: portal,
  house: industrial(BUILDERS.house), building: industrial(BUILDERS.building), barn: industrial(BUILDERS.barn), shop: industrial(BUILDERS.shop),
});
Object.assign(HEIGHT, { haystack: 0.8, well: 1.1, fountain: 1.1, statue: 1.7, fence: 1.0, barrels: 0.45, stall: 1.1, gatehouse: 1.9 });

// ------------------------------------------------------------------------------------------------ marks and scenery
/** A tree: the kit's dead tree, or (one in three) a skull pike. */
export function tree(m: Mesh, x: number, y: number, s: number, S: WorldStyle, rnd: Rnd, kind = S.tree) {
  if (rnd() < 0.34) impaled(m, x, y, 0.9 * s + 0.3, rnd);
  else baseTree(m, x, y, s, S, rnd, kind);
}
/** A lamp: a hazard-footed pylon; its light is drawn by buildMark's animation, so here it glows steadily. */
export function lamp(m: Mesh, x: number, y: number, _S: WorldStyle) {
  m.box(x - 0.09, y - 0.09, 0, x + 0.09, y + 0.09, 0.1, C.hazard, C.ironDk);
  m.prism(x, y, 0.1, 0.9, 0.045, 4, C.ironDk);
  m.box(x - 0.07, y - 0.07, 0.9, x + 0.07, y + 0.07, 1.04, C.red, C.iron, FLAT);
}
/** A decoration mark that stands up (tree, lamp, banner, signpost). */
export function buildMark(k: ArenaMark, i: number, S: WorldStyle = TERRAIN): Built | null {
  const m = new Mesh(), rnd = seeded(i * 97 + 5), look = k.look as string;
  let anim: Built["anim"];
  if (look === "tree") tree(m, k.x, k.y, 0.9 + rnd() * 0.35, S, rnd);
  else if (look === "lamp") anim = pillar(m, k.x, k.y, 0.95, 0.07);
  else if (look === "banner") {
    m.prism(k.x, k.y, 0, 1.6, 0.03, 4, C.char);
    skull(m, k.x, k.y, 1.66, 0.09);
    anim = (t) => { const a = new Mesh(), n = 4; for (let j = 0; j < n; j++) { const u0 = j / n, u1 = (j + 1) / n, w = (u: number) => Math.sin(t * 3 + u * 5 + k.x) * 0.07 * u; a.panel([[k.x + u0 * 0.6, k.y + w(u0), 1.5], [k.x + u1 * 0.6, k.y + w(u1), 1.5], [k.x + u1 * 0.6, k.y + w(u1), 0.95 + (j % 2) * 0.12], [k.x + u0 * 0.6, k.y + w(u0), 0.95 + ((j + 1) % 2) * 0.12]], j % 2 ? C.char : C.blood, { ink: false }); } return a.faces; };
  }
  else if (look === "signpost") { m.prism(k.x, k.y, 0, 0.7, 0.035, 4, C.ironDk); m.box(k.x - 0.22, k.y - 0.02, 0.46, k.x + 0.22, k.y + 0.02, 0.66, C.hazard, C.hazard); }
  else return null;
  return { mesh: m, anim, h: 1.2 };
}
/** A rock for the scenery ring: the kit's, or a cluster of bone spikes. */
export function sceneryRock(m: Mesh, x: number, y: number, s: number, S: WorldStyle, rnd: Rnd) {
  if (rnd() < 0.45) { for (let i = 0; i < 4; i++) { const a = rnd() * 6.3, d = rnd() * s * 0.4; m.prism(x + Math.cos(a) * d, y + Math.sin(a) * d, 0, s * (0.8 + rnd() * 1.2), s * 0.16, 5, C.boneDk, 0.01); } return; }
  BUILDERS.rock(m, rcOf({ x, y, w: s, h: s * 0.8 }), S, rnd, "rock");
}
