// Debug page (?vfx): every battle event's sprite-sheet effect playing on the board in a labelled grid, on a loop.
// Loaded lazily from main.ts so it never ships in the normal path.
import type { BattleEvent, BoomKind } from "@engine/core/battle";
import type { BodyKind, Side } from "@engine/core/defs";
import { BoardView } from "../render/board";
import { loadVfx, playDrop, playEvent, vfxReady } from "../render/vfx";

type Cell = [string, (x: number, y: number) => BattleEvent | "drop"];

const B = (kind: BoomKind, r = 0.9): Cell => [kind, (x, y) => ({ t: "boom", x, y, r, kind, side: 0 })];
const CELLS: Cell[] = [
  ["slash", (x, y) => ({ t: "slash", id: 1, x, y, a: -0.6, r: 0.8, side: 0 })],
  ["spin", (x, y) => ({ t: "slash", id: 1, x, y, a: 0, r: 0.9, side: 1, spin: true })],
  ["hit", (x, y) => ({ t: "hit", id: 1, x, y, dmg: 24, side: 0, big: false })],
  ["big hit", (x, y) => ({ t: "hit", id: 1, x, y, dmg: 40, side: 1, big: true })],
  ["shielded", (x, y) => ({ t: "hit", id: 1, x, y, dmg: 6, side: 0, shielded: true })],
  ["zap", (x, y) => ({ t: "zap", pts: [[x - 0.6, y - 0.5], [x + 0.2, y], [x - 0.3, y + 0.6], [x + 0.6, y + 0.4]], side: 0 })],
  B("mine"), B("grenade"), B("shell"), B("keg"), B("bomblet", 0.6), B("shrapnel", 0.6),
  B("slam"), B("quake", 1.1), B("erupt"), B("talon"), B("pop", 0.6), B("mirror", 0.7),
  ["heal", (x, y) => ({ t: "heal", from: 3, to: 1, x, y, amt: 10 })],
  ["rally", (x, y) => ({ t: "heal", from: 2, to: 1, x, y, amt: 4 })],
  ["bloodlust", (x, y) => ({ t: "heal", from: 5, to: 5, x, y, amt: 4 })],
  ["aura", (x, y) => ({ t: "aura", id: 2, x, y, r: 0.9, side: 0, rally: false })],
  ["rally aura", (x, y) => ({ t: "aura", id: 2, x, y, r: 0.9, side: 0, rally: true })],
  ["spawn", (x, y) => ({ t: "spawn", id: 9, x, y, side: 0, kind: "golemling", from: 1 })],
  ["death", (x, y) => ({ t: "death", id: 9, x, y, kind: "ranger", side: 1 })],
  ["golem death", (x, y) => ({ t: "death", id: 9, x, y, kind: "golem", side: 0 })],
  ["mite death", (x, y) => ({ t: "death", id: 9, x, y, kind: "mite", side: 1 })],
  ["blink", (x, y) => ({ t: "blink", id: 1, x0: x - 0.6, y0: y - 0.4, x: x + 0.4, y: y + 0.3, side: 0 })],
  ["charge", (x, y) => ({ t: "charge", id: 1, x, y, a: -1.2 })],
  ["fuse", (x, y) => ({ t: "fuse", id: 1, x, y })],
  ["burrow", (x, y) => ({ t: "burrow", id: 1, x, y, side: 0 })],
  ["dig", (x, y) => ({ t: "dig", id: 1, x, y })],
  ["emerge", (x, y) => ({ t: "emerge", id: 1, x, y, r: 0.8, side: 0, big: false })],
  ["cave-in", (x, y) => ({ t: "emerge", id: 1, x, y, r: 1.1, side: 0, big: true })],
  ["dive", (x, y) => ({ t: "dive", id: 1, x, y: y - 0.3, target: 3, tx: x + 0.5, ty: y + 0.5, side: 0 })],
  ["chill", (x, y) => ({ t: "chill", id: 1, x, y, dur: 2 })],
  ["freeze", (x, y) => ({ t: "freeze", id: 1, x, y, dur: 2 })],
  ["parry", (x, y) => ({ t: "parry", id: 1, x, y, by: 3, riposte: false })],
  ["riposte", (x, y) => ({ t: "parry", id: 1, x, y, by: 3, riposte: true })],
  ["brace", (x, y) => ({ t: "brace", id: 1, x, y, a: -1.57 })],
  ["impale", (x, y) => ({ t: "impale", id: 1, target: 3, x, y })],
  ["raise", (x, y) => ({ t: "raise", id: 9, from: 1, x, y, side: 0 })],
  ["build", (x, y) => ({ t: "build", id: 4, x, y, dur: 1.2 })],
  ["repair", (x, y) => ({ t: "repair", from: 4, to: 9, x, y, amt: 5 })],
  ["decoy", (x, y) => ({ t: "decoy", id: 9, from: 1, x, y, side: 0 })],
  ["pop", (x, y) => ({ t: "pop", id: 9, x, y, side: 0 })],
  ["light", (x, y) => ({ t: "light", id: 1, x, y })],
  ["kegdrop", (x, y) => ({ t: "kegdrop", x, y, at: 5, side: 0 })],
  ["bomblets", (x, y) => ({ t: "bomblets", x, y, pts: [[x - 0.5, y + 0.4], [x + 0.5, y + 0.4], [x, y - 0.5]], at: 4, side: 0 })],
  ["zone", (x, y) => ({ t: "zone", id: 1, x, y, r: 0.8, until: 6, side: 0 })],
  ["revive", (x, y) => ({ t: "revive", id: 1, from: 3, x, y })],
  ["volley", (x, y) => ({ t: "volley", id: 1, x, y, a: -1.57 })],
  ["twin", (x, y) => ({ t: "twin", id: 1, x, y, a: -1.57 })],
  ["reset", (x, y) => ({ t: "reset", id: 1, x, y })],
  ["shot bolt", (x, y) => ({ t: "shot", id: 1, kind: "bolt", x, y })],
  ["deploy", () => "drop"],
  // Legendaries
  ["soar", (x, y) => ({ t: "soar", id: 1, x, y, side: 0, second: false })],
  ["second dive", (x, y) => ({ t: "soar", id: 1, x, y, side: 0, second: true })],
  ["swoop", (x, y) => ({ t: "swoop", id: 1, x, y, r: 1.0, side: 0, second: false })],
  B("swoop", 1.0),
  ["wave", (x, y) => ({ t: "wave", id: 9, from: 1, x, y0: y + 0.6, y1: y - 0.6, w: 1.8, dur: 0.3, side: 0, surf: false })],
  ["surf", (x, y) => ({ t: "zone", id: 1, x, y, r: 0.8, until: 6, side: 0, kind: "surf" })],
  ["lion rally", (x, y) => ({ t: "rally", id: 1, x, y, r: 0.9, side: 0, n: 3 })],
  ["last stand", (x, y) => ({ t: "laststand", id: 1, x, y, until: 3 })],
];

const BODY: Record<number, { kind: BodyKind; side: Side }> = { 1: { kind: "ranger", side: 0 }, 2: { kind: "banner", side: 0 }, 3: { kind: "medic", side: 0 }, 4: { kind: "tinker", side: 0 }, 5: { kind: "ravager", side: 1 } };

/** opts.at: fire everything once together and freeze at that age (seconds), for review stills. */
export async function vfxLab(app: HTMLElement, opts: { page?: number; cols?: number; at?: number } = {}) {
  await loadVfx();
  const cols = opts.cols ?? 4, rows = 6, per = cols * rows;
  const page = Math.max(0, (opts.page ?? 1) - 1);
  const cells = CELLS.slice(page * per, page * per + per);
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;touch-action:none";
  app.replaceChildren(canvas);
  const view = new BoardView(canvas);
  const fit = () => view.layout(innerWidth, innerHeight, { x: 6, y: 6, w: innerWidth - 12, h: innerHeight - 12 });
  fit();
  addEventListener("resize", fit);
  const at = (i: number) => ({ x: (9 * ((i % cols) + 0.5)) / cols, y: (14 * (Math.floor(i / cols) + 0.5)) / rows });
  const env = {
    find: (id: number) => BODY[id] && { ...BODY[id], x: 4.5, y: 7, face: -1.57, radius: 0.35, alive: true },
    time: 0,
    get textured() { return vfxReady(); },
  };
  const PERIOD = 1.8;
  const fired = new Map<number, number>();
  let last = performance.now();
  const frame = (now: number) => {
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (opts.at !== undefined) dt = view.time >= opts.at ? 0 : Math.min(1 / 60, opts.at - view.time);
    view.update(dt);
    cells.forEach(([, make], i) => {
      const k = opts.at !== undefined ? 0 : Math.floor((view.time + i * 0.07) / PERIOD);
      if (fired.get(i) === k) return;
      fired.set(i, k);
      const { x, y } = at(i);
      const e = make(x, y + 0.2);
      if (e === "drop") playDrop(view.fx, x, y + 0.2, 0.35, 0);
      else playEvent(view.fx, e, env);
    });
    view.render({ mode: "deploy", pieces: [] });
    const ctx = view.ctx;
    ctx.save();
    ctx.font = "700 11px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    cells.forEach(([label], i) => { const { x, y } = at(i); { const q = view.toScreen(x, y - 0.85); ctx.fillText(label, q.x, q.y); }; });
    ctx.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
