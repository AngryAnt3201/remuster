// "Their side of it": after an Arena battle a player can look at the same battle in the rival's game. Every game
// runs the same engine, so the deciding round is handed to the rival's game as a link, and that game fights it again
// in its own look, seen from the rival's end of the field. Optional (a setting), and only offered when the rival's
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

/** Show the rival's game over this one: a full-screen frame with one Close button. */
export function openPeek(url: string, caption: string) {
  const wrap = document.createElement("div");
  wrap.className = "peek";
  wrap.style.cssText = "position:fixed;inset:0;z-index:9999;background:#000;display:flex;flex-direction:column";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;align-items:center;gap:12px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;color:#fff;font:600 14px system-ui,sans-serif;background:#111";
  const label = document.createElement("span");
  label.textContent = caption; label.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
  const close = document.createElement("button");
  close.textContent = "Close"; close.className = "peek-close";
  close.style.cssText = "font:600 15px system-ui,sans-serif;padding:9px 18px;border:0;border-radius:9px;background:#e5484d;color:#fff";
  const shut = () => { wrap.remove(); removeEventListener("message", onMsg); };
  const onMsg = (e: MessageEvent) => { if (e.data === "remuster:peek-close") shut(); };
  addEventListener("message", onMsg);
  close.onclick = shut;
  const frame = document.createElement("iframe");
  frame.src = url; frame.title = caption; frame.allow = "autoplay";
  frame.style.cssText = "flex:1;border:0;width:100%;background:#000";
  bar.append(label, close); wrap.append(bar, frame);
  document.body.append(wrap);
}
