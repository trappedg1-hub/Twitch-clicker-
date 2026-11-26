#!/usr/bin/env python3
"""Day 6 «Деревенская девочка» — four approved village frames cut into the shared plate geometry.

Keying, decontamination, grade and sharpen are the Day-3 passes (imported, never copied) and the fit rule
is the Day-4 one: her head lands on row 88 and whatever overflows below the desk plank sinks behind it.
Day 6 adds one thing the earlier days did not need, because the finale frame is BUILT on the desk:

    DESK_TOP = 1489 — the plate row where `fg_desk_t1`'s wood begins (virtual y=708 via the 482x722 box
    at y=11, see StreamStage.MIC_BASE_Y). For the finale we slide her so her LAST content row lands right
    on that line: her heels then rest ON the plank. Every other day-6 stage is slid to the plate's last
    row (the Day-6 rule from `day6_plate_proof.py`), which buries the chair base behind the wood.

That difference is the whole reason the finale looks like she put her feet on the viewer's desk instead of
floating them in plum: the plate and the foreground desk are cut from one coordinate system, so the contact
line has to be computed, not eyeballed.

    raw render (2:3, flat plum field, ≥ 70 px of field at both side edges)
      -> key + trim (process_day3_ghost_arts)
      -> bottom slide (to the last row, or to DESK_TOP for the feet-on-desk finale)
      -> uniform scale about the plate bottom until her head sits on HEAD_TARGET
      -> horizontal centring on her own bbox
      -> head-cap measurement, printed for src/heroine/faceAnchors.ts

No flash plate on Day 6: the payoff of the day is the finale frame itself (feet in butter, corn in her
hands), so `DAY6_FLASH_PLATE` is null and `HeroineRig.triggerGhostBoo()` returns false on this day.

    LD_LIBRARY_PATH=/tmp/al2023/lib:/tmp python3 scripts/process_day6_frames.py
"""

from __future__ import annotations

import sys
from pathlib import Path

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

# game stage -> approved raw. He graded them one by one: «4 арт approved для начала дня»,
# «2 генерацию утверждаю для 2 саб гоала», «1 генерация approved для саб гола 3» (t147, not t148) and
# «вторая генерация для саб 4 approved» (the all-in-one butter frame, so the lineart never went through
# a re-render).
FRAMES: dict[str, str] = {
    # 0 — старт дня: глубоко в кресле, обе лямки спущены, шляпа на один глаз, шлепки на ногах
    "heroine_t6_s0": "t6_t136_village_finale_D.png",
    # 1 (54000) — лямки застёгнуты, огурец в двух руках касается щеки
    "heroine_t6_s1": "t6_t141_village_cucumber_toolong_I.png",
    # 2 (61000) — половина огурца во рту, руки подняты и пусты, один шлепок висит на ноге
    "heroine_t6_s2": "t6_t147_village_cucumber_chair_E.png",
    # 3 (68000) — финал: ноги вытянуты в кадр, обе ступни в масле, початок у груди
    "heroine_t6_s3": "t6_t207_village_feet_desk_cross_A.png",
}

# The top of the foreground wood (see the module docstring). Stages listed here stop AT the plank line so
# their lowest thing — the finale's heels — reads as resting on the desk instead of sunk behind it.
DESK_TOP = 1489
FEET_ON_DESK: set[str] = {"heroine_t6_s3"}

# Vertical slide in plate rows, applied AFTER the head fit (positive = down). Empty unless a re-cut needs
# a nudge; the bottom slide above is what normally places her.
LEG_SHIFT_Y: dict[str, int] = {}
# Last-resort uniform scale multiplier on top of the head fit (1.00 = leave it alone).
EXTRA_SCALE: dict[str, float] = {}


def load_rgb(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB")).astype(np.float32)


def slide_to_bottom(arr: np.ndarray, stage: str) -> np.ndarray:
    """Move her DOWN so her last content row lands on the plate's last row — or on the desk line.

    `fit_head_row` scales about the plate's bottom edge and zeroes everything below the figure's last
    content row, so a raw framed with a band of empty field under the chair leaves her base above the
    plank and she floats. The lever is to slide her down BEFORE the head fit: the fit then takes a zoom
    > 1 instead of shrinking her, the head still lands on the shared row, and the base reaches the wood.
    Never slide so far that her hat leaves the canvas — the head needs room above it.
    """
    rows = np.nonzero((arr[:, :, 3] > 8).sum(axis=1) > 2)[0]
    if rows.size == 0:
        raise SystemExit(f"{stage}: keyed plate is empty — the background flood ate the figure")
    head, last = int(rows.min()), int(rows.max())
    h_last = arr.shape[0] - 1
    cap = max(0, head - 8)
    if stage in FEET_ON_DESK:
        # Solve the slide so the bottom-anchored head fit leaves her on the wood line: the fit maps row r
        # to (r - h_last)/scale + h_last with scale = (h_last-HEAD)/(h_last-head'), so the last row lands
        # on DESK_TOP when h_last - (last + d) = (h_last - DESK_TOP)/scale.
        d = 0.0
        for _ in range(40):
            scale = (h_last - HEAD_TARGET) / (h_last - (head + d))
            want = h_last - (h_last - DESK_TOP) / scale
            nxt = min(max(want - last, 0.0), float(cap))
            if abs(nxt - d) < 0.01:
                d = nxt
                break
            d = nxt
        dead = int(round(d))
        label = f"heels on the desk line (row {DESK_TOP})"
    else:
        dead = min(max(h_last - last, 0), cap)
        label = "chair base reaches the plate's last row"
    if dead <= 0:
        return arr
    arr = np.roll(arr, dead, axis=0)
    arr[:dead] = 0
    print(f"  {stage}: slid her {dead} rows down so the {label}")
    return arr


def measure_head_cap(arr: np.ndarray, stage: str, rows_band: int = 300) -> tuple[int, int, int, int]:
    """(x, y, w, h) of the head region, measured as the alpha bbox of the top band under the head row."""
    al = arr[:, :, 3]
    rows = np.nonzero((al > 8).sum(axis=1) > 2)[0]
    if rows.size == 0:
        raise SystemExit(f"{stage}: empty plate, nothing to measure")
    top = int(rows.min())
    band = al[top : min(PLATE_H, top + rows_band), :]
    cols = np.nonzero((band > 8).sum(axis=0) > 2)[0]
    if cols.size == 0:
        raise SystemExit(f"{stage}: the head band is empty")
    x, right = int(cols.min()), int(cols.max())
    box = (x, top, right - x + 1, min(PLATE_H, top + rows_band) - top)
    print(f"  {stage}: head cap {box} (debug overlay only; the plate paints its own face)")
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
            import cv2  # local import: only the manual-scale escape hatch needs it

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
        arr = slide_to_bottom(arr, stage)
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
        body = np.nonzero((arr[60:1480, :, 3] > 8).sum(axis=0) > 2)[0]
        if body.size:
            print(
                f"  {stage}: side margins {int(body.min())} px left / {int(arr.shape[1] - 1 - body.max())}"
                " px right at the body rows"
            )
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
    sheet.save(QA / "day6_frames_grid.png")
    print(f"wrote {QA / 'day6_frames_grid.png'}")
    print("\nfaceAnchors.ts block (paste by hand — Day 3/4/5 boxes live in the same object):")
    for stage, (x, y, bw, bh) in anchors.items():
        print(f'  "heroine_{stage.split("heroine_")[-1]}.webp": {{ x: {x}, y: {y}, w: {bw}, h: {bh} }},')


if __name__ == "__main__":
    main()
