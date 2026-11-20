"""Experimental RGBA Real-CUGAN runner. Does not overwrite game assets.
Model x4 on extended RGB, alpha is resampled separately. Input dimensions and alpha
are preserved in the optional game-sized proof, so landmarks stay registered.
"""
import argparse, math, time
from pathlib import Path
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--model',required=True);p.add_argument('--output',required=True);p.add_argument('--proof');p.add_argument('--tile',type=int,default=128);p.add_argument('--halo',type=int,default=32);p.add_argument('--threads',type=int,default=2);a=p.parse_args()
im=Image.open(a.input).convert('RGBA'); arr=np.array(im); h,w=arr.shape[:2]
# Flood fully transparent pixels with nearest visible colour to avoid black fringes.
# RGB inside alpha edges is left untouched; alpha is never sent to the model.
mask=(arr[:,:,3]==0).astype(np.uint8)
_,labels=cv2.distanceTransformWithLabels(mask,cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
ys,xs=np.where(mask==0); extended=arr[:,:,:3].copy()
if len(xs):
 labels=np.maximum(labels-1,0); extended[mask.astype(bool)]=arr[ys[labels[mask.astype(bool)]],xs[labels[mask.astype(bool)]],:3]
opts=ort.SessionOptions();opts.intra_op_num_threads=a.threads;opts.inter_op_num_threads=1;s=ort.InferenceSession(a.model,opts,providers=['CPUExecutionProvider'])
out=np.empty((h*4,w*4,3),np.uint8); total=math.ceil(w/a.tile)*math.ceil(h/a.tile); t=time.monotonic(); i=0
for y in range(0,h,a.tile):
 for x in range(0,w,a.tile):
  x1=min(x+a.tile,w);y1=min(y+a.tile,h);l=max(x-a.halo,0);u=max(y-a.halo,0);r=min(x1+a.halo,w);b=min(y1+a.halo,h)
  patch=np.ascontiguousarray(extended[u:b,l:r].transpose(2,0,1)[None],dtype=np.float32)/255
  result=s.run(None,{'image':patch,'alpha':np.array(1,dtype=np.float32)})[0][0].transpose(1,2,0)
  if result.shape!=((b-u)*4,(r-l)*4,3): raise ValueError('Unexpected model output')
  result=np.clip(np.rint(result*255),0,255).astype(np.uint8)
  out[y*4:y1*4,x*4:x1*4]=result[(y-u)*4:(y1-u)*4,(x-l)*4:(x1-l)*4]
  i+=1
print(f'{a.input}: {total} tiles in {time.monotonic()-t:.1f}s',flush=True)
rgb=Image.fromarray(out,'RGB'); alpha=im.getchannel('A'); rgba=rgb.convert('RGBA');rgba.putalpha(alpha.resize((w*4,h*4),Image.Resampling.LANCZOS));Path(a.output).parent.mkdir(parents=True,exist_ok=True);rgba.save(a.output,quality=95,method=4)
if a.proof:
 # Resize RGB before reattaching the original alpha to preserve exact silhouette.
 proof=rgb.resize((w,h),Image.Resampling.LANCZOS).convert('RGBA');proof.putalpha(alpha);Path(a.proof).parent.mkdir(parents=True,exist_ok=True);proof.save(a.proof,lossless=True,method=4)
print(f'Wrote {a.output}; proof={a.proof}',flush=True)
