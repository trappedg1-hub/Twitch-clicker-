#!/usr/bin/env python3
"""
Processes Stage 5 v2 (1000 Subs — Mega-Fanservice French-Maid Bunny Bikini Cosplay
with Arm Behind Head & Giant Foreshortened Bare Soles Resting on the Stream Desk!)
and extracts subpixel-aligned Stage 5 facial expression patches:
- public/art/heroine_t1_s5.webp         (resting sultry open-eyes Stage 5 plate)
- public/art/patch_t1_s5_blink.webp     (symmetrical both-eyes-closed blink)
- public/art/patch_t1_s5_tease.webp     (cheeky peace-sign wink!)
- public/art/patch_t1_s5_fluster.webp   (misty-eyed deep-crimson breathless gasp!)
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "art-studio" / "raw"
OUT_DIR = ROOT / "public" / "art"
QA_DIR = ROOT / ".qa-out"

# Patch crop coordinates in the 1024x1526 target space for Stage 5 v2 head
S5_PX, S5_PY, S5_PW, S5_PH = 340, 128, 344, 332


def remove_plum_matte_s5(rgb_np: np.ndarray, target_size: tuple[int, int]) -> Image.Image:
    H0, W0, _ = rgb_np.shape
    arr = rgb_np.astype(np.float32)

    corners = np.concatenate(
        [
            arr[0:36, 0:36].reshape(-1, 3),
            arr[0:36, -36:].reshape(-1, 3),
            arr[-36:, 0:36].reshape(-1, 3),
            arr[-36:, -36:].reshape(-1, 3),
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

    # Catch enclosed flat plum-backdrop pockets (under raised left arm, between chair armrests & soles!)
    enclosed_bg_labels = set()
    for lbl in range(1, num_labels):
        if lbl in border_labels:
            continue
        area = stats[lbl, cv2.CC_STAT_AREA]
        if area > 110:
            comp_mask = labels == lbl
            if float(np.std(dist[comp_mask])) < 3.5:
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

    alpha = cv2.GaussianBlur(alpha, (0, 0), sigmaX=0.8, sigmaY=0.8)
    alpha[ext_bg] = 0.0

    semi = (alpha > 0.02) & (alpha < 0.96)
    safe_a = np.maximum(alpha, 0.15)[..., None]
    decontaminated = (arr - (1.0 - alpha[..., None]) * bg[None, None, :]) / safe_a
    out_rgb = np.where(semi[..., None], np.clip(decontaminated, 0, 255), arr)

    # Physical 3D Desk Occlusion: chair hydraulic post & neon post rim between her heels
    # go UNDER the wooden desk while her giant glossy pink soles rest ON TOP OF the wooden desk!
    yy, xx = np.mgrid[0:H0, 0:W0]
    center_post_box = (yy > int(H0 * 0.848)) & (xx > int(W0 * 0.43)) & (xx < int(W0 * 0.59))
    lever_zone = (yy > int(H0 * 0.855)) & (xx > int(W0 * 0.16)) & (xx < int(W0 * 0.28))
    not_pink_sole = ~((out_rgb[:, :, 0] > 165) & ((out_rgb[:, :, 0] - out_rgb[:, :, 2]) > 25))
    post_mask = center_post_box | (lever_zone & not_pink_sole)
    alpha[post_mask] = 0.0
    alpha = cv2.GaussianBlur(alpha, (0, 0), sigmaX=0.6, sigmaY=0.6)
    alpha[ext_bg | post_mask] = 0.0

    rgba = np.dstack([out_rgb.astype(np.uint8), np.clip(alpha * 255.0, 0, 255).astype(np.uint8)])
    pil_rgba = Image.fromarray(rgba, mode="RGBA")
    if pil_rgba.size != target_size:
        pil_rgba = pil_rgba.resize(target_size, Image.Resampling.LANCZOS)
    return pil_rgba


def build_s5_face_mask(w: int, h: int) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    cx = w * 0.505
    cy = h * 0.61
    rx = w * 0.255
    ry = h * 0.275
    dist = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    interior = np.clip((1.05 - dist) / 0.30, 0.0, 1.0).astype(np.float32)

    # Protect peace-sign fingertip touching her screen-left cheek (`x < 0.34*w, y > 0.45*h`)
    interior[int(h * 0.48) :, : int(w * 0.34)] = 0.0
    # Protect bell choker collar at very bottom
    interior[int(h * 0.88) :, :] = 0.0

    return cv2.GaussianBlur(interior, (23, 23), 7.0)


def stitch_fluster_head_onto_base(base_full_im: Image.Image, head_crop_im: Image.Image) -> Image.Image:
    """Places s5_v2_head_fluster.png back into exact (280, 120, 744, 584) box of base_full_im."""
    out = base_full_im.copy()
    box_w, box_h = 744 - 280, 584 - 120
    resized_head = head_crop_im.convert("RGB").resize((box_w, box_h), Image.Resampling.LANCZOS)
    out.paste(resized_head, (280, 120))
    return out


def extract_s5_patch(
    base_rgba: np.ndarray,
    expr_im: Image.Image,
    name: str,
    target_size: tuple[int, int],
    face_mask: np.ndarray,
) -> Image.Image:
    TW, TH = target_size
    cand = np.array(expr_im.convert("RGB").resize((TW, TH), Image.Resampling.LANCZOS))
    base_rgb = base_rgba[:, :, :3]

    # Subpixel align on upper bangs + headset band
    ax1, ay1, ax2, ay2 = 380, 150, 650, 275
    ref_gray = cv2.cvtColor(base_rgb[ay1:ay2, ax1:ax2], cv2.COLOR_RGB2GRAY).astype(np.float32)
    cand_gray = cv2.cvtColor(cand[ay1:ay2, ax1:ax2], cv2.COLOR_RGB2GRAY).astype(np.float32)
    (dx, dy), _ = cv2.phaseCorrelate(ref_gray, cand_gray)
    dx = float(np.clip(dx, -6.0, 6.0))
    dy = float(np.clip(dy, -6.0, 6.0))
    M = np.float32([[1.0, 0.0, -dx], [0.0, 1.0, -dy]])
    aligned = cv2.warpAffine(cand, M, (TW, TH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    print(f"  {name}: shift=({dx:+.2f}, {dy:+.2f})px")

    crop_rgb = aligned[S5_PY : S5_PY + S5_PH, S5_PX : S5_PX + S5_PW]
    base_a = base_rgba[S5_PY : S5_PY + S5_PH, S5_PX : S5_PX + S5_PW, 3].astype(np.float32) / 255.0
    patch_a = np.clip(face_mask * base_a * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([crop_rgb, patch_a]), mode="RGBA")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    QA_DIR.mkdir(parents=True, exist_ok=True)

    target_size = Image.open(OUT_DIR / "heroine_t1_base.webp").size
    print("Target stage plate size:", target_size)

    open_bold_im = Image.open(RAW_DIR / "t1_stage5_v2_open_bold.png").convert("RGB")
    blink_im = Image.open(RAW_DIR / "t1_stage5_v2_blink.png").convert("RGB")
    tease_wink_im = Image.open(RAW_DIR / "t1_stage5_v2_base.png").convert("RGB")
    fluster_head_im = Image.open(RAW_DIR / "s5_v2_head_fluster.png").convert("RGB")
    fluster_full_im = stitch_fluster_head_onto_base(open_bold_im, fluster_head_im)

    s5_rgba_im = remove_plum_matte_s5(np.array(open_bold_im), target_size)
    s5_out = OUT_DIR / "heroine_t1_s5.webp"
    s5_rgba_im.save(s5_out, "WEBP", quality=91, method=6)
    print(f"Saved {s5_out.name} ({s5_out.stat().st_size // 1024} KB)")

    s5_rgba_np = np.array(s5_rgba_im)
    face_mask = build_s5_face_mask(S5_PW, S5_PH)

    patches = [
        ("blink", blink_im, "patch_t1_s5_blink.webp"),
        ("tease_wink", tease_wink_im, "patch_t1_s5_tease.webp"),
        ("fluster_gasp", fluster_full_im, "patch_t1_s5_fluster.webp"),
    ]

    rendered = [("open_bold", s5_rgba_im)]
    for label, src_im, dst_name in patches:
        p_im = extract_s5_patch(s5_rgba_np, src_im, label, target_size, face_mask)
        dst = OUT_DIR / dst_name
        p_im.save(dst, "WEBP", quality=92, method=6)
        print(f"Saved {dst.name} ({dst.stat().st_size // 1024} KB)")

        comp = s5_rgba_im.copy()
        comp.alpha_composite(p_im, (S5_PX, S5_PY))
        rendered.append((dst_name, comp))

    # Build 4-up preview over actual room + desk (with Stage 5 giant soles resting ON TOP OF fg_desk_t1!)
    bg = Image.open(OUT_DIR / "bg_room_t1.webp").convert("RGBA")
    desk = Image.open(OUT_DIR / "fg_desk_t1.webp").convert("RGBA")

    strip = Image.new("RGBA", (4 * 360, 440), (14, 14, 18, 255))
    for i, (_, full_char) in enumerate(rendered):
        scene = bg.copy()
        scene.alpha_composite(desk, (0, 0))
        scaled_char = full_char.resize(
            (int(target_size[0] * 0.4745), int(target_size[1] * 0.4745)),
            Image.Resampling.LANCZOS,
        )
        cx = int(688 - scaled_char.width / 2)
        cy = 32
        scene.alpha_composite(scaled_char, (cx, cy))
        crop = scene.crop((405, 15, 970, 765)).resize((352, 430), Image.Resampling.LANCZOS)
        strip.alpha_composite(crop, (4 + i * 360, 5))

    strip.save(QA_DIR / "qa_stage5_cosplay_4up.png")
    print("Saved .qa-out/qa_stage5_cosplay_4up.png")


if __name__ == "__main__":
    main()
