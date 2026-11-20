#!/usr/bin/env python3
"""Day-6 candidates, cut into the real plate geometry and proofed inside the stream frame.

Nothing here ships: the keyed plates go to `.qa-out/day5_plates/` so `public/art/*` stays untouched
until an art is actually approved. What the sheet answers is the question the last three batches got
wrong — not "is this a good drawing" but "does this frame belong on Miya's stream camera": head on the
shared row 88, the figure big enough to fill the box, and the chair base allowed to sink behind the
desk plank (plate row 1489) instead of floating.

    LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp python3 scripts/day6_plate_proof.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from process_day3_ghost_arts import (  # noqa: E402
    PLATE_H,
    PLATE_W,
    alpha_for,
    decontaminate,
    drop_hairlines,
    grade,
    load,
    sharpen,
    to_plate,
    trim_shadow_debris,
)
from process_day4_frames import (
    HEAD_TARGET,
    centre_horizontally,
    fit_head_row,
    fit_report,
)  # noqa: E402

RAW = ROOT / "art-studio/raw"
OUTDIR = ROOT / ".qa-out/day6_plates"
SHEET = ROOT / ".qa-out/day6_plate_proof.png"
ART = ROOT / "public/art"

# Mirror of StreamStage's layout maths (virtual 1376x768, plate box 482x722 at 442,11).
VIRTUAL_W, VIRTUAL_H, CANVAS_H = 1376, 768, 753
BOX_W, BOX_H, BOX_X, BOX_Y = 482, 722, 442, 11

# Day 6 «Деревенская девочка»: the village-girl batch, proofed against the same stream geometry. The
# straw hat is the new variable — it is the topmost opaque row of these frames, so the head-fit anchor
# lands on the brim instead of her hair, exactly like the Day-3 hood did, and that is what we want
# (the brim must not be cut).
CANDIDATES = [
    # Ladder, as graded by him 2026-11-21: the village frame he approved «для начала дня, первого
    # саб-гоала» is the gate plate, the cucumber in her hands is 54000, the greedy bite is 61000, and
    # the corn held in her feet is the finale. t134 (one strap) and t135 (back view) drop out of the
    # ladder — t134 could not be made to land on the plank without moving her head off row 88.
    ("s0_gate", "t6_t136_village_finale_D"),
    ("s1_cucumber", "t6_t142_village_cucumber_hands_J"),
    ("s2_cucumber_deep", "t6_t147_village_cucumber_chair_E"),
    ("s2_alt_hands_on_chair", "t6_t148_village_cucumber_chair_hands_F"),  # same bite, she holds the chair
    ("s2_dropped_nochair", "t6_t144_village_cucumber_greedy_A2"),  # approved look, no chair in frame
    ("s3_corn_finale", "t6_t180_village_corn_butter_all_over_A"),
    ("s3_alt_corn_resting", "t6_t154_village_corn_butter_finale_F"),
    # the edit pass: same drawing, corn clamped across both feet, butter melted over her feet and the seat
    ("s3_alt_buttered_feet", "t6_t156_village_corn_butter_edit_G"),
    # the two-step build he asked for: base frame with stacked feet, corn inserted by edit
    ("s3_footclamp_nobutter", "t6_t172_village_corn_in_footclamp_B"),
    # «ступни на столе»: the ghost-day leg line — legs out at the camera, both feet in three-quarter
    # with the heels resting ON the plank, held there by FEET_ON_DESK instead of sinking behind it.
    ("s3_feet_on_desk", "t6_t195_village_feet_on_desk_B"),
    ("s3_feet_on_desk_butter", "t6_t198_village_feet_on_desk_butter_B"),
    ("s3_feet_on_desk_C", "t6_t197_village_feet_on_desk_C"),
    # everything in ONE generation — the butter is painted by the model, so the lineart survives
    ("s3_all_in_one_B", "t6_t202_village_feet_butter_corn_B"),
    ("s3_desk_decal", "t6_t199_village_desk_butter_tight_A"),
    ("s3_cross_grin", "t6_t207_village_feet_desk_cross_A"),
    ("s3_cross_laugh", "t6_t208_village_feet_desk_cross_B"),
]

# The top of the foreground wood: fg_desk_t1 starts at virtual y=708 (StreamStage.MIC_BASE_Y), which
# lands on plate row 1489 through the 482x722 / y=11 box maths. Everything below it is hidden, so a
# plate in FEET_ON_DESK is slid to rest its last content row exactly on that line — heels ON the desk.
DESK_TOP = 1489
FEET_ON_DESK = {"s3_feet_on_desk", "s3_feet_on_desk_butter", "s3_feet_on_desk_C", "s3_all_in_one_B", "s3_desk_decal", "s3_cross_grin", "s3_cross_laugh"}


def key_and_fit(stage: str, name: str) -> Image.Image | None:
    src = RAW / f"{name}.png"
    if not src.exists():
        print(f"{stage}: {src.name} missing — skipped")
        return None
    rgb = load(src)
    alpha, bg = alpha_for(rgb)
    alpha, _erased = drop_hairlines(alpha)
    alpha, _debris = trim_shadow_debris(alpha, rgb, bg)
    clean = grade(decontaminate(rgb, alpha, bg))
    rgba = Image.fromarray(
        np.dstack([clean, np.clip(alpha * 255.0, 0, 255).astype(np.uint8)]), "RGBA"
    )
    arr = np.array(to_plate(rgba))
    # Day-6 bottom slide (the fix t134 and t142 both needed). `fit_head_row` scales about the plate's last
    # row AND zeroes everything below the figure's last content row, so a raw framed with a band of empty
    # field under the chair leaves her base above the plank line — she floats. The lever is to slide her
    # DOWN onto the last row *before* the head fit: the fit then takes a zoom > 1 instead of shrinking
    # her, the head still lands on the shared row 88, and the chair base sinks behind the plank. A slide
    # AFTER the fit was the dead end (it moved her head off anchor); the crop+re-scale was a no-op.
    rows = np.nonzero((arr[:, :, 3] > 8).sum(axis=1) > 2)[0]
    if rows.size:
        last = int(rows.max())
        head = int(rows.min())
        if stage in FEET_ON_DESK:
            # Solve the slide so the bottom-anchored head fit leaves her on the wood line. The fit
            # scales about the plate's last row, so a slide of d rows puts the bottom at
            # last_row' = h-1 - (h-1-DESK_TOP)/scale with scale = (h-1-HEAD)/(h-1-(head+d)).
            h_last = arr.shape[0] - 1
            d = 0.0
            for _ in range(40):
                scale = (h_last - HEAD_TARGET) / (h_last - (head + d))
                want = h_last - (h_last - DESK_TOP) / scale
                nd = min(max(want - last, 0.0), float(max(0, head - 8)))
                if abs(nd - d) < 0.01:
                    d = nd
                    break
                d = nd
            dead = int(round(d))
            if dead:
                arr = np.roll(arr, dead, axis=0)
                arr[:dead] = 0
                print(f"  {stage}: rested her heels on the plank line — slid {dead} rows (desk top = row {DESK_TOP})")
            dead = 0  # the generic slide below must not fire a second time
        else:
            dead = arr.shape[0] - 1 - last
        if dead > 6:
            # Never slide so far that her hat leaves the canvas: the head needs room above it.
            dead = min(dead, max(0, head - 8))
        if dead > 6:
            arr = np.roll(arr, dead, axis=0)
            arr[:dead] = 0
            print(f"  {stage}: slid her {dead} rows down so the chair base reaches the plate's last row")
    arr = fit_head_row(arr, stage)
    arr = centre_horizontally(arr, stage)
    arr = sharpen(arr)
    fit_report(arr, stage)
    body = np.nonzero((arr[60:1480, :, 3] > 8).sum(axis=0) > 2)[0]
    if body.size:
        print(
            f"  {stage}: side margins {int(body.min())} px left / {int(arr.shape[1] - 1 - body.max())} px "
            "right at the body rows (the bottom-edge note from fit_report is the plank crossing, ignore it)"
        )
    plate = Image.fromarray(arr, "RGBA")
    OUTDIR.mkdir(parents=True, exist_ok=True)
    plate.save(OUTDIR / f"heroine_t6_{stage}.png")
    print(f"{stage}: keyed from {src.name}, bg={tuple(int(v) for v in bg.round(0))}")
    return plate


def tile_over_room(plate: Image.Image, *, with_desk: bool) -> Image.Image:
    scene = Image.new("RGBA", (VIRTUAL_W, CANVAS_H), (10, 8, 12, 255))
    room = Image.open(ART / "bg_room_t1.webp").convert("RGBA")
    scene.alpha_composite(room.resize((VIRTUAL_W + 14, VIRTUAL_H + 10), Image.Resampling.LANCZOS), (-12, -8))
    scene.alpha_composite(plate.resize((BOX_W, BOX_H), Image.Resampling.LANCZOS), (BOX_X, BOX_Y))
    if with_desk:
        desk = Image.open(ART / "fg_desk_t1.webp").convert("RGBA")
        scene.alpha_composite(
            desk.resize((VIRTUAL_W + 28, VIRTUAL_H + 12), Image.Resampling.LANCZOS), (-14, -2)
        )
    crop = scene.crop((180, 0, 1010, CANVAS_H)).convert("RGB")
    k = 440 / crop.height
    return crop.resize((round(crop.width * k), 440), Image.Resampling.LANCZOS)


def plate_on_grey(plate: Image.Image) -> Image.Image:
    """The plate itself, flattened on the plum matte, so the cut and the head row are visible."""
    back = Image.new("RGBA", plate.size, (120, 92, 106, 255))
    back.alpha_composite(plate)
    out = back.convert("RGB")
    k = 440 / out.height
    return out.resize((round(out.width * k), 440), Image.Resampling.LANCZOS)


def main() -> None:
    tiles: list[tuple[str, Image.Image, Image.Image, Image.Image]] = []
    for stage, name in CANDIDATES:
        plate = key_and_fit(stage, name)
        if plate is None:
            continue
        tiles.append((stage, plate_on_grey(plate), tile_over_room(plate, with_desk=False), tile_over_room(plate, with_desk=True)))
    if not tiles:
        sys.exit("no candidates proofed")
    cols = ["plate", "in scene (no plank)", "in scene + desk plank"]
    w, h = tiles[0][1].size
    sheet = Image.new("RGB", (len(cols) * w + (len(cols) - 1) * 8, len(tiles) * h + (len(tiles) - 1) * 26), (16, 13, 20))
    draw = ImageDraw.Draw(sheet)
    for c, label in enumerate(cols):
        draw.text((c * (w + 8) + 6, 6), label, fill=(240, 220, 235))
    for r, (stage, *row) in enumerate(tiles):
        y = 26 + r * (h + 26)
        for c, im in enumerate(row):
            x = c * (w + 8)
            sheet.paste(im, (x, y))
            draw.rectangle([x, y, x + 150, y + 22], fill=(0, 0, 0))
            draw.text((x + 6, y + 6), stage, fill=(255, 255, 255))
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET)
    print(f"wrote {SHEET} {sheet.size}")


if __name__ == "__main__":
    main()
