// Bastion UI: map select, the in-run HUD (wave, gold, keep HP, call-wave, speed, follow), the place / upgrade /
// sell sheet, and the result screen. Owns its canvas loop and touch input; reuses the kit's buttons and icons.
import "./td.css";
import { ABILITIES, ASCEND_ROUND, MAX_RANK, UNITS, type UnitKind } from "@engine/core/defs";
import { MAP_DEFS } from "@engine/core/td/maps";
import { DT, KEEP_HP, LEASH, SELL_BACK, TD_ROSTER, TdRun, modeOf, placeCost, rankUpCost } from "@engine/core/td/sim";
import { BOSS_NAME } from "@engine/core/td/waves";
import { earn } from "@engine/economy/wallet";
import { sfx, unlockAudio } from "../audio/sfx";
import { whenPortrait } from "../render/sprites";
import { TdView } from "../render/tdView";
import { el, stars } from "./dom";
import { ROLE_LABEL, coin, icon, roleBadge } from "./kit";
import { attachReward } from "./barracks";
import { winChest } from "@engine/progression/chests"; // [chests]
import { passEvent } from "@engine/progression/passEvents"; // [pass]
import { chestEarned } from "./chests"; // [chests]

const KEY = "muster.td.v1";
interface TdSave { stars: Record<string, number>; best: Record<string, number>; }
function loadTd(): TdSave {
  try { const r = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (r && r.stars) return { stars: r.stars, best: r.best ?? {} }; } catch { /* fresh */ }
  return { stars: {}, best: {} };
}
function saveTd(mut: (s: TdSave) => void) {
  const s = loadTd(); mut(s);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
/** Coins: a little per wave cleared, more for a win (into the shared wallet). */
export const COINS_PER_WAVE = 2;
export const coinsForWin = (stars: number) => 20 + stars * 10;

function button(label: string | Node, cls: string, fn: () => void) {
  const b = el("button", { class: `btn ${cls}` }, [label]) as HTMLButtonElement;
  b.addEventListener("click", (e) => { e.stopPropagation(); unlockAudio(); sfx("tap"); fn(); });
  return b;
}

/** Map select. `exit` goes back to the title. */
export function bastionMenu(app: HTMLElement, exit: () => void) {
  app.replaceChildren();
  const s = loadTd();
  const back = el("button", { class: "icon-btn back", "aria-label": "Back" }, [icon("back")]);
  back.addEventListener("click", () => { sfx("tap"); exit(); });
  const total = MAP_DEFS.reduce((a, m) => a + (s.stars[m.id] ?? 0), 0);
  const cards = MAP_DEFS.map((m, i) => {
    const got = s.stars[m.id] ?? 0;
    const card = el("button", { class: `td-map-card act${m.act}` }, [
      el("div", { class: "td-map-art" }, [mapThumb(m.id)]),
      el("div", { class: "td-map-info" }, [
        el("div", { class: "td-map-num" }, [`Map ${i + 1}`]),
        el("h2", {}, [m.name]),
        el("p", {}, [m.blurb]),
        el("div", { class: "td-map-meta" }, [stars(got, 3, "td-stars"), el("span", {}, [s.best[m.id] ? `best wave ${s.best[m.id]}` : "18 waves"])]),
      ]),
    ]);
    card.addEventListener("click", () => { unlockAudio(); sfx("tap"); playBastion(app, m.id, exit); });
    return card;
  });
  app.append(el("div", { class: "screen td-select" }, [
    el("div", { class: "screen-head" }, [back, el("h1", {}, ["Bastion"]), el("span", { class: "star-total" }, [stars(1, 1), String(total)])]),
    el("p", { class: "td-intro" }, ["Hold the road. Build on the stone pads, rank up, and keep the walls standing."]),
    el("div", { class: "td-maps" }, cards),
  ]));
}

function mapThumb(id: string): HTMLCanvasElement {
  const run = new TdRun(id, 1);
  const c = el("canvas", { class: "td-thumb" }) as HTMLCanvasElement;
  const map = run.map, w = 96, h = 150, dpr = 2;
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  g.fillStyle = map.act === 3 ? "#5fa548" : "#6cb84e"; g.fillRect(0, 0, w, h);
  const X = (x: number) => (x / map.w) * w, Y = (y: number) => (y / map.h) * h;
  g.lineJoin = "round"; g.lineCap = "round";
  for (const [col, lw] of [["#b98d55", 7], ["#e7c78b", 5]] as const) {
    g.strokeStyle = col; g.lineWidth = lw;
    for (const p of map.paths) { g.beginPath(); p.pts.forEach((q, i) => (i ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y)))); g.stroke(); }
  }
  g.fillStyle = "#d9d1bf";
  for (const p of map.pads) { g.beginPath(); g.arc(X(p.x), Y(p.y), 2.4, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#3fd0c9"; g.beginPath(); g.arc(X(map.keep.x), Y(map.keep.y), 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#ff6a4d"; for (const q of map.gates) { g.beginPath(); g.arc(X(q.x), Y(q.y), 4, 0, Math.PI * 2); g.fill(); }
  return c;
}

/** A run on one map. */
export function playBastion(app: HTMLElement, mapId: string, exit: () => void, seed = 1) {
  app.replaceChildren();
  const run = new TdRun(mapId, seed);
  const root = el("div", { class: "td-run" });
  const canvas = el("canvas", { class: "td-canvas" }) as HTMLCanvasElement;
  root.append(canvas);
  app.append(root);
  const view = new TdView(canvas, run);
  let speed = 1, follow = false, paused = false, alive = true, acc = 0, last = performance.now();
  let coins = 0;
  let sheetEl: HTMLElement | null = null;

  // ---- HUD
  const waveEl = el("b", {}, ["0"]);
  const goldEl = el("b", {}, [String(run.gold)]);
  const hpFill = el("i", { class: "td-hp-fill" });
  const hpText = el("b", { class: "td-hp-text" }, [String(KEEP_HP)]);
  const quit = el("button", { class: "icon-btn td-quit", "aria-label": "Leave" }, [icon("back")]);
  quit.addEventListener("click", () => { sfx("tap"); leave(); });
  const top = el("div", { class: "td-top" }, [
    quit,
    el("div", { class: "td-chip td-wave" }, [icon("flag"), el("span", {}, ["Wave "]), waveEl, el("small", {}, [`/${run.waveCount}`])]),
    el("div", { class: "td-chip td-gold" }, [coin("", "td-coin"), goldEl]),
    el("div", { class: "td-chip td-keep" }, [icon("shield"), el("div", { class: "td-hp" }, [hpFill]), hpText]),
  ]);
  const banner = el("div", { class: "td-banner" });
  const callBtn = button(el("span", {}, ["Start wave 1"]), "primary td-call", () => {
    const b = run.callWave();
    if (b > 0) toast(`+${b} early bonus`);
    closeSheet();
    refresh(true);
  });
  const speedBtn = button("1x", "ghost td-speed", () => { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; speedBtn.textContent = `${speed}x`; });
  const followBtn = button(el("span", {}, ["Follow"]), "ghost td-follow", () => { follow = !follow; followBtn.classList.toggle("on", follow); if (!follow) view.cam.follow = null; });
  const bottom = el("div", { class: "td-bottom" }, [followBtn, callBtn, speedBtn]);
  const toastEl = el("div", { class: "td-toast" });
  root.append(top, banner, bottom, toastEl);

  function toast(t: string) {
    toastEl.textContent = t;
    toastEl.classList.remove("show"); void toastEl.offsetWidth; toastEl.classList.add("show");
  }
  function showBanner(t: string, sub = "", boss = false) {
    banner.replaceChildren(el("div", {}, [t]), ...(sub ? [el("small", {}, [sub])] : []));
    banner.className = `td-banner show${boss ? " boss" : ""}`;
    setTimeout(() => banner.classList.remove("show"), 1900);
  }

  let shown = { wave: -1, gold: -1, hp: -1, phase: "", bonus: -1, secs: -2 };
  function refresh(force = false) {
    if (force || shown.wave !== run.wave) { waveEl.textContent = String(run.wave); shown.wave = run.wave; }
    if (force || shown.gold !== run.gold) { goldEl.textContent = String(run.gold); shown.gold = run.gold; sheetRefresh?.(); }
    if (force || shown.hp !== run.keepHp) { hpFill.style.width = `${(run.keepHp / KEEP_HP) * 100}%`; hpText.textContent = String(run.keepHp); shown.hp = run.keepHp; }
    const bonus = run.callBonus(), secs = Number.isFinite(run.countdown) ? Math.ceil(run.countdown) : -1;
    if (force || shown.phase !== run.phase || shown.bonus !== bonus || shown.secs !== secs) {
      shown.phase = run.phase; shown.bonus = bonus; shown.secs = secs;
      const lbl = callBtn.firstChild as HTMLElement;
      if (run.phase === "build") {
        callBtn.disabled = false;
        const n = run.wave + 1, boss = !!run.waves[run.wave]?.boss;
        lbl.replaceChildren(el("span", {}, [boss ? "Boss wave" : `Wave ${n}`]), el("small", {}, [run.wave === 0 ? "start" : bonus > 0 ? `${secs}s · now +${bonus}` : `${secs}s`]));
        callBtn.classList.toggle("ready", run.wave === 0);
      } else {
        callBtn.disabled = true;
        lbl.replaceChildren(el("span", {}, [`Wave ${run.wave}`]), el("small", {}, [`${run.enemies.length} left`]));
      }
    } else if (run.phase === "wave") {
      const sm = callBtn.querySelector("small");
      if (sm) sm.textContent = `${run.enemies.length} left`;
    }
  }

  // ---- sheets
  let sheetRefresh: (() => void) | null = null;
  function closeSheet() { sheetEl?.remove(); sheetEl = null; sheetRefresh = null; view.selectedPad = -1; view.ringR = 0; }
  function openPad(pad: number) {
    closeSheet();
    view.selectedPad = pad;
    const d = run.defenderAt(pad);
    const body = d ? defenderSheet(d.id) : placeSheet(pad);
    if (!body) return;
    sheetEl = el("div", { class: "td-sheet" }, [body]);
    sheetEl.addEventListener("pointerdown", (e) => e.stopPropagation());
    root.append(sheetEl);
    // Keep the chosen pad in sight above the sheet.
    const p = run.map.pads[pad], at = view.cam.toScreen(p.x, p.y), sheetTop = sheetEl.getBoundingClientRect().top - root.getBoundingClientRect().top;
    if (at.y > sheetTop - 60) { view.cam.follow = null; follow = false; followBtn.classList.remove("on"); view.cam.panBy(0, -(at.y - (sheetTop - 90))); }
  }
  function placeSheet(pad: number) {
    const grid = el("div", { class: "td-roster" });
    const cards: [HTMLButtonElement, UnitKind][] = [];
    for (const k of TD_ROSTER) {
      const u = UNITS[k];
      const img = el("div", { class: "td-port" });
      void whenPortrait(k, 1).then((im) => { if (im) img.append(im.cloneNode() as HTMLImageElement); });
      const b = el("button", { class: `td-unit fam-${u.role}` }, [img, el("div", { class: "td-unit-name" }, [u.name]), el("div", { class: "td-unit-cost" }, [coin(placeCost(k), "td-coin")])]) as HTMLButtonElement;
      b.addEventListener("click", () => {
        if (run.place(pad, k)) { sfx("buy"); closeSheet(); refresh(true); }
      });
      b.addEventListener("pointerenter", () => { view.ringR = modeOf(k) === "shoot" ? u.range * 1.05 + 0.35 : modeOf(k) === "heal" ? 2.8 : LEASH; });
      cards.push([b, k]);
      grid.append(b);
    }
    sheetRefresh = () => { for (const [b, k] of cards) b.disabled = run.gold < placeCost(k); };
    sheetRefresh();
    return el("div", { class: "td-sheet-in" }, [
      el("div", { class: "td-sheet-head" }, [el("h3", {}, ["Build"]), closeX()]),
      grid,
    ]);
  }
  function defenderSheet(id: number) {
    const d = run.defenders.find((x) => x.id === id);
    if (!d) return null;
    const u = UNITS[d.kind];
    view.ringR = modeOf(d.kind) === "shoot" ? u.range * 1.05 + 0.35 : modeOf(d.kind) === "heal" ? 2.8 : LEASH;
    const img = el("div", { class: "td-port big" });
    void whenPortrait(d.kind, d.rank).then((im) => { if (im) img.append(im.cloneNode() as HTMLImageElement); });
    const info = el("div", { class: "td-def-info" });
    const up = button("", "up td-up", () => { if (run.upgrade(id)) { sfx("buy"); render(); refresh(true); } });
    const sell = button("", "sell td-sell", () => { const g = run.sell(id); toast(`Sold +${g}`); closeSheet(); refresh(true); });
    function render() {
      const dd = run.defenders.find((x) => x.id === id);
      if (!dd) return;
      const job = modeOf(dd.kind) === "block" ? "Blocks the road" : modeOf(dd.kind) === "shoot" ? "Covers the road" : modeOf(dd.kind) === "heal" ? "Heals the line" : "Hunts flyers";
      const asc = ABILITIES[dd.kind];
      info.replaceChildren(
        el("div", { class: "td-def-name" }, [u.name, el("span", { class: "td-rank" }, [stars(dd.rank, MAX_RANK, "td-rank-stars")])]),
        el("div", { class: "td-def-role" }, [roleBadge(u.role), ROLE_LABEL[u.role], " · ", job]),
        el("div", { class: "td-def-stats" }, [`HP ${Math.round(dd.hp)}/${dd.maxHp}`]),
        el("div", { class: `td-asc ${dd.rank >= 4 ? "on" : ""}` }, [el("b", {}, [asc.name]), " ", asc.text]),
      );
      const cost = rankUpCost(dd.kind, dd.rank);
      if (dd.rank >= MAX_RANK) { up.replaceChildren(el("span", {}, ["Ascended"])); up.disabled = true; }
      else if (dd.rank === 3 && !run.canAscend()) { up.replaceChildren(el("span", {}, [`Ascend from wave ${ASCEND_ROUND}`])); up.disabled = true; }
      else { up.replaceChildren(el("span", {}, [dd.rank === 3 ? "Ascend" : `Rank ${dd.rank + 1}`]), coin(cost, "td-coin")); up.disabled = run.gold < cost; up.classList.toggle("ascend", dd.rank === 3); }
      sell.replaceChildren(el("span", {}, ["Sell"]), coin(Math.floor(dd.spent * SELL_BACK), "td-coin"));
    }
    render();
    sheetRefresh = render;
    return el("div", { class: "td-sheet-in" }, [
      el("div", { class: "td-sheet-head" }, [el("h3", {}, ["Defender"]), closeX()]),
      el("div", { class: "td-def" }, [img, info]),
      el("div", { class: "td-def-actions" }, [sell, up]),
    ]);
  }
  function closeX() {
    const x = el("button", { class: "icon-btn td-x", "aria-label": "Close" }, ["×"]);
    x.addEventListener("click", () => closeSheet());
    return x;
  }

  // ---- input: drag to pan with fling, pinch / wheel / double tap to zoom, tap a pad
  const pts = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
  let pinch0 = 0, moved = false, lastTap = 0, lastTapX = 0, lastTapY = 0;
  let vel: { x: number; y: number; t: number }[] = [];
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener("pointerdown", (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    const p = local(e);
    pts.set(e.pointerId, { ...p, x0: p.x, y0: p.y, t0: performance.now() });
    view.cam.stop();
    moved = false; vel = [];
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  canvas.addEventListener("pointermove", (e) => {
    const q = pts.get(e.pointerId);
    if (!q) return;
    const p = local(e);
    if (pts.size === 1) {
      const dx = p.x - q.x, dy = p.y - q.y;
      if (Math.hypot(p.x - q.x0, p.y - q.y0) > 7) moved = true;
      if (moved) { view.cam.panBy(dx, dy); follow = false; followBtn.classList.remove("on"); vel.push({ x: dx, y: dy, t: performance.now() }); if (vel.length > 6) vel.shift(); }
    } else if (pts.size === 2) {
      q.x = p.x; q.y = p.y;
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) view.cam.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch0);
      pinch0 = d; moved = true;
      return;
    }
    q.x = p.x; q.y = p.y;
  });
  const up = (e: PointerEvent) => {
    const q = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    if (!q) return;
    if (pts.size > 0) { pinch0 = 0; return; }
    if (moved) {
      const now = performance.now(), recent = vel.filter((v) => now - v.t < 90);
      if (recent.length) {
        const span = Math.max(16, now - recent[0].t);
        const sx = recent.reduce((a, v) => a + v.x, 0), sy = recent.reduce((a, v) => a + v.y, 0);
        view.cam.fling((sx / span) * 1000, (sy / span) * 1000);
      }
      return;
    }
    const p = local(e), now = performance.now();
    // Minimap tap: jump there.
    const m = view.mini;
    if (p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h) {
      view.cam.centerOn(((p.x - m.x) / m.w) * run.map.w, ((p.y - m.y) / m.h) * run.map.h);
      follow = false; followBtn.classList.remove("on");
      return;
    }
    if (now - lastTap < 300 && Math.hypot(p.x - lastTapX, p.y - lastTapY) < 30) { view.cam.toggleZoom(p.x, p.y); lastTap = 0; closeSheet(); return; }
    lastTap = now; lastTapX = p.x; lastTapY = p.y;
    const pad = view.padAt(p.x, p.y);
    if (pad >= 0) openPad(pad); else closeSheet();
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); const p = local(e as unknown as PointerEvent); view.cam.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });

  // ---- layout
  function layout() {
    const r = root.getBoundingClientRect();
    view.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 2));
    view.cam.insetTop = top.getBoundingClientRect().bottom - r.top;
    view.cam.insetBottom = r.bottom - bottom.getBoundingClientRect().top;
    view.cam.clamp();
  }
  const ro = new ResizeObserver(layout);
  ro.observe(root);
  layout();
  view.cam.centerOn(run.map.w / 2, run.map.h - 9);

  // ---- loop
  let fpsFrames = 0, fpsT = 0, fps = 60, lastSound = 0;
  function frame(now: number) {
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    fpsFrames++; fpsT += dt; if (fpsT >= 0.5) { fps = fpsFrames / fpsT; fpsFrames = 0; fpsT = 0; }
    if (!paused && run.phase !== "won" && run.phase !== "lost") {
      acc += dt * speed;
      let steps = 0;
      while (acc >= DT && steps < 12) {
        view.beforeStep();
        run.step();
        acc -= DT; steps++;
        const ev = run.drain();
        view.absorb(ev);
        for (const e of ev) {
          if (e.t === "wave") { showBanner(e.boss ? BOSS_NAME : `Wave ${e.n}`, e.boss ? "The boss marches" : `of ${run.waveCount}`, e.boss); sfx(e.boss ? "charge" : "fuse"); }
          if (e.t === "leak") { sfx("crumble", 0.6); }
          // A few battle sounds, rate-limited so a big wave never turns into noise.
          if (now - lastSound > 110) {
            if (e.t === "boom") { sfx("boom", 0.35); lastSound = now; }
            else if (e.t === "zap") { sfx("zap", 0.5); lastSound = now; }
            else if (e.t === "die" && e.enemy) { sfx("down", 0.5); lastSound = now; }
          }
          if (e.t === "cleared") { coins += COINS_PER_WAVE; earn("coins", COINS_PER_WAVE, `bastion ${mapId} wave ${e.n}`); toast(`Wave ${e.n} held  +${e.bonus} gold`); }
        }
        if ((run.phase as string) === "won" || (run.phase as string) === "lost") { finish(); break; }
      }
      if (follow && run.phase === "wave") view.cam.follow = view.front(); else if (!follow) view.cam.follow = null;
    }
    if ((run.phase === "won" || run.phase === "lost") && !finished) finish();
    view.cam.update(dt);
    view.draw(dt, Math.min(1, acc / DT));
    refresh();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    const won = run.phase === "won", st = run.stars();
    const waveCoins = coins;
    if (won) { const c = coinsForWin(st); coins += c; earn("coins", c, `bastion ${mapId} win ${st}`); }
    const chest = won ? winChest(st) : null; // [chests] a win drops the next chest in the cycle
    passEvent({ kind: "play", mode: "bastion" }); // [pass] "play Bastion" quest
    // The same coin line as the other modes' result screens (paid already: per wave during the run, the win here).
    const winCoins = won ? coinsForWin(st) : 0;
    const parts: [string, number][] = ([["Waves held", waveCoins], ["Victory", won ? coinsForWin(0) : 0], [`${st} star${st === 1 ? "" : "s"}`, winCoins - coinsForWin(0)]] as [string, number][])
      .filter(([, n]) => n > 0);
    const reward = { coins, parts };
    saveTd((s) => { s.stars[mapId] = Math.max(s.stars[mapId] ?? 0, st); s.best[mapId] = Math.max(s.best[mapId] ?? 0, won ? run.wave : run.wave - 1); });
    closeSheet();
    setTimeout(() => {
      if (!alive) return;
      const panel = el("div", { class: `td-result ${won ? "won" : "lost"}` }, [
        el("div", { class: "td-result-card" }, [
          el("h2", {}, [won ? "Victory" : "The keep fell"]),
          stars(st, 3, "td-result-stars"),
          el("div", { class: "td-result-lines" }, [
            el("div", {}, [el("span", {}, ["Waves held"]), el("b", {}, [`${won ? run.wave : run.wave - 1}/${run.waveCount}`])]),
            el("div", {}, [el("span", {}, ["Keep"]), el("b", {}, [`${run.keepHp}/${KEEP_HP}`])]),
            el("div", {}, [el("span", {}, ["Foes felled"]), el("b", {}, [String(run.kills)])]),
          ]),
          el("div", { class: "td-result-btns" }, [
            button("Maps", "ghost", () => { stop(); bastionMenu(app, exit); }),
            button(won ? "Play again" : "Try again", "primary", () => { stop(); playBastion(app, mapId, exit, seed); }),
          ]),
        ]),
      ]);
      root.append(panel);
      attachReward(reward, undefined, panel.querySelector<HTMLElement>(".td-result-card")!);
      if (chest) chestEarned(chest, panel.querySelector<HTMLElement>(".td-result-card")); // [chests]
    }, 900);
  }
  function stop() { alive = false; ro.disconnect(); }
  function leave() { stop(); bastionMenu(app, exit); }

  // Hooks for the screenshot and perf tools.
  (window as unknown as { __td: unknown }).__td = {
    run, view, get fps() { return fps; }, openPad, closeSheet, refresh,
    setSpeed: (n: number) => { speed = n; speedBtn.textContent = `${n}x`; },
    setFollow: (on: boolean) => { follow = on; followBtn.classList.toggle("on", on); },
    pause: (on: boolean) => { paused = on; },
  };
  refresh(true);
  showBanner(run.map.name, "Build on the pads, then start the wave");
}
