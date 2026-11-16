"""Muster unit art: build every unit procedurally in Blender and render the v3 battle frames (+ portraits).

    blender -b --factory-startup -P art/render_all.py -- [--only ranger,golem] [--tiers 1,4] [--jobs 6]
                                                         [--no-post] [--portraits] [--samples 16] [--resume]
    npm run art
    npm run art -- -- --style dusk          (or MUSTER_STYLE=dusk; default: the active direction in art/style/active.json)

Battle frames (docs/ART-V3-ATLAS.md): the diorama camera from art/muster_art/style.py, 5 rendered facings
(the other 3 are mirrors), idle/walk/attack/death frames, every frame framed tightly around its own geometry.
Three passes per frame: colour with team parts in neutral white, the team mask (R=main, G=dark, B=light) and,
for Ascended, the emissive-only glow pass. Raw renders land in art/build/v3/<kind>/t<tier>/; then
art/post.py (system python3 + Pillow + numpy) inks, blooms, downsamples and art/pack_atlas.py packs them
into base/public/atlas/<kind>_t<tier>.png + _m.png with base/public/atlas/manifest.json and contact sheets in
art/contact/.

--portraits also re-renders the 3/4 card portraits (base/public/portraits, tide colours) in the v2 framing.
"""
import argparse
import json
import math
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

RAW3 = os.path.join(HERE, "build", "v3")
RAW = os.path.join(HERE, "build", "raw")
PORTRAIT = 256
# portraits framed on the body (dense geometry) rather than the long pole/pike
BODY_FRAME = {"banner": 7.0, "pikeman": 2.0, "duelist": 2.0, "lancer": 2.0}
# portrait camera elevation per kind (flat things look better from higher up)
PORTRAIT_EL = {"harrier": 48.0, "griffin": 30.0, "mine": 42.0, "hive": 34.0, "ballista": 34.0, "bombard": 32.0, "golem": 16.0, "turret": 30.0,
               "golemling": 26.0, "mite": 38.0, "queen": 38.0, "lancer": 18.0}
BUGS = {"mite", "queen"}


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--tiers", default="")
    ap.add_argument("--jobs", type=int, default=6)
    ap.add_argument("--worker", type=int, default=-1)
    ap.add_argument("--nworkers", type=int, default=1)
    ap.add_argument("--no-post", action="store_true")
    ap.add_argument("--portraits", action="store_true", help="render card portraits instead of battle frames")
    ap.add_argument("--samples", type=int, default=16)
    ap.add_argument("--resume", action="store_true", help="skip kind/tier folders that already have meta.json")
    ap.add_argument("--style", default="", help="style direction id (meadow, dusk, toy) or v2; default MUSTER_STYLE or art/style/active.json")
    a = ap.parse_args(argv)
    if a.style:  # before any muster_art import; Blender workers and post.py inherit it
        os.environ["MUSTER_STYLE"] = a.style
    return a


def kinds_list(a):
    from muster_art.units import REG
    ks = list(REG.keys())
    if a.only:
        want = [x.strip() for x in a.only.split(",") if x.strip()]
        ks = [x for x in ks if x in want]
    return ks


def tiers_for(spec, a):
    ts = [1] if spec["spawned"] else [1, 2, 3, 4]
    if a.tiers:
        want = {int(x) for x in a.tiers.split(",")}
        ts = [t for t in ts if t in want]
    return ts


def jobs_list(a):
    """(kind, tier) work units, biggest first so the pool balances."""
    from muster_art.units import REG
    out = []
    for kind in kinds_list(a):
        for t in tiers_for(REG[kind], a):
            out.append((kind, t))
    if a.resume:  # meta.json is written last, so its presence means the folder is complete
        out = [(k, t) for k, t in out if not os.path.exists(os.path.join(RAW3, k, f"t{t}", "meta.json"))]
    out.sort(key=lambda kt: -REG[kt[0]]["radius"] * (1.2 if kt[1] == 4 else 1.0))
    return out


# ------------------------------------------------------------------ animation plan
# Per-frame curves. Root transforms (whole-body lean, squash and stretch, the death topple) are baked under the model;
# limb motion goes through parts.ANIM (see parts.py), which the body plans read.
ATK_BLEND = [-0.55, -1.0, 1.0, 1.12, 0.7, 0.28]   # wind-up, wind-up hold, IMPACT, overshoot, follow-through, recover
ATK_FX = [False, False, True, True, False, False]
CAST_BLEND = [-0.4, 0.55, 1.0, 1.06, 0.7, 0.3]
CAST_FX = [False, False, True, True, True, False]
AMP = {"heavy": 1.3, "mid": 1.0, "light": 0.8}
WALK_BOB = {"heavy": 0.024, "mid": 0.018, "light": 0.014}
WALK_SWING = {"heavy": 0.045, "mid": 0.06, "light": 0.07}
WALK_LEAN = {"heavy": 4.0, "mid": 6.0, "light": 8.0}
CAST_CROUCH = {"pikeman"}


def frame_plan(kind, radius):
    """[(anim, index, pose, anim state, root Matrix)] for one body."""
    from mathutils import Matrix
    from muster_art import style as S

    def about(pivot, m):
        p = Matrix.Translation(pivot)
        return p @ m @ p.inverted()

    def rot(axis, deg):
        return Matrix.Rotation(math.radians(deg), 4, axis)

    def scl(x, y, z):
        return Matrix.Diagonal((x, y, z, 1.0))

    def tr(x, y, z):
        return Matrix.Translation((x, y, z))

    static = kind in S.STATIC
    flying = kind in S.FLYING
    bug = kind in BUGS
    W = S.weight(kind)
    amp = AMP[W]
    r = radius
    rs = r / 0.3
    clips = S.anims_for(kind)
    plan = []

    def st(clip, **kw):
        d = dict(gait=None, clip=clip, idle=None, blend=None, fx=None, bob=0.0, swing=0.0, death=None, weight=W)
        d.update(kw)
        return d

    # ---- idle: breathing and a slow weight shift (fliers hover on a soft wing beat)
    n = clips["idle"]
    for i in range(n):
        p = i / n
        br, sw = math.sin(2 * math.pi * p), math.cos(2 * math.pi * p)
        if flying:
            m = tr(0, 0, -0.035 * rs * math.cos(2 * math.pi * p)) @ rot("Y", 2.0 * math.sin(2 * math.pi * p))
        elif static:
            m = scl(1 + 0.012 * br, 1 + 0.012 * br, 1 - 0.018 * br) if kind == "hive" else rot("Z", 1.2 * sw)
        elif bug:
            m = tr(0, 0, 0.004 * br) @ rot("X", 2.5 * sw)
        else:
            m = rot("X", 1.3 * sw * amp)
        plan.append(("idle", i, "idle", st("idle", idle=p, bob=0.007 * br * amp), m))
    # ---- walk: contact, down, passing, up for each foot; the upper body bounces, the planted foot stays put
    if "walk" in clips:
        n = clips["walk"]
        for i in range(n):
            g = i / n
            if flying:
                m = tr(0, 0, -0.05 * rs * math.cos(2 * math.pi * g)) @ rot("Y", 6.0 + 3.0 * math.sin(2 * math.pi * g))
                s_ = st("walk", gait=g)
            else:
                m = rot("Y", WALK_LEAN[W])
                s_ = st("walk", gait=g, bob=-WALK_BOB[W] * math.sin(4 * math.pi * g), swing=WALK_SWING[W])
            plan.append(("walk", i, "idle", s_, m))
    # ---- attack: wind-up (lean back, crouch), impact (lunge, stretch), overshoot, follow-through, settle
    n = clips["attack"]
    for i in range(n):
        b, fx = ATK_BLEND[i], ATK_FX[i]
        if static:
            m = [scl(1.03, 1.03, 0.94), scl(1.05, 1.05, 0.9) @ tr(0.01 * rs, 0, 0), tr(-0.05 * rs, 0, 0) @ scl(0.98, 0.98, 1.04),
                 tr(-0.07 * rs, 0, 0) @ scl(1.02, 1.02, 0.97), tr(-0.04 * rs, 0, 0), tr(-0.012 * rs, 0, 0)][i]
        elif flying:
            z = 0.45 * rs
            m = [about((0, 0, z), rot("Y", -10)) @ tr(0, 0, 0.04 * rs), about((0, 0, z), rot("Y", -16)) @ tr(-0.02 * rs, 0, 0.07 * rs),
                 about((0, 0, z), rot("Y", 22)) @ tr(0.06 * rs, 0, -0.06 * rs), about((0, 0, z), rot("Y", 26)) @ tr(0.07 * rs, 0, -0.08 * rs),
                 about((0, 0, z), rot("Y", 12)) @ tr(0.035 * rs, 0, -0.035 * rs), about((0, 0, z), rot("Y", 4)) @ tr(0.01 * rs, 0, 0)][i]
        else:
            back, front = (-r * 0.3, 0, 0), (r * 0.3, 0, 0)
            m = [about(back, rot("Y", -6 * amp)) @ scl(1 + 0.015 * amp, 1 + 0.015 * amp, 1 - 0.035 * amp),
                 about(back, rot("Y", -11 * amp)) @ scl(1 + 0.03 * amp, 1 + 0.03 * amp, 1 - 0.07 * amp),
                 about(front, rot("Y", 9 * amp)) @ scl(0.98, 0.98, 1 + 0.05 * amp),
                 about(front, rot("Y", 11 * amp)) @ scl(1.0, 1.0, 1 + 0.02 * amp),
                 about(front, rot("Y", 5 * amp)) @ scl(1 + 0.02 * amp, 1 + 0.02 * amp, 1 - 0.025 * amp),
                 about(front, rot("Y", 2 * amp))][i]
        plan.append(("attack", i, "attack", st("attack", blend=b, fx=fx), m))
    # ---- cast: the special move (rise, release on IMPACT, hold, settle)
    if "cast" in clips:
        n = clips["cast"]
        for i in range(n):
            b, fx = CAST_BLEND[i], CAST_FX[i]
            back = (-r * 0.3, 0, 0)
            if kind in CAST_CROUCH:
                # a stance move (the pikeman's brace): sink low and lean into it instead of rising
                m = [scl(1.02, 1.02, 0.96), scl(1.04, 1.04, 0.9), about(back, rot("Y", 6)) @ scl(1.06, 1.06, 0.84),
                     about(back, rot("Y", 7)) @ scl(1.06, 1.06, 0.83), about(back, rot("Y", 5)) @ scl(1.05, 1.05, 0.86), scl(1.02, 1.02, 0.94)][i]
            else:
                m = [about(back, rot("Y", -4 * amp)) @ scl(1.02, 1.02, 0.95), about(back, rot("Y", -6 * amp)) @ scl(0.99, 0.99, 1.03),
                     scl(0.98, 0.98, 1.05), scl(0.99, 0.99, 1.03), Matrix.Identity(4), about(back, rot("Y", 1))][i]
            plan.append(("cast", i, "cast", st("cast", blend=b, fx=fx), m))
    # ---- death: recoil, buckle, fall, impact, bounce, settle
    n = clips["death"]
    for i in range(n):
        d = i / (n - 1)
        s_ = st("death", death=d)
        if static:
            sx, sz, tilt = ((1.03, 0.9, 3.0), (1.08, 0.75, 6.0), (1.13, 0.58, 8.0), (1.18, 0.4, 10.0), (1.17, 0.44, 9.0), (1.2, 0.34, 10.0))[i]
            m = rot("X", tilt) @ scl(sx, sx, sz)
        elif flying:
            z = 0.45 * rs
            roll, drop = ((18.0, 0.04), (60.0, 0.14), (120.0, 0.28), (170.0, 0.42), (175.0, 0.36), (180.0, 0.44))[i]
            m = tr(0, 0, -drop * z) @ about((0, 0, z), rot("X", roll))
        elif bug:
            z = 0.1 * (2.0 if kind == "queen" else 1.15)
            roll, lift = ((35.0, 0.02), (95.0, 0.06), (150.0, 0.07), (180.0, 0.03), (172.0, 0.045), (180.0, 0.03))[i]
            m = tr(0, 0, lift * (2.0 if kind == "queen" else 1.0)) @ about((0, 0, z), rot("X", roll))
        else:
            pv = (-r * 0.55, 0, 0)
            ang, sz, sink = ((-14.0, 1.0, 0.012), (-38.0, 0.97, -0.004), (-66.0, 0.93, -0.01), (-90.0, 0.85, -0.02),
                             (-83.0, 0.9, -0.012), (-90.0, 0.84, -0.024))[i]
            m = tr(0, 0, sink * rs) @ about(pv, rot("Y", ang)) @ scl(1, 1, sz)
        plan.append(("death", i, "idle", s_, m))
    return plan


# ------------------------------------------------------------------ v3 battle frames
def render_unit(st, k, P, kind, tier, a):
    import numpy as np
    from mathutils import Matrix
    from muster_art import kit as K
    from muster_art import parts as H
    from muster_art import style as S
    from muster_art.units import REG

    spec = REG[kind]
    out = os.path.join(RAW3, kind, f"t{tier}")
    os.makedirs(out, exist_ok=True)
    e = math.radians(S.CAMERA_EL)
    up = np.array([0.0, math.sin(e), math.cos(e)])
    margin = 0.045 + (0.07 if tier == 4 else 0.0)
    frames = []
    n = 0
    stride = 0.0
    for anim, idx, pose, state, root in frame_plan(kind, spec["radius"]):
        k.clear()
        H.reset_anim()
        H.ANIM.update(state)
        k.stack = [root]
        spec["build"](k, P, tier, pose)
        k.stack = [Matrix.Identity(4)]
        stride = max(stride, H.ANIM["stride"])
        H.reset_anim()
        v = k.verts_world().astype(np.float64)
        fs = S.CLIP_SCALE.get(anim, 1.0)
        for di, deg in enumerate(S.DIRS):
            yaw = math.radians(-deg)
            c, s_ = math.cos(yaw), math.sin(yaw)
            rx = v[:, 0] * c - v[:, 1] * s_
            ry = v[:, 0] * s_ + v[:, 1] * c
            px = rx
            py = ry * up[1] + v[:, 2] * up[2]
            ppu = S.PPU * fs
            x0 = math.floor((px.min() - margin) * ppu) / ppu
            x1 = math.ceil((px.max() + margin) * ppu) / ppu
            y0 = math.floor((py.min() - margin) * ppu) / ppu
            y1 = math.ceil((py.max() + margin) * ppu) / ppu
            w, h = int(round((x1 - x0) * ppu)), int(round((y1 - y0) * ppu))
            span = max(x1 - x0, y1 - y0)
            shift = (((x0 + x1) / 2) / span, ((y0 + y1) / 2) / span)
            rz = Matrix.Rotation(yaw, 4, "Z")
            for ob in k.objs:
                ob.matrix_world = rz
            base = os.path.join(out, f"{anim}{idx}_d{di}")
            K.set_team("neutral")
            K.set_glowpass(False)
            K.set_maskpass(False)
            st.render(base + ".png", (w * S.SS, h * S.SS), span, shift=shift)
            K.set_maskpass(True)
            st.sc.eevee.taa_render_samples = max(4, a.samples // 2)  # flat colours: fewer samples are enough
            st.render(base + "_m.png", (w * S.SS, h * S.SS), span, shift=shift)
            st.sc.eevee.taa_render_samples = a.samples
            K.set_maskpass(False)
            n += 2
            if tier == 4:
                K.set_glowpass(True)
                st.render(base + "_g.png", (w * S.SS, h * S.SS), span, shift=shift)
                K.set_glowpass(False)
                n += 1
            frames.append({"anim": anim, "i": idx, "dir": di, "w": w, "h": h, "s": fs,
                           "ax": int(round(-x0 * ppu)), "ay": int(round(y1 * ppu)), "file": f"{anim}{idx}_d{di}"})
    with open(os.path.join(out, "meta.json"), "w") as f:
        json.dump({"kind": kind, "tier": tier, "radius": spec["radius"], "ppu": S.PPU, "ss": S.SS, "style": S.ID,
                   "anims": S.anims_for(kind), "weight": S.weight(kind), "stride": round(stride, 4), "frames": frames}, f)
    return n


def worker(a):
    from muster_art import kit as K
    from muster_art.parts import Pal

    st = K.Stage(samples=a.samples)
    P = Pal()
    k = K.Kit()
    t0 = time.time()
    if a.portraits:
        return portraits(a, st, P, k, t0)
    jobs = jobs_list(a)
    if a.worker >= 0:
        jobs = [x for i, x in enumerate(jobs) if i % a.nworkers == a.worker]
    st.diorama_view()
    n = 0
    failed = []
    for kind, tier in jobs:
        try:
            n += render_unit(st, k, P, kind, tier, a)
        except Exception:
            import traceback
            traceback.print_exc()
            failed.append(f"{kind}_t{tier}")
            print(f"UNIT_FAILED {kind} t{tier}", flush=True)
            continue
        print(f"UNIT_OK {kind} t{tier} renders={n} t={time.time() - t0:.1f}s", flush=True)
    print(f"WORKER_DONE renders={n} t={time.time() - t0:.1f}s", flush=True)
    if failed:
        sys.exit(1)


# ------------------------------------------------------------------ card portraits (v2 framing)
def portraits(a, st, P, k, t0):
    import numpy as np
    from muster_art import kit as K
    from muster_art.units import REG

    ks = kinds_list(a)
    if a.worker >= 0:
        ks = [x for i, x in enumerate(ks) if i % a.nworkers == a.worker]
    n = 0
    for kind in ks:
        spec = REG[kind]
        tiers = [1] if spec["spawned"] else [1, 2, 3, 4]
        el = PORTRAIT_EL.get(kind, 24.0)
        st.portrait_view(el=el)
        pbox, tbox = None, {}
        for t in tiers:
            k.clear()
            spec["build"](k, P, t, "idle")
            xy = st.project(k.verts_world())
            if kind in BODY_FRAME:
                q = BODY_FRAME[kind]
                lo, hi = np.percentile(xy, q, axis=0), np.percentile(xy, 100 - q, axis=0)
            else:
                lo, hi = xy.min(0), xy.max(0)
            tbox[t] = (lo, hi)
            pbox = (lo, hi) if pbox is None else (np.minimum(pbox[0], lo), np.maximum(pbox[1], hi))
        pd = os.path.join(RAW, "portraits")
        os.makedirs(pd, exist_ok=True)
        for t in tiers:
            k.clear()
            spec["build"](k, P, t, "idle")
            K.set_team("tide")
            lo, hi = tbox[t]
            c = (lo + hi) / 2
            span = max(float(max(hi - lo)), 0.84 * float(max(pbox[1] - pbox[0]))) * 1.08 + 0.06
            sh = (float(c[0]) / span, float(c[1]) / span)
            st.render(os.path.join(pd, f"{kind}_t{t}.png"), PORTRAIT * 2, span, shift=sh)
            n += 1
            if t == 4:
                K.set_glowpass(True)
                st.render(os.path.join(pd, f"{kind}_t{t}_glow.png"), PORTRAIT * 2, span, shift=sh)
                K.set_glowpass(False)
                n += 1
        print(f"PORTRAIT_OK {kind} renders={n} t={time.time() - t0:.1f}s", flush=True)
    print(f"WORKER_DONE renders={n} t={time.time() - t0:.1f}s", flush=True)


def main():
    a = args()
    t0 = time.time()
    from muster_art import style as S
    print(f"STYLE {S.ID}", flush=True)
    if a.worker >= 0 or a.jobs <= 1:
        worker(a)
    else:
        import bpy
        blender = bpy.app.binary_path or "/opt/homebrew/bin/blender"
        extra = []
        for flag in ("only", "tiers"):
            v = getattr(a, flag)
            if v:
                extra += [f"--{flag}", v]
        if a.portraits:
            extra.append("--portraits")
        extra += ["--samples", str(a.samples)]
        if a.resume:
            extra.append("--resume")
        procs = []
        for i in range(a.jobs):
            cmd = [blender, "-b", "--factory-startup", "-P", os.path.abspath(__file__), "--", "--worker", str(i), "--nworkers", str(a.jobs)] + extra
            log = open(os.path.join(HERE, "build", f"worker{i}.log"), "w")
            procs.append((subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT), log))
        bad = 0
        for p, log in procs:
            p.wait()
            log.close()
            bad += p.returncode != 0
        if bad:
            print(f"RENDER_FAILED {bad} workers; see art/build/worker*.log")
            sys.exit(1)
    print(f"RENDER_DONE {time.time() - t0:.1f}s", flush=True)
    if a.worker < 0 and not a.no_post:
        cmd = ["python3", os.path.join(HERE, "post.py")]
        if a.portraits:
            cmd += ["--portraits"]
        if a.only:
            cmd += ["--only", a.only]
        r = subprocess.run(cmd)
        if r.returncode != 0:
            sys.exit(r.returncode)
    print(f"ART_DONE {time.time() - t0:.1f}s", flush=True)


if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "build"), exist_ok=True)
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)
