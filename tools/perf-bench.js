// The 24-unit battle benchmark, shared by tools/perf.mjs (headless Chromium) and tools/perf-sim.html (iOS Simulator Safari).
// g is a live Game (window.__game), imp imports a module path in the game's own realm, secs caps the live run.
// Returns median/p95/max ms for the live rAF loop (render time and frame gap) and a synchronous replay
// (sim + effects + draw per 60 Hz frame) whose syncFps is the CPU-side ceiling. slowFrames is the share of
// live frame gaps over 1000/55 ms.
export async function bench(g, imp, secs) {
  await Promise.all(g.plans);
  const m = g.match;
  // 12 a side, 24 different kinds once each, ranks 1 to 4, spread over each deploy zone. There are 28 kinds since
  // the 1.1 roster, so take the last 24: every newer unit (and its VFX) is in, the four plain starters are out.
  const { UNITS } = await imp("/engine/core/defs.ts");
  const kinds = Object.keys(UNITS).slice(-24);
  let id = 1000;
  for (const s of [0, 1]) {
    m.sides[s].pieces = Array.from({ length: 12 }, (_, i) => {
      const x = 1 + (i % 6) * 1.4, row = Math.floor(i / 6);
      const y = s === 0 ? 12.6 - row * 2 : 1.4 + row * 2;
      return { id: id++, kind: kinds[(i + s * 12) % kinds.length], side: s, x, y, rank: 1 + ((i + s) % 4), spent: 3 };
    });
  }
  // Real games preload their rosters' sprites per side; these armies come from outside the level's roster, so tint
  // every kind and spawn at every tier for both sides up front (preload needs the side: without it nothing is warmed
  // and the sheets tint mid-fight, which the old bench counted as 300+ ms hitches).
  const sprites = await imp("/base/src/render/sprites.ts");
  await sprites.loadSprites();
  for (const s of [0, 1]) sprites.preload([...Object.keys(UNITS), "mite", "golemling", "thrall", "turret", "decoy", "queen"], s);
  // Tinting runs on the main thread as each atlas decodes: wait until 2 s pass with no 50 ms timer lag (30 s cap).
  for (let quiet = 0, t0 = performance.now(); quiet < 20 && performance.now() - t0 < 30000;) {
    const t = performance.now();
    await new Promise((r) => setTimeout(r, 100));
    quiet = performance.now() - t > 150 ? 0 : quiet + 1;
  }
  const view = g.view, orig = view.render.bind(view);
  const draw = [], gap = [], at = [];
  let last = 0;
  view.render = (sc) => { const t = performance.now(); orig(sc); draw.push(performance.now() - t); if (last) { gap.push(t - last); at.push(t); } last = t; };
  const tFight = performance.now();
  await g.fight();
  // The sim's own step cost (one tick each), kept apart from the draw.
  const step = [], bodies = [], bt = g.battle, ostep = bt.step.bind(bt);
  bt.step = () => { const t = performance.now(); ostep(); step.push(performance.now() - t); };
  const t0 = performance.now();
  while (performance.now() - t0 < secs * 1000 && !bt.done) {
    await new Promise((r) => setTimeout(r, 250));
    bodies.push(bt.bodies.filter((u) => u.hp > 0).length);
  }
  // Then the same battle driven back to back off the rAF clock: 2 sim ticks + effects + draw per 60 Hz frame,
  // so the CPU cost per frame shows even when the machine is too busy for a steady rAF cadence.
  cancelAnimationFrame(g.raf); g.destroyed = true; view.render = orig;
  const sync = [], part = { sim: [], update: [], scene: [], render: [] };
  const lap = (k, fn) => { const t = performance.now(); const r = fn(); part[k].push(performance.now() - t); return r; };
  for (let f = 0; f < 240 && !bt.done; f++) {
    const t = performance.now();
    if (f % 2 === 0) lap("sim", () => { ostep(); view.consume(bt); });
    lap("update", () => view.update(1 / 60));
    const sc = lap("scene", () => g.scene());
    lap("render", () => view.render(sc));
    sync.push(performance.now() - t);
  }
  view.canvas.getContext("2d").getImageData(0, 0, 1, 1);
  // WebKit rounds performance.now() to 1 ms, so fps figures are frames over elapsed time, not 1000 / median.
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const st = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return { n: b.length, med: +b[b.length >> 1].toFixed(2), p95: +b[Math.floor(b.length * 0.95)].toFixed(2), max: +b[b.length - 1].toFixed(2) }; };
  return { kinds: [0, 1].map((s) => m.sides[s].pieces.map((p) => `${p.kind}${p.rank}`).join(" ")), liveBodies: { first: bodies[0], max: Math.max(...bodies), last: bodies[bodies.length - 1] },
    syncFrameMs: st(sync), parts: Object.fromEntries(Object.entries(part).map(([k, v]) => [k, st(v)])), syncFps: sync.length ? +(1000 * sync.length / sum(sync)).toFixed(1) : null, renderMs: st(draw), simStepMs: st(step), frameGapMs: st(gap), fps: gap.length ? +(1000 * gap.length / sum(gap)).toFixed(1) : null, slowFrames: gap.length ? +(gap.filter((x) => x > 1000 / 55).length / gap.length).toFixed(3) : null, hitches: gap.filter((x) => x > 100).length, hitchesAtMs: gap.flatMap((x, i) => (x > 100 ? [Math.round(at[i] - tFight)] : [])), canvas: [view.canvas.width, view.canvas.height] };
}
