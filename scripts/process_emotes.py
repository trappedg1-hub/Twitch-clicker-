#!/usr/bin/env python3
"""
Extracts clean 112x112 RGBA WebP Twitch/7TV chat emotes from solid white-background plates
with zero white halo on dark (#18181b) Twitch chat.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "art-studio" / "raw"
OUT_DIR = ROOT / "public" / "emotes"
QA_DIR = ROOT / ".qa-out"

EMOTES = [
    ("emote_pog.png", "pog.webp"),
    ("emote_booba.png", "booba.webp"),
    ("emote_peeposhy.png", "peeposhy.webp"),
    ("emote_monkas.png", "monkas.webp"),
    ("emote_kreygasm.png", "kreygasm.webp"),
    ("emote_ez.png", "ez.webp"),
    ("emote_lul.png", "lul.webp"),
    ("emote_miyalove.png", "miyalove.webp"),
    ("emote_nosebleed.png", "nosebleed.webp"),
    ("emote_awooga.png", "awooga.webp"),
    ("emote_overheat.png", "overheat.webp"),
    ("emote_clipit.png", "clipit.webp"),
]


def extract_emote_rgba(raw_path: Path, size: int = 112) -> Image.Image:
    im = Image.open(raw_path).convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.float32)

    # Near-white mask for outer flood fill
    brightness = rgb.min(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    near_white = ((brightness > 236) & (chroma < 22)).astype(np.uint8)

    h, w = near_white.shape
    num_labels, labels = cv2.connectedComponents(near_white, connectivity=8)

    border_labels = set()
    border_labels.update(labels[0, :].tolist())
    border_labels.update(labels[h - 1, :].tolist())
    border_labels.update(labels[:, 0].tolist())
    border_labels.update(labels[:, w - 1].tolist())
    border_labels.discard(0)

    bg_mask = np.isin(labels, list(border_labels)).astype(np.uint8)

    # Erode foreground mask slightly (dilate bg by 2px at 1024px res) and feather 1.5px
    # so zero white halo survives around the black contour!
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    bg_dilated = cv2.dilate(bg_mask, kernel, iterations=1)
    fg_float = 1.0 - bg_dilated.astype(np.float32)
    fg_smooth = cv2.GaussianBlur(fg_float, (5, 5), 1.0)
    alpha = np.clip(fg_smooth * 255.0, 0, 255).astype(np.uint8)

    out = arr.copy()
    out[:, :, 3] = alpha

    # Tight auto-crop to non-zero alpha
    ys, xs = np.where(alpha > 16)
    if len(xs) > 0 and len(ys) > 0:
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        y0, y1 = int(ys.min()), int(ys.max()) + 1
        bw, bh = x1 - x0, y1 - y0
        side = int(max(bw, bh) * 1.04)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        half = side // 2

        canvas = np.zeros((side, side, 4), dtype=np.uint8)
        sx0 = max(0, cx - half)
        sy0 = max(0, cy - half)
        sx1 = min(w, cx - half + side)
        sy1 = min(h, cy - half + side)
        dx0 = sx0 - (cx - half)
        dy0 = sy0 - (cy - half)
        canvas[dy0 : dy0 + (sy1 - sy0), dx0 : dx0 + (sx1 - sx0)] = out[sy0:sy1, sx0:sx1]
        cropped = Image.fromarray(canvas, mode="RGBA")
    else:
        cropped = Image.fromarray(out, mode="RGBA")

    return cropped.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    QA_DIR.mkdir(parents=True, exist_ok=True)

    rendered = []
    for src_name, dst_name in EMOTES:
        icon = extract_emote_rgba(RAW_DIR / src_name, 112)
        dst = OUT_DIR / dst_name
        icon.save(dst, "WEBP", quality=92, method=6)
        rendered.append((dst_name, icon))
        print(f"Saved {dst.name} ({dst.stat().st_size // 1024} KB)")

    # Build dark Twitch chat preview strip (both 112px zoom and real 28px chat size!)
    strip = Image.new("RGBA", (len(rendered) * 136 + 16, 190), (24, 24, 27, 255))
    for idx, (_, icon) in enumerate(rendered):
        x = 16 + idx * 136
        strip.alpha_composite(icon, (x, 14))
        small = icon.resize((28, 28), Image.Resampling.LANCZOS)
        strip.alpha_composite(small, (x + 42, 144))

    strip.save(QA_DIR / "qa_emotes_strip.png")
    print("Saved .qa-out/qa_emotes_strip.png")


if __name__ == "__main__":
    main()
