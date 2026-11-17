// "See it in their game": after an Arena battle a player can look at the same battle in the rival's game, next to
// their own, with a slider to wipe between the two. Every game runs the same engine, so the deciding round is handed
// to both games as a link and each fights it again in its own look, started together. Optional (a setting), and only offered when the rival's
// game can be reached: a published game from the backend's gallery, or a peer given at build time or in the address.
//
//   this game                                        the rival's game (in an overlay, or opened directly)
//   offerPeek(next, match) -> a button on the results  boot: readReplay() -> playReplay(payload)
//   opens  <their game url>#replay=<payload>           one battle, watch only, nothing saved
import { arenaById, type ArenaMatch } from "@engine/core/arena";
import type { Piece } from "@engine/core/defs";
import type { Match, MatchConfig } from "@engine/core/match";
import { listGames, online } from "@engine/net/client";

export interface Peer { id: string; name: string; url: string; }
export interface ReplayPayload {
  v: 1;
  /** The arena, by id: the receiving game rebuilds the terrain from its own copy of the engine. */
  arena: string;
  /** The match settings without the terrain. */
  cfg: MatchConfig;
  /** The deciding round and both boards exactly as they went into it. */
  round: number; pieces: Piece[];
  /** Health going into that round, so the keeps look as they did. */
  hp: [number, number];
  names: [string, string];
  /** The game the link came from. */
  from: { id: string; name: string };
}

const KEY = "remuster.peek";
/** The setting: on unless the player turned it off. */
export const peekOn = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
export const setPeek = (on: boolean) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode */ } };

const enc = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const dec = (s: string) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));

/** The link payload for a finished match's last round. */
export function replayOf(next: ArenaMatch, m: Match, from: { id: string; name: string }): ReplayPayload | null {
  const last = m.log[m.log.length - 1];
  if (!last) return null;
  const { terrain: _t, ...cfg } = next.cfg;
  return { v: 1, arena: next.arena.id, cfg: cfg as MatchConfig, round: last.round, pieces: last.pieces, hp: hpBefore(m), names: [next.cfg.names?.[0] ?? "You", next.foe.name], from };
}
/** Each commander's health going into the last round: what is left now plus what that round took. */
function hpBefore(m: Match): [number, number] {
  const d = m.history[m.history.length - 1]?.damage ?? [0, 0];
  return [Math.max(1, Math.round(m.sides[0].hp + d[0])), Math.max(1, Math.round(m.sides[1].hp + d[1]))];
}
export const replayUrl = (peer: Peer, p: ReplayPayload) => `${peer.url.replace(/#.*$/, "")}#replay=${enc(p)}`;

/** A replay handed to this game in its address, or null. Anything malformed is ignored. */
export function readReplay(): ReplayPayload | null {
  const m = typeof location !== "undefined" ? location.hash.match(/replay=([A-Za-z0-9_-]+)/) : null;
  if (!m) return null;
  try {
    const p = dec(m[1]) as ReplayPayload;
    if (p?.v !== 1 || !arenaById(p.arena) || !Array.isArray(p.pieces) || p.pieces.length > 120 || typeof p.round !== "number" || !p.cfg) return null;
    return p;
  } catch { return null; }
}
/** The one-battle match a replay plays: the same seed and round (so the same battle), both boards fixed. */
export function replayConfig(p: ReplayPayload): MatchConfig {
  return { ...p.cfg, terrain: arenaById(p.arena)!.blocks, firstRound: p.round, maxRounds: p.round, fixedGold: [0, 0], noReroll: true, hp: p.hp };
}

// ---------------------------------------------------------------- whose game is it
let peers: Peer[] | null = null;
/** The other games a rival might be playing. Sources, first that answers: `?peer=<url>` (for trying it out),
 *  VITE_REMUSTER_PEERS ("id|Name|url,id|Name|url" at build time), the backend's gallery. Never this game itself. */
export async function loadPeers(self: string): Promise<Peer[]> {
  if (peers) return peers;
  const out: Peer[] = [];
  try {
    const q = new URLSearchParams(location.search).get("peer");
    if (q) out.push({ id: "peer", name: new URLSearchParams(location.search).get("peername") ?? "another game", url: q });
    const env = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_REMUSTER_PEERS;
    for (const row of (env ?? "").split(",")) { const [id, name, url] = row.split("|"); if (id && name && url) out.push({ id, name, url }); }
    if (!out.length && online()) for (const g of await listGames("top", 40)) if (g.url) out.push({ id: g.id, name: g.name, url: g.url });
  } catch { /* offline: no peers, no button */ }
  return (peers = out.filter((p) => p.id !== self));
}
/** The game a rival plays: the same rival always plays the same game. */
export function peerFor(foe: string, list: Peer[]): Peer | null {
  if (!list.length) return null;
  let h = 0;
  for (let i = 0; i < foe.length; i++) h = (h * 31 + foe.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

/** Show the same round in both games at once: this game underneath, the rival's game on top, and a slider between
 *  them that the player drags to wipe from one to the other. One Close button. Both replays wait until both have
 *  loaded and are started together, so the two pictures are the same moment of the same battle. */
export function openPeek(mine: string, theirs: string, labels: [string, string]) {
  const css = (e: HTMLElement, t: string) => { e.style.cssText = t; return e; };
  const wrap = css(document.createElement("div"), "position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column;touch-action:none");
  wrap.className = "peek";
  const bar = css(document.createElement("div"), "display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;color:#fff;font:600 13px system-ui,sans-serif;background:#111");
  const l = css(document.createElement("span"), "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"), r = css(document.createElement("span"), "flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap");
  l.textContent = labels[0]; r.textContent = labels[1];
  const close = css(document.createElement("button"), "font:600 15px system-ui,sans-serif;padding:9px 18px;border:0;border-radius:9px;background:#e5484d;color:#fff");
  close.textContent = "Close"; close.className = "peek-close";
  const stage = css(document.createElement("div"), "position:relative;flex:1;overflow:hidden");
  const frame = (url: string) => { const f = document.createElement("iframe"); f.src = url; f.allow = "autoplay"; css(f, "position:absolute;inset:0;width:100%;height:100%;border:0;background:#000"); return f; };
  const a = frame(mine), b = frame(theirs);
  a.title = labels[0]; b.title = labels[1];
  const handle = css(document.createElement("div"), "position:absolute;top:0;bottom:0;width:44px;margin-left:-22px;cursor:ew-resize;z-index:3;display:flex;align-items:center;justify-content:center");
  handle.className = "peek-slider";
  handle.innerHTML = '<div style="position:absolute;top:0;bottom:0;left:20px;width:4px;background:#fff;box-shadow:0 0 8px rgba(0,0,0,.7)"></div><div style="position:relative;width:44px;height:44px;border-radius:22px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font:700 18px system-ui;color:#111">\u2194</div>';
  let at = 0.5;
  const place = () => { b.style.clipPath = `inset(0 0 0 ${at * 100}%)`; handle.style.left = `${at * 100}%`; };
  place();
  const drag = (e: PointerEvent) => { const q = stage.getBoundingClientRect(); at = Math.max(0.04, Math.min(0.96, (e.clientX - q.left) / q.width)); place(); };
  // while dragging, the frames must not swallow the pointer
  const grab = (e: PointerEvent) => { a.style.pointerEvents = b.style.pointerEvents = "none"; handle.setPointerCapture(e.pointerId); drag(e); };
  const drop = () => { a.style.pointerEvents = b.style.pointerEvents = ""; };
  handle.addEventListener("pointerdown", grab); handle.addEventListener("pointermove", (e) => { if (handle.hasPointerCapture(e.pointerId)) drag(e); });
  handle.addEventListener("pointerup", drop); handle.addEventListener("pointercancel", drop);
  // start both together: each replay says when it is ready and waits to be told to go (or four seconds, whichever first)
  let ready = 0, gone = false;
  const go = () => { if (gone) return; gone = true; for (const f of [a, b]) f.contentWindow?.postMessage("remuster:go", "*"); };
  const timer = setTimeout(go, 4000);
  const shut = () => { clearTimeout(timer); wrap.remove(); removeEventListener("message", onMsg); };
  const onMsg = (e: MessageEvent) => { if (e.data === "remuster:peek-close") shut(); else if (e.data === "remuster:ready" && ++ready >= 2) go(); };
  addEventListener("message", onMsg);
  close.onclick = shut;
  stage.append(a, b, handle); bar.append(l, close, r); wrap.append(bar, stage);
  document.body.append(wrap);
}
/** In a compare frame: tell the page that opened us we are ready, and wait for its word (so both sides start
 *  together). Outside a frame it resolves at once. */
export function waitForGo(): Promise<void> {
  if (typeof parent === "undefined" || parent === window) return Promise.resolve();
  return new Promise((res) => {
    const done = () => { removeEventListener("message", on); res(); };
    const on = (e: MessageEvent) => { if (e.data === "remuster:go") done(); };
    addEventListener("message", on);
    setTimeout(done, 6000);
    try { parent.postMessage("remuster:ready", "*"); } catch { done(); }
  });
}
