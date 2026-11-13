# Gerçek görsellerden katmanlar: taban (gerçek masa), cihaz katmanları (gölgesiyle), ön katman (öndeki cımbız/şırınga/tornavida).
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
G = '/tmp/g'; OUT = '/home/claude/tezgah-ui4/img'; os.makedirs(OUT, exist_ok=True)
W, H = 1536, 1024
meta = json.load(open('/home/claude/svg3d/poz/kirp.json'))
bg = Image.open(f'{G}/bos.png').convert('RGBA')
bg.convert('RGB').save(f'{OUT}/taban.webp', quality=86)

def layer(slot, pid):
    bx, by, s = meta[f'{slot}-{pid}']
    L = Image.open(f'{G}/{slot}-{pid}.png').convert('RGBA').resize((s, s), Image.LANCZOS)
    def body(a):   # gövde kutusu: ince kablo/kalem/hortum açma işlemiyle silinir, en büyük parça
        from scipy import ndimage
        m = ndimage.binary_opening(a > 128, structure=np.ones((13, 13)))
        lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n+1)); m = lab == (int(np.argmax(sz)) + 1)
        ys, xs = np.where(m); return xs.min(), ys.min(), xs.max(), ys.max()
    la = np.asarray(L)[..., 3]; g0, g1, g2, g3 = body(la)
    pa = np.asarray(Image.open(f'/tmp/pz-{slot}-{pid}.png'))[..., 3]; p0, p1, p2, p3 = body(pa)
    k = min((p2-p0)/(g2-g0), (p3-p1)/(g3-g1))          # çizimdeki boya sığdır
    L = L.resize((max(1, round(L.width*k)), max(1, round(L.height*k))), Image.LANCZOS)
    gx, gy = (g0+g2)/2*k, g3*k                           # gövde alt-orta → çizimdeki alt-orta
    ox, oy = round((p0+p2)/2 - gx), round(p3 - gy)
    full = Image.new('RGBA', (W, H), (0, 0, 0, 0)); full.paste(L, (ox, oy), L)
    A = np.asarray(full)[..., 3].astype(np.float32) / 255
    rows = np.where(A.max(1) > .5)[0]; bot = rows.max()
    # ortam gölgesi: silüet yere basık, sağa-aşağı (ışık sol üstten)
    ys, xs = np.where(A > .5); x0, x1 = xs.min(), xs.max()
    sil = Image.fromarray((A[ys.min():bot+1, x0:x1+1]*255).astype(np.uint8)).resize((x1-x0+1, max(4, (bot-ys.min())//6)))
    sh = Image.new('L', (W, H), 0); sh.paste(sil, (x0 + 14, bot - sil.height//2 + 2))
    sh = sh.filter(ImageFilter.GaussianBlur(16)).point(lambda v: int(v*.42))
    # temas gölgesi: her sütunun en alt opak noktası (gövdenin tabanına yakın olanlar)
    ct = np.zeros((H, W), np.float32)
    for c in range(x0, x1+1, 2):
        col = np.where(A[:, c] > .5)[0]
        if len(col) and col.max() > bot - 40: y = col.max(); ct[max(0, y-3):y+5, max(0, c-4):c+5] = 1
    ct = Image.fromarray((ct*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)).point(lambda v: int(v*.55))
    sha = np.maximum(np.asarray(sh), np.asarray(ct)).astype(np.uint8)
    shadow = Image.new('RGBA', (W, H), (24, 20, 16, 0)); shadow.putalpha(Image.fromarray(sha))
    out = Image.alpha_composite(shadow, full)
    out.save(f'{OUT}/{slot}-{pid}.webp', quality=88, method=6)
    # küçük resim
    c = full.crop((x0-8, ys.min()-8, x1+8, bot+8)); c.thumbnail((300, 300), Image.LANCZOS); c.save(f'{OUT}/t-{slot}-{pid}.webp', quality=88)
    return out

# ön katman: gerçek masadaki öndeki küçük eşyalar (cihazların önünde kalsın)
on = Image.open('/tmp/on.png').convert('RGBA'); m = Image.fromarray((np.asarray(on)[..., 3] > 30).astype(np.uint8)*255)
m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2))
front = bg.copy(); front.putalpha(m); front.save(f'{OUT}/on.webp', quality=88, method=6)

if __name__ == '__main__':
    SEC = {'guc': [1996, 1916], 'havya': [835, 2745], 'mikro': [2913, 3030], 'sicak': [3066, 2671]}
    for slot, ids in SEC.items():
        for pid in ids:
            if os.path.exists(f'{G}/{slot}-{pid}.png'): layer(slot, pid); print('ok', slot, pid)
            else: print('YOK', slot, pid)
    # boş yuva hayaletleri 3B'den
    for slot in SEC: Image.open(f'/tmp/bos-{slot}.png').convert('RGBA').save(f'{OUT}/bos-{slot}.webp', quality=88)
