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
    orders: [], // yönetici: mağaza siparişleri
    members: [], // yönetici: mağaza üyeleri
    openOrder: null, // açık sipariş (mağazada takip sayfası, yönetimde detay)
    orderJust: false, // sipariş az önce verildi (teşekkür kutusu)
  },
  get() { return this.s; },
  set(patch) { this.s = { ...this.s, ...(typeof patch === 'function' ? patch(this.s) : patch) }; subs.forEach((f) => f()); },
};
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
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
  magaza: { anasayfa: '', katalog: 'urunler', sepet: 'sepet', hesap: 'hesap' },
  b2b: { anasayfa: '', katalog: 'urunler', sepet: 'sepet', talepler: 'talepler', profil: 'profil' },
  admin: { talepler: '', siparisler: 'siparisler', siparis: 'form', katalog: 'urunler', musteriler: 'musteriler', tasarim: 'tasarim', ayarlar: 'ayarlar' },
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
export function startHistory(defTab) {
  addEventListener('popstate', (e) => {
    const st = e.state || {};
    const tab = st.tab || tabFromPath() || defTab();
    store.set({ tab, openOrder: st.openOrder || null, openReq: st.openReq || null, orderJust: false });
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, st.y || 0)));
  });
}
export function go(tab) { if (tab !== store.s.tab || store.s.openOrder || store.s.openReq) pushTab(tab); store.set({ tab, openReq: null, openOrder: null, orderJust: false }); window.scrollTo(0, 0); }
export function openOrder(id, just) { store.set({ tab: store.s.user?.role === 'admin' ? 'siparisler' : 'siparis', openOrder: id, orderJust: just || false }); window.scrollTo(0, 0); }
export const home = () => go(store.s.user?.role === 'admin' ? 'talepler' : store.s.user?.role === 'public' ? (store.s.settings.shopHome?.enabled === false ? 'katalog' : 'anasayfa') : 'anasayfa');
export function openRequest(id) { store.set({ tab: 'talepler', openReq: id }); window.scrollTo(0, 0); }
