// =====================================================================
//  VARSAYILAN AYARLAR
//  Uygulamadaki "Ayarlar" ekranı bu değerlerin üzerine yazar.
//  Buradaki değerler sadece ilk kurulumda / ayar bulunmadığında kullanılır.
// =====================================================================

import LOGO_MARK from '../assets/logo-mark.png';
import LOGO_WIDE from '../assets/logo-wide.png';
export { LOGO_MARK, LOGO_WIDE };

export const DEFAULT_SETTINGS = {
  brand: {
    appName: 'ERTEL GSM',
    tagline: 'Bayilere özel katalog',
    nameColor: '', // telefonda üst menüdeki mağaza adının rengi (boş = yazı rengi)
    accent: '#2f55b0', // ana renk (logodaki lacivert)
    priceAccent: '#c2410c', // toptan fiyat rengi
    theme: 'light', // auto | light | dark  (her cihaz üst menüden kendine göre değiştirebilir)
    logo: '', // boşsa ERT Mobile amblemi kullanılır; Ayarlar > Genel'den değiştirilebilir
    splashSec: 1.4, // açılış ekranının en az görünme süresi (sn); site daha geç yüklenirse en fazla +3 sn bekler
    splashOn: true, // açılış ekranı (mağaza ve bayi; oturumda bir kez). Ayarlar > Genel'den kapatılır
    splash: '/splash/dukkan.jpg',
    logoWide: '', // boşsa ERT Mobile yatay logo (giriş ekranı)
  },
  pricing: {
    mode: 'steps', // 'steps' = fiyat aralığına göre sabit USD indirim (aşağıdaki tablo), 'pct' = liste fiyatından % indirim
    steps: [ // {to: bu fiyata kadar (dahil), off: USD indirim}; son satır to: null = ve üstü
      { to: 5, off: 0.5 }, { to: 25, off: 1 }, { to: 60, off: 2 }, { to: 170, off: 3 }, { to: 300, off: 5 }, { to: 700, off: 10 }, { to: null, off: 20 },
    ],
    discountPct: 10, // mode 'pct' iken: ürüne özel toptan fiyat yoksa liste fiyatından % indirim
    noWholesale: 'discount', // 'discount' = indirimle hesapla, 'ask' = "Fiyat sorun" göster
    roundStep: 0.5, // toptan fiyat yuvarlama adımı (0.01 / 0.5 / 1)
    adjustStep: 1, // yönetici teklif ekranında -/+ butonlarının adımı
    showRetail: true, // liste (perakende) fiyatı göster
    showSaving: false, // sepette "avantajınız" satırını göster
    showVat: true, // toplamın altında KDV bilgisini göster
    vatPct: 20, // KDV oranı: sadece toplamın altında bilgi olarak gösterilir (0 = gösterme)
    showVatInc: false, // ürün fiyatının altında soluk "KDV dahil … $ · … ₺" satırı (bayi + vitrin)
    plusVat: false, // fiyatın yanında küçük "+KDV" ibaresi
    showTL: false, // dolar fiyatların TL karşılığını bayilere / vitrine de göster (yönetici her zaman görür)
    manualRate: '', // doluysa Harem Altın kuru yerine bu kur kullanılır (1 USD = ? TL)
  },
  tiers: [
    { id: 'standart', name: 'Standart', pct: 0 },
    { id: 'gumus', name: 'Gümüş', pct: 2 },
    { id: 'altin', name: 'Altın', pct: 4 },
  ],
  catalog: {
    stockMode: 'badge', // badge = Stokta/Az/Yok, number = adet, hidden = gizle
    lowStock: 3,
    showInactive: false, // pasif ürünleri bayilere göster
    hideOutOfStock: false,
    // Ürün resimleri ertelgsm.com (PlatinMarket CDN) üzerinden gösterilir; Firebase'de yer kaplamaz.
    // {pi} = siteden eşlenen resim dosya adı, {kod} = stok kodu, {id} = ürün no
    imageThumb: 'https://platincdn.com/3519/pictures/thumb/350X-{pi}',
    imageLarge: 'https://platincdn.com/3519/pictures/{pi}',
    siteUrl: 'https://www.ertelgsm.com',
    searchTags: true, // gizli etiketler aramada kullanılsın (müşteri etiketleri görmez)
    showBrand: true, // markayı ürün satırında göster
    showDescription: true, // ürün detayında açıklamayı göster
    pageSize: 60,
  },
  requests: {
    allowReserve: true, // "Hazırlayın, geliyorum"
    allowQuote: true, // "Fiyat sor / son ne olur?"
    allowMessage: true, // sepetsiz genel mesaj
    askPickupTime: true,
    noShowWarn: 2, // bu sayıda "gelmedi" olursa müşteri kartında uyarı
    adminQuick: ['Hazırlıyoruz, birazdan haber veririm.', 'Bu ürün şu an stokta yok.', 'Son fiyat bu, daha aşağı olmuyor.', 'Hazır, gelip alabilirsiniz.'],
    userQuick: ['Son ne olur?', 'Bugün gelip alırım.', 'Yarın gelirim.', 'Teşekkürler 👍'],
  },
  shop: {
    name: 'ERTEL GSM',
    address: 'Tahtakale, İstanbul',
    hours: 'Pzt–Cmt 09:00–18:30',
    phone: '',
    whatsapp: '',
    pickupNote: 'Siparişiniz hazırlandığında dükkandan teslim alabilirsiniz.',
    payInfo: '', // vitrin müşterisine gösterilecek havale / ödeme bilgisi
    // Telefonda dokunma: select 'smart' (sadece işe yarar yazılar seçilir) | 'none' (sadece yazı kutuları) | 'all' (her yer, eski hâli)
    // longPress: uzun basınca işlem menüsü (sağ tık menüsü) · imgMenu: resimlere basılı tutunca telefonun kendi Kaydet/Paylaş menüsü
    touch: { select: 'smart', longPress: true, imgMenu: false },
  },
  // Mağaza alt bilgisi ve bilgi sayfaları (Ayarlar > Alt bilgi ve sayfalar). Sayfa metni: boş satır = paragraf, "- " = madde, **kalın**
  footer: {
    on: true,
    about: 'Telefon tamircileri için ekipman ve sarf malzemeleri. Orijinal ürün, hızlı kargo.',
    address: 'Tahtakale Mah. Tahtakale Cad. 7-1 Sok. No: 305, Santral Center (Eski Türk Telekom Binası), Fatih / İstanbul',
    phones: [{ phone: '0(543) 722 76 36', name: 'Ömer Bölük' }],
    email: 'omer.12boluk@gmail.com',
    instagram: 'https://www.instagram.com/ertelgsmm/',
    facebook: 'https://www.facebook.com/search/top?q=ertel%20telekom%C3%BCnikasyon%20&locale=tr_TR',
    company: 'Ertel Telekomünikasyon Elektronik Bilgisayar San. ve Tic. Ltd. Şti.',
    pages: [
      { title: 'Kargo ve teslimat', body: 'Siparişleriniz anlaşmalı kargo firmamız **DHL** ile gönderilir. Dilerseniz **Yurtiçi Kargo** anlaşmamızla da gönderim yapabiliriz; sipariş notunda ya da WhatsApp üzerinden belirtmeniz yeterli.\n\n- Stokta olan ürünler genellikle aynı gün kargoya verilir.\n- Kargo ücreti ürün fiyatlarına dahil değildir ve alıcıya aittir.\n- Siparişiniz kargoya verildiğinde takip numarası size iletilir; siparişinizin durumunu Hesabım > Siparişlerim bölümünden izleyebilirsiniz.\n- Dilerseniz siparişinizi Tahtakale\'deki dükkânımızdan da teslim alabilirsiniz.' },
      { title: 'İade ve değişim', body: 'Teslim aldığınız ürünü **14 gün** içinde iade edebilirsiniz.\n\n- Ürün kullanılmamış, hasarsız ve orijinal kutusuyla birlikte gönderilmelidir.\n- İade talebinizi WhatsApp ya da e-posta ile bize iletin; iade adresini ve süreci size bildirelim.\n- Ürün bize ulaşıp kontrol edildikten sonra ücretiniz, ödeme yaptığınız yönteme iade edilir.\n- Hatalı ya da hasarlı gelen ürünlerde kargo ücreti bize aittir.' },
    ],
  },
  access: {
    allowSignup: true,
    publicShop: true, // /magaza herkese açık vitrin // bayiler giriş ekranından kendileri üye olabilir; yönetici onaylayınca girebilir
  },
  features: {
    profilePhoto: true,
    history: true,
  },
  // Online mağaza siparişleri (/magaza): misafir ya da üye sipariş verir, Yönetim paneli > Siparişler'e düşer
  orders: {
    enabled: true, // "Siparişi tamamla" açık mı (kapalıysa sadece WhatsApp listesi)
    cargo: true, // kargo ile gönderim
    pickup: true, // dükkandan teslim al
    payHavale: true, // havale / EFT
    payCard: true, // kredi kartı (ödeme linki gönderilir)
    payShop: true, // dükkanda ödeme (sadece dükkandan teslimde)
    signup: true, // mağazada üye olunabilsin
    // "Çok yakında": sistem hazır ama müşteriye henüz açılmadı (Ayarlar > Online mağaza'dan tek tıkla açılır)
    checkoutSoon: false, // sepette "Sepeti onayla" (online sipariş) çok yakında
    accountsSoon: false, // Hesabım / üyelik çok yakında
    cargoNote: 'Kargo ücreti ve teslim süresi sipariş onayında bildirilir.',
    cargoCompanies: ['Yurtiçi Kargo', 'Aras Kargo', 'MNG Kargo', 'PTT Kargo', 'Sürat Kargo', 'HepsiJet', 'Kolay Gelsin', 'UPS', 'DHL'],
    doneNote: 'Siparişiniz bize ulaştı. En kısa sürede kontrol edip size dönüş yapacağız.',
    push: true, // müşteri sipariş sayfasından bildirimleri açabilir; durum değişince telefonuna bildirim gider (web push, bekçi gönderir)
    pushTexts: { // boşsa varsayılan metin
      confirmed: 'Siparişiniz onaylandı, hazırlanıyor.',
      shipped: 'Siparişiniz kargoya verildi.',
      ready: 'Siparişiniz hazır, dükkândan teslim alabilirsiniz.',
      done: 'Siparişiniz teslim edildi. Teşekkür ederiz!',
      cancelled: 'Siparişiniz iptal edildi.',
    },
  },
  home: { title: '', subtitle: '', announcements: [], banners: [] },
  // Marka logoları ve renkleri (Ayarlar > Markalar): ana sayfa kutuları, kayan şerit, reklamlar kullanır
  brandLogos: {
    JBC: { logo: '/brands/jbc.png', color: '#e11d2a' }, Aixun: { logo: '/brands/aixun-dark.png', color: '#c8102e' },
    Mechanic: { logo: '/brands/mechanic-dark.png', color: '#1d4ed8' }, JCID: { logo: '/brands/jcid.png', color: '#1a9bf0' },
    Sunshine: { logo: '/brands/sunshine.png', color: '#0067ae' }, Relife: { logo: '/brands/relife.png', color: '#22a447' },
    '2UUL': { logo: '/brands/2uul.png', color: '#2fbf4a' }, Qianli: { logo: '/brands/qianli.png', color: '#b4232a' },
    LUBAN: { logo: '/brands/luban.png', color: '#9b3ff0' }, Amaoe: { logo: '/brands/amaoe.png', color: '#f07d1a' },
    AmScope: { logo: '/brands/amscope.png', color: '#1f3a8a' },
    Quick: { logo: '/brands/quick.png', color: '#d71920' }, Yihua: { logo: '/brands/yihua.png', color: '#e30613' },
    'Uni-T': { logo: '/brands/unit.png', color: '#d6001c' }, RF4: { logo: '/brands/rf4.png', color: '#119fa7' },
    // Logosu henüz olmayanlar: adları marka renginde yazılır (Ayarlar > Markalar'dan logo eklenebilir)
    YCS: { color: '#0f766e' }, 'Mega-Idea': { color: '#b4232a' }, 'Ma Ant': { color: '#16a34a' }, Mijing: { color: '#0e7490' },
    XZZ: { color: '#2563eb' }, Lanrui: { color: '#7c3aed' }, 'OSS Team': { color: '#ea580c' }, TBK: { color: '#0369a1' },
    Doseer: { color: '#be123c' }, Kaisi: { color: '#1d4ed8' }, SUGON: { color: '#dc2626' }, Ersa: { color: '#0057a8' },
    Fluke: { color: '#c99700' }, Korad: { color: '#0b5394' }, Alpha: { color: '#334155' },
  },
  // Online mağaza ana sayfası (Ayarlar > Mağaza ana sayfası). Resimler: 'si…' = shopimg kaydı, http… = dış link.
  // Link: 'brand:Aixun' | 'cat:3' | 'q:jbc uç' | 'p:1234' (ürün) | 'https://…' | ''
  shopHome: {
    enabled: true,
    slides: [
      { layout: 'split', theme: 'night', tag: 'Yeni gelenler', title: 'Tamir masanızın yeni yıldızları', text: 'Aixun, JCID, Mechanic, Sunshine, Luban ve daha fazlası. Orijinal ürün, aynı gün kargo.', cta: 'Yeni ürünleri gör', link: 'q:', img: 'prod:2882' },
      { layout: 'split', theme: 'ember', tag: 'Aixun', title: 'Akıllı havya istasyonları', text: 'T420D çift kanallı istasyon ve C210 / C245 / C115 uçları stokta.', cta: 'Aixun ürünleri', link: 'brand:Aixun', img: 'prod:1758' },
      { layout: 'split', theme: 'volt', tag: 'JCID', title: 'Face ID ve True Tone onarımı', text: 'JC V1SE adaptörleriyle iPhone 17 serisine kadar tam destek.', cta: 'JCID ürünleri', link: 'brand:JCID', img: 'prod:3001' },
      { layout: 'split', theme: 'violet', tag: 'AmScope', title: 'Net görüş, rahat çalışma', text: 'Stereo mikroskoplar, başlıklar ve lensler.', cta: 'Mikroskopları gör', link: 'q:mikroskop', img: 'prod:3064' },
    ],
    usps: [
      { icon: 'shield', title: 'Orijinal ürün', text: 'Distribütör güvencesi' },
      { icon: 'box', title: 'Hızlı kargo', text: 'Aynı gün gönderim' },
      { icon: 'chat', title: 'Teknik destek', text: 'WhatsApp’tan sorun' },
      { icon: 'tag', title: 'Uygun fiyat', text: 'Toptan ve perakende' },
    ],
    brandsTitle: 'Markalar',
    marquee: 'color', // kayan şerit: color (açık zemin, renkli logolar) | dark (koyu zemin, logolar beyaz kartlarda) | mono (gri logolar, üstüne gelince renkli) | off
    // logolar markaların kendi sitelerinden (hosting/public/brands/)
    brands: [
      { name: 'JBC', color: '#e11d2a', logo: '/brands/jbc.png', link: 'brand:JBC' },
      { name: 'Aixun', color: '#c8102e', logo: '/brands/aixun-dark.png', link: 'brand:Aixun' },
      { name: 'Mechanic', color: '#1d4ed8', logo: '/brands/mechanic-dark.png', link: 'brand:Mechanic' },
      { name: 'JCID', color: '#1a9bf0', logo: '/brands/jcid.png', link: 'brand:JCID' },
      { name: 'Sunshine', color: '#0067ae', logo: '/brands/sunshine.png', link: 'brand:Sunshine' },
      { name: 'Relife', color: '#22a447', logo: '/brands/relife.png', link: 'brand:Relife' },
      { name: '2UUL', color: '#2fbf4a', logo: '/brands/2uul.png', link: 'brand:2UUL' },
      { name: 'Qianli', color: '#b4232a', logo: '/brands/qianli.png', link: 'brand:Qianli' },
      { name: 'LUBAN', color: '#9b3ff0', logo: '/brands/luban.png', link: 'brand:LUBAN' },
      { name: 'Amaoe', color: '#f07d1a', logo: '/brands/amaoe.png', link: 'brand:Amaoe' },
      { name: 'AmScope', color: '#1f3a8a', logo: '/brands/amscope.png', link: 'brand:AmScope' },
      { name: 'Quick', color: '#d71920', logo: '/brands/quick.png', link: 'brand:Quick' },
      { name: 'RF4', color: '#119fa7', logo: '/brands/rf4.png', link: 'brand:RF4' },
      { name: 'Yihua', color: '#e30613', logo: '/brands/yihua.png', link: 'brand:Yihua' },
      { name: 'Uni-T', color: '#d6001c', logo: '/brands/unit.png', link: 'brand:Uni-t' },
    ],
    promosTitle: 'Öne çıkanlar',
    // görseller: ürünlerin kendi resimleri (prod:<no>) ve sitenin bannerları (platincdn)
    promos: [
      { size: 'big', color: '#0f172a', tag: 'Kampanya', title: 'Mikroskop ve kamera setleri', text: '4K dijital ve stereo mikroskoplar', link: 'q:mikroskop', img: 'prod:3028' },
      { size: 'sq', color: '#c2410c', tag: '', title: 'Havya uçları', text: 'JBC, Quick, Aixun, Qianli', link: 'q:havya ucu', img: 'prod:2965' },
      { size: 'sq', color: '#0b3b8c', tag: '', title: 'Programlayıcılar', text: 'Luban, JCID, Qianli', link: 'q:programlayıcı', img: 'prod:2853' },
      { size: 'wide', color: '#14532d', tag: 'Stokta', title: 'Ekran ayırma ekipmanları', text: 'Isıtıcılı ayırıcılar, pedler, aparatlar', link: 'q:ayırma', img: 'prod:3037' },
      { size: 'wide', color: '#111827', tag: '', title: '', text: '', link: 'q:', img: 'https://platincdn.com/3519/dosyalar/images/yeni%20koleksiyon%20(1)(1).jpg' },
      { size: 'sq', color: '#111827', tag: '', title: '', text: '', link: 'p:319', img: 'https://platincdn.com/3519/dosyalar/images/dw.jpg' },
      { size: 'sq', color: '#111827', tag: '', title: '', text: '', link: 'p:3', img: 'https://platincdn.com/3519/dosyalar/images/jbcc_298x350.jpg' },
    ],
    sections: [
      { title: 'Yeni gelenler', mode: 'new', limit: 10 },
      { title: 'Aixun', mode: 'brand', brand: 'Aixun', limit: 10 },
    ],
    cta: { title: 'Aradığınızı bulamadınız mı?', text: 'Ürün kodunu ya da fotoğrafını WhatsApp’tan gönderin, hemen bakalım.' },
  }, // bayi ana sayfası (Ayarlar > Bayi ana sayfası)
  categories: {}, // { "42": { name: "...", hidden: false, order: 0 } }
};

// Kategori isimleri ertelgsm.com menüsünden alındı (kod = sitedeki pmk numarası) (Ayarlar > Kategoriler'den değiştirilebilir)
export const CATEGORY_NAMES = {
  0: 'Kategorisiz',
  3: 'JBC / Quick / Yihua',
  5: 'Havya ve Sıcak Hava',
  6: 'Entegre',
  14: 'Mikroskop',
  16: 'Güç Kaynağı',
  19: 'Kredi ve Aktivasyon',
  23: 'Kablolar',
  24: 'Ersa ve Alpha',
  25: 'AmScope Mikroskop',
  31: 'Box, Dongle ve Prog.',
  37: 'iPhone Boxlar',
  38: 'Samsung Boxlar',
  39: 'LG Boxlar',
  40: 'JTAG Boxlar',
  41: 'Xiaomi, Huawei ve Diğer Boxlar',
  42: 'Tamir Ekipmanları',
  43: 'Bord Tutucu',
  44: 'Kalıp',
  45: 'Neşter, Neşter Uçları ve Kesiciler',
  46: 'Cımbız',
  47: 'Lehim Teli, Krem Lehimler ve Flux',
  48: 'Ölçü Aleti',
  49: 'Ersa Ürünleri',
  51: 'Alpha Ürünleri',
  54: 'iPhone Entegre',
  55: 'Samsung Entegre',
  56: 'Tornavida',
  57: 'Diğer Entegreler',
  61: 'Sıcak Hava İstasyonu',
  62: 'Havya İstasyonu',
  63: 'Doseer / ERT Mobile Mikroskop',
  64: 'Isıtıcı',
  65: 'Power Kablo',
  66: 'Tamir Pedleri',
  67: 'El Aletleri, Bant, Yapıştırıcı',
  68: '3D Kalıp',
  69: 'Normal Saç Kalıp',
  70: 'Teller',
  71: 'Yol Çekme Teli',
  72: 'Ekran Teli',
  73: 'Mikroskop Aksamları',
  74: 'Kredi',
  75: 'Aktivasyon',
  76: 'Kamera',
  77: 'Termal Kamera',
  78: 'Mikroskop Kamerası',
  79: 'Power Kablo',
  80: 'Korad Güç Kaynağı',
  81: 'Yihua Güç Kaynağı',
  82: 'Havya ve Sıcak Hava Uçları',
  83: 'Ekran Malzemeleri',
  84: 'Bord Tester',
  85: 'Lehim Alma Teli',
  86: 'Support',
  87: 'Birleştirme Kalıpları',
  88: 'Ekran Tester',
  89: 'USB Faster',
  90: 'JBC',
  91: 'Quick',
  92: 'Quick Havya ve Uçları',
  93: 'Sıcak Hava İstasyonu',
  94: 'Havya ve Havya Ucu',
  95: 'Flux',
  96: 'JBC Havya Ucu',
  97: 'Havya İstasyonu',
  100: 'iPhone 17',
  101: 'JC Ürünleri',
  102: 'Samsung Kalıp',
  103: 'Xiaomi Kalıp',
  104: 'Huawei Kalıp',
  105: 'iPhone Kalıp',
  106: 'iPad Kalıp',
  108: 'Yihua',
  109: 'Dramel',
  112: 'LUBAN Ürünleri',
  107: 'iPhone Ekran',
  110: 'Fleks',
  111: 'iPhone 17',
};

export const STATUS = {
  new: { label: 'Yeni', tone: 'info', hint: 'Yönetici inceliyor' },
  offered: { label: 'Teklif geldi', tone: 'warn', hint: 'Müşteri onayı bekleniyor' },
  accepted: { label: 'Onaylandı', tone: 'ok', hint: 'Hazırlanıyor' },
  ready: { label: 'Hazır', tone: 'ok', hint: 'Dükkandan teslim alınabilir' },
  done: { label: 'Teslim edildi', tone: 'muted', hint: 'Tamamlandı' },
  noshow: { label: 'Gelmedi', tone: 'bad', hint: 'Hazırlandı, teslim alınmadı' },
  rejected: { label: 'Reddedildi', tone: 'bad', hint: 'Kapandı' },
  cancelled: { label: 'İptal', tone: 'muted', hint: 'Kapandı' },
};

export const TYPE = {
  reserve: 'Hazırlayın, geliyorum',
  quote: 'Fiyat sor',
  message: 'Mesaj',
};

export const OPEN_STATUSES = ['new', 'offered', 'accepted', 'ready'];

// Online mağaza siparişleri
export const ORDER_STATUS = {
  new: { label: 'Yeni', tone: 'info', cust: 'Siparişiniz alındı' },
  confirmed: { label: 'Onaylandı', tone: 'ok', cust: 'Onaylandı, hazırlanıyor' },
  shipped: { label: 'Kargoda', tone: 'ok', cust: 'Kargoya verildi' },
  ready: { label: 'Teslime hazır', tone: 'ok', cust: 'Dükkandan teslim alabilirsiniz' },
  done: { label: 'Tamamlandı', tone: 'muted', cust: 'Teslim edildi' },
  cancelled: { label: 'İptal', tone: 'bad', cust: 'İptal edildi' },
};
export const ORDER_OPEN = ['new', 'confirmed', 'shipped', 'ready'];
export const PAY = { havale: 'Havale / EFT', card: 'Kredi kartı (ödeme linki)', shop: 'Dükkanda ödeme' };
export const DELIVERY = { cargo: 'Kargo ile gönderim', pickup: 'Dükkandan teslim al' };
export const ILLER = ['Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kilis', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Siirt', 'Sinop', 'Sivas', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'];
export const EMAIL_DOMAIN = 'toptan.ertelgsm.app';
