# artkit: a game's art, drawn in code

The base game's art is rendered offline in Blender. A re-themed game does not need any of that: its whole look is
TypeScript in `games/<id>/art/`, built from primitives with this kit and baked in a few minutes to the same files the
runtime already loads. Nothing but Node and the Playwright Chromium in `node_modules` is needed, so you can change a
builder, bake, look at the result and go again.

```
npm run bake -- <game>                          # everything, then the completeness check (about 3 minutes)
npm run bake -- <game> --kinds ranger,golem     # just those units (sheets + portraits), seconds each
npm run bake -- <game> --only arenas --acts 1,5 # one family: units portraits arenas keeps vfx maps ui td
npm run bake -- <game> --preview --kinds ranger # contact sheets into games/<game>/art/preview (look at these!)
npm run bake -- <game> --preview --only arenas  # a strip of all ten backdrops (also keeps, vfx, maps, ui, td)
npm run bake -- <game> --check                  # is the art complete and valid?
GAME=<game> npx vite --port 5312                # play it; node tools/shot.mjs takes phone screenshots (PORT=5312)
```

`games/brasswick/art/` is a complete worked example (steampunk): read it next to this guide.

## How it fits together

| File | What it is |
| --- | --- |
| `toon3d.ts` | The renderer: `Model` (primitives + transform stack), materials, `Style`, `render()`. Pure TypeScript, no DOM. |
| `rig.ts` | `Pose` (one frame of one clip) and the rigs: `humanoid`, `quadruped`, `flyer`, `crawler`, `structure`. `UnitDef`. |
| `looks.ts` | `shoot()` (render in the style's look) and ready-made looks: toon, pixel, neon, paper. |
| `atlas.ts` | Packs a unit's frames into a sheet + manifest entry in the runtime's layout. |
| `paint.ts` | `Painter`: seeded 2D painting in your own units (cobbles, slabs, planks, rails, cogs, glows...). |
| `arena.ts` `keep.ts` `vfx.ts` `flat.ts` | The other asset families: arenas, keeps, effect sheets, maps / key art / Bastion backdrops. |
| `game.ts` | `GameArt`: what `games/<id>/art/index.ts` default-exports. |
| `check.ts` | `checkGameArt()`: the completeness and contract check (`tests/artkit.test.ts` runs it on every game). |
| `bake/` + `tools/bake.mjs` | The bake page (your builders run in headless Chromium) and the tool that drives it and writes files. |

A game's art entry point:

```ts
// games/<id>/art/index.ts
import type { GameArt } from "../../../artkit/game";
const art: GameArt = {
  id: "<id>",
  style: STYLE,                 // ink, cel bands, shadows, rim light, look
  teams: { tide: {...}, ember: {...} },   // the player's and the rival's colours: main, dark, light
  units: { ranger, golem, ... },          // one UnitDef per body kind (all 37, see the table below)
  atlas: { ppu: 112, colors: 48 },        // optional: sheet resolution / palette size / format
  arenas, keeps, vfx, maps, ui, td,       // the other families (each optional while you work; all needed to finish)
};
export default art;
```

The bake writes into `games/<id>/public/**`, which shadows `base/public/**` file by file. Whatever a game does not
supply, the base game's art shows instead, so a half-finished game still runs; `--check` lists what is still base art.

## The renderer (toon3d.ts)

Model space: **+x is forward** (the way the body faces), **+y is the body's right**, **+z is up**. One unit is one
world unit; a standard soldier is about 0.86 tall and the engine's collision radius for most infantry is 0.25. The
camera is orthographic, pitched 53.3 degrees below the horizon (the board's camera), so you see a lot of the top of
everything: **hats, shoulders, packs and held tools carry the silhouette**; faces barely show.

```ts
const m = new Model();
m.sphere([0, 0, 0.5], 0.2, P.skin);                         // centre, radius, material
m.ellipsoid([0, 0, 0.3], [0.15, 0.19, 0.17], P.coat);       // radii x, y, z
m.capsule([0, 0.1, 0.4], [0.2, 0.2, 0.3], 0.06, P.coat, 0.05);   // a to b, radius at a, radius at b (limbs)
m.cylinder([0, 0, 0], [0, 0, 0.3], 0.2, P.iron, 0.18);      // flat-ended; last number = radius at b
m.cone([0, 0, 0.3], [0, 0, 0.5], 0.1, P.brass);             // base at a, tip at b
m.box([0, 0, 0.1], [0.4, 0.3, 0.2], P.wood);                // centre, full sizes
m.lathe([[0.2, 0], [0.26, 0.2], [0.1, 0.5]], P.copper, { smooth: true });  // [radius, z] profile turned about z
m.tube([[0, 0, 0], [0.1, 0, 0.2], [0.3, 0, 0.25]], [0.03, 0.02, 0.01], P.iron); // pipe along a path, radius per point
m.extrude([[0, 0], [0.3, 0], [0.3, 0.02], [0, 0.05]], 0.02, P.steel);      // an outline in the x-z plane given thickness along y
m.extrude(gearOutline(8, 0.1, 0.13), 0.04, P.brass);        // gears (gearOutline), discs and polygons (ringOutline)
m.torus([0, 0, 0.3], [0, 0, 1], 0.2, 0.02, P.brass);        // ring: centre, axis, major and minor radius
m.poly([[0, 0, 0], [0.3, 0.1, 0], [0.3, -0.1, 0]], P.cloth); // a flat polygon in 3D, lit from both sides (flags, wings)
m.disc([0, 0, 0.1], [0, 0, 1], 0.2, P.glass);               // a flat disc facing along a normal
```

Transforms stack: `m.with(() => { m.move(0, 0, 0.3).rotY(20).scale(1.2); ...parts... })`, or `m.at(frame, () => ...)` to
draw inside a frame a rig handed you (a hand, the head, the chest). `rotY(+deg)` tips forward-pointing things down;
`rotZ(+deg)` turns forward towards the body's right. `m.group(() => ...)` makes several primitives one part (no ink
line between them). `m.decal(0.02, () => ...)` pulls parts towards the camera so stripes, faces and plates sit on a
surface without z-fighting. `m.merge(otherModel)` copies a whole model in.

Sorting is per pixel (a depth buffer), so limbs, weapons and overlapping parts are always right: add parts in any order.

**Materials**: `mat("#c8873a", { metal: 0.8 })` or `team("main" | "dark" | "light")` for team-coloured parts.

| Option | Effect |
| --- | --- |
| `metal` 0..1 | a hard specular highlight and a darker underside: brass, steel, glass |
| `emit` 0..1 | unlit (a light source) |
| `glow` > 0 | throws a soft halo of its own colour (use sparingly: every glowing frame costs sheet bytes) |
| `ink: false` | never outlined: flames, steam, flashes, glows |
| `alpha` < 1 | see-through: steam, glass |
| `shade` 0..1 | how much the shadow bands darken it (0 = flat colour) |

**Style** (one per game, `GameArt.style`): `ink` colour, `outline` (silhouette weight in px at 128 px per unit) and
`inner` (lines where one part stands in front of another), `bands` (two thresholds and three light values for the
cel shading), `shadowTint` + `shadowAmount`, `rim` light, `light` direction, `glow`, a `grade`
(saturation / contrast / warmth / free remap applied to every material colour) and a `look`:

```ts
import { DEFAULT_STYLE } from "../../../artkit/toon3d";
import { LOOKS } from "../../../artkit/looks";
const STYLE = { ...DEFAULT_STYLE, ink: "#2a1a12", ...LOOKS.neon() };   // or LOOKS.pixel(3), LOOKS.paper(), LOOKS.toon()
```

`pixel` renders small and scales up with hard pixels and a short palette; `neon` gives dark fills with glowing edges in
each part's colour; `paper` gives pale washes, hatched shadows and a heavy line. The models do not change: another
game can reuse a whole set of builders with a different look.

## Units: rigs, poses, clips (rig.ts)

A unit is a `UnitDef`:

```ts
export const ranger: UnitDef = {
  weight: "light",                    // "heavy" | "mid" | "light": motion class (wind-up, bounce, dust)
  // fixed: true   no walk clip (traps, emplacements)      cast: true   has a special-move clip
  // flying: true  hovers (no stride needed)
  build(m, p) {                       // called once per frame of every clip; p is the Pose
    const R = p.mix<V3>([0.06, 0.13, 0.33], [0.04, 0.1, 0.47], { wind: [0.02, 0.12, 0.44] });   // right hand: rest, strike, wind-up
    const L = p.mix<V3>([0.25, -0.05, 0.4], [0.3, 0, 0.485], { wind: [0.2, -0.02, 0.56] });
    const h = humanoid(m, p, { weight: "light", skin: P.skin, torso: P.team, legs: P.wool, boots: P.leatherDk,
                               handR: R, handL: L, lunge: 0, recoil: 0.035 });
    m.at(h.head, () => flatCap(m, 0.19));                       // hang parts on the frames the rig returns
    m.at(gripAim(h.pR, h.pL), () => {                           // a two-handed weapon: +x from the right hand to the left
      rifle(m, p.tier);
      if (p.hit) flash(m, [0.56, 0, 0.01], 0.075);              // effects that belong to the blow, on its frame only
    });
  },
};
```

**The clip plan** is fixed by the runtime: `idle` 6 frames (loop), `walk` 8 (loop), `attack` 6 with the blow on
frame 2, `death` 6, `cast` 6 (optional, release on frame 2), each rendered in 5 facings (the other 3 are mirrors).
You never loop over frames; you describe one frame from its `Pose`:

| Pose | Meaning |
| --- | --- |
| `p.tier` | rank 1..4 (4 = Ascended) |
| `p.anim`, `p.is("walk")` | which clip |
| `p.i`, `p.n`, `p.t` | frame index, frame count, `i / n` (0..1 round a loop) |
| `p.wave(amp, cycles, phase)` | a sine through the loop: flags, scarves, bobbing parts (loops cleanly) |
| `p.blend` | attack / cast: -1 full wind-up, 0 rest, 1 the blow, 1.15 overshoot, then back |
| `p.mix(rest, strike, { wind, cast, castWind })` | the pose for this frame, for numbers or points |
| `p.hit`, `p.after` | the impact frame; the impact frame and the one after (smoke that lingers) |
| `p.dead` | death: 0 at the first frame to 1 settled |

Give every attack **anticipation** (a `wind` pose that pulls back or up), a **strike** well past rest, and let the
rig's overshoot carry the follow-through. Draw the blow's own effect (`p.hit`): a muzzle flash, a slash arc, a spark.

**Rigs** do the body's own motion for every clip and return frames (`M34` matrices for `m.at`):

- `humanoid(m, p, opts)`: breathing idle, a walk with planted feet and swinging arms, a braced lunge for the attack,
  a fall onto its back for death. You give materials and, per frame, where the hands are (`handR`, `handL`, in body
  space: x forward, y right, z up from the ground at size 1; the shoulders are at about z 0.5, y +-0.17; the arm
  reaches about 0.27). Options: `size`, `bulk` (width), `leg` (leg length: giants), `weight`, `lunge` (0 for a rooted
  shooter), `recoil`, `twist` (chest turns through the swing), `lean`, `swingR/L`, `seated` (astride a mount or
  flying: the mount moves and dies, the rider just rides), `noHead` / `noTorso` / `noFace` (you draw your own).
  Returns `head`, `chest`, `hips`, `back` (between the shoulder blades, facing backwards), `handR`, `handL` frames;
  `pR`, `pL` hand positions; `pt(v)` / `dir(v)` (body space to rig space); and `aim(hand, bodyDir)`, a frame at a
  hand with +x along a direction: **hang one-handed weapons on `h.aim("R", dir)` and mix `dir` like the hand**, so
  the weapon follows through wind-up, strike and follow-through. For two-handed things use `gripAim(h.pR, h.pL)`.
- `quadruped(m, p, opts)`: a trotting mount with planted hooves; returns `body` (draw the barrel, neck and head
  there), `saddle` (put a `seated` humanoid there), `spin` (wheel rotation, with `noLegs: true` for wheeled things).
- `flyer(m, p, opts)`: hover, bank, dive, tumble; returns `body`, `flap` (-1..1 wing beat) and `spin`. Keep `alt`
  small (about 0.2): the game adds the real flying height.
- `crawler(m, p, opts)`: a many-legged scuttler (legs drawn by the rig); returns `body`. It flips onto its back to die.
- `structure(m, p, opts)`: a fixed emplacement; returns `base` (stays put) and `top` (winds, recoils on the blow,
  slumps in death).

Walking bodies record their **stride** (world units per walk cycle) automatically; the runtime plays one cycle per
stride travelled, which is what keeps feet planted. If you write your own leg motion, use `step(phase, stride, lift)`
and set `p.stride`.

**Tiers**: the bake scales ranks 1 to 4 by 1, 1.04, 1.08, 1.12 (`UnitDef.tierScale` to change). On top of that, make
each rank **visibly** richer from `p.tier`: better metal trim, a grander hat, an extra pack or stack at 3, and at 4
("Ascended") something that glows in the team's light colour (an emissive `team("light", { emit: 1 })` part or a
`glow` core). All four must be told apart at a glance in the tier strip of the preview.

### Every body kind (engine/core/defs.ts: 31 in `UNITS`, 6 in `BODY_EXTRA`)

The rules never change, so each must still read as its job, and as its side, on a phone at arm's length. Team colour
goes on big surfaces (coat, shield, wings, plinth). "Clips" beyond the standard idle / walk / attack / death are noted.

| Kind | Name, radius | Role: what must read | Clips |
| --- | --- | --- | --- |
| `mine` | Mine, 0.22 | A buried trap: low, round, spiky, a warning light. Attack = it goes off. | fixed |
| `blades` | Blade Trio, 0.24 | Light melee, comes in threes: small, quick, a blade and a slash arc. | |
| `ranger` | Ranger, 0.25 | Ranged skirmisher: a long weapon held across the body; a muzzle flash or loosed shot. | |
| `bulwark` | Bulwark, 0.4 | The tank: big, slow, a huge team-coloured shield in front. | |
| `medic` | Medic, 0.25 | Healer: pale or white, a healing tool, a soft green burst on the cast. | cast (heal) |
| `grenadier` | Grenadier, 0.27 | Lobs bombs: stout, a bomb in the throwing hand, an overarm throw. | |
| `shade` | Shade, 0.24 | Cloaked assassin: dark, hooded, twin blades, team colour only as trim. | |
| `lancer` | Lancer, 0.36 | Cavalry that charges through lines: rider + mount, a long levelled lance. | |
| `ballista` | Ballista, 0.42 | Fixed line-piercing shooter: a long barrel or arm on a base, a big bolt. | fixed |
| `hive` | Hive, 0.45 | Fixed spawner: a squat building with a mouth that opens on the "attack" (a spawn). | fixed |
| `storm` | Stormcaller, 0.27 | Chain-lightning caster: something tall that crackles; arcs on the blow. | |
| `golem` | Stone Colossus, 0.55 | The slow giant: the biggest body, heavy fists; visibly made of two halves. | |
| `sapper` | Sapper, 0.26 | Tunnels to the back line: a digging tool, a lamp, a miner's look. | |
| `harrier` | Harrier, 0.3 | Flyer that dives: wings wide (team colour), small body. | flying |
| `banner` | Standard Bearer, 0.27 | Aura support: a tall standard in team colour is the silhouette. | cast (rally) |
| `rime` | Rimecaller, 0.27 | Frost caster that slows: cold colours, a spray or shards on the blow. | |
| `ravager` | Ravager, 0.3 | Berserker who hunts the toughest: brutal, heavy weapon, wide swing. | |
| `grave` | Gravecaller, 0.28 | Raises the fallen: dark, tall hat or hood, an eerie green light. | cast (raise) |
| `bombard` | Bombard, 0.42 | Fixed long-range mortar: a fat barrel pointing at the sky. | fixed |
| `tinker` | Tinker, 0.26 | Builds a turret, mends machines: a big tool, a pack of parts. | cast (build) |
| `duelist` | Duelist, 0.25 | Parries then ripostes: slim, elegant, a thin blade; the cast is the parry. | cast (parry) |
| `pikeman` | Pikeman, 0.28 | Long reach, braces against charges: a very long polearm. | cast (brace) |
| `keg` | Kegrunner, 0.24 | Suicide runner: carries an obvious big bomb, leaning into a sprint. | |
| `trickster` | Trickster, 0.25 | Throws out decoys: showy, caped, tall hat. | cast (decoys) |
| `hook` | Hookwarden, 0.3 | Drags a back-liner in: heavy, a hook and chain launcher. | cast (hook) |
| `thorn` | Thornweaver, 0.26 | Sows brambles ahead of the enemy: something green and growing about them. | |
| `outrider` | Outrider, 0.34 | Mounted ranged skirmisher that circles: fast mount or vehicle + a gun or bow. | |
| `lamp` | Lamplighter, 0.25 | Wards that soak blows: a light on a long pole. | cast (ward) |
| `griffin` | Griffin Knight, 0.32 | Heavy flyer that dives and stuns: winged or jet-borne knight with a lance. | flying |
| `tide` | Tidecaller, 0.27 | Sweeps a lane with a wave: water gear, a big blast forward. | |
| `lion` | Lionheart, 0.3 | The hero: bigger, grander, plumed; rallies on the cast. | cast (rally) |
| `mite` | Mite, 0.15 | The hive's swarm: tiny crawler (tier 1 only). | |
| `queen` | Brood Queen, 0.21 | The hive's big crawler (tier 1 only). | |
| `golemling` | Shardling, 0.36 | Half a fallen Colossus: a smaller copy of the golem (tier 1 only). | |
| `thrall` | Bone Thrall, 0.22 | Raised by the Gravecaller: a thin undead or scrap figure (tier 1 only). | |
| `turret` | Turret, 0.24 | Built by the Tinker: a small fixed gun (tier 1 only). | fixed |
| `decoy` | Decoy, 0.25 | The Trickster's dummy: clearly a fake copy of the Trickster (tier 1 only). | |

Sprites are drawn 1.25 to 1.5 times true size on the board, so do not oversize bodies: follow the radius.

## Arenas (arena.ts)

Ten acts. Each `ArenaDef` paints a **ground** top-down in world units with a `Painter`, stands **scenery** models
around the board, and supplies three obstacle **props**. The bake projects ground and scenery through the game's own
camera, so the picture lines up with the board on every screen.

Layout every arena must keep (board coordinates, y grows towards the player):

- the board is `x 0..9`, `y 0..14`; the rival deploys in `y 0..5.9`, the player in `y 8.1..14`; the strip between is
  neutral: give it its own paving and a kerb on each zone line;
- the keeps stand at `(4.5, 13.4)` (player) and `(4.5, 1.55)` (rival): pave a plaza about 1.7 across under each;
- keep the ground mid-valued and calm so units and team colours pop; the game lays a faint team wash over each zone;
- scenery goes **outside** `x -0.4..9.4`, `y -0.4..14.4`. Phones show about 0.6 units either side and 3 beyond the
  far edge; tablets show much more, so dress the whole painter area (`x -8..17`, `y -17..21`);
- `fg: true` on an item that overhangs the board edge (lamp arms, awnings, boughs): it is drawn again over the units
  and fades when a unit walks under it. `shadow: r` paints a contact shadow.
- props are models whose base fills the unit circle (radius 1 = the obstacle's collision radius);
- `ambient` (optional) is the act's drifting life: motes that `fall`, `rise`, `drift` or `blink`, wind gusts, cloud
  shade, a passing flock.

`Painter` (paint.ts) has `fill`, `rect`, `poly`, `circle`, `line`, `round`, `mottle`, `cobbles`, `slabs`, `planks`,
`road`, `rails`, `cog`, `glow`, `wash`, `cracks`, `puddle`, `cover`, `scatter`, `clip`, plus `rand` / `pick` (seeded,
so a bake is repeatable). `shade(hex, k)`, `rgba(hex, a)` and `spline(points)` are helpers.

## Keeps (keep.ts)

`KeepArt.build(m, k)` builds a stronghold for `k.damage` 0..4 (intact, cracked, burning, ruined, fallen = rubble),
`k.boss` (the rival's keep on boss levels: grander) and `k.skin` (five cosmetic skins for the player's keep: frost,
ember, gilded, shadow, blossom; give each its colours in `skinTeams` and swap materials on `k.skin`). The gate faces
+x. Keep the base within about 1.25 units of the origin and everything under about 2.7 tall, and name the `anchors`
(gate, top, flag-pole tip, where fires burn and smoke rises) so the game's own fire, smoke, hit and victory-banner
effects land on your model. Each state should be obviously worse than the last from the same silhouette.

## Effects (vfx.ts)

The effect atlas is mostly greyscale light, smoke and debris that the runtime tints, so it suits any theme. A game
bakes the base atlas with changes: `grade` recolours sheets (`"*"` for every coloured sheet), `models` redraws a
sheet's frames from toon-3D models seen from the side facing +x (projectiles: `arrow`, `bolt`, `bomb`, `keg`,
`shell`, `shard`, `pellet`), `paint` redraws frames in 2D. Sheet names, cell sizes and frame counts are fixed
(`base/public/vfx/atlas.json`; `art/vfx/contact.png` shows them all). Omit `vfx` to ship the base sheets unchanged.

## Maps, key art, Bastion (flat.ts)

- `MapArt.paint(p, map, st)`: one 840 x 1848 page per act (`map.index` 0..9). `map.path`, `map.camp` and `map.boss`
  are where the UI puts the level nodes, the player's camp and the boss, in pixels: paint your road along `map.path`.
- `UiArt.titleKey(p, st)`: the home screen's key art, 1206 x 2622. The home screen shows the whole picture and its
  buttons cover everything below about 60% of the height: put the horizon near 44% and the cast between 45% and 60%.
- `TdArt.paint(p, map, st)`: the Bastion backdrops. The painter is in the map's world units, already foreshortened;
  draw the road along `map.paths` (half width `ROAD_HALF`), a plinth on every `map.pads` entry, plazas at `map.keep`
  and `map.gates`, and keep scenery off all of them.

`Stamps` (`st`) stands toon-3D models in a painting: `st.model(p, build, x, y, { ppu, yaw, el, team, shadow, key })`
(pass `key` to render once and reuse) and `st.unit(p, "lion", 4, x, y, { ppu, yaw, el, anim, frame })` for the game's
own units. Sort what you stamp by y so nearer things overlap farther ones.

## Portraits

Card portraits (`public/portraits/<kind>_t<tier>.png`, 256 x 256) are baked from the unit builders (the idle pose,
three-quarter view, player colours) with the units; nothing to write.

## What the runtime loads (the contract)

| Family | Files in `games/<id>/public` | Loader |
| --- | --- | --- |
| units | `atlas/manifest.json`, `atlas/<kind>_t<tier>.webp` | `base/src/render/sprites.ts` |
| portraits | `portraits/<kind>_t<tier>.png` | `sprites.ts` `portrait()` |
| arenas | `arenas/manifest.json`, `act<n>.jpg`, `act<n>_fg.webp`, `act<n>_prop<0..2>.png` | `arena.ts`, `foreground.ts` |
| keeps | `keeps/manifest.json`, `<tide|ember|ember_boss>_<state>.webp`, `skins/<skin>/<state>.webp` | `keeps.ts` |
| effects | `vfx/atlas.json` + its image | `vfx.ts` |
| maps | `maps/<id>.jpg` (the ten names in `base/src/ui/mapdata.ts`) | the campaign map screen |
| key art | `ui/title-key.webp` | the home screen's CSS |
| Bastion | `td/manifest.json`, `td/<map>_<k>.webp` | `tdView.ts` |

Unit sheets ship in the base game's own format by default: one lossless image of palette indices plus a palette in
the manifest (colour, alpha and team mask per entry), tinted per team at load. The manifest's `ownTeams: true` makes
the runtime tint with the game's own `teams` rather than the base style's. `atlas: { format: "mask" }` ships full
colour over a team mask instead (for looks with soft gradients that a palette would band; larger files).
`atlas.ppu` (default 128) and `atlas.colors` (default 160) trade sharpness for size: Brasswick ships at 112 and 48.

The HUD's own team colours (health bars, zone wash) come from the base style, not from the art: either keep a game's
team colours near the base's teal and orange-red, or restyle the HUD to match in the game's `src/`.

## Is this game's art complete?

1. `npm run bake -- <game>` ends with `art check: 0 errors, 0 missing (complete)`. Errors mean files that break the
   loaders' contract; missing means the base game's art would show through (a list of exactly what).
2. `npm test` passes (`tests/artkit.test.ts` holds every game under `games/` to the contract).
3. Open `games/<game>/art/preview/`: `_roster.webp` (every body and rank), `<kind>.webp` (every clip and facing on a
   baseline: feet stay on the line, the weapon stays in the hand, the blow reads on the third attack frame),
   `<kind>_tiers.webp` (the four ranks, front and back, both teams), `_arenas.webp`, `_keeps.webp`, `_maps.webp`,
   `_title.webp`, `_td.webp`, `_vfx.webp`.
4. Play it (`GAME=<game> npx vite --port 5312`) and screenshot a campaign battle (`/?level=12`, and a later act, e.g.
   `/?level=40`), the home screen (`/`), the Army screen (`/?army`), the map (`/?campaign=3`), a Gauntlet duel
   (`/?gauntlet`), Bastion (`/?td=meadow`) and an AI battle (`/?watch`). No drawn-token stand-ins (flat circles with
   letters), no base-game art, both teams instantly distinguishable, no console errors.
5. `games/<game>/public` is a sensible size (the base game's is about 64 MB; Brasswick's is about 45 MB, mostly unit
   sheets: lower `atlas.ppu` if you need less).

## Working rhythm

Get four varied units right first (a foot soldier with a weapon, something big or mounted, a fixed structure, a
flyer), in game, next to the base game. Then one arena and the keep. Then scale out. Bake one thing, look at it,
fix it, repeat: `--kinds` and `--acts` exist so each loop is seconds.
