# ERTEL Toptan — Kurulum (yaklaşık 20 dakika, ücretsiz)

Uygulama iki modda çalışır:
- **Demo modu**: `config.js` boşsa. Veriler sadece o tarayıcıda durur; denemek içindir.
- **Gerçek mod**: Firebase bilgileri girilince. Herkes aynı veriyi görür, mesajlar anında gelir.

## 1. Firebase projesi aç
1. https://console.firebase.google.com → **Proje ekle** → isim: `ertel-toptan` (Analytics gerekmez).
2. Sol menü **Build → Authentication → Başlayın → Sign-in method → E-posta/Şifre → Etkinleştir**.
   (Kullanıcı adları arka planda `kullaniciadi@toptan.ertelgsm.app` e-postasına çevrilir, müşteri e-posta görmez.)
3. **Build → Firestore Database → Veritabanı oluştur** → konum: `eur3 (europe-west)` → **üretim modu**.
4. **Proje ayarları (⚙) → Genel → Uygulamalarınız → Web (</>)** → takma ad yazın → kaydedin.
   Çıkan `firebaseConfig` içindeki değerleri `hosting/public/config.js` dosyasına yapıştırın.

> **Ürün resimleri** doğrudan ertelgsm.com'un resim sunucusundan (platincdn.com) gösterilir; Firebase'de yer kaplamaz.
> Sitede resmi değiştirirseniz uygulamada da değişir. Elle yüklenen resimler ve profil fotoğrafları küçültülüp Firestore'da tutulur.
> (Firebase Storage ücretli plana bağlı olduğu için kullanılmıyor.)

## 2. Yayınla (Firebase Hosting)
Bilgisayarda Node.js kurulu olmalı (https://nodejs.org). Sonra `hosting` klasöründe terminal açın:

```
npm install -g firebase-tools
firebase login
firebase use --add          (projenizi seçin)
firebase deploy
```

Komut bitince `https://ertel-toptan.web.app` gibi bir adres verir. Güvenlik kuralları (`firestore.rules`) da aynı komutla yüklenir.

## 3. İlk giriş
1. Adresi açın → **İlk kurulum: yönetici hesabı** ekranı çıkar → dükkan adı, kullanıcı adı, şifre (en az 6 karakter).
2. Yönetici olarak girdiğinizde Excel'deki 2.766 ürün otomatik yüklenir.
3. **Müşteriler → Yeni müşteri** ile toptancılarınıza hesap açın; çıkan bilgiyi WhatsApp'tan gönderin.

## 4. Telefona uygulama gibi kurma
- **iPhone**: Safari'de adresi aç → Paylaş → *Ana Ekrana Ekle*.
- **Android**: Chrome'da aç → menü → *Uygulamayı yükle*.

İleride Play Store / App Store'a koymak isterseniz aynı kod Capacitor ile paketlenebilir.

## Ücretsiz plan sınırları (Spark)
| Kaynak | Günlük ücretsiz | Bu uygulamada |
|---|---|---|
| Firestore okuma | 50.000 | Katalog cihazda önbelleklenir; açılış başına ~3–5 okuma. Resimli ürün başına +1. |
| Firestore yazma | 20.000 | Mesaj başına 2 yazma. |
| Depolama | 1 GB | Katalog ~0,4 MB; resimler ~40–60 KB/adet. |
| Hosting | 10 GB/ay trafik | Uygulama ~700 KB. |

50–100 aktif bayiye kadar rahat yeter. Aşılırsa kart ekleyip Blaze plana geçmek gerekir (kullandıkça öde, bu ölçekte genelde $0–2/ay).

## Ürünleri güncelleme
Sitenizden yeni Excel'i alın → **Ayarlar → Veri → Dosya seç**. Aynı ürün no'su güncellenir, yeniler eklenir,
yüklediğiniz resimler ve elle girdiğiniz toptan fiyatlar korunur.

## Ürünleri, resimleri, etiketleri güncelleme
PlatinMarket panelinden iki dışa aktarım alın ve **Ayarlar → Veri → Excel'den ürün güncelle** ile sırayla yükleyin:
1. **Ürünler Varyasyonlu** → resimler (10'a kadar), marka, 2. kategori, gizli etiketler, açıklama
2. **Ürünler** → stok adetleri

Elle yüklediğiniz resimler ve elle girdiğiniz toptan fiyatlar korunur. Etiketleri tek tek düzenlemek için
Ürünler → ürün → Düzenle → "Gizli etiketler". Bayiler etiketleri görmez; sadece aramada işe yarar.

## Şifre unutan müşteri
Firebase'in ücretsiz planında yönetici, başkasının şifresini uygulamadan değiştiremez. En pratiği:
Müşteriler → ilgili kişi → **Hesap aktif** kapat → yeni kullanıcı adıyla tekrar aç.

## Bilgisayarda denemek
- `DEMO.html` dosyasına çift tıklayın: internetsiz, tek dosya demo.
- veya `hosting/public` klasöründe `python -m http.server 8080` → http://localhost:8080

## Kaynak kod
`src/` klasöründe. Değiştirdikten sonra `python3 tools/build.py` ile `hosting/public/index.html` yeniden üretilir.
Varsayılan ayarlar ve kategori isimleri: `src/config.js`.
