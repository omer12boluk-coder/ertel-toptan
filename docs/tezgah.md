# /tezgah — Tezgâhını kur (13.11.2026)

Müşteri tamir tezgâhını sıfırdan kurar: yuvalara ürün seçer, eksikleri görür, hepsini sepete ekler.

- Canlı: `hosting/public/tezgah/` (index.html, motor.js, scene.json, img/p-<id>.webp ürün kapakları). Uygulamadan bağımsız statik sayfa.
- Çizim: Python 3B sahne (`tools/tezgah/v5/sahne5.py`, motor `eng.py`) dünya koordinatlı veri üretir (`disa.py` → scene.json); tarayıcıda `motor.js` canvas ile her karede çizer (yörünge kamera, savrulma, imlece yakınlaşma, yakın düzlem kırpma, renk kodlu tıklama tamponu, iniş animasyonu).
- Arayüz: `tools/tezgah/demo-v5/sablon.html` + `yap.py` (yuva/ürün listesi, etiket noktaları, kalıp listesi `kaliplar.json` = sitedeki tek kalıplar, setler hariç).
- Yuvalar: tek seçimli (mikroskop, havya, sıcak hava, güç kaynağı, bord tutucu, termal, duman emici, bord ısıtıcı, dramel, multimetre, tornavida, yan keski), çoklu 4 yer (cımbız askısı, sıvı lehim tepsisi, flux tepsisi), adetli (kalıp destesi: 1–3 / 4–10 / 11–30 / 30+).
- Sepet: 'Hepsini sepete ekle' → `sessionStorage['tezgah-ekle'] = {id: adet}` → `/sepet`; `src/store.js loadCart` ekler ve anahtarı siler.
- `sw.js`: /tezgah istekleri servis çalışanına karışmaz (uygulama kabuğu önbelleği bozulmasın).
- Fiyatlar sayfada USD liste fiyatı; TL/KDV sepette.
- Ürün fotoğrafı lazım olursa `tezgah-demo` dalında `tools/tezgah/foto.py` IDS + ADIM.txt `[foto]` (GPT yok, ücretsiz).
