#!/usr/bin/env python3
"""Build the first real OpenBone document for Miya (day 1 plate).

What this is: a skeletal rig over the approved 1024x1526 plate — a deformable grid mesh
weighted to a spine chain, plus breathing / idle-sway / head-turn animations. It replaces
"one flat texture deformed by a hand-tuned mesh in HeroineRig" with an authored rig that a
runtime can actually animate, and it is the base we refine into a layered rig later.

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
    ("bust",           512,  745, "chest"),
    ("neck",           512,  620, "chest"),
    ("head",           512,  470, "neck"),
    ("hair_back",      512,  420, "head"),
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
        "inertia": 0.72, "strength": 95.0, "damping": 4.5, "mass": 1.0,
        "gravity": 12.0, "wind": 0.0, "mix": 0.72, "fps": 60, "volume": True,
    },
    {
        # Bust: the only part with real travel. It hangs off the chest, so it inherits the torso
        # motion and then overshoots it — that overshoot is the whole effect.
        "id": "phys_bust",
        "name": "bust",
        "bone": "bone_bust",
        "x": 0.55, "y": 0.75, "rotate": 0.45, "scaleX": 0.20,
        "inertia": 0.86, "strength": 115.0, "damping": 4.2, "mass": 1.0,
        "gravity": 0.0, "wind": 0.0, "mix": 0.85, "fps": 60, "volume": False,
    },
    {
        # Chest: taut, fast, small travel. Enough to let the torso settle a moment after the
        # hips do; a big value here reads as a rubber body.
        "id": "phys_chest",
        "name": "chest",
        "bone": "bone_chest",
        "x": 0.18, "y": 0.22, "rotate": 0.35, "scaleX": 0.0,
        "inertia": 0.55, "strength": 260.0, "damping": 6.5, "mass": 1.0,
        "gravity": 0.0, "wind": 0.0, "mix": 0.45, "fps": 60, "volume": False,
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
    "bust":       (512,  748, 158, 96),    # just the bust: softest part, gets its own spring
    "spine":      (512, 1020, 205, 150),
    "hips":       (512, 1200, 255, 175),
    "arm_left":   (330,  900, 125, 215),
    "arm_right":  (700,  900, 125, 215),
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
    soft = Image.fromarray((mask * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(22))
    if face_box:
        # The blur bleeds back over the face. A face that sways with the hair tears at the hairline
        # and drags the eye and mouth patches off their plates, so the face band wins.
        fx0, fy0, fx1, fy1 = face_box
        buf = np.asarray(soft).copy()
        keep = ~((xx >= fx0 - 6) & (xx <= fx1 + 6) & (yy >= fy0 - 10) & (yy <= fy1 + 24))
        buf[~keep] = 0
        soft = Image.fromarray(buf, "L")
    return soft


HAIR_FIELD: Image.Image | None = None
_HAIR_PIX: np.ndarray | None = None


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

# Grid resolution of the body mesh. Finer = smoother bend, more vertices to skin.
COLS, ROWS = 34, 50


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
    """Two-bone skin weight by height, gated by each bone's influence ellipse.

    The body leans and breathes, so a vertex belongs to the bones whose height it sits at,
    with a soft falloff between them. The ellipse gate is what keeps the chair, the desk and
    the room still: a vertex outside every ellipse keeps only `root`, and `root` never moves.
    """
    # One scoring rule instead of "height band, then ellipse": a bone competes for a vertex on
    # how close it is in height AND whether the vertex is inside its influence ellipse. Two
    # separate rules used to leave holes where the band named a bone that the ellipse rejected,
    # and those holes dropped to root — the chest stopped deforming in patches.
    scored = []
    for name in world:
        if name == "root":
            continue
        _, by = world[name]
        gate = influence(name, x, y)
        if gate <= 0.0:
            continue
        scored.append((math.exp(-(((y - by) / WEIGHT_SIGMA) ** 2)) * gate, name))
    scored.sort(reverse=True)
    top = scored[:2]
    total = sum(w for w, _ in top) or 1.0

    out = []
    moved = 0.0
    for w, name in top:
        gated = w / total
        if gated < 1e-4:
            continue
        bx, by = world[name]
        moved += gated
        out.append(
            {
                "bone": f"bone_{name}",  # weights reference bone IDs, not names
                "x": round(x - bx, 3),
                "y": round(y - by, 3),
                "weight": gated,
            }
        )

    # Hair is content-driven, not geometry-driven: whatever the plate says is hair goes to the
    # hair bone, blended softly with the weights above so the silhouette stays continuous.
    hf = hair_factor(x, y)
    if hf > 0.004:
        carried = [{"bone": w["bone"], "x": w["x"], "y": w["y"], "weight": w["weight"] * (1.0 - hf)} for w in out]
        hb = world["hair_back"]
        hair = {"bone": "bone_hair_back", "x": round(x - hb[0], 3), "y": round(y - hb[1], 3), "weight": hf}
        merged: dict[str, dict] = {}
        for entry in carried + [hair]:
            if entry["bone"] in merged:
                merged[entry["bone"]]["weight"] += entry["weight"]
            else:
                merged[entry["bone"]] = entry
        out = list(merged.values())
        moved = sum(w["weight"] for w in out)

    # Whatever the ellipses did not claim is pinned to root: the chair breathes no more.
    if moved < 0.9999:
        rx, ry = world["root"]
        out.append(
            {"bone": "bone_root", "x": round(x - rx, 3), "y": round(y - ry, 3), "weight": 1.0 - moved}
        )
        moved = 1.0

    # Round the weights but keep the sum at exactly 1.0, or the skinned point drifts.
    acc = 0.0
    for i, w in enumerate(out):
        if i == len(out) - 1:
            w["weight"] = round(1.0 - acc, 4)
        else:
            w["weight"] = round(w["weight"], 4)
            acc += w["weight"]
    return out


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

    breath = {
        "id": "anim_breath",
        "name": "breath",
        "duration": 4.0,
        "timelines": [
            tl("bone_chest", "scaleY", ((0, 0), (1.6, 0.028), (3.2, 0), (4.0, 0))),
            tl("bone_chest", "scaleX", ((0, 0), (1.6, 0.016), (3.2, 0), (4.0, 0))),
            tl("bone_neck", "y", ((0, 0), (1.6, -1.8), (3.2, 0), (4.0, 0))),
            tl("bone_head", "y", ((0, 0), (1.6, -1.2), (3.2, 0), (4.0, 0))),
            tl("bone_spine", "scaleX", ((0, 0), (1.6, 0.006), (3.2, 0), (4.0, 0))),
        ],
        "events": [],
    }

    sway = {
        "id": "anim_sway",
        "name": "sway",
        "duration": 7.0,
        "timelines": [
            tl("bone_hips", "rotation", ((0, 0), (1.75, 0.8), (3.5, 0), (5.25, -0.8), (7.0, 0))),
            tl("bone_chest", "rotation", ((0, 0), (1.75, -0.5), (3.5, 0), (5.25, 0.5), (7.0, 0))),
            tl("bone_head", "rotation", ((0, 0), (1.75, 0.7), (3.5, 0), (5.25, -0.7), (7.0, 0))),
            tl("bone_hair_back", "rotation", ((0, 0), (1.75, 1.2), (3.5, 0), (5.25, -1.2), (7.0, 0))),
        ],
        "events": [],
    }

    turn = {
        "id": "anim_turn",
        "name": "turn",
        "duration": 2.4,
        "timelines": [
            tl("bone_head", "rotation", ((0, 0), (0.8, 3.5), (1.6, 0), (2.4, -2.0))),
            tl("bone_chest", "rotation", ((0, 0), (0.8, 1.2), (1.6, 0), (2.4, -0.8))),
        ],
        "events": [],
    }

    # Shake: a quick head swing and settle. Gentle authored animations (breath, sway) barely
    # excite the springs, and that is correct — but the game needs one move that reads as
    # "she reacted", and this is also the honest test that the hair physics is alive.
    shake = {
        "id": "anim_shake",
        "name": "shake",
        "duration": 1.1,
        "timelines": [
            tl("bone_head", "rotation", ((0, 0), (0.18, -6.0), (0.42, 4.5), (0.66, -2.5), (0.9, 1.0), (1.1, 0))),
            tl("bone_neck", "rotation", ((0, 0), (0.18, -2.2), (0.42, 1.6), (0.66, -0.9), (0.9, 0.4), (1.1, 0))),
            tl("bone_chest", "rotation", ((0, 0), (0.22, 1.2), (0.5, -0.8), (0.8, 0.3), (1.1, 0))),
            # A small vertical dip: a reaction has weight, and without it the bust spring has
            # nothing to overshoot.
            tl("bone_chest", "y", ((0, 0), (0.18, 5.0), (0.44, -2.5), (0.7, 1.2), (1.1, 0))),
        ],
        "events": [],
    }

    # Region origin is its centre in bone-local space, so the offset is (plate centre - head bone).
    head_x, head_y = world["head"]

    def patch(image_id: str, spec: dict) -> dict:
        return {
            "type": "region",
            "image": image_id,
            "x": round(spec["cx"] - head_x, 3),
            "y": round(spec["cy"] - head_y, 3),
            "rotation": 0,
            "scaleX": 1,
            "scaleY": 1,
            "width": spec["w"],
            "height": spec["h"],
            "color": "#ffffff",
        }

    eyes_closed = patch(EYES_ID, PATCHES["eyes_closed"])
    has_mouth = "mouth_open" in PATCHES
    mouth_open = patch(MOUTH_OPEN_ID, PATCHES["mouth_open"]) if has_mouth else None
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
        mouth_attachments["mouth_closed"] = patch(MOUTH_CLOSED_ID, PATCHES["mouth_closed"])

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

    blink_beats = [
        (1.00, None), (1.05, "eyes_closed"), (1.14, None),
        (2.90, None), (2.95, "eyes_closed"), (3.04, None),
    ]
    talk_beats = [
        (0.00, None), (0.09, "mouth_open"), (0.18, None), (0.27, "mouth_open"),
        (0.33, None), (0.42, "mouth_open"), (0.52, "mouth_open"),
        (0.61, None), (0.70, "mouth_open"), (0.80, None),
    ]

    def idle_anim(anim_id: str, name: str, with_talk: bool) -> dict:
        timelines = [dict(t) for t in breath["timelines"]]
        timelines.append(slot_timeline("slot_eyes", blink_beats))
        if with_talk and has_mouth:
            # Speech runs in two passes over the same 4 s breath loop: she talks, pauses, talks.
            timelines.append(slot_timeline("slot_mouth", talk_beats, 0.0))
            timelines.append(slot_timeline("slot_mouth", talk_beats, 2.00))
        return {"id": anim_id, "name": name, "duration": 4.0, "timelines": timelines, "events": []}

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
        ] if has_mouth else []) + closed_image,
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
        "animations": [idle, breath, sway, turn, shake, blink]
        + ([idle_talk, talk] if has_mouth else [])
        + ([smile] if has_closed_mouth else []),
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
    global MOUTH_OPEN_ID, MOUTH_CLOSED_ID, _HAIR_PIX

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

    mid, span = place_for(ART_KEY)
    BONES, INFLUENCE, WEIGHT_SIGMA = derive_skeleton(mid, span, W, H)

    entry = json.loads(MANIFEST.read_text())[f"heroine_{ART_KEY}"]
    field = hair_field(PLATE, entry.get("face"), mid, span)
    _HAIR_PIX = np.asarray(field) if field is not None else None

    PATCHES = face_patches(ART_KEY)
    doc = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    mesh = doc["skeleton"]["skins"][0]["attachments"]["slot_body"]["miya_body"]
    print(
        f"{OUT}: {len(doc['skeleton']['bones'])} bones, "
        f"{len(mesh['vertices']) // 2} vertices, {len(mesh['triangles']) // 3} triangles, "
        f"{len(doc['animations'])} animations"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
