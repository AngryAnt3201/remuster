"""Muster battle VFX: paint every effect sprite sheet procedurally and pack them into one atlas.

    /usr/local/bin/python3 art/vfx/make_vfx.py [--only smoke,fireball] [--contact]
    npm run vfx

Needs numpy + Pillow (the same system python3 as art/post.py). Deterministic: the same seed gives the same atlas.
Writes base/public/vfx/atlas.png, base/public/vfx/atlas.json and art/vfx/contact.png (every sheet on a checker, for review).

Look: chunky cel-shaded VFX to sit with the toon unit renders. Two or three hard-edged tone bands, white-hot cores,
dark ink outlines on anything solid (smoke, dirt, ice, bombs) and none on light (sparks, flashes, lightning).

Sheets marked tint=True are painted in greyscale and gradient-mapped at runtime (base/src/render/vfx.ts): dark -> tint ->
white, so one sheet serves both teams and every element. The rest carry their own colour.
Each sheet is one row of frames. Frame art is centred on the sheet's anchor (default the middle of the cell).
"""
import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "base", "public", "vfx")
SS = 2  # supersample
ATLAS_W = 2048



def _style():
    """The active art direction (art/style/active.json): its ink outlines the solid effects."""
    sd = os.path.join(ROOT, "art", "style")
    try:
        with open(os.path.join(sd, "active.json")) as f:
            name = json.load(f)["direction"]
        with open(os.path.join(sd, f"{name}.json")) as f:
            return json.load(f)
    except (OSError, KeyError, ValueError):
        return None


STYLE = _style()
INK = (np.array([int(STYLE["outline"]["color"][i:i + 2], 16) for i in (1, 3, 5)]) / 255.0) if STYLE else np.array([0.07, 0.06, 0.09])


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


# ------------------------------------------------------------------ maths helpers
def ease_out(t):
    return 1 - (1 - t) ** 3


def ease_in(t):
    return t ** 2


def sstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def grid(w, h=None):
    """Pixel-centre coordinates. x in [-1, 1] across the width, y scaled by the same unit (so circles stay round)."""
    h = h or w
    xs = (np.arange(w) + 0.5) / w * 2 - 1
    ys = ((np.arange(h) + 0.5) / h * 2 - 1) * (h / w)
    return np.meshgrid(xs, ys)


class Noise:
    """Periodic value noise (period = size lattice cells)."""

    def __init__(self, seed, size=32):
        self.g = np.random.default_rng(seed).random((size, size))
        self.size = size

    def __call__(self, x, y):
        s = self.size
        xi = np.floor(x).astype(int)
        yi = np.floor(y).astype(int)
        fx, fy = x - xi, y - yi
        u, v = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        g = self.g
        a = g[yi % s, xi % s]; b = g[yi % s, (xi + 1) % s]
        c = g[(yi + 1) % s, xi % s]; d = g[(yi + 1) % s, (xi + 1) % s]
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v

    def fbm(self, x, y, oct=4):
        tot, amp, f, norm = 0.0, 0.5, 1.0, 0.0
        for _ in range(oct):
            tot = tot + amp * self(x * f, y * f)
            norm += amp
            amp *= 0.5
            f *= 2
        return tot / norm


N1, N2, N3 = Noise(11), Noise(23), Noise(37)


def cov(sd, px):
    """Anti-aliased coverage of a signed distance (negative inside), px = one pixel in coordinate units."""
    return np.clip(0.5 - sd / px, 0, 1)


class Canvas:
    """Premultiplied RGBA float canvas."""

    def __init__(self, w, h):
        self.p = np.zeros((h, w, 3))
        self.a = np.zeros((h, w))

    def over(self, rgb, a):
        a = np.clip(a, 0, 1)
        rgb = np.broadcast_to(rgb, self.p.shape) if np.ndim(rgb) == 1 else rgb
        self.p = rgb * a[..., None] + self.p * (1 - a[..., None])
        self.a = a + self.a * (1 - a)

    def under(self, rgb, a):
        a = np.clip(a, 0, 1)
        rgb = np.broadcast_to(rgb, self.p.shape) if np.ndim(rgb) == 1 else rgb
        self.p = self.p + rgb * a[..., None] * (1 - self.a[..., None])
        self.a = self.a + a * (1 - self.a)

    def add(self, rgb, a):
        """Additive light: brightens and adds a little alpha so it shows on transparent cells."""
        a = np.clip(a, 0, 1)
        rgb = np.broadcast_to(rgb, self.p.shape) if np.ndim(rgb) == 1 else rgb
        self.p = np.clip(self.p + rgb * a[..., None], 0, 1)
        self.a = np.clip(self.a + a, 0, 1)
        self.p = np.minimum(self.p, self.a[..., None])

    def outline(self, width_px, color=INK, alpha=1.0):
        """Ink outline behind the content: a dilation of the alpha mask."""
        if width_px <= 0:
            return
        m = self.a
        d = m.copy()
        r = int(math.ceil(width_px))
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                dist = math.hypot(dx, dy)
                if dist > width_px + 0.5 or (dx == 0 and dy == 0):
                    continue
                k = min(1.0, width_px + 0.5 - dist)
                sh = np.roll(np.roll(m, dy, 0), dx, 1) * k
                np.maximum(d, sh, out=d)
        self.under(color, np.clip(d * 1.3, 0, 1) * alpha)

    def fade(self, k):
        self.p *= k
        self.a *= k

    def rgba(self):
        a = self.a
        rgb = np.where(a[..., None] > 1e-5, self.p / np.maximum(a[..., None], 1e-5), 0)
        return np.dstack([np.clip(rgb, 0, 1), np.clip(a, 0, 1)])


def ramp(v, stops, soft=0.025):
    """Toon colour ramp: stops = [(threshold, colour)] ascending; hard bands with a hair of AA."""
    out = np.broadcast_to(stops[0][1], v.shape + (3,)).copy()
    for th, col in stops[1:]:
        k = sstep(th - soft, th + soft, v)[..., None]
        out = out * (1 - k) + col * k
    return out


LIGHT = np.array([-0.5, -0.65, 0.58])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def balls(X, Y, bl, px, warp=0.0, seed=0):
    """Union of shaded spheres. bl: list of (cx, cy, r). Returns (coverage, lambert, inner) where inner is 0 at the
    silhouette edge rising to 1 at a ball's centre."""
    if warp:
        X = X + (N2.fbm(X * 3 + seed, Y * 3) - 0.5) * warp
        Y = Y + (N3.fbm(X * 3, Y * 3 + seed) - 0.5) * warp
    best = np.full(X.shape, -1e9)
    lam = np.zeros(X.shape)
    inner = np.zeros(X.shape)
    sd = np.full(X.shape, 1e9)
    for cx, cy, r in bl:
        if r <= 0:
            continue
        dx, dy = X - cx, Y - cy
        d2 = dx * dx + dy * dy
        d = np.sqrt(d2)
        sd = np.minimum(sd, d - r)
        h = np.sqrt(np.maximum(r * r - d2, 0))
        sel = (h > best) & (d2 < r * r)
        nx, ny, nz = dx / r, dy / r, h / r
        l = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
        lam = np.where(sel, l, lam)
        inner = np.where(sel, h / r, inner)
        best = np.where(sel, h, best)
    return cov(sd, px), lam, inner


def polygon_sd(X, Y, pts):
    """Signed distance to a closed polygon (negative inside)."""
    pts = np.asarray(pts, float)
    d = np.full(X.shape, 1e9)
    s = np.ones(X.shape)
    n = len(pts)
    for i in range(n):
        ax, ay = pts[i]; bx, by = pts[(i + 1) % n]
        ex, ey = bx - ax, by - ay
        wx, wy = X - ax, Y - ay
        t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey + 1e-12), 0, 1)
        qx, qy = wx - ex * t, wy - ey * t
        d = np.minimum(d, qx * qx + qy * qy)
        c1 = Y >= ay; c2 = Y < by; c3 = ex * wy > ey * wx
        flip = (c1 & c2 & c3) | (~c1 & ~c2 & ~c3)
        s = np.where(flip, -s, s)
    return s * np.sqrt(d)


def seg_sd(X, Y, ax, ay, bx, by):
    ex, ey = bx - ax, by - ay
    wx, wy = X - ax, Y - ay
    t = np.clip((wx * ex + wy * ey) / (ex * ex + ey * ey + 1e-12), 0, 1)
    return np.hypot(wx - ex * t, wy - ey * t), t


def star_pts(n, r0, r1, rot=0.0, jitter=None):
    pts = []
    for i in range(n * 2):
        a = rot + i * math.pi / n
        r = r1 if i % 2 == 0 else r0
        if jitter is not None:
            r *= jitter[i % len(jitter)]
        pts.append((math.cos(a) * r, math.sin(a) * r))
    return pts


def rng(seed):
    return np.random.default_rng(seed)


# ------------------------------------------------------------------ sheet registry
SHEETS = {}


def sheet(name, frames, cw, ch=None, tint=False, blend="normal", anchor=(0.5, 0.5), outline=0.0, ink=INK, note=""):
    def deco(fn):
        SHEETS[name] = dict(fn=fn, frames=frames, cw=cw, ch=ch or cw, tint=tint, blend=blend, anchor=anchor,
                            outline=outline, ink=ink, note=note)
        return fn
    return deco


def render_sheet(name):
    s = SHEETS[name]
    w, h = s["cw"] * SS, s["ch"] * SS
    X, Y = grid(w, h)
    # shift so the anchor sits at (0, 0)
    ax, ay = s["anchor"]
    X = X - (ax * 2 - 1)
    Y = Y - (ay * 2 - 1) * (h / w)
    px = 2.0 / w
    frames = []
    for i in range(s["frames"]):
        t = i / max(1, s["frames"] - 1) if s["frames"] > 1 else 0.0
        c = Canvas(w, h)
        s["fn"](c, X, Y, px, t, i)
        if s["outline"]:
            c.outline(s["outline"] * SS, s["ink"])
        img = c.rgba()
        # box downsample
        img = img.reshape(s["ch"], SS, s["cw"], SS, 4)
        a = img[..., 3:4]
        rgbp = (img[..., :3] * a).mean(axis=(1, 3))
        aa = a.mean(axis=(1, 3))
        rgb = np.where(aa > 1e-5, rgbp / np.maximum(aa, 1e-5), 0)
        frames.append(np.dstack([rgb, aa]))
    return frames


# ------------------------------------------------------------------ palettes
SMOKE = [(-2, hexc("#7c8592")), (0.05, hexc("#aeb6c1")), (0.45, hexc("#dfe4ea")), (0.78, hexc("#ffffff"))]
FIRE = [hexc("#4a3a42"), hexc("#6d5a62"), hexc("#b8321c"), hexc("#ff6b1f"), hexc("#ffad2e"), hexc("#ffe46b"), hexc("#fffbe8")]
DIRT = [(-2, hexc("#4b3523")), (0.05, hexc("#7a5636")), (0.5, hexc("#a87b4f")), (0.82, hexc("#d4ae7c"))]
ICE = [(-2, hexc("#3f87c4")), (0.0, hexc("#7cc7f2")), (0.45, hexc("#c6ecff")), (0.8, hexc("#ffffff"))]


# ------------------------------------------------------------------ smoke, dust, fire
def cluster(seed, n, spread, r0):
    g = rng(seed)
    out = []
    for i in range(n):
        a = i / n * math.tau + g.uniform(-0.4, 0.4)
        d = spread * (0.35 + 0.65 * g.random()) if i else 0.0
        out.append((math.cos(a) * d, math.sin(a) * d * 0.85, r0 * (0.75 + 0.5 * g.random()) * (1.25 if i == 0 else 1)))
    return out


@sheet("smoke", 8, 128, tint=True, outline=1.6, note="billowing puff; dust, death poofs, blast smoke, decoys")
def fx_smoke(c, X, Y, px, t, i):
    cl = cluster(5, 7, 0.38, 0.3)
    e = ease_out(min(1, t * 1.25))
    bl = [(x * (0.6 + 0.7 * e), y * (0.6 + 0.7 * e) - 0.18 * t, r * (0.45 + 0.6 * e) * (1 - 0.25 * t)) for x, y, r in cl]
    m, lam, inner = balls(X, Y, bl, px, warp=0.12, seed=i * 0.3)
    hole = N1.fbm(X * 3.2 + 4, Y * 3.2 - t * 2) - (t - 0.55) * 1.1
    m = m * cov(-(hole - 0.5) * 0.25, px * 2) if t > 0.55 else m
    col = ramp(lam, SMOKE)
    c.over(col, m)
    if t > 0.85:
        c.fade(1 - (t - 0.85) / 0.22)


@sheet("dust", 8, 160, tint=True, outline=1.2, note="ground ring of puffs; deploy landing, charges, slams")
def fx_dust(c, X, Y, px, t, i):
    e = ease_out(t)
    g = rng(9)
    bl = []
    for k in range(11):
        a = k / 11 * math.tau + g.uniform(-0.2, 0.2)
        R = (0.22 + 0.62 * e) * (0.85 + 0.25 * g.random())
        r = (0.17 + 0.05 * g.random()) * (1 - 0.6 * t)
        bl.append((math.cos(a) * R, math.sin(a) * R, r))
    m, lam, _ = balls(X, Y, bl, px, warp=0.1, seed=3)
    hole = N2.fbm(X * 4, Y * 4 + 1) - (t - 0.35) * 1.4
    if t > 0.35:
        m = m * cov(-(hole - 0.5) * 0.25, px * 2)
    c.over(ramp(lam, SMOKE), m)
    if t > 0.75:
        c.fade(1 - (t - 0.75) / 0.3)


@sheet("fireball", 12, 192, outline=1.8, ink=np.array([0.17, 0.07, 0.06]), note="explosion: white flash, toon fire, dark smoke")
def fx_fireball(c, X, Y, px, t, i):
    cl = cluster(17, 9, 0.42, 0.3)
    grow = ease_out(min(1, t * 3.2))
    bl = [(x * (0.35 + 0.85 * grow + 0.2 * t), y * (0.35 + 0.85 * grow + 0.2 * t) - 0.2 * t * t, r * (0.4 + 0.75 * grow) * (1 - 0.3 * t))
          for x, y, r in cl]
    m, lam, inner = balls(X, Y, bl, px, warp=0.16, seed=i * 0.2)
    # heat: hot early and in the core, cooling from the top into smoke
    dist = np.hypot(X, Y + 0.1 * t)
    heat = 1.25 - t * 1.9 + inner * 0.35 + lam * 0.25 - dist * 0.4 - np.clip(-Y, 0, 1) * t * 0.6
    heat = heat + (N1.fbm(X * 4, Y * 4 - t * 3) - 0.5) * 0.25
    stops = [(-9, FIRE[0]), (0.0, FIRE[1]), (0.18, FIRE[2]), (0.32, FIRE[3]), (0.5, FIRE[4]), (0.72, FIRE[5]), (0.95, FIRE[6])]
    col = ramp(heat, stops, soft=0.02)
    # smoke shading on the cooled parts
    shade = np.where(heat < 0.18, 0.75 + 0.4 * lam, 1.0)[..., None]
    col = np.clip(col * shade, 0, 1)
    if t > 0.62:
        hole = N3.fbm(X * 3 + 2, Y * 3 - t * 2) - (t - 0.62) * 1.5
        m = m * cov(-(hole - 0.5) * 0.25, px * 2)
    c.over(col, m)
    if t < 0.2:
        # opening flash: a spiky white star over the ball
        k = 1 - t / 0.2
        sd = polygon_sd(X, Y, star_pts(9, 0.35 * (0.6 + grow), 0.8 * (0.6 + grow), rot=0.2))
        c.add(hexc("#fffbe8"), cov(sd, px * 3) * k * 0.9)
    if t > 0.88:
        c.fade(1 - (t - 0.88) / 0.16)


@sheet("flash", 6, 128, tint=True, blend="add", note="radial starburst glow; impact, muzzle, lightning hits, fuse")
def fx_flash(c, X, Y, px, t, i):
    k = 1 - t
    sc = 0.45 + 0.55 * ease_out(min(1, t * 2.5))
    r = np.hypot(X, Y)
    a = np.arctan2(Y, X) + t * 0.6
    rays = (0.5 + 0.5 * np.cos(a * 8)) ** 6
    glow = np.exp(-(r / (0.3 * sc)) ** 2) * 0.9 + rays * np.exp(-(r / (0.85 * sc)) ** 2) * 0.8
    core = cov(r - 0.18 * sc * (1.2 - t), px * 2)
    lum = np.clip(glow * 0.7 + core, 0, 1)
    c.add(np.dstack([lum] * 3), np.clip(glow + core, 0, 1) * k)


@sheet("shock", 8, 192, tint=True, blend="normal", note="expanding blast ring with ground haze")
def fx_shock(c, X, Y, px, t, i):
    e = ease_out(t)
    R = 0.2 + 0.74 * e
    w = 0.16 * (1 - t) + 0.025
    r = np.hypot(X, Y)
    ring = cov(np.abs(r - R) - w * 0.5, px * 1.5)
    haze = np.clip(1 - r / R, 0, 1) ** 0.6 * cov(r - R, px) * 0.35
    edge = sstep(R - w * 0.5, R + w * 0.5, r)  # outer edge darker for a cel bevel
    lum = 1 - edge * 0.35
    c.over(np.dstack([np.full(r.shape, 0.85)] * 3), haze * (1 - t))
    c.over(np.dstack([lum] * 3), ring * (1 - t * 0.7))
    if t > 0.6:
        c.fade(1 - (t - 0.6) / 0.45)


@sheet("ring", 1, 192, tint=True, note="static soft ring for the generic ring effect; scaled in code")
def fx_ring(c, X, Y, px, t, i):
    r = np.hypot(X, Y)
    ring = cov(np.abs(r - 0.88) - 0.05, px * 1.5)
    glow = np.exp(-((r - 0.88) / 0.1) ** 2) * 0.5
    c.over(np.dstack([np.full(r.shape, 0.75)] * 3), glow * cov(r - 0.98, px))
    c.over(np.dstack([np.full(r.shape, 1.0)] * 3), ring)


@sheet("disc", 1, 128, tint=True, note="soft filled disc for ring fills and glows")
def fx_disc(c, X, Y, px, t, i):
    r = np.hypot(X, Y)
    a = np.clip(1 - r / 0.97, 0, 1) ** 0.8
    c.over(np.dstack([np.full(r.shape, 0.8)] * 3), a)


@sheet("spark", 6, 64, tint=True, blend="add", note="hit spark: hot star with streaks")
def fx_spark(c, X, Y, px, t, i):
    k = 1 - t
    sc = 0.5 + 0.5 * ease_out(min(1, t * 3))
    sd = polygon_sd(X, Y, star_pts(4, 0.12 * sc * k + 0.02, 0.9 * sc * (1 - 0.4 * t), rot=0.3 + t * 0.4))
    sd2 = polygon_sd(X, Y, star_pts(4, 0.08 * sc * k + 0.02, 0.55 * sc * (1 - 0.4 * t), rot=0.3 + math.pi / 4 + t * 0.4))
    body = np.maximum(cov(sd, px * 1.5), cov(sd2, px * 1.5) * 0.8)
    r = np.hypot(X, Y)
    core = cov(r - 0.2 * k, px * 1.5)
    lum = np.clip(0.6 + core * 0.4 + np.exp(-(r / 0.3) ** 2) * 0.4, 0, 1)
    c.add(np.dstack([lum] * 3), np.clip(body + core, 0, 1) * (k ** 0.7))


@sheet("glint", 6, 64, tint=True, blend="add", note="four-point twinkle; parry ready, braced pikes, stun stars, sparkle")
def fx_glint(c, X, Y, px, t, i):
    k = math.sin(t * math.pi) if t < 1 else 0
    k = max(k, 0.15)
    sd = polygon_sd(X, Y, star_pts(4, 0.08 * k + 0.02, 0.92 * k, rot=-math.pi / 2))
    r = np.hypot(X, Y)
    glow = np.exp(-(r / (0.3 * k + 0.05)) ** 2)
    lum = np.clip(0.7 + glow * 0.3, 0, 1)
    c.add(np.dstack([lum] * 3), np.clip(cov(sd, px * 1.5) + glow * 0.6, 0, 1))


@sheet("shield", 6, 128, tint=True, blend="add", note="hex shield ripple on a shielded hit")
def fx_shield(c, X, Y, px, t, i):
    k = 1 - t
    # hex lattice: nearest of two offset rectangular grids gives the cell centre, then the hexagon distance
    s = 0.2
    rx, ry = s, s * math.sqrt(3)
    ax, ay = (X % rx) - rx / 2, (Y % ry) - ry / 2
    bx, by = ((X - rx / 2) % rx) - rx / 2, ((Y - ry / 2) % ry) - ry / 2
    near_a = ax * ax + ay * ay < bx * bx + by * by
    gx, gy = np.abs(np.where(near_a, ax, bx)), np.abs(np.where(near_a, ay, by))
    hd = np.maximum(gx * 0.5 + gy * (math.sqrt(3) / 2), gx) / (rx / 2)  # 1 on the cell edge
    lines = sstep(0.8, 0.97, hd)
    r = np.hypot(X, Y)
    R = 0.25 + 0.7 * ease_out(t)
    band = np.exp(-((r - R) / 0.18) ** 2)
    dome = cov(r - 0.95, px) * np.clip(1 - r, 0, 1) * 0.3
    a = (lines * band * 0.9 + band * 0.25 + dome) * k
    lum = np.clip(0.75 + lines * 0.25, 0, 1)
    c.add(np.dstack([lum] * 3), a)


# ------------------------------------------------------------------ melee
def crescent(c, X, Y, px, head, tail, r_out, r_in, glow=True):
    """A swipe in polar space from angle tail to head (radians), thick at the head."""
    r = np.hypot(X, Y)
    a = np.arctan2(Y, X)
    span = max(1e-3, head - tail)
    u = np.clip((a - tail) / span, 0, 1)  # 0 at tail, 1 at head
    inside_ang = (a >= tail) & (a <= head + 0.02)
    thick = (r_out - r_in) * (0.3 + 0.7 * u ** 1.2)
    mid = r_out - thick * 0.5
    sd = np.abs(r - mid) - thick * 0.5
    m = cov(sd, px * 1.5) * inside_ang * sstep(0.0, 0.12, u)
    lum = 0.55 + 0.45 * sstep(0.45, 0.9, u) * sstep(r_in, r_out, r)
    edge = cov(np.abs(r - (r_out - thick * 0.12)) - thick * 0.12, px * 1.5) * inside_ang
    lum = np.clip(lum + edge * 0.5, 0, 1)
    c.over(np.dstack([lum] * 3), m)


@sheet("slash", 8, 128, tint=True, note="melee swipe arc, spread 2 rad facing +x, outer radius 0.95 of the half cell")
def fx_slash(c, X, Y, px, t, i):
    sp = 1.0
    head = -sp + 2 * sp * ease_out(min(1, t * 1.8))
    tail = -sp + 2 * sp * ease_in(min(1, max(0, t - 0.1) * 1.25))
    crescent(c, X, Y, px, head, min(tail, head - 0.05), 0.95, 0.5)
    if t > 0.7:
        c.fade(1 - (t - 0.7) / 0.35)


@sheet("spin", 8, 160, tint=True, note="whirlwind: two swipes chasing round the full circle")
def fx_spin(c, X, Y, px, t, i):
    rot = t * math.tau * 1.1
    for k in range(2):
        base = rot + k * math.pi
        # rotate coordinates so the swipe sits in [-pi, pi]
        ca, sa = math.cos(-base), math.sin(-base)
        XR, YR = X * ca - Y * sa, X * sa + Y * ca
        crescent(c, XR, YR, px, 0.4, -2.0, 0.95, 0.6)
    r = np.hypot(X, Y)
    c.over(np.dstack([np.full(r.shape, 0.9)] * 3), np.exp(-((r - 0.8) / 0.12) ** 2) * 0.25 * cov(r - 0.98, px))
    if t > 0.7:
        c.fade(1 - (t - 0.7) / 0.35)


@sheet("impact", 8, 128, tint=True, outline=1.6, note="comic impact star; impale, talon, big hits, parry riposte")
def fx_impact(c, X, Y, px, t, i):
    g = rng(4)
    jit = list(0.7 + 0.5 * g.random(18))
    sc = 0.4 + 0.6 * ease_out(min(1, t * 3))
    k = 1 - max(0, t - 0.35) / 0.65
    sd = polygon_sd(X, Y, star_pts(9, 0.42 * sc, 0.95 * sc, rot=0.15, jitter=jit))
    sd2 = polygon_sd(X, Y, star_pts(9, 0.22 * sc, 0.6 * sc, rot=0.5, jitter=jit[::-1]))
    m = cov(sd, px * 1.5)
    c.over(np.dstack([np.full(X.shape, 0.6)] * 3), m)
    c.over(np.dstack([np.full(X.shape, 1.0)] * 3), cov(sd2, px * 1.5))
    c.fade(min(1, k * 1.6))


@sheet("parry", 6, 128, tint=True, blend="add", note="crossed blade glint")
def fx_parry(c, X, Y, px, t, i):
    k = 1 - t
    L = 0.95 * (0.5 + 0.5 * ease_out(min(1, t * 3)))
    a = 0
    for rot in (math.pi / 4, -math.pi / 4):
        ca, sa = math.cos(rot), math.sin(rot)
        XR, YR = X * ca - Y * sa, X * sa + Y * ca
        sd = polygon_sd(XR, YR, [(-L, 0), (0, -0.07), (L, 0), (0, 0.07)])
        a = np.maximum(a, cov(sd, px * 1.5))
    r = np.hypot(X, Y)
    ring = np.exp(-((r - 0.5 * ease_out(t) - 0.1) / 0.06) ** 2) * 0.7
    glow = np.exp(-(r / 0.25) ** 2)
    c.add(np.dstack([np.clip(0.75 + glow * 0.25, 0, 1)] * 3), np.clip(a + ring + glow * 0.8, 0, 1) * k)


@sheet("streak", 1, 128, 32, tint=True, blend="add", note="speed line; charges, dives, volley, arrows in flight")
def fx_streak(c, X, Y, px, t, i):
    # X in [-1, 1], Y in [-0.25, 0.25]; bright at +x
    u = (X + 1) / 2
    w = 0.04 + 0.12 * u
    m = cov(np.abs(Y) - w, px * 1.5) * sstep(0.0, 0.7, u) * cov(X - 0.97, px)
    c.add(np.dstack([0.6 + 0.4 * u] * 3), m)


# ------------------------------------------------------------------ lightning
def jag(g, n, amp):
    xs = np.linspace(-0.98, 0.98, n)
    ys = g.uniform(-amp, amp, n)
    ys[0] = ys[-1] = 0
    return list(zip(xs, ys))


@sheet("zap", 4, 256, 64, tint=True, blend="add", note="lightning strip, one variant per frame; stretched between chain points")
def fx_zap(c, X, Y, px, t, i):
    g = rng(100 + i)
    pts = jag(g, 9, 0.2)
    d = np.full(X.shape, 1e9)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dd, _ = seg_sd(X, Y, ax, ay, bx, by)
        d = np.minimum(d, dd)
    # forks
    for k in range(2):
        j = g.integers(2, 7)
        ax, ay = pts[j]
        bx, by = ax + g.uniform(0.1, 0.25), ay + g.choice([-1, 1]) * g.uniform(0.08, 0.18)
        dd, tt = seg_sd(X, Y, ax, ay, bx, by)
        d = np.minimum(d, dd + tt * 0.01)
    core = cov(d - 0.012, px * 1.2)
    body = cov(d - 0.035, px * 1.5)
    glow = np.exp(-(d / 0.09) ** 2) * 0.55
    lum = np.clip(0.55 + body * 0.25 + core * 0.4, 0, 1)
    c.add(np.dstack([lum] * 3), np.clip(core + body * 0.85 + glow, 0, 1))


# ------------------------------------------------------------------ frost
def crystal_sd(X, Y, cx, cy, ang, L, W):
    ca, sa = math.cos(-ang), math.sin(-ang)
    XR, YR = (X - cx) * ca - (Y - cy) * sa, (X - cx) * sa + (Y - cy) * ca
    return polygon_sd(XR, YR, [(-L * 0.35, 0), (-L * 0.1, -W), (L, 0), (-L * 0.1, W)]), YR


def shade_crystal(c, sd, YR, px, alpha=1.0):
    m = cov(sd, px * 1.5)
    col = np.where((YR < 0)[..., None], hexc("#e6f8ff"), hexc("#8fd3f7"))
    c.over(col, m * alpha)


@sheet("shard", 1, 64, 32, outline=1.0, ink=np.array([0.1, 0.2, 0.35]), note="Rimecaller frost shard projectile, points +x")
def fx_shard(c, X, Y, px, t, i):
    sd, YR = crystal_sd(X, Y, -0.1, 0, 0, 0.85, 0.16)
    shade_crystal(c, sd, YR, px)
    glow = np.exp(-(np.hypot(X + 0.2, Y) / 0.4) ** 2) * 0.35
    c.under(hexc("#bfe9ff"), glow)


@sheet("frost", 8, 128, outline=1.0, ink=np.array([0.12, 0.25, 0.42]), note="chill burst: crystals and frost mist")
def fx_frost(c, X, Y, px, t, i):
    e = ease_out(t)
    r = np.hypot(X, Y)
    mist = np.exp(-(r / (0.3 + 0.5 * e)) ** 2) * (N1.fbm(X * 4, Y * 4 + t) * 0.8 + 0.2) * (1 - t)
    c.over(hexc("#d8f3ff"), mist * 0.6)
    g = rng(21)
    for k in range(7):
        a = k / 7 * math.tau + g.uniform(-0.3, 0.3)
        d = 0.15 + 0.65 * e * (0.7 + 0.3 * g.random())
        sd, YR = crystal_sd(X, Y, math.cos(a) * d, math.sin(a) * d, a, 0.22 * (1 - 0.5 * t), 0.06 * (1 - 0.5 * t))
        shade_crystal(c, sd, YR, px, alpha=min(1, (1 - t) * 1.6))


@sheet("chill", 8, 128, tint=True, blend="add", note="looping frost swirl on a slowed body")
def fx_chill(c, X, Y, px, t, i):
    r = np.hypot(X, Y)
    a = np.arctan2(Y, X)
    ph = i / 8 * math.tau
    swirl = (0.5 + 0.5 * np.sin(a * 3 - ph + r * 6)) ** 3
    band = np.exp(-((r - 0.72) / 0.14) ** 2)
    m = band * (0.25 + 0.75 * swirl)
    flakes = 0
    for k in range(5):
        b = ph / 3 * (1 if k % 2 else -1) + k * math.tau / 5
        fx_, fy_ = math.cos(b) * 0.75, math.sin(b) * 0.75
        flakes = np.maximum(flakes, cov(polygon_sd(X - fx_, Y - fy_, star_pts(3, 0.03, 0.11, rot=b * 2)), px * 1.5))
    c.add(np.dstack([np.clip(0.7 + flakes * 0.3, 0, 1)] * 3), np.clip(m * 0.8 + flakes, 0, 1))


@sheet("ice", 6, 128, outline=1.4, ink=np.array([0.1, 0.22, 0.4]), anchor=(0.5, 0.62), note="ice block forming; last frame held while frozen")
def fx_ice(c, X, Y, px, t, i):
    e = ease_out(min(1, t * 1.15))
    g = rng(31)
    spikes = [(-0.55, 0.25, -1.9, 0.55), (-0.25, 0.3, -1.65, 0.95), (0.1, 0.32, -1.45, 1.1), (0.45, 0.25, -1.25, 0.8),
              (-0.05, 0.28, -2.4, 0.6), (0.3, 0.3, -0.9, 0.55), (-0.45, 0.32, -2.6, 0.45)]
    for cx, cy, ang, L in spikes:
        Lk = L * e
        if Lk < 0.03:
            continue
        W = 0.2 * L * (0.8 + 0.3 * g.random())
        ca, sa = math.cos(-ang), math.sin(-ang)
        XR, YR = (X - cx) * ca - (Y - cy) * sa, (X - cx) * sa + (Y - cy) * ca
        sd = polygon_sd(XR, YR, [(-0.08, -W * 0.8), (Lk * 0.75, -W), (Lk, 0), (Lk * 0.75, W), (-0.08, W * 0.8)])
        m = cov(sd, px * 1.5)
        col = ramp(-YR / W + 0.2 * (XR / max(Lk, 1e-3)), [(-9, hexc("#5fb4e8")), (-0.1, hexc("#a6e0fb")), (0.45, hexc("#e9f9ff"))])
        c.over(col, m * 0.92)
    base = cov(np.hypot(X / 0.75, (Y - 0.32) / 0.2) - 1, px * 2)
    c.under(hexc("#bfe9ff"), base * 0.7 * e)


@sheet("icebreak", 8, 128, outline=1.0, ink=np.array([0.1, 0.22, 0.4]), note="ice shattering when a freeze ends")
def fx_icebreak(c, X, Y, px, t, i):
    e = ease_out(t)
    g = rng(41)
    for k in range(9):
        a = k / 9 * math.tau + g.uniform(-0.3, 0.3)
        d = 0.1 + 0.7 * e * (0.6 + 0.4 * g.random())
        sz = 0.16 * (0.7 + 0.5 * g.random()) * (1 - 0.6 * t)
        rot = a + t * 6 * (1 if k % 2 else -1)
        pts = [(math.cos(rot + j * 2.1) * sz, math.sin(rot + j * 2.1) * sz) for j in range(3)]
        cx, cy = math.cos(a) * d, math.sin(a) * d + 0.5 * t * t
        sd = polygon_sd(X - cx, Y - cy, pts)
        col = np.where(((X - cx) * math.cos(rot) + (Y - cy) * math.sin(rot) < 0)[..., None], hexc("#e9f9ff"), hexc("#8fd3f7"))
        c.over(col, cov(sd, px * 1.5) * min(1, (1 - t) * 2))


# ------------------------------------------------------------------ fire
@sheet("flame", 8, 96, 128, outline=1.4, ink=np.array([0.24, 0.07, 0.04]), anchor=(0.5, 0.88), note="looping flame tongue for burning ground")
def fx_flame(c, X, Y, px, t, i):
    # Y up is negative; the base sits at the anchor. Tongues: a teardrop eaten by upward-scrolling noise.
    h = -Y
    ph = i / 8  # loop: scroll the periodic noise by exactly one lattice period over the 8 frames
    n = N1.fbm(X * 2.5, (Y + ph * 32 / 2.5) * 2.5, 3)
    prof = np.clip(h + 0.12, 0, None) ** 0.55 * np.clip(1.25 - h, 0, None) ** 0.9
    width = 0.62 * prof
    sway = (N2.fbm(X * 0.5 + 3, (Y + ph * 16) * 1.0, 2) - 0.5) * 0.35 * np.clip(h, 0, 1)
    d = np.abs(X - sway) / np.maximum(width, 1e-3)
    field = (1 - d) * 0.9 + (n - 0.5) * 1.2 * np.clip(h + 0.2, 0, 1.2)
    m = sstep(0.0, 0.06, field) * (width > 0.04)
    heat = field * 1.3 - h * 0.35
    col = ramp(heat, [(-9, hexc("#e2361b")), (0.25, hexc("#ff7a1f")), (0.5, hexc("#ffb72e")), (0.78, hexc("#fff0a0"))])
    c.over(col, m)


@sheet("scorch", 1, 160, note="charred ground decal for burning zones and blasts")
def fx_scorch(c, X, Y, px, t, i):
    r = np.hypot(X, Y)
    n = N3.fbm(X * 3 + 9, Y * 3, 4)
    sd = r - (0.72 + (n - 0.5) * 0.45)
    m = cov(sd, px * 4)
    core = np.clip(1 - r / 0.9, 0, 1)
    c.over(hexc("#1c1412"), m * (0.45 + 0.35 * core))
    specks = (N1(X * 22, Y * 22) > 0.82) & (r < 0.6)
    c.over(hexc("#ff8a3a"), specks * 0.8 * core)


# ------------------------------------------------------------------ earth
@sheet("dirt", 8, 160, outline=1.6, ink=np.array([0.13, 0.08, 0.05]), note="earth eruption: clods thrown up and out")
def fx_dirt(c, X, Y, px, t, i):
    e = ease_out(t)
    g = rng(51)
    bl = []
    for k in range(10):
        a = k / 10 * math.tau + g.uniform(-0.3, 0.3)
        R = 0.12 + 0.55 * e * (0.7 + 0.5 * g.random())
        lift = 0.55 * math.sin(min(1, t * 1.4) * math.pi) * (0.5 + 0.5 * g.random())
        bl.append((math.cos(a) * R, math.sin(a) * R * 0.7 - lift, 0.11 * (0.7 + 0.6 * g.random()) * (1 - 0.45 * t)))
    m, lam, _ = balls(X, Y, bl, px, warp=0.08, seed=2)
    c.over(ramp(lam, DIRT), m)
    dm, dl, _ = balls(X, Y, [(math.cos(k) * 0.35 * (0.6 + e), math.sin(k) * 0.25 * (0.6 + e), 0.24 * (1 - 0.5 * t)) for k in range(0, 7)], px, warp=0.1)
    c.under(ramp(dl, [(-2, hexc("#8a7158")), (0.3, hexc("#b59b7c")), (0.75, hexc("#d9c4a6"))]), dm * (1 - t) * 0.9)


@sheet("mound", 1, 128, outline=1.6, ink=np.array([0.13, 0.08, 0.05]), note="burrowing sapper's moving mound, travel +x")
def fx_mound(c, X, Y, px, t, i):
    bl = [(0.0, 0.0, 0.48), (-0.35, 0.05, 0.36), (0.32, 0.08, 0.3), (-0.62, 0.08, 0.22), (0.1, -0.15, 0.3)]
    bl = [(x, y * 0.75, r * 0.95) for x, y, r in bl]
    m, lam, _ = balls(X, Y, bl, px, warp=0.1, seed=5)
    c.over(ramp(lam, DIRT), m)
    pebbles = (N2(X * 14, Y * 14) > 0.8) & (m > 0.5)
    c.over(hexc("#5a4130"), pebbles * 0.7)


@sheet("divot", 1, 64, note="dug-up earth trail mark")
def fx_divot(c, X, Y, px, t, i):
    r = np.hypot(X / 0.9, Y / 0.65)
    n = N2.fbm(X * 4, Y * 4)
    m = cov(r - (0.7 + (n - 0.5) * 0.4), px * 3)
    c.over(hexc("#3d2b1d"), m * 0.55)
    rim = cov(np.abs(r - 0.72) - 0.08, px * 2) * (Y < 0)
    c.over(hexc("#9b7650"), rim * 0.6)


@sheet("clod", 4, 32, tint=True, outline=1.0, note="debris chunk, one shape per frame (rock, dirt, bone, wood when tinted)")
def fx_clod(c, X, Y, px, t, i):
    g = rng(60 + i)
    n = 5 + i % 3
    pts = [(math.cos(k / n * math.tau) * 0.8 * (0.7 + 0.3 * g.random()), math.sin(k / n * math.tau) * 0.65 * (0.7 + 0.3 * g.random())) for k in range(n)]
    sd = polygon_sd(X, Y, pts)
    lam = -(X * 0.5 + Y * 0.7)
    col = ramp(lam, [(-9, hexc("#6c6c6c")), (0.0, hexc("#a8a8a8")), (0.3, hexc("#e0e0e0"))])
    c.over(col, cov(sd, px * 1.5))


@sheet("crack", 1, 192, note="ground cracks decal for quakes, slams and cave-ins")
def fx_crack(c, X, Y, px, t, i):
    g = rng(71)
    d = np.full(X.shape, 1e9)
    for k in range(7):
        a = k / 7 * math.tau + g.uniform(-0.3, 0.3)
        x0, y0 = 0.0, 0.0
        L = 0.85 * (0.7 + 0.3 * g.random())
        for s in range(4):
            a2 = a + g.uniform(-0.45, 0.45)
            x1, y1 = x0 + math.cos(a2) * L / 4, y0 + math.sin(a2) * L / 4
            dd, tt = seg_sd(X, Y, x0, y0, x1, y1)
            width = 0.035 * (1 - (s + tt) / 4.2)
            d = np.minimum(d, dd - width)
            if s == 1 and g.random() < 0.7:
                b = a2 + g.choice([-1, 1]) * 0.8
                dd, tt = seg_sd(X, Y, x1, y1, x1 + math.cos(b) * 0.2, y1 + math.sin(b) * 0.2)
                d = np.minimum(d, dd - 0.018 * (1 - tt))
            x0, y0 = x1, y1
    c.over(hexc("#d7c09a"), cov(d - 0.025, px * 1.5) * 0.6)
    c.over(hexc("#1b130d"), cov(d, px * 1.2))
    r = np.hypot(X, Y)
    c.under(hexc("#2a1f16"), np.clip(1 - r / 0.5, 0, 1) * 0.35)


# ------------------------------------------------------------------ light, magic, support
@sheet("pillar", 10, 128, tint=True, blend="add", anchor=(0.5, 0.82), note="column of light; spawns, raises, revives, deploy flash")
def fx_pillar(c, X, Y, px, t, i):
    h = -Y
    k = math.sin(min(1, t * 1.3) * math.pi) if t < 0.77 else max(0, 1 - (t - 0.5) * 2)
    k = max(0.0, k)
    w = 0.32 * (0.5 + 0.5 * k) * (1 + 0.15 * h)
    beam = np.exp(-(X / w) ** 2 * 2) * np.clip(1 - h / 1.6, 0, 1) * (h > -0.12)
    core = np.exp(-(X / (w * 0.35)) ** 2 * 2) * np.clip(1 - h / 1.3, 0, 1) * (h > -0.06)
    r = np.hypot(X / 0.9, (Y - 0.0) / 0.32)
    ring = np.exp(-((r - 0.3 - 0.6 * ease_out(t)) / 0.08) ** 2) * (1 - t)
    sparks = 0
    g = rng(81)
    for s in range(7):
        sx = g.uniform(-0.4, 0.4)
        sy = -((t * 1.4 + g.random()) % 1) * 1.3
        sparks = np.maximum(sparks, cov(polygon_sd(X - sx, Y - sy, star_pts(4, 0.015, 0.06)), px * 1.5))
    a = np.clip(beam * 0.75 * k + core * k + ring + sparks * k, 0, 1)
    lum = np.clip(0.6 + core * 0.4 + sparks * 0.4, 0, 1)
    c.add(np.dstack([lum] * 3), a)


@sheet("vortex", 10, 128, tint=True, outline=1.2, note="blink portal swirl; play reversed for arrival")
def fx_vortex(c, X, Y, px, t, i):
    r = np.hypot(X, Y)
    a = np.arctan2(Y, X)
    R = 0.9 * (1 - t * 0.85)
    arms = np.sin(a * 3 + r * 9 - t * 14)
    m = cov(r - R, px * 2) * (arms > -0.2 + r * 0.6)
    lum = np.clip(0.35 + 0.65 * (1 - r / max(R, 1e-3)), 0, 1) * (0.7 + 0.3 * (arms > 0.4))
    c.over(np.dstack([lum] * 3), m)
    c.add(np.dstack([np.ones(r.shape)] * 3), np.exp(-(r / (0.18 * (1 - t) + 0.02)) ** 2) * 0.8)


@sheet("soul", 10, 96, 128, tint=True, anchor=(0.5, 0.8), outline=1.2, note="death wisp rising from the body")
def fx_soul(c, X, Y, px, t, i):
    rise = -1.1 * ease_out(t)
    w = 0.26 * (1 - 0.4 * t)
    yy = Y - rise
    h = -yy
    n = N1.fbm(X * 3, (Y + t * 3) * 3, 3)
    sway = (n - 0.5) * 0.3 * np.clip(-yy + 0.3, 0, 1.5)
    body = np.hypot((X - sway) / w, yy / (w * 1.15)) - 1
    tail = np.abs(X - sway * 1.4) - w * np.clip(1 - yy / 0.8, 0, 1) ** 1.3 * 0.95
    tail = np.maximum(tail, -yy)
    sd = np.minimum(body * w, tail)
    m = cov(sd, px * 1.5)
    lam = -(X - sway) / w * 0.5 - (yy) / w * 0.5
    lum = ramp(lam, [(-9, np.array([0.55] * 3)), (0.0, np.array([0.8] * 3)), (0.5, np.array([1.0] * 3))])
    eyes = cov(np.hypot((np.abs(X - sway) - 0.09) / 0.045, (yy + 0.02) / 0.06) - 1, px * 2)
    c.over(lum, m)
    c.over(np.array([0.08] * 3), eyes * m)
    c.fade(min(1, (1 - t) * 1.8))


@sheet("heal", 10, 128, anchor=(0.5, 0.75), note="green lift of light with crosses rising")
def fx_heal(c, X, Y, px, t, i):
    k = math.sin(min(1.0, t) * math.pi)
    r = np.hypot(X / 0.85, Y / 0.3)
    ring = np.exp(-((r - 0.35 - 0.55 * ease_out(t)) / 0.1) ** 2) * (1 - t)
    lift = np.exp(-(X / 0.45) ** 2) * np.clip(1 + Y / 1.2, 0, 1) * (Y < 0.05) * 0.35 * k
    c.add(hexc("#7dffa6"), ring * 0.9 + lift)
    for s, (sx, d) in enumerate([(-0.35, 0.0), (0.3, 0.25), (0.0, 0.5)]):
        u = (t + d) % 1.0
        sy = -0.1 - u * 1.0
        sz = 0.13 * (0.6 + 0.4 * math.sin(u * math.pi))
        sd = np.minimum(np.maximum(np.abs(X - sx) - sz * 0.33, np.abs(Y - sy) - sz),
                        np.maximum(np.abs(X - sx) - sz, np.abs(Y - sy) - sz * 0.33))
        a = cov(sd, px * 1.5) * math.sin(u * math.pi)
        o = cov(sd - 0.03, px * 1.5) * math.sin(u * math.pi)
        c.over(hexc("#0f4a2a"), o)
        c.over(np.where((X - sx + Y - sy < 0)[..., None], hexc("#e6ffe9"), hexc("#5fe38a")), a)
    if t > 0.75:
        c.fade(1 - (t - 0.75) / 0.3)


@sheet("plus", 1, 32, tint=True, outline=1.0, note="chunky plus glyph for heal particles")
def fx_plus(c, X, Y, px, t, i):
    sz = 0.75
    sd = np.minimum(np.maximum(np.abs(X) - sz * 0.33, np.abs(Y) - sz), np.maximum(np.abs(X) - sz, np.abs(Y) - sz * 0.33))
    lum = np.where((X + Y < 0), 1.0, 0.75)
    c.over(np.dstack([lum] * 3), cov(sd, px * 1.5))


@sheet("rage", 8, 128, tint=True, blend="add", note="looping bloodlust flare of spikes")
def fx_rage(c, X, Y, px, t, i):
    r = np.hypot(X, Y)
    a = np.arctan2(Y, X)
    ph = i / 8 * math.tau
    spikes = 0.62 + 0.22 * np.sin(a * 7 + ph) * np.sin(a * 3 - ph * 2) + 0.1 * np.sin(ph + a * 11)
    m = cov(r - spikes, px * 2) * cov(0.4 - r, px * 3) * 0.0 + cov(r - spikes, px * 2) * sstep(0.3, 0.6, r)
    c.add(np.dstack([np.clip(0.6 + (r - 0.4), 0, 1)] * 3), m * 0.85)


@sheet("rally", 10, 128, tint=True, blend="add", anchor=(0.5, 0.7), note="golden chevrons rising: rally pulse")
def fx_rally(c, X, Y, px, t, i):
    for d in (0.0, 0.33, 0.66):
        u = (t + d) % 1.0
        cy = -0.1 - u * 0.9
        w = 0.5 * (1 - 0.3 * u)
        sd = polygon_sd(X, Y - cy, [(-w, 0.12), (0, -0.18), (w, 0.12), (w, 0.26), (0, -0.04), (-w, 0.26)])
        c.add(np.dstack([np.full(X.shape, 0.9)] * 3), cov(sd, px * 1.5) * math.sin(u * math.pi) * 0.9)


@sheet("aura", 1, 256, tint=True, note="rune ring for Standard Bearer auras; rotated in code")
def fx_aura(c, X, Y, px, t, i):
    r = np.hypot(X, Y)
    a = np.arctan2(Y, X)
    ring = cov(np.abs(r - 0.9) - 0.025, px * 1.5)
    ring2 = cov(np.abs(r - 0.78) - 0.012, px * 1.5)
    ticks = cov(np.abs(r - 0.84) - 0.04, px * 1.5) * (np.cos(a * 16) > 0.75)
    glow = np.exp(-((r - 0.9) / 0.12) ** 2) * 0.4 * cov(r - 1.0, px)
    inner = np.clip(r / 0.9, 0, 1) ** 4 * cov(r - 0.9, px) * 0.18
    c.over(np.dstack([np.full(r.shape, 0.7)] * 3), glow + inner)
    c.over(np.dstack([np.ones(r.shape)] * 3), np.clip(ring + ring2 * 0.8 + ticks, 0, 1))


@sheet("gear", 8, 96, outline=1.4, note="tinker build: a cog turning with sparks")
def fx_gear(c, X, Y, px, t, i):
    rot = i / 8 * (math.tau / 8)
    r = np.hypot(X, Y)
    a = np.arctan2(Y, X) + rot
    teeth = 0.62 + 0.14 * (np.cos(a * 8) > 0.2)
    sd = np.maximum(r - teeth, -(r - 0.22))
    lam = -(X * 0.5 + Y * 0.7) / 0.7
    col = ramp(lam, [(-9, hexc("#a8701e")), (-0.1, hexc("#e2a93b")), (0.35, hexc("#ffe08a"))])
    c.over(col, cov(sd, px * 1.5))
    c.over(hexc("#8a5a1a"), cov(np.abs(r - 0.42) - 0.03, px * 1.5) * cov(sd, px))


@sheet("mirror", 8, 128, tint=True, outline=1.0, note="mirror glass shards flying out: decoy pops and Mirror Hall")
def fx_mirror(c, X, Y, px, t, i):
    e = ease_out(t)
    g = rng(91)
    for k in range(10):
        a = k / 10 * math.tau + g.uniform(-0.3, 0.3)
        d = 0.08 + 0.75 * e * (0.6 + 0.4 * g.random())
        sz = 0.17 * (0.7 + 0.5 * g.random())
        rot = a + t * 5 * (1 if k % 2 else -1)
        pts = [(math.cos(rot) * sz, math.sin(rot) * sz), (math.cos(rot + 2.4) * sz * 0.6, math.sin(rot + 2.4) * sz * 0.6),
               (math.cos(rot + 3.6) * sz * 0.8, math.sin(rot + 3.6) * sz * 0.8)]
        cx, cy = math.cos(a) * d, math.sin(a) * d
        sd = polygon_sd(X - cx, Y - cy, pts)
        glare = ((X - cx) * math.cos(rot * 2) + (Y - cy) * math.sin(rot * 2)) > 0
        c.over(np.dstack([np.where(glare, 1.0, 0.7)] * 3), cov(sd, px * 1.5) * min(1, (1 - t) * 2.5))


@sheet("goo", 8, 128, outline=1.4, ink=np.array([0.05, 0.15, 0.05]), note="mite pop: green splat")
def fx_goo(c, X, Y, px, t, i):
    e = ease_out(t)
    g = rng(95)
    bl = [(0, 0, 0.3 * (1 - 0.3 * t))]
    for k in range(8):
        a = k / 8 * math.tau + g.uniform(-0.3, 0.3)
        d = 0.2 + 0.6 * e * (0.6 + 0.4 * g.random())
        bl.append((math.cos(a) * d, math.sin(a) * d, 0.1 * (0.6 + 0.6 * g.random()) * (1 - 0.5 * t)))
    m, lam, _ = balls(X, Y, bl, px, warp=0.06)
    c.over(ramp(lam, [(-2, hexc("#3e9a2b")), (0.1, hexc("#7fdc4f")), (0.65, hexc("#d8ff9f"))]), m)
    if t > 0.6:
        c.fade(1 - (t - 0.6) / 0.45)


# ------------------------------------------------------------------ bombs and projectiles
def bomb_body(c, X, Y, px, r, i, keg=False):
    if keg:
        sd = np.maximum(np.abs(X) - r * 0.85, np.abs(Y) - r) + 0.0
        sd = np.maximum(sd, np.hypot(X / (r * 1.1), Y / (r * 1.6)) - 1)
        lam = -(X / r) * 0.7
        col = ramp(lam, [(-9, hexc("#5a3418")), (-0.2, hexc("#8a5a2e")), (0.35, hexc("#c08a52"))])
        c.over(col, cov(sd, px * 1.5))
        for hy in (-0.55, 0.55):
            c.over(hexc("#3a3f47"), cov(np.abs(Y - hy * r) - r * 0.08, px * 1.5) * cov(sd, px))
        top = (0.0, -r * 1.0)
    else:
        m, lam, _ = balls(X, Y, [(0, 0.05, r)], px)
        c.over(ramp(lam, [(-2, hexc("#1f232a")), (0.25, hexc("#3b414c")), (0.8, hexc("#8d96a5"))]), m)
        top = (r * 0.45, -r * 0.8)
    # fuse spark flickers per frame
    fl = [1.0, 0.6, 0.85, 0.5][i % 4]
    sx, sy = top[0] + 0.08, top[1] - 0.12
    d, _ = seg_sd(X, Y, top[0], top[1], sx, sy)
    c.over(hexc("#c8b48a"), cov(d - 0.035, px * 1.5))
    sd = polygon_sd(X - sx, Y - sy, star_pts(5, 0.06 * fl, 0.22 * fl, rot=i * 0.7))
    c.add(hexc("#ffd166"), cov(sd, px * 1.5))
    c.add(hexc("#fffbe8"), cov(np.hypot(X - sx, Y - sy) - 0.06 * fl, px * 1.5))


@sheet("bomb", 4, 64, outline=1.2, note="sputtering bomb: Cluster/Shrapnel bomblets, grenades")
def fx_bomb(c, X, Y, px, t, i):
    bomb_body(c, X * 1.0, Y, px, 0.5, i)


@sheet("keg", 4, 64, outline=1.2, note="powder keg with lit fuse: Chain Keg drops")
def fx_keg(c, X, Y, px, t, i):
    bomb_body(c, X, Y - 0.05, px, 0.48, i, keg=True)


@sheet("shell", 1, 64, outline=1.2, note="Bombard shell, points +x")
def fx_shell(c, X, Y, px, t, i):
    sd = np.hypot(X / 0.7, Y / 0.42) - 1
    sd = np.minimum(sd, np.maximum(np.abs(X + 0.55) - 0.2, np.abs(Y) - 0.3))
    lam = -Y * 1.5
    c.over(ramp(lam, [(-9, hexc("#2a2e35")), (0.0, hexc("#4b525e")), (0.5, hexc("#9aa3b0"))]), cov(sd * 0.4, px * 1.5))
    c.over(hexc("#ff9a3d"), cov(np.hypot(X + 0.78, Y) - 0.12, px * 1.5))


@sheet("arrow", 1, 64, 16, outline=0.8, note="arrow, points +x")
def fx_arrow(c, X, Y, px, t, i):
    shaft = np.maximum(np.abs(Y) - 0.03, np.abs(X + 0.1) - 0.72)
    head = polygon_sd(X, Y, [(0.6, -0.12), (0.97, 0), (0.6, 0.12)])
    fl = polygon_sd(X, Y, [(-0.95, -0.15), (-0.6, -0.02), (-0.6, 0.02), (-0.95, 0.15), (-0.8, 0)])
    c.over(hexc("#c58b52"), cov(shaft, px * 1.2))
    c.over(hexc("#e9eef5"), cov(head, px * 1.2))
    c.over(hexc("#f4efe6"), cov(fl, px * 1.2))


@sheet("bolt", 1, 96, 24, outline=1.0, note="ballista bolt, points +x")
def fx_bolt(c, X, Y, px, t, i):
    shaft = np.maximum(np.abs(Y) - 0.055, np.abs(X + 0.05) - 0.78)
    head = polygon_sd(X, Y, [(0.62, -0.17), (0.98, 0), (0.62, 0.17), (0.7, 0)])
    fl = polygon_sd(X, Y, [(-0.95, -0.2), (-0.6, -0.04), (-0.6, 0.04), (-0.95, 0.2)])
    c.over(hexc("#8a5a35"), cov(shaft, px * 1.2))
    c.over(hexc("#c8d2de"), cov(head, px * 1.2))
    c.over(hexc("#e9d7b8"), cov(fl, px * 1.2))


@sheet("pellet", 1, 32, blend="add", note="turret pellet glow")
def fx_pellet(c, X, Y, px, t, i):
    r = np.hypot(X, Y)
    c.add(hexc("#ffe08a"), np.exp(-(r / 0.45) ** 2))
    c.add(hexc("#ffffff"), cov(r - 0.25, px * 1.5))


@sheet("shadow", 1, 64, note="soft contact shadow blob (flyers' ground shadow)")
def fx_shadow(c, X, Y, px, t, i):
    r = np.hypot(X, Y / 0.75)
    c.over(np.zeros(3), np.clip(1 - r, 0, 1) ** 0.7 * 0.85)


# ------------------------------------------------------------------ pack and write
def to_u8(img):
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


PAD = 2


def layout(e):
    """Frames per row for a sheet (long sheets wrap onto several rows)."""
    cols = min(e["frames"], (ATLAS_W + PAD) // (e["cw"] + PAD))
    rows = -(-e["frames"] // cols)
    return cols, rows


def pack(entries):
    """Shelf-pack each sheet's block of frames into ATLAS_W wide. Returns placements and height."""
    order = sorted(entries, key=lambda e: (-e["ch"] * layout(e)[1], -e["cw"] * e["frames"]))
    x = y = shelf = 0
    placed = {}
    for e in order:
        cols, rows = layout(e)
        bw = cols * (e["cw"] + PAD) - PAD
        bh = rows * (e["ch"] + PAD) - PAD
        if x + bw > ATLAS_W:
            x = 0; y += shelf + PAD; shelf = 0
        placed[e["name"]] = (x, y)
        x += bw + PAD
        shelf = max(shelf, bh)
    return placed, y + shelf


def checker(w, h, k=8):
    yy, xx = np.mgrid[0:h, 0:w]
    v = np.where(((xx // k) + (yy // k)) % 2, 0.32, 0.25)
    return np.dstack([v, v, v + 0.02])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--contact", action="store_true", help="also write art/vfx/contact.png")
    args = ap.parse_args([a for a in sys.argv[1:] if a != "--"])
    names = [n for n in SHEETS if not args.only or n in args.only.split(",")]
    if args.only:
        # preview only: write strips to art/vfx/build without touching the atlas
        os.makedirs(os.path.join(HERE, "build"), exist_ok=True)
        for n in names:
            fr = render_sheet(n)
            strip = np.concatenate(fr, axis=1)
            bg = checker(strip.shape[1], strip.shape[0])
            comp = strip[..., :3] * strip[..., 3:] + bg * (1 - strip[..., 3:])
            Image.fromarray(to_u8(comp)).save(os.path.join(HERE, "build", f"{n}.png"))
            print("preview", n)
        return
    rendered = {}
    for n in names:
        rendered[n] = render_sheet(n)
        print(f"{n:10s} {SHEETS[n]['frames']:2d} x {SHEETS[n]['cw']}x{SHEETS[n]['ch']}")
    entries = [dict(name=n, frames=SHEETS[n]["frames"], cw=SHEETS[n]["cw"], ch=SHEETS[n]["ch"]) for n in names]
    placed, H = pack(entries)
    H = int(math.ceil(H / 4) * 4)
    atlas = np.zeros((H, ATLAS_W, 4))
    meta = {}
    for n in names:
        s = SHEETS[n]
        x0, y0 = placed[n]
        cols, _ = layout(dict(frames=s["frames"], cw=s["cw"]))
        for k, f in enumerate(rendered[n]):
            fx0 = x0 + (k % cols) * (s["cw"] + PAD)
            fy0 = y0 + (k // cols) * (s["ch"] + PAD)
            atlas[fy0:fy0 + s["ch"], fx0:fx0 + s["cw"]] = f
        meta[n] = dict(x=x0, y=y0, w=s["cw"], h=s["ch"], frames=s["frames"], cols=cols, gap=PAD, tint=s["tint"],
                       blend=s["blend"], anchor=list(s["anchor"]))
    os.makedirs(OUT, exist_ok=True)
    im = Image.fromarray(to_u8(atlas), "RGBA")
    im.save(os.path.join(OUT, "atlas.png"), optimize=True)
    with open(os.path.join(OUT, "atlas.json"), "w") as f:
        json.dump(dict(version=1, image="atlas.png", w=ATLAS_W, h=H, sheets=meta), f, indent=1, sort_keys=True)
    print(f"atlas {ATLAS_W}x{H}, {os.path.getsize(os.path.join(OUT, 'atlas.png')) / 1024:.0f} KB, {len(meta)} sheets")
    if args.contact:
        rows = []
        for n in names:
            strip = np.concatenate(rendered[n], axis=1)
            sc = max(1, 128 // SHEETS[n]["ch"])
            strip = np.repeat(np.repeat(strip, sc, 0), sc, 1)
            bg = checker(strip.shape[1], strip.shape[0])
            rows.append(strip[..., :3] * strip[..., 3:] + bg * (1 - strip[..., 3:]))
        W = max(r.shape[1] for r in rows)
        rows = [np.pad(r, ((0, 4), (0, W - r.shape[1]), (0, 0))) for r in rows]
        Image.fromarray(to_u8(np.concatenate(rows, axis=0))).save(os.path.join(HERE, "contact.png"))
        print("contact sheet written")


if __name__ == "__main__":
    main()
