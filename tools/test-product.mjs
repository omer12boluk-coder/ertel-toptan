// Deneme ürünü ekler / siler (Actions "Deneme ürünü"). Kullanım: node tools/test-product.mjs [ekle|sil]
// Ürün elle eklenmiş sayılır (man: 1) ki site eşitlemesi "sitede yok" diye gizlemesin.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const MODE = process.argv[2] || 'ekle';
const ID = 9000001;
const WATCH = 'https://ertel-b2b-watch.omer-12boluk.workers.dev';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const now = Date.now();
const note = (t, m) => console.log(`::notice title=${t}::${m}`);

const meta = await db.doc('catalog/_meta').get();
if (!meta.exists) throw new Error('Katalog yok');
const parts = await Promise.all(Array.from({ length: meta.data().chunks }, (_, i) => db.doc(`catalog/c${i}`).get()));
let cat = parts.flatMap((p) => (p.exists ? p.data().items : []));
const before = cat.length;
if (before < 100) throw new Error('Katalog beklenenden küçük (' + before + '), güvenlik için durduruldu');
cat = cat.filter((p) => p.id !== ID);
if (MODE === 'ekle') {
  cat.unshift({ id: ID, k: 'DENEME-01', n: 'Deneme ürünü (video testi)', c: 0, r: 1, w: null, cur: 'USD', s: 5, a: 1, man: 1,
    pi: 'https://erteltoptan.web.app/test/deneme-1.jpg', im: ['https://erteltoptan.web.app/test/deneme-2.jpg'], vd: WATCH + '/v/deneme.mp4' });
}

function chunks(arr, max = 650000) {
  const out = []; let cur = [], size = 0;
  for (const x of arr) { const s = JSON.stringify(x).length * 1.15; if (cur.length && size + s > max) { out.push(cur); cur = []; size = 0; } cur.push(x); size += s; }
  if (cur.length) out.push(cur); return out;
}
const PUB = ['id', 'k', 'c', 'c2', 'r', 'n', 'cur', 's', 'a', 'pi', 'im', 'b', 'u', 'img', 'vd', 'man'];
const pubItem = (p) => { const o = {}; for (const k of PUB) if (p[k] !== undefined && p[k] !== null) o[k] = p[k]; return o; };
async function writeChunked(col, items) {
  const old = (await db.doc(`${col}/_meta`).get()).data()?.chunks || 0;
  const ps = chunks(items);
  const b = db.batch();
  ps.forEach((part, i) => b.set(db.doc(`${col}/c${i}`), { items: part }));
  b.set(db.doc(`${col}/_meta`), { version: now, chunks: Math.max(1, ps.length), count: items.length });
  await b.commit();
  return [old, ps.length];
}
const a = await writeChunked('catalog', cat);
const b = await writeChunked('pubcatalog', cat.filter((p) => p.a).map(pubItem));
note(MODE === 'ekle' ? 'Deneme ürünü eklendi' : 'Deneme ürünü silindi', `katalog ${before} → ${cat.length} ürün · parça ${a.join('→')} / mağaza ${b.join('→')}`);
