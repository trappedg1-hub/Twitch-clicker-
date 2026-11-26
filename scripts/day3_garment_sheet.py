#!/usr/bin/env python3
"""Side-by-side garment comparison for Day 3 (+ what touches the plate edges)."""
from __future__ import annotations
import cv2, numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
OUT = ROOT / '.qa-out'
# plate face boxes (x, y, w, h) from src/heroine/faceAnchors.ts
FACE = {
 'heroine_t3_s0': (413,208,224,300),
 'heroine_t3_s1': (396,200,240,300),
 'heroine_t3_s2': (560,208,300,260),
 'heroine_t3_s3': (408,176,368,300),
 'heroine_t3_s4': (396,176,396,288),
}
NAMES = list(FACE) + ['heroine_t3_flash']
FACE['heroine_t3_flash'] = FACE['heroine_t3_s3']

def load(n): return cv2.imread(str(ART / f'{n}.png'), cv2.IMREAD_UNCHANGED)

def on_transparent(img, color=(60,50,66)):
    b,g,r,a = cv2.split(img)
    bg = np.full_like(b, color[0]); bg2 = np.full_like(g, color[1]); bg3 = np.full_like(r, color[2])
    af = a.astype(np.float32)/255.0
    out = np.stack([ (b*af + bg3*(1-af)), (g*af + bg2*(1-af)), (r*af + bg*(1-af)) ],2).astype(np.uint8)
    return out

FULL_W = 250
TORSO_H = 430
cells = []
for n in NAMES:
    im = load(n)
    vis = on_transparent(im)
    H, W = vis.shape[:2]
    # full view
    s = FULL_W / W
    full = cv2.resize(vis, (FULL_W, int(H*s)), interpolation=cv2.INTER_AREA)
    lab = np.full((22, FULL_W, 3), 26, np.uint8)
    cv2.putText(lab, n.replace('heroine_t3_',''), (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (235,235,235), 1, cv2.LINE_AA)
    left = np.vstack([lab, full])
    # torso crop normalised by face width so the garment is at the same scale everywhere
    fx,fy,fw,fh = FACE[n]
    cx = fx + fw/2
    x0 = int(max(0, cx - 1.15*fw)); x1 = int(min(W, cx + 1.15*fw))
    y0 = int(max(0, fy + 0.55*fh)); y1 = int(min(H, fy + 0.55*fh + 2.35*fw))
    crop = vis[y0:y1, x0:x1]
    cs = TORSO_H / (x1-x0)
    crop = cv2.resize(crop, (TORSO_H, int((y1-y0)*cs)), interpolation=cv2.INTER_AREA)
    ch = max(430, crop.shape[0])
    pad = np.full((ch, crop.shape[1], 3), 26, np.uint8)
    pad[:crop.shape[0]] = crop
    lab2 = np.full((22, crop.shape[1], 3), 26, np.uint8)
    cv2.putText(lab2, f'torso {x0},{y0}-{x1},{y1}', (4,16), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200,200,200),1,cv2.LINE_AA)
    pair = np.hstack([left, np.vstack([lab2, pad])]) if False else None
    a_col = np.vstack([lab2, pad])
    hh = max(left.shape[0], a_col.shape[0])
    def pad_to(arr, hh):
        return cv2.copyMakeBorder(arr, 0, hh - arr.shape[0], 0, 0, cv2.BORDER_CONSTANT, value=(26,26,26))
    cells.append(np.hstack([pad_to(left, hh), pad_to(a_col, hh)]))
h = max(c.shape[0] for c in cells)
rows = [np.hstack([cv2.copyMakeBorder(c, 0, h-c.shape[0], 0, 0, cv2.BORDER_CONSTANT, value=(26,26,26)) for c in cells[i:i+3]]) for i in (0,3)]
sheet = np.vstack(rows)
for r0 in (0, h):
    cv2.line(sheet, (0, r0), (sheet.shape[1], r0), (90,90,90), 1)
cv2.imwrite(str(OUT / 'day3_garment_sheet.png'), sheet)
print('wrote', OUT / 'day3_garment_sheet.png', sheet.shape)

# what touches the left/right plate edge on the boo frame and the cape frame?
for n in ['heroine_t3_s3','heroine_t3_s4','heroine_t3_s0']:
    im = load(n); a = im[...,3]; bgr = im[...,:3]
    lum = (0.114*bgr[...,0] + 0.587*bgr[...,1] + 0.299*bgr[...,2]).astype(int)
    sat = (np.max(bgr,2).astype(int) - np.min(bgr,2).astype(int))
    for side, sl in (('L', slice(0,4)), ('R', slice(-4, None))):
        col = a[:, sl] > 240
        ys = np.where(col.any(1))[0]
        if len(ys) == 0: 
            print(f'{n} {side}: nothing touches'); continue
        rows_lum = [int(lum[y][sl][a[y][sl]>240].mean()) if (a[y][sl]>240).any() else 0 for y in ys[::max(1,len(ys)//6)]]
        print(f'{n} {side}: rows {ys.min()}..{ys.max()} ({len(ys)} rows) meanLum {rows_lum}')
