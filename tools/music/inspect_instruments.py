#!/usr/bin/env python3
"""Solo every instrument and draw its envelope and spectrum, so a session without ears can compare each one with
what the real instrument does (attack time, decay shape, where the energy sits, formants, noise).

  python3 tools/music/inspect_instruments.py        -> tools/music/out/instruments_<n>.png

Each cell: left = level over time (dB, 5 ms RMS); right = spectrum of the first 60 ms (orange) and of the sustain
(blue), log frequency. Needs matplotlib.
"""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
import synth as S  # noqa: E402

D5, D3, D2 = 74, 50, 38
SOLOS = [
    ("strings vn D5", lambda: S.strings(D5, 1.2)), ("strings vc D3", lambda: S.strings(D3, 1.2, kind="vc")),
    ("strings spicc", lambda: S.strings(62, 0.12, attack=0.012, release=0.07, vib=0, kind="va")),
    ("horn D4", lambda: S.brass(62, 1.0)), ("trumpet D5", lambda: S.brass(D5, 1.0, kind="trumpet")),
    ("cornet D5", lambda: S.brass(D5, 1.0, kind="cornet")), ("trombone D3", lambda: S.brass(D3, 1.0, kind="trombone")),
    ("tuba D2", lambda: S.brass(D2, 0.8, kind="tuba")), ("flute D5", lambda: S.flute(D5, 1.0)),
    ("whistle D6", lambda: S.flute(86, 1.0, kind="whistle")), ("shakuhachi D4", lambda: S.flute(62, 1.5, kind="shaku")),
    ("harp D4", lambda: S.harp(62, 0.5)),
    ("guitar D3", lambda: S.guitar(D3, 0.8)), ("twang D3", lambda: S.twang(D3, 1.0)), ("banjo D4", lambda: S.banjo(62, 0.4)),
    ("upright D2", lambda: S.upright(D2, 0.8)), ("koto D5", lambda: S.koto(D5, 1.0, yuri=True)), ("koto bass D2", lambda: S.koto(D2, 1.5)),
    ("shamisen D4", lambda: S.shamisen(62, 0.4)), ("harpsichord D4", lambda: S.harpsichord(62, 0.6)),
    ("honky-tonk D4", lambda: S.honkytonk(62, 1.0)), ("harmonica D5", lambda: S.harmonica(D5, 1.0)),
    ("accordion D5", lambda: S.accordion(D5, 1.0)), ("jaw harp D2", lambda: S.jawharp(D2, 0.8)),
    ("organ D4", lambda: S.organ(62, 1.0)), ("choir D4", lambda: S.choir(62, 1.5)), ("tubular bell D4", lambda: S.bell(62, 0.1, kind="tubular")),
    ("glock D6", lambda: S.bell(86, 0.1)), ("music box D6", lambda: S.bell(86, 0.1, kind="musicbox")),
    ("gong D2", lambda: S.bell(D2, 0.1, kind="gong")), ("supersaw D5", lambda: S.supersaw(D5, 1.0)),
    ("synth pluck D5", lambda: S.synthpluck(D5, 0.2)), ("fm bass D2", lambda: S.fmbass(D2, 0.4)), ("fm bell D5", lambda: S.fmbell(D5, 0.3)),
    ("chip pulse D5", lambda: S.chip_pulse(D5, 0.6, duty=(0.125, 0.125, 0.25), vib=(6, 22, 0.22))),
    ("chip arp", lambda: S.chip_pulse(62, 0.4, duty=(0.5,), env="decay", arp=[0, 3, 7, 12])),
    ("chip triangle D3", lambda: S.chip_tri(D3, 0.4)), ("chip noise snare", lambda: S.chip_noise(dur=0.11, period=6, dec=0.1)),
    ("kick rock", lambda: S.kick()), ("kick orch", lambda: S.kick(kind="orch")), ("kick synth", lambda: S.kick(kind="synth")),
    ("snare orch", lambda: S.snare()), ("snare gated", lambda: S.snare(kind="gated")), ("rimshot/gunshot", lambda: S.rim(kind="shot")),
    ("hat closed", lambda: S.hat()), ("crash", lambda: S.cymbal()), ("clap", lambda: S.clap()), ("tambourine", lambda: S.tambourine()),
    ("timpani D2", lambda: S.timpani(D2, 1.0)), ("odaiko", lambda: S.taiko()), ("shime", lambda: S.taiko(kind="shime")),
    ("ka (rim)", lambda: S.taiko(kind="ka")), ("clock tick", lambda: S.tick()), ("ratchet", lambda: S.ratchet()),
    ("anvil", lambda: S.anvil()), ("whip", lambda: S.whip()), ("steam hiss", lambda: S.steam(dur=0.8)),
    ("steam chuff", lambda: S.steam(dur=0.1, chuff=True)), ("hoof", lambda: S.clop()), ("impact", lambda: S.impact()),
    ("fm guitar D2", lambda: S.fmguitar(D2, 1.0)), ("fm guitar mute", lambda: S.fmguitar(D2, 0.2, mute=True)),
    ("fm lead D5", lambda: S.fmlead(D5, 1.0)), ("metal kick", lambda: S.metalkick()), ("metal snare", lambda: S.metalsnare()),
]


def main():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    S.set_sr(44100)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
    os.makedirs(out, exist_ok=True)
    per = 12
    for page in range(0, len(SOLOS), per):
        fig, axes = plt.subplots(4, 6, figsize=(21, 11))
        for i, (name, fn) in enumerate(SOLOS[page:page + per]):
            y = fn()
            y = y.mean(1) if y.ndim == 2 else y
            ax, bx = axes[i // 3][(i % 3) * 2], axes[i // 3][(i % 3) * 2 + 1]
            bl = int(0.005 * S.SR)
            nb = len(y) // bl
            rms = np.sqrt((y[:nb * bl].reshape(nb, bl) ** 2).mean(1) + 1e-12)
            ax.plot(np.arange(nb) * 0.005, 20 * np.log10(rms / rms.max()), lw=0.9)
            ax.set_ylim(-60, 3)
            ax.set_title(f"{name}  ({len(y) / S.SR:.2f}s)", fontsize=9)
            ax.grid(alpha=0.3)
            for seg, col in ((y[:int(0.06 * S.SR)], "tab:orange"), (y[int(0.3 * len(y)):int(0.7 * len(y))], "tab:blue")):
                if len(seg) < 256:
                    continue
                sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 1 << 15))
                f = np.fft.rfftfreq(1 << 15, 1 / S.SR)
                bx.semilogx(f[1:], 20 * np.log10(sp[1:] / sp.max() + 1e-6), lw=0.6, color=col)
            bx.set_xlim(30, 20000)
            bx.set_ylim(-80, 3)
            bx.grid(alpha=0.3, which="both")
        for j in range(len(SOLOS[page:page + per]), per):
            axes[j // 3][(j % 3) * 2].axis("off")
            axes[j // 3][(j % 3) * 2 + 1].axis("off")
        fig.tight_layout()
        path = os.path.join(out, f"instruments_{page // per + 1}.png")
        fig.savefig(path, dpi=70)
        plt.close(fig)
        print(path)


if __name__ == "__main__":
    main()
