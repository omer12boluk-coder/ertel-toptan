# Tarif: Sırala / kapat / kaldır (banner, Keşfet, kapak)

Kullanıcı: "masa kutusunu kaldır" · "Quick bannerını kapat" · "JBC'yi başa al".

| Ne | Nerede | Nasıl |
|---|---|---|
| Keşfet kutusu kapat | `src/icerik/kesfet.json` | satıra `"off": true` (silme; geri açılabilsin) |
| Keşfet sırası | aynı dosya | satırı taşı (ekrandaki sıra = dosya sırası) |
| Banner kapat | `src/icerik/bannerlar.json` | satıra `"off": true` |
| Banner sırası | **canlı ayar** (`shopHome.slides`) | Claude yazamaz → kullanıcıya: Tasarım › Banner › sürükle. Yeni bannerda `"bas": true` = en öne girer |
| Kapak kaldır | `src/icerik/kapaklar.json` | satırı sil (kullanıcının kendi kapağı ya da ürün resmi görünür) |

Sonra: derle, göster, yayınla (banner-ekle.md adım 6). "Kaldır" deyince bile `off` kullan; gerçekten silmek isterse
satırı ve `hosting/public/bn/` resmini sil.
