"""
Pose configs → per-frame poses with a contact solver.

A config (pipeline/poses/<slug>.json):
{
  "slug": "bakasana", "view": {"azimuth": 50, "elevation": 8},
  "keys": [ {"t": 0, "pose": "squat_hands", "set": {...}, "support": ["feet", "hands"], "ease": "smooth"}, ... ],
  "keyframes": [0.8, 3, 5, 7, 9.4],   # 5 stills used as step illustrations
  "poster": 7.0,                       # hold frame used for the poster and catalog card
  "hold": [6.0, 8.0]                   # window checked for fixed contacts and balance
}
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from mathutils import Vector

from . import rig
from .poselib import resolve_pose

FPS = 30
DURATION = 10.0
FRAMES = int(FPS * DURATION)  # 300


def smoother(x: float) -> float:
    return x * x * x * (x * (x * 6 - 15) + 10)


@dataclass
class Key:
    t: float
    params: dict[str, float]
    support: list[str]
    ease: str = "smooth"


@dataclass
class Frame:
    index: int
    params: dict[str, float]
    support: list[str]
    root: Vector
    skeleton: rig.Skeleton
    signature: tuple = ()


@dataclass
class MotionReport:
    clamped: list[str] = field(default_factory=list)
    max_contact_drift_cm: float = 0.0  # over the hold window
    max_snap_cm: float = 0.0           # jump when a new contact lands
    min_body_z_cm: float = 0.0         # lowest non-support point (negative = penetration)
    com_margin_cm: float | None = None  # distance of the centre of mass inside (+) / outside (-) the support base in the hold
    unique_frames: int = 0


def fit_objective(params: dict[str, float], support: list[str], balance: bool) -> float:
    sk = rig.forward_kinematics(params)
    zs = [rig.contact_world(sk, c).z for c in support]
    if not zs:
        return 0.0
    mean = sum(zs) / len(zs)
    cost = sum((z - mean) ** 2 for z in zs) * 1e4
    # Penalise any other body point below the support plane.
    others = [n for n in rig.CONTACT_POINTS if n not in support and n != "crown"]
    low = min((rig.contact_world(sk, n).z for n in others), default=mean + 1)
    if low < mean - 0.005:
        cost += (mean - low) ** 2 * 4e3
    if balance:
        com = rig.center_of_mass(sk)
        pts = [rig.contact_world(sk, c) for c in support]
        cx = sum(p.x for p in pts) / len(pts)
        cy = sum(p.y for p in pts) / len(pts)
        cost += ((com.x - cx) ** 2 + (com.y - cy) ** 2) * 2e3
    return cost


def fit_key(params: dict[str, float], support: list[str], fits: list[dict], balance: bool) -> dict[str, float]:
    """Coordinate search over the given parameters so supports touch the floor together (and the COM
    sits over the support base when `balance` is set)."""
    best = dict(params)
    for _ in range(3):
        for spec in fits:
            names = spec["param"] if isinstance(spec["param"], list) else [spec["param"]]
            lo, hi = spec["min"], spec["max"]
            for step in (2.0, 0.5, 0.1):
                cur = best[names[0]] if names[0] in best else (lo + hi) / 2
                candidates = [lo + i * step for i in range(int((hi - lo) / step) + 1)] if step == 2.0 else [cur + i * step for i in range(-5, 6)]
                scored = []
                for v in candidates:
                    v = min(max(v, lo), hi)
                    trial = dict(best)
                    for n in names:
                        trial[n] = v
                    scored.append((fit_objective(trial, support, balance), v))
                _, v = min(scored)
                for n in names:
                    best[n] = v
    return best


def _expand(patterns: list[str]) -> list[str]:
    out = []
    for p in patterns:
        out.extend([p.replace("*", "L"), p.replace("*", "R")] if "*" in p else [p])
    return list(dict.fromkeys(out))


def _point(sk: rig.Skeleton, name: str):
    if name in rig.CONTACT_POINTS:
        return rig.contact_world(sk, name)
    return sk.pos(name)


def solve_objective(params, support, goals, balance, base, reg):
    sk = rig.forward_kinematics(params)
    cost = 0.0
    zs = [rig.contact_world(sk, c).z for c in support]
    plane = sum(zs) / len(zs) if zs else 0.0
    if zs:
        cost += sum((z - plane) ** 2 for z in zs) * 1e4
        others = [n for n in rig.CONTACT_POINTS if n not in support and n not in ("crown",)]
        for n in others:
            dz = rig.contact_world(sk, n).z - plane
            if dz < -0.01:
                cost += (dz + 0.01) ** 2 * 3e3
        if balance:
            com = rig.center_of_mass(sk)
            pts = [rig.contact_world(sk, c) for c in support]
            cx, cy = sum(p.x for p in pts) / len(pts), sum(p.y for p in pts) / len(pts)
            cost += ((com.x - cx) ** 2 + (com.y - cy) ** 2) * 3e3
    for g in goals:
        w = g.get("w", 1.0)
        if "near" in g:
            a, b = (_point(sk, n) for n in g["near"])
            d = (a - b).length - g.get("d", 0.06)
            cost += max(0.0, d) ** 2 * 2e3 * w
        elif "height" in g:
            name, h = g["height"]
            cost += ((_point(sk, name).z - plane) - h) ** 2 * 2e3 * w
        elif "above" in g:
            name, h = g["above"]
            dz = (_point(sk, name).z - plane) - h
            cost += min(0.0, dz) ** 2 * 2e3 * w
        elif "over" in g:
            a, b = (_point(sk, n) for n in g["over"])
            cost += ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) * 2e3 * w
        elif "comover" in g:
            com = rig.center_of_mass(sk)
            q = _point(sk, g["comover"])
            cost += ((com.x - q.x) ** 2 + (com.y - q.y) ** 2) * 3e3 * w
        elif "apart" in g:
            a, b = (_point(sk, n) for n in g["apart"])
            d = (a - b).length - g.get("d", 0.15)
            cost += min(0.0, d) ** 2 * 2e3 * w
    for k, v in params.items():
        lim = rig.LIMITS.get(rig.limit_key(k))
        if lim and not (lim[0] <= v <= lim[1]):
            cost += (min(abs(v - lim[0]), abs(v - lim[1]))) ** 2 * 10
    cost += reg * sum((params.get(k, 0.0) - base.get(k, 0.0)) ** 2 for k in params) / 100.0
    return cost


def solve_key(params: dict[str, float], support: list[str], spec: dict) -> dict[str, float]:
    """Coordinate descent over `vary` parameters to satisfy goals (body-point relations), keep supports
    level on the floor, avoid penetration and (optionally) keep the centre of mass over the base."""
    names = _expand(spec.get("vary", []))
    goals = spec.get("goals", [])
    balance = bool(spec.get("balance"))
    reg = spec.get("reg", 0.05)
    base = dict(params)
    best = dict(params)
    for n in names:
        best.setdefault(n, 0.0)
    cur = solve_objective(best, support, goals, balance, base, reg)
    for step in (16.0, 8.0, 4.0, 2.0, 1.0, 0.5):
        improved = True
        sweeps = 0
        while improved and sweeps < 6:
            improved = False
            sweeps += 1
            for n in names:
                for sgn in (1, -1):
                    trial = dict(best)
                    trial[n] = best[n] + sgn * step
                    c = solve_objective(trial, support, goals, balance, base, reg)
                    if c < cur - 1e-9:
                        best, cur = trial, c
                        improved = True
                        break
    return best


def build_keys(config: dict) -> tuple[list[Key], list[str]]:
    keys: list[Key] = []
    clamped_all: list[str] = []
    prev: dict[str, float] = {}
    for k in config["keys"]:
        params = {} if "pose" in k else dict(prev)
        if "pose" in k:
            params.update(resolve_pose(k["pose"]))
        params.update(k.get("set", {}))
        if k.get("mirror"):
            params = mirror(params)
        if k.get("fit"):
            params = fit_key(params, rig.expand_contacts(k.get("support", [])), k["fit"], bool(k.get("balance")))
        if k.get("solve"):
            params = solve_key(params, rig.expand_contacts(k.get("support", [])), k["solve"])
        params, clamped = rig.clamp_params(params)
        clamped_all += [f"t={k['t']}: {c}" for c in clamped]
        keys.append(Key(float(k["t"]), params, rig.expand_contacts(k.get("support", [])), k.get("ease", "smooth")))
        prev = params
    keys.sort(key=lambda x: x.t)
    if keys[0].t > 0:
        keys.insert(0, Key(0.0, keys[0].params, keys[0].support))
    if keys[-1].t < DURATION:
        keys.append(Key(DURATION, keys[-1].params, keys[-1].support))
    return keys, clamped_all


def mirror(params: dict[str, float]) -> dict[str, float]:
    out = {}
    for k, v in params.items():
        if "_L." in k:
            out[k.replace("_L.", "_R.")] = v
        elif "_R." in k:
            out[k.replace("_R.", "_L.")] = v
        elif k in ("pelvis.roll", "pelvis.yaw", "spine.side", "spine.twist", "neck.turn"):
            out[k] = -v
        else:
            out[k] = v
    return out


FAMILY = {"hand": "hand", "fingers": "hand", "forearm": "forearm", "elbow": "forearm", "foot": "foot", "toes": "foot", "heel": "foot", "knee": "knee"}


def _family(c: str) -> str:
    base, _, side = c.partition("_")
    return f"{FAMILY.get(base, base)}_{side}"


def moving_support(a: list[str], b: list[str]) -> list[str]:
    """Contacts held fixed while moving from key a to key b: those present in both (a foot rolling from toes
    to sole counts as the same contact). Contacts only in a lift off at a; contacts only in b land at b."""
    fam_b = {_family(c) for c in b}
    held = [c for c in a if _family(c) in fam_b]
    return held if held else a


def interpolate(keys: list[Key], t: float) -> tuple[dict[str, float], list[str]]:
    for a, b in zip(keys, keys[1:]):
        if a.t <= t <= b.t:
            span = max(b.t - a.t, 1e-6)
            x = (t - a.t) / span
            w = smoother(x) if b.ease == "smooth" else x
            names = set(a.params) | set(b.params)
            params = {n: a.params.get(n, 0.0) * (1 - w) + b.params.get(n, 0.0) * w for n in names}
            if t <= a.t + 1e-9:
                support = a.support
            elif t >= b.t - 1e-9 or x > 0.985:
                support = b.support
            else:
                support = moving_support(a.support, b.support)
            return params, support
    return keys[-1].params, keys[-1].support


def solve(config: dict) -> tuple[list[Frame], MotionReport]:
    keys, clamped = build_keys(config)
    report = MotionReport(clamped=clamped)
    anchors: dict[str, Vector] = {}
    root = Vector((0.0, 0.0, 0.0))
    frames: list[Frame] = []
    hold = config.get("hold", [config.get("poster", 7.0) - 1, config.get("poster", 7.0) + 1])
    hold_frames = range(int(hold[0] * FPS), int(hold[1] * FPS) + 1)
    hold_positions: dict[str, list[Vector]] = {}

    for f in range(FRAMES):
        t = f / FPS
        params, support = interpolate(keys, t)
        local = rig.forward_kinematics(params)
        pts = {c: rig.contact_world(local, c) for c in support}
        continuing = [c for c in support if c in anchors]
        if f == 0:
            if pts:
                mean = sum(pts.values(), Vector()) / len(pts)
                root = Vector((-mean.x, -mean.y, -mean.z))
            else:
                root = Vector((0, 0, 0))
        elif continuing:
            root = sum((anchors[c] - pts[c] for c in continuing), Vector()) / len(continuing)
        # Register new contacts (snapped to the floor) and release lifted ones.
        for c in support:
            if c not in anchors:
                world = pts[c] + root
                report.max_snap_cm = max(report.max_snap_cm, abs(world.z) * 100 if f > 0 else 0)
                anchors[c] = Vector((world.x, world.y, 0.0))
        for c in list(anchors):
            if c not in support:
                del anchors[c]
        sk = rig.forward_kinematics(params, root)
        if f in hold_frames:
            for c in support:
                hold_positions.setdefault(c, []).append(rig.contact_world(sk, c))
        # Lowest point of the body that is NOT a support (penetration check).
        others = [n for n in rig.CONTACT_POINTS if n not in support and n not in ("crown",)]
        low = min((rig.contact_world(sk, n).z for n in others), default=1.0)
        report.min_body_z_cm = min(report.min_body_z_cm if f else low * 100, low * 100)
        sig = tuple(round(v, 3) for _, v in sorted(params.items())) + tuple(round(v, 4) for v in root)
        frames.append(Frame(f, params, support, root.copy(), sk, sig))

    for c, positions in hold_positions.items():
        ref = positions[0]
        report.max_contact_drift_cm = max(report.max_contact_drift_cm, max((p - ref).length for p in positions) * 100)
    poster_f = min(int(config.get("poster", 7.0) * FPS), FRAMES - 1)
    report.com_margin_cm = com_margin(frames[poster_f])
    report.unique_frames = len({fr.signature for fr in frames})
    return frames, report


def com_margin(frame: Frame) -> float | None:
    """Signed distance (cm) of the COM ground projection to the support base (convex hull of contacts)."""
    if not frame.support:
        return None
    com = rig.center_of_mass(frame.skeleton)
    pts = [rig.contact_world(frame.skeleton, c) for c in frame.support]
    p = Vector((com.x, com.y))
    base = [Vector((q.x, q.y)) for q in pts]
    if len(base) == 1:
        return -(p - base[0]).length * 100 + 6  # a single contact: allow ~6 cm (palm/forearm size)
    hull = convex_hull(base)
    if len(hull) < 3:  # collinear contacts: distance to the segment, with a 6 cm tolerance for limb width
        a, b = hull[0], hull[-1]
        ab = b - a
        tpar = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
        return -(p - (a + ab * tpar)).length * 100 + 6
    inside = all(cross(hull[i], hull[(i + 1) % len(hull)], p) >= 0 for i in range(len(hull)))
    d = min(seg_dist(p, hull[i], hull[(i + 1) % len(hull)]) for i in range(len(hull)))
    return (d if inside else -d) * 100 + 4


def cross(a, b, p):
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length


def convex_hull(points):
    pts = sorted({(round(p.x, 5), round(p.y, 5)) for p in points})
    if len(pts) <= 2:
        return [Vector(p) for p in pts]

    def half(seq):
        h = []
        for q in seq:
            while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (q[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (q[0] - h[-2][0]) <= 0:
                h.pop()
            h.append(q)
        return h

    lower, upper = half(pts), half(reversed(pts))
    return [Vector(p) for p in lower[:-1] + upper[:-1]]


def body_points(frames: list[Frame]) -> list[Vector]:
    """Points used for camera framing: every joint (+head top and bun) over the whole clip."""
    out = []
    for fr in frames[:: max(1, len(frames) // 60)] + [frames[-1]]:
        for name, m in fr.skeleton.matrices.items():
            p = m.to_translation()
            out.append(p)
        head = fr.skeleton.matrices["head"]
        for off in ((0, 0, 0.32), (0.14, 0, 0.13), (-0.14, 0, 0.13), (0, -0.14, 0.13), (0, 0.15, 0.2)):
            out.append(head @ Vector(off))
        for c in ("hand_L", "hand_R", "foot_L", "foot_R", "toes_L", "toes_R", "heel_L", "heel_R"):
            out.append(rig.contact_world(fr.skeleton, c))
    # Include the floor directly below the body so the contact shadow stays in frame.
    floor = [Vector((p.x, p.y, 0.0)) for p in out if p.z < 0.25]
    return out + floor[:: 4]


def unused():  # keep math imported for future easing curves
    return math.pi
