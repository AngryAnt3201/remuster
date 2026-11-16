# Arenas

One Blender-rendered battlefield per campaign act in the active style direction (Sunlit Meadow), built for the 3/4
camera (`base/src/render/camera.ts`), plus the props that obstacles stand up as.

| Act | Arena | Ground | Border, scenery and foreground | Obstacle prop |
|---|---|---|---|---|
| 1 | Borderlands | mown-stripe meadow, flower clumps, tufts, worn path with pebbles, cobbled road across the strip | stone-footed hedges, banners at the far gate; broadleaf canopy leaning over the sides | mossy boulder |
| 2 | Ash Fields | dry gold grass, dry clumps with embers, cracks, cracked-mud plates across the strip | stone-footed autumn hedges, dead trees, banners; autumn canopy | charred stump with embers |
| 3 | Hollow Wood | deep green grass, ferns, moss, roots, toadstool fairy rings, mossy flagstones across the strip | hedges, broadleaf and pine wood; green canopy | mossy stump with toadstools |
| 4 | Iron Pass | highland grass, heather, gravel, cracks, ore-cart track (sleepers and rails) across the strip | low rocks, pines and crags, banners; pine boughs | crag with an iron streak |
| 5 | High Keep | flagstone courtyard on a plinth, red runner, sunken lawn strip, cracks | low stone walls, topiary, banners; topiary and lanterns | stone column with a lantern (one broken, one bannered) |
| 6 | Frozen Reach | snow, frozen stream, frost clumps with ice crystals, boot prints | snow banks, snowy pines, banners; snowy pine boughs | snow-capped rock with ice crystals |
| 7 | Sky Throne | warm marble courtyard, lapis-and-gold rosettes and edge bands, gold sandstone strip, blue runner | gold-finial balustrade, lapis banners; banner pillars and cloud banks, drifting wisps | crystal obelisk on a gold and marble plinth |
| 8 | Mirelight Fen | fen grass, mere with boardwalk, tussocks, puddles, glinting water | reeds and lantern posts; willow curtains | peat mound with a lantern |
| 9 | Saltwind Coast | clifftop grass, sandy strip, sea-thrift clumps, gravel, path wear; a storm sea a cliff's height below the far and right edges with surf, whitecaps and sea stacks | driftwood posts strung with rope and buoys, wind-bent pines and gorse, the red-banded lighthouse and keeper's cottage on the headland; wind-bent pines and gorse leaning in, spray rising off the sides; cool storm grade | barnacled sea rock with turf (one with a buoy, one with driftwood and a gull) |
| 10 | Crownfall Citadel | dusk sandstone flagstones, overgrown sunken lawn strip, gold seal and trim, rubble clumps, cracks | broken low walls, ruined pillars and wall stretches, braziers, the ruined keep beyond the far gate (curtain wall, cracked arch, broken towers, torn violet banners); broken pillars with torn banners, wall-top braziers and dead trees, embers rising; amber-to-violet dusk grade | snapped column, toppled drums with the fallen gold crown, rubble under a torn banner |

Every arena keeps the same layout so the board reads the same everywhere: a sandy neutral strip between the two
deploy zones with a kerb on each zone line, a path from keep to keep, a paved plaza under each keep and a low border
just outside the board. Shapes and palettes are original and built from primitives; nothing is traced.

## How it fits the camera

- `base/public/arenas/act<n>.jpg` is rendered through the game's own pinhole camera (same tilt and distance as
  `camera.ts`, Blender perspective camera with matching lens and shift). The manifest's `view` is the normalised
  image-plane rectangle it covers, so the game draws it with one scale and offset (`backdropRect`) and its ground
  lines up with the board exactly on any screen size. The render script checks this with Blender's own projection
  (`camera check: max error 0.00px`). Everything in it is static and outside the play area.
- `base/public/arenas/act<n>_prop<0..2>.png`: obstacle props modelled with their base on the unit circle (radius 1 = the
  collision radius), rendered orthographic at the camera's mid-board elevation with a baked contact shadow. The
  board stands each on its obstacle (`propRect`) in the same depth sort as units and keeps.
- `base/public/arenas/act<n>_fg.webp`: the foreground, rendered alone through the same camera (same frame as the
  backdrop): canopy, boughs, banner pillars or cloud banks that overhang the board's side edges. They are in the
  backdrop too; this copy is drawn over the units (`base/src/render/foreground.ts`). The manifest's `fg.cells` cut it into
  bands per side (tight boxes of covered pixels); a cell fades to 28% while a unit's screen box overlaps it and eases
  back when it leaves, so units under the canopy stay readable.
- Ground dressing per act (`dress` in the render script): mown stripes, a cobbled road across the neutral strip,
  path wear and pebbles, flower/fern/heather/dry-grass clumps, tufts, moss, gravel, cracks, banners, and for the Sky
  Throne lapis-and-gold rosettes and edge bands. All of it is low so units stand over it, and it stays off the path
  and the keep plazas. Obstacles still come only from the sim and stand up as props.
- Ambient motion (`foreground.ts`, drawn under the units): water glints on the Fen's mere, cloud wisps drifting
  past the Sky Throne, spray off the Saltwind cliffs and embers from the Crownfall braziers (the last three outside the board).
- The board lays a light team wash over each deploy zone and a glowing back line on top of the art.
- If the art is missing or was rendered for a different camera, the board falls back to its drawn terrain.

## Rendering

`npm run art:arenas` (`-- --only 1,5 --samples 16 --quick`): Eevee, about 10 s per act. Tests: `tests/arenas.test.ts`.
