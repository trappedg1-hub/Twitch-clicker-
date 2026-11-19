#!/usr/bin/env python3
"""Day 5 «5 бикини стрим» — four approved bikini frames cut into the shared plate geometry.

The keying, decontamination, grade and sharpen passes are the Day-3 ones (imported, not copied), and the
fit rule is the Day-4 one: her head lands on row 88 and everything that overflows below plate row 1489
sinks behind `fg_desk_t1`. Day 5 is the first day where that band is not an accident but the composition:
the approved four frames were drawn FOR the stream camera (close, front-on, her feet and hips crowding the
near frame), so the plank hiding the chair base is what the raw is built around.

    raw render (2:3, flat plum background, ≥ 70 px of field at both side edges)
      -> key + trim (process_day3_ghost_arts)
      -> uniform scale about the plate bottom until her head sits on HEAD_TARGET
      -> horizontal centring on her own bbox
      -> head-cap measurement, printed for src/heroine/faceAnchors.ts

No flash plate on Day 5. Days 3 and 4 each had one «Бу!»/«Готово?» crossfade because their payoff was a
single reveal frame; here the ladder IS the reveal and we have exactly four approved drawings — inventing a
fifth to fill a slot would put unapproved art on screen, so `StreamStage` loads Day 5 without a flash and
`HeroineRig.triggerGhostBoo()` returns false on this day (the caller then skips the flash-specific noise).

Per-frame knobs live in LEG_SHIFT_Y / EXTRA_SCALE so a re-cut is a one-number edit, not a rewrite.

    LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp python3 scripts/process_day5_frames.py
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
    decontaminate,
    drop_hairlines,
    grade,
    sharpen,
    trim_shadow_debris,
)
from process_day4_frames import centre_horizontally, fit_head_row, fit_report  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "art-studio/raw"
PLATES = ROOT / "public/art"
QA = ROOT / ".qa-out"

# game stage -> approved raw. Sub-goal order is his, tile numbers off the batch-30 review sheet:
# «1 генерация это саб гол 1, 4 — саб гол 2, 3 — саб гол 3, 5 — саб гол 4».
FRAMES: dict[str, str] = {
    # 0 — старт дня: она в кресле, одна нога вытянута к вебке, стопа крупнее головы
    "heroine_t5_s0": "t5_t118_bikini_feetcam_H.png",
    # 1 (33000) — обе ноги перекинуты через подлокотник, ступни внизу кадра, руки на лодыжке
    "heroine_t5_s1": "t5_t124_bikini_feetcam_J.png",
    # 2 (40000) — «кошечка» на сиденье, три четверти сзади, голова через плечо
    "heroine_t5_s2": "t5_t123_bikini_cat_square_E.png",
    # 3 (47000) — финал: тот же разворот, но бёдра full-on в кадр, шпилька висит на ремешке
    "heroine_t5_s3": "t5_t125_bikini_cat_square_F.png",
}

# Vertical slide in plate rows, applied AFTER the head fit (positive = down). Empty unless a frame is
# measured to stop short of the plank band.
LEG_SHIFT_Y: dict[str, int] = {}
# Last-resort uniform scale multiplier on top of the head fit (1.00 = leave it alone).
EXTRA_SCALE: dict[str, float] = {}
# Frames whose pose legitimately ends above the plank. None on Day 5: every frame is seated on the
# chair, so the chair base always runs down into the plank band.
FLOOR_EXEMPT: set[str] = set()

# Rows of the keyed plate that count as "the head cap" for the faceAnchor measurement: from HEAD_TARGET
# down to the chin/shoulder line on the approved frames. Day 5 paints its own expression into every
# frame — and two of the four show her back — so these boxes are debug-overlay only (all four plates are
# listed in FACE_PATCH_COVERED_PLATES).
HEAD_CAP_ROWS = 300


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB")).astype(np.float32)


def measure_head_cap(arr: np.ndarray, stage: str) -> tuple[int, int, int, int]:
    """(x, y, w, h) of the head region, measured as the alpha bbox of the top HEAD_CAP_ROWS band."""
    al = arr[:, :, 3]
    rows = np.nonzero((al > 8).sum(axis=1) > 2)[0]
    if rows.size == 0:
        raise SystemExit(f"{stage}: empty plate, nothing to measure")
    top = int(rows.min())
    band = al[top : min(PLATE_H, top + HEAD_CAP_ROWS), :]
    cols = np.nonzero((band > 8).sum(axis=0) > 2)[0]
    if cols.size == 0:
        raise SystemExit(f"{stage}: the head band is empty")
    x, right = int(cols.min()), int(cols.max())
    box = (x, top, right - x + 1, min(PLATE_H, top + HEAD_CAP_ROWS) - top)
    print(f"  {stage}: head cap {box} (debug overlay only; plate is patch-covered)")
    return box


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
    anchors: dict[str, tuple[int, int, int, int]] = {}
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
            prem = cv2.remap(
                arr[:, :, :3].astype(np.float32) * a, map_x, map_y, cv2.INTER_LANCZOS4,
                borderMode=cv2.BORDER_CONSTANT, borderValue=0,
            )
            aa = cv2.remap(
                a[:, :, 0], map_x, map_y, cv2.INTER_LANCZOS4,
                borderMode=cv2.BORDER_CONSTANT, borderValue=0,
            )
            aa = np.clip((aa * 255.0 - 70.0) * (255.0 / 150.0), 0.0, 255.0)
            nz = np.where(aa / 255.0 > 1e-3, aa / 255.0, 1.0)
            rescaled = np.empty_like(arr)
            rescaled[:, :, 3] = aa.astype(arr.dtype)
            rescaled[:, :, :3] = np.clip(prem / nz[..., None], 0, 255).astype(arr.dtype)
            arr = rescaled
        arr = fit_head_row(arr, stage)
        arr = centre_horizontally(arr, stage)
        # Crisp first, place second (the Day-3 rule): a slide only moves whole rows.
        arr = sharpen(arr)
        shift = LEG_SHIFT_Y.get(stage, 0)
        if shift:
            arr = (
                np.concatenate([np.zeros((shift, PLATE_W, 4), dtype=arr.dtype), arr[:-shift]], axis=0)
                if shift > 0
                else np.concatenate([arr[-shift:], np.zeros((-shift, PLATE_W, 4), dtype=arr.dtype)], axis=0)
            )
        fit_report(arr, stage)
        anchors[stage] = measure_head_cap(arr, stage)
        plate = Image.fromarray(arr, "RGBA")
        plate.save(PLATES / f"{stage}.png")
        plate.save(PLATES / f"{stage}.webp", "WEBP", quality=96, method=6)
        print(
            f"{stage}: {src.name} bg={tuple(int(v) for v in bg.round(0))} "
            f"alpha kept {float(alpha.mean()):.3f} stray-rule px {erased} debris px {debris}"
        )
        tiles.append(grid(plate))

    w, h = tiles[0].size
    sheet = Image.new("RGB", (w * len(tiles), h), (28, 24, 32))
    for i, t in enumerate(tiles):
        sheet.paste(t, (i * w, 0))
    sheet = sheet.resize((w * len(tiles) // 3, h // 3), Image.Resampling.LANCZOS)
    sheet.save(QA / "day5_frames_grid.png")
    print(f"wrote {QA / 'day5_frames_grid.png'}")
    print("\nfaceAnchors.ts block (paste by hand — Day 3/4 boxes live in the same object):")
    for stage, (x, y, bw, bh) in anchors.items():
        print(f'  "heroine_{stage.split("heroine_")[-1]}.webp": {{ x: {x}, y: {y}, w: {bw}, h: {bh} }},')


if __name__ == "__main__":
    main()
