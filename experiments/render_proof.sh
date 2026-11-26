#!/usr/bin/env bash
# Render the proof for the rig rebuild: what a phone shows, frame by frame.
set -e
cd "$(dirname "$0")/.."
mkdir -p /tmp/renders
for spec in "idle 8.0 5" "tap 0.6 60" "shake 1.0 40" "turn 2.6 30"; do
  set -- $spec
  anim=$1; secs=$2; fps=$3
  node experiments/dump_frames.mjs t1_s0 "$anim" "$secs" "$fps" > "/tmp/renders/$anim.json"
  python3 scripts/rig_preview.py "/tmp/renders/$anim.json" --crop bust --scale 0.45 \
    --out "/tmp/renders/$anim" --strip 24
  echo "done $anim"
done
