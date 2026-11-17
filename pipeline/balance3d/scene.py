"""Scene, lighting, camera framing and render settings shared by every BALANCE render."""
from __future__ import annotations

import math
import bpy
from mathutils import Euler, Vector

from .character import srgb_to_linear

BACKGROUND = (0.973, 0.945, 0.965)  # matches --c-surface-2 (#f8f1f6) so video edges blend into cards
FLOOR = (0.955, 0.915, 0.945)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    return scene


def setup_world(scene, transparent: bool = False):
    world = bpy.data.worlds.new("world")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*[srgb_to_linear(c) for c in BACKGROUND], 1)
    bg.inputs["Strength"].default_value = 0.55
    scene.render.film_transparent = transparent

    # Floor: shadow catcher for transparent stills, soft matte floor for videos.
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = "floor"
    mat = bpy.data.materials.new("floor")
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*[srgb_to_linear(c) for c in FLOOR], 1)
    b.inputs["Roughness"].default_value = 0.95
    mat.diffuse_color = (*[srgb_to_linear(c) for c in FLOOR], 1)
    floor.data.materials.append(mat)
    floor.is_shadow_catcher = transparent

    def area(name, loc, rot, energy, size, color=(1, 1, 1)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        obj.rotation_euler = Euler([math.radians(a) for a in rot])
        scene.collection.objects.link(obj)
        return obj

    area("key", (-2.6, -3.2, 4.2), (48, 0, -38), 900, 4.5, (1.0, 0.97, 0.95))
    area("fill", (3.4, -2.2, 2.4), (65, 0, 55), 300, 5.0, (0.95, 0.95, 1.0))
    area("rim", (0.5, 3.8, 3.2), (-55, 0, 175), 420, 3.5, (1.0, 0.92, 0.97))
    return floor


def configure_render(scene, quality: str, width: int, height: int, fps: int = 30):
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.fps = fps
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if scene.render.film_transparent else "RGB"
    scene.render.image_settings.compression = 15
    # "Standard" keeps the brand palette exact (AgX/Filmic desaturate pastel colours).
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    if quality == "preview":
        scene.render.engine = "BLENDER_WORKBENCH"
        shading = scene.display.shading
        shading.light = "STUDIO"
        shading.color_type = "MATERIAL"
        shading.show_shadows = True
        shading.show_cavity = False
        scene.display.render_aa = "8"
    else:
        scene.render.engine = "CYCLES"
        c = scene.cycles
        c.device = "CPU"
        c.samples = 16 if quality == "final" else 64
        c.use_adaptive_sampling = True
        c.adaptive_threshold = 0.03
        c.use_denoising = True
        c.denoiser = "OPENIMAGEDENOISE"
        c.max_bounces = 4
        c.diffuse_bounces = 2
        c.glossy_bounces = 1
        c.transmission_bounces = 0
        c.transparent_max_bounces = 2
        c.caustics_reflective = False
        c.caustics_refractive = False
        c.blur_glossy = 1.0
        scene.render.use_persistent_data = True
        c.texture_limit_render = "1024"


def fit_camera(scene, points: list[Vector], azimuth: float, elevation: float, lens: float = 70.0, margin: float = 1.06):
    """Fixed camera looking at the animation's bounding volume; every point stays in frame."""
    cam_data = bpy.data.cameras.new("camera")
    cam_data.lens = lens
    cam_data.sensor_fit = "HORIZONTAL"
    cam = bpy.data.objects.new("camera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    target = (lo + hi) / 2
    az, el = math.radians(azimuth), math.radians(elevation)
    # azimuth 0 = camera in front of the character (at -Y), 90 = on the character's left (+X).
    direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    forward = -direction
    right = forward.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(forward).normalized()

    aspect = scene.render.resolution_x / scene.render.resolution_y
    tan_h = (cam_data.sensor_width / 2) / lens
    tan_v = tan_h / aspect
    dist = 0.5
    for p in points:
        rel = p - target
        u, v, depth = rel.dot(right), rel.dot(up), rel.dot(direction)
        dist = max(dist, abs(u) * margin / tan_h + depth, abs(v) * margin / tan_v + depth)
    # Small downward bias so the floor shadow is visible below the feet/hands.
    target.z -= 0.03
    cam.location = target + direction * dist
    cam.rotation_euler = forward.to_track_quat("-Z", "Y").to_euler()
    return cam
