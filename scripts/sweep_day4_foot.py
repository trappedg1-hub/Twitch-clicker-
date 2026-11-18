#!/usr/bin/env python3
"""Sweep the transplant knobs (rotation / mirror / joint / scale) into one contact sheet.

The foot that has to be re-attached is her OWN from this same plate, so the only real question is how it
hangs: how far it rotates, which way it faces, and where the joint sits on her shin. This renders the
candidates side by side for one look, so the choice is made by eye on the art, not by guessing numbers.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import repair_day4_s1_toe as R  # noqa: E402

CROP = (860, 1180, 1024, 1500)
CANDIDATES = [
    {"tag": "A rot78 mirror", "ROT_DEG": 78.0, "MIRROR": True, "SCALE": 0.72, "LEG_END": (992, 1292)},
    {"tag": "B rot95 mirror", "ROT_DEG": 95.0, "MIRROR": True, "SCALE": 0.72, "LEG_END": (986, 1290)},
    {"tag": "C rot78 plain", "ROT_DEG": 78.0, "MIRROR": False, "SCALE": 0.72, "LEG_END": (992, 1292)},
    {"tag": "D rot105 plain", "ROT_DEG": 105.0, "MIRROR": False, "SCALE": 0.70, "LEG_END": (996, 1288)},
    {"tag": "E rot95 mirror small", "ROT_DEG": 95.0, "MIRROR": True, "SCALE": 0.64, "LEG_END": (988, 1286)},
    {"tag": "F rot112 mirror", "ROT_DEG": 112.0, "MIRROR": True, "SCALE": 0.70, "LEG_END": (996, 1288)},
]


def render(base: np.ndarray, cfg: dict) -> Image.Image:
    for k, v in cfg.items():
        if k != "tag":
            setattr(R, k, v)
    return Image.fromarray(R._flatten(R.repair_foot(base))).crop(CROP)


def main() -> None:
    base = np.array(Image.open(R.ROOT / "public/art/heroine_t4_s1.png").convert("RGBA"))
    tiles = [render(base, cfg) for cfg in CANDIDATES]
    w, h = tiles[0].size
    sheet = Image.new("RGB", (w * 3 + 40, h * 2 + 20), (28, 24, 32))
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % 3) * (w + 10), (i // 3) * (h + 10)))
    sheet = sheet.resize((sheet.width * 2 // 3, sheet.height * 2 // 3), Image.Resampling.LANCZOS)
    out = R.QA / "toe_sweep.png"
    out.parent.mkdir(exist_ok=True)
    sheet.save(out)
    print(f"wrote {out} :: " + " | ".join(c["tag"] for c in CANDIDATES))


if __name__ == "__main__":
    main()
