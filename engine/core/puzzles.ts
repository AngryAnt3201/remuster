// Breakpoint: one-battle puzzles against a fixed board. Each has a trick; gold left sets the stars.
import type { PuzzleDef } from "./content";
import type { StartPiece } from "./match";

export const PUZZLES: PuzzleDef[] = [
  // The pack walks in step: one mine where it will be catches all three swords.
  { id: 1, name: "Doorway", gold: 9, shop: ["blades", "ranger", "mine"], supply: 3,
    foe: [{ kind: "blades", lx: 4.5, depth: 5.2 }, { kind: "blades", lx: 3.7, depth: 4.6 }, { kind: "blades", lx: 5.3, depth: 4.6 }, { kind: "ranger", lx: 4.5, depth: 2 }], silver: 0, par: 1 },
  // Outgunned at range: a bulwark stood in front of your bows soaks the volleys.
  { id: 2, name: "Shield Wall", gold: 12, shop: ["ranger", "bulwark"], supply: 3,
    foe: [{ kind: "ranger", lx: 2.5, depth: 3 }, { kind: "ranger", lx: 4.5, depth: 3.2 }, { kind: "ranger", lx: 6.5, depth: 3 }, { kind: "ranger", lx: 4.5, depth: 1.5 }, { kind: "blades", lx: 4.5, depth: 5.2 }], silver: 0, par: 1 },
  // Lancers charge the nearest thing and wheel where the charge runs out: mine the lane.
  { id: 3, name: "Lancer Lane", gold: 11, shop: ["ranger", "mine"], supply: 5,
    foe: [{ kind: "lancer", lx: 2, depth: 4.5 }, { kind: "lancer", lx: 7, depth: 4.5 }, { kind: "ranger", lx: 4.5, depth: 2 }], silver: 0, par: 1 },
  // Fifteen swords in a block: bombs where they bunch, a wall to hold them there.
  { id: 4, name: "Pack Hunt", gold: 13, shop: ["grenadier", "ranger", "bulwark"], supply: 3,
    foe: [{ kind: "blades", lx: 3.6, depth: 5 }, { kind: "blades", lx: 5.4, depth: 5 }, { kind: "blades", lx: 4.5, depth: 4 }, { kind: "blades", lx: 3.6, depth: 3 }, { kind: "blades", lx: 5.4, depth: 3 }], silver: 1, par: 2 },
  // One file down one lane: a bolt laid along it goes through every one of them.
  { id: 5, name: "Column", gold: 10, shop: ["ballista", "ranger", "blades"], supply: 2,
    foe: [{ kind: "blades", lx: 6.5, depth: 5.4 }, { kind: "blades", lx: 6.5, depth: 4.2 }, { kind: "ranger", lx: 6.5, depth: 3 }, { kind: "ranger", lx: 6.5, depth: 2 }, { kind: "blades", lx: 6.5, depth: 1 }], silver: 0, par: 1 },
  // Two medics keep the giant standing: cloaks go round it and cut the healers first.
  { id: 6, name: "Soft Centre", gold: 13, shop: ["shade", "blades", "ranger"], supply: 3,
    foe: [{ kind: "golem", lx: 4.5, depth: 5, rank: 2 }, { kind: "medic", lx: 3.5, depth: 2.5 }, { kind: "medic", lx: 5.5, depth: 2.5 }, { kind: "ranger", lx: 4.5, depth: 1 }], silver: 1, par: 2 },
  // Rocks split the field: put everything on one side, win there, then turn.
  { id: 7, name: "Two Camps", gold: 14, shop: ["blades", "ranger", "bulwark"], supply: 4,
    obstacles: [{ x: 4.5, y: 5.6, r: 0.75 }, { x: 4.5, y: 7, r: 0.75 }, { x: 4.5, y: 8.4, r: 0.75 }],
    foe: [{ kind: "blades", lx: 1.5, depth: 4.5 }, { kind: "ranger", lx: 1.5, depth: 2.5 }, { kind: "ranger", lx: 2.3, depth: 3 },
      { kind: "blades", lx: 7.5, depth: 4.5 }, { kind: "ranger", lx: 7.5, depth: 2.5 }, { kind: "ranger", lx: 6.7, depth: 3 }], silver: 1, par: 2 },
  // Shades blink in right behind your bows: that is where the mines go.
  { id: 8, name: "Blink Trap", gold: 13, shop: ["ranger", "mine"], supply: 5,
    foe: [{ kind: "shade", lx: 1, depth: 5 }, { kind: "shade", lx: 8, depth: 5 }, { kind: "shade", lx: 4.5, depth: 4 }, { kind: "ranger", lx: 4.5, depth: 1.5 }], silver: 1, par: 3 },
  // Their front is sown with mines: let mites walk it first.
  { id: 9, name: "Minefield", gold: 13, shop: ["hive", "blades", "lancer"], supply: 4,
    foe: [{ kind: "mine", lx: 2.5, depth: 5.5 }, { kind: "mine", lx: 3.7, depth: 5.6 }, { kind: "mine", lx: 4.9, depth: 5.5 }, { kind: "mine", lx: 6.1, depth: 5.6 }, { kind: "mine", lx: 7.3, depth: 5.5 },
      { kind: "mine", lx: 3.1, depth: 4.6 }, { kind: "mine", lx: 5.5, depth: 4.6 }, { kind: "ranger", lx: 3.5, depth: 2 }, { kind: "ranger", lx: 5.5, depth: 2 }, { kind: "grenadier", lx: 4.5, depth: 1 }, { kind: "ballista", lx: 4.5, depth: 0.5 }], silver: 2, par: 5 },
  // The golem walks at structures first: spread bolt throwers so it chases one while the rest shoot.
  { id: 10, name: "Stone Bait", gold: 14, shop: ["ballista", "ranger", "blades"], supply: 5,
    foe: [{ kind: "golem", lx: 4.5, depth: 5, rank: 2 }, { kind: "storm", lx: 4.5, depth: 2.5 }, { kind: "medic", lx: 4.5, depth: 1.5 }], silver: 2, par: 5 },
  // Swords, a lancer and two hives of mites: lightning jumps through the crowd, a wall keeps it alive.
  { id: 11, name: "Storm Front", gold: 19, shop: ["storm", "bulwark", "ranger"], supply: 4,
    foe: [{ kind: "hive", lx: 3, depth: 1.5 }, { kind: "hive", lx: 6, depth: 1.5 }, { kind: "blades", lx: 4.5, depth: 5 }, { kind: "blades", lx: 3, depth: 4.5 }, { kind: "blades", lx: 6, depth: 4.5 }, { kind: "lancer", lx: 4.5, depth: 3.5 }], silver: 0, par: 1 },
  // Golems go for structures, shades for the soft back line: send each where it wants to go.
  { id: 12, name: "Siege Works", gold: 18, shop: ["golem", "lancer", "shade", "mine"], supply: 4,
    foe: [{ kind: "ballista", lx: 3, depth: 1.2 }, { kind: "ballista", lx: 6, depth: 1.2 }, { kind: "grenadier", lx: 4.5, depth: 2 }, { kind: "bulwark", lx: 4.5, depth: 4.8 }, { kind: "ranger", lx: 2.5, depth: 3 }, { kind: "ranger", lx: 6.5, depth: 3 }], silver: 1, par: 2 },
  // Two places on the board and five packs coming: rank up instead of widening.
  { id: 13, name: "Few but Fierce", gold: 20, shop: ["storm", "grenadier", "bulwark", "blades"], supply: 2,
    foe: [{ kind: "blades", lx: 2, depth: 5 }, { kind: "blades", lx: 4.5, depth: 5 }, { kind: "blades", lx: 7, depth: 5 }, { kind: "blades", lx: 3.2, depth: 3.5 }, { kind: "blades", lx: 5.8, depth: 3.5 }, { kind: "medic", lx: 4.5, depth: 2 }], silver: 2, par: 4 },
  // Bombers and lightning behind one shield: ride through them from wide lanes, never in a bunch.
  { id: 14, name: "Ride Through", gold: 18, shop: ["blades", "lancer", "ranger"], supply: 5,
    foe: [{ kind: "bulwark", lx: 4.5, depth: 5 }, { kind: "grenadier", lx: 3.2, depth: 2.4 }, { kind: "grenadier", lx: 5.8, depth: 2.4 }, { kind: "storm", lx: 4.5, depth: 3 }, { kind: "ballista", lx: 4.5, depth: 0.8 }], silver: 2, par: 3 },
  // Everything at once. Lancers break on stone and shades can't cut it down.
  { id: 15, name: "Last Stand", gold: 25, shop: ["mine", "bulwark", "ranger", "grenadier", "storm", "golem", "lancer", "ballista"], supply: 6,
    foe: [{ kind: "golem", lx: 4.5, depth: 5, rank: 2 }, { kind: "lancer", lx: 1.5, depth: 4.5 }, { kind: "lancer", lx: 7.5, depth: 4.5 }, { kind: "shade", lx: 4.5, depth: 3.5 },
      { kind: "shade", lx: 1, depth: 3 }, { kind: "storm", lx: 3.5, depth: 2 }, { kind: "medic", lx: 5.5, depth: 2 }], silver: 0, par: 4 },
  // Three lancers and two kegs come at a gallop: braced pikes in their lanes stop them cold.
  { id: 16, name: "Brace", gold: 11, shop: ["blades", "ranger", "pikeman"], supply: 4,
    foe: [{ kind: "lancer", lx: 1.6, depth: 4.5, rank: 2 }, { kind: "lancer", lx: 4.5, depth: 4.8 }, { kind: "lancer", lx: 7.4, depth: 4.5, rank: 2 }, { kind: "keg", lx: 3, depth: 5.2 },
      { kind: "keg", lx: 6, depth: 5.2 }, { kind: "ranger", lx: 3.5, depth: 2 }, { kind: "ranger", lx: 5.5, depth: 2 }], silver: 1, par: 2 },
  // Harriers fly over swords and pikes alike: only frost and turrets reach them.
  { id: 17, name: "Clear Skies", gold: 15, shop: ["blades", "pikeman", "rime", "tinker"], supply: 4,
    foe: [{ kind: "harrier", lx: 1.6, depth: 3.5 }, { kind: "harrier", lx: 4.5, depth: 3.8 }, { kind: "harrier", lx: 7.4, depth: 3.5 }, { kind: "pikeman", lx: 3.5, depth: 5 },
      { kind: "pikeman", lx: 5.5, depth: 5 }, { kind: "medic", lx: 4.5, depth: 2.5 }], silver: 1, par: 2 },
  // A flock packed shoulder to shoulder round its flag and healers: one keg into the middle of it.
  { id: 18, name: "Powder", gold: 13, shop: ["keg", "ranger", "bulwark"], supply: 4,
    foe: [{ kind: "blades", lx: 4.5, depth: 4.6 }, { kind: "blades", lx: 3.7, depth: 4 }, { kind: "blades", lx: 5.3, depth: 4 }, { kind: "blades", lx: 4.5, depth: 3.4 },
      { kind: "banner", lx: 4.5, depth: 2.7 }, { kind: "medic", lx: 3.8, depth: 2.2 }, { kind: "medic", lx: 5.2, depth: 2.2 }], silver: 3, par: 4 },
];

/** A known winning buy for each puzzle (solver-found), side-local coordinates. */
export const SOLUTIONS: Record<number, StartPiece[]> = {
  1: [{ kind: "mine", lx: 2.93, depth: 5.88 }, { kind: "blades", lx: 4.86, depth: 0.25 }, { kind: "blades", lx: 1.71, depth: 1.22 }],
  2: [{ kind: "bulwark", lx: 2.7, depth: 1.71 }, { kind: "bulwark", lx: 5.23, depth: 1.71 }, { kind: "ranger", lx: 8.42, depth: 1 }],
  3: [{ kind: "ranger", lx: 1.54, depth: 0.48 }, { kind: "mine", lx: 4.91, depth: 4.78 }, { kind: "mine", lx: 5.46, depth: 5.5 }, { kind: "ranger", lx: 4.74, depth: 4.4 }],
  4: [{ kind: "grenadier", lx: 2.5, depth: 0.91 }, { kind: "ranger", lx: 6.57, depth: 5.78 }, { kind: "grenadier", lx: 0.99, depth: 3.2 }],
  5: [{ kind: "ballista", lx: 5.38, depth: 2.83, rank: 2 }, { kind: "ballista", lx: 5.88, depth: 4.78 }],
  6: [{ kind: "shade", lx: 1.88, depth: 3.42 }, { kind: "ranger", lx: 3.39, depth: 3.49 }, { kind: "shade", lx: 3.85, depth: 5.58 }],
  7: [{ kind: "blades", lx: 7.26, depth: 5.88, rank: 2 }, { kind: "blades", lx: 2.97, depth: 5.88 }, { kind: "blades", lx: 0.58, depth: 4.8 }],
  8: [{ kind: "ranger", lx: 5.82, depth: 2.3 }, { kind: "mine", lx: 3.31, depth: 5.43 }, { kind: "ranger", lx: 4.5, depth: 0.83 }, { kind: "mine", lx: 4.92, depth: 3.56 }],
  9: [{ kind: "hive", lx: 2.2, depth: 0.4, rank: 2 }],
  10: [{ kind: "ballista", lx: 4.87, depth: 3.39 }, { kind: "ranger", lx: 5.75, depth: 0.33 }, { kind: "ballista", lx: 5.16, depth: 1.44 }],
  11: [{ kind: "bulwark", lx: 2.47, depth: 4.88 }, { kind: "storm", lx: 2.8, depth: 1.41 }, { kind: "bulwark", lx: 0.55, depth: 5.5 }, { kind: "storm", lx: 1.68, depth: 3.73 }],
  12: [{ kind: "lancer", lx: 5.96, depth: 5.02 }, { kind: "shade", lx: 8.42, depth: 5.83 }, { kind: "shade", lx: 2.6, depth: 5.17 }, { kind: "lancer", lx: 4.01, depth: 4.43 }],
  13: [{ kind: "bulwark", lx: 2.43, depth: 0.25, rank: 2 }, { kind: "grenadier", lx: 0.99, depth: 2.31, rank: 2 }],
  14: [{ kind: "lancer", lx: 7.28, depth: 1.4, rank: 2 }, { kind: "lancer", lx: 1.1, depth: 0.99 }, { kind: "ranger", lx: 3.64, depth: 3.06 }],
  15: [{ kind: "lancer", lx: 0.55, depth: 0.98 }, { kind: "lancer", lx: 0.61, depth: 2.82 }, { kind: "lancer", lx: 4.1, depth: 2.46 }, { kind: "golem", lx: 0.78, depth: 5.83 }, { kind: "bulwark", lx: 4.05, depth: 3.47 }],
  16: [{ kind: "pikeman", lx: 6.11, depth: 4.25 }, { kind: "ranger", lx: 5.52, depth: 2.39 }, { kind: "ranger", lx: 6.62, depth: 1.19 }],
  17: [{ kind: "blades", lx: 3.69, depth: 5.88 }, { kind: "rime", lx: 8.45, depth: 4.01 }, { kind: "tinker", lx: 6.97, depth: 0.25 }, { kind: "blades", lx: 3.7, depth: 5.2 }],
  18: [{ kind: "keg", lx: 4.64, depth: 1.46 }, { kind: "ranger", lx: 2.48, depth: 4.97 }, { kind: "keg", lx: 5.14, depth: 1.87 }],
};
