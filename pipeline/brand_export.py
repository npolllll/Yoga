#!/usr/bin/env python3
"""pipeline/out/brand/*.png → public/media/brand/<name>.webp (alpha) + manifest.json (trimmed, max 900 px)."""
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "out", "brand")
DST = os.path.join(os.path.dirname(HERE), "public", "media", "brand")
os.makedirs(DST, exist_ok=True)
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
    im.thumbnail((900, 900), Image.LANCZOS)
    out = os.path.join(DST, f"{name}.webp")
    im.save(out, "WEBP", quality=82, method=6)
    manifest[name] = {"url": f"/media/brand/{name}.webp", "width": im.width, "height": im.height}
    print(name, im.size, os.path.getsize(out) // 1024, "KiB")
json.dump(manifest, open(os.path.join(DST, "manifest.json"), "w"), indent=2)
