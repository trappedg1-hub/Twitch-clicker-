#!/usr/bin/env python3
"""Build every face-kit patch from the generated variants, for all arts at once.

Reads `public/art/face_kit/manifest.json` (eye boxes per art, from `detect_face.py`) and looks for
generated variants in `deliverables/concept/face_kit/gen/`:

    <art>_closed_raw.png        eyes closed
    <art>_mouth_closed_raw.png  lips together
    <art>_mouth_open_raw.png    mouth open, speaking

For each one found, the merge runs through `build_face_states.py` (register -> tone match ->
feathered window -> trimmed patch) and the resulting patch geometry is written back into the
manifest, which is what the rig build reads.

Usage:
    python3 scripts/face_kit_batch.py            # build what exists, list what is missing
    python3 scripts/face_kit_batch.py --only t1_s0,t2_s0
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ART = Path("public/art")
MANIFEST = ART / "face_kit" / "manifest.json"
GEN = Path("deliverables/concept/face_kit/gen")
OUTDIR = ART / "face_kit"

# Two states per art is enough: speech alternates between the open mouth and the canon plate,
# whose lips are already parted — a mouth that never fully closes mid-sentence is closer to life
# than one that does, so `mouth_closed` is optional (it only feeds the "smile" idle state).
STATES = {
    "eyes_closed": {"suffix": "_closed_raw.png", "grow": 1.30, "required": True},
    "mouth_open": {"suffix": "_mouth_open_raw.png", "grow": 1.90, "required": True},
    "mouth_closed": {"suffix": "_mouth_closed_raw.png", "grow": 1.90, "required": False},
}


def build_one(plate: Path, art_key: str, state: str, boxes: dict, gen: Path) -> dict | None:
    grow = STATES[state]["grow"]
    eyes = boxes["eyes"]
    mouth = boxes["mouth"]
    if state == "eyes_closed":
        # Pad the detected eye boxes: the lid needs room for the crease above it.
        boxes_arg = []
        for x0, y0, x1, y1 in eyes:
            boxes_arg.append(f"{x0 - 6},{y0 - 8},{x1 + 6},{y1 + 6}")
    else:
        boxes_arg = [",".join(str(v) for v in mouth)]

    out = OUTDIR / f"{art_key}_{state}.webp"
    cmd = [
        sys.executable, "scripts/build_face_states.py",
        "--plate", str(plate), "--gen", str(gen),
        "--eyes", *boxes_arg, "--grow", str(grow),
        "--out", str(out),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"  FAIL {art_key} {state}: {res.stderr.strip().splitlines()[-1:]}")
        return None
    line = [ln for ln in res.stdout.splitlines() if "patch" in ln]
    if not line:
        return None
    # "... patch 230x114 at (416,252)"
    parts = line[0].split("patch ")[1].split()
    w, h = (int(v) for v in parts[0].split("x"))
    x0, y0 = (int(v) for v in parts[2].strip("()").split(","))
    print(f"  {art_key} {state}: {w}x{h} at ({x0},{y0})")
    return {"w": w, "h": h, "cx": x0 + w / 2, "cy": y0 + h / 2}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None)
    ap.add_argument(
        "--states",
        default=None,
        help="comma list of states to build (default: all); e.g. eyes_closed for an art whose "
        "canon mouth is already open, where a mouth patch would animate nothing",
    )
    args = ap.parse_args(argv)

    if not MANIFEST.exists():
        raise SystemExit("run scripts/detect_face.py first")
    manifest = json.loads(MANIFEST.read_text())

    only = set(args.only.split(",")) if args.only else None
    wanted = set(args.states.split(",")) if args.states else None
    missing: list[tuple[str, str]] = []
    skipped: list[str] = []
    built = 0

    for art_key, boxes in sorted(manifest.items()):
        art = art_key.replace("heroine_", "")
        if only and art not in only:
            continue
        plate = ART / f"{art_key}.webp"
        if not plate.exists():
            continue
        if "eyes" not in boxes:
            continue
        # Arts where the detector had to fall back have a face too small or too cropped for a blink
        # to read (a 30-50 px face changes by one or two pixels). Animating them is invisible work
        # with real seam risk, so they are skipped on purpose.
        if boxes.get("skip") or boxes.get("fallback"):
            skipped.append(art_key.replace("heroine_", ""))
            boxes.pop("patches", None)  # stale records would point at deleted files
            continue
        # Frames where the mouth is busy (food held to the lips, mid-bite) keep the canon mouth:
        # only the blink is animated there, a swapped mouth would fight the prop.
        mouth_fixed = bool(boxes.get("mouth_fixed"))
        identity = bool(boxes.get("identity_face"))
        for state, spec in STATES.items():
            if wanted is not None and state not in wanted:
                continue
            # `identity_face_patch.py` wrote a patch that is the plate's own pixels: there is no
            # generated variant to rebuild it from, and overwriting it would delete the only
            # reason the art has a document.
            if identity and state in (boxes.get("patches") or {}):
                continue
            if mouth_fixed and state.startswith("mouth"):
                (OUTDIR / f"{art}_{state}.webp").unlink(missing_ok=True)
                (boxes.get("patches") or {}).pop(state, None)
                continue
            gen = GEN / f"{art}{spec['suffix']}"
            if not gen.exists():
                if spec["required"]:
                    missing.append((art, state))
                continue
            info = build_one(plate, art, state, boxes, gen)
            if info:
                manifest[art_key].setdefault("patches", {})[state] = info
                built += 1

    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=1))
    print(f"\nbuilt {built} patches, missing {len(missing)} generations")
    if skipped:
        print(f"skipped (face too small or cropped): {len(skipped)} -> {' '.join(sorted(skipped))}")
    if missing:
        by_art: dict[str, list[str]] = {}
        for art, state in missing:
            by_art.setdefault(art, []).append(state)
        ready = [a for a in by_art if len(by_art[a]) == 3]
        print(f"arts fully missing: {len(ready)} -> {' '.join(sorted(ready)[:12])}")
        partial = {a: s for a, s in by_art.items() if len(s) < 3}
        if partial:
            print("arts partially done:")
            for a, s in sorted(partial.items()):
                print(f"  {a}: need {', '.join(s)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
