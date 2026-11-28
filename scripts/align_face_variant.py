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
   absolute difference over the band around the eyes minus the eye windows is that number; above
   the threshold the variant is rejected and the generation is retried, instead of silently shipped.
   It is measured on her skin only (see `SKIN_ACCEPT`): on a small face the band is mostly hair, and
   hair jitter both hides a redraw and fails an honest edit.

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

# Two numbers, both mean absolute luma difference 0-255 outside the windows the merge pastes.
#
# `band` is the original one: the 1.8x band around the eyes minus the pasted windows. It was
# calibrated on the large-face arts, where a matching generation scores 2.5-5.1 and a wrong frame
# 20-100. On a plate where the face is small it stops ordering anything: it lands mostly on hair
# strands next to the eyes, so `t4_s0` — whose patch is fine — scores 125, while a generation that
# shifted the whole face by six pixels can score 11. It is kept as a printed number, not a gate.
#
# `skin` is the gate: the same region, but only pixels that are skin on the plate, picked by colour
# and not only by brightness. On day 3 the fringe hangs right over the eyes and those strands are
# pale and bright, so a "luma > 95" mask counted hair as skin: an honest closed-eye edit of `t3_s2`
# scored 22.9 that way and 6.0 here. Skin = warm (R - B > 30) and not dark (luma > 90).
# Calibration on every raw that ships (30): 3.6-14.6. Generations that re-rendered her instead of
# closing her eyes: 22.3 / 46.2 / 76.5 under the old mask, 20-35 under this one.
# `transparent_s3` sits at 20.4 and stays a recorded exception: its closed lid crosses the ring.
ACCEPT = 5.5
SKIN_ACCEPT = 18.0
SKIN_LUMA = 90
SKIN_WARMTH = 30


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
    ap.add_argument("--accept", type=float, default=ACCEPT, help="band drift, printed; not the gate")
    ap.add_argument("--skin-accept", type=float, default=SKIN_ACCEPT, help="gate: drift on skin pixels")
    ap.add_argument("--skin-luma", type=int, default=SKIN_LUMA, help="plate luma above which a pixel counts as skin")
    ap.add_argument("--skin-warmth", type=int, default=SKIN_WARMTH, help="plate R-B above which a pixel counts as skin")
    ap.add_argument("--scale-lo", type=float, default=0.94, help="low end of the scale search")
    ap.add_argument("--scale-hi", type=float, default=1.06, help="high end of the scale search")
    # +-4 coarse steps of 3 px were enough for the day-1 plates. A 3/4 face generated from a wider
    # crop came back shifted by ~12 px, which is exactly the edge of that search: it reported
    # "shift +0,+0" and scored the misalignment as a redraw. The window is a knob, not a verdict.
    ap.add_argument("--shift", type=int, default=12, help="max shift searched, plate pixels")
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
    reach = max(1, round(args.shift / step))
    for s in np.arange(args.scale_lo, args.scale_hi + 1e-9, 0.01):
        for dx in range(-reach, reach + 1):
            for dy in range(-reach, reach + 1):
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

    # The gate: what changed on her skin, not on the hair next to it.
    full = mask_for((plate.size[1], plate.size[0]), eyes, args.grow, args.band, 1.0)
    plate_rgb = np.asarray(plate, np.float32)
    skin_mask = (
        full
        & (np.asarray(plate.convert("L"), np.float32) > args.skin_luma)
        & ((plate_rgb[..., 0] - plate_rgb[..., 2]) > args.skin_warmth)
    )
    if skin_mask.any():
        skin = score_of(
            np.asarray(plate.convert("L"), np.float32),
            np.asarray(aligned.convert("L"), np.float32),
            skin_mask,
        )
    else:
        skin = float("inf")
    ok = skin <= args.skin_accept
    verdict = "ACCEPT" if ok else "REJECT"
    print(
        f"{verdict}: skin {skin:.2f} (limit {args.skin_accept}), band {score:.2f}, "
        f"scale {s:.2f}, shift {dx:+.0f},{dy:+.0f} px -> {out}"
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
        draw.text((12, 12), f"{verdict}  skin {skin:.2f}  band {score:.2f}", fill=(255, 255, 255))
        Path(args.check).parent.mkdir(parents=True, exist_ok=True)
        suite.save(args.check)

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
