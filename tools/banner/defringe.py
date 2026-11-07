import sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
src,dst,band,ero=sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4])
im=np.asarray(Image.open(src).convert('RGBA')).astype(np.float32)
rgb=im[...,:3]; a=im[...,3]/255
solid=a>0.98
d=ndimage.distance_transform_edt(solid)          # distance to edge (inside)
core=d>band                                      # interior well away from rim
# interior color estimate near edges: normalized blur of core pixels
sig=band*1.2
w=ndimage.gaussian_filter(core.astype(np.float32),sig)
est=np.stack([ndimage.gaussian_filter(rgb[...,c]*core,sig) for c in range(3)],-1)/np.maximum(w[...,None],1e-4)
# for still-uncovered (very thin parts), widen
miss=w<0.02
if miss.any():
    w2=ndimage.gaussian_filter(core.astype(np.float32),sig*4); est2=np.stack([ndimage.gaussian_filter(rgb[...,c]*core,sig*4) for c in range(3)],-1)/np.maximum(w2[...,None],1e-4)
    est[miss]=est2[miss]
t=np.clip(1-d/band,0,1)[...,None]                # 1 at edge → 0 at band
dark=np.minimum(rgb,est*0.95)                    # only darken (bright rim)
out=rgb*(1-t)+dark*t
# shrink alpha a little + soft edge
a2=ndimage.distance_transform_edt(a>0.5)
na=np.clip((a2-ero)/1.5,0,1)*np.clip(a,0,1)
res=np.dstack([np.clip(out,0,255),na*255]).astype(np.uint8)
Image.fromarray(res,'RGBA').save(dst)
