# Remuster music

Every note in the game is synthesised here, in Python (numpy + scipy, ffmpeg for encoding). No samples, no audio
model. One theme tune, re-orchestrated per game, all on one tempo grid, key and form, so the launch video can cut
between games on any bar line and the tune carries on.

```
npm run music -- <game id>          # in-game tracks + cue table for one game (base, brasswick, dustline, ...)
npm run music:video                 # the six video stems, grid.json and the default soundtrack mix
python3 tools/music/mix.py cuts.json out.wav     # re-cut the video soundtrack from a cut list [[bar, "style"], ...]
python3 tools/music/inspect_instruments.py       # solo every instrument: envelope + spectrum sheets in out/
python3 tools/music/render.py solo <style> <kind> <part>[,<part>]   # one part of one track, with a spectrogram
python3 tools/music/song.py         # print the theme
```

Renders are deterministic (fixed seeds). A game render takes about a minute; the video about three. Run one at a
time: `lockf -k ~/Desktop/game_development/.heavy.lock nice -n 10 npm run music -- <id>`.

## The theme (`song.py`)

D minor, 144 BPM, 4/4 (one bar = 1.6667 s = 73 500 samples at 44.1 kHz, 80 000 at 48 kHz). 16 bars: A (8) + B (8).

| bar | chord | melody (length in beats) |
| --- | --- | --- |
| 1 | Dm | A4(½) D5(½) F5(1½) E5(½) D5(1) |
| 2 | Bb | Bb4(½) D5(½) G5(1½) F5(½) D5(1) |
| 3 | C | G5(½) G5(½) A5(1½) G5(½) E5(1) |
| 4 | A | E5(½) F5(½) E5(1) C#5(2) |
| 5 | Dm | as bar 1 |
| 6 | Bb | as bar 2 |
| 7 | C | E5(½) G5(½) C6(1½) A5(½) G5(1) |
| 8 | Dm | F5(½) E5(½) D5(3) |
| 9 | F | A5(1½) C6(1½) A5(1) |
| 10 | C | G5(1½) E5(1½) G5(1) |
| 11 | Gm | Bb5(1½) G5(1½) Bb5(1) |
| 12 | Dm | A5(2) F5(½) G5(½) A5(1) |
| 13 | Bb | Bb5(1½) D6(1½) Bb5(1) |
| 14 | F | A5(1½) C6(1½) A5(1) |
| 15 | Gm | G5(½) A5(½) Bb5(1) A5(1) G5(1) |
| 16 | A7 | A5(1½) G5(½) F5(1) E5(1) |

The A hook is "two eighths up into a dotted quarter" sequenced upward; the B hook is a 3+3+2 tresillo. `song.py` also
holds the countermelody, the gallop rhythm motif (eighth + two sixteenths per beat) every style builds its groove on,
and the forms:

| form | bars | what |
| --- | --- | --- |
| `home` | 32 | the tune at half speed (each theme bar lasts two), calm, loops |
| `battle` | 32 | A A B A, energy 3 4 4 5, loops |
| `boss` | 32 | A B A B, `dark` flag: lower voicings, more percussion, loops |
| `win` / `lose` | 2 + tail | stingers on the opening motif (rising to D major / falling to a low D minor) |
| `video` | 48 + 3.2 s | intro 4, A 8, B 8, A 8, B 8 (climax), break 2, A 8 (everything), tag + final chord 2, ring-out |

A form gives every bar a chord, an energy (0 break, 1 intro, 2 tune + light backing, 3 groove in, 4 full, 5 everything)
and a section; arrangers decide what plays from those, so all styles build and drop together.

## How a game gets its own score

You are re-theming the game; its music should be recognisably *that world* inside one bar, and still be this tune.

1. **Pick the closest existing arranger** in `arrangers/` (fantasy, steampunk, western, synthwave, chiptune, ink) and
   copy it to `arrangers/<your game id>.py`. `render.py` uses the arranger named after the game id (or add the id to
   `GAMES` in `render.py`, or pass `--style <arranger>` to reuse one unchanged).
2. **Re-orchestrate.** An arranger is one function, `arrange(X, F)`: `F` is the form (bars, chords, energies, the
   tune as notes), `X` is the session. It calls `X.add(name, instrument, notes, ...)` once per part:
   - `instrument` is any function in `synth.py` (strings, brass, flute/whistle/shakuhachi, plucked strings, reeds,
     organ, choir, bells, supersaw, FM, chip channels, all the percussion). `kw=` passes its options
     (`kw=dict(kind="trumpet")`); a fifth element on a note passes per-note options.
   - `notes` are `(beat, beats, midi, velocity)`; drums are `(beat, velocity)` with `pitched=False`.
   - `level=` is the part's RMS in dBFS while it plays (leads about -17, bass -16, pads -23, arpeggios -22);
     `peak=` instead for drums (kick -6, snare -10, hats -18). Mixing is done by these numbers, not by ear.
   - `pan`, `rev` / `rev2` / `dly` sends, `eq`, `fx`, `duck` (side-chain to `X.pump_beats`), `human=(seconds, velocity)`.
   - `check=True` on lead parts adds them to the pitch check.
   - `X.reverb = (kind, options)` picks the room (hall, room, plate, spring, gated); `X.master_eq` shapes the bus.
   Keep the tune (`F.mel`), the chords on the bar lines and the tempo. Everything else is yours: who plays the tune
   in which section, the groove (build it on `GALLOP` so it locks with the other games), fills at `F.last(bar)`,
   what drops out at low energy. Don't play everything all the time. If the world needs another scale, re-map the
   tune with `song.to_scale(F.mel, scale)` and keep chord roots that stay consonant with D minor (see `ink.py`).
3. **Need a new instrument?** Add it to `synth.py` from the building blocks there: `tab_for`/`morph` (band-limited
   wavetables; a filter sweep is a morph between tables), `ks` (plucked/struck string), `resonators` and `eq` (bodies
   and formants), filtered noise for breath and percussion. Add it to `inspect_instruments.py` and look at the sheet.
4. **Render:** `npm run music -- <id>`. It writes `games/<id>/public/music/{home,battle,boss,win,lose}.m4a` and
   `games/<id>/src/game/music.ts`, runs every check, and writes a spectrogram per track to `tools/music/out/`.
   **Open the spectrograms** (Read tool): you can see whether the lead stands clear of the backing, whether sections
   differ in density, mud below 300 Hz, a missing register, clicks (vertical lines that are not drum hits).
5. To put the game in the launch video, add the style to `STYLES` in `render.py` and re-run `npm run music:video`.

Rules that keep loops seamless: anything applied to a whole part (`fx=`) must be periodic over the loop. A tremolo at
6 Hz is (10 cycles per bar); a chorus with a free-running LFO is not. Put modulation inside the instrument instead.

## How looping files are built

`base/src/audio/music.ts` loops a window of exactly `loop` seconds starting 0.25 s into the file. So each looping
file is `[last 0.5 s of the loop][the loop][first 0.5 s of the loop]`. `mixer.py` renders the loop as a circular
buffer (notes ringing past the end fold onto the start), tiles it, runs reverb, delay, compression and limiting over
the tiled signal, and cuts the second pass, so tails from the end are under the start and the dynamics processors are
in steady state. `loop` in the cue table is the exact loop length.

## Checks (`check.py`), run after every render; any failure exits non-zero

| check | how | limit |
| --- | --- | --- |
| loudness | ffmpeg `ebur128` on the shipped file | within 1 LU of -16 LUFS (game) / -14 LUFS (video) |
| true peak | ffmpeg `ebur128=peak=true` on the shipped file (after AAC) | under -1 dBTP; re-mastered lower if the encoder overshoots |
| loop seam, exact | before encoding: `x[t]` vs `x[t + loop]` over the wrap-around | residual under -60 dB (in practice -200) |
| loop seam, shipped | decoded AAC: same residual below 3 kHz; step and slope across the player's jump vs local steps; a 256-sample high-band window on the jump vs the un-jumped signal and its neighbours | residual under -12 dB (the codec's own error is about -20), ratios under 1.5, no +3 dB burst |
| spectral balance | Welch spectrum in 7 bands relative to total, per style | low end present, 3-5 kHz and 5-10 kHz not built up, no DC |
| aliasing | every band-limited oscillator at four high pitches, both sample rates | inharmonic energy under -70 dB (measured -87) |
| pitch | every `check=True` lead note as placed in the mix: power-weighted spectral centroid of its first harmonics vs the score, plus an octave test by autocorrelation | 12 cents for notes over 0.3 s (vibrato and section detune included), wider for shorter notes |
| stems | all video stems decode to the same sample count; no click at any cut of the mix | exact; under +6 dB |

Reports land in `tools/music/out/report_*.json`.

## What cannot be verified without ears

The checks prove the files are technically sound: level, peaks, seams, tuning, band balance, no aliasing. They do
not prove the music is *good*. Nobody has heard any of this. A human should listen for, in this order:

1. **Is the tune a tune?** It was composed on paper (contour, cadences, sequence), never auditioned.
2. **Do the instruments read as what they claim?** The plucked strings, bells, chip channels and drums are
   well-understood models. The bowed strings, brass, choir, harmonica and shakuhachi are the riskiest: sustained
   acoustic tones are where synthesis sounds cheap, and "is this a french horn or a soft synth" is not measurable here.
3. **Mix balance.** Parts are levelled by RMS targets. Perceived loudness is not RMS: a whistle at 2 kHz or an anvil
   can be far more present than its number, and a bass can vanish on a phone speaker.
4. **Harshness and fatigue** over a few minutes of looping (the battle loop repeats every 53 s), especially
   Brasswick's clock and anvils, Inkfall's plucks, Pixelkeep's pulse lead.
5. **The cuts in the video:** whether six timbres trading a bar each feels like one song or a channel-hop, and
   whether the Inkfall re-mapping onto hirajoshi still sounds like the same melody.
6. **Loop points in the app** on a real phone (Web Audio, AAC decode in WKWebView), and music against the sound
   effects at the player's default volume.

If something is wrong, it is cheap to fix: change a level, an instrument parameter or a pattern and re-render.
