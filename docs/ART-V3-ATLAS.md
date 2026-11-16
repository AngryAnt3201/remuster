# Character atlases (v3)

Every unit (24 kinds, tiers 1 to 4) and every spawned body (mite, queen, golemling, thrall, turret, decoy at tier 1)
is built procedurally in Blender (`art/muster_art/units.py`) and rendered as upright frames for the 3/4 diorama board.

    npm run art                                   # render all (6 Blender workers), post, pack
    blender -b --factory-startup -P art/render_all.py -- --only ranger --tiers 1,4
    python3 art/post.py                           # re-ink + re-pack from existing raw renders
    blender ... -P art/render_all.py -- --resume --no-post   # finish an interrupted render (skips kind/tier with meta.json)
    python3 art/post.py --resume                  # post only bodies whose raw render is newer than their post
    python3 art/pack_atlas.py --only ranger       # repack some kinds into the existing manifest
    python3 art/anim_preview.py --only ranger     # animated previews from base/public/atlas

`post.py` and `pack_atlas.py` need Pillow and numpy (`/usr/local/bin/python3` has them on Jack's Mac; put it first
on PATH when running `npm run art`).

## Style parameters

All look and camera numbers live in `art/muster_art/style.py`; nothing else keeps its own copy. Its constants hold the
built-in v2 look, and at import `select()` replaces the look ones with a style direction (`art/style/<id>.json`,
docs/ART-V3.md):

    MUSTER_STYLE=<id> or --style <id>    meadow, dusk or toy
    MUSTER_STYLE=v2 or --style v2        the built-in v2 look
    (neither)                            the active direction in art/style/active.json

So once Jack picks: `npm run style:pick -- <id>`, then `npm run art` (with `/usr/local/bin/python3` first on PATH).
What a direction sets: `outline.color` -> `INK`, `outline.hull` -> `OUTLINE` (0 = no hull lines, Painted Toy),
`outline.silhouette_px` -> `INK_PX` (x `SS`, post inks at raw size), `shading.bands` -> `RAMP` over N.L in -0.2..1
(`RAMP_DOT`), `shading.shadow_tint*` -> `SHADOW_TINT*` (tints the dark bands in the kit's Toon group), `shading.spec`
-> `SPEC`, `shading.bloom` -> `GLOW_GAIN` (relative to meadow's 0.7), `light.key` / `rim.dir` (Blender world) ->
`KEY` / `RIM_DIR` (camera space), `rim.*` -> `RIM_*`, `team` -> `TEAMS`, `palette` -> `PALETTE` (`parts.Pal`
materials). The camera and frame plan never change with a direction, because `CAMERA_EL`, `DIRS` and `ANIMS` are what
`base/src/render/camera.ts` and `tests/atlas.test.ts` check against (the direction contract's 55 / 35 degree elevations
are not used for characters).

`render_all.py` writes the style into every raw `meta.json`. `post.py` (and `pack_atlas.py`, which imports it) posts
in the style the raw renders record unless `--style` / `MUSTER_STYLE` says otherwise, and stops if the raw renders mix
styles, so a partial re-render can't ink one unit in another direction's colours. The manifest records `style`.
The shipped atlases are `"style": "v2"` until the full re-render after the pick.

- Camera: orthographic, pitched `CAMERA_EL` = 53.3 degrees below the horizon, which is 90 degrees minus
  `TILT` (0.64 rad) in `base/src/render/camera.ts`, so a sprite's ground ellipse matches the board's.
- `PPU` = 128 atlas pixels per world unit, rendered at `SS` = 2x and box-downsampled.
- Toon ramp (3 cel bands), key light from the upper front, rim light from behind (`RIM_*`), inverted-hull
  outlines in 3D plus a 3 px ink silhouette added in post.
- Ascended (tier 4): an emissive pass becomes a team-coloured halo and bloom in post.

## Frames

- Facings: 5 rendered (`DIRS` = E, SE, S, NE, N in game angles, y down). West-side facings mirror their east twin.
  `DIR8[i]` maps an 8-way screen facing i (0 right, 1 down-right, 2 down = towards the camera, ... 6 up, 7 up-right)
  to `[rendered dir, mirrored]`. This equals `mirror8` in camera.ts.
- Clips (`ANIMS` in style.py, `anims_for(kind)`):

  | Clip | Frames | What |
  | --- | --- | --- |
  | idle | 6 | breathing (chest and shoulders rise) and a slow side-to-side weight shift; fliers hover on a soft wing beat |
  | walk | 8 | contact, down, passing, up for each foot; the upper body bounces, arms swing against the legs, planted feet stay put |
  | attack | 6 | wind-up, wind-up hold, IMPACT (frame 2: the blow, with its arc/spark/muzzle flash), overshoot, follow-through, recover |
  | death | 6 | recoil, buckle, fall, impact, bounce, settle (rendered at 55% resolution, `CLIP_SCALE`) |
  | cast | 6 | the special move, for `CAST` kinds only: wind-up, raise, release at IMPACT, hold, settle |

  Static bodies (mine, ballista, hive, bombard, turret) alias walk to idle. Fliers tumble out of the air; bugs flip.
- Motion classes (`WEIGHT`): heavy bodies (golem, bulwark, hook, ravager, lion, lancer, siege) wind up longer, bounce
  and squash more and take long strides; light ones (blades, shade, duelist, trickster, keg, ranger...) lean further
  into the walk and move snappily.
- Every frame is trimmed to its pixels and stores its ground anchor (the body's feet / base centre).

### How the motion is built (art/render_all.py `frame_plan`, art/muster_art/parts.py `ANIM`)

Each frame sets `parts.ANIM` and a root transform, then calls the kind's builder `(k, P, tier, pose)`:

- The root transform carries whole-body motion: the walk lean, the attack's crouch-back and lunge-forward with squash
  and stretch, the death topple about the back foot, the static bodies' recoil.
- `humanoid()` reads `ANIM` for the limbs: hips bob (`bob`), legs step from the bobbing hips to feet that stay on the
  ground (`step()`: planted half the cycle and sliding back at a constant rate, so the runtime can match the ground
  speed exactly), arms swing (`swing`), the chest breathes, and hands fling and flop as it dies. It pushes the upper-body
  bob onto the kit's transform stack until the builder's frame ends, so weapons, packs and capes drawn after it ride
  along; hands passed as Vectors are moved in place so weapons follow the arm swing.
- Builders place hands and weapons with `H.mix(pose, rest, strike, wind=..., cast=...)` (`mixd` for directions,
  `mixf` for numbers): the attack/cast frames set `ANIM["blend"]` from -1 (wind-up pose) through 0 (rest) and 1 (the
  strike) to 1.12 (overshoot). `H.strike(pose)` says whether the strike's own effects belong on a frame.
- Mounts, golems and bugs step their own legs with `H.step(..., k=k)`; the first walk frame records the stride (world
  units per cycle) into the sheet, and the runtime plays one walk cycle per stride travelled.

Check a body by building every frame without rendering, then rendering one kind and looking at its preview:

    blender -b --factory-startup -P art/render_all.py -- --only blades --tiers 1,4 --jobs 1 --no-post
    python3 art/post.py --only blades --no-pack
    MUSTER_ATLAS_OUT=/tmp/atlas python3 art/pack_atlas.py --only blades && MUSTER_ATLAS_OUT=/tmp/atlas python3 art/anim_preview.py --only blades --out /tmp/prev

On Jack's Mac every heavy job goes through the shared lock, one Blender batch per acquisition:

    lockf -k ~/Desktop/game_development/.heavy.lock nice -n 10 blender -b --factory-startup -t 4 -P art/render_all.py -- --only <kind> --jobs 1 --no-post

### Previews

`python3 art/anim_preview.py [--only kinds]` writes `art/contact/anim/<kind>.gif` (every clip at game timing, side,
three-quarter and back views, tier 1 and 4; ground ticks scroll under the side view at the walk speed, so a planted
foot should stay on its tick) and `<kind>.png` (every frame of every clip on one baseline, anchor marked).

## Team colour and files

Team parts render in neutral white plus a mask with the coverage of team main (R), dark (G) and light (B). The runtime
tints with the active direction's team colours (`TEAM` in `base/src/render/palette.ts`):

    rgb = colour * (1 + R*(main - 1) + G*(dark - 1) + B*(light - 1))

`pack_atlas.py` quantises colour and mask together into one palette per sheet (128 entries + transparent), so a sheet
ships as a single 8-bit image of palette indices and the tint runs on the palette (`tintPalette`, `tintIndexed` in
`base/src/render/sprites.ts`): one lookup per pixel, once per sheet and team.

- `base/public/atlas/<kind>_t<tier>.webp`: palette indices in the red channel (lossless WebP), 0 = transparent.
- `base/public/atlas/manifest.json`:

      { version: 4, style, ppu, el, dirs, dir8, anims, impact: { attack, cast }, teams: { tide, ember },
        units: { <kind>: { tiers: [1..4], radius } },
        sheets: { <kind>_t<tier>: { w, h, pal (base64, 7 bytes an entry: r g b a, mask r g b), stride, weight,
                                     anims: { idle: [dir][frame] = [x, y, w, h, ax, ay, s?], walk: ... | "idle", ... } } } }

  `s` is set on frames rendered below the atlas PPU (the death clip): the runtime draws them `1/s` larger.
  Identical frames share one rect. `tests/atlas.test.ts` checks the layout, clip counts and the 45 MB budget.

## Runtime

`BoardView.token()` draws `frame(kind, tier, side, anim, phase, cam.facing8(face, y))` with its anchor on
`cam.project(x, y, z)` at `cam.scaleAt(y) * spriteVis / ppu` screen px per atlas px. `animFor()` in units.ts picks the
clip: death while dying, then the cast (`castAt`, from the kind's special-move event: revive, raise, build, decoys,
ward, hook, rally aura, last stand, parry, brace), then the blow (the sim's swing, or an attack seen from an event:
shots, heals, spawns, waves, dives), then the wind-up (the cooldown is within `WINDUP` of the next blow and the target
is in reach: frames before `impact` play ahead of the hit), then walking, else idle. Clip timing (units.ts):

- idle: one loop per `IDLE_PERIOD` (heavy 1.9 s, mid 1.6 s, light 1.35 s), each body at its own phase and tempo
  (`idleJitter`), so a squad never breathes in lockstep.
- walk: the phase is integrated per body (`BoardView.stepGait`) at speed / (stride x drawn scale) cycles a second, so
  planted feet keep pace with the ground; heavy bodies raise dust on each footfall.
- attack: wind-up `WINDUP` (heavy 0.2 s, mid 0.16 s, light 0.12 s) before the blow, then `STRIKE_TIME` 0.35 s.
- cast: `CAST_TIME` 0.62 s, the first 30% before the release. death: 0.45 s, then a poof (vfx.ts) as the body fades.

Runtime juice on top of the frames (board.ts, all off in calm mode / reduce motion): a crouch through the wind-up and
a springy stretch on the blow (`strikeSquash`, scaled by motion class), the existing hit-stop (2-4 frames at 60 Hz on
big hits, juice.ts), a white hit flash and a knockback nudge away from the blow, ranged recoil on each shot, the
drop-in and battle-start hop with landing squash and dust, a contact shadow that shrinks and fades with hop height,
and heavy footfall dust. Until a sheet has loaded and tinted, the drawn token stands in.

Tinted sheets are a budgeted cache (`SHEET_BUDGET` 256 MiB in sprites.ts; one team's full set is ~1.1 GB decoded).
Each canvas counts w x h x 4 bytes and when `frame()` last asked for it; over budget, the least recently used sheets go
first (canvas resized to 0 x 0 so WebKit frees it at once) and rebuild on demand, the lower tier standing in meanwhile.
Never evicted: sheets pinned by `preload()` for the current battle (game.ts pins every body on the board at its rank,
and what it spawns, as each fight starts; the roster warm-up at level start is unpinned) and sheets drawn in the last
3 s on the current screen. `pickEvictions` is the pure policy (tests/sheetCache.test.ts); `node tools/sprite-mem.mjs`
plays ten levels back to back in headless WebKit and prints the peak (385.5 MiB unbounded, 255.9 MiB budgeted). Card portraits stay in
`base/public/portraits`.
