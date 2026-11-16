# Arena

Arena is the same match loop as the rest of the game (buy from the shop, place in your half, watch the battle, lose
health when you lose a round), fought on maps with real structure against AI opponents on a trophy ladder.

Where things live:

| | |
| --- | --- |
| `engine/core/terrain.ts` | The contract: block kinds, what each blocks, `Block`, `BlockState`, geometry helpers, `mirrorBlock`. |
| `engine/core/nav.ts` | Terrain queries for the sim (line of sight, shot stops, swept collision, free spots) and navigation (clearance grid + A*). |
| `engine/core/battle.ts` | The rules below. Everything terrain is behind `if (this.nav)`: a battle without `terrain` runs exactly as before. |
| `engine/core/placement.ts` | Where a piece may stand: `freeSpotIn`, `spotBlocked`, `footprint`. |
| `engine/core/arena.ts` | The 12 arenas, 4 leagues, opponents, trophy maths, `arenaConfig`. Pure. |
| `engine/progression/troops.ts` | The device save binding: `arenaLadder`, `nextArenaMatch`, `awardArena`. |
| `tools/arena-balance.ts` | AI-vs-AI balance run (table at the end of this file). |
| `tests/terrain.test.ts`, `tests/arena.test.ts` | The proof. |

## Blocks

Axis-aligned rectangles in world units (board 9 x 14). Five kinds:

| kind | ground units | direct shots, chains | lobbed shots, fliers, burrowers | sight | breaks |
| --- | --- | --- | --- | --- | --- |
| `wall` | blocked | blocked | pass over / under | blocked | never |
| `building` | blocked | blocked | pass over / under | blocked | never |
| `barricade` | blocked | blocked | pass over / under | blocked | yes, 320 hp |
| `cover` | blocked | pass, weakened | pass | clear | yes, 160 hp |
| `water` | blocked | pass | pass | clear | never |

`building` is `wall` with a different picture. A block can override its health with `hp`. A broken block is rubble:
it blocks nothing.

## Rules

**Movement.** Ground bodies cannot enter a block. Each step a body's whole move (walking, knockback, a wave's shove, a
hook's reel) is swept against the blocks from where it stood when the step began, so nothing tunnels at any speed; it
slides along what it hits. Flying bodies (Harrier always; Griffin Knight while it soars) and burrowed Sappers ignore
blocks. Fixed structures and mines never move, and are never placed on a block.

**Navigation.** When a block stands on the straight line to where a body is heading, it follows a route round: A* on
a 0.25-unit clearance grid, sized to the body's radius, pulled straight into a few corner waypoints. A route is cached
per body and planned again only when a block breaks, when the goal moves out of sight of the route's last corner, when
the body is shoved off it, or after 2.5 s. A gap is open to a body if the gap is at least as wide as the body (to the
grid's 0.25 resolution: keep gaps at 1.25 or wider if the Stone Colossus, 1.1 across, is meant to fit). A body
fleeing (no destination) turns aside rather than press into a block.

**Sight.** Walls, buildings and barricades block sight; cover and water do not. Sight is a straight line between
centres. Anything in the air sees and is seen over everything.
- Every unit attacks the nearest enemy it can see. With nobody in sight it heads for the nearest enemy anyway (round
  the blocks), and re-picks as soon as someone comes into view.
- Nothing can be struck hand to hand through a block that blocks sight, however thin; a mine does not trigger through
  one; a Bulwark does not taunt through one; nobody flees from an enemy on the other side of one.

**Direct fire.** Arrows, bolts, frost shards and pellets (Ranger, Outrider, Ballista, Rimecaller, turret,
Lamplighter sparks) need a line of sight to be loosed: a shooter with none closes in until it has one. In flight they
stop on the first wall, building or barricade they meet (`ricochet`), and a barricade takes the shot's damage. A
Ballista bolt pierces bodies as before, up to the wall. A shot loosed at something in the air flies over everything
(`Proj.over`).

**Cover.** A direct shot whose line from the shooter crosses a `cover` block standing within 0.9 (`COVER_REACH`,
block edge to target centre) of its target, and nearer the target than the shooter, does 60% damage (`COVER_KEEP`).
The other 40% comes off the cover's health (`blockhit`), so cover wears out under fire. Only one cover block counts
per shot. Targets in the air get no cover. Cover blocks movement like any block but never sight, melee or spells.

**Lobbed fire.** Grenades and shells (Grenadier, Bombard) need no line of sight and fly over everything. A lob aimed
at a point inside a wall, building or barricade lands on the nearest free ground beside it.

**Blasts.** An explosion (mine, grenade, shell, shrapnel, bomblet, keg, Colossus slam and quake, sapper eruption,
Talon Dive, Griffin swoop, Mirror Hall, Beacon ward burst, mite pop) does not reach a body that is fully behind a
wall, building or barricade from the blast's centre: fully means its centre and both flanks are out of sight. The same
goes for a Blade Trio's slash arc. Explosions proper (mine, grenade, shell, shrapnel, bomblet, keg, slam, quake, mite
pop, Mirror Hall) also damage barricades and cover within their radius; Colossus slams and keg blasts do triple
(`SIEGE_MUL`). Eruptions, dives, swoops and ward bursts do not damage blocks.

**Breaking through.** Melee bodies (anything that fights hand to hand, including mites, thralls and Shardlings) may
route through a barricade or cover: the route planner prices breaking a block at 1 unit of walking per 32 health for
most (a fresh barricade is worth a 10-unit detour, cover 5), and per 200 health for siege (Stone Colossus, Kegrunner:
under 2 units), so siege goes straight through and others break in only when there is no other way or the way round is
long. A body on such a route walks up to the block and hits it on its attack cooldown for its damage (Colossus: x3);
a Kegrunner blows itself up on it. Shooters and support never break in: to them a barricade is a wall.

**Charges.** A Lancer only starts a charge when its straight run to the target is clear of blocks; otherwise it trots
round until it is. A charge that runs into a block (it overshoots its mark by 2 units) ends there: `crash`, 0.6 s
stun, no damage to anything behind the block.

**Fairness.** Arenas are symmetric under a half turn, and so is everything that decides a battle on one: side 1's
route search runs turned half round (`Nav.path(..., flip)`), free-spot searches are mirrored, and in an arena the AI
lays out side 1's formation as the mirror image of side 0's. (Before this, with identical AIs, Twin Gates went 71/29
to side 0 over 24 matches; after it every arena is within noise of 50/50, see Balance.)

**Known limits.** Routes avoid blocks, not bodies: a fixed structure parked in a narrow gap plugs it for anything too
wide to squeeze past (the AI sees this in its simulations; a player can do it to themselves). The 0.25 grid means a
gap between 1.1 and 1.25 wide may or may not admit the Colossus depending on where it falls on the grid: build arenas
with gaps of 1.25 or more, or under 1.0 to shut it out. Terrain arrays are treated as immutable (clearance fields are
cached per array): to change an arena's blocks pass a new array.

## Every unit, in an arena

| unit | what changes |
| --- | --- |
| Mine | Never placed on a block. Triggers only on an enemy it has sight of; its blast is shadowed by walls. |
| Blade Trio, Duelist, Ravager, Lionheart, Bulwark, Pikeman, Hookwarden (melee) | Path round blocks; no strikes through walls; may break barricades and cover when that is the best way in. |
| Ranger, Outrider, Rimecaller | Direct fire: sight needed, shots stop on walls, weakened by cover. Volley side arrows that find no target fly straight and stop on walls. |
| Medic | A heal needs sight of the patient (the splash to allies beside the patient does not). Revive (Ascended) works through walls. |
| Grenadier, Bombard | Lobbed: no sight needed, over everything. Blasts shadowed by walls and wear down barricades and cover. |
| Shade | Paths round blocks while cloaked. The blink needs no sight; it lands on the nearest free ground beside the mark, on the mark's side of any block. |
| Lancer | See Charges. |
| Ballista, turret | Fixed: shoot only what they can see. Bolts stop on walls. |
| Hive | Mites hatch on free ground on the hive's side of any block and path like any melee body (they can gnaw through a barricade when walled in). |
| Stormcaller | The first target needs sight, and so does each jump (from the last body struck to the next). |
| Stone Colossus | Siege: breaks barricades and cover in its way rather than walk round (x3 damage to them). Needs gaps 1.25 wide. Shardlings appear on free ground and are ordinary melee. |
| Sapper | Tunnels under everything; surfaces on the nearest free ground, never inside a block. Its eruption is shadowed by walls. |
| Harrier | Flies over everything; sight never blocked to or from it. |
| Gravecaller | Raising needs no sight (within 3 units, through walls). A thrall rises on the nearest free ground to the fallen body; an Ossuary thrall on the Gravecaller's side of any block. |
| Tinker | The turret is built on free ground on the Tinker's side of any block. Repairs are hand to hand (no repairing through a wall). |
| Kegrunner | Siege: paths to the crowd like any ground unit; if a barricade or cover is in its way it blows itself up on it (x3 to blocks, enough to break a fresh barricade). |
| Trickster | Decoys appear on free ground on the Trickster's side of any block and path like ground units. |
| Hookwarden | The chain is a direct shot: it is only thrown at a mark in sight, and if the mark steps behind a wall before it lands the chain stops on the wall (`ricochet`, kind `hook`). A reeled body slides along blocks and is let go after 1.4 s if it snags. |
| Thornweaver | Sown like a lob: no sight needed. Brambles (and Firebomb flames, Riptide surf) are ground effects: they reach everything inside the patch, walls or not. |
| Lamplighter | A ward needs sight of the ally. Its sparks are direct fire. A Beacon burst is a blast (shadowed). |
| Standard Bearer, Lionheart rally, Bastion | Auras reach through walls. The Standard Bearer itself paths round blocks and, like all support, never breaks in. |
| Griffin Knight | Soars over everything; lands on the nearest free ground on its mark's side of any block, then fights as a ground body. |
| Tidecaller | The wave rolls its whole lane, over water and cover, but breaks on walls, buildings and barricades: a body with one of those between it and the wave's start line (straight up the lane) is sheltered, and the Tidecaller does not count sheltered bodies when picking a lane. With no sight of the nearest enemy it keeps closing in. Waves do not damage blocks. |

## Placement

No piece can be bought, placed or moved onto a block. `match.freeSpot(side, kind, x, y)` returns where a piece dropped
at (x, y) would stand: clamped into the zone and, if a block is in the way, moved to the nearest free spot still in the
zone (searching outward in rings, straight back first); null if the zone has none within 7 units, in which case
`buy` and `move` throw `"No room"`. A Blade Trio needs room for its whole triangle (`footprint`). `Match` applies the
same rule to `cfg.start` pieces, and `Battle` itself moves any body that would start on a block, so the sim can never
begin with one inside. The AI's formations go through the same function; half of its exploring candidates also try a
terrain-aware variation (`shelter` in ai.ts: shooters behind cover, lobbers and support behind walls) and the
simulation decides whether it is worth it. Measured: left to the plain formations the AI had 3-7% of its shooters
behind cover (it does not find cover by chance); with the variation 25-29%, at no cost in results (36 matches to 34
and 53% of rounds against the same AI without it, 70 matches on the five arenas with the most cover and walls).

## The arenas

Twelve, three to a league. Each is the same after a half turn about the board centre (built with `mirrorBlock`), keeps
at least 90% of each deploy zone free, stays clear of the commander keeps, and has a ground route for the largest
unit (radius 0.55) between any two free spots without breaking anything (tests/arena.test.ts checks all of this).

In the sketches each cell is half a unit; rows run from y 2 (side 1's half, top) to y 12 (side 0's half). `#` wall,
`H` building, `%` barricade, `=` cover, `~` water. Blocks 0.4 deep (cover) show as one row.

### Twin Gates (`twin-gates`, Bronze League)
A wall across the middle with two gates. Hold one, force the other. Zone free: 99%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . = = = . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
# # # . . . . # # # # . . . . # # #   y 6.4: side 1's zone ends
# # # . . . . # # # # . . . . # # # 
. . . . . . . . . . . . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
. . . = = = . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 wall/wall x 0-1.5 y 6.75-7.25; 2 wall/wall x 7.5-9 y 6.75-7.25; 3 cover/crates x 1.75-3 y 8.5-8.9; 4 cover/crates x 6-7.25 y 5.1-5.5; 5 wall/wall x 3.25-5.75 y 6.75-7.25.

### The Crossing (`the-crossing`, Bronze League)
A river with two bridges. Arrows cross the water; boots need a bridge. Zone free: 99%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . = = = = . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
~ ~ ~ . . . ~ ~ ~ ~ ~ ~ . . . ~ ~ ~   y 6.4: side 1's zone ends
~ ~ ~ . . . ~ ~ ~ ~ ~ ~ . . . ~ ~ ~ 
. . . . . . . . . . . . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
. . . . . . . = = = = . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 water/river x 0-1.5 y 6.5-7.5; 2 water/river x 7.5-9 y 6.5-7.5; 3 cover/crates x 3.75-5.25 y 8.4-8.8; 4 cover/crates x 3.75-5.25 y 5.2-5.6; 5 water/river x 3.25-5.75 y 6.5-7.5.

### Crate Yard (`crate-yard`, Bronze League)
Open ground strewn with crates. Shoot from cover, or smash it. Zone free: 96%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . = = = . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . = = = = . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . = = . . . 
. . . . . . . . . . . . = = = = . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . = = . . . . . . . .   y 6.4: side 1's zone ends
. . . . . . . . = = . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 7.6: side 0's zone starts
. . = = = = . . . . . . . . . . . . 
. . . = = . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . = = = = . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . = = = . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 cover/crates x 1.25-2.75 y 8.2-8.7; 2 cover/crates x 6.25-7.75 y 5.3-5.8; 3 cover/crates x 5.75-7.25 y 9.4-9.9; 4 cover/crates x 1.75-3.25 y 4.1-4.6; 5 cover/crates x 3.75-5 y 10.9-11.4; 6 cover/crates x 4-5.25 y 2.6-3.1; 7 cover/crates x 4-5 y 6.7-7.3.

### The Courtyard (`courtyard`, Silver League)
A hall in the middle of a walled yard. Fight round it, never through it. Zone free: 95%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . # # # . . . . . . # # # . . . 
. . . # # # . . . . . . # # # . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . H H . . . . . . . . 
. . . . . . . H H H H . . . . . . .   y 6.4: side 1's zone ends
. . . . . . . H H H H . . . . . . . 
. . . . . . . . H H . . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
. . . # # # . . . . . . # # # . . . 
. . . # # # . . . . . . # # # . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 wall/wall x 1.25-3 y 8.75-9.25; 2 wall/wall x 6-7.75 y 4.75-5.25; 3 wall/wall x 6-7.75 y 8.75-9.25; 4 wall/wall x 1.25-3 y 4.75-5.25; 5 building/hall x 3.75-5.25 y 6.25-7.75.

### Watchtowers (`watchtowers`, Silver League)
Two towers a side and a fence between them. A marksman's ground. Zone free: 94%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . H H . . . . . . . . H H . . . 
. . . H H . . . . . . . . H H . . . 
. . . H H . . . . . . . . H H . . . 
. . . . . . . = = = = . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 6.4: side 1's zone ends
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . = = = = . . . . . . . 
. . . H H . . . . . . . . H H . . . 
. . . H H . . . . . . . . H H . . . 
. . . H H . . . . . . . . H H . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 building/tower x 1.5-2.5 y 8.75-9.75; 2 building/tower x 6.5-7.5 y 4.25-5.25; 3 building/tower x 6.5-7.5 y 8.75-9.75; 4 building/tower x 1.5-2.5 y 4.25-5.25; 5 cover/fence x 3.5-5.5 y 8.2-8.6; 6 cover/fence x 3.5-5.5 y 5.4-5.8.

### Barricade Pass (`barricade-pass`, Silver League)
One narrow gate, and two barricaded passes that siege can open. Zone free: 100%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
# . % % % # # . . . . # # % % % . #   y 6.4: side 1's zone ends
# . % % % # # . . . . # # % % % . # 
. . . . . . . . . . . . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 wall/wall x 0-0.75 y 6.75-7.25; 2 wall/wall x 8.25-9 y 6.75-7.25; 3 barricade/barricade x 0.75-2.5 y 6.75-7.25; 4 barricade/barricade x 6.5-8.25 y 6.75-7.25; 5 wall/wall x 2.5-3.75 y 6.75-7.25; 6 wall/wall x 5.25-6.5 y 6.75-7.25.

### Old Village (`old-village`, Gold League)
Houses and alleys. Lines break up; ambushers and fliers thrive. Zone free: 91%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . H H H H . . . . . . . . . . . 
. . . H H H H . . . . . . . . . . . 
. . . . H H . . . . . . H H H H . . 
. . . . . . . . . . . . H H H H . . 
. . . . . . . . = = . . H H H H . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . H H H . . H H H . . . . .   y 6.4: side 1's zone ends
. . . . . H H H . . H H H . . . . . 
. . . . . . . . . . . . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
. . H H H H . . = = . . . . . . . . 
. . H H H H . . . . . . . . . . . . 
. . H H H H . . . . . . H H . . . . 
. . . . . . . . . . . H H H H . . . 
. . . . . . . . . . . H H H H . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 building/house x 1.25-2.75 y 8.5-10; 2 building/house x 6.25-7.75 y 4-5.5; 3 building/house x 5.75-7.25 y 9.75-11; 4 building/house x 1.75-3.25 y 3-4.25; 5 building/house x 2.75-3.75 y 6.5-7.5; 6 building/house x 5.25-6.25 y 6.5-7.5; 7 cover/fence x 4-5 y 8.55-8.95; 8 cover/fence x 4-5 y 5.05-5.45.

### The Fens (`the-fens`, Gold League)
Ponds break up the ground. Shots fly over the water; boots go round. Zone free: 93%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . ~ ~ ~ ~ . . 
. . ~ ~ ~ ~ . . . . . . ~ ~ ~ ~ . . 
. . ~ ~ ~ ~ . . . . . . . ~ ~ . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . ~ ~ ~ ~ . . . . . . . 
. . . . . . . ~ ~ ~ ~ . . . . . . .   y 6.4: side 1's zone ends
. . . . . . . ~ ~ ~ ~ . . . . . . . 
. . . . . . . ~ ~ ~ ~ . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . ~ ~ . . . . . . . ~ ~ ~ ~ . . 
. . ~ ~ ~ ~ . . . . . . ~ ~ ~ ~ . . 
. . ~ ~ ~ ~ . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 water/pond x 1.25-2.75 y 9.25-10.5; 2 water/pond x 6.25-7.75 y 3.5-4.75; 3 water/pond x 6.25-7.75 y 9-10; 4 water/pond x 1.25-2.75 y 4-5; 5 water/pond x 3.5-5.5 y 6.25-7.75.

### Long Lane (`long-lane`, Gold League)
Two long walls make a firing lane down the middle, with cover at each end. Zone free: 95%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . = = = = . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . = = . 
. . . . . # # . . . . # # . . = = . 
. . . . . # # . . . . # # . . . . . 
. . . . . # # . . . . # # . . . . .   y 6.4: side 1's zone ends
. . . . . # # . . . . # # . . . . . 
. . . . . # # . . . . # # . . . . .   y 7.6: side 0's zone starts
. = = . . # # . . . . # # . . . . . 
. = = . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . = = = = . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 wall/wall x 2.75-3.25 y 5.25-8.75; 2 wall/wall x 5.75-6.25 y 5.25-8.75; 3 cover/fence x 3.75-5.25 y 10-10.4; 4 cover/fence x 3.75-5.25 y 3.6-4; 5 cover/crates x 0.5-1.5 y 8.3-8.7; 6 cover/crates x 7.5-8.5 y 5.3-5.7.

### Bastions (`bastions`, Champion League)
Each side has a wall with a barricaded gate. Go round the flanks, or break in. Zone free: 94%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . # # # # % % % % # # # # . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 6.4: side 1's zone ends
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
. . . # # # # % % % % # # # # . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 wall/wall x 1.5-3.5 y 8.5-9; 2 wall/wall x 5.5-7.5 y 5-5.5; 3 wall/wall x 5.5-7.5 y 8.5-9; 4 wall/wall x 1.5-3.5 y 5-5.5; 5 barricade/barricade x 3.5-5.5 y 8.5-9; 6 barricade/barricade x 3.5-5.5 y 5-5.5.

### Broken Bridge (`broken-bridge`, Champion League)
One bridge over the river. Log jams block the fords until someone clears them. Zone free: 99%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . = = = = . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
% % % ~ ~ ~ ~ . . . . ~ ~ ~ ~ % % %   y 6.4: side 1's zone ends
% % % ~ ~ ~ ~ . . . . ~ ~ ~ ~ % % % 
. . . . . . . . . . . . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . = = = = . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 water/river x 1.5-3.5 y 6.5-7.5; 2 water/river x 5.5-7.5 y 6.5-7.5; 3 barricade/logs x 0-1.5 y 6.75-7.25; 4 barricade/logs x 7.5-9 y 6.75-7.25; 5 cover/crates x 3.75-5.25 y 9-9.4; 6 cover/crates x 3.75-5.25 y 4.6-5.

### Switchback (`switchback`, Champion League)
Staggered walls make the way in a long S. Burrowers, fliers and mortars take the short cut. Zone free: 93%.

```
. . . . . . . . . . . . . . . . . .   y 2
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . = = . . . # # # # # # # # # # 
. . . = = . . . # # # # # # # # # # 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . H H . . . . . . . .   y 6.4: side 1's zone ends
. . . . . . . . H H . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
# # # # # # # # # # . . . = = . . . 
# # # # # # # # # # . . . = = . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 12
```

Blocks: 1 wall/wall x 0-5 y 8.75-9.25; 2 wall/wall x 4-9 y 4.75-5.25; 3 cover/fence x 6.25-7.75 y 8.8-9.2; 4 cover/fence x 1.25-2.75 y 4.8-5.2; 5 building/house x 4-5 y 6.5-7.5.

## The ladder

Four leagues of three arenas, unlocked by trophies:

| league | trophies | arenas | win coins | loss |
| --- | --- | --- | --- | --- |
| Bronze League | 0 | Twin Gates, The Crossing, Crate Yard | 40 | -8 |
| Silver League | 200 | The Courtyard, Watchtowers, Barricade Pass | 55 | -12 |
| Gold League | 500 | Old Village, The Fens, Long Lane | 70 | -16 |
| Champion League | 900 | Bastions, Broken Bridge, Switchback | 85 | -20 |

- **Trophies.** A win is +30, plus 2 per win already in the current streak (up to +10). A loss costs the league's
  amount, but trophies never fall below the gate of the highest league the player has reached (`best`), so a league
  once unlocked stays unlocked.
- **Next arena.** `arenaFor(save)`: the current league's three arenas in a seeded order, each once before any repeats
  (the order is reshuffled every three matches).
- **Opponent.** `arenaOpponent(trophies, seed)`: an `AIProfile` whose difficulty climbs from 0.2 at 0 trophies to 0.95
  at 1,300 (`arenaDifficulty`), with a tactic picked by the seed (all seven turn up) and its aggression, economy and
  spread set by the tactic with a little variation; a name and an epithet for display; and a troop level
  (`arenaFoeLevel`: 1 below 150 trophies, +1 per 150, capped at 10, the campaign's last act). Its roster follows the
  campaign's unlock order (`arenaFoeRoster`): the first 12 levels' units at 0 trophies, everything from 810.
- **The match.** `arenaConfig(save, { levels, roster, hp, seed?, arena? })` returns `{ cfg, arena, league, foe }`.
  `cfg` is an ordinary `MatchConfig` with `terrain` set; both commanders start on 400 health (the player's keep bonus
  is added by `nextArenaMatch`). There is no round cap.
- **Rewards.** `awardArena(match, won)` (engine/progression/troops.ts) records the result on the ladder in the save,
  pays coins through the wallet (the league's win coins, +5 per win of streak past the first up to +25, capped at 400
  arena coins a day; a first promotion pays 150 / 300 / 500 on top, outside the cap), 5 commander XP, and on a win
  drops a chest through `winChest(2)`. A loss pays nothing.
- **Save.** `Save.arena: ArenaSave` = `{ trophies, best, wins, losses, streak, bestStreak, played, arenaWins, day? }`.
  A new save starts with a blank ladder; an old save without the field loads with one (`normalizeArena` also repairs
  partial data).

## Balance

`npx vite-node tools/arena-balance.ts` (run as `lockf -k ~/Desktop/game_development/.heavy.lock nice -n 10 ...`):
AI-vs-AI matches at difficulty 0.6, random tactics, full roster, level 1; each pair of matches shares a seed and swaps
the two AI profiles between the sides. The `open` row is the same run on an open field, for comparison.

| arena           | league | matches | side0 win | side1 win | rounds 0/1/draw | time limit | standoff | avg battle | avg rounds |
| ----- | ------ | ------- | --------- | --------- | --------------- | ---------- | -------- | ---------- | ---------- |
| open            |      - |      32 |       50% |       50% |  50%/ 49%/  1%  |         9% |       1% |     19.9 s |       12.5 |
| twin-gates      |      1 |      32 |       53% |       47% |  51%/ 48%/  1%  |        14% |       1% |     23.6 s |       12.9 |
| the-crossing    |      1 |      32 |       59% |       41% |  53%/ 46%/  1%  |        12% |       1% |     21.7 s |       12.5 |
| crate-yard      |      1 |      32 |       44% |       56% |  50%/ 49%/  1%  |        15% |       1% |     24.1 s |       12.3 |
| courtyard       |      2 |      32 |       44% |       56% |  47%/ 53%/  1%  |        14% |       1% |     21.7 s |       12.1 |
| watchtowers     |      2 |      32 |       50% |       50% |  49%/ 50%/  1%  |        15% |       0% |     21.0 s |       12.3 |
| barricade-pass  |      2 |      32 |       44% |       56% |  50%/ 48%/  2%  |        14% |       1% |     20.8 s |       12.3 |
| old-village     |      3 |      32 |       63% |       38% |  56%/ 43%/  1%  |        16% |       1% |     22.8 s |       12.8 |
| the-fens        |      3 |      32 |       53% |       47% |  51%/ 46%/  2%  |        14% |       1% |     23.3 s |       12.3 |
| long-lane       |      3 |      32 |       38% |       63% |  48%/ 51%/  1%  |        12% |       0% |     21.1 s |       12.8 |
| bastions        |      4 |      32 |       47% |       53% |  45%/ 54%/  0%  |        15% |       3% |     25.3 s |       12.5 |
| broken-bridge   |      4 |      32 |       66% |       34% |  49%/ 50%/  1%  |        14% |       1% |     22.2 s |       12.3 |
| switchback      |      4 |      32 |       53% |       47% |  50%/ 49%/  1%  |        13% |       0% |     22.5 s |       13.2 |

| unit             | cost | arena pick | arena win | open pick | open win |
| ---- | ---- | ---------- | --------- | --------- | -------- |
| Blade Trio       |    3 |         7% |       52% |        6% |      51% |
| Pikeman          |    3 |         6% |       49% |        6% |      53% |
| Duelist          |    3 |         5% |       48% |        5% |      49% |
| Hookwarden       |    4 |         5% |       53% |        6% |      58% |
| Bulwark          |    4 |         5% |       54% |        6% |      51% |
| Ballista         |    3 |         4% |       52% |        4% |      50% |
| Mine             |    2 |         4% |       39% |        4% |      43% |
| Ranger           |    3 |         4% |       49% |        6% |      46% |
| Harrier          |    4 |         4% |       49% |        4% |      45% |
| Kegrunner        |    3 |         4% |       44% |        4% |      44% |
| Bombard          |    4 |         3% |       58% |        1% |      41% |
| Thornweaver      |    4 |         3% |       49% |        3% |      53% |
| Lancer           |    4 |         3% |       45% |        5% |      53% |
| Hive             |    4 |         3% |       51% |        2% |      51% |
| Lamplighter      |    3 |         3% |       51% |        3% |      51% |
| Ravager          |    4 |         3% |       49% |        3% |      49% |
| Grenadier        |    4 |         3% |       48% |        2% |      50% |
| Outrider         |    4 |         3% |       47% |        3% |      49% |
| Tinker           |    3 |         3% |       54% |        2% |      59% |
| Trickster        |    4 |         3% |       48% |        3% |      45% |
| Shade            |    4 |         3% |       43% |        2% |      50% |
| Rimecaller       |    4 |         3% |       51% |        3% |      44% |
| Sapper           |    4 |         3% |       45% |        2% |      47% |
| Stormcaller      |    5 |         2% |       54% |        3% |      52% |
| Tidecaller       |    5 |         2% |       61% |        2% |      68% |
| Medic            |    3 |         2% |       50% |        3% |      48% |
| Gravecaller      |    4 |         2% |       52% |        2% |      46% |
| Lionheart        |    5 |         2% |       48% |        2% |      57% |
| Standard Bearer  |    3 |         2% |       50% |        1% |      35% |
| Stone Colossus   |    5 |         1% |       54% |        2% |      49% |
| Griffin Knight   |    5 |         1% |       48% |        2% |      50% |

416 matches (AI difficulty 0.6) in 447s on 4 processes.

How to read it:
- **side0 / side1 win** is by match; with this few matches per arena one standard deviation is about 9 points, so
  anything from 35% to 65% is noise. `rounds 0/1/draw` is by battle and steadier.
- **time limit** is the share of battles that ran the full 45 s and were called on what was left. It is not low even
  on the open field: AI armies often end as fixed structures out of each other's reach (ballista against ballista, a
  Bombard inside its minimum range, a buried mine), which is the base game, not terrain. Arenas add a few points
  (longer walks, shots blocked).
- **standoff** is the share of battles that ran to the limit with a mobile ground fighter still alive on both sides
  (support units and Hive / Gravecaller spawn not counted): the armies never finished each other. This is the number
  terrain could make worse; the target was under 8%.
- **Units**: `pick` is the share of all fielded pieces, `win` the share of the rounds it was fielded in that its side
  won. Nothing is useless or dominant in arenas; no unit stats and no block health were changed.

## For frontends

Starting a match:
```ts
import { nextArenaMatch, awardArena, arenaLadder } from "@engine/progression/troops";
const next = nextArenaMatch();            // { cfg, arena, league, foe }: stable until a result is recorded
const match = new Match(next.cfg);        // drive side 1 with planTurnAsync(match, 1, next.foe.ai)
// ... play ...
const end = awardArena(next, match.winner === 0);   // { reward, result, chest }: call once
```

What to read:
- **Blocks to draw:** `match.cfg.terrain` (`Block[]`, static, during deploy) and `battle.blocks` (`BlockState[]`,
  live, during a battle: `hp`, `maxHp`, `alive`). Same ids, same order. `block.look` is the model hint
  (`ARENA_LOOKS` in arena.ts: wall, house, hall, tower, barricade, logs, crates, fence, pond, river); fall back on
  `block.kind`. `arena.marks` are decoration rectangles for gates and bridges (not blocks).
- **Events** (docs/EVENTS.md): `blockhit`, `blockbreak`, `ricochet`, `crash`; and `Proj.over` for shots that arc over
  walls at fliers.
- **Placement:** `match.freeSpot(side, kind, x, y)` gives the snapped spot for a drag (or null);
  `match.spotBlocked(kind, x, y)` says whether an exact point is on a block (to tint the ghost). `match.buy` and
  `match.move` snap by themselves and throw `"No room"` only if the zone has no free spot.
- **Ladder screens:** `arenaLadder()` (the save), `LEAGUES`, `leagueOf(trophies)`, `leagueProgress(trophies)`,
  `nextLeague(league)`, `ARENAS`, `arenaById(id)`, `arenaUnlocked(arena, best)`, `trophyChange(save, won)` (what the
  next result would do), `TROPHY_WIN`, `TROPHY_LOSS`, `ARENA_WIN_COINS`, `ARENA_PROMOTION_COINS`, `ARENA_DAILY_CAP`.
- **Result screen:** `end.result` (`delta`, `trophies`, `from`, `to`, `promoted`, `streak`), `end.reward`
  (`coins`, `parts`, `xp`, `capTo`), `end.chest` (as `winChest` returns; do not call `winChest` again).
- **Opponent card:** `next.foe.name`, `next.foe.title`, `next.foe.level`, `next.foe.trophies`, `next.foe.ai.tactic`.
