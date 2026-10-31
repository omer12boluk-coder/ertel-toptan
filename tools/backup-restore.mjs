// Yedekten geri yükleme (Actions › "Yedekten geri yükle"). Varsayılan "dene": hiçbir şey yazmaz, sadece ne olacağını sayar.
// "eksik": yedekte olup şu an OLMAYAN belgeleri geri koyar (var olana dokunmaz — silinen siparişi/üyeyi geri getirmek için).
// "uzerine": seçilen koleksiyondaki belgeleri yedekteki hâliyle DEĞİŞTİRİR (yedekten sonra yapılan değişiklikler kaybolur).
// Günlüklere veri yazılmaz; sadece sayılar. Ortam: FIREBASE_SERVICE_ACCOUNT, DIR (açılmış yedek), COL, MODE.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fs from 'node:fs';
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const DIR = process.env.DIR; const COL = (process.env.COL || 'orders').trim(); const MODE = process.env.MODE || 'dene';
const back = (v) => (Array.isArray(v) ? v.map(back) : v && typeof v === 'object' ? ('_ts' in v && Object.keys(v).length === 1 ? Timestamp.fromMillis(v._ts) : '_ref' in v && Object.keys(v).length === 1 ? db.doc(v._ref) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, back(x)]))) : v);
const info = JSON.parse(fs.readFileSync(`${DIR}/_bilgi.json`));
console.log(`::notice title=Yedek::${info.at} · ${info.total} belge`);
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== '_bilgi.json' && (COL === 'hepsi' || f.split('__')[0] === COL));
if (!files.length) { console.log(`::error title=Bulunamadı::Yedekte '${COL}' yok. Var olanlar: ${Object.keys(info.counts).join(', ')}`); process.exit(1); }
let add = 0, over = 0, same = 0; let batch = db.batch(), n = 0;
const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
for (const f of files) {
  const parts = f.slice(0, -5).split('__'); // col__doc__sub__doc2__sub2
  const base = parts.reduce((p, x, i) => (i === 0 ? x : `${p}/${x}`), '');
  const docs = JSON.parse(fs.readFileSync(`${DIR}/${f}`));
  const ids = Object.keys(docs);
  for (let i = 0; i < ids.length; i += 300) {
    const refs = ids.slice(i, i + 300).map((id) => db.doc(`${base}/${id}`));
    const snaps = await db.getAll(...refs);
    for (const sn of snaps) {
      if (!sn.exists) { add++; if (MODE === 'eksik' || MODE === 'uzerine') { batch.set(sn.ref, back(docs[sn.id])); n++; } }
      else if (MODE === 'uzerine') { over++; batch.set(sn.ref, back(docs[sn.id])); n++; }
      else same++;
      if (n >= 400) await flush();
    }
  }
}
await flush();
const what = MODE === 'dene' ? 'DENEME (hiçbir şey yazılmadı)' : MODE === 'eksik' ? 'eksikler geri kondu' : 'yedekteki hâliyle değiştirildi';
console.log(`::notice title=Sonuç (${COL})::${what} · şu an olmayan: ${add} · var olan: ${MODE === 'uzerine' ? over + ' (değiştirildi)' : same + ' (dokunulmadı)'}`);
