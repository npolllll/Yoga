# BALANCE 3D pipeline

Blender 5.2 LTS (Python) builds ONE stylised mascot from smooth rigid parts, poses it with a custom
rig (FK + joint limits + contact solver + goal solver) and renders a 10-second, 30 fps, 300-frame
silent clip per asana. Everything is code: scenes are reproducible from `pipeline/poses/<slug>.json`.

```
pipeline/
  balance3d/rig.py        joints, semantic controls, limits, FK, contact points, centre of mass
  balance3d/character.py  the mascot (CHARACTER_VERSION) — never changed per pose
  balance3d/poselib.py    reusable base poses
  balance3d/motion.py     keys → 300 frames; contact pinning; fit/solve per key; metrics
  balance3d/scene.py      lights, floor (shadow catcher), camera auto-framing, render settings
  balance3d/build.py      scene assembly + baked animation (the .blend replays the exact motion)
  poses/<slug>.json       motion config per asana
  render_pose.py          render one slug (preview | final), resumable, reuses identical frames
  postprocess.py          MP4 (H.264) + WebM (VP9) on the card colour, WebP poster/card/keyframes, manifest
  validate_media.py       automated checks + contact sheets (pipeline/out/contact-sheets)
  queue.py / run.sh       sequential queue with retries, logs, resume (`pnpm media:build`)
  keysheet.py             FAST authoring check: renders only key times + prints metrics
```

Environment: `EGL_PLATFORM=surfaceless` is required for Workbench previews in a headless container.
Final renders use Cycles on CPU (≈3–4 s/frame at 720×540, 16 spp + OpenImageDenoise).

## Rig conventions (degrees)
Rest pose: standing, arms hanging (palms facing back), facing **−Y**; character's left = **+X**; up = +Z.

| control | positive value |
|---|---|
| `pelvis.pitch` | whole body tips forward (90 = horizontal face-down, 180 = upside down) |
| `pelvis.roll` | body tilts to its LEFT (negative = to its right) |
| `pelvis.yaw` | body turns to its left |
| `spine.flex` / `spine.side` / `spine.twist` | forward bend / bend left / chest turns left |
| `neck.flex` / `neck.turn` | chin down (negative = look up/forward) / look left |
| `shoulder_X.flex` | arm forward/up relative to the chest (180 = overhead) |
| `shoulder_X.abd` | arm out to the side |
| `elbow_X.flex` | elbow bend |
| `wrist_X.ext` | hand bends back; ~85–90 puts the palm flat with fingers forward when the arm is vertical |
| `hip_X.flex` / `hip_X.abd` / `hip_X.rot` | knee forward-up / leg out / knee out |
| `knee_X.flex` | heel to buttock |
| `ankle_X.flex` | point toes (negative = dorsiflex) |

Hips are children of the pelvis: thigh direction = `pelvis.pitch − hip.flex` (in the sagittal plane).

Base poses (`poselib.py`): `stand, stand_arms_up, squat, squat_tight, squat_hands, crow, plank,
chaturanga, down_dog, dolphin, handstand, handstand_straddle, forearm_stand, side_plank,
lunge_hands, kneel_forearms`.

## Motion config
```jsonc
{
  "slug": "bakasana", "version": 2,
  "view": {"azimuth": 62, "elevation": 7},     // 0 = front, 90 = character's left side
  "keys": [
    {"t": 0.0, "pose": "squat", "support": ["toes"]},
    {"t": 1.6, "pose": "squat_hands", "set": {"wrist_L.ext": 80},
     "support": ["toes", "hands"],
     "solve": {"vary": ["pelvis.pitch", "shoulder_*.flex"], "goals": [{"above": ["fingers_L", 0]}], "balance": false}},
    {"t": 2.2, "support": ["toes", "hands"]}   // no "pose": hold previous angles
  ],
  "keyframes": [1.6, 3.8, 4.7, 7.0, 9.6],      // 5 stills (step illustrations)
  "poster": 7.0,                                // hold frame (poster + catalog card)
  "hold": [6.0, 8.0]                            // window where contacts must not move
}
```
- A key with `"pose"` starts from that base pose (+`set`); a key without `"pose"` keeps the previous angles.
- `mirror: true` swaps left/right.
- `support`: contacts on the floor at that key — groups `hands, forearms, feet, toes, knees, head` or single
  points `hand_L, toes_R, foot_L, forearm_R, knee_L, crown, upper_back, sit…`. The body is translated so supports
  touch the floor and stay **pinned** while moving between keys (contacts present in both keys are held;
  contacts only in the earlier key lift off; only in the later key land).
- `solve`: coordinate-descent over `vary` (use `*` for both sides) to satisfy goals while keeping supports level,
  nothing else below the floor and (with `balance`) the centre of mass over the support base:
  `near [a,b] d` (points within d m), `over [a,b]` (a vertically above b), `above [p,h]` (p at least h m above floor),
  `height [p,h]`, `apart [a,b] d`, `comover p` (centre of mass over point p). Points: any joint
  (`shoulder_L, elbow_R, knee_L, hip_R, ankle_L, head, chest…`) or contact point (`hand_L, fingers_R, toes_L, face, chin, crown…`).
  Keep `vary` small (3–7 params) and add `reg` (0.05–0.3) to stay close to the base pose.

## Quality bar (checked by `validate_media.py`, read by reviewers)
- Contacts in the hold do not move (≤1 cm); no body part below the floor (≥ −2.5 cm); COM over the base in the hold.
- Exactly 300 frames, 10.0 s, 30 fps, decodable, no audio; poster, card, 4–6 keyframes.
- Each animation shows its own asana (posters are compared for near-duplicates).
- Automated checks do **not** certify anatomy: the teacher reviews keyframes/animation in the admin panel.

## Authoring loop
```bash
EGL_PLATFORM=surfaceless blender -b -t 2 --python pipeline/keysheet.py -- --out /tmp/ks <slug>
```
Prints per-key support heights, the lowest non-support point and a report (snap, minZ, COM margin) and writes
PNG stills per key — look at them and iterate until the shape reads correctly from the chosen view.
