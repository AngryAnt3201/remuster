"""Cindermaw: heavy metal through a 1993 FM sound card. Two rhythm guitars (hard left and right) chug palm-muted power
chords on the chord roots, low D at the bottom, on the gallop; an FM bass doubles them an octave down; the kit is a
clicky triggered kick (sixteenth-note double-kick when the energy is up), a 12-bit snare on 2 and 4 and tom fills. The
tune is a nasal FM lead guitar, with a second guitar a third or a fifth under it in the full sections. `home` is the
same band playing doom: held chords, a slow quarter-note chug, a pipe organ and a choir, a bell tolling the changes.
The `dark` boss form drops the tune an octave, keeps the double-kick running and puts the organ and choir behind it."""
import synth as S
from .common import BEATS, body, end_spans, tune, gallop, roll, voice

NAME = "cindermaw"

TOMS = [150.0, 122.0, 98.0, 74.0]


def _under(F, b, m):
    """The chord tone a third (or, failing that, a fifth or sixth) under a tune note: the harmony guitar."""
    h = F.chord_at(b).near(m - 4)
    return h if h < m - 2 else F.chord_at(b).near(m - 8)


def arrange(X, F):
    X.reverb = ("room", dict(rt=0.7, pre=0.004, bright=0.45, seed=71))
    X.reverb2 = ("gated", dict(gate=0.15, seed=72))
    X.delay = (0.75, 0.3, 2600.0)
    X.master_eq = [("peak", 95, 1.5, 1.0), ("peak", 420, -1.5, 0.8), ("hishelf", 7500, -2.5, 0.7)]   # a sound card has no air
    X.drive = 1.25
    calm, dark = F.kind == "home", F.dark
    E, sec = F.energy, F.sec
    is_b = lambda b: sec[b] == "B"
    main = lambda b: sec[b] != "end"
    full = lambda b: main(b) and E[b] >= 4
    M = dict(mute=True)

    # ---- the tune: lead guitar, and the harmony guitar under it when the band is full
    tr = -12 if (dark or calm) else 0
    lead_kw = dict(drive=1.3, att=0.02, vib=(4.8, 12.0, 0.35)) if calm else dict(drive=2.4 if dark else 2.2)
    X.add("lead", S.fmlead, tune(F.mel_in(main), 0.7 if calm else 0.82, tr), kw=lead_kw, level=-19 if calm else -17, pan=-0.1,
          rev=0.35 if calm else 0.14, dly=0.22 if calm else 0.1, check=True, human=(0.003, 0.04))
    if not calm and not dark:
        harm = [(b, d * 0.94, _under(F, b, m), 0.7) for b, d, m, bar in F.mel if full(bar)]
        X.add("harmony", S.fmlead, harm, kw=dict(drive=2.0, vib=(5.6, 10.0, 0.25)), level=-22, pan=0.28, rev=0.14, dly=0.08,
              human=(0.004, 0.05))
    if dark:   # the boss has no sweet thirds: the tune comes back in its own octave over the top in the B sections
        X.add("lead_high", S.fmlead, tune(F.mel_in(lambda b: main(b) and is_b(b)), 0.7, 0), kw=dict(drive=2.0), level=-24, pan=0.25,
              rev=0.2, dly=0.12, human=(0.004, 0.05))

    gl, gr, bass, kick, snr, hat, ohat, crash, tom, organ, choir, toll, ctr = ([] for _ in range(13))

    def both(note):
        gl.append(note)
        gr.append(note)

    if calm:
        # doom: one chord per harmony change, held; the organ and choir carry it, the guitars sit under them
        for b, d, ch in F.spans:
            bar = int(b) // BEATS
            organ += [(b, d * 0.985, m, 0.6) for m in voice(ch, 50, 3)]
            bass.append((b, d * 0.95, ch.bass(33), 0.7, dict(dec=0.6, index=3.0)))
            toll.append((b, 0.2, ch.bass(50), 0.7 if F.first(bar) else 0.5))
            if E[bar] >= 2:
                choir += [(b, d * 0.97, m, 0.6) for m in voice(ch, 62, 3)]
                both((b, d * 0.97, ch.bass(38), 0.75))
        for b, b0, ch, e in body(F):
            if e < 2:      # A: a slow chug, one muted chord a beat, on one side only; a heartbeat of a kick
                gl += [(b0 + k, 0.5, ch.bass(38), 0.7 if k == 0 else 0.5, M) for k in range(4)]
                kick += [(b0, 0.7), (b0 + 0.5, 0.45)]
            else:          # B: half-time kit
                kick += [(b0, 0.8), (b0 + 2.5, 0.5)]
                snr.append((b0 + 2, 0.6))
                hat += [(b0 + k, 0.4) for k in range(4)]
                if F.last(b):
                    tom += [(b0 + 3 + k * 0.5, 0.6 + 0.1 * k, dict(f=TOMS[2 + k])) for k in range(2)]
    else:
        for b, b0, ch, e in body(F):
            last, first = F.last(b), F.first(b)
            root, low = ch.bass(38), ch.bass(31)
            heavy = e >= 5 or dark
            # ---- rhythm guitars and bass
            if is_b(b):
                # B: open power chords on the tune's 3+3+2, muted sixteenths running between them when it is heavy
                for o, d in ((0.0, 1.5), (1.5, 1.5), (3.0, 1.0)):
                    both((b0 + o, 0.5 if heavy else d * 0.92, root, 0.9))
                    bass.append((b0 + o, d * 0.9, low, 0.9))
                if heavy:
                    for k in range(16):
                        if k * 0.25 not in (0.0, 0.25, 1.5, 1.75, 3.0, 3.25):
                            both((b0 + k * 0.25, 0.22, root, 0.6, M))
            elif heavy:
                # sixteenths, all muted but an open chord kicking the bar off and one pushing into beat 3
                for k in range(16):
                    o = k * 0.25
                    if o in (0.25, 2.75):
                        continue
                    if o in (0.0, 2.5):
                        both((b0 + o, 0.45, root, 0.9))
                    else:
                        both((b0 + o, 0.22, root, 0.7 if k % 4 == 0 else 0.55, M))
                    bass.append((b0 + o, 0.22, low + (12 if k % 8 == 6 else 0), 0.85 if k % 4 == 0 else 0.6))
            else:
                # the gallop, palm-muted; every second bar ends on an open chord held through beat 4
                held = b % 2 == 1 and not last
                for t, a in gallop(b0, beats=(0, 1, 2) if held else (0, 1, 2, 3)):
                    on = (t - b0) % 1 == 0
                    both((t, 0.45 if on else 0.22, root, 0.5 + 0.4 * a, M))
                    bass.append((t, 0.42 if on else 0.2, low, 0.55 + 0.35 * a))
                if held:
                    both((b0 + 3, 0.95, root, 0.9))
                    bass.append((b0 + 3, 0.9, low, 0.9))
            # ---- kit
            if last:
                # the fill: snare and toms down the kit over the last two beats, kick under it
                kick += [(b0, 0.95), (b0 + 0.75, 0.7), (b0 + 1.5, 0.8)] + [(b0 + 2 + k * 0.5, 0.8) for k in range(4)]
                snr += [(b0 + 1, 0.9)] + [(t, v) for t, v in roll(b0 + 2, b0 + 3, 0.25, 0.5, 0.9)]
                tom += [(b0 + 3 + k * 0.25, 0.75 + 0.06 * k, dict(f=TOMS[k])) for k in range(4)]
                hat += [(b0 + k * 0.5, 0.5) for k in range(4)]
            else:
                if heavy:
                    kick += [(b0 + k * 0.25, 0.9 if k % 4 == 0 else 0.62 + 0.08 * (k % 2)) for k in range(16)]
                elif e >= 4:
                    kick += [(t, 0.6 + 0.35 * a) for t, a in gallop(b0, beats=(0, 2))] + [(b0 + 1.75, 0.6), (b0 + 3.75, 0.6)]
                else:
                    kick += [(b0, 0.95), (b0 + 0.75, 0.6), (b0 + 2, 0.9), (b0 + 2.5, 0.65)]
                snr += [(b0 + 1, 0.9), (b0 + 3, 0.95)]
                if heavy:
                    hat += [(b0 + k, 0.7) for k in range(4)]             # quarters ride over the double-kick
                    ohat += [(b0 + k + 0.5, 0.5) for k in (1, 3)]
                else:
                    hat += [(b0 + k * 0.5, 0.65 if k % 2 == 0 else 0.4) for k in range(8)]
            if first or (heavy and F.pos(b) == 4):
                crash.append((b0, 0.85))
            # ---- behind the band
            if dark:
                organ += [(b0, 3.9, m, 0.6) for m in voice(ch, 50, 3)]
                if is_b(b) or e >= 5:
                    choir += [(b0, 3.9, m, 0.6) for m in voice(ch, 60, 3)]
                if first:
                    toll.append((b0, 0.2, ch.bass(50), 0.8))
            elif is_b(b) and e >= 4:
                choir += [(b0, 3.9, m, 0.55) for m in voice(ch, 62, 3)]
        if not dark:   # the last A: the organ takes the countermelody under everything
            ctr = tune(F.ctr_in(lambda b: main(b) and E[b] >= 5 and not is_b(b)), 0.6, 0, legato=0.9)

    gk = dict(gain=4.0)
    X.add("guitar_l", S.fmguitar, gl, kw=gk, level=-24 if calm else -20, pan=-0.7, rev=0.2 if calm else 0.06, human=(0.003, 0.05))
    X.add("guitar_r", S.fmguitar, gr, kw=gk, level=-24 if calm else -20, pan=0.7, rev=0.2 if calm else 0.06, human=(0.004, 0.05))
    X.add("bass", S.fmbass, bass, kw=dict(index=5.5 if dark else 4.5, dec=0.1), level=-19 if calm else -17, human=(0.002, 0.04))
    X.add("kick", S.metalkick, kick, peak=-9 if calm else -6, pitched=False, human=(0.001, 0.04))
    X.add("snare", S.metalsnare, snr, peak=-13 if calm else -9, rev2=0.55, rev=0.08, pitched=False, human=(0.001, 0.04))
    X.add("hat", S.hat, hat, peak=-22 if calm else -19, pan=0.3, pitched=False, human=(0.001, 0.08))
    X.add("openhat", S.hat, ohat, kw=dict(kind="open"), peak=-21, pan=0.3, pitched=False)
    X.add("crash", S.cymbal, crash, kw=dict(t60=1.6), peak=-15, pan=-0.25, rev=0.15, pitched=False)
    X.add("toms", S.tom, tom, peak=-13 if calm else -9, rev2=0.5, rev=0.08, pitched=False)
    X.add("organ", S.organ, organ, kw=dict(stops="plenum"), level=-21 if calm else -25, rev=0.5, human=(0.0, 0.03))
    X.add("choir", S.choir, choir, kw=dict(vowel="oh" if (calm or dark) else "ah"), level=-23 if calm else -25, rev=0.55, human=(0.0, 0.03))
    X.add("toll", S.bell, toll, kw=dict(kind="tubular"), level=-22 if calm else -23, pan=0.1, rev=0.55, human=(0.0, 0.03))
    X.add("counter", S.organ, ctr, kw=dict(stops="reed"), level=-25, pan=0.15, rev=0.3, human=(0.002, 0.04))

    es = end_spans(F)
    if es:
        lose = F.kind == "lose"
        chords, low, hits, org, tl, tm = [], [], [], [], [], []
        for b, d, ch, is_last in es:
            hold = d + (2.5 if is_last and F.kind == "video" else 0)
            chords.append((b, hold * 0.97, ch.bass(38), 0.95))
            low.append((b, hold * 0.95, ch.bass(31), 0.95, dict(dec=0.5)))
            hits.append((b, 0.95))
            if lose or is_last:
                org += [(b, hold * 0.97, m, 0.65) for m in voice(ch, 50, 3)]
            if is_last:
                tl.append((b, 0.2, ch.bass(50), 0.85))
                if not lose:
                    tm += [(b - 1 + k * 0.25, 0.75 + 0.06 * k, dict(f=TOMS[k])) for k in range(4)]
        endmel = F.mel_in(lambda b: sec[b] == "end")
        X.add("end_lead", S.fmlead, tune(endmel, 0.9 if not lose else 0.75, -12 if lose else 0),
              kw=dict(drive=2.2) if not lose else dict(drive=1.4, att=0.015, vib=(4.8, 14.0, 0.3)), level=-16, pan=-0.1, rev=0.2, dly=0.12,
              check=True, human=(0.002, 0.03))
        if not lose:
            X.add("end_harmony", S.fmlead, [(b, d * 0.94, _under(F, b, m), 0.75) for b, d, m, bar in F.mel if sec[bar] == "end"],
                  kw=dict(drive=2.0), level=-21, pan=0.28, rev=0.2, human=(0.003, 0.04))
            X.add("end_snare", S.metalsnare, hits[1:], peak=-9, rev2=0.6, pitched=False)
            X.add("end_toms", S.tom, tm, peak=-9, rev2=0.5, pitched=False)
            X.add("end_crash", S.cymbal, [hits[0], hits[-1]], kw=dict(t60=2.4), peak=-13, rev=0.25, pitched=False)
        X.add("end_guitar_l", S.fmguitar, chords, kw=gk, level=-19 if not lose else -21, pan=-0.7, rev=0.12)
        X.add("end_guitar_r", S.fmguitar, chords, kw=gk, level=-19 if not lose else -21, pan=0.7, rev=0.12, human=(0.005, 0.05))
        X.add("end_bass", S.fmbass, low, kw=dict(index=5.0), level=-16)
        X.add("end_kick", S.metalkick, hits if not lose else hits[-1:], peak=-6, pitched=False)
        X.add("end_organ", S.organ, org, kw=dict(stops="plenum"), level=-21 if lose else -24, rev=0.5)
        X.add("end_toll", S.bell, tl, kw=dict(kind="tubular"), level=-20 if lose else -24, rev=0.55)
