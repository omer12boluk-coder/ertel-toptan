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
    appName: 'ERTEL B2B',
    tagline: 'Bayilere özel katalog',
    accent: '#2f55b0', // ana renk (logodaki lacivert)
    priceAccent: '#c2410c', // toptan fiyat rengi
    theme: 'light', // auto | light | dark  (her cihaz üst menüden kendine göre değiştirebilir)
    logo: '', // boşsa ERT Mobile amblemi kullanılır; Ayarlar > Genel'den değiştirilebilir
    logoWide: '', // boşsa ERT Mobile yatay logo (giriş ekranı)
  },
  pricing: {
    discountPct: 10, // ürüne özel toptan fiyat yoksa liste fiyatından % indirim
    noWholesale: 'discount', // 'discount' = indirimle hesapla, 'ask' = "Fiyat sorun" göster
    roundStep: 0.5, // toptan fiyat yuvarlama adımı (0.01 / 0.5 / 1)
    adjustStep: 1, // yönetici teklif ekranında -/+ butonlarının adımı
    showRetail: true, // liste (perakende) fiyatı göster
    showSaving: false, // sepette "avantajınız" satırını göster
    showVat: true, // toplamın altında KDV bilgisini göster
    vatPct: 20, // KDV oranı: sadece toplamın altında bilgi olarak gösterilir (0 = gösterme)
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
  },
  access: {
    allowSignup: true,
    publicShop: true, // /magaza herkese açık vitrin // bayiler giriş ekranından kendileri üye olabilir; yönetici onaylayınca girebilir
  },
  features: {
    profilePhoto: true,
    history: true,
  },
  home: { title: '', subtitle: '', announcements: [], banners: [] }, // bayi ana sayfası (Ayarlar > Bayi ana sayfası)
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
export const EMAIL_DOMAIN = 'toptan.ertelgsm.app';
