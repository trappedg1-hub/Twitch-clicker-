#!/usr/bin/env python3
"""Render every per-art rig into one animated contact sheet.

Each art has its own `.obone` document (see `build_miya_rig.py --all`), but reviewing them one
file at a time is slow. This renders the same animation for every rig, crops each frame to the
face, and tiles the results into a single animated WebP — one file that shows all of them
blinking in sync, which is exactly how they will be seen in the game.

Usage:
    python3 scripts/rig_montage.py --animation blink --frames 14 --out deliverables/concept/face_kit/all_rigs_blink
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).parent))
import preview_rig as pr  # noqa: E402

MANIFEST = Path("public/art/face_kit/manifest.json")
RIGDIR = Path("experiments/rig-lab")


def rigs() -> dict[str, Path]:
    out = {}
    for path in sorted(RIGDIR.glob("miya_*.obone")):
        art = path.stem.replace("miya_day1", "t1_s0").replace("miya_", "")
        out[art] = path
    return out


def face_window(entry: dict) -> tuple[int, int, int]:
    """Square crop around the face: big enough for hair, tight enough to read the eyes."""
    p = entry["patches"]["eyes_closed"]
    side = int(max(p["w"], p["h"]) * 2.1)
    return int(p["cx"] - side / 2), int(p["cy"] - side / 2), side


def render(path: Path, animation: str, frames: int, crop: tuple[int, int, int], tile: int):
    doc = json.loads(path.read_text())
    plate = pr.load_plate(doc)
    mesh = doc["skeleton"]["skins"][0]["attachments"]["slot_body"]["miya_body"]
    # Render each art at the scale that maps its own face window onto one tile, so the eyes are
    # at native detail instead of being squeezed with the whole plate into a thumbnail.
    scale = tile / crop[2]
    h = int(round(doc["height"] * scale))
    w = int(round(doc["width"] * scale))
    plate_rgb = np.asarray(plate.resize((w, h), Image.LANCZOS), dtype=np.float32)

    rest = pr.bone_rest(doc)
    anim = next(a for a in doc["animations"] if a["name"] == animation)
    images = pr.load_images(doc)
    cx, cy, side = crop
    box = (int(cx * scale), int(cy * scale),
           int((cx + side) * scale), int((cy + side) * scale))

    out = []
    for f in range(frames):
        values = pr.sample_timelines(anim, anim["duration"] * f / frames)
        posed = pr.posed_world(doc, values)
        src, dst = pr.deform(doc, rest, posed)
        frame = pr.rasterize(plate_rgb, src, dst, mesh["triangles"], scale)
        frame = pr.draw_slots(frame, doc, posed, values, images, scale)
        out.append(frame.crop(box).resize((tile, tile), Image.LANCZOS))
    return out


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--animation", default="blink")
    ap.add_argument("--frames", type=int, default=14)
    ap.add_argument("--tile", type=int, default=190)
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--fps", type=int, default=10)
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)

    manifest = json.loads(MANIFEST.read_text())
    table = rigs()
    arts = [a for a in table if f"heroine_{a}" in manifest]
    if not arts:
        raise SystemExit("no rigs to render — run scripts/build_miya_rig.py --all")

    label_f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    head_f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    pad, label_h, head_h = 6, 20, 44
    cols = min(args.cols, len(arts))
    rows = (len(arts) + cols - 1) // cols
    sheet_w = 14 + cols * (args.tile + pad)
    sheet_h = head_h + rows * (args.tile + label_h + pad)

    tiles: list[list[list[Image.Image]]] = []
    for art in arts:
        crop = face_window(manifest[f"heroine_{art}"])
        tiles.append(render(table[art], args.animation, args.frames, crop, args.tile))
        print(f"  {art}: {args.frames} frames")

    frames = []
    for f in range(args.frames):
        sheet = Image.new("RGB", (sheet_w, sheet_h), (18, 16, 22))
        d = ImageDraw.Draw(sheet)
        d.text((14, 8), f"РИГИ · {len(arts)} АРТОВ · {args.animation}", font=head_f, fill=(240, 235, 242))
        d.text((14, 32), "каждый кадр деформирован своим скелетом, лицо — аттачменты face-kit",
               font=label_f, fill=(150, 142, 158))
        for i, art in enumerate(arts):
            x = 14 + (i % cols) * (args.tile + pad)
            y = head_h + (i // cols) * (args.tile + label_h + pad)
            d.text((x, y), art, font=label_f, fill=(255, 138, 176))
            sheet.paste(tiles[i][f], (x, y + label_h))
        frames.append(sheet)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(out.with_suffix(".webp"), save_all=True, append_images=frames[1:],
                   duration=1000 // args.fps, loop=0, quality=90, method=4, minimize_size=False)
    gif = [fr.convert("P", palette=Image.ADAPTIVE, colors=128) for fr in frames]
    gif[0].save(out.with_suffix(".gif"), save_all=True, append_images=gif[1:],
                duration=1000 // args.fps, loop=0, optimize=False)
    print(f"wrote {out.with_suffix('.webp')} ({sheet_w}x{sheet_h}, {args.frames} frames)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
