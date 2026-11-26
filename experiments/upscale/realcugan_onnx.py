"""Local CPU Real-CUGAN evaluation on opaque RGB images. Model is external, not bundled."""
import argparse, math, time
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image

def main():
 p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--model',required=True);p.add_argument('--output',required=True);p.add_argument('--scale',type=int,choices=[2,3,4],default=4);p.add_argument('--tile',type=int,default=128);p.add_argument('--halo',type=int,default=32);p.add_argument('--threads',type=int,default=2);a=p.parse_args()
 im=Image.open(a.input).convert('RGB');arr=np.asarray(im);h,w=arr.shape[:2];opts=ort.SessionOptions();opts.intra_op_num_threads=a.threads;opts.inter_op_num_threads=1;s=ort.InferenceSession(a.model,opts,providers=['CPUExecutionProvider']);out=np.empty((h*a.scale,w*a.scale,3),np.uint8);total=math.ceil(w/a.tile)*math.ceil(h/a.tile);t=time.monotonic();i=0
 for y in range(0,h,a.tile):
  for x in range(0,w,a.tile):
   x1=min(x+a.tile,w);y1=min(y+a.tile,h);l=max(x-a.halo,0);u=max(y-a.halo,0);r=min(x1+a.halo,w);b=min(y1+a.halo,h)
   patch=np.ascontiguousarray(arr[u:b,l:r].transpose(2,0,1)[None],dtype=np.float32)/255
   result=s.run(None,{'image':patch,'alpha':np.array(1,dtype=np.float32)})[0][0].transpose(1,2,0)
   expect=((b-u)*a.scale,(r-l)*a.scale,3)
   if result.shape!=expect:raise ValueError(f'Unexpected shape {result.shape}, expected {expect}')
   result=np.clip(np.rint(result*255),0,255).astype(np.uint8)
   out[y*a.scale:y1*a.scale,x*a.scale:x1*a.scale]=result[(y-u)*a.scale:(y1-u)*a.scale,(x-l)*a.scale:(x1-l)*a.scale]
   i+=1;print(f'{i}/{total} tiles, {time.monotonic()-t:.1f}s',flush=True)
 Path(a.output).parent.mkdir(parents=True,exist_ok=True);Image.fromarray(out).save(a.output,optimize=True);print(f'Saved {w*a.scale}x{h*a.scale} to {a.output}')
if __name__=='__main__':main()
