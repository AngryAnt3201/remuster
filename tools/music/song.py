"""The Remuster theme, as data. Every arranger plays this, so a cut between styles on a bar line keeps the tune.

Key: D minor (natural minor, with the raised 7th C# only over the dominant A chord).
Tempo: 144 BPM, 4/4. One bar = 1.6667 s.
Form: 16 bars = A (8 bars, antecedent ends on the dominant, consequent ends on the tonic) + B (8 bars, lifts to the
relative major, ends on the dominant to lead back).

Hooks:
  A: "da-da DAAH da dum": two eighths rising into a dotted quarter (A D F. E D), sequenced upward bar by bar.
  B: a 3+3+2 tresillo (dotted quarter, dotted quarter, quarter) on chord tones, peaking on the high D in bar 13.
"""
from dataclasses import dataclass, field

BPM = 144
BEATS = 4
KEY = "D minor"

# pitch helpers ---------------------------------------------------------------
_PC = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "Bb": 10, "B": 11}
_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"]


def n(name):
    """'D5' -> 74 (C4 = 60)."""
    return _PC[name[:-1]] + 12 * (int(name[-1]) + 1)


def name(midi):
    return f"{_NAMES[midi % 12]}{midi // 12 - 1}"


@dataclass(frozen=True)
class Chord:
    sym: str
    root: int       # pitch class
    tones: tuple    # pitch classes: root, third, fifth (+ seventh)

    def bass(self, lo=31):
        """Root as a midi note, the lowest one at or above `lo`."""
        return lo + (self.root - lo) % 12

    def voicing(self, lo, hi, n_tones=3):
        """Chord tones (root, 3rd, 5th) between lo and hi, ascending."""
        return [m for m in range(lo, hi + 1) if m % 12 in self.tones[:n_tones]]

    def near(self, midi, n_tones=3):
        c = [m for m in range(midi - 7, midi + 8) if m % 12 in self.tones[:n_tones]]
        return min(c, key=lambda m: (abs(m - midi), m))

    @property
    def third(self):
        return self.tones[1]

    @property
    def fifth(self):
        return self.tones[2]


CH = {
    "Dm": Chord("Dm", 2, (2, 5, 9)),
    "Bb": Chord("Bb", 10, (10, 2, 5)),
    "C": Chord("C", 0, (0, 4, 7)),
    "A": Chord("A", 9, (9, 1, 4, 7)),
    "F": Chord("F", 5, (5, 9, 0)),
    "Gm": Chord("Gm", 7, (7, 10, 2)),
    "D": Chord("D", 2, (2, 6, 9)),
}

CHORDS = ["Dm", "Bb", "C", "A", "Dm", "Bb", "C", "Dm",
          "F", "C", "Gm", "Dm", "Bb", "F", "Gm", "A"]

# (beat in bar, length in beats, pitch), one list per bar ----------------------
_M = lambda *xs: [(b, d, n(p)) for b, d, p in xs]
MELODY = [
    _M((0, .5, "A4"), (.5, .5, "D5"), (1, 1.5, "F5"), (2.5, .5, "E5"), (3, 1, "D5")),       # 1  Dm
    _M((0, .5, "Bb4"), (.5, .5, "D5"), (1, 1.5, "G5"), (2.5, .5, "F5"), (3, 1, "D5")),      # 2  Bb
    _M((0, .5, "G5"), (.5, .5, "G5"), (1, 1.5, "A5"), (2.5, .5, "G5"), (3, 1, "E5")),       # 3  C
    _M((0, .5, "E5"), (.5, .5, "F5"), (1, 1, "E5"), (2, 2, "C#5")),                         # 4  A   (half cadence)
    _M((0, .5, "A4"), (.5, .5, "D5"), (1, 1.5, "F5"), (2.5, .5, "E5"), (3, 1, "D5")),       # 5  Dm
    _M((0, .5, "Bb4"), (.5, .5, "D5"), (1, 1.5, "G5"), (2.5, .5, "F5"), (3, 1, "D5")),      # 6  Bb
    _M((0, .5, "E5"), (.5, .5, "G5"), (1, 1.5, "C6"), (2.5, .5, "A5"), (3, 1, "G5")),       # 7  C
    _M((0, .5, "F5"), (.5, .5, "E5"), (1, 3, "D5")),                                        # 8  Dm  (full cadence)
    _M((0, 1.5, "A5"), (1.5, 1.5, "C6"), (3, 1, "A5")),                                     # 9  F
    _M((0, 1.5, "G5"), (1.5, 1.5, "E5"), (3, 1, "G5")),                                     # 10 C
    _M((0, 1.5, "Bb5"), (1.5, 1.5, "G5"), (3, 1, "Bb5")),                                   # 11 Gm
    _M((0, 2, "A5"), (2, .5, "F5"), (2.5, .5, "G5"), (3, 1, "A5")),                         # 12 Dm
    _M((0, 1.5, "Bb5"), (1.5, 1.5, "D6"), (3, 1, "Bb5")),                                   # 13 Bb  (peak)
    _M((0, 1.5, "A5"), (1.5, 1.5, "C6"), (3, 1, "A5")),                                     # 14 F
    _M((0, .5, "G5"), (.5, .5, "A5"), (1, 1, "Bb5"), (2, 1, "A5"), (3, 1, "G5")),           # 15 Gm
    _M((0, 1.5, "A5"), (1.5, .5, "G5"), (2, 1, "F5"), (3, 1, "E5")),                        # 16 A7  (leads back)
]

COUNTER = [
    _M((0, 3, "D4"), (3, 1, "F4")),
    _M((0, 3, "F4"), (3, 1, "D4")),
    _M((0, 3, "E4"), (3, 1, "G4")),
    _M((0, 2, "A4"), (2, .5, "E4"), (2.5, .5, "F4"), (3, .5, "G4"), (3.5, .5, "A4")),
    _M((0, 3, "D4"), (3, 1, "F4")),
    _M((0, 3, "F4"), (3, 1, "D4")),
    _M((0, 3, "G4"), (3, 1, "E4")),
    _M((0, 1, "A3"), (1, .5, "D4"), (1.5, .5, "F4"), (2, 1, "A4"), (3, 1, "F4")),
    _M((0, 3, "F4"), (3, 1, "A4")),
    _M((0, 3, "E4"), (3, 1, "G4")),
    _M((0, 3, "D4"), (3, 1, "G4")),
    _M((0, 2, "F4"), (2, 2, "D4")),
    _M((0, 3, "D4"), (3, 1, "F4")),
    _M((0, 3, "C4"), (3, 1, "F4")),
    _M((0, 2, "Bb3"), (2, 2, "D4")),
    _M((0, 2, "C#4"), (2, 1, "E4"), (3, 1, "A4")),
]

# The rhythmic motif every style builds its groove on: a gallop (eighth + two sixteenths) per beat,
# and the B section's tresillo accents.
GALLOP = [(0.0, 1.0), (0.5, 0.55), (0.75, 0.7)]          # (offset in beat, accent)
TRESILLO = [0.0, 1.5, 3.0]

# video tag (bar 47) and one-shots
TAG = _M((0, .5, "D5"), (.5, .5, "F5"), (1, 1, "Bb5"), (2, .5, "E5"), (2.5, .5, "G5"), (3, 1, "C6"))
WIN = _M((0, .5, "A4"), (.5, .5, "D5"), (1, 1, "F5"), (2, 1, "G5"), (3, 4.5, "A5"))
LOSE = _M((0, .5, "F5"), (.5, .5, "E5"), (1, 1, "D5"), (2, 1, "Bb4"), (3, 1, "A4"), (4, 3.5, "D4"))

HIRAJOSHI = (2, 4, 5, 9, 10)   # D E F A Bb: a subset of D minor, so Inkfall stays compatible


@dataclass
class Form:
    kind: str                 # home, battle, boss, video, win, lose
    bars: int
    spans: list               # (beat, beats, Chord): the harmony
    energy: list              # per bar, 0 (break) .. 5 (everything)
    sec: list                 # per bar section label: intro, A, B, break, end
    mel: list = field(default_factory=list)   # (beat, beats, midi, bar)
    ctr: list = field(default_factory=list)
    src: list = field(default_factory=list)   # per bar: theme bar index (0..15) or None
    loop: bool = True
    tail: float = 0.0         # seconds of ring-out after the last bar (one-shots, video)
    half: bool = False        # half-time: the tune is stretched to twice its length
    dark: bool = False        # boss colour
    sections: list = field(default_factory=list)  # (label, first bar, bars)

    def chord_at(self, beat):
        beat = beat % (self.bars * BEATS) if self.loop else min(beat, self.bars * BEATS - 0.001)
        for b, d, c in self.spans:
            if b <= beat < b + d:
                return c
        return self.spans[-1][2]

    def chord_bar(self, bar):
        return self.chord_at(bar * BEATS)

    def first(self, bar):
        """Is this the first bar of its section?"""
        return any(s == bar for _, s, _ in self.sections)

    def last(self, bar):
        """Is this the last bar of its section (where fills go)?"""
        return any(s + k - 1 == bar for _, s, k in self.sections)

    def pos(self, bar):
        for _, s, k in self.sections:
            if s <= bar < s + k:
                return bar - s
        return 0

    def mel_in(self, pred):
        """Melody notes whose bar satisfies pred(bar)."""
        return [(b, d, m) for b, d, m, bar in self.mel if pred(bar)]

    def ctr_in(self, pred):
        return [(b, d, m) for b, d, m, bar in self.ctr if pred(bar)]


def _build(kind, plan, half=False, **kw):
    """plan: list of (label, [theme bar or chord symbol, ...], energy)."""
    stretch = 2 if half else 1
    spans, energy, sec, mel, ctr, src, sections = [], [], [], [], [], [], []
    bar = 0
    for label, items, e in plan:
        sections.append((label, bar, len(items) * stretch))
        for it in items:
            beat0 = bar * BEATS
            if isinstance(it, int):
                spans.append((beat0, BEATS * stretch, CH[CHORDS[it]]))
                for b, d, m in MELODY[it]:
                    mel.append((beat0 + b * stretch, d * stretch, m, bar + int(b * stretch) // BEATS))
                for b, d, m in COUNTER[it]:
                    ctr.append((beat0 + b * stretch, d * stretch, m, bar + int(b * stretch) // BEATS))
            else:
                spans.append((beat0, BEATS * stretch, CH[it]))
            for _ in range(stretch):
                energy.append(e)
                sec.append(label)
                src.append(it if isinstance(it, int) else None)
            bar += stretch
    return Form(kind, bar, spans, energy, sec, mel, ctr, src, half=half, sections=sections, **kw)


A, B = list(range(0, 8)), list(range(8, 16))


def battle():
    return _build("battle", [("A", A, 3), ("A", A, 4), ("B", B, 4), ("A", A, 5)])


def boss():
    return _build("boss", [("A", A, 4), ("B", B, 5), ("A", A, 5), ("B", B, 5)], dark=True)


def home():
    return _build("home", [("A", A, 1), ("B", B, 2)], half=True)


VIDEO_SECTIONS = [("intro", 0, 4), ("A", 4, 8), ("B", 12, 8), ("A2", 20, 8), ("B2", 28, 8), ("break", 36, 2),
                  ("final", 38, 8), ("end", 46, 2)]


def video():
    f = _build("video", [("intro", ["Dm", "Dm", "Bb", "A"], 1), ("A", A, 2), ("B", B, 3), ("A", A, 4), ("B", B, 5),
                         ("break", [1, 3], 0), ("A", A, 5), ("end", ["Bb", "Dm"], 5)], loop=False, tail=3.2)
    # bar 46: Bb for two beats then C; the tag melody climbs into the final held D
    b46 = 46 * BEATS
    f.spans = [s for s in f.spans if s[0] < b46] + [(b46, 2, CH["Bb"]), (b46 + 2, 2, CH["C"]), (b46 + 4, 4, CH["Dm"])]
    f.mel += [(b46 + b, d, m, 46) for b, d, m in TAG] + [(b46 + 4, 7.0, n("D6"), 47)]
    return f


def win():
    f = Form("win", 2, [(0, 1, CH["Dm"]), (1, 1, CH["Bb"]), (2, 1, CH["C"]), (3, 5, CH["D"])], [5, 5], ["end", "end"],
             loop=False, tail=0.55, sections=[("end", 0, 2)], src=[None, None])
    f.mel = [(b, d, m, int(b) // BEATS) for b, d, m in WIN]
    return f


def lose():
    f = Form("lose", 2, [(0, 2, CH["Dm"]), (2, 1, CH["Gm"]), (3, 1, CH["A"]), (4, 4, CH["Dm"])], [3, 3], ["end", "end"],
             loop=False, tail=0.55, sections=[("end", 0, 2)], src=[None, None], dark=True)
    f.mel = [(b, d, m, int(b) // BEATS) for b, d, m in LOSE]
    return f


FORMS = {"home": home, "battle": battle, "boss": boss, "video": video, "win": win, "lose": lose}


def to_scale(notes, scale=HIRAJOSHI):
    """Re-map a line onto a pentatonic scale, keeping the contour: nearest scale tone, ties broken in the
    direction the line was moving, never collapsing a step into a repeated note if it can be avoided."""
    out = []
    prev_src = prev = None
    for (b, d, m, *rest) in notes:
        cands = sorted((abs(c - m), c) for c in range(m - 3, m + 4) if c % 12 in scale)
        best = [c for dist, c in cands if dist == cands[0][0]]
        pick = best[0]
        if len(best) > 1 and prev_src is not None:
            up = m >= prev_src
            pick = max(best) if up else min(best)
        if prev is not None and prev_src != m and pick == prev:
            alt = [c for _, c in cands if c != prev and abs(c - m) <= 2]
            if alt:
                want_up = m > prev_src
                alt.sort(key=lambda c: ((c > prev) != want_up, abs(c - m)))
                pick = alt[0]
        out.append((b, d, pick, *rest))
        prev_src, prev = m, pick
    return out


def describe():
    lines = [f"Key {KEY}, {BPM} BPM, 4/4, 16 bars (A 1-8, B 9-16)"]
    for i, bar in enumerate(MELODY):
        lines.append(f"  bar {i + 1:2d} [{CHORDS[i]:2s}] " + " ".join(f"{name(m)}({d:g})" for _, d, m in bar))
    return "\n".join(lines)


if __name__ == "__main__":
    print(describe())
