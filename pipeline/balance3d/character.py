"""
The BALANCE mascot: one stylised character reused in every scene.
Built procedurally from smooth rigid parts attached to rig joints (no skin weights → no
deformation artefacts in extreme poses such as handstands or binds).

Look (inspired by Balance.pdf): soft matte 3D, brown hair in a top-back bun with face-framing strands,
small gold hoop earrings, a beauty mark, half-closed calm eyes, dusty-mauve crop top and leggings.
"""
from __future__ import annotations

import math
import bmesh
import bpy
from mathutils import Matrix, Vector

CHARACTER_VERSION = "1.2.0"  # 1.1: slimmer, flatter midriff; 1.2: bun moved to the top-back so the crown can carry a headstand

PALETTE = {
    "skin": (0.93, 0.70, 0.58),
    "outfit": (0.62, 0.40, 0.46),       # dusty mauve
    "outfit_dark": (0.52, 0.32, 0.38),
    "hair": (0.33, 0.19, 0.11),
    "eye": (0.09, 0.05, 0.04),
    "lips": (0.78, 0.42, 0.45),
    "blush": (0.95, 0.58, 0.58),
    "gold": (0.83, 0.62, 0.25),
    "white": (0.97, 0.96, 0.95),
    "mole": (0.30, 0.17, 0.12),
}


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def make_material(name: str, rgb: tuple[float, float, float], roughness=0.62, metallic=0.0, sss=0.0, coat=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    lin = tuple(srgb_to_linear(c) for c in rgb)
    bsdf.inputs["Base Color"].default_value = (*lin, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = sss
        bsdf.inputs["Subsurface Radius"].default_value = (0.6, 0.25, 0.15)
        bsdf.inputs["Subsurface Scale"].default_value = 0.02
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    mat.diffuse_color = (*lin, 1.0)  # used by Workbench previews
    return mat


def materials():
    return {
        "skin": make_material("skin", PALETTE["skin"], roughness=0.55, sss=0.08),
        "outfit": make_material("outfit", PALETTE["outfit"], roughness=0.78),
        "outfit_dark": make_material("outfit_dark", PALETTE["outfit_dark"], roughness=0.8),
        "hair": make_material("hair", PALETTE["hair"], roughness=0.5, coat=0.15),
        "eye": make_material("eye", PALETTE["eye"], roughness=0.2, coat=0.5),
        "lips": make_material("lips", PALETTE["lips"], roughness=0.45),
        "blush": make_material("blush", PALETTE["blush"], roughness=0.7),
        "gold": make_material("gold", PALETTE["gold"], roughness=0.25, metallic=1.0),
        "white": make_material("white", PALETTE["white"], roughness=0.3),
        "mole": make_material("mole", PALETTE["mole"], roughness=0.6),
    }


# ---------------------------------------------------------------------------------------------
# Mesh helpers (all geometry is baked into mesh data; objects carry only location/rotation).
# ---------------------------------------------------------------------------------------------
def _finish(bm: bmesh.types.BMesh, name: str, mat) -> bpy.types.Object:
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.rotation_mode = "QUATERNION"
    return obj


def _ring_faces(bm, rings):
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            n = len(b)
            for i in range(n):
                bm.faces.new((a[0], b[i], b[(i + 1) % n]))
        elif len(b) == 1:
            n = len(a)
            for i in range(n):
                bm.faces.new((a[(i + 1) % n], a[i], b[0]))
        else:
            n = len(a)
            for i in range(n):
                bm.faces.new((a[i], b[i], b[(i + 1) % n], a[(i + 1) % n]))


def capsule(name, start: Vector, end: Vector, r1: float, r2: float, mat, seg=28, rings=8):
    """Tapered capsule from `start` to `end` (in the owning joint's frame)."""
    d = end - start
    length = d.length
    bm = bmesh.new()
    thetas = [2 * math.pi * i / seg for i in range(seg)]
    all_rings = []
    for i in range(rings + 1):  # lower hemisphere: pole -> equator
        a = -math.pi / 2 + (math.pi / 2) * i / rings
        z, rr = r1 * math.sin(a), r1 * math.cos(a)
        all_rings.append([bm.verts.new((0, 0, z))] if rr < 1e-7 else [bm.verts.new((rr * math.cos(t), rr * math.sin(t), z)) for t in thetas])
    for i in range(rings + 1):  # upper hemisphere: equator -> pole
        a = (math.pi / 2) * i / rings
        z, rr = length + r2 * math.sin(a), r2 * math.cos(a)
        all_rings.append([bm.verts.new((0, 0, z))] if rr < 1e-7 else [bm.verts.new((rr * math.cos(t), rr * math.sin(t), z)) for t in thetas])
    _ring_faces(bm, all_rings)
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(start) @ rot, verts=bm.verts)
    return _finish(bm, name, mat)


def ellipsoid(name, center: Vector, radii: tuple[float, float, float], mat, seg=36, rings=20, rot: Matrix | None = None):
    bm = bmesh.new()
    all_rings = []
    for i in range(rings + 1):
        a = -math.pi / 2 + math.pi * i / rings
        z, rr = math.sin(a), math.cos(a)
        if rr < 1e-7:
            all_rings.append([bm.verts.new((0, 0, z * radii[2]))])
        else:
            all_rings.append(
                [bm.verts.new((rr * math.cos(t) * radii[0], rr * math.sin(t) * radii[1], z * radii[2])) for t in (2 * math.pi * k / seg for k in range(seg))]
            )
    _ring_faces(bm, all_rings)
    m = Matrix.Translation(center) @ (rot if rot is not None else Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _finish(bm, name, mat)


def torus(name, center: Vector, major: float, minor: float, mat, rot: Matrix | None = None, seg=24, sides=10):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        u = 2 * math.pi * i / seg
        ring = []
        for j in range(sides):
            v = 2 * math.pi * j / sides
            x = (major + minor * math.cos(v)) * math.cos(u)
            y = (major + minor * math.cos(v)) * math.sin(u)
            z = minor * math.sin(v)
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for i in range(seg):
        a, b = rings[i], rings[(i + 1) % seg]
        for j in range(sides):
            bm.faces.new((a[j], b[j], b[(j + 1) % sides], a[(j + 1) % sides]))
    m = Matrix.Translation(center) @ (rot if rot is not None else Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _finish(bm, name, mat)


V = Vector


def build_character() -> list[tuple[bpy.types.Object, str]]:
    """Creates all parts. Returns (object, joint) pairs; each object's mesh is in joint space."""
    M = materials()
    parts: list[tuple[bpy.types.Object, str]] = []

    def add(obj, joint):
        parts.append((obj, joint))

    # Torso: high-waisted leggings, bare midriff, crop top.
    add(ellipsoid("pelvis", V((0, 0.005, -0.015)), (0.150, 0.105, 0.115), M["outfit"]), "pelvis")
    add(ellipsoid("waistband", V((0, 0.003, 0.06)), (0.122, 0.086, 0.032), M["outfit_dark"]), "pelvis")
    add(ellipsoid("abdomen", V((0, 0.012, 0.06)), (0.094, 0.066, 0.112), M["skin"]), "waist")
    add(ellipsoid("ribs", V((0, 0.01, 0.01)), (0.108, 0.074, 0.06), M["skin"]), "chest")
    add(ellipsoid("top", V((0, 0.0, 0.075)), (0.150, 0.100, 0.095), M["outfit"]), "chest")
    add(ellipsoid("bust", V((0, -0.035, 0.065)), (0.125, 0.07, 0.06), M["outfit"]), "chest")
    add(capsule("neck", V((0, 0, -0.03)), V((0, 0, 0.09)), 0.045, 0.043, M["skin"]), "neck")

    # Head (faces -Y). Head joint sits at the base of the skull.
    H = V((0, 0, 0.13))
    add(ellipsoid("head", H, (0.128, 0.122, 0.142), M["skin"]), "head")
    add(ellipsoid("jaw", H + V((0, -0.035, -0.06)), (0.095, 0.08, 0.07), M["skin"]), "head")
    add(ellipsoid("hair_cap", H + V((0, 0.018, 0.022)), (0.137, 0.128, 0.138), M["hair"]), "head")
    add(ellipsoid("hair_fringe", H + V((0, -0.07, 0.085)), (0.118, 0.06, 0.055), M["hair"]), "head")
    # Bun on the top-back of the head (44° behind vertical): it still reads as a high bun in profile, but the
    # crown stays the highest point for headstands and the back of the head stays flat for shoulder stands.
    bun_tilt = Matrix.Rotation(math.radians(-44), 4, "X")
    add(ellipsoid("bun", H + V((0, 0.121, 0.128)), (0.052, 0.046, 0.046), M["hair"], rot=bun_tilt), "head")
    add(torus("bun_wrap", H + V((0, 0.096, 0.103)), 0.036, 0.011, M["hair"], rot=bun_tilt), "head")
    for s, sx in (("L", 1), ("R", -1)):
        add(capsule(f"strand_{s}", H + V((0.105 * sx, -0.06, 0.06)), H + V((0.112 * sx, -0.075, -0.07)), 0.014, 0.008, M["hair"]), "head")
        add(ellipsoid(f"ear_{s}", H + V((0.126 * sx, 0.005, -0.005)), (0.018, 0.026, 0.034), M["skin"]), "head")
        add(torus(f"earring_{s}", H + V((0.133 * sx, -0.002, -0.05)), 0.015, 0.0035, M["gold"], rot=Matrix.Rotation(math.radians(90), 4, "Y")), "head")
        # Calm, half-closed eyes: dark almond with a heavy upper lid line.
        eye_c = H + V((0.047 * sx, -0.116, -0.004))
        tilt = Matrix.Rotation(math.radians(-8 * sx), 4, "Y")
        add(ellipsoid(f"eye_{s}", eye_c, (0.024, 0.008, 0.0105), M["eye"], rot=tilt), "head")
        add(ellipsoid(f"lid_{s}", eye_c + V((0, -0.002, 0.009)), (0.028, 0.008, 0.005), M["eye"], rot=tilt), "head")
        add(ellipsoid(f"glint_{s}", eye_c + V((0.006 * sx, -0.0075, 0.002)), (0.0035, 0.002, 0.003), M["white"]), "head")
        add(capsule(f"brow_{s}", eye_c + V((0.022 * sx, -0.003, 0.04)), eye_c + V((-0.012 * sx, -0.006, 0.043)), 0.0035, 0.004, M["hair"]), "head")
        add(ellipsoid(f"blush_{s}", H + V((0.072 * sx, -0.098, -0.04)), (0.024, 0.008, 0.014), M["blush"]), "head")
    add(ellipsoid("nose", H + V((0, -0.128, -0.028)), (0.011, 0.01, 0.012), M["skin"]), "head")
    add(ellipsoid("mouth", H + V((0, -0.118, -0.068)), (0.016, 0.006, 0.0055), M["lips"]), "head")
    add(ellipsoid("mole", H + V((0.064, -0.105, -0.058)), (0.0042, 0.003, 0.0042), M["mole"]), "head")

    # Limbs.
    for s, sx in (("L", 1), ("R", -1)):
        add(ellipsoid(f"shoulder_{s}", V((0, 0, 0)), (0.05, 0.05, 0.05), M["skin"]), f"shoulder_{s}")
        add(capsule(f"upperarm_{s}", V((0, 0, 0)), V((0, 0, -0.265)), 0.047, 0.037, M["skin"]), f"shoulder_{s}")
        add(capsule(f"forearm_{s}", V((0, 0, 0)), V((0, 0, -0.235)), 0.036, 0.027, M["skin"]), f"elbow_{s}")
        # Mitten hand: palm faces backwards at rest (normal +Y), fingers along -Z, thumb towards the midline.
        # With wrist.ext = 90 the palm lies flat on the floor with the fingers pointing forward.
        add(ellipsoid(f"palm_{s}", V((0, 0, -0.06)), (0.043, 0.019, 0.065), M["skin"]), f"wrist_{s}")
        add(ellipsoid(f"fingers_{s}", V((0.002 * sx, 0, -0.125)), (0.04, 0.016, 0.045), M["skin"]), f"wrist_{s}")
        add(capsule(f"thumb_{s}", V((-0.035 * sx, -0.004, -0.03)), V((-0.05 * sx, -0.012, -0.08)), 0.012, 0.01, M["skin"]), f"wrist_{s}")
        add(capsule(f"thigh_{s}", V((0, 0, 0)), V((0, 0, -0.405)), 0.078, 0.052, M["outfit"]), f"hip_{s}")
        add(ellipsoid(f"knee_{s}", V((0, 0, 0)), (0.05, 0.052, 0.05), M["outfit"]), f"knee_{s}")
        add(capsule(f"shin_{s}", V((0, 0, 0)), V((0, 0, -0.37)), 0.05, 0.035, M["outfit"]), f"knee_{s}")
        add(capsule(f"ankle_{s}", V((0, 0, 0.0)), V((0, 0, -0.02)), 0.033, 0.033, M["skin"]), f"ankle_{s}")
        add(capsule(f"foot_{s}", V((0, 0.03, -0.04)), V((0, -0.15, -0.05)), 0.03, 0.026, M["skin"]), f"ankle_{s}")
    return parts
