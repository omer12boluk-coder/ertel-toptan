# secilen.png'de sol öndeki iSocket destesini TEK bir iSocket test cihazına çevirir (tam fotoğraf + maske, n=1).
import base64, io, json, os, sys, urllib.parse
import requests
from PIL import Image, ImageDraw
HERE = os.path.dirname(__file__); KEY = os.environ['OPENAI_API_KEY']; OUT = 'out/tester'; os.makedirs(OUT, exist_ok=True)
LOG = open('out/log.txt', 'a')
def log(*a): s = ' '.join(map(str, a)); print(s); LOG.write(s + '\n'); LOG.flush()
KAT = {p['id']: p for p in json.load(open(f'{HERE}/kat.json'))}
def png(im): b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
ref = Image.open(io.BytesIO(requests.get('https://resim.ertelmarket.com/platin/' + urllib.parse.quote(KAT[2498]['pi']), timeout=60, headers={'User-Agent': 'Mozilla/5.0'}).content)).convert('RGB')
foto = Image.open(f'{HERE}/secilen.png').convert('RGB')
m = Image.new('RGBA', foto.size, (0, 0, 0, 255)); ImageDraw.Draw(m).rectangle((22, 560, 275, 752), fill=(0, 0, 0, 0))
PROMPT = ("Image 1 is a photograph of a phone-repair workbench. Edit ONLY the transparent masked area at the left of the mat: replace the stack of devices there with ONE single "
          "Qianli iSocket iPhone motherboard tester lying flat on the mat, exactly like image 2 (same shape, colours and printed logo), at realistic size, with a soft contact shadow; "
          "the rest of the masked area is the same grey-green mat. Everything outside the mask stays exactly the same.")
r = requests.post('https://api.openai.com/v1/images/edits', headers={'Authorization': 'Bearer ' + KEY},
    data={'model': 'gpt-image-1.5', 'prompt': PROMPT, 'size': '1536x1024', 'quality': 'high', 'n': '1', 'input_fidelity': 'high'},
    files=[('image[]', ('foto.png', png(foto), 'image/png')), ('image[]', ('ref.png', png(ref), 'image/png')), ('mask', ('mask.png', png(m), 'image/png'))], timeout=600)
if not r.ok: log('tester HATA', r.status_code, r.text[:300]); sys.exit(0)
j = r.json(); log('tester kullanım:', json.dumps(j.get('usage', {})))
Image.open(io.BytesIO(base64.b64decode(j['data'][0]['b64_json']))).convert('RGB').save(f'{OUT}/tester-1.png'); log('tester bitti')
