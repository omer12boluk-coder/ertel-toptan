# Son geçiş: elle birleştirilmiş fotoğrafı (kompozit.png) tek parça, dikişsiz fotoğrafa çevirir + kalan eksikleri tamamlar.
import base64, io, json, os, sys, urllib.parse
import requests
from PIL import Image
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(__file__); KEY = os.environ['OPENAI_API_KEY']; OUT = 'out/uyum'; os.makedirs(OUT, exist_ok=True)
KAT = {p['id']: p for p in json.load(open(f'{HERE}/kat.json'))}
LOG = open('out/log.txt', 'a')
def log(*a): s = ' '.join(map(str, a)); print(s); LOG.write(s + '\n'); LOG.flush()
def pic(pid):
    f = KAT[pid]['pi']; url = 'https://resim.ertelmarket.com/platin/' + urllib.parse.quote(f)
    return Image.open(io.BytesIO(requests.get(url, timeout=60, headers={'User-Agent': 'Mozilla/5.0'}).content)).convert('RGB')
def sheet(ids):
    ims = [pic(i) for i in ids]; cols = 2 if len(ims) <= 4 else 3; rows = (len(ims) + cols - 1) // cols; cw = 1024 // cols
    c = Image.new('RGB', (cw * cols, cw * rows), 'white')
    for i, im in enumerate(ims): im.thumbnail((cw - 20, cw - 20)); c.paste(im, ((i % cols) * cw + (cw - im.width) // 2, (i // cols) * cw + (cw - im.height) // 2))
    return c
def png(im): b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()
refs = [('alet.png', sheet([1790, 2978, 2709, 3056, 402, 2464, 2303])), ('test.png', sheet([593, 844, 1319, 1714, 2068, 2498, 3062])), ('tel.png', sheet([492]))]
PROMPT = ("Image 1 is a photograph of a phone-repair workbench assembled from several shots. Output the SAME photograph as one seamless, natural, high-end photo: "
 "same camera, framing, layout and every product exactly as it is (keep all logos, screens and printed text of the devices identical: the silver AiXun P3208 power supply, the black JBC station showing 350°C, the AmScope microscope, the blue AiXun iHeater Pro, the Quick hot air station, the 2UUL board holder, the green and white ALPHA jars, the goot wick CP-20B spool, the Aiolos fan, the green screwdriver stand, the stencil pile). Fix only these: "
 "1) remove every hazy, blurred or washed-out patch and visible seam; lighting, colour and shadows must be continuous across the whole photo. "
 "2) remove the leftover grey box behind and left of the silver P3208 power supply (show wall and desk there). "
 "3) no cables may run to the board holder; remove stray cables on the mat in front of the JBC station. "
 "4) on the mat at the front right, lying neatly: the four tweezers, the Piergiacomi side cutter and the two 2UUL pen-shaped dremel grinders from image 2. "
 "5) on the mat to the left of the board holder: a neat stack of six Qianli iSocket testers and the Power Pro Max boot cable coiled next to it (image 3). "
 "6) the ALPHA solder wire spool (image 4) standing next to the ALPHA jars. "
 "Real contact shadows, nothing floating, no text overlays, no people.")
r = requests.post('https://api.openai.com/v1/images/edits', headers={'Authorization': 'Bearer ' + KEY},
    data={'model': 'gpt-image-1.5', 'prompt': PROMPT, 'size': '1536x1024', 'quality': 'high', 'n': os.environ.get('NUY', '2'), 'input_fidelity': 'high'},
    files=[('image[]', ('foto.png', open(f'{HERE}/kompozit.png', 'rb').read(), 'image/png'))] + [('image[]', (n, png(im), 'image/png')) for n, im in refs], timeout=600)
if not r.ok: log('uyum HATA', r.status_code, r.text[:300]); sys.exit(0)
j = r.json(); log('uyum kullanım:', json.dumps(j.get('usage', {})))
for i, d in enumerate(j['data']): Image.open(io.BytesIO(base64.b64decode(d['b64_json']))).convert('RGB').save(f'{OUT}/uyum-{i + 1}.png')
log('uyum bitti')
