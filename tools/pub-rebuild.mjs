// Herkese açık katalogu (pubcatalog) tam katalogdan baştan yazar. Elle çalıştırılır (Actions "Mağaza katalogunu yenile").
// Kullanım: alan eklenince (ör. 30.10.2026 gizli etiketler 't') mağaza hemen görsün diye. Ortam: FIREBASE_SERVICE_ACCOUNT.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { stencilKeys } from '../src/kalip.js';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const meta = await db.doc('catalog/_meta').get();
if (!meta.exists) throw new Error('Katalog yok');
const parts = await Promise.all(Array.from({ length: meta.data().chunks }, (_, i) => db.doc(`catalog/c${i}`).get()));
const cat = parts.flatMap((p) => (p.exists ? p.data().items : []));
const PUB = ['id', 'k', 'c', 'c2', 'r', 'n', 'cur', 's', 'a', 'pi', 'im', 'b', 'u', 'img', 'vd', 'vdp', 'man', 't'];
const pubItem = (p) => { const o = {}; for (const k of PUB) if (p[k] !== undefined && p[k] !== null) o[k] = p[k]; const kc = stencilKeys(p); if (kc) o.kc = kc; return o; };
const items = cat.filter((p) => p.a).map(pubItem);
const ps = []; let cur = [], size = 0;
for (const x of items) { const s = JSON.stringify(x).length * 1.15; if (cur.length && size + s > 650000) { ps.push(cur); cur = []; size = 0; } cur.push(x); size += s; }
if (cur.length) ps.push(cur);
const b = db.batch();
ps.forEach((part, i) => b.set(db.doc(`pubcatalog/c${i}`), { items: part }));
b.set(db.doc('pubcatalog/_meta'), { version: Date.now(), chunks: Math.max(1, ps.length), count: items.length, kc: 4 });
await b.commit();
const tagged = items.filter((p) => p.t).length;
const hit = items.filter((p) => String(p.t || '').toLowerCase().includes('8850')).map((p) => p.k).join(', ');
console.log(`::notice title=Mağaza katalogu yenilendi::${items.length} ürün, ${ps.length} parça, etiketli ${tagged} · '8850' etiketli: ${hit || 'yok'}`);
process.exit(0);
