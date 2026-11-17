"""
Quick visual check of library poses / character turnaround (Workbench, fast).
  blender -b --python pipeline/posesheet.py -- --out DIR [--poses stand,squat] [--turnaround] [--cycles]
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from balance3d import character, rig, scene as scn  # noqa: E402
from balance3d.motion import solve, body_points  # noqa: E402
from balance3d.poselib import POSES  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--poses", default="")
ap.add_argument("--support", default="")
ap.add_argument("--azimuth", type=float, default=60)
ap.add_argument("--turnaround", action="store_true")
ap.add_argument("--cycles", action="store_true")
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

DEFAULT_SUPPORT = {
    "stand": ["feet"], "stand_arms_up": ["feet"], "squat": ["toes"], "squat_hands": ["toes", "hands"],
    "crow": ["hands"], "plank": ["hands", "toes"], "chaturanga": ["hands", "toes"], "down_dog": ["hands", "feet"],
    "dolphin": ["forearms", "feet"], "handstand": ["hands"], "forearm_stand": ["forearms"], "side_plank": ["hand_R", "foot_R"],
}

names = [p for p in args.poses.split(",") if p] or list(POSES)
for name in names:
    support = args.support.split(",") if args.support else DEFAULT_SUPPORT.get(name, ["feet"])
    views = [("front", 0), ("q", 45), ("side", 90)] if args.turnaround else [("v", args.azimuth)]
    for vname, az in views:
        scene = scn.reset_scene()
        scn.setup_world(scene)
        parts = character.build_character()
        config = {"keys": [{"t": 0, "pose": name, "support": support}], "poster": 0.1, "hold": [0, 0.2]}
        frames, report = solve(config)
        fr = frames[0]
        for obj, joint in parts:
            obj.matrix_world = fr.skeleton.matrices[joint]
        scn.fit_camera(scene, body_points(frames[:1]), az, 8)
        scn.configure_render(scene, "still" if args.cycles else "preview", 640, 480)
        scene.render.filepath = os.path.join(args.out, f"{name}-{vname}.png")
        bpy.ops.render.render(write_still=True)
        print(f"POSE {name} {vname} clamped={report.clamped} minZ={report.min_body_z_cm:.1f} com={report.com_margin_cm}")
