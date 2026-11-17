#!/usr/bin/env python3
"""
Processes the Day 2 Sub Goal ladder plates (stages 1..4) so every one of them shares
the EXACT canonical face of the approved Day 2 stage-0 render (art-studio/raw/t2_day2_outfit_v7.png),
which is itself face-locked to the Day 1 master. Same chair, same framing, same scale.

Day 2 ladder (1500 / 2000 / 2500 / 5000 subs), fan-service rising step by step:
- stage 0 (0 subs)     -> heroine_t2_s0.webp  beige pullover hoodie + shorts + straight golf socks
- stage 1 (1500 subs)  -> heroine_t2_s1.webp  grey cropped tee, knees hugged, golf socks slouched
- stage 2 (2000 subs)  -> heroine_t2_s2.webp  black camisole, HOODIE TIED AROUND THE WAIST, socks at the ankles
- stage 3 (2500 subs)  -> heroine_t2_s3.webp  one strap slipped down, hoodie hanging open behind her, leaning in
- stage 4 (5000 subs)  -> heroine_t2_s4.webp  kneeling on the seat toward the webcam, bare feet (the socks only
                                               come off at this very last stage)
"""

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from process_subgoal_art import align_and_lock_face, remove_plum_matte  # noqa: E402

RAW_DIR = ROOT / "art-studio" / "raw"
OUT_DIR = ROOT / "public" / "art"
QA_DIR = ROOT / ".qa-out"

MASTER = RAW_DIR / "t2_day2_outfit_v7.png"

# Renders that need a small continuity repair, mapped to the plate they must match.
CONTINUITY_FIXES = {"t2_day2_s3_v3.png": "t2_day2_s3.png"}


def unify_nail_polish(rgb_np: np.ndarray, ref_np: np.ndarray) -> np.ndarray:
    """Repaint saturated-red nails with the reference plate's dark plum manicure (continuity)."""
    H0, W0, _ = rgb_np.shape
    yy, xx = np.mgrid[0:H0, 0:W0]
    band = (yy > int(H0 * 0.48)) & (yy < int(H0 * 0.74)) & ((xx < int(W0 * 0.32)) | (xx > int(W0 * 0.60)))

    def red_mask(a: np.ndarray) -> np.ndarray:
        r = a[:, :, 0].astype(np.int16)
        g = a[:, :, 1].astype(np.int16)
        b = a[:, :, 2].astype(np.int16)
        return band & (r > 105) & ((r - g) > 50) & ((r - b) > 40) & (g < 95)

    src = red_mask(rgb_np)
    if not src.any():
        return rgb_np
    ref = red_mask(ref_np)
    target = np.median(ref_np[ref], axis=0) if ref.any() else np.array([104.0, 62.0, 118.0])
    src_lum = max(float(np.mean(rgb_np[src].mean(axis=1))), 1.0)
    rel = rgb_np[src].mean(axis=1) / src_lum  # keep each nail's own highlight/shade
    out = rgb_np.astype(np.float32).copy()
    out[src] = np.clip(target[None, :] * rel[:, None], 0, 255)
    alpha = (
        cv2.GaussianBlur((src.astype(np.uint8) * 255), (0, 0), sigmaX=0.8)[..., None].astype(np.float32)
        / 255.0
    )
    return np.clip(rgb_np.astype(np.float32) * (1.0 - alpha) + out * alpha, 0, 255).astype(np.uint8)

# Day 2 ladder mapping approved by the user:
# 1500 -> tee without the hoodie (t2_day2_s1) | 2000 -> hoodie tied on the waist (t2_day2_s3)
# 2500 -> strap slipped, hoodie hanging behind (t2_day2_s3_v2) | 5000 -> kneeling finale (t2_day2_s4_pose_a)
LADDER = [
    ("t2_day2_s1.png", "heroine_t2_s1.webp"),
    ("t2_day2_s3.png", "heroine_t2_s2.webp"),
    ("t2_day2_s3_v3.png", "heroine_t2_s3.webp"),
    ("t2_day2_s4_pose_a.png", "heroine_t2_s4.webp"),
]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    QA_DIR.mkdir(parents=True, exist_ok=True)

    master_im = Image.open(MASTER).convert("RGB")
    master_np = np.array(master_im)
    H0, W0, _ = master_np.shape

    target_size = Image.open(OUT_DIR / "heroine_t2_s0.webp").size
    print(f"Master {W0}x{H0} -> target plate {target_size[0]}x{target_size[1]}")

    # The shipped Day 2 stage-0 plate, resized into master space, for patch-region checks.
    stage0 = np.array(Image.open(OUT_DIR / "heroine_t2_s0.webp").convert("RGB").resize((W0, H0)))
    # Face patch region used by HeroineRig (relative), where ghosting must stay invisible.
    py1, py2 = int(H0 * 0.055), int(H0 * 0.40)
    px1, px2 = int(W0 * 0.245), int(W0 * 0.505)

    cutouts: dict[str, Image.Image] = {}
    results: list[tuple[str, np.ndarray]] = []
    for raw_name, out_name in LADDER:
        rgb = align_and_lock_face(RAW_DIR / raw_name, master_np)
        if CONTINUITY_FIXES.get(raw_name):
            ref_np = np.array(Image.open(RAW_DIR / CONTINUITY_FIXES[raw_name]).convert("RGB"))
            if ref_np.shape != rgb.shape:
                ref_np = np.array(Image.fromarray(ref_np).resize((rgb.shape[1], rgb.shape[0])))
            before = rgb.copy()
            rgb = unify_nail_polish(rgb, ref_np)
            changed = int(np.sum(np.abs(rgb.astype(np.int16) - before.astype(np.int16)).max(axis=2) > 12))
            print(f"    continuity: nail polish unified against {CONTINUITY_FIXES[raw_name]} ({changed} px repainted)")
        patch_mae = float(np.mean(np.abs(rgb[py1:py2, px1:px2].astype(np.float32) - stage0[py1:py2, px1:px2].astype(np.float32))))
        rgba_im = remove_plum_matte(rgb, target_size)
        out_path = OUT_DIR / out_name
        rgba_im.save(out_path, format="WEBP", quality=92, method=6)
        alpha = np.array(rgba_im)[:, :, 3:4].astype(np.float32) / 255.0
        opaque = float(np.mean(alpha))
        print(
            f"saved {out_path.relative_to(ROOT)} ({out_path.stat().st_size // 1024} KB) "
            f"facePatchMAE_vs_t2_s0={patch_mae:.2f} coverage={opaque:.3f}"
        )
        cutouts[out_name] = rgba_im
        results.append((out_name, rgb))

    # Contact sheet: stage 0 + 4 new plates over a mid-grey bed for eyeball QA.
    names = ["heroine_t2_s0.webp"] + [out for _, out in LADDER]
    imgs = [Image.open(OUT_DIR / n).convert("RGBA") for n in names]
    tw, th = 260, 388
    sheet = Image.new("RGBA", (tw * len(imgs), th + 22), (32, 26, 40, 255))
    for idx, im in enumerate(imgs):
        th_im = im.resize((tw, th), Image.Resampling.LANCZOS)
        bed = Image.new("RGBA", (tw, th), (120, 116, 128, 255))
        bed.alpha_composite(th_im)
        sheet.paste(bed, (idx * tw, 22))
    sheet.convert("RGB").save(QA_DIR / "day2_ladder_sheet.png")
    print(f"contact sheet -> {(QA_DIR / 'day2_ladder_sheet.png').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
