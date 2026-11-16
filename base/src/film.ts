// Film mode: scripted battles for trailers and store videos (`?film=<scene>`). A scene is a fixed seed and two fixed
// armies, so it plays out identically every time and, because the sim is the engine's, identically in every game:
// the recorder (tools/film.mjs) captures the same scene in several games and the edit cuts between them mid-fight.
// Scenes are data; add one here and it works in every game.
import type { MatchConfig, StartPiece } from "@engine/core/match";
import type { UnitKind } from "@engine/core/defs";
import { arenaById } from "@engine/core/arena";

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
    arena: 10, seed: 41, names: ["You", "Rival"], title: "Old Village", terrain: "old-village",
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

/** The match a scene plays: both armies already on the board, no gold to change them, one decisive battle. */
export function sceneConfig(s: Scene): MatchConfig {
  return {
    seed: s.seed, hp: [400, 400], names: s.names ?? ["You", "Rival"],
    start: [pieces(s.armies[0]), pieces(s.armies[1])],
    fixedGold: [0, 0], noReroll: true, firstRound: 9, maxRounds: 1,
    ...(s.terrain ? { terrain: arenaById(s.terrain)?.blocks } : {}),
  };
}

declare global { interface Window { __film?: { scene: string; ready: boolean; marks: { name: string; t: number }[]; sfx: { name: string; gain: number; t: number }[] } } }

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
