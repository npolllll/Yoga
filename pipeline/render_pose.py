"""
Render one asana animation inside Blender.

  blender -b --python pipeline/render_pose.py -- --slug bakasana --quality final
  qualities: preview (Workbench, fast) | final (Cycles, 16 spp + denoise)

Outputs (pipeline/out/<slug>/<quality>/): frames/0001.png…0300.png, stills (final), report.json,
and for final quality the source scene pipeline/out/<slug>/<slug>.blend.
Resumable: existing frames are skipped; identical consecutive poses reuse the previous frame.
"""
import argparse
import json
import os
import shutil
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from balance3d.build import build_scene, report_dict  # noqa: E402
from balance3d.character import CHARACTER_VERSION  # noqa: E402
from balance3d.motion import FPS, FRAMES  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--slug", required=True)
ap.add_argument("--quality", default="preview", choices=["preview", "final"])
ap.add_argument("--no-stills", action="store_true")
ap.add_argument("--frames", default="", help="e.g. 0-60 (0-based) for partial test renders")
args = ap.parse_args(argv)

config = json.load(open(os.path.join(HERE, "poses", f"{args.slug}.json")))
out = os.path.join(HERE, "out", args.slug, args.quality)
frames_dir = os.path.join(out, "frames")
# Resume only frames rendered from the SAME config + character + pipeline code; otherwise start over.
import hashlib  # noqa: E402

_h = hashlib.sha256(json.dumps(config, sort_keys=True).encode())
_h.update(CHARACTER_VERSION.encode())
for _f in sorted(os.listdir(os.path.join(HERE, "balance3d"))):
    if _f.endswith(".py"):
        _h.update(open(os.path.join(HERE, "balance3d", _f), "rb").read())
config_hash = _h.hexdigest()[:16]
hash_file = os.path.join(out, ".config-hash")
if os.path.exists(out) and (not os.path.exists(hash_file) or open(hash_file).read().strip() != config_hash):
    shutil.rmtree(out)
os.makedirs(frames_dir, exist_ok=True)
with open(hash_file, "w") as _fh:
    _fh.write(config_hash)

W, H = (640, 480) if args.quality == "preview" else (720, 540)
t0 = time.time()
scene, parts, frames, report = build_scene(config, args.quality, W, H)
if args.quality == "final":
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "out", args.slug, f"{args.slug}.blend"), compress=True)

lo, hi = 0, FRAMES - 1
if args.frames:
    a, b = args.frames.split("-")
    lo, hi = int(a), int(b)

rendered = reused = skipped = 0
prev_sig, prev_path = None, None
for fr in frames[lo : hi + 1]:
    path = os.path.join(frames_dir, f"{fr.index + 1:04d}.png")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        skipped += 1
    elif fr.signature == prev_sig and prev_path and os.path.exists(prev_path):
        shutil.copyfile(prev_path, path)
        reused += 1
    else:
        scene.frame_set(fr.index + 1)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        rendered += 1
    prev_sig, prev_path = fr.signature, path
    if (fr.index + 1) % 30 == 0:
        print(f"PROGRESS {args.slug} {fr.index + 1}/{FRAMES} rendered={rendered} reused={reused} skipped={skipped} t={time.time() - t0:.0f}s", flush=True)

stills = {}
if args.quality == "final" and not args.no_stills:
    stills_dir = os.path.join(out, "stills")
    os.makedirs(stills_dir, exist_ok=True)
    scene.render.resolution_x, scene.render.resolution_y = 1280, 960
    scene.cycles.samples = 48
    times = {"poster": config.get("poster", 7.0)}
    for i, t in enumerate(config.get("keyframes", [])):
        times[f"keyframe-{i}"] = t
    for name, t in times.items():
        path = os.path.join(stills_dir, f"{name}.png")
        f = min(int(round(t * FPS)), FRAMES - 1)
        if not os.path.exists(path):
            scene.frame_set(f + 1)
            scene.render.filepath = path
            bpy.ops.render.render(write_still=True)
        stills[name] = {"file": path, "t": t, "frame": f}

meta = {
    "slug": args.slug,
    "quality": args.quality,
    "characterVersion": CHARACTER_VERSION,
    "configVersion": config.get("version", 1),
    "configHash": config_hash,
    "fps": FPS,
    "frames": FRAMES,
    "resolution": [W, H],
    "engine": scene.render.engine,
    "blender": bpy.app.version_string,
    "renderSeconds": round(time.time() - t0, 1),
    "rendered": rendered,
    "reused": reused,
    "skipped": skipped,
    "motion": report_dict(report),
    "stills": stills,
}
with open(os.path.join(out, "report.json"), "w") as fh:
    json.dump(meta, fh, indent=2)
print("DONE", json.dumps({k: meta[k] for k in ("slug", "quality", "rendered", "reused", "renderSeconds")}), flush=True)
