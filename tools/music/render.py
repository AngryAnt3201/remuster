#!/usr/bin/env python3
"""Render the Remuster soundtrack.

  python3 tools/music/render.py game <id> [--style <arranger>] [--only home,battle]
        in-game tracks (AAC .m4a) + the cue table for one game
  python3 tools/music/render.py video
        one mastered 48 kHz stem per style of the 48-bar video form, grid.json, and the default soundtrack mix
  python3 tools/music/render.py solo <style> <kind> <part>[,<part>]   -> tools/music/out/solo_*.wav (for inspection)

Every render is checked (check.py); a failed check exits non-zero.
"""
import importlib
import json
import os
import subprocess
import sys
import time

sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
import check  # noqa: E402
import song  # noqa: E402
import synth as S  # noqa: E402
from mixer import Session  # noqa: E402

# game id -> arranger module in tools/music/arrangers. A new game either gets a line here, or an arranger named
# after its id, or is rendered with --style.
GAMES = {"base": "fantasy", "brasswick": "steampunk", "dustline": "western", "neonhold": "synthwave",
         "pixelkeep": "chiptune", "inkfall": "ink"}
STYLES = ["fantasy", "blackridge", "chiptune", "cindermaw", "synthwave", "ink"]
KINDS = ["home", "battle", "boss", "win", "lose"]
GAME_SR, GAME_LUFS = 44100, -16.0
VIDEO_SR, VIDEO_LUFS = 48000, -14.0

HEADER = '''// This game's soundtrack. Each cue names a file under public/music and how it plays. The player
// (../audio/music.ts) crossfades between cues as the player moves through the game:
//   home     menus, the map, the Army, the Shop
//   battle   deploying and fighting
//   boss     boss levels and the last stand of a Gauntlet run (falls back to battle)
//   arena    Arena matches (falls back to battle)
//   win      a short sting when a match is won, then silence until the next screen
//   lose     the same for a loss
// `loop` is the length of the looping section in seconds (0 = play once). Looping files carry half a second of
// wrap-around on each end (the end of the loop before it, the start after it), so any window of exactly `loop`
// seconds repeats seamlessly whatever padding the encoder adds; `npm run music -- <game>` writes them that way.
// A game shadows this file (games/<id>/src/game/music.ts) and ships its own public/music.
export interface Track { file: string; loop: number; gain?: number; }
export type Cue = "home" | "battle" | "boss" | "arena" | "win" | "lose";
'''


def style_of(game, style=None):
    st = style or GAMES.get(game) or game
    if not os.path.exists(os.path.join(HERE, "arrangers", st + ".py")):
        sys.exit(f"no arranger for '{game}': add it to GAMES in render.py, write tools/music/arrangers/{game}.py, or pass --style")
    return st


def build(style, kind, sr, target, ceiling):
    F = song.FORMS[kind]()
    X = Session(F, sr=sr, seed=f"{style}/{kind}", target=target, ceiling=ceiling, label=f"{style}/{kind}")
    importlib.import_module(f"arrangers.{style}").arrange(X, F)
    return X


def ffmpeg_write(x, sr, path, codec_args):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cmd = [check.FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", "2", "-i", "-"] + codec_args + [path]
    subprocess.run(cmd, input=x.astype(np.float32).tobytes(), check=True)


AAC = ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"]
FLAC24 = ["-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24", "-compression_level", "8"]
WAV24 = ["-c:a", "pcm_s24le"]


def render_checked(style, kind, sr, target, path, codec, peak_limit=-1.0, ceiling=-2.5):
    """Render, master, encode, check; if the encoder pushed the true peak over the limit, re-master lower."""
    t0 = time.time()
    X = build(style, kind, sr, target, ceiling)
    X.render(master=False)
    res = None
    for attempt in range(4):
        y = X.finish(ceiling)
        if X.loop:  # exact periodicity before the lossy encode
            check.seam(y, sr, X.loop_seconds, lossy=False)
        ffmpeg_write(y, sr, path, codec)
        check.spectrogram(path, f"{style}_{kind}")
        try:
            res = check.check_file(path, target, X.loop_seconds, style, peak_limit)
            break
        except check.CheckError as e:
            if "true peak" in str(e) and attempt < 3:
                ceiling -= 0.6
                continue
            raise
    if X.pitch_report:
        res["pitch"] = check.pitch(X.pitch_report)
    res.update(loop=round(X.loop_seconds, 6), style=style, kind=kind, ceiling=ceiling, render_s=round(time.time() - t0, 1),
               parts=[p["name"] for p in X.parts])
    print(f"  {style}/{kind}: {res['seconds']}s {res['bytes'] // 1024} KB  {res['lufs']} LUFS  {res['true_peak']} dBTP"
          + (f"  seam {res['seam']}" if "seam" in res else "") + (f"  pitch {res['pitch']}" if "pitch" in res else "")
          + f"  [{res['render_s']}s]", flush=True)
    return res, y


def game(gid, style=None, only=None):
    style = style_of(gid, style)
    pub = os.path.join(ROOT, "base" if gid == "base" else os.path.join("games", gid), "public", "music")
    src = os.path.join(ROOT, "base" if gid == "base" else os.path.join("games", gid), "src", "game", "music.ts")
    print(f"{gid}: {style} -> {os.path.relpath(pub, ROOT)}", flush=True)
    print("  oscillators:", check.aliasing(), flush=True)
    results = {}
    for kind in only or KINDS:
        results[kind], _ = render_checked(style, kind, GAME_SR, GAME_LUFS, os.path.join(pub, kind + ".m4a"), AAC)
    if not only:
        rows = ",\n".join(f'  {k}: {{ file: "{k}.m4a", loop: {results[k]["loop"]:.6f} }}' for k in KINDS)
        os.makedirs(os.path.dirname(src), exist_ok=True)
        with open(src, "w") as f:
            f.write(HEADER + f"\n// {song.KEY}, {song.BPM} BPM. Written by `npm run music -- {gid}` ({style} arrangement); do not edit by hand.\n"
                    f"export const MUSIC: Partial<Record<Cue, Track>> = {{\n{rows},\n}};\n")
    os.makedirs(check.OUT, exist_ok=True)
    rep = os.path.join(check.OUT, f"report_{gid}.json")
    old = json.load(open(rep)) if os.path.exists(rep) and only else {}
    old.update(results)
    json.dump(old, open(rep, "w"), indent=1)
    print(f"{gid}: all checks passed", flush=True)
    return results


def video():
    out = os.path.join(ROOT, "video", "audio")
    os.makedirs(out, exist_ok=True)
    print("video stems ->", os.path.relpath(out, ROOT), flush=True)
    print("  oscillators:", check.aliasing(), flush=True)
    F = song.video()
    results, lengths, sect = {}, {}, {}
    bar = int(round(VIDEO_SR * 60.0 / song.BPM * song.BEATS))
    for style in STYLES:
        path = os.path.join(out, f"stem_{style}.flac")
        results[style], y = render_checked(style, "video", VIDEO_SR, VIDEO_LUFS, path, FLAC24, ceiling=-1.3)
        lengths[style] = len(check.decode(path)[0])
        S.set_sr(VIDEO_SR)
        sect[style] = [round(S.lufs(y[s * bar:(s + k) * bar]), 1) for _, s, k in song.VIDEO_SECTIONS]
        del y
    if len(set(lengths.values())) != 1:
        raise check.CheckError(f"stems differ in length: {lengths}")
    n = next(iter(lengths.values()))
    names = [s[0] for s in song.VIDEO_SECTIONS]
    print("  section loudness (LUFS) " + " ".join(f"{x:>7s}" for x in names))
    for style in STYLES:
        print(f"  {style:>22s}  " + " ".join(f"{v:7.1f}" for v in sect[style]))
    import mix
    grid = dict(
        key=song.KEY, bpm=song.BPM, beats_per_bar=song.BEATS, sample_rate=VIDEO_SR, bars=F.bars,
        bar_seconds=60.0 / song.BPM * song.BEATS, bar_samples=bar, beat_seconds=60.0 / song.BPM,
        total_samples=n, total_seconds=n / VIDEO_SR, music_end_seconds=F.bars * bar / VIDEO_SR, loudness_lufs=VIDEO_LUFS,
        stems={s: f"stem_{s}.flac" for s in STYLES},
        sections=[dict(name=nm, bar=s, bars=k, start_seconds=round(s * bar / VIDEO_SR, 6), start_sample=s * bar,
                       energy=F.energy[s], theme_bars=[None if v is None else v + 1 for v in F.src[s:s + k]])
                  for nm, s, k in song.VIDEO_SECTIONS],
        section_lufs={st: dict(zip(names, sect[st])) for st in STYLES},
        cut_points=dict(
            note="Any bar line is a valid cut (stems are sample-aligned and share harmony). Strongest cuts are section "
                 "starts, then every 4 bars, then every 2. The final held chord lands on bar 47; do not cut after it.",
            section_starts=[s for _, s, _ in song.VIDEO_SECTIONS],
            every_4_bars=list(range(0, 48, 4)), every_2_bars=list(range(0, 47, 2)),
            seconds={str(b): round(b * bar / VIDEO_SR, 6) for b in range(48)}),
        default_cuts=mix.DEFAULT_CUTS,
        theme=dict(bars=[dict(bar=i + 1, chord=song.CHORDS[i], notes=[[b, d, song.name(m)] for b, d, m in song.MELODY[i]])
                         for i in range(16)]),
    )
    json.dump(grid, open(os.path.join(out, "grid.json"), "w"), indent=1)
    json.dump(results, open(os.path.join(check.OUT, "report_video.json"), "w"), indent=1)
    mix.run(mix.DEFAULT_CUTS, os.path.join(out, "soundtrack.wav"))
    print("video: all checks passed", flush=True)


def solo(style, kind, parts):
    X = build(style, kind, GAME_SR, GAME_LUFS, -2.0)
    y = X.render(solo=parts.split(","), master=False)
    y = y / (np.abs(y).max() + 1e-9) * 0.7
    path = os.path.join(check.OUT, f"solo_{style}_{kind}_{parts.replace(',', '+')}.wav")
    ffmpeg_write(y, GAME_SR, path, ["-c:a", "pcm_s16le"])
    print(check.spectrogram(path, f"solo_{style}_{kind}_{parts.replace(',', '+')}"))


def main(argv):
    if len(argv) >= 2 and argv[0] == "game":
        opt = dict(zip(argv[2::2], argv[3::2]))
        game(argv[1], opt.get("--style"), opt["--only"].split(",") if "--only" in opt else None)
    elif argv[:1] == ["video"]:
        video()
    elif len(argv) == 4 and argv[0] == "solo":
        solo(*argv[1:])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except check.CheckError as e:
        sys.exit(f"CHECK FAILED: {e}")
