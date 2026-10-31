// Yönetim paneli veri pencereleri (27.10.2026, okuma kotası için):
//  - mağaza siparişleri ve bayi talepleri: son 60 gün; "Daha eski" ile 60'ar gün geriye açılır
//  - ürün talepleri ve sorun bildirimleri (29.10.2026): son 62 gün + tarihine bakmadan açık olanlar; "Daha eski" ile 60'ar gün geriye
//  - mağaza üyeleri: açılışta son 62 gün (Genel bakış + zil için); Müşteriler > Mağaza müşterileri açılınca hepsi
// Durum store'da: win = { orders, reqs (başlangıç tarihi ms), membersAll }
import { store } from './store.js';
import { ORDER_OPEN, OPEN_STATUSES } from './config.js';
import { autoSum } from './reviews.jsx';

const DAY = 86400000;
// yükleme penceresi (Ayarlar > Veri ve kota): siparişler/talepler ve üyeler kaç günlük açılsın
const wd = () => { const n = Number(store.s.settings?.quota?.days); return [14, 30, 62, 120].includes(n) ? n : 62; };
const wm = () => { const n = Number(store.s.settings?.quota?.members); return [14, 30, 62, 120].includes(n) ? n : 62; };
let A = null, user = null;
const un = {};
const stop = (k) => { try { un[k]?.(); } catch {} delete un[k]; };

export function stopAdminWatchers() { for (const k of Object.keys(un)) stop(k); A = null; user = null; for (const k in part) part[k] = []; }

export function startAdminWatchers(api, u) {
  stopAdminWatchers(); A = api; user = u;
  const t = Date.now();
  // 62 gün: Genel bakış'ta "bu ay"ı önceki ayla kıyaslamaya yetsin
  const D = wd() * DAY;
  store.set({ win: { orders: t - D, reqs: t - D, preqs: t - D, issues: t - D, reviews: t - D, membersAll: false } });
  watchOrders(); watchReqs(); watchMembers(); watchPreqs(); watchIssues(); watchReviews();
  // sepet linkleri (zil: "Sepet linki onaylandı")
  if (A.watchLcarts) un.lcarts = A.watchLcarts((lcarts) => store.set({ lcarts }));
  // tarihine bakmadan açık olanlar da (eski ama hâlâ bekleyen kayıt listeden düşmesin)
  if (A.watchByStatus) {
    if (A.watchOrders) un.ordersOpen = A.watchByStatus('orders', ORDER_OPEN, (l) => { part.ordersOpen = l; mergeOrders(); });
    un.reqsOpen = A.watchByStatus('requests', OPEN_STATUSES, (l) => { part.reqsOpen = l; mergeReqs(); });
    if (A.watchPreqs) un.preqsOpen = A.watchByStatus('preq', PQ_OPEN, (l) => { part.preqsOpen = l; mergePreqs(); });
    if (A.watchIssues) un.issuesOpen = A.watchByStatus('issues', IS_OPEN, (l) => { part.issuesOpen = l; mergeIssues(); });
    if (A.watchReviews) un.reviewsOpen = A.watchByStatus('reviews', ['pending'], (l) => { part.reviewsOpen = l; mergeReviews(); });
  }
}

// pencere + açık kayıtlar birleşir (aynı kayıt bir kez)
const part = { orders: [], ordersOpen: [], reqs: [], reqsOpen: [], preqs: [], preqsOpen: [], issues: [], issuesOpen: [], reviews: [], reviewsOpen: [] };
const PQ_OPEN = ['new', 'answered'];
const IS_OPEN = ['new', 'received', 'review', 'action', 'shipping'];
const merge = (a, b, key) => { const m = new Map(); for (const x of [...b, ...a]) m.set(x.id, x); return [...m.values()].sort((x, y) => (y[key] || 0) - (x[key] || 0)); };
const mergeOrders = () => store.set({ orders: merge(part.orders, part.ordersOpen, 'createdAt') });
const mergeReqs = () => store.set({ requests: merge(part.reqs, part.reqsOpen, 'updatedAt') });
const mergePreqs = () => store.set({ preqs: merge(part.preqs, part.preqsOpen, 'createdAt') });
const mergeIssues = () => store.set({ issues: merge(part.issues, part.issuesOpen, 'createdAt') });
function watchPreqs() { stop('preqs'); if (A?.watchPreqs) un.preqs = A.watchPreqs((l) => { part.preqs = l; mergePreqs(); }, store.s.win.preqs); }
const mergeReviews = () => { const reviews = merge(part.reviews, part.reviewsOpen, 'createdAt'); store.set({ reviews }); autoSum(reviews); };
function watchReviews() { stop('reviews'); if (A?.watchReviews) un.reviews = A.watchReviews((l) => { part.reviews = l; mergeReviews(); }, store.s.win.reviews); }
function watchIssues() { stop('issues'); if (A?.watchIssues) un.issues = A.watchIssues((l) => { part.issues = l; mergeIssues(); }, store.s.win.issues); }
function watchOrders() { stop('orders'); if (A?.watchOrders) un.orders = A.watchOrders((l) => { part.orders = l; mergeOrders(); }, store.s.win.orders); }
function watchReqs() { stop('reqs'); un.reqs = A.watchRequests(user, (l) => { part.reqs = l; mergeReqs(); }, store.s.win.reqs); }
function watchMembers() {
  stop('members'); if (!A?.watchMembers) return;
  un.members = A.watchMembers((members) => store.set({ members }), store.s.win.membersAll ? 0 : Date.now() - wm() * DAY);
}

// "Daha eski siparişleri göster" / "Daha eski talepleri göster": pencereyi 60 gün geriye açar
export function loadOlder(kind) {
  if (!A) return;
  const w = { ...store.s.win }; w[kind] -= Math.max(30, wd()) * DAY; store.set({ win: w });
  ({ orders: watchOrders, reqs: watchReqs, preqs: watchPreqs, issues: watchIssues, reviews: watchReviews })[kind]?.();
}
// Tüm mağaza üyeleri (Müşteriler > Mağaza müşterileri, üye penceresi)
export function ensureAllMembers() {
  if (!A || store.s.win?.membersAll) return;
  store.set({ win: { ...store.s.win, membersAll: true } });
  watchMembers();
}
export const winLabel = (since) => new Date(since).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
