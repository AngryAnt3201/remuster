# Muster art v3: style directions and the shared contract

v3 moves battles from a straight-down board to a 3/4 diorama while the sim stays 2D. Every v3 renderer
(characters, arenas, keeps, VFX, UI kit) reads two kinds of file from `art/style/`:

| File | What it fixes | Who changes it |
| --- | --- | --- |
| `contract.json` | camera, pixels per unit, facings, poses, atlas and arena layout, size budget | changes need every art item re-checked |
| `meadow.json`, `dusk.json`, `toy.json` | one style direction each: numbers and colours only | free to tune |
| `active.json` | which direction renders by default | set once Jack picks |

`tests/style.test.ts` pins the contract to the sim (`W`, `H`, `ZONE_DEPTH` in `engine/core/defs.ts`), checks
the ground projection inverts exactly, checks the facing mirror table and checks all three directions fill
the same parameter slots, so a renderer written against one works with the others.

## Style directions

Rendered side by side in `outputs/signoff/muster-style/index.html` (`npm run art:style`, ~2 to 10 min).

| | Direction | Look |
| --- | --- | --- |
| A | Sunlit Meadow (`meadow`) | bright midday tabletop, thick warm-brown ink, three soft cel bands with violet shadows, warm rim |
| B | Lantern Dusk (`dusk`) | blue-hour field, thin near-black ink, hard bands with deep blue shadows, strong cyan back-rim, glowing lanterns and windows |
| C | Painted Toy (`toy`) | pastel painted play-set, no hull lines (silhouette only), two hard bands, tiled ground, fences and blocks |

`active.json` says `meadow` provisionally so pipeline work has a default. Mass production waits on Jack's pick.

### What each section drives

| Section | Read by | Effect |
| --- | --- | --- |
| `outline.hull` | `Kit(outline=...)` for units | inverted-hull line width in world units (0 turns hull lines off) |
| `outline.props` | the world kit (arena props, obstacles, keep) | same, for scenery |
| `outline.color` | `kit.INK` via `style.apply`, `post.py --style`, `style.ink` | every line and the outer silhouette |
| `outline.silhouette_px` | `style.ink` / `post.py` | outer ink silhouette dilation in output pixels |
| `shading.bands` | the kit's `Toon` node group (rebuilt by `style.apply`) | cel ramp: `[position, value]` pairs over N.L |
| `shading.shadow_tint`, `shadow_tint_amount` | `Toon` group | colour mixed into the dark bands |
| `shading.spec` | `style.make_pal` | multiplier on metal highlight strength (steel, gold...) |
| `shading.bloom` | `style.bloom` | Ascended / glow bloom strength |
| `rim.*` | `Toon` group | grazing rim light colour, strength, width and direction |
| `light.key` | `kit.set_light` | key light direction (Blender world space) |
| `team.tide/ember` | `kit.TEAMS`, `post.py` | team colour mask colours (main, dark, light) |
| `palette.*` | `style.make_pal` -> `parts.Pal` | every unit material (skin, cloth, leather, wood, steel, gold, stone...) |
| `ground.*` | arena renderer (`style.ground_mat`, prop builders) | grass, path, neutral strip, kerb, rocks, foliage; `border` and `obstacle` pick prop families |
| `keep.*` | keep renderer | stone, roof (`team.main` / `team.dark` use the team mask), trim, wood, windows, `window_glow` |
| `shadow.*` | contact shadows under every unit, prop and keep | colour and alpha |
| `grade.*` | `style.grade` on composited frames | saturation, contrast, warmth, vignette |
| `vfx.*` | VFX sheet renderer | per-effect colours, `blend` (additive or normal) and `glow` |
| `ui.*` | UI kit | font, panel, frame, accent, button, danger, page colours |

Directions hold no geometry. Prop families (`border`: hedge, wall, fence; `obstacle`: boulders, pillars,
blocks) are names the arena renderer switches on.

### Using a direction from Python (Blender)

```python
from muster_art import style as S, kit as K
st = S.load()                 # active direction, or S.load("dusk"), or MUSTER_STYLE=dusk
S.apply(st)                   # ink, team colours, toon bands, shadow tint, rim, key light
P = S.make_pal(st)            # unit materials
k = K.Kit(outline=st["outline"]["hull"])
```

The v2 character pipeline already takes it: `MUSTER_STYLE=dusk npm run art` (or
`blender -b -P art/render_all.py -- --style dusk`, `--style active` for the picked one) renders every unit with that direction, and `art/post.py --style` uses its ink and team
colours. Without the flag the shipped v2 look is kept, so today's sprites only change when someone asks.

### Using a direction in the app

`base/src/render/style.ts` imports the same files: `STYLE` is the active direction, `styleById(id)` any of the
three, `CONTRACT` the contract. Already wired:

- `base/src/render/palette.ts` takes the team colours (`TEAM`, glow and zone tints) and the effect tints `GOLD`,
  `HEAL`, `ZAP`, `VIOLET` from `team.*` and `vfx.*`, so the canvas renderers (`board.ts`, `units.ts`, `fx.ts`)
  follow the direction.
- `base/src/main.ts` calls `applyStyleVars` at boot: the stylesheet's `--tide`, `--tide-d`, `--ember`,
  `--ember-d` and `--gold` come from the direction, every `ui.*` slot is exposed as `--ui-<slot>` and the
  outline colour as `--style-ink` for the UI kit. `<html data-style="meadow">` names the active one.

Meadow's team and effect colours equal the v2 constants, so today's game looks the same until the pick.
The page background (`--ink`) and board chrome (`INK`, `BOARD`) stay v2 until the UI kit and arena items
replace them.

### Recording the pick

`npm run style:pick -- dusk` writes `art/style/active.json` (no argument prints the current one). The game
and every Blender renderer then use it; re-render with `npm run art -- --style active`.

## Contract

### World and camera

- Game axes: x right, y toward the player (down the screen), z up. Blender `X = x`, `Y = -y`, `Z = z`.
- Orthographic camera, no yaw, ground and scenery at `elevation_deg` 55. `ppu` 128 output pixels per
  world unit, rendered at `supersample` 2 and box-downsampled.
- Ground projection: `sx = x * ppu`, `sy = (y * sin(el) - z * cos(el)) * ppu`. A touch on the ground inverts
  exactly: `x = sx / ppu`, `y = sy / (ppu * sin(el))`. Touch placement and zones therefore still map 1:1 to the
  sim, only scaled vertically by `sin(55) = 0.819`.
- Units are billboards rendered at `sprite_elevation_deg` 35 so faces and weapons read, and drawn
  `unit_scale` 1.3x true size for phone readability. Collision stays true size. The sprite's feet anchor
  sits on the ground projection of the body centre.
- Everything above the ground sorts back to front by y (then by draw layer for flyers).
- Every light vector has Blender X = 0 (symmetric about the camera plane) so mirrored facings are lit the same.

### Facings and poses

- 8 facings, game angle 0 = +x (E), 90 = toward the player (S): E 0, SE 45, S 90, SW 135, W 180, NW 225, N 270, NE 315.
- Rendered: S, SE, E, NE, N. Mirrored horizontally: SW from SE, W from E, NW from NE.
- Models are built facing +X, Blender yaw = `-angle`.
- Poses: idle 4 frames at 6 fps loop, walk 6 at 12 loop, attack 6 at 14 (hit on frame 3), death 6 at 12.

### Atlases

- `base/public/atlas/<kind>/t<tier>.webp` (PNG fallback), `t<tier>_mask.webp` team mask, `t<tier>.json` with
  per-frame rects and the feet anchor. Max 2048 px, 2 px padding, trimmed.
- Team colour comes from the mask at draw time (neutral grey bakes, `neutral_team` in the contract).

### Arenas and keeps

- `base/public/arena/<act>/ground.webp`: flat ground only, covering the board plus margins at the contract camera.
- `base/public/arena/<act>/props.webp` + `props.json`: tall props and obstacles as depth-sorted sprites with a
  ground anchor and a collision radius. Obstacles are built on their collision circles (the sign-off page's
  "Show collision + zones" overlay draws circles from game coordinates on top of the render as the check).
- `base/public/arena/keep/<state>.webp`: keep states 100, 66, 33, 0 via the team mask. Enemy keep anchor
  `(4.5, -0.9)` radius 1.1, the player's mirrors to `y = 14.9`.

### VFX

- `base/public/vfx/<name>.webp` + `<name>.json`: square frames, frame count and fps per sheet. Glow blend mode comes
  from the active direction (`vfx.blend`).

### Budget (MB)

App 120: units 60, arenas 22, VFX 10, UI 12, code and fonts 6.

## Style frames (`art/style/frames.py`)

One Blender worker per direction, run in parallel. Each renders with the same models and composites the way
the game will:

1. the ground and scenery layer (ground, path, strip, borders, trees, obstacles, keep, contact shadows) at 55 degrees,
2. each unit alone at the 35 degree sprite camera with its ink silhouette baked and its glow pass kept apart,
3. sprites pasted back to front by y at their feet anchors, bloom added, then downsample and grade.

Outputs: `lineup.jpg` (Ranger T1 to T4, Stormcaller T4, Colossus T2), `slice.jpg` (enemy keep to past the
midline, level 1 obstacles, nine units fighting), `turn_<facing>_<pose>.png` (transparent sprites exactly as the
game gets them) and `data.js` with the frame geometry the page uses for its overlay.

Known gaps in the frames, for the items that follow: the scenery here is a prototype for the arena and keep
items, not final props; walk and death poses are not shown; VFX are only the Ascended glow.
