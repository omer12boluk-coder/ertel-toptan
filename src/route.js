// Adresler:
//   /  (eski /magaza) herkese açık mağaza; mağaza adresleri kısa: /urunler, /sepet, /urun/<no>, /s/<id>, /l/<kod>, /k/<id>…
//                     (aşağıdaki /magaza/… adresleri kodun içindeki mantıksal adres; tarayıcıda /magaza'sız görünür)
//   /magaza/l/<kod>   vitrin listesi (ürünler linkin içinde, hiçbir yere kaydedilmez)  /admin/l/<kod> yönetici fiyatlar
//   /magaza/t/<no>    eski vitrin talepleri (sadece görüntüleme)
//   /magaza/k/<id>    sepet linki: yöneticinin hazırladığı sepet, müşteri adres girip onaylar
//   /magaza/s/<no>    mağaza siparişi (müşteri takip eder)     /admin/s/<no> yönetici siparişi açar
//   /b2b              bayi uygulaması             /b2b/t/<no>   bayinin talebi (WhatsApp linki; eski /t/<no> da çalışır)
//   /admin            yönetim paneli              /admin/t/<no> talep / liste (WhatsApp linki)
// Claude demo sayfasında adres değişmediği için #admin / #magaza / #b2b da kabul edilir.
// KISA ADRES (31.10.2026): mağaza kökte (ertelmarket.com/sepet, /urun/12…). Kodun içi hâlâ '/magaza/…' "mantıksal" adresle
// çalışır: lpath() fiziksel adresin başına /magaza ekler, history.pushState/replaceState'e verilen '/magaza/…' adresleri
// kısaltılarak yazılır, eski /magaza/… linkleri açılınca kısa adrese çevrilir (eski talep görüntüleme /magaza/t/<no> hariç).
const NOT_SHOP = /^\/(admin|b2b|siparisformu|t|magaza)(\/|$)/;
export function toShort(u) {
  if (typeof u !== 'string') return u;
  const o = location.origin; const abs = u.startsWith(o + '/'); const rel = abs ? u.slice(o.length) : u;
  if (!/^\/magaza(?=\/|\?|#|$)/.test(rel) || /^\/magaza\/t\//.test(rel)) return u;
  let r = rel.slice(7); if (!r || r[0] === '?' || r[0] === '#') r = '/' + r;
  return (abs ? o : '') + r;
}
export function lpath() {
  const p = location.pathname.replace(/\/+$/, '') || '/';
  if (NOT_SHOP.test(p)) return p;
  return p === '/' ? '/magaza' : '/magaza' + p;
}
try {
  // ana ekran uygulaması kapatılıp açılınca kaldığı yerden devam etsin: son adres bölüme göre saklanır (index.html başındaki betik okur)
  const area = (p) => (/^\/admin(\/|$)/.test(p) ? 'admin' : /^\/(b2b|t)(\/|$)/.test(p) ? 'b2b' : /^\/siparisformu/.test(p) ? 'form' : 'shop');
  const saveLast = () => { try { const p = location.pathname; localStorage.setItem('last-route-' + area(p), JSON.stringify({ p, t: Date.now() })); } catch {} };
  for (const k of ['pushState', 'replaceState']) { const o = history[k].bind(history); history[k] = (s, t, u) => { const r = o(s, t, u == null ? u : toShort(u)); saveLast(); return r; }; }
  addEventListener('popstate', saveLast);
  saveLast();
  const short = toShort(location.pathname + location.search + location.hash);
  if (short !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', short);
} catch {}
export const shopUrl = (p = '') => location.origin + (p ? (p[0] === '/' ? p : '/' + p) : '/'); // müşteriye verilen linkler
const path = lpath();
const hash = location.hash.slice(1);
const under = (p) => path === p || path.startsWith(p + '/') || hash === p.slice(1);

// /siparisformu: sadece sipariş formu (yönetici oturumuyla; sitede hiçbir yerden link verilmez)
const formOnly = path === '/siparisformu' || hash === 'siparisformu';
export const ROUTE = {
  formOnly,
  admin: under('/admin') || formOnly,
  shop: under('/magaza') && !under('/admin') && !under('/b2b') && !formOnly,
  b2b: under('/b2b') || path.startsWith('/t/'),
  reqId: (path.match(/\/t\/([\w-]+)$/) || [])[1] || null,
  listCode: (path.match(/\/l\/([\w-]+)$/) || [])[1] || null, // vitrin listesi (bkz. listcode.js)
  preqId: (path.match(/^\/admin\/u\/([\w-]+)$/) || [])[1] || null, // ürün talebi (Telegram / bildirim linki)
  issueId: (path.match(/^\/admin\/i\/([\w-]+)$/) || [])[1] || null, // sorun bildirimi (Telegram / bildirim linki)
  orderId: (path.match(/\/s\/([\w-]+)$/) || [])[1] || null,
  lcartId: (path.match(/^\/magaza\/k\/([\w-]+)$/) || [])[1] || null, // sepet linki (yönetici hazırlar, müşteri onaylar; lcart.jsx) // mağaza siparişi: /magaza/s/<no>, /admin/s/<no>
  authAction: /\/magaza\/islem\/?$/.test(path), // e-postadaki şifre yenileme / doğrulama bağlantısı
};
ROUTE.landing = false; // giriş sayfası kalktı (31.10.2026): kök adres = mağaza

export const links = {
  adminRequest: (id) => `${location.origin}/admin/t/${id}`,
  userRequest: (id) => `${location.origin}/b2b/t/${id}`,
  guestRequest: (id) => `${location.origin}/magaza/t/${id}`, // eski kayıtlar: uzun adres kalır
  shop: () => shopUrl(),
  order: (id) => shopUrl('/s/' + id),
  adminOrder: (id) => `${location.origin}/admin/s/${id}`,
  b2b: () => `${location.origin}/b2b`,
  // ürünün sitedeki sayfası (adres bilinmiyorsa site /x-pmu<no> ile ürüne yönlendirir)
  product: (p, S) => (!p ? null : p.u ? S.catalog.siteUrl + p.u : S.catalog.siteUrl + '/x-pmu' + p.id),
};

// WhatsApp linki: numarayı 90XXXXXXXXXX biçimine çevirir; numara yoksa WhatsApp kişi seçtirir
export function waLink(phone, text) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
