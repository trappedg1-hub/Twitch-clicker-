#!/usr/bin/env python3
"""Contact sheet for rig approvals: one row per animation, peak frame blown up, motion map.

The preview files are the only way the rig can be reviewed on a phone, so the storyboard has
to carry the whole argument by itself: what moves, how far, and whether the mesh tears.

Usage:
    python3 scripts/rig_storyboard.py deliverables/concept/rig_storyboard.png
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BG = (18, 16, 22)
INK = (238, 232, 240)
DIM = (150, 142, 158)
ACCENT = (255, 138, 176)

ROWS = [
    ("breath", 4.0, "breath — 4 s, грудная клетка дышит",
     [(0, "t=0 · покой"), (1.6, "t=1.6 · пик вдоха"), (2.4, "t=2.4 · выдох"), (3.6, "t=3.6 · покой")]),
    ("sway", 7.0, "sway — 7 s, тело уходит на бедро",
     [(0, "t=0"), (1.75, "t=1.75 · влево"), (3.5, "t=3.5 · центр"), (5.25, "t=5.25 · вправо")]),
    ("turn", 2.4, "turn — 2.4 s, голова ведёт корпус",
     [(0, "t=0"), (0.5, "t=0.5"), (0.8, "t=0.8 · пик поворота"), (1.8, "t=1.8 · возврат")]),
]
CELL_W = 300


def load(path: Path) -> list[Image.Image]:
    im = Image.open(path)
    frames = []
    for i in range(getattr(im, "n_frames", 1)):
        im.seek(i)
        frames.append(im.convert("RGB").copy())
    return frames


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font, fill=INK) -> None:
    draw.text(xy, text, font=font, fill=fill)


def motion_map(doc_path: Path, width: int) -> Image.Image:
    """Her body lit up where the breath moves pixels — and, more to the point, dark where the
    chair is. This panel exists because "the chair breathes too" was the first review note."""
    sys.path.insert(0, str(Path(__file__).parent))
    import preview_rig as pr

    doc = json.loads(doc_path.read_text())
    plate = pr.load_plate(doc)
    mesh = doc["skeleton"]["skins"][0]["attachments"]["slot_body"]["miya_body"]
    rest = pr.bone_rest(doc)
    anim = next(a for a in doc["animations"] if a["name"] == "breath")
    scale = width / doc["width"]
    out_h = int(round(doc["height"] * scale))
    flat = np.asarray(plate.resize((width, out_h), Image.LANCZOS), dtype=np.float32)

    frames = []
    for t in (0.0, 1.6):
        posed = pr.posed_world(doc, pr.sample_timelines(anim, t))
        src, dst = pr.deform(doc, rest, posed)
        frames.append(np.asarray(pr.rasterize(flat, src, dst, mesh["triangles"], scale), dtype=np.float32))

    diff = np.abs(frames[0] - frames[1]).sum(axis=2)
    out = flat * 0.30
    out[..., 0] = np.clip(out[..., 0] + np.clip(diff * 1.6, 0, 255), 0, 255)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def main(out_path: str) -> int:
    title_f = ImageFont.truetype(FONT, 26)
    row_f = ImageFont.truetype(FONT, 20)
    cap_f = ImageFont.truetype(FONT_R, 15)

    rows = []
    for name, duration, heading, marks in ROWS:
        frames = load(Path(f"deliverables/concept/rig_{name}.webp"))
        n = len(frames)
        picks = [int(round(t / duration * n)) % n for t, _ in marks]
        rows.append((heading, [frames[i] for i in picks], [c for _, c in marks], frames))

    cell_h = int(CELL_W * rows[0][1][0].height / rows[0][1][0].width)
    pad, head_h, cap_h, gap = 12, 54, 34, 14
    width = pad * 2 + CELL_W * 4 + gap * 3
    zoom_h = int(cell_h * 0.85)
    map_img = motion_map(Path("experiments/rig-lab/miya_day1.obone"), 620)
    map_w = int(zoom_h * map_img.width / map_img.height)
    height = (
        pad + head_h + sum(cell_h + cap_h + gap + 22 for _ in rows) + zoom_h + 96 + zoom_h + 70
    )
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)

    label(draw, (pad, 14), "MIYA · DAY 1 RIG — приёмка деформации", title_f)
    label(draw, (pad, 44), "OpenBone: 9 костей · 26×38 mesh · 1053 вершины · 2 кости на вершину", cap_f, DIM)

    y = pad + head_h
    for heading, cells, captions, _frames in rows:
        label(draw, (pad, y), heading, row_f)
        y += 28
        for i, (cell, cap) in enumerate(zip(cells, captions)):
            x = pad + i * (CELL_W + gap)
            sheet.paste(cell.resize((CELL_W, cell_h), Image.LANCZOS), (x, y))
            label(draw, (x, y + cell_h + 6), cap, cap_f, DIM)
        y += cell_h + cap_h + 22

    # Chest zoom: an approval has to show the breath at pixel scale, not by faith. Rest, peak
    # and the amplified difference of the same crop, so a torn quad would be undeniable.
    breath = rows[0][3]
    a_img, b_img = breath[0], breath[int(round(1.6 / 4.0 * len(breath))) % len(breath)]
    w, h = a_img.size
    box = (int(w * 0.30), int(h * 0.26), int(w * 0.70), int(h * 0.26) + int(w * 0.40 * h / w))
    crop_a, crop_b = a_img.crop(box), b_img.crop(box)
    da = np.clip(np.abs(np.asarray(crop_a).astype(np.int16) - np.asarray(crop_b).astype(np.int16)) * 6, 0, 255)
    crop_d = Image.fromarray(da.astype(np.uint8))
    zoom_w = int(zoom_h * crop_a.width / crop_a.height)
    for i, (im, cap) in enumerate(
        [(crop_a, "покой"), (crop_b, "пик вдоха"), (crop_d, "разница ×6")]
    ):
        x = pad + i * (zoom_w + gap)
        sheet.paste(im.resize((zoom_w, zoom_h), Image.LANCZOS), (x, y + 6))
        label(draw, (x, y + zoom_h + 6), cap, cap_f, DIM)
    label(
        draw,
        (pad + 3 * (zoom_w + gap) + 4, y + 20),
        "Грудная клетка масштабируется\nкостью: объём растёт, край\nхуди и рукав тянутся следом.\nКрая кадра — не артефакт,\nа границы кропа.",
        cap_f,
        ACCENT,
    )

    y += zoom_h + 70
    label(draw, (pad, y), "куда реально доходит деформация breath: красное — она, чёрное — кресло, стол и пол стоят", cap_f, ACCENT)
    y += 26
    sheet.paste(map_img.resize((map_w, zoom_h), Image.LANCZOS), (pad, y))
    label(
        draw,
        (pad + map_w + 20, y + 20),
        "Кресло, подлокотники, пол и стол — в root 1.0, вес 0.\n"
        "Каждая кость имеет эллипс влияния:\n"
        "грудь тянет только торс, голова — только голову и волосы.\n"
        "Поэтому стул больше не дышит.",
        cap_f,
        DIM,
    )

    sheet = sheet.crop((0, 0, width, y + zoom_h + 44))
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(f"wrote {out} ({sheet.width}×{sheet.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1]))
