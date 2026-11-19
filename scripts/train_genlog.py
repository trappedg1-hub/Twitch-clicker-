#!/usr/bin/env python3
"""A hit/miss log for generate_image outcomes, so refusals become data instead of folklore.

Every candidate frame this loop fires gets ONE row: which costume, which pose family, whether a reference
was attached, and whether the call lived or died. The moderation of the upstream generator is a *cumulative*
score over the whole prompt, so the only way to know what a batch will survive is to read the rates back off
the log — one call is an anecdote, forty are a rule.

    python3 scripts/train_genlog.py add t5_t39_C_nolingerie --costume crop-shorts --pose legline --ref 0 --status ok
    python3 scripts/train_genlog.py rate            # pass rate per (costume, pose) family
    python3 scripts/train_genlog.py poison          # concepts that have never survived in any costume

Statuses: `ok` (image saved), `fail` (generic "Image generation failed"), `blocked` (the moderation message
"was blocked by content moderation and was not saved"). `fail` and `blocked` are the same verdict reached by
different routes — with a reference attached the platform hands back the bare generic error, which is why
t39_A looked like an infrastructure timeout and t39_B, the same prompt with the reference removed, said what
it actually was. Record them apart: the route tells you whether the reference is hiding the message.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / "art-studio" / "genlog.json"
FIELDS = ("costume", "pose", "camera", "ref", "status", "note")


def load() -> list[dict]:
    if LOG.exists():
        return json.loads(LOG.read_text())
    return []


def save(rows: list[dict]) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text(json.dumps(rows, indent=1, ensure_ascii=False))


def rates(rows: list[dict], key) -> None:
    buckets: dict[tuple, list[str]] = defaultdict(list)
    for r in rows:
        k = key(r)
        if k is None:
            continue
        buckets[k].append(r["status"])
    print(f"{'family':46s} {'ok':>4s} {'died':>5s} {'rate':>6s}")
    for k, v in sorted(buckets.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        ok = v.count("ok")
        print(f"{str(k):46s} {ok:4d} {len(v) - ok:5d} {ok / len(v) * 100:5.0f}%")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?", default="rate", choices=["add", "rate", "family", "poison"])
    ap.add_argument("frame", nargs="?")
    ap.add_argument("--costume")
    ap.add_argument("--pose")
    ap.add_argument("--camera")
    ap.add_argument("--ref", type=int, choices=[0, 1])
    ap.add_argument("--status", choices=["ok", "fail", "blocked"])
    ap.add_argument("--note")
    a = ap.parse_args()
    rows = load()

    if a.cmd == "add":
        if not a.frame or not a.status:
            raise SystemExit("add needs a frame name and --status")
        rows = [r for r in rows if r.get("frame") != a.frame]
        rows.append({"frame": a.frame, "costume": a.costume, "pose": a.pose, "camera": a.camera, "ref": a.ref, "status": a.status, "note": a.note})
        save(rows)
        print(f"logged {a.frame}: {a.status}")
        return

    if not rows:
        print("genlog empty — record rows with: train_genlog.py add <frame> --costume X --pose Y --ref 1 --status ok")
        return

    if a.cmd == "rate":
        rates(rows, lambda r: (r.get("costume"), r.get("pose")))
        print()
        rates(rows, lambda r: (r.get("costume"),))
        print()
        rates(rows, lambda r: (r.get("pose"),))
    elif a.cmd == "family":
        rates(rows, lambda r: (r.get("costume"), r.get("pose"), r.get("camera")))
    else:  # poison: any (costume) that has died with no surviving frame at all
        by_c: dict[str, list[str]] = defaultdict(list)
        for r in rows:
            by_c[r.get("costume") or "?"].append(r["status"])
        dead = [c for c, v in by_c.items() if "ok" not in v]
        print(f"costumes with zero survivors ({len(dead)}): {', '.join(sorted(dead)) or 'none'}")
        by_p: dict[str, list[str]] = defaultdict(list)
        for r in rows:
            by_p[r.get("pose") or "?"].append(r["status"])
        dead = [p for p, v in by_p.items() if "ok" not in v]
        print(f"poses with zero survivors ({len(dead)}): {', '.join(sorted(dead)) or 'none'}")
        blocked = [r["frame"] for r in rows if r["status"] == "blocked"]
        print(f"explicit moderation blocks ({len(blocked)}): {', '.join(blocked) or 'none'}")


if __name__ == "__main__":
    main()
