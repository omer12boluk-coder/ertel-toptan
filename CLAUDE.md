# ERTEL GSM — B2B katalog + online mağaza (Claude için proje notları)

Telefon tamir ekipmanı satan ERTEL GSM'in (Tahtakale/İstanbul) uygulaması. Üç bölüm: **bayilere özel katalog + sipariş/talep** (`/b2b`), **herkese açık online mağaza** (`/`) ve **yönetim paneli** (`/admin`). Canlı: **https://ertelmarket.com** (Cloudflare Workers `ertel-site`) + eski adres https://erteltoptan.web.app (Firebase Hosting, aynı kod, ertelmarket.com'a yönlendirir).

**Kullanıcıyla Türkçe konuş, teknik olmayan dille, kısa ve net anlat; tek seferde tek konu.** Kullanıcı tasarıma çok önem veriyor, küçük görsel kusurları fark eder.

> **Bu dosya nasıl kullanılır (5.11.2026 düzenlemesi):** Burada kurallar, dersler, güncel durum ve "hangi konu nerede" dizini var. Ayrıntı ve tarihçe `docs/` altında (eski CLAUDE.md'nin tamamı, aynen). Bir özelliğe dokunmadan önce **§12 Konu dizini**'nden dosyayı bul, **önce `Grep` ile anahtar kelimeyi (ayar adı, bileşen adı, sınıf adı) ara**, sadece ilgili paragrafı oku; dosyayı baştan sona okuma. Kod ile not çelişirse kod doğrudur; not eski olabilir.
> **Bakım kuralı:** iş bitince buraya en çok 1–3 satır yaz (yeni ayar adı, yeni kural/ders, yapılacaklar değişikliği). Ayrıntılı anlatımı ilgili `docs/` dosyasının sonuna tarihli ekle. Buraya uzun günlük paragrafı YAZMA.

---

## 0. HIZLI İŞLER — önce buraya bak (7.11.2026)

Kullanıcı kısa bir komut verirse (banner ekle, Keşfet'e kutu ekle, ürün ekle…) **bütün repoyu okuma**: aşağıdan tarifi bul,
sadece o tarifi + adı geçen veri dosyasını aç. Bölümün ekrandaki adı değişmiş olabilir → `claude/bolumler.json` `adlar`
listesinde ara (yeni ad duyarsan listeye ekle); bulamazsan TEK soru sor ("Ana sayfada banner'ın altındaki kutular mı?").

| Kullanıcı der ki | Tarif | Değişen dosya |
|---|---|---|
| "… geldi, banner ekle" / banner değiştir | `claude/is/banner-ekle.md` | `src/icerik/bannerlar.json` + `hosting/public/bn/` |
| "Keşfet'e / Atölyen için'e / tezgâha kutu ekle" | `claude/is/kesfet-ekle.md` | `src/icerik/kesfet.json` + `bn/ad-*.webp` |
| "… kaldır / kapat / başa al" | `claude/is/sirala-kapat.md` | ilgili `src/icerik/*.json` |
| "yeni gelenlere koy / masamızdan'a ekle" | `claude/is/yeni-gelen.md` | (canlı ayar — çoğu zaman iş yok) |
| "kategori kapağı yap / değiştir" | `claude/is/kapak.md` | `src/icerik/kapaklar.json` + `bn/cat-*.webp` |
| "… geliyor, ürünü ekle" | `claude/is/urun-ekle.md` | `gelen/urun/*.json` → **`gelen` dalı** (main değil) → panel 'Claude’dan gelenler' |

- Varsayılan: önce göster (ekran görüntüsü / önizleme), "direkt yayınla" denirse `main`'e push.
- Canlı veriye / resimlere konteynerden erişim yok → Actions **'Claude için getir'** (`claude-al.yml`: güncel katalog özeti + resimler → `claude-al` dalı).
- Resim araçları `tools/banner/` (`cut.py` kesim, `defringe.py` koyu zemin, `kapak.py` Keşfet/kapak zemini). Tasarım kuralları `docs/banner-kurallari.md`.
- **Yeni tür bölüm / yeni tasarım rutin iş DEĞİL:** sunum → önizleme → yayın.
- Okunmayacak büyük dosyalar (sadece ara): `DEMO.html`, `hosting/public/index.html`, `dist/`, `src/products.json`, `src/descs.json`, `src/style.css` (Grep ile).

## 1. ÇALIŞMA DÜZENİ (her sohbette)

- **İşe başlamadan `git pull`.** Eski kopyadan derleyip yayınlamak sunucu tarafı siparişten önceki sürümü geri getirir → müşteriler sipariş veremez.
- **`main` = canlı site.** `main`'e push = otomatik yayın (Firebase Hosting + Cloudflare site + gerekirse bekçi). Push öncesi kullanıcı onayı: kullanıcı "pushla / yayınla / direkt yayınla" demediyse önce demo/önizleme göster.
- **Aynı anda iki sohbet yayın yapmasın.**
- **`gelistirme` dalı: DOKUNMA, `main`'e birleştirme.** (İçindeki işlerin çoğu artık main'de; kalanlar için `docs/eski-cekirdek.md` §0.)
- Değişiklikten sonra **`python3 tools/build.py`** → çıktıyı da commit et (`hosting/public/index.html`, `DEMO.html`, `version.json`, `dist/artifact.html`). Yayından sonra `gh run list` ile işlerin bitmesini bekle.
- Commit mesajları Türkçe.
- **Claude DNS / alan adı değiştirmez** (oturum kuralı) → kullanıcı Actions'tan çalıştırır (ör. "Alan adı bağlantısı" `cf-domain.yml`).
- **Gizli ayarların değerlerini ASLA isteme/yazdırma:** `FIREBASE_SERVICE_ACCOUNT`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GH_DISPATCH_TOKEN`, `TELEGRAM_TOKEN`, `RESEND_KEY`, `DHL_USER`, `DHL_PASS`. Kullanıcı kendisi GitHub'a ekler.
- Konteynerden canlı siteye / Firebase'e / bekçiye erişim yok; Actions günlükleri (blob) de okunamıyor → çıktıyı `::notice` notlarıyla yaz, `gh api repos/omer12boluk-coder/ertel-toptan/check-runs/<job>/annotations` ile oku. Okuma amaçlı teşhis işleri: `dhl-probe.yml`, `cap-probe.yml`, `push-probe.yml`, `cf-usage.yml`.
- Konteynerde esbuild/npm kayıt sitesi yoksa derleme Actions'ta yapılır.

## 2. KULLANICININ KURALLARI VE DERSLER (bunları çiğneme)

**Genel çalışma biçimi**
- Çok isteği tek mesajda (bazen .docx/.txt) gönderir → görev listesine böl, sırayla yap, grup bitince derle + yayınla (onay varsa), madde madde kısa anlat. Yarım iş bırakma; kullanım hakkı azalınca "en son deploy et, sorunlu kalmasın" der.
- Tasarım isteğinde ne kastettiği net değilse **SOR** (ör. 'basık' = arama satırı ile Tarih/Seç düğmelerinin dip dibe olmasıydı, sayfa tasarımı değil). Kullanılabilirliği bozan yorumda (düğmeyi gizlemek vb.) önce mantığını tart.
- Bir ekran için istenen değişikliği başka ekranlara (telefon → masaüstü) **yayma**; yayman gerekiyorsa önce söyle. Telefona özel düzenlemeler sadece telefonda (≤700px).
- Ara çözüm yerine **"zaten iyi çalışan yerden kopya çek"** tercih eder (ör. linkle gelen sipariş açılışı = mağaza siparişinin birebir kopyası; sepetler listesi = sipariş tablosunun aynısı, eski `ofs-list` görünümüne DÖNME).
- Yeni seçenekler eklerken **eski hâle dönüş hep açık** olsun (ayar anahtarı, varsayılan = kullanıcının seçtiği).
- Sunum isterse artifact sunumu hazırla, kararı ona bırak.

**Tasarım kararları (kesin)**
- **MOR YOK** (5.11.2026): seçili hap/yazı tema rengi (`--lg-pill` = accent karışımı), cam nötr beyaz/gri (Beymen tarzı).
- Apple açık temada **sepete ekle siyah DEĞİL** → ana renk tonlu açık düğme. Kart düğmesi telefon + bilgisayarda yazılı **'Sepete ekle'** tam genişlik 38px = − 1 + ile aynı boy (simgeli/yazısız düğme reddedildi).
- Kartlarda / kategorilerde / sepete ekle düğmesinde **liquid glass YOK** (performans + kullanıcı istemedi). backdrop-filter sadece menüler/şeritler.
- Üst menü alt satırında **kategori YOK**: Ana sayfa, Ürünler ▾, Kalıp bulucu, Markalar ▾, Setler — ortalı. Telefonda sadece yüzen cam üst menü.
- 'Haber ver' düğmesi sepet düğmesinin YERİNDE ve BOYUNDA; başka satıra / fiyatın altına TAŞIMA.
- Sonuç ekranlarına yazılı vurgu (yeşil şerit, "Uyumlu" rozeti) koyma — kalıp bulucuda reddedildi.
- **Ürün talebi / Sorun bildir üst menüye KONMAYACAK** (alt bilgide var).
- "Çok satanlar" sıralaması/rozeti istenmedi. Elde kalan malı "çok satılan" gibi göstermek yanıltıcı (6502) → yapma; dürüst seçenekler sunuldu (karar bekliyor).
- Telefonda basma animasyonları ve ana sayfa dokunma efektleri KAPALI (App Store'a geçene kadar geri ekleme). Tek istisna: öne çıkan ürün kutusunda eğik resmin düzelmesi.
- Saat/şarj şeridini (iPhone çentik) boyama denendi, kaldırıldı — dokunma.
- Açılış ekranı fotoğrafsız (`.intro2`), fotoğraf geri gelmesin.
- **STANDART GERİ DÜĞMESİ:** mağaza + bayi tarafındaki tüm geri düğmeleri `className="back-btn"` + `<Icon n="back" s={16} />` + kısa yazı. Yeni sayfada da sadece bu.
- **Yönetim sayfa düzeni:** her sayfa `PageHead` (ui.jsx; 'Yeni …' düğmesi HER ZAMAN en sağda `ph-new`, ikincil `ph-sec` solunda) + altında `SubNav` (sadece yana kayar). Ürünler ve Bayi siparişleri henüz bu düzende değil.
- Ödeme özeti / sepet özeti bilgisayarda **SABİT** (`useFixedSum`, `useFixedCartSum`), kaydırma çubuğu YOK (kullanıcı kızdı). "Yeni sipariş özeti" denemesi reddedildi.
- Çekip yenile: telefonun kendi esnemesi serbest, gösterge `.ptr10` üst menünün içinde, yeni sürüm yoksa sayfa YENİLENMEZ. Önceki 2–9 sürümleri hantal bulundu, geri dönme (`docs/ozellik-ekim-sonu.md`).
- Ana ekran uygulaması her açılışta bölümün ana sayfasından başlar ("kaldığı yerden" istenmedi); derin linkler ve bildirimden açılış (`?n=1`) hariç.

**Teknik dersler (hata yaşandı)**
- **Kendi adını çağıran kısa yardımcı yazma** (`const save = x => (lc ? updateLcart : save(x))` → sonsuz döngü, DHL aktarımı dondu).
- `replace` ile metin eklerken o metin dosyada birden fazla yerde olabilir → ekledikten sonra ilgili ekranı aç, test et.
- catalog.jsx Gallery içinde yerel `isVid` adı kullanma (utils `isVid` ile çakıştı, beyaz sayfa).
- `currentRate` gibi seçicilerden her çağrıda yeni nesne döndürme → useStore sonsuz döngü (React #185).
- **Sayfa genelinde `:root:has()` / `html:has()` / `body:has()` YAZMA** (performans) → html sınıfı kullan (`hdr-gs-on`, `hf-on`, `lg-on`…).
- Dokunmatikte `touchHoverToActive()` `@media (hover: hover)` dışındaki tüm `:hover` kurallarını `:active`e çevirir → yeni hover kuralı yazarken bunu bil.
- `backdrop-filter` fixed çocukların konum kutusunu değiştirir (arama kutusu cam şeride göre konumlanır).
- `html.th-dash` tokenları `:root[data-theme=dark]`'ı ezmek için `html.th-dash[data-theme]` ile yazılır.
- **Bekçide KV'ye her istekte yazan bir şey EKLEME** (ücretsiz KV günde 1.000 yazma; bildirim aboneliği yazmaları %93'e çıkarmıştı → `addSub` aynıysa yazmaz).
- **SİLME KAPALI:** PlatinMarket pasif ürün sayfasında da 404 veriyor → eşitlemede silinmiş/pasif ayrılamaz. `DELETE_OK` AÇMA. Dosyada olmayan = silinmiş ayrımı sadece Excel dışa aktarımıyla.
- PlatinMarket sitesine (ertelgsm.com) toplu istek atma (IP engeli yemiştik). GSMArena'yı tarama (429 ile engelledi).
- Gizli tutulan sayfalar (`.kp-off`) `content-visibility: hidden` ile; `ShopImg` `decoding=async` değil; `Thumb` resim adresini ilk çizimde hesaplar → geri dönüş flaşları buydu.
- `useStore()` seçicisiz kullanım çizimde okunan alanları izler (Proxy); yine de yeni bileşende seçici tercih et.
- Elle toptan fiyatı (`w`) hiçbir otomatik işlem silmez/değiştirmez.
- Stok SADECE panelden yönetilir; eşitleme var olan ürünün `s`'ine dokunmaz.

## 3. Teknolojiler ve altyapı

| Katman | Ne |
|---|---|
| Arayüz | React 19 (JSX), tek CSS `src/style.css`, kendi bileşen seti `src/ui.jsx`, global durum `src/store.js` |
| Paketleme | esbuild, `python3 tools/build.py` → tek dosya `hosting/public/index.html` + `DEMO.html` + `dist/artifact.html` (demo artifact) |
| Veri / oturum | Firebase **Spark (ücretsiz)**: Auth + Firestore. Storage/Functions YOK. SDK 10.12.2 sitemizden `/fb/`. Blaze'e geçiş hazırlığı yapıldı, kullanıcı henüz geçmedi |
| Site | Cloudflare Workers static assets `ertel-site` (`site/worker.js` + `site/wrangler.toml`; SEO/OG etiketleri, sitemap, merchant.xml, `/__/auth/*` vekili, `/k/*` WhatsApp önizlemesi). Firebase Hosting de aynı kodla güncellenir |
| Bekçi | Cloudflare Worker `ertel-b2b-watch` (`worker/index.js`, KV, R2): sunucu tarafı sipariş, bildirimler, kur, DHL, push, yükleme, yedek, fatura bekçisi |
| Dosyalar | R2 `ertel` kutusu = **resim.ertelmarket.com** (ürün resimleri `platin/…`, yüklenenler `up/…`); `ertel-yedek` = veri yedekleri |
| Bildirim | Telegram (@ertelsiparis_bot), Resend e-posta (sadece yöneticiye), web push |
| Otomasyon | GitHub Actions, repo `omer12boluk-coder/ertel-toptan` |
| Alan adı | ertelmarket.com (Cloudflare Registrar, kullanıcının). E-posta yönlendirme `info@` → kullanıcının Gmail'i |

**Önemli Actions işleri:** `deploy.yml` (Firebase), `site.yml` (Cloudflare site; sonunda alan adı kontrolü), `worker.yml` (bekçi + gizli ayarlar), `sync.yml` (Siteyle eşitle, PlatinMarket XML), `r2-new.yml` (yeni ürün resimleri R2'ye), `yedek.yml` (her gece veri yedeği), `geri-yukle.yml`, `stats.yml` (popüler ürünler), `usage.yml` (günlük kullanım raporu), `kalip-phones.yml`, `tr-address.yml`, `pub-rebuild.yml`, `test-orders.yml`, `fatura-kur.yml` / `fatura-durdur.yml`, `cf-domain.yml`, `preview.yml` (dal önizlemesi). Elle: `gh workflow run <dosya>.yml --ref main`.

**Kapasite (kullanıcıya anlatıldı):** ilk dolan Cloudflare KV yazma (~60-70 sipariş/gün → Workers Paid 5 $), Resend 100 e-posta/gün, Firestore 50k okuma/gün (~70-100 sipariş + 2-3 bin ziyaretçi; Blaze'de ucuz). Ayrıntı: `docs/gunluk.md` "KAPASİTE", `docs/altyapi.md`.

## 4. Klasör haritası (dosya → ne)

```
src/
  main.jsx       boot, oturum, sekme yönlendirme, üst/alt menü (BotNav), useTheme, useHideTop, setupNavAnim (sayfa geçişleri), setupFlowPills, setupPull (çekip yenile), IntroSplash, DemoSwitch, NotFound, migrate()
  route.js       adres çözümleme (ROUTE, lpath, kısa adres), linkler
  store.js       global durum, go()/geçmiş, sepet, openProduct/openAcct/openLcart
  config.js      DEFAULT_SETTINGS (tüm ayar varsayılanları), ORDER_STATUS, CARRIERS, SPLASH_STYLES
  ui.jsx         Icon, Sheet, Field, Toggle, Stepper, PageHead, SubNav, ContextMenu/SheetMenu, PhoneInput, CarrierMark
  utils.js       fmt, priceFor, stepOff, totals, withDefaults, picUrl, mediaOf, nextCode, ls
  backend-firebase.js / backend-demo.js   veri katmanı (aynı arayüz; demo localStorage)
  catalog.jsx    ürün listesi (kutu/satır, kart, AdminTable), filtreler, ProductSheet/ProductBody/ProductPage, Gallery, PlayVideo, VideoViewer, Lightbox
  cart.jsx       sepet (mağaza + bayi), BayiSend, SwipeLine
  checkout.jsx   ödeme adımı, OrderWait, üyelik/giriş (AuthForm), Hesabım (MemberHome), sipariş takip sayfası, AddressFields
  storepay.jsx / paycalc.js   KDV dahil mağaza ödemesi (paycalc SAF hesap, bekçi de kullanır), CardForm, AdminPayCard
  pvorders.js    önizleme siparişleri (pv_, localStorage)
  orders.jsx     yönetim: mağaza siparişleri, CargoCard, DHL, useStatusFlow, tarih aralığı, Members
  lcart.jsx      sepet linki (yönetim + müşteri /k/<id>)
  requests.jsx   bayi talepleri/siparişleri
  admin.jsx      Müşteriler (bayiler), Ayarlar (GROUPS/SECTIONS), Profil, ProductEdit, CarrierSettings, AdminPush
  dashboard.jsx  Genel bakış
  shophome.jsx   mağaza ana sayfası (Hero, PromoTrack, raflar, VideoBlock, WideBox…), HeaderSearch, CtaButton, useOpenLink/LinkPick
  designer.jsx   Tasarım modu 2 (Katmanlar | Stage | Inspector), ButtonStudio, SizeGuide, BotNavPick vb.
  dzframe.jsx    tasarım önizleme çerçevesi (iframe + portal)
  slidex.jsx     banner serbest öğeleri (yazı/şekil/kalem), FONTS, Disclose
  presets.js     BG_PRESETS, PALETTES, PACKS (tema paketleri), SLIDE_TEMPLATES, BTN_STYLES, ARROWS, PATTERNS, ORNS, lookColors, logoFilter, ensureLogoSvg
  stylekit.js    Stil Stüdyosu (look.style → html.st-* sınıfları)
  decor.jsx      PackDecor/StoreDecor (tema şeridi Ticker, efektler, desen)
  navdrop.jsx    bilgisayar açılır menüleri (HoverDrop, MegaCats, BrandsDrop)
  sets.jsx       setler (yönetim + /set/<id> + sepet)
  extras.jsx     feat(): paylaş, haber ver, popüler, öne çıkanlar
  reviews.jsx    yorumlar · preq.jsx ürün talebi · issue.jsx sorun bildirimi
  notif.jsx      bildirim merkezi (yönetim zili NotifBell, mağaza ShopBell, NotifPop)
  push.js / pushhelp.jsx   web push (müşteri + yönetici), resimli yardım
  orderform.jsx  Form oluştur (liste resmi + fiyatlı link, kayıtlı formlar)
  listsheet.jsx / listcode.js   vitrin listesi, ListPaper, PNG
  kalip.js / kalipfind.jsx      kalıp bulucu
  legal.js / legalui.jsx        yasal metinler
  quota.jsx      Ayarlar › Veri ve kota (yedekler, fatura bekçisi kartı)
  seo.js / seodrafts.js / seoedit.jsx   SEO adresleri (uygulama + site/worker.js ORTAK), tanıtım yazıları
  datawin.js     yönetim veri pencereleri (son N gün + açıklar)
  saveq.js / savedock.jsx   arka plan kayıt kuyruğu
  photobn.jsx / cdhome.jsx   fotoğraflı bannerlar, Claude düzeni bölümleri (içerik src/icerik/)
  icerik/        bannerlar.json, kesfet.json, kapaklar.json — Claude'un rutin işlerde düzenlediği veri (§0)
  aiadd.jsx / gelen.jsx      Akıllı ürün ekle · Claude’dan gelenler (/admin/claude)
  footer.jsx, home.jsx, guestcart.jsx, watch.js, idb.js, xlsx.js, clean.js, media.jsx, labelpdf.js, barcode.js, cats.js
  products.json / categories.json / descs.json / tr-ilce.json / setindex.json (derlemede üretilir)
hosting/   firebase.json, firestore.rules, public/ (index.html, config.js = IMG_BASE/WATCH_URL/Firebase, sw.js, manifest-*, brands/, tr/, kalip/phones.json, fb/)
site/      worker.js + wrangler.toml (ertelmarket.com önü)
worker/    index.js (bekçi)
tools/     build.py, setindex.py, sync-platin.mjs, kalip-*.mjs, r2-*.mjs, platin-free.mjs, backup-restore.mjs, usage-report.mjs, stats.mjs …
docs/      arşiv notları (§12)
claude/    bolumler.json (bölüm adları/takma adlar) + is/*.md (hızlı iş tarifleri, §0)
gelen/     Claude'dan gelen taslaklar (sadece `gelen` dalında dolu)
tools/banner/   cut.py, defringe.py, kapak.py (resim hazırlama)
```

## 5. Derleme, yayın, test

- `python3 tools/build.py` → index.html, DEMO.html, version.json, dist/artifact.html. Demo artifact: https://claude.ai/artifact/NuSCvLwqnUZa7Cqvs57psQ (dist/artifact.html'den yeniden yayınlanır).
- **Test:** deneme sunucusu `/tmp/claude-0/web/serve.py` (port 8765, her adrese DEMO.html, `/brands/` `/splash/` dosyaları; kendiliğinden kapanabilir → Bash `run_in_background` ile başlat) + Playwright (Chromium hazır kurulu). Demo girişleri: yönetici `admin/admin`, bayi `ahmet/1234`. Telefon: 390×844 + `is_mobile/has_touch`. Demoda platincdn resimleri açılmaz → `page.route('**/platincdn.com/**', …)` ile deneme PNG'si ver. Gizli kopya düğmelere dikkat: `locator('button:visible', has_text=…)`.
- Önizleme: adı `--` içeren hostta (Firebase önizleme kanalı) Yayınla kapalı ve sipariş kaydedilmez (`PREVIEW`). `preview.yml` dala push'ta kanal adı = dal adı.
- Demo'da `window.__store`, `DemoSwitch` (sol altta Mağaza ⇄ Yönetim).

## 6. Adresler (kısa)

- Mağaza kısa adresli: `/`, `/urunler`, `/sepet`, `/hesap/<bölüm>`, `/urun/<ad>-<no>`, `/set/<id>`, `/kalip`, `/talep`, `/sorun`, `/yasal/<slug>`, `/marka/<ad>`, `/kategori/<ad>`, `/s/<id>` (sipariş takibi), `/k/<id>` (sepet linki), `/l/<kod>` (vitrin listesi, veritabanına kaydedilmez), `/islem` (e-posta işlemleri). Kod içinde hâlâ mantıksal `/magaza/…`: adres okuyan her yer `lpath()` kullanmalı.
- Bayi `/b2b/…`, yönetim `/admin/…` (`/admin/siparisler|sepetler|form|sepet-link|urunler|setler|musteriler|tasarim|ayarlar`, `/admin/s/<id>`, `/admin/t/<id>`), `/siparisformu` (menüsüz form).
- Büyük harf / Türkçe İ adresler küçük harfe çevrilir; bilinmeyen mağaza adresi → `NotFound` (noindex).
- Ayrıntı: `docs/eski-cekirdek.md` §4 (`KISA ADRES`, `AuthForm`, Google/Facebook girişi).

## 7. Veri modeli (Firestore, özet)

`catalog/*` (tam katalog parçaları, yönetici+bayi) · `pubcatalog/*` (mağaza kopyası, toptan yok, etiket `packTags`) · `desc/*` + `descb/b<n>` (açıklama kovaları) · `settings/main` + `settings/public` · `users`, `userPrices`, `userNotes` · `requests` (+messages; bayi siparişi `type:'order'`) · `orders` (sadece bekçi yazar, `via:'srv'`, `sum`, `card`) · `lcarts` (sepet linkleri) · `members`, `usernames` · `oforms` · `preq`, `issues`, `reviews`, `revsum`, `wait`, `stats/public` · `shopimg` · `meta/owner|sync|feed|deleted|usage`.
Ürün kısa alanları: `id`, `k` stok kodu, `n` ad, `b` marka, `c`/`c2` kategori, `r` liste fiyatı, `w` elle toptan, `cur`, `s` stok, `a` aktif, `so` sitede yok, `pc` toptanı kontrol et (sadece elle toptanlıda), `nw` yeni, `pi`/`im` resim (`r2:`, tam adres ya da çıplak dosya adı), `v:` video öğesi, `t` gizli etiket, `u` Platin yolu, `man` elle eklenen (id 9000000+), `ut`/`ur` son işlem. Ayar göçü `migrate()`, `settings.v` = 6; ayarlar hep `withDefaults()`.
Ayrıntı: `docs/eski-cekirdek.md` §5.

## 8. Güncel görünüm varsayılanları (5.11.2026)

Hepsi Ayarlar › Renkler ve görünüm ya da Tasarım modundan değişir; ayrıntı `docs/gunluk.md`.
- `look.site` **'apple'** (Apple açık, sadece mağaza gündüz; gece eski koyu) | 'dash' (Bakır gece, hep koyu) | 'classic'. Mağaza varsayılanı gündüz.
- `look.header` **'search'** (Cam + arama; bilgisayarda yüzen cam + geniş arama + alt satırda menü) | 'glass' | 'center' | 'classic'. `look.hideTop` 'top' (kayınca gizlenir).
- `look.botnav` **'glass'** (yüzen cam) | dark | bar | classic. `look.glass` açık (Liquid glass: çipler, Hesabım menüsü, seçim çubukları, açılır menüler).
- `look.motion` **'clear'** (yandan kayma, alt menüde yönlü) | soft | glass | slow.
- `cards.addPos` **'bottom'** (Sepete ekle fiyatın altında tam genişlik) | side; `cards.stockTag`.
- Akan hap `setupFlowPills` (.topnav, .seg, .mo-tabs, .view-sw, .of-seg). Mağaza sayfaları 1640px.
- Tema Stüdyosu `look.pack`, Stil Stüdyosu `look.style`, logo `look.logoTone`/`logoColor`, reklam kutuları `promosLay`/`blocks[id].lay`, banner gezinme `shopHome.heroNav`.
- Ödeme: `pricing.storeVatInc` (KDV dahil mağaza), `orders.storeCard`, `orders.inst` taksit; kart ödemesi şu an DEMO (gerçek POS yok). Sepet linkinde kart "Yakında" (`orders.cardSoon`).

- **Tarihli ayrıntılar (5–7.11.2026: tasarım paketleri, gece/ses/hareket, Paket 0, Akıllı ürün ekle, ödeme linki, yönetim teması, bannerlar, Claude düzeni, v3, kart/logo hizası, Yeni gelenler…)** `docs/gunluk.md` sonundaki **'CLAUDE.md'den taşınan (7.11.2026)'** bölümünde, aynen. Ayar adını orada `Grep` ile ara (ör. `look.navMenu`, `cdLayout`, `aiadd`).

## 9. Önemli kararlar (neden böyle)

- Firebase Spark kalıyor (Blaze'e geçiş kullanıcının elinde); arka plan işleri ücretsiz Cloudflare'de. PlatinMarket'te API yok → XML beslemesi + bekçi. Platin artık sadece veri girişi; dosyalar R2'de.
- **Liste fiyatı = sitedeki gerçek satış fiyatı** (indirimli varsa o); toptan = `w` ya da `pricing.mode` 'steps' (fiyat aralığına göre sabit USD indirim). Mağaza ziyaretçisi liste fiyatını görür.
- **KVKK (7.11.2026):** `orders` sadece yönetici + sahibi üye, onaylanmış `lcarts` sadece yönetici okur. Linki açan başkası/misafir bekçi `/pub/o`, `/pub/k`'den kısaltılmış kopya alır (`maskOrder`/`maskLcart`: ad baş harf, tel son 2, il/ilçe; `watchOrder`/`getLcart` izin yoksa kendiliğinden geçer, dakikada bir). Bekçi Firestore okumaları servis hesabıyla (`fsWithSa`). `paylinks` hâlâ açık (sadece ad + tutar).
- **Robot koruması (7.11.2026):** Turnstile (`src/turnstile.js`, site anahtarı içinde; `TURNSTILE_SECRET` GitHub gizli ayarı → bekçi). Sadece gerçek mağaza siparişinde (`placeOrderSrv` 4. parametre `ts`, bekçi `tsVerify`); görünmez, şüphede alt ortada `.ts-box`. `TS_GRACE` 15.11.2026'ya kadar jetonsuz sipariş kabul. Giriş/kayıt Google'a doğrudan gittiği için Turnstile yok (App Check'in işi).
- **App Check (7.11.2026):** reCAPTCHA Enterprise (Fraud Defense) anahtarı `config.js` `APPCHECK_KEY` (boş = kapalı), `backend-firebase.js` init'te Firestore'dan önce kurulur, sadece ertelmarket.com. SDK `/fb/firebase-app-check.js` (vendor-firebase.yml). Şimdilik SADECE SAYIM: Firebase'de Enforce'a Blaze'den sonra basılacak (ücretsiz 10k/ay aşılırsa doğrulama durur). Enforce öncesi: REST yedeği (`restGet`) App Check başlığı göndermiyor → düzeltilmeli.
- Mağaza siparişini **bekçi yazar** (fiyatı pubcatalog'dan doğrular; kur/KDV `paycalc.js` ile aynı hesap). Müşteri `orders`'a doğrudan yazamaz.
- Bayi siparişi mağaza siparişlerine karışmaz (requests `type:'order'`); sepet linki de siparişlere karışmaz (`lcarts`). Cari hesap tutulmaz.
- Vitrin listesi veritabanına kaydedilmez. `/siparisformu` şifresiz değil (toptan fiyatlar sızardı).
- Bildirim: Telegram ana kanal; müşteriye sipariş e-postası İSTENMİYOR (sadece push; WhatsApp bilgilendirme planlı).
- Ürün sayfaları uygulama içinde açılır, Platin'e link yok. Sekmeler adreste (pushState).
- Telefonda çift dokunuş/iki parmak büyütme kapalı; yazı alanları ≥16px; pencere açıkken arka sayfa sabitlenmez (ui.jsx touchmove süzgeci).
- Arka plan silme EKLENMEDİ (uygun kütüphane AGPL).

## 10. YAPILACAKLAR (kullanıcı 'to-do' deyince BUNU göster; iş bitince güncelle)

**Kullanıcının yapacakları:**
1. Blaze'e geç → servis hesabına roller (Project Billing Manager, Pub/Sub Admin, Service Usage Admin; fatura hesabında Billing Account Costs Manager) → Actions 'Fatura bekçisini kur' → panelde sınır 5 $ + 'Bildirim denemesi'.
2. Cloudflare Workers Paid (5 $/ay) — siparişler günde 50'ye yaklaşınca.
3. Cloudflare hesabında 2FA (hatırlat).
4. web.app'ten eklenmiş ana ekran uygulamalarını silip ertelmarket.com (mağaza) ve /admin'den yeniden ekle.
5. Yasal kontrol (avukat + mali müşavir): ETBİS, mesafeli sözleşme e-postası, KVKK yurt dışı aktarım, TL + KDV dahil fiyat, e-Arşiv, İYS.
6. Kart ödemesi: İş Bankası sanal POS bilgileri (3D Pay Hosting; client id, kullanıcı/şifre, store key) — yasal metinler önce hazır olmalı. Gelince `CardForm` + bekçi bağlanır (birkaç saatlik iş).
7. Google Cloud › Credentials'a https://ertelmarket.com/__/auth/handler (+www) (Google ile giriş); Facebook girişi ertelendi.
8. Google Search Console (Alan adı mülkü) + sitemap; Google İşletme profilinde site.
9. E-posta: Firebase Auth e-posta alan adı Verify + gönderen noreply@ertelmarket.com; destek@ adresi + alt bilgi + Gmail 'farklı adresten gönder'; info@ spam filtresi.

**Claude'un yapacakları:**
10. Blaze günü: sahte harcama denemesi düğmesi, Firebase App Check, hızlı kota bekçisi (Monitoring okuma sayısı), gerekirse Cloudflare hız sınırı.
10b. **Sanal POS bağlanınca demo kartı KALDIR:** `src/paylink.jsx` `DEMO_PAY = false` + `DemoPay` bileşeni ve `DEMO_OTP = '111111'` (3D ekranında 'başarılı' deneme kodu) silinir; müşteri linkine gerçek ödeme bağlanır.
11. Sipariş e-postasını Resend'den Cloudflare Email Service'e taşı ('en son döneriz').
12. Resend 'verified' kontrolü.
13. WhatsApp bilgilendirme (Meta Cloud API, kargoya verildi / teslim edildi) — önce Meta işletme doğrulaması.
14. Siparişleri okuma yükü: tek 'özet belge' (son 7 gün) — kullanıcı kararı bekliyor.
15. Yurtiçi Kargo entegrasyonu; sepet linkinden gelen siparişi normal siparişe çevirme + yasal onay + üye adres önerisi.
16. Yönetim paneli Apple teması yayında (5.11.2026); kullanıcı geri bildirimi bekleniyor.
17. (5.11 akşam düzeltmeleri yayında: arama/menü ortalı grid, bildirim paneli camı, tasarım önizlemesinde site teması + üst/alt menü `HeaderPreview`/`BotNavPreview`, reklam kutusu başlığı `useFitWords`, telefonda sayfa modunda açıklama kısa, yapışkan şerit transform ile kayar.) Banner yazısının arka plandan dönünce görünmemesi düzeltmesi yayında, gerçek iPhone'da doğrulanmadı.

18. Paket 0 yayında (kullanıcı deniyor); Ürünler açılış sayfası askıda (ayardan kapalı tutulabilir); gerçek iPhone'da sesler / arama animasyonu / gece modu doğrulanmadı.

- 7.11.2026 banner / Claude düzeni / v3 / kart-logo hizası / Yeni gelenler notları → `docs/gunluk.md` 'CLAUDE.md'den taşınan'. Bannerlar, Keşfet, kapaklar artık `src/icerik/*.json` (§0).

- **7.11.2026 Banner imzası** (YAYINDA): `photobn.jsx` `sigOn` — ert mobile logosu marka satırında ince çizgiyle ayrılmış (bilgisayar 38, telefon 28 birim; telefonda sağ alt köşe denendi, beğenilmedi; koyu zeminde beyaz %85 — kullanıcı "aynı kalsın"). Telefonda yer ayarı `shopHome.sigM` '' marka satırı | 'corner' sağ alt (Tasarım › Banner › 'Banner imzası (telefon)'). Marka logosu dikey ayarı `lgY` (Quick -0.16: yazıları logonun alt kısmında); kapatma satırda `sig: false` (v3 › Banner › 'Banner imzası'), JSON `"imza": false`. Yeni banner `tezgah` (mağazanın kendi bannerı, `oto`+`bas` → listede İLK sırada, imzasız). Bağlantı `go:<sekme>`.

- **7.11.2026 cd kartları Sepete ekle:** kartlar oynuyordu → `.cd-sec .abx` sabit boy + `contain: layout paint`; geçiş animasyonları AYNEN (kullanıcı geri istedi), sadece geri dönüşte yazı dönmez (`abFadeOnly`), bilgisayarda basınca küçülme kapalı. Demoda canlı ayarlarla (Actions 'Claude için getir' → `ayarlar.json` = settings/public) kurup denendi.

- **7.11.2026 Ürünler sayfası v2** (YAYINDA, `look.prodV2`; `false` = eski sol menülü sayfa, Tasarım › Görünüm › 'Ürünler sayfası: Yeni / Eski'): yazılı kategori hapları (seçili = tema rengi), başlık satırında arama, Filtrele paneli + hızlı etiketler kategorilerin üstünde, kartta logo adın üstünde (`.pv2-brand`, sadece 'marka adını göster' açıkken; önizleme hostunda `PV_HOST` hep açık), logo boyu `ShopImg` pv2-lg, logo yanı yazı `LG_TXT` (Luban, XZZ, Mega-Idea). Arama hep açık (boşken gri, doluyken beyaz), Filtrele sayacı köşede (`pv2-badge`), seçili kategoriye tekrar basınca kalkar, en üste çık `ToTop`. Marka düzeltmeleri yüklemede `store.js` `fixBrand` (Mega-Idea, Keguan, M.R Yang, 18 Kinds). Açılış sayfası `PV2Hub` (catalog.jsx; `look.prodHub` açıksa Ürünler'e basınca önce o): 'Tüm ürünler' tema renginde ilk kutu, kategori kutularında silik kapak resmi (`.phub-c::after` opacity .14 gri; renkli deneme .55), alt kategoriler tıklanır, logolu marka hapları; resimler `HUB_IMG`, ayarlar `shopHome.p0.hub` (bg, hide2, img2) — Tasarım › Görünüm 'Ürünler açılış sayfası' + Gelişmiş › katman. Liste başlığı kategori yokken 'Tüm ürünler.'. Kaydırma çubuğu `src/scrollbar.js` (18px tutma alanı, boşluğa tıklayınca atlar).

**SIRADAKİ İŞ (7.11.2026):** Hızlı işler düzeni YAYINDA (§0: tarifler, `src/icerik/*.json`, Claude’dan gelenler `/admin/claude`, Actions 'Gelenleri al' + 'Claude için getir'). Kullanıcı artık kısa komutlarla iş verecek. Eski sunum/karar listesi (banner turları, Yeni gelenler seçenekleri, Kalıp bulucu Apple tasarımı askıda): `docs/gunluk.md` 'CLAUDE.md'den taşınan'. Silinebilir dallar: `banner-foto`, `banner-resim*`, `tasarim-v3`, `img-probe`, `logo-raw`.
**Karar bekleyen:** Ürünler sayfası önerisi https://claude.ai/artifact/PnrwVGQXi1n1kLTtn27sfN (sol menü → üstte fotoğraflı kategori kutuları + alt kategori hapları, tek arama, Filtrele/Sırala paneli, sade kart: tek satır koyu fiyat, 'Son N'/'Tükendi', marka logosu; turuncu YOK) · Banner imzası mobil/renk denemeleri RAFA kalktı (kullanıcı: sadece Quick ® düzeltmesi, yayında) ·  telefonda Gelişmiş tasarım modu kullanılamıyor (kullanıcı, 7.11) — öneri: telefonda Gelişmiş yerine ayarları sade modun panelinde aç · ödeme özeti 2 üründe kayıyor (çözüm önerildi) · elde kalan mal için dürüst raf/rozet · ana sayfa 'imza' etkileşimi · SMS (Netgsm) · Ürünler ve Bayi siparişleri PageHead/SubNav'a alınsın mı · "Birlikte iyi gider" rafı açıklamanın altında kalıyor.
**Tartışılacak:** Blaze sonrası açılış penceresi 14 → 30 → 62 gün; Workers Paid sonrası DHL sorgusu 30 → 5 dk.
**Küçük işler / bakım:** banner videosu (Santral Center dosyası), logosu olmayan markalar, Qianli gece rengi, sipariş formu uzun ad, Platin'e kalan bağlar (`u`, 'Sitede aç', XML eşitleme), eski GitHub dallarını sil (cf-site, eposta, resim-adresi, platin-kopma, sunucu-siparis, peek-out, mng-probe, tr-data, kalip-data, kalip-bulucu, linkli-siparis, blaze-hazirlik, tasarim-*), Actions Node 20 → 24.
**Uzun vade:** başka sektörlere şablon olarak satış, App Store.

## 11. Sık yapılan işlerin tarifi

- **Kalıp telefon listesini güncelle:** `docs/kalip.md` "Kalıp telefon listesini güncelle" (sıralı 6 adım, sonunda `node tools/kalip-build.mjs --bump`).
- **Geri alma:** resim adresi → `config.js` `IMG_BASE = ""`, `IMG_PLATIN = false`. Bir görünüm özelliği → ilgili ayarı eski değere çek (§8) ya da `MENU` satırını `false` (navdrop).
- **Yedek / geri yükleme:** Actions 'Yedekten geri yükle' (`geri-yukle.yml`, mod dene/eksik/uzerine). Panel: Ayarlar › Veri ve kota › Yedekler.
- **Alan adı koptuysa** (`site.yml` kırmızı): kullanıcı Actions "Alan adı bağlantısı" (fix) çalıştırır.
- **Deneme siparişleri:** Actions 'Deneme siparişleri' (ekle/sil; TEST20/45/90/150 canlıda İptal duruyor).
- **DHL:** aktarım/takip mantığı `docs/altyapi.md` §11 ve `docs/ozellik-temel.md` "Kargo kartı"; tekrar aktarmak güvenli (`existed: true`).

## 12. KONU DİZİNİ — hangi ayrıntı nerede (önce Grep, sonra ilgili paragraf)

| Konu | Dosya | Grep için anahtar |
|---|---|---|
| Hızlı işler (banner, Keşfet, kapak, ürün ekle) | `claude/is/*.md` + `claude/bolumler.json` | §0 tablosu |
| Son günlerin işleri (30.10–6.11), devir notları, Paket 0 | `docs/gunluk.md` | tarih (`6.11.2026`, `5.11.2026`), `Paket 0`, `TASARIM`, `Word listesi` |
| Apple açık / Bakır gece / Liquid glass / üst menü varyantları / alt menü / sayfa geçişi profilleri | `docs/gunluk.md` | `th-apple`, `th-dash`, `lg-on`, `hdr-gs`, `botnav`, `look.motion` |
| Tasarım modu 2, Tema Stüdyosu, Stil Stüdyosu, banner öğeleri, buton stüdyosu, telefon yerleşimi (fxm) | `docs/gunluk.md` | `designer.jsx`, `look.pack`, `stylekit`, `slidex`, `ButtonStudio`, `fxm`, `phoneAbs` |
| KDV dahil ödeme, taksit, önizleme siparişleri, havale 'Ödemeyi yaptım' | `docs/gunluk.md` | `paycalc`, `storepay`, `storeVatInc`, `PaidNotice` |
| Sepet linki (güvenlik, süre, adet izni, WhatsApp özeti) | `docs/gunluk.md` + `docs/ozellik-ekim-sonu.md` | `lcart`, `Sepet linki`, `lcartHours`, `lcSummary` |
| Kapasite ve yasal eksik listesi, eski yol haritası | `docs/gunluk.md` | `KAPASİTE`, `YOL HARİTASI` |
| Fiyat kuralları, fiyat gösterimi, kur | `docs/ozellik-temel.md` | `### Fiyat`, `pricing.steps`, `priceShow` |
| Bayi tarafı, bayi siparişi | `docs/ozellik-temel.md` | `### Bayi`, `BayiSend`, `B2B_PAY` |
| Yeni banner hazırlama kuralları (fotoğraf, logo, tuval, kesim, deneme) | `docs/banner-kurallari.md` | `PHOTO_BANNERS`, `defringe`, `tuval` |
| Mağaza ana sayfası, banner, şerit, arama, alt bilgi, video bölümü | `docs/ozellik-temel.md` | `### Online mağaza`, `marquee`, `HeaderSearch`, `VideoBlock` |
| Yönetim paneli, Ayarlar düzeni, tasarım modu (eski) | `docs/ozellik-temel.md` | `### Yönetim paneli`, `GROUPS`, `SECTIONS` |
| Sipariş listesi/detayı, durumlar, kargo kartı, DHL, adres alanları, barkod yazdırma | `docs/ozellik-temel.md` | `27.10.2026 düzenlemeleri`, `CargoCard`, `AddressFields`, `labelpdf` |
| Hesabım, sepet, ödeme adımı, fatura | `docs/ozellik-temel.md` + `docs/ozellik-ekim-sonu.md` | `MemberHome`, `useFixedSum`, `InvoiceText` |
| Kalıp bulucu | `docs/kalip.md` | `KalipFinder`, `chipCodes` |
| Favoriler, bildirim merkezi, fiyat düştü bildirimi | `docs/ozellik-ekim-sonu.md` | `Favoriler`, `ShopBell`, `push/fav` |
| Yönetici ürün tablosu, resim/video düzenleme | `docs/ozellik-ekim-sonu.md` + `docs/altyapi.md` | `AdminTable`, `EditCell`, `MediaEditor` |
| Ürün talebi, sorun bildirimi, yorumlar, yasal metinler | `docs/ozellik-ekim-sonu.md` | `preq`, `issue`, `reviews`, `legal` |
| Mağaza özellikleri (paylaş, haber ver, popüler, öne çıkan) | `docs/ozellik-ekim-sonu.md` | `feat`, `NotifyBtn`, `stats/public`, `pinOn` |
| Çekip yenile, sayfa geçişleri, dokunma hissi, performans | `docs/ozellik-ekim-sonu.md` | `Çekip yenile`, `setupNavAnim`, `kp-off`, `useStore` |
| Açılır menüler, Setler, kargo firmaları, PageHead/SubNav | `docs/ozellik-ekim-sonu.md` | `navdrop`, `sets.jsx`, `CARRIERS`, `PageHead` |
| Veri ve kota, tarih aralığı, kullanım raporu | `docs/altyapi.md` | `quota`, `findRange`, `usage` |
| SEO / Google, sitemap, merchant.xml, ürün adresi | `docs/altyapi.md` | `seo.js`, `sitemap`, `merchant` |
| Veri tasarrufu, panel hafifletme, veri pencereleri | `docs/altyapi.md` | `descb`, `datawin`, `persistentLocalCache` |
| Resim/video yükleme, R2 | `docs/altyapi.md` | `r2:`, `/up`, `MediaEditor` |
| Platin'den kopma, resim.ertelmarket.com geçişi | `docs/eski-cekirdek.md` | `platin-free`, `IMG_BASE` |
| Sunucu tarafı sipariş, eşitleme, bekçi, Telegram/e-posta/push | `docs/altyapi.md` | `placeOrder`, `sync-platin`, `Yeni sipariş bildirimi` |
| Blaze hazırlığı, fatura bekçisi | `docs/ozellik-ekim-sonu.md` | `Fatura bekçisi`, `billStop` |
| Alan adı, DNS kayıtları, e-posta kayıtları, Cloudflare'e taşıma | `docs/gunluk.md` | `DEVİR NOTU`, `SPF`, `ertelmarket.com` |
| Eski tam klasör listesi, adres ve veri modeli ayrıntıları, `gelistirme` dalı | `docs/eski-cekirdek.md` | `## 2.`, `## 4.`, `## 5.`, `gelistirme` |
