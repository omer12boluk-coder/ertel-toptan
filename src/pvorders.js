// Önizleme adresinde (host '--' içerir) verilen demo siparişler (1.11.2026): veritabanına YAZILMAZ, bu cihazda saklanır
// (localStorage 'pv-orders', en çok 20) ve aynı cihazda Yönetim › Siparişler listesine "Önizleme" olarak eklenir.
// Kimlikleri 'pv_' ile başlar; backend-firebase updateOrder / deleteOrders / watchOrder bunları buradan karşılar.
export const PV = typeof location !== 'undefined' && /--/.test(location.hostname);
const KEY = 'pv-orders';
export const isPv = (id) => String(id || '').startsWith('pv_');
export function pvList() { try { const l = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } }
function put(l) { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 20))); } catch {} try { dispatchEvent(new Event('pv-orders')); } catch {} }
export function pvSave(o) { put([o, ...pvList().filter((x) => x.id !== o.id)]); }
export function pvPatch(id, patch) { put(pvList().map((x) => (x.id === id ? { ...x, ...patch } : x))); }
export function pvDelete(ids) { const s = new Set(ids); put(pvList().filter((x) => !s.has(x.id))); }
export const pvGet = (id) => pvList().find((x) => x.id === id) || null;
