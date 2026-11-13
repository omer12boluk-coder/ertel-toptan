import json, sys
P = {p['id']: p for p in json.load(open('/tmp/prod.json'))}
KAL = json.load(open('/home/claude/kaliplar.json'))
Y0 = .75
SL = [
 ('mikro','Mikroskop','Tezgâhın ortası.','tek',[(2913,'MY-7S'),(3030,'Mr. Yang 85 Ultra')],{}),
 ('havya','Havya','Sağ elde, ince lehim işleri için.','tek',[(835,'JBC CD-2'),(2745,'Aixun T420D')],{}),
 ('sicak','Sıcak hava','Sol elde, entegre sökme-takma için.','tek',[(3066,'Quick 861 Pro Max'),(2671,'SUGON 8650 PRO')],{}),
 ('guc','Güç kaynağı','Rafta durur, anakarta güç verir.','tek',[(1996,'SUGON 3005PM'),(1916,'Aixun P3208')],{}),
 ('tutucu','Bord tutucu','Anakartı sabitler.','tek',[(3032,'Relife TF6'),(2767,'Mechanic MK2')],{}),
 ('termal','Termal kamera','Kısa devreyi ısıdan bulur.','tek',[(2183,'Qianli Fire Eye Pro'),(1160,'Mega-idea IR Cam 2S')],{}),
 ('duman','Duman emici','Lehim dumanını yüzünden uzak tutar.','tek',[(2242,'2UUL Aiolos'),(3020,'RF4 RF-SF4')],{}),
 ('isitici','Bord ısıtıcı','Anakartı alttan ısıtıp katmanları ayırır.','tek',[(2035,'XZZ L2023'),(2455,'Aixun iHeater Pro'),(1953,'Sunshine SS-T12B')],{}),
 ('dramel','Dramel','Pad ve yüzey temizliği için.','tek',[(2464,'2UUL DA85'),(2303,'2UUL DA51')],{}),
 ('olcu','Multimetre','Önde, ölçüm için.','tek',[(3025,'2UUL MT30'),(1514,'UNI-T UT33D+')],{}),
 ('cimbiz','Cımbız','Panodaki askıda. Tek tek seç, en çok 4 yuva.','coklu',[(1790,'2UUL Ti21'),(1791,'2UUL Ti22'),(2978,'JC SW-01'),(2709,'Luban 3D-3'),(3056,'Mijing TCN-02'),(2918,'2UUL TW41'),(2953,'Mechanic KF-16'),(2287,'2UUL TW32')],{'ilk':[1790,2978],'ekle':'Askıya as'}),
 ('sivi','Sıvı lehim','Soldaki tepside 4 yer var.','coklu',[(2672,'Red Skull 138°'),(1894,'Ma Ant 183°'),(2917,'YCS 215°'),(1892,'Mechanic 217°'),(1638,'ERT Mobile 138°')],{'ilk':[2672,1894],'ekle':'Tepsiye koy'}),
 ('flux','Flux','Sağdaki tepside 4 yer var.','coklu',[(2203,'2UUL EcoFlux'),(2620,'YCS 7SS'),(94,'ERSA Flux'),(2631,'2UUL Green Flux')],{'ilk':[2203],'ekle':'Tepsiye koy'}),
 ('kalip','Kalıplar','Matın köşesinde deste.','adet',[],{}),
 ('tornavida','Tornavida seti','Panoda asılı.','tek',[(2702,'YCS-3D 5in1'),(3053,'Mechanic HS-360')],{}),
 ('keski','Yan keski','Panoda asılı.','tek',[(2998,'2UUL CT01'),(402,'Piergiacomi TRE-03')],{}),
]
TP = {
 'guc': {1996: (-.755, 1.245, -.235), 1916: (-.77, 1.2, -.245)}, 'kalip': ('b', (.5, Y0, .28)),
 'cimbiz': ('b', (-.32, 1.265, -.48)), 'tornavida': ('b', (.41, 1.27, -.49)), 'keski': (.64, 1.465, -.49),
 'sicak': (-.58, Y0 + .175, -.06), 'duman': (-.3, Y0 + .17, -.1), 'termal': (.645, Y0 + .255, -.13),
 'mikro': (0, 1.18, -.06), 'tutucu': ('b', (-.12, Y0, .275)), 'havya': {835: (.37, Y0 + .135, -.04), 2745: (.42, Y0 + .14, -.04)},
 'isitici': ('b', (-.54, Y0, .21)), 'sivi': ('b', (-.3, Y0, .2)), 'flux': ('b', (.64, Y0, .3)), 'dramel': ('b', (.41, Y0, .18)), 'olcu': ('b', (.21, Y0, .255)),
}
TAGS = {}
for k, v in TP.items():
    if isinstance(v, dict): TAGS[k] = {str(i): list(q) for i, q in v.items()}
    elif v[0] == 'b': TAGS[k] = {'b': 1, '*': list(v[1])}
    else: TAGS[k] = {'*': list(v)}
slots = []
for k, a, alt, tip, opts, ex in SL:
    d = {'k': k, 'ad': a, 'alt': alt, 'tip': tip, 'opts': [{'id': i, 'n': P[i]['n'].split(' (')[0], 'kisa': ks, 'p': P[i]['r']} for i, ks in opts]}
    d.update(ex); slots.append(d)
h = (open('sablon.html').read().replace('__META__', json.dumps({'tags': TAGS})).replace('__SLOTS__', json.dumps(slots, ensure_ascii=False))
     .replace('__KALIP__', json.dumps(KAL, ensure_ascii=False)))
open('index.html', 'w').write(h); print('ok', len(h)//1024, 'KB')
