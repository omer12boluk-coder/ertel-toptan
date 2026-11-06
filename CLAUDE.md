# ERTEL GSM — B2B katalog + online mağaza (Claude için proje notları)

Telefon tamir ekipmanı satan ERTEL GSM'in (Tahtakale/İstanbul) uygulaması. Üç bölüm: **bayilere özel katalog + sipariş/talep** (`/b2b`), **herkese açık online mağaza** (`/`) ve **yönetim paneli** (`/admin`). Canlı: **https://ertelmarket.com** (Cloudflare Workers `ertel-site`) + eski adres https://erteltoptan.web.app (Firebase Hosting, aynı kod, ertelmarket.com'a yönlendirir).

**Kullanıcıyla Türkçe konuş, teknik olmayan dille, kısa ve net anlat; tek seferde tek konu.** Kullanıcı tasarıma çok önem veriyor, küçük görsel kusurları fark eder.

> **Bu dosya nasıl kullanılır (5.11.2026 düzenlemesi):** Burada kurallar, dersler, güncel durum ve "hangi konu nerede" dizini var. Ayrıntı ve tarihçe `docs/` altında (eski CLAUDE.md'nin tamamı, aynen). Bir özelliğe dokunmadan önce **§12 Konu dizini**'nden dosyayı bul, **önce `Grep` ile anahtar kelimeyi (ayar adı, bileşen adı, sınıf adı) ara**, sadece ilgili paragrafı oku; dosyayı baştan sona okuma. Kod ile not çelişirse kod doğrudur; not eski olabilir.
> **Bakım kuralı:** iş bitince buraya en çok 1–3 satır yaz (yeni ayar adı, yeni kural/ders, yapılacaklar değişikliği). Ayrıntılı anlatımı ilgili `docs/` dosyasının sonuna tarihli ekle. Buraya uzun günlük paragrafı YAZMA.

---

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
  footer.jsx, home.jsx, guestcart.jsx, watch.js, idb.js, xlsx.js, clean.js, media.jsx, labelpdf.js, barcode.js, cats.js
  products.json / categories.json / descs.json / tr-ilce.json / setindex.json (derlemede üretilir)
hosting/   firebase.json, firestore.rules, public/ (index.html, config.js = IMG_BASE/WATCH_URL/Firebase, sw.js, manifest-*, brands/, tr/, kalip/phones.json, fb/)
site/      worker.js + wrangler.toml (ertelmarket.com önü)
worker/    index.js (bekçi)
tools/     build.py, setindex.py, sync-platin.mjs, kalip-*.mjs, r2-*.mjs, platin-free.mjs, backup-restore.mjs, usage-report.mjs, stats.mjs …
docs/      arşiv notları (§12)
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

- **Tasarım paketleri (5.11.2026, `src/dzpresets.js`):** `settings.dzPresets` [{id,name,data}] (public'e gitmez) + yerleşik `APPLE` (Paket 1). `snapshot(d)` görünüm anahtarlarını alır (look tamamı − myPacks, brand renk/tema, cards görünüm, shopHome görünüm, slide/promo renk anahtarları), `applyPreset` pakette olmayanı siler → geri dönüş birebir. İlk açılışta mevcut hâl 'Eski düzenim' (Paket 2) kaydedilir. Yeni look alanları: `width` narrow|mid|''|full, `edge` px, `boxPat` ''|glow|grid|wave|none (kutu başına `pat`), `bgFx` ''|glow|plain → `layoutOut/applyLayout` html sınıfları `pw-*`, `pg-edge`, `bp-*`, `bgfx-*`. Yeni yazı tipleri (Inter Tight, Manrope, Jakarta, Geist…), banner arka planı grubu 'Sakin (Apple)' `p-*`, stil 'apple'.

- **Bilgisayar/telefon ayrı (5.11.2026):** görünüm ayarı + 'M' = telefon değeri (`look.headerM`, `hideTopM`, `glassM`, `pillM`; kartta `productViewM`). `lookFor(L, phone)` (dzpresets.js) main.jsx Shell'de `usePhoneMQ` (≤899px) ile; tasarım çerçevesi de telefon değerleriyle çizer. Tasarım modu 'Renkler ve sayfa' paneli gruplu: Renk ve yazı · Sayfa · Menüler · Ürün kartları · Cam ve hareket (`DevPick`). Ayarlar'da mağaza görünümü satırları kaldırıldı → 'Tasarım modunu aç' kartı; 'gorunum' = Bayi ve panel renkleri.

- **5.11.2026 hareket/ses/gece:** Apple açık + gece = `th-dash` (Bakır gece renkleri; `th-dash-force` sadece site 'dash'ta, ay düğmesini gizler). `look.darkFx` circle|fade|curtain|none (geçişte `html.vt-lite` camları kapatır). `look.motionD` soft|fade|none (bilgisayar sayfa geçişi, setupNavAnim `desk`/`dfade`). `look.pill`/`pillM` flow|mercury|none (`pillMode()`, setupFlowPills + BotNav). Ses `src/sfx.js` (Web Audio, `navigator.audioSession='ambient'`), `look.sound`, cihazda ls `sfx-off`; `soundui.jsx` SoundButton (bilgisayar üst menü) / SoundToggle (Hesabım). Hafif mod `look.lite` auto|on|off → html.lite (bulanıklık yok; auto: pointer fine + ≤4 çekirdek/GB ya da açılışta yavaş kare). Ana sayfa ilk 4 bölüm önce, gerisi boşta (`HOME_FULL`). `.thumb img` artık sadece ilk inişte belirir (`.ld`).

- **Yönetim paneli teması (5.11.2026):** `look.admin` apple (varsayılan) | classic → html `adm-on` + `adm-apple` (useTheme). ≥1100px üst menü CSS ile solda sabit cam menüye döner (topbar fixed, grid; navdrop açılır menüler düğmenin sağında), <1100px açık cam üst şerit + yüzen cam alt menü; gece koyu grafit (`--ad-*`). Ayar: Ayarlar › Bayi ve panel renkleri.

- **5.11.2026 (2):** Hazır paket `merge: true` = sadece yazdığı ayarları değiştirir (önceki Apple sade 'Ürüne basınca'yı sıfırlayıp pencereye çeviriyordu — kullanıcı kızdı; hazır pakette cards'a dokunma). Paket 1 = 'Claude’un tasarımı' (`layoutFn: 'claude'` → `claudeLayout`: marka ızgarası gizli, sıra değişir; `CLAUDE_CHANGES` panelde listelenir; kullanıcının seçtiği banner arka planına DOKUNMAZ). Kayıtlı paketler artık `layout/hidden/geo` da saklar (`ks`), eskiler `upgradePresets` ile yayındaki sırayla tamamlandı. Tema Stüdyosu'nda 5 Apple teması (`apple-*`), tam sayfa zeminler `z-*` (patBg `full`, gecede koyulaşır), yeni parça `frost` 0/1/2 → html `fr-1/fr-2` (beyaz kutular buzlu cam). Bilgisayarda sayfa geçişi telefondaki gibi yönlü (üst menü sırası). Cam üst menüde seçili hap accent tonlu, belirgin.

- **5.11.2026 (3):** Üst menü gizlenmesi headroom yöntemi (`useHideTop`: sadece kullanıcı girdisinden ~700 ms içindeki kaydırmaya tepki; sayfa geçişinde menü hep görünür). Cam üst menüde seçili hap = düz beyaz + gölge (çerçeve/mavi dolgu kullanıcı beğenmedi); `.flow-on` kayarken asıl hapı gizler (yüksek özgüllük). Buzlu cam kategori paneline uygulanmaz. Yan menülü panelde `--top-h: 12px` (yapışkan sipariş başlığı).

- **5.11.2026 (4):** Mağazada `/markalar` (tab `markalar`) ve `/setler` (tab `setlist`) sayfaları (`src/brandsets.jsx`: `useBrandList`, `BrandTile`, `BrandsPage`, `SetsPage`); üst menü Markalar/Setler bunlara gider, Markalar ▾ menüsü logo ızgarası + 'Tüm markalar'. Bildirim paneli ve açılır menüler OPAK (kullanıcı şeffafı beğenmedi). Yönetim yan menüsü bulanıklıksız/opak (kaydırma yavaştı; bulanıklık bildirim panelini menüye hapsediyordu), panel arka planı `background-attachment: fixed` KULLANMA. Apple açıkta gri yuvarlak raf okları (iki tonlu bölüm başlığı denendi, kullanıcı beğenmedi, KALDIRILDI). Stil Stüdyosu yazı tipleri `html.st-fh.st-fh`/`st-fb.st-fb` ile temanın (th-apple/th-dash `--f-*`) üstüne yazar.

- **5.11.2026 (6):** `look.cartFab` false = sağ alttaki yüzen sepet gizli (Tasarım › Ürün kartları). Sepete ilk eklemede `flycart.js` uçan nokta + `.cart-bump` — `look.flyCart` true ise (varsayılan KAPALI; kullanıcı istediği şey bu değildi). Cam+arama üst menüde yan sütunlar EŞİT `--gs-side` (logo ve simgelerden genişi, JS ölçer) → arama hep ortada, dar ekranda kısalır (eşit olmayan sütun aramayı kaydırdı, kullanıcı kızdı). Hap: üstüne gelince sadece simge accent (arka plan/animasyon DEĞİŞMEDİ — iki deneme kullanıcı tarafından geri aldırıldı, hap rengine ve geçişine dokunma). Telefonda arama açılış animasyonu `hsOpen`.

- **6.11.2026:** `look.addColor` gray (varsayılan) | dark | accent (eski) | #hex → html `addc-*`, `--add-bg/fg/tx` (kart + ürün sayfası Sepete ekle + ürün adı vurgusu). `look.pillTone` 'dark' → `pill-dark` (siyah hap). Buzlu cam (frost) KALDIRILDI. Logo ortalı menü: bilgisayarda solda ses+gece, sağda arama (logoya doğru uzar)+bildirim, Markalar/Setler, keskin açılır menü. Telefon arama margin animasyonuyla simgeden uzar/kapanır (cam şerit `!important` left kullanıyor). Sesler baştan (yumuşak sinüs + alçak geçiren), `setupSfxTaps` mağazada dokunma sesleri. Hesabım: ses anahtarı bilgisayarda yok, side-tight titremesi düzeldi.

- **6.11.2026 Paket 0 (yayında; önizleme adresinde Yayınla = ls `pv-design`, sadece o tarayıcı):** `src/p0home.jsx` + `p0keys.js` bölümler `p0:hero|find|cats|pick|sets|brands|trust` (layoutOf bunları kendiliğinden EKLEMEZ), `dzpresets.js` `P0` (`layoutFn 'p0'` → `p0Layout`: eski bölümler gizlenir), `look.porc` (html `porc`), `look.prodHub` (Ürünler açılışı `ProdHub`, catalog.jsx `hubOff`). Paket listesi artık 0'dan numaralı.

- **6.11.2026 (2):** Paket 0 ayarları `shopHome.p0` {find, cats{hide,n}, pick{ids,auto}, sets{ids}, mq{color,speed,h,pause}, hub}; reklam yeri `slides[i].p0` big|top|bot|off (`p0Role`, panel `P0HeroPanel`). Tasarım › 'Ürünler açılış sayfası' (`sel.kind 'hub'`). Menüden Ürünler = `navGo` → `catalogGo {hub:true}`. `look.pillHov` (--pill-hov). Akan hap: hedef rengi geçiş kapatılıp okunur (yoksa siyah hap kaymıyordu). Stepper/sh-card renkleri `--add-*`.

- **6.11.2026 (4):** Mağazada TÜM düğmeler tema renginde (`--ap-btn: var(--accent)`; kullanıcı: bir yer mavi bir yer siyah olmasın) — siyah hap ve gri Sepete ekle sadece kullanıcı seçerse. Yönetim yan menüsü daraltılır `html.adm-mini`. Gece: kart `.prow-side` saydam, resim kutusu `#f4f1ec`. Ayrıntı `docs/gunluk.md` '6.11.2026'.

- **6.11.2026 (5):** Ana sayfa raf kartları + Paket 0 vitrinleri `CardAdd` (shophome.jsx, `.abx`) = Tüm ürünlerdeki tam genişlik Sepete ekle ve −1+ animasyonu. Yönetim telefon alt menüsünde hap sekmeyi (simge+yazı) tam sarar (`--tw`), yazı 11px.

- **6.11.2026 (3):** Ders: `bgFx glow` + `th-dash` gecede zemini açık bırakıyordu (düzeldi) → zemin/arka plan değişikliğinden sonra GECE MODUNU da aç, bak. Hesabım: React className'i yazınca `side-fixed` siliniyordu → `useLayoutEffect([view])` ile `fitRef`; bilgisayarda Hesabım içi geçişte sadece `.acct-main` belirir (setupNavAnim). Seçili satır siyah.

- **6.11.2026 Akıllı ürün ekle** (dal `akilli-urun`, yayında DEĞİL): `/admin/urun-ekle` (tab `aiekle`, `src/aiadd.jsx`) ad yaz → bekçi `worker/ai.js` `/ai/draft` (ANTHROPIC_KEY varsa Claude + web araması, yoksa Workers AI `[ai]`), `/ai/pics` (sayfadan resim), `/ai/pic` (resim vekili). Taslaklar cihazda ls `ai-drafts`; onay = `ProductEdit draft` (fiyat+stok zorunlu, dış resimler onayda R2'ye alınır). Sadece 'Hazırla'ya basınca sorgu (yarıda kalan iş kendiliğinden tekrar SORGULANMAZ). Sınır günde 20 / ayda 60 (KV `aiday:`/`aimon:`). UCUZ MOD varsayılan: `claude-haiku-5-5`, web araması YOK (sadece 'İnternette de araştırsın' kutusu, en çok 2); önce ücretsiz kaynak: marka Shopify ürünü (`shopifyProduct`) + yapıştırılan link (`pageInfo` metin+resim). ProductEdit kaydında dış adresli resimler HER ZAMAN R2'ye (resim.ertelmarket.com) alınır (`pullExternal`; platincdn hariç). Açıklama altına marka/AliExpress tanıtım görselleri eklenir (Shopify description img, AE `descriptionUrl`); açıklama değişince içindeki dış resimler de R2'ye (`pullDescImgs`, uzun resim küçültülmez). Örnek: 2 benzer + en yeni ürün. Kaliteli mod `hq` (Sonnet, `AI_MODEL_HQ`): sayfada kutu (ls `ai-hq`) + taslak menüsünde 'Kaliteli modla yeniden hazırla'. Gemini EKLENMEDİ (kullanıcı istemedi). Bakiye takibi: bekçi harcamayı kendi sayar (KV `aibal` {budget,spent}, `costOf` fiyat tablosu), %80'de ve 'credit balance' hatasında (günde 1) Telegram + panel bildirimi; sayfada `BalCard` ('Yeni yükleme yaptım' = tutar yaz, sayaç sıfırlanır). Etiket isteminde yanlış yazım/argo kuralı (çamur lehim vb.) + benzer 6 ürünün etiketleri `vocab`. Marka mağazaları `SHOPS` (2UUL=2uul.com, Shopify). Resim ayıklama (6.11 11:40): aramada bulunan sayfalardan sadece yapısal galeri (`pageImages(u, true)`; og:image/rastgele img ALINMAZ — kumar reklamı ve BBB rozeti gelmişti); tarayıcıda `tidyDraft` → `/ai/pic` vekiliyle dHash kopya ayıklama + galeride kısa kenar <500px, açıklamada genişlik <400px ve şerit/afiş oranlı resimler atılır. Resim düzenleyicide (MediaEditor) kısa dokunuş = Lightbox. Link tek ürün sayfası değilse (`isProductUrl`; ör. 2uul.com ana sayfa) site MAĞAZA sayılır → Shopify aramasında ürün bulunur, sayfadan resim toplanmaz; Shopify sonucu model koduyla eşleşmezse (`sameModel`, da07↔DA-07) alınmaz. Taslakta maliyet `d.cost`. Shopify olmayan site verilirse `siteSearch` (bilinen `SEARCH_URL` martview `/products?search=`, yoksa ana sayfadaki arama formu, yoksa yaygın kalıplar) → sonuçta model kodu eşleşen (`strongMatch`) ilk ürün sayfası okunur. Link verilmezse başka siteye KENDİLİĞİNDEN gidilmez. Cevap biçimi: `<json>` (desc YOK) + ayrı `<desc>` HTML (JSON içinde HTML tırnakları bozuyordu → 'cevabı okunamadı'); bozuksa ucuz modelle biçim düzeltme çağrısı. KULLANICI (6.11 11:53): akıllı ürün ekle düzeltmelerini SORMADAN yayınla. Site teşhisi (6.11, `probe-2uul` dalı, sadece okuma Actions): martview özel yapı (JSON-LD yok, og:image küçük; galeri `static.martview.com/product/IMG-x/<slug>-N-{small|medium|medium-large|large}.jpg`) → `slugImages` (dosya adında ürün adresi parçası geçen resimler, en büyük boy + '-large' denemesi); diyfixtool.com Shopify (suggest çalışıyor; 'JCID V1SE' bulunmazsa sadece model koduyla tekrar); jcprogrammer.com (JCID) çok yavaş/zaman aşımı, arama formu yok → güvenilmez. `get` zaman aşımı 25 sn. Çoklu link (6.11 12:20): `links` en çok 3 (satırdaki linkler + link kutusu; birden çok ürün yazılınca kutudan sadece site ana sayfaları), bekçi `fromLink` her linki paralel okur (ürün sayfası → `pageInfo`, site → Shopify sonra `siteSearch`), marka sitesi (`SHOPS`) ayrıca; resimler birleşir, açıklama altı görselleri TEK kaynaktan (önce marka). DERS: 2uul.com www'suz CEVAP VERMİYOR → site adresinde www'yu atma (`host()` sadece karşılaştırma için); `shopifyProduct` www'lu/www'suz ikisini dener.

- **6.11.2026 Alt menü ortada (iPhone ana ekran uygulaması, dönüşte):** `setupResumeFix` --vvd sadece AŞAĞI iter (`d < 24 → 0`; yukarı itmek menüyü ortaya taşıyordu). 'Sağlıklı yüksekliği hatırla' (ls `vv-good`) denendi, KALDIRILDI: iPhone bir an durum çubuğu dahil ölçü verince menü ekranın altından taşıdı. `isField` sadece klavye açan alanlar (onay kutusu odakta kalınca düzeltme duruyordu). Gerçek iPhone'da doğrulanmadı. (5) Telefonda 2 dk'dan uzun arka planda kalınca dönüşte sessiz `location.reload()` (aynı adres); açık pencere / `savesPending()` / yazılmış alan / tasarım modunda YENİLENMEZ. (6) Yönetim Ürünler'de de `PageHead` + seçici (`.prod-top`, Akıllı ekle/Setler ile aynı yer); telefonda arama kutusu kırpması (`hsGrowC`) kutunun 4px dışını kapsar (odak halkası bitişte birden belirip kutu 'oturuyordu'). (7) Set kapağındaki '+N' kutu boyuna göre küçülür (`container-type: size`, `42cqmin`). (8) Sepete ekle ⇄ −1+ sınıfı `useMorph(qty)` (ui.jsx) ile çizimle aynı anda (useEffect+setState bir kare geç kalıp flaş yapıyordu — YENİ kartta da bunu kullan); `abBack` taşmasız eğri; ses motoru ilk dokunuşta önceden kurulur (sfx.js `warm`, ilk eklemede takılma).

- **6.11.2026 Ödeme linki:** `src/paylink.jsx` yönetim `/admin/odeme-link` (tab `odemelink`, Form oluştur altında): tutar TL/USD (USD × o anki kur, elle değişir), KDV aç/kapa + oran, komisyon % (`(TL+KDV)×%`), son tutar → `paylinks/{id}` (kural: get herkes, yazma yönetici) + müşteri `/o/<id>` (tab `odeme`, `ROUTE.payId`; sadece toplam + açıklama, komisyon kalemi gösterilmez). Kartla öde 'Yakında' — POS gelince buraya bağlanacak. Listede Ödendi/İptal/Sil elle.

## 9. Önemli kararlar (neden böyle)

- Firebase Spark kalıyor (Blaze'e geçiş kullanıcının elinde); arka plan işleri ücretsiz Cloudflare'de. PlatinMarket'te API yok → XML beslemesi + bekçi. Platin artık sadece veri girişi; dosyalar R2'de.
- **Liste fiyatı = sitedeki gerçek satış fiyatı** (indirimli varsa o); toptan = `w` ya da `pricing.mode` 'steps' (fiyat aralığına göre sabit USD indirim). Mağaza ziyaretçisi liste fiyatını görür.
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

**Karar bekleyen:** ödeme özeti 2 üründe kayıyor (çözüm önerildi) · elde kalan mal için dürüst raf/rozet · ana sayfa 'imza' etkileşimi · SMS (Netgsm) · Ürünler ve Bayi siparişleri PageHead/SubNav'a alınsın mı · "Birlikte iyi gider" rafı açıklamanın altında kalıyor.
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
| Son günlerin işleri (30.10–6.11), devir notları, Paket 0 | `docs/gunluk.md` | tarih (`6.11.2026`, `5.11.2026`), `Paket 0`, `TASARIM`, `Word listesi` |
| Apple açık / Bakır gece / Liquid glass / üst menü varyantları / alt menü / sayfa geçişi profilleri | `docs/gunluk.md` | `th-apple`, `th-dash`, `lg-on`, `hdr-gs`, `botnav`, `look.motion` |
| Tasarım modu 2, Tema Stüdyosu, Stil Stüdyosu, banner öğeleri, buton stüdyosu, telefon yerleşimi (fxm) | `docs/gunluk.md` | `designer.jsx`, `look.pack`, `stylekit`, `slidex`, `ButtonStudio`, `fxm`, `phoneAbs` |
| KDV dahil ödeme, taksit, önizleme siparişleri, havale 'Ödemeyi yaptım' | `docs/gunluk.md` | `paycalc`, `storepay`, `storeVatInc`, `PaidNotice` |
| Sepet linki (güvenlik, süre, adet izni, WhatsApp özeti) | `docs/gunluk.md` + `docs/ozellik-ekim-sonu.md` | `lcart`, `Sepet linki`, `lcartHours`, `lcSummary` |
| Kapasite ve yasal eksik listesi, eski yol haritası | `docs/gunluk.md` | `KAPASİTE`, `YOL HARİTASI` |
| Fiyat kuralları, fiyat gösterimi, kur | `docs/ozellik-temel.md` | `### Fiyat`, `pricing.steps`, `priceShow` |
| Bayi tarafı, bayi siparişi | `docs/ozellik-temel.md` | `### Bayi`, `BayiSend`, `B2B_PAY` |
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
