"""The v3 art style: the character-atlas contract and look constants, the style directions and the shared art
contract, read by every Blender renderer (characters, arenas, keeps, VFX) and the atlas post / packer.

Character atlases (docs/ART-V3-ATLAS.md) read the module constants below (CAMERA_EL, PPU, DIRS, ANIMS, INK,
OUTLINE, RAMP, RIM_*, TEAMS, PALETTE...). The look constants hold the built-in v2 look; at import they are replaced
by the selected style direction (art/style/<id>.json, docs/ART-V3.md), see `select()`:

    MUSTER_STYLE=<id>   that direction (meadow, dusk, toy)
    MUSTER_STYLE=v2     the built-in v2 look
    (unset)             the active direction in art/style/active.json (set by `npm run style:pick -- <id>`)

The camera and frame plan never change with a direction: CAMERA_EL, DIRS and ANIMS are what base/src/render/camera.ts
and tests/atlas.test.ts check against. Other renderers use the direction API:

    from muster_art import style as S
    st = S.load()            # the active direction (art/style/active.json), or S.load("dusk")
    c = S.contract()         # camera, facings, poses, atlas layout (art/style/contract.json)
    S.apply(st)              # outline colour, team colours, toon bands, shadow tint and rim light into the kit
    P = S.make_pal(st)       # the kit palette with the direction's material colours
    k = K.Kit(outline=st["outline"]["hull"])

The direction files hold only numbers and colours; see docs/ART-V3.md for what each section drives.
Image helpers (read/write PNG through bpy, dilate, blur, grade) need only numpy.
"""
import json
import math
import os


# ------------------------------------------------------------------ camera (the diorama contract)
# Orthographic camera pitched EL degrees down from the horizon, looking "north" (game -y) across the board.
# A ground circle of radius r draws as an ellipse r wide and r*sin(EL) tall. The board projection must use
# the same foreshortening so a sprite's ground anchor sits on its body's position.
CAMERA_EL = 53.3  # = 90 deg - camera.ts TILT (0.64 rad), so sprites match the board
PPU = 128  # final atlas pixels per world unit (horizontal)
SS = 2  # supersample factor for raw renders

# Facings rendered. Game angles are atan2(vy, vx) with y down the screen; 0 = east (screen right), 90 = south
# (towards the camera). West-side facings are the mirror of their east-side twin, so 5 renders give 8 facings.
DIRS = [0, 45, 90, -45, -90]  # E, SE, S, NE, N
# 8-way index (angle = i*45 deg, y down) -> (rendered dir index, mirrored)
DIR8 = [(0, False), (1, False), (2, False), (1, True), (0, True), (3, True), (4, False), (3, False)]

# ------------------------------------------------------------------ animation plan
# name -> number of frames. Runtime timing lives in base/src/render/sprites.ts (clip timing) and base/src/render/units.ts.
# idle: a breathing / weight-shift loop. walk: contact, down, passing, up for each foot. attack: two wind-up frames,
# the impact (IMPACT), overshoot, follow-through and recover. death: recoil, buckle, fall, impact, bounce, settle.
# cast: a special move for kinds in CAST (wind-up, raise, release at IMPACT, hold, settle).
ANIMS = {"idle": 6, "walk": 8, "attack": 6, "death": 6, "cast": 6}
# The frame the blow lands on (the runtime plays the frames before it as the wind-up, ahead of the hit).
IMPACT = {"attack": 2, "cast": 2}
# Bodies that never move reuse their idle frames for walk (manifest alias, nothing rendered).
STATIC = {"mine", "ballista", "hive", "bombard", "turret"}
# Built for the air: deaths tumble instead of toppling.
FLYING = {"harrier", "griffin"}
# Clips rendered below the atlas PPU (the runtime scales them back up): the death topple is a short, fading
# transient, so it ships at 55% resolution to keep the download in budget.
CLIP_SCALE = {"death": 0.55}
# Kinds with a special move of their own, played on its battle event (base/src/render/board.ts castOf).
CAST = {"medic", "grave", "tinker", "trickster", "lamp", "hook", "banner", "lion", "duelist", "pikeman"}
# Motion class: heavy bodies wind up longer, bounce and squash more and raise dust as they step; light ones are snappy.
WEIGHT = {
    "golem": "heavy", "golemling": "heavy", "bulwark": "heavy", "hook": "heavy", "ravager": "heavy", "lion": "heavy",
    "ballista": "heavy", "bombard": "heavy", "hive": "heavy", "lancer": "heavy",
    "blades": "light", "shade": "light", "duelist": "light", "trickster": "light", "decoy": "light", "keg": "light",
    "mite": "light", "sapper": "light", "ranger": "light", "thrall": "light", "queen": "light",
}


def weight(kind):
    return WEIGHT.get(kind, "mid")


def anims_for(kind):
    """The clips a body has: walk for anything that moves, cast for kinds with a special move."""
    out = {"idle": ANIMS["idle"]}
    if kind not in STATIC:
        out["walk"] = ANIMS["walk"]
    out["attack"] = ANIMS["attack"]
    out["death"] = ANIMS["death"]
    if kind in CAST:
        out["cast"] = ANIMS["cast"]
    return out


# ------------------------------------------------------------------ look
INK = "#0b0f18"
OUTLINE = 0.011  # inverted-hull width in world units (scaled by each unit's build scale)
INK_PX = 3  # post silhouette ink at raw (SS) resolution
GLOW_PX = 7  # Ascended halo radius at raw resolution
# Toon ramp: (N.L position, brightness) stops; short soft edges keep small sprites from aliasing.
RAMP = [(0.0, 0.50), (0.30, 0.50), (0.36, 0.78), (0.70, 0.78), (0.76, 1.0), (1.0, 1.0)]
# Key light in camera space: (right, up, towards camera). Mostly top-front so mirrored facings stay plausible.
KEY = (-0.35, 0.95, 0.55)
# Rim light: comes from behind the subject, upper right; added on top of the toon colour.
RIM_DIR = (0.55, 0.7, -0.6)
RIM_COLOR = "#fff3d6"
RIM_STRENGTH = 0.55
RIM_EDGE = (0.62, 0.78)  # facing-ratio band that receives rim

# Team colour. Sprites are rendered with team materials in neutral white and a flat mask whose R, G, B channels
# carry the coverage of team main, dark and light. The runtime tints with (straight alpha, sRGB 0..1):
#   rgb = base * (1 + R*(main-1) + G*(dark-1) + B*(light-1))
# Shaded white times the team colour equals the shaded team colour (gamma-law shading commutes with the product).
TEAMS = {
    "tide": {"main": "#3fd0c9", "dark": "#167c7a", "light": "#a6fff6"},
    "ember": {"main": "#ff6a4d", "dark": "#a8331f", "light": "#ffc1ad"},
    "neutral": {"main": "#ffffff", "dark": "#ffffff", "light": "#ffffff"},
}

# the look a direction can replace (built-in values = the v2 look; see select())
ID = "v2"
RAMP_DOT = (0.0, 1.0)  # N.L range mapped onto the ramp (directions use -0.2..1, the style-frame shader)
SHADOW_TINT = "#ffffff"  # colour mixed into the dark toon bands
SHADOW_TINT_AMOUNT = 0.0
SPEC = 1.0  # multiplier on metal highlights
GLOW_GAIN = 1.0  # Ascended halo / bloom strength
PALETTE = None  # material colours for parts.Pal (None keeps the v2 materials)

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.dirname(HERE)
STYLE_DIR = os.path.join(ART, "style")
DIRECTIONS = ("meadow", "dusk", "toy")


def _read(name):
    with open(os.path.join(STYLE_DIR, name)) as f:
        return json.load(f)


def active_id():
    return _read("active.json")["direction"]


def load(name=None):
    name = name or os.environ.get("MUSTER_STYLE") or active_id()
    if name not in DIRECTIONS:
        raise ValueError(f"unknown style direction {name!r}; expected one of {DIRECTIONS}")
    return _read(f"{name}.json")


def contract():
    return _read("contract.json")


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


# ------------------------------------------------------------------ contract maths (no bpy)
def elevation(c=None):
    return math.radians((c or contract())["camera"]["elevation_deg"])


def screen_u(y_game, z, el):
    """Screen 'up' coordinate in world units for a game point (y toward the player, z up)."""
    return -y_game * math.sin(el) + z * math.cos(el)


def paste(dst, src, x, y):
    """Premultiplied 'over' of src into dst with src's top-left at integer pixel (x, y), clipped."""
    H, W = dst.shape[:2]
    h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x]
    d = dst[y0:y1, x0:x1]
    dst[y0:y1, x0:x1] = s + d * (1.0 - s[..., 3:4])


def add_into(dst, src, x, y):
    H, W = dst.shape[:2]
    h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 > x0 and y1 > y0:
        dst[y0:y1, x0:x1] += src[y0 - y:y1 - y, x0 - x:x1 - x]


def yaw_for_angle(angle_deg):
    """Blender Z rotation (degrees) for a game facing angle (0 = +x, 90 = toward the player)."""
    return -angle_deg


def yaw_toward(dx, dy):
    return yaw_for_angle(math.degrees(math.atan2(dy, dx)))


# ------------------------------------------------------------------ Blender side
PAL_SPEC = {"steel": 0.3, "iron": 0.15, "gold": 0.35, "pearl": 0.25, "bronze": 0.2, "copper": 0.3}


def apply(st):
    """Push a direction into the kit: ink colour, team colours, and the toon group (bands, shadow tint, rim)."""
    from . import kit as K
    K.INK = st["outline"]["color"]
    for team, cols in st["team"].items():
        K.TEAMS[team] = dict(cols)
    _build_toon(K.groups()["toon"], st)
    K.set_light(st["light"]["key"])
    K.set_team("tide")


def make_pal(st):
    from . import kit as K
    from .parts import Pal
    P = Pal()
    spec = st["shading"].get("spec", 1.0)
    for name, col in st["palette"].items():
        setattr(P, name, K.toon(col, spec=PAL_SPEC.get(name, 0.0) * spec))
    return P


def _build_toon(g, st):
    """Rebuild the kit's Toon node group in place (same interface: Color, Spec -> Color; nodes 'L' and 'ramp' kept)."""
    sh, rim = st["shading"], st["rim"]
    for n in list(g.nodes):
        g.nodes.remove(n)
    N = g.nodes.new
    L_ = g.links.new
    gi, go = N("NodeGroupInput"), N("NodeGroupOutput")
    geo = N("ShaderNodeNewGeometry")
    L = N("ShaderNodeCombineXYZ")
    L.name = "L"
    L.inputs[2].default_value = 1.0
    dot = N("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    L_(geo.outputs["Normal"], dot.inputs[0])
    L_(L.outputs[0], dot.inputs[1])
    # cel bands: dot(N, L) in [-1, 1] mapped onto the ramp from 0 to 1
    to01 = N("ShaderNodeMapRange")
    to01.inputs["From Min"].default_value = -0.2
    to01.inputs["From Max"].default_value = 1.0
    L_(dot.outputs["Value"], to01.inputs["Value"])
    ramp = N("ShaderNodeValToRGB")
    ramp.name = "ramp"
    cr = ramp.color_ramp
    cr.interpolation = "LINEAR"
    bands = sh["bands"]
    cr.elements[0].position = bands[0][0]
    cr.elements[0].color = (bands[0][1] ** 2.2,) * 3 + (1,)
    cr.elements[1].position = bands[-1][0]
    cr.elements[1].color = (bands[-1][1] ** 2.2,) * 3 + (1,)
    for p, v in bands[1:-1]:
        e = cr.elements.new(p)
        e.color = (v ** 2.2,) * 3 + (1,)
    L_(to01.outputs[0], ramp.inputs[0])
    # shadow tint: the darker the band, the more the tint colour replaces white
    vmin = min(v for _, v in bands) ** 2.2
    bw = N("ShaderNodeRGBToBW")
    L_(ramp.outputs["Color"], bw.inputs[0])
    tf = N("ShaderNodeMapRange")
    tf.inputs["From Min"].default_value = vmin
    tf.inputs["From Max"].default_value = 1.0
    tf.inputs["To Min"].default_value = sh["shadow_tint_amount"]
    tf.inputs["To Max"].default_value = 0.0
    L_(bw.outputs[0], tf.inputs["Value"])
    mix = N("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (1, 1, 1, 1)
    r, gg, b = hex_rgb(sh["shadow_tint"])
    mix.inputs["B"].default_value = (r ** 2.2, gg ** 2.2, b ** 2.2, 1)
    L_(tf.outputs[0], mix.inputs["Factor"])
    m1 = N("ShaderNodeVectorMath")
    m1.operation = "MULTIPLY"
    L_(gi.outputs["Color"], m1.inputs[0])
    L_(ramp.outputs["Color"], m1.inputs[1])
    m2 = N("ShaderNodeVectorMath")
    m2.operation = "MULTIPLY"
    L_(m1.outputs[0], m2.inputs[0])
    L_(mix.outputs["Result"], m2.inputs[1])
    # metal highlight where the surface faces the key light
    hl = N("ShaderNodeMapRange")
    hl.clamp = True
    hl.inputs["From Min"].default_value = 0.9
    hl.inputs["From Max"].default_value = 0.94
    L_(dot.outputs["Value"], hl.inputs["Value"])
    hm = N("ShaderNodeMath")
    hm.operation = "MULTIPLY"
    L_(hl.outputs[0], hm.inputs[0])
    L_(gi.outputs["Spec"], hm.inputs[1])
    add = N("ShaderNodeVectorMath")
    add.operation = "ADD"
    L_(m2.outputs[0], add.inputs[0])
    L_(hm.outputs[0], add.inputs[1])
    # rim light: grazing to the camera AND facing the rim direction (symmetric about the camera plane)
    lw = N("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    edge = N("ShaderNodeMapRange")
    edge.clamp = True
    w = rim["width"]
    edge.inputs["From Min"].default_value = 1.0 - w
    edge.inputs["From Max"].default_value = 1.0 - w + 0.06
    L_(lw.outputs["Facing"], edge.inputs["Value"])
    R = N("ShaderNodeCombineXYZ")
    rd = rim["dir"]
    ln = math.sqrt(sum(x * x for x in rd)) or 1.0
    for i in range(3):
        R.inputs[i].default_value = rd[i] / ln
    rdot = N("ShaderNodeVectorMath")
    rdot.operation = "DOT_PRODUCT"
    L_(geo.outputs["Normal"], rdot.inputs[0])
    L_(R.outputs[0], rdot.inputs[1])
    rmask = N("ShaderNodeMapRange")
    rmask.clamp = True
    rmask.inputs["From Min"].default_value = 0.05
    rmask.inputs["From Max"].default_value = 0.3
    L_(rdot.outputs["Value"], rmask.inputs["Value"])
    rm = N("ShaderNodeMath")
    rm.operation = "MULTIPLY"
    L_(edge.outputs[0], rm.inputs[0])
    L_(rmask.outputs[0], rm.inputs[1])
    rs = N("ShaderNodeVectorMath")
    rs.operation = "SCALE"
    r, gg, b = hex_rgb(rim["color"])
    rc = N("ShaderNodeRGB")
    rc.outputs[0].default_value = (r ** 2.2 * rim["strength"], gg ** 2.2 * rim["strength"], b ** 2.2 * rim["strength"], 1)
    L_(rc.outputs[0], rs.inputs[0])
    L_(rm.outputs[0], rs.inputs["Scale"])
    add2 = N("ShaderNodeVectorMath")
    add2.operation = "ADD"
    L_(add.outputs[0], add2.inputs[0])
    L_(rs.outputs[0], add2.inputs[1])
    L_(add2.outputs[0], go.inputs[0])


def ground_mat(st, key_a, key_b, pattern="patches", scale=1.0, key_c=None):
    """Unlit ground material: two (or three) colours from st['ground'] broken up by a pattern.
    pattern: patches (noise blobs, hard edged), tiles (offset bricks with grout = key_b), flat."""
    import bpy

    from . import kit as K
    gnd = st["ground"]
    name = f"ground_{st['id']}_{key_a}_{key_b}_{pattern}_{scale}_{key_c}"
    if K.matname(name) in bpy.data.materials:
        return bpy.data.materials[K.matname(name)]
    m, nt, out = K._new_mat(name)
    N = nt.nodes.new
    tc = N("ShaderNodeTexCoord")
    ca = N("ShaderNodeRGB")
    ca.outputs[0].default_value = K.lin(gnd[key_a])
    cb = N("ShaderNodeRGB")
    cb.outputs[0].default_value = K.lin(gnd[key_b])
    em = N("ShaderNodeEmission")
    if pattern == "flat":
        nt.links.new(ca.outputs[0], em.inputs["Color"])
    elif pattern == "tiles":
        br = N("ShaderNodeTexBrick")
        br.inputs["Scale"].default_value = 1.6 * scale
        br.inputs["Mortar Size"].default_value = 0.03
        br.inputs["Mortar Smooth"].default_value = 0.1
        nt.links.new(tc.outputs["Object"], br.inputs["Vector"])
        nt.links.new(ca.outputs[0], br.inputs["Color1"])
        nt.links.new(ca.outputs[0], br.inputs["Color2"])
        nt.links.new(cb.outputs[0], br.inputs["Mortar"])
        nt.links.new(br.outputs["Color"], em.inputs["Color"])
    else:
        nz = N("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 0.55 * scale
        nz.inputs["Detail"].default_value = 3.0
        nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
        cr = N("ShaderNodeValToRGB")
        r = cr.color_ramp
        r.interpolation = "CONSTANT"
        r.elements[0].position = 0.0
        r.elements[0].color = K.lin(gnd[key_b])
        r.elements[1].position = 0.52
        r.elements[1].color = K.lin(gnd[key_a])
        if key_c:
            e = r.elements.new(0.62)
            e.color = K.lin(gnd[key_c])
        nt.links.new(nz.outputs["Fac"], cr.inputs[0])
        nt.links.new(cr.outputs["Color"], em.inputs["Color"])
    return K._finish(m, nt, out, em.outputs[0])


def camera_view(stage, c, x0, x1, u0, u1, ss=None, el=None):
    """Point the stage camera at the contract view framing screen rect [x0,x1] x [u0,u1] (world units).
    el: elevation in radians (default the ground camera; pass sprite_elevation(c) for unit sprites).
    The rect is snapped to whole pixels (x1 and u0 move); returns (res_x, res_y, x0, x1, u0, u1)."""
    from mathutils import Vector
    el = elevation(c) if el is None else el
    ppu = c["camera"]["ppu"]
    ss = c["camera"]["supersample"] if ss is None else ss
    rx = int(math.ceil((x1 - x0) * ppu * ss - 1e-6))
    ry = int(math.ceil((u1 - u0) * ppu * ss - 1e-6))
    x1 = x0 + rx / (ppu * ss)
    u0 = u1 - ry / (ppu * ss)
    cam = stage.cam
    cam.rotation_euler = (math.pi / 2 - el, 0, 0)
    right = Vector((1, 0, 0))
    up = Vector((0, math.sin(el), math.cos(el)))
    view = Vector((0, math.cos(el), -math.sin(el)))
    cx, cu = (x0 + x1) / 2, (u0 + u1) / 2
    cam.location = right * cx + up * cu - view * 40.0
    cam.data.shift_x = cam.data.shift_y = 0
    cam.data.ortho_scale = max(x1 - x0, u1 - u0)
    cam.data.sensor_fit = "AUTO"
    cam.data.clip_end = 200.0
    sc = stage.sc
    sc.render.resolution_x = rx
    sc.render.resolution_y = ry
    return rx, ry, x0, x1, u0, u1


def sprite_elevation(c=None):
    return math.radians((c or contract())["camera"]["sprite_elevation_deg"])


# ------------------------------------------------------------------ images (numpy; IO through bpy)
def read_png(path):
    """-> float32 HxWx4, premultiplied, top row first."""
    import bpy
    import numpy as np
    im = bpy.data.images.load(path, check_existing=False)
    w, h = im.size
    a = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    a = a.reshape(h, w, 4)[::-1].copy()
    a[..., :3] *= a[..., 3:4]
    return a


def write_png(path, a):
    """a: float32 HxWx4 premultiplied, top row first."""
    import bpy
    import numpy as np
    h, w = a.shape[:2]
    out = a.copy()
    al = out[..., 3:4]
    out[..., :3] = np.where(al > 1e-5, out[..., :3] / np.maximum(al, 1e-5), 0)
    out = np.clip(out, 0, 1)[::-1]
    im = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    im.pixels.foreach_set(out.ravel())
    im.filepath_raw = path
    im.file_format = "PNG"
    im.save()
    bpy.data.images.remove(im)


def downsample(a, f):
    if f <= 1:
        return a
    h, w = a.shape[0] // f * f, a.shape[1] // f * f
    return a[:h, :w].reshape(h // f, f, w // f, f, 4).mean(axis=(1, 3))


def _shift(img, dy, dx):
    import numpy as np
    out = np.zeros_like(img)
    H, W = img.shape[:2]
    out[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = img[max(0, -dy):H + min(0, -dy), max(0, -dx):W + min(0, -dx)]
    return out


def dilate(al, r):
    """Octagonal dilation of an alpha channel by r pixels."""
    import numpy as np
    out = al
    for i in range(int(r)):
        nb = [(0, 1), (0, -1), (1, 0), (-1, 0)] if i % 2 == 0 else [(1, 1), (1, -1), (-1, 1), (-1, -1), (0, 1), (0, -1), (1, 0), (-1, 0)]
        acc = out
        for dy, dx in nb:
            acc = np.maximum(acc, _shift(out, dy, dx))
        out = acc
    return out


def _box(x, r, ax):
    import numpy as np
    pad = [(0, 0)] * x.ndim
    pad[ax] = (r, r)
    c = np.cumsum(np.pad(x, pad, mode="edge"), axis=ax)
    zshape = list(c.shape)
    zshape[ax] = 1
    c = np.concatenate([np.zeros(zshape, c.dtype), c], axis=ax)
    n = x.shape[ax]
    return (np.take(c, np.arange(n) + 2 * r + 1, axis=ax) - np.take(c, np.arange(n), axis=ax)) / (2 * r + 1)


def blur(a, r):
    """Three box passes ~ gaussian over the first two axes."""
    import numpy as np
    r = max(1, int(r))
    out = a.astype(np.float32)
    for _ in range(3):
        out = _box(_box(out, r, 0), r, 1)
    return out


def over(top, bot):
    return top + bot * (1.0 - top[..., 3:4])


def ink(units, st, ss=1):
    """Outer silhouette in the direction's ink colour, premultiplied, to sit under the units layer."""
    import numpy as np
    px = st["outline"]["silhouette_px"] * ss
    a = dilate(units[..., 3], px)
    col = np.array(hex_rgb(st["outline"]["color"]) + (1.0,), np.float32)
    return a[..., None] * col


def bloom(glow, st, ss=1, radius=5):
    import numpy as np
    k = st["shading"].get("bloom", 1.0)
    b = blur(glow, radius * ss) * 1.6 + blur(glow, radius * ss * 3) * 0.9
    b[..., 3] = 0
    return np.clip(b * k, 0, 4)


def grade(a, st, vignette=True):
    """Saturation, contrast, warmth and vignette on a premultiplied image."""
    import numpy as np
    g = st["grade"]
    al = a[..., 3:4]
    rgb = np.where(al > 1e-5, a[..., :3] / np.maximum(al, 1e-5), 0)
    lum = (rgb * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(-1, keepdims=True)
    rgb = lum + (rgb - lum) * g["saturation"]
    rgb = (rgb - 0.5) * g["contrast"] + 0.5
    wm = g.get("warmth", 0.0)
    rgb = rgb * np.array([1 + wm, 1.0, 1 - wm], np.float32)
    if vignette and g.get("vignette", 0) > 0:
        H, W = a.shape[:2]
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt(((xx / W - 0.5) * 1.6) ** 2 + ((yy / H - 0.5) * 1.6) ** 2)
        v = 1 - g["vignette"] * np.clip(d - 0.35, 0, 1) ** 1.5 * 2.2
        rgb = rgb * v[..., None]
    out = a.copy()
    out[..., :3] = np.clip(rgb, 0, 1) * al
    return out


# ------------------------------------------------------------------ the character atlas look from a direction
V2_IDS = ("v2", "builtin")
_LOOK = ("ID", "INK", "OUTLINE", "INK_PX", "RAMP", "RAMP_DOT", "SHADOW_TINT", "SHADOW_TINT_AMOUNT", "SPEC", "GLOW_GAIN", "KEY",
         "RIM_DIR", "RIM_COLOR", "RIM_STRENGTH", "RIM_EDGE", "PALETTE")
_V2 = {n: globals()[n] for n in _LOOK}
_V2_TEAMS = {t: dict(c) for t, c in TEAMS.items()}


def _cam_space(v, el_deg=None):
    """A Blender-world vector (camera looking +Y, pitched el down) as (right, up, towards camera)."""
    e = math.radians(CAMERA_EL if el_deg is None else el_deg)
    x, y, z = v
    return (x, y * math.sin(e) + z * math.cos(e), -y * math.cos(e) + z * math.sin(e))


def select(name=None):
    """Point the atlas look constants at a direction. name: a direction id, 'v2' for the built-in look, or None for
    MUSTER_STYLE / the active direction. Call before the kit builds its node groups (import time does it)."""
    global ID, INK, OUTLINE, INK_PX, RAMP, RAMP_DOT, SHADOW_TINT, SHADOW_TINT_AMOUNT, SPEC, GLOW_GAIN, KEY
    global RIM_DIR, RIM_COLOR, RIM_STRENGTH, RIM_EDGE, PALETTE
    name = name or os.environ.get("MUSTER_STYLE") or (active_id() if os.path.exists(os.path.join(STYLE_DIR, "active.json")) else "v2")
    globals().update(_V2)
    for t, c in _V2_TEAMS.items():  # in place: kit.TEAMS is this dict
        TEAMS[t] = dict(c)
    if name in V2_IDS:
        return ID
    st = load(name)
    sh, rim = st["shading"], st["rim"]
    ID = st["id"]
    INK = st["outline"]["color"]
    OUTLINE = st["outline"]["hull"]
    INK_PX = st["outline"]["silhouette_px"] * SS  # direction pixels are output pixels; post inks at raw resolution
    RAMP = [tuple(b) for b in sh["bands"]]
    RAMP_DOT = (-0.2, 1.0)
    SHADOW_TINT = sh["shadow_tint"]
    SHADOW_TINT_AMOUNT = sh["shadow_tint_amount"]
    SPEC = sh.get("spec", 1.0)
    GLOW_GAIN = sh.get("bloom", 0.7) / 0.7  # the built-in halo was tuned beside meadow's 0.7
    KEY = _cam_space(st["light"]["key"])
    RIM_DIR = _cam_space(rim["dir"])
    RIM_COLOR = rim["color"]
    RIM_STRENGTH = rim["strength"]
    RIM_EDGE = (1.0 - rim["width"], 1.0 - rim["width"] + 0.06)
    TEAMS.update({t: dict(c) for t, c in st["team"].items()})
    PALETTE = dict(st["palette"])
    return ID


select()
