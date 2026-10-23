// Vitrin listesi linki: liste hiçbir yere kaydedilmez, ürünler/adetler (ve yönetici fiyat verdiyse fiyatlar) linkin içindedir.
//   /magaza/l/<kod>  müşteri/herkes tabloyu görür      /admin/l/<kod>  yönetici fiyatlayıp yeni link + resim üretir
import { store } from './store.js';

const b64u = {
  dec: (s) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); },
};

// Kısa biçim (link kısa kalsın diye sayılar 36'lık tabanda):
//   <no>_<gün>[_p<kur*100>]-<ürün>[_<adet>][_<fiyat*100>]-...
//   ör. B2EP_bz3-2dr-2ds_2-2dt   (fiyatlıysa her ürünün sonunda fiyat; adet 1 ise yazılmaz)
const D0 = Date.UTC(2024, 0, 1) / 864e5;
const n36 = (n) => Math.round(n).toString(36);
export function encodeList(list) {
  const at = list.at || Date.now();
  const day = Math.floor((at - new Date(at).getTimezoneOffset() * 6e4) / 864e5 - D0); // yerel gün
  let head = `${list.no}_${n36(day)}`;
  if (list.priced) head += '_p' + (list.rate ? n36(list.rate * 100) : '0'); // fiyatlı liste işareti (+ kur)
  const rows = list.items.map((it) => {
    let t = n36(it.id);
    if (list.priced) t += '_' + n36(it.qty || 1) + '_' + (it.offer == null || it.offer === '' ? 'x' : n36(Number(it.offer) * 100));
    else if ((it.qty || 1) !== 1) t += '_' + n36(it.qty);
    return t;
  });
  return [head, ...rows].join('-');
}
export function decodeList(code) {
  try {
    if (/^ey/.test(code)) return decodeOld(code); // eski uzun linkler
    const parts = code.split('-');
    const [no, day, pr] = parts[0].split('_');
    const priced = !!pr && pr[0] === 'p';
    const rows = parts.slice(1).map((t) => {
      const [id, q, price] = t.split('_');
      return { id: parseInt(id, 36), qty: Math.max(1, parseInt(q || '1', 36) || 1), price: priced ? (price && price !== 'x' ? parseInt(price, 36) / 100 : null) : null };
    }).filter((r) => r.id > 0);
    if (!rows.length) return null;
    return { no, name: '', at: (parseInt(day, 36) + D0) * 864e5 + 12 * 36e5, priced, rate: priced ? parseInt(pr.slice(1), 36) / 100 || null : null, rows };
  } catch { return null; }
}
function decodeOld(code) {
  const o = JSON.parse(b64u.dec(code));
  if (!o || !Array.isArray(o.i)) return null;
  return { no: String(o.o || ''), name: o.n || '', at: o.t || Date.now(), priced: !!o.p, rate: o.r || null, rows: o.i.map(([id, qty, price]) => ({ id: Number(id), qty: Math.max(1, Number(qty) || 1), price: price == null ? null : Number(price) })) };
}

// Linkteki satırları katalogdaki ürün bilgileriyle doldur (ad, kod, resim, liste fiyatı)
export function listItems(L, byId = store.s.byId) {
  return L.rows.map(({ id, qty, price }) => {
    const p = byId.get(id);
    const list = p?.r > 0 ? p.r : null;
    const it = { id, k: p?.k || '', n: p?.n || 'Ürün artık satışta değil', cur: p?.cur || 'USD', qty, list, asked: list, offer: L.priced ? price : list };
    if (p?.pi) it.pi = p.pi; if (p?.u) it.u = p.u; if (p?.img) it.img = p.img;
    if (!p) it.gone = true;
    return it;
  });
}
// ListPaper / resim çizimi için liste "kaydı"
export function listRecord(L, items) {
  return { id: 'l', no: L.no, gname: L.name, items, status: L.priced ? 'offered' : 'new', createdAt: L.at, updatedAt: L.at, tl: true, rate: L.priced && L.rate ? { usd: L.rate, src: 'harem', at: L.at } : undefined };
}

export const listLink = (code, admin) => `${location.origin}/${admin ? 'admin' : 'magaza'}/l/${code}`;
