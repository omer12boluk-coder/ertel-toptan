# Tarif: Tanıtım videosu ekle ("… geldi, tanıtım videosu hazırla")

Bölüm: `cd:film` (ekranda "Tanıtım videosu", başlık varsayılanı "Yakından bak."). Ana sayfada "Bu hafta masamızdan"ın
altında kendiliğinden durur (`withFilm`, kullanıcı Tasarım modundan taşır/gizler). Video mp4 DEĞİL: `src/film.js` sahneleri
sayfada çizer. Kod (`film.js`, `filmses.js`, `filmblock.jsx`) — normalde DOKUNMA; yeni video = `src/icerik/videolar.json`'a bir kayıt.
İlk örnek ve onaylanan tarz: `q861` (Quick 861 Pro Max, 8.11.2026). Yeni videoyu bu kaydı kopyalayıp yaz.

## Kullanıcının kuralları (kesin)
- Apple tarzı, konuşmasız, yazılar Türkçe ve kısa. **Makineye zum YOK**; her sahne ayrı "sayfa", aralarında geçiş
  (`blur`, `wipeUp`, `circle`, `push`, `wipeRight`; ilk sahne `cut`). Sahne 2,4–3 sn, toplam ~15 sn, son karede durur.
- Koyu sahneler **bannerdaki tema**: siyah zemin, turuncu küçük etiket (`acc`), beyaz başlık, `#c7c7cc` açıklama.
  Giriş sahnesi renkli `blobs` ama **turuncu DEĞİL** (beğenilmedi): mavi–turkuaz `pal` (q861 örneği), ürün adı ORTA boy
  (bilgisayar 96, telefon 80) — büyüğü "çok aşırı" bulundu.
- Marka satırında ert imzası YOK (logo | "Yeni", `eye`; logo dikey ayarı `logoY`, Quick −0.16).
- Son kare banner'ın birebir aynısı OLMASIN: ortalı düzen (eye, ad, slogan, düğmeler üstte; ürün altta ortada) +
  **ayrı kapanış olarak sol üst köşede ert mobile logosu** (`img` `ertel-logo.png`, en son belirir).
- Ses: sitede varsayılan "açık başlasın" (`shopHome.cd.film.sound` 'off' = kapalı); tarayıcı kuralı gereği müzik
  ziyaretçinin sayfaya ilk dokunuşunda/tıklamasında girer.
- Fotoğraf: **temiz kesim şart** (kol / kablo kenarında beyaz hale = "rezalet"). Banner için temizlenmiş `bn/*.webp` varsa onu
  kullan; yoksa `tools/banner/cut.py` + koyu zemin için `defringe.py` (docs/banner-kurallari.md §4). Büyük çözünürlük (≥1400 px).
- Bilgiler ürünün kendi açıklamasından (`src/descs.json`), uydurma rakam yazma. Mor yok.
- **Sahne başları vuruş ızgarasında:** `t0` = 0, sonra 0,4 + 0,6 × n (2.2, 5.2, 8.2, 10.6, 13.0 …). Müzik
  (`filmses.js`, telifsiz, tarayıcıda üretilir) geçişlerde bunlara göre vurur; ızgara dışı t0 = ritim kayar.
  `total` = son sahne t0 + ~1,8.

## Adımlar
1. Ürünü bul (`src/products.json`, gerekirse Actions 'Claude için getir'), açıklamadan 3–4 gerçek özellik seç.
2. Resimleri hazırla → `hosting/public/bn/film-<id>-*.webp` (ya da var olan banner resmi).
3. `src/icerik/videolar.json`'a kayıt: `id, name, p (ürün id), logo, logoWhite, logoY, acc, total, scenes[]`.
   Öğe türleri: `tx` (s: xl|l|s, `acc`: 1 turuncu), `eye`, `img` (src, telefon için srcM), `say`, `wave` (on), `num`
   (from,to,unit,at), `card` (v,l), `btns`, `blobs`. Her öğede `w` (1600×900) ve `t` (800×1000) konumu, `a` giriş
   (rise|up|left|right|pop|mask|fade), `d` gecikme. "Ürüne git" ve düğmeler `p`'yi açar.
4. Önce sunum/önizleme: artifact (bilgisayar + telefon, kaydırmalı) ya da `python3 tools/build.py` + demo.
   Demo: `__store` ile `settings.look.cd = true`, `shopHome.layout` içinde `cd:hero` olsun → video kendiliğinden girer.
5. Sıra / kapatma: kullanıcı Tasarım › Tanıtım videosu (`shopHome.cd.film { ids, off, eye, title, auto, music }`).
   Kod tarafında kapatmak: kayda `"off": true`. Birden çok açık video sırayla oynar.
6. mp4 istenirse: `tools/film-mp4.py <id>` (kareleri Playwright ile çeker, sesi OfflineAudioContext ile üretir, ffmpeg).
7. "yayınla" denince derle + main'e push, CLAUDE.md'ye 1 satır.
