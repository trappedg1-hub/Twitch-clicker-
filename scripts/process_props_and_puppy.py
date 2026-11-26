#!/usr/bin/env python3
"""
Alpha-mattes and normalizes all 10 Korean-manhwa desk microphone tiers (mic_t1..mic_t10.webp)
and builds a 12-frame looping transparent animated WebP Shiba Inu donation mascot (alert_puppy.webp).
"""
import math
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "art-studio" / "raw"
MICS_OUT = ROOT / "public" / "art" / "mics"
ART_OUT = ROOT / "public" / "art"
QA_DIR = ROOT / ".qa-out"


def matte_from_border_bg(rgb: np.ndarray, low_thr: float = 18.0, high_thr: float = 42.0, spill_suppress: bool = False) -> np.ndarray:
    """Extracts clean anti-aliased RGBA from uniform border color, keeping interior holes clean."""
    h, w, _ = rgb.shape
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)

    border = np.concatenate([
        lab[0:14, :, :].reshape(-1, 3),
        lab[h - 14:h, :, :].reshape(-1, 3),
        lab[:, 0:14, :].reshape(-1, 3),
        lab[:, w - 14:w, :].reshape(-1, 3),
    ], axis=0)
    bg_med = np.median(border, axis=0)

    dist = np.linalg.norm(lab - bg_med, axis=2)
    is_bg_seed = (dist < low_thr).astype(np.uint8)

    # Exterior flood + enclosed bg holes (e.g. shockmount / tripod gaps)
    num_l, labels, stats, _ = cv2.connectedComponentsWithStats(is_bg_seed, connectivity=8)
    bg_mask = np.zeros((h, w), dtype=np.uint8)
    border_labels = set(labels[0, :]) | set(labels[h - 1, :]) | set(labels[:, 0]) | set(labels[:, w - 1])
    for lbl in range(1, num_l):
        if lbl in border_labels:
            bg_mask[labels == lbl] = 1
        else:
            area = stats[lbl, cv2.CC_STAT_AREA]
            if area >= 28:
                comp = labels == lbl
                if float(dist[comp].mean()) < (low_thr * 0.78):
                    bg_mask[comp] = 1

    # Smooth feather along boundary
    alpha = np.clip((dist - low_thr * 0.75) / (high_thr - low_thr * 0.75), 0.0, 1.0)
    solid_fg = (bg_mask == 0).astype(np.float32)
    solid_fg = cv2.erode(solid_fg, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=1)
    alpha = np.maximum(alpha * (1.0 - bg_mask * 0.85), solid_fg)
    alpha[bg_mask == 1] = np.clip((dist[bg_mask == 1] - low_thr) / (high_thr - low_thr), 0.0, 1.0)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0.6)
    alpha[alpha < 0.04] = 0.0
    alpha[alpha > 0.97] = 1.0

    out_rgb = rgb.astype(np.float32).copy()
    if spill_suppress:
        # Remove green/teal spill on semi-transparent fringe pixels
        fringe = (alpha > 0.0) & (alpha < 0.92)
        g_excess = np.maximum(0.0, out_rgb[:, :, 1] - np.maximum(out_rgb[:, :, 0], out_rgb[:, :, 2]))
        out_rgb[:, :, 1][fringe] -= g_excess[fringe] * 0.85

    rgba = np.dstack([np.clip(out_rgb, 0, 255).astype(np.uint8), (alpha * 255.0).round().astype(np.uint8)])
    return rgba


def crop_and_pad_bottom_anchored(rgba: np.ndarray, out_w: int = 280, out_h: int = 340, pad_bottom: int = 10) -> Image.Image:
    """Crops tight bounding box of the prop and anchors its base cleanly near bottom-center."""
    ys, xs = np.where(rgba[:, :, 3] > 20)
    y1, y2 = int(ys.min()), int(ys.max())
    x1, x2 = int(xs.min()), int(xs.max())
    cropped = Image.fromarray(rgba[y1:y2 + 1, x1:x2 + 1], "RGBA")

    avail_w = out_w - 28
    avail_h = out_h - pad_bottom - 18
    scale = min(avail_w / cropped.width, avail_h / cropped.height)
    nw = max(1, int(round(cropped.width * scale)))
    nh = max(1, int(round(cropped.height * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    px = (out_w - nw) // 2
    py = out_h - pad_bottom - nh
    canvas.alpha_composite(resized, (px, py))
    return canvas


def synthesize_tier10_gold_vip(t6_rgba: np.ndarray) -> np.ndarray:
    """Crafts Tier 10 Gold VIP Vacuum-Tube Studio Microphone from Tier 6 condenser + warm amber tube glow."""
    rgba = t6_rgba.copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3:4].astype(np.float32) / 255.0
    h, w, _ = rgb.shape

    # Convert silver/metal highlights into rich champagne-gold while keeping dark ink lineart & black pop-mesh crisp
    lum = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]) / 255.0
    sat = (rgb.max(axis=2) - rgb.min(axis=2)) / (rgb.max(axis=2) + 1e-4)

    # Mid-to-bright metallic parts become luxurious brushed gold
    metal_mask = ((lum > 0.24) & (alpha[:, :, 0] > 0.2)).astype(np.float32)
    metal_mask = cv2.GaussianBlur(metal_mask, (5, 5), 1.0)

    gold_r = np.clip(lum * 295.0 + 28.0, 0, 255)
    gold_g = np.clip(lum * 228.0 + 10.0, 0, 242)
    gold_b = np.clip(lum * 120.0, 0, 165)
    gold_rgb = np.dstack([gold_r, gold_g, gold_b])

    blended = rgb * (1.0 - metal_mask[:, :, None] * 0.85) + gold_rgb * (metal_mask[:, :, None] * 0.85)

    # Add warm glowing amber vacuum-tube core on upper capsule + soft VIP golden aura
    ys, xs = np.where(rgba[:, :, 3] > 40)
    cy = int(ys.min() + (ys.max() - ys.min()) * 0.30)
    cx = int((xs.min() + xs.max()) * 0.5)

    yy, xx = np.mgrid[0:h, 0:w]
    tube_glow = np.exp(-(((xx - cx) / (w * 0.055)) ** 2 + ((yy - cy) / (h * 0.075)) ** 2))
    aura_glow = np.exp(-(((xx - cx) / (w * 0.22)) ** 2 + ((yy - cy) / (h * 0.24)) ** 2)) * 0.32

    blended[:, :, 0] = np.clip(blended[:, :, 0] + tube_glow * 145.0 * alpha[:, :, 0], 0, 255)
    blended[:, :, 1] = np.clip(blended[:, :, 1] + tube_glow * 82.0 * alpha[:, :, 0], 0, 255)
    blended[:, :, 2] = np.clip(blended[:, :, 2] + tube_glow * 18.0 * alpha[:, :, 0], 0, 255)

    # Subtle outer warm halo behind capsule
    halo_alpha = np.clip(rgba[:, :, 3].astype(np.float32) / 255.0 + aura_glow * 0.55, 0.0, 1.0)
    halo_tint = np.zeros_like(blended)
    halo_tint[:, :, 0] = 255.0
    halo_tint[:, :, 1] = 195.0
    halo_tint[:, :, 2] = 75.0
    only_halo = np.clip(halo_alpha - alpha[:, :, 0], 0.0, 1.0)[:, :, None]
    final_rgb = np.clip(blended * alpha + halo_tint * only_halo, 0, 255) / np.maximum(halo_alpha[:, :, None], 1e-4)
    final_rgb[halo_alpha < 0.02] = 0

    return np.dstack([np.clip(final_rgb, 0, 255).astype(np.uint8), (halo_alpha * 255.0).round().astype(np.uint8)])


def draw_heart(draw: ImageDraw.ImageDraw, cx: float, cy: float, size: float, fill: tuple[int, int, int, int]) -> None:
    pts = []
    for i in range(28):
        t = (i / 28.0) * 2.0 * math.pi
        hx = 16 * (math.sin(t) ** 3)
        hy = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + hx * size * 0.055, cy + hy * size * 0.055))
    draw.polygon(pts, fill=fill)


def build_animated_puppy() -> list[Image.Image]:
    """Creates a 12-frame looping transparent animated WebP of the Shiba puppy bouncing & tossing hearts."""
    raw = np.array(Image.open(RAW_DIR / "alert_puppy_f1.png").convert("RGB"))
    rgba = matte_from_border_bg(raw, low_thr=22.0, high_thr=48.0, spill_suppress=True)
    # Keep only the main puppy silhouette component (removes any tiny stray outline flecks)
    fg_bin = (rgba[:, :, 3] > 20).astype(np.uint8)
    n_cc, cc_lbl, cc_stats, _ = cv2.connectedComponentsWithStats(fg_bin, connectivity=8)
    if n_cc > 1:
        largest_lbl = 1 + int(np.argmax(cc_stats[1:, cv2.CC_STAT_AREA]))
        keep = (cc_lbl == largest_lbl)
        keep_soft = cv2.dilate(keep.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        rgba[:, :, 3] = rgba[:, :, 3] * keep_soft
    ys, xs = np.where(rgba[:, :, 3] > 24)
    crop = Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], "RGBA")

    size = 168
    avail = 132
    sc = min(avail / crop.width, avail / crop.height)
    base_pup = crop.resize((int(crop.width * sc), int(crop.height * sc)), Image.Resampling.LANCZOS)

    frames: list[Image.Image] = []
    n_frames = 12
    for i in range(n_frames):
        phase = (i / n_frames) * 2.0 * math.pi
        # Happy double-bounce + cute playful head/body tilt
        bounce_y = -abs(math.sin(phase)) * 10.0
        squash_x = 1.0 + math.cos(phase * 2.0) * 0.035
        squash_y = 1.0 - math.cos(phase * 2.0) * 0.035
        tilt_deg = math.sin(phase) * 5.5

        pw = max(1, int(round(base_pup.width * squash_x)))
        ph = max(1, int(round(base_pup.height * squash_y)))
        pup_frame = base_pup.resize((pw, ph), Image.Resampling.BICUBIC).rotate(
            tilt_deg, resample=Image.Resampling.BICUBIC, expand=True
        )

        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        px = (size - pup_frame.width) // 2
        py = int(round(size - 8 - pup_frame.height + bounce_y))
        canvas.alpha_composite(pup_frame, (px, py))

        # Floating Twitch pink & gold hearts rising around the happy puppy
        heart_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(heart_layer)
        for h_idx, (bx, col, off) in enumerate([
            (26.0, (255, 92, 176), 0.0),
            (142.0, (255, 213, 79), 0.42),
            (126.0, (191, 148, 255), 0.75),
        ]):
            p = (i / n_frames + off) % 1.0
            hy = 92.0 - p * 68.0
            hx = bx + math.sin(p * math.pi * 2.0 + h_idx) * 6.0
            alpha_h = int(255 * math.sin(p * math.pi))
            h_size = 7.5 + math.sin(p * math.pi) * 3.5
            draw_heart(draw, hx, hy, h_size, (col[0], col[1], col[2], alpha_h))

        canvas.alpha_composite(heart_layer)
        frames.append(canvas)

    out_webp = ART_OUT / "alert_puppy.webp"
    frames[0].save(
        out_webp,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=75,
        loop=0,
        quality=90,
        method=4,
    )
    print(f"Saved animated transparent puppy mascot: {out_webp} ({out_webp.stat().st_size // 1024} KB, {len(frames)} frames)")
    return frames


def main() -> None:
    MICS_OUT.mkdir(parents=True, exist_ok=True)
    QA_DIR.mkdir(parents=True, exist_ok=True)

    mic_canvases: list[Image.Image] = []
    t6_rgba_cache: np.ndarray | None = None

    for tier in range(1, 10):
        raw_path = RAW_DIR / f"mic_t{tier}.png"
        rgb = np.array(Image.open(raw_path).convert("RGB"))
        rgba = matte_from_border_bg(rgb, low_thr=17.0, high_thr=40.0, spill_suppress=True)
        if tier == 6:
            t6_rgba_cache = rgba
        canvas = crop_and_pad_bottom_anchored(rgba)
        out_path = MICS_OUT / f"mic_t{tier}.webp"
        canvas.save(out_path, "WEBP", quality=90, method=6)
        mic_canvases.append(canvas)
        print(f"Saved {out_path.name} ({out_path.stat().st_size // 1024} KB)")

    assert t6_rgba_cache is not None
    t10_rgba = synthesize_tier10_gold_vip(t6_rgba_cache)
    t10_canvas = crop_and_pad_bottom_anchored(t10_rgba)
    t10_path = MICS_OUT / "mic_t10.webp"
    t10_canvas.save(t10_path, "WEBP", quality=92, method=6)
    mic_canvases.append(t10_canvas)
    print(f"Saved {t10_path.name} ({t10_path.stat().st_size // 1024} KB)")

    pup_frames = build_animated_puppy()

    # Build visual QA contact sheet on dark wooden desk background to verify alpha matting!
    sheet = Image.new("RGBA", (280 * 5, 340 * 2 + 190), (28, 22, 26, 255))
    for idx, mc in enumerate(mic_canvases):
        col = idx % 5
        row = idx // 5
        sheet.alpha_composite(mc, (col * 280, row * 340))
    for idx, pf in enumerate(pup_frames[:6]):
        sheet.alpha_composite(pf, (idx * 200 + 40, 340 * 2 + 10))

    qa_path = QA_DIR / "qa_mics_and_puppy_sheet.png"
    sheet.convert("RGB").save(qa_path)
    print(f"Saved QA sheet: {qa_path}")


if __name__ == "__main__":
    main()
