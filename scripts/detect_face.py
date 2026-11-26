#!/usr/bin/env python3
"""Find the eyes and mouth on a heroine plate, so the face-kit pipeline can run unattended.

An iris is the only strongly saturated cool spot on a warm face, which makes it a reliable
anchor; the sclera is not — shaded white reads as skin. The mouth is found near the face
centre-line below the eyes, by lip colour.

Writes a manifest keyed by plate name:

    {
      "heroine_t1_s0": {"eyes": [[438,296,518,346], [548,270,622,320]],
                        "mouth": [496,368,592,400], "face": [x0,y0,x1,y1]}
    }

Usage:
    python3 scripts/detect_face.py                       # all plates -> manifest + contact sheet
    python3 scripts/detect_face.py --plate public/art/heroine_t1_s0.webp --verbose
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ART = Path("public/art")
MANIFEST = ART / "face_kit" / "manifest.json"
SHEET = Path("deliverables/concept/face_kit/face_boxes.png")


def components(mask: np.ndarray, min_px: int = 20) -> list[np.ndarray]:
    h, w = mask.shape
    seen = np.zeros_like(mask)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        pix = []
        while stack:
            y, x = stack.pop()
            pix.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if len(pix) >= min_px:
            out.append(np.array(pix))
    return out


def detect(rgb: np.ndarray, verbose: bool = False) -> dict | None:
    h, w = rgb.shape[:2]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    v = rgb.max(axis=2)

    # Iris: cool against warm skin. Hair highlights are cool too, so candidates are filtered by
    # the skin around them — an eye is a hole in the face, a highlight sits on hair.
    skin = (v > 150) & (r > b + 10) & (r > 150)
    face_blob = np.asarray(
        Image.fromarray((skin * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))
    ) > 90
    near_face = np.asarray(
        Image.fromarray((face_blob * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(11))
    ) > 0

    cool = (b - g >= 10) & (v > 55) & (v < 240) & (r < b + 34)
    region = np.zeros((h, w), bool)
    region[int(h * 0.06) : int(h * 0.40), int(w * 0.14) : int(w * 0.86)] = True
    cand = cool & region
    cand = np.asarray(
        Image.fromarray((cand * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    ) > 127

    blobs = [c for c in components(cand, min_px=30) if near_face[c[:, 0], c[:, 1]].mean() > 0.8]
    # An iris is often split by the pupil: glue blobs that are close together.
    merged: list[np.ndarray] = []
    for blob in sorted(blobs, key=len, reverse=True):
        for i, other in enumerate(merged):
            dx = abs(blob[:, 1].mean() - other[:, 1].mean())
            dy = abs(blob[:, 0].mean() - other[:, 0].mean())
            if dx < 14 and dy < 8:
                merged[i] = np.concatenate([other, blob])
                break
        else:
            merged.append(blob)
    blobs = merged

    def geometric_fallback() -> dict:
        """No trustworthy iris pair: place the eye band from the face itself.

        The window only has to contain both eyes with a little margin — the pixels come from the
        generation, the box is just a stencil. So a band across the upper third of the face is
        enough, and it beats hand-entering coordinates for awkward poses.
        """
        ys, xs = np.nonzero(face_blob)
        if len(xs) < 2000:
            return None
        fx0, fx1, fy0, fy1 = xs.min(), xs.max(), ys.min(), ys.max()
        fw, fh = fx1 - fx0, fy1 - fy0
        cy = fy0 + 0.30 * fh
        half_w, half_h = 0.33 * fw, 0.105 * fh
        cx = (fx0 + fx1) / 2
        eyes = [
            [int(cx - half_w), int(cy - half_h), int(cx - 2), int(cy + half_h)],
            [int(cx + 2), int(cy - half_h), int(cx + half_w), int(cy + half_h)],
        ]
        dist = 2 * half_w
        mouth = [int(cx - 0.55 * dist + 0.10 * dist), int(cy + 0.80 * dist - 0.24 * dist),
                 int(cx - 0.55 * dist + 0.10 * dist + 1.2 * dist), int(cy + 0.80 * dist + 0.24 * dist)]
        face = [eyes[0][0] - 12, eyes[0][1] - 16, eyes[1][2] + 12, mouth[3] + 12]
        return {"eyes": eyes, "mouth": mouth, "face": face, "fallback": True}

    if len(blobs) < 2:
        fb = geometric_fallback()
        return fb

    # Pair the two largest blobs, one left of the other, roughly level.
    blobs.sort(key=len, reverse=True)
    best = None
    for i in range(min(len(blobs), 5)):
        for j in range(i + 1, min(len(blobs), 5)):
            a, b_ = blobs[i], blobs[j]
            ax, ay = a[:, 1].mean(), a[:, 0].mean()
            bx, by = b_[:, 1].mean(), b_[:, 0].mean()
            if abs(ax - bx) < 12:
                continue
            dy = abs(ay - by)
            dist = abs(ax - bx)
            # A pair of eyes is level, evenly sized and about a face-width apart. Without these
            # rules the detector happily pairs an eye with a hand or an earring.
            if dy > 32 or not (58 < dist < 145):
                continue
            ratio = min(len(a), len(b_)) / max(len(a), len(b_))
            if ratio < 0.45:
                continue
            score = (len(a) + len(b_)) * ratio - dy * 8
            if best is None or score > best[0]:
                best = (score, (a, b_))
    if best is None:
        return geometric_fallback()

    eyes = []
    for blob in best[1]:
        ys, xs = blob[:, 0], blob[:, 1]
        cx, cy = xs.mean(), ys.mean()
        rx = max((xs.max() - xs.min()) / 2, 5) * 1.55
        ry = max((ys.max() - ys.min()) / 2, 4) * 1.9
        eyes.append([int(cx - rx), int(cy - ry), int(cx + rx), int(cy + ry)])
    eyes.sort(key=lambda e: e[0])
    if eyes[0][0] < 0 or eyes[1][2] > w:
        return geometric_fallback()

    # Mouth: derived from the eyes by face proportions. Lip-colour detection was tried and is not
    # usable — blush is the same colour as lipstick, so the box slid onto the cheek.
    left, right = eyes[0], eyes[1]
    cx_l, cy_l = (left[0] + left[2]) / 2, (left[1] + left[3]) / 2
    cx_r, cy_r = (right[0] + right[2]) / 2, (right[1] + right[3]) / 2
    dist = np.hypot(cx_r - cx_l, cy_r - cy_l)
    mid_x, mid_y = (cx_l + cx_r) / 2, (cy_l + cy_r) / 2
    mouth_cx = mid_x + 0.10 * dist
    mouth_cy = mid_y + 0.80 * dist
    half_w, half_h = 0.60 * dist, 0.24 * dist
    mouth = [int(mouth_cx - half_w), int(mouth_cy - half_h),
             int(mouth_cx + half_w), int(mouth_cy + half_h)]

    face = [eyes[0][0] - 12, eyes[0][1] - 16, eyes[1][2] + 12, mouth[3] + 12]
    if verbose:
        print(f"eyes {eyes} mouth {mouth}")
    return {"eyes": eyes, "mouth": mouth, "face": face}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plate", default=None)
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args(argv)

    plates = [Path(args.plate)] if args.plate else sorted(ART.glob("heroine_*.webp"))
    manifest = {}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text())

    sheet_rows = []
    for plate in plates:
        key = plate.stem
        rgb = np.asarray(Image.open(plate).convert("RGB")).astype(np.float32)
        found = detect(rgb, args.verbose)
        if found is None:
            print(f"{key}: not found")
            continue
        manifest[key] = found
        sheet_rows.append((key, Image.open(plate).convert("RGB"), found))
        print(f"{key}: eyes {found['eyes']} mouth {found['mouth']}")

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=1))
    print(f"wrote {MANIFEST} ({len(manifest)} plates)")

    if sheet_rows:
        tw, th = 240, 200
        cols = 5
        rows = (len(sheet_rows) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tw, rows * (th + 22)), (18, 16, 22))
        d = ImageDraw.Draw(sheet)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
        for i, (key, img, found) in enumerate(sheet_rows):
            x, y = (i % cols) * tw, (i // cols) * (th + 22)
            fx0, fy0, fx1, fy1 = found["face"]
            pad = 30
            crop = img.crop((max(fx0 - pad, 0), max(fy0 - pad, 0),
                             min(fx1 + pad, img.width), min(fy1 + pad, img.height)))
            scale = min(tw / crop.width, th / crop.height)
            crop = crop.resize((int(crop.width * scale), int(crop.height * scale)), Image.LANCZOS)
            sheet.paste(crop, (x, y + 20))
            cd = ImageDraw.Draw(crop)
            for ex0, ey0, ex1, ey1 in found["eyes"]:
                cd.rectangle([(ex0 - (fx0 - pad)) * scale, (ey0 - (fy0 - pad)) * scale,
                              (ex1 - (fx0 - pad)) * scale, (ey1 - (fy0 - pad)) * scale],
                             outline=(0, 255, 120))
            mx0, my0, mx1, my1 = found["mouth"]
            cd.rectangle([(mx0 - (fx0 - pad)) * scale, (my0 - (fy0 - pad)) * scale,
                          (mx1 - (fx0 - pad)) * scale, (my1 - (fy0 - pad)) * scale],
                         outline=(255, 138, 176))
            sheet.paste(crop, (x, y + 20))
            d.text((x + 2, y + 3), key.replace("heroine_", ""), font=font, fill=(200, 195, 205))
        SHEET.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(SHEET)
        print(f"wrote {SHEET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(__import__("sys").argv[1:]))
