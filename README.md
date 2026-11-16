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
| `docs/ARENA.md`, `docs/EVENTS.md` | Arena rules; what a renderer reads from a battle |
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
`?daily` `?gauntlet` `?puzzles` `?lab` `?watch` `?film=clash|duel|siege|arena` `?demo` (a mid-game save).
`node tools/shot.mjs "/?arena" out.png` takes a phone-size screenshot.

## How a battle works

Each commander has 400 health. Every round both sides buy units from a shop of four and place them anywhere in
their half; units stay on the board and come back each round, so armies build up. Then the battle plays out on its
own: free steering, no grid, every unit with its own behaviour and one ability. The loser of a round takes damage: a
base that grows each round plus twice the threat of the winner's survivors. Upgrade a placed unit to rank 2, 3 and 4;
sell for half; unspent gold earns interest.

Modes: **Campaign** (10 acts of 6 levels, a boss each), **Arena** (battles around walls, buildings, cover and water
on a trophy ladder; `docs/ARENA.md`), **Daily**, **Gauntlet**, **Breakpoint** puzzles, **Skirmish** (the AI lab) and
**Bastion** (tower defence).

The sim is pure TypeScript and deterministic (`engine/core`): no DOM, no clock, no `Math.random`. It emits events a
renderer turns into pictures and sound. The AI (`engine/core/ai.ts`) drafts and places by simulating candidate
boards against what it can see of yours.

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
