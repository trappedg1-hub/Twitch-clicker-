#!/usr/bin/env python3
"""The scoring rig for the generation-training loop: contact sheet, ledger, keep-list.

The user rates every candidate on two axes — `hot` (жар, how good the frame is as fan-service) and
`style` (how close it is to our canon art) — 1..10 each. This script turns a batch of raws into one
labelled sheet for that rating, then records the verdicts in `art-studio/scores.json` and copies the
winners into `art-studio/keep/`. It never touches `public/art/`: a plate ships only after the day's
pipeline (keying, head fit, plate cut) has been run on it deliberately, never as a side effect of
scoring.

    python3 scripts/train_sheet.py art-studio/raw/t5_*.png                 # .qa-out/train_sheet.png
    python3 scripts/train_sheet.py art-studio/raw/t5_*.png --score a_knit=9,9 --score b_track=7,10
    python3 scripts/train_sheet.py art-studio/raw/t5_*.png --keep a_knit --promote-notes

Captions carry the objective measurements from `train_style_measure.py` (skin drift, crop, background
pool) so a low `style` score can be traced to a cause instead of a mood.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / ".qa-out"
LEDGER = ROOT / "art-studio/scores.json"
KEEP = ROOT / "art-studio/keep"


def measure(paths: list[Path]) -> dict[str, str]:
    """One caption line per frame, straight from the metric script — so a score has a cause."""
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        from train_style_measure import flags, load_flat, metrics  # noqa: PLC0415
    except ImportError:
        return {}
    out: dict[str, str] = {}
    for p in paths:
        try:
            m = metrics(load_flat(p))
        except Exception:  # a broken frame still needs a tile
            out[p.stem] = "unreadable"
            continue
        bits = [f"Δskin {m['gb_drift']:+.0f} (0=canon)", f"line {m['line_px']}px", f"field {m['bg_std']}"]
        fl = flags(m)
        out[p.stem] = "  ".join(bits) + ("   :: " + " / ".join(f.split("—")[0].strip() for f in fl) if fl else "   :: clean")
    return out


def sheet(paths: list[Path], scores: dict[str, tuple[float, float]], out: Path) -> Path:
    notes = measure(paths)
    cols = 2
    tile_w, tile_h, cap_h = 620, 800, 78
    rows = (len(paths) + cols - 1) // cols
    canvas = Image.new("RGB", (cols * tile_w + 20, rows * (tile_h + cap_h) + 20), (30, 22, 34))
    draw = ImageDraw.Draw(canvas)
    for idx, p in enumerate(paths):
        cx, cy = idx % cols, idx // cols
        x, y = 10 + cx * tile_w, 10 + cy * (tile_h + cap_h)
        im = Image.open(p)
        if im.mode == "RGBA":
            bg = Image.new("RGBA", im.size, (120, 92, 106, 255))
            bg.alpha_composite(im)
            im = bg.convert("RGB")
        im.thumbnail((tile_w - 24, tile_h - 24), Image.Resampling.LANCZOS)
        canvas.paste(im, (x + (tile_w - im.width) // 2, y))
        stem = p.stem
        cap = draw.textbbox((0, 0), stem)
        line2 = ""
        if stem in scores:
            hot, sty = scores[stem]
            line2 = f"hot {hot}/10   style {sty}/10   → {(hot + sty) / 2:.1f}"
        draw.text((x + 8, y + tile_h - cap[3] - 4), stem, fill=(255, 214, 236))
        if stem in notes:
            draw.text((x + 8, y + tile_h + 14), notes[stem], fill=(190, 200, 230))
        if line2:
            draw.text((x + 8, y + tile_h + 34), line2, fill=(180, 255, 210))
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, quality=92, subsampling=1)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="*", type=Path)
    ap.add_argument("--score", action="append", default=[], help="id=hot,style (repeatable)")
    ap.add_argument("--note", action="append", default=[], help="id=free text, what the scorer said")
    ap.add_argument("--keep", action="append", default=[], help="id to copy into art-studio/keep/")
    ap.add_argument("--out", type=Path, default=QA / "train_sheet.png")
    args = ap.parse_args()

    scores: dict[str, tuple[float, float]] = {}
    for raw in args.score:
        key, _, val = raw.partition("=")
        hot, _, sty = val.partition(",")
        scores[key] = (float(hot), float(sty))  # half points are a real answer, do not round them away
    notes = dict(r.split("=", 1) for r in args.note if "=" in r)

    args.out = Path(args.out).resolve()
    paths = [p for p in args.images if p.exists()]
    if paths:
        print(f"wrote {sheet(paths, scores, args.out).relative_to(ROOT)}")

    if scores:
        led = json.loads(LEDGER.read_text()) if LEDGER.exists() else {"ratings": {}}
        ratings = led.setdefault("ratings", {})
        for stem, (hot, sty) in scores.items():
            rec = ratings.setdefault(stem, {})
            rec.update({"hot": hot, "style": sty, "file": f"art-studio/raw/{stem}.png"})
            if stem in notes:
                rec["note"] = notes[stem]
            rec["mean"] = round((hot + sty) / 2, 2)
        ratings_order = dict(sorted(ratings.items(), key=lambda kv: -kv[1].get("mean", 0)))
        led["ratings"] = ratings_order
        LEDGER.parent.mkdir(parents=True, exist_ok=True)
        LEDGER.write_text(json.dumps(led, indent=1, ensure_ascii=False))
        print(f"ledger -> {LEDGER.relative_to(ROOT)}")
        for stem, rec in list(ratings_order.items())[:8]:
            print(f"  {stem:34s} hot {rec.get('hot')}  style {rec.get('style')}  = {rec.get('mean')}")
        # the correlation the loop is actually hunting for: does the objective drift predict the grade?
        try:
            sys.path.insert(0, str(ROOT / "scripts"))
            from train_style_measure import load_flat, metrics  # noqa: PLC0415

            pts = []
            for stem, rec in ratings.items():
                f = ROOT / "art-studio/raw" / f"{stem}.png"
                if not f.exists() or rec.get("style") is None:
                    continue
                m = metrics(load_flat(f))
                if m.get("gb_drift") is not None:
                    pts.append((m["gb_drift"], rec["style"]))
            if len(pts) >= 3:
                import statistics

                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                mx, my = statistics.fmean(xs), statistics.fmean(ys)
                cov = sum((x - mx) * (y - my) for x, y in pts)
                den = (sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5
                r = cov / den if den else 0.0
                print(f"  corr(style score, skin drift) r={r:+.2f} over {len(pts)} frames  "
                      f"{'-> the metric tracks the eye' if abs(r) > 0.6 else '-> the eye sees more than skin'}")
        except Exception as e:  # a diagnostic must never break the ledger write
            print(f"  (correlation unavailable: {e})")

    if args.keep:
        KEEP.mkdir(parents=True, exist_ok=True)
        for stem in args.keep:
            src = next((p for p in (ROOT / "art-studio/raw").glob(f"*{stem}*.png")), None)  # noqa: SIM108
            if src:
                shutil.copy2(src, KEEP / src.name)
                print(f"kept {src.name} -> art-studio/keep/")
            else:
                print(f"!! no raw matching '{stem}'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
