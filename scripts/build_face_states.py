#!/usr/bin/env python3
"""Merge a generated face variant into the plate: only the eyes change, nothing else moves.

Image generation redraws the whole frame — hair, hands, blush and background all drift a little.
Swapping the frames would flicker everywhere. So the generated frame is registered to the plate
and only a feathered window around the eyes is taken from it; every other pixel stays the
original. The result is a plate variant that differs from the canon plate *only* inside the eye
window, which is exactly what a blink needs.

Registration: brute-force search over integer shifts on a downsampled grayscale of the face,
scored on the skin around (but outside) the eye windows, where both images should agree.

Usage:
    python3 scripts/build_face_states.py --plate public/art/heroine_t1_s0.webp \
        --gen deliverables/concept/face_kit/gen/t1_s0_closed_raw.png \
        --eyes 438,296,518,346 548,270,622,320 \
        --out public/art/heroine_t1_s0_eyes_closed.webp \
        --check deliverables/concept/face_kit/eyes_closed_check.png
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def parse_args(argv: list[str]) -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plate", required=True)
    ap.add_argument("--gen", required=True)
    ap.add_argument("--eyes", nargs="+", required=True, help="x0,y0,x1,y1 per eye")
    ap.add_argument("--out", required=True)
    ap.add_argument("--check", default=None)
    ap.add_argument("--search", type=int, default=8)
    ap.add_argument("--grow", type=float, default=1.3, help="window scale around each eye box")
    return ap.parse_args(argv)


def boxes(specs: list[str]) -> list[tuple[int, int, int, int]]:
    out = []
    for spec in specs:
        x0, y0, x1, y1 = (int(v) for v in spec.split(","))
        out.append((x0, y0, x1, y1))
    return out


def eye_window(shape: tuple[int, int], eye: tuple[int, int, int, int], grow: float) -> np.ndarray:
    """Elliptical, feathered window over one eye — generous enough for a lid, short of the brow."""
    x0, y0, x1, y1 = eye
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = (x1 - x0) * grow / 2, (y1 - y0) * grow / 2
    yy, xx = np.mgrid[0 : shape[0], 0 : shape[1]]
    inside = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
    img = Image.fromarray((inside * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5.0))
    return np.asarray(img).astype(np.float32) / 255.0


def ring_mask(shape: tuple[int, int], eye: tuple[int, int, int, int], grow: float) -> np.ndarray:
    """Skin band just outside the eye window: the reference both images should agree on."""
    x0, y0, x1, y1 = eye
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    yy, xx = np.mgrid[0 : shape[0], 0 : shape[1]]
    out = np.zeros(shape, np.float32)
    for scale in (grow, grow * 1.9):
        rx, ry = (x1 - x0) * scale / 2, (y1 - y0) * scale / 2
        inside = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
        out[inside] = 1.0 if scale == grow else 0.0
    return out


def register(plate: np.ndarray, gen: np.ndarray, windows: list[np.ndarray], search: int) -> tuple[int, int]:
    """plate/gen are float HxWx3; grayscale is taken directly, no PIL round-trip."""
    """Integer shift that best aligns `gen` to `plate` on the skin outside the eye windows."""
    h, w = plate.shape[:2]
    mask = np.ones((h, w), bool)
    for win in windows:
        mask &= win < 0.02
    # Score on the face only: the chin-to-brow band, away from hair, hands and background.
    band = np.zeros((h, w), bool)
    band[int(h * 0.16) : int(h * 0.36), int(w * 0.36) : int(w * 0.68)] = True
    mask &= band

    a = plate @ np.array([0.299, 0.587, 0.114], np.float32)
    b = gen @ np.array([0.299, 0.587, 0.114], np.float32)

    best, best_shift = None, (0, 0)
    for dy in range(-search, search + 1):
        for dx in range(-search, search + 1):
            shifted = np.roll(np.roll(b, dy, axis=0), dx, axis=1)
            err = np.abs(a - shifted)[mask].mean()
            if best is None or err < best:
                best, best_shift = err, (dx, dy)
    return best_shift


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    plate = Image.open(args.plate).convert("RGBA")
    src = np.asarray(plate.convert("RGB")).astype(np.float32)

    gen_img = Image.open(args.gen).convert("RGB").resize(plate.size, Image.LANCZOS)
    gen = np.asarray(gen_img).astype(np.float32)

    eyes = boxes(args.eyes)
    windows = [eye_window(src.shape[:2], e, args.grow) for e in eyes]

    dx, dy = register(src, gen, windows, args.search)
    gen = np.roll(np.roll(gen, dy, axis=0), dx, axis=1)
    print(f"registered: dx={dx} dy={dy}")

    merged = src.copy()
    for eye, win in zip(eyes, windows):
        ring = ring_mask(src.shape[:2], eye, args.grow)
        skin = (src.max(axis=2) > 150) & (ring > 0.5)
        gain = np.ones(3, np.float32)
        offset = np.zeros(3, np.float32)
        for c in range(3):
            a, b = src[..., c][skin], gen[..., c][skin]
            if len(a) < 200:
                continue
            A = np.stack([b, np.ones_like(b)], axis=1)
            sol, *_ = np.linalg.lstsq(A, a, rcond=None)
            gain[c] = float(np.clip(sol[0], 0.85, 1.15))
            offset[c] = float(np.clip(sol[1], -24, 24))
        patch = np.clip(gen * gain + offset, 0, 255)
        alpha = win[..., None]
        merged = merged * (1 - alpha) + patch * alpha

    # Trimmed overlay: the runtime gets a small region attachment instead of a second full plate,
    # and two patches (eyes, mouth) compose freely instead of needing one plate per combination.
    alpha = (np.maximum.reduce(windows) * 255).astype(np.uint8)
    visible = np.asarray(
        Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(1.0))
    ) > 2
    ys, xs = np.nonzero(visible)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 2, int(ys.max()) + 2
    patch = Image.fromarray(np.clip(merged[y0:y1, x0:x1], 0, 255).astype(np.uint8)).convert("RGBA")
    patch.putalpha(Image.fromarray(alpha[y0:y1, x0:x1]))
    patch.save(args.out, quality=96, method=6)
    print(f"wrote {args.out}  patch {patch.width}x{patch.height} at ({x0},{y0})")

    if args.check:
        box = (min(e[0] for e in eyes) - 30, min(e[1] for e in eyes) - 34,
               max(e[2] for e in eyes) + 30, max(e[3] for e in eyes) + 40)
        merged_img = Image.fromarray(np.clip(merged, 0, 255).astype(np.uint8)).convert("RGB")
        tiles = [plate.convert("RGB").crop(box), gen_img.crop(box), merged_img.crop(box)]
        scale = 3
        tiles = [t.resize((t.width * scale, t.height * scale), Image.LANCZOS) for t in tiles]
        sheet = Image.new("RGB", (sum(t.width for t in tiles) + 16, tiles[0].height), (18, 16, 22))
        x = 0
        for t in tiles:
            sheet.paste(t, (x, 0))
            x += t.width + 8
        Path(args.check).parent.mkdir(parents=True, exist_ok=True)
        sheet.save(args.check)
        print(f"wrote {args.check}")

    # How much of the frame actually changed — should be a few percent, around the eyes only.
    changed = np.abs(merged - src).max(axis=2) > 6
    print(f"changed pixels: {changed.mean() * 100:.2f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(__import__("sys").argv[1:]))
