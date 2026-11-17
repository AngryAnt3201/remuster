# Remuster

One auto-battler, any number of games. Remuster is a finished iPhone game (*Crownfall*: draft an army, place it, watch
it fight) split into two halves:

- **The engine and backend** (`engine/`, `infra/`): the battle sim, rules, AI, 31 units, a 60-level campaign, five
  other modes, the Arena ladder, progression, economy, purchases, accounts, cloud saves and hosting. Locked, shared by
  every game, and re-run on the server to verify results.
- **The game** (`base/`, then `games/<id>/`): everything a player sees and hears. Art, interface, words, sound,
  music. Made to be replaced, by hand or by telling Claude Code what the game should be.

```
/remix dustline a spaghetti western          in Claude Code: makes games/dustline/ from the base game
```

The same battle with the same seed plays out identically in every game; only the picture and sound change.

| | |
| --- | --- |
| `REMIX.md` | how a game is made: direction, words, art, interface, sound, checks |
| `CLAUDE.md`, `.claude/` | the hand-off to Claude Code: the `/remix` command and a hook that keeps `engine/` locked |
| `artkit/README.md` | drawing units, arenas, keeps and effects in code and baking them |
| `docs/ARENA.md`, `docs/EVENTS.md` | terrain rules (walls, cover, roads, brush), the arenas and campaign sets; what a renderer reads from a battle |
| `infra/README.md` | the backend: local server, one-step deploy, publishing games |
| `video/README.md` | the launch video: captures, soundtrack, edit, voice-over |
| `tools/music/README.md` | the soundtrack synth and how a new style gets its arrangement |

## Games in this repo

| id | game | look |
| --- | --- | --- |
| `base` | Crownfall | storybook fantasy (Blender-rendered) |
| `brasswick` | Brasswick | steampunk: brass, soot and gaslight |
| `dustline` | Dustline | spaghetti western |
| `neonhold` | Neonhold | neon megacity, synthwave |
| `pixelkeep` | Pixelkeep | 8-bit cartridge |
| `inkfall` | Inkfall | brush and ink on rice paper |

## Run

```
npm install
npm run dev                          # Crownfall at http://localhost:5300
GAME=brasswick PORT=5310 npm run dev # any other game
npm test                             # sim, match, AI, content, Arena, progression, store, art contracts, backend API
npm run typecheck && npm run build   # GAME=<id> npm run build -> dist-games/<id>/
npm run check -- <id>                # is a game complete? (plays it and takes screenshots)
npm run infra:dev                    # the backend, locally, with no cloud account
npm run ios:run                      # build, install and launch on the booted iOS simulator
```

Deep links for looking at one thing: `?level=3` `?arena` `?arena=old-village` `?tab=army|shop|modes|pass` `?campaign`
`?daily` `?gauntlet` `?puzzles` `?lab` `?watch` `?film=clash|duel|siege|arena|kit` `?demo` (a mid-game save);
add `&yaw=120&tilt=45&zoom=0.7` (degrees) to any battle to look at the world from a fixed side.
`node tools/shot.mjs "/?arena" out.png` takes a phone-size screenshot.

## How a battle works

Each commander has 400 health. Every round both sides buy units from a shop of four and place them anywhere in
their half; units stay on the board and come back each round, so armies build up. Then the battle plays out on its
own: free steering, no grid, every unit with its own behaviour and one ability. The loser of a round takes damage: a
base that grows each round plus twice the threat of the winner's survivors. Upgrade a placed unit to rank 2, 3 and 4;
sell for half; unspent gold earns interest.

Modes: **Campaign** (10 acts of 6 levels, a boss each; many are fought on a small designed set: a farmstead, a ford,
a toll gate), **Arena** (twelve designed places on a trophy ladder: villages, river crossings, a mill farm, with roads
that speed a march, cover to shoot from and brush to lie in wait in; `docs/ARENA.md`), **Daily**, **Gauntlet**, **Breakpoint** puzzles, **Skirmish** (the AI lab) and
**Bastion** (tower defence).

The battlefield is the top of a small globe: drag to spin and tip it, pinch to zoom, double-tap to come back. Units
are sprites that turn to face the view; buildings, walls, trees and props are solid geometry built in code
(`base/src/render/kit3d.ts`, `props.ts`, `world.ts`), so every level can be seen from any side.

The sim is pure TypeScript and deterministic (`engine/core`): no DOM, no clock, no `Math.random`. It emits events a
renderer turns into pictures and sound. The AI (`engine/core/ai.ts`) drafts and places by simulating candidate
boards against what it can see of yours.

## Seeing the rival's game

After an Arena battle the results offer "See it in <rival>'s game": a compare view opens with the deciding round
playing in your game and in the rival's game at once, and a slider you drag to wipe from one to the other, with one
Close button. It works because every game runs the same engine: the round travels as a link
(`<game>#replay=<payload>`, `base/src/replay.ts`), each game fights it again in its own look, and the two are started
together. Nothing is recorded as video. It is optional (Settings: "Rival's game after Arena battles") and only
appears when another game can be reached: the backend's gallery of published games, `VITE_REMUSTER_PEERS` at build
time (`id|Name|url,...`), or `?peer=<url>&peername=<Name>` in the address to try it locally. Today's Arena rivals
are AI, so each is given a game from that list (the same rival always plays the same one); with real players the
server already knows which game each is playing (`setGame`) and would hand each the other's.

## Backend

`infra/` is one Cloudflare Worker with a D1 database and an R2 bucket: anonymous player accounts, cloud saves, the
gallery of published games (each served at `/g/<id>/`), the Arena ladder (results are re-simulated by the engine
before trophies move) and analytics events. It runs locally with `npm run infra:dev`, and deploys in one step:

```
npx wrangler login       # once, in your own Cloudflare account
npm run infra:deploy     # creates the database and bucket, runs migrations, deploys, writes .env.production
```

`npm run publish -- <id>` uploads a built game to the gallery.

## Release (App Store)

`app.config.json` is the one place for the store name, home-screen name, version, build, bundle id and team;
`npm run release:config` spreads it to Xcode, the listing (`store/`) and the site (`site/`).

```
npm run ios:release:dry   # Release build for the simulator, unsigned
npm run store:shots       # App Store screenshots into store/screenshots
npm run ios:release       # signed Release archive (talks to Apple)
npm run ios:export        # App Store .ipa from that archive
```

Step by step: `store/RELEASE-CHECKLIST.md`. Listing copy: `store/LISTING.md`.
