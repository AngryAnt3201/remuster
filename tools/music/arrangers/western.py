"""Dustline: spaghetti western. A baritone guitar twangs the tune low through a spring reverb, a whistler takes it
high, harmonica answers; strummed acoustic and coconut hooves gallop underneath with an upright bass; jaw harp,
honky-tonk piano, banjo, tubular bell, whip cracks, a rimshot like a gunshot; trumpet and choir for the showdown."""
import synth as S
from .common import BEATS, body, end_spans, tune, gallop, roll, voice, TRESILLO

NAME = "western"


def _strum(out, beat, ch, vel, dur, up=False, lo=45, hi=69, n=5):
    tones = ch.voicing(lo, hi)[:n]
    if up:
        tones = tones[-3:][::-1]
    for i, m in enumerate(tones):
        out.append((beat + i * 0.028, dur, m, vel * (1 - 0.05 * i)))


def arrange(X, F):
    X.reverb = ("hall", dict(rt=2.0, pre=0.03, bright=0.35, seed=31))
    X.reverb2 = ("spring", dict(rt=1.7, seed=32))
    X.master_eq = [("peak", 1900, -2.5, 0.8), ("loshelf", 140, 2.0, 0.7), ("hishelf", 6500, 2.0, 0.7)]
    calm, dark = F.kind == "home", F.dark
    E, sec = F.energy, F.sec
    is_b = lambda b: sec[b] == "B"
    main = lambda b: sec[b] != "end"
    trem = lambda x: S.tremolo(x, 6.0, 0.35)   # 6 Hz = 10 cycles per bar exactly, so loops stay periodic

    # ---- the tune
    X.add("twang", S.twang, tune(F.mel_in(lambda b: main(b) and not calm and E[b] >= 2 and (not is_b(b) or dark)), 0.82, -12 if not dark else -24),
          level=-16, pan=-0.2, rev=0.12, rev2=0.5, fx=[trem], check=True, human=(0.007, 0.06))
    X.add("whistle", S.flute, tune(F.mel_in(lambda b: main(b) and ((is_b(b) and E[b] >= 2 and not dark) or E[b] == 0 or (E[b] >= 4 and not is_b(b) and not dark) or (calm and not is_b(b)))), 0.75, 12),
          kw=dict(kind="whistle"), level=-21.5, pan=0.2, rev=0.55, check=True)
    X.add("harmonica", S.harmonica, tune(F.mel_in(lambda b: main(b) and ((is_b(b) and E[b] >= 4) or (calm and is_b(b)) or (dark and is_b(b)))), 0.75),
          level=-19, pan=0.3, rev=0.4, check=True)
    X.add("trumpet", S.brass, tune(F.mel_in(lambda b: main(b) and E[b] >= 5 and not is_b(b)), 0.85, -12 if dark else 0), kw=dict(kind="trumpet"),
          level=-18, pan=-0.05, rev=0.5, check=True)
    X.add("harmonica_counter", S.harmonica, tune(F.ctr_in(lambda b: main(b) and E[b] == 4 and not is_b(b)), 0.6, 12), level=-23,
          pan=0.35, rev=0.4)

    gtr, hoof_lo, hoof_hi, bass, riff, pno, bjo, jaw, bell, whp, shot, shk, tmb, stp, snr, chr_ = ([] for _ in range(16))
    for b, b0, ch, e in body(F):
        last, first = F.last(b), F.first(b)
        root = ch.bass(29)
        fifth = root + 7 if root + 7 <= 43 else root - 5
        # strummed acoustic: the gallop
        if calm:
            tones = ch.voicing(45, 72)
            gtr += [(b0 + k * 0.5, 1.2, tones[[0, 2, 3, 4, 5, 4, 3, 2][k] % len(tones)], 0.55) for k in range(8)]
        elif e >= 2:
            for k in range(4):
                _strum(gtr, b0 + k, ch, 0.8 if k % 2 == 0 else 0.7, 0.45)
                _strum(gtr, b0 + k + 0.5, ch, 0.45, 0.2, up=True)
                _strum(gtr, b0 + k + 0.75, ch, 0.55, 0.22, up=True)
        elif e == 1:
            _strum(gtr, b0, ch, 0.7, 1.8)
            _strum(gtr, b0 + 2, ch, 0.6, 1.8)
        else:
            _strum(gtr, b0, ch, 0.6, 3.8)
        # hooves
        if (e >= 3 or e == 1) and not calm:
            for t, a in gallop(b0):
                (hoof_lo if (t - b0) % 1 == 0 else hoof_hi).append((t, 0.75 * a))
        # upright bass
        if calm:
            bass += [(b0, 1.8, root + 12, 0.6), (b0 + 2, 1.8, fifth + 12, 0.5)]
        elif e >= 4:
            bass += [(b0, .9, root + 12, .95), (b0 + 1, .9, fifth + 12, .8), (b0 + 2, .9, root + 12, .9), (b0 + 3, .45, fifth + 12, .8),
                     (b0 + 3.5, .45, root + 12 + (2 if not last else -1), .7)]
        elif e >= 2:
            bass += [(b0, 1.8, root + 12, .9), (b0 + 2, 1.4, fifth + 12, .8), (b0 + 3.5, .45, root + 12, .6)]
        elif e == 1:
            bass += [(b0, 3.5, root + 12, 0.7)]
        # in B the baritone guitar leaves the tune to the whistle and plays the tresillo underneath
        if ((is_b(b) and e >= 2) or e <= 1) and not calm and not dark:
            r = ch.bass(38)
            riff += [(b0 + t, 1.3 if i < 2 else 0.9, r + [0, 7, 12][i], 0.8) for i, t in enumerate(TRESILLO)]
        # honky-tonk piano: off-beat chords
        if e >= 4 or (is_b(b) and e >= 3):
            for o in (0.5, 1.5, 2.5, 3.5):
                pno += [(b0 + o, 0.3, m, 0.6) for m in voice(ch, 67, 3)]
            if last:
                pno += [(b0 + 2 + k * 0.25, 0.25, m, 0.6 + 0.04 * k) for k, m in enumerate([86, 84, 82, 81, 79, 77, 76, 74])]
        # banjo roll
        if e >= 4 and not dark:
            tones = ch.voicing(62, 79)
            bjo += [(b0 + k * 0.25, 0.25, tones[[0, 2, 4, 1, 3, 4, 0, 2][k % 8] % len(tones)], 0.55 + (0.15 if k % 4 == 0 else 0)) for k in range(16)]
        # jaw harp
        if 1 <= e <= 4 and not calm:
            jaw += [(b0 + 1.5, 0.9, ch.bass(36), 0.8), (b0 + 3.5, 0.45, ch.bass(36), 0.6)]
        # bell, whip, gunshot
        if (first and (e >= 3 or e <= 1) and not calm) or (dark and b % 2 == 0):
            bell.append((b0, 1.0, 62 if not dark else 50, 0.85))
        if not calm and ((e >= 3 and b % 2 == 1) or last):
            whp.append((b0 + 3, 0.85 if last else 0.6, dict(pre=S.WHIP_PRE)))
        if first and (e >= 4 or e == 0) and b > 0:
            shot.append((b0, 0.95))
        # light percussion
        if e >= 3:
            shk += [(t, 0.7 * a) for t, a in gallop(b0)]
        if e >= 4:
            tmb += [(b0 + 1, 0.8), (b0 + 3, 0.85)]
            stp += [(b0, 0.9), (b0 + 2, 0.8)]
        if e >= 5:
            snr += ([(b0 + 1, 0.75), (b0 + 3, 0.8)] if not last else roll(b0 + 2, b0 + 4, 0.25, 0.3, 0.9))
            chr_ += [(b0, 3.9, m, 0.7) for m in voice(ch, 60 if not dark else 55, 3)]
        elif dark:
            chr_ += [(b0, 3.9, m, 0.6) for m in voice(ch, 55, 3)]

    X.add("acoustic", S.guitar, gtr, level=-21 if not calm else -19, pan=0.4, rev=0.2, human=(0.004, 0.08))
    X.add("hoof_lo", S.clop, hoof_lo, peak=-17, pan=-0.3, rev=0.2, pitched=False, human=(0.004, 0.08))
    X.add("hoof_hi", S.clop, hoof_hi, kw=dict(hi=True), peak=-19, pan=-0.2, rev=0.2, pitched=False, human=(0.004, 0.08))
    X.add("upright", S.upright, bass, level=-15, pan=0.0, rev=0.08)
    X.add("twang_riff", S.twang, riff, level=-19, pan=-0.25, rev2=0.45, fx=[trem])
    X.add("piano", S.honkytonk, pno, level=-23, pan=-0.45, rev=0.25, human=(0.006, 0.08))
    X.add("banjo", S.banjo, bjo, level=-26, pan=0.5, rev=0.2, human=(0.004, 0.08))
    X.add("jawharp", S.jawharp, jaw, level=-23, pan=-0.4, rev=0.2)
    X.add("bell", S.bell, bell, kw=dict(kind="tubular"), level=-21, pan=0.1, rev=0.6)
    X.add("whip", S.whip, whp, peak=-12, pan=0.3, rev=0.45, rev2=0.2, pitched=False, human=(0.0, 0.05))
    X.add("gunshot", S.rim, shot, kw=dict(kind="shot"), peak=-9, pan=-0.1, rev=0.6, rev2=0.3, pitched=False)
    X.add("shaker", S.shaker, shk, peak=-21, pan=0.45, rev=0.15, pitched=False)
    X.add("tambourine", S.tambourine, tmb, peak=-18, pan=-0.35, rev=0.25, pitched=False)
    X.add("stomp", S.kick, stp, kw=dict(kind="stomp"), peak=-7, rev=0.15, pitched=False)
    X.add("snare", S.snare, snr, kw=dict(kind="band"), peak=-13, pan=0.1, rev=0.3, pitched=False)
    X.add("choir", S.choir, chr_, kw=dict(vowel="ah" if not dark else "oh"), level=-24, rev=0.6)

    es = end_spans(F)
    if es:
        lose = F.kind == "lose"
        ac, tw, low, ch_ = [], [], [], []
        for b, d, ch, is_last in es:
            hold = d + (2.5 if is_last and F.kind == "video" else 0)
            _strum(ac, b, ch, 0.85, hold)
            tw += [(b, hold, ch.bass(38), 0.9), (b + 0.03, hold, ch.bass(38) + 7, 0.8)]
            low.append((b, hold, ch.bass(29) + 12, 0.9))
            ch_ += [(b, hold * 0.97, m, 0.75) for m in voice(ch, 60, 3)]
            if is_last:
                X.add("end_bell", S.bell, [(b, 1.0, ch.bass(57), 0.9)], kw=dict(kind="tubular"), level=-18, rev=0.6)
                if not lose:
                    X.add("end_shot", S.rim, [(b, 1.0)], kw=dict(kind="shot"), peak=-8, rev=0.6, rev2=0.3, pitched=False)
                    X.add("end_whip", S.whip, [(b, 0.9, dict(pre=S.WHIP_PRE))], peak=-11, pan=0.3, rev=0.5, pitched=False)
        endmel = F.mel_in(lambda b: sec[b] == "end")
        if lose:
            X.add("end_harmonica", S.harmonica, tune(endmel, 0.7), level=-17, rev=0.5, check=True)
        else:
            X.add("end_trumpet", S.brass, tune(endmel, 0.9), kw=dict(kind="trumpet"), level=-17, rev=0.5, check=True)
            X.add("end_whistle", S.flute, tune(endmel, 0.8, 12), kw=dict(kind="whistle"), level=-21, pan=0.2, rev=0.55)
            X.add("end_choir", S.choir, ch_, level=-23, rev=0.6)
            X.add("end_hoof", S.clop, [(t, 0.7 * a) for t, a in gallop(es[0][0], beats=range(int(es[-1][0] - es[0][0])))], peak=-17,
                  pan=-0.3, rev=0.2, pitched=False)
        X.add("end_acoustic", S.guitar, ac, level=-20, pan=0.4, rev=0.25)
        X.add("end_twang", S.twang, tw, level=-17, pan=-0.2, rev2=0.55, fx=[trem])
        X.add("end_upright", S.upright, low, level=-17, rev=0.1)
