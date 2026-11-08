# Tarif: Keşfet kutusu ekle ("Keşfet · Atölyen için")

Kullanıcı: "Keşfet'e kutu ekle" · "tezgâha JBC uçlarını koy" · "Atölyen için'e yeni sekme ekle".
Bölüm: `cd:ads` (claude/bolumler.json — başlık değiştiyse `adlar` listesinde ara). Ana sayfada dikey fotoğraflı
kutular, yan yana, oklarla kayar. Kod: `src/cdhome.jsx` `CdAds` — DOKUNMA.

## Adımlar
1. **Hedefi belirle.** Kutu neyi açacak? `p:<ürün id>` · `cat:<kategori no>` (src/categories.json) · `brand:<Marka>` · `q:<arama>`.
   Ürün yeni geldiyse güncel katalog: `claude/is/banner-ekle.md` adım 1.
2. **Resim.** Bir ürün fotoğrafı getir (banner-ekle.md adım 2), kes:
   `python3 tools/banner/cut.py <girdi> /tmp/x.png` → zemin + gölge:
   `python3 tools/banner/kapak.py /tmp/x.png hosting/public/bn/ad-<id>.webp <ton> kesfet`
   Ton: `nane` · `buz` · `gri` · `kum` · `gul` (mor yok; yan yana kutularda aynı ton art arda gelmesin).
   Çıkan resmi aç, bak: ürün tam görünüyor mu, kenarda beyaz hale var mı, **kablo halkalarının içi beyaz kalmış mı**
   (cut.py artık kapalı beyaz alanları da siler; beyaz gövdeli üründe 5. değer `0`).
   Var olan resmi DEĞİŞTİRDİYSEN satıra `"v": <sayı>` ekle/artır (telefonlar eskisini önbellekten göstermesin).
3. **Kayıt ekle** — `src/icerik/kesfet.json`, tek satır (sıra = ekrandaki sıra):
   ```json
   {"id":"jbc-uc","logo":"/brands/jbc.png","eye":"Havya uçları","title":"Doğru uç,\ntemiz lehim.","sub":"JBC C210 ve C245 uçlar","link":"q:jbc uç","cta":"Uçlara bak"}
   ```
   - `title` en çok 2 kısa satır (`\n`), `sub` tek satır, `cta` 1–3 kelime. `logo` yoksa sadece `eye` yaz.
   - `id` = resim adının `ad-` sonrası.
4. **Kaldır / kapat:** satıra `"off": true` (kod tarafında). Kullanıcı kendisi de Tasarım modundan gizleyebilir
   (`shopHome.cd.ads.off`). Sıra: satırları taşı.
5. **Derle, göster, yayınla:** banner-ekle.md adım 6. Keşfet bölümü sadece 'Claude düzeni' açıkken görünür; demoda
   `window.__store` ile `settings.look.cd = true` ve `shopHome.layout`'a `cd:ads` ekleyip bak.
