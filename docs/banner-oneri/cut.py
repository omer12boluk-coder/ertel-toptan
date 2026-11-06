import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
def cutout(src, dst, crop=None, thr=236, maxw=1600):
    im = Image.open(src).convert('RGB')
    if crop: W,H = im.size; im = im.crop((int(crop[0]*W), int(crop[1]*H), int(crop[2]*W), int(crop[3]*H)))
    a = np.asarray(im).astype(np.int16)
    mn = a.min(axis=2); mx = a.max(axis=2)
    bgc = (mn > thr) & ((mx - mn) < 18)
    lab, n = ndimage.label(bgc)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:,0], lab[:,-1]]))) - {0}
    bg = np.isin(lab, list(border))
    bg = ndimage.binary_opening(bg, iterations=1)
    alpha = (~bg).astype(np.float32)
    # küçük adacıkları at
    lab2, n2 = ndimage.label(alpha > 0.5)
    if n2 > 1:
        sizes = ndimage.sum(alpha > 0.5, lab2, range(1, n2+1)); keep = np.isin(lab2, [i+1 for i,s in enumerate(sizes) if s > sizes.max()*0.004])
        alpha = alpha * keep
    A = Image.fromarray((alpha*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))
    out = im.convert('RGBA'); out.putalpha(A)
    bb = A.point(lambda v: 255 if v > 8 else 0).getbbox(); out = out.crop(bb)
    if out.width > maxw: out = out.resize((maxw, round(out.height*maxw/out.width)), Image.LANCZOS)
    out.save(dst); return out.size
for src, dst, crop in [
  ('raw/3064_0.webp','cut/zm_front.png',None), ('raw/3064_2.webp','cut/zm_left.png',None), ('raw/3064_4.webp','cut/zm_right.png',None),
  ('raw/2759_0.webp','cut/ht316.png',(0,0.15,1,1)), ('raw/2756_4.webp','cut/da07.png',(0.1,0.12,0.9,0.72)),
  ('raw/30_0.png','cut/sm4.png',None), ('raw/2817_0.jpeg','cut/v1s.png',(0,0.1,1,0.92)), ('raw/3062_0.png','cut/power.png',(0,0.2,1,1)),
]:
    print(dst, cutout(src, dst, crop))
