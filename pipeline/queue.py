#!/usr/bin/env python3
"""
Sequential render queue with resume, retries and per-pose logs.

  /opt/pyenv/bin/python pipeline/queue.py [--quality final] [--only slug1,slug2] [--threads 3]

State: pipeline/out/queue.json  ·  Logs: pipeline/out/logs/<slug>-<quality>.log
A pose is "done" when its manifest exists and its config/character version match. Renders run one at a
time (memory-safe on 16 GB machines); frames already rendered are kept, so an interrupted job resumes.
"""
import argparse
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from confighash import config_hash  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STATE = os.path.join(HERE, "out", "queue.json")
PY = "/opt/pyenv/bin/python" if os.path.exists("/opt/pyenv/bin/python") else sys.executable


def load_state():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


def save_state(state):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(state, open(STATE, "w"), indent=2)


def is_done(slug, quality):
    manifest = os.path.join(ROOT, "public", "media", "poses", slug, "manifest.json")
    if quality != "final" or not os.path.exists(manifest):
        return False
    cfg = json.load(open(os.path.join(HERE, "poses", f"{slug}.json")))
    m = json.load(open(manifest))
    # Compare with the hash of the CURRENT config + character + rig code (not the hash recorded when the old
    # render started), so a character or rig change re-renders every pose.
    return (m.get("generatedFrom", {}).get("configVersion") == cfg.get("version", 1) and m.get("quality") == "final"
            and m.get("generatedFrom", {}).get("configHash") == config_hash(slug))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", default="final")
    ap.add_argument("--only", default="")
    ap.add_argument("--threads", type=int, default=3)
    ap.add_argument("--retries", type=int, default=2)
    args = ap.parse_args()
    def wanted_slugs():
        """Config order. `--only @file` re-reads the file after every pose, so slugs can be appended while the
        queue runs (a config is only listed once it passes its checks)."""
        available = sorted(f[:-5] for f in os.listdir(os.path.join(HERE, "poses")) if f.endswith(".json"))
        if not args.only:
            return available
        if args.only.startswith("@"):
            lines = open(args.only[1:]).read().split()
            wanted = [x.strip() for x in lines if x.strip() and not x.startswith("#")]
        else:
            wanted = args.only.split(",")
        return [s for s in dict.fromkeys(wanted) if s in available]

    state = load_state()
    env = dict(os.environ, EGL_PLATFORM="surfaceless")
    attempted: set[str] = set()
    while True:
        pending = [s for s in wanted_slugs() if s not in attempted]
        if not pending:
            break
        slug = pending[0]
        attempted.add(slug)
        if is_done(slug, args.quality):
            state[slug] = {**state.get(slug, {}), "status": "done"}
            save_state(state)
            continue
        for attempt in range(1, args.retries + 2):
            state[slug] = {"status": "rendering", "attempt": attempt, "started": time.strftime("%Y-%m-%dT%H:%M:%S")}
            save_state(state)
            log = os.path.join(HERE, "out", "logs", f"{slug}-{args.quality}.log")
            os.makedirs(os.path.dirname(log), exist_ok=True)
            with open(log, "a") as fh:
                r = subprocess.run(["blender", "-b", "-t", str(args.threads), "--python", os.path.join(HERE, "render_pose.py"), "--",
                                    "--slug", slug, "--quality", args.quality], stdout=fh, stderr=subprocess.STDOUT, env=env)
                ok = r.returncode == 0 and "DONE" in open(log).read()[-4000:]
                if ok and args.quality == "final":
                    p = subprocess.run([PY, os.path.join(HERE, "postprocess.py"), slug, "--quality", args.quality], stdout=fh, stderr=subprocess.STDOUT)
                    ok = p.returncode == 0
            if ok:
                state[slug] = {"status": "done", "finished": time.strftime("%Y-%m-%dT%H:%M:%S"), "attempts": attempt}
                save_state(state)
                print(f"done {slug}", flush=True)
                break
            state[slug] = {"status": "failed", "attempt": attempt, "log": log}
            save_state(state)
            print(f"failed {slug} (attempt {attempt}), see {log}", flush=True)
    save_state(state)
    failed = [s for s, v in state.items() if v.get("status") == "failed"]
    print(f"queue finished: {sum(1 for v in state.values() if v.get('status') == 'done')} done, {len(failed)} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
