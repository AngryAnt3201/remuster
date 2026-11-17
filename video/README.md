# The launch video

A 9:16, 60 fps, 83-second film that cuts between six games mid-battle. It is built from three things that can each
be redone on their own: **captures** of the games, the **soundtrack**, and the **edit**.

```
./video/capture.sh <game>          record one game's clips (about ten minutes)
./video/render.sh                  render out/Launch.mp4 (with voice-over)
./video/render.sh LaunchNoVO       the same without the voice
./video/render.sh LaunchSilent     picture only
cd video && npx remotion studio src/index.ts     scrub the edit in a browser
```

## Why the cuts work

Every game runs the same engine, and a film scene (`base/src/film.ts`) is a fixed seed and two fixed armies. So
`?film=clash` is the same battle, blow for blow, in every game. The recorder (`tools/film.mjs`) drives the page on a
virtual clock, one frame at a time, so frame 600 of the war-game capture is the same instant as frame 600 of the
8-bit one. The edit just switches which game's file it is reading. The camera move (`filmCamera` in `base/src/film.ts`: open on
the whole globe, come in, keep turning) is a function of scene time too, so it carries across every cut.

Scenes: `clash` (two full armies, the player wins at about 26 s), `arena` (a fight through a village's street and
alleys), `crossing` (a river with two bridges), `market` (a square with a fountain and stalls), `siege` (artillery and walls of shields), plus `home` and `army` (the game's front door and
card collection, with the `?demo` mid-game save). `npx vite-node tools/film-tune.ts <scene> [seedFrom] [count]`
shows how a scene plays out per seed (who wins, when, how busy it stays) when you want to change one.

## Captures

`./video/capture.sh <game>` writes `video/public/clips/<game>/<clip>.mp4` (1080 wide), `.wav` (the game's own sound
effects for those frames, rendered offline by its synth) and `.json` (length, named moments). A clip that doesn't
exist yet shows as a labelled slate in the edit, so the video always renders.

Record a single clip: `node tools/film.mjs --game dustline --scene arena --seconds 20 --port 5312 --out video/public/clips`
(the game's dev server must be running on that port), or any screen with `--url "/?demo&tab=shop" --name shop`.

Clips are large and reproducible, so they are not in git.

## Soundtrack

One tune, arranged six ways (`tools/music/`): fantasy, blackridge (modern war), chiptune, cindermaw (90s metal), synthwave, ink. All six video
stems (`video/audio/stem_*.flac`) are the same length on the same grid: D minor, 144 BPM, one bar = 100 frames. The
mix (`tools/music/mix.py`) switches stems on bar lines following the picture, with a short riser and hit on each cut.
`render.sh` regenerates `audio/soundtrack.wav` whenever the edit's cut list changes.

The tune's form, which the edit follows: intro (bars 1-4), A (5-12), B (13-20), A (21-28), B, the climax (29-36),
break (37-38), last A (39-46), tag (47), held chord (48).

Nobody has listened to this music: it was composed and balanced by measurement. Listen to `audio/soundtrack.m4a`
first. To replace it with a produced track, keep 144 BPM and the bar count and drop the file in as
`audio/soundtrack.wav` (then `touch` it so `render.sh` keeps it).

## The edit

`src/timeline.ts` is the whole edit as data: sections, shots (`bar`, `beats`, `game`, `clip`, optional scene time
`t`), the typed prompts, captions. Change a number, re-render. `src/Launch.tsx` draws it.

| bars | what happens |
| --- | --- |
| 1-4 | Crownfall's home screen. "One game." |
| 5-10 | The clash, in fantasy. A prompt is typed: *make it a gritty modern war game* |
| 11-17 | The same battle carries on in Blackridge, then Pixelkeep, Cindermaw, Neonhold, Inkfall, each on a typed prompt |
| 18-20 | A cut every two beats through all six as the battle is won |
| 21-24 | All six at once. "We run the game. You own the look." |
| 25 | Two games' home screens |
| 26-28 | Seeing the rival's game: Crownfall's results sheet, a tap on "See it in Captain Varro's game", Cindermaw replaying the round from the rival's side (`peek` and `peekview` clips; `PEEK` in `src/timeline.ts`) |
| 29-36 | Real places: a village, a river crossing and a market square, each opening on the whole globe and turning |
| 37-38 | Break. "One game. Make it yours." |
| 39-46 | A cut every two beats: the best moments of everything |
| 47-48 | End card |

## Voice-over

`vo/script.json` has the ten lines and the bar each starts on. The files in `vo/` are placeholders spoken by the
Mac's built-in voice (`vo/make.sh`). Record each line as `vo/<id>.wav` (any sample rate, mono or stereo), delete
its `.placeholder` marker, and render again. Lines are placed by their start; if a recording runs long, move the
next line's `bar` in `script.json`. The music ducks under each line automatically.

## Checking a render

`npx remotion still src/index.ts Launch out/f.png --frame=1234` renders one frame. Look at one frame per section
and at a few cut points (bar N starts at frame `(N-1)*100`) before spending ten minutes on a full render.
