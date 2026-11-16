"""Review contact sheets: one row per kind, tiers 1-4, tide then ember, SE idle frame 0, tinted like base/src/render/sprites.ts.
    python3 art/contact_characters.py   -> outputs/review/characters/sheet_<n>.png"""
import json, os
import numpy as np
from PIL import Image, ImageDraw
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(R, "base", "public", "atlas")
m = json.load(open(os.path.join(A, "manifest.json")))
hexc = lambda h: np.array([int(h[i:i+2], 16) / 255 for i in (1, 3, 5)])
S, CW, CH, AX, AY = 1.5, 240, 330, 120, 270
def tint(kind, tier, team):
    key = f"{kind}_t{tier}"
    col = np.asarray(Image.open(f"{A}/{key}.png").convert("RGBA"), float)
    mk = np.asarray(Image.open(f"{A}/{key}_m.png").convert("RGBA"), float) / 255
    t = m["teams"][team]; k = [(hexc(t[n]) - 1) for n in ("main", "dark", "light")]
    f = 1 + mk[..., 0:1] * k[0] + mk[..., 1:2] * k[1] + mk[..., 2:3] * k[2]
    out = col.copy(); out[..., :3] = np.clip(col[..., :3] * f, 0, 255)
    return Image.fromarray(out.astype(np.uint8)), key
kinds = list(m["units"])
def cell(kind, tier, team):
    img, key = tint(kind, tier, team)
    x, y, w, h, ax, ay = m["sheets"][key]["anims"]["idle"][1][0]
    sp = img.crop((x, y, x + w, y + h)).resize((int(w * S), int(h * S)), Image.LANCZOS)
    c = Image.new("RGBA", (CW, CH), (0, 0, 0, 0)); c.alpha_composite(sp, (int(AX - ax * S), int(AY - ay * S))); return c
for n in range(0, len(kinds), 6):
    ks = kinds[n:n+6]
    sheet = Image.new("RGBA", (110 + 8 * CW, len(ks) * CH), (94, 140, 70, 255))
    d = ImageDraw.Draw(sheet)
    for r, kind in enumerate(ks):
        tiers = m["units"][kind]["tiers"]
        d.text((8, r * CH + 8), kind, fill=(255, 255, 255, 255))
        for ti, tier in enumerate(tiers):
            for si, team in enumerate(("tide", "ember")):
                sheet.alpha_composite(cell(kind, tier, team), (110 + (ti * 2 + si) * CW, r * CH))
    sheet.convert("RGB").save(f"{R}/outputs/review/characters/sheet_{n // 6 + 1}.jpg", quality=88)
