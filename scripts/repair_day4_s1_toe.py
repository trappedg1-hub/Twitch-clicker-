#!/usr/bin/env python3
"""Finish the sliced-off foot of Day 4 / pose 2 («Бёдра») — in place, no re-render, no re-frame.

What the shipped plate actually contains (all numbers are px in the 1024x1526 plate):

    rows 1120..1252  the sock's red cuff band, intact, running diagonally across the ankle
    rows 1252..1381  the sock tube below it: ivory ~25..56 px wide, descending down-right at ~15 deg
                     ...and for EVERY one of those rows its right side stops at x = 1015, alpha 255,
                     with no outline: the generator framed the foot off the canvas, so the tube is sawn
                     open along the border and the foot itself is missing.

Why a transplant instead of a drawn foot: eight attempts at computed geometry (wedge, ellipse cap,
per-row bulge, smoothstep swell, traced heel/sole chains) all read as a white leaf, because a foot is
anatomy and this style carries its weight in the ink. So the foot comes from her own finished art —
`heroine_t4_s2` (Day 4 pose 3, «Шпагат») contains exactly the part that is missing: the same ribbed
sock, same red cuff, same light, same line weight, drawn at the same plate scale in the same frame
pass. It is only ever READ; `public/art/heroine_t4_s2.*` is never written.

Three moves, all measured:

  1. the plate slides 10 px left — a pure translation that clips nothing (her chair armrest is exactly
     10 px from the left border) and hands 18 px of breathing room to the foot;
  2. the sawn tube is closed: her own surviving left edge (which still carries the outline) defines a
     taper for the right edge, the flat border strip is dropped, and a two-pixel ink of her own outline
     colour is laid along the new edge — a silhouette edge, no invented anatomy;
  3. the donor foot is cut from s2 by colour (ivory sock + its own ink, largest component, holes
     filled), rotated onto the tube's axis, tucked under the tube so the seam falls inside flat sock
     colour, and composited with a half-pixel feather so no hard paste edge sits in an anti-aliased
     drawing.

Nothing above the cuff is touched, so the head stays on row 88 and the cross-day "same actress, same
camera" cut survives. `centre_horizontally` in the pipeline still re-centres afterwards.

    python3 scripts/repair_day4_s1_toe.py            # renders into .qa-out/
    python3 scripts/repair_day4_s1_toe.py --apply     # rewrite public/art/heroine_t4_s1.{png,webp}
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLATE_PNG = ROOT / "public/art/heroine_t4_s1.png"
PLATE_WEBP = ROOT / "public/art/heroine_t4_s1.webp"
DONOR_PLATE = ROOT / "public/art/heroine_t4_s2.png"  # read-only
QA = ROOT / ".qa-out"
TAG = ""  # set from --tag, so a sweep can keep every variant

# --- receiving side, measured on the shipped plate ------------------------------------------------
SHIFT_LEFT = 10  # the slide that buys the foot its room (armrest is 10 px from the left border)
CUFF_TOP_ROW = 1108  # first row the red cuff band reaches
CUFF_RIM_ROW = 1256  # last row of the red cuff: everything below is fair game
TUBE_END_ROW = 1382  # last row the sawn tube occupies
TUBE_FROM_COL = 930  # its own leftmost reach, measured on the shifted plate

# --- donor side, measured on heroine_t4_s2 ---------------------------------------------------------
DONOR = (352, 1334, 466, 1514)  # x0,y0,x1,y1: s2's sock below its cuff + the whole foot, sole included
DONOR_ANKLE = (409, 1338)  # the middle of that sock's top rim
TARGET_ANKLE = (974, 1252)  # the middle of her cuff's lower rim, on the shifted plate
ROT_DEG = -12.0  # negative = clockwise on screen: tilts the foot onto the leg's own descent
SCALE = 0.98
MIRROR = False
SHADOW = 0.16  # darkening right under the cuff rim, from her own tube's gradient
FEATHER = 0.5  # px of blur on the composite alpha

# the knit is a warm neutral; skin is rosier, the chair is dark and cool — this separates the sock
SOCK_TONE = ((140, 255), (120, 255), (100, 255))


def _disc(r: int) -> np.ndarray:
    y, x = np.mgrid[-r : r + 1, -r : r + 1]
    return ((x * x + y * y) <= r * r + 0.5).astype(np.uint8)


def sock_tone(rgb: np.ndarray) -> np.ndarray:
    (r0, r1), (g0, g1), (b0, b1) = SOCK_TONE
    r = rgb[:, :, 0].astype(int)
    g = rgb[:, :, 1].astype(int)
    b = rgb[:, :, 2].astype(int)
    return (
        (r >= r0) & (r <= r1) & (g >= g0) & (g <= g1) & (b >= b0) & (b <= b1)
        & ((r - g) <= 42) & ((g - b) >= 5) & ((g - b) <= 42)
    )


def solid_of(arr: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    """The sock's silhouette inside `box`, isolated from whatever it rests on, holes filled."""
    x0, y0, x1, y1 = box
    crop = arr[y0:y1, x0:x1]
    open_ = crop[:, :, 3] > 40
    ivory = sock_tone(crop[:, :, :3].astype(np.float32)) & open_
    ink = (crop[:, :, :3].mean(axis=2) < 140) & open_
    room = cv2.dilate(ivory.astype(np.uint8), _disc(3)).astype(bool)  # only ink that hugs the knit
    keep = ivory | (ink & room)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(keep.astype(np.uint8), connectivity=8)
    if n > 1:
        keep = lab == (1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA])))
    keep = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)).astype(bool)
    outside = (~keep).astype(np.uint8)
    cv2.floodFill(outside, np.zeros((outside.shape[0] + 2, outside.shape[1] + 2), np.uint8), (0, 0), 2)
    solid = np.zeros(arr.shape[:2], np.uint8)
    solid[y0:y1, x0:x1] = np.clip(cv2.GaussianBlur((outside != 2).astype(np.uint8), (0, 0), 0.8), 0, 1) * 255
    return solid


def shift_plate(arr: np.ndarray, dx: int) -> np.ndarray:
    """Whole-image horizontal slide. Zeroed, never wrapped."""
    if dx == 0:
        return arr.copy()
    out = np.roll(arr, -dx, axis=1)
    if dx > 0:
        out[:, arr.shape[1] - dx :] = 0
    else:
        out[:, : -dx] = 0
    return out


def cuff_band(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Her red cuff ring, as worn on this leg — the only thing that may survive below the rim row."""
    r, g, b = rgb[:, :, 0].astype(int), rgb[:, :, 1].astype(int), rgb[:, :, 2].astype(int)
    return (alpha > 40) & (r > 110) & ((r - g) > 40) & ((r - b) > 35)


def trim_cuff_tip(arr: np.ndarray) -> np.ndarray:
    """Close the cuff ring: the pale tab of sock inside it is sawn off at the same border.

    For every row of the band, everything right of the red ink's own last pixel is deleted, so the ring
    ends on its own outline instead of on the frame; the sock then emerges from under it.
    """
    out = arr.astype(np.float32).copy()
    red = cuff_band(out[:, :, :3], out[:, :, 3])
    rows = np.arange(out.shape[0])
    band = (rows >= CUFF_TOP_ROW) & (rows < CUFF_RIM_ROW) & red.any(axis=1)
    for row in np.nonzero(band)[0]:
        xs = np.nonzero(red[row])[0]
        if xs.size:
            out[row, int(xs.max()) + 2 :] = 0
    return out.astype(np.uint8)


def drop_tube(arr: np.ndarray) -> np.ndarray:
    """Delete the sawn sock tube: rows below the cuff rim, out to the border, nothing else.

    That band is the whole defect — ivory with a flat right side where the frame ended, no outline, no
    anatomy — and it stands alone in empty canvas from row ~1300 down (measured: the chair's nearest
    pixel at those rows is x 880), so removing it costs nothing the eye can miss. The donor's own sock
    then runs up under the cuff, and the only seam left is a horizontal one hidden behind the cuff's
    lower rim, which is an inked edge in her drawing to begin with.
    """
    out = arr.astype(np.float32).copy()
    rows = np.arange(out.shape[0])[:, None]
    cols = np.arange(out.shape[1])[None, :]
    gone = (rows >= CUFF_RIM_ROW) & (rows <= TUBE_END_ROW) & (cols >= TUBE_FROM_COL)
    gone &= cv2.dilate(((out[:, :, 3] > 30) & (rows >= CUFF_RIM_ROW) & (rows <= TUBE_END_ROW)).astype(np.uint8), _disc(2)).astype(bool)
    out[gone] = 0
    return out.astype(np.uint8)


def place(arr: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Cut, scale, rotate the donor and pin its ankle onto the tube's cut end."""
    x0, y0, x1, y1 = DONOR
    H, W = arr.shape[:2]
    src = arr[y0:y1, x0:x1].astype(np.float32)
    m = (mask[y0:y1, x0:x1] > 0.5).astype(np.float32)
    rgba = np.dstack([np.clip(src[:, :, :3], 0, 255), m * 255.0]).astype(np.uint8)
    d = np.asarray(
        Image.fromarray(rgba, "RGBA").resize(
            (max(int(rgba.shape[1] * SCALE), 8), max(int(rgba.shape[0] * SCALE), 8)), Image.Resampling.LANCZOS
        )
    ).astype(np.float32)
    if MIRROR:
        d = d[:, ::-1].copy()
    h, w = d.shape[:2]
    jx, jy = DONOR_ANKLE[0] - x0, DONOR_ANKLE[1] - y0
    jx = (w - 1 - jx) if MIRROR else jx
    jx, jy = jx * SCALE, jy * SCALE
    a = d[:, :, 3:4] / 255.0
    M = cv2.getRotationMatrix2D((jx, jy), -ROT_DEG, 1.0)
    prem = cv2.warpAffine(d[:, :, :3] * a, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    aw = cv2.warpAffine(a[:, :, 0], M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    px = float(M[0, 0] * jx + M[0, 1] * jy + M[0, 2])
    py = float(M[1, 0] * jx + M[1, 1] * jy + M[1, 2])
    M2 = np.float32([[1, 0, TARGET_ANKLE[0] - px], [0, 1, TARGET_ANKLE[1] - py]])
    prem = cv2.warpAffine(prem, M2, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    aw = cv2.warpAffine(aw, M2, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)
    nz = np.where(aw > 1e-3, aw, 1.0)
    layer = np.dstack([np.clip(prem / nz[..., None], 0, 255).astype(np.float32), aw * 255.0])
    return layer, aw


def sock_gain(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """Scale the donor's colours onto the receiving plate's knit, channel by channel.

    Both plates went through the same grade, but not the same local exposure: s2's knit is a touch
    brighter and cooler than the knit in s1's shadowed corner. The gain is the ratio of the two ivory
    medians, so the paste can't read as a pasted patch of a slightly different sock.
    """
    def med(a):
        tone = sock_tone(a[:, :, :3].astype(np.float32)) & (a[:, :, 3] > 200)
        px = a[:, :, :3][tone]
        return np.median(px.astype(np.float32), axis=0) if len(px) > 200 else np.array([222.0, 204.0, 193.0])

    a, b = med(dst), med(src)
    return np.clip(a / np.maximum(b, 1.0), 0.6, 1.6)


def sock_shade(shape, top: int, height: int) -> np.ndarray:
    """A soft contact shadow under the cuff rim, at the strength measured on her own surviving tube."""
    ramp = np.clip((np.arange(shape[0])[:, None] - top) / float(height), 0.0, 1.0)
    ramp = 1.0 - ramp
    return (1.0 - SHADOW * (ramp * ramp) ** 1.2)[..., None]


def repair_foot(base: np.ndarray) -> np.ndarray:
    donor_plate = np.array(Image.open(DONOR_PLATE).convert("RGBA"))
    solid = solid_of(donor_plate, DONOR)
    plate = shift_plate(base, SHIFT_LEFT)
    raw = plate.copy()
    plate = trim_cuff_tip(drop_tube(plate))
    # the donor's pixels come from s2 unchanged; only its mask is thresholded
    layer, aw = place(donor_plate, solid > 127)
    shade = sock_shade(layer.shape, TARGET_ANKLE[1], 46)
    layer = np.dstack([layer[:, :, :3] * sock_gain(donor_plate, raw)[None, None, :] * shade, layer[:, :, 3:]])
    rgb, alpha = plate[:, :, :3].astype(np.float32), plate[:, :, 3].astype(np.float32)

    # the tube above the pin stays hers; the donor only owns what it actually covers
    over = np.clip(aw, 0.0, 1.0)[..., None]
    rgb = rgb * (1 - over) + layer[:, :, :3] * over
    alpha = np.maximum(alpha, aw * 255.0)
    soft = cv2.GaussianBlur(alpha, (0, 0), FEATHER)
    alpha = np.where(np.abs(soft - alpha) > 10, soft, alpha)
    return np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.clip(alpha, 0, 255).astype(np.uint8)])


def _flatten(a: np.ndarray) -> np.ndarray:
    al = a[:, :, 3:4].astype(np.float32) / 255.0
    bg = np.full(a.shape[:2] + (3,), (120, 92, 106), np.float32)
    return np.clip(a[:, :, :3].astype(np.float32) * al + bg * (1 - al), 0, 255).astype(np.uint8)


def _report(a: np.ndarray) -> None:
    al = a[:, :, 3] > 40
    rows = np.nonzero(al[:, 900:].any(axis=1))[0]
    rows = rows[(rows >= 1240) & (rows < 1520)]
    if not rows.size:
        print("nothing at the leg's end — the paste failed")
        return
    right = max(int(np.nonzero(al[r, 900:])[0].max()) + 900 for r in rows)
    print(f"leg+foot rows {int(rows.min())}..{int(rows.max())}; rightmost column {right} of {a.shape[1] - 1}")
    for r in range(int(rows.min()), int(rows.max()) + 1, 12):
        xs = np.nonzero(al[r, 900:])[0] + 900
        print(f"  row {r}: x {int(xs.min())}..{int(xs.max())} ({len(xs)})" if len(xs) else f"  row {r}: none")
    wall = sum(1 for r in range(CUFF_RIM_ROW, TUBE_END_ROW) if al[r, a.shape[1] - 1])
    print(f"  rows still touching the canvas edge: {wall}")


def _overrides(argv: list[str]) -> None:
    """Knobs from the command line, so a variant is one flag away instead of one edit away."""
    global ROT_DEG, SCALE, MIRROR, TARGET_ANKLE, SHIFT_LEFT
    for flag, cast in (("--rot", float), ("--scale", float), ("--pinx", int), ("--piny", int), ("--shift", int)):
        if flag in argv:
            v = cast(argv[argv.index(flag) + 1])
            if flag == "--rot":
                ROT_DEG = v
            elif flag == "--scale":
                SCALE = v
            elif flag == "--pinx":
                TARGET_ANKLE = (v, TARGET_ANKLE[1])
            elif flag == "--piny":
                TARGET_ANKLE = (TARGET_ANKLE[0], v)
            else:
                SHIFT_LEFT = v
    MIRROR = "--mirror" in argv


def main(mode: str) -> None:
    _overrides(sys.argv)
    global TAG
    TAG = sys.argv[sys.argv.index("--tag") + 1] if "--tag" in sys.argv else ""
    src = PLATE_WEBP if not PLATE_PNG.exists() else PLATE_PNG
    base = np.array(Image.open(src).convert("RGBA"))
    fixed = repair_foot(base)
    QA.mkdir(exist_ok=True)
    for name, a in (("before", base), ("after", fixed)):
        im = Image.fromarray(_flatten(a))
        im.save(QA / f"toe_{name}{TAG}.png")
        im.crop((700, 950, 1024, 1526)).resize((324 * 2, 576 * 2), Image.Resampling.LANCZOS).save(
            QA / f"toe_{name}{TAG}_zoom.png"
        )
    Image.fromarray(_flatten(fixed)[900:1024, 900:1024]).resize((372, 372), Image.Resampling.LANCZOS).save(
        QA / "toe_after_close.png"
    )
    _report(fixed)
    if mode == "--apply":
        Image.fromarray(fixed, "RGBA").save(PLATE_PNG)
        Image.fromarray(fixed, "RGBA").save(PLATE_WEBP, "WEBP", quality=96, method=6)
        print(f"wrote {PLATE_PNG.name} + {PLATE_WEBP.name} ({PLATE_WEBP.stat().st_size / 1024:.0f} kB)")
    else:
        print(f"wrote {QA}/toe_before.png, toe_after.png (+ _zoom, _close)")


if __name__ == "__main__":
    main("--apply" if "--apply" in sys.argv else "--preview")
