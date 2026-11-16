"""Post-process raw Blender renders into battle frames (v3) and card portraits.

    python3 art/post.py [--only kind,kind] [--jobs 8] [--resume] [--no-pack]      battle frames -> art/build/v3post, then art/pack_atlas.py
    python3 art/post.py --portraits [--only kind,kind]      card portraits -> base/public/portraits + art/contact/portraits.png

Needs Pillow + numpy. Frame contract: docs/ART-V3-ATLAS.md and art/muster_art/style.py.

A v3 frame is two images with the same layout (both stored straight-alpha):
  colour  RGBA, team parts rendered neutral white, ink silhouette, Ascended halo/bloom in white
  mask    RGB coverage of the team main (R), dark (G) and light (B) colours
The runtime tints with rgb = colour * (1 + R*(main-1) + G*(dark-1) + B*(light-1)), so the same frames serve both
teams.
"""
import argparse
import json
import os
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from muster_art import style as STYLE  # noqa: E402  (pure python, no bpy)

RAW = os.path.join(HERE, "build", "raw")
RAW3 = os.path.join(HERE, "build", "v3")


def raw_style():
    """The look to post in: --style, else MUSTER_STYLE, else the one the raw renders record (render_all.py writes it
    into each meta.json; renders from before the field are v2). Inking a render in another direction's ink and team
    colours would mix looks, so mixed raw renders are an error."""
    argv = sys.argv[1:]
    if "--style" in argv and argv.index("--style") + 1 < len(argv):
        return argv[argv.index("--style") + 1]
    if os.environ.get("MUSTER_STYLE"):
        return os.environ["MUSTER_STYLE"]
    seen = set()
    if os.path.isdir(RAW3):
        for kind in os.listdir(RAW3):
            kd = os.path.join(RAW3, kind)
            for t in os.listdir(kd) if os.path.isdir(kd) else []:
                mp = os.path.join(kd, t, "meta.json")
                if os.path.exists(mp):
                    with open(mp) as f:
                        seen.add(json.load(f).get("style", "v2"))
    if len(seen) > 1:
        sys.exit(f"raw renders in art/build/v3 mix styles {sorted(seen)}; re-render with one --style")
    return seen.pop() if seen else None


STYLE.select(raw_style())
os.environ["MUSTER_STYLE"] = STYLE.ID  # worker processes and pack_atlas.py post in the same look
POST3 = os.path.join(HERE, "build", "v3post")
POR = os.path.join(ROOT, "base", "public", "portraits")
CONTACT = os.path.join(HERE, "contact")
INK = np.array([int(STYLE.INK[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
TEAM = {k: {c: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for c, v in cols.items()} for k, cols in STYLE.TEAMS.items() if k != "neutral"}
ORDER = ["mine", "blades", "ranger", "bulwark", "medic", "grenadier", "shade", "lancer", "ballista", "hive", "storm", "golem",
         "sapper", "harrier", "banner", "rime", "ravager", "grave", "bombard", "tinker", "duelist", "pikeman", "keg", "trickster", "hook", "thorn", "outrider", "lamp", "griffin", "tide", "lion",
         "mite", "golemling", "thrall", "turret", "decoy", "queen"]
NAMES = {"mine": "Mine", "blades": "Blade Trio", "ranger": "Ranger", "bulwark": "Bulwark", "medic": "Medic", "grenadier": "Grenadier",
         "shade": "Shade", "lancer": "Lancer", "ballista": "Ballista", "hive": "Hive", "storm": "Stormcaller", "golem": "Stone Colossus",
         "sapper": "Sapper", "harrier": "Harrier", "banner": "Standard Bearer", "rime": "Rimecaller", "ravager": "Ravager",
         "grave": "Gravecaller", "bombard": "Bombard", "tinker": "Tinker", "duelist": "Duelist", "pikeman": "Pikeman", "keg": "Kegrunner",
         "trickster": "Trickster", "hook": "Hookwarden", "thorn": "Thornweaver", "outrider": "Outrider", "lamp": "Lamplighter", "griffin": "Griffin Knight", "tide": "Tidecaller", "lion": "Lionheart", "mite": "Mite", "golemling": "Shardling", "thrall": "Thrall", "turret": "Turret", "decoy": "Decoy",
         "queen": "Brood Queen"}
TIER_NAMES = {1: "Recruit", 2: "Veteran", 3: "Elite", 4: "Ascended"}


# ------------------------------------------------------------------ image helpers (premultiplied float32)
def load_premul(path):
    a = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255.0
    a[..., :3] *= a[..., 3:4]
    return a


def shift(img, dy, dx):
    out = np.zeros_like(img)
    H, W = img.shape[:2]
    ys, yd = slice(max(0, dy), H + min(0, dy)), slice(max(0, -dy), H + min(0, -dy))
    xs, xd = slice(max(0, dx), W + min(0, dx)), slice(max(0, -dx), W + min(0, -dx))
    out[ys, xs] = img[yd, xd]
    return out


def dilate(alpha, r):
    out = alpha.copy()
    rr = r + 0.35
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            d2 = dx * dx + dy * dy
            if 0 < d2 <= rr * rr:
                out = np.maximum(out, shift(alpha, dy, dx))
    return out


def over(top, bot):
    a = top[..., 3:4]
    return top + bot * (1.0 - a)


def blur(ch, radius):
    im = Image.fromarray(np.clip(ch * 255.0, 0, 255).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255.0


def reduce(arr, k):
    """Box-downsample a premultiplied float image by an integer factor (exact for premultiplied data)."""
    if k == 1:
        return arr
    H, W = arr.shape[:2]
    H2, W2 = H // k, W // k
    a = arr[:H2 * k, :W2 * k]
    return a.reshape(H2, k, W2, k, -1).mean(axis=(1, 3))


def to8(arr):
    return np.clip(arr * 255.0 + 0.5, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ v3 battle frames
def frame(raw_base, ascended, ghost=False, scale=1.0):
    """(colour RGBA, mask RGB) premultiplied floats at final resolution. scale: the frame's resolution against the
    atlas PPU (style.CLIP_SCALE); ink and halo widths shrink with it so they match once the runtime scales it back."""
    col = load_premul(raw_base + ".png")
    m = load_premul(raw_base + "_m.png")
    # mask pass: team parts emit flat R/G/B, everything else black, same coverage as the colour pass (premultiplied)
    mask = np.clip(m[..., :3], 0, 1) * (col[..., 3:4] > 0)
    al = col[..., 3]
    ink_a = dilate(al, max(1, int(round(STYLE.INK_PX * scale))))
    ink = np.zeros_like(col)
    ink[..., :3] = INK * ink_a[..., None]
    ink[..., 3] = ink_a
    out = over(col, ink)  # mask is unchanged: ink carries no team colour
    gp = raw_base + "_g.png"
    if ascended and os.path.exists(gp):
        g = load_premul(gp)
        ga = g[..., 3]
        r = STYLE.GLOW_PX * scale
        gg = STYLE.GLOW_GAIN  # the direction's bloom strength
        wide = np.clip(blur(ga, r * 1.8) * 1.6 * gg, 0, min(0.55 * gg, 0.8))
        near = np.clip(blur(ga, r * 0.7) * 1.8 * gg, 0, min(0.9 * gg, 1.0))
        ha = np.clip(wide + near * (1 - wide), 0, 1)
        # halo in white with its team weights in the mask: wide -> main, near -> light
        w_light = near
        w_main = np.clip(ha - w_light, 0, 1)
        under = 1.0 - out[..., 3:4]
        out[..., :3] += ha[..., None] * under
        out[..., 3:4] += ha[..., None] * under
        mask[..., 0:1] += w_main[..., None] * under
        mask[..., 2:3] += w_light[..., None] * under
        # bloom lift on the glowing parts (white, so it brightens whatever colour it lands on)
        bl = np.mean(np.stack([blur(g[..., i], r * 0.6) for i in range(3)], -1), -1, keepdims=True) * 0.45 * gg * out[..., 3:4]
        out[..., :3] += np.clip(np.minimum(bl, out[..., 3:4] - out[..., :3].max(-1, keepdims=True)), 0, None)
    if ghost:
        # an illusion: faded, washed half way to the team light colour
        out[..., :3] = out[..., :3] * 0.5 + out[..., 3:4] * 0.5
        mask = mask * 0.5
        mask[..., 2:3] += out[..., 3:4] * 0.5
        out *= 0.66
        mask *= 0.66
    k = STYLE.SS
    return reduce(out, k), reduce(mask, k)


def post_unit(job):
    kind, tier = job
    src = os.path.join(RAW3, kind, f"t{tier}")
    meta = json.load(open(os.path.join(src, "meta.json")))
    dst = os.path.join(POST3, kind, f"t{tier}")
    os.makedirs(dst, exist_ok=True)
    frames = []
    for fr in meta["frames"]:
        c, m = frame(os.path.join(src, fr["file"]), tier == 4, ghost=kind == "decoy", scale=fr.get("s", 1.0))
        h, w = c.shape[:2]
        # trim to visible pixels, keeping the anchor in frame coordinates
        vis = c[..., 3] > 1.5 / 255
        ys, xs = np.nonzero(vis)
        if len(xs) == 0:
            x0, y0, x1, y1 = 0, 0, 1, 1
        else:
            x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
        c, m = c[y0:y1, x0:x1], m[y0:y1, x0:x1]
        # stored straight (un-premultiplied) so browsers decode them losslessly; the tint is linear either way
        a = np.maximum(c[..., 3:4], 1e-6)
        c[..., :3] = np.where(c[..., 3:4] > 0, c[..., :3] / a, 0)
        m = np.where(c[..., 3:4] > 0, m / a, 0)
        Image.fromarray(to8(c), "RGBA").save(os.path.join(dst, fr["file"] + ".png"))
        Image.fromarray(to8(m), "RGB").save(os.path.join(dst, fr["file"] + "_m.png"))
        frames.append({**fr, "w": x1 - x0, "h": y1 - y0, "ax": fr["ax"] - x0, "ay": fr["ay"] - y0})
    with open(os.path.join(dst, "meta.json"), "w") as f:
        json.dump({**meta, "frames": frames}, f)
    return f"POST_OK {kind} t{tier} frames={len(frames)}"


def frames_main(a):
    jobs = []
    if os.path.isdir(RAW3):
        for kind in sorted(os.listdir(RAW3)):
            if a.only and kind not in {x.strip() for x in a.only.split(",")}:
                continue
            for td in sorted(os.listdir(os.path.join(RAW3, kind))):
                raw_meta = os.path.join(RAW3, kind, td, "meta.json")
                if not os.path.exists(raw_meta):
                    continue
                done = os.path.join(POST3, kind, td, "meta.json")
                if a.resume and os.path.exists(done) and os.path.getmtime(done) >= os.path.getmtime(raw_meta):
                    continue  # already posted from this render
                jobs.append((kind, int(td[1:])))
    with ProcessPoolExecutor(max_workers=a.jobs) as ex:
        for msg in ex.map(post_unit, jobs):
            print(msg, flush=True)
    if not a.no_pack:
        r = subprocess.run([sys.executable, os.path.join(HERE, "pack_atlas.py")])
        if r.returncode:
            sys.exit(r.returncode)


# ------------------------------------------------------------------ card portraits (v2 framing, tide colours)
def portrait_one(raw_path, glow_path, out_path, size, ink_r=4, glow_r=10, ghost=False):
    img = load_premul(raw_path)
    al = img[..., 3]
    ink_a = dilate(al, ink_r)
    ink = np.zeros_like(img)
    ink[..., :3] = INK * ink_a[..., None]
    ink[..., 3] = ink_a
    out = over(img, ink)
    if glow_path and os.path.exists(glow_path):
        g = load_premul(glow_path)
        ga = g[..., 3]
        col = np.array(TEAM["tide"]["main"], np.float32) / 255
        lt = np.array(TEAM["tide"]["light"], np.float32) / 255
        wide = np.clip(blur(ga, glow_r * 1.8) * 1.6, 0, 0.55)
        near = np.clip(blur(ga, glow_r * 0.7) * 1.8, 0, 0.9)
        halo = np.zeros_like(img)
        halo[..., :3] = col * wide[..., None] * (1 - near[..., None]) + lt * near[..., None]
        ha = np.clip(wide + near * (1 - wide), 0, 1)
        halo[..., 3] = ha
        halo[..., :3] = np.minimum(halo[..., :3], ha[..., None])
        out = over(out, halo)
        bl = np.stack([blur(g[..., i], glow_r * 0.6) for i in range(3)], -1)
        out[..., :3] = np.minimum(out[..., :3] + bl * 0.45 * out[..., 3:4], out[..., 3:4])
    if ghost:
        lt = np.array(TEAM["tide"]["light"], np.float32) / 255
        out[..., :3] = out[..., :3] * 0.5 + lt * out[..., 3:4] * 0.5
        out *= 0.66
    im = Image.fromarray(to8(out), "RGBa")
    if im.size[0] != size:
        im = im.reduce(im.size[0] // size) if im.size[0] % size == 0 else im.resize((size, size), Image.LANCZOS)
    im = im.convert("RGBA")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out_path, optimize=True)


def font(sz):
    for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                pass
    return ImageFont.load_default()


def save_sheet(sheet, path):
    sheet.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, optimize=True)


def portrait_sheet():
    kinds = [k for k in ORDER if os.path.exists(os.path.join(POR, f"{k}_t1.png"))]
    cols, cell = 8, 128
    tiles = [(k, t) for k in kinds for t in (1, 2, 3, 4) if os.path.exists(os.path.join(POR, f"{k}_t{t}.png"))]
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (34, 44, 60, 255))
    for i, (kind, t) in enumerate(tiles):
        im = Image.open(os.path.join(POR, f"{kind}_t{t}.png")).convert("RGBA").resize((cell, cell), Image.LANCZOS)
        r, c = divmod(i, cols)
        sheet.alpha_composite(im, (c * cell, r * cell))
    os.makedirs(CONTACT, exist_ok=True)
    path = os.path.join(CONTACT, "portraits.png")
    save_sheet(sheet, path)
    print("SHEET", path)


def portraits_main(a):
    pd = os.path.join(RAW, "portraits")
    want = {x.strip() for x in a.only.split(",")} if a.only else None
    for f in sorted(os.listdir(pd)) if os.path.isdir(pd) else []:
        if not f.endswith(".png") or f.endswith("_glow.png"):
            continue
        name = f[:-4]
        kind = name.rsplit("_t", 1)[0]
        if want and kind not in want:
            continue
        portrait_one(os.path.join(pd, f), os.path.join(pd, name + "_glow.png"), os.path.join(POR, f), 256, ghost=kind == "decoy")
        print("PORTRAIT", name, flush=True)
    portrait_sheet()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--portraits", action="store_true")
    ap.add_argument("--no-pack", action="store_true")
    ap.add_argument("--resume", action="store_true", help="skip bodies already posted from their current render")
    ap.add_argument("--style", default="", help="style direction id or v2 (read before argparse, see raw_style)")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 4) - 2))
    a = ap.parse_args()
    if a.portraits:
        portraits_main(a)
    else:
        frames_main(a)


if __name__ == "__main__":
    main()
