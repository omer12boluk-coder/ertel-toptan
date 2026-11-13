# Hazır tezgâh seti: GPT sahneyi ürünlerle BİRLİKTE tek fotoğraf olarak çizer (kesip yapıştırma yok).
# Her ürün grubunun sitedeki gerçek görseli referans verilir (en çok 16). Çıktı out/ → 'tezgah-set-out' dalı.
# Ortam: OPENAI_API_KEY, N (kaç görsel, varsayılan 2), QUAL (high), ACI (on).
import base64, io, json, os, sys, time, urllib.parse
import requests
from PIL import Image, ImageDraw

KEY = os.environ['OPENAI_API_KEY']
MODELS = os.environ.get('IMG_MODELS', 'gpt-image-2,gpt-image-1.5,gpt-image-1').split(',')
N = os.environ.get('N', '2'); QUAL = os.environ.get('QUAL', 'high')
HERE = os.path.dirname(__file__)
OUT = 'out'; os.makedirs(f'{OUT}/ref', exist_ok=True)
LOG = open(f'{OUT}/log.txt', 'a')
def log(*a):
    s = ' '.join(str(x) for x in a); print(s); LOG.write(s + '\n'); LOG.flush()

SET = json.load(open(f'{HERE}/set.json'))['urunler']
KAT = {p['id']: p for p in json.load(open(sys.argv[1]))} if len(sys.argv) > 1 else {}

def pic(pid):
    p = KAT.get(pid) or {}
    f = p.get('pi') or ''
    if f.startswith('r2:'): url = 'https://resim.ertelmarket.com/' + f[3:]
    elif f.startswith('http'): url = f
    else: url = 'https://resim.ertelmarket.com/platin/' + urllib.parse.quote(f)
    r = requests.get(url, timeout=60, headers={'User-Agent': 'Mozilla/5.0'})
    if not r.ok: log('  resim alınamadı', pid, r.status_code, url); return None
    return Image.open(io.BytesIO(r.content)).convert('RGB')

def sheet(ims):
    """Birden çok ürün görselini beyaz zeminde yan yana tek referans yapar."""
    ims = [i for i in ims if i]
    if len(ims) == 1: c = ims[0]; c.thumbnail((1024, 1024)); return c
    cols = 2 if len(ims) in (2, 4) else 3; rows = (len(ims) + cols - 1) // cols
    cw = 1024 // cols; ch = cw
    c = Image.new('RGB', (cw * cols, ch * rows), 'white')
    for i, im in enumerate(ims):
        im = im.copy(); im.thumbnail((cw - 24, ch - 24))
        c.paste(im, ((i % cols) * cw + (cw - im.width) // 2, (i // cols) * ch + (ch - im.height) // 2))
    return c

refs, lines = [], []
for i, u in enumerate(SET, 1):
    im = sheet([pic(x) for x in u['ids']])
    im.save(f"{OUT}/ref/{i:02d}-{u['k']}.jpg", quality=85)
    b = io.BytesIO(); im.save(b, 'PNG'); refs.append((f"{u['k']}.png", b.getvalue()))
    lines.append(f"Image {i}: {u['ne']}.")

PROMPT = (
    "Create ONE photorealistic photograph of a real, professional mobile-phone repair technician's workbench, fully set up and ready for work, "
    "shot with a full-frame camera from the technician's seat: front view, camera slightly above desk height looking a little down, the whole bench in frame. "
    "The bench: a solid light oak desk covered by a large grey-green anti-static ESD silicone mat; behind it a matte off-white wall. "
    "Every product below must be PHYSICALLY ON this desk, at real-world scale relative to each other, resting with real contact shadows, "
    "correct perspective, the same light, reflections and depth of field as the rest of the photo, like one real photograph taken in a shop. "
    "Nothing floats, nothing is cut out or pasted, nothing is cropped by the frame edges; leave a small margin around the whole bench. "
    "Reproduce each product faithfully from its reference image: same model, shape, colours, logos, screens and buttons. "
    "Cables are real and connected naturally. Arrangement is tidy, realistic and functional, as a real technician uses it:\n"
    + "\n".join(lines) +
    "\nDo NOT add any other devices or tools that are not listed. No people, no hands, no text overlays, no watermark. "
    "Soft natural daylight from the upper left plus the microscope ring light, premium commercial photography, sharp details."
)
open(f'{OUT}/prompt.txt', 'w').write(PROMPT)
log('referans sayısı:', len(refs))

def api(data, files):
    model = MODELS[0]
    for t in range(6):
        data['model'] = model
        r = requests.post('https://api.openai.com/v1/images/edits', headers={'Authorization': 'Bearer ' + KEY},
                          data=data, files=[('image[]', (n, b, 'image/png')) for n, b in files], timeout=600)
        if r.ok:
            j = r.json(); log(f'model={model} kullanım:', json.dumps(j.get('usage', {}))); return j['data']
        log(f'HATA {r.status_code} ({model}): {r.text[:300]}')
        try: err = r.json().get('error', {})
        except Exception: err = {}
        prm, msg = err.get('param') or '', (err.get('message') or '').lower()
        if r.status_code in (400, 404) and (prm == 'model' or 'model' in msg and ('not' in msg or 'exist' in msg)) and MODELS.index(model) + 1 < len(MODELS):
            model = MODELS[MODELS.index(model) + 1]; continue
        if r.status_code == 400 and prm in data and prm not in ('model', 'prompt', 'size'):
            data.pop(prm); continue
        if r.status_code in (400, 401, 403, 429): break
        time.sleep(10)
    return []

stamp = time.strftime('%H%M')
res = api({'prompt': PROMPT, 'size': '1536x1024', 'quality': QUAL, 'n': N, 'input_fidelity': 'high'}, refs)
for i, d in enumerate(res):
    im = Image.open(io.BytesIO(base64.b64decode(d['b64_json']))).convert('RGB')
    im.save(f'{OUT}/on-{stamp}-{i + 1}.png'); im.save(f'{OUT}/on-{stamp}-{i + 1}.webp', quality=90)
log('bitti:', len(res), 'görsel')
