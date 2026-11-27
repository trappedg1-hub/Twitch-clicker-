#!/usr/bin/env python3
"""Build a "tongue out" mouth patch out of the emotion art the project already has.

`public/art/patch_t1_tease.webp` is the canonical Day-1 face — the same drawing, the same
headphones, the same lighting — winking with her tongue out. It is painted at 1:1 against the plate
(`CANONICAL_FACE` in `src/heroine/faceAnchors.ts` is exactly `{x:338, y:61, w:348, h:397}`, and the
file is 348x397), so the mouth in it lands on the mouth in the plate with no rescaling.

The patch is therefore not painted, not generated and not inferred: it is *crop of that art*, put
into the same frame as `{art}_mouth_open.webp` and blended through the same feathered window that
the face kit already uses. Outside the mouth, the open-mouth patch's own pixels are kept, because
the tease face blushes harder and a blush that jumps on every state change is a flicker.

Usage:
    python3 scripts/build_mouth_tongue.py                     # every art with a canonical face
    python3 scripts/build_mouth_tongue.py t1_s0 --check out.png
    python3 scripts/build_mouth_tongue.py t1_s5 --emotion public/art/patch_t1_s5_tease.webp
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

KIT = Path("public/art/face_kit")
ART = Path("public/art")
MANIFEST = KIT / "manifest.json"

# Where the emotion patch sits on each plate and which file it is — the same numbers as
# `FACE_ANCHORS` in `src/heroine/faceAnchors.ts`. Only plates drawn from the canonical Day-1 face
# can take the canonical tongue art; the Day 3-6 plates are separately drawn close-ups, and a crop
# of one face does not land on another (that is the whole reason `FACE_PATCH_COVERED_PLATES`
# exists). Those keep two mouth states.
ANCHORS: dict[str, tuple[int, int, int, int, str]] = {
    "t1_base": (338, 61, 348, 397, "patch_t1_tease.webp"),
    "t1_s0": (338, 61, 348, 397, "patch_t1_tease.webp"),
    "t1_s1": (338, 61, 348, 397, "patch_t1_tease.webp"),
    "t1_s2": (338, 61, 348, 397, "patch_t1_tease.webp"),
    "t1_s4": (338, 61, 348, 397, "patch_t1_tease.webp"),
    "t2_s0": (336, 60, 347, 395, "patch_t1_tease.webp"),
    "t2_s1": (336, 60, 347, 395, "patch_t1_tease.webp"),
}


def mouth_window(base: Image.Image, tongue: Image.Image) -> np.ndarray:
    """Soft ellipse over the place where the two mouths disagree — and nowhere else.

    Not over the patch's mouth box: that box is generous (254x114 for a mouth 100 wide) and
    replacing all of it drags the emo art's transparent corner into the patch as a black slab.
    What changes between the two states *is* the mouth, so the window is measured from that.
    """
    a = np.asarray(base).astype(np.float32)
    b = np.asarray(tongue).astype(np.float32)
    both = (a[..., 3] > 200) & (b[..., 3] > 200)
    diff = (np.abs(a[..., :3] - b[..., :3]).mean(axis=2) > 22) & both
    if diff.sum() < 80:
        return np.zeros(a.shape[:2], np.float32)
    ys, xs = np.nonzero(diff)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    rx, ry = (x1 - x0) * 0.62, (y1 - y0) * 0.78
    yy, xx = np.mgrid[0 : a.shape[0], 0 : a.shape[1]]
    inside = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
    soft = Image.fromarray((inside * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3.5))
    return np.asarray(soft).astype(np.float32) / 255.0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("arts", nargs="*", default=None)
    ap.add_argument("--emotion", default=None, help="override the emotion patch (per art)")
    ap.add_argument("--dx", type=int, default=0)
    ap.add_argument("--dy", type=int, default=0)
    ap.add_argument("--check", default=None)
    args = ap.parse_args(argv)

    manifest = json.loads(MANIFEST.read_text())
    arts = args.arts or list(ANCHORS)
    checks, made, skipped = [], 0, []
    for art in arts:
        entry = manifest.get(f"heroine_{art}") or {}
        patch = (entry.get("patches") or {}).get("mouth_open")
        anchor = ANCHORS.get(art)
        if not patch or (not anchor and not args.emotion):
            skipped.append(art)
            continue
        ax, ay, aw, ah, src_name = anchor if anchor else (CANONICAL[0], CANONICAL[1], CANONICAL[2], CANONICAL[3], args.emotion)
        emo_path = ART / src_name
        open_path = KIT / f"{art}_mouth_open.webp"
        if not emo_path.exists() or not open_path.exists():
            skipped.append(art)
            continue

        w, h = patch["w"], patch["h"]
        # The mouth box in plate coordinates is the patch frame; the emotion art sits at 1:1 on the
        # canonical face, so the same region of it is the same pixels of the same face.
        px = patch["cx"] - w / 2.0
        py = patch["cy"] - h / 2.0
        emo = Image.open(emo_path).convert("RGBA")
        # Plate -> emotion patch: the art is drawn into its anchor box, so this is a straight scale.
        sx, sy = emo.width / aw, emo.height / ah
        ex = (px - ax + args.dx) * sx
        ey = (py - ay + args.dy) * sy
        if ex < 0 or ey < 0 or ex + w * sx > emo.width or ey + h * sy > emo.height:
            print(f"{art}: the mouth falls outside {src_name} — skipped")
            skipped.append(art)
            continue
        crop = emo.crop((int(round(ex)), int(round(ey)), int(round(ex + w * sx)), int(round(ey + h * sy))))
        if crop.size != (w, h):
            crop = crop.resize((w, h), Image.LANCZOS)

        base = Image.open(open_path).convert("RGBA")
        if base.size != (w, h):
            skipped.append(art)
            continue
        mask = mouth_window(base, crop)[..., None]
        a = np.asarray(base).astype(np.float32)
        b = np.asarray(crop).astype(np.float32)
        # Keep the open patch's alpha: both states then blend into the plate identically.
        # Only where the emotion art is actually painted: its own alpha edges are the seam the
        # first version left next to her mouth.
        keep = mask * (b[..., 3:4] / 255.0)
        rgb = a[..., :3] * (1 - keep) + b[..., :3] * keep
        out = Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a[..., 3]]).astype(np.uint8))
        out.save(KIT / f"{art}_mouth_tongue.webp", "WEBP", quality=95, method=6)
        entry.setdefault("patches", {})["mouth_tongue"] = dict(patch)
        made += 1
        checks.append((base, out))
    if made:
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    if args.check and checks:
        w, h = checks[0][0].size
        rows = min(len(checks), 5)
        sheet = Image.new("RGB", (w * 2, h * rows), (26, 26, 34))
        for i, (a, b) in enumerate(checks[:rows]):
            for j, im in enumerate((a, b)):
                card = Image.new("RGBA", im.size, (26, 26, 34, 255))
                card.alpha_composite(im)
                sheet.paste(card.convert("RGB"), (j * w, i * h))
        sheet.resize((sheet.width * 2, sheet.height * 2), Image.LANCZOS).save(args.check)
    print(f"{made} tongue patches, {len(skipped)} arts skipped: {' '.join(skipped) if skipped else '-'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
