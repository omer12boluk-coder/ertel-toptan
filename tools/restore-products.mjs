// Yanlışlıkla katalogdan kaldırılan ürünleri geri koyar (27.10.2026: PlatinMarket'te PASİF olan 4 ürün "silinmiş" sanılıp kaldırıldı).
// Kaynak: uygulamanın gömülü ilk verisi (src/products.json). Ürünler pasif (a:0, so:1, sg:1 = pasif doğrulandı) olarak eklenir.
// Kullanım: node tools/restore-products.mjs ert01931,ert02341   (Actions "Ürün geri yükle")
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs';

const codes = String(process.argv[2] || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
if (!codes.length) { console.log('::error::stok kodu verin'); process.exit(1); }
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const seed0 = JSON.parse(fs.readFileSync(new URL('../src/products.json', import.meta.url)));
const seed = Array.isArray(seed0) ? seed0 : seed0.items;
const meta = (await db.doc('catalog/_meta').get()).data();
const parts = await Promise.all(Array.from({ length: meta.chunks }, (_, i) => db.doc(`catalog/c${i}`).get()));
const cat = parts.flatMap((x) => (x.exists ? x.data().items : []));
const now = Date.now(); let added = 0;
for (const k of codes) {
  if (cat.some((p) => String(p.k).toLowerCase() === k)) { console.log(`::notice title=Zaten var::${k}`); continue; }
  const s = seed.find((p) => String(p.k).toLowerCase() === k);
  if (!s) { console.log(`::warning title=Kaynakta yok::${k}`); continue; }
  cat.push({ ...s, a: 0, so: 1, sg: 1, ut: now }); added++;
  console.log(`::notice title=Geri yüklendi::${s.k} · ${s.n} · liste ${s.r} · toptan ${s.w ?? 'oto'} (pasif)`);
}
if (!added) process.exit(0);
cat.sort((a, b) => b.id - a.id);
function chunks(arr, max = 650000) { const out = []; let cur = [], size = 0; for (const x of arr) { const n = JSON.stringify(x).length * 1.15; if (cur.length && size + n > max) { out.push(cur); cur = []; size = 0; } cur.push(x); size += n; } if (cur.length) out.push(cur); return out; }
const ps = chunks(cat); const b = db.batch();
ps.forEach((part, i) => b.set(db.doc(`catalog/c${i}`), { items: part }));
for (let i = ps.length; i < meta.chunks; i++) b.delete(db.doc(`catalog/c${i}`));
b.set(db.doc('catalog/_meta'), { ...meta, version: now, chunks: ps.length, count: cat.length });
await b.commit();
console.log(`::notice title=Tamam::${added} ürün geri eklendi, katalog ${cat.length} ürün`);
