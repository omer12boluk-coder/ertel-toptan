// Paket 0 bölüm anahtarları (ayrı dosya: döngüsel içe aktarmada modül yüklenirken hazır olsun)
// 7.11.2026: 'Claude düzeni' bölümleri (cd:*) de burada — layoutOf bunları da kendiliğinden EKLEMEZ, sadece kayıtlı sırada varsa çizer
export const CD_KEYS = { 'cd:hero': 'Banner', 'cd:pick': 'Bu hafta masamızdan', 'cd:sets': 'Atölyeni kur', 'cd:brands': 'Markalar', 'cd:mq': 'Akan şerit' };
export const P0_KEYS = { 'p0:hero': 'Üçlü vitrin', 'p0:find': 'Hızlı bulucu', 'p0:cats': 'Kategori karoları', 'p0:pick': 'Tamircinin seçimi', 'p0:sets': 'Atölyeni kur (setler)', 'p0:brands': 'Akan marka bandı', 'p0:trust': 'Güven şeridi', ...CD_KEYS };
