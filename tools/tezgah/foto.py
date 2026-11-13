# Tezgâh için ürün fotoğrafları (ücretsiz: sadece indirir, GPT yok) → out/foto/<id>-<n>.jpg
import json, os, io, urllib.parse, requests
from PIL import Image
IDS = [2035, 2455, 1953, 94, 1892, 1638]
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
