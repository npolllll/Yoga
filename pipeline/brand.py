"""
Brand illustrations from the same mascot (transparent background), for the home page:
hero, four level cards (mascot moods), training teaser and the seven category cards.

  EGL_PLATFORM=surfaceless blender -b -t 3 --python pipeline/brand.py -- [--only hero,level-beginner]
Writes PNG masters to pipeline/out/brand/ — then `python pipeline/brand_export.py` → public/media/brand/*.webp.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from balance3d import character, scene as scn  # noqa: E402
from balance3d.motion import FPS, FRAMES, body_points, solve  # noqa: E402

LOTUS = {
    "pose": "stand",
    "set": {"pelvis.pitch": -5, "neck.flex": 5,
            "hip_L.flex": 95, "hip_R.flex": 95, "hip_L.abd": 45, "hip_R.abd": 45, "hip_L.rot": 55, "hip_R.rot": 55,
            "knee_L.flex": 150, "knee_R.flex": 150, "ankle_L.flex": 20, "ankle_R.flex": 20,
            "shoulder_L.flex": 25, "shoulder_R.flex": 25, "shoulder_L.abd": 12, "shoulder_R.abd": 12,
            "elbow_L.flex": 55, "elbow_R.flex": 55, "wrist_L.ext": 30, "wrist_R.ext": 30},
    "support": ["sit"],
    "solve": {"vary": ["hip_*.rot", "hip_*.abd", "elbow_*.flex", "shoulder_*.flex"],
              "goals": [{"near": ["ankle_L", "knee_R"], "d": 0.12}, {"near": ["ankle_R", "knee_L"], "d": 0.12},
                        {"near": ["wrist_L", "knee_L"], "d": 0.08}, {"near": ["wrist_R", "knee_R"], "d": 0.08}], "reg": 0.05},
}

STILLS = {
    "hero": {"keys": [{"t": 0, **LOTUS}], "view": {"azimuth": 0, "elevation": 8}},
    "level-beginner": {"keys": [{"t": 0, **LOTUS, "set": {**LOTUS["set"], "neck.turn": 12}}], "view": {"azimuth": 20, "elevation": 8}},
    "level-intermediate": {"keys": [{"t": 0, "pose": "stand", "set": {"shoulder_R.abd": 150, "elbow_R.flex": 40, "neck.turn": 10, "spine.side": 6, "hip_L.abd": 6, "hip_R.abd": 6}, "support": ["feet"]}], "view": {"azimuth": 15, "elevation": 6}},
    "level-advanced": {"keys": [{"t": 0, "pose": "stand", "set": {"hip_L.flex": 100, "shoulder_L.flex": 95, "shoulder_R.abd": 80, "ankle_L.flex": 40, "spine.flex": -5}, "support": ["foot_R"], "solve": {"vary": ["pelvis.roll", "pelvis.pitch"], "balance": True}}], "view": {"azimuth": 60, "elevation": 6}},
    "level-expert": {"keys": [{"t": 0, "pose": "stand", "set": {"shoulder_L.abd": 150, "shoulder_R.abd": 150, "shoulder_L.flex": 20, "shoulder_R.flex": 20, "elbow_L.flex": 20, "elbow_R.flex": 20, "neck.flex": -15, "hip_L.abd": 10, "hip_R.abd": 10}, "support": ["feet"]}], "view": {"azimuth": 10, "elevation": 6}},
    "training": {"keys": [{"t": 0, "pose": "plank", "support": ["hands", "toes"], "solve": {"vary": ["pelvis.pitch", "shoulder_*.flex"], "goals": [{"over": ["shoulder_L", "hand_L"]}]}}], "view": {"azimuth": 70, "elevation": 8}},
}

# Category cards use the poster frame of a representative pose config.
CATEGORY_POSES = {
    "arm-balances": "bakasana",
    "side-balances": "parsva-bakasana",
    "shoulder-balances": "salamba-sarvangasana",
    "handstands": "adho-mukha-vrksasana",
    "forearm-balances": "pincha-mayurasana",
    "one-arm-balances": "eka-hasta-vrksasana",
    "transitions": "crow-to-chaturanga",
}

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--only", default="")
ap.add_argument("--preview", action="store_true")
args = ap.parse_args(argv)
only = set(filter(None, args.only.split(",")))
out = os.path.join(HERE, "out", "brand")
os.makedirs(out, exist_ok=True)

jobs = dict(STILLS)
for cat, slug in CATEGORY_POSES.items():
    path = os.path.join(HERE, "poses", f"{slug}.json")
    if os.path.exists(path):
        cfg = json.load(open(path))
        jobs[f"category-{cat}"] = {**cfg, "time": cfg.get("poster", 7.0)}

for name, cfg in jobs.items():
    if only and name not in only:
        continue
    cfg = {**cfg}
    cfg.setdefault("poster", 0.1)
    cfg.setdefault("hold", [0, 0.2])
    frames, report = solve(cfg)
    f = min(int(round(cfg.get("time", 0) * FPS)), FRAMES - 1)
    scene = scn.reset_scene()
    scn.setup_world(scene, transparent=True)
    parts = character.build_character()
    for obj, joint in parts:
        obj.matrix_world = frames[f].skeleton.matrices[joint]
    view = cfg.get("view", {})
    scn.fit_camera(scene, body_points([frames[f]]), view.get("azimuth", 30), view.get("elevation", 8), lens=70, margin=1.04)
    scn.configure_render(scene, "preview" if args.preview else "still", 1024, 1024)
    if not args.preview:
        scene.cycles.samples = 48
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = os.path.join(out, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"BRAND {name} minZ={report.min_body_z_cm:.1f} com={report.com_margin_cm}", flush=True)
