#!/usr/bin/env python3
"""Publish the per-art rigs to `public/rigs/` in the form the game loads.

The authored documents are pretty-printed (about 590 KB each) for review and diffing. What ships
is the same document with no whitespace, split per art so the game fetches exactly one: 240 KB on
the wire, ~60 KB gzipped at the CDN.

Usage:
    python3 scripts/publish_rigs.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

SRC = Path("experiments/rig-lab")
OUT = Path("public/rigs")


def art_of(path: Path) -> str:
    stem = path.stem.replace("miya_day1", "t1_s0").replace("miya_", "")
    return stem


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    index: dict[str, dict] = {}
    total = 0
    for path in sorted(SRC.glob("miya_*.obone")):
        art = art_of(path)
        doc = json.loads(path.read_text())
        doc.pop("scripts", None)
        payload = json.dumps(doc, separators=(",", ":"), ensure_ascii=False)
        target = OUT / f"{art}.obone"
        target.write_text(payload)
        total += len(payload.encode())
        index[art] = {
            "file": f"/rigs/{art}.obone",
            "plate": doc["images"][0]["src"],
            "animations": [a["name"] for a in doc["animations"]],
            "hasMouth": any(s["id"] == "slot_mouth" for s in doc["skeleton"]["slots"]),
            "bones": len(doc["skeleton"]["bones"]),
        }
        print(f"  {art:14s} {len(payload) // 1024:4d} KB  {len(doc['animations'])} animations")

    (OUT / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False))
    print(f"\n{len(index)} rigs, {total / 1024 / 1024:.1f} MB total in {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
