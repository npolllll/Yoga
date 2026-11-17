#!/usr/bin/env bash
# Detached production render: pose queue (resumable) → brand stills → export → validation.
cd "$(dirname "$0")/.."
export EGL_PLATFORM=surfaceless
PY=/opt/pyenv/bin/python
ONLY="${1:-}"
if [ -n "$ONLY" ]; then nice -n 5 $PY pipeline/queue.py --quality final --threads 3 --only "$ONLY"; else nice -n 5 $PY pipeline/queue.py --quality final --threads 3; fi
nice -n 5 blender -b -t 3 --python pipeline/brand.py > pipeline/out/logs/brand.log 2>&1 && $PY pipeline/brand_export.py >> pipeline/out/logs/brand.log 2>&1
$PY pipeline/validate_media.py --sheet > pipeline/out/logs/validate.log 2>&1
echo "ALL DONE $(date -Is)" >> pipeline/out/logs/render_all.log
