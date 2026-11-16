"""Muster title key art: two armies clash in a meadow between their keeps. Original scene, built from the
same unit builders and toon kit as the sprites, so the title matches the game. Tiers 2-3 up front: their team
colours read on the title better than the Ascended white and gold.

    blender -b --factory-startup -P art/ui/title_key.py -- [--res 1206x2622] [--samples 32] [--out path.png]
    npm run art:title        (renders, then writes base/public/ui/title-key.webp with cwebp)

Composition is for a portrait phone (19.5:9): sky + keeps behind the logo (top quarter), the clash in the
band between the logo and the menu (about 30-61% down), meadow under the buttons.
Both team colours appear in one render: the tide army's materials are copied onto a frozen copy of the
TeamColor group before the ember army is built.
"""
import argparse
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
sys.path.insert(0, ART)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from muster_art import kit as K  # noqa: E402
from muster_art.parts import Pal  # noqa: E402
from muster_art.units import REG, spark  # noqa: E402


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--res", default="1206x2622")
    ap.add_argument("--samples", type=int, default=32)
    ap.add_argument("--out", default=os.path.join(HERE, "build", "title_key.png"))
    return ap.parse_args(argv)


def freeze_team(objs, team):
    """Point every material on `objs` at a fixed copy of the TeamColor group set to `team`."""
    src = K.groups()["team"]
    fixed = src.copy()
    fixed.name = f"TeamFixed_{team}"
    for key, hexcol in K.TEAMS[team].items():
        fixed.nodes[key].outputs[0].default_value = K.lin(hexcol)
    done = {}
    for ob in objs:
        mats = ob.data.materials
        for i, m in enumerate(mats):
            if m is None:
                continue
            if not any(n.type == "GROUP" and n.node_tree == src for n in m.node_tree.nodes):
                continue
            if m.name not in done:
                c = m.copy()
                c.name = f"{team}_{len(done)}"
                for n in c.node_tree.nodes:
                    if n.type == "GROUP" and n.node_tree == src:
                        n.node_tree = fixed
                done[m.name] = c
            mats[i] = done[m.name]


def sky_world(top, mid, low):
    w = bpy.context.scene.world
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.45
    cr.elements[0].color = K.lin(low)
    cr.elements[1].position = 1.0
    cr.elements[1].color = K.lin(top)
    e = cr.elements.new(0.7)
    e.color = K.lin(mid)
    nt.links.new(tc.outputs["Window"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs[0])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs[0], out.inputs[0])


def keep(k, P, x, y, s, roof, banner):
    """A round commander keep on a stone plinth, roof and flag in team colour."""
    stone, stone_dk = K.toon("#c9c0b0"), K.toon("#8f877b")
    with k.at((x, y, 0), scale=s):
        k.cyl(1.25, 0.35, stone_dk, loc=(0, 0, 0.0), seg=24, bevel=0.04)
        k.cyl(0.95, 1.9, stone, loc=(0, 0, 0.35), r2=0.86, seg=24)
        # stone courses
        for z in (0.8, 1.3, 1.8):
            k.torus(0.93 - (z - 0.35) * 0.045, 0.035, stone_dk, loc=(0, 0, z), seg=32, rseg=6, outline=0)
        k.cyl(1.05, 0.22, stone_dk, loc=(0, 0, 2.2), seg=24, bevel=0.03)
        for i in range(10):
            a = 2 * math.pi * i / 10
            k.box((0.26, 0.2, 0.26), stone, loc=(math.cos(a) * 0.92, math.sin(a) * 0.92, 2.53), rot=(0, 0, math.degrees(a)), bevel=0.03)
        k.cone(0.78, 1.3, roof, loc=(0, 0, 2.42), seg=16)
        k.ball(0.11, P.gold, loc=(0, 0, 3.75))
        k.rod((0, 0, 3.7), (0, 0, 4.5), 0.03, P.wood_dk)
        k.sheet([(0.02, 0, 4.45), (0.75, -0.1, 4.33), (0.62, -0.05, 4.13), (0.02, 0, 4.08)], banner, thick=0.03)
        # door and windows
        k.box((0.08, 0.5, 0.75), P.wood_dk, loc=(0, -0.9, 0.72), rot=(0, 0, 90), bevel=0.05)
        k.torus(0.25, 0.04, P.iron_dk, loc=(0, -0.95, 1.08), rot=(90, 0, 0), arc=180, seg=16, outline=0)
        for a in (-55, 55):
            r = math.radians(a - 90)
            k.box((0.1, 0.16, 0.34), P.darker, loc=(math.cos(r) * 0.88, math.sin(r) * 0.88, 1.55), rot=(0, 0, a), outline=0)


def tree(k, x, y, s, rnd):
    leaf = [K.toon("#5fae47"), K.toon("#4c9a3d"), K.toon("#6cbc4f")]
    trunk = K.toon("#7a5232")
    with k.at((x, y, 0), scale=s):
        k.cyl(0.09, 0.6, trunk, loc=(0, 0, 0), r2=0.06, seg=8)
        for i in range(3):
            a = rnd.uniform(0, 6.28)
            k.ball(0.42 - i * 0.07, leaf[i % 3], loc=(math.cos(a) * 0.12, math.sin(a) * 0.12, 0.7 + i * 0.28), scale=(1, 1, 0.9))


def pine(k, x, y, s):
    g1, g2 = K.toon("#3f8c4a"), K.toon("#357a40")
    with k.at((x, y, 0), scale=s):
        k.cyl(0.07, 0.35, K.toon("#6b4628"), seg=8)
        for i, (r, z) in enumerate(((0.5, 0.3), (0.4, 0.65), (0.28, 0.98))):
            k.cone(r, 0.62, g1 if i % 2 == 0 else g2, loc=(0, 0, z), seg=10)


def rock(k, x, y, s, rot):
    k.ball(0.3, K.toon("#a8a196"), loc=(x, y, 0.06 * s), scale=(s * 1.2, s, s * 0.7), rot=(0, 0, rot), subdiv=1, smooth=False)


def cloud(k, x, y, z, s):
    white, shade = K.flat("#fffaf0"), K.flat("#e3ecf5")
    with k.at((x, y, z), scale=s):
        k.ball(0.9, shade, loc=(0, 0.2, -0.25), scale=(2.4, 1, 0.55), outline=0)
        for dx, dz, r in ((-1.0, 0.0, 0.7), (-0.2, 0.35, 0.95), (0.8, 0.1, 0.75), (1.6, -0.1, 0.5)):
            k.ball(r, white, loc=(dx, 0, dz), outline=0)


def path(k, pts, w, mat, z=0.004):
    """A flat ribbon along a polyline (dirt road)."""
    import bmesh
    bm = bmesh.new()
    pts = [Vector(p) for p in K.catmull([Vector((x, y, 0)) for x, y in pts], n=8)]
    left, right = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        nrm = Vector((-d.y, d.x, 0))
        ww = w(i / (len(pts) - 1)) if callable(w) else w
        left.append(bm.verts.new((p + nrm * ww).to_tuple()[:2] + (z,)))
        right.append(bm.verts.new((p - nrm * ww).to_tuple()[:2] + (z,)))
    for i in range(len(pts) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    k._emit(bm, mat, smooth=False, outline=0, name="path")


def main():
    a = args()
    rx, ry = (int(v) for v in a.res.split("x"))
    st = K.Stage(samples=a.samples)
    sc = st.sc
    sc.render.film_transparent = False
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    sky_world("#5fb4ee", "#a5d8f5", "#fbf0d2")

    # perspective camera, a little above the armies, looking down the field
    cam = st.cam
    cam.data.type = "PERSP"
    cam.data.lens = 26
    cam.data.sensor_fit = "VERTICAL"
    cam.data.sensor_height = 36
    cam.data.clip_end = 400
    cam.location = (0.0, -4.0, 2.1)
    # Frame raised over the scene (content sits ~5% lower): the keep flags and harriers clear the logo ribbon and
    # the clash fills the band down to the menu, with open sky behind the logo.
    cam.data.shift_y = 0.05
    pitch = math.radians(18.0)
    cam.rotation_euler = Vector((0.0, math.cos(pitch), -math.sin(pitch))).to_track_quat("-Z", "Y").to_euler()
    # sun from the upper left, in front of the scene
    K.set_light((-0.5, -0.6, 0.8))
    K.set_team("tide")

    P = Pal()
    rnd = random.Random(7)

    # ---- the tide army, left, charging right
    kt = K.Kit(outline=0.016)
    # world coordinates: a hero duel up front, the big hitters behind it, the lines marching from the keeps
    tide = [
        ("bulwark", 3, "idle", -0.65, 7.6, -14, 1.15),
        ("banner", 3, "idle", -1.7, 7.0, -24, 1.25),
        ("ranger", 3, "attack", -2.15, 5.3, -26, 1.25),
        ("pikeman", 3, "attack", -0.95, 5.7, -12, 1.25),
        ("golem", 3, "attack", -1.8, 3.7, -26, 1.1),
        ("blades", 2, "attack", -0.5, 1.0, -30, 1.5),
    ]
    for kind, tier, pose, x, y, yaw, s in tide:
        with kt.at((x, y, 0), rot=(0, 0, yaw), scale=s):
            REG[kind]["build"](kt, P, tier, pose)
    with kt.at((-1.9, 6.2, 2.5), rot=(0, 0, -20), scale=1.0):
        REG["harrier"]["build"](kt, P, 3, "attack")
    freeze_team(kt.objs, "tide")

    # ---- the ember army, right, charging left (builders face +X, so yaw 180)
    K.set_team("ember")
    ke = K.Kit(outline=0.016)
    ember = [
        ("shade", 3, "idle", 0.6, 7.7, 194, 1.2),
        ("bulwark", 3, "idle", 1.6, 7.0, 200, 1.15),
        ("storm", 3, "attack", 2.25, 5.3, 206, 1.25),
        ("grenadier", 3, "attack", 1.0, 5.7, 200, 1.25),
        ("ravager", 3, "attack", 1.85, 3.5, 205, 1.25),
        ("duelist", 2, "attack", 0.5, 1.0, 210, 1.5),
    ]
    for kind, tier, pose, x, y, yaw, s in ember:
        with ke.at((x, y, 0), rot=(0, 0, yaw), scale=s):
            REG[kind]["build"](ke, P, tier, pose)
    with ke.at((2.0, 6.6, 2.7), rot=(0, 0, 200), scale=1.0):
        REG["harrier"]["build"](ke, P, 3, "attack")

    # ---- the world (team-free materials, so it can share the ember pass)
    k = K.Kit(outline=0.03)
    grass, grass_dk, grass_lt = K.toon("#7cc456"), K.toon("#5fa845"), K.toon("#97d46a")
    k.cyl(60, 0.1, grass, loc=(0, 20, -0.1), seg=48, outline=0)
    # rolling hills on the horizon, back to front
    for x, y, r, sz, m in ((-16, 44, 15, 0.32, grass_dk), (14, 46, 17, 0.3, grass_dk), (-4, 52, 20, 0.28, K.toon("#6aa57a")),
                           (-9, 30, 9, 0.28, grass_lt), (10, 31, 9.5, 0.26, grass_lt), (0, 26, 8, 0.18, grass)):
        k.ball(r, m, loc=(x, y, -r * sz * 0.35), scale=(1, 0.6, sz), outline=0)
    # dirt road from the foreground, splitting to each keep
    dirt, dirt_dk = K.toon("#e2c58f"), K.toon("#c9a46a")
    path(k, [(0.1, -6), (0.0, -2), (0.15, 2), (-0.2, 6.5), (-2.2, 9.5), (-3.7, 11.6)], lambda u: 0.85 - 0.4 * u, dirt)
    path(k, [(-0.2, 6.5), (1.9, 9.4), (3.7, 11.6)], lambda u: 0.55 - 0.1 * u, dirt)
    path(k, [(0.1, -6), (0.0, -2), (0.15, 2), (-0.2, 6.5)], lambda u: 1.0 - 0.25 * u, dirt_dk, z=0.002)
    # the two keeps, on little hills
    k.ball(2.6, grass_lt, loc=(-3.9, 12.6, -0.8), scale=(1, 0.8, 0.42), outline=0)
    k.ball(2.6, grass_lt, loc=(3.9, 12.6, -0.8), scale=(1, 0.8, 0.42), outline=0)
    keep(k, P, -3.9, 12.6, 1.0, K.toon("#2aa7a5"), K.toon("#3fd0c9"))
    keep(k, P, 3.9, 12.6, 1.0, K.toon("#d24c33"), K.toon("#ff6a4d"))
    # trees, framing the field
    for x, y, s in ((-4.6, 7.5, 1.0), (-6.2, 10.0, 1.3), (-1.6, 16, 1.2), (4.9, 8.0, 1.1), (6.4, 10.5, 1.3), (1.4, 17.5, 1.1),
                    (-9, 17, 1.8), (9.5, 18, 1.8), (-0.2, 21, 1.1), (-5.6, 15.5, 1.4), (5.8, 15.0, 1.4)):
        tree(k, x, y, s, rnd)
    for x, y, s in ((-7.5, 13, 1.7), (7.8, 13.5, 1.8), (-11.5, 22, 2.4), (12.0, 24, 2.4), (-4.5, 21, 1.5), (4.8, 22, 1.6)):
        pine(k, x, y, s)
    # foreground framing, under the menu
    tree(k, -2.5, 0.2, 1.1, rnd)
    tree(k, 2.7, -0.3, 1.2, rnd)
    for x, y, s, r in ((-1.5, -0.8, 0.6, 20), (1.6, -1.2, 0.5, 80), (-1.6, 8.6, 0.6, 40), (2.4, 7.6, 0.6, 10), (-2.6, 5.6, 0.6, 60),
                       (1.1, -2.0, 0.55, 30), (-0.9, -2.4, 0.5, 70)):
        rock(k, x, y, s, r)
    # pebbles along the road
    peb = K.toon("#b8ad9a")
    for _ in range(36):
        y = rnd.uniform(-2.5, 6.0)
        side = rnd.choice((-1, 1))
        x = side * rnd.uniform(0.75, 1.05) * (0.85 - 0.4 * max(0.0, min(1.0, (y + 6) / 12.5)) + 0.15)
        k.ball(rnd.uniform(0.025, 0.045), peb, loc=(x, y, 0.02), scale=(1.3, 1, 0.6), rot=(0, 0, rnd.uniform(0, 180)), subdiv=1, smooth=False, outline=0.008)
    tuft = K.toon("#5a9e3c")
    for _ in range(80):
        x, y = rnd.uniform(-4, 4), rnd.uniform(-3, 10)
        if abs(x - (-0.2 if y > 6.5 else 0.1)) < 1.3:
            continue
        for j in range(3):
            k.cone(0.04, rnd.uniform(0.14, 0.24), tuft, loc=(x + j * 0.05, y + (j % 2) * 0.04, 0), rot=(rnd.uniform(-20, 20), rnd.uniform(-20, 20), 0), seg=4, outline=0)
    flowers = [K.flat("#ffffff"), K.flat("#ffd84a"), K.flat("#ff9bb3")]
    for _ in range(60):
        x, y = rnd.uniform(-4.5, 4.5), rnd.uniform(-3, 11)
        if abs(x) < 1.4:
            continue
        k.ball(0.045, flowers[rnd.randrange(3)], loc=(x, y, 0.05), outline=0, subdiv=1)
    # clash dust and sparks in the middle
    dust = K.flat("#fff6e0", alpha=0.7)
    for x, y, z, r in ((0.0, 1.0, 0.08, 0.22), (-0.55, 0.75, 0.06, 0.16), (0.6, 0.8, 0.06, 0.17), (-1.3, 3.4, 0.06, 0.2), (1.35, 3.2, 0.06, 0.2)):
        k.ball(r, dust, loc=(x, y, z), scale=(1.4, 1, 0.6), outline=0)
    spark(k, P, (0.0, 0.95, 0.95), r=0.2)
    spark(k, P, (0.0, 3.5, 0.9), r=0.15)
    # clouds
    for x, y, z, s in ((-9, 60, 14, 2.6), (8, 62, 18, 3.0), (-2, 70, 24, 3.4), (14, 58, 9, 2.2), (-15, 64, 22, 3.0)):
        cloud(k, x, y, z, s)

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    sc.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
    print(f"TITLE_KEY_OK {a.out} {rx}x{ry}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)
