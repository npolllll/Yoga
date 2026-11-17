"""
Fast authoring check: render only the key times of one or more pose configs (Workbench) + metrics.
  blender -b --python pipeline/keysheet.py -- --out DIR slug [slug ...]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from balance3d import character, rig, scene as scn  # noqa: E402
from balance3d.motion import FPS, FRAMES, solve, body_points  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--times", default="")
ap.add_argument("slugs", nargs="+")
args = ap.parse_args(argv)

for slug in args.slugs:
    cfg = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "poses", f"{slug}.json")))
    frames, report = solve(cfg)
    times = [float(x) for x in args.times.split(",")] if args.times else sorted({float(k["t"]) for k in cfg["keys"]} | {cfg.get("poster", 7.0)})
    scene = scn.reset_scene()
    scn.setup_world(scene)
    parts = character.build_character()
    view = cfg.get("view", {})
    scn.fit_camera(scene, body_points(frames), view.get("azimuth", 40), view.get("elevation", 8), lens=view.get("lens", 70))
    scn.configure_render(scene, "preview", 480, 360)
    out = os.path.join(args.out, slug)
    os.makedirs(out, exist_ok=True)
    for t in times:
        f = min(int(round(t * FPS)), FRAMES - 1)
        fr = frames[f]
        for obj, joint in parts:
            obj.matrix_world = fr.skeleton.matrices[joint]
        scene.render.filepath = os.path.join(out, f"{t:05.2f}.png")
        bpy.ops.render.render(write_still=True)
        zs = {c: round(rig.contact_world(fr.skeleton, c).z * 100, 1) for c in fr.support}
        low = min(((n, rig.contact_world(fr.skeleton, n).z) for n in rig.CONTACT_POINTS if n not in fr.support), key=lambda x: x[1])
        print(f"KEY {slug} t={t:.2f} support={zs} lowest={low[0]}:{low[1] * 100:.1f}cm")
    print(f"REPORT {slug} {json.dumps({'snap': round(report.max_snap_cm, 1), 'minZ': round(report.min_body_z_cm, 1), 'com': report.com_margin_cm and round(report.com_margin_cm, 1), 'clamped': len(report.clamped)})}")
