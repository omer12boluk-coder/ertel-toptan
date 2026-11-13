import json, os, re
import sahne
from PIL import Image
import numpy as np
OUT = '/home/claude/tezgah-ui3/img'; os.makedirs(OUT, exist_ok=True)
VIG = '<rect width="1536" height="1024" fill="url(#vig)"/>'
ALL = ('guc', 'havya', 'mikro', 'sicak')
def only(S, tag, base=False):
    S.objs = [o for o in S.objs if o['tag'] == tag]; S.shadows = [x for x in S.shadows if x[0] == tag]
    if not base: S.base = []; S.bg = []; S.pre = []
    S.top = []; return S
L = {}
S = sahne.build(eksik=ALL, ghosts=False); S.objs = [o for o in S.objs if o['tag'] not in ('decor',) + ALL]; S.shadows = [x for x in S.shadows if x[0] not in ('decor',) + ALL]; S.top = []
L['taban'] = S.render()
L['on'] = only(sahne.build(ghosts=False), 'decor').render().replace(VIG, '')
for slot, ids in {'guc': [1996, 1916], 'havya': [835, 2745], 'mikro': [2913, 3030], 'sicak': [3066, 2671]}.items():
    for pid in ids:
        L[f'{slot}-{pid}'] = only(sahne.build(sel={slot: pid}, ghosts=False), slot).render().replace(VIG, '')
    G = sahne.build(eksik=(slot,), ghosts=False); G.objs = []; G.shadows = []; G.base = []; G.bg = []; G.pre = []
    L[f'bos-{slot}'] = G.render().replace(VIG, '')
os.makedirs('lay', exist_ok=True)
for k, v in L.items(): open(f'lay/{k}.svg', 'w').write(v)
print(list(L))
