# The Remuster backend

One Cloudflare Worker (`src/worker.ts`) with a D1 database and an R2 bucket. It is what every game shares:

| | |
| --- | --- |
| `POST /v1/players`, `GET/PUT /v1/me` | anonymous account per install, signed token, display name |
| `GET/PUT /v1/save` | cloud save with revisions (a stale write gets the server's copy back to merge) |
| `GET/POST /v1/games`, `PUT /v1/games/<id>/files/<path>`, `POST /v1/games/<id>/publish` | the gallery of player-made games; a game goes live only when a whole upload is published |
| `GET /g/<id>/...` | the published games themselves, served from R2 under a strict Content-Security-Policy |
| `POST /v1/arena/match`, `POST /v1/arena/result`, `GET /v1/arena/leaderboard` | the Arena ladder; results are re-simulated by the engine before trophies move |
| `POST /v1/events` | product analytics |
| `POST /v1/games/<id>/report`, `PUT /v1/admin/games/<id>` | players report a game; the operator hides or restores it (`ADMIN_TOKEN`) |

Games reach it through `engine/net/client.ts`. With no backend configured they play fully offline.

## Run it on this machine (no cloud account)

```
npm run infra:dev                                       # http://localhost:8787, state in infra/.local/
REMUSTER_API=http://localhost:8787 npm run publish -- brasswick   # build a game, upload it, open the printed URL
VITE_REMUSTER_API=http://localhost:8787 npm run dev     # the base game against the local backend
npx vitest run infra                                    # API, client, Arena ladder and cloud-sync tests on real SQL
```

The local server is the same Worker code on Node's built-in SQLite and a folder, so what passes here is what ships.

## Put it on the internet: one step

```
npx wrangler login        # once per machine: opens the browser to sign in to Cloudflare
npm run infra:deploy
```

`deploy.mjs` creates the database and bucket if they are missing, applies new migrations, generates and stores the
signing secret and the admin token (first run only), deploys the Worker, checks it answers, and writes its URL to
`.env.production`, so `npm run build` and `npm run publish -- <game>` use it from then on. Run it again any time to
ship a backend change. `npm run infra:deploy -- --dry-run` only checks the sign-in.

After the first deploy, three things are worth doing in the Cloudflare dashboard (none are needed to go live):

1. Put a custom domain on the Worker.
2. Route a second hostname to it and set `GAMES_ORIGIN` in `infra/wrangler.toml` to that hostname, so player-made
   pages are served from a different origin than the API.
3. Set `ALLOW_ORIGINS` to the origins the API should accept, once the domains are fixed.

## The Arena ladder: what the server checks

With a backend configured, the ladder lives on the server. The device keeps a copy for its screens.

1. `POST /v1/arena/match { levels?, roster?, hp? }`: the server reads the player's ladder (the engine's `ArenaSave`,
   kept whole in `ladder.save`), picks the arena from it and a random seed, and answers
   `{ id, seed, arena, save, levels, roster, hp }`. The client builds the match with
   `arenaConfig(save, { seed, arena, levels, roster, hp })` (`ticketMatch()` in `engine/net/client.ts`). A player has
   one open match: asking again returns the same one until it is settled, or dropped unplayed after 24 hours.
2. The client plays it. `Match.log` keeps the pieces each round's battle was fought with, and
   `encodeRecord(match)` (`engine/core/ghost.ts`) packs them: about 12 KB for a 15-round match.
3. `POST /v1/arena/result { id, record }`: the server rebuilds the same `MatchConfig`, and `replayArena` re-fights
   every round with the engine. Only the replay's winner moves trophies (`finishArena`); the answer is
   `{ result, save }`. `{ id, forfeit: true }` gives the match up as a loss. The player's last board is kept in
   `ghosts` (the newest five per player) for when players meet each other's armies.

Errors from `/v1/arena/result`: `404 no_such_match`, `403 not_yours`, `409 already_settled`, `410 expired`,
`422 bad_record` (the message names the broken rule, e.g. `gold:3`; the match stays open), `429 slow_down`.

**What a cheat can not do.** Claim a win: the request has no field for it, and anything extra is ignored. Send a board
with a unit outside the player's roster, an illegal rank, more units than the round allows, a unit on a wall or in the
enemy's half, or an army worth more gold than the match can have paid out by that round (`goldBound`: every round's
income plus the most interest there is, as if nothing was ever wasted). Settle a match twice, settle someone else's,
pick the seed, the arena or the opponent, or drop a round.

**What a cheat still can.** Each of these is known and open:

- *Field a weak enemy.* The record carries both sides' boards, and the server checks the enemy's only for placement,
  not that the rival's AI would have built it. A modified client can send rounds where the enemy has nothing and win
  every match. Closing this means running the rival's planner on the server each round (it is deterministic from the
  state at the start of the round). That is far heavier than the replay: a match with both sides planned by the AI
  took 0.6 to 6 s here, most of it planning, against 0.15 s to replay. It is the first thing to add before the ladder
  carries anything of value.
- *Buy what the shop never offered.* The gold bound is a ceiling, not the player's real purse, and shop rolls and
  rerolls are not replayed: a board can be somewhat richer than honest play allows, with any units from the roster.
- *Lie about the army.* Troop levels, the roster and the keep's health are sent by the client and only held to what
  the engine allows (levels 1-12, real units, health up to a top commander's). Progression is not on the server, so a
  new account can claim a maxed army.
- *Try again.* A match that is never reported costs nothing and is issued again with the same seed, so it can be
  replayed until it is won. A quit is a loss only if the client sends the forfeit.
- *Use a bot.* The server sees boards, not hands.

**What a replay costs.** A full 15-round match with both boards full replays in about 150 ms of CPU (median, Node 26
on an Apple M4 with a core to itself; 280 to 550 ms while the machine was busy with other jobs). `infra/tests/arena.test.ts` measures it and prints the figure. Shorter
matches take 50 to 100 ms. Cloudflare's free plan allows 10 ms of CPU per request, so the ladder needs the **Workers
Paid plan**, whose default limit of 30 s of CPU per request is ample. Not measured on Cloudflare itself (no account
yet): allow 0.2 to 0.5 s per result there and check after the first deploy. Every other route stays within a few ms.

## Cloud saves in the game

`engine/net/sync.ts` pulls the cloud save at boot, merges it with the device's and pushes local writes a few seconds
after they stop (at most one push every 30 s, backing off from 5 s to 5 min while the backend is away). The merge
takes the save with the higher write count (`Save.rev`) whole, then the larger or the union of everything that only
grows (stars, levels, XP, units found, skins). Two devices played at the same time without syncing keep every star and
level from both, and the coins, gems and chests of whichever wrote more. `base/src/online.ts` starts the sync and
holds the rest of the base game's link to the backend.

## What is not here yet

- The Arena limits above: the rival's boards are not re-planned on the server, and progression is not server-held.

- App Store receipt checks on the server. Purchases are verified on the device by StoreKit 2; add a server check
  before selling anything that is delivered from the backend.
- Sign-in across devices (an account is per install; moving it is a token copy today).
- A review queue: a published game is live at once and can be reported and hidden; decide before launch whether
  new games should wait for approval.
