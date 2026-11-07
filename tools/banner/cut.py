# Ürün fotoğrafının beyaz zeminini saydam yapar (kenara değen beyaz alan; küçük adacıklar atılır; 1.1px yumuşak kenar).
# Kullanım: python3 tools/banner/cut.py <girdi> <cikti.png> [kırp: x0,y0,x1,y1 oran] [eşik=236]
# Koyu zemine konacaksa sonra defringe.py. Kurallar: docs/banner-kurallari.md §4
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
if __name__ == '__main__':
    import sys
    a = sys.argv[1:]
    if len(a) < 2: sys.exit('kullanım: cut.py girdi cikti.png [x0,y0,x1,y1] [esik]')
    crop = tuple(float(x) for x in a[2].split(',')) if len(a) > 2 and a[2] not in ('', '-') else None
    print(a[1], cutout(a[0], a[1], crop, int(a[3]) if len(a) > 3 else 236))
