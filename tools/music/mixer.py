"""Session: schedules notes, renders parts, mixes with sends, masters, and cuts seamless loops.

A looping session is rendered as a circular buffer (anything that rings past the end is folded back onto the start),
tiled, pushed through every effect and the master chain as one long signal, and the SECOND pass is cut out with half
a second of wrap-around on each side. So the reverb tail of the last bar is under the first bar, the compressor and
limiter are in steady state, and the file is periodic with period = loop length.
"""
import numpy as np
import synth as S

PAD = 0.5          # seconds of wrap-around on each side of a looping file
_NOTE_CACHE = {}
_PITCH_LOG = []    # (session label, part, midi, measured cents) filled for parts added with check=True


def clear_cache():
    _NOTE_CACHE.clear()


class Session:
    def __init__(self, form, sr=44100, seed=7, target=-16.0, ceiling=-2.0, label=""):
        from song import BPM, BEATS
        S.set_sr(sr) if S.SR != sr else None
        self.form = form
        self.sr = sr
        self.beat = 60.0 / BPM
        self.loop = form.loop
        self.n = int(round(form.bars * BEATS * self.beat * sr))
        self.tail = int(form.tail * sr)
        self.seed = seed
        self.target = target
        self.ceiling = ceiling
        self.label = label
        self.parts = []
        self.reverb = ("hall", dict(rt=1.8, pre=0.02, bright=0.5))
        self.reverb2 = None
        self.rev_gain = 1.0
        self.delay = None            # (beats, feedback, damp)
        self.pump_beats = []         # kick times that duck parts with duck > 0
        self.pump_depth = 0.6
        self.pump_len = 0.9          # in beats
        self.master_eq = []
        self.drive = 1.0
        self.pitch_report = []

    # -- scheduling ---------------------------------------------------------------------------------------------
    def add(self, name, fn, notes, kw=None, level=-20.0, peak=None, pan=0.0, rev=0.0, rev2=0.0, dly=0.0, eq=None,
            fx=None, human=(0.006, 0.07), duck=0.0, wide=None, pitched=True, check=False, transpose=0):
        """notes: (beat, beats, midi, vel[, per-note kwargs]) for pitched parts, (beat, vel[, kwargs]) for drums.
        level: RMS (dBFS) of the part while it is playing. peak: use a peak target instead (drums)."""
        if not notes:
            return
        self.parts.append(dict(name=name, fn=fn, notes=list(notes), kw=kw or {}, level=level, peak=peak, pan=pan,
                               rev=rev, rev2=rev2, dly=dly, eq=eq or [], fx=fx or [], human=human, duck=duck, wide=wide,
                               pitched=pitched, check=check, transpose=transpose))

    def _render_part(self, p):
        sr = self.sr
        rng = S.rng_for("part", self.seed, p["name"])
        over = int(8.0 * sr)
        total = self.n + (over if self.loop else self.tail)
        buf = None
        tj, vj = p["human"]
        for note in p["notes"]:
            if p["pitched"]:
                beat, beats, midi, vel = note[:4]
                extra = note[4] if len(note) > 4 else {}
                midi = midi + p["transpose"]
            else:
                beat, vel = note[:2]
                extra = note[2] if len(note) > 2 else {}
            vel = float(np.clip(vel * (1 + vj * np.clip(rng.standard_normal(), -2, 2)), 0.05, 1.0))
            vq = round(vel * 24) / 24
            var = int(rng.integers(0, 3))
            jit = tj * float(np.clip(rng.standard_normal(), -2, 2))
            kw = dict(p["kw"], **extra)
            if p["pitched"]:
                dur = beats * self.beat
                key = (p["fn"].__name__, midi, round(dur, 4), vq, var, repr(sorted(kw.items())), sr)
            else:
                key = (p["fn"].__name__, vq, var, repr(sorted(kw.items())), sr)
            y = _NOTE_CACHE.get(key)
            if y is None:
                y = p["fn"](midi, dur, vq, var, **kw) if p["pitched"] else p["fn"](vq, var, **kw)
                if len(_NOTE_CACHE) > 20000:
                    _NOTE_CACHE.clear()
                _NOTE_CACHE[key] = y
            if p["check"] and p["pitched"] and not any(k in kw for k in ("bend", "slide", "arp", "fall")):
                import check
                self.pitch_report.append((p["name"], midi, check.note_cents(y, float(S.hz(midi)), dur, sr), dur))
            pre = kw.get("pre", 0.0)   # samples that lead into the hit (whip swoosh, reverse cymbal)
            start = int(round((beat * self.beat + jit - pre) * sr))
            if self.loop:
                start %= self.n
            else:
                start = max(0, start)
            if buf is None:
                buf = np.zeros((total, 2)) if y.ndim == 2 else np.zeros(total)
            if y.ndim == 2 and buf.ndim == 1:
                buf = np.stack([buf, buf], 1)
            if y.ndim == 1 and buf.ndim == 2:
                y = np.stack([y, y], 1)
            m = min(len(y), total - start)
            if m > 0:
                buf[start:start + m] += y[:m]
        if self.loop:
            buf[:over] += buf[self.n:self.n + over]
            buf = buf[:self.n]
        return buf

    def _level(self, buf, p):
        mono = buf if buf.ndim == 1 else np.abs(buf).max(1)
        if p["peak"] is not None:
            return S.db(p["peak"]) / (np.abs(mono).max() + 1e-12)
        bl = int(0.05 * self.sr)
        nb = len(mono) // bl
        ms = (mono[:nb * bl].reshape(nb, bl) ** 2).mean(1)
        act = ms[ms > ms.max() * 1e-3]
        return S.db(p["level"]) / (np.sqrt(act.mean()) + 1e-12)

    def _pump(self, total):
        g = np.ones(total)
        if not self.pump_beats:
            return g
        L = int(self.pump_len * self.beat * self.sr)
        t = np.arange(L) / L
        shape = 1 - self.pump_depth * (1 - t) ** 2.2 * np.clip(t / 0.02, 0, 1)
        reps = 3 if self.loop else 1
        for r in range(reps):
            for b in self.pump_beats:
                s = int(round(b * self.beat * self.sr)) + r * self.n
                m = min(L, total - s)
                if m > 0 and s >= 0:
                    g[s:s + m] = np.minimum(g[s:s + m], shape[:m])
        return g

    # -- render ----------------------------------------------------------------------------------------------------
    def render(self, solo=None, master=True):
        sr = self.sr
        if S.SR != sr:
            S.set_sr(sr)
        pad = int(PAD * sr)
        total = (2 * self.n + 2 * pad + sr // 4) if self.loop else (self.n + self.tail)
        dry = np.zeros((total, 2))
        sends = {"rev": np.zeros((total, 2)), "rev2": np.zeros((total, 2)), "dly": np.zeros((total, 2))}
        pump = self._pump(total)
        self.stems = {}
        for p in self.parts:
            if solo and p["name"] not in solo:
                continue
            buf = self._render_part(p)
            buf = buf * self._level(buf, p)
            if self.loop:
                reps = total // self.n + 1
                buf = np.concatenate([buf] * reps)[:total]
            buf = S.eq(buf, p["eq"])
            for f in p["fx"]:
                buf = f(buf)
            buf = S.to_stereo(buf, p["pan"])
            if p["wide"] is not None:
                buf = S.width(buf, p["wide"])
            if p["duck"]:
                buf = buf * (pump ** p["duck"])[:, None]
            dry += buf
            for k in sends:
                if p[k]:
                    sends[k] += buf * p[k]
        out = dry
        if np.abs(sends["rev"]).max() > 0:
            kind, kw = self.reverb
            out = out + S.hp(S.convolve(sends["rev"], S.make_ir(kind, **kw)), 140, 1) * self.rev_gain
        if self.reverb2 and np.abs(sends["rev2"]).max() > 0:
            kind, kw = self.reverb2
            out = out + S.hp(S.convolve(sends["rev2"], S.make_ir(kind, **kw)), 120, 1)
        if self.delay and np.abs(sends["dly"]).max() > 0:
            beats, fb, damp = self.delay
            out = out + S.hp(S.convolve(sends["dly"], S.delay_ir(beats * self.beat, fb, damp)), 200, 1)
        self.pre = S.eq(out, self.master_eq)
        return self.finish() if master else self.pre

    def finish(self, ceiling=None):
        """Master the mixed signal and cut the file (second pass plus wrap-around for loops)."""
        sr = self.sr
        if S.SR != sr:
            S.set_sr(sr)
        pad = int(PAD * sr)
        meas = slice(self.n, 2 * self.n) if self.loop else slice(None)
        out = S.master(self.pre, self.target, self.ceiling if ceiling is None else ceiling, drive=self.drive, measure=meas)
        if self.loop:
            out = out[self.n - pad:2 * self.n + pad]
        else:
            nf = int(0.25 * sr)
            out[-nf:] *= np.linspace(1, 0, nf)[:, None] ** 2
        return out

    @property
    def loop_seconds(self):
        return self.n / self.sr if self.loop else 0.0
