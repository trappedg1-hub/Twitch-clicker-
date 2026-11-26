#!/usr/bin/env python3
"""Day 3 "ghost streamer" — four independent art frames, no ladder slicing.

The day used to be ONE render whose bed-sheet layer was cut four different ways. That made every
stage look like the previous one with a patch removed, and it made the background cut fight us. The
shipped look now is four separate finished frames of the same composition rules, so this script
does something much simpler per frame:

    raw render (848x1264, flat plum background)
      -> flood-fill the flat background from the border (plus enclosed flat pockets) into an alpha
      -> decontaminate the plum fringe off the semi-transparent edge
      -> gentle darkening grade so the frame sits in the same brightness window as days 1 and 2
      -> LANCZOS to the plate size 1024x1526 (the raws are already the plate aspect, so nothing is
         cropped and the feet stay exactly where the artist put them)
      -> PNG master + WEBP plate + a contact sheet with a coordinate grid for authoring face anchors

Background colour is measured per frame from the corners rather than hard-coded, because the model
drifts a few RGB points between generations; the tolerance for "is background" is relative to that.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "art-studio/raw"
PLATES = ROOT / "public/art"
QA = ROOT / ".qa-out"

PLATE_W, PLATE_H = 1024, 1526
# First plate row the foreground plank covers. Measured, not guessed: public/art/fg_desk_t1.webp is
# 1376x768 and its top edge only spans the full width from desk row 708, StreamStage draws that layer
# at (VIRTUAL_W+28, VIRTUAL_H+12) offset (-14, -2), and the plate box is y=11 h=722 of a 753-high
# canvas — so desk row 708 lands at canvas y 717, i.e. plate row 1489. (Row 585, where the layer
# first becomes non-opaque, is the laptop/mic silhouette, NOT the plank; using it as the line is what
# let five "passing" plates float a finger's width above the desk.)
DESK_TOP_ROW = 1489
# How far above the plank line her body may stop and still read as resting on the desk (see the
# calibration note in main()); Day 1 and Day 2 live at 38 and -2 rows respectively.
DESK_CONTACT_SLACK = 40

# game stage -> raw render, one approved frame per rung of the ladder (the artist signed each pair).
FRAMES: dict[str, str] = {
    # stage 0 (0 сабов) — the ghost: the sheet clings over her whole body, only the legs are out
    "heroine_t3_s0": "t3_s1_ghost.png",
    # stage 1 (7000) — she pulled the front of the sheet off her torso, the bodysuit reads in full
    "heroine_t3_s1": "t3_s2_hem_C.png",
    # stage 2 (10000) — both legs up on the desk, crossed at the ankles, finger at the lips
    "heroine_t3_s2": "t3_s3_shh_G.png",
    # stage 3 (13000) — the «Бу!» jump: the sheet is torn into the air, nothing left to hide behind
    "heroine_t3_s3": "t3_v2_a0_boo.png",
    # stage 4 (15000) — finale: deep squat on the seat, knees wide, the sheet hanging off her head
    "heroine_t3_s4": "t3_s4_spread_O.png",
    # the «Бу!» flash gimmick reuses the sheet-off frame — it is the same gag, one pose
    "heroine_t3_flash": "t3_v2_a0_boo.png",
}


# The plank is a FOREGROUND layer: its top edge is a dead-straight horizontal line, so whatever the
# plate leaves inside that band gets cut along it. Two failure modes were shipped by hand-tuned
# numbers, and the second is the one the user just caught:
#   - sole ends 10s of rows ABOVE the edge  -> "а где ступни на столе?", she floats;
#   - sole ends 10s of rows BELOW the edge  -> the plank saws the foot across the toes: "криво
#     обрезана, не прячется под стол".
# So the frames where the feet belong ON the desk are fitted, not guessed: SOLE_ON_PLANK says which
# row the lowest skin pixel (the sole resting on the desk) must land on, and the stretch factor below
# is solved from the frame's own measurement. (hinge, factor) is only the START of that search; the
# factor is recomputed per run, so re-rendering the art cannot silently re-introduce either failure.
SOLE_ON_PLANK: dict[str, int] = {
    # s2, crossed ankles over the plank. Four rows INTO the band the plank hides: her sole presses onto the wood instead of stopping
    # a hair above it, and nothing above the edge is cut. Aimed at the plank line itself fails by a
    # few rows in practice because the webp encode attenuates the 15-pixel-wide toe rows, which is
    # what `day3_plate_qc.py` measures.
    "heroine_t3_s2": DESK_TOP_ROW + 4,
}
LEG_STRETCH: dict[str, tuple[int, float]] = {
    # s2 is NOT here: its legs are solved against the plank by SOLE_ON_PLANK, and a hand-set factor is
    # what cut her toes in half in the first place.
    # the "Бу!" jump and the crossfade flash share one raw — treat them identically or the cut
    # between them steps her legs by a few pixels. Her feet are tucked up behind the desk here,
    # which is the pose, so no sole fit: anything under the plank edge just reads as hidden.
    "heroine_t3_s3": (780, 0.05),
    "heroine_t3_flash": (780, 0.05),
}
# Whatever the stretch cannot reach without distorting comes from a plain slide; only the chair base
# falls off the bottom, and the plank hides it. (No slides in the approved set: the two plank frames
# reach on their own, and forcing one would move the seat poses' feet off the seat.)
LEG_SHIFT: dict[str, int] = {}
# Frames whose feet are NOT meant to touch the desk. The ladder now alternates: s0 has one foot on the
# seat and one stretched down, s1 kneels sideways on the seat, s4 squats on it — in all three the
# CHAIR carries the pose, so the plate legitimately ends above the plank line and stretching them
# would only lengthen legs for no reason. Only s2 (legs up on the desk) and the «Бу!» frame are held
# to the contact rule.
DESK_CONTACT_EXEMPT = {"heroine_t3_s0", "heroine_t3_s1", "heroine_t3_s4"}


def elongate_below(arr: np.ndarray, hinge: int, extra: float) -> np.ndarray:
    """Scale the rows below `hinge` by `1 + extra` about that hinge; above it, untouched.

    A constant factor keeps the mesh uniformly stretched instead of progressively sheared, and since
    only row *positions* move (nothing jumps) there is no seam for the keyer to trip over later.
    cv2.remap interpolates sub-pixel, so there is no duplicate-row banding either.
    """
    if extra <= 0:
        return arr
    h, w = arr.shape[:2]
    src = np.arange(h, dtype=np.float64)
    dst = np.where(src < hinge, src, hinge + (src - hinge) * (1.0 + extra))
    # Only ever an elongation: a negative factor maps the last source row onto every row under it,
    # which smears her foot down the desk. Pulling a sole back up is `scale_about_row`'s job.
    if dst[-1] <= h - 1:
        return arr
    # Inverse map: destination row y samples source row s where dst(s) == y. dst is monotone, so a
    # plain interp inverts it, and every y in the canvas stays inside [0, h-1] — nothing to pad.
    rows = np.interp(src, dst, src).astype(np.float32)
    map_x, map_y = np.meshgrid(np.arange(w, dtype=np.float32), rows)
    # Remap PREMULTIPLIED colour. A plain resample averages the stored RGB across the silhouette
    # edge, so whatever the (already keyed-away) background pixels happened to hold bleeds into the
    # fringe as a coloured halo — the exact "unkeyed smudge" the plates must never show. Weighting by
    # alpha first and dividing it back out keeps every edge pixel its own true colour.
    a = arr[:, :, 3:4].astype(np.float32) / 255.0
    rgb = arr[:, :, :3].astype(np.float32)
    prem = cv2.remap(rgb * a, map_x, map_y, cv2.INTER_LANCZOS4)
    alpha = cv2.remap(a[:, :, 0], map_x, map_y, cv2.INTER_LANCZOS4)
    # Sigmoid-ish hardening of the alpha ramp: kills the sub-pixel fringe the resize leaves behind and
    # pulls the soft-edge fraction back to the ~0.005 the Day-1/Day-2 plates have.
    alpha = np.clip((alpha * 255.0 - 70.0) * (255.0 / 150.0), 0.0, 255.0)
    a2 = alpha / 255.0  # back to 0..1 for the un-premultiply (prem is in 0..255)
    nz = np.where(a2 > 1e-3, a2, 1.0)
    out = np.empty_like(arr)
    out[:, :, 3] = alpha.astype(arr.dtype)
    out[:, :, :3] = np.clip(prem / nz[..., None], 0, 255).astype(arr.dtype)
    return out

# Every accepted Day-1/Day-2 plate tops her head in this row window, so a Day-3 frame whose generator
# framed tighter has to come back to the same scale or the stage cut reads as a zoom.
HEAD_BAND = (87, 122)
HEAD_TARGET = 88


def sole_bottom_row(arr: np.ndarray) -> int:
    """Lowest lit-skin row on the plate — the sole she rests on the desk.

    Deliberately a LOW pixel threshold (the same measure `day3_plate_qc.py` runs): the toe tips are a
    dozen pixels wide, and a fit aimed at the wide part of the foot happily leaves the toes poking
    under the plank, which is the slice this whole function exists to prevent.
    """
    al = arr[:, :, 3].astype(np.float32)
    rr, gg, bb = (arr[:, :, i].astype(np.float32) for i in range(3))
    skin = (al > 128) & (rr > 195) & (gg > 135) & (bb > 125) & ((rr - bb) > 22)
    rows = np.nonzero(skin.sum(axis=1) > 12)[0]
    return int(rows.max()) if rows.size else -1


def scale_about_row(arr: np.ndarray, pivot: int, k: float) -> np.ndarray:
    """Uniformly rescale the plate so row `pivot` stays put — a couple of percent, not a crop.

    Uniform on purpose. `elongate_below` with a NEGATIVE factor (the obvious tool: her foot needs to
    come back UP off the plank) maps the last source row onto every row under it, which smears her
    toes into vertical streaks across the desk. A uniform scale about her head keeps the head at the
    row the rest of the ladder shares, moves the sole where the plank wants it, and costs a pixel or
    two of side margin on a plate that has some.
    """
    h, w = arr.shape[:2]
    gx = np.arange(w, dtype=np.float32)
    gy = np.arange(h, dtype=np.float32)
    map_x, map_y = np.meshgrid((gx - w / 2) / k + w / 2, (gy - pivot) / k + pivot)
    a = arr[:, :, 3:4].astype(np.float32) / 255.0
    prem = cv2.remap(arr[:, :, :3].astype(np.float32) * a, map_x, map_y, cv2.INTER_LANCZOS4,
                     borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    alpha = cv2.remap(a[:, :, 0], map_x, map_y, cv2.INTER_LANCZOS4,
                      borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    alpha = np.clip((alpha * 255.0 - 70.0) * (255.0 / 150.0), 0.0, 255.0)
    # LANCZOS rings past the last row of content, and hardening turns that ring into opaque colour — a
    # bright fringe smeared BELOW her foot, which reads as toes bleeding into the desk and (measured)
    # as 25 phantom skin rows under the plank. Anything sampled from past the source's own bottom edge
    # is cut, so the silhouette ends where she actually ends.
    src_bottom = float(np.nonzero((arr[:, :, 3] > 8).sum(axis=1) > 2)[0].max())
    src_y = (gy - pivot) / k + pivot
    alpha[src_y > src_bottom + 0.5, :] = 0.0
    a2 = alpha / 255.0
    nz = np.where(a2 > 1e-3, a2, 1.0)
    out = np.empty_like(arr)
    out[:, :, 3] = alpha.astype(arr.dtype)
    out[:, :, :3] = np.clip(prem / nz[..., None], 0, 255).astype(arr.dtype)
    return out


def fit_sole_to_plank(arr: np.ndarray, stage: str) -> np.ndarray:
    """Set the frame's height so her sole lands on `SOLE_ON_PLANK[stage]` and her head stays at 88.

    The map is linear in `k`, so one measurement solves it; the second pass just absorbs the rounding
    of the resample. `k` is clamped hard: past ~1 % the ladder starts reading as a zoom on that stage.
    """
    target = SOLE_ON_PLANK[stage]
    for _ in range(2):
        sole = sole_bottom_row(arr)
        head = int(np.nonzero((arr[:, :, 3] > 8).sum(axis=1) > 2)[0].min())
        if sole < 0:
            sys.exit(f"{stage}: no sole found to fit against the plank")
        if abs(sole - target) <= 1:
            break
        k = float(np.clip((target - head) / (sole - head), 0.99, 1.01))
        arr = scale_about_row(arr, head, k)
    print(f"  {stage}: sole row {sole_bottom_row(arr)} fitted onto the plank edge ({target})")
    return arr


def fit_head_band(arr: np.ndarray, stage: str) -> np.ndarray:
    """Shrink the whole plate about its bottom edge until her head sits in HEAD_BAND.

    A uniform scale of a couple of percent is the gentle way to absorb the generator\u0027s framing
    drift: nothing is sheared (a row stretch would do that to the legs) and the soles barely move,
    because they sit right where the scale is anchored — so the desk contact the last task fought for
    survives. A head BELOW the band cannot be fixed by shrinking, so that case stops the build: the
    raw has to be re-framed rather than scaled up into a clipped pair of feet.
    """
    h, w = arr.shape[:2]
    rows = np.nonzero((arr[:, :, 3] > 8).sum(axis=1) > 2)[0]
    if rows.size == 0:
        return arr
    head = int(rows.min())
    lo, hi = HEAD_BAND
    if head >= lo:
        if head > hi:
            raise SystemExit(
                f"{stage}: her head starts at row {head}, below the {lo}-{hi} band the accepted plates "
                "share — re-frame the raw (scaling up would clip her feet off the plate)."
            )
        return arr
    scale = (h - 1 - HEAD_TARGET) / (h - 1 - head)
    gx = np.arange(w, dtype=np.float32)
    gy = np.arange(h, dtype=np.float32)
    map_x, map_y = np.meshgrid((gx - w / 2) / scale + w / 2, (gy - (h - 1)) / scale + (h - 1))
    a = arr[:, :, 3:4].astype(np.float32) / 255.0
    prem = cv2.remap(
        arr[:, :, :3].astype(np.float32) * a, map_x, map_y, cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT, borderValue=0,
    )
    alpha = cv2.remap(
        a[:, :, 0], map_x, map_y, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=0
    )
    alpha = np.clip((alpha * 255.0 - 70.0) * (255.0 / 150.0), 0.0, 255.0)
    a2 = alpha / 255.0
    nz = np.where(a2 > 1e-3, a2, 1.0)
    out = np.empty_like(arr)
    out[:, :, 3] = alpha.astype(arr.dtype)
    out[:, :, :3] = np.clip(prem / nz[..., None], 0, 255).astype(arr.dtype)
    print(f"  {stage}: re-framed from head row {head} to {HEAD_TARGET} (scale {scale:.4f})")
    return out

# Days 1 and 2 sit at mean luminance 90-118; ungraded Day 3 frames come out washed at ~117.
TARGET_LUM = 101.0


def load(path: Path) -> np.ndarray:
    im = Image.open(path).convert("RGB")
    return np.array(im).astype(np.float32)


def bg_color(rgb: np.ndarray) -> np.ndarray:
    h, w, _ = rgb.shape
    s = max(8, min(h, w) // 24)
    corners = np.concatenate(
        [
            rgb[:s, :s].reshape(-1, 3),
            rgb[:s, -s:].reshape(-1, 3),
            rgb[-s:, :s].reshape(-1, 3),
            rgb[-s:, -s:].reshape(-1, 3),
        ]
    )
    return np.median(corners, axis=0)


def alpha_for(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Flood the flat background away, including the fake cast shadow the model paints on it.

    Only the exact background colour counts here. An earlier pass also accepted darkened copies of
    it to swallow the fake cast shadow, and the flood leaked along the anti-aliased rim straight
    into the black bodysuit and the chair, punching magenta holes in the costume. The shadow is a
    geometry problem, not a colour problem, so it goes in trim_shadow_debris instead.
    """
    h, w, _ = rgb.shape
    bg = bg_color(rgb)
    dist = np.linalg.norm(rgb - bg[None, None, :], axis=2)

    core = (dist < 26.0).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(core, connectivity=8)

    bgmask = np.zeros((h, w), dtype=np.uint8)
    border = np.zeros(n, dtype=bool)
    border[labels[0]] = True
    border[labels[-1]] = True
    border[labels[:, 0]] = True
    border[labels[:, -1]] = True
    for lbl in range(1, n):
        if border[lbl]:
            bgmask[labels == lbl] = 1
        else:
            # An enclosed pocket of the same flat colour (under the arm, between the knees) is
            # still background; an enclosed patch that is merely *close* to it is not.
            area = stats[lbl, cv2.CC_STAT_AREA]
            if 16 <= area <= 0.004 * h * w:
                patch = rgb[labels == lbl]
                if float(np.abs(patch.mean(axis=0) - bg).max()) < 9.0:
                    bgmask[labels == lbl] = 1

    alpha = 1.0 - bgmask.astype(np.float32)
    # Anti-alias: ramp the alpha of the one-pixel-wide fringe by how far it is from plain background.
    band = cv2.dilate(bgmask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
    ramp = np.clip((dist - 10.0) / 30.0, 0.0, 1.0)
    alpha = np.where(band & (bgmask == 0), ramp, alpha)
    alpha = np.where(bgmask == 1, 0.0, alpha)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0.6)
    return np.clip(alpha, 0.0, 1.0), bg


def decontaminate(rgb: np.ndarray, alpha: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Pull the plum cast out of edge pixels so the cut does not halo against the game backdrop."""
    out = rgb.copy()
    semi = (alpha > 0.02) & (alpha < 0.985)
    if semi.any():
        a = np.maximum(alpha[semi], 0.16)[:, None]
        out[semi] = (rgb[semi] - (1.0 - a) * bg[None, :]) / a
    return np.clip(out, 0, 255).astype(np.uint8)


def grade(rgb: np.ndarray) -> np.ndarray:
    src = rgb.astype(np.float32)
    lum = float((0.2126 * src[:, :, 0] + 0.7152 * src[:, :, 1] + 0.0722 * src[:, :, 2]).mean())
    k = float(np.clip(TARGET_LUM / max(lum, 1.0), 0.80, 1.0))
    out = (src / 255.0 - 0.5) * 1.04 + 0.5
    out = np.clip(out * k, 0.0, 1.0)
    after = float((0.2126 * out[:, :, 0] + 0.7152 * out[:, :, 1] + 0.0722 * out[:, :, 2]).mean() * 255.0)
    print(f"  grade: lum {lum:.1f} -> {after:.1f} (k={k:.3f})")
    return (out * 255.0).round().astype(np.uint8)


def drop_hairlines(alpha: np.ndarray) -> tuple[np.ndarray, int]:
    """Erase stray full-width rules the model draws as a fake floor or cast shadow.

    The generator likes to run a 2-6 px line straight across the frame behind the chair. It touches
    the silhouette, so a largest-component cleanup would keep it, but it has no vertical thickness
    anywhere along its length — real anatomy and the chair always do.
    """
    h, w = alpha.shape
    fg = alpha > 0.5
    out = alpha.copy()
    erased = 0
    y = 0
    while y < h:
        if fg[y].sum() <= 0.9 * w:
            y += 1
            continue
        y1 = y
        while y1 + 1 < h and fg[y1 + 1].sum() > 0.9 * w:
            y1 += 1
        band = y1 - y + 1
        if band <= 10:
            xs = np.nonzero(fg[y : y1 + 1].any(axis=0))[0]
            for x in xs:
                top = y
                while top - 1 >= 0 and fg[top - 1, x]:
                    top -= 1
                bot = y1
                while bot + 1 < h and fg[bot + 1, x]:
                    bot += 1
                if bot - top + 1 <= band + 8:
                    out[top : bot + 1, x] = 0.0
                    erased += bot - top + 1
        y = y1 + 1
    return out, erased


def trim_shadow_debris(alpha: np.ndarray, rgb: np.ndarray, bg: np.ndarray) -> tuple[np.ndarray, int]:
    """Drop everything that is not the figure, then shave the painted shadow clinging to her.

    The model's cast shadow is the background colour darkened a little, so it survives the colour
    flood as a flap glued to the silhouette. Two geometric facts separate it from anatomy: it is
    not part of the body's main blob, and it hugs the outer edge of the silhouette while staying
    close to the background colour. Her bodysuit highlights are deeper inside and much darker.
    """
    h, w = alpha.shape
    fg = (alpha > 0.5).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    if n <= 1:
        return alpha, 0
    largest = int(1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    kept = np.zeros((h, w), dtype=np.uint8)
    for lbl in range(1, n):
        area = int(stats[lbl, cv2.CC_STAT_AREA])
        # Float the small pieces away unless they are big enough to be a thrown sheet.
        if lbl == largest or area > 0.05 * h * w:
            kept[labels == lbl] = 1
    out = np.where(kept == 1, alpha, 0.0).astype(np.float32)
    dropped = int(((alpha > 0.5) & (kept == 0)).sum())

    # Shave the rim: pixels within 5 of the silhouette edge that are near the background colour.
    rim = (kept == 1) & (
        cv2.dilate(1 - kept, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (51, 51))) > 0
    )
    close_bg = np.linalg.norm(rgb - bg[None, None, :], axis=2) < 38.0
    shave = rim & close_bg
    out[shave] = 0.0
    dropped += int(shave.sum())

    # Second component pass: the shave can detach a smear that was bridged to the chair before.
    kept2 = (out > 0.5).astype(np.uint8)
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(kept2, connectivity=8)
    if n2 > 2:
        largest2 = int(1 + np.argmax(st2[1:, cv2.CC_STAT_AREA]))
        for lbl in range(1, n2):
            if lbl != largest2 and st2[lbl, cv2.CC_STAT_AREA] <= 0.05 * h * w:
                m = lab2 == lbl
                out[m] = 0.0
                dropped += int(m.sum())
    out = cv2.GaussianBlur(out, (3, 3), 0.5) * (kept2 == 1)
    return np.clip(out, 0.0, 1.0), dropped



def sharpen(arr: np.ndarray) -> np.ndarray:
    """Unsharp mask on the plate, on colour only (the alpha edge is already hardened by the keyer).

    Every 848x1264 raw arrives softer than the plate it has to fill, and LANCZOS trades a little more
    detail for the absence of ringing. One restrained local contrast pass (55 % of a 1.1px blur, and
    only on opaque pixels so nothing haloed gets baked into the transparent rim) is what makes the
    lineart read as drawn rather than as resampled. Amount kept low on purpose: this is lineart and
    a fishnet mesh, and over-crisping them shows up as white edges around every diamond.
    """
    rgb = arr[:, :, :3].astype(np.float32)
    blur = cv2.GaussianBlur(rgb, (0, 0), 1.1)
    keep = arr[:, :, 3] > 160
    sharp = np.clip(rgb + 0.55 * (rgb - blur), 0, 255)
    out = arr.copy()
    out[:, :, :3] = np.where(keep[:, :, None], sharp, rgb).astype(arr.dtype)
    return out


def to_plate(rgba: Image.Image) -> Image.Image:
    if rgba.size != (PLATE_W, PLATE_H):
        rgba = rgba.resize((PLATE_W, PLATE_H), Image.Resampling.LANCZOS)
    return rgba


def grid(im: Image.Image, step: int = 100) -> Image.Image:
    out = im.convert("RGB").copy()
    d = ImageDraw.Draw(out)
    w, h = out.size
    for x in range(0, w, step):
        d.line([(x, 0), (x, h)], fill=(255, 90, 90), width=1)
        d.text((x + 2, 2), str(x), fill=(255, 90, 90))
    for y in range(0, h, step):
        d.line([(0, y), (w, y)], fill=(90, 200, 255), width=1)
        d.text((2, y + 1), str(y), fill=(90, 200, 255))
    return out


def main() -> None:
    PLATES.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    tiles: list[Image.Image] = []
    for stage, fname in FRAMES.items():
        src = RAW / fname
        if not src.exists():
            sys.exit(f"missing raw render: {src}")
        rgb = load(src)
        alpha, bg = alpha_for(rgb)
        alpha, erased = drop_hairlines(alpha)
        alpha, debris = trim_shadow_debris(alpha, rgb, bg)
        keep = float(alpha.mean())
        clean = decontaminate(rgb, alpha, bg)
        clean = grade(clean)
        rgba = Image.fromarray(
            np.dstack([clean, np.clip(alpha * 255.0, 0, 255).astype(np.uint8)]), "RGBA"
        )
        plate = to_plate(rgba)
        arr = np.array(plate)
        hinge, extra = LEG_STRETCH.get(stage, (0, 0.0))
        if extra:
            arr = elongate_below(arr, hinge, extra)
        shift = LEG_SHIFT.get(stage, 0)
        if shift:
            # Whatever the stretch left short is made up by a small slide; the rows that fall off the
            # bottom are the chair base, which the plank hides anyway.
            arr = np.concatenate([np.zeros((shift, PLATE_W, 4), dtype=arr.dtype), arr[:-shift]], axis=0)
        if extra or shift:
            plate = Image.fromarray(arr, "RGBA")
        arr = fit_head_band(np.array(plate), stage)
        # Sharpen BEFORE the sole fit, never after. The fit scales the plate up a couple of percent,
        # and an unsharp pass run over the result drags the bright skin colour of the sole down into
        # the dark shadow band under her foot — a halo exactly where the toes meet the plank edge,
        # i.e. in the one row the player looks at. Crisp first, place second.
        arr = sharpen(arr)
        # ...and the sole fit LAST: every step above moves her relative to the plank, and the first
        # version of this rule ran before them, so the re-frame lifted her foot back off the desk by
        # the 6 rows it shrank. The plank edge is the one line in the frame that never moves, so it is
        # the only sane thing to measure against last.
        if stage in SOLE_ON_PLANK:
            arr = fit_sole_to_plank(arr, stage)
        plate = Image.fromarray(arr, "RGBA")
        fg = float((arr[:, :, 3] > 8).mean())
        # Contact check, calibrated against the accepted Day-1/Day-2 plates rather than a guess:
        # a lit body part must reach within DESK_CONTACT_SLACK rows of the plank line (they measure
        # 1451/1491 of 1489 — the desk edge plus the mic arm is what sells the rest), and the
        # silhouette must be flush with the canvas bottom so no transparent band floats under her.
        al = arr[:, :, 3].astype(np.float32)
        rr, gg, bb = (arr[:, :, i].astype(np.float32) for i in range(3))
        lum = 0.299 * rr + 0.587 * gg + 0.114 * bb
        body = (al > 200) & (lum > 70)
        opaque = al > 200
        low = int(np.nonzero(opaque.sum(axis=1) > 2)[0].max())
        body_low = int(np.nonzero(body.sum(axis=1) > 12)[0].max())
        # ONE measure, the function the fit optimises. The inline copy of it disagreed by 26 rows
        # because it read the array through different dtypes, and two definitions of "where her foot
        # ends" in one file is how a foot slips through a gate.
        skin_low = sole_bottom_row(arr)
        print(
            f"  {stage}: body bottom {body_low}, skin bottom {skin_low}, silhouette bottom {low} "
            f"(plank covers >= {DESK_TOP_ROW})"
        )
        # For a plank frame the contact test is about the SOLE, not about the silhouette bottom: the
        # foot must sit on the desk edge, which means the last skin row lands within a few pixels of
        # it. Reaching INTO the hidden band is what sliced her toes in half, so that is a failure too.
        if stage in SOLE_ON_PLANK:
            target = SOLE_ON_PLANK[stage]
            if not (target - 12 <= skin_low <= target + 8):
                raise SystemExit(
                    f"{stage}: the sole bottoms out at row {skin_low}, {abs(skin_low - target)} rows off "
                    f"the plank edge ({target}) — a foot that floats reads as missing, a foot that dips "
                    "gets sawn in half by the desk edge. Re-run the fit or move SOLE_ON_PLANK."
                )
        elif stage not in DESK_CONTACT_EXEMPT and body_low < DESK_TOP_ROW - DESK_CONTACT_SLACK:
            raise SystemExit(
                f"{stage}: her body bottoms out at row {body_low}, {DESK_TOP_ROW - body_low} rows above "
                f"the plank line ({DESK_TOP_ROW}) — the feet read as floating over the chair. Lengthen "
                "the legs in LEG_STRETCH or re-frame the raw with the soles at the bottom edge."
            )
        # The flush-bottom rule exists because a transparent band UNDER her reads as hovering. A
        # sole resting on the plank is the opposite case: the plank's own top edge (row 1489) covers
        # everything below it, so ending the silhouette there is correct, and padding it further down
        # only smears the last row into the desk area. Ask for either, never both.
        rests_on_plank = stage in SOLE_ON_PLANK and low >= DESK_TOP_ROW - 4
        if low < PLATE_H - 6 and not rests_on_plank:
            raise SystemExit(
                f"{stage}: the silhouette stops at row {low}, leaving a transparent band at the bottom "
                "of the plate — that gap is what makes her look like she is hovering."
            )
        # Only now, with the plate proven, does it land in public/art — a rejected frame must never
        # be shippable by accident.
        plate.save(PLATES / f"{stage}.png")
        # method=6 is the slowest (best) webp search; on flat cel colour it buys real edge quality for
        # a few seconds of build time, which is the whole point of shipping the plate as webp.
        plate.save(PLATES / f"{stage}.webp", "WEBP", quality=96, method=6)
        print(
            f"{stage}: {src.name} bg={tuple(int(v) for v in bg.round(0))} alpha kept {keep:.3f} "
            f"coverage {fg:.3f} stray-rule px {erased} debris px {debris}"
        )
        tiles.append(grid(plate))

    w, h = tiles[0].size
    sheet = Image.new("RGB", (w * len(tiles), h), (28, 24, 32))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * w, 0))
    sheet = sheet.resize((w * len(tiles) // 3, h // 3), Image.Resampling.LANCZOS)
    sheet.save(QA / "day3_frames_grid.png")
    print(f"wrote {QA / 'day3_frames_grid.png'}")


if __name__ == "__main__":
    main()
