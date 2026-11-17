"""Blackridge: modern military thriller. A pulsing FM bass and sub impacts, odaiko and a tight electronic kit on the
gallop, a dark spiccato ostinato in violas and cellos, horns carrying the tune (violins and trumpets only when it
peaks), and bursts of band-passed radio noise in the gaps. The home form is tense and sparse: the pulse, a low drone,
a sonar ping, one drum every four bars and the tune on a single horn."""
import numpy as np
import synth as S
from .common import BEATS, body, end_spans, tune, gallop, roll, voice

NAME = "blackridge"

SPICC = dict(attack=0.012, release=0.07, vib=0)


def radio(vel=0.6, var=0, dur=1.2, f=1900.0):
    """Radio traffic with nobody talking: narrow band-passed noise whose level chatters, squelched in and out."""
    rng = S.rng_for("radio", var, round(dur, 3), round(f))
    n = int((dur + 0.05) * S.SR)
    x = S.noise(n, rng)
    y = S.bp(x, f * 0.6, f * 1.6) + 0.5 * S.resonators(x, [(f, 1.0, 6)])
    hop = int(0.045 * S.SR)
    steps = rng.uniform(0.25, 1.0, size=n // hop + 2)
    g = S.lp(np.repeat(steps, hop)[:n], 60)
    y = y * g * S.ar(n, 0.01, dur * 0.8, dur * 0.2)
    return S.fade(y * (0.3 + 0.7 * vel) * 0.4, 0.003, 0.02)


def arrange(X, F):
    X.reverb = ("hall", dict(rt=2.6, pre=0.03, bright=0.35, seed=71))
    X.reverb2 = ("gated", dict(gate=0.16, seed=72))
    X.delay = (0.75, 0.35, 2500.0)
    X.master_eq = [("hishelf", 6500, 1.5, 0.7), ("peak", 250, -1.5, 1.0)]
    calm, dark = F.kind == "home", F.dark
    E, sec = F.energy, F.sec
    is_b = lambda b: sec[b] == "B"
    main = lambda b: sec[b] != "end"
    X.pump_depth = 0.2 if calm else 0.4

    # ---- the tune: horns first, everything else only at the top
    hm = F.mel_in(lambda b: main(b) and (calm or E[b] >= 2 or E[b] == 0))
    X.add("horn_tune", S.brass, tune(hm, 0.62 if calm else 0.8, -12), kw=dict(kind="horn"), level=-19 if calm else -17,
          pan=-0.1, rev=0.5, check=True)
    vn = F.mel_in(lambda b: main(b) and not calm and (E[b] >= 4 or (is_b(b) and E[b] >= 3)))
    X.add("violins", S.strings, [(b, d, m, v, dict(attack=0.035 if d < 1 else 0.07)) for b, d, m, v in tune(vn, 0.7)],
          kw=dict(kind="vn", n=7), level=-20, pan=-0.3, rev=0.4, check=True)
    X.add("trumpets", S.brass, tune(F.mel_in(lambda b: main(b) and E[b] >= 5 and not dark), 0.8), kw=dict(kind="trumpet"),
          level=-21, pan=0.3, rev=0.4)
    X.add("trombones", S.brass, tune(F.mel_in(lambda b: main(b) and dark and E[b] >= 3), 0.85, -24), kw=dict(kind="trombone"),
          level=-19, pan=0.25, rev=0.35)
    X.add("cello_counter", S.strings, tune(F.ctr_in(lambda b: main(b) and not calm and E[b] >= 4 and not is_b(b)), 0.55, -12),
          kw=dict(kind="vc", n=4), level=-23, pan=0.3, rev=0.35)

    (bass, osti, drone, spad, hpad, odk, shime, ka, kick, snr, clp, hat, tom, ris, cym, imp, rad, ping) = ([] for _ in range(18))
    for b, b0, ch, e in body(F):
        last, first = F.last(b), F.first(b)
        root = ch.bass(29)
        # FM bass: the pulse
        if calm:
            bass += [(b0 + k * 0.5, 0.3, root + 12, 0.55 if k % 2 == 0 else 0.4) for k in range(8)]
        elif e >= 3:
            if dark:
                bass += [(b0 + k * 0.25, 0.22, root + (12 if k % 8 in (3, 6) else 0), 0.9 if k % 4 == 0 else 0.65) for k in range(16)]
            else:
                for t, a in gallop(b0):
                    o = t - b0
                    bass.append((t, 0.42 if o % 1 == 0 else 0.2, root + (12 if o % 1 == 0.5 else 0), 0.6 + 0.35 * a))
        elif e == 2:
            bass += [(b0 + k * 0.5, 0.4, root, 0.8 if k % 2 == 0 else 0.55) for k in range(8)]
        else:
            bass += [(b0, 3.8, root, 0.7)]
        if e >= 2 or calm:
            X.pump_beats += [b0, b0 + 2]
        # spiccato ostinato on the gallop: two voices when the fight is on, one note and gaps when it is not
        if e >= 3:
            dy = voice(ch, 55 if dark else 58, 2)
            for t, a in gallop(b0, accent=(0, 2)):
                for m in dy:
                    osti.append((t, 0.3 if t % 1 == 0 else 0.2, m, (0.45 + 0.07 * e) * a, SPICC))
        elif e == 2 or (calm and b % 2 == 0) or (e == 1 and not calm):
            m = voice(ch, 55, 1)[0]
            for t, a in gallop(b0, beats=(0, 2) if calm else (0, 1, 2, 3)):
                osti.append((t, 0.3 if t % 1 == 0 else 0.2, m, (0.4 if calm else 0.5) * a, SPICC))
        # sustained harmony: a contrabass drone and low strings underneath, horns added at the top
        if calm or e <= 2:
            drone.append((b0, 3.95, root + 12, 0.5))
            spad += [(b0, 3.95, m, 0.42 + 0.05 * e, dict(attack=0.25)) for m in voice(ch, 53, 3)]
        if e >= 4:
            hpad += [(b0, 3.85, m, 0.45 + 0.06 * e) for m in voice(ch, 55 if dark else 58, 3)]
        # percussion
        if calm:
            if b % 4 == 0:
                odk.append((b0, 0.6))
                ping.append((b0 + 2, 1.5, 86, 0.5))
            if b % 4 == 3:
                shime += [(t, 0.3 * a) for t, a in gallop(b0, beats=(3,))]
            if b % 8 == 0:
                imp.append((b0, 0.7))
            if b % 4 == 2:
                rad.append((b0 + 1.5, 0.5, dict(dur=1.4, f=1800.0)))
        elif e >= 3:
            odk += [(b0, 0.95), (b0 + 2.5, 0.6), (b0 + 3, 0.8)] + ([(b0 + 1.5, 0.6)] if e >= 5 or dark else [])
            kick += [(b0, 0.95), (b0 + 2.5, 0.6)] + ([(b0 + 1.5, 0.7)] if e >= 4 else [])
            snr.append((b0 + 2, 0.9))
            if e >= 5:
                clp.append((b0 + 2, 0.7))
            n16 = e >= 4
            hat += [(b0 + k * (0.25 if n16 else 0.5), (0.7 if k % (4 if n16 else 2) == 0 else 0.4 if k % 2 == 0 else 0.3)) for k in range(16 if n16 else 8)]
            if e >= 4 and not last:
                shime += [(t, (0.35 if t % 1 else 0.6) * a * (0.6 + 0.08 * e)) for t, a in gallop(b0)]
            else:
                ka += [(b0 + 1, 0.6), (b0 + 3, 0.7)]
            if last:
                shime += roll(b0 + 2, b0 + 4, 0.25, 0.3, 0.95)
                tom += [(b0 + 3 + k * 0.25, 0.75 + 0.05 * k, dict(f=[150.0, 125.0, 98.0, 74.0][k])) for k in range(4)]
                ris.append((b0, 0.8, dict(dur=4 * X.beat)))
                rad.append((b0 + 3.5, 0.5, dict(dur=0.3, f=2400.0)))
            if first:
                imp.append((b0, 0.9))
                if e >= 4:
                    cym.append((b0, 0.8))
        else:
            if e == 2:
                kick += [(b0, 0.9), (b0 + 2.5, 0.55)]
                ka += [(b0 + k + 0.5, 0.45) for k in range(4)]
            if first:
                imp.append((b0, 0.75))
            if e <= 1:
                rad.append((b0 + 0.5, 0.6, dict(dur=2.0, f=1700.0)))
            if last:
                ris.append((b0, 0.7, dict(dur=4 * X.beat)))
                shime += roll(b0 + 3, b0 + 4, 0.25, 0.3, 0.8)

    X.add("bass", S.fmbass, bass, kw=dict(index=5.0 if dark else 3.5, dec=0.14), level=-18 if calm else -16, duck=0.5,
          human=(0.001, 0.04))
    X.add("ostinato_va", S.strings, osti, kw=dict(kind="va", n=4), level=-24 if calm else -22, pan=0.25, rev=0.25,
          human=(0.004, 0.08))
    X.add("ostinato_vc", S.strings, osti, kw=dict(kind="vc", n=4), level=-25 if calm else -23, pan=-0.2, rev=0.2,
          human=(0.004, 0.08), transpose=-12)
    X.add("drone", S.strings, drone, kw=dict(kind="cb", n=3, attack=0.2, release=0.2, vib=0), level=-24, rev=0.2)
    X.add("string_pad", S.strings, spad, kw=dict(kind="vc", n=5), level=-25, pan=0.1, rev=0.45)
    X.add("horn_pad", S.brass, hpad, kw=dict(kind="horn"), level=-25, pan=-0.2, rev=0.5)
    X.add("ping", S.fmbell, ping, kw=dict(t60=1.2), level=-27, pan=0.3, rev=0.5, dly=0.5, human=(0.0, 0.03))
    X.add("odaiko", S.taiko, odk, kw=dict(kind="odaiko"), peak=-8, rev=0.3, pitched=False, human=(0.003, 0.05))
    X.add("shime", S.taiko, shime, kw=dict(kind="shime"), peak=-14, pan=0.2, rev=0.25, pitched=False, human=(0.003, 0.08))
    X.add("rim", S.taiko, ka, kw=dict(kind="ka"), peak=-17, pan=-0.25, rev=0.2, pitched=False, human=(0.002, 0.06))
    X.add("kick", S.kick, kick, kw=dict(kind="synth"), peak=-6, pitched=False, human=(0.0, 0.03))
    X.add("snare", S.snare, snr, kw=dict(kind="gated"), peak=-10, rev2=0.8, pitched=False, human=(0.001, 0.04))
    X.add("clap", S.clap, clp, peak=-15, pan=0.15, rev2=0.5, rev=0.15, pitched=False)
    X.add("hat", S.hat, hat, peak=-19, pan=0.3, rev=0.05, pitched=False, human=(0.001, 0.08))
    X.add("toms", S.tom, tom, peak=-10, rev2=0.6, rev=0.1, pitched=False)
    X.add("riser", S.riser, ris, peak=-18, rev=0.3, pitched=False)
    X.add("crash", S.cymbal, cym, peak=-16, rev=0.35, pitched=False)
    X.add("impact", S.impact, imp, peak=-9, rev=0.35, pitched=False, human=(0.0, 0.03))
    X.add("radio", radio, rad, peak=-22, pan=0.35, rev=0.2, dly=0.3, pitched=False, human=(0.0, 0.05))

    # ---- ending: brass and strings over a sub impact (the video tag, the win and lose stingers)
    es = end_spans(F)
    if es:
        lose = F.kind == "lose"
        tut, ht, lo_, hits = [], [], [], []
        for b, d, ch, is_last in es:
            hold = d + (2.5 if is_last and F.kind == "video" else 0)
            tut += [(b, hold * 0.97, m, 0.8 if not lose else 0.6) for m in voice(ch, 58 if lose else 65, 4)]
            ht += [(b, hold * 0.97, m, 0.8 if not lose else 0.55) for m in voice(ch, 57 if not lose else 52, 3)]
            lo_.append((b, hold * 0.95, ch.bass(29), 0.95))
            hits.append((b, 0.95 if not lose else 0.7))
            if is_last:
                X.add("end_impact", S.impact, [(b, 1.0 if not lose else 0.8)], peak=-7, rev=0.4, pitched=False)
                if not lose:
                    X.add("end_crash", S.cymbal, [(b, 0.85)], kw=dict(t60=2.5), peak=-14, rev=0.4, pitched=False)
        endmel = F.mel_in(lambda b: sec[b] == "end")
        X.add("end_horn", S.brass, tune(endmel, 0.9 if not lose else 0.7, -12), kw=dict(kind="horn"), level=-16, rev=0.5,
              check=True)
        if lose:
            X.add("end_vc", S.strings, tune(endmel, 0.7, -12), kw=dict(kind="vc", n=5), level=-20, pan=0.2, rev=0.4)
            X.add("end_radio", radio, [(es[-1][0] + 0.5, 0.6, dict(dur=1.6, f=1500.0))], peak=-20, pan=0.3, rev=0.3, pitched=False)
        else:
            X.add("end_trumpet", S.brass, tune(endmel, 0.85), kw=dict(kind="trumpet"), level=-19, pan=0.2, rev=0.4)
            X.add("end_shime", S.taiko, roll(es[0][0], es[-1][0], 0.25, 0.35, 0.95), kw=dict(kind="shime"), peak=-13, rev=0.3,
                  pitched=False)
        X.add("end_odaiko", S.taiko, hits if not lose else hits[-1:], kw=dict(kind="odaiko"), peak=-8, rev=0.3, pitched=False)
        X.add("end_strings", S.strings, tut, kw=dict(kind="va", n=6, attack=0.03), level=-21, rev=0.45)
        X.add("end_horns", S.brass, ht, kw=dict(kind="horn"), level=-21, pan=-0.15, rev=0.5)
        X.add("end_low", S.strings, lo_, kw=dict(kind="cb", n=3, attack=0.03), level=-19, rev=0.2, transpose=12)
        X.add("end_bass", S.fmbass, lo_, kw=dict(index=4.0, dec=0.4), level=-17)
