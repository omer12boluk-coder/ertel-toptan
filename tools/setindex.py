#!/usr/bin/env python3
"""Ayarlar araması için dizin: her ayar bölümündeki alan adlarını (label / başlık) kaynak koddan çıkarır → src/setindex.json.
build.py her derlemede çalıştırır; yeni ayar eklenince dizin kendiliğinden güncellenir."""
import re, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
adm = (ROOT / 'src/admin.jsx').read_text(); shp = (ROOT / 'src/shophome.jsx').read_text()
oth = lambda n: (ROOT / 'src' / n).read_text()
def fn(src, name):
    m = re.search(r'\n(?:export )?function ' + name + r'\(', src)
    if not m: return ''
    e = re.search(r'\n(?:export )?(?:function|const) ', src[m.end():])
    return src[m.start(): m.end() + (e.start() if e else len(src))]
body = adm[adm.index('const body = <>'): adm.index('const openSec')]
parts = re.split(r"\{sec === '(\w+)' && ", body)
sec = {}
for i in range(1, len(parts), 2): sec.setdefault(parts[i], '')
for i in range(1, len(parts), 2): sec[parts[i]] += parts[i + 1]
COMP = {'kart': [(adm, 'CardSettings')], 'gorunum': [(adm, 'LookSettings')], 'altbilgi': [(adm, 'FooterSettings')], 'anasayfa': [(adm, 'HomeEditor')],
        'magazaana': [(shp, 'ShopHomeEditor')], 'markalar': [(shp, 'BrandLogosEditor')], 'hesap': [(adm, 'Profile')], 'bildirim': [(adm, 'NotifyCard'), (adm, 'AdminPush')],
        'teslimat': [(adm, 'CarrierSettings')], 'tema': [(oth('decor.jsx'), 'DecorSettings')], 'kalip': [(oth('kalipfind.jsx'), 'KalipSettings')],
        'urtalep': [(oth('preq.jsx'), 'PreqSettings')], 'sorun': [(oth('issue.jsx'), 'IssueSettings')], 'ozellik': [(oth('extras.jsx'), 'FeatSettings')],
        'kota': [(oth('quota.jsx'), 'QuotaSettings')]}
for k, fs in COMP.items():
    for src, n in fs: sec[k] = sec.get(k, '') + fn(src, n)
PAT = [r'\blabel="([^"{}]{2,70})"', r'\btitle="([^"{}]{2,70})"', r'className="field-l">([^<{]{2,60})<', r'<h3>([^<{]{2,60})<', r'<b>([^<{]{3,50})</b>']
out = {}
for k, s in sec.items():
    seen = []
    for p in PAT:
        for x in re.findall(p, s):
            x = x.strip().rstrip(':')
            if x and x not in seen and not x.startswith(('Tutup', 'Kaldır', 'Sil')): seen.append(x)
    out[k] = seen
(ROOT / 'src/setindex.json').write_text(json.dumps(out, ensure_ascii=False, indent=0))
print('ayar dizini:', sum(len(v) for v in out.values()), 'öğe')
