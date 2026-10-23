import { useSyncExternalStore } from 'react';
import { withDefaults, ls, norm, now } from './utils.js';

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
  },
  get() { return this.s; },
  set(patch) { this.s = { ...this.s, ...(typeof patch === 'function' ? patch(this.s) : patch) }; subs.forEach((f) => f()); },
};
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export function useStore(sel = (s) => s) { return useSyncExternalStore(subscribe, () => sel(store.s)); }

export const api = () => store.s.api;
export const isAdmin = () => store.s.user?.role === 'admin';

export function setCatalog(items) {
  const list = (items || []).map((p) => ({ ...p, _s: norm(p.n + ' ' + p.k + ' ' + (p.b || '')), _t: norm(p.t || '') }));
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
export function loadCart() { store.set({ cart: ls.get(cartKey(), {}) }); }
export function setQty(id, qty) {
  const cart = { ...store.s.cart };
  if (qty > 0) cart[id] = Math.min(9999, Math.floor(qty)); else delete cart[id];
  store.set({ cart }); ls.set(cartKey(), cart);
}
export function clearCart() { store.set({ cart: {} }); ls.set(cartKey(), {}); }

export function go(tab) { store.set({ tab, openReq: null }); window.scrollTo(0, 0); }
export function openRequest(id) { store.set({ tab: 'talepler', openReq: id }); window.scrollTo(0, 0); }
