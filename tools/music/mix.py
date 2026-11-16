#!/usr/bin/env python3
"""Cut between the video stems on bar lines and write the final soundtrack.

  python3 tools/music/mix.py                       default cut list -> video/audio/soundtrack.wav (+ .m4a)
  python3 tools/music/mix.py cuts.json out.wav     cuts.json is [[bar, "style"], ...] (bar 0 = the first bar)

Each cut is a 15 ms equal-power crossfade centred on the bar line, a reversed cymbal swelling into it and an impact
on the downbeat (both synthesised here; quick cuts get shorter, quieter ones). The result is re-mastered to the same
loudness as the stems.
"""
import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
import check  # noqa: E402
import synth as S  # noqa: E402

AUDIO = os.path.join(ROOT, "video", "audio")
XFADE = 0.015

# Visits all six worlds, trades two-bar phrases at the climax, strips to ink for the break, then one bar each through
# the last statement and home to the orchestra for the ending.
DEFAULT_CUTS = [
    [0, "fantasy"], [8, "steampunk"], [12, "western"], [16, "synthwave"], [20, "chiptune"], [24, "ink"],
    [28, "steampunk"], [30, "western"], [32, "synthwave"], [34, "chiptune"], [36, "ink"],
    [38, "fantasy"], [40, "steampunk"], [41, "western"], [42, "synthwave"], [43, "chiptune"], [44, "ink"], [45, "fantasy"],
]


def run(cuts, out_path, fx=True):
    grid_path = os.path.join(AUDIO, "grid.json")
    grid = json.load(open(grid_path))
    sr, bar, total = grid["sample_rate"], grid["bar_samples"], grid["total_samples"]
    S.set_sr(sr)
    cuts = sorted(cuts)
    if cuts[0][0] != 0:
        raise SystemExit("the cut list must start at bar 0")
    stems = {}
    for _, st in cuts:
        if st not in stems:
            stems[st], _sr = check.decode(os.path.join(AUDIO, grid["stems"][st]), sr)
            if len(stems[st]) != total:
                raise check.CheckError(f"stem {st} is {len(stems[st])} samples, grid says {total}")
    out = np.zeros((total, 2))
    xf = int(XFADE * sr)
    for i, (b, st) in enumerate(cuts):
        a = b * bar
        z = cuts[i + 1][0] * bar if i + 1 < len(cuts) else total
        g = np.zeros(total)
        g[a:z] = 1.0
        ramp = np.sin(np.linspace(0, np.pi / 2, xf))      # equal power: the two sides are different music
        if a > 0:
            g[a - xf // 2:a - xf // 2 + xf] = ramp
            g[a + xf - xf // 2:z] = 1.0
        if z < total:
            g[z - xf // 2:z - xf // 2 + xf] = ramp[::-1]
            g[z - xf // 2 + xf:] = 0.0
        out += stems[st] * g[:, None]
    if fx:
        for i, (b, st) in enumerate(cuts[1:], 1):
            seg = (b - cuts[i - 1][0]) * bar / sr                       # length of the segment being left
            nxt = ((cuts[i + 1][0] if i + 1 < len(cuts) else b + 4) - b) * bar / sr
            quick = min(seg, nxt) < 2.5 * bar / sr
            dur = min(seg * 0.9, 0.7 if quick else 1.5)
            sw = S.to_stereo(S.revcymbal(0.7, i, dur=dur)) * S.db(-25 if quick else -21)
            sw = S.width(np.stack([sw[:, 0], np.roll(sw[:, 1], 37)], 1), 1.3)
            s0 = b * bar - len(sw)
            out[s0:s0 + len(sw)] += sw
            hit = S.to_stereo(S.impact(0.8, i)) * S.db(-17 if quick else -12)
            m = min(len(hit), total - b * bar)
            out[b * bar:b * bar + m] += hit[:m]
    y = S.master(out, grid["loudness_lufs"], -1.7, glue=False, drive=0.0)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    from render import ffmpeg_write, WAV24
    ffmpeg_write(y, sr, out_path, WAV24)
    m4a = os.path.splitext(out_path)[0] + ".m4a"
    ffmpeg_write(y, sr, m4a, ["-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart"])
    res = check.check_file(out_path, grid["loudness_lufs"], 0.0, "default", -1.0)
    res_m = check.check_file(m4a, grid["loudness_lufs"], 0.0, "default", -1.0)
    if res["seconds"] != round(total / sr, 3):
        raise check.CheckError("soundtrack length differs from the stems")
    # no click at any cut: high-band energy in a short window on the bar line is not above its surroundings
    hf = check._hf(y, sr)
    worst = -99.0
    for b, _ in cuts[1:]:
        c = b * bar
        e = lambda k: float((hf[k - 256:k + 256] ** 2).mean()) + 1e-14
        around = np.array([e(c + o) for o in range(-8192, 8193, 512) if abs(o) > 2048])
        worst = max(worst, 10 * np.log10(e(c - 300) / np.percentile(around, 95)))   # just before the impact lands
    if worst > 6.0:
        raise check.CheckError(f"click at a cut: +{worst:.1f} dB")
    check.spectrogram(out_path, "soundtrack")
    json.dump(dict(cuts=cuts, wav=res, m4a=res_m, cut_click_db=round(worst, 1)), open(os.path.join(check.OUT, "report_soundtrack.json"), "w"), indent=1)
    print(f"  soundtrack: {res['seconds']}s  wav {res['bytes'] // 1024} KB {res['lufs']} LUFS {res['true_peak']} dBTP | "
          f"m4a {res_m['bytes'] // 1024} KB {res_m['lufs']} LUFS {res_m['true_peak']} dBTP | cuts {len(cuts) - 1}, worst cut click {worst:+.1f} dB")
    return res


if __name__ == "__main__":
    try:
        if len(sys.argv) >= 2:
            run(json.load(open(sys.argv[1])), sys.argv[2] if len(sys.argv) > 2 else os.path.join(AUDIO, "soundtrack.wav"))
        else:
            run(DEFAULT_CUTS, os.path.join(AUDIO, "soundtrack.wav"))
    except check.CheckError as e:
        sys.exit(f"CHECK FAILED: {e}")
