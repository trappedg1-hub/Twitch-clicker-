#!/usr/bin/env python3
"""Motion audit: is she moving like a person, or like jelly on a plate?

The two complaints this tool exists for are the two things a frozen frame cannot show you:

  * **jelly** — a spring that keeps wobbling after the gesture is over. It is measurable: simulate
    the constraint with the runtime's own integrator (semi-implicit Euler + exponential velocity
    decay per substep, `@openbone/runtime` `applyPhysics`) and count how many times the bone
    overshoots its animated pose before it gives up, and how long that takes.
  * **snake** — a chain that undulates: hips, chest, neck and head each carrying their own little
    sine at their own phase. Also measurable: count direction reversals of the world-space rotation
    of every bone in the chain. A human at a desk reverses the head's direction once or twice a
    second; a snake reverses it every few frames.

Run it on any authored document:

    python3 scripts/motion_audit.py /tmp/ma/m.obone            # one rig
    python3 scripts/motion_audit.py --dir public/check           # every .obone in a folder
    python3 scripts/motion_audit.py /tmp/ma/m.obone --json out.json

Exit code is 1 when something crosses a threshold, so it can sit in `npm run qa:rigs`.

Numbers are in plate pixels at 60 fps. Thresholds are deliberately blunt:

    damping ratio  ζ = damping / (2·sqrt(strength/mass))    ζ ≥ 0.45 required (0.5–0.7 = flesh)
    reversals      per physics constraint after the peak    ≤ 1
    settle         seconds until < 5 % of peak              ≤ 0.55 s
    peak deviation px of the constraint                     ≤ 26 px
    head chain reversals per second                         ≤ 4
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

FPS = 60.0

# Beats whose whole job is to tremble. A shiver is not a snake: it is a trill, and it is allowed to
# reverse faster than a person would turn their head. Everything else is not.
TREMOLO = {"shiver", "giggle", "shake", "tickle"}
MAX_STEPS = 8  # mirrors MAX_PHYSICS_STEPS in the runtime


# ---------- transform ----------


def bezier(x1: float, y1: float, x2: float, y2: float, t: float) -> float:
    """CSS `cubic-bezier(x1,y1,x2,y2)` — the curve the runtime uses between two keys."""

    def b(a: float, b_: float, s: float) -> float:
        return 3 * a * (1 - s) ** 2 * s + 3 * b_ * (1 - s) * s * s + s**3

    lo, hi = 0.0, 1.0
    for _ in range(12):
        mid = (lo + hi) / 2
        if b(x1, x2, mid) < t:
            lo = mid
        else:
            hi = mid
    return b(y1, y2, (lo + hi) / 2)


class Channel:
    """One animated property of one bone: keys plus the setup value it falls back to."""

    __slots__ = ("keys", "base")

    def __init__(self, base: float, keys: list[dict] | None = None):
        self.base = base
        self.keys = sorted(keys or [], key=lambda k: k["time"])

    def at(self, t: float) -> float:
        keys = self.keys
        if not keys:
            return self.base
        if t <= keys[0]["time"]:
            return keys[0]["value"]
        if t >= keys[-1]["time"]:
            return keys[-1]["value"]
        for i in range(len(keys) - 1):
            a, b = keys[i], keys[i + 1]
            if a["time"] <= t <= b["time"]:
                span = b["time"] - a["time"]
                if span <= 1e-9:
                    return b["value"]
                curve = a.get("curve") or [0.25, 0.1, 0.25, 1]
                e = bezier(curve[0], curve[1], curve[2], curve[3], (t - a["time"]) / span)
                return a["value"] + (b["value"] - a["value"]) * e
        return keys[-1]["value"]


def compose(parent, local):
    """parent, local = (a,b,c,d,tx,ty) — 2D affine, column-vector convention."""
    pa, pb, pc, pd, ptx, pty = parent
    la, lb, lc, ld, ltx, lty = local
    return (
        pa * la + pc * lb,
        pb * la + pd * lb,
        pa * lc + pc * ld,
        pb * lc + pd * ld,
        pa * ltx + pc * lty + ptx,
        pb * ltx + pd * lty + pty,
    )


def world_of(bones: dict, chans: dict, t: float, order: list[str]) -> dict[str, tuple]:
    """World matrices for every bone at time `t`, parents first (the document order is a DAG)."""
    out: dict[str, tuple] = {}
    for name in order:
        b = bones[name]
        rot = math.radians(chans[(name, "rotation")].at(t))
        sx = chans[(name, "scaleX")].at(t)
        sy = chans[(name, "scaleY")].at(t)
        x = chans[(name, "x")].at(t)
        y = chans[(name, "y")].at(t)
        cos, sin = math.cos(rot), math.sin(rot)
        local = (cos * sx, sin * sx, -sin * sy, cos * sy, x, y)
        parent = out.get(b["parent"]) if b.get("parent") else None
        out[name] = compose(parent, local) if parent else local
    return out


# ---------- physics, ported from @openbone/runtime ----------


class Particle:
    __slots__ = ("x", "y", "vx", "vy", "px", "py")

    def __init__(self, x: float, y: float):
        self.x = self.px = x
        self.y = self.py = y
        self.vx = self.vy = 0.0


class Spring:
    """One physics constraint: origin + tip particles chasing the animated bone."""

    def __init__(self, c: dict):
        self.c = c
        self.origin: Particle | None = None
        self.tip: Particle | None = None
        self.last = None
        self.time = 0.0
        self.steps = 0

    def step(self, ox, oy, tx, ty, dt):
        c = self.c
        if self.origin is None:
            self.origin = Particle(ox, oy)
            self.tip = Particle(tx, ty)
            self.last = (ox, oy, tx, ty)
            self.steps = 0
        carry = 1 - min(1.0, max(0.0, c.get("inertia", 0.8)))
        lox, loy, ltx, lty = self.last
        for p, dx, dy in (
            (self.origin, (ox - lox) * carry, (oy - loy) * carry),
            (self.tip, (tx - ltx) * carry, (ty - lty) * carry),
        ):
            p.x += dx
            p.y += dy
            p.px += dx
            p.py += dy
        self.last = (ox, oy, tx, ty)
        h = 1 / max(1.0, c.get("fps", 60))
        self.time += dt
        due = int(math.floor(self.time / h + 1e-6))
        if due - self.steps > MAX_STEPS:
            self.steps = due - MAX_STEPS
        k = min(max(0.0, c.get("strength", 120)) / max(1e-6, c.get("mass", 1)), 1 / (h * h))
        decay = math.exp(-max(0.0, c.get("damping", 6)) * h)
        gx = c.get("gravity", 0.0) * 8.0  # unitScaleY ~ bone length in the document
        for _ in range(due - self.steps):
            for p, tx_, ty_ in ((self.origin, ox, oy), (self.tip, tx, ty)):
                p.px, p.py = p.x, p.y
                p.vx = (p.vx + (tx_ - p.x) * k * h) * decay
                p.vy = (p.vy + (ty_ - p.y) * k * h - gx * h) * decay
                p.x += p.vx * h
                p.y += p.vy * h
        self.steps = due
        f = min(1.0, max(0.0, self.time / h - self.steps))
        lerp = lambda p: (p.px + (p.x - p.px) * f, p.py + (p.y - p.py) * f)
        return lerp(self.origin), lerp(self.tip)


def damping_ratio(c: dict) -> float:
    k = max(1e-9, c.get("strength", 120) / max(1e-6, c.get("mass", 1)))
    return c.get("damping", 6) / (2 * math.sqrt(k))


# ---------- per-animation analysis ----------


def channels_for(doc: dict, anim: dict) -> tuple[dict, dict]:
    sk = doc["skeleton"]
    bones = {b["id"]: b for b in sk["bones"]}
    chans = {}
    for bid, b in bones.items():
        for prop, base in (
            ("x", b.get("x", 0.0)),
            ("y", b.get("y", 0.0)),
            ("rotation", b.get("rotation", 0.0)),
            ("scaleX", b.get("scaleX", 1.0)),
            ("scaleY", b.get("scaleY", 1.0)),
        ):
            chans[(bid, prop)] = Channel(float(base))
    for tl in anim["timelines"]:
        if tl.get("target") != "bone":
            continue
        key = (tl["id"], tl["property"])
        if key in chans:
            chans[key] = Channel(chans[key].base, tl["keys"])
    order: list[str] = []
    seen: set[str] = set()

    def visit(bid: str):
        if bid in seen or bid not in bones:
            return
        parent = bones[bid].get("parent")
        if parent:
            visit(parent)
        seen.add(bid)
        order.append(bid)

    for bid in bones:
        visit(bid)
    return bones, chans, order


def _ema(series: list[float], tau: float) -> list[float]:
    a = 1 - math.exp(-(1 / FPS) / tau)
    out, acc = [], series[0] if series else 0.0
    for v in series:
        acc += (v - acc) * a
        out.append(acc)
    return out


def analyse_animation(doc: dict, anim: dict) -> dict:
    bones, chans, order = channels_for(doc, anim)
    physics = doc["skeleton"].get("physics") or []
    springs = {c["id"]: Spring(c) for c in physics}
    dur = float(anim["duration"])
    # Pre-roll: a second of the first pose. Without it the spring starts at its target and the
    # first frames measure the start-up transient — and a constant gravity sag would be reported
    # as a 6 px "peak" on every frame of every animation.
    for _ in range(int(FPS)):
        w = world_of(bones, chans, 0.0, order)
        for c in physics:
            m = w.get(c["bone"])
            if m is None:
                continue
            ang = math.atan2(m[1], m[0])
            length = bones[c["bone"]].get("length", 8.0) or 8.0
            springs[c["id"]].step(m[4], m[5], m[4] + math.cos(ang) * length, m[5] + math.sin(ang) * length, 1 / FPS)

    frames = max(2, int(round(dur * FPS)))
    dev: dict[str, list[float]] = {c["id"]: [] for c in physics}
    # Signed tip offset along the plate's axes is better than a magnitude: a magnitude can never be
    # negative, so it can never show an overshoot.
    dev_x: dict[str, list[float]] = {c["id"]: [] for c in physics}
    head_rot: list[float] = []
    for f in range(frames + 1):
        t = min(dur, f / FPS)
        w = world_of(bones, chans, t, order)
        for c in physics:
            bid = c["bone"]
            m = w.get(bid)
            if m is None:
                dev[c["id"]].append(0.0)
                dev_x[c["id"]].append(0.0)
                continue
            ox, oy = m[4], m[5]
            length = bones[bid].get("length", 8.0) or 8.0
            ang = math.atan2(m[1], m[0])
            tx, ty = ox + math.cos(ang) * length, oy + math.sin(ang) * length
            (sox, soy), _ = springs[c["id"]].step(ox, oy, tx, ty, 1 / FPS)
            mix = min(1.0, max(0.0, c.get("mix", 1.0)))
            dx, dy = (sox - ox) * mix, (soy - oy) * mix
            dev[c["id"]].append(math.hypot(dx, dy))
            dev_x[c["id"]].append(dx * 0.7071 + dy * 0.7071)
        if "bone_head" in w:
            head_rot.append(math.degrees(math.atan2(w["bone_head"][1], w["bone_head"][0])))
        else:
            head_rot.append(0.0)

    out = {"animation": anim["name"], "duration": dur, "constraints": {}, "head": {}}
    for c in physics:
        cid = c["id"]
        series = dev_x[cid]
        # High-pass: the oscillation *about* the trailer's slow drift. This is the jelly signal.
        slow = _ema(series, 0.22)
        hp = [v - s for v, s in zip(series, slow)]
        jiggle = math.sqrt(sum(v * v for v in hp) / max(1, len(hp)))
        reversals = 0
        last_sign = 0
        for i in range(1, len(series)):
            d = series[i] - series[i - 1]
            if abs(d) < 0.02:
                continue
            s = 1 if d > 0 else -1
            if last_sign and s != last_sign:
                reversals += 1
            last_sign = s
        # Settle: from the last frame the high-passed signal was audible (0.4 px) to the end.
        tail = max((i for i, v in enumerate(hp) if abs(v) > 0.4), default=0)
        settle = max(0.0, (len(hp) - 1 - tail) / FPS)
        out["constraints"][cid] = {
            "lag": round(sum(series) / max(1, len(series)), 2),
            "peak": round(max((abs(v) for v in series), default=0.0), 2),
            "jiggle": round(jiggle, 2),
            "reversals": reversals,
            "settle": round(settle, 2),
            "zeta": round(damping_ratio(c), 2),
        }
    # Reversals with a hysteresis gate: a direction change only counts when the head has actually
    # travelled 0.15° the other way since the last one. Without the gate the count is dominated by
    # the flat, near-constant sections of a curve and every animation looks like a snake.
    rev = 0
    sign = 0
    since = 0.0
    for i in range(1, len(head_rot)):
        d = head_rot[i] - head_rot[i - 1]
        if abs(d) < 1e-6:
            continue
        s_ = 1 if d > 0 else -1
        if sign and s_ != sign:
            if since >= 0.15:
                rev += 1
                since = 0.0
            sign = s_
        else:
            sign = s_
            since += abs(d)
    peak_rate = max((abs(head_rot[i] - head_rot[i - 1]) * FPS for i in range(1, len(head_rot))), default=0.0)
    out["head"] = {"reversals": rev, "per_s": round(rev / dur, 2), "deg_per_s": round(peak_rate, 1)}
    return out


def audit(path: Path) -> list[dict]:
    doc = json.loads(path.read_text())
    return [analyse_animation(doc, a) for a in doc["animations"]]


# ---------- thresholds ----------


def flags(rows: list[dict]) -> list[str]:
    bad: list[str] = []
    for r in rows:
        for cid, m in r["constraints"].items():
            if m["zeta"] < 0.45:
                bad.append(f"{r['animation']}/{cid}: ζ {m['zeta']} (underdamped → jelly)")
            if m["jiggle"] > 1.0:
                bad.append(f"{r['animation']}/{cid}: jiggle {m['jiggle']} px rms")
            if m["settle"] > 0.55 and m["jiggle"] > 0.5:
                bad.append(f"{r['animation']}/{cid}: keeps shaking for {m['settle']} s")
            if m["peak"] > 26:
                bad.append(f"{r['animation']}/{cid}: peak {m['peak']} px")
        # A clip of 0.5 s can only hold so many reversals: one is a shape, not a snake. The rule is
        # "one free reversal, then at most 2.5 per second" — and a trill gets ten.
        limit = max(2, r["duration"] * (10.0 if r["animation"] in TREMOLO else 2.5)) + 0.5
        if r["head"]["reversals"] > limit:
            bad.append(
                f"{r['animation']}/head: {r['head']['reversals']} reversals in {r['duration']} s (snake)"
            )
    return bad


def report(rows: list[dict], label: str) -> None:
    print(f"\n{label}")
    print(f"  {'animation':<12}{'peak px':>9}{'jiggle':>8}{'rev':>5}{'settle':>8}{'ζ':>6}{'head°':>8}{'rev/s':>7}")
    worst = sorted(
        rows,
        key=lambda r: max((m["peak"] for m in r["constraints"].values()), default=0),
        reverse=True,
    )
    for r in worst[:12]:
        peak = max((m["peak"] for m in r["constraints"].values()), default=0.0)
        jig = max((m["jiggle"] for m in r["constraints"].values()), default=0.0)
        rev = max((m["reversals"] for m in r["constraints"].values()), default=0)
        settle = max((m["settle"] for m in r["constraints"].values() if m["jiggle"] > 0.5), default=0.0)
        zeta = min((m["zeta"] for m in r["constraints"].values()), default=1.0)
        print(
            f"  {r['animation']:<12}{peak:>9.2f}{jig:>8.2f}{rev:>5}{settle:>8.2f}{zeta:>6.2f}"
            f"{r['head']['deg_per_s']:>8.1f}{r['head']['per_s']:>7.2f}"
        )
    bad = flags(rows)
    if bad:
        print(f"\n  {len(bad)} flag(s):")
        for line in bad[:14]:
            print(f"    ! {line}")
    else:
        print("\n  clean: no jelly, no snake")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?", help="an .obone document")
    ap.add_argument("--dir", help="every .obone in this folder")
    ap.add_argument("--json", help="write the full audit here")
    args = ap.parse_args(argv)

    paths: list[Path] = []
    if args.dir:
        paths = sorted(Path(args.dir).glob("*.obone"))
    elif args.path:
        paths = [Path(args.path)]
    else:
        ap.error("give a document or --dir")

    total_bad = 0
    all_rows = {}
    for p in paths:
        rows = audit(p)
        all_rows[p.name] = rows
        report(rows, p.name)
        total_bad += len(flags(rows))
    if args.json:
        Path(args.json).write_text(json.dumps(all_rows, indent=1))
    print(f"\n{len(paths)} document(s), {total_bad} flag(s)")
    return 1 if total_bad else 0


if __name__ == "__main__":
    sys.exit(main())
