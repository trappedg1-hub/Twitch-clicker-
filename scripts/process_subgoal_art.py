#!/usr/bin/env python3
"""
Processes the 4 new Sub Goal Strip-Down stages (s0, s1, s2, s4) so they align
to 0.0px against Stage 3 (public/art/heroine_t1_base.webp) AND share the 100%
IDENTICAL grey hoodie across Stages 0, 1, and 2!

Sub Goal Progression:
- Stage 0 (0 subs)   -> public/art/heroine_t1_s0.webp   (zipped hoodie + leggings under shorts + socks)
- Stage 1 (10 subs)  -> public/art/heroine_t1_s1.webp   (EXACT SAME zipped hoodie + leggings + bare feet)
- Stage 2 (50 subs)  -> public/art/heroine_t1_s2.webp   (EXACT SAME zipped hoodie + bare legs & feet)
- Stage 3 (200 subs) -> public/art/heroine_t1_base.webp (crop tee + bare midriff + bare legs & feet)
- Stage 4 (500 subs) -> public/art/heroine_t1_s4.webp   (black halter bralette + bare midriff + bare legs & feet)
"""

from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "art-studio" / "raw"
OUT_DIR = ROOT / "public" / "art"
QA_DIR = ROOT / ".qa-out"


def align_and_lock_face(raw_path: Path, master_np: np.ndarray) -> np.ndarray:
    """Upscale raw plate to master_np size, align head within +-6px, and lock interior face pixels."""
    H0, W0, _ = master_np.shape
    raw_im = Image.open(raw_path).convert("RGB")
    if raw_im.size != (W0, H0):
        raw_im = raw_im.resize((W0, H0), Image.Resampling.LANCZOS)
    arr = np.array(raw_im)

    y1, y2 = int(H0 * 0.06), int(H0 * 0.19)
    x1, x2 = int(W0 * 0.38), int(W0 * 0.62)
    ref_crop = master_np[y1:y2, x1:x2].astype(np.float32)

    best_dx, best_dy = 0, 0
    best_err = 1e18
    for dy in range(-6, 7):
        for dx in range(-6, 7):
            cand = arr[y1 + dy : y2 + dy, x1 + dx : x2 + dx].astype(np.float32)
            err = float(np.mean(np.abs(ref_crop - cand)))
            if err < best_err:
                best_err = err
                best_dx, best_dy = dx, dy

    if best_dx != 0 or best_dy != 0:
        M = np.float32([[1, 0, -best_dx], [0, 1, -best_dy]])
        arr = cv2.warpAffine(arr, M, (W0, H0), borderMode=cv2.BORDER_REPLICATE)

    print(f"  {raw_path.name}: best head shift=({best_dx}, {best_dy}) px, MAE={best_err:.2f}")

    # Softly blend exact face interior from master_np so blink/fluster patches match 0.0px
    face_mask = np.zeros((H0, W0), dtype=np.float32)
    cy, cx = int(H0 * 0.145), int(W0 * 0.495)
    ry, rx = int(H0 * 0.062), int(W0 * 0.092)
    yy, xx = np.mgrid[0:H0, 0:W0]
    inside = (((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2) <= 1.0
    face_mask[inside] = 1.0
    face_mask = cv2.GaussianBlur(face_mask, (0, 0), sigmaX=10.0, sigmaY=10.0)[..., None]

    blended = arr.astype(np.float32) * (1.0 - face_mask) + master_np.astype(np.float32) * face_mask
    return np.clip(blended, 0, 255).astype(np.uint8)


def remove_plum_matte(rgb_np: np.ndarray, target_size: tuple[int, int]) -> Image.Image:
    """Clean RGBA cutout with chroma guard so white socks and neutral grey hoodie stay 100% solid."""
    H0, W0, _ = rgb_np.shape
    arr = rgb_np.astype(np.float32)

    corners = np.concatenate(
        [
            arr[0:40, 0:40].reshape(-1, 3),
            arr[0:40, -40:].reshape(-1, 3),
            arr[-40:, 0:40].reshape(-1, 3),
            arr[-40:, -40:].reshape(-1, 3),
        ],
        axis=0,
    )
    bg = np.median(corners, axis=0)
    dist = np.linalg.norm(arr - bg[None, None, :], axis=2)

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    plum_chroma = (r - g) > 12.0

    core_bg = ((dist < 22.0) & plum_chroma).astype(np.uint8)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(core_bg, connectivity=8)

    border_labels = set(np.unique(labels[0, :]))
    border_labels.update(np.unique(labels[-1, :]))
    border_labels.update(np.unique(labels[:, 0]))
    border_labels.update(np.unique(labels[:, -1]))
    border_labels.discard(0)

    enclosed_bg_labels = set()
    for lbl in range(1, num_labels):
        if lbl in border_labels:
            continue
        area = stats[lbl, cv2.CC_STAT_AREA]
        cx, cy = centroids[lbl]
        if 80 < area < 35000 and (cx < W0 * 0.25 or cx > W0 * 0.82) and (H0 * 0.28 < cy < H0 * 0.72):
            comp_mask = labels == lbl
            comp_dist_std = float(np.std(dist[comp_mask]))
            if comp_dist_std < 3.2:
                enclosed_bg_labels.add(lbl)

    all_bg_labels = border_labels | enclosed_bg_labels
    ext_bg = np.isin(labels, list(all_bg_labels))

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    near_ext_bg = cv2.dilate(ext_bg.astype(np.uint8), kernel, iterations=1) > 0

    alpha = np.ones((H0, W0), dtype=np.float32)
    alpha[ext_bg] = 0.0

    ramp = np.clip((dist - 16.0) / (42.0 - 16.0), 0.0, 1.0)
    edge_zone = near_ext_bg & (~ext_bg) & ((r - g) > 6.0)
    alpha[edge_zone] = np.minimum(alpha[edge_zone], ramp[edge_zone])

    # Subtle translucency ONLY on dark charcoal chair backrest mesh (r < 95 protects grey sleeves!)
    yy, xx = np.mgrid[0:H0, 0:W0]
    plum_cast = ((r - g) > 10.0) & ((b - g) > 5.0) & (dist < 52.0) & (alpha > 0.5) & (r < 95.0)
    in_mesh_zone = (yy > int(H0 * 0.27)) & (yy < int(H0 * 0.48)) & ((xx < int(W0 * 0.31)) | (xx > int(W0 * 0.74)))
    mesh_holes = plum_cast & in_mesh_zone
    alpha[mesh_holes] = np.clip((dist[mesh_holes] - 14.0) / 38.0, 0.22, 0.88)

    alpha = cv2.GaussianBlur(alpha, (0, 0), sigmaX=0.85, sigmaY=0.85)
    alpha[ext_bg] = 0.0

    semi = (alpha > 0.02) & (alpha < 0.96)
    safe_a = np.maximum(alpha, 0.15)[..., None]
    decontaminated = (arr - (1.0 - alpha[..., None]) * bg[None, None, :]) / safe_a
    out_rgb = np.where(semi[..., None], np.clip(decontaminated, 0, 255), arr)

    rgba = np.dstack([out_rgb.astype(np.uint8), np.clip(alpha * 255.0, 0, 255).astype(np.uint8)])
    pil_rgba = Image.fromarray(rgba, mode="RGBA")
    if pil_rgba.size != target_size:
        pil_rgba = pil_rgba.resize(target_size, Image.Resampling.LANCZOS)
    return pil_rgba


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    QA_DIR.mkdir(parents=True, exist_ok=True)

    master_im = Image.open(RAW_DIR / "starter_heroine_t1_hot.png").convert("RGB")
    master_np = np.array(master_im)
    H0, W0, _ = master_np.shape

    base_webp = Image.open(OUT_DIR / "heroine_t1_base.webp")
    target_size = base_webp.size
    print(f"Master size: {W0}x{H0} -> Target plate: {target_size[0]}x{target_size[1]}")

    s0_socks_src = align_and_lock_face(RAW_DIR / "t1_stage0_bundled.png", master_np)
    s1_rgb = align_and_lock_face(RAW_DIR / "t1_stage1_nosocks.png", master_np)
    s2_rgb = align_and_lock_face(RAW_DIR / "t1_stage2_from_s1.png", master_np)
    s4_rgb = align_and_lock_face(RAW_DIR / "t1_stage4_bralette.png", master_np)

    yy, xx = np.mgrid[0:H0, 0:W0]

    # Stage 0 (0 subs): 100.0% Stage 1 V-neck hoodie + leggings, add ONLY striped crew socks below y=0.69*H!
    sock_zone = (yy > int(H0 * 0.69)) & ((xx < int(W0 * 0.425)) | (xx > int(W0 * 0.565)))
    sock_mask = cv2.GaussianBlur(sock_zone.astype(np.float32), (0, 0), sigmaX=8.0, sigmaY=8.0)[..., None]
    s0_rgb = np.clip(
        s1_rgb.astype(np.float32) * (1.0 - sock_mask) + s0_socks_src.astype(np.float32) * sock_mask,
        0,
        255,
    ).astype(np.uint8)

    stages = [
        ("heroine_t1_s0.webp", s0_rgb),
        ("heroine_t1_s1.webp", s1_rgb),
        ("heroine_t1_s2.webp", s2_rgb),
        ("heroine_t1_s4.webp", s4_rgb),
    ]

    cutouts: dict[str, Image.Image] = {}
    for out_name, rgb in stages:
        rgba_im = remove_plum_matte(rgb, target_size)
        out_path = OUT_DIR / out_name
        rgba_im.save(out_path, format="WEBP", quality=92, method=6)
        cutouts[out_name] = rgba_im
        print(f"Saved {out_path.relative_to(ROOT)} ({out_path.stat().st_size // 1024} KB)")

    all_five = [
        cutouts["heroine_t1_s0.webp"],
        cutouts["heroine_t1_s1.webp"],
        cutouts["heroine_t1_s2.webp"],
        base_webp.convert("RGBA"),
        cutouts["heroine_t1_s4.webp"],
    ]

    thumb_w, thumb_h = 320, 476
    sheet = Image.new("RGB", (thumb_w * 5, thumb_h * 2), (24, 20, 32))
    for idx, im in enumerate(all_five):
        th = im.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        dark_bg = Image.new("RGBA", (thumb_w, thumb_h), (32, 26, 40, 255))
        dark_bg.alpha_composite(th)
        sheet.paste(dark_bg.convert("RGB"), (idx * thumb_w, 0))

        green_bg = Image.new("RGBA", (thumb_w, thumb_h), (0, 216, 74, 255))
        green_bg.alpha_composite(th)
        sheet.paste(green_bg.convert("RGB"), (idx * thumb_w, thumb_h))

    qa_path = QA_DIR / "qa_subgoal_5stages.png"
    sheet.save(qa_path, format="PNG")
    print(f"Saved {qa_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
