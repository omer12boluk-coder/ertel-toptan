// PlatinMarket → ERTEL B2B otomatik eşitleme (GitHub Actions'ta her saat çalışır)
// Kaynak: sitenin Google Alışveriş beslemesi (/xml-cikti/gm). Fiyatlar TL olarak gelir; kur beslemeden hesaplanıp dolara çevrilir.
// Yaptıkları:
//   - Liste fiyatı değişen ürünlere uyarı (pc) koyar; toptan fiyata dokunmaz
//   - Sitede satıştan kalkan ürünü gizler (so=1), geri gelince açar; yöneticinin elle gizlediğine dokunmaz
//   - Ana resmi, adı ve markayı günceller; sitede yeni çıkan ürünleri "yeni" işaretiyle ekler
// Kullanım: node tools/sync-platin.mjs [--dry]
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cleanText } from '../src/clean.js';

const FEED = process.env.FEED_URL || 'https://www.ertelgsm.com/xml-cikti/gm';
const DRY = process.argv.includes('--dry');
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const now = Date.now();
const note = (title, msg) => console.log(`::notice title=${title}::${String(msg).replace(/%/g, '%25').replace(/\n/g, '%0A')}`);

// ---- besleme
const res = await fetch(FEED + (FEED.includes('?') ? '&' : '?') + 't=' + now, { headers: { 'User-Agent': 'ERTEL-B2B-sync/1.0', 'Cache-Control': 'no-cache' } }); // önbellekteki eski kopya gelmesin
if (!res.ok) throw new Error('Besleme alınamadı: HTTP ' + res.status);
const xml = await res.text();
const tag = (s, t) => { const m = s.match(new RegExp(`<g:${t}>([\\s\\S]*?)</g:${t}>`)); return m ? m[1].trim() : ''; };
const unesc = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
const feed = new Map();
for (const e of xml.split('<entry>').slice(1)) {
  const id = Number(tag(e, 'id'));
  if (!id) continue;
  // liste fiyatı = sitedeki gerçek satış fiyatı: indirimli fiyat (sale_price) varsa o, yoksa normal fiyat
  const reg = parseFloat(tag(e, 'price')) || 0, sale = parseFloat(tag(e, 'sale_price')) || 0;
  const price = sale > 0 && (!reg || sale < reg) ? sale : reg;
  const img = tag(e, 'image_link');
  feed.set(id, {
    id, n: cleanText(unesc(tag(e, 'title'))), k: tag(e, 'mpn'), b: cleanText(unesc(tag(e, 'brand'))),
    tl: price, stock: tag(e, 'availability') === 'in_stock',
    pi: img.includes('/pictures/') ? img.split('/pictures/').pop().replace(/^thumb\/\d+X-/, '') : '',
  });
}
if (feed.size < 100) throw new Error(`Beslemede çok az ürün var (${feed.size}); güvenlik için eşitleme yapılmadı`);

// ---- katalog
const meta = await db.doc('catalog/_meta').get();
if (!meta.exists) throw new Error('Katalog yok');
const parts = await Promise.all(Array.from({ length: meta.data().chunks }, (_, i) => db.doc(`catalog/c${i}`).get()));
const cat = parts.flatMap((p) => (p.exists ? p.data().items : []));
const byId = new Map(cat.map((p) => [p.id, p]));

// ---- kur: USD ürünlerde TL / USD oranının ortancası
const ratios = [];
for (const f of feed.values()) { const p = byId.get(f.id); if (p && p.cur === 'USD' && p.r > 0 && f.tl > 0) ratios.push(f.tl / p.r); }
ratios.sort((a, b) => a - b);
const rate = ratios[Math.floor(ratios.length / 2)];
if (!rate) throw new Error('Kur hesaplanamadı');

const st = { price: [], hidden: 0, shown: 0, img: 0, name: 0, added: [] };
const round2 = (v) => Math.round(v * 100) / 100;
for (const p of cat) {
  const f = feed.get(p.id);
  if (!f) {
    if (p.a && !p.so) { p.a = 0; p.so = 1; st.hidden++; } // sitede satışta değil
    continue;
  }
  if (p.so) { p.a = 1; delete p.so; st.shown++; }
  if (f.stock && !(p.s > 0)) p.s = 1;
  if (f.pi && f.pi !== p.pi && !p.img) { p.pi = f.pi; st.img++; }
  if (f.n && f.n !== p.n) { p.n = f.n; st.name++; }
  if (f.b && f.b !== '-' && f.b !== p.b) p.b = f.b;
  if (p.cur === 'USD' && f.tl > 0) {
    const usd = round2(f.tl / rate);
    if (Math.abs(usd - p.r) > Math.max(0.05, p.r * 0.005)) {
      const r0 = p.pc ? p.pc.r0 : p.r;
      st.price.push(`${p.k}: ${p.r} → ${usd}`);
      p.r = usd;
      if (Math.abs(usd - r0) < 0.01) delete p.pc; else p.pc = { r0, at: now };
    }
  }
}
for (const f of feed.values()) {
  if (byId.has(f.id)) continue;
  const p = { id: f.id, k: f.k, n: f.n, c: 0, r: round2(f.tl / rate), w: null, cur: 'USD', s: 1, a: 1, nw: 1 };
  if (f.pi) p.pi = f.pi;
  if (f.b && f.b !== '-') p.b = f.b;
  cat.push(p); st.added.push(`${f.k} ${f.n.slice(0, 40)}`);
}
cat.sort((a, b) => b.id - a.id);

const changed = st.price.length + st.hidden + st.shown + st.img + st.name + st.added.length;
const has = (id) => (feed.has(id) ? 'var' : 'yok');
const summary = `kur ${rate.toFixed(2)} · beslemede ${feed.size} ürün · fiyatı değişen ${st.price.length} · gizlenen ${st.hidden} · geri açılan ${st.shown} · resim ${st.img} · ad ${st.name} · yeni ${st.added.length}`;
note(DRY ? 'Deneme (kaydedilmedi)' : 'Eşitleme', summary);
if (st.price.length) note('Fiyatı değişenler', st.price.slice(0, 40).join('\n'));
if (st.added.length) note('Yeni ürünler', st.added.slice(0, 40).join('\n'));

// ---- yaz
function chunks(arr, max = 650000) {
  const out = []; let cur = [], size = 0;
  for (const x of arr) { const s = JSON.stringify(x).length * 1.15; if (cur.length && size + s > max) { out.push(cur); cur = []; size = 0; } cur.push(x); size += s; }
  if (cur.length) out.push(cur); return out;
}
const PUB = ['id', 'k', 'c', 'c2', 'r', 'n', 'cur', 's', 'a', 'pi', 'im', 'b', 'u', 'img'];
const pubItem = (p) => { const o = {}; for (const k of PUB) if (p[k] !== undefined && p[k] !== null) o[k] = p[k]; return o; };
async function writeChunked(col, items, key) {
  const ps = chunks(items);
  const b = db.batch();
  ps.forEach((part, i) => b.set(db.doc(`${col}/c${i}`), { [key]: part }));
  b.set(db.doc(`${col}/_meta`), { version: now, chunks: Math.max(1, ps.length), count: items.length });
  await b.commit();
}
if (!DRY) {
  if (changed) {
    await writeChunked('catalog', cat, 'items');
    await writeChunked('pubcatalog', cat.filter((p) => p.a).map(pubItem), 'items');
  }
  await db.doc('meta/sync').set({ at: now, rate: round2(rate), feed: feed.size, changed, summary, prices: st.price.slice(0, 100), added: st.added.slice(0, 100) });
}
