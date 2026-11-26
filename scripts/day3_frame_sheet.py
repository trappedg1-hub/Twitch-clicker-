"""Contact sheet of the six shipped Day-3 plates on magenta (the definitive artifact check).

Every plate is a finished drawing keyed out of its raw render, and a keyed plate hides two kinds of
mistakes from a plain viewer: leftover background patches look like part of the room, and a smudge
of the old background looks like shading. Magenta makes both scream. Layout is 3 across x 2 down at
one third scale, so a stray line is still ~1 px wide and a 40-px blob is 13.

    python3 scripts/day3_frame_sheet.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLATES = ROOT / "public/art"
OUT = ROOT / ".qa-out/day3_frames_sheet.png"

# Same magenta the Day-1/Day-2 sheets used: far from every colour in the art (plum bg, skin, cloth).
MAGENTA = (220, 32, 150)
STAGES = ["heroine_t3_s0", "heroine_t3_s1", "heroine_t3_s2", "heroine_t3_s3", "heroine_t3_s4", "heroine_t3_flash"]
SCALE = 0.34


def main() -> None:
    tiles = []
    for stage in STAGES:
        path = PLATES / f"{stage}.webp"
        if not path.exists():
            raise SystemExit(f"missing plate: {path}")
        plate = Image.open(path).convert("RGBA")
        flat = Image.new("RGB", plate.size, MAGENTA)
        flat.paste(plate, (0, 0), plate)
        size = (round(plate.width * SCALE), round(plate.height * SCALE))
        tile = flat.resize(size, Image.Resampling.LANCZOS)
        ImageDraw_label(tile, stage)
        tiles.append(tile)

    w, h = tiles[0].size
    cols, rows = 3, 2
    sheet = Image.new("RGB", (cols * w + (cols - 1) * 8, rows * h + (rows - 1) * 8), (26, 20, 30))
    for i, tile in enumerate(tiles):
        sheet.paste(tile, ((i % cols) * (w + 8), (i // cols) * (h + 8)))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f"wrote {OUT} {sheet.size}")


def ImageDraw_label(tile: Image.Image, label: str) -> None:
    from PIL import ImageDraw

    d = ImageDraw.Draw(tile)
    d.rectangle([0, 0, len(label) * 9 + 8, 22], fill=(0, 0, 0))
    d.text((4, 5), label, fill=(255, 255, 255))


if __name__ == "__main__":
    main()
