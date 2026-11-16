"""Inkfall: feudal Japan in ink wash. The tune is re-mapped onto D hirajoshi (D E F A Bb, a subset of D minor) and the
harmony thinned to open fifths on roots inside the scale, so a cut from any other style lands on compatible notes.
Koto carries A, shakuhachi answers in B, shamisen drives the gallop, a bass koto marks the roots, taiko (odaiko, shime,
rim clicks) is the engine; a gong opens the big sections."""
import synth as S
from song import to_scale, HIRAJOSHI
from .common import BEATS, body, end_spans, tune, gallop, roll, run

NAME = "ink"

# chord symbol -> (root, second note) as pitch classes inside the scale
DYAD = {"Dm": (2, 9), "D": (2, 9), "Bb": (10, 5), "C": (9, 4), "A": (9, 4), "F": (5, 9), "Gm": (10, 5)}


def _up(pc, lo):
    return lo + (pc - lo) % 12


def arrange(X, F):
    X.reverb = ("hall", dict(rt=1.7, pre=0.015, bright=0.4, seed=61))
    X.master_eq = [("loshelf", 160, 2.5, 0.7), ("peak", 3600, -3.0, 1.0)]
    calm, dark = F.kind == "home", F.dark
    E, sec = F.energy, F.sec
    is_b = lambda b: sec[b] == "B"
    main = lambda b: sec[b] != "end"
    mel = to_scale(F.mel)
    ctr = to_scale(F.ctr)
    pick = lambda notes, pred: [(b, d, m) for b, d, m, bar in notes if pred(bar)]

    def koto_line(notes, base=0.8, tr=0):
        out = []
        for b, d, m, v in tune(notes, base, tr, legato=1.0):
            kw = {}
            if d >= 1.5:
                kw = dict(yuri=True)
            out.append((b, d, m, v, kw))
            if d >= 1.0 and b % 1 == 0 and not calm:   # grace note from the scale tone below
                g = max(c for c in range(m - 5, m) if c % 12 in HIRAJOSHI)
                out.append((b - 0.12, 0.12, g, v * 0.55, {}))
        return out

    def shaku_line(notes, base=0.75, tr=-12):
        seq = tune(notes, base, tr, legato=0.97)
        out = []
        for i, (b, d, m, v) in enumerate(seq):
            gap = i + 1 == len(seq) or seq[i + 1][0] - (b + d) > 0.5
            out.append((b, d, m, v, dict(fall=-60.0) if gap and d >= 1 else {}))
        return out

    # ---- the tune
    kb = lambda b: main(b) and ((not is_b(b) and E[b] >= 2 and not calm) or (calm and is_b(b)) or (E[b] >= 5))
    X.add("koto", S.koto, koto_line(pick(mel, kb), 0.82, -12 if dark else 0), level=-17, pan=-0.2, rev=0.3, check=True, human=(0.006, 0.07))
    X.add("koto_low", S.koto, tune(pick(mel, lambda b: main(b) and E[b] >= 4 and not is_b(b)), 0.7, -12 if not dark else -24), level=-22,
          pan=-0.35, rev=0.3)
    sb = lambda b: main(b) and ((is_b(b) and E[b] >= 2 and not calm) or E[b] == 0 or (calm and not is_b(b)) or dark)
    X.add("shakuhachi", S.flute, shaku_line(pick(mel, sb)), kw=dict(kind="shaku"), level=-17, pan=0.2, rev=0.5, check=True)
    X.add("shakuhachi_counter", S.flute, shaku_line(pick(ctr, lambda b: main(b) and ((E[b] >= 4 and not is_b(b) and not dark) or (calm and is_b(b)))), 0.6, 0),
          kw=dict(kind="shaku"), level=-22, pan=0.3, rev=0.5)
    X.add("shamisen_tune", S.shamisen, tune(pick(mel, lambda b: main(b) and E[b] >= 5 and not is_b(b)), 0.8, -12), level=-21, pan=0.35, rev=0.2)

    sham, bko, oda, shi, ka, kane, gong, arp, swp, hyo = ([] for _ in range(10))
    for b, b0, ch, e in body(F):
        last, first = F.last(b), F.first(b)
        r_pc, s_pc = DYAD[ch.sym]
        r = _up(r_pc, 45)                 # A2..G#3
        s = _up(s_pc, r)
        if calm:
            tones = sorted({_up(r_pc, 50), _up(s_pc, 50), _up(r_pc, 62), _up(s_pc, 62), _up(r_pc, 74)})
            arp += [(b0 + k * 1.0, 2.0, tones[[0, 2, 3, 1][k] % len(tones)], 0.55) for k in range(4)]
            bko.append((b0, 3.5, _up(r_pc, 33), 0.7))
            if b % 4 == 0:
                oda.append((b0, 0.45))
            if b % 8 == 6:
                kane.append((b0 + 2, 0.5, 86, 0.4))
            continue
        # shamisen: the gallop on an open fifth
        if e >= 3 or e == 1:
            for t, a in gallop(b0):
                o = (t - b0) % 1
                m = r + 12 if o == 0 else (s + 12 if o == 0.5 else r + 24)
                if dark:
                    m -= 12
                sham.append((t, 0.4 if o == 0 else 0.2, m, 0.5 + 0.35 * a, dict(slide=-40.0) if o == 0 and (t - b0) % 2 == 0 else {}))
        elif e == 2:
            sham += [(b0 + k, 0.8, (r + 12, s + 12, r + 24, s + 12)[k], 0.7) for k in range(4)]
        # bass koto on the roots
        if e >= 2:
            bko += [(b0, 2.3, _up(r_pc, 33), 0.9), (b0 + 2.5, 1.4, _up(r_pc, 33) + (12 if e >= 4 else 0), 0.7)]
        else:
            bko.append((b0, 3.8, _up(r_pc, 33), 0.8))
        # taiko
        if e >= 3:
            oda += [(b0, 1.0), (b0 + 2, 0.8)] + ([(b0 + 2.5, 0.55), (b0 + 2.75, 0.65)] if e >= 5 or dark else []) + ([(b0 + 1.5, 0.6)] if dark else [])
            if not last:
                shi += [(t, 0.75 * a) for t, a in gallop(b0)] if e >= 4 else [(b0 + k * 0.5, 0.75 if k % 2 == 0 else 0.5) for k in range(8)]
                if dark:
                    shi += [(b0 + k + 0.25, 0.4) for k in range(4)]
            else:
                shi += [(t, 0.7 * a) for t, a in gallop(b0, beats=(0, 1))]
                oda += roll(b0 + 2, b0 + 4, 0.25, 0.35, 1.0)
            ka += [(b0 + 1, 0.7), (b0 + 3, 0.8)] + ([(b0 + 1.5, 0.5), (b0 + 3.5, 0.5)] if e >= 4 else [])
        elif e == 2:
            oda += [(b0, 0.8)]
            ka += [(b0 + 2, 0.6), (b0 + 3, 0.5), (b0 + 3.5, 0.5)]
        elif e == 1:
            oda += [(b0, 0.9)]
            if last:  # hyoshigi: clappers accelerating into the tune
                hyo += [(b0 + t, 0.5 + 0.12 * i) for i, t in enumerate([0, 1.0, 1.75, 2.35, 2.8, 3.15, 3.4, 3.6, 3.75, 3.88])]
            else:
                ka += [(b0 + 2, 0.6), (b0 + 3, 0.6)]
        else:
            if last:
                hyo += [(b0 + t, 0.45 + 0.1 * i) for i, t in enumerate([0, 1.0, 1.75, 2.35, 2.8, 3.15, 3.4, 3.6, 3.75, 3.88])]
                oda += roll(b0 + 3, b0 + 4, 0.25, 0.5, 0.95)
            arp += [(b0 + k * 0.125, 1.5, _up(r_pc, 62), 0.3 + 0.03 * k) for k in range(8)]   # koto tremolo
        if e >= 5:
            kane += [(b0 + k + 0.5, 0.3, 86, 0.6) for k in range(4)]
        if first and (e >= 4 or e == 1) :
            gong.append((b0, 1.0, 38, 0.85))
        if last and e >= 2:
            swp += run(86, 62, b0 + 3, b0 + 4, scale=HIRAJOSHI, vel=(0.75, 0.45), dur=0.6)

    X.add("shamisen", S.shamisen, sham, level=-20, pan=0.4, rev=0.2, human=(0.005, 0.08))
    X.add("bass_koto", S.koto, bko, level=-17 if not calm else -15, pan=-0.05, rev=0.2)
    X.add("koto_arp", S.koto, arp, level=-21 if calm else -24, pan=-0.4, rev=0.35)
    X.add("koto_sweep", S.koto, swp, level=-23, pan=-0.45, rev=0.35)
    X.add("odaiko", S.taiko, oda, peak=-6 if not calm else -11, pan=0.0, rev=0.3, pitched=False, human=(0.004, 0.06))
    X.add("shime", S.taiko, shi, kw=dict(kind="shime"), peak=-14, pan=-0.3, rev=0.25, pitched=False, human=(0.004, 0.08))
    X.add("ka", S.taiko, ka, kw=dict(kind="ka"), peak=-19, pan=0.3, rev=0.3, pitched=False, human=(0.004, 0.08))
    X.add("hyoshigi", S.woodblock, hyo, kw=dict(f=1900.0, t60=0.05), peak=-13, pan=0.15, rev=0.45, pitched=False)
    X.add("kane", S.bell, kane, kw=dict(kind="kane"), level=-27, pan=0.45, rev=0.3)
    X.add("gong", S.bell, gong, kw=dict(kind="gong"), level=-25, pan=0.0, rev=0.5)

    es = end_spans(F)
    if es:
        lose = F.kind == "lose"
        strum, low, hits = [], [], []
        for b, d, ch, is_last in es:
            hold = d + (2.5 if is_last and F.kind == "video" else 0)
            r_pc, s_pc = DYAD[ch.sym]
            tones = [_up(r_pc, 50), _up(s_pc, 50), _up(r_pc, 62), _up(s_pc, 62), _up(r_pc, 74)]
            strum += [(b + i * 0.035, hold, m, 0.85 - 0.05 * i, dict(yuri=is_last)) for i, m in enumerate(sorted(tones)[:5 if not lose else 3])]
            low.append((b, hold, _up(r_pc, 33), 0.9))
            hits.append((b, 1.0 if is_last else 0.8))
            if is_last:
                X.add("end_gong", S.bell, [(b, 1.0, 38, 0.9 if not lose else 0.6)], kw=dict(kind="gong"), level=-18, rev=0.5)
        endmel = to_scale([(b, d, m, bar) for b, d, m, bar in F.mel if sec[bar] == "end"])
        em = [(b, d, m) for b, d, m, _ in endmel]
        if lose:
            X.add("end_shaku", S.flute, shaku_line(em, 0.7, -12), kw=dict(kind="shaku"), level=-16, rev=0.55, check=True)
        else:
            X.add("end_koto", S.koto, koto_line(em, 0.9), level=-16, pan=-0.2, rev=0.3, check=True)
            X.add("end_shaku", S.flute, tune(em, 0.8, -12, legato=0.97), kw=dict(kind="shaku"), level=-19, pan=0.2, rev=0.5)
            X.add("end_shime", S.taiko, roll(es[0][0], es[-1][0], 0.25, 0.4, 0.95), kw=dict(kind="shime"), peak=-13, pan=-0.3, rev=0.3,
                  pitched=False)
        X.add("end_strum", S.koto, strum, level=-19, pan=-0.3, rev=0.35)
        X.add("end_bass", S.koto, low, level=-19, rev=0.2)
        X.add("end_odaiko", S.taiko, hits if not lose else hits[-1:], peak=-6 if not lose else -10, rev=0.35, pitched=False)
