#!/usr/bin/env python3
"""
Processes Stage 5 (1000 Subs — Stage-1 Style Korean-Manhwa Dark Sorceress Chest-Fanservice Cosplay)
and extracts subpixel-aligned Stage 5 facial expression patches:
- public/art/heroine_t1_s5.webp         (resting alluring Dark Sorceress plate in exact Stage-1 style)
- public/art/patch_t1_s5_blink.webp     (symmetrical gentle blink)
- public/art/patch_t1_s5_tease.webp     (playful Dark Sorceress star-pupil wink + tiny fang smile)
- public/art/patch_t1_s5_fluster.webp   (embarrassed shiny-eyed blush 'o' gasp)
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "art-studio" / "raw"
OUT_DIR = ROOT / "public" / "art"
QA_DIR = ROOT / ".qa-out"

# Portrait crop box in 848x1264 raw coordinates used for head expression generation
HEAD_CROP_BOX = (237, 175, 627, 565)

# Patch crop coordinates in the 1024x1526 target space for Stage 5 Dark Sorceress head
S5_PX, S5_PY, S5_PW, S5_PH = 368, 282, 304, 296


def stitch_head_expression(master_rgb: np.ndarray, head_expr_path: Path) -> np.ndarray:
    """Aligns 512x512 portrait expression back into (237,203,627,593) and feathers ONLY interior face."""
    x1, y1, x2, y2 = HEAD_CROP_BOX
    cw, ch = x2 - x1, y2 - y1
    base_crop = master_rgb[y1:y2, x1:x2].astype(np.float32)

    expr_im = Image.open(head_expr_path).convert("RGB").resize((cw, ch), Image.Resampling.LANCZOS)
    expr_crop = np.array(expr_im).astype(np.float32)

    # Subpixel phase correlation on static hair/hat-brim/choker anchor ring around the face
    anchor_mask = np.ones((ch, cw), dtype=np.float32)
    anchor_mask[90:275, 105:285] = 0.0
    g_base = cv2.cvtColor(base_crop.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) * anchor_mask
    g_expr = cv2.cvtColor(expr_crop.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) * anchor_mask
    (dx, dy), _ = cv2.phaseCorrelate(g_expr, g_base)
    if abs(dx) > 4.0 or abs(dy) > 4.0:
        dx, dy = 0.0, 0.0
    print(f"  [{head_expr_path.name}] subpixel head shift = ({dx:+.2f}, {dy:+.2f}) px")

    M = np.float32([[1.0, 0.0, dx], [0.0, 1.0, dy]])
    aligned_expr = cv2.warpAffine(
        expr_crop,
        M,
        (cw, ch),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )

    # Feather oval strictly over interior face (eyebrows, eyes, nose, cheeks, mouth) inside bangs & jawline
    yy, xx = np.mgrid[0:ch, 0:cw]
    cy, cx = 182.0, 193.0
    ry, rx = 86.0, 82.0
    oval = ((((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2) <= 1.0).astype(np.float32)
    oval = cv2.GaussianBlur(oval, (0, 0), sigmaX=10.5, sigmaY=10.5)[..., None]

    blended_crop = base_crop * (1.0 - oval) + aligned_expr * oval
    out = master_rgb.copy().astype(np.float32)
    out[y1:y2, x1:x2] = blended_crop
    return np.clip(out, 0, 255).astype(np.uint8)


def remove_plum_matte_witch(rgb_np: np.ndarray, target_size: tuple[int, int]) -> Image.Image:
    """
    Keys out flat #7E626E studio backdrop (including enclosed pockets under raised arm & beside sleeve)
    while preserving 100% of Miya's sheer dark-violet tulle sleeves (with subtle real chiffon
    translucency & plum color decontamination) and subtle chair backrest mesh translucency.
    """
    H0, W0, _ = rgb_np.shape
    arr = rgb_np.astype(np.float32)

    corners = np.concatenate(
        [
            arr[0:36, 0:36].reshape(-1, 3),
            arr[0:36, -36:].reshape(-1, 3),
        ],
        axis=0,
    )
    bg = np.median(corners, axis=0)
    dist = np.linalg.norm(arr - bg[None, None, :], axis=2)

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    plum_chroma = (r - g) > 12.0

    core_bg = ((dist < 22.0) & plum_chroma).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(core_bg, connectivity=8)

    border_labels = set(np.unique(labels[0, :]))
    border_labels.update(np.unique(labels[-1, :]))
    border_labels.update(np.unique(labels[:, 0]))
    border_labels.update(np.unique(labels[:, -1]))
    border_labels.discard(0)

    # Catch ONLY true flat studio backdrop pockets (mean_dist < 6.8), protecting sheer tulle sleeves (mean_dist > 12)!
    enclosed_bg_labels = set()
    for lbl in range(1, num_labels):
        if lbl in border_labels:
            continue
        area = stats[lbl, cv2.CC_STAT_AREA]
        if area > 120:
            m = labels == lbl
            if float(np.mean(dist[m])) < 6.8 and float(np.std(dist[m])) < 4.8:
                enclosed_bg_labels.add(lbl)

    all_bg_labels = border_labels | enclosed_bg_labels
    ext_bg = np.isin(labels, list(all_bg_labels))

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    near_ext_bg = cv2.dilate(ext_bg.astype(np.uint8), kernel, iterations=1) > 0

    alpha = np.ones((H0, W0), dtype=np.float32)
    alpha[ext_bg] = 0.0

    ramp = np.clip((dist - 14.0) / (38.0 - 14.0), 0.0, 1.0)
    edge_zone = near_ext_bg & (~ext_bg) & ((r - g) > 6.0)
    alpha[edge_zone] = np.minimum(alpha[edge_zone], ramp[edge_zone])

    yy, xx = np.mgrid[0:H0, 0:W0]

    # Subtle translucency on dark charcoal chair backrest mesh (matching Stages 0..4)
    plum_cast = ((r - g) > 10.0) & ((b - g) > 5.0) & (dist < 52.0) & (alpha > 0.5) & (r < 95.0)
    in_mesh_zone = (yy > int(H0 * 0.42)) & (yy < int(H0 * 0.72)) & ((xx < int(W0 * 0.30)) | (xx > int(W0 * 0.74)))
    mesh_holes = plum_cast & in_mesh_zone
    alpha[mesh_holes] = np.clip((dist[mesh_holes] - 14.0) / 38.0, 0.28, 0.88)

    # Real sheer dark-violet chiffon translucency on her left & right tulle sleeves (inside crisp ink outlines!)
    in_right_sleeve = (xx > int(W0 * 0.11)) & (xx < int(W0 * 0.38)) & (yy > int(H0 * 0.35)) & (yy < int(H0 * 0.58))
    in_left_sleeve = (xx > int(W0 * 0.68)) & (xx < int(W0 * 0.88)) & (yy > int(H0 * 0.50)) & (yy < int(H0 * 0.85))
    sheer_tulle = (~ext_bg) & (~near_ext_bg) & (in_right_sleeve | in_left_sleeve) & (dist < 34.0) & ((r - g) > 12.0) & (r > 85.0)
    alpha[sheer_tulle] = np.clip(0.76 + (dist[sheer_tulle] / 140.0), 0.76, 0.94)

    alpha = cv2.GaussianBlur(alpha, (0, 0), sigmaX=0.75, sigmaY=0.75)
    alpha[ext_bg] = 0.0

    semi = (alpha > 0.02) & (alpha < 0.96)
    safe_a = np.maximum(alpha, 0.18)[..., None]
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

    base_webp = Image.open(OUT_DIR / "heroine_t1_base.webp")
    target_size = base_webp.size  # (1024, 1526)
    W, H = target_size

    master_rgb = np.array(Image.open(RAW_DIR / "t1_stage5_canon_witch.png").convert("RGB"))
    blink_rgb = stitch_head_expression(master_rgb, RAW_DIR / "s5_canon_blink.png")
    tease_rgb = stitch_head_expression(master_rgb, RAW_DIR / "s5_canon_tease.png")
    fluster_rgb = stitch_head_expression(master_rgb, RAW_DIR / "s5_canon_fluster.png")

    s5_base_rgba = remove_plum_matte_witch(master_rgb, target_size)
    s5_blink_rgba = remove_plum_matte_witch(blink_rgb, target_size)
    s5_tease_rgba = remove_plum_matte_witch(tease_rgb, target_size)
    s5_fluster_rgba = remove_plum_matte_witch(fluster_rgb, target_size)

    out_base = OUT_DIR / "heroine_t1_s5.webp"
    s5_base_rgba.save(out_base, format="WEBP", quality=94, method=6)
    print(f"Saved {out_base.relative_to(ROOT)} ({out_base.stat().st_size // 1024} KB)")

    yy, xx = np.mgrid[0:S5_PH, 0:S5_PW]
    edge_dist = np.minimum(
        np.minimum(xx, S5_PW - 1 - xx),
        np.minimum(yy, S5_PH - 1 - yy),
    ).astype(np.float32)
    feather = np.clip(edge_dist / 16.0, 0.0, 1.0)

    for patch_name, full_rgba in [
        ("patch_t1_s5_blink.webp", s5_blink_rgba),
        ("patch_t1_s5_tease.webp", s5_tease_rgba),
        ("patch_t1_s5_fluster.webp", s5_fluster_rgba),
    ]:
        crop_np = np.array(full_rgba.crop((S5_PX, S5_PY, S5_PX + S5_PW, S5_PY + S5_PH))).astype(np.float32)
        crop_np[:, :, 3] *= feather
        patch_im = Image.fromarray(np.clip(crop_np, 0, 255).astype(np.uint8), mode="RGBA")
        out_p = OUT_DIR / patch_name
        patch_im.save(out_p, format="WEBP", quality=95, method=6)
        print(f"Saved {out_p.relative_to(ROOT)} ({out_p.stat().st_size // 1024} KB)")

    # Build 5-panel QA sheet: Panel 0 = Stage 1 (heroine_t1_s1.webp) side-by-side with Stage 5 Dark Sorceress (4 expressions)!
    bg_room = Image.open(OUT_DIR / "bg_room_t1.webp").convert("RGBA").resize((1376, 768), Image.Resampling.LANCZOS)
    fg_desk = Image.open(OUT_DIR / "fg_desk_t1.webp").convert("RGBA").resize((1376, 768), Image.Resampling.LANCZOS)
    s1_im = Image.open(OUT_DIR / "heroine_t1_s1.webp").convert("RGBA")

    scale = 724 / H
    rw, rh = int(round(W * scale)), 724
    rx, ry = (1376 - rw) // 2, 18

    thumbs = []
    # Panel 0: Stage 1 reference for direct art-style comparison!
    st1 = bg_room.copy()
    st1.alpha_composite(s1_im.resize((rw, rh), Image.Resampling.LANCZOS), (rx, ry))
    st1.alpha_composite(fg_desk, (0, 0))
    thumbs.append(st1.crop((320, 0, 1056, 768)).resize((384, 400), Image.Resampling.LANCZOS).convert("RGB"))

    for patch_file in [None, "patch_t1_s5_blink.webp", "patch_t1_s5_tease.webp", "patch_t1_s5_fluster.webp"]:
        comp = s5_base_rgba.copy()
        if patch_file:
            p_im = Image.open(OUT_DIR / patch_file).convert("RGBA")
            comp.alpha_composite(p_im, (S5_PX, S5_PY))
        stage = bg_room.copy()
        stage.alpha_composite(comp.resize((rw, rh), Image.Resampling.LANCZOS), (rx, ry))
        stage.alpha_composite(fg_desk, (0, 0))
        thumbs.append(stage.crop((320, 0, 1056, 768)).resize((384, 400), Image.Resampling.LANCZOS).convert("RGB"))

    strip = Image.new("RGB", (384 * 5, 400), (18, 14, 24))
    for idx, t in enumerate(thumbs):
        strip.paste(t, (idx * 384, 0))
    qa_out = QA_DIR / "qa_stage5_cosplay_4up.png"
    strip.save(qa_out)
    print(f"Saved Stage 1 vs Stage 5 (5-up) QA preview: {qa_out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
