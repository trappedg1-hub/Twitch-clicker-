#!/usr/bin/env python3
"""Build the first real OpenBone document for Miya (day 1 plate).

What this is: a skeletal rig over the approved 1024x1526 plate — a grid mesh whose weights are
**parts, not a fog** (see `weights_for`), plus breathing / idle / nod / turn animations and two
physics springs. It replaces "one flat texture deformed by a hand-tuned mesh in HeroineRig" with
an authored rig that a runtime can animate.

The weighting rule is the whole thing. A pixel belongs to one part, the part is rigid, and parts
meet in narrow joints: the head (face, hair, headphones) is one body, the hair below the jaw hangs
off it, the torso is rigid between the waist and the shoulders, and the thighs rest on the chair so
they are bound to `root` and never move. Only the neck (56 px) and the waist (30 px) bend. Measured
on the real runtime, that turned 547 folded triangles in a head turn into zero and stopped the
backrest behind her from rocking 8 px with every reaction.

What this is NOT yet: separate eyes, mouth, hair and cloth layers. Those need either a
See-through decomposition on a GPU or per-layer generations; this document is the skeleton
and the body deformation those layers will hang off.

Usage:
    python3 scripts/build_miya_rig.py                 # the calibration plate (t1_s0)
    python3 scripts/build_miya_rig.py --art t6_s1     # one art
    python3 scripts/build_miya_rig.py --all           # every art that has a face-kit patch
"""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ART = Path("public/art")
OUTDIR = Path("experiments/rig-lab")
PLATE = ART / "heroine_t1_s0.webp"
OUT = OUTDIR / "miya_day1.obone"
IMG_ID = "img_miya_d1"
EYES_ID = "img_miya_eyes_closed"
MOUTH_CLOSED_ID = "img_miya_mouth_closed"
MOUTH_TONGUE_ID = "img_miya_mouth_tongue"   # rewritten per art in `main`, like the two above
MOUTH_OPEN_ID = "img_miya_mouth_open"

PATCH_DIR = "face_kit"
PATCHES: dict[str, dict] = {}

# Face patches come from the face-kit manifest: `scripts/detect_face.py` finds the eyes,
# `scripts/face_kit_batch.py` builds the trimmed patches and records their geometry there.
MANIFEST = Path("public/art/face_kit/manifest.json")
ART_KEY = PLATE.stem.replace("heroine_", "")


def face_patches(art: str) -> dict[str, dict]:
    if not MANIFEST.exists():
        raise SystemExit(f"{MANIFEST} missing — run scripts/detect_face.py and face_kit_batch.py")
    data = json.loads(MANIFEST.read_text())
    entry = data.get(f"heroine_{art}", {})
    patches = entry.get("patches", {})
    if not patches:
        raise SystemExit(f"no face-kit patches for art {art} — run scripts/face_kit_batch.py")
    if "eyes_closed" not in patches:
        raise SystemExit(f"patch eyes_closed missing for art {art} — run scripts/face_kit_batch.py")
    # `mouth_open` is absent on purpose where a prop sits at the lips: those arts blink only.
    return patches

# Canvas of the plate. The document origin sits at the top-left of the art.
W, H = 1024, 1526

# The skeleton is a template measured on the calibration plate and then placed on any art by
# its eye line: the midpoint of the two detected eyes and the distance between them. Anime
# plates of one character keep their proportions, so inter-ocular distance is a reliable ruler
# — the face box detector is a heuristic, the eyes are measured.
REF_EYES = (533.0, 308.0)   # eye-line midpoint, heroine_t1_s0
REF_SPAN = 100.6            # inter-ocular distance, heroine_t1_s0

# Spine chain in plate coordinates: (name, x, y, parent). y grows downward, like Pixi.
REF_BONES = [
    ("root",           512, 1500, None),
    ("hips",           512, 1180, "root"),
    ("spine",          512, 1050, "hips"),
    ("chest",          512,  880, "spine"),
    # Two breasts, two springs. One `bust` bone could only ever move as one piece, and a single
    # piece moving is a plate, not a body: the whole point of chest secondary motion is that the
    # two sides do not agree on when the body stopped. The origins sit against the chest wall
    # (y 700, above the mass at 745) so a rotation swings the breast instead of spinning it.
    ("bust_left",      448,  700, "chest"),
    ("bust_right",     576,  700, "chest"),
    ("neck",           512,  620, "chest"),
    ("head",           512,  470, "neck"),
    ("hair_back",      512,  420, "head"),
    # What she wears on her head — a hat, headphones, a sheet — rides the head as a rigid body on
    # its own bone, at the same origin, so it inherits the head's motion exactly and needs no keys
    # of its own. It is a separate bone so that "is the head being thrown about" can be asked of
    # her skull: a 3-span hat brim is a long lever and its tip travels three times what her crown
    # does, which is geometry, not wobble (the jelly guards in `rigRuntime` measure bone_head).
    ("head_wear",      512,  470, "head"),
    # Reserved shoulders. They carry no skin weight and that is a measured decision, not an
    # oversight: her sleeves and her hoodie are one garment in the same colour, so the only way to
    # separate an arm from the torso is the silhouette — and the silhouette it hangs outside is the
    # chair's backrest (the test `the chair she sits on never moves` failed by 4.0 px when the arm
    # blobs reached it). What the arms needed instead was for the *lap* to stop being a photograph;
    # that is `torso_gate`'s widening below, and it carries her hands with her hips.
    ("arm_left",       330,  860, "chest"),
    ("arm_right",      700,  860, "chest"),
]
BONE_LENGTH = 8.0
WEIGHT_SIGMA = 190.0

# Secondary motion, per bone. The runtime keeps two spring particles (origin and tip) that lag
# behind the animated pose and blends them back in — so these are soft body parts, not extra
# animation: they react to whatever the authored animation does, including taps and turns that
# did not exist when the rig was built.
#
# `strength` is a spring constant per unit mass (k = strength / mass): 100 is roughly a 0.6 s
# period, 250 reads as taut skin. `damping` is velocity decay per second, `gravity` pulls the
# particles down in plate pixels per second squared.
PHYSICS = [
    {
        # Hair: heavy, slow, mostly rotation. The strand mass that hangs behind the shoulders
        # has to keep moving after the head stops.
        "id": "phys_hair",
        "name": "hair",
        "bone": "bone_hair_back",
        "x": 0.35, "y": 0.35, "rotate": 1.0, "scaleX": 0.0,
        # Tuned against the smear limit, not by taste: past ~18 px of travel the hair pixels
        # stretch away from the hoodie underneath them and the silhouette streaks. A stiffer
        # spring plus a partial `mix` keeps the lag readable without the streaks.
        "inertia": 0.46, "strength": 165.0, "damping": 17.5, "mass": 1.0,
        "gravity": 12.0, "wind": 0.0, "mix": 0.50, "fps": 60, "volume": True,
    },
    {
        # Her left breast. The two sides are deliberately not identical: a body that carries two
        # springs with the same constant is a machined part, and the eye reads the symmetry as
        # rubber. Left is the softer of the two (lower constant, less damping, more lag), so a nod
        # arrives on the right first and the left is still settling when it is over.
        "id": "phys_bust_left",
        "name": "bust_left",
        "bone": "bone_bust_left",
        "x": 0.44, "y": 0.62, "rotate": 0.60, "scaleX": 0.10,
        "inertia": 0.58, "strength": 132.0, "damping": 11.5, "mass": 1.0,
        "gravity": 0.0, "wind": 0.0, "mix": 0.56, "fps": 60, "volume": False,
    },
    {
        # Her right. Tauter and better damped: it settles first on a tap and carries the smaller
        # overshoot on a turn. Both stay under the smear limit — the springs move pixels, and a
        # spring that moves pixels without the weights to match is the jelly the player complained
        # about in the first place.
        "id": "phys_bust_right",
        "name": "bust_right",
        "bone": "bone_bust_right",
        "x": 0.40, "y": 0.56, "rotate": 0.52, "scaleX": 0.08,
        "inertia": 0.54, "strength": 152.0, "damping": 13.6, "mass": 1.0,
        "gravity": 0.0, "wind": 0.0, "mix": 0.48, "fps": 60, "volume": False,
    },
    {
        # Chest: taut, fast, small travel. Enough to let the torso settle a moment after the
        # hips do; a big value here reads as a rubber body.
        "id": "phys_chest",
        "name": "chest",
        "bone": "bone_chest",
        "x": 0.18, "y": 0.22, "rotate": 0.35, "scaleX": 0.0,
        "inertia": 0.40, "strength": 380.0, "damping": 30.0, "mass": 1.0,
        "gravity": 0.0, "wind": 0.0, "mix": 0.18, "fps": 60, "volume": False,
    },
]        # height falloff of the skin weights, scaled with the face

# Placed at build time by `derive_skeleton()`.
BONES: list[tuple[str, float, float, str | None]] = []
INFLUENCE: dict[str, tuple[float, float, float, float]] = {}

# Influence region per bone: (cx, cy, rx, ry) in plate pixels, an ellipse with a soft rim.
# The mesh is a rectangle over the whole plate, so without these the chest bone would scale
# the chair and the room along with her. Anything outside every ellipse stays on `root` and
# is therefore perfectly static.
REF_INFLUENCE = {
    "root":       (512, 1300, 620, 420),
    "head":       (512,  640, 168, 500),   # head plus the hair falling past the shoulders
    "hair_back":  (512,  620, 172, 400),
    "neck":       (512,  660, 190, 170),
    "chest":      (512,  880, 225, 230),   # torso only: bust and shoulders, not the chair
    "bust_left":  (452,  752, 104, 100),   # her left breast: softest part, its own spring
    "bust_right": (572,  752, 104, 100),   # and her right, on a second spring
    "spine":      (512, 1020, 205, 150),
    "hips":       (512, 1200, 255, 175),
    # The arm blobs start *below* the backred wings (they live under y 740 on the day-1 plate): the
    # spring rings on its parent's motion, so a blob that reached the chair would move the chair.
    "arm_left":   (318,  935, 105, 118),
    "arm_right":  (712,  935, 105, 118),
}


def derive_skeleton(eyes_mid: tuple[float, float], span: float, w: int, h: int):
    """Place the reference skeleton on a plate by its eye line, then clamp it to the canvas.

    Returns (bones, influence, sigma). Bones may sit below the canvas on close-up plates (there
    is no waist in frame); that is harmless — only the influence ellipses need to stay near it.
    """
    scale = span / REF_SPAN
    ox = eyes_mid[0] - REF_EYES[0] * scale
    oy = eyes_mid[1] - REF_EYES[1] * scale

    def place(x: float, y: float) -> tuple[float, float]:
        return (round(x * scale + ox, 3), round(min(max(y * scale + oy, 0.0), float(h)), 3))

    bones = [(name, *place(x, y), parent) for name, x, y, parent in REF_BONES]
    influence = {}
    for name, (cx, cy, rx, ry) in REF_INFLUENCE.items():
        # Ellipse centres are their own points, not the bone origins: the head ellipse covers the
        # hair below the skull, so it sits lower than the head bone on purpose.
        px, py = place(cx, cy)
        influence[name] = (min(px, float(w)), py, rx * scale, ry * scale)
    return bones, influence, WEIGHT_SIGMA * scale


def hair_field(plate: Path, face_box: list[int] | None, eyes_mid: tuple[float, float],
               span: float) -> Image.Image | None:
    """Soft 0..255 mask of "this pixel is hair", anchored to the eye line.

    The mask is deliberately tight. Colour cannot separate hair from the chair — both are dark
    desaturated blue-grey within a few levels of each other — and an ellipse wide enough to cover
    the whole hair curtain also covers the backrest. So the field hugs the two side locks around
    the face, where hair is guaranteed on every plate, and stops short of the chair. The user's
    rule is absolute: the desk and the chair never move. Less hair travel is a fine price.
    """
    path = plate
    if not path.exists():
        return None
    img = Image.open(path).convert("RGBA")
    arr = np.asarray(img)
    rgb = arr[..., :3].astype(np.float32)
    alpha = arr[..., 3]
    value = rgb.max(axis=2)
    h, w = value.shape
    yy, xx = np.mgrid[0:h, 0:w]
    mx, my = eyes_mid
    reach = 1.30 * span           # horizontal half-width of the curtain, in eye spans
    top = my - 1.30 * span
    bottom = my + 3.40 * span

    mask = (value < 88) & (alpha > 128)
    mask &= (np.abs(xx - mx) < reach) & (yy > top) & (yy < bottom)
    if face_box:
        fx0, fy0, fx1, fy1 = face_box
        mask &= ~((xx >= fx0) & (xx <= fx1) & (yy >= fy0) & (yy <= fy1))
    # 3 px, not 22: this mask now decides WHICH PART a pixel belongs to, and a 44 px-wide
    # transition band is what turned the hair into a smear — half of every strand followed the
    # hair bone, half followed the chest, so the edge of the hair curtain was dragged into a
    # ghost of itself on every head turn.
    soft = Image.fromarray((mask * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(8))
    if face_box:
        # The blur bleeds back over the face. A face that sways with the hair tears at the hairline
        # and drags the eye and mouth patches off their plates, so the face band wins.
        fx0, fy0, fx1, fy1 = face_box
        buf = np.asarray(soft).copy()
        keep = ~((xx >= fx0 - 6) & (xx <= fx1 + 6) & (yy >= fy0 - 10) & (yy <= fy1 + 24))
        buf[~keep] = 0
        soft = Image.fromarray(buf, "L")
    return soft


def foot_field(plate: Path, eyes_mid: tuple[float, float], span: float):
    """Per-foot masks, taken from the socks.

    Her feet dangle over the front of the chair and were weighted to `root` like the furniture
    under them — the bottom of the picture never moved. Socks are the one part of her that is
    white in a dark frame (the seat, the desk and the floor are all dark), so the mask can be read
    off the art instead of guessed: anything below the waist that is bright and nearly neutral.
    Her skin is warm (red channel well above blue) and the stripes are violet, so neither passes.

    Returns (left, right, left_ankle, right_ankle) or None when no sock is in frame — a plate with
    a desk over her knees gets nothing, and the foot bones simply do nothing on it.
    """
    img = Image.open(plate).convert("RGBA")
    rgba = np.asarray(img)
    rgb = rgba[..., :3].astype(np.int16)
    alpha = rgba[..., 3]
    mx, my = eyes_mid
    height, width = alpha.shape
    yy, xx = np.mgrid[0:height, 0:width]
    # Below the chair's front edge (9.2 spans under the eye line is y = 1180 on t1_s0) and white:
    # the hoodie is grey and sits 600 px higher, so both tests matter — the first version of this
    # mask ran from her chest down and put the ankle bones in her collarbone.
    below = yy > my + 9.2 * span
    neutral = (rgb.max(axis=2) - rgb.min(axis=2)) < 32
    bright = rgb.min(axis=2) > 200
    mask = below & neutral & bright & (alpha > 200)
    left = (mask & (xx < mx)).astype(np.uint8) * 255
    right = (mask & (xx >= mx)).astype(np.uint8) * 255
    out = []
    ankles = []
    for half in (left, right):
        # A sock has a shape: a compact blob, in the bottom of the frame, no taller than the foot.
        # White alone is not enough — on the plates where she is not sitting in the chair the
        # brightest thing under the waist is her underwear, and the first version of this mask
        # happily attached a foot bone to a bra (t4_s2: a 610 px tall "foot"). No sock, no foot
        # bone: a plate with no feet in frame simply does not get the feature.
        # A real sock is most of a foot: ~16 000 px at a 97 px eye span. Highlights and the odd
        # white edge are one to three thousand; the threshold is deliberately far above them.
        if int(half.sum()) < 8000 * (span / REF_SPAN) ** 2:
            return None
        ys, xs = np.nonzero(half)
        if ys.max() - ys.min() > 3.4 * span or ys.max() < height - 2.2 * span:
            return None
        # Ankle = the top edge of the sock, on its centre line: the bone has to sit *above* the
        # foot, or a rotation swings the heel instead of the toes.
        ankles.append((float(xs.mean()), float(ys.min())))
        soft = Image.fromarray(half, "L").filter(ImageFilter.GaussianBlur(FOOT_BLUR))
        out.append(np.asarray(soft))
    return out[0], out[1], ankles[0], ankles[1]


def foot_factor(side: str, x: float, y: float) -> float:
    if _FOOT_PIX is None:
        return 0.0
    field = _FOOT_PIX[0] if side == "left" else _FOOT_PIX[1]
    height, width = field.shape
    xi = min(width - 1, max(0, int(x)))
    yi = min(height - 1, max(0, int(y)))
    return float(field[yi, xi]) / 255.0


def toe_ramp(side: str, y: float) -> float:
    """0 at the ankle, 1 at the toe tip, smooth between — the sock's own extent sets the band."""
    band = _TOE_RAMP.get(side)
    if band is None:
        return 0.0
    return below(y, band[0], max(band[1] - band[0], 1e-3))


def head_cap_field(plate: Path, eyes_mid: tuple[float, float], span: float) -> tuple[np.ndarray, np.ndarray]:
    """Solid mask + the "worn on the head" mask, both from the plate's alpha.

    The cap fades out at CAP_BOTTOM: the chair's backrest is the only other solid thing up there,
    and its wings begin below that line on every plate (the chair test's rects start at y=320).
    Fading rather than cutting is the same rule as everywhere else in this file — a step in a skin
    weight folds the mesh.
    """
    img = Image.open(plate).convert("RGBA")
    alpha = np.asarray(img)[..., 3]
    # A wide blur, not 2 px: a mask edge is a step in a skin weight, and a step folds the mesh
    # (250 folded triangles in `idle` on the first try). The y-ramp below still keeps the chair out.
    solid = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(CAP_BLUR))
    solid_px = np.asarray(solid).copy()
    height, width = solid_px.shape
    yy = np.mgrid[0:height, 0:width][0].astype(np.float32)
    mx, my = eyes_mid
    bottom = my + CAP_BOTTOM * span
    fade = CAP_FADE * span
    ramp = np.clip((bottom + fade - yy) / max(fade, 1e-3), 0.0, 1.0)
    ramp = ramp * ramp * (3.0 - 2.0 * ramp)
    cap = (solid_px.astype(np.float32) * ramp).astype(np.uint8)
    return solid_px, cap


HAIR_FIELD: Image.Image | None = None
_HAIR_PIX: np.ndarray | None = None
# Her pixels, from the plate's own alpha (the room is a separate layer, so alpha IS her silhouette
# plus the chair she sits on). Used by the head cap below.
_SOLID_PIX: np.ndarray | None = None
_CAP_PIX: np.ndarray | None = None
# Her socks, per foot, from the plate: the only near-white thing below her knees.
_FOOT_PIX: tuple[np.ndarray, np.ndarray] | None = None
# Where the toes start on each sock, as (y_start, y_end) in plate pixels. The sock's own mask
# decides: the bottom of it is the toes, the top is the ankle.
_TOE_RAMP: dict[str, tuple[float, float]] = {}
# The face patch frame on this plate (`manifest.json` -> `face`): the rigid core of the rig. The
# smoothing pass never touches it, so "her face is a face" stays exact rather than approximately so.
FACE_BOX: list[int] | None = None

# --- anatomy, in eye spans ---------------------------------------------------------------
# Everything below is measured off the calibration plate and expressed in inter-ocular
# distances, so it follows the eye line onto any art. These are the numbers that turn a smooth
# "rubber sheet" into articulation: a head that rotates as a head, a neck that bends over 30 px,
# a torso that is rigid between joints instead of sagging everywhere.
MX, MY, SPAN = 498.5, 289.0, 97.0     # eye-line midpoint + inter-ocular distance of the plate
CHIN = 1.20          # chin, below the eye line (t1_s0: eyes 308, jaw 430, span 102)
NECK_TOP = 0.04      # the neck bend starts a little under the jaw
NECK_BOTTOM = 1.75   # and is done by here: below this the chest owns the pixel
HEAD_DX, HEAD_DY = 0.12, -0.03  # centre of the skull+hair+headphone mass, relative to the eyes
HEAD_RX, HEAD_RY = 2.00, 1.75   # and how far it reaches; a touch proud of the hair (x 340..748)
# The "worn on the head" cap: full weight above CAP_BOTTOM eye spans over the eye line, gone by
# CAP_BOTTOM + CAP_FADE, blurred by CAP_BLUR px first. Wide, because the head turns ~50 px at the
# brim's tip and a narrow ramp across that much motion folds the mesh; ending above the backrest,
# because the chair's rects start at y = 320. Swept: finer ramps fold the hat, wider ones drag the
# backrest. This pair reads 0.42 px on the chair and 5.4x on the worst hat triangle (the rig this
# replaced already read 5.8x), with the hat's 340 solid vertices above y = 300 all moving.
CAP_BOTTOM = float(os.environ.get("RIG_CAP_BOTTOM", "-0.35"))
CAP_FADE = float(os.environ.get("RIG_CAP_FADE", "0.65"))
CAP_BLUR = int(os.environ.get("RIG_CAP_BLUR", "40"))
# The sock mask's own soften, in px: the same rule as the hat — a mask edge is a step in a skin
# weight. 22 px keeps the sole of a sock moving as one piece and its outline from tearing.
FOOT_BLUR = int(os.environ.get("RIG_FOOT_BLUR", "22"))
BLEND = 0.30         # half-width of a joint band, in spans


def smoothstep(e0: float, e1: float, x: float) -> float:
    if e1 <= e0:
        return 1.0 if x >= e1 else 0.0
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def below(y: float, edge: float, width: float) -> float:
    """0 above `edge`, 1 below `edge + width` — a joint, not a gradient."""
    return smoothstep(edge, edge + width, y)


TORSO_DX = 0.04      # centre of her neck+torso envelope, relative to the eyes
TORSO_RX = 1.62      # half-width: 165 px on t1_s0, so x 371..701
TORSO_TOP = -0.20    # from just under the jaw...
TORSO_BOTTOM = 9.10  # ...down past her hands, in spans below the eye line
# Where the envelope starts widening and where it is as wide as her lap. The backrest is only at
# her shoulders; below her waist the width of the picture is her thighs, so the rig is allowed to
# use it.
TORSO_WAIST = 4.10
TORSO_LAP = 6.30
TORSO_RX_SEAT = 1.82  # ...and at her hands, where the seat shows either side of them
TORSO_RX_LAP = 2.95   # half-width at the lap: 300 px on t1_s0, her crossed thighs
# ...and then it narrows again. At her hands the plate stops being her: the seat is visible either
# side of them (measured 4 px of it walking along with `settle` before this taper existed).
TORSO_RIM = 0.08     # the last 8 % of the envelope fades out, ~13 px


def torso_gate(x: float, y: float) -> float:
    """Is this pixel her neck/torso — or the chair she is sitting on?

    An ellipse cannot answer that: her shoulders reach x 690 while the backrest's inner edge is
    at 345, and an ellipse wide enough for one side of her reaches into the chair on the other.
    A boxy superellipse (|dx|^4 + |dy|^4) is flat enough along her sides to leave the backrest,
    the armrests and the seat alone, while her own silhouette stays comfortably inside it.

    **The envelope widens below the waist, and that is the point of the two radii.** Above her
    ribs it has to be narrow, because the backrest's wings are exactly at her shoulders. At the
    lap there is nothing but her: crossed thighs, both hands, the hoodie's hem. The first version
    used the narrow radius all the way down and stopped the envelope at her ribs — which is why
    two thirds of the picture (`root`, 4045 of 4845 vertices) never moved and the rig read as
    "the skeleton is on her body, and her hands are a photograph". The lap now belongs to `hips`,
    so a weight shift carries her hands with it, which is exactly what hands on a lap do.
    """
    span = SPAN
    cx = MX + TORSO_DX * span
    waist = MY + TORSO_WAIST * span
    lap = MY + TORSO_LAP * span
    # Smooth widening, not a step: a step in a skin weight folds the mesh (measured, 547 folds).
    widen = smoothstep(waist, lap, y)
    taper = smoothstep(lap + 1.0 * span, lap + 2.7 * span, y)
    rx = (TORSO_RX + (TORSO_RX_LAP - TORSO_RX) * widen - (TORSO_RX_LAP - TORSO_RX_SEAT) * taper) * span
    top = MY + TORSO_TOP * span
    ry = (MY + TORSO_BOTTOM * span - top) / 2.0
    cy = top + ry
    dx = abs(x - cx) / rx
    dy = abs(y - cy) / ry
    d = (dx ** 4 + dy ** 4) ** 0.25
    return 1.0 - smoothstep(1.0 - TORSO_RIM, 1.0, d)


def head_gate(x: float, y: float) -> float:
    """How much this pixel belongs to the head+hair mass (the chair is outside it)."""
    rx, ry = HEAD_RX * SPAN, HEAD_RY * SPAN
    d = math.hypot((x - (MX + HEAD_DX * SPAN)) / rx, (y - (MY + HEAD_DY * SPAN)) / ry)
    return 1.0 - smoothstep(0.84, 1.0, d)


def head_cap(x: float, y: float) -> float:
    """Everything solid above her eye line is her head — hat and headphones included.

    The head ellipse is an anatomy model, and a witch hat is not anatomy: its brim is three eye
    spans wide and sits exactly at the eye line, so the ellipse left it behind and the hat stood
    still while the head turned inside it (measured on t1_s5: 231 solid vertices above y=300 with
    no head weight at all). The cap is the plate's own alpha, faded out before the chair's backrest
    starts, so the hat rides the head and the chair still never moves.
    """
    if _CAP_PIX is None:
        return 0.0
    height, width = _CAP_PIX.shape
    xi = min(width - 1, max(0, int(x)))
    yi = min(height - 1, max(0, int(y)))
    return float(_CAP_PIX[yi, xi]) / 255.0


def hair_factor(x: float, y: float) -> float:
    if _HAIR_PIX is None:
        return 0.0
    h, w = _HAIR_PIX.shape
    xi = min(w - 1, max(0, int(x)))
    yi = min(h - 1, max(0, int(y)))
    return float(_HAIR_PIX[yi, xi]) / 255.0


def influence(name: str, x: float, y: float) -> float:
    """1 deep inside a bone's ellipse, 0 outside it, smooth in between."""
    cx, cy, rx, ry = INFLUENCE[name]
    d = math.hypot((x - cx) / rx, (y - cy) / ry)
    return max(0.0, min(1.0, (1.06 - d) / 0.30))


def deform_mask(x: float, y: float) -> float:
    """How much any bone is allowed to touch this pixel — used by the audit and the docs."""
    return max(influence(name, x, y) for name in INFLUENCE if name != "root")

# Grid resolution of the body mesh. A joint band is ~30 px wide, so the grid has to be a few
# cells narrower than that or the bend lands inside a single row of triangles and creases.
COLS, ROWS = 56, 84


def bone_world(bones: list[tuple[str, float, float, str | None]]) -> dict[str, tuple[float, float]]:
    """World position of every bone, assuming zero rotation and unit scale at rest."""
    table = {name: (x, y, parent) for name, x, y, parent in bones}
    world: dict[str, tuple[float, float]] = {}

    def resolve(name: str) -> tuple[float, float]:
        if name in world:
            return world[name]
        x, y, parent = table[name]
        if parent is None:
            world[name] = (x, y)
        else:
            px, py = resolve(parent)
            # Bone offsets are authored in absolute plate space, so subtract the parent's origin.
            world[name] = (x - table[parent][0] + px, y - table[parent][1] + py)
        return world[name]

    for name, _, _, _ in bones:
        resolve(name)
    return world


def weights_for(x: float, y: float, world: dict[str, tuple[float, float]]) -> list[dict]:
    """Skin weights as PARTS, not as a fog — and every term continuous.

    The first version of this function scored every bone by its height and let the top two win,
    with a 190 px gaussian falloff, and blended the hair on top of that through a 44 px mask. Every
    vertex therefore moved a little, in a slightly different direction from its neighbour: the
    picture never articulated, it sagged — and the hair, dragged between the hair bone and the
    chest, smeared into a ghost of its own edge on every reaction.

    What a character rig does instead: a pixel belongs to ONE part, that part is rigid, and parts
    meet in narrow joints. The head — face, hair, headphones — is one rigid body. The hair that
    falls past the jaw hangs off it. The torso is rigid between the waist and the shoulders. Only
    the neck and the waist bend, and they bend over ~30-45 px.

    Every term below is a smooth ramp. A boolean here ("is this pixel hers?") is a step, and a
    step in a skin weight folds the mesh — 547 inverted triangles in one head turn, which is what
    ghosting looks like in geometry.
    """
    span = SPAN
    chin = MY + CHIN * span
    hair = hair_factor(x, y)
    head = head_gate(x, y)
    # The cap only ever fills what the ellipse missed, never overrides it: inside the head mass
    # nothing changes (so the face stays rigid and the hair keeps its measured travel), and a hat
    # brim that hangs outside the anatomy gets the head's motion instead of standing still.
    worn = head_cap(x, y) * (1.0 - max(head, hair))
    her = max(head, hair) + worn                # head + hair + anything she wears on it

    # 1. The head owns everything above her jaw and hands it over across the neck.
    head_gate_ramp = 1.0 - below(y, chin, 0.45 * span)
    w_head = (her - worn) * head_gate_ramp       # her skull and hair
    w_worn = worn * head_gate_ramp               # the hat on top of it
    # 2. Hair that falls past the jaw is still her hair: it rides the head chain on its own bone,
    #    which is where the physics spring lives.
    w_hair = hair * below(y, chin - 0.45 * span, 0.85 * span)

    rest = max(0.0, 1.0 - w_head - w_worn - w_hair)
    # 3. Under the jaw the neck takes over and then the chest. No booleans: two ramps that cross.
    #    The neck starts BELOW the jaw: without that ramp the band reached the backrest behind her
    #    head and dragged 21 px of chair along with every nod.
    neck_ramp = below(y, chin - 0.35 * span, 0.35 * span)
    neck_share = neck_ramp * (1.0 - below(y, chin + 0.15 * span, 0.75 * span))
    own = torso_gate(x, y)          # her body, not the chair
    w_neck = rest * neck_share * own
    lower = rest * (1.0 - neck_share) * own

    # 4. The torso ladder, gated so the chair she sits on never moves with her.
    chest_y, spine_y, hips_y = world["chest"][1], world["spine"][1], world["hips"][1]
    w = BLEND * span
    spine_in = below(y, chest_y + 0.45 * (spine_y - chest_y), w)
    hips_in = below(y, spine_y + 0.45 * (hips_y - spine_y), w)
    floor_in = below(y, hips_y + 0.35 * (hips_y - spine_y), w)
    ladder = [
        ("chest", 1.0 - spine_in),
        ("spine", spine_in - hips_in),
        ("hips", hips_in - floor_in),
        ("root", floor_in),
    ]
    parts = [
        ("head", w_head),
        ("head_wear", w_worn),
        ("hair_back", w_hair),
        ("neck", w_neck),
    ]
    for name, share in ladder:
        parts.append((name, lower * share))
    # Whatever the envelope rejected is the chair under her: still, forever.
    parts.append(("root", max(0.0, 1.0 - w_head - w_worn - w_hair - w_neck - lower)))

    # 5. Feet: the socks take themselves over, softly, and nothing else on the plate with them.
    #    A blunt takeover (share 1 in the mask, 0 outside) would draw the sock's edge twice, so the
    #    mask is blurred and a half-share sock pixel splits between the foot and its neighbour.
    for side in ("left", "right"):
        share = foot_factor(side, x, y)
        if share > 0.0:
            parts = [(n, v * (1.0 - share)) for n, v in parts]
            # The front of the sock is its own bone, so a tap on the sole can curl the toes without
            # swinging the whole foot. The split is by height inside the mask: the toe bone inherits
            # `foot_*`, so a foot swing still carries the toes with it.
            toe = toe_ramp(side, y)
            if toe > 0.001:
                parts.append((f"toe_{side}", share * toe))
                if share * (1.0 - toe) > 0.001:
                    parts.append((f"foot_{side}", share * (1.0 - toe)))
            else:
                parts.append((f"foot_{side}", share))

    # 6. Bust: a small, soft part in front of the chest, split left and right so each side can be
    #    on its own spring. The split is by *influence ratio*, not by a vertical cut: the two
    #    ellipses overlap across the sternum, so every pixel in the middle is shared and the seam
    #    between the sides is a gradient rather than a line the mesh could tear along.
    if abs(y - world["bust_left"][1]) < 1.15 * span:
        bl = influence("bust_left", x, y)
        br = influence("bust_right", x, y)
        both = bl + br
        if both > 0.0:
            # 0.62, not 0.5: at half the chest's share the bust travelled 4.7 px on a tap, which the
            # stage draws at 0.14 scale — two thirds of a pixel. 0.62 plus the softer springs below
            # put it at ~7 px, which is the smallest that still reads as a body on a phone.
            soft = 0.80 * min(1.0, both) * lower
            parts = [(n, v * (1.0 - soft)) for n, v in parts]
            parts.append(("bust_left", soft * bl / both))
            parts.append(("bust_right", soft * br / both))
    return finish(x, y, world, parts)


RELAX = float(os.environ.get("RIG_RELAX", "0.5"))       # neighbour share per pass
RELAX_PASSES = int(os.environ.get("RIG_RELAX_PASSES", "3"))


HEAD_FAMILY = ("head", "head_wear", "hair_back")


RAMP = float(os.environ.get("RIG_RAMP", "2.2"))   # how many cells the head share fades over


def head_ceiling() -> np.ndarray:
    """Per-grid-vertex ceiling on the head family's share: full inside her, ramping to zero at the edge.

    The ceiling is the geometry that already decides what is her (`head_gate`, the hair curtain, the
    hat cap), sampled at the vertices and then **ramped inward**: the ramp is a chamfer distance to
    the nearest vertex that is not hers, so it only ever exists *inside* her silhouette and can never
    hand head weight to the chair (a diffusion without it found the chair: one backrest vertex
    carrying 0.02 of `head` grew to 0.08 and the backrest rocked 2.4 px in `idle`).

    Distance, not a blurred mask, because a blur is symmetric: half of it lands on the chair. A
    distance ramp is a fade *she* owns, wide enough (`RAMP` cells ≈ 2.2 × 18 px) that no single
    mesh edge at the hair/backrest boundary carries the whole head travel.
    """
    rows, cols = ROWS + 1, COLS + 1
    her = np.zeros((rows, cols), bool)
    for r in range(rows):
        for c in range(cols):
            x, y = c * W / COLS, r * H / ROWS
            her[r, c] = (
                max(
                    head_gate(x, y),
                    hair_factor(x, y),
                    head_cap(x, y),
                    torso_gate(x, y),
                    foot_factor("left", x, y),
                    foot_factor("right", x, y),
                )
                > 0.02
            )
    big = 1e6
    dist = np.where(her, big, 0.0)
    for _ in range(2):  # chamfer, four neighbours, twice: cheap and monotone
        for r in range(rows):
            for c in range(cols):
                if not her[r, c]:
                    continue
                best = dist[r, c]
                if r > 0:
                    best = min(best, dist[r - 1, c] + 1.0)
                if c > 0:
                    best = min(best, dist[r, c - 1] + 1.0)
                if r + 1 < rows:
                    best = min(best, dist[r + 1, c] + 1.0)
                if c + 1 < cols:
                    best = min(best, dist[r, c + 1] + 1.0)
                dist[r, c] = best
    t = np.clip(dist / max(RAMP, 1e-6), 0.0, 1.0)
    ramp = t * t * (3.0 - 2.0 * t)
    return np.where(her, ramp, 0.0)


RELAX_FAMILY = os.environ.get("RIG_RELAX_FAMILY", "all")   # "all" or "head"


def relax_weights(
    weights: list[list[dict]],
    world: dict[str, tuple[float, float]],
    ceiling: np.ndarray | None = None,
    face_box: list[int] | None = None,
) -> list[list[dict]]:
    """Spread every weight step over a few cells instead of one.

    The worst ghost in this rig is neither a fold nor a stretched bone: it is the *edge* where a
    moving vertex has a still neighbour. Her hair against the backrest is the loudest one, because
    `turn` carries the whole head past it (17.5 px on t3_s4 before this), but the neck against the
    room does the same thing the moment the torso leans (`lean_in`, 18.7 px), and so does a shoulder.

    So the thing that gets smoothed is **one scalar per vertex: how much of it moves at all** —
    everything except `root`. Inside that, every bone keeps its original share, so articulation is
    untouched: the head is still rigid, the neck still bends over the same band, the hat still rides
    the skull. What changes is only *where the moving/static boundary sits*, and by construction it
    is three cells wide now instead of one.

    Three boundary conditions, and each one is a promise kept:

    * a vertex with no moving share is returned **weight for weight** — the chair, the desk, the
      room and the floor cannot move (`qa:audit`'s prop column is a hard zero);
    * the ceiling is her own silhouette, ramped inward by distance, so no vertex that is not hers
      can inherit motion from a neighbour (without it one backrest vertex carrying 0.02 grew to
      0.08 and the backrest rocked 2.4 px in `idle`);
    * the drawn face is frozen outright, because the face test measures eye-to-chin and 0.25 % of a
      170 px face is a visible 0.4 px.

    `RIG_RELAX_FAMILY=head` restricts the pass to head + hat + hair, for comparing a candidate.
    Shipped values: three passes of half-neighbour averaging, `RAMP` 2.2 cells.
    """
    if RELAX_PASSES <= 0 or RELAX <= 0.0:
        return weights
    rows, cols = ROWS + 1, COLS + 1
    group = None if RELAX_FAMILY != "head" else set(HEAD_FAMILY)
    m = np.zeros((rows, cols), np.float64)
    shares: list[dict[str, float]] = [dict() for _ in range(len(weights))]
    for i, entry in enumerate(weights):
        r, c = divmod(i, cols)
        for e in entry:
            name = e["bone"][5:]
            if name == "root":
                continue
            if group is not None and name not in group:
                continue
            m[r, c] += e["weight"]
            shares[i][name] = e["weight"]

    moving = m > 0.0
    if ceiling is not None:
        moving &= ceiling > 1e-3

    def frozen(x: float, y: float) -> bool:
        # The face band, in anatomy: from just over the eyes down past the chin. Deliberately NOT
        # the whole head — the hair and the hood above her eyes are where the smoothing has work.
        if MX - 1.15 * SPAN <= x <= MX + 1.15 * SPAN and MY - 0.55 * SPAN <= y <= MY + 1.35 * SPAN:
            return True
        if face_box:
            fx0, fy0, fx1, fy1 = face_box
            return fx0 - 14 <= x <= fx1 + 14 and fy0 - 4 <= y <= fy1 + 30
        return False

    for r in range(rows):
        for c in range(cols):
            if frozen(c * W / COLS, r * H / ROWS):
                moving[r, c] = False
    moving = np.array(moving, dtype=bool)

    for _ in range(RELAX_PASSES):
        acc = np.zeros_like(m)
        cnt = np.zeros_like(m)
        acc[1:] += m[:-1]; cnt[1:] += 1
        acc[:-1] += m[1:]; cnt[:-1] += 1
        acc[:, 1:] += m[:, :-1]; cnt[:, 1:] += 1
        acc[:, :-1] += m[:, 1:]; cnt[:, :-1] += 1
        nxt = (1.0 - RELAX) * m + RELAX * (acc / cnt)
        nxt[~moving] = m[~moving]
        m = np.clip(nxt, 0.0, 1.0)
    if ceiling is not None:
        m = np.minimum(m, ceiling)

    out: list[list[dict]] = []
    for i, entry in enumerate(weights):
        r, c = divmod(i, cols)
        if not moving[r, c]:
            out.append(entry)
            continue
        inner = shares[i]
        inner_total = sum(inner.values())
        keep = [e for e in entry if e["bone"][5:] not in inner]
        keep_total = sum(e["weight"] for e in keep)
        parts: list[tuple[str, float]] = []
        if inner_total > 1e-6:
            for name, share in inner.items():
                parts.append((name, share / inner_total * m[r, c]))
        elif m[r, c] > 1e-6:
            parts.append(("root", m[r, c]))
        for e in keep:
            parts.append((e["bone"][5:], e["weight"] / keep_total * (1.0 - m[r, c]) if keep_total > 1e-6 else 0.0))
        x, y = c * W / COLS, r * H / ROWS
        out.append(finish(x, y, world, parts))
    return out


def finish(x: float, y: float, world: dict[str, tuple[float, float]], parts: list[tuple[str, float]]) -> list[dict]:
    """Normalise a part list into skin weights, dropping everything that rounds away to nothing."""
    parts = [(n, w) for n, w in parts if w > 1e-3]
    if not parts:
        parts = [("root", 1.0)]
    total = sum(w for _, w in parts)
    out = []
    for name, weight in parts:
        if weight <= 1e-3:
            continue
        bx, by = world[name]
        out.append(
            {
                "bone": f"bone_{name}",  # weights reference bone IDs, not names
                "x": round(x - bx, 3),
                "y": round(y - by, 3),
                "weight": round(weight / total, 4),
            }
        )
    # Round the weights but keep the sum at exactly 1.0, or the skinned point drifts.
    acc = 0.0
    for i, w in enumerate(out):
        if i == len(out) - 1:
            w["weight"] = round(1.0 - acc, 4)
        else:
            w["weight"] = round(w["weight"], 4)
            acc += w["weight"]
    # A share that rounds to zero is not a part, it is a bone that does nothing but is still
    # listed. That is how a head vertex ended up carrying `root: 0.0` and stopped being
    # recognisable as "on the head" to every tool that looks for a single-bone vertex — the
    # runtime was right, the document was untidy. Drop them, hand the share to the biggest bone.
    ghost = sum(w["weight"] for w in out if w["weight"] <= 0.0005)
    if ghost > 0.0:
        out = [w for w in out if w["weight"] > 0.0005]
        if not out:
            out = [{"bone": "bone_root", "x": 0.0, "y": 0.0, "weight": 1.0}]
        else:
            biggest = max(out, key=lambda w: w["weight"])
            biggest["weight"] = round(biggest["weight"] + ghost, 4)
            total = sum(w["weight"] for w in out)
            for w in out:
                w["weight"] = round(w["weight"] / total, 4)
            out[-1]["weight"] = round(1.0 - sum(w["weight"] for w in out[:-1]), 4)
    return out


def apply_motion_scale(doc: dict, factor: float) -> None:
    """Shrink every rotation key by a per-art factor — the motion budget is in pixels.

    A rotation is authored in degrees, so the pixels it throws depend on the length of the bone
    levers, and those are placed from the eye line: a plate whose inter-ocular distance is 147 px
    instead of the reference 101 px gets 1.46x the travel for the same keyframe. On
    `transparent_s0` — a full-body plate with hair down to the waist — that put the idle crown
    throw at 30.7 px and a hammered tap at 34.1 px, both outside the budget every other rig in
    the set keeps. Measured lever arms cannot be turned into a motion factor automatically (the
    hair length differs by art, not only the scale), so the factor is an explicit per-art number
    in the manifest. Translations are untouched: bone `y` keys are absolute positions.
    """
    if factor >= 0.999:
        return
    for anim in doc["animations"]:
        for tl in anim["timelines"]:
            if tl["target"] == "bone" and tl["property"] == "rotation":
                for key in tl["keys"]:
                    key["value"] = round(key["value"] * factor, 4)


def assert_neutral_start(doc: dict) -> None:
    """Every animation must open on the setup pose.

    OpenBone timelines are absolute, so a key that reads "0" while the bone sits at -260
    teleports the bone to the origin instead of leaving it alone. That is a silent killer in
    a live preview, so it fails the build instead.
    """
    bones = {b["id"]: b for b in doc["skeleton"]["bones"]}
    for anim in doc["animations"]:
        for tl in anim["animations"] if False else anim["timelines"]:
            if tl["target"] != "bone":
                continue
            first = tl["keys"][0]["value"]
            base = bones[tl["id"]][tl["property"]]
            if abs(first - base) > 1e-6:
                raise SystemExit(
                    f"{anim['name']}/{tl['id']}.{tl['property']} opens at {first}, "
                    f"setup pose is {base} — key the delta through tl(), not an absolute value"
                )



def build() -> dict:
    world = bone_world(BONES)

    # --- grid mesh -------------------------------------------------------------------
    verts: list[float] = []
    uvs: list[float] = []
    weights: list[list[dict]] = []
    for row in range(ROWS + 1):
        for col in range(COLS + 1):
            x = col * W / COLS
            y = row * H / ROWS
            verts += [round(x, 3), round(y, 3)]
            uvs += [round(col / COLS, 6), round(row / ROWS, 6)]
            weights.append(weights_for(x, y, world))
    weights = relax_weights(weights, world, head_ceiling(), FACE_BOX)

    triangles: list[int] = []
    stride = COLS + 1
    for row in range(ROWS):
        for col in range(COLS):
            a = row * stride + col
            b = a + 1
            c = a + stride
            d = c + 1
            triangles += [a, b, d, a, d, c]

    # Every grid vertex is on the outline in the sense that no hull shrink is desired:
    # hull=0 tells the runtime to treat the mesh as a plain weighted grid.
    mesh = {
        "type": "mesh",
        "name": "miya_body",
        "image": IMG_ID,
        "uvs": uvs,
        "triangles": triangles,
        "vertices": verts,
        "weights": weights,
        "hull": 0,
        "color": "#ffffff",
        # Not part of the OpenBone schema: the authoring grid, so offline tools (and the
        # preview renderer) can rebuild quads without guessing the stride from the count.
        "grid": {"cols": COLS, "rows": ROWS},
    }

    # --- bones -----------------------------------------------------------------------
    bones = []
    for name, x, y, parent in BONES:
        px, py = world[parent] if parent else (0, 0)
        bones.append(
            {
                "id": f"bone_{name}",
                "name": name,
                "parent": f"bone_{parent}" if parent else None,
                "length": 0 if name == "root" else (96.0 if name == "hair_back" else BONE_LENGTH),
                "x": round(world[name][0] - px, 3) if parent else round(x, 3),
                "y": round(world[name][1] - py, 3) if parent else round(y, 3),
                "rotation": 0,
                "scaleX": 1,
                "scaleY": 1,
                "shearX": 0,
                "shearY": 0,
                "inherit": "normal",
            }
        )

    # OpenBone timelines are ABSOLUTE: a keyed value replaces the setup value, it is not an
    # offset from it. Authoring deltas ("neck 3px up") is far more legible, so every key goes
    # through `tl()`, which adds the bone's setup value back in.
    setup = {b["id"]: b for b in bones}

    def tl(bone: str, prop: str, pairs, ease=(0.42, 0, 0.58, 1)) -> dict:
        base = setup[bone][prop]
        keys = [
            {"time": t, "value": round(base + delta, 4), "curve": list(ease)} for t, delta in pairs
        ]
        return {"target": "bone", "id": bone, "property": prop, "keys": keys}

    def bust_pair(prop: str, pairs, lag: float = 0.07, scale: float = 0.84, ease=(0.42, 0, 0.58, 1)) -> list[dict]:
        """The same gesture on two springs, a seventh of a second apart and 16 % apart in size.

        Authored on top of the physics, not instead of it: the springs react to what the animation does,
        so a lag here becomes a lag there. `scale` is under 1 on the right because her right is the
        tauter side (see `PHYSICS`), and `lag` is inside the shortest beat this rig has (0.5 s), so the
        two never read as a single rigid object being moved.
        """
        last = pairs[-1][0]
        right = [(min(round(t + lag, 3), last), round(v * scale, 4)) for t, v in pairs]
        return [tl("bone_bust_left", prop, pairs, ease), tl("bone_bust_right", prop, right, ease)]

    # Breathing is a RISE, not an inflate. Scaling the chest by 3 % scales everything above it
    # about the chest's origin: her head — 400 px up the chain — travelled 24 px per breath, which
    # on a phone reads as a jelly wobble, not as breathing. A 1.5 px lift of the chest plus a
    # barely-there bust swell gives the same impression at a fifth of the amplitude, and the
    # measurement in `tests/rig.test.ts` keeps it there.
    breath = {
        "id": "anim_breath",
        "name": "breath",
        "duration": 4.0,
        "timelines": [
            # Asymmetric, because she is breathing and not being inflated: a human takes about a
            # third of the cycle to fill the lungs and the rest to let go, then holds an empty beat
            # before the next one. A symmetric 2 s / 2 s sine is the single most recognisable sign
            # of a synthesised idle — the eye reads it as a loop within two breaths.
            tl("bone_chest", "y", ((0, 0), (1.35, -1.5), (3.5, 0), (4.0, 0)),
               ease=(0.34, 0.02, 0.44, 1)),
            tl("bone_neck", "y", ((0, 0), (1.45, -0.6), (3.6, 0), (4.0, 0))),
            tl("bone_head", "y", ((0, 0), (1.55, -0.4), (3.65, 0), (4.0, 0))),
            # The bust is a leaf bone: scaling it swells the chest without moving the head.
            *bust_pair("scaleY", ((0, 0), (1.4, 0.014), (3.5, 0), (4.0, 0))),
            *bust_pair("scaleX", ((0, 0), (1.4, 0.008), (3.5, 0), (4.0, 0))),
            tl("bone_chest", "rotation", ((0, 0), (1.35, 0.14), (3.5, 0), (4.0, 0))),
        ],
        "events": [],
    }

    sway = {
        "id": "anim_sway",
        "name": "sway",
        "duration": 7.0,
        "timelines": [
            tl("bone_hips", "rotation", ((0, 0), (1.75, 0.55), (3.5, 0), (5.25, -0.55), (7.0, 0))),
            tl("bone_chest", "rotation", ((0, 0), (1.75, -0.35), (3.5, 0), (5.25, 0.35), (7.0, 0))),
            tl("bone_head", "rotation", ((0, 0), (1.75, 0.55), (3.5, 0), (5.25, -0.55), (7.0, 0))),
            tl("bone_head", "y", ((0, 0), (1.75, -1.2), (3.5, 0), (5.25, -1.2), (7.0, 0))),
            # The hair is late by design: it is the same head bone plus a spring, so it settles
            # a beat after she does.
            tl("bone_hair_back", "rotation", ((0, 0), (2.1, -0.7), (3.9, 0.2), (5.6, 0.7), (7.0, 0))),
        ],
        "events": [],
    }

    # Turn: a glance, not a swivel. Three things make it read as a person looking around
    # instead of a picture being rotated about her chin:
    #   1. **anticipation** — a fifth of a degree the other way before she goes, and a breath in;
    #   2. **a blink first** — nobody starts a big head move with their eyes wide open;
    #   3. **it comes home** — she looks away, sweeps back past neutral, and lands on zero, so
    #      returning to `idle` at the end is a cut nobody can see (it used to end at -1.8° and
    #      snap back when the game switched animations).
    turn = {
        "id": "anim_turn",
        "name": "turn",
        "duration": 2.4,
        "timelines": [
            tl("bone_head", "rotation",
               ((0, 0), (0.14, -0.30), (0.52, 3.35), (1.30, 0.55), (1.95, -2.05), (2.40, 0)),
               ease=(0.22, 0.7, 0.3, 1)),
            tl("bone_neck", "rotation",
               ((0, 0), (0.18, -0.09), (0.62, 0.95), (1.45, 0.12), (2.10, -0.55), (2.40, 0))),
            tl("bone_chest", "rotation",
               ((0, 0), (0.55, 0.65), (1.50, 0.02), (2.15, -0.40), (2.40, 0)),
               ease=(0.3, 0.2, 0.4, 1)),
            tl("bone_chest", "y", ((0, 0), (0.22, -1.4), (1.10, 0), (2.20, 0.6), (2.40, 0))),
            tl("bone_hair_back", "rotation", ((0, 0), (0.85, -1.25), (1.75, 0.35), (2.40, 0))),
            {
                "target": "slot",
                "id": "slot_eyes",
                "property": "attachment",
                "keys": [
                    {"time": 0.00, "value": None, "curve": "stepped"},
                    {"time": 0.09, "value": "eyes_closed", "curve": "stepped"},
                    {"time": 0.18, "value": None, "curve": "stepped"},
                    {"time": 1.62, "value": "eyes_closed", "curve": "stepped"},
                    {"time": 1.71, "value": None, "curve": "stepped"},
                ],
            },
        ],
        "events": [],
    }

    shake = {
        "id": "anim_shake",
        "name": "shake",
        "duration": 0.9,
        "timelines": [
            # One beat, one overshoot. The head is a rigid body now, so a degree really is a
            # degree: 2.2° at the crown is 11 px of travel, which reads on a phone; the old rig
            # needed 6° for the same read because it smeared the motion across her whole body.
            tl("bone_head", "rotation", ((0, 0), (0.16, 3.2), (0.40, -1.9), (0.64, 0.6), (0.90, 0))),
            tl("bone_neck", "rotation", ((0, 0), (0.16, 1.0), (0.40, -0.55), (0.90, 0)),
               ease=(0.25, 0.1, 0.25, 1)),
            # The chest answers a little later than the head — overlapping action, not a scale.
            tl("bone_chest", "rotation", ((0, 0), (0.24, 0.5), (0.52, -0.25), (0.90, 0)),
               ease=(0.3, 0, 0.4, 1)),
            tl("bone_chest", "y", ((0, 0), (0.16, 3.2), (0.44, -1.2), (0.9, 0))),
            tl("bone_hips", "rotation", ((0, 0), (0.3, -0.25), (0.9, 0))),
            # A donation lands on the chest too, and the two sides answer out of step: this is the
            # beat where the springs are allowed to ring, because it is rare and it is a reward.
            *bust_pair("rotation", ((0, 0), (0.20, -1.1), (0.46, 0.45), (0.90, 0)), lag=0.07, scale=0.85),
        ],
        "events": [],
    }

    # Tap: the clicker's own pulse. It has to READ on a phone, and the old one did not: the stage
    # draws this 1526 px plate at ~0.14 on a 390 px screen, so 1.5° of head — 11 px of silhouette
    # here — arrived as 1.5 px there. That is what «она не двигается при тапе» means in practice.
    #
    # The amplitude was cut back originally because the soft weight field smeared every degree into
    # a ghost. The head has been a rigid body since; the fold count stays at zero, so the honest
    # limit is set by the face instead: 6° of lean measured over the eye↔chin span comes to 0.16 %
    # (the test allows 0.25 %), and it reaches 21–23 px of travel even on the worst beat of the
    # idle loop.
    #
    # Where the lean sits matters. With all 6° on `bone_head` the jaw blend stretched to 0.30 % at
    # the same on-screen angle; splitting it 3°/3° between head and neck keeps the face rigid,
    # because the whole chain turning is rigid and only the head-against-neck part pulls the chin.
    #
    # Shape: down, a small lift past neutral, a settle. One beat, no ringing — the clicker fires
    # several times a second and the runtime drops requests that arrive mid-beat.
    tap = {
        "id": "anim_tap",
        "name": "tap",
        "duration": 0.5,
        "timelines": [
            tl("bone_head", "rotation",
               ((0, 0), (0.09, -3.1), (0.27, 0.26), (0.50, 0)),
               ease=(0.2, 0.6, 0.35, 1)),
            tl("bone_neck", "rotation", ((0, 0), (0.09, -3.0), (0.28, 0.24), (0.50, 0))),
            # The chest takes the hit before the head finishes travelling: a nod that starts at the
            # neck alone reads as a hinged puppet.
            tl("bone_chest", "y", ((0, 0), (0.12, -4.5), (0.30, 1.2), (0.50, 0)),
               ease=(0.25, 0.2, 0.4, 1)),
            tl("bone_chest", "rotation", ((0, 0), (0.14, 0.28), (0.32, -0.10), (0.50, 0))),
            # The far shoulder follows by a beat — the thing that separates a nod from a slide.
            # The chest takes the hit and the bust arrives after it: 1.5° about the chest wall is
            # ~1.8 px of travel at the mass, and the two springs stretch that into the settle.
            *bust_pair("rotation", ((0, 0), (0.17, -1.5), (0.36, 0.55), (0.50, 0)), lag=0.06, scale=0.85),
            tl("bone_hair_back", "rotation", ((0, 0), (0.20, 2.0), (0.38, -0.55), (0.50, 0))),
        ],
        "events": [],
    }

    # Region origin is its centre in bone-local space, so the offset is (plate centre - head bone).
    head_x, head_y = world["head"]

    def patch(name: str, image_id: str, spec: dict) -> dict:
        """A face patch as a weighted quad, not a region.

        A region places its four corners in bone-local BONE-LOCAL y-UP space — corner 0 sits at
        (x - w/2, y + h/2) — so on a y-down document the runtime would paste the picture in upside
        down: closed eyes over her eyebrows, a mouth under her chin. A mesh brings its own UVs, in
        the same convention as the body mesh (v = 0 on the top row, i.e. at the smaller y), so what
        the preview shows is what the renderer draws — and `tests/rig.test.ts` can check it by
        number instead of by eye.
        """
        w, h = float(spec["w"]), float(spec["h"])
        cx = spec["cx"] - head_x
        cy = spec["cy"] - head_y
        hw, hh = w / 2.0, h / 2.0
        # Top-left, top-right, bottom-right, bottom-left — y grows DOWN, like the plate.
        corners = [(cx - hw, cy - hh), (cx + hw, cy - hh), (cx + hw, cy + hh), (cx - hw, cy + hh)]
        return {
            "type": "mesh",
            "name": name,
            "image": image_id,
            "uvs": [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0],
            "triangles": [0, 1, 2, 0, 2, 3],
            "vertices": [round(v, 3) for corner in corners for v in corner],
            "weights": [
                [{"bone": "bone_head", "x": round(x, 3), "y": round(y, 3), "weight": 1.0}]
                for x, y in corners
            ],
            "hull": 0,
            "color": "#ffffff",
            "grid": {"cols": 1, "rows": 1},
        }

    eyes_closed = patch("eyes_closed", EYES_ID, PATCHES["eyes_closed"])
    has_mouth = "mouth_open" in PATCHES
    mouth_open = patch("mouth_open", MOUTH_OPEN_ID, PATCHES["mouth_open"]) if has_mouth else None
    has_closed_mouth = has_mouth and "mouth_closed" in PATCHES
    closed_image = []
    mouth_attachments = {"mouth_open": mouth_open} if has_mouth else {}
    if has_closed_mouth:
        closed_image = [
            {
                "id": MOUTH_CLOSED_ID,
                "name": "miya_mouth_closed",
                "src": f"/art/{PATCH_DIR}/{ART_KEY}_mouth_closed.webp",
                "width": PATCHES["mouth_closed"]["w"],
                "height": PATCHES["mouth_closed"]["h"],
            },
        ]
        mouth_attachments["mouth_closed"] = patch(
            "mouth_closed", MOUTH_CLOSED_ID, PATCHES["mouth_closed"]
        )
    # The tongue is the third mouth state, and it is art, not geometry: the moment an art has
    # `{art}_mouth_tongue.webp` in the face kit and a `mouth_tongue` patch in the manifest, the
    # rig picks it up, adds the attachment and the `tease` beat below. Nothing else to change —
    # `scripts/add_mouth_patch.py` registers the file.
    has_tongue = has_mouth and "mouth_tongue" in PATCHES
    tongue_image = []
    if has_tongue:
        tongue_image = [
            {
                "id": MOUTH_TONGUE_ID,
                "name": "miya_mouth_tongue",
                "src": f"/art/{PATCH_DIR}/{ART_KEY}_mouth_tongue.webp",
                "width": PATCHES["mouth_tongue"]["w"],
                "height": PATCHES["mouth_tongue"]["h"],
            },
        ]
        mouth_attachments["tongue"] = patch(
            "tongue", MOUTH_TONGUE_ID, PATCHES["mouth_tongue"]
        )

    # Blink: the closed-eye patch is switched on for ~90 ms. Slot attachment keys are stepped by
    # definition — the runtime switches at the key, it does not blend.
    blink = {
        "id": "anim_blink",
        "name": "blink",
        "duration": 0.24,
        "timelines": [
            {
                "target": "slot",
                "id": "slot_eyes",
                "property": "attachment",
                "keys": [
                    {"time": 0.0, "value": None, "curve": "stepped"},
                    {"time": 0.05, "value": "eyes_closed", "curve": "stepped"},
                    {"time": 0.14, "value": None, "curve": "stepped"},
                    {"time": 0.24, "value": None, "curve": "stepped"},
                ],
            }
        ],
        "events": [],
    }

    # Talk: the mouth flaps between two generated states. Deliberately irregular — an even
    # cadence reads as a machine, a human mouth holds some shapes longer.
    # Alternates between the open state and the canon plate (lips already parted) — a mouth that
    # never fully closes mid-sentence reads more alive than one that does.
    talk_keys = [
        (0.0, None), (0.09, "mouth_open"), (0.18, None), (0.27, "mouth_open"),
        (0.33, None), (0.42, "mouth_open"), (0.52, "mouth_open"),
        (0.61, None), (0.70, "mouth_open"), (0.80, None),
    ]
    talk = {
        "id": "anim_talk",
        "name": "talk",
        "duration": 0.8,
        "timelines": [
            {
                "target": "slot",
                "id": "slot_mouth",
                "property": "attachment",
                "keys": [{"time": t, "value": v, "curve": "stepped"} for t, v in talk_keys],
            }
        ],
        "events": [],
    }

    # Smile: mouth closed, held — only when the optional closed-mouth patch exists.
    smile = {
        "id": "anim_smile",
        "name": "smile",
        "duration": 0.5,
        "timelines": [
            {
                "target": "slot",
                "id": "slot_mouth",
                "property": "attachment",
                "keys": [{"time": 0.0, "value": "mouth_closed", "curve": "stepped"}],
            }
        ],
        "events": [],
    }

    # Tease: the tongue, held about a second, gone again. Slot keys are stepped, so this is a
    # state with a duration, not a fade — and it is only authored when the art exists.
    tease = None
    if has_tongue:
        tease = {
            "id": "anim_tease",
            "name": "tease",
            "duration": 1.6,
            "timelines": [
                {
                    "target": "slot",
                    "id": "slot_mouth",
                    "property": "attachment",
                    "keys": [
                        {"time": 0.0, "value": None, "curve": "stepped"},
                        {"time": 0.12, "value": "tongue", "curve": "stepped"},
                        {"time": 1.32, "value": "tongue", "curve": "stepped"},
                        {"time": 1.44, "value": None, "curve": "stepped"},
                    ],
                },
                # She cocks her head a little while she is being cheeky; a mouth that pops out of a
                # perfectly level head reads as a bug rather than a joke.
                tl("bone_head", "rotation", [(0.0, 0.0), (0.30, 0.9), (1.20, 0.7), (1.55, 0.0)]),
            ],
            "events": [],
        }

    # Giggle: two small bounces, a squint and a mouth that opens twice. The beat for something
    # funny in chat, and the shortest way this rig has of saying "she has a personality".
    def eyes(values) -> dict:
        return {
            "target": "slot",
            "id": "slot_eyes",
            "property": "attachment",
            "keys": [{"time": t, "value": v, "curve": "stepped"} for t, v in values],
        }

    giggle = {
        "id": "anim_giggle",
        "name": "giggle",
        "duration": 1.15,
        "timelines": [
            tl("bone_head", "rotation", ((0, 0), (0.10, 1.1), (0.22, -0.7), (0.34, 0.9), (0.48, -0.4), (0.66, 0.15), (0.95, 0)), ease=(0.25, 0.3, 0.4, 1)),
            tl("bone_head", "y", ((0, 0), (0.10, -1.6), (0.24, 0.2), (0.36, -1.3), (0.54, 0), (0.95, 0))),
            tl("bone_chest", "y", ((0, 0), (0.12, -1.5), (0.26, 0.2), (0.38, -1.2), (0.56, 0), (0.95, 0))),
            tl("bone_spine", "rotation", ((0, 0), (0.20, -0.28), (0.48, 0.18), (0.80, 0)), ease=(0.3, 0, 0.5, 1)),
            *bust_pair("rotation", ((0, 0), (0.14, -0.7), (0.34, 0.3), (0.60, 0)), lag=0.05, scale=0.85),
            eyes([(0.00, None), (0.09, "eyes_closed"), (0.21, None), (0.35, "eyes_closed"), (0.47, None)]),
        ] + ([
            {
                "target": "slot",
                "id": "slot_mouth",
                "property": "attachment",
                "keys": [
                    {"time": 0.00, "value": None, "curve": "stepped"},
                    {"time": 0.07, "value": "mouth_open", "curve": "stepped"},
                    {"time": 0.22, "value": "mouth_closed", "curve": "stepped"},
                    {"time": 0.34, "value": "mouth_open", "curve": "stepped"},
                    {"time": 0.56, "value": None, "curve": "stepped"},
                ],
            },
        ] if has_closed_mouth else []),
        "events": [],
    }

    # Lean in: she comes toward the camera, holds it a beat, and settles back.
    #
    # Rotation and a head translation only — **no torso translation**, and that is a measured
    # decision, not a taste one. Moving the chest 7 px forward drags her hands across the armrests
    # they are resting on: the audit caught 8 folded triangles and a 23 px edge on t3_s4 at the
    # hand, where the arm follows the chest and the armrest does not. A lean the player reads is
    # mostly the chin coming down and forward, so the head carries the translation (3.5 px) and the
    # chest carries 1 degree of pitch, which shears nothing that is standing still.
    lean_in = {
        "id": "anim_lean_in",
        "name": "lean_in",
        "duration": 2.6,
        "timelines": [
            # A lean toward the camera, authored the only way a 2D grid rig survives it: rotation
            # about the neck chain. Measured alternatives, all rejected: a 7 px torso translation
            # dragged her hands across the armrests (8 folds, 23 px on t3_s4); a 3.5 px head
            # translation tore the hair silhouette at the jaw (14.8 px, and that edge runs *along*
            # the translation); a 3.5 % head scale exploded the subtree (148 px — scale on a bone
            # with children multiplies through them in this runtime).
            tl("bone_head", "rotation", ((0, 0), (0.62, 2.0), (1.10, 1.6), (1.85, 1.9), (2.45, 0)), ease=(0.3, 0.2, 0.4, 1)),
            tl("bone_neck", "rotation", ((0, 0), (0.66, 0.9), (1.95, 0.7), (2.50, 0))),
            tl("bone_chest", "rotation", ((0, 0), (0.70, 0.45), (1.95, 0.35), (2.50, 0))),
            tl("bone_spine", "rotation", ((0, 0), (0.74, 0.25), (1.98, 0.2), (2.52, 0))),
            *bust_pair("rotation", ((0, 0), (0.70, -0.8), (1.20, 0.3), (2.30, 0)), lag=0.08, scale=0.8),
            eyes([(0.00, None), (0.75, "eyes_closed"), (0.95, None)]),
        ] + ([
            {
                "target": "slot",
                "id": "slot_mouth",
                "property": "attachment",
                "keys": [
                    {"time": 0.00, "value": None, "curve": "stepped"},
                    {"time": 0.70, "value": "mouth_closed", "curve": "stepped"},
                    {"time": 2.05, "value": None, "curve": "stepped"},
                ],
            },
        ] if has_closed_mouth else []),
        "events": [],
    }

    # Arch: she stretches her back and pushes her chest up. The one beat in the set that is
    # deliberately *seen* rather than merely noticed, and the reason it is authored on the chest and
    # the neck rather than on the whole body: the arms are `root`-weighted, so anything that moves
    # the torso without them is a shear at the armpit. A degree and a bit of chest rotation plus a
    # chin lift reads as the stretch; anything more is a rubber hoodie.
    arch = {
        "id": "anim_arch",
        "name": "arch",
        "duration": 1.7,
        "timelines": [
            tl("bone_chest", "rotation", ((0, 0), (0.42, 0.8), (1.05, 0.68), (1.45, -0.12), (1.70, 0)), ease=(0.3, 0.15, 0.4, 1)),
            tl("bone_chest", "y", ((0, 0), (0.44, -1.1), (1.05, -0.9), (1.50, 0.25), (1.70, 0)), ease=(0.3, 0.15, 0.4, 1)),
            # The neck carries 0.6° and no more: the neck is a *narrow* region whose silhouette is
            # bounded by `root`, so it is the cheapest place in this rig to buy an edge. The chin
            # lift lives on the head, where the motion is spread over the skull.
            tl("bone_neck", "rotation", ((0, 0), (0.46, 0.6), (1.10, 0.45), (1.52, 0)), ease=(0.3, 0.2, 0.4, 1)),
            tl("bone_head", "rotation", ((0, 0), (0.48, 2.4), (1.15, 1.9), (1.55, 0)), ease=(0.3, 0.2, 0.45, 1)),
            tl("bone_hair_back", "rotation", ((0, 0), (0.50, -1.1), (1.10, 1.6), (1.70, 0)), ease=(0.3, 0.2, 0.4, 1)),
            *bust_pair("rotation", ((0, 0), (0.46, 1.3), (0.92, -0.7), (1.30, 0.3), (1.70, 0)), lag=0.08, scale=0.88),
            eyes([(0.00, None), (0.30, "eyes_closed"), (0.86, None)]),
        ] + ([
            {
                "target": "slot",
                "id": "slot_mouth",
                "property": "attachment",
                "keys": [
                    {"time": 0.00, "value": None, "curve": "stepped"},
                    {"time": 0.34, "value": "mouth_open", "curve": "stepped"},
                    {"time": 0.66, "value": None, "curve": "stepped"},
                ],
            },
        ] if has_mouth else []),
        "events": [],
    }

    # Shy tuck: chin down, into her own shoulder, hair falling forward. This is the beat that makes
    # boldness legible: the same tap on the same spot, at low boldness, gets this instead of the
    # tongue. It is also the only new beat with no chest motion at all — a shy retreat is a head
    # movement, and keeping the torso still keeps it unmistakably a retreat.
    shy_tuck = {
        "id": "anim_shy_tuck",
        "name": "shy_tuck",
        "duration": 1.5,
        "timelines": [
            tl("bone_head", "rotation", ((0, 0), (0.30, -2.1), (0.95, -1.7), (1.32, 0.3), (1.50, 0)), ease=(0.25, 0.1, 0.4, 1)),
            tl("bone_head", "y", ((0, 0), (0.32, 1.4), (0.98, 1.1), (1.35, -0.2), (1.50, 0)), ease=(0.25, 0.1, 0.4, 1)),
            tl("bone_neck", "rotation", ((0, 0), (0.34, -0.8), (1.00, -0.6), (1.40, 0))),
            tl("bone_hair_back", "rotation", ((0, 0), (0.30, 1.4), (0.95, 2.1), (1.50, 0)), ease=(0.3, 0.2, 0.45, 1)),
            *bust_pair("rotation", ((0, 0), (0.34, -0.7), (0.90, 0.2), (1.40, 0)), lag=0.09, scale=0.7),
            eyes([(0.00, None), (0.26, "eyes_closed"), (0.62, None), (0.80, "eyes_closed"), (1.02, None)]),
        ] + ([
            {
                "target": "slot",
                "id": "slot_mouth",
                "property": "attachment",
                "keys": [
                    {"time": 0.00, "value": None, "curve": "stepped"},
                    {"time": 0.22, "value": "mouth_closed", "curve": "stepped"},
                    {"time": 1.10, "value": None, "curve": "stepped"},
                ],
            },
        ] if has_closed_mouth else []),
        "events": [],
    }

    # Shiver: five quick shakes, tight and fast, the way a body answers a cold finger on a foot.
    # Small on purpose — the amplitude here is under half a degree, and the read comes from the
    # frequency, not the size, which is also why it costs almost nothing in the edge budget.
    shiver = {
        "id": "anim_shiver",
        "name": "shiver",
        "duration": 0.62,
        "timelines": [
            tl("bone_head", "rotation", ((0, 0), (0.07, -0.42), (0.14, 0.38), (0.22, -0.34), (0.30, 0.28), (0.40, -0.18), (0.52, 0.08), (0.62, 0)), ease=(0.3, 0, 0.6, 1)),
            tl("bone_chest", "y", ((0, 0), (0.07, -0.55), (0.15, 0.2), (0.23, -0.45), (0.32, 0.15), (0.42, -0.25), (0.54, 0)), ease=(0.4, 0, 0.6, 1)),
            tl("bone_neck", "rotation", ((0, 0), (0.08, -0.22), (0.17, 0.18), (0.26, -0.14), (0.38, 0.08), (0.62, 0))),
            *bust_pair("rotation", ((0, 0), (0.09, -0.6), (0.18, 0.5), (0.27, -0.4), (0.38, 0.2), (0.55, 0)), lag=0.03, scale=0.9),
            eyes([(0.00, None), (0.10, "eyes_closed"), (0.44, None)]),
        ],
        "events": [],
    }

    # Settle: she shifts her weight in the chair. Two slow beats of the chest, the head countering,
    # the bust lagging behind both — the beat that says the chair has a body in it.
    settle = {
        "id": "anim_settle",
        "name": "settle",
        "duration": 1.25,
        "timelines": [
            tl("bone_chest", "rotation", ((0, 0), (0.28, 0.55), (0.70, -0.32), (1.05, 0.12), (1.25, 0)), ease=(0.35, 0.1, 0.4, 1)),
            tl("bone_head", "rotation", ((0, 0), (0.32, -0.45), (0.76, 0.30), (1.08, -0.10), (1.25, 0)), ease=(0.35, 0.1, 0.4, 1)),
            tl("bone_neck", "rotation", ((0, 0), (0.30, -0.18), (0.74, 0.12), (1.25, 0))),
            *bust_pair("rotation", ((0, 0), (0.34, -0.6), (0.78, 0.45), (1.10, -0.15), (1.25, 0)), lag=0.10, scale=0.75),
            # Hands on a lap do not stay glued to the thigh: they take up the last of the shift.
        ],
        "events": [],
    }

    # Hair flip: the small theatrical gesture. The head snaps one way, the hair goes the other and
    # comes back twice — the springs add a third and a fourth swing on their own.
    hair_flip = {
        "id": "anim_hair_flip",
        "name": "hair_flip",
        "duration": 1.4,
        "timelines": [
            tl("bone_head", "rotation", ((0, 0), (0.12, -2.6), (0.32, 1.3), (0.50, -0.5), (0.74, 0.2), (1.05, 0)), ease=(0.2, 0.6, 0.3, 1)),
            # 4.4 degrees, not 5.0: the swing is the point, the hair edge against the dark backdrop
            # is the bill, and the audit charges 13.3 px for 5.0. This is the largest swing that
            # stays inside the same budget as the rest of the rig.
            tl("bone_hair_back", "rotation", ((0, 0), (0.10, 3.0), (0.34, -4.4), (0.60, 1.9), (0.86, -0.6), (1.40, 0)), ease=(0.2, 0.5, 0.3, 1)),
            tl("bone_spine", "rotation", ((0, 0), (0.18, 0.45), (0.52, -0.2), (0.86, 0))),
            tl("bone_chest", "y", ((0, 0), (0.16, -1.2), (0.44, 0.3), (0.80, 0))),
            *bust_pair("rotation", ((0, 0), (0.18, -0.8), (0.46, 0.35), (0.80, 0)), lag=0.06, scale=0.85),
            eyes([(0.00, None), (0.07, "eyes_closed"), (0.19, None)]),
        ],
        "events": [],
    }

    # Gasp: the beat for a tap on her chest. A held breath — head back, chin up, chest lifted,
    # mouth open on the same frame the hit lands — and the two bust springs do the rest by
    # themselves, because the chest moved under them. It exists so that a tap on the chest is not
    # the same nod as a tap on the arm: a premium heroine answers in the place you touched her.
    gasp = {
        "id": "anim_gasp",
        "name": "gasp",
        "duration": 0.85,
        "timelines": [
            tl("bone_head", "rotation", ((0, 0), (0.12, 2.4), (0.34, 1.6), (0.62, 0.3), (0.85, 0)), ease=(0.2, 0.4, 0.4, 1)),
            tl("bone_neck", "rotation", ((0, 0), (0.14, 1.5), (0.40, 0.9), (0.70, 0.1), (0.85, 0))),
            tl("bone_chest", "y", ((0, 0), (0.16, -3.2), (0.44, 0.8), (0.72, -0.3), (0.85, 0)), ease=(0.2, 0.3, 0.4, 1)),
            tl("bone_chest", "rotation", ((0, 0), (0.18, -0.5), (0.50, 0.2), (0.85, 0))),
            *bust_pair("rotation", ((0, 0), (0.18, 1.2), (0.42, -0.5), (0.70, 0.2), (0.85, 0)), lag=0.07, scale=0.85),
            tl("bone_hips", "rotation", ((0, 0), (0.26, 0.2), (0.85, 0))),
        ] + ([
            {
                "target": "slot",
                "id": "slot_mouth",
                "property": "attachment",
                "keys": [
                    {"time": 0.00, "value": None, "curve": "stepped"},
                    {"time": 0.10, "value": "mouth_open", "curve": "stepped"},
                    {"time": 0.52, "value": None, "curve": "stepped"},
                ],
            },
        ] if has_mouth else []) + [
            {
                "target": "slot",
                "id": "slot_eyes",
                "property": "attachment",
                "keys": [
                    {"time": 0.00, "value": None, "curve": "stepped"},
                    {"time": 0.16, "value": "eyes_closed", "curve": "stepped"},
                    {"time": 0.30, "value": None, "curve": "stepped"},
                ],
            },
        ],
        "events": [],
    }

    # Tickle: the front of each sock curls in, three quick pulses, and she squirms a little.
    #
    # Only authored where the art actually has socks in frame (`_TOE_RAMP`), because the bones are
    # only on those plates — a `tickle` on a plate with no feet is a button that does nothing.
    # The toes are the point: a rotation about the toe bone, 9 degrees, which at this plate scale
    # lifts the toe tip ~5 px and nothing else on her moves that much.
    tickle = None
    if _TOE_RAMP:
        curl = [(0.0, 0.0), (0.10, -9.0), (0.20, -2.6), (0.30, -9.6), (0.42, -3.0),
                (0.54, -8.4), (0.70, -1.0), (0.86, 0.0), (1.20, 0.0)]
        tickle = {
            "id": "anim_tickle",
            "name": "tickle",
            "duration": 1.2,
            "timelines": [
                tl("bone_toe_left", "rotation", curl, ease=(0.2, 0, 0.4, 1)),
                # The right foot answers a tenth of a second later and curls less: two feet that
                # curl in unison are a claw closing, not a person being tickled.
                tl("bone_toe_right", "rotation",
                   [(min(round(t + 0.08, 3), 1.20), round(v * 0.85, 3)) for t, v in curl],
                   ease=(0.2, 0, 0.4, 1)),
                # The whole foot flinches with it, a degree, so the curl is not a decal on a still sock.
                tl("bone_foot_left", "rotation", ((0.0, 0.0), (0.12, 1.1), (0.34, -0.5), (0.58, 0.9), (0.86, 0.0)), ease=(0.3, 0, 0.5, 1)),
                tl("bone_foot_right", "rotation", ((0.0, 0.0), (0.20, -0.9), (0.44, 0.4), (0.66, -0.7), (0.92, 0.0)), ease=(0.3, 0, 0.5, 1)),
                # She feels it: a small squirm of the head and one giggle-squint of the eyes.
                tl("bone_head", "rotation", ((0.0, 0.0), (0.14, 0.55), (0.34, -0.45), (0.58, 0.35), (0.84, 0.0)), ease=(0.3, 0, 0.5, 1)),
                tl("bone_spine", "rotation", ((0.0, 0.0), (0.22, -0.35), (0.56, 0.25), (0.90, 0.0)), ease=(0.3, 0, 0.5, 1)),
                {
                    "target": "slot",
                    "id": "slot_eyes",
                    "property": "attachment",
                    "keys": [
                        {"time": 0.00, "value": None, "curve": "stepped"},
                        {"time": 0.16, "value": "eyes_closed", "curve": "stepped"},
                        {"time": 0.30, "value": None, "curve": "stepped"},
                        {"time": 0.50, "value": "eyes_closed", "curve": "stepped"},
                        {"time": 0.66, "value": None, "curve": "stepped"},
                    ],
                },
            ] + ([
                {
                    "target": "slot",
                    "id": "slot_mouth",
                    "property": "attachment",
                    "keys": [
                        {"time": 0.00, "value": None, "curve": "stepped"},
                        {"time": 0.14, "value": "mouth_open", "curve": "stepped"},
                        {"time": 0.80, "value": None, "curve": "stepped"},
                    ],
                },
            ] if has_mouth else []),
            "events": [],
        }

    # Idle: one 4 s loop that contains the breathing AND the blinks, so the game can just call
    # play("idle", true) once. A runtime that has to stack a blink animation on top of a breath
    # animation needs layer blending; folding the blinks into the same timeline needs nothing,
    # and the blinks still land on fixed beats — which is what a person does anyway, roughly.
    def slot_timeline(slot: str, pairs, offset: float = 0.0) -> dict:
        return {
            "target": "slot",
            "id": slot,
            "property": "attachment",
            "keys": [
                {"time": round(offset + t, 3), "value": v, "curve": "stepped"} for t, v in pairs
            ],
        }

    # ---- the idle clock --------------------------------------------------------------
    # Twenty seconds, not eight. Eight was long enough to look alive and short enough to expose
    # itself: by the second loop the eye has learned the breath rhythm and the four blink
    # positions, and from then on she is a GIF. Twenty seconds with a jittered breath, four
    # glances of different depth and fifteen uneven eyelids reads as "sitting there" for far
    # longer than it is — and it costs the runtime exactly the same, it is still one looping track.
    IDLE_LEN = 20.0

    def shifted(pairs, scale: float, lag: float):
        """Copy a gesture onto another bone: delayed, scaled, closed on neutral.

        Overlapping action as arithmetic. The neck carries 30 % of what the head does, 0.2 s
        later; the chest 11 %; the hair answers the other way. Every copy starts and ends at
        zero, so the loop closes without a seam.
        """
        out = [(0.0, 0.0)]
        for t, v in pairs:
            if t <= 0.0:
                continue
            out.append((round(min(t + lag, IDLE_LEN), 3), round(v * scale, 3)))
        if out[-1][1] != 0.0:
            out.append((IDLE_LEN, 0.0))
        return out

    # A breath every four seconds, five of them, no two the same depth: a person at rest is not
    # a sine wave — the second breath is shallower than the first, the fourth is a sigh.
    # 30 % deeper than it shipped: the breath read at 3 px on the plate, which is a third of a
    # pixel where the game draws her — measurably alive, invisible in practice. At 4 px of chest
    # travel the bust (which lags on its own spring) reaches 6.4 px and the picture finally
    # breathes at a glance. The body cap is 16 px; this is not close to it.
    chest_y = [
        (0.00, 0.0), (1.55, -4.0), (3.05, 0.0), (3.65, 0.24),
        (5.40, -3.4), (7.20, 0.0), (7.75, 0.18),
        (9.30, -4.4), (11.15, 0.0),
        (13.60, -3.6), (15.30, 0.0), (15.85, 0.21),
        (17.40, -4.2), (19.15, 0.0), (IDLE_LEN, 0.0),
    ]
    chest_rot = [
        (0.00, 0.0), (1.75, 0.29), (3.25, 0.0), (5.60, -0.26), (7.40, 0.0),
        (9.50, 0.31), (11.35, 0.0), (13.80, -0.23), (15.50, 0.0),
        (17.60, 0.29), (19.35, 0.0), (IDLE_LEN, 0.0),
    ]

    # Where she looks, in degrees of head rotation (positive is her left). Four glances, none the
    # same depth; the third goes one way and then the other, which reads as thinking. Each starts
    # with a micro-move the other way and overshoots on the way home — nothing in a body arrives
    # at rest without passing it.
    # Authored 15 % hotter than shipped: a glance of 2.0° moves her crown 21 px on the plate
    # (~10 px on a phone), which is the smallest that still reads, and leaves headroom under the
    # "that is a wobble, not a glance" ceiling the life test enforces.
    head_rot = [(t, round(v * 0.85, 3)) for t, v in [
        (0.00, 0.0),
        (1.05, -0.18), (1.55, 2.05), (2.65, 1.75), (3.55, -0.15), (4.15, 0.0),
        (6.35, 0.12), (7.05, -2.40), (8.25, -2.05), (9.35, 0.20), (9.95, 0.0),
        (11.55, 0.20), (12.35, 1.45), (13.15, 1.15), (13.95, -1.15), (14.85, -0.95),
        (15.85, 0.15), (16.45, 0.0),
        (17.65, -1.65), (18.75, -1.35), (19.50, 0.0),
    ]]
    head_y = [
        (0.00, 0.0), (1.35, -0.50), (1.85, -0.55), (3.40, 0.0),
        (7.10, -0.45), (9.20, 0.0), (12.30, -0.40), (15.60, 0.0),
        (17.70, -0.50), (19.60, 0.0), (IDLE_LEN, 0.0),
    ]
    hips_rot = [
        (0.00, 0.0), (2.40, 0.12), (6.00, -0.10), (10.50, 0.14),
        (15.00, -0.12), (19.00, 0.05), (IDLE_LEN, 0.0),
    ]
    # Feet: the smallest thing in the plate that can move on its own, and the only part of the
    # bottom of the picture that ever will. 3.2 degrees about the ankle is 8 px at the toe
    # (1.4 px where the game draws it) — visible in the loop, invisible in a still, and far under
    # the 16 px the body cap allows. The two feet are never together: one leads the breath, the
    # other answers half a beat later and shallower.
    foot_sway_left = [
        (0.00, 0.0), (2.20, 3.20), (4.60, -0.80), (7.10, 2.30), (9.80, -1.05),
        (12.30, 2.85), (14.90, -0.70), (17.20, 2.00), (19.40, 0.25), (IDLE_LEN, 0.0),
    ]
    foot_sway_right = [
        (0.00, 0.0), (3.10, -2.30), (5.70, 0.95), (8.30, -2.75), (10.90, 0.70),
        (13.60, -2.05), (16.10, 1.10), (18.40, -1.70), (IDLE_LEN, 0.0),
    ]

    # Eyelids: fifteen closures, gaps from 0.12 s to 2.35 s, two doubles and five that land right
    # before a glance — a person blinks before they turn their head, not during.
    blink_spans = [
        (1.15, 1.24), (2.42, 2.51), (4.05, 4.14), (6.30, 6.39), (7.52, 7.61),
        (9.05, 9.13), (9.17, 9.26),
        (11.40, 11.49), (12.02, 12.11), (13.44, 13.53), (14.95, 15.04),
        (16.60, 16.69), (17.62, 17.71), (19.05, 19.14), (19.19, 19.28),
    ]
    blink_beats = [(0.0, None)]
    for opened, closed in blink_spans:
        blink_beats += [(opened, "eyes_closed"), (closed, None)]

    # Speech is a series of bursts with pauses, spread across the whole loop — not two passes over
    # its first third. A chat line arrives at any moment, and the mouth has to be moving then.
    talk_beats = [
        (0.00, None), (0.09, "mouth_open"), (0.18, None), (0.27, "mouth_open"),
        (0.33, None), (0.42, "mouth_open"), (0.52, "mouth_open"),
        (0.61, None), (0.70, "mouth_open"), (0.80, None),
    ]
    talk_starts = [0.15, 2.95, 5.75, 8.55, 11.35, 14.15, 16.95]

    def idle_anim(anim_id: str, name: str, with_talk: bool) -> dict:
        """Twenty seconds of her sitting there, not twenty seconds of a breathing texture.

        Five breaths of different depth, four glances with the neck 0.2 s behind the head, two
        weight shifts in the hips, the hair settling after her every time, and fifteen uneven
        blinks. The amplitudes stay small on purpose — the head is a rigid body now, so one degree
        moves her crown about 5 px on a phone, where the old soft-weighted rig needed six degrees
        to read at all and looked like a rubber doll doing it.
        """
        timelines = [
            tl("bone_chest", "y", chest_y),
            tl("bone_chest", "rotation", chest_rot),
            tl("bone_neck", "y", shifted(chest_y, 0.32, 0.10)),
            *bust_pair("scaleY", shifted(chest_y, -0.0072, 0.08)),
            *bust_pair("scaleX", shifted(chest_y, -0.0036, 0.08)),
            tl("bone_head", "rotation", head_rot),
            tl("bone_head", "y", head_y),
            tl("bone_neck", "rotation", shifted(head_rot, 0.30, 0.20)),
            # The torso leans into the glance. It lives on the spine, not the chest, because the
            # chest already carries the breath on that property and a second track for the same
            # bone+property is deduplicated away — the lean would silently disappear.
            tl("bone_spine", "rotation", shifted(head_rot, 0.11, 0.30)),
            tl("bone_hair_back", "rotation", shifted(head_rot, -0.42, 0.26)),
            *bust_pair("rotation", shifted(head_rot, 0.06, 0.34), lag=0.09, scale=0.8),
            tl("bone_hips", "rotation", hips_rot),
        ]
        if _FOOT_PIX is not None:
            # The feet hang off the front of the chair and nothing else in the picture moves down
            # there, which is what made the bottom of the plate read as a photograph. They swing
            # around the ankle, a degree and a half, out of step with the breath and with each
            # other: two feet that swing together are a metronome.
            timelines += [
                tl("bone_foot_left", "rotation", foot_sway_left),
                tl("bone_foot_right", "rotation", foot_sway_right),
            ]
        timelines.append(slot_timeline("slot_eyes", blink_beats))
        if with_talk and has_mouth:
            # ONE timeline for the whole loop: the runtime keys a slot attachment once per track,
            # and a second timeline for the same slot is deduplicated away — the mouth then stays
            # shut for the rest of every loop.
            beats = []
            for start in talk_starts:
                beats += [(round(start + t, 3), v) for t, v in talk_beats]
            timelines.append(slot_timeline("slot_mouth", beats))
        return {
            "id": anim_id,
            "name": name,
            "duration": IDLE_LEN,
            "timelines": timelines,
            "events": [],
        }

    idle = idle_anim("anim_idle", "idle", False)
    idle_talk = idle_anim("anim_idle_talk", "idle_talk", True)

    # Physics is authored in plate units, and every plate is the same 1024-wide canvas, so the
    # numbers transfer between arts unchanged.
    physics = [dict(c) for c in PHYSICS]

    doc = {
        "format": "openbone",
        "version": 1,
        "name": "Miya Day 1",
        "width": W,
        "height": H,
        "originX": 0,
        "originY": 0,
        "background": "#00000000",
        "fps": 30,
        "images": [
            {
                "id": IMG_ID,
                "name": "miya_d1",
                "src": f"/art/{PLATE.name}",
                "width": W,
                "height": H,
            },
            {
                "id": EYES_ID,
                "name": "miya_eyes_closed",
                "src": f"/art/{PATCH_DIR}/{ART_KEY}_eyes_closed.webp",
                "width": PATCHES["eyes_closed"]["w"],
                "height": PATCHES["eyes_closed"]["h"],
            },
        ] + ([
            {
                "id": MOUTH_OPEN_ID,
                "name": "miya_mouth_open",
                "src": f"/art/{PATCH_DIR}/{ART_KEY}_mouth_open.webp",
                "width": PATCHES["mouth_open"]["w"],
                "height": PATCHES["mouth_open"]["h"],
            },
        ] if has_mouth else []) + closed_image + tongue_image,
        "skeleton": {
            "bones": bones,
            "slots": [
                {"id": "slot_body", "name": "body", "bone": "bone_root", "color": "#ffffff", "attachment": "miya_body", "blend": "normal"},
                # Face states are trimmed patches on the head bone: eyes and mouth swap
                # independently, so 2 patches give every combination instead of one plate each.
                {"id": "slot_eyes", "name": "eyes", "bone": "bone_head", "color": "#ffffff", "attachment": "", "blend": "normal"},
            ] + ([
                {"id": "slot_mouth", "name": "mouth", "bone": "bone_head", "color": "#ffffff", "attachment": "", "blend": "normal"},
            ] if has_mouth else []),
            "skins": [
                {
                    "id": "skin_default",
                    "name": "default",
                    "attachments": {
                        "slot_body": {"miya_body": mesh},
                        "slot_eyes": {"eyes_closed": eyes_closed},
                        **({"slot_mouth": mouth_attachments} if has_mouth else {}),
                    },
                }
            ],
            "ik": [],
            "transform": [],
            "path": [],
            "physics": physics,
        },
        "events": [],
        "animations": [idle, breath, sway, turn, shake, tap, blink]
        + ([idle_talk, talk] if has_mouth else [])
        + ([smile] if has_closed_mouth else [])
        + ([tease] if tease else [])
        + ([tickle] if tickle else [])
        + [gasp, giggle, lean_in, hair_flip, arch, shy_tuck, shiver, settle],
        "stateMachines": [
            {
                "id": "sm_miya",
                "name": "miya",
                # Required by the format: the runtime iterates it on every machine start.
                "scripts": [],
                "inputs": [],
                "bindings": [],
                "listeners": [],
                "layers": [
                    {
                        "id": "sm_miya_layer1",
                        "name": "Base",
                        "entry": "st_idle",
                        "states": [
                            {"id": "st_idle", "name": "idle", "type": "animation", "animation": "anim_idle", "loop": True, "speed": 1, "x": 0, "y": 0},
                        ] + ([
                            # Only exists where the mouth is free: the food frames blink only.
                            {"id": "st_idle_talk", "name": "idle_talk", "type": "animation", "animation": "anim_idle_talk", "loop": True, "speed": 1, "x": 50, "y": 0},
                        ] if has_mouth else []) + [
                            {"id": "st_breath", "name": "breath", "type": "animation", "animation": "anim_breath", "loop": True, "speed": 1, "x": 0, "y": 0},
                            {"id": "st_sway", "name": "sway", "type": "animation", "animation": "anim_sway", "loop": True, "speed": 1, "x": 200, "y": 0},
                            {"id": "st_turn", "name": "turn", "type": "animation", "animation": "anim_turn", "loop": True, "speed": 1, "x": 400, "y": 0},
                            {"id": "st_shake", "name": "shake", "type": "animation", "animation": "anim_shake", "loop": False, "speed": 1, "x": 600, "y": 0},
                        ],
                        "transitions": [],
                    }
                ],
            }
        ],
        "scripts": [],
        "audio": {"master": 1, "muted": False, "assets": [], "buses": [], "sounds": []},
    }
    assert_neutral_start(doc)
    return doc


def place_for(art: str) -> tuple[tuple[float, float], float]:
    """Eye-line midpoint and inter-ocular distance for an art, from its detected eye boxes."""
    data = json.loads(MANIFEST.read_text())
    entry = data[f"heroine_{art}"]
    eyes = entry.get("eyes") or []
    if len(eyes) != 2:
        raise SystemExit(f"{art}: need two detected eye boxes, got {len(eyes)}")
    centres = [((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) for b in eyes]
    mid = ((centres[0][0] + centres[1][0]) / 2, (centres[0][1] + centres[1][1]) / 2)
    span = math.dist(centres[0], centres[1])
    return mid, span


def main(argv: list[str] | None = None) -> int:
    global PATCHES, BONES, INFLUENCE, WEIGHT_SIGMA, PLATE, ART_KEY, IMG_ID, EYES_ID
    global MOUTH_OPEN_ID, MOUTH_CLOSED_ID, MOUTH_TONGUE_ID, _HAIR_PIX, _SOLID_PIX, _CAP_PIX, _FOOT_PIX, FACE_BOX, MX, MY, SPAN

    ap = argparse.ArgumentParser()
    ap.add_argument("--art", default="t1_s0", help="art key, e.g. t6_s1")
    ap.add_argument("--all", action="store_true", help="every art that has an eyes_closed patch")
    ap.add_argument("--out", default=None)
    args = ap.parse_args(argv)

    if args.all:
        data = json.loads(MANIFEST.read_text())
        arts = [
            k.replace("heroine_", "")
            for k, v in sorted(data.items())
            if "eyes_closed" in (v.get("patches") or {})
        ]
        ok, bad = 0, []
        for art in arts:
            rc = main(["--art", art])
            if rc == 0:
                ok += 1
            else:
                bad.append(art)
        print(f"\nrigged {ok}/{len(arts)} arts" + (f", failed: {' '.join(bad)}" if bad else ""))
        return 0 if not bad else 1

    ART_KEY = args.art
    PLATE = ART / f"heroine_{ART_KEY}.webp"
    OUT = Path(args.out) if args.out else (
        OUTDIR / "miya_day1.obone" if ART_KEY == "t1_s0" else OUTDIR / f"miya_{ART_KEY}.obone"
    )
    IMG_ID = f"img_miya_{ART_KEY}"
    EYES_ID = f"img_miya_{ART_KEY}_eyes_closed"
    MOUTH_OPEN_ID = f"img_miya_{ART_KEY}_mouth_open"
    MOUTH_CLOSED_ID = f"img_miya_{ART_KEY}_mouth_closed"
    MOUTH_TONGUE_ID = f"img_miya_{ART_KEY}_mouth_tongue"

    mid, span = place_for(ART_KEY)
    MX, MY, SPAN = mid[0], mid[1], span
    BONES, INFLUENCE, WEIGHT_SIGMA = derive_skeleton(mid, span, W, H)
    _TOE_RAMP.clear()

    entry = json.loads(MANIFEST.read_text())[f"heroine_{ART_KEY}"]
    FACE_BOX = entry.get("face")
    field = hair_field(PLATE, entry.get("face"), mid, span)
    _HAIR_PIX = np.asarray(field) if field is not None else None
    _SOLID_PIX, _CAP_PIX = head_cap_field(PLATE, mid, span)
    feet = foot_field(PLATE, mid, span)
    _FOOT_PIX = (feet[0], feet[1]) if feet else None
    if feet:
        # The bones sit on the art's own ankles, so the swing is around the ankle on every plate,
        # not around a reference point that happens to be right on one of them.
        BONES.append(("foot_left", round(feet[2][0], 3), round(feet[2][1], 3), "hips"))
        BONES.append(("foot_right", round(feet[3][0], 3), round(feet[3][1], 3), "hips"))
        INFLUENCE["foot_left"] = (feet[2][0], feet[2][1] + 1.0 * span, 1.2 * span, 1.3 * span)
        INFLUENCE["foot_right"] = (feet[3][0], feet[3][1] + 1.0 * span, 1.2 * span, 1.3 * span)
        # Toes: one bone per foot, placed at the toe end of the sock and banded by the sock's own
        # height. She is ticklish — the front of the sock curls when the sole is tapped — and a
        # single sock bone can only swing, never curl.
        for side, field, ankle in (
            ("left", feet[0], feet[2]),
            ("right", feet[1], feet[3]),
        ):
            pix = np.asarray(field)
            ys, xs = np.nonzero(pix > 128)
            if len(ys) == 0:
                continue
            y0, y1 = float(ys.min()), float(ys.max())
            band = y0 + 0.46 * (y1 - y0)
            front = pix > 128
            tip_band = np.zeros_like(front)
            tip_band[int(band + 0.30 * (y1 - y0)):] = True
            tip = tip_band & front
            if tip.sum() < 40:
                continue
            tip_x = float(np.nonzero(tip)[1].mean())
            tip_y = float(np.nonzero(tip)[0].mean())
            _TOE_RAMP[side] = (band, y0 + 0.90 * (y1 - y0))
            BONES.append((f"toe_{side}", round(tip_x, 3), round(tip_y, 3), f"foot_{side}"))

    PATCHES = face_patches(ART_KEY)
    doc = build()
    apply_motion_scale(doc, float(entry.get("motion", 1.0)))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    mesh = doc["skeleton"]["skins"][0]["attachments"]["slot_body"]["miya_body"]
    print(
        f"{OUT}: {len(doc['skeleton']['bones'])} bones{'' if feet else ' (no feet in frame)'}, "
        f"{len(mesh['vertices']) // 2} vertices, {len(mesh['triangles']) // 3} triangles, "
        f"{len(doc['animations'])} animations"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
