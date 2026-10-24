# ERTEL B2B — proje notları (Claude için)

Bayilere (toptancılara) özel katalog + talep/teklif uygulaması. Sahibi: ERTEL GSM (ertelgsm.com, PlatinMarket). Kullanıcıyla Türkçe konuş, teknik olmayan dille anlat.

## Yapı
- `src/` React (esbuild ile tek dosya). Giriş: `main.jsx`. Ekranlar: `catalog.jsx`, `cart.jsx`, `requests.jsx`, `admin.jsx`. Veri katmanı: `backend-firebase.js` (canlı) / `backend-demo.js` (demo). Adresler: `route.js`.
- `python3 tools/build.py` → `hosting/public/index.html` (+ DEMO.html). Derleme için node_modules'te react, react-dom, esbuild gerekir.
- Varsayılan ayarlar ve kategori isimleri: `src/config.js`. Firestore kuralları: `hosting/firestore.rules`.

## Yayın
- `main`'e push = GitHub Actions "Yayınla" → Firebase Hosting + kurallar (erteltoptan.web.app). Değişiklikten sonra build.py çalıştırıp çıktıyı da commit et.
- Firebase projesi `erteltoptan`, Spark (ücretsiz) plan. Kullanıcı Blaze istemiyor; Storage / Cloud Functions yok.
- Adresler: `/` giriş sayfası (Online mağaza / Bayi girişi), `/b2b` bayi uygulaması (ana sayfa + katalog…), `/admin` yönetim paneli (ayrı oturum), `/magaza` online mağaza (ürünler, sepet, sipariş, Hesabım), `/magaza/l/<kod>` vitrin listesi: veritabanına KAYDEDİLMEZ, ürün/adet/fiyat linkin içinde (`src/listcode.js`); `/admin/l/<kod>` yönetici fiyatlar ve yeni link + PNG üretir (`src/listsheet.jsx`). Mağazadan talep (sohbet) oluşturulamaz; sadece sipariş (kurallar). Eski `/magaza/t/<id>` sadece görüntülenir, `/b2b/t/<id>` (eski `/t/<id>` de çalışır) ve `/admin/t/<id>` talep linkleri.
- Excel içe aktarma (Ayarlar > Veri): ürün no ya da stok kodu eşleşirse günceller; aynı stok koduyla ikinci ürün asla eklenmez (`src/xlsx.js` mergeCatalog).
- Yönetim paneli > Sipariş formu (`src/orderform.jsx`): yönetici ürün arayıp sepet yapar, fiyat yazar; liste resmi (gerekirse birkaç resim, her biri ayrı "Kopyala") + fiyatlı link. Kaydedilmez, taslak cihazda.
- KDV: `pricing.vatPct` / `pricing.showVat`; sadece toplamın altında bilgi. Herkese açık ayar kopyası (`settings/public`) gösterimle ilgili fiyat alanlarını da taşır.
- Bayi ana sayfası içeriği `settings.home` (Ayarlar > Bayi ana sayfası).
- Online mağaza siparişleri (`src/checkout.jsx`, yönetici: `src/orders.jsx`): /magaza'da Sepet → "Sepeti onayla" → iletişim / teslimat (kargo, dükkandan) / fatura (bireysel, kurumsal) / ödeme (havale, kart linki, dükkanda) → `orders` koleksiyonu → Yönetim paneli > Siparişler (durum: new → confirmed → shipped|ready → done, cancelled). Müşteri takip: /magaza/s/<id> (kimlik tahmin edilemez, herkes `get` edebilir, liste yok). Yönetici: /admin/s/<id>. Sepette ayrıca "WhatsApp'tan gönder" doğrudan WhatsApp'ı açar (ara sayfa yok) + yanında liste linkini kopyala (kaydedilmeyen link). Ayarlar > Online mağaza (`settings.orders`).
- Mağaza üyeliği: e-posta doğrulamalı (doğrulamayan giriş yapamaz), isteğe bağlı kullanıcı adıyla giriş (`usernames/{ad}` → e-posta). E-postadaki bağlantılar uygulama içi sayfada açılabilir: /magaza/islem (Firebase > Authentication > Templates > işlem URL'si). E-posta + şifre, ayrı Firebase örneği ('shop', bayi/yönetici oturumunu etkilemez), `members/{uid}` (ad, telefon, adresler, fatura). Misafir de sipariş verir; misafirin bilgileri o cihazda hatırlanır (`guest-checkout`, `my-orders`).
- Mağaza ana sayfası (`src/shophome.jsx`, `settings.shopHome`, Ayarlar > Mağaza ana sayfası): kayan büyük reklam alanı (temalar), avantaj şeridi, kayan marka şeridi + marka kare kutuları, bento kare reklam kutuları (sq/wide/tall/big), ürün rafları (yeni/marka/kategori/elle), alt WhatsApp bandı. Link biçimi: `brand:Ad`, `cat:3`, `q:kelime`, `p:ürünNo`, `https://…` → katalog `catalogGo` ile filtrelenir. Marka logoları hosting/public/brands/ (markaların sitelerinden; kutular marka rengiyle açık zemin). Resimler `shopimg/{id}` (Firestore, webp, cihazda IndexedDB önbellek); `settings/public` shopHome'u da taşır.
- Sepet ekranı mağaza ve bayi için ortak (`src/cart.jsx`); bayide son adım talep gönderme (sohbet Talepler'de). Menü adları iki tarafta aynı (Ürünler, Sepet, Hesabım), ürün düğmesi "Sepete ekle". Mağazada online sipariş ve üyelik açık ("Çok yakında" anahtarları settings.orders.checkoutSoon / accountsSoon; ?onizleme=1). Üst menüde ayrı sepet düğmesi (HeaderCart), sağ altta küçük sepet (CartBar). Uygulama adı ERTEL GSM, logo assets/logo-*.png (yeni ert mobile). Ayar göçü main.jsx migrate() `S.v`.
- Yönetici talepleri (sağ tık / çoklu seçim / talep içi) ve müşterileri tamamen silebilir (Firebase Auth hesabı silinmez, kayıt silindiği için giriş açılmaz).

- Marka logoları/renkleri: `settings.brandLogos` {Ad: {logo, color}} (Ayarlar > Markalar; ad büyük/küçük harf duyarsız eşleşir). Ana sayfa kutuları durağanken nötr, üstüne gelince marka renginde ışık. Kayan şerit stili `shopHome.marquee`: color (varsayılan, renkli logolar) / dark / mono / off. `settings/public` brandLogos'u da taşır.
- Tüm ürünler: kutu (varsayılan, büyük resim) / satır görünümü (`cat-view`, cihazda).
- Sipariş durumu yönetici tarafından serbest seçilir (Yeni…Tamamlandı, İptal); Kargoda seçilince kargo firması listeden (`settings.orders.cargoCompanies`, Ayarlar > Online mağaza) + takip no.
- Yeni sipariş bildirimi: checkout → Worker `POST /notify {id}` (siparişi Firestore REST'ten okur, KV ile tekrar göndermez) → e-posta FormSubmit (NOTIFY_EMAIL, ilk mesajda aktivasyon tıklanmalı) + WhatsApp CallMeBot (NOTIFY_WA + secret CALLMEBOT_KEY). Ayarlar > Online mağaza'da "Deneme bildirimi gönder" (`/notify-test`).
- Yönetici mağaza üyesi açabilir/görebilir/silebilir (Siparişler > Mağaza üyeleri). Panelden açılan üye `byAdmin: true` → e-posta doğrulaması gerekmez.

## Site eşitleme
- `tools/sync-platin.mjs` (Actions "Siteyle eşitle"): `https://www.ertelgsm.com/xml-cikti/gm` beslemesini okur. Fiyatlar TL; kur beslemeden hesaplanıp USD'ye çevrilir. Liste fiyatı (r) = sitedeki gerçek satış fiyatı: `sale_price` (indirimli) varsa o, yoksa `price` (Excel'de de "İndirimli Fiyat" → r). Toptan = ürüne özel w yoksa r'den % indirim (utils priceFor). 24.10.2026'da eski "indirimli = w" kayıtları temizlendi. Liste fiyatı değişince `pc` uyarısı koyar, toptana dokunmaz. Sipariş formu: arama listesinde liste + toptan görünür, eklenince liste fiyatı (r) geçer. Sitede olmayan ürünü `so=1` ile gizler.
- `worker/index.js` Cloudflare Worker "ertel-b2b-watch": dakikada bir beslemeyi kontrol eder, değişince sync'i tetikler (Actions "Bekçiyi yayınla" yükler). workers.dev adresi `hosting/public/config.js` → `window.WATCH_URL`: `GET /rate` Harem Altın dolar satış kuru, `POST /check` (panel açılınca), `POST /sync` ("Şimdi eşitle").
- Firebase SDK kendi sitemizden: hosting/public/fb/ (Actions "Firebase kütüphanesini siteye kopyala"); telefon tarayıcılarının izleyici koruması gstatic'i geciktiriyordu. Yoksa gstatic'e düşer.
- Ürün adları `src/clean.js` ile temizlenir (Windows-1252 kalıntısı, &#..; kodları).
- Siteye toplu istek atma (IP engeli yemiştik). Beslemede stok adedi yok.

## Gizli ayarlar (GitHub Actions secrets) — değerlerini asla isteme/yazdırma
FIREBASE_SERVICE_ACCOUNT, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GH_DISPATCH_TOKEN, CALLMEBOT_KEY (WhatsApp bildirimi; kullanıcı ekler).

## Açık konular
- iyzico "link ile ödeme" entegrasyonu (kullanıcı başvuracak).
- Beslemede her üründe g:price (üstü çizili) + g:sale_price (gerçek satış) var; uygulama sale_price'ı liste fiyatı alır. 24.10.2026'da eski "indirimli = toptan (w)" kayıtları silindi (kullanıcı onayladı), toptan artık % kuralıyla.
