// Adresler:
//   /                 bayi uygulaması            /t/<talepNo>         bayinin talebi (WhatsApp linki)
//   /admin            yönetim paneli             /admin/t/<talepNo>   talep (WhatsApp linki)
//   /magaza           herkese açık vitrin (giriş yok, liste fiyatı)
//   /magaza/t/<no>    vitrin müşterisinin sepeti / teklifi (linki bilen görür)
// Claude demo sayfasında adres değişmediği için #admin / #magaza da kabul edilir.
const path = location.pathname.replace(/\/+$/, '') || '/';
const hash = location.hash.slice(1);

export const ROUTE = {
  admin: path === '/admin' || path.startsWith('/admin/') || hash === 'admin',
  shop: path === '/magaza' || path.startsWith('/magaza/') || hash === 'magaza',
  reqId: (path.match(/\/t\/([\w-]+)$/) || [])[1] || null,
};

export const links = {
  adminRequest: (id) => `${location.origin}/admin/t/${id}`,
  userRequest: (id) => `${location.origin}/t/${id}`,
  guestRequest: (id) => `${location.origin}/magaza/t/${id}`,
  shop: () => `${location.origin}/magaza`,
};

// WhatsApp linki: numarayı 90XXXXXXXXXX biçimine çevirir; numara yoksa WhatsApp kişi seçtirir
export function waLink(phone, text) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
