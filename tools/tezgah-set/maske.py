# Ham Gemini fotoğrafında (ham.jpg) sadece maskeli bölgeleri GPT'ye düzelttirir. Çıktı out/maske/maske-1.png
# (Claude sonucu ham fotoğrafa yalnız bu bölgelerden yapıştırır; geri kalan piksel piksel aynı kalır.)
import base64, io, json, os, sys
import requests, numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(__file__); KEY = os.environ['OPENAI_API_KEY']; OUT = 'out/maske'; os.makedirs(OUT, exist_ok=True)
LOG = open('out/log.txt', 'a')
def log(*a): s = ' '.join(map(str, a)); print(s); LOG.write(s + '\n'); LOG.flush()
def png(im): b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
ham = Image.open(f'{HERE}/ham.jpg').convert('RGB'); W, H = ham.size
foto = ham.resize((1536, 1024), Image.LANCZOS); sx, sy = 1536 / W, 1024 / H
POLY = {
 'tester': [(532,1230),(638,1138),(740,1136),(1090,1206),(1108,1336),(1030,1436),(765,1438),(544,1360)],
 'kalem':  [(2056,1084),(2241,1090),(2417,1184),(2417,1298),(2347,1253),(2299,1218),(2225,1183),(2151,1148),(2085,1122),(2056,1100)],
 'wick':   [(1756,1012),(1968,1012),(1968,1152),(1756,1152)],
 'yazi':   [(330,1128),(430,1128),(430,1170),(330,1170)],
}
m = Image.new('RGBA', (1536, 1024), (0, 0, 0, 255)); d = ImageDraw.Draw(m)
for p in POLY.values(): d.polygon([(x * sx, y * sy) for x, y in p], fill=(0, 0, 0, 0))
ref = Image.open(f'{HERE}/ref-wick.png').convert('RGB')
PROMPT = ("Image 1 is a photograph of a phone-repair workbench. Edit ONLY the transparent masked areas; keep everything else identical. "
 "Masked area at the front-left (the large silver test fixture): REMOVE the fixture completely and show the empty grey-green anti-static mat there, continuing its colour, texture, lighting and the mat's front edge naturally; nothing else is placed there. "
 "Masked area at the right (the dark green pen lying above the light green pen): REMOVE that dark green pen completely and show empty mat; keep the light green pen next to it unchanged. "
 "Masked area with the small round spool in the middle-right: replace it with ONE goot wick desoldering spool exactly like image 2 - blue plastic spool, round yellow label with the 'goot wick' logo and text 'CP-20B', copper braid wound on it - lying flat on the mat at the same size, with a soft contact shadow. "
 "Masked small area on the steel stencil: remove the orange printed text, leaving plain brushed steel. Match the photo's light and perspective exactly.")
r = requests.post('https://api.openai.com/v1/images/edits', headers={'Authorization': 'Bearer ' + KEY},
    data={'model': 'gpt-image-1.5', 'prompt': PROMPT, 'size': '1536x1024', 'quality': 'high', 'n': '1', 'input_fidelity': 'high'},
    files=[('image[]', ('foto.png', png(foto), 'image/png')), ('image[]', ('ref.png', png(ref), 'image/png')), ('mask', ('mask.png', png(m), 'image/png'))], timeout=600)
if not r.ok: log('maske HATA', r.status_code, r.text[:300]); sys.exit(0)
j = r.json(); log('maske kullanım:', json.dumps(j.get('usage', {})))
Image.open(io.BytesIO(base64.b64decode(j['data'][0]['b64_json']))).convert('RGB').save(f'{OUT}/maske-1.png'); log('maske bitti')
