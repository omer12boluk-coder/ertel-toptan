# Her seçim kombinasyonu için TAM sahne (GPT maskeye uymuyor; parça yapıştırma ürünleri yarım kesiyordu).
# Taban fotoğraf (sahne/taban.png) 1. görsel: aynı masa, ışık, kamera, yerleşim; sadece cihazlar değişir.
# Çıktı: out/kombin/<guc>-<havya>-<mikro>-<sicak>.png   (var olan atlanır)
import io, itertools, os, shutil, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import demo
from sahne import SLOTS, ref

OUT = 'out/kombin'; os.makedirs(OUT, exist_ok=True)
base = Image.open('out/sahne/taban.png').convert('RGB'); b = io.BytesIO(); base.save(b, 'PNG'); BASE = b.getvalue()
dflt = [s[2][0] for s in SLOTS]
key = lambda ids: '-'.join(map(str, ids))
# önceki adımın tam sahneleri de birer kombinasyon
shutil.copy('out/sahne/taban.png', f'{OUT}/{key(dflt)}.png')
for i, (k, _, ids, _, _) in enumerate(SLOTS):
    for pid in ids[1:]:
        src = f'out/sahne/{k}-{pid}.png'
        if os.path.exists(src) and k != 'sicak':  # sıcak hava denemesi mikroskobu silmişti → yeniden çiz
            c = dflt[:]; c[i] = pid; shutil.copy(src, f'{OUT}/{key(c)}.png')

P = ("Image 1 is a photo of a phone-repair workbench. Recreate THIS EXACT PHOTO — same desk, same grey mat with the same shape and position, "
     "same wall, same light, same camera angle, same phone logic board in its holder under the microscope — but with exactly these four devices, "
     "each standing in the same zone as the device it replaces: image 2 = DC power supply at the far left (0-20% of the width), "
     "image 3 = soldering station (20-42%), image 4 = stereo microscope (42-70%), image 5 = hot air rework station (70-100%, keep its hose "
     "neatly curved beside its own body, never crossing left of 70%). Reproduce every device EXACTLY as in its reference image (same model, colors, "
     "logos, screen, buttons), at realistic relative scale, standing on the mat with realistic contact shadows. Nothing overlapping, all four always "
     "present and fully inside the frame. No other new objects, no text.")

def run(ids):
    dst = f'{OUT}/{key(ids)}.png'
    if os.path.exists(dst): return
    demo.log('kombin', key(ids))
    files = [('image[]', ('taban.png', BASE, 'image/png'))] + [('image[]', (f'{p}.png', ref(p), 'image/png')) for p in ids]
    im = demo.api('images/edits', files=files, data={'prompt': P, 'size': '1536x1024', 'quality': 'high', 'n': '1'})
    if im: im.save(dst)

todo = [list(c) for c in itertools.product(*[s[2] for s in SLOTS])]
with ThreadPoolExecutor(4) as ex: list(ex.map(run, todo))
demo.log('kombin bitti', len(os.listdir(OUT)), 'sahne')
