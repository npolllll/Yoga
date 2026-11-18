"""Second half of the poster probe (plain Python with Pillow): hash distances to existing posters."""
import glob
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from PIL import Image  # noqa: E402
from postprocess import BACKGROUND  # noqa: E402
from validate_media import ahash, hamming  # noqa: E402

out_dir, slug = sys.argv[1], sys.argv[2]
root = os.path.join(os.path.dirname(HERE), "public", "media", "poses")
others = {s: ahash(Image.open(os.path.join(root, s, "poster.webp"))) for s in sorted(os.listdir(root))
          if s != slug and os.path.exists(os.path.join(root, s, "poster.webp"))}
for p in sorted(glob.glob(os.path.join(out_dir, f"{slug}-*.png"))):
    im = Image.open(p).convert("RGBA")
    bg = Image.new("RGBA", im.size, (*BACKGROUND, 255))
    bg.alpha_composite(im)
    h = ahash(bg.convert("RGB").resize((1280, 960)))
    near = sorted((hamming(h, v), s) for s, v in others.items())[:3]
    print(f"{os.path.basename(p)}: nearest {near}")
