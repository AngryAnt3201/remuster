"""Arenas v3: one battlefield per campaign act in the active style direction (Sunlit Meadow), for the 3/4 camera.

    blender -b --factory-startup -P art/arenas/render_arenas.py -- [--only 1,5] [--samples 16] [--quick] [--no-ground | --no-props]
    npm run art:arenas

Per act this renders, with the shared toon kit (art/muster_art: ink hulls, cel bands, violet shadow tint):
  - act<n>.jpg: the backdrop through the game's own camera (base/src/render/camera.ts: pinhole, TILT from straight down,
    DIST from the board centre). A ground point with board-centred (X, Y) lands on the normalised image plane at
    u = X / cz, v = Y cos(tilt) / cz, cz = DIST - Y sin(tilt), the same numbers the game uses, so the game draws the
    image with one scale + offset and the ground lines up with the board exactly on any screen. It holds the ground,
    the neutral strip and kerbs, the path, the keep plazas, the hedges (or walls, rails...) around the board and the
    trees and scenery beyond: everything that never moves and stays out of the play area.
  - act<n>_prop<0..2>.png: three obstacle props, modelled with their base on the unit circle (radius 1 = the
    obstacle's collision radius), rendered orthographic at the camera's mid-board elevation, contact shadow baked.
    The game stands them on their circles and depth-sorts them with units and keeps.
  - manifest.json: camera, image-plane view, prop frame/anchor, measured prop footprints.
Shapes and palettes are original, built from primitives; nothing is traced from another game.
"""
import argparse
import copy
import json
import math
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
ROOT = os.path.dirname(ART)
sys.path.insert(0, ART)
OUT = os.path.join(ROOT, "base", "public", "arenas")
BUILD = os.path.join(ART, "build", "arenas")

W, H, ZD = 9.0, 14.0, 5.9
TILT, DIST = 0.64, 30.0  # base/src/render/camera.ts
VIEW = {"u0": -0.26, "u1": 0.26, "v0": -0.42, "v1": 0.44}  # covers a phone (and most tablets) around the board
KPX = 2800  # backdrop px per normalised image-plane unit (a phone shows ~1100 css px per unit)
KEEPS = [(4.5, 1.55), (4.5, H - 0.6)]  # base/src/render/keeps.ts keepAnchor
PROP_X = (-1.6, 1.6)
PROP_U = (-1.3, 2.5)
PROP_PPU = 160

# Act themes: overrides on the direction's ground palette plus what grows around the board.
ACTS = {
    1: dict(name="Borderlands", g={}, border="hedge", trees=("broad",), scatter="flowers", obstacle="boulder", footing=True,
            dress=dict(stripes=True, wear=True, clumps="flowers", n_clumps=32, tufts=80, cobbles=("#dcc595", "#cfb682", "#e7d3a3", "#c4a976"),
                       banners=("#f4e6c4", "#ffcf4d")),
            fg="canopy"),
    2: dict(name="Ash Fields", g=dict(grass="#c3b85c", grass_dk="#a89c48", grass_lt="#d9cf7a", strip="#d8b98a", strip_dk="#b99a68",
                                       foliage="#e8913c", foliage_dk="#c0612c", path="#e6c48e", path_dk="#c69b62", moss="#b2a04a"),
            border="hedge", trees=("broad", "broad", "dead"), scatter="embers", obstacle="charstump", footing=True,
            dress=dict(wear=True, clumps="dry", n_clumps=26, tufts=60, cracks=30, banners=("#e8dcc0", "#c0612c"),
                       cobbles=("#b99a68", "#a88a5a", "#c4a675", "#9c7f52"), cobble_size=0.64, cobble_gap=0.07), fg="canopy"),
    3: dict(name="Hollow Wood", g=dict(grass="#6cb552", grass_dk="#54993f", grass_lt="#8ccb63", foliage="#46a04c", foliage_dk="#2e7a3a",
                                       strip="#c9b083", strip_dk="#a98f63"),
            border="hedge", trees=("broad", "pine", "broad"), scatter="mushrooms", obstacle="stump",
            dress=dict(wear=True, clumps="ferns", n_clumps=30, tufts=90, moss=16, roots=True, rings=True,
                       cobbles=("#9fa88c", "#8e9a7c", "#aab39a", "#b5ab8c"), cobble_size=0.62, cobble_gap=0.08), fg="canopy"),
    4: dict(name="Iron Pass", g=dict(grass="#a2bd72", grass_dk="#88a35d", grass_lt="#bcd38e", path="#ddd2b8", path_dk="#b8aa8c",
                                     strip="#cfc6b2", strip_dk="#aea38c", foliage="#4f9a5e", foliage_dk="#2f6f45", rock="#b4b0a8", rock_dk="#7d7972"),
            border="rocks", trees=("pine", "pine", "crag"), scatter="pebbles", obstacle="crag",
            dress=dict(wear=True, clumps="heather", n_clumps=26, tufts=40, gravel=18, cracks=12, banners=("#cfd8e3", "#4f6f9a"), rails=True), fg="pines"),
    5: dict(name="High Keep", g=dict(grass="#8cc45e", grass_dk="#70ad4b", grass_lt="#a9d878", path="#cf5446", path_dk="#9c3a30",
                                     strip="#86c25a", strip_dk="#6aa947", court="#dcc6a0", court_dk="#a88d68"),
            court=True, strip_pat="patches", border="wall", trees=("topiary",), scatter="flowers", obstacle="pillar",
            relief="flagstones", stones=("#dcc6a0", "#e7d6b3", "#ccb38b", "#d5bf98"), trim="#ffcf4d", lozenges="#b8463a",
            dress=dict(clumps="flowers", n_clumps=0, cracks=18, banners=("#cf5446", "#ffcf4d")), fg="topiary"),
    6: dict(name="Frozen Reach", g=dict(grass="#eef5fb", grass_dk="#d3e2ef", grass_lt="#ffffff", path="#c5d7e8", path_dk="#9fb7cf",
                                        strip="#dbe7f2", strip_dk="#b9cde0", foliage="#3f8f6a", foliage_dk="#2b6b52", rock="#a9b4c2", rock_dk="#76828f",
                                        moss="#f4f9ff", edge="#8aa2bb"),
            border="snow", trees=("snowpine",), scatter="ice", obstacle="icerock", relief="snow", fg="snowpines",
            dress=dict(clumps="frost", n_clumps=20, banners=("#e9f2fb", "#5b7fb0"))),
    7: dict(name="Sky Throne", g=dict(grass="#bfe0ff", grass_dk="#a6d0f7", grass_lt="#e6f3ff", path="#6f8fe0", path_dk="#4c69bd",
                                      strip="#efe3c8", strip_dk="#cdbd9a", court="#f5efe3", court_dk="#d9cdb6", rock="#f2ece0", rock_dk="#c9bfae"),
            court=True, border="rail", trees=("cloud",), scatter="none", obstacle="obelisk",
            relief="flagstones", stones=("#f3e7cf", "#fbf4e4", "#e6d6b8", "#dfe4ee", "#eadcc0"), strip_stones=("#e5c98f", "#efd9a6", "#d8b878"),
            inlay="#ffcf4d", trim="#ffcf4d", path_tiles=True, rosettes=True, lapis="#3f63c8",
            dress=dict(cracks=22, banners=("#3f63c8", "#ffcf4d")), fg="sky"),
    8: dict(name="Mirelight Fen", g=dict(grass="#88bd62", grass_dk="#6ea44f", grass_lt="#a6d47a", path="#d0aa78", path_dk="#9a7550",
                                         strip="#6fb9b8", strip_dk="#4f9a9c", foliage="#78b552", foliage_dk="#4f8d3e", moss="#86b852",
                                         willow="#b2d35e", willow_dk="#86ad44",
                                         rock="#a3a48c", rock_dk="#737660", edge="#5d8a49", plank="#cf9d62", plank_dk="#9a6b3d"),
            border="reeds", trees=("willow", "willow", "reedbed", "broad", "willow"), scatter="pond", obstacle="fenlamp", relief="fen",
            water="#2f97b0", water_lt="#7fd2dc", lantern="#ffcf6b", fg="willows"),
    9: dict(name="Saltwind Coast", g=dict(grass="#93b97c", grass_dk="#78a066", grass_lt="#b3d199", path="#e6d5a8", path_dk="#bfa877",
                                          strip="#e4d3a4", strip_dk="#c4b07f", foliage="#5f9468", foliage_dk="#3f7150", moss="#7ea56a",
                                          rock="#aab2b8", rock_dk="#737f8a", edge="#c9b98c", trunk="#8a6a4c",
                                          sea="#2f6f8c", sea_dk="#25586f", sea_lt="#4f8fa8"),
            border="posts", trees=("windpine", "gorse", "crag", "windpine", "gorse"), scatter="driftwood", obstacle="seastack",
            relief="coast", grade="storm", lantern="#ffe08a",
            dress=dict(wear=True, clumps="thrift", n_clumps=30, tufts=90, gravel=18, banners=("#e8eef2", "#2f6f8f")), fg="coast"),
    10: dict(name="Crownfall Citadel", g=dict(grass="#8fa466", grass_dk="#748a50", grass_lt="#adbf80", path="#bfa486", path_dk="#8f765f",
                                              strip="#8aa062", strip_dk="#6f854c", court="#d8b98f", court_dk="#9a806a", foliage="#6f8048", foliage_dk="#4f5e36",
                                              rock="#ab9b8a", rock_dk="#776a60", trunk="#5e4a40", lantern="#ffb04d"),
             court=True, border="ruin", trees=("ruinpillar", "dead", "ruinwall", "broad", "ruinpillar", "broad", "ruinwall", "dead", "broad", "brazier", "broad", "ruinwall"),
             scatter="rubble", obstacle="brokencolumn",
             relief="flagstones", stones=("#dcbc94", "#e8cda4", "#c9a884", "#d4b48e", "#bba083"), trim="#e0b050", inlay="#e0b050",
             grade="dusk", vista="citadel",
             dress=dict(clumps="rubble", n_clumps=28, cracks=40, banners=("#5a3a6e", "#e0b050")), fg="ruins"),
}
COAST_FAR, COAST_RIGHT = -5.0, W + 1.55  # Saltwind Coast: the cliff edges (far side and right side)
COAST_HEAD = (-7.5, 1.4, -10.0)  # the lighthouse headland: x0, x1, far y
FG_ROWS = 14  # foreground cells per side: each fades on its own when a unit stands under it


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--samples", type=int, default=16)
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--no-ground", action="store_true", help="skip the backdrop (props only)")
    ap.add_argument("--no-props", action="store_true", help="skip the obstacle props (backdrop only)")
    return ap.parse_args(argv)


def rnd(i, k):
    return abs(math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1.0


def main():
    import bpy  # noqa: F401
    import numpy as np
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector

    from muster_art import kit as K
    from muster_art import style as S

    a = parse()
    only = {int(x) for x in a.only.split(",") if x.strip()} or set(ACTS)
    ss = 1 if a.quick else 2
    base = S.load()
    stage = K.Stage(samples=4 if a.quick else a.samples)
    S.apply(base)
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(BUILD, exist_ok=True)
    wk = K.Kit(outline=base["outline"]["props"])
    coll = bpy.data.collections.new("Arena")
    bpy.context.scene.collection.children.link(coll)
    wk.coll = coll
    el_prop = math.pi / 2 - TILT

    def B(x, y, z=0.0):
        return (x, -y, z)

    man_path = os.path.join(OUT, "manifest.json")
    man = json.load(open(man_path)) if os.path.exists(man_path) else {}
    if man.get("version") != 3:
        man = {"acts": {}}
    man.update(version=3, style=base["id"], camera={"tilt": TILT, "dist": DIST}, view=VIEW)

    def render(path):
        stage.sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        return S.read_png(path)

    def to_jpeg(png, jpg, q=84):
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(q), png, "--out", jpg], capture_output=True)

    for act in sorted(only):
        t0 = time.time()
        th = ACTS[act]
        st = copy.deepcopy(base)
        st["id"] = f"{base['id']}_a{act}"
        g = st["ground"]
        g.update(th["g"])
        g.setdefault("court", g["strip"])
        g.setdefault("court_dk", g["strip_dk"])
        g.setdefault("lantern", "#ffd27a")
        wk.clear()

        def toon(key, spec=0.0):
            return K.toon(g.get(key) or key, spec=spec)

        sh_in = K.flat(st["shadow"]["color"], alpha=st["shadow"]["alpha"])
        sh_out = K.flat(st["shadow"]["color"], alpha=st["shadow"]["alpha"] * 0.45)

        def shadow(x, y, r):
            wk.cyl(r * 1.08, 0.004, sh_out, loc=B(x, y, 0.012), seg=28, outline=0)
            wk.cyl(r * 0.82, 0.004, sh_in, loc=B(x, y, 0.016), seg=28, outline=0)

        def ribbon(pts, width, mat, z):
            import bmesh
            bm = bmesh.new()
            P2 = [Vector(B(px, py, z)) for px, py in pts]
            L, R = [], []
            for i, p in enumerate(P2):
                d = (P2[min(i + 1, len(P2) - 1)] - P2[max(i - 1, 0)]).normalized()
                n = Vector((-d.y, d.x, 0)) * (width / 2)
                L.append(bm.verts.new(p + n))
                R.append(bm.verts.new(p - n))
            for i in range(len(P2) - 1):
                bm.faces.new((L[i], R[i], R[i + 1], L[i + 1]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
            for f in bm.faces:
                if f.normal.z < 0:
                    f.normal_flip()
            return wk._emit(bm, mat, smooth=False, outline=0, name="ribbon")

        # ---------------- scenery pieces
        def tree(kind, x, y, s, i):
            if kind == "cloud":
                for j in range(4):
                    aa = j * 1.9 + i
                    wk.ball(0.36 * s, K.toon("#ffffff"), loc=B(x + math.cos(aa) * 0.3 * s, y + math.sin(aa) * 0.2 * s, (0.05 + 0.1 * (j % 2)) * s),
                            scale=(1.2, 1.0, 0.7), subdiv=2)
                return
            shadow(x, y, 0.42 * s)
            if kind in ("pine", "snowpine"):
                wk.cyl(0.08 * s, 0.4 * s, toon("trunk"), loc=B(x, y, 0.2 * s))
                for j, (rr, zz) in enumerate(((0.5, 0.38), (0.39, 0.78), (0.27, 1.12))):
                    wk.cone(rr * s, 0.6 * s, toon("foliage" if j % 2 == 0 else "foliage_dk"), loc=B(x, y, zz * s), seg=9)
                    if kind == "snowpine":
                        wk.cone(rr * 0.62 * s, 0.32 * s, K.toon("#ffffff"), loc=B(x, y, zz * s + 0.16 * s), seg=9)
            elif kind == "dead":
                wk.cyl(0.08 * s, 0.9 * s, K.toon("#5a4636"), loc=B(x, y, 0.45 * s), r2=0.05 * s)
                for j in range(3):
                    aa = j * 2.2 + i
                    wk.rod(B(x, y, (0.55 + 0.12 * j) * s), B(x + math.cos(aa) * 0.4 * s, y + math.sin(aa) * 0.3 * s, (0.95 + 0.1 * j) * s), 0.035 * s,
                           K.toon("#5a4636"), r2=0.015 * s)
            elif kind == "crag":
                wk.ball(0.55 * s, toon("rock"), loc=B(x, y, 0.3 * s), scale=(1.0, 0.9, 0.95), subdiv=1, smooth=False, rot=(0, 0, 30 * i))
                wk.ball(0.32 * s, toon("rock_dk"), loc=B(x + 0.4 * s, y + 0.2 * s, 0.15 * s), subdiv=1, smooth=False)
            elif kind == "willow":
                wk.cyl(0.1 * s, 0.6 * s, toon("trunk"), loc=B(x, y, 0.3 * s), r2=0.07 * s)
                wk.ball(0.42 * s, toon("willow"), loc=B(x, y, 1.0 * s), scale=(1.0, 0.95, 0.55), subdiv=2)
                wk.ball(0.26 * s, toon("grass_lt"), loc=B(x - 0.08 * s, y - 0.08 * s, 1.14 * s), scale=(1.0, 0.9, 0.5), subdiv=2)
                for j in range(11):  # the hanging curtain, wider than the crown
                    aa = j * math.tau / 11 + i
                    wk.cone(0.12 * s, 0.8 * s, toon("willow_dk" if j % 2 else "willow"), loc=B(x + math.cos(aa) * 0.5 * s, y + math.sin(aa) * 0.44 * s, 0.6 * s),
                            rot=(180 + 14 * math.sin(aa), -14 * math.cos(aa), 0), seg=6)
            elif kind == "reedbed":
                for j in range(5):
                    aa = j * 1.3 + i
                    rx, ry = x + math.cos(aa) * 0.18 * s, y + math.sin(aa) * 0.14 * s
                    wk.cone(0.05 * s, (0.55 + 0.1 * (j % 3)) * s, toon("foliage" if j % 2 else "foliage_dk"), loc=B(rx, ry, 0.28 * s), rot=(8 * math.cos(aa), 8 * math.sin(aa), 0), seg=5)
                    if j % 2 == 0:
                        wk.cyl(0.035 * s, 0.14 * s, K.toon("#7a4f2f"), loc=B(rx, ry, (0.62 + 0.1 * (j % 3)) * s), seg=6, outline=0.006)
            elif kind == "topiary":
                wk.box((0.6 * s, 0.6 * s, 0.35 * s), toon("court_dk"), loc=B(x, y, 0.17 * s), bevel=0.04)
                wk.cyl(0.05 * s, 0.4 * s, toon("trunk"), loc=B(x, y, 0.5 * s))
                wk.ball(0.36 * s, toon("foliage"), loc=B(x, y, 0.9 * s), subdiv=2)
            elif kind == "windpine":  # a wind-bent clifftop pine, leaning inland
                wk.rod(B(x, y, 0.0), B(x - 0.25 * s, y, 0.75 * s), 0.08 * s, toon("trunk"), r2=0.05 * s, seg=8)
                for j, (rr, zz, dx) in enumerate(((0.5, 0.55, -0.32), (0.38, 0.86, -0.45), (0.26, 1.1, -0.55))):
                    wk.cone(rr * s, 0.48 * s, toon("foliage" if j % 2 == 0 else "foliage_dk"), loc=B(x + dx * s, y, zz * s), rot=(0, -16, 0), seg=9)
            elif kind == "gorse":
                wk.ball(0.34 * s, toon("foliage_dk"), loc=B(x, y, 0.22 * s), scale=(1.2, 1.05, 0.75), subdiv=2)
                for j in range(9):
                    aa = j * 0.7 + i
                    wk.sphere(0.05 * s, K.toon("#ffd84d"), loc=B(x + math.cos(aa) * 0.3 * s, y + math.sin(aa) * 0.24 * s, (0.3 + 0.1 * (j % 3)) * s), seg=8, rings=5, outline=0.005)
            elif kind == "ruinpillar":  # a broken column, sometimes with its fallen drum beside it
                wk.cyl(0.36 * s, 0.18 * s, toon("court_dk"), loc=B(x, y, 0.09 * s), seg=10, bevel=0.03)
                hh = (0.7 + 0.7 * rnd(i, 401)) * s
                wk.cyl(0.24 * s, hh, toon("court"), loc=B(x, y, 0.18 * s + hh / 2), seg=10)
                wk.cone(0.25 * s, 0.22 * s, toon("court_dk"), loc=B(x + 0.04 * s, y, 0.18 * s + hh + 0.02), rot=(0, 28, 0), seg=6)
                if i % 2:
                    wk.cyl(0.22 * s, 0.4 * s, toon("court"), loc=B(x + 0.55 * s, y + 0.1 * s, 0.22 * s), rot=(90, 0, 30 * i), seg=10)
            elif kind == "ruinwall":  # a stretch of broken curtain wall with a merlon or two
                ww = 1.1 * s
                h1, h2 = (0.6 + 0.5 * rnd(i, 411)) * s, (0.4 + 0.4 * rnd(i, 412)) * s
                wk.box((ww * 0.55, 0.32 * s, h1), toon("court_dk"), loc=B(x - ww * 0.22, y, h1 / 2), bevel=0.03)
                wk.box((ww * 0.45, 0.32 * s, h2), toon("court"), loc=B(x + ww * 0.28, y, h2 / 2), bevel=0.03)
                wk.box((0.2 * s, 0.34 * s, 0.18 * s), toon("court"), loc=B(x - ww * 0.36, y, h1 + 0.09 * s), bevel=0.02)
                wk.ball(0.18 * s, toon("rock"), loc=B(x + ww * 0.55, y + 0.2 * s, 0.08 * s), scale=(1.2, 1, 0.7), subdiv=1, smooth=False)
            elif kind == "brazier":  # a lit brazier on a tripod: the dusk light of the citadel
                for j in range(3):
                    aa = j * math.tau / 3
                    wk.rod(B(x + math.cos(aa) * 0.22 * s, y + math.sin(aa) * 0.2 * s, 0.0), B(x, y, 0.62 * s), 0.03 * s, K.toon("#3a2a28"), seg=5)
                wk.cyl(0.22 * s, 0.14 * s, K.toon("#4a3a34"), loc=B(x, y, 0.66 * s), r2=0.14 * s, seg=10)
                wk.ball(0.17 * s, K.glow("#ff9a3c", 2.6), loc=B(x, y, 0.8 * s), scale=(1, 1, 1.3), subdiv=2, outline=0.006)
                wk.ball(0.09 * s, K.glow("#ffd27a", 3.0), loc=B(x, y, 0.92 * s), subdiv=2, outline=0)
            else:  # broadleaf
                wk.cyl(0.08 * s, 0.5 * s, toon("trunk"), loc=B(x, y, 0.25 * s), r2=0.06 * s)
                for j in range(4):
                    aa = j * 2.1 + i
                    wk.ball(0.3 * s, toon("foliage" if j else "foliage_dk"), loc=B(x + math.cos(aa) * 0.17 * s, y + math.sin(aa) * 0.12 * s, (0.72 + 0.12 * (j % 2)) * s), subdiv=2)
                wk.ball(0.26 * s, toon("foliage"), loc=B(x, y - 0.05, 0.98 * s), subdiv=2)

        def border_piece(x, y, along_x, i):
            kind = th["border"]
            if kind == "wall":
                wk.box((0.62, 0.42, 0.42) if along_x else (0.42, 0.62, 0.42), toon("court_dk"), loc=B(x, y, 0.21), bevel=0.04)
                wk.box((0.66, 0.46, 0.08) if along_x else (0.46, 0.66, 0.08), toon("court"), loc=B(x, y, 0.45), bevel=0.02)
            elif kind == "rail":
                wk.cyl(0.07, 0.42, toon("court"), loc=B(x, y, 0.21), seg=10)
                wk.sphere(0.07, K.toon("#ffcf4d", spec=0.4), loc=B(x, y, 0.48))
                if along_x:
                    wk.box((0.6, 0.1, 0.07), toon("court_dk"), loc=B(x + 0.3, y, 0.36), bevel=0.015)
                else:
                    wk.box((0.1, 0.6, 0.07), toon("court_dk"), loc=B(x, y + 0.3, 0.36), bevel=0.015)
            elif kind == "rocks":
                wk.ball(0.27, toon("rock" if i % 3 else "rock_dk"), loc=B(x, y, 0.13), scale=(1.15, 1.05, 0.75), subdiv=1, smooth=False, rot=(0, 0, 37 * i))
            elif kind == "snow":
                wk.ball(0.3, K.toon("#ffffff"), loc=B(x, y, 0.12), scale=(1.15, 1.1, 0.7), subdiv=2)
            elif kind == "reeds":
                if i % 7 == 3:  # a lantern post now and then
                    wk.cyl(0.05, 0.62, toon("plank_dk"), loc=B(x, y, 0.31), seg=8)
                    wk.box((0.16, 0.16, 0.05), toon("plank_dk"), loc=B(x, y, 0.64))
                    wk.sphere(0.075, K.glow(th["lantern"], 2.2), loc=B(x, y, 0.72), seg=10, rings=6, outline=0.006)
                    wk.cone(0.11, 0.08, toon("plank_dk"), loc=B(x, y, 0.82), seg=8)
                    return
                wk.ball(0.24, toon("moss"), loc=B(x, y, 0.06), scale=(1.2, 1.1, 0.45), subdiv=2)
                for j in range(4):
                    aa = j * 1.7 + i
                    wk.cone(0.045, 0.34 + 0.08 * (j % 2), toon("foliage" if j % 2 else "foliage_dk"), loc=B(x + math.cos(aa) * 0.12, y + math.sin(aa) * 0.1, 0.22),
                            rot=(10 * math.cos(aa), 10 * math.sin(aa), 0), seg=5, outline=0.006)
                if i % 2:
                    wk.cyl(0.03, 0.1, K.toon("#7a4f2f"), loc=B(x, y, 0.42), seg=6, outline=0.005)
            elif kind == "posts":
                # Weathered driftwood posts strung with rope, a buoy hung now and then.
                wk.cyl(0.065, 0.5, K.toon("#9a8a74"), loc=B(x, y, 0.25), r2=0.055, seg=8, bevel=0.01)
                wk.cyl(0.07, 0.03, K.toon("#cfc3ad"), loc=B(x, y, 0.51), seg=8, outline=0.005)
                if along_x:
                    wk.rod(B(x, y, 0.42), B(x + 0.6, y, 0.42), 0.018, K.toon("#d9c49a"), seg=5, outline=0.004)
                else:
                    wk.rod(B(x, y, 0.42), B(x, y + 0.6, 0.42), 0.018, K.toon("#d9c49a"), seg=5, outline=0.004)
                if i % 6 == 2:
                    wk.sphere(0.09, K.toon("#e2563a" if i % 12 == 2 else "#f4e6c4"), loc=B(x, y + (0 if along_x else 0.3), 0.3), seg=10, rings=6, outline=0.006)
                if i % 3 == 0:
                    wk.ball(0.16, toon("rock" if i % 2 else "rock_dk"), loc=B(x + 0.2, y + 0.1, 0.05), scale=(1.2, 1.0, 0.6), subdiv=1, smooth=False, outline=0.005)
            elif kind == "ruin":
                # A low broken wall: blocks of uneven height, a merlon here and there, a fallen block in the gaps.
                if rnd(i, 421) < 0.14:
                    wk.box((0.36, 0.3, 0.22), toon("court_dk"), loc=B(x + 0.1, y - 0.05, 0.1), rot=(8, 12, 30 * rnd(i, 422)), bevel=0.03, outline=0.006)
                    return
                hh = 0.22 + 0.26 * rnd(i, 423)
                wk.box((0.62, 0.4, hh) if along_x else (0.4, 0.62, hh), toon("court_dk" if i % 3 else "rock_dk"), loc=B(x, y, hh / 2), bevel=0.035, outline=0.006)
                wk.box((0.64, 0.42, 0.06) if along_x else (0.42, 0.64, 0.06), toon("court"), loc=B(x, y, hh + 0.02), rot=(0, 0, (rnd(i, 424) - 0.5) * 8), bevel=0.02, outline=0.005)
                if i % 5 == 1:
                    wk.box((0.22, 0.3, 0.2), toon("court"), loc=B(x, y, hh + 0.14), bevel=0.02, outline=0.005)
            else:
                if th.get("footing"):
                    # A dry-stone footing under a clipped hedge: the border reads as built, with height and a lit top.
                    wk.box((0.64, 0.52, 0.16) if along_x else (0.52, 0.64, 0.16), toon("rock" if i % 4 else "rock_dk"), loc=B(x, y, 0.08),
                           rot=(0, 0, (rnd(i, 5) - 0.5) * 6), bevel=0.04, outline=0.006)
                    wk.ball(0.31, toon("foliage_dk" if i % 3 == 0 else "foliage"), loc=B(x, y, 0.36), scale=(1.1, 1.05, 0.8), subdiv=2)
                    wk.ball(0.16, toon("grass_lt"), loc=B(x - 0.06, y - 0.08, 0.5), scale=(1.0, 0.9, 0.5), subdiv=2, outline=0.004)
                    return
                wk.ball(0.3, toon("foliage_dk" if i % 3 == 0 else "foliage"), loc=B(x, y, 0.22), scale=(1.1, 1.1, 0.85), subdiv=2)

        def scatter(x, y, i):
            kind = th["scatter"]
            if kind == "flowers":
                col = ("#fff4d6", "#ffd84d", "#ff8fa3", "#b9a2ff")[i % 4]
                for j in range(3):
                    wk.sphere(0.05, K.toon(col), loc=B(x + 0.1 * math.cos(j * 2.1), y + 0.08 * math.sin(j * 2.1), 0.05), seg=8, rings=5, outline=0.006)
            elif kind == "mushrooms":
                wk.cyl(0.035, 0.12, K.toon("#f3ead0"), loc=B(x, y, 0.06), outline=0.008)
                wk.sphere(0.09, K.toon("#e2483a"), loc=B(x, y, 0.13), scale=(1, 1, 0.6), seg=12, rings=6, outline=0.008)
            elif kind == "embers":
                wk.cyl(0.12, 0.08, K.toon("#4a3a30"), loc=B(x, y, 0.04), seg=8, outline=0.008)
                wk.sphere(0.05, K.glow("#ff9a3c", 2.0), loc=B(x, y, 0.09), seg=8, rings=5, outline=0)
            elif kind == "pebbles":
                wk.ball(0.09, toon("rock"), loc=B(x, y, 0.04), scale=(1.2, 1, 0.6), subdiv=1, smooth=False, outline=0.008)
            elif kind == "pond":
                with wk.at(B(x, y, 0.004), rot=(0, 0, 37 * i), scale=(1.4, 1.0, 1)):
                    wk.cyl(0.42, 0.012, toon("path_dk"), seg=20, outline=0)
                    wk.cyl(0.36, 0.016, K.toon(th["water"]), seg=20, outline=0.004)
                for j in range(2):
                    wk.cyl(0.08, 0.01, toon("foliage"), loc=B(x + 0.2 * (j - 0.5), y + 0.06 * j, 0.022), seg=10, outline=0.004)
                if i % 3 == 0:
                    wk.sphere(0.04, K.toon("#ff9fc0"), loc=B(x - 0.1, y, 0.04), seg=8, rings=5, outline=0.004)
            elif kind == "ice":
                wk.crystal(0.08, 0.3, K.toon("#bfe9ff", spec=0.5), loc=B(x, y, 0.0), rot=(8, -6, 20 * i))
            elif kind == "driftwood":
                wk.cyl(0.05, 0.6, K.toon("#b8a78c"), loc=B(x, y, 0.04), rot=(90, 0, 40 * i), seg=7, outline=0.006)
                wk.ball(0.1, toon("rock"), loc=B(x + 0.2, y + 0.1, 0.04), scale=(1.2, 1, 0.6), subdiv=1, smooth=False, outline=0.006)
            elif kind == "rubble":
                for j in range(3):
                    aa = j * 2.1 + i
                    wk.box((0.18, 0.14, 0.1), toon("court" if j % 2 else "court_dk"), loc=B(x + math.cos(aa) * 0.14, y + math.sin(aa) * 0.1, 0.05), rot=(6 * j, 9, 37 * i + 20 * j), bevel=0.02, outline=0.006)

        FLAG_H = 0.05

        def flagstones(x0, y0, x1, y1, size, tones, seed, gap=0.05):
            """Running-bond slabs over [x0, x1] x [y0, y1]: bevelled, a hair of height and tilt jitter, a tone each."""
            rows = max(1, int(round((y1 - y0) / size)))
            dy = (y1 - y0) / rows
            ncol = max(1, int(round((x1 - x0) / size)))
            dx = (x1 - x0) / ncol
            mats = [toon(c, spec=0.15) for c in tones]
            for r in range(rows):
                off = (0.5 if r % 2 else 0.0) * dx
                cuts = sorted({x0, x1} | {x0 + off + c * dx for c in range(-1, ncol + 2) if x0 + 0.2 < x0 + off + c * dx < x1 - 0.2})
                c = 0
                while c < len(cuts) - 1:
                    xa, xb = cuts[c], cuts[c + 1]
                    # Now and then two slabs are one long one.
                    if c < len(cuts) - 2 and rnd(seed * 31 + r, c * 7) < 0.18:
                        xb = cuts[c + 2]
                        c += 1
                    c += 1
                    ya, yb = y0 + r * dy, y0 + (r + 1) * dy
                    h = rnd(seed + r * 13, c * 17)
                    tone = mats[int(rnd(seed * 7 + c, r * 3 + 5) * len(mats)) % len(mats)]
                    wk.box((xb - xa - gap, yb - ya - gap, FLAG_H), tone,
                           loc=B((xa + xb) / 2, (ya + yb) / 2, FLAG_H / 2 - 0.006 + (h - 0.5) * 0.014),
                           rot=((rnd(r, c + seed) - 0.5) * 1.6, (rnd(c, r + seed) - 0.5) * 1.6, 0), bevel=0.028, outline=0.007)

        def keep_clear(x, y, path_w=0.95, keep_r=1.75, zone_only=True, path_x=None):
            """Not on the path, the keep plazas or (zone_only) the neutral strip."""
            if path_x and abs(x - path_x(y)) < path_w:
                return False
            if any(math.hypot(x - kx, y - ky) < keep_r for kx, ky in KEEPS):
                return False
            return not (zone_only and ZD - 0.35 < y < H - ZD + 0.35)

        def clump(x, y, i, kind):
            """A small ground clump in a deploy zone: low, so units stand over it."""
            if kind == "flowers":
                wk.ball(0.22, toon("grass_dk"), loc=B(x, y, 0.0), scale=(1.4, 1.1, 0.34), subdiv=2, outline=0.005)
                cols = (("#fff4d6", "#ffd84d"), ("#ff8fa3", "#fff4d6"), ("#b9a2ff", "#ffd84d"), ("#ffd84d", "#ff8fa3"))[i % 4]
                for j in range(8):
                    aa = j * 0.8 + i
                    rr = 0.06 + 0.07 * (j % 3)
                    wk.sphere(0.055, K.toon(cols[j % 2]), loc=B(x + math.cos(aa) * rr * 1.4, y + math.sin(aa) * rr, 0.08), seg=8, rings=5, outline=0.006)
            elif kind == "dry":
                for j in range(5):
                    aa = j * 1.3 + i
                    wk.cone(0.035, 0.15 + 0.04 * (j % 2), toon("grass_lt" if j % 2 else "moss"), loc=B(x + math.cos(aa) * 0.09, y + math.sin(aa) * 0.06, 0.06),
                            rot=(14 * math.cos(aa), 14 * math.sin(aa), 0), seg=5, outline=0.004)
                if i % 3 == 0:
                    wk.cyl(0.1, 0.03, K.toon("#4a3a30"), loc=B(x + 0.18, y + 0.05, 0.015), seg=8, outline=0.005)
                    wk.sphere(0.035, K.glow("#ff9a3c", 2.0), loc=B(x + 0.18, y + 0.05, 0.04), seg=8, rings=5, outline=0)
            elif kind == "ferns":
                for j in range(5):
                    aa = j * math.tau / 5 + i
                    wk.box((0.28, 0.07, 0.01), toon("foliage" if j % 2 else "foliage_dk"), loc=B(x + math.cos(aa) * 0.12, y + math.sin(aa) * 0.1, 0.04),
                           rot=(0, -18, math.degrees(aa)), bevel=0.02, outline=0.004)
                if i % 3 == 0:
                    wk.cyl(0.03, 0.1, K.toon("#f3ead0"), loc=B(x + 0.16, y + 0.1, 0.05), outline=0.006)
                    wk.sphere(0.07, K.toon("#e2483a"), loc=B(x + 0.16, y + 0.1, 0.11), scale=(1, 1, 0.6), seg=12, rings=6, outline=0.006)
            elif kind == "frost":
                wk.ball(0.2, K.toon("#ffffff"), loc=B(x, y, 0.0), scale=(1.4, 1.1, 0.4), subdiv=2, outline=0.004)
                for j in range(2 + i % 2):
                    aa = j * 2.3 + i
                    wk.crystal(0.05, 0.2 + 0.06 * j, K.toon("#bfe9ff", spec=0.6), loc=B(x + math.cos(aa) * 0.1, y + math.sin(aa) * 0.07, 0.02), rot=(14 * math.cos(aa), 14 * math.sin(aa), 0))
                if i % 4 == 0:  # a frozen grass stalk
                    wk.cone(0.03, 0.16, toon("foliage"), loc=B(x - 0.12, y + 0.05, 0.08), seg=5, outline=0.004)
            elif kind == "thrift":  # sea thrift: tight cushions with pink pompoms on wiry stems
                wk.ball(0.15, toon("foliage"), loc=B(x, y, 0.0), scale=(1.4, 1.1, 0.42), subdiv=2, outline=0.004)
                for j in range(6):
                    aa = j * 1.05 + i
                    wk.sphere(0.045, K.toon("#f59ac0" if j % 2 else "#ffc4dc"), loc=B(x + math.cos(aa) * 0.12, y + math.sin(aa) * 0.08, 0.1 + 0.03 * (j % 2)), seg=8, rings=5, outline=0.004)
                if i % 4 == 0:
                    wk.box((0.06, 0.06, 0.04), K.toon("#f4f0e6"), loc=B(x + 0.2, y - 0.04, 0.02), rot=(0, 0, 25 * i), outline=0.003)  # a shell
            elif kind == "rubble":
                for j in range(3 + i % 2):
                    aa = j * 1.9 + i
                    wk.box((0.15 + 0.05 * (j % 2), 0.12, 0.07), toon("court" if j % 2 else "court_dk"), loc=B(x + math.cos(aa) * 0.13, y + math.sin(aa) * 0.09, 0.09),
                           rot=(5 * j, 7, 41 * i + 23 * j), bevel=0.015, outline=0.004)
                for j in range(2):
                    wk.cone(0.03, 0.12, toon("grass_lt" if j else "grass_dk"), loc=B(x - 0.12 + 0.05 * j, y + 0.06, 0.12), rot=(12 * (j - 0.5), 0, 0), seg=5, outline=0.003)
            elif kind == "heather":
                wk.ball(0.15, toon("foliage_dk"), loc=B(x, y, 0.02), scale=(1.3, 1.1, 0.45), subdiv=2, outline=0.004)
                for j in range(5):
                    aa = j * 1.25 + i
                    wk.sphere(0.04, K.toon("#b58ad8" if j % 2 else "#d6b4f0"), loc=B(x + math.cos(aa) * 0.1, y + math.sin(aa) * 0.07, 0.08), seg=8, rings=5, outline=0.004)

        def tuft(x, y, j0=0, z0=0.0):
            for j in range(3):
                wk.cone(0.033, 0.11 + 0.02 * ((j + j0) % 2), toon("grass_dk" if j % 2 else "grass_lt"), loc=B(x + 0.05 * (j - 1), y + 0.02 * j, 0.05 + z0),
                        rot=(12 * (j - 1), 0, 0), seg=5, outline=0.004)

        def crack(x, y, n, col, z):
            """A zig-zag hairline crack in ground or stone."""
            a0 = rnd(n, 131) * 180
            px, py = x, y
            for k in range(3):
                ln = 0.16 + 0.12 * rnd(n, 132 + k)
                aa = math.radians(a0 + (rnd(n, 140 + k) - 0.5) * 80)
                nx, ny = px + math.cos(aa) * ln, py + math.sin(aa) * ln
                wk.box((ln, 0.022, 0.006), K.flat(col, alpha=0.75), loc=B((px + nx) / 2, (py + ny) / 2, z), rot=(0, 0, -math.degrees(aa)), outline=0)
                px, py = nx, ny

        def banner(x, y, cols, tall=1.55):
            """A pole with a hanging pennant (neutral colours, not a team's), facing the camera."""
            shadow(x, y, 0.16)
            wk.cyl(0.11, 0.1, toon("rock_dk"), loc=B(x, y, 0.05), seg=10, bevel=0.02, outline=0.006)
            wk.cyl(0.04, tall, K.toon("#8a5a35"), loc=B(x, y, tall / 2), seg=8)
            wk.sphere(0.065, K.toon("#ffcf4d", spec=0.4), loc=B(x, y, tall + 0.04), seg=10, rings=6, outline=0.006)
            wk.rod(B(x - 0.02, y, tall - 0.06), B(x + 0.42, y, tall - 0.06), 0.022, K.toon("#8a5a35"), seg=6)
            top, bot = tall - 0.08, tall - 0.72
            wk.sheet([B(x + 0.04, y, top), B(x + 0.4, y, top), B(x + 0.4, y, bot), B(x + 0.22, y, bot + 0.14), B(x + 0.04, y, bot)], K.toon(cols[0]), thick=0.025)
            wk.sheet([B(x + 0.04, y - 0.016, top - 0.12), B(x + 0.4, y - 0.016, top - 0.12), B(x + 0.4, y - 0.016, top - 0.22), B(x + 0.04, y - 0.016, top - 0.22)],
                     K.toon(cols[1]), thick=0.012, outline=0)

        def dress(court, relief, path_x):
            """Ground detail and small props inside the border: mown stripes, path wear, clumps, tufts, cracks, cobbles."""
            ds = th.get("dress") or {}
            if not ds:
                return
            zf = 0.062 if relief == "flagstones" else 0.0
            if ds.get("stripes"):
                for zy0, zy1 in ((0.0, ZD), (H - ZD, H)):
                    y, n = zy0, 0
                    while y < zy1 - 0.01:
                        hh = min(0.9, zy1 - y)
                        if n % 2 == 0:
                            wk.box((W, hh, 0.004), K.flat(g["grass_lt"], alpha=0.2), loc=B(W / 2, y + hh / 2, 0.006), outline=0)
                        y += 0.9
                        n += 1
            if ds.get("cobbles"):
                # An old road across the neutral strip: low raised cobbles, the path crossing it.
                flagstones(0.0, ZD + 0.08, W, H - ZD - 0.08, ds.get("cobble_size", 0.46), ds["cobbles"], 7, gap=ds.get("cobble_gap", 0.045))
            if ds.get("rails"):
                # An old ore-cart track across the pass: sleepers and two iron rails.
                y = H / 2
                wood, iron = K.toon("#7a5232"), K.toon("#8a94a2", spec=0.5)
                xx = 0.15
                while xx < W:
                    wk.box((0.13, 0.95, 0.035), wood, loc=B(xx, y, 0.03), rot=(0, 0, (rnd(int(xx * 10), 231) - 0.5) * 6), bevel=0.01, outline=0.004)
                    xx += 0.36
                for dy in (-0.3, 0.3):
                    wk.box((W + 0.4, 0.06, 0.05), iron, loc=B(W / 2, y + dy, 0.07), bevel=0.01, outline=0.004)
            if ds.get("rings"):
                # A fairy ring of toadstools in each deploy zone.
                for (cx, cy) in ((1.7, 3.6), (7.2, H - 3.4)):
                    for j in range(9):
                        aa = j * math.tau / 9
                        x, y = cx + math.cos(aa) * 0.55, cy + math.sin(aa) * 0.42
                        wk.cyl(0.03, 0.1, K.toon("#f3ead0"), loc=B(x, y, 0.05), outline=0.006)
                        wk.sphere(0.07 + 0.02 * (j % 2), K.toon("#e2483a" if j % 3 else "#f2a03a"), loc=B(x, y, 0.11), scale=(1, 1, 0.6), seg=12, rings=6, outline=0.006)
                    with wk.at(B(cx, cy, 0.006), scale=(1.3, 1.0, 1)):
                        wk.cyl(0.5, 0.004, K.flat(g["grass_lt"], alpha=0.45), seg=24, outline=0)
            if ds.get("wear"):
                for n in range(int((H + 1.0) / 0.22)):
                    y = -0.4 + n * 0.22
                    if ds.get("cobbles") and ZD < y < H - ZD:
                        continue
                    for side in (-1, 1):
                        r = rnd(n, 150 + side)
                        x = path_x(y) + side * (0.6 + 0.06 * r)
                        with wk.at(B(x, y, 0.028), rot=(0, 0, r * 90), scale=(1.5, 0.8, 1)):
                            wk.cyl(0.09 + 0.08 * r, 0.004, K.flat(g["path_dk"], alpha=0.55), seg=12, outline=0)
                        if r > 0.62:
                            wk.ball(0.045 + 0.03 * rnd(n, 160), toon("rock" if r > 0.8 else "rock_dk"), loc=B(x + side * 0.12, y + 0.05, 0.03),
                                    scale=(1.2, 1.0, 0.6), subdiv=1, smooth=False, outline=0.004)
                        elif r < 0.2:  # sand spilling onto the grass
                            with wk.at(B(x + side * 0.14, y, 0.029), rot=(0, 0, r * 400), scale=(1.6, 0.7, 1)):
                                wk.cyl(0.11, 0.004, K.flat(g["path"], alpha=0.8), seg=12, outline=0)
            placed = 0
            for n in range(400):
                if placed >= ds.get("n_clumps", 0):
                    break
                x, y = 0.35 + rnd(n, 171) * (W - 0.7), 0.3 + rnd(n, 172) * (H - 0.6)
                if not keep_clear(x, y, 1.0, 1.85, True, path_x):
                    continue
                clump(x, y, n, ds["clumps"])
                placed += 1
            for n in range(ds.get("tufts", 0)):
                x, y = 0.2 + rnd(n, 181) * (W - 0.4), 0.2 + rnd(n, 182) * (H - 0.4)
                if keep_clear(x, y, 0.9, 1.7, not ds.get("cobbles") and court is None, path_x):
                    tuft(x, y, n, zf)
            for n in range(ds.get("moss", 0)):  # moss patches
                x, y = 0.4 + rnd(n, 191) * (W - 0.8), 0.4 + rnd(n, 192) * (H - 0.8)
                if keep_clear(x, y, 1.1, 1.8, True, path_x):
                    with wk.at(B(x, y, 0.007), rot=(0, 0, rnd(n, 193) * 180), scale=(1.5, 1.0, 1)):
                        wk.cyl(0.24 + 0.12 * rnd(n, 194), 0.004, K.flat(g["moss"] if g["moss"] != g["grass"] else "#4f8f3d", alpha=0.6), seg=16, outline=0)
            for n in range(ds.get("gravel", 0)):  # gravel scatters
                x, y = 0.4 + rnd(n, 201) * (W - 0.8), 0.4 + rnd(n, 202) * (H - 0.8)
                if keep_clear(x, y, 1.0, 1.8, True, path_x):
                    with wk.at(B(x, y, 0.006), rot=(0, 0, rnd(n, 203) * 180), scale=(1.6, 1.0, 1)):
                        wk.cyl(0.26, 0.004, K.flat(g["path_dk"], alpha=0.45), seg=16, outline=0)
                    for j in range(4):
                        wk.ball(0.04, toon("rock" if j % 2 else "rock_dk"), loc=B(x + 0.12 * math.cos(j * 1.7 + n), y + 0.08 * math.sin(j * 1.7 + n), 0.02),
                                scale=(1.2, 1, 0.6), subdiv=1, smooth=False, outline=0.003)
            for n in range(ds.get("cracks", 0)):
                x, y = 0.3 + rnd(n, 211) * (W - 0.6), 0.3 + rnd(n, 212) * (H - 0.6)
                if keep_clear(x, y, 0.9, 1.6, False, path_x):
                    crack(x, y, n, g["court_dk"] if relief == "flagstones" else g["path_dk"], zf + 0.006)
            if ds.get("roots"):
                for n in range(10):  # roots creeping in from the wood at the sides
                    side = n % 2
                    y = 0.6 + rnd(n, 221) * (H - 1.2)
                    if ZD - 0.4 < y < H - ZD + 0.4:
                        continue
                    x0 = -0.1 if side == 0 else W + 0.1
                    x1 = x0 + (0.9 if side == 0 else -0.9) * (0.5 + rnd(n, 222))
                    wk.rod(B(x0, y, 0.03), B(x1, y + (rnd(n, 223) - 0.5) * 0.6, 0.0), 0.045, K.toon("#7a5232"), r2=0.015, seg=6, outline=0.004)
            if th.get("rosettes"):
                lap = K.toon(th["lapis"], spec=0.3)
                gold = K.toon(th["inlay"], spec=0.5)
                for (rx, ry) in ((2.0, 3.3), (7.0, 3.3), (2.0, H - 3.3), (7.0, H - 3.3)):
                    wk.cyl(0.62, 0.012, lap, loc=B(rx, ry, 0.062), seg=32, outline=0.004)
                    wk.torus(0.64, 0.03, gold, loc=B(rx, ry, 0.07), scale=(1, 1, 0.4), outline=0.003)
                    wk.cyl(0.24, 0.014, gold, loc=B(rx, ry, 0.066), seg=24, outline=0.004)
                    for j in range(8):
                        aa = j * math.tau / 8
                        wk.box((0.3, 0.06, 0.012), gold, loc=B(rx + math.cos(aa) * 0.42, ry + math.sin(aa) * 0.42, 0.068), rot=(0, 0, -math.degrees(aa)), outline=0.003)
                for zy0, zy1 in ((0.15, ZD - 0.2), (H - ZD + 0.2, H - 0.15)):  # lapis bands with gold edging down each side
                    for xx in (0.32, W - 0.32):
                        wk.box((0.16, zy1 - zy0, 0.012), lap, loc=B(xx, (zy0 + zy1) / 2, 0.062), outline=0.004)
                        for dx in (-0.12, 0.12):
                            wk.box((0.035, zy1 - zy0, 0.012), gold, loc=B(xx + dx, (zy0 + zy1) / 2, 0.064), outline=0)
            if th.get("lozenges"):
                # High Keep: heraldic lozenges of red stone in gold frames, set into the courtyard of each zone.
                red, gold = K.toon(th["lozenges"], spec=0.25), K.toon(th["trim"], spec=0.5)
                for (rx, ry) in ((2.0, 3.3), (7.0, 3.3), (2.0, H - 3.3), (7.0, H - 3.3)):
                    wk.box((0.92, 0.92, 0.012), gold, loc=B(rx, ry, 0.062), rot=(0, 0, 45), outline=0.004)
                    wk.box((0.76, 0.76, 0.014), red, loc=B(rx, ry, 0.066), rot=(0, 0, 45), outline=0.004)
                    wk.box((0.3, 0.3, 0.016), gold, loc=B(rx, ry, 0.07), rot=(0, 0, 45), outline=0.003)
            if ds.get("banners"):
                for (bx, by) in ((3.05, -0.85), (5.55, -0.85), (-1.05, ZD + 0.6), (W + 0.6, ZD + 0.6)):  # flanking the far gate and the strip
                    banner(bx, by, ds["banners"])

        def on_land(x, y, pad=0.0):
            """Saltwind Coast: the clifftop (the board, the land round it and the lighthouse headland), not the sea."""
            if y > COAST_FAR + pad and x < COAST_RIGHT - pad:
                return True
            return COAST_HEAD[0] + pad < x < COAST_HEAD[1] - pad and COAST_HEAD[2] + pad < y <= COAST_FAR + pad + 0.01

        def coast_build():
            """Saltwind Coast: grass clifftop over a storm sea. The sea lies a cliff's height below, beyond the far edge and
            down the right side, with surf at the cliff foot, whitecaps and a few sea stacks; the lighthouse headland juts out
            top-left."""
            grass = S.ground_mat(st, "grass", "grass_dk", "patches", key_c="grass_lt")
            x0, x1 = -16.0, COAST_RIGHT
            wk.box((x1 - x0, 46, 0.04), grass, loc=B((x0 + x1) / 2, COAST_FAR + 23, -0.02), outline=0)
            hx0, hx1, hy0 = COAST_HEAD
            wk.box((hx1 - hx0, COAST_FAR - hy0 + 0.02, 0.04), grass, loc=B((hx0 + hx1) / 2, (COAST_FAR + hy0) / 2, -0.02), outline=0)
            sea_z = -1.15
            wk.box((90, 90, 0.04), S.ground_mat(st, "sea", "sea_dk", "patches", scale=2.2, key_c="sea_lt"), loc=B(4.5, 3.0, sea_z), outline=0)
            # The cliff: a face of stacked rock under each edge (the headland's inland face is the one the camera sees).
            edges = []
            yy = COAST_FAR
            while yy < 26:
                edges.append((COAST_RIGHT, yy, 0))
                yy += 0.42
            xx = hx1
            while xx < COAST_RIGHT:
                edges.append((xx, COAST_FAR, 1))
                xx += 0.42
            yy = hy0
            while yy < COAST_FAR:
                edges.append((hx1, yy, 0))
                edges.append((hx0, yy, 0))
                yy += 0.42
            xx = hx0
            while xx < hx1:
                edges.append((xx, hy0, 1))
                xx += 0.42
            foam = K.flat("#f4fbff", alpha=0.85)
            for k, (ex, ey, horiz) in enumerate(edges):
                r = rnd(k, 501)
                wk.box((0.5, 0.5, 1.2), toon("rock_dk" if k % 3 else "rock"), loc=B(ex, ey, sea_z / 2), rot=(0, 0, 20 * r), bevel=0.06, outline=0.006)
                wk.ball(0.26 + 0.12 * r, toon("rock"), loc=B(ex + (0 if horiz else 0.05), ey + (0.05 if horiz else 0), -0.05), scale=(1.2, 1.0, 0.5), subdiv=1, smooth=False, outline=0.006)
                ox, oy = (0.0, -0.45) if horiz else (0.45 if ex >= COAST_RIGHT - 0.01 or ex == hx1 else -0.45, 0.0)
                if ex == hx1 and not horiz:
                    ox = 0.45
                with wk.at(B(ex + ox * (1 + r), ey + oy * (1 + r), sea_z + 0.03), rot=(0, 0, 90 * r), scale=(1.8, 0.7, 1)):
                    wk.cyl(0.22 + 0.12 * r, 0.006, foam, seg=12, outline=0)
            for n in range(140):  # whitecaps on the storm sea
                x, y = -12 + rnd(n, 511) * 32, -20 + rnd(n, 512) * 44
                if on_land(x, y, -0.6):
                    continue
                with wk.at(B(x, y, sea_z + 0.03), rot=(0, 0, 18 + 14 * rnd(n, 513))):
                    wk.box((0.5 + 0.6 * rnd(n, 514), 0.06, 0.006), K.flat("#e8f6fa", alpha=0.8), outline=0)
                    wk.box((0.3 + 0.3 * rnd(n, 515), 0.04, 0.006), K.flat(g["sea_lt"]), loc=(0.1, 0.09, 0), outline=0)
            for (sx, sy, sr) in ((13.2, -2.0, 0.6), (12.6, 4.6, 0.45), (6.8, -8.2, 0.7), (2.8, -11.0, 0.5), (14.0, 10.5, 0.55)):  # sea stacks
                wk.ball(sr, toon("rock"), loc=B(sx, sy, sea_z + sr * 0.9), scale=(1.0, 0.9, 1.6), subdiv=1, smooth=False, rot=(0, 0, 40 * sx))
                wk.ball(sr * 0.75, toon("grass"), loc=B(sx, sy, sea_z + sr * 2.25), scale=(1.0, 0.9, 0.35), subdiv=2)
                with wk.at(B(sx, sy, sea_z + 0.03), scale=(1.5, 1.1, 1)):
                    wk.cyl(sr * 1.4, 0.006, foam, seg=16, outline=0)

        def lighthouse(x, y):
            """The Saltwind light: a red-banded tower on the headland with its lamp lit, and the keeper's cottage."""
            shadow(x, y, 0.9)
            wk.cyl(0.78, 0.3, toon("rock"), loc=B(x, y, 0.15), seg=16, bevel=0.04)
            hh = 3.4
            wk.cyl(0.52, hh, K.toon("#f4f0e6"), loc=B(x, y, 0.3 + hh / 2), r2=0.36, seg=16)
            for k in range(3):
                z = 0.3 + hh * (0.18 + 0.3 * k)
                rr = 0.52 - (0.16 * (z - 0.3) / hh)
                wk.cyl(rr + 0.012, 0.36, K.toon("#d8463a"), loc=B(x, y, z), seg=16, outline=0.006)
            top = 0.3 + hh
            wk.cyl(0.5, 0.08, K.toon("#2e3a44"), loc=B(x, y, top + 0.04), seg=16, outline=0.006)
            for k in range(10):
                aa = k * math.tau / 10
                wk.cyl(0.015, 0.2, K.toon("#2e3a44"), loc=B(x + math.cos(aa) * 0.46, y + math.sin(aa) * 0.46, top + 0.18), seg=4, outline=0.003)
            wk.cyl(0.26, 0.42, K.glow(th["lantern"], 3.0), loc=B(x, y, top + 0.3), seg=12, outline=0.006)
            wk.cone(0.36, 0.34, K.toon("#d8463a"), loc=B(x, y, top + 0.68), seg=12)
            wk.sphere(0.06, K.toon("#2e3a44"), loc=B(x, y, top + 0.9), seg=8, rings=5)
            # The keeper's cottage.
            cx, cy = x - 1.4, y + 0.6
            shadow(cx, cy, 0.6)
            wk.box((1.0, 0.7, 0.55), K.toon("#f4f0e6"), loc=B(cx, cy, 0.27), bevel=0.03)
            wk.box((1.12, 0.82, 0.08), K.toon("#d8463a"), loc=B(cx, cy, 0.58), bevel=0.02)
            wk.cone(0.62, 0.4, K.toon("#d8463a"), loc=B(cx, cy, 0.82), rot=(0, 0, 45), seg=4)
            wk.box((0.16, 0.02, 0.26), K.toon("#2e3a44"), loc=B(cx, cy + 0.36, 0.17), outline=0.004)
            wk.box((0.16, 0.02, 0.14), K.glow(th["lantern"], 1.8), loc=B(cx + 0.28, cy + 0.36, 0.33), outline=0.004)

        def citadel_vista():
            """Crownfall Citadel: the ruined high keep beyond the far gate, broken towers and a cracked gate arch at dusk,
            braziers lit along the curtain wall."""
            yb = -6.4
            # The curtain wall, broken into stretches of uneven height.
            xx = -6.0
            k = 0
            while xx < W + 6.0:
                if abs(xx - 4.5) > 1.4 and rnd(k, 601) > 0.16:
                    hh = 1.1 + 1.2 * rnd(k, 602)
                    wk.box((1.05, 0.8, hh), toon("court_dk" if k % 2 else "rock_dk"), loc=B(xx, yb, hh / 2), bevel=0.04)
                    wk.box((1.08, 0.84, 0.08), toon("court"), loc=B(xx, yb, hh + 0.02), bevel=0.02)
                    if rnd(k, 603) > 0.4:
                        for m in (-0.3, 0.3):
                            wk.box((0.28, 0.82, 0.26), toon("court"), loc=B(xx + m, yb, hh + 0.18), bevel=0.02)
                else:
                    wk.ball(0.5, toon("court_dk"), loc=B(xx, yb + 0.4, 0.1), scale=(1.4, 1.0, 0.6), subdiv=1, smooth=False)
                xx += 1.05
                k += 1
            # The gate arch behind the far keep, its keystone fallen.
            for gx in (3.5, 5.5):
                wk.box((0.7, 0.9, 2.6), toon("court_dk"), loc=B(gx, yb, 1.3), bevel=0.04)
                wk.box((0.78, 0.98, 0.12), toon("court"), loc=B(gx, yb, 2.66), bevel=0.02)
            wk.box((1.0, 0.86, 0.5), toon("court"), loc=B(4.0, yb, 2.95), rot=(0, 8, 0), bevel=0.03)
            wk.box((0.5, 0.5, 0.4), toon("court"), loc=B(5.0, yb + 0.9, 0.2), rot=(10, 14, 30), bevel=0.03)
            wk.sheet([B(3.3, yb + 0.47, 2.5), B(3.7, yb + 0.47, 2.5), B(3.7, yb + 0.47, 1.4), B(3.55, yb + 0.47, 1.6), B(3.3, yb + 0.47, 1.3)], K.toon("#5a3a6e"), thick=0.02)
            # Two great towers, their crowns broken.
            for (tx, ty, th_) in ((-2.6, -8.6, 4.6), (11.8, -8.2, 3.8), (8.6, -11.5, 5.2)):
                wk.cyl(1.25, 0.35, toon("rock_dk"), loc=B(tx, ty, 0.17), seg=14, bevel=0.04)
                wk.cyl(1.0, th_, toon("court_dk"), loc=B(tx, ty, 0.3 + th_ / 2), seg=14)
                for m in range(7):
                    aa = m * math.tau / 7
                    if rnd(m, tx) < 0.35:
                        continue
                    wk.box((0.34, 0.34, 0.3 + 0.4 * rnd(m, ty)), toon("court"), loc=B(tx + math.cos(aa) * 0.88, ty + math.sin(aa) * 0.88, 0.3 + th_ + 0.2), rot=(0, 0, math.degrees(aa)), bevel=0.02)
                wk.box((0.22, 0.04, 0.4), K.glow("#ffb04d", 1.6), loc=B(tx, ty + 1.0, 0.3 + th_ * 0.62), outline=0.004)
                wk.sheet([B(tx - 0.3, ty + 1.02, 0.3 + th_ * 0.45), B(tx + 0.3, ty + 1.02, 0.3 + th_ * 0.45), B(tx + 0.3, ty + 1.02, th_ * 0.05 + 0.9),
                          B(tx + 0.05, ty + 1.02, th_ * 0.05 + 1.2), B(tx - 0.3, ty + 1.02, th_ * 0.05 + 0.8)], K.toon("#5a3a6e"), thick=0.02)
            for bx in (-0.8, 1.6, 7.4, 9.8):  # braziers along the wall foot
                tree("brazier", bx, yb + 0.9, 1.1, int(bx * 10))

        fg_objs = []

        def fg_build():
            """The foreground: canopy, boughs and banners that overhang the board edge. Built into the backdrop too (so
            the scene is whole), then rendered again alone as act<n>_fg.webp, drawn over units and faded per cell."""
            kind = th.get("fg")
            if not kind:
                return
            before = set(coll.objects.keys())
            n = 0
            y = -0.2
            while y < H + 1.0:
                for side in (0, 1):
                    jit = rnd(n, 301 + side)
                    if rnd(n, 311 + side) < 0.22 and 1.0 < y < H - 0.5:
                        n += 1
                        continue  # a gap now and then, so the frame breathes
                    x = -0.62 - 0.12 * jit if side == 0 else W + 0.62 + 0.12 * jit
                    inw = 1 if side == 0 else -1
                    s_ = 0.85 + 0.3 * rnd(n, 321)
                    if kind == "canopy":
                        # A broadleaf leaning in over the edge: trunk outside the border, crown overhanging the board.
                        wk.rod(B(x - inw * 0.1, y, 0.0), B(x + inw * 0.18, y, 1.1 * s_), 0.08 * s_, toon("trunk"), r2=0.055 * s_, seg=8)
                        for j in range(5):
                            aa = j * 1.4 + n
                            wk.ball(0.34 * s_, toon("foliage" if j % 2 else "foliage_dk"),
                                    loc=B(x + inw * (0.25 + 0.2 * (j % 3)) + math.cos(aa) * 0.12, y + math.sin(aa) * 0.2, (1.25 + 0.14 * (j % 2)) * s_), subdiv=2)
                        wk.ball(0.22 * s_, toon("grass_lt"), loc=B(x + inw * 0.4, y - 0.14, 1.55 * s_), scale=(1, 0.9, 0.6), subdiv=2, outline=0.005)
                    elif kind in ("pines", "snowpines"):
                        for j, (rr, zz) in enumerate(((0.42, 1.0), (0.32, 1.32))):
                            wk.cone(rr * s_, 0.5 * s_, toon("foliage" if j % 2 == 0 else "foliage_dk"), loc=B(x + inw * 0.05, y, zz * s_), seg=9)
                            if kind == "snowpines":
                                wk.cone(rr * 0.62 * s_, 0.28 * s_, K.toon("#ffffff"), loc=B(x + inw * 0.05, y, zz * s_ + 0.14 * s_), seg=9)
                    elif kind == "willows":
                        wk.ball(0.4 * s_, toon("willow"), loc=B(x, y, 1.35 * s_), scale=(1.1, 1.0, 0.55), subdiv=2)
                        for j in range(6):
                            aa = j * 0.55 - 1.4 if side == 0 else math.pi + j * 0.55 - 1.4
                            wk.cone(0.1 * s_, 0.7 * s_, toon("willow_dk" if j % 2 else "willow"), loc=B(x + math.cos(aa) * 0.45 * s_, y + math.sin(aa) * 0.35 * s_, 0.95 * s_),
                                    rot=(180 + 10 * math.sin(aa), -10 * math.cos(aa), 0), seg=6)
                    elif kind == "topiary":
                        if n % 2 == 0:
                            wk.cyl(0.05, 0.9, toon("trunk"), loc=B(x, y, 0.45))
                            wk.ball(0.34 * s_, toon("foliage"), loc=B(x + inw * 0.08, y, 1.05), subdiv=2)
                            wk.ball(0.2 * s_, toon("grass_lt"), loc=B(x + inw * 0.04, y - 0.08, 1.2), scale=(1, 0.9, 0.6), subdiv=2, outline=0.005)
                        else:
                            wk.sphere(0.08, K.glow(g["lantern"], 2.2), loc=B(x + inw * 0.18, y, 1.0), seg=10, rings=6, outline=0.006)
                            wk.cyl(0.03, 1.0, K.toon("#3a2a20"), loc=B(x, y, 0.5), seg=6)
                            wk.rod(B(x, y, 1.0), B(x + inw * 0.18, y, 1.12), 0.02, K.toon("#3a2a20"), seg=5)
                    elif kind == "sky":
                        if n % 3 == 0:  # a tall pillar with a lapis banner
                            wk.cyl(0.11, 1.4, toon("court"), loc=B(x, y, 0.7), seg=12)
                            wk.cyl(0.15, 0.08, K.toon("#ffcf4d", spec=0.4), loc=B(x, y, 1.42), seg=12)
                            wk.sphere(0.09, K.toon("#ffcf4d", spec=0.5), loc=B(x, y, 1.55), seg=10, rings=6)
                            bx = x + inw * 0.12
                            wk.sheet([B(bx, y - 0.13, 1.32), B(bx, y + 0.13, 1.32), B(bx, y + 0.13, 0.62), B(bx, y, 0.72), B(bx, y - 0.13, 0.62)], K.toon(th["lapis"]), thick=0.025)
                        else:  # a cloud bank rolling over the edge
                            for j in range(3):
                                aa = j * 2.1 + n
                                wk.ball(0.3 * s_, K.toon("#ffffff"), loc=B(x + inw * (0.05 + 0.12 * j) + math.cos(aa) * 0.08, y + math.sin(aa) * 0.15, (0.85 + 0.12 * (j % 2)) * s_),
                                        scale=(1.2, 1.0, 0.7), subdiv=2)
                    elif kind == "coast":
                        if n % 3 == 1:  # gorse on the cliff edge
                            for j in range(2):
                                wk.ball(0.3 * s_, toon("foliage_dk"), loc=B(x + inw * 0.12 * j, y + 0.12 * j, (0.95 + 0.1 * j) * s_), scale=(1.2, 1.0, 0.7), subdiv=2)
                            for j in range(6):
                                aa = j * 1.1 + n
                                wk.sphere(0.05, K.toon("#ffd84d"), loc=B(x + inw * 0.1 + math.cos(aa) * 0.26, y + math.sin(aa) * 0.2, 1.12 * s_), seg=8, rings=5, outline=0.005)
                        else:  # a wind-bent pine leaning in over the board
                            wk.rod(B(x - inw * 0.1, y, 0.0), B(x + inw * 0.3, y, 1.0 * s_), 0.08 * s_, toon("trunk"), r2=0.05 * s_, seg=8)
                            for j, (rr, zz, dx) in enumerate(((0.44, 1.05, 0.38), (0.32, 1.32, 0.52))):
                                wk.cone(rr * s_, 0.42 * s_, toon("foliage" if j % 2 == 0 else "foliage_dk"), loc=B(x + inw * dx, y, zz * s_), rot=(0, 16 * inw, 0), seg=9)
                    elif kind == "ruins":
                        if n % 3 == 0:  # a tall broken pillar with a torn violet banner
                            hh = 1.15 + 0.3 * rnd(n, 431)
                            wk.cyl(0.13, hh, toon("court"), loc=B(x, y, hh / 2), seg=10)
                            wk.cone(0.14, 0.16, toon("court_dk"), loc=B(x, y, hh + 0.04), rot=(0, 30 * inw, 0), seg=6)
                            bx = x + inw * 0.15
                            wk.sheet([B(bx, y - 0.14, hh - 0.08), B(bx, y + 0.14, hh - 0.08), B(bx, y + 0.14, hh - 0.62), B(bx, y + 0.04, hh - 0.5), B(bx, y - 0.02, hh - 0.74), B(bx, y - 0.14, hh - 0.58)],
                                     K.toon(th["dress"]["banners"][0]), thick=0.025)
                            wk.box((0.03, 0.29, 0.05), K.toon(th["dress"]["banners"][1]), loc=B(bx + inw * 0.01, y, hh - 0.2), outline=0)
                        elif n % 3 == 1:  # a lit brazier on a wall stub
                            wk.box((0.42, 0.42, 0.75), toon("court_dk"), loc=B(x, y, 0.37), bevel=0.03)
                            wk.cyl(0.18, 0.1, K.toon("#4a3a34"), loc=B(x, y, 0.8), r2=0.12, seg=10)
                            wk.ball(0.15, K.glow("#ff9a3c", 2.6), loc=B(x, y, 0.92), scale=(1, 1, 1.3), subdiv=2, outline=0.006)
                        else:  # a leaning dead tree
                            wk.rod(B(x - inw * 0.1, y, 0.0), B(x + inw * 0.2, y, 1.0 * s_), 0.07 * s_, toon("trunk"), r2=0.04 * s_, seg=7)
                            for j in range(3):
                                aa = j * 1.3 + n
                                wk.rod(B(x + inw * 0.15, y, (0.7 + 0.12 * j) * s_), B(x + inw * (0.45 + 0.1 * j), y + math.sin(aa) * 0.3, (1.15 + 0.1 * j) * s_), 0.03 * s_, toon("trunk"), r2=0.012 * s_, seg=5)
                    n += 1
                y += 0.78
            fg_objs.extend(o for o in coll.objects if o.name not in before)

        if not a.no_ground:
            # ---------------- the ground
            court = th.get("court")
            relief = th.get("relief")
            if relief == "coast":
                coast_build()
            else:
                wk.box((44, 44, 0.04), S.ground_mat(st, "grass", "grass_dk", "patches", key_c="grass_lt"), loc=B(4.5, 3.0, -0.02), outline=0)

            def path_x(y):
                """Centre of the keep-to-keep path at board row y (the ribbon below)."""
                return 4.5 + 0.32 * math.sin(((y + 6.0) / 0.6) * 0.55)

            pts = [(path_x(-6.0 + i * 0.6), -6.0 + i * 0.6) for i in range(int((H + 6.5) / 0.6) + 1)]
            if relief == "coast":
                pts = [p for p in pts if p[1] > COAST_FAR + 0.3]
            if relief == "flagstones":
                # Raised, bevelled flagstones in running bond with ink grout and a few tones each, so the courtyard has
                # real height (bevels catch the key light, outlines read as grout) instead of a flat brick texture.
                # Kept low (FLAG_H) so units still stand on the board plane.
                wk.box((W + 1.2, H + 1.2, 0.05), K.flat(g["court_dk"]), loc=B(W / 2, H / 2, -0.004), outline=0)
                wk.box((W + 1.5, H + 1.5, 0.12), toon("court_dk"), loc=B(W / 2, H / 2, -0.07), bevel=0.03)
                tones = th["stones"]
                flagstones(-0.6, -0.6, W + 0.6, ZD - 0.05, 0.82, tones, 1)
                flagstones(-0.6, H - ZD + 0.05, W + 0.6, H + 0.6, 0.82, tones, 2)
                if th.get("strip_stones"):
                    flagstones(0.0, ZD + 0.05, W, H - ZD - 0.05, 1.1, th["strip_stones"], 3)
                    wk.box((W, H - 2 * ZD, 0.04), K.flat(g["strip_dk"]), loc=B(W / 2, H / 2, 0.0), outline=0)  # grout, below the slabs
                else:
                    # A sunken lawn between the zones, with tufts.
                    wk.box((W, H - 2 * ZD, 0.02), S.ground_mat(st, "strip", "strip_dk", "patches", scale=1.3), loc=B(W / 2, H / 2, 0.024), outline=0)
                    for n in range(34):
                        x, y = 0.3 + rnd(n, 41) * (W - 0.6), ZD + 0.25 + rnd(n, 42) * (H - 2 * ZD - 0.5)
                        if abs(x - path_x(y)) < 0.95:
                            continue
                        for j in range(3):
                            wk.cone(0.035, 0.11, toon("grass_dk" if j % 2 else "grass_lt"), loc=B(x + 0.05 * (j - 1), y + 0.02 * j, 0.05), rot=(12 * (j - 1), 0, 0), seg=5, outline=0.004)
                if th.get("inlay"):
                    # Gold inlay ring at the centre of the board, under the runner.
                    wk.torus(1.05, 0.035, K.toon(th["inlay"], spec=0.4), loc=B(W / 2, H / 2, 0.035), scale=(1, 1, 0.5), outline=0.004)
                    wk.torus(0.7, 0.025, K.toon(th["inlay"], spec=0.4), loc=B(W / 2, H / 2, 0.035), scale=(1, 1, 0.5), outline=0.004)
                # Stone kerbs on the zone lines, with a gap where the path passes.
                kerb = th.get("kerb", "court_dk")
                for yy in (ZD, H - ZD):
                    px = path_x(yy)
                    for xa, xb in ((-0.05, px - 0.8), (px + 0.8, W + 0.05)):
                        wk.box((xb - xa, 0.16, 0.1), toon(kerb, spec=0.3), loc=B((xa + xb) / 2, yy, 0.05), bevel=0.03, outline=0.006)
                    for xx in (px - 0.8, px + 0.8):
                        wk.cyl(0.11, 0.18, toon(kerb, spec=0.3), loc=B(xx, yy, 0.09), seg=12, bevel=0.025, outline=0.006)
                        wk.sphere(0.07, K.toon(th.get("inlay") or g["court"], spec=0.4), loc=B(xx, yy, 0.21), seg=10, rings=6, outline=0.004)
                ribbon(pts, 1.45, K.flat(g["path_dk"]), 0.075)
                ribbon(pts, 1.15, S.ground_mat(st, "path", "path_dk", "tiles" if th.get("path_tiles") else "flat", scale=2.0), 0.079)
                if th.get("trim"):
                    for side in (-1, 1):
                        trim = [(x + side * 0.6, y) for x, y in pts]
                        ribbon(trim, 0.07, K.flat(th["trim"]), 0.083)
                for kx, ky in KEEPS:
                    # A raised round dais under each keep.
                    wk.cyl(1.52, 0.1, toon("court_dk"), loc=B(kx, ky, 0.05), seg=40, bevel=0.03, outline=0.006)
                    wk.cyl(1.38, 0.02, S.ground_mat(st, "path", "path_dk", "tiles", scale=1.4), loc=B(kx, ky, 0.1), seg=40, outline=0)
            elif relief == "snow":
                # Frozen Reach: a frozen stream across the neutral strip, packed-snow banks along the zone lines and the
                # path, wind ripples and a few ice patches in the deploy zones: soft height on an otherwise flat field.
                wk.box((W + 1.2, H + 1.2, 0.02), S.ground_mat(st, "grass", "grass_dk", "patches", scale=1.6, key_c="grass_lt"), loc=B(W / 2, H / 2, 0.0), outline=0)
                wk.box((W, H - 2 * ZD, 0.02), S.ground_mat(st, "strip", "strip_dk", "patches", scale=2.4), loc=B(W / 2, H / 2, 0.006), outline=0)
                ice = K.toon("#bfe3f7", spec=0.7)
                wk.box((W, H - 2 * ZD - 0.5, 0.02), ice, loc=B(W / 2, H / 2, 0.014), outline=0.005)
                for n in range(9):  # cracks and glints on the ice
                    x, y = 0.4 + rnd(n, 51) * (W - 0.8), ZD + 0.45 + rnd(n, 52) * (H - 2 * ZD - 0.9)
                    ang = rnd(n, 53) * 180
                    wk.box((0.5 + rnd(n, 54) * 0.6, 0.025, 0.01), K.flat("#8fb8d6"), loc=B(x, y, 0.026), rot=(0, 0, ang), outline=0)
                    wk.box((0.22, 0.05, 0.01), K.flat("#ffffff"), loc=B(x + 0.3, y - 0.2, 0.027), rot=(0, 0, 35), outline=0)
                for yy in (ZD, H - ZD):  # snow banks on the zone lines (low, so they read as ground, not walls)
                    x = -0.1
                    k = 0
                    while x < W + 0.1:
                        wk.ball(0.2 + 0.05 * rnd(k, yy), K.toon("#ffffff"), loc=B(x, yy + (rnd(k, 61) - 0.5) * 0.06, 0.0), scale=(1.4, 1.0, 0.42), subdiv=2, outline=0.005)
                        x += 0.3
                        k += 1
                for side in (-1, 1):  # ploughed banks along the path
                    for i in range(int((H + 2.0) / 0.32)):
                        y = -1.0 + i * 0.32
                        if abs(y - ZD) < 0.3 or abs(y - (H - ZD)) < 0.3:
                            continue
                        wk.ball(0.13, K.toon("#ffffff"), loc=B(path_x(y) + side * (0.72 + 0.04 * rnd(i, side)), y, 0.0), scale=(1.0, 1.5, 0.4), subdiv=2, outline=0.004)
                for n in range(70):  # wind ripples (sastrugi)
                    x, y = 0.2 + rnd(n, 71) * (W - 0.4), -0.4 + rnd(n, 72) * (H + 0.8)
                    if abs(x - path_x(y)) < 1.0 or ZD - 0.3 < y < H - ZD + 0.3:
                        continue
                    wk.ball(0.18 + 0.1 * rnd(n, 73), K.toon("#f4f9ff"), loc=B(x, y, -0.005), scale=(2.2, 0.55, 0.22), rot=(0, 0, 18 + 10 * rnd(n, 74)), subdiv=2, outline=0.003)
                for n in range(7):  # ice patches
                    x, y = 0.6 + rnd(n, 81) * (W - 1.2), 0.6 + rnd(n, 82) * (H - 1.2)
                    if abs(x - path_x(y)) < 1.2 or ZD - 0.5 < y < H - ZD + 0.5:
                        continue
                    with wk.at(B(x, y, 0.01), rot=(0, 0, rnd(n, 84) * 90), scale=(1.3, 0.9, 1)):
                        wk.cyl(0.32 + 0.15 * rnd(n, 83), 0.012, ice, seg=18, outline=0.004)
                    wk.box((0.2, 0.04, 0.01), K.flat("#ffffff"), loc=B(x - 0.08, y - 0.06, 0.02), rot=(0, 0, 30), outline=0)
                for n in range(22):  # boot prints along a trail through your zone
                    y = H - 0.8 - n * 0.24
                    x = 1.6 + 0.5 * math.sin(n * 0.35) + (0.07 if n % 2 else -0.07)
                    with wk.at(B(x, y, 0.012), scale=(0.75, 1.3, 1)):
                        wk.cyl(0.045, 0.006, K.flat("#b9cde0"), seg=10, outline=0)
                ribbon(pts, 1.45, K.flat(g["path_dk"]), 0.02)
                ribbon(pts, 1.15, S.ground_mat(st, "path", "path_dk", "patches", scale=2.0), 0.024)
                for kx, ky in KEEPS:
                    wk.cyl(1.5, 0.06, K.toon("#ffffff"), loc=B(kx, ky, 0.02), seg=40, bevel=0.025, outline=0.005)
                    wk.cyl(1.38, 0.02, S.ground_mat(st, "path", "path_dk", "tiles", scale=1.4), loc=B(kx, ky, 0.05), seg=40, outline=0)
            elif relief == "fen":
                # Mirelight Fen: a reed-banked mere across the neutral strip with a plank boardwalk over it, peat banks,
                # tussocks and puddles in the deploy zones, plank decks under the keeps: height everywhere, all of it low.
                wk.box((W + 1.2, H + 1.2, 0.02), S.ground_mat(st, "grass", "grass_dk", "patches", scale=1.5, key_c="grass_lt"), loc=B(W / 2, H / 2, 0.0), outline=0)
                water = K.toon(th["water"])
                wk.box((W + 1.0, H - 2 * ZD + 0.36, 0.02), K.flat(g["path_dk"]), loc=B(W / 2, H / 2, 0.006), outline=0)  # peat bank
                wk.box((W + 1.0, H - 2 * ZD - 0.04, 0.02), water, loc=B(W / 2, H / 2, 0.02), outline=0.005)
                for n in range(16):  # ripples and glints on the water
                    x, y = 0.3 + rnd(n, 91) * (W - 0.6), ZD + 0.3 + rnd(n, 92) * (H - 2 * ZD - 0.6)
                    if abs(x - path_x(y)) < 0.9:
                        continue
                    if n % 2:
                        wk.torus(0.12 + 0.12 * rnd(n, 93), 0.012, K.flat(th["water_lt"]), loc=B(x, y, 0.034), scale=(1.4, 1, 0.3), outline=0)
                    else:  # a glint
                        with wk.at(B(x, y, 0.034), scale=(2.4, 0.7, 1)):
                            wk.cyl(0.05 + 0.03 * rnd(n, 93), 0.004, K.flat("#d8f4f6"), seg=10, outline=0)
                for n in range(14):  # lily pads
                    x, y = 0.3 + rnd(n, 94) * (W - 0.6), ZD + 0.3 + rnd(n, 95) * (H - 2 * ZD - 0.6)
                    if abs(x - path_x(y)) < 0.95:
                        continue
                    wk.cyl(0.1 + 0.04 * rnd(n, 96), 0.01, toon("foliage"), loc=B(x, y, 0.036), seg=12, outline=0.004)
                    if n % 4 == 0:
                        wk.sphere(0.04, K.toon("#ff9fc0"), loc=B(x + 0.03, y - 0.02, 0.055), seg=8, rings=5, outline=0.004)
                for yy in (ZD, H - ZD):  # reed tufts along both banks (low, so they read as ground)
                    for n in range(30):
                        x = -0.2 + n * 0.32 + (rnd(n, yy) - 0.5) * 0.1
                        if abs(x - path_x(yy)) < 0.85 or rnd(n, yy + 1) < 0.25:
                            continue
                        for j in range(3):
                            wk.cone(0.035, 0.14 + 0.05 * j, toon("foliage_dk" if j % 2 else "foliage"), loc=B(x + 0.05 * (j - 1), yy + (0.05 if yy < H / 2 else -0.05), 0.08),
                                    rot=(10 * (j - 1), 0, 0), seg=5, outline=0.004)
                for n in range(40):  # tussocks in the deploy zones
                    x, y = 0.3 + rnd(n, 101) * (W - 0.6), 0.3 + rnd(n, 102) * (H - 0.6)
                    if abs(x - path_x(y)) < 0.95 or ZD - 0.3 < y < H - ZD + 0.3 or any(math.hypot(x - kx, y - ky) < 1.7 for kx, ky in KEEPS):
                        continue
                    wk.ball(0.12, toon("grass_dk"), loc=B(x, y, 0.0), scale=(1.3, 1.1, 0.5), subdiv=2, outline=0.004)
                    for j in range(3):
                        wk.cone(0.03, 0.12, toon("grass_lt" if j % 2 else "foliage"), loc=B(x + 0.05 * (j - 1), y, 0.08), rot=(14 * (j - 1), 0, 0), seg=5, outline=0.003)
                for n in range(8):  # puddles
                    x, y = 0.6 + rnd(n, 111) * (W - 1.2), 0.6 + rnd(n, 112) * (H - 1.2)
                    if abs(x - path_x(y)) < 1.2 or ZD - 0.5 < y < H - ZD + 0.5 or any(math.hypot(x - kx, y - ky) < 1.8 for kx, ky in KEEPS):
                        continue
                    with wk.at(B(x, y, 0.004), rot=(0, 0, rnd(n, 113) * 90), scale=(1.4, 0.9, 1)):
                        wk.cyl(0.36 + 0.12 * rnd(n, 114), 0.012, K.flat(g["path_dk"]), seg=18, outline=0)
                        wk.cyl(0.3 + 0.12 * rnd(n, 114), 0.016, water, seg=18, outline=0.003)
                ribbon(pts, 1.45, K.flat(g["path_dk"]), 0.022)
                ribbon(pts, 1.15, S.ground_mat(st, "path", "path_dk", "patches", scale=2.0), 0.026)
                # The boardwalk over the mere: planks across the path on short piles.
                plank, plank_dk = toon("plank", spec=0.15), toon("plank_dk")
                y = ZD - 0.35
                n = 0
                while y < H - ZD + 0.35:
                    px = path_x(y)
                    tang = math.degrees(math.atan2(path_x(y + 0.05) - path_x(y - 0.05), 0.1))
                    wk.box((1.3, 0.17, 0.05), plank if n % 3 else plank_dk, loc=B(px, y, 0.065 + 0.006 * (rnd(n, 121) - 0.5)), rot=(0, 0, tang + 3 * (rnd(n, 122) - 0.5)), bevel=0.012, outline=0.005)
                    if n % 4 == 0:
                        for side in (-1, 1):
                            wk.cyl(0.05, 0.16, plank_dk, loc=B(px + side * 0.7, y, 0.06), seg=8, bevel=0.01, outline=0.005)
                    y += 0.2
                    n += 1
                for kx, ky in KEEPS:  # plank decks under the keeps
                    R = 1.5
                    wk.cyl(R + 0.04, 0.08, plank_dk, loc=B(kx, ky, 0.03), seg=40, bevel=0.02, outline=0.006)
                    yy = -R + 0.1
                    k = 0
                    while yy < R - 0.05:
                        half = math.sqrt(max(0.0, R * R - (yy + 0.08) ** 2)) - 0.08
                        if half > 0.15:
                            wk.box((2 * half, 0.19, 0.04), plank if k % 3 else toon("path"), loc=B(kx, ky + yy + 0.1, 0.085), bevel=0.01, outline=0.004)
                        yy += 0.21
                        k += 1
                    for j in range(10):
                        aa = j * math.tau / 10
                        wk.cyl(0.07, 0.16, plank_dk, loc=B(kx + math.cos(aa) * R, ky + math.sin(aa) * R, 0.08), seg=8, outline=0.005)
            else:
                if court:
                    wk.box((W + 1.2, H + 1.2, 0.05), S.ground_mat(st, "court", "court_dk", "tiles", scale=1.2), loc=B(W / 2, H / 2, -0.004), outline=0)
                    wk.box((W + 1.5, H + 1.5, 0.12), toon("court_dk"), loc=B(W / 2, H / 2, -0.07), bevel=0.03)
                strip_pat = th.get("strip_pat") or ("tiles" if court else "patches")
                wk.box((W, H - 2 * ZD, 0.02), S.ground_mat(st, "strip", "strip_dk", strip_pat, scale=1.3), loc=B(W / 2, H / 2, 0.012), outline=0)
                for yy in (ZD, H - ZD):
                    wk.box((W, 0.09, 0.05), toon("edge"), loc=B(W / 2, yy, 0.03), bevel=0.015, outline=0)
                ribbon(pts, 1.45, K.flat(g["path_dk"]), 0.03)
                ribbon(pts, 1.15, S.ground_mat(st, "path", "path_dk", "tiles" if court else "patches", scale=2.0), 0.034)
                for kx, ky in KEEPS:
                    wk.cyl(1.5, 0.02, K.flat(g["path_dk"]), loc=B(kx, ky, 0.036), seg=40, outline=0)
                    wk.cyl(1.38, 0.02, S.ground_mat(st, "path", "path_dk", "tiles", scale=1.4), loc=B(kx, ky, 0.04), seg=40, outline=0)
            dress(court, relief, path_x)
            # ---------------- the border around the board
            i = 0
            yy = -0.3
            while yy < H + 0.6:
                for xx in (-0.45, W + 0.45):
                    border_piece(xx, yy, False, i)
                    i += 1
                yy += 0.6
            for yb in (-0.45, H + 0.55):
                xx = -0.45
                while xx < W + 0.6:
                    if abs(xx - 4.5) > 0.95:
                        border_piece(xx, yb, True, i)
                    i += 1
                    xx += 0.6
            # ---------------- trees and scenery beyond it
            kinds = th["trees"]
            j = 0
            for gy in range(-17, 22):
                for gx in range(-12, 22):
                    x = gx * 1.25 + (rnd(gx, gy) - 0.5) * 0.7 + (0.6 if gy % 2 else 0)
                    y = gy * 1.05 + (rnd(gy, gx + 9) - 0.5) * 0.5
                    inside = -1.3 < x < W + 1.3 and -1.25 < y < H + 1.4
                    if inside or (abs(x - 4.5) < 1.2 and y < 0):
                        continue
                    if th.get("relief") == "coast" and not on_land(x, y, 0.5):
                        continue
                    u, v = cam_uv(x, y)
                    if not (VIEW["u0"] - 0.04 < u < VIEW["u1"] + 0.04 and VIEW["v0"] - 0.06 < v < VIEW["v1"] + 0.02):
                        continue
                    if rnd(gx * 3, gy * 7) < 0.12:
                        scatter(x, y, j)
                        j += 1
                        continue
                    tree(kinds[j % len(kinds)], x, y, 0.95 + rnd(gx, gy * 3) * 0.4, j)
                    j += 1
            for n in range(26):  # small things in the margins between the border and the trees
                side = n % 2
                x = (-0.95 if side == 0 else W + 0.95) + (rnd(n, 2) - 0.5) * 0.4
                y = -0.8 + rnd(n, 3) * (H + 1.8)
                scatter(x, y, n)
            if th.get("relief") == "coast":
                lighthouse(-1.6, -7.6)
            if th.get("vista") == "citadel":
                citadel_vista()
            fg_build()

            # ---------------- backdrop through the game camera
            cam = stage.cam
            d = cam.data
            d.type = "PERSP"
            d.sensor_fit = "HORIZONTAL"
            d.sensor_width = 36.0
            uw = VIEW["u1"] - VIEW["u0"]
            d.lens = 36.0 / uw
            d.shift_x = ((VIEW["u0"] + VIEW["u1"]) / 2) / uw
            d.shift_y = -((VIEW["v0"] + VIEW["v1"]) / 2) / uw
            d.clip_start, d.clip_end = 0.5, 200.0
            cam.location = B(W / 2, H / 2 + DIST * math.sin(TILT), DIST * math.cos(TILT))
            cam.rotation_euler = (TILT, 0, 0)
            rx = int(round(uw * KPX * ss))
            ry = int(round((VIEW["v1"] - VIEW["v0"]) * KPX * ss))
            sc = stage.sc
            sc.render.resolution_x, sc.render.resolution_y = rx, ry
            bpy.context.view_layer.update()
            err = 0.0
            for (x, y) in ((0, 0), (W, 0), (0, H), (W, H), (4.5, 7), (-3, -8)):
                p = world_to_camera_view(sc, cam, Vector(B(x, y, 0)))
                u, v = cam_uv(x, y)
                fx, fy = (u - VIEW["u0"]) / uw, 1 - (v - VIEW["v0"]) / (VIEW["v1"] - VIEW["v0"])
                err = max(err, abs(p.x - fx) * rx, abs(p.y - fy) * ry)
            print(f"ARENA {act} camera check: max error {err:.2f}px at {rx}x{ry}", flush=True)
            img = render(os.path.join(BUILD, f"act{act}_raw.png"))
            img = S.downsample(img, ss)
            img = mood(sunlight(S.grade(img, st, vignette=False)), th.get("grade"))
            png = os.path.join(BUILD, f"act{act}.png")
            S.write_png(png, img)
            to_jpeg(png, os.path.join(OUT, f"act{act}.jpg"))
            fg_info = None
            if fg_objs:
                # The same camera, only the foreground: hide everything else.
                keep = {o.name for o in fg_objs}
                for o in coll.objects:
                    o.hide_render = o.name not in keep
                fim = render(os.path.join(BUILD, f"act{act}_fg_raw.png"))
                fim = mood(sunlight(S.grade(S.downsample(fim, ss), st, vignette=False)), th.get("grade"))
                al = fim[..., 3]
                hh, ww = al.shape
                # Cells: each side split into FG_ROWS bands; each cell's tight box of covered pixels, as backdrop fractions.
                cells = []
                for side in (0, 1):
                    xa, xb = (0, ww // 2) if side == 0 else (ww // 2, ww)
                    for rI in range(FG_ROWS):
                        ya, yb = hh * rI // FG_ROWS, hh * (rI + 1) // FG_ROWS
                        m = al[ya:yb, xa:xb] > 0.02
                        if not m.any():
                            continue
                        rows, cols = np.where(m.any(1))[0], np.where(m.any(0))[0]
                        x0, x1 = xa + cols[0], xa + cols[-1] + 1
                        y0, y1 = ya + rows[0], ya + rows[-1] + 1
                        cells.append([round(x0 / ww, 5), round(y0 / hh, 5), round((x1 - x0) / ww, 5), round((y1 - y0) / hh, 5)])
                fpng = os.path.join(BUILD, f"act{act}_fg.png")
                S.write_png(fpng, fim)
                subprocess.run(["cwebp", "-quiet", "-q", "86", "-alpha_q", "90", fpng, "-o", os.path.join(OUT, f"act{act}_fg.webp")], capture_output=True)
                fg_info = {"file": f"act{act}_fg.webp", "cells": cells}
                for o in coll.objects:
                    o.hide_render = False
                fg_objs.clear()

        # ---------------- obstacle props
        wk.clear()
        d = stage.cam.data
        d.type = "ORTHO"
        c = {"camera": {"ppu": PROP_PPU, "supersample": ss, "elevation_deg": math.degrees(el_prop)}}
        props = []
        for v in range(0 if a.no_props else 3):
            wk.clear()
            build_obstacle(wk, th["obstacle"], v, toon, K, B)
            verts = wk.verts_world()
            low = verts[verts[:, 2] < 0.5]
            foot = float(np.sqrt(low[:, 0] ** 2 + low[:, 1] ** 2).max()) if len(low) else 1.0
            shadow(0.06, 0.08, 1.0)
            prx, pry, x0, x1, u0, u1 = S.camera_view(stage, c, PROP_X[0], PROP_X[1], PROP_U[0], PROP_U[1], ss, el=el_prop)
            pim = render(os.path.join(BUILD, f"act{act}_prop{v}_raw.png"))
            pim = S.grade(S.downsample(pim, ss), st, vignette=False)
            name = f"act{act}_prop{v}.png"
            S.write_png(os.path.join(OUT, name), pim)
            props.append({"file": name, "footprint": round(foot, 4)})
            man["prop"] = {"frame": [round(x1 - x0, 5), round(u1 - u0, 5)], "anchor": [round((0 - x0) / (x1 - x0), 5), round((u1 - 0) / (u1 - u0), 5)],
                           "res": [prx // ss, pry // ss], "elev": round(math.degrees(el_prop), 3)}
        if not a.no_ground:
            man["size"] = [rx // ss, ry // ss]
        if a.no_props:
            props = man["acts"].get(str(act), {}).get("props", [])
        entry = {"name": th["name"], "edge": g["grass"], "obstacle": th["obstacle"], "ground": f"act{act}.jpg", "props": props}
        if a.no_ground:
            if man["acts"].get(str(act), {}).get("fg"):
                entry["fg"] = man["acts"][str(act)]["fg"]
        elif fg_info:
            entry["fg"] = fg_info
        man["acts"][str(act)] = entry
        with open(man_path, "w") as f:
            json.dump(man, f, indent=1)
        print(f"ARENA {act} {th['name']} done in {time.time() - t0:.0f}s", flush=True)
    print("ARENAS_DONE", flush=True)


def sunlight(img, strength=0.06):
    """A warm afternoon key from the top-left over the whole frame (backdrop and foreground alike, so they match):
    a few percent brighter and warmer up-left, cooler and softer down-right. img: premultiplied float HxWx4."""
    import numpy as np
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    k = 0.5 - (xx / w * 0.6 + yy / h) / 1.6  # +0.5 top-left .. -0.5 bottom-right
    gain = (1 + strength * 2 * k)[..., None] * np.stack([1 + 0.05 * k, 1 + 0.012 * k, 1 - 0.05 * k], -1)
    out = img.copy()
    out[..., :3] = np.minimum(img[..., :3] * gain, img[..., 3:4])
    return out


def mood(img, kind):
    """Per-act light over the whole frame: 'storm' (cool, a touch grey, darker far side) or 'dusk' (amber far side,
    violet near side, a little darker), applied to the backdrop and foreground alike so they match."""
    if not kind:
        return img
    import numpy as np
    h, w = img.shape[:2]
    t = (np.mgrid[0:h, 0:w][0].astype(np.float32) / h)[..., None]  # 0 far (top) .. 1 near (bottom)
    rgb = img[..., :3]
    if kind == "storm":
        lum = (rgb * np.array([0.3, 0.55, 0.15], np.float32)).sum(-1, keepdims=True)
        rgb = rgb * 0.86 + lum * 0.14
        gain = np.array([0.93, 0.98, 1.05], np.float32) * (0.92 + 0.08 * t)
    else:
        far, near = np.array([1.1, 0.93, 0.8], np.float32), np.array([0.9, 0.84, 1.0], np.float32)
        gain = (far * (1 - t) + near * t) * 0.95
    out = img.copy()
    out[..., :3] = np.minimum(rgb * gain, img[..., 3:4])
    return out


def cam_uv(x, y):
    """The game camera's normalised image plane for a ground point (base/src/render/camera.ts project with k = 1)."""
    X, Y = x - W / 2, y - H / 2
    cz = DIST - Y * math.sin(TILT)
    return X / cz, (Y * math.cos(TILT)) / cz


def build_obstacle(wk, kind, v, toon, K, B):
    """One obstacle prop at the origin with its base silhouette on the unit circle."""
    r = 1.0
    if kind == "pillar":
        wk.cyl(r * 0.98, 0.3, toon("court_dk"), loc=B(0, 0, 0.15), seg=12, bevel=0.04)
        hgt = 1.0 if v == 1 else 1.55
        wk.cyl(r * 0.62, hgt, toon("court"), loc=B(0, 0, 0.3 + hgt / 2), seg=12)
        if v != 1:
            wk.cyl(r * 0.78, 0.2, toon("court_dk"), loc=B(0, 0, 0.3 + hgt + 0.1), seg=12, bevel=0.03)
            wk.cyl(r * 0.3, 0.16, toon("trunk"), loc=B(0, 0, 0.3 + hgt + 0.28), r2=r * 0.4)
            wk.ball(0.24, K.glow("#ffd27a", 2.2), loc=B(0, 0, 0.3 + hgt + 0.48), outline=0.006)
        else:
            wk.ball(r * 0.3, toon("court"), loc=B(0.5, 0.3, 0.12), scale=(1.2, 1, 0.6), subdiv=1, smooth=False)
        if v == 2:
            wk.sheet([B(-0.62, 0.62, 1.6), B(0.0, 0.62, 1.6), B(-0.02, 0.62, 0.7), B(-0.31, 0.62, 0.55), B(-0.6, 0.62, 0.7)], K.toon("team.main"), thick=0.03)
    elif kind == "obelisk":
        wk.cyl(r * 0.98, 0.26, toon("court_dk"), loc=B(0, 0, 0.13), seg=8, bevel=0.04)
        wk.cyl(r * 0.8, 0.12, K.toon("#ffcf4d", spec=0.4), loc=B(0, 0, 0.32), seg=8)
        wk.crystal(0.48 - 0.06 * v, 1.6 + 0.25 * v, K.toon("#7fb2ff", spec=0.7), loc=B(0, 0, 0.36), sides=6)
        wk.crystal(0.22, 0.7, K.toon("#a6c9ff", spec=0.7), loc=B(0.5, 0.25, 0.36), rot=(0, 18, 30 * v))
    elif kind in ("stump", "charstump"):
        wood = "#4a3a30" if kind == "charstump" else "#9a643a"
        top = "#2e2420" if kind == "charstump" else "#e1b47a"
        wk.cyl(r * 0.8, 0.6 + 0.12 * v, K.toon(wood), loc=B(0, 0, 0.3 + 0.06 * v), r2=r * 0.72, seg=14)
        wk.cyl(r * 0.66, 0.05, K.toon(top), loc=B(0, 0, 0.62 + 0.12 * v), seg=14, outline=0.008)
        for j in range(4):
            aa = j * 1.6 + v
            wk.rod(B(math.cos(aa) * 0.62, math.sin(aa) * 0.62, 0.12), B(math.cos(aa) * 0.98, math.sin(aa) * 0.98, 0.0), 0.15, K.toon(wood), r2=0.06)
        if kind == "charstump":
            for j in range(3):
                wk.sphere(0.09, K.glow("#ff9a3c", 2.4), loc=B(math.cos(j * 2.1) * 0.35, math.sin(j * 2.1) * 0.3, 0.66 + 0.12 * v), seg=8, rings=5, outline=0)
        else:
            wk.ball(0.4, toon("foliage"), loc=B(-0.2, 0.1, 0.66 + 0.12 * v), scale=(1.1, 1, 0.35), subdiv=2)
            for j in range(v + 1):
                wk.cyl(0.04, 0.16, K.toon("#f3ead0"), loc=B(0.55 - 0.15 * j, 0.55, 0.08), outline=0.008)
                wk.sphere(0.12, K.toon("#e2483a"), loc=B(0.55 - 0.15 * j, 0.55, 0.18), scale=(1, 1, 0.6), seg=12, rings=6, outline=0.008)
    elif kind == "crag":
        wk.ball(r * 0.95, toon("rock"), loc=B(0, 0, 0.5), scale=(1.0, 0.9, 1.1 + 0.15 * v), subdiv=1, smooth=False, rot=(0, 0, 25 + v * 50))
        wk.ball(r * 0.38, toon("rock_dk"), loc=B(0.45, 0.4, 0.2), scale=(1.0, 0.9, 0.8), subdiv=1, smooth=False)
        wk.box((0.08, 0.5, 0.7), K.toon("#6a7584", spec=0.5), loc=B(-0.2, 0.62, 0.65), rot=(0, 12, 20), outline=0.008)
    elif kind == "icerock":
        wk.ball(r * 1.07, toon("rock"), loc=B(0, 0, 0.42), scale=(1.0, 0.92, 0.72), subdiv=1, smooth=False, rot=(0, 0, 20 + v * 40))
        wk.ball(r * 0.7, K.toon("#ffffff"), loc=B(-0.05, -0.05, 0.72), scale=(1.0, 0.95, 0.4), subdiv=2)
        for j in range(2 + v):
            aa = j * 2.3 + v
            wk.crystal(0.16, 0.7, K.toon("#bfe9ff", spec=0.6), loc=B(math.cos(aa) * 0.55, math.sin(aa) * 0.45, 0.3), rot=(18 * math.cos(aa), 18 * math.sin(aa), 0))
    elif kind == "fenlamp":
        # A peat mound held together by roots, with a lantern on a crooked post (or reeds, or a willow stump).
        wk.ball(r * 0.97, K.toon("#7a5a3c"), loc=B(0, 0, 0.12), scale=(1.0, 0.94, 0.3), subdiv=2)
        wk.ball(r * 0.74, toon("moss"), loc=B(-0.05, -0.04, 0.26), scale=(1.0, 0.95, 0.32), subdiv=2)
        for j in range(5):
            aa = j * 1.26 + v
            wk.rod(B(math.cos(aa) * 0.35, math.sin(aa) * 0.3, 0.3), B(math.cos(aa) * 0.95, math.sin(aa) * 0.9, 0.02), 0.07, K.toon("#6b4a32"), r2=0.035, seg=6)
        if v == 1:  # an old willow stump
            wk.cyl(0.46, 1.3, K.toon("#8a6440"), loc=B(0.1, 0.1, 0.85), r2=0.36, seg=12)
            wk.cyl(0.33, 0.04, K.toon("#d9b07a"), loc=B(0.1, 0.1, 1.5), seg=12, outline=0.008)
            wk.ball(0.34, toon("willow"), loc=B(0.0, 0.2, 1.62), scale=(1.2, 1.0, 0.5), subdiv=2)
            for j in range(7):
                aa = j * 0.9 + 0.3
                wk.cone(0.11, 0.75, toon("willow" if j % 2 else "willow_dk"), loc=B(0.1 + math.cos(aa) * 0.38, 0.1 + math.sin(aa) * 0.34, 1.32), rot=(180, 0, 0), seg=6)
        else:  # a crooked post with a lit lantern
            wk.rod(B(0.15, 0.2, 0.2), B(0.05, 0.25, 2.3), 0.1, K.toon("#6b4a32"), r2=0.07, seg=8)
            wk.rod(B(0.05, 0.25, 2.2), B(-0.55, 0.25, 2.26), 0.055, K.toon("#6b4a32"), seg=6)
            wk.rod(B(-0.52, 0.25, 2.24), B(-0.52, 0.25, 2.02), 0.015, K.toon("#3a2a20"), seg=4, outline=0.004)
            wk.cone(0.24, 0.14, K.toon("#3a2a20"), loc=B(-0.52, 0.25, 2.02), seg=8)
            wk.ball(0.19, K.glow("#ffcf6b", 2.6), loc=B(-0.52, 0.25, 1.8), scale=(1, 1, 1.2), subdiv=2, outline=0.008)
            wk.box((0.3, 0.3, 0.05), K.toon("#3a2a20"), loc=B(-0.52, 0.25, 1.56))
            if v == 2:  # a second, smaller lantern on a stake
                wk.rod(B(0.55, -0.35, 0.2), B(0.55, -0.35, 1.2), 0.05, K.toon("#6b4a32"), seg=6)
                wk.ball(0.13, K.glow("#ffcf6b", 2.6), loc=B(0.55, -0.35, 1.3), scale=(1, 1, 1.2), subdiv=2, outline=0.006)
                wk.cone(0.16, 0.1, K.toon("#3a2a20"), loc=B(0.55, -0.35, 1.48), seg=8)
        n = 4 if v == 2 else 2
        for j in range(n):  # reeds round the edge
            aa = j * 2.1 + 0.7 * v
            x, y = math.cos(aa) * 0.6, math.sin(aa) * 0.5
            for q in range(3):
                wk.cone(0.06, 0.8 + 0.15 * q, toon("foliage" if q % 2 else "foliage_dk"), loc=B(x + 0.07 * (q - 1), y, 0.55), rot=(9 * (q - 1), 0, 0), seg=5)
            wk.cyl(0.05, 0.18, K.toon("#7a4f2f"), loc=B(x, y, 1.08), seg=6, outline=0.006)
    elif kind == "seastack":
        # A barnacled sea rock: grey stone, a cap of clifftop turf, barnacles and weed at the foot; a buoy on a rope
        # (v1) or a beached driftwood log and a gull (v2).
        wk.ball(r * 0.96, toon("rock"), loc=B(0, 0, 0.5), scale=(1.0, 0.9, 1.05 + 0.15 * v), subdiv=1, smooth=False, rot=(0, 0, 30 + v * 45))
        wk.ball(r * 0.42, toon("rock_dk"), loc=B(0.38, 0.3, 0.2), scale=(1.0, 0.9, 0.8), subdiv=1, smooth=False)
        wk.ball(r * 0.62, toon("grass"), loc=B(-0.05, -0.05, 1.0 + 0.15 * v), scale=(1.0, 0.95, 0.32), subdiv=2)
        for j in range(9):
            aa = j * 0.9 + v
            wk.cone(0.07, 0.08, K.toon("#f1ece0"), loc=B(math.cos(aa) * 0.86, math.sin(aa) * 0.78, 0.18 + 0.12 * (j % 3)), seg=6, outline=0.005)
        for j in range(4):
            aa = j * 1.6 + 0.5
            wk.ball(0.16, K.toon("#4f7a48"), loc=B(math.cos(aa) * 0.7, math.sin(aa) * 0.66, 0.06), scale=(1.4, 1.0, 0.4), subdiv=2, outline=0.005)
        if v == 1:
            wk.rod(B(0.45, 0.45, 1.0), B(0.68, 0.6, 0.78), 0.025, K.toon("#d9c49a"), seg=5, outline=0.004)  # a buoy hung on the rock
            wk.sphere(0.2, K.toon("#e2563a"), loc=B(0.7, 0.62, 0.66), seg=12, rings=8, outline=0.008)
            wk.cyl(0.205, 0.07, K.toon("#f4f0e6"), loc=B(0.7, 0.62, 0.66), seg=12, outline=0)
        elif v == 2:
            wk.cyl(0.11, 1.0, K.toon("#b8a78c"), loc=B(-0.1, 0.6, 0.1), rot=(90, 0, 72), seg=8)
            wk.ball(0.12, K.toon("#ffffff"), loc=B(0.05, -0.05, 1.42), scale=(1.4, 0.8, 0.8), subdiv=2, outline=0.006)
            wk.ball(0.07, K.toon("#ffffff"), loc=B(0.18, -0.05, 1.5), subdiv=2, outline=0.005)
            wk.cone(0.03, 0.08, K.toon("#ffcf4d"), loc=B(0.27, -0.05, 1.5), rot=(0, 90, 0), seg=5, outline=0.004)
    elif kind == "brokencolumn":
        # A fallen column of the citadel: a plinth and a snapped shaft (v0), the drums toppled with a lost gold crown in
        # the rubble (v1), or a rubble heap under a torn violet banner (v2).
        stone, dark = toon("court"), toon("court_dk")
        wk.cyl(r * 0.98, 0.28, dark, loc=B(0, 0, 0.14), seg=10, bevel=0.04)
        if v == 0:
            wk.cyl(r * 0.6, 1.25, stone, loc=B(0, 0, 0.9), seg=10)
            wk.cone(r * 0.62, 0.4, dark, loc=B(0.05, 0, 1.6), rot=(0, 26, 0), seg=7)
            wk.cyl(r * 0.45, 0.6, stone, loc=B(0.28, 0.28, 0.3), rot=(90, 0, 60), seg=10)
        elif v == 1:
            wk.cyl(r * 0.6, 0.55, stone, loc=B(0, 0, 0.55), seg=10)
            wk.cyl(r * 0.45, 0.75, stone, loc=B(-0.25, 0.3, 0.3), rot=(90, 0, -30), seg=10)
            gold = K.toon("#e0b050", spec=0.5)
            wk.cyl(0.3, 0.16, gold, loc=B(0.2, 0.2, 0.92), seg=16, outline=0.006)  # the fallen crown on the drum
            wk.cyl(0.25, 0.165, K.toon("#7a3a5a"), loc=B(0.2, 0.2, 0.925), seg=16, outline=0)
            for j in range(6):
                aa = j * math.tau / 6
                wk.cone(0.07, 0.2, gold, loc=B(0.2 + math.cos(aa) * 0.29, 0.2 + math.sin(aa) * 0.29, 1.1), seg=4, outline=0.005)
                if j % 2 == 0:
                    wk.sphere(0.035, K.toon("#d8463a", spec=0.4), loc=B(0.2 + math.cos(aa) * 0.31, 0.2 + math.sin(aa) * 0.31, 0.93), seg=8, rings=5, outline=0.003)
        else:
            for j in range(6):
                aa = j * 1.05
                wk.box((0.5, 0.42, 0.36), stone if j % 2 else dark, loc=B(math.cos(aa) * 0.45, math.sin(aa) * 0.4, 0.4 + 0.15 * (j % 2)), rot=(9 * j, 12, 33 * j), bevel=0.03)
            wk.cyl(0.04, 1.8, K.toon("#5e4a40"), loc=B(-0.1, 0.0, 1.2), rot=(0, 8, 0), seg=6)
            wk.sheet([B(-0.05, 0.0, 2.0), B(0.55, 0.0, 2.0), B(0.55, 0.0, 1.35), B(0.38, 0.0, 1.5), B(0.25, 0.0, 1.25), B(-0.05, 0.0, 1.4)], K.toon("#5a3a6e"), thick=0.025)
            wk.box((0.6, 0.03, 0.06), K.toon("#e0b050"), loc=B(0.25, 0.0, 1.8), outline=0)
    else:  # boulder
        wk.ball(r * 0.95, toon("rock"), loc=B(0, 0, 0.42), scale=(1.0, 0.92, 0.72 + 0.1 * v), subdiv=1, smooth=False, rot=(0, 0, 20 + v * 40))
        wk.ball(r * 0.4, toon("rock_dk"), loc=B(0.48, 0.38, 0.2), scale=(1.0, 0.9, 0.7), subdiv=1, smooth=False)
        wk.ball(r * 0.32, toon("rock"), loc=B(-0.52, 0.42, 0.16), scale=(1.0, 0.9, 0.7), subdiv=1, smooth=False)
        wk.ball(r * 0.55, toon("moss"), loc=B(-0.1, -0.05, 0.86 + 0.1 * v), scale=(1.0, 0.95, 0.35), subdiv=2)


if __name__ == "__main__":
    main()
