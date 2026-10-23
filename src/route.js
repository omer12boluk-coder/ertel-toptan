// Adresler:
//   /                 giriş sayfası: "Online mağaza" (büyük) veya "Bayi girişi"
//   /magaza           herkese açık vitrin (giriş yok): ürünler + listem
//   /magaza/l/<kod>   vitrin listesi (ürünler linkin içinde, hiçbir yere kaydedilmez)  /admin/l/<kod> yönetici fiyatlar
//   /magaza/t/<no>    eski vitrin talepleri (sadece görüntüleme)
//   /b2b              bayi uygulaması             /b2b/t/<no>   bayinin talebi (WhatsApp linki; eski /t/<no> da çalışır)
//   /admin            yönetim paneli              /admin/t/<no> talep / liste (WhatsApp linki)
// Claude demo sayfasında adres değişmediği için #admin / #magaza / #b2b da kabul edilir.
const path = location.pathname.replace(/\/+$/, '') || '/';
const hash = location.hash.slice(1);
const under = (p) => path === p || path.startsWith(p + '/') || hash === p.slice(1);

export const ROUTE = {
  admin: under('/admin'),
  shop: under('/magaza'),
  b2b: under('/b2b') || path.startsWith('/t/'),
  reqId: (path.match(/\/t\/([\w-]+)$/) || [])[1] || null,
  listCode: (path.match(/\/l\/([\w-]+)$/) || [])[1] || null, // vitrin listesi (bkz. listcode.js)
};
ROUTE.landing = !ROUTE.admin && !ROUTE.shop && !ROUTE.b2b;

export const links = {
  adminRequest: (id) => `${location.origin}/admin/t/${id}`,
  userRequest: (id) => `${location.origin}/b2b/t/${id}`,
  guestRequest: (id) => `${location.origin}/magaza/t/${id}`,
  shop: () => `${location.origin}/magaza`,
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
