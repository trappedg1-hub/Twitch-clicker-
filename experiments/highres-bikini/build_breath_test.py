"""Create a lossless visual test from the generated image; does not alter game assets."""
from pathlib import Path
import math
import cv2
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parent
src=Image.open(root/'animation_reference.png').convert('RGB')
a=np.array(src);h,w=a.shape[:2];y,x=np.mgrid[:h,:w].astype('float32')
# Conservative interior of the torso; this is deformation, not separate anatomy.
d=((x-422)/108)**2+((y-383)/65)**2
weight=np.maximum(0,1-d)**2
frames=[]
for i in range(20):
 wave=math.sin(2*math.pi*i/20)
 dx=(x-422)/108*weight*wave*5
 dy=weight*wave*4
 frame=cv2.remap(a,x-dx,y-dy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
 frames.append(Image.fromarray(frame))
out=root.parent.parent/'deliverables';out.mkdir(exist_ok=True)
frames[0].save(out/'test_bikini_breath_full.png',save_all=True,append_images=frames[1:],duration=120,loop=0,disposal=0,blend=0,compress_level=6)
frames[0].save(out/'test_bikini_breath.gif',save_all=True,append_images=frames[1:],duration=120,loop=0,disposal=2,optimize=True)
print('source:',w,h,'frames:',len(frames))
