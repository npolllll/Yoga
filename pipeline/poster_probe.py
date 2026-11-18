"""
Poster duplicate probe (before a 25-minute final render): renders only the poster frame of <slug> in
Cycles at 320x240 for one or more camera views, then (outside Blender) composites it like the final poster
and prints the perceptual-hash distance to every existing poster. Its hash matches the final poster's.

  pipeline/poster_probe.sh <slug> <azimuth:elevation> [...]      e.g.  pipeline/poster_probe.sh tripod-headstand 240:12 300:12

validate_media.py flags posters closer than 12 bits; aim for 20+.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from balance3d.build import build_scene  # noqa: E402
from balance3d.motion import FPS, FRAMES  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
out_dir, slug, views = argv[0], argv[1], [tuple(map(float, v.split(":"))) for v in argv[2:]]
base = json.load(open(os.path.join(HERE, "poses", f"{slug}.json")))
os.makedirs(out_dir, exist_ok=True)
for az, el in views:
    cfg = dict(base)
    cfg["view"] = {**base.get("view", {}), "azimuth": az, "elevation": el}
    scene, _parts, _frames, _report = build_scene(cfg, "final", 320, 240)
    scene.cycles.samples = 8
    scene.frame_set(min(int(cfg.get("poster", 7.0) * FPS), FRAMES - 1) + 1)
    scene.render.filepath = os.path.join(out_dir, f"{slug}-{az:g}-{el:g}.png")
    bpy.ops.render.render(write_still=True)
