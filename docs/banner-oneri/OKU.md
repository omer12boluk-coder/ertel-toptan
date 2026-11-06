# Banner önerileri (7.11.2026) — karar bekliyor

Sunum: https://claude.ai/artifact/E2qEwUNB8Uz5uAkUQkdLcy (menülerin altında 5 banner, bilgisayar + telefon)
Önizleme: `onizleme.png`. Kullanıcı ilk (çizimli SVG) bannerları REDDETTİ: "orijinal ürün resimleriyle farklı tasarımlar" istiyor.

5 banner (gerçek ürün fotoğrafları; arka plan `cut.py` ile temizlendi):
1. Quick 861 Pro Max (ürün id 3066) — siyah zemin, `q861_pc.jpg` / telefonda `q861_m.jpg`. "861 Pro Max · Söyle, ısıtsın."
2. AmScope ZM6745T (3064) — beyaz zemin, üç açı `zm_left/front/right.png`. "ZM6745T · Netlik. Her açıdan."
3. Eller + mikroskop (3064 5. resim) `hands.jpg` — beyaz, tam fotoğraf. "Tamircinin gözü."
4. Aixun HT316 (2759) `ht316.png` — açık gri. "İki iş. Tek istasyon."
5. 2UUL DA07 (2756) `da07.png` — nane yeşili. "Arka kapak, tek presle."

`gen.py` = her bannerın bilgisayar (1408×560) ve telefon (358×540) HTML'i (yazılar resme gömülü değil).
Yedek temiz fotoğraflar: Mechanic Power Pro Max (3062_0.png), SUGON 3005PM (1996_0.png), iki Quick (3066_3.webp).

Siteye kurmak için: kullanıcı hangilerini seçtiğini söyleyince resimleri R2'ye (resim.ertelmarket.com, `up/…`) yükle,
ana sayfanın büyük reklam alanında (Paket 0 `P0Hero` / eski `Hero`, `shopHome.slides`) bu düzende yeni bir slayt tipi yap
(yazı solda/üstte, ürün resmi sağda/altta; telefonda ayrı yerleşim). Eski slaytlara dönüş ayarla açık kalsın.
Resim indirme: konteynerden resim.ertelmarket.com ve Actions artifact'ları ENGELLİ → geçici iş resimleri ayrı bir dala commit edip
`git clone -b <dal>` ile çekildi (dallar `banner-resim`, `banner-resim-out` silinmedi, silinebilir).
