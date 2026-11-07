# Tarif: Kategori kapağı (Ürünler açılış sayfası)

Kullanıcı: "Mikroskoplar kapağını değiştir" · "yeni kategoriye kapak yap".
Bölüm: `hub` (claude/bolumler.json). Kod: `src/cdhome.jsx` `CdHub` — DOKUNMA.

1. Kategori no: `src/categories.json`.
2. O kategoriden temiz bir ürün fotoğrafı getir ve kes (banner-ekle.md adım 1–3), sonra:
   `python3 tools/banner/kapak.py /tmp/x.png hosting/public/bn/cat-<no>.webp <ton> kapak`
   (800×600; ton nane | buz | gri | kum | gul — komşu kapaklarla aynı ton art arda gelmesin).
3. `src/icerik/kapaklar.json`'a satır: `"<no>": "/bn/cat-<no>.webp"` (varsa aynı satırı değiştir).
   Kullanıcının panelden seçtiği kapak (`shopHome.p0catImg`) varsa bizimki ÖNCE gelir (kullanıcı kararı 7.11.2026).
4. Derle, göster, yayınla (banner-ekle.md adım 6).
