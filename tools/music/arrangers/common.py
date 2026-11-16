"""Pattern helpers shared by the arrangers. Notes are (beat, beats, midi, vel[, kwargs]); hits are (beat, vel[, kwargs])."""
from song import BEATS, GALLOP, TRESILLO  # noqa: F401  (re-exported)

D_MINOR = (2, 4, 5, 7, 9, 10, 0)


def body(F, lo=0, hi=9, sec=None):
    """(bar, first beat, chord, energy) for every bar outside the ending whose energy is in [lo, hi]."""
    for b in range(F.bars):
        if F.sec[b] == "end" or not (lo <= F.energy[b] <= hi) or (sec and F.sec[b] not in sec):
            continue
        yield b, b * BEATS, F.chord_bar(b), F.energy[b]


def end_spans(F):
    """(beat, beats, chord, is_last) for the harmony of the ending (video tag, win and lose stingers)."""
    sp = [(b, d, c) for b, d, c in F.spans if F.sec[min(int(b) // BEATS, F.bars - 1)] == "end"]
    return [(b, d, c, i == len(sp) - 1) for i, (b, d, c) in enumerate(sp)]


def tune(notes, base=0.7, tr=0, legato=0.96, kw=None):
    """Give a line velocities: downbeats and long notes lean in. Accepts (beat, beats, midi[, bar])."""
    out = []
    for b, d, m, *_ in notes:
        v = base + (0.08 if d >= 1 else 0) + (0.06 if b % BEATS == 0 else 0) + (0.04 if b % 1 == 0 else 0)
        out.append((b, d * legato, m + tr, min(1.0, v)) + ((kw,) if kw else ()))
    return out


def voice(ch, center, n=3, n_tones=3):
    """n chord tones closest to `center`, ascending (a close-position voicing that moves little bar to bar)."""
    c = sorted(ch.voicing(center - 14, center + 14, n_tones), key=lambda m: (abs(m - center), m))[:n]
    return sorted(c)


def pad(F, bars, center, n=3, vel=0.6, n_tones=3, beats=BEATS, legato=0.98):
    """Held chords, one per bar."""
    out = []
    for b, b0, ch, e in bars:
        for m in voice(ch, center, n, n_tones):
            out.append((b0, beats * legato, m, vel))
    return out


def gallop(b0, beats=(0, 1, 2, 3), accent=()):
    """The motif rhythm as (beat, accent) pairs."""
    return [(b0 + k + o, a * (1.25 if k in accent and o == 0 else 1.0)) for k in beats for o, a in GALLOP]


def roll(start, end, step=0.25, v0=0.25, v1=0.95):
    k = int(round((end - start) / step))
    return [(start + i * step, v0 + (v1 - v0) * (i / max(k - 1, 1)) ** 1.5) for i in range(k)]


def arp(ch, lo, hi, order, b0, step=0.5, count=8, dur=None, vel=0.6, accent=0.12):
    tones = ch.voicing(lo, hi)
    out = []
    for i in range(count):
        m = tones[order[i % len(order)] % len(tones)]
        out.append((b0 + i * step, dur or step, m, vel + (accent if i % (1 / step * 1) == 0 else 0)))
    return out


def run(lo, hi, start, end, scale=D_MINOR, vel=(0.4, 0.8), dur=None):
    """A scale run from lo to hi fitted between two beats (harp gliss, flourish)."""
    ms = [m for m in (range(lo, hi + 1) if hi >= lo else range(lo, hi - 1, -1)) if m % 12 in scale]
    step = (end - start) / len(ms)
    return [(start + i * step, dur or step * 1.5, m, vel[0] + (vel[1] - vel[0]) * i / max(len(ms) - 1, 1)) for i, m in enumerate(ms)]


def sec_is(F, *names):
    return lambda b: F.sec[b] in names


def has_tune(F, b):
    return F.src[b] is not None or F.sec[b] == "end"
