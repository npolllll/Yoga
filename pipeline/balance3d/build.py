"""Builds a Blender scene for one pose config: character + baked animation + camera."""
from __future__ import annotations

import bpy

from . import character, scene as scn
from .motion import FPS, FRAMES, Frame, MotionReport, body_points, solve


def apply_frame(parts, frame: Frame):
    for obj, joint in parts:
        obj.matrix_world = frame.skeleton.matrices[joint]


def build_scene(config: dict, quality: str, width: int, height: int, transparent: bool | None = None):
    # Final renders: transparent film + shadow-catcher floor, composited onto the site background
    # colour during encoding (no horizon line; the same frames double as transparent stills).
    if transparent is None:
        transparent = quality == "final"
    scene = scn.reset_scene()
    scn.setup_world(scene, transparent=transparent)
    parts = character.build_character()
    frames, report = solve(config)
    view = config.get("view", {})
    scn.fit_camera(scene, body_points(frames), view.get("azimuth", 40), view.get("elevation", 8), lens=view.get("lens", 70))
    scn.configure_render(scene, quality, width, height, FPS)
    scene.frame_start, scene.frame_end = 1, FRAMES
    # Bake: every part gets a keyframe per frame (linear) so the .blend replays the exact motion.
    for fr in frames:
        apply_frame(parts, fr)
        for obj, _ in parts:
            obj.keyframe_insert("location", frame=fr.index + 1)
            obj.keyframe_insert("rotation_quaternion", frame=fr.index + 1)
    for obj, _ in parts:
        if obj.animation_data and obj.animation_data.action:
            for fc in _fcurves(obj.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
    return scene, parts, frames, report


def _fcurves(action):
    # Blender 4.4+ layered actions keep curves in channelbags; older versions expose action.fcurves.
    if hasattr(action, "fcurves") and len(getattr(action, "fcurves", [])) > 0:
        return list(action.fcurves)
    curves = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                curves.extend(bag.fcurves)
    return curves


def report_dict(report: MotionReport) -> dict:
    return {
        "clamped": report.clamped,
        "maxContactDriftCm": round(report.max_contact_drift_cm, 2),
        "maxSnapCm": round(report.max_snap_cm, 2),
        "minBodyZCm": round(report.min_body_z_cm, 2),
        "comMarginCm": None if report.com_margin_cm is None else round(report.com_margin_cm, 1),
        "uniqueFrames": report.unique_frames,
    }


def set_frame(scene, frame_index: int):
    scene.frame_set(frame_index + 1)


def unused():
    return bpy
