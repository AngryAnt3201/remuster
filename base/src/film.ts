// Film mode: scripted battles for trailers and store videos (`?film=<scene>`). A scene is a fixed seed and two fixed
// armies, so it plays out identically every time and, because the sim is the engine's, identically in every game:
// the recorder (tools/film.mjs) captures the same scene in several games and the edit cuts between them mid-fight.
// Scenes are data; add one here and it works in every game.
import type { MatchConfig, StartPiece } from "@engine/core/match";
import type { UnitKind } from "@engine/core/defs";
import { arenaById, type ArenaMark } from "@engine/core/arena";
import type { Block } from "@engine/core/terrain";

export interface Scene {
  /** Campaign act whose arena to fight in (1-10). */
  arena: number;
  seed: number;
  /** Player side (bottom) and rival side (top): kind, across (0.5-8.5), depth from the back edge (0-5.9), rank 1-4. */
  armies: [Army, Army];
  names?: [string, string];
  title?: string;
  /** Arena-mode terrain id (engine/core/arena.ts), when the scene is an Arena battle. */
  terrain?: string;
  /** Battle speed (1 = real time). */
  speed?: number;
  /** End on the Arena results sheet with the "see it in the rival's game" button (the trailer's peek shot). */
  sheet?: boolean;
  /** Terrain given directly (the kit sheet), instead of an arena id. */
  blocks?: Block[];
  marks?: ArenaMark[];
}
type Army = [kind: UnitKind, lx: number, depth: number, rank?: number][];

const pieces = (a: Army): StartPiece[] => a.map(([kind, lx, depth, rank]) => ({ kind, lx, depth, rank: rank ?? 1 }));

export const SCENES: Record<string, Scene> = {
  // The hero shot: two full, varied armies meeting in the middle. Melee lines, a cavalry charge down the right,
  // lightning and bombs over the top, fliers diving on the back lines.
  clash: {
    arena: 1, seed: 2, names: ["You", "Rival"], title: "Clash",
    armies: [
      [["bulwark", 3.4, 5.4, 3], ["bulwark", 5.6, 5.4, 3], ["blades", 2.0, 5.3, 2], ["blades", 7.0, 5.3, 2], ["pikeman", 4.5, 5.0, 3],
        ["lancer", 8.1, 4.4, 3], ["golem", 4.5, 4.0, 3], ["ranger", 2.6, 2.9, 3], ["ranger", 6.4, 2.9, 3], ["storm", 4.5, 2.6, 3],
        ["grenadier", 3.4, 1.7, 2], ["medic", 5.6, 1.9, 2], ["medic", 2.2, 1.6, 2], ["harrier", 0.9, 3.2, 2], ["ballista", 7.9, 1.2, 2],
        ["banner", 4.5, 3.3, 2], ["lion", 6.6, 4.2, 4]],
      [["hook", 4.5, 5.3, 3], ["bulwark", 2.8, 5.4, 2], ["ravager", 6.2, 5.3, 2], ["duelist", 7.4, 5.2, 2], ["golem", 4.5, 4.1, 2],
        ["keg", 1.4, 4.6], ["keg", 8.0, 4.4], ["outrider", 0.9, 3.4, 2], ["rime", 3.0, 2.8, 2], ["tide", 6.0, 2.8, 3],
        ["bombard", 4.5, 1.0, 2], ["hive", 7.8, 1.6, 2], ["grave", 2.0, 1.8, 2], ["banner", 4.5, 3.4, 2], ["shade", 8.0, 3.4, 2],
        ["medic", 5.4, 1.8, 2], ["griffin", 1.2, 2.2, 4]],
    ],
  },
  // A smaller, readable fight for close-ups: three against three.
  duel: {
    arena: 3, seed: 7, names: ["You", "Rival"], title: "Duel",
    armies: [
      [["bulwark", 4.5, 5.0, 2], ["ranger", 3.2, 2.6, 2], ["storm", 5.8, 2.6, 2]],
      [["lancer", 4.5, 4.6, 2], ["grenadier", 3.0, 2.2, 2], ["shade", 6.6, 3.6, 2]],
    ],
  },
  // Siege: structures, artillery and a wall of shields.
  siege: {
    arena: 5, seed: 99, names: ["You", "Rival"], title: "Siege",
    armies: [
      [["ballista", 2.2, 1.4, 3], ["ballista", 6.8, 1.4, 3], ["bombard", 4.5, 0.9, 3], ["bulwark", 3.2, 5.2, 3], ["bulwark", 5.8, 5.2, 3],
        ["tinker", 4.5, 2.4, 2], ["lamp", 4.5, 4.0, 2], ["thorn", 2.4, 3.2, 2], ["medic", 6.6, 3.0, 2]],
      [["golem", 3.0, 5.2, 3], ["golem", 6.0, 5.2, 3], ["sapper", 1.4, 3.6, 2], ["sapper", 7.6, 3.6, 2], ["trickster", 4.5, 4.4, 2],
        ["lancer", 0.9, 5.0, 2], ["lancer", 8.1, 5.0, 2], ["harrier", 3.4, 2.4, 3], ["harrier", 5.6, 2.4, 3], ["grave", 4.5, 1.6, 2]],
    ],
  },
  // Arena mode: the same kind of fight, but around houses, a hall and barricades. Shots stop on walls, the charge
  // has to go round, bombs come over the roofs and the barricades get smashed.
  arena: {
    arena: 10, seed: 25, names: ["You", "Rival"], title: "Old Village", terrain: "old-village",
    armies: [
      [["bulwark", 4.5, 5.3, 2], ["blades", 2.6, 5.2, 2], ["golem", 6.3, 5.0, 3], ["lancer", 0.9, 4.6, 2], ["ranger", 3.4, 3.0, 2],
        ["ranger", 5.6, 3.0, 2], ["grenadier", 2.2, 2.2, 3], ["bombard", 6.8, 1.2, 2], ["storm", 4.5, 2.2, 3], ["harrier", 8.0, 3.4, 2],
        ["keg", 7.6, 5.2, 2], ["medic", 4.5, 1.2, 2]],
      [["hook", 4.5, 5.3, 2], ["ravager", 2.6, 5.2, 2], ["golem", 6.3, 5.0, 3], ["outrider", 0.9, 4.6, 2], ["rime", 3.4, 3.0, 2],
        ["ballista", 5.6, 1.4, 3], ["grenadier", 2.2, 2.2, 3], ["tide", 6.8, 2.6, 2], ["shade", 8.0, 4.4, 2], ["griffin", 1.4, 1.6, 3],
        ["keg", 7.6, 5.2, 2], ["grave", 4.5, 1.4, 2]],
    ],
  },
};

// More places, the same two armies as `arena`: a river with two bridges, a market square.
for (const [name, terrain, arena, title, seed] of [["crossing", "the-crossing", 3, "The Crossing", 33], ["market", "crate-yard", 2, "Market Square", 7]] as const)
  SCENES[name] = { ...SCENES.arena, armies: [SCENES.arena.armies[1], SCENES.arena.armies[0]], arena, terrain, title, seed };

// The rival's side of it (src/replay.ts), for the trailer: a short Arena fight the player wins, ending on the real
// results sheet with its "See it in <rival>'s game" button; and the same fight as the rival's game shows it, from
// the rival's end of the field.
SCENES.peek = {
  arena: 3, seed: 2, names: ["You", "Captain Varro"], title: "The Crossing", terrain: "the-crossing", sheet: true,
  armies: [
    [["bulwark", 2.4, 5.2, 3], ["lancer", 6.6, 5.0, 3], ["ranger", 2.0, 3.2, 3], ["storm", 4.5, 2.6, 3], ["grenadier", 6.8, 2.4, 3], ["medic", 4.5, 1.4, 2]],
    [["ravager", 2.4, 5.2, 2], ["hook", 6.6, 5.0, 2], ["rime", 3.0, 3.0, 2], ["grenadier", 6.0, 2.6, 2]],
  ],
};
SCENES.peekview = { ...SCENES.peek, sheet: false };

// `?film=kit`: every look the set builders know, laid out on one board, for checking a game's world style.
const KIT: [kind: string, look: string, w: number, h: number][] = [
  ["building", "house", 1.3, 1.1], ["building", "hall", 1.7, 1.3], ["building", "tower", 0.9, 0.9], ["building", "barn", 1.5, 1.1], ["building", "shop", 1.3, 1.0],
  ["building", "chapel", 1.8, 1.0], ["building", "mill", 1.1, 1.1], ["building", "gatehouse", 1.9, 0.8], ["building", "ruin", 1.4, 1.2], ["building", "rock", 1.2, 1.0],
  ["building", "well", 0.7, 0.7], ["building", "statue", 0.7, 0.7], ["wall", "wall", 1.8, 0.45], ["wall", "palisade", 1.8, 0.3], ["wall", "hedge-wall", 1.8, 0.45],
  ["barricade", "barricade", 1.5, 0.4], ["barricade", "logs", 1.4, 0.5], ["barricade", "wagon", 1.3, 0.7], ["cover", "crates", 1.4, 0.5], ["cover", "fence", 1.6, 0.3],
  ["cover", "sandbags", 1.4, 0.4], ["cover", "barrels", 0.9, 0.5], ["cover", "haystack", 0.7, 0.7], ["cover", "stall", 1.2, 0.7], ["cover", "cart", 0.9, 0.6],
  ["water", "fountain", 1.1, 1.1], ["water", "pond", 1.4, 1.0], ["road", "road", 1.2, 1.6], ["road", "plaza", 1.5, 1.5], ["brush", "brush", 1.5, 1.2],
  ["brush", "reeds", 1.5, 1.0], ["brush", "cornfield", 1.6, 1.2], ["brush", "orchard", 1.9, 1.4],
];
const kitBlocks = (): Block[] => KIT.map(([kind, look, w, h], i) => ({ id: i + 1, kind: kind as Block["kind"], look, x: 1.1 + (i % 4) * 2.25, y: 0.9 + Math.floor(i / 4) * 1.5, w: Math.min(w, 1.9), h: Math.min(h, 1.3) }));
SCENES.kit = {
  arena: 1, seed: 1, title: "Kit", blocks: kitBlocks(),
  marks: [{ look: "tree", x: -0.6, y: 3, w: 0, h: 0 }, { look: "lamp", x: -0.5, y: 5, w: 0, h: 0 }, { look: "banner", x: 9.5, y: 5, w: 0, h: 0 }, { look: "signpost", x: 9.5, y: 7, w: 0, h: 0 }] as ArenaMark[],
  armies: [[], []],
};

/** The match a scene plays: both armies already on the board, no gold to change them, one decisive battle. */
export function sceneConfig(s: Scene): MatchConfig {
  return {
    seed: s.seed, hp: [400, 400], names: s.names ?? ["You", "Rival"],
    start: [pieces(s.armies[0]), pieces(s.armies[1])],
    fixedGold: [0, 0], noReroll: true, firstRound: 9, maxRounds: 1,
    ...(s.blocks ? { terrain: s.blocks } : s.terrain ? { terrain: arenaById(s.terrain)?.blocks } : {}),
  };
}

declare global { interface Window { __film?: { scene: string; ready: boolean; marks: { name: string; t: number }[]; sfx: { name: string; gain: number; t: number }[]; render?: (log: { name: string; gain: number; t: number }[], seconds: number) => Promise<Float32Array[]> } } }

/** Shared with the recorder: what scene is playing, whether it has started, named moments and every sound played
 *  (with times on the page clock), so the edit can cut on a moment and lay the game's own sound under the picture. */
export function filmState(scene: string) {
  return (window.__film ??= { scene, ready: false, marks: [], sfx: [] });
}
export const filmMark = (name: string) => { window.__film?.marks.push({ name, t: performance.now() }); };

/** `?demo`: a mid-game save for trailers and screenshots (written to this browser's storage before the game loads
 *  it): two acts cleared, most of the roster found and levelled, a deck, coins, gems and a Silver League ladder. */
export function seedDemoSave() {
  const found: UnitKind[] = ["blades", "medic", "mine", "ranger", "bulwark", "pikeman", "lancer", "grenadier", "storm", "golem", "harrier", "ballista",
    "hook", "keg", "rime", "tide", "banner", "shade", "tinker", "lion", "griffin", "bombard", "duelist", "ravager"];
  const levels = Object.fromEntries(found.map((k, i) => [k, 2 + ((i * 7) % 6)]));
  const cards = Object.fromEntries(found.map((k, i) => [k, (i * 13) % 40]));
  const campaign = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i + 1, i % 4 === 3 ? 2 : 3]));
  const save = {
    campaign, puzzles: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 1 }, gauntlet: { best: 7, runs: 12 }, seen: found,
    settings: { sound: true, haptics: false, speed: 1 },
    wallet: { coins: 4280, gems: 365, earned: { coins: 20000, gems: 600 }, spent: { coins: 15720, gems: 235 }, credited: [] },
    progression: { levels, xp: 1460, v: 2, deck: found.slice(4, 12), legacyPaid: true },
    collection: { cards, found },
    arena: { trophies: 268, best: 291, wins: 21, losses: 9, streak: 3, bestStreak: 6, played: 30, arenaWins: { "twin-gates": 6, "the-crossing": 5, "crate-yard": 7, courtyard: 2, watchtowers: 1 } },
  };
  try { localStorage.setItem("muster.save.v1", JSON.stringify(save)); } catch { /* private mode */ }
}

/** The camera move of a scene, by seconds since it started. It is the same in every game, so a cut from one game's
 *  capture to another's lands on the same view of the same instant. Every move opens on the whole globe and comes
 *  in, then keeps turning: the zoom rides up as the board turns side-on, so the fight stays large in a tall frame. */
export function filmCamera(scene: string, t: number): { yaw: number; tilt: number; zoom: number } {
  if (scene === "peek") return { yaw: 0.12 * Math.sin(t * 0.5), tilt: 0.66, zoom: 1 };
  if (scene === "peekview") return { yaw: Math.PI + 0.12 * Math.sin(t * 0.5), tilt: 0.7, zoom: 1 }; // from the rival's end
  const ease = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
  const dir = scene === "arena" ? -1 : 1, rate = scene === "siege" ? 0.16 : 0.24;
  const yaw = dir * (-0.5 + rate * t + 0.25 * Math.sin(t * 0.37));
  const side = Math.abs(Math.sin(yaw));
  const zoom = (0.5 + 0.42 * ease(t / 2.2)) * (1 + 0.42 * side) * (1 + 0.06 * Math.sin(t * 0.8));
  const tilt = (scene === "arena" ? 0.86 : 0.74) + 0.1 * Math.sin(t * 0.29 + 1) - 0.22 * (1 - ease(t / 2.2));
  return { yaw, tilt, zoom };
}
