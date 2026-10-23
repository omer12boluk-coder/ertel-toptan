import { DEFAULT_SETTINGS, CATEGORY_NAMES } from './config.js';
import { baseCatName } from './cats.js';

const TRMAP = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
export const norm = (s) => String(s ?? '').replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TRMAP[c]).toLowerCase();

const SYM = { USD: '$', EUR: '€', TRY: '₺' };
export function fmt(v, cur = 'USD') {
  if (v == null || v === '' || isNaN(v)) return '—';
  const n = Math.round(Number(v) * 100) / 100;
  const s = n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  if (cur === 'TRY') return s + ' ₺';
  return (SYM[cur] || cur + ' ') + s;
}

export function roundStep(v, step) {
  const st = Number(step) || 0.01;
  return Math.round(Math.round(v / st) * st * 100) / 100;
}

export const now = () => Date.now();
export const rid = () => Math.random().toString(36).slice(2, 10);

export function when(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const t = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return t;
  const y = new Date(today); y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Dün ' + t;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' + t;
}

export const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
export function deepMerge(base, over) {
  if (!isObj(over)) return structuredClone(base);
  const out = structuredClone(base);
  for (const k of Object.keys(over)) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : over[k];
  }
  return out;
}
export const withDefaults = (s) => deepMerge(DEFAULT_SETTINGS, s || {});

export function catName(S, code) {
  return S.categories?.[code]?.name || baseCatName(code) || 'Kategori ' + code;
}

// ---- Fiyat hesabı --------------------------------------------------------
// Öncelik: müşteriye özel fiyat > ürünün toptan fiyatı (veya % indirim) > kademe/ek indirim
export function priceFor(p, S, me, userPrices) {
  const list = p.r;
  if (me && me.role === 'public') return { list, mine: list > 0 ? list : null, src: 'liste' };
  if (userPrices && userPrices[p.id] != null && userPrices[p.id] !== '') {
    return { list, mine: Number(userPrices[p.id]), src: 'ozel' };
  }
  let base = p.w != null && p.w !== '' ? Number(p.w) : S.pricing.noWholesale === 'ask' ? null : list * (1 - (S.pricing.discountPct || 0) / 100);
  if (base == null || !list && base === 0) return { list, mine: null, src: 'sor' };
  let src = 'toptan';
  if (me && me.role !== 'admin') {
    const tier = (S.tiers || []).find((t) => t.id === me.tier);
    const pct = (Number(tier?.pct) || 0) + (Number(me.extraPct) || 0);
    if (pct) { base = base * (1 - pct / 100); src = 'kademe'; }
  }
  let mine = roundStep(base, S.pricing.roundStep);
  if (list > 0 && mine > list) mine = list; // liste fiyatı düşmüşse toptan hiçbir zaman listeden pahalı görünmez
  return { list, mine, src };
}

export function totals(items, key) {
  const by = {};
  for (const it of items || []) {
    const v = Number(it[key]);
    if (isNaN(v) || it[key] == null) continue;
    by[it.cur || 'USD'] = (by[it.cur || 'USD'] || 0) + v * (Number(it.qty) || 0);
  }
  return by;
}
export function fmtTotals(by) {
  const parts = Object.entries(by).map(([c, v]) => fmt(v, c));
  return parts.length ? parts.join(' + ') : '—';
}

// ---- Görsel küçültme (profil foto / ürün foto) ---------------------------
export async function resizeImage(file, max = 640, q = 0.78, square = false) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
    const sc = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * sc); c.height = Math.round(sh * sc);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  } finally { URL.revokeObjectURL(url); }
}

export function initials(s) {
  const w = String(s || '?').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase() || '?';
}

export function hue(s) {
  let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h;
}

export const usernameOk = (u) => /^[a-z0-9._-]{3,30}$/.test(u);
export const cleanUsername = (u) => norm(u).trim().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
