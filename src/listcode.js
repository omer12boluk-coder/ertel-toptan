// Vitrin listesi linki: liste hiçbir yere kaydedilmez, ürünler/adetler (ve yönetici fiyat verdiyse fiyatlar) linkin içindedir.
//   /magaza/l/<kod>  müşteri/herkes tabloyu görür      /admin/l/<kod>  yönetici fiyatlayıp yeni link + resim üretir
import { store } from './store.js';

const b64u = {
  enc: (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; bytes.forEach((b) => (bin += String.fromCharCode(b))); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: (s) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); },
};

// list: { no, name, at, priced, rate, items: [{ id, qty, offer }] }
export function encodeList(list) {
  const o = { v: 1, o: list.no, t: list.at || Date.now(), i: list.items.map((it) => (list.priced ? [it.id, it.qty, it.offer ?? null] : [it.id, it.qty])) };
  if (list.name) o.n = list.name;
  if (list.priced) { o.p = 1; if (list.rate) o.r = Math.round(list.rate * 10000) / 10000; }
  return b64u.enc(JSON.stringify(o));
}
export function decodeList(code) {
  try {
    const o = JSON.parse(b64u.dec(code));
    if (!o || !Array.isArray(o.i)) return null;
    return { no: String(o.o || ''), name: o.n || '', at: o.t || Date.now(), priced: !!o.p, rate: o.r || null, rows: o.i.map(([id, qty, price]) => ({ id: Number(id), qty: Math.max(1, Number(qty) || 1), price: price == null ? null : Number(price) })) };
  } catch { return null; }
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
