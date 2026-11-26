#!/usr/bin/env python3
"""Render an OpenBone document to an animated preview without a browser.

The point is not a pretty film: it is the only way to see the rig actually move in an
environment where a headless browser cannot run. It evaluates the document exactly as the
runtime would — bone hierarchy, then per-vertex skinning by the stored weights — and warps
the plate triangle-by-triangle with a small barycentric rasteriser.

Output: animated WebP + GIF, so the result opens on a phone.

Usage:
    python3 scripts/preview_rig.py experiments/rig-lab/miya_day1.obone \
        --animation breath --frames 24 --out deliverables/concept/rig_breath
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

PLATE_DIR = Path("public/art")


def load_plate(doc: dict) -> Image.Image:
    src = doc["images"][0]["src"].lstrip("/")
    path = Path("public") / src
    if not path.exists():
        path = PLATE_DIR / Path(src).name
    img = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", img.size, (6, 5, 9, 255))
    bg.alpha_composite(img)
    return bg.convert("RGB")


def mat(x: float = 0, y: float = 0, rot: float = 0, sx: float = 1, sy: float = 1) -> np.ndarray:
    r = math.radians(rot)
    c, s = math.cos(r), math.sin(r)
    return np.array(
        [[c * sx, -s * sy, x], [s * sx, c * sy, y], [0, 0, 1]],
        dtype=np.float64,
    )


def bone_rest(doc: dict) -> dict[str, np.ndarray]:
    bones = {b["id"]: b for b in doc["skeleton"]["bones"]}
    world: dict[str, np.ndarray] = {}

    def resolve(bid: str) -> np.ndarray:
        if bid in world:
            return world[bid]
        b = bones[bid]
        local = mat(b["x"], b["y"], b["rotation"], b["scaleX"], b["scaleY"])
        parent = b.get("parent")
        world[bid] = (resolve(parent) @ local) if parent else local
        return world[bid]

    for bid in bones:
        resolve(bid)
    return world


def sample_timelines(anim: dict, t: float) -> dict[tuple[str, str, str], float]:
    out: dict[tuple[str, str, str], float] = {}
    for tl in anim.get("timelines", []):
        keys = tl.get("keys") or []
        if not keys:
            continue
        if tl.get("property") in ("attachment", "inherit") or isinstance(keys[0]["value"], str) or keys[0]["value"] is None:
            # Stepped channel: the runtime switches at the key, it never blends.
            value = keys[0]["value"]
            for k in keys:
                if k["time"] <= t:
                    value = k["value"]
            out[(tl["target"], tl["id"], tl["property"])] = value
            continue
        value = keys[-1]["value"]
        for i in range(len(keys) - 1):
            a, b = keys[i], keys[i + 1]
            if a["time"] <= t <= b["time"]:
                span = b["time"] - a["time"] or 1.0
                k = (t - a["time"]) / span
                value = a["value"] + (b["value"] - a["value"]) * k
                break
        if t <= keys[0]["time"]:
            value = keys[0]["value"]
        out[(tl["target"], tl["id"], tl["property"])] = value
    return out


def posed_world(doc: dict, values: dict[tuple[str, str, str], float]) -> dict[str, np.ndarray]:
    bones = {b["id"]: b for b in doc["skeleton"]["bones"]}
    world: dict[str, np.ndarray] = {}

    def resolve(bid: str) -> np.ndarray:
        if bid in world:
            return world[bid]
        b = bones[bid]
        x = values.get(("bone", bid, "x"), b["x"])
        y = values.get(("bone", bid, "y"), b["y"])
        rot = values.get(("bone", bid, "rotation"), b["rotation"])
        sx = values.get(("bone", bid, "scaleX"), b["scaleX"])
        sy = values.get(("bone", bid, "scaleY"), b["scaleY"])
        local = mat(x, y, rot, sx, sy)
        parent = b.get("parent")
        world[bid] = (resolve(parent) @ local) if parent else local
        return world[bid]

    for bid in bones:
        resolve(bid)
    return world


def _wrap(a: float) -> float:
    while a > math.pi:
        a -= 2 * math.pi
    while a < -math.pi:
        a += 2 * math.pi
    return a


def apply_physics(doc: dict, posed: dict[str, np.ndarray], state: dict, dt: float) -> None:
    """Secondary motion, ported 1:1 from `@openbone/runtime` `applyPhysics`.

    Two spring particles per constraint (bone origin and tip) lag behind the animated pose and
    are blended back in. Ported rather than approximated because the preview is the only way the
    work gets reviewed here — if it guessed differently, the approved file would not be what the
    runtime plays.
    """
    constraints = doc["skeleton"].get("physics") or []
    if not constraints or dt <= 0:
        return
    bones = doc["skeleton"]["bones"]
    children: dict[str, list[str]] = {}
    for b in bones:
        if b.get("parent"):
            children.setdefault(b["parent"], []).append(b["id"])
    length = {b["id"]: float(b.get("length") or 0.0) for b in bones}

    def subtree(bid: str) -> list[str]:
        out, stack = [], [bid]
        while stack:
            cur = stack.pop()
            out.append(cur)
            stack.extend(children.get(cur, ()))
        return out

    for c in constraints:
        bid = c["bone"]
        if bid not in posed:
            continue
        w = posed[bid]
        bone_len = length.get(bid) if length.get(bid, 0) > 1e-6 else 1.0
        ox, oy = float(w[0, 2]), float(w[1, 2])
        tx, ty = ox + bone_len * float(w[0, 0]), oy + bone_len * float(w[1, 0])

        st = state.get(c["id"])
        if st is None:
            def at(x, y):
                return {"x": x, "y": y, "vx": 0.0, "vy": 0.0, "px": x, "py": y}
            st = {"origin": at(ox, oy), "tip": at(tx, ty), "lastO": (ox, oy), "lastT": (tx, ty),
                  "time": 0.0, "steps": 0, "first": True}
            state[c["id"]] = st

        carry = 1.0 - min(1.0, max(0.0, c["inertia"]))
        dx, dy = ox - st["lastO"][0], oy - st["lastO"][1]
        dxt, dyt = tx - st["lastT"][0], ty - st["lastT"][1]
        for p, mx, my in ((st["origin"], dx, dy), (st["tip"], dxt, dyt)):
            p["x"] += mx * carry
            p["y"] += my * carry
            p["px"] += mx * carry
            p["py"] += my * carry
        st["lastO"], st["lastT"] = (ox, oy), (tx, ty)

        h = 1.0 / max(1, int(c.get("fps") or 60))
        st["time"] += dt
        due = int(math.floor(st["time"] / h + 1e-6))
        if st["first"]:
            st["steps"] = due - 1 if due > 0 else 0
            st["first"] = False
        k = min(max(0.0, c["strength"]) / max(1e-6, c["mass"]), 1.0 / (h * h))
        decay = math.exp(-max(0.0, c["damping"]) * h)
        wind = c.get("wind", 0.0)
        gravity = c.get("gravity", 0.0)

        def step(p, gx, gy):
            p["px"], p["py"] = p["x"], p["y"]
            p["vx"] = (p["vx"] + ((gx - p["x"]) * k + wind) * h) * decay
            p["vy"] = (p["vy"] + ((gy - p["y"]) * k - gravity) * h) * decay
            p["x"] += p["vx"] * h
            p["y"] += p["vy"] * h

        while st["steps"] < due:
            step(st["origin"], ox, oy)
            step(st["tip"], tx, ty)
            st["steps"] += 1

        mix = min(1.0, max(0.0, c["mix"]))
        if mix <= 0:
            continue
        f = min(1.0, max(0.0, st["time"] / h - st["steps"]))
        lerp = lambda p: (p["px"] + (p["x"] - p["px"]) * f, p["py"] + (p["y"] - p["py"]) * f)  # noqa: E731
        sox, soy = lerp(st["origin"])
        stx, sty = lerp(st["tip"])

        nox = ox + (sox - ox) * c["x"] * mix
        noy = oy + (soy - oy) * c["y"] * mix
        dx_, dy_ = stx - nox, sty - noy
        d = math.hypot(dx_, dy_)
        corr = np.eye(3)
        if d > 1e-9:
            base = math.atan2(ty - oy, tx - ox)
            drot = _wrap(math.atan2(dy_, dx_) - base) * c["rotate"] * mix
            rest = math.hypot(tx - ox, ty - oy) or bone_len
            scale = 1.0 + (d / rest - 1.0) * c.get("scaleX", 0.0) * mix
            pivot = mat()
            pivot[0, 2], pivot[1, 2] = ox, oy
            unpivot = mat()
            unpivot[0, 2], unpivot[1, 2] = -ox, -oy
            corr = pivot @ mat(0, 0, math.degrees(drot), scale, 1.0) @ unpivot
        shift = mat(nox - ox, noy - oy)
        corr = shift @ corr
        for child in subtree(bid):
            posed[child] = corr @ posed[child]


def deform(doc: dict, rest: dict[str, np.ndarray], posed: dict[str, np.ndarray]) -> Image.Image:
    mesh = doc["skeleton"]["skins"][0]["attachments"]["slot_body"]["miya_body"]
    verts = np.array(mesh["vertices"], dtype=np.float64).reshape(-1, 2)
    weights = mesh.get("weights")
    out = np.zeros_like(verts)
    if weights:
        for i, infl in enumerate(weights):
            p = np.zeros(3)
            for w in infl:
                local = np.array([w["x"], w["y"], 1.0])
                p += w["weight"] * (posed[w["bone"]] @ local)
            out[i] = p[:2]
    else:
        out = verts.copy()
    return verts, out


def rasterize(
    src_rgb: np.ndarray,
    verts_src: np.ndarray,
    verts_dst: np.ndarray,
    triangles: list[int],
    out_scale: float,
) -> Image.Image:
    """Software rasteriser: forward-splat each skinned triangle into the output.

    PIL's MESH transform is not usable here — it squeezes an arbitrary quadrilateral into an
    axis-aligned box, which shreds the art into a mosaic. Per-triangle barycentric sampling is
    exact, and it is what the GPU runtime does anyway.
    """
    sh, sw = src_rgb.shape[:2]
    oh, ow = sh, sw
    out = np.zeros((oh, ow, 3), dtype=np.float32)
    filled = np.zeros((oh, ow), dtype=bool)

    src = verts_src * out_scale
    dst = verts_dst * out_scale

    for i in range(0, len(triangles), 3):
        ia, ib, ic = triangles[i], triangles[i + 1], triangles[i + 2]
        sa, sb, sc = src[ia], src[ib], src[ic]
        da, db, dc = dst[ia], dst[ib], dst[ic]

        x0 = max(0, int(np.floor(min(da[0], db[0], dc[0]))))
        x1 = min(ow, int(np.ceil(max(da[0], db[0], dc[0]))) + 1)
        y0 = max(0, int(np.floor(min(da[1], db[1], dc[1]))))
        y1 = min(oh, int(np.ceil(max(da[1], db[1], dc[1]))) + 1)
        if x1 <= x0 or y1 <= y0:
            continue

        px = np.arange(x0, x1, dtype=np.float32) + 0.5
        py = np.arange(y0, y1, dtype=np.float32) + 0.5
        X, Y = np.meshgrid(px, py)

        # Barycentric coordinates of every pixel centre inside the destination triangle.
        det = (db[1] - dc[1]) * (da[0] - dc[0]) + (dc[0] - db[0]) * (da[1] - dc[1])
        if abs(det) < 1e-6:
            continue
        w0 = ((db[1] - dc[1]) * (X - dc[0]) + (dc[0] - db[0]) * (Y - dc[1])) / det
        w1 = ((dc[1] - da[1]) * (X - dc[0]) + (da[0] - dc[0]) * (Y - dc[1])) / det
        w2 = 1.0 - w0 - w1
        inside = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        if not inside.any():
            continue

        sx = w0 * sa[0] + w1 * sb[0] + w2 * sc[0]
        sy = w0 * sa[1] + w1 * sb[1] + w2 * sc[1]

        sx = np.clip(sx[inside], 0, sw - 1.001)
        sy = np.clip(sy[inside], 0, sh - 1.001)
        ix, iy = np.floor(sx).astype(np.int32), np.floor(sy).astype(np.int32)
        fx = (sx - ix)[:, None]
        fy = (sy - iy)[:, None]
        c00 = src_rgb[iy, ix]
        c10 = src_rgb[iy, ix + 1]
        c01 = src_rgb[iy + 1, ix]
        c11 = src_rgb[iy + 1, ix + 1]
        colour = (
            c00 * (1 - fx) * (1 - fy) + c10 * fx * (1 - fy) + c01 * (1 - fx) * fy + c11 * fx * fy
        )

        ty, tx = np.nonzero(inside)
        out[y0 + ty, x0 + tx] = colour
        filled[y0 + ty, x0 + tx] = True

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def stepped(values: dict, target: str, slot: str) -> object:
    """Slot attachments switch at keys; there is nothing to interpolate."""
    return values.get((target, slot, "attachment"))


def load_images(doc: dict) -> dict[str, Image.Image]:
    out = {}
    for img in doc.get("images", []):
        path = Path("public") / img["src"].lstrip("/")
        if path.exists():
            out[img["id"]] = Image.open(path).convert("RGBA")
    return out


def draw_slots(
    frame: Image.Image,
    doc: dict,
    posed: dict[str, np.ndarray],
    values: dict,
    images: dict[str, Image.Image],
    out_scale: float,
) -> Image.Image:
    """Composite slot attachments over the body.

    Region origin is the image centre in slot-bone local space, which is how the runtime places
    it — so an overlay authored at plate size lands exactly on the plate.
    """
    skin = doc["skeleton"]["skins"][0]["attachments"]
    frame = frame.convert("RGBA")

    for slot in doc["skeleton"]["slots"]:
        name = values.get(("slot", slot["id"], "attachment"), slot.get("attachment") or None)
        if not name:
            continue
        att = skin.get(slot["id"], {}).get(name)
        if not att or att.get("type") != "region":
            continue
        img = images.get(att["image"])
        if img is None:
            continue

        bone = posed[slot["bone"]]
        local = mat(att["x"], att["y"], att.get("rotation", 0), att.get("scaleX", 1), att.get("scaleY", 1))
        world = bone @ local
        cx, cy = world[0, 2] * out_scale, world[1, 2] * out_scale
        sx = float(np.hypot(world[0, 0], world[1, 0])) * out_scale
        sy = float(np.hypot(world[0, 1], world[1, 1])) * out_scale
        angle = -math.degrees(math.atan2(world[1, 0], world[0, 0]))

        w = max(1, int(round(att["width"] * sx)))
        h = max(1, int(round(att["height"] * sy)))
        layer = img.resize((w, h), Image.LANCZOS)
        if abs(angle) > 0.01:
            layer = layer.rotate(angle, resample=Image.BICUBIC, expand=True)
        frame.alpha_composite(layer, (int(round(cx - layer.width / 2)), int(round(cy - layer.height / 2))))

    return frame.convert("RGB")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("document")
    ap.add_argument("--animation", default="breath")
    ap.add_argument("--frames", type=int, default=24)
    ap.add_argument("--width", type=int, default=420)
    # Playback rate of the preview, not of the animation. A 90 ms blink is invisible at real
    # speed, so short clips are reviewed at 8-10 fps.
    ap.add_argument("--fps", type=int, default=12)
    # Physics is on by default: the review files must show what the game will play.
    ap.add_argument("--no-physics", dest="physics", action="store_false")
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)

    doc = json.loads(Path(args.document).read_text())
    plate = load_plate(doc)

    mesh = doc["skeleton"]["skins"][0]["attachments"]["slot_body"]["miya_body"]
    n = len(mesh["vertices"]) // 2
    grid = mesh.get("grid") or {}
    cols = int(grid.get("cols") or 0)
    rows = int(grid.get("rows") or 0)
    if not cols or (cols + 1) * (rows + 1) != n:
        raise SystemExit(f"{args.document}: mesh has no usable grid metadata for {n} vertices")

    rest = bone_rest(doc)
    anim = next(a for a in doc["animations"] if a["name"] == args.animation)
    triangles = mesh["triangles"]
    out_scale = args.width / doc["width"]
    out_h = int(round(doc["height"] * out_scale))
    plate_rgb = np.asarray(plate.resize((args.width, out_h), Image.LANCZOS), dtype=np.float32)

    images = load_images(doc)
    physics_state: dict = {}
    frame_dt = anim["duration"] / args.frames
    frames: list[Image.Image] = []
    for f in range(args.frames):
        t = anim["duration"] * f / args.frames
        values = sample_timelines(anim, t)
        posed = posed_world(doc, values)
        # Physics runs after the pose and before drawing, exactly like the runtime's solve order.
        if args.physics:
            apply_physics(doc, posed, physics_state, frame_dt)
        src_grid, dst_grid = deform(doc, rest, posed)
        frame = rasterize(plate_rgb, src_grid, dst_grid, triangles, out_scale)
        frames.append(draw_slots(frame, doc, posed, values, images, out_scale))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        out.with_suffix(".webp"),
        save_all=True,
        append_images=frames[1:],
        duration=1000 // args.fps,
        minimize_size=False,
        loop=0,
        quality=88,
        method=4,
    )
    # The GIF is the fallback for viewers that will not autoplay animated WebP, so it is
    # downscaled: 24 full-size frames would otherwise arrive as a 4 MB file.
    gif_src = frames
    if args.width > 420:
        gh = int(round(out_h * 420 / args.width))
        gif_src = [fr.resize((420, gh), Image.LANCZOS) for fr in frames]
    gif = [fr.convert("P", palette=Image.ADAPTIVE, colors=96) for fr in gif_src]
    gif[0].save(
        out.with_suffix(".gif"),
        save_all=True,
        append_images=gif[1:],
        duration=1000 // args.fps,
        loop=0,
        optimize=False,
    )

    print(f"{args.animation}: {args.frames} frames, grid {cols}×{rows} ({n} vertices)")
    print(f"wrote {out.with_suffix('.webp')} and {out.with_suffix('.gif')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
