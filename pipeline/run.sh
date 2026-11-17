#!/usr/bin/env bash
# Render queue for all pose configs (resumable). Usage: pnpm media:build [-- --only bakasana,handstand]
set -euo pipefail
cd "$(dirname "$0")/.."
PY=/opt/pyenv/bin/python
[ -x "$PY" ] || PY=python3
"$PY" pipeline/queue.py --quality final "$@"
"$PY" pipeline/validate_media.py --sheet
