import json
P = {p['id']: p for p in json.load(open('/tmp/prod.json'))}
M = json.load(open('meta.json'))
M['anchors']['mikro'][1] -= 16
KAL = json.load(open('/home/claude/kaliplar.json'))
# k, ad, alt, tip, [(id, kısa)], seçenekler: tb=etiket altta, to=etiket kaydırma(%)
SL = [
 ('mikro','Mikroskop','Tezgâhın ortası.','tek',[(2913,'MY-7S'),(3030,'Mr. Yang 85 Ultra')],{}),
 ('havya','Havya','Sağ elde, ince lehim işleri için.','tek',[(835,'JBC CD-2'),(2745,'Aixun T420D')],{}),
 ('sicak','Sıcak hava','Sol elde, entegre sökme-takma için.','tek',[(3066,'Quick 861 Pro Max'),(2671,'SUGON 8650 PRO')],{}),
 ('guc','Güç kaynağı','Rafta durur, anakarta güç verir.','tek',[(1996,'SUGON 3005PM'),(1916,'Aixun P3208')],{}),
 ('tutucu','Bord tutucu','Mikroskobun altında anakartı sabitler.','tek',[(3032,'Relife TF6'),(2767,'Mechanic MK2')],{'tb':1}),
 ('termal','Termal kamera','Kısa devreyi ısıdan bulur.','tek',[(2183,'Qianli Fire Eye Pro'),(1160,'Mega-idea IR Cam 2S')],{}),
 ('duman','Duman emici','Lehim dumanını yüzünden uzak tutar.','tek',[(2242,'2UUL Aiolos'),(3020,'RF4 RF-SF4')],{}),
 ('isitici','Bord ısıtıcı','Anakartı alttan ısıtır.','tek',[(2688,'2UUL PH11 Hot Block'),(2838,'Mechanic Heat-mini')],{'tb':1}),
 ('dramel','Dramel','Pad ve yüzey temizliği için.','tek',[(2464,'2UUL DA85'),(2303,'2UUL DA51')],{'tb':1}),
 ('olcu','Multimetre','Önde, ölçüm için.','tek',[(3025,'2UUL MT30'),(1514,'UNI-T UT33D+')],{'tb':1}),
 ('cimbiz','Cımbız','Panodaki askıda. Tek tek seç, en çok 4 yuva.','coklu',[(1790,'2UUL Ti21'),(1791,'2UUL Ti22'),(2978,'JC SW-01'),(2709,'Luban 3D-3'),(3056,'Mijing TCN-02'),(2918,'2UUL TW41'),(2953,'Mechanic KF-16'),(2287,'2UUL TW32')],{'ilk':[1790,2978],'ekle':'Askıya as','tb':1}),
 ('sivi','Sıvı lehim / flux','Tepside 4 yer var. Seçtiklerin sırayla dizilir.','coklu',[(2672,'Red Skull 138°'),(1894,'Ma Ant 183°'),(2917,'YCS 215°'),(2631,'2UUL Green Flux'),(2203,'2UUL EcoFlux'),(2620,'YCS 7SS Flux')],{'ilk':[2672,2203],'ekle':'Tepsiye koy'}),
 ('kalip','Kalıplar','Rafta deste.','adet',[],{}),
 ('tornavida','Tornavida seti','Panoda asılı.','tek',[(2702,'YCS-3D 5in1'),(3053,'Mechanic HS-360')],{}),
 ('keski','Yan keski','Panoda asılı.','tek',[(2998,'2UUL CT01'),(402,'Piergiacomi TRE-03')],{}),
]
import sys; sys.path.insert(0, '/home/claude/svg4')
from tez3d import Cam, W as CW, H as CH
cam = Cam([.98, 1.56, 1.5], [-.04, 1.02, -.16], F=1400)
Y0, MB = .75, .784
TP = {  # etiket noktası (3B): slot -> nokta ya da {id: nokta}; 'b' = etiket altta
 'guc': {1996: (-.755, 1.245, -.235), 1916: (-.77, 1.2, -.245)}, 'kalip': (-.56, 1.1, -.28),
 'cimbiz': ('b', (-.32, 1.265, -.48)), 'tornavida': ('b', (.41, 1.27, -.49)), 'keski': ('b', (.64, 1.27, -.49)),
 'sicak': (-.58, Y0 + .175, -.06), 'duman': (-.3, Y0 + .17, -.1), 'termal': (.645, Y0 + .255, -.13),
 'mikro': (0, 1.18, -.06), 'tutucu': ('b', (0, MB, .07)), 'havya': {835: (.37, Y0 + .135, -.04), 2745: (.42, Y0 + .14, -.04)},
 'isitici': ('b', (-.465, Y0, .2)), 'sivi': ('b', (-.3, Y0, .2)), 'dramel': ('b', (.425, Y0, .185)), 'olcu': ('b', (.21, Y0, .255)),
}
def pr(p): x, y, _ = cam.pr(list(p)); return [round(x/CW*100, 2), round(y/CH*100, 2)]
TAGS = {}
for k, v in TP.items():
    if isinstance(v, dict): TAGS[k] = {str(i): pr(q) for i, q in v.items()}
    elif v[0] == 'b': TAGS[k] = {'b': 1, '*': pr(v[1])}
    else: TAGS[k] = {'*': pr(v)}
M['tags'] = TAGS
slots = []
for k, a, alt, tip, opts, ex in SL:
    d = {'k': k, 'ad': a, 'alt': alt, 'tip': tip, 'opts': [{'id': i, 'n': P[i]['n'].split(' (')[0], 'kisa': ks, 'p': P[i]['r']} for i, ks in opts]}
    d.update(ex); slots.append(d)
ORDER = ['guc','kalip','cimbiz','tornavida','keski','sicak','duman','termal','mikro','tutucu','havya','isitici','sivi','dramel','olcu']
h = (open('sablon.html').read().replace('__META__', json.dumps(M)).replace('__SLOTS__', json.dumps(slots, ensure_ascii=False))
     .replace('__KALIP__', json.dumps(KAL, ensure_ascii=False)).replace('__ORDER__', json.dumps(ORDER)))
open('index.html', 'w').write(h); print('ok', len(h)//1024, 'KB')
