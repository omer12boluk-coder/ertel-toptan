# Tarif: Ürün ekle → Claude'dan gelenler

Kullanıcı: "2UUL DA88 geliyor, ürünü ekle" (link verebilir, birden çok ürün sayabilir).
Sonuç: panelde **Ürünler › Claude’dan gelenler** (`/admin/claude`) sayfasına taslak düşer; kullanıcı 'İncele ve onayla'
der, fiyat + stok girer, kaydeder (Akıllı ekle'deki aynı `ProductEdit draft` penceresi; dış resimler onayda R2'ye alınır).
**Fiyat ve stok YAZMA** — her zaman kullanıcının.

## Adımlar
1. **Araştır** (kendi web aramanla; bekçinin yapay zekâ bakiyesi harcanmaz). Önce kullanıcının linki, sonra marka sitesi
   (2UUL = 2uul.com Shopify: `/products/<slug>.json` değil, ürün sayfası), sonra güvenilir satıcı. Bul:
   tam ad (mağazanın yazım tarzıyla: "Marka Model Ne olduğu (uyumluluk)"), marka, kategori, 6–15 gizli etiket
   (Türkçe arama kelimeleri, yanlış yazımlar dahil: "çamur lehim"), açıklama, resim adresleri (büyük, temiz, filigransız).
2. **Kategori no:** `src/categories.json` (ad → id). Benzer ürünlere bak: aynı markanın ürünleri hangi kategoride
   (güncel katalog: banner-ekle.md adım 1). Emin değilsen en yakını yaz, `note`'a "kategori kontrol" ekle.
3. **Açıklama biçimi:** sade HTML (`<p>`, `<ul><li>`, `<b>`; başlık `<h3>`), Türkçe, abartısız; kutu içeriği ve uyumluluk
   listesi varsa ekle. Başka mağazanın adı / fiyatı / iletişimi YAZMA. Tanıtım görselleri varsa en sona `<img src="…">`.
4. **Dosyayı yaz:** `gelen/urun/<kisa-ad>.json` (küçük harf, tire; ör. `da88.json`, aynı ad tekrar gelmez):
   ```json
   {"q":"2uul da88","n":"2UUL DA88 Mini Isıtmalı Pres İstasyonu (iPhone 17 Serisi)","b":"2UUL","c":42,
    "t":["pres","arka kapak presi","ısıtmalı pres","da88"],"desc":"<p>…</p>",
    "imgs":["https://…/1.jpg","https://…/2.jpg"],"src":[{"url":"https://2uul.com/…","title":"2uul.com"}],
    "note":"Kısa not: emin olmadıkların"}
   ```
5. **Gönder — `gelen` dalına (main'e DEĞİL, canlı site yeniden yayınlanmasın):**
   ```
   git fetch -q origin +gelen:refs/remotes/origin/gelen && git checkout -q -B gelen origin/gelen || git checkout -q -B gelen origin/main
   git add gelen/ && git commit -qm "Claude'dan gelen: DA88" && git push -q origin gelen && git checkout -q main
   ```
   Push'la birlikte Actions **Gelenleri al** (`gelen.yml` → `tools/gelen.mjs`) taslağı Firestore `gelen/<ad>` belgesine
   yazar (1–2 dk). Kontrol: `gh run list --workflow gelen.yml -L 1` → annotations "N yeni eklendi".
6. Kullanıcıya bir cümle: "DA88 taslağı Claude’dan gelenler’de; fiyat ve stoku girip onaylaman yeterli."

## Not bırakmak (banner / Keşfet önerisi)
`gelen/not/<ad>.json`: `{"kind":"banner","title":"Banner önerisi · DA88","sub":"Yerleşim right · önizleme hazır","link":"https://erteltoptan--<dal>.web.app"}`
(`kind`: banner | kesfet | not). Aynı adımla `gelen` dalına gönder. Panelde 'Önizle' + 'Tamam' çıkar; yayını sohbette kullanıcı "yayınla" der.

## Bilmen gerekenler
- Belge varsa tekrar yazılmaz; kullanıcı onaylayınca/reddedince belge `st: ok|red` olur (silinmez).
- Resim adresi indirilemezse onayda listeden düşer (ProductEdit `pullExternal`); 2–3 yedek adres koy.
- Firestore kuralı: `gelen/{id}` sadece yönetici okur/günceller; yazan servis hesabı (Actions).
