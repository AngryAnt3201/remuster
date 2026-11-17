// Blackridge's materials and the kit its cast shares. Uniforms are neutral on both sides (olive, coyote, grey); a
// soldier's side is carried by the ring at his feet, a helmet band, armbands and an air-recognition panel on his back.
import { mat, team, type M34, type Material, type Model, type V3 } from "../../../artkit/toon3d";
import type { Pose } from "../../../artkit/rig";
import { HEAD_R, soldier, type SoldierOpts, type SoldierRig } from "./body";

const glowy = (c: string, glow = 0.5, o: Partial<Material> = {}) => mat(c, { emit: 1, ink: false, glow, ...o });

export const P = {
  // ---- people
  skin: mat("#b08a6c"), skinDk: mat("#7a5a44"), skinLt: mat("#c9a184"),
  olive: mat("#6c7254"), oliveDk: mat("#4a5039"), coyote: mat("#8b7b5c"), coyoteDk: mat("#665a44"), grey: mat("#646b70"), greyDk: mat("#3d4347"),
  black: mat("#24282b"), night: mat("#272b30"), white: mat("#c9cdc8"), sand: mat("#a79a7c"), navy: mat("#2f3a48"),
  boot: mat("#2b2824"), glove: mat("#2a2c2d"), web: mat("#4a4a3a"), ghillie: mat("#4c5236"), ghillie2: mat("#6a6644"),
  // ---- kit
  gun: mat("#2c3033", { metal: 0.45 }), gunLt: mat("#4a5054", { metal: 0.5 }), steel: mat("#8a9298", { metal: 0.8 }), steelDk: mat("#555c61", { metal: 0.6 }),
  brass: mat("#a8894a", { metal: 0.7 }), rubber: mat("#1c1d1f"), glass: mat("#27333a", { metal: 0.9 }), polymer: mat("#3a3d39"),
  armor: mat("#5d6456", { metal: 0.25 }), armorDk: mat("#424840", { metal: 0.25 }), armorLt: mat("#7b8270", { metal: 0.25 }), hull: mat("#6a705c", { metal: 0.2 }), hullDk: mat("#4a5042", { metal: 0.2 }),
  crate: mat("#59604a"), wood: mat("#6b5a44"), rust: mat("#6e4a36"), concrete: mat("#8a8d88"), sandbag: mat("#8a8163"), tarp: mat("#4f5a4e"),
  wire: mat("#9aa0a2", { metal: 0.9 }), hazard: mat("#d6a21e", { shade: 0.5 }), red: mat("#b8342a", { shade: 0.5 }),
  // ---- the side
  team: team("main", { shade: 0.3 }), teamDk: team("dark", { shade: 0.3 }), teamLt: team("light", { shade: 0.2 }),
  ring: team("main", { emit: 1, ink: false }), ringLt: team("light", { emit: 1, ink: false }), ringFill: team("main", { emit: 1, ink: false, alpha: 0.16 }),
  teamGlow: team("light", { emit: 1, ink: false, glow: 0.5 }),
  // ---- light and smoke
  flash: glowy("#ffe2a0", 0.7), flashHot: glowy("#fff6dc", 0.4), fire: glowy("#ff8a2a", 0.5), tracer: mat("#ffd27a", { emit: 1, ink: false }),
  arc: glowy("#bfe6ff", 0.7), arcHot: mat("#f2fbff", { emit: 1, ink: false }), heal: glowy("#7dffa0", 0.6), healLamp: mat("#6dff96", { emit: 1 }),
  nvg: glowy("#74ff9a", 0.45), cryo: glowy("#d6f4ff", 0.4), cryoMist: mat("#dff4fa", { emit: 0.8, ink: false, alpha: 0.55 }),
  warn: glowy("#ff3a2a", 0.6), amber: glowy("#ffb000", 0.5), lamp: glowy("#fff1c2", 0.8), water: mat("#bfd6e0", { emit: 0.7, ink: false, alpha: 0.7 }),
  dog: mat("#6b5238"), dogDk: mat("#2e2620"), dummy: mat("#b9ad8e", { shade: 0.6 }), dummyDk: mat("#8f8468", { shade: 0.6 }), cryoTank: mat("#bcd8e4", { metal: 0.6 }),
  rotorDisc: mat("#20242a", { ink: false, alpha: 0.16, shade: 0 }), rotor: mat("#2a2e32", { ink: false, alpha: 0.5, shade: 0.3 }), coat: mat("#4a5870"),
  smoke: mat("#3a3c3e", { ink: false, alpha: 0.6, shade: 0.4 }), smokeLt: mat("#8a8c8a", { ink: false, alpha: 0.5, shade: 0.4 }), dust: mat("#9a917c", { ink: false, alpha: 0.5, shade: 0.3 }),
};

/** A soldier with Blackridge's defaults: olive fatigues, black boots and gloves, team armbands. */
export function trooper(m: Model, p: Pose, o: Partial<SoldierOpts>): SoldierRig {
  return soldier(m, p, { skin: P.skin, torso: P.olive, legs: P.olive, boots: P.boot, hands: P.glove, band: P.team, ...o });
}
export const r = HEAD_R;

// ------------------------------------------------------------------------------------------------ the ring
/** The team ring every unit stands in: a bright hairline circle on the ground with a facing tick. Higher ranks add
 *  ticks, a second ring and, at the top rank, a ring in the side's light colour that glows. */
export function ring(m: Model, p: Pose, rad: number, z = 0.006) {
  if (p.dead > 0.75) return;
  const t = p.tier, w = 0.011 + 0.002 * t;
  m.group(() => {
    m.torus([0, 0, z], [0, 0, 1], rad, w, t >= 4 ? P.teamGlow : P.ring, { segs: 28 });
    m.disc([0, 0, z - 0.003], [0, 0, 1], rad, P.ringFill, { segs: 24 });
    if (t >= 3) m.torus([0, 0, z], [0, 0, 1], rad * 0.8, w * 0.6, P.ring, { segs: 24 });
    // the facing tick, and one pip per rank above the first round the back
    m.poly([[rad + 0.075, 0, z], [rad + 0.012, 0.04, z], [rad + 0.012, -0.04, z]], t >= 4 ? P.ringLt : P.ring);
    for (let i = 0; i < t - 1; i++) { const a = Math.PI + (i - (t - 2) / 2) * 0.34; m.box([Math.cos(a) * (rad + 0.035), Math.sin(a) * (rad + 0.035), z], [0.045, 0.045, 0.006], t >= 4 ? P.ringLt : P.ring); }
  });
}

// ------------------------------------------------------------------------------------------------ headgear (head frame)
/** A combat helmet: high-cut shell, ear cups, a team band round it and a recognition square on top. */
export function helmet(m: Model, col: Material = P.olive, o: { band?: Material | null; nvg?: boolean; nvgOn?: boolean; visor?: boolean; panel?: boolean; k?: number } = {}) {
  const k = (o.k ?? 1) * r;
  m.group(() => {
    m.ellipsoid([-k * 0.08, 0, k * 0.3], [k * 1.3, k * 1.22, k * 1.05], col, { segs: 12 });
    for (const s of [1, -1]) m.ellipsoid([-k * 0.1, s * k * 1.0, -k * 0.1], [k * 0.42, k * 0.3, k * 0.5], P.black, { segs: 8 });
  });
  const band = o.band === undefined ? P.team : o.band;
  if (band) m.decal(0.012, () => m.cylinder([-k * 0.08, 0, k * 0.2], [-k * 0.08, 0, k * 0.52], k * 1.31, band, k * 1.2, { segs: 12 }));
  if (o.panel !== false && band) m.decal(0.02, () => m.box([-k * 0.2, 0, k * 1.33], [k * 0.9, k * 0.9, k * 0.06], band));
  if (o.visor) m.decal(0.015, () => m.box([k * 0.95, 0, k * 0.05], [k * 0.3, k * 1.5, k * 0.55], P.glass));
  if (o.nvg) m.group(() => {
    m.box([k * 1.15, 0, k * 0.75], [k * 0.3, k * 0.3, k * 0.3], P.black);
    for (const s of [1, -1]) m.cylinder([k * 1.1, s * k * 0.3, o.nvgOn ? k * 0.2 : k * 0.95], [k * 1.6, s * k * 0.3, o.nvgOn ? k * 0.2 : k * 1.1], k * 0.2, P.black, k * 0.22, { segs: 8 });
    if (o.nvgOn) for (const s of [1, -1]) m.decal(0.02, () => m.sphere([k * 1.6, s * k * 0.3, k * 0.2], k * 0.17, P.nvg, { segs: 6 }));
  });
}
/** A soft cap or beret: `flop` pulls it over one ear. */
export function beret(m: Model, col: Material, flash: Material | null = P.team) {
  m.group(() => { m.ellipsoid([-r * 0.1, r * 0.25, r * 0.78], [r * 1.25, r * 1.4, r * 0.42], col, { segs: 12 }); m.cylinder([0, 0, r * 0.4], [0, 0, r * 0.7], r * 1.04, col, r * 1.1, { segs: 12 }); });
  if (flash) m.decal(0.02, () => m.box([r * 0.85, -r * 0.35, r * 0.72], [r * 0.2, r * 0.5, r * 0.45], flash));
}
/** A boonie hat. */
export function boonie(m: Model, col: Material, band: Material | null = P.team) {
  m.group(() => { m.cylinder([0, 0, r * 0.45], [0, 0, r * 0.55], r * 1.9, col, r * 1.8, { segs: 14 }); m.ellipsoid([0, 0, r * 0.6], [r * 1.1, r * 1.05, r * 0.7], col, { segs: 12 }); });
  if (band) m.decal(0.015, () => m.cylinder([0, 0, r * 0.56], [0, 0, r * 0.82], r * 1.1, band, r * 1.0, { segs: 12 }));
}
/** A hood (ghillie, poncho, hazmat): covers the head and neck, an opening at the face. */
export function hood(m: Model, col: Material, shaggy: Material | null = null) {
  m.group(() => { m.ellipsoid([-r * 0.2, 0, r * 0.1], [r * 1.35, r * 1.3, r * 1.4], col, { segs: 12 }); m.cone([-r * 0.3, 0, -r * 1.9], [-r * 0.2, 0, r * 0.4], r * 2.1, col, { segs: 12 }); });
  m.decal(0.02, () => m.ellipsoid([r * 0.95, 0, -r * 0.05], [r * 0.3, r * 0.7, r * 0.75], P.night, { segs: 8 }));
  if (shaggy) for (let i = 0; i < 7; i++) { const a = i * 2.4; m.cone([Math.cos(a) * r * 0.8 - r * 0.3, Math.sin(a) * r * 0.9, r * 0.9], [Math.cos(a) * r * 1.9 - r * 0.4, Math.sin(a) * r * 1.9, r * 0.1], r * 0.4, shaggy, { segs: 4 }); }
}
/** A respirator / full-face mask over the lower face, two filters. */
export function mask(m: Model, lens: Material = P.glass) {
  m.decal(0.015, () => m.group(() => {
    m.ellipsoid([r * 0.7, 0, -r * 0.3], [r * 0.6, r * 0.75, r * 0.6], P.black, { segs: 8 });
    for (const s of [1, -1]) { m.cylinder([r * 0.9, s * r * 0.55, -r * 0.5], [r * 1.25, s * r * 0.8, -r * 0.6], r * 0.3, P.greyDk, r * 0.3, { segs: 8 }); m.sphere([r * 0.98, s * r * 0.42, r * 0.22], r * 0.27, lens, { segs: 6 }); }
  }));
}

// ------------------------------------------------------------------------------------------------ body kit (rig frames)
/** A plate carrier: front and back plates, shoulder straps, a row of pouches, a team recognition panel on the back. */
export function carrier(m: Model, h: SoldierRig, col: Material = P.coyoteDk, o: { pouches?: Material | null; panel?: Material | null; thick?: number } = {}) {
  const b = h.bulk, th = o.thick ?? 1;
  m.at(h.chest, () => {
    m.group(() => {
      m.box([0.062 * b, 0, 0.035], [0.05 * th, 0.185 * b, 0.21], col);
      m.box([-0.058 * b, 0, 0.045], [0.05 * th, 0.185 * b, 0.22], col);
      for (const s of [1, -1]) { m.box([0, s * 0.075 * b, 0.148], [0.15 * b, 0.05, 0.03], col); m.box([0, s * 0.1 * b, -0.02], [0.13 * b, 0.02, 0.09], col); }
    });
    const pc = o.pouches === undefined ? P.web : o.pouches;
    if (pc) m.group(() => { for (const y of [-0.06, 0, 0.06]) m.box([0.098 * b * (0.9 + 0.1 * th), y * b, -0.03], [0.04, 0.05, 0.085], pc); });
    const pn = o.panel === undefined ? P.team : o.panel;
    if (pn) m.decal(0.015, () => m.box([-0.086 * b * (0.9 + 0.1 * th), 0, 0.08], [0.012, 0.13 * b, 0.11], pn));
  });
}
/** A pack on the back: `d` deep, `w` wide, `hgt` tall, with a team panel on its lid. */
export function pack(m: Model, h: SoldierRig, col: Material, d = 0.09, w = 0.17, hgt = 0.24, panel: Material | null = P.team) {
  m.at(h.back, () => {
    m.group(() => { m.box([0.03 + d / 2, 0, 0.0], [d, w, hgt], col); m.box([0.035 + d, 0, -0.04], [0.03, w * 0.7, hgt * 0.45], col); });
    if (panel) m.decal(0.015, () => m.box([0.03 + d / 2, 0, hgt / 2 + 0.004], [d * 0.8, w * 0.8, 0.012], panel));
  });
}
/** A helmet-and-plate rank touch: shoulder armour from rank 2, a glowing chem-light on the shoulder at rank 4. */
export function rankKit(m: Model, h: SoldierRig, p: Pose, armor: Material = P.coyoteDk) {
  const b = h.bulk;
  if (p.tier >= 2) m.at(h.chest, () => { for (const s of [1, -1]) m.ellipsoid([0, s * 0.128 * b, 0.13], [0.055, 0.05, 0.04], armor, { segs: 8 }); });
  if (p.tier >= 4) m.at(h.chest, () => { for (const s of [1, -1]) m.decal(0.02, () => m.capsule([0.02, s * 0.13 * b, 0.165], [-0.03, s * 0.13 * b, 0.165], 0.014, P.teamGlow, 0.014, { segs: 6 })); });
}

// ------------------------------------------------------------------------------------------------ weapons (grip frame: +x down the barrel)
/** A carbine: stock back from the grip, magazine below, optic on top, barrel out front. `len` is muzzle distance. */
export function rifle(m: Model, tier: number, o: { len?: number; lmg?: boolean; long?: boolean; col?: Material } = {}): number {
  const L = o.len ?? (o.long ? 0.52 : 0.4), c = o.col ?? P.gun;
  m.group(() => {
    m.box([0.07, 0, 0.022], [0.2, 0.026, 0.05], c);
    m.box([-0.1, 0, 0.012], [0.16, 0.022, 0.045], c);
    m.box([-0.185, 0, 0.0], [0.02, 0.026, 0.075], P.rubber);
    m.box([0.2, 0, 0.022], [0.12, 0.034, 0.04], o.lmg ? c : P.polymer);
    m.cylinder([0.24, 0, 0.026], [L, 0, 0.026], 0.0095, P.gunLt, 0.0095, { segs: 6 });
    m.box([0.0, 0, -0.035], [0.028, 0.022, 0.06], c);
  });
  m.with(() => { m.move(0.075, 0, -0.03).rotY(-12); m.box([0, 0, -0.03], [o.lmg ? 0.09 : 0.034, o.lmg ? 0.07 : 0.02, o.lmg ? 0.07 : 0.085], o.lmg ? P.armorDk : P.gunLt); });
  if (tier >= 2 || o.long) m.group(() => { m.cylinder([0.03, 0, 0.066], [0.13 + (o.long ? 0.08 : 0), 0, 0.066], 0.016, P.black, 0.018, { segs: 8 }); m.box([0.07, 0, 0.05], [0.04, 0.014, 0.02], P.black); });
  if (tier >= 3) m.cylinder([L, 0, 0.026], [L + 0.1, 0, 0.026], 0.017, P.black, 0.017, { segs: 8 });
  if (tier >= 4) m.decal(0.01, () => m.box([0.2, 0, 0.045], [0.1, 0.036, 0.008], P.teamGlow));
  if (o.long) for (const s of [1, -1]) m.capsule([L - 0.1, 0, 0.02], [L - 0.06, s * 0.07, -0.12], 0.007, P.gunLt, 0.006, { segs: 5 });
  return L + (tier >= 3 ? 0.1 : 0);
}
/** A muzzle flash at `at`, firing along +x: a hot core, a star of tongues, a lick of smoke. */
export function flash(m: Model, at: V3, s = 1) {
  m.group(() => {
    m.cone([at[0], at[1], at[2]], [at[0] + 0.22 * s, at[1], at[2]], 0.05 * s, P.flash, { segs: 6 });
    for (const a of [35, 145, 215, 325]) { const c = Math.cos(a / 57.3), q = Math.sin(a / 57.3); m.cone([at[0] + 0.01, at[1], at[2]], [at[0] + 0.09 * s, at[1] + c * 0.11 * s, at[2] + q * 0.11 * s], 0.028 * s, P.flash, { segs: 4 }); }
    m.sphere([at[0] + 0.03 * s, at[1], at[2]], 0.04 * s, P.flashHot, { segs: 6 });
  });
}
/** A soft ball of smoke / dust / mist. */
export function puff(m: Model, at: V3, s: number, col: Material = P.smokeLt) {
  m.group(() => { m.sphere(at, s, col, { segs: 7 }); m.sphere([at[0] + s * 0.7, at[1] + s * 0.4, at[2] + s * 0.5], s * 0.7, col, { segs: 6 }); m.sphere([at[0] - s * 0.5, at[1] - s * 0.5, at[2] + s * 0.6], s * 0.6, col, { segs: 6 }); });
}
/** A pistol (one hand): +x down the barrel. */
export function pistol(m: Model, c: Material = P.gun) {
  m.group(() => { m.box([0.05, 0, 0.022], [0.13, 0.022, 0.034], c); m.box([-0.005, 0, -0.025], [0.03, 0.02, 0.07], c); });
}
/** A fighting knife or machete: +x along the blade. */
export function knife(m: Model, L: number, blade: Material = P.steel, w = 0.026) {
  m.group(() => { m.capsule([-0.05, 0, 0], [0.02, 0, 0], 0.014, P.rubber, 0.014, { segs: 6 }); m.box([0.025, 0, 0], [0.012, 0.045, 0.02], P.gun); });
  m.extrude([[0.03, -w / 2], [L - 0.04, -w / 2], [L, w * 0.2], [L - 0.06, w / 2], [0.03, w / 2]], 0.006, blade);
}
/** A long-handled tool: `head` builds its working end at the far end of the shaft (+x). */
export function tool(m: Model, L: number, head: () => void, shaft: Material = P.wood, rad = 0.012) {
  m.capsule([-0.12, 0, 0], [L, 0, 0], rad, shaft, rad, { segs: 6 });
  m.with(() => { m.move(L, 0, 0); head(); });
}
/** A sweep of motion blur for a melee blow, in body space about `c`: radius, from/to angle (degrees, 0 forward). */
export function swish(m: Model, f: M34, c: V3, rad: number, a0: number, a1: number, tilt = 0, col: Material = P.cryoMist) {
  m.at(f, () => m.with(() => {
    m.move(c[0], c[1], c[2]).rotX(tilt * 57.3);
    const pts: V3[] = [], n = 7;
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * (i / n)) / 57.3; pts.push([Math.cos(a) * rad, Math.sin(a) * rad, 0]); }
    m.tube(pts, pts.map((_, i) => 0.004 + 0.018 * Math.sin((i / n) * Math.PI)), col, { segs: 4 });
  }));
}
/** A jagged electric arc from a to b. */
export function arc(m: Model, a: V3, b: V3, seed: number, col: Material = P.arc, w = 0.012) {
  const pts: V3[] = [], n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = i === 0 || i === n ? 0 : 0.07;
    pts.push([a[0] + (b[0] - a[0]) * t + Math.sin(seed * 3.1 + i * 5.3) * j, a[1] + (b[1] - a[1]) * t + Math.sin(seed * 1.7 + i * 4.1) * j, a[2] + (b[2] - a[2]) * t + Math.cos(seed * 2.3 + i * 3.7) * j]);
  }
  m.tube(pts, w, col, { segs: 4 });
}
/** A whip antenna from `a`, height `L`, swaying; an optional pennant at its tip. */
export function antenna(m: Model, a: V3, L: number, sway: number, pennant: Material | null = null) {
  const tip: V3 = [a[0] - sway * 2, a[1] + sway, a[2] + L];
  m.tube([a, [a[0] - sway * 0.5, a[1] + sway * 0.3, a[2] + L * 0.5], tip], [0.008, 0.006, 0.004], P.gun, { segs: 5 });
  if (pennant) m.poly([tip, [tip[0] - 0.16, tip[1] + sway, tip[2] - 0.035], [tip[0] - 0.005, tip[1], tip[2] - 0.09]], pennant);
}

// ------------------------------------------------------------------------------------------------ vehicle parts
/** A wheel on the y axis at c (side +-1 puts the hub outward). */
export function wheel(m: Model, c: V3, rad: number, w: number, spin: number, side = 1) {
  m.with(() => {
    m.move(c[0], c[1], c[2]).rotY(spin);
    m.group(() => { m.cylinder([0, -w / 2, 0], [0, w / 2, 0], rad, P.rubber, rad, { segs: 14 }); m.cylinder([0, side * w / 2, 0], [0, side * (w / 2 + 0.008), 0], rad * 0.55, P.steelDk, rad * 0.5, { segs: 8 }); });
    for (let i = 0; i < 4; i++) m.decal(0.004, () => m.box([Math.cos(i * 1.571) * rad * 0.3, side * (w / 2 + 0.01), Math.sin(i * 1.571) * rad * 0.3], [0.02, 0.006, 0.02], P.gun));
  });
}
/** A track unit along x: length L, height hgt, width w, with road wheels and moving link marks. */
export function track(m: Model, c: V3, L: number, hgt: number, w: number, spin: number) {
  m.with(() => {
    m.move(c[0], c[1], c[2]);
    m.group(() => {
      m.box([0, 0, 0], [L - hgt, w, hgt], P.rubber);
      for (const s of [1, -1]) m.cylinder([s * (L - hgt) / 2, -w / 2, 0], [s * (L - hgt) / 2, w / 2, 0], hgt / 2, P.rubber, hgt / 2, { segs: 10 });
    });
    const n = Math.max(3, Math.round(L / (hgt * 0.95)));
    for (let i = 0; i < n; i++) for (const s of [1, -1]) m.decal(0.006, () => m.cylinder([-(L - hgt) / 2 + (i / (n - 1)) * (L - hgt), s * w / 2, -hgt * 0.08], [-(L - hgt) / 2 + (i / (n - 1)) * (L - hgt), s * (w / 2 + 0.006), -hgt * 0.08], hgt * 0.33, P.steelDk, hgt * 0.3, { segs: 8 }));
    // link marks slide with the travel
    const k = 9, off = (((-spin / 360) * 3) % 1 + 1) % 1;
    for (let i = 0; i < k; i++) { const x = -L / 2 + hgt * 0.4 + ((i + off) / k) * (L - hgt * 0.8); m.decal(0.006, () => m.box([x, 0, hgt / 2 + 0.002], [0.012, w * 1.02, 0.006], P.gun)); }
  });
}
/** Black smoke and a lick of fire rolling off a wreck: k 0..1 through the death clip. */
export function burn(m: Model, at: V3, k: number, s = 1) {
  if (k <= 0.15) return;
  const n = 3;
  for (let i = 0; i < n; i++) puff(m, [at[0] - 0.05 * i * s, at[1] + 0.03 * i * s, at[2] + (0.1 + 0.16 * i) * s * k], (0.07 + 0.035 * i) * s * (0.6 + 0.5 * k), P.smoke);
  if (k < 0.85) m.cone([at[0], at[1], at[2]], [at[0] - 0.02, at[1], at[2] + 0.16 * s], 0.06 * s, P.fire, { segs: 5 });
}
