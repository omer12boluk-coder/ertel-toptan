// Mağaza siparişi tutar hesabı (1.11.2026) — uygulama (sepet, ödeme ekranı) VE bekçi (worker/index.js) aynı dosyayı kullanır,
// böylece müşterinin gördüğü rakam ile kaydedilen rakam aynı formülden çıkar. Bu dosya hiçbir şey içe aktarmaz (saf hesap).
//
// Sıra: ürün $ × kur → TL (satır satır, kuruşa yuvarlanır) → KDV → KDV dahil → (kartta) ödeme komisyonu → ödenecek tutar.
// Ödeme komisyonu = PlatinMarket'teki "Ödeme Komisyonu": müşteriye yansıyan fark; faturaya ödenecek tutar yazılır.
// Ayarlar: settings.pricing.storeVatInc (mağazada KDV dahil satış, varsayılan açık), pricing.vatPct,
//          settings.orders.storeCard (mağazada kart), orders.inst [{ n: taksit, pct: komisyon %, off }].

export const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// Varsayılan komisyon tablosu (Ayarlar > Ödeme seçenekleri'nden değişir). n = 1 tek çekim.
export const DEF_INST = [{ n: 1, pct: 3 }, { n: 3, pct: 7 }, { n: 6, pct: 12.5 }, { n: 9, pct: 18 }];

// Açık taksit seçenekleri (sıralı, tekil)
export function instList(O) {
  const raw = Array.isArray(O?.inst) && O.inst.length ? O.inst : DEF_INST;
  const seen = new Set(); const out = [];
  for (const x of raw) {
    const n = Math.round(Number(x?.n)); const pct = Math.max(0, Math.min(60, Number(x?.pct) || 0));
    if (!(n >= 1 && n <= 36) || x?.off || seen.has(n)) continue;
    seen.add(n); out.push({ n, pct });
  }
  return out.sort((a, b) => a.n - b.n);
}

// Mağazada KDV dahil satış açık mı
export const storeVatOn = (P) => P?.storeVatInc !== false && Number(P?.vatPct ?? 20) > 0;
// Mağazada kartla ödeme açık mı
// önizleme adresinde (Firebase kanalı, adında '--') kart her zaman açık: denemek için. Bekçide location yok → etkilenmez
export const storeCardOn = (O) => O?.storeCard !== false || (typeof location !== 'undefined' && /--/.test(location.hostname));

// items: [{ price, cur, qty }] · rate: 1 USD kaç TL · vat: KDV eklensin mi · pay: 'havale' | 'card' | 'shop' · n: taksit
// Dönüş: { rate, usd, usdInc, allUsd, tl, vatPct, vat, inc, inst: { n, pct, fee, per } | null, pay, lines: [satır TL] } ya da null
export function storeSum(items, { rate, vatPct = 20, vat = true, pay = 'havale', n = 1, inst = DEF_INST } = {}) {
  const k = Number(rate);
  if (!(k > 0) || !Array.isArray(items) || !items.length) return null;
  let usd = 0, tl = 0, allUsd = true; const lines = [];
  for (const it of items) {
    const q = Math.max(0, Math.floor(Number(it?.qty) || 0)); const p = Number(it?.price ?? it?.offer); const cur = it?.cur || 'USD';
    if (!(p >= 0)) return null;
    let unit;
    if (cur === 'USD') { unit = r2(p * k); usd += p * q; } else if (cur === 'TRY') { unit = r2(p); allUsd = false; } else return null;
    const line = r2(unit * q); lines.push(line); tl += line;
  }
  usd = r2(usd); tl = r2(tl);
  const pct = vat ? Math.max(0, Number(vatPct) || 0) : 0;
  const vatAmt = r2(tl * pct / 100); const inc = r2(tl + vatAmt);
  let ins = null;
  if (pay === 'card') {
    const list = Array.isArray(inst) && inst.length ? inst : [{ n: 1, pct: 0 }];
    const row = list.find((x) => x.n === Number(n)) || list[0];
    const fee = r2(inc * row.pct / 100); const tot = r2(inc + fee);
    ins = { n: row.n, pct: row.pct, fee, per: r2(tot / row.n) };
  }
  return { rate: k, usd, usdInc: r2(usd * (1 + pct / 100)), allUsd, tl, vatPct: pct, vat: vatAmt, inc, inst: ins, pay: r2(inc + (ins ? ins.fee : 0)), lines };
}

// Faturaya yazılacak tutar KDV dahil ödenen tutardır; içindeki matrah ve KDV
export function invoiceSplit(total, pct) {
  const p = Number(pct) || 0; const base = r2(Number(total) / (1 + p / 100));
  return { base, vat: r2(Number(total) - base) };
}

// ---- Kart (demo): numaradan marka, Luhn kontrolü
export const digitsOf = (s) => String(s || '').replace(/\D/g, '');
export function cardBrand(num) {
  const d = digitsOf(num);
  if (/^9792/.test(d)) return 'troy';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'mastercard';
  if (/^4/.test(d)) return 'visa';
  return '';
}
export function luhnOk(num) {
  const d = digitsOf(num); if (d.length < 13 || d.length > 19) return false;
  let s = 0;
  for (let i = 0; i < d.length; i++) { let x = Number(d[d.length - 1 - i]); if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; }
  return s % 10 === 0;
}
