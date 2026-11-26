#!/usr/bin/env python3
"""Turn rendered rig frames into the files the player can actually watch on a phone.

The stand does not open in their browser and there is no headless browser in this sandbox, so the
acceptance material is files: two animated WebP loops and one before/after sheet.

    python3 scripts/rig_deliverable.py idle --fps 6 --out deliverables/rig_v2/idle.webp
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

BG = (24, 16, 30)


def frames(folder: Path) -> list[Path]:
    return sorted(p for p in folder.glob("[0-9][0-9][0-9].png"))


def animate(folder: Path, out: Path, fps: int, width: int | None) -> None:
    files = frames(folder)
    if not files:
        raise SystemExit(f"no frames in {folder}")
    images = [Image.open(p).convert("RGB") for p in files]
    if width:
        images = [im.resize((width, round(im.height * width / im.width)), Image.LANCZOS) for im in images]
    out.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(
        out,
        save_all=True,
        append_images=images[1:],
        duration=round(1000 / fps),
        loop=0,
        quality=88,
        method=6,
    )
    print(f"{out}: {len(images)} frames, {out.stat().st_size / 1024:.0f} KB")


def sheet(rows: list[tuple[str, Path, int]], out: Path, scale: float = 1.0) -> None:
    """A labelled before/after contact sheet, one row per variant."""
    tiles: list[tuple[str, Image.Image]] = []
    for label, folder, pick in rows:
        files = frames(folder)
        if not files:
            continue
        # Evenly spaced frames across whatever was rendered.
        step = max(1, len(files) // pick)
        chosen = files[::step][:pick]
        for i, path in enumerate(chosen):
            im = Image.open(path).convert("RGB")
            if scale != 1.0:
                im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
            tiles.append((label if i == 0 else "", im))
    if not tiles:
        raise SystemExit("nothing to draw")
    per_row = max(1, sum(1 for label, _ in tiles if label) and max(
        sum(1 for l, _ in tiles if l == label) for label in {l for l, _ in tiles if l}))
    tw, th = tiles[0][1].size
    rowsn = (len(tiles) + per_row - 1) // per_row
    out_img = Image.new("RGB", (per_row * tw, rowsn * (th + 22)), BG)
    draw = ImageDraw.Draw(out_img)
    for i, (label, im) in enumerate(tiles):
        x, y = (i % per_row) * tw, (i // per_row) * (th + 22)
        if label:
            draw.text((x + 6, y + 5), label, fill=(230, 230, 240))
        out_img.paste(im, (x, y + 22))
    out.parent.mkdir(parents=True, exist_ok=True)
    out_img.save(out)
    print(f"{out}: {out_img.size[0]}x{out_img.size[1]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", choices=["animate", "sheet"])
    ap.add_argument("--folder", action="append", default=None)
    ap.add_argument("--label", action="append", default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fps", type=int, default=6)
    ap.add_argument("--width", type=int, default=0)
    ap.add_argument("--pick", type=int, default=6)
    ap.add_argument("--scale", type=float, default=1.0)
    args = ap.parse_args()

    if args.kind == "animate":
        animate(Path(args.folder[0]), Path(args.out), args.fps, args.width or None)
    else:
        rows = list(zip(args.label or [], map(Path, args.folder or [])))
        sheet([(label, folder, args.pick) for label, folder in rows], Path(args.out), args.scale)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
