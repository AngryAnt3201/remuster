"""Brasswick: a clockwork brass band. A clock ticks through everything; tuba and stomp go oom, accordion and trombones
go pah; harpsichord broken chords; cornet (A) and accordion (B) carry the tune; anvils on the backbeat, steam chuffs on
the gallop, a ratchet winds into each new section; the pipe organ opens up for the last statement."""
import synth as S
from .common import BEATS, body, end_spans, tune, gallop, roll, voice

NAME = "steampunk"


def arrange(X, F):
    X.reverb = ("room", dict(rt=0.9, pre=0.008, bright=0.7, seed=21))
    X.reverb2 = ("plate", dict(rt=1.6, pre=0.0, bright=0.8, seed=22))
    X.master_eq = [("hishelf", 7000, -1.5, 0.7)] if F.kind == "home" else []
    calm, dark = F.kind == "home", F.dark
    E, sec = F.energy, F.sec
    is_b = lambda b: sec[b] == "B"
    main = lambda b: sec[b] != "end"

    # ---- the tune
    X.add("cornet", S.brass, tune(F.mel_in(lambda b: main(b) and not calm and not dark and E[b] >= 2 and (not is_b(b) or E[b] >= 5)), 0.78),
          kw=dict(kind="cornet"), level=-17, pan=-0.2, rev=0.3, rev2=0.1, check=True)
    X.add("accordion_tune", S.accordion, tune(F.mel_in(lambda b: main(b) and ((is_b(b) and E[b] >= 2) or (calm and is_b(b)))), 0.75),
          kw=dict(low=False), level=-18, pan=0.25, rev=0.3, check=True)
    X.add("musicbox", S.bell, tune(F.mel_in(lambda b: main(b) and (E[b] == 0 or (calm and not is_b(b)))), 0.7, 12),
          kw=dict(kind="musicbox"), level=-19, pan=-0.1, rev=0.25, rev2=0.2, check=True)
    X.add("glock", S.bell, tune(F.mel_in(lambda b: main(b) and E[b] >= 4 and not dark), 0.55, 12), kw=dict(kind="glock"),
          level=-27, pan=0.35, rev=0.3)
    X.add("trombone_tune", S.brass, tune(F.mel_in(lambda b: main(b) and dark), 0.85, -12), kw=dict(kind="trombone"),
          level=-17, pan=-0.2, rev=0.3, check=True)
    X.add("organ_tune", S.organ, tune(F.mel_in(lambda b: main(b) and (E[b] >= 5 or dark)), 0.8, -12 if dark else 0),
          kw=dict(stops="reed" if dark else "plenum"), level=-21, pan=0.1, rev=0.35, rev2=0.25)
    X.add("euphonium", S.brass, tune(F.ctr_in(lambda b: main(b) and E[b] >= 4 and not is_b(b)), 0.65), kw=dict(kind="euph"),
          level=-21, pan=0.3, rev=0.3)

    tk, tc, rat, anv, chf, his, stp, snr, tuba, pah, tbn, hps, org = ([] for _ in range(13))
    for b, b0, ch, e in body(F):
        last, first = F.last(b), F.first(b)
        root = ch.bass(29)
        fifth = root + 7 if root + 7 <= 41 else root - 5
        # the clock: never stops
        for k in range(8 if not calm else 4):
            t = b0 + k * (0.5 if not calm else 1.0)
            (tk if k % 2 == 0 else tc).append((t, (0.8 if k % 2 == 0 else 0.6) * (1.0 if k else 1.15)))
        if last and not calm:
            rat.append((b0 + 3, 0.8, dict(dur=0.36)))
        elif b % 4 == 1 and e >= 2 and not calm:
            rat.append((b0 + 3.5, 0.5, dict(dur=0.15)))
        if first and (e >= 2 or e == 0):
            his.append((b0, 0.7, dict(dur=1.3)))
        if calm and b % 8 == 4:
            his.append((b0 + 2, 0.4, dict(dur=1.6)))
        # oom-pah
        if e >= 2 and not calm:
            if e >= 4:
                tuba += [(b0, .8, root, 1.0), (b0 + 1, .8, fifth, .8), (b0 + 2, .8, root, .95), (b0 + 3, .45, fifth, .8),
                         (b0 + 3.5, .45, root + (2 if not last else -1), .75)]
            else:
                tuba += [(b0, .9, root, 1.0), (b0 + 2, .9, fifth, .85)]
            offs = [0.5, 1.5, 2.5, 3.5] if e >= 4 else [1, 3]
            v3 = voice(ch, 65, 3)
            for o in offs:
                pah += [(b0 + o, 0.28, m, 0.6 + 0.05 * e) for m in v3]
                if e >= 4:
                    tbn += [(b0 + o, 0.25, m, 0.7) for m in voice(ch, 55, 2)]
        elif e == 1 or calm:
            tuba += [(b0, 1.8, root + 12 if calm else root, 0.6)] + ([(b0 + 2, 1.8, fifth + 12, 0.5)] if calm else [])
        # harpsichord: broken chords
        tones = ch.voicing(57, 81)
        if calm:
            hps += [(b0 + k, 1.0, tones[[0, 2, 3, 2][k] % len(tones)], 0.6) for k in range(4)]
        elif e >= 5 or dark:
            hps += [(b0 + k * 0.25, 0.25, tones[[0, 3, 2, 3, 1, 3, 2, 3][k % 8] % len(tones)], 0.75) for k in range(16)]
        elif e >= 1:
            hps += [(b0 + k * 0.5, 0.5, tones[[0, 3, 2, 3, 1, 3, 2, 3][k] % len(tones)], 0.7) for k in range(8)]
        else:
            hps += [(b0, 3.5, m, 0.6) for m in tones[:4]]
        # organ under everything once the band is in
        if e >= 3 or calm:
            org += [(b0, 3.9, m, 0.6) for m in voice(ch, 60, 3)] + [(b0, 3.9, root + 12, 0.6)]
        # machinery percussion
        if e >= 3:
            stp += [(b0, 0.95), (b0 + 2, 0.85)]
            anv += [(b0 + 1, 0.8, dict(midi=86)), (b0 + 3, 0.9, dict(midi=89))]
            chf += [(t, 0.8 * a, dict(dur=0.1, chuff=True)) for t, a in gallop(b0)]
            if not last:
                snr += [(b0 + 1, 0.8), (b0 + 3, 0.85)]
                if e >= 4:
                    snr += [(t, 0.3 * a) for t, a in gallop(b0) if (t - b0) % 1]
            else:
                snr += [(b0 + 1, 0.8)] + roll(b0 + 2, b0 + 4, 0.25, 0.3, 0.95)
        elif e == 1 and not calm:
            chf += [(t, 0.6 * a, dict(dur=0.1, chuff=True)) for t, a in gallop(b0, beats=(0, 2))]
        if e >= 5 or (dark and e >= 4):
            anv += [(b0 + 2.5, 0.6, dict(midi=91))]
            stp += [(b0 + 3.5, 0.7)] if dark else []

    X.add("tick", S.tick, tk, peak=-17, pan=-0.45, rev=0.25, pitched=False, human=(0.001, 0.04))
    X.add("tock", S.tick, tc, kw=dict(tock=True), peak=-19, pan=0.45, rev=0.25, pitched=False, human=(0.001, 0.04))
    X.add("ratchet", S.ratchet, rat, peak=-14, pan=0.5, rev=0.3, pitched=False)
    X.add("anvil", S.anvil, anv, peak=-13, pan=-0.3, rev=0.35, rev2=0.2, pitched=False)
    X.add("chuff", S.steam, chf, peak=-19, pan=0.3, rev=0.2, pitched=False)
    X.add("hiss", S.steam, his, peak=-17, pan=-0.5, rev=0.3, pitched=False)
    X.add("stomp", S.kick, stp, kw=dict(kind="stomp"), peak=-7, rev=0.12, pitched=False)
    X.add("snare", S.snare, snr, kw=dict(kind="band"), peak=-11, pan=0.1, rev=0.25, rev2=0.1, pitched=False, human=(0.003, 0.08))
    X.add("tuba", S.brass, tuba, kw=dict(kind="tuba"), level=-17, pan=0.05, rev=0.15)
    X.add("accordion_pah", S.accordion, pah, kw=dict(low=False), level=-24, pan=0.3, rev=0.25, human=(0.005, 0.08))
    X.add("trombone_pah", S.brass, tbn, kw=dict(kind="trombone"), level=-25, pan=-0.35, rev=0.3)
    X.add("harpsichord", S.harpsichord, hps, level=-22 if not calm else -20, pan=-0.35, rev=0.3, human=(0.004, 0.03))
    X.add("organ", S.organ, org, kw=dict(stops="flutes"), level=-26 if not calm else -25, pan=0.0, rev=0.35, rev2=0.2)

    es = end_spans(F)
    if es:
        lose = F.kind == "lose"
        band, low, orgc, hits = [], [], [], []
        for b, d, ch, is_last in es:
            hold = d + (2.5 if is_last and F.kind == "video" else 0)
            band += [(b, hold * 0.95, m, 0.85) for m in voice(ch, 58 if lose else 64, 3)]
            orgc += [(b, hold * 0.97, m, 0.8) for m in voice(ch, 62, 4)] + [(b, hold * 0.97, ch.bass(38), 0.8)]
            low.append((b, hold * 0.95, ch.bass(29), 0.95))
            hits.append((b, 0.95 if is_last else 0.8))
            if is_last:
                X.add("end_hiss", S.steam, [(b + (0.5 if lose else 1.0), 0.8, dict(dur=2.2))], peak=-15, pan=-0.3, rev=0.4, pitched=False)
                if not lose:
                    X.add("end_anvil", S.anvil, [(b, 1.0, dict(midi=86)), (b, 0.9, dict(midi=93))], peak=-10, rev=0.4, rev2=0.3, pitched=False)
        endmel = F.mel_in(lambda b: sec[b] == "end")
        if lose:
            X.add("end_tune", S.accordion, tune(endmel, 0.7, -12), level=-17, rev=0.3, check=True)
            X.add("end_ratchet", S.ratchet, [(es[-1][0] - 1, 0.6, dict(dur=0.4))], peak=-15, pan=0.4, rev=0.3, pitched=False)
        else:
            X.add("end_tune", S.brass, tune(endmel, 0.9), kw=dict(kind="cornet"), level=-16, pan=-0.15, rev=0.3, rev2=0.15, check=True)
            X.add("end_glock", S.bell, tune(endmel, 0.7, 12), kw=dict(kind="glock"), level=-24, pan=0.3, rev=0.3)
            X.add("end_organ", S.organ, orgc, kw=dict(stops="plenum"), level=-20, rev=0.35, rev2=0.3)
            X.add("end_ratchet", S.ratchet, [(es[0][0], 0.8, dict(dur=es[-1][0] * X.beat - es[0][0] * X.beat - 0.05))], peak=-15,
                  pan=0.4, rev=0.3, pitched=False)
            X.add("end_snare", S.snare, roll(es[0][0], es[-1][0], 0.25, 0.4, 0.95) + [(es[-1][0], 1.0)], kw=dict(kind="band"),
                  peak=-11, rev=0.3, pitched=False)
        X.add("end_band", S.brass, band, kw=dict(kind="trombone"), level=-19, pan=0.2, rev=0.3)
        X.add("end_tuba", S.brass, low, kw=dict(kind="tuba"), level=-17, rev=0.2)
        X.add("end_stomp", S.kick, hits, kw=dict(kind="stomp"), peak=-7, rev=0.15, pitched=False)
        X.add("end_tick", S.tick, [(es[0][0] + k * 0.5, 0.7) for k in range(int((es[-1][0] - es[0][0]) * 2))], peak=-17,
              pan=-0.4, rev=0.25, pitched=False)
