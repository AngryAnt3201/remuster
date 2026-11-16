"""Pixelkeep: 8-bit. Strictly NES-shaped: two pulse channels, one triangle, one noise channel, plus a pitch-dropped
triangle standing in for the DPCM kick. Pulse 1 sings the tune (duty flips from 12.5% to 25% as each note speaks, 50%
in B); pulse 2 plays 60 Hz arpeggiated chords on the gallop, or the countermelody, or a harmony line; the triangle
bounces octaves; noise is the drum kit. Almost dry, almost mono, as the hardware was."""
import synth as S
from .common import BEATS, body, end_spans, tune, gallop, roll

NAME = "chiptune"


def _arp(ch):
    """Semitone offsets from the root for a 60 Hz chord arpeggio."""
    r, t, f = ch.tones[:3]
    return [0, (t - r) % 12, (f - r) % 12, 12]


def arrange(X, F):
    X.reverb = ("room", dict(rt=0.35, pre=0.0, bright=0.6, seed=51))
    X.drive = 0.0
    calm, dark = F.kind == "home", F.dark
    E, sec = F.energy, F.sec
    is_b = lambda b: sec[b] == "B"
    main = lambda b: sec[b] != "end"
    VIB = (6.0, 22.0, 0.22)

    def lead(notes, duty, env="hold", tr=0, base=0.8):
        out = []
        for b, d, m, v in tune(notes, base, tr, legato=0.9):
            out.append((b, d, m, v, dict(duty=duty, env=env, vib=VIB if d >= 1.0 else (0, 0, 0))))
        return out

    tr = -12 if dark else 0
    p1 = lead(F.mel_in(lambda b: main(b) and not is_b(b)), (0.125, 0.125, 0.25) if not dark else (0.25, 0.125), "swell" if calm else "hold", tr)
    p1 += lead(F.mel_in(lambda b: main(b) and is_b(b)), (0.25, 0.5) if not dark else (0.125, 0.25), "swell" if calm else "hold", tr)
    X.add("pulse1", S.chip_pulse, p1, level=-17, pan=-0.12, rev=0.06, check=True, human=(0.0, 0.0))

    p2, tri, kick, snr, hat = [], [], [], [], []
    ctr_bars = lambda b: main(b) and E[b] == 4 and not is_b(b) and not dark
    for b, d, m, v in tune(F.ctr_in(ctr_bars), 0.6, 12, legato=0.85):
        p2.append((b, d, m, v, dict(duty=(0.5,), env="hold", vib=VIB if d >= 2 else (0, 0, 0))))
    # in B, pulse 2 shadows the tune a chord tone below, one eighth late: a hardware echo that is also harmony
    if not calm:
        for b, d, m, bar in F.mel:
            if main(bar) and is_b(bar) and E[bar] >= 2:
                h = F.chord_at(b).near(m + tr - 4)
                if h >= m + tr:
                    h = F.chord_at(b).near(m + tr - 8)
                p2.append((b, d * 0.85, h, 0.55, dict(duty=(0.25,), env="hold")))
    for b, b0, ch, e in body(F):
        last = F.last(b)
        root = ch.bass(43)
        arp = _arp(ch)
        if calm:
            tones = ch.voicing(60, 84)
            p2 += [(b0 + k * 0.5, 0.45, tones[[0, 1, 2, 3, 4, 3, 2, 1][k] % len(tones)], 0.5, dict(duty=(0.5,), env="pluck")) for k in range(8)]
            tri += [(b0, 1.8, root, 0.8), (b0 + 2, 1.8, root + 7 if root + 7 <= 55 else root - 5, 0.8)]
            hat += [(b0 + k, 0.4, dict(dur=0.03, period=1, dec=0.02)) for k in range(4)]
            continue
        # pulse 2: arpeggiated chords where it is not busy with the counter or harmony line
        if not ctr_bars(b) and not (is_b(b) and e >= 2):
            if e >= 5 or dark:
                p2 += [(b0 + k * 0.25, 0.22, ch.bass(60), 0.6 if k % 4 else 0.75, dict(duty=(0.5,), env="decay", arp=arp)) for k in range(16)]
            elif e >= 1:
                p2 += [(t, 0.42 if (t - b0) % 1 == 0 else 0.2, ch.bass(60), 0.45 + 0.3 * a, dict(duty=(0.5,), env="decay", arp=arp))
                       for t, a in gallop(b0)]
            else:
                p2 += [(b0, 3.5, ch.bass(60), 0.5, dict(duty=(0.5,), env="decay", arp=arp, arp_frames=3))]
        # triangle bass
        if e >= 4:
            tri += [(t, 0.4 if (t - b0) % 1 == 0 else 0.2, root + (12 if (t - b0) % 1 else 0) + (7 if (t - b0) == 2 and not dark else 0), 0.8)
                    for t, a in gallop(b0)]
        elif e >= 2:
            tri += [(b0 + k * 0.5, 0.42, root + (12 if k % 2 else 0), 0.8) for k in range(8)]
        elif e == 1:
            tri += [(b0 + k, 0.8, root, 0.8) for k in range(4)]
        else:
            tri += [(b0, 3.5, root + 12, 0.8)]
        # drums
        if e >= 2:
            kick += [(b0, 0.9), (b0 + 2, 0.85)] + ([(b0 + 1, 0.8), (b0 + 3, 0.8)] if e >= 5 or dark else []) + ([(b0 + 2.5, 0.6)] if e >= 4 else [])
            if e >= 3:
                if last:
                    snr += [(b0 + 1, 0.8)] + [(t, v, dict(dur=0.06)) for t, v in roll(b0 + 2, b0 + 4, 0.25, 0.4, 0.95)]
                else:
                    snr += [(b0 + 1, 0.85), (b0 + 3, 0.9)]
            n16 = e >= 4
            hat += [(b0 + k * (0.25 if n16 else 0.5), 0.6 if k % (4 if n16 else 2) == 0 else 0.35, dict(dur=0.03, period=1, dec=0.025))
                    for k in range(16 if n16 else 8)]
        elif e == 1:
            hat += [(t, 0.5 * a, dict(dur=0.03, period=1, dec=0.025)) for t, a in gallop(b0)]
            if last:
                snr += [(t, v, dict(dur=0.06)) for t, v in roll(b0 + 2, b0 + 4, 0.25, 0.4, 0.9)]

    X.add("pulse2", S.chip_pulse, p2, level=-23, pan=0.2, rev=0.06, human=(0.0, 0.0))
    X.add("triangle", S.chip_tri, tri, level=-16, pan=0.0, human=(0.0, 0.0))
    X.add("dmc_kick", S.chip_tri, [(b, 0.22, 64, v, dict(drop=24.0)) for b, v in kick], level=-15, human=(0.0, 0.0))
    X.add("noise_snare", S.chip_noise, snr, kw=dict(dur=0.11, period=6, dec=0.1), peak=-12, pan=0.05, rev=0.08, pitched=False,
          human=(0.0, 0.03))
    X.add("noise_hat", S.chip_noise, hat, peak=-21, pan=-0.05, pitched=False, human=(0.0, 0.03))

    es = end_spans(F)
    if es:
        lose = F.kind == "lose"
        c2, lo_, kk, ns = [], [], [], []
        for b, d, ch, is_last in es:
            hold = d + (2.5 if is_last and F.kind == "video" else 0)
            c2.append((b, hold * 0.95, ch.bass(60 if not lose else 48), 0.7, dict(duty=(0.5,), env="decay" if not is_last else "hold", arp=_arp(ch),
                                                                                  arp_frames=1 if not lose else 3)))
            lo_.append((b, hold * 0.9, ch.bass(43), 0.8))
            kk.append((b, 0.9))
            ns.append((b, 0.9, dict(dur=0.25 if is_last else 0.1, period=8 if is_last else 6, dec=0.25 if is_last else 0.1)))
        endmel = F.mel_in(lambda b: sec[b] == "end")
        e1 = [(b, d, m, v, dict(duty=(0.125, 0.25) if not lose else (0.5,), env="hold", vib=VIB if d >= 1 else (0, 0, 0)))
              for b, d, m, v in tune(endmel, 0.85, -12 if lose else 0, legato=0.92)]
        X.add("end_pulse1", S.chip_pulse, e1, level=-17, pan=-0.12, rev=0.06, check=True, human=(0.0, 0.0))
        X.add("end_pulse2", S.chip_pulse, c2, level=-22, pan=0.2, rev=0.06, human=(0.0, 0.0))
        X.add("end_triangle", S.chip_tri, lo_, level=-16, human=(0.0, 0.0))
        if not lose:
            X.add("end_kick", S.chip_tri, [(b, 0.22, 64, v, dict(drop=24.0)) for b, v in kk], level=-15, human=(0.0, 0.0))
            X.add("end_noise", S.chip_noise, ns, peak=-12, rev=0.08, pitched=False, human=(0.0, 0.0))
