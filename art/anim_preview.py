"""Animated previews of the packed character atlases (base/public/atlas), for reviewing motion by eye.

    python3 art/anim_preview.py [--only kind,kind] [--tiers 1,4] [--out art/contact/anim]

Per body kind it writes <out>/<kind>.gif and <out>/<kind>.png:
  .gif  every clip in game order and at game timing (idle loop, walk, wind-up then strike, cast, death), side by side
        for the side view (E, with ground ticks scrolling at the walk speed: a planted foot should stay on its tick),
        the three-quarter view (SE) and the back view (N), tier 1 and the highest tier.
  .png  a contact strip: every frame of every clip, five facings for tier 1 and the SE facing for the other tiers,
        each cell anchored on one baseline with the ground anchor marked, to catch anchor jumps between clips.
Reads the sheets back exactly as the runtime does (pack_atlas.load_sheet / tint_palette), so it reviews what ships.
"""
import argparse
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from muster_art import style as STYLE  # noqa: E402
from pack_atlas import OUT, sheet_rgba  # noqa: E402
from post import NAMES, ORDER, font  # noqa: E402

# runtime timing (base/src/render/sprites.ts CLIP_TIME / units.ts animFor), seconds
IDLE_PERIOD = {"heavy": 1.9, "mid": 1.6, "light": 1.35}
WINDUP = {"heavy": 0.2, "mid": 0.16, "light": 0.12}
STRIKE = 0.35
CAST = 0.62
DEATH = 0.45
WALK_CADENCE = 2.2  # cycles per second in the preview (the game derives it from speed / stride)
BG = (74, 96, 66, 255)


def frames_of(man, key, anim, d8, team, cache):
    sh = man["sheets"][key]
    an = sh["anims"].get(anim)
    if an is None:
        return []
    if isinstance(an, str):
        an = sh["anims"][an]
    if (key, team) not in cache:
        cache[(key, team)] = sheet_rgba(man, key, team)
    img = cache[(key, team)]
    di, mirror = STYLE.DIR8[d8]
    out = []
    for r in an[di]:
        x, y, w, h, ax, ay = r[:6]
        s = r[6] if len(r) > 6 else 1.0
        im = img.crop((x, y, x + w, y + h))
        if mirror:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
            ax = w - ax
        if s != 1.0:
            im = im.resize((max(1, round(w / s)), max(1, round(h / s))), Image.BILINEAR)
            ax, ay = ax / s, ay / s
        out.append((im, ax, ay))
    return out


def timeline(man, key):
    """[(anim, frame index, seconds)] for one pass through every clip, at game timing."""
    sh = man["sheets"][key]
    w = sh.get("weight", "mid")
    n = {a: (len(v[0]) if isinstance(v, list) else 0) for a, v in sh["anims"].items()}
    imp = man.get("impact", {}).get("attack", 2)
    seq = []
    per = IDLE_PERIOD[w] / n["idle"]
    seq += [("idle", i % n["idle"], per) for i in range(n["idle"] * 2)]
    if n.get("walk"):
        seq += [("walk", i % n["walk"], 1 / (WALK_CADENCE * n["walk"])) for i in range(n["walk"] * 3)]
    seq += [("idle", 0, 0.25)]
    seq += [("attack", i, WINDUP[w] / imp) for i in range(imp)]
    seq += [("attack", i, STRIKE / (n["attack"] - imp)) for i in range(imp, n["attack"])]
    seq += [("idle", i % n["idle"], per) for i in range(3)]
    if n.get("cast"):
        ci = man.get("impact", {}).get("cast", 2)
        seq += [("cast", i, (CAST * 0.3) / ci) for i in range(ci)]
        seq += [("cast", i, (CAST * 0.7) / (n["cast"] - ci)) for i in range(ci, n["cast"])]
        seq += [("idle", i % n["idle"], per) for i in range(3)]
    seq += [("death", i, DEATH / n["death"]) for i in range(n["death"])]
    seq += [("death", n["death"] - 1, 0.6)]
    return seq


def gif(man, kind, tiers, path):
    cache = {}
    keys = [f"{kind}_t{t}" for t in tiers if f"{kind}_t{t}" in man["sheets"]]
    panels = []  # (key, d8, ticks)
    for j, key in enumerate(keys):
        for d8 in ((0, 1, 6) if j == 0 else (1,)):
            panels.append((key, d8, d8 == 0))
    seq = timeline(man, keys[0])
    sh0 = man["sheets"][keys[0]]
    stride_px = sh0.get("stride", 0) * man["ppu"]
    # cell size from every frame used
    ext = [0, 0, 0, 0]  # left, right, up, down from the anchor
    for key, d8, _ in panels:
        for anim in ("idle", "walk", "attack", "cast", "death"):
            for im, ax, ay in frames_of(man, key, anim, d8, "tide", cache):
                ext = [max(ext[0], ax), max(ext[1], im.width - ax), max(ext[2], ay), max(ext[3], im.height - ay)]
    cw, up = int(ext[0] + ext[1] + 24), int(ext[2] + 18)
    chh = int(up + ext[3] + 14)
    W = cw * len(panels)
    out, durs = [], []
    scroll = 0.0
    f = font(12)
    for anim, i, dt in seq:
        canvas = Image.new("RGBA", (W, chh), BG)
        d = ImageDraw.Draw(canvas)
        if anim == "walk":
            scroll += stride_px / len(man["sheets"][keys[0]]["anims"]["walk"][0])
        for p, (key, d8, ticks) in enumerate(panels):
            x0 = p * cw
            cx, cy = x0 + int(ext[0]) + 12, up
            d.line([(x0, cy), (x0 + cw, cy)], fill=(62, 82, 56, 255))
            if ticks:
                for t in range(-2, cw // 24 + 3):
                    tx = x0 + int(t * 24 - scroll % 24)
                    if x0 <= tx < x0 + cw:
                        d.line([(tx, cy - 3), (tx, cy + 3)], fill=(236, 226, 190, 255))
            d.ellipse([cx - 16, cy - 6, cx + 16, cy + 6], fill=(46, 62, 42, 255))
            fr = frames_of(man, key, anim, d8, "tide", cache)
            if fr:
                im, ax, ay = fr[min(i, len(fr) - 1)]
                canvas.alpha_composite(im, (int(round(cx - ax)), int(round(cy - ay))))
            d.text((x0 + 4, chh - 14), f"{key.split('_')[1]} {['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][d8]}", fill=(230, 236, 222, 255), font=f)
        d.text((4, 2), f"{NAMES.get(kind, kind)}  {anim} {i}", fill=(255, 255, 255, 255), font=f)
        out.append(canvas.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
        durs.append(max(20, int(round(dt * 1000 / 10)) * 10))
    out[0].save(path, save_all=True, append_images=out[1:], duration=durs, loop=0, optimize=True, disposal=1)
    return path


def strip(man, kind, tiers, path):
    cache = {}
    key0 = f"{kind}_t{tiers[0]}"
    anims = [a for a in ("idle", "walk", "attack", "cast", "death") if isinstance(man["sheets"][key0]["anims"].get(a), list)]
    cols = [(a, i) for a in anims for i in range(len(man["sheets"][key0]["anims"][a][0]))]
    rows = [(key0, d8) for d8 in (0, 1, 2, 7, 6)] + [(f"{kind}_t{t}", 1) for t in tiers[1:] if f"{kind}_t{t}" in man["sheets"]]
    cells = {}
    ext = [0, 0, 0, 0]
    for key, d8 in rows:
        for a in anims:
            for i, (im, ax, ay) in enumerate(frames_of(man, key, a, d8, "tide", cache)):
                cells[(key, d8, a, i)] = (im, ax, ay)
                ext = [max(ext[0], ax), max(ext[1], im.width - ax), max(ext[2], ay), max(ext[3], im.height - ay)]
    cw, up = int(ext[0] + ext[1] + 8), int(ext[2] + 6)
    chh = int(up + ext[3] + 6)
    sheet = Image.new("RGBA", (cw * len(cols) + 60, chh * len(rows) + 20), BG)
    d = ImageDraw.Draw(sheet)
    f = font(12)
    for j, (a, i) in enumerate(cols):
        d.text((60 + j * cw + 2, 4), f"{a[:2]}{i}", fill=(240, 245, 235, 255), font=f)
    for r, (key, d8) in enumerate(rows):
        y0 = 20 + r * chh
        d.text((4, y0 + up - 8), f"{key.split('_')[1]} {['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][d8]}", fill=(240, 245, 235, 255), font=f)
        d.line([(60, y0 + up), (sheet.width, y0 + up)], fill=(62, 82, 56, 255))
        for j, (a, i) in enumerate(cols):
            c = cells.get((key, d8, a, i))
            if not c:
                continue
            im, ax, ay = c
            cx = 60 + j * cw + int(ext[0]) + 4
            sheet.alpha_composite(im, (int(round(cx - ax)), int(round(y0 + up - ay))))
            d.line([(cx, y0 + up - 2), (cx, y0 + up + 2)], fill=(255, 70, 70, 255))
    sheet.convert("RGB").save(path, optimize=True)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--tiers", default="1,4")
    ap.add_argument("--out", default=os.path.join(HERE, "contact", "anim"))
    ap.add_argument("--no-gif", action="store_true")
    a = ap.parse_args()
    man = json.load(open(os.path.join(OUT, "manifest.json")))
    want = {x.strip() for x in a.only.split(",") if x.strip()}
    tiers = [int(x) for x in a.tiers.split(",")]
    os.makedirs(a.out, exist_ok=True)
    for kind in [k for k in ORDER if k in man["units"]]:
        if want and kind not in want:
            continue
        ts = [t for t in tiers if t in man["units"][kind]["tiers"]] or man["units"][kind]["tiers"][:1]
        p = strip(man, kind, ts, os.path.join(a.out, f"{kind}.png"))
        g = "" if a.no_gif else gif(man, kind, ts, os.path.join(a.out, f"{kind}.gif"))
        print("PREVIEW", kind, p, g, flush=True)


if __name__ == "__main__":
    main()
