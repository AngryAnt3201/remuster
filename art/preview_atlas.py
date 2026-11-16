"""Inline a few packed atlases into the outputs/signoff/character-atlases review page so it runs offline.

    python3 art/preview_atlas.py [--kinds ranger,golem,...]

Writes outputs/signoff/character-atlases/data.js: a manifest subset with the atlas PNGs inlined as data URIs.
The page tints them with the same formula as base/src/render/sprites.ts.
"""
import argparse
import base64
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from post import NAMES  # noqa: E402

ATLAS = os.path.join(ROOT, "base", "public", "atlas")
DST = os.path.join(ROOT, "outputs", "signoff", "character-atlases")
DEFAULT = "blades,ranger,bulwark,golem,harrier,grave,trickster,tinker"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kinds", default=DEFAULT)
    a = ap.parse_args()
    man = json.load(open(os.path.join(ATLAS, "manifest.json")))
    kinds = [k for k in a.kinds.split(",") if k in man["units"]]
    os.makedirs(DST, exist_ok=True)
    sheets, images = {}, {}
    for k in kinds:
        for t in man["units"][k]["tiers"]:
            key = f"{k}_t{t}"
            sheets[key] = man["sheets"][key]
            for suf in ("", "_m"):
                # inlined: the sign-off card is sandboxed, so file images would taint the canvas the page tints on
                b = open(os.path.join(ATLAS, key + suf + ".png"), "rb").read()
                images[key + suf] = "data:image/png;base64," + base64.b64encode(b).decode()
    sub = {**man, "sheets": sheets, "units": {k: man["units"][k] for k in kinds}}
    data = {"manifest": sub, "images": images, "kinds": {k: NAMES.get(k, k) for k in kinds}}
    with open(os.path.join(DST, "data.js"), "w") as f:
        f.write("window.ATLAS = " + json.dumps(data, separators=(",", ":")) + ";\n")
    print("PREVIEW", DST, len(images), "images")


if __name__ == "__main__":
    main()
