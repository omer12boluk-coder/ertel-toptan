# ERTEL B2B — proje notları (Claude için)

Bayilere (toptancılara) özel katalog + talep/teklif uygulaması. Sahibi: ERTEL GSM (ertelgsm.com, PlatinMarket). Kullanıcıyla Türkçe konuş, teknik olmayan dille anlat.

## Yapı
- `src/` React (esbuild ile tek dosya). Giriş: `main.jsx`. Ekranlar: `catalog.jsx`, `cart.jsx`, `requests.jsx`, `admin.jsx`. Veri katmanı: `backend-firebase.js` (canlı) / `backend-demo.js` (demo). Adresler: `route.js`.
- `python3 tools/build.py` → `hosting/public/index.html` (+ DEMO.html). Derleme için node_modules'te react, react-dom, esbuild gerekir.
- Varsayılan ayarlar ve kategori isimleri: `src/config.js`. Firestore kuralları: `hosting/firestore.rules`.

## Yayın
- `main`'e push = GitHub Actions "Yayınla" → Firebase Hosting + kurallar (erteltoptan.web.app). Değişiklikten sonra build.py çalıştırıp çıktıyı da commit et.
- Firebase projesi `erteltoptan`, Spark (ücretsiz) plan. Kullanıcı Blaze istemiyor; Storage / Cloud Functions yok.
- Adresler: `/` giriş sayfası (Online mağaza / Bayi girişi), `/b2b` bayi uygulaması (ana sayfa + katalog…), `/admin` yönetim paneli (ayrı oturum), `/magaza` herkese açık vitrin (sadece ürünler + listem), `/magaza/t/<id>` vitrin listesi (tablo + PNG resim, `src/listsheet.jsx`), `/b2b/t/<id>` (eski `/t/<id>` de çalışır) ve `/admin/t/<id>` talep linkleri.
- Excel içe aktarma (Ayarlar > Veri): ürün no ya da stok kodu eşleşirse günceller; aynı stok koduyla ikinci ürün asla eklenmez (`src/xlsx.js` mergeCatalog).
- Bayi ana sayfası içeriği `settings.home` (Ayarlar > Bayi ana sayfası).

## Site eşitleme
- `tools/sync-platin.mjs` (Actions "Siteyle eşitle"): `https://www.ertelgsm.com/xml-cikti/gm` beslemesini okur. Fiyatlar TL; kur beslemeden hesaplanıp USD'ye çevrilir. Liste fiyatı değişince `pc` uyarısı koyar, toptana dokunmaz. Sitede olmayan ürünü `so=1` ile gizler.
- `worker/index.js` Cloudflare Worker "ertel-b2b-watch": dakikada bir beslemeyi kontrol eder, değişince sync'i tetikler (Actions "Bekçiyi yayınla" yükler). workers.dev adresi `hosting/public/config.js` → `window.WATCH_URL`: `GET /rate` Harem Altın dolar satış kuru, `POST /check` (panel açılınca), `POST /sync` ("Şimdi eşitle").
- Ürün adları `src/clean.js` ile temizlenir (Windows-1252 kalıntısı, &#..; kodları).
- Siteye toplu istek atma (IP engeli yemiştik). Beslemede stok adedi yok.

## Gizli ayarlar (GitHub Actions secrets) — değerlerini asla isteme/yazdırma
FIREBASE_SERVICE_ACCOUNT, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GH_DISPATCH_TOKEN.

## Açık konular
- iyzico "link ile ödeme" entegrasyonu (kullanıcı başvuracak).
- 142 üründe sitedeki indirimli fiyat toptan fiyat (w) olarak kullanılıyor; kullanıcıya teyit ettirilecek.
