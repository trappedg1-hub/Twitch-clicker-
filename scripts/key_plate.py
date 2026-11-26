#!/usr/bin/env python3
"""Chroma-key a generated concept plate into the game's canonical plate box.

    green-screen master -> connected-background matte -> despill -> 1024x1526 WebP

Why not a per-pixel threshold: the leather chair and the black hair pick up a
green bounce from the screen, so a naive key punches holes in them, and an
un-premultiply pass then turns those holes magenta. Instead the matte is built
from the background *region* (flood fill from the four corners), which keeps
solid interiors opaque, and the green cast is removed by clamping the green
channel to the neighbouring red/blue level.

The final box is not negotiable: `HeroineRig.PLATE_W/H` is 1024x1526 and four
test files reject any plate that is not 1024x1526 with an alpha layer.

Usage:
    python3 scripts/key_plate.py IN.png OUT.webp [--preview OUT_preview.png]
"""
from __future__ import annotations

import argparse
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

PLATE_W, PLATE_H = 1024, 1526

# g - max(r, b) above this is a green-screen candidate.
GREEN_CANDIDATE = 25
# Headroom added before clamping the green channel (kills the bounce).
DESPILL_HEADROOM = 8


def build_matte(img: Image.Image) -> Image.Image:
    r, g, b = img.split()
    dominance = ImageChops.subtract(g, ImageChops.lighter(r, b))
    mask = dominance.point(lambda v: 255 if v > GREEN_CANDIDATE else 0)

    # One background region: flood the four corners, keep only what was reached.
    ImageDraw.floodfill(mask, (0, 0), 128, thresh=0)
    w, h = mask.size
    for corner in ((w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if mask.getpixel(corner) != 128:
            ImageDraw.floodfill(mask, corner, 128, thresh=0)

    background = mask.point(lambda v: 255 if v == 128 else 0)
    alpha = ImageChops.invert(background)
    return alpha.filter(ImageFilter.GaussianBlur(0.6))


def despill(img: Image.Image) -> Image.Image:
    r, g, b = img.split()
    ceiling = ImageChops.lighter(r, b).point(lambda v: min(255, v + DESPILL_HEADROOM))
    return Image.merge("RGB", (r, ImageChops.darker(g, ceiling), b))


def fit_box(img: Image.Image) -> Image.Image:
    """Scale to the plate height, then pad the width with transparent pixels.

    Padding rather than cropping keeps the whole figure, both shoes and the chair
    base inside the frame — the acceptance rule for every shipped plate. Resampling
    happens in premultiplied alpha so the keyed edge keeps no dark fringe.
    """
    w, h = img.size
    scale = PLATE_H / h
    new_w = max(1, round(w * scale))
    resized = img.convert("RGBa").resize((new_w, PLATE_H), Image.LANCZOS).convert("RGBA")

    canvas = Image.new("RGBA", (PLATE_W, PLATE_H), (0, 0, 0, 0))
    canvas.paste(resized, ((PLATE_W - resized.width) // 2, 0), resized)
    return canvas


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("out_webp")
    ap.add_argument("--preview", default=None)
    args = ap.parse_args(argv)

    img = Image.open(args.source).convert("RGB")
    keyed = despill(img).convert("RGBA")
    keyed.putalpha(build_matte(img))

    plate = fit_box(keyed)
    plate.save(args.out_webp, "WEBP", quality=92, method=6, exact=True)

    if args.preview:
        bg = Image.new("RGBA", plate.size, (11, 11, 13, 255))
        bg.alpha_composite(plate)
        bg.convert("RGB").save(args.preview, "PNG")

    print(f"{args.out_webp}: {plate.width}x{plate.height} RGBA")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
