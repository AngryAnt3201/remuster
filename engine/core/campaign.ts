// The 60-level campaign in ten acts of six. Each act ends with a boss: a named rival, a set-piece board and a twist.
// New units unlock along the way; the level that introduces one sets the foe up so the new unit matters.
import type { AIProfile, Tactic } from "./ai";
import type { LevelDef, Objective } from "./content";
import type { UnitKind } from "./defs";

export const ACTS = ["The Borderlands", "Ash Fields", "The Hollow Wood", "Iron Pass", "The High Keep", "The Frozen Reach", "The Sky Throne", "The Mirelight Fen",
  "The Saltwind Coast", "Crownfall Citadel"];

/** The level each unit first appears on (the player's roster is everything unlocked so far). */
const UNLOCKS: [number, UnitKind][] = [
  [1, "blades"], [1, "ranger"], [2, "mine"], [3, "bulwark"], [5, "medic"], [7, "lancer"], [9, "grenadier"],
  [11, "ballista"], [14, "shade"], [16, "hive"], [19, "storm"], [22, "golem"],
  [31, "sapper"], [32, "harrier"], [33, "banner"], [34, "rime"], [35, "ravager"], [36, "grave"],
  [37, "bombard"], [38, "tinker"], [39, "duelist"], [40, "pikeman"], [41, "keg"], [42, "trickster"],
  // 1.1: four more join late in Act 7, alongside that level's first unlock.
  [39, "lamp"], [40, "thorn"], [41, "hook"], [42, "outrider"],
  // Acts 9-10 introduce the three legendaries: Griffin Knight, Tidecaller and Lionheart.
  [50, "griffin"], [53, "tide"], [57, "lion"],
];
export const rosterAt = (id: number): UnitKind[] => UNLOCKS.filter(([at]) => at <= id).map(([, k]) => k);

const ai = (difficulty: number, tactic: Tactic, aggression = 0.5, economy = 0.4, spread = 0.6, rerolls = 1): AIProfile =>
  ({ difficulty, tactic, aggression, economy, spread, rerolls });

const WIN: Objective = { kind: "win" };
const hp = (value: number): Objective => ({ kind: "hpAtLeast", value });
const rounds = (value: number): Objective => ({ kind: "roundsAtMost", value });
const losses = (value: number): Objective => ({ kind: "lossesAtMost", value });

/** A level as written: `power` scales the foe's health and damage (a quiet handicap or edge, tuned by tools/balance.ts). */
type Draft = Omit<LevelDef, "id" | "act" | "roster" | "unlock" | "hp"> & { hp?: [number, number]; foeHp: number; power?: number };

const DRAFTS: Draft[] = [
  // ---------------------------------------------------------------- Act 1: The Borderlands
  { name: "First Muster", foe: "Sergeant Pell", line: "Raw recruits on both sides of the fence.", foeHp: 120, power: 0.84,
    ai: ai(0.1, "balanced", 0.4, 0.2, 0.6, 0), stars: [WIN, hp(340), rounds(6)] },
  { name: "Tripwire", foe: "Corporal Dunn", line: "Dunn's swords never stop running.", foeHp: 130, power: 0.8, foeRoster: ["blades", "ranger"],
    ai: ai(0.13, "swarm", 0.7, 0.2, 0.5, 0), stars: [WIN, hp(330), losses(1)] },
  { name: "Arrow Rain", foe: "Captain Ilse", line: "Ilse would rather shoot than talk.", foeHp: 140, power: 1.03, foeRoster: ["ranger", "blades"],
    ai: ai(0.16, "artillery", 0.3, 0.3, 0.8, 0), stars: [WIN, hp(320), rounds(7)] },
  { name: "Fence Line", foe: "Old Tobin", line: "He dug in years ago and never left.", foeHp: 150, power: 0.93,
    obstacles: [{ x: 2.2, y: 7, r: 0.6 }, { x: 6.8, y: 7, r: 0.6 }],
    ai: ai(0.19, "fortress", 0.2, 0.5, 0.5, 1), stars: [WIN, hp(300), losses(2)] },
  { name: "Field Dressing", foe: "Sister Wren", line: "She wins the long fights.", foeHp: 170, power: 0.8,
    ai: ai(0.22, "blitz", 0.8, 0.2, 0.7, 1), stars: [WIN, hp(300), rounds(8)] },
  { name: "The Old Bridge", foe: "Warden Hask", line: "None cross while the Warden stands.", foeHp: 220, power: 0.87, boss: true, startGold: [6, 0], supply: [1, 0],
    obstacles: [{ x: 0.9, y: 7, r: 0.75 }, { x: 2.3, y: 7, r: 0.75 }, { x: 6.7, y: 7, r: 0.75 }, { x: 8.1, y: 7, r: 0.75 }],
    start: [undefined, [{ kind: "bulwark", lx: 4.5, depth: 5 }, { kind: "ranger", lx: 3.6, depth: 2.4 }, { kind: "ranger", lx: 5.4, depth: 2.4 }, { kind: "mine", lx: 4.5, depth: 5.7 }]],
    ai: ai(0.3, "fortress", 0.35, 0.4, 0.4, 1), stars: [WIN, hp(260), losses(2)] },

  // ---------------------------------------------------------------- Act 2: Ash Fields
  { name: "Cavalry", foe: "Rook", line: "A long line of bows and nothing behind it.", foeHp: 190, power: 0.85, foeRoster: ["ranger", "medic", "blades", "bulwark"],
    ai: ai(0.32, "artillery", 0.3, 0.4, 0.9, 1), stars: [WIN, hp(300), rounds(8)] },
  { name: "Dust Devils", foe: "Dame Cassia", line: "Cassia rides first and asks later.", foeHp: 200, power: 0.98,
    ai: ai(0.35, "blitz", 0.85, 0.2, 0.7, 1), stars: [WIN, hp(280), losses(2)] },
  { name: "Bombard", foe: "Kettle", line: "Kettle brings more swords than sense.", foeHp: 210, power: 1.07, foeRoster: ["blades", "medic", "ranger", "lancer"],
    ai: ai(0.38, "swarm", 0.7, 0.2, 0.5, 2), stars: [WIN, hp(280), rounds(9)] },
  { name: "Cinder Road", foe: "Brother Ash", line: "The road is quiet. Too quiet.", foeHp: 220, power: 1.14,
    obstacles: [{ x: 3, y: 6.6, r: 0.55 }, { x: 6, y: 7.4, r: 0.55 }],
    ai: ai(0.41, "ambush", 0.6, 0.4, 0.8, 1), stars: [WIN, hp(260), losses(2)] },
  { name: "Long Shot", foe: "Lady Ferrow", line: "Her column marches in perfect file.", foeHp: 230, power: 0.95, foeRoster: ["blades", "bulwark", "lancer", "medic", "grenadier"],
    ai: ai(0.44, "siege", 0.55, 0.4, 0.05, 1), stars: [WIN, hp(250), rounds(10)] },
  { name: "Ashen Crown", foe: "Marshal Vey", line: "The Marshal does not reroll his fate.", foeHp: 260, power: 0.87, boss: true, noReroll: true, startGold: [8, 0], supply: [2, 0],
    start: [undefined, [{ kind: "lancer", lx: 2, depth: 4.4 }, { kind: "lancer", lx: 7, depth: 4.4 }, { kind: "grenadier", lx: 4.5, depth: 1.6 }, { kind: "bulwark", lx: 4.5, depth: 5 }]],
    income: [0, 1], ai: ai(0.5, "blitz", 0.75, 0.3, 0.7, 0), stars: [WIN, hp(220), losses(3)] },

  // ---------------------------------------------------------------- Act 3: The Hollow Wood
  { name: "Hidden Paths", foe: "Quill", line: "Every step in the wood is a guess.", foeHp: 260, power: 1.12,
    obstacles: [{ x: 1.8, y: 6.2, r: 0.5 }, { x: 4.5, y: 7.2, r: 0.6 }, { x: 7.2, y: 6.4, r: 0.5 }, { x: 3, y: 8.4, r: 0.45 }, { x: 6.2, y: 8.2, r: 0.45 }],
    ai: ai(0.52, "ambush", 0.5, 0.4, 0.7, 1), stars: [WIN, hp(240), rounds(10)] },
  { name: "Shadows", foe: "The Moth", line: "Her healers never seem to tire.", foeHp: 270, power: 1.06, foeRoster: ["bulwark", "medic", "ranger", "blades"],
    ai: ai(0.54, "fortress", 0.3, 0.5, 0.5, 1), stars: [WIN, hp(240), losses(3)] },
  { name: "Thicket", foe: "Hollow Jack", line: "Jack fills the trees with blades.", foeHp: 280, power: 1.03,
    obstacles: [{ x: 2.5, y: 7, r: 0.7 }, { x: 6.5, y: 7, r: 0.7 }],
    ai: ai(0.56, "swarm", 0.65, 0.3, 0.6, 2), stars: [WIN, hp(230), rounds(11)] },
  { name: "The Brood", foe: "Briar", line: "Briar seeds the ground before you come.", foeHp: 290, power: 1.09, foeRoster: ["mine", "shade", "lancer", "ranger", "bulwark", "grenadier"],
    ai: ai(0.58, "ambush", 0.45, 0.4, 0.8, 1), stars: [WIN, hp(220), losses(3)] },
  { name: "Woodcutters", foe: "Fennick", line: "Fennick fells whatever stands still.", foeHp: 300, power: 0.87,
    ai: ai(0.6, "artillery", 0.4, 0.5, 0.6, 1), stars: [WIN, hp(220), rounds(11)] },
  { name: "Heart of the Wood", foe: "Mother Brask", line: "The wood itself fights for her.", foeHp: 320, power: 1.21, boss: true, maxRounds: 12, startGold: [8, 0], supply: [2, 0],
    obstacles: [{ x: 1.5, y: 6.5, r: 0.55 }, { x: 3.4, y: 7.4, r: 0.6 }, { x: 5.6, y: 6.6, r: 0.6 }, { x: 7.5, y: 7.5, r: 0.55 }],
    start: [undefined, [{ kind: "hive", lx: 2.5, depth: 1.2 }, { kind: "hive", lx: 6.5, depth: 1.2 }, { kind: "mine", lx: 3, depth: 5.5 }, { kind: "mine", lx: 6, depth: 5.5 }, { kind: "bulwark", lx: 4.5, depth: 4.6 }]],
    mods: [undefined, { broodStart: true }], ai: ai(0.66, "swarm", 0.5, 0.4, 0.6, 1), stars: [WIN, hp(200), losses(3)] },

  // ---------------------------------------------------------------- Act 4: Iron Pass
  { name: "Thunderhead", foe: "Sledge", line: "Sledge sends the swarm and waits.", foeHp: 310, power: 1.15, foeRoster: ["blades", "hive", "medic", "lancer", "shade", "mine"],
    ai: ai(0.68, "swarm", 0.6, 0.4, 0.5, 2), stars: [WIN, hp(220), rounds(11)] },
  { name: "The Narrows", foe: "Anvil Mara", line: "Room for one army in the pass.", foeHp: 320, power: 0.98,
    obstacles: [{ x: 0.9, y: 6.4, r: 0.8 }, { x: 0.9, y: 7.8, r: 0.8 }, { x: 8.1, y: 6.4, r: 0.8 }, { x: 8.1, y: 7.8, r: 0.8 }],
    ai: ai(0.7, "blitz", 0.8, 0.3, 0.4, 1), stars: [WIN, hp(200), losses(3)] },
  { name: "Rockfall", foe: "Corran", line: "Corran has the high ground and the bombs.", foeHp: 330, power: 0.88,
    ai: ai(0.72, "artillery", 0.35, 0.5, 0.7, 2), stars: [WIN, hp(200), rounds(12)] },
  { name: "Stonewake", foe: "Grist", line: "Grist hides behind a wall of bolts.", foeHp: 340, power: 0.88, foeRoster: ["ballista", "bulwark", "medic", "ranger", "grenadier", "mine", "storm"],
    ai: ai(0.74, "fortress", 0.25, 0.5, 0.6, 1), stars: [WIN, hp(200), losses(3)] },
  { name: "Iron Gate", foe: "Iron Dov", line: "The gate holds. So does Dov.", foeHp: 350, power: 0.95, noReroll: true,
    obstacles: [{ x: 3, y: 7, r: 0.5 }, { x: 6, y: 7, r: 0.5 }],
    ai: ai(0.76, "siege", 0.45, 0.5, 0.6, 0), stars: [WIN, hp(190), rounds(12)] },
  { name: "The Iron Pass", foe: "General Okar", line: "Okar has never lost the pass.", foeHp: 360, power: 0.94, boss: true, startGold: [9, 0],
    obstacles: [{ x: 0.8, y: 6.3, r: 0.85 }, { x: 0.8, y: 7.7, r: 0.85 }, { x: 8.2, y: 6.3, r: 0.85 }, { x: 8.2, y: 7.7, r: 0.85 }],
    start: [undefined, [{ kind: "golem", lx: 4.5, depth: 4.8 }, { kind: "ballista", lx: 3, depth: 0.9 }, { kind: "ballista", lx: 6, depth: 0.9 }, { kind: "bulwark", lx: 4.5, depth: 3.6 }]],
    supply: [2, 1], ai: ai(0.82, "siege", 0.5, 0.4, 0.5, 1), stars: [WIN, hp(180), losses(4)] },

  // ---------------------------------------------------------------- Act 5: The High Keep
  { name: "Outer Wall", foe: "Captain Rhee", line: "The keep's first wall, and its best captain.", foeHp: 360, power: 0.96,
    ai: ai(0.8, "balanced", 0.5, 0.45, 0.6, 2), stars: [WIN, hp(200), rounds(12)] },
  { name: "Killing Ground", foe: "Sable", line: "Sable mines the yard every night.", foeHp: 370, power: 1.12,
    ai: ai(0.82, "ambush", 0.55, 0.4, 0.8, 2), stars: [WIN, hp(190), losses(4)] },
  { name: "Courtyard", foe: "Lord Varrin", line: "Varrin watches from the walls.", foeHp: 380, power: 0.9,
    ai: ai(0.84, "artillery", 0.3, 0.5, 0.7, 2), stars: [WIN, hp(180), rounds(13)] },
  { name: "The Breach", foe: "The Mason", line: "Stone answers stone.", foeHp: 390, power: 0.95,
    obstacles: [{ x: 4.5, y: 7, r: 0.7 }],
    ai: ai(0.86, "siege", 0.6, 0.4, 0.5, 2), stars: [WIN, hp(180), losses(4)] },
  { name: "Night Watch", foe: "Vigil", line: "The watch never sleeps.", foeHp: 400, power: 0.88, income: [0, 1],
    ai: ai(0.88, "swarm", 0.65, 0.4, 0.6, 2), stars: [WIN, hp(170), rounds(13)] },
  { name: "The High Keep", foe: "Regent Maelis", line: "The Regent holds the high keep.", foeHp: 400, power: 0.82, boss: true, startGold: [12, 0],
    start: [undefined, [{ kind: "golem", lx: 4.5, depth: 4.8, rank: 2 }, { kind: "bulwark", lx: 3, depth: 4.4 }, { kind: "bulwark", lx: 6, depth: 4.4 }, { kind: "medic", lx: 4.5, depth: 2.6 }]],
    obstacles: [{ x: 3.1, y: 7, r: 0.65 }, { x: 5.9, y: 7, r: 0.65 }],
    supply: [2, 1], ai: ai(0.9, "balanced", 0.55, 0.45, 0.6, 2), stars: [WIN, hp(160), losses(4)] },

  // ---------------------------------------------------------------- Act 6: The Frozen Reach
  { name: "Undermine", foe: "Engineer Kade", line: "Kade's guns sit far behind a wall.", foeHp: 400, power: 0.8,
    foeRoster: ["bombard", "ballista", "grenadier", "bulwark", "pikeman", "ranger", "tinker", "medic"],
    ai: ai(0.88, "artillery", 0.2, 0.5, 0.7, 2), stars: [WIN, hp(180), rounds(13)] },
  { name: "Open Sky", foe: "Warden Ulla", line: "A wall of steel and not one bow among them.", foeHp: 400, power: 1.2,
    foeRoster: ["pikeman", "bulwark", "blades", "ravager", "duelist", "medic", "banner", "lancer"],
    ai: ai(0.89, "balanced", 0.6, 0.4, 0.6, 2), stars: [WIN, hp(180), losses(4)] },
  { name: "Colours", foe: "Sir Gethin", line: "His shields hold. Yours must strike faster.", foeHp: 400, power: 0.86,
    foeRoster: ["bulwark", "pikeman", "medic", "golem", "tinker", "ballista", "ranger"],
    obstacles: [{ x: 2.4, y: 7, r: 0.55 }, { x: 6.6, y: 7, r: 0.55 }],
    ai: ai(0.9, "fortress", 0.3, 0.55, 0.5, 2), stars: [WIN, hp(170), rounds(14)] },
  { name: "Hoarfrost", foe: "Rider Sesk", line: "Sesk's riders never slow down.", foeHp: 400, power: 0.99,
    foeRoster: ["lancer", "ravager", "keg", "harrier", "shade", "blades", "banner"],
    ai: ai(0.9, "blitz", 0.9, 0.3, 0.7, 2), stars: [WIN, hp(170), losses(4)] },
  { name: "Iron Hunger", foe: "Thane Borka", line: "Borka brings the biggest things that walk.", foeHp: 400, power: 0.75,
    foeRoster: ["golem", "bulwark", "pikeman", "medic", "storm", "bombard", "banner"],
    ai: ai(0.91, "siege", 0.5, 0.5, 0.5, 2), stars: [WIN, hp(170), rounds(14)] },
  { name: "The Frozen Reach", foe: "Countess Vire", line: "Nothing stays dead in the Countess's snow.", foeHp: 400, power: 0.88, boss: true,
    startGold: [12, 0], supply: [2, 1], mods: [undefined, { broodStart: true }],
    obstacles: [{ x: 1.6, y: 6.8, r: 0.55 }, { x: 4.5, y: 7.2, r: 0.6 }, { x: 7.4, y: 6.8, r: 0.55 }],
    start: [undefined, [{ kind: "hive", lx: 3, depth: 1.2, rank: 3 }, { kind: "hive", lx: 6, depth: 1.2, rank: 2 }, { kind: "blades", lx: 3.6, depth: 4.6, rank: 2 },
      { kind: "blades", lx: 5.4, depth: 4.6, rank: 2 }, { kind: "banner", lx: 4.5, depth: 3.4 }]],
    foeRoster: ["hive", "blades", "keg", "banner", "medic", "trickster", "storm", "bulwark"],
    ai: ai(0.92, "swarm", 0.6, 0.5, 0.6, 2), stars: [WIN, hp(150), losses(5)] },

  // ---------------------------------------------------------------- Act 7: The Sky Throne
  { name: "Long Guns", foe: "Gunner Tessaly", line: "Tessaly never leaves her wall.", foeHp: 400, power: 0.86,
    foeRoster: ["ballista", "bulwark", "tinker", "pikeman", "medic", "ranger", "mine", "rime"],
    ai: ai(0.92, "fortress", 0.1, 0.55, 0.5, 2), stars: [WIN, hp(170), rounds(14)] },
  { name: "Clockwork", foe: "Skymarshal Ren", line: "Ren's harriers own the sky.", foeHp: 400, power: 0.99,
    foeRoster: ["harrier", "shade", "sapper", "lancer", "keg", "ravager", "trickster"],
    ai: ai(0.92, "ambush", 0.65, 0.4, 0.8, 2), stars: [WIN, hp(160), losses(5)] },
  { name: "Crossed Steel", foe: "Blademaster Oku", line: "Oku's school teaches only the sword.", foeHp: 400, power: 1.04,
    foeRoster: ["blades", "ravager", "duelist", "banner", "sapper", "trickster", "medic", "pikeman"],
    ai: ai(0.93, "swarm", 0.7, 0.4, 0.6, 2), stars: [WIN, hp(160), rounds(14)] },
  { name: "Hold the Ford", foe: "Rider Calla", line: "Calla's lancers cross at a gallop.", foeHp: 400, power: 1.06,
    foeRoster: ["lancer", "keg", "ravager", "harrier", "blades", "banner", "shade"],
    obstacles: [{ x: 1.3, y: 7, r: 0.7 }, { x: 7.7, y: 7, r: 0.7 }],
    ai: ai(0.93, "blitz", 0.9, 0.35, 0.6, 2), stars: [WIN, hp(160), losses(5)] },
  { name: "Powder Keg", foe: "Abbot Grue", line: "Grue's flock marches shoulder to shoulder.", foeHp: 400, power: 1.04,
    foeRoster: ["grave", "hive", "blades", "banner", "medic", "trickster", "bulwark", "storm"],
    ai: ai(0.94, "swarm", 0.55, 0.45, 0.1, 2), stars: [WIN, hp(150), rounds(15)] },
  { name: "The Sky Throne", foe: "Empress Solace", line: "The last throne, and she has never left it.", foeHp: 400, power: 0.86, boss: true,
    startGold: [14, 0], supply: [2, 1],
    obstacles: [{ x: 2.2, y: 6.6, r: 0.5 }, { x: 6.8, y: 6.6, r: 0.5 }, { x: 4.5, y: 7.5, r: 0.55 }],
    start: [undefined, [{ kind: "ravager", lx: 4.5, depth: 4.8, rank: 2 }, { kind: "storm", lx: 4.5, depth: 2.2 }, { kind: "bombard", lx: 4.5, depth: 0.8 },
      { kind: "harrier", lx: 2, depth: 3.5 }, { kind: "bulwark", lx: 6.5, depth: 4.4 }, { kind: "medic", lx: 3, depth: 2.4 }]],
    ai: ai(0.95, "balanced", 0.6, 0.55, 0.6, 2), stars: [WIN, hp(140), losses(5)] },

  // ---------------------------------------------------------------- Act 8: The Mirelight Fen (1.1)
  // No new units here: every foe is built around one of the four 1.1 units (Hookwarden, Thornweaver, Outrider,
  // Lamplighter), and the boss puts all four on her opening board.
  { name: "Reedwater", foe: "Bargeman Holt", line: "Holt's chains come out of the reeds.", foeHp: 400, power: 0.86,
    foeRoster: ["hook", "bulwark", "pikeman", "medic", "ranger", "lamp", "ballista"],
    obstacles: [{ x: 2, y: 7, r: 0.6 }, { x: 7, y: 7, r: 0.6 }],
    ai: ai(0.94, "fortress", 0.3, 0.5, 0.6, 2), stars: [WIN, hp(150), rounds(15)] },
  { name: "Will-o'-Wisp", foe: "Sister Ama", line: "Ama's lanterns never seem to go out.", foeHp: 400, power: 1.04,
    foeRoster: ["lamp", "medic", "banner", "blades", "duelist", "ravager", "bulwark", "trickster"],
    ai: ai(0.94, "balanced", 0.6, 0.45, 0.6, 2), stars: [WIN, hp(150), losses(5)] },
  { name: "Bramble Causeway", foe: "Thornwife Esk", line: "The causeway grows shut behind you.", foeHp: 400, power: 1.04,
    foeRoster: ["thorn", "hive", "mine", "sapper", "rime", "grenadier", "storm", "bulwark"],
    obstacles: [{ x: 1.4, y: 6.6, r: 0.5 }, { x: 4.5, y: 7.4, r: 0.55 }, { x: 7.6, y: 6.6, r: 0.5 }],
    ai: ai(0.95, "ambush", 0.5, 0.45, 0.8, 2), stars: [WIN, hp(140), rounds(15)] },
  { name: "Running Water", foe: "Captain Saro", line: "Saro's riders circle and never close.", foeHp: 400, power: 1.15,
    foeRoster: ["outrider", "harrier", "lancer", "ranger", "keg", "shade", "banner"],
    ai: ai(0.95, "blitz", 0.85, 0.35, 0.7, 2), stars: [WIN, hp(140), losses(5)] },
  { name: "The Drowned Bell", foe: "Ferryman Coyle", line: "Coyle drags you under his guns.", foeHp: 400, power: 0.86,
    foeRoster: ["hook", "bombard", "thorn", "tinker", "pikeman", "ballista", "lamp", "medic"],
    obstacles: [{ x: 4.5, y: 7, r: 0.65 }],
    ai: ai(0.96, "siege", 0.5, 0.5, 0.5, 2), stars: [WIN, hp(130), rounds(16)] },
  { name: "Mirelight", foe: "Mother Wick", line: "Her lanterns ward every soldier before the first blow.", foeHp: 400, power: 0.7, boss: true,
    startGold: [14, 0], supply: [2, 1], mods: [undefined, { litStart: true }],
    obstacles: [{ x: 1.5, y: 7, r: 0.55 }, { x: 4.5, y: 6.5, r: 0.5 }, { x: 7.5, y: 7, r: 0.55 }],
    start: [undefined, [{ kind: "hook", lx: 4.5, depth: 4.8, rank: 2 }, { kind: "lamp", lx: 4.5, depth: 2.6, rank: 2 }, { kind: "thorn", lx: 3, depth: 2.2 },
      { kind: "outrider", lx: 6.5, depth: 3 }, { kind: "bulwark", lx: 3, depth: 4.4 }, { kind: "medic", lx: 6, depth: 2 }]],
    foeRoster: ["hook", "thorn", "outrider", "lamp", "bulwark", "medic", "pikeman", "bombard", "banner"],
    ai: ai(0.97, "balanced", 0.55, 0.55, 0.6, 2), stars: [WIN, hp(130), losses(5)] },

  // ---------------------------------------------------------------- Act 9: The Saltwind Coast
  // Sea cliffs, a lighthouse and a stormy shore. Each level bends one rule of the fight (the tide, the wind, the surf).
  { name: "Landfall", foe: "Captain Wrack", line: "Wrack's boats keep coming in on the tide.", foeHp: 400, power: 0.95,
    foeRoster: ["blades", "ravager", "keg", "hook", "banner", "medic", "harrier", "duelist"], income: [0, 1],
    obstacles: [{ x: 2.2, y: 7.2, r: 0.55 }, { x: 6.8, y: 6.8, r: 0.55 }],
    ai: ai(0.96, "swarm", 0.7, 0.5, 0.6, 2), stars: [WIN, hp(140), rounds(15)] },
  // Griffin Knight joins here: a sky full of harriers and outriders is where a griffin earns its keep.
  { name: "Gull Rock", foe: "Fowler Hesk", line: "The sea wind puts its weight behind Hesk's arrows.", foeHp: 400, power: 0.82,
    foeRoster: ["harrier", "outrider", "ranger", "ballista", "lamp", "bulwark", "pikeman", "shade"],
    mods: [undefined, { kindDmg: { ranger: 1.2, outrider: 1.2, ballista: 1.2, harrier: 1.2 } }],
    ai: ai(0.96, "artillery", 0.35, 0.5, 0.8, 2), stars: [WIN, losses(4), hp(140)] },
  { name: "Wreckers' Beach", foe: "Mother Gannet", line: "Gannet buries powder under every dune.", foeHp: 400, power: 1.05,
    foeRoster: ["mine", "sapper", "keg", "grenadier", "thorn", "bulwark", "tinker", "bombard"], mods: [undefined, { bigMines: true }],
    obstacles: [{ x: 1.6, y: 6.6, r: 0.5 }, { x: 4.5, y: 7.6, r: 0.6 }, { x: 7.4, y: 6.6, r: 0.5 }],
    ai: ai(0.96, "ambush", 0.5, 0.5, 0.8, 2), stars: [WIN, hp(130), rounds(16)] },
  { name: "Undertow", foe: "Siltmaster Dree", line: "The undertow drags at your boots.", foeHp: 400, power: 0.8,
    foeRoster: ["hook", "thorn", "rime", "pikeman", "bulwark", "storm", "medic", "ballista"], mods: [{ speedMul: 0.9 }, undefined],
    ai: ai(0.97, "fortress", 0.3, 0.55, 0.5, 2), stars: [WIN, losses(4), hp(130)] },
  // Tidecaller joins here: Ysolde's storms and healers are the board the tide is built to break.
  { name: "Squall Line", foe: "Stormcaller Ysolde", line: "Every squall quickens her casters.", foeHp: 400, power: 0.78,
    foeRoster: ["storm", "grave", "rime", "thorn", "medic", "lamp", "bulwark", "hive"], mods: [undefined, { cooldownMul: 0.85 }],
    ai: ai(0.97, "balanced", 0.55, 0.5, 0.6, 2), stars: [WIN, rounds(16), losses(5)] },
  { name: "The Saltwind Light", foe: "Lightkeeper Orrin", line: "The gale is at his back. Not yours.", foeHp: 400, power: 0.76, boss: true,
    startGold: [14, 0], supply: [2, 1], mods: [{ speedMul: 0.9 }, { speedMul: 1.2 }],
    obstacles: [{ x: 1.2, y: 6.8, r: 0.6 }, { x: 3.4, y: 7.6, r: 0.5 }, { x: 5.6, y: 7.6, r: 0.5 }, { x: 7.8, y: 6.8, r: 0.6 }],
    start: [undefined, [{ kind: "lamp", lx: 4.5, depth: 1.4, rank: 2 }, { kind: "ballista", lx: 2.6, depth: 0.9 }, { kind: "ballista", lx: 6.4, depth: 0.9 },
      { kind: "outrider", lx: 2, depth: 3.4, rank: 2 }, { kind: "harrier", lx: 7, depth: 3.4 }, { kind: "hook", lx: 4.5, depth: 4.8, rank: 2 }]],
    foeRoster: ["ballista", "outrider", "harrier", "hook", "lamp", "pikeman", "storm", "medic", "bulwark"],
    ai: ai(0.98, "artillery", 0.45, 0.55, 0.6, 2), stars: [WIN, hp(120), losses(5)] },

  // ---------------------------------------------------------------- Act 10: Crownfall Citadel
  // The finale: a ruined high fortress at dusk. The last rival's court brings back the old bosses' tricks.
  { name: "The Broken Gate", foe: "Gatewarden Hollis", line: "The old guard still holds the broken gate.", foeHp: 400, power: 0.9, noReroll: true,
    foeRoster: ["bulwark", "golem", "pikeman", "hook", "medic", "ballista", "tinker", "lamp"], mods: [undefined, { kindHp: { bulwark: 1.2, golem: 1.2, pikeman: 1.2 } }],
    obstacles: [{ x: 3, y: 7, r: 0.55 }, { x: 6, y: 7, r: 0.55 }],
    ai: ai(0.98, "fortress", 0.3, 0.55, 0.5, 2), stars: [WIN, hp(120), rounds(16)] },
  { name: "Ember Stair", foe: "Pyre-Sergeant Calder", line: "Calder rolls fire down every step.", foeHp: 400, power: 0.86,
    foeRoster: ["keg", "grenadier", "bombard", "sapper", "storm", "bulwark", "medic", "ranger"], mods: [undefined, { kindDmg: { keg: 1.2, grenadier: 1.2, bombard: 1.2 } }],
    obstacles: [{ x: 2, y: 6.5, r: 0.45 }, { x: 4.5, y: 7.3, r: 0.5 }, { x: 7, y: 6.5, r: 0.45 }],
    ai: ai(0.98, "siege", 0.5, 0.5, 0.5, 2), stars: [WIN, losses(5), hp(120)] },
  // Lionheart joins here: Isolde's banner line is the wall a lion is made to charge.
  { name: "Fallen Banners", foe: "Banneret Isolde", line: "Her banners mend what your blades break.", foeHp: 400, power: 1.08,
    foeRoster: ["banner", "medic", "lamp", "duelist", "blades", "ravager", "bulwark", "trickster"], mods: [undefined, { healMul: 1.4 }],
    ai: ai(0.98, "balanced", 0.6, 0.5, 0.6, 2), stars: [WIN, rounds(17), hp(110)] },
  { name: "Hall of Echoes", foe: "Duellist Corvane", line: "The hall falls at dusk. Finish it first.", foeHp: 400, power: 1.04, maxRounds: 14,
    foeRoster: ["duelist", "shade", "trickster", "ravager", "outrider", "harrier", "lancer", "banner"],
    ai: ai(0.99, "blitz", 0.85, 0.4, 0.7, 2), stars: [WIN, losses(4), hp(110)] },
  { name: "Last Light", foe: "Chancellor Vesk", line: "Vesk spends the whole treasury on one army.", foeHp: 400, power: 0.76,
    startGold: [0, 6],
    foeRoster: ["golem", "bombard", "storm", "hive", "grave", "lamp", "hook", "banner", "ballista"],
    ai: ai(0.99, "siege", 0.5, 0.6, 0.5, 2), stars: [WIN, hp(100), rounds(17)] },
  { name: "Crownfall", foe: "King Aurel the Last", line: "Every rival you beat lent him one trick.", foeHp: 400, power: 0.84, boss: true,
    startGold: [16, 0], supply: [2, 1], mods: [undefined, { broodStart: true, litStart: true, bigMines: true }],
    obstacles: [{ x: 1.4, y: 7.2, r: 0.55 }, { x: 3.2, y: 6.4, r: 0.5 }, { x: 5.8, y: 6.4, r: 0.5 }, { x: 7.6, y: 7.2, r: 0.55 }],
    start: [undefined, [{ kind: "golem", lx: 4.5, depth: 4.8, rank: 2 }, { kind: "hive", lx: 3, depth: 1.2, rank: 2 }, { kind: "lamp", lx: 4.5, depth: 2.4, rank: 2 },
      { kind: "mine", lx: 2.4, depth: 5.6 }, { kind: "mine", lx: 6.6, depth: 5.6 }, { kind: "ravager", lx: 6.4, depth: 3.6 }, { kind: "banner", lx: 6, depth: 1.4 }]],
    foeRoster: ["golem", "hive", "lamp", "ravager", "banner", "storm", "bombard", "hook", "medic", "mine"],
    ai: ai(1, "balanced", 0.6, 0.55, 0.6, 2), stars: [WIN, hp(100), losses(6)] },
];

/** Builds a level from its draft; `power` overrides the tuned foe strength (for the balance tool). */
export function buildLevel(index: number, power?: number): LevelDef {
  const { foeHp, hp: hpPair, power: tuned = 1, mods, ...d } = DRAFTS[index];
  const id = index + 1;
  const fresh = UNLOCKS.filter(([at]) => at === id).map(([, k]) => k);
  const unlock = fresh[0];
  const p = power ?? tuned;
  const foeMods = mods?.[1] ?? {};
  const scaled = p === 1 ? mods?.[1] : { ...foeMods, hpMul: +((foeMods.hpMul ?? 1) * p).toFixed(3), dmgMul: +((foeMods.dmgMul ?? 1) * p).toFixed(3) };
  const out: LevelDef = { id, act: Math.floor(index / 6) + 1, roster: rosterAt(id), unlock, hp: hpPair ?? [400, foeHp], ...d };
  if (fresh.length > 1) out.unlocks = fresh;
  if (mods?.[0] || scaled) out.mods = [mods?.[0], scaled];
  return out;
}

export const LEVELS: LevelDef[] = DRAFTS.map((_, i) => buildLevel(i));
export const levelPower = (id: number) => DRAFTS[id - 1].power ?? 1;
