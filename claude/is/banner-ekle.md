# Tarif: Banner ekle (ana sayfanın büyük kayan reklam alanı)

Kullanıcı: "DA88 geldi, banner ekle" · "şu ürüne banner yap" · "banner'ı değiştir".
Bölüm: `cd:hero` (claude/bolumler.json). Tasarım kuralları: `docs/banner-kurallari.md` §1–2 (gerekirse oku; bu tarif özeti yeter).

## Kesin kurallar (özet)
Gerçek ürün fotoğrafı (çizim/SVG YOK) · marka logosu başlığın üstünde · Apple sadeliği: kısa büyük başlık, tek satır slogan,
en çok 2 satır açıklama, bir dolu düğme + bir yazı bağlantısı · **mor yok**, düğme `#2f62d6` (zemin yeşilse o yeşil) ·
anlaşılır Türkçe · kullanıcının kendi reklamlarına dokunma · **yeni kod yazma**, hazır yerleşimlerden birini seç.

## Adımlar
1. **Ürünü bul.** `git pull`. Ürün yeni geldiyse yerel `src/products.json` eski olabilir → güncel katalog:
   `gh workflow run claude-al.yml --ref main` → `gh run watch $(gh run list -w claude-al.yml -L1 --json databaseId -q ".[0].databaseId")` → `git fetch -q origin +claude-al:refs/remotes/origin/claude-al && git show origin/claude-al:katalog.json > /tmp/katalog.json`.
   Katalog = mağazada aktif ürünler (en yeni başta, `ft`/id sırasıyla). Ürünü ada/stok koduna göre ara (dosyayı okuma, `python3 -c` ile süz). Gerekenler: `id`, `n`, `b`, `c`, `pi`, `im`.
2. **Resimleri getir.** Resim adresi: `pi`/`im` `r2:x` → `https://resim.ertelmarket.com/x` · tam adres → aynen ·
   çıplak dosya adı → `https://resim.ertelmarket.com/platin/<dosya>`. Kullanıcı link verdiyse oradaki büyük resim de olur.
   `gh workflow run claude-al.yml --ref main -f katalog=false -f resimler="da88-0=<adres> da88-1=<adres>"` → bitince
   `git fetch -q origin +claude-al:refs/remotes/origin/claude-al && git archive origin/claude-al resim | tar -x -C /tmp/bn`.
   En temiz, beyaz zeminli, ürünün tamamı görünen resmi seç (filigran / üstünde yazı / <500px OLMAZ).
3. **Kes.** `python3 tools/banner/cut.py /tmp/bn/resim/da88-0.jpg /tmp/da88.png` (gerekirse kırp: `0,0.1,1,0.9`).
   Koyu zemin seçersen sonra `python3 tools/banner/defringe.py /tmp/da88.png /tmp/da88d.png 34 4`.
   webp kaydet: `hosting/public/bn/<id>.webp` (≤1400px genişlik, q86). `ar` = genişlik/yükseklik.
4. **Kayıt ekle** — `src/icerik/bannerlar.json`, tek satır. Yeni bannerda `"oto": true` (kullanıcının listesine
   kendiliğinden girer) ve sırayı kullanıcı söylemediyse `"bas": true` (en öne). Örnek (`lay` ile çalışan genel yerleşim):
   ```json
   {"id":"da88","name":"2UUL DA88","lay":"right","img":"da88.webp","ar":1.1,"oto":true,"bas":true,
    "bg":"linear-gradient(120deg, #f2fbf7 0%, #d3efe2 100%)","bgM":"linear-gradient(170deg, #f2fbf7 0%, #d3efe2 100%)",
    "logo":"/brands/2uul.png","lh":40,"eye":"DA88","eyeC":"#0b7a52",
    "title":"Yeni pres.\nAynı baskı.","titleM":"Yeni pres. Aynı baskı.","sub":"…en çok iki satır…","subM":"…kısa…",
    "a1":["İncele","p:3201"],"a2":["2UUL ürünleri","brand:2UUL"],"btn":"#0b7a52","lnk":"#0b7a52"}
   ```
   - `lay`: `right` yazı sol/ürün sağ · `left` ürün sol/yazı sağ · `center` başlık üstte/ürün altta (geniş, yatay ürün; `center: true` da yaz) · `photo` sağ yarı tam fotoğraf (`pos`/`posM` odak).
   - Bağlantılar: `p:<id>` ürün · `cart:<id>` sepete ekle · `cat:<id>` · `brand:<Ad>` · `q:<arama>` · `new:` · `all:` tüm ürünler · `go:markalar` / `go:setlist` / `go:kalip` sayfa.
   - **Banner imzası:** her bannerda logomuz (`/bn/ertel-logo.png`) kendiliğinden çıkar — bilgisayarda marka satırının devamında, telefonda sağ üst köşede. Mağazanın kendi bannerında (logo zaten bizimki) `"imza": false`. Kullanıcı tek tek kapatır: Tasarım › Banner › banner › 'Banner imzası' (satırda `sig: false`).
   - Logolar `hosting/public/brands/` (açık zeminde koyu sürüm `-dark` varsa onu). Logo yoksa `eye` ile marka adını yaz.
   - Zemin tonları (mor yok): nane `#f2fbf7→#d3efe2` · buz `#f4f9fd→#dcebf7` · gri `#fbfbfd→#ececf0` · beyaz `#fff` · siyah `#000` (+`"dark":true`, logoya `"logoWhite":true`).
5. **Kapatma / sıra / silme:** kod tarafında kapat `"off": true`. Sıra kullanıcının canlı listesindedir (Tasarım › Banner) —
   repodaki sıra sadece hiç listesi olmayan kurulumlarda geçerli. "Başa al" isterse yeni bannerda `"bas": true`; eski bannerın
   sırasını kullanıcı Tasarım modunda sürükler (Claude canlı ayara yazamaz) → kısaca nasıl yapılacağını söyle.
6. **Derle ve göster.** `python3 tools/build.py` · Playwright ile demo (`/tmp/web/serve.py` gibi: her adrese DEMO.html,
   `/bn/` `/brands/` dosyaları hosting/public'ten) bilgisayar 1440×900 + telefon 390×844 ekran görüntüsü → kullanıcıya göster.
   Kullanıcı "direkt yayınla" dediyse `main`'e push; yoksa dal + `gh workflow run preview.yml --ref <dal>` → önizleme adresi
   (annotations'ta). İstersen Claude'dan gelenler'e not bırak (urun-ekle.md "Not bırakmak").
7. CLAUDE.md'ye yazma; `docs/gunluk.md` sonuna tek satır yeter.
