# Eski çekirdek bölümler (0–5, 8) — 5.11.2026 öncesi metin, AYNEN

> Güncel hâli CLAUDE.md'de. Burada eski ayrıntılar (tam klasör listesi, adres ve veri modeli açıklamaları) duruyor.

## 0. ÇALIŞMA DÜZENİ — HER SOHBETTE ÖNCE OKU (30.10.2026, kullanıcı istedi)

- **İşe başlamadan `git pull`.** Eski kopyadan derleyip yayınlamak, sunucu tarafı siparişten önceki sürümü geri getirir → kurallar kapalı olduğu için müşteriler SİPARİŞ VEREMEZ.
- **`main` = canlı site** (push = otomatik yayın). Ön yüz / tasarım işleri burada yapılır, her zamanki gibi.
- **`gelistirme` dalı = bekleyen arka plan işleri. DOKUNMA, `main`'e BİRLEŞTİRME, üstüne yazma.** İçinde (hepsi hazır, YAYINLANMADI):
  1. ~~Resimlerin bekçisiz Cloudflare R2 adresinden verilmesi~~ → **30.10.2026 gece resim.ertelmarket.com ile main'e alındı ve yayınlandı** (aşağıdaki madde). Eski not: (`IMG_BASE` / `IMG_PLATIN` anahtarı + otomatik eski adres yedeği). 7.242 büyük + 7.242 küçük resim R2'de hazır. **Alan adı kararı bekliyor** — ayrıntı o daldaki CLAUDE.md'de ("Resim adresi hazırlığı", "Alan adı kararı BEKLİYOR").
  2. ~~Bekçi KV dayanıklılığı~~ → **30.10.2026 akşam main'e alındı ve yayınlandı** (sadece worker/index.js: `safeEnv` KV put/delete hatasını yutar → günlük 1.000 yazma dolsa da sipariş/bildirim durmaz; bekçinin yazdığı siparişte `n:` yazılmaz (`notifyOrder(env, id, true)`), `sa-tok` bellekte `saMem`). gelistirme dalındaki aynı commit (bd555a9) artık main'de de var; dal main'e taşınırken çakışırsa main'deki hâli esas.
  3. Gece veri yedeği işi (`yedek.yml`; ilk elle yedek alındı → R2 kapalı kutu `ertel-yedek`).
  Kullanıcı "alan adı / resim adresi işine dönelim" dediğinde bu işler `gelistirme`'den devam eder: dal `main`'in son hâlinin üstüne taşınır, Actions'ta derlenir, önizleme adresinde kullanıcı dener, onaylarsa yayınlanır.
- **Resimler resim.ertelmarket.com'dan — 30.10.2026 ~22:20 YAYINLANDI** (`resim-adresi` dalı main'e alındı). `config.js`: `IMG_BASE = "https://resim.ertelmarket.com/"`, `IMG_PLATIN = true`. GERİ ALMA (birkaç dk): `IMG_BASE = ""`, `IMG_PLATIN = false` → main'e push (derleme gerekmez, config.js ayrı dosya). Yeni adreste olmayan resim eski adresten gelir: `setupMediaFallback` olaya `_fb` koyar, bileşen onError'ları `fbSkip(e)` ile bunu bozuk saymaz. Ürün sayfası galerisi: küçük resim `.gal-open` arka planında, büyük `.gal-big` yüklenince opacity ile biner. Yeni ürün resimleri: `r2-new.yml` ("Siteyle eşitle" bitince workflow_run + gece 01:23 UTC) → `r2-mirror.mjs` + `r2-thumbs.mjs` (sadece eksikler). ertelmarket.com Cloudflare Registrar'da (kullanıcının); R2 `ertel` özel alan adı `resim.ertelmarket.com` + CORS (r2-domain işi). R2 Public Development URL (r2.dev) bir süre AÇIK kalsın. Kullanıcıya önerildi (yapıp yapmadığı bilinmiyor): Cache Rule (resim.ertelmarket.com, Edge 1 ay, Browser 1 yıl) + Smart Tiered Cache. Ana domain ertelmarket.com → Firebase Hosting özel alan adı (A 199.36.158.100 + TXT hosting-site=erteltoptan, DNS only) Firebase doğrulaması/SSL bekliyordu. `preview.yml`: `resim-adresi` dalına push → Firebase önizleme kanalı `resim` (canlıya dokunmaz; ileride önizleme için bu dal kullanılabilir).
- **Platin'den kopma (30.10.2026 gece YAYINDA):** Platin sadece veri girişi. `tools/platin-free.mjs` kayıtlardaki (settings/app+public, catalog, pubcatalog, desc→descb) tüm platincdn.com / ertelgsm.com DOSYA adreslerini R2'ye kopyalayıp resim.ertelmarket.com'a çevirir: `pictures/<f>`→`platin/<f>`, `pictures/thumb/350X-<f>`→`platin/t/<f>`, diğer `3519/<yol>`→`platin/s/<yol>`, ertelgsm.com dosyaları→`platin/w/<yol>` (bekçi /r2obj/ sadece platin/ yazar). Varlık: `platin/_manifest.json`, `platin/t/_manifest.json`, `platin/_free.json`. Kopyalanamayan adres değiştirilmez. Açıklama/ayarlardaki Platin ürün sayfası linkleri (`…-pmu<no>`) → `/magaza/urun/<no>` (katalogdaki `u` alanı DEĞİL). Ayar şablonları imageLarge/imageThumb → `https://resim.ertelmarket.com/platin/{pi}` / `platin/t/{pi}` (utils `ownTpl` ile dosya adı kodlanır). Otomatik: `r2-new.yml` son adımı (eşitleme sonrası + gece). Elle: Actions "Platin adreslerini çevir" (apply kapalı = rapor). İlk çalışma: 1.023 dosya (150 MB), 603 ürün açıklaması + 2 ayar belgesi çevrildi; 6 açıklama resmi Platin'de de 404. Önce yedek alındı: `ertel-yedek/db/2026-10-30_2243.tar.gz` (Actions "Veri yedeği", elle). Hâlâ Platin'e bağlı: ürünlerin `u` (Platin sayfa yolu) + "Sitede aç" menüsü (catalog.jsx links.product), eşitleme (XML).
- **Canlının yedeği:** `canli-30-10-2026` dalı (30.10.2026 çalışan sürüm). Veri yedeği R2 `ertel-yedek` kutusunda.
- **Aynı anda iki sohbet yayın yapmasın.**

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
  footer.jsx        mağaza alt bilgisi (ShopFooter) + bilgi sayfaları (RichText)
  push.js           müşteriye sipariş durumu bildirimi (web push) — abonelik, izin, durum değişince bekçiye haber
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
.github/workflows/  deploy.yml, sync.yml, worker.yml, vendor-firebase.yml, brand-assets.yml, kalip-phones.yml
KURULUM.md  kullanıcıya yönelik kurulum anlatımı · README.md kısa tanıtım
```

## 3. Derleme, yayın, test

- Değişiklikten sonra **`python3 tools/build.py`** çalıştır ve çıktıyı (`hosting/public/index.html`, `DEMO.html`, `version.json`) da commit et.
- **`main`'e push = otomatik yayın.** GitHub Actions:
  - **Yayınla** (`deploy.yml`): Firebase Hosting + Firestore kuralları.
  - **Bekçiyi yayınla** (`worker.yml`): Cloudflare Worker'ı yükler, gizli ayarları (TELEGRAM_TOKEN, RESEND_KEY, GH_TOKEN) Worker'a koyar; `worker/`, `wrangler.toml` değişince kendiliğinden çalışır.
  - **Siteyle eşitle** (`sync.yml`): PlatinMarket beslemesini okuyup katalogu günceller (Worker tetikler).
  - **Firebase kütüphanesini siteye kopyala** (`vendor-firebase.yml`), **Marka logolarını getir** (`brand-assets.yml`, sonucu `brand-assets` dalına yazar).
  - **Kalıp telefon listesi** (`kalip-phones.yml`): ayda bir kalıp bulucunun telefon listesini günceller (aşağıda "Kalıp telefon listesini güncelle").
  - Elle çalıştırma: `gh workflow run <dosya>.yml --ref main`.
- Commit mesajları Türkçe; yayından sonra `gh run list` ile bitmesini bekle, gerekirse canlıyı tarayıcıda kontrol et.
- **Test:** Konteynerden canlı siteye/Firebase'e erişilemez. Deneme sunucusu `/tmp/claude-0/web/serve.py` (port 8765, her adrese DEMO.html, `/brands/` ve `/splash/` dosyalarını verir) + Playwright (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Demo girişleri: yönetici `admin/admin`, bayi `ahmet/1234`. Telefon için 390×844 + `is_mobile/has_touch`.

## 4. Adresler

- **KISA ADRES (31.10.2026, kullanıcı isteği):** giriş sayfası (Landing) KALKTI, `/` = mağaza ana sayfası. Mağaza adresleri `/magaza`'sız: `/urunler`, `/sepet`, `/hesap/…`, `/urun/<no>`, `/kalip`, `/talep`, `/sorun`, `/yasal/<slug>`, `/s/<id>`, `/l/<kod>`, `/k/<id>`, `/islem`. Kodun içi hâlâ `/magaza/…` MANTIKSAL adresle çalışır: `route.js` `lpath()` (fiziksel adres + /magaza öneki; /admin, /b2b, /siparisformu, /t/ hariç) — adres OKUYAN her yer `location.pathname` yerine `lpath()` kullanmalı; `history.pushState/replaceState` sarılı (`toShort`) → '/magaza/…' verilse de kısa yazılır; eski `/magaza/…` linkleri açılınca kısa adrese çevrilir (eski `/magaza/t/<no>` hariç). Müşteriye giden linkler (paylaş, sipariş, sepet linki, bekçi push linkleri) kısa. Manifest: /admin|/siparisformu → admin, /b2b|/t → b2b, gerisi mağaza (start_url `/`, id `/magaza` kaldı). **Giriş kutusu (`AuthForm`, 31.10.2026 2):** sekme YOK (kullanıcı: Bayi girişi sekmesi 'toptan fiyat' diye göze batıyordu + sekme şeridinde kaydırma okları çıkıyordu); başlık (Giriş yapın / Üye olun / Bayi girişi), altta 'Hesabınız yok mu? Üye olun' / 'Zaten hesabınız var mı? Giriş yapın', en altta soluk küçük 'Bayi girişi' (`.auth-bayi`, sadece Hesabım sayfasında; view 'bayi' → `bayiLogin`: varsayılan Firebase örneğiyle giriş → `/b2b`). 'Üye olmadan da sipariş verebilirsiniz' yazısı kaldırıldı. Görünüm geçişi `.auth-view.fwd/.back` (14px kayma + soluş, .26s). **Google / Facebook ile giriş:** `memberSocial(kind, legal)` (signInWithPopup, ilk girişte `members` kaydı; sosyal girişli üye e-posta doğrulaması beklemez: onMember `providerData`, kural `sign_in_provider`, bekçi preq/issue kontrolü), düğmeler sadece `orders.loginGoogle` / `orders.loginFacebook` açıksa (Ayarlar > Online mağaza; varsayılan KAPALI — önce Firebase > Authentication > Sign-in method'da sağlayıcı açılmalı; Facebook için Meta geliştirici uygulaması + App ID/Secret + OAuth yönlendirme adresi). Altında 'devam ederek üyelik sözleşmesini kabul…' notu. Hatalar (31.10): `initializeAuth` kullandığımız için `signInWithPopup`'a `browserPopupRedirectResolver` verilmeli (yoksa auth/argument-error); Safari pencereyi engellemesin diye giriş kutusu açılınca `prepSocial()` (getRedirectResult ile pencere bağlantısı önceden kurulur). Popup yine engellendi → YAPILDI (31.10): `site/worker.js` (wrangler `main`, `run_worker_first = ["/__/*"]`) /__/auth/* ve /__/firebase/* → erteltoptan.firebaseapp.com vekili; `config.js` authDomain ertelmarket.com'da sitenin kendi adı; telefonda (`pointer: coarse` / standalone) `signInWithRedirect` (sessionStorage `social-pending` {kind, legal} → dönüşte `onMember` içinde `_finishSocial`: getRedirectResult + `_ensureMember` + `onSocialDone` toast), bilgisayarda popup. Google Cloud > Credentials > Web client'a yönlendirme adresleri https://ertelmarket.com/__/auth/handler + www eklenmeli (kullanıcı yapacak). AYRICA: site/wrangler.toml'da `routes` `[assets]`'in altındaydı → [assets]'e ait sayılıp yok sayılıyordu (alan adı kopmasının muhtemel sebebi), üste alındı. Facebook: kullanıcının Meta doğrulama SMS'i gelmedi, ERTELENDİ. Telefonla (SMS) giriş RAFA KALDIRILDI (kullanıcı 31.10; öneri: Netgsm OTP + bekçi custom token, Firebase SMS'i Blaze ister).; bayi üst menüsünde mağazaya dönüş simgesi. `/b2b` (bayi uygulaması) ve `/admin` (yönetim) aynen.
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
Ayar göçü: `main.jsx` → `migrate()`, sürüm `settings.v` (şu an 6). Ayarlar her zaman `withDefaults()` ile varsayılanlarla derin birleştirilir.


## 8. Önemli kararlar (neden böyle)

- **Ücretsiz plan:** Firebase Spark kalacak (kullanıcının kartı/isteği yok). Resimler Firestore'da webp; dosya deposu yok. Arka plan işleri için ücretsiz Cloudflare Workers seçildi. PlatinMarket planında API yok → XML beslemesi + Worker.
- **Liste fiyatı = sitedeki gerçek satış fiyatı (indirimli varsa o)**, toptan bunun üstüne % indirim. 24.10.2026'da eski "indirimli = toptan (w)" kayıtları silindi (kullanıcı onayladı).
- **Vitrin listeleri veritabanına kaydedilmez** (her şey linkin içinde). Mağazadan talep/sohbet açılamaz, sadece sipariş.
- **Bildirim:** CallMeBot WhatsApp botu dolu olduğu için bırakıldı; FormSubmit Cloudflare'den "rate limit" verdiği için Resend'e geçildi; Telegram ana kanal.
- **`/siparisformu` tamamen şifresiz yapılmadı:** toptan fiyatlar Firestore'da yönetici yetkisiyle okunuyor; açık olsa fiyat listesi dışarı sızardı. Yerine cihazda bir kez giriş.
- **Telefonda dokunuş (sadece telefon):** iki parmakla/çift dokunuşla büyütme kapalı (viewport `maximum-scale=1` + `touch-action: pan-x pan-y` + iOS `gesturestart` engeli; büyük resim penceresi `.lb` hariç), yazı alanları en az 16px (iPhone odaklanınca yakınlaştırmasın), pencereler (Sheet) üstteki tutma çubuğundan ya da içerik en üstteyken aşağı çekilince kapanır (≤700px); pencere açıkken arka sayfa SABİTLENMEZ (body position:fixed iPhone'da arka planı bir an boş gösteriyordu; body overflow:hidden de html `overflow-x: clip` ile sayfayı en üste atıyordu → dokunmatikte `noscroll` etkisiz). Onun yerine ui.jsx'te global touchmove süzgeci: pencere içinde sadece kayabilen kutu kayabildiği yöne kayar (yana kayan şeritler serbest), kenarda/başlıkta/arka planda hareket engellenir.
- **Telefon alt menüsü (`BotNav`, main.jsx):** iOS gibi basılı tutup sekmeler üstünde kaydırılır; seçili sekmenin küçük hapı (`.botnav-pill`, 52×30) hafif büyüyüp parmağı izler, bırakılan sekmeye yaylanarak oturup eski boyuna döner; tek dokunuşta da hap yeni sekmeye kayar. Kaydırırken hap DOM'a doğrudan yazılır (geçiş yok, birebir), dokunuşlar native non-passive dinleyicilerle; iPhone alt kenar hareketi `touchcancel` verirse SADECE parmak sekmeler üstünde gezinmişse son gösterilen sekmeye geçer; menünün alt boşluğundan (ana ekran çizgisi) başlayan dokunuş yok sayılır (31.10.2026 HATA: uygulamadan çıkarken/uygulama değiştiriciye geçerken ortadaki sekmeye — Sepet/Kalıp, yönetimde Ürünler — geçiyordu, 'hep sepetten açılıyor' şikâyetinin asıl sebebi). Yukarı çekip bırakınca vazgeçer.
- **Telefonda yazı seçme / uzun basma** (`shop.touch`, Ayarlar > Online mağaza > Mobil dokunma seçenekleri): `select` smart (varsayılan; sadece `.pdesc-body`, `.o-card`, mesajlar, `.share-box`, `.pay-info`, `.sel-ok` seçilir) / none / all; `<html>` sınıfı `tsel-*`, `timg`. Resim/link basılı tutma menüsü (callout) kapalı (`imgMenu`). Uzun basınca (460 ms) sağ tık menüsü açılır: `setupLongPress` (main.jsx) sentetik `contextmenu` (`ev.lp`) gönderir, kart `.lp-press` ile içe göçer, menü telefonda alttan iOS tarzı `SheetMenu` (ui.jsx). Mağaza müşterisine boş yerde sayfa menüsü açılmaz; 'all' modunda uzun basma kapalı. iPhone parmak kalkınca "mouse" işaretli hayalet tıklama gönderir: `SheetMenu` sadece menünün üstünde YENİ bir touchstart'tan sonra tıklama kabul eder.
- **Telefonda dokunma hissi** (`setupPress`, main.jsx): kart/düğmeye basınca `.tp` (kart .975, düğme .94, iç gölge) en az 120 ms, bırakınca `.tp-rel` ile yaylanarak döner; CSS `:active` küçülmesi telefonda kapalı. Sipariş formu araması telefonda kendiliğinden odaklanmaz (klavye açılmasın).
- **Telefona özel düzenlemeler sadece telefonda** (≤700px): sayfa yana kaymaz (`overflow-x: clip`), kayan şerit kendi kutusunda kayar, beliren animasyonlar sade. Masaüstü eski davranışında kaldı (kullanıcı açıkça istedi).
- **Ürün sayfaları uygulama içinde açılır**, PlatinMarket sitesine yönlendirme yok.
- **Mağaza aramasında büyük blok ve "sık arananlar" istenmedi** → sadece üst menüde küçük büyüteç.
- **Sekmeler adreste** (pushState): telefonda geri kaydırma uygulama içinde kalsın, sayfa yeniden yüklenmesin.
- Yönetim panelinin ana ekran simgesi ayrı (lacivert + sarı kalkan) ki mağazadan ayırt edilsin.

## 9. Gizli ayarlar (GitHub Actions secrets) — değerlerini ASLA isteme/yazdırma

`FIREBASE_SERVICE_ACCOUNT`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GH_DISPATCH_TOKEN`, `TELEGRAM_TOKEN`, `RESEND_KEY`. Kullanıcı kendisi GitHub'a ekler; anahtarları sohbete yazmasını isteme.

