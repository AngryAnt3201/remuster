"""Crownfall: orchestral adventure. Violins and flute carry the tune, horns answer in B, a spiccato gallop underneath,
harp, timpani, field snare; choir and trumpets arrive for the last statement."""
import synth as S
from .common import BEATS, body, end_spans, tune, pad, gallop, roll, arp, run, voice

NAME = "fantasy"


def arrange(X, F):
    X.reverb = ("hall", dict(rt=2.3, pre=0.025, bright=0.45, seed=11))
    X.master_eq = [("hishelf", 5000, 3.5, 0.7), ("peak", 110, -1.5, 0.8)]
    calm, dark = F.kind == "home", F.dark
    E, sec = F.energy, F.sec
    is_b = lambda b: sec[b] == "B"
    main = lambda b: sec[b] != "end"
    low = -12 if dark else 0

    # ---- the tune
    fl = F.mel_in(lambda b: main(b) and (E[b] in (0, 2) or (calm and not is_b(b))))
    X.add("flute", S.flute, tune(fl, 0.7), level=-18, pan=0.15, rev=0.4, check=True)
    X.add("flute8", S.flute, tune(F.mel_in(lambda b: main(b) and E[b] >= 5 and not dark), 0.75, 12), kw=dict(kind="piccolo"),
          level=-23, pan=0.2, rev=0.4)
    vn = F.mel_in(lambda b: main(b) and E[b] >= 3 and not calm)
    X.add("violins", S.strings, [(b, d, m + low, v, dict(attack=0.035 if d < 1 else 0.07)) for b, d, m, v in tune(vn, 0.72)],
          kw=dict(kind="vn", n=7), level=-17, pan=-0.3, rev=0.38, check=True)
    hm = F.mel_in(lambda b: main(b) and ((is_b(b) and E[b] >= 2) or dark or (calm and is_b(b))))
    X.add("horn_tune", S.brass, tune(hm, 0.66 if calm else 0.8, -12), kw=dict(kind="horn"), level=-18 if not calm else -19,
          pan=-0.1, rev=0.5, check=True)
    X.add("trumpets", S.brass, tune(F.mel_in(lambda b: main(b) and E[b] >= 5 and not is_b(b)), 0.82, low),
          kw=dict(kind="trumpet"), level=-19, pan=0.3, rev=0.4)
    X.add("trombones", S.brass, tune(F.mel_in(lambda b: main(b) and dark), 0.85, -24), kw=dict(kind="trombone"),
          level=-18, pan=0.25, rev=0.35)
    # countermelody: horns under the violins on the repeats of A
    X.add("horn_counter", S.brass, tune(F.ctr_in(lambda b: main(b) and E[b] >= 4 and not is_b(b)), 0.6),
          kw=dict(kind="horn"), level=-21, pan=0.1, rev=0.5)
    X.add("cello_counter", S.strings, tune(F.ctr_in(lambda b: main(b) and (calm or E[b] == 3) and is_b(b)), 0.55, -12 if not calm else 0),
          kw=dict(kind="vc", n=4), level=-22, pan=0.3, rev=0.35)
    X.add("glock", S.bell, tune(F.mel_in(lambda b: main(b) and ((calm and is_b(b)) or (E[b] >= 5 and is_b(b)))), 0.5, 12),
          kw=dict(kind="glock"), level=-27, pan=-0.2, rev=0.4)

    harp, spicc, lows, timp, snr, bd, cym, hpad, spad, chr_ = [], [], [], [], [], [], [], [], [], []
    for b, b0, ch, e in body(F):
        last, first = F.last(b), F.first(b)
        root = ch.bass(33)
        # harp: broken chords when things are quiet, a glissando into each new section when they are not
        if e <= 2:
            if calm:
                harp += arp(ch, 45, 81, [0, 2, 3, 4, 5, 4, 3, 2], b0, 0.5, 8, 1.5, 0.5)
            else:
                harp += arp(ch, 50, 86, [0, 1, 2, 3, 4, 3, 2, 1], b0, 0.5, 8, 1.0, 0.55 + 0.05 * e)
        if last and not calm and e != 1:
            harp += run(50, 86, b0 + 3, b0 + 4, vel=(0.5, 0.85))
        # spiccato gallop (the rhythmic motif) in violas and second violins
        if e >= 3 or (e == 1 and not calm):
            dy = voice(ch, 64 + low // 2, 2)
            for t, a in gallop(b0, accent=(0, 2)):
                for m in dy:
                    spicc.append((t, 0.3 if t % 1 == 0 else 0.2, m, (0.45 + 0.07 * e) * a, dict(attack=0.012, release=0.07, vib=0)))
        # cellos and basses
        if e in (0, 1) or calm:
            lows.append((b0, 3.9, root + 12, 0.5))
        elif e == 2:
            lows += [(b0, 1.9, root + 12, 0.6), (b0 + 2, 1.9, root + 7 if root <= 38 else root + 12 - 5, 0.55)]
        else:
            fifth = root + 7 if root + 7 <= 45 else root - 5
            pat = [(0, .9, root, 1.0), (1, .45, root, .7), (1.5, .2, root, .6), (1.75, .2, root, .65), (2, .9, fifth, .9),
                   (3, .45, root, .75), (3.5, .2, root + 12 if dark else root, .6), (3.75, .2, root, .7)]
            if dark:
                pat = [(k * 0.5, .4, root + (12 if k % 4 == 3 else 0), 1.0 if k % 2 == 0 else 0.7) for k in range(8)]
            lows += [(b0 + t, d, m + 12, 0.6 + 0.3 * v * e / 5) for t, d, m, v in pat]
        # sustained harmony
        if e >= 3:
            hpad += [(b0, 3.85, m, 0.45 + 0.06 * e) for m in voice(ch, 58 + low // 2, 3)]
        if e <= 2 or e >= 5:
            spad += [(b0, 3.95, m, 0.4 + 0.07 * e, dict(attack=0.25 if e < 3 else 0.1)) for m in voice(ch, 67, 3)]
        if e >= 5 or (dark and e >= 4):
            chr_ += [(b0, 3.9, m, 0.7) for m in voice(ch, 62 + low, 4)]
        # percussion
        tm = ch.bass(38)
        if e >= 3:
            timp += [(b0, 1.5, tm, 0.85), (b0 + 2.5, .4, tm, 0.5), (b0 + 3, .8, tm, 0.7)]
            bd += [(b0, 0.9)] + ([(b0 + 2, 0.7)] if e >= 4 else [])
        elif e == 1 and not calm:
            timp += [(b0, 2, tm, 0.6)]
        if e >= 4 and not last:
            snr += [(t, (0.35 if t % 1 else 0.6) * a * (1.2 if (t - b0) in (1, 3) else 1.0) * (0.6 + 0.08 * e)) for t, a in gallop(b0)]
        if last and not calm and e != 2:
            if e >= 4:
                snr += [(t, 0.6 * a) for t, a in gallop(b0, beats=(0, 1))]
            snr += roll(b0 + 2, b0 + 4, 0.25, 0.3, 0.95)
            timp += [(t, .2, tm, v) for t, v in roll(b0 + 2, b0 + 4, 0.25, 0.3, 0.9)]
        if first and e >= 4:
            cym.append((b0, 0.85))
        if dark and e >= 5:
            bd += [(b0 + 1.5, 0.6), (b0 + 3.5, 0.6)]

    X.add("harp", S.harp, harp, level=-22 if not calm else -20, pan=-0.5, rev=0.3)
    X.add("spiccato", S.strings, spicc, kw=dict(kind="va", n=4), level=-23, pan=0.25, rev=0.25, human=(0.004, 0.08))
    X.add("cellos", S.strings, lows, kw=dict(kind="vc", n=4, attack=0.03, release=0.08, vib=6), level=-19, pan=0.3, rev=0.2)
    X.add("basses", S.strings, lows, kw=dict(kind="cb", n=3, attack=0.035, release=0.08, vib=0), level=-20, pan=0.1, rev=0.12,
          transpose=-12)
    X.add("horn_pad", S.brass, hpad, kw=dict(kind="horn"), level=-25, pan=-0.2, rev=0.5)
    X.add("string_pad", S.strings, spad, kw=dict(kind="vn", n=5), level=-25, pan=0.1, rev=0.45)
    X.add("choir", S.choir, chr_, kw=dict(vowel="oh" if dark else "ah"), level=-25, rev=0.55)
    X.add("timpani", S.timpani, timp, peak=-9, pan=-0.1, rev=0.35, human=(0.004, 0.06))
    X.add("snare", S.snare, snr, kw=dict(kind="orch"), peak=-11, pan=0.12, rev=0.3, pitched=False, human=(0.003, 0.08))
    X.add("bass_drum", S.kick, bd, kw=dict(kind="orch"), peak=-8, rev=0.25, pitched=False)
    X.add("cymbals", S.cymbal, cym, peak=-13, rev=0.4, pitched=False)

    # ---- ending: tutti chords under the tag / the stingers
    es = end_spans(F)
    if es:
        lose = F.kind == "lose"
        tut, lo_, tp, ht = [], [], [], []
        for b, d, ch, is_last in es:
            hold = d + (2.5 if is_last and F.kind == "video" else 0)
            tut += [(b, hold * 0.97, m, 0.85 if not lose else 0.6) for m in voice(ch, 60 if lose else 70, 4)]
            ht += [(b, hold * 0.97, m, 0.8 if not lose else 0.55) for m in voice(ch, 57 if not lose else 52, 3)]
            lo_ += [(b, hold * 0.97, ch.bass(38), 0.9)]
            tp.append((b, min(hold, 2.0), ch.bass(38), 0.95 if not lose else 0.6))
            if is_last:
                tp += [(t, .2, ch.bass(38), v * (0.5 if lose else 0.8)) for t, v in roll(b + 0.5, b + min(hold, 5) - 0.5, 0.25, 0.6, 0.25)]
                if not lose:
                    X.add("end_cymbal", S.cymbal, [(b, 0.95)], kw=dict(t60=3.0), peak=-10, rev=0.45, pitched=False)
                    X.add("end_bd", S.kick, [(b, 1.0)], kw=dict(kind="orch"), peak=-6, rev=0.3, pitched=False)
        endmel = F.mel_in(lambda b: sec[b] == "end")
        if lose:
            X.add("end_horn", S.brass, tune(endmel, 0.7, -12), kw=dict(kind="horn"), level=-17, rev=0.5, check=True)
            X.add("end_vc", S.strings, tune(endmel, 0.7, -12), kw=dict(kind="vc", n=5), level=-19, pan=0.2, rev=0.4)
        else:
            X.add("end_trumpet", S.brass, tune(endmel, 0.9), kw=dict(kind="trumpet"), level=-16, pan=0.2, rev=0.4, check=True)
            X.add("end_violins", S.strings, tune(endmel, 0.9), kw=dict(kind="vn", n=7, attack=0.03), level=-18, pan=-0.3, rev=0.4)
            X.add("end_snare", S.snare, roll(es[0][0], es[-1][0], 0.25, 0.35, 0.95), kw=dict(kind="orch"), peak=-11, rev=0.3,
                  pitched=False)
        X.add("end_strings", S.strings, tut, kw=dict(kind="vn", n=6, attack=0.03), level=-20, rev=0.45)
        X.add("end_horns", S.brass, ht, kw=dict(kind="horn"), level=-20, pan=-0.15, rev=0.5)
        X.add("end_low", S.strings, lo_, kw=dict(kind="vc", n=4, attack=0.03), level=-18, pan=0.2, rev=0.25)
        X.add("end_bass", S.strings, lo_, kw=dict(kind="cb", n=3, attack=0.03), level=-19, rev=0.15, transpose=-12)
        X.add("end_timp", S.timpani, tp, peak=-8, rev=0.35)
