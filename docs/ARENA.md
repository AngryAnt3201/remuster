# Arena

Arena is the same match loop as the rest of the game (buy from the shop, place in your half, watch the battle, lose
health when you lose a round), fought on designed places against AI opponents on a trophy ladder: a village with a
main street and alleys, a river crossing, a mill farm, a mountain road. Each has a road that joins the two sides,
buildings and walls that make routes, cover to shoot from and brush to lie in wait in. Campaign levels use the same
terrain on smaller set pieces (see Campaign sets).

Where things live:

| | |
| --- | --- |
| `engine/core/terrain.ts` | The contract: block kinds, what each blocks, `Block`, `BlockState`, the road and brush constants, geometry helpers, `mirrorBlock`. |
| `engine/core/nav.ts` | Terrain queries for the sim (line of sight, shot stops, swept collision, free spots, `onRoad`, `inBrush`) and navigation (clearance grid + A*). |
| `engine/core/battle.ts` | The rules below. Everything terrain is behind `if (this.nav)`: a battle without `terrain` runs exactly as before (`tests/golden.test.ts`). |
| `engine/core/placement.ts` | Where a piece may stand: `freeSpotIn`, `spotBlocked`, `footprint`. |
| `engine/core/layout.ts` | Building blocks for designed maps: the looks (`LOOKS_BY_KIND`), `ArenaMark`, `rect`, `mark`, `prop`, `layout` (one half plus its mirror image). |
| `engine/core/arena.ts` | The 12 arenas, the design rule book (`terrainIssues`, `ARENA_RULES`, `roadJoins`, `chokepoint`), 4 leagues, opponents, trophy maths, `arenaConfig`. Pure. |
| `engine/core/sets.ts` | The campaign set pieces (`SETS`, `SET_RULES`). |
| `engine/progression/troops.ts` | The device save binding: `arenaLadder`, `nextArenaMatch`, `awardArena`. |
| `tools/arena-map.ts` | ASCII maps and the rule check for every arena and set; `md` prints the arena sections of this file. |
| `tools/arena-balance.ts` | AI-vs-AI balance run (table at the end of this file). |
| `tests/terrain.test.ts`, `tests/zones.test.ts`, `tests/arena.test.ts`, `tests/sets.test.ts` | The proof. |

## Blocks

Axis-aligned rectangles in world units (board 9 x 14). Seven kinds: five that are in the way, and two ground zones.

| kind | ground units | direct shots, chains | lobbed shots, fliers, burrowers | sight | breaks |
| --- | --- | --- | --- | --- | --- |
| `wall` | blocked | blocked | pass over / under | blocked | never |
| `building` | blocked | blocked | pass over / under | blocked | never |
| `barricade` | blocked | blocked | pass over / under | blocked | yes, 320 hp |
| `cover` | blocked | pass, weakened | pass | clear | yes, 160 hp |
| `water` | blocked | pass | pass | clear | never |
| `road` | pass, 1.25x speed | pass | pass | clear | never |
| `brush` | pass, hidden | pass | pass | clear, but see Brush | never |

`building` is `wall` with a different picture. A block can override its health with `hp`. A broken block is rubble:
it blocks nothing. `road` and `brush` are zones (`isZone`): they block nothing, never break, may overlap each other's
edges and never overlap a blocking block. `blocksGround`, `blocksShots`, `blocksSight` and `breakable` answer for
every kind.

`Block.look` is a hint for the frontend (the sim never reads it). The looks, by kind (`LOOKS_BY_KIND`):

| kind | looks |
| --- | --- |
| wall | `wall`, `palisade`, `hedge-wall` |
| building | `house`, `hall`, `tower`, `barn`, `shop`, `chapel`, `mill`, `gatehouse`, `ruin`, `rock` (a crag), `well`, `statue` |
| barricade | `barricade`, `logs`, `wagon` |
| cover | `crates`, `fence`, `sandbags`, `barrels`, `haystack`, `stall`, `cart` |
| water | `pond`, `river`, `fountain` |
| road | `road`, `bridge-deck`, `plaza` |
| brush | `brush`, `reeds`, `orchard`, `cornfield` |

Marks (`ArenaMark`, on `ArenaDef.marks` and `LevelDef.marks`) are decoration only: `gate`, `bridge` and `door` are
rectangles (`x, y` the centre, `w, h` the size); `tree`, `lamp`, `banner` and `signpost` are points (`w` and `h` are
0) and may sit just off the board (x -1..10, y -1..15).

## Rules

**Movement.** Ground bodies cannot enter a block. Each step a body's whole move (walking, knockback, a wave's shove, a
hook's reel) is swept against the blocks from where it stood when the step began, so nothing tunnels at any speed; it
slides along what it hits. Flying bodies (Harrier always; Griffin Knight while it soars) and burrowed Sappers ignore
blocks. Fixed structures and mines never move, and are never placed on a block.

**Roads.** A ground unit whose centre is on a road moves at 1.25 times its speed (`ROAD_SPEED`): whatever it was
going to do this step, it does 25% faster while it is on the road. Fliers and burrowed Sappers gain nothing. Shoves,
reels and charges that carry a body are not sped up, only its own movement. The route planner prices a road cell at
0.8 of open ground, so when a route has to go round something it takes the road where the ways are otherwise close.

**Brush.** A ground unit whose centre is in brush is hidden (`Body.hidden`). Nothing on the other side can target it
from farther than 1.7 units edge to edge (`BRUSH_REVEAL`): no melee, no direct shot, no lob aimed at it, no chain, no
dive, no lightning jump. It is revealed, for anyone at any distance, for 1.5 seconds (`BRUSH_EXPOSE`) after it
attacks or casts (anything that starts its cooldown, looses a shot or throws a chain) or takes damage; standing in
brush hides it again once that runs out. What does not hide: fliers, structures (a Ballista in a cornfield is
seen), a unit that has stepped out. What still hurts a hidden unit: every area effect (blasts, slams, waves,
brambles, flames, a Ballista bolt or a stray arrow passing through where it stands) and a shot already in the air.
A Shade's cloak and a mine's burial are separate (`Body.stealth`): nobody targets those at any range.

**Searching.** A unit with nobody in sight heads for the nearest enemy hidden in brush, as it heads for one behind a
wall: it cannot attack until it is within 1.7 units, but it goes looking. So two armies in the grass always find
each other, and a battle never waits on a unit nobody can see.

**Lying in wait.** A ground unit that starts the battle in brush (`Body.ambush`) does not move or act until an
enemy it can see comes within 3 units edge to edge (`AMBUSH_RANGE`; or within its own attack range, if that is
longer: a Ranger in the reeds looses when a target is in bow range), it is revealed, it is pushed out of the brush,
or 6 seconds have passed (`AMBUSH_WAIT`). Its cooldown runs down while it waits, so it strikes at once. Shades,
fliers, burrowed Sappers and structures do not lie in wait. This is what makes brush in a deploy zone an ambush
position: put the Duelists in the orchard and they are still there, unseen, when the enemy's line walks past.

**Navigation.** When a block stands on the straight line to where a body is heading, it follows a route round: A* on
a 0.25-unit clearance grid, sized to the body's radius, pulled straight into a few corner waypoints. A route is cached
per body and planned again only when a block breaks, when the goal moves out of sight of the route's last corner, when
the body is shoved off it, or after 2.5 s. A gap is open to a body only if the body really fits in it: each grid cell
knows the largest body that can stand somewhere in it (exact distances, sampled every 0.05), so a gap up to 0.05
wider than a body may be refused, and a gap narrower than the body never is taken for open. (Before engine v3 a gap up to
0.25 narrower than a body could be planned through; the body then pressed against it for the rest of the battle.)
Keep gaps at 1.25 or wider if the Stone Colossus, 1.1 across, is meant to fit. A body fleeing (no destination) turns
aside rather than press into a block.

**Sight.** Walls, buildings and barricades block sight; cover, water, roads and brush do not (brush hides what
stands in it, by the rule above, not what is behind it). Sight is a straight line between centres. Anything in the
air sees and is seen over everything.
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
at a point inside a wall, building or barricade lands on the nearest free ground beside it. A lobber does not aim at
a unit hidden in brush, but its blast hurts one that is under it.

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
long. A gap between a breakable block and something solid that is too narrow for the body counts the same way: it
breaks the block to get by. A body on such a route walks up to the block and hits it on its attack cooldown for its
damage (Colossus: x3); a Kegrunner blows itself up on it. Shooters and support never break in: to them a barricade
is a wall.

**Charges.** A Lancer only starts a charge when its straight run to the target is clear of blocks and the target is
not hidden; otherwise it trots round until it is. A charge that runs into a block (it overshoots its mark by 2
units) ends there: `crash`, 0.6 s stun, no damage to anything behind the block.

**Fairness.** Arenas and sets are symmetric under a half turn, and so is everything that decides a battle on one:
side 1's route search runs turned half round (`Nav.path(..., flip)`), free-spot searches are mirrored, and on terrain
the AI lays out side 1's formation as the mirror image of side 0's.

**Known limits.** Routes avoid blocks, not bodies: a fixed structure parked in a narrow gap plugs it for anything too
wide to squeeze past (the AI sees this in its simulations; a player can do it to themselves). Terrain arrays are
treated as immutable (clearance fields are cached per array): to change a map's blocks pass a new array. The hiding
rule is per body and symmetric: a unit in brush cannot see out any better than others see in, but it can still target
anyone not hidden.

## Every unit, on terrain

| unit | what changes |
| --- | --- |
| Mine | Never placed on a block. Triggers only on an enemy it has sight of; its blast is shadowed by walls. Buried anywhere, brush or not. |
| Blade Trio, Duelist, Ravager, Lionheart, Bulwark, Pikeman, Hookwarden (melee) | Path round blocks; no strikes through walls; may break barricades and cover when that is the best way in. The natural ambushers: placed in brush they lie in wait and strike first. |
| Ranger, Outrider, Rimecaller | Direct fire: sight needed, shots stop on walls, weakened by cover. A shot from brush reveals the shooter for 1.5 s. Volley side arrows that find no target fly straight and stop on walls. |
| Medic | A heal needs sight of the patient (the splash to allies beside the patient does not). Revive (Ascended) works through walls. Healing from brush reveals it. |
| Grenadier, Bombard | Lobbed: no sight needed, over everything, never aimed at a hidden unit. Blasts shadowed by walls and wear down barricades and cover. |
| Shade | Paths round blocks while cloaked. The blink needs no sight but not at a mark hidden in brush; it lands on the nearest free ground beside the mark, on the mark's side of any block. Does not lie in wait. |
| Lancer | See Charges. |
| Ballista, turret | Fixed: shoot only what they can see. Bolts stop on walls. Never hidden, even in brush. |
| Hive | Mites hatch on free ground on the hive's side of any block and path like any melee body (they can gnaw through a barricade when walled in). |
| Stormcaller | The first target needs sight, and so does each jump (from the last body struck to the next). No jump to a unit hidden from the caster. |
| Stone Colossus | Siege: breaks barricades and cover in its way rather than walk round (x3 damage to them). Needs gaps 1.25 wide. Shardlings appear on free ground and are ordinary melee. |
| Sapper | Tunnels under everything; surfaces on the nearest free ground, never inside a block. Its eruption is shadowed by walls. Burrowed, it gains nothing from roads or brush. |
| Harrier | Flies over everything; sight never blocked to or from it; never hidden; no road speed. Will not dive on a unit it cannot see in brush until it has circled close. |
| Gravecaller | Raising needs no sight (within 3 units, through walls). A thrall rises on the nearest free ground to the fallen body; an Ossuary thrall on the Gravecaller's side of any block. |
| Tinker | The turret is built on free ground on the Tinker's side of any block. Repairs are hand to hand (no repairing through a wall). |
| Kegrunner | Siege: paths to the crowd like any ground unit; if a barricade or cover is in its way it blows itself up on it (x3 to blocks, enough to break a fresh barricade). Fast on a road. |
| Trickster | Decoys appear on free ground on the Trickster's side of any block and path like ground units. |
| Hookwarden | The chain is a direct shot: it is only thrown at a mark in sight (never one hidden in brush), and if the mark steps behind a wall before it lands the chain stops on the wall (`ricochet`, kind `hook`). A reeled body slides along blocks and is let go after 1.4 s if it snags. Throwing the chain reveals the Hookwarden. |
| Thornweaver | Sown like a lob: no sight needed. Brambles (and Firebomb flames, Riptide surf) are ground effects: they reach everything inside the patch, walls or not, hidden or not. |
| Lamplighter | A ward needs sight of the ally. Its sparks are direct fire. A Beacon burst is a blast (shadowed). |
| Standard Bearer, Lionheart rally, Bastion | Auras reach through walls. The Standard Bearer itself paths round blocks and, like all support, never breaks in. |
| Griffin Knight | Soars over everything; lands on the nearest free ground on its mark's side of any block, then fights as a ground body (and can then be hidden by brush). It does not pick a mark hidden in brush. |
| Tidecaller | The wave rolls its whole lane, over water and cover, but breaks on walls, buildings and barricades: a body with one of those between it and the wave's start line (straight up the lane) is sheltered, and the Tidecaller does not count sheltered or hidden bodies when picking a lane. The wave still hits a hidden body in its lane. With no sight of the nearest enemy it keeps closing in. Waves do not damage blocks. |

## Placement

No piece can be bought, placed or moved onto a blocking block; roads and brush are ground, and a piece may stand on
them. `match.freeSpot(side, kind, x, y)` returns where a piece dropped at (x, y) would stand: clamped into the zone
and, if a block is in the way, moved to the nearest free spot still in the zone (searching outward in rings, straight
back first); null if the zone has none within 7 units, in which case `buy` and `move` throw `"No room"`. A Blade Trio
needs room for its whole triangle (`footprint`). `Match` applies the same rule to `cfg.start` pieces, and `Battle`
itself moves any body that would start on a block, so the sim can never begin with one inside. The AI's formations go
through the same function; half of its exploring candidates also try a terrain-aware variation (`shelter` in ai.ts:
shooters behind cover, lobbers and support behind walls, and some of the hand-to-hand units into brush in its zone)
and the simulation, which plays the hiding and ambush rules, decides whether it is worth it.

## What a designed map must have

`terrainIssues(blocks, rules)` (engine/core/arena.ts) is the rule book; `tests/arena.test.ts` and `tests/sets.test.ts`
hold every arena and set to it, and `npx vite-node tools/arena-map.ts` prints the maps with any issues.

| rule | arenas (`ARENA_RULES`) | campaign sets (`SET_RULES`) |
| --- | --- | --- |
| blocks, zones included | 14 to 30 | 6 to 14 |
| in bounds, at least 0.39 on a side, a known look for its kind | yes | yes |
| blocking blocks clear of each other and of the keeps; zones clear of blocking blocks | yes | yes |
| the same after a half turn about the board centre | yes | yes |
| each deploy zone free of blocking blocks | 75% or more | 85% or more |
| a chain of road zones from one deploy zone to the other (`roadJoins`) | yes | not required |
| cover blocks on each side's half | 2 or more | not required |
| brush on each side's half | 1 or more | 1 or more |
| the largest unit (radius 0.55) can walk between any two spots it can stand on, breaking nothing | yes | yes |
| no single chokepoint (`chokepoint`): a 1.2-wide plug dropped anywhere on the cheapest route across never cuts the sides off (a barricade counts as a way through) | yes | yes |

## The arenas

Twelve, three to a league. Each is the same after a half turn about the board centre (built with `layout`), and each
is a place with one idea a player can read at a glance. In the sketches each cell is half a unit; rows run from y 0
(side 1's back edge, top) to y 14 (side 0's). `#` wall, `H` building, `%` barricade, `=` cover, `~` water, `:` road,
`"` brush. A cell shows a block that covers at least a third of it.

### Twin Gates (`twin-gates`, Bronze League)
A border wall with a pair of guard towers in the middle and a gate either side. A road runs through each gate: quick, and watched. Sandbags flank the gates, a barracks stands behind the right one, and the orchard and the long grass by the wall hide whoever waits for the gate to be forced. 19 blocks; zone free: 95%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . H H H . . . . . . . . . . . . 
. . . H H H . . . . . . . . . . . . 
. . . H H H . . . . . . . . . . . . 
. . . . . . . . . . . . . . . " " " 
. . . : : : . . . . . . : : : " " " 
. . . : : : . . . . . . : : : " " " 
. . . : : : . . . . . . : : : " " " 
. . . : : : . . . . . . : : : . . . 
. = = : : : . . . . . . : : : . . . 
" " " : : : . . . . = . : : : = = . 
" " " : : : . . . . . . : : : . . . 
# # # : : : H H # # H H : : : # # #   y 6.4: side 1's zone ends
# # # : : : H H # # H H : : : # # # 
. . . : : : . . . . . . : : : " " "   y 7.6: side 0's zone starts
. = = : : : . = . . . . : : : " " " 
. . . : : : . . . . . . : : : = = . 
. . . : : : . . . . . . : : : . . . 
" " " : : : . . . . . . : : : . . . 
" " " : : : . . . . . . : : : . . . 
" " " : : : . . . . . . : : : . . . 
" " " . . . . . . . . . . . . . . . 
. . . . . . . . . . . . H H H . . . 
. . . . . . . . . . . . H H H . . . 
. . . . . . . . . . . . H H H . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 wall/wall x 0-1.5 y 6.75-7.25; 2 wall/wall x 7.5-9 y 6.75-7.25; 3 building/tower x 3.25-4 y 6.5-7.5; 4 building/tower x 5-5.75 y 6.5-7.5; 5 road/road x 1.75-3 y 3-11; 6 road/road x 6-7.25 y 3-11; 7 cover/sandbags x 0.5-1.5 y 8.25-8.65; 8 cover/sandbags x 7.5-8.5 y 5.35-5.75; 9 cover/sandbags x 3.25-4.25 y 8.25-8.65; 10 cover/sandbags x 4.75-5.75 y 5.35-5.75; 11 cover/barrels x 7.6-8.4 y 8.6-9; 12 cover/barrels x 0.6-1.4 y 5-5.4; 13 brush/orchard x 0.25-1.5 y 9.5-11.5; 14 brush/orchard x 7.5-8.75 y 2.5-4.5; 15 brush/brush x 7.5-8.75 y 7.6-8.4; 16 brush/brush x 0.25-1.5 y 5.6-6.4; 17 building/house x 6-7.5 y 11.5-12.75; 18 building/house x 1.5-3 y 1.25-2.5; 19 wall/wall x 4-5 y 6.75-7.25.

### The Crossing (`the-crossing`, Bronze League)
A river town's crossing: two timber bridges with a road over each, a ferryman's house, crates on the quay. Shots fly over the water, but the reeds along the banks hide whoever stands in them, so a firing line on the bank is not the free win it looks. 19 blocks; zone free: 95%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . : : : . . . . . . : : : H H . 
. . . : : : . . . . . . : : : H H H 
. . . : : : . = = = = . : : : H H H 
. = = : : : . . . . . . : : : . . . 
. . . : : : . " " " " . : : : " " " 
. . . : : : " " " " " " : : : " " " 
~ ~ ~ : : : ~ ~ ~ ~ ~ ~ : : : ~ ~ ~   y 6.4: side 1's zone ends
~ ~ ~ : : : ~ ~ ~ ~ ~ ~ : : : ~ ~ ~ 
" " " : : : " " " " " " : : : . . .   y 7.6: side 0's zone starts
" " " : : : . " " " " . : : : . . . 
. . . : : : . . . . . . : : : = = . 
H H H : : : . = = = = . : : : . . . 
H H H : : : . . . . . . : : : . . . 
. H H : : : . . . . . . : : : . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 water/river x 0-1.5 y 6.5-7.5; 2 water/river x 7.5-9 y 6.5-7.5; 3 road/bridge-deck x 1.5-3.25 y 6.25-7.75; 4 road/bridge-deck x 5.75-7.5 y 6.25-7.75; 5 road/road x 1.75-3 y 7.75-10.5; 6 road/road x 6-7.25 y 3.5-6.25; 7 road/road x 6-7.25 y 7.75-10.5; 8 road/road x 1.75-3 y 3.5-6.25; 9 brush/reeds x 3.25-5.75 y 7.6-8.3; 10 brush/reeds x 3.25-5.75 y 5.7-6.4; 11 brush/reeds x 0-1.4 y 7.6-8.4; 12 brush/reeds x 7.6-9 y 5.6-6.4; 13 building/house x 0.25-1.5 y 9-10.25; 14 building/house x 7.5-8.75 y 3.75-5; 15 cover/crates x 3.75-5.25 y 9-9.4; 16 cover/crates x 3.75-5.25 y 4.6-5; 17 cover/barrels x 7.6-8.5 y 8.75-9.15; 18 cover/barrels x 0.5-1.4 y 4.85-5.25; 19 water/river x 3.25-5.75 y 6.5-7.5.

### Market Square (`crate-yard`, Bronze League)
Market day. A fountain in the middle with a paved lane either side of it, stalls and crates scattered through the square to shoot from (or smash), a shop on each corner, and an orchard and a patch of long grass on the flanks for anyone who would rather not be seen crossing. 19 blocks; zone free: 90%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. H H . . . . . . . . . . . . H H H 
H H H H . . . . . . . . . . . H H H 
H H H H . . . . . . . . . . . H H H 
. . . . . : : : . . : : : . . . . . 
. . . . . : : : = = : : : . . " " . 
. . . . . : : : . . : : : . " " " " 
. . . = = : : : . . : : : . " " " " 
. . . = = : : : . . : : : . . " " . 
. . . . . : : : : : : : : = = . . . 
" " " . . : : : : : : : : = = . . . 
" " " . . : : : : : : : : . . . . . 
. . . . . : : : ~ ~ : : : . . . . .   y 6.4: side 1's zone ends
. . . . . : : : ~ ~ : : : . . . . . 
. . . . . : : : : : : : : . . " " "   y 7.6: side 0's zone starts
. . . = = : : : : : : : : . . " " " 
. . . = = : : : : : : : : . . . . . 
. " " . . : : : . . : : : = = . . . 
" " " " . : : : . . : : : = = . . . 
" " " " . : : : . . : : : . . . . . 
. " " . . : : : = = : : : . . . . . 
. . . . . : : : . . : : : . . . . . 
H H H . . . . . . . . . . . H H H H 
H H H . . . . . . . . . . . H H H H 
H H H . . . . . . . . . . . . H H . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 road/road x 2.75-3.75 y 2.5-11.5; 2 road/road x 5.25-6.25 y 2.5-11.5; 3 road/plaza x 3.75-5.25 y 7.5-8.75; 4 road/plaza x 3.75-5.25 y 5.25-6.5; 5 cover/stall x 1.25-2.5 y 8.2-8.7; 6 cover/stall x 6.5-7.75 y 5.3-5.8; 7 cover/stall x 6.5-7.75 y 9.2-9.7; 8 cover/stall x 1.25-2.5 y 4.3-4.8; 9 cover/crates x 3.9-5.1 y 10.6-11.1; 10 cover/crates x 3.9-5.1 y 2.9-3.4; 11 building/shop x 0-1.5 y 11.75-13; 12 building/shop x 7.5-9 y 1-2.25; 13 building/shop x 7.25-8.75 y 11.5-12.75; 14 building/shop x 0.25-1.75 y 1.25-2.5; 15 brush/orchard x 0.25-1.75 y 9.25-10.75; 16 brush/orchard x 7.25-8.75 y 3.25-4.75; 17 brush/brush x 7.5-8.75 y 7.6-8.6; 18 brush/brush x 0.25-1.5 y 5.4-6.4; 19 water/fountain x 4-5 y 6.5-7.5.

### The Courtyard (`courtyard`, Silver League)
A manor's forecourt. The hall fills the middle, so the fight goes round it down two paved lanes past a pair of statues. Each side has a yard wall with a wide gate, a fence and barrels to shoot from, and a garden inside the wall and an orchard outside it to lie in wait in. 21 blocks; zone free: 95%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . " " " . . . . . . . . . . . . . 
. . " " " " . . . . . . . . . . . . 
. . " " " " . . . . . . . . . . . . 
. . " " " . . . . . . . . . . . . . 
. . = = . . . . = = . . . . . . . . 
. . . . . : : : . . : : : . . . . . 
. . . . . : : : . . : : : = = . . . 
. . # # # # : : . . : : # # # # . . 
. . . . . : : : : : : : : . . . . . 
. . . . . : : : : : : : : " " " . . 
. . . . . : : : H H : : : " " " . . 
. . . . H : : H H H H : : H . . . .   y 6.4: side 1's zone ends
. . . . H : : H H H H : : H . . . . 
. . " " " : : : H H : : : . . . . .   y 7.6: side 0's zone starts
. . " " " : : : : : : : : . . . . . 
. . . . . : : : : : : : : . . . . . 
. . # # # # : : . . : : # # # # . . 
. . . = = : : : . . : : : . . . . . 
. . . . . : : : . . : : : . . . . . 
. . . . . . . . = = . . . . = = . . 
. . . . . . . . . . . . . " " " . . 
. . . . . . . . . . . . " " " " . . 
. . . . . . . . . . . . " " " " . . 
. . . . . . . . . . . . . " " " . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 wall/wall x 1.25-2.75 y 9-9.5; 2 wall/wall x 6.25-7.75 y 4.5-5; 3 wall/wall x 6.25-7.75 y 9-9.5; 4 wall/wall x 1.25-2.75 y 4.5-5; 5 building/statue x 2-2.5 y 6.75-7.25; 6 building/statue x 6.5-7 y 6.75-7.25; 7 road/road x 2.75-3.75 y 3.5-10.5; 8 road/road x 5.25-6.25 y 3.5-10.5; 9 road/plaza x 3.75-5.25 y 7.75-9; 10 road/plaza x 3.75-5.25 y 5-6.25; 11 cover/fence x 4-5 y 10.5-10.9; 12 cover/fence x 4-5 y 3.1-3.5; 13 cover/barrels x 1.5-2.5 y 9.75-10.15; 14 cover/barrels x 6.5-7.5 y 3.85-4.25; 15 cover/crates x 7-8 y 10.5-10.9; 16 cover/crates x 1-2 y 3.1-3.5; 17 brush/brush x 1.25-2.5 y 7.6-8.6; 18 brush/brush x 6.5-7.75 y 5.4-6.4; 19 brush/orchard x 6.25-8 y 11.25-12.75; 20 brush/orchard x 1-2.75 y 1.25-2.75; 21 building/hall x 3.75-5.25 y 6.25-7.75.

### Watchtowers (`watchtowers`, Silver League)
Two border posts facing each other. Each has a pair of watchtowers joined by a palisade with the road running through the gap, a fence either side of the road and sandbags on the flank. Between the posts the road is open ground under every bow; the long grass either side of it is slower and unseen. 21 blocks; zone free: 92%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. = . . . . . . : : . . . . . . . . 
. = . . . . . . : : . . . . . . = . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . H H . . . : : . . . H H . . . 
. . . H H # # . : : . # # H H . . . 
. . . H H . . . : : . . . H H . . . 
. . . . . = = = : : = = = . " " " " 
. . . . . . . . : : . . . . " " " " 
" " " " " " . . : : . . " " " " " "   y 6.4: side 1's zone ends
" " " " " " . . : : . . " " " " " " 
" " " " . . . . : : . . . . . . . .   y 7.6: side 0's zone starts
" " " " . = = = : : = = = . . . . . 
. . . H H . . . : : . . . H H . . . 
. . . H H # # . : : . # # H H . . . 
. . . H H . . . : : . . . H H . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. = . . . . . . : : . . . . . . = . 
. . . . . . . . : : . . . . . . = . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/tower x 1.5-2.5 y 8.75-9.75; 2 building/tower x 6.5-7.5 y 4.25-5.25; 3 building/tower x 6.5-7.5 y 8.75-9.75; 4 building/tower x 1.5-2.5 y 4.25-5.25; 5 wall/palisade x 2.5-3.25 y 9-9.5; 6 wall/palisade x 5.75-6.5 y 4.5-5; 7 wall/palisade x 5.75-6.5 y 9-9.5; 8 wall/palisade x 2.5-3.25 y 4.5-5; 9 cover/fence x 2.75-3.75 y 8.1-8.5; 10 cover/fence x 5.25-6.25 y 5.5-5.9; 11 cover/fence x 5.25-6.25 y 8.1-8.5; 12 cover/fence x 2.75-3.75 y 5.5-5.9; 13 cover/sandbags x 0.25-1.25 y 11.25-11.65; 14 cover/sandbags x 7.75-8.75 y 2.35-2.75; 15 cover/haystack x 7.75-8.5 y 11.25-11.75; 16 cover/haystack x 0.5-1.25 y 2.25-2.75; 17 brush/brush x 6-8.75 y 6.6-7.4; 18 brush/brush x 0.25-3 y 6.6-7.4; 19 brush/brush x 0.25-1.75 y 7.6-8.5; 20 brush/brush x 7.25-8.75 y 5.5-6.4; 21 road/road x 4-5 y 2-12.

### Barricade Pass (`barricade-pass`, Silver League)
A toll gate in a mountain pass. Crags run right across; the road goes through the one gate, and the two side tracks are stopped with timber barricades until something heavy breaks them. Sandbags guard the gate, a toll house stands behind it, and there is long grass behind the right-hand barricade for whoever expects company. 19 blocks; zone free: 95%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . " " " 
. . H H H . . . . . . . . . . " " " 
. . H H H . . . : : . . . . . " " " 
. . H H . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . = = . . 
. . . . . . . . : : . . . . . . . . 
. . . . . = = . : : . = = . . . . . 
. " " " " . . . : : . . . . . . . . 
. " " " " . . . : : . . . . . . . . 
H H % % % H H H : : H H H % % % H H   y 6.4: side 1's zone ends
H H % % % H H H : : H H H % % % H H 
. . . . . . . . : : . . . " " " " .   y 7.6: side 0's zone starts
. . . . . . . . : : . . . " " " " . 
. . . . . = = . : : . = = . . . . . 
. . . . . . . . : : . . . . . . . . 
. . = = . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . H H . . 
" " " . . . . . : : . . . H H H . . 
" " " . . . . . . . . . . H H H . . 
" " " . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/rock x 0-0.75 y 6.5-7.5; 2 building/rock x 8.25-9 y 6.5-7.5; 3 barricade/barricade x 0.75-2.5 y 6.75-7.25; 4 barricade/barricade x 6.5-8.25 y 6.75-7.25; 5 building/rock x 2.5-3.75 y 6.5-7.5; 6 building/rock x 5.25-6.5 y 6.5-7.5; 7 cover/sandbags x 2.5-3.5 y 8.75-9.15; 8 cover/sandbags x 5.5-6.5 y 4.85-5.25; 9 cover/sandbags x 5.5-6.5 y 8.75-9.15; 10 cover/sandbags x 2.5-3.5 y 4.85-5.25; 11 cover/crates x 1-2 y 9.5-9.9; 12 cover/crates x 7-8 y 4.1-4.5; 13 brush/brush x 6.5-8.25 y 7.6-8.6; 14 brush/brush x 0.75-2.5 y 5.4-6.4; 15 brush/brush x 0.25-1.5 y 10.5-12; 16 brush/brush x 7.5-8.75 y 2-3.5; 17 building/house x 6.75-8 y 10.25-11.5; 18 building/house x 1-2.25 y 2.5-3.75; 19 road/road x 4-5 y 3-11.

### Old Village (`old-village`, Gold League)
A village on a crossroads. The main street runs end to end through a little square with a well; houses, a shop and a barn stand off it and make alleys, one of them too narrow for anything big and deep in shadow. Market stalls line the street for cover and there is an orchard on the green. 23 blocks; zone free: 85%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . : : . . . H H H . . 
. . . . . . = . : : . . . H H H H . 
. . . . . . = . : : . . . H H H H . 
. . . . . . . . : : . . . . . . . . 
" " H H H H . . : : . . . . . . . . 
" " H H H H . . : : . . . H H H . . 
" " H H H H . . : : . . . H H H H . 
. . . . . . . . : : . . . H H H H . 
. . . . . . = = : : = = . H H H . . 
. . . . . . . . : : . . . . . " " " 
. . . . H H : : : : : : . . . " " " 
. . . H H H : : : : : : H H H . . .   y 6.4: side 1's zone ends
. . . H H H : : : : : : H H H . . . 
" " " . . . : : : : : : H H . . . .   y 7.6: side 0's zone starts
" " " . . . . . : : . . . . . . . . 
. . H H H . = = : : = = . . . . . . 
. H H H H . . . : : . . . . . . . . 
. H H H H . . . : : . . H H H H " " 
. . H H H . . . : : . . H H H H " " 
. . . . . . . . : : . . H H H H " " 
. . . . . . . . : : . . . . . . . . 
. H H H H . . . : : . = . . . . . . 
. H H H H . . . : : . = . . . . . . 
. . H H H . . . : : . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 road/road x 4-5 y 7.75-13; 2 road/road x 4-5 y 1-6.25; 3 road/plaza x 3-4.25 y 6-8; 4 road/plaza x 4.75-6 y 6-8; 5 building/house x 0.75-2.5 y 8.75-10.25; 6 building/house x 6.5-8.25 y 3.75-5.25; 7 building/house x 6.25-7.75 y 9.5-11; 8 building/house x 1.25-2.75 y 3-4.5; 9 building/shop x 1.75-3 y 6.25-7.5; 10 building/shop x 6-7.25 y 6.5-7.75; 11 building/barn x 0.75-2.5 y 11.5-12.75; 12 building/barn x 6.5-8.25 y 1.25-2.5; 13 cover/stall x 3-3.9 y 8.5-8.9; 14 cover/stall x 5.1-6 y 5.1-5.5; 15 cover/stall x 5.1-6 y 8.5-8.9; 16 cover/stall x 3-3.9 y 5.1-5.5; 17 cover/cart x 5.25-6 y 11.75-12.25; 18 cover/cart x 3-3.75 y 1.75-2.25; 19 brush/brush x 7.75-9 y 9.5-11; 20 brush/brush x 0-1.25 y 3-4.5; 21 brush/orchard x 0.25-1.5 y 7.6-8.6; 22 brush/orchard x 7.5-8.75 y 5.4-6.4; 23 building/well x 4.25-4.75 y 6.75-7.25.

### The Fens (`the-fens`, Gold League)
Marshland. A mere in the middle with a boardwalk all the way round it, a pond on each flank of each camp, and reed beds on every shore. The boardwalk is the quick way and the only dry one; the reeds are everywhere else, and so is whoever is hiding in them. A fisherman's hut and his upturned cart are the only hard cover. 25 blocks; zone free: 88%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. H H H . . . . . . . . . . . . . . 
. H H H . . . . : : = = . . . . . . 
. H H . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . " ~ ~ ~ ~ . . 
. . ~ ~ ~ ~ " . : : . " ~ ~ ~ ~ . . 
. . ~ ~ ~ ~ " . : : . " . ~ ~ . . . 
. . . . . . . . : : . . . . . . . . 
= = . . : : : : : : : : : : . . = = 
. . . . : : : ~ ~ ~ ~ : : : . . . . 
" " " " : : : ~ ~ ~ ~ : : : " " " "   y 6.4: side 1's zone ends
" " " " : : : ~ ~ ~ ~ : : : " " " " 
. . . . : : : ~ ~ ~ ~ : : : . . . .   y 7.6: side 0's zone starts
= = . . : : : : : : : : : : . . = = 
. . . . . . . . : : . . . . . . . . 
. . . ~ ~ . " . : : . " ~ ~ ~ ~ . . 
. . ~ ~ ~ ~ " . : : . " ~ ~ ~ ~ . . 
. . ~ ~ ~ ~ " . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . H H . 
. . . . . . = = : : . . . . H H H . 
. . . . . . . . . . . . . . H H H . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 water/pond x 1.25-2.75 y 9.25-10.5; 2 water/pond x 6.25-7.75 y 3.5-4.75; 3 water/pond x 6.25-7.75 y 9-10; 4 water/pond x 1.25-2.75 y 4-5; 5 road/bridge-deck x 4-5 y 8.5-12; 6 road/bridge-deck x 4-5 y 2-5.5; 7 road/bridge-deck x 2.25-6.75 y 7.9-8.6; 8 road/bridge-deck x 2.25-6.75 y 5.4-6.1; 9 road/bridge-deck x 2.25-3.25 y 5.5-8; 10 road/bridge-deck x 5.75-6.75 y 6-8.5; 11 brush/reeds x 2.75-3.6 y 9.25-10.5; 12 brush/reeds x 5.4-6.25 y 3.5-4.75; 13 brush/reeds x 5.4-6.25 y 9-10; 14 brush/reeds x 2.75-3.6 y 4-5; 15 brush/reeds x 0.25-2 y 6.5-7.5; 16 brush/reeds x 7-8.75 y 6.5-7.5; 17 building/house x 7.25-8.5 y 11.25-12.5; 18 building/house x 0.5-1.75 y 1.5-2.75; 19 cover/cart x 0.25-1 y 8-8.5; 20 cover/cart x 8-8.75 y 5.5-6; 21 cover/barrels x 7.9-8.75 y 8-8.4; 22 cover/barrels x 0.25-1.1 y 5.6-6; 23 cover/fence x 3-3.9 y 11.5-11.9; 24 cover/fence x 5.1-6 y 2.1-2.5; 25 water/pond x 3.5-5.5 y 6.25-7.75.

### Long Lane (`long-lane`, Gold League)
A mill farm. A lane runs straight down the middle between two tall hedges, a firing gallery from end to end. Either side of it is standing corn, right across the middle of the field: slower going, and nobody in it can be seen until they are on top of you. The mill and the barn anchor each camp, with haystacks and fences to shoot from. 17 blocks; zone free: 89%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
H H H . . . . . . . . . . . . . . . 
H H H . . . . : : : : . . . . . . . 
H H H . . . . : : : : . . . . H H H 
. . . . . . = : : : : . . . . H H H 
. . . . . . . : : : : = = . . H H H 
. . . . . . . : : : : . . . . . . . 
= = . . . . . : : : : . . . . . = = 
. . . . . . . : : : : . . . . . . . 
. " " " " # # : : : : # # " " " " . 
. " " " " # # : : : : # # " " " " . 
. " " " " # # : : : : # # " " " " .   y 6.4: side 1's zone ends
. " " " " # # : : : : # # " " " " . 
. " " " " # # : : : : # # " " " " .   y 7.6: side 0's zone starts
. " " " " # # : : : : # # " " " " . 
. . . . . . . : : : : . . . . . . . 
= = . . . . . : : : : . . . . . = = 
. . . . . . . : : : : . . . . . . . 
H H H . . = = : : : : . . . . . . . 
H H H . . . . : : : : = . . . . . . 
H H H . . . . : : : : . . . . H H H 
. . . . . . . : : : : . . . . H H H 
. . . . . . . . . . . . . . . H H H 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 wall/hedge-wall x 2.75-3.25 y 5.25-8.75; 2 wall/hedge-wall x 5.75-6.25 y 5.25-8.75; 3 brush/cornfield x 0.5-2.5 y 5.5-8.5; 4 brush/cornfield x 6.5-8.5 y 5.5-8.5; 5 building/mill x 0-1.5 y 10-11.5; 6 building/mill x 7.5-9 y 2.5-4; 7 building/barn x 7.5-9 y 11.25-12.5; 8 building/barn x 0-1.5 y 1.5-2.75; 9 cover/haystack x 0.25-1.05 y 8.9-9.4; 10 cover/haystack x 7.95-8.75 y 4.6-5.1; 11 cover/haystack x 8-8.75 y 9-9.5; 12 cover/haystack x 0.25-1 y 4.5-5; 13 cover/fence x 2.75-3.5 y 10-10.4; 14 cover/fence x 5.5-6.25 y 3.6-4; 15 cover/fence x 5.5-6.25 y 10.4-10.8; 16 cover/fence x 2.75-3.5 y 3.2-3.6; 17 road/road x 3.5-5.5 y 2-12.

### Bastions (`bastions`, Champion League)
Each side holds a bastion: a wall with a barricaded gate, sandbags along its inner face and a barracks behind. The made roads go round the outside of both walls, so a fast army flanks; a heavy one breaks the gate and comes straight down the middle, through the long grass of no man's land. 23 blocks; zone free: 87%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . : : . . H H H . . . 
" " " . . = = . : : . H H H H . . . 
" " " . . . . . : : . H H H H . . . 
" " " . . . . . : : . . . . . . . . 
. . . . = = . . : : . . = = . . . . 
. . . . . . . . : : . . . . . . . . 
: : : # # # # % % % % # # # # : : : 
: : : . . . . . : : . . . . . : : : 
: : : . . . . . : : . . . . . : : : 
: : : . " " " . : : . " " " . : : :   y 6.4: side 1's zone ends
: : : . " " " . : : . " " " . : : : 
: : : . . . . . : : . . . . . : : :   y 7.6: side 0's zone starts
: : : . . . . . : : . . . . . : : : 
: : : # # # # % % % % # # # # : : : 
. . . . . . . . : : . . . . . . . . 
. . . . = = . . : : . . = = . . . . 
. . . . . . . . : : . . . . . " " " 
. . . H H H H . : : . . . . . " " " 
. . . H H H H . : : . = = . . " " " 
. . . H H H . . : : . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 wall/wall x 1.5-3.5 y 8.5-9; 2 wall/wall x 5.5-7.5 y 5-5.5; 3 wall/wall x 5.5-7.5 y 8.5-9; 4 wall/wall x 1.5-3.5 y 5-5.5; 5 barricade/barricade x 3.5-5.5 y 8.5-9; 6 barricade/barricade x 3.5-5.5 y 5-5.5; 7 building/hall x 1.5-3.25 y 10.5-11.75; 8 building/hall x 5.75-7.5 y 2.25-3.5; 9 road/road x 0.25-1.25 y 5-9; 10 road/road x 7.75-8.75 y 5-9; 11 road/road x 4-5 y 9-12; 12 road/road x 4-5 y 2-5; 13 cover/sandbags x 2-3 y 9.4-9.8; 14 cover/sandbags x 6-7 y 4.2-4.6; 15 cover/sandbags x 6-7 y 9.4-9.8; 16 cover/sandbags x 2-3 y 4.2-4.6; 17 cover/crates x 5.5-6.5 y 11-11.4; 18 cover/crates x 2.5-3.5 y 2.6-3; 19 brush/brush x 2-3.5 y 6.5-7.5; 20 brush/brush x 5.5-7 y 6.5-7.5; 21 brush/brush x 7.5-8.75 y 10-11.5; 22 brush/brush x 0.25-1.5 y 2.5-4; 23 road/road x 4-5 y 5.5-8.5.

### Broken Bridge (`broken-bridge`, Champion League)
A river with a single stone bridge and the road over it. The fords at either edge are jammed with logs until someone clears them. Both banks are thick with reeds right up to the bridge, so whoever crosses walks into a bank they cannot see into. A ruined gatehouse and a mill house stand back from the water. 21 blocks; zone free: 92%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . H H H . . . . . . . . . . . . . 
. . H H H . . . : : . . . . . . . . 
. . H H H . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . H H . . . . . 
. . . . . = = = : : . H H . . . . . 
. = . . . . . . : : . . . . . = = . 
. . . " " " " . : : . " " " " . . . 
. . . " " " " : : : : " " " " . . . 
% % % ~ ~ ~ ~ : : : : ~ ~ ~ ~ % % %   y 6.4: side 1's zone ends
% % % ~ ~ ~ ~ : : : : ~ ~ ~ ~ % % % 
. . . " " " " : : : : " " " " . . .   y 7.6: side 0's zone starts
. . . " " " " . : : . " " " " . . . 
. = = . . . . . : : . . . . . . = . 
. . . . . H H . : : = = = . . . . . 
. . . . . H H . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . H H H . . 
. . . . . . . . : : . . . H H H . . 
. . . . . . . . . . . . . H H H . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 water/river x 1.5-3.5 y 6.5-7.5; 2 water/river x 5.5-7.5 y 6.5-7.5; 3 barricade/logs x 0-1.5 y 6.75-7.25; 4 barricade/logs x 7.5-9 y 6.75-7.25; 5 road/road x 4-5 y 7.75-11.5; 6 road/road x 4-5 y 2.5-6.25; 7 brush/reeds x 1.5-3.5 y 7.5-8.25; 8 brush/reeds x 5.5-7.5 y 5.75-6.5; 9 brush/reeds x 5.5-7.5 y 7.5-8.25; 10 brush/reeds x 1.5-3.5 y 5.75-6.5; 11 building/ruin x 2.5-3.5 y 9-10; 12 building/ruin x 5.5-6.5 y 4-5; 13 building/house x 6.5-8 y 10.5-11.75; 14 building/house x 1-2.5 y 2.25-3.5; 15 cover/crates x 5.25-6.25 y 9-9.4; 16 cover/crates x 2.75-3.75 y 4.6-5; 17 cover/cart x 0.5-1.25 y 8.5-9; 18 cover/cart x 7.75-8.5 y 5-5.5; 19 cover/barrels x 7.75-8.5 y 8.75-9.15; 20 cover/barrels x 0.5-1.25 y 4.85-5.25; 21 road/bridge-deck x 3.5-5.5 y 6.25-7.75.

### Switchback (`switchback`, Champion League)
A mountain track. Two cliffs reach in from opposite sides, so the road climbs in a long S: out past your own cliff, across the middle, round theirs. A ruined chapel stands at each end of the middle stretch, there is scrub at the bend to lie in wait in, and fences and sandbags at each turn. 19 blocks; zone free: 91%.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . : : . . . . . . . . . . . 
. . . . . : : . . . . . . . . . . . 
. = = . . : : . . . . . . . " " " . 
. . . . . : : . . . = = . " " " " " 
. . . . . : : . . . . . . . " " " . 
. . . = . : : . # # # # # H H H H H 
. . . = . : : . # # # # # H H H H H 
. . . . . : : . " " " . . . . . . . 
. . . . . : : . " " " . . . . . . . 
. H H . . : : : : : : : : . . H H .   y 6.4: side 1's zone ends
. H H . . : : : : : : : : . . H H . 
. . . . . . . " " " . : : . . . . .   y 7.6: side 0's zone starts
. . . . . . . " " " . : : . . . . . 
H H H H H # # # # # . : : . = . . . 
H H H H H # # # # # . : : . = . . . 
. " " " . . . . . . . : : . . . . . 
" " " " " . = = . . . : : . . . . . 
. " " " . . . . . . . : : . . = = . 
. . . . . . . . . . . : : . . . . . 
. . . . . . . . . . . : : . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/rock x 0-2.5 y 8.5-9.5; 2 building/rock x 6.5-9 y 4.5-5.5; 3 wall/wall x 2.5-5 y 8.75-9.25; 4 wall/wall x 4-6.5 y 4.75-5.25; 5 building/chapel x 7.5-8.5 y 6.5-7.5; 6 building/chapel x 0.5-1.5 y 6.5-7.5; 7 road/road x 5.5-6.5 y 7.5-12; 8 road/road x 2.5-3.5 y 2-6.5; 9 cover/fence x 6.75-7.75 y 8.8-9.2; 10 cover/fence x 1.25-2.25 y 4.8-5.2; 11 cover/crates x 3-4 y 10-10.4; 12 cover/crates x 5-6 y 3.6-4; 13 cover/sandbags x 7.5-8.5 y 10.5-10.9; 14 cover/sandbags x 0.5-1.5 y 3.1-3.5; 15 brush/brush x 3.5-5 y 7.6-8.6; 16 brush/brush x 4-5.5 y 5.4-6.4; 17 brush/brush x 0.25-2.25 y 9.75-10.75; 18 brush/brush x 6.75-8.75 y 3.25-4.25; 19 road/road x 2.5-6.5 y 6.5-7.5.

## Campaign sets

Campaign levels that used to have a few round rocks are now fought on a set piece (`engine/core/sets.ts`): a small
designed place, lighter than an arena so the campaign stays readable, built the same way (one half plus its mirror
image). A level names its set (`set` in campaign.ts). Rocks (`obstacles`) still work in the engine and are still what
puzzles, the Daily and the Gauntlet use.

For a frontend: `level.terrain` (`Block[]`, the same array `levelConfig(level).terrain` passes to the match) and
`level.marks` (`ArenaMark[]`) on `LevelDef`; `level.set` is the set's id and `SETS[level.set]` / `setById(id)` its
`{ id, name, idea, blocks, marks }`.

### Farmstead (`farmstead`)
A cart track between two cornfields, a barn, a fence line and a haystack to shoot from. 9 blocks; zone free: 95%. Levels: 4 Fence Line.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. H H . . . . . . . . . . . . . . . 
H H H H . . . . . . . . . . . . . . 
H H H H . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . = = . . : : . . . . . . . . 
. . . . . . . . : : . . = = . . . . 
" " " " . . . . : : . . . . " " " " 
" " " " . . . . : : . . . . " " " "   y 6.4: side 1's zone ends
" " " " . . . . : : . . . . " " " " 
" " " " . . . . : : . . . . " " " "   y 7.6: side 0's zone starts
. . . . = = . . : : . . . . . . . . 
. . . . . . . . : : . . = = . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . H H H H 
. . . . . . . . . . . . . . H H H H 
. . . . . . . . . . . . . . . H H . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 brush/cornfield x 0.25-1.75 y 6-8; 2 brush/cornfield x 7.25-8.75 y 6-8; 3 cover/fence x 2-3.25 y 7.9-8.3; 4 cover/fence x 5.75-7 y 5.7-6.1; 5 cover/haystack x 6.25-7 y 8.5-9; 6 cover/haystack x 2-2.75 y 5-5.5; 7 building/barn x 7.25-8.75 y 10.5-11.75; 8 building/barn x 0.25-1.75 y 2.25-3.5; 9 road/road x 4-5 y 3-11.

### The Old Bridge (`old-bridge`)
A river and one wide stone bridge, reeds on the banks and crates on the quay. 9 blocks; zone free: 99%. Levels: 6 The Old Bridge (boss), 40 Hold the Ford.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . = = = . . : : . . . . . . . . 
. . . . . . . . : : . . . . " " " . 
. . . . . . : : : : : : . . " " " " 
~ ~ ~ ~ ~ ~ : : : : : : ~ ~ ~ ~ ~ ~   y 6.4: side 1's zone ends
~ ~ ~ ~ ~ ~ : : : : : : ~ ~ ~ ~ ~ ~ 
" " " " . . : : : : : : . . . . . .   y 7.6: side 0's zone starts
. " " " . . . . : : . . . . . . . . 
. . . . . . . . : : . . = = = . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 water/river x 0-3 y 6.6-7.4; 2 water/river x 6-9 y 6.6-7.4; 3 road/road x 4-5 y 7.75-10.5; 4 road/road x 4-5 y 3.5-6.25; 5 brush/reeds x 0.25-2 y 7.6-8.3; 6 brush/reeds x 7-8.75 y 5.7-6.4; 7 cover/crates x 6.25-7.25 y 8.5-8.9; 8 cover/crates x 1.75-2.75 y 5.1-5.5; 9 road/bridge-deck x 3-6 y 6.25-7.75.

### Cinder Road (`cinder-road`)
A burnt hamlet on the road: two gutted houses, a cart, a fence and scrub that grew back. 9 blocks; zone free: 98%. Levels: 10 Cinder Road.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. " " . . = = . : : . . . . . . . . 
" " " " . . . . : : . . . . = = . . 
" " " " . . . . : : . . . . . . . . 
. . . . H H H . : : . . . . . . . . 
. . . . H H H . : : . . . . . . . .   y 6.4: side 1's zone ends
. . . . . . . . : : . H H H . . . . 
. . . . . . . . : : . H H H . . . .   y 7.6: side 0's zone starts
. . . . . . . . : : . . . . " " " " 
. . = = . . . . : : . . . . " " " " 
. . . . . . . . : : . = = . . " " . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/ruin x 5.75-6.75 y 7-8; 2 building/ruin x 2.25-3.25 y 6-7; 3 cover/cart x 1-1.75 y 8.5-9; 4 cover/cart x 7.25-8 y 5-5.5; 5 cover/fence x 5.5-6.5 y 9-9.4; 6 cover/fence x 2.5-3.5 y 4.6-5; 7 brush/brush x 7.25-8.75 y 8-9.25; 8 brush/brush x 0.25-1.75 y 4.75-6; 9 road/road x 4-5 y 2.5-11.5.

### The Glade (`glade`)
A forest path through a clearing: two mossy crags, a fallen trunk and deep thickets either side. 9 blocks; zone free: 99%. Levels: 13 Hidden Paths, 18 Heart of the Wood (boss).

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. " " " . . . . : : . . . . . . . . 
" " " " . . . . : : . . . . . . . . 
" " " " . . . . : : . . . . . " " . 
. " " " . . . . : : . . . . " " " " 
. . . . . % % . : : . . . . " " " " 
. . . . . . . . : : . . . . " " " " 
. . . . H H . . : : . . H H . . . .   y 6.4: side 1's zone ends
. . . . H H . . : : . . H H . . . . 
" " " " . . . . : : . . . . . . . .   y 7.6: side 0's zone starts
" " " " . . . . : : . % % . . . . . 
" " " " . . . . : : . . . . " " " . 
. " " . . . . . : : . . . . " " " " 
. . . . . . . . : : . . . . " " " " 
. . . . . . . . : : . . . . " " " . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/rock x 2-3 y 6.5-7.5; 2 building/rock x 6-7 y 6.5-7.5; 3 barricade/logs x 5.25-6.75 y 8.25-8.65; 4 barricade/logs x 2.25-3.75 y 5.35-5.75; 5 brush/brush x 0.25-1.75 y 7.6-9.25; 6 brush/brush x 7.25-8.75 y 4.75-6.4; 7 brush/brush x 7-8.75 y 8.75-10.25; 8 brush/brush x 0.25-2 y 3.75-5.25; 9 road/road x 4-5 y 3-11.

### Lumber Camp (`lumber-camp`)
A felling camp: log piles across the middle, a sawyer's hut, crates of tools and uncut brush. 9 blocks; zone free: 96%. Levels: 15 Thicket.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . : : . . . . . H H . 
. . . . . . . . : : . . . . H H H . 
. . . . . . . . : : . . . . H H H . 
. . . . . . . . : : . . . . . . . . 
. " " " . = = . : : . . . . . . . . 
" " " " . . . . : : . . . . . . . . 
" " " " . . . . : : . . . . . . . . 
. . . . % % . . : : . . % % . . . .   y 6.4: side 1's zone ends
. . . . % % . . : : . . % % . . . . 
. . . . . . . . : : . . . . " " " "   y 7.6: side 0's zone starts
. . . . . . . . : : . . . . " " " " 
. . . . . . . . : : . = = . " " " . 
. . . . . . . . : : . . . . . . . . 
. H H H . . . . : : . . . . . . . . 
. H H H . . . . : : . . . . . . . . 
. H H . . . . . : : . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 barricade/logs x 1.75-3.25 y 6.7-7.3; 2 barricade/logs x 5.75-7.25 y 6.7-7.3; 3 building/house x 0.5-1.75 y 9.5-10.75; 4 building/house x 7.25-8.5 y 3.25-4.5; 5 cover/crates x 5.5-6.5 y 8.5-8.9; 6 cover/crates x 2.5-3.5 y 5.1-5.5; 7 brush/brush x 7-8.75 y 7.6-8.75; 8 brush/brush x 0.25-2 y 5.25-6.4; 9 road/road x 4-5 y 3-11.

### The Narrows (`crags`)
Crags close in from both sides and leave one track up the middle, with scrub under the rock. 9 blocks; zone free: 97%. Levels: 20 The Narrows.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . = . . " " . . 
. . . . . . . . : : . . . " " " H H 
H H H . . . . . : : . . . " " " H H 
H H H . . . . . : : . . . . . H H H   y 6.4: side 1's zone ends
H H H . . . . . : : . . . . . H H H 
H H " " " . . . : : . . . . . H H H   y 7.6: side 0's zone starts
H H " " " . . . : : . . . . . . . . 
. . " " . . = . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/rock x 0-1.5 y 6-7.25; 2 building/rock x 7.5-9 y 6.75-8; 3 building/rock x 0-1 y 7.25-8.5; 4 building/rock x 8-9 y 5.5-6.75; 5 cover/sandbags x 2.75-3.75 y 8.4-8.8; 6 cover/sandbags x 5.25-6.25 y 5.2-5.6; 7 brush/brush x 1-2.25 y 7.6-8.75; 8 brush/brush x 6.75-8 y 5.25-6.4; 9 road/road x 4-5 y 3-11.

### Toll Gate (`toll-gate`)
A palisade across the pass between two crags: the gate in the middle, a track either side. 9 blocks; zone free: 99%. Levels: 23 Iron Gate, 24 The Iron Pass (boss).

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . " " . 
. . . . . . . . : : . = = . . " " " 
. . . . . . . . : : . . . . . " " " 
H H H . . . . . : : . . . . . H H H 
H H H . . . # . : : . # . . . H H H   y 6.4: side 1's zone ends
H H H . . . # . : : . # . . . H H H 
H H H . . . . . : : . . . . . H H H   y 7.6: side 0's zone starts
" " " . . . . . : : . . . . . . . . 
" " " . . = = . : : . . . . . . . . 
. " " . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . : : . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/rock x 0-1.5 y 6.25-7.75; 2 building/rock x 7.5-9 y 6.25-7.75; 3 wall/palisade x 2.75-3.75 y 6.75-7.25; 4 wall/palisade x 5.25-6.25 y 6.75-7.25; 5 cover/sandbags x 2.5-3.5 y 8.4-8.8; 6 cover/sandbags x 5.5-6.5 y 5.2-5.6; 7 brush/brush x 0.25-1.5 y 8-9.25; 8 brush/brush x 7.5-8.75 y 4.75-6; 9 road/road x 4-5 y 3-11.

### The Breach (`keep-yard`)
The keep's outer wall, breached in the middle round a fallen statue, with a paved yard behind. 9 blocks; zone free: 99%. Levels: 28 The Breach, 30 The High Keep (boss).

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. " " " . . . . . . . . . . . . . . 
. " " " . . . . . . . . . . . . . . 
. " " " . . : : : : : : . . . . . . 
. . . . . . : : : : : : . . = = . . 
. . . . . . : : : : : : . . . . . . 
. . # # # . . . . . . . . # # # . .   y 6.4: side 1's zone ends
. . # # # . . . . . . . . # # # . . 
. . . . . . : : : : : : . . . . . .   y 7.6: side 0's zone starts
. . = = . . : : : : : : . . . . . . 
. . . . . . : : : : : : . . " " " . 
. . . . . . . . . . . . . . " " " . 
. . . . . . . . . . . . . . " " " . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 wall/wall x 0.75-2.75 y 6.75-7.25; 2 wall/wall x 6.25-8.25 y 6.75-7.25; 3 road/plaza x 3-6 y 7.5-9; 4 road/plaza x 3-6 y 5-6.5; 5 cover/sandbags x 1-2 y 8.25-8.65; 6 cover/sandbags x 7-8 y 5.35-5.75; 7 brush/brush x 7-8.5 y 8.5-9.75; 8 brush/brush x 0.5-2 y 4.25-5.5; 9 building/statue x 4.25-4.75 y 6.75-7.25.

### Frozen Camp (`frozen-camp`)
A winter camp round a frozen pool: two ice-bound crags, trodden paths, supply crates, frosted scrub. 9 blocks; zone free: 99%. Levels: 33 Colours, 36 The Frozen Reach (boss).

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. " " . . . . . . . . . . . . . . . 
" " " " . . . . . . . . . . . . . . 
" " " " . . . . . . . . . . . . . . 
. . . . . : : . . . . : : . . = = . 
. . . . . : : . . . . : : . . . . . 
. . . . . : : . . . . : : . . . . . 
. . H H H : : ~ ~ ~ ~ : : H H H . .   y 6.4: side 1's zone ends
. . H H H : : ~ ~ ~ ~ : : H H H . . 
. . . . . : : . . . . : : . . . . .   y 7.6: side 0's zone starts
. . . . . : : . . . . : : . . . . . 
. = = . . : : . . . . : : . . . . . 
. . . . . . . . . . . . . . " " " " 
. . . . . . . . . . . . . . " " " " 
. . . . . . . . . . . . . . . " " . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/rock x 1.25-2.25 y 6.6-7.4; 2 building/rock x 6.75-7.75 y 6.6-7.4; 3 road/road x 2.5-3.5 y 5-9; 4 road/road x 5.5-6.5 y 5-9; 5 cover/crates x 0.5-1.5 y 8.5-8.9; 6 cover/crates x 7.5-8.5 y 5.1-5.5; 7 brush/brush x 7.25-8.75 y 9-10.25; 8 brush/brush x 0.25-1.75 y 3.75-5; 9 water/pond x 3.75-5.25 y 6.5-7.5.

### Ruined Chapel (`ruined-chapel`)
A roofless chapel in the middle, toppled columns, a processional way either side and an overgrown yard. 9 blocks; zone free: 99%. Levels: 42 The Sky Throne (boss), 47 The Drowned Bell.

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . : : : . . : : : . . " " . 
. . . . . : : : . . : : : . " " " " 
. . . = = : : : . . : : : . " " " " 
. . . . . : : : . . : : : . . . . . 
. . . . H : : : . . : : : . . . . . 
. . . . H : : : H H : : : . . . . .   y 6.4: side 1's zone ends
. . . . . : : : H H : : : H . . . . 
. . . . . : : : . . : : : H . . . .   y 7.6: side 0's zone starts
. . . . . : : : . . : : : . . . . . 
" " " " . : : : . . : : : = = . . . 
" " " " . : : : . . : : : . . . . . 
. " " . . : : : . . : : : . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/statue x 6.5-7 y 7.25-7.75; 2 building/statue x 2-2.5 y 6.25-6.75; 3 road/road x 2.75-3.75 y 4-10; 4 road/road x 5.25-6.25 y 4-10; 5 cover/fence x 6.5-7.5 y 8.6-9; 6 cover/fence x 1.5-2.5 y 5-5.4; 7 brush/brush x 0.25-1.75 y 8.5-9.75; 8 brush/brush x 7.25-8.75 y 4.25-5.5; 9 building/ruin x 4-5 y 6.5-7.5.

### Reed Marsh (`reed-marsh`)
A boardwalk across the fen between two pools, reed beds on every shore, a stack of barrels. 9 blocks; zone free: 99%. Levels: 43 Reedwater, 45 Bramble Causeway, 48 Mirelight (boss).

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . : : : : . . . . . . . 
. . . . . . . : : : : . . . . . . . 
. . . . . . . : : : : . . . . . . . 
. . . . . . . : : : : . . . . . . . 
. . . . = = . : : : : . . . . " " " 
. . . . . . . : : : : . . . . " " " 
. . . . . . . : : : : . . . . " " " 
. . ~ ~ ~ ~ " : : : : " ~ ~ ~ ~ . .   y 6.4: side 1's zone ends
. . ~ ~ ~ ~ " : : : : " ~ ~ ~ ~ . . 
" " " . . . . : : : : . . . . . . .   y 7.6: side 0's zone starts
" " " . . . . : : : : . . . . . . . 
" " " . . . . : : : : . = = . . . . 
. . . . . . . : : : : . . . . . . . 
. . . . . . . : : : : . . . . . . . 
. . . . . . . : : : : . . . . . . . 
. . . . . . . : : : : . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 water/pond x 1.25-2.75 y 6.5-7.5; 2 water/pond x 6.25-7.75 y 6.5-7.5; 3 brush/reeds x 2.75-3.5 y 6.4-7.6; 4 brush/reeds x 5.5-6.25 y 6.4-7.6; 5 brush/reeds x 0.25-1.25 y 7.6-9; 6 brush/reeds x 7.75-8.75 y 5-6.4; 7 cover/barrels x 6-6.9 y 8.5-8.9; 8 cover/barrels x 2.1-3 y 5.1-5.5; 9 road/bridge-deck x 3.5-5.5 y 3-11.

### Wreckers' Beach (`wreck-beach`)
A wreck's ribs across the sand, sea-rocks, a tide pool, salvage crates and dune grass. 9 blocks; zone free: 98%. Levels: 49 Landfall, 51 Wreckers' Beach, 54 The Saltwind Light (boss).

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . ~ ~ . . . . . . . . . " " " " 
. . . ~ ~ . . . . . . = = = " " " " 
. . . . . . . . . . . . . . " " " . 
. . . . . . . . . . . . . . . . . . 
. . H . . . . . . . . . . . . . . . 
. H H H . . . . % % . . . . . H . .   y 6.4: side 1's zone ends
. . H . . . . . % % . . . . H H H . 
. . . . . . . . . . . . . . . H . .   y 7.6: side 0's zone starts
. . . . . . . . . . . . . . . . . . 
. " " " . . . . . . . . . . . . . . 
" " " " = = = . . . . . . ~ ~ . . . 
" " " " . . . . . . . . . ~ ~ . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 building/rock x 0.75-1.75 y 6.25-7.25; 2 building/rock x 7.25-8.25 y 6.75-7.75; 3 water/pond x 6.5-7.5 y 9-9.75; 4 water/pond x 1.5-2.5 y 4.25-5; 5 cover/crates x 2.25-3.25 y 9-9.4; 6 cover/crates x 5.75-6.75 y 4.6-5; 7 brush/brush x 0.25-2 y 8.75-10; 8 brush/brush x 7-8.75 y 4-5.25; 9 barricade/wagon x 3.75-5.25 y 6.75-7.25.

### The Broken Gate (`citadel-breach`)
The citadel's curtain wall, fallen in three places, a paved court behind and rubble to hide in. 9 blocks; zone free: 99%. Levels: 55 The Broken Gate, 56 Ember Stair, 60 Crownfall (boss).

```
. . . . . . . . . . . . . . . . . .   y 0
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. " " " . . . . . . . . . . . . . . 
. " " " . . . . . . . . . . . . . . 
. " " " . . . : : : : . . . . . . . 
. . . . . . . : : : : . . = = . . . 
. . . . . . . : : : : . . . . . . . 
. . . . . . . : : : : . . . . . . . 
# # . . . H H : : : : H H . . . # #   y 6.4: side 1's zone ends
# # . . . H H : : : : H H . . . # # 
. . . . . . . : : : : . . . . . . .   y 7.6: side 0's zone starts
. . . . . . . : : : : . . . . . . . 
. . . = = . . : : : : . . . . . . . 
. . . . . . . : : : : . . . " " " . 
. . . . . . . . . . . . . . " " " . 
. . . . . . . . . . . . . . " " " . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . . 
. . . . . . . . . . . . . . . . . .   y 14
```

Blocks: 1 wall/wall x 0-1.25 y 6.75-7.25; 2 wall/wall x 7.75-9 y 6.75-7.25; 3 building/ruin x 2.5-3.5 y 6.5-7.5; 4 building/ruin x 5.5-6.5 y 6.5-7.5; 5 cover/sandbags x 1.5-2.5 y 8.5-8.9; 6 cover/sandbags x 6.5-7.5 y 5.1-5.5; 7 brush/brush x 7-8.5 y 9-10.25; 8 brush/brush x 0.5-2 y 3.75-5; 9 road/plaza x 3.5-5.5 y 4.5-9.5.

## The ladder

Four leagues of three arenas, unlocked by trophies:

| league | trophies | arenas | win coins | loss |
| --- | --- | --- | --- | --- |
| Bronze League | 0 | Twin Gates, The Crossing, Market Square | 40 | -8 |
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
| twin-gates      |      1 |      32 |       47% |       53% |  47%/ 52%/  1%  |        14% |       1% |     23.3 s |       13.1 |
| the-crossing    |      1 |      32 |       47% |       53% |  48%/ 51%/  1%  |        14% |       1% |     23.5 s |       12.5 |
| crate-yard      |      1 |      32 |       44% |       56% |  50%/ 50%/  0%  |        14% |       1% |     23.3 s |       12.8 |
| courtyard       |      2 |      32 |       47% |       53% |  49%/ 49%/  2%  |         7% |       0% |     19.7 s |       12.1 |
| watchtowers     |      2 |      32 |       47% |       53% |  51%/ 48%/  1%  |        14% |       0% |     21.1 s |       12.5 |
| barricade-pass  |      2 |      32 |       47% |       53% |  50%/ 49%/  1%  |        19% |       0% |     23.1 s |       12.7 |
| old-village     |      3 |      32 |       50% |       50% |  49%/ 51%/  0%  |        17% |       1% |     24.0 s |       12.8 |
| the-fens        |      3 |      32 |       53% |       47% |  49%/ 49%/  2%  |        13% |       1% |     22.1 s |       12.3 |
| long-lane       |      3 |      32 |       50% |       50% |  53%/ 46%/  1%  |        10% |       1% |     20.3 s |       12.3 |
| bastions        |      4 |      32 |       44% |       56% |  45%/ 54%/  2%  |        15% |       3% |     25.0 s |       12.3 |
| broken-bridge   |      4 |      32 |       53% |       47% |  47%/ 52%/  1%  |        14% |       1% |     21.2 s |       12.0 |
| switchback      |      4 |      32 |       53% |       47% |  49%/ 50%/  1%  |        14% |       0% |     22.9 s |       12.7 |

| unit             | cost | arena pick | arena win | open pick | open win |
| ---- | ---- | ---------- | --------- | --------- | -------- |
| Blade Trio       |    3 |         7% |       54% |        6% |      51% |
| Pikeman          |    3 |         6% |       49% |        6% |      53% |
| Duelist          |    3 |         5% |       47% |        5% |      49% |
| Bulwark          |    4 |         5% |       54% |        6% |      51% |
| Hookwarden       |    4 |         4% |       56% |        6% |      58% |
| Mine             |    2 |         4% |       37% |        4% |      43% |
| Harrier          |    4 |         4% |       49% |        4% |      45% |
| Ranger           |    3 |         4% |       49% |        6% |      46% |
| Ballista         |    3 |         4% |       52% |        4% |      50% |
| Kegrunner        |    3 |         4% |       46% |        4% |      44% |
| Lancer           |    4 |         3% |       47% |        5% |      53% |
| Thornweaver      |    4 |         3% |       50% |        3% |      53% |
| Bombard          |    4 |         3% |       59% |        1% |      41% |
| Lamplighter      |    3 |         3% |       52% |        3% |      51% |
| Hive             |    4 |         3% |       51% |        2% |      51% |
| Trickster        |    4 |         3% |       46% |        3% |      45% |
| Outrider         |    4 |         3% |       51% |        3% |      49% |
| Ravager          |    4 |         3% |       47% |        3% |      49% |
| Shade            |    4 |         3% |       42% |        2% |      50% |
| Rimecaller       |    4 |         3% |       51% |        3% |      44% |
| Tinker           |    3 |         3% |       56% |        2% |      59% |
| Grenadier        |    4 |         3% |       46% |        2% |      50% |
| Sapper           |    4 |         2% |       44% |        2% |      47% |
| Tidecaller       |    5 |         2% |       56% |        2% |      68% |
| Stormcaller      |    5 |         2% |       54% |        3% |      52% |
| Medic            |    3 |         2% |       47% |        3% |      48% |
| Standard Bearer  |    3 |         2% |       48% |        1% |      35% |
| Gravecaller      |    4 |         2% |       52% |        2% |      46% |
| Lionheart        |    5 |         2% |       51% |        2% |      57% |
| Stone Colossus   |    5 |         1% |       57% |        2% |      49% |
| Griffin Knight   |    5 |         1% |       44% |        2% |      50% |

416 matches (AI difficulty 0.6) in 405s on 4 processes. All of the tool's targets met.

How to read it:
- **side0 / side1 win** is by match; with this few matches per arena one standard deviation is about 9 points, so
  anything from 35% to 65% is noise. `rounds 0/1/draw` is by battle and steadier.
- **time limit** is the share of battles that ran the full 45 s and were called on what was left. It is not low even
  on the open field: AI armies often end as fixed structures out of each other's reach (ballista against ballista, a
  Bombard inside its minimum range, a buried mine) or as a kiter against a wall of shields, which is the base game,
  not terrain. Arenas add to it: longer walks, shots blocked, and up to 6 seconds of lying in wait.
- **standoff** is the share of battles that ran to the limit with a mobile ground fighter still alive on both sides
  (support units and Hive / Gravecaller spawn not counted): the armies never finished each other. This is the number
  terrain could make worse; the target is under 8%.
- **Seats.** As a separate check, the same random army of eight was put on both sides (one the mirror image of the
  other) for 200 battles on the open field and on each arena: side 0 won 1,267 and side 1 1,225 of the 2,600 (108
  drawn), 50.8% to 49.2%, with no arena further than 106 to 88.
- **Units**: `pick` is the share of all fielded pieces, `win` the share of the rounds it was fielded in that its side
  won. No unit stats and no block health were changed for the new arenas.

### Campaign levels on sets

`npx vite-node tools/balance.ts`: every level that used to have rocks, played by a strong (0.9) and a mid (0.5) player AI,
10 attempts each, before (rocks, engine v2) and after (its set, engine v3). The targets are the tool's: the strong player
wins at least 50% of the time (40% on a boss). With 10 attempts a figure is good to about 15 points either way.

| level | set | strong before | strong after | mid before | mid after |
| --- | --- | --- | --- | --- | --- |
| 4 Fence Line | `farmstead` | 100% | 90% | 100% | 100% |
| 6 The Old Bridge (boss) | `old-bridge` | 80% | 80% | 50% | 80% |
| 10 Cinder Road | `cinder-road` | 80% | 70% | 60% | 70% |
| 13 Hidden Paths | `glade` | 80% | 90% | 90% | 60% |
| 15 Thicket | `lumber-camp` | 80% | 80% | 80% | 60% |
| 18 Heart of the Wood (boss) | `glade` | 50% | 20%, retuned: 65% | 20% | 40%, retuned: 50% |
| 20 The Narrows | `crags` | 80% | 80% | 70% | 50% |
| 23 Iron Gate | `toll-gate` | 70% | 80% | 40% | 60% |
| 24 The Iron Pass (boss) | `toll-gate` | 70% | 40%, retuned: 65% | 40% | 50%, retuned: 40% |
| 28 The Breach | `keep-yard` | 70% | 80% | 60% | 40% |
| 30 The High Keep (boss) | `keep-yard` | 80% | 70% | 50% | 70% |
| 33 Colours | `frozen-camp` | 40% | 60% | 20% | 60% |
| 36 The Frozen Reach (boss) | `frozen-camp` | 30% | 50% | 30% | 60% |
| 40 Hold the Ford | `old-bridge` | 80% | 90% | 60% | 70% |
| 42 The Sky Throne (boss) | `ruined-chapel` | 60% | 80% | 40% | 50% |
| 43 Reedwater | `reed-marsh` | 70% | 60% | 40% | 90% |
| 45 Bramble Causeway | `reed-marsh` | 60% | 50% | 40% | 40% |
| 47 The Drowned Bell | `ruined-chapel` | 60% | 80% | 60% | 80% |
| 48 Mirelight (boss) | `reed-marsh` | 70% | 60% | 40% | 20% |
| 49 Landfall | `wreck-beach` | 50% | 60% | 70% | 40% |
| 51 Wreckers' Beach | `wreck-beach` | 60% | 80% | 70% | 80% |
| 54 The Saltwind Light (boss) | `wreck-beach` | 30% | 50% | 50% | 60% |
| 55 The Broken Gate | `citadel-breach` | 60% | 50% | 10% | 20% |
| 56 Ember Stair | `citadel-breach` | 60% | 60% | 70% | 50% |
| 60 Crownfall (boss) | `citadel-breach` | 60% | 60% | 40% | 50% |

Two bosses fell under the target on their sets and were retuned (the `power` handicap in campaign.ts, 20 attempts each):
Heart of the Wood 1.21 to 1.14 (strong 20% to 65%, mid 50%) and The Iron Pass 0.94 to 0.88 (strong 40% to 65%, mid 40%).
Every other level met the targets as it stood. Levels without a set play exactly as before (the open-field sim is unchanged, bit for bit).

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
  live, during a battle: `hp`, `maxHp`, `alive`). Same ids, same order, zones included. `block.kind` says what it is
  (`isZone(kind)` for roads and brush, which are flat ground to draw under the units); `block.look` is the model hint
  (`LOOKS_BY_KIND` / `ARENA_LOOKS`); fall back on `block.kind`.
- **Decoration:** `arena.marks` in Arena, `level.marks` on a campaign level with a set: gates, bridges and doors as
  rectangles; trees, lamps, banners and signposts as points, some just off the board.
- **Who is hidden:** `body.hidden` (true for a buried mine, a cloaked Shade and a unit in brush that is not
  revealed), updated every step. Draw the player's own hidden units faint and the enemy's not at all, or as a rustle.
  `body.ambush` is true while it is lying in wait; `body.reveal` is the battle time until which brush does not hide
  it; `body.stealth` tells a mine or a cloak from brush.
- **Events** (docs/EVENTS.md): `blockhit`, `blockbreak`, `ricochet`, `crash`; and `Proj.over` for shots that arc over
  walls at fliers. Roads and brush add no events.
- **Placement:** `match.freeSpot(side, kind, x, y)` gives the snapped spot for a drag (or null);
  `match.spotBlocked(kind, x, y)` says whether an exact point is on a block (to tint the ghost). `match.buy` and
  `match.move` snap by themselves and throw `"No room"` only if the zone has no free spot. A drop on a road or in
  brush stays where it is put; tell the player a unit dropped in brush will lie in wait.
- **Arena cards:** `arena.name`, `arena.blurb` (one line) and `arena.idea` (a paragraph).
- **Ladder screens:** `arenaLadder()` (the save), `LEAGUES`, `leagueOf(trophies)`, `leagueProgress(trophies)`,
  `nextLeague(league)`, `ARENAS`, `arenaById(id)`, `arenaUnlocked(arena, best)`, `trophyChange(save, won)` (what the
  next result would do), `TROPHY_WIN`, `TROPHY_LOSS`, `ARENA_WIN_COINS`, `ARENA_PROMOTION_COINS`, `ARENA_DAILY_CAP`.
- **Result screen:** `end.result` (`delta`, `trophies`, `from`, `to`, `promoted`, `streak`), `end.reward`
  (`coins`, `parts`, `xp`, `capTo`), `end.chest` (as `winChest` returns; do not call `winChest` again).
- **Opponent card:** `next.foe.name`, `next.foe.title`, `next.foe.level`, `next.foe.trophies`, `next.foe.ai.tactic`.

With a backend (infra/README.md, "The Arena ladder: what the server checks") the server issues the match and settles
it from a replay; the base game's side of that is `base/src/online.ts`:
```ts
const srv = await onlineArenaMatch();                 // null offline: an ArenaMatch plus the server's id
const next = srv ?? nextArenaMatch();
// ... play ...
const result = srv ? await onlineArenaFinish(srv, match) : null;   // the server's ArenaResult; its ladder is now in the save
const end = result ? settleArena(next, result) : awardArena(next, match.winner === 0);   // one or the other, never both
```
`settleArena` pays what `awardArena` pays (coins, XP, chest) and leaves the trophies to the server. The server and
the client must run the same engine release (engine v3 from this change): a v2 client's Arena record does not replay
on a v3 server.
