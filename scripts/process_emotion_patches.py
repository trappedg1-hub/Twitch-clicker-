#!/usr/bin/env python3
"""
Extracts subpixel-aligned RGBA facial expression patches (x=338, y=61, w=348, h=397)
from t1_hot_shy_panic.png, t1_hot_tease.png, and t1_hot_bold.png so Miya smoothly
transitions across 6 live expressions from panicked shyness to seductive boldness!
"""

from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "art-studio" / "raw"
OUT_DIR = ROOT / "public" / "art"
QA_DIR = ROOT / ".qa-out"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    QA_DIR.mkdir(parents=True, exist_ok=True)

    raw_hero = np.array(Image.open(RAW_DIR / "starter_heroine_t1_hot.png").convert("RGB"))
    H0, W0, _ = raw_hero.shape
    TARGET_W = 1024
    TARGET_H = int(round(H0 * (TARGET_W / W0)))
    scale = TARGET_W / W0

    FX0, FY0, FX1, FY1 = int(W0 * 0.33), int(H0 * 0.04), int(W0 * 0.67), int(H0 * 0.30)
    CW, CH = FX1 - FX0, FY1 - FY0
    face_ref = raw_hero[FY0:FY1, FX0:FX1].astype(np.float32)
    gray_ref = cv2.cvtColor(face_ref.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)

    base_plate = Image.open(OUT_DIR / "heroine_t1_base.webp").convert("RGBA")
    base_alpha_full = np.array(base_plate.resize((W0, H0), Image.Resampling.LANCZOS))[:, :, 3].astype(np.float32) / 255.0

    tx0 = int(round(FX0 * scale))
    ty0 = int(round(FY0 * scale))
    tx1 = int(round(FX1 * scale))
    ty1 = int(round(FY1 * scale))
    tw, th = tx1 - tx0, ty1 - ty0
    print(f"Patch box in {TARGET_W}x{TARGET_H}: x={tx0}, y={ty0}, w={tw}, h={th}")

    def build_patch(raw_name: str, out_name: str, focus_box: tuple[float, float, float, float]) -> Image.Image:
        gen_im = Image.open(RAW_DIR / raw_name).convert("RGB").resize((CW, CH), Image.Resampling.LANCZOS)
        gen_arr = np.array(gen_im).astype(np.float32)
        gray_gen = cv2.cvtColor(gen_arr.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
        (dx, dy), resp = cv2.phaseCorrelate(gray_gen, gray_ref)
        print(f"  {out_name}: shift=({dx:.3f}, {dy:.3f}) px, resp={resp:.3f}")
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        aligned = cv2.warpAffine(gen_arr, M, (CW, CH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

        nx0, ny0, nx1, ny1 = focus_box
        px0, py0, px1, py1 = int(CW * nx0), int(CH * ny0), int(CW * nx1), int(CH * ny1)
        interior = np.zeros((CH, CW), dtype=np.float32)
        cv2.rectangle(interior, (px0, py0), (px1, py1), 1.0, -1)
        # Protect fingers touching right cheek (viewer's right lower corner: x > 0.67, y > 0.72)
        interior[int(CH * 0.72) :, int(CW * 0.67) :] = 0.0
        interior = cv2.GaussianBlur(interior, (23, 23), 6.5)

        mask = np.clip(interior, 0.0, 1.0) * base_alpha_full[FY0:FY1, FX0:FX1]
        border = np.ones((CH, CW), dtype=np.float32)
        border[:6, :] = 0
        border[-6:, :] = 0
        border[:, :6] = 0
        border[:, -6:] = 0
        border = cv2.GaussianBlur(border, (11, 11), 3.0)
        mask *= border

        rgba = np.dstack([
            np.clip(aligned, 0, 255).astype(np.uint8),
            np.clip(mask * 255.0, 0, 255).astype(np.uint8),
        ])
        patch_im = Image.fromarray(rgba, "RGBA").resize((tw, th), Image.Resampling.LANCZOS)
        out_path = OUT_DIR / out_name
        patch_im.save(out_path, "WEBP", quality=95, method=6)
        print(f"  Saved {out_path.relative_to(ROOT)} ({out_path.stat().st_size // 1024} KB)")
        return patch_im

    shy_im = build_patch("t1_hot_shy_panic.png", "patch_t1_shy.webp", (0.11, 0.36, 0.85, 0.88))
    flust_im = build_patch("t1_hot_fluster.png", "patch_t1_fluster.webp", (0.11, 0.38, 0.85, 0.88))
    tease_im = build_patch("t1_hot_tease.png", "patch_t1_tease.webp", (0.11, 0.38, 0.85, 0.88))
    bold_im = build_patch("t1_hot_bold.png", "patch_t1_bold.webp", (0.11, 0.38, 0.85, 0.88))

    s0_plate = Image.open(OUT_DIR / "heroine_t1_s0.webp").convert("RGBA")
    s4_plate = Image.open(OUT_DIR / "heroine_t1_s4.webp").convert("RGBA")

    # Build 5-expression QA sheet: Neutral | Shy Panic (on s0) | Fluster (on s0) | Tease Wink (on base) | Bold Sultry (on s4)
    combos = [
        (s0_plate, None),
        (s0_plate, shy_im),
        (s0_plate, flust_im),
        (base_plate, tease_im),
        (s4_plate, bold_im),
    ]
    fbox = (int(TARGET_W * 0.28), int(TARGET_H * 0.03), int(TARGET_W * 0.72), int(TARGET_H * 0.31))
    strip = Image.new("RGB", (260 * 5, 312), (28, 22, 36))
    for idx, (plate, patch) in enumerate(combos):
        comp = Image.new("RGBA", plate.size, (34, 26, 44, 255))
        comp.alpha_composite(plate)
        if patch is not None:
            comp.alpha_composite(patch, (tx0, ty0))
        crop = comp.crop(fbox).resize((260, 312), Image.Resampling.LANCZOS)
        strip.paste(crop.convert("RGB"), (idx * 260, 0))

    qa_out = QA_DIR / "qa_emotions_5up.png"
    strip.save(qa_out, "PNG")
    print(f"Saved {qa_out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
