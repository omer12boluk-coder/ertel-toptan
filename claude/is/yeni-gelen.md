# Tarif: Yeni gelenler / Bu hafta masamızdan (sabitleme, sıra)

Kullanıcı: "DA88'i yeni gelenlere koy / sabitle" · "masamızdan'a şunu ekle".
Bölümler: `cd:new` (Yeni gelenler), `cd:pick` (Bu hafta masamızdan) — claude/bolumler.json.

## Önemli: bunlar CANLI AYAR
Seçili ürünler `settings/main` içinde (`shopHome.cd.nw.ids`, `shopHome.cd.pick.ids`); repoda değil. Claude bunlara
yazamaz. Bu yüzden:
- **Yeni gelenler kendiliğinden dolar:** sıra `byArrival` (ürünün `ft` geliş anı; yoksa id). Claude'dan gelenler'den
  onaylanan ya da sitede yeni çıkan ürün hiçbir şey yapmadan en başa gelir. Çoğu zaman yapılacak iş YOKTUR — bunu söyle.
- **Elle sabitlemek** (öne almak / gizlemek) kullanıcının işi: Tasarım modu › ana sayfada bölüme dokun › panelde
  ürün ara › 'Sabitle'. Kısaca bu yolu tarif et; ekran görüntüsü gerekirse demoda çek.
- Varsayılan başlık/üst yazı değişikliği de Tasarım modundan (ayar `eye`, `title`).

## Repoda değişiklik gerekiyorsa
Sadece varsayılanlar (`src/cdhome.jsx` `CdNew`/`CdPick` içindeki `'Yeni gelenler'`, `'Bu hafta masamızdan.'`) ya da
kart görünümü — bu rutin iş değildir: önce kullanıcıya göster (CLAUDE.md §2 kuralları).
