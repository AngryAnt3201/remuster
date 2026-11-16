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
npx vitest run infra                                    # API and client tests on real SQL
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

## What is not here yet

- App Store receipt checks on the server. Purchases are verified on the device by StoreKit 2; add a server check
  before selling anything that is delivered from the backend.
- Sign-in across devices (an account is per install; moving it is a token copy today).
- A review queue: a published game is live at once and can be reported and hidden; decide before launch whether
  new games should wait for approval.
