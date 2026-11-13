import json
M = json.load(open('meta.json'))
M['anchors']['mikro'][1] -= 16   # düğme boş tabanın üstünde, havada (bord tutucuyu kapatmasın)
SL = [
 ('guc','Güç kaynağı','Rafta durur, anakarta güç verir.',[(1996,'SUGON 3005PM (30V 5A)',100),(1916,'Aixun P3208 (32V 8A)',190)]),
 ('cimbiz','Cımbız seti','Panodaki askıda, el altında.',[(2981,'JC Cımbız Seti (SW-01/02/03)',15),(2710,'Luban 3D Cımbız Seti',29)]),
 ('sicak','Sıcak hava','Sol elde, entegre sökme-takma için.',[(3066,'Quick 861 Pro Max (1300W)',330),(2671,'SUGON 8650 PRO (1300W)',270)]),
 ('duman','Duman emici','Lehim dumanını yüzünden uzak tutar.',[(2242,'2UUL DA98 Aiolos Duman Emici',24),(3020,'RF4 RF-SF4 Duman Emici',16)]),
 ('mikro','Mikroskop','Tezgâhın ortası.',[(2913,'MY-7S Mikroskop',280),(3030,'Mr. Yang 85 Ultra Mikroskop',340)]),
 ('tutucu','Bord tutucu','Mikroskobun altında anakartı sabitler.',[(3032,'Relife TF6 Bord Tutucu',24),(2767,'Mechanic MK2 Bord Tutucu',22)]),
 ('havya','Havya','Sağ elde, ince lehim işleri için.',[(835,'JBC CD-2 İstasyonlu Havya',585),(2745,'Aixun T420D Çift Kanal Havya',300)]),
 ('olcu','Multimetre','Önde, ölçüm için.',[(3025,'2UUL MT30 Dijital Multimetre',18),(1514,'UNI-T UT33D+ Dijital Multimetre',17)]),
]
slots = [{'k':k,'ad':a,'alt':alt,'opts':[{'id':i,'n':n,'p':p} for i,n,p in o]} for k,a,alt,o in SL]
h = open('sablon.html').read().replace('__META__', json.dumps(M)).replace('__SLOTS__', json.dumps(slots, ensure_ascii=False))
open('index.html','w').write(h); print('ok')
