"""
Reusable base poses (semantic joint angles, see rig.py for conventions). Asana configs combine
them with per-key overrides. A pose may "extend" another one. `sym` keys apply to both sides.
"""
from __future__ import annotations

POSES: dict[str, dict] = {
    "stand": {},
    "stand_arms_up": {"extends": "stand", "sym": {"shoulder.flex": 175}},
    # Deep squat on the toes, knees apart, hands forward (Malasana-like start).
    "squat": {
        "set": {"pelvis.pitch": 30, "spine.flex": 20, "neck.flex": -15},
        "sym": {"hip.flex": 135, "hip.abd": 22, "hip.rot": 15, "knee.flex": 150, "ankle.flex": -5,
                "shoulder.flex": 40, "elbow.flex": 30},
    },
    # Squat with palms on the floor in front, shoulder-width apart.
    "squat_hands": {
        "extends": "squat",
        "set": {"pelvis.pitch": 55, "spine.flex": 35, "neck.flex": -35},
        "sym": {"hip.flex": 125, "knee.flex": 140, "ankle.flex": 0, "shoulder.flex": 70, "shoulder.abd": 8,
                "elbow.flex": 0, "wrist.ext": 60},
    },
    # Crow hold: knees on the upper arms, elbows bent, feet lifted, gaze forward.
    "crow": {
        "set": {"pelvis.pitch": 62, "spine.flex": 42, "neck.flex": -60},
        "sym": {"hip.flex": 140, "hip.abd": 16, "hip.rot": 10, "knee.flex": 150, "ankle.flex": 35,
                "shoulder.flex": 52, "shoulder.abd": 10, "elbow.flex": 72, "wrist.ext": 80},
    },
    # Plank: straight body, arms vertical, hands under shoulders.
    "plank": {
        "set": {"pelvis.pitch": 75, "neck.flex": -20},
        "sym": {"shoulder.flex": 75, "wrist.ext": 90, "ankle.flex": -15},
    },
    "chaturanga": {
        "extends": "plank",
        "set": {"pelvis.pitch": 90, "neck.flex": -25},
        "sym": {"shoulder.flex": 15, "elbow.flex": 95, "wrist.ext": 90, "ankle.flex": -45},
    },
    # Downward-facing dog (inverted V).
    "down_dog": {
        "set": {"pelvis.pitch": 135, "spine.flex": -10, "neck.flex": 10},
        "sym": {"hip.flex": 100, "shoulder.flex": 165, "wrist.ext": 80, "ankle.flex": -15},
    },
    # Dolphin: forearms on the floor, hips high.
    "dolphin": {
        "set": {"pelvis.pitch": 130, "spine.flex": -5, "neck.flex": 20},
        "sym": {"hip.flex": 95, "shoulder.flex": 135, "elbow.flex": 95, "wrist.ext": 0, "ankle.flex": -15},
    },
    # Handstand: straight line, stacked over the hands.
    "handstand": {
        "set": {"pelvis.pitch": 180, "neck.flex": -10},
        "sym": {"shoulder.flex": 180, "wrist.ext": 90, "ankle.flex": 40},
    },
    # Forearm stand (Pincha): forearms parallel on the floor.
    "forearm_stand": {
        "set": {"pelvis.pitch": 180, "spine.flex": -18, "neck.flex": -35},
        "sym": {"shoulder.flex": 125, "elbow.flex": 95, "ankle.flex": 40},
    },
    # Side plank on the right hand: body sideways (right side down), top arm up, feet stacked.
    "side_plank": {
        "set": {"pelvis.roll": -72, "neck.turn": 25},
        "sym": {"ankle.flex": -5},
        "R": {"shoulder.abd": 72, "wrist.dev": 0, "wrist.ext": 0, "hip.abd": 0},
        "L": {"shoulder.abd": 108, "hip.abd": 0},
    },
}


POSES.update({
    # Squat with knees and feet together (side-crow start).
    "squat_tight": {
        "extends": "squat",
        "sym": {"hip.abd": 2, "hip.rot": 0, "hip.flex": 140, "knee.flex": 155, "ankle.flex": 5},
    },
    # Standing split lunge with palms on the floor (handstand entry), right leg standing.
    "lunge_hands": {
        "set": {"pelvis.pitch": 118, "spine.flex": 0, "neck.flex": -30},
        "sym": {"shoulder.flex": 175, "wrist.ext": 85},
        "R": {"hip.flex": 115, "knee.flex": 15, "ankle.flex": -10},
        "L": {"hip.flex": 0, "knee.flex": 5, "ankle.flex": 30},
    },
    "handstand_straddle": {
        "extends": "handstand",
        "sym": {"hip.abd": 55, "ankle.flex": 45},
    },
    # Kneeling with forearms on the floor (exit to Child's Pose).
    "kneel_forearms": {
        "set": {"pelvis.pitch": 95, "spine.flex": 35, "neck.flex": 10},
        "sym": {"hip.flex": 125, "knee.flex": 150, "ankle.flex": 60, "shoulder.flex": 150, "elbow.flex": 90, "wrist.ext": 0},
    },
})


def _apply_sym(out: dict[str, float], values: dict[str, float], sides=("L", "R")):
    for k, v in values.items():
        joint, param = k.split(".")
        for s in sides:
            out[f"{joint}_{s}.{param}"] = v


def resolve_pose(name: str) -> dict[str, float]:
    spec = POSES[name]
    out: dict[str, float] = dict(resolve_pose(spec["extends"])) if "extends" in spec else {}
    out.update(spec.get("set", {}))
    _apply_sym(out, spec.get("sym", {}))
    _apply_sym(out, spec.get("L", {}), ("L",))
    _apply_sym(out, spec.get("R", {}), ("R",))
    return out
