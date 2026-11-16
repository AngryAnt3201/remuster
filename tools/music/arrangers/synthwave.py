"""Neonhold: synthwave. Four-on-the-floor kick, gated-reverb snare, an FM bass on the gallop, sixteenth-note arpeggio
through a ping-pong delay, supersaw pads pumping against the kick, and a supersaw lead with an FM bell on top in B."""
import synth as S
from .common import BEATS, body, end_spans, tune, gallop, roll, voice

NAME = "synthwave"


def arrange(X, F):
    X.reverb = ("plate", dict(rt=1.9, pre=0.01, bright=0.75, seed=41))
    X.reverb2 = ("gated", dict(gate=0.19, seed=42))
    X.delay = (0.75, 0.45, 3200.0)
    X.master_eq = [("hishelf", 6000, 2.0, 0.7), ("peak", 80, -1.5, 1.0)]
    calm, dark = F.kind == "home", F.dark
    E, sec = F.energy, F.sec
    is_b = lambda b: sec[b] == "B"
    main = lambda b: sec[b] != "end"
    X.pump_depth = 0.35 if calm else 0.62

    # ---- the tune
    lead_kw = dict(detune=0.26, cut=(900, 5200) if dark else (1100, 7500), dec=0.5, sus=0.7, res=0.5 if dark else 0.25)
    X.add("lead", S.supersaw, tune(F.mel_in(lambda b: main(b) and E[b] >= 2 and not (calm and not is_b(b))), 0.8 if not calm else 0.6, -12 if dark else 0),
          kw=lead_kw if not calm else dict(detune=0.2, cut=(500, 2600), att=0.03, sus=0.8), level=-17 if not calm else -19, rev=0.3, dly=0.28,
          wide=0.8, check=True, human=(0.002, 0.04))
    X.add("lead8", S.supersaw, tune(F.mel_in(lambda b: main(b) and E[b] >= 5 and not dark), 0.75, 12), kw=dict(detune=0.3, cut=(1500, 9000)),
          level=-24, rev=0.35, dly=0.3, human=(0.002, 0.04))
    X.add("bell", S.fmbell, tune(F.mel_in(lambda b: main(b) and ((is_b(b) and E[b] >= 3) or E[b] == 0 or (calm and not is_b(b)))), 0.7, 12 if not calm else 0),
          level=-22 if not calm else -18, pan=0.15, rev=0.45, dly=0.35, check=calm, human=(0.002, 0.04))
    X.add("counter", S.synthpluck, tune(F.ctr_in(lambda b: main(b) and E[b] >= 4 and not is_b(b)), 0.7, 12),
          kw=dict(shape="pulse", cut=(700, 4000), dec=0.4), level=-23, pan=-0.3, rev=0.3, dly=0.2, duck=0.5)

    kick, snr, clp, hat, ohat, bass, padn, arp, tom, ris, cym = ([] for _ in range(11))
    for b, b0, ch, e in body(F):
        last, first = F.last(b), F.first(b)
        root = ch.bass(29)
        # drums
        if calm:
            kick += [(b0, 0.7), (b0 + 2.5, 0.5)]
            hat += [(b0 + k * 0.5, 0.35 + 0.15 * (k % 2)) for k in range(8)]
            snr += [(b0 + 2, 0.5)] if e >= 2 else []
        elif e >= 3:
            kick += [(b0 + k, 0.95) for k in range(4)] + ([(b0 + 3.5, 0.7)] if dark and b % 2 else [])
            snr += [(b0 + 1, 0.9), (b0 + 3, 0.95)]
            clp += [(b0 + 1, 0.7), (b0 + 3, 0.75)] if e >= 4 else []
            n16 = e >= 4
            hat += [(b0 + k * (0.25 if n16 else 0.5), (0.7 if k % (4 if n16 else 2) == 0 else 0.4 if k % 2 == 0 else 0.3)) for k in range(16 if n16 else 8)]
            ohat += [(b0 + k + 0.5, 0.6) for k in range(4)]
            if last:
                tom += [(b0 + 3 + k * 0.25, 0.75 + 0.05 * k, dict(f=[165.0, 140.0, 110.0, 82.0][k])) for k in range(4)]
                ris.append((b0, 0.8, dict(dur=4 * X.beat)))
            if first and e >= 4:
                cym.append((b0, 0.8))
        elif e == 2:
            kick += [(b0, 0.9), (b0 + 2, 0.85)]
            hat += [(b0 + k * 0.5, 0.5 if k % 2 == 0 else 0.3) for k in range(8)]
            snr += [(b0 + 3, 0.6)] if last else []
        if e == 0 or (e == 1 and last and not calm):
            ris.append((b0, 0.7, dict(dur=4 * X.beat)))
        if e >= 2 or calm:
            X.pump_beats += [b0 + k for k in range(4)]
        # FM bass
        if calm:
            bass += [(b0, 1.4, root + 12, 0.7), (b0 + 1.5, 0.9, root + 12, 0.55), (b0 + 2.5, 1.4, root + 24, 0.55)]
        elif e >= 3:
            if dark:
                bass += [(b0 + k * 0.25, 0.22, root + (12 if k % 8 in (3, 6) else 0), 0.9 if k % 4 == 0 else 0.65) for k in range(16)]
            else:
                for t, a in gallop(b0):
                    o = t - b0
                    bass.append((t, 0.42 if o % 1 == 0 else 0.2, root + (12 if o % 1 == 0.5 else 0), 0.6 + 0.35 * a))
        elif e == 2:
            bass += [(b0 + k * 0.5, 0.45, root + (12 if k % 4 == 3 else 0), 0.85 if k % 2 == 0 else 0.6) for k in range(8)]
        else:
            bass += [(b0, 3.8, root, 0.7)]
        # pads
        padn += [(b0, 3.95, m, 0.55 + 0.05 * e) for m in voice(ch, 62 if not dark else 57, 4 if e >= 4 else 3)]
        # arpeggio
        tones = ch.voicing(62, 88)
        if calm:
            arp += [(b0 + k * 0.5, 0.4, tones[[0, 1, 2, 3, 4, 3, 2, 1][k] % len(tones)], 0.5) for k in range(8)]
        elif e >= 1:
            order = [0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 4, 3, 2, 1] if not is_b(b) else [0, 2, 1, 3, 2, 4, 3, 5, 4, 5, 3, 4, 2, 3, 1, 2]
            arp += [(b0 + k * 0.25, 0.2, tones[order[k] % len(tones)], (0.5 + 0.06 * e) * (1.15 if k % 4 == 0 else 0.85)) for k in range(16)]
        else:
            arp += [(b0 + k, 0.5, tones[k % len(tones)], 0.5) for k in range(4)]

    X.add("kick", S.kick, kick, kw=dict(kind="synth"), peak=-6, pitched=False, human=(0.0, 0.03))
    X.add("snare", S.snare, snr, kw=dict(kind="gated"), peak=-9, rev2=0.9, pitched=False, human=(0.001, 0.04))
    X.add("clap", S.clap, clp, peak=-14, pan=0.15, rev2=0.5, rev=0.15, pitched=False)
    X.add("hat", S.hat, hat, peak=-16, pan=0.3, rev=0.05, pitched=False, human=(0.001, 0.08))
    X.add("openhat", S.hat, ohat, kw=dict(kind="open"), peak=-19, pan=-0.3, rev=0.1, pitched=False)
    X.add("toms", S.tom, tom, peak=-9, rev2=0.7, rev=0.1, pitched=False)
    X.add("riser", S.riser, ris, peak=-17, rev=0.3, pitched=False)
    X.add("crash", S.cymbal, cym, peak=-15, rev=0.3, pitched=False)
    X.add("bass", S.fmbass, bass, kw=dict(index=6.0 if dark else 4.5), level=-16, duck=0.7, human=(0.001, 0.04))
    X.add("pad", S.supersaw, padn, kw=dict(detune=0.4, cut=(350, 2400 if not dark else 1700), att=0.12, dec=1.5, sus=0.75, rel=0.3),
          level=-23 if not calm else -21, rev=0.4, duck=1.0, human=(0.0, 0.03))
    X.add("arp", S.synthpluck, arp, kw=dict(cut=(500, 5500), dec=0.09), level=-23, pan=-0.2, rev=0.25, dly=0.45, duck=0.5,
          human=(0.0, 0.04))

    es = end_spans(F)
    if es:
        lose = F.kind == "lose"
        chords, low, hits, tm = [], [], [], []
        for b, d, ch, is_last in es:
            hold = d + (2.5 if is_last and F.kind == "video" else 0)
            chords += [(b, hold * 0.97, m, 0.85) for m in voice(ch, 62 if not lose else 57, 4)]
            low.append((b, hold * 0.95, ch.bass(29), 0.95))
            hits.append((b, 0.95))
            if is_last and not lose:
                tm += [(b - 1 + k * 0.25, 0.8, dict(f=[165.0, 140.0, 110.0, 82.0][k])) for k in range(4)]
                X.add("end_crash", S.cymbal, [(b, 0.9)], kw=dict(t60=2.5), peak=-13, rev=0.4, pitched=False)
        endmel = F.mel_in(lambda b: sec[b] == "end")
        X.add("end_lead", S.supersaw, tune(endmel, 0.9 if not lose else 0.7, -12 if lose else 0),
              kw=dict(detune=0.28, cut=(1100, 7500) if not lose else (500, 2500), sus=0.75), level=-16, rev=0.35, dly=0.3, check=True)
        if not lose:
            X.add("end_bell", S.fmbell, tune(endmel, 0.8, 12), level=-22, rev=0.45, dly=0.3)
            X.add("end_snare", S.snare, hits, kw=dict(kind="gated"), peak=-9, rev2=0.9, pitched=False)
            X.add("end_toms", S.tom, tm, peak=-9, rev2=0.7, pitched=False)
        X.add("end_kick", S.kick, hits if not lose else hits[-1:], kw=dict(kind="synth"), peak=-6, pitched=False)
        X.add("end_pad", S.supersaw, chords, kw=dict(detune=0.4, cut=(500, 4500 if not lose else 1500), att=0.01, dec=2.0, sus=0.6, rel=0.4),
              level=-19, rev=0.45)
        X.add("end_bass", S.fmbass, low, kw=dict(index=5.0, dec=0.4), level=-16)
