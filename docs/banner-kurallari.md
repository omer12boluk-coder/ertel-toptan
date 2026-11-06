# Banner hazırlama kuralları (ana sayfa büyük reklam alanı)

> Kullanıcı yeni bir sohbette "banner hazırla" derse bu dosyayı örnek al. İlk örnek: 7.11.2026 fotoğraflı 5 banner
> (`src/photobn.jsx` → `PHOTO_BANNERS`; sunum https://claude.ai/artifact/Gxz9YyMNLTE7VvDsn27PBQ). Kullanıcı bunları
> "hepsi harika" diye onayladı. Aynı çizgide devam et, yeni bir tarz denemeden önce sor.

## 1. Kullanıcının beklentisi (kesin)

- **Gerçek ürün fotoğrafı.** Çizim / SVG / yapay görsel bannerlar REDDEDİLDİ ("orijinal ürün resimleriyle farklı tasarımlar").
- **Marka logosu her bannerda** başlığın üstünde (logo + ince çizgi + kısa etiket: `Yeni`, `Mikroskoplar`, model kodu).
  Logolar `hosting/public/brands/*.png`. Koyu zeminde koyu logo → CSS `brightness(0) invert(1)` ile beyaz (Quick).
  Açık zeminde açık logo varsa `-dark` sürümünü kullan (`aixun-dark.png`, `mechanic-dark.png`).
- **Apple sadeliği:** düz ya da çok hafif degrade zemin, bol boşluk, büyük kısa başlık, tek satırlık slogan, en çok iki
  satır açıklama, bir dolu düğme + bir yazı bağlantısı (`İncele` + `… ›`). Rozet, yıldız, fiyat patlaması, kalabalık YOK.
- **Mor YOK** (genel kural). Düğme rengi tema mavisi `#2f62d6`; zemin yeşilse düğme de o yeşil (2UUL `#0b7a52`).
- **Kesim temiz olmalı:** ürün kenarında beyaz hale / çerçeve kalmasın (Quick'te kullanıcı fark etti, bkz. §4).
- **Anlaşılır Türkçe:** "Aksamlar" gibi az bilinen kelime kullanma (kullanıcı sordu → "Aksesuarlar" oldu).
- **Kullanıcının kendi reklamlarına DOKUNMA.** Yeni bannerlar onların ÖNÜNE eklenir, hiçbiri silinmez; tek düğmeyle
  kapatılabilir (`shopHome.photoBn === false`, Tasarım › büyük reklam alanı › "Claude’un fotoğraflı bannerları").
- **Önce göster:** önce sunum (artifact), onaydan sonra `banner-foto` gibi bir dalda önizleme
  (`gh workflow run preview.yml --ref <dal>` → adres annotations'ta), "yayınla" denince `main`.
- **Sunum telefonda rahat görünmeli:** her şey alt alta, kaydırarak görülür; kaydırmalı/değişen öğe yok (kullanıcı tercihi).
  Her bannerın önce bilgisayar, altında telefon hâli. Örnek üretici: `docs/banner-oneri/gen.py` (HTML), sayfa ölçekleme JS'i
  bu sohbetteki `build.py` gibi (`.fit` kutusu `data-w/h` ile ölçeklenir).

## 2. Yerleşim sistemi (tuval)

Kutunun boyu her yerde farklı: eski banner (`Hero`) ~2.6:1, Paket 0 büyük kutu (`P0Hero`) ~1.45:1, tam ekran ~2:1,
telefonda ~0.75:1. Bu yüzden banner sabit resim DEĞİL; `PhotoBanner` kutuyu ölçer ve bir **tuval** çizer:

- **Geniş (en/boy ≥ 1.05):** tuval yüksekliği 560 birim (büyütme en çok ×1.3; daha yüksek kutuda tuval uzar),
  genişlik kutuya göre, en az 1000 birim (daha darsa genişliğe göre küçülür, tuval uzar).
  Yerleşim fonksiyonu `Wide({W, H})` W = 1000…1600, H = 560…700 aralığında düzgün çalışmalı:
  yazı solda `left: 88`, dikey ortada; ürün sağda (ya da tersi). Genişlikler W'ye göre hesaplanır
  (ör. `iw = Math.min(640, W * .46)`), yazı alanı daralırsa başlık 64 → 56.
- **Telefon (en/boy < 1.05):** tuval genişliği 358 birim, yükseklik kutuya göre (~450–600).
  Yazı üstte ortalı (`top: 30`), ürün altta; ürün boyu `free = H - 225` ile sınırlanır → düğmelerin üstüne binmez.
- Yazılar resme GÖMÜLMEZ (gerçek metin; SEO + net yazı).
- Ölçüler (geniş / telefon): başlık 600 64px / 34px `Inter Tight` -0.035em; slogan 500 28 / 19; açıklama 400 20 / 15
  `#6e6e73`; düğme 48 / 42 yükseklik, 24 yan boşluk; logo 30–40 / ×0.7.
- Köşeler: kutu köşesini Stil Stüdyosu belirler (`look.style.rHero`). Banner içindeki düğme köşesi buna uyar:
  rHero ≥ 16 (ya da boş) → hap (999), daha küçükse rHero × 0.5. Yeni yuvarlak öğe eklersen aynı kuralı uygula.
- Gölgeler: ürünün altına yumuşak elips (radial-gradient) yeterli. Açık renkli bannerda kutunun dış gölgesi
  hafifler (`.sh-hero.pb-lt`) — koyu gölge açık zeminde gri bant gibi görünüyordu (kullanıcı fark etti).
- Tam ekran / boydan boya: `shopHome.heroNav.fs` / `.full` (pc|m|all), `useHeroFull` (shophome.jsx). Yeni banner
  bu kiplerde de denenmeli.

## 3. Yeni banner eklemek (adımlar)

1. Ürünü seç: `src/products.json` (aktif `a:1`, stokta, resmi temiz). Kategori/marka bağlantısı için `src/categories.json`.
2. Resmi al: konteyner resim.ertelmarket.com'a ve Actions artifact'larına ULAŞAMAZ → geçici bir dalda Actions ile
   resimleri commit et, `git fetch origin <dal>` + `git show origin/<dal>:<dosya>` ile çek (önceki dal: `banner-resim`).
3. Kes / temizle (§4), `hosting/public/bn/<ad>.webp` olarak kaydet (geniş ≤1400px, telefon ≤800px, webp q84–88).
4. `PHOTO_BANNERS`'a kayıt ekle: `id, name, bg (bgM), dark, logo, logoWhite, lh, eye (eyeM), eyeC, title (titleM),
   tag, sub (subM), a1:[yazı, link], a2:[yazı, link] (a2M), btn, lnk`. Bağlantı biçimi: `p:<id>` ürün,
   `cart:<id>` sepete ekle (stok yoksa ürünü açar), `cat:<id>`, `brand:<Ad>`, `q:<arama>`, `new:`.
5. `Wide` ve `Phone` içine `b.id` dalı yaz (mevcut 5 dal örnek: yazı sol + foto sağ kesik [Quick], ortalı + üç açı
   [ZM6745T], tam fotoğraf sağ yarı [eller], ürün sol + yazı sağ [HT316], yazı sol + ürün sağ gölgeli [DA07]).
6. Sırayı kullanıcıya sor; varsayılan: yeni bannerlar en önde.
7. Derle (`python3 tools/build.py`), dene (§5), önizleme, onay, yayın. CLAUDE.md'ye 1–2 satır.

## 4. Fotoğraf hazırlama

- Ürün resimlerinin çoğu beyaz zeminli. `docs/banner-oneri/cut.py`: kenara değen beyaz alanı saydam yapar
  (thr 236, küçük adacıkları atar, 1.1px yumuşak kenar). Açık zemine konacaksa bu yeterli.
- **Koyu zemine konacak resim** (Quick örneği): saydam olsa bile kenarda stüdyonun beyaz ışık yansıması (parlak çizgi)
  kalır → `docs/banner-oneri/defringe.py <girdi> <çıktı> 34 4`: kenardan 34px içeriye kadar parlak pikselleri iç
  renge çeker (sadece koyulaştırır), alfayı 4px daraltır. Sonra siyah zemine bas ve webp kaydet. Büyüterek kontrol et
  (kablo iç kıvrımları, metal uçlar).
- Arka plan silme kütüphanesi EKLENMEDİ (uygun olanı AGPL) — yukarıdaki iki betik yeterli.
- Ürünün tamamı görünmeli; kırpılacaksa sadece kenardan taşma (kablo, tabla) şeklinde, bilerek.

## 5. Deneme listesi (yayından önce)

- Bilgisayar 1440×900 ve telefon 390×844 (`is_mobile`, `has_touch`), demo sunucusu + Playwright.
- İki vitrin: eski `Hero` (demo varsayılanı) ve Paket 0 (`__store` ile `layout: ['p0:hero', …]`, `hidden: ['hero']`).
- Tam ekran (`heroNav.fs: 'all'`) + sivri köşe (`look.style.rHero: 0`).
- Her bannerı ayrı görüntüle (eski Hero: `.sh-hero-track` `scrollTo`, Paket 0: `.p0-dots button`).
- Düğmeler: `İncele` ürün penceresini açıyor mu, `Sepete ekle` sepete atıyor mu (`__store.s.cart`).
- Ürün düğmeye/yazıya biniyor mu; açık zeminde noktalar ve oklar görünüyor mu; gece modunda gölge.
- Sayfa hatası (`pageerror`) yok.

## 6. Kart hizası (kullanıcı kuralı, 7.11.2026)

"Hizasızlık istemiyorum": yan yana kartlarda **logo, resim, ad, açıklama, fiyat ve Sepete ekle hep aynı çizgide** olmalı.
- Logo kutusu sabit yükseklik (16 px), resim alanı sabit yükseklik (150 / telefonda 104 px).
- Ad en çok 2 satır, **en az 2 satırlık yer** (`min-height: 2.4em`); açıklama en çok 2 satır, en az 2 satırlık yer.
- Fiyat + Sepete ekle kartın dibine yapışık (`margin-top: auto`); ızgara satırındaki kartlar eşit boy (grid stretch).
- Örnek: `src/cdhome.jsx` `.cd-tile` (Bu hafta masamızdan küçükleri + ürün rafları). Yeni kart yazarken bunu kopyala.

## 7. Claude düzeni bölümleri (cdhome.jsx)

`cd:hero` (banner: `heroList`, genişlik `heroW`, yükseklik `heroFill`), `cd:pick`, `cd:sets`, `cd:brands`, `cd:mq`, ürün rafları `CdRail`
(`look.cd` açıkken bütün raflar). Ayarlar `shopHome.cd.{pick,sets,brands,mq}`. Kısa ad `shortOf(p, names)` (elle ad `cd.pick.names`).
Banner satırı `{ pb: '<şablon id>', title?, tag?, sub?, eye?, c1?, c2?, off? }` (`pbOf` çözer).

## 8. Kategori kapakları ve reklam kutuları (7.11.2026)

- Kapak 800×600, reklam 800×1000 (üst %40 yazı için boş). Zemin: iki açık tonlu dikey degrade + sağ üstte hafif ışık;
  ürün kesimi alta oturur, altında yumuşak elips gölge. Yazı resme GÖMÜLMEZ (sayfada HTML).
- Tonlar (mor yok): nane `#f2fbf7→#d8efe4`, buz mavisi `#f1f6fd→#dde7f7`, gri `#f6f6f8→#e3e4ea`, kum `#faf5ee→#eee2d2`, gül `#fcf2f0→#f2dcd7`.
- Filigranlı (başka mağaza adı), üstünde yazı olan ya da 500 px'ten küçük fotoğraf KULLANILMAZ.
- Kullanıcı: renkli zeminde beyaz zeminli ürün resmi "kutu gibi" duruyor → ürün resmi renkli karta koyulacaksa ya kesim yap ya da kartı beyaz yap.
