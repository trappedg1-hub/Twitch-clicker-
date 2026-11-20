"""Rough, local-only motion study. Never modifies the approved source."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parent
src=root.parent.parent/'public/art/heroine_t6_start_hq.webp'
a=np.array(Image.open(src).convert('RGBA')); h,w=a.shape[:2]
# A deliberately approximate polygon around the cucumber, hand and forearm.
pts=np.array([(190,329),(199,330),(215,338),(228,354),(247,385),(261,410),(270,407),(277,412),(296,438),(311,454),(337,475),(352,493),(358,508),(355,522),(344,532),(332,536),(340,548),(353,566),(369,589),(382,610),(391,636),(391,659),(383,683),(371,702),(358,713),(344,711),(329,702),(314,687),(302,672),(293,655),(285,635),(279,616),(275,594),(270,575),(263,555),(257,545),(244,537),(231,530),(220,520),(216,508),(216,490),(211,474),(207,457),(208,447),(213,437),(207,423),(198,404),(190,383),(185,362),(186,345)],np.int32)
mask=np.zeros((h,w),np.uint8); cv2.fillPoly(mask,[pts],255)
# Only opaque content becomes the foreground layer. A feather makes the elbow seam softer.
mask=cv2.GaussianBlur(mask,(5,5),1)
alpha=a[:,:,3].astype(np.float32)/255
layer=a.copy();layer[:,:,3]=np.round(a[:,:,3]*(mask/255)).astype(np.uint8)
# Inpaint underneath moving pixels. The result is intentionally experimental: unseen
# pixels are inferred, not original art, and must be reviewed in motion.
inpaint_mask=((mask>16)&(a[:,:,3]>0)).astype(np.uint8)*255
base=np.empty_like(a)
for channel in range(4):base[:,:,channel]=cv2.inpaint(a[:,:,channel],inpaint_mask,7,cv2.INPAINT_TELEA)
Image.fromarray(base,'RGBA').save(root/'background.png')
Image.fromarray(layer,'RGBA').save(root/'forearm.png')
print('prepared', int(np.count_nonzero(inpaint_mask)), 'pixels; source unchanged')
