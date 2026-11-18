#!/usr/bin/env python3
"""Acceptance metrics for the Day-3 plates — the numbers behind each complaint about this art.

Run it after `scripts/process_day3_ghost_arts.py`. Every check is a thing the user has already
pointed at, so it is measured instead of remembered:

  cloth-cut   bright cloth pixels sitting ON the plate border. A sheet that runs off the raw ends as a
              straight vertical slice in mid-air once keyed — the "простыня обрезана" complaint.
  desk        her lowest body row vs the plank line (1489) + the 12 px margin that reads as contact.
              "ступни на столе" is a pixel rule, not a feeling.
  framing     the top row of her head: Days 1 and 2 sit at 87-89, and a plate that lands lower reads
              as a different camera, which is how a stage cut looks broken.
  halo rim    semi-transparent pixels per unit of silhouette contour, compared against the version of
              the same plate that is already committed. A resample that averages straight-alpha RGB
              leaves a coloured fringe ("фон плохо вырезан"); the rim may not get worse than shipped.
  style       mean luminance and near-black share, so a frame cannot come out milky or washed.

What this script cannot tell you is whether the bodysuit is the SAME garment from frame to frame — a
skin-row heuristic reads cloth folds as belly and goes to zero when a hand crosses the stomach, so the
garment check stays what it always was: scripts/day3_garment_sheet.py, looked at.

Exempt entries exist where a pose legitimately breaks a rule: three of the five frames are SEAT poses
(ghost cocoon, sheet off the torso, the finale squat), so their feet belong on the chair cushion and
can never reach the plank — they are listed as `seat`, not silently skipped.
"""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public/art"

PLANK, MARGIN = 1489, 12
HEAD_BAND = (87, 122)
DAY3 = ["heroine_t3_s0", "heroine_t3_s1", "heroine_t3_s2", "heroine_t3_s3", "heroine_t3_s4", "heroine_t3_flash"]
# Seat poses: her feet belong on the chair cushion, never on the plank (mirrors DESK_CONTACT_EXEMPT in
# scripts/process_day3_ghost_arts.py — keep the two in sync when a pose changes).
DESK_EXEMPT = {"heroine_t3_s0", "heroine_t3_s1", "heroine_t3_s4"}
# Rim softness and tone are compared to absolute bars, measured off the frames the user signed off on
# (max rim 5.23 on the all-fours plate, luminance 93-131 across days 1-2). A same-name baseline would
# be cleaner, but the source art gets re-rendered during a day's life and then the old numbers describe
# a different picture, which is how a correct plate used to fail and a wrong one pass.
SOFT_BAR = 6.0
LUM_BAR = (88, 135)
# Open defects, listed instead of hidden. The approved four-frame ladder was drawn wide on purpose, so
# nothing is empty right now: anything that touches a plate edge fails the run and has to be re-rendered
# with more air, not patched here.
KNOWN_CUT: set[str] = set()


def measure(img: np.ndarray) -> dict | None:
    if img is None or img.ndim != 3 or img.shape[2] < 4:
        return None
    b, g, r, a = (img[..., i].astype(np.int32) for i in range(4))
    rgb = img[..., :3]
    lum = 0.114 * b + 0.587 * g + 0.299 * r
    sat = np.max(rgb, 2).astype(np.int32) - np.min(rgb, 2).astype(np.int32)
    op = a > 8
    if not op.any():
        return None
    ys, xs = np.where(op)
    bright = (a > 200) & (lum > 150) & (sat < 46)
    body = (a > 200) & (lum > 70)
    brows = np.where(body.sum(1) > 12)[0]
    cnts, _ = cv2.findContours((a > 128).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    contour = sum(cv2.arcLength(c, True) for c in cnts)
    return dict(
        cut=int(bright[:, :3].sum() + bright[:, -3:].sum()),
        body_low=int(brows.max()) if brows.size else -1,
        head=int(ys.min()),
        soft=round(float(((a > 10) & (a < 245)).sum()) / max(1.0, contour), 3),
        lum=round(float(lum[op].mean()), 1),
        dark=round(float((lum[op] < 70).mean()), 3),
        bbox=(int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())),
    )


def read(path: Path) -> np.ndarray:
    # .webp first: that is the file the game loads, so the numbers describe what players see.
    for ext in (".webp", ".png"):
        img = cv2.imread(str(path.with_suffix(ext)), cv2.IMREAD_UNCHANGED)
        if img is not None:
            return img
    return None  # type: ignore[return-value]


def main() -> int:
    fails: list[str] = []
    print(f"{'plate':18s} {'cut':>5s} {'bodyLow':>7s} {'desk':>6s} {'head':>5s} {'rim':>6s} {'lum':>6s} {'dark':>5s}")
    for name in DAY3 + ["heroine_t1_s0", "heroine_t1_s4", "heroine_t2_s0"]:
        m = measure(read(ART / name))
        if m is None:
            fails.append(f"{name}: no readable plate")
            continue
        day3 = name in DAY3
        desk = (
            "n/a"
            if not day3
            else "seat"
            if name in DESK_EXEMPT
            else ("ok" if m["body_low"] >= PLANK + MARGIN else "FLOAT")
        )
        if day3 and desk == "FLOAT":
            fails.append(f"{name}: her body stops at row {m['body_low']}, {PLANK - m['body_low']} rows above the plank")
        if day3 and m["cut"] > 0 and name not in KNOWN_CUT:
            fails.append(f"{name}: {m['cut']} px of cloth touch the plate edge — the cut will show as a straight slice")
        if day3 and not HEAD_BAND[0] <= m["head"] <= HEAD_BAND[1]:
            fails.append(f"{name}: head starts at row {m['head']}, outside the {HEAD_BAND} framing band")
        if day3 and m["soft"] > SOFT_BAR:
            fails.append(f"{name}: rim softness {m['soft']:.3f} over the {SOFT_BAR} bar — fringe/halo risk")
        if day3 and not LUM_BAR[0] <= m["lum"] <= LUM_BAR[1]:
            fails.append(f"{name}: mean luminance {m['lum']} outside the {LUM_BAR} style window")
        rim = f"{m['soft']:.3f}"
        flag = "" if m["cut"] == 0 or name not in KNOWN_CUT else " (known)"
        print(f"{name:18s} {m['cut']:5d} {m['body_low']:7d} {desk:>6s} {m['head']:5d} {rim:>6s} {m['lum']:6.1f} {m['dark']:5.3f}{flag}")
    print()
    for f in fails:
        print("FAIL", f)
    if fails:
        return 1
    print("day3 plate QC: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
