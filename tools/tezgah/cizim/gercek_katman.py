# Gerçek görsellerden katmanlar: taban (gerçek masa), cihaz katmanları (gölgesiyle), ön katman (öndeki cımbız/şırınga/tornavida).
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
G = '/tmp/g'; OUT = '/home/claude/tezgah-ui4/img'; os.makedirs(OUT, exist_ok=True)
W, H = 1536, 1024
meta = json.load(open('/home/claude/svg3d/poz/kirp.json'))
bg = Image.open(f'{G}/bos.png').convert('RGBA')
bg.convert('RGB').save(f'{OUT}/taban.webp', quality=86)

SC = {'guc': 1.45}
SRC = {'mikro-3030': '/home/claude/foto/3030.png'}
SHEAR = {'havya-2745': .07, 'mikro-3030': .05}
def scale_about(im, k, anchor):
    ax, ay = anchor; w, h = im.size
    big = im.resize((round(w*k), round(h*k)), Image.LANCZOS)
    out = Image.new(im.mode, (w, h), 0 if im.mode == 'L' else (0, 0, 0, 0))
    out.paste(big, (round(ax - ax*k), round(ay - ay*k)))
    return out

OPEN = {'guc': 31}
def layer(slot, pid):
    bx, by, s = meta[f'{slot}-{pid}']
    src = SRC.get(f'{slot}-{pid}', f'{G}/{slot}-{pid}.png')
    L = Image.open(src).convert('RGBA')
    if src != f'{G}/{slot}-{pid}.png':      # kesilmiş ürün görseli: kare tuvale ortala
        c = Image.new('RGBA', (max(L.size),)*2, (0, 0, 0, 0)); c.paste(L, ((c.width-L.width)//2, (c.height-L.height)//2)); L = c
    L = L.resize((s, s), Image.LANCZOS)
    sh = SHEAR.get(f'{slot}-{pid}', 0)
    if sh:   # sahnenin açısına uydur: yatay kenarlar sağa doğru hafif aşağı
        pad = int(abs(sh)*s) + 4; big = Image.new('RGBA', (s, s + 2*pad), (0, 0, 0, 0)); big.paste(L, (0, pad)); cx = s/2
        L = big.transform(big.size, Image.AFFINE, (1, 0, 0, -sh, 1, sh*cx), Image.BICUBIC).crop((0, pad, s, s + pad))
    def body(a):   # gövde kutusu: ince kablo/kalem/hortum açma işlemiyle silinir, en büyük parça
        from scipy import ndimage
        m = ndimage.binary_opening(a > 128, structure=np.ones((OPEN.get(slot, 13),)*2))
        lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n+1)); m = lab == (int(np.argmax(sz)) + 1)
        ys, xs = np.where(m); return xs.min(), ys.min(), xs.max(), ys.max()
    la = np.asarray(L)[..., 3]; g0, g1, g2, g3 = body(la)
    pa = np.asarray(Image.open(f'/tmp/pz-{slot}-{pid}.png'))[..., 3]; p0, p1, p2, p3 = body(pa)
    k = min((p2-p0)/(g2-g0), (p3-p1)/(g3-g1))          # çizimdeki boya sığdır
    L = L.resize((max(1, round(L.width*k)), max(1, round(L.height*k))), Image.LANCZOS)
    gx, gy = (g0+g2)/2*k, g3*k                           # gövde alt-orta → çizimdeki alt-orta
    ox, oy = round((p0+p2)/2 - gx), round(p3 - gy)
    full = Image.new('RGBA', (W, H), (0, 0, 0, 0)); full.paste(L, (ox, oy), L)
    anchor = ((p0+p2)/2, p3)
    if SC.get(slot, 1) != 1: full = scale_about(full, SC[slot], anchor)
    A = np.asarray(full)[..., 3].astype(np.float32) / 255
    ys, xs = np.where(A > .5); x0, x1 = xs.min(), xs.max(); bot = ys.max()
    sh3 = Image.open(f'/tmp/sh-{slot}-{pid}.png').convert('RGBA').split()[3]          # 3B sahnenin gölgesi
    if SC.get(slot, 1) != 1: sh3 = scale_about(sh3, SC[slot], anchor)
    sha = np.asarray(sh3).astype(np.float32) * .9
    # temas: gövdenin masaya değdiği alt kenarda ince koyuluk
    from scipy import ndimage
    bm = ndimage.binary_opening(A > .5, structure=np.ones((9, 9)))
    ct = np.zeros((H, W), np.float32)
    for c in range(x0, x1+1, 2):
        col = np.where(bm[:, c])[0]
        if len(col): y = col.max(); ct[max(0, y-2):y+4, max(0, c-3):c+4] = 1
    ct = np.asarray(Image.fromarray((ct*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32) * .5
    sha = np.clip(np.maximum(sha, ct), 0, 255).astype(np.uint8)
    shadow = Image.new('RGBA', (W, H), (20, 17, 14, 0)); shadow.putalpha(Image.fromarray(sha))
    out = Image.alpha_composite(shadow, full)
    out.save(f'{OUT}/{slot}-{pid}.webp', quality=88, method=6)
    # küçük resim
    c = full.crop((x0-8, ys.min()-8, x1+8, bot+8)); c.thumbnail((300, 300), Image.LANCZOS); c.save(f'{OUT}/t-{slot}-{pid}.webp', quality=88)
    return out

# ön katman: gerçek masadaki öndeki küçük eşyalar (cihazların önünde kalsın)
on = Image.open('/tmp/on.png').convert('RGBA'); _a = np.asarray(on)[..., 3] > 30; _a[:, :482] = False; m = Image.fromarray(_a.astype(np.uint8)*255)
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
