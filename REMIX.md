# Making a game

Remuster ships one finished game (*Crownfall*, in `base/`) and an engine that plays it (`engine/`). A new game is a
folder, `games/<id>/`, that replaces what the player sees and hears and leaves the rules alone. The same battle, with
the same seed, plays out identically in every game; only the picture, the words and the sound differ.

This guide is the whole method. Work through it in order. Each step ends with something to look at or run, and the
game is done when `npm run check -- <id>` passes **and** it looks like its own game next to the base one.

```
npm run new -- <id> "<Name>"         games/<id>/ with the files a game always changes
GAME=<id> PORT=5310 npm run dev      play it at http://localhost:5310 (hot reload)
npm run text -- <id>                 every phrase the engine ships -> games/<id>/lexicon.todo.json
npm run bake -- <id> [--preview]     draw the art in games/<id>/art into games/<id>/public
npm run music -- <id>                synthesise the soundtrack
npm run check -- <id> [--fast]       every check below, plus a play-through with screenshots
npm run publish -- <id>              upload the built game to the Remuster gallery (needs a backend, infra/README.md)
```

## The two rules

1. **Never edit `engine/`.** It is locked (`engine/ENGINE.lock.json`) and the server re-runs it to verify Arena
   results, so a changed engine cannot play online. Unit stats, costs, abilities, levels and economy are the game
   every Remuster game shares. If you think something in it is wrong, say so; don't patch it.
2. **Don't edit `base/` for a game.** Shadow it. Any file under `games/<id>/src/` replaces the file at the same path
   under `base/src/` for that game only; any file under `games/<id>/public/` replaces the same path in `base/public/`.
   To wrap rather than replace, import the original with the `@base/` alias:

   ```ts
   // games/<id>/src/ui/home.ts: the base home screen with its own Modes tab
   export { homeTopBar, battleTab, settingsBody } from "@base/ui/home";
   export type * from "@base/ui/home";
   import type { ModeCard } from "@base/ui/home";
   export function modesTab(cards: ModeCard[], settings: () => void, army?: () => void): HTMLElement { /* your layout */ }
   ```

## What a game is made of

| part | where | how |
| --- | --- | --- |
| direction | `games/<id>/DIRECTION.md` | one page, written first |
| words | `src/game/lexicon.ts` | phrase in, phrase out |
| units, arenas, keeps, effects, maps, key art, portraits | `art/*.ts` → `public/` | drawn in code with `artkit/`, baked |
| the world | `src/game/terrain.ts` | materials and shapes for every building, wall, road, tree and the globe |
| interface | `src/game/theme.css`, then shadowed `src/ui/*` | restyle, then re-lay-out where it matters |
| sound effects | `src/game/sounds.ts` | recipes for the built-in synth |
| music | `src/game/music.ts` + `public/music/` | `npm run music` writes both |
| name, tagline, colour | `game.json` | shown in the gallery and the browser chrome |

## 1. Direction

Write `games/<id>/DIRECTION.md` before anything else, and keep it to a page:

- **The world** in two sentences, and three reference points for its look (materials, era, mood), in your own words.
- **The two sides.** The player's side and the rival's each need one colour that owns them everywhere: units, keeps,
  health bars, deploy zones. They must be told apart at a glance by a colour-blind player, so separate them in
  lightness as well as hue.
- **Palette** (6 to 10 colours with jobs: ground, shadow, ink, panel, accent, go, danger) and **type** (one display
  face, one text face; system or bundled fonts only, see "Fonts").
- **What the interface is made of**: paper and ink? riveted brass? neon tubes on glass? This decides panels, buttons,
  bars and icons, and it should not be "the base game in other colours".
- **The cast.** For each of the 31 units and 6 spawned bodies (`artkit/README.md` lists them with role and size):
  what it becomes, and why its job still reads. A Bulwark is a slow wall of a unit whatever it is called: a riot
  shield, a boiler on legs, a walking safe. A Ranger is a fragile shooter. Keep silhouettes distinct from each other.

Everything after this follows the page. When a later choice is hard, the page decides it.

## 2. Words

`npm run text -- <id>` writes `games/<id>/lexicon.todo.json`: every phrase the engine ships, by section (units,
abilities, acts, levels, rivals, modes, chests, boons, quests, arenas...). Rename them in
`games/<id>/src/game/lexicon.ts`:

```ts
export const LEXICON: Record<string, string> = {
  "Ranger": "Deadeye",
  "Rangers": "Deadeyes",
  "Volley": "Fan the Hammer",
  "The Borderlands": "Dry Gulch",
  "Gems": "Silver",
  "gems": "silver",
  "War Pass": "Bounty Board",
};
```

One pair per line (the text dump reads them that way). It applies to every piece of text on screen and on the battle
canvas, including the callouts shouted over a fight ("WAVE", "HOOKED": the "battle callouts" section). Matching is case-sensitive, whole words,
longest phrase first. Re-run `npm run text` to see what is left (renamed phrases show their new value).

- All units, abilities and acts must be renamed. Levels, rivals and the interface words mostly so.
- Keep names short: a unit name sits under a 76 px card. Check the Army screen and the shop row for clipping.
- Ability *descriptions* contain numbers and rules; rename the nouns in them, never the meaning.
- The dump lists what the engine exports. A few generated phrases (rival titles and epithets in `engine/core/daily.ts`,
  `gauntlet.ts` and `arena.ts`; interface lines like "Win a battle", "Free chest") are not in it: play the game and
  add what you still see in the base game's voice.
- Don't reuse names of characters, places or products from existing games, films or books.

## 3. Art

All art is drawn in code and baked to the files the renderer loads. **Read `artkit/README.md` now**; it covers the
renderer, the rigs, every asset family, the file contract and the completeness list. `games/brasswick/art/` is a
complete worked example to read (not to copy shapes from).

```
games/<id>/art/index.ts      the GameArt: style, team colours, units, arenas, keeps, vfx, maps, ui, td
npm run bake -- <id> --preview --kinds ranger,bulwark     contact sheets in games/<id>/art/preview/ (seconds)
npm run bake -- <id> --only units --kinds ranger          bake just these
npm run bake -- <id>                                      everything, then the completeness check (~3 min)
```

Order of work, looking at the preview after each:

1. **Style and five units** (a tank, a shooter, a caster, a flier, a structure) until the look is right. Open the
   contact sheet. Compare with `games/brasswick/art/preview/_roster.webp` and the base game for size and ink weight.
2. **All 37 bodies.** Then the roster sheet: can you name each one's job from its silhouette alone, at the size it
   is drawn on a phone? Fix the ones you can't. The camera looks down from behind the player, so hats and shoulders
   carry more than faces; give each unit one large, readable prop.
3. **Arenas** (ten backdrops, one per campaign act), **keeps** (five damage states, the boss keep, skins),
   **effects**, **map pages**, **home key art**, **Bastion** backdrops, **portraits**.
4. In the running game: a battle in three different acts, the Army screen, the map, the home screen.

Budget: keep `games/<id>/public` under about 45 MB (`atlas.ppu` and `atlas.colors` in `art/index.ts` are the knobs;
104 ppu with 48 colours lands near 43 MB).

Two things that bite: upright faces fall in the darkest shade band, so team paint on shields, doors and banners
bakes almost black unless the material sets `shade: 0.3`; and tall parts at the back of a keep can be clipped by
its canvas, so check the keeps sheet.

### The world: buildings, sets and the globe

Every battlefield is the top of a small globe the player can turn (drag to spin and tip it, pinch to zoom,
double-tap to come back), so nothing on it can be a picture taken from one side. Levels are sets: houses, halls,
towers, mills, chapels, gatehouses, walls, market stalls, carts, crates, wells, ponds, roads, plazas, tall grass,
orchards and cornfields. The renderer builds every one of them as solid geometry from
`games/<id>/src/game/terrain.ts`:

- `mat`: the materials (stone, plaster, timber, roofs, cloth, metal, foliage, rock, lit windows...).
- `roof`, `tree`, `lamp`: the world's shapes (gable, hip, flat, dome, pagoda or barrel roofs; round trees, pines,
  palms, cacti, dead trees, bamboo, neon pylons; lamp posts, braziers, lanterns, neon bars).
- `looks`: per building type, a height, wall colour, roof shape and roof colour where the default is wrong.
- `ink`, `inkW`, `light`, `dark`, `tint`, `bands`: outline and shading (`inkW: 0` for no outlines, `bands: 0` for
  smooth shade).
- `road`, `plaza`, `water`, `bridge`, `brush`: the ground-level things.
- `sky`, `soil`, `halo`, `scenery`: the sky behind the globe, the globe's rim, and how many trees, rocks, houses
  and lamps stand around the battlefield.
- `ARENA_BACKDROP`: which of the game's painted grounds each of the 12 arenas is fought on.

Look at all of it at once with `?film=kit&still` (every building type on one board), turn it with
`&yaw=150&tilt=50&zoom=1.4` (degrees), then check real levels: `?arena=old-village`, `?arena=the-crossing`,
`?film=arena`. A game that needs a shape the kit can't make shadows `src/render/props.ts`, imports the original as
`@base/render/props` and adds a builder to `BUILDERS` (a builder is a function that adds boxes, prisms, roofs and
panels to a mesh: read `house` or `stall` there for the pattern).

The painted arena ground (`art/arenas.ts`, baked to `public/arenas`) is still what the ground looks like: it is
taken back off its camera and laid on the globe. The scenery it paints around the board is only seen blurred, as
ground colour, so put the effort into the ground itself and let `scenery` in `terrain.ts` stand the trees.

## 4. Interface

Start in `games/<id>/src/game/theme.css`. It loads after every base stylesheet, so its rules win. Scope everything
with `html[data-game="<id>"]` if you want to be safe against specificity ties.

**Tokens** (set them on `:root`): `--k-panel` `--k-panel-dk` `--k-frame` `--k-accent` `--k-text` `--k-text-lt`
`--k-go` `--k-danger` `--k-page` `--k-page-dk` `--k-ink` `--k-plate` `--k-plate-hi` `--k-blue` `--k-muted` `--k-well`
`--k-scrim`; team colours `--tide` `--tide-d` `--tide-l` (player) and `--ember` `--ember-d` `--ember-l` (rival);
`--font` (text), `--display` (headings and numbers); `--gold` `--gold-d`; `--gloss`; card frame metals `--t1`..`--t4`;
role families `--fam-*`. Setting these alone is a recolour, which is where you start, not where you stop.

**Team colours are not CSS.** `--tide*` and `--ember*` are written onto `<html>` at boot from
`base/src/render/style.ts`, which also colours the battle canvas (health bars, zones, glows). To change the two
sides' colours, shadow that file (`games/<id>/src/render/style.ts`) and keep them equal to your art's team colours.

**Drawn icons are code, not CSS.** The currency icons (`ui/currency.ts`), chest art (`ui/chests.ts`), tab icons
(`ui/tabs.ts`) and the glyph set (`ui/kit.ts`) are small SVGs built in those files. Shadow the file to redraw them.

A shadow file added while the dev server is running is not picked up until you restart it.

**Parts** (restyle the part and every screen follows):

| part | classes |
| --- | --- |
| surfaces | `.panel` `.sheet` `.overlay` `.pop` `.tip` `.plate` `.pill` `.banner` `.ribbon` |
| buttons | `.btn` (`.primary` `.big` `.ghost` `.boon`) `.icon-btn` `.chip` |
| battle HUD | `.hud-top` `.hud-bottom` `.hpbar` `.round` `.shop` `.card` (`.card-art` `.card-cost` `.card-name` `.card-role`) `.reroll` `.cmdr` |
| results | `.results` `.result-stats` `.result-stars` `.result-crest` `.objectives` |
| home and tabs | `.hm-stage` `.hm-life` `.hm-top` `.hm-battle` `.hm-go` `.hm-cards` `.hm-card` `.tb-bar` `.tb-tab` `.tb-badge` |
| campaign map | `.map` `.map-view` `.map-trail` `.map .node-face` `.node-name` `.node-boss` `.act` `.act-gate` |
| Army | `.ar-grid` `.ar-tile` `.ar-detail` `.ar-deck` `.ar-slot` `.ar-cmd` `.r-common` `.r-rare` `.r-epic` `.r-legendary` |
| Arena | `.arena-screen` `.ar-ladder` `.ar-league` `.ar-badge` `.ar-bar` `.ar-next-match` `.ar-arena` |
| chests, shop, pass | `.ch-*` `.shop-*` `.starter-*` `.pass-*` `.pt-*` `.pq-*` `.of-*` |
| daily, puzzles, lab | `.daily-*` `.puzzle-grid` `.lab-body` `.chips` |

A re-skin that holds up changes, at least: the page background and the home stage; panel and sheet construction
(border, corner, texture, shadow: paper is not brass is not glass); both button shapes and their pressed state; the
unit card frame and cost badge; health bars; the tab bar; headings and number type; ribbons and banners. Then
**re-lay-out** what your direction calls for by shadowing the screen's file in `games/<id>/src/ui/`: a different
home composition, a side rail instead of a bottom bar, a ledger instead of a card grid. Screens are plain DOM built
with `el()` (`base/src/ui/dom.ts`); keep the same exported functions and callbacks and the rest of the game won't
notice.

**Fonts.** Bundled fonts go in `games/<id>/public/fonts/` with an `@font-face` in `theme.css`. Only ship fonts whose
licence allows redistribution (SIL OFL, Apache); otherwise use system stacks. Text drawn on the battle canvas (damage
numbers, callouts, health bars) is drawn by `base/src/render/juicedraw.ts` with its own font; shadow that file to
change it. The base kit sets type with the `font` shorthand, which resets `font-size-adjust`; set sizes explicitly
if your face is much wider or narrower.

**Images in CSS.** The home stage and title use `/ui/title-key.webp`; the bake writes your key art there. Anything
else you reference goes in `games/<id>/public/ui/`.

Many base panels are painted with a gradient and no plain colour underneath (`.ar-detail`, `.ar-tile`, `.ch-slot`,
`.pt-cell`, map nodes...). If your skin removes gradients, give those a `background-color` or they turn transparent.

The canvas itself is yours too: a game that needs a different resolution or no smoothing (pixel art) subclasses
`BoardView` in a shadowed `src/render/board.ts`; `games/pixelkeep` does.

The check's play-through does not open everything. Also look at: an Army card's detail sheet, a unit popover and
the pause menu in a battle, both result screens, the pass, an opening chest.

Look at every screen at 390 x 844: `node tools/shot.mjs "/?tab=army" out.png` (also `/`, `/?tab=shop`, `/?tab=modes`,
`/?tab=pass`, `/?campaign`, `/?arena`, `/?level=3`, `/?daily`, `/?gauntlet`, `/?puzzles`, `/?lab`, `/?chests=open`,
`/?settings`, `/?gemdemo=reward` (a won result), `/?gemdemo=rally` (a lost one), `/?td`; add `demo` to any of them
(`/?demo&tab=army`) for a mid-game save instead of an empty one; set `PORT` to your dev server's). Text must not clip, nothing may sit under the notch or home bar
(`?safe=59,34` fakes them), and tap targets stay at least 44 px.

## 5. Sound

`games/<id>/src/game/sounds.ts` voices every effect as layers for the built-in synth: tones (wave, start and end
pitch, length, loudness) and filtered noise. The names are fixed; what they sound like is yours. Re-voice the ones a
player hears most first: `hit` `slash` `arrow` `boom` `tap` `buy` `place` `fight` `win` `lose`. Keep peaks modest;
forty of them can play in a second.

`npm run music -- <id>` synthesises the soundtrack (home, battle, boss, win, lose) into `public/music/` and writes
`src/game/music.ts`. Every game shares one tune in its own arrangement; `tools/music/README.md` explains how to add
an arranger for a new style (instruments, rhythm, voicing). Nobody can hear your render but the player: run
`python3 tools/music/check.py <id>` (level, peaks, loop seam, tuning) and keep leads simple.

## 6. Check

```
npm run check -- <id>
```

| check | passes when |
| --- | --- |
| engine | `engine/` matches the lock |
| manifest | `game.json` has id, name, tagline, themeColor |
| words | every unit, ability and act renamed; most levels and interface words |
| skin | `theme.css` restyles the UI |
| sounds, terrain, music | each is the game's own; every music file exists |
| art | `artkit` completeness: every body, tier, clip, arena, keep, effect, map, portrait present and loadable |
| types, build | `tsc` and `vite build` pass |
| plays | the game boots; home, Army, Modes, Shop, map and Arena ladder render; a battle and an Arena battle play to the end; no console errors, no missing files |

It writes screenshots of all of that to `games/<id>/art/preview/screens/`. **Open them.** Then put each next to the
same screen of the base game and ask:

- Would a stranger think these are two different games, or one game with a filter?
- Can you tell the two sides apart in the battle shot in under a second? Tank from shooter from healer?
- Is any text clipped, any panel unstyled (still parchment and wood), any icon off-theme?
- Which screen is weakest? Fix that one, and run the check again.

When it holds up, say what is still weakest, and stop.

## How it fits together (for when something surprises you)

- `vite.config.ts` reads `GAME`. Imports of `base/src/**` resolve to `games/<id>/src/**` when that file exists
  (`@base/*` always means the original). `games/<id>/public` is served over `base/public`. The build goes to
  `dist-games/<id>/`.
- `__GAME__` is the id at build time; `<html data-game="<id>">` is set at boot.
- The renderer reads battles through events (`docs/EVENTS.md`). Arena rules are in `docs/ARENA.md`.
- Film mode (`?film=clash|duel|siege|arena`) plays a fixed battle for video capture; `video/README.md`.
- Saves, purchases, accounts and the Arena ladder are the engine's and the backend's; a game needs no code for them.
