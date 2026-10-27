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
// Kademeli indirim tablosu: [{to, off}] — fiyat "to" dahil o satıra kadar; son satırın "to"su boş = ve üstü.
// İndirim hiçbir zaman liste fiyatının yarısını geçmez (çok ucuz üründe fiyat sıfıra inmesin).
export function stepOff(list, steps) {
  const L = Number(list) || 0; if (!L || !Array.isArray(steps) || !steps.length) return 0;
  const row = steps.find((r) => r.to == null || r.to === '' || L <= Number(r.to)) || steps[steps.length - 1];
  return Math.min(Number(row.off) || 0, L / 2);
}
export function priceFor(p, S, me, userPrices) {
  const list = p.r;
  if (me && me.role === 'public') return { list, mine: list > 0 ? list : null, src: 'liste' };
  if (userPrices && userPrices[p.id] != null && userPrices[p.id] !== '') {
    return { list, mine: Number(userPrices[p.id]), src: 'ozel' };
  }
  const P = S.pricing || {};
  const tier = me && me.role !== 'admin' ? (S.tiers || []).find((t) => t.id === me.tier) : null;
  const steps = P.mode === 'steps'; // kademeli sabit USD indirimi (kademenin kendi tablosu varsa o)
  let base = p.w != null && p.w !== '' ? Number(p.w)
    : P.noWholesale === 'ask' ? null
    : steps ? (list > 0 ? list - stepOff(list, tier?.steps?.length ? tier.steps : P.steps) : null)
    : list * (1 - (P.discountPct || 0) / 100);
  if (base == null || !list && base === 0) return { list, mine: null, src: 'sor' };
  let src = 'toptan';
  if (me && me.role !== 'admin') {
    const pct = (Number(tier?.pct) || 0) + (Number(me.extraPct) || 0);
    if (pct) { base = base * (1 - pct / 100); src = 'kademe'; }
  }
  let mine = roundStep(base, steps && (p.w == null || p.w === '') ? 0.01 : P.roundStep);
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
// KDV: tutar başına (para birimi bazında) KDV ve KDV dahil toplam
// liste fiyatı değişen ve ELLE toptanı olan ürün: toptanı kontrol edilmeli (otomatik toptan kendiliğinden güncellenir)
export const needsCheck = (p) => !!p.pc && p.w != null;
export function vatOf(by, pct) {
  const p = Number(pct) || 0; const vat = {}, inc = {};
  for (const [c, v] of Object.entries(by || {})) { vat[c] = v * p / 100; inc[c] = v + vat[c]; }
  return { pct: p, vat, inc };
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

export { cleanText } from './clean.js';

// "Çok yakında" özellikleri: müşteriye kapalı. Önizleme: /magaza?onizleme=1 (bu cihazda açılır), ?onizleme=0 kapatır.
try { const q = new URLSearchParams(location.search).get('onizleme'); if (q === '1') localStorage.setItem('shop-preview', '1'); if (q === '0') localStorage.removeItem('shop-preview'); } catch {}
export const shopPreview = () => { try { return localStorage.getItem('shop-preview') === '1'; } catch { return false; } };
export const soon = (S, k) => S.orders?.[k] !== false && !shopPreview();

// Mağaza ana sayfası resmi: webp (destekliyse), logolar için saydamlık korunur
export async function resizeForWeb(file, max = 1600, q = 0.82, alpha = false) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    const x = c.getContext('2d');
    if (!alpha) { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    x.drawImage(img, 0, 0, c.width, c.height);
    let d = c.toDataURL('image/webp', q);
    if (!d.startsWith('data:image/webp')) d = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', q);
    // Firestore belge sınırı (~1 MB): büyükse kaliteyi düşür
    for (let qq = q - 0.12; d.length > 900000 && qq > 0.3; qq -= 0.12) d = c.toDataURL('image/webp', qq);
    return d;
  } finally { URL.revokeObjectURL(url); }
}

// Sıradaki stok kodu: en çok kullanılan "harf + rakam" kalıbında (ör. ert03805), aynı rakam uzunluğundaki en büyük sayı + 1
// (DENEME-01 gibi tireli kodlar ve ert034000 gibi uzunluğu farklı yanlış kodlar sayılmaz)
export function nextCode(catalog) {
  const cnt = new Map();
  for (const x of catalog) { const m = /^([a-z]+)(\d+)$/i.exec(String(x.k || '').trim()); if (m) { const key = m[1].toLowerCase() + ':' + m[2].length; cnt.set(key, (cnt.get(key) || 0) + 1); } }
  if (!cnt.size) return '';
  const [pre, len] = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0].split(':');
  let max = 0;
  for (const x of catalog) { const m = /^([a-z]+)(\d+)$/i.exec(String(x.k || '').trim()); if (m && m[1].toLowerCase() === pre && m[2].length === +len) max = Math.max(max, +m[2]); }
  return pre + String(max + 1).padStart(+len, '0');
}
