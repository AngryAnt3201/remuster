"""Remuster soundtrack synthesiser: instruments and effects, numpy/scipy only.

Everything is a function of (midi, dur_seconds, vel 0..1, var) returning a mono (n,) or stereo (n, 2) float array
that may run past `dur` (release, ring). `var` picks a deterministic variation (detune, noise seed), so renders
are reproducible and repeated notes are not identical copies.

Oscillators are wavetables built from a truncated Fourier series (see `table`), so nothing above ~18 kHz is ever
generated: no aliasing by construction (check.py measures it anyway). Filter sweeps are done by morphing between
tables with different spectra rather than by a time-varying filter. Plucked and hammered strings are Karplus-Strong
loops solved in one `lfilter` call with an exact fractional-delay allpass for tuning.
"""
import zlib
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 44100
TS = 4096
_TAB = {}
_IRS = {}


def set_sr(sr):
    global SR
    SR = int(sr)
    _TAB.clear()
    _IRS.clear()


def hz(m):
    return 440.0 * 2.0 ** ((np.asarray(m, float) - 69.0) / 12.0)


def rng_for(*key):
    return np.random.default_rng(zlib.crc32(repr(key).encode()))


def db(x):
    return 10.0 ** (x / 20.0)


# ------------------------------------------------------------------ filters
def _sos(kind, f, order=2):
    f = np.clip(f, 10.0, SR * 0.49)
    return signal.butter(order, f, kind, fs=SR, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(_sos("low", f, order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(_sos("high", f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("band", [lo, min(hi, SR * 0.49)], order), x, axis=0)


def biquad(kind, f, gain_db=0.0, q=0.707):
    """RBJ cookbook biquad as one sos row. kind: peak, loshelf, hishelf, hp, lp, bp."""
    f = min(f, SR * 0.47)
    a = 10 ** (gain_db / 40.0)
    w = 2 * np.pi * f / SR
    al = np.sin(w) / (2 * q)
    c = np.cos(w)
    if kind == "peak":
        b = [1 + al * a, -2 * c, 1 - al * a]; d = [1 + al / a, -2 * c, 1 - al / a]
    elif kind == "loshelf":
        s = 2 * np.sqrt(a) * al
        b = [a * ((a + 1) - (a - 1) * c + s), 2 * a * ((a - 1) - (a + 1) * c), a * ((a + 1) - (a - 1) * c - s)]
        d = [(a + 1) + (a - 1) * c + s, -2 * ((a - 1) + (a + 1) * c), (a + 1) + (a - 1) * c - s]
    elif kind == "hishelf":
        s = 2 * np.sqrt(a) * al
        b = [a * ((a + 1) + (a - 1) * c + s), -2 * a * ((a - 1) + (a + 1) * c), a * ((a + 1) + (a - 1) * c - s)]
        d = [(a + 1) - (a - 1) * c + s, 2 * ((a - 1) - (a + 1) * c), (a + 1) - (a - 1) * c - s]
    elif kind == "hp":
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; d = [1 + al, -2 * c, 1 - al]
    elif kind == "lp":
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; d = [1 + al, -2 * c, 1 - al]
    elif kind == "bp":
        b = [al, 0, -al]; d = [1 + al, -2 * c, 1 - al]
    else:
        raise ValueError(kind)
    return np.array(b + d) / d[0]


def eq(x, bands):
    """Parametric EQ. bands: [(kind, freq, gain_db, q), ...]."""
    if not bands:
        return x
    sos = np.array([biquad(k, f, g, q) for (k, f, g, q) in bands])
    return signal.sosfilt(sos, x, axis=0)


def resonators(x, peaks):
    """Parallel band-pass bank: [(freq, gain, q)]. Vocal/body formants."""
    out = np.zeros_like(x)
    for f, g, q in peaks:
        out += g * signal.sosfilt(biquad("bp", f, 0, q)[None, :], x, axis=0)
    return out


# ------------------------------------------------------------------ envelopes
def ar(n, attack, hold, release, curve=1.0):
    """Attack to 1 over `attack` s, hold until `hold` s, then release to 0 over `release` s."""
    t = np.arange(n) / SR
    e = np.clip(t / max(attack, 1e-4), 0, 1) ** curve
    rel = np.clip(1 - (t - hold) / max(release, 1e-4), 0, 1)
    return e * rel * rel


def decay(n, t60):
    return np.exp(-6.908 * np.arange(n) / (SR * t60))


def fade(y, a=0.001, r=0.008):
    n = len(y)
    na, nr = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    if na > 0:
        y[:na] = (y[:na].T * np.linspace(0, 1, na)).T
    if nr > 0:
        y[-nr:] = (y[-nr:].T * np.linspace(1, 0, nr)).T
    return y


def vibrato(n, rate, cents, delay=0.15, ramp=0.25, rng=None):
    t = np.arange(n) / SR
    depth = cents * np.clip((t - delay) / max(ramp, 1e-3), 0, 1)
    wob = 1.0 if rng is None else 1 + 0.06 * np.sin(2 * np.pi * 0.7 * t + rng.random() * 6.28)
    ph0 = 0 if rng is None else rng.random() * 6.28
    return depth * np.sin(2 * np.pi * rate * wob * t + ph0)


def noise(n, rng):
    return rng.standard_normal(n)


# ------------------------------------------------------------------ band-limited oscillators
def kmax(fmax, top=18000.0):
    return max(1, int(min(top, SR * 0.45) / fmax))


def table(coef):
    """One cycle of sum_k Re(coef[k-1] * exp(j k theta)), with a wrap sample for interpolation."""
    spec = np.zeros(TS // 2 + 1, complex)
    k = min(len(coef), TS // 2 - 1)
    spec[1:k + 1] = np.asarray(coef[:k]) * (TS / 2)
    t = np.fft.irfft(spec, TS)
    return np.append(t, t[0])


def read(tab, phase):
    p = (phase % 1.0) * TS
    i = p.astype(np.int64)
    f = p - i
    return tab[i] * (1 - f) + tab[i + 1] * f


def morph(phase, tabs, pos):
    """Read a stack of tables, crossfading by `pos` (0..len-1, array)."""
    p = (phase % 1.0) * TS
    i = p.astype(np.int64)
    f = p - i
    pos = np.clip(pos, 0, len(tabs) - 1 - 1e-9)
    out = np.zeros(len(phase))
    for j, tb in enumerate(tabs):
        w = np.clip(1 - np.abs(pos - j), 0, 1)
        if w.max() <= 0:
            continue
        out += w * (tb[i] * (1 - f) + tb[i + 1] * f)
    return out


def saw_coef(K):
    k = np.arange(1, K + 1)
    return -1j * (2 / np.pi) * ((-1.0) ** (k + 1)) / k


def pulse_coef(K, duty):
    k = np.arange(1, K + 1)
    return (4 / (k * np.pi)) * np.sin(np.pi * k * duty) + 0j


def tri_coef(K):
    k = np.arange(1, K + 1)
    c = np.where(k % 2 == 1, (8 / np.pi ** 2) * ((-1.0) ** ((k - 1) // 2)) / k ** 2, 0)
    return -1j * c


def steptri_coef(K):
    """The NES triangle: a 32-step, 4-bit staircase."""
    steps = np.concatenate([np.arange(15, -1, -1), np.arange(0, 16)]) / 7.5 - 1.0
    cyc = np.repeat(steps, TS // 32)
    return (np.fft.rfft(cyc) / (TS / 2))[1:K + 1]


def lpmag(f, fc, order=2.0, res=0.0):
    m = 1.0 / np.sqrt(1.0 + (f / fc) ** (2 * order))
    if res:
        m = m + res * np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / 0.22) ** 2)
    return m


def tab_for(key, f0, fmax, coef_fn, fc=None, order=2.0, res=0.0):
    """Cached band-limited table for a note at f0 with an optional low-pass spectral shape."""
    K = kmax(fmax)
    ck = (key, K, None if fc is None else (round(float(fc), 1), order, res, round(float(f0), 2)))
    tb = _TAB.get(ck)
    if tb is None:
        c = coef_fn(K)
        if fc is not None:
            c = c * lpmag(np.arange(1, K + 1) * f0, fc, order, res)
        tb = table(c)
        if len(_TAB) > 6000:
            _TAB.clear()
        _TAB[ck] = tb
    return tb


def phase_of(f, start=0.0):
    return start + np.cumsum(f) / SR


def osc(shape, f, duty=0.5, start=0.0):
    """Plain band-limited oscillator. f is Hz (scalar or per-sample array). shape: saw, pulse, tri, steptri."""
    f = np.asarray(f, float)
    fn = {"saw": saw_coef, "tri": tri_coef, "steptri": steptri_coef,
          "pulse": lambda K: pulse_coef(K, duty)}[shape]
    tb = tab_for((shape, duty), 0, float(f.max()), fn)
    return read(tb, phase_of(f, start))


def warp(y, ratio):
    """Resample y by a time-varying playback ratio (pitch bends on plucked strings)."""
    pos = np.concatenate([[0.0], np.cumsum(ratio)[:-1]])
    pos = pos[pos < len(y) - 1]
    return np.interp(pos, np.arange(len(y)), y)


# ------------------------------------------------------------------ Karplus-Strong strings
def ks(f0, n, rng, t60=3.0, damp=0.25, pick=0.15, exc_lp=5000.0, hammer=0.0, exc_mix=0.5, pickup=0.0):
    """Plucked/struck string. damp 0..1 sets how fast highs die in the loop; pick is the pluck position
    (fraction of string), hammer > 0 uses a felt pulse of that many seconds instead of a pluck."""
    D = SR / f0
    M = int(np.floor(D - 1.5))
    d = D - 1.0 - M  # 0.5..1.5, done by a first-order allpass tuned exactly at f0
    w = 2 * np.pi * f0 / SR
    c = np.sin((1 - d) * w / 2) / np.sin((1 + d) * w / 2)
    a = 0.25 * np.clip(damp, 0, 0.98)
    rho = 10 ** (-3.0 / (f0 * t60))
    num = np.convolve(rho * np.array([a, 1 - 2 * a, a]), [c, 1.0])
    den = np.zeros(M + len(num))
    den[0] = 1.0
    den[1] = c
    den[M:M + len(num)] -= num
    P = int(np.ceil(D))
    x = np.zeros(n)
    if hammer > 0:
        hw = max(2, int(hammer * SR))
        x[:hw] = np.sin(np.pi * np.arange(hw) / hw) ** 2
        x[:P] += 0.05 * lp(noise(P, rng), exc_lp)
    else:
        e = np.zeros(P)
        e[0] = 1.0
        e = lp(e, exc_lp, 1) * (P ** 0.5) * exc_mix + lp(noise(P, rng), exc_lp, 1) * (1 - exc_mix)
        e -= e.mean()
        x[:P] = e
    for pos in (pick, pickup):
        if pos > 0:
            k = max(1, int(round(pos * D)))
            x[k:] -= x[:-k].copy() * 0.9
    return signal.lfilter([1.0, c], den, x)


def _pluck(midi, dur, vel, var, name, *, t60, damp, pick, exc, ring, rel=0.08, body=None, click=0.0,
           mix=0.5, sharp=0.0, pickup=0.0, maxlen=6.0, f_scale=0.5):
    f0 = float(hz(midi))
    rng = rng_for(name, midi, var)
    f0 *= 2 ** (rng.normal(0, 1.5) / 1200)
    hold = min(dur + ring, maxlen)
    n = int((hold + rel) * SR)
    t60n = t60 * (220.0 / f0) ** f_scale
    y = ks(f0, n, rng, t60=t60n, damp=damp, pick=pick, exc_lp=exc * (0.35 + 0.65 * vel), exc_mix=mix, pickup=pickup)
    if sharp:
        y = warp(y, 2 ** (sharp * vel * np.exp(-np.arange(n) / (0.05 * SR)) / 1200))
        n = len(y)
    if click:
        nc = int(0.004 * SR)
        y[:nc] += click * hp(noise(nc, rng), 2500) * np.linspace(1, 0, nc) ** 2 * np.abs(y).max()
    if body:
        y = eq(y, body)
    y *= ar(n, 0.0005, hold, rel)
    pk = np.abs(y[:int(0.05 * SR) + 1]).max() + 1e-9
    return fade(y * (0.25 + 0.75 * vel) / pk * 0.8, 0.0003, 0.005)


def guitar(midi, dur, vel=0.8, var=0):
    return _pluck(midi, dur, vel, var, "gtr", t60=3.2, damp=0.35, pick=0.17, exc=4500, ring=0.25,
                  body=[("peak", 105, 4, 2.5), ("peak", 210, 3, 3), ("peak", 420, -2, 2), ("hishelf", 6000, -4, 0.7),
                        ("hp", 70, 0, 0.7)])


def twang(midi, dur, vel=0.8, var=0, whammy=True):
    """Baritone electric: bridge pick, single-coil pickup comb, string goes sharp on the attack, whammy dip."""
    y = _pluck(midi, dur, vel, var, "twang", t60=4.5, damp=0.16, pick=0.085, pickup=0.21, exc=7000, ring=0.35,
               sharp=14.0, mix=0.7, body=[("peak", 2400, 7, 1.6), ("peak", 900, -3, 1.2), ("hp", 60, 0, 0.7),
                                          ("lp", 6200, 0, 0.7)])
    n = len(y)
    if whammy and dur > 0.55:
        t = np.arange(n) / SR
        dip = -22 * np.clip((t - 0.25) / 0.3, 0, 1) * (0.5 - 0.5 * np.cos(2 * np.pi * 5.2 * (t - 0.25)))
        y = warp(y, 2 ** (dip / 1200))
    return np.tanh(y * 1.6) / 1.2


def banjo(midi, dur, vel=0.8, var=0):
    return _pluck(midi, dur, vel, var, "banjo", t60=0.9, damp=0.2, pick=0.1, exc=8000, ring=0.3, click=0.25,
                  body=[("peak", 520, 6, 3), ("peak", 1250, 6, 3), ("peak", 2700, 5, 2.5), ("hp", 150, 0, 0.7)],
                  f_scale=0.3)


def harp(midi, dur, vel=0.8, var=0):
    return _pluck(midi, dur, vel, var, "harp", t60=4.2, damp=0.45, pick=0.42, exc=3000, ring=1.6, rel=0.25,
                  body=[("peak", 180, 3, 1.5), ("hishelf", 5000, -5, 0.7), ("hp", 50, 0, 0.7)], mix=0.75)


def koto(midi, dur, vel=0.8, var=0, bend=0.0, yuri=False):
    """Koto: ivory picks near the bridge, long ring, optional press-bend (oshi-de, cents) and yuri vibrato."""
    y = _pluck(midi, dur, vel, var, "koto", t60=3.6, damp=0.2, pick=0.07, exc=9000, ring=1.4, rel=0.2, click=0.35,
               mix=0.8, sharp=10.0,
               body=[("peak", 230, 4, 3), ("peak", 480, 3, 3), ("peak", 1150, 4, 2), ("peak", 3200, 3, 1.5),
                     ("hp", 90, 0, 0.7)])
    n = len(y)
    if bend or yuri:
        t = np.arange(n) / SR
        cents = bend * np.clip((t - 0.06) / 0.14, 0, 1) ** 2
        if yuri:
            cents = cents + 18 * np.clip((t - 0.2) / 0.3, 0, 1) * np.sin(2 * np.pi * 5.5 * t)
        y = warp(y, 2 ** (cents / 1200))
    return y


def shamisen(midi, dur, vel=0.8, var=0, slide=0.0):
    """Shamisen: skin body, short sustain, sawari buzz, the bachi slapping the skin on every stroke."""
    y = _pluck(midi, dur, vel, var, "shami", t60=1.3, damp=0.22, pick=0.12, exc=8000, ring=0.25, mix=0.7,
               sharp=16.0, f_scale=0.3)
    n = len(y)
    rng = rng_for("shamib", midi, var)
    buzz = hp(np.tanh(6 * y) - np.tanh(6 * y).mean(), 1800) * 0.16
    y = eq(y + buzz, [("peak", 380, 6, 3), ("peak", 760, 5, 3), ("peak", 1500, 5, 2.5), ("hp", 140, 0, 0.7),
                      ("hishelf", 7000, -3, 0.7)])
    ns = int(0.03 * SR)
    slap = bp(noise(ns, rng), 700, 2600) * decay(ns, 0.02) + 0.8 * np.sin(2 * np.pi * 170 * np.arange(ns) / SR) * decay(ns, 0.03)
    y[:ns] += slap[:min(ns, n)] * 0.45 * vel
    if slide:
        t = np.arange(n) / SR
        y = warp(y, 2 ** (slide * (1 - np.clip(t / 0.09, 0, 1)) / 1200))
    return y


def upright(midi, dur, vel=0.8, var=0):
    y = _pluck(midi, dur, vel, var, "upright", t60=1.6, damp=0.75, pick=0.3, exc=1500, ring=0.12, rel=0.1,
               mix=0.85, body=[("peak", 95, 4, 2), ("peak", 190, 3, 2), ("lp", 2200, 0, 0.7), ("hp", 32, 0, 0.7)],
               f_scale=0.25)
    n = min(len(y), int(0.02 * SR))
    y[:n] += 0.2 * vel * lp(noise(n, rng_for("upn", midi, var)), 600) * np.linspace(1, 0, n)
    return y


def harpsichord(midi, dur, vel=0.8, var=0):
    """Two choirs (8' + 4'), quill click, no dynamics, damper thunk on release."""
    y8 = _pluck(midi, dur, 0.9, var, "hpsi8", t60=2.6, damp=0.1, pick=0.06, exc=11000, ring=0.0, rel=0.05, click=0.5,
                mix=0.9)
    y4 = _pluck(midi + 12, dur, 0.9, var + 7, "hpsi4", t60=1.8, damp=0.12, pick=0.08, exc=11000, ring=0.0, rel=0.05,
                mix=0.9)
    n = min(len(y8), len(y4))
    y = y8[:n] + 0.45 * y4[:n]
    rng = rng_for("hpsir", midi, var)
    nt = int(0.025 * SR)
    k = min(n - nt, int(dur * SR))
    if k > 0:
        y[k:k + nt] += 0.06 * bp(noise(nt, rng), 300, 1800) * decay(nt, 0.02)
    y = eq(y, [("peak", 700, 2, 1.2), ("peak", 3500, 4, 1.2), ("hp", 60, 0, 0.7)])
    return y * 0.75 * (0.85 + 0.15 * vel)


def honkytonk(midi, dur, vel=0.8, var=0, detune=13.0):
    """Upright piano with tired tuning: three hammered strings per note, a few cents apart."""
    f0 = float(hz(midi))
    rng = rng_for("honk", midi, var)
    hold = min(dur, 5.0)
    rel = 0.09 if midi < 90 else 0.5
    n = int((hold + rel) * SR)
    t60 = 7.0 * (220.0 / f0) ** 0.55
    hw = (0.0009 + 0.0022 * (1 - vel)) * (300.0 / f0) ** 0.25
    offs = np.array([0.0, detune, -detune * 0.8]) + rng.normal(0, 1.2, 3)
    y = np.zeros(n)
    for o in offs:
        y += ks(f0 * 2 ** (o / 1200), n, rng, t60=t60, damp=0.12 + 0.2 * (1 - vel), pick=0.12, hammer=hw)
    nt = int(0.03 * SR)
    y[:nt] += lp(noise(nt, rng), 350) * decay(nt, 0.02) * np.abs(y).max() * 0.5
    y = eq(y, [("peak", 260, 3, 1.5), ("peak", 2600, 5, 1.2), ("hp", 45, 0, 0.7), ("hishelf", 8000, -3, 0.7)])
    y *= ar(n, 0.0005, hold, rel)
    pk = np.abs(y[:int(0.06 * SR) + 1]).max() + 1e-9
    return fade(y / pk * (0.2 + 0.8 * vel) * 0.8, 0.0003, 0.005)


# ------------------------------------------------------------------ bowed strings
_STR = {
    "vn": dict(fc=2600, body=[("peak", 290, 3, 4), ("peak", 470, 2.5, 4), ("peak", 1100, -2, 2), ("peak", 2900, 5, 1.4),
                              ("lp", 9000, 0, 0.7), ("hp", 180, 0, 0.7)]),
    "va": dict(fc=2000, body=[("peak", 220, 3, 4), ("peak", 400, 3, 3), ("peak", 2300, 4, 1.4), ("lp", 7000, 0, 0.7),
                              ("hp", 120, 0, 0.7)]),
    "vc": dict(fc=1500, body=[("peak", 110, 3, 3), ("peak", 190, 3, 3), ("peak", 420, 2, 3), ("peak", 2100, 4, 1.4),
                              ("lp", 5500, 0, 0.7), ("hp", 55, 0, 0.7)]),
    "cb": dict(fc=900, body=[("peak", 70, 3, 2), ("peak", 150, 3, 3), ("peak", 1200, 3, 1.4), ("lp", 3500, 0, 0.7),
                             ("hp", 30, 0, 0.7)]),
}


def strings(midi, dur, vel=0.8, var=0, kind="vn", n=6, attack=0.09, release=0.16, vib=13.0, spread=0.7):
    """A bowed section: n players, each a morphing saw with its own tuning, vibrato and bow speed."""
    P = _STR[kind]
    f0 = float(hz(midi))
    rng = rng_for("str", kind, midi, var)
    N = int((dur + release) * SR) + 1
    fcs = P["fc"] * np.array([0.3, 1.0, 2.8]) * (0.8 + 0.5 * vel)
    tabs = [tab_for("saw", f0, f0 * 1.03, saw_coef, fc=fc, order=1.5) for fc in fcs]
    out = np.zeros((N, 2))
    t = np.arange(N) / SR
    offs = rng.normal(0, 5.0, n)
    offs -= offs.mean()
    for v in range(n):
        att = attack * rng.uniform(0.7, 1.4)
        env = ar(N, att, dur + rng.uniform(-0.01, 0.02), release * rng.uniform(0.8, 1.2), 0.8)
        cents = offs[v] + vibrato(N, rng.uniform(5.0, 6.3), vib * rng.uniform(0.6, 1.2), 0.12 + att, 0.3, rng)
        cents = cents + 4 * np.sin(2 * np.pi * rng.uniform(0.15, 0.5) * t + rng.random() * 6.28)
        y = morph(phase_of(f0 * 2 ** (cents / 1200), rng.random()), tabs, env ** 1.5 * (0.5 + 1.5 * vel))
        y = y * env * (1 + 0.04 * lp(noise(N, rng), 30))
        p = rng.uniform(-spread, spread) if n > 1 else 0.0
        ang = (p + 1) * np.pi / 4
        out[:, 0] += y * np.cos(ang)
        out[:, 1] += y * np.sin(ang)
    out /= np.sqrt(n)
    bow = bp(noise(N, rng), 1500, 6000) * ar(N, attack, dur, release) * 0.012
    out += bow[:, None]
    return fade(eq(out, P["body"]) * (0.3 + 0.7 * vel) * 0.9, 0.002, 0.01)


def pizz(midi, dur, vel=0.8, var=0):
    return _pluck(midi, dur, vel, var, "pizz", t60=0.5, damp=0.6, pick=0.25, exc=3500, ring=0.3, mix=0.8,
                  body=[("peak", 280, 4, 3), ("peak", 460, 3, 3), ("hp", 100, 0, 0.7)], f_scale=0.3)


# ------------------------------------------------------------------ brass
_BR = {
    "horn": dict(fc=(380, 2100), att=0.055, n=3, vib=5, body=[("peak", 430, 4, 2), ("peak", 1600, -3, 1), ("lp", 4500, 0, 0.7)]),
    "trumpet": dict(fc=(700, 5200), att=0.028, n=2, vib=9, body=[("peak", 1250, 3, 2), ("peak", 2500, 4, 2), ("lp", 9000, 0, 0.7)]),
    "cornet": dict(fc=(600, 3600), att=0.03, n=2, vib=12, body=[("peak", 1000, 3, 2), ("peak", 2200, 3, 2), ("lp", 7000, 0, 0.7)]),
    "trombone": dict(fc=(350, 3200), att=0.04, n=2, vib=5, body=[("peak", 520, 4, 2), ("peak", 1900, 2, 2), ("lp", 6500, 0, 0.7)]),
    "euph": dict(fc=(280, 1700), att=0.05, n=1, vib=10, body=[("peak", 350, 4, 2), ("lp", 3800, 0, 0.7)]),
    "tuba": dict(fc=(170, 1000), att=0.05, n=1, vib=0, body=[("peak", 230, 4, 2), ("lp", 2400, 0, 0.7), ("hp", 28, 0, 0.7)]),
}


def brass(midi, dur, vel=0.8, var=0, kind="horn"):
    """Brass: a saw whose low-pass opens with lip pressure (overshoot on the attack = the blat), pitch scoop,
    lip-buzz noise at the start, late vibrato."""
    P = _BR[kind]
    f0 = float(hz(midi))
    rng = rng_for("brass", kind, midi, var)
    rel = 0.07
    N = int((dur + rel) * SR) + 1
    t = np.arange(N) / SR
    lo, hi = P["fc"]
    hi = lo * (hi / lo) ** (0.45 + 0.55 * vel)
    fcs = np.geomspace(lo, hi, 6)
    tabs = [tab_for("saw", f0, f0 * 1.03, saw_coef, fc=fc, order=1.5) for fc in fcs]
    att = P["att"] * (1.3 - 0.5 * vel)
    env = ar(N, att, dur, rel, 0.7)
    blat = 1.0 + 0.45 * vel * np.exp(-t / 0.06)
    sus = 0.72 + 0.1 * np.exp(-t / 0.4)
    bright = np.clip(env ** 2 * sus * blat, 0, 1)
    out = np.zeros(N)
    for v in range(P["n"]):
        cents = rng.normal(0, 2.5) - 28 * np.exp(-t / 0.025) + vibrato(N, rng.uniform(4.8, 5.6), P["vib"], 0.3, 0.3, rng)
        out += morph(phase_of(f0 * 2 ** (cents / 1200), rng.random()), tabs, bright * 5) * (1 + 0.03 * lp(noise(N, rng), 25))
    out /= np.sqrt(P["n"])
    out *= env * (0.85 + 0.15 * sus)
    nb = int(0.05 * SR)
    buzz = bp(noise(N, rng), max(300, f0), max(2500, min(8000, f0 * 6))) * np.exp(-t / 0.018) * 0.1 * vel
    out[:nb] += buzz[:nb][:len(out[:nb])]
    return fade(eq(out, P["body"]) * (0.25 + 0.75 * vel), 0.002, 0.008)


# ------------------------------------------------------------------ flutes, whistles
_FL = {
    "flute": dict(h=[1, 0.42, 0.2, 0.07, 0.03], breath=0.05, att=0.05, scoop=(-12, 0.03), vib=(5.2, 11, 0.2), chiff=0.25),
    "piccolo": dict(h=[1, 0.25, 0.08, 0.02], breath=0.04, att=0.035, scoop=(-10, 0.02), vib=(5.6, 9, 0.15), chiff=0.3),
    "whistle": dict(h=[1, 0.035, 0.012], breath=0.035, att=0.06, scoop=(-55, 0.07), vib=(5.6, 22, 0.22), chiff=0.05),
    "shaku": dict(h=[1, 0.6, 0.34, 0.14, 0.09, 0.04], breath=0.2, att=0.09, scoop=(-90, 0.13), vib=(4.4, 30, 0.45), chiff=0.6),
    "ocarina": dict(h=[1, 0.08, 0.05], breath=0.06, att=0.04, scoop=(-15, 0.03), vib=(5.0, 8, 0.2), chiff=0.15),
}


def flute(midi, dur, vel=0.8, var=0, kind="flute", fall=0.0, scoop=None):
    """Air-jet instruments: a few sine partials, breath noise resonating on the tube, chiff, scoop, late vibrato."""
    P = _FL[kind]
    f0 = float(hz(midi))
    rng = rng_for("fl", kind, midi, var)
    rel = 0.09
    N = int((dur + rel) * SR) + 1
    t = np.arange(N) / SR
    sc, st = P["scoop"] if scoop is None else scoop
    vr, vd, vdel = P["vib"]
    vibc = vibrato(N, vr, vd, vdel, 0.35, rng)
    cents = sc * np.exp(-t / st) + vibc + rng.normal(0, 2)
    if fall:
        cents = cents + fall * np.clip((t - dur + 0.12) / 0.2, 0, 1) ** 2
    ph = 2 * np.pi * phase_of(f0 * 2 ** (cents / 1200))
    env = ar(N, P["att"], dur, rel, 0.8) * (1 + 0.12 * vibc / max(vd, 1))
    y = np.zeros(N)
    for k, a in enumerate(P["h"], 1):
        if k * f0 * 1.06 < SR * 0.45:
            y += a * (vel ** (0.4 * (k - 1))) * np.sin(k * ph + rng.random() * 0.5)
    # the overblown partial speaks first
    y += P["chiff"] * 0.5 * np.sin(2 * ph) * np.exp(-t / 0.03)
    air = noise(N, rng)
    tube = resonators(air, [(f0, 1.0, 14), (min(2 * f0, SR * 0.4), 0.6, 12), (min(3 * f0, SR * 0.4), 0.35, 10)])
    hiss = bp(air, 2500, 9000) * 0.25
    br = (tube * 0.9 + hiss) * P["breath"] * (1 + 2.5 * P["chiff"] * np.exp(-t / 0.035))
    y = (y + br) * env
    return fade(y * (0.3 + 0.7 * vel) * 0.7, 0.003, 0.01)


# ------------------------------------------------------------------ reeds
def _reed_coef(duty):
    return lambda K: pulse_coef(K, duty)


def harmonica(midi, dur, vel=0.8, var=0, bend=None):
    """Free reeds through a cupped hand: bends up into long notes, hand tremolo, a second reed slightly sharp."""
    f0 = float(hz(midi))
    rng = rng_for("harm", midi, var)
    rel = 0.06
    N = int((dur + rel) * SR) + 1
    t = np.arange(N) / SR
    if bend is None:
        bend = -110.0 if dur > 0.3 else -35.0
    cents = bend * np.exp(-t / 0.055) + vibrato(N, 5.4, 8, 0.25, 0.3, rng)
    tabs = [tab_for(("reed", 0.22), f0, f0 * 1.02, _reed_coef(0.22), fc=fc, order=1.0) for fc in (1200, 2400, 4800)]
    wah = 0.5 + 0.5 * np.sin(2 * np.pi * 5.6 * t + 1.0) * np.clip((t - 0.18) / 0.25, 0, 1)
    env = ar(N, 0.035, dur, rel, 0.7)
    y = np.zeros(N)
    for o in (0.0, 7.0):
        y += morph(phase_of(f0 * 2 ** ((cents + o) / 1200), rng.random()), tabs, env * (0.6 + 1.2 * wah) * (0.6 + 0.4 * vel))
    y = y * env * (0.78 + 0.22 * wah)
    y += bp(noise(N, rng), 1500, 6000) * env * 0.03
    y = eq(y, [("peak", 1150, 6, 2.5), ("peak", 2700, 5, 3), ("hp", 250, 0, 0.7), ("lp", 7500, 0, 0.7)])
    return fade(y * (0.3 + 0.7 * vel) * 0.45, 0.002, 0.008)


def accordion(midi, dur, vel=0.8, var=0, low=True):
    """Musette: three reeds a few cents apart (plus a 16' reed), bellows swell, key click."""
    f0 = float(hz(midi))
    rng = rng_for("acc", midi, var)
    rel = 0.07
    N = int((dur + rel) * SR) + 1
    t = np.arange(N) / SR
    tab = tab_for(("reed", 0.3), f0, f0 * 1.02, _reed_coef(0.3), fc=3800, order=1.0)
    tabl = tab_for(("reed", 0.3), f0 / 2, f0 * 0.51, _reed_coef(0.3), fc=2500, order=1.0)
    env = ar(N, 0.04, dur, rel, 0.6) * (0.85 + 0.15 * np.clip(t / max(dur, 0.1), 0, 1))
    y = np.zeros(N)
    for o in (0.0, 11.0, -9.0):
        y += read(tab, phase_of(np.full(N, f0 * 2 ** ((o + rng.normal(0, 1)) / 1200)), rng.random()))
    if low:
        y += 0.8 * read(tabl, phase_of(np.full(N, f0 / 2), rng.random()))
    y *= env / 2.2
    nc = int(0.012 * SR)
    y[:nc] += 0.05 * bp(noise(nc, rng), 800, 4000) * np.linspace(1, 0, nc)
    y = eq(y, [("peak", 900, 3, 1.5), ("peak", 1900, 3, 2), ("hp", 90, 0, 0.7), ("lp", 6500, 0, 0.7)])
    return fade(y * (0.4 + 0.6 * vel) * 0.6, 0.002, 0.008)


def jawharp(midi, dur, vel=0.8, var=0):
    """A fixed reed drone under a mouth formant that sweeps: boi-oi-oing."""
    f0 = float(hz(midi))
    rng = rng_for("jaw", midi, var)
    rel = 0.08
    N = int((dur + rel) * SR) + 1
    t = np.arange(N) / SR
    K = kmax(f0 * 1.01)
    k = np.arange(1, K + 1)
    tabs = []
    for fc in np.geomspace(500, 2600, 9):
        c = pulse_coef(K, 0.08) * (0.12 + np.exp(-0.5 * (np.log2(k * f0 / fc) / 0.16) ** 2)) * lpmag(k * f0, 5000, 1)
        tabs.append(table(c))
    sweep = 4 + 3.6 * np.sin(2 * np.pi * (2.4 / max(dur, 0.25)) * t + rng.uniform(-0.4, 0.4)) * np.exp(-t / (dur + 0.3))
    env = ar(N, 0.004, dur, rel) * (0.35 + 0.65 * np.exp(-t / (0.35 + dur * 0.5)))
    y = morph(phase_of(np.full(N, f0)), tabs, sweep) * env
    return fade(hp(y, 60) * (0.3 + 0.7 * vel) * 0.9, 0.001, 0.008)


# ------------------------------------------------------------------ organ, choir
def organ(midi, dur, vel=0.8, var=0, stops="plenum"):
    """Pipe organ: additive ranks (16' 8' 4' 2 2/3' 2' + mixture), each pipe a hair off, chiff as pipes speak."""
    f0 = float(hz(midi))
    rng = rng_for("org", midi, var)
    rel = 0.09
    N = int((dur + rel) * SR) + 1
    t = np.arange(N) / SR
    ranks = {"plenum": [(0.5, 0.5), (1, 1.0), (2, 0.7), (3, 0.3), (4, 0.5), (6, 0.18), (8, 0.25)],
             "flutes": [(1, 1.0), (2, 0.35), (4, 0.12)],
             "reed": [(0.5, 0.6), (1, 1.0), (2, 0.6), (3, 0.45), (4, 0.4), (5, 0.3), (6, 0.25), (8, 0.2)]}[stops]
    y = np.zeros(N)
    for mult, a in ranks:
        f = f0 * mult * 2 ** (rng.normal(0, 2.5) / 1200)
        # each principal pipe has a few harmonics of its own
        for h, ha in ((1, 1.0), (2, 0.35), (3, 0.2), (4, 0.08)):
            if f * h < min(SR * 0.45, 16000):
                e = ar(N, 0.03 + 0.03 / mult ** 0.5, dur, rel, 0.7)
                y += a * ha * e * np.sin(2 * np.pi * f * h * t + rng.random() * 6.28)
    chiff = bp(noise(N, rng), f0 * 2, min(f0 * 9, SR * 0.4)) * np.exp(-t / 0.03) * 0.25
    wind = bp(noise(N, rng), 400, 3000) * ar(N, 0.05, dur, rel) * 0.012
    y = y / 2.6 + chiff * ar(N, 0.002, dur, rel) + wind
    return fade(y * 0.55 * (0.8 + 0.2 * vel), 0.002, 0.01)


def choir(midi, dur, vel=0.8, var=0, vowel="ah", n=5):
    f0 = float(hz(midi))
    rng = rng_for("choir", midi, var)
    rel = 0.25
    N = int((dur + rel) * SR) + 1
    tab = tab_for("saw", f0, f0 * 1.03, saw_coef, fc=4500, order=1.0)
    out = np.zeros((N, 2))
    for v in range(n):
        cents = rng.normal(0, 9) + vibrato(N, rng.uniform(4.8, 5.8), 22, 0.2, 0.4, rng)
        y = read(tab, phase_of(f0 * 2 ** (cents / 1200), rng.random())) * ar(N, rng.uniform(0.12, 0.2), dur, rel)
        ang = (rng.uniform(-0.8, 0.8) + 1) * np.pi / 4
        out[:, 0] += y * np.cos(ang)
        out[:, 1] += y * np.sin(ang)
    fm = {"ah": [(700, 1.0, 7), (1150, 0.6, 8), (2700, 0.3, 9), (3400, 0.15, 9)],
          "oo": [(340, 1.0, 6), (750, 0.35, 8), (2500, 0.12, 9)],
          "oh": [(480, 1.0, 6), (850, 0.5, 8), (2600, 0.2, 9)]}[vowel]
    out = resonators(out, fm) + 0.05 * out
    out += (bp(noise(N, rng), 2000, 7000) * ar(N, 0.15, dur, rel) * 0.004)[:, None]
    return fade(out * (0.4 + 0.6 * vel) * 0.5, 0.005, 0.02)


# ------------------------------------------------------------------ bells and bars
_BELL = {
    # (ratio, amp, t60 seconds at A4)
    "tubular": [(0.5, 0.25, 6.0), (0.92, 0.25, 5.0), (1.0, 1.0, 5.5), (1.19, 0.3, 4.0), (1.71, 0.45, 3.0), (2.0, 0.6, 3.5),
                (2.74, 0.35, 2.0), (3.0, 0.3, 1.8), (3.76, 0.2, 1.2), (4.07, 0.18, 1.0), (5.4, 0.1, 0.6)],
    "glock": [(1.0, 1.0, 1.6), (2.76, 0.3, 0.6), (5.4, 0.14, 0.25), (8.93, 0.05, 0.12)],
    "musicbox": [(1.0, 1.0, 1.3), (3.0, 0.1, 0.5), (6.27, 0.16, 0.22), (11.2, 0.04, 0.1)],
    "celesta": [(1.0, 1.0, 1.0), (2.0, 0.2, 0.6), (4.0, 0.12, 0.3), (6.3, 0.05, 0.12)],
    "anvil": [(1.0, 1.0, 0.35), (1.47, 0.7, 0.3), (2.09, 0.8, 0.25), (2.56, 0.5, 0.22), (3.39, 0.6, 0.18), (4.08, 0.4, 0.15),
              (5.21, 0.35, 0.12), (6.1, 0.25, 0.1)],
    "kane": [(1.0, 1.0, 0.9), (1.34, 0.5, 0.7), (2.41, 0.6, 0.5), (3.16, 0.4, 0.35), (4.3, 0.25, 0.25)],
    "gong": [(1.0, 1.0, 5.0), (1.48, 0.6, 4.0), (2.02, 0.5, 3.5), (2.67, 0.45, 3.0), (3.4, 0.35, 2.2), (4.21, 0.3, 1.8),
             (5.37, 0.2, 1.2), (6.9, 0.15, 0.9)],
}


def bell(midi, dur, vel=0.8, var=0, kind="glock", ring=None):
    f0 = float(hz(midi))
    rng = rng_for("bell", kind, midi, var)
    parts = _BELL[kind]
    scale = (440.0 / f0) ** 0.35
    L = max(t for _, _, t in parts) * scale if ring is None else ring
    N = int(min(max(dur, 0.05) + L, 7.0) * SR)
    t = np.arange(N) / SR
    y = np.zeros(N)
    for r, a, t60 in parts:
        f = f0 * r
        if f > min(SR * 0.45, 17000):
            continue
        aa = a * (vel ** (0.5 * np.log2(max(r, 1)) + 0.0))
        y += aa * np.sin(2 * np.pi * f * (1 + rng.normal(0, 0.0006)) * t + rng.random() * 6.28) * np.exp(-6.908 * t / (t60 * scale))
        if kind in ("tubular", "gong"):  # beating doublets
            y += 0.5 * aa * np.sin(2 * np.pi * f * 1.003 * t + rng.random() * 6.28) * np.exp(-6.908 * t / (t60 * scale))
    nc = int(0.006 * SR)
    y[:nc] += 0.3 * hp(noise(nc, rng), 2000) * np.linspace(1, 0, nc) ** 2
    y *= np.clip(np.arange(N) / (0.0008 * SR), 0, 1)
    return fade(y * (0.2 + 0.8 * vel) * 0.45, 0.0, 0.03)


# ------------------------------------------------------------------ synths
_SS = np.array([-0.11002313, -0.06288439, -0.01952356, 0.0, 0.01991221, 0.06216538, 0.10745242])


def supersaw(midi, dur, vel=0.8, var=0, detune=0.32, cut=(900, 7000), att=0.008, dec=0.35, sus=0.55, rel=0.12,
             res=0.0, sub=0.0):
    """Seven detuned saws, stereo spread, low-pass envelope (table morph). Returns stereo."""
    f0 = float(hz(midi))
    rng = rng_for("ss", midi, var)
    N = int((dur + rel) * SR) + 1
    t = np.arange(N) / SR
    fcs = np.geomspace(cut[0], cut[1], 6)
    tabs = [tab_for("saw", f0, f0 * 1.08, saw_coef, fc=fc, order=2.0, res=res) for fc in fcs]
    amp = ar(N, att, dur, rel)
    fenv = np.clip(t / max(att, 1e-4), 0, 1) * (sus + (1 - sus) * np.exp(-t / dec)) * (0.55 + 0.45 * vel)
    fenv *= np.clip(1 - (t - dur) / rel, 0, 1)
    out = np.zeros((N, 2))
    pans = np.array([-0.9, 0.6, -0.3, 0.0, 0.3, -0.6, 0.9])
    gains = np.array([0.7, 0.8, 0.9, 1.0, 0.9, 0.8, 0.7])
    for i in range(7):
        f = f0 * (1 + _SS[i] * detune * 0.5)
        y = morph(phase_of(np.full(N, f), rng.random()), tabs, fenv * 5) * gains[i]
        ang = (pans[i] + 1) * np.pi / 4
        out[:, 0] += y * np.cos(ang)
        out[:, 1] += y * np.sin(ang)
    if sub:
        out += (sub * np.sin(2 * np.pi * f0 / 2 * t))[:, None]
    out = hp(out, max(30.0, f0 * 0.7), 1)
    return fade(out * amp[:, None] / 2.4 * (0.35 + 0.65 * vel), 0.001, 0.008)


def synthpluck(midi, dur, vel=0.8, var=0, shape="saw", cut=(500, 6000), dec=0.11, duty=0.3):
    f0 = float(hz(midi))
    rng = rng_for("spl", midi, var)
    rel = 0.1
    N = int((dur + rel) * SR) + 1
    t = np.arange(N) / SR
    fn = saw_coef if shape == "saw" else (lambda K: pulse_coef(K, duty))
    fcs = np.geomspace(cut[0], cut[1], 6)
    tabs = [tab_for((shape, duty), f0, f0 * 1.01, fn, fc=fc, order=2.0, res=0.6) for fc in fcs]
    fenv = np.exp(-t / dec) * (0.5 + 0.5 * vel)
    y = morph(phase_of(np.full(N, f0 * 1.003), rng.random()), tabs, fenv * 5)
    y += morph(phase_of(np.full(N, f0 * 0.997), rng.random()), tabs, fenv * 5)
    y *= ar(N, 0.002, dur, rel) * (0.45 + 0.55 * np.exp(-t / (dec * 3)))
    return fade(y * 0.5 * (0.3 + 0.7 * vel), 0.0008, 0.008)


def fmbass(midi, dur, vel=0.8, var=0, index=5.0, ratio=1.0, dec=0.12):
    """Two-operator FM bass with a sine sub: the index decays so each note barks then rounds off."""
    f0 = float(hz(midi))
    rel = 0.05
    N = int((dur + rel) * SR) + 1
    t = np.arange(N) / SR
    I = index * (0.4 + 0.6 * vel) * (0.22 + 0.78 * np.exp(-t / dec))
    y = np.sin(2 * np.pi * f0 * t + I * np.sin(2 * np.pi * f0 * ratio * t))
    y = 0.8 * y + 0.5 * np.sin(2 * np.pi * f0 * t)
    y *= ar(N, 0.003, dur, rel) * (0.75 + 0.25 * np.exp(-t / 0.2))
    return fade(np.tanh(1.4 * y) * 0.6 * (0.4 + 0.6 * vel), 0.001, 0.008)


def fmbell(midi, dur, vel=0.8, var=0, ratio=3.5, index=3.0, t60=1.4):
    f0 = float(hz(midi))
    N = int((dur + t60) * SR)
    t = np.arange(N) / SR
    I = index * vel * np.exp(-t / (t60 * 0.25))
    y = np.sin(2 * np.pi * f0 * t + I * np.sin(2 * np.pi * f0 * ratio * t)) * np.exp(-6.908 * t / (t60 + dur))
    y += 0.3 * np.sin(2 * np.pi * f0 * 2 * t + 0.5 * I * np.sin(2 * np.pi * f0 * 7 * t)) * np.exp(-6.908 * t / (0.5 * t60))
    return fade(y * 0.5 * (0.3 + 0.7 * vel), 0.001, 0.03)


# ------------------------------------------------------------------ chip channels
FRAME = 1 / 60.0


def chip_pulse(midi, dur, vel=0.8, var=0, duty=(0.25,), env="hold", arp=None, arp_frames=1, vib=(0, 0, 0), slide=0.0):
    """NES-style pulse channel. duty: sequence of duty cycles, one per frame, last one holds. env: 'hold', 'decay',
    'pluck' or 'swell' (16-level volume, stepped at 60 Hz). arp: semitone offsets cycled every arp_frames frames."""
    N = int(dur * SR) + int(0.012 * SR)
    t = np.arange(N) / SR
    fr = np.minimum((t / FRAME).astype(int), 10 ** 6)
    semis = np.zeros(N)
    if arp:
        semis = np.asarray(arp, float)[(fr // arp_frames) % len(arp)]
    vr, vd, vdel = vib
    if vd:
        semis = semis + (vd / 100.0) * np.sin(2 * np.pi * vr * t) * (t > vdel)
    if slide:
        semis = semis + slide * np.exp(-t / 0.03)
    f = hz(midi + semis)
    ph = phase_of(f)
    fmax = float(f.max())
    y = np.zeros(N)
    dseq = np.asarray(duty, float)
    di = np.minimum(fr, len(dseq) - 1)
    for j, d in enumerate(dseq):
        m = di == j
        if m.any():
            tb = tab_for(("pulse", float(d)), 0, fmax, lambda K, d=d: pulse_coef(K, d))
            y[m] = read(tb, ph[m])
    nf = fr.max() + 1
    k = np.arange(nf)
    if env == "hold":
        v = np.full(nf, 12.0)
        v[:2] = [15, 13][:len(v[:2])]
    elif env == "decay":
        v = np.maximum(15 - k * 0.7, 3)
    elif env == "pluck":
        v = np.maximum(15 - k * 2.2, 0)
    else:  # swell
        v = np.minimum(5 + k * 1.2, 13)
    vol = np.round(v * (0.4 + 0.6 * vel)) / 15.0
    a = vol[fr] * (t < dur)
    a = uniform_filter1d(a, max(2, int(0.0015 * SR)))  # the DAC is not infinitely fast
    return y * a * 0.5


def chip_tri(midi, dur, vel=0.8, var=0, drop=0.0, arp=None):
    """NES triangle channel: fixed volume, staircase wave. drop: semitones of pitch fall (tom/kick use)."""
    N = int(dur * SR) + int(0.006 * SR)
    t = np.arange(N) / SR
    semis = np.zeros(N)
    if drop:
        semis = -drop * (1 - np.exp(-t / 0.035))
    if arp:
        semis = semis + np.asarray(arp, float)[((t / FRAME).astype(int) // 2) % len(arp)]
    f = hz(midi + semis)
    tb = tab_for("steptri", 0, float(f.max()), steptri_coef)
    y = read(tb, phase_of(f))
    a = uniform_filter1d((t < dur).astype(float), max(2, int(0.002 * SR)))
    return y * a * 0.6


def chip_noise(dur, vel=0.8, var=0, period=4, dec=0.08, short=False):
    """NES noise channel: LFSR bits clocked at 1.79 MHz / period, 16-level decaying volume."""
    rng = rng_for("cn", period, var, short)
    N = int(dur * SR) + int(0.005 * SR)
    rate = 1789773.0 / (16 * period)
    os_ = 4
    M = N * os_
    idx = (np.arange(M) * rate / (SR * os_)).astype(np.int64)
    if short:
        bits = rng.integers(0, 2, 93) * 2.0 - 1
        raw = bits[idx % 93]
    else:
        bits = rng.integers(0, 2, idx[-1] + 2) * 2.0 - 1
        raw = bits[idx]
    y = signal.resample_poly(raw, 1, os_)[:N]
    t = np.arange(N) / SR
    fr = (t / FRAME).astype(int)
    v = np.maximum(15 - np.arange(fr.max() + 1) * (FRAME / dec) * 15, 0)
    a = (np.round(v * (0.4 + 0.6 * vel)) / 15.0)[fr] * (t < dur)
    a = uniform_filter1d(a, max(2, int(0.001 * SR)))
    return y * a * 0.5


# ------------------------------------------------------------------ percussion
def _sweep(n, f_hi, f_lo, tau):
    t = np.arange(n) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t / tau)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def kick(vel=0.9, var=0, kind="rock"):
    rng = rng_for("kick", kind, var)
    if kind == "orch":  # concert bass drum
        n = int(0.9 * SR)
        y = _sweep(n, 70, 44, 0.05) * decay(n, 0.7) + 0.4 * _sweep(n, 110, 71, 0.05) * decay(n, 0.35)
        y += 0.5 * lp(noise(n, rng), 300) * decay(n, 0.06)
    elif kind == "synth":  # 80s electronic kick
        n = int(0.45 * SR)
        y = _sweep(n, 190, 47, 0.028) * decay(n, 0.38)
        y = np.tanh(2.2 * y) * 0.8 + 0.25 * hp(noise(n, rng), 3000) * decay(n, 0.012)
    elif kind == "stomp":  # boot on a wooden floor
        n = int(0.3 * SR)
        y = _sweep(n, 120, 62, 0.02) * decay(n, 0.18) + 0.6 * bp(noise(n, rng), 150, 900) * decay(n, 0.05)
    else:
        n = int(0.35 * SR)
        y = _sweep(n, 150, 52, 0.022) * decay(n, 0.28) + 0.3 * hp(noise(n, rng), 2000) * decay(n, 0.008)
        y += 0.2 * lp(noise(n, rng), 400) * decay(n, 0.04)
    return fade(y * (0.3 + 0.7 * vel) * 0.9, 0.0003, 0.01)


def snare(vel=0.8, var=0, kind="orch"):
    rng = rng_for("snare", kind, var)
    if kind == "orch":  # field drum: tight head, bright wires
        n = int(0.28 * SR)
        t = np.arange(n) / SR
        y = 0.6 * np.sin(2 * np.pi * 215 * t) * decay(n, 0.07) + 0.35 * np.sin(2 * np.pi * 395 * t) * decay(n, 0.05)
        y += 0.9 * bp(noise(n, rng), 1800, 9500) * decay(n, 0.2 * (0.6 + 0.4 * vel)) + 0.3 * hp(noise(n, rng), 5000) * decay(n, 0.03)
    elif kind == "gated":  # 80s snare, body and bright noise, meant for the gated reverb
        n = int(0.3 * SR)
        y = 0.8 * _sweep(n, 260, 175, 0.02) * decay(n, 0.12) + 0.9 * bp(noise(n, rng), 700, 7500) * decay(n, 0.22)
        y = np.tanh(1.5 * y)
    elif kind == "brush":
        n = int(0.2 * SR)
        y = bp(noise(n, rng), 1500, 7000) * ar(n, 0.012, 0.03, 0.15) * 0.8
    else:  # band snare
        n = int(0.24 * SR)
        t = np.arange(n) / SR
        y = 0.7 * np.sin(2 * np.pi * 190 * t) * decay(n, 0.09) + 0.3 * np.sin(2 * np.pi * 340 * t) * decay(n, 0.06)
        y += 0.8 * bp(noise(n, rng), 1200, 8000) * decay(n, 0.16)
    return fade(y * (0.15 + 0.85 * vel ** 1.3) * 0.7, 0.0003, 0.01)


def rim(vel=0.8, var=0, kind="rim"):
    rng = rng_for("rim", kind, var)
    if kind == "shot":  # the "gunshot" rimshot of the western: crack plus a dark boom
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        y = hp(noise(n, rng), 1500) * decay(n, 0.035) + 0.7 * lp(noise(n, rng), 900) * decay(n, 0.35)
        y += 0.6 * np.sin(2 * np.pi * 95 * t) * decay(n, 0.2) + 0.5 * np.sin(2 * np.pi * 1750 * t) * decay(n, 0.03)
    else:
        n = int(0.08 * SR)
        t = np.arange(n) / SR
        y = np.sin(2 * np.pi * 480 * t) * decay(n, 0.04) + 0.8 * np.sin(2 * np.pi * 1730 * t) * decay(n, 0.03)
        y += 0.5 * hp(noise(n, rng), 3000) * decay(n, 0.008)
    return fade(y * (0.2 + 0.8 * vel) * 0.7, 0.0002, 0.01)


_HATF = np.array([2057.0, 2931.0, 3719.0, 4841.0, 5413.0, 6833.0, 8121.0, 9917.0])


def hat(vel=0.7, var=0, kind="closed"):
    rng = rng_for("hat", kind, var)
    L = {"closed": 0.05, "open": 0.35, "pedal": 0.03, "ride": 0.6}[kind]
    n = int((L + 0.05) * SR)
    t = np.arange(n) / SR
    metal = sum(np.sin(2 * np.pi * f * (1 + 0.004 * var) * t + rng.random() * 6.28) for f in _HATF * (1.25 if kind == "ride" else 1.0))
    y = hp(noise(n, rng), 6500) * 0.8 + hp(metal, 5000) * 0.18
    y *= decay(n, L)
    return fade(y * (0.2 + 0.8 * vel) * 0.5, 0.0003, 0.01)


def cymbal(vel=0.8, var=0, t60=1.8):
    rng = rng_for("cym", var, t60)
    n = int((t60 + 0.1) * SR)
    t = np.arange(n) / SR
    metal = sum(np.sin(2 * np.pi * f * t + rng.random() * 6.28) * np.exp(-6.908 * t / (t60 * rng.uniform(0.3, 1.0)))
                for f in rng.uniform(900, 9000, 40))
    y = hp(noise(n, rng), 3500) * decay(n, t60 * 0.8) + 0.12 * metal + 0.5 * bp(noise(n, rng), 600, 3000) * decay(n, 0.25)
    return fade(y * (0.3 + 0.7 * vel) * 0.4, 0.0005, 0.03)


def clap(vel=0.8, var=0):
    rng = rng_for("clap", var)
    n = int(0.3 * SR)
    y = np.zeros(n)
    for i, off in enumerate((0.0, 0.011, 0.021, 0.032)):
        k = int((off + rng.uniform(0, 0.002)) * SR)
        m = n - k
        y[k:] += bp(noise(m, rng), 900, 3200) * decay(m, 0.012 if i < 3 else 0.2)
    return fade(y * (0.3 + 0.7 * vel) * 0.6, 0.0003, 0.01)


def shaker(vel=0.6, var=0):
    rng = rng_for("shk", var)
    n = int(0.09 * SR)
    y = bp(noise(n, rng), 4500, 11000) * ar(n, 0.018, 0.02, 0.06)
    return y * (0.3 + 0.7 * vel) * 0.5


def tambourine(vel=0.7, var=0):
    rng = rng_for("tamb", var)
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    j = sum(np.sin(2 * np.pi * f * t + rng.random() * 6.28) * np.exp(-6.908 * t / rng.uniform(0.06, 0.18))
            for f in rng.uniform(5500, 12500, 14))
    y = 0.12 * j + 0.5 * hp(noise(n, rng), 6000) * decay(n, 0.1) + 0.3 * bp(noise(n, rng), 300, 1200) * decay(n, 0.02)
    return fade(y * (0.3 + 0.7 * vel) * 0.6, 0.0003, 0.01)


_MEMB = [(1.0, 1.0, 1.0), (1.59, 0.5, 0.6), (2.14, 0.35, 0.45), (2.30, 0.25, 0.4), (2.65, 0.2, 0.3), (2.92, 0.15, 0.25)]


def timpani(midi, dur=1.0, vel=0.8, var=0):
    """Kettledrum: the preferred modes sit near 1 : 1.5 : 2 : 2.44, which is why it has a pitch."""
    f0 = float(hz(midi))
    rng = rng_for("timp", midi, var)
    n = int(min(dur + 0.25, 2.5) * SR)
    t = np.arange(n) / SR
    gl = 2 ** (25 * vel * np.exp(-t / 0.06) / 1200)
    y = np.zeros(n)
    for r, a, d in ((1.0, 1.0, 2.2), (1.5, 0.7, 1.4), (1.98, 0.4, 0.9), (2.44, 0.25, 0.6), (2.9, 0.12, 0.4)):
        y += a * np.sin(2 * np.pi * np.cumsum(f0 * r * gl) / SR + rng.random()) * decay(n, d)
    y += 0.7 * lp(noise(n, rng), 500) * decay(n, 0.05) + 0.15 * bp(noise(n, rng), 800, 3000) * decay(n, 0.02)
    y *= ar(n, 0.001, dur, 0.25)
    return fade(y * (0.2 + 0.8 * vel) * 0.5, 0.0005, 0.01)


def taiko(vel=0.9, var=0, kind="odaiko"):
    """odaiko: the big barrel drum. shime: the small high one. ka: stick on the rim."""
    rng = rng_for("taiko", kind, var)
    if kind == "ka":
        n = int(0.07 * SR)
        t = np.arange(n) / SR
        y = np.sin(2 * np.pi * 1150 * t) * decay(n, 0.03) + 0.6 * np.sin(2 * np.pi * 2870 * t) * decay(n, 0.02)
        y += 0.6 * hp(noise(n, rng), 2500) * decay(n, 0.006)
        return fade(y * (0.3 + 0.7 * vel) * 0.6, 0.0002, 0.01)
    f0, L, bend = (62.0, 1.3, 1.5) if kind == "odaiko" else (300.0, 0.22, 1.15)
    n = int((L + 0.1) * SR)
    t = np.arange(n) / SR
    gl = 1 + (bend - 1) * vel * np.exp(-t / 0.035)
    y = np.zeros(n)
    for r, a, d in _MEMB:
        y += a * np.sin(2 * np.pi * np.cumsum(f0 * r * gl) / SR + rng.random() * 6.28) * decay(n, L * d)
    y += 0.8 * lp(noise(n, rng), 700 if kind == "odaiko" else 2500) * decay(n, 0.05)
    y += 0.35 * bp(noise(n, rng), 1200, 4500) * decay(n, 0.012)
    return fade(np.tanh(y * 0.9) * (0.2 + 0.8 * vel) * 0.6, 0.0004, 0.02)


def woodblock(vel=0.8, var=0, f=900.0, t60=0.07):
    rng = rng_for("wb", f, var)
    n = int((t60 + 0.03) * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) * decay(n, t60) + 0.45 * np.sin(2 * np.pi * f * 2.71 * t) * decay(n, t60 * 0.5)
    y += 0.5 * hp(noise(n, rng), 3000) * decay(n, 0.004)
    return fade(y * (0.3 + 0.7 * vel) * 0.6, 0.0002, 0.008)


def tick(vel=0.8, var=0, tock=False):
    """Clock escapement: a tiny hard click with a wooden case resonance."""
    return woodblock(vel, var, f=1450.0 if tock else 2300.0, t60=0.022) + 0.0


def ratchet(dur=0.25, vel=0.8, var=0):
    rng = rng_for("rat", var, round(dur, 3))
    n = int((dur + 0.03) * SR)
    y = np.zeros(n)
    k, gap = 0, SR / 38.0
    while k < int(dur * SR):
        m = min(int(0.012 * SR), n - k)
        y[k:k + m] += bp(noise(m, rng), 1800, 5500) * decay(m, 0.008) * rng.uniform(0.7, 1.0)
        gap *= 0.985
        k += int(gap)
    return fade(y * (0.3 + 0.7 * vel) * 0.7, 0.0002, 0.008)


def anvil(vel=0.8, var=0, midi=86):
    y = bell(midi + (var % 2) * 0.3, 0.02, vel, var, kind="anvil")
    n = int(0.01 * SR)
    y[:n] += 0.5 * vel * hp(noise(n, rng_for("anv", var)), 1500) * np.linspace(1, 0, n) ** 2
    return y * 1.4


def whip(vel=0.9, var=0):
    rng = rng_for("whip", var)
    ns, nc = int(0.13 * SR), int(0.16 * SR)
    sw = noise(ns, rng)
    lo = lp(hp(sw, 400), 1500)
    hi_ = bp(sw, 2000, 7000)
    r = np.linspace(0, 1, ns)
    swoosh = (lo * (1 - r) + hi_ * r) * r ** 2.5 * 0.25
    crack = hp(noise(nc, rng), 1200) * decay(nc, 0.035)
    crack[:int(0.002 * SR)] *= 3.0
    crack += 0.3 * bp(noise(nc, rng), 500, 2500) * decay(nc, 0.1)
    return fade(np.concatenate([swoosh, crack]) * (0.3 + 0.7 * vel) * 0.7, 0.002, 0.01)


WHIP_PRE = 0.13  # the crack lands this long after the start of the sample


def steam(dur=0.4, vel=0.7, var=0, chuff=False):
    rng = rng_for("steam", var, round(dur, 3), chuff)
    n = int((dur + 0.08) * SR)
    x = noise(n, rng)
    if chuff:  # piston exhaust: lower, shorter, breathy
        y = bp(x, 900, 4200) * ar(n, 0.012, 0.02, dur) * 0.9 + 0.3 * lp(x, 300) * decay(n, 0.05)
    else:  # valve hiss
        y = (bp(x, 3500, 12000) + 0.4 * resonators(x, [(6200, 1.0, 5)])) * ar(n, 0.025, dur * 0.3, dur * 0.75)
    return fade(y * (0.3 + 0.7 * vel) * 0.4, 0.002, 0.02)


def clop(vel=0.8, var=0, hi=False):
    """Coconut-shell hoof."""
    return lp(woodblock(vel, var, f=690.0 if hi else 520.0, t60=0.05), 3500)


def revcymbal(dur=1.6, vel=0.8, var=0):
    y = cymbal(vel, var, t60=dur * 1.4)[:int(dur * SR)][::-1].copy()
    r = np.linspace(0, 1, len(y))
    return fade(y * r ** 2, 0.01, 0.004)


def riser(dur=1.6, vel=0.8, var=0):
    rng = rng_for("riser", var, round(dur, 3))
    n = int(dur * SR)
    x = noise(n, rng)
    r = np.linspace(0, 1, n)
    bands = [bp(x, f, f * 1.8) for f in (300, 700, 1600, 3600, 8000)]
    pos = r * 4
    y = sum(np.clip(1 - np.abs(pos - j), 0, 1) * b for j, b in enumerate(bands))
    return fade(y * r ** 1.5 * (0.3 + 0.7 * vel) * 0.35, 0.01, 0.004)


def impact(vel=0.9, var=0):
    rng = rng_for("impact", var)
    n = int(1.6 * SR)
    y = _sweep(n, 95, 36, 0.12) * decay(n, 1.2) + 0.8 * lp(noise(n, rng), 500) * decay(n, 0.25)
    y += 0.25 * hp(noise(n, rng), 2500) * decay(n, 0.5)
    return fade(np.tanh(1.5 * y) * (0.3 + 0.7 * vel) * 0.8, 0.0005, 0.05)


# ------------------------------------------------------------------ effects
def to_stereo(x, pan=0.0):
    if x.ndim == 2:
        if pan == 0:
            return x
        l, r = x[:, 0], x[:, 1]
        gl, gr = min(1.0, 1 - pan), min(1.0, 1 + pan)
        return np.stack([l * gl, r * gr], 1)
    ang = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(ang), x * np.sin(ang)], 1) * 1.4142


def width(x, w):
    m, s = (x[:, 0] + x[:, 1]) / 2, (x[:, 0] - x[:, 1]) / 2
    return np.stack([m + s * w, m - s * w], 1)


def make_ir(kind="hall", rt=2.0, pre=0.02, seed=1, bright=0.6, gate=0.0):
    """Synthesised stereo impulse responses. hall/room/plate: band-wise decaying noise plus early reflections.
    spring: dispersive chirped echoes. gated: flat dense burst cut off hard (the 80s snare)."""
    key = (kind, rt, pre, seed, bright, gate, SR)
    if key in _IRS:
        return _IRS[key]
    rng = np.random.default_rng(seed)
    if kind == "spring":
        n = int((rt + 0.1) * SR)
        t = np.arange(n) / SR
        ir = np.zeros((n, 2))
        for ch, gap in enumerate((0.037, 0.043)):
            k = 1
            while k * gap < rt:
                L = int(min(0.012 + 0.006 * k, 0.07) * SR)
                tt = np.arange(L) / L
                chirp = np.sin(2 * np.pi * (250 * tt + (4300 - 250) * tt ** 2 / 2) * (L / SR)) * np.sin(np.pi * tt) ** 0.5
                s = int(k * gap * SR)
                m = min(L, n - s)
                ir[s:s + m, ch] += chirp[:m] * (-1) ** k * 10 ** (-3 * k * gap / rt) / np.sqrt(L)
                k += 1
            ir[:, ch] += bp(rng.standard_normal(n), 300, 4000) * np.exp(-6.908 * t / (rt * 0.8)) * 0.004
        ir = bp(ir, 180, 4800)
    elif kind == "gated":
        n = int((gate + 0.03) * SR)
        t = np.arange(n) / SR
        e = np.exp(-t / (gate * 1.5)) * np.clip((gate + 0.02 - t) / 0.02, 0, 1) * np.clip(t / 0.004, 0, 1)
        ir = bp(rng.standard_normal((n, 2)), 250, 9000) * e[:, None]
    else:
        n = int((rt * 1.15 + pre) * SR)
        t = np.arange(n) / SR
        x = rng.standard_normal((n, 2))
        hf = bright
        bands = [(None, 250, 1.15), (250, 800, 1.0), (800, 2000, 0.9), (2000, 4500, 0.55 + 0.4 * hf),
                 (4500, 9000, 0.3 + 0.5 * hf), (9000, None, 0.15 + 0.4 * hf)]
        ir = np.zeros((n, 2))
        for lo, hi_, m in bands:
            if lo is None:
                b = lp(x, hi_, 2)
            elif hi_ is None:
                b = hp(x, lo, 2)
            else:
                b = bp(x, lo, hi_, 2)
            ir += b * np.exp(-6.908 * t / (rt * m))[:, None]
        build = {"hall": 0.03, "room": 0.006, "plate": 0.003}[kind]
        ir *= (1 - np.exp(-t / build))[:, None]
        ner = {"hall": 14, "room": 10, "plate": 0}[kind]
        span = {"hall": 0.09, "room": 0.035, "plate": 0.0}[kind]
        er = np.zeros((n, 2))
        for ch in range(2):
            for _ in range(ner):
                d = rng.uniform(0.004, span)
                er[int(d * SR), ch] += rng.choice([-1, 1]) * (1 - d / span * 0.7) * 6.0
        ir += lp(er, 6000, 1)
        if pre > 0:
            p = int(pre * SR)
            ir = np.concatenate([np.zeros((p, 2)), ir[:n - p]])
        ir = hp(ir, 90, 1)
    ir /= np.sqrt((ir ** 2).sum(0).mean())
    _IRS[key] = ir
    return ir


def convolve(x, ir):
    """Stereo in, stereo IR, same length out (tail truncated: callers leave room)."""
    n = len(x)
    out = np.empty_like(x)
    for ch in range(2):
        out[:, ch] = signal.fftconvolve(x[:, ch], ir[:, ch])[:n]
    return out


def delay_ir(time_s, fb=0.4, damp=3500.0, pingpong=True, taps=10):
    n = int(time_s * SR * (taps + 1)) + 8
    ir = np.zeros((n, 2))
    g = 1.0
    for k in range(1, taps + 1):
        s = int(round(k * time_s * SR))
        imp = np.zeros(256)
        imp[0] = g
        for _ in range(k):
            imp = lp(imp, damp, 1)
        ch = (k % 2) if pingpong else None
        m = min(256, n - s)
        if ch is None:
            ir[s:s + m, :] += imp[:m, None] * 0.7
        else:
            ir[s:s + m, ch] += imp[:m]
            ir[s:s + m, 1 - ch] += imp[:m] * 0.25
        g *= fb
    return ir


def chorus(x, rate=0.8, depth_ms=3.0, base_ms=12.0, mix=0.5):
    x = to_stereo(x) if x.ndim == 1 else x
    n = len(x)
    t = np.arange(n) / SR
    out = x * (1 - mix * 0.5)
    idx = np.arange(n, dtype=float)
    for ch, ph in ((0, 0.0), (1, np.pi / 2)):
        for j, r in enumerate((rate, rate * 1.37)):
            d = (base_ms + depth_ms * np.sin(2 * np.pi * r * t + ph + j * 2.1)) * SR / 1000.0
            out[:, ch] += mix * 0.5 * np.interp(idx - d, idx, x[:, ch], left=0.0)
    return out


def tremolo(x, rate=6.0, depth=0.5, phase=0.0):
    t = np.arange(len(x)) / SR
    g = 1 - depth * (0.5 + 0.5 * np.sin(2 * np.pi * rate * t + phase))
    return x * (g if x.ndim == 1 else g[:, None])


def saturate(x, drive=1.5, kind="tape"):
    """Soft saturation at 2x oversampling so the added harmonics do not fold back."""
    up = signal.resample_poly(x, 2, 1, axis=0)
    if kind == "tube":
        y = np.tanh(drive * up + 0.15 * drive) - np.tanh(0.15 * drive)
    else:
        y = np.tanh(drive * up)
    y = signal.resample_poly(y, 1, 2, axis=0)[:len(x)]
    return y / np.tanh(drive) if kind == "tape" else y / drive


def bitcrush_rate(x, rate):
    """Sample-and-hold to a lower rate (deliberate lo-fi; used only on noise-like chip percussion)."""
    step = max(1, int(SR / rate))
    return np.repeat(x[::step], step, axis=0)[:len(x)]


def env_follow(level_db, attack, release, block):
    """Attack/release smoothing on a block-rate dB signal (python loop at control rate)."""
    ca = np.exp(-block / (SR * attack))
    cr = np.exp(-block / (SR * release))
    out = np.empty_like(level_db)
    y = level_db[0]
    for i, v in enumerate(level_db):
        c = ca if v > y else cr
        y = c * y + (1 - c) * v
        out[i] = y
    return out


def compress(x, thresh_db=-18.0, ratio=3.0, attack=0.01, release=0.15, knee=6.0, makeup_db=0.0, key=None, block=32):
    """Feed-forward compressor. `key` (same length) side-chains it: gain follows the key, applied to x."""
    k = x if key is None else key
    mono = np.abs(k).max(1) if k.ndim == 2 else np.abs(k)
    nb = len(mono) // block
    pk = mono[:nb * block].reshape(nb, block).max(1)
    lev = 20 * np.log10(pk + 1e-9)
    over = lev - thresh_db
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 - 1 / ratio), (over + knee / 2) ** 2 / (2 * knee) * (1 - 1 / ratio)))
    gr = env_follow(gr, attack, release, block)
    g = np.interp(np.arange(len(mono)), (np.arange(nb) + 0.5) * block, 10 ** ((makeup_db - gr) / 20.0))
    return x * (g[:, None] if x.ndim == 2 else g)


def true_peak(x):
    up = signal.resample_poly(x, 4, 1, axis=0)
    return float(np.abs(up).max())


def limit(x, ceiling_db=-1.5, look_ms=6.0):
    """Look-ahead brick-wall limiter working on the 4x oversampled peak, so inter-sample peaks stay under the
    ceiling. Gain = min-filter of the needed gain, then smoothed inside that window (never rises early)."""
    c = db(ceiling_db)
    up = np.abs(signal.resample_poly(x, 4, 1, axis=0))
    if up.ndim == 2:
        up = up.max(1)
    n = len(x)
    pk = up[:n * 4].reshape(n, 4).max(1)
    pk = np.maximum(pk, np.abs(x).max(1) if x.ndim == 2 else np.abs(x))
    need = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    w = max(3, int(look_ms * SR / 1000.0)) | 1
    g = minimum_filter1d(need, size=2 * w + 1, mode="nearest")
    g = uniform_filter1d(g, size=w, mode="nearest")
    g = uniform_filter1d(g, size=w, mode="nearest")
    return x * (g[:, None] if x.ndim == 2 else g)


def _kweight(x):
    # ITU-R BS.1770 K-weighting, derived for any sample rate
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / SR)
    Vh, Vb = 10 ** (G / 20), (10 ** (G / 20)) ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a = [1.0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / SR)
    a0 = 1 + K / Q + K * K
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    return signal.lfilter(b2, a2, signal.lfilter(b, a, x, axis=0), axis=0)


def lufs(x):
    """Integrated loudness, ITU-R BS.1770-4 (gated)."""
    y = _kweight(x if x.ndim == 2 else x[:, None])
    bl, hop = int(0.4 * SR), int(0.1 * SR)
    if len(y) < bl:
        return -70.0
    cs = np.concatenate([np.zeros((1, y.shape[1])), np.cumsum(y ** 2, 0)])
    starts = np.arange(0, len(y) - bl + 1, hop)
    z = ((cs[starts + bl] - cs[starts]) / bl).sum(1)
    l = -0.691 + 10 * np.log10(z + 1e-12)
    z1 = z[l > -70]
    if len(z1) == 0:
        return -70.0
    rel = -0.691 + 10 * np.log10(z1.mean()) - 10
    z2 = z[(l > -70) & (l > rel)]
    return float(-0.691 + 10 * np.log10(z2.mean()))


def master(x, target_lufs=-16.0, ceiling_db=-1.5, glue=True, drive=1.0, measure=None):
    """Mastering chain: sub-sonic filter, gentle bus compression, tape saturation, loudness normalisation, limiter.
    `measure` is a slice of x to measure loudness on (the loop body for looping files)."""
    x = hp(x, 24, 2)
    sl = measure if measure is not None else slice(None)
    if glue:
        l0 = lufs(x[sl])
        x = compress(x, thresh_db=l0 + 6.0, ratio=2.0, attack=0.03, release=0.25, knee=8.0)
    g = db(target_lufs - lufs(x[sl]))
    y = x
    for _ in range(4):
        y = saturate(x * g * 0.5 * drive, 1.0, "tape") / (0.5 * drive) if drive else x * g
        y = limit(y, ceiling_db)
        err = target_lufs - lufs(y[sl])
        if abs(err) < 0.05:
            break
        g *= db(err)
    return y
