#!/usr/bin/env python3
"""Day 4 «Растяжка с Мией» — four approved yoga frames cut into the shared plate geometry.

The keying, decontamination, grade and sharpen passes are the Day-3 ones, imported rather than
copied: same plum backdrop, same plate box, same head row, and the day-to-day cut between the two
ladders has to be invisible. What is different is the FIT rule, because Day 4 is a floor-and-chair
day instead of a desk day:

    raw render (848..1696 wide, flat plum background, generous margin all round)
      -> key + trim, exactly as in process_day3_ghost_arts
      -> uniform scale about the plate bottom until her head sits on HEAD_TARGET (row 88): the head
         row is what the stage cut reads as "same actress, same camera", so it is the anchor
      -> horizontal centring on her own bbox, so a pose that leans right (foot up) is not pushed off
         the canvas by the re-scale
      -> the bottom is NOT forced to the canvas edge: anything that overflows lands under the desk
         plank (plate row 1489) and is hidden there, which is the same trick Day 3 used for the chair
         base; a standing frame must still reach the plank or float, and `fit_report` says which

Per-frame knobs live in LEG_SHIFT_Y / EXTRA_SCALE so a re-render is a one-number edit, not a rewrite.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from process_day3_ghost_arts import (  # noqa: E402  (same plumbing, one source of truth)
    HEAD_TARGET,
    PLATE_H,
    PLATE_W,
    alpha_for,
    drop_hairlines,
    decontaminate,
    grade,
    sharpen,
    trim_shadow_debris,
)

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "art-studio/raw"
PLATES = ROOT / "public/art"
QA = ROOT / ".qa-out"

# First plate row the desk plank covers (see the measurement in process_day3_ghost_arts); below this
# line the game paints foreground, so a chair caster or a cropped sock end there is invisible.
PLANK_TOP_ROW = 1489

# game stage -> approved raw. Every frame is its own finished render: no slicing, no patches.
FRAMES: dict[str, str] = {
    # 0 — opener: she unrolls the mat and pulls both arms overhead, still in the strapless knit
    "heroine_t4_s0": "t4_g1_strapless.png",
    # 1 (18000) — «Бёдра»: side split, extended leg up on the armrest, hip opened to the lens
    "heroine_t4_s1": "t4_g2_legup_B.png",
    # 2 (22000) — «Шпагат»: standing vertical split, foot at hair height, peace sign at the camera
    "heroine_t4_s2": "t4_g3_cling_I.png",
    # 3 (26000) — finale «Кресло»: sunk into the chair, shins hooked on the armrests, palms on her belly
    "heroine_t4_s3": "t4_g4_calf_G.png",
    # the «Готово?» flash reuses the finale frame — same gag as Day 3's «Бу!»: the crossfade hides the
    # stage swap, and the pose IS the payoff, so one drawing carries both
    "heroine_t4_flash": "t4_g4_calf_G.png",
}

# Vertical slide in plate rows, applied AFTER the head fit (positive = down). Chair poses overflow into
# the plank band on purpose; a standing frame that ends short of it gets a nudge, never a stretch.
LEG_SHIFT_Y: dict[str, int] = {}
# Last-resort uniform scale multiplier on top of the head fit (1.00 = leave it alone). Day 3 proved a
# hand-set factor is how toes get sawn off, so this stays empty unless a frame is measured wrong.
EXTRA_SCALE: dict[str, float] = {}
# Frames whose pose legitimately ends above the plank: none on Day 4 by default — she either stands on
# the floor or the chair base runs under the desk. Listed here so a seated frame can be excused with a
# printed warning instead of silently shipping a floating chair.
FLOOR_EXEMPT: set[str] = set()


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB")).astype(np.float32)


def fit_head_row(arr: np.ndarray, stage: str) -> np.ndarray:
    """Uniformly rescale the plate about its bottom edge until her head sits on HEAD_TARGET.

    Uniform on purpose (Day-3 lesson): a row stretch shears the legs, and the generator framed every
    Day-4 raw with a different margin, so the only stable anchor is her head. Scaling about the bottom
    keeps the floor contact where the raw put it instead of lifting her off it.
    """
    h, w = arr.shape[:2]
    rows = np.nonzero((arr[:, :, 3] > 8).sum(axis=1) > 2)[0]
    if rows.size == 0:
        raise SystemExit(f"{stage}: keyed plate is empty — the background flood ate the figure")
    head = int(rows.min())
    if head == HEAD_TARGET:
        return arr
    scale = (h - 1 - HEAD_TARGET) / (h - 1 - head)
    if not (0.55 < scale < 1.85):
        raise SystemExit(
            f"{stage}: the head fit needs scale {scale:.3f}, outside 0.55..1.85 — re-frame the raw "
            "with the figure larger or smaller instead of letting the pipeline distort her."
        )
    gx = np.arange(w, dtype=np.float32)
    gy = np.arange(h, dtype=np.float32)
    map_x, map_y = np.meshgrid((gx - w / 2) / scale + w / 2, (gy - (h - 1)) / scale + (h - 1))
    a = arr[:, :, 3:4].astype(np.float32) / 255.0
    prem = cv2.remap(
        arr[:, :, :3].astype(np.float32) * a, map_x, map_y, cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT, borderValue=0,
    )
    alpha = cv2.remap(
        a[:, :, 0], map_x, map_y, cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT, borderValue=0,
    )
    alpha = np.clip((alpha * 255.0 - 70.0) * (255.0 / 150.0), 0.0, 255.0)
    src_bottom = float(rows.max())
    src_y = (gy - (h - 1)) / scale + (h - 1)
    alpha[src_y > src_bottom + 0.5, :] = 0.0
    a2 = alpha / 255.0
    nz = np.where(a2 > 1e-3, a2, 1.0)
    out = np.empty_like(arr)
    out[:, :, 3] = alpha.astype(arr.dtype)
    out[:, :, :3] = np.clip(prem / nz[..., None], 0, 255).astype(arr.dtype)
    print(f"  {stage}: head row {head} -> {HEAD_TARGET} (scale {scale:.4f})")
    return out


def centre_horizontally(arr: np.ndarray, stage: str) -> np.ndarray:
    """Slide the plate so her own bbox sits on the canvas centre line.

    The plate box in `StreamStage` is fixed, so a raw that leans right (the side split throws one foot
    toward the webcam) would otherwise end up hugging the canvas edge after the head fit zoomed in.
    Only whole-image slides happen here, so nothing is resampled and no edge can smear.
    """
    cols = np.nonzero((arr[:, :, 3] > 8).sum(axis=0) > 2)[0]
    if cols.size == 0:
        return arr
    mid = (int(cols.min()) + int(cols.max())) / 2
    shift = int(round(arr.shape[1] / 2 - mid))
    if shift == 0:
        return arr
    out = np.roll(arr, shift, axis=1)
    # Whatever the slide pushes off the canvas is background, not her: fill it with zeros so no wrapped
    # column appears on the far edge.
    if shift > 0:
        out[:, :shift] = 0
    else:
        out[:, shift:] = 0
    print(f"  {stage}: centred by {shift:+d} px")
    return out


def fit_report(arr: np.ndarray, stage: str) -> None:
    """Head row, floor contact and edge safety, measured on the finished plate."""
    al = arr[:, :, 3]
    rows = np.nonzero((al > 8).sum(axis=1) > 2)[0]
    cols = np.nonzero((al > 8).sum(axis=0) > 2)[0]
    head, low = int(rows.min()), int(rows.max())
    left, right = int(cols.min()), int(cols.max())
    clipped = left <= 1 or right >= PLATE_W - 2 or low >= PLATE_H - 2
    print(
        f"  {stage}: head {head}, bottom {low} (plank hides >= {PLANK_TOP_ROW}), "
        f"x[{left}..{right}], coverage {float((al > 200).mean()):.3f}"
    )
    if head < 80:
        raise SystemExit(f"{stage}: her head starts at row {head}, above the 80-row safety line")
    if low < PLANK_TOP_ROW - 40 and stage not in FLOOR_EXEMPT:
        raise SystemExit(
            f"{stage}: the figure bottoms out at row {low}, {(PLANK_TOP_ROW - low)} rows above the desk "
            "plank — she would read as floating. Add a LEG_SHIFT_Y slide or re-frame the raw lower."
        )
    if clipped and stage not in FLOOR_EXEMPT:
        print(f"  {stage}: NOTE the silhouette touches a canvas edge — check the plate by eye")


def grid(im: Image.Image, step: int = 100) -> Image.Image:
    out = im.convert("RGB").copy()
    d = ImageDraw.Draw(out)
    w, h = out.size
    for x in range(0, w, step):
        d.line([(x, 0), (x, h)], fill=(255, 90, 90), width=1)
        d.text((x + 2, 2), str(x), fill=(255, 90, 90))
    for y in range(0, h, step):
        d.line([(0, y), (w, y)], fill=(90, 200, 255), width=1)
        d.text((2, y + 1), str(y), fill=(90, 200, 255))
    return out


def main() -> None:
    PLATES.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    tiles: list[Image.Image] = []
    for stage, fname in FRAMES.items():
        src = RAW / fname
        if not src.exists():
            sys.exit(f"missing raw render: {src}")
        rgb = load_rgb(src)
        alpha, bg = alpha_for(rgb)
        alpha, erased = drop_hairlines(alpha)
        alpha, debris = trim_shadow_debris(alpha, rgb, bg)
        clean = grade(decontaminate(rgb, alpha, bg))
        rgba = Image.fromarray(
            np.dstack([clean, np.clip(alpha * 255.0, 0, 255).astype(np.uint8)]), "RGBA"
        )
        if rgba.size != (PLATE_W, PLATE_H):
            rgba = rgba.resize((PLATE_W, PLATE_H), Image.Resampling.LANCZOS)
        arr = np.array(rgba)
        extra = EXTRA_SCALE.get(stage, 1.0)
        if extra != 1.0:
            h, w = arr.shape[:2]
            gx = np.arange(w, dtype=np.float32)
            gy = np.arange(h, dtype=np.float32)
            map_x, map_y = np.meshgrid(
                (gx - w / 2) / extra + w / 2, (gy - (h - 1)) / extra + (h - 1)
            )
            a = arr[:, :, 3:4].astype(np.float32) / 255.0
            prem = cv2.remap(arr[:, :, :3].astype(np.float32) * a, map_x, map_y, cv2.INTER_LANCZOS4,
                             borderMode=cv2.BORDER_CONSTANT, borderValue=0)
            aa = cv2.remap(a[:, :, 0], map_x, map_y, cv2.INTER_LANCZOS4,
                           borderMode=cv2.BORDER_CONSTANT, borderValue=0)
            aa = np.clip((aa * 255.0 - 70.0) * (255.0 / 150.0), 0.0, 255.0)
            nz = np.where(aa / 255.0 > 1e-3, aa / 255.0, 1.0)
            rescaled = np.empty_like(arr)
            rescaled[:, :, 3] = aa.astype(arr.dtype)
            rescaled[:, :, :3] = np.clip(prem / nz[..., None], 0, 255).astype(arr.dtype)
            arr = rescaled
        arr = fit_head_row(arr, stage)
        arr = centre_horizontally(arr, stage)
        # Sharpen after the geometry work, before any slide: a slide only moves whole rows, so the
        # crisp lines never get resampled twice (Day-3 comment: "Crisp first, place second").
        arr = sharpen(arr)
        shift = LEG_SHIFT_Y.get(stage, 0)
        if shift:
            arr = np.concatenate([np.zeros((shift, PLATE_W, 4), dtype=arr.dtype), arr[:-shift]], axis=0) \
                if shift > 0 else np.concatenate([arr[-shift:], np.zeros((-shift, PLATE_W, 4), dtype=arr.dtype)], axis=0)
        fit_report(arr, stage)
        plate = Image.fromarray(arr, "RGBA")
        plate.save(PLATES / f"{stage}.png")
        plate.save(PLATES / f"{stage}.webp", "WEBP", quality=96, method=6)
        print(
            f"{stage}: {src.name} bg={tuple(int(v) for v in bg.round(0))} "
            f"alpha kept {float(alpha.mean()):.3f} stray-rule px {erased} debris px {debris}"
        )
        if stage != "heroine_t4_flash":
            tiles.append(grid(plate))

    w, h = tiles[0].size
    sheet = Image.new("RGB", (w * len(tiles), h), (28, 24, 32))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * w, 0))
    sheet = sheet.resize((w * len(tiles) // 3, h // 3), Image.Resampling.LANCZOS)
    sheet.save(QA / "day4_frames_grid.png")
    print(f"wrote {QA / 'day4_frames_grid.png'}")


if __name__ == "__main__":
    main()
