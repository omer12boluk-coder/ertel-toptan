// PlatinMarket'ten KOPMA: veritabanındaki tüm platincdn.com / ertelgsm.com DOSYA adreslerini (açıklama resimleri, banner,
// logo, ayar şablonları, katalog) R2 "ertel" kutusuna kopyalar ve kayıtları resim.ertelmarket.com adresine ÇEVİRİR.
// Platin sadece veri girişi için kalır: "Siteyle eşitle" yeni ürünü Platin adresleriyle yazar → bu iş (r2-new.yml) hemen
// ardından o adresleri kopyalayıp çevirir. Kopyalanamayan adres DEĞİŞTİRİLMEZ (bozuk bağlantı oluşmaz).
//   Anahtarlar:  platincdn.com/3519/pictures/<f>            → platin/<f>      (ürün resimleri, r2-mirror ile aynı)
//                platincdn.com/3519/pictures/thumb/350X-<f> → platin/t/<f>    (küçük; yoksa platin/<f> kullanılır)
//                platincdn.com/3519/<diğer yol>             → platin/s/<yol>  (açıklama resimleri, banner, dosyalar)
//                (www.)ertelgsm.com/<yol>.<resim/video/pdf> → platin/w/<yol>
//   Şablonlar (ayarlarda {pi}): platincdn …/pictures/{pi} → https://resim.ertelmarket.com/platin/{pi} (küçük: platin/t/{pi})
// Bakılan yerler: settings/app, settings/public, catalog, pubcatalog, desc (+ descb kovaları yeniden yazılır).
// Kullanım: node tools/platin-free.mjs            → DENEME: sadece rapor, hiçbir şey yazmaz
//           node tools/platin-free.mjs --apply    → kopyalar + çevirir
//           --extra <dosya>  : ek adres listesi (kod içindeki varsayılanlar için; sadece kopyalar, adres eşlemesini yazdırır)
// Ortam: FIREBASE_SERVICE_ACCOUNT, TELEGRAM_TOKEN, WATCH_URL. Günlüğe veri yazmaz, sadece sayılar ve örnek adresler.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { DESC_BK, descBuckets } from '../src/kalip.js';

const APPLY = process.argv.includes('--apply');
const xi = process.argv.indexOf('--extra'); const EXTRA = xi > 0 ? process.argv[xi + 1] : null;
const BASE = 'https://resim.ertelmarket.com/';
const W = (process.env.WATCH_URL || '').replace(/\/$/, ''), TG = process.env.TELEGRAM_TOKEN;
if (!W || !TG) { console.log('::error::WATCH_URL / TELEGRAM_TOKEN yok'); process.exit(1); }
const API = W + '/r2obj/';
const auth = { 'X-Key': createHash('sha256').update('r2:' + TG).digest('hex') };
const note = (t, m) => console.log(`::notice title=${t}::${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- adres tanıma ---------------------------------------------------------------------------------------------
const RX = /https?:\/\/(?:www\.)?(?:platincdn\.com\/3519\/|ertelgsm\.com\/)[^"'\s<>\\]+/gi;
// sondaki noktalama ve eşi olmayan ')' adrese dahil değil (ör. "(bkz. https://…/a.jpg)"); dosya adındaki "(1)" korunur
function split(m) {
  let core = m;
  for (;;) {
    if (/[.,;:!]$/.test(core)) { core = core.slice(0, -1); continue; }
    if (core.endsWith(')') && (core.split(')').length > core.split('(').length)) { core = core.slice(0, -1); continue; }
    break;
  }
  return { core, tail: m.slice(core.length) };
}
const ASSET = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico|mp4|webm|mov|pdf)$/i;
const TPL = { 'https://platincdn.com/3519/pictures/{pi}': BASE + 'platin/{pi}', 'https://platincdn.com/3519/pictures/thumb/350X-{pi}': BASE + 'platin/t/{pi}' };
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const enc = (k) => k.split('/').map(encodeURIComponent).join('/');
// adres → { key, src } ya da null (dosya değilse: sayfa linki vb.)
function plan(url) {
  const clean = url.replace(/&amp;/g, '&');
  const u = clean.split('#')[0].split('?')[0];
  let m = /^https?:\/\/(?:www\.)?platincdn\.com\/3519\/(.+)$/i.exec(u);
  if (m) {
    const path = dec(m[1]);
    if (path.includes('{')) return null; // şablon, ayrı işlenir
    let t = /^pictures\/thumb\/\d+X-(.+)$/.exec(path); if (t) return { key: 'platin/t/' + t[1], alt: 'platin/' + t[1], src: u };
    t = /^pictures\/(.+)$/.exec(path); if (t) return { key: 'platin/' + t[1], src: u };
    return { key: 'platin/s/' + path, src: u };
  }
  m = /^https?:\/\/(?:www\.)?ertelgsm\.com\/(.+)$/i.exec(u);
  if (m && ASSET.test(m[1])) return { key: 'platin/w/' + dec(m[1]), src: u };
  return null;
}

// --- R2 ---------------------------------------------------------------------------------------------------------
async function exists(key) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(BASE + enc(key), { method: 'HEAD' }).catch(() => null);
    if (r && (r.status === 200 || r.status === 404)) return r.status === 200;
    await sleep(1500 * (i + 1));
  }
  return false;
}
async function r2Put(key, body, type) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(API + enc(key), { method: 'PUT', headers: { ...auth, 'Content-Type': type }, body }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
    if (r.ok) return;
    const t = await r.text();
    if ((r.status === 401 || r.status === 403) && !/^\s*</.test(t)) throw Object.assign(new Error(`R2 izni yok (${r.status})`), { fatal: true });
    if (i === 4) throw new Error(`R2 ${r.status}`);
    await sleep(/^\s*</.test(t) || r.status === 429 ? 30000 * (i + 1) : 2000 * (i + 1));
  }
}
const resolved = new Map(); // adres → yeni adres (sadece R2'de olduğu doğrulananlar)
const failed = new Map(); let copied = 0, bytes = 0;
async function ensure(url) {
  if (resolved.has(url) || failed.has(url)) return;
  const p = plan(url); if (!p) return;
  if (await exists(p.key)) { resolved.set(url, BASE + enc(p.key)); return; }
  if (p.alt && await exists(p.alt)) { resolved.set(url, BASE + enc(p.alt)); return; }
  if (!APPLY) { failed.set(url, 'kopyalanacak'); return; }
  try {
    const r = await fetch(p.src, { headers: { 'User-Agent': 'ertel-platin-free' } });
    if (!r.ok) throw new Error('indirme ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer()); if (!buf.length) throw new Error('boş dosya');
    await r2Put(p.key, buf, r.headers.get('content-type') || 'application/octet-stream');
    resolved.set(url, BASE + enc(p.key)); copied++; bytes += buf.length;
  } catch (e) {
    if (e.fatal) { console.log('::error::' + e.message); process.exit(1); }
    failed.set(url, String(e.message).slice(0, 60));
  }
  await sleep(400);
}

// --- veriyi gez / çevir --------------------------------------------------------------------------------------------
const urlsIn = (v, out) => { const s = JSON.stringify(v); for (const m of s.matchAll(RX)) out.add(split(m[0]).core); return out; };
function rewrite(v) {
  if (typeof v === 'string') {
    if (TPL[v]) return TPL[v];
    return v.replace(RX, (m) => { const { core, tail } = split(m); const r = resolved.get(core); return r ? r + tail : m; });
  }
  if (Array.isArray(v)) return v.map(rewrite);
  if (v && typeof v === 'object' && v.constructor === Object) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x)]));
  return v;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const get = async (p) => { const d = await db.doc(p).get(); return d.exists ? d.data() : null; };
const chunked = async (col) => { const m = await get(col + '/_meta'); if (!m) return { meta: null, parts: [] }; const parts = await Promise.all(Array.from({ length: m.chunks || 0 }, (_, i) => get(`${col}/c${i}`))); return { meta: m, parts }; };

const settings = { app: await get('settings/app'), public: await get('settings/public') };
const cat = await chunked('catalog'), pub = await chunked('pubcatalog'), desc = await chunked('desc');

const all = new Set(), pageLinks = new Set(), where = {};
const scan = (name, v) => { const s = urlsIn(v, new Set()); let n = 0; for (const u of s) { if (plan(u)) { all.add(u); n++; } else if (!u.includes('{')) pageLinks.add(u); } where[name] = n; };
scan('ayarlar', settings); scan('katalog', cat.parts); scan('mağaza katalogu', pub.parts); scan('açıklamalar', desc.parts);
let extra = [];
if (EXTRA && fs.existsSync(EXTRA)) { extra = fs.readFileSync(EXTRA, 'utf8').split('\n').map((x) => x.trim()).filter((x) => plan(x)); extra.forEach((u) => all.add(u)); where['kod (varsayılanlar)'] = extra.length; }
const tplHits = JSON.stringify(settings).split('{pi}').length - 1;
note('Platin adresleri', `${all.size} farklı dosya adresi · ` + Object.entries(where).map(([k, n]) => `${k} ${n}`).join(', ') + ` · ayarlarda {pi} şablonu ${tplHits}` + ` · dosya olmayan link ${pageLinks.size}`);

// kopyala (aynı anda 3)
const q = [...all]; let qi = 0;
await Promise.all([0, 1, 2].map(async () => { while (qi < q.length) { await ensure(q[qi++]); if (qi % 200 === 0) console.log(`… ${qi}/${q.length}`); } }));
note('Kopyalama', `${resolved.size} adres hazır (bu çalışmada ${copied} yeni dosya, ${(bytes / 1048576).toFixed(1)} MB) · ${failed.size} ${APPLY ? 'kopyalanamadı (adresi değiştirilmedi)' : 'henüz R2\'de yok (deneme)'}`);
if (failed.size) note('Olmayanlar (ilk 8)', [...failed].slice(0, 8).map(([u, e]) => `${u.replace(/^https?:\/\//, '')} ${e}`).join(' | '));
if (pageLinks.size) note('Dosya olmayan Platin linkleri (çevrilmedi, ilk 8)', [...pageLinks].slice(0, 8).map((u) => u.replace(/^https?:\/\//, '')).join(' | '));
if (EXTRA) fs.writeFileSync('platin-free-map.json', JSON.stringify(Object.fromEntries(extra.map((u) => [u, resolved.get(u) || null])), null, 1));

// çevir + yaz
const now = Date.now(); const changes = [];
const newSet = { app: rewrite(settings.app), public: rewrite(settings.public) };
for (const k of ['app', 'public']) if (settings[k] && !same(settings[k], newSet[k])) { changes.push('settings/' + k); if (APPLY) await db.doc('settings/' + k).set(newSet[k]); }
for (const [col, c] of [['catalog', cat], ['pubcatalog', pub]]) {
  if (!c.meta) continue; let n = 0; const b = db.batch();
  c.parts.forEach((part, i) => { if (!part) return; const np = rewrite(part); if (!same(part, np)) { n++; b.set(db.doc(`${col}/c${i}`), np); } });
  if (n) { changes.push(`${col} ${n} parça`); if (APPLY) { b.set(db.doc(col + '/_meta'), { ...c.meta, version: now }); await b.commit(); } }
}
if (desc.meta) {
  const map = Object.assign({}, ...desc.parts.map((x) => (x && x.d) || {}));
  const nmap = rewrite(map); const diff = Object.keys(map).filter((id) => map[id] !== nmap[id]).length;
  if (diff) {
    changes.push(`açıklamalar ${diff} ürün`);
    if (APPLY) {
      const entries = Object.entries(nmap); const parts = []; let cur = [], size = 0;
      for (const x of entries) { const s = JSON.stringify(x).length * 1.15; if (cur.length && size + s > 650000) { parts.push(cur); cur = []; size = 0; } cur.push(x); size += s; }
      if (cur.length) parts.push(cur);
      const b = db.batch(); parts.forEach((part, i) => b.set(db.doc(`desc/c${i}`), { d: Object.fromEntries(part) }));
      const bv = {}; descBuckets(nmap).forEach((d, i) => { b.set(db.doc(`descb/b${i}`), { v: now, d }); bv[i] = now; });
      b.set(db.doc('desc/_meta'), { version: now, chunks: parts.length, count: entries.length, bk: DESC_BK, bv });
      await b.commit();
    }
  }
}
note(APPLY ? 'Çevrildi' : 'Deneme: çevrilecekler', changes.length ? changes.join(' · ') : 'değişiklik yok');
// kalan (çevrilemeyen) dosya adresi sayısı
const left = new Set(); urlsIn([newSet, ...cat.parts.map(rewrite), ...pub.parts.map(rewrite), ...desc.parts.map(rewrite)], left);
note('Kalan Platin dosya adresi', String([...left].filter((u) => plan(u)).length));
