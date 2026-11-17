#!/usr/bin/env python3
"""
Encode rendered frames into web media and write the manifest consumed by the site and seed script.

  /opt/pyenv/bin/python pipeline/postprocess.py <slug> [--quality final|preview]

Outputs public/media/poses/<slug>/:
  <slug>.mp4 (H.264, faststart) · <slug>.webm (VP9) · poster.webp · card.webp · card@2x.webp ·
  keyframe-0..4.webp · manifest.json
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"command failed: {' '.join(cmd)}\n{r.stderr[-2000:]}")
    return r.stdout


BACKGROUND = (248, 241, 246)  # #f8f1f6 = --c-surface-2 (card background)


def flatten(im):
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, BACKGROUND)
        bg.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1])
        return bg
    return im.convert("RGB")


def webp(src, dst, size, quality=80):
    im = flatten(Image.open(src))
    im = im.resize(size, Image.LANCZOS)
    im.save(dst, "WEBP", quality=quality, method=6)
    return im.size


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--quality", default="final")
    args = ap.parse_args()
    slug = args.slug
    src = os.path.join(HERE, "out", slug, args.quality)
    report = json.load(open(os.path.join(src, "report.json")))
    content = json.load(open(os.path.join(ROOT, "content", "poses", f"{slug}.json")))
    name = content["doc"]["name"]
    dst = os.path.join(ROOT, "public", "media", "poses", slug)
    os.makedirs(dst, exist_ok=True)
    frames = os.path.join(src, "frames", "%04d.png")
    w, h = report["resolution"]

    # Composite the (possibly transparent) frames onto the card background colour.
    bg = "0x%02x%02x%02x" % BACKGROUND
    base = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c={bg}:s={w}x{h}:r=30:d=10", "-framerate", "30", "-i", frames,
            "-filter_complex", "[0:v][1:v]overlay=shortest=1,format=yuv420p", "-an", "-frames:v", "300"]
    mp4 = os.path.join(dst, f"{slug}.mp4")
    run(base + ["-c:v", "libx264", "-preset", "slow", "-crf", "24", "-profile:v", "high", "-level", "4.0", "-movflags", "+faststart", mp4])
    webm = os.path.join(dst, f"{slug}.webm")
    run(base + ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", webm])

    items = []
    duration_ms = round(report["frames"] / report["fps"] * 1000)
    items.append({"kind": "animation", "url": f"/media/poses/{slug}/{slug}.webm", "mime": "video/webm", "width": w, "height": h,
                  "durationMs": duration_ms, "frameCount": report["frames"], "fps": report["fps"], "position": 0,
                  "bytes": os.path.getsize(webm), "sha256": sha256(webm), "meta": {"type": 'video/webm; codecs="vp9"'}})
    items.append({"kind": "animation", "url": f"/media/poses/{slug}/{slug}.mp4", "mime": "video/mp4", "width": w, "height": h,
                  "durationMs": duration_ms, "frameCount": report["frames"], "fps": report["fps"], "position": 1,
                  "bytes": os.path.getsize(mp4), "sha256": sha256(mp4), "meta": {"type": 'video/mp4; codecs="avc1.640028"'}})

    stills = report.get("stills", {})
    poster_src = stills.get("poster", {}).get("file") or os.path.join(src, "frames", f"{int(content.get('poster', 7) * 30):04d}.png")
    poster = os.path.join(dst, "poster.webp")
    pw, ph = webp(poster_src, poster, (1280, 960), 82)
    alt = {"ru": f"{name['ru']}: 3D-персонаж в позе", "en": f"{name['en']}: 3D character in the pose"}
    items.append({"kind": "poster", "url": f"/media/poses/{slug}/poster.webp", "mime": "image/webp", "width": pw, "height": ph,
                  "bytes": os.path.getsize(poster), "sha256": sha256(poster), "alt": alt, "position": 0})
    card = os.path.join(dst, "card.webp")
    cw, chh = webp(poster_src, card, (320, 240), 78)
    webp(poster_src, os.path.join(dst, "card@2x.webp"), (640, 480), 74)
    items.append({"kind": "card", "url": f"/media/poses/{slug}/card.webp", "mime": "image/webp", "width": cw, "height": chh,
                  "bytes": os.path.getsize(card), "sha256": sha256(card), "alt": alt, "position": 0})
    keyframes = sorted([k for k in stills if k.startswith("keyframe-")], key=lambda k: int(k.split("-")[1]))
    for i, k in enumerate(keyframes):
        path = os.path.join(dst, f"keyframe-{i}.webp")
        kw, kh = webp(stills[k]["file"], path, (480, 360), 76)
        items.append({"kind": "keyframe", "url": f"/media/poses/{slug}/keyframe-{i}.webp", "mime": "image/webp", "width": kw, "height": kh,
                      "bytes": os.path.getsize(path), "sha256": sha256(path), "position": i,
                      "meta": {"t": stills[k]["t"]}})

    manifest = {"slug": slug, "quality": args.quality, "generatedFrom": {k: report.get(k) for k in ("characterVersion", "configVersion", "configHash", "blender", "engine")},
                "motion": report["motion"], "items": items}
    json.dump(manifest, open(os.path.join(dst, "manifest.json"), "w"), indent=2, ensure_ascii=False)
    total = sum(i.get("bytes", 0) for i in items)
    print(f"OK {slug}: {len(items)} files, {total / 1024:.0f} KiB (mp4 {os.path.getsize(mp4) / 1024:.0f} KiB, webm {os.path.getsize(webm) / 1024:.0f} KiB)")


if __name__ == "__main__":
    sys.exit(main())
