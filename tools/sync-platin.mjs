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
    d: unesc(tag(e, 'description')).trim(), u: unesc(tag(e, 'link')).trim(), // yeni ürünü tamamlamak için
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
// yönetim panelindeki bildirim merkezi için olay günlüğü (meta/feed): t price|name|new|hidden|shown
const ev = [];
const E = (t, p, extra) => ev.push({ t, at: now, id: p.id, k: p.k || '', n: String(p.n || '').slice(0, 90), ...extra });
const round2 = (v) => Math.round(v * 100) / 100;
for (const p of cat) {
  const f = feed.get(p.id);
  if (!f) {
    if (p.man) continue; // yönetimden elle eklenen ürün: sitede olmaması normal, gizlenmez
    if (p.a && !p.so) { p.a = 0; p.so = 1; st.hidden++; E('hidden', p); } // sitede satışta değil
    continue;
  }
  if (p.so) { p.a = 1; delete p.so; st.shown++; E('shown', p); }
  if (f.stock && !(p.s > 0)) p.s = 1;
  if (f.pi && f.pi !== p.pi && !p.img) { p.pi = f.pi; st.img++; }
  if (f.n && f.n !== p.n) { E('name', p, { from: String(p.n || '').slice(0, 90), n: f.n.slice(0, 90) }); p.n = f.n; st.name++; }
  if (f.b && f.b !== '-' && f.b !== p.b) p.b = f.b;
  if (p.cur === 'USD' && f.tl > 0) {
    const usd = round2(f.tl / rate);
    if (Math.abs(usd - p.r) > Math.max(0.05, p.r * 0.005)) {
      const r0 = p.pc ? p.pc.r0 : p.r;
      st.price.push(`${p.k}: ${p.r} → ${usd}`); E('price', p, { from: p.r, to: usd, ...(p.w != null ? { w: p.w } : {}) }); // elle toptan fiyatı korunur, bildirimde ayrıca belirtilir
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
  if (f.u) p.u = f.u;
  p.pf = 0; // ürün sayfasından tamamlanacak (resimler, kategori)
  cat.push(p); st.added.push(`${f.k} ${f.n.slice(0, 40)}`); E('new', p, { to: p.r });
}
cat.sort((a, b) => b.id - a.id);

// ---- Yeni ürünleri tamamla (tam otomatik ekleme)
// Sadece eşitlemenin eklediği yeni ürünler (pf 0 / -1): ürün sayfasına BİR kez bakılır → tüm resimler + kategori.
// Siteyi yormamak için çalışma başına en çok 10 ürün, istekler arası 3 sn. Açıklama beslemeden gelir (ek istek yok).
// Başarısız olursa bir kez daha denenir (pf -1), sonra bırakılır (pf -2). Sonradan Excel yüklenirse onun bilgileri geçerli olur.
st.filled = 0;
const TEST = DRY && Number(process.env.TEST_ID); // deneme: bir ürünü yeniymiş gibi tamamla (kaydetmeden), sonucu yaz
if (TEST) { const t = cat.find((p) => p.id === TEST); if (t) { note('Deneme öncesi', JSON.stringify({ k: t.k, c: t.c, c2: t.c2, pi: t.pi, im: t.im })); t.pf = 0; delete t.img; t.c = 0; delete t.c2; delete t.im; } }
const pending = cat.filter((p) => (p.pf === 0 || p.pf === -1) && feed.has(p.id)).slice(0, DRY ? 2 : 10);
let descMap = null; const newDescs = {};
if (pending.length) {
  const used = new Map(); for (const p of cat) if (p.c) used.set(p.c, (used.get(p.c) || 0) + 1);
  const dm = await db.doc('desc/_meta').get();
  if (dm.exists) { const dp = await Promise.all(Array.from({ length: dm.data().chunks }, (_, i) => db.doc(`desc/c${i}`).get())); descMap = Object.assign({}, ...dp.map((x) => (x.exists ? x.data().d : {}))); } else descMap = {};
  for (const [i, p] of pending.entries()) {
    const f = feed.get(p.id);
    if (f.d && !descMap[p.id]) newDescs[p.id] = f.d.replace(/\n/g, '<br />');
    if (!f.u) { p.pf = -2; continue; }
    if (i) await new Promise((r) => setTimeout(r, 3000));
    try {
      const r = await fetch(f.u, { headers: { 'User-Agent': 'ERTEL-B2B-sync/1.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const h = await r.text();
      // resimler: ürün şemasındaki (ld+json Product) image listesi, tam boy
      let imgs = [];
      for (const m of h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
        try { const j = JSON.parse(m[1]); if (j['@type'] === 'Product') imgs = [].concat(j.image || []); } catch {}
      }
      const files = [...new Set(imgs.map((u) => String(u).split('?')[0]).filter((u) => u.includes('/pictures/')).map((u) => u.split('/pictures/').pop().replace(/^thumb\/\d+X-/, '')))];
      if (files.length && !p.img) { p.pi = files[0]; if (files.length > 1) p.im = files.slice(1, 10); }
      // kategori: sayfadaki reyon numaraları; katalogda kullanılanlardan en özel olanı (en az ürünlü) seçilir
      const ids = ((h.match(/kategori_urunleri_reyon_id"\s+value="([^"]*)"/) || [])[1] || '').match(/\d+/g)?.map(Number) || [];
      const cand = ids.filter((x) => used.has(x)).sort((a, b) => used.get(a) - used.get(b));
      if (!p.c && cand.length) { p.c = cand[0]; if (cand[1]) p.c2 = cand[1]; }
      delete p.pf; st.filled++;
      note('Yeni ürün tamamlandı', `${p.k} · ${files.length} resim · kategori ${p.c || '—'}${newDescs[p.id] ? ' · açıklama' : ''}`);
      if (TEST) note('Deneme sonucu', JSON.stringify({ c: p.c, c2: p.c2, pi: p.pi, im: p.im, desc: (f.d || '').slice(0, 200) }));
    } catch (e) { p.pf = (p.pf || 0) - 1; note('Ürün sayfası alınamadı', `${p.k}: ${e.message}`); }
  }
}
const changed = st.price.length + st.hidden + st.shown + st.img + st.name + st.added.length + pending.length;
const has = (id) => (feed.has(id) ? 'var' : 'yok');
const summary = `kur ${rate.toFixed(2)} · beslemede ${feed.size} ürün · fiyatı değişen ${st.price.length} · gizlenen ${st.hidden} · geri açılan ${st.shown} · resim ${st.img} · ad ${st.name} · yeni ${st.added.length} · tamamlanan ${st.filled}`;
note(DRY ? 'Deneme (kaydedilmedi)' : 'Eşitleme', summary);
if (st.price.length) note('Fiyatı değişenler', st.price.slice(0, 40).join('\n'));
if (st.added.length) note('Yeni ürünler', st.added.slice(0, 40).join('\n'));

// ---- yaz
function chunks(arr, max = 650000) {
  const out = []; let cur = [], size = 0;
  for (const x of arr) { const s = JSON.stringify(x).length * 1.15; if (cur.length && size + s > max) { out.push(cur); cur = []; size = 0; } cur.push(x); size += s; }
  if (cur.length) out.push(cur); return out;
}
const PUB = ['id', 'k', 'c', 'c2', 'r', 'n', 'cur', 's', 'a', 'pi', 'im', 'b', 'u', 'img', 'vd', 'vdp', 'man'];
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
  if (ev.length) {
    const ref = db.doc('meta/feed');
    const old = (await ref.get()).data()?.items || [];
    await ref.set({ at: now, items: [...ev.slice(0, 300), ...old].slice(0, 400) });
    // yöneticiye anlık bildirim + Telegram özeti (bekçi üzerinden)
    const W = process.env.WATCH_URL, T = process.env.TELEGRAM_TOKEN;
    if (W && T) {
      const { createHash } = await import('node:crypto');
      const key = createHash('sha256').update('sync:' + T).digest('hex');
      await fetch(W.replace(/\/$/, '') + '/notify-sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Key': key }, body: JSON.stringify({ items: ev.slice(0, 40), count: ev.length }) })
        .then((r) => r.text()).then((t) => note('Bildirim', t.slice(0, 200))).catch((e) => note('Bildirim hatası', e));
    }
  }
  if (Object.keys(newDescs).length) { // açıklamalar (sadece hiç açıklaması olmayan yeni ürünler)
    const all = Object.entries({ ...descMap, ...newDescs }); const dp = chunks(all);
    const b = db.batch(); dp.forEach((part, i) => b.set(db.doc(`desc/c${i}`), { d: Object.fromEntries(part) }));
    b.set(db.doc('desc/_meta'), { version: now, chunks: dp.length, count: all.length }); await b.commit();
  }
  await db.doc('meta/sync').set({ at: now, rate: round2(rate), feed: feed.size, changed, summary, prices: st.price.slice(0, 100), added: st.added.slice(0, 100) });
}
