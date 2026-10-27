// PlatinMarket resimlerini Cloudflare R2'ye KOPYALAR (siteye bağlamaz: ürünlerdeki resim adresleri değişmez).
// Kaynak: Firestore katalog (catalog/c*) ürünlerinin pi + im alanları → https://platincdn.com/3519/pictures/<dosya>
// Hedef: R2 kutusu "ertel", anahtar  platin/<dosya>   (aynı dosya adı → iki adres birbirine birebir çevrilir:
//   platincdn.com/3519/pictures/<dosya>  ⇄  platin/<dosya>)
// Dizin: platin/_manifest.json  { v, at, files: { <dosya>: { s: bayt, t: tür, at } }, fail: { <dosya>: hata } }
// Kaldığı yerden devam eder (dizindeki dosyalar atlanır). Ortam: FIREBASE_SERVICE_ACCOUNT, WATCH_URL,
// TELEGRAM_TOKEN. Seçenekler: --limit N (deneme), --minutes M (süre dolunca durup dizini kaydeder).
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const LIMIT = arg('--limit', 0), MINUTES = arg('--minutes', 300);
const BUCKET = 'ertel', PREFIX = 'platin/', SRC = 'https://platincdn.com/3519/pictures/';
// Yazma bekçinin R2 kapısından (/r2obj/, anahtar sha256('r2:' + TELEGRAM_TOKEN)); Cloudflare REST API toplu yüklemede
// koruma sayfası (HTML 403) verip kilitleniyordu (27.10.2026, 2.845 resimden sonra).
import { createHash } from 'node:crypto';
const W = (process.env.WATCH_URL || '').replace(/\/$/, ''), TG = process.env.TELEGRAM_TOKEN;
if (!W || !TG) { console.log('::error::WATCH_URL / TELEGRAM_TOKEN yok'); process.exit(1); }
const API = W + '/r2obj/';
const auth = { 'X-Key': createHash('sha256').update('r2:' + TG).digest('hex') };
const note = (t, m) => console.log(`::notice title=${t}::${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();

// platin adresi ya da çıplak dosya adı → dosya adı (küçük resim öneki atılır); platin dışı tam adres → null
function fileOf(v) {
  const s = String(v || '').trim(); if (!s) return null;
  if (!/^(https?:)?\/\/|^\//.test(s)) return s;
  const m = /platincdn\.com\/\d+\/pictures\/(?:thumb\/\d+X-)?([^?#]+)/.exec(s);
  return m ? decodeURIComponent(m[1]) : null;
}
const keyOf = (f) => PREFIX + f.split('/').map(encodeURIComponent).join('/');

// Cloudflare API arada HTML'li 403/429 döndürüyor (hız sınırı / koruma) → izin hatası sayılmaz, bekleyip tekrar dener.
// Gerçek izin hatası JSON gelir (success:false, kod 10000 vb.) → durur.
async function r2Put(key, body, type) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(API + key, { method: 'PUT', headers: { ...auth, 'Content-Type': type }, body }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));
    if (r.ok) return;
    const t = await r.text();
    const html = /^\s*</.test(t);
    if ((r.status === 401 || r.status === 403) && !html) throw Object.assign(new Error(`R2 izni yok (${r.status}): ${t.slice(0, 200)}`), { fatal: true });
    if (i === 5) throw Object.assign(new Error(`R2 ${r.status}${html ? ' (koruma sayfası)' : ''}: ${t.slice(0, 120)}`), { fatal: html });
    await sleep(html || r.status === 429 ? 30000 * (i + 1) : 2000 * (i + 1));
  }
}
async function r2GetJson(key) {
  const r = await fetch(API + key, { headers: auth });
  if (r.status === 404) return null;
  if (!r.ok) { const t = await r.text(); throw Object.assign(new Error(`R2 okuma ${r.status}: ${t.slice(0, 200)}`), { fatal: r.status === 401 || r.status === 403 }); }
  const t = await r.text(); try { return JSON.parse(t); } catch { return null; }
}

// 1) dizin + izin kontrolü (önce küçük bir yazma denemesi)
let man;
try {
  man = (await r2GetJson(PREFIX + '_manifest.json')) || { v: 1, files: {}, fail: {} };
  await r2Put(PREFIX + '_ping.txt', 'ok ' + new Date().toISOString(), 'text/plain');
} catch (e) { console.log('::error title=R2::' + e.message + ' — bekçi yayınlandı mı (R2 bağlantısı)?'); process.exit(1); }
man.fail = man.fail || {};

// 2) katalogdaki tüm resim dosyaları
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const snap = await db.collection('catalog').get();
const items = snap.docs.filter((d) => d.id !== '_meta').flatMap((d) => d.data().items || []);
const all = new Map(); let other = 0;
for (const p of items) for (const v of [p.pi, ...(p.im || [])]) {
  if (!v) continue; const f = fileOf(v);
  if (!f) { other++; continue; }
  if (!all.has(f)) all.set(f, p.k || p.id);
}
const todo = [...all.keys()].filter((f) => !man.files[f]);
note('Resim taşıma', `${items.length} ürün, ${all.size} farklı resim (platin dışı ${other}); R2'de olan ${all.size - todo.length}, kalan ${todo.length}`);
const queue = LIMIT ? todo.slice(0, LIMIT) : todo;

// 3) kopyala: aynı anda 2 indirme, her biri arasında kısa bekleme (PlatinMarket sunucusunu yormamak için)
let done = 0, bytes = 0, failed = 0, stop = false, sinceSave = 0;
const save = async () => { man.at = Date.now(); await r2Put(PREFIX + '_manifest.json', JSON.stringify(man), 'application/json'); };
async function one(f) {
  try {
    const r = await fetch(SRC + f.split('/').map(encodeURIComponent).join('/'), { headers: { 'User-Agent': 'ertel-r2-mirror' } });
    if (!r.ok) throw new Error('indirme ' + r.status);
    const type = r.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) throw new Error('boş dosya');
    await r2Put(keyOf(f), buf, type);
    man.files[f] = { s: buf.length, t: type, at: Date.now() }; delete man.fail[f];
    done++; bytes += buf.length;
  } catch (e) {
    if (e.fatal) { stop = true; console.log('::error::' + e.message); return; }
    man.fail[f] = String(e.message).slice(0, 120); failed++;
  }
  if (++sinceSave >= 200) { sinceSave = 0; await save().catch(() => {}); console.log(`… ${done} kopyalandı, ${failed} hata, ${(bytes / 1048576).toFixed(0)} MB`); }
}
let idx = 0;
async function worker() {
  while (!stop && idx < queue.length) {
    if (Date.now() - t0 > MINUTES * 60000) { stop = true; break; }
    const f = queue[idx++]; await one(f); await sleep(700);
  }
}
await Promise.all([worker(), worker()]);
await save();

const total = Object.keys(man.files).length;
const size = Object.values(man.files).reduce((n, x) => n + x.s, 0);
note('Resim taşıma', `bu çalışmada ${done} kopyalandı (${(bytes / 1048576).toFixed(1)} MB), ${failed} hata · R2'de toplam ${total}/${all.size} resim, ${(size / 1073741824).toFixed(2)} GB`);
if (Object.keys(man.fail).length) note('Taşınamayanlar', Object.entries(man.fail).slice(0, 10).map(([f, e]) => `${f}: ${e}`).join(' | '));
if (LIMIT) note('Deneme', 'örnek: ' + queue.slice(0, 3).map((f) => `${SRC}${f} → R2 ${keyOf(f)}`).join(' | '));
if (stop && idx < queue.length) note('Yarıda kaldı', 'süre doldu; işi yeniden çalıştırınca kaldığı yerden devam eder');
