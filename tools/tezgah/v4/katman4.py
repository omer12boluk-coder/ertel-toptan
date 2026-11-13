# Katmanlar: taban, ön dekor, her ürün için gölge + cisim, boş yuva izleri. 2x çizilir, kırpılır, webp.
import json, os, sys
import numpy as np
from PIL import Image
import sahne4 as SC
from ras import run
OUT = '/home/claude/tezgah-ui5/img'; os.makedirs(OUT, exist_ok=True); os.makedirs('lay', exist_ok=True)
SCALE = 2
L = {}
S = SC.build(eksik=SC.SLOTS, ghosts=False); L['taban'] = S.render(only={'base'})
L['on'] = SC.build(ghosts=False).render(only={'decor'}, base=False, vig=False)
anchors = {}
for slot in SC.SLOTS:
    for pid in SC.OPTS[slot]:
        kw = dict(sel={slot: pid}, ghosts=False)
        L[f'{slot}-{pid}'] = SC.build(**kw).render(only={slot}, part='obj', base=False, vig=False)
        L[f'sh-{slot}-{pid}'] = SC.build(**kw).render(only={slot}, part='shadow', base=False, vig=False)
        if slot == 'tutucu':
            L[f'{slot}-{pid}-alt'] = SC.build(tutucu_alt=True, **kw).render(only={slot}, part='obj', base=False, vig=False)
            L[f'sh-{slot}-{pid}-alt'] = SC.build(tutucu_alt=True, **kw).render(only={slot}, part='shadow', base=False, vig=False)
    G = SC.build(eksik=(slot,)); L[f'bos-{slot}'] = G.render(only={'_'}, base=False, vig=False, tops=True); anchors[slot] = G.anchors[slot]
    if slot == 'tutucu':
        G = SC.build(eksik=(slot,), tutucu_alt=True); L['bos-tutucu-alt'] = G.render(only={'_'}, base=False, vig=False, tops=True); anchors['tutucu-alt'] = G.anchors[slot]
pairs = []
for k, v in L.items():
    open(f'lay/{k}.svg', 'w').write(v); pairs.append((f'lay/{k}.svg', f'lay/{k}.png'))
if '--nr' not in sys.argv: run(pairs, SCALE)
meta = {}
for k in L:
    im = Image.open(f'lay/{k}.png').convert('RGBA'); Wp, Hp = im.size
    if k == 'taban':
        im.convert('RGB').save(f'{OUT}/taban.webp', quality=88); meta[k] = [0, 0, 100, 100]; continue
    a = np.asarray(im)[..., 3]; ys, xs = np.where(a > 2)
    if not len(xs): print('boş', k); continue
    x0, y0, x1, y1 = max(0, xs.min() - 4), max(0, ys.min() - 4), min(Wp, xs.max() + 5), min(Hp, ys.max() + 5)
    im.crop((x0, y0, x1, y1)).save(f'{OUT}/{k}.webp', quality=88, method=6)
    meta[k] = [round(x0/Wp*100, 3), round(y0/Hp*100, 3), round((x1-x0)/Wp*100, 3), round((y1-y0)/Hp*100, 3)]
json.dump({'box': meta, 'anchors': anchors}, open(f'{OUT}/../meta.json', 'w'))
print(len(meta), 'katman'); print(anchors)
