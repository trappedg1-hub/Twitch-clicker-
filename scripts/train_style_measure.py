#!/usr/bin/env python3
"""Objective style metrics for a candidate art, measured the same way as the canon plates.

The scoring loop is the USER's taste — hotness and style closeness, 1..10 each, nothing replaces that.
What this script adds is the part taste cannot see from a thumbnail: whether the frame drifted in the one
axis that has been rejected over and over (skin hue), and whether the figure is cropped (the exact defect
that cost Day 4 its foot). Every number here is a mean/median over a colour gate, no clustering, no
scikit — the sandbox has cv2 + numpy only.

    python3 scripts/train_style_measure.py art-studio/raw/t5_*.png
    python3 scripts/train_style_measure.py --json art-studio/scores.json art-studio/raw/t5_*.png

Gates, all measured on the shipped plates first:
  skin   r>200, r-g in 14..60, g-b in 0..20      canon base #F4C9C3, G-B only +4..+6 (cool rose-grey)
  ink    mean(rgb) < 140                          canon line weight ~3 px at 1024 width
  bg     the border band                          canon is a FLAT plum field: std < 6, no light pool
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CANON = ROOT / "public/art/heroine_t1_base.png"  # falls back to the shipped .webp
PLUM = np.array((120, 92, 106), np.float32)  # the flat backdrop every plate was keyed against
# The zero of "drift" is measured, not asserted: canon t1_base's own median skin G-B. Hard-coding a
# prettier number here would flatter every candidate by the same offset.
CANON_SKIN_GB = None  # filled from the canon plate at start-up; falls back to 5.0 if the plate is absent
CANON_LINE = 3.1  # px, the half-width of her outline at 1024 width


def load_flat(path: Path) -> np.ndarray:
    """RGBA plates and RGB raws both become an RGB image over the plum field."""
    im = Image.open(path)
    if im.mode != "RGBA":
        return np.array(im.convert("RGB")).astype(np.float32)
    a = np.array(im).astype(np.float32)
    al = a[:, :, 3:4] / 255.0
    return np.clip(a[:, :, :3] * al + PLUM[None, None, :] * (1 - al), 0, 255)


def metrics(rgb: np.ndarray) -> dict:
    f = rgb.astype(np.float32)
    r, g, b = f[:, :, 0], f[:, :, 1], f[:, :, 2]
    skin = (r > 200) & ((r - g) >= 14) & ((r - g) <= 60) & ((g - b) >= 0) & ((g - b) <= 20)
    ink = f.mean(axis=2) < 140
    h, w = f.shape[:2]
    # subject = anything that differs from the flat plum field
    subj = (np.abs(f - PLUM[None, None, :]).sum(axis=2) > 45).astype(np.uint8)
    subj = cv2.morphologyEx(subj, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    subj = cv2.morphologyEx(subj, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(subj, 8)
    if n < 2:
        return {"error": "no subject found"}
    body = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    x, y, bw, bh = stats[body, :4]
    # the field is the outermost ring: in our recipe every raw keeps a generous empty margin, so a light
    # pool, a floor line or a gradient shows there, while the chair (content, mid-frame) does not
    band = np.concatenate(
        [f[:8].reshape(-1, 3), f[-8:].reshape(-1, 3), f[:, :8].reshape(-1, 3), f[:, -8:].reshape(-1, 3)]
    )
    field = band - np.median(band, axis=0)
    field = field.reshape(-1, 3)
    # line weight: the median width of an ink run along x, sampled every other row
    runs = []
    for row in range(int(y), min(int(y + bh), h), 2):
        xs = np.nonzero(ink[row])[0]
        if xs.size < 4:
            continue
        splits = np.split(xs, np.nonzero(np.diff(xs) > 1)[0] + 1)
        runs += [len(s) for s in splits if 1 <= len(s) <= 12]
    return {
        "size": [int(w), int(h)],
        "skin_px": int(skin.sum()),
        "skin_rgb": [round(float(v), 1) for v in np.median(f[skin], axis=0)] if skin.sum() > 500 else None,
        "skin_gb": round(float(np.median((g - b)[skin])), 1) if skin.sum() > 500 else None,
        "gb_drift": (round(float(np.median((g - b)[skin]) - canon_gb()), 1)) if skin.sum() > 500 else None,
        "ink_pct": round(float(ink.sum()) / (h * w) * 100, 2),
        "line_px": round(float(np.median(runs)), 2) if runs else None,
        "bg_std": round(float(field.std()) if field.size else 0.0, 2),
        "bg_95": round(float(np.percentile(band, 95)) if band.size else 0.0, 1),
        "bbox": [int(x), int(y), int(bw), int(bh)],
        "margin": [int(x), int(y), int(w - (x + bw)), int(h - (y + bh))],
        "touch": [t for t, v in (("left", x), ("top", y), ("right", w - (x + bw))) if v <= 1],
    "touch_bottom": int(h - (y + bh)) <= 1,
        "share_h": round(float(bh) / h, 3),
        "share_w": round(float(bw) / w, 3),
    }


def canon_gb() -> float:
    """The reference point every drift number is quoted against: canon's own median skin G-B."""
    global CANON_SKIN_GB
    if CANON_SKIN_GB is None:
        canon = CANON if CANON.exists() else CANON.with_suffix(".webp")
        CANON_SKIN_GB = float(np.median(measure_gb(load_flat(canon)))) if canon.exists() else 5.0
    return CANON_SKIN_GB


def measure_gb(rgb: np.ndarray) -> np.ndarray:
    f = rgb.astype(np.float32)
    r, g, b = f[:, :, 0], f[:, :, 1], f[:, :, 2]
    skin = (r > 200) & ((r - g) >= 14) & ((r - g) <= 60) & ((g - b) >= 0) & ((g - b) <= 20)
    return (g - b)[skin] if skin.sum() > 500 else np.array([7.0])


def flags(m: dict) -> list[str]:
    out = []
    if m.get("touch"):
        out.append(f"CROPPED: subject touches the {','.join(m['touch'])} edge — never ship a cropped figure")
    elif m.get("touch_bottom"):
        out.append("she reaches the bottom edge (only legal if the crop lands under the desk plank, row 1489)")
    gb = m.get("gb_drift")
    if gb is not None and gb > 14:
        out.append(f"skin is PEACH/TAN (G-B +{gb:.0f} over canon) — «не наша героиня», re-grade or reject")
    elif gb is not None and gb > 8:
        out.append(f"skin drifted warm (G-B +{gb:.0f})")
    if m["bg_std"] > 6.5:
        out.append(f"field not flat (std {m['bg_std']}, p95 {m['bg_95']}) — light pool / gradient / cast shadow")
    ln = m.get("line_px")
    if ln is not None and ln < 1.6:
        out.append(f"line too thin ({ln}px vs canon {CANON_LINE}px) — detail level of a thumbnail reference")
    if m["share_h"] < 0.72:
        out.append(f"figure only {m['share_h']:.0%} of the canvas height — the stage cut wants ~0.93")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+", type=Path)
    ap.add_argument("--json", type=Path, default=None, help="append the metrics into this scores ledger")
    args = ap.parse_args()
    rows = {}
    canon = CANON if CANON.exists() else CANON.with_suffix(".webp")
    if canon.exists():
        c = metrics(load_flat(canon))
        print(f"{'CANON t1_base (the zero)':28s} skin G-B +{c['skin_gb']:.1f} line {c['line_px']}px ink {c['ink_pct']}% bg {c['bg_std']}")
    for p in args.images:
        if not p.exists():
            print(f"{p.name:28s} MISSING")
            continue
        m = metrics(load_flat(p))
        fl = flags(m)
        gb = "n/a" if m["skin_gb"] is None else f"{m['skin_gb']:.1f}"
        print(
            f"{p.name:28s} skin G-B +{gb} line {m['line_px']}px ink {m['ink_pct']}%"
            f" bg {m['bg_std']} margins {m['margin']} h{m['share_h']:.2f}"
        )
        for f in fl:
            print(f"{'':4s}! {f}")
        rows[p.stem] = {**m, "flags": fl}
    if args.json:
        ledger = json.loads(args.json.read_text()) if args.json.exists() else {"batches": {}}
        batch = re.sub(r"^t(\d+)_.*", r"day\1", args.images[0].stem) if args.images else "misc"
        led = ledger.setdefault("measure", {}).setdefault(batch, {})
        led.update(rows)
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(ledger, indent=1, ensure_ascii=False))
        print(f"metrics -> {args.json.relative_to(ROOT)} [{batch}]")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
