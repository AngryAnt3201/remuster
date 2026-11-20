// Remuster's site. The page is its own demo: pick or type a world and the whole page (colours, type, background,
// every video) cuts to that game, the way the launch film does. All battle loops are the same 16 seconds of the same
// fight, so every video on the page is kept on one clock.
(() => {
  const GAMES = [
    { id: "base", name: "Crownfall", tag: "The base game: a storybook kingdom", prompt: "make it a storybook fantasy", dot: "#ffcf4d", keys: ["fantasy", "storybook", "kingdom", "castle", "knight", "original", "base", "crown", "medieval"] },
    { id: "blackridge", name: "Blackridge", tag: "A modern war from the drone feed", prompt: "make it a gritty modern war game", dot: "#ff8a2a", keys: ["war", "modern", "military", "army", "drone", "gritty", "tank", "soldier", "tactical"] },
    { id: "pixelkeep", name: "Pixelkeep", tag: "A lost 8-bit cartridge", prompt: "make it 8-bit", dot: "#7ce04a", keys: ["8-bit", "8bit", "8 bit", "pixel", "retro", "nes", "cartridge", "arcade", "chiptune", "16-bit", "gameboy"] },
    { id: "cindermaw", name: "Cindermaw", tag: "A 1993 demon shooter of an auto-battler", prompt: "make it a 90s demon shooter", dot: "#e03a10", keys: ["demon", "doom", "90s", "hell", "shooter", "lava", "metal", "marine", "horror", "blood"] },
    { id: "neonhold", name: "Neonhold", tag: "Rival crews in a rain-slick megacity", prompt: "make it cyberpunk", dot: "#ff3fd0", keys: ["cyber", "neon", "synth", "future", "sci-fi", "scifi", "robot", "city", "punk", "space", "vapor"] },
    { id: "inkfall", name: "Inkfall", tag: "Brush-and-ink clans on rice paper", prompt: "make it an ink painting", dot: "#d94a3a", keys: ["ink", "paint", "japan", "brush", "samurai", "paper", "sumi", "watercolor", "watercolour", "zen", "ninja"] },
  ];
  const LOOP = 16;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const game = (id) => GAMES.find((g) => g.id === id);
  let current = "base";

  // ---- one clock for every battle video -------------------------------------------------------------------------
  const t0 = performance.now();
  const clock = () => ((performance.now() - t0) / 1000) % LOOP;
  const synced = new Set();
  function video(src, poster) {
    const v = el("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    if (poster) v.poster = poster;
    v.dataset.src = src;
    return v;
  }
  function start(v, sync = true) {
    if (!v.src) v.src = v.dataset.src;
    if (sync) { synced.add(v); try { v.currentTime = clock(); } catch { /* not ready: the tick below catches it up */ } }
    v.play().catch(() => {});
  }
  function stop(v) { synced.delete(v); v.pause(); }
  setInterval(() => {
    const t = clock();
    for (const v of synced) {
      if (v.readyState < 2 || v.seeking) continue;
      const d = Math.abs(v.currentTime - t);
      if (d > 0.3 && d < LOOP - 0.3) v.currentTime = t;
      if (v.paused) v.play().catch(() => {});
    }
  }, 700);

  // ---- hero phone -------------------------------------------------------------------------------------------------
  const heroVideos = {};
  const screen = $("#heroscreen");
  for (const g of GAMES) {
    const v = video(`v/clash-${g.id}.mp4`, `v/clash-${g.id}.jpg`);
    heroVideos[g.id] = v; screen.append(v);
  }
  function heroShow(id) {
    const v = heroVideos[id];
    start(v);
    const on = () => { for (const [k, o] of Object.entries(heroVideos)) { o.classList.toggle("on", k === id); if (k !== id) stop(o); } };
    if (v.readyState >= 2) on(); else { v.addEventListener("loadeddata", on, { once: true }); v.classList.add("on"); }
  }

  // ---- switching game -------------------------------------------------------------------------------------------
  const title = $(".title"), wipe = $(".wipe"), phone = $("#phone");
  [...title.children].forEach((s, i) => s.style.setProperty("--i", i));
  function chipRow(host, onPick, selected) {
    for (const g of GAMES) {
      const b = el("button", "chip", g.name);
      b.type = "button"; b.style.setProperty("--dot", g.dot); b.dataset.id = g.id; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(g.id === selected));
      b.addEventListener("click", () => onPick(g.id));
      host.append(b);
    }
    return (id) => host.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-selected", String(c.dataset.id === id)));
  }
  const markChips = chipRow($("#chips"), (id) => { hands(); typeThen(game(id).prompt, () => remix(id)); }, "base");

  function remix(id, quiet) {
    if (id === current) return;
    const g = game(id);
    current = id;
    const apply = () => {
      document.body.dataset.game = id;
      document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).getPropertyValue("--bg").trim();
      $("#gname").textContent = g.name; $("#gtag").textContent = g.tag;
      $("#playlink").textContent = `Play ${g.name}`; $("#playlink").href = `play/${id}/`;
      $("#slabgame").style.backgroundImage = `linear-gradient(transparent 40%, rgba(0,0,0,.75)), url(v/clash-${id}.jpg)`;
      markChips(id); heroShow(id); fx.set(id);
    };
    if (quiet || still) return apply();
    wipe.classList.remove("go"); title.classList.remove("flip"); phone.classList.remove("spin");
    void wipe.offsetWidth;
    // The bars come in in the new game's colour; the skin changes underneath at the moment they cover the page.
    wipe.style.setProperty("--a", g.dot); wipe.style.setProperty("--b", "#fff"); wipe.style.setProperty("--c", "#0a0a10");
    wipe.classList.add("go"); title.classList.add("flip"); phone.classList.add("spin");
    setTimeout(apply, 290);
  }

  // ---- the prompt: type a world ---------------------------------------------------------------------------------
  const ask = $("#ask"), said = $("#said");
  let typing = 0, auto = true, autoTimer = 0;
  function hands() { auto = false; clearTimeout(autoTimer); }
  function typeThen(text, done) {
    const run = ++typing; let i = 0;
    ask.value = "";
    (function step() {
      if (run !== typing) return;
      ask.value = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, 28 + Math.random() * 40); else setTimeout(() => run === typing && done(), 260);
    })();
  }
  function pick(text) {
    const t = text.toLowerCase();
    let best = null, score = 0;
    for (const g of GAMES) { const s = g.keys.filter((k) => t.includes(k)).length + (t.includes(g.name.toLowerCase()) ? 3 : 0); if (s > score) { best = g; score = s; } }
    return best;
  }
  $("#prompt").addEventListener("submit", (e) => {
    e.preventDefault(); hands(); typing++;
    const text = ask.value.trim();
    if (!text) return;
    const g = pick(text);
    if (g) { said.innerHTML = `<b>${g.name}</b> · ${g.tag}. Same battle, same rules.`; remix(g.id); return; }
    const others = GAMES.filter((o) => o.id !== current);
    const next = others[Math.floor(Math.random() * others.length)];
    const what = text.replace(/[<>&]/g, "").replace(/^(make|turn)\s+(it|this)\s+(into\s+)?/i, "").replace(/^(an?|the)\s+/i, "").replace(/\s+game$/i, "") || text;
    said.innerHTML = `Nobody has made the <b>${what}</b> one yet. Clone the repo and run this line for real. Meanwhile: <b>${next.name}</b>.`;
    remix(next.id);
  });
  ask.addEventListener("focus", () => { hands(); typing++; });
  function autoplay() {
    if (!auto || still) return;
    const next = GAMES[(GAMES.findIndex((g) => g.id === current) + 1) % GAMES.length];
    typeThen(next.prompt, () => { if (!auto) return; said.innerHTML = `<b>${next.name}</b> · ${next.tag}.`; remix(next.id); autoTimer = setTimeout(autoplay, 4200); });
  }
  autoTimer = setTimeout(autoplay, 3200);

  // ---- pointer tilt on the hero phone -----------------------------------------------------------------------------
  const stage = $("#stage");
  addEventListener("pointermove", (e) => {
    if (still) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
    phone.style.setProperty("--ry", `${-16 + x * 40}deg`); phone.style.setProperty("--rx", `${6 - y * 26}deg`);
  }, { passive: true });

  // ---- the ring ---------------------------------------------------------------------------------------------------
  const ring = $("#ring"), ringwrap = $("#ringwrap");
  const ringVideos = [];
  GAMES.forEach((g, i) => {
    const p = el("div", "phone"); p.style.setProperty("--at", `${i * 60}deg`); p.style.setProperty("--dot", g.dot);
    const s = el("div", "screen"); const v = video(`v/clash-${g.id}.mp4`, `v/clash-${g.id}.jpg`); v.classList.add("on");
    s.append(v); p.append(s, el("div", "glare")); ringVideos.push(v);
    const back = el("div", "back", g.name); back.style.setProperty("--at", `${i * 60}deg`); back.style.setProperty("--dot", g.dot);
    ring.append(p, back);
  });
  let spin = 0, vel = -0.14, drag = null, front = -1, ringOn = false;
  function ringFrame() {
    if (!drag) { spin += vel; vel += ((still ? 0 : -0.14) - vel) * 0.02; }
    ring.style.setProperty("--spin", `${spin}deg`);
    const f = ((Math.round(-spin / 60) % 6) + 6) % 6;
    if (f !== front) {
      front = f; const g = GAMES[f];
      $("#rname").textContent = g.name; $("#rprompt").textContent = g.id === "base" ? "the base game" : `/remix ${g.id} ${g.prompt.replace(/^make it /, "")}`;
      $("#rplay").href = `play/${g.id}/`; $("#rplay").textContent = `Play ${g.name}`;
    }
    if (ringOn) requestAnimationFrame(ringFrame);
  }
  ringwrap.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, spin, last: e.clientX, v: 0 }; ringwrap.setPointerCapture(e.pointerId); });
  ringwrap.addEventListener("pointermove", (e) => { if (!drag) return; spin = drag.spin + (e.clientX - drag.x) * 0.3; drag.v = (e.clientX - drag.last) * 0.3; drag.last = e.clientX; });
  const drop = () => { if (drag) { vel = drag.v; drag = null; } };
  ringwrap.addEventListener("pointerup", drop); ringwrap.addEventListener("pointercancel", drop);

  // ---- compare ----------------------------------------------------------------------------------------------------
  const cmp = $("#cmp"), cl = cmp.querySelector(".l"), cr = cmp.querySelector(".r");
  let side = { l: "base", r: "cindermaw" }, cmpOn = false, cmpTouched = false;
  function setSide(which, id) {
    side[which] = id;
    const v = which === "l" ? cl : cr;
    v.dataset.src = `v/clash-${id}.mp4`; v.poster = `v/clash-${id}.jpg`; v.removeAttribute("src"); v.load();
    $(which === "l" ? "#tagl" : "#tagr").textContent = game(id).name;
    (which === "l" ? markL : markR)(id);
    if (cmpOn) start(v);
  }
  const markL = chipRow($("#pickl"), (id) => setSide("l", id), "base");
  const markR = chipRow($("#pickr"), (id) => setSide("r", id), "cindermaw");
  cl.dataset.src = "v/clash-base.mp4"; cl.poster = "v/clash-base.jpg"; cr.dataset.src = "v/clash-cindermaw.mp4"; cr.poster = "v/clash-cindermaw.jpg";
  const cut = (e) => { const r = cmp.getBoundingClientRect(); const p = Math.max(4, Math.min(96, ((e.clientX - r.left) / r.width) * 100)); cmp.style.setProperty("--cut", `${p}%`); cmp.style.setProperty("--cy", `${(p - 50) * 0.24}deg`); };
  cmp.addEventListener("pointerdown", (e) => { cmpTouched = true; cmp.setPointerCapture(e.pointerId); cut(e); });
  cmp.addEventListener("pointermove", (e) => { if (e.buttons || e.pointerType === "mouse") { cmpTouched = true; cut(e); } });
  (function sway() {
    if (!cmpTouched && cmpOn && !still) { const p = 50 + Math.sin(performance.now() / 900) * 30; cmp.style.setProperty("--cut", `${p}%`); cmp.style.setProperty("--cy", `${(p - 50) * 0.24}deg`); }
    requestAnimationFrame(sway);
  })();

  // ---- places ---------------------------------------------------------------------------------------------------
  const PLACES = [["market", "A market square", "Neonhold"], ["crossing", "A river, two bridges", "Inkfall"], ["arena", "A village street", "Pixelkeep"], ["siege", "Walls and artillery", "Cindermaw"]];
  const cards = $("#cards");
  for (const [id, name, g] of PLACES) {
    const c = el("div", "card reveal"); const v = video(`v/place-${id}.mp4`, `v/place-${id}.jpg`);
    c.append(v, el("b", "", `${name}<small>in ${g}</small>`)); cards.append(c);
    c.addEventListener("pointermove", (e) => { const r = c.getBoundingClientRect(); c.style.setProperty("--ty", `${((e.clientX - r.left) / r.width - 0.5) * 26}deg`); c.style.setProperty("--tx", `${(0.5 - (e.clientY - r.top) / r.height) * 18}deg`); });
    c.addEventListener("pointerleave", () => { c.style.setProperty("--ty", "0deg"); c.style.setProperty("--tx", "0deg"); });
    new IntersectionObserver(([en]) => (en.isIntersecting ? start(v, false) : v.pause()), { rootMargin: "100px" }).observe(c);
  }

  // ---- film -----------------------------------------------------------------------------------------------------
  $("#filmbtn").addEventListener("click", function () {
    if (this.classList.contains("playing")) return;
    hands();
    const v = el("video"); v.src = "v/launch.mp4"; v.controls = true; v.playsInline = true; v.poster = "v/launch.jpg";
    this.classList.add("playing"); this.replaceChildren(v); v.play().catch(() => {});
  });

  // ---- things that wake when scrolled to ------------------------------------------------------------------------
  const watch = (node, on, off, margin = "200px") => new IntersectionObserver(([en]) => (en.isIntersecting ? on() : off && off()), { rootMargin: margin }).observe(node);
  watch(ringwrap, () => { ringVideos.forEach((v) => start(v)); if (!ringOn) { ringOn = true; ringFrame(); } }, () => { ringVideos.forEach(stop); ringOn = false; });
  watch(cmp, () => { cmpOn = true; start(cl); start(cr); }, () => { cmpOn = false; stop(cl); stop(cr); });
  watch($("#stage"), () => heroShow(current), () => stop(heroVideos[current]), "0px");
  document.querySelectorAll(".band h2, .band .sub, .howtext, .stack, .term, .filmwrap, .cmp, .ringwrap").forEach((n) => n.classList.add("reveal"));
  const rev = new IntersectionObserver((ens) => ens.forEach((en) => en.isIntersecting && en.target.classList.add("in")), { rootMargin: "-8% 0px" });
  document.querySelectorAll(".reveal").forEach((n) => rev.observe(n));
  const stack = $("#stack");
  addEventListener("scroll", () => {
    const r = stack.getBoundingClientRect();
    const open = Math.max(0, Math.min(1, 1 - (r.top + r.height * 0.2) / innerHeight));
    stack.style.setProperty("--open", (Math.sin(open * Math.PI) * 1.15).toFixed(3));
  }, { passive: true });

  // ---- background, one per game ---------------------------------------------------------------------------------
  const fx = (() => {
    const c = $("#fx"), x = c.getContext("2d");
    let W = 0, H = 0, mode = "base", parts = [], last = 0;
    const R = (a, b) => a + Math.random() * (b - a);
    function size() { const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0); }
    addEventListener("resize", size); size();
    const N = () => Math.round(Math.min(90, (W * H) / 16000));
    const seed = {
      base: () => ({ x: R(0, W), y: R(0, H), r: R(1.5, 5), vy: -R(8, 26), vx: R(-6, 6), p: R(0, 6), col: ["#ffcf4d", "#38cfc0", "#ffffff"][Math.floor(R(0, 3))] }),
      blackridge: () => ({ x: R(0, W), y: R(0, H), life: R(0, 1) }),
      pixelkeep: () => ({ x: Math.floor(R(0, W) / 6) * 6, y: R(0, H), s: [6, 6, 12][Math.floor(R(0, 3))], vy: R(10, 50), p: R(0, 6), col: ["#40a0ff", "#ffffff", "#ffbf00", "#e02020"][Math.floor(R(0, 4))] }),
      cindermaw: () => ({ x: R(0, W), y: R(0, H), r: R(1, 3.5), vy: -R(30, 110), vx: R(-20, 20), p: R(0, 6) }),
      neonhold: () => ({ x: R(0, W), y: R(0, H), l: R(10, 34), vy: R(500, 900) }),
      inkfall: () => ({ x: R(0, W), y: R(0, H), r: 0, max: R(20, 110), life: R(0, 1), sp: R(0.05, 0.14) }),
    };
    function set(m) { mode = m; parts = Array.from({ length: m === "inkfall" ? 12 : m === "blackridge" ? 14 : N() }, seed[m]); }
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; const t = now / 1000;
      x.clearRect(0, 0, W, H);
      if (mode === "base") {
        for (const p of parts) { p.y += p.vy * dt; p.x += (p.vx + Math.sin(t + p.p) * 10) * dt; if (p.y < -10) { p.y = H + 10; p.x = R(0, W); }
          x.globalAlpha = 0.35 + 0.3 * Math.sin(t * 2 + p.p); x.fillStyle = p.col; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill(); }
      } else if (mode === "blackridge") {
        x.globalAlpha = 0.1; x.strokeStyle = "#2ec4e6"; x.lineWidth = 1; x.beginPath();
        for (let gx = (W / 2) % 80; gx < W; gx += 80) { x.moveTo(gx, 0); x.lineTo(gx, H); } for (let gy = 0; gy < H; gy += 80) { x.moveTo(0, gy); x.lineTo(W, gy); } x.stroke();
        const cx = W * 0.72, cy = H * 0.42, rad = Math.max(W, H) * 0.6, a = t * 0.9;
        const g = x.createConicGradient(a, cx, cy); g.addColorStop(0, "rgba(46,196,230,0)"); g.addColorStop(0.86, "rgba(46,196,230,0)"); g.addColorStop(1, "rgba(46,196,230,0.22)");
        x.globalAlpha = 1; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
        x.strokeStyle = "rgba(46,196,230,0.16)"; for (let r = 120; r < rad; r += 150) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); }
        for (const p of parts) { p.life -= dt * 0.35; if (p.life <= 0) Object.assign(p, seed.blackridge(), { life: 1 });
          x.globalAlpha = p.life * 0.9; x.fillStyle = "#f26a1b"; x.fillRect(p.x - 3, p.y - 3, 6, 6); x.strokeStyle = "#f26a1b"; x.strokeRect(p.x - 9, p.y - 9, 18, 18); }
      } else if (mode === "pixelkeep") {
        for (const p of parts) { p.y += p.vy * dt; if (p.y > H) { p.y = -12; p.x = Math.floor(R(0, W) / 6) * 6; }
          x.globalAlpha = Math.sin(t * 3 + p.p) > 0 ? 0.8 : 0.25; x.fillStyle = p.col; x.fillRect(p.x, Math.floor(p.y / 6) * 6, p.s, p.s); }
      } else if (mode === "cindermaw") {
        const g = x.createLinearGradient(0, H * 0.55, 0, H); g.addColorStop(0, "rgba(224,36,12,0)"); g.addColorStop(1, `rgba(224,60,12,${0.28 + 0.08 * Math.sin(t * 2)})`);
        x.globalAlpha = 1; x.fillStyle = g; x.fillRect(0, 0, W, H);
        for (const p of parts) { p.y += p.vy * dt; p.x += (p.vx + Math.sin(t * 3 + p.p) * 30) * dt; if (p.y < -10) { p.y = H + 10; p.x = R(0, W); }
          x.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(t * 5 + p.p)); x.fillStyle = p.r > 2.4 ? "#ffb000" : "#ff4a1a"; x.fillRect(p.x, p.y, p.r * 2, p.r * 2); }
      } else if (mode === "neonhold") {
        const hz = H * 0.62; x.globalAlpha = 0.5; x.lineWidth = 1.5; x.strokeStyle = "#ff3fd0"; x.beginPath();
        for (let i = -14; i <= 14; i++) { x.moveTo(W / 2 + i * 26, hz); x.lineTo(W / 2 + i * 260, H); }
        for (let k = 0; k < 12; k++) { const z = ((k + (t * 0.6) % 1) / 12) ** 2.4; const y = hz + z * (H - hz); x.moveTo(0, y); x.lineTo(W, y); }
        x.stroke();
        const sun = x.createRadialGradient(W / 2, hz, 0, W / 2, hz, 260); sun.addColorStop(0, "rgba(255,197,61,0.3)"); sun.addColorStop(1, "rgba(255,63,208,0)");
        x.globalAlpha = 1; x.fillStyle = sun; x.fillRect(0, 0, W, H);
        x.strokeStyle = "#1fe5ff"; x.lineWidth = 1; x.globalAlpha = 0.3; x.beginPath();
        for (const p of parts) { p.y += p.vy * dt; if (p.y > H) { p.y = -40; p.x = R(0, W); } x.moveTo(p.x, p.y); x.lineTo(p.x - p.l * 0.2, p.y + p.l); }
        x.stroke();
      } else if (mode === "inkfall") {
        for (const p of parts) { p.life += dt * p.sp; if (p.life >= 1) Object.assign(p, seed.inkfall(), { life: 0 });
          const r = p.max * Math.sqrt(p.life); const g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, r || 1); const a = (1 - p.life) * 0.2;
          g.addColorStop(0, `rgba(27,26,23,${a})`); g.addColorStop(0.7, `rgba(27,26,23,${a * 0.6})`); g.addColorStop(1, "rgba(27,26,23,0)");
          x.globalAlpha = 1; x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, r, 0, 7); x.fill(); }
      }
      x.globalAlpha = 1;
      if (!still) requestAnimationFrame(frame);
    }
    set("base"); requestAnimationFrame(frame);
    return { set };
  })();

  $("#slabgame").style.backgroundImage = "linear-gradient(transparent 40%, rgba(0,0,0,.75)), url(v/clash-base.jpg)";
  heroShow("base");
})();
