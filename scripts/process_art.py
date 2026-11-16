import json
import os
import cv2
import numpy as np
from PIL import Image

os.makedirs("public/art", exist_ok=True)
os.makedirs(".qa-out", exist_ok=True)

# 1. Load Tier 1 Heroine raw plate (1696 x 2528)
raw_hero = np.array(Image.open("art-studio/raw/starter_heroine_t1_hot.png").convert("RGB"))
H0, W0, _ = raw_hero.shape

# Sample exact flat background color from corners
corners = np.concatenate([
    raw_hero[:40, :40].reshape(-1, 3),
    raw_hero[:40, -40:].reshape(-1, 3),
    raw_hero[-40:, :40].reshape(-1, 3),
    raw_hero[-40:, -40:].reshape(-1, 3),
], axis=0).astype(np.float32)
bg_rgb = np.median(corners, axis=0)
print("Detected background RGB:", bg_rgb)

# Distance to bg color in RGB + chroma signature (plum bg has R-G ~ 23, B-G ~ 13)
diff = raw_hero.astype(np.float32) - bg_rgb[None, None, :]
dist = np.linalg.norm(diff, axis=2)

# Candidate bg pixels (tight core for flood seeds, wider ramp for soft anti-aliased alpha)
core_bg = (dist < 13.5).astype(np.uint8)

# Connected components on core_bg: keep border-touching components PLUS genuine flat #7F6875 enclosed holes
# (strictly flat zero-gradient background pockets between outer thighs & armrests or under left elbow — NEVER on clothing!)
num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(core_bg, connectivity=8)
bg_mask_core = np.zeros((H0, W0), dtype=np.uint8)
for lbl in range(1, num_labels):
    x, y, w, h, area = stats[lbl]
    cx, cy = centroids[lbl]
    touches_border = (x == 0) or (y == 0) or (x + w >= W0) or (y + h >= H0)
    if touches_border:
        bg_mask_core[labels == lbl] = 1
    elif area >= 400 and (cx < W0 * 0.28 or cx > W0 * 0.72):
        # Verify the pocket is truly flat studio background (low std dev), not shaded fabric
        comp_pixels = raw_hero[labels == lbl].astype(np.float32)
        if np.mean(np.std(comp_pixels, axis=0)) < 3.2:
            bg_mask_core[labels == lbl] = 1

# Dilate core mask slightly to build transition band for hair wisps & smooth contours
dilated = cv2.dilate(bg_mask_core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)), iterations=1)
edge_band = (dilated == 1) & (bg_mask_core == 0)

alpha = np.ones((H0, W0), dtype=np.float32)
alpha[bg_mask_core == 1] = 0.0
# Smooth ramp in edge band based on color distance from bg_rgb (8..34 -> 0..1)
band_alpha = np.clip((dist - 8.5) / (32.0 - 8.5), 0.0, 1.0)
alpha[edge_band] = band_alpha[edge_band]

# Subtle mesh backrest translucency: inside mesh backrest region where plum peeks through tiny mesh holes
# Mesh area is roughly y: 0.25..0.58, x: 0.21..0.82 where pixel has subtle plum tint
r, g, b = raw_hero[:, :, 0].astype(np.float32), raw_hero[:, :, 1].astype(np.float32), raw_hero[:, :, 2].astype(np.float32)
plum_cast = (r - g > 10.0) & (b - g > 5.0) & (dist < 52.0) & (alpha > 0.5)
yy, xx = np.mgrid[0:H0, 0:W0]
in_mesh_zone = (yy > int(H0 * 0.27)) & (yy < int(H0 * 0.48)) & ((xx < int(W0 * 0.31)) | (xx > int(W0 * 0.74)))
mesh_holes = plum_cast & in_mesh_zone
# Give tiny mesh holes realistic 0.82 translucency and neutralize plum tint to dark charcoal mesh
alpha[mesh_holes] = np.clip((dist[mesh_holes] - 10.0) / 48.0, 0.55, 0.92)

# Light feather on alpha contour for silky anti-aliasing
alpha_blur = cv2.GaussianBlur(alpha, (3, 3), 0.7)
alpha = np.where(bg_mask_core == 1, 0.0, np.clip(alpha_blur, 0.0, 1.0))

# Color decontamination on semi-transparent edge pixels (0.02 < alpha < 0.98) and mesh holes
fg_rgb = raw_hero.astype(np.float32).copy()
semi = (alpha > 0.02) & (alpha < 0.98)
a_safe = np.maximum(alpha[semi], 0.15)[:, None]
fg_rgb[semi] = np.clip((fg_rgb[semi] - (1.0 - a_safe) * bg_rgb[None, :]) / a_safe, 0.0, 255.0)

hero_rgba_full = np.dstack([
    np.clip(fg_rgb, 0, 255).astype(np.uint8),
    np.clip(alpha * 255.0, 0, 255).astype(np.uint8),
])

# Target game plate resolution: 1024 x 1526 (crisp 2x retina inside 1376x768 stream canvas)
TARGET_W = 1024
TARGET_H = int(round(H0 * (TARGET_W / W0)))
scale = TARGET_W / W0
hero_plate = Image.fromarray(hero_rgba_full, "RGBA").resize((TARGET_W, TARGET_H), Image.Resampling.LANCZOS)
hero_plate.save("public/art/heroine_t1_base.webp", "WEBP", quality=95, method=6)
print(f"Saved heroine_t1_base.webp: {TARGET_W}x{TARGET_H}")

# 2. Subpixel-align face patches (face crop in raw was (559, 101, 1136, 758))
FX0, FY0, FX1, FY1 = int(W0 * 0.33), int(H0 * 0.04), int(W0 * 0.67), int(H0 * 0.30)
CW, CH = FX1 - FX0, FY1 - FY0
face_ref = raw_hero[FY0:FY1, FX0:FX1].astype(np.float32)
gray_ref = cv2.cvtColor(face_ref.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)


def build_face_patch(gen_path: str, out_webp: str, focus_box_norm: tuple[float, float, float, float]):
    gen_im = Image.open(gen_path).convert("RGB").resize((CW, CH), Image.Resampling.LANCZOS)
    gen_arr = np.array(gen_im).astype(np.float32)
    gray_gen = cv2.cvtColor(gen_arr.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    (dx, dy), resp = cv2.phaseCorrelate(gray_gen, gray_ref)
    print(f"{out_webp} phaseCorrelate shift=({dx:.3f}, {dy:.3f}) px, resp={resp:.3f}")
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    aligned = cv2.warpAffine(gen_arr, M, (CW, CH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

    # Build smooth elliptical/feathered mask strictly inside facial interior (eyes/cheeks/lips)
    # so hair exterior, headphones, and fingers never ghost
    nx0, ny0, nx1, ny1 = focus_box_norm
    px0, py0, px1, py1 = int(CW * nx0), int(CH * ny0), int(CW * nx1), int(CH * ny1)
    mask = np.zeros((CH, CW), dtype=np.float32)

    # Pure smooth interior window over the target facial features (alpha=1.0 across both eyes / cheeks / mouth)
    interior = np.zeros((CH, CW), dtype=np.float32)
    cv2.rectangle(interior, (px0, py0), (px1, py1), 1.0, -1)
    # Carve out the fingers touching right cheek (viewer's right, lower corner: x > 0.64, y > 0.69)
    interior[int(CH * 0.69):, int(CW * 0.64):] = 0.0
    interior = cv2.GaussianBlur(interior, (25, 25), 7.0)

    mask = np.clip(interior, 0.0, 1.0) * alpha[FY0:FY1, FX0:FX1]
    # Force zero only on 6px outer border of crop
    border = np.ones((CH, CW), dtype=np.float32)
    border[:6, :] = 0
    border[-6:, :] = 0
    border[:, :6] = 0
    border[:, -6:] = 0
    border = cv2.GaussianBlur(border, (11, 11), 3.0)
    mask *= border

    # Map crop box to target plate coordinates
    tx0 = int(round(FX0 * scale))
    ty0 = int(round(FY0 * scale))
    tx1 = int(round(FX1 * scale))
    ty1 = int(round(FY1 * scale))
    tw, th = tx1 - tx0, ty1 - ty0

    rgba = np.dstack([
        np.clip(aligned, 0, 255).astype(np.uint8),
        np.clip(mask * 255.0, 0, 255).astype(np.uint8),
    ])
    patch_im = Image.fromarray(rgba, "RGBA").resize((tw, th), Image.Resampling.LANCZOS)
    patch_im.save(f"public/art/{out_webp}", "WEBP", quality=95, method=6)
    return {"file": f"/art/{out_webp}", "x": tx0, "y": ty0, "width": tw, "height": th, "shiftPx": [round(float(dx), 3), round(float(dy), 3)]}


# In t1_hot_face_ref: eyes+brows are x: 0.16..0.84, y: 0.40..0.68; full face interior is x: 0.16..0.84, y: 0.40..0.86
blink_meta = build_face_patch("art-studio/raw/t1_hot_blink.png", "patch_t1_blink.webp", (0.11, 0.38, 0.85, 0.69))
fluster_meta = build_face_patch("art-studio/raw/t1_hot_fluster.png", "patch_t1_fluster.webp", (0.11, 0.38, 0.85, 0.88))

# 3. Process Room Background (1376 x 768) + Foreground Desk Overlay (mug + desk plank + USB mic)
SCENE_W, SCENE_H = 1376, 768
bg_im = Image.open("art-studio/raw/bg_webcam_t1.png").convert("RGB").resize((SCENE_W, SCENE_H), Image.Resampling.LANCZOS)
bg_im.save("public/art/bg_room_t1.webp", "WEBP", quality=95, method=6)

bg_arr = np.array(bg_im)
# Extract foreground desk plank (bottom lip y >= 706) + left tea mug + right USB microphone
fg_alpha = np.zeros((SCENE_H, SCENE_W), dtype=np.float32)
# Wooden desk surface across bottom (y: 707..768)
fg_alpha[709:, :] = 1.0
# Left mug region (x: 24..236, y: 602..715): mug is brighter/cooler purple-white than dark floor behind it
mug_zone = bg_arr[598:715, 20:240].astype(np.float32)
# Use grabCut for crisp mug & microphone foreground masks!
mask_gc = np.zeros((SCENE_H, SCENE_W), np.uint8)
mask_gc[:, :] = cv2.GC_PR_BGD
mask_gc[:580, :] = cv2.GC_BGD
mask_gc[580:706, 250:1130] = cv2.GC_BGD  # center rug is strictly background!
mask_gc[714:, :] = cv2.GC_FGD             # bottom desk plank is foreground
mask_gc[612:712, 55:175] = cv2.GC_FGD     # core of tea mug
mask_gc[595:714, 24:242] = np.where(mask_gc[595:714, 24:242] == cv2.GC_FGD, cv2.GC_FGD, cv2.GC_PR_FGD)
mask_gc[465:712, 1185:1280] = cv2.GC_FGD  # core of right USB microphone
mask_gc[450:714, 1155:1320] = np.where(mask_gc[450:714, 1155:1320] == cv2.GC_FGD, cv2.GC_FGD, cv2.GC_PR_FGD)

bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)
cv2.grabCut(bg_arr, mask_gc, None, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_MASK)
fg_mask = np.where((mask_gc == cv2.GC_FGD) | (mask_gc == cv2.GC_PR_FGD), 1.0, 0.0).astype(np.float32)
fg_mask[711:, :] = 1.0
fg_mask[580:707, 250:1140] = 0.0
fg_mask = cv2.GaussianBlur(fg_mask, (5, 5), 1.0)

fg_rgba = np.dstack([bg_arr, np.clip(fg_mask * 255.0, 0, 255).astype(np.uint8)])
Image.fromarray(fg_rgba, "RGBA").save("public/art/fg_desk_t1.webp", "WEBP", quality=95, method=6)
print("Saved bg_room_t1.webp and fg_desk_t1.webp")

# 4. Write TypeScript manifest for PixiJS rig
manifest = {
    "sceneWidth": SCENE_W,
    "sceneHeight": SCENE_H,
    "heroinePlate": {
        "file": "/art/heroine_t1_base.webp",
        "width": TARGET_W,
        "height": TARGET_H,
    },
    "patches": {
        "blink": blink_meta,
        "fluster": fluster_meta,
    },
}
with open("src/heroine_manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)

# 5. Generate QA verification images (.qa-out/):
# (a) Heroine on #00FF00 neon green + 3x crops of hair/headset, elbows/armrests, and bare toes
green = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 255, 0, 255))
green_comp = Image.alpha_composite(green, hero_plate)
green_comp.save(".qa-out/qa_green_full.png")

# 3x crops on #00FF00: face+blink, armrest gap, bare feet toes
c_feet = green_comp.crop((int(TARGET_W * 0.20), int(TARGET_H * 0.76), int(TARGET_W * 0.80), int(TARGET_H * 0.98)))
c_feet.resize((c_feet.width * 2, c_feet.height * 2), Image.Resampling.NEAREST).save(".qa-out/qa_green_feet_2x.png")

# (b) Full scene composite preview (bg + scaled heroine + blink/fluster check + fg desk overlay)
scene_comp = bg_im.convert("RGBA")
# Scale heroine so top of head is at y=22 and toes sit at y=696 (just above desk lip at y=710!), while chair stem goes behind desk!
hero_disp_h = 724
hero_disp_w = int(round(TARGET_W * (hero_disp_h / TARGET_H)))
hero_disp = hero_plate.resize((hero_disp_w, hero_disp_h), Image.Resampling.LANCZOS)
hx = (SCENE_W - hero_disp_w) // 2
hy = 20
scene_comp.alpha_composite(hero_disp, (hx, hy))
scene_comp.alpha_composite(Image.fromarray(fg_rgba, "RGBA"), (0, 0))
scene_comp.convert("RGB").save(".qa-out/qa_scene_preview.png")

# Face patch test on scene (blink + fluster side by side)
blink_im = Image.open("public/art/patch_t1_blink.webp").convert("RGBA")
flust_im = Image.open("public/art/patch_t1_fluster.webp").convert("RGBA")
p_blink = hero_plate.copy()
p_blink.alpha_composite(blink_im, (blink_meta["x"], blink_meta["y"]))
p_flust = hero_plate.copy()
p_flust.alpha_composite(flust_im, (fluster_meta["x"], fluster_meta["y"]))

strip = Image.new("RGB", (900, 360), (30, 26, 36))
fbox = (int(TARGET_W * 0.28), int(TARGET_H * 0.03), int(TARGET_W * 0.72), int(TARGET_H * 0.31))
for idx, plate_v in enumerate([hero_plate, p_blink, p_flust]):
    bg_dark = Image.new("RGBA", plate_v.size, (42, 34, 48, 255))
    comp_v = Image.alpha_composite(bg_dark, plate_v).crop(fbox).resize((300, 360), Image.Resampling.LANCZOS)
    strip.paste(comp_v.convert("RGB"), (idx * 300, 0))
strip.save(".qa-out/qa_patches_3up.png")
print("Saved QA diagnostics in .qa-out/")
