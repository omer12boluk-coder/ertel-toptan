// Yönetim paneli veri pencereleri (27.10.2026, okuma kotası için):
//  - mağaza siparişleri ve bayi talepleri: son 60 gün; "Daha eski" ile 60'ar gün geriye açılır
//  - mağaza üyeleri: açılışta son 62 gün (Genel bakış + zil için); Müşteriler > Mağaza müşterileri açılınca hepsi
// Durum store'da: win = { orders, reqs (başlangıç tarihi ms), membersAll }
import { store } from './store.js';
import { ORDER_OPEN, OPEN_STATUSES } from './config.js';

const DAY = 86400000, STEP = 60 * DAY;
let A = null, user = null;
const un = {};
const stop = (k) => { try { un[k]?.(); } catch {} delete un[k]; };

export function stopAdminWatchers() { for (const k of Object.keys(un)) stop(k); A = null; user = null; for (const k in part) part[k] = []; }

export function startAdminWatchers(api, u) {
  stopAdminWatchers(); A = api; user = u;
  const t = Date.now();
  // 62 gün: Genel bakış'ta "bu ay"ı önceki ayla kıyaslamaya yetsin
  store.set({ win: { orders: t - 62 * DAY, reqs: t - 62 * DAY, membersAll: false } });
  watchOrders(); watchReqs(); watchMembers();
  A.loadCosts?.().then((costs) => store.set({ costs })).catch(() => {});
  // tarihine bakmadan açık olanlar da (eski ama hâlâ bekleyen kayıt listeden düşmesin)
  if (A.watchByStatus) {
    if (A.watchOrders) un.ordersOpen = A.watchByStatus('orders', ORDER_OPEN, (l) => { part.ordersOpen = l; mergeOrders(); });
    un.reqsOpen = A.watchByStatus('requests', OPEN_STATUSES, (l) => { part.reqsOpen = l; mergeReqs(); });
  }
}

// pencere + açık kayıtlar birleşir (aynı kayıt bir kez)
const part = { orders: [], ordersOpen: [], reqs: [], reqsOpen: [] };
const merge = (a, b, key) => { const m = new Map(); for (const x of [...b, ...a]) m.set(x.id, x); return [...m.values()].sort((x, y) => (y[key] || 0) - (x[key] || 0)); };
const mergeOrders = () => store.set({ orders: merge(part.orders, part.ordersOpen, 'createdAt') });
const mergeReqs = () => store.set({ requests: merge(part.reqs, part.reqsOpen, 'updatedAt') });
function watchOrders() { stop('orders'); if (A?.watchOrders) un.orders = A.watchOrders((l) => { part.orders = l; mergeOrders(); }, store.s.win.orders); }
function watchReqs() { stop('reqs'); un.reqs = A.watchRequests(user, (l) => { part.reqs = l; mergeReqs(); }, store.s.win.reqs); }
function watchMembers() {
  stop('members'); if (!A?.watchMembers) return;
  un.members = A.watchMembers((members) => store.set({ members }), store.s.win.membersAll ? 0 : Date.now() - 62 * DAY);
}

// "Daha eski siparişleri göster" / "Daha eski talepleri göster": pencereyi 60 gün geriye açar
export function loadOlder(kind) {
  if (!A) return;
  const w = { ...store.s.win }; w[kind] -= STEP; store.set({ win: w });
  kind === 'orders' ? watchOrders() : watchReqs();
}
// Tüm mağaza üyeleri (Müşteriler > Mağaza müşterileri, üye penceresi)
export function ensureAllMembers() {
  if (!A || store.s.win?.membersAll) return;
  store.set({ win: { ...store.s.win, membersAll: true } });
  watchMembers();
}
export const winLabel = (since) => new Date(since).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
