#!/usr/bin/env python3
"""Register a painted "tongue out" mouth patch so the rig picks it up.

The mouth is a slot: `mouth_open` and `mouth_closed` are trimmed patches of the same face, switched
by stepped keys. A third state — tongue out — is one more patch, and it has to be *art*: six
procedural attempts were rejected by eye (see `docs/rig-pilot.md`), because a shape laid over a
painted lower lip reads as a sticker at every size.

This is the recipe for the art, and the tool that files it:

  1. Take the open-mouth patch of that art, `public/art/face_kit/{art}_mouth_open.webp`, and paint
     the tongue over it — same canvas, same framing, same lighting. Anything that keeps the whole
     face in the same place will register; a redraw that moves the face will not.
  2. Run:
         python3 scripts/add_mouth_patch.py --art t1_s0 --image ~/tongue_t1_s0.png
     The file is resized to the open-mouth patch's exact pixel size (the rig places both with the
     same centre and size from the manifest, so they must match), converted to WebP, and registered
     as `patches.mouth_tongue`.
  3. `python3 scripts/build_miya_rig.py --art t1_s0 && node scripts/publish_rigs.mjs`

The builder does the rest by itself: it adds the image, the `tongue` attachment on `slot_mouth`, and
a `tease` beat (tongue held ~1.2 s, with a small head tilt). Arts without a tongue patch keep two
mouth states and no `tease` animation, which is why this step is per art.

Check before committing: `--check out.png` writes the open mouth next to the new patch.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

KIT = Path("public/art/face_kit")
MANIFEST = KIT / "manifest.json"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--art", required=True, help="art key, e.g. t1_s0")
    ap.add_argument("--image", required=True, help="painted tongue-out mouth patch")
    ap.add_argument("--check", default=None, help="write a side-by-side preview here")
    ap.add_argument("--dry", action="store_true", help="validate only, write nothing")
    args = ap.parse_args(argv)

    manifest = json.loads(MANIFEST.read_text())
    entry = manifest.get(f"heroine_{args.art}")
    if not entry:
        print(f"{args.art}: not in the manifest")
        return 1
    patches = entry.get("patches") or {}
    if "mouth_open" not in patches:
        print(f"{args.art}: no open-mouth patch — this art has no mouth slot at all")
        return 1
    mouth = patches["mouth_open"]
    open_path = KIT / f"{args.art}_mouth_open.webp"
    if not open_path.exists():
        print(f"{args.art}: {open_path} is missing")
        return 1

    src = Image.open(args.image).convert("RGBA")
    ref = Image.open(open_path).convert("RGBA")
    if abs(src.width / src.height - ref.width / ref.height) > 0.12:
        print(
            f"aspect {src.width}x{src.height} is {src.width / src.height:.2f}, "
            f"the open mouth is {ref.width / ref.height:.2f} — this is a different crop, "
            f"it will register badly"
        )
        return 1
    alpha = np.asarray(src)[..., 3]
    if (alpha > 32).mean() > 0.9:
        print("the art has no transparent edge: it looks like a full frame, not a patch")
        return 1

    out = src.resize((ref.width, ref.height), Image.LANCZOS)
    if args.check:
        sheet = Image.new("RGB", (ref.width * 2, ref.height), (26, 26, 34))
        for i, im in enumerate((ref, out)):
            card = Image.new("RGBA", im.size, (26, 26, 34, 255))
            card.alpha_composite(im)
            sheet.paste(card.convert("RGB"), (i * ref.width, 0))
        sheet.resize((sheet.width * 2, sheet.height * 2), Image.LANCZOS).save(args.check)
    if args.dry:
        print(f"{args.art}: ok, {ref.width}x{ref.height}, would write {args.art}_mouth_tongue.webp")
        return 0

    out.save(KIT / f"{args.art}_mouth_tongue.webp", "WEBP", quality=94, method=6)
    entry.setdefault("patches", {})["mouth_tongue"] = dict(mouth)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f"{args.art}: {KIT}/{args.art}_mouth_tongue.webp written, manifest updated")
    print("next: python3 scripts/build_miya_rig.py --art " + args.art + " && node scripts/publish_rigs.mjs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
