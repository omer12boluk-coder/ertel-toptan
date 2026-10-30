// Firestore'un TAMAMINI (tüm koleksiyonlar + alt koleksiyonlar) JSON olarak yedekler → yedek/<tarih>.tar.gz
// Günlüklere (herkese açık repo!) VERİ YAZMAZ; sadece koleksiyon adları ve belge sayıları.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fs from 'node:fs';
initializeApp({ credential: cert(JSON.parse(process.env.SA)) });
const db = getFirestore();
const out = 'yedek'; fs.mkdirSync(out, { recursive: true });
const plain = (v) => v instanceof Timestamp ? { _ts: v.toMillis() } : Array.isArray(v) ? v.map(plain) : v && typeof v === 'object' && v.constructor === Object ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)])) : (v && v._path ? { _ref: v.path } : v);
let total = 0; const counts = {};
async function dumpCol(col, file) {
  const snap = await col.get(); const docs = {};
  for (const d of snap.docs) {
    docs[d.id] = plain(d.data()); total++;
    for (const sub of await d.ref.listCollections()) await dumpCol(sub, `${file}__${d.id}__${sub.id}`);
  }
  if (snap.size) { fs.writeFileSync(`${out}/${file}.json`, JSON.stringify(docs)); counts[file.split('__')[0] + (file.includes('__') ? '/*/' + file.split('__').pop() : '')] = (counts[file.split('__')[0] + (file.includes('__') ? '/*/' + file.split('__').pop() : '')] || 0) + snap.size; }
}
for (const c of await db.listCollections()) await dumpCol(c, c.id);
fs.writeFileSync(`${out}/_bilgi.json`, JSON.stringify({ at: new Date().toISOString(), total, counts }));
console.log('::notice title=Yedeklenen::' + total + ' belge · ' + Object.entries(counts).map(([k, n]) => k + ' ' + n).join(', '));
