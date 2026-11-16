---
description: Turn the base game into a new game with its own look, words and sound (e.g. /remix dustline a spaghetti western)
argument-hint: <id> <what the game should be>
---

Make a new Remuster game: `$ARGUMENTS`

The first word is the game's id (lower-case, dashes); the rest describes the world it should be set in. If only a
description was given, pick a short, original id and name yourself.

Read `REMIX.md` now and follow it step by step, in order, without skipping the checks. In brief:

1. `npm run new -- <id> "<Name>"`, then start it: `GAME=<id> PORT=5310 npm run dev` (in the background).
2. Write a one-page direction for the game in `games/<id>/DIRECTION.md` before drawing anything: the world, the two
   sides and their colours, the palette, the type, the materials, what each of the 31 units becomes and why its role
   still reads, what the UI is made of. Everything after this follows it.
3. Words: `npm run text -- <id>`, then rename everything in `games/<id>/src/game/lexicon.ts`.
4. Art: write the builders in `games/<id>/art/` with the art kit (`artkit/README.md`) and `npm run bake -- <id>`.
   Units first (look at the contact sheets), then arenas, buildings, effects, portraits, maps, key art.
5. Interface: `games/<id>/src/game/theme.css` for the skin; shadow screens under `games/<id>/src/ui/` where the
   layout itself should change. It should feel like a different game's UI, not a recolour.
6. Sound: `games/<id>/src/game/sounds.ts`, and the soundtrack with `npm run music -- <id>`.
7. `npm run check -- <id>` until it passes, and look at every screen in `games/<id>/art/preview/` and your own
   screenshots next to the base game.

Do not edit `engine/` or `base/`. Do not stop at a recolour. When you finish, show the before/after screenshots and
say what is weakest.
