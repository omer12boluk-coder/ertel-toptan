# Tezgâh arayüzü için: her ürünü GPT ile aynı açı + aynı ışıkta, saydam zeminde yeniden çizdirir (masaya koymak için),
# bir de geniş boş masa çizer. Çıktı: out/kes/<id>.png (kırpılmış, saydam), out/masa-genis.webp
# Daha önce üretilmiş ürün atlanır (para boşa gitmesin). Yeniden üretmek için YENI="835,2745".
import io, json, os, sys, urllib.parse
import numpy as np, requests
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'banner'))
import demo  # api(), log()  (demo.py import edilince üretim yapmaz)
from cut import cutout

OUT = 'out/kes'; os.makedirs(OUT, exist_ok=True)
YENI = set(x for x in os.environ.get('YENI', '').split(',') if x)
KES = ("Recreate the product from the input image EXACTLY: same model, shape, proportions, colors, logos, screen, buttons, cables and accessories that are part of the product. "
       "Show ONLY the product, isolated on a fully transparent background (no floor, no shadow, no reflection, no text, no packaging, no hands). "
       "Viewpoint: front three-quarter view from slightly above (about 20 degrees), as the product would stand on a workbench in front of the viewer. "
       "Soft even studio light from the upper left. The whole product fits in the frame with about 6% empty margin on every side.")
MASA = ("Photorealistic wide empty electronics repair workbench, front view, camera at seated eye level slightly above the desk. "
        "A long light grey anti-static ESD mat covers the desk; the desk surface fills the lower 50% of the frame and runs edge to edge; "
        "behind it a plain warm off-white wall with soft light falloff. The desk is COMPLETELY EMPTY: no tools, no devices, no objects. "
        "Soft daylight from the upper left. Clean, minimal, premium Apple-style backdrop. No text, no logos, no people.")

def trim(im):
    bb = im.split()[3].point(lambda v: 255 if v > 10 else 0).getbbox()
    return im.crop(bb) if bb else im

if not os.path.exists('out/masa-genis.webp') or 'masa' in YENI:
    demo.log('masa-genis')
    m = demo.api('images/generations', json={'prompt': MASA, 'size': '1536x1024', 'quality': 'high', 'n': 1})
    if m: m.save('out/masa-genis.webp', quality=90)

for s in json.load(open(os.path.join(os.path.dirname(__file__), 'tezgah.json'))):
    for u in s['urunler']:
        dst = f"{OUT}/{u['id']}.png"
        if os.path.exists(dst) and str(u['id']) not in YENI: continue
        demo.log(f"kes {u['id']} {u['ad'][:50]}")
        r = requests.get('https://resim.ertelmarket.com/platin/' + urllib.parse.quote(u['pi']), timeout=60, headers={'User-Agent': 'Mozilla/5.0'})
        if not r.ok: demo.log('  resim alınamadı', r.status_code); continue
        b = io.BytesIO(); Image.open(io.BytesIO(r.content)).convert('RGB').save(b, 'PNG')
        res = demo.api('images/edits', files={'image[]': (f"{u['id']}.png", b.getvalue(), 'image/png')},
                       data={'prompt': KES, 'size': '1024x1024', 'quality': 'medium', 'background': 'transparent', 'output_format': 'png', 'n': '1'}, raw=True)
        if res is None: continue
        im = res.convert('RGBA')
        a = np.asarray(im.split()[3])
        if a.min() > 250:  # saydam gelmedi → beyaz zemini biz keselim
            demo.log('  saydam gelmedi, beyaz zemin kesiliyor'); im.convert('RGB').save('/tmp/k.png'); cutout('/tmp/k.png', dst, hole=0.002)
        else:
            trim(im).save(dst)
        demo.log('  boyut', Image.open(dst).size)
demo.log('kes bitti')
