"""Objective checks that stand in for ears. render.py runs these after every render and fails loudly.

  loudness / true peak   ffmpeg ebur128 on the file that ships (after AAC), plus our own BS.1770 meter
  loop seam              the file is periodic over the loop: the wrap-around must match, and jumping from the end
                         of the loop window to its start must add no click
  spectral balance       band energies inside sane limits per style, no DC
  aliasing               oscillators produce nothing between their harmonics
  pitch                  every lead note measured by autocorrelation against the score
  stems                  identical length

Run standalone:  python3 tools/music/check.py file.m4a [loop_seconds]
"""
import json
import os
import re
import subprocess
import sys
import numpy as np
from scipy import signal

FFMPEG = "/opt/homebrew/bin/ffmpeg" if os.path.exists("/opt/homebrew/bin/ffmpeg") else "ffmpeg"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
LEAD = 0.25   # must match base/src/audio/music.ts
PAD = 0.5


class CheckError(Exception):
    pass


# ----------------------------------------------------------------------------- io
def decode(path, sr=None):
    """Decode any audio file to float (n, 2) with ffmpeg. Returns (array, sample rate)."""
    if sr is None:
        info = subprocess.run([FFMPEG, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
        sr = int(re.search(r"(\d+) Hz", info).group(1))
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(sr), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64), sr


def ebur128(path):
    """(integrated LUFS, true peak dBTP) as measured by ffmpeg."""
    err = subprocess.run([FFMPEG, "-nostats", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summ = err[err.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summ).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summ).group(1))
    return i, tp


def spectrogram(path, name):
    os.makedirs(OUT, exist_ok=True)
    png = os.path.join(OUT, name + ".png")
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", path, "-lavfi",
                    "showspectrumpic=s=1500x520:legend=1:fscale=log:scale=log:drange=90", png], check=True)
    return png


# ----------------------------------------------------------------------------- pitch
def note_cents(y, f, dur, sr):
    """Cents error of a rendered note against f, by autocorrelation over the sustained middle of the note.
    Returns +-1200 if the note speaks an octave out."""
    if y.ndim == 2:
        y = y.mean(1)
    a, b = int(0.35 * dur * sr), int(0.9 * dur * sr)
    if b - a < 2048:
        a = min(int(0.15 * dur * sr), max(0, len(y) - 2048))
        b = min(len(y), a + 2048)
    seg = y[a:b] - y[a:b].mean()
    n = len(seg)
    if n < 256 or np.abs(seg).max() < 1e-6:
        return 0.0
    def acf(v):
        spec = np.fft.rfft(v * np.hanning(n), 2 * n)
        r = np.fft.irfft(np.abs(spec) ** 2)[:n]
        r = r / np.maximum(np.correlate(np.hanning(n), np.hanning(n), "full")[n - 1:], 1e-9)
        return r / (r[0] + 1e-20)

    T = sr / f
    # Frequency of each of the first few harmonics from the centroid of its spectral peak, weighted by power.
    # (One harmonic alone is unreliable for a section: detuned players interfere and the fundamental's
    # instantaneous frequency wanders; the interference differs per harmonic, so averaging steadies it.)
    nfft = 1 << 19
    sp = np.abs(np.fft.rfft(seg * np.hanning(n), nfft)) ** 2
    num = wsum = 0.0
    for h in range(1, 7):
        if h * f > min(6000.0, sr * 0.4):
            break
        lo = int(h * f / 1.04 * nfft / sr)
        hi = int(h * f * 1.04 * nfft / sr) + 1
        band = sp[lo:hi]
        pk = lo + int(np.argmax(band))
        half_w = max(2, int(0.6 * sr / n * nfft / sr))   # the main lobe around the peak
        a_, b_ = max(lo, pk - half_w), min(hi, pk + half_w + 1)
        w_ = sp[a_:b_]
        fc = (np.arange(a_, b_) * w_).sum() / (w_.sum() + 1e-30) * sr / nfft
        num += w_.sum() * 1200 * np.log2(fc / (h * f))
        wsum += w_.sum()
    cents = num / (wsum + 1e-30)
    ac = acf(seg)
    half = int(round(T / 2))
    if half >= 4 and ac[half] > ac[int(round(T))] + 0.05:
        return 1200.0
    if ac[int(round(T))] < 0.2 and ac[min(n - 1, int(round(2 * T)))] > 0.6:
        return -1200.0
    return float(cents)


def pitch(report, tol=12.0):
    """report: [(part, midi, cents, seconds)]. Every lead note must sit within tol cents of the score. Notes under
    0.3 s get a proportionally wider window (to 25 cents): a section of detuned players beats slower than the note
    lasts, so its short-window frequency wanders even though every player is in tune."""
    lim = lambda d: float(np.clip(tol * 0.3 / max(d, 1e-3), tol, 25.0))
    bad = [(p, m, round(c, 1), round(d, 2)) for p, m, c, d in report if abs(c) > lim(d)]
    long = [abs(c) for _, _, c, d in report if d >= 0.3]
    if bad:
        raise CheckError(f"pitch: {len(bad)} of {len(report)} lead notes out of tune: {bad[:8]}")
    return dict(notes=len(report), worst_cents=round(max((abs(c) for _, _, c, _ in report), default=0.0), 1),
                worst_sustained_cents=round(max(long, default=0.0), 1),
                mean_abs_cents=round(float(np.mean([abs(c) for _, _, c, _ in report])) if report else 0.0, 1))


# ----------------------------------------------------------------------------- aliasing
def aliasing(limit_db=-70.0):
    """Render each band-limited oscillator high up and measure energy that is not on a harmonic."""
    import synth as S
    worst = -200.0
    for sr in (44100, 48000):
        S.set_sr(sr)
        for shape in ("saw", "pulse", "tri", "steptri", "morph"):
            for f0 in (987.77, 1318.51, 2793.83, 4186.01):
                n = sr
                if shape == "morph":
                    tabs = [S.tab_for("saw", f0, f0, S.saw_coef, fc=fc, order=2.0, res=0.6) for fc in (800, 3000, 9000)]
                    y = S.morph(S.phase_of(np.full(n, f0)), tabs, np.full(n, 1.37))  # a fixed blend: a moving one adds real sidebands
                else:
                    y = S.osc(shape, np.full(n, f0), duty=0.25)
                sp = np.abs(np.fft.rfft(y * signal.windows.blackmanharris(n))) ** 2
                fr = np.fft.rfftfreq(n, 1 / sr)
                k = np.round(fr / f0)
                on = (np.abs(fr - k * f0) <= 6 * sr / n + 1e-9) & (k >= 1)
                on |= fr < 20  # table DC residue is filtered by the mix high-pass; not aliasing
                rel = 10 * np.log10(sp[~on].sum() / sp.sum() + 1e-30)
                worst = max(worst, rel)
                if rel > limit_db:
                    raise CheckError(f"aliasing: {shape} at {f0:.0f} Hz / {sr} has {rel:.1f} dB of inharmonic energy")
    return dict(worst_db=round(worst, 1))


# ----------------------------------------------------------------------------- spectrum
BANDS = [("sub", 20, 60), ("bass", 60, 250), ("lowmid", 250, 1000), ("mid", 1000, 3000), ("presence", 3000, 5000),
         ("high", 5000, 10000), ("air", 10000, 20000)]

# dB relative to total energy: (min, max) per band. Chiptune and ink are thinner in the bass by nature.
LIMITS = {
    "default": dict(low=(-14.0, -1.0), lowmid=(-12.0, -1.0), mid=(-22.0, -3.0), presence=(-40.0, -9.0), high=(-45.0, -9.0),
                    air=(-70.0, -14.0)),
    "chiptune": dict(low=(-16.0, -1.0), lowmid=(-12.0, -1.0), mid=(-22.0, -2.5), presence=(-40.0, -7.0), high=(-45.0, -8.0),
                     air=(-70.0, -12.0)),
    "ink": dict(low=(-16.0, -1.0), lowmid=(-12.0, -1.0), mid=(-22.0, -3.0), presence=(-40.0, -9.0), high=(-45.0, -9.0),
                air=(-70.0, -14.0)),
}


def balance(x, sr, style="default", strict=True):
    mono = x.mean(1)
    dc = abs(float(mono.mean()))
    f, p = signal.welch(mono, sr, nperseg=8192)
    tot = p[(f >= 20)].sum()
    out = {name: round(10 * np.log10(p[(f >= lo) & (f < hi)].sum() / tot + 1e-30), 1) for name, lo, hi in BANDS}
    out["low"] = round(10 * np.log10(p[(f >= 20) & (f < 250)].sum() / tot + 1e-30), 1)
    out["dc"] = round(dc, 5)
    lim = LIMITS.get(style, LIMITS["default"])
    errs = [f"{k} {out[k]} dB outside {lo}..{hi}" for k, (lo, hi) in lim.items() if not lo <= out[k] <= hi]
    if dc > 2e-3:
        errs.append(f"DC offset {dc:.4f}")
    if errs and strict:
        raise CheckError(f"spectral balance ({style}): " + "; ".join(errs) + f"  [{out}]")
    return out


# ----------------------------------------------------------------------------- loop seam
def _hf(x, sr):
    return signal.sosfilt(signal.butter(4, 5000, "high", fs=sr, output="sos"), x, axis=0)


def seam(x, sr, loop_s, lossy=True):
    """x is the looping file: [PAD of wrap][loop][PAD of wrap]. Checks:
    1. periodicity: x[t] == x[t + loop] over the wrap-around (residual in dB relative to the signal);
    2. waveform and slope across the jump the player makes (end of loop window -> start), against the sample-to-sample
       steps of the music around it;
    3. no click: a short FFT window centred on the jump has no more high-band energy than the same window on the
       un-jumped signal, or than its neighbours."""
    L = int(round(loop_s * sr))
    if abs(L - loop_s * sr) > 1e-6:
        raise CheckError("loop length is not a whole number of samples")
    k = min(len(x) - L, int(2 * PAD * sr))
    if k < int(1.5 * PAD * sr):
        raise CheckError(f"file too short for its loop: {len(x) / sr:.3f}s for loop {loop_s}s")
    a, b = x[:k], x[L:L + k]
    if lossy:  # AAC only tracks the waveform below a few kHz (above that it codes noise): compare there
        lpf = signal.butter(4, 3000, "low", fs=sr, output="sos")
        a, b = signal.sosfilt(lpf, a, axis=0)[sr // 20:], signal.sosfilt(lpf, b, axis=0)[sr // 20:]
    resid = 10 * np.log10(((a - b) ** 2).mean() / ((a ** 2).mean() + 1e-20) + 1e-20)
    s = int(LEAD * sr)
    w = int(0.1 * sr)
    joined = np.concatenate([x[s + L - w:s + L], x[s:s + w]])
    ref = x[s + L - w:s + L + w]
    d1 = np.abs(np.diff(ref, axis=0)).max(1)
    step = float(np.abs(joined[w] - joined[w - 1]).max())
    typical = float(np.percentile(d1, 99.5)) + 1e-9
    slope_j = np.abs((joined[w + 1] - joined[w]) - (joined[w - 1] - joined[w - 2])).max()
    slope_typ = float(np.percentile(np.abs(np.diff(ref, 2, axis=0)).max(1), 99.5)) + 1e-9
    nw = 256
    hj, hr = _hf(joined, sr), _hf(ref, sr)

    def e(sig, c):
        return float((sig[c - nw // 2:c + nw // 2] ** 2).mean()) + 1e-14

    at = 10 * np.log10(e(hj, w) / e(hr, w))
    neigh = np.array([e(hr, c) for c in range(nw, 2 * w - nw, nw // 2)])
    over = 10 * np.log10(e(hj, w) / np.percentile(neigh, 90))
    out = dict(periodic_db=round(float(resid), 1), step_ratio=round(step / typical, 2), slope_ratio=round(float(slope_j / slope_typ), 2),
               click_db=round(at, 1), click_vs_neighbours_db=round(over, 1))
    tol = -14.0 if lossy else -60.0  # the codec's own error is about -20 dB; the exact test runs before encoding
    errs = []
    if resid > tol:
        errs.append(f"wrap-around differs from the loop by {resid:.1f} dB (limit {tol})")
    if step / typical > 1.5:
        errs.append(f"waveform jumps at the seam ({step / typical:.2f}x the local step)")
    if slope_j / slope_typ > 1.5:
        errs.append(f"slope breaks at the seam ({slope_j / slope_typ:.2f}x)")
    if at > 3.0 and over > 3.0:
        errs.append(f"click at the seam: +{at:.1f} dB high-band energy vs the un-jumped signal")
    if errs:
        raise CheckError("loop seam: " + "; ".join(errs))
    return out


# ----------------------------------------------------------------------------- one file
def check_file(path, target, loop_s=0.0, style="default", peak_limit=-1.0, tol=1.0):
    i, tp = ebur128(path)
    x, sr = decode(path)
    res = dict(file=os.path.basename(path), seconds=round(len(x) / sr, 3), lufs=i, true_peak=tp,
               bytes=os.path.getsize(path))
    errs = []
    if tp > peak_limit:
        errs.append(f"true peak {tp} dBTP is over {peak_limit}")
    if abs(i - target) > tol:
        errs.append(f"loudness {i} LUFS is not within {tol} LU of {target}")
    if errs:
        raise CheckError(f"{path}: " + "; ".join(errs))
    res["balance"] = balance(x, sr, style, strict=loop_s > 0 or len(x) / sr > 20)
    if loop_s:
        res["seam"] = seam(x, sr, loop_s, lossy=not path.endswith((".wav", ".flac")))
    return res


if __name__ == "__main__":
    p = sys.argv[1]
    print(json.dumps(check_file(p, float(os.environ.get("TARGET", "-16")), float(sys.argv[2]) if len(sys.argv) > 2 else 0.0), indent=1))
