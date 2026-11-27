#!/usr/bin/env python3
"""Put a generated face variant back onto the plate — and refuse it when the model redrew her.

The problem this solves, measured on `t1_s2` on 2026-11-27: image generation redraws the whole
frame. Asking for "closed eyes" on a full plate came back with stronger blush, a different mouth
and a slightly bigger face. `build_face_states.py` paste only a window around the eyes, so it
happily merged the drift into the plate and produced a face swap; nothing in the pipeline noticed.

Two rules fix it:

1. **Generate inside a crop.** A square around the face is enough context for the model and limits
   what it can touch. The crop comes back at a different size, so it has to be placed back into the
   plate frame first — that is what this script does, with a scale+shift search anchored on the
   face, because a rescaled face cannot be aligned by translation alone.
2. **Score the drift.** Everything outside the eye windows should be *her*, unchanged. The mean
   absolute difference over the face box minus the eye windows is that number; above the threshold
   the variant is rejected and the generation is retried, instead of silently shipped.

    python3 scripts/align_face_variant.py \
        --plate public/art/heroine_t1_s2.webp \
        --gen /tmp/t1_s2_eye_crop.png --crop 400,210,680,470 \
        --eyes 460,288,524,336 556,268,620,328 \
        --out deliverables/concept/face_kit/gen/t1_s2_closed_raw.png \
        --check /tmp/t1_s2_align_check.png

Exit code 1 means "rejected": do not feed this file to `build_face_states.py`.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# Mean absolute luma difference in the band around the eyes, outside the windows that get pasted,
# 0-255. Calibration: the raws that ship with a face kit score 2.5-5.1 on the eleven arts whose
# generation actually matches the plate, and a full-plate edit of `t1_s2` (which came back with a
# redder face and a different mouth — a face swap after the merge) scored 3.7 here. So the number
# catches a wrong frame — the same art generated from the wrong crop scores 20-100 — but not an
# artistic drift. That is what generating inside the crop is for; this is the seatbelt.
ACCEPT = 5.5


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plate", required=True)
    ap.add_argument("--gen", required=True, help="the generated crop (or a full frame)")
    ap.add_argument("--crop", default=None, help="x0,y0,x1,y1 of the generated crop on the plate")
    ap.add_argument("--eyes", nargs="+", required=True, help="x0,y0,x1,y1 per eye, plate pixels")
    ap.add_argument("--face", default=None, help="x0,y0,x1,y1 of the face box; default: eyes + 40 %")
    ap.add_argument("--out", required=True, help="aligned full-plate frame for build_face_states.py")
    ap.add_argument("--check", default=None, help="side-by-side PNG of plate / aligned / mask")
    ap.add_argument("--grow", type=float, default=1.35, help="eye window the merge pastes, mask scale")
    ap.add_argument("--band", type=float, default=1.8, help="band around the eyes that must not drift")
    ap.add_argument("--accept", type=float, default=ACCEPT)
    return ap.parse_args(argv)


def boxes(specs: list[str]) -> list[tuple[int, int, int, int]]:
    """`x0,y0,x1,y1` per eye — one argument each, or all of them in one quoted argument."""
    out = []
    for spec in " ".join(specs).split():
        x0, y0, x1, y1 = (int(v) for v in spec.split(","))
        out.append((x0, y0, x1, y1))
    return out


def place_crop(gen: Image.Image, crop: tuple[int, int, int, int], size: tuple[int, int]) -> Image.Image:
    """The generated crop, resized to the crop's own rectangle, pasted into a full plate frame."""
    canvas = Image.new("RGB", size, (0, 0, 0))
    x0, y0, x1, y1 = crop
    canvas.paste(gen.convert("RGB").resize((x1 - x0, y1 - y0), Image.LANCZOS), (x0, y0))
    return canvas


def face_box(eyes: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
    xs = [e[0] for e in eyes] + [e[2] for e in eyes]
    ys = [e[1] for e in eyes] + [e[3] for e in eyes]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    return (min(xs) - int(w * 0.35), min(ys) - int(h * 1.4), max(xs) + int(w * 0.35), max(ys) + int(h * 1.9))


def box_mask(shape: tuple[int, int], boxes: list[tuple[int, int, int, int]], grow: float, scale: float) -> np.ndarray:
    h, w = shape
    m = np.zeros((h, w), bool)
    for x0, y0, x1, y1 in boxes:
        cx, cy = (x0 + x1) / 2 * scale, (y0 + y1) / 2 * scale
        hw, hh = (x1 - x0) * grow / 2 * scale, (y1 - y0) * grow / 2 * scale
        m[max(0, int(cy - hh)) : min(h, int(np.ceil(cy + hh))), max(0, int(cx - hw)) : min(w, int(np.ceil(cx + hw)))] = True
    return m


def mask_for(shape, eyes, grow: float, band: float, scale: float) -> np.ndarray:
    """The band around the eyes, minus the windows that get pasted from the generation.

    The face box is not used for scoring: on a plate where the face is small it also covers hair,
    a hand and the background, and a generation that shifts the *hair* would be blamed on the face.
    The band is where a redrawn face shows up and where the merge can hurt.
    """
    return box_mask(shape, eyes, band, scale) & ~box_mask(shape, eyes, grow, scale)


def score_of(plate: np.ndarray, raw: np.ndarray, mask: np.ndarray) -> float:
    return float(np.abs(raw[mask] - plate[mask]).mean())


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    plate = Image.open(args.plate).convert("RGB")
    eyes = boxes(args.eyes)
    face = tuple(int(v) for v in args.face.split(",")) if args.face else face_box(eyes)

    gen = Image.open(args.gen)
    if args.crop:
        raw_full = place_crop(gen, tuple(int(v) for v in args.crop.split(",")), plate.size)
    else:
        raw_full = gen.convert("RGB").resize(plate.size, Image.LANCZOS)

    # Coarse search on a downsampled grey, then a refinement at the best position: a rescaled face
    # is the failure mode, so scale is searched, not just translation.
    step = 3
    pw, ph = plate.size[0] // step, plate.size[1] // step
    pg = np.asarray(plate.convert("L").resize((pw, ph), Image.LANCZOS), np.float32)
    mask = mask_for((ph, pw), eyes, args.grow, args.band, 1 / step)
    fx, fy = (face[0] + face[2]) / 2 / step, (face[1] + face[3]) / 2 / step

    best = (float("inf"), 1.0, 0.0, 0.0)
    raw_small = raw_full.convert("L").resize((pw, ph), Image.LANCZOS)
    for s in np.arange(0.94, 1.061, 0.01):
        for dx in range(-4, 5):
            for dy in range(-4, 5):
                moved = raw_small.transform(
                    (pw, ph),
                    Image.AFFINE,
                    (1 / s, 0, fx - fx / s + dx, 0, 1 / s, fy - fy / s + dy),
                    Image.BILINEAR,
                    fillcolor=0,
                )
                v = score_of(pg, np.asarray(moved, np.float32), mask)
                if v < best[0]:
                    best = (v, float(s), float(dx), float(dy))

    score, s, dx, dy = best
    dx, dy = dx * step, dy * step
    aligned = raw_full.transform(
        plate.size,
        Image.AFFINE,
        (1 / s, 0, face[0] / 2 + face[2] / 2 - (face[0] / 2 + face[2] / 2) / s + dx,
         0, 1 / s, face[1] / 2 + face[3] / 2 - (face[1] / 2 + face[3] / 2) / s + dy),
        Image.BILINEAR,
        fillcolor=0,
    )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    aligned.save(out)

    verdict = "ACCEPT" if score <= args.accept else "REJECT"
    print(
        f"{verdict}: drift {score:.2f} (limit {args.accept}), scale {s:.2f}, shift {dx:+.0f},{dy:+.0f} px"
        f" -> {out}"
    )

    if args.check:
        full_mask = mask_for((plate.size[1], plate.size[0]), eyes, args.grow, args.band, 1.0)
        vis = np.asarray(plate.convert("RGB"), np.uint8).copy()
        vis[full_mask] = (vis[full_mask] * 0.45 + np.array([0, 90, 0]) * 0.55).astype(np.uint8)
        suite = Image.new("RGB", (plate.size[0] * 3, plate.size[1]), (16, 16, 20))
        for i, im in enumerate((plate, aligned, Image.fromarray(vis))):
            suite.paste(im, (i * plate.size[0], 0))
        draw = ImageDraw.Draw(suite)
        x0, y0, x1, y1 = face
        for i in range(3):
            draw.rectangle(
                (i * plate.size[0] + x0, y0, i * plate.size[0] + x1, y1),
                outline=(0, 255, 0),
                width=3,
            )
        draw.text((12, 12), f"{verdict}  drift {score:.2f}", fill=(255, 255, 255))
        Path(args.check).parent.mkdir(parents=True, exist_ok=True)
        suite.save(args.check)

    return 0 if score <= args.accept else 1


if __name__ == "__main__":
    raise SystemExit(main())
