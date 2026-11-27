#!/usr/bin/env python3
"""Rasterise the rig exactly as the browser would, from the rig's own draw list.

There is no browser in this sandbox and the phone cannot open the dev preview, so the only way to
see the heroine is to draw her ourselves: `experiments/dump_frames.mjs` runs the real
`@openbone/runtime` and prints the per-frame `drawList()` (world vertices + uvs + indices), and
this script textures those triangles with the same webp plates the game loads.

    node experiments/dump_frames.mjs t1_s0 tap 1.0 60 > /tmp/tap.json
    python3 scripts/rig_preview.py /tmp/tap.json --crop face --out /tmp/tap

Outputs a PNG per frame plus a strip (filmstrip) so the motion can be judged frame by frame.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def load_plate(doc: dict, image_id: str) -> tuple[np.ndarray, int, int]:
    entry = next(i for i in doc["images"] if i["id"] == image_id)
    path = ROOT / "public" / entry["src"].lstrip("/")
    img = Image.open(path).convert("RGBA")
    return np.asarray(img, dtype=np.float32), img.width, img.height


def draw_item(canvas: np.ndarray, plate: np.ndarray, item: dict, color) -> None:
    """Draw one draw-list item into `canvas` (float RGBA, straight alpha) with per-triangle affine."""
    h, w = canvas.shape[:2]
    ph, pw = plate.shape[:2]
    verts = np.array(item["vertices"], dtype=np.float32).reshape(-1, 2)
    uvs = np.array(item["uvs"], dtype=np.float32).reshape(-1, 2)
    idx = np.array(item["indices"], dtype=np.int32).reshape(-1, 3)
    src = np.stack([uvs[:, 0] * pw, uvs[:, 1] * ph], axis=1)

    tint = np.array(color[:3] if isinstance(color, (list, tuple)) else [1, 1, 1], dtype=np.float32)
    mul = np.array(color[3] if isinstance(color, (list, tuple)) and len(color) > 3 else 1.0,
                   dtype=np.float32)

    for tri in idx:
        d = verts[tri]          # destination triangle
        s = src[tri]            # source triangle
        x0, y0 = d[:, 0].min(), d[:, 1].min()
        x1, y1 = d[:, 0].max(), d[:, 1].max()
        ix0, iy0 = max(0, int(math.floor(x0))), max(0, int(math.floor(y0)))
        ix1, iy1 = min(w, int(math.ceil(x1)) + 1), min(h, int(math.ceil(y1)) + 1)
        if ix1 <= ix0 or iy1 <= iy0:
            continue
        # Affine source <- destination: solve d -> s with the first vertex as the origin.
        m = np.array([d[1] - d[0], d[2] - d[0]], dtype=np.float64).T
        det = m[0, 0] * m[1, 1] - m[0, 1] * m[1, 0]
        if abs(det) < 1e-9:
            continue
        inv = np.array([[m[1, 1], -m[0, 1]], [-m[1, 0], m[0, 0]]], dtype=np.float64) / det
        sm = np.array([s[1] - s[0], s[2] - s[0]], dtype=np.float64).T
        a = sm @ inv  # 2x2
        b = s[0] - a @ d[0]

        ys, xs = np.mgrid[iy0:iy1, ix0:ix1]
        px = xs + 0.5
        py = ys + 0.5
        sx = a[0, 0] * px + a[0, 1] * py + b[0]
        sy = a[1, 0] * px + a[1, 1] * py + b[1]

        # Inside test in destination space (barycentric sign).
        def edge(p, q, r):
            return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

        e0 = edge(d[0], d[1], (px, py))
        e1 = edge(d[1], d[2], (px, py))
        e2 = edge(d[2], d[0], (px, py))
        inside = ((e0 >= -0.001) & (e1 >= -0.001) & (e2 >= -0.001)) | (
            (e0 <= 0.001) & (e1 <= 0.001) & (e2 <= 0.001)
        )
        if not inside.any():
            continue

        sxi = np.clip(sx, 0, pw - 1.0001)
        syi = np.clip(sy, 0, ph - 1.0001)
        xi0 = sxi.astype(np.int32)
        yi0 = syi.astype(np.int32)
        fx = (sxi - xi0)[..., None]
        fy = (syi - yi0)[..., None]
        p00 = plate[yi0, xi0]
        p01 = plate[yi0, np.minimum(xi0 + 1, pw - 1)]
        p10 = plate[np.minimum(yi0 + 1, ph - 1), xi0]
        p11 = plate[np.minimum(yi0 + 1, ph - 1), np.minimum(xi0 + 1, pw - 1)]
        tex = (p00 * (1 - fx) * (1 - fy) + p01 * fx * (1 - fy) + p10 * (1 - fx) * fy + p11 * fx * fy)

        rgb = tex[..., :3] * tint
        alpha = tex[..., 3:4] / 255.0 * mul
        sub = canvas[iy0:iy1, ix0:ix1]
        mask = inside[..., None]
        a_out = alpha * mask
        dst_a = sub[..., 3:4]
        out_a = a_out + dst_a * (1 - a_out)
        safe = np.where(out_a > 1e-6, out_a, 1.0)
        sub[..., :3] = (rgb * a_out + sub[..., :3] * dst_a * (1 - a_out)) / safe
        sub[..., 3:4] = out_a
        canvas[iy0:iy1, ix0:ix1] = sub


def compose(frame: dict) -> np.ndarray:
    w, h = frame["width"], frame["height"]
    canvas = np.zeros((h, w, 4), dtype=np.float32)
    for item in frame["items"]:
        if item["image"] is None:
            continue
        plate, _, _ = load_plate(frame["doc"], item["image"])
        draw_item(canvas, plate, item, item["color"])
    return canvas


CROPS = {
    "full": None,
    "face": (300, 170, 760, 640),
    "bust": (200, 120, 880, 900),
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("frames_json")
    ap.add_argument("--crop", default="face", choices=sorted(CROPS))
    ap.add_argument("--out", default=None)
    ap.add_argument("--bg", default="#1b1020")
    ap.add_argument("--strip", type=int, default=0, help="frames in the filmstrip (0 = all)")
    ap.add_argument("--scale", type=float, default=1.0)
    args = ap.parse_args()

    data = json.loads(Path(args.frames_json).read_text())
    # The dumper embeds the image table because the published document is binary (`.obonb`).
    # A JSON document is still accepted for the lab's pretty-printed `.obone` dumps.
    if "images" in data:
        data["doc"] = {"images": data["images"]}
    else:
        doc_path = data.get("docPath") or str(ROOT / "public" / "rigs" / f"{data['art']}.obone")
        data["doc"] = json.loads(Path(doc_path).read_text())
    for frame in data["frames"]:
        frame["doc"] = data["doc"]
        frame["width"], frame["height"] = data["width"], data["height"]

    crop = CROPS[args.crop]
    out_dir = Path(args.out or f"/tmp/preview_{data['art']}_{data['anim']}")
    out_dir.mkdir(parents=True, exist_ok=True)
    tiles = []
    for i, frame in enumerate(data["frames"]):
        canvas = np.clip(compose(frame), 0, 255).astype(np.float32)
        canvas[..., 3] *= 255.0  # alpha is straight 0..1 in the buffer, 0..255 in a PNG
        rgba = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), "RGBA")
        if crop:
            rgba = rgba.crop(crop)
        if args.scale != 1.0:
            rgba = rgba.resize((int(rgba.width * args.scale), int(rgba.height * args.scale)),
                               Image.LANCZOS)
        bg = Image.new("RGBA", rgba.size, args.bg)
        bg.alpha_composite(rgba)
        tile = bg.convert("RGB")
        tile.save(out_dir / f"{i:03d}.png")
        tiles.append(tile)

    wanted = tiles if not args.strip else tiles[: args.strip]
    if wanted:
        cols = min(6, len(wanted))
        rows = math.ceil(len(wanted) / cols)
        tw, th = wanted[0].size
        strip = Image.new("RGB", (cols * tw, rows * th), args.bg)
        for i, tile in enumerate(wanted):
            strip.paste(tile, ((i % cols) * tw, (i // cols) * th))
        strip.save(out_dir / f"strip_{data['anim']}_{args.crop}.png")
    print(f"{len(tiles)} frames -> {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
