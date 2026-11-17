// The board view: draws the deploy scene and the battle as a 3/4 diorama, turns battle events into effects.
// The sim is 2D; Camera (camera.ts) projects it. Draw order every frame: the warped ground texture, ground decals
// (zones, contact shadows, mines, mounds), upright things sorted by ground y, the air layer, then bars and effects.
import type { Battle, BattleEvent, Body, Proj } from "@engine/core/battle";
import { H, UNITS, W, ZONE_DEPTH, bodyDef, toWorld, type BodyKind, type Obstacle, type Piece, type Side, type UnitKind } from "@engine/core/defs";
import { arenaFor, propRect, propVariant, type Arena } from "./arena";
import { TerrainLayer, kitLook } from "./terrain";
import { World } from "./world";
import type { Block } from "@engine/core/terrain";
import type { ArenaMark } from "@engine/core/arena";
import { BEND, Camera, DIST, TILT, sortDrawables, type Drawable, type Rect, type ScreenPt } from "./camera";
import { Fx, animAlpha, animFrame, frand, type Anim } from "./fx";
import { BOARD, GOLD, INK, TEAM, VIOLET, ZAP, team } from "./palette";
import { frame, hasAtlas, motionOf, spriteHeight, type Weight } from "./sprites";
import { CAST_TIME, CAST_WIND, STRIKE_TIME, WINDUP, animFor, idleJitter, idleLife, spriteVis, strikeSquash, drawFrame, drawRank, drawUnit, type DrawOpts } from "./units";
import { Assault, type AssaultEvent, type Shot, type Striker } from "./assault";
import { BOMBLET_FLIGHT, DROP_TIME, PROJ_VFX, loadVfx, playBoom, playDrop, playEvent, vfxFrame, vfxReady, vfxSheet } from "./vfx";
import { KEEP_RY, KEEP_SCALE, KEEP_STATES, behindKeep, keepAnchor, keepHitPoint, keepImage, keepManifest, keepState, loadKeeps, type KeepState } from "./keeps";
// [keeps polish] hit squash, collapse and victory banner
import { VICTORY_HOLD, bannerRaise, collapsePose, drawVictoryBanner, keepSquash } from "./keeps";
import { spreadOffsets, type SpreadBody } from "./spread";
import { Juice, landSquash, popScale } from "./juice";
import { drawBanner, drawCallout, drawFloat, drawTrail, hpBar, shadowRing } from "./juicedraw";
import { equipped } from "@engine/progression/cosmetics"; // [skins]
import { keepStateDebug, skinMotes } from "./keeps"; // [skins]
import { arenaLayers } from "./foreground"; // polish/arenas: arena layers (see render())

export type { Rect } from "./camera";

export interface DeployScene {
  mode: "deploy";
  pieces: Piece[];
  /** Pieces to draw faintly (the other side's mines in puzzles). */
  showEnemyMines?: boolean;
  ghost?: { kind: UnitKind; x: number; y: number; ok: boolean };
  selected?: number;
  zone?: Side | null;
}
export interface BattleScene {
  mode: "battle";
  battle: Battle;
  alpha: number;
}
export type Scene = DeployScene | BattleScene;

/** Seconds the leftovers (mid-death bodies, illusions) take to clear once the assault begins. */
const VANISH = 0.4;
/** Height on the keep's wall where blows land, world units. */
const WALL_Z = 0.75;
const TAU = Math.PI * 2;
const RADIUS = (k: BodyKind): number => bodyDef(k)?.radius ?? 0.3;
const ICE = "#bfe9ff";
/** How high a body's sprite centre rides above its feet, as a fraction of its radius. */
const LIFT = 0.55;
/** World height of a flyer per unit of the sim's altitude z. */
const AIR = 0.75;
/** Air effects at or above this height sort with the flyers (layer 2); lower ones sort with the bodies on foot. */
export const FLYER_Z = 0.6;
/** An effect at a body's own row draws just after (over) that body. */
const AIR_SORT_EPS = 0.02;

type TokenOpts = DrawOpts & { rank?: number; flat?: boolean; /** squash-and-stretch [sx, sy] about the feet (juice) */ sq?: readonly [number, number];
  /** a shooter: no lunge on the blow (it recoils instead) */ ranged?: boolean;
  /** held still (frozen solid): no idle breathing */ still?: boolean };

/** Drawn off the ground: flyers, and a Griffin Knight fighting low after its swoop (in reach of swords, still on the wing). */
const aloft = (bd: Pick<Body, "flying" | "kind">) => bd.flying || bd.kind === "griffin";

export class BoardView {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly fx = new Fx();
  readonly cam = new Camera(W, H);
  dpr = 1;
  cssW = 0; cssH = 0;
  /** The screen box of the board's ground (for UI placement). */
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** The layout area the board was fitted into (heads and flyers may use all of it). */
  area: Rect = { x: 0, y: 0, w: 0, h: 0 };
  time = 0;
  obstacles: Obstacle[] = [];
  /** [arena] Arena-mode terrain: walls, buildings, cover and water (render/terrain.ts). */
  readonly terrain = new TerrainLayer();
  onShake?: (amount: number) => void;
  onSound?: (name: string, gain?: number) => void;
  private bg?: HTMLCanvasElement;
  /** The scenery standing in front of the board, drawn over the units (cached with the background). */
  private fgScene?: HTMLCanvasElement;
  private bgRev = -1;
  /** The globe the board sits on (world.ts): ground, rim, sky and the scenery round the board. */
  readonly world = new World();
  private groundKey = "";
  /** The view: turn about the board (radians), tilt from straight down, zoom (1 = the board fills the area). */
  view = { yaw: 0, tilt: TILT, zoom: 1 };
  /** The Blender arena for this match's act (null until loaded, or if the art is missing: then the drawn terrain). */
  arena: Arena | null = null;
  private arenaReq = 0;
  private reveal = new Map<number, number>(); // piece id -> time revealed
  private drop = new Map<number, number>(); // piece id -> time it started falling
  private frozenAt = new Map<number, number>(); // body id -> board time it froze (ice grows in, shatters on thaw)
  private fuseSeen = new WeakMap<object, number>(); // fuse -> board time first drawn
  private airSorted = false; // this frame's air sheets were drawn in the battle's depth sort
  /** Each commander's shown hp over max hp: drives the keep's damage state (the game keeps it in step with the bar). */
  keepHp: [number, number] = [1, 1];
  /** Draw the commander keeps (off for boards with no commanders to show). */
  showKeeps = true;
  /** The round-end march on the losing keep, while it plays. */
  assault?: Assault;
  private keeps = [0, 1].map(() => ({ state: "" as KeepState | "", flash: 0, shake: 0, alpha: 1, see: false, ember: 0, smoke: 0,
    // [keeps polish] seconds since the last blow and its strength; seconds since the keep fell / since the rival fell (-1: not)
    hitT: 9, hitK: 0, fallT: -1, winT: -1 }));
  /** [keeps polish] The rival's keep is the crowned boss variant (set for campaign boss levels). */
  bossKeep = false;
  /** [skins] The player's keep skin: undefined follows the equipped skin; a skin id or null (the default) pins it. */
  keepSkin: string | null | undefined = undefined;
  private skinMote = 0; // [skins] mote accumulator for the player's keep
  /** [skins] The skin a side's keep wears (only the player's keep is skinned). */
  private skinOf(side: Side): string | null { return side === 0 ? (this.keepSkin === undefined ? equipped("keep") : this.keepSkin) : null; }
  // ---- JUICE (combat feel, src/render/juice.ts + juicedraw.ts): hit-stop, camera shake, callouts, HP lag, banner.
  /** Hit-stop, trauma shake, Ascended callouts, HP-bar lag and the round-end flourish. */
  readonly juice = new Juice();
  /** Calm mode (the game's reduce-motion setting, or the OS's): no hit-stop, shake or screen-wide flourishes. */
  get reducedMotion() { return this.juice.reduced; }
  set reducedMotion(v: boolean) { this.juice.reduced = v; if (v) { this.juice.stop = 0; this.juice.trauma = 0; } }
  /** True while a hit-stop holds the frame (a game loop may also hold its sim steps while this is set). */
  get hitStopping() { return this.juice.frozen; }
  /** Board seconds since the battle's last blow (slow at first, see update). */
  private endT = 0;
  /** Recent screen points of each straight shot in flight, for its trail. */
  private trails = new WeakMap<Proj, { x: number; y: number; z: number }[]>();
  /** Each straight shot's last drawn position, heading and colour: when it leaves the battle, that is where it landed. */
  private shotAt = new Map<Proj, { x: number; y: number; z: number; a: number; color: string }>();
  /** Board time of each lobbed shot's last smoke puff. */
  private puffAt = new WeakMap<Proj, number>();
  // ---- /JUICE
  // ---- ANIM (unit motion, docs/ART-V3-ATLAS.md "Runtime"): render-only clocks per body id, in battle time.
  /** Attacks seen from events (shooters, healers, spawners: the sim marks a swing only for some). */
  private atkAt = new Map<number, number>();
  /** The last special move (cast clip). */
  private castAt = new Map<number, number>();
  /** The last blow taken, and how hard (the knockback nudge). */
  private hitAt = new Map<number, { t: number; k: number }>();
  /** The last shot loosed (the ranged recoil). */
  private recoilAt = new Map<number, number>();
  /** Each walker's gait phase (advanced by speed over its stride, so planted feet keep pace with the ground) and the
   *  board time it was last advanced. */
  private gaitOf = new Map<number, { ph: number; t: number }>();
  // ---- /ANIM

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    void loadKeeps();
    void loadVfx();
    // deep links for looking at the world from a fixed side: ?yaw=120&tilt=40&zoom=0.7 (degrees)
    const q = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
    if (q && (q.has("yaw") || q.has("tilt") || q.has("zoom"))) {
      this.view.yaw = (Number(q.get("yaw") ?? 0) * Math.PI) / 180;
      if (q.has("tilt")) this.view.tilt = (Number(q.get("tilt")) * Math.PI) / 180;
      if (q.has("zoom")) this.view.zoom = Number(q.get("zoom"));
    }
  }

  /** Pixels per world unit at the middle of the board (for effects that don't care about depth). */
  get s() { return this.cam.scaleAt(H / 2); }

  layout(cssW: number, cssH: number, area: Rect) {
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cssW = cssW; this.cssH = cssH;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = cssH + "px";
    this.area = { ...area };
    this.cam.bend = BEND;
    this.refit();
  }

  /** Turn, tilt and zoom the view of the world. Yaw is free; tilt and zoom are kept within sensible limits. */
  setView(yaw: number, tilt = this.view.tilt, zoom = this.view.zoom) {
    const v = this.view;
    v.yaw = yaw; v.tilt = Math.max(0.3, Math.min(1.0, tilt)); v.zoom = Math.max(0.45, Math.min(1.8, zoom));
    this.refit();
  }
  private refit() {
    const v = this.view, cam = this.cam;
    cam.setView(v.yaw, v.tilt);
    cam.fit(this.area);
    if (v.zoom !== 1) { cam.k *= v.zoom; cam.rev++; }
    this.rect = cam.groundRect();
    this.bg = undefined;
  }

  setObstacles(o: Obstacle[] | undefined) {
    this.obstacles = o ?? [];
    this.bg = undefined;
  }

  /** [arena] The blocks and decoration marks of an Arena-mode battlefield (none for every other mode). */
  setTerrain(blocks: Block[] | undefined, marks?: ArenaMark[]) { this.terrain.set(blocks, marks); }

  /** Picks the arena by campaign act (anything without one gets act 1's). */
  setArena(act: number | undefined): Promise<void> {
    const req = ++this.arenaReq;
    return arenaFor(act).then((a) => {
      if (req !== this.arenaReq) return;
      // The backdrop is only exact through the camera it was rendered with.
      const c = a?.m.camera;
      this.arena = a && c && Math.abs(c.tilt - TILT) < 1e-3 && Math.abs(c.dist - DIST) < 1e-3 ? a : null;
      this.bg = undefined; this.groundKey = "";
    });
  }

  /** World (on the ground, or at height z) to screen. */
  toScreen(x: number, y: number, z = 0): ScreenPt { return this.cam.project(x, y, z); }
  /** Screen to the ground point under it. */
  toWorld(px: number, py: number) { return this.cam.unproject(px, py); }
  /** Screen to the point at height z under it (for picking standing figures). */
  toWorldAt(px: number, py: number, z: number) { return this.cam.unprojectAt(px, py, z); }

  /** Run fn with the context mapped to the ground plane around (x, y): units are world units, origin at (x, y, z). */
  private ground(x: number, y: number, fn: (ctx: CanvasRenderingContext2D) => void, z = 0) {
    const ctx = this.ctx, p = this.cam.project(x, y, z), k = this.cam.squashAt(y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.s, p.s * k);
    fn(ctx);
    ctx.restore();
  }

  /** A soft contact shadow on the ground (r in world units). */
  private shadow(x: number, y: number, r: number, alpha: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    this.cam.groundPath(ctx, x + r * 0.08, y + r * 0.1, r);
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------ background
  /** The board as a flat top-down texture, ppu pixels per world unit. */
  private paintGround(ppu: number, overlay = false): HTMLCanvasElement {
    const c = document.createElement("canvas");
    const w = Math.round(W * ppu), h = Math.round(H * ppu);
    c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    const s = ppu, X = (x: number) => x * s, Y = (y: number) => y * s;
    if (overlay) {
      // Over the arena art: a light team wash on each deploy zone and a glowing back line, nothing else.
      for (const sd of [0, 1] as Side[]) {
        const a = toWorld(sd, 0, 0), b = toWorld(sd, 0, ZONE_DEPTH);
        const y0 = Y(Math.min(a.y, b.y)), y1 = Y(Math.max(a.y, b.y));
        const zg = g.createLinearGradient(0, sd === 0 ? y1 : y0, 0, sd === 0 ? y0 : y1);
        zg.addColorStop(0, team(sd).glow + "0.10)");
        zg.addColorStop(1, team(sd).glow + "0)");
        g.fillStyle = zg;
        g.fillRect(0, y0, w, y1 - y0);
        const ey = Y(sd === 0 ? H - 0.1 : 0.1);
        const lg = g.createLinearGradient(0, 0, w, 0);
        lg.addColorStop(0, team(sd).glow + "0)"); lg.addColorStop(0.5, team(sd).glow + "0.55)"); lg.addColorStop(1, team(sd).glow + "0)");
        g.strokeStyle = lg; g.lineWidth = s * 0.07;
        g.beginPath(); g.moveTo(0, ey); g.lineTo(w, ey); g.stroke();
      }
      return c;
    }
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1d1714");
    grad.addColorStop(0.5, BOARD.base0);
    grad.addColorStop(1, "#0f1c22");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Contour lines: a terrain map, not a grid.
    g.strokeStyle = BOARD.line; g.lineWidth = s * 0.03;
    for (let k = 0; k < 14; k++) {
      g.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const yy = (k / 13) * h + Math.sin(u * 7 + k * 1.3) * s * 0.35 + Math.sin(u * 17 + k) * s * 0.1;
        i ? g.lineTo(u * w, yy) : g.moveTo(u * w, yy);
      }
      g.stroke();
    }
    const hash = (i: number, k: number) => Math.abs((Math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = i % 3 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.18)";
      g.fillRect(hash(i, 21) * w, hash(i, 22) * h, s * 0.04, s * 0.04);
    }
    // Terrain: soft patches of moss, dirt and shade, then tufts and pebbles.
    for (let i = 0; i < 46; i++) {
      const px = hash(i, 1) * w, py = hash(i, 2) * h, pr = (0.8 + hash(i, 3) * 2.2) * s;
      const col = i % 3 === 0 ? "rgba(70,110,80,0.13)" : i % 3 === 1 ? "rgba(110,85,60,0.10)" : "rgba(0,0,0,0.14)";
      const rg = g.createRadialGradient(px, py, 0, px, py, pr);
      rg.addColorStop(0, col); rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg;
      g.beginPath(); g.ellipse(px, py, pr * 1.4, pr, hash(i, 4) * 3, 0, TAU); g.fill();
    }
    g.lineCap = "round";
    for (let i = 0; i < 110; i++) {
      const px = hash(i, 5) * w, py = hash(i, 6) * h, k = s * (0.07 + hash(i, 7) * 0.08);
      g.strokeStyle = `rgba(${110 + hash(i, 8) * 40},${150 + hash(i, 9) * 40},${110},${0.07 + hash(i, 10) * 0.08})`;
      g.lineWidth = s * 0.03;
      for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.sin(a) * k, py - Math.cos(a) * k * 1.4); g.stroke(); }
    }
    for (let i = 0; i < 70; i++) {
      const px = hash(i, 11) * w, py = hash(i, 12) * h, pr = s * (0.03 + hash(i, 13) * 0.05);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.beginPath(); g.ellipse(px + pr * 0.3, py + pr * 0.4, pr, pr * 0.75, 0, 0, TAU); g.fill();
      g.fillStyle = `rgba(${140 + hash(i, 14) * 50},${140 + hash(i, 14) * 50},${150},0.45)`;
      g.beginPath(); g.ellipse(px, py, pr, pr * 0.75, 0, 0, TAU); g.fill();
    }
    // Zones and the no-man's band.
    for (const sd of [0, 1] as Side[]) {
      const a = toWorld(sd, 0, 0), b = toWorld(sd, 0, ZONE_DEPTH);
      const y0 = Y(Math.min(a.y, b.y)), y1 = Y(Math.max(a.y, b.y));
      const zg = g.createLinearGradient(0, sd === 0 ? y1 : y0, 0, sd === 0 ? y0 : y1);
      zg.addColorStop(0, team(sd).glow + "0.16)");
      zg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = zg;
      g.fillRect(0, y0, w, y1 - y0);
    }
    for (const sd of [0, 1] as Side[]) {
      const ey = Y(sd === 0 ? H - 0.12 : 0.12);
      const lg = g.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, team(sd).glow + "0)"); lg.addColorStop(0.5, team(sd).glow + "0.7)"); lg.addColorStop(1, team(sd).glow + "0)");
      g.strokeStyle = lg; g.lineWidth = s * 0.08;
      g.beginPath(); g.moveTo(0, ey); g.lineTo(w, ey); g.stroke();
    }
    const top = Y(toWorld(1, 0, ZONE_DEPTH).y), bot = Y(toWorld(0, 0, ZONE_DEPTH).y);
    g.fillStyle = BOARD.band;
    g.fillRect(0, top, w, bot - top);
    g.setLineDash([s * 0.25, s * 0.2]);
    g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = s * 0.05;
    g.beginPath(); g.moveTo(0, (top + bot) / 2); g.lineTo(w, (top + bot) / 2); g.stroke();
    g.setLineDash([]);
    // Ambient occlusion where the rocks sit (the rocks themselves stand up in the sorted pass).
    for (const o of this.obstacles) {
      const rg = g.createRadialGradient(X(o.x), Y(o.y), o.r * s * 0.6, X(o.x), Y(o.y), o.r * s * 1.5);
      rg.addColorStop(0, "rgba(0,0,0,0.45)"); rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg;
      g.beginPath(); g.arc(X(o.x), Y(o.y), o.r * s * 1.5, 0, TAU); g.fill();
    }
    return c;
  }

  /** The screen backdrop: surround, the board's front face, and the ground texture warped into perspective. */
  private paintBackground(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = this.canvas.width; c.height = this.canvas.height;
    const g = c.getContext("2d")!;
    const dpr = this.dpr, cam = this.cam;
    g.scale(dpr, dpr);
    // the ground textures are rebuilt only when the arena (or the drawn board) changes, not when the view turns
    const key = (this.arena ? this.arena.info.name : "drawn") + "|" + this.obstacles.length;
    if (key !== this.groundKey) { this.groundKey = key; this.world.setGround(this.arena, () => this.paintGround(64), kitLook(), this.arena ? this.arena.info.name.length * 7 + this.arena.info.name.charCodeAt(0) : 3); }
    this.world.paint(g, cam, this.cssW, this.cssH, this.arena ? this.paintGround(48, true) : undefined);
    this.world.drawScenery(g, cam, true);
    const f = this.fgScene = document.createElement("canvas");
    f.width = c.width; f.height = c.height;
    const fg = f.getContext("2d")!;
    fg.scale(dpr, dpr);
    this.world.drawScenery(fg, cam, false);
    this.bgRev = cam.rev;
    return c;
  }

  /** An obstacle's Blender prop, standing on its collision circle (its contact shadow is baked in). */
  private drawProp(o: Obstacle, a: Arena): boolean {
    const img = a.props[propVariant(o, a.props.length)];
    if (!img) return false;
    const p = this.cam.project(o.x, o.y), r = propRect(a.m, p.x, p.y, o.r, p.s);
    this.ctx.drawImage(img, r.x, r.y, r.w, r.h);
    return true;
  }

  // ------------------------------------------------------------ events -> effects
  consume(battle: Battle) {
    const ev = battle.events;
    for (const e of ev) this.onEvent(e, battle);
    ev.length = 0;
  }

  markReveal(ids: number[]) {
    for (const id of ids) this.reveal.set(id, this.time);
  }

  private vfxEnv(battle?: Battle) {
    return {
      find: (id: number) => battle?.bodies.find((b) => b.id === id),
      bodies: battle?.bodies ?? [],
      time: battle?.time ?? this.time,
      textured: vfxReady(),
      sound: (n: string, g?: number) => this.onSound?.(n, g),
      kick: (k: number) => this.onShake?.(k),
      lift: (id: number) => {
        const bd = battle?.bodies.find((b) => b.id === id);
        return bd && aloft(bd) ? (bd.z ?? 1.2) * AIR : 0;
      },
    };
  }

  private onEvent(e: BattleEvent, battle: Battle) {
    this.animEvent(e, battle);
    playEvent(this.fx, e, this.vfxEnv(battle));
    this.terrain.onEvent(e, this.fx, battle.time, { sound: (n, g) => this.onSound?.(n, g), kick: (k) => this.onShake?.(k) }); // [arena]
    // JUICE: hit-stop, shake and Ascended callouts from the same event.
    this.juice.onEvent(e, (id) => battle.bodies.find((b) => b.id === id));
  }

  /** ANIM: start the attack, cast, nudge and recoil clocks an event implies. */
  private animEvent(e: BattleEvent, battle: Battle) {
    const t = battle.time;
    const body = (id: number) => battle.bodies.find((b) => b.id === id);
    const cast = (id: number) => {
      const bd = body(id);
      if (!bd) return;
      if (motionOf(bd.kind, bd.rank).cast) this.castAt.set(id, t); else this.atkAt.set(id, t);
    };
    switch (e.t) {
      case "shot": this.atkAt.set(e.id, t); this.recoilAt.set(e.id, t); break;
      case "volley": case "twin": case "dive": this.atkAt.set(e.id, t); break;
      case "heal": if (e.from !== e.to) this.atkAt.set(e.from, t); break;
      case "wave": this.atkAt.set(e.from, t); break;
      case "spawn": if (e.kind === "thrall") cast(e.from); else if (e.kind === "mite" || e.kind === "queen") this.atkAt.set(e.from, t); break;
      case "revive": case "ward": case "decoy": cast(e.from); break;
      case "build": case "hook": case "laststand": case "parry": case "brace": cast(e.id); break;
      case "aura": {
        // the bearer waves the flag as the aura pulses, unless it is mid-blow
        const bd = body(e.id);
        if (bd?.kind === "banner" && t - bd.swing > STRIKE_TIME + 0.2) cast(e.id);
        break;
      }
      case "hit": this.hitAt.set(e.id, { t, k: e.big ? 1.5 : e.dmg >= 30 ? 1.15 : 0.8 }); break;
      default: break;
    }
  }

  /** ANIM: 0..1 progress of the wind-up before a body's next blow, if one is about to land: the cooldown is nearly
   *  up and its target is in reach. */
  private windupOf(b: Battle, bd: Body, weight: Weight, sp: number): number | undefined {
    const w = WINDUP[weight];
    if (!bd.alive || bd.cooldown <= 0 || bd.cd <= 0 || bd.cd > w || sp > 0.25 || bd.stun > 0 || (bd.frozen ?? 0) > 0) return undefined;
    const tg = bd.target >= 0 ? b.bodies.find((o) => o.id === bd.target) : undefined;
    if (!tg || !tg.alive || Math.hypot(tg.x - bd.x, tg.y - bd.y) - tg.radius - bd.radius > bd.range + 0.1) return undefined;
    return 1 - bd.cd / w;
  }

  /** ANIM: advance a walker's gait phase by its speed over its stride (at the drawn scale) and return it; heavy bodies
   *  kick up dust on each footfall. undefined when it isn't walking on the ground. */
  private stepGait(bd: Body, sp: number, mo: { stride: number; weight: Weight }, x: number, y: number): number | undefined {
    if (sp <= 0.2 || !bd.alive || aloft(bd)) { this.gaitOf.delete(bd.id); return undefined; }
    const vis = spriteVis(RADIUS(bd.kind)) * (bd.radius / RADIUS(bd.kind));
    const cadence = Math.max(0.8, Math.min(3.4, mo.stride > 0 ? sp / (mo.stride * vis) : sp / 0.7));
    let g = this.gaitOf.get(bd.id);
    if (!g) this.gaitOf.set(bd.id, (g = { ph: idleJitter(bd.id)[0], t: this.time }));
    const before = g.ph;
    g.ph += Math.max(0, Math.min(0.1, this.time - g.t)) * cadence;
    g.t = this.time;
    const step = Math.floor(g.ph * 2);
    if (step !== Math.floor(before * 2) && mo.weight === "heavy" && !this.juice.reduced && vfxReady()) {
      // a footfall (the left foot lands at phase 0, the right at 0.5)
      const side = step % 2 ? -1 : 1, c = Math.cos(bd.face), s = Math.sin(bd.face);
      const fx = x - s * side * bd.radius * 0.35 + c * bd.radius * 0.25, fy = y + c * side * bd.radius * 0.35 + s * bd.radius * 0.25;
      this.fx.anim("dust", fx, fy, { size: Math.max(0.45, bd.radius * 1.7), max: 0.38, tint: "#d6c3a0", layer: "ground", alpha: 0.5 });
    }
    return g.ph;
  }

  /** ANIM: the knockback nudge from a blow and the recoil of a shot, as a ground offset (world units). */
  private juiceOffset(b: Battle, bd: Body, weight: Weight): [number, number] {
    if (this.juice.reduced || !bd.alive) return [0, 0];
    let m = 0;
    const h = this.hitAt.get(bd.id);
    if (h && !bd.structure) {
      const u = (b.time - h.t) / 0.2;
      if (u >= 0 && u < 1) m += Math.sin(u * Math.PI) * (1 - u * 0.4) * bd.radius * 0.16 * h.k * (weight === "heavy" ? 0.55 : weight === "light" ? 1.2 : 1);
    }
    const r = this.recoilAt.get(bd.id);
    if (r !== undefined) {
      const u = (b.time - r) / 0.16;
      if (u >= 0 && u < 1) m += Math.sin(u * Math.PI) * (1 - u) * bd.radius * (bd.structure ? 0.08 : 0.22);
    }
    return m ? [-Math.cos(bd.face) * m, -Math.sin(bd.face) * m] : [0, 0];
  }

  /** ANIM: how high a body is lifted off its shadow right now (the deploy drop, the battle-start hop, a summon). */
  private liftOf(b: Battle, bd: Body): number {
    if (!bd.alive) return 0;
    const t0 = bd.owner === -1 ? this.drop.get(bd.pieceId) : undefined;
    let z = 0;
    if (t0 !== undefined) { const u = (this.time - t0) / DROP_TIME; if (u < 1) z += DROP_HEIGHT * (1 - u * u); }
    return z + this.juiceBody(b, bd).z;
  }

  /** A blast (the round-end assault's hits on a keep use the battle's own explosions). */
  private boom(x: number, y: number, r: number, kind: string, side: Side) {
    playBoom(this.fx, x, y, r, kind, side, this.vfxEnv());
  }

  /** Deploy drop-in: pieces (by piece id) fall onto the board and land in a puff of dust. */
  dropIn(pieces: { id: number; x: number; y: number; radius: number; side: Side }[]) {
    for (const p of pieces) {
      this.reveal.set(p.id, this.time);
      this.drop.set(p.id, this.time);
      playDrop(this.fx, p.x, p.y, p.radius, p.side);
    }
  }

  /** Drop-in state for a piece id: world height it is still falling from, and a landing squash scale. */
  private dropping(id: number): { z: number; scale: number; sq?: readonly [number, number] } {
    const t0 = this.drop.get(id);
    if (t0 === undefined) return { z: 0, scale: 1 };
    const u = (this.time - t0) / DROP_TIME;
    // JUICE: stretched tall as it falls, squashed wide on landing, one springy wobble (juice.ts landSquash).
    if (u < 1) return { z: DROP_HEIGHT * (1 - u * u), scale: 1, sq: this.juice.reduced ? undefined : landSquash(-1) };
    if (u < 2.2) return { z: 0, scale: 1, sq: this.juice.reduced ? undefined : landSquash((u - 1) / 1.2) };
    this.drop.delete(id);
    return { z: 0, scale: 1 };
  }

  // ------------------------------------------------------------ sprite sheets (public/vfx, see vfx.ts)
  /** Draws frame f of a VFX sheet at screen (x, y), h px tall (w px wide, default by aspect). False if not loaded. */
  private sheet(name: string, f: number, x: number, y: number, h: number,
    o: { a?: number; alpha?: number; tint?: string; w?: number; squash?: number; blend?: "add" | "normal" } = {}): boolean {
    const src = vfxFrame(name, f, o.tint);
    if (!src) return false;
    const { sh } = src;
    const w = o.w ?? (h * sh.w) / sh.h;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (o.squash !== undefined && o.squash !== 1) ctx.scale(1, o.squash);
    if (o.a) ctx.rotate(o.a);
    ctx.globalAlpha *= o.alpha ?? 1;
    if ((o.blend ?? sh.blend) === "add") ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(src.img, src.sx, src.sy, sh.w, sh.h, -w * sh.anchor[0], -h * sh.anchor[1], w, h);
    ctx.restore();
    return true;
  }

  /** A sheet lying on the ground at world (x, y): scaled by depth and foreshortened like the ground there. */
  private groundSheet(name: string, f: number, x: number, y: number, size: number, o: { a?: number; alpha?: number; tint?: string } = {}) {
    const p = this.cam.project(x, y);
    return this.sheet(name, f, p.x, p.y, size * p.s, { ...o, squash: this.cam.squashAt(y) });
  }

  /** The frame of a looping sheet now, at fps, offset by a seed so neighbours don't flicker in step. */
  private loopFrame(name: string, fps: number, seed = 0) {
    const n = vfxSheet(name)?.frames ?? 1;
    return Math.floor(this.time * fps + seed * 1.37) % n;
  }

  /** Every playing sheet on one layer: "ground" under the bodies, "air" over them; placed through the camera.
   *  In a battle the air sheets are already drawn, depth-sorted with the bodies (pushAirAnims). */
  private drawAnims(layer: Anim["layer"]) {
    if (!vfxReady()) return;
    if (layer === "air" && this.airSorted) return;
    for (const an of this.fx.anims) if (an.delay <= 0 && an.layer === layer) this.drawAnim(an);
  }

  private drawAnim(an: Anim) {
    const sh = vfxSheet(an.sheet);
    if (!sh) return;
    const u = 1 - an.life / an.max;
    const k = an.grow ? an.grow[0] + (an.grow[1] - an.grow[0]) * easeOut(u) : 1;
    const p = this.cam.project(an.x, an.y, an.z), s = p.s;
    this.sheet(an.sheet, animFrame(an, sh.frames), p.x, p.y, an.size * s * k, {
      a: an.a, alpha: animAlpha(an), tint: an.tint, blend: an.blend,
      w: an.w !== undefined ? an.w * s * k : undefined,
      squash: an.layer === "ground" ? an.squash * this.cam.squashAt(an.y) : an.squash,
    });
  }

  /** Air sheets join the painter sort, so a hit draws over the body it lands on but under bodies standing in
   *  front of it, and anything at flyer height (a hit on a flyer, a thrown bomb) draws with the flyers, over every
   *  body on foot. */
  private pushAirAnims(list: Drawable[]) {
    this.airSorted = vfxReady();
    if (!this.airSorted) return;
    for (const an of this.fx.anims) {
      if (an.delay > 0 || an.layer !== "air") continue;
      list.push({ x: an.x, y: an.y + AIR_SORT_EPS, layer: an.z >= FLYER_Z ? 2 : 1, draw: () => this.drawAnim(an) });
    }
  }

  update(dt: number) {
    // JUICE: hit-stop and shake clocks. The effects keep ageing through a stop (the sim does too, it runs in game.ts):
    // only the picture is held (see render), so nothing piles up while the frame is frozen.
    this.juice.update(dt);
    // JUICE: the final blow plays in slow motion: the board's clock and its effects run slow for a moment, and the
    // bodies caught mid-fall finish falling on that clock (the battle's own time has stopped).
    const ts = this.juice.timeScale;
    if (this.juice.sinceEnd >= 0) this.endT += dt * ts;
    this.time += dt * ts;
    this.fx.update(dt * ts);
    if (this.showKeeps) this.updateKeeps(dt);
  }

  render(scene: Scene) {
    const ctx = this.ctx;
    // JUICE: hit-stop. The impact frame is drawn once, then held on screen until the stop ends.
    if (this.juice.frozen && this.juice.drawn && scene.mode === "battle") return;
    this.juice.drawn = true;
    if (!this.bg || this.bgRev !== this.cam.rev) this.bg = this.paintBackground();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // JUICE: a smooth trauma shake (the effects' own kicks feed in through fx.shake).
    // Whole device pixels only: a sub-pixel offset resamples the full-screen background blit every frame.
    const [sx, sy] = this.juice.offset(this.s * 0.16, this.fx.shake * 0.75);
    let dx = Math.round(sx * this.dpr) / this.dpr, dy = Math.round(sy * this.dpr) / this.dpr;
    // JUICE: the camera push-in (the final blow, big blasts): the whole picture scales about the blow.
    const zm = scene.mode === "battle" ? this.juice.zoom() : null;
    let zk = 1;
    if (zm && zm.k > 1.001) {
      const f = this.cam.project(zm.x, zm.y, 0.3);
      zk = zm.k; dx += f.x * (1 - zk); dy += f.y * (1 - zk);
    }
    ctx.setTransform(zk, 0, 0, zk, dx * this.dpr, dy * this.dpr);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.dpr * zk, 0, 0, this.dpr * zk, dx * this.dpr, dy * this.dpr);
    ctx.save();
    // Heads and flyers over the far edge may use the whole layout area.
    ctx.beginPath(); ctx.rect(this.area.x, this.area.y, this.area.w, this.area.h); ctx.clip();
    this.drawAnims("ground");
    this.airSorted = false;
    // ---- arena layers (polish/arenas, foreground.ts): ambient ground motion under the units, border canopy over them
    if (this.arena) arenaLayers(this).ambient(ctx, this.arena, this.cam, this.time, this.juice.reduced);
    if (scene.mode === "deploy") this.drawDeploy(scene);
    else this.drawBattle(scene);
    if (this.fgScene) { ctx.save(); ctx.setTransform(zk, 0, 0, zk, dx * this.dpr, dy * this.dpr); ctx.drawImage(this.fgScene, 0, 0); ctx.restore(); }
    if (this.arena) arenaLayers(this).overhead(ctx, this.arena, this.cam, this.time, this.juice.reduced);
    // ---- end arena layers
    this.drawFx();
    ctx.restore();
    if (this.fx.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = this.fx.flash * (this.juice.reduced ? 0.15 : 0.5); // JUICE: calm mode dims full-screen flashes
      ctx.fillStyle = this.fx.flashColor;
      ctx.fillRect(this.area.x, this.area.y, this.area.w, this.area.h);
      ctx.restore();
    }
    // JUICE: the board half of the round-end banner, steady (outside the shake).
    if (this.juice.banner && scene.mode === "battle") {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      drawBanner(ctx, this.juice.banner, this.area, this.cssH, this.juice.reduced);
    }
  }

  /** Where a body's sprite centre sits on screen (feet at (x, y), z above ground), and its radius in px. */
  private bodyAt(x: number, y: number, z: number, radius: number, flat = false) {
    const p = this.cam.project(x, y, z + (flat ? 0 : radius * LIFT));
    return { x: p.x, y: p.y, r: radius * p.s };
  }

  /** Screen top of a body's figure (for bars and rank pips): the atlas sprite's head when its art is loaded, else
   *  the drawn token's top. radius in world units. */
  private headAt(kind: BodyKind, rank: number, x: number, y: number, z: number, radius: number) {
    const at = this.bodyAt(x, y, z, radius);
    const h = spriteHeight(kind, rank);
    if (!h) return { x: at.x, y: at.y - at.r * 1.3, r: at.r };
    const feet = this.cam.project(x, y, z);
    return { x: at.x, y: Math.min(at.y - at.r * 1.3, feet.y - h * feet.s * (radius / RADIUS(kind)) * spriteVis(RADIUS(kind))), r: at.r };
  }

  /** Draws a body standing at world (x, y), z above the ground. radius in world units. Upright Blender atlas frames
   *  (sprites.ts) anchored at the feet, facing one of 8 screen directions and playing idle/walk/attack/death; the
   *  drawn top-down token on a tilted card stands in until a body's atlas has loaded. */
  private token(kind: BodyKind, side: Side, x: number, y: number, z: number, radius: number, face: number, o: TokenOpts) {
    const ctx = this.ctx;
    const swing = o.swing ?? -1;
    if ((o.rank ?? 1) >= 4 && !o.hidden && !o.flat && o.dying === undefined) {
      // Ascended: a slow pulse of team light on the ground.
      const pulse = 0.55 + 0.45 * Math.sin(this.time * 3 + (o.id ?? 0));
      this.ground(x, y, (g) => {
        const gr = g.createRadialGradient(0, 0, radius * 0.3, 0, 0, radius * 2.1);
        gr.addColorStop(0, team(side).glow + (0.35 * pulse) + ")");
        gr.addColorStop(1, team(side).glow + "0)");
        g.fillStyle = gr;
        g.beginPath(); g.arc(0, 0, radius * 2.1, 0, TAU); g.fill();
      });
    }
    const { anim, phase } = animFor({ ...o, t: o.t ?? this.time });
    const fr = frame(kind, Math.max(1, Math.min(4, o.rank ?? 1)), side, anim, phase, this.cam.facing8(face, y));
    const alive = o.dying === undefined ? 1 : 1 - o.dying;
    if (!fr) {
      // Fallback token: shrinks and fades as it dies.
      const at = this.bodyAt(x, y, z, radius * (0.8 + 0.2 * alive), o.flat);
      ctx.save();
      ctx.translate(at.x, at.y);
      if ((o.speed ?? 0) > 0.2 && !o.flat) ctx.translate(0, Math.sin(this.time * 14 + (o.id ?? 0)) * at.r * 0.07);
      ctx.scale(1, this.cam.squashAt(y));
      drawUnit(ctx, kind, side, 0, 0, at.r, face, { ...o, alpha: (o.alpha ?? 1) * alive, noShadow: true });
      ctx.restore();
      return;
    }
    // A short lunge towards the target on the strike, along the ground.
    let fx = x, fy = y;
    if (swing >= 0 && swing < 0.5 && !o.ranged) {
      const l = Math.sin((swing / 0.5) * Math.PI) * radius * 0.16;
      fx += Math.cos(face) * l; fy += Math.sin(face) * l;
    }
    const feet = this.cam.project(fx, fy, z);
    ctx.save();
    ctx.translate(feet.x, feet.y);
    if (o.sq) ctx.scale(o.sq[0], o.sq[1]); // JUICE: squash-and-stretch about the feet
    // ANIM: idle life on top of the idle clip: breathing, a slow lean from foot to foot and a weight-shift dip now and
    // then (units.ts idleLife); flyers hover instead. Not for structures, buried mines, the ghost or frozen bodies.
    if (anim === "idle" && !this.juice.reduced && !o.flat && !o.ghost && !o.still && (bodyDef(kind)?.speed ?? 1) > 0) {
      const life = idleLife(phase, o.weight ?? motionOf(kind, o.rank ?? 1).weight, o.id ?? 0);
      if (z > 0.3) ctx.translate(0, -life.bob * feet.s * radius * 0.22);
      else { ctx.transform(1, 0, -life.lean, 1, 0, 0); ctx.scale(life.sx, life.sy); }
    }
    // Death frames play out first, then the body fades over the last part of the window.
    ctx.globalAlpha *= (o.alpha ?? 1) * Math.min(1, alive * 2.5);
    if (o.hidden) ctx.globalAlpha *= o.own ? 0.42 : 0.14;
    // Drawn a bit larger than true scale so they read on a phone (collision is unchanged).
    drawFrame(ctx, fr, (feet.s * (radius / RADIUS(kind)) * spriteVis(RADIUS(kind))) / fr.ppu, o.flash ?? 0);
    ctx.restore();
  }

  /** A rock that stands on its collision circle: the base ring is the circle, projected exactly. */
  private drawRock(o: Obstacle) {
    if (this.arena && this.drawProp(o, this.arena)) return;
    const ctx = this.ctx, cam = this.cam, n = 14, h = o.r * 0.95;
    const jag = (i: number) => 0.86 + 0.14 * Math.abs(Math.sin(o.x * 7 + o.y * 3 + i * 1.7));
    const at = (i: number, k: number, z: number) => {
      const a = (i / n) * TAU;
      return cam.project(o.x + Math.cos(a) * o.r * k * jag(i), o.y + Math.sin(a) * o.r * k * jag(i), z);
    };
    ctx.save();
    // Silhouette: the near half of the base, then the far half of the top.
    ctx.beginPath();
    for (let i = 0; i <= n / 2; i++) { const p = at(i, 1, 0); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    for (let i = n / 2; i <= n; i++) { const p = at(i % n, 0.62, h); ctx.lineTo(p.x, p.y); }
    ctx.closePath();
    const top = cam.project(o.x, o.y, h), base = cam.project(o.x, o.y + o.r, 0);
    const sg = ctx.createLinearGradient(0, top.y, 0, base.y);
    sg.addColorStop(0, "#4d555f"); sg.addColorStop(1, "#1d2128");
    ctx.fillStyle = sg; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    // The lit top.
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const p = at(i % n, 0.62, h); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.closePath();
    const tg = ctx.createRadialGradient(top.x - o.r * top.s * 0.25, top.y - o.r * top.s * 0.15, 0, top.x, top.y, o.r * top.s * 0.7);
    tg.addColorStop(0, "#7a838e"); tg.addColorStop(1, "#555d68");
    ctx.fillStyle = tg; ctx.fill();
    ctx.strokeStyle = "rgba(10,14,22,0.6)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  private evolveAt = new Map<number, number>();
  /** A rank-up pop on a placed piece. */
  markEvolve(id: number) { this.evolveAt.set(id, this.time); }

  /** A ground quad between two board rows, full width. */
  private rowsPath(y0: number, y1: number) {
    const ctx = this.ctx, cam = this.cam;
    const a = cam.project(0, y0), b = cam.project(W, y0), c = cam.project(W, y1), d = cam.project(0, y1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
  }

  private drawZone(side: Side) {
    const ctx = this.ctx;
    const a = toWorld(side, 0, -0.05), b = toWorld(side, 0, ZONE_DEPTH);
    const y0 = Math.max(0, Math.min(a.y, b.y)), y1 = Math.min(H, Math.max(a.y, b.y));
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    ctx.save();
    ctx.fillStyle = team(side).glow + (0.07 + 0.05 * pulse) + ")";
    this.rowsPath(y0, y1); ctx.fill();
    ctx.strokeStyle = team(side).glow + (0.5 + 0.3 * pulse) + ")";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    // The edge sits exactly on the sim's zone depth.
    const ey = b.y, l = this.cam.project(0, ey), r = this.cam.project(W, ey);
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.stroke();
    ctx.restore();
  }

  private drawDeploy(sc: DeployScene) {
    this.terrain.ground(this.ctx, this.cam, this.time); // [arena]
    if (sc.zone !== undefined && sc.zone !== null) this.drawZone(sc.zone);
    if (!this.arena?.props.length) for (const o of this.obstacles) this.shadow(o.x, o.y, o.r * 1.05, 0.3);
    const shown = sc.pieces.filter((p) => !(p.kind === "mine" && p.side === 1 && !sc.showEnemyMines));
    // Ground layer: selection and range under everything, then contact shadows, then buried mines.
    const sel = shown.find((p) => p.id === sc.selected);
    if (sel) this.drawSelection(sel);
    for (const p of shown) {
      if (p.kind === "mine") continue;
      for (const [x, y] of this.footprints(p.kind, p.x, p.y, p.side === 0 ? -1 : 1)) this.shadow(x, y, RADIUS(p.kind) * 1.1, 0.38);
    }
    const list: Drawable[] = [];
    for (const p of shown) {
      const def = UNITS[p.kind];
      const face = p.side === 0 ? -Math.PI / 2 : Math.PI / 2;
      const revealT = this.reveal.get(p.id);
      const fall = this.dropping(p.id);
      let pop = this.drop.has(p.id) ? fall.scale : revealT !== undefined ? Math.min(1, (this.time - revealT) / 0.25) : 1;
      const evo = this.evolveAt.get(p.id);
      if (evo !== undefined && this.time - evo < 0.45) pop *= 1 + 0.45 * Math.sin(((this.time - evo) / 0.45) * Math.PI);
      const mine = p.kind === "mine";
      list.push({
        x: p.x, y: p.y, layer: mine ? 0 : 1, draw: () => {
          if (p.kind === "blades") {
            this.footprints("blades", p.x, p.y, p.side === 0 ? -1 : 1).forEach(([x, y], i) =>
              this.token("blades", p.side, x, y, fall.z, def.radius * pop, face, { t: this.time, id: p.id * 3 + i, rank: p.rank, sq: fall.sq }));
          } else {
            this.token(p.kind, p.side, p.x, p.y, fall.z, def.radius * pop, face, { t: this.time, id: p.id, hidden: mine, flat: mine, own: p.side === 0 || !!sc.showEnemyMines, rank: p.rank, sq: fall.sq });
          }
          const at = mine ? this.bodyAt(p.x, p.y, 0, def.radius, true) : this.headAt(p.kind, p.rank, p.x, p.y, 0, def.radius);
          drawRank(this.ctx, at.x, mine ? at.y : at.y + at.r * 1.1, Math.max(at.r, 0.3 * this.cam.scaleAt(p.y)), p.rank);
        },
      });
    }
    for (const o of this.obstacles) list.push({ x: o.x, y: o.y, layer: 1, draw: () => this.drawRock(o) });
    list.push(...this.terrain.drawables(this.ctx, this.cam, this.time)); // [arena]
    this.pushKeeps(list, [...shown.filter((p) => p.kind !== "mine"), ...(sc.ghost ? [sc.ghost] : [])]);
    for (const d of sortDrawables(list, this.cam)) d.draw();
    if (sc.ghost) {
      const ctx = this.ctx, g = sc.ghost, def = UNITS[g.kind];
      ctx.save();
      ctx.globalAlpha = 0.75;
      this.drawRangeHint(g.kind, g.x, g.y, g.ok);
      for (const [x, y] of this.footprints(g.kind, g.x, g.y, -1)) this.shadow(x, y, def.radius * 1.1, 0.2);
      if (g.kind === "blades") {
        for (const [x, y] of this.footprints("blades", g.x, g.y, -1)) this.token("blades", 0, x, y, 0, def.radius, -Math.PI / 2, { t: this.time, ghost: true });
      } else this.token(g.kind, 0, g.x, g.y, 0, def.radius, -Math.PI / 2, { t: this.time, ghost: true, own: true, flat: g.kind === "mine" });
      if (!g.ok) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = "#ff4d4d"; ctx.lineWidth = 3;
        ctx.beginPath(); this.cam.groundPath(ctx, g.x, g.y, def.radius * 1.5); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Where the bodies of a piece stand: one, or Blades' trio around the placed point. */
  private footprints(kind: BodyKind, x: number, y: number, facing: number): [number, number][] {
    if (kind !== "blades") return [[x, y]];
    const pts: SpreadBody[] = [];
    const r = RADIUS("blades");
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI / 2) * facing + (i * TAU) / 3;
      pts.push({ id: i, x: x + Math.cos(a) * 0.32, y: y + Math.sin(a) * 0.32, r, side: 0, vis: spriteVis(r) });
    }
    // Spaced the way the battle draws the trio (see spreadBattle), so Fight doesn't snap them together.
    const off = spreadOffsets(pts);
    return pts.map((p) => { const o = off.get(p.id); return [p.x + (o?.[0] ?? 0), p.y + (o?.[1] ?? 0)]; });
  }

  private drawRangeHint(kind: UnitKind, x: number, y: number, ok: boolean) {
    const ctx = this.ctx, def = UNITS[kind];
    const r = kind === "mine" ? def.range : def.role === "ranged" || def.role === "artillery" || def.role === "caster" || kind === "ballista" ? def.range : kind === "medic" ? def.range : 0;
    if (!r) return;
    ctx.save();
    ctx.strokeStyle = ok ? (kind === "mine" ? "rgba(255,120,80,0.7)" : "rgba(166,255,246,0.45)") : "rgba(255,77,77,0.5)";
    ctx.fillStyle = kind === "mine" ? "rgba(255,120,80,0.12)" : "rgba(166,255,246,0.05)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); this.cam.groundPath(ctx, x, y, r); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  private drawSelection(p: Piece) {
    const ctx = this.ctx, def = UNITS[p.kind];
    const r = (p.kind === "blades" ? 0.62 : def.radius) + 7 / this.cam.scaleAt(p.y);
    this.drawRangeHint(p.kind, p.x, p.y, true);
    ctx.save();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -this.time * 20;
    ctx.beginPath(); this.cam.groundPath(ctx, p.x, p.y, r); ctx.stroke();
    ctx.restore();
  }

  private drawBattle(sc: BattleScene) {
    const ctx = this.ctx, b = sc.battle, a = sc.alpha, as = this.assault;
    this.terrain.ground(ctx, this.cam, b.time, b.blocks); // [arena]
    const spread = this.spreadBattle(b, a);
    // During the round-end assault the survivors move on the assault's clock, not the battle's.
    const pos = (bd: Body) => {
      const st = as?.pose(bd.id);
      if (st) return [st.x, st.y] as const;
      const o = spread.get(bd.id);
      return [bd.px + (bd.x - bd.px) * a + (o?.[0] ?? 0), bd.py + (bd.y - bd.py) * a + (o?.[1] ?? 0)] as const;
    };
    const height = (bd: Body) => (aloft(bd) ? (as?.pose(bd.id)?.z ?? bd.z ?? 1.2) * AIR : 0);
    const tex = vfxReady();
    // ---- ground decals
    for (const z of b.zones ?? []) {
      if (b.time >= z.until) continue;
      const left = Math.min(1, (z.until - b.time) / 0.6);
      if (z.kind === "thorn") { this.drawBrambles(z, left); continue; }
      if (z.kind === "surf") { this.drawSurf(z, left); continue; }
      const fl = 0.75 + 0.25 * Math.sin(this.time * 17 + z.id);
      this.ground(z.x, z.y, (g) => {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, z.r);
        gr.addColorStop(0, `rgba(255,170,60,${0.45 * fl * left})`);
        gr.addColorStop(0.6, `rgba(255,90,30,${0.28 * fl * left})`);
        gr.addColorStop(1, "rgba(255,60,20,0)");
        g.fillStyle = gr;
        g.beginPath(); g.arc(0, 0, z.r, 0, TAU); g.fill();
      });
      if (tex) {
        // A scorch decal and a ring of licking flames, back to front.
        this.groundSheet("scorch", 0, z.x, z.y, z.r * 2.1, { alpha: 0.85 * left, a: z.id });
        const n = Math.max(4, Math.round(z.r * 7));
        const flames: [number, number, number][] = [[z.x, z.y, n]];
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * TAU + z.id * 0.7, d = (i % 2 ? 0.35 : 0.68) * z.r;
          flames.push([z.x + Math.cos(ang) * d, z.y + Math.sin(ang) * d, i]);
        }
        flames.sort((p, q) => p[1] - q[1]);
        for (const [fx, fy, i] of flames) {
          const q = this.cam.project(fx, fy);
          this.sheet("flame", this.loopFrame("flame", 14, i + z.id), q.x, q.y, q.s * (0.42 + 0.12 * (i % 3)) * (0.4 + 0.6 * left), { alpha: left });
        }
      }
      if (Math.random() < 0.35) this.fx.burst(z.x + frand(-z.r, z.r) * 0.7, z.y + frand(-z.r, z.r) * 0.7, 1, { color: "#ffb347", speed: 0.4, size: 0.05, max: 0.6, kind: "spark", gravity: -1.5, vz: 1 });
    }
    this.shotImpacts(b); // JUICE
    if (!as) for (const p of b.projs) if (p.alive && (p.kind === "grenade" || p.kind === "shell")) this.drawLanding(p, a);
    if (!this.arena?.props.length) for (const o of this.obstacles) this.shadow(o.x, o.y, o.r * 1.05, 0.3);
    for (const bd of b.bodies) {
      if (bd.kind !== "mine" || !bd.alive) continue;
      const [x, y] = pos(bd);
      this.token("mine", bd.side, x, y, 0, bd.radius, 0, { t: this.time, state: bd.state, hidden: bd.hidden, own: bd.side === 0, rank: bd.rank, flat: true });
    }
    // Tinkers' turrets going up.
    for (const bd of b.bodies) {
      if (!bd.alive || bd.kind !== "tinker" || bd.state !== "build") continue;
      const u = Math.min(1, bd.t / 1.2);
      this.ground(bd.ax, bd.ay, (g) => {
        g.strokeStyle = "rgba(255,209,102,0.85)"; g.lineWidth = 0.08;
        g.beginPath(); g.arc(0, 0, 0.3, -Math.PI / 2, -Math.PI / 2 + TAU * u); g.stroke();
      });
    }
    // Once the assault starts the battle clock has stopped: bodies caught mid-death and the trickster's
    // illusions fade out on the assault's clock instead of hanging on the field.
    const vanish = as ? Math.max(0, 1 - as.t / VANISH) : 1;
    const fading = (bd: Body) => !!as && (!bd.alive || bd.kind === "decoy");
    // The battle's clock stops with its last blow; the bodies that fell with it finish falling on the board's.
    const now = b.time + (b.done ? this.endT : 0);
    const live = b.bodies.filter((bd) => bd.kind !== "mine" && (bd.alive || now - bd.diedAt < 0.45) && !(fading(bd) && vanish <= 0));
    // a unit hidden in brush (engine: Body.hidden) is drawn faint: yours so you can see your ambush, theirs fainter still
    const hid = (bd: Body) => (bd.hidden && !bd.stealth ? (bd.side === 0 ? 0.6 : 0.4) : 1);
    const fadeOf = (bd: Body) => (bd.alive ? 1 : Math.max(0, 1 - (now - bd.diedAt) / 0.45)) * (fading(bd) ? vanish : 1) * hid(bd);
    for (const bd of live) {
      const [x, y] = pos(bd);
      const st = as?.pose(bd.id);
      if (st) {
        // A striker: its shadow follows the march (a burrower surfaces for it).
        if (!st.gone) this.shadow(x, y, bd.radius * (1.1 - height(bd) * 0.15), 0.38 - height(bd) * 0.08);
        continue;
      }
      if (bd.burrowed) {
        // Underground: a moving mound of earth, no body.
        const ang = Math.atan2(bd.vy, bd.vx);
        if (tex && this.groundSheet("mound", 0, x, y, 0.62, { a: ang })) continue;
        this.ground(x, y, (g) => {
          g.fillStyle = "rgba(95,72,48,0.9)"; g.strokeStyle = "rgba(40,28,18,0.9)"; g.lineWidth = 0.04;
          g.beginPath(); g.ellipse(0, 0, 0.26, 0.18, ang, 0, TAU); g.fill(); g.stroke();
          g.fillStyle = "rgba(160,125,85,0.8)";
          g.beginPath(); g.ellipse(-0.04, -0.04, 0.12, 0.07, 0, 0, TAU); g.fill();
        });
        continue;
      }
      const fade = fadeOf(bd);
      const z = height(bd);
      // Contact shadow: smaller and fainter the higher the body flies. JUICE: a soft two-layer shadow and a team ring.
      // ANIM: it also shrinks and fades while a hop or drop lifts the body, and rides the knockback nudge with it.
      const lift = this.liftOf(b, bd), [ox, oy] = this.juiceOffset(b, bd, motionOf(bd.kind, bd.rank).weight);
      const lk = 1 - Math.min(0.5, lift * 0.9);
      shadowRing(ctx, this.cam, x + ox, y + oy, bd.radius * (1.1 - z * 0.15) * lk, (0.38 - z * 0.08) * fade * lk, bd.kind === "decoy" && bd.side !== 0 ? null : bd.side, bd.alive ? 1 : fade);
      // Auras on the ground under the unit.
      const auraOn = bd.alive && ((bd.buff ?? 0) > 0 || (bd.rally ?? 0) > 0);
      if (auraOn && tex) {
        const rally = (bd.rally ?? 0) > 0;
        this.groundSheet("aura", 0, x, y, bd.radius * 3.3, { a: this.time * 0.8 + bd.id, tint: rally ? GOLD : TEAM[bd.side].main, alpha: 0.6 });
        if (rally) { const q = this.cam.project(x, y); this.sheet("rally", this.loopFrame("rally", 12, bd.id), q.x, q.y, bd.radius * q.s * 2.4, { tint: GOLD, alpha: 0.55 }); }
      } else if (auraOn) {
        ctx.save();
        ctx.strokeStyle = (bd.rally ?? 0) > 0 ? "rgba(255,209,102,0.55)" : team(bd.side).glow + "0.45)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]); ctx.lineDashOffset = -this.time * 12;
        ctx.beginPath(); this.cam.groundPath(ctx, x, y, bd.radius * 1.5); ctx.stroke();
        ctx.restore();
      }
      // Ravager fury: a red heat haze that thickens as it nears death.
      const fury = bd.kind === "ravager" && bd.alive ? 1 - bd.hp / bd.maxHp : 0;
      if (tex && fury > 0.25) {
        const q = this.cam.project(x, y);
        this.sheet("rage", this.loopFrame("rage", 10 + fury * 14, bd.id), q.x, q.y, bd.radius * q.s * (2.4 + fury), { tint: "#ff3b3b", alpha: Math.min(0.85, fury) });
      }
      if (tex && bd.alive && bd.kind === "pikeman" && bd.braced) {
        for (const [i, da] of [[0, -0.35], [1, 0.35]] as const) {
          const q = this.cam.project(x + Math.cos(bd.face + da) * bd.radius * 1.7, y + Math.sin(bd.face + da) * bd.radius * 1.7, 0.15);
          this.sheet("glint", this.loopFrame("glint", 7, bd.id + i * 3), q.x, q.y, 0.34 * q.s, { tint: "#e8eef5", alpha: 0.85 });
        }
      } else if (bd.alive && bd.kind === "pikeman" && bd.braced) {
        const face = bd.face;
        this.ground(x, y, (g) => {
          g.strokeStyle = "rgba(232,238,245,0.7)"; g.lineWidth = 0.06;
          g.beginPath(); g.arc(0, 0, bd.radius * 1.6, face - 0.6, face + 0.6); g.stroke();
        });
      }
    }
    // ---- upright and air layers, painter-sorted by ground y
    const list: Drawable[] = [];
    for (const o of this.obstacles) list.push({ x: o.x, y: o.y, layer: 1, draw: () => this.drawRock(o) });
    list.push(...this.terrain.drawables(this.ctx, this.cam, b.time, b.blocks)); // [arena]
    for (const w of b.waves ?? []) this.drawWave(w);
    for (const f of b.fuses ?? []) {
      if (b.time >= f.at) continue;
      // Thrown bomblets and dropped kegs are still in the air (an anim) for their first moments.
      let seen = this.fuseSeen.get(f);
      if (seen === undefined) this.fuseSeen.set(f, (seen = this.time));
      if (tex && this.time - seen < BOMBLET_FLIGHT) continue;
      list.push({ x: f.x, y: f.y, layer: 1, draw: () => this.drawFuse(f.x, f.y, f.kind === "keg", f.at - b.time < 0.4) });
    }
    for (const bd of live) {
      const st = as?.pose(bd.id);
      if (st) {
        if (!st.gone) list.push({ x: st.x, y: st.y, layer: bd.flying ? 2 : 1, draw: () => this.drawStriker(bd, st, height(bd)) });
        continue;
      }
      if (bd.burrowed) continue;
      list.push({ x: pos(bd)[0], y: pos(bd)[1], layer: bd.flying ? 2 : 1, draw: () => this.drawBody(b, bd, pos(bd), height(bd), fadeOf(bd)) });
    }
    // The battle's own projectiles stopped mid-air when it ended: they fade out with the leftovers.
    for (const p of b.projs) {
      if (!p.alive || vanish <= 0) continue;
      const lob = p.kind === "grenade" || p.kind === "shell";
      list.push({ x: p.px + (p.x - p.px) * a, y: p.py + (p.y - p.py) * a, layer: lob ? 2 : 1, draw: () => { ctx.save(); ctx.globalAlpha *= vanish; this.drawProj(p, a); ctx.restore(); } });
    }
    if (as) this.pushShots(list, as);
    this.pushAirAnims(list);
    this.pushKeeps(list, live.filter((bd) => bd.alive && !bd.flying && !as?.pose(bd.id)?.gone).map((bd) => ({ x: pos(bd)[0], y: pos(bd)[1], kind: bd.kind })));
    for (const d of sortDrawables(list, this.cam)) d.draw();
    // ---- bars and ranks on top (not for illusions, bodies underground or the assault's strikers)
    for (const bd of live) {
      if (!bd.alive || bd.hp >= bd.maxHp || bd.kind === "mite" || bd.kind === "decoy" || bd.burrowed || as?.pose(bd.id)) continue;
      const [x, y] = pos(bd);
      this.drawJuiceBar(bd, x, y, height(bd)); // JUICE
    }
    for (const bd of live) {
      const st = as?.pose(bd.id);
      if (!bd.alive || bd.rank <= 1 || bd.kind === "mite" || (bd.burrowed && !st) || bd.kind === "decoy" || st?.gone) continue;
      const [x, y] = pos(bd);
      const at = this.headAt(bd.kind, bd.rank, x, y, height(bd), bd.radius);
      drawRank(ctx, at.x, at.y + at.r * 1.3 - (bd.hp < bd.maxHp && !st ? 15 : 5), at.r * 1.3, bd.rank);
    }
    this.drawCallouts(b); // JUICE
  }

  private spreadOf = new Map<number, [number, number]>();
  private spreadFor?: Battle;
  private spreadT = 0;
  /** Render-only crowd spacing for ground bodies (spread.ts), eased per body so figures glide apart rather than jump.
   *  Bodies seen for the first time start at their target, matching the deploy footprints. */
  private spreadBattle(b: Battle, a: number): Map<number, [number, number]> {
    if (this.spreadFor !== b) { this.spreadOf.clear(); this.spreadFor = b; this.spreadT = this.time; this.juiceStart(b); }
    const dt = Math.max(0, Math.min(0.1, this.time - this.spreadT));
    this.spreadT = this.time;
    const crowd: SpreadBody[] = [];
    for (const bd of b.bodies) {
      if (!bd.alive || bd.flying || bd.burrowed || bd.kind === "mine") continue;
      const r = RADIUS(bd.kind);
      crowd.push({ id: bd.id, x: bd.px + (bd.x - bd.px) * a, y: bd.py + (bd.y - bd.py) * a, r: bd.radius, side: bd.side, vis: spriteVis(r) });
    }
    const target = spreadOffsets(crowd), k = 1 - Math.exp(-dt * 6);
    for (const c of crowd) {
      const t = target.get(c.id) ?? [0, 0], cur = this.spreadOf.get(c.id);
      if (!cur) { this.spreadOf.set(c.id, [t[0], t[1]]); continue; }
      cur[0] += (t[0] - cur[0]) * k; cur[1] += (t[1] - cur[1]) * k;
    }
    // The dead keep the offset they fell with.
    return this.spreadOf;
  }

  // ---- JUICE: per-body squash and hop (juice.ts), HP bars, callouts
  /** Battle start: every deployed body hops in place, staggered across the line, and lands in a puff of dust. */
  private juiceStart(b: Battle) {
    this.juice.reset();
    this.endT = 0;
    this.atkAt.clear(); this.castAt.clear(); this.hitAt.clear(); this.recoilAt.clear(); this.gaitOf.clear(); this.shotAt.clear();
    if (this.juice.reduced) return;
    for (const bd of b.bodies) {
      if (bd.owner !== -1 || bd.flying || bd.kind === "mine" || bd.burrowed) continue;
      this.fx.anim("dust", bd.x, bd.y, { size: Math.max(0.7, bd.radius * 3), max: 0.4, tint: "#d6c3a0", layer: "ground", alpha: 0.55, delay: hopDelay(bd.x) + HOP_AIR });
    }
  }

  /** Extra height, scale and squash for a body from the juice: the start hop, a summon's pop-in, a hit's recoil. */
  private juiceBody(b: Battle, bd: Body): { z: number; scale: number; sq?: readonly [number, number] } {
    if (this.juice.reduced) return { z: 0, scale: 1 };
    let z = 0, scale = 1, sq: readonly [number, number] | undefined;
    if (bd.owner === -1 && !bd.flying && b.time < 1.2) {
      const t = b.time - hopDelay(bd.x);
      if (t > 0 && t < HOP_AIR) { z = HOP_HEIGHT * Math.sin((t / HOP_AIR) * Math.PI); sq = landSquash(-1); }
      else if (t >= HOP_AIR && t < HOP_AIR + 0.32) sq = landSquash((t - HOP_AIR) / 0.32);
    }
    const t0 = this.juice.spawned.get(bd.id);
    if (t0 !== undefined) {
      const u = (this.juice.time - t0) / 0.3;
      if (u < 1) scale = popScale(u); else if (u < 2) sq = landSquash((u - 1));
    }
    if (bd.alive && bd.flash > 0) {
      const f = Math.min(1, bd.flash / 0.12) * 0.09;
      sq = mulSq(sq, [1 + f, 1 - f]);
    }
    return { z, scale, sq };
  }

  /** HP bars, only for damaged bodies: a rounded team bar whose lost part drains a moment after each hit. */
  private drawJuiceBar(bd: Body, x: number, y: number, z: number) {
    const at = this.headAt(bd.kind, bd.rank, x, y, z, bd.radius);
    const hp = this.juice.hpBar(bd.id, Math.max(0, bd.hp / bd.maxHp));
    hpBar(this.ctx, at.x, at.y - 10, Math.max(18, at.r * 1.9), hp, bd.side, this.juice.time);
  }

  /** Ascended ability callouts over their units (after the bodies, before the numbers). */
  private drawCallouts(b: Battle | null) {
    let prev: { x: number; y: number } | null = null;
    for (const c of this.juice.callouts) {
      const bd = c.id >= 0 && b ? b.bodies.find((o) => o.id === c.id) : undefined;
      if (bd && bd.alive) { c.x = bd.x; c.y = bd.y; }
      let head = bd ? this.headAt(bd.kind, bd.rank, c.x, c.y, aloft(bd) ? (bd.z ?? 1.2) * AIR : 0, bd.radius).y : this.cam.project(c.x, c.y, 0.6).y - this.cam.scaleAt(c.y) * 0.9;
      // Two ribbons near each other stack instead of overlapping.
      const px = this.cam.project(c.x, c.y).x;
      if (prev && Math.abs(px - prev.x) < 130 && Math.abs(head - prev.y) < 26) head = prev.y - 26;
      prev = { x: px, y: head };
      drawCallout(this.ctx, this.cam, c, head, this.juice.time);
    }
  }
  // ---- /JUICE

  private drawBody(b: Battle, bd: Body, [x, y]: readonly [number, number], z: number, fade: number) {
    const ctx = this.ctx;
    // ANIM: the blow (the sim's swing, or an attack seen from an event), the special move, the wind-up before the
    // next blow, and the gait phase.
    const mo = motionOf(bd.kind, bd.rank);
    const atkT = Math.max(bd.swing, this.atkAt.get(bd.id) ?? -9);
    const swing = b.time - atkT < STRIKE_TIME ? (b.time - atkT) / STRIKE_TIME : -1;
    const castT = this.castAt.get(bd.id);
    const cast = bd.alive && castT !== undefined && b.time - castT < CAST_TIME ? (b.time - castT) / CAST_TIME : undefined;
    const sp = Math.hypot(bd.vx, bd.vy);
    const windup = swing < 0 && cast === undefined ? this.windupOf(b, bd, mo.weight, sp) : undefined;
    const gait = this.stepGait(bd, sp, mo, x, y);
    if (bd.kind === "lancer" && bd.state === "charge" && sp > 2.5 && Math.random() < 0.5)
      this.fx.burst(bd.x - Math.cos(bd.face) * 0.3, bd.y - Math.sin(bd.face) * 0.3, 1, { color: "rgba(170,150,120,0.55)", speed: 0.5, size: 0.12, max: 0.45, kind: "smoke", gravity: 0 });
    if (bd.kind === "shade" && bd.hidden && Math.random() < 0.15)
      this.fx.burst(bd.x, bd.y, 1, { color: "rgba(180,140,255,0.35)", speed: 0.3, size: 0.1, max: 0.5, kind: "smoke", gravity: 0 });
    if (bd.kind === "keg" && bd.state === "run" && Math.random() < 0.6)
      this.fx.burst(bd.x, bd.y, 1, { color: "#ffd166", speed: 0.8, size: 0.035, max: 0.3, kind: "spark", gravity: 0 });
    const fall = bd.owner === -1 ? this.dropping(bd.pieceId) : { z: 0, scale: 1 };
    z += fall.z;
    // JUICE: the muster hop as the battle starts, a pop-in for summons, a recoil squash on each hit.
    const jz = this.juiceBody(b, bd);
    z += jz.z;
    const scale = (aloft(bd) ? 1 + (bd.z ?? 1.2) * 0.08 : 1) * fall.scale * jz.scale;
    let sq = mulSq(fall.sq, jz.sq);
    // ANIM: a crouch through the wind-up, a stretch on the blow that springs back (heavier bodies squash more).
    if (!this.juice.reduced && bd.alive) {
      const amp = mo.weight === "heavy" ? 1.3 : mo.weight === "light" ? 0.8 : 1;
      if (cast !== undefined) sq = mulSq(sq, strikeSquash(cast < CAST_WIND ? -1 + cast / CAST_WIND : (cast - CAST_WIND) / (1 - CAST_WIND), amp * 0.7));
      else if (swing >= 0) sq = mulSq(sq, strikeSquash(swing, amp));
      else if (windup !== undefined) sq = mulSq(sq, strikeSquash(-1 + windup, amp));
    }
    const [ox, oy] = this.juiceOffset(b, bd, mo.weight);
    x += ox; y += oy;
    const decoy = bd.kind === "decoy";
    const owner = decoy ? b.bodies.find((o) => o.id === bd.owner) : undefined;
    // A decoy has its own ghostly atlas; the drawn fallback borrows the trickster's token.
    const art = decoy && hasAtlas("decoy");
    const kind = decoy && !art ? "trickster" : bd.kind;
    const radius = bd.radius * scale * (decoy && !art ? RADIUS("trickster") / RADIUS("decoy") : 1);
    this.token(kind, bd.side, x, y, z, radius, bd.face, {
      t: this.time, alpha: (decoy ? 0.85 + 0.1 * Math.sin(this.time * 9 + bd.id) : 1) * (bd.alive ? fade : 1), dying: bd.alive ? undefined : 1 - fade,
      flash: bd.flash / 0.12, swing, swingA: bd.swingA, speed: sp, windup, cast, gait, weight: mo.weight, ranged: bd.range > 1.2,
      state: bd.state, id: bd.id, hidden: bd.hidden, own: bd.side === 0, rank: decoy ? owner?.rank ?? bd.rank : bd.rank, sq,
      still: (bd.frozen ?? 0) > 0,
    });
    const at = this.bodyAt(x, y, z, bd.radius);
    const tex = vfxReady(), feet = this.cam.project(x, y, z);
    const frozen = bd.alive && (bd.frozen ?? 0) > 0;
    if (frozen && !this.frozenAt.has(bd.id)) this.frozenAt.set(bd.id, this.time);
    else if (!frozen && this.frozenAt.has(bd.id)) {
      this.frozenAt.delete(bd.id);
      if (tex) this.fx.anim("icebreak", bd.x, bd.y, { size: Math.max(0.8, bd.radius * 3.4), max: 0.4, z });
      this.onSound?.("clank", 0.3);
    }
    if (tex && frozen) {
      const n = vfxSheet("ice")?.frames ?? 1;
      const f = Math.min(n - 1, Math.floor((this.time - this.frozenAt.get(bd.id)!) * 24));
      this.sheet("ice", f, feet.x, feet.y, Math.max(0.8, bd.radius * 3.3) * feet.s);
    } else if (tex && bd.alive && (bd.slow ?? 0) > 0) {
      this.sheet("chill", this.loopFrame("chill", 12, bd.id), feet.x, feet.y, bd.radius * feet.s * 3, { tint: ICE, alpha: Math.min(1, (bd.slow ?? 0) * 2) * 0.8 });
    } else if (frozen) this.drawIce(at.x, at.y, at.r * 1.25);
    else if (bd.alive && (bd.slow ?? 0) > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = ICE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(at.x, at.y, at.r * 1.15, at.r * 1.15 * this.cam.squashAt(y), 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (tex && bd.alive && bd.kind === "duelist" && (bd.parryCd ?? 1) <= 0) {
      this.sheet("glint", this.loopFrame("glint", 9, bd.id), at.x + at.r * 0.8, at.y - at.r * 0.8, 0.42 * feet.s, { tint: "#fff6d6" });
    } else if (bd.alive && bd.kind === "duelist" && (bd.parryCd ?? 1) <= 0) {
      const gl = 0.5 + 0.5 * Math.sin(this.time * 10);
      ctx.save(); ctx.globalAlpha = gl; ctx.fillStyle = "#fff6d6";
      ctx.beginPath(); ctx.arc(at.x + at.r * 0.8, at.y - at.r * 0.8, 2.5, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (bd.alive && bd.kind === "lion" && b.time < (bd.budget ?? 0)) {
      // Last Stand: a golden blaze round him while nothing can kill him.
      const pulse = 0.8 + 0.2 * Math.sin(this.time * 12);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#ffd75e"; ctx.lineWidth = 3;
      ctx.fillStyle = "rgba(255,215,94,0.22)";
      ctx.beginPath(); ctx.ellipse(at.x, at.y - at.r * 0.35, at.r * 1.4 * pulse, at.r * 1.6 * pulse, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (bd.alive && (bd.ward ?? 0) > 0) {
      // Lantern ward: a warm bubble that thins as it soaks up blows.
      const fade = Math.min(1, (bd.wardT ?? 1) / 0.5);
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 6 + bd.id);
      ctx.save();
      ctx.globalAlpha = 0.75 * fade;
      ctx.strokeStyle = bd.wardBurst ? "#fff2b8" : "#ffd27a"; ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(255,214,120,0.14)";
      ctx.beginPath(); ctx.ellipse(at.x, at.y - at.r * 0.35, at.r * 1.3 * pulse, at.r * 1.45 * pulse, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (bd.alive && bd.kind === "hook" && (bd.state === "cast" || bd.state === "reel")) {
      // The Hookwarden's chain, taut from its fist to each catch.
      for (const id of bd.hits ?? []) {
        const v = b.bodies.find((o) => o.id === id);
        if (!v || !v.alive) continue;
        const vx = v.x, vy = v.y;
        let tx = vx, ty = vy;
        if (bd.state === "cast") {
          // In flight: the hook runs out from the fist toward the target.
          const k = Math.max(0, Math.min(1, 1 - (bd.budget - b.time) / Math.max(0.05, Math.hypot(vx - x, vy - y) / 12)));
          tx = x + (vx - x) * k; ty = y + (vy - y) * k;
        }
        const p0 = this.cam.project(x, y, 0.35), p1 = this.cam.project(tx, ty, 0.3);
        ctx.save();
        ctx.strokeStyle = "#3b3f48"; ctx.lineWidth = Math.max(2, p0.s * 0.07); ctx.setLineDash([p0.s * 0.09, p0.s * 0.05]);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        ctx.strokeStyle = bd.rank >= 4 ? "#fff2b8" : "#b9c2cf"; ctx.lineWidth = Math.max(1, p0.s * 0.035);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        ctx.restore();
      }
    }
    if (bd.alive && bd.stun > 0.05) this.drawStun(at.x, at.y - at.r * 1.1, at.r, tex);
  }

  /** Riptide surf: a pale blue wash with foam rings that drift, left in a Tidecaller wave's lane. */
  private drawSurf(z: { id: number; x: number; y: number; r: number; until: number }, left: number) {
    this.ground(z.x, z.y, (g) => {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, z.r);
      gr.addColorStop(0, `rgba(120,200,235,${0.42 * left})`);
      gr.addColorStop(0.75, `rgba(80,170,215,${0.3 * left})`);
      gr.addColorStop(1, "rgba(80,170,215,0)");
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, z.r, 0, TAU); g.fill();
      g.strokeStyle = `rgba(235,250,255,${0.7 * left})`; g.lineWidth = 0.035;
      for (let i = 0; i < 2; i++) {
        const k = (this.time * 0.6 + i * 0.5 + z.id * 0.13) % 1;
        g.globalAlpha = 1 - k;
        g.beginPath(); g.arc(0, 0, z.r * (0.3 + 0.6 * k), 0, TAU); g.stroke();
      }
    });
  }

  /** A Tidecaller wave: a foaming crest the width of its lane rolling forward, with a wet wake behind it. */
  private drawWave(w: { id: number; x: number; y: number; y0: number; dir: number; w: number; side: number }) {
    const wake = Math.min(2.2, Math.abs(w.y - w.y0));
    this.ground(w.x, w.y, (g) => {
      const hw = w.w / 2, d = w.dir;
      // Wake: a fading wet band trailing back toward where it was called.
      const gr = g.createLinearGradient(0, 0, 0, -d * wake);
      gr.addColorStop(0, "rgba(70,170,220,0.55)");
      gr.addColorStop(1, "rgba(70,170,220,0)");
      g.fillStyle = gr;
      g.fillRect(-hw, Math.min(0, -d * wake), w.w, wake);
      // Crest: a deep blue body with a white foam lip at the front, wobbling.
      g.fillStyle = "rgba(40,120,180,0.85)";
      g.beginPath();
      g.moveTo(-hw, -d * 0.35);
      for (let i = 0; i <= 8; i++) {
        const u = -hw + (w.w * i) / 8;
        g.lineTo(u, d * (0.08 + 0.05 * Math.sin(this.time * 14 + i * 1.7 + w.id)));
      }
      g.lineTo(hw, -d * 0.35);
      g.closePath(); g.fill();
      g.strokeStyle = "rgba(245,252,255,0.95)"; g.lineWidth = 0.09; g.lineCap = "round";
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const u = -hw + (w.w * i) / 8, v = d * (0.08 + 0.05 * Math.sin(this.time * 14 + i * 1.7 + w.id));
        if (i === 0) g.moveTo(u, v); else g.lineTo(u, v);
      }
      g.stroke();
    });
  }

  /** A Thornweaver's bramble patch: a mossy ground stain with thorned runners curling across it. */
  private drawBrambles(z: { id: number; x: number; y: number; r: number; until: number }, left: number) {
    this.ground(z.x, z.y, (g) => {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, z.r);
      gr.addColorStop(0, `rgba(96,122,58,${0.5 * left})`);
      gr.addColorStop(0.7, `rgba(74,96,44,${0.35 * left})`);
      gr.addColorStop(1, "rgba(60,80,40,0)");
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, z.r, 0, TAU); g.fill();
      const n = Math.max(5, Math.round(z.r * 7));
      g.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU + z.id * 1.3, rr = z.r * (0.55 + 0.35 * ((i * 7 + z.id) % 3) / 2);
        const sway = Math.sin(this.time * 2 + i) * 0.04;
        const mx = Math.cos(a0 + 0.5 + sway) * rr * 0.6, my = Math.sin(a0 + 0.5 + sway) * rr * 0.6;
        const ex = Math.cos(a0) * rr, ey = Math.sin(a0) * rr;
        g.strokeStyle = `rgba(58,44,30,${0.95 * left})`; g.lineWidth = 0.07;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
        g.strokeStyle = `rgba(122,150,72,${0.9 * left})`; g.lineWidth = 0.035;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
        // thorns along the runner
        g.fillStyle = `rgba(236,224,196,${0.9 * left})`;
        for (const t of [0.45, 0.75]) {
          const px = 2 * (1 - t) * t * mx + t * t * ex, py = 2 * (1 - t) * t * my + t * t * ey;
          g.beginPath(); g.moveTo(px - 0.025, py); g.lineTo(px + Math.cos(a0 + 1.6) * 0.07, py + Math.sin(a0 + 1.6) * 0.07); g.lineTo(px + 0.025, py); g.fill();
        }
      }
    });
  }

  private drawFuse(x: number, y: number, keg: boolean, urgent = false) {
    if (vfxReady()) {
      const q = this.cam.project(x, y), sz = keg ? 0.42 : 0.3;
      this.groundSheet("shadow", 0, x, y, sz, { alpha: 0.6 });
      if (this.sheet(keg ? "keg" : "bomb", this.loopFrame(keg ? "keg" : "bomb", urgent ? 28 : 14, x * 7), q.x, q.y - 0.04 * q.s, sz * q.s * (urgent ? 1 + 0.08 * Math.sin(this.time * 40) : 1))) return;
    }
    const ctx = this.ctx, rw = keg ? 0.18 : 0.11;
    this.shadow(x, y, rw, 0.4);
    const p = this.cam.project(x, y, rw), r = rw * p.s;
    ctx.fillStyle = keg ? "#7a4a24" : "#2b2f36"; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = (this.time * 14) % 1 > 0.5 ? "#ffd166" : "#ff6a3d";
    ctx.beginPath(); ctx.arc(p.x + r * 0.4, p.y - r * 0.8, Math.max(1.5, r * 0.3), 0, TAU); ctx.fill();
  }

  /** Projectiles fly on arcs: lobs use the sim's height, shots rise and fall over their path from launcher to target. */
  private drawProj(p: Proj, a: number) {
    const ctx = this.ctx, cam = this.cam;
    const wx = p.px + (p.x - p.px) * a, wy = p.py + (p.y - p.py) * a;
    const pv = PROJ_VFX[p.kind];
    if (pv && vfxReady()) {
      const pfx = p.fx ?? "";
      if (p.kind === "grenade" || p.kind === "shell") {
        const zh = 0.25 + p.z * 0.6, q = cam.project(wx, wy, zh);
        // It swells as it climbs towards the camera and its shadow shrinks and thins under it, so the arc reads.
        const grow = 1 + Math.min(3.2, p.z) * 0.16;
        this.groundSheet("shadow", 0, wx, wy, pv.size * 1.1 * (1 - Math.min(0.45, p.z * 0.14)), { alpha: 0.65 - Math.min(0.3, p.z * 0.1) });
        if (pfx === "fire" && Math.random() < 0.7) this.fx.burst(p.x, p.y, 1, { color: "#ff9a3d", speed: 0.3, size: 0.05, max: 0.3, kind: "spark", gravity: 0, z: zh * 2 - 0.6 });
        // A steady smoke trail (a puff every 70 ms of board time), not a random one.
        const puffed = this.puffAt.get(p) ?? -1;
        if (this.time - puffed >= 0.07) {
          this.puffAt.set(p, this.time);
          this.fx.anim("smoke", p.x, p.y, { size: 0.3 * grow, max: 0.5, z: zh, tint: pfx === "fire" ? "#4a3a34" : "#c9c2b8", alpha: 0.6, grow: [0.7, 1.5], fadeOut: 0.3 });
        }
        this.sheet(pv.sheet, this.loopFrame(pv.sheet, 16, p.id), q.x, q.y, pv.size * q.s * grow, { a: p.kind === "grenade" ? this.time * 9 : Math.atan2(p.vy, p.vx) });
        return;
      }
      const arc = shotArc(p);
      const hAt = (x: number, y: number) => arc.base + arc.peak * bump(progress(p, x, y));
      const head = cam.project(wx, wy, hAt(wx, wy));
      const sp = Math.hypot(p.vx, p.vy) || 1, tx = wx - (p.vx / sp) * 0.5, ty = wy - (p.vy / sp) * 0.5;
      const tail = cam.project(tx, ty, hAt(tx, ty));
      const ang = Math.atan2(head.y - tail.y, head.x - tail.x), s = head.s;
      const tint = p.kind === "shard" || pfx === "freeze" ? ICE : p.kind === "pellet" ? GOLD : p.kind === "bolt" ? "#ffe6be" : "#ffffff";
      this.shotTrail(p, wx, wy, hAt(wx, wy), tint, (p.kind === "bolt" ? 0.11 : p.kind === "pellet" ? 0.05 : 0.07) * s); // JUICE
      this.shadow(wx, wy, p.kind === "bolt" ? 0.1 : 0.07, 0.3);
      if (pv.trail) {
        // A comet tail in the shooter's colour with a bright core, tapering back from the head: the shot reads as a
        // streak of its team's colour even when the arrow itself is a few pixels long.
        const len = (p.kind === "bolt" ? 1.25 : 0.95) * s, hw = pv.size * s * (p.kind === "bolt" ? 0.5 : 0.62);
        const cx = Math.cos(ang), cy = Math.sin(ang), bx = head.x - cx * len, by = head.y - cy * len;
        const wedge = (w: number, color: string, alpha: number) => {
          ctx.save();
          ctx.globalAlpha *= alpha; ctx.fillStyle = color;
          ctx.beginPath(); ctx.moveTo(head.x - cy * w, head.y + cx * w); ctx.lineTo(bx, by); ctx.lineTo(head.x + cy * w, head.y - cx * w); ctx.closePath(); ctx.fill();
          ctx.restore();
        };
        wedge(hw, TEAM[p.side].main, 0.7);
        wedge(hw * 0.45, tint, 0.9);
      }
      this.sheet(pv.sheet, 0, head.x, head.y, pv.size * s, { a: ang });
      return;
    }
    if (p.kind === "grenade" || p.kind === "shell") {
      const shell = p.kind === "shell";
      this.shadow(wx, wy, shell ? 0.14 : 0.1, 0.4);
      const q = cam.project(wx, wy, 0.25 + p.z * 0.6), r = (shell ? 0.17 : 0.12) * q.s;
      if (p.fx === "fire" && Math.random() < 0.7) this.fx.burst(p.x, p.y, 1, { color: "#ff9a3d", speed: 0.3, size: 0.05, max: 0.3, kind: "spark", gravity: 0, z: (0.25 + p.z * 0.6) * 2 - 0.6 });
      ctx.fillStyle = shell ? "#3b4048" : "#2b2f36"; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = (this.time * 12) % 1 > 0.5 ? "#ffd166" : "#ff6a3d";
      ctx.beginPath(); ctx.arc(q.x + r * 0.5, q.y - r * 0.6, Math.max(1.2, r * 0.3), 0, TAU); ctx.fill();
      return;
    }
    const arc = shotArc(p);
    const hAt = (x: number, y: number) => arc.base + arc.peak * bump(progress(p, x, y));
    const h = hAt(wx, wy);
    const head = cam.project(wx, wy, h);
    this.shotTrail(p, wx, wy, h, p.kind === "shard" ? ICE : p.kind === "pellet" ? GOLD : "#ffffff", (p.kind === "bolt" ? 0.09 : 0.05) * head.s); // JUICE
    if (p.kind === "pellet") {
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath(); ctx.arc(head.x, head.y, Math.max(2, 0.05 * head.s), 0, TAU); ctx.fill();
      return;
    }
    const ice = p.kind === "shard";
    const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
    const len = p.kind === "bolt" ? 0.75 : ice ? 0.32 : 0.42;
    const tx = wx - ux * len * 1.6, ty = wy - uy * len * 1.6;
    const tail = cam.project(tx, ty, hAt(tx, ty));
    const ang = Math.atan2(head.y - tail.y, head.x - tail.x);
    const pxLen = Math.hypot(head.x - tail.x, head.y - tail.y) / 1.6, s = head.s;
    this.shadow(wx, wy, 0.06, 0.25);
    ctx.save();
    ctx.translate(head.x, head.y); ctx.rotate(ang);
    const tg = ctx.createLinearGradient(-pxLen * 1.6, 0, 0, 0);
    tg.addColorStop(0, "rgba(255,255,255,0)"); tg.addColorStop(1, p.kind === "bolt" ? "rgba(255,230,190,0.8)" : ice ? "rgba(190,235,255,0.9)" : "rgba(255,255,255,0.6)");
    ctx.strokeStyle = tg; ctx.lineWidth = (p.kind === "bolt" ? 0.09 : ice ? 0.08 : 0.05) * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-pxLen * 1.6, 0); ctx.lineTo(0, 0); ctx.stroke();
    if (ice) {
      ctx.fillStyle = "#e9f9ff";
      ctx.beginPath(); ctx.moveTo(pxLen * 0.35, 0); ctx.lineTo(0, -0.06 * s); ctx.lineTo(-pxLen * 0.3, 0); ctx.lineTo(0, 0.06 * s); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = p.kind === "bolt" ? "#e9d7b8" : "#f4efe6"; ctx.lineWidth = (p.kind === "bolt" ? 0.07 : 0.035) * s;
      ctx.beginPath(); ctx.moveTo(-pxLen, 0); ctx.lineTo(pxLen * 0.1, 0); ctx.stroke();
      ctx.fillStyle = "#cfd8e3";
      ctx.beginPath(); ctx.moveTo(pxLen * 0.25, 0); ctx.lineTo(0, -0.05 * s); ctx.lineTo(0, 0.05 * s); ctx.fill();
    }
    ctx.restore();
  }

  /** JUICE: a tapered trail behind a straight shot, through its last few positions (world, re-projected each frame so
   *  it sits right under camera shake). */
  private shotTrail(p: Proj, x: number, y: number, z: number, color: string, width: number) {
    let pts = this.trails.get(p);
    if (!pts) this.trails.set(p, (pts = []));
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 0.04) { pts.push({ x, y, z }); if (pts.length > 6) pts.shift(); }
    // Where it is now, for the landing (shotImpacts).
    this.shotAt.set(p, { x, y, z, a: Math.atan2(p.vy, p.vx), color });
    if (pts.length < 2) return;
    const scr = pts.map((q) => this.cam.project(q.x, q.y, q.z));
    scr.push(this.cam.project(x, y, z));
    // Shots without a comet tail of their own (turret pellets, the drawn fallback) get a team-coloured wake under the core.
    if (!PROJ_VFX[p.kind]?.trail || !vfxReady()) drawTrail(this.ctx, scr, TEAM[p.side].main, width * 2.4, 0.5);
    drawTrail(this.ctx, scr, color, width, 0.85);
  }

  /** JUICE: a straight shot that was in flight last frame and is gone now has landed: sparks thrown back along its
   *  path, a splinter star and a small ring where it stopped. */
  private shotImpacts(b: Battle) {
    if (!this.shotAt.size) return;
    const flying = new Set(b.projs);
    for (const [p, at] of this.shotAt) {
      if (p.alive && flying.has(p)) continue;
      this.shotAt.delete(p);
      if (this.assault) continue;
      const big = p.kind === "bolt";
      this.fx.burst(at.x, at.y, big ? 7 : 4, { color: at.color, speed: big ? 3 : 2.3, spread: 1.5, dir: at.a + Math.PI, size: big ? 0.06 : 0.045, max: 0.3, gravity: 5, kind: "spark", z: at.z });
      if (vfxReady()) this.fx.anim("spark", at.x, at.y, { size: big ? 0.8 : 0.5, max: 0.16, tint: at.color, a: at.a, z: at.z });
      if (!this.juice.reduced) this.fx.ring(at.x, at.y, 0.06, big ? 0.55 : 0.34, 0.2, "rgba(255,255,255,0.75)", 0.045);
    }
  }

  /** JUICE: where a lobbed shot will land: a team-coloured ring on the ground that tightens as the bomb comes down. */
  private drawLanding(p: Proj, a: number) {
    const wx = p.px + (p.x - p.px) * a, wy = p.py + (p.y - p.py) * a;
    const u = Math.max(0, Math.min(1, progress(p, wx, wy)));
    const r = (p.kind === "shell" ? 0.85 : 0.6) * (1 - 0.55 * u), ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha *= 0.25 + 0.55 * u;
    ctx.strokeStyle = TEAM[p.side].main;
    ctx.lineWidth = Math.max(1.5, this.cam.scaleAt(p.ty) * 0.05);
    ctx.setLineDash([6, 5]); ctx.lineDashOffset = -this.time * 30;
    ctx.beginPath(); this.cam.groundPath(ctx, p.tx, p.ty, r); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = TEAM[p.side].main;
    ctx.beginPath(); this.cam.groundPath(ctx, p.tx, p.ty, r * 0.35); ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------ keeps and the round-end assault
  /** Adds the two keeps to the depth-sorted list, and fades a keep that stands in front of a body behind it. */
  private pushKeeps(list: Drawable[], bodies: { x: number; y: number; kind: BodyKind }[]) {
    if (!this.showKeeps) return;
    for (const side of [0, 1] as Side[]) {
      this.keeps[side].see = bodies.some((p) => behindKeep(side, p.x, p.y, RADIUS(p.kind)));
      list.push({ x: keepAnchor(side).x, y: keepAnchor(side).y, layer: 1, draw: () => this.drawKeep(side) });
    }
  }

  /** A point on the keep image (manifest pixels) as a world point standing on the keep: x across, z up. */
  private keepPt(side: Side, px: [number, number]): { x: number; y: number; z: number } {
    const m = keepManifest(), a = keepAnchor(side), g = m.anchors.ground, u = KEEP_SCALE / m.ppu;
    // The keep art is rendered at the board camera's elevation, so image height reads as height on the board.
    return { x: a.x + (px[0] - g[0]) * u, y: a.y + 0.05, z: Math.max(0, ((g[1] - px[1]) * u) / this.cam.sin) };
  }

  /** Where a blow aimed at keepHitPoint lands: on the wall facing the attacker, partway up. */
  private wallPt(side: Side, x: number, y: number): { x: number; y: number; z: number } {
    const k = keepAnchor(side), front = y > k.y - 0.55;
    return { x, y: k.y + (front ? 1 : -1) * KEEP_RY * 0.8, z: WALL_Z };
  }

  private drawKeep(side: Side) {
    const k = this.keeps[side];
    const state = (side === 0 && keepStateDebug()) || keepState(this.keepHp[side]); // [skins] debug override for shots
    const skin = this.skinOf(side); // [skins]
    const img = keepImage(side, state, this.bossKeep, skin);
    if (!img) return;
    const ctx = this.ctx, m = keepManifest(), a = keepAnchor(side);
    const base = this.cam.project(a.x, a.y), u = (KEEP_SCALE / m.ppu) * base.s;
    // [keeps polish] the collapse once this commander is defeated, and the keep's own squash on a blow
    const fall = k.fallT >= 0 ? collapsePose(k.fallT, side === 0 ? -1 : 1) : null;
    const jig = (k.shake * 0.07 + (fall ? fall.shake * 0.05 : 0)) * base.s;
    const ox = jig ? frand(-jig, jig) : 0, oy = jig ? frand(-jig * 0.5, jig * 0.5) : 0;
    ctx.save();
    // Contact shadow on the ground under the plinth.
    ctx.globalAlpha *= 0.38;
    ctx.fillStyle = "#000";
    ctx.beginPath(); this.cam.groundPath(ctx, a.x + 0.06, a.y + 0.08, KEEP_SCALE * 1.2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= k.alpha;
    const dx = base.x + ox - m.anchors.ground[0] * u, dy = base.y + oy - m.anchors.ground[1] * u, w = m.w * u, h = m.h * u;
    // [keeps polish] rubble under the falling keep; the standing keep sinks into it behind the plinth's front
    if (fall) {
      const rubble = keepImage(side, "fallen", this.bossKeep, skin); // [skins]
      if (rubble) { ctx.globalAlpha = k.alpha * fall.rubble; ctx.drawImage(rubble, base.x - m.anchors.ground[0] * u, base.y - m.anchors.ground[1] * u, w, h); }
      ctx.globalAlpha = k.alpha * fall.alpha;
      if (fall.alpha > 0) {
        ctx.beginPath(); ctx.rect(dx - w, dy - h, w * 3, h + (m.anchors.gate[1] + 10) * u); ctx.clip();
        ctx.translate(base.x, base.y); ctx.rotate(fall.tilt); ctx.translate(-base.x, -base.y + fall.sink * h);
      }
    }
    const sq = keepSquash(k.hitT, k.hitK);
    if (sq.sx !== 1 || sq.sy !== 1) { ctx.translate(base.x, base.y); ctx.scale(sq.sx, sq.sy); ctx.translate(-base.x, -base.y); }
    if (!fall || fall.alpha > 0) ctx.drawImage(img, dx, dy, w, h);
    if (k.flash > 0 && (!fall || fall.alpha > 0)) {
      // The hit flash: the keep's own pixels added over themselves.
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = k.alpha * Math.min(1, k.flash) * 0.55;
      ctx.drawImage(img, dx, dy, w, h);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = k.alpha;
    if ((state === "burning" || state === "ruined") && !fall) {
      const fires = state === "burning" ? m.anchors.fires : m.anchors.fires.slice(1, 3);
      fires.forEach((f, i) => {
        this.drawFlame(dx + f[0] * u, dy + f[1] * u, base.s * (state === "burning" ? 0.3 : 0.2), i + side * 7);
      });
    }
    ctx.restore();
    // [keeps polish] the winner runs its banner up over the keep
    if (k.winT >= 0) {
      const top = m.anchors.top;
      drawVictoryBanner(ctx, base.x + (top[0] - m.anchors.ground[0]) * u, base.y + (top[1] - m.anchors.ground[1]) * u, base.s * (side === 0 ? 1.7 : 1.2), bannerRaise(k.winT), this.time, team(side), GOLD, INK);
    }
  }

  private drawFlame(x: number, y: number, size: number, seed: number) {
    const ctx = this.ctx, t = this.time * 9 + seed * 1.7;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, y - size * 0.3, 0, x, y - size * 0.3, size * 1.6);
    g.addColorStop(0, "rgba(255,170,60,0.45)"); g.addColorStop(1, "rgba(255,90,20,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y - size * 0.3, size * 1.6, 0, TAU); ctx.fill();
    for (const [k, col, w] of [[1, "rgba(255,110,40,0.85)", 1], [0.68, "rgba(255,200,80,0.9)", 0.7], [0.38, "rgba(255,250,210,0.95)", 0.45]] as [number, string, number][]) {
      const hgt = size * k * (1.7 + 0.35 * Math.sin(t + k * 3) + 0.2 * Math.sin(t * 2.3 + seed));
      const half = size * w * 0.55, lean = Math.sin(t * 0.7 + seed) * size * 0.18;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - half, y);
      ctx.quadraticCurveTo(x - half * 1.1, y - hgt * 0.55, x + lean, y - hgt);
      ctx.quadraticCurveTo(x + half * 1.1, y - hgt * 0.55, x + half, y);
      ctx.quadraticCurveTo(x, y + half * 0.5, x - half, y);
      ctx.fill();
    }
    ctx.restore();
  }

  private updateKeeps(dt: number) {
    const m = keepManifest(), snd = (n: string, g = 0.5) => this.onSound?.(n, g);
    // Particles are drawn at half their z (drawFx), so heights on the keep are doubled going in.
    const puff = (side: Side, px: [number, number], n: number, o: Parameters<Fx["burst"]>[3]) => {
      const p = this.keepPt(side, px);
      this.fx.burst(p.x, p.y, n, { ...o, z: p.z * 2 + (o?.z ?? 0) });
    };
    for (const side of [0, 1] as Side[]) {
      const k = this.keeps[side];
      k.flash = Math.max(0, k.flash - dt * 6);
      k.shake = Math.max(0, k.shake - dt * 3.5);
      // [keeps polish] a defeated commander's keep collapses; the survivor runs up its banner
      k.hitT += dt;
      const other = this.keeps[1 - side];
      if (this.keepHp[side] <= 0 && k.fallT < 0) {
        k.fallT = 0;
        if (this.keepHp[1 - side] > 0) other.winT = 0;
        this.assault?.hold(VICTORY_HOLD);
        snd("crumble", 1);
      } else if (this.keepHp[side] > 0 && k.fallT >= 0) { k.fallT = -1; other.winT = -1; }
      if (k.fallT >= 0) {
        const was = collapsePose(k.fallT).phase;
        k.fallT += dt;
        const now = collapsePose(k.fallT).phase;
        if (now === "fall" && Math.random() < dt * 30) {
          const p = this.keepPt(side, [m.anchors.ground[0] + frand(-110, 110), m.anchors.ground[1] - frand(0, 90)]);
          this.fx.burst(p.x, p.y + 0.3, 1, { color: "#8d929b", speed: 1.8, size: 0.07, max: 0.8, kind: "chunk", vz: 2.5, spin: 8, z: p.z * 2 });
        }
        if (was !== now && now !== "rumble") {
          // the tower starts down (dust rolls out round the plinth), then lands in a cloud
          const big = now === "settled";
          const a = keepAnchor(side);
          for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * TAU;
            this.fx.burst(a.x + Math.cos(ang) * 1.05, a.y + Math.sin(ang) * 0.62, 1, { color: "rgba(216,196,154,0.4)", speed: big ? 1.9 : 1.2, size: big ? 0.3 : 0.24, max: big ? 1.0 : 0.8, kind: "smoke", gravity: -0.25, drag: 1.8, z: 0.3 });
          }
          puff(side, [m.anchors.ground[0], (m.anchors.ground[1] + m.anchors.top[1]) / 2], big ? 16 : 26, { color: "#8d929b", speed: 2.6, size: 0.09, max: 1, kind: "chunk", vz: 4, spin: 9 });
          snd(big ? "slam" : "boom", big ? 0.9 : 0.7);
        }
      }
      if (k.winT >= 0) {
        const r0 = bannerRaise(k.winT);
        k.winT += dt;
        if (r0 < 0.97 && bannerRaise(k.winT) >= 0.97) {
          const top = this.keepPt(side, m.anchors.top);
          this.fx.burst(top.x, top.y, 18, { color: GOLD, speed: 2, size: 0.05, max: 1.1, kind: "spark", gravity: 1.2, vz: 2.5, z: top.z * 2 + 2.4 });
          snd("upgrade", 0.6);
        }
      }
      k.alpha += ((k.see ? 0.55 : 1) - k.alpha) * Math.min(1, dt * 10); // [keeps polish] was 0.42: the keep keeps more presence
      const state = keepState(this.keepHp[side]);
      if (k.state && state !== k.state && KEEP_STATES.indexOf(state) > KEEP_STATES.indexOf(k.state)) {
        // A stage of damage: masonry comes down.
        const mid: [number, number] = [m.anchors.ground[0], (m.anchors.ground[1] + m.anchors.top[1]) / 2];
        puff(side, mid, 22, { color: "#8d929b", speed: 2.4, size: 0.08, max: 0.9, kind: "chunk", vz: 3.5, spin: 8 });
        puff(side, m.anchors.ground, 8, { color: "rgba(140,130,120,0.32)", speed: 1.3, size: 0.17, max: 0.9, kind: "smoke", gravity: -0.3, drag: 1.5 });
        k.shake = 1;
        k.hitT = 0; k.hitK = 1.2; // [keeps polish]
        this.fx.shake = Math.min(1, this.fx.shake + 0.4);
        snd("crumble", 0.8);
      }
      k.state = state;
      // Embers off the flames, smoke from the broken stone.
      if (state === "burning" || state === "ruined") {
        k.ember += dt * (state === "burning" ? 7 : 3);
        while (k.ember >= 1) {
          k.ember -= 1;
          puff(side, m.anchors.fires[Math.floor(Math.random() * m.anchors.fires.length)], 1, { color: "#ffb347", speed: 0.35, size: 0.035, max: 0.9, kind: "spark", gravity: -1.6, vz: 1.2, drag: 1 });
        }
      }
      if (state !== "intact") {
        k.smoke += dt * (state === "ruined" ? 2.4 : state === "burning" ? 1.6 : 0.4);
        while (k.smoke >= 1) {
          k.smoke -= 1;
          puff(side, m.anchors.smoke[Math.floor(Math.random() * m.anchors.smoke.length)], 1, { color: state === "cracked" ? "rgba(150,145,140,0.18)" : "rgba(50,46,52,0.3)", speed: 0.15, size: 0.1, max: 1.6, kind: "smoke", gravity: -0.55, vz: 0.6, drag: 0.5 });
        }
      }
      // [skins] the skin's own motes drift off the player's standing keep
      const mote = side === 0 && k.fallT < 0 ? skinMotes(this.skinOf(side)) : null;
      if (mote) {
        this.skinMote += dt * mote.rate;
        while (this.skinMote >= 1) {
          this.skinMote -= 1;
          const g = m.anchors.ground, t = m.anchors.top;
          puff(side, [g[0] + frand(-140, 140), t[1] + frand(-50, 110)], 1, { color: mote.colors[Math.floor(Math.random() * mote.colors.length)], kind: mote.kind, size: mote.size, max: mote.max, gravity: mote.gravity, vz: mote.vz, speed: mote.speed, drag: mote.drag, spin: mote.spin });
        }
      }
    }
  }

  /** Starts the round-end assault from where the battle left off. */
  startAssault(battle: Battle, damage: [number, number], linger?: number): Assault {
    this.assault = new Assault(battle.bodies, { damage, obstacles: this.obstacles, linger });
    // The illusions break as the round ends.
    for (const bd of battle.bodies) {
      if (!bd.alive || bd.kind !== "decoy") continue;
      this.fx.burst(bd.x, bd.y, 10, { color: "rgba(200,170,255,0.7)", speed: 1.4, size: 0.12, max: 0.45, kind: "smoke", gravity: 0, drag: 2, z: 0.6 });
      this.fx.ring(bd.x, bd.y, 0.1, 0.45, 0.25, VIOLET, 0.04);
    }
    return this.assault;
  }

  /** Advances the assault and turns what happens into effects. */
  updateAssault(dt: number) {
    this.assault?.update(dt, (e) => this.onAssault(e));
  }

  private onAssault(e: AssaultEvent) {
    const fx = this.fx, snd = (n: string, g = 0.5) => this.onSound?.(n, g);
    if (e.t === "swing") {
      const st = e.s;
      if (st.style === "melee") {
        const k = keepHitPoint(st.target, st.x, st.y);
        fx.arc(st.x, st.y, Math.atan2(k.y - st.y, k.x - st.x), st.radius + 0.35, st.side === 0 ? "#e9fffd" : "#fff0ea", 2.0, 0.18);
        snd("slash", 0.3);
      } else if (st.style === "keg") snd("fuse", 0.5);
      else if (st.style === "dive") snd("blink", 0.35);
      return;
    }
    if (e.t === "launch") {
      const sh = e.shot;
      if (sh.style === "zap") {
        const w = this.wallPt(e.s.target, sh.x1, sh.y1);
        fx.bolt([[sh.x0, sh.y0], [(sh.x0 + w.x) / 2 + frand(-0.3, 0.3), (sh.y0 + w.y) / 2], [w.x, w.y]], ZAP, 0.3);
        fx.flash = Math.max(fx.flash, 0.06); fx.flashColor = "#cfe8ff";
        snd("zap", 0.5);
      } else snd(sh.style === "lob" || sh.style === "shell" ? "throw" : sh.style === "bolt" ? "bolt" : sh.style === "shard" ? "zap" : "arrow", 0.35);
      return;
    }
    // Impact on the keep: blasts on the ground at its foot, sparks and stone off the wall.
    const k = this.keeps[e.target], w = this.wallPt(e.target, e.x, e.y), z = w.z * 2;
    const big = e.style === "shell" || e.style === "keg" || e.style === "slam";
    k.flash = 1;
    k.shake = Math.min(1.4, k.shake + (big ? 1 : 0.45));
    k.hitT = 0; k.hitK = big ? 1.3 : e.first ? 1 : 0.6; // [keeps polish] the keep's own squash
    this.juice.shake(big ? 0.4 : 0.22); // JUICE: keep hits jolt the camera
    if (big) this.juice.hitStop(3);
    const stone = { color: "#8d929b", speed: big ? 2.6 : 1.6, size: 0.06, max: 0.7, kind: "chunk" as const, vz: 2.5, spin: 8, z };
    switch (e.style) {
      case "lob": this.boom(w.x, w.y, 0.8, "grenade", (1 - e.target) as Side); break;
      case "shell": this.boom(w.x, w.y, 1.1, "shell", (1 - e.target) as Side); break;
      case "keg": this.boom(w.x, w.y, 1.2, "keg", (1 - e.target) as Side); break;
      case "slam": this.boom(w.x, w.y, 1.0, "slam", (1 - e.target) as Side); break;
      case "shard":
        fx.ring(w.x, w.y, 0.05, 0.45, 0.3, ICE, 0.05);
        fx.burst(w.x, w.y, 10, { color: "#e9f9ff", speed: 2, size: 0.05, max: 0.4, kind: "chunk", vz: 2, spin: 6, z });
        snd("clank", 0.4);
        break;
      case "zap":
        fx.burst(w.x, w.y, 10, { color: "#dff1ff", speed: 2.6, size: 0.04, max: 0.3, kind: "spark", gravity: 0, z });
        break;
      default:
        fx.burst(w.x, w.y, e.style === "bolt" ? 10 : 6, { color: "#fff2d6", speed: 2.6, size: 0.045, max: 0.28, kind: "spark", gravity: 0, z });
        snd(e.style === "melee" || e.style === "dive" ? "hit" : "clank", 0.35);
    }
    fx.burst(w.x, w.y, big ? 10 : 4, stone);
    fx.burst(w.x, w.y, big ? 5 : 2, { color: "rgba(150,140,130,0.45)", speed: 0.8, size: 0.2, max: 0.8, kind: "smoke", gravity: 0, drag: 2, z });
    if (e.first && this.assault) {
      const dmg = this.assault.damage[e.target];
      // Over the keep's flag; the rival's number sits in front of its keep, which stands against the far edge.
      const a = keepAnchor(e.target);
      let at = { x: a.x, y: a.y + 1.0 };
      if (e.target === 0) {
        const top = this.keepPt(0, keepManifest().anchors.top), q = this.cam.project(top.x, top.y, top.z);
        at = this.cam.unprojectAt(q.x, q.y - 0.3 * q.s, 0.6);
      }
      fx.float(at.x, at.y, `-${dmg}`, e.target === 0 ? "#ff6b5a" : GOLD, 0.62, 1.5);
      fx.shake = Math.min(1, fx.shake + 0.35);
      this.onShake?.(e.target === 0 ? 2 : 1);
      snd("crumble", 0.7);
    }
  }

  /** A survivor on the march or striking the keep, from the assault's pose rather than the battle's. */
  private drawStriker(bd: Body, st: Striker, z: number) {
    if (st.gone || !this.assault) return;
    const scale = bd.flying ? 1 + st.z * 0.08 : 1;
    this.token(bd.kind, bd.side, st.x, st.y, z, bd.radius * scale, st.face, {
      t: this.time, swing: this.assault.swing(st), swingA: st.face, speed: this.assault.speed(st), state: "run", id: bd.id, own: bd.side === 0, rank: bd.rank,
    });
  }

  /** Arrows, bolts and bombs in flight to a keep, depth-sorted with everything else. */
  private pushShots(list: Drawable[], as: Assault) {
    for (const sh of as.shots) {
      if (as.t < sh.t0) continue;
      const u = Math.min(1, (as.t - sh.t0) / Math.max(0.01, sh.t1 - sh.t0));
      const end = this.wallPt(sh.side === 0 ? 1 : 0, sh.x1, sh.y1);
      const at = (v: number) => ({ x: sh.x0 + (end.x - sh.x0) * v, y: sh.y0 + (end.y - sh.y0) * v });
      const lob = sh.style === "lob" || sh.style === "shell";
      const peak = lob ? (sh.style === "shell" ? 1.4 : 0.9) : Math.min(1.2, Math.hypot(end.x - sh.x0, end.y - sh.y0) * 0.1);
      const hAt = (v: number) => 0.45 + (end.z - 0.45) * v + peak * bump(v);
      const p = at(u);
      list.push({ x: p.x, y: p.y, layer: lob ? 2 : 1, draw: () => this.drawShot(sh, at, hAt, u) });
    }
  }

  private drawShot(sh: Shot, at: (v: number) => { x: number; y: number }, hAt: (v: number) => number, u: number) {
    const ctx = this.ctx, cam = this.cam, p = at(u);
    const head = cam.project(p.x, p.y, hAt(u)), s = head.s;
    this.shadow(p.x, p.y, sh.style === "shell" ? 0.14 : 0.08, 0.3);
    if (sh.style === "lob" || sh.style === "shell") {
      const r = (sh.style === "shell" ? 0.17 : 0.12) * s;
      ctx.fillStyle = sh.style === "shell" ? "#3b4048" : "#2b2f36"; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = (this.time * 12) % 1 > 0.5 ? "#ffd166" : "#ff6a3d";
      ctx.beginPath(); ctx.arc(head.x + r * 0.5, head.y - r * 0.6, Math.max(1.2, r * 0.3), 0, TAU); ctx.fill();
      return;
    }
    if (sh.style === "pellet") {
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath(); ctx.arc(head.x, head.y, Math.max(2, 0.05 * s), 0, TAU); ctx.fill();
      return;
    }
    const ice = sh.style === "shard", bolt = sh.style === "bolt";
    const back = Math.max(0, u - 0.12), t = at(back), tail = cam.project(t.x, t.y, hAt(back));
    const ang = Math.atan2(head.y - tail.y, head.x - tail.x), len = (bolt ? 0.75 : ice ? 0.32 : 0.42) * s;
    ctx.save();
    ctx.translate(head.x, head.y); ctx.rotate(ang);
    const tg = ctx.createLinearGradient(-len * 1.6, 0, 0, 0);
    tg.addColorStop(0, "rgba(255,255,255,0)"); tg.addColorStop(1, bolt ? "rgba(255,230,190,0.8)" : ice ? "rgba(190,235,255,0.9)" : "rgba(255,255,255,0.6)");
    ctx.strokeStyle = tg; ctx.lineWidth = (bolt ? 0.09 : ice ? 0.08 : 0.05) * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-len * 1.6, 0); ctx.lineTo(0, 0); ctx.stroke();
    if (ice) {
      ctx.fillStyle = "#e9f9ff";
      ctx.beginPath(); ctx.moveTo(len * 0.35, 0); ctx.lineTo(0, -0.06 * s); ctx.lineTo(-len * 0.3, 0); ctx.lineTo(0, 0.06 * s); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = bolt ? "#e9d7b8" : "#f4efe6"; ctx.lineWidth = (bolt ? 0.07 : 0.035) * s;
      ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len * 0.1, 0); ctx.stroke();
      ctx.fillStyle = "#cfd8e3";
      ctx.beginPath(); ctx.moveTo(len * 0.25, 0); ctx.lineTo(0, -0.05 * s); ctx.lineTo(0, 0.05 * s); ctx.fill();
    }
    ctx.restore();
  }

  private drawIce(x: number, y: number, r: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(190,235,255,0.42)"; ctx.strokeStyle = "rgba(233,249,255,0.9)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3, k = i % 2 ? 0.85 : 1.05;
      i ? ctx.lineTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k) : ctx.moveTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 0.2); ctx.lineTo(x - r * 0.1, y - r * 0.55); ctx.stroke();
    ctx.restore();
  }

  private drawStun(x: number, y: number, r: number, tex = false) {
    const ctx = this.ctx;
    if (tex) {
      for (let i = 0; i < 3; i++) {
        const a = this.time * 8 + (i * TAU) / 3;
        this.sheet("glint", this.loopFrame("glint", 12, i), x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.25, Math.max(8, r * 0.7), { tint: "#ffe08a" });
      }
      return;
    }
    ctx.save();
    ctx.fillStyle = "#ffe08a";
    for (let i = 0; i < 3; i++) {
      const a = this.time * 8 + (i * TAU) / 3;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.25, Math.max(1.5, r * 0.12), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /** Effects live in world space: rings lie on the ground, slashes at waist height, sparks and floats above. */
  private drawFx() {
    const ctx = this.ctx, fx = this.fx, cam = this.cam;
    this.drawAnims("air");
    for (const r of fx.rings) {
      const u = 1 - r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * easeOut(u);
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.beginPath(); cam.groundPath(ctx, r.x, r.y, rad);
      if (r.fill) { ctx.fillStyle = r.fill; ctx.fill(); }
      ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(1, r.width * cam.scaleAt(r.y) * (1 - u * 0.6));
      ctx.stroke();
      ctx.restore();
    }
    for (const a of fx.arcs) {
      const u = 1 - a.life / a.max;
      this.ground(a.x, a.y, (g) => {
        g.globalAlpha = 1 - u;
        g.rotate(a.a);
        g.fillStyle = a.color;
        g.beginPath();
        const sp = a.spread / 2, start = -sp + u * 0.4;
        g.arc(0, 0, a.r, start, sp);
        g.arc(0, 0, a.r * 0.72, sp, start, true);
        g.closePath(); g.fill();
      }, 0.3);
    }
    for (const bm of fx.beams) {
      const u = 1 - bm.life / bm.max;
      const p0 = cam.project(bm.x0, bm.y0, 0.4), p1 = cam.project(bm.x1, bm.y1, 0.4);
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = bm.color; ctx.lineWidth = bm.width * (p0.s + p1.s) / 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      ctx.restore();
    }
    for (const bl of fx.bolts) {
      const u = 1 - bl.life / bl.max;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const s = this.s;
      for (const [width, alpha, color] of [[0.22, 0.25, "#6aa8ff"], [0.09, 0.9, bl.color], [0.035, 1, "#ffffff"]] as [number, number, string][]) {
        ctx.globalAlpha = alpha * (1 - u);
        ctx.strokeStyle = color; ctx.lineWidth = width * s; ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.beginPath();
        let k = bl.seed + Math.floor(this.time * 30);
        const jit = () => { k = (k * 16807) % 2147483647; return (k / 2147483647 - 0.5) * 0.35; };
        bl.pts.forEach(([x, y], i) => {
          if (i === 0) { const q = cam.project(x, y, 0.45); ctx.moveTo(q.x, q.y); return; }
          const [px, py] = bl.pts[i - 1];
          for (let j = 1; j <= 4; j++) {
            const t = j / 4;
            const jx = j < 4 ? jit() : 0, jy = j < 4 ? jit() : 0;
            const q = cam.project(px + (x - px) * t + jx, py + (y - py) * t + jy, 0.45);
            ctx.lineTo(q.x, q.y);
          }
        });
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const p of fx.parts) {
      const u = p.life / p.max;
      const q = cam.project(p.x, p.y, p.z * 0.5 + (p.kind === "spark" || p.kind === "plus" ? 0.3 : 0));
      const x = q.x, y = q.y;
      ctx.save();
      ctx.globalAlpha = Math.min(1, u * 1.6);
      ctx.fillStyle = p.color;
      const size = p.size * q.s * (p.kind === "smoke" ? 1 + (1 - u) * 1.5 : 1);
      if (p.kind === "plus") {
        const w = size * 0.35;
        ctx.fillRect(x - size, y - w, size * 2, w * 2);
        ctx.fillRect(x - w, y - size, w * 2, size * 2);
      } else if (p.kind === "chunk") {
        ctx.translate(x, y); ctx.rotate(p.a ?? 0);
        ctx.fillRect(-size, -size * 0.7, size * 2, size * 1.4);
      } else if (p.kind === "spark") {
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // JUICE: styled numbers (juicedraw.ts drawFloat). Whole-pixel font sizes only: a new size each frame misses the
    // glyph cache and re-rasterises the text (it was most of the frame in a 24-unit battle).
    for (const f of fx.floats) {
      const q = cam.project(f.x, f.y, 0.6 + (f.z ?? 0));
      drawFloat(ctx, f, q.x, q.y, q.s);
    }
  }
}

const easeOut = (x: number) => 1 - (1 - x) ** 3;
// JUICE: the battle-start hop (world units, seconds), staggered left to right across the line.
const HOP_HEIGHT = 0.32;
const HOP_AIR = 0.26;
const hopDelay = (x: number) => 0.05 + (Math.max(0, Math.min(W, x)) / W) * 0.22;
const mulSq = (a?: readonly [number, number], b?: readonly [number, number]): readonly [number, number] | undefined =>
  !a ? b : !b ? a : [a[0] * b[0], a[1] * b[1]];
/** How high (world units) a deployed piece falls from. */
const DROP_HEIGHT = 3;
/** 0 at both ends, 1 in the middle. */
const bump = (u: number) => 4 * u * (1 - u);
/** How far a shot is along its launcher-to-target line, 0..1. */
function progress(p: Proj, x: number, y: number): number {
  const dx = p.tx - p.x0, dy = p.ty - p.y0, L2 = dx * dx + dy * dy;
  if (L2 < 1e-6) return 0;
  return Math.max(0, Math.min(1, ((x - p.x0) * dx + (y - p.y0) * dy) / L2));
}
/** Launch height and arc peak (world units) for a straight shot: arrows loop, bolts and shards fly flatter. */
export function shotArc(p: Pick<Proj, "kind" | "x0" | "y0" | "tx" | "ty">): { base: number; peak: number } {
  const len = Math.hypot(p.tx - p.x0, p.ty - p.y0);
  const k = p.kind === "arrow" ? 0.16 : p.kind === "bolt" ? 0.06 : 0.08;
  return { base: 0.45, peak: Math.min(1.4, len * k) };
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
