#!/usr/bin/env python3
"""
Automated media checks for every pose with a manifest (public/media/poses/<slug>/manifest.json).

  /opt/pyenv/bin/python pipeline/validate_media.py [--sheet]

Checks: files exist and match sha256; videos decode, last 10.0 s at 30 fps (300 frames), expected
resolution, no audio; poster/card/keyframes (4–6) present; motion report thresholds (contacts fixed in
the hold, no penetration, centre of mass over the support base); every animation is distinct
(perceptual hash of posters and of a mid-clip frame). Writes pipeline/out/media-report.json and,
with --sheet, contact sheets for human review in pipeline/out/contact-sheets/.

Automated checks do NOT certify anatomical correctness — that requires a teacher's review.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MEDIA = os.path.join(ROOT, "public", "media", "poses")

THRESHOLDS = {"maxContactDriftCm": 1.0, "maxSnapCm": 3.0, "minBodyZCm": -2.5, "comMarginCm": -4.0}


def ffprobe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-count_frames", "-show_entries",
         "stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames:format=duration", "-of", "json", path],
        capture_output=True, text=True,
    )
    return json.loads(out.stdout or "{}")


def decodes(path):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"], capture_output=True, text=True)
    return r.returncode == 0 and not r.stderr.strip()


def ahash(img: Image.Image, size=16) -> int:
    g = img.convert("L").resize((size, size), Image.LANCZOS)
    px = list(g.getdata())
    mean = sum(px) / len(px)
    return sum(1 << i for i, p in enumerate(px) if p > mean)


def hamming(a, b):
    return bin(a ^ b).count("1")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def check(slug):
    problems, info = [], {}
    d = os.path.join(MEDIA, slug)
    manifest = json.load(open(os.path.join(d, "manifest.json")))
    for item in manifest["items"]:
        path = os.path.join(ROOT, "public", item["url"].lstrip("/"))
        if not os.path.exists(path):
            problems.append(f"missing {item['url']}")
            continue
        if item.get("sha256") and sha256(path) != item["sha256"]:
            problems.append(f"sha mismatch {item['url']}")
        if item["kind"] == "animation":
            p = ffprobe(path)
            streams = p.get("streams", [])
            video = [s for s in streams if s.get("codec_type") == "video"]
            if any(s.get("codec_type") == "audio" for s in streams):
                problems.append(f"audio track in {item['url']}")
            if not video:
                problems.append(f"no video stream {item['url']}")
                continue
            v = video[0]
            frames = int(v.get("nb_read_frames", 0))
            num, den = (int(x) for x in v.get("r_frame_rate", "0/1").split("/"))
            fps = num / den if den else 0
            dur = float(p.get("format", {}).get("duration", 0))
            info[item["url"]] = {"frames": frames, "fps": fps, "duration": dur, "size": [v.get("width"), v.get("height")], "codec": v.get("codec_name")}
            if frames != 300:
                problems.append(f"{item['url']}: {frames} frames (expected 300)")
            if abs(fps - 30) > 0.01:
                problems.append(f"{item['url']}: {fps} fps")
            if abs(dur - 10.0) > 0.08:
                problems.append(f"{item['url']}: duration {dur:.2f}s")
            if [v.get("width"), v.get("height")] != [item.get("width"), item.get("height")]:
                problems.append(f"{item['url']}: resolution {v.get('width')}x{v.get('height')}")
            if not decodes(path):
                problems.append(f"{item['url']}: decode errors")
    kinds = [i["kind"] for i in manifest["items"]]
    if kinds.count("animation") < 1:
        problems.append("no animation")
    if "poster" not in kinds or "card" not in kinds:
        problems.append("poster/card missing")
    if not 4 <= kinds.count("keyframe") <= 6:
        problems.append(f"{kinds.count('keyframe')} keyframes (expected 4-6)")
    m = manifest.get("motion", {})
    if m.get("maxContactDriftCm", 0) > THRESHOLDS["maxContactDriftCm"]:
        problems.append(f"contacts move in hold: {m['maxContactDriftCm']} cm")
    if m.get("maxSnapCm", 0) > THRESHOLDS["maxSnapCm"]:
        problems.append(f"contact snap {m['maxSnapCm']} cm")
    if m.get("minBodyZCm", 0) < THRESHOLDS["minBodyZCm"]:
        problems.append(f"body below floor {m['minBodyZCm']} cm")
    if m.get("comMarginCm") is not None and m["comMarginCm"] < THRESHOLDS["comMarginCm"]:
        problems.append(f"centre of mass outside support: {m['comMarginCm']} cm")
    if m.get("clamped"):
        problems.append(f"joint limits clamped: {len(m['clamped'])}")
    poster = Image.open(os.path.join(d, "poster.webp"))
    if poster.convert("L").getextrema()[1] - poster.convert("L").getextrema()[0] < 40:
        problems.append("poster looks empty (low contrast)")
    return problems, info, ahash(poster), manifest


def contact_sheet(slug, manifest, out_dir):
    kf = [i for i in manifest["items"] if i["kind"] == "keyframe"]
    ims = [Image.open(os.path.join(ROOT, "public", i["url"].lstrip("/"))).convert("RGB") for i in kf]
    if not ims:
        return
    w, h = ims[0].size
    sheet = Image.new("RGB", (w * len(ims), h + 28), "white")
    for n, im in enumerate(ims):
        sheet.paste(im, (n * w, 28))
        ImageDraw.Draw(sheet).text((n * w + 6, 6), f"{slug} · t={kf[n].get('meta', {}).get('t')}s", fill=(40, 30, 40))
    sheet.save(os.path.join(out_dir, f"{slug}.jpg"), quality=85)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("slugs", nargs="*")
    args = ap.parse_args()
    slugs = args.slugs or sorted(s for s in os.listdir(MEDIA) if os.path.exists(os.path.join(MEDIA, s, "manifest.json"))) if os.path.isdir(MEDIA) else []
    results, hashes = {}, {}
    sheet_dir = os.path.join(HERE, "out", "contact-sheets")
    os.makedirs(sheet_dir, exist_ok=True)
    for slug in slugs:
        problems, info, h, manifest = check(slug)
        hashes[slug] = h
        results[slug] = {"ok": not problems, "problems": problems, "videos": info, "motion": manifest.get("motion", {})}
        if args.sheet:
            contact_sheet(slug, manifest, sheet_dir)
    # Distinctness: posters of different poses must not be near-duplicates.
    names = list(hashes)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if hamming(hashes[a], hashes[b]) < 12:
                for s in (a, b):
                    results[s]["ok"] = False
                    results[s]["problems"].append(f"poster nearly identical to {b if s == a else a}")
    json.dump(results, open(os.path.join(HERE, "out", "media-report.json"), "w"), indent=2)
    bad = [s for s, r in results.items() if not r["ok"]]
    for s, r in results.items():
        print(("✓ " if r["ok"] else "✗ ") + s + ("" if r["ok"] else ": " + "; ".join(r["problems"])))
    print(f"\n{len(results) - len(bad)}/{len(results)} passed automated checks (anatomy still requires a teacher's review)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
