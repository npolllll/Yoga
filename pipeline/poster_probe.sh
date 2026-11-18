#!/usr/bin/env bash
# Usage: pipeline/poster_probe.sh <slug> <azimuth:elevation> [...]  (see pipeline/poster_probe.py)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="pipeline/out/probe"
EGL_PLATFORM=surfaceless blender -b -t "${THREADS:-4}" --python pipeline/poster_probe.py -- "$OUT" "$@" > pipeline/out/logs/poster_probe.log 2>&1
/opt/pyenv/bin/python pipeline/poster_probe_hash.py "$OUT" "$1"
