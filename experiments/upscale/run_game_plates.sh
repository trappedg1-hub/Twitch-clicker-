#!/usr/bin/env bash
# Resumable, non-destructive queue. Run from repository root.
set -euo pipefail
PYTHON=${PYTHON:-.qa-out/upscale-venv/bin/python}
MODEL=${MODEL:?Set MODEL to the Real-CUGAN up4x-latest-conservative.onnx file}
SOURCE_DIR=${SOURCE_DIR:?Set SOURCE_DIR to the original pre-upscale plates; do not feed enhanced assets back into the model}
test -f "$MODEL" && test -x "$PYTHON"
mkdir -p deliverables/game-upscale .qa-out/rgba-game-proof
while IFS= read -r name; do
  [ -n "$name" ] || continue
  case "$name" in */*|*..*) echo 'Invalid filename' >&2; exit 1;; esac
  src="$SOURCE_DIR/$name"; out="deliverables/game-upscale/$name"; proof=".qa-out/rgba-game-proof/$name"
  # Only reuse files whose recorded input hash and output decode/dimensions match.
  hash=$(sha256sum "$src" | cut -d' ' -f1)
  if [ -f "$out.sha256" ] && [ "$(cat "$out.sha256")" = "$hash" ] && [ -f "$proof" ] && "$PYTHON" - "$src" "$out" "$proof" <<'PY'
import sys
from PIL import Image, ImageChops
try:
 a,b,c=(Image.open(p).convert('RGBA') for p in sys.argv[1:])
 assert b.size == (a.width*4,a.height*4) and c.size == a.size
 assert ImageChops.difference(a.getchannel('A'),c.getchannel('A')).getbbox() is None
except Exception:
 sys.exit(1)
PY
  then echo "SKIP $name"; continue; fi
  echo "PROCESS $name"
  tmp="$out.tmp.webp"; tmpproof="$proof.tmp.webp"
  OMP_NUM_THREADS=2 "$PYTHON" experiments/upscale/rgba_realcugan.py --input "$src" --model "$MODEL" --output "$tmp" --proof "$tmpproof"
  mv "$tmp" "$out"; mv "$tmpproof" "$proof"; printf '%s\n' "$hash" > "$out.sha256"
done < experiments/upscale/game-plates.txt
echo 'BATCH COMPLETE'
