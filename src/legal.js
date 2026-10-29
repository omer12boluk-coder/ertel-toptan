// Yasal metinler (29.10.2026): KVKK aydınlatma metni, gizlilik ve çerez politikası, üyelik sözleşmesi,
// ön bilgilendirme formu, mesafeli satış sözleşmesi. Varsayılanlar burada; yönetici Ayarlar > Alt bilgi ve sayfalar >
// Yasal metinler'den değiştirebilir (settings.legal.docs[k] boş = varsayılan). Metin biçimi footer RichText ile aynı
// (boş satır = paragraf, "- " madde, **kalın**). {ALAN} yer tutucuları fillLegal() ile doldurulur: satıcı bilgileri
// ayarlardan, alıcı / sipariş bilgileri siparişten (ödeme adımında o anki form, sipariş sayfasında kayıtlı sipariş).
// Metinler e-ticaret için yaygın kalıptır; kullanıcıya avukat / mali müşavir kontrolü önerildi.

export const LEGAL_V = 1; // metin sürümü: siparişte onay kaydına yazılır (legal.v); metinler esaslı değişince artırılabilir

export const LEGAL_DOCS = [
  { k: 'kvkk', slug: 'kvkk-aydinlatma-metni', title: 'KVKK Aydınlatma Metni' },
  { k: 'gizlilik', slug: 'gizlilik-ve-cerez-politikasi', title: 'Gizlilik ve Çerez Politikası' },
  { k: 'uyelik', slug: 'uyelik-sozlesmesi', title: 'Üyelik Sözleşmesi' },
  { k: 'onbilgi', slug: 'on-bilgilendirme-formu', title: 'Ön Bilgilendirme Formu' },
  { k: 'mesafeli', slug: 'mesafeli-satis-sozlesmesi', title: 'Mesafeli Satış Sözleşmesi' },
];
export const legalDoc = (k) => LEGAL_DOCS.find((d) => d.k === k || d.slug === k) || null;

const SELLER = `**Unvan:** {SATICI_UNVAN}
**Adres:** {SATICI_ADRES}
**Telefon:** {SATICI_TEL}
**E-posta:** {SATICI_EPOSTA}
**Vergi dairesi / no:** {SATICI_VERGI}
**MERSİS no:** {SATICI_MERSIS}`;

const BUYER = `**Adı soyadı / unvanı:** {ALICI_AD}
**Teslimat adresi:** {ALICI_ADRES}
**Telefon:** {ALICI_TEL}
**E-posta:** {ALICI_EPOSTA}
**Fatura bilgisi:** {ALICI_FATURA}`;

export const LEGAL_DEFAULTS = {
  kvkk: `**{SATICI_UNVAN}** ("Şirket") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında **veri sorumlusu** sıfatıyla kişisel verilerinizi aşağıda açıklanan şekilde işliyoruz.

**1. İşlenen kişisel veriler**

- **Kimlik:** ad, soyad; kurumsal faturada firma unvanı; isteğe bağlı TC kimlik numarası (fatura için).
- **İletişim:** telefon numarası, e-posta adresi, teslimat ve fatura adresi.
- **Müşteri işlem:** sipariş içeriği, sipariş tutarı, sipariş ve kargo geçmişi, favoriler, ürün talepleri ve sorun bildirimleri (gönderdiğiniz fotoğraf / video dahil), bizimle yazışmalarınız.
- **Finans:** vergi dairesi ve vergi numarası, ödeme yöntemi bilgisi. Kart bilgileriniz Şirketimiz tarafından **saklanmaz**; kartla ödemeler lisanslı ödeme kuruluşu üzerinden yapılır.
- **İşlem güvenliği:** üyelik giriş kayıtları, cihaz / tarayıcı bilgisi, bildirim aboneliği bilgisi, kötüye kullanımı önlemeye yönelik kayıtlar.

**2. İşleme amaçları**

- Üyelik hesabınızın açılması ve yönetilmesi,
- Siparişlerinizin alınması, hazırlanması, faturalandırılması, kargoya verilmesi ve teslimi,
- Sipariş durumu, kargo ve (izin verdiyseniz) favori ürün fiyat bildirimlerinin gönderilmesi,
- Ürün talebi, iade, değişim ve sorun bildirimlerinizin karşılanması, müşteri hizmetleri,
- Mesafeli satış ve tüketici mevzuatı, vergi ve ticaret mevzuatından doğan yükümlülüklerin yerine getirilmesi,
- Bilgi güvenliğinin sağlanması ve hizmetin kötüye kullanılmasının önlenmesi.

**3. Hukuki sebepler (KVKK m.5)**

Kişisel verileriniz; bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması, Şirketimizin hukuki yükümlülüğünü yerine getirebilmesi, bir hakkın tesisi, kullanılması veya korunması ve temel hak ve özgürlüklerinize zarar vermemek kaydıyla Şirketimizin meşru menfaati hukuki sebeplerine dayanılarak işlenir.

**4. Toplama yöntemi**

Verileriniz; internet sitemiz ve mobil uygulama görünümümüzdeki üyelik, sipariş, talep ve iletişim formları, WhatsApp / telefon / e-posta yazışmaları ve mağazamızda yüz yüze yapılan işlemler aracılığıyla elektronik veya fiziki ortamda toplanır.

**5. Aktarım**

Kişisel verileriniz yukarıdaki amaçlarla sınırlı olarak;

- Siparişinizin teslimi için **kargo firmalarına** (DHL eCommerce / MNG Kargo, Yurtiçi Kargo),
- Kartla ödeme için **ödeme kuruluşlarına**,
- Muhasebe, e-fatura / e-arşiv ve mali müşavirlik hizmeti aldığımız taraflara,
- Hizmetin teknik altyapısını sağlayan **barındırma, veritabanı, e-posta ve bildirim hizmeti sağlayıcılarına** (ör. Google Firebase, Cloudflare, e-posta gönderim hizmeti),
- Talep halinde yetkili kamu kurum ve kuruluşlarına

aktarılabilir. Altyapı hizmet sağlayıcılarımızın bir kısmının sunucuları yurt dışında bulunduğundan, bu aktarımlar KVKK'nın 9. maddesine uygun olarak gerçekleştirilir.

**6. Saklama süresi**

Verileriniz işleme amacının gerektirdiği süre ve ilgili mevzuatta öngörülen süreler boyunca (ör. ticari defter ve belgeler için 10 yıl) saklanır; süre dolunca silinir, yok edilir veya anonim hale getirilir. Ürün talebi ve sorun bildirimi fotoğrafları, işlem tamamlandıktan sonra kısa süre içinde silinir.

**7. Haklarınız (KVKK m.11)**

Şirketimize başvurarak; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, KVKK m.7 kapsamında silinmesini veya yok edilmesini isteme, bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuca itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz.

Başvurularınızı **{SATICI_EPOSTA}** adresine e-posta ile ya da **{SATICI_ADRES}** adresine yazılı olarak iletebilirsiniz. Başvurunuz en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.`,

  gizlilik: `Bu politika, **{SATICI_UNVAN}** tarafından işletilen online mağazamızı kullanırken bilgilerinizin nasıl korunduğunu açıklar. Kişisel verilerinizin işlenmesine ilişkin ayrıntılar için **KVKK Aydınlatma Metni**'ni inceleyiniz.

**Bilgi güvenliği**

- Sitemiz yalnızca şifreli bağlantı (HTTPS) üzerinden çalışır.
- Şifreniz bizim tarafımızdan görülemez; giriş işlemleri güvenli kimlik doğrulama altyapısıyla yapılır.
- Kart bilgileriniz sitemizde saklanmaz; kartla ödemeler lisanslı ödeme kuruluşunun güvenli sayfasında yapılır.
- Siparişlerinize ve hesap bilgilerinize yalnızca siz ve yetkili Şirket personeli erişebilir.

**Çerezler ve cihazda saklanan bilgiler**

Sitemiz reklam veya pazarlama amaçlı **izleme çerezi kullanmaz**. Sitenin çalışması için zorunlu olan bazı bilgiler tarayıcınızda (yerel depolama) saklanır:

- Oturum bilgisi (giriş yapmış kalmanız için),
- Sepetiniz, favorileriniz ve misafir olarak verdiğiniz siparişlerin numaraları,
- Görünüm tercihleriniz (gece modu, liste / kutu görünümü),
- Siteyi hızlandırmak için ürün listesi ve resimlerin geçici kopyaları,
- Bildirim izni verdiyseniz bildirim aboneliği.

Bu bilgileri tarayıcınızın ayarlarından silebilirsiniz; bu durumda sepetiniz ve tercihleriniz sıfırlanır.

**Bildirimler**

Telefon bildirimleri yalnızca siz izin verirseniz gönderilir ve Hesabım > Bildirimler bölümünden istediğiniz zaman kapatılabilir. İzniniz olmadan reklam amaçlı ticari elektronik ileti gönderilmez.

**İletişim**

Sorularınız için: **{SATICI_EPOSTA}** · **{SATICI_TEL}**`,

  uyelik: `**1. Taraflar**

Bu sözleşme, **{SATICI_UNVAN}** ("Şirket") ile online mağazaya üye olan kişi ("Üye") arasında, üyelik formunun onaylanmasıyla elektronik ortamda kurulmuştur.

**2. Konu**

Sözleşmenin konusu, Üye'nin online mağazadan yararlanma koşullarının ve tarafların hak ve yükümlülüklerinin belirlenmesidir.

**3. Üyenin yükümlülükleri**

- Üye, üyelik ve sipariş sırasında verdiği bilgilerin doğru ve güncel olduğunu kabul eder.
- Üye, şifresinin gizliliğinden sorumludur; hesabıyla yapılan işlemler kendisine aittir.
- Üye, siteyi hukuka ve genel ahlaka aykırı amaçlarla kullanmamayı, sisteme zarar verecek, aşırı yük oluşturacak veya kötüye kullanım niteliğindeki işlemlerden (ör. aynı içeriği tekrar tekrar gönderme) kaçınmayı kabul eder.
- Üye'nin gönderdiği ürün talebi, sorun bildirimi, yorum, fotoğraf ve videoların hukuka uygun olmasından Üye sorumludur.

**4. Şirketin hak ve yükümlülükleri**

- Şirket, sitede yer alan ürün, fiyat ve kampanyaları önceden bildirmeksizin değiştirebilir. Siparişi verilmiş ürünlerde sipariş anındaki fiyat geçerlidir.
- Şirket, bu sözleşmeye aykırı davranan veya kötüye kullanım tespit edilen üyeliği askıya alabilir veya sona erdirebilir; kötüye kullanılan içerikleri kaldırabilir.
- Şirket, Üye'nin kişisel verilerini **KVKK Aydınlatma Metni**'nde belirtilen şekilde işler.

**5. Sipariş ve satış**

Üye'nin verdiği her sipariş için ayrıca **Ön Bilgilendirme Formu** ve **Mesafeli Satış Sözleşmesi** düzenlenir; satış bu belgelere tabidir.

**6. Sözleşmenin süresi ve sona ermesi**

Sözleşme süresizdir. Üye, dilediği zaman üyeliğinin silinmesini {SATICI_EPOSTA} adresine yazarak talep edebilir. Mevzuat gereği saklanması zorunlu sipariş ve fatura kayıtları bu durumda da yasal süre boyunca saklanır.

**7. Uyuşmazlıklar**

Bu sözleşmeden doğan uyuşmazlıklarda Türkiye Cumhuriyeti hukuku uygulanır; İstanbul mahkemeleri ve icra daireleri yetkilidir. Tüketici sıfatına sahip üyelerin tüketici hakem heyeti ve tüketici mahkemelerine başvuru hakları saklıdır.`,

  onbilgi: `6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, sipariş onayından önce aşağıdaki konularda bilgilendirildiğinizi kabul edersiniz.

**1. Satıcı bilgileri**

${SELLER}

**2. Alıcı bilgileri**

${BUYER}

**3. Sözleşme konusu ürünler**

{URUNLER}

**Toplam:** {TOPLAM}
**Kargo ücreti:** {KARGO_UCRETI}
**Ödeme şekli:** {ODEME}
**Teslimat şekli:** {TESLIMAT}

**4. Teslimat**

Ürünler, sipariş onayından itibaren yasal **30 günlük** süreyi aşmamak kaydıyla, stokta olanlar genellikle aynı gün veya en geç 3 iş günü içinde kargoya verilir. Kargo ücreti, aksi belirtilmedikçe Alıcı'ya aittir. Dükkândan teslim seçildiyse ürün, hazır olduğu bildirildikten sonra Satıcı'nın adresinden teslim alınır.

**5. Cayma hakkı**

Alıcı, ürünü teslim aldığı tarihten itibaren **14 gün** içinde hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir. Cayma bildirimi bu süre içinde {SATICI_EPOSTA} adresine e-posta ile, WhatsApp / telefonla ya da yazılı olarak yapılabilir. Ürün, cayma bildiriminden itibaren 10 gün içinde, kullanılmamış ve yeniden satılabilir durumda, faturası ve varsa orijinal ambalajıyla birlikte iade edilmelidir. Cayma hakkının kullanılmasında iade kargo ücreti, ürün ayıplı değilse Alıcı'ya aittir. Satıcı, cayma bildiriminin kendisine ulaşmasından itibaren **14 gün** içinde ürün bedelini Alıcı'nın ödeme yaptığı yönteme iade eder.

**Cayma hakkının kullanılamayacağı durumlar (Yönetmelik m.15):** Alıcı'nın istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan ürünler; tesliminden sonra ambalajı, bandı, mührü veya paketi açılmış olup sağlık ve hijyen açısından iadesi uygun olmayan ürünler; tesliminden sonra başka ürünlerle karışan ve doğası gereği ayrıştırılması mümkün olmayan ürünler; elektronik ortamda anında ifa edilen hizmetler ve tüketiciye anında teslim edilen gayrimaddi mallar.

**6. Şikâyet ve itiraz**

Alıcı, şikâyet ve itirazlarını Satıcı'nın yukarıdaki iletişim bilgilerine iletebilir; ayrıca her yıl Ticaret Bakanlığı'nca ilan edilen parasal sınırlar dahilinde Alıcı'nın veya Satıcı'nın yerleşim yerindeki **Tüketici Hakem Heyeti**'ne ya da **Tüketici Mahkemesi**'ne başvurabilir.

**Tarih:** {TARIH}`,

  mesafeli: `**MADDE 1 – TARAFLAR**

**1.1. SATICI**

${SELLER}

**1.2. ALICI**

${BUYER}

**MADDE 2 – KONU**

İşbu sözleşmenin konusu, Alıcı'nın Satıcı'ya ait online mağazadan elektronik ortamda siparişini verdiği, aşağıda nitelikleri ve satış fiyatı belirtilen ürünlerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin belirlenmesidir.

**MADDE 3 – SÖZLEŞME KONUSU ÜRÜNLER**

{URUNLER}

**Toplam:** {TOPLAM}
**Kargo ücreti:** {KARGO_UCRETI}
**Ödeme şekli:** {ODEME}
**Teslimat şekli:** {TESLIMAT}
**Sipariş tarihi:** {TARIH}

**MADDE 4 – GENEL HÜKÜMLER**

- 4.1. Alıcı, sözleşme konusu ürünlerin temel nitelikleri, satış fiyatı, ödeme şekli ve teslimata ilişkin **Ön Bilgilendirme Formu**'nu okuyup bilgi sahibi olduğunu ve elektronik ortamda gerekli onayı verdiğini kabul eder.
- 4.2. Ürünler, yasal 30 günlük süreyi aşmamak koşuluyla Alıcı'nın belirttiği adrese kargo ile gönderilir ya da Alıcı'nın tercihi halinde Satıcı'nın adresinden teslim edilir. Kargo ücreti aksi belirtilmedikçe Alıcı'ya aittir.
- 4.3. Satıcı, ürünü sağlam, eksiksiz ve siparişte belirtilen niteliklere uygun teslim etmekle yükümlüdür.
- 4.4. Ürünün tesliminden sonra Alıcı'ya ait kredi kartının yetkisiz kişilerce haksız kullanılması nedeniyle ilgili banka veya ödeme kuruluşunun ürün bedelini Satıcı'ya ödememesi halinde Alıcı, ürünü 3 gün içinde Satıcı'ya iade etmekle yükümlüdür.
- 4.5. Satıcı, mücbir sebepler veya stok tükenmesi gibi nedenlerle ürünü teslim edemeyeceğini anlarsa durumu Alıcı'ya bildirir ve ödenen bedeli en geç 14 gün içinde iade eder.
- 4.6. Teslimat sırasında kargo paketinin hasarlı olduğu görülürse Alıcı, paketi teslim almadan kargo görevlisine tutanak tutturmalıdır.
- 4.7. Havale / EFT ile yapılan ödemelerde sipariş, ödemenin Satıcı hesabına geçmesiyle hazırlanmaya başlar.

**MADDE 5 – CAYMA HAKKI**

- 5.1. Alıcı, ürünün kendisine veya gösterdiği adresteki kişiye tesliminden itibaren **14 gün** içinde hiçbir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir.
- 5.2. Cayma bildirimi bu süre içinde {SATICI_EPOSTA} adresine e-posta ile, WhatsApp / telefonla ya da yazılı olarak Satıcı'ya yapılır.
- 5.3. Alıcı, cayma bildiriminden itibaren 10 gün içinde ürünü; kullanılmamış, yeniden satılabilir durumda, faturası ve varsa orijinal ambalajı, aksesuarları ile birlikte Satıcı'ya iade eder. Ürün ayıplı değilse iade kargo ücreti Alıcı'ya aittir.
- 5.4. Satıcı, cayma bildiriminin kendisine ulaşmasından itibaren 14 gün içinde ürün bedelini Alıcı'nın ödeme yaptığı yönteme iade eder.
- 5.5. Ürünün Alıcı'nın kusuruyla değer kaybetmesi veya iadesinin imkânsızlaşması halinde Alıcı, Satıcı'nın zararını tazmin eder. Ürünün olağan kullanımı (ör. kutudan çıkarıp inceleme) değer kaybı sayılmaz.

**MADDE 6 – CAYMA HAKKININ İSTİSNALARI**

Mesafeli Sözleşmeler Yönetmeliği m.15 uyarınca; Alıcı'nın istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan ürünler, tesliminden sonra ambalajı, bandı, mührü veya paketi açılmış olup sağlık ve hijyen açısından iadesi uygun olmayan ürünler, tesliminden sonra başka ürünlerle karışan ve doğası gereği ayrıştırılması mümkün olmayan ürünler ve anında ifa edilen hizmetler için cayma hakkı kullanılamaz.

**MADDE 7 – AYIPLI ÜRÜN VE GARANTİ**

Ayıplı ürünlerde Alıcı, 6502 sayılı Kanun'un 11. maddesinde sayılan seçimlik haklarını (bedel iadesi, indirim, ücretsiz onarım veya ayıpsız misli ile değişim) kullanabilir. Hatalı veya hasarlı gönderilen ürünlerde kargo ücreti Satıcı'ya aittir.

**MADDE 8 – UYUŞMAZLIKLARIN ÇÖZÜMÜ**

İşbu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığı'nca her yıl ilan edilen parasal sınırlar dahilinde Alıcı'nın veya Satıcı'nın yerleşim yerindeki **Tüketici Hakem Heyetleri**, bu sınırları aşan durumlarda **Tüketici Mahkemeleri** yetkilidir. Alıcı'nın tacir olduğu ve ürünleri ticari / mesleki amaçla satın aldığı hallerde İstanbul mahkemeleri ve icra daireleri yetkilidir.

**MADDE 9 – YÜRÜRLÜK**

Alıcı, sipariş sırasında işbu sözleşmeyi okuyup tüm koşulları kabul ettiğini elektronik ortamda onaylamıştır. Sözleşme, siparişin tamamlanmasıyla yürürlüğe girer. Sözleşmenin bir kopyası Alıcı'nın sipariş sayfasında (Hesabım > Siparişlerim) her zaman görüntülenebilir.`,
};

// Satıcı bilgileri ayarlardan (Alt bilgi: unvan, adres, telefon, e-posta + Yasal metinler: vergi, MERSİS)
function sellerVals(S) {
  const F = S.footer || {}; const L = S.legal || {};
  const dash = '—';
  return {
    SATICI_UNVAN: F.company || S.brand?.appName || dash,
    SATICI_ADRES: F.address || S.shop?.address || dash,
    SATICI_TEL: (F.phones || []).map((p) => p.phone).filter(Boolean)[0] || S.shop?.phone || dash,
    SATICI_EPOSTA: L.email || F.email || dash,
    SATICI_VERGI: [L.taxOffice, L.taxNo].filter(Boolean).join(' / ') || dash,
    SATICI_MERSIS: L.mersis || dash,
  };
}

// o: { name, addr, phone, email, invoice, items: [{n, qty, line}], total, ship, pay, deliv, date } — boş alanlar "sipariş sırasında doldurulur"
export function fillLegal(text, S, o) {
  const later = o ? '—' : '(sipariş sırasında doldurulur)';
  const vals = {
    ...sellerVals(S),
    ALICI_AD: o?.name || later, ALICI_ADRES: o?.addr || later, ALICI_TEL: o?.phone || later, ALICI_EPOSTA: o?.email || later,
    ALICI_FATURA: o?.invoice || later,
    URUNLER: o?.items?.length ? o.items.map((x) => `- ${x.n} — ${x.qty} adet${x.line ? ' × ' + x.line : ''}`).join('\n') : later,
    TOPLAM: o?.total || later, KARGO_UCRETI: o?.ship || 'Alıcıya ait (kargo firmasına teslimde ödenir)', ODEME: o?.pay || later, TESLIMAT: o?.deliv || later,
    TARIH: o?.date || later,
  };
  return String(text || '').replace(/\{([A-Z_]+)\}/g, (m, k) => (k in vals ? vals[k] : m));
}

export const legalText = (S, k) => (S.legal?.docs?.[k] || '').trim() || LEGAL_DEFAULTS[k] || '';
