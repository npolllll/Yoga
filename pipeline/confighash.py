"""Content hash of everything that determines a pose render: the pose config, the character version and the
rig/motion/scene code. Shared by render_pose.py (inside Blender) and queue.py (plain Python)."""
from __future__ import annotations

import hashlib
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def character_version() -> str:
    src = open(os.path.join(HERE, "balance3d", "character.py"), encoding="utf-8").read()
    m = re.search(r'^CHARACTER_VERSION\s*=\s*"([^"]+)"', src, re.M)
    return m.group(1) if m else "unknown"


def config_hash(slug: str) -> str:
    config = json.load(open(os.path.join(HERE, "poses", f"{slug}.json"), encoding="utf-8"))
    h = hashlib.sha256(json.dumps(config, sort_keys=True).encode())
    h.update(character_version().encode())
    for f in sorted(os.listdir(os.path.join(HERE, "balance3d"))):
        if f.endswith(".py"):
            h.update(open(os.path.join(HERE, "balance3d", f), "rb").read())
    return h.hexdigest()[:16]
