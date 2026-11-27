#!/usr/bin/env python3
"""Turn rendered rig frames into the files the player can actually watch on a phone.

The stand does not open in their browser and there is no headless browser in this sandbox, so the
acceptance material is files: two animated WebP loops and one before/after sheet.

    python3 scripts/rig_deliverable.py idle --fps 6 --out deliverables/rig_v2/idle.webp
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BG = (24, 16, 30)
FONT_PATHS = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_PATHS:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def pick_files(folder: Path, count: int) -> list[Path]:
    """Evenly spaced frames across whatever was rendered."""
    files = frames(folder)
    if not files:
        raise SystemExit(f"no frames in {folder}")
    step = max(1, len(files) // count)
    return files[::step][:count]


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


def at_seconds(folder: Path, seconds: list[float], src_fps: float) -> list[Path]:
    """Exact frames by time — a storyboard of the moments that matter, not an even grid."""
    files = frames(folder)
    if not files:
        raise SystemExit(f"no frames in {folder}")
    picks = []
    for t in seconds:
        index = min(len(files) - 1, max(0, round(t * src_fps)))
        picks.append(files[index])
    return picks


def sheet(rows: list[tuple[str, Path, list[Path]]], out: Path, scale: float = 1.0) -> None:
    """A labelled before/after contact sheet, one row per variant."""
    grid: list[tuple[str, list[Image.Image]]] = []
    for label, folder, chosen in rows:
        row = []
        for path in chosen:
            im = Image.open(path).convert("RGB")
            if scale != 1.0:
                im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
            row.append(im)
        grid.append((label, row))
    if not grid:
        raise SystemExit("nothing to draw")
    per_row = max(len(row) for _, row in grid)
    tw, th = grid[0][1][0].size
    label_font = font(15)
    header = 28
    out_img = Image.new("RGB", (per_row * tw, len(grid) * (th + header)), BG)
    draw = ImageDraw.Draw(out_img)
    for r, (label, row) in enumerate(grid):
        y = r * (th + header)
        draw.text((8, y + 6), label, fill=(235, 235, 245), font=label_font)
        for c, im in enumerate(row):
            out_img.paste(im, (c * tw, y + header))
    out.parent.mkdir(parents=True, exist_ok=True)
    out_img.save(out)
    print(f"{out}: {out_img.size[0]}x{out_img.size[1]}")


def compare(
    a: tuple[str, Path],
    b: tuple[str, Path],
    out: Path,
    count: int,
    fps: int,
    width: int,
) -> None:
    """Old rig next to the new one, same crop, same loop length — the real verdict."""
    label_font = font(17)
    header = 32
    gap = 6
    shots = [pick_files(folder, count) for _, folder in (a, b)]
    count = min(len(shots[0]), len(shots[1]))
    panels = []
    for (label, _), files in zip((a, b), shots):
        images = [Image.open(p).convert("RGB") for p in files[:count]]
        h = round(images[0].height * width / images[0].width)
        panels.append((label, [im.resize((width, h), Image.LANCZOS) for im in images]))
    ph = panels[0][1][0].height
    out_img = Image.new("RGB", (width * 2 + gap, ph + header), BG)
    draw = ImageDraw.Draw(out_img)
    for i, (label, _) in enumerate(panels):
        draw.text((i * (width + gap) + 8, 7), label, fill=(235, 235, 245), font=label_font)
    merged = []
    for frame in range(count):
        canvas = out_img.copy()
        for i, (_, images) in enumerate(panels):
            canvas.paste(images[frame], (i * (width + gap), header))
        merged.append(canvas)
    out.parent.mkdir(parents=True, exist_ok=True)
    merged[0].save(
        out,
        save_all=True,
        append_images=merged[1:],
        duration=round(1000 / fps),
        loop=0,
        quality=92,
        method=6,
    )
    print(f"{out}: {count} frames, {merged[0].width}x{merged[0].height}, {out.stat().st_size / 1024:.0f} KB")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", choices=["animate", "sheet", "compare"])
    ap.add_argument("--folder", action="append", default=None)
    ap.add_argument("--label", action="append", default=None)
    ap.add_argument("--out", required=True)
    ap.add_argument("--fps", type=int, default=6)
    ap.add_argument("--width", type=int, default=0)
    ap.add_argument("--pick", type=int, default=6)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--a", default=None)
    ap.add_argument("--b", default=None)
    ap.add_argument("--label-a", default="было")
    ap.add_argument("--label-b", default="стало")
    ap.add_argument("--frames", type=int, default=24)
    ap.add_argument("--at", default=None, help="comma-separated seconds for an exact storyboard")
    ap.add_argument("--src-fps", type=float, default=8.0)
    args = ap.parse_args()

    if args.kind == "compare":
        if not (args.a and args.b):
            raise SystemExit("compare needs --a and --b")
        compare(
            (args.label_a, Path(args.a)),
            (args.label_b, Path(args.b)),
            Path(args.out),
            args.frames,
            args.fps,
            args.width or 420,
        )
    elif args.kind == "animate":
        animate(Path(args.folder[0]), Path(args.out), args.fps, args.width or None)
    else:
        labels = args.label or []
        folders = [Path(f) for f in (args.folder or [])]
        at = [float(t) for t in args.at.split(",")] if args.at else []
        rows = []
        for label, folder in zip(labels, folders):
            chosen = at_seconds(folder, at, args.src_fps) if at else pick_files(folder, args.pick)
            rows.append((label, folder, chosen))
        sheet(rows, Path(args.out), args.scale)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
