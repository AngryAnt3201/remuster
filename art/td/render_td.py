"""Bastion backdrops: one Blender render per tower-defence map in the Sunlit Meadow style (the arenas' kit, palette,
toon shading, grade and sunlight), through the TD camera (base/src/render/tdCamera.ts).

    npx vite-node art/td/export_maps.ts      # sim geometry -> art/td/build/maps.json
    nice -n 10 blender -b --factory-startup -P art/td/render_td.py -- [--only meadow] [--quick]

The TD camera is orthographic with the ground squashed by TD_SQUASH (0.8) on y, so the render camera is orthographic,
pitched so sin(elevation) = 0.8 (53.13 deg). A ground point (x, y) lands on backdrop pixel
    X = (x + MARGIN) * PPU,  Y = (y + MARGIN) * PPU * 0.8
which is the same layout as the ground texture tdView.ts bakes (TEX_M, TEX_PPU), so the game draws it unchanged.
The road ribbon and pads are built from the sim's own smoothed road points and pad list (maps.json), and after the
render every pad centre and road sample is checked on the pixels; the result goes in base/public/td/manifest.json and
tests/tdBackdrop.test.ts holds it to the sim. Output: base/public/td/<map>_<i>.webp horizontal slices + manifest.json.
Shapes and palettes are original, built from primitives.
"""
import argparse
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
sys.path.insert(0, os.path.join(ART, "arenas"))
OUT = os.path.join(ROOT, "base", "public", "td")
BUILD = os.path.join(HERE, "build")

SQUASH = 0.8  # base/src/render/tdCamera.ts TD_SQUASH
MARGIN = 3.5  # base/src/render/tdView.ts TEX_M
PPU = 72  # base/src/render/tdView.ts TEX_PPU
SLICES = 4

THEMES = {
    1: dict(trees=("broad", "broad", "pine"), g={}),
    3: dict(trees=("broad", "pine", "broad", "pine"), g=dict(grass="#6cb552", grass_dk="#54993f", grass_lt="#8ccb63",
                                                         foliage="#46a04c", foliage_dk="#2e7a3a")),
}


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--samples", type=int, default=16)
    ap.add_argument("--quick", action="store_true")
    return ap.parse_args(argv)


def rnd(i, k):
    return abs(math.sin(i * 127.1 + k * 311.7) * 43758.5453) % 1.0


def main():
    import bmesh
    import bpy
    import numpy as np
    from bpy_extras.object_utils import world_to_camera_view
    from mathutils import Vector

    from muster_art import kit as K
    from muster_art import style as S
    from render_arenas import sunlight

    a = parse()
    maps = json.load(open(os.path.join(BUILD, "maps.json")))
    only = [m for m in (a.only.split(",") if a.only else maps.keys()) if m]
    ss = 1 if a.quick else 2
    base = S.load()
    stage = K.Stage(samples=4 if a.quick else a.samples)
    S.apply(base)
    os.makedirs(OUT, exist_ok=True)
    wk = K.Kit(outline=base["outline"]["props"])
    coll = bpy.data.collections.new("TD")
    bpy.context.scene.collection.children.link(coll)
    wk.coll = coll
    el = math.asin(SQUASH)

    def B(x, y, z=0.0):
        return (x, -y, z)

    man_path = os.path.join(OUT, "manifest.json")
    man = json.load(open(man_path)) if os.path.exists(man_path) else {}
    man.update(version=1, squash=SQUASH, margin=MARGIN, ppu=PPU)
    man.setdefault("maps", {})

    for mid in only:
        t0 = time.time()
        md = maps[mid]
        Wm, Hm = md["w"], md["h"]
        th = THEMES.get(md["act"], THEMES[1])
        st = json.loads(json.dumps(base))
        g = st["ground"]
        g.update(th["g"])
        wk.clear()
        roads = [[(p[0], p[1]) for p in r] for r in md["roads"]]
        pads = [(p[0], p[1]) for p in md["pads"]]
        gates = [tuple(p) for p in md["gates"]]
        keep = tuple(md["keep"])
        RH = md["roadHalf"]

        def toon(key, spec=0.0):
            return K.toon(g.get(key) or key, spec=spec)

        sh_in = K.flat(st["shadow"]["color"], alpha=st["shadow"]["alpha"])
        sh_out = K.flat(st["shadow"]["color"], alpha=st["shadow"]["alpha"] * 0.45)

        def shadow(x, y, r):
            wk.cyl(r * 1.08, 0.004, sh_out, loc=B(x, y + r * 0.15, 0.012), seg=24, outline=0)
            wk.cyl(r * 0.82, 0.004, sh_in, loc=B(x, y + r * 0.1, 0.016), seg=24, outline=0)

        def ribbon(pts, width, mat, z):
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
            for f in bm.faces:
                f.normal_update()
                if f.normal.z < 0:
                    f.normal_flip()
            return wk._emit(bm, mat, smooth=False, outline=0, name="ribbon")

        def road_d(x, y):
            best = 1e9
            for r in roads:
                for i in range(0, len(r), 2):
                    d = math.hypot(r[i][0] - x, r[i][1] - y)
                    if d < best:
                        best = d
            return best

        def pad_d(x, y):
            return min(math.hypot(px - x, py - y) for px, py in pads)

        def plaza_d(x, y):
            return min(math.hypot(px - x, py - y) for px, py in gates + [keep])

        # ---------------- ground
        wk.box((Wm + MARGIN * 2 + 8, Hm + MARGIN * 2 + 8, 0.04), S.ground_mat(st, "grass", "grass_dk", "patches", key_c="grass_lt"),
               loc=B(Wm / 2, Hm / 2, -0.02), outline=0)
        # Mown lighter swathes in the open grass, under everything else.
        for n in range(int(Wm * Hm / 14)):
            x, y = rnd(n, 1) * Wm, rnd(n, 2) * Hm
            if road_d(x, y) < RH + 0.9:
                continue
            with wk.at(B(x, y, 0.003), rot=(0, 0, rnd(n, 3) * 180), scale=(1.0 + rnd(n, 4) * 1.2, 0.6 + rnd(n, 5) * 0.5, 1)):
                wk.cyl(0.7, 0.004, K.flat(g["grass_lt"], alpha=0.35), seg=20, outline=0)

        # ---------------- the road: a dark worn verge, dirt, lighter wear, ruts, cobbles on the edges
        path_mat = S.ground_mat(st, "path", "path_dk", "patches", scale=1.6)
        for r in roads:
            ribbon(r, RH * 2 + 0.26, K.flat(g["edge"], alpha=0.55), 0.004)
            ribbon(r, RH * 2 + 0.1, toon("path_dk"), 0.007)
            ribbon(r, RH * 2 - 0.08, path_mat, 0.010)
            ribbon(r, RH * 0.9, K.flat("#f3dcaa", alpha=0.45), 0.012)
            for side in (-1, 1):
                rut = []
                for i, (x, y) in enumerate(r):
                    j0, j1 = r[max(0, i - 1)], r[min(len(r) - 1, i + 1)]
                    dx, dy = j1[0] - j0[0], j1[1] - j0[1]
                    l = math.hypot(dx, dy) or 1
                    rut.append((x - dy / l * 0.27 * side, y + dx / l * 0.27 * side))
                ribbon(rut, 0.07, K.flat(g["path_dk"], alpha=0.5), 0.013)
        cob = [toon(c, spec=0.1) for c in ("#dcc595", "#cfb682", "#e7d3a3", "#c4a976", "#b8ad9a")]
        n = 0
        for ri, r in enumerate(roads):
            for i in range(0, len(r), 1):
                x, y = r[i]
                j0, j1 = r[max(0, i - 1)], r[min(len(r) - 1, i + 1)]
                dx, dy = j1[0] - j0[0], j1[1] - j0[1]
                l = math.hypot(dx, dy) or 1
                for side in (-1, 1):
                    if rnd(n, 7 + side) < 0.45:
                        n += 1
                        continue
                    off = RH - 0.02 + (rnd(n, 9) - 0.5) * 0.14
                    cx, cy = x - dy / l * off * side, y + dx / l * off * side
                    wk.ball(0.075 + rnd(n, 11) * 0.05, cob[n % len(cob)], loc=B(cx, cy, 0.012), scale=(1.3, 1.0, 0.32),
                            rot=(0, 0, rnd(n, 12) * 180), subdiv=1, smooth=False, outline=0.006)
                    n += 1
                if i % 9 == 4:  # a stray pebble on the dirt
                    wk.ball(0.05, cob[n % len(cob)], loc=B(x + (rnd(n, 13) - 0.5) * 0.6, y + (rnd(n, 14) - 0.5) * 0.6, 0.012),
                            scale=(1.2, 1, 0.4), subdiv=1, smooth=False, outline=0.005)
        # Grass tufts creeping in on the verges.
        for n in range(int(sum(len(r) for r in roads) * 0.5)):
            r = roads[n % len(roads)]
            i = int(rnd(n, 21) * (len(r) - 2)) + 1
            x, y = r[i]
            dx, dy = r[i + 1][0] - r[i - 1][0], r[i + 1][1] - r[i - 1][1]
            l = math.hypot(dx, dy) or 1
            side = 1 if rnd(n, 22) < 0.5 else -1
            off = RH + 0.12 + rnd(n, 23) * 0.25
            tx, ty = x - dy / l * off * side, y + dx / l * off * side
            if road_d(tx, ty) < RH + 0.05 or pad_d(tx, ty) < 0.8:
                continue
            for j in range(3):
                wk.cone(0.035, 0.12, toon("grass_dk" if j % 2 else "grass_lt"), loc=B(tx + 0.05 * (j - 1), ty + 0.02 * j, 0.05),
                        rot=(12 * (j - 1), 0, 0), seg=5, outline=0.004)

        # ---------------- plazas: cobbled rounds at the gates and the keep
        plaza_stones = [toon(c, spec=0.12) for c in ("#dcc595", "#e7d3a3", "#cfb682", "#d5c8a8")]
        for k, (px, py) in enumerate(gates + [keep]):
            wk.cyl(1.82, 0.02, toon("path_dk"), loc=B(px, py, 0.008), seg=40, outline=0)
            wk.cyl(1.7, 0.02, path_mat, loc=B(px, py, 0.014), seg=40, outline=0)
            for ring in range(1, 4):
                rr = 0.45 * ring
                cnt = int(rr * 2 * math.pi / 0.32)
                for j in range(cnt):
                    aa = j / cnt * math.tau + ring * 0.4
                    wk.box((0.24, 0.17, 0.035), plaza_stones[(j + ring + k) % 4], loc=B(px + math.cos(aa) * rr, py + math.sin(aa) * rr, 0.03),
                           rot=(0, 0, -math.degrees(aa)), bevel=0.02, outline=0.005)
            wk.cyl(0.3, 0.04, toon("#cfc6b2", spec=0.1), loc=B(px, py, 0.03), seg=20, outline=0.005)

        # ---------------- gates: two stone towers and a timber palisade across the top of the map
        for (gx, gy) in gates:
            for side in (-1, 1):
                tx, ty = gx + side * 1.95, gy - 0.35
                shadow(tx, ty, 0.55)
                wk.cyl(0.42, 1.25, toon("rock"), loc=B(tx, ty, 0.62), seg=14, bevel=0.03)
                wk.cyl(0.5, 0.18, toon("rock_dk"), loc=B(tx, ty, 1.3), seg=14, bevel=0.03)
                for j in range(6):
                    aa = j / 6 * math.tau
                    wk.box((0.16, 0.16, 0.16), toon("rock"), loc=B(tx + math.cos(aa) * 0.42, ty + math.sin(aa) * 0.42, 1.46), bevel=0.02)
                wk.cyl(0.08, 0.02, K.toon("#3a2a20"), loc=B(tx, ty + 0.42, 0.55), rot=(90, 0, 0), seg=10)
                # Banner pole on each tower.
                wk.cyl(0.025, 0.6, K.toon("#5a4030"), loc=B(tx, ty, 1.75), seg=6)
                wk.sheet([B(tx + 0.02, ty, 2.02), B(tx + 0.36, ty, 1.96), B(tx + 0.02, ty, 1.82)], K.toon("#cf5446"), thick=0.02)
        stake = [toon("trunk"), K.toon("#9a6a40"), K.toon("#7a5030")]
        top_y = min(gy for _, gy in gates) - 0.75
        x = -MARGIN
        n = 0
        while x < Wm + MARGIN:
            if min(abs(x - gx) for gx, _ in gates) > 2.35:
                hgt = 0.62 + rnd(n, 31) * 0.14
                wk.cyl(0.11, hgt, stake[n % 3], loc=B(x, top_y + (rnd(n, 32) - 0.5) * 0.05, hgt / 2), seg=7)
                wk.cone(0.11, 0.14, stake[n % 3], loc=B(x, top_y, hgt + 0.07), seg=7)
            x += 0.23
            n += 1
        rail_mat = K.toon("#7a5030")
        xs = sorted([-MARGIN] + [v for gx, _ in gates for v in (gx - 2.35, gx + 2.35)] + [Wm + MARGIN])
        for i in range(0, len(xs) - 1, 2):
            if xs[i + 1] - xs[i] > 0.3:
                wk.box((xs[i + 1] - xs[i], 0.06, 0.08), rail_mat, loc=B((xs[i] + xs[i + 1]) / 2, top_y + 0.1, 0.42), bevel=0.01)

        # ---------------- build pads: dressed stone plinths with a kerb ring
        pad_top = toon("#ddd4c0", spec=0.15)
        pad_kerb = [toon(c, spec=0.1) for c in ("#b0aaa0", "#a39d92", "#bdb7ab")]
        for k, (px, py) in enumerate(pads):
            shadow(px, py, 0.72)
            wk.cyl(0.7, 0.06, toon("rock_dk"), loc=B(px, py, 0.03), seg=28, bevel=0.015, outline=0.006)
            for j in range(10):
                aa = j / 10 * math.tau + k
                wk.box((0.36, 0.2, 0.07), pad_kerb[(j + k) % 3], loc=B(px + math.cos(aa) * 0.56, py + math.sin(aa) * 0.56, 0.065),
                       rot=(0, 0, -math.degrees(aa) + 90), bevel=0.025, outline=0.005)
            wk.cyl(0.47, 0.05, pad_top, loc=B(px, py, 0.075), seg=24, bevel=0.012, outline=0.005)
            for j in range(4):  # quartered slabs
                aa = j / 4 * math.tau + 0.4 + k
                wk.box((0.42, 0.018, 0.012), K.flat("#a79e8b"), loc=B(px + math.cos(aa) * 0.24, py + math.sin(aa) * 0.24, 0.103),
                       rot=(0, 0, -math.degrees(aa)), outline=0)
            wk.cyl(0.13, 0.014, K.flat("#b9ae98"), loc=B(px, py, 0.104), seg=16, outline=0)

        # ---------------- scenery
        def tree(kind, x, y, s, i):
            shadow(x, y, 0.42 * s)
            if kind == "pine":
                wk.cyl(0.08 * s, 0.4 * s, toon("trunk"), loc=B(x, y, 0.2 * s))
                for j, (rr, zz) in enumerate(((0.5, 0.38), (0.39, 0.78), (0.27, 1.12))):
                    wk.cone(rr * s, 0.6 * s, toon("foliage" if j % 2 == 0 else "foliage_dk"), loc=B(x, y, zz * s), seg=9)
            else:
                wk.cyl(0.08 * s, 0.5 * s, toon("trunk"), loc=B(x, y, 0.25 * s), r2=0.06 * s)
                for j in range(4):
                    aa = j * 2.1 + i
                    wk.ball(0.3 * s, toon("foliage" if j else "foliage_dk"), loc=B(x + math.cos(aa) * 0.17 * s, y + math.sin(aa) * 0.12 * s,
                                                                                 (0.72 + 0.12 * (j % 2)) * s), subdiv=2)
                wk.ball(0.26 * s, toon("foliage"), loc=B(x, y - 0.05, 0.98 * s), subdiv=2)
                wk.ball(0.14 * s, toon("grass_lt"), loc=B(x - 0.08 * s, y - 0.12 * s, 1.12 * s), scale=(1, 0.9, 0.6), subdiv=2, outline=0.004)

        def rock(x, y, s, i):
            shadow(x, y, 0.3 * s)
            wk.ball(0.3 * s, toon("rock" if i % 3 else "rock_dk"), loc=B(x, y, 0.12 * s), scale=(1.2, 1.0, 0.75), subdiv=1, smooth=False, rot=(0, 0, 37 * i))
            if i % 2:
                wk.ball(0.16 * s, toon("rock_dk"), loc=B(x + 0.26 * s, y + 0.12 * s, 0.06 * s), scale=(1.1, 1, 0.7), subdiv=1, smooth=False)
            wk.ball(0.12 * s, toon("moss"), loc=B(x - 0.05 * s, y - 0.05 * s, 0.3 * s), scale=(1.2, 1, 0.35), subdiv=1, outline=0.004)

        def flowers(x, y, i):
            col = ("#fff4d6", "#ffd84d", "#ff8fa3", "#b9a2ff")[i % 4]
            for j in range(3):
                wk.sphere(0.05, K.toon(col), loc=B(x + 0.1 * math.cos(j * 2.1 + i), y + 0.08 * math.sin(j * 2.1 + i), 0.05), seg=8, rings=5, outline=0.006)

        def bush(x, y, i):
            shadow(x, y, 0.3)
            wk.ball(0.28, toon("foliage_dk" if i % 2 else "foliage"), loc=B(x, y, 0.18), scale=(1.15, 1.05, 0.8), subdiv=2)
            wk.ball(0.14, toon("grass_lt"), loc=B(x - 0.06, y - 0.08, 0.32), scale=(1, 0.9, 0.5), subdiv=2, outline=0.004)

        def fence(x0, y0, x1, y1, i):
            L = math.hypot(x1 - x0, y1 - y0)
            nposts = max(2, int(L / 0.55) + 1)
            wood = K.toon("#9a6a40")
            for j in range(nposts):
                t = j / (nposts - 1)
                wk.cyl(0.045, 0.42, wood, loc=B(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.21), seg=6)
            for zz in (0.2, 0.34):
                wk.rod(B(x0, y0, zz), B(x1, y1, zz), 0.025, K.toon("#b07e4e"), seg=5)

        def free(x, y, r, road_clear):
            return road_d(x, y) > RH + r + road_clear and pad_d(x, y) > 0.95 + r and plaza_d(x, y) > 2.3 + r

        placed = []
        # Short fence runs along the road's outer verge where there is room.
        nf = 0
        for ri, r in enumerate(roads):
            for i in range(16 + ri * 5, len(r) - 20, 7):
                x, y = r[i]
                x2, y2 = r[i + 5]
                dx, dy = x2 - x, y2 - y
                l = math.hypot(dx, dy) or 1
                if abs(dx) < abs(dy) * 0.8:  # a fence running up the screen reads as a single stick; keep to the crossings
                    continue
                for side in (1, -1):
                    off = RH + 0.5
                    ax, ay = x - dy / l * off * side, y + dx / l * off * side
                    bx, by = x2 - dy / l * off * side, y2 + dx / l * off * side
                    ok = all(free(ax + (bx - ax) * t, ay + (by - ay) * t, 0.05, 0.3) and pad_d(ax + (bx - ax) * t, ay + (by - ay) * t) > 1.05
                             for t in (0, 0.25, 0.5, 0.75, 1))
                    ok = ok and -0.3 < ax < Wm + 0.3 and -0.3 < bx < Wm + 0.3
                    if ok:
                        fence(ax, ay, bx, by, nf)
                        placed.extend((ax + (bx - ax) * t, ay + (by - ay) * t, 0.15) for t in (0, 0.25, 0.5, 0.75, 1))
                        nf += 1
                        break

        kinds = th["trees"]
        # Woods: clumps seeded mostly toward the map edges and in the margin; each clump packs a few trees at
        # different sizes so the canopy reads with depth. Trees keep clear of the road and pads, more on the near
        # side, since their crowns rise up the screen toward them: nothing baked ever stands in front of a unit.
        j = 0
        for n in range(900):
            edge = rnd(n, 41)
            if edge < 0.72:
                side = 0 if rnd(n, 42) < 0.5 else 1
                cx = (-MARGIN + rnd(n, 43) * (MARGIN + 2.2)) if side == 0 else (Wm - 2.2 + rnd(n, 43) * (MARGIN + 2.2))
            else:
                cx = rnd(n, 43) * Wm
            cy = -MARGIN + 1.2 + rnd(n, 44) * (Hm + MARGIN * 2 - 1.2)
            for k in range(1 + int(rnd(n, 45) * 4)):
                x = cx + (rnd(n * 7 + k, 46) - 0.5) * 1.6
                y = cy + (rnd(n * 7 + k, 47) - 0.5) * 1.3
                s = 0.8 + rnd(n * 7 + k, 48) * 0.55
                r = 0.42 * s
                if y < -MARGIN + 0.6 or not free(x, y, r, 0.45) or road_d(x, y - 0.9 * s) < RH + 0.2 or pad_d(x, y - 0.9 * s) < 0.85:
                    continue
                if any(math.hypot(px - x, py - y) < (pr + r) * 0.78 for px, py, pr in placed):
                    continue
                placed.append((x, y, r))
                tree(kinds[j % len(kinds)], x, y, s, j)
                j += 1
        ntrees = j
        # Grass tufts over the open meadow.
        for n in range(int(Wm * Hm * 0.35)):
            x, y = -0.5 + rnd(n, 61) * (Wm + 1), rnd(n, 62) * Hm
            if not free(x, y, 0.1, 0.1):
                continue
            for j in range(3):
                wk.cone(0.035, 0.12 + 0.03 * (j % 2), toon("grass_dk" if j % 2 else "grass_lt"), loc=B(x + 0.05 * (j - 1), y + 0.02 * j, 0.05),
                        rot=(12 * (j - 1), 0, 0), seg=5, outline=0.004)
        # Rocks, bushes, flowers and fences in the open grass.
        for n in range(int(Wm * Hm * 0.28)):
            x, y = -0.5 + rnd(n, 51) * (Wm + 1), rnd(n, 52) * Hm
            kind = rnd(n, 53)
            if kind < 0.3:
                if free(x, y, 0.35, 0.25) and not any(math.hypot(px - x, py - y) < pr + 0.35 for px, py, pr in placed):
                    rock(x, y, 0.8 + rnd(n, 54) * 0.6, n)
                    placed.append((x, y, 0.3))
            elif kind < 0.5:
                if free(x, y, 0.3, 0.3) and not any(math.hypot(px - x, py - y) < pr + 0.3 for px, py, pr in placed):
                    bush(x, y, n)
                    placed.append((x, y, 0.3))
            else:
                if free(x, y, 0.12, 0.15):
                    flowers(x, y, n)
        # ---------------- camera: orthographic, sin(el) = SQUASH, framed so ground (x, y) -> ((x+M)P, (y+M)P*SQUASH)
        stage.diorama_view(el=math.degrees(el))
        cam = stage.cam
        d = cam.data
        d.type = "ORTHO"
        d.sensor_fit = "HORIZONTAL"
        rx = int(round((Wm + MARGIN * 2) * PPU))
        ry = int(math.ceil((Hm + MARGIN * 2) * PPU * SQUASH))
        d.ortho_scale = rx / PPU
        d.shift_x = d.shift_y = 0
        d.clip_start, d.clip_end = 0.1, 200.0
        xc = Wm / 2
        yc = (ry / 2) / (PPU * SQUASH) - MARGIN
        back = Vector((0.0, -math.cos(el), math.sin(el)))
        cam.location = Vector(B(xc, yc, 0)) + back * 60
        sc = stage.sc
        sc.render.resolution_x, sc.render.resolution_y = rx * ss, ry * ss
        bpy.context.view_layer.update()
        err = 0.0
        checks = [(0, 0), (Wm, 0), (0, Hm), (Wm, Hm)] + pads[:6]
        for (x, y) in checks:
            p = world_to_camera_view(sc, cam, Vector(B(x, y, 0)))
            fx, fy = (x + MARGIN) * PPU, (y + MARGIN) * PPU * SQUASH
            err = max(err, abs(p.x * rx - fx), abs((1 - p.y) * ry - fy))
        print(f"TD {mid} camera check: max error {err:.3f}px at {rx}x{ry}, {ntrees} trees, {nf} fences, {len(coll.objects)} objects", flush=True)
        sc.render.filepath = os.path.join(BUILD, f"{mid}_raw.png")
        tr = time.time()
        bpy.ops.render.render(write_still=True)
        print(f"TD {mid} rendered in {time.time() - tr:.0f}s", flush=True)
        img = S.read_png(sc.render.filepath)
        img = S.downsample(img, ss)
        img = sunlight(S.grade(img, st, vignette=False))
        img[..., 3] = 1.0
        png = os.path.join(BUILD, f"{mid}.png")
        S.write_png(png, img)

        # ---------------- pixel check: every pad centre reads as pale stone, the road centre as dirt, all on the sim's points
        rgb = np.clip(img[..., :3], 0, 1)

        def px(x, y):
            X, Y = int((x + MARGIN) * PPU), int((y + MARGIN) * PPU * SQUASH)
            return rgb[max(0, min(ry - 1, Y)), max(0, min(rx - 1, X))]

        def is_stone(c):
            return c.max() - c.min() < 0.22 and c.mean() > 0.5 and c[1] < c[0] + 0.03

        def is_dirt(c):
            return c[0] > c[1] > c[2] and c[0] - c[2] > 0.12 and c[0] > 0.55

        pad_ok = sum(1 for (x, y) in pads if is_stone(px(x, y)))
        samples = [(x, y) for r in roads for (x, y) in r[3:-3:3] if plaza_d(x, y) > 1.9]
        road_ok = sum(1 for (x, y) in samples if is_dirt(px(x, y)))
        # Off the road (just past the verge) must not be dirt: the road is no wider than the sim's.
        off = []
        for r in roads:
            for i in range(4, len(r) - 4, 6):
                x, y = r[i]
                dx, dy = r[i + 1][0] - r[i - 1][0], r[i + 1][1] - r[i - 1][1]
                l = math.hypot(dx, dy) or 1
                for side in (-1, 1):
                    ox, oy = x - dy / l * (RH + 0.45) * side, y + dx / l * (RH + 0.45) * side
                    if road_d(ox, oy) > RH + 0.4 and pad_d(ox, oy) > 0.9 and plaza_d(ox, oy) > 2.0:
                        off.append((ox, oy))
        off_ok = sum(1 for (x, y) in off if not is_dirt(px(x, y)))
        print(f"TD {mid} pixel check: pads {pad_ok}/{len(pads)}, road {road_ok}/{len(samples)}, verge {off_ok}/{len(off)}", flush=True)

        # ---------------- slices
        files = []
        bounds = [round(ry * i / SLICES) for i in range(SLICES + 1)]
        for i in range(SLICES):
            y0, y1 = bounds[i], bounds[i + 1]
            sp = os.path.join(BUILD, f"{mid}_{i}.png")
            S.write_png(sp, img[y0:y1].copy())
            fn = f"{mid}_{i}.webp"
            subprocess.run(["cwebp", "-quiet", "-q", "84", sp, "-o", os.path.join(OUT, fn)], check=True)
            files.append({"file": fn, "y": y0, "h": y1 - y0})
        man["maps"][mid] = {
            "w": Wm, "h": Hm, "px": [rx, ry], "slices": files,
            "pads": [[round(x, 3), round(y, 3)] for x, y in pads],
            "roads": [[[round(x, 3), round(y, 3)] for x, y in r[::8]] for r in roads],
            "check": {"camera_px": round(err, 4), "pads": [pad_ok, len(pads)], "road": [road_ok, len(samples)], "verge": [off_ok, len(off)]},
        }
        with open(man_path, "w") as f:
            json.dump(man, f, indent=1)
        print(f"TD {mid} done in {time.time() - t0:.0f}s", flush=True)
    print("TD_DONE", flush=True)


if __name__ == "__main__":
    main()
