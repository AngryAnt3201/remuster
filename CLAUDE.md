# Remuster

One game, many games. The repo is an auto-battler in two halves:

| | | who changes it |
| --- | --- | --- |
| `engine/` | The game itself: battle sim, rules, AI, units, campaign, Arena, economy, progression, store, backend client. Pure TypeScript, deterministic, no DOM. | **Nobody in a game.** It is locked (`engine/ENGINE.lock.json`), and the backend re-runs it to check results. |
| `base/` | The base game, *Crownfall*: everything a player sees and hears. Canvas renderer (`base/src/render`), screens (`base/src/ui`), sound (`base/src/audio`), art (`base/public`). | Engine maintainers. |
| `games/<id>/` | A game: its own look, words, sound and screens, layered over the base game. | **You.** This is where a re-theme or redesign lives. |
| `artkit/` | Code-drawn art: build every unit, arena and building from primitives and bake them to the files the renderer loads. | Use it; extend it if a game needs a new primitive. |
| `infra/` | The backend every game shares (accounts, cloud saves, the gallery of published games, the Arena ladder). | Engine maintainers. |

## If you were asked to re-theme, redesign or "make it <something>"

That is the main thing people do here. Follow **REMIX.md** from top to bottom; it is the whole method, with the
checks that decide when you are done. The short version:

```
npm run new -- <id> "<Name>"       # games/<id>/, an overlay on the base game
GAME=<id> PORT=5310 npm run dev    # play it (http://localhost:5310); it is the base game until you change something
npm run text -- <id>               # every name the engine ships, to rename in games/<id>/src/game/lexicon.ts
npm run bake -- <id>               # draw the game's art from games/<id>/art/*.ts into games/<id>/public
npm run music -- <id>              # synthesise its soundtrack
npm run check -- <id>              # is it complete, is the engine untouched, does it build and play
```

Rules that keep a game valid:

1. **Never edit `engine/`.** Not to rename a unit, not to tweak a number, not to fix something you think is a bug
   (report it instead). `npm run engine:check` must pass. Names are changed in the game's lexicon; looks in its art
   and CSS.
2. **Don't edit `base/` for a game.** Shadow the file instead: `games/<id>/src/ui/home.ts` replaces
   `base/src/ui/home.ts` for that game only, and can import the original as `@base/ui/home` to wrap it.
3. **Every unit must still read at a glance.** The rules don't change, so a player must be able to tell the tank from
   the archer from the healer, and their side from the other side, on a phone at arm's length.
4. **Look at what you make.** Take screenshots (`node tools/shot.mjs`), open them, compare against the base game,
   and keep going until it would hold up in a store listing. A game that merely recolours the base game is not done.

## If you are working on the engine, the base game or the backend

- `npm test` (vitest: sim, match, AI, content, progression, store, art contracts, backend API), `npm run typecheck`,
  `npm run build`. All three green before every commit.
- The sim must stay deterministic and the same on client and server: no `Math.random`, no time, no DOM in `engine/`.
- After an intended engine change: `node tools/engine-lock.mjs --write` (bumps the engine release).
- Heavy jobs (balance sims, Blender, video renders) one at a time: `lockf -k ~/Desktop/game_development/.heavy.lock nice -n 10 <cmd>`.
- Docs: `README.md` (overview), `docs/ARENA.md` (Arena rules), `docs/EVENTS.md` (what the renderer reads from a
  battle), `artkit/README.md` (drawing art in code), `infra/README.md` (backend, local and deployed),
  `video/README.md` (the launch video and how to re-record it).
