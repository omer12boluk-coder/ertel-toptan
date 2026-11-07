# Keşfet kutusu (800×1000, üst %40 yazı için boş) ve kategori kapağı (800×600) resmi üretir.
# Zemin: iki açık tonlu dikey degrade + sağ üstte hafif ışık; kesilmiş ürün alta oturur, altında yumuşak elips gölge.
# Yazı resme GÖMÜLMEZ (sayfada HTML). Kurallar: docs/banner-kurallari.md §8.
# Kullanım: python3 tools/banner/kapak.py <kesik_urun.png> <cikti.webp> <ton> [kesfet|kapak] [ölçek=0.78]
#   ton: nane | buz | gri | kum | gul   (mor yok)
#   girdi: önce cut.py ile zemini saydam yapılmış PNG
import sys
import numpy as np
from PIL import Image, ImageFilter

TON = {'nane': ('#f2fbf7', '#d8efe4'), 'buz': ('#f1f6fd', '#dde7f7'), 'gri': ('#f6f6f8', '#e3e4ea'),
       'kum': ('#faf5ee', '#eee2d2'), 'gul': ('#fcf2f0', '#f2dcd7')}
hx = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)

def make(src, dst, ton='gri', kind='kesfet', scale=0.78):
    W, H = (800, 1000) if kind == 'kesfet' else (800, 600)
    top, bot = map(hx, TON[ton])
    y = np.linspace(0, 1, H)[:, None, None]
    bg = top * (1 - y) + bot * y
    bg = np.repeat(bg, W, axis=1)
    yy, xx = np.mgrid[0:H, 0:W]
    glow = np.exp(-(((xx - W * .85) / (W * .55)) ** 2 + ((yy - H * .05) / (H * .45)) ** 2))[..., None]
    bg = bg * (1 - glow * .6) + 255 * glow * .6
    canvas = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).convert('RGBA')
    p = Image.open(src).convert('RGBA')
    # ürün alanı: keşfette alt %60, kapakta ortada (üstte hafif boşluk)
    boxW, boxH = W * scale, (H * .56 if kind == 'kesfet' else H * .78) * (scale / .78)
    r = min(boxW / p.width, boxH / p.height)
    p = p.resize((max(1, round(p.width * r)), max(1, round(p.height * r))), Image.LANCZOS)
    base = H - (H * .07 if kind == 'kesfet' else H * .08)
    x0, y0 = round((W - p.width) / 2), round(base - p.height)
    # gölge: ürün tabanının altında yumuşak elips
    sh = Image.new('L', (W, H), 0)
    ew, eh = p.width * .8, max(14, p.height * .07)
    e = np.exp(-(((xx - W / 2) / (ew / 2)) ** 2 + ((yy - base) / (eh / 2)) ** 2) * 2.2)
    sh = Image.fromarray((e * 70).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
    canvas.alpha_composite(Image.merge('RGBA', [Image.new('L', (W, H), 40)] * 3 + [sh]))
    canvas.alpha_composite(p, (x0, y0))
    canvas.convert('RGB').save(dst, 'WEBP', quality=86)
    print(dst, (W, H), 'ürün', p.size)

if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) < 3: sys.exit(__doc__ if __doc__ else 'kullanım: kapak.py kesik.png cikti.webp ton [kesfet|kapak] [olcek]')
    make(a[0], a[1], a[2], a[3] if len(a) > 3 else 'kesfet', float(a[4]) if len(a) > 4 else 0.78)
