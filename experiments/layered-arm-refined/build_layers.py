import cv2,numpy as np
from PIL import Image
from pathlib import Path
root=Path(__file__).resolve().parent
src=root.parent.parent/'public/art/heroine_t6_start_hq.webp'
a=np.array(Image.open(src).convert('RGBA'));h,w=a.shape[:2]
pts=np.array([(190,329),(199,330),(215,338),(228,354),(247,385),(261,410),(270,407),(277,412),(296,438),(311,454),(337,475),(352,493),(358,508),(355,522),(344,532),(332,536),(340,548),(353,566),(369,589),(382,610),(391,636),(391,659),(383,683),(371,702),(358,713),(344,711),(329,702),(314,687),(302,672),(293,655),(285,635),(279,616),(275,594),(270,575),(263,555),(257,545),(244,537),(231,530),(220,520),(216,508),(216,490),(211,474),(207,457),(208,447),(213,437),(207,423),(198,404),(190,383),(185,362),(186,345)],np.int32)
poly=np.zeros((h,w),np.uint8);cv2.fillPoly(poly,[pts],255)
rect=a[300:735,170:405,:]; p=poly[300:735,170:405];r=rect[:,:,0].astype(float);g=rect[:,:,1].astype(float);b=rect[:,:,2].astype(float)
mask=np.zeros(p.shape,np.uint8);mask[(p>0)&(rect[:,:,3]>0)]=cv2.GC_PR_FGD
skin=(r>100)&(r>g*1.11)&(g>b*1.02);green=(g>r*1.12)&(g>b*1.1)&(g>30);strong=(skin|green)&(p>0)&(rect[:,:,3]>200)
mask[strong]=cv2.GC_FGD
cv2.grabCut(cv2.cvtColor(rect[:,:,:3],cv2.COLOR_RGB2BGR),mask,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),5,cv2.GC_INIT_WITH_MASK)
seg=np.where((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD),255,0).astype('uint8');seg=cv2.morphologyEx(seg,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8));seg=cv2.GaussianBlur(seg,(3,3),.7)
# Exclude portions of the shoulder which the color-based segmentation mistook for the hand.
Y,X=np.indices(seg.shape); X=X+170; Y=Y+300
ys=np.array([545,560,580,600,620,640,660,680,700,715])
xs=np.array([324,331,343,356,369,377,381,379,372,360])
edge=np.interp(Y,ys,xs)
skin_cut=((Y>=476)&(Y<=531)&(X>=338)&(r>g*1.11)&(r>100)) | ((Y>=545)&(X>edge))
seg[skin_cut]=0
maskfull=np.zeros((h,w),np.uint8);maskfull[300:735,170:405]=seg
layer=a.copy();layer[:,:,3]=np.round(a[:,:,3]*(maskfull/255)).astype(np.uint8)
mask=((maskfull>16)&(a[:,:,3]>0)).astype(np.uint8)*255
base=np.empty_like(a)
for channel in range(4):base[:,:,channel]=cv2.inpaint(a[:,:,channel],mask,7,cv2.INPAINT_TELEA)
Image.fromarray(base,'RGBA').save(root/'background.png');Image.fromarray(layer,'RGBA').save(root/'forearm.png')
print('Hand pixels:',np.count_nonzero(mask))
