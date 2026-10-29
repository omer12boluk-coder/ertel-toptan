import { useSyncExternalStore } from 'react';
import { withDefaults, ls, norm, now, cleanText } from './utils.js';

const subs = new Set();
export const store = {
  s: {
    boot: 'loading', // loading | login | ready | error
    bootError: '',
    needsSetup: false,
    api: null,
    user: null,
    settings: withDefaults(null),
    catalog: [],
    byId: new Map(),
    userPrices: {},
    requests: [],
    feed: [], // PlatinMarket eşitleme olayları (bildirim merkezi)
    customers: [],
    tab: null,
    openReq: null,
    cart: {},
    toast: null,
    ctx: null, // sağ tık menüsü
    intent: null, // başka ekrandan gelen istek: 'newProduct' | 'newCustomer'
    guestInfo: null,
    rate: null, // Harem Altın dolar satış kuru { usd, src, at }
    member: null, // online mağaza üyesi (giriş yaptıysa)
    myOrders: [], // mağaza üyesinin siparişleri
    guestOrders: [], // misafirin bu cihazdan verdiği siparişler (bildirim merkezi için canlı)
    favs: [], // mağaza: favori ürün numaraları (cihazda + üyede members.favs)
    orders: [], // yönetici: mağaza siparişleri
    members: [], // yönetici: mağaza üyeleri
    openOrder: null, // açık sipariş (mağazada takip sayfası, yönetimde detay)
    orderJust: false, // sipariş az önce verildi (teşekkür kutusu)
    myPreqs: [], // mağaza üyesinin ürün talepleri
    preqs: [], // yönetici: ürün talepleri (Müşteriler > Ürün talepleri)
    openPreq: null, // yönetici: açık ürün talebi
    myIssues: [], // mağaza üyesinin sorun bildirimleri
    issues: [], // yönetici: sorun bildirimleri (Müşteriler > Sorun bildirimleri)
    openIssue: null,
    reviews: [], // yönetici: ürün yorumları
    popStats: null, revSum: null, myReviews: null, // mağaza: popüler verisi, yorum özeti, üyenin yorumları (oturumda bir kez)
  },
  get() { return this.s; },
  set(patch) { this.s = { ...this.s, ...(typeof patch === 'function' ? patch(this.s) : patch) }; subs.forEach((f) => f()); },
};
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const storeListen = subscribe; // React dışı dinleyiciler (telefonda sayfa geçişi)
export function useStore(sel = (s) => s) { return useSyncExternalStore(subscribe, () => sel(store.s)); }

export const api = () => store.s.api;
export const isAdmin = () => store.s.user?.role === 'admin';

export function setCatalog(items) {
  const list = (items || []).map((p0) => { const p = { ...p0, n: cleanText(p0.n) || '', b: p0.b ? cleanText(p0.b) : p0.b }; return { ...p, _s: norm(p.n + ' ' + p.k + ' ' + (p.b || '')), _t: norm(p.t || '') }; });
  store.set({ catalog: list, byId: new Map(list.map((p) => [p.id, p])) });
}

let toastT;
export function toast(text, tone = 'ok') {
  clearTimeout(toastT);
  store.set({ toast: { text, tone, at: now() } });
  toastT = setTimeout(() => store.set({ toast: null }), 3200);
}

// ---- Sepet (cihazda, kullanıcıya özel)
const cartKey = () => 'cart-' + (store.s.user?.uid || 'x');
// Vitrin (giriş yok) sepeti sadece bu sekmede yaşar: sekme kapanınca sıfırlanır. Bayi sepeti cihazda kalır.
const guestCart = () => store.s.user?.role === 'public';
const cs = {
  get: (k) => { try { if (guestCart()) return JSON.parse(sessionStorage.getItem(k) || '{}'); } catch { return {}; } return ls.get(k, {}); },
  set: (k, v) => { try { if (guestCart()) return sessionStorage.setItem(k, JSON.stringify(v)); } catch { return; } ls.set(k, v); },
};
export function loadCart() { if (guestCart()) ls.del(cartKey()); store.set({ cart: cs.get(cartKey()) }); }
export function setQty(id, qty) {
  const cart = { ...store.s.cart };
  if (qty > 0) cart[id] = Math.min(9999, Math.floor(qty)); else delete cart[id];
  store.set({ cart }); cs.set(cartKey(), cart);
}
export function clearCart() { store.set({ cart: {} }); cs.set(cartKey(), {}); }
// Vitrin: her şeyi temizle (sepet, ad, eski liste kayıtları) ve baştan başla
export function freshStart() {
  clearCart();
  for (const k of ['guest-info', 'guest-draft', 'guest-reqs']) ls.del(k);
  try { sessionStorage.clear(); } catch {}
}

// Sekmeler adres çubuğuna da yazılır (/magaza/urunler, /magaza/sepet…): telefonda geri kaydırınca bir önceki ekrana döner,
// sayfa yeniden yüklenmez (pushState). Geri dönünce kaldığınız yere kaydırılır.
const SLUGS = {
  magaza: { anasayfa: '', katalog: 'urunler', sepet: 'sepet', hesap: 'hesap', urun: 'urun', kalip: 'kalip', talep: 'talep', yasal: 'yasal', sorun: 'sorun' },
  b2b: { anasayfa: '', katalog: 'urunler', sepet: 'sepet', talepler: 'talepler', profil: 'profil' },
  admin: { anasayfa: '', talepler: 'talepler', siparisler: 'siparisler', siparis: 'form', katalog: 'urunler', musteriler: 'musteriler', tasarim: 'tasarim', ayarlar: 'ayarlar' },
};
const area = () => { const m = /^\/(magaza|b2b|admin)(\/|$)/.exec(location.pathname); return m ? m[1] : null; };
export function tabFromPath() { const a = area(); if (!a) return null; const seg = location.pathname.split('/')[2] || ''; if (!seg) return null; const e = Object.entries(SLUGS[a]).find(([, x]) => x === seg); return e ? e[0] : null; }
function pushTab(tab) {
  const a = area(); if (!a || !(tab in SLUGS[a])) return;
  const url = '/' + a + (SLUGS[a][tab] ? '/' + SLUGS[a][tab] : '');
  try {
    history.replaceState({ ...(history.state || {}), tab: store.s.tab, openOrder: store.s.openOrder || null, openReq: store.s.openReq || null, y: scrollY }, '');
    if (location.pathname !== url || store.s.tab !== tab) history.pushState({ tab }, '', url);
  } catch {}
}
// Hesabım alt sayfaları: /magaza/hesap/<bölüm> (telefonda geri kaydırınca Hesabım'a döner)
export const ACCT = { orders: 'siparisler', addr: 'adresler', info: 'profil', inv: 'fatura', favs: 'favoriler', wait: 'haber-beklenenler', notif: 'bildirimler', pay: 'odeme' };
export function acctFromPath() { const m = /^\/magaza\/hesap\/([\w-]+)/.exec(location.pathname); const slug = m && (m[1] === 'haber-bekleyenler' ? 'haber-beklenenler' : m[1]); /* eski bildirim linki */ const e = m && Object.entries(ACCT).find(([, x]) => x === slug); return e ? e[0] : null; }
export function openAcct(v) {
  try {
    history.replaceState({ ...(history.state || {}), tab: 'hesap', acct: store.s.acct || null, y: scrollY }, '');
    history.pushState({ tab: 'hesap', acct: v || null }, '', '/magaza/hesap' + (v ? '/' + ACCT[v] : ''));
  } catch {}
  // bilgisayarda soldaki menü yerinde kalır: sayfa en başa atılmaz, sadece bölüm başı ekranın üstündeyse oraya kadar çıkılır
  const desk = typeof matchMedia !== 'undefined' && matchMedia('(min-width: 900px)').matches && store.s.tab === 'hesap';
  store.set({ tab: 'hesap', acct: v || null, openOrder: null });
  if (!desk) { window.scrollTo(0, 0); return; }
  const main = document.querySelector('.acct-main'); const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 64;
  const target = main ? Math.max(0, main.getBoundingClientRect().top + scrollY - topH - 20) : 0;
  if (scrollY > target) window.scrollTo(0, target);
}
// Ürün sayfası (Ayarlar > Ürün kartları > Ürün açılışı: sayfa): /magaza/urun/<no>
export function pidFromPath() { const m = /^\/magaza\/urun\/(\d+)/.exec(location.pathname); return m ? Number(m[1]) : null; }
export function openProduct(id) {
  try {
    history.replaceState({ ...(history.state || {}), tab: store.s.tab, acct: store.s.acct || null, pid: store.s.pid || null, y: scrollY }, '');
    history.pushState({ tab: 'urun', pid: id }, '', '/magaza/urun/' + id);
  } catch {}
  // geldiği sayfa (Tüm ürünler / ana sayfa) arkada gizli açık kalır → geri dönünce filtreler, yüklenen ürünler ve kaydırma yerinde
  const from = store.s.tab === 'urun' ? store.s.urunFrom : store.s.tab;
  // telefonda ana sayfadan açılınca ürün sayfası ana sayfanın ÜSTÜNE, kendi kaydırmasıyla bir katman olarak açılır (urunLayer):
  // ana sayfa hiç gizlenmez / yeniden çizilmez → geri dönüşte hiçbir iş yok, iPhone'daki gibi pürüzsüz
  const layer = from === 'anasayfa' && store.s.user?.role === 'public' && typeof matchMedia !== 'undefined' && matchMedia('(max-width: 899px)').matches
    ? true : (store.s.tab === 'urun' && store.s.urunLayer);
  store.set({ tab: 'urun', pid: id, acct: null, openOrder: null, urunFrom: from, urunLayer: !!layer });
  if (!layer) window.scrollTo(0, 0);
}
export function startHistory(defTab) {
  addEventListener('popstate', (e) => {
    const st = e.state || {};
    const tab = st.tab || tabFromPath() || defTab();
    store.set({ urunLayer: tab === 'urun' ? store.s.urunLayer : false, tab, acct: tab === 'hesap' ? st.acct ?? acctFromPath() : null, pid: tab === 'urun' ? st.pid ?? pidFromPath() : null, openOrder: st.openOrder || null, openReq: st.openReq || null, orderJust: false });
    // ilk karede (React çizdikten hemen sonra) yerine kaydır → üstte bir kare görünüp zıplamaz; içerik geç uzarsa bir kez daha
    requestAnimationFrame(() => { window.scrollTo(0, st.y || 0); requestAnimationFrame(() => { if (Math.abs(scrollY - (st.y || 0)) > 2) window.scrollTo(0, st.y || 0); }); });
  });
}
// arkada açık kalan sekmeler (mağaza: ana sayfa, Tüm ürünler) dönünce kaldığı yerden devam eder
const tabY = {};
const KEEP = ['anasayfa', 'katalog'];
export function go(tab) {
  const from = store.s.tab;
  if (KEEP.includes(from) && !store.s.acct && !store.s.openOrder) tabY[from] = scrollY;
  if (tab !== from || store.s.openOrder || store.s.openReq || store.s.acct) pushTab(tab);
  const y = tab !== from && (store.s.user?.role === 'public' || (store.s.user?.role === 'admin' && tab === 'katalog')) && KEEP.includes(tab) && !(tab === 'katalog' && store.s.catalogGo) ? tabY[tab] || 0 : 0;
  // zaten o sayfadaysak (alt menüde aynı sekmeye tekrar basmak) en üste ŞAK diye atlamak yerine yumuşakça kayarak çıkılır
  const same = tab === from && !store.s.openOrder && !store.s.openReq && !store.s.acct;
  store.set({ urunFrom: null, urunLayer: false, tab, acct: null, openReq: null, openOrder: null, orderJust: false });
  if (same && !store.s.catalogGo) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  window.scrollTo(0, 0);
  if (y) requestAnimationFrame(() => window.scrollTo(0, y)); // gizli sayfa görünür olduktan sonra (React çizdikten sonraki ilk kare)
}
export function openOrder(id, just) { store.set({ tab: store.s.user?.role === 'admin' ? 'siparisler' : 'siparis', openOrder: id, orderJust: just || false }); window.scrollTo(0, 0); }
export const home = () => go(store.s.user?.role === 'admin' ? 'anasayfa' : store.s.user?.role === 'public' ? (store.s.settings.shopHome?.enabled === false ? 'katalog' : 'anasayfa') : 'anasayfa');
export function openRequest(id) { store.set({ tab: 'talepler', openReq: id }); window.scrollTo(0, 0); }

// Müşterinin siparişlerinde görülmemiş güncellemeler (durum değişti, henüz açmadı): cihazda {siparişId: son görülen updatedAt}
export function orderSeen(o) { if (!o?.id) return; const m = ls0('order-seen', {}); const t = o.updatedAt || o.createdAt || 0; if ((m[o.id] || 0) >= t) return; m[o.id] = t; try { localStorage.setItem('order-seen', JSON.stringify(m)); } catch {} store.set({ seenTick: (store.s.seenTick || 0) + 1 }); }
export function unseenOrders(list) { const m = ls0('order-seen', {}); return (list || []).filter((o) => o.status !== 'new' && (o.updatedAt || o.createdAt || 0) > (m[o.id] || 0)); }
function ls0(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }

// ---- Favoriler (mağaza müşterisi, 27.10.2026): cihazda (ls 'favs') ve üye girişliyse hesabında (members.favs) tutulur
let favT = null;
export function loadFavs() { store.set({ favs: ls0('favs', []) }); }
export function isFav(id) { return store.s.favs.includes(id); }
export function toggleFav(id) {
  const on = !isFav(id);
  const favs = on ? [id, ...store.s.favs].slice(0, 500) : store.s.favs.filter((x) => x !== id);
  store.set({ favs }); try { localStorage.setItem('favs', JSON.stringify(favs)); } catch {}
  const m = store.s.member;
  if (m) { clearTimeout(favT); favT = setTimeout(() => store.s.api?.saveMember({ ...store.s.member, favs: store.s.favs }).catch(() => {}), 800); }
  return on;
}
// üye girişi: cihazdaki favorilerle hesaptakiler birleşir (iki taraf da kaybolmaz)
export function mergeFavs(m) {
  const local = ls0('favs', []); const acc = Array.isArray(m?.favs) ? m.favs : [];
  const all = [...new Set([...acc, ...local])].slice(0, 500);
  store.set({ favs: all }); try { localStorage.setItem('favs', JSON.stringify(all)); } catch {}
  if (m && all.length !== acc.length) store.s.api?.saveMember({ ...m, favs: all }).catch(() => {});
}
