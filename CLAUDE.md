# ERTEL GSM — B2B katalog + online mağaza (Claude için proje notları)

Telefon tamir ekipmanı satan ERTEL GSM'in (ertelgsm.com, PlatinMarket altyapısı, Tahtakale/İstanbul) uygulaması. Üç bölüm:
**bayilere (toptancılara) özel katalog + talep/teklif**, **herkese açık online mağaza** ve **yönetim paneli**. Canlı: https://erteltoptan.web.app

**Kullanıcıyla Türkçe konuş, teknik olmayan dille anlat.** Kullanıcı tasarıma çok önem veriyor; küçük görsel kusurları fark eder. Bir ekran için istenen değişikliği başka ekranlara (ör. telefon isteği → masaüstü) yaymadan yap; yayman gerekiyorsa önce söyle.

---

## 1. Teknolojiler

| Katman | Ne kullanılıyor |
|---|---|
| Arayüz | React 19 (JSX), tek CSS dosyası (`src/style.css`), kendi küçük bileşen seti (`src/ui.jsx`), global durum `src/store.js` (useSyncExternalStore benzeri basit store) |
| Paketleme | esbuild (node_modules'te), `python3 tools/build.py` → tek dosya `hosting/public/index.html` (+ deneme için `DEMO.html`). PNG logolar data URL olarak gömülür |
| Veri / oturum | Firebase **Spark (ücretsiz)**: Authentication (e-posta/şifre) + Firestore. Storage ve Cloud Functions YOK (kullanıcı Blaze istemiyor). Firebase SDK 10.12.2, kendi sitemizden `/fb/` altından yüklenir |
| Barındırma | Firebase Hosting (erteltoptan.web.app), PWA (service worker `hosting/public/sw.js`, manifest dosyaları) |
| Arka plan işleri | Cloudflare Worker `ertel-b2b-watch` (`worker/index.js`, `wrangler.toml`, KV depo) — site eşitleme tetikleyici, kur, sipariş bildirimi |
| Otomasyon | GitHub Actions (aşağıda) — repo `omer12boluk-coder/ertel-toptan` |
| Bildirim | Telegram botu (@ertelsiparis_bot) + Resend e-posta |
| Deneme | Playwright (Chromium) ile DEMO.html üzerinden; demo veri katmanı `backend-demo.js` (localStorage) |

## 2. Klasör yapısı

```
src/
  main.jsx          giriş: boot(), oturum, sekme yönlendirme, üst/alt menü, Splash, IntroSplash (açılış ekranı), FormOnlyShell (/siparisformu), migrate()
  route.js          adres çözümleme (ROUTE), linkler, waLink
  store.js          global durum, go()/sekme geçmişi (pushState), sepet
  config.js         DEFAULT_SETTINGS (tüm ayarların varsayılanı), kategori adları, ORDER_STATUS
  ui.jsx            Icon, Sheet, Field, Toggle, Fold, Thumb, Confirm, ContextMenu…
  utils.js          fmt, priceFor (fiyat kuralı), totals, deepMerge/withDefaults, ls (localStorage)
  backend-firebase.js / backend-demo.js   veri katmanı (aynı arayüz)
  catalog.jsx       ürün listesi (kutu/satır), filtreler, ProductSheet (ürün penceresi), Gallery, Lightbox
  cart.jsx          ortak sepet (mağaza + bayi)
  checkout.jsx      mağaza siparişi, üyelik/giriş, Hesabım, sipariş takip sayfası, e-posta işlem sayfası
  orders.jsx        yönetim: mağaza siparişleri + mağaza üyeleri
  requests.jsx      bayi talepleri (sohbet)
  admin.jsx         yönetim: Müşteriler (bayiler), Ayarlar (açılır-kapanır bölümler), Profil
  dashboard.jsx     yönetim ana sayfası (Genel bakış)
  shophome.jsx      mağaza ana sayfası + ayar düzenleyicileri + HeaderSearch (üstteki arama) + marka logoları editörü
  designer.jsx      Tasarım modu (mağaza ana sayfasını üstünde düzenleme)
  orderform.jsx     yönetim: Sipariş formu (liste resmi + fiyatlı link)
  listsheet.jsx / listcode.js   vitrin listesi (ürünler linkin içinde kodlu), liste kâğıdı / PNG
  home.jsx          giriş sayfası (/) ve bayi ana sayfası
  guestcart.jsx     HeaderCart (üst menü sepeti), CartBar (sağ alt küçük sepet)
  watch.js          kur (Harem Altın) ve sürüm kontrolü, "Şimdi eşitle"
  idb.js            IndexedDB önbellek (zaman aşımlı)
  xlsx.js           Excel içe/dışa aktarma (mergeCatalog)
  clean.js          ürün adı temizliği (Windows-1252 kalıntısı, &#..; kodları)
  products.json / categories.json / descs.json   gömülü başlangıç verisi
hosting/
  firebase.json, firestore.rules, firestore.indexes.json
  public/  index.html (derlenmiş), config.js (Firebase ayarı + WATCH_URL), sw.js, manifest-*.webmanifest,
           icon-*.png, icon-admin-*.png, brands/*.png (marka logoları), splash/dukkan.jpg, fb/ (Firebase SDK)
tools/      build.py, sync-platin.mjs (site eşitleme), fetch-logos.mjs (marka logosu toplama), convert*.py (eski veri dönüştürme)
worker/     index.js (Cloudflare Worker)
.github/workflows/  deploy.yml, sync.yml, worker.yml, vendor-firebase.yml, brand-assets.yml
KURULUM.md  kullanıcıya yönelik kurulum anlatımı · README.md kısa tanıtım
```

## 3. Derleme, yayın, test

- Değişiklikten sonra **`python3 tools/build.py`** çalıştır ve çıktıyı (`hosting/public/index.html`, `DEMO.html`, `version.json`) da commit et.
- **`main`'e push = otomatik yayın.** GitHub Actions:
  - **Yayınla** (`deploy.yml`): Firebase Hosting + Firestore kuralları.
  - **Bekçiyi yayınla** (`worker.yml`): Cloudflare Worker'ı yükler, gizli ayarları (TELEGRAM_TOKEN, RESEND_KEY, GH_TOKEN) Worker'a koyar; `worker/`, `wrangler.toml` değişince kendiliğinden çalışır.
  - **Siteyle eşitle** (`sync.yml`): PlatinMarket beslemesini okuyup katalogu günceller (Worker tetikler).
  - **Firebase kütüphanesini siteye kopyala** (`vendor-firebase.yml`), **Marka logolarını getir** (`brand-assets.yml`, sonucu `brand-assets` dalına yazar).
  - Elle çalıştırma: `gh workflow run <dosya>.yml --ref main`.
- Commit mesajları Türkçe; yayından sonra `gh run list` ile bitmesini bekle, gerekirse canlıyı tarayıcıda kontrol et.
- **Test:** Konteynerden canlı siteye/Firebase'e erişilemez. Deneme sunucusu `/tmp/claude-0/web/serve.py` (port 8765, her adrese DEMO.html, `/brands/` ve `/splash/` dosyalarını verir) + Playwright (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Demo girişleri: yönetici `admin/admin`, bayi `ahmet/1234`. Telefon için 390×844 + `is_mobile/has_touch`.

## 4. Adresler

- `/` giriş sayfası (Online mağaza büyük / Bayi girişi). `/magaza` online mağaza, `/b2b` bayi uygulaması, `/admin` yönetim paneli (ayrı oturum).
- Sekmeler adreste (store.js `SLUGS`, pushState + popstate; telefonda geri kaydırınca önceki sekmeye döner, kaydırma yeri geri gelir):
  `/magaza/urunler|sepet|hesap`, `/b2b/urunler|sepet|talepler|profil`, `/admin` (ana sayfa), `/admin/talepler|siparisler|form|urunler|musteriler|tasarim|ayarlar`.
- `/magaza/l/<kod>` vitrin listesi (veritabanına KAYDEDİLMEZ; ürün/adet/fiyat linkin içinde) · `/admin/l/<kod>` yönetici fiyatlar, yeni link + PNG üretir.
- `/magaza/s/<id>` müşteri sipariş takibi (kimlik tahmin edilemez, herkes `get` edebilir, liste yok) · `/admin/s/<id>` yönetici.
- `/b2b/t/<id>` (eski `/t/<id>` de) ve `/admin/t/<id>` talep linkleri · eski `/magaza/t/<id>` sadece görüntülenir.
- `/magaza/islem` e-postadaki doğrulama / şifre sıfırlama bağlantıları (Firebase > Authentication > Templates > işlem URL'si).
- `/siparisformu` menüsüz tek sayfa sipariş formu (aşağıda).
- Ana ekrana ekleme: `index.html` başındaki küçük betik adrese göre manifest ekler: `/admin` ve `/siparisformu` → `manifest-admin` ("ERTEL Yönetim", lacivert + sarı kalkanlı `icon-admin-*.png`, start_url `/admin`); `/magaza` → `manifest-magaza`; diğerleri `manifest-b2b`.

## 5. Veri modeli (Firestore)

| Koleksiyon / belge | İçerik |
|---|---|
| `catalog/*` | tam katalog, parçalar hâlinde (~1500 ürün/belge, açılışta 2-3 okuma); yalnız yönetici + bayi |
| `pubcatalog/*` | mağaza için herkese açık katalog (toptan fiyat yok) |
| `desc/*`, `img/*` | ürün açıklamaları, elle yüklenen ürün resimleri |
| `settings/main` + `settings/public` | tüm ayarlar; `public` herkese açık kopya (brand, shop, access, catalog, categories, gösterim fiyat alanları, orders, shopHome, brandLogos, `v`) |
| `users/{uid}` | bayi ve yönetici hesapları (rol, kademe, ek indirim, aktif/bekliyor) |
| `userPrices/{uid}`, `userNotes/{uid}` | bayiye özel fiyat ve notlar |
| `requests/{id}` + `messages` | bayi talepleri / sohbet |
| `orders/{id}` | mağaza siparişleri (durum, iletişim, teslimat, fatura, ödeme, kalemler, `total` {para birimi: tutar}) |
| `members/{uid}`, `usernames/{ad}` | mağaza üyeleri (ad, telefon, adresler, fatura; `byAdmin`) ve kullanıcı adı → e-posta |
| `shopimg/{id}` | mağaza ana sayfası resimleri (webp, Firestore'da; cihazda IndexedDB önbellek) |
| `meta/owner`, `meta/sync` | kurulum sahibi, son eşitleme |

Ürün alanları (kısa adlar): `id`, `k` stok kodu, `n` ad, `b` marka, `c`/`c2` kategori, `r` liste fiyatı, `w` ürüne özel toptan, `cur`, `s` stok, `a` aktif, `so` sitede yok (gizli), `pc` liste fiyatı değişti uyarısı, `nw` yeni, `pi`/`im` resim, `t` gizli etiketler, `u` site adresi.
Ayar göçü: `main.jsx` → `migrate()`, sürüm `settings.v` (şu an 5). Ayarlar her zaman `withDefaults()` ile varsayılanlarla derin birleştirilir.

## 6. Özellikler (bölüm bölüm)

### Fiyat
- **Liste fiyatı (r)** = sitedeki gerçek satış fiyatı: beslemede `sale_price` (indirimli) varsa o, yoksa `price`. Excel'de de "İndirimli Fiyat" → r.
- **Toptan** = ürüne özel `w` varsa o, yoksa liste fiyatından % indirim (`pricing.discountPct`, `utils.priceFor`). Bayiye kademe + ek indirim, en üstte bayiye özel fiyat. Mağaza ziyaretçisi (`role: 'public'`) her zaman liste fiyatını görür.
- KDV (`pricing.vatPct` / `showVat`) ürün fiyatına eklenmez; sadece toplamın altında bilgi satırı. TL karşılığı Harem Altın **dolar satış** kuru (ya da `pricing.manualRate`).

### Bayi tarafı (/b2b)
Katalog, sepet, talep gönderme ("hazırlayın geliyorum" / fiyat sorma), sohbet (Talepler). Bayi ana sayfası `settings.home`. Bayiler kendileri başvurabilir (`access.allowSignup`), yönetici onaylar.

### Online mağaza (/magaza)
- Üst menü: Ana sayfa, Tüm ürünler, **arama (büyüteç simgesi, `HeaderSearch`)**, sepet düğmesi (HeaderCart), Giriş yap. Sağ altta küçük sepet (CartBar). Menü adları bayiyle aynı (Ürünler, Sepet, Hesabım), ürün düğmesi "Sepete ekle".
- **Arama:** büyüteç → masaüstünde yerinde 320px kutu, telefonda üstte kutu. Yazdıkça ilk 6 ürün; ürüne basınca ürün penceresi (ProductSheet), yazı silinip kutu kapanır; Enter / "Tüm sonuçlar" → ürünler sayfası `catalogGo {q}`. Kutu boşken dışarıya dokununca kapanır. Açılış/kapanış animasyonlu; masaüstünde kapanırken kutu simge boyutuna iner, büyüteç kaybolmadan simgenin yerine kayar.
- **Ana sayfa** (`shophome.jsx`, `settings.shopHome`): büyük reklam alanı (kayan banner, temalar), avantaj şeridi, kayan marka şeridi, marka kutuları, kare reklam kutuları (sq/wide/tall/big), ürün rafları (yeni/marka/kategori/elle), başlık ve görsel bant blokları, alt WhatsApp bandı. Link biçimi: `brand:Ad`, `cat:3`, `q:kelime`, `p:ürünNo`, `https://…`.
  - Banner 6,5 sn'de bir geçer; fare üstündeyken durur, çekilince **kalan süreden** devam eder (ilerleme çizgisi de duraklar); telefonda (`TOUCH`) fare olayları yok sayılır (iOS dokunuşu mouseenter sayıp kilitliyordu); sadece parmak üstündeyken durur, bırakınca kalan süreden devam eder.
  - Marka kutuları durağanken nötr, üstüne gelince marka renginde ışık. Logolar/renkler/logo boyutu `settings.brandLogos` {Ad: {logo, color, scale}} (ad büyük/küçük harf duyarsız). Logolar `hosting/public/brands/` (markaların kendi sitelerinden; AmScope, Quick, RF4, Yihua, Uni-T dahil).
  - Kayan şerit stili `shopHome.marquee`: color (varsayılan) / dark / mono / off; hız `mqSpeed`. **Masaüstünde CSS animasyonu, telefonda (≤700px) rAF ile kendi kutusunda kayar ve parmakla kaydırılır** (eski dev CSS katmanı iPhone'da kaybolup titriyordu). iPhone `scrollLeft`'i tam piksele yuvarladığı için yavaşta takılıyordu: tam kısım `scrollLeft`, kesirli kısım iç kutuya `translate3d` (kullanıcı onayladı, telefonda böyle kalacak).
- **Tüm ürünler:** kutu (varsayılan, büyük resim) / satır görünümü (`cat-view`, cihazda). Filtre çipleri ×'li; seçili kategoride sonuç yoksa arama tüm ürünlere genişler.
- **Ürün penceresi:** resimler (tek resimli ürün de tam genişlik kare çerçevede, `.gal-single`; küçük resme basınca kayma bitene kadar `onScroll` seçimi değiştirmez — çerçeve titremesin; telefonda şerit dikey oynamaz ve açıklama baştan tam, "Devamını göster" yok), açıklama, adet, sepete ekle. Sepette ve sipariş/liste kâğıdında ürün adı → bu pencere, resim → büyük resim (PlatinMarket'e link YOK).
- **Ürün videosu (DENEME aşamasında):** ürün alanı `vd` (doğrudan .mp4 linki; Ürünü düzenle > "Video linki"). Galeride ikinci sayfa, `GalVideo` (catalog.jsx): tarayıcı düğmeleri yok, sayfası görünürken sessiz+döngülü oynar, dokununca durur, köşede ses düğmesi, altta ilerleme çizgisi; küçük resimde ▶. Deneme videosu Cloudflare bekçisinden: `worker/media/_m/*.mp4` (wrangler `[assets]`), `GET /v/<ad>` Range'li 206 döner (iPhone şartı). Kalıcı olursa R2'ye geçilecek (10 GB ücretsiz, çıkış ücretsiz). `pi`/`im` artık tam adres de olabilir (http… ya da /…).
- **Deneme ürünü:** id 9000001, `DENEME-01`, resimler `hosting/public/test/`, video `/v/deneme.mp4`. Actions "Deneme ürünü" (`test-product.yml`, `tools/test-product.mjs`): ekle / sil / kontrol. Kullanıcı beğenmezse: `sil` + video işi rafa.
- **Elle eklenen ürün:** `man: 1`, yeni ürün id'leri 9000000'dan başlar (siteden gelen id'lerle çakışmasın); eşitleme `man` ürünleri gizlemez.
- **Sipariş:** Sepet → "Sepeti onayla" → iletişim / teslimat (kargo, dükkândan) / fatura (bireysel, kurumsal) / ödeme (havale, kart linki, dükkânda) → `orders`. Belirgin "Sepete dön" düğmesi. Misafir de sipariş verir (bilgiler cihazda: `guest-checkout`, `my-orders`). Sepette ayrıca "WhatsApp'tan gönder" (doğrudan WhatsApp, ara sayfa yok) + liste linkini kopyala. "Çok yakında" anahtarları `orders.checkoutSoon` / `accountsSoon` (şu an kapalı; `?onizleme=1`).
- **Üyelik:** e-posta + şifre, ayrı Firebase örneği ('shop'; bayi/yönetici oturumunu etkilemez), e-posta doğrulamalı (doğrulamayan giremez), isteğe bağlı kullanıcı adıyla giriş. Yöneticinin açtığı üye `byAdmin: true` → doğrulama gerekmez.
- **Açılış ekranı** (`IntroSplash`): dükkân fotoğrafı `brand.splash` (/splash/dukkan.jpg), oturumda bir kez, en az `brand.splashSec` sn (varsayılan 1,4; Ayarlar > Genel > Görünme süresi) / en çok +3 sn, dokununca geçer; yönetim panelinde yok. Kapatma: Ayarlar > Genel > Açılış ekranı (`brand.splashOn`).
- **Gece modu:** marka kutuları ve şerit koyu zemin; koyu yazılı logolar `ShopImg` yüklenince tuvalle algılanır (`.ink`) ve gecede `invert + hue-rotate(180deg)` ile sadece koyu kısımlar açılır (renkler korunur).

### Yönetim paneli (/admin)
- **Ana sayfa (Genel bakış, `dashboard.jsx`):** hoş geldiniz bandı, dönem (bugün/hafta/ay): mağaza siparişi, satış tutarı (USD + ≈TL, önceki döneme göre %), ortalama sepet, yeni üye, bayi talebi; kısayollar; son 14 gün grafiği; çok satanlar; akış (sipariş + talep). İptaller satışa sayılmaz.
- **Talepler:** sağ tık / çoklu seçim / talep içinden silme. **Müşteriler (bayiler):** tamamen silinebilir (Auth hesabı kalır ama kayıt silindiği için giremez).
- **Siparişler:** durum serbest seçilir (Yeni, Onaylandı, Kargoda, Teslime hazır, Tamamlandı, İptal); "Kargoda"da firma listeden (`orders.cargoCompanies`) + takip no. "Seç" ile çoklu seçim + toplu silme. **Mağaza üyeleri** sekmesi: görüntüle, sil, yeni üye aç.
- **Sipariş formu** (`orderform.jsx`): ürün ara (liste + toptan görünür, eklenince liste fiyatı geçer), fiyat yaz, liste resmi (gerekirse birkaç resim, her biri ayrı "Kopyala") + fiyatlı link. Kaydedilmez, taslak cihazda. Arama sonuçları kendi kaydırmalı kutusunda; "Müşteriye gönder" sağ sütunda + başlıkta kısayol.
- **`/siparisformu`:** menüsüz tek sayfa sipariş formu, yönetici oturumunu kullanır (cihazda bir kez giriş), noindex, sitede linki yok.
- **Tasarım modu** (`designer.jsx`): mağaza ana sayfası düzenlenebilir hâlde çizilir (`DesignCtx`). Bölüm sırası `shopHome.layout` (hero, usps, marquee, brands, promos, `rail:<id>`, `b:<id>`, cta), gizliler `shopHome.hidden`, yeni bölümler `shopHome.blocks` {t:'head'|'banner'}. Masaüstü: kutuları/bölümleri sürükle, banner'ı alt kenardan boyutlandır (`heroH`), `brandSize` sm/md/lg, `brandLogoScale`, reklam içi öğeleri (logo/başlık/yazı/buton/görsel) taşı + döndür + 3B eğ (`slides[i].fx[el]` = {x,y,s,r,rx,ry}; telefonda konum `--fxk` ile küçülür), araç çubuğu bölümün sağ üstünde açık renkli küçük hap. Telefon (≤800px/dokunmatik): sürükleme kapalı, dokunma sadece seçer, alttaki koyu çubuktan (MobileBar) işlem. Taslak `store.designDraft`; Kaydet = `saveSettings` (Ayarlar'la aynı kayıt). Üst menüde yok; ana sayfa kısayolu ve Ayarlar'dan açılır.
- **Ayarlar:** açılır-kapanır bölümler (hepsi kapalı başlar), kaydet çubuğu altta. Mağaza ana sayfası düzenleyicisinde gruplar (Fold) ve satırlar (Rows) da kapalı başlar, sürükleyerek sıralanır. Markalar bölümü: logo, renk, logo boyutu.
- Excel içe aktarma (Ayarlar > Veri): ürün no ya da stok kodu eşleşirse günceller; **aynı stok koduyla ikinci ürün asla eklenmez** (`xlsx.js` mergeCatalog).
- Üst menü: mağaza adı hiç kısaltılmaz; dar ekranda pasif sekmeler sadece simge. Telefon alt menüsünde Müşteriler ve Tasarım yok.

## 7. Site eşitleme, Worker, bildirimler

- `tools/sync-platin.mjs` (Actions "Siteyle eşitle"): `https://www.ertelgsm.com/xml-cikti/gm` beslemesini okur. Fiyatlar TL; kur beslemeden hesaplanıp USD'ye çevrilir. Liste fiyatı değişince `pc` uyarısı koyar, toptana dokunmaz. Sitede olmayan ürünü `so=1` ile gizler. Beslemede stok adedi yok. **Siteye toplu istek atma (IP engeli yemiştik).**
- Cloudflare Worker `ertel-b2b-watch` (adresi `hosting/public/config.js` → `window.WATCH_URL`): dakikada bir beslemeyi kontrol eder, değişince eşitlemeyi tetikler. `GET /rate` Harem Altın dolar satış, `POST /check` (panel açılınca), `POST /sync` ("Şimdi eşitle").
- **Yeni sipariş bildirimi:** checkout → Worker `POST /notify {id}` → siparişi Firestore REST'ten okur (sahte bildirim gönderilemez), KV ile bir kez gönderir →
  - **Telegram** (secret `TELEGRAM_TOKEN`; alıcı sohbet KV `tg-chat`; panelde 6 haneli kodla `POST /tg-link`, sadece ilk bağlantı) — bağlı ve çalışıyor.
  - **E-posta** Resend (secret `RESEND_KEY`, `onboarding@resend.dev` → `NOTIFY_EMAIL`, HTML + "Siparişi panelde aç" düğmesi).
  - Ayarlar > Online mağaza > "Deneme bildirimi gönder" (`/notify-test`).
- Uygulama içi tarayıcılar (Telegram/WhatsApp/Instagram): Auth sadece `browserLocalPersistence` (IndexedDB yoklaması girişi kilitliyordu), Firestore orada `experimentalForceLongPolling`, SDK yükleme ve idb işlemlerinde zaman aşımı; yavaşlarsa 7 sn sonra "Safari'de aç" yönlendirmesi.
- Firebase SDK kendi sitemizden (`hosting/public/fb/`), yoksa gstatic'e düşer (telefon tarayıcılarının izleyici koruması gstatic'i geciktiriyordu).

## 8. Önemli kararlar (neden böyle)

- **Ücretsiz plan:** Firebase Spark kalacak (kullanıcının kartı/isteği yok). Resimler Firestore'da webp; dosya deposu yok. Arka plan işleri için ücretsiz Cloudflare Workers seçildi. PlatinMarket planında API yok → XML beslemesi + Worker.
- **Liste fiyatı = sitedeki gerçek satış fiyatı (indirimli varsa o)**, toptan bunun üstüne % indirim. 24.10.2026'da eski "indirimli = toptan (w)" kayıtları silindi (kullanıcı onayladı).
- **Vitrin listeleri veritabanına kaydedilmez** (her şey linkin içinde). Mağazadan talep/sohbet açılamaz, sadece sipariş.
- **Bildirim:** CallMeBot WhatsApp botu dolu olduğu için bırakıldı; FormSubmit Cloudflare'den "rate limit" verdiği için Resend'e geçildi; Telegram ana kanal.
- **`/siparisformu` tamamen şifresiz yapılmadı:** toptan fiyatlar Firestore'da yönetici yetkisiyle okunuyor; açık olsa fiyat listesi dışarı sızardı. Yerine cihazda bir kez giriş.
- **Telefonda dokunuş (sadece telefon):** iki parmakla/çift dokunuşla büyütme kapalı (viewport `maximum-scale=1` + `touch-action: pan-x pan-y` + iOS `gesturestart` engeli; büyük resim penceresi `.lb` hariç), yazı alanları en az 16px (iPhone odaklanınca yakınlaştırmasın), pencereler (Sheet) üstteki tutma çubuğundan ya da içerik en üstteyken aşağı çekilince kapanır (≤700px).
- **Telefon alt menüsü (`BotNav`, main.jsx):** iOS gibi basılı tutup sekmeler üstünde kaydırılır; seçili sekmenin küçük hapı (`.botnav-pill`, 52×30) hafif büyüyüp parmağı izler, bırakılan sekmeye yaylanarak oturup eski boyuna döner; tek dokunuşta da hap yeni sekmeye kayar. Kaydırırken hap DOM'a doğrudan yazılır (geçiş yok, birebir), dokunuşlar native non-passive dinleyicilerle; iPhone alt kenar hareketi `touchcancel` verirse son gösterilen sekmeye geçer (yukarı çekip bırakınca vazgeçer).
- **Telefonda yazı seçme / uzun basma** (`shop.touch`, Ayarlar > Online mağaza > Mobil dokunma seçenekleri): `select` smart (varsayılan; sadece `.pdesc-body`, `.o-card`, mesajlar, `.share-box`, `.pay-info`, `.sel-ok` seçilir) / none / all; `<html>` sınıfı `tsel-*`, `timg`. Resim/link basılı tutma menüsü (callout) kapalı (`imgMenu`). Uzun basınca (460 ms) sağ tık menüsü açılır: `setupLongPress` (main.jsx) sentetik `contextmenu` (`ev.lp`) gönderir, kart `.lp-press` ile içe göçer, menü telefonda alttan iOS tarzı `SheetMenu` (ui.jsx). Mağaza müşterisine boş yerde sayfa menüsü açılmaz; 'all' modunda uzun basma kapalı. iPhone parmak kalkınca "mouse" işaretli hayalet tıklama gönderir: `SheetMenu` sadece menünün üstünde YENİ bir touchstart'tan sonra tıklama kabul eder.
- **Telefonda dokunma hissi** (`setupPress`, main.jsx): kart/düğmeye basınca `.tp` (kart .975, düğme .94, iç gölge) en az 120 ms, bırakınca `.tp-rel` ile yaylanarak döner; CSS `:active` küçülmesi telefonda kapalı. Sipariş formu araması telefonda kendiliğinden odaklanmaz (klavye açılmasın).
- **Telefona özel düzenlemeler sadece telefonda** (≤700px): sayfa yana kaymaz (`overflow-x: clip`), kayan şerit kendi kutusunda kayar, beliren animasyonlar sade. Masaüstü eski davranışında kaldı (kullanıcı açıkça istedi).
- **Ürün sayfaları uygulama içinde açılır**, PlatinMarket sitesine yönlendirme yok.
- **Mağaza aramasında büyük blok ve "sık arananlar" istenmedi** → sadece üst menüde küçük büyüteç.
- **Sekmeler adreste** (pushState): telefonda geri kaydırma uygulama içinde kalsın, sayfa yeniden yüklenmesin.
- Yönetim panelinin ana ekran simgesi ayrı (lacivert + sarı kalkan) ki mağazadan ayırt edilsin.

## 9. Gizli ayarlar (GitHub Actions secrets) — değerlerini ASLA isteme/yazdırma

`FIREBASE_SERVICE_ACCOUNT`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GH_DISPATCH_TOKEN`, `TELEGRAM_TOKEN`, `RESEND_KEY`. Kullanıcı kendisi GitHub'a ekler; anahtarları sohbete yazmasını isteme.

## 10. Yarım kalan işler / açık konular

- [ ] **E-postalar spam'e düşüyor** (üyelik doğrulama, şifre sıfırlama, sipariş bildirimi). Spam'deki e-postada Gmail linkleri de kapatıyor. Kullanıcı "sonra dönücem" dedi. Seçenekler:
  - Kendi alan adı (ertelgsm.com DNS kayıtları → Firebase Auth özel alan adı + Resend alan doğrulama) — DNS'i kimin yönettiği soruldu, cevap bekleniyor.
  - Ya da bu iş için yeni bir Gmail hesabı + uygulama şifresiyle Firebase Auth > Templates > **SMTP ayarları** (smtp.gmail.com, 587, STARTTLS). Kurulumu kullanıcı Firebase konsolunda yapacak; şifreyi bize vermeyecek.
  - Kendi sipariş bildirimi için geçici çözüm: Gmail filtresi `from:onboarding@resend.dev` → "Asla spam'e gönderme".
- [ ] **Banner'da video:** Santral Center ile ortak paylaşılan Instagram reeli (dükkân çekimi). Orijinal dosya Santral Center'dan istenecek. Gelince: banner'a "Video" görünümü (sessiz, döngülü, kapak resmi) eklenecek. Barındırma: önce site dosyaları (Spark'ta günlük indirme sınırı ~360 MB'a dikkat), ziyaret artarsa Cloudflare R2. Henüz kod yazılmadı.
- [ ] **iyzico "link ile ödeme"** entegrasyonu (kullanıcı başvuracak). Sitede kart ödemesi şu an sadece Maximum kartla çalışıyor.
- [ ] Telefonda ürün penceresi açıkken geri kaydırınca pencere kapanmıyor, önceki sekmeye gidiyor (pencereler geçmişe eklenmedi).
- [ ] Logosu olmayan markalar: Fluke (sitede sadece ürün fotoğrafı), YCS, Ma Ant, Mijing, Kaisi, Sugon, XZZ, OSS Team, Mega-Idea… → adları marka renginde yazılıyor; kullanıcı Ayarlar > Markalar'dan ekleyebilir.
- [ ] Gece modunda Qianli'nin kırmızısı pembeye kayıyor (isterse o logoya ayrı ayar).
- [ ] Sipariş formu tablosunda uzun ürün adları dar sütunda çok satıra bölünüyor (sütun genişletilebilir).
- [ ] Ana ekrana ekleyen müşterilere **sipariş durumu bildirimi** (web push) önerildi; istenirse yapılacak.
- Fikir aşamasında (kod yok): uygulamayı başka sektörlere (ör. parfümcü) **şablon olarak satmak** — önerilen yol: mağazaya özel her şeyi tek "mağaza dosyasına" taşımak, tema paketleri, her müşteriye ayrı Firebase projesi + kurulum aracı. **Apple Developer** hesabı / App Store: şimdilik gerek görülmedi.
