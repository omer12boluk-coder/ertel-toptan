// Claude'dan gelenler: repo'daki gelen/urun/*.json ve gelen/not/*.json dosyalarını Firestore gelen/{id} belgesine yazar
// (Actions 'Gelenleri al', gelen.yml). Belge zaten varsa DOKUNMAZ (onaylanan/reddedilen geri gelmesin).
// Dosya biçimi: claude/is/urun-ekle.md. Kullanım: node tools/gelen.mjs
import fs from 'fs';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const files = [];
for (const kind of ['urun', 'not']) {
  const dir = path.join('gelen', kind);
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) files.push([kind, path.join(dir, f)]);
}
let added = 0, skipped = 0; const bad = [];
for (const [kind, file] of files) {
  const id = path.basename(file, '.json').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 80);
  let j; try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { bad.push(file + ': ' + e.message); continue; }
  const ref = db.doc('gelen/' + id);
  if ((await ref.get()).exists) { skipped++; continue; }
  const at = Date.parse(j.at || '') || Date.now();
  let doc;
  if (kind === 'urun') {
    const imgs = (j.imgs || []).map((u) => (typeof u === 'string' ? { u } : u)).filter((x) => x && /^https?:\/\//.test(x.u)).slice(0, 14);
    const d = { n: String(j.n || j.q || '').trim(), b: String(j.b || '').trim(), t: Array.isArray(j.t) ? j.t.join(',') : String(j.t || ''), desc: String(j.desc || ''), imgs, note: String(j.note || '') };
    if (j.c != null && Number.isFinite(Number(j.c))) d.c = Number(j.c);
    if (j.c2 != null && Number.isFinite(Number(j.c2))) d.c2 = Number(j.c2);
    if (Array.isArray(j.src)) d.src = j.src.slice(0, 6).map((s) => (typeof s === 'string' ? { url: s } : { url: s.url, title: s.title || '' }));
    if (!d.n) { bad.push(file + ': ad (n) yok'); continue; }
    doc = { kind: 'urun', st: 'new', at, q: String(j.q || d.n), d, by: 'claude' };
  } else {
    doc = { kind: j.kind || 'not', st: 'new', at, title: String(j.title || id), sub: String(j.sub || ''), link: String(j.link || ''), img: String(j.img || ''), note: String(j.note || ''), by: 'claude' };
  }
  await ref.set(doc); added++;
}
console.log(`::notice title=Gelenleri al::${added} yeni eklendi · ${skipped} zaten vardı · ${files.length} dosya`);
for (const b of bad) console.log(`::warning title=Okunamadı::${b}`);
