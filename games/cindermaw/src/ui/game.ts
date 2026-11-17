// Cindermaw's battle screen: the base game's, re-laid-out as a 1993 shooter. The player's health, scrap, squad and
// the round sit in one status bar bolted across the very bottom of the screen, in red LED numerals either side of
// the Warden (a helmeted skull in a porthole whose visor goes green, amber, red as the hold's health falls, glances
// about and flinches when the hold is hit). The rival is a thin boss strip at the top. The base screen builds the
// nodes and keeps updating them; this file only moves them into the new frame (game/theme.css styles it).
import { GameScreen as Base, type GameOpts } from "@base/ui/game";
import { el } from "@base/ui/dom";

export * from "@base/ui/game";

// 15 x 16 pixels. H helmet, h helmet shade, K black, V visor (the health colour), B bone, b bone shade, T teeth.
const WARDEN = [
  "....HHHHHHH....",
  "..HHHHHHHHHHH..",
  ".HHHHhHHHhHHHH.",
  ".HHhHHHHHHHhHH.",
  "HHHHHHHHHHHHHHH",
  "HKKKKKKKKKKKKKH",
  "HKVVVVKKKVVVVKH",
  "HKVVVVKKKVVVVKH",
  "HKKVVKKBKKVVKKH",
  "hHKKKKBBBKKKKHh",
  ".hBBBBBKBBBBBh.",
  ".hBbBBBBBBBbBh.",
  "..BTKTKTKTKTB..",
  "..BTTTTTTTTTB..",
  "...bBBBBBBBb...",
  "....bbbbbbb....",
];
const CRACKS: [number, number, number][] = [[10, 1, 1], [11, 2, 1], [10, 3, 1], [11, 4, 1], [3, 2, 2], [4, 3, 2], [3, 4, 2], [2, 5, 2], [7, 0, 2], [7, 1, 2], [8, 2, 2], [12, 10, 2], [11, 11, 2]];
const FILL: Record<string, string> = { H: "#8a9298", h: "#5d646a", K: "#0a0605", B: "#e0d4b8", b: "#8f7a66", T: "#ffffff" };

/** The Warden: the status bar's emblem. `data-state` (ok, hurt, bad, dead) and the `hit` class drive it. */
export function warden(): HTMLElement {
  let body = "", eyes = "";
  WARDEN.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === ".") return;
    if (c === "V") eyes += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
    else body += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${FILL[c]}"/>`;
  }));
  const cracks = CRACKS.map(([x, y, lv]) => `<rect class="cm-crack c${lv}" x="${x}" y="${y}" width="1.02" height="1.02" fill="#0a0605"/>`).join("");
  const f = el("div", { class: "cm-face", "data-state": "ok", "aria-hidden": "true" });
  f.innerHTML = `<svg viewBox="-1.5 -1 18 18" shape-rendering="crispEdges"><g class="cm-head">${body}<g class="cm-eyes">${eyes}</g>${cracks}</g></svg>`;
  return f;
}

const cell = (cls: string, label: string, kid: Node) => el("div", { class: `cm-cell cm-${cls}` }, [el("div", { class: "cm-led" }, [kid]), el("small", {}, [label])]);

export class GameScreen extends Base {
  private face = warden();
  private lastHp = -1;

  constructor(host: HTMLElement, opts: GameOpts) {
    super(host, opts);
    const q = (s: string) => this.root.querySelector(s) as HTMLElement | null;
    const you = q(".cmdr.you"), bottom = q(".hud-bottom"), round = q(".hud-top .round"), hp = q(".cmdr.you .hpbar"), gold = q(".cmdr.you .gold"), supply = q(".cmdr.you .supply");
    if (!you || !bottom || !round || !hp || !gold || !supply) return;
    this.root.classList.add("cm-game");
    you.classList.add("cm-bar");
    you.replaceChildren(cell("hp", "Health", hp), cell("gold", "Scrap", gold), this.face, cell("squad", "Squad", supply), cell("round", "Round", round));
    bottom.append(you); // the bar is the last thing on the screen
    // the Warden follows the health readout
    const text = q(".cmdr.you .hpbar span");
    if (text) new MutationObserver(() => this.syncFace()).observe(text, { childList: true, characterData: true, subtree: true });
    this.syncFace();
  }

  private syncFace() {
    const side = this.match.sides[0], shown = Number(this.root.querySelector(".cmdr.you .hpbar span")?.textContent ?? side.hp);
    const hp = Number.isFinite(shown) ? shown : side.hp, k = hp / Math.max(1, side.maxHp);
    this.face.dataset.state = hp <= 0 ? "dead" : k < 0.3 ? "bad" : k < 0.65 ? "hurt" : "ok";
    if (this.lastHp >= 0 && hp < this.lastHp) { this.face.classList.remove("hit"); void this.face.offsetWidth; this.face.classList.add("hit"); }
    this.lastHp = hp;
  }
}
