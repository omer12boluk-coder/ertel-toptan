// Deneme ürünü ekler / siler (Actions "Deneme ürünü"). Kullanım: node tools/test-product.mjs [ekle|sil]
// Ürün elle eklenmiş sayılır (man: 1) ki site eşitlemesi "sitede yok" diye gizlemesin.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { stencilKeys, packTags } from '../src/kalip.js';

const MODE = process.argv[2] || 'ekle';
if (MODE === 'kontrol') { // canlı linkler gerçekten çalışıyor mu (iPhone'un istediği gibi parça parça)
  const WATCH0 = 'https://ertel-b2b-watch.omer-12boluk.workers.dev';
  const r = await fetch(WATCH0 + '/v/deneme.mp4', { headers: { Range: 'bytes=0-99' } });
  const r2 = await fetch('https://erteltoptan.web.app/test/deneme-1.jpg');
  console.log(`::notice title=Kontrol::video ${r.status} ${r.headers.get('content-range')} ${r.headers.get('content-type')} · resim ${r2.status} ${r2.headers.get('content-type')}`);
  // videolu tüm ürünler: linkleri nasıl cevap veriyor (iPhone parça parça ister, kare almak için CORS gerekir)
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db0 = getFirestore();
  const m0 = (await db0.doc('catalog/_meta').get()).data();
  const ps0 = await Promise.all(Array.from({ length: m0.chunks }, (_, i) => db0.doc(`catalog/c${i}`).get()));
  const vids = ps0.flatMap((x) => (x.exists ? x.data().items : [])).filter((p) => p.vd);
  for (const p of vids) {
    let line = `#${p.id} ${p.k} · ${p.vd}`;
    try {
      const a = await fetch(p.vd, { headers: { Range: 'bytes=0-1', Origin: 'https://erteltoptan.web.app' }, redirect: 'follow' });
      line += ` → ${a.status} ${a.headers.get('content-type')} range=${a.headers.get('content-range')} acao=${a.headers.get('access-control-allow-origin')} final=${a.url}`;
      const h = await fetch(p.vd, { method: 'HEAD' }); line += ` · boyut=${h.headers.get('content-length')}`;
      const buf = Buffer.from(await (await fetch(p.vd)).arrayBuffer());
      const at = (t) => buf.indexOf(Buffer.from(t));
      const ac = at('avcC'); if (ac >= 0) line += ` · avcC profil=${buf[ac + 5]} uyum=${buf[ac + 6]} seviye=${buf[ac + 7]}`;
      const a1 = at('avc1'); if (a1 >= 0) line += ` · boyut ${buf.readUInt16BE(a1 + 28)}x${buf.readUInt16BE(a1 + 30)}`;
      for (const t of ['colr', 'mdcv', 'clli', 'dvcC', 'dvvC', 'sgpd', 'edts', 'elst']) if (at(t) >= 0) line += ' ' + t;
      const tr = []; let i = -1; while ((i = buf.indexOf(Buffer.from('hdlr'), i + 1)) >= 0 && i < 200000) tr.push(buf.slice(i + 12, i + 16).toString()); line += ' izler=' + tr.join(',');
      line += ` · moov@${at('moov')} mdat@${at('mdat')} codec=${['avc1', 'hvc1', 'hev1', 'av01', 'vp09'].filter((c) => at(c) >= 0).join('/')} ses=${['mp4a', 'ac-3', 'Opus'].filter((c) => at(c) >= 0).join('/')}`;
    } catch (e) { line += ' → HATA ' + e.message; }
    console.log('::notice title=Video::' + line);
  }
  const blk = (await db0.doc('settings/public').get()).data()?.shopHome?.blocks || {};
  for (const [id, b] of Object.entries(blk)) if (b.t === 'video') console.log(`::notice title=Ana sayfa video::${id} ${b.src}`);
  process.exit(0);
}
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
const PUB = ['id', 'k', 'c', 'c2', 'r', 'n', 'cur', 's', 'a', 'pi', 'im', 'b', 'u', 'img', 'vd', 'vdp', 'man', 't'];
const pubItem = (p) => { const o = {}; for (const k of PUB) if (p[k] !== undefined && p[k] !== null) o[k] = p[k]; const kc = stencilKeys(p); if (kc) o.kc = kc; if (o.t) { const t = packTags(p); if (t) o.t = t; else delete o.t; } return o; };
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
