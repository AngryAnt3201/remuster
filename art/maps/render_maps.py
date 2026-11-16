"""Illustrated campaign maps: one Blender diorama per act, seen from the 3/4 battle camera.

    blender -b --factory-startup -P art/maps/render_maps.py -- [--only 0,3] [--style meadow|dusk|toy] [--samples 32]
    npm run art:maps

Writes base/public/maps/<id>.jpg (840x1848, phone portrait) for every act in art/maps/acts.py and
base/src/ui/mapdata.ts with each act's road projected into image fractions, so the app can lay level nodes
exactly on the painted road for any number of levels. The style direction (art/style/active.json once the
style item lands, else Sunlit Meadow) sets ink, line weight, cel bands, shadow tint and the overall mood.
"""
import argparse
import json
import math
import os
import random
import sys

import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
ROOT = os.path.dirname(ART)
sys.path.insert(0, ART)
sys.path.insert(0, HERE)

from muster_art import kit as K  # noqa: E402
from acts import ACTS  # noqa: E402

IMG_W, IMG_H = 840, 1848
ASPECT = IMG_H / IMG_W
VIEW_W = 9.6                      # world units across the image
EL = math.radians(55.0)           # the battle camera's ground elevation (art/style/contract.json)
SIN, COS = math.sin(EL), math.cos(EL)

# Sunlit Meadow, used when art/style/ is not on this branch yet.
DEFAULT_STYLE = {
    "id": "meadow",
    "outline": {"props": 0.016, "color": "#2b1d14"},
    "shading": {"bands": [[0.0, 0.6], [0.3, 0.6], [0.37, 0.84], [0.66, 0.84], [0.73, 1.0], [1.0, 1.0]],
                "shadow_tint": "#6c5fb8", "shadow_tint_amount": 0.38},
    "light": {"key": [0, -0.4, 1.0]},
    "team": {"tide": {"main": "#3fd0c9", "dark": "#167c7a"}, "ember": {"main": "#ff6a4d", "dark": "#a8331f"}},
    "shadow": {"color": "#24361c", "alpha": 0.38},
}
# How a direction re-lights the acts: value scale, tint colour, tint amount, lanterns lit.
MOODS = {
    "meadow": (1.0, "#ffffff", 0.0, False),
    "dusk": (0.62, "#5872b8", 0.30, True),
    "toy": (1.0, "#fff4fa", 0.22, False),
}


def load_style(name):
    sd = os.path.join(ART, "style")
    if not os.path.isdir(sd):
        return DEFAULT_STYLE
    if not name or name == "active":
        name = os.environ.get("MUSTER_STYLE")
        if not name:
            try:
                with open(os.path.join(sd, "active.json")) as f:
                    name = json.load(f)["direction"]
            except OSError:
                return DEFAULT_STYLE
    p = os.path.join(sd, f"{name}.json")
    if not os.path.exists(p):
        return DEFAULT_STYLE
    with open(p) as f:
        return json.load(f)


# ------------------------------------------------------------------ colour
def rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]


def hexs(c):
    return "#" + "".join(f"{max(0, min(255, round(v * 255))):02x}" for v in c)


MOOD = MOODS["meadow"]


def C(h):
    """A colour written for the meadow brightness, moved into the active direction's mood."""
    scale, tint, amt, _ = MOOD
    c, t = rgb(h), rgb(tint)
    if MOOD is MOODS["toy"]:
        return hexs([v * (1 - amt) + t[i] * amt for i, v in enumerate(c)])
    return hexs([v * scale * (1 - amt + t[i] * amt * 1.6) for i, v in enumerate(c)])


def lin3(h):
    return K.lin(h)[:3]


# ------------------------------------------------------------------ materials
_MAT = {}
_GROUP = {}


def toon_group(style, name="g", flat=False):
    if name in _GROUP:
        return _GROUP[name]
    g = bpy.data.node_groups.new("MapToon_" + name, "ShaderNodeTree")
    g.interface.new_socket("Color", in_out="INPUT", socket_type="NodeSocketColor")
    g.interface.new_socket("Color", in_out="OUTPUT", socket_type="NodeSocketColor")
    gi, go = g.nodes.new("NodeGroupInput"), g.nodes.new("NodeGroupOutput")
    geo = g.nodes.new("ShaderNodeNewGeometry")
    key = Vector(style.get("light", {}).get("key", [0, -0.4, 1.0]))
    key.x -= 0.55                       # light from the upper left so hills and props model
    if flat:                            # ground: mostly overhead, so only real slopes drop a band
        key = Vector((key.x * 0.45, key.y * 0.45, key.z * 1.4))
    key.normalize()
    L = g.nodes.new("ShaderNodeCombineXYZ")
    for i in range(3):
        L.inputs[i].default_value = key[i]
    dot = g.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    g.links.new(geo.outputs["Normal"], dot.inputs[0])
    g.links.new(L.outputs[0], dot.inputs[1])
    ramp = g.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "LINEAR"
    bands = style["shading"]["bands"]
    cr.elements[0].position, cr.elements[0].color = bands[0][0], (bands[0][1] ** 2.2,) * 3 + (1,)
    cr.elements[1].position, cr.elements[1].color = bands[-1][0], (bands[-1][1] ** 2.2,) * 3 + (1,)
    for p, v in bands[1:-1]:
        e = cr.elements.new(p)
        e.color = (v ** 2.2,) * 3 + (1,)
    g.links.new(dot.outputs["Value"], ramp.inputs[0])
    shaded = g.nodes.new("ShaderNodeVectorMath")
    shaded.operation = "MULTIPLY"
    g.links.new(gi.outputs["Color"], shaded.inputs[0])
    g.links.new(ramp.outputs["Color"], shaded.inputs[1])
    # shadow tint: shaded * (1 + fac * (tint - 1)), fac rising as the band darkens
    bw = g.nodes.new("ShaderNodeRGBToBW")
    g.links.new(ramp.outputs["Color"], bw.inputs[0])
    mr = g.nodes.new("ShaderNodeMapRange")
    mr.clamp = True
    vmin = min(v for _, v in bands) ** 2.2
    mr.inputs["From Min"].default_value = vmin
    mr.inputs["From Max"].default_value = 1.0
    mr.inputs["To Min"].default_value = style["shading"].get("shadow_tint_amount", 0.3)
    mr.inputs["To Max"].default_value = 0.0
    g.links.new(bw.outputs[0], mr.inputs["Value"])
    tint = lin3(style["shading"].get("shadow_tint", "#6c5fb8"))
    sc = g.nodes.new("ShaderNodeVectorMath")
    sc.operation = "SCALE"
    sc.inputs[0].default_value = (tint[0] - 1, tint[1] - 1, tint[2] - 1)
    g.links.new(mr.outputs[0], sc.inputs["Scale"])
    one = g.nodes.new("ShaderNodeVectorMath")
    one.operation = "ADD"
    g.links.new(sc.outputs[0], one.inputs[0])
    one.inputs[1].default_value = (1, 1, 1)
    out = g.nodes.new("ShaderNodeVectorMath")
    out.operation = "MULTIPLY"
    g.links.new(shaded.outputs[0], out.inputs[0])
    g.links.new(one.outputs[0], out.inputs[1])
    g.links.new(out.outputs[0], go.inputs[0])
    _GROUP[name] = g
    return g


def _mat(name):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return m, nt, nt.nodes.new("ShaderNodeOutputMaterial")


def toon(h, raw=False):
    """Cel-shaded colour. raw=True skips the mood shift (team colours stay true)."""
    col = h if raw else C(h)
    key = ("t", col)
    if key in _MAT:
        return _MAT[key]
    m, nt, out = _mat(f"map_t_{col[1:]}")
    rg = nt.nodes.new("ShaderNodeRGB")
    rg.outputs[0].default_value = K.lin(col)
    tg = nt.nodes.new("ShaderNodeGroup")
    tg.node_tree = _GROUP["g"]
    nt.links.new(rg.outputs[0], tg.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(tg.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    _MAT[key] = m
    return m


def glow(h, strength=1.0):
    key = ("g", h, strength)
    if key in _MAT:
        return _MAT[key]
    m, nt, out = _mat(f"map_g_{h[1:]}_{int(strength * 100)}")
    rg = nt.nodes.new("ShaderNodeRGB")
    rg.outputs[0].default_value = K.lin(h)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    nt.links.new(rg.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    _MAT[key] = m
    return m


def light_or(h_on, h_off):
    """Windows, lanterns and fires: lit in dusk, a plain colour otherwise."""
    return glow(h_on, 1.4) if MOOD[3] else toon(h_off)


def shade(h, alpha):
    key = ("s", h, alpha)
    if key in _MAT:
        return _MAT[key]
    m, nt, out = _mat(f"map_s_{h[1:]}_{int(alpha * 100)}")
    rg = nt.nodes.new("ShaderNodeRGB")
    rg.outputs[0].default_value = K.lin(h)
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(rg.outputs[0], em.inputs["Color"])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mx = nt.nodes.new("ShaderNodeMixShader")
    mx.inputs[0].default_value = alpha
    nt.links.new(tr.outputs[0], mx.inputs[1])
    nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    _MAT[key] = m
    return m


def patches(cols, scale, name, detail=2.0, relief=False):
    """Ground: three cel colours in soft noise patches, then the toon light."""
    key = ("p", tuple(cols), scale, name)
    if key in _MAT:
        return _MAT[key]
    m, nt, out = _mat(f"map_p_{name}")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"
    a, b, c = (C(x) for x in cols)
    cr.elements[0].position, cr.elements[0].color = 0.0, K.lin(b)
    cr.elements[1].position, cr.elements[1].color = 0.42, K.lin(a)
    e = cr.elements.new(0.62)
    e.color = K.lin(c)
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0])
    tg = nt.nodes.new("ShaderNodeGroup")
    tg.node_tree = _GROUP["g" if relief else "ground"]
    nt.links.new(ramp.outputs["Color"], tg.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(tg.outputs[0], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    _MAT[key] = m
    return m


# ------------------------------------------------------------------ geometry helpers
def uv_to_ground(u, v):
    """Image fraction (v from the top) to the ground plane (z = 0)."""
    return (u - 0.5) * VIEW_W, (0.5 - v) * VIEW_W * ASPECT / SIN


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def seg_dist(px, py, pts):
    """Distance from every (px, py) to a polyline (numpy)."""
    d = np.full(px.shape, 1e9)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9
        t = np.clip(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1)
        d = np.minimum(d, np.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    return d


class Terrain:
    def __init__(self, act, road, rng):
        self.act, self.road = act, road
        self.waves = []
        for _ in range(9):
            a = rng.uniform(0, math.tau)
            k = rng.uniform(0.25, 0.9)
            self.waves.append((math.cos(a) * k, math.sin(a) * k, rng.uniform(0, math.tau), rng.uniform(0.25, 1.0) / (1 + k)))
        self.amp = sum(w[3] for w in self.waves)
        w = act.get("water")
        self.water = w
        if w and w["kind"] == "river":
            self.river_y = uv_to_ground(0.5, w["v"])[1]
        if w and w["kind"] == "lake":
            self.lake = uv_to_ground(w["u"], w["v"])
        if w and w["kind"] == "ponds":
            self.ponds = [(*uv_to_ground(u, v), r) for u, v, r in w["ponds"]]
        if w and w["kind"] == "coast":
            self.top = road[-1][1]

    def shore(self, y):
        """Saltwind Coast: the cliff line, sea to its left, curling out to a point under the lighthouse at the top."""
        return -2.55 + 0.4 * np.sin(y * 0.8) + 1.7 * smoothstep(self.top - 2.5, self.top + 0.6, y)

    def height(self, x, y):
        a = self.act
        h = np.zeros_like(x)
        for kx, ky, ph, amp in self.waves:
            h += np.sin(x * kx + y * ky + ph) * amp
        h = np.maximum(h * a["hills"] * 0.32, -0.08)
        h += a["edge"] * smoothstep(3.4, 6.6, np.abs(x))
        d = seg_dist(x, y, self.road)
        ends = [self.road[0], self.road[-1]]
        for ex, ey in ends:
            d = np.minimum(d, np.maximum(0, np.hypot(x - ex, y - ey) - 1.2))
        flat = smoothstep(0.55, 2.2, d)
        h = h * flat - 0.02 * (1 - flat)
        if "sky" in a:
            P = a["sky"]["plateau"]
            near = np.minimum(d, np.maximum(0, np.hypot(x - ends[1][0], y - ends[1][1]) - 1.8))
            h = h * 0.3 - 7.0 * smoothstep(P, P + 1.6, near + 0.5 * np.sin(x * 1.7 + y * 0.9))
        if self.water and self.water["kind"] == "river":
            wv = self.river_y + 0.35 * np.sin(x * 0.8)
            dr = np.abs(y - wv)
            hw = self.water["width"] / 2
            h = np.minimum(h, -0.7 + (h + 0.7) * smoothstep(hw - 0.1, hw + 0.7, dr))
        if self.water and self.water["kind"] == "lake":
            lx, ly = self.lake
            dl = np.hypot((x - lx) / 1.25, y - ly)
            r = self.water["r"]
            h = np.minimum(h, -0.5 + (h + 0.5) * smoothstep(r - 0.2, r + 0.6, dl))
        if self.water and self.water["kind"] == "coast":
            h = np.minimum(h, -0.75 + (h + 0.75) * smoothstep(-0.15, 0.35, x - self.shore(y)))
        if self.water and self.water["kind"] == "ponds":
            for px, py, r in self.ponds:
                dl = np.hypot((x - px) / 1.3, y - py) + 0.18 * np.sin(x * 2.3 + y * 1.7)
                h = np.minimum(h, -0.5 + (h + 0.5) * smoothstep(r - 0.2, r + 0.5, dl))
        return h

    def at(self, x, y):
        return float(self.height(np.array([x]), np.array([y]))[0])

    def in_water(self, x, y, pad=0.4):
        if not self.water:
            return False
        if self.at(x, y) < -0.12:
            return True
        if self.water["kind"] == "river":
            return abs(y - (self.river_y + 0.35 * math.sin(x * 0.8))) < self.water["width"] / 2 + pad
        if self.water["kind"] == "coast":
            return x < float(self.shore(np.array(y))) + pad
        if self.water["kind"] == "ponds":
            return any(math.hypot((x - px) / 1.3, y - py) < r + pad for px, py, r in self.ponds)
        lx, ly = self.lake
        return math.hypot((x - lx) / 1.25, y - ly) < self.water["r"] + pad


def build_mesh(name, verts, faces, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def terrain_mesh(T, y0, y1, x0=-7.5, x1=7.5, step=0.085):
    xs = np.arange(x0, x1 + 1e-6, step)
    ys = np.arange(y0, y1 + 1e-6, step)
    X, Y = np.meshgrid(xs, ys)
    Z = T.height(X, Y)
    nx, ny = len(xs), len(ys)
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    i = np.arange(nx - 1)
    j = np.arange(ny - 1)
    I, J = np.meshgrid(i, j)
    a = (J * nx + I).ravel()
    faces = np.stack([a, a + 1, a + nx + 1, a + nx], 1)
    me = bpy.data.meshes.new("terrain")
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", verts.astype(np.float32).ravel())
    me.loops.add(faces.size)
    me.loops.foreach_set("vertex_index", faces.astype(np.int32).ravel())
    me.polygons.add(len(faces))
    me.polygons.foreach_set("loop_start", (np.arange(len(faces)) * 4).astype(np.int32))
    me.update(calc_edges=True)
    me.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=bool))
    ob = bpy.data.objects.new("terrain", me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def ribbon(T, pts, width, z, mat, name):
    verts, faces = [], []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        ax, ay = pts[max(0, i - 1)]
        bx, by = pts[min(n - 1, i + 1)]
        tx, ty = bx - ax, by - ay
        L = math.hypot(tx, ty) or 1
        nx, ny = -ty / L, tx / L
        zz = max(T.at(x, y), -0.02) + z
        verts += [(x + nx * width / 2, y + ny * width / 2, zz), (x - nx * width / 2, y - ny * width / 2, zz)]
        if i:
            b = 2 * i
            faces.append((b - 2, b - 1, b + 1, b))
    ob = build_mesh(name, verts, faces, mat)
    return ob


def disc(k, x, y, z, r, mat, sy=1.0):
    with k.at((x, y, z), scale=(1, sy, 1)):
        k.cyl(r, 0.01, mat, seg=24, outline=0)


# ------------------------------------------------------------------ props
class Props:
    def __init__(self, k, T, style, act, rng):
        self.k, self.T, self.style, self.act, self.rng = k, T, style, act, rng
        sh = style.get("shadow", DEFAULT_STYLE["shadow"])
        self.shadow = shade(sh["color"], sh["alpha"])
        t = style.get("team", DEFAULT_STYLE["team"])
        self.tide, self.tide_dk = t["tide"]["main"], t["tide"]["dark"]
        self.foe, self.foe_dk = t["ember"]["main"], t["ember"]["dark"]

    def shadow_at(self, x, y, r):
        disc(self.k, x, y + 0.04, self.T.at(x, y) + 0.015, r, self.shadow, 0.8)

    # each builder draws at the origin of the current frame, ~1 unit tall
    def tree(self, s=1.0, fol="#5db24b", fol_lt="#7cc85a"):
        k, r = self.k, self.rng
        k.cyl(0.09, 0.55, toon("#8a5a35"), loc=(0, 0, 0.27), r2=0.07, seg=8)
        for (x, y, z, rr, c) in ((0, 0, 0.8, 0.4, fol), (0.22, 0.05, 0.66, 0.3, fol), (-0.2, -0.06, 0.68, 0.3, fol), (0.04, -0.06, 1.05, 0.27, fol_lt)):
            k.ball(rr * r.uniform(0.9, 1.1), toon(c), loc=(x, y, z), subdiv=2)

    def pine(self, s=1.0, col="#3e8b5b", snow=False):
        k = self.k
        k.cyl(0.07, 0.3, toon("#7a4f2f"), loc=(0, 0, 0.15), seg=8)
        for i, (rr, z) in enumerate(((0.42, 0.25), (0.33, 0.58), (0.23, 0.88))):
            k.cone(rr, 0.5, toon(col), loc=(0, 0, z), seg=10)
            if snow:
                k.cone(rr * 0.62, 0.32, toon("#ffffff"), loc=(0, 0, z + 0.2), seg=10, outline=0)

    def deadtree(self, s=1.0):
        k, r = self.k, self.rng
        wood = toon("#4a3a30")
        k.cyl(0.1, 1.0, wood, loc=(0, 0, 0.5), r2=0.04, seg=7)
        for _ in range(3):
            a = r.uniform(0, math.tau)
            z = r.uniform(0.45, 0.8)
            k.rod((0, 0, z), (math.cos(a) * 0.38, math.sin(a) * 0.38, z + 0.32), 0.035, wood, r2=0.012, seg=6)

    def bush(self, s=1.0, col="#58ab48", col2="#74c25a"):
        k, r = self.k, self.rng
        for i in range(3):
            k.ball(r.uniform(0.18, 0.26), toon(col if i else col2), loc=(r.uniform(-0.18, 0.18), r.uniform(-0.08, 0.08), 0.14), subdiv=2)

    def rock(self, s=1.0, col="#b0aaa0", snow=False):
        k, r = self.k, self.rng
        k.ball(0.32, toon(col), loc=(0, 0, 0.12), scale=(r.uniform(0.9, 1.4), r.uniform(0.8, 1.1), r.uniform(0.6, 0.9)), subdiv=1, smooth=False)
        if snow:
            k.ball(0.26, toon("#ffffff"), loc=(0, 0, 0.3), scale=(1.1, 0.9, 0.35), subdiv=1, smooth=False, outline=0)

    def house(self, s=1.0):
        k, r = self.k, self.rng
        k.box((0.8, 0.6, 0.5), toon("#efe2c4"), loc=(0, 0, 0.25), bevel=0.02)
        roof = ["#c8553d", "#b0643a", "#8e5a8a", "#4f7fb3"][r.randrange(4)]
        k.prism([(-0.48, 0), (0.48, 0), (0, 0.42)], 0.74, toon(roof), loc=(0, 0, 0.5), rot=(90, 0, 0))
        k.box((0.16, 0.04, 0.28), toon("#6b4423"), loc=(0, -0.31, 0.14))
        k.box((0.14, 0.04, 0.12), light_or("#ffd98a", "#5a7fa8"), loc=(0.24, -0.31, 0.3))
        k.box((0.12, 0.12, 0.3), toon("#aaa395"), loc=(0.24, 0.12, 0.85))

    def fence(self, s=1.0):
        k = self.k
        w = toon("#b97c45")
        for x in (-0.6, 0, 0.6):
            k.box((0.07, 0.07, 0.36), w, loc=(x, 0, 0.18))
        for z in (0.14, 0.28):
            k.box((1.3, 0.04, 0.05), w, loc=(0, 0, z))

    def wall(self, s=1.0):
        k = self.k
        st = toon("#cfc5b0")
        k.box((1.5, 0.3, 0.42), st, loc=(0, 0, 0.21), bevel=0.02)
        for x in (-0.6, -0.2, 0.2, 0.6):
            k.box((0.22, 0.3, 0.14), st, loc=(x, 0, 0.49))

    def flowers(self, s=1.0):
        k, r = self.k, self.rng
        cols = ["#ffffff", "#ffd166", "#ff8fa3", "#b48cff"]
        c = cols[r.randrange(len(cols))]
        for _ in range(5):
            k.ball(0.045, toon(c), loc=(r.uniform(-0.2, 0.2), r.uniform(-0.12, 0.12), 0.04), subdiv=1, outline=0)

    def haystack(self, s=1.0):
        self.k.ball(0.3, toon("#e9c46a"), loc=(0, 0, 0.1), scale=(1, 1, 1.15), subdiv=2)
        self.k.torus(0.27, 0.035, toon("#b98f3e"), loc=(0, 0, 0.2), seg=16, rseg=5, outline=0)

    def crater(self, s=1.0):
        k = self.k
        disc(k, 0, 0, 0.02, 0.4, toon("#3e3530"))
        k.torus(0.42, 0.07, toon("#6f5f53"), loc=(0, 0, 0.03), seg=16, rseg=6)
        k.ball(0.06, glow("#ff8a3d"), loc=(0.05, 0, 0.05), subdiv=1, outline=0)

    def ember(self, s=1.0):
        self.k.ball(0.04, glow("#ffb347", 1.6), loc=(0, 0, self.rng.uniform(0.3, 1.4)), subdiv=1, outline=0)

    def stump(self, s=1.0):
        self.k.cyl(0.13, 0.18, toon("#5a4334"), loc=(0, 0, 0.09), seg=9)

    def bones(self, s=1.0):
        k = self.k
        b = toon("#f3ead0")
        k.rod((-0.2, -0.05, 0.03), (0.2, 0.05, 0.03), 0.03, b, seg=6)
        k.rod((-0.1, 0.12, 0.03), (0.12, -0.12, 0.03), 0.03, b, seg=6)
        k.ball(0.09, b, loc=(0.24, 0.02, 0.07), subdiv=1)

    def mushroom(self, s=1.0):
        k, r = self.k, self.rng
        k.cyl(0.05, 0.22, toon("#f3ead0"), loc=(0, 0, 0.11), seg=8)
        cap = ["#b48cff", "#5ce0d0", "#ff7a8a"][r.randrange(3)]
        k.sphere(0.17, glow(cap, 0.9) if MOOD[3] else toon(cap), loc=(0, 0, 0.22), scale=(1, 1, 0.6), seg=12, rings=6)

    def log(self, s=1.0):
        k = self.k
        k.cyl(0.11, 0.9, toon("#7a5a3c"), loc=(0, 0, 0.1), rot=(0, 90, 0), seg=10)

    def cart(self, s=1.0):
        k = self.k
        k.box((0.55, 0.36, 0.26), toon("#8a5a35"), loc=(0, 0, 0.26), bevel=0.02)
        for x in (-0.18, 0.18):
            for y in (-0.2, 0.2):
                k.torus(0.1, 0.03, toon("#4f5866"), loc=(x, y, 0.1), rot=(90, 0, 0), seg=12, rseg=5)
        for x in (-0.1, 0.1):
            k.ball(0.11, toon("#5f6878"), loc=(x, 0, 0.42), subdiv=1, smooth=False)

    def crystal(self, s=1.0, col="#bfe9ff", glow_on=False):
        k, r = self.k, self.rng
        m = glow(col, 0.9) if glow_on else toon(col)
        for _ in range(3):
            a = r.uniform(0, math.tau)
            d = r.uniform(0.0, 0.16)
            k.crystal_at((math.cos(a) * d, math.sin(a) * d, 0), (math.cos(a) * (d + 0.15), math.sin(a) * (d + 0.15), r.uniform(0.35, 0.75)), 0.09, m)

    def drift(self, s=1.0):
        self.k.ball(0.4, toon("#ffffff"), loc=(0, 0, 0.0), scale=(1.4, 0.9, 0.35), subdiv=2, outline=0)

    def snowman(self, s=1.0):
        k = self.k
        for z, rr in ((0.16, 0.18), (0.42, 0.13), (0.62, 0.09)):
            k.ball(rr, toon("#ffffff"), loc=(0, 0, z), subdiv=2)
        k.cone(0.03, 0.12, toon("#ff8a3d"), loc=(0, -0.08, 0.62), rot=(90, 0, 0), seg=6)

    def pillar(self, s=1.0):
        k, r = self.k, self.rng
        h = r.choice([1.2, 1.2, 0.8, 0.5])
        st = toon("#f4ead2")
        k.box((0.34, 0.34, 0.1), st, loc=(0, 0, 0.05))
        k.cyl(0.12, h, st, loc=(0, 0, 0.1 + h / 2), seg=12)
        if h > 1:
            k.box((0.32, 0.32, 0.08), toon("#ffcf4d"), loc=(0, 0, 0.14 + h))

    def bush_gold(self, s=1.0):
        self.bush(s, "#e8c45a", "#f6dc84")

    def statue(self, s=1.0):
        k = self.k
        k.box((0.4, 0.4, 0.3), toon("#f4ead2"), loc=(0, 0, 0.15), bevel=0.02)
        k.cyl(0.11, 0.42, toon("#ffcf4d"), loc=(0, 0, 0.51), r2=0.07, seg=10)
        k.ball(0.09, toon("#ffcf4d"), loc=(0, 0, 0.8), subdiv=2)
        k.rod((0.08, 0, 0.62), (0.22, 0, 0.98), 0.025, toon("#ffcf4d"), seg=6)

    def cloudpuff(self, s=1.0):
        k, r = self.k, self.rng
        for _ in range(r.randint(4, 6)):
            k.ball(r.uniform(0.35, 0.6), toon("#ffffff"), loc=(r.uniform(-0.7, 0.7), r.uniform(-0.25, 0.25), r.uniform(0, 0.25)), scale=(1, 0.8, 0.7), subdiv=2)

    def tower(self, s=1.0):
        k = self.k
        k.cyl(0.32, 1.2, toon("#d6ccb6"), loc=(0, 0, 0.6), seg=14)
        k.cone(0.42, 0.6, toon("#5b78a8"), loc=(0, 0, 1.2), seg=14)
        k.box((0.1, 0.04, 0.18), light_or("#ffd98a", "#3a3f4f"), loc=(0, -0.32, 0.8))

    def banner(self, s=1.0, col=None):
        k = self.k
        k.cyl(0.03, 1.1, toon("#6b4423"), loc=(0, 0, 0.55), seg=6)
        k.box((0.04, 0.34, 0.5), toon(col or self.foe, raw=True), loc=(0, 0.18, 0.8))
        k.ball(0.05, toon("#ffcf4d"), loc=(0, 0, 1.12), subdiv=1)

    def willow(self, s=1.0):
        k, r = self.k, self.rng
        k.cyl(0.1, 0.62, toon("#7a5636"), loc=(0, 0, 0.31), r2=0.07, seg=8)
        k.ball(0.5, toon("#6fae4f"), loc=(0, 0, 0.92), scale=(1.0, 0.95, 0.55), subdiv=2)
        k.ball(0.3, toon("#9bcf6c"), loc=(-0.08, -0.08, 1.06), scale=(1.0, 0.9, 0.5), subdiv=2)
        n = 9
        for j in range(n):
            a = j * math.tau / n + r.uniform(-0.2, 0.2)
            k.cone(0.12, r.uniform(0.5, 0.66), toon("#4f8d3e" if j % 2 else "#6fae4f"), loc=(math.cos(a) * 0.42, math.sin(a) * 0.38, 0.6), rot=(180, 0, 0), seg=6)

    def reeds(self, s=1.0):
        k, r = self.k, self.rng
        for j in range(5):
            a = j * 1.3 + r.uniform(0, 1)
            x, y = math.cos(a) * 0.12, math.sin(a) * 0.1
            hh = r.uniform(0.45, 0.65)
            k.cone(0.04, hh, toon("#5d9a45" if j % 2 else "#7cb653"), loc=(x, y, hh / 2), rot=(8 * math.cos(a), 8 * math.sin(a), 0), seg=5)
            if j % 2 == 0:
                k.cyl(0.03, 0.12, toon("#7a4f2f"), loc=(x, y, hh + 0.02), seg=6)

    def lily(self, s=1.0):
        k, r = self.k, self.rng
        for j in range(r.randint(1, 3)):
            k.cyl(r.uniform(0.09, 0.14), 0.01, toon("#5fa84a"), loc=(r.uniform(-0.15, 0.15), r.uniform(-0.1, 0.1), 0.0), seg=12, outline=0.004)
        if r.random() < 0.4:
            k.sphere(0.045, toon("#ff9fc0"), loc=(0, 0, 0.03), seg=8, rings=5, outline=0.004)

    def lanternpost(self, s=1.0):
        k = self.k
        wood = toon("#6b4a32")
        k.rod((0, 0, 0), (0.04, 0, 0.95), 0.045, wood, r2=0.035, seg=7)
        k.rod((0.04, 0, 0.92), (0.3, 0, 0.95), 0.025, wood, seg=6)
        k.box((0.14, 0.14, 0.035), toon("#3a2a20"), loc=(0.3, 0, 0.86))
        k.ball(0.075, glow("#ffcf6b", 1.6), loc=(0.3, 0, 0.78), scale=(1, 1, 1.2), subdiv=2)
        k.box((0.14, 0.14, 0.03), toon("#3a2a20"), loc=(0.3, 0, 0.69))

    def gorse(self, s=1.0):
        k, r = self.k, self.rng
        self.bush(col="#4f7f4a", col2="#5f9058")
        for j in range(7):
            a = j * 0.9 + r.uniform(0, 0.5)
            k.sphere(0.05, toon("#ffd84d"), loc=(math.cos(a) * 0.22, math.sin(a) * 0.12, 0.24 + 0.06 * (j % 2)), seg=8, rings=5, outline=0.004)

    def seastack(self, s=1.0):
        k, r = self.k, self.rng
        k.ball(0.32, toon("#a3abb2"), loc=(0, 0, 0.3), scale=(1.0, 0.9, 1.8), subdiv=1, smooth=False, rot=(0, 0, r.uniform(0, 90)))
        k.ball(0.24, toon("#7fa86a"), loc=(0, 0, 0.82), scale=(1.0, 0.9, 0.35), subdiv=2)
        disc(k, 0, 0, 0.02, 0.48, toon("#eef8fb"), 0.8)

    def ruinpillar(self, s=1.0):
        k, r = self.k, self.rng
        st = toon("#d6bca4")
        k.cyl(0.22, 0.1, toon("#9c827a"), loc=(0, 0, 0.05), seg=10)
        hh = r.uniform(0.4, 1.0)
        k.cyl(0.14, hh, st, loc=(0, 0, 0.1 + hh / 2), seg=10)
        k.cone(0.15, 0.14, toon("#9c827a"), loc=(0.02, 0, 0.1 + hh + 0.02), rot=(0, 25, 0), seg=6)
        if r.random() < 0.5:
            k.cyl(0.13, 0.3, st, loc=(0.32, 0.05, 0.13), rot=(90, 0, r.uniform(0, 180)), seg=10)

    def brazier(self, s=1.0):
        k = self.k
        for j in range(3):
            a = j * math.tau / 3
            k.rod((math.cos(a) * 0.13, math.sin(a) * 0.13, 0), (0, 0, 0.42), 0.02, toon("#3a2a28"), seg=5)
        k.cyl(0.14, 0.09, toon("#4a3a34"), loc=(0, 0, 0.45), r2=0.09, seg=10)
        k.ball(0.11, glow("#ff9a3c", 1.8), loc=(0, 0, 0.55), scale=(1, 1, 1.3), subdiv=2, outline=0.004)

    # ---- landmarks
    def camp(self):
        k, r = self.k, self.rng
        cloth = toon("#ecdcb4")
        for x, y, a in ((-0.55, 0.1, 20), (0.45, 0.35, -15)):
            with k.at((x, y, 0), rot=(0, 0, a)):
                k.cone(0.45, 0.62, cloth, seg=4)
                k.box((0.06, 0.5, 0.06), toon(self.tide, raw=True), loc=(0, 0, 0.62))
        with k.at((0.0, -0.35, 0)):
            for a in (0, 60, 120):
                k.cyl(0.04, 0.4, toon("#734829"), loc=(0, 0, 0.04), rot=(90, 0, a), seg=6)
            k.cone(0.12, 0.3, glow("#ffb347", 1.5), loc=(0, 0, 0.03), seg=8, outline=0)
        with k.at((0.95, -0.1, 0)):
            self.banner(col=self.tide)

    def bridge(self):
        k = self.k
        st, dk = toon("#cbbfa8"), toon("#9b8f7a")
        y0 = self.T.river_y - self.lm[1]
        L = self.T.water["width"] + 1.6
        with k.at((0, y0, 0)):
            k.box((1.1, L, 0.18), st, loc=(0, 0, 0.3), bevel=0.03)
            for side in (-0.5, 0.5):
                k.box((0.12, L, 0.2), dk, loc=(side, 0, 0.48))
                for yy in (-L / 2, L / 2):
                    k.box((0.2, 0.2, 0.34), dk, loc=(side, yy, 0.5))
            k.torus(0.62, 0.12, st, loc=(0, 0, -0.3), rot=(90, 0, 90), seg=20, arc=180)
        with k.at((0, y0 + L / 2 + 0.9, 0)):
            self.gatehouse()

    def gatehouse(self):
        k = self.k
        st = toon("#d9ceb8")
        for x in (-0.9, 0.9):
            k.cyl(0.42, 1.6, st, loc=(x, 0, 0.8), seg=14)
            k.cone(0.55, 0.7, toon(self.foe_dk, raw=True), loc=(x, 0, 1.6), seg=14)
        k.box((1.4, 0.6, 1.1), st, loc=(0, 0, 0.55), bevel=0.03)
        for x in (-0.5, 0, 0.5):
            k.box((0.26, 0.6, 0.2), st, loc=(x, 0, 1.2))
        k.box((0.6, 0.06, 0.7), toon("#3a2a20"), loc=(0, -0.31, 0.35))
        with k.at((0, 0, 1.2)):
            self.banner()

    def crownfort(self):
        k = self.k
        st = toon("#5c5249")
        k.box((2.6, 1.0, 0.9), st, loc=(0, 0.6, 0.45), bevel=0.04)
        for x in (-1.4, 1.4):
            k.cyl(0.5, 1.6, st, loc=(x, 0.6, 0.8), seg=12)
            k.cone(0.6, 0.7, toon(self.foe_dk, raw=True), loc=(x, 0.6, 1.6), seg=12)
        for x in (-0.9, -0.3, 0.3, 0.9):
            k.box((0.3, 1.0, 0.24), st, loc=(x, 0.6, 1.0))
        k.box((0.7, 0.08, 0.7), glow("#ff8a3d", 1.2), loc=(0, 0.08, 0.35))
        gold = toon("#ffcf4d")
        with k.at((0, 0.6, 1.5)):
            k.cyl(0.55, 0.32, gold, loc=(0, 0, 0.16), seg=20)
            for i in range(6):
                a = i * math.tau / 6
                k.cone(0.12, 0.42, gold, loc=(math.cos(a) * 0.48, math.sin(a) * 0.48, 0.3), seg=6)
                k.ball(0.06, toon(self.foe, raw=True), loc=(math.cos(a) * 0.48, math.sin(a) * 0.48, 0.74), subdiv=1)

    def hollowtree(self):
        k = self.k
        bark = toon("#6b4a32")
        k.cyl(1.0, 2.2, bark, loc=(0, 0.6, 1.1), r2=0.7, seg=16)
        for i in range(6):
            a = i * math.tau / 6 + 0.3
            k.rod((math.cos(a) * 0.7, 0.6 + math.sin(a) * 0.7, 0.5), (math.cos(a) * 1.5, 0.6 + math.sin(a) * 1.4, 0.0), 0.2, bark, r2=0.08, seg=8)
        for (x, y, z, rr) in ((0, 0.6, 2.9, 1.3), (-1.0, 0.7, 2.4, 0.9), (1.0, 0.5, 2.5, 0.95), (0.2, 1.0, 3.5, 0.8), (-0.4, 0.2, 2.2, 0.7)):
            k.ball(rr, toon("#3f8a46"), loc=(x, y, z), subdiv=2)
        k.box((0.6, 0.1, 0.9), glow("#ffd98a", 1.2), loc=(0, -0.38, 0.45))
        for x in (-0.6, 0.6):
            k.ball(0.09, glow("#9dfff7", 1.4), loc=(x, -0.4, 1.0), subdiv=1, outline=0)

    def irongate(self):
        k = self.k
        rock = toon("#8b8174")
        for x in (-1.6, 1.6):
            k.ball(1.0, rock, loc=(x, 0.6, 0.9), scale=(0.8, 0.8, 1.6), subdiv=1, smooth=False)
        iron = toon("#4f5866")
        k.box((2.3, 0.3, 0.3), iron, loc=(0, 0.6, 2.0))
        for i in range(7):
            x = -0.9 + i * 0.3
            k.cyl(0.05, 1.9, iron, loc=(x, 0.6, 1.0), seg=8)
        for z in (0.5, 1.2):
            k.box((2.0, 0.08, 0.08), iron, loc=(0, 0.6, z))
        with k.at((1.9, 1.6, 0)):
            k.cyl(0.25, 1.8, toon("#6a5f55"), loc=(0, 0, 0.9), seg=10)
            k.ball(0.3, toon("#8a8590"), loc=(0, 0, 2.1), scale=(1, 1, 0.7), subdiv=2, outline=0)
            k.ball(0.22, toon("#a9a3ad"), loc=(0.2, 0.1, 2.5), scale=(1, 1, 0.7), subdiv=2, outline=0)
            k.box((0.2, 0.06, 0.2), glow("#ff8a3d", 1.3), loc=(0, -0.26, 0.4))

    def castle(self):
        k = self.k
        st = toon("#e2d6c1")
        k.box((2.8, 1.4, 1.1), st, loc=(0, 0.9, 0.55), bevel=0.04)
        for x in (-1.1, -0.55, 0, 0.55, 1.1):
            k.box((0.3, 1.4, 0.24), st, loc=(x, 0.9, 1.22))
        k.box((1.2, 1.0, 1.4), st, loc=(0, 1.1, 1.8), bevel=0.04)
        k.prism([(-0.75, 0), (0.75, 0), (0, 0.7)], 1.1, toon(self.foe_dk, raw=True), loc=(0, 1.1, 2.5), rot=(90, 0, 0))
        for x in (-1.5, 1.5):
            k.cyl(0.42, 1.9, st, loc=(x, 0.5, 0.95), seg=14)
            k.cone(0.55, 0.8, toon(self.foe_dk, raw=True), loc=(x, 0.5, 1.9), seg=14)
        k.box((0.6, 0.06, 0.75), toon("#3a2a20"), loc=(0, 0.18, 0.38))
        for x in (-0.6, 0.6):
            k.box((0.14, 0.06, 0.22), light_or("#ffd98a", "#3a3f4f"), loc=(x, 0.18, 0.8))
        with k.at((0, 1.1, 3.2)):
            self.banner()

    def icecitadel(self):
        k, r = self.k, self.rng
        ice, ice2 = toon("#bfe9ff"), toon("#8fd0f0")
        k.box((2.6, 0.9, 0.7), toon("#d8eef8"), loc=(0, 0.7, 0.35), bevel=0.05)
        for i in range(9):
            x = -1.3 + i * 0.32
            h = 1.0 + 1.8 * math.exp(-(x / 0.8) ** 2) + r.uniform(0, 0.4)
            k.crystal_at((x, 0.8 + r.uniform(-0.2, 0.2), 0.3), (x * 1.05, 0.8, 0.3 + h), 0.22 + 0.1 * math.exp(-(x / 0.8) ** 2), ice if i % 2 else ice2)
        k.box((0.55, 0.08, 0.6), glow("#e2f6ff", 1.1) if MOOD[3] else toon("#5a8fb8"), loc=(0, 0.24, 0.3))

    def throne(self):
        k = self.k
        st, gold = toon("#f4ead2"), toon("#ffcf4d")
        for i, (rr, z) in enumerate(((1.6, 0.1), (1.25, 0.3), (0.9, 0.5))):
            k.cyl(rr, 0.2, st, loc=(0, 0.7, z), seg=24)
        k.box((0.8, 0.6, 0.35), gold, loc=(0, 0.75, 0.78), bevel=0.04)
        k.box((0.8, 0.18, 1.3), gold, loc=(0, 1.0, 1.3), bevel=0.04)
        k.box((0.5, 0.06, 0.8), toon(self.foe_dk, raw=True), loc=(0, 0.9, 1.25))
        k.torus(0.55, 0.06, glow("#fff1c2", 1.3), loc=(0, 1.05, 2.25), rot=(90, 0, 0), seg=24, rseg=6)
        for i in range(6):
            a = math.pi * (0.1 + 0.8 * i / 5)
            with k.at((math.cos(a) * 1.9, 0.7 + math.sin(a) * 0.9, 0)):
                k.cyl(0.13, 1.6, st, loc=(0, 0, 0.8), seg=12)
                k.box((0.34, 0.34, 0.1), gold, loc=(0, 0, 1.65))


    def lanternhall(self):
        """Mother Wick's hall: a long wooden house on stilts over the water, a lantern tower and strung lanterns."""
        k = self.k
        wood, dk, roof = toon("#c99a62"), toon("#8a6440"), toon(self.foe_dk, raw=True)
        lamp = glow("#ffcf6b", 1.6)
        with k.at((0, 0.8, 0)):
            for x in (-1.2, -0.4, 0.4, 1.2):  # stilts
                for y in (-0.5, 0.5):
                    k.cyl(0.08, 0.6, dk, loc=(x, y, 0.3), seg=8)
            k.box((2.9, 1.4, 0.12), wood, loc=(0, 0, 0.62), bevel=0.02)
            k.box((2.2, 1.0, 0.8), toon("#e8d2a8"), loc=(0, 0.05, 1.08), bevel=0.03)
            k.prism([(-0.72, 0), (0.72, 0), (0, 0.8)], 2.5, roof, loc=(0, 0.05, 1.48), rot=(90, 0, 90))
            k.box((0.42, 0.06, 0.55), toon("#3a2a20"), loc=(0, -0.47, 0.98))
            for x in (-0.7, 0.7):
                k.box((0.26, 0.06, 0.24), lamp, loc=(x, -0.47, 1.18))
            k.box((0.5, 0.5, 0.06), wood, loc=(0, -0.95, 0.45))  # steps
            k.box((0.5, 0.4, 0.06), wood, loc=(0, -1.25, 0.25))
        with k.at((1.75, 0.5, 0)):  # the lantern tower
            k.cyl(0.26, 2.3, dk, loc=(0, 0, 1.15), r2=0.18, seg=8)
            k.box((0.62, 0.62, 0.08), wood, loc=(0, 0, 2.32))
            for x in (-0.24, 0.24):
                for y in (-0.24, 0.24):
                    k.cyl(0.035, 0.42, dk, loc=(x, y, 2.55), seg=6)
            k.ball(0.26, lamp, loc=(0, 0, 2.58), subdiv=2)
            k.cone(0.48, 0.45, roof, loc=(0, 0, 2.95), seg=4, rot=(0, 0, 45))
            with k.at((0, 0, 3.2)):
                self.banner()
        for i in range(5):  # strung lanterns from the hall to the tower
            t = i / 4
            x, z = -1.3 + t * 3.0, 2.15 - 0.35 * math.sin(t * math.pi)
            k.ball(0.07, lamp, loc=(x, 0.25, z), subdiv=1, outline=0.004)

    def lighthouse(self):
        """The Saltwind light on the point: a red-banded tower, the lamp lit and the keeper's cottage."""
        k = self.k
        white, red, dk = toon("#f4f0e6"), toon("#d8463a"), toon("#2e3a44")
        k.cyl(0.62, 0.22, toon("#a3abb2"), loc=(0, 0.8, 0.11), seg=16)
        k.cyl(0.42, 2.5, white, loc=(0, 0.8, 1.47), r2=0.28, seg=16)
        for z in (0.75, 1.5, 2.25):
            rr = 0.42 - 0.14 * (z - 0.22) / 2.5
            k.cyl(rr + 0.012, 0.28, red, loc=(0, 0.8, z), seg=16)
        k.cyl(0.4, 0.07, dk, loc=(0, 0.8, 2.76), seg=16)
        k.cyl(0.22, 0.34, glow("#ffe08a", 2.0), loc=(0, 0.8, 2.97), seg=12)
        k.cone(0.3, 0.3, red, loc=(0, 0.8, 3.28), seg=12)
        with k.at((1.1, 0.5, 0)):  # the keeper's cottage
            k.box((0.8, 0.55, 0.45), white, loc=(0, 0, 0.22), bevel=0.02)
            k.prism([(-0.48, 0), (0.48, 0), (0, 0.36)], 0.66, red, loc=(0, 0, 0.45), rot=(90, 0, 0))
            k.box((0.13, 0.04, 0.12), light_or("#ffd98a", "#5a7fa8"), loc=(0.2, -0.28, 0.27))
        with k.at((-0.6, 0.2, 0)):
            self.banner(col=self.foe)

    def ruinedcitadel(self):
        """Crownfall Citadel: the broken high keep at dusk, one tower snapped, the gate arch cracked, braziers lit."""
        k, r = self.k, self.rng
        st, dk = toon("#d6bca4"), toon("#9c827a")
        roof = toon(self.foe_dk, raw=True)
        k.box((2.9, 1.4, 1.0), st, loc=(0, 0.9, 0.5), bevel=0.04)
        for i, x in enumerate((-1.15, -0.6, 0.0, 0.6, 1.15)):
            if i != 3:
                k.box((0.3, 1.4, 0.22 + 0.1 * (i % 2)), st, loc=(x, 0.9, 1.12))
        k.ball(0.35, dk, loc=(0.6, 0.2, 0.15), scale=(1.4, 1.0, 0.6), subdiv=1, smooth=False)  # the breach's rubble
        k.box((1.2, 1.0, 1.5), st, loc=(-0.1, 1.15, 1.75), bevel=0.04)
        k.prism([(-0.75, 0), (0.45, 0), (-0.2, 0.55)], 1.1, roof, loc=(-0.1, 1.15, 2.5), rot=(90, 0, 0))  # a roof half fallen
        k.cyl(0.42, 2.2, st, loc=(-1.55, 0.5, 1.1), seg=14)
        k.cone(0.55, 0.8, roof, loc=(-1.55, 0.5, 2.2), seg=14)
        k.cyl(0.42, 1.2, st, loc=(1.55, 0.5, 0.6), seg=14)  # the snapped tower
        k.cone(0.44, 0.35, dk, loc=(1.6, 0.5, 1.3), rot=(0, 28, 0), seg=7)
        k.box((0.6, 0.06, 0.75), toon("#3a2a20"), loc=(0, 0.18, 0.38))
        k.box((0.14, 0.06, 0.22), light_or("#ffb04d", "#3a3f4f"), loc=(-0.6, 0.18, 0.75))
        gold = toon("#e0b050")
        k.torus(0.2, 0.045, gold, loc=(0.95, -0.35, 0.06), rot=(70, 0, 20), seg=20, rseg=6)  # the fallen crown
        for x in (-0.95, 0.95):
            with k.at((x, -0.25, 0)):
                self.brazier()
        with k.at((-0.1, 1.15, 3.0)):
            self.banner()


SCALE = {"tree": (1.0, 1.35), "pine": (1.0, 1.4), "snowpine": (1.0, 1.4), "deadtree": (0.9, 1.3), "bush": (0.8, 1.2),
         "bush_gold": (0.8, 1.2), "rock": (0.8, 1.4), "rock_snow": (0.8, 1.4), "boulder": (1.8, 2.6), "house": (1.0, 1.2),
         "fence": (0.9, 1.0), "wall": (0.9, 1.0), "flowers": (0.9, 1.3), "haystack": (0.9, 1.2), "crater": (0.9, 1.4),
         "ember": (1, 1), "stump": (0.9, 1.3), "bones": (0.9, 1.1), "mushroom": (0.9, 1.6), "log": (0.8, 1.1), "cart": (1.0, 1.1),
         "crystal": (1.0, 1.6), "crystal_iron": (0.9, 1.3), "crystal_gold": (0.9, 1.4), "drift": (0.8, 1.5), "snowman": (1, 1.1),
         "pillar": (1, 1.1), "statue": (1, 1.2), "cloudpuff": (1.0, 1.8), "tower": (1.0, 1.1), "banner": (1, 1),
         "willow": (1.0, 1.4), "reeds": (0.8, 1.3), "lily": (0.9, 1.3), "lanternpost": (1.0, 1.1),
         "gorse": (0.8, 1.2), "seastack": (0.9, 1.6), "ruinpillar": (0.9, 1.3), "brazier": (1.0, 1.2)}
RADIUS = {"willow": 0.55, "reeds": 0.2, "lily": 0.2, "boulder": 1.0, "house": 0.6, "tower": 0.5, "cloudpuff": 0.9, "fence": 0.7, "wall": 0.8, "tree": 0.45, "pine": 0.45, "snowpine": 0.45}
SHADOW = {"boulder": 0.42, "rock": 0.3, "rock_snow": 0.3, "house": 0.55, "tower": 0.42, "fence": 0.0, "wall": 0.0, "tree": 0.38,
          "pine": 0.36, "snowpine": 0.36, "cart": 0.3, "statue": 0.3, "pillar": 0.2}
NO_SHADOW = {"ember", "flowers", "crater", "cloudpuff", "drift", "lily", "seastack"}
ALONG_ROAD = {"fence", "wall", "banner", "lanternpost"}
IN_WATER = {"lily", "seastack"}


def scatter(P, T, road, act, rng, view, keep_out):
    x0, x1, y0, y1 = view
    placed = []
    for kind, count in act["props"]:
        lo, hi = SCALE.get(kind, (1, 1))
        rad = RADIUS.get(kind, 0.35)
        n = 0
        tries = 0
        while n < count and tries < count * 80:
            tries += 1
            if kind in ALONG_ROAD:
                i = rng.randrange(4, len(road) - 4)
                (ax, ay), (bx, by) = road[i - 1], road[i + 1]
                tx, ty = bx - ax, by - ay
                L = math.hypot(tx, ty) or 1
                side = rng.choice((-1, 1))
                off = rng.uniform(1.15, 1.5) if kind != "banner" else 0.95
                x, y = road[i][0] - ty / L * off * side, road[i][1] + tx / L * off * side
                yaw = math.degrees(math.atan2(ty, tx))
            else:
                x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
                yaw = rng.uniform(0, 360) if kind not in ("house",) else rng.uniform(-20, 20)
            d = float(seg_dist(np.array([x]), np.array([y]), road)[0])
            if kind == "cloudpuff":
                if T.at(x, y) > -2.0:
                    continue
            else:
                if d < (0.75 if kind == "banner" else 1.0) + rad * 0.6:
                    continue
                if "sky" in act and T.at(x, y) < -0.25:
                    continue
            if kind in IN_WATER:
                if not T.in_water(x, y, -0.5) or T.at(x, y) > -0.3:
                    continue
            elif kind not in ("ember",) and T.in_water(x, y, rad * 0.6 + 0.2):
                continue
            if any(math.hypot(x - kx, y - ky) < kr + rad for kx, ky, kr in keep_out):
                continue
            if any(math.hypot(x - px, y - py) < (pr + rad) * 0.75 for px, py, pr in placed):
                continue
            s = rng.uniform(lo, hi)
            z = -3.1 if kind == "cloudpuff" else -0.215 if kind in IN_WATER else T.at(x, y)
            if kind not in NO_SHADOW and SHADOW.get(kind, 0.25) > 0:
                P.shadow_at(x, y, SHADOW.get(kind, 0.25) * s)
            with P.k.at((x, y, z), rot=(0, 0, yaw), scale=s):
                build(P, kind)
            placed.append((x, y, rad))
            n += 1


def build(P, kind):
    if kind == "rock_snow":
        P.rock(snow=True)
    elif kind == "boulder":
        P.rock(col="#9a8f80")
    elif kind == "snowpine":
        P.pine(col="#3f7d6a", snow=True)
    elif kind == "crystal_iron":
        P.crystal(col="#6a7da0")
    elif kind == "crystal_gold":
        P.crystal(col="#ffd977", glow_on=MOOD[3])
    elif kind == "crystal":
        P.crystal(col="#bfe9ff", glow_on=MOOD[3])
    elif kind == "tree" and P.act["id"] == "wood":
        P.tree(fol=P.rng.choice(["#3f8a46", "#4f9a4a", "#357a42"]), fol_lt="#62ad55")
    elif kind == "pine" and P.act["id"] == "iron":
        P.pine(col="#47785a")
    elif kind == "pine" and P.act["id"] == "coast":
        P.pine(col="#3f7150")
    elif kind == "bush" and P.act["id"] == "citadel":
        P.bush(col="#6f7a48", col2="#8a8f58")
    else:
        getattr(P, kind)()


# ------------------------------------------------------------------ scene
def setup(samples):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    r = sc.render
    r.engine = "BLENDER_EEVEE"
    r.film_transparent = False
    r.resolution_x, r.resolution_y, r.resolution_percentage = IMG_W, IMG_H, 100
    r.filter_size = 1.2
    sc.eevee.taa_render_samples = samples
    for attr in ("use_shadows", "use_raytracing", "use_fast_gi", "use_bloom"):
        if hasattr(sc.eevee, attr):
            try:
                setattr(sc.eevee, attr, False)
            except Exception:
                pass
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    ims = r.image_settings
    ims.file_format = "JPEG"
    ims.color_mode = "RGB"
    ims.quality = 86
    w = bpy.data.worlds.new("World")
    w.color = (0.3, 0.45, 0.6)
    sc.world = w
    cd = bpy.data.cameras.new("Cam")
    cd.type = "ORTHO"
    cd.ortho_scale = VIEW_W * ASPECT
    cd.clip_start, cd.clip_end = 0.1, 200
    cam = bpy.data.objects.new("Cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    fwd = Vector((0, COS, -SIN))
    cam.location = -fwd * 60
    cam.rotation_euler = (math.radians(90) - EL, 0, 0)
    K.groups()
    return sc, cam


def render_act(index, act, style, samples, out_dir):
    global _MAT, _GROUP
    _MAT, _GROUP = {}, {}
    K._G.clear()
    K._M.clear()
    sc, cam = setup(samples)
    toon_group(style)
    toon_group(style, "ground", flat=True)
    ink = style["outline"]["color"]
    orig = K.outline_mat
    K.outline_mat = lambda col=None: orig(ink)
    rng = random.Random(1000 + index)
    k = K.Kit(outline=style["outline"].get("props", 0.016) * 2.0)

    ctrl = [uv_to_ground(u, v) for u, v in act["road_pts"]]
    road = [(p.x, p.y) for p in K.catmull([(x, y, 0) for x, y in ctrl], 10)]
    T = Terrain(act, road, rng)
    half_h = VIEW_W * ASPECT / 2 / SIN
    ter = terrain_mesh(T, -half_h - 2.5, half_h + 6.0)
    g = act["ground"]
    ter.data.materials.append(patches(g, act["noise"], act["id"], relief=act.get("relief", False)))

    if act.get("water"):
        w = act["water"]
        wm = patches([w["color"][0], w["color"][0], w["color"][1]], 1.4, act["id"] + "_water", detail=1.0)
        build_mesh("water", [(-8, -half_h - 3, -0.22), (8, -half_h - 3, -0.22), (8, half_h + 7, -0.22), (-8, half_h + 7, -0.22)], [(0, 1, 2, 3)], wm)
    if act.get("water", {}).get("kind") == "coast":
        # Surf along the cliff foot and whitecaps out on the storm sea.
        foam = toon("#eef8fb")
        yy = -half_h - 2.0
        while yy < half_h + 6.0:
            sx = float(T.shore(np.array(yy)))
            disc(k, sx - 0.22 - rng.uniform(0, 0.15), yy, -0.2, rng.uniform(0.14, 0.26), foam, 0.5)
            yy += 0.22
        for _ in range(70):
            x, y = rng.uniform(-6, 0), rng.uniform(-half_h - 2, half_h + 6)
            if x < float(T.shore(np.array(y))) - 0.6:
                with k.at((x, y, -0.205), rot=(0, 0, rng.uniform(-20, 20))):
                    k.box((rng.uniform(0.25, 0.55), 0.04, 0.005), foam, outline=0)
    if "sky" in act:
        s = act["sky"]
        cm = patches([s["below"], s["below"], s["cloud_dk"]], 0.35, "clouds", detail=1.0)
        build_mesh("below", [(-12, -half_h - 6, -3.3), (12, -half_h - 6, -3.3), (12, half_h + 12, -3.3), (-12, half_h + 12, -3.3)], [(0, 1, 2, 3)], cm)
    if "lava" in act:
        lv = act["lava"]
        for _ in range(lv["cracks"]):
            for _try in range(30):
                x, y = rng.uniform(-5, 5), rng.uniform(-half_h, half_h)
                if seg_dist(np.array([x]), np.array([y]), road)[0] > 1.1:
                    break
            pts = [(x, y)]
            a = rng.uniform(0, math.tau)
            for _s in range(5):
                a += rng.uniform(-0.8, 0.8)
                x, y = x + math.cos(a) * 0.35, y + math.sin(a) * 0.35
                pts.append((x, y))
            ribbon(T, pts, 0.09, 0.012, glow(lv["color"], 1.3), "crack")
        for _ in range(lv["pools"]):
            for _try in range(40):
                x, y = rng.uniform(-4.5, 4.5), rng.uniform(-half_h + 2, half_h - 3)
                if seg_dist(np.array([x]), np.array([y]), road)[0] > 1.8:
                    break
            with k.at((x, y, T.at(x, y) + 0.01), scale=(1.2, 0.9, 1)):
                k.cyl(0.6, 0.02, glow(lv["color"], 1.2), seg=24, outline=0)
                k.cyl(0.36, 0.03, glow(lv["hot"], 1.4), seg=20, outline=0)
                k.torus(0.62, 0.08, toon("#4a3e36"), loc=(0, 0, 0.02), seg=24, rseg=6)

    # road: a darker kerb with the pale track on top, round ends
    edge_m, road_m = toon(act["road"][1]), toon(act["road"][0])
    ribbon(T, road, 1.0, 0.03, edge_m, "kerb")
    ribbon(T, road, 0.74, 0.05, road_m, "road")
    for (x, y) in (road[0], road[-1]):
        disc(k, x, y, 0.03, 0.5, edge_m)
        disc(k, x, y, 0.05, 0.37, road_m)
    # stepping stones along the track
    for i in range(3, len(road) - 3, 3):
        x, y = road[i]
        disc(k, x + rng.uniform(-0.2, 0.2), y, 0.06, 0.05, toon(act["road"][1]), 0.7)

    P = Props(k, T, style, act, rng)
    P.end = road[-1]
    sx, sy = road[0]
    side = 1 if sx > 0 else -1
    camp = (sx + side * 1.7, sy - 0.1)
    with k.at((camp[0], camp[1], T.at(*camp)), scale=1.1):
        P.camp()
    ex, ey = road[-1]
    lm = (ex, ey + 1.1)
    P.lm = lm
    if act["boss"] != "bridge":
        P.shadow_at(lm[0], lm[1] + 0.5, 1.6)
    with k.at((lm[0], lm[1], max(0.0, T.at(*lm)))):
        getattr(P, act["boss"])()
    keep_out = [(camp[0], camp[1], 1.4), (lm[0], lm[1] + 0.6, 2.4)]
    scatter(P, T, road, act, rng, (-5.6, 5.6, -half_h - 0.5, half_h + 3.0), keep_out)

    bpy.context.view_layer.update()
    path = os.path.join(out_dir, f"{act['id']}.jpg")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

    def proj(x, y, z):
        c = world_to_camera_view(sc, cam, Vector((x, y, z)))
        return [round(c.x, 4), round(1 - c.y, 4)]

    step = max(1, len(road) // 60)
    pts = [proj(x, y, max(T.at(x, y), -0.02) + 0.05) for x, y in road[::step]]
    last = proj(road[-1][0], road[-1][1], 0.05)
    if pts[-1] != last:
        pts.append(last)
    K.outline_mat = orig
    return {"id": act["id"], "image": f"maps/{act['id']}.jpg", "path": pts, "camp": proj(camp[0], camp[1], 0.3), "boss": proj(lm[0], lm[1], 1.2)}


def write_ts(entries, style_id):
    lines = [
        "// Generated by art/maps/render_maps.py (npm run art:maps). Do not edit by hand.",
        "// One illustrated map per campaign act, in ACTS order. `path` is the painted road in image fractions",
        "// (x from the left, y from the top), from the player's camp at the bottom to the boss landmark at the top.",
        "export interface ActMap { id: string; image: string; tint: string; path: [number, number][]; camp: [number, number]; boss: [number, number] }",
        f"export const MAP_SIZE = {{ w: {IMG_W}, h: {IMG_H} }};",
        f"export const MAP_STYLE = {json.dumps(style_id)};",
        "export const ACT_MAPS: ActMap[] = [",
    ]
    tints = {a["id"]: C(a["ground"][1]) for a in ACTS}
    for e in entries:
        lines.append(f"  {{ id: {json.dumps(e['id'])}, image: {json.dumps(e['image'])}, tint: {json.dumps(tints[e['id']])}, camp: {json.dumps(e['camp'])}, boss: {json.dumps(e['boss'])},")
        lines.append(f"    path: {json.dumps(e['path'], separators=(',', ':'))} }},")
    lines.append("];")
    with open(os.path.join(ROOT, "base", "src", "ui", "mapdata.ts"), "w") as f:
        f.write("\n".join(lines) + "\n")


def main():
    global MOOD
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--style", default="active")
    ap.add_argument("--samples", type=int, default=32)
    a = ap.parse_args(argv)
    style = load_style(a.style)
    MOOD = MOODS.get(style.get("id", "meadow"), MOODS["meadow"])
    out_dir = os.path.join(ROOT, "base", "public", "maps")
    os.makedirs(out_dir, exist_ok=True)
    only = {int(x) for x in a.only.split(",") if x != ""}
    data_path = os.path.join(HERE, "paths.json")
    old = {}
    if os.path.exists(data_path):
        with open(data_path) as f:
            old = {e["id"]: e for e in json.load(f)["acts"]}
    entries = []
    for i, act in enumerate(ACTS):
        if only and i not in only:
            if act["id"] in old:
                entries.append(old[act["id"]])
            continue
        e = render_act(i, act, style, a.samples, out_dir)
        print(f"MAP_OK {i} {act['id']} points={len(e['path'])}", flush=True)
        entries.append(e)
    with open(data_path, "w") as f:
        json.dump({"style": style.get("id", "meadow"), "size": [IMG_W, IMG_H], "acts": entries}, f, indent=1)
    write_ts(entries, style.get("id", "meadow"))


main()
