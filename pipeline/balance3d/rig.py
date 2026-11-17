"""
BALANCE rig: a joint hierarchy with semantic controls, joint limits, forward kinematics and a
contact solver. Runs inside Blender (uses mathutils) and drives rigid, smooth body parts.

Conventions (rest pose = standing, arms hanging, facing -Y; character's left = +X, up = +Z).
All semantic angles are in degrees. Positive values:
  pelvis.pitch   upper body tilts forward (towards -Y)      pelvis.roll  tilt to the character's left
  pelvis.yaw     turn to the character's left              spine.flex   forward bend (split waist/chest)
  spine.side     bend to the left                          spine.twist  rotate chest to the left
  neck.flex      chin down                                 neck.turn    look left
  shoulder.flex  raise arm forward (180 = overhead)        shoulder.abd raise arm sideways
  shoulder.rot   internal rotation                         elbow.flex   bend elbow
  wrist.ext      hand bends back (palm flat on the floor when the arm is vertical: ~90)
  hip.flex       knee forward/up                           hip.abd      leg out to the side
  hip.rot        external rotation (knee out)              knee.flex    heel towards the buttock
  ankle.flex     point the toes (plantar flexion); negative = dorsiflexion
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from mathutils import Matrix, Vector

SIDES = ("L", "R")

# ---------------------------------------------------------------------------------------------
# Skeleton: joint -> (parent, rest offset in the parent's frame). Units: metres. Height ~1.66 m,
# head ≈ 1/5.5 of height (soft stylised proportions that keep contact points readable).
# ---------------------------------------------------------------------------------------------
JOINTS: dict[str, tuple[str | None, tuple[float, float, float]]] = {
    "pelvis": (None, (0.0, 0.0, 0.90)),
    "waist": ("pelvis", (0.0, 0.0, 0.11)),
    "chest": ("waist", (0.0, 0.0, 0.15)),
    "neck": ("chest", (0.0, 0.0, 0.15)),
    "head": ("neck", (0.0, 0.0, 0.07)),
}
for s, sx in (("L", 1.0), ("R", -1.0)):
    JOINTS.update(
        {
            f"shoulder_{s}": ("chest", (0.165 * sx, 0.0, 0.115)),
            f"elbow_{s}": (f"shoulder_{s}", (0.0, 0.0, -0.265)),
            f"wrist_{s}": (f"elbow_{s}", (0.0, 0.0, -0.235)),
            f"fingers_{s}": (f"wrist_{s}", (0.0, 0.0, -0.155)),
            f"hip_{s}": ("pelvis", (0.09 * sx, 0.0, -0.045)),
            f"knee_{s}": (f"hip_{s}", (0.0, 0.0, -0.405)),
            f"ankle_{s}": (f"knee_{s}", (0.0, 0.0, -0.39)),
            f"toe_{s}": (f"ankle_{s}", (0.0, -0.16, -0.055)),
        }
    )

ORDER = list(JOINTS.keys())

# Joint limits for semantic controls (degrees). Poses are clamped, never silently exceeded.
LIMITS: dict[str, tuple[float, float]] = {
    "spine.flex": (-70, 150),
    "spine.side": (-60, 60),
    "spine.twist": (-80, 80),
    "neck.flex": (-60, 70),
    "neck.turn": (-80, 80),
    "shoulder.flex": (-70, 200),
    "shoulder.abd": (-40, 190),
    "shoulder.rot": (-100, 100),
    "elbow.flex": (0, 160),
    "wrist.ext": (-80, 100),
    "wrist.dev": (-40, 40),
    "hip.flex": (-50, 150),
    "hip.abd": (-35, 100),
    "hip.rot": (-60, 80),
    "knee.flex": (0, 165),
    "ankle.flex": (-50, 80),
}

PARAMS = [
    "pelvis.pitch", "pelvis.roll", "pelvis.yaw",
    "spine.flex", "spine.side", "spine.twist",
    "neck.flex", "neck.turn",
] + [f"{j}_{s}.{p}" for s in SIDES for j, ps in (
    ("shoulder", ("flex", "abd", "rot")), ("elbow", ("flex",)), ("wrist", ("ext", "dev")),
    ("hip", ("flex", "abd", "rot")), ("knee", ("flex",)), ("ankle", ("flex",)),
) for p in ps]


def limit_key(param: str) -> str:
    joint, p = param.split(".")
    return f"{joint.split('_')[0]}.{p}"


def clamp_params(params: dict[str, float]) -> tuple[dict[str, float], list[str]]:
    out, clamped = {}, []
    for k, v in params.items():
        lim = LIMITS.get(limit_key(k))
        if lim and not (lim[0] <= v <= lim[1]):
            clamped.append(f"{k}={v:.0f} -> [{lim[0]}, {lim[1]}]")
            v = min(max(v, lim[0]), lim[1])
        out[k] = v
    return out, clamped


def _rx(d: float) -> Matrix:
    return Matrix.Rotation(math.radians(d), 4, "X")


def _ry(d: float) -> Matrix:
    return Matrix.Rotation(math.radians(d), 4, "Y")


def _rz(d: float) -> Matrix:
    return Matrix.Rotation(math.radians(d), 4, "Z")


def local_rotation(joint: str, p: dict[str, float]) -> Matrix:
    g = lambda k: p.get(k, 0.0)  # noqa: E731
    if joint == "pelvis":
        return _rz(g("pelvis.yaw")) @ _ry(g("pelvis.roll")) @ _rx(g("pelvis.pitch"))
    if joint in ("waist", "chest"):
        return _rz(g("spine.twist") / 2) @ _ry(g("spine.side") / 2) @ _rx(g("spine.flex") / 2)
    if joint == "neck":
        return _rz(g("neck.turn") / 2) @ _rx(g("neck.flex") / 2)
    if joint == "head":
        return _rz(g("neck.turn") / 2) @ _rx(g("neck.flex") / 2)
    base, _, side = joint.partition("_")
    sx = 1.0 if side == "L" else -1.0
    if base == "shoulder":
        return _ry(-sx * g(f"shoulder_{side}.abd")) @ _rx(-g(f"shoulder_{side}.flex")) @ _rz(-sx * g(f"shoulder_{side}.rot"))
    if base == "elbow":
        return _rx(-g(f"elbow_{side}.flex"))
    if base == "wrist":
        return _rx(-g(f"wrist_{side}.ext")) @ _ry(-sx * g(f"wrist_{side}.dev"))
    if base == "hip":
        return _ry(-sx * g(f"hip_{side}.abd")) @ _rx(-g(f"hip_{side}.flex")) @ _rz(sx * g(f"hip_{side}.rot"))
    if base == "knee":
        return _rx(g(f"knee_{side}.flex"))
    if base == "ankle":
        return _rx(g(f"ankle_{side}.flex"))
    return Matrix.Identity(4)


@dataclass
class Skeleton:
    """World matrices of every joint for one parameter set (root offset applied separately)."""

    matrices: dict[str, Matrix] = field(default_factory=dict)

    def pos(self, joint: str) -> Vector:
        return self.matrices[joint].to_translation()


def forward_kinematics(params: dict[str, float], root: Vector | None = None) -> Skeleton:
    sk = Skeleton()
    root = root if root is not None else Vector((0.0, 0.0, 0.0))
    for name in ORDER:
        parent, off = JOINTS[name]
        if parent is None:
            base = Matrix.Translation(Vector(off) + root)
        else:
            base = sk.matrices[parent] @ Matrix.Translation(Vector(off))
        sk.matrices[name] = base @ local_rotation(name, params)
    return sk


# ---------------------------------------------------------------------------------------------
# Contact points (where the body touches the floor). Offsets are in the joint's local frame and
# include the soft-tissue radius so that a contact at z = 0 means "surface on the floor".
# ---------------------------------------------------------------------------------------------
CONTACT_POINTS: dict[str, tuple[str, tuple[float, float, float]]] = {}
for s in SIDES:
    CONTACT_POINTS.update(
        {
            f"hand_{s}": (f"wrist_{s}", (0.0, 0.0, -0.07)),       # palm centre
            f"fingers_{s}": (f"fingers_{s}", (0.0, 0.0, 0.0)),
            f"forearm_{s}": (f"elbow_{s}", (0.0, 0.0, -0.12)),    # mid forearm
            f"elbow_{s}": (f"elbow_{s}", (0.0, 0.0, 0.0)),
            f"foot_{s}": (f"ankle_{s}", (0.0, -0.06, -0.06)),     # sole centre
            f"toes_{s}": (f"toe_{s}", (0.0, 0.0, 0.0)),
            f"heel_{s}": (f"ankle_{s}", (0.0, 0.035, -0.06)),
            f"knee_{s}": (f"knee_{s}", (0.0, 0.0, 0.0)),
        }
    )
CONTACT_POINTS.update(
    {
        "crown": ("head", (0.0, 0.0, 0.285)),         # top of the head (hair surface, slightly compressed)
        "face": ("head", (0.0, -0.13, 0.11)),          # nose/forehead (penetration checks)
        "bun": ("head", (0.0, 0.121, 0.258)),          # hair bun centre (radius below), top-back of the head
        "head_back": ("head", (0.0, 0.15, 0.15)),       # back of the hair cap
        "chin": ("head", (0.0, -0.10, 0.04)),
        "upper_back": ("chest", (0.0, 0.07, 0.10)),     # shoulder blades (shoulder stand)
        "sit": ("pelvis", (0.0, 0.03, -0.11)),
    }
)
# Radius of the body surface around each contact point (distance from the point to the floor).
CONTACT_RADIUS = {"hand": 0.018, "fingers": 0.012, "forearm": 0.034, "elbow": 0.037, "foot": 0.0, "toes": 0.025,
                  "heel": 0.0, "knee": 0.05, "crown": 0.0, "upper_back": 0.0, "sit": 0.0, "bun": 0.046, "head": 0.0}

# Named groups usable in pose files.
CONTACT_GROUPS = {
    "hands": ["hand_L", "hand_R"],
    "forearms": ["forearm_L", "forearm_R"],
    "feet": ["foot_L", "foot_R"],
    "toes": ["toes_L", "toes_R"],
    "knees": ["knee_L", "knee_R"],
    "head": ["crown"],
}


def expand_contacts(names: list[str]) -> list[str]:
    out: list[str] = []
    for n in names:
        out.extend(CONTACT_GROUPS.get(n, [n]))
    return list(dict.fromkeys(out))


def contact_world(sk: Skeleton, name: str) -> Vector:
    joint, off = CONTACT_POINTS[name]
    p = sk.matrices[joint] @ Vector(off)
    r = CONTACT_RADIUS.get(name.split("_")[0], 0.0)
    return Vector((p.x, p.y, p.z - r))


# Approximate segment masses (fraction of body mass) for centre-of-mass checks.
SEGMENTS_COM = [
    ("pelvis", "waist", 0.14), ("waist", "chest", 0.14), ("chest", "neck", 0.18), ("neck", "head", 0.02), ("head", None, 0.08),
] + [
    seg for s in SIDES for seg in (
        (f"shoulder_{s}", f"elbow_{s}", 0.028), (f"elbow_{s}", f"wrist_{s}", 0.016), (f"wrist_{s}", f"fingers_{s}", 0.006),
        (f"hip_{s}", f"knee_{s}", 0.10), (f"knee_{s}", f"ankle_{s}", 0.045), (f"ankle_{s}", f"toe_{s}", 0.014),
    )
]


def center_of_mass(sk: Skeleton) -> Vector:
    total, acc = 0.0, Vector((0, 0, 0))
    for a, b, m in SEGMENTS_COM:
        pa = sk.pos(a)
        pb = sk.pos(b) if b else sk.matrices[a] @ Vector((0, 0, 0.12))
        acc += (pa + pb) / 2 * m
        total += m
    return acc / total
