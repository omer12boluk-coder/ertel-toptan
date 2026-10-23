# Varyasyonlu dışa aktarımı mevcut products.json ile birleştirir: resimler, marka, 2. kategori, etiketler, açıklama, URL.
import pandas as pd, json, sys
f = sys.argv[1]
df = pd.read_excel(f, 'Ürünler')
kat = pd.read_excel(f, 'Kategoriler')
old = {p['id']: p for p in json.load(open('src/products.json'))}
descs = {}
diff_w = diff_a = 0
for r in df.to_dict('records'):
    i = int(r['Ürün ID']); p = old.get(i)
    if not p: continue
    ims = [str(r[f'Ürün Resmi {n}']).strip() for n in range(1, 11) if pd.notna(r[f'Ürün Resmi {n}']) and str(r[f'Ürün Resmi {n}']).strip()]
    p.pop('pi', None); p.pop('im', None)
    if ims: p['pi'] = ims[0]
    if len(ims) > 1: p['im'] = ims[1:]
    b = str(r['Marka']).strip() if pd.notna(r['Marka']) else ''
    if b and b != '-': p['b'] = b
    c1 = int(r['Ürün Kategori Id 1']) if pd.notna(r['Ürün Kategori Id 1']) else p['c']
    c2 = int(r['Ürün Kategori Id 2']) if pd.notna(r['Ürün Kategori Id 2']) else None
    p['c'] = c1
    if c2 and c2 != c1: p['c2'] = c2
    t = str(r['Etiketler']).strip() if pd.notna(r['Etiketler']) else ''
    if t: p['t'] = ','.join(dict.fromkeys(x.strip() for x in t.split(',') if x.strip()))
    if pd.notna(r['Ürün URL']): p['u'] = str(r['Ürün URL']).strip()
    ind = float(r['İndirimli Fiyat'] or 0)
    if ind > 0 and p.get('w') != ind: diff_w += 1; p['w'] = ind
    if int(r['Ürün Durumu']) != p['a']: diff_a += 1; p['a'] = int(r['Ürün Durumu'])
    p['r'] = float(r['Fiyat'])
    if pd.notna(r['Ürün Açıklaması']) and str(r['Ürün Açıklaması']).strip(): descs[i] = str(r['Ürün Açıklaması']).strip()
items = sorted(old.values(), key=lambda x: -x['id'])
json.dump(items, open('src/products.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(descs, open('src/descs.json', 'w'), ensure_ascii=False, separators=(',', ':'))
# kategori ağacı (alt çizgi sayısı = derinlik)
tree, stack = [], []
for r in kat.to_dict('records'):
    name = str(r['Kategori Adı']); d = len(name) - len(name.lstrip('_'))
    stack = stack[:d]; parent = stack[-1] if stack else 0
    tree.append([int(r['Id']), name.lstrip('_').strip(), parent]); stack.append(int(r['Id']))
json.dump(tree, open('src/categories.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('items', len(items), 'imgs', sum(1 for p in items if 'pi' in p), 'extra', sum(len(p.get('im', [])) for p in items),
      'tags', sum(1 for p in items if 't' in p), 'brand', sum(1 for p in items if 'b' in p), 'desc', len(descs),
      'w changed', diff_w, 'a changed', diff_a, 'cats', len(tree))
