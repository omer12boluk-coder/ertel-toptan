#!/usr/bin/env python3
# 8.11.2026 gece modu marka logoları: hosting/public/brands/*.png → brands/dk/*.png
# Kural: renksiz koyu pikseller (siyah/gri yazı) açığa döner, renkli pikseller AYNEN kalır (çok koyuysa biraz açılır),
# beyaz/açık pikseller aynı kalır. Kenarı dolu 'rozet' logolar (Mr Yang, Soptop…) olduğu gibi kopyalanır.
# Uygulama gece modunda /brands/x.png yerine /brands/dk/x.png gösterir (main.jsx swapDarkLogos). Yeni logo eklenince bu betiği çalıştır.
import os, sys, colorsys
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', 'hosting', 'public', 'brands')
OUT = os.path.join(ROOT, 'dk'); os.makedirs(OUT, exist_ok=True)
# Açık zemin için '-dark' sürümü olan markalarda gece modunda asıl (beyaz) logo kullanılır
ALIAS = {'aixun-dark.png': 'aixun.png', 'mechanic-dark.png': 'mechanic.png'}
names = []
for f in sorted(os.listdir(ROOT)):
    if not f.endswith('.png'): continue
    if f in ALIAS: Image.open(os.path.join(ROOT, ALIAS[f])).save(os.path.join(OUT, f), optimize=True); names.append(f); continue
    im = Image.open(os.path.join(ROOT, f)).convert('RGBA'); w, h = im.size; px = im.load()
    edge = [px[x, 0][3] for x in range(w)] + [px[x, h - 1][3] for x in range(w)] + [px[0, y][3] for y in range(h)] + [px[w - 1, y][3] for y in range(h)]
    op = [px[x, y] for y in range(0, h, 3) for x in range(0, w, 3) if px[x, y][3] > 200]
    sat = sum(colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1] for r, g, b, a in op) / max(1, len(op))
    if sum(1 for a in edge if a > 200) / len(edge) > 0.4 and sat > 0.3:  # renkli rozet: zemini dolu, olduğu gibi
        im.save(os.path.join(OUT, f), optimize=True); names.append(f); continue
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0: continue
            H, L, S = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if S < 0.22 or L < 0.08:  # renksiz (siyah/gri yazı)
                if L < 0.6: L = 0.96 - L * 0.5
            elif L < 0.42: L = 0.42 + (0.42 - L) * 0.35  # çok koyu renk biraz açılır
            r2, g2, b2 = colorsys.hls_to_rgb(H, L, S)
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    im.save(os.path.join(OUT, f), optimize=True); names.append(f)
print(len(names), 'logo →', OUT)
