# Tezgâh için ürün fotoğrafları (ücretsiz: sadece indirir, GPT yok) → out/foto/<id>-<n>.jpg
import json, os, io, urllib.parse, requests
from PIL import Image
IDS = [1996, 1916, 835, 2745, 2913, 3030, 3066, 2671, 2981, 2710, 3032, 2767, 2242, 3020, 3025, 1514]
P = {p['id']: p for p in json.load(open('src/products.json'))}
os.makedirs('out/foto', exist_ok=True)
for i in IDS:
    p = P.get(i)
    if not p: print('yok', i); continue
    fs = [p.get('pi')] + list(p.get('im') or [])
    for n, f in enumerate([f for f in fs if f][:4]):
        u = f if f.startswith('http') else 'https://resim.ertelmarket.com/platin/' + urllib.parse.quote(f)
        try:
            r = requests.get(u, timeout=60, headers={'User-Agent': 'Mozilla/5.0'})
            im = Image.open(io.BytesIO(r.content)).convert('RGB'); im.thumbnail((900, 900))
            im.save(f'out/foto/{i}-{n}.jpg', quality=86); print('ok', i, n, im.size)
        except Exception as e: print('hata', i, n, e)
