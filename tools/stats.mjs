// Popüler ürün verisi (29.10.2026, Actions "Popüler ürünleri hesapla", haftada iki kez + elle):
//   fav  : en çok favorilenen ürünler [[ürün, kişi sayısı]] (members.favs)                 → ana sayfa "Herkesin favorisi"
//   pair : son 120 günde aynı siparişte birlikte alınanlar {ürün: [ürün, …]} (en çok 6)    → ürün penceresi "Birlikte iyi gider"
//   cnt  : son 120 günde ürünün geçtiği sipariş sayısı {ürün: adet}                        → kategoride "Ustaların tercihi"
// Mağaza siparişleri (orders) + bayi siparişleri (requests type 'order'); iptaller sayılmaz. Sonuç stats/public (herkes okur).
// Kullanım: node tools/stats.mjs [--dry]
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry');
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const now = Date.now(); const since = now - 120 * 864e5;
const note = (title, msg) => console.log(`::notice title=${title}::${String(msg).replace(/%/g, '%25').replace(/\n/g, '%0A')}`);
process.on('unhandledRejection', (e) => { note('Hata', (e && e.stack) || e); process.exit(1); });
process.on('uncaughtException', (e) => { note('Hata', (e && e.stack) || e); process.exit(1); });

// katalog (aktiflik + stok kontrolü için)
const meta = await db.doc('catalog/_meta').get();
const parts = await Promise.all(Array.from({ length: meta.data()?.chunks || 0 }, (_, i) => db.doc(`catalog/c${i}`).get()));
const cat = parts.flatMap((p) => (p.exists ? p.data().items : []));
const byId = new Map(cat.map((p) => [p.id, p]));
const act = (id) => { const p = byId.get(id); return p && p.a !== 0 && !p.so; };

// favoriler
const favN = new Map();
const ms = await db.collection('members').select('favs').get();
for (const d of ms.docs) for (const id of new Set(d.data().favs || [])) if (act(id)) favN.set(id, (favN.get(id) || 0) + 1);
const fav = [...favN].filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id, n]) => ({ id, n })); // Firestore iç içe dizi kabul etmez

// siparişler (mağaza + bayi)
const baskets = [];
const os = await db.collection('orders').where('createdAt', '>=', since).select('items', 'status').get();
for (const d of os.docs) { const o = d.data(); if (o.status === 'cancelled') continue; baskets.push([...new Set((o.items || []).map((i) => Number(i.id)).filter(Boolean))]); }
const rs = await db.collection('requests').where('createdAt', '>=', since).select('items', 'status', 'type').get().catch(() => ({ docs: [] }));
for (const d of rs.docs) { const r = d.data(); if (r.type !== 'order' || ['cancelled', 'rejected'].includes(r.status)) continue; baskets.push([...new Set((r.items || []).map((i) => Number(i.id)).filter(Boolean))]); }

const cnt = {}; const pairN = new Map();
for (const b of baskets) {
  for (const id of b) cnt[id] = (cnt[id] || 0) + 1;
  if (b.length < 2 || b.length > 40) continue; // çok kalabalık sepet "birlikte" bilgisini bozar
  for (const a of b) { let m = pairN.get(a); if (!m) pairN.set(a, (m = new Map())); for (const x of b) if (x !== a) m.set(x, (m.get(x) || 0) + 1); }
}
const pair = {};
for (const [a, m] of pairN) { if (!act(a)) continue; const top = [...m].filter(([x]) => act(x)).sort((p, q) => q[1] - p[1]).slice(0, 6).map(([x]) => x); if (top.length) pair[a] = top; }
for (const k of Object.keys(cnt)) if (!act(Number(k))) delete cnt[k];

const out = { at: now, days: 120, orders: baskets.length, fav, pair, cnt };
const size = JSON.stringify(out).length;
note('Popüler', `${baskets.length} sipariş · ${fav.length} favori ürün · ${Object.keys(pair).length} ürüne "birlikte" · ${Object.keys(cnt).length} satılan ürün · ${Math.round(size / 1024)} KB`);
if (size > 900000) throw new Error('stats/public çok büyük: ' + size);
if (!DRY) {
  await db.doc('stats/public').set(out);
}
