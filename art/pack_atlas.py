"""Pack post-processed v3 frames (art/build/v3post) into one atlas per body and tier, plus the manifest.

    python3 art/pack_atlas.py [--sheets-only] [--merge] [--only kind,kind]

--merge keeps every body already in base/public/atlas/manifest.json and only (re)packs the ones posted in
art/build/v3post, so a run that rendered just a few kinds does not drop the rest from the manifest.

Writes base/public/atlas/<kind>_t<tier>.webp and base/public/atlas/manifest.json. Layout and manifest format:
docs/ART-V3-ATLAS.md. Each sheet is one 8-bit image of palette indices (lossless WebP, index 0 = transparent) with a
joint palette in the manifest: per entry the colour (RGBA, team parts in white) and the team mask (R main, G dark,
B light coverage). The runtime tints a whole sheet for a team by tinting its 256 palette entries, so one small file
replaces the old colour PNG + mask PNG pair. Identical frames share one rect.
"""
import argparse
import base64
import hashlib
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from muster_art import style as STYLE  # noqa: E402
from post import ORDER, POST3  # noqa: E402

OUT = os.environ.get("MUSTER_ATLAS_OUT") or os.path.join(ROOT, "base", "public", "atlas")  # override to pack a test set elsewhere
PAD = 2
MAX_W = 2048
VERSION = 4
MASK_W = 0.8  # weight of the team mask against the colour when the joint palette merges entries


def shelf_pack(sizes):
    """Shelf-pack (w, h) boxes, tallest first. Returns (W, H, [(x, y)])."""
    area = sum((w + PAD) * (h + PAD) for w, h in sizes)
    W = min(MAX_W, max(max(w for w, _ in sizes) + PAD, int(math.ceil(math.sqrt(area * 1.12) / 16) * 16)))
    order = sorted(range(len(sizes)), key=lambda i: (-sizes[i][1], -sizes[i][0]))
    pos = [None] * len(sizes)
    x = y = shelf_h = 0
    for i in order:
        w, h = sizes[i]
        if x + w + PAD > W:
            y += shelf_h + PAD
            x = shelf_h = 0
        pos[i] = (x, y)
        x += w + PAD
        shelf_h = max(shelf_h, h)
    return W, y + shelf_h, pos


def joint_palette(col, msk, n=128):
    """Quantise colour (RGBA) and team mask (RGB) jointly to n entries. Returns (index HxW uint8 with 0 = transparent,
    palette (n+1)x7 uint8: r, g, b, a, mask r, g, b; entry 0 is transparent)."""
    a = np.asarray(col)
    vis = a[..., 3] > 0
    q = col.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    ci = np.asarray(q)[vis].astype(np.int64)
    cpal = np.array(q.getpalette("RGBA"), np.float64).reshape(-1, 4)
    mq = msk.quantize(colors=10, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    mi = np.asarray(mq)[vis].astype(np.int64)
    mpal = np.array(mq.getpalette("RGB"), np.float64).reshape(-1, 3)
    key = ci * 64 + mi
    uniq, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
    vec = np.concatenate([cpal[uniq // 64], mpal[uniq % 64] * MASK_W], 1)
    w = cnt.astype(np.float64)
    if len(uniq) <= n:
        cent, lab = vec, np.arange(len(uniq))
    else:
        # weighted k-means over the distinct pairs, seeded with the most common ones
        cent = vec[np.argsort(-cnt)[:n]].copy()
        for _ in range(6):
            d = ((vec[:, None, :] - cent[None, :, :]) ** 2).sum(-1)
            lab = d.argmin(1)
            for j in range(n):
                sel = lab == j
                if sel.any():
                    cent[j] = (vec[sel] * w[sel, None]).sum(0) / w[sel].sum()
        d = ((vec[:, None, :] - cent[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
    pal = np.zeros((len(cent) + 1, 7), np.float64)
    pal[1:, :4] = cent[:, :4]
    pal[1:, 4:] = cent[:, 4:] / MASK_W
    pal = np.clip(np.round(pal), 0, 255).astype(np.uint8)
    pal[1:, 3] = np.maximum(pal[1:, 3], 1)  # a visible pixel never maps to "transparent"
    idx = np.zeros(a.shape[:2], np.uint8)
    idx[vis] = (lab[inv] + 1).astype(np.uint8)
    return idx, pal


def webp_bytes(idx):
    b = io.BytesIO()
    Image.fromarray(idx, "L").convert("RGB").save(b, "WEBP", lossless=True, quality=100, method=6, exact=True)
    return b.getvalue()


def pack_one(kind, tier):
    src = os.path.join(POST3, kind, f"t{tier}")
    meta = json.load(open(os.path.join(src, "meta.json")))
    frs = meta["frames"]
    # identical frames (a still body, a held pose) share one rect
    cols, msks, uniq, ref = [], [], {}, []
    for f in frs:
        c = Image.open(os.path.join(src, f["file"] + ".png")).convert("RGBA")
        m = Image.open(os.path.join(src, f["file"] + "_m.png")).convert("RGB")
        h = hashlib.sha1(c.tobytes() + m.tobytes() + bytes(str((c.size, f["ax"], f["ay"])), "ascii")).hexdigest()
        if h not in uniq:
            uniq[h] = len(cols)
            cols.append(c)
            msks.append(m)
        ref.append(uniq[h])
    W, H, pos = shelf_pack([c.size for c in cols])
    col = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    msk = Image.new("RGB", (W, H), (0, 0, 0))
    for c, m, (x, y) in zip(cols, msks, pos):
        col.paste(c, (x, y))
        msk.paste(m, (x, y))
    idx, pal = joint_palette(col, msk)
    anims = {}
    for f, j in zip(frs, ref):
        x, y = pos[j]
        a = anims.setdefault(f["anim"], [[] for _ in STYLE.DIRS])
        lst = a[f["dir"]]
        while len(lst) <= f["i"]:
            lst.append(None)
        rect = [x, y, f["w"], f["h"], f["ax"], f["ay"]]
        if f.get("s", 1.0) != 1.0:
            rect.append(f["s"])  # rendered at this fraction of the atlas PPU (the runtime scales it back up)
        lst[f["i"]] = rect
    os.makedirs(OUT, exist_ok=True)
    name = f"{kind}_t{tier}"
    with open(os.path.join(OUT, name + ".webp"), "wb") as fh:
        fh.write(webp_bytes(idx))
    if "walk" not in anims:
        anims["walk"] = "idle"
    sheet = {"w": W, "h": H, "pal": base64.b64encode(pal.tobytes()).decode(), "stride": meta.get("stride", 0),
             "weight": meta.get("weight", STYLE.weight(kind)), "anims": anims}
    return name, sheet, meta["radius"]


# ------------------------------------------------------------------ reading packed sheets back (previews, tests)
def load_sheet(man, key):
    """(index HxW uint8, palette Nx7 uint8) of a packed sheet."""
    idx = np.asarray(Image.open(os.path.join(OUT, key + ".webp")).convert("RGB"))[..., 0]
    pal = np.frombuffer(base64.b64decode(man["sheets"][key]["pal"]), np.uint8).reshape(-1, 7)
    return idx, pal


def tint_palette(pal, team):
    """The runtime tint (base/src/render/sprites.ts) on palette entries: rgb = colour * (1 + R(main-1) + G(dark-1) + B(light-1))."""
    t = STYLE.TEAMS[team]
    k = np.ones((len(pal), 3))
    for ch, key in enumerate(("main", "dark", "light")):
        c = np.array([int(t[key][i:i + 2], 16) for i in (1, 3, 5)], np.float64) / 255
        k += pal[:, 4 + ch:5 + ch] / 255 * (c - 1)
    rgb = np.clip(pal[:, :3] * k + 0.5, 0, 255)
    return np.concatenate([rgb, pal[:, 3:4]], 1).astype(np.uint8)


def sheet_rgba(man, key, team):
    idx, pal = load_sheet(man, key)
    lut = tint_palette(pal, team)
    lut[0] = 0
    return Image.fromarray(lut[idx], "RGBA")


def clean_stale(man):
    """Drop sheet files the manifest no longer names (and the old PNG + mask pairs)."""
    keep = {k + ".webp" for k in man["sheets"]} | {"manifest.json"}
    for f in os.listdir(OUT):
        if f not in keep and (f.endswith(".png") or f.endswith(".webp")):
            os.remove(os.path.join(OUT, f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheets-only", action="store_true", help="previews from base/public/atlas only (art/anim_preview.py)")
    ap.add_argument("--merge", action="store_true", help="keep the bodies already in the manifest; repack only what is in v3post")
    ap.add_argument("--only", default="", help="pack only these kinds from v3post (implies --merge)")
    a = ap.parse_args()
    mp = os.path.join(OUT, "manifest.json")
    if not a.sheets_only:
        only = {x.strip() for x in a.only.split(",") if x.strip()}
        merge = a.merge or bool(only)
        man = {"version": VERSION, "style": STYLE.ID, "ppu": STYLE.PPU, "el": STYLE.CAMERA_EL, "dirs": STYLE.DIRS, "dir8": STYLE.DIR8,
               "anims": STYLE.ANIMS, "impact": STYLE.IMPACT, "teams": {k: v for k, v in STYLE.TEAMS.items() if k != "neutral"},
               "units": {}, "sheets": {}}
        found = []
        for kind in os.listdir(POST3) if os.path.isdir(POST3) else []:
            if only and kind not in only:
                continue
            for td in os.listdir(os.path.join(POST3, kind)):
                if os.path.exists(os.path.join(POST3, kind, td, "meta.json")):
                    found.append((kind, int(td[1:])))
        rank = {k: i for i, k in enumerate(ORDER)}
        found.sort(key=lambda kt: (rank.get(kt[0], 99), kt[1]))
        if merge and os.path.exists(mp):
            old = json.load(open(mp))
            if old.get("version") == VERSION:
                fresh = {k for k, _ in found}
                man["units"] = {k: v for k, v in old["units"].items() if k not in fresh}
                man["sheets"] = {k: v for k, v in old["sheets"].items() if k.rsplit("_t", 1)[0] not in fresh}
        for kind, tier in found:
            name, sheet, radius = pack_one(kind, tier)
            man["sheets"][name] = sheet
            u = man["units"].setdefault(kind, {"tiers": [], "radius": radius})
            if tier not in u["tiers"]:
                u["tiers"].append(tier)
            u["tiers"].sort()
            print("PACK_OK", name, sheet["w"], "x", sheet["h"], os.path.getsize(os.path.join(OUT, name + ".webp")), flush=True)
        man["units"] = {k: man["units"][k] for k in sorted(man["units"], key=lambda k: rank.get(k, 99))}
        man["sheets"] = {k: man["sheets"][k] for k in sorted(man["sheets"], key=lambda s: (rank.get(s.rsplit("_t", 1)[0], 99), int(s.rsplit("_t", 1)[1])))}
        with open(mp, "w") as f:
            json.dump(man, f, separators=(",", ":"))
        clean_stale(man)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"ATLAS_BYTES {total} ({total / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
