"""Fast, headless proof of how each Day-3 plate sits *in the stream frame*.

The plates pass on their own, but the bug that keeps coming back is compositional: the desk plank is
drawn OVER her shins, so if a plate ends her feet above the plank's top edge the soles read as
floating in the air instead of resting on the desk. Screenshotting the browser is the ground truth but
takes a minute; this rebuilds the same stack with PIL in a second — room, plate, then the foreground
desk — so the framing rule can be checked while the art is still being iterated.

    python3 scripts/day3_inscene_proof.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public/art"
OUT = ROOT / ".qa-out/day3_frames_inscene.png"

# Mirror of StreamStage's layout maths (virtual 1376x768, cover fit, plate box 1024x1526).
VIRTUAL_W, VIRTUAL_H = 1376, 768
PLATE_W, PLATE_H = 1024, 1526
BOX_W, BOX_H = 482, 722
BOX_X, BOX_Y = 442, 11
VIEW_X, VIEW_Y, VIEW_W, VIEW_H = -12, -13, 1390, 778
CANVAS_H = 753
STAGES = ["heroine_t3_s0", "heroine_t3_s1", "heroine_t3_s2", "heroine_t3_s3", "heroine_t3_s4", "heroine_t3_flash"]


def main() -> None:
    for name in [*STAGES, "bg_room_t1", "fg_desk_t1"]:
        path = ART / f"{name}.webp"
        if not path.exists():
            sys.exit(f"missing art layer: {path}")
    bg = Image.open(ART / "bg_room_t1.webp").convert("RGBA")
    desk = Image.open(ART / "fg_desk_t1.webp").convert("RGBA")
    tiles = []
    for stage in STAGES:
        plate = Image.open(ART / f"{stage}.webp").convert("RGBA")
        scene = Image.new("RGBA", (VIRTUAL_W, CANVAS_H), (10, 8, 12, 255))
        # StreamStage draws the room at (VIRTUAL_W+14, VIRTUAL_H+10) offset (-12, -8).
        scene.alpha_composite(
            bg.resize((VIRTUAL_W + 14, VIRTUAL_H + 10), Image.Resampling.LANCZOS), (-12, -8)
        )
        scene.alpha_composite(plate.resize((BOX_W, BOX_H), Image.Resampling.LANCZOS), (BOX_X, BOX_Y))
                # StreamStage sizes the foreground plank VIRTUAL_W+28 x VIRTUAL_H+12 at (-14, -2).
        scene.alpha_composite(desk.resize((VIRTUAL_W + 28, VIRTUAL_H + 12), Image.Resampling.LANCZOS), (-14, -2))
        tile = scene.crop((180, 0, 1010, 753)).convert("RGB")
        scale = 560 / tile.height
        tiles.append(tile.resize((round(tile.width * scale), 560), Image.Resampling.LANCZOS))
    w, h = tiles[0].size
    cols = 3
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + (cols - 1) * 6, rows * h + (rows - 1) * 6), (16, 13, 20))
    from PIL import ImageDraw

    for i, tile in enumerate(tiles):
        x, y = (i % cols) * (w + 6), (i // cols) * (h + 6)
        sheet.paste(tile, (x, y))
        d = ImageDraw.Draw(sheet)
        d.rectangle([x, y, x + 190, y + 24], fill=(0, 0, 0))
        d.text((x + 6, y + 6), STAGES[i], fill=(255, 255, 255))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f"wrote {OUT} {sheet.size}")


if __name__ == "__main__":
    main()
