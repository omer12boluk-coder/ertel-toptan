# Temel fotoğrafı bölge bölge düzeltir: her iş için pencere kesilir, maskelenen dikdörtgenler gerçek ürün görseliyle yeniden
# çizdirilir (GPT images/edits + mask), sonuç yumuşak kenarla tabana geri yapıştırılır. Adaylar out/duz/<ad>-<n>.png,
# her işten sonra 1. aday tabana işlenir (sıradaki iş onun üstünde çalışır). Sonuç out/duz/son.webp.
import base64, io, json, os, sys, time, urllib.parse
import requests
from PIL import Image, ImageDraw, ImageFilter
KEY = os.environ['OPENAI_API_KEY']; HERE = os.path.dirname(__file__)
MODELS = os.environ.get('IMG_MODELS', 'gpt-image-1.5,gpt-image-1').split(','); N = os.environ.get('NDUZ', '1')
SADECE = set(x for x in os.environ.get('SADECE', '').split(',') if x)
OUT = 'out/duz'; os.makedirs(OUT, exist_ok=True)
LOG = open('out/log.txt', 'a')
def log(*a):
    s = ' '.join(str(x) for x in a); print(s); LOG.write(s + '\n'); LOG.flush()
KAT = {p['id']: p for p in json.load(open(f'{HERE}/kat.json'))}
def pic(pid):
    f = KAT[pid]['pi']
    url = f if f.startswith('http') else ('https://resim.ertelmarket.com/' + f[3:] if f.startswith('r2:') else 'https://resim.ertelmarket.com/platin/' + urllib.parse.quote(f))
    r = requests.get(url, timeout=60, headers={'User-Agent': 'Mozilla/5.0'}); r.raise_for_status()
    return Image.open(io.BytesIO(r.content)).convert('RGB')
def sheet(ims):
    if len(ims) == 1: c = ims[0]; c.thumbnail((1024, 1024)); return c
    cols = 2 if len(ims) <= 4 else 3; rows = (len(ims) + cols - 1) // cols; cw = 1024 // cols
    c = Image.new('RGB', (cw * cols, cw * rows), 'white')
    for i, im in enumerate(ims):
        im = im.copy(); im.thumbnail((cw - 20, cw - 20)); c.paste(im, ((i % cols) * cw + (cw - im.width) // 2, (i // cols) * cw + (cw - im.height) // 2))
    return c
def png(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
def api(data, files):
    for model in MODELS:
        d = dict(data, model=model)
        for t in range(3):
            r = requests.post('https://api.openai.com/v1/images/edits', headers={'Authorization': 'Bearer ' + KEY}, data=d, files=files, timeout=600)
            if r.ok:
                j = r.json(); log(f'  model={model} kullanım:', json.dumps(j.get('usage', {}))); return j['data']
            log(f'  HATA {r.status_code} ({model}): {r.text[:250]}')
            try: prm = r.json().get('error', {}).get('param') or ''
            except Exception: prm = ''
            if r.status_code == 400 and prm in d and prm not in ('model', 'prompt', 'size', 'image', 'mask'): d.pop(prm); continue
            if r.status_code in (400, 404) and prm == 'model': break
            if r.status_code in (400, 401, 403, 429): return []
            time.sleep(8)
    return []
base = Image.open(f'{HERE}/taban.webp').convert('RGB')
J = json.load(open(f'{HERE}/duzelt.json'))['isler']
for job in J:
    if SADECE and job['ad'] not in SADECE: continue
    x0, y0, x1, y1 = job['crop']; cw, ch = x1 - x0, y1 - y0
    size = (1536, 1024) if cw / ch > 1.2 else (1024, 1024)
    crop = base.crop((x0, y0, x1, y1)).resize(size, Image.LANCZOS)
    sx, sy = size[0] / cw, size[1] / ch
    m = Image.new('RGBA', size, (0, 0, 0, 255)); d = ImageDraw.Draw(m)
    for a, b, c, e in job['mask']: d.rectangle(((a - x0) * sx, (b - y0) * sy, (c - x0) * sx, (e - y0) * sy), fill=(0, 0, 0, 0))
    ref = sheet([pic(i) for i in job['ids']]); ref.save(f"{OUT}/{job['ad']}-ref.jpg", quality=85)
    crop.save(f"{OUT}/{job['ad']}-giris.jpg", quality=88)
    prompt = ("Image 1 is a crop of a real photograph of a phone-repair workbench. Edit ONLY the transparent masked area of image 1; everything else must stay pixel-identical. "
              + job['ne'] + " Image 2 is the real product reference: reproduce shapes, colours, logos and printed text faithfully. "
              "Match the photo's perspective, scale, lighting from the upper left, soft contact shadows, colour grading and depth of field so it looks like part of the same photograph. No new objects besides those described.")
    log('iş:', job['ad'])
    res = api({'prompt': prompt, 'size': f'{size[0]}x{size[1]}', 'quality': 'high', 'n': N, 'input_fidelity': 'high'},
              [('image[]', ('foto.png', png(crop), 'image/png')), ('image[]', ('urun.png', png(ref), 'image/png')), ('mask', ('mask.png', png(m), 'image/png'))])
    # tabana yapıştırma maskesi (yumuşak kenar)
    pm = Image.new('L', (cw, ch), 0); pd = ImageDraw.Draw(pm)
    for a, b, c, e in job['mask']: pd.rectangle((a - x0 - 4, b - y0 - 4, c - x0 + 4, e - y0 + 4), fill=255)
    pm = pm.filter(ImageFilter.GaussianBlur(5))
    for i, dd in enumerate(res):
        im = Image.open(io.BytesIO(base64.b64decode(dd['b64_json']))).convert('RGB')
        im.save(f"{OUT}/{job['ad']}-{i + 1}.png")
        if i == 0:
            base.paste(im.resize((cw, ch), Image.LANCZOS), (x0, y0), pm)
    base.save(f'{OUT}/son.webp', quality=92); base.save(f'{OUT}/son.png')
log('düzeltme bitti')
