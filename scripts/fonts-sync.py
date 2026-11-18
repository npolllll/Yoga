#!/usr/bin/env python3
"""Copy @fontsource-variable/{manrope,lora} woff2 files to public/fonts/v5/ and write src/app/fonts.css.

Self-hosting under a stable path lets the layout preload the core subsets (fontsource CSS imported through the
bundler gets hashed URLs that cannot be preloaded). Run after upgrading the font packages; bump the version
folder (and the paths in src/app/[locale]/layout.tsx) when the files change."""
import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "fonts", "v5")
os.makedirs(OUT, exist_ok=True)
css_parts = ["/* Self-hosted copies of @fontsource-variable/{manrope,lora}@5 (SIL OFL), same @font-face rules and unicode ranges.",
             "   Served from /fonts/v5/ so the layout can preload the core subsets (see src/app/[locale]/layout.tsx).",
             "   Regenerate with scripts/fonts-sync.py after upgrading the packages. */"]
for pkg in ("manrope", "lora"):
    base = os.path.join(ROOT, "node_modules", "@fontsource-variable", pkg)
    css = open(os.path.join(base, "wght.css"), encoding="utf-8").read()

    def copy(m):
        name = m.group(1)
        shutil.copy(os.path.join(base, "files", name), os.path.join(OUT, name))
        return f"url(/fonts/v5/{name})"

    css_parts.append(re.sub(r"url\(\./files/([^)]+)\)", copy, css).strip())
open(os.path.join(ROOT, "src", "app", "fonts.css"), "w", encoding="utf-8").write("\n\n".join(css_parts) + "\n")
print("fonts synced to", OUT)
