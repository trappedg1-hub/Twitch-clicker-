#!/usr/bin/env python3
"""Cut the approved new frames without repainting or changing their colour grade."""
import sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parent))
from process_day3_ghost_arts import alpha_for, decontaminate, trim_shadow_debris, PLATE_W, PLATE_H
from process_day4_frames import centre_horizontally, fit_head_row
from process_day6_frames import slide_to_bottom, measure_head_cap
root=Path(__file__).resolve().parents[1]
frames={
 'heroine_t4_start_hq':'day4_yoga_original_ref.png',
 'heroine_t5_start_hq2':'day5_bikini_start_retry_hires.png',
 'heroine_t6_start_hq':'day6_farm_start_new_hires.png',
 'heroine_t3_s3':'day3_boo_style_mix_round2.png',
 'heroine_t3_flash':'day3_boo_style_mix_round2.png',
 'heroine_t5_s2':'day5_cat_round2.png',
 'heroine_t5_s3':'day5_finale_chair_fixed.png',
}
for name, source in frames.items():
 if len(sys.argv) > 1 and name not in sys.argv[1:]:
  continue
 im=Image.open(root/'art-studio/raw'/source).convert('RGBA')
 if np.asarray(im.getchannel('A')).min()<250:
  rgba=im
 else:
  rgb=np.asarray(im.convert('RGB'),dtype=np.float32)
  # The chair is often dark plum too. Use a tight background threshold and preserve
  # enclosed dark areas rather than shaving the chair surface as background.
  bg=np.median(np.concatenate([rgb[0],rgb[-1],rgb[:,0],rgb[:,-1]]),axis=0)
  dist=np.linalg.norm(rgb-bg,axis=2)
  core=(dist<12).astype(np.uint8)
  n,labels,stats,_=cv2.connectedComponentsWithStats(core,8)
  border=np.unique(np.concatenate([labels[0],labels[-1],labels[:,0],labels[:,-1]]))
  mask=np.isin(labels,border) & (labels!=0)
  alpha=np.where(mask,0.0,1.0).astype(np.float32)
  # Feather only the exterior border, leaving all enclosed chair details intact.
  edge=cv2.dilate(mask.astype(np.uint8),np.ones((3,3),np.uint8)).astype(bool) & ~mask
  alpha[edge]=np.clip((dist[edge]-7)/12,0,1)
  clean=decontaminate(rgb,alpha,bg)
  rgba=Image.fromarray(np.dstack([clean,np.uint8(np.clip(alpha*255,0,255))]),'RGBA')
 # Uniform contain, never stretch the approved art.
 rgba.thumbnail((PLATE_W,PLATE_H),Image.Resampling.LANCZOS)
 canvas=Image.new('RGBA',(PLATE_W,PLATE_H)); canvas.alpha_composite(rgba,((PLATE_W-rgba.width)//2,(PLATE_H-rgba.height)//2))
 arr=np.array(canvas)
 arr=slide_to_bottom(arr,name)
 arr=fit_head_row(arr,name)
 arr=centre_horizontally(arr,name)
 print(name,measure_head_cap(arr,name))
 Image.fromarray(arr).save(root/'public/art'/f'{name}.webp','WEBP',quality=98,method=6)
