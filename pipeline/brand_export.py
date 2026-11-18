#!/usr/bin/env python3
"""pipeline/out/brand/*.png → public/media/brand/<name>.webp (alpha) + manifest.json (trimmed).

Exported at the size each illustration is shown at on the home page (CSS px × ~2.6 for dense phone screens),
not at render size: the home page is the LCP-critical route and every image shares the phone's bandwidth."""
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "out", "brand")
DST = os.path.join(os.path.dirname(HERE), "public", "media", "brand")
os.makedirs(DST, exist_ok=True)
# Longest side in px by role (home page display size: hero ≤384 px wide, training 224 px tall,
# level cards 160 px tall, category cards 96 px tall).
MAX_SIDE = {"hero": 820, "training": 600, "level-": 440, "category-": 260}
manifest = {}
for f in sorted(os.listdir(SRC)):
    if not f.endswith(".png"):
        continue
    name = f[:-4]
    im = Image.open(os.path.join(SRC, f)).convert("RGBA")
    bbox = im.split()[-1].point(lambda a: 255 if a > 8 else 0).getbbox()
    if bbox:
        pad = 24
        im = im.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(im.width, bbox[2] + pad), min(im.height, bbox[3] + pad)))
    side = next((v for k, v in MAX_SIDE.items() if name == k or (k.endswith("-") and name.startswith(k))), 900)
    im.thumbnail((side, side), Image.LANCZOS)
    out = os.path.join(DST, f"{name}.webp")
    im.save(out, "WEBP", quality=80, method=6)
    manifest[name] = {"url": f"/media/brand/{name}.webp", "width": im.width, "height": im.height}
    print(name, im.size, os.path.getsize(out) // 1024, "KiB")
json.dump(manifest, open(os.path.join(DST, "manifest.json"), "w"), indent=2)
