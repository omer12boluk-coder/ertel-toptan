# 3B sahneyi GERÇEKÇİ yapar: yerleşim bizim 3B çizimimizden gelir, görünüş GPT'den.
#  - Arka plan: boş tezgâh çizimi (poz/bos.png) → fotoğraf gerçekliğinde, her şey aynı yerde.
#  - Her cihaz: kendi yuvasının poz çizimi (poz/k-<yuva>.png, mor zemin) + ürünün gerçek görseli →
#    aynı açı/boy/konumda gerçekçi ürün, mor zeminde → anahtarlanıp sahneye geri konur (arayüzde katman).
# Çıktı: out/gercek/bos.png, out/gercek/<yuva>-<id>.png
import io, json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import demo
from kes import key

D = os.path.join(os.path.dirname(__file__), 'poz')
OUT = 'out/gercek'; os.makedirs(OUT, exist_ok=True)
YENI = os.environ.get('YENI', '')
SEC = json.loads(os.environ.get('SEC', '{"guc":[1996],"havya":[835],"mikro":[2913],"sicak":[3066]}'))
NE = {'guc': 'DC bench power supply (with its red and black test leads)', 'havya': 'soldering station with its iron standing in the holder',
      'mikro': 'stereo microscope on its boom stand with LED ring light', 'sicak': 'hot air rework station with its handle in the side holder'}

def png(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()

def ref(pid):
    p = Image.open(f'out/kes/{pid}.png').convert('RGBA'); p.thumbnail((900, 900))
    c = Image.new('RGB', (1024, 1024), 'white'); c.paste(p, ((1024 - p.width) // 2, (1024 - p.height) // 2), p); return png(c)

BOS = ("Turn this simple 3D mock-up into a high-end photorealistic photograph of a real phone-repair workbench. Keep EVERY element exactly where it is, "
       "same camera angle and framing: the wooden desk, the dark grey metal shelf riser at the back, the pegboard on the wall with the pliers, tweezers and "
       "screwdrivers hanging in the same places, the teal silicone repair mat with grid and screw compartments, the tweezers stand, the flux/solder-paste syringes "
       "and the screwdriver stand. Realistic materials (oak wood, powder-coated metal, silicone, brushed steel), soft natural daylight from the upper left, "
       "realistic soft shadows, shallow but full-frame sharpness. Do not add any devices or new objects. No text, no people.")
CIHAZ = ("Image 1 is a simple 3D mock-up of a {ne} on a flat magenta background: it fixes the exact position, size, viewing angle, perspective and orientation. "
         "Image 2 is the real product. Replace the mock-up with a photorealistic rendering of the real product from image 2, reproduced EXACTLY (same model, "
         "shape, colors, logos, screen, buttons), occupying exactly the same place, outline, size and perspective as the mock-up in image 1, lit softly from the upper left. "
         "Keep the background flat solid pure magenta (#FF00FF): no floor, no shadow, no reflection, no other objects, no text.")

if not os.path.exists(f'{OUT}/bos.png') or 'bos' in YENI:
    demo.log('gerçek: boş tezgâh')
    im = demo.api('images/edits', files=[('image[]', ('bos.png', open(f'{D}/bos.png', 'rb').read(), 'image/png'))],
                  data={'prompt': BOS, 'size': '1536x1024', 'quality': 'high', 'n': '1'})
    if im: im.save(f'{OUT}/bos.png')

for slot, ids in SEC.items():
    for pid in ids:
        dst = f'{OUT}/{slot}-{pid}.png'
        if os.path.exists(dst) and str(pid) not in YENI: continue
        demo.log(f'gerçek: {slot} {pid}')
        res = demo.api('images/edits', files=[('image[]', (f'k-{slot}.png', open(f'{D}/k-{slot}.png', 'rb').read(), 'image/png')),
                                             ('image[]', (f'{pid}.png', ref(pid), 'image/png'))],
                       data={'prompt': CIHAZ.format(ne=NE[slot]), 'size': '1024x1024', 'quality': 'high', 'n': '1'})
        if res: res.convert('RGB').save(f'{OUT}/{slot}-{pid}-ham.png'); key(res.convert('RGB'), trimit=False).save(dst)
demo.log('gerçek bitti')
