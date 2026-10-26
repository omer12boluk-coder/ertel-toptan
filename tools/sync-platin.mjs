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
    if (p.a && !p.so) { p.a = 0; p.so = 1; p.sg = 0; st.hidden++; } // beslemeden çıktı: gizlenir; silindi mi pasif mi aşağıda ürün sayfasına bakılarak anlaşılır
    continue;
  }
  if (p.so) { p.a = 1; delete p.so; delete p.sg; st.shown++; E('shown', p); }
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
const { readFileSync } = await import('node:fs');
const PARENT = new Map(JSON.parse(readFileSync(new URL('../src/categories.json', import.meta.url))).map(([id, , par]) => [id, par]));
// TEST_ID: deneme modunda ürünü yeniymiş gibi tamamlar (kaydetmez, sonucu yazar); gerçek modda eksiklerini (açıklama vb.) bir kez daha tamamlar
const TEST0 = String(process.env.TEST_ID || '').trim(); // ürün no ya da stok kodu
const TEST = Number(TEST0) || (TEST0 ? cat.find((p) => String(p.k || '').toLowerCase() === TEST0.toLowerCase())?.id || 0 : 0);
if (TEST) { const t = cat.find((p) => p.id === TEST); if (t) { note('Öncesi', JSON.stringify({ k: t.k, c: t.c, c2: t.c2, pi: t.pi, im: t.im })); t.pf = 0; if (DRY) { delete t.img; t.c = 0; delete t.c2; delete t.im; } } }
const pending = cat.filter((p) => (p.pf === 0 || p.pf === -1) && feed.has(p.id)).slice(0, 10);
let descMap = null; const newDescs = {};
if (pending.length) {
  const used = new Map(); for (const p of cat) if (p.c) used.set(p.c, (used.get(p.c) || 0) + 1);
  const dm = await db.doc('desc/_meta').get();
  if (dm.exists) { const dp = await Promise.all(Array.from({ length: dm.data().chunks }, (_, i) => db.doc(`desc/c${i}`).get())); descMap = Object.assign({}, ...dp.map((x) => (x.exists ? x.data().d : {}))); } else descMap = {};
  for (const [i, p] of pending.entries()) {
    const f = feed.get(p.id);
    if (!f.u) { p.pf = -2; continue; }
    if (i) await new Promise((r) => setTimeout(r, 3000));
    try {
      const r = await fetch(f.u, { headers: { 'User-Agent': 'ERTEL-B2B-sync/1.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      // site Türkçe kodlamayla (ISO-8859-9) gönderiyor; başlıktaki charset'e göre çöz
      const cs = (/charset=([\w-]+)/i.exec(r.headers.get('content-type') || '') || [])[1] || 'windows-1254';
      const h = new TextDecoder(/utf-?8/i.test(cs) ? 'utf-8' : 'windows-1254').decode(new Uint8Array(await r.arrayBuffer()));
      // açıklama: <div class="urun_aciklama"> … </div> (iç içe div'ler sayılarak), biçimiyle
      const ai = h.indexOf('<div class="urun_aciklama">');
      if (ai >= 0 && (!descMap[p.id] || (DRY && TEST === p.id))) {
        let k = ai + 27, depth = 1; const re = /<\/?div\b/gi; re.lastIndex = k; let m;
        while (depth && (m = re.exec(h))) { depth += m[0][1] === '/' ? -1 : 1; if (!depth) k = m.index; }
        const html = h.slice(ai + 27, k).replace(/<script[\s\S]*?<\/script>/gi, '').trim();
        if (html.replace(/<[^>]+>|&nbsp;|\s/g, '').length > 3) newDescs[p.id] = html;
      }
      // resimler: ürün şemasındaki (ld+json Product) image listesi, tam boy
      let imgs = [];
      for (const m of h.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
        try { const j = JSON.parse(m[1]); if (j['@type'] === 'Product') imgs = [].concat(j.image || []); } catch {}
      }
      const files = [...new Set(imgs.map((u) => String(u).split('?')[0]).filter((u) => u.includes('/pictures/')).map((u) => u.split('/pictures/').pop().replace(/^thumb\/\d+X-/, '')))];
      if (files.length && !p.img) { p.pi = files[0]; if (files.length > 1) p.im = files.slice(1, 10); }
      // kategori: sayfadaki reyon numaraları; katalogda kullanılanlardan en özel olanı (en az ürünlü) seçilir
      const ids = ((h.match(/kategori_urunleri_reyon_id"\s+value="([^"]*)"/) || [])[1] || '').match(/\d+/g)?.map(Number) || [];
      // en derin kategori ana kategori; ikinci kategori sadece başka bir daldaysa (üst kategorisi değilse)
      const known = ids.filter((x) => used.has(x) || PARENT.has(x));
      const anc = (x) => { const a = []; while (PARENT.get(x)) { x = PARENT.get(x); a.push(x); } return a; };
      const cand = known.sort((a, b) => anc(b).length - anc(a).length || (used.get(a) || 0) - (used.get(b) || 0));
      if (!p.c && cand.length) { p.c = cand[0]; const o = cand.find((x) => x !== p.c && !anc(p.c).includes(x) && !anc(x).includes(p.c)); if (o) p.c2 = o; }
      if (!newDescs[p.id] && f.d && !descMap[p.id]) newDescs[p.id] = f.d.replace(/\n/g, '<br />'); // sayfada yoksa beslemedeki kısa açıklama
      delete p.pf; st.filled++;
      note('Yeni ürün tamamlandı', `${p.k} · ${files.length} resim · kategori ${p.c || '—'}${newDescs[p.id] ? ' · açıklama' : ''}`);
      if (TEST) note('Sonuç', JSON.stringify({ c: p.c, c2: p.c2, pi: p.pi, im: (p.im || []).length, desc: (newDescs[p.id] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220) }));
    } catch (e) { p.pf = (p.pf || 0) - 1; note('Ürün sayfası alınamadı', `${p.k}: ${e.message}`); }
  }
}
// Elle temizlik: REMOVE_CODES (virgüllü stok kodları) — sadece beslemede OLMAYAN (sitede yok) ürünler kataloğdan kaldırılır
st.removed = 0;
for (const code of String(process.env.REMOVE_CODES || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) {
  for (const p of cat.filter((x) => String(x.k || '').toLowerCase() === code && !feed.has(x.id) && !x.man)) { cat.splice(cat.indexOf(p), 1); st.removed++; note('Kaldırıldı', `${p.k} (${p.id})`); }
}
// ---- Beslemeden çıkan ürün: siteden SİLİNDİ mi, PASİFE mi alındı? (ürün sayfasına bir kez bakılır)
// Silinmiş: sayfa 404/410 ya da başka sayfaya yönleniyor ya da sayfada bu ürün yok → katalogdan tamamen kaldırılır.
// Pasif: sayfa duruyor → uygulamada gizli (soluk) kalır. Çalışma başına en çok 6 kontrol, 3 sn arayla; elle eklenen ürünlere bakılmaz.
st.deleted = 0; st.passive = 0;
const gone = cat.filter((p) => p.so && !p.man && p.u && (p.sg === 0 || p.sg === -1 || p.id === TEST)).slice(0, 6);
for (const [i, p] of gone.entries()) {
  if (i || pending.length) await new Promise((r) => setTimeout(r, 3000));
  let verdict = null, why = '';
  try {
    const u0 = new URL(p.u, 'https://www.ertelgsm.com/'); // eski kayıtlarda adres sitesiz (/urun-adi-pmu123) olabilir
    const r = await fetch(u0.href, { redirect: 'manual', headers: { 'User-Agent': 'ERTEL-B2B-sync/1.0' } });
    if (r.status === 404 || r.status === 410) { verdict = 'deleted'; why = 'HTTP ' + r.status; }
    else if (r.status >= 300 && r.status < 400) { const to = new URL(r.headers.get('location') || '/', u0.href); why = 'yönlendirme → ' + to.pathname; verdict = to.pathname.replace(/\/$/, '') === u0.pathname.replace(/\/$/, '') ? 'passive' : 'deleted'; }
    else if (r.ok) { const h = await r.text(); const has = new RegExp(`id="urun_id"\\s+value="${p.id}"`).test(h); why = 'sayfa açıldı, ürün ' + (has ? 'var' : 'yok'); verdict = has ? 'passive' : 'deleted'; }
    else throw new Error('HTTP ' + r.status);
  } catch (e) { note('Ürün sayfası kontrol edilemedi', `${p.k}: ${e.message}`); }
  note('Siteden kalkan ürün', `${p.k} → ${verdict || 'bilinmiyor'} (${why})`);
  if (DRY && p.id === TEST) continue;
  // DOĞRULANANA KADAR KAPALI: pasif ürün sayfası da "silinmiş" gibi görünüyorsa yanlışlıkla kaldırmamak için silme yapılmaz,
  // sonuç sadece not olarak yazılır. Pasif bir ürünle denenip ayrım doğrulanınca DELETE_OK = true yapılacak.
  const DELETE_OK = process.env.DELETE_OK === '1';
  if (verdict === 'deleted' && !DELETE_OK) { p.sg = -2; E('hidden', p); continue; }
  if (verdict === 'deleted') { cat.splice(cat.indexOf(p), 1); st.deleted++; E('deleted', p); }
  else if (verdict === 'passive') { p.sg = 1; st.passive++; E('hidden', p); }
  else if (p.sg === -1 || p.sg == null) { p.sg = -2; E('hidden', p); } // iki kez anlaşılamadı: genel "satıştan kalktı"
  else p.sg = -1;
}
const changed = st.price.length + st.hidden + st.shown + st.img + st.name + st.added.length + pending.length + gone.length + st.removed;
const has = (id) => (feed.has(id) ? 'var' : 'yok');
const summary = `kur ${rate.toFixed(2)} · beslemede ${feed.size} ürün · fiyatı değişen ${st.price.length} · gizlenen ${st.hidden} · geri açılan ${st.shown} · resim ${st.img} · ad ${st.name} · yeni ${st.added.length} · tamamlanan ${st.filled} · silinen ${st.deleted} · pasif ${st.passive}`;
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
