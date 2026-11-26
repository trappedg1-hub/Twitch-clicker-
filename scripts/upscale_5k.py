#!/usr/bin/env python3
"""Turn a generated plate into a 5K master, then a crisp game-size plate.

Pipeline
    RGBA plate -> 4x AI upscale -> ~3.4K x 5K master (alpha reattached)
                -> Lanczos down to the 1024x1526 game box -> sharpness gate

Why a gate: "upscaled" is not the goal, "not soap" is. A soft resample looks fine in a
thumbnail and turns to mush on a retina screen, so the script measures high-frequency
detail (variance of the Laplacian on luminance) of the downscaled game plate and refuses
anything that lost too much of it. The threshold is deliberately conservative: real model
output passes, plain interpolation does not.

Backends
    api      POST /enhance to a local Real-ESRGAN service (image-enhance-api, MIT)
    binary   realesrgan-ncnn-vulkan (Apache-2.0 model, MIT binary) as a subprocess
    lanczos  pure PIL resample — a stand-in for testing the gate, NEVER for shipping

Usage
    python3 scripts/upscale_5k.py IN.png --backend api --api-url http://127.0.0.1:5000 \
        --master OUT_5k.png --game OUT_1024x1526.webp

    python3 scripts/upscale_5k.py IN.png --backend binary --binary ./realesrgan-ncnn-vulkan \
        --model realesrgan-x4plus-anime --master OUT_5k.png --game OUT_1024x1526.webp
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PLATE_W, PLATE_H = 1024, 1526
# The game plate must carry MORE high-frequency detail than a plain resize of the source
# to the same size. That comparison is scale-correct: same pixels, same size, only the
# upscaler differs. Plain interpolation scores 1.00 by definition and is rejected here.
MIN_DETAIL_KEEP = 1.05


def _resample_rgb_with_alpha(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    rgb = img.convert("RGB").resize(size, Image.LANCZOS)
    out = rgb.convert("RGBA")
    out.putalpha(img.getchannel("A").resize(size, Image.LANCZOS))
    return out


def _fill_transparent(img: Image.Image) -> Image.Image:
    """Replace fully transparent RGB with the nearest visible colour.

    Otherwise the upscaler sees black inside the cutout and paints dark fringes along the
    silhouette. Alpha itself is never sent to the model.
    """
    arr = np.array(img)
    alpha = arr[:, :, 3]
    if (alpha > 0).all():
        return img.convert("RGB")

    filled = arr[:, :, :3].copy()
    # Nearest-visible-colour propagation by iterative dilation (cheap and deterministic).
    known = alpha > 0
    if not known.any():
        return Image.new("RGB", img.size, (0, 0, 0))
    rgb = filled.astype(np.int16)
    for _ in range(64):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(known.shape, np.int16)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            shifted_known = np.roll(known, (dy, dx), (0, 1))
            shifted_rgb = np.roll(rgb, (dy, dx), (0, 1))
            acc += shifted_rgb * shifted_known[:, :, None]
            cnt += shifted_known
        grow = (~known) & (cnt > 0)
        rgb[grow] = (acc[grow] / cnt[grow][:, None]).astype(np.int16)
        known = known | grow
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")


def upscale_api(rgb: Image.Image, api_url: str, model: str, work: Path) -> Image.Image:
    src = work / "src.png"
    rgb.save(src)
    boundary = "----plate-upscale"
    body = bytearray()
    for name, value in (("model", model),):
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
    body += (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"src.png\"\r\n"
        "Content-Type: image/png\r\n\r\n"
    ).encode()
    body += src.read_bytes() + b"\r\n"
    body += f"--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        api_url,
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=900) as resp:
        payload = resp.read()
    out = work / "up.png"
    out.write_bytes(payload)
    return Image.open(out).convert("RGB")


def upscale_binary(rgb: Image.Image, binary: str, model: str, work: Path, scale: int) -> Image.Image:
    src = work / "src.png"
    out = work / "up.png"
    rgb.save(src)
    cmd = [binary, "-i", str(src), "-o", str(out), "-s", str(scale), "-n", model]
    subprocess.run(cmd, check=True)
    return Image.open(out).convert("RGB")


def upscale_lanczos(rgb: Image.Image, scale: int) -> Image.Image:
    return rgb.resize((rgb.width * scale, rgb.height * scale), Image.LANCZOS)


def detail_score(img: Image.Image) -> float:
    """High-frequency energy of an image: variance of the Laplacian on luminance."""
    grey = np.asarray(img.convert("L"), dtype=np.float32)
    k = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    h, w = grey.shape
    out = np.zeros((h - 2, w - 2), dtype=np.float32)
    for dy in range(3):
        for dx in range(3):
            weight = k[dy, dx]
            if weight:
                out += weight * grey[dy:dy + h - 2, dx:dx + w - 2]
    return float(out.var())


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("--backend", choices=["api", "binary", "lanczos"], default="api")
    ap.add_argument("--api-url", default="http://127.0.0.1:5000/enhance")
    ap.add_argument("--binary", default="realesrgan-ncnn-vulkan")
    ap.add_argument("--model", default="realesrgan-x4plus-anime")
    ap.add_argument("--scale", type=int, default=4)
    ap.add_argument("--master", required=True)
    ap.add_argument("--game", required=True)
    ap.add_argument("--report", default=None)
    args = ap.parse_args(argv)

    src = Image.open(args.source).convert("RGBA")
    # Baseline: the SAME source, plainly resized to the game box. Same size as the result,
    # so the two detail scores are directly comparable.
    baseline = _resample_rgb_with_alpha(src, (PLATE_W, PLATE_H))
    baseline_detail = detail_score(baseline.convert("RGB"))

    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        rgb = _fill_transparent(src)
        if args.backend == "api":
            up = upscale_api(rgb, args.api_url, args.model, work)
        elif args.backend == "binary":
            up = upscale_binary(rgb, args.binary, args.model, work, args.scale)
        else:
            up = upscale_lanczos(rgb, args.scale)

    # Master keeps the AI detail; alpha is resampled separately so the silhouette never softens.
    master = up.convert("RGBA")
    master.putalpha(
        src.getchannel("A").resize(up.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.4))
    )
    Path(args.master).parent.mkdir(parents=True, exist_ok=True)
    master.save(args.master)

    game = _resample_rgb_with_alpha(master, (PLATE_W, PLATE_H))
    Path(args.game).parent.mkdir(parents=True, exist_ok=True)
    game.save(args.game, "WEBP", quality=94, method=6, exact=True)

    game_detail = detail_score(game.convert("RGB"))
    keep = game_detail / baseline_detail if baseline_detail else 1.0
    passed = keep >= MIN_DETAIL_KEEP

    report = {
        "source": {"file": str(args.source), "size": list(src.size)},
        "baseline": {"size": [PLATE_W, PLATE_H], "detail": round(baseline_detail, 2)},
        "master": {"file": str(args.master), "size": list(master.size)},
        "game": {"file": str(args.game), "size": list(game.size), "detail": round(game_detail, 2)},
        "detail_keep": round(keep, 3),
        "min_detail_keep": MIN_DETAIL_KEEP,
        "backend": args.backend,
        "passed": passed,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if args.report:
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(json.dumps(report, indent=2, ensure_ascii=False))

    if not passed:
        print(
            f"REJECTED: detail kept {keep:.2f} < {MIN_DETAIL_KEEP}. "
            "This plate would look soft — rerun through a real upscaler.",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
