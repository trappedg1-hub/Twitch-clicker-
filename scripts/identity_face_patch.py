#!/usr/bin/env python3
"""Give a plate an `eyes_closed` patch made of its own pixels, so it can carry a rig.

Four art plates have no face kit, and no kit can be authored for them:

| art | why the eye patch cannot be drawn |
|---|---|
| `t3_s0` | scare frame — the lids are drawn as ink, a photo-real lid fights the line work |
| `t4_s1` | the source was rejected by the generation filter; one eye is already a wink |
| `t4_s0` | one eye is shut in the canon plate itself (she is mid-stretch, laughing) |
| `t5_s3` | she is seen from behind; there is no face in the frame at all |

The rig builder refuses an art without `patches.eyes_closed`, which is the honest gate: a document
with a blink that swaps in the same picture is a promise that pays nothing. But *refusing to rig*
is the wrong answer too — the body has breath, sway, turn, settle, shiver and tap reactions that
have nothing to do with the face, and without a document those four plates reach the player as a
still image at the two moments the story is loudest (the day-3 scare, the day-4 stretch, the day-5
bottom-up shot).

So the patch is the plate's own pixels: a crop of the face window, saved lossless, registered as
`eyes_closed`. `blink` then shows the same picture it hides — the clip exists, the runtime is
happy, and nothing moves. What the art cannot do (a lid), the document does not claim.

Everything else about the build is untouched: the eye boxes still place the skeleton, `face` still
marks the rigid core, and the body animation is the same authoring as every other plate.

Usage:
    python3 scripts/identity_face_patch.py --art t3_s0 --mid 513,270 --span 91 \
        --face 430,235,585,375
    python3 scripts/identity_face_patch.py --art t5_s3 --mid 770,145 --span 74 \
        --face 664,72,906,300 --window 2.4,2.0
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "public" / "art"
MANIFEST = ART / "face_kit" / "manifest.json"
OUTDIR = ART / "face_kit"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("--art", required=True, help="art key without the heroine_ prefix, e.g. t3_s0")
    ap.add_argument("--mid", required=True, help="eye-line midpoint, x,y in plate pixels")
    ap.add_argument("--span", required=True, type=float, help="inter-ocular distance in plate px")
    ap.add_argument("--face", default=None, help="x0,y0,x1,y1 of the face core (rigid in the rig)")
    ap.add_argument("--state", default="eyes_closed")
    ap.add_argument(
        "--window",
        default="1.7,1.3",
        help="patch window in eye spans (w,h); the window must sit inside the head-weight-1 core",
    )
    ap.add_argument("--dry-run", action="store_true")
    return ap.parse_args(argv)


def synthetic_eyes(mid: tuple[float, float], span: float) -> list[list[int]]:
    """Two boxes straddling the eye line — the shape `place_for` reads, by construction.

    Half the span left and right of the midpoint, which is exactly the measurement the skeleton
    template is scaled by, so `mid` and `span` survive the round trip through the manifest to the
    pixel instead of being re-detected as something else.
    """
    hw = span * 0.16
    hh = span * 0.11
    out = []
    for sign in (-1, 1):
        cx = mid[0] + sign * span / 2.0
        out.append(
            [
                int(round(cx - hw)),
                int(round(mid[1] - hh)),
                int(round(cx + hw)),
                int(round(mid[1] + hh)),
            ]
        )
    return out


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    plate_path = ART / f"heroine_{args.art}.webp"
    if not plate_path.exists():
        raise SystemExit(f"no plate {plate_path}")

    mx, my = (float(v) for v in args.mid.split(","))
    mid = (mx, my)
    span = args.span

    plate = Image.open(plate_path).convert("RGBA")
    kw, kh = (float(v) for v in args.window.split(","))
    w = int(round(kw * span))
    h = int(round(kh * span))
    x0 = int(round(mx - w / 2.0))
    y0 = int(round(my - h / 2.0))
    x0 = max(0, min(plate.width - w, x0))
    y0 = max(0, min(plate.height - h, y0))

    patch = plate.crop((x0, y0, x0 + w, y0 + h))
    alpha = patch.getchannel("A")
    if alpha.getextrema() == (0, 0):
        raise SystemExit(f"{args.art}: patch window {x0},{y0} {w}x{h} is empty — bad anchor")

    manifest = json.loads(MANIFEST.read_text())
    key = f"heroine_{args.art}"
    entry = manifest.get(key, {})
    entry.pop("skip", None)
    entry.pop("fallback", None)
    entry["eyes"] = synthetic_eyes(mid, span)
    if args.face:
        entry["face"] = [int(v) for v in args.face.split(",")]
    elif "face" not in entry:
        raise SystemExit("--face is required for a plate with no usable face box")
    entry["identity_face"] = True
    # `detect_face.py` rewrites the whole manifest; a hand-placed anchor must survive that, or the
    # next detector sweep silently puts the eyes back on her hands.
    entry["manual"] = True
    entry.setdefault("patches", {})[args.state] = {
        "cx": x0 + w / 2.0,
        "cy": y0 + h / 2.0,
        "w": w,
        "h": h,
    }
    manifest[key] = entry

    out = OUTDIR / f"{args.art}_{args.state}.webp"
    if args.dry_run:
        print(f"{args.art}: would write {out} ({w}x{h} at {x0},{y0})")
        return 0
    OUTDIR.mkdir(parents=True, exist_ok=True)
    # Lossless on purpose: the patch is a copy of the plate under it, so the only thing a codec
    # could do is make it differ from what it covers.
    patch.save(out, "WEBP", lossless=True, quality=100, method=4)
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=1))

    back = Image.open(out).convert("RGBA")
    caveat = ""
    if back.size != patch.size:
        caveat = f"  WARNING size {back.size} != {patch.width}x{patch.height}"
    diff = 0
    a = patch.tobytes()
    b = back.tobytes()
    if a != b:
        diff = sum(1 for p, q in zip(a, b) if p != q)
    print(
        f"{args.art}: {out.name} {w}x{h} at ({x0},{y0}) mid=({mx:.0f},{my:.0f}) span={span:.1f}"
        f" byte-diff={diff}{caveat}"
    )
    print(f"  eyes {entry['eyes']}  face {entry['face']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
