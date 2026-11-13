# Tezgâh demosu: her ürün için 2 görsel (GitHub Actions'ta çalışır, OPENAI_API_KEY gizli ayarıyla).
#  A = GPT sahneyi baştan çizer (ürün fotoğrafı referans, input_fidelity=high).
#  B = GPT sadece BOŞ masayı çizer; gerçek ürün fotoğrafı kesilip kodla masaya oturtulur (kenar payı + gölge garantili).
# Çıktı: out/<id>-a.webp, out/<id>-b.webp, out/masa-*.webp, out/log.txt  → tezgah-demo-out dalı.
import base64, io, json, os, sys, time, urllib.parse
import numpy as np, requests
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'banner'))
from cut import cutout

KEY = os.environ['OPENAI_API_KEY']
MODELS = os.environ.get('IMG_MODELS', 'gpt-image-2,gpt-image-1.5,chatgpt-image-latest').split(',')
MODEL = MODELS[0]
QUAL = os.environ.get('IMG_QUALITY', 'medium')
OUT = 'out'; os.makedirs(OUT, exist_ok=True)
W, H = 1536, 1024
LOG = open(f'{OUT}/log.txt', 'a')
def log(*a):
    s = ' '.join(str(x) for x in a); print(s); LOG.write(s + '\n'); LOG.flush()

DESKS = [
    "Photorealistic empty phone-repair workbench, seen from the front and slightly above. A light grey anti-static ESD rubber mat covers the desk; the desk surface fills the lower 55% of the frame, behind it a plain softly lit off-white wall. The whole desk is EMPTY: no tools, no objects, no devices anywhere. Soft diffuse daylight from the upper left, gentle natural falloff. Clean, minimal, premium Apple-style product photography backdrop. No text, no logos, no people.",
    "Photorealistic empty electronics repair workbench, seen from the front and slightly above. A dark graphite anti-static ESD mat lies on a light desk; the desk surface fills the lower 55% of the frame, behind it a plain light grey wall. The whole desk is EMPTY: no tools, no objects, no devices anywhere. Soft diffuse studio light from above, subtle vignette. Clean, minimal, premium product photography backdrop. No text, no logos, no people.",
]
SCENE = ("Use the product in the input image EXACTLY as it is: same shape, proportions, colors, logos, screen text and buttons; do not redesign it. "
         "Place it standing naturally on a clean phone-repair technician's workbench covered with a light grey anti-static ESD mat, plain off-white wall behind. "
         "The ENTIRE product must be fully visible inside the frame with generous empty margin on every side (at least 12% left and right, 10% top and bottom); nothing may be cropped or touch the image edge. "
         "Position the product in the right half of the frame; keep the left 45% of the frame as calm empty desk for text. "
         "Product sits flat on the desk with a realistic soft contact shadow. Soft daylight studio lighting, photorealistic premium product photography, camera slightly above. "
         "No added text, no watermark, no extra objects in the foreground.")

def api(path, **kw):
    """Model yoksa sıradakine geçer; desteklenmeyen parametreyi (input_fidelity, quality) atıp tekrar dener."""
    global MODEL
    for t in range(6):
        body = kw.get('json') or kw.get('data'); body['model'] = MODEL
        r = requests.post('https://api.openai.com/v1/' + path, headers={'Authorization': 'Bearer ' + KEY}, timeout=300, **kw)
        if r.ok:
            j = r.json(); log(f'  model={MODEL} kullanım:', json.dumps(j.get('usage', {})))
            return Image.open(io.BytesIO(base64.b64decode(j['data'][0]['b64_json']))).convert('RGB')
        log(f'  HATA {r.status_code} ({MODEL}): {r.text[:300]}')
        try: err = r.json().get('error', {})
        except Exception: err = {}
        prm, msg = err.get('param') or '', (err.get('message') or '').lower()
        if r.status_code == 400 and (prm == 'model' or 'does not exist' in msg) and MODEL in MODELS and MODELS.index(MODEL) + 1 < len(MODELS):
            MODEL = MODELS[MODELS.index(MODEL) + 1]; continue
        if r.status_code == 400 and prm in body and prm not in ('model', 'prompt', 'size'):
            body.pop(prm); continue
        if r.status_code in (400, 401, 403): break
        time.sleep(8)
    return None

def save(im, name):
    im.save(f'{OUT}/{name}.webp', quality=88)
    # banner oranı (1.818) ortadan kırpılmış kopya
    h = round(W / 1.818); y = (H - h) // 2
    im.crop((0, y, W, y + h)).save(f'{OUT}/{name}-bn.webp', quality=86)

def place(desk, cut):
    """Kesilmiş ürünü masaya oturt: sağ yarı, tabanı masada, her yanda pay."""
    bg = desk.copy().convert('RGBA')
    p = cut
    s = min(0.66 * H / p.height, 0.44 * W / p.width)
    p = p.resize((max(1, round(p.width * s)), max(1, round(p.height * s))), Image.LANCZOS)
    cx, base = int(0.68 * W), int(0.86 * H)
    x, y = cx - p.width // 2, base - p.height
    x = max(int(0.06 * W), min(x, int(0.94 * W) - p.width))  # kenara asla değmez
    A = np.asarray(p.split()[3]).astype(np.float32) / 255
    sil = Image.fromarray((A * 255).astype(np.uint8))
    # 1) ortam gölgesi: silüetin kendisi, biraz aşağı kaymış, çok bulanık (ürünün altı kararır)
    sh = Image.new('L', (W, H), 0); sh.paste(sil, (x + 6, y + 16))
    sh = sh.filter(ImageFilter.GaussianBlur(26)).point(lambda v: int(v * 0.24))
    # 2) temas gölgesi: her sütunda ürünün EN ALT noktası (gerçek taban çizgisi; kablo da masaya değer)
    ct = Image.new('L', (W, H), 0); d = ImageDraw.Draw(ct)
    m = A > 0.5
    for cxx in range(0, p.width, 2):
        col = np.where(m[:, cxx])[0]
        if len(col): yy = y + col.max(); d.ellipse((x + cxx - 3, yy - 3, x + cxx + 3, yy + 5), fill=230)
    ct = ct.filter(ImageFilter.GaussianBlur(5)).point(lambda v: int(v * 0.45))
    dark = Image.new('RGBA', (W, H), (20, 20, 24, 255))
    for m in (sh, ct): bg = Image.composite(dark, bg, m)
    bg.alpha_composite(p, (x, y))
    log(f'  yerleşim x={x} y={y} w={p.width} h={p.height} (sol pay {x/W:.0%}, sağ pay {(W-x-p.width)/W:.0%})')
    return bg.convert('RGB')

urunler = json.load(open(os.path.join(os.path.dirname(__file__), 'urunler.json')))
desks = []
for i, pr in enumerate(DESKS):
    log(f'masa {i+1}')
    d = api('images/generations', json={'prompt': pr, 'size': f'{W}x{H}', 'quality': QUAL, 'n': 1})
    if d: d.save(f'{OUT}/masa-{i+1}.webp', quality=88); desks.append(d)

for n, u in enumerate(urunler):
    log(f"ürün {u['id']} {u['ad']}")
    url = 'https://resim.ertelmarket.com/platin/' + urllib.parse.quote(u['pi'])
    r = requests.get(url, timeout=60, headers={'User-Agent': 'Mozilla/5.0'})
    if not r.ok: log('  resim alınamadı', r.status_code, url); continue
    src = Image.open(io.BytesIO(r.content)).convert('RGB')
    src.save(f"/tmp/{u['id']}.png"); src.save(f"{OUT}/{u['id']}-asil.webp", quality=85)
    # A: GPT tam sahne
    buf = io.BytesIO(); src.save(buf, 'PNG'); buf.seek(0)
    a = api('images/edits', files={'image[]': (f"{u['id']}.png", buf, 'image/png')},
            data={'prompt': SCENE, 'size': f'{W}x{H}', 'quality': QUAL, 'input_fidelity': 'high', 'n': '1'})
    if a: save(a, f"{u['id']}-a")
    # B: boş masa + gerçek ürün
    if desks:
        cutout(f"/tmp/{u['id']}.png", f"/tmp/{u['id']}-cut.png", hole=0.002)
        b = place(desks[n % len(desks)], Image.open(f"/tmp/{u['id']}-cut.png").convert('RGBA'))
        save(b, f"{u['id']}-b")
log('bitti')
