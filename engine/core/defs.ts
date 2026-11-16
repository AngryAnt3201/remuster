// World, units and economy. World units: the board is 9 wide and 14 deep; "1 unit" of distance is 1.0.
// Side 0 is the player at the bottom (forward = -y), side 1 the opponent at the top (forward = +y).

export const W = 9;
export const H = 14;
export const DT = 1 / 30;
export const BATTLE_LIMIT = 45; // seconds of battle before it is called on what is left
export const ZONE_DEPTH = 5.9; // how far from its back edge a side may deploy
export const EDGE = 0.5; // gap kept from the board edges

export type Side = 0 | 1;
export type UnitKind =
  | "mine" | "blades" | "ranger" | "bulwark" | "medic" | "grenadier"
  | "shade" | "lancer" | "ballista" | "hive" | "storm" | "golem"
  | "sapper" | "harrier" | "banner" | "rime" | "ravager" | "grave"
  | "bombard" | "tinker" | "duelist" | "pikeman" | "keg" | "trickster"
  | "hook" | "thorn" | "outrider" | "lamp"
  | "griffin" | "tide" | "lion";
/** Bodies that exist only in battle. */
export type SpawnKind = "mite" | "golemling" | "thrall" | "turret" | "decoy" | "queen";
export type BodyKind = UnitKind | SpawnKind;
export type Role = "trap" | "melee" | "ranged" | "tank" | "support" | "artillery" | "assassin" | "cavalry" | "structure" | "caster" | "spawner" | "siege" | "air";

export interface UnitDef {
  kind: UnitKind;
  name: string;
  short: string; // one line for the shop card
  role: Role;
  cost: number;
  hp: number;
  dmg: number;
  range: number; // attack reach (edge to edge for melee, centre to centre for ranged)
  speed: number; // units per second
  radius: number;
  cooldown: number;
  bodies?: number;
  structure?: boolean;
  /** Damage it does to the opposing commander when it survives a won round, per body. */
  threat: number;
}

export const UNITS: Record<UnitKind, UnitDef> = {
  mine: { kind: "mine", name: "Mine", short: "Hidden. Blows up in a 1-unit radius.", role: "trap", cost: 2, hp: 1, dmg: 130, range: 1.0, speed: 0, radius: 0.22, cooldown: 0, threat: 0 },
  blades: { kind: "blades", name: "Blade Trio", short: "Three swords that hunt as a pack.", role: "melee", cost: 3, hp: 95, dmg: 17, range: 0.5, speed: 1.7, radius: 0.24, cooldown: 0.85, bodies: 3, threat: 1 },
  ranger: { kind: "ranger", name: "Ranger", short: "Long bow. Backs off when rushed.", role: "ranged", cost: 3, hp: 75, dmg: 24, range: 4.2, speed: 1.6, radius: 0.25, cooldown: 1.1, threat: 2 },
  bulwark: { kind: "bulwark", name: "Bulwark", short: "Shield wall. Guards whoever is in danger.", role: "tank", cost: 4, hp: 400, dmg: 22, range: 0.45, speed: 1.0, radius: 0.4, cooldown: 1.2, threat: 3 },
  medic: { kind: "medic", name: "Medic", short: "Heals the most hurt. Hides behind the line.", role: "support", cost: 3, hp: 85, dmg: 0, range: 2.2, speed: 1.6, radius: 0.25, cooldown: 1.0, threat: 1 },
  grenadier: { kind: "grenadier", name: "Grenadier", short: "Lobs bombs where enemies bunch up.", role: "artillery", cost: 4, hp: 85, dmg: 50, range: 5.0, speed: 1.3, radius: 0.27, cooldown: 2.6, threat: 2 },
  shade: { kind: "shade", name: "Shade", short: "Cloaked flanker. Blinks behind the weakest.", role: "assassin", cost: 4, hp: 110, dmg: 21, range: 0.45, speed: 2.3, radius: 0.24, cooldown: 0.8, threat: 3 },
  lancer: { kind: "lancer", name: "Lancer", short: "Charges through lines, wheels round, again.", role: "cavalry", cost: 4, hp: 245, dmg: 60, range: 0.3, speed: 4.6, radius: 0.36, cooldown: 0, threat: 3 },
  ballista: { kind: "ballista", name: "Ballista", short: "Fixed bolt thrower. Pierces a whole line.", role: "structure", cost: 3, hp: 210, dmg: 40, range: 6.5, speed: 0, radius: 0.42, cooldown: 2.9, structure: true, threat: 2 },
  hive: { kind: "hive", name: "Hive", short: "Breeds mites that swarm the nearest foe.", role: "spawner", cost: 4, hp: 270, dmg: 0, range: 0, speed: 0, radius: 0.45, cooldown: 2.2, structure: true, threat: 3 },
  storm: { kind: "storm", name: "Stormcaller", short: "Lightning that jumps between enemies.", role: "caster", cost: 5, hp: 115, dmg: 35, range: 3.6, speed: 1.4, radius: 0.27, cooldown: 2.2, threat: 4 },
  golem: { kind: "golem", name: "Stone Colossus", short: "Slow giant. Breaks into two when it falls.", role: "siege", cost: 5, hp: 400, dmg: 40, range: 0.95, speed: 0.75, radius: 0.55, cooldown: 2.0, threat: 5 },
  sapper: { kind: "sapper", name: "Sapper", short: "Tunnels to their back line and bursts up.", role: "assassin", cost: 4, hp: 185, dmg: 30, range: 0.45, speed: 2.0, radius: 0.26, cooldown: 0.9, threat: 3 },
  harrier: { kind: "harrier", name: "Harrier", short: "Flies. Only shots and spells can reach it.", role: "air", cost: 4, hp: 150, dmg: 34, range: 0.2, speed: 3.0, radius: 0.3, cooldown: 1.7, threat: 3 },
  banner: { kind: "banner", name: "Standard Bearer", short: "Allies near the flag strike faster.", role: "support", cost: 3, hp: 210, dmg: 16, range: 0.45, speed: 1.5, radius: 0.27, cooldown: 1.2, threat: 1 },
  rime: { kind: "rime", name: "Rimecaller", short: "Frost shards that slow whatever they hit.", role: "caster", cost: 4, hp: 105, dmg: 28, range: 3.8, speed: 1.4, radius: 0.27, cooldown: 1.5, threat: 3 },
  ravager: { kind: "ravager", name: "Ravager", short: "Hunts the toughest. Faster as it bleeds.", role: "melee", cost: 4, hp: 275, dmg: 26, range: 0.45, speed: 1.9, radius: 0.3, cooldown: 1.0, threat: 3 },
  grave: { kind: "grave", name: "Gravecaller", short: "Raises the fallen nearby as bone thralls.", role: "spawner", cost: 4, hp: 190, dmg: 0, range: 3.0, speed: 1.3, radius: 0.28, cooldown: 0.6, threat: 2 },
  bombard: { kind: "bombard", name: "Bombard", short: "Fixed mortar. Huge reach, blind up close.", role: "structure", cost: 4, hp: 220, dmg: 66, range: 8, speed: 0, radius: 0.42, cooldown: 4.6, structure: true, threat: 2 },
  tinker: { kind: "tinker", name: "Tinker", short: "Builds a turret and patches up structures.", role: "support", cost: 3, hp: 110, dmg: 10, range: 0.4, speed: 1.5, radius: 0.26, cooldown: 1.0, threat: 1 },
  duelist: { kind: "duelist", name: "Duelist", short: "Parries a blow and strikes back. Hunts melee.", role: "melee", cost: 3, hp: 140, dmg: 24, range: 0.45, speed: 2.0, radius: 0.25, cooldown: 0.8, threat: 2 },
  pikeman: { kind: "pikeman", name: "Pikeman", short: "Long reach. Braces and stops a charge cold.", role: "tank", cost: 3, hp: 210, dmg: 20, range: 1.0, speed: 1.25, radius: 0.28, cooldown: 1.25, threat: 2 },
  keg: { kind: "keg", name: "Kegrunner", short: "Sprints into the thickest crowd and blows.", role: "siege", cost: 3, hp: 110, dmg: 140, range: 1.35, speed: 3.8, radius: 0.24, cooldown: 0, threat: 1 },
  trickster: { kind: "trickster", name: "Trickster", short: "Throws out decoys that soak up attacks.", role: "assassin", cost: 4, hp: 120, dmg: 25, range: 0.45, speed: 2.2, radius: 0.25, cooldown: 0.8, threat: 3 },
  hook: { kind: "hook", name: "Hookwarden", short: "Chains a back-liner and drags it into the line.", role: "tank", cost: 4, hp: 310, dmg: 24, range: 0.5, speed: 1.25, radius: 0.3, cooldown: 1.1, threat: 3 },
  thorn: { kind: "thorn", name: "Thornweaver", short: "Sows brambles where the enemy is heading.", role: "caster", cost: 4, hp: 120, dmg: 22, range: 4.2, speed: 1.35, radius: 0.26, cooldown: 3.0, threat: 3 },
  outrider: { kind: "outrider", name: "Outrider", short: "Mounted bow. Rides rings round its prey.", role: "ranged", cost: 4, hp: 165, dmg: 19, range: 3.4, speed: 3.0, radius: 0.34, cooldown: 1.0, threat: 3 },
  lamp: { kind: "lamp", name: "Lamplighter", short: "Lantern wards soak the next blows.", role: "support", cost: 3, hp: 130, dmg: 10, range: 2.6, speed: 1.5, radius: 0.25, cooldown: 5.0, threat: 1 },
  griffin: { kind: "griffin", name: "Griffin Knight", short: "Dives on their back line and stuns where it lands.", role: "air", cost: 5, hp: 260, dmg: 32, range: 0.25, speed: 2.6, radius: 0.32, cooldown: 1.15, threat: 4 },
  tide: { kind: "tide", name: "Tidecaller", short: "Calls a wave down a lane that sweeps foes back.", role: "caster", cost: 5, hp: 170, dmg: 50, range: 5.0, speed: 1.35, radius: 0.27, cooldown: 3.4, threat: 4 },
  lion: { kind: "lion", name: "Lionheart", short: "Hero duelist. Each kill rallies allies and heals him.", role: "melee", cost: 5, hp: 400, dmg: 34, range: 0.5, speed: 1.8, radius: 0.3, cooldown: 0.95, threat: 4 },
};

export interface BodyDef { name: string; hp: number; dmg: number; range: number; speed: number; radius: number; cooldown: number; threat: number; }
/** Spawned bodies: `from` is the unit that makes each (whose kind mods and rank they share); `value` counts toward Battle.result(). */
export const BODY_EXTRA: Record<SpawnKind, BodyDef & { from: UnitKind; value: number }> = {
  mite: { name: "Mite", hp: 22, dmg: 6, range: 0.15, speed: 2.9, radius: 0.15, cooldown: 0.5, threat: 0, from: "hive", value: 0.3 },
  golemling: { name: "Shardling", hp: 100, dmg: 22, range: 0.6, speed: 1.05, radius: 0.36, cooldown: 1.4, threat: 1, from: "golem", value: 2 },
  thrall: { name: "Bone Thrall", hp: 80, dmg: 11, range: 0.25, speed: 1.7, radius: 0.22, cooldown: 0.9, threat: 0, from: "grave", value: 0.6 },
  turret: { name: "Turret", hp: 110, dmg: 11, range: 3.6, speed: 0, radius: 0.24, cooldown: 0.75, threat: 0, from: "tinker", value: 1 },
  decoy: { name: "Decoy", hp: 40, dmg: 0, range: 0, speed: 2.2, radius: 0.25, cooldown: 1, threat: 0, from: "trickster", value: 0 },
  queen: { name: "Brood Queen", hp: 170, dmg: 14, range: 0.2, speed: 2.5, radius: 0.21, cooldown: 0.55, threat: 0, from: "hive", value: 1.2 },
};
export const isSpawn = (k: BodyKind): k is SpawnKind => k in BODY_EXTRA;
/** Base stats for any body kind (a unit's or a spawned body's). */
export const bodyDef = (k: BodyKind): BodyDef => (isSpawn(k) ? BODY_EXTRA[k] : UNITS[k]);

/** Rank 4 (Ascended) signature abilities, for cards and tooltips. */
export const ABILITIES: Record<UnitKind, { name: string; text: string }> = {
  mine: { name: "Cluster", text: "The blast scatters three bomblets that go off a moment later." },
  blades: { name: "Whirlwind", text: "Every third slash spins all the way round." },
  ranger: { name: "Volley", text: "Every fourth shot looses three arrows in a fan." },
  bulwark: { name: "Bastion", text: "Allies just behind the shield take 30% less damage. Bashes stun longer." },
  medic: { name: "Revive", text: "Once a battle, the first nearby ally to fall gets back up at half health." },
  grenadier: { name: "Firebomb", text: "Bombs leave the ground burning for 3 seconds." },
  shade: { name: "Shadow Step", text: "A kill readies the next blink at once." },
  lancer: { name: "Trample", text: "Charges plough through big units and stun everything they pass." },
  ballista: { name: "Twin Bolt", text: "Fires two bolts in a narrow spread." },
  hive: { name: "Brood Queen", text: "Hatches one tough queen. Mites burst when they die." },
  storm: { name: "Overcharge", text: "Lightning jumps three more times and stuns for longer." },
  golem: { name: "Quake", text: "Every third slam shakes the ground wide and stuns." },
  sapper: { name: "Cave-in", text: "Bursts up twice as wide, hurting all it throws." },
  harrier: { name: "Talon Dive", text: "Dives hit everything underneath and knock it back." },
  banner: { name: "Rally", text: "The flag also adds 20% damage and slowly heals." },
  rime: { name: "Deep Freeze", text: "Every third shard freezes its target solid." },
  ravager: { name: "Bloodlust", text: "Heals for a fifth of the damage it deals." },
  grave: { name: "Ossuary", text: "Tougher thralls, and one rises every 6 seconds regardless." },
  bombard: { name: "Shrapnel", text: "Shells burst into four more on landing." },
  tinker: { name: "Workshop", text: "Keeps two turrets up, and they fire faster." },
  duelist: { name: "Perfect Parry", text: "Parries twice as often. Ripostes always crit." },
  pikeman: { name: "Hedgehog", text: "Holds its pikes up against any melee and throws back 30% of the harm." },
  keg: { name: "Chain Keg", text: "Drops a second keg that blows a second later." },
  trickster: { name: "Mirror Hall", text: "Four decoys, and they explode when struck." },
  hook: { name: "Iron Tether", text: "Hooks two foes at once and holds each catch stunned for a second." },
  thorn: { name: "Bramble Crown", text: "Patches grow wider, last longer and seize whatever they sprout under." },
  outrider: { name: "Running Fire", text: "Looses two arrows a shot, at two different foes when it can." },
  lamp: { name: "Beacon", text: "Wards four allies, and a ward that breaks bursts and dazzles foes nearby." },
  griffin: { name: "Second Dive", text: "Below half health it climbs and dives on their back line once more." },
  tide: { name: "Riptide", text: "The wave leaves slowing surf along its lane." },
  lion: { name: "Last Stand", text: "Once a battle, a fatal blow leaves him on 1 health, unkillable for 2.5 s." },
};

export const UNIT_KINDS = Object.keys(UNITS) as UnitKind[];

/** Rank multipliers: ranks 2-4 are bought as upgrades; rank 4 (Ascended) is rank 3 x1.15 plus an ability. */
export const MAX_RANK = 4;
/** Ascending (rank 3 to 4) is only offered from this round on. */
export const ASCEND_ROUND = 5;
const ASCEND = 1.15;
export const rankHp = (rank: number) => (rank >= 4 ? (1 + 0.65 * 2) * ASCEND : 1 + 0.65 * (rank - 1));
export const rankDmg = (rank: number) => (rank >= 4 ? (1 + 0.5 * 2) * ASCEND : 1 + 0.5 * (rank - 1));
/** Cost to go from `rank` to rank+1: cost, 2x cost, then 3x cost to Ascend. */
export const upgradeCost = (kind: UnitKind, rank: number) => (rank >= MAX_RANK ? Infinity : UNITS[kind].cost * rank);

// ---------------------------------------------------------------- economy
export const START_HP = 400;
export const SHOP_SIZE = 4;
export const REROLL_COST = 1;
export const GOLD_CAP = 30;
export const incomeFor = (round: number) => Math.min(3 + round, 10);
export const supplyFor = (round: number) => Math.min(2 + round, 12);
/** Commander damage when a round is lost: a base that grows, plus each surviving enemy's threat. */
export const roundBase = (round: number) => 3 + 2 * round + (round > 12 ? 4 * (round - 12) : 0);

/** Side-local coordinates: lx across, depth forward from the back edge of the side's zone. */
export function toWorld(side: Side, lx: number, depth: number): { x: number; y: number } {
  return { x: lx, y: side === 0 ? H - EDGE - depth : EDGE + depth };
}
export function toLocal(side: Side, x: number, y: number): { lx: number; depth: number } {
  return { lx: x, depth: side === 0 ? H - EDGE - y : y - EDGE };
}
export function clampToZone(side: Side, x: number, y: number, r = 0.3): { x: number; y: number } {
  const cx = Math.max(EDGE - 0.2 + r, Math.min(W - EDGE + 0.2 - r, x));
  const { depth } = toLocal(side, cx, y);
  const d = Math.max(r * 0.5, Math.min(ZONE_DEPTH, depth));
  return toWorld(side, cx, d);
}
export function inZone(side: Side, x: number, y: number): boolean {
  const { depth } = toLocal(side, x, y);
  return x >= EDGE - 0.2 && x <= W - EDGE + 0.2 && depth >= -0.3 && depth <= ZONE_DEPTH + 0.05;
}

/** A unit bought and placed on the board; it stays between rounds. */
export interface Piece {
  id: number;
  kind: UnitKind;
  side: Side;
  x: number;
  y: number;
  rank: number;
  spent: number;
}

export interface Obstacle { x: number; y: number; r: number; }

/** Per-side modifiers (Gauntlet boons, campaign handicaps). */
export interface Mods {
  hpMul?: number;
  dmgMul?: number;
  speedMul?: number;
  kindHp?: Partial<Record<UnitKind, number>>;
  kindDmg?: Partial<Record<UnitKind, number>>;
  income?: number;
  freeRerolls?: number;
  supply?: number;
  healMul?: number;
  cooldownMul?: number;
  /** Mines also stun for longer and hit 25% wider. */
  bigMines?: boolean;
  /** Hives start with two mites. */
  broodStart?: boolean;
  /** Every unit (not mines) starts each battle behind a lantern ward. */
  litStart?: boolean;
}
