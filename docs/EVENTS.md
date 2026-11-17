# Battle events and state the renderer reads

Source of truth: `engine/core/battle.ts` (`BattleEvent`, `Body`, `Proj`, `Zone`, `Fuse`). Events go in `battle.events` only when the
Battle was made with `events: true`; everything else is plain state to read each frame. Positions are world units (board 9 x 14).
Items marked **v2** are new; **v3** (engine lock 3) adds roads and brush: no new events, three new `Body` fields and
two new block kinds (see "Terrain").

## Events
Existing:
- `slash {id, x, y, a, r, side, spin?}`: a melee arc of radius r facing angle a. **v2** `spin: true` = Whirlwind, a full 360° spin.
- `shot {id, kind, x, y}`: a projectile left body `id`. Kinds: `arrow`, `bolt`, `grenade`, **v2** `shard` (Rimecaller frost), `shell` (Bombard), `pellet` (turret).
- `hit {id, x, y, dmg, side, shielded?, big?}`: damage landed on `id`. `shielded` is also set when a Bastion cut it.
- `boom {x, y, r, kind, side}`: a blast. Kinds: `mine`, `grenade`, `slam` and, **v2**: `quake` (Colossus Ascended, r 2), `erupt` (sapper surfacing), `shell` (Bombard), `shrapnel` (its 4 sub-blasts), `bomblet` (Cluster mine sub-blasts), `keg` (Kegrunner and Chain Keg), `pop` (Ascended-hive mite bursting on death), `talon` (Talon Dive), `mirror` (Mirror Hall decoy exploding).
- `zap {pts, side}`: chain lightning through `pts` (up to 8 jumps when Overcharged).
- `heal {from, to, x, y, amt}`: medic heal; **v2** also Rally pulses (from the banner) and Bloodlust (from = to = the ravager).
- `spawn {id, x, y, side, kind, from}`: a new body appeared. **v2** adds `kind` and `from` (maker id): mite, queen, golemling (Shardling), thrall, turret, decoy.
- `death {id, x, y, kind, side}`: a body died. Not sent for mines or kegs that blew themselves up (their `boom` is the end), or for decoys (see `pop`). A keg `death` means it was shot down and fizzled.
- `blink {id, x0, y0, x, y, side}`, `charge {id, x, y, a}`, `fuse {id, x, y}`, `end {winner}`: unchanged.

New in v2:
- `burrow {id, x, y, side}`: a sapper went under at battle start (sent from the constructor).
- `dig {id, x, y}`: a sapper's tunnel puff, about every 0.12 s while burrowed. Drop a dirt mound or trail mark here.
- `emerge {id, x, y, r, side, big}`: the sapper surfaced; everything within r is stunned. `big` = Cave-in (r 2, also damages).
- `dive {id, x, y, target, tx, ty, side}`: a harrier starts a dive from (x, y) at body `target` (last seen at tx, ty).
- `chill {id, x, y, dur}`: body `id` is slowed for `dur` s (frost shard).
- `freeze {id, x, y, dur}`: body `id` is frozen solid for `dur` s (Deep Freeze).
- `aura {id, x, y, r, side, rally}`: Standard Bearer aura pulse (once a second). `rally` = the Ascended version.
- `parry {id, x, y, by, riposte}`: the duelist `id` blocked a blow from `by` (-1 if not a melee striker). `riposte` = it struck back.
- `brace {id, x, y, a}`: a pikeman set its pikes facing angle a.
- `impale {id, target, x, y}`: pikeman `id` stopped the charging `target` (lancer or keg) at (x, y).
- `raise {id, from, x, y, side}`: Gravecaller `from` raised thrall `id` at (x, y). A `spawn` follows.
- `build {id, x, y, dur}`: tinker `id` started building a turret at (x, y); done in `dur` s (a `spawn` of kind turret then).
- `repair {from, to, x, y, amt}`: tinker `from` repaired structure `to`.
- `decoy {id, from, x, y, side}`: trickster `from` threw out decoy `id`. A `spawn` follows.
- `pop {id, x, y, side}`: decoy `id` vanished (struck down, or its trickster died). Mirror Hall decoys also `boom` (kind `mirror`).
- `light {id, x, y}`: a keg's fuse is lit (it starts its run).
- `kegdrop {x, y, at, side}`: Chain Keg left a second keg at (x, y) that blows at battle time `at` (also in `battle.fuses`).
- `bomblets {x, y, pts, at, side}`: Cluster (3) or Shrapnel (4) bomblets thrown from (x, y) to `pts`, bursting at time `at` (also in `battle.fuses`).
- `zone {id, x, y, r, until, side, kind, root}`: ground that hurts the other side until battle time `until` (also in `battle.zones`). `kind` `fire` (Firebomb) or `thorn` (Thornweaver brambles, which also snare); `root` = Bramble Crown seized everything under it on sprouting.
- `hook {id, target, x, y, tx, ty, side}`: Hookwarden `id` threw its chain from (x, y) at `target` standing at (tx, ty). Iron Tether throws two.
- `reel {id, target, x, y}`: the chain caught `target` at (x, y); it is dragged to the Hookwarden.
- `ward {id, from, x, y, amt}`: Lamplighter `from` put a ward of `amt` on `id`.
- `wardbreak {id, x, y, side, burst}`: `id`'s ward was used up. `burst` = a Beacon ward that went off, knocking foes back.
- `revive {id, from, x, y}`: Ascended medic `from` brought `id` back at half health (no `death` was sent).
- `soar {id, x, y, side, second}`: a Griffin Knight takes to the sky for a dive; `second` = Second Dive (Ascended, below half health).
- `swoop {id, x, y, r, side, second}`: the griffin lands at (x, y), hitting and stunning ground foes within `r` (a `boom` of kind `swoop` follows).
- `wave {id, from, x, y0, y1, w, dur, side, surf}`: Tidecaller `from` sent a wave `w` wide down the lane at x, from y0 to y1 over `dur` s (also in `battle.waves`). `surf` = Riptide: it leaves `zone` events of kind `surf`.
- `rally {id, x, y, r, side, n}`: Lionheart `id` made a kill: `n` allies within `r` (him too) attack 25% faster for 3 s, and he heals.
- `laststand {id, x, y, until}`: Ascended Lionheart took a killing blow and stays up on 1 health until battle time `until`.
- `volley {id, x, y, a}`: an Ascended ranger loosed three arrows fanned around angle a.
- `twin {id, x, y, a}`: an Ascended ballista fired two bolts.
- `reset {id, x, y}`: Shadow Step: a kill readied the shade's blink.

## Body fields (persistent, read every frame)
- `kind`: also the spawned kinds `mite`, `queen` (Brood Queen), `golemling` (display "Shardling"), `thrall`, `turret`, `decoy`. Get any kind's base stats with `bodyDef(kind)` from defs (use it for radius: `UNITS[kind]` is undefined for spawned kinds).
- `rank`: 1 to 4; 4 is Ascended. Spawned bodies share their maker's rank.
- `owner`: the body that made this one (hive for mites/queen, grave for thralls, tinker for turrets, trickster for decoys), else -1.
- `burrowed`: sapper underground. Draw only the trail (or a moving mound), no body, no health bar.
- `flying`: harrier. Skip ground shadows under it at altitude. `z`: altitude, 1.2 cruising, down to about 0.15 at the bottom of a dive.
- `slow`: seconds of frost slow left (half speed, attacks 25% slower). `frozen`: seconds frozen solid left (draw ice).
- `braced`: pikeman has its pikes set.
- **v3** `hidden`: out of the other side's sight, updated every step. True for a buried mine, a cloaked Shade, and a ground unit
  standing in brush that has not been revealed (it has not attacked, cast or been hurt in the last 1.5 s). Draw the player's own
  hidden units faint; draw the enemy's not at all (or as a rustle in the grass) until `hidden` goes false. Always false for fliers
  and structures (mines apart), and in a battle without brush it is exactly what it was in v2 (mines and cloaked Shades).
- **v3** `stealth`: nobody can target it at any distance (a buried mine, a cloaked Shade). `hidden && !stealth` = hidden by brush.
- **v3** `reveal`: the battle time until which brush does not hide this body (set to `time + 1.5` when it attacks, casts or is hurt).
- **v3** `ambush`: lying in wait: it started the battle in brush and has not yet moved or acted. It breaks cover when an enemy it can
  see is within 3 units (or its own attack range), when it is revealed or pushed out of the brush, or 6 s into the battle.
- `buff`: > 0 while inside a Standard Bearer aura (attacks 25% faster). `rally`: > 0 while inside an Ascended (Rally) aura (+20% damage).
- `parryCd`: duelist parry ready when <= 0 (a glint).
- `ward`: Lamplighter ward left to soak (draw a warm bubble while > 0); `wardT` seconds left on it; `wardBurst` = a Beacon ward.
- `snare`: seconds left tangled in brambles (moves at 45% speed).
- `dmg` / `baseDmg`: current damage (Rally adds 20%) and the base.
- `hand`: +1/-1, the way it circles (internal).
- `state` by kind: mine `armed`/`fuse`/`spent`; lancer `aim`/`charge`/`wheel`; shade `flank`/`fight`; sapper `burrow`/`fight`; harrier `circle`/`dive`/`climb`; tinker `idle`/`build` (building at `ax, ay` for 1.2 s); keg `run`/`reel` (knocked back by pikes)/`spent`; hook `cast` (chain in flight, lands at battle time `budget`)/`reel` (dragging the bodies in `hits`), else fighting.
- Ravager fury needs no field: it is `1 - hp/maxHp` (attacks up to 3x faster near death).
- Decoys are illusions of their trickster: draw them as the trickster (same team, same rank). They don't count as survivors.
- Turrets are structures built in battle; they don't count as survivors (a side left with only turrets has lost).

## Battle fields
- `zones: Zone[]`: burning ground, brambles or Riptide surf (kind `surf`: slows, no damage) now on the field: `{id, kind, x, y, r, side, until, dps}`. Removed when `time >= until`.
- `waves: Wave[]`: Tidecaller waves rolling now: `{id, side, x, y, y0, y1, dir, w, speed, dmg, hits, surf}`; the front is at `y`. Draw a crest `w` wide.
- Griffin Knight: `flying` while its `state` is `soar` (only anti-air reaches it), then `fight` low at `z` 0.6 with `flying` false. Lionheart: `budget` is the battle time its Last Stand ends.
- `fuses: Fuse[]`: blasts still to go off: `{x, y, at, r, kind, side}` (bomblets, shrapnel, chain keg). Draw a sputtering bomb until `at`.

## Projectiles (`battle.projs`)
- `kind`: `shard` homes like an arrow (icy); `pellet` homes, small and fast (turret); `shell` arcs very high (`z` peaks about 3.2, flight 1.6 s, vs about 1.4 for a grenade).
- `fx`: `fire` (Firebomb grenade), `shrapnel` (shell), `freeze` (Deep Freeze shard) or `""`.
- A volley side arrow with `target: -1` flies straight and stops in the first enemy it touches.
- **Arena** `over`: true on a direct shot loosed at something in the air; it flies over the arena's blocks instead of stopping on them.

## Terrain (battles made with `terrain`: every Arena battle, and campaign levels with a set piece)
Rules: `docs/ARENA.md`. Types: `engine/core/terrain.ts`. None of this exists in a battle without `BattleOptions.terrain` (`battle.blocks` is then `[]` and none of these events is sent).

State, read every frame:
- `battle.blocks: BlockState[]`: every block of the arena as it stands now: `{id, kind, x, y, w, h, look?, hp, maxHp, alive}`. `(x, y)` is the centre, `w` across, `h` along the board. `kind`: `wall`, `building`, `barricade`, `cover`, `water`, and **v3** the two ground zones `road` and `brush` (`isZone(kind)`: flat ground under the units, never in the way, always `alive`, `hp` 0; a ground body on a road moves 1.25x as fast, one in brush is `hidden`). `hp` counts down for `barricade` and `cover` (`maxHp` is the starting health; both are 0 for the kinds that never break). `alive` goes false when one breaks: draw rubble; it no longer blocks anything. The array's order and the ids never change during a battle.

Events (in a table, not the bullet form used above, because tests/fx.test.ts requires a VFX sheet for every bulleted
event; move them up once base/src/render/vfx.ts plays them):

| event | fields | meaning |
| --- | --- | --- |
| `blockhit` | `{id, x, y, dmg, hp, by}` | Block `id` took `dmg` at point (x, y) and has `hp` left. `by` is the body that struck it hand to hand (a melee unit breaking through), or -1 for a shot, a blast, or cover soaking part of a shot (then (x, y) is where the shot crossed the cover). |
| `blockbreak` | `{id, kind, x, y, w, h}` | Block `id` broke (its rectangle is repeated so the renderer can throw debris without a lookup). The `blockhit` that broke it comes first, with `hp: 0`. |
| `ricochet` | `{x, y, kind, block}` | A direct shot stopped on block `block` at (x, y). `kind` is the projectile's (`arrow`, `bolt`, `shard`, `pellet`) or `hook` for a Hookwarden's chain that hit a wall its mark stepped behind. The projectile is dead (`alive: false`) at that point. |
| `crash` | `{id, x, y, a}` | Lancer `id`, charging along angle `a`, ran into a block at (x, y) (the point of impact on the block's face). Its charge is over and it is stunned for 0.6 s (`CRASH_STUN`). |

Unchanged events that behave differently in an arena: a `spawn`, `blink`, `emerge`, `build`, `raise` or `decoy` position is always on free ground (the nearest free spot to where it would have been on an open field); a `boom` hurts nobody fully behind a wall, building or barricade from its centre; a `wave` is drawn the full length of its lane even where a wall shelters what is behind it.
