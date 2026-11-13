# Canlı çizici için sahne verisi: scene.json (taban + her ürün ayrı + boş yuva izleri)
import json, sys
import sahne5 as SC
from eng import export
Z4 = (0, 0, 0, 0)
EMPTY = dict(twz=Z4, stack=0, sivi=Z4, flux=Z4)
out = {'base': export(SC.build(eksik=SC.SLOTS, ghosts=False, **EMPTY), base=True), 'items': {}, 'ghost': {}, 'anchor': {}}
I = out['items']
for slot in SC.SLOTS:
    for pid in SC.OPTS[slot]:
        I[f'{slot}-{pid}'] = export(SC.build(sel={slot: pid}, ghosts=False, **EMPTY), only={slot})
    G = SC.build(eksik=(slot,), **EMPTY)
for slot, ids, kw in (('cimbiz', SC.TWZ_IDS, 'twz'), ('sivi', SC.SIVI_IDS, 'sivi'), ('flux', SC.FLUX_IDS, 'flux')):
    for pid in ids:
        for i in range(4):
            tw = [0]*4; tw[i] = pid
            I[f'{slot}-{pid}-{i}'] = export(SC.build(ghosts=False, **{**EMPTY, kw: tw}), only={f'{slot}{i}'})
for lv in (1, 2, 3, 4):
    I[f'kalip-{lv}'] = export(SC.build(ghosts=False, **{**EMPTY, 'stack': lv}), only={'kalip'})
# boş yuva izleri + "+ Ekle" noktaları
G = SC.build(eksik=SC.SLOTS, ghosts=True, **EMPTY)
for slot in SC.SLOTS + ['cimbiz', 'sivi', 'flux', 'kalip']:
    out['ghost'][slot] = export(G, only={slot}).get('g', [])
    if slot in G.anchors: out['anchor'][slot] = G.anchors[slot][0]
s = json.dumps(out, separators=(',', ':'), ensure_ascii=False)
open(sys.argv[1] if len(sys.argv) > 1 else 'scene.json', 'w').write(s)
print(len(s)//1024, 'KB', len(I), 'öğe')
