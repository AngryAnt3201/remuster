// Sprite-sheet VFX: every battle event and field in docs/EVENTS.md maps to sheets that exist in base/public/vfx/atlas.json,
// and the anim timeline (frames, fades, thrown arcs) behaves.
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import type { BattleEvent, BoomKind } from "../engine/core/battle";
import type { BodyKind } from "../engine/core/defs";
import { Fx, animAlpha, animFrame } from "../base/src/render/fx";
import { FLYER_Z } from "../base/src/render/board";
import { DROP_TIME, FIELD_VFX, PROJ_VFX, playDrop, playEvent, setVfxManifest, type VfxEnv, type VfxManifest } from "../base/src/render/vfx";

const root = new URL("../", import.meta.url);
const manifest: VfxManifest = JSON.parse(readFileSync(new URL("base/public/vfx/atlas.json", root), "utf8"));
const doc = readFileSync(new URL("docs/EVENTS.md", root), "utf8");

const BODIES: Record<number, { kind: BodyKind; side: 0 | 1 }> = { 1: { kind: "ranger", side: 0 }, 2: { kind: "banner", side: 0 }, 3: { kind: "medic", side: 1 }, 4: { kind: "tinker", side: 0 } };
const env = (textured = true): VfxEnv => ({
  find: (id) => BODIES[id] && { x: 4, y: 7, face: 0, radius: 0.35, alive: true, ...BODIES[id] },
  bodies: [{ x: 4, y: 7, kind: "ranger", side: 0, alive: true, radius: 0.35 }],
  time: 3,
  textured,
});

const BOOMS: BoomKind[] = ["mine", "grenade", "slam", "quake", "erupt", "shell", "shrapnel", "bomblet", "keg", "pop", "talon", "mirror"];

/** One sample of every event (and every variant the renderer treats differently). */
const SAMPLES: BattleEvent[] = [
  { t: "slash", id: 1, x: 4, y: 7, a: 0, r: 0.8, side: 0 },
  { t: "slash", id: 1, x: 4, y: 7, a: 0, r: 1.2, side: 1, spin: true },
  ...(["arrow", "bolt", "grenade", "shard", "shell", "pellet"] as const).map((kind): BattleEvent => ({ t: "shot", id: 1, kind, x: 4, y: 7 })),
  { t: "hit", id: 1, x: 4, y: 7, dmg: 12, side: 0 },
  { t: "hit", id: 1, x: 4, y: 7, dmg: 30, side: 1, big: true },
  { t: "hit", id: 1, x: 4, y: 7, dmg: 6, side: 0, shielded: true },
  ...BOOMS.map((kind): BattleEvent => ({ t: "boom", x: 4, y: 7, r: 1.2, kind, side: 0 })),
  { t: "zap", pts: [[1, 1], [3, 2], [5, 5]], side: 0 },
  { t: "heal", from: 3, to: 1, x: 4, y: 7, amt: 10 },
  { t: "heal", from: 2, to: 1, x: 4, y: 7, amt: 4 },
  { t: "heal", from: 1, to: 1, x: 4, y: 7, amt: 4 },
  ...(["mite", "queen", "golemling", "thrall", "turret", "decoy"] as BodyKind[]).map((kind): BattleEvent => ({ t: "spawn", id: 9, x: 4, y: 7, side: 1, kind, from: 1 })),
  ...(["ranger", "mite", "keg", "golem", "turret"] as BodyKind[]).map((kind): BattleEvent => ({ t: "death", id: 9, x: 4, y: 7, kind, side: 1 })),
  { t: "blink", id: 1, x0: 2, y0: 2, x: 4, y: 7, side: 0 },
  { t: "charge", id: 1, x: 4, y: 7, a: 1 },
  { t: "fuse", id: 1, x: 4, y: 7 },
  { t: "burrow", id: 1, x: 4, y: 7, side: 0 },
  { t: "dig", id: 1, x: 4, y: 7 },
  { t: "emerge", id: 1, x: 4, y: 7, r: 1, side: 0, big: false },
  { t: "emerge", id: 1, x: 4, y: 7, r: 2, side: 0, big: true },
  { t: "dive", id: 1, x: 4, y: 7, target: 3, tx: 5, ty: 9, side: 0 },
  { t: "chill", id: 1, x: 4, y: 7, dur: 2 },
  { t: "freeze", id: 1, x: 4, y: 7, dur: 2 },
  { t: "aura", id: 2, x: 4, y: 7, r: 2, side: 0, rally: false },
  { t: "aura", id: 2, x: 4, y: 7, r: 2, side: 0, rally: true },
  { t: "parry", id: 1, x: 4, y: 7, by: 3, riposte: false },
  { t: "parry", id: 1, x: 4, y: 7, by: 3, riposte: true },
  { t: "brace", id: 1, x: 4, y: 7, a: 0 },
  { t: "impale", id: 1, target: 3, x: 4, y: 7 },
  { t: "raise", id: 9, from: 1, x: 4, y: 7, side: 0 },
  { t: "build", id: 4, x: 4, y: 7, dur: 1.2 },
  { t: "repair", from: 4, to: 9, x: 4, y: 7, amt: 5 },
  { t: "decoy", id: 9, from: 1, x: 4, y: 7, side: 0 },
  { t: "pop", id: 9, x: 4, y: 7, side: 0 },
  { t: "light", id: 1, x: 4, y: 7 },
  { t: "kegdrop", x: 4, y: 7, at: 5, side: 0 },
  { t: "bomblets", x: 4, y: 7, pts: [[3, 6], [5, 6], [4, 8]], at: 4, side: 0 },
  { t: "zone", id: 1, x: 4, y: 7, r: 1, until: 6, side: 0 },
  { t: "zone", id: 1, x: 4, y: 7, r: 1, until: 6, side: 0, kind: "thorn", root: true },
  { t: "hook", id: 1, target: 3, x: 4, y: 7, tx: 4, ty: 10, side: 0 },
  { t: "reel", id: 1, target: 3, x: 4, y: 10 },
  { t: "ward", id: 3, from: 1, x: 4, y: 7, amt: 55 },
  { t: "wardbreak", id: 3, x: 4, y: 7, side: 0, burst: false },
  { t: "wardbreak", id: 3, x: 4, y: 7, side: 0, burst: true },
  { t: "revive", id: 1, from: 3, x: 4, y: 7 },
  { t: "soar", id: 1, x: 4, y: 7, side: 0, second: true },
  { t: "swoop", id: 1, x: 4, y: 7, r: 1, side: 0, second: false },
  { t: "boom", x: 4, y: 7, r: 1, kind: "swoop", side: 0 },
  { t: "wave", id: 9, from: 1, x: 4, y0: 12, y1: 6, w: 1.5, dur: 1.1, side: 0, surf: true },
  { t: "zone", id: 1, x: 4, y: 7, r: 0.8, until: 6, side: 0, kind: "surf" },
  { t: "rally", id: 1, x: 4, y: 7, r: 2.2, side: 0, n: 3 },
  { t: "laststand", id: 1, x: 4, y: 7, until: 3 },
  { t: "volley", id: 1, x: 4, y: 7, a: 0 },
  { t: "twin", id: 1, x: 4, y: 7, a: 0 },
  { t: "reset", id: 1, x: 4, y: 7 },
  { t: "end", winner: 0 },
];

beforeAll(() => setVfxManifest(manifest));

describe("vfx atlas", () => {
  it("every sheet fits inside the atlas and its frames tile without overlap", () => {
    const rects: [string, number, number, number, number][] = [];
    for (const [name, sh] of Object.entries(manifest.sheets)) {
      const rows = Math.ceil(sh.frames / sh.cols);
      const w = sh.cols * (sh.w + sh.gap) - sh.gap, h = rows * (sh.h + sh.gap) - sh.gap;
      expect(sh.x + w, name).toBeLessThanOrEqual(manifest.w);
      expect(sh.y + h, name).toBeLessThanOrEqual(manifest.h);
      expect(sh.frames, name).toBeGreaterThan(0);
      rects.push([name, sh.x, sh.y, w, h]);
    }
    for (const a of rects) for (const b of rects) {
      if (a === b) continue;
      const overlap = a[1] < b[1] + b[3] && b[1] < a[1] + a[3] && a[2] < b[2] + b[4] && b[2] < a[2] + a[4];
      expect(overlap, `${a[0]} overlaps ${b[0]}`).toBe(false);
    }
  });

  it("the sheets for persistent fields and projectiles exist", () => {
    for (const [field, sheets] of Object.entries(FIELD_VFX)) for (const n of sheets) expect(manifest.sheets[n], `${field} -> ${n}`).toBeDefined();
    for (const [kind, p] of Object.entries(PROJ_VFX)) expect(manifest.sheets[p.sheet], `${kind} -> ${p.sheet}`).toBeDefined();
    for (const kind of ["arrow", "bolt", "grenade", "shard", "shell", "pellet"]) expect(PROJ_VFX[kind], kind).toBeDefined();
  });
});

describe("battle events -> sheets", () => {
  it("covers every event named in docs/EVENTS.md and every boom kind", () => {
    const named = new Set([...doc.matchAll(/^- `(\w+) \{/gm)].map((m) => m[1]));
    for (const m of doc.matchAll(/`(blink|charge|fuse|end) \{/g)) named.add(m[1]);
    const sampled = new Set(SAMPLES.map((e) => e.t));
    expect(named.size).toBeGreaterThan(30);
    for (const n of named) expect(sampled.has(n as BattleEvent["t"]), `sample for ${n}`).toBe(true);
    const booms = doc.match(/`boom \{[^\n]*/)![0];
    for (const k of [...booms.matchAll(/`(\w+)`/g)].map((m) => m[1])) expect(BOOMS, `boom kind ${k}`).toContain(k);
  });

  for (const e of SAMPLES) {
    const label = e.t + ("kind" in e ? ` ${e.kind}` : "") + ("spin" in e && e.spin ? " spin" : "") + ("big" in e && e.big ? " big" : "") + ("shielded" in e && e.shielded ? " shielded" : "") + ("rally" in e && e.rally ? " rally" : "") + ("riposte" in e && e.riposte ? " riposte" : "");
    it(`${label} plays at least one sheet, all of them in the atlas`, () => {
      const fx = new Fx();
      const sounds: string[] = [];
      playEvent(fx, e, { ...env(), sound: (n) => sounds.push(n) });
      expect(fx.anims.length, label).toBeGreaterThan(0);
      for (const an of fx.anims) {
        expect(manifest.sheets[an.sheet], `${label}: ${an.sheet}`).toBeDefined();
        expect(an.size, `${label}: ${an.sheet} size`).toBeGreaterThan(0);
        expect(an.max, `${label}: ${an.sheet} max`).toBeGreaterThan(0);
        if (an.tint) expect(an.tint, `${label}: ${an.sheet} tint`).toMatch(/^(#|rgb)/);
      }
    });
  }

  it("a hit on a flyer plays at the flyer's height (sparks, debris, the number), ground decals stay down", () => {
    const e: BattleEvent = { t: "hit", id: 1, x: 4, y: 7, dmg: 30, side: 1, big: true };
    const ground = new Fx(); playEvent(ground, e, env());
    const air = new Fx(); playEvent(air, e, { ...env(), lift: (id) => (id === 1 ? 0.9 : 0) });
    expect(air.anims.length).toBe(ground.anims.length);
    air.anims.forEach((an, i) => expect(an.z, an.sheet).toBeCloseTo(ground.anims[i].z + (an.layer === "air" ? 0.9 : 0)));
    expect(air.anims.every((an) => an.layer !== "air" || an.z >= FLYER_Z)).toBe(true);
    air.parts.forEach((p, i) => expect(p.z).toBeGreaterThan(ground.parts[i].z + 0.8));
    expect(air.floats[0].z).toBeCloseTo(0.9);
    // A body on foot is untouched, and so is an event that is not at a body (a blast).
    const foot = new Fx(); playEvent(foot, e, { ...env(), lift: () => 0 });
    expect(foot.anims.map((an) => an.z)).toEqual(ground.anims.map((an) => an.z));
    const boom = new Fx(); playEvent(boom, { t: "boom", x: 4, y: 7, r: 1, kind: "grenade", side: 0 }, { ...env(), lift: () => 0.9 });
    const boom0 = new Fx(); playEvent(boom0, { t: "boom", x: 4, y: 7, r: 1, kind: "grenade", side: 0 }, env());
    expect(boom.anims.map((an) => an.z)).toEqual(boom0.anims.map((an) => an.z));
  });

  it("lightning draws one stretched strip per jump when textured, the vector bolt otherwise", () => {
    const e: BattleEvent = { t: "zap", pts: [[1, 1], [4, 1], [4, 5]], side: 0 };
    const a = new Fx(); playEvent(a, e, env(true));
    const zaps = a.anims.filter((x) => x.sheet === "zap");
    expect(zaps.map((x) => x.w)).toEqual([3 * 1.08, 4 * 1.08]);
    expect(a.bolts.length).toBe(0);
    const b = new Fx(); playEvent(b, e, env(false));
    expect(b.bolts.length).toBe(1);
  });

  it("fiery blasts leave smoke and a scorch decal on the ground", () => {
    for (const kind of ["mine", "grenade", "shell", "keg", "bomblet", "shrapnel"] as BoomKind[]) {
      const fx = new Fx();
      playEvent(fx, { t: "boom", x: 4, y: 7, r: 1, kind, side: 0 }, env());
      const sheets = fx.anims.map((x) => x.sheet);
      expect(sheets, kind).toContain("fireball");
      expect(sheets, kind).toContain("smoke");
      expect(fx.anims.find((x) => x.sheet === "scorch")?.layer, kind).toBe("ground");
    }
  });

  it("the deploy drop-in lands with dust after its fall", () => {
    const fx = new Fx();
    playDrop(fx, 4, 7, 0.35, 0);
    const dust = fx.anims.find((x) => x.sheet === "dust")!;
    expect(dust.delay).toBeCloseTo(DROP_TIME);
    expect(fx.anims.find((x) => x.sheet === "shadow")?.max).toBeCloseTo(DROP_TIME);
  });
});

describe("anim timeline", () => {
  it("plays once across its life, loops when asked, and holds a frame", () => {
    const fx = new Fx();
    const once = fx.anim("smoke", 0, 0, { size: 1, max: 1 });
    const loop = fx.anim("flame", 0, 0, { size: 1, max: 10, loop: 8 });
    const held = fx.anim("smoke", 0, 0, { size: 1, max: 1, frame: 3 });
    expect(animFrame(once, 8)).toBe(0);
    fx.update(0.5);
    expect(animFrame(once, 8)).toBe(4);
    expect(animFrame(loop, 8)).toBe(4);
    expect(animFrame(held, 8)).toBe(3);
    fx.update(0.6);
    expect(fx.anims).not.toContain(once);
    fx.update(0.4); // age 1.5 s at 8 fps = frame 12 -> wraps to 4
    expect(animFrame(loop, 8)).toBe(4);
  });

  it("waits out its delay, fades in and out", () => {
    const fx = new Fx();
    const an = fx.anim("smoke", 0, 0, { size: 1, max: 1, delay: 0.2, fadeIn: 0.2, fadeOut: 0.5 });
    fx.update(0.2);
    expect(an.life).toBe(1);
    fx.update(0.1);
    expect(animAlpha(an)).toBeCloseTo(0.5);
    fx.update(0.6);
    expect(animAlpha(an)).toBeCloseTo(0.6);
  });

  it("a thrown arc starts at its origin, peaks halfway and lands on target", () => {
    const fx = new Fx();
    const an = fx.anim("bomb", 0, 0, { size: 0.3, max: 1, path: { x0: 1, y0: 2, x1: 3, y1: 6, h: 0.9 } });
    expect([an.x, an.y]).toEqual([1, 2]);
    fx.update(0.5);
    expect(an.x).toBeCloseTo(2); expect(an.y).toBeCloseTo(4); expect(an.z).toBeCloseTo(0.9);
    fx.update(0.49);
    expect(an.x).toBeCloseTo(3, 1); expect(an.z).toBeLessThan(0.05);
  });

  it("caps live anims and clears them", () => {
    const fx = new Fx();
    for (let i = 0; i < 500; i++) fx.anim("spark", 0, 0, { size: 0.5, max: 5 });
    fx.update(0.01);
    expect(fx.anims.length).toBe(400);
    fx.clear();
    expect(fx.anims.length).toBe(0);
  });
});
