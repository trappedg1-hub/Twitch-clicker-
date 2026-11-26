#!/usr/bin/env python3
"""Day 3 «призрачная стримерша» — two-layer plate pipeline.

Sources in art-studio/raw (square renders, 2048x2048 / 1024x1024):
  t3_ghost_base_r2.png   strapless glossy bodysuit with the slipped side, bare belly, FULL fishnet
                         stockings over legs AND feet, both soles to camera  -> FLASH / REVEAL plate
  t3_ghost_sheet_r1.png  the exact same frame wearing a drum-taut bed sheet  -> sheet layer donor

Both raws share the composition (the donor is an edit of the base), so the square canvas is cropped to
the plate aspect around the figure with ONE crop box reused for both - the legs stay pixel-locked and
the sheet never needs its own alignment pass.

The sheet is EXTRACTED as its own transparent RGBA layer (pale cloth pixels that differ from the base).
The eye/mouth holes are transparent by construction, so the face that shows through a hole is always
the BASE face: no face is ever pasted onto another plate. The five ladder stages are then baked as
base + the same sheet layer cut differently:

  s0 full taut sheet  ·  s1 slipped off one shoulder  ·  s2 pulled even tighter (loose lap folds cut)
  s3 hem lifted above mid-thigh  ·  s4 sheet only as a shoulder cape (face free)

Outputs: public/art/heroine_t3_s0..s4.webp, public/art/heroine_t3_flash.webp,
         art-studio/layers/t3_sheet_full.png, src/heroine/faceAnchors.ts,
         .qa-out/day3_ghost_sheet.png, .qa-out/day3_face_check.png
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art-studio" / "raw"
LAYERS = ROOT / "art-studio" / "layers"
OUT = ROOT / "public" / "art"
QA = ROOT / ".qa-out"

BASE_RAW = RAW / "t3_ghost_base_r2.png"
SHEET_RAW = RAW / "t3_ghost_sheet_r1.png"

PLATE_W, PLATE_H = 1024, 1526
ASPECT = PLATE_W / PLATE_H  # 0.6710 - plate canvas is a tall portrait

# The Day-1 master box the emotion/blink patches were cut for.
CANON_FACE = (338, 61, 348, 397)
# Her eyes on the Day-1 master, and the eye-to-eye span there: the ghost plates draw her head
# smaller, so the patch box is scaled and slid by exactly that measured similarity.
CANON_EYE_MID = (470.0, 305.0)
CANON_EYE_SPAN = 110.0
GHOST_EYE_MID = (507.5, 338.5)  # plate pixels, read off the cropped t3_ghost_base_r2 flash plate
GHOST_EYE_SPAN = 105.0

# Which stages keep the sheet over her face -> emotion/blink patches must be skipped there.
SHEET_COVERS_FACE = {
    "heroine_t3_s0.webp",
    "heroine_t3_s1.webp",
    "heroine_t3_s2.webp",
    "heroine_t3_s3.webp",
}


def load(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    return im


def crop_box(base: Image.Image) -> tuple[int, int, int, int]:
    """Portrait crop box around the figure, computed once from the BASE frame.

    The donor reuses it, so the two layers stay locked to the same pixels.
    """
    a = np.asarray(base).astype(int)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    fg = np.abs(a - bg).sum(axis=2) > 60
    cols = np.nonzero(fg.any(axis=0))[0]
    H, W = fg.shape
    want = int(round(H * ASPECT))
    cx = int(round((int(cols.min()) + int(cols.max())) / 2))
    x0 = int(np.clip(cx - want // 2, 0, W - want))
    return (x0, 0, x0 + want, H)


def to_plate(img: Image.Image, box: tuple[int, int, int, int]) -> np.ndarray:
    crop = img.crop(box)
    big = crop.resize((PLATE_W, PLATE_H), Image.Resampling.LANCZOS)
    return np.asarray(big).astype(np.float32)


def bg_mask(plate: np.ndarray) -> np.ndarray:
    """The flat lilac studio background is a solid colour: find everything that is not it."""
    corners = np.stack([plate[6, 6], plate[6, -7], plate[-7, 6], plate[-7, -7]])
    ref = corners.mean(axis=0)
    dist = np.linalg.norm(plate - ref, axis=2)
    return dist > 42.0


def sheet_layer(base: np.ndarray, sheeted: np.ndarray, base_fg: np.ndarray) -> np.ndarray:
    """Extract ONLY the sheet as RGBA: pale cloth pixels that were not there in the base frame."""
    diff = np.linalg.norm(sheeted - base, axis=2)
    lum = sheeted.mean(axis=2)
    mx = sheeted.max(axis=2)
    mn = sheeted.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1e-3)
    pale = (lum > 148) & (sat < 0.22)
    moved = diff > 26.0
    mask = pale & moved & base_fg  # never paint over the empty studio background

    binimg = Image.fromarray((mask * 255).astype(np.uint8))
    binimg = binimg.filter(ImageFilter.MedianFilter(5))
    binimg = binimg.filter(ImageFilter.MaxFilter(3))  # keep the ragged scissor edge
    m = np.asarray(binimg) > 40

    rgba = np.zeros((PLATE_H, PLATE_W, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(sheeted, 0, 255).astype(np.uint8)
    alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    rgba[..., 3] = np.asarray(alpha)
    return rgba


def cut(mask: np.ndarray, *, rows_above=None, erase_box=None, keep_box=None) -> np.ndarray:
    """Region surgery on the sheet mask - the whole ladder is ONE layer, cut differently."""
    m = mask.copy()
    if rows_above is not None:
        m[rows_above:, :] = False
    out = Image.fromarray((m * 255).astype(np.uint8))
    if erase_box:
        # PIL composite keeps image1 where mask is 255: the hole mask is white EVERYWHERE except
        # the ellipse, so image1 must be the sheet and image2 the empty 0 - that erases the ellipse.
        for box in erase_box:
            hole = Image.new("L", out.size, 255)
            ImageDraw.Draw(hole).ellipse(box, fill=0)
            out = Image.composite(out, Image.new("L", out.size, 0), hole)
    if keep_box:
        keep = Image.new("L", out.size, 0)
        for box in keep_box:
            ImageDraw.Draw(keep).ellipse(box, fill=255)
        out = Image.composite(out, Image.new("L", out.size, 0), keep)
    return np.asarray(out) > 40


def ghost_face_anchor() -> tuple[int, int, int, int]:
    """Scale + slide the canonical patch box onto her smaller ghost-plate head."""
    k = GHOST_EYE_SPAN / CANON_EYE_SPAN
    w = round(CANON_FACE[2] * k)
    h = round(CANON_FACE[3] * k)
    off = (CANON_EYE_MID[0] - (CANON_FACE[0] + CANON_FACE[2] / 2), CANON_EYE_MID[1] - (CANON_FACE[1] + CANON_FACE[3] / 2))
    cx = GHOST_EYE_MID[0] - off[0] * k
    cy = GHOST_EYE_MID[1] - off[1] * k
    return (int(np.clip(cx - w / 2, 0, PLATE_W - w)), int(np.clip(cy - h / 2, 0, PLATE_H - h)), w, h)


def main() -> None:
    LAYERS.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    (QA / "plates").mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    base_img = load(BASE_RAW)
    sheet_img = load(SHEET_RAW)
    if sheet_img.size != base_img.size:
        sheet_img = sheet_img.resize(base_img.size, Image.Resampling.LANCZOS)
    box = crop_box(base_img)
    print(f"crop box (plate aspect {ASPECT:.4f}) = {box}")

    base = to_plate(base_img, box)
    sheeted = to_plate(sheet_img, box)
    fg = bg_mask(base)

    layer = sheet_layer(base, sheeted, fg)
    Image.fromarray(layer).save(LAYERS / "t3_sheet_full.png")
    sheet_rgb, sheet_a = layer[..., :3], layer[..., 3] > 8
    H, W = PLATE_H, PLATE_W

    # Stage geometry in plate rows. The desk layer (fg_desk_t1) hides plate rows >= 1453, so her
    # heels disappearing behind it is what sells "feet up on the desk".
    MID_THIGH = 855  # hem line for the lifted-sheet stage: full fishnet leg + hip out
    # The donor already lets go of her left shoulder (viewer-right), so the 7000 step peels the
    # fabric off the OTHER side too: shoulder, collarbone and the upper outer curve of one bust.
    SLIP_SHOULDER = (170, 350, 400, 590)
    HEAD_ZONE = (382, 90, 714, 452)  # never cover her face with the cape
    CAPE_SIDE = (110, 340, 430, 680)  # fabric hanging over her right shoulder and upper arm
    CAPE_SIDE_R = (630, 340, 950, 680)  # ... and her left one
    CAPE_COWL = (350, 425, 700, 545)  # the collar that stayed around her neck

    variants = {
        # s0: the meme ghost - taut sheet over head and body, eye/mouth holes free.
        "heroine_t3_s0.webp": sheet_a.copy(),
        # s1: slid off one shoulder (7000).
        "heroine_t3_s1.webp": cut(sheet_a, erase_box=[SLIP_SHOULDER]),
        # s2: pulled drum-taut (10000) - the loose lap folds are cut away, body-hugging cloth only.
        "heroine_t3_s2.webp": cut(
            sheet_a,
            keep_box=[(330, 120, 720, 900)],
            erase_box=[SLIP_SHOULDER],
        ),
        # s3: hem lifted (13000) - short sheet, the whole leg and the hip line are out.
        "heroine_t3_s3.webp": cut(sheet_a, rows_above=MID_THIGH, erase_box=[SLIP_SHOULDER]),
        # s4: cape finale (15000) - the sheet hangs off both shoulders like a mantle, her face,
        # chest and belly completely free.
        "heroine_t3_s4.webp": np.zeros((H, W), dtype=bool),
    }
    cape = cut(sheet_a, keep_box=[CAPE_SIDE, CAPE_SIDE_R, CAPE_COWL])
    no_head = np.ones((H, W), dtype=bool)
    x0, y0, x1, y1 = HEAD_ZONE
    no_head[y0:y1, x0:x1] = False
    variants["heroine_t3_s4.webp"] = cape & no_head

    base_u8 = np.clip(base, 0, 255).astype(np.uint8)
    anchor = ghost_face_anchor()
    anchors = {}
    contact = []
    for name, m in variants.items():
        comp = base_u8.copy()
        mm = m & sheet_a
        comp[mm] = sheet_rgb[mm]
        img = Image.fromarray(comp)
        # PNG proof next to the source renders (public/art stays webp-only, like every other day).
        img.save(QA / "plates" / name.replace(".webp", ".png"), optimize=True)
        img.convert("RGB").save(OUT / name, "WEBP", quality=92, method=6)
        contact.append((name, img))
        anchors[name] = anchor
        # The flash/reveal frame shares the base head, so the same anchor is used for the finale
        # plate too (see heroine_t3_flash below).
    anchors["heroine_t3_flash.webp"] = anchor

    Image.fromarray(base_u8).convert("RGB").save(OUT / "heroine_t3_flash.webp", "WEBP", quality=92, method=6)

    strip = Image.new("RGB", (W // 2 * (len(contact) + 1), H // 2 + 34), (18, 16, 26))
    d = ImageDraw.Draw(strip)
    for i, (name, im) in enumerate(contact + [("heroine_t3_flash", Image.fromarray(base_u8))]):
        small = im.resize((W // 2, H // 2), Image.Resampling.LANCZOS)
        strip.paste(small, (i * (W // 2), 30))
        d.text((i * (W // 2) + 6, 8), name.replace(".webp", ""), fill=(255, 214, 240))
    strip.save(QA / "day3_ghost_sheet.png")

    # Patch-box proof: draw the anchor and paste the real blush/blink patch on the flash plate.
    check = Image.fromarray(base_u8).copy()
    cd = ImageDraw.Draw(check)
    ax, ay, aw, ah = anchor
    cd.rectangle([ax, ay, ax + aw, ay + ah], outline=(0, 255, 255), width=4)
    cd.line([(ax - 40, ay + int(ah * 0.615)), (ax + aw + 40, ay + int(ah * 0.615))], fill=(255, 255, 0), width=3)
    patch = ROOT / "public" / "art" / "patch_t1_tease.webp"
    if patch.exists():
        p = Image.open(patch).convert("RGBA").resize((aw, ah))
        check.paste(p, (ax, ay), p)
    check.save(QA / "day3_face_check.png")

    write_face_anchors(anchors)
    for name in list(variants) + ["heroine_t3_flash.webp"]:
        print(f"{name}: face {anchors[name]} covered={name in SHEET_COVERS_FACE}")
    print("sheet pixels kept:", int(sheet_a.sum()), "of", int(fg.sum()), "figure pixels")


def write_face_anchors(anchors: dict[str, tuple[int, int, int, int]]) -> None:
    """Regenerate src/heroine/faceAnchors.ts, including the "sheet covers the face" set."""
    import re

    p = ROOT / "src" / "heroine" / "faceAnchors.ts"
    src = p.read_text()
    m = re.search(r"export const FACE_ANCHORS: Record<string, FaceAnchor> = \{(.*?)\n\};", src, re.S)
    assert m, "FACE_ANCHORS block not found"
    entry = re.compile(r'"([^"]+)"\s*:\s*\{\s*x:\s*(\d+),\s*y:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)\s*\}')
    data: dict[str, tuple[int, int, int, int]] = {
        name: (int(x), int(y), int(w), int(h)) for name, x, y, w, h in entry.findall(m.group(1))
    }
    data.update({k: tuple(v) for k, v in anchors.items()})  # type: ignore[arg-type]
    order = [k for k in data if k.startswith("heroine_t3")] + [k for k in data if not k.startswith("heroine_t3")]
    body = "\n" + "\n".join(f'  "{k}": {{ x: {data[k][0]}, y: {data[k][1]}, w: {data[k][2]}, h: {data[k][3]} }},' for k in order)
    src = src[: m.start(1)] + body + src[m.end(1) :]

    cov = re.search(r"export const FACE_PATCH_COVERED_PLATES: ReadonlySet<string> = new Set\(\[(.*?)\]\);", src, re.S)
    covered = ",\n  ".join(f'"{name}"' for name in sorted(SHEET_COVERS_FACE)) + ","
    if cov:
        src = src[: cov.start(1)] + f"\n  {covered}\n" + src[cov.end(1) :]
    else:
        src = src.rstrip() + (
            "\n\n/** Plates whose face hides under a costume layer: emotion/blink patches must stay off. */\n"
            "export const FACE_PATCH_COVERED_PLATES: ReadonlySet<string> = new Set([\n  " + covered + "\n]);\n"
        )
    p.write_text(src)
    print("faceAnchors.ts regenerated")


if __name__ == "__main__":
    main()
