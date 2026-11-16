import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EDGE, H, W, ZONE_DEPTH } from "../engine/core/defs";

// The v3 art contract and style directions (art/style/, docs/ART-V3.md). Every Blender renderer and,
// later, the game's renderer read these, so their shape and camera maths are pinned here.
const DIR = join(__dirname, "..", "art", "style");
const read = (f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const contract = read("contract.json");
const active = read("active.json");
const ids: string[] = active.choices;
const styles = Object.fromEntries(ids.map((id) => [id, read(`${id}.json`)]));

/** Every key path in an object, arrays treated as leaves. */
function shape(o: unknown, at = ""): string[] {
  if (o === null || typeof o !== "object" || Array.isArray(o)) return [at];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, at ? `${at}.${k}` : k)).sort();
}
function strings(o: unknown, at = ""): [string, string][] {
  if (typeof o === "string") return [[at, o]];
  if (o === null || typeof o !== "object") return [];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k));
}

describe("style directions", () => {
  it("offers three directions, one file each, and the active one is among them", () => {
    expect(ids).toHaveLength(3);
    const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && !["contract.json", "active.json"].includes(f));
    expect(files.map((f) => f.replace(".json", "")).sort()).toEqual([...ids].sort());
    expect(ids).toContain(active.direction);
    for (const id of ids) expect(styles[id].id).toBe(id);
  });

  it("all directions fill the same parameter slots, so any renderer can swap one for another", () => {
    // optional per-direction extras (a lantern colour for glowing props) are allowed in ground only
    const core = (id: string) => shape(styles[id]).filter((k) => k !== "ground.lantern");
    for (const id of ids) expect(core(id)).toEqual(core(ids[0]));
    for (const sec of ["outline", "shading", "rim", "light", "team", "palette", "ground", "keep", "shadow", "grade", "vfx", "ui"]) {
      for (const id of ids) expect(styles[id][sec], `${id}.${sec}`).toBeTypeOf("object");
    }
  });

  it("uses valid colours and sane numbers", () => {
    for (const id of ids) {
      const st = styles[id];
      for (const [path, v] of strings(st)) {
        if (v.startsWith("#")) expect(v, `${id}.${path}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
      for (const t of ["tide", "ember"]) expect(Object.keys(st.team[t]).sort()).toEqual(["dark", "light", "main"]);
      expect(st.outline.hull).toBeGreaterThanOrEqual(0);
      expect(st.outline.silhouette_px).toBeGreaterThan(0);
      const pos = st.shading.bands.map((b: number[]) => b[0]);
      expect(pos[0]).toBe(0);
      expect(pos[pos.length - 1]).toBe(1);
      expect([...pos].sort((a, b) => a - b)).toEqual(pos);
      for (const [, v] of st.shading.bands) expect(v).toBeGreaterThan(0);
      // lights stay symmetric about the camera plane so mirrored facings are lit the same
      expect(st.light.key[0]).toBe(0);
      expect(st.rim.dir[0]).toBe(0);
      expect(["additive", "normal"]).toContain(st.vfx.blend);
    }
  });
});

describe("art contract", () => {
  it("matches the sim's board", () => {
    expect(contract.world.board_w).toBe(W);
    expect(contract.world.board_h).toBe(H);
    expect(contract.world.zone_depth).toBe(ZONE_DEPTH);
  });

  it("projects the ground so a touch inverts back to the same game point", () => {
    const { ppu, elevation_deg } = contract.camera;
    const el = (elevation_deg * Math.PI) / 180;
    const project = (x: number, y: number, z = 0) => ({ sx: x * ppu, sy: (y * Math.sin(el) - z * Math.cos(el)) * ppu });
    const invert = (sx: number, sy: number) => ({ x: sx / ppu, y: sy / (ppu * Math.sin(el)) });
    for (const [x, y] of [[0, 0], [4.5, 7], [9, 14], [2.2, 7], [EDGE, ZONE_DEPTH]]) {
      const p = project(x, y);
      const q = invert(p.sx, p.sy);
      expect(q.x).toBeCloseTo(x, 9);
      expect(q.y).toBeCloseTo(y, 9);
    }
    // depth sort: a point nearer the player is lower on screen; height lifts it up the screen
    expect(project(4, 8).sy).toBeGreaterThan(project(4, 7).sy);
    expect(project(4, 7, 1).sy).toBeLessThan(project(4, 7).sy);
  });

  it("mirrors facings across the vertical screen axis", () => {
    const { angles_deg: A, rendered, mirrored } = contract.facings;
    expect(Object.keys(A)).toHaveLength(contract.facings.count);
    expect([...rendered, ...Object.keys(mirrored)].sort()).toEqual(Object.keys(A).sort());
    for (const [f, src] of Object.entries(mirrored) as [string, string][]) {
      expect(rendered).toContain(src);
      expect(((180 - A[src]) % 360 + 360) % 360).toBe(A[f]);
    }
  });

  it("keeps the app budget under 120 MB", () => {
    const b = contract.budget_mb;
    expect(b.app).toBeLessThanOrEqual(120);
    expect(b.units + b.arenas + b.vfx + b.ui + b.code_and_fonts).toBeLessThanOrEqual(b.app);
  });
});

describe("style in the app", () => {
  it("loads the active direction and every choice", async () => {
    const { STYLE, STYLE_IDS, styleById } = await import("../base/src/render/style");
    expect(STYLE.id).toBe(active.direction);
    expect([...STYLE_IDS].sort()).toEqual([...ids].sort());
    for (const id of ids) expect(styleById(id)).toEqual(styles[id]);
    expect(() => styleById("nope")).toThrow();
  });

  it("drives the game's team and effect colours from the active direction", async () => {
    const { TEAM, GOLD, HEAL, ZAP, VIOLET } = await import("../base/src/render/palette");
    const st = styles[active.direction];
    for (const [i, t] of (["tide", "ember"] as const).entries()) {
      expect(TEAM[i].main).toBe(st.team[t].main);
      expect(TEAM[i].dark).toBe(st.team[t].dark);
      expect(TEAM[i].light).toBe(st.team[t].light);
      expect(TEAM[i].glow + "1)").toMatch(/^rgba\(\d+,\d+,\d+,1\)$/);
    }
    expect([GOLD, HEAL, ZAP, VIOLET]).toEqual([st.vfx.gold, st.vfx.heal, st.vfx.zap, st.vfx.arcane]);
  });

  it("maps a direction to the stylesheet's colour variables", async () => {
    const { styleVars, rgba } = await import("../base/src/render/style");
    for (const id of ids) {
      const v = styleVars(styles[id]);
      expect(v["--tide"]).toBe(styles[id].team.tide.main);
      expect(v["--ember-d"]).toBe(styles[id].team.ember.dark);
      expect(v["--ui-panel-dk"]).toBe(styles[id].ui.panel_dk);
      expect(v["--ink"]).toBeUndefined(); // the page background stays the v2 ink until the UI kit lands
    }
    expect(rgba("#3fd0c9", 0.07)).toBe("rgba(63,208,201,0.07)");
  });
});
