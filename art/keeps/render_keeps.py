"""Commander keeps: one stone keep per side in team colour, four damage states, rendered in Blender.

    blender -b --factory-startup -P art/keeps/render_keeps.py -- [--samples 16] [--states intact,ruined]
    npm run art:keeps

Writes base/public/keeps/<variant>_<state>.webp (tide, ember and the boss levels' ember_boss; intact, cracked, burning,
ruined and fallen) and base/public/keeps/manifest.json; needs cwebp on the PATH. Post-processing (ink silhouette, glow
halo for embers, 2x downsample) runs inside Blender with numpy, so no Pillow is needed.

The keep is built in the shared art kit (art/muster_art/kit.py): unlit toon shading, inverted-hull outlines,
team colour from the TeamColor node group. When the checkout has the style module (art/muster_art/style.py,
docs/ART-V3.md), the active direction sets the keep colours (`keep.*`), team colours, ink colour and widths, toon
bands, rim, key light and the contract camera (elevation, ppu); MUSTER_STYLE=<id> picks one, MUSTER_STYLE=v2 keeps
the v2 look. The manifest records which look was rendered. It is seen from the south at a 3/4 angle so it stands upright on
the board, and every state shares one canvas and one ground anchor so the game can swap them in place.

States, driven in game by commander hp / max hp (base/src/render/keeps.ts):
  intact   full keep, lit braziers, pennant flying
  cracked  stones knocked out, cracks, merlons fallen, torn pennant
  burning  roof caved in and charred, windows lit from inside, scorch on the stone (flames are added in game)
  ruined   the tower broken off, rubble, snapped banner pole on the ground (smoke is added in game)
  fallen   what is left once the commander is defeated: the plinth under a heap of rubble (the game drops the
           standing keep into it, base/src/render/keeps.ts collapsePose)
[skins] Cosmetic skins for the player's keep (engine/progression/cosmetics.ts KEEP_SKINS), one at a time:
    blender -b --factory-startup -P art/keeps/render_keeps.py -- --skin frost   (frost, ember, gilded, shadow, blossom)
writes base/public/keeps/skins/<name>/<state>.webp on the default keeps' canvas and anchors (so the game swaps them in
place) and leaves the default keeps and manifest alone. Each skin restyles the stone, roof, trim and banners and adds
its own props (snow and icicles, lava and braziers, gold crown and royal banners, ghost lanterns, blossom trees).
The boss variant (ember_boss) has darker stone, a crimson roof with a crown of gold spikes, gold-spiked turrets,
a shield over the gate and crowned banners.
"""
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
ROOT = os.path.dirname(ART)
sys.path.insert(0, ART)

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from muster_art import kit as K  # noqa: E402

OUT = os.path.join(ROOT, "base", "public", "keeps")
RAW = os.path.join(ART, "build", "keeps")
STATES = ("intact", "cracked", "burning", "ruined", "fallen")
# what gets rendered: each team, plus the boss levels' variant of the rival keep
VARIANTS = (("tide", "tide", False), ("ember", "ember", False), ("ember_boss", "ember", True))
TEAMS = ("tide", "ember")
PPU = 120  # output pixels per world unit (the unit sprites use the same)
SS = 2  # supersample
EL = 52.0  # camera elevation, degrees: the board's 3/4 look
LINE = 0.012  # hull outline width in world units
INK = "#0b0f18"  # outer silhouette colour
INK_PX = 2  # outer silhouette width in output pixels
STYLE = None  # the art direction id once one is applied


def load_style():
    """Take colours, line widths and camera from the active art direction (art/style/, docs/ART-V3.md) when this
    checkout has the style module; without it, or with MUSTER_STYLE=v2, the keeps keep their v2 look.
    Returns (keep colours, a function that pushes the direction into the kit once the stage exists)."""
    global PPU, EL, LINE, INK, INK_PX, STYLE
    if os.environ.get("MUSTER_STYLE") == "v2":
        return V2_KEEP, lambda: None
    try:
        from muster_art import style as S
    except ImportError:
        return V2_KEEP, lambda: None
    st, c = S.load(), S.contract()
    STYLE = st["id"]
    PPU = c["camera"]["ppu"]
    EL = float(c["camera"]["elevation_deg"])  # keeps render at the board camera so the footprint sits on the ground
    LINE = st["outline"]["props"]
    INK = st["outline"]["color"]
    INK_PX = st["outline"]["silhouette_px"]
    kp = {k: st["keep"].get(k, V2_KEEP[k]) for k in KEEP_MAIN}
    return kp, lambda: S.apply(st)  # ink, team colours, toon bands, rim, key light
AZ = -90.0  # camera looks north from the south, so the gate faces the viewer

# keep dimensions (world units, footprint centred on the origin, gate facing -Y)
R_TOWER = 0.74
ROWS = 7
ROW_H = 0.15
PER_ROW = 14


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    a = {"samples": 16, "states": ",".join(STATES), "variants": ",".join(v[0] for v in VARIANTS)}
    for i in range(0, len(argv) - 1, 2):
        a[argv[i].lstrip("-")] = argv[i + 1]
    return a


# the v2 keep colours; a style direction's `keep` section (art/style/<id>.json) replaces them
# (the second tones are derived from the main ones when a direction leaves them out)
V2_KEEP = {"stone": "#b8b0a2", "stone_dk": "#7d766b", "roof": "team.main", "trim": "#ffcf4d", "wood": "#a8703f",
           "window": "#1b1820", "window_glow": False,
           "stone2": "#a39b8d", "stone_lt": "#d6cfc0", "wood_dk": "#6b4528", "trim_dk": "#c98d2a"}
KEEP_MAIN = ("stone", "stone_dk", "roof", "trim", "wood", "window", "window_glow")

# [skins] the player's cosmetic keeps: a palette over the direction's keep colours, the accent replacing the team
# colour (banners, plinth band, turret caps), brazier flame colours, the glow halo colour, and props in build()
SKIN = None  # the skin being rendered (one of SKINS), else the default keep
SKINS = {
    "frost": {"stone": "#a9c9dd", "stone_dk": "#5d82a0", "stone2": "#95b8cf", "stone_lt": "#d9edf8", "roof": "#3f86c4",
              "trim": "#e9f7ff", "trim_dk": "#9cc3dc", "wood": "#6c7d90", "wood_dk": "#465566", "window": "#bff2ff", "window_glow": True,
              "accent": ("#4f9fdc", "#2b6699", "#c4ecff"), "flame": ("#6fd6ff", "#e8fcff"), "halo": (130, 210, 255)},
    "ember": {"stone": "#4b4249", "stone_dk": "#262025", "stone2": "#3e353c", "stone_lt": "#62565d", "roof": "#2c2125",
              "trim": "#ff9a3a", "trim_dk": "#b8551c", "wood": "#3a2a24", "wood_dk": "#22180f", "window": "#ffa040", "window_glow": True,
              "accent": ("#c8401c", "#6e1c10", "#ff9a52"), "flame": ("#ff8a2e", "#ffe08a"), "halo": (255, 125, 35)},
    "gilded": {"stone": "#f2eee6", "stone_dk": "#c9c0b0", "stone2": "#e6e0d4", "stone_lt": "#ffffff", "roof": "#2d48b0",
               "trim": "#ffcf3f", "trim_dk": "#c98a18", "wood": "#8a5a32", "wood_dk": "#5a3a20", "window": "#1b1820", "window_glow": False,
               "accent": ("#2d48b0", "#1b2b74", "#7f98ff"), "flame": ("#ffb347", "#fff2b0"), "halo": (255, 205, 90), "crown": True},
    "shadow": {"stone": "#40364c", "stone_dk": "#1f1928", "stone2": "#352c40", "stone_lt": "#584a6c", "roof": "#3a2a58",
               "trim": "#a98bff", "trim_dk": "#5f46a8", "wood": "#2c2430", "wood_dk": "#1a1420", "window": "#8fffd4", "window_glow": True,
               "accent": ("#5b3a8e", "#2d1d4c", "#a98bff"), "flame": ("#6fffc8", "#e2fff4"), "halo": (120, 255, 205), "torn": True},
    "blossom": {"stone": "#f1e6da", "stone_dk": "#c7b19f", "stone2": "#e4d4c4", "stone_lt": "#fff8ee", "roof": "#ec8db0",
                "trim": "#ffd36b", "trim_dk": "#c9952e", "wood": "#8a5a40", "wood_dk": "#5c3a28", "window": "#3a2430", "window_glow": False,
                "accent": ("#f08fb4", "#b9557d", "#ffd3e2"), "flame": ("#ffb347", "#ffe9a8"), "halo": (255, 170, 190)},
}


def mix(a, b, f):
    """Blend two #rrggbb colours: f = 0 gives a, 1 gives b."""
    ca = [int(a.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    cb = [int(b.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{round(x + (y - x) * f):02x}" for x, y in zip(ca, cb))


class Mats:
    def __init__(self, kp=V2_KEEP):
        t, g, f = K.toon, K.glow, K.flat
        st, dk = kp["stone"], kp["stone_dk"]
        self.stone = t(st)
        self.stone2 = t(kp.get("stone2") or mix(st, dk, 0.32))
        self.stone_lt = t(kp.get("stone_lt") or mix(st, "#ffffff", 0.3))
        self.stone_dk = t(dk)
        self.char = t("#4a4340")
        self.char2 = t("#5d5450")
        self.fill = f("#2a2522")
        self.hole = f("#151215")
        self.wood = t(kp["wood"])
        self.wood_dk = t(kp.get("wood_dk") or mix(kp["wood"], "#1a1210", 0.42))
        self.burnt = t("#3a2c26")
        self.iron = t("#6f7885", spec=0.2)
        self.gold = t(kp["trim"], spec=0.35)
        self.gold_dk = t(kp.get("trim_dk") or mix(kp["trim"], "#6b3a10", 0.35))
        self.team = t("team.main")
        self.team_dk = t("team.dark")
        self.team_lt = t("team.light")
        self.team_char = t("team.dark", mult=0.55)
        self.roof = t(kp["roof"])  # "team.main" / "team.dark" go through the team mask
        # arrow slits: dark, or lit from inside in a direction with glowing windows
        self.slit = g(kp["window"], 1.2) if kp.get("window_glow") else f(kp["window"])
        fl = kp.get("flame") or ("#ff9a3d", "#ffd27a")  # [skins] brazier flame colours
        self.ember = g(fl[0], 1.6)
        self.ember_hot = g(fl[1], 1.5)
        self.window_fire = g("#ffb347", 1.7)
        self.cloth = t("#efe4c8")
        ac = kp.get("accent")
        if ac:  # [skins] the skin's accent replaces the team colour
            self.team, self.team_dk, self.team_lt, self.team_char = t(ac[0]), t(ac[1]), t(ac[2]), t(ac[1], mult=0.55)
        self.ridge = self.team_dk


def boss_keep(kp):
    """The boss levels' rival keep: darker, older stone and heavier gold."""
    b = dict(kp)
    b["stone"] = mix(kp["stone"], "#5a4f62", 0.55)
    b["stone_dk"] = mix(kp["stone_dk"], "#2e2733", 0.5)
    b["roof"] = "team.dark"
    b["stone2"] = mix(b["stone"], b["stone_dk"], 0.32)
    b["stone_lt"] = mix(b["stone"], "#ffffff", 0.22)
    return b


class KeepKit(K.Kit):
    """The art kit with every explicit per-part outline width scaled to the direction's scenery line width,
    so a direction with no hull lines (outline.props = 0) turns them all off."""
    line_k = 1.0

    def _emit(self, bm, mat, loc=(0, 0, 0), rot=None, scale=1.0, smooth=True, outline=None, name="p"):
        if outline:
            outline *= self.line_k
        return super()._emit(bm, mat, loc, rot, scale, smooth, outline, name)


def jitter(rng, a):
    return (rng.random() * 2 - 1) * a


def hang(k, mat, cx, y, z0, half, ln, torn=False, tilt=0.0, notch=0.13, seed=0):
    """A hanging cloth in the plane y, top edge at z0: a swallowtail foot, or uneven tatters when torn.
    tilt (degrees) swings it round its top-left corner, as if torn loose from the other nail."""
    if not torn:
        foot = [(cx + half, z0 - ln), (cx, z0 - ln + notch), (cx - half, z0 - ln)]
    else:
        n = 6
        foot = []
        for i in range(n + 1):
            f = i / n
            d = ln * (0.55 + 0.4 * ((i * 5 + seed * 3) % 7) / 6) if i % 2 == 0 else ln * (0.38 + 0.12 * ((i + seed) % 3))
            foot.append((cx + half - 2 * half * f, z0 - d))
    pts = [(cx - half, z0), (cx + half, z0)] + foot
    if tilt:
        t = math.radians(tilt)
        ox, oz = cx - half, z0
        pts = [(ox + (x - ox) * math.cos(t) - (z - oz) * math.sin(t), oz + (x - ox) * math.sin(t) + (z - oz) * math.cos(t)) for x, z in pts]
    k.sheet([(x, y, z) for x, z in pts], mat, thick=0.012)
    return pts


# ------------------------------------------------------------------ build
def build(k, M, state, boss=False):
    s = STATES.index(state)
    sk = SKIN or {}  # [skins]
    crowned = boss or sk.get("crown", False)
    rng = random.Random(7)  # same stones in every state: damage only takes away and chars
    gate_dir = -math.pi / 2  # gate faces -Y

    # ---- plinth: two octagonal steps, the top one trimmed in team colour
    oct8 = [(math.cos(math.pi / 8 + i * math.pi / 4), math.sin(math.pi / 8 + i * math.pi / 4)) for i in range(8)]
    k.prism([(x * 1.22, y * 1.12) for x, y in oct8], 0.14, M.stone_dk, loc=(0, 0, 0.07), bevel=0.02)
    k.prism([(x * 1.06, y * 0.98) for x, y in oct8], 0.1, M.team_dk if s < 3 else M.team_char, loc=(0, 0, 0.19), bevel=0.015)
    k.prism([(x * 1.0, y * 0.92) for x, y in oct8], 0.06, M.stone if s < 2 else M.stone2, loc=(0, 0, 0.27), bevel=0.012)
    base = 0.3

    # ---- tower: rows of chunky stone blocks around a dark core
    # the cut-off height per angle for the ruined state: a jagged broken top, lowest at the front-left
    def cutoff(a):
        if s < 3:
            return ROWS
        if s == 4:  # fallen: only a jagged ring of the lowest courses is left
            return 0.6 + 0.9 * (0.5 + 0.5 * math.sin(a * 3 + 0.4)) + 0.6 * (0.5 + 0.5 * math.sin(a * 7 + 1.3))
        return 2.2 + 1.6 * (0.5 + 0.5 * math.sin(a * 2 + 1.1)) + 1.2 * (0.5 + 0.5 * math.sin(a * 5 + 0.3))

    # missing stones per state (deterministic)
    gone = set()
    if s >= 1:
        gone |= {(5, 3), (6, 4), (4, 9), (6, 11), (3, 2), (5, 10), (6, 9), (3, 11), (2, 10), (4, 12)}
    if s >= 2:
        gone |= {(5, 4), (4, 3), (6, 10), (5, 11), (3, 12), (2, 9), (6, 5)}
    # the dark core behind the stones; sunk inside the walls once the roof has gone
    core_h = {0: ROWS, 1: ROWS, 2: ROWS - 1.6, 3: 1.6, 4: 0.7}[s] * ROW_H
    k.cyl(R_TOWER - 0.09, core_h - 0.02, M.fill, loc=(0, 0, base + (core_h - 0.02) / 2), seg=24, outline=0)
    if s >= 2:
        # charred debris heaped on the sunken floor
        for i in range(10 if s == 2 else 16):
            a = rng.random() * 2 * math.pi
            rr = rng.random() * (R_TOWER - 0.25)
            sz = 0.08 + rng.random() * 0.08
            k.box((sz * 1.4, sz, sz * 0.7), M.char if i % 2 else M.burnt, loc=(math.cos(a) * rr, math.sin(a) * rr, base + core_h + 0.01),
                  rot=(jitter(rng, 30), jitter(rng, 30), math.degrees(rng.random() * 6)), bevel=0.015)
    for row in range(ROWS):
        off = (row % 2) * 0.5
        for i in range(PER_ROW):
            a = (i + off) / PER_ROW * 2 * math.pi + jitter(rng, 0.03)
            if row >= cutoff(a):
                continue
            if (row, i) in gone and not (abs(math.sin(a) + 1) < 0.25 and row < 3):
                continue
            w = 2 * math.pi * R_TOWER / PER_ROW - 0.03
            h = ROW_H - 0.018
            dz = jitter(rng, 0.006)
            r = R_TOWER - 0.04 + jitter(rng, 0.012)
            top = row >= ROWS - 2
            scorched = (s == 2 and (top or rng.random() < 0.25)) or (s >= 3 and rng.random() < 0.55)
            mat = (M.char if rng.random() < 0.5 else M.char2) if scorched else (M.stone if rng.random() < 0.55 else (M.stone2 if rng.random() < 0.7 else M.stone_lt))
            with k.at((math.cos(a) * r, math.sin(a) * r, base + row * ROW_H + ROW_H / 2 + dz), rot=(0, 0, math.degrees(a))):
                k.box((0.2, w, h), mat, bevel=0.025, outline=0.009)
            # arrow slits on the upper rows
            if row == 4 and i % 3 == 1 and abs(math.sin(a) + 1) > 0.3 and (row, i) not in gone and row < cutoff(a):
                with k.at((math.cos(a) * (r + 0.1), math.sin(a) * (r + 0.1), base + row * ROW_H + ROW_H / 2), rot=(0, 0, math.degrees(a))):
                    k.box((0.02, 0.05, 0.12), M.window_fire if s >= 2 else M.slit, outline=0)

    top_z = base + ROWS * ROW_H
    # ---- team trim band, corbels and battlements
    if s < 3:
        k.torus(R_TOWER + 0.0, 0.045, M.team_dk if s < 2 else M.team_char, loc=(0, 0, top_z - 0.25), seg=32, rseg=8)
        k.torus(R_TOWER + 0.02, 0.075, M.stone_dk if s < 2 else M.char2, loc=(0, 0, top_z + 0.045), seg=32, rseg=8, scale=(1, 1, 0.75))
        merlons = 10
        fallen = {2, 6, 7} if s == 1 else ({1, 2, 5, 7, 8} if s == 2 else set())
        for i in range(merlons):
            if i in fallen:
                continue
            a = (i + 0.5) / merlons * 2 * math.pi
            r = R_TOWER + 0.03
            mat = M.stone_lt if s < 2 else M.char2
            with k.at((math.cos(a) * r, math.sin(a) * r, top_z + 0.09 + 0.09), rot=(0, 0, math.degrees(a))):
                k.box((0.16, 0.22, 0.18), mat, bevel=0.025)
                if sk:
                    skin_merlon(k, M, s)

    # ---- roof: a team-colour cone with a gold finial and a tall standard (a crowned spire on the boss keep)
    if s <= 1:
        rh = 1.04 if boss else 0.86
        k.cone(R_TOWER - 0.06, rh, M.roof, loc=(0, 0, top_z + 0.06), seg=16)
        k.cyl(R_TOWER - 0.04, 0.06, M.ridge, loc=(0, 0, top_z + 0.09), seg=16)
        # tile ridges
        for i in range(8):
            a = i / 8 * 2 * math.pi + 0.2
            k.rod((math.cos(a) * (R_TOWER - 0.07), math.sin(a) * (R_TOWER - 0.07), top_z + 0.1), (0, 0, top_z + rh + 0.04), 0.018, M.ridge, outline=0.006)
        # a gold band a third of the way up
        k.torus((R_TOWER - 0.06) * 0.62, 0.026, M.gold, loc=(0, 0, top_z + 0.06 + rh * 0.38), seg=28, rseg=6)
        if crowned:
            # a crown of gold spikes round the roof's foot, a few knocked off once cracked
            k.torus(R_TOWER - 0.03, 0.04, M.gold, loc=(0, 0, top_z + 0.13), seg=32, rseg=8)
            for i in range(12):
                if s == 1 and i in (2, 3, 8):
                    continue
                a = (i + 0.5) / 12 * 2 * math.pi
                b0 = (math.cos(a) * (R_TOWER - 0.04), math.sin(a) * (R_TOWER - 0.04), top_z + 0.12)
                tip = (math.cos(a) * (R_TOWER + 0.06), math.sin(a) * (R_TOWER + 0.06), top_z + (0.46 if i % 2 else 0.36))
                k.crystal_at(b0, tip, 0.05, M.gold, sides=4, mid=0.25)
        if s == 1:
            # a hole knocked through the roof, splintered battens round it
            a = math.radians(-55)
            k.ball(0.15, M.hole, loc=(math.cos(a) * 0.4, math.sin(a) * 0.4, top_z + 0.36), scale=(1.0, 1.0, 0.75), outline=0)
            for d in (-0.5, 0.0, 0.45):
                p0 = (math.cos(a + d * 0.3) * 0.5, math.sin(a + d * 0.3) * 0.5, top_z + 0.3 + d * 0.08)
                k.rod(p0, (p0[0] * 0.75, p0[1] * 0.75, p0[2] + 0.12), 0.014, M.wood_dk, outline=0.005)
        tip_z = top_z + 0.06 + rh
        if crowned:
            k.crystal(0.08, 0.3, M.gold, loc=(0, 0, tip_z - 0.04), sides=4, mid=0.35)
        elif sk.get("finial"):
            sk["finial"](k, M, (0, 0, tip_z))
        else:
            k.ball(0.075, M.gold, loc=(0, 0, tip_z + 0.02))
        pole = tip_z + 0.62
        k.rod((0, 0, tip_z), (0, 0, pole + 0.04), 0.022, M.wood_dk)
        k.ball(0.04, M.gold, loc=(0, 0, pole + 0.06))
        # the standard: a swallowtail flag flying to the right; torn short and ragged once cracked
        L, fh = (0.7, 0.34) if s == 0 else (0.46, 0.3)
        if s == 0:
            fl = [(0, -0.02, pole), (L * 0.5, 0.0, pole + 0.03), (L, 0.02, pole - 0.01), (L * 0.74, 0.0, pole - fh * 0.5), (L, 0.02, pole - fh - 0.02), (L * 0.5, 0.0, pole - fh + 0.02), (0, -0.02, pole - fh)]
        else:
            fl = [(0, -0.02, pole), (L * 0.6, 0.0, pole + 0.01), (L, 0.02, pole - 0.04), (L * 0.7, 0.0, pole - fh * 0.42), (L * 0.88, 0.02, pole - fh * 0.6), (L * 0.5, 0.0, pole - fh * 0.78), (L * 0.32, 0.0, pole - fh + 0.02), (0, -0.02, pole - fh * 0.85)]
        k.sheet(fl, M.team, thick=0.014)
        if s == 0 and sk.get("crown"):
            # [skins] a gold crown on the standard
            cx, cz, q = L * 0.32, pole - fh * 0.52, 1.15
            k.sheet([(cx - 0.08 * q, -0.016, cz - 0.06 * q), (cx + 0.08 * q, -0.016, cz - 0.06 * q), (cx + 0.08 * q, -0.016, cz + 0.05 * q), (cx + 0.04 * q, -0.016, cz + 0.005 * q),
                     (cx, -0.016, cz + 0.08 * q), (cx - 0.04 * q, -0.016, cz + 0.005 * q), (cx - 0.08 * q, -0.016, cz + 0.05 * q)], M.gold, thick=0.01, outline=0.005)
        elif s == 0:
            k.sheet([(L * 0.3, -0.016, pole - fh * 0.2), (L * 0.42, -0.016, pole - fh * 0.5), (L * 0.3, -0.016, pole - fh * 0.8), (L * 0.18, -0.016, pole - fh * 0.5)], M.gold, thick=0.01, outline=0.005)
    elif s == 2:
        # caved-in, charred roof: a broken cone sitting low with beams sticking out
        k.cone(R_TOWER - 0.32, 0.36, M.team_char, loc=(0.18, 0.22, base + core_h), rot=(18, -22, 0), seg=10)
        for a, l, tilt in ((0.4, 0.62, 40), (2.2, 0.55, 55), (3.9, 0.7, 35), (5.3, 0.5, 60)):
            z0 = base + core_h
            p1 = (math.cos(a) * 0.15, math.sin(a) * 0.15, z0)
            p2 = (math.cos(a) * 0.15 + math.cos(a) * l * math.cos(math.radians(tilt)), math.sin(a) * 0.15 + math.sin(a) * l * math.cos(math.radians(tilt)), z0 + l * math.sin(math.radians(tilt)))
            k.rod(p1, p2, 0.035, M.burnt)
        for i in range(9):
            a = rng.random() * 2 * math.pi
            rr = rng.random() * 0.4
            k.ball(0.03 + rng.random() * 0.03, M.ember if i % 2 else M.ember_hot, loc=(math.cos(a) * rr, math.sin(a) * rr, base + core_h + 0.06 + rng.random() * 0.08), outline=0)
    else:
        # ruined: charred beams jutting from the broken top, embers in the core
        for a, l, tilt in ((0.9, 0.5, 30), (2.6, 0.42, 48), (4.4, 0.55, 25)):
            z0 = base + core_h
            p1 = (math.cos(a) * 0.2, math.sin(a) * 0.2, z0)
            p2 = (math.cos(a) * (0.2 + l * math.cos(math.radians(tilt))), math.sin(a) * (0.2 + l * math.cos(math.radians(tilt))), z0 + l * math.sin(math.radians(tilt)))
            k.rod(p1, p2, 0.035, M.burnt)
        for i in range(7):
            a = rng.random() * 2 * math.pi
            rr = rng.random() * 0.45
            k.ball(0.03 + rng.random() * 0.025, M.ember if i % 2 else M.ember_hot, loc=(math.cos(a) * rr, math.sin(a) * rr, base + core_h + 0.07), outline=0)

    # ---- side turrets (left and right), with team-colour caps
    for sx in (-1, 1):
        cx, cy = sx * (R_TOWER + 0.12), 0.1
        broken = s >= 3 or (s == 2 and sx > 0)
        tall = 1.0 if boss else 0.82
        h = 0.25 if s == 4 else 0.45 if s == 3 else (tall if not broken else 0.62)
        mat = M.stone2 if s < 2 else M.char2
        k.cyl(0.27, h, mat, loc=(cx, cy, base + h / 2), seg=14, bevel=0.02)
        for j in range(int(h / 0.15)):
            k.cyl(0.285, 0.022, M.stone_dk, loc=(cx, cy, base + 0.15 * (j + 1)), seg=14, outline=0)
        if not broken:
            k.cyl(0.31, 0.07, M.stone_lt if s < 2 else M.char2, loc=(cx, cy, base + h + 0.035), seg=14, bevel=0.01)
            k.cone(0.29, 0.46 if s < 2 else 0.3, M.team_dk if s < 2 else M.team_char, loc=(cx, cy, base + h + 0.07), seg=12)
            if crowned:
                k.crystal(0.05, 0.22, M.gold if s < 2 else M.burnt, loc=(cx, cy, base + h + (0.5 if s < 2 else 0.35)), sides=4)
                k.torus(0.3, 0.025, M.gold if s < 2 else M.gold_dk, loc=(cx, cy, base + h + 0.03), seg=20, rseg=6)
            else:
                k.ball(0.04, M.gold if s < 2 else M.burnt, loc=(cx, cy, base + h + (0.55 if s < 2 else 0.4)))
        else:
            # jagged stub top
            for i in range(6):
                a = i / 6 * 2 * math.pi
                with k.at((cx + math.cos(a) * 0.2, cy + math.sin(a) * 0.2, base + h + 0.03 + (i % 2) * 0.05), rot=(0, 0, math.degrees(a))):
                    k.box((0.12, 0.17, 0.08 + (i % 2) * 0.08), M.char2, bevel=0.015)

    # ---- the gate on the front
    gx, gy = 0.0, -R_TOWER + 0.0
    with k.at((gx, gy, base), rot=(0, 0, 0)):
        # stone arch frame
        k.box((0.5, 0.12, 0.44), M.stone_lt if s < 2 else M.char2, loc=(0, -0.04, 0.22), bevel=0.02)
        k.cyl(0.25, 0.12, M.stone_lt if s < 2 else M.char2, loc=(0, -0.04, 0.44), rot=(90, 0, 0), seg=16)
        # keystone in team colour
        k.box((0.1, 0.06, 0.1), M.team if s < 3 else M.team_char, loc=(0, -0.1, 0.68), bevel=0.015)
        if crowned and s < 3:
            # a gold-rimmed shield over the arch
            k.cyl(0.13, 0.04, M.gold if s < 2 else M.gold_dk, loc=(0, -0.1, 0.86), rot=(90, 0, 0), seg=16)
            k.cyl(0.095, 0.05, M.team if s < 2 else M.team_char, loc=(0, -0.11, 0.86), rot=(90, 0, 0), seg=16, outline=0)
        if s < 3:
            # wooden door with iron bands and studs
            door = M.wood if s < 2 else M.burnt
            k.box((0.36, 0.05, 0.4), door, loc=(0, -0.11, 0.2), bevel=0.012)
            k.cyl(0.18, 0.05, door, loc=(0, -0.11, 0.4), rot=(90, 0, 0), seg=14)
            for z in (0.1, 0.3):
                k.box((0.38, 0.03, 0.035), M.iron, loc=(0, -0.14, z), outline=0.006)
            for x in (-0.1, 0.1):
                for z in (0.18, 0.4):
                    k.ball(0.016, M.iron, loc=(x, -0.145, z), outline=0)
            if s == 2:
                k.box((0.08, 0.02, 0.12), M.window_fire, loc=(0.07, -0.14, 0.24), outline=0)
        else:
            # broken in: a dark opening and splintered planks
            k.box((0.34, 0.04, 0.36), M.hole, loc=(0, -0.1, 0.18), outline=0)
            k.cyl(0.17, 0.04, M.hole, loc=(0, -0.1, 0.36), rot=(90, 0, 0), seg=14, outline=0)
            k.box((0.08, 0.04, 0.3), M.burnt, loc=(-0.12, -0.13, 0.15), rot=(0, 12, 0))
            k.box((0.4, 0.04, 0.07), M.burnt, loc=(0.1, -0.3, 0.03), rot=(0, 0, 20))

    # ---- banners either side of the gate: swallowtails with a gold emblem, torn ragged when cracked (one hangs
    # from a single nail), charred tatters while burning
    for sx in (-1, 1):
        bx = sx * 0.4
        a = math.atan2(-0.62, bx)
        r = R_TOWER + 0.0
        px, py = math.cos(a) * r, math.sin(a) * r
        if s <= 1 or (s == 2 and sx < 0):
            half = 0.15 if not crowned else 0.17
            ln = 0.68 if not crowned else 0.78
            z0 = base + 0.98
            mat = M.team if s < 2 else M.team_char
            k.rod((px - half - 0.03, py - 0.05, z0 + 0.02), (px + half + 0.03, py - 0.05, z0 + 0.02), 0.016, M.wood_dk, outline=0.006)
            for ex in (-half - 0.03, half + 0.03):
                k.ball(0.022, M.gold, loc=(px + ex, py - 0.05, z0 + 0.02), outline=0)
            torn = s >= 1 or sk.get("torn", False)
            tilt = 24 if (s == 1 and sx > 0) else 0
            hang(k, mat, px, py - 0.07, z0, half, ln if s < 2 else ln * 0.7, torn=torn, tilt=tilt, seed=sx + 2)
            # a gold trim stripe across the top of the cloth
            if not tilt:
                k.box((half * 2, 0.012, 0.035), M.gold if s < 2 else M.gold_dk, loc=(px, py - 0.082, z0 - 0.05), outline=0.004)
            if s == 0:
                # gold emblem: a diamond (a crown on the boss keep)
                e = 1.2 if crowned else 1.0
                zc = z0 - 0.3
                if crowned:
                    k.sheet([(px - 0.08, py - 0.085, zc - 0.06), (px + 0.08, py - 0.085, zc - 0.06), (px + 0.08, py - 0.085, zc + 0.04), (px + 0.04, py - 0.085, zc), (px, py - 0.085, zc + 0.07), (px - 0.04, py - 0.085, zc), (px - 0.08, py - 0.085, zc + 0.04)], M.gold, thick=0.01, outline=0.005)
                else:
                    k.sheet([(px, py - 0.085, zc + 0.1 * e), (px + 0.07 * e, py - 0.085, zc), (px, py - 0.085, zc - 0.1 * e), (px - 0.07 * e, py - 0.085, zc)], M.gold, thick=0.01, outline=0.005)
            elif s == 1:
                # a torn-off scrap of the cloth on the plinth below
                k.sheet([(px - 0.06, py - 0.32, base + 0.02), (px + 0.1, py - 0.38, base + 0.02), (px + 0.03, py - 0.5, base + 0.02)], mat, thick=0.01)

    # ---- braziers on the front corners of the plinth
    for sx in (-1, 1):
        bx, by = sx * 0.78, -0.7
        if s >= 3 and sx > 0 or s == 4:
            k.cyl(0.07, 0.05, M.iron, loc=(bx + 0.1, by - 0.05, base + 0.03), rot=(80, 0, 30), seg=10)
            continue
        k.cyl(0.03, 0.16, M.iron, loc=(bx, by, base + 0.08), seg=8)
        k.cyl(0.09, 0.07, M.gold if sk.get("crown") else M.iron, loc=(bx, by, base + 0.19), r2=0.06, seg=12)
        if s < 3:
            k.crystal(0.07, 0.16, M.ember, loc=(bx, by, base + 0.2), sides=5, mid=0.3, outline=0)
            k.crystal(0.04, 0.1, M.ember_hot, loc=(bx, by, base + 0.21), sides=5, mid=0.3, outline=0)

    # ---- rubble and cracks
    if s >= 1:
        n = {1: 6, 2: 12, 3: 30, 4: 46}[s]
        for i in range(n):
            a = rng.random() * 2 * math.pi
            r = (R_TOWER + 0.1 + rng.random() * (0.35 if s < 3 else 0.5))
            if s < 3 and math.sin(a) > 0.2:
                a = -a
            z = base + 0.04 if r < 1.0 else 0.18
            sz = 0.07 + rng.random() * (0.08 if s < 3 else 0.12)
            mat = (M.stone2 if rng.random() < 0.6 else M.stone_dk) if s < 2 else (M.char2 if rng.random() < 0.5 else M.stone2)
            k.box((sz * 1.3, sz, sz * 0.8), mat, loc=(math.cos(a) * r, math.sin(a) * r, z), rot=(jitter(rng, 25), jitter(rng, 25), math.degrees(rng.random() * 6)), bevel=0.015)
        if s >= 3:
            # the snapped banner pole lies on the plinth so the side is still clear
            k.rod((-0.95, -0.55, base + 0.05), (0.15, -1.0, base + 0.04), 0.022, M.wood_dk)
            k.sheet([(-0.55, -0.72, base + 0.06), (-0.05, -0.92, base + 0.06), (-0.12, -1.12, base + 0.04), (-0.62, -0.95, base + 0.05)], M.team, thick=0.014)
            k.ball(0.05, M.gold_dk, loc=(0.18, -1.01, base + 0.05))
    if s in (1, 2):
        # cracks: dark zig-zags pressed into the front face
        for (a0, z0, z1, wob) in ((-1.95, 0.25, 0.8, 0.07), (-1.15, 0.45, 1.0, 0.06), (-1.6, 0.7, 1.05, 0.05)):
            pts = []
            for j in range(6):
                f = j / 5
                a = a0 + (wob if j % 2 else -wob) * (1 - f * 0.5)
                pts.append((math.cos(a) * (R_TOWER + 0.075), math.sin(a) * (R_TOWER + 0.075), base + z0 + (z1 - z0) * f))
            k.tube(pts, 0.022, M.hole, r_end=0.008, sides=5, outline=0)
    if sk:
        skin_props(k, M, s, sk, random.Random(11))


# ------------------------------------------------------------------ [skins] props
def _star(k, mat, c, r):
    """A flat four-point sparkle facing the camera side (gilded glints)."""
    x, y, z = c
    pts = []
    for i in range(8):
        a = i / 8 * 2 * math.pi
        rr = r if i % 2 == 0 else r * 0.28
        pts.append((x + math.cos(a) * rr, y, z + math.sin(a) * rr))
    k.sheet(pts, mat, thick=0.004, outline=0)


def _lantern(k, iron, light, core, p, scale=1.0):
    """A ghost lantern: iron caps and bars round a glowing glass."""
    x, y, z = p
    q = scale
    k.cyl(0.055 * q, 0.02 * q, iron, loc=(x, y, z + 0.075 * q), seg=8, outline=0.004)
    k.cone(0.06 * q, 0.07 * q, iron, loc=(x, y, z + 0.085 * q), seg=8)
    k.ball(0.05 * q, light, loc=(x, y, z), scale=(1, 1, 1.35), outline=0)
    k.ball(0.026 * q, core, loc=(x, y - 0.01, z), outline=0)
    for dx, dy in ((0.045, 0.0), (-0.045, 0.0), (0.0, -0.045)):
        k.rod((x + dx * q, y + dy * q, z - 0.065 * q), (x + dx * q, y + dy * q, z + 0.075 * q), 0.007 * q, iron, outline=0)
    k.cyl(0.05 * q, 0.02 * q, iron, loc=(x, y, z - 0.07 * q), seg=8, outline=0.004)


def _tree(k, rng, bark, pinks, x, y, z0, hgt, spread, n, lean=0.0):
    """A cherry-blossom tree: a crooked trunk, two boughs and a cloud of pink blossom."""
    pts = [(x, y, z0), (x + 0.04 + lean * 0.3, y, z0 + hgt * 0.35), (x - 0.03 + lean * 0.6, y, z0 + hgt * 0.65), (x + lean, y, z0 + hgt * 0.9)]
    k.tube(pts, 0.055, bark, r_end=0.028, sides=7, smooth_n=3)
    top = pts[-1]
    for bx, bz in ((-spread * 0.7, hgt * 0.05), (spread * 0.75, -hgt * 0.02)):
        k.rod((pts[2][0], y, pts[2][2]), (top[0] + bx, y + 0.02, top[2] + bz), 0.022, bark, r2=0.012)
    for i in range(n):
        dx = (rng.random() * 2 - 1) * spread
        dz = (rng.random() * 2 - 1) * spread * 0.55 + 0.04
        dy = (rng.random() * 2 - 1) * 0.14 - 0.03
        r = 0.1 + rng.random() * 0.08
        mat = pinks[0] if i % 3 == 0 else pinks[1] if i % 3 == 1 else pinks[2]
        k.ball(r, mat, loc=(top[0] + dx, top[1] + dy, top[2] + dz), scale=(1.15, 1.0, 0.85))
    for i in range(max(3, n // 3)):  # highlight puffs on the sunny side
        dx = (rng.random() * 2 - 1) * spread * 0.8
        k.ball(0.055 + rng.random() * 0.03, pinks[3], loc=(top[0] + dx, top[1] - 0.16, top[2] + spread * 0.3 + rng.random() * 0.08), outline=0)


def _petals(k, rng, mats, n, ring, z, spread=0.25, front=True):
    for i in range(n):
        a = rng.random() * 2 * math.pi
        if front and math.sin(a) > 0.3:
            a = -a
        r = ring + rng.random() * spread
        x, y = math.cos(a) * r * 1.08, math.sin(a) * r
        if abs(x) > 1.28 or y < -1.15:  # keep inside the shared canvas
            continue
        k.cyl(0.03, 0.006, mats[i % len(mats)], loc=(x, y, z), rot=(jitter(rng, 25), jitter(rng, 25), rng.random() * 180), seg=6, outline=0.003)


def skin_setup(M, name):
    """Skin-specific materials on top of the palette ones."""
    if name == "ember":
        M.ridge = K.glow("#ff7a1f", 1.4)
    elif name == "gilded":
        M.ridge = M.gold
    elif name == "shadow":
        M.ridge = K.toon("#1a1226")
        M.gold = K.glow("#b896ff", 1.15)  # the trim glows: roof band, finials, emblems
    elif name == "blossom":
        M.ridge = K.toon("#c4618a")


def skin_merlon(k, M, s):
    """Inside a merlon's frame (local x points outward): the skin's cap on each battlement."""
    name = SKIN["name"]
    if name == "frost" and s < 2:
        k.box((0.2, 0.26, 0.055), K.toon("#f5fbff"), loc=(0.005, 0, 0.105), bevel=0.025)
    elif name == "ember" and s < 2:
        k.crystal(0.045, 0.13, M.stone_dk, loc=(0, 0, 0.09), sides=4, mid=0.3)
    elif name == "gilded":
        k.box((0.175, 0.235, 0.035), M.gold if s < 2 else M.gold_dk, loc=(0, 0, 0.1), bevel=0.012, outline=0.005)
    elif name == "shadow" and s < 2:
        k.crystal(0.05, 0.17, M.stone_lt, loc=(0, 0, 0.09), sides=4, mid=0.3)


def skin_finial(name):
    def frost(k, M, p):
        k.crystal(0.075, 0.28, K.glow("#b8f0ff", 1.1), loc=(p[0], p[1], p[2] - 0.04), sides=6, mid=0.35)
    def ember(k, M, p):
        k.crystal(0.07, 0.26, K.glow("#ff8a2e", 1.5), loc=(p[0], p[1], p[2] - 0.04), sides=5, mid=0.35)
    def shadow(k, M, p):
        k.crystal(0.07, 0.3, K.glow("#c4a6ff", 1.3), loc=(p[0], p[1], p[2] - 0.04), sides=4, mid=0.4)
    return {"frost": frost, "ember": ember, "shadow": shadow}.get(name)


def skin_props(k, M, s, sk, rng):
    """The props that make each skin its own keep. s is the damage state index (0 intact .. 4 fallen)."""
    name = sk["name"]
    base = 0.3
    top_z = base + ROWS * ROW_H
    rh = 0.86
    if name == "frost":
        snow, snow2 = K.toon("#f5fbff"), K.toon("#d5e8f4")
        ice = K.toon("#e2f7ff", spec=0.6)
        iceg = K.glow("#a8e8ff", 0.9)
        if s <= 1:
            # a snow cap over the top half of the roof, dripping at its edge
            r0, f = R_TOWER - 0.06, 0.52
            zb = top_z + 0.06 + rh * (1 - f)
            k.cone(r0 * f * 1.12, rh * f * 1.06, snow, loc=(0, 0, zb - 0.015), seg=16)
            for i in range(10):
                a = -math.pi / 2 + (i - 4.5) * 0.36
                k.ball(0.04 + 0.012 * (i % 3), snow, loc=(math.cos(a) * r0 * f * 1.08, math.sin(a) * r0 * f * 1.08, zb - 0.03 - 0.02 * (i % 2)), scale=(1, 1, 1.4))
        if s < 3:
            # icicles under the battlement ring and the turret caps
            for i in range(26):
                a = i / 26 * 2 * math.pi
                if math.sin(a) > 0.2 or (s == 2 and i % 2):
                    continue
                ln = (0.12 + rng.random() * 0.14) * (0.6 if s == 2 else 1)
                r = R_TOWER + 0.09
                z = top_z + 0.0
                k.crystal_at((math.cos(a) * r, math.sin(a) * r, z), (math.cos(a) * r, math.sin(a) * r, z - ln), 0.032, ice, sides=5, mid=0.12, outline=0.006)
            for sx in (-1, 1):
                cx, cy = sx * (R_TOWER + 0.12), 0.1
                h = 0.82 if not (s == 2 and sx > 0) else 0.62
                if s < 2:
                    k.cone(0.29 * 0.5 * 1.15, 0.24, snow, loc=(cx, cy, base + h + 0.07 + 0.22), seg=12)
                for j in range(5):
                    a = -math.pi / 2 + (j - 2) * 0.5
                    ln = 0.09 + rng.random() * 0.08
                    p0 = (cx + math.cos(a) * 0.31, cy + math.sin(a) * 0.31, base + h + 0.0)
                    k.crystal_at(p0, (p0[0], p0[1], p0[2] - ln), 0.026, ice, sides=5, mid=0.12, outline=0.005)
        # snow lying on the plinth steps, drifted up in soft heaps at the corners, deeper in the ruins
        oct8 = [(math.cos(math.pi / 8 + i * math.pi / 4), math.sin(math.pi / 8 + i * math.pi / 4)) for i in range(8)]
        k.prism([(x * 1.235, y * 1.135) for x, y in oct8], 0.035, snow, loc=(0, 0, 0.15), bevel=0.016)
        k.prism([(x * 1.015, y * 0.935) for x, y in oct8], 0.03, snow, loc=(0, 0, 0.31), bevel=0.012)
        for (x, y, sc) in ((-1.0, -0.55, 1.0), (0.95, -0.6, 0.8), (-0.35, -1.02, 0.7), (1.12, 0.1, 0.7), (-1.15, 0.05, 0.8)):
            k.ball(0.13 * sc, snow, loc=(x, y, 0.17), scale=(1.6, 1.1, 0.55), outline=0.006)
            k.ball(0.08 * sc, snow2, loc=(x + 0.1 * sc, y - 0.04, 0.16), scale=(1.4, 1.0, 0.5), outline=0.005)
        if s >= 3:
            for i in range(8):
                a = rng.random() * 2 * math.pi
                rr = 0.4 + rng.random() * 0.5
                k.ball(0.1, snow, loc=(math.cos(a) * rr, math.sin(a) * rr - 0.2, base + 0.06), scale=(1.4, 1.1, 0.5))
        # ice crystal clusters at the plinth corners (they glow in every state)
        for (cx, cy, sc) in ((-1.02, -0.38, 1.5), (1.05, -0.26, 1.2), (0.55, -1.0, 0.9)):
            for j, (dx, tilt, hh) in enumerate(((0.0, 0, 0.32), (0.08, 25, 0.22), (-0.08, -28, 0.2), (0.03, 10, 0.14))):
                bz = 0.14
                tip = (cx + dx + math.sin(math.radians(tilt)) * hh * sc, cy - 0.02 * j, bz + math.cos(math.radians(tilt)) * hh * sc)
                k.crystal_at((cx + dx, cy - 0.02 * j, bz - 0.02), tip, 0.05 * sc, iceg if j == 0 else ice, sides=6, mid=0.6)
    elif name == "ember":
        lava, lava_hot = K.glow("#ff6a14", 1.7), K.glow("#ffc05a", 1.6)
        basalt = K.toon("#1c171b")
        iron = K.toon("#2d2a2e", spec=0.2)
        # a lava channel ringing the plinth
        k.torus(1.0, 0.032, lava, loc=(0, 0, 0.145), scale=(1.13, 1.04, 0.5), seg=48, rseg=6, outline=0)
        # molten seams down the front of the tower
        if s < 4:
            zt = 0.32 if s >= 3 else 1.0
            for (a0, z0, z1, wob) in ((-1.35, 0.03, 0.62, 0.05), (-1.9, 0.08, 0.5, 0.06), (-0.9, 0.05, 0.42, 0.04), (-1.62, 0.55, 0.95, 0.05)):
                if z0 >= zt:
                    continue
                z1 = min(z1, zt)
                pts = []
                for j in range(6):
                    f = j / 5
                    a = a0 + (wob if j % 2 else -wob) * (1 - f * 0.4)
                    pts.append((math.cos(a) * (R_TOWER + 0.07), math.sin(a) * (R_TOWER + 0.07), base + z0 + (z1 - z0) * f))
                k.tube(pts, 0.024, lava, r_end=0.01, sides=5, outline=0)
        # tall iron braziers flanking the keep
        for sx in (-1, 1):
            bx, by = sx * 1.04, -0.42
            if s >= 3 and sx < 0:
                k.cyl(0.1, 0.06, iron, loc=(bx, by - 0.1, 0.18), rot=(75, 0, -30), seg=10)
                k.ball(0.06, lava, loc=(bx + 0.05, by - 0.2, 0.15), scale=(1.4, 1, 0.4), outline=0)
                continue
            k.cyl(0.035, 0.36, iron, loc=(bx, by, 0.14 + 0.18), seg=8)
            for j in range(3):
                a = j / 3 * 2 * math.pi + 0.5
                k.rod((bx, by, 0.36), (bx + math.cos(a) * 0.12, by + math.sin(a) * 0.12, 0.14), 0.016, iron, outline=0.005)
            k.cyl(0.12, 0.09, iron, loc=(bx, by, 0.55), r2=0.08, seg=12)
            k.torus(0.12, 0.018, M.gold_dk, loc=(bx, by, 0.6), seg=16, rseg=5, outline=0.004)
            k.crystal(0.1, 0.26, lava, loc=(bx, by, 0.58), sides=5, mid=0.3, outline=0)
            k.crystal(0.055, 0.17, lava_hot, loc=(bx, by, 0.6), sides=5, mid=0.3, outline=0)
        # basalt shards jutting from the plinth's foot
        for (cx, cy) in ((-0.8, -0.86), (0.62, -0.95), (-1.15, 0.05), (1.17, 0.12)):
            for j in range(3):
                tilt = (j - 1) * 22
                hh = 0.18 + 0.06 * ((j + 1) % 2)
                tip = (cx + math.sin(math.radians(tilt)) * hh, cy - 0.02, math.cos(math.radians(tilt)) * hh)
                k.crystal_at((cx + (j - 1) * 0.05, cy, -0.02), tip, 0.045, basalt, sides=5, mid=0.5)
        if s >= 2:
            for i in range(6 if s == 2 else 10):
                a = rng.random() * 2 * math.pi
                rr = 0.85 + rng.random() * 0.3
                if math.sin(a) > 0.3:
                    a = -a
                k.ball(0.05 + rng.random() * 0.03, lava if i % 2 else lava_hot, loc=(math.cos(a) * rr, math.sin(a) * rr, 0.16), scale=(1.5, 1.2, 0.35), outline=0)
    elif name == "gilded":
        gold = M.gold if s < 2 else M.gold_dk
        spark = K.glow("#fff3c0", 1.5)
        # gold bands round the marble tower
        if s < 3:
            for z in ((ROW_H * 2, ROW_H * 5) if s < 2 else (ROW_H * 2,)):
                k.torus(R_TOWER + 0.03, 0.028, gold, loc=(0, 0, base + z), seg=44, rseg=6, outline=0.005)
        # a gold stripe round the middle step of the plinth
        oct8 = [(math.cos(math.pi / 8 + i * math.pi / 4), math.sin(math.pi / 8 + i * math.pi / 4)) for i in range(8)]
        k.prism([(x * 1.075, y * 0.995) for x, y in oct8], 0.035, gold, loc=(0, 0, 0.2), bevel=0.008, outline=0.005)
        # royal banners hanging on the turrets' fronts, gold-fringed, crowned
        if s < 3:
            for sx in (-1, 1):
                if s == 2 and sx > 0:
                    continue
                cx, cy = sx * (R_TOWER + 0.12), 0.1 - 0.29
                z0 = base + 0.74
                ln = 0.5 if s < 2 else 0.34
                k.rod((cx - 0.15, cy - 0.01, z0 + 0.02), (cx + 0.15, cy - 0.01, z0 + 0.02), 0.014, gold, outline=0.005)
                hang(k, M.team if s < 2 else M.team_char, cx, cy - 0.03, z0, 0.12, ln, torn=s >= 1, seed=sx + 5, notch=0.1)
                if s == 0:
                    k.box((0.24, 0.012, 0.03), gold, loc=(cx, cy - 0.045, z0 - 0.05), outline=0.004)
                    zc = z0 - 0.22
                    k.sheet([(cx - 0.06, cy - 0.048, zc - 0.045), (cx + 0.06, cy - 0.048, zc - 0.045), (cx + 0.06, cy - 0.048, zc + 0.03), (cx + 0.03, cy - 0.048, zc), (cx, cy - 0.048, zc + 0.055), (cx - 0.03, cy - 0.048, zc), (cx - 0.06, cy - 0.048, zc + 0.03)], gold, thick=0.008, outline=0.004)
                    for f in range(5):  # gold tassels at the swallowtail's points
                        fx = cx - 0.12 + f * 0.06
                        k.ball(0.014, gold, loc=(fx, cy - 0.045, z0 - ln + (0.1 if f == 2 else 0.02 + 0.04 * (f % 2 == 1))), outline=0)
        # pennants flying from the turret spikes
        if s < 2:
            for sx in (-1, 1):
                cx, cy = sx * (R_TOWER + 0.12), 0.1
                pz = base + 0.82 + 0.6
                k.rod((cx, cy, pz), (cx, cy, pz + 0.34), 0.012, M.wood_dk, outline=0.004)
                L = 0.3 if s == 0 else 0.2
                k.sheet([(cx, cy - 0.01, pz + 0.33), (cx + L * 0.55, cy, pz + 0.3), (cx + L, cy + 0.01, pz + 0.27), (cx + L * 0.55, cy, pz + 0.22), (cx, cy - 0.01, pz + 0.2)], M.team, thick=0.01)
            # glints on the gold
            for (p, r) in (((0.13, -0.3, top_z + 1.08), 0.08), ((-0.5, -0.62, top_z + 0.3), 0.055), ((0.86, -0.3, base + 1.52), 0.05), ((-0.12, -0.95, base + 0.95), 0.05)):
                _star(k, spark, p, r)
        # a crimson carpet, gold-edged, rolled down the steps from the gate
        if s < 3:
            red = K.toon("#c8283c") if s < 2 else K.toon("#5a1a22")
            for (y0, y1, z) in ((-0.8, -0.93, 0.302), (-0.93, -1.0, 0.245), (-1.0, -1.14, 0.142)):
                k.box((0.3, abs(y1 - y0), 0.012), red, loc=(0, (y0 + y1) / 2, z), outline=0.004)
                for sx in (-1, 1):
                    k.box((0.022, abs(y1 - y0), 0.016), gold, loc=(sx * 0.15, (y0 + y1) / 2, z + 0.002), outline=0)
            for (y, z0, z1) in ((-0.93, 0.245, 0.302), (-1.0, 0.142, 0.245)):
                k.box((0.3, 0.012, z1 - z0), red, loc=(0, y - 0.006, (z0 + z1) / 2), outline=0.004)
        # gold-capped marble pillars at the back corners
        for sx in (-1, 1):
            px, py = sx * 1.08, -0.2
            hh = 0.5 if s < 3 else 0.2
            k.cyl(0.07, hh, M.stone_lt if s < 2 else M.stone2, loc=(px, py, 0.14 + hh / 2), seg=10, bevel=0.01)
            k.cyl(0.09, 0.04, gold, loc=(px, py, 0.14 + 0.02), seg=10)
            if s < 3:
                k.cyl(0.09, 0.04, gold, loc=(px, py, 0.14 + hh), seg=10)
                k.ball(0.065, gold, loc=(px, py, 0.14 + hh + 0.08))
                k.crystal(0.03, 0.1, gold, loc=(px, py, 0.14 + hh + 0.12), sides=4)
            else:
                k.ball(0.065, gold, loc=(px + 0.12, py - 0.15, 0.17))
    elif name == "shadow":
        ghost, core = K.glow("#7dffd0", 1.5), K.glow("#eafff8", 1.4)
        violet = K.glow("#b48cff", 1.2)
        iron = K.toon("#29222f", spec=0.15)
        # ghost lanterns on iron arms off the tower
        if s < 3:
            for i, a in enumerate((math.radians(-90 - 52), math.radians(-90 + 52))):
                if s == 2 and i == 1:
                    continue
                r0 = R_TOWER + 0.02
                z = base + 0.86
                wall = (math.cos(a) * r0, math.sin(a) * r0, z + 0.22)
                out = (math.cos(a) * (r0 + 0.2), math.sin(a) * (r0 + 0.2), z + 0.22)
                k.rod(wall, out, 0.014, iron, outline=0.004)
                k.rod((wall[0], wall[1], wall[2] - 0.12), (out[0] * 0.92, out[1] * 0.92, out[2]), 0.01, iron, outline=0.003)
                k.rod(out, (out[0], out[1], out[2] - 0.06), 0.006, iron, outline=0)
                _lantern(k, iron, ghost, core, (out[0], out[1], out[2] - 0.17), 1.45)
        # tall crooked lantern posts at the plinth's front corners
        for sx in (-1, 1):
            px, py = sx * 1.04, -0.4
            if s >= 3 and sx > 0:
                k.rod((px - 0.3, py - 0.25, 0.17), (px + 0.05, py - 0.05, 0.16), 0.02, iron)
                _lantern(k, iron, ghost, core, (px - 0.32, py - 0.32, 0.2), 0.9)
                continue
            k.rod((px, py, 0.14), (px, py, 0.82), 0.02, iron)
            k.rod((px, py, 0.8), (px - sx * 0.16, py - 0.02, 0.84), 0.014, iron, outline=0.004)
            k.ball(0.03, violet, loc=(px, py, 0.85), outline=0)
            _lantern(k, iron, ghost, core, (px - sx * 0.16, py - 0.02, 0.66), 1.4)
        # drifting wisps with fading tails
        if s < 4:
            for (x, y, z, dx) in ((-0.98, -0.75, 1.35, 1), (0.95, -0.7, 1.75, -1), (-0.45, -1.0, 0.82, 1)):
                for j in range(5):  # a ghost-light comet: a bright head and a tight fading tail
                    k.ball(0.065 * (1 - j * 0.17), ghost if j < 2 else violet, loc=(x - dx * j * 0.04, y, z - j * 0.022), outline=0)
        # violet runes glowing on the plinth step
        for i in range(7):
            a = -math.pi / 2 + (i - 3) * 0.42
            k.box((0.05, 0.012, 0.035), violet, loc=(math.cos(a) * 1.0 * 1.06, math.sin(a) * 0.985, 0.2), rot=(0, 0, math.degrees(a) + 90), outline=0)
    elif name == "blossom":
        pinks = [K.toon("#f6a3c2"), K.toon("#ffc6db"), K.toon("#e27aa2"), K.toon("#fff0f6")]
        bark = K.toon("#5b3b2e")
        thin = 0.75 if s >= 3 else 1.0
        _tree(k, rng, bark, pinks, -0.97, -0.22, 0.12, 0.95, 0.2, int(14 * thin), lean=0.06)
        _tree(k, rng, bark, pinks, 1.0, -0.38, 0.12, 0.68, 0.19, int(10 * thin), lean=-0.06)
        # fallen petals on the steps and the ground, and a few in the air
        _petals(k, rng, pinks[:3], 26, 1.02, 0.15, 0.12)
        _petals(k, rng, pinks[:2], 14, 0.9, 0.305, 0.08)
        _petals(k, rng, pinks[:3], 16, 1.16, 0.005, 0.08)
        for (x, y, z) in ((-0.62, -0.95, 1.1), (0.4, -0.9, 1.4), (-0.2, -1.0, 0.65), (0.82, -0.8, 1.05), (-0.95, -0.7, 0.55)):
            k.cyl(0.032, 0.006, pinks[1], loc=(x, y, z), rot=(55, jitter(rng, 30), rng.random() * 180), seg=6, outline=0.003)
        if s <= 1:
            # petals settled on the roof
            for i in range(9):
                f = 0.12 + (i % 4) * 0.17
                a = -math.pi / 2 + (i - 4) * 0.3
                rr = (R_TOWER - 0.06) * (1 - f) + 0.01
                k.ball(0.028, pinks[i % 2], loc=(math.cos(a) * rr, math.sin(a) * rr, top_z + 0.06 + rh * f), scale=(1.2, 1.2, 0.5), outline=0.003)
        # paper lanterns strung over the gate
        if s < 2:
            y = -R_TOWER - 0.08
            pts = [(-0.42, y, base + 1.0), (-0.2, y - 0.03, base + 0.9), (0.0, y - 0.04, base + 0.88), (0.2, y - 0.03, base + 0.9), (0.42, y, base + 1.0)]
            k.tube(pts, 0.006, M.wood_dk, sides=4, outline=0)
            lamp = K.glow("#ffd0a0", 1.1)
            for x, z in ((-0.2, 0.9), (0.2, 0.9)):
                k.ball(0.055, pinks[2], loc=(x, y - 0.04, base + z - 0.07), scale=(1, 1, 1.25))
                k.ball(0.03, lamp, loc=(x, y - 0.075, base + z - 0.07), outline=0)


# ------------------------------------------------------------------ stage
def setup(samples):
    st = K.Stage(samples=samples)
    a, e = math.radians(AZ), math.radians(EL)
    d = Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
    st.cam.location = d * 20
    st.cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    st.cam.data.sensor_fit = "HORIZONTAL"
    m = st.cam.rotation_euler.to_matrix()
    right, up, back = m.col[0], m.col[1], m.col[2]
    K.set_light(up * 0.9 - right * 0.5 + back * 0.6)
    return st


def project(st, verts):
    bpy.context.view_layer.update()
    mi = np.array(st.cam.matrix_world.inverted())
    h = np.c_[verts, np.ones(len(verts))]
    return (h @ mi.T)[:, :2]


def render(st, path, w, h, span_x, cx, cy):
    sc = st.sc
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    st.cam.data.ortho_scale = span_x
    st.cam.data.shift_x = cx / span_x
    st.cam.data.shift_y = cy / span_x
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------ post (numpy in Blender)
def load_rgba(path):
    im = bpy.data.images.load(path, check_existing=False)
    w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]  # top row first
    bpy.data.images.remove(im)
    return a


def save_rgba(path, a):
    h, w = a.shape[:2]
    im = bpy.data.images.new("out", w, h, alpha=True)
    im.alpha_mode = "STRAIGHT"
    im.colorspace_settings.name = "sRGB"
    out = a.copy()
    al = out[..., 3:4]
    out[..., :3] = np.where(al > 1e-4, out[..., :3] / np.maximum(al, 1e-4), 0)  # unpremultiply
    im.pixels[:] = np.clip(out[::-1], 0, 1).ravel()
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)


def premul(a):
    a = a.copy()
    a[..., :3] *= a[..., 3:4]
    return a


def shift(img, dy, dx):
    out = np.zeros_like(img)
    H, W = img.shape[:2]
    out[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = img[max(0, -dy):H + min(0, -dy), max(0, -dx):W + min(0, -dx)]
    return out


def dilate(al, r):
    out = al.copy()
    rr = r + 0.35
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if 0 < dx * dx + dy * dy <= rr * rr:
                out = np.maximum(out, shift(al, dy, dx))
    return out


def box_blur(ch, r):
    """Three passes of a separable box blur ~ gaussian."""
    out = ch
    for _ in range(3):
        for axis in (0, 1):
            c = np.cumsum(np.pad(out, [(r + 1, r) if i == axis else (0, 0) for i in range(2)], mode="edge"), axis=axis)
            hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
            out = (hi - lo) / (2 * r + 1)
    return out


def over(top, bot):
    return top + bot * (1 - top[..., 3:4])


def post(raw, glow, out_path, halo=(255, 150, 60)):
    img = premul(load_rgba(raw))
    ink_a = dilate(img[..., 3], INK_PX * SS)
    ink = np.zeros_like(img)
    ink[..., :3] = np.array([int(INK.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)], np.float32)[None, None] / 255 * ink_a[..., None]
    ink[..., 3] = ink_a
    out = over(img, ink)
    if glow and os.path.exists(glow):
        g = premul(load_rgba(glow))
        ga = g[..., 3]
        if ga.max() > 0.01:
            wide = np.clip(box_blur(ga, 9) * 2.2, 0, 0.6)
            col = np.array(halo, np.float32) / 255
            halo = np.zeros_like(img)
            halo[..., :3] = col * wide[..., None]
            halo[..., 3] = wide
            out = over(out, halo)
            bl = np.stack([box_blur(g[..., i], 3) for i in range(3)], -1)
            out[..., :3] = np.minimum(out[..., :3] + bl * 0.5 * out[..., 3:4], out[..., 3:4])
    # 2x box downsample
    H, W = out.shape[:2]
    out = out[:H - H % SS, :W - W % SS].reshape(H // SS, SS, W // SS, SS, 4).mean((1, 3))
    save_rgba(out_path, out)
    return out.shape[1], out.shape[0]


def webp(src, dst, q=88, alpha_q=100):
    """The game loads webp (a third of the PNG size); cwebp keeps the alpha lossless."""
    import shutil
    import subprocess
    exe = shutil.which("cwebp") or "/opt/homebrew/bin/cwebp"
    subprocess.run([exe, "-quiet", "-q", str(q), "-alpha_q", str(alpha_q), "-m", "6", src, "-o", dst], check=True)


# ------------------------------------------------------------------ main
def main():
    a = args()
    states = [x for x in a["states"].split(",") if x in STATES]
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    kp, apply_style = load_style()  # before setup: it may change the camera elevation
    st = setup(int(a["samples"]))
    apply_style()  # after setup so the direction's toon group and key light win over the stage defaults
    print(f"KEEP_STYLE {STYLE or 'v2'} el={EL} ppu={PPU}", flush=True)
    k = KeepKit(outline=LINE)
    k.line_k = LINE / 0.012
    M = Mats(kp)
    Mb = Mats(boss_keep(kp))
    # one canvas for every state and variant: frame on the union of all of them
    lo, hi = None, None
    for state in STATES:
        for boss in (False, True):
            k.clear()
            build(k, Mb if boss else M, state, boss)
            xy = project(st, k.verts_world())
            l, h = xy.min(0), xy.max(0)
            lo = l if lo is None else np.minimum(lo, l)
            hi = h if hi is None else np.maximum(hi, h)
    pad = 0.08
    lo, hi = lo - pad, hi + pad
    span = hi - lo
    w = int(math.ceil(span[0] * PPU / 4) * 4)
    h = int(math.ceil(span[1] * PPU / 4) * 4)
    span_x = w / PPU
    c = (lo + hi) / 2
    # the ground anchor (footprint centre) and effect anchors, in output pixels from the top-left
    def px(p):
        q = project(st, np.array([p], np.float32))[0]
        return [round(float((q[0] - c[0]) * PPU + w / 2), 1), round(float((c[1] - q[1]) * PPU + h / 2), 1)]
    top_z = 0.3 + ROWS * ROW_H
    anchors = {
        "ground": px((0, 0, 0)),
        "gate": px((0, -R_TOWER - 0.1, 0.55)),
        "top": px((0, 0, top_z + 0.3)),
        # the standard's pole top (intact roof), where the winner's banner is run up
        "pole": px((0, 0, top_z + 0.06 + 0.86 + 0.62)),
        # where flames and smoke rise from in the burning and ruined states
        "fires": [px((0.05, 0, top_z + 0.15)), px((-0.42, -0.5, 0.95)), px((0.87, 0.1, 0.9)), px((0.35, -0.62, 0.72))],
        "smoke": [px((0, 0, 0.7)), px((-0.5, -0.4, 0.5)), px((0.6, -0.2, 0.55))],
    }
    variants = [v for v in VARIANTS if v[0] in a["variants"].split(",")]
    if a.get("skin"):
        return render_skin(a["skin"], states, st, k, kp, w, h, span_x, c)
    for state in states:
        for name, team, boss in variants:
            k.clear()
            build(k, Mb if boss else M, state, boss)
            K.set_team(team)
            raw = os.path.join(RAW, f"{name}_{state}.png")
            glow = os.path.join(RAW, f"{name}_{state}_glow.png")
            K.set_glowpass(False)
            render(st, raw, w * SS, h * SS, span_x, float(c[0]), float(c[1]))
            K.set_glowpass(True)
            render(st, glow, w * SS, h * SS, span_x, float(c[0]), float(c[1]))
            K.set_glowpass(False)
            png = os.path.join(RAW, f"{name}_{state}_out.png")
            post(raw, glow, png)
            webp(png, os.path.join(OUT, f"{name}_{state}.webp"))
            print(f"KEEP_OK {name}_{state} {w}x{h}", flush=True)
    man = {"ppu": PPU, "w": w, "h": h, "elevation": EL, "style": STYLE or "v2", "states": list(STATES), "teams": list(TEAMS),
           "variants": [v[0] for v in VARIANTS],
           "footprint": round(1.22, 2), "anchors": anchors}
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(man, f, indent=1)
    print("KEEPS_DONE", flush=True)


def render_skin(name, states, st, k, kp, w, h, span_x, c):
    """[skins] The player's keep in a cosmetic skin, on the default canvas: base/public/keeps/skins/<name>/<state>.webp."""
    global SKIN
    SKIN = dict(SKINS[name], name=name, finial=skin_finial(name))
    M = Mats({**kp, **{x: v for x, v in SKINS[name].items() if x not in ("halo", "crown", "torn")}})
    skin_setup(M, name)
    out = os.path.join(OUT, "skins", name)
    os.makedirs(out, exist_ok=True)
    for state in states:
        k.clear()
        build(k, M, state, False)
        K.set_team("tide")
        raw = os.path.join(RAW, f"skin_{name}_{state}.png")
        glow = os.path.join(RAW, f"skin_{name}_{state}_glow.png")
        K.set_glowpass(False)
        render(st, raw, w * SS, h * SS, span_x, float(c[0]), float(c[1]))
        K.set_glowpass(True)
        render(st, glow, w * SS, h * SS, span_x, float(c[0]), float(c[1]))
        K.set_glowpass(False)
        png = os.path.join(RAW, f"skin_{name}_{state}_out.png")
        post(raw, glow, png, SKIN["halo"])
        webp(png, os.path.join(out, f"{state}.webp"), q=74, alpha_q=90)
        print(f"SKIN_OK {name}_{state} {w}x{h}", flush=True)
    print("SKIN_DONE", name, flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)
