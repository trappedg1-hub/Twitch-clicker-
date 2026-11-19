#!/usr/bin/env python3
"""Day-5 candidates, cut into the real plate geometry and proofed inside the stream frame.

Nothing here ships: the keyed plates go to `.qa-out/day5_plates/` so `public/art/*` stays untouched
until an art is actually approved. What the sheet answers is the question the last three batches got
wrong — not "is this a good drawing" but "does this frame belong on Miya's stream camera": head on the
shared row 88, the figure big enough to fill the box, and the chair base allowed to sink behind the
desk plank (plate row 1489) instead of floating.

    LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp python3 scripts/day5_plate_proof.py
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
from process_day4_frames import centre_horizontally, fit_head_row, fit_report  # noqa: E402

RAW = ROOT / "art-studio/raw"
OUTDIR = ROOT / ".qa-out/day5_plates"
SHEET = ROOT / ".qa-out/day5_plate_proof.png"
ART = ROOT / "public/art"

# Mirror of StreamStage's layout maths (virtual 1376x768, plate box 482x722 at 442,11).
VIRTUAL_W, VIRTUAL_H, CANVAS_H = 1376, 768, 753
BOX_W, BOX_H, BOX_X, BOX_Y = 482, 722, 442, 11

CANDIDATES = [
    ("s1_start", "t5_t100_bikini_figfour_E"),
    ("s2_fivepoint", "t5_t95_bikini_fivepoint_A"),
    ("s3_cat", "t5_t117_bikini_cat_close_F"),
    ("s4_feetcam", "t5_t116_bikini_feetcam_E"),
]


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
    arr = fit_head_row(arr, stage)
    arr = centre_horizontally(arr, stage)
    arr = sharpen(arr)
    fit_report(arr, stage)
    plate = Image.fromarray(arr, "RGBA")
    OUTDIR.mkdir(parents=True, exist_ok=True)
    plate.save(OUTDIR / f"heroine_t5_{stage}.png")
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
