// Claude için mağaza kataloğunun güncel özetini yazar (Actions 'Claude için getir', claude-al.yml).
// Kaynak: pubcatalog (herkese açık mağaza kopyası; toptan fiyat YOK) → out/katalog.json
// Alanlar: id, k, n, b, c, c2, r (liste fiyatı), cur, s (stok), a, pi, im (ilk 6), ft (geliş anı)
import fs from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const m = (await db.doc('pubcatalog/_meta').get()).data();
const parts = await Promise.all(Array.from({ length: m.chunks }, (_, i) => db.doc(`pubcatalog/c${i}`).get()));
const items = parts.flatMap((x) => (x.exists ? x.data().items || [] : []))
  .map((p) => ({ id: p.id, k: p.k, n: p.n, b: p.b, c: p.c, c2: p.c2, r: p.r, cur: p.cur, s: p.s, a: p.a, pi: p.pi, im: (p.im || []).slice(0, 6), ft: p.ft }))
  .sort((a, b) => (b.ft || 0) - (a.ft || 0) || b.id - a.id);
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/katalog.json', JSON.stringify(items));
console.log(`::notice title=Katalog::${items.length} ürün · en yeni: ${items.slice(0, 3).map((p) => `#${p.id} ${p.n}`).join(' | ').slice(0, 300)}`);
