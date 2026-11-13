# Gerçekçi tezgâh: GPT tek bir fotoğraf-gerçekçi sahne çizer (4 ürün yan yana, her biri kendi çeyreğinde).
# Sonra her alternatif ürün için SADECE o çeyrek yeniden çizilir (maske). Arayüz o çeyreği üstüne koyar →
# ışık, gölge, masa hep aynı; ürünler masaya gerçekten oturur, birbirinin üstüne binmez.
# Girdi: out/kes/<id>.png (önceki adım, saydam ürünler). Çıktı: out/sahne/taban.png, out/sahne/<slot>-<id>.png
import io, json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import demo

OUT = 'out/sahne'; os.makedirs(OUT, exist_ok=True)
W, H = 1536, 1024
SLOTS = [  # soldan sağa: (anahtar, ne, ürünler, şerit başı, şerit sonu — genişlik oranı)
    ('guc',   'DC bench power supply',                  [1996, 1916], 0.00, 0.20),
    ('havya', 'soldering station with its iron in the holder', [835, 2745], 0.20, 0.42),
    ('mikro', 'stereo microscope on its stand',          [2913, 3030], 0.42, 0.70),
    ('sicak', 'hot air rework station with its handle in the holder', [3066, 2671], 0.70, 1.00),
]
YENI = os.environ.get('YENI', '')

def ref(pid):
    """Kesilmiş ürünü beyaz kare zemine koy (GPT'ye referans)."""
    p = Image.open(f'out/kes/{pid}.png').convert('RGBA'); p.thumbnail((900, 900))
    c = Image.new('RGB', (1024, 1024), 'white'); c.paste(p, ((1024 - p.width) // 2, (1024 - p.height) // 2), p)
    b = io.BytesIO(); c.save(b, 'PNG'); return b.getvalue()

SCENE = ("Photorealistic professional product photograph of a clean, premium phone-repair workbench. "
         "A light grey anti-static ESD mat on a pale oak desk, plain warm off-white wall behind, soft natural daylight from the upper left, "
         "realistic soft contact shadows, camera in front at seated eye level slightly above the desk, 35mm lens, everything in sharp focus. "
         "It is arranged the way a real phone technician actually works: the microscope stands in the middle-right where the technician sits, "
         "with a phone logic board in a small holder on the mat under its lens; the soldering station is to its left within arm's reach; "
         "the DC power supply is at the far left; the hot air station is on the right. Each device stays strictly inside its own vertical zone "
         "of the image width — power supply 0-20%, soldering station 20-42%, microscope 42-70%, hot air 70-100% — centered in it, "
         "with clear empty desk between neighbours (nothing overlapping, no cable crossing into another zone, every device fully inside the frame "
         "with margin above it). Devices: {items}. Reproduce each device EXACTLY as in its reference image (same model, colors, logos, screen, buttons). "
         "All four at realistic relative real-world scale, all standing on the same desk surface. No other objects, no text, no people.")
EDIT = ("Keep the whole photo exactly the same. Only inside the masked area (the vertical zone from {a}% to {b}% of the image width) replace the {what} with the device "
        "shown in the second reference image, reproduced EXACTLY (same model, colors, logos, screen, buttons), centered in that quarter, "
        "standing on the same mat with the same lighting, perspective, scale and realistic contact shadow. Nothing may cross outside that zone.")

taban = f'{OUT}/taban.png'
if not os.path.exists(taban) or 'taban' in YENI:
    items = '; '.join(f'image {i+1} = the {w}' for i, (_, w, _, _, _) in enumerate(SLOTS))
    demo.log('taban sahne')
    im = demo.api('images/edits', files=[('image[]', (f'{s[2][0]}.png', ref(s[2][0]), 'image/png')) for s in SLOTS],
                  data={'prompt': SCENE.format(items=items), 'size': f'{W}x{H}', 'quality': 'high', 'n': '1'})
    if not im: sys.exit('taban çizilemedi')
    im.save(taban)
base = Image.open(taban).convert('RGB')
bb = io.BytesIO(); base.save(bb, 'PNG'); base_png = bb.getvalue()

for k, what, ids, x0, x1 in SLOTS:
    for pid in ids[1:]:
        dst = f'{OUT}/{k}-{pid}.png'
        if os.path.exists(dst) and str(pid) not in YENI: continue
        demo.log(f'değiş {k} → {pid}')
        m = Image.new('RGBA', (W, H), (0, 0, 0, 255))
        m.paste((0, 0, 0, 0), (round(x0 * W), 0, round(x1 * W), H))   # saydam = yeniden çizilecek yer
        mb = io.BytesIO(); m.save(mb, 'PNG')
        im = demo.api('images/edits', files=[('image[]', ('taban.png', base_png, 'image/png')), ('image[]', (f'{pid}.png', ref(pid), 'image/png')),
                                             ('mask', ('mask.png', mb.getvalue(), 'image/png'))],
                      data={'prompt': EDIT.format(a=round(x0 * 100), b=round(x1 * 100), what=what), 'size': f'{W}x{H}', 'quality': 'high', 'n': '1'})
        if im: im.save(dst)
demo.log('sahne bitti')
